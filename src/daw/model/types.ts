/**
 * Native project format (schema version 1).
 *
 * All musical positions are integer ticks at PPQ ticks per quarter note.
 * Ticks are authoritative; seconds and bar/beat strings are always derived
 * and never written back. See ARCHITECTURE.md §"Time model".
 */

export const PROJECT_SCHEMA_VERSION = 1;
export const PPQ = 960;

export type Id = string;

export interface TimeSignature {
  numerator: number; // beats per bar
  denominator: number; // note value of one beat (4 = quarter, 8 = eighth)
}

/** A tempo change at a tick. The first entry must be at tick 0. Constant tempo until the next entry. */
export interface TempoPoint {
  tick: number;
  bpm: number; // quarter notes per minute
}

export interface TimeSigPoint {
  tick: number; // must fall on a bar line of the previous signature
  sig: TimeSignature;
}

export type TrackKind = 'audio' | 'instrument';

/** Where a region's audio comes from. Projects never reference files by name alone. */
export type AudioSourceRef =
  | { kind: 'library'; assetId: string; version: number }
  | { kind: 'user'; assetId: string }; // recordings / imports stored in IndexedDB (or archive)

export interface AudioAssetInfo {
  id: string; // stable id ("lib:<assetId>@<version>" or "usr:<uuid>")
  ref: AudioSourceRef;
  name: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  originalBpm?: number; // set for tempo-synced loops
  bars?: number;
  key?: string;
  license?: string;
  attribution?: string;
}

export type StretchMode =
  | 'sync' // follow project tempo, pitch preserved (WSOLA)
  | 'resample' // follow project tempo by changing playback rate (pitch changes, "tape" style)
  | 'off'; // play at original speed regardless of tempo

export interface Fade {
  ticks: number;
}

interface RegionBase {
  id: Id;
  trackId: Id;
  name: string;
  color?: string;
  start: number; // tick on the timeline
  length: number; // ticks shown on the timeline
  /**
   * Phase into the region's content at region.start, in ticks.
   * Content position at timeline tick t = contentOffset + (t - start), wrapped by loopLength when looping.
   */
  contentOffset: number;
  muted?: boolean;
}

export interface AudioRegion extends RegionBase {
  kind: 'audio';
  assetId: string; // key into project.assets
  /** Offset into the source content, in *source seconds* (before stretching). */
  sourceOffsetSec: number;
  /**
   * Length of one repetition of the content in ticks (for looping regions).
   * When region.length > loopLength the content repeats.
   */
  loopLength: number;
  loop: boolean;
  gainDb: number;
  fadeIn: number; // ticks
  fadeOut: number; // ticks
  stretch: StretchMode;
  pitchSemitones: number; // -12..12, applied by the stretch engine (sync) or ignored (off)
  reversed: boolean;
}

export interface MidiNote {
  id: Id;
  pitch: number; // 0..127
  start: number; // tick relative to region start
  length: number; // ticks
  velocity: number; // 1..127
}

export interface MidiRegion extends RegionBase {
  kind: 'midi';
  notes: MidiNote[];
  /** Ticks of one loop cycle; notes outside [0, loopLength) are ignored when looping. */
  loopLength: number;
  loop: boolean;
}

export type Region = AudioRegion | MidiRegion;

export type EffectType =
  | 'eq3'
  | 'compressor'
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'phaser'
  | 'distortion'
  | 'filter'
  | 'limiter';

export interface EffectInstance {
  id: Id;
  type: EffectType;
  bypass: boolean;
  params: Record<string, number>;
}

export type AutomationCurve = 'linear' | 'step';

export interface AutomationPoint {
  id: Id;
  tick: number;
  value: number; // in the parameter's own units
  curve: AutomationCurve; // shape of the segment *leading to* the next point
}

/** target: "volume" | "pan" | "fx:<effectId>:<param>" */
export interface AutomationLane {
  id: Id;
  target: string;
  enabled: boolean;
  points: AutomationPoint[];
  visible: boolean;
}

export interface Track {
  id: Id;
  kind: TrackKind;
  name: string;
  color: string;
  volumeDb: number; // -60..+6
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  arm: boolean;
  monitor: boolean;
  hidden: boolean;
  height: number; // px, editor setting
  instrument?: InstrumentRef; // instrument tracks only
  effects: EffectInstance[];
  automation: AutomationLane[];
}

export interface InstrumentRef {
  /** Sampled instrument id from the instrument manifest, or "synth:<preset>". */
  id: string;
}

export interface Marker {
  id: Id;
  tick: number;
  name: string;
  color?: string;
}

export interface EditorSettings {
  snap: boolean;
  grid: GridDivision;
  pxPerBeat: number;
  trackHeight: number;
  metronome: boolean;
  countInBars: number;
  followPlayhead: boolean;
}

/**
 * A video to score (one per song). The file is either the student's own (stored on this
 * computer under `assetId`, like recordings) or provided by the site (`src`, a same-site path).
 * Its sound, when imported, is an ordinary audio clip on `audioTrackId`; while linked, the
 * video follows that clip, so moving the clip moves the video.
 */
export interface VideoInfo {
  assetId?: string;
  src?: string;
  name: string;
  durationSec: number;
  width: number;
  height: number;
  /** Where the video starts on the timeline (used when it has no linked audio clip). */
  startTick: number;
  audioTrackId?: string;
  /** Where the video was downloaded from (e.g. a Google Drive link), so another computer can fetch it again. */
  link?: string;
}

/** Grid division expressed as a fraction of a whole note. */
export type GridDivision = '1/1' | '1/2' | '1/4' | '1/8' | '1/16' | '1/32' | '1/4T' | '1/8T' | '1/16T';

export interface Project {
  schemaVersion: number;
  id: Id;
  title: string;
  createdAt: string;
  updatedAt: string;
  tempoMap: TempoPoint[];
  timeSigMap: TimeSigPoint[];
  tracks: Track[]; // order = display order
  regions: Region[];
  assets: Record<string, AudioAssetInfo>;
  master: { volumeDb: number; effects: EffectInstance[] };
  markers: Marker[];
  loop: { enabled: boolean; start: number; end: number };
  editor: EditorSettings;
  video?: VideoInfo;
}
