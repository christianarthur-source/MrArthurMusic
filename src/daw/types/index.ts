import { InstrumentId } from '../../types/music';

export type DawTrackType = 'audio' | 'instrument' | 'mic';
export type DawClipType = 'audio' | 'midi';

export interface DawMidiNote {
  id: string;
  midi: number; // 21 to 108 (A0 to C8)
  startBeat: number; // Relative to clip start
  durationBeats: number;
  velocity: number; // 0.1 to 1.0
}

export interface DawClip {
  id: string;
  trackId: string;
  name: string;
  type: DawClipType;
  startBeat: number; // Position on master timeline (in beats: 4 beats = 1 measure in 4/4)
  durationBeats: number; // Length in beats
  color: string;
  // Audio clip fields:
  loopId?: string;
  audioUrl?: string;
  audioBuffer?: AudioBuffer;
  waveform?: number[]; // Peaks [0..1] for instant SVG/Canvas rendering
  trimStartBeat?: number;
  gain?: number;
  isLooping?: boolean;
  // MIDI / Instrument clip fields:
  midiNotes?: DawMidiNote[];
}

export interface DawFxSettings {
  volume: number; // 0 to 1.5, default 1.0
  pan: number; // -1.0 to 1.0, default 0
  eqLow: number; // dB -12 to +12
  eqMid: number; // dB -12 to +12
  eqHigh: number; // dB -12 to +12
  reverbWet: number; // 0 to 1.0
  delayWet: number; // 0 to 1.0
  delayTime: number; // seconds (e.g. 0.35s)
  distortion: number; // 0 to 1.0
}

export interface DawTrack {
  id: string;
  name: string;
  type: DawTrackType;
  color: string;
  icon: string;
  muted: boolean;
  solo: boolean;
  armRecord: boolean;
  instrumentId?: InstrumentId;
  clips: DawClip[];
  fx: DawFxSettings;
}

export type DawLoopCategory = 'drums' | 'bass' | 'chords' | 'melody' | 'vocals' | 'fx';
export type DawLoopGenre = 'hiphop' | 'pop' | 'rock' | 'lofi' | 'cinematic';

export interface DawLoopItem {
  id: string;
  name: string;
  category: DawLoopCategory;
  genre: DawLoopGenre;
  bpm: number;
  key: string;
  durationBeats: number; // Typically 8 (2 bars) or 16 (4 bars)
  color: string;
  icon: string;
  audioUrl?: string;
  audioGeneratorId?: string;
  waveform?: number[];
  description?: string;
}

export type DawSnapGrid = '1bar' | '1/2' | '1/4' | '1/8' | '1/16';
export type DawToolMode = 'pointer' | 'scissors' | 'pencil' | 'eraser';

export interface DawProject {
  id: string;
  title: string;
  bpm: number;
  timeSignature: [number, number]; // [4, 4]
  tracks: DawTrack[];
  masterVolume: number;
  loopRegion: {
    enabled: boolean;
    startBeat: number;
    endBeat: number;
  };
  snapGrid: DawSnapGrid;
}

export const DEFAULT_DAW_FX: DawFxSettings = {
  volume: 1.0,
  pan: 0,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  reverbWet: 0.15,
  delayWet: 0,
  delayTime: 0.32,
  distortion: 0,
};

export const TRACK_COLOR_PALETTE = [
  '#F59E0B', // Amber / Drums
  '#EC4899', // Pink / Bass
  '#38BDF8', // Sky / Keys & Chords
  '#10B981', // Emerald / Guitars
  '#8B5CF6', // Purple / Synth Lead
  '#F43F5E', // Rose / Vocals & FX
  '#06B6D4', // Cyan
  '#EAB308', // Yellow
];
