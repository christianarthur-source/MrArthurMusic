// Instrument presets (moved unchanged from MusicTuner.tsx).


export interface TuningString {
  id: string;
  name: string;
  note: string;
  octave: number;
  midi: number;
  targetFreq: number;
}

export interface InstrumentPreset {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  strings: TuningString[];
}

export function calculateTargetFreq(midi: number, a4Ref: number): number {
  return a4Ref * Math.pow(2, (midi - 69) / 12);
}

function createString(
  id: string,
  name: string,
  note: string,
  octave: number,
  midi: number,
  a4Ref: number
): TuningString {
  return {
    id,
    name,
    note,
    octave,
    midi,
    targetFreq: calculateTargetFreq(midi, a4Ref),
  };
}

export function getInstrumentPresets(a4Ref: number): InstrumentPreset[] {
  return [
    {
      id: 'chromatic',
      name: 'Chromatic Tuner',
      category: 'All Instruments',
      emoji: '🎵',
      description: 'Tunes any instrument or singing voice automatically',
      strings: [],
    },
    {
      id: 'guitar-standard',
      name: 'Guitar (Standard)',
      category: 'Guitars',
      emoji: '🎸',
      description: 'Standard 6-string guitar tuning (E A D G B E)',
      strings: [
        createString('g6', '6th String', 'E', 2, 40, a4Ref),
        createString('g5', '5th String', 'A', 2, 45, a4Ref),
        createString('g4', '4th String', 'D', 3, 50, a4Ref),
        createString('g3', '3rd String', 'G', 3, 55, a4Ref),
        createString('g2', '2nd String', 'B', 3, 59, a4Ref),
        createString('g1', '1st String', 'E', 4, 64, a4Ref),
      ],
    },
    {
      id: 'guitar-drop-d',
      name: 'Guitar (Drop D)',
      category: 'Guitars',
      emoji: '⚡',
      description: 'Drop D heavy rock tuning (D A D G B E)',
      strings: [
        createString('g6d', '6th String', 'D', 2, 38, a4Ref),
        createString('g5', '5th String', 'A', 2, 45, a4Ref),
        createString('g4', '4th String', 'D', 3, 50, a4Ref),
        createString('g3', '3rd String', 'G', 3, 55, a4Ref),
        createString('g2', '2nd String', 'B', 3, 59, a4Ref),
        createString('g1', '1st String', 'E', 4, 64, a4Ref),
      ],
    },
    {
      id: 'ukulele',
      name: 'Ukulele (Standard C)',
      category: 'Folk & Plucked',
      emoji: '🌺',
      description: 'Standard Hawaiian soprano/concert ukulele (G C E A)',
      strings: [
        createString('u4', '4th String', 'G', 4, 67, a4Ref),
        createString('u3', '3rd String', 'C', 4, 60, a4Ref),
        createString('u2', '2nd String', 'E', 4, 64, a4Ref),
        createString('u1', '1st String', 'A', 4, 69, a4Ref),
      ],
    },
    {
      id: 'violin',
      name: 'Violin',
      category: 'Orchestral Strings',
      emoji: '🎻',
      description: 'Standard violin tuning in perfect fifths (G D A E)',
      strings: [
        createString('v4', '4th String (G)', 'G', 3, 55, a4Ref),
        createString('v3', '3rd String (D)', 'D', 4, 62, a4Ref),
        createString('v2', '2nd String (A)', 'A', 4, 69, a4Ref),
        createString('v1', '1st String (E)', 'E', 5, 76, a4Ref),
      ],
    },
    {
      id: 'viola',
      name: 'Viola',
      category: 'Orchestral Strings',
      emoji: '🎼',
      description: 'Standard viola tuning in fifths (C G D A)',
      strings: [
        createString('va4', '4th String (C)', 'C', 3, 48, a4Ref),
        createString('va3', '3rd String (G)', 'G', 3, 55, a4Ref),
        createString('va2', '2nd String (D)', 'D', 4, 62, a4Ref),
        createString('va1', '1st String (A)', 'A', 4, 69, a4Ref),
      ],
    },
    {
      id: 'cello',
      name: 'Cello',
      category: 'Orchestral Strings',
      emoji: '🎻',
      description: 'Deep orchestral cello tuning (C G D A)',
      strings: [
        createString('vc4', '4th String (C)', 'C', 2, 36, a4Ref),
        createString('vc3', '3rd String (G)', 'G', 2, 43, a4Ref),
        createString('vc2', '2nd String (D)', 'D', 3, 50, a4Ref),
        createString('vc1', '1st String (A)', 'A', 3, 57, a4Ref),
      ],
    },
    {
      id: 'bass-guitar',
      name: 'Bass (4-String)',
      category: 'Guitars',
      emoji: '🎸',
      description: 'Standard electric & upright bass (E A D G)',
      strings: [
        createString('b4', '4th String (E)', 'E', 1, 28, a4Ref),
        createString('b3', '3rd String (A)', 'A', 1, 33, a4Ref),
        createString('b2', '2nd String (D)', 'D', 2, 38, a4Ref),
        createString('b1', '1st String (G)', 'G', 2, 43, a4Ref),
      ],
    },
  ];
}
