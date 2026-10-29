import { EffectInstance, EffectType } from '../model/types';

/**
 * Effect implementations on native Web Audio nodes. Context-agnostic, so the
 * same code runs in the live AudioContext and in OfflineAudioContext export.
 *
 * Every effect is wrapped with a bypass path: input -> dry ----\
 *                                               input -> fx -> wet -> output
 * Bypass crossfades in 20 ms so toggling never clicks.
 */

export interface AutomationTarget {
  param: AudioParam;
  /** Converts a value in the parameter's UI units to the AudioParam value. */
  map: (v: number) => number;
}

export interface EffectNode {
  readonly type: EffectType;
  readonly input: AudioNode;
  readonly output: AudioNode;
  update(fx: EffectInstance): void;
  automation(key: string): AutomationTarget | null;
  dispose(): void;
}

const dbToGain = (db: number) => Math.pow(10, db / 20);
const RAMP = 0.02;

function smooth(param: AudioParam, value: number, ctx: BaseAudioContext) {
  const t = ctx.currentTime;
  if (t === 0) {
    // Before rendering starts (offline export / brand-new context): set exactly, no ramp.
    param.value = value;
    return;
  }
  param.cancelScheduledValues(t);
  param.setTargetAtTime(value, t, RAMP / 3);
}

abstract class Base implements EffectNode {
  abstract readonly type: EffectType;
  readonly input: GainNode;
  readonly output: GainNode;
  protected readonly dry: GainNode;
  protected readonly wet: GainNode;
  protected fxIn: GainNode;
  protected fxOut: GainNode;
  private bypassed = false;
  protected readonly nodes: AudioNode[] = [];
  protected readonly sources: AudioScheduledSourceNode[] = [];

  constructor(protected ctx: BaseAudioContext) {
    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.fxIn = ctx.createGain();
    this.fxOut = ctx.createGain();
    this.dry.gain.value = 0;
    this.input.connect(this.dry).connect(this.output);
    this.input.connect(this.fxIn);
    this.fxOut.connect(this.wet).connect(this.output);
  }

  protected track<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }

  update(fx: EffectInstance) {
    if (fx.bypass !== this.bypassed) {
      this.bypassed = fx.bypass;
      smooth(this.dry.gain, fx.bypass ? 1 : 0, this.ctx);
      smooth(this.wet.gain, fx.bypass ? 0 : 1, this.ctx);
    }
    this.apply(fx.params);
  }

  protected abstract apply(p: Record<string, number>): void;

  automation(_key: string): AutomationTarget | null {
    return null;
  }

  protected set(param: AudioParam, v: number) {
    smooth(param, v, this.ctx);
  }

  dispose() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    for (const n of [this.input, this.output, this.dry, this.wet, this.fxIn, this.fxOut, ...this.nodes]) n.disconnect();
  }
}

class Eq3 extends Base {
  readonly type = 'eq3' as const;
  private low = this.track(this.ctx.createBiquadFilter());
  private mid = this.track(this.ctx.createBiquadFilter());
  private high = this.track(this.ctx.createBiquadFilter());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.low.type = 'lowshelf';
    this.mid.type = 'peaking';
    this.mid.Q.value = 0.8;
    this.high.type = 'highshelf';
    this.fxIn.connect(this.low).connect(this.mid).connect(this.high).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.low.gain, p.low);
    this.set(this.mid.gain, p.mid);
    this.set(this.high.gain, p.high);
    this.set(this.low.frequency, p.lowFreq);
    this.set(this.mid.frequency, p.midFreq);
    this.set(this.high.frequency, p.highFreq);
  }
  override automation(key: string) {
    const id = (v: number) => v;
    if (key === 'low') return { param: this.low.gain, map: id };
    if (key === 'mid') return { param: this.mid.gain, map: id };
    if (key === 'high') return { param: this.high.gain, map: id };
    return null;
  }
}

class Compressor extends Base {
  readonly type = 'compressor' as const;
  private comp = this.track(this.ctx.createDynamicsCompressor());
  private makeup = this.track(this.ctx.createGain());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.comp.knee.value = 6;
    this.fxIn.connect(this.comp).connect(this.makeup).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.comp.threshold, p.threshold);
    this.set(this.comp.ratio, p.ratio);
    this.set(this.comp.attack, p.attack);
    this.set(this.comp.release, p.release);
    this.set(this.makeup.gain, dbToGain(p.makeup));
  }
}

/** Deterministic exponential-decay noise impulse response (no network asset needed). */
export function makeImpulse(ctx: BaseAudioContext, decaySec: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * Math.min(6, decaySec) * 1.2));
  const buf = ctx.createBuffer(2, len, sr);
  let seed = 0x12345678;
  const rand = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 0xffffffff) * 2 - 1;
  };
  const tau = decaySec / 6.9; // -60 dB at decaySec
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const early = i < sr * 0.004 ? i / (sr * 0.004) : 1; // soft onset
      d[i] = rand() * Math.exp(-t / tau) * early;
    }
  }
  return buf;
}

