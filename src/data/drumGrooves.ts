import { Measure, NoteItem, Pitch } from '../types/music';
import { DrumKitType } from '../audio/acousticSamples';

export type DrumStyle = 'Rock' | 'Pop' | 'Indie' | 'Jazz' | 'World' | 'Latin' | 'African' | 'Folk';

export type DrumSound =
  | 'kick'
  | 'snare'
  | 'hihat_closed'
  | 'hihat_open'
  | 'ride'
  | 'crash'
  | 'tom_high'
  | 'tom_low'
  | 'tom_floor'
  | 'rimshot'
  | 'shaker'
  | 'cowbell'
  | 'conga_open'
  | 'conga_slap';

export interface DrumStepEvent {
  step: number; // 0 to 15 for 16th notes in 4/4 bar (or 0 to 11 in 3/4 bar)
  sounds: DrumSound[];
}

export interface DrumGroove {
  id: string;
  name: string;
  style: DrumStyle;
  tempo: number;
  timeSignature: [number, number];
  description: string;
  badge: string;
  kitType: DrumKitType;
  measures: Measure[];
  previewPattern: DrumStepEvent[];
}

/**
 * Standard staff note mapping for drum sounds on a percussion staff:
 * F4 / C4 = Bass Drum Kick
 * C5 = Snare Drum
 * G5 = Closed Hi-Hat
 * A5 = Open Hi-Hat
 * B5 = Crash Cymbal
 * F5 = Ride Cymbal
 * E5 = Rimshot / Handclap
 * D5 = High Tom
 * A4 = Low Tom / Floor Tom
 * B4 = Percussion Shaker
 * D4 = Cowbell
 * E4 = Conga Open Tone
 * G4 = Conga Slap
 */
export const DRUM_SOUND_PITCH_MAP: Record<DrumSound, Pitch> = {
  kick: { step: 'F', octave: 4 },
  snare: { step: 'C', octave: 5 },
  hihat_closed: { step: 'G', octave: 5 },
  hihat_open: { step: 'A', octave: 5 },
  crash: { step: 'B', octave: 5 },
  ride: { step: 'F', octave: 5 },
  rimshot: { step: 'E', octave: 5 },
  tom_high: { step: 'D', octave: 5 },
  tom_low: { step: 'A', octave: 4 },
  tom_floor: { step: 'F', octave: 4 },
  shaker: { step: 'B', octave: 4 },
  cowbell: { step: 'D', octave: 4 },
  conga_open: { step: 'E', octave: 4 },
  conga_slap: { step: 'G', octave: 4 },
};

/**
 * Returns standard staff pitch for a given DrumSound (e.g. kick -> F4, snare -> C5)
 */
export function getDrumPitchForSound(sound: DrumSound): Pitch {
  return DRUM_SOUND_PITCH_MAP[sound] || { step: 'C', octave: 5 };
}

/**
 * Returns a standard DrumSound for a given musical staff pitch
 */
export function getDrumSoundForPitch(pitch: Pitch): DrumSound {
  const step = pitch?.step || 'F';
  const octave = pitch?.octave || 4;
  if (octave >= 5) {
    if (step === 'G') return 'hihat_closed';
    if (step === 'A') return 'hihat_open';
    if (step === 'B') return 'crash';
    if (step === 'F') return 'ride';
    if (step === 'E') return 'rimshot';
    if (step === 'D') return 'tom_high';
    return 'snare';
  } else {
    if (step === 'F' || step === 'C') return 'kick';
    if (step === 'A') return 'tom_low';
    if (step === 'B') return 'shaker';
    if (step === 'D') return 'cowbell';
    if (step === 'E') return 'conga_open';
    if (step === 'G') return 'conga_slap';
    return 'kick';
  }
}

/**
 * Generates Measure objects directly from bar patterns so the sheet music playback
 * and notation match the audio preview 100% identically with multi-note chord voicings.
 */
