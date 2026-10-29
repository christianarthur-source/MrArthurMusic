import { AssetManager } from '../engine/assets';
import { CatalogEntry } from './catalogTypes';
import { LibraryCatalog } from './catalog';

/**
 * Loop audition. Uses the small preview file; optionally time-stretches it to
 * the project tempo (pitch preserved) so students hear how it will fit.
 * Only one preview plays at a time; switching stops the previous one with a fade.
 */

export interface PreviewState {
  id: string | null;
  loading: boolean;
  synced: boolean; // true when playing at project tempo
  error: string | null;
}

export class PreviewPlayer {
  private src: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private decoded = new Map<string, AudioBuffer>(); // small LRU of preview buffers
  private token = 0;
  state: PreviewState = { id: null, loading: false, synced: false, error: null };
  private listeners = new Set<() => void>();
  readonly output: GainNode;

  constructor(
    private ctx: AudioContext,
    private catalog: LibraryCatalog,
    private assets: AssetManager,
  ) {
    this.output = ctx.createGain();
    this.output.gain.value = 0.9;
    this.output.connect(ctx.destination);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(p: Partial<PreviewState>) {
    this.state = { ...this.state, ...p };
    for (const l of this.listeners) l();
  }

  async play(entry: CatalogEntry, projectBpm: number | null) {
    const token = ++this.token;
    this.stopSource();
    this.set({ id: entry.id, loading: true, error: null, synced: false });
    void this.ctx.resume();
    try {
      let buf = this.decoded.get(entry.id);
      if (!buf) {
        const bytes = await this.assets.fetchLibrary(this.catalog.url(entry.preview));
        buf = await this.assets.decode(bytes, entry.name);
        buf = trim(this.ctx, buf, entry);
        this.decoded.set(entry.id, buf);
        if (this.decoded.size > 24) this.decoded.delete(this.decoded.keys().next().value!);
      }
      let synced = false;
      if (projectBpm && entry.bpm && !entry.oneShot && Math.abs(projectBpm / entry.bpm - 1) > 0.005) {
        const ratio = entry.bpm / projectBpm;
        if (ratio >= 0.5 && ratio <= 2) {
          const ch = Array.from({ length: buf.numberOfChannels }, (_, c) => buf!.getChannelData(c));
          const out = await this.assets.stretch.process(ch, { ratio, semitones: 0, quality: 'fast', sampleRate: buf.sampleRate });
          if (token !== this.token) return;
          const s = this.ctx.createBuffer(out.length, out[0].length, buf.sampleRate);
          out.forEach((d, c) => s.copyToChannel(d as Float32Array<ArrayBuffer>, c));
          buf = s;
          synced = true;
        }
      }
      if (token !== this.token) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !entry.oneShot;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime + 0.01;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1, t + 0.01);
      src.connect(g).connect(this.output);
      src.start(t);
      src.onended = () => {
        if (this.src === src) {
          this.src = null;
          this.set({ id: null });
        }
      };
      this.src = src;
      this.gain = g;
      this.set({ loading: false, synced });
    } catch (err) {
      if (token !== this.token) return;
      this.set({ id: null, loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  }

  private stopSource() {
    if (this.src && this.gain) {
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(this.gain.gain.value, t);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.03);
      this.src.stop(t + 0.04);
    }
    this.src = null;
    this.gain = null;
  }

  stop() {
    this.token++;
    this.stopSource();
    this.set({ id: null, loading: false });
  }
}

/** Previews are short MP3s: trim encoder delay exactly like full assets. */
function trim(ctx: BaseAudioContext, buf: AudioBuffer, entry: CatalogEntry): AudioBuffer {
  const k = buf.sampleRate / entry.sampleRate;
  const delay = Math.round(entry.previewEncoderDelay * k);
  const maxLen = Math.round(Math.min(entry.frames, entry.sampleRate * 12) * k);
  const extra = buf.length - maxLen;
  if (extra <= 2 || delay === 0) return buf;
  const start = extra >= delay * 0.9 ? delay : 0;
  const len = Math.min(maxLen, buf.length - start);
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start, start + len), c);
  return out;
}
