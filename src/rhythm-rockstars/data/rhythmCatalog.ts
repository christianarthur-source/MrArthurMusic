import { NoteType, RhythmUnit, RhythmPattern, LevelConfig } from '../types/rhythm';
import { Badge } from '../types/game';

// Factory helpers for RhythmUnits (duration in beats = 4/4 measure)
export const createUnit = {
  quarter: (): RhythmUnit => ({
    type: 'quarter',
    durationBeats: 1,
    name: 'Quarter Note',
    syllableKodaly: 'Ta',
    syllableCounting: '1',
    events: [{ offsetBeats: 0, durationBeats: 0.8, accent: true }]
  }),

  quarterRest: (): RhythmUnit => ({
    type: 'quarter_rest',
    durationBeats: 1,
    name: 'Quarter Rest',
    syllableKodaly: '(Shh)',
    syllableCounting: '(1)',
    events: [{ offsetBeats: 0, durationBeats: 1, isRest: true }]
  }),

  eighthPair: (): RhythmUnit => ({
    type: 'eighth_pair',
    durationBeats: 1,
    name: 'Two 8th Notes',
    syllableKodaly: 'Ti-Ti',
    syllableCounting: '1 &',
    events: [
      { offsetBeats: 0, durationBeats: 0.4, accent: true },
      { offsetBeats: 0.5, durationBeats: 0.4 }
    ]
  }),

  sixteenthQuad: (): RhythmUnit => ({
    type: 'sixteenth_quad',
    durationBeats: 1,
    name: 'Four 16th Notes',
    syllableKodaly: 'Tika-Tika',
    syllableCounting: '1 e & a',
    events: [
      { offsetBeats: 0, durationBeats: 0.2, accent: true },
      { offsetBeats: 0.25, durationBeats: 0.2 },
      { offsetBeats: 0.5, durationBeats: 0.2 },
      { offsetBeats: 0.75, durationBeats: 0.2 }
    ]
  }),

  brokenEighthTwoSixteenth: (): RhythmUnit => ({
    type: 'broken_eighth_two_sixteenth',
    durationBeats: 1,
    name: '8th + Two 16ths',
    syllableKodaly: 'Ti-Tika',
    syllableCounting: '1 & a',
    events: [
      { offsetBeats: 0, durationBeats: 0.4, accent: true },
      { offsetBeats: 0.5, durationBeats: 0.2 },
      { offsetBeats: 0.75, durationBeats: 0.2 }
    ]
  }),

  brokenTwoSixteenthEighth: (): RhythmUnit => ({
    type: 'broken_two_sixteenth_eighth',
    durationBeats: 1,
    name: 'Two 16ths + 8th',
    syllableKodaly: 'Tika-Ti',
    syllableCounting: '1 e &',
    events: [
      { offsetBeats: 0, durationBeats: 0.2, accent: true },
      { offsetBeats: 0.25, durationBeats: 0.2 },
      { offsetBeats: 0.5, durationBeats: 0.4 }
    ]
  }),

  brokenDottedSixteenth: (): RhythmUnit => ({
    type: 'broken_dotted_sixteenth',
    durationBeats: 1,
    name: 'Dotted 8th + 16th',
    syllableKodaly: 'Tim-Ka',
    syllableCounting: '1 .. a',
    events: [
      { offsetBeats: 0, durationBeats: 0.65, accent: true },
      { offsetBeats: 0.75, durationBeats: 0.2 }
    ]
  }),

  triplet: (): RhythmUnit => ({
    type: 'triplet',
    durationBeats: 1,
    name: '8th-Note Triplet',
    syllableKodaly: 'Tri-Po-Let',
    syllableCounting: '1 la li',
    events: [
      { offsetBeats: 0, durationBeats: 0.28, accent: true },
      { offsetBeats: 0.333, durationBeats: 0.28 },
      { offsetBeats: 0.666, durationBeats: 0.28 }
    ]
  }),

  half: (): RhythmUnit => ({
    type: 'half',
    durationBeats: 2,
    name: 'Half Note',
    syllableKodaly: 'Ta-Ah',
    syllableCounting: '1 - 2',
    events: [{ offsetBeats: 0, durationBeats: 1.8, accent: true }]
  }),

  halfRest: (): RhythmUnit => ({
    type: 'half_rest',
    durationBeats: 2,
    name: 'Half Rest',
    syllableKodaly: '(Shh-Shh)',
    syllableCounting: '(1 - 2)',
    events: [{ offsetBeats: 0, durationBeats: 2, isRest: true }]
  }),

  whole: (): RhythmUnit => ({
    type: 'whole',
    durationBeats: 4,
    name: 'Whole Note',
    syllableKodaly: 'Ta-Ah-Ah-Ah',
    syllableCounting: '1 - 2 - 3 - 4',
    events: [{ offsetBeats: 0, durationBeats: 3.8, accent: true }]
  }),

  syncopationBeat: (): RhythmUnit => ({
    type: 'syncopation_beat',
    durationBeats: 2,
    name: 'Syn-co-pa (8th-Quarter-8th)',
    syllableKodaly: 'Syn-Co-Pa',
    syllableCounting: '1 & (2) &',
    events: [
      { offsetBeats: 0, durationBeats: 0.4 },
      { offsetBeats: 0.5, durationBeats: 0.9, accent: true },
      { offsetBeats: 1.5, durationBeats: 0.4 }
    ]
  })
};