export function patternsToMeasures(
  barPatterns: DrumStepEvent[][],
  timeSignature: [number, number] = [4, 4],
  idPrefix: string = 'dr'
): Measure[] {
  const beatsPerMeasure = timeSignature[0];
  const totalStepsPerMeasure = beatsPerMeasure === 3 ? 12 : 16;

  return barPatterns.map((pattern, bIdx) => {
    const stepMap = new Map<number, DrumSound[]>();
    pattern.forEach((ev) => {
      if (ev.sounds.length > 0 && ev.step < totalStepsPerMeasure) {
        stepMap.set(ev.step, ev.sounds);
      }
    });

    const has16ths = pattern.some((ev) => ev.step % 2 !== 0 && ev.step < totalStepsPerMeasure);
    const stepIncrement = has16ths ? 1 : 2;
    const duration = has16ths ? (0.0625 as const) : (0.125 as const);

    const items: NoteItem[] = [];
    for (let s = 0; s < totalStepsPerMeasure; s += stepIncrement) {
      const sounds = stepMap.get(s);
      if (!sounds || sounds.length === 0) {
        items.push({
          id: `dr_${idPrefix}_${bIdx}_r_${s}`,
          type: 'rest',
          duration,
        });
      } else {
        const pitches: Pitch[] = sounds.map((snd) => DRUM_SOUND_PITCH_MAP[snd] || ({ step: 'F', octave: 4 } as Pitch));
        items.push({
          id: `dr_${idPrefix}_${bIdx}_n_${s}`,
          type: 'note',
          pitch: pitches[0],
          pitches: pitches.length > 1 ? pitches : undefined,
          duration,
        });
      }
    }

    return {
      id: `m_${idPrefix}_${bIdx + 1}`,
      items,
    };
  });
}

// ============================================================================
// DRUM PATTERN DEFINITIONS (100% PREVIEW & SCORE ALIGNMENT)
// ============================================================================

// 1. Classic 8-Beat Rock
const rockClassicPattern1: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick', 'hihat_closed'] },
  { step: 10, sounds: ['hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] },
  { step: 14, sounds: ['hihat_closed'] },
];

const rockClassicPattern2: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick'] },
  { step: 10, sounds: ['kick', 'hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] },
  { step: 14, sounds: ['hihat_open'] },
];

// 2. Hard Rock Driving Beat
const rockHardPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'ride', 'crash'] },
  { step: 2, sounds: ['ride'] },
  { step: 4, sounds: ['kick', 'snare', 'ride'] },
  { step: 6, sounds: ['ride'] },
  { step: 8, sounds: ['kick', 'ride'] },
  { step: 10, sounds: ['ride'] },
  { step: 12, sounds: ['kick', 'snare', 'ride'] },
  { step: 14, sounds: ['ride', 'hihat_open'] },
];

// 3. Fast Punk Rock (Straight 8ths)
const rockPunkPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_open', 'crash'] },
  { step: 2, sounds: ['hihat_open'] },
  { step: 4, sounds: ['snare', 'hihat_open'] },
  { step: 6, sounds: ['kick', 'hihat_open'] },
  { step: 8, sounds: ['kick', 'hihat_open'] },
  { step: 10, sounds: ['hihat_open'] },
  { step: 12, sounds: ['snare', 'hihat_open'] },
  { step: 14, sounds: ['kick', 'hihat_open'] },
];

// 4. 90s Grunge & Alternative Rock
const rockGrungePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 6, sounds: ['kick', 'hihat_closed'] },
  { step: 8, sounds: ['hihat_closed'] },
  { step: 10, sounds: ['kick', 'hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_open'] },
  { step: 14, sounds: ['tom_high'] },
];

// 5. Four-on-the-Floor Pop Dance
const popFourOnFloorPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_open'] },
  { step: 4, sounds: ['kick', 'snare', 'hihat_closed'] },
  { step: 6, sounds: ['hihat_open'] },
  { step: 8, sounds: ['kick', 'hihat_closed'] },
  { step: 10, sounds: ['hihat_open'] },
  { step: 12, sounds: ['kick', 'snare', 'hihat_closed'] },
  { step: 14, sounds: ['hihat_open'] },
];

// 6. Modern Trap & Hip-Hop 808
const popTrapPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['hihat_closed'] },
  { step: 6, sounds: ['kick', 'hihat_closed'] },
  { step: 8, sounds: ['snare', 'hihat_closed'] },
  { step: 10, sounds: ['hihat_closed'] },
  { step: 12, sounds: ['hihat_closed'] },
  { step: 13, sounds: ['hihat_closed'] },
  { step: 14, sounds: ['hihat_closed'] },
  { step: 15, sounds: ['hihat_closed'] },
];

