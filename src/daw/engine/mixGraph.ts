import { EffectInstance, Project, Track } from '../model/types';
import { AutomationTarget, createEffectNode, EffectNode } from './effects';

/**
 * Audio graph for a project on any BaseAudioContext.
 *   track: input -> [inserts] -> volume -> pan -> mute/solo -> master.input
 *                                                   \-> meter (live only)
 *   master: input -> [inserts, default limiter] -> volume -> meter -> destination
 *
 * sync(project) diffs by object identity and only touches what changed.
 */

const dbToGain = (db: number) => (db <= -60 ? 0 : Math.pow(10, db / 20));

class Chain {
  private nodes: { inst: EffectInstance; node: EffectNode }[] = [];
  constructor(
    private ctx: BaseAudioContext,
    readonly input: AudioNode,
    readonly output: AudioNode,
  ) {
    input.connect(output);
  }

  sync(effects: EffectInstance[]) {
    const sameStructure =
      effects.length === this.nodes.length && effects.every((e, i) => this.nodes[i].inst.id === e.id && this.nodes[i].inst.type === e.type);
    if (sameStructure) {
      effects.forEach((e, i) => {
        if (this.nodes[i].inst !== e) {
          this.nodes[i].node.update(e);
          this.nodes[i].inst = e;
        }
      });
      return;
    }
    // Rebuild the chain, reusing nodes whose id survives.
    const old = new Map(this.nodes.map((n) => [n.inst.id, n]));
    this.input.disconnect();
    for (const n of this.nodes) n.node.output.disconnect();
    const next = effects.map((e) => {
      const prev = old.get(e.id);
      old.delete(e.id);
      if (prev && prev.inst.type === e.type) {
        if (prev.inst !== e) prev.node.update(e);
        return { inst: e, node: prev.node };
      }
      return { inst: e, node: createEffectNode(this.ctx, e) };
    });
    for (const n of old.values()) n.node.dispose();
    let prev: AudioNode = this.input;
    for (const n of next) {
      prev.connect(n.node.input);
      prev = n.node.output;
    }
    prev.connect(this.output);
    this.nodes = next;
  }

  automation(effectId: string, key: string): AutomationTarget | null {
    return this.nodes.find((n) => n.inst.id === effectId)?.node.automation(key) ?? null;
  }

  dispose() {
    for (const n of this.nodes) n.node.dispose();
    this.input.disconnect();
  }
}

export class TrackStrip {
  readonly input: GainNode;
  readonly volume: GainNode;
  readonly pan: StereoPannerNode;
  readonly muteGain: GainNode;
  readonly meter: AnalyserNode | null;
  private chain: Chain;
  private chainOut: GainNode;
  track: Track;
  /** True when volume/pan are controlled by automation instead of the static value. */
  automatedVolume = false;
  automatedPan = false;

  constructor(
    private ctx: BaseAudioContext,
    track: Track,
    dest: AudioNode,
    withMeter: boolean,
  ) {
    this.track = track;
    this.input = ctx.createGain();
    this.chainOut = ctx.createGain();
    this.volume = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.muteGain = ctx.createGain();
    this.chain = new Chain(ctx, this.input, this.chainOut);
    this.chainOut.connect(this.volume).connect(this.pan).connect(this.muteGain).connect(dest);
    this.meter = withMeter ? ctx.createAnalyser() : null;
    if (this.meter) {
      this.meter.fftSize = 512;
      this.muteGain.connect(this.meter);
    }
    this.volume.gain.value = dbToGain(track.volumeDb);
    this.pan.pan.value = track.pan;
    this.chain.sync(track.effects);
  }

  sync(track: Track, audible: boolean) {
    const prev = this.track;
    this.track = track;
    const t = this.ctx.currentTime;
    if (!this.automatedVolume && prev.volumeDb !== track.volumeDb) this.volume.gain.setTargetAtTime(dbToGain(track.volumeDb), t, 0.01);
    if (!this.automatedPan && prev.pan !== track.pan) this.pan.pan.setTargetAtTime(track.pan, t, 0.01);
    if (prev.effects !== track.effects) this.chain.sync(track.effects);
    this.setAudible(audible);
  }

