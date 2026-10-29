import { InstrumentManifest } from '../library/catalogTypes';

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

export interface PlayableInstrument {
  readonly id: string;
  readonly kind: 'melodic' | 'drumkit';
  noteOn(ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number, when: number, offset?: number): Voice;
  /** Seconds of release tail after noteOff. */
  readonly release: number;
}

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
    private samples: Map<number, AudioBuffer>,
  ) {
    this.notes = [...samples.keys()].sort((a, b) => a - b);
    this.release = kind === 'drumkit' ? 0 : 0.25;
  }

  private nearest(pitch: number): number {
    let best = this.notes[0];
    for (const n of this.notes) if (Math.abs(n - pitch) < Math.abs(best - pitch)) best = n;
    return best;
  }

  noteOn(ctx: BaseAudioContext, dest: AudioNode, pitch: number, velocity: number, when: number, offset = 0): Voice {
    const silent: Voice = { stop() {} };
    let root: number;
    if (this.kind === 'drumkit') {
      if (!this.samples.has(pitch)) return silent;
      root = pitch;
    } else {
      if (!this.notes.length) return silent;
      root = this.nearest(pitch);
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
    src.start(when, Math.min(offset * rate, buf.duration - 0.001));
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

/** Loads the manifest and instruments on demand; decoded samples are shared. */
export class InstrumentBank {
  private manifestPromise: Promise<InstrumentManifest | null> | null = null;
  private loaded = new Map<string, PlayableInstrument>();
  private loading = new Map<string, Promise<PlayableInstrument>>();
  error: string | null = null;

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
