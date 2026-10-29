import { CHAIN_PRESETS, EFFECT_DEFS } from './effectDefs';
import { createEffect, createTrack, newId } from './factory';
import { quantizeTicks } from './quantizeTicks';
import {
  AudioAssetInfo,
  AutomationPoint,
  EffectType,
  MidiNote,
  MidiRegion,
  PPQ,
  Project,
  Region,
  Track,
  TrackKind,
} from './types';

/**
 * Pure editing operations: (project, args) -> new project.
 * Every UI path (mouse, keyboard, menus) goes through these via the store so
 * undo/redo and the audio engine see identical changes.
 */

const mapRegions = (p: Project, ids: Set<string>, fn: (r: Region) => Region | Region[] | null): Project => {
  const regions: Region[] = [];
  for (const r of p.regions) {
    if (!ids.has(r.id)) {
      regions.push(r);
      continue;
    }
    const out = fn(r);
    if (Array.isArray(out)) regions.push(...out);
    else if (out) regions.push(out);
  }
  return { ...p, regions };
};

const mapTrack = (p: Project, trackId: string, fn: (t: Track) => Track): Project => ({
  ...p,
  tracks: p.tracks.map((t) => (t.id === trackId ? fn(t) : t)),
});

// ---------------------------------------------------------------- tracks

export function addTrack(p: Project, kind: TrackKind, name?: string, instrumentId?: string, index?: number): { project: Project; track: Track } {
  const track = createTrack(kind, name ?? (kind === 'audio' ? `Audio ${p.tracks.length + 1}` : `Instrument ${p.tracks.length + 1}`), p.tracks.length, instrumentId);
  const tracks = [...p.tracks];
  tracks.splice(index ?? tracks.length, 0, track);
  return { project: { ...p, tracks }, track };
}

export function updateTrack(p: Project, trackId: string, patch: Partial<Track>): Project {
  return mapTrack(p, trackId, (t) => ({ ...t, ...patch, id: t.id, kind: t.kind }));
}

export function removeTracks(p: Project, ids: string[]): Project {
  const set = new Set(ids);
  return {
    ...p,
    tracks: p.tracks.filter((t) => !set.has(t.id)),
    regions: p.regions.filter((r) => !set.has(r.trackId)),
  };
}

export function duplicateTrack(p: Project, trackId: string): Project {
  const idx = p.tracks.findIndex((t) => t.id === trackId);
  if (idx < 0) return p;
  const src = p.tracks[idx];
  const fxMap = new Map<string, string>();
  const effects = src.effects.map((e) => {
    const id = newId('fx');
    fxMap.set(e.id, id);
    return { ...e, id, params: { ...e.params } };
  });
  const track: Track = {
    ...src,
    id: newId('trk'),
    name: `${src.name} copy`.slice(0, 40),
    solo: false,
    arm: false,
    effects,
    automation: src.automation.map((l) => ({
      ...l,
      id: newId('aut'),
      target: l.target.replace(/^fx:([^:]+):/, (_m, fid: string) => `fx:${fxMap.get(fid) ?? fid}:`),
      points: l.points.map((pt) => ({ ...pt, id: newId('pt') })),
    })),
  };
  const regions = p.regions
    .filter((r) => r.trackId === trackId)
    .map((r) => cloneRegion(r, { trackId: track.id }));
  const tracks = [...p.tracks];
  tracks.splice(idx + 1, 0, track);
  return { ...p, tracks, regions: [...p.regions, ...regions] };
}

export function moveTrack(p: Project, trackId: string, toIndex: number): Project {
  const tracks = [...p.tracks];
  const from = tracks.findIndex((t) => t.id === trackId);
  if (from < 0) return p;
  const [t] = tracks.splice(from, 1);
  tracks.splice(Math.max(0, Math.min(tracks.length, toIndex)), 0, t);
  return { ...p, tracks };
}

// ---------------------------------------------------------------- regions

export function cloneRegion(r: Region, patch: Partial<Region> = {}): Region {
  const base = { ...r, ...patch, id: newId('rgn') } as Region;
  if (base.kind === 'midi') base.notes = base.notes.map((n) => ({ ...n, id: newId('n') }));
  return base;
}

export function addRegions(p: Project, regions: Region[], assets?: AudioAssetInfo[]): Project {
  const next = { ...p, regions: [...p.regions, ...regions] };
  if (assets?.length) {
    next.assets = { ...p.assets };
    for (const a of assets) next.assets[a.id] = a;
  }
  return next;
}

export function updateRegion(p: Project, id: string, patch: Partial<Region>): Project {
  return mapRegions(p, new Set([id]), (r) => ({ ...r, ...patch, id: r.id, kind: r.kind }) as Region);
}