// Patterns by level
export const LEVELS_CONFIG: LevelConfig[] = [
  {
    levelNumber: 1,
    title: 'Garage Band Rookie',
    stageName: 'Garage Jam Stage',
    difficultyLabel: 'Easy · Quarter Notes & Rests',
    basePointsPerQuestion: 100,
    description: 'Easy starter stage: Quarter notes (Ta), Half notes (Ta-ah), and Quarter rests (Shh)!',
    unlockedByDefault: true,
    minPointsToUnlock: 0,
    badgeId: 'quarter_master',
    badgeTitle: 'Quarter Note King',
    badgeIcon: '🎸',
    rhythmTypesIntroduced: ['Quarter Notes (Ta)', 'Half Notes (Ta-ah)', 'Quarter Rests (Shh)'],
    patterns: [
      {
        id: 'l1_p1',
        name: 'The Four-on-the-Floor Beat',
        level: 1,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.quarter(), createUnit.quarter(), createUnit.quarter()],
        difficulty: 'Rookie',
        tags: ['Quarter Notes']
      },
      {
        id: 'l1_p2',
        name: 'Half Step Rocker',
        level: 1,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.half(), createUnit.quarter(), createUnit.quarter()],
        difficulty: 'Rookie',
        tags: ['Half Note', 'Quarter Notes']
      },
      {
        id: 'l1_p3',
        name: 'Silent Beat Surprise',
        level: 1,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.quarterRest(), createUnit.quarter(), createUnit.quarterRest()],
        difficulty: 'Rookie',
        tags: ['Quarter Rest']
      },
      {
        id: 'l1_p4',
        name: 'Twin Halves Groove',
        level: 1,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.half(), createUnit.half()],
        difficulty: 'Rookie',
        tags: ['Half Notes']
      },
      {
        id: 'l1_p5',
        name: 'Pounding Pulse',
        level: 1,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.quarter(), createUnit.quarterRest(), createUnit.quarter()],
        difficulty: 'Rookie',
        tags: ['Quarter Rest', 'Quarter Notes']
      }
    ]
  },
  {
    levelNumber: 2,
    title: 'Club Opener',
    stageName: 'Downtown Club Stage',
    difficultyLabel: 'Medium · 8th Notes (Ti-Ti)',
    basePointsPerQuestion: 150,
    description: 'Double the speed! Meet 8th notes (Ti-Ti) and mix with Quarter beats.',
    unlockedByDefault: true,
    minPointsToUnlock: 200,
    badgeId: 'eighth_explorer',
    badgeTitle: 'Eighth Note Ace',
    badgeIcon: '⚡',
    rhythmTypesIntroduced: ['8th Note Pairs (Ti-Ti)', 'Quarter Combinations'],
    patterns: [
      {
        id: 'l2_p1',
        name: 'Classic Rock Drive',
        level: 2,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.eighthPair(), createUnit.quarter(), createUnit.eighthPair()],
        difficulty: 'Junior',
        tags: ['8th Notes', 'Quarter Notes']
      },
      {
        id: 'l2_p2',
        name: 'Double Time Strum',
        level: 2,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.eighthPair(), createUnit.eighthPair(), createUnit.quarter(), createUnit.quarter()],
        difficulty: 'Junior',
        tags: ['8th Notes']
      },
      {
        id: 'l2_p3',
        name: 'The Rested Eighth',
        level: 2,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.eighthPair(), createUnit.quarterRest(), createUnit.eighthPair(), createUnit.quarter()],
        difficulty: 'Junior',
        tags: ['8th Notes', 'Quarter Rest']
      },
      {
        id: 'l2_p4',
        name: 'Running 8ths Sprint',
        level: 2,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.eighthPair(), createUnit.eighthPair(), createUnit.eighthPair(), createUnit.quarter()],
        difficulty: 'Junior',
        tags: ['8th Notes']
      },
      {
        id: 'l2_p5',
        name: 'Half Beat Anchor',
        level: 2,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.eighthPair(), createUnit.eighthPair(), createUnit.half()],
        difficulty: 'Junior',
        tags: ['8th Notes', 'Half Note']
      }
    ]
  },
  {
    levelNumber: 3,
    title: 'Festival Headliner',
    stageName: 'Open-Air Festival Stage',
    difficultyLabel: 'Advanced · 16th Notes (Tika-Tika)',
    basePointsPerQuestion: 220,
    description: 'Speed burst! Four 16th notes per beat (Tika-Tika) kick into high gear.',
    unlockedByDefault: true,
    minPointsToUnlock: 500,
    badgeId: 'sixteenth_speedster',
    badgeTitle: 'Sixteenth Speedster',
    badgeIcon: '🔥',
    rhythmTypesIntroduced: ['16th Note Quads (Tika-Tika)', 'High Speed Combos'],
    patterns: [
      {
        id: 'l3_p1',
        name: 'Drum Fill Spark',
        level: 3,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.sixteenthQuad(), createUnit.quarter(), createUnit.eighthPair()],
        difficulty: 'Pro',
        tags: ['16th Notes', 'Quarter Notes']
      },
      {
        id: 'l3_p2',
        name: 'Tika-Tika Blitz',
        level: 3,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.sixteenthQuad(), createUnit.eighthPair(), createUnit.quarter(), createUnit.quarter()],
        difficulty: 'Pro',
        tags: ['16th Notes', '8th Notes']
      },
      {
        id: 'l3_p3',
        name: 'Festival Roll',
        level: 3,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.eighthPair(), createUnit.sixteenthQuad(), createUnit.sixteenthQuad(), createUnit.quarter()],
        difficulty: 'Pro',
        tags: ['16th Notes']
      },
      {
        id: 'l3_p4',
        name: 'Power Chord Cadence',
        level: 3,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.sixteenthQuad(), createUnit.quarterRest(), createUnit.sixteenthQuad(), createUnit.half()],
        difficulty: 'Pro',
        tags: ['16th Notes', 'Quarter Rest', 'Half Note']
      },
      {
        id: 'l3_p5',
        name: 'Rock Anthem Run',
        level: 3,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.sixteenthQuad(), createUnit.eighthPair(), createUnit.quarter()],
        difficulty: 'Pro',
        tags: ['16th Notes', '8th Notes']
      }
    ]
  },
  {
    levelNumber: 4,
    title: 'Arena Shredder',
    stageName: 'Colosseum Arena',
    difficultyLabel: 'Shredder · Broken 16th Notes (Ti-Tika)',
    basePointsPerQuestion: 320,
    description: 'Broken 16th notes! Master Ti-Tika (8th + two 16ths), Tika-Ti, and Dotted rhythms.',
    unlockedByDefault: true,
    minPointsToUnlock: 900,
    badgeId: 'broken_beat_boss',
    badgeTitle: 'Broken Beat Boss',
    badgeIcon: '🥁',
    rhythmTypesIntroduced: ['Ti-Tika (1 8th + 2 16ths)', 'Tika-Ti (2 16ths + 1 8th)', 'Dotted 8th-16th (Tim-Ka)'],
    patterns: [
      {
        id: 'l4_p1',
        name: 'The Gallop (Ti-Tika)',
        level: 4,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenEighthTwoSixteenth(), createUnit.quarter(), createUnit.brokenEighthTwoSixteenth(), createUnit.quarter()],
        difficulty: 'Shredder',
        tags: ['Ti-Tika', 'Broken 16ths']
      },
      {
        id: 'l4_p2',
        name: 'The Snap (Tika-Ti)',
        level: 4,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenTwoSixteenthEighth(), createUnit.eighthPair(), createUnit.brokenTwoSixteenthEighth(), createUnit.quarter()],
        difficulty: 'Shredder',
        tags: ['Tika-Ti', 'Broken 16ths']
      },
      {
        id: 'l4_p3',
        name: 'The March (Tim-Ka)',
        level: 4,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenDottedSixteenth(), createUnit.quarter(), createUnit.brokenDottedSixteenth(), createUnit.quarter()],
        difficulty: 'Shredder',
        tags: ['Dotted 8th-16th', 'Broken 16ths']
      },
      {
        id: 'l4_p4',
        name: 'Broken Rhythm Fusion',
        level: 4,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenEighthTwoSixteenth(), createUnit.brokenTwoSixteenthEighth(), createUnit.quarter(), createUnit.eighthPair()],
        difficulty: 'Shredder',
        tags: ['Broken 16ths']
      },
      {
        id: 'l4_p5',
        name: 'Arena Drum Solos',
        level: 4,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenTwoSixteenthEighth(), createUnit.brokenDottedSixteenth(), createUnit.sixteenthQuad(), createUnit.quarter()],
        difficulty: 'Shredder',
        tags: ['Broken 16ths', '16th Notes']
      }
    ]
  },
  {
    levelNumber: 5,
    title: 'World Tour Legend',
    stageName: 'Global Stadium Stage',
    difficultyLabel: 'Virtuoso · Triplets & Syncopation',
    basePointsPerQuestion: 420,
    description: 'Swing into 8th-note Triplets (Tri-Po-Let) and groovy Syncopations (Syn-Co-Pa)!',
    unlockedByDefault: true,
    minPointsToUnlock: 1400,
    badgeId: 'triplet_titan',
    badgeTitle: 'Triplet Titan',
    badgeIcon: '🌟',
    rhythmTypesIntroduced: ['Eighth-Note Triplets (Tri-Po-Let)', 'Syncopated Off-Beats (Syn-Co-Pa)'],
    patterns: [
      {
        id: 'l5_p1',
        name: 'Blues Rock Triplet',
        level: 5,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.triplet(), createUnit.quarter(), createUnit.triplet(), createUnit.quarter()],
        difficulty: 'Virtuoso',
        tags: ['Triplets', 'Quarter Notes']
      },
      {
        id: 'l5_p2',
        name: 'Rolling Thunder Triplets',
        level: 5,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.triplet(), createUnit.triplet(), createUnit.eighthPair(), createUnit.quarter()],
        difficulty: 'Virtuoso',
        tags: ['Triplets', '8th Notes']
      },
      {
        id: 'l5_p3',
        name: 'The Funky Syncopation',
        level: 5,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.syncopationBeat(), createUnit.quarter(), createUnit.quarter()],
        difficulty: 'Virtuoso',
        tags: ['Syncopation']
      },
      {
        id: 'l5_p4',
        name: 'Syncopated Echo',
        level: 5,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.quarter(), createUnit.syncopationBeat(), createUnit.quarter()],
        difficulty: 'Virtuoso',
        tags: ['Syncopation']
      },
      {
        id: 'l5_p5',
        name: 'Stadium Triplet Jam',
        level: 5,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.triplet(), createUnit.brokenEighthTwoSixteenth(), createUnit.triplet(), createUnit.half()],
        difficulty: 'Virtuoso',
        tags: ['Triplets', 'Broken 16ths']
      }
    ]
  },
  {
    levelNumber: 6,
    title: 'Rhythm Maestro',
    stageName: 'Hall of Fame Superstage',
    difficultyLabel: 'Legend · Broken 16ths, Triplets & Medleys',
    basePointsPerQuestion: 550,
    description: 'Ultimate mastery! Mixed Broken 16th notes, Triplets, rapid syncopations, and speed grooves.',
    unlockedByDefault: true,
    minPointsToUnlock: 2000,
    badgeId: 'rhythm_maestro',
    badgeTitle: 'Hall of Fame Maestro',
    badgeIcon: '👑',
    rhythmTypesIntroduced: ['Master Rhythm Medleys', 'Broken 16ths & Triplets Combined'],
    patterns: [
      {
        id: 'l6_p1',
        name: 'The Grand Master Groove',
        level: 6,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.sixteenthQuad(), createUnit.triplet(), createUnit.brokenTwoSixteenthEighth(), createUnit.quarter()],
        difficulty: 'Legend',
        tags: ['16ths', 'Triplets', 'Broken 16ths']
      },
      {
        id: 'l6_p2',
        name: 'Syncopated Sprint',
        level: 6,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.syncopationBeat(), createUnit.sixteenthQuad(), createUnit.quarter()],
        difficulty: 'Legend',
        tags: ['Syncopation', '16ths']
      },
      {
        id: 'l6_p3',
        name: 'Broken Triplet Contrast',
        level: 6,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenDottedSixteenth(), createUnit.triplet(), createUnit.brokenEighthTwoSixteenth(), createUnit.quarterRest()],
        difficulty: 'Legend',
        tags: ['Dotted', 'Triplets', 'Broken 16ths']
      },
      {
        id: 'l6_p4',
        name: 'Polyrhythm Fireworks',
        level: 6,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.triplet(), createUnit.sixteenthQuad(), createUnit.triplet(), createUnit.quarter()],
        difficulty: 'Legend',
        tags: ['Triplets', '16ths']
      },
      {
        id: 'l6_p5',
        name: 'The Encore Finale',
        level: 6,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenTwoSixteenthEighth(), createUnit.sixteenthQuad(), createUnit.syncopationBeat()],
        difficulty: 'Legend',
        tags: ['Master Finale']
      }
    ]
  },
  {
    levelNumber: 7,
    title: 'Secret Rockstar Overlord',
    stageName: 'Secret Underground Arena',
    difficultyLabel: 'Secret · Ultra Hard Polyrhythms & Speed Medleys',
    basePointsPerQuestion: 750,
    description: 'SECRET LEVEL 7! High-speed broken 16ths, triplets, syncopations, and mind-bending polyrhythms (+750 PTS)!',
    unlockedByDefault: false,
    minPointsToUnlock: 0,
    badgeId: 'secret_rockstar_master',
    badgeTitle: 'Secret Rockstar Overlord',
    badgeIcon: '⚡',
    rhythmTypesIntroduced: ['Ultra Polyrhythms', 'Complex Syncopation Medleys', 'Secret Master Speed'],
    patterns: [
      {
        id: 'l7_p1',
        name: 'Polyrhythmic Storm',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.sixteenthQuad(), createUnit.triplet(), createUnit.syncopationBeat(), createUnit.brokenEighthTwoSixteenth()],
        difficulty: 'Secret Rockstar',
        tags: ['16ths', 'Triplets', 'Syncopation']
      },
      {
        id: 'l7_p2',
        name: 'Syncopated Shredder',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenDottedSixteenth(), createUnit.syncopationBeat(), createUnit.triplet(), createUnit.sixteenthQuad()],
        difficulty: 'Secret Rockstar',
        tags: ['Dotted', 'Syncopation', 'Triplets']
      },
      {
        id: 'l7_p3',
        name: 'Hall of Fame Thunder',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.triplet(), createUnit.brokenTwoSixteenthEighth(), createUnit.sixteenthQuad(), createUnit.triplet()],
        difficulty: 'Secret Rockstar',
        tags: ['Triplets', 'Broken 16ths']
      },
      {
        id: 'l7_p4',
        name: 'Speed Demon Rush',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenEighthTwoSixteenth(), createUnit.sixteenthQuad(), createUnit.brokenDottedSixteenth(), createUnit.syncopationBeat()],
        difficulty: 'Secret Rockstar',
        tags: ['Broken 16ths', 'Syncopation']
      },
      {
        id: 'l7_p5',
        name: 'The Secret Rockstar Medley',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.syncopationBeat(), createUnit.triplet(), createUnit.sixteenthQuad(), createUnit.brokenTwoSixteenthEighth()],
        difficulty: 'Secret Rockstar',
        tags: ['Master Secret']
      },
      {
        id: 'l7_p6',
        name: 'Ultimate Rhythm Gauntlet',
        level: 7,
        timeSignature: '4/4',
        totalBeats: 4,
        units: [createUnit.brokenDottedSixteenth(), createUnit.brokenEighthTwoSixteenth(), createUnit.triplet(), createUnit.sixteenthQuad()],
        difficulty: 'Secret Rockstar',
        tags: ['Secret Finalist']
      }
    ]
  }
];

