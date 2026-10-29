import { GridDivision, PPQ, TempoPoint, TimeSigPoint, TimeSignature } from './types';

/**
 * Musical time <-> seconds mapping.
 *
 * Tempo map is piecewise-constant. All conversions are computed from the map
 * every time (no accumulated state), so repeated conversions never drift.
 */

export function ticksPerBeat(sig: TimeSignature): number {
  return (PPQ * 4) / sig.denominator;
}

export function ticksPerBar(sig: TimeSignature): number {
  return ticksPerBeat(sig) * sig.numerator;
}

export function secondsPerTick(bpm: number): number {
  return 60 / (bpm * PPQ);
}

/** Validates and returns a sorted copy; first entry forced to tick 0. */
export function normalizeTempoMap(map: TempoPoint[]): TempoPoint[] {
  const sorted = [...map].filter((p) => Number.isFinite(p.tick) && p.bpm > 0).sort((a, b) => a.tick - b.tick);
  if (sorted.length === 0) return [{ tick: 0, bpm: 120 }];
  if (sorted[0].tick !== 0) sorted.unshift({ tick: 0, bpm: sorted[0].bpm });
  return sorted;
}

export function tempoAt(map: TempoPoint[], tick: number): number {
  let bpm = map[0].bpm;
  for (const p of map) {
    if (p.tick <= tick) bpm = p.bpm;
    else break;
  }
  return bpm;
}

export function ticksToSeconds(map: TempoPoint[], tick: number): number {
  let sec = 0;
  for (let i = 0; i < map.length; i++) {
    const p = map[i];
    const next = map[i + 1];
    const segEnd = next ? Math.min(next.tick, tick) : tick;
    if (segEnd > p.tick) sec += (segEnd - p.tick) * secondsPerTick(p.bpm);
    if (!next || next.tick >= tick) break;
  }
  // Negative ticks (count-in / pre-roll) extrapolate with the first tempo.
  if (tick < 0) sec = tick * secondsPerTick(map[0].bpm);
  return sec;
}

export function secondsToTicks(map: TempoPoint[], sec: number): number {
  if (sec < 0) return sec / secondsPerTick(map[0].bpm);
  let acc = 0;
  for (let i = 0; i < map.length; i++) {
    const p = map[i];
    const next = map[i + 1];
    const spt = secondsPerTick(p.bpm);
    if (next) {
      const segSec = (next.tick - p.tick) * spt;
      if (acc + segSec > sec) return p.tick + (sec - acc) / spt;
      acc += segSec;
    } else {
      return p.tick + (sec - acc) / spt;
    }
  }
  return 0;
}

export function sigAt(map: TimeSigPoint[], tick: number): TimeSigPoint {
  let cur = map[0];
  for (const p of map) {
    if (p.tick <= tick) cur = p;
    else break;
  }
  return cur;
}

export interface BarBeat {
  bar: number; // 1-based
  beat: number; // 1-based
  sixteenth: number; // 1-based within the beat
  tick: number; // remaining ticks (0..ticksPer16th-1)
}

/** Bar number (0-based) and tick position of each signature change, in order. */
function barStarts(map: TimeSigPoint[]): { tick: number; bar: number; sig: TimeSignature }[] {
  const out: { tick: number; bar: number; sig: TimeSignature }[] = [];
  let bar = 0;
  for (let i = 0; i < map.length; i++) {
    const p = map[i];
    if (i > 0) {
      const prev = out[i - 1];
      bar = prev.bar + Math.round((p.tick - prev.tick) / ticksPerBar(prev.sig));
    }
    out.push({ tick: p.tick, bar, sig: p.sig });
  }
  return out;
}

export function tickToBarBeat(map: TimeSigPoint[], tick: number): BarBeat {
  const starts = barStarts(map);
  let seg = starts[0];
  for (const s of starts) if (s.tick <= tick) seg = s;
  const tpBar = ticksPerBar(seg.sig);
  const tpBeat = ticksPerBeat(seg.sig);
  const t16 = PPQ / 4;
  const rel = tick - seg.tick;
  const barIdx = Math.floor(rel / tpBar);
  const inBar = rel - barIdx * tpBar;
  const beatIdx = Math.floor(inBar / tpBeat);
  const inBeat = inBar - beatIdx * tpBeat;
  const sIdx = Math.floor(inBeat / t16);
  return {
    bar: seg.bar + barIdx + 1,
    beat: beatIdx + 1,
    sixteenth: sIdx + 1,
    tick: Math.floor(inBeat - sIdx * t16),
  };
}

/** Tick at the start of a 1-based bar number. */
export function barToTick(map: TimeSigPoint[], bar: number): number {
  const starts = barStarts(map);
  const target = bar - 1;
  let seg = starts[0];
  for (const s of starts) if (s.bar <= target) seg = s;
  return seg.tick + (target - seg.bar) * ticksPerBar(seg.sig);
}

export function formatBarBeat(bb: BarBeat): string {
  return `${bb.bar}.${bb.beat}.${bb.sixteenth}`;
}

export function formatSeconds(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(3).padStart(6, '0')}`;
}

export function gridTicks(div: GridDivision): number {
  const triplet = div.endsWith('T');
  const denom = parseInt(div.split('/')[1], 10);
  const base = (PPQ * 4) / denom;
  return triplet ? Math.round((base * 2) / 3) : base;
}

export function snapTick(tick: number, grid: number, mode: 'round' | 'floor' = 'round'): number {
  if (grid <= 0) return Math.round(tick);
  const q = tick / grid;
  return (mode === 'floor' ? Math.floor(q) : Math.round(q)) * grid;
}

export const GRID_DIVISIONS: GridDivision[] = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
