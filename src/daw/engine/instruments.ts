import { InstrumentManifest } from '../library/catalogTypes';
import { StretchService } from '../dsp/stretchService';

/**
 * Instruments for MIDI tracks.
 *  - Sampled: multi-sampled MP3s from the site's /audio/samples/ (nearest-sample
 *    repitch, amplitude envelope). Drum kits map GM drum notes to one-shots.
 *  - Synth presets ("synth:*"): oscillator voices; always available offline.
 * Voices are scheduled with exact start/stop times; nothing depends on timers.
 */

export interface Voice {
  stop(when: number): void;
}

export interface InstrumentDescriptor {
  id: string;
  name: string;
  family: string;
  kind: 'melodic' | 'drumkit';
  range?: [number, number];
}

/** Per-track settings handed to every note (only samplers use them). */
export interface NoteOptions {
  /** See InstrumentRef.startLevel. */
  startLevel?: number;
}

export interface PlayableInstrument {
  readonly id: string;
  readonly kind: 'melodic' | 'drumkit';
  noteOn(ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number, when: number, offset?: number, opts?: NoteOptions): Voice;
  /** Seconds of release tail after noteOff. */
  readonly release: number;
  /** Samplers only: get these keys ready at the recording's own speed (keys outside the always-ready range). */
  want?(pitches: Iterable<number>): void;
  /** Samplers only: resolves when every requested key has been prepared (or failed, and stays tape-style). */
  settled?(): Promise<void>;
  /** Samplers only: stop preparing keys and release them. */
  close?(): void;
}

/** Shifts a sound by whole semitones WITHOUT changing its length (runs off the audio thread). */
export type PitchShifter = (channels: Float32Array[], semitones: number, sampleRate: number, signal: AbortSignal) => Promise<Float32Array[]>;

export const SYNTH_PRESETS: InstrumentDescriptor[] = [
  { id: 'synth:lead', name: 'Synth Lead', family: 'Synth', kind: 'melodic' },
  { id: 'synth:bass', name: 'Synth Bass', family: 'Synth', kind: 'melodic' },
  { id: 'synth:pad', name: 'Warm Pad', family: 'Synth', kind: 'melodic' },
  { id: 'synth:pluck', name: 'Pluck', family: 'Synth', kind: 'melodic' },
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const velGain = (v: number) => Math.pow(v / 127, 1.6);

class SynthInstrument implements PlayableInstrument {
  readonly kind = 'melodic' as const;
  readonly release: number;
  constructor(
    readonly id: string,
    private preset: string,
  ) {
    this.release = preset === 'pad' ? 0.6 : preset === 'pluck' ? 0.15 : 0.08;
  }
  noteOn(ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number, when: number): Voice {
    const f = mtof(pitch);
    const amp = ctx.createGain();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    const oscs: OscillatorNode[] = [];
    const add = (type: OscillatorType, detune: number, freq = f) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      o.connect(filt);
      oscs.push(o);
    };
    const peak = velGain(velocity) * 0.22;
    let attack = 0.004;
    let sustain = peak * 0.7;
    switch (this.preset) {
      case 'bass':
        add('sawtooth', 0);
        add('square', 0, f / 2);
        filt.frequency.setValueAtTime(Math.min(8000, f * 8), when);
        filt.frequency.exponentialRampToValueAtTime(Math.max(80, f * 2), when + 0.25);
        sustain = peak * 0.8;
        break;
      case 'pad':
        add('sawtooth', -8);
        add('sawtooth', 8);
        add('triangle', 0, f / 2);
        filt.frequency.value = Math.min(6000, f * 4);
        attack = 0.35;
        sustain = peak * 0.9;
        break;
      case 'pluck':
        add('triangle', 0);
        add('square', 5);
        filt.frequency.setValueAtTime(Math.min(12000, f * 12), when);
        filt.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), when + 0.3);
        sustain = peak * 0.15;
        break;
      default:
        add('sawtooth', -5);
        add('square', 5);
        filt.frequency.value = Math.min(9000, f * 6);
        filt.Q.value = 2;
    }
    filt.connect(amp).connect(dest);
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(peak, when + attack);
    amp.gain.setTargetAtTime(sustain, when + attack, 0.1);
    for (const o of oscs) o.start(when);
    const release = this.release;
    return {
      stop(at: number) {
        const t = Math.max(at, when + 0.005);
        amp.gain.cancelScheduledValues(t);
        amp.gain.setTargetAtTime(0, t, release / 4);
        for (const o of oscs) o.stop(t + release + 0.05);
        oscs[0].onended = () => amp.disconnect();
      },
    };
  }
}

