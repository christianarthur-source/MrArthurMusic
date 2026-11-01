// Sample-based playback for Pro Staff, using the site's CC0 instrument recordings.

interface InstrumentManifest {
  instruments: { id: string; kind: string; samples: Record<string, string>; noteNames?: Record<string, string> }[];
}

export interface PlayNote {
  time: number; // ms from start (at tempo factor 1)
  dur: number; // ms
  midi: number;
  staffN: string;
  velocity: number; // 0..1
  sample: string;
  id: string;
}

export interface Cue {
  time: number;
  on: string[];
  off: string[];
  measureOn?: string;
}

export interface Click {
  time: number;
  accent: boolean;
}

export interface StaffMix {
  volume: number; // 0..1
  mute: boolean;
  solo: boolean;
}

const BASE = '/audio/';

class Sampler {
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  constructor(private ctx: AudioContext, private manifest: InstrumentManifest) {}

  private keys(instrument: string): number[] {
    const def = this.manifest.instruments.find((i) => i.id === instrument);
    return def ? Object.keys(def.samples).map(Number).sort((a, b) => a - b) : [];
  }

  private load(instrument: string, key: number): Promise<AudioBuffer | null> {
    const k = `${instrument}:${key}`;
    let p = this.buffers.get(k);
    if (!p) {
      const def = this.manifest.instruments.find((i) => i.id === instrument);
      const path = def?.samples[String(key)];
      p = path
        ? fetch(BASE + path)
            .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
            .then((b) => this.ctx.decodeAudioData(b))
            .catch(() => null)
        : Promise.resolve(null);
      this.buffers.set(k, p);
    }
    return p;
  }

  nearest(instrument: string, midi: number): number | null {
    const keys = this.keys(instrument);
    if (!keys.length) return null;
    const def = this.manifest.instruments.find((i) => i.id === instrument);
    if (def?.kind === 'drumkit') return keys.includes(midi) ? midi : keys.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
    return keys.reduce((a, b) => (Math.abs(b - midi) < Math.abs(a - midi) ? b : a));
  }

  async preload(notes: { sample: string; midi: number }[]) {
    const wanted = new Set<string>();
    const jobs: Promise<unknown>[] = [];
    for (const n of notes) {
      const key = this.nearest(n.sample, n.midi);
      if (key == null) continue;
      const k = `${n.sample}:${key}`;
      if (wanted.has(k)) continue;
      wanted.add(k);
      jobs.push(this.load(n.sample, key));
    }
    await Promise.all(jobs);
  }

  async play(instrument: string, midi: number, when: number, dur: number, velocity: number, dest: AudioNode) {
    const key = this.nearest(instrument, midi);
    if (key == null) return;
    const buf = await this.load(instrument, key);
    if (!buf) return;
    const drum = this.manifest.instruments.find((i) => i.id === instrument)?.kind === 'drumkit';
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (!drum) src.playbackRate.value = Math.pow(2, (midi - key) / 12);
    const g = this.ctx.createGain();
    const peak = 0.15 + 0.85 * velocity * velocity;
    const start = Math.max(when, this.ctx.currentTime);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(peak, start + 0.005);
    const end = start + Math.max(0.05, dur);
    if (!drum) {
      g.gain.setValueAtTime(peak, end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
    }
    src.connect(g).connect(dest);
    src.start(start);
    src.stop(drum ? start + buf.duration : end + 0.3);
  }
}

export class Player {
  ctx: AudioContext | null = null;
  private sampler: Sampler | null = null;
  private manifest: InstrumentManifest | null = null;
  private master: GainNode | null = null;
  private staffGains = new Map<string, GainNode>();
  private timer: number | null = null;
  private raf: number | null = null;
  private notes: PlayNote[] = [];
  private cues: Cue[] = [];
  private clicks: Click[] = [];
  private noteIdx = 0;
  private clickIdx = 0;
  private cueIdx = 0;
  private startCtxTime = 0;
  private startOffset = 0;
  private tempoFactor = 1;
  private loopEnd: number | null = null;
  private loopStart = 0;
  metronome = false;
  mix: Record<string, StaffMix> = {};
  playing = false;
  onCue: ((on: string[], off: string[], measure?: string) => void) | null = null;
  onStop: (() => void) | null = null;
  onTime: ((ms: number) => void) | null = null;