  private audible = true;
  setAudible(a: boolean, immediate = false) {
    if (a === this.audible && !immediate) return;
    this.audible = a;
    const g = this.muteGain.gain;
    if (immediate) {
      g.cancelScheduledValues(0);
      g.value = a ? 1 : 0;
    } else g.setTargetAtTime(a ? 1 : 0, this.ctx.currentTime, 0.008);
  }

  /** Resets volume/pan params to their static values (after automation playback stops). */
  resetStatic() {
    const t = this.ctx.currentTime;
    for (const [p, v] of [
      [this.volume.gain, dbToGain(this.track.volumeDb)],
      [this.pan.pan, this.track.pan],
    ] as const) {
      p.cancelScheduledValues(t);
      p.setTargetAtTime(v, t, 0.01);
    }
    this.automatedVolume = false;
    this.automatedPan = false;
  }

  automationTarget(target: string): AutomationTarget | null {
    if (target === 'volume') return { param: this.volume.gain, map: dbToGain };
    if (target === 'pan') return { param: this.pan.pan, map: (v) => v };
    const m = /^fx:([^:]+):(.+)$/.exec(target);
    return m ? this.chain.automation(m[1], m[2]) : null;
  }

  dispose() {
    this.chain.dispose();
    for (const n of [this.chainOut, this.volume, this.pan, this.muteGain, this.meter]) n?.disconnect();
  }
}

export class MixGraph {
  readonly masterIn: GainNode;
  readonly masterVolume: GainNode;
  readonly masterMeter: AnalyserNode | null;
  /** Taps the pre-limiter sum, used for "mix too loud" warnings. */
  readonly preLimiterMeter: AnalyserNode | null;
  private masterChain: Chain;
  private masterChainOut: GainNode;
  readonly strips = new Map<string, TrackStrip>();
  private project: Project | null = null;

  constructor(
    private ctx: BaseAudioContext,
    destination: AudioNode,
    private live: boolean,
  ) {
    this.masterIn = ctx.createGain();
    this.masterIn.gain.value = 0.8; // summing headroom
    this.masterChainOut = ctx.createGain();
    this.masterVolume = ctx.createGain();
    this.masterChain = new Chain(ctx, this.masterIn, this.masterChainOut);
    this.masterChainOut.connect(this.masterVolume).connect(destination);
    this.masterMeter = live ? ctx.createAnalyser() : null;
    this.preLimiterMeter = live ? ctx.createAnalyser() : null;
    if (this.masterMeter && this.preLimiterMeter) {
      this.masterMeter.fftSize = 1024;
      this.preLimiterMeter.fftSize = 1024;
      this.masterVolume.connect(this.masterMeter);
      this.masterIn.connect(this.preLimiterMeter);
    }
  }

  sync(project: Project) {
    const prev = this.project;
    this.project = project;
    const anySolo = project.tracks.some((t) => t.solo);
    const seen = new Set<string>();
    for (const t of project.tracks) {
      seen.add(t.id);
      const audible = !t.mute && (!anySolo || t.solo);
      const strip = this.strips.get(t.id);
      if (!strip) {
        const s = new TrackStrip(this.ctx, t, this.masterIn, this.live);
        s.setAudible(audible, true);
        this.strips.set(t.id, s);
      } else if (strip.track !== t || prev?.tracks !== project.tracks) {
        strip.sync(t, audible);
      }
    }
    for (const [id, s] of this.strips) {
      if (!seen.has(id)) {
        s.dispose();
        this.strips.delete(id);
      }
    }
    if (!prev || prev.master !== project.master) {
      this.masterChain.sync(project.master.effects);
      const g = dbToGain(project.master.volumeDb);
      if (this.ctx.currentTime === 0) this.masterVolume.gain.value = g;
      else this.masterVolume.gain.setTargetAtTime(g, this.ctx.currentTime, 0.01);
    }
  }

  strip(trackId: string): TrackStrip | undefined {
    return this.strips.get(trackId);
  }

  dispose() {
    for (const s of this.strips.values()) s.dispose();
    this.strips.clear();
    this.masterChain.dispose();
    for (const n of [this.masterChainOut, this.masterVolume, this.masterMeter, this.preLimiterMeter]) n?.disconnect();
  }
}
