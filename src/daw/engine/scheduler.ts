import { valueAt } from '../model/automation';
import { expandMidiNotes } from '../model/ops';
import { contentSegments, ContentSegment } from '../model/regionMath';
import { secondsPerTick, ticksPerBar, ticksPerBeat, ticksToSeconds } from '../model/time';
import { AudioRegion, MidiNote, MidiRegion, Project, Region } from '../model/types';
import { AssetManager, ProcessSpec } from './assets';
import { InstrumentBank } from './instruments';
import { MixGraph } from './mixGraph';

/**
 * Converts the project into scheduled Web Audio events for a tick window.
 * Works on any BaseAudioContext; all times passed to start()/stop()/param
 * automation come from the TimeMap, never from timers.
 */

export interface TimeMap {
  /** AudioContext time at which the given timeline tick sounds. */
  time(tick: number): number;
}

/** Time map for one continuous playback segment starting at (tick0 -> time0). */
export function segmentTimeMap(project: Project, tick0: number, time0: number): TimeMap {
  const base = ticksToSeconds(project.tempoMap, tick0);
  return { time: (tick) => time0 + (ticksToSeconds(project.tempoMap, tick) - base) };
}

interface ScheduledVoice {
  stop(at: number): void;
  end: number;
}

export interface SchedulerDiagnostics {
  scheduled: number;
  late: number;
  minLeadMs: number;
  missingAssets: number;
  fallbackStretch: number;
}

const DECLICK = 0.003;
const dbToGain = (db: number) => Math.pow(10, db / 20);

/** Playback parameters derived from an audio region and its asset. */
export function audioPlayback(project: Project, r: AudioRegion) {
  const asset = project.assets[r.assetId];
  const bpm = project.tempoMap[0].bpm;
  const rate = r.stretch !== 'off' && asset?.originalBpm ? bpm / asset.originalBpm : 1;
  let spec: ProcessSpec | null = null;
  if (r.stretch === 'resample') {
    spec = r.reversed ? { ratio: 1, semitones: 0, reversed: true } : null;
  } else {
    const ratio = r.stretch === 'sync' ? 1 / rate : 1;
    if (Math.abs(ratio - 1) > 1e-4 || r.pitchSemitones !== 0 || r.reversed) {
      spec = { ratio: Math.abs(ratio - 1) > 1e-4 ? ratio : 1, semitones: r.pitchSemitones, reversed: r.reversed };
    }
  }
  return { asset, rate, spec };
}

export class RegionScheduler {
  private voices = new Map<string, ScheduledVoice[]>();
  private metroDest: AudioNode | null;
  private clickHi: AudioBuffer;
  private clickLo: AudioBuffer;
  private expanded = new WeakMap<MidiRegion, MidiNote[]>();
  /** Regions skipped because audio/instrument was not ready; engine reschedules them. */
  readonly pending = new Set<string>();
  diag: SchedulerDiagnostics = { scheduled: 0, late: 0, minLeadMs: Infinity, missingAssets: 0, fallbackStretch: 0 };
  metronomeGain: GainNode | null = null;

  constructor(
    private ctx: BaseAudioContext,
    private graph: MixGraph,
    private assets: AssetManager,
    private instruments: InstrumentBank,
    private live: boolean,
  ) {
    if (live) {
      this.metronomeGain = ctx.createGain();
      this.metronomeGain.gain.value = 0.6;
      this.metronomeGain.connect(ctx.destination);
    }
    this.metroDest = this.metronomeGain;
    this.clickHi = makeClick(ctx, 1600);
    this.clickLo = makeClick(ctx, 1000);
  }

  private add(regionId: string, v: ScheduledVoice) {
    let list = this.voices.get(regionId);
    if (!list) this.voices.set(regionId, (list = []));
    list.push(v);
  }

  private noteLead(when: number) {
    this.diag.scheduled++;
    if (!this.live) return;
    const lead = (when - this.ctx.currentTime) * 1000;
    if (lead < 0) this.diag.late++;
    if (lead < this.diag.minLeadMs) this.diag.minLeadMs = lead;
  }

  /**
   * Schedule everything that *starts* in [from, to). With includeOngoing, content
   * already sounding at `from` is started mid-way (playback start, seek, edits).
   */
  scheduleWindow(project: Project, from: number, to: number, map: TimeMap, includeOngoing: boolean, only?: Set<string>) {
    const tracks = new Map(project.tracks.map((t) => [t.id, t]));
    for (const r of project.regions) {
      if (only && !only.has(r.id)) continue;
      if (r.muted) continue;
      if (r.start >= to || r.start + r.length <= from) continue;
      const track = tracks.get(r.trackId);
      if (!track) continue;
      const strip = this.graph.strip(track.id);
      if (!strip) continue;
      if (r.kind === 'audio') this.scheduleAudio(project, r, from, to, map, includeOngoing, strip.input);
      else this.scheduleMidi(r, track.instrument?.id ?? 'synth:lead', from, to, map, includeOngoing, strip.input);
    }
  }