class SampledInstrument implements PlayableInstrument {
  readonly release: number;
  private notes: number[];
  constructor(
    readonly id: string,
    readonly kind: 'melodic' | 'drumkit',
    protected samples: Map<number, AudioBuffer>,
  ) {
    this.notes = [...samples.keys()].sort((a, b) => a - b);
    this.release = kind === 'drumkit' ? 0 : 0.25;
  }

  /** Add a sound that is ready to play exactly at `note` (used as soon as it exists). */
  protected addSample(note: number, buf: AudioBuffer) {
    this.samples.set(note, buf);
    this.notes = [...this.samples.keys()].sort((a, b) => a - b);
  }

  /** Seconds of the sound to skip at the start of every note. */
  protected startSkip(_opts?: NoteOptions): number {
    return 0;
  }

  /** Called when a key had no sound of its own and a neighbour was repitched instead. */
  protected onMiss(_pitch: number): void {}

  private nearest(pitch: number): number {
    let best = this.notes[0];
    for (const n of this.notes) if (Math.abs(n - pitch) < Math.abs(best - pitch)) best = n;
    return best;
  }

  noteOn(ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number, when: number, offset = 0, opts?: NoteOptions): Voice {
    const silent: Voice = { stop() {} };
    let root: number;
    if (this.kind === 'drumkit') {
      if (!this.samples.has(pitch)) return silent;
      root = pitch;
    } else {
      if (!this.notes.length) return silent;
      root = this.nearest(pitch);
      if (root !== pitch) this.onMiss(pitch);
    }
    const buf = this.samples.get(root)!;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const rate = this.kind === 'drumkit' ? 1 : Math.pow(2, (pitch - root) / 12);
    src.playbackRate.value = rate;
    const amp = ctx.createGain();
    const g = velGain(velocity) * (this.kind === 'drumkit' ? 0.9 : 0.8);
    amp.gain.setValueAtTime(0, when);
    amp.gain.linearRampToValueAtTime(g, when + 0.002);
    src.connect(amp).connect(dest);
    src.start(when, Math.min(this.startSkip(opts) + offset * rate, buf.duration - 0.001));
    src.onended = () => amp.disconnect();
    const kind = this.kind;
    const release = this.release;
    return {
      stop(at: number) {
        if (kind === 'drumkit') return; // one-shots ring out naturally
        const t = Math.max(at, when + 0.005);
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(g, t);
        amp.gain.setTargetAtTime(0, t, release / 4);
        try {
          src.stop(t + release + 0.05);
        } catch {
          /* already stopped */
        }
      },
    };
  }
}

/** Instrument id for a sampler built from a project audio asset ("sampler:<asset key>"). */
export const SAMPLER_PREFIX = 'sampler:';
/** The key on the keyboard that plays a sampler's sound at its recorded pitch (middle C). */
export const SAMPLER_ROOT = 60;
const SAMPLER_MAX_SEC = 8;
/** Default "sound starts at" loudness (fraction of the recording's peak) and the slider's top end. */
export const SAMPLER_START_DEFAULT = 0.04;
export const SAMPLER_START_MAX = 0.4;
/** The recording keeps everything louder than this before its start (so the slider can reach back to it). */
const SAMPLER_LEAD_FLOOR = 0.004;
const SAMPLER_PREROLL_SEC = 0.004;

/**
 * Prepare a recording to be played as an instrument: cut the silence before and after it,
 * keep at most 8 s, and bring the peak up to a steady level so every sampler is about as loud.
 */
export function trimSample(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  let peak = 0;
  for (const d of chans) for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak < 1e-4) return buf;
  // Keep nearly everything before the sound (the user's "sound starts at" slider decides where a note begins);
  // the end is cut at the usual level.
  const leadThr = peak * SAMPLER_LEAD_FLOOR;
  const tailThr = peak * SAMPLER_START_DEFAULT;
  let first = buf.length;
  let last = 0;
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > leadThr) { first = Math.min(first, i); break; }
    for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > tailThr) { last = Math.max(last, i); break; }
  }
  const sr = buf.sampleRate;
  const start = Math.max(0, first - Math.round(0.004 * sr));
  const end = Math.min(buf.length, last + Math.round(0.08 * sr), start + SAMPLER_MAX_SEC * sr);
  const len = Math.max(1, end - start);
  const out = ctx.createBuffer(buf.numberOfChannels, len, sr);
  const gain = Math.min(8, 0.8 / peak);
  const fade = Math.min(len, Math.round(0.01 * sr));
  chans.forEach((d, c) => {
    const o = out.getChannelData(c);
    for (let i = 0; i < len; i++) o[i] = d[start + i] * gain * (i >= len - fade ? (len - i) / fade : 1);
  });
  return out;
}