export function removeRegions(p: Project, ids: string[]): Project {
  const set = new Set(ids);
  return { ...p, regions: p.regions.filter((r) => !set.has(r.id)) };
}

/**
 * Move regions by a tick delta and a track-index delta. Track moves only go to
 * tracks of the same kind; otherwise the region stays on its track.
 */
export function moveRegions(p: Project, ids: string[], deltaTick: number, deltaTrack: number): Project {
  const set = new Set(ids);
  const visible = p.tracks;
  const minStart = Math.min(...p.regions.filter((r) => set.has(r.id)).map((r) => r.start));
  const dt = Math.max(deltaTick, -minStart);
  return mapRegions(p, set, (r) => {
    let trackId = r.trackId;
    if (deltaTrack) {
      const idx = visible.findIndex((t) => t.id === r.trackId);
      const target = visible[idx + deltaTrack];
      const wantKind = r.kind === 'audio' ? 'audio' : 'instrument';
      if (target && target.kind === wantKind) trackId = target.id;
    }
    return { ...r, start: r.start + dt, trackId };
  });
}

export type ResizeEdge = 'start' | 'end';

/** Resize from the left (trim, content stays in place) or the right edge. */
export function resizeRegion(p: Project, id: string, edge: ResizeEdge, tick: number, minLength = PPQ / 16): Project {
  return mapRegions(p, new Set([id]), (r) => {
    if (edge === 'end') {
      let end = Math.max(r.start + minLength, Math.round(tick));
      if (!r.loop && r.kind === 'midi') {
        // MIDI clips grow freely: the content window follows the clip length.
        const length = end - r.start;
        return { ...r, length, loopLength: Math.max(r.loopLength, r.contentOffset + length) };
      }
      if (!r.loop) end = Math.min(end, r.start + Math.max(minLength, r.loopLength - r.contentOffset));
      return { ...r, length: end - r.start };
    }
    const end = r.start + r.length;
    let start = Math.min(end - minLength, Math.max(0, Math.round(tick)));
    let contentOffset = r.contentOffset + (start - r.start);
    if (!r.loop && contentOffset < 0) {
      start -= contentOffset;
      contentOffset = 0;
    }
    if (r.loop && r.loopLength > 0) contentOffset = ((contentOffset % r.loopLength) + r.loopLength) % r.loopLength;
    return { ...r, start, length: end - start, contentOffset };
  });
}

/** Split every region in `ids` that spans `tick`. Returns new project and the ids of the right halves. */
export function splitRegions(p: Project, ids: string[], tick: number): { project: Project; created: string[] } {
  const created: string[] = [];
  const project = mapRegions(p, new Set(ids), (r) => {
    if (tick <= r.start || tick >= r.start + r.length) return r;
    const leftLen = tick - r.start;
    const left = { ...r, length: leftLen } as Region;
    if (left.kind === 'audio') left.fadeOut = 0;
    let rightOffset = r.contentOffset + leftLen;
    if (r.loop && r.loopLength > 0) rightOffset %= r.loopLength;
    const right = cloneRegion(r, { start: tick, length: r.length - leftLen, contentOffset: rightOffset });
    if (right.kind === 'audio') right.fadeIn = 0;
    if (right.kind === 'audio' && r.kind === 'audio') right.fadeOut = r.fadeOut;
    created.push(right.id);
    return [left, right];
  });
  return { project, created };
}

/** Duplicate regions so the copies follow immediately after the selection. */
export function duplicateRegions(p: Project, ids: string[]): { project: Project; created: string[] } {
  const sel = p.regions.filter((r) => ids.includes(r.id));
  if (!sel.length) return { project: p, created: [] };
  const start = Math.min(...sel.map((r) => r.start));
  const end = Math.max(...sel.map((r) => r.start + r.length));
  const span = end - start;
  const copies = sel.map((r) => cloneRegion(r, { start: r.start + span }));
  return { project: { ...p, regions: [...p.regions, ...copies] }, created: copies.map((c) => c.id) };
}

export interface ClipboardData {
  regions: Region[];
  assets: AudioAssetInfo[];
  trackIds: string[]; // original track ids, in project order of first appearance
  origin: number;
}

export function copyRegions(p: Project, ids: string[]): ClipboardData | null {
  const sel = p.regions.filter((r) => ids.includes(r.id));
  if (!sel.length) return null;
  const order = p.tracks.map((t) => t.id).filter((tid) => sel.some((r) => r.trackId === tid));
  const assets = [...new Set(sel.filter((r) => r.kind === 'audio').map((r) => (r as { assetId: string }).assetId))]
    .map((a) => p.assets[a])
    .filter(Boolean);
  return { regions: sel, assets, trackIds: order, origin: Math.min(...sel.map((r) => r.start)) };
}

