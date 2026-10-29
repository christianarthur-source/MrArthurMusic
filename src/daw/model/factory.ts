import {
  AudioRegion,
  EditorSettings,
  EffectInstance,
  EffectType,
  MidiRegion,
  PPQ,
  Project,
  PROJECT_SCHEMA_VERSION,
  Track,
  TrackKind,
} from './types';
import { EFFECT_DEFS } from './effectDefs';

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rnd}`;
}

export const TRACK_COLORS = [
  '#F59E0B', // amber
  '#EC4899', // pink
  '#38BDF8', // sky
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F43F5E', // rose
  '#06B6D4', // cyan
  '#EAB308', // yellow
  '#A3E635', // lime
  '#FB923C', // orange
];

export const DEFAULT_EDITOR: EditorSettings = {
  snap: true,
  grid: '1/4',
  pxPerBeat: 36,
  trackHeight: 72,
  metronome: false,
  countInBars: 1,
  followPlayhead: true,
};

export function createProject(title = 'My Song', bpm = 110): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: newId('proj'),
    title,
    createdAt: now,
    updatedAt: now,
    tempoMap: [{ tick: 0, bpm }],
    timeSigMap: [{ tick: 0, sig: { numerator: 4, denominator: 4 } }],
    tracks: [],
    regions: [],
    assets: {},
    master: { volumeDb: 0, effects: [createEffect('limiter')] },
    markers: [],
    loop: { enabled: false, start: 0, end: PPQ * 4 * 4 },
    editor: { ...DEFAULT_EDITOR },
  };
}

export function createTrack(kind: TrackKind, name: string, colorIndex: number, instrumentId?: string): Track {
  return {
    id: newId('trk'),
    kind,
    name,
    color: TRACK_COLORS[colorIndex % TRACK_COLORS.length],
    volumeDb: 0,
    pan: 0,
    mute: false,
    solo: false,
    arm: false,
    monitor: false,
    hidden: false,
    height: DEFAULT_EDITOR.trackHeight,
    instrument: kind === 'instrument' ? { id: instrumentId ?? 'piano' } : undefined,
    effects: [],
    automation: [],
  };
}

export function createEffect(type: EffectType, params?: Record<string, number>): EffectInstance {
  const def = EFFECT_DEFS[type];
  const p: Record<string, number> = {};
  for (const param of def.params) p[param.key] = param.default;
  return { id: newId('fx'), type, bypass: false, params: { ...p, ...params } };
}

export function createAudioRegion(
  fields: Pick<AudioRegion, 'trackId' | 'name' | 'start' | 'length' | 'assetId'> & Partial<AudioRegion>,
): AudioRegion {
  return {
    id: newId('rgn'),
    kind: 'audio',
    sourceOffsetSec: 0,
    contentOffset: 0,
    muted: false,
    loopLength: fields.length,
    loop: false,
    gainDb: 0,
    fadeIn: 0,
    fadeOut: 0,
    stretch: 'off',
    pitchSemitones: 0,
    reversed: false,
    ...fields,
  };
}

export function createMidiRegion(
  fields: Pick<MidiRegion, 'trackId' | 'start' | 'length'> & Partial<MidiRegion>,
): MidiRegion {
  return {
    id: newId('rgn'),
    kind: 'midi',
    name: 'MIDI',
    notes: [],
    contentOffset: 0,
    muted: false,
    loopLength: fields.length,
    loop: false,
    ...fields,
  };
}
