export type SoundType =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'clap'
  | 'tom'
  | 'plop'
  | 'boing'
  | 'zap'
  | 'coin'
  | 'quack'
  | 'cowbell'
  | 'robot'
  | 'fart'
  | 'baby-cry'
  | 'dog-bark'
  | 'cat-meow'
  | 'vroom'
  | 'siren'
  | 'cow-moo'
  | 'xylo-c'
  | 'xylo-d'
  | 'xylo-e'
  | 'xylo-g'
  | 'xylo-a'
  | 'xylo-c2'
  | 'bass-wobble'
  | 'acoustic-kick'
  | 'acoustic-snare'
  | 'closed-hat'
  | 'open-hat'
  | 'crash'
  | 'ride'
  | 'conga'
  | 'bongo'
  | 'shaker'
  | 'tambourine'
  | 'custom-mic';

export interface SoundSample {
  id: string;
  name: string;
  category: 'drums' | 'silly' | 'melody' | 'custom';
  icon: string;
  color: string;
  soundType: SoundType;
  description: string;
  funTag: string;
  soundWaveType: 'bass' | 'noise' | 'tone' | 'laser' | 'voice';
  defaultPitch?: number; // playback rate or semitone offset
  customAudioBuffer?: AudioBuffer;
}

export interface BeatTrack {
  id: string;
  sample: SoundSample;
  steps: boolean[]; // 16 steps
  volume: number; // 0 to 1
  muted: boolean;
  solo: boolean;
  pitch: number; // 0.5 to 2.0 (1.0 = normal)
}

export interface SoundPack {
  id: string;
  name: string;
  emoji: string;
  themeColor: string;
  description: string;
  tracks: {
    soundType: SoundType;
    name: string;
    icon: string;
    color: string;
    initialSteps?: number[];
  }[];
}

export interface BeatPreset {
  id: string;
  title: string;
  icon: string;
  bpm: number;
  packId: string;
  description: string;
  patterns: Record<number, number[]>; // track index -> active step indices
}

export type MelodyInstrument =
  | 'xylo'
  | 'chiptune'
  | 'piano'
  | 'synth'
  | 'flute'
  | 'strings'
  | 'woodwinds'
  | 'brass'
  | 'guitar';

export interface MelodyNoteDefinition {
  id: string;
  name: string;
  solfege: string;
  frequency: number;
  color: string;
  glowColor: string;
}

export interface MelodyTrack {
  note: MelodyNoteDefinition;
  steps: boolean[]; // up to 64 steps (1-4 measures)
}

export type BassInstrument =
  | 'string-bass'
  | 'synth-bass'
  | 'tuba'
  | 'bass-guitar'
  | 'bass-synth';

export type ScaleMode = 'pentatonic' | 'major' | 'minor' | 'chromatic';

export interface SharedSongData {
  version: number;
  title: string;
  bpm: number;
  measures: number;
  packId: string;
  drumTracks: {
    soundType: SoundType;
    steps: boolean[];
  }[];
  melodyInstrument: MelodyInstrument;
  melodyScale: ScaleMode;
  melodyTracks: {
    noteId: string;
    steps: boolean[];
  }[];
  bassInstrument?: BassInstrument;
  bassScale?: ScaleMode;
  bassTracks?: {
    noteId: string;
    steps: boolean[];
  }[];
  // Song Settings
  totalStepsInMeasure?: 8 | 16;
  melodyOctaves?: 1 | 2;
  bassOctaves?: 1 | 2;
  // FX Settings
  isEchoOn?: boolean;
  isReverbOn?: boolean;
  isBitcrusherOn?: boolean;
  isDistortionOn?: boolean;
  isFilterOn?: boolean;
}