/**
 * Paste at `at`. The top clipboard track lands on `targetTrackId` (or its original
 * track when not given); further tracks keep their relative offsets when compatible.
 */
export function pasteRegions(p: Project, clip: ClipboardData, at: number, targetTrackId?: string): { project: Project; created: string[] } {
  const created: Region[] = [];
  const targetIdx = targetTrackId ? p.tracks.findIndex((t) => t.id === targetTrackId) : -1;
  for (const r of clip.regions) {
    let trackId = r.trackId;
    if (targetIdx >= 0) {
      const rel = clip.trackIds.indexOf(r.trackId);
      const cand = p.tracks[targetIdx + rel];
      const wantKind = r.kind === 'audio' ? 'audio' : 'instrument';
      if (cand && cand.kind === wantKind) trackId = cand.id;
    }
    if (!p.tracks.some((t) => t.id === trackId)) continue;
    created.push(cloneRegion(r, { trackId, start: Math.max(0, at + (r.start - clip.origin)) }));
  }
  return { project: addRegions(p, created, clip.assets), created: created.map((r) => r.id) };
}

/** Merge MIDI regions on the same track into one region spanning them all. */
export function mergeMidiRegions(p: Project, ids: string[]): { project: Project; merged?: string; error?: string } {
  const sel = p.regions.filter((r) => ids.includes(r.id));
  if (sel.length < 2) return { project: p, error: 'Select two or more clips to merge.' };
  if (sel.some((r) => r.kind !== 'midi')) return { project: p, error: 'Only MIDI clips can be merged. (Audio merging/bouncing is not available yet.)' };
  if (new Set(sel.map((r) => r.trackId)).size > 1) return { project: p, error: 'Clips must be on the same track to merge.' };
  const start = Math.min(...sel.map((r) => r.start));
  const end = Math.max(...sel.map((r) => r.start + r.length));
  const notes: MidiNote[] = [];
  for (const r of sel as MidiRegion[]) {
    for (const n of expandMidiNotes(r)) notes.push({ ...n, id: newId('n'), start: n.start + r.start - start });
  }
  const first = sel[0] as MidiRegion;
  const merged: MidiRegion = { ...first, id: newId('rgn'), start, length: end - start, contentOffset: 0, loopLength: end - start, loop: false, notes };
  const rest = removeRegions(p, ids);
  return { project: { ...rest, regions: [...rest.regions, merged] }, merged: merged.id };
}

/** Notes as heard on the timeline, relative to region.start (loops/offset applied, notes clipped). */
export function expandMidiNotes(r: MidiRegion): MidiNote[] {
  const out: MidiNote[] = [];
  const L = r.loopLength;
  const iterations = r.loop ? Math.ceil((r.length + (r.contentOffset % L)) / L) + 1 : 1;
  const phase = r.loop ? r.contentOffset % L : r.contentOffset;
  for (let k = 0; k < iterations; k++) {
    for (const n of r.notes) {
      if (r.loop && n.start >= L) continue;
      const rel = k * L + n.start - phase;
      if (rel < 0 || rel >= r.length) continue;
      const maxLen = r.loop ? Math.min(n.length, L - n.start) : n.length;
      out.push({ ...n, start: rel, length: Math.max(1, Math.min(maxLen, r.length - rel)) });
    }
    if (!r.loop) break;
  }
  return out;
}

// ---------------------------------------------------------------- notes

export function setNotes(p: Project, regionId: string, notes: MidiNote[]): Project {
  return mapRegions(p, new Set([regionId]), (r) => (r.kind === 'midi' ? { ...r, notes } : r));
}

export function quantizeRegionNotes(p: Project, regionId: string, grid: number, noteIds?: string[], strength = 1): Project {
  return mapRegions(p, new Set([regionId]), (r) => {
    if (r.kind !== 'midi') return r;
    const target = noteIds ? new Set(noteIds) : null;
    const notes = r.notes.map((n) => (target && !target.has(n.id) ? n : { ...n, ...quantizeTicks(n.start, n.length, grid, strength) }));
    return { ...r, notes };
  });
}

// ---------------------------------------------------------------- tempo / signature

/**
 * Set the project tempo. Musical positions (ticks) are preserved. Audio regions
 * that do not follow tempo ("off") are rescaled so their audio keeps its real duration.
 */
