import { EFFECT_DEFS } from './effectDefs';
import { createProject, DEFAULT_EDITOR, newId, TRACK_COLORS } from './factory';
import { GRID_DIVISIONS, normalizeTempoMap } from './time';
import {
  AudioAssetInfo,
  AudioRegion,
  AutomationLane,
  EffectInstance,
  EffectType,
  MidiNote,
  MidiRegion,
  PPQ,
  Project,
  PROJECT_SCHEMA_VERSION,
  Region,
  Track,
} from './types';

/**
 * Untrusted project input -> valid Project.
 * Never evaluates anything; every field is type-checked, clamped and sanitized.
 * Unknown fields are dropped. Throws ProjectFormatError when the file is unusable.
 */

export class ProjectFormatError extends Error {
  override name = 'ProjectFormatError';
}

export interface ValidationResult {
  project: Project;
  warnings: string[];
}

const MAX_TRACKS = 128;
const MAX_REGIONS = 5000;
const MAX_NOTES_PER_REGION = 20000;
const MAX_POINTS = 5000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export function sanitizeText(v: unknown, fallback: string, max = 80): string {
  if (typeof v !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
  return s || fallback;
}

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function int(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.round(num(v, fallback, min, max));
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

const ID_RE = /^[A-Za-z0-9_.:@-]{1,96}$/;
function id(v: unknown, prefix: string, seen: Set<string>): string {
  let s = typeof v === 'string' && ID_RE.test(v) ? v : newId(prefix);
  while (seen.has(s)) s = newId(prefix);
  seen.add(s);
  return s;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const color = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR_RE.test(v) ? v : fallback);

function effect(v: unknown, seen: Set<string>, warnings: string[]): EffectInstance | null {
  if (!isObj(v)) return null;
  const type = v.type as EffectType;
  const def = EFFECT_DEFS[type];
  if (!def) {
    warnings.push(`Removed an unknown effect type "${String(v.type).slice(0, 20)}".`);
    return null;
  }
  const params: Record<string, number> = {};
  const raw = isObj(v.params) ? v.params : {};
  for (const p of def.params) params[p.key] = num(raw[p.key], p.default, p.min, p.max);
  return { id: id(v.id, 'fx', seen), type, bypass: bool(v.bypass, false), params };
}

function lane(v: unknown, seen: Set<string>): AutomationLane | null {
  if (!isObj(v) || typeof v.target !== 'string') return null;
  if (!/^(volume|pan|fx:[A-Za-z0-9_.-]+:[A-Za-z]+)$/.test(v.target)) return null;
  const pts = Array.isArray(v.points) ? v.points.slice(0, MAX_POINTS) : [];
  return {
    id: id(v.id, 'aut', seen),
    target: v.target,
    enabled: bool(v.enabled, true),
    visible: bool(v.visible, false),
    points: pts
      .filter(isObj)
      .map((p) => ({
        id: id(p.id, 'pt', seen),
        tick: int(p.tick, 0, 0),
        value: num(p.value, 0, -1e6, 1e6),
        curve: p.curve === 'step' ? ('step' as const) : ('linear' as const),
      }))
      .sort((a, b) => a.tick - b.tick),
  };
}

function track(v: unknown, i: number, seen: Set<string>, warnings: string[]): Track | null {
  if (!isObj(v)) return null;
  const kind = v.kind === 'instrument' ? 'instrument' : v.kind === 'audio' ? 'audio' : null;
  if (!kind) return null;
  const effects = (Array.isArray(v.effects) ? v.effects : []).slice(0, 16).map((e) => effect(e, seen, warnings)).filter(Boolean) as EffectInstance[];
  const t: Track = {
    id: id(v.id, 'trk', seen),
    kind,
    name: sanitizeText(v.name, `Track ${i + 1}`, 40),
    color: color(v.color, TRACK_COLORS[i % TRACK_COLORS.length]),
    volumeDb: num(v.volumeDb, 0, -60, 6),
    pan: num(v.pan, 0, -1, 1),
    mute: bool(v.mute, false),
    solo: bool(v.solo, false),
    arm: bool(v.arm, false),
    monitor: false, // never restore input monitoring automatically (feedback risk)
    hidden: bool(v.hidden, false),
    height: int(v.height, DEFAULT_EDITOR.trackHeight, 40, 240),
    effects,
    automation: [],
  };
  if (kind === 'instrument') {
    const inst = isObj(v.instrument) && typeof v.instrument.id === 'string' ? v.instrument.id : 'piano';
    t.instrument = { id: /^[A-Za-z0-9_:-]{1,48}$/.test(inst) ? inst : 'piano' };
  }
  t.automation = (Array.isArray(v.automation) ? v.automation : [])
    .slice(0, 32)
    .map((l) => lane(l, seen))
    .filter((l): l is AutomationLane => !!l && (!l.target.startsWith('fx:') || effects.some((e) => l.target.startsWith(`fx:${e.id}:`))));
  return t;
}

function region(v: unknown, trackIds: Set<string>, assets: Record<string, AudioAssetInfo>, seen: Set<string>): Region | null {
  if (!isObj(v) || typeof v.trackId !== 'string' || !trackIds.has(v.trackId)) return null;
  const base = {
    id: id(v.id, 'rgn', seen),
    trackId: v.trackId,
    name: sanitizeText(v.name, 'Region', 60),
    color: typeof v.color === 'string' && COLOR_RE.test(v.color) ? v.color : undefined,
    start: int(v.start, 0, 0, PPQ * 4 * 2000),
    length: int(v.length, PPQ, 1, PPQ * 4 * 2000),
    contentOffset: int(v.contentOffset, 0, 0, PPQ * 4 * 2000),
    muted: bool(v.muted, false),
  };
  if (v.kind === 'audio') {
    if (typeof v.assetId !== 'string' || !assets[v.assetId]) return null;
    const r: AudioRegion = {
      ...base,
      kind: 'audio',
      assetId: v.assetId,
      sourceOffsetSec: num(v.sourceOffsetSec, 0, 0, 3600),
      loopLength: int(v.loopLength, base.length, 1, PPQ * 4 * 2000),
      loop: bool(v.loop, false),
      gainDb: num(v.gainDb, 0, -48, 12),
      fadeIn: int(v.fadeIn, 0, 0, base.length),
      fadeOut: int(v.fadeOut, 0, 0, base.length),
      stretch: v.stretch === 'sync' || v.stretch === 'resample' ? v.stretch : 'off',
      pitchSemitones: int(v.pitchSemitones, 0, -12, 12),
      reversed: bool(v.reversed, false),
    };
    return r;
  }
  if (v.kind === 'midi') {
    const notes = (Array.isArray(v.notes) ? v.notes : [])
      .slice(0, MAX_NOTES_PER_REGION)
      .filter(isObj)
      .map(
        (n): MidiNote => ({
          id: id(n.id, 'n', seen),
          pitch: int(n.pitch, 60, 0, 127),
          start: int(n.start, 0, 0),
          length: int(n.length, PPQ / 4, 1),
          velocity: int(n.velocity, 100, 1, 127),
        }),
      );
    const r: MidiRegion = {
      ...base,
      kind: 'midi',
      notes,
      loopLength: int(v.loopLength, base.length, 1),
      loop: bool(v.loop, false),
    };
    return r;
  }
  return null;
}

function asset(key: string, v: unknown): AudioAssetInfo | null {
  if (!isObj(v) || !ID_RE.test(key) || !isObj(v.ref)) return null;
  const ref = v.ref;
  let r: AudioAssetInfo['ref'];
  if (ref.kind === 'library' && typeof ref.assetId === 'string' && ID_RE.test(ref.assetId)) {
    r = { kind: 'library', assetId: ref.assetId, version: int(ref.version, 1, 1) };
  } else if (ref.kind === 'user' && typeof ref.assetId === 'string' && ID_RE.test(ref.assetId)) {
    r = { kind: 'user', assetId: ref.assetId };
  } else return null;
  return {
    id: key,
    ref: r,
    name: sanitizeText(v.name, 'Audio', 80),
    durationSec: num(v.durationSec, 0, 0, 3600),
    sampleRate: int(v.sampleRate, 44100, 8000, 192000),
    channels: int(v.channels, 2, 1, 2),
    originalBpm: v.originalBpm === undefined ? undefined : num(v.originalBpm, 120, 20, 300),
    bars: v.bars === undefined ? undefined : num(v.bars, 1, 0, 1000),
    key: typeof v.key === 'string' ? sanitizeText(v.key, '', 8) || undefined : undefined,
    license: typeof v.license === 'string' ? sanitizeText(v.license, '', 40) : undefined,
    attribution: typeof v.attribution === 'string' ? sanitizeText(v.attribution, '', 300) : undefined,
  };
}

export function validateProject(input: unknown): ValidationResult {
  const warnings: string[] = [];
  if (!isObj(input)) throw new ProjectFormatError('This file is not a DAW project.');
  let raw: Obj = input;

  if (raw.schemaVersion === undefined && Array.isArray(raw.tracks) && typeof raw.bpm === 'number') {
    raw = migrateLegacy(raw, warnings);
  }
  const version = num(raw.schemaVersion, NaN);
  if (!Number.isFinite(version)) throw new ProjectFormatError('This file is not a DAW project (missing schema version).');
  if (version > PROJECT_SCHEMA_VERSION) {
    throw new ProjectFormatError(
      `This project was made with a newer version of the studio (format ${version}). Please update the page and try again.`,
    );
  }
  raw = migrate(raw, version);

  const seen = new Set<string>();
  const base = createProject();
  const assets: Record<string, AudioAssetInfo> = {};
  if (isObj(raw.assets)) {
    for (const [k, v] of Object.entries(raw.assets).slice(0, 2000)) {
      const a = asset(k, v);
      if (a) assets[k] = a;
      else warnings.push('Removed an invalid audio reference.');
    }
  }
  const rawTracks = Array.isArray(raw.tracks) ? raw.tracks.slice(0, MAX_TRACKS) : [];
  const tracks = rawTracks.map((t, i) => track(t, i, seen, warnings)).filter((t): t is Track => !!t);
  const trackIds = new Set(tracks.map((t) => t.id));
  const rawRegions = Array.isArray(raw.regions) ? raw.regions.slice(0, MAX_REGIONS) : [];
  const regions: Region[] = [];
  for (const r of rawRegions) {
    const out = region(r, trackIds, assets, seen);
    if (out) regions.push(out);
    else warnings.push('Removed a clip that referenced a missing track or audio file.');
  }

  const tempoMap = normalizeTempoMap(
    (Array.isArray(raw.tempoMap) ? raw.tempoMap : [])
      .filter(isObj)
      .slice(0, 256)
      .map((p) => ({ tick: int(p.tick, 0, 0), bpm: num(p.bpm, 120, 20, 300) })),
  );
  const sigs = (Array.isArray(raw.timeSigMap) ? raw.timeSigMap : [])
    .filter(isObj)
    .slice(0, 64)
    .map((p) => {
      const sig = isObj(p.sig) ? p.sig : {};
      const den = [2, 4, 8, 16].includes(Number(sig.denominator)) ? Number(sig.denominator) : 4;
      return { tick: int(p.tick, 0, 0), sig: { numerator: int(sig.numerator, 4, 1, 16), denominator: den } };
    })
    .sort((a, b) => a.tick - b.tick);
  if (sigs.length === 0 || sigs[0].tick !== 0) sigs.unshift({ tick: 0, sig: { numerator: 4, denominator: 4 } });

  const ed = isObj(raw.editor) ? raw.editor : {};
  const loop = isObj(raw.loop) ? raw.loop : {};
  const master = isObj(raw.master) ? raw.master : {};
  const loopStart = int(loop.start, 0, 0);
  const project: Project = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: id(raw.id, 'proj', seen),
    title: sanitizeText(raw.title, 'Untitled Song', 60),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt.slice(0, 40) : base.createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt.slice(0, 40) : base.updatedAt,
    tempoMap,
    timeSigMap: sigs,
    tracks,
    regions,
    assets,
    master: {
      volumeDb: num(master.volumeDb, 0, -60, 6),
      effects: Array.isArray(master.effects)
        ? (master.effects.slice(0, 16).map((e) => effect(e, seen, warnings)).filter(Boolean) as EffectInstance[])
        : base.master.effects,
    },
    markers: (Array.isArray(raw.markers) ? raw.markers : [])
      .filter(isObj)
      .slice(0, 500)
      .map((m) => ({ id: id(m.id, 'mk', seen), tick: int(m.tick, 0, 0), name: sanitizeText(m.name, 'Marker', 30), color: color(m.color, '#FBBF24') })),
    loop: {
      enabled: bool(loop.enabled, false),
      start: loopStart,
      end: Math.max(loopStart + PPQ, int(loop.end, PPQ * 16, 0)),
    },
    editor: {
      snap: bool(ed.snap, DEFAULT_EDITOR.snap),
      grid: GRID_DIVISIONS.includes(ed.grid as never) ? (ed.grid as Project['editor']['grid']) : DEFAULT_EDITOR.grid,
      pxPerBeat: num(ed.pxPerBeat, DEFAULT_EDITOR.pxPerBeat, 4, 400),
      trackHeight: int(ed.trackHeight, DEFAULT_EDITOR.trackHeight, 40, 240),
      metronome: bool(ed.metronome, false),
      countInBars: int(ed.countInBars, 1, 0, 2),
      followPlayhead: bool(ed.followPlayhead, true),
    },
  };
  return { project, warnings: dedupe(warnings) };
}

function dedupe(w: string[]): string[] {
  const counts = new Map<string, number>();
  for (const s of w) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts].map(([s, n]) => (n > 1 ? `${s} (×${n})` : s));
}