class Reverb extends Base {
  readonly type = 'reverb' as const;
  private conv = this.track(this.ctx.createConvolver());
  private pre = this.track(this.ctx.createDelay(0.2));
  private tone = this.track(this.ctx.createBiquadFilter());
  private wetMix = this.track(this.ctx.createGain());
  private dryMix = this.track(this.ctx.createGain());
  private decay = -1;
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.tone.type = 'lowpass';
    this.fxIn.connect(this.dryMix).connect(this.fxOut);
    this.fxIn.connect(this.pre).connect(this.conv).connect(this.tone).connect(this.wetMix).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    if (Math.abs(p.decay - this.decay) > 0.05) {
      this.decay = p.decay;
      this.conv.buffer = makeImpulse(this.ctx, p.decay);
    }
    this.set(this.wetMix.gain, p.mix * 0.9);
    this.set(this.dryMix.gain, 1 - p.mix * 0.5);
    this.set(this.tone.frequency, p.tone);
    this.set(this.pre.delayTime, p.predelay);
  }
  override automation(key: string) {
    if (key === 'mix') return { param: this.wetMix.gain, map: (v: number) => v * 0.9 };
    return null;
  }
}

class Delay extends Base {
  readonly type = 'delay' as const;
  private delay = this.track(this.ctx.createDelay(2));
  private fb = this.track(this.ctx.createGain());
  private tone = this.track(this.ctx.createBiquadFilter());
  private wetMix = this.track(this.ctx.createGain());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.tone.type = 'lowpass';
    this.fxIn.connect(this.fxOut); // dry passes through
    this.fxIn.connect(this.delay);
    this.delay.connect(this.tone);
    this.tone.connect(this.fb).connect(this.delay);
    this.tone.connect(this.wetMix).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.delay.delayTime, p.time);
    this.set(this.fb.gain, Math.min(0.85, p.feedback));
    this.set(this.tone.frequency, p.tone);
    this.set(this.wetMix.gain, p.mix);
  }
  override automation(key: string) {
    if (key === 'mix') return { param: this.wetMix.gain, map: (v: number) => v };
    return null;
  }
}

class Chorus extends Base {
  readonly type = 'chorus' as const;
  private dl = this.track(this.ctx.createDelay(0.1));
  private dr = this.track(this.ctx.createDelay(0.1));
  private lfo = this.ctx.createOscillator();
  private depthL = this.track(this.ctx.createGain());
  private depthR = this.track(this.ctx.createGain());
  private merger = this.track(this.ctx.createChannelMerger(2));
  private wetMix = this.track(this.ctx.createGain());
  private dryMix = this.track(this.ctx.createGain());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.dl.delayTime.value = 0.018;
    this.dr.delayTime.value = 0.022;
    this.lfo.connect(this.depthL).connect(this.dl.delayTime);
    this.lfo.connect(this.depthR).connect(this.dr.delayTime);
    this.fxIn.connect(this.dryMix).connect(this.fxOut);
    this.fxIn.connect(this.dl).connect(this.merger, 0, 0);
    this.fxIn.connect(this.dr).connect(this.merger, 0, 1);
    this.merger.connect(this.wetMix).connect(this.fxOut);
    this.lfo.start();
    this.nodes.push(this.lfo);
    this.sources.push(this.lfo);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.lfo.frequency, p.rate);
    this.set(this.depthL.gain, p.depth * 0.006);
    this.set(this.depthR.gain, -p.depth * 0.006);
    this.set(this.wetMix.gain, p.mix * 0.8);
    this.set(this.dryMix.gain, 1 - p.mix * 0.4);
  }
}

class Phaser extends Base {
  readonly type = 'phaser' as const;
  private stages: BiquadFilterNode[] = [];
  private lfo = this.ctx.createOscillator();
  private lfoGain = this.track(this.ctx.createGain());
  private fb = this.track(this.ctx.createGain());
  private fbDelay = this.track(this.ctx.createDelay(0.01));
  private wetMix = this.track(this.ctx.createGain());
  private dryMix = this.track(this.ctx.createGain());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    let prev: AudioNode = this.fxIn;
    for (let i = 0; i < 4; i++) {
      const ap = this.track(ctx.createBiquadFilter());
      ap.type = 'allpass';
      ap.frequency.value = 700;
      ap.Q.value = 0.6;
      this.lfoGain.connect(ap.frequency);
      prev.connect(ap);
      prev = ap;
      this.stages.push(ap);
    }
    // Feedback loops in Web Audio require a DelayNode (min one render quantum).
    this.fbDelay.delayTime.value = 128 / ctx.sampleRate;
    prev.connect(this.fb).connect(this.fbDelay).connect(this.stages[0]);
    prev.connect(this.wetMix).connect(this.fxOut);
    this.fxIn.connect(this.dryMix).connect(this.fxOut);
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
    this.nodes.push(this.lfo);
    this.sources.push(this.lfo);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.lfo.frequency, p.rate);
    this.set(this.lfoGain.gain, 600 * p.depth);
    this.set(this.fb.gain, Math.min(0.8, p.feedback));
    this.set(this.wetMix.gain, p.mix * 0.7);
    this.set(this.dryMix.gain, 1 - p.mix * 0.3);
  }
}