/** Keys within this many semitones of middle C are prepared as soon as a sampler loads. */
export const SAMPLER_SPAN = 12;
/** Keys farther out (up to this far) are prepared the first time they are asked for. */
export const SAMPLER_SPAN_FAR = 24;
const SAMPLER_QUALITY = 'fast' as const;

/**
 * A recording played across the keyboard at ONE speed.
 * Playing the recording faster for higher keys (and slower for lower ones) also makes it shorter / longer.
 * Instead, a pitched copy of the same length is prepared for each key in the background and played as-is,
 * so a note starts exactly as fast as any other instrument's (no work at note time).
 * Until a key's copy is ready the nearest ready key is repitched the old way, so nothing ever waits or goes quiet.
 * Voice character moves with pitch (higher = smaller, lower = bigger); only the speed stays put.
 */
class SamplerInstrument extends SampledInstrument {
  private tail: Promise<void> = Promise.resolve();
  private requested = new Set<number>();
  private abort = new AbortController();
  private warned = false;

  constructor(
    id: string,
    private ctx: BaseAudioContext,
    private base: AudioBuffer,
    private shift: PitchShifter | null,
  ) {
    super(id, 'melodic', new Map([[SAMPLER_ROOT, base]]));
    if (!shift) return;
    for (let d = 1; d <= SAMPLER_SPAN; d++) {
      this.queue(SAMPLER_ROOT + d);
      this.queue(SAMPLER_ROOT - d);
    }
  }

  settled(): Promise<void> {
    return this.tail;
  }

  private peak = 0;
  private skips = new Map<number, number>();

  /** Seconds before the sound reaches `startLevel` of its peak (a few ms of lead-in kept). Same on every key. */
  protected override startSkip(opts?: NoteOptions): number {
    const level = Math.min(SAMPLER_START_MAX, Math.max(0, opts?.startLevel ?? SAMPLER_START_DEFAULT));
    const key = Math.round(level * 1000);
    const hit = this.skips.get(key);
    if (hit !== undefined) return hit;
    if (!this.peak) for (let c = 0; c < this.base.numberOfChannels; c++) for (const v of this.base.getChannelData(c)) this.peak = Math.max(this.peak, Math.abs(v));
    const thr = this.peak * (key / 1000);
    let first = this.base.length;
    for (let c = 0; c < this.base.numberOfChannels; c++) {
      const d = this.base.getChannelData(c);
      for (let i = 0; i < first; i++) if (Math.abs(d[i]) > thr) { first = i; break; }
    }
    const sec = first >= this.base.length ? 0 : Math.max(0, first / this.base.sampleRate - SAMPLER_PREROLL_SEC);
    this.skips.set(key, sec);
    return sec;
  }

  close() {
    this.abort.abort();
  }

  want(pitches: Iterable<number>) {
    for (const p of pitches) this.queue(p);
  }

  protected override onMiss(pitch: number) {
    this.queue(pitch);
  }

  private queue(pitch: number) {
    const d = pitch - SAMPLER_ROOT;
    if (!this.shift || d === 0 || Math.abs(d) > SAMPLER_SPAN_FAR || this.requested.has(pitch) || this.abort.signal.aborted) return;
    this.requested.add(pitch);
    this.tail = this.tail.then(() => this.make(pitch, d));
  }

  private async make(pitch: number, d: number) {
    const signal = this.abort.signal;
    if (signal.aborted || !this.shift) return;
    // Within one octave shift the recording directly; farther keys shift the octave key again.
    const edge = Math.sign(d) * SAMPLER_SPAN;
    const from = Math.abs(d) <= SAMPLER_SPAN ? this.base : this.samples.get(SAMPLER_ROOT + edge);
    const semitones = Math.abs(d) <= SAMPLER_SPAN ? d : d - edge;
    if (!from) return; // the octave key failed to prepare; this key stays tape-style
    try {
      const channels = Array.from({ length: from.numberOfChannels }, (_, c) => from.getChannelData(c));
      const out = await this.shift(channels, semitones, from.sampleRate, signal);
      if (signal.aborted || !out.length) return;
      const buf = this.ctx.createBuffer(out.length, out[0].length, from.sampleRate);
      out.forEach((ch, c) => buf.copyToChannel(ch as Float32Array<ArrayBuffer>, c));
      this.addSample(pitch, buf);
    } catch (err) {
      if (signal.aborted) return;
      if (!this.warned) {
        this.warned = true;
        console.warn('[daw] could not keep the sampler at one speed on some keys; they play tape-style', err);
      }
    }
  }
}

