import { LibraryCatalog } from '../library/catalog';
import { secondsToTicks, ticksPerBar, ticksToSeconds } from '../model/time';
import { Project, Region } from '../model/types';
import { AssetManager } from './assets';
import { InstrumentBank } from './instruments';
import { MixGraph } from './mixGraph';
import { audioPlayback, RegionScheduler, segmentTimeMap, TimeMap } from './scheduler';

/**
 * Live playback engine. Owns the AudioContext and the transport.
 *
 * Timing model:
 *  - The authoritative clock is AudioContext.currentTime.
 *  - A worker ticker wakes the scheduler every 25 ms; each wake schedules all
 *    events up to currentTime + LOOKAHEAD with exact start times.
 *  - Playback is a list of anchors (tick -> context time). A new anchor is made
 *    at play/seek/tempo change and at each loop wrap; tick<->time inside an
 *    anchor is computed from the tempo map, so there is no accumulated drift.
 *  - The UI playhead is derived from the context time actually being heard
 *    (getOutputTimestamp / outputLatency), never from requestAnimationFrame.
 */

export const LOOKAHEAD = 0.2; // s
const TICK_MS = 25;
const START_DELAY = 0.06; // s between pressing play and the first scheduled sound

export type TransportState = 'stopped' | 'playing';
export type EngineStatus = 'ok' | 'suspended' | 'interrupted' | 'closed' | 'error';

interface Anchor {
  tick: number;
  time: number;
}

export interface EngineDiagnostics {
  sampleRate: number;
  baseLatencyMs: number;
  outputLatencyMs: number;
  lookaheadMs: number;
  wakeups: number;
  maxWakeGapMs: number;
  avgWakeGapMs: number;
  lateEvents: number;
  scheduledEvents: number;
  minLeadMs: number;
  activeVoices: number;
  fallbackStretch: number;
  missingAssets: number;
  playheadErrorMs: number;
  underruns: number | null;
  memory: { decodedMB: number; processedMB: number };
  contextState: string;
}