function tanhCurve(): Float32Array {
  const n = 2048;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(3 * x) / Math.tanh(3);
  }
  return c;
}

class Distortion extends Base {
  readonly type = 'distortion' as const;
  private pre = this.track(this.ctx.createGain());
  private shaper = this.track(this.ctx.createWaveShaper());
  private tone = this.track(this.ctx.createBiquadFilter());
  private post = this.track(this.ctx.createGain());
  private wetMix = this.track(this.ctx.createGain());
  private dryMix = this.track(this.ctx.createGain());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.shaper.curve = tanhCurve() as Float32Array<ArrayBuffer>;
    this.shaper.oversample = '2x';
    this.tone.type = 'lowpass';
    this.fxIn.connect(this.pre).connect(this.shaper).connect(this.tone).connect(this.post).connect(this.wetMix).connect(this.fxOut);
    this.fxIn.connect(this.dryMix).connect(this.fxOut);
  }
  private driveGain = (d: number) => Math.pow(10, (d * 36) / 20); // 0..36 dB
  protected apply(p: Record<string, number>) {
    this.set(this.pre.gain, this.driveGain(p.drive));
    this.set(this.tone.frequency, p.tone);
    this.set(this.post.gain, dbToGain(p.output));
    this.set(this.wetMix.gain, p.mix);
    this.set(this.dryMix.gain, 1 - p.mix);
  }
  override automation(key: string) {
    if (key === 'drive') return { param: this.pre.gain, map: this.driveGain };
    return null;
  }
}

class Filter extends Base {
  readonly type = 'filter' as const;
  private f = this.track(this.ctx.createBiquadFilter());
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.fxIn.connect(this.f).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    const mode = Math.round(p.mode);
    this.f.type = mode === 1 ? 'highpass' : mode === 2 ? 'bandpass' : 'lowpass';
    this.set(this.f.frequency, p.cutoff);
    this.set(this.f.Q, p.resonance);
  }
  override automation(key: string) {
    if (key === 'cutoff') return { param: this.f.frequency, map: (v: number) => v };
    return null;
  }
}

/**
 * Master-bus protection: fast compressor as a limiter, followed by a static
 * clipper at the ceiling so nothing above the ceiling can reach the output.
 * (DynamicsCompressorNode has no look-ahead; the clipper catches overshoot.)
 */
class Limiter extends Base {
  readonly type = 'limiter' as const;
  private inGain = this.track(this.ctx.createGain());
  private comp = this.track(this.ctx.createDynamicsCompressor());
  private clip = this.track(this.ctx.createWaveShaper());
  private ceiling = NaN;
  constructor(ctx: BaseAudioContext) {
    super(ctx);
    this.comp.knee.value = 0;
    this.comp.ratio.value = 20;
    this.comp.attack.value = 0.002;
    this.comp.release.value = 0.1;
    this.fxIn.connect(this.inGain).connect(this.comp).connect(this.clip).connect(this.fxOut);
  }
  protected apply(p: Record<string, number>) {
    this.set(this.inGain.gain, dbToGain(p.gain));
    this.set(this.comp.threshold, p.ceiling - 2);
    if (p.ceiling !== this.ceiling) {
      this.ceiling = p.ceiling;
      const c = dbToGain(p.ceiling);
      const n = 4096;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1; // input range [-1, 1] maps to the curve
        curve[i] = Math.max(-c, Math.min(c, x));
      }
      this.clip.curve = curve as Float32Array<ArrayBuffer>;
    }
  }
}

const CTORS: Record<EffectType, new (ctx: BaseAudioContext) => Base> = {
  eq3: Eq3,
  compressor: Compressor,
  reverb: Reverb,
  delay: Delay,
  chorus: Chorus,
  phaser: Phaser,
  distortion: Distortion,
  filter: Filter,
  limiter: Limiter,
};

export function createEffectNode(ctx: BaseAudioContext, fx: EffectInstance): EffectNode {
  const node = new CTORS[fx.type](ctx);
  node.update(fx);
  return node;
}