// 7. 80s Retro Synthwave / Synthpop
const popSynthwavePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'rimshot', 'hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick', 'hihat_closed'] },
  { step: 10, sounds: ['kick', 'hihat_closed'] },
  { step: 12, sounds: ['snare', 'rimshot', 'hihat_closed'] },
  { step: 14, sounds: ['hihat_closed'] },
];

// 8. Pop & R&B Slow Groove (6/8 feel represented across 4/4 triplet pulses)
const popSlowJamPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'ride'] },
  { step: 2, sounds: ['ride'] },
  { step: 4, sounds: ['ride'] },
  { step: 6, sounds: ['snare', 'ride'] },
  { step: 8, sounds: ['ride'] },
  { step: 10, sounds: ['kick', 'ride'] },
  { step: 12, sounds: ['snare', 'ride'] },
  { step: 14, sounds: ['ride', 'hihat_open'] },
];

// 9. Acoustic Stomp & Handclap (Folk / Indie Roots) - Fully synchronized!
const indieFolkStompPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'shaker'] },
  { step: 2, sounds: ['shaker'] },
  { step: 4, sounds: ['rimshot', 'snare', 'shaker'] },
  { step: 6, sounds: ['shaker'] },
  { step: 8, sounds: ['kick', 'shaker'] },
  { step: 10, sounds: ['shaker'] },
  { step: 12, sounds: ['rimshot', 'snare', 'shaker'] },
  { step: 14, sounds: ['shaker'] },
];

// 10. Indie Pop Dance Beat
const indiePopDiscoPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'shaker'] },
  { step: 2, sounds: ['hihat_open', 'shaker'] },
  { step: 4, sounds: ['kick', 'snare', 'shaker'] },
  { step: 6, sounds: ['hihat_open', 'shaker'] },
  { step: 8, sounds: ['kick', 'shaker'] },
  { step: 10, sounds: ['hihat_open', 'shaker'] },
  { step: 12, sounds: ['kick', 'snare', 'shaker'] },
  { step: 14, sounds: ['hihat_open', 'shaker'] },
];

// 11. Indie Garage Rock 16ths
const indieGaragePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 3, sounds: ['kick'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick', 'hihat_closed'] },
  { step: 10, sounds: ['hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] },
  { step: 14, sounds: ['tom_high', 'hihat_open'] },
];

// 12. Lo-Fi Indie Chill Hop
const indieChillHopPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'shaker'] },
  { step: 2, sounds: ['hihat_closed', 'shaker'] },
  { step: 4, sounds: ['rimshot', 'shaker'] },
  { step: 6, sounds: ['kick', 'shaker'] },
  { step: 8, sounds: ['shaker'] },
  { step: 10, sounds: ['kick', 'shaker'] },
  { step: 12, sounds: ['rimshot', 'shaker'] },
  { step: 14, sounds: ['hihat_open', 'shaker'] },
];

// 13. Traditional Jazz Swing
const jazzSwingPattern1: DrumStepEvent[] = [
  { step: 0, sounds: ['ride', 'kick'] },
  { step: 4, sounds: ['ride', 'hihat_closed'] },
  { step: 6, sounds: ['ride'] },
  { step: 8, sounds: ['ride'] },
  { step: 12, sounds: ['ride', 'hihat_closed'] },
  { step: 14, sounds: ['ride'] },
];

const jazzSwingPattern2: DrumStepEvent[] = [
  { step: 0, sounds: ['ride', 'kick'] },
  { step: 4, sounds: ['ride', 'snare', 'hihat_closed'] },
  { step: 6, sounds: ['ride'] },
  { step: 8, sounds: ['ride', 'kick'] },
  { step: 12, sounds: ['ride', 'hihat_closed'] },
  { step: 14, sounds: ['ride'] },
];

// 14. Upbeat Bebop Swing
const jazzBebopPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['ride', 'kick'] },
  { step: 4, sounds: ['ride', 'hihat_closed', 'snare'] },
  { step: 6, sounds: ['ride'] },
  { step: 8, sounds: ['ride', 'kick'] },
  { step: 10, sounds: ['snare'] },
  { step: 12, sounds: ['ride', 'hihat_closed'] },
  { step: 14, sounds: ['ride'] },
];