  private scheduleAudio(project: Project, r: AudioRegion, from: number, to: number, map: TimeMap, ongoing: boolean, dest: AudioNode) {
    const { asset, rate, spec } = audioPlayback(project, r);
    if (!asset) return;
    const source = this.assets.peek(asset.id);
    if (!source) {
      this.pending.add(r.id);
      this.diag.missingAssets++;
      this.assets.load(asset).catch(() => undefined);
      return;
    }
    let buffer = source;
    let playbackRate = r.stretch === 'off' ? 1 : rate;
    let timeScale = 1; // buffer seconds per source second
    if (spec) {
      const processed = this.assets.getProcessed(asset.id, spec);
      if (processed) {
        buffer = processed;
        if (r.stretch === 'resample') {
          playbackRate = rate;
        } else {
          playbackRate = 1;
          timeScale = spec.ratio;
        }
      } else {
        this.pending.add(r.id);
        this.assets.requestProcessed(asset.id, spec).catch(() => undefined);
        if (spec.reversed) return; // no meaningful fallback for reversed audio
        this.diag.fallbackStretch++; // play tempo-correct via playbackRate until processing finishes
      }
    }
    const spt = secondsPerTick(project.tempoMap[0].bpm);
    const regionEnd = r.start + r.length;
    const g = dbToGain(r.gainDb);
    const fadeInEnd = r.start + r.fadeIn;
    const fadeOutStart = regionEnd - r.fadeOut;
    const gainAt = (tick: number) => {
      let v = g;
      if (r.fadeIn > 0 && tick < fadeInEnd) v *= Math.max(0, (tick - r.start) / r.fadeIn);
      if (r.fadeOut > 0 && tick > fadeOutStart) v *= Math.max(0, (regionEnd - tick) / r.fadeOut);
      return v;
    };

    for (const seg of this.segmentsStartingIn(r, from, to, ongoing)) {
      const when = map.time(seg.start);
      const end = map.time(seg.end);
      const srcSec = r.sourceOffsetSec + seg.contentStart * spt * rate;
      const bufOffset = srcSec * timeScale;
      if (bufOffset >= buffer.duration) continue;
      const startsHard = seg.start === r.start || seg.joined;
      const endsHard = seg.end === regionEnd;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = playbackRate;
      const amp = this.ctx.createGain();
      const gp = amp.gain;
      const g0 = gainAt(seg.start);
      if (startsHard) {
        gp.setValueAtTime(0, when);
        gp.linearRampToValueAtTime(Math.max(g0, 0), when + DECLICK);
      } else gp.setValueAtTime(g0, when);
      if (r.fadeIn > 0 && fadeInEnd > seg.start && fadeInEnd < seg.end) gp.linearRampToValueAtTime(g, map.time(fadeInEnd));
      if (r.fadeOut > 0 && fadeOutStart < seg.end) {
        if (fadeOutStart > seg.start) gp.setValueAtTime(g, map.time(fadeOutStart));
        gp.linearRampToValueAtTime(0, end);
      } else if (endsHard) {
        gp.setValueAtTime(gainAt(seg.end - 1), Math.max(when + DECLICK, end - DECLICK));
        gp.linearRampToValueAtTime(0, end);
      }
      // Loop content is often a few ms shorter than its musical length (encoder
      // rounding). Wrap the buffer instead of dropping to silence before the next iteration.
      const contentSec = (buffer.duration - bufOffset) / playbackRate;
      if (contentSec < end - when && end - when - contentSec < 0.01) {
        src.loop = true;
        src.loopStart = 0;
        src.loopEnd = buffer.duration;
      }
      src.connect(amp).connect(dest);
      src.start(when, bufOffset);
      src.stop(end + (endsHard ? 0.001 : 0));
      src.onended = () => amp.disconnect();
      this.noteLead(when);
      this.add(r.id, {
        end,
        stop: (at) => {
          if (at >= end) return;
          const t = Math.max(at, when);
          gp.cancelScheduledValues(t);
          gp.setValueAtTime(gp.value, t);
          gp.linearRampToValueAtTime(0, t + 0.008);
          try {
            src.stop(t + 0.01);
          } catch {
            /* stopped */
          }
        },
      });
    }
  }

  /**
   * Full (unclipped) segments that start in [from, to). With `ongoing`, also the
   * segment already sounding at `from`, started mid-way (flagged `joined`).
   */
  private segmentsStartingIn(r: Region, from: number, to: number, ongoing: boolean): (ContentSegment & { joined: boolean })[] {
    const out: (ContentSegment & { joined: boolean })[] = [];
    const regionEnd = r.start + r.length;
    for (const seg of contentSegments(r, from, to)) {
      const trueStart = seg.start === r.start || (r.loop && seg.contentStart === 0);
      if (!trueStart && !ongoing) continue;
      const end = Math.min(regionEnd, seg.start + Math.max(0, r.loopLength - seg.contentStart));
      out.push({ start: seg.start, end, contentStart: seg.contentStart, joined: !trueStart });
    }
    return out;
  }