type Listener = () => void;

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly graph: MixGraph;
  readonly assets: AssetManager;
  readonly instruments: InstrumentBank;
  readonly scheduler: RegionScheduler;
  private project: Project;
  private clock: Worker;
  state: TransportState = 'stopped';
  status: EngineStatus = 'ok';
  /** Position while stopped (ticks). */
  private position = 0;
  private playStartTick = 0;
  private anchors: Anchor[] = [];
  private nextTick = 0;
  private nextTime = 0;
  private joinNext = true;
  private anchorAutomation = true;
  private countInUntil = -Infinity;
  private listeners = new Set<Listener>();
  private lastWake = 0;
  private wakeGaps = { n: 0, sum: 0, max: 0 };
  private lastPrune = 0;
  metronome = false;

  constructor(project: Project, catalog: LibraryCatalog | null) {
    const Ctor: typeof AudioContext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: 'playback' });
    this.project = project;
    this.graph = new MixGraph(this.ctx, this.ctx.destination, true);
    this.assets = new AssetManager(this.ctx, catalog);
    this.instruments = new InstrumentBank(this.ctx);
    this.scheduler = new RegionScheduler(this.ctx, this.graph, this.assets, this.instruments, true);
    this.graph.sync(project);
    this.clock = new Worker(new URL('./clock.worker.ts', import.meta.url), { type: 'module' });
    this.clock.onmessage = () => this.wake();
    this.ctx.onstatechange = () => this.onContextState();
    this.assets.subscribe((assetId) => this.onAssetEvent(assetId));
    this.preload(project);
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  // ---------------------------------------------------------------- context lifecycle

  /** Must be called from a user gesture (click / key) before audio can play. */
  async unlock(): Promise<void> {
    if (this.ctx.state === 'running') return;
    try {
      await this.ctx.resume();
    } catch (err) {
      this.status = 'error';
      this.emit();
      throw err;
    }
  }

  private onContextState() {
    const s = this.ctx.state as string;
    const prev = this.status;
    this.status = s === 'running' ? 'ok' : s === 'interrupted' ? 'interrupted' : s === 'closed' ? 'closed' : 'suspended';
    if (this.status !== 'ok' && this.state === 'playing') {
      // The clock stopped under us (tab suspended, device change, OS interruption).
      // Stop cleanly at the current musical position; the UI offers "resume".
      this.pause();
    }
    if (prev !== this.status) this.emit();
  }

  // ---------------------------------------------------------------- project

  setProject(next: Project) {
    const prev = this.project;
    if (next === prev) return;
    this.project = next;
    this.graph.sync(next);
    this.metronome = next.editor.metronome;
    this.preload(next);
    if (this.state !== 'playing') return;

    const timingChanged = prev.tempoMap !== next.tempoMap || prev.timeSigMap !== next.timeSigMap;
    const loopChanged = prev.loop !== next.loop;
    if (timingChanged || loopChanged) {
      this.restartAt(this.currentTick());
      return;
    }
    if (prev.regions !== next.regions || prev.assets !== next.assets) {
      const before = new Map(prev.regions.map((r) => [r.id, r]));
      const changed = new Set<string>();
      for (const r of next.regions) {
        const old = before.get(r.id);
        before.delete(r.id);
        if (old !== r) changed.add(r.id);
      }
      // Track-kind/track-move changes are covered: a moved region is a new object.
      const now = this.ctx.currentTime;
      for (const id of before.keys()) this.scheduler.stopRegion(id, now);
      for (const id of changed) this.scheduler.stopRegion(id, now);
      if (changed.size) this.rejoin(changed);
    }
    const automationChanged = prev.tracks !== next.tracks && next.tracks.some((t, i) => prev.tracks[i]?.automation !== t.automation);
    if (automationChanged) this.rejoinAutomation();
  }

  getProject() {
    return this.project;
  }

  /** Start loading audio/instruments used by the project (non-blocking). */
  private preload(p: Project) {
    const used = new Set<string>();
    for (const r of p.regions) if (r.kind === 'audio') used.add(r.assetId);
    this.assets.setPinned(used);
    for (const id of used) {
      const a = p.assets[id];
      if (a && this.assets.status(id) === 'idle') this.assets.load(a).catch(() => undefined);
    }
    for (const t of p.tracks) if (t.kind === 'instrument' && t.instrument) this.instruments.load(t.instrument.id).catch(() => undefined);
    // Start stretch processing for regions that need it.
    for (const r of p.regions) {
      if (r.kind !== 'audio') continue;
      const { asset, spec } = audioPlayback(p, r);
      if (asset && spec && this.assets.peek(asset.id)) this.assets.requestProcessed(asset.id, spec).catch(() => undefined);
    }
  }

  /** Resolves when everything needed to play [from, to) is ready (or failed). */
  async prepare(p: Project, timeoutMs = 15000): Promise<string[]> {
    const problems: string[] = [];
    const jobs: Promise<unknown>[] = [];
    for (const id of new Set(p.regions.filter((r) => r.kind === 'audio').map((r) => (r as { assetId: string }).assetId))) {
      const a = p.assets[id];
      if (a) jobs.push(this.assets.load(a).catch((e: Error) => problems.push(e.message)));
    }
    for (const t of p.tracks) if (t.kind === 'instrument' && t.instrument) jobs.push(this.instruments.load(t.instrument.id).catch(() => undefined));
    await withTimeout(Promise.all(jobs), timeoutMs);
    const stretchJobs: Promise<unknown>[] = [];
    for (const r of p.regions) {
      if (r.kind !== 'audio') continue;
      const { asset, spec } = audioPlayback(p, r);
      if (asset && spec && this.assets.peek(asset.id)) stretchJobs.push(this.assets.requestProcessed(asset.id, spec).catch(() => undefined));
    }
    await withTimeout(Promise.all(stretchJobs), timeoutMs);
    return [...new Set(problems)];
  }

  private onAssetEvent(_assetId: string) {
    if (this.state === 'playing' && this.scheduler.pending.size) {
      const ids = new Set(this.scheduler.pending);
      // Only rejoin regions whose audio is now ready (or still awaiting processing -> fallback).
      const ready = new Set<string>();
      for (const r of this.project.regions) {
        if (!ids.has(r.id)) continue;
        if (r.kind === 'audio') {
          const { asset, spec } = audioPlayback(this.project, r);
          if (!asset || !this.assets.peek(asset.id)) continue;
          if (spec && !this.assets.getProcessed(asset.id, spec) && spec.reversed) continue;
        } else continue;
        ready.add(r.id);
      }
      if (ready.size) {
        for (const id of ready) {
          this.scheduler.pending.delete(id);
          this.scheduler.stopRegion(id, this.ctx.currentTime);
        }
        this.rejoin(ready);
      }
    }
    this.emit();
  }

  // ---------------------------------------------------------------- transport

  play(from?: number, opts: { countInBars?: number } = {}) {
    if (this.ctx.state !== 'running') {
      // resume() is allowed here because play() is always called from a user gesture
      void this.ctx.resume();
    }
    const start = Math.max(0, from ?? this.position);
    this.playStartTick = start;
    const countIn = (opts.countInBars ?? 0) * ticksPerBar(this.project.timeSigMap[0].sig);
    this.countInUntil = countIn > 0 ? start : -Infinity;
    this.state = 'playing';
    this.scheduler.diag = { scheduled: 0, late: 0, minLeadMs: Infinity, missingAssets: 0, fallbackStretch: 0 };
    this.wakeGaps = { n: 0, sum: 0, max: 0 };
    this.lastWake = 0;
    this.anchorAt(start - countIn, this.ctx.currentTime + START_DELAY);
    this.clock.postMessage({ cmd: 'start', intervalMs: TICK_MS });
    this.wake();
    this.emit();
  }

  private anchorAt(tick: number, time: number) {
    this.anchors = [{ tick, time }];
    this.nextTick = tick;
    this.nextTime = time;
    this.joinNext = true;
    this.anchorAutomation = true;
  }

  private restartAt(tick: number) {
    const now = this.ctx.currentTime;
    this.scheduler.stopAll(now);
    for (const s of this.graph.strips.values()) s.resetStatic();
    this.anchorAt(tick, now + 0.03);
    this.wake();
  }

  /** Stop and remember the current position. */
  pause() {
    if (this.state !== 'playing') return;
    const pos = this.currentTick();
    this.halt();
    this.position = Math.max(0, pos);
  }

  /** Stop and return to where playback started. */
  stop() {
    if (this.state === 'playing') this.halt();
    this.position = this.playStartTick;
    this.emit();
  }

  private halt() {
    this.clock.postMessage({ cmd: 'stop' });
    this.scheduler.stopAll(this.ctx.currentTime);
    for (const s of this.graph.strips.values()) s.resetStatic();
    this.state = 'stopped';
    this.countInUntil = -Infinity;
    this.emit();
  }

  seek(tick: number) {
    const t = Math.max(0, Math.round(tick));
    if (this.state === 'playing') {
      this.playStartTick = t;
      this.restartAt(t);
    } else {
      this.position = t;
      this.playStartTick = t;
    }
    this.emit();
  }

  isCountingIn(): boolean {
    return this.state === 'playing' && this.currentTick() < this.countInUntil;
  }

  private currentMap(): TimeMap {
    const a = this.anchors[this.anchors.length - 1];
    return segmentTimeMap(this.project, a.tick, a.time);
  }

  private wake() {
    if (this.state !== 'playing') return;
    const nowPerf = performance.now();
    if (this.lastWake) {
      const gap = nowPerf - this.lastWake;
      this.wakeGaps.n++;
      this.wakeGaps.sum += gap;
      this.wakeGaps.max = Math.max(this.wakeGaps.max, gap);
    }
    this.lastWake = nowPerf;
    const p = this.project;
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    let guard = 0;
    while (this.nextTime < horizon && guard++ < 64) {
      const a = this.anchors[this.anchors.length - 1];
      const map = this.currentMap();
      const base = ticksToSeconds(p.tempoMap, a.tick);
      const horizonTick = Math.ceil(secondsToTicks(p.tempoMap, base + (horizon - a.time)));
      const loop = p.loop;
      const wraps = loop.enabled && loop.end > loop.start && this.nextTick < loop.end && horizonTick >= loop.end;
      const endTick = wraps ? loop.end : Math.max(horizonTick, this.nextTick + 1);
      const from = this.nextTick;
      const winFrom = Math.max(0, from); // negative ticks = count-in: clicks only
      if (endTick > winFrom) {
        this.scheduler.scheduleWindow(p, winFrom, endTick, map, this.joinNext);
        this.scheduler.scheduleAutomation(p, winFrom, endTick, map, this.anchorAutomation);
        this.joinNext = false;
        this.anchorAutomation = false;
      }
      if (this.metronome || from < this.countInUntil) {
        const metroEnd = this.metronome ? endTick : Math.min(endTick, this.countInUntil);
        this.scheduler.scheduleMetronome(p, from, metroEnd, map);
      }
      if (wraps) {
        const wrapTime = map.time(loop.end);
        this.anchors.push({ tick: loop.start, time: wrapTime });
        if (this.anchors.length > 8) this.anchors.splice(0, this.anchors.length - 8);
        this.nextTick = loop.start;
        this.nextTime = wrapTime;
        this.joinNext = true;
        this.anchorAutomation = true;
      } else {
        this.nextTick = endTick;
        this.nextTime = map.time(endTick);
      }
    }
    if (nowPerf - this.lastPrune > 1000) {
      this.lastPrune = nowPerf;
      this.scheduler.prune(this.ctx.currentTime);
    }
  }

  /** Re-schedule specific regions from "now" up to what has already been scheduled. */
  private rejoin(ids: Set<string>) {
    const a = this.anchors[this.anchors.length - 1];
    const joinTime = this.ctx.currentTime + 0.02;
    if (a.time > joinTime) {
      // A loop wrap is already scheduled ahead of us; simplest correct action is a re-anchor.
      this.restartAt(this.currentTick());
      return;
    }
    const map = this.currentMap();
    const joinTick = Math.max(0, Math.round(secondsToTicks(this.project.tempoMap, ticksToSeconds(this.project.tempoMap, a.tick) + (joinTime - a.time))));
    if (joinTick < this.nextTick) this.scheduler.scheduleWindow(this.project, joinTick, this.nextTick, map, true, ids);
  }

  private rejoinAutomation() {
    const a = this.anchors[this.anchors.length - 1];
    const joinTime = this.ctx.currentTime + 0.02;
    if (a.time > joinTime) return; // the pending wrap re-anchors automation anyway
    const map = this.currentMap();
    const joinTick = Math.max(0, Math.round(secondsToTicks(this.project.tempoMap, ticksToSeconds(this.project.tempoMap, a.tick) + (joinTime - a.time))));
    for (const s of this.graph.strips.values()) s.resetStatic();
    if (joinTick < this.nextTick) this.scheduler.scheduleAutomation(this.project, joinTick, this.nextTick, map, true);
  }

  // ---------------------------------------------------------------- position

  /** Context time currently audible at the speakers. */
  audibleTime(): number {
    const ctx = this.ctx;
    if (typeof ctx.getOutputTimestamp === 'function') {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime !== undefined && ts.performanceTime !== undefined && ts.performanceTime > 0) {
        return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
      }
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  /** Tick at a given context time (may be negative during count-in). */
  tickAtTime(t: number): number {
    if (this.state !== 'playing' || !this.anchors.length) return this.position;
    let a = this.anchors[0];
    for (const x of this.anchors) if (x.time <= t) a = x;
    if (t < a.time) return a.tick;
    const map = this.project.tempoMap;
    return secondsToTicks(map, ticksToSeconds(map, a.tick) + (t - a.time));
  }

  /** Playhead tick as heard (latency-compensated). */
  currentTick(): number {
    return this.state === 'playing' ? this.tickAtTime(this.audibleTime()) : this.position;
  }

  /** Context time at which a timeline tick will be (or was) scheduled in the current anchor. */
  timeAtTick(tick: number): number {
    return this.currentMap().time(tick);
  }

  // ---------------------------------------------------------------- live notes / meters

  /**
   * Play a note now on a track's instrument (piano-roll audition, computer
   * keyboard, Web MIDI input). Returns a release function.
   */
  liveNoteOn(trackId: string, pitch: number, velocity = 100): () => void {
    void this.ctx.resume();
    const track = this.project.tracks.find((t) => t.id === trackId);
    const instId = track?.instrument?.id ?? 'synth:lead';
    const inst = this.instruments.get(instId);
    if (!inst) {
      this.instruments.load(instId).catch(() => undefined);
      return () => undefined;
    }
    const dest = this.graph.strip(trackId)?.input ?? this.graph.masterIn;
    const t = this.ctx.currentTime + 0.005;
    const v = inst.noteOn(this.ctx, dest, pitch, velocity, t);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      v.stop(this.ctx.currentTime);
    };
  }

  auditionNote(trackId: string, pitch: number, velocity = 100, seconds = 0.35) {
    const off = this.liveNoteOn(trackId, pitch, velocity);
    setTimeout(off, seconds * 1000); // UI audition only; not part of musical playback
  }

  meterLevel(an: AnalyserNode | null | undefined, buf: Float32Array<ArrayBuffer>): number {
    if (!an) return 0;
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > peak) peak = v;
    }
    return peak;
  }

  diagnostics(): EngineDiagnostics {
    const d = this.scheduler.diag;
    const ctx = this.ctx as AudioContext & { playbackStats?: { underrunEvents?: number } };
    const mem = this.assets.memoryUsage();
    // Playhead error: difference between latency-compensated and raw clock estimates.
    const raw = this.ctx.currentTime - (this.ctx.outputLatency || 0);
    return {
      sampleRate: this.ctx.sampleRate,
      baseLatencyMs: (this.ctx.baseLatency || 0) * 1000,
      outputLatencyMs: (this.ctx.outputLatency || 0) * 1000,
      lookaheadMs: LOOKAHEAD * 1000,
      wakeups: this.wakeGaps.n,
      maxWakeGapMs: this.wakeGaps.max,
      avgWakeGapMs: this.wakeGaps.n ? this.wakeGaps.sum / this.wakeGaps.n : 0,
      lateEvents: d.late,
      scheduledEvents: d.scheduled,
      minLeadMs: Number.isFinite(d.minLeadMs) ? d.minLeadMs : 0,
      activeVoices: this.scheduler.activeVoiceCount(),
      fallbackStretch: d.fallbackStretch,
      missingAssets: d.missingAssets,
      playheadErrorMs: Math.abs(this.audibleTime() - raw) * 1000,
      underruns: ctx.playbackStats?.underrunEvents ?? null,
      memory: { decodedMB: mem.decoded / 1048576, processedMB: mem.processed / 1048576 },
      contextState: this.ctx.state,
    };
  }

  regionsAt(tick: number): Region[] {
    return this.project.regions.filter((r) => r.start <= tick && tick < r.start + r.length);
  }

  async dispose() {
    this.halt();
    this.clock.terminate();
    this.scheduler.dispose();
    this.graph.dispose();
    this.assets.dispose();
    await this.ctx.close().catch(() => undefined);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);
}
