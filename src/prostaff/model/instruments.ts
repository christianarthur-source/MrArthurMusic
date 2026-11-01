// Instrument catalog for new scores. `sample` names a CC0 instrument in public/audio/cc0.
// `semi`/`diat` are the written-to-sounding transposition (Bb clarinet sounds a major 2nd lower).

export interface InstrumentDef {
  id: string;
  name: string;
  abbr: string;
  family: 'Woodwinds' | 'Brass' | 'Percussion' | 'Keyboards' | 'Voices' | 'Strings' | 'Plucked' | 'Other';
  clefs: { shape: 'G' | 'F' | 'C' | 'perc'; line: number; dis?: number; disPlace?: 'above' | 'below' }[];
  semi?: number;
  diat?: number;
  program: number; // General MIDI program, 0-based
  sample: string;
  range?: [number, number]; // sounding MIDI range
  percussion?: boolean;
}

export const INSTRUMENTS: InstrumentDef[] = [
  // Woodwinds
  { id: 'piccolo', name: 'Piccolo', abbr: 'Picc.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2, dis: 8, disPlace: 'above' }], semi: 12, diat: 7, program: 72, sample: 'piccolo', range: [74, 108] },
  { id: 'flute', name: 'Flute', abbr: 'Fl.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], program: 73, sample: 'flute', range: [60, 96] },
  { id: 'oboe', name: 'Oboe', abbr: 'Ob.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], program: 68, sample: 'oboe', range: [58, 91] },
  { id: 'clarinet', name: 'Clarinet in B♭', abbr: 'Cl.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], semi: -2, diat: -1, program: 71, sample: 'clarinet', range: [50, 91] },
  { id: 'bass-clarinet', name: 'Bass Clarinet', abbr: 'B. Cl.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], semi: -14, diat: -8, program: 71, sample: 'clarinet', range: [34, 77] },
  { id: 'bassoon', name: 'Bassoon', abbr: 'Bsn.', family: 'Woodwinds', clefs: [{ shape: 'F', line: 4 }], program: 70, sample: 'bassoon', range: [34, 75] },
  { id: 'alto-sax', name: 'Alto Saxophone', abbr: 'A. Sax.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], semi: -9, diat: -5, program: 65, sample: 'tenor_sax', range: [49, 81] },
  { id: 'tenor-sax', name: 'Tenor Saxophone', abbr: 'T. Sax.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], semi: -14, diat: -8, program: 66, sample: 'tenor_sax', range: [44, 76] },
  { id: 'bari-sax', name: 'Baritone Saxophone', abbr: 'Bari. Sax.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2 }], semi: -21, diat: -12, program: 67, sample: 'tenor_sax', range: [36, 69] },
  { id: 'recorder', name: 'Recorder', abbr: 'Rec.', family: 'Woodwinds', clefs: [{ shape: 'G', line: 2, dis: 8, disPlace: 'above' }], semi: 12, diat: 7, program: 74, sample: 'recorder', range: [72, 98] },
  // Brass
  { id: 'horn', name: 'Horn in F', abbr: 'Hn.', family: 'Brass', clefs: [{ shape: 'G', line: 2 }], semi: -7, diat: -4, program: 60, sample: 'french_horn', range: [34, 77] },
  { id: 'trumpet', name: 'Trumpet in B♭', abbr: 'Tpt.', family: 'Brass', clefs: [{ shape: 'G', line: 2 }], semi: -2, diat: -1, program: 56, sample: 'trumpet', range: [52, 82] },
  { id: 'trombone', name: 'Trombone', abbr: 'Tbn.', family: 'Brass', clefs: [{ shape: 'F', line: 4 }], program: 57, sample: 'trombone', range: [40, 72] },
  { id: 'euphonium', name: 'Euphonium', abbr: 'Euph.', family: 'Brass', clefs: [{ shape: 'F', line: 4 }], program: 58, sample: 'tuba', range: [34, 70] },
  { id: 'tuba', name: 'Tuba', abbr: 'Tba.', family: 'Brass', clefs: [{ shape: 'F', line: 4 }], program: 58, sample: 'tuba', range: [26, 58] },
  // Percussion
  { id: 'timpani', name: 'Timpani', abbr: 'Timp.', family: 'Percussion', clefs: [{ shape: 'F', line: 4 }], program: 47, sample: 'cello_pizz', range: [38, 57] },
  { id: 'glockenspiel', name: 'Glockenspiel', abbr: 'Glk.', family: 'Percussion', clefs: [{ shape: 'G', line: 2, dis: 15, disPlace: 'above' }], semi: 24, diat: 14, program: 9, sample: 'glockenspiel', range: [79, 108] },
  { id: 'xylophone', name: 'Xylophone', abbr: 'Xyl.', family: 'Percussion', clefs: [{ shape: 'G', line: 2, dis: 8, disPlace: 'above' }], semi: 12, diat: 7, program: 13, sample: 'xylophone', range: [65, 108] },
  { id: 'vibraphone', name: 'Vibraphone', abbr: 'Vib.', family: 'Percussion', clefs: [{ shape: 'G', line: 2 }], program: 11, sample: 'vibraphone', range: [53, 89] },
  { id: 'marimba', name: 'Marimba', abbr: 'Mar.', family: 'Percussion', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 12, sample: 'marimba', range: [45, 96] },
  { id: 'chimes', name: 'Chimes', abbr: 'Chm.', family: 'Percussion', clefs: [{ shape: 'G', line: 2 }], program: 14, sample: 'tubular_bells', range: [60, 77] },
  { id: 'drumset', name: 'Drum Set', abbr: 'D. S.', family: 'Percussion', clefs: [{ shape: 'perc', line: 3 }], program: 0, sample: 'drum_kit', percussion: true },
  // Keyboards
  { id: 'piano', name: 'Piano', abbr: 'Pno.', family: 'Keyboards', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 0, sample: 'piano', range: [21, 108] },
  { id: 'electric-piano', name: 'Electric Piano', abbr: 'E. Pno.', family: 'Keyboards', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 4, sample: 'electric_piano', range: [28, 103] },
  { id: 'organ', name: 'Organ', abbr: 'Org.', family: 'Keyboards', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 19, sample: 'organ', range: [36, 96] },
  { id: 'harpsichord', name: 'Harpsichord', abbr: 'Hpsd.', family: 'Keyboards', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 6, sample: 'harpsichord', range: [29, 89] },
  { id: 'celesta', name: 'Celesta', abbr: 'Cel.', family: 'Keyboards', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], semi: 12, diat: 7, program: 8, sample: 'glockenspiel', range: [60, 108] },
  // Voices
  { id: 'voice', name: 'Voice', abbr: 'Vo.', family: 'Voices', clefs: [{ shape: 'G', line: 2 }], program: 52, sample: 'ocarina', range: [48, 81] },
  { id: 'soprano', name: 'Soprano', abbr: 'S.', family: 'Voices', clefs: [{ shape: 'G', line: 2 }], program: 52, sample: 'ocarina', range: [60, 81] },
  { id: 'alto', name: 'Alto', abbr: 'A.', family: 'Voices', clefs: [{ shape: 'G', line: 2 }], program: 52, sample: 'recorder', range: [53, 77] },
  { id: 'tenor', name: 'Tenor', abbr: 'T.', family: 'Voices', clefs: [{ shape: 'G', line: 2, dis: 8, disPlace: 'below' }], semi: -12, diat: -7, program: 52, sample: 'clarinet', range: [48, 69] },
  { id: 'baritone', name: 'Baritone', abbr: 'Bar.', family: 'Voices', clefs: [{ shape: 'F', line: 4 }], program: 52, sample: 'bassoon', range: [43, 65] },
  { id: 'bass-voice', name: 'Bass', abbr: 'B.', family: 'Voices', clefs: [{ shape: 'F', line: 4 }], program: 52, sample: 'bassoon', range: [40, 62] },
  // Plucked
  { id: 'guitar', name: 'Guitar', abbr: 'Gtr.', family: 'Plucked', clefs: [{ shape: 'G', line: 2, dis: 8, disPlace: 'below' }], semi: -12, diat: -7, program: 24, sample: 'harp', range: [40, 88] },
  { id: 'bass-guitar', name: 'Bass Guitar', abbr: 'Bass', family: 'Plucked', clefs: [{ shape: 'F', line: 4, dis: 8, disPlace: 'below' }], semi: -12, diat: -7, program: 33, sample: 'upright_bass', range: [28, 67] },
  { id: 'harp', name: 'Harp', abbr: 'Hp.', family: 'Plucked', clefs: [{ shape: 'G', line: 2 }, { shape: 'F', line: 4 }], program: 46, sample: 'harp', range: [24, 103] },
  { id: 'ukulele', name: 'Ukulele', abbr: 'Uke.', family: 'Plucked', clefs: [{ shape: 'G', line: 2 }], program: 24, sample: 'strumstick', range: [60, 81] },
  // Strings
  { id: 'violin', name: 'Violin', abbr: 'Vln.', family: 'Strings', clefs: [{ shape: 'G', line: 2 }], program: 40, sample: 'violin', range: [55, 103] },
  { id: 'viola', name: 'Viola', abbr: 'Vla.', family: 'Strings', clefs: [{ shape: 'C', line: 3 }], program: 41, sample: 'viola', range: [48, 91] },
  { id: 'cello', name: 'Violoncello', abbr: 'Vc.', family: 'Strings', clefs: [{ shape: 'F', line: 4 }], program: 42, sample: 'cello', range: [36, 84] },
  { id: 'contrabass', name: 'Contrabass', abbr: 'Cb.', family: 'Strings', clefs: [{ shape: 'F', line: 4, dis: 8, disPlace: 'below' }], semi: -12, diat: -7, program: 43, sample: 'double_bass', range: [28, 67] },
];

export function instrumentById(id: string): InstrumentDef {
  return INSTRUMENTS.find((i) => i.id === id) || INSTRUMENTS.find((i) => i.id === 'piano')!;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  instruments: string[];
}

export const TEMPLATES: Template[] = [
  { id: 'blank-piano', name: 'Piano', description: 'Grand staff', instruments: ['piano'] },
  { id: 'lead-sheet', name: 'Lead sheet', description: 'Melody with chord symbols and lyrics', instruments: ['voice'] },
  { id: 'solo', name: 'Solo + piano', description: 'Any solo instrument with accompaniment', instruments: ['flute', 'piano'] },
  { id: 'satb', name: 'SATB choir', description: 'Four voices with rehearsal piano', instruments: ['soprano', 'alto', 'tenor', 'bass-voice', 'piano'] },
  { id: 'string-quartet', name: 'String quartet', description: '2 violins, viola, cello', instruments: ['violin', 'violin', 'viola', 'cello'] },
  { id: 'brass-quintet', name: 'Brass quintet', description: '2 trumpets, horn, trombone, tuba', instruments: ['trumpet', 'trumpet', 'horn', 'trombone', 'tuba'] },
  { id: 'woodwind-quintet', name: 'Woodwind quintet', description: 'Flute, oboe, clarinet, horn, bassoon', instruments: ['flute', 'oboe', 'clarinet', 'horn', 'bassoon'] },
  { id: 'jazz-combo', name: 'Jazz combo', description: 'Sax, trumpet, piano, bass, drums', instruments: ['alto-sax', 'trumpet', 'piano', 'bass-guitar', 'drumset'] },
  { id: 'rock-band', name: 'Rock band', description: 'Voice, guitar, keys, bass, drums', instruments: ['voice', 'guitar', 'electric-piano', 'bass-guitar', 'drumset'] },
  { id: 'concert-band', name: 'Concert band', description: 'Compact wind band', instruments: ['flute', 'oboe', 'clarinet', 'clarinet', 'bassoon', 'alto-sax', 'tenor-sax', 'bari-sax', 'horn', 'trumpet', 'trumpet', 'trombone', 'euphonium', 'tuba', 'timpani', 'glockenspiel'] },
  { id: 'orchestra', name: 'Orchestra', description: 'Classical-size orchestra', instruments: ['flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'trumpet', 'timpani', 'violin', 'violin', 'viola', 'cello', 'contrabass'] },
];

/** Written key (fifths) for an instrument whose sound is transposed by `semi` semitones. */
export function writtenFifths(concertFifths: number, semi = 0): number {
  let offset = -(((semi * 7) % 12) + 12) % 12; // 0..-11
  if (offset < -6) offset += 12;
  let f = concertFifths + offset;
  if (f > 7) f -= 12;
  if (f < -7) f += 12;
  return f;
}

/** Map a General MIDI program to the closest CC0 sample set. */
export function sampleForProgram(program: number, percussion = false): string {
  if (percussion) return 'drum_kit';
  const table: [number, number, string][] = [
    [0, 3, 'piano'], [4, 5, 'electric_piano'], [6, 6, 'harpsichord'], [7, 7, 'clavinet'], [8, 8, 'glockenspiel'], [9, 9, 'glockenspiel'],
    [10, 10, 'kalimba'], [11, 11, 'vibraphone'], [12, 12, 'marimba'], [13, 13, 'xylophone'], [14, 14, 'tubular_bells'], [15, 15, 'dan_tranh'],
    [16, 23, 'organ'], [24, 31, 'harp'], [32, 39, 'upright_bass'], [40, 40, 'violin'], [41, 41, 'viola'], [42, 42, 'cello'],
    [43, 43, 'double_bass'], [44, 44, 'strings_spiccato'], [45, 45, 'violin_pizz'], [46, 46, 'harp'], [47, 47, 'cello_pizz'],
    [48, 51, 'violin'], [52, 55, 'ocarina'], [56, 56, 'trumpet'], [57, 57, 'trombone'], [58, 58, 'tuba'], [59, 59, 'trumpet'],
    [60, 60, 'french_horn'], [61, 63, 'trumpet'], [64, 67, 'tenor_sax'], [68, 68, 'oboe'], [69, 69, 'oboe'], [70, 70, 'bassoon'],
    [71, 71, 'clarinet'], [72, 72, 'piccolo'], [73, 73, 'flute'], [74, 74, 'recorder'], [75, 79, 'ocarina'], [80, 103, 'electric_piano'],
    [104, 111, 'strumstick'], [112, 127, 'marimba'],
  ];
  for (const [a, b, s] of table) if (program >= a && program <= b) return s;
  return 'piano';
}