// 15. Smoky Jazz Ballad (Brushes)
const jazzBalladPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'snare'] },
  { step: 2, sounds: ['snare'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 6, sounds: ['snare'] },
  { step: 8, sounds: ['kick', 'snare'] },
  { step: 10, sounds: ['snare'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] },
  { step: 14, sounds: ['snare', 'ride'] },
];

// 16. New Orleans Jazz-Funk / Boogaloo
const jazzFunkBoogalooPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'rimshot', 'hihat_closed'] },
  { step: 6, sounds: ['kick', 'hihat_closed'] },
  { step: 8, sounds: ['hihat_closed'] },
  { step: 10, sounds: ['kick', 'hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] },
  { step: 14, sounds: ['cowbell', 'hihat_open'] },
];

// 17. Reggae One Drop
const worldReggaePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick', 'rimshot', 'snare', 'hihat_closed'] }, // The One Drop!
  { step: 10, sounds: ['hihat_closed'] },
  { step: 12, sounds: ['hihat_closed'] },
  { step: 14, sounds: ['hihat_open'] },
];

// 18. Bossa Nova Groove
const latinBossaPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['rimshot', 'kick', 'hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['hihat_closed'] },
  { step: 6, sounds: ['rimshot', 'kick', 'hihat_closed'] },
  { step: 8, sounds: ['hihat_closed'] },
  { step: 10, sounds: ['rimshot', 'hihat_closed'] },
  { step: 12, sounds: ['kick', 'hihat_closed'] },
  { step: 14, sounds: ['rimshot', 'hihat_closed'] },
];

// 19. Cha-Cha-Cha & Conga
const latinChaChaPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['cowbell', 'conga_open', 'kick'] },
  { step: 2, sounds: ['cowbell'] },
  { step: 4, sounds: ['cowbell', 'conga_slap'] },
  { step: 6, sounds: ['cowbell'] },
  { step: 8, sounds: ['cowbell', 'conga_open'] },
  { step: 10, sounds: ['cowbell', 'conga_open'] },
  { step: 12, sounds: ['cowbell', 'conga_slap'] },
  { step: 14, sounds: ['conga_open'] },
];

// 20. Salsa (2-3 Son Clave)
const latinSalsaPattern1: DrumStepEvent[] = [
  { step: 0, sounds: ['hihat_closed', 'conga_open'] },
  { step: 4, sounds: ['rimshot', 'hihat_closed', 'conga_slap'] }, // Clave 2
  { step: 8, sounds: ['rimshot', 'hihat_closed', 'conga_open'] }, // Clave 3
  { step: 12, sounds: ['hihat_closed', 'conga_slap'] },
];

const latinSalsaPattern2: DrumStepEvent[] = [
  { step: 0, sounds: ['rimshot', 'hihat_closed', 'conga_open'] }, // Clave 1
  { step: 4, sounds: ['hihat_closed', 'conga_slap'] },
  { step: 6, sounds: ['rimshot', 'conga_open'] }, // Clave 2&
  { step: 8, sounds: ['hihat_closed', 'conga_open'] },
  { step: 12, sounds: ['rimshot', 'hihat_closed', 'conga_slap'] }, // Clave 4
];

// 21. Latin Cumbia Groove
const worldCumbiaPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'shaker'] },
  { step: 2, sounds: ['shaker'] },
  { step: 4, sounds: ['conga_slap', 'shaker'] },
  { step: 6, sounds: ['shaker'] },
  { step: 8, sounds: ['kick', 'shaker'] },
  { step: 10, sounds: ['shaker'] },
  { step: 12, sounds: ['conga_slap', 'shaker'] },
  { step: 14, sounds: ['cowbell', 'shaker'] },
];

// 22. Afrobeat Polyrhythmic Groove (Fela Kuti Style)
const africanAfrobeatPattern1: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'shaker'] },
  { step: 2, sounds: ['shaker'] },
  { step: 4, sounds: ['rimshot', 'shaker'] },
  { step: 6, sounds: ['kick', 'shaker'] },
  { step: 8, sounds: ['rimshot', 'shaker'] },
  { step: 10, sounds: ['kick', 'shaker'] },
  { step: 12, sounds: ['rimshot', 'shaker'] },
  { step: 14, sounds: ['kick', 'hihat_open'] },
];

