// Playback for Pro Staff. The main sound is the MuseScore_General SoundFont (soundfont.ts); the site's
// CC0 recordings are the fallback if it cannot load (e.g. blocked by a network filter).
import { SoundFontEngine } from './soundfont';

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

export interface PedalEvent {
  time: number;
  staffN: string;
  down: boolean;
}

export interface StaffMix {
  volume: number; // 0..1
  pan: number; // -1 (left) .. 1 (right)
  reverb: number; // send 0..1
  mute: boolean;
  solo: boolean;
}

export interface MasterMix {
  volume: number; // 0..1
  reverb: number; // 0..1 room amount
  brightness: number; // -1 (dark) .. 1 (bright)
}

export const DEFAULT_STAFF_MIX: StaffMix = { volume: 0.8, pan: 0, reverb: 0.35, mute: false, solo: false };
export const DEFAULT_MASTER_MIX: MasterMix = { volume: 0.85, reverb: 0.5, brightness: 0 };

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
  private sf: SoundFontEngine | null = null;
  private sfFailed = false;
  // master chain: input -> low shelf -> high shelf -> compressor -> volume -> speakers; reverb bus joins before EQ
  private input: GainNode | null = null;
  private master: GainNode | null = null;
  private lowShelf: BiquadFilterNode | null = null;
  private highShelf: BiquadFilterNode | null = null;
  private reverbIn: GainNode | null = null;
  private reverbOut: GainNode | null = null;
  private strips = new Map<string, { gain: GainNode; pan: StereoPannerNode; send: GainNode }>();
  private timer: number | null = null;
  private raf: number | null = null;
  private notes: PlayNote[] = [];
  private cues: Cue[] = [];
  private clicks: Click[] = [];
  private pedals: PedalEvent[] = [];
  private noteIdx = 0;
  private clickIdx = 0;
  private cueIdx = 0;
  private pedalIdx = 0;
  private startCtxTime = 0;
  private startOffset = 0;
  private tempoFactor = 1;
  private loopEnd: number | null = null;
  private loopStart = 0;
  metronome = false;
  /** Moves the metronome earlier (negative) or later (positive), in ms, to match what the ear hears. */
  clickOffsetMs = 0;
  mix: Record<string, StaffMix> = {};
  masterMix: MasterMix = { ...DEFAULT_MASTER_MIX };
  playing = false;
  onCue: ((on: string[], off: string[], measure?: string) => void) | null = null;
  onStop: (() => void) | null = null;
  onTime: ((ms: number) => void) | null = null;
  onLoading: ((fraction: number | null) => void) | null = null;

  get engineName() {
    return this.sf?.ready ? 'soundfont' : 'samples';
  }

  async init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      this.ctx = ctx;
      this.input = ctx.createGain();
      this.lowShelf = ctx.createBiquadFilter();
      this.lowShelf.type = 'lowshelf';
      this.lowShelf.frequency.value = 220;
      this.highShelf = ctx.createBiquadFilter();
      this.highShelf.type = 'highshelf';
      this.highShelf.frequency.value = 3800;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.2;
      this.master = ctx.createGain();
      this.input.connect(this.lowShelf).connect(this.highShelf).connect(comp).connect(this.master).connect(ctx.destination);
      // hall reverb for the sample fallback (the SoundFont has its own reverb)
      this.reverbIn = ctx.createGain();
      this.reverbOut = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = hallImpulse(ctx, 2.6);
      this.reverbIn.connect(conv).connect(this.reverbOut).connect(this.input);
      this.applyMaster();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (!this.manifest) {
      const r = await fetch(BASE + 'cc0/instruments.cc0.json');
      this.manifest = (await r.json()) as InstrumentManifest;
      this.sampler = new Sampler(this.ctx, this.manifest);
    }
  }

  /** Loads the SoundFont the first time (about 40 MB, cached by the browser afterwards). */
  async loadSoundFont(): Promise<boolean> {
    await this.init();
    if (this.sf?.ready) return true;
    if (this.sfFailed) return false;
    try {
      if (!this.sf) this.sf = new SoundFontEngine(this.ctx!, this.input!);
      this.onLoading?.(0);
      await this.sf.init((f) => this.onLoading?.(f));
      return true;
    } catch (e) {
      console.warn('SoundFont unavailable, using the basic samples', e);
      this.sfFailed = true;
      return false;
    } finally {
      this.onLoading?.(null);
    }
  }

  private strip(staffN: string) {
    let st = this.strips.get(staffN);
    if (!st) {
      const ctx = this.ctx!;
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      const send = ctx.createGain();
      gain.connect(pan).connect(this.input!);
      pan.connect(send).connect(this.reverbIn!);
      st = { gain, pan, send };
      this.strips.set(staffN, st);
      this.applyStrip(staffN);
    }
    return st;
  }

  private audible(staffN: string) {
    const anySolo = Object.values(this.mix).some((m) => m.solo);
    const m = this.mix[staffN];
    return !m || (!m.mute && (!anySolo || m.solo));
  }

  private applyStrip(staffN: string) {
    const m = { ...DEFAULT_STAFF_MIX, ...this.mix[staffN] };
    const vol = this.audible(staffN) ? m.volume : 0;
    const st = this.strips.get(staffN);
    const now = this.ctx?.currentTime ?? 0;
    if (st) {
      st.gain.gain.setTargetAtTime(vol, now, 0.02);
      st.pan.pan.setTargetAtTime(m.pan, now, 0.02);
      st.send.gain.setTargetAtTime(m.reverb * 0.9, now, 0.02);
    }
    this.sf?.setStrip(staffN, vol, m.pan, m.reverb);
  }

  applyMaster() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const m = this.masterMix;
    this.master!.gain.setTargetAtTime(m.volume, now, 0.02);
    this.lowShelf!.gain.setTargetAtTime(-m.brightness * 5, now, 0.05);
    this.highShelf!.gain.setTargetAtTime(m.brightness * 7, now, 0.05);
    this.reverbOut!.gain.setTargetAtTime(m.reverb * 1.2, now, 0.05);
    this.sf?.setReverbScale(m.reverb);
  }

  applyMix() {
    if (!this.ctx) return;
    const names = new Set([...Object.keys(this.mix), ...this.strips.keys()]);
    for (const n of names) this.applyStrip(n);
  }

  /** Sounds a note right away (note entry feedback). */
  async audition(sample: string, midis: number[], staffN = 'x', program?: number, drums = false) {
    try {
      await this.init();
      const at = this.ctx!.currentTime + 0.01;
      if (this.sf?.ready && program !== undefined) {
        for (const m of midis) this.sf.audition(program, drums, m, at);
        return;
      }
      for (const m of midis) void this.sampler!.play(sample, m, at, 0.45, 0.7, this.strip(staffN).gain);
    } catch {
      /* audio is optional */
    }
  }

  async play(data: { notes: PlayNote[]; cues: Cue[]; clicks: Click[]; pedals: PedalEvent[]; channels: import('./soundfont').ChannelSetup[] }, fromMs: number, tempoFactor: number, loop?: { start: number; end: number } | null, startAt?: number) {
    await this.init();
    this.stop(false);
    const sfOk = await this.loadSoundFont();
    this.notes = data.notes;
    this.cues = data.cues;
    this.clicks = data.clicks;
    this.pedals = data.pedals;
    this.tempoFactor = tempoFactor;
    this.loopStart = loop?.start ?? fromMs;
    this.loopEnd = loop?.end ?? null;
    if (sfOk) this.sf!.setup(data.channels);
    for (const ch of data.channels) this.strip(ch.staffN);
    this.applyMix();
    this.applyMaster();
    if (!sfOk) {
      // load the first few seconds of samples before starting
      await this.sampler!.preload(this.notes.filter((n) => n.time >= fromMs && n.time < fromMs + 8000));
      void this.sampler!.preload(this.notes);
    }
    this.seek(fromMs, startAt);
    this.playing = true;
    this.timer = window.setInterval(() => this.schedule(), 25);
    // the screen follows what is heard (the audio clock minus the output delay), every frame
    const tick = () => {
      if (!this.playing) return;
      const heard = this.heardPosition();
      while (this.cueIdx < this.cues.length && this.cues[this.cueIdx].time <= heard) {
        const c = this.cues[this.cueIdx];
        this.onCue?.(c.on, c.off, c.measureOn);
        this.cueIdx++;
      }
      this.onTime?.(heard);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.schedule();
  }

  private seek(ms: number, startAt?: number) {
    this.startOffset = ms;
    this.startCtxTime = Math.max(startAt ?? 0, this.ctx!.currentTime + 0.1);
    const first = <T extends { time: number }>(list: T[]) => {
      const i = list.findIndex((n) => n.time >= ms - 1);
      return i < 0 ? list.length : i;
    };
    this.noteIdx = first(this.notes);
    this.clickIdx = first(this.clicks);
    this.cueIdx = first(this.cues);
    this.pedalIdx = first(this.pedals);
    // a pedal already held down at the start point
    if (this.sf?.ready) {
      const held = new Map<string, boolean>();
      for (const p of this.pedals) if (p.time < ms) held.set(p.staffN, p.down);
      for (const [staffN, down] of held) if (down) this.sf.pedal(staffN, true, this.startCtxTime);
    }
  }

  position(): number {
    if (!this.ctx) return 0;
    return this.startOffset + Math.max(0, this.ctx.currentTime - this.startCtxTime) * 1000 * this.tempoFactor;
  }

  /** The score position the listener is hearing right now (sound leaves the speakers a little after it is rendered). */
  heardPosition(): number {
    if (!this.ctx) return 0;
    const delay = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    return Math.max(this.startOffset, this.position() - delay * 1000 * this.tempoFactor);
  }

  private ctxTimeOf(ms: number) {
    return this.startCtxTime + (ms - this.startOffset) / 1000 / this.tempoFactor;
  }

  private schedule() {
    if (!this.ctx || !this.playing) return;
    const horizon = this.ctx.currentTime + 0.2;
    const sf = this.sf?.ready ? this.sf : null;
    while (this.pedalIdx < this.pedals.length) {
      const p = this.pedals[this.pedalIdx];
      if (this.loopEnd != null && p.time >= this.loopEnd) break;
      const at = this.ctxTimeOf(p.time);
      if (at > horizon) break;
      sf?.pedal(p.staffN, p.down, at);
      this.pedalIdx++;
    }
    while (this.noteIdx < this.notes.length) {
      const n = this.notes[this.noteIdx];
      if (this.loopEnd != null && n.time >= this.loopEnd) break;
      const at = this.ctxTimeOf(n.time);
      if (at > horizon) break;
      const dur = n.dur / 1000 / this.tempoFactor;
      if (sf) sf.noteOn(n.staffN, n.midi, n.velocity, Math.max(at, this.ctx.currentTime), dur);
      else if (this.audible(n.staffN)) void this.sampler!.play(n.sample, n.midi, at, dur, n.velocity, this.strip(n.staffN).gain);
      this.noteIdx++;
    }
    while (this.clickIdx < this.clicks.length) {
      const c = this.clicks[this.clickIdx];
      if (this.loopEnd != null && c.time >= this.loopEnd) break;
      const at = this.ctxTimeOf(c.time);
      if (at > horizon) break;
      if (this.metronome) this.click(at + this.clickOffsetMs / 1000, c.accent);
      this.clickIdx++;
    }
    const pos = this.position();
    const end = this.loopEnd ?? Math.max(this.notes.length ? this.notes[this.notes.length - 1].time + this.notes[this.notes.length - 1].dur : 0, this.cues.length ? this.cues[this.cues.length - 1].time : 0);
    if (pos >= end + 50) {
      if (this.loopEnd != null) {
        this.onCue?.([], ['*'], undefined);
        sf?.stopAll();
        this.seek(this.loopStart);
      } else this.stop(true);
    }
  }

  private click(at: number, accent: boolean) {
    const ctx = this.ctx!;
    at = Math.max(at, ctx.currentTime);
    if (this.sf?.ready) {
      this.sf.click(at, accent);
      return;
    }
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

  /** Schedules a one-bar count-in and returns the audio-clock time the music should start (exactly one beat after the last click). */
  async countIn(beats: number, beatMs: number, tempoFactor: number): Promise<number> {
    await this.init();
    await this.loadSoundFont();
    const beat = beatMs / 1000 / tempoFactor;
    const t0 = this.ctx!.currentTime + 0.15;
    for (let i = 0; i < beats; i++) this.click(t0 + i * beat + this.clickOffsetMs / 1000, i === 0);
    return t0 + beats * beat;
  }

  stop(notify = true) {
    const was = this.playing;
    this.playing = false;
    if (this.timer != null) clearInterval(this.timer);
    if (this.raf != null) cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = null;
    this.sf?.stopAll();
    // notes already queued a moment ahead can still start; clear them once more
    if (was) window.setTimeout(() => { if (!this.playing) this.sf?.stopAll(); }, 260);
    if (this.ctx && was) {
      // silence ringing sample notes quickly by replacing the channel strips
      for (const st of this.strips.values()) st.gain.disconnect();
      this.strips.clear();
    }
    if (notify && was) this.onStop?.();
  }
}

/** A synthetic concert-hall impulse response (decaying stereo noise with early reflections). */
function hallImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      const early = t < 0.08 && Math.random() < 0.004 ? (Math.random() * 2 - 1) * 0.8 : 0;
      d[i] = ((Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) + early) * 0.5;
    }
  }
  return buf;
}

export const DYNAMIC_VELOCITY: Record<string, number> = {
  pppp: 0.15, ppp: 0.22, pp: 0.32, p: 0.44, mp: 0.56, mf: 0.68, f: 0.8, ff: 0.9, fff: 0.97, ffff: 1,
  sf: 0.9, sfz: 0.92, sffz: 0.97, fz: 0.9, rf: 0.85, rfz: 0.88, fp: 0.8,
};