export function setTempo(p: Project, bpm: number): Project {
  const nb = Math.min(300, Math.max(20, Math.round(bpm * 100) / 100));
  const old = p.tempoMap[0].bpm;
  if (nb === old) return p;
  const k = nb / old;
  const regions = p.regions.map((r) =>
    r.kind === 'audio' && r.stretch === 'off'
      ? {
          ...r,
          length: Math.max(1, Math.round(r.length * k)),
          loopLength: Math.max(1, Math.round(r.loopLength * k)),
          contentOffset: Math.round(r.contentOffset * k),
          fadeIn: Math.round(r.fadeIn * k),
          fadeOut: Math.round(r.fadeOut * k),
        }
      : r,
  );
  return { ...p, tempoMap: [{ tick: 0, bpm: nb }], regions };
}

export function setTimeSignature(p: Project, numerator: number, denominator: number): Project {
  return { ...p, timeSigMap: [{ tick: 0, sig: { numerator, denominator } }] };
}

// ---------------------------------------------------------------- effects

type FxOwner = { trackId: string } | 'master';

function mapEffects(p: Project, owner: FxOwner, fn: (fx: Project['master']['effects']) => Project['master']['effects']): Project {
  if (owner === 'master') return { ...p, master: { ...p.master, effects: fn(p.master.effects) } };
  return mapTrack(p, owner.trackId, (t) => ({ ...t, effects: fn(t.effects) }));
}

export function addEffect(p: Project, owner: FxOwner, type: EffectType, params?: Record<string, number>): Project {
  return mapEffects(p, owner, (fx) => (fx.length >= 8 ? fx : [...fx, createEffect(type, params)]));
}

export function removeEffect(p: Project, owner: FxOwner, effectId: string): Project {
  let next = mapEffects(p, owner, (fx) => fx.filter((e) => e.id !== effectId));
  if (owner !== 'master') {
    next = mapTrack(next, owner.trackId, (t) => ({ ...t, automation: t.automation.filter((l) => !l.target.startsWith(`fx:${effectId}:`)) }));
  }
  return next;
}

export function updateEffect(p: Project, owner: FxOwner, effectId: string, patch: { bypass?: boolean; params?: Record<string, number> }): Project {
  return mapEffects(p, owner, (fx) =>
    fx.map((e) => {
      if (e.id !== effectId) return e;
      const params = { ...e.params };
      if (patch.params) {
        for (const [k, v] of Object.entries(patch.params)) {
          const def = EFFECT_DEFS[e.type].params.find((d) => d.key === k);
          if (def && Number.isFinite(v)) params[k] = Math.min(def.max, Math.max(def.min, v));
        }
      }
      return { ...e, bypass: patch.bypass ?? e.bypass, params };
    }),
  );
}

export function moveEffect(p: Project, owner: FxOwner, effectId: string, toIndex: number): Project {
  return mapEffects(p, owner, (fx) => {
    const arr = [...fx];
    const i = arr.findIndex((e) => e.id === effectId);
    if (i < 0) return fx;
    const [e] = arr.splice(i, 1);
    arr.splice(Math.max(0, Math.min(arr.length, toIndex)), 0, e);
    return arr;
  });
}

export function applyChainPreset(p: Project, trackId: string, presetId: string): Project {
  const preset = CHAIN_PRESETS.find((c) => c.id === presetId);
  if (!preset) return p;
  return mapTrack(p, trackId, (t) => ({
    ...t,
    effects: preset.effects.map((e) => createEffect(e.type, e.params)),
    automation: t.automation.filter((l) => !l.target.startsWith('fx:')),
  }));
}

// ---------------------------------------------------------------- automation

export function setAutomationPoints(p: Project, trackId: string, target: string, points: AutomationPoint[]): Project {
  return mapTrack(p, trackId, (t) => {
    const sorted = [...points].sort((a, b) => a.tick - b.tick);
    const existing = t.automation.find((l) => l.target === target);
    if (existing) return { ...t, automation: t.automation.map((l) => (l.target === target ? { ...l, points: sorted } : l)) };
    return { ...t, automation: [...t.automation, { id: newId('aut'), target, enabled: true, visible: true, points: sorted }] };
  });
}

export function setLaneVisible(p: Project, trackId: string, target: string, visible: boolean): Project {
  return mapTrack(p, trackId, (t) => {
    if (t.automation.some((l) => l.target === target)) {
      return { ...t, automation: t.automation.map((l) => (l.target === target ? { ...l, visible } : l)) };
    }
    return { ...t, automation: [...t.automation, { id: newId('aut'), target, enabled: true, visible, points: [] }] };
  });
}

// ---------------------------------------------------------------- misc

export function projectEndTick(p: Project): number {
  let end = 0;
  for (const r of p.regions) end = Math.max(end, r.start + r.length);
  return end;
}

export function addMarker(p: Project, tick: number, name: string): Project {
  return { ...p, markers: [...p.markers, { id: newId('mk'), tick, name }].sort((a, b) => a.tick - b.tick) };
}