  private scheduleMidi(r: MidiRegion, instId: string, from: number, to: number, map: TimeMap, ongoing: boolean, dest: AudioNode) {
    const inst = this.instruments.get(instId);
    if (!inst) {
      this.pending.add(r.id);
      this.instruments.load(instId).catch(() => undefined);
      return;
    }
    let notes = this.expanded.get(r);
    if (!notes) this.expanded.set(r, (notes = expandMidiNotes(r)));
    for (const n of notes) {
      const s = r.start + n.start;
      const e = s + n.length;
      let offset = 0;
      let at = s;
      if (s < from) {
        if (!ongoing || e <= from || inst.kind === 'drumkit') continue;
        at = from;
        offset = map.time(from) - map.time(s);
      } else if (s >= to) continue;
      const when = map.time(at);
      const off = map.time(e);
      const v = inst.noteOn(this.ctx, dest, n.pitch, n.velocity, when, offset);
      v.stop(off);
      this.noteLead(when);
      this.add(r.id, { end: off + inst.release + 0.1, stop: (t) => v.stop(Math.min(t, off)) });
    }
  }

  /** Clicks on every beat in [from, to). Negative ticks (count-in) are included. */
  scheduleMetronome(project: Project, from: number, to: number, map: TimeMap) {
    if (!this.metroDest) return;
    const sig = project.timeSigMap[0].sig;
    const beat = ticksPerBeat(sig);
    const bar = ticksPerBar(sig);
    let b = Math.ceil(from / beat) * beat;
    for (; b < to; b += beat) {
      const src = this.ctx.createBufferSource();
      src.buffer = (((b % bar) + bar) % bar === 0) ? this.clickHi : this.clickLo;
      src.connect(this.metroDest);
      const when = map.time(b);
      src.start(when);
      this.add('__metronome', { end: when + 0.06, stop: (t) => { try { src.stop(t); } catch { /* */ } } });
    }
  }

  /**
   * Automation for [from, to). anchor=true sets the exact value at `from`
   * (playback start, loop wrap, seek, or after an automation edit).
   * Curves are sampled every ~20 ms in the target's native domain so dB
   * volume curves are reproduced faithfully by linear AudioParam ramps.
   */
  scheduleAutomation(project: Project, from: number, to: number, map: TimeMap, anchor: boolean) {
    const step = Math.max(1, Math.round(0.02 / secondsPerTick(project.tempoMap[0].bpm)));
    for (const track of project.tracks) {
      const strip = this.graph.strip(track.id);
      if (!strip) continue;
      for (const lane of track.automation) {
        if (!lane.enabled || lane.points.length === 0) continue;
        const target = strip.automationTarget(lane.target);
        if (!target) continue;
        if (lane.target === 'volume') strip.automatedVolume = true;
        if (lane.target === 'pan') strip.automatedPan = true;
        const pts = lane.points;
        const p = target.param;
        if (anchor) {
          const t0 = map.time(from);
          p.cancelScheduledValues(t0);
          p.setValueAtTime(target.map(valueAt(pts, from, 0)), t0);
        }
        // Event ticks: sampling grid + exact point positions.
        const ticks = new Set<number>();
        for (let t = Math.ceil(from / step) * step; t < to; t += step) ticks.add(t);
        for (const pt of pts) if (pt.tick >= from && pt.tick < to) ticks.add(pt.tick);
        if (anchor) ticks.delete(from);
        const sorted = [...ticks].sort((a, b) => a - b);
        for (const t of sorted) {
          const time = map.time(t);
          const atPoint = pts.findIndex((pt) => pt.tick === t);
          if (atPoint > 0 && pts[atPoint - 1].curve === 'step') {
            p.setValueAtTime(target.map(pts[atPoint - 1].value), Math.max(0, time - 1e-4));
            p.setValueAtTime(target.map(pts[atPoint].value), time);
          } else {
            p.linearRampToValueAtTime(target.map(valueAt(pts, t, 0)), time);
          }
        }
      }
    }
  }

  stopRegion(regionId: string, at: number) {
    const list = this.voices.get(regionId);
    if (!list) return;
    for (const v of list) v.stop(at);
    this.voices.delete(regionId);
  }

  stopAll(at: number) {
    for (const list of this.voices.values()) for (const v of list) v.stop(at);
    this.voices.clear();
    this.pending.clear();
  }

  /** Forget voices that have finished (keeps memory flat during long sessions). */
  prune(now: number) {
    for (const [id, list] of this.voices) {
      const alive = list.filter((v) => v.end > now);
      if (alive.length) this.voices.set(id, alive);
      else this.voices.delete(id);
    }
  }

  activeVoiceCount() {
    let n = 0;
    for (const l of this.voices.values()) n += l.length;
    return n;
  }

  dispose() {
    this.stopAll(this.ctx.currentTime);
    this.metronomeGain?.disconnect();
  }
}

function makeClick(ctx: BaseAudioContext, freq: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.05);
  const b = ctx.createBuffer(1, len, sr);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.sin((2 * Math.PI * freq * i) / sr) * Math.exp(-i / (sr * 0.008)) * 0.8;
  return b;
}