/** Future schema migrations: chain vN -> vN+1 here. */
function migrate(raw: Obj, version: number): Obj {
  if (version < 1) throw new ProjectFormatError('Unsupported project version.');
  // When schema v2 exists: if (version === 1) raw = migrate1to2(raw);
  return raw;
}

/** Legacy Staff Composer DAW projects (DawProject: bpm, tracks[].clips with startBeat). */
export const LEGACY_PACK_ID = 'legacy-staff-composer';

function migrateLegacy(raw: Obj, warnings: string[]): Obj {
  const bpm = num(raw.bpm, 110, 20, 300);
  const ts = Array.isArray(raw.timeSignature) ? raw.timeSignature : [4, 4];
  const tracks: Obj[] = [];
  const regions: Obj[] = [];
  const assets: Record<string, Obj> = {};
  const rawTracks = Array.isArray(raw.tracks) ? raw.tracks : [];
  let droppedAudio = 0;
  rawTracks.filter(isObj).forEach((t) => {
    const fx = isObj(t.fx) ? t.fx : {};
    const isInstrument = t.type === 'instrument';
    const effects: Obj[] = [];
    if (num(fx.eqLow, 0) || num(fx.eqMid, 0) || num(fx.eqHigh, 0)) {
      effects.push({ type: 'eq3', params: { low: num(fx.eqLow, 0), mid: num(fx.eqMid, 0), high: num(fx.eqHigh, 0) } });
    }
    if (num(fx.distortion, 0) > 0) effects.push({ type: 'distortion', params: { drive: num(fx.distortion, 0) } });
    if (num(fx.delayWet, 0) > 0) effects.push({ type: 'delay', params: { mix: num(fx.delayWet, 0), time: num(fx.delayTime, 0.32) } });
    if (num(fx.reverbWet, 0) > 0) effects.push({ type: 'reverb', params: { mix: num(fx.reverbWet, 0) } });
    const vol = num(fx.volume, 1, 0, 2);
    tracks.push({
      id: t.id,
      kind: isInstrument ? 'instrument' : 'audio',
      name: t.name,
      color: t.color,
      volumeDb: vol > 0 ? 20 * Math.log10(vol) : -60,
      pan: fx.pan,
      mute: t.muted,
      solo: t.solo,
      instrument: isInstrument ? { id: typeof t.instrumentId === 'string' ? t.instrumentId : 'piano' } : undefined,
      effects,
    });
    for (const c of (Array.isArray(t.clips) ? t.clips : []).filter(isObj)) {
      const start = Math.round(num(c.startBeat, 0, 0) * PPQ);
      const length = Math.max(1, Math.round(num(c.durationBeats, 4, 0) * PPQ));
      if (c.type === 'midi') {
        regions.push({
          id: c.id,
          trackId: t.id,
          kind: 'midi',
          name: c.name,
          start,
          length,
          loopLength: length,
          notes: (Array.isArray(c.midiNotes) ? c.midiNotes : []).filter(isObj).map((n) => ({
            pitch: n.midi,
            start: Math.round(num(n.startBeat, 0) * PPQ),
            length: Math.max(1, Math.round(num(n.durationBeats, 0.25) * PPQ)),
            velocity: Math.round(num(n.velocity, 0.8, 0, 1) * 127),
          })),
        });
      } else {
        const loopId = typeof c.loopId === 'string' ? c.loopId : null;
        if (!loopId) {
          droppedAudio++; // recordings were held only in memory by the old DAW
          continue;
        }
        const assetKey = `lib:${LEGACY_PACK_ID}.${loopId}`;
        assets[assetKey] = {
          ref: { kind: 'library', assetId: `${LEGACY_PACK_ID}.${loopId}`, version: 1 },
          name: c.name,
          originalBpm: c.originalBpm,
        };
        const trimBeats = num(c.trimStartBeat, 0, 0);
        const origBpm = num(c.originalBpm, bpm, 20, 300);
        regions.push({
          id: c.id,
          trackId: t.id,
          kind: 'audio',
          name: c.name,
          start,
          length,
          assetId: assetKey,
          sourceOffsetSec: (trimBeats * 60) / origBpm,
          loop: c.isLooping !== false,
          loopLength: length,
          gainDb: num(c.gain, 1, 0.0001) > 0 ? 20 * Math.log10(num(c.gain, 1, 0.0001, 4)) : 0,
          stretch: c.timeStretchMode === 'resample' ? 'resample' : 'sync',
          pitchSemitones: c.transposeSemitones,
        });
      }
    }
  });
  if (droppedAudio) warnings.push(`${droppedAudio} recorded clip(s) from the old studio could not be restored (their audio was not saved).`);
  warnings.push('This song was converted from the previous version of the studio.');
  const lr = isObj(raw.loopRegion) ? raw.loopRegion : {};
  return {
    schemaVersion: 1,
    id: raw.id,
    title: raw.title,
    tempoMap: [{ tick: 0, bpm }],
    timeSigMap: [{ tick: 0, sig: { numerator: num(ts[0], 4), denominator: num(ts[1], 4) } }],
    tracks,
    regions,
    assets,
    master: { volumeDb: 0 },
    loop: {
      enabled: bool(lr.enabled, false),
      start: Math.round(num(lr.startBeat, 0) * PPQ),
      end: Math.round(num(lr.endBeat, 16) * PPQ),
    },
  };
}