/** Loads the manifest and instruments on demand; decoded samples are shared. */
export class InstrumentBank {
  private manifestPromise: Promise<InstrumentManifest | null> | null = null;
  private loaded = new Map<string, PlayableInstrument>();
  private loading = new Map<string, Promise<PlayableInstrument>>();
  error: string | null = null;
  /** Supplies the audio for "sampler:" instruments (set by the engine). */
  sampleSource: ((assetKey: string) => Promise<AudioBuffer | undefined>) | null = null;
  /** Keeps sampler speed constant across keys. Defaults to the stretch worker; null = classic tape-style repitch. */
  shifter: PitchShifter | null | undefined = undefined;
  private stretch: StretchService | null = null;

  constructor(
    private ctx: BaseAudioContext,
    private manifestUrl = '/daw-library/instruments.json',
    private fetchBytes: (url: string) => Promise<ArrayBuffer> = (u) => fetch(u).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    }),
  ) {}

  async list(): Promise<InstrumentDescriptor[]> {
    const m = await this.loadManifest();
    const sampled: InstrumentDescriptor[] = (m?.instruments ?? []).map((i) => ({ id: i.id, name: i.name, family: i.family, kind: i.kind, range: i.range }));
    return [...sampled, ...SYNTH_PRESETS];
  }

  private loadManifest(): Promise<InstrumentManifest | null> {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(this.manifestUrl, { cache: 'no-cache' })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<InstrumentManifest>;
        })
        .then((m) => m)
        .catch((err: unknown) => {
          this.error = `Sampled instruments unavailable (${err instanceof Error ? err.message : err}); using synth sounds.`;
          return null;
        });
    }
    return this.manifestPromise;
  }

  private pitchShifter(): PitchShifter | null {
    if (this.shifter !== undefined) return this.shifter;
    if (typeof Worker === 'undefined') return null;
    return (channels, semitones, sampleRate, signal) => {
      this.stretch ??= new StretchService();
      return this.stretch.process(channels, { ratio: 1, semitones, quality: SAMPLER_QUALITY, sampleRate }, signal);
    };
  }

  /** Stop background work and free the keys of every sampler. */
  dispose() {
    for (const inst of this.loaded.values()) inst.close?.();
    this.stretch?.dispose();
    this.stretch = null;
  }

  get(id: string): PlayableInstrument | undefined {
    return this.loaded.get(id);
  }

  async load(id: string): Promise<PlayableInstrument> {
    const have = this.loaded.get(id);
    if (have) return have;
    const inflight = this.loading.get(id);
    if (inflight) return inflight;
    const p = this.doLoad(id).then((inst) => {
      this.loaded.set(id, inst);
      this.loading.delete(id);
      return inst;
    });
    p.catch(() => this.loading.delete(id));
    this.loading.set(id, p);
    return p;
  }

  private async doLoad(id: string): Promise<PlayableInstrument> {
    if (id.startsWith('synth:')) return new SynthInstrument(id, id.slice(6));
    if (id.startsWith(SAMPLER_PREFIX)) {
      const buf = await this.sampleSource?.(id.slice(SAMPLER_PREFIX.length)).catch(() => undefined);
      if (!buf) throw new Error('The sound for this sampler is not available on this computer.');
      return new SamplerInstrument(id, this.ctx, trimSample(this.ctx, buf), this.pitchShifter());
    }
    const m = await this.loadManifest();
    const def = m?.instruments.find((i) => i.id === id);
    if (!m || !def) {
      // Unknown or unavailable sampled instrument: fall back to a synth so the part still plays.
      return new SynthInstrument(id, 'lead');
    }
    const samples = new Map<number, AudioBuffer>();
    await Promise.all(
      Object.entries(def.samples).map(async ([note, rel]) => {
        const url = new URL(rel, new URL(m.baseUrl, location.href)).href;
        try {
          const bytes = await this.fetchBytes(url);
          samples.set(Number(note), await this.ctx.decodeAudioData(bytes));
        } catch (err) {
          console.warn(`[daw] sample failed: ${url}`, err);
        }
      }),
    );
    if (samples.size === 0) return new SynthInstrument(id, 'lead');
    return new SampledInstrument(id, def.kind, samples);
  }
}