// 23. West African Djembe & Dunun
const africanDjembePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['conga_open', 'cowbell', 'kick'] },
  { step: 2, sounds: ['cowbell'] },
  { step: 4, sounds: ['conga_slap', 'cowbell'] },
  { step: 6, sounds: ['cowbell'] },
  { step: 8, sounds: ['conga_open', 'cowbell', 'kick'] },
  { step: 10, sounds: ['cowbell', 'conga_open'] },
  { step: 12, sounds: ['conga_slap', 'cowbell'] },
  { step: 14, sounds: ['cowbell', 'conga_open'] },
];

// 24. West African Highlife
const africanHighlifePattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'rimshot', 'hihat_closed'] },
  { step: 3, sounds: ['rimshot'] },
  { step: 4, sounds: ['hihat_closed'] },
  { step: 6, sounds: ['kick', 'rimshot'] },
  { step: 8, sounds: ['rimshot', 'hihat_closed'] },
  { step: 10, sounds: ['snare'] },
  { step: 12, sounds: ['rimshot', 'hihat_closed'] },
  { step: 14, sounds: ['kick'] },
];

// 25. Folk & Country Train Beat
const folkTrainPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 1, sounds: ['hihat_closed'] },
  { step: 2, sounds: ['hihat_closed'] },
  { step: 3, sounds: ['hihat_closed'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] }, // Backbeat brush accent
  { step: 5, sounds: ['hihat_closed'] },
  { step: 6, sounds: ['hihat_closed'] },
  { step: 7, sounds: ['hihat_closed'] },
  { step: 8, sounds: ['kick', 'hihat_closed'] },
  { step: 9, sounds: ['hihat_closed'] },
  { step: 10, sounds: ['hihat_closed'] },
  { step: 11, sounds: ['hihat_closed'] },
  { step: 12, sounds: ['snare', 'hihat_closed'] }, // Backbeat brush accent
  { step: 13, sounds: ['hihat_closed'] },
  { step: 14, sounds: ['hihat_closed'] },
  { step: 15, sounds: ['hihat_closed'] },
];

// 26. Folk Waltz in 3/4
const folkWaltzPattern: DrumStepEvent[] = [
  { step: 0, sounds: ['kick', 'hihat_closed'] },
  { step: 4, sounds: ['snare', 'hihat_closed'] },
  { step: 8, sounds: ['snare', 'hihat_closed'] },
];

// ============================================================================
// EXPORTED DRUM GROOVES LIST
// ============================================================================