/**
 * Question counts scaling by 20% per level starting at 10 for Level 1 up to Secret Level 7:
 * Level 1: 10
 * Level 2: 12 (10 * 1.2)
 * Level 3: 14 (12 * 1.2 = 14.4 -> 14)
 * Level 4: 17 (14.4 * 1.2 = 17.28 -> 17)
 * Level 5: 21 (17.28 * 1.2 = 20.736 -> 21)
 * Level 6: 25 (20.736 * 1.2 = 24.88 -> 25)
 * Level 7: 30 (24.88 * 1.2 = 29.86 -> 30)
 */
export const LEVEL_QUESTION_COUNTS: Record<number, number> = {
  1: 10,
  2: 12,
  3: 14,
  4: 17,
  5: 21,
  6: 25,
  7: 30,
};

export const getQuestionCountForLevel = (levelNumber: number): number => {
  return LEVEL_QUESTION_COUNTS[levelNumber] || 10;
};

export const ALL_BADGES: Badge[] = [
  {
    id: 'quarter_master',
    title: 'Quarter Note King',
    description: 'Master Level 1 rhythms (Ta and Ta-ah)',
    icon: '🎸',
    category: 'rhythm'
  },
  {
    id: 'eighth_explorer',
    title: 'Eighth Note Ace',
    description: 'Master Level 2 rhythms (Ti-Ti)',
    icon: '⚡',
    category: 'rhythm'
  },
  {
    id: 'sixteenth_speedster',
    title: 'Sixteenth Speedster',
    description: 'Master Level 3 rhythms (Tika-Tika)',
    icon: '🔥',
    category: 'rhythm'
  },
  {
    id: 'broken_beat_boss',
    title: 'Broken Beat Boss',
    description: 'Master Level 4 broken 16th rhythms',
    icon: '🥁',
    category: 'rhythm'
  },
  {
    id: 'triplet_titan',
    title: 'Triplet Titan',
    description: 'Master Level 5 triplets and syncopation',
    icon: '🌟',
    category: 'rhythm'
  },
  {
    id: 'rhythm_maestro',
    title: 'Hall of Fame Maestro',
    description: 'Conquer Level 6 Master Medleys',
    icon: '👑',
    category: 'rhythm'
  },
  {
    id: 'secret_rockstar_master',
    title: 'Secret Rockstar Overlord',
    description: 'Unlock and conquer the Secret Level 7',
    icon: '⚡',
    category: 'rhythm'
  },
  {
    id: 'streak_3',
    title: 'Hot Hands (3x Streak)',
    description: 'Answer 3 rhythm questions correctly in a row',
    icon: '🎯',
    category: 'streak'
  },
  {
    id: 'streak_5',
    title: 'Crowd Roar (5x Streak)',
    description: 'Answer 5 rhythm questions in a row without a mistake',
    icon: '🚀',
    category: 'streak'
  },
  {
    id: 'streak_10',
    title: 'Rockstar God (10x Streak)',
    description: 'Achieve a legendary 10-question streak',
    icon: '🏆',
    category: 'streak'
  },
  {
    id: 'perfect_round',
    title: 'Golden Ear',
    description: 'Complete a level with 100% accuracy',
    icon: '🥇',
    category: 'accuracy'
  }
];