  async init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.manifest) {
      const r = await fetch(BASE + 'cc0/instruments.cc0.json');
      this.manifest = (await r.json()) as InstrumentManifest;
      this.sampler = new Sampler(this.ctx, this.manifest);
    }
  }

  private gainFor(staffN: string): GainNode {
    let g = this.staffGains.get(staffN);
    if (!g) {
      g = this.ctx!.createGain();
      g.connect(this.master!);
      this.staffGains.set(staffN, g);
    }
    return g;
  }

  applyMix() {
    if (!this.ctx) return;
    const anySolo = Object.values(this.mix).some((m) => m.solo);
    for (const [n, m] of Object.entries(this.mix)) {
      const audible = !m.mute && (!anySolo || m.solo);
      this.gainFor(n).gain.setTargetAtTime(audible ? m.volume : 0, this.ctx.currentTime, 0.02);
    }
  }

  /** Sounds a single note right away (note entry feedback). */
  async audition(sample: string, midis: number[], staffN = 'x') {
    try {
      await this.init();
      for (const m of midis) void this.sampler!.play(sample, m, this.ctx!.currentTime + 0.01, 0.45, 0.7, this.gainFor(staffN));
    } catch {
      /* audio is optional */
    }
  }

  async play(data: { notes: PlayNote[]; cues: Cue[]; clicks: Click[] }, fromMs: number, tempoFactor: number, loop?: { start: number; end: number } | null) {
    await this.init();
    this.stop(false);
    this.notes = data.notes;
    this.cues = data.cues;
    this.clicks = data.clicks;
    this.tempoFactor = tempoFactor;
    this.loopStart = loop?.start ?? fromMs;
    this.loopEnd = loop?.end ?? null;
    this.applyMix();
    // load the first few seconds of samples before starting
    await this.sampler!.preload(this.notes.filter((n) => n.time >= fromMs && n.time < fromMs + 8000));
    void this.sampler!.preload(this.notes);
    this.seek(fromMs);
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), 25);
    const tick = () => {
      if (!this.playing) return;
      this.onTime?.(this.position());
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.schedule();
  }

  private seek(ms: number) {
    this.startOffset = ms;
    this.startCtxTime = this.ctx!.currentTime + 0.08;
    this.noteIdx = this.notes.findIndex((n) => n.time >= ms - 1);
    if (this.noteIdx < 0) this.noteIdx = this.notes.length;
    this.clickIdx = this.clicks.findIndex((c) => c.time >= ms - 1);
    if (this.clickIdx < 0) this.clickIdx = this.clicks.length;
    this.cueIdx = this.cues.findIndex((c) => c.time >= ms - 1);
    if (this.cueIdx < 0) this.cueIdx = this.cues.length;
  }

  position(): number {
    if (!this.ctx) return 0;
    return this.startOffset + Math.max(0, this.ctx.currentTime - this.startCtxTime) * 1000 * this.tempoFactor;
  }

  private ctxTimeOf(ms: number) {
    return this.startCtxTime + (ms - this.startOffset) / 1000 / this.tempoFactor;
  }

  private schedule() {
    if (!this.ctx || !this.playing) return;
    const horizon = this.ctx.currentTime + 0.15;
    const anySolo = Object.values(this.mix).some((m) => m.solo);
    while (this.noteIdx < this.notes.length) {
      const n = this.notes[this.noteIdx];
      if (this.loopEnd != null && n.time >= this.loopEnd) break;
      const at = this.ctxTimeOf(n.time);
      if (at > horizon) break;
      const m = this.mix[n.staffN];
      const audible = !m || (!m.mute && (!anySolo || m.solo));
      if (audible) void this.sampler!.play(n.sample, n.midi, at, n.dur / 1000 / this.tempoFactor, n.velocity, this.gainFor(n.staffN));
      this.noteIdx++;
    }
    while (this.clickIdx < this.clicks.length) {
      const c = this.clicks[this.clickIdx];
      if (this.loopEnd != null && c.time >= this.loopEnd) break;
      const at = this.ctxTimeOf(c.time);
      if (at > horizon) break;
      if (this.metronome) this.click(at, c.accent);
      this.clickIdx++;
    }
    const pos = this.position();
    while (this.cueIdx < this.cues.length && this.cues[this.cueIdx].time <= pos) {
      const c = this.cues[this.cueIdx];
      this.onCue?.(c.on, c.off, c.measureOn);
      this.cueIdx++;
    }
    const end = this.loopEnd ?? Math.max(this.notes.length ? this.notes[this.notes.length - 1].time + this.notes[this.notes.length - 1].dur : 0, this.cues.length ? this.cues[this.cues.length - 1].time : 0);
    if (pos >= end + 50) {
      if (this.loopEnd != null) {
        this.onCue?.([], ['*'], undefined);
        this.seek(this.loopStart);
      } else this.stop(true);
    }
  }

  private click(at: number, accent: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + 0.08);
  }

  /** A short count-in of clicks before playback (one bar). */
  async countIn(beats: number, beatMs: number, tempoFactor: number) {
    await this.init();
    const t0 = this.ctx!.currentTime + 0.05;
    for (let i = 0; i < beats; i++) this.click(t0 + (i * beatMs) / 1000 / tempoFactor, i === 0);
    await new Promise((r) => setTimeout(r, (beats * beatMs) / tempoFactor));
  }

  stop(notify = true) {
    const was = this.playing;
    this.playing = false;
    if (this.timer != null) clearInterval(this.timer);
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = null;
    if (this.master && this.ctx && was) {
      // silence ringing notes quickly
      for (const g of this.staffGains.values()) {
        g.disconnect();
      }
      this.staffGains.clear();
    }
    if (notify && was) this.onStop?.();
  }
}

export const DYNAMIC_VELOCITY: Record<string, number> = {
  pppp: 0.15, ppp: 0.22, pp: 0.32, p: 0.44, mp: 0.56, mf: 0.68, f: 0.8, ff: 0.9, fff: 0.97, ffff: 1,
  sf: 0.9, sfz: 0.92, sffz: 0.97, fz: 0.9, rf: 0.85, rfz: 0.88, fp: 0.8,
};
