import { EFFECT_DEFS } from './effectDefs';
import { AutomationLane, AutomationPoint, Track } from './types';

export interface TargetInfo {
  label: string;
  min: number;
  max: number;
  default: number;
  unit?: string;
}

export function automationTargetInfo(track: Track, target: string): TargetInfo | null {
  if (target === 'volume') return { label: 'Volume', min: -60, max: 6, default: track.volumeDb, unit: 'dB' };
  if (target === 'pan') return { label: 'Pan', min: -1, max: 1, default: track.pan };
  const m = /^fx:([^:]+):(.+)$/.exec(target);
  if (!m) return null;
  const fx = track.effects.find((e) => e.id === m[1]);
  if (!fx) return null;
  const def = EFFECT_DEFS[fx.type].params.find((p) => p.key === m[2]);
  if (!def) return null;
  return {
    label: `${EFFECT_DEFS[fx.type].name} ${def.label}`,
    min: def.min,
    max: def.max,
    default: fx.params[def.key] ?? def.default,
    unit: def.unit,
  };
}

/** All targets that can be automated on a track. */
export function automatableTargets(track: Track): { target: string; label: string }[] {
  const out = [
    { target: 'volume', label: 'Volume' },
    { target: 'pan', label: 'Pan' },
  ];
  for (const fx of track.effects) {
    for (const p of EFFECT_DEFS[fx.type].params) {
      if (p.automatable) out.push({ target: `fx:${fx.id}:${p.key}`, label: `${EFFECT_DEFS[fx.type].name} ${p.label}` });
    }
  }
  return out;
}

export function sortPoints(points: AutomationPoint[]): AutomationPoint[] {
  return [...points].sort((a, b) => a.tick - b.tick);
}

/** Value of a lane at a tick. Before the first point: first value. After the last: last value. */
export function valueAt(points: AutomationPoint[], tick: number, fallback: number): number {
  if (points.length === 0) return fallback;
  if (tick <= points[0].tick) return points[0].value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (tick >= a.tick && tick < b.tick) {
      if (a.curve === 'step' || b.tick === a.tick) return a.value;
      const f = (tick - a.tick) / (b.tick - a.tick);
      return a.value + (b.value - a.value) * f;
    }
  }
  return points[points.length - 1].value;
}

export function activeLanes(track: Track): AutomationLane[] {
  return track.automation.filter((l) => l.enabled && l.points.length > 0);
}
