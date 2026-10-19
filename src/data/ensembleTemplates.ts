import { ClefType, InstrumentId, Score, Track } from '../types/music';
import { createEmptyMeasure } from './templates';

export interface EnsembleInstrumentSpec {
  name: string;
  instrumentId: InstrumentId;
  clef: ClefType;
  volume: number;
  pan?: number;
}

export interface EnsembleTemplate {
  id: string;
  name: string;
  category: 'classical' | 'band' | 'jazz_rock' | 'duets' | 'choral_world';
  description: string;
  icon: string;
  tempo: number;
  timeSignature: [number, number];
  instruments: EnsembleInstrumentSpec[];
}

export const ENSEMBLE_TEMPLATES: EnsembleTemplate[] = [
  // ==========================================
  // 1. CLASSICAL & CHAMBER
  // ==========================================
  {
    id: 'string_quartet',
    name: 'String Quartet',
    category: 'classical',
    description: 'Traditional classical chamber quartet: two violins, viola, and cello.',
    icon: '🎻',
    tempo: 104,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Violin I', instrumentId: 'violin', clef: 'treble', volume: 0.85, pan: -0.4 },
      { name: 'Violin II', instrumentId: 'violin', clef: 'treble', volume: 0.82, pan: -0.2 },
      { name: 'Viola', instrumentId: 'viola', clef: 'treble', volume: 0.8, pan: 0.2 },
      { name: 'Violoncello', instrumentId: 'cello', clef: 'bass', volume: 0.88, pan: 0.4 },
    ],
  },
  {
    id: 'string_orchestra',
    name: 'String Orchestra',
    category: 'classical',
    description: 'Full rich string section with violins, viola, cello, and double bass.',
    icon: '🎻',
    tempo: 100,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Violin I', instrumentId: 'violin', clef: 'treble', volume: 0.85, pan: -0.45 },
      { name: 'Violin II', instrumentId: 'violin', clef: 'treble', volume: 0.82, pan: -0.2 },
      { name: 'Viola', instrumentId: 'viola', clef: 'treble', volume: 0.8, pan: 0.15 },
      { name: 'Violoncello', instrumentId: 'cello', clef: 'bass', volume: 0.85, pan: 0.35 },
      { name: 'Double Bass', instrumentId: 'double_bass', clef: 'bass', volume: 0.9, pan: 0.0 },
    ],
  },
  {
    id: 'woodwind_quintet',
    name: 'Woodwind Quintet',
    category: 'classical',
    description: 'Chamber winds: Flute, Oboe, Clarinet, French Horn, and Bassoon.',
    icon: '🪈',
    tempo: 96,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Flute', instrumentId: 'flute', clef: 'treble', volume: 0.85, pan: -0.4 },
      { name: 'Oboe', instrumentId: 'oboe', clef: 'treble', volume: 0.8, pan: -0.15 },
      { name: 'Bb Clarinet', instrumentId: 'clarinet', clef: 'treble', volume: 0.85, pan: 0.15 },
      { name: 'French Horn in F', instrumentId: 'french_horn', clef: 'treble', volume: 0.8, pan: 0.35 },
      { name: 'Bassoon', instrumentId: 'bassoon', clef: 'bass', volume: 0.85, pan: 0.0 },
    ],
  },
  {
    id: 'brass_quintet',
    name: 'Brass Quintet',
    category: 'classical',
    description: 'Fanfare & warmth: Two Trumpets, French Horn, Trombone, and Tuba.',
    icon: '🎺',
    tempo: 112,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Trumpet 1', instrumentId: 'trumpet', clef: 'treble', volume: 0.85, pan: -0.4 },
      { name: 'Trumpet 2', instrumentId: 'trumpet', clef: 'treble', volume: 0.8, pan: -0.15 },
      { name: 'French Horn', instrumentId: 'french_horn', clef: 'treble', volume: 0.8, pan: 0.15 },
      { name: 'Trombone', instrumentId: 'trombone', clef: 'bass', volume: 0.85, pan: 0.35 },
      { name: 'Tuba', instrumentId: 'tuba', clef: 'bass', volume: 0.9, pan: 0.0 },
    ],
  },
  {
    id: 'symphony_orchestra',
    name: 'Full Symphony Orchestra',
    category: 'classical',
    description: 'Massive orchestral score with Woodwinds, Brass, Percussion, and Strings.',
    icon: '🎼',
    tempo: 108,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Flute', instrumentId: 'flute', clef: 'treble', volume: 0.8, pan: -0.3 },
      { name: 'Oboe', instrumentId: 'oboe', clef: 'treble', volume: 0.75, pan: -0.1 },
      { name: 'Bb Clarinet', instrumentId: 'clarinet', clef: 'treble', volume: 0.8, pan: 0.1 },
      { name: 'Bassoon', instrumentId: 'bassoon', clef: 'bass', volume: 0.8, pan: 0.3 },
      { name: 'French Horn', instrumentId: 'french_horn', clef: 'treble', volume: 0.78, pan: -0.35 },
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.8, pan: 0.0 },
      { name: 'Trombone', instrumentId: 'trombone', clef: 'bass', volume: 0.82, pan: 0.3 },
      { name: 'Tuba', instrumentId: 'tuba', clef: 'bass', volume: 0.88, pan: 0.1 },
      { name: 'Timpani', instrumentId: 'timpani', clef: 'bass', volume: 0.85, pan: 0.0 },
      { name: 'Violin I', instrumentId: 'violin', clef: 'treble', volume: 0.82, pan: -0.45 },
      { name: 'Violin II', instrumentId: 'violin', clef: 'treble', volume: 0.78, pan: -0.25 },
      { name: 'Viola', instrumentId: 'viola', clef: 'treble', volume: 0.78, pan: 0.2 },
      { name: 'Cello', instrumentId: 'cello', clef: 'bass', volume: 0.84, pan: 0.4 },
      { name: 'Double Bass', instrumentId: 'double_bass', clef: 'bass', volume: 0.88, pan: 0.0 },
    ],
  },

  // ==========================================
  // 2. PIANO & DUETS
  // ==========================================
  {
    id: 'piano_and_flute',
    name: 'Piano and Flute',
    category: 'duets',
    description: 'Charming recital duo: lyrical flute solo accompanied by piano grand staff.',
    icon: '🪈',
    tempo: 92,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Flute', instrumentId: 'flute', clef: 'treble', volume: 0.88, pan: 0.0 },
      { name: 'Piano (Right Hand)', instrumentId: 'piano_treble', clef: 'treble', volume: 0.78, pan: -0.15 },
      { name: 'Piano (Left Hand)', instrumentId: 'piano_bass', clef: 'bass', volume: 0.78, pan: 0.15 },
    ],
  },
  {
    id: 'piano_and_violin',
    name: 'Piano and Violin',
    category: 'duets',
    description: 'Romantic recital sonata: expressively bowed violin and grand piano.',
    icon: '🎻',
    tempo: 96,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Violin', instrumentId: 'violin', clef: 'treble', volume: 0.88, pan: -0.1 },
      { name: 'Piano (Treble)', instrumentId: 'piano_treble', clef: 'treble', volume: 0.78, pan: -0.2 },
      { name: 'Piano (Bass)', instrumentId: 'piano_bass', clef: 'bass', volume: 0.78, pan: 0.2 },
    ],
  },
  {
    id: 'piano_and_trumpet',
    name: 'Piano and Trumpet',
    category: 'duets',
    description: 'Heroic & bold: Bb trumpet solo with grand piano accompaniment.',
    icon: '🎺',
    tempo: 110,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.88, pan: 0.0 },
      { name: 'Piano (Treble)', instrumentId: 'piano_treble', clef: 'treble', volume: 0.78, pan: -0.2 },
      { name: 'Piano (Bass)', instrumentId: 'piano_bass', clef: 'bass', volume: 0.78, pan: 0.2 },
    ],
  },
  {
    id: 'piano_and_cello',
    name: 'Piano and Cello',
    category: 'duets',
    description: 'Deep, warm, and resonant: cello melody accompanied by piano.',
    icon: '🎻',
    tempo: 84,
    timeSignature: [3, 4],
    instruments: [
      { name: 'Cello', instrumentId: 'cello', clef: 'bass', volume: 0.9, pan: -0.15 },
      { name: 'Piano (Treble)', instrumentId: 'piano_treble', clef: 'treble', volume: 0.76, pan: -0.2 },
      { name: 'Piano (Bass)', instrumentId: 'piano_bass', clef: 'bass', volume: 0.76, pan: 0.2 },
    ],
  },
  {
    id: 'grand_piano_solo',
    name: 'Grand Piano (Solo Grand Staff)',
    category: 'duets',
    description: 'Standard 2-staff grand piano: Treble Clef right hand and Bass Clef left hand.',
    icon: '🎹',
    tempo: 104,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Piano (Right Hand)', instrumentId: 'piano_treble', clef: 'treble', volume: 0.85, pan: -0.1 },
      { name: 'Piano (Left Hand)', instrumentId: 'piano_bass', clef: 'bass', volume: 0.85, pan: 0.1 },
    ],
  },

  // ==========================================
  // 3. BANDS & WINDS
  // ==========================================
  {
    id: 'brass_band',
    name: 'Brass Band',
    category: 'band',
    description: 'British & American style brass band: Cornet, Flugelhorn, Trombone, Euphonium, and Tuba.',
    icon: '🎺',
    tempo: 116,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Cornet / Trumpet', instrumentId: 'cornet', clef: 'treble', volume: 0.85, pan: -0.35 },
      { name: 'Flugelhorn', instrumentId: 'flugelhorn', clef: 'treble', volume: 0.82, pan: -0.1 },
      { name: 'French Horn', instrumentId: 'french_horn', clef: 'treble', volume: 0.8, pan: 0.1 },
      { name: 'Trombone', instrumentId: 'trombone', clef: 'bass', volume: 0.85, pan: 0.35 },
      { name: 'Euphonium', instrumentId: 'euphonium', clef: 'bass', volume: 0.85, pan: 0.15 },
      { name: 'Tuba', instrumentId: 'tuba', clef: 'bass', volume: 0.9, pan: 0.0 },
    ],
  },
  {
    id: 'concert_band',
    name: 'Concert Band',
    category: 'band',
    description: 'School concert band: Flute, Clarinet, Alto Sax, Trumpet, Trombone, Tuba, and Drums.',
    icon: '🥁',
    tempo: 120,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Flute', instrumentId: 'flute', clef: 'treble', volume: 0.8, pan: -0.4 },
      { name: 'Clarinet', instrumentId: 'clarinet', clef: 'treble', volume: 0.82, pan: -0.2 },
      { name: 'Alto Saxophone', instrumentId: 'alto_sax', clef: 'treble', volume: 0.85, pan: -0.1 },
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.85, pan: 0.15 },
      { name: 'Trombone', instrumentId: 'trombone', clef: 'bass', volume: 0.85, pan: 0.35 },
      { name: 'Tuba', instrumentId: 'tuba', clef: 'bass', volume: 0.9, pan: 0.0 },
      { name: 'Concert Drums', instrumentId: 'drum_kit', clef: 'bass', volume: 0.8, pan: 0.0 },
    ],
  },
  {
    id: 'marching_band',
    name: 'Marching Band & Drumline',
    category: 'band',
    description: 'High-energy stadium sounds: Piccolo, Alto Sax, Trumpets, Low Brass, and Marching Kit.',
    icon: '🎪',
    tempo: 132,
    timeSignature: [2, 4],
    instruments: [
      { name: 'Piccolo', instrumentId: 'piccolo', clef: 'treble', volume: 0.82, pan: -0.3 },
      { name: 'Alto Saxophone', instrumentId: 'alto_sax', clef: 'treble', volume: 0.85, pan: -0.15 },
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.88, pan: 0.15 },
      { name: 'Trombone', instrumentId: 'trombone', clef: 'bass', volume: 0.88, pan: 0.35 },
      { name: 'Sousaphone (Tuba)', instrumentId: 'tuba', clef: 'bass', volume: 0.92, pan: 0.0 },
      { name: 'Marching Drums', instrumentId: 'drum_kit', clef: 'bass', volume: 0.88, pan: 0.0 },
    ],
  },

  // ==========================================
  // 4. JAZZ, ROCK & CONTEMPORARY
  // ==========================================
  {
    id: 'jazz_band',
    name: 'Jazz Band & Combo',
    category: 'jazz_rock',
    description: 'Swinging rhythm section and horns: Sax, Trumpet, Trombone, Piano, Upright/Electric Bass, and Drums.',
    icon: '🎷',
    tempo: 128,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Alto Saxophone', instrumentId: 'alto_sax', clef: 'treble', volume: 0.88, pan: -0.35 },
      { name: 'Tenor Saxophone', instrumentId: 'tenor_sax', clef: 'treble', volume: 0.85, pan: -0.15 },
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.85, pan: 0.2 },
      { name: 'Jazz Piano', instrumentId: 'piano_treble', clef: 'treble', volume: 0.8, pan: -0.25 },
      { name: 'Acoustic / Electric Bass', instrumentId: 'electric_bass', clef: 'bass', volume: 0.9, pan: 0.0 },
      { name: 'Jazz Drums', instrumentId: 'drum_kit', clef: 'bass', volume: 0.82, pan: 0.1 },
    ],
  },
  {
    id: 'rock_band',
    name: 'Rock Band',
    category: 'jazz_rock',
    description: 'Classic rock line-up: Lead Guitar, Rhythm Overdrive Guitar, Bass Guitar, Keyboards, and Drums.',
    icon: '🎸',
    tempo: 120,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Lead Guitar', instrumentId: 'electric_guitar', clef: 'treble', volume: 0.85, pan: -0.3 },
      { name: 'Power Chord Guitar', instrumentId: 'overdrive_guitar', clef: 'treble', volume: 0.82, pan: 0.3 },
      { name: 'Rock Organ / Keys', instrumentId: 'jazz_organ', clef: 'treble', volume: 0.78, pan: -0.15 },
      { name: 'Electric Bass', instrumentId: 'electric_bass', clef: 'bass', volume: 0.92, pan: 0.0 },
      { name: 'Rock Drum Kit', instrumentId: 'drum_kit', clef: 'bass', volume: 0.88, pan: 0.0 },
    ],
  },
  {
    id: 'synth_techno',
    name: 'Synth Techno & EDM',
    category: 'jazz_rock',
    description: 'Electronic music studio: Pulsing Synth Lead, Lush Warm Pad, Punchy Sub Bass, and 808/Drums.',
    icon: '⚡',
    tempo: 126,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Sawtooth Synth Lead', instrumentId: 'synth_lead', clef: 'treble', volume: 0.85, pan: -0.2 },
      { name: 'Lush Synth Pad', instrumentId: 'synth_pad', clef: 'treble', volume: 0.75, pan: 0.25 },
      { name: 'Electronic Synth Bass', instrumentId: 'synth_bass', clef: 'bass', volume: 0.95, pan: 0.0 },
      { name: 'Techno Drum Machine', instrumentId: 'drum_kit', clef: 'bass', volume: 0.9, pan: 0.0 },
    ],
  },
  {
    id: 'pop_combo',
    name: 'Pop / Singer-Songwriter',
    category: 'jazz_rock',
    description: 'Modern radio pop ensemble: Acoustic Guitar, Grand Piano, Electric Bass, and Pocket Drums.',
    icon: '🎤',
    tempo: 110,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Acoustic Guitar', instrumentId: 'acoustic_guitar', clef: 'treble', volume: 0.82, pan: -0.3 },
      { name: 'Grand Piano', instrumentId: 'piano_treble', clef: 'treble', volume: 0.82, pan: 0.25 },
      { name: 'Bass Guitar', instrumentId: 'electric_bass', clef: 'bass', volume: 0.88, pan: 0.0 },
      { name: 'Pop Drum Kit', instrumentId: 'drum_kit', clef: 'bass', volume: 0.82, pan: 0.0 },
    ],
  },

  // ==========================================
  // 5. CHORAL & WORLD
  // ==========================================
  {
    id: 'choir_satb',
    name: 'Choir SATB (4-Part Vocal)',
    category: 'choral_world',
    description: 'Four-part vocal ensemble: Soprano (treble), Alto (treble), Tenor (bass), and Bass (bass).',
    icon: '👥',
    tempo: 88,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Soprano', instrumentId: 'choir_aahs', clef: 'treble', volume: 0.85, pan: -0.35 },
      { name: 'Alto', instrumentId: 'voice_oohs', clef: 'treble', volume: 0.82, pan: -0.15 },
      { name: 'Tenor', instrumentId: 'voice_oohs', clef: 'bass', volume: 0.82, pan: 0.15 },
      { name: 'Bass', instrumentId: 'choir_aahs', clef: 'bass', volume: 0.88, pan: 0.35 },
    ],
  },
  {
    id: 'latin_band',
    name: 'Latin / Salsa Ensemble',
    category: 'choral_world',
    description: 'Lively Afro-Cuban groove: Flute, Trumpet, Montuno Piano, Bass, and Percussion.',
    icon: '🌴',
    tempo: 130,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Flute', instrumentId: 'flute', clef: 'treble', volume: 0.85, pan: -0.3 },
      { name: 'Trumpet', instrumentId: 'trumpet', clef: 'treble', volume: 0.88, pan: 0.2 },
      { name: 'Montuno Piano', instrumentId: 'piano_treble', clef: 'treble', volume: 0.82, pan: -0.15 },
      { name: 'Baby Bass', instrumentId: 'electric_bass', clef: 'bass', volume: 0.9, pan: 0.0 },
      { name: 'Congas & Timbales', instrumentId: 'congas', clef: 'bass', volume: 0.85, pan: 0.3 },
    ],
  },
  {
    id: 'orff_percussion',
    name: 'Elementary Orff Percussion',
    category: 'choral_world',
    description: 'Classroom mallet & percussion ensemble: Glockenspiel, Xylophone, Marimba, and Drums.',
    icon: '🪵',
    tempo: 100,
    timeSignature: [4, 4],
    instruments: [
      { name: 'Soprano Glockenspiel', instrumentId: 'glockenspiel', clef: 'treble', volume: 0.82, pan: -0.35 },
      { name: 'Alto Xylophone', instrumentId: 'xylophone', clef: 'treble', volume: 0.85, pan: -0.1 },
      { name: 'Bass Marimba', instrumentId: 'marimba', clef: 'bass', volume: 0.88, pan: 0.2 },
      { name: 'Hand Drums & Shakers', instrumentId: 'tambourine', clef: 'bass', volume: 0.78, pan: 0.35 },
    ],
  },
  {
    id: 'bluegrass_band',
    name: 'Bluegrass & Folk Combo',
    category: 'choral_world',
    description: 'Down-home acoustic pickers: 5-String Banjo, Acoustic Guitar, Fiddle, and Upright Bass.',
    icon: '🪕',
    tempo: 132,
    timeSignature: [2, 4],
    instruments: [
      { name: '5-String Banjo', instrumentId: 'banjo', clef: 'treble', volume: 0.88, pan: -0.3 },
      { name: 'Fiddle (Violin)', instrumentId: 'violin', clef: 'treble', volume: 0.85, pan: -0.1 },
      { name: 'Acoustic Guitar', instrumentId: 'acoustic_guitar', clef: 'treble', volume: 0.82, pan: 0.2 },
      { name: 'Upright Bass', instrumentId: 'double_bass', clef: 'bass', volume: 0.9, pan: 0.0 },
    ],
  },
];

/**
 * Builds a new empty Score initialized with the given ensemble template
 */
export function createScoreFromEnsemble(template: EnsembleTemplate, numMeasures: number = 4): Score {
  const tracks: Track[] = template.instruments.map((inst, idx) => ({
    id: `track_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
    name: inst.name,
    instrumentId: inst.instrumentId,
    clef: inst.clef,
    volume: inst.volume,
    pan: inst.pan ?? 0,
    muted: false,
    soloed: false,
    measures: Array.from({ length: numMeasures }, () => createEmptyMeasure(template.timeSignature)),
  }));

  return {
    id: `score_ens_${Date.now()}`,
    title: `${template.name} Piece`,
    composer: 'Student Composer',
    tempo: template.tempo,
    timeSignature: template.timeSignature,
    keySignature: 'C',
    tracks,
  };
}