export const DRUM_GROOVES: DrumGroove[] = [
  // ================= ROCK =================
  {
    id: 'rock_classic_8beat',
    name: 'Classic 8-Beat Rock',
    style: 'Rock',
    tempo: 116,
    timeSignature: [4, 4],
    badge: 'Standard 4/4',
    kitType: 'drum_kit',
    description: 'The foundation of rock music: steady 8th-note hi-hat, punchy kick on 1 & 3, and crisp snare on 2 & 4.',
    measures: patternsToMeasures([rockClassicPattern1, rockClassicPattern2], [4, 4], 'rk1'),
    previewPattern: rockClassicPattern1,
  },
  {
    id: 'rock_hard_driving',
    name: 'Hard Rock Driving Beat',
    style: 'Rock',
    tempo: 130,
    timeSignature: [4, 4],
    badge: 'Heavy Energy',
    kitType: 'drum_kit',
    description: 'Driving four-on-the-floor kick, accented backbeat snare on 2 & 4, and heavy ride cymbal eighths.',
    measures: patternsToMeasures([rockHardPattern], [4, 4], 'rkh'),
    previewPattern: rockHardPattern,
  },
  {
    id: 'rock_punk_fast',
    name: 'Fast Punk Rock (Straight 8ths)',
    style: 'Rock',
    tempo: 165,
    timeSignature: [4, 4],
    badge: 'High Octane',
    kitType: 'drum_kit',
    description: 'High-speed punk energy with open hi-hat sizzle, frantic driving kick drum, and cracking snare accents.',
    measures: patternsToMeasures([rockPunkPattern], [4, 4], 'rkp'),
    previewPattern: rockPunkPattern,
  },
  {
    id: 'rock_grunge_alt',
    name: '90s Grunge & Alternative Rock',
    style: 'Rock',
    tempo: 104,
    timeSignature: [4, 4],
    badge: 'Alternative',
    kitType: 'drum_kit',
    description: 'Heavy syncopated grunge groove with deep pocket kick, gritty snare crack, and dynamic tom accents.',
    measures: patternsToMeasures([rockGrungePattern], [4, 4], 'rkg'),
    previewPattern: rockGrungePattern,
  },

  // ================= POP =================
  {
    id: 'pop_four_on_the_floor',
    name: 'Four-on-the-Floor Pop Dance',
    style: 'Pop',
    tempo: 122,
    timeSignature: [4, 4],
    badge: 'Dance Hit',
    kitType: 'drum_kit',
    description: 'Pumping bass drum on every beat (1, 2, 3, 4), snappy snare on 2 & 4, and offbeat open hi-hat sizzle.',
    measures: patternsToMeasures([popFourOnFloorPattern], [4, 4], 'pp1'),
    previewPattern: popFourOnFloorPattern,
  },
  {
    id: 'pop_trap_hiphop',
    name: 'Modern Trap & Hip-Hop 808',
    style: 'Pop',
    tempo: 88,
    timeSignature: [4, 4],
    badge: 'Boom-Bap / Trap',
    kitType: 'drum_808',
    description: 'Heavy syncopated sub-kick, crisp snappy snare on beat 3, and rapid rolling 16th hi-hat textures.',
    measures: patternsToMeasures([popTrapPattern], [4, 4], 'ppt'),
    previewPattern: popTrapPattern,
  },
  {
    id: 'pop_synthwave_80s',
    name: '80s Retro Synthwave / Synthpop',
    style: 'Pop',
    tempo: 118,
    timeSignature: [4, 4],
    badge: 'Retro Neon',
    kitType: 'drum_808',
    description: 'Punchy gated electro kicks, huge backbeat snare claps, and steady rhythmic hats reminiscent of iconic 80s hits.',
    measures: patternsToMeasures([popSynthwavePattern], [4, 4], 'pps'),
    previewPattern: popSynthwavePattern,
  },
  {
    id: 'pop_rnb_slow_groove',
    name: 'R&B / Soul Slow Jam (6/8 Ballad)',
    style: 'Pop',
    tempo: 75,
    timeSignature: [4, 4],
    badge: 'Slow Dance',
    kitType: 'drum_jazz',
    description: 'Lush, emotional slow dance pocket groove featuring soft feathering bass, brushed snare, and sparkling cymbals.',
    measures: patternsToMeasures([popSlowJamPattern], [4, 4], 'ppj'),
    previewPattern: popSlowJamPattern,
  },

  // ================= INDIE =================
  {
    id: 'indie_folk_stomp_clap',
    name: 'Acoustic Stomp & Handclap',
    style: 'Indie',
    tempo: 100,
    timeSignature: [4, 4],
    badge: 'Acoustic Roots',
    kitType: 'drum_jazz',
    description: 'Resonant bass drum foot stomp on 1 & 3 with handclaps / rimshots on 2 & 4 and continuous shaker pulse.',
    measures: patternsToMeasures([indieFolkStompPattern], [4, 4], 'fks'),
    previewPattern: indieFolkStompPattern,
  },
  {
    id: 'indie_pop_disco',
    name: 'Indie Pop Dance Beat',
    style: 'Indie',
    tempo: 114,
    timeSignature: [4, 4],
    badge: 'Festival Anthem',
    kitType: 'drum_kit',
    description: 'Catchy festival indie dance groove combining four-on-the-floor kick, bouncy offbeat hats, and continuous shaker.',
    measures: patternsToMeasures([indiePopDiscoPattern], [4, 4], 'ipd'),
    previewPattern: indiePopDiscoPattern,
  },
  {
    id: 'indie_garage_rock',
    name: 'Garage Rock Driving Beat',
    style: 'Indie',
    tempo: 128,
    timeSignature: [4, 4],
    badge: 'Lo-Fi Rock',
    kitType: 'drum_kit',
    description: 'Raw, punchy indie garage rock groove with tight closed hats and sudden syncopated tom-snare push.',
    measures: patternsToMeasures([indieGaragePattern], [4, 4], 'igr'),
    previewPattern: indieGaragePattern,
  },
  {
    id: 'indie_chill_hop',
    name: 'Lo-Fi Indie Chill Hop',
    style: 'Indie',
    tempo: 82,
    timeSignature: [4, 4],
    badge: 'Chill Beats',
    kitType: 'drum_808',
    description: 'Laid-back boom-bap swing featuring a relaxed sub kick, wooden rimshot backbeat, and cozy vinyl shaker pulse.',
    measures: patternsToMeasures([indieChillHopPattern], [4, 4], 'ich'),
    previewPattern: indieChillHopPattern,
  },

  // ================= JAZZ =================
  {
    id: 'jazz_swing_classic',
    name: 'Traditional Jazz Swing',
    style: 'Jazz',
    tempo: 124,
    timeSignature: [4, 4],
    badge: 'Swing Feel',
    kitType: 'drum_jazz',
    description: 'Iconic jazz ride cymbal spang-a-lang pattern with snappy hi-hat foot chicks on beats 2 & 4.',
    measures: patternsToMeasures([jazzSwingPattern1, jazzSwingPattern2], [4, 4], 'jz1'),
    previewPattern: jazzSwingPattern1,
  },
  {
    id: 'jazz_bebop_fast',
    name: 'Upbeat Bebop Swing',
    style: 'Jazz',
    tempo: 160,
    timeSignature: [4, 4],
    badge: 'Fast Tempo',
    kitType: 'drum_jazz',
    description: 'Fast, articulate ride cymbal work with syncopated snare feathering and walking pulse.',
    measures: patternsToMeasures([jazzBebopPattern], [4, 4], 'jzb'),
    previewPattern: jazzBebopPattern,
  },
  {
    id: 'jazz_brush_ballad',
    name: 'Smoky Jazz Ballad (Brushes)',
    style: 'Jazz',
    tempo: 68,
    timeSignature: [4, 4],
    badge: 'Late Night',
    kitType: 'drum_jazz',
    description: 'Gentle brushed snare swishes on 2 & 4, soft acoustic kick feathering, and delicate ride cymbal warmth.',
    measures: patternsToMeasures([jazzBalladPattern], [4, 4], 'jba'),
    previewPattern: jazzBalladPattern,
  },
  {
    id: 'jazz_funk_boogaloo',
    name: 'New Orleans Jazz-Funk / Boogaloo',
    style: 'Jazz',
    tempo: 108,
    timeSignature: [4, 4],
    badge: 'Boogaloo Pocket',
    kitType: 'drum_jazz',
    description: 'Super funky syncopated New Orleans second-line rhythm with crisp rimshots and cowbell syncopation.',
    measures: patternsToMeasures([jazzFunkBoogalooPattern], [4, 4], 'jfb'),
    previewPattern: jazzFunkBoogalooPattern,
  },

  // ================= WORLD & LATIN =================
  {
    id: 'world_reggae_one_drop',
    name: 'Reggae One Drop',
    style: 'World',
    tempo: 78,
    timeSignature: [4, 4],
    badge: 'Jamaican Roots',
    kitType: 'drum_latin',
    description: 'Classic Kingston one-drop groove: beat 1 is dropped silent, while kick and rimshot crack together on beat 3.',
    measures: patternsToMeasures([worldReggaePattern], [4, 4], 'wro'),
    previewPattern: worldReggaePattern,
  },
  {
    id: 'latin_bossa_nova',
    name: 'Bossa Nova Groove',
    style: 'Latin',
    tempo: 130,
    timeSignature: [4, 4],
    badge: 'Brazilian',
    kitType: 'drum_latin',
    description: 'Delicate cross-stick rimshot pattern with syncopated bass drum pulse and smooth ride/shaker 8ths.',
    measures: patternsToMeasures([latinBossaPattern], [4, 4], 'ltb'),
    previewPattern: latinBossaPattern,
  },
  {
    id: 'latin_chachacha',
    name: 'Cha-Cha-Cha & Conga',
    style: 'Latin',
    tempo: 118,
    timeSignature: [4, 4],
    badge: 'Afro-Cuban',
    kitType: 'drum_latin',
    description: 'Iconic cowbell rhythm with syncopated conga slaps and tumbao defining classic Latin ballroom cadence.',
    measures: patternsToMeasures([latinChaChaPattern], [4, 4], 'ltc'),
    previewPattern: latinChaChaPattern,
  },
  {
    id: 'latin_salsa_clave',
    name: 'Salsa (2-3 Son Clave)',
    style: 'Latin',
    tempo: 160,
    timeSignature: [4, 4],
    badge: 'Son Clave',
    kitType: 'drum_latin',
    description: 'Essential 2-3 Son Clave rhythm on rimshot with driving conga slaps and steady open tones.',
    measures: patternsToMeasures([latinSalsaPattern1, latinSalsaPattern2], [4, 4], 'lts'),
    previewPattern: latinSalsaPattern1,
  },
  {
    id: 'world_cumbia',
    name: 'Latin Cumbia Groove',
    style: 'World',
    tempo: 96,
    timeSignature: [4, 4],
    badge: 'Colombian',
    kitType: 'drum_latin',
    description: 'Hypnotic Colombian cumbia groove with continuous 8th-note shaker pulse, syncopated conga slaps, and cowbell.',
    measures: patternsToMeasures([worldCumbiaPattern], [4, 4], 'wcu'),
    previewPattern: worldCumbiaPattern,
  },
  {
    id: 'african_afrobeat',
    name: 'Afrobeat Polyrhythmic Groove',
    style: 'African',
    tempo: 115,
    timeSignature: [4, 4],
    badge: 'Fela Kuti Style',
    kitType: 'drum_latin',
    description: 'High-energy West African Afrobeat with interlocking syncopated kick, sharp snare rimshot, and rapid shaker.',
    measures: patternsToMeasures([africanAfrobeatPattern1], [4, 4], 'af1'),
    previewPattern: africanAfrobeatPattern1,
  },
  {
    id: 'african_djembe_dunun',
    name: 'West African Djembe & Dunun',
    style: 'African',
    tempo: 120,
    timeSignature: [4, 4],
    badge: 'Hand Percussion',
    kitType: 'drum_latin',
    description: 'Deep resonant Dunun bass pulses on 1 & 3 with crackling high Djembe slaps on 2 & 4 and iron bell ostinato.',
    measures: patternsToMeasures([africanDjembePattern], [4, 4], 'afd'),
    previewPattern: africanDjembePattern,
  },
  {
    id: 'african_highlife',
    name: 'West African Highlife',
    style: 'African',
    tempo: 126,
    timeSignature: [4, 4],
    badge: 'Ghana & Nigeria',
    kitType: 'drum_latin',
    description: 'Bouncy Ghanaian highlife guitar-band groove with interlocking wooden claves, light snare, and syncopated kick.',
    measures: patternsToMeasures([africanHighlifePattern], [4, 4], 'afh'),
    previewPattern: africanHighlifePattern,
  },

  // ================= FOLK =================
  {
    id: 'folk_train_beat',
    name: 'Folk & Country Train Beat',
    style: 'Folk',
    tempo: 112,
    timeSignature: [4, 4],
    badge: 'Americana',
    kitType: 'drum_jazz',
    description: 'Brisk, chugging 16th-note train rhythm with closed hi-hats, brush snare on 2 & 4, and an alternating bass drum pulse.',
    measures: patternsToMeasures([folkTrainPattern], [4, 4], 'fk1'),
    previewPattern: folkTrainPattern,
  },
  {
    id: 'folk_waltz_34',
    name: 'Folk Waltz in 3/4',
    style: 'Folk',
    tempo: 96,
    timeSignature: [3, 4],
    badge: '3/4 Waltz',
    kitType: 'drum_jazz',
    description: 'Classic 3/4 oom-pah-pah waltz pulse with bass drum on 1 and light brushed snare on 2 and 3.',
    measures: patternsToMeasures([folkWaltzPattern], [3, 4], 'fkw'),
    previewPattern: folkWaltzPattern,
  },
];
