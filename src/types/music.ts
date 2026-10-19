export type ClefType = 'treble' | 'bass';

export type AccidentalType = 'sharp' | 'flat' | 'natural' | null;

export type NoteStep = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export interface Pitch {
  step: NoteStep;
  octave: number;
  accidental?: AccidentalType;
}

export type NoteDuration = 1 | 0.5 | 0.25 | 0.125 | 0.0625; // 1 = Whole, 0.5 = Half, 0.25 = Quarter, 0.125 = Eighth, 0.0625 = Sixteenth

export type UiMode = 'simple' | 'standard' | 'advanced';

export type ArticulationType = 'accent' | 'staccato' | 'tenuto' | 'marcato' | 'fermata' | null;

export type DynamicMarking = 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'sfz' | null;

export type NoteLabelMode = 'off' | 'letters' | 'solfege_movable' | 'solfege_fixed' | 'scale_degrees';

export type CountingMode = 'off' | 'numbers' | 'kodaly';

export type ViewLayout = 'vertical' | 'horizontal';

export interface NoteItem {
  id: string;
  type: 'note' | 'rest';
  pitch?: Pitch; // primary pitch (for single note or fallback)
  pitches?: Pitch[]; // array of pitches for chords / harmonies at this location
  duration: NoteDuration;
  isDotted?: boolean;
  isTied?: boolean;
  isTriplet?: boolean;
  articulation?: ArticulationType;
  dynamic?: DynamicMarking;
  lyric?: string; // Optional lyric or syllable underlay
  isChallengeBlank?: boolean; // For missing note challenges
}

export interface Measure {
  id: string;
  items: NoteItem[];
  repeatStart?: boolean;
  repeatEnd?: boolean;
}

export type InstrumentCategory =
  | 'Woodwinds'
  | 'Brass'
  | 'Strings'
  | 'Popular & World'
  | 'Keyboards'
  | 'Percussion'
  | 'Drums'
  | 'Sound Effects';

export type InstrumentId =
  // Woodwinds (Full Orchestra & Classroom)
  | 'flute'
  | 'piccolo'
  | 'recorder'
  | 'pan_flute'
  | 'oboe'
  | 'english_horn'
  | 'clarinet'
  | 'bass_clarinet'
  | 'bassoon'
  | 'contrabassoon'
  | 'soprano_sax'
  | 'alto_sax'
  | 'tenor_sax'
  | 'baritone_sax'
  // Brass (Full Orchestra, Jazz & Band)
  | 'trumpet'
  | 'cornet'
  | 'flugelhorn'
  | 'muted_trumpet'
  | 'french_horn'
  | 'trombone'
  | 'bass_trombone'
  | 'euphonium'
  | 'tuba'
  | 'brass_section'
  // Strings (Full Orchestra)
  | 'violin'
  | 'viola'
  | 'cello'
  | 'double_bass'
  | 'string_ensemble'
  | 'pizzicato_strings'
  | 'tremolo_strings'
  | 'harp'
  // Popular, Band, Vocals & World
  | 'acoustic_guitar'
  | 'steel_guitar'
  | 'electric_guitar'
  | 'overdrive_guitar'
  | 'ukulele'
  | 'banjo'
  | 'sitar'
  | 'koto'
  | 'kalimba'
  | 'bagpipes'
  | 'harmonica'
  | 'accordion'
  | 'electric_bass'
  | 'slap_bass'
  | 'synth_bass'
  | 'synth_lead'
  | 'synth_pad'
  | 'choir_aahs'
  | 'voice_oohs'
  // Percussion (Orchestral, Mallets & Auxiliary)
  | 'glockenspiel'
  | 'xylophone'
  | 'marimba'
  | 'vibraphone'
  | 'steel_drums'
  | 'timpani'
  | 'tubular_bells'
  | 'taiko_drum'
  | 'triangle'
  | 'tambourine'
  | 'woodblock'
  | 'cowbell'
  | 'congas'
  | 'djembe'
  // Keyboards
  | 'piano_treble'
  | 'piano_bass'
  | 'electric_piano'
  | 'harpsichord'
  | 'clavinet'
  | 'celesta'
  | 'music_box'
  | 'organ'
  | 'jazz_organ'
  // Drums
  | 'drum_kit'
  // Sound Effects
  | 'sfx_applause'
  | 'sfx_laser'
  | 'sfx_retro_8bit'
  | 'sfx_bird_tweet'
  | 'sfx_ocean_waves'
  | 'sfx_thunder'
  | 'sfx_wind_howl'
  | 'sfx_helicopter'
  | 'sfx_siren'
  | 'sfx_train_whistle'
  | 'sfx_vinyl_scratch'
  | 'sfx_cartoon_boing';

export interface InstrumentDefinition {
  id: InstrumentId;
  name: string;
  clef: ClefType;
  category: InstrumentCategory;
  iconName: string;
  defaultOctave: number;
  color: string;
  description?: string;
}

export interface TrackFxSettings {
  reverb: number; // 0 to 1 (Hall Reverb send)
  delay: number; // 0 to 1 (Echo / Delay send)
  chorus: number; // 0 to 1 (Stereo Chorus / Width)
  eqBass: number; // -12 to +12 dB (Low Shelf @ 180Hz)
  eqTreble: number; // -12 to +12 dB (High Shelf @ 3500Hz)
  drive: number; // 0 to 1 (Warm Saturation / Overdrive)
}

export const DEFAULT_TRACK_FX: TrackFxSettings = {
  reverb: 0.22,
  delay: 0,
  chorus: 0,
  eqBass: 0,
  eqTreble: 0,
  drive: 0,
};

export interface Track {
  id: string;
  name: string;
  instrumentId: InstrumentId;
  clef: ClefType;
  volume: number; // 0 to 1.25 (Channel Fader)
  pan?: number; // -1 (Left) to +1 (Right), default 0 (Center)
  fx?: TrackFxSettings;
  muted: boolean;
  soloed: boolean;
  measures: Measure[];
}

export interface Score {
  id: string;
  title: string;
  composer: string;
  tempo: number; // BPM (40 - 208)
  timeSignature: [number, number]; // e.g. [4, 4], [3, 4], [2, 4], [6, 8]
  keySignature: 'C' | 'G' | 'F' | 'D' | 'Bb';
  tracks: Track[];
}

export interface SelectionState {
  trackIndex: number;
  measureIndex: number;
  itemIndex: number;
}
