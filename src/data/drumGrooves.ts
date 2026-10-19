import { Measure, NoteItem } from '../types/music';

export type DrumStyle = 'Rock' | 'Jazz' | 'Folk' | 'Pop' | 'Latin' | 'African' | 'Funk';

export type DrumSound =
  | 'kick'
  | 'snare'
  | 'hihat_closed'
  | 'hihat_open'
  | 'ride'
  | 'crash'
  | 'tom_high'
  | 'tom_low'
  | 'rimshot'
  | 'shaker'
  | 'cowbell'
  | 'conga_open'
  | 'conga_slap';

export interface DrumStepEvent {
  step: number; // 0 to 15 for 16th notes in 4/4 bar
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
  measures: Measure[];
  previewPattern: DrumStepEvent[]; // 16 steps (1 bar) of drum sounds for real-time audio synthesizer preview
}

// Helper to create uniquely ID'd note item
function makeDrumNote(step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', octave: number, duration: 0.25 | 0.125 | 0.0625 | 0.5 | 1): NoteItem {
  return {
    id: 'dr_' + Math.random().toString(36).substring(2, 9),
    type: 'note',
    pitch: { step, octave },
    duration,
  };
}

function makeDrumRest(duration: 0.25 | 0.125 | 0.0625 | 0.5 | 1): NoteItem {
  return {
    id: 'dr_r_' + Math.random().toString(36).substring(2, 9),
    type: 'rest',
    duration,
  };
}

export const DRUM_GROOVES: DrumGroove[] = [
  // ================= ROCK =================
  {
    id: 'rock_classic_8beat',
    name: 'Classic 8-Beat Rock',
    style: 'Rock',
    tempo: 116,
    timeSignature: [4, 4],
    badge: 'Standard 4/4',
    description: 'The foundation of rock music: steady 8th-note hi-hat, punchy kick on 1 & 3, and crisp snare on 2 & 4.',
    measures: [
      {
        id: 'm_rk1_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare (2)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('F', 4, 0.125), // Kick (3)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare (4)
          makeDrumNote('G', 5, 0.125), // Hat (&)
        ],
      },
      {
        id: 'm_rk1_2',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare (2)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('F', 4, 0.0625), // Double Kick (3)
          makeDrumNote('F', 4, 0.0625), // Double Kick (e)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare (4)
          makeDrumNote('A', 5, 0.125), // Open Hat / Crash (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'hihat_closed'] },
      { step: 2, sounds: ['hihat_closed'] },
      { step: 4, sounds: ['snare', 'hihat_closed'] },
      { step: 6, sounds: ['hihat_closed'] },
      { step: 8, sounds: ['kick', 'hihat_closed'] },
      { step: 10, sounds: ['hihat_closed'] },
      { step: 12, sounds: ['snare', 'hihat_closed'] },
      { step: 14, sounds: ['hihat_closed'] },
    ],
  },

  {
    id: 'rock_hard_driving',
    name: 'Hard Rock Driving Beat',
    style: 'Rock',
    tempo: 130,
    timeSignature: [4, 4],
    badge: 'Heavy Energy',
    description: 'Driving four-on-the-floor kick, accented backbeat snare on 2 & 4, and heavy ride cymbal eighths.',
    measures: [
      {
        id: 'm_rkh_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('F', 5, 0.125), // Ride (&)
          makeDrumNote('C', 5, 0.125), // Snare (2)
          makeDrumNote('F', 5, 0.125), // Ride (&)
          makeDrumNote('F', 4, 0.125), // Kick (3)
          makeDrumNote('F', 5, 0.125), // Ride (&)
          makeDrumNote('C', 5, 0.125), // Snare (4)
          makeDrumNote('A', 5, 0.125), // Crash (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'ride', 'crash'] },
      { step: 2, sounds: ['ride'] },
      { step: 4, sounds: ['kick', 'snare', 'ride'] },
      { step: 6, sounds: ['ride'] },
      { step: 8, sounds: ['kick', 'ride'] },
      { step: 10, sounds: ['ride'] },
      { step: 12, sounds: ['kick', 'snare', 'ride'] },
      { step: 14, sounds: ['ride', 'hihat_open'] },
    ],
  },

  // ================= JAZZ =================
  {
    id: 'jazz_swing_classic',
    name: 'Traditional Jazz Swing',
    style: 'Jazz',
    tempo: 124,
    timeSignature: [4, 4],
    badge: 'Swing Feel',
    description: 'Iconic jazz ride cymbal spang-a-lang pattern with snappy hi-hat foot chicks on beats 2 & 4.',
    measures: [
      {
        id: 'm_jz1_1',
        items: [
          makeDrumNote('F', 5, 0.25),  // Ride (1)
          makeDrumNote('G', 5, 0.125), // Hi-hat foot chick (2)
          makeDrumNote('F', 5, 0.125), // Ride swing (&)
          makeDrumNote('F', 5, 0.25),  // Ride (3)
          makeDrumNote('G', 5, 0.125), // Hi-hat foot chick (4)
          makeDrumNote('F', 5, 0.125), // Ride swing (&)
        ],
      },
      {
        id: 'm_jz1_2',
        items: [
          makeDrumNote('F', 5, 0.25),  // Ride (1)
          makeDrumNote('C', 5, 0.125), // Snare comp (2)
          makeDrumNote('F', 5, 0.125), // Ride swing (&)
          makeDrumNote('F', 5, 0.25),  // Ride (3)
          makeDrumNote('G', 5, 0.125), // Hi-hat chick (4)
          makeDrumNote('F', 5, 0.125), // Ride swing (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['ride', 'kick'] },
      { step: 4, sounds: ['ride', 'hihat_closed'] },
      { step: 6, sounds: ['ride'] },
      { step: 8, sounds: ['ride'] },
      { step: 12, sounds: ['ride', 'hihat_closed'] },
      { step: 14, sounds: ['ride'] },
    ],
  },

  {
    id: 'jazz_bebop_fast',
    name: 'Upbeat Bebop Swing',
    style: 'Jazz',
    tempo: 160,
    timeSignature: [4, 4],
    badge: 'Fast Tempo',
    description: 'Fast, articulate ride cymbal work with syncopated snare feathering and walking pulse.',
    measures: [
      {
        id: 'm_jzb_1',
        items: [
          makeDrumNote('F', 5, 0.25),  // Ride
          makeDrumNote('C', 5, 0.125), // Snare syncopation
          makeDrumNote('F', 5, 0.125), // Ride
          makeDrumNote('F', 4, 0.25),  // Kick
          makeDrumNote('G', 5, 0.125), // Hi-hat foot
          makeDrumNote('F', 5, 0.125), // Ride
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['ride', 'kick'] },
      { step: 4, sounds: ['ride', 'hihat_closed', 'snare'] },
      { step: 6, sounds: ['ride'] },
      { step: 8, sounds: ['ride', 'kick'] },
      { step: 10, sounds: ['snare'] },
      { step: 12, sounds: ['ride', 'hihat_closed'] },
      { step: 14, sounds: ['ride'] },
    ],
  },

  // ================= FOLK =================
  {
    id: 'folk_train_beat',
    name: 'Folk & Country Train Beat',
    style: 'Folk',
    tempo: 112,
    timeSignature: [4, 4],
    badge: 'Americana',
    description: 'Fast, chugging snare train rhythm with accents on 2 & 4, supported by an alternating bass drum pulse.',
    measures: [
      {
        id: 'm_fk1_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('C', 5, 0.0625), // Snare chug (e)
          makeDrumNote('C', 5, 0.0625), // Snare chug (&)
          makeDrumNote('C', 5, 0.125), // Snare Accent (2)
          makeDrumNote('C', 5, 0.125), // Snare chug (&)
          makeDrumNote('F', 4, 0.125), // Kick (3)
          makeDrumNote('C', 5, 0.0625), // Snare chug (e)
          makeDrumNote('C', 5, 0.0625), // Snare chug (&)
          makeDrumNote('C', 5, 0.125), // Snare Accent (4)
          makeDrumNote('G', 5, 0.125), // Hat (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'snare'] },
      { step: 1, sounds: ['snare'] },
      { step: 2, sounds: ['snare'] },
      { step: 3, sounds: ['snare'] },
      { step: 4, sounds: ['snare', 'rimshot'] }, // Accent
      { step: 5, sounds: ['snare'] },
      { step: 6, sounds: ['snare'] },
      { step: 7, sounds: ['snare'] },
      { step: 8, sounds: ['kick', 'snare'] },
      { step: 9, sounds: ['snare'] },
      { step: 10, sounds: ['snare'] },
      { step: 11, sounds: ['snare'] },
      { step: 12, sounds: ['snare', 'rimshot'] }, // Accent
      { step: 13, sounds: ['snare'] },
      { step: 14, sounds: ['snare', 'hihat_closed'] },
      { step: 15, sounds: ['snare'] },
    ],
  },

  {
    id: 'folk_stomp_clap',
    name: 'Acoustic Stomp & Handclap',
    style: 'Folk',
    tempo: 100,
    timeSignature: [4, 4],
    badge: 'Acoustic Roots',
    description: 'Resonant bass drum foot stomp on 1 & 3 with handclaps / rimshots on 2 & 4 and shaker pulse.',
    measures: [
      {
        id: 'm_fks_1',
        items: [
          makeDrumNote('F', 4, 0.25),  // Stomp Kick (1)
          makeDrumNote('E', 5, 0.25),  // Handclap / Rimshot (2)
          makeDrumNote('F', 4, 0.25),  // Stomp Kick (3)
          makeDrumNote('E', 5, 0.25),  // Handclap / Rimshot (4)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'shaker'] },
      { step: 2, sounds: ['shaker'] },
      { step: 4, sounds: ['rimshot', 'snare', 'shaker'] },
      { step: 6, sounds: ['shaker'] },
      { step: 8, sounds: ['kick', 'shaker'] },
      { step: 10, sounds: ['shaker'] },
      { step: 12, sounds: ['rimshot', 'snare', 'shaker'] },
      { step: 14, sounds: ['shaker'] },
    ],
  },

  {
    id: 'folk_waltz_34',
    name: 'Folk Waltz in 3/4',
    style: 'Folk',
    tempo: 96,
    timeSignature: [3, 4],
    badge: '3/4 Waltz',
    description: 'Classic 3/4 oom-pah-pah waltz pulse with bass drum on 1 and light brushed snare on 2 and 3.',
    measures: [
      {
        id: 'm_fkw_1',
        items: [
          makeDrumNote('F', 4, 0.25), // Beat 1: Kick
          makeDrumNote('C', 5, 0.25), // Beat 2: Snare brush
          makeDrumNote('C', 5, 0.25), // Beat 3: Snare brush
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'hihat_closed'] },
      { step: 4, sounds: ['snare', 'hihat_closed'] },
      { step: 8, sounds: ['snare', 'hihat_closed'] },
    ],
  },

  // ================= POP =================
  {
    id: 'pop_four_on_the_floor',
    name: 'Four-on-the-Floor Pop Dance',
    style: 'Pop',
    tempo: 122,
    timeSignature: [4, 4],
    badge: 'Dance Hit',
    description: 'Pumping bass drum on every beat (1, 2, 3, 4), snappy snare on 2 & 4, and offbeat open hi-hat sizzle.',
    measures: [
      {
        id: 'm_pp1_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('A', 5, 0.125), // Open Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare + Kick (2)
          makeDrumNote('A', 5, 0.125), // Open Hat (&)
          makeDrumNote('F', 4, 0.125), // Kick (3)
          makeDrumNote('A', 5, 0.125), // Open Hat (&)
          makeDrumNote('C', 5, 0.125), // Snare + Kick (4)
          makeDrumNote('A', 5, 0.125), // Open Hat (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'hihat_closed'] },
      { step: 2, sounds: ['hihat_open'] },
      { step: 4, sounds: ['kick', 'snare', 'hihat_closed'] },
      { step: 6, sounds: ['hihat_open'] },
      { step: 8, sounds: ['kick', 'hihat_closed'] },
      { step: 10, sounds: ['hihat_open'] },
      { step: 12, sounds: ['kick', 'snare', 'hihat_closed'] },
      { step: 14, sounds: ['hihat_open'] },
    ],
  },

  {
    id: 'pop_trap_hiphop',
    name: 'Modern Trap & Hip-Hop Beat',
    style: 'Pop',
    tempo: 88,
    timeSignature: [4, 4],
    badge: 'Boom-Bap / Trap',
    description: 'Heavy syncopated sub-kick, crisp snappy snare on beat 3, and rolling 16th hi-hat textures.',
    measures: [
      {
        id: 'm_ppt_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('G', 5, 0.125), // Hat (&)
          makeDrumRest(0.125),         // Rest (2)
          makeDrumNote('F', 4, 0.125), // Syncopated Kick (&)
          makeDrumNote('C', 5, 0.25),  // Snare on 3
          makeDrumNote('G', 5, 0.0625),// Fast hat
          makeDrumNote('G', 5, 0.0625),// Fast hat
          makeDrumNote('G', 5, 0.125), // Hat (&)
        ],
      },
    ],
    previewPattern: [
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
    ],
  },

  // ================= LATIN =================
  {
    id: 'latin_bossa_nova',
    name: 'Bossa Nova Groove',
    style: 'Latin',
    tempo: 130,
    timeSignature: [4, 4],
    badge: 'Brazilian',
    description: 'Delicate cross-stick rimshot pattern with syncopated bass drum pulse and smooth ride/shaker 8ths.',
    measures: [
      {
        id: 'm_ltb_1',
        items: [
          makeDrumNote('E', 5, 0.125), // Rimshot (1)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
          makeDrumRest(0.125),         // Rest (2)
          makeDrumNote('E', 5, 0.125), // Rimshot (&)
          makeDrumRest(0.125),         // Rest (3)
          makeDrumNote('E', 5, 0.125), // Rimshot (&)
          makeDrumNote('F', 4, 0.125), // Kick (4)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['rimshot', 'kick', 'hihat_closed'] },
      { step: 2, sounds: ['hihat_closed'] },
      { step: 4, sounds: ['hihat_closed'] },
      { step: 6, sounds: ['rimshot', 'kick', 'hihat_closed'] },
      { step: 8, sounds: ['hihat_closed'] },
      { step: 10, sounds: ['rimshot', 'hihat_closed'] },
      { step: 12, sounds: ['kick', 'hihat_closed'] },
      { step: 14, sounds: ['rimshot', 'hihat_closed'] },
    ],
  },

  {
    id: 'latin_chachacha',
    name: 'Cha-Cha-Cha & Conga',
    style: 'Latin',
    tempo: 118,
    timeSignature: [4, 4],
    badge: 'Afro-Cuban',
    description: 'Iconic cowbell rhythm with syncopated conga slaps and tumbao defining classic Latin ballroom cadence.',
    measures: [
      {
        id: 'm_ltc_1',
        items: [
          makeDrumNote('F', 5, 0.25),  // Cowbell (1)
          makeDrumNote('F', 5, 0.25),  // Cowbell (2)
          makeDrumNote('F', 5, 0.125), // Cowbell (3)
          makeDrumNote('F', 5, 0.125), // Cowbell (&)
          makeDrumNote('F', 5, 0.25),  // Cowbell (4)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['cowbell', 'conga_open', 'kick'] },
      { step: 4, sounds: ['cowbell', 'conga_slap'] },
      { step: 8, sounds: ['cowbell', 'conga_open'] },
      { step: 10, sounds: ['cowbell', 'conga_open'] },
      { step: 12, sounds: ['cowbell', 'conga_slap'] },
      { step: 14, sounds: ['conga_open'] },
    ],
  },

  {
    id: 'latin_salsa_clave',
    name: 'Salsa (2-3 Son Clave)',
    style: 'Latin',
    tempo: 160,
    timeSignature: [4, 4],
    badge: 'Son Clave',
    description: 'Essential 2-3 Son Clave rhythm on woodblock/rim with driving conga slaps and timbales cascara.',
    measures: [
      {
        id: 'm_lts_1',
        items: [
          makeDrumRest(0.25),          // (1)
          makeDrumNote('E', 5, 0.25),  // Clave on 2
          makeDrumNote('E', 5, 0.25),  // Clave on 3
          makeDrumRest(0.25),          // (4)
        ],
      },
      {
        id: 'm_lts_2',
        items: [
          makeDrumNote('E', 5, 0.125), // Clave on 1
          makeDrumRest(0.125),
          makeDrumRest(0.125),
          makeDrumNote('E', 5, 0.125), // Clave on 2&
          makeDrumRest(0.25),
          makeDrumNote('E', 5, 0.25),  // Clave on 4
        ],
      },
    ],
    previewPattern: [
      // Measure 1 (2 side of clave)
      { step: 0, sounds: ['hihat_closed', 'conga_open'] },
      { step: 4, sounds: ['rimshot', 'hihat_closed', 'conga_slap'] }, // Clave 2
      { step: 8, sounds: ['rimshot', 'hihat_closed', 'conga_open'] }, // Clave 3
      { step: 12, sounds: ['hihat_closed', 'conga_slap'] },
    ],
  },

  // ================= AFRICAN =================
  {
    id: 'african_afrobeat',
    name: 'Afrobeat Polyrhythmic Groove',
    style: 'African',
    tempo: 115,
    timeSignature: [4, 4],
    badge: 'Fela Kuti Style',
    description: 'High-energy West African Afrobeat with interlocking syncopated kick, sharp snare rimshot, and rapid shaker.',
    measures: [
      {
        id: 'm_af1_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Kick (1)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
          makeDrumRest(0.125),         // (2)
          makeDrumNote('F', 4, 0.125), // Kick (&)
          makeDrumNote('E', 5, 0.125), // Rimshot (3)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
          makeDrumRest(0.125),         // (4)
          makeDrumNote('F', 4, 0.125), // Kick (&)
        ],
      },
      {
        id: 'm_af1_2',
        items: [
          makeDrumNote('E', 5, 0.125), // Rimshot (1)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
          makeDrumNote('F', 4, 0.125), // Kick (2)
          makeDrumNote('E', 5, 0.125), // Rimshot (&)
          makeDrumNote('F', 4, 0.125), // Kick (3)
          makeDrumNote('G', 5, 0.125), // Shaker (&)
          makeDrumNote('C', 5, 0.125), // Snare (4)
          makeDrumNote('A', 5, 0.125), // Open Hat (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'shaker'] },
      { step: 2, sounds: ['shaker'] },
      { step: 4, sounds: ['rimshot', 'shaker'] },
      { step: 6, sounds: ['kick', 'shaker'] },
      { step: 8, sounds: ['rimshot', 'shaker'] },
      { step: 10, sounds: ['kick', 'shaker'] },
      { step: 12, sounds: ['rimshot', 'shaker'] },
      { step: 14, sounds: ['kick', 'hihat_open'] },
    ],
  },

  {
    id: 'african_djembe_dunun',
    name: 'West African Djembe & Dunun',
    style: 'African',
    tempo: 120,
    timeSignature: [4, 4],
    badge: 'Hand Percussion',
    description: 'Deep resonant Dunun bass pulses on 1 & 3 with crackling high Djembe slaps on 2 & 4 and iron bell ostinato.',
    measures: [
      {
        id: 'm_afd_1',
        items: [
          makeDrumNote('F', 4, 0.125), // Low Dunun Bass (1)
          makeDrumNote('F', 5, 0.125), // Bell (&)
          makeDrumNote('C', 5, 0.125), // Djembe Slap (2)
          makeDrumNote('F', 5, 0.125), // Bell (&)
          makeDrumNote('F', 4, 0.125), // Low Dunun Bass (3)
          makeDrumNote('F', 5, 0.125), // Bell (&)
          makeDrumNote('C', 5, 0.125), // Djembe Slap (4)
          makeDrumNote('E', 5, 0.125), // Djembe Tone (&)
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['conga_open', 'cowbell', 'kick'] },
      { step: 2, sounds: ['cowbell'] },
      { step: 4, sounds: ['conga_slap', 'cowbell'] },
      { step: 6, sounds: ['cowbell'] },
      { step: 8, sounds: ['conga_open', 'cowbell', 'kick'] },
      { step: 10, sounds: ['cowbell', 'conga_open'] },
      { step: 12, sounds: ['conga_slap', 'cowbell'] },
      { step: 14, sounds: ['cowbell', 'conga_open'] },
    ],
  },

  {
    id: 'african_highlife',
    name: 'West African Highlife',
    style: 'African',
    tempo: 126,
    timeSignature: [4, 4],
    badge: 'Ghana & Nigeria',
    description: 'Bouncy Ghanaian highlife guitar-band groove with interlocking wooden claves, light snare, and syncopated kick.',
    measures: [
      {
        id: 'm_afh_1',
        items: [
          makeDrumNote('F', 4, 0.25),  // Kick
          makeDrumNote('E', 5, 0.125), // Clave rim
          makeDrumNote('F', 4, 0.125), // Kick
          makeDrumNote('E', 5, 0.125), // Clave rim
          makeDrumNote('C', 5, 0.125), // Snare
          makeDrumNote('G', 5, 0.25),  // Hat
        ],
      },
    ],
    previewPattern: [
      { step: 0, sounds: ['kick', 'rimshot', 'hihat_closed'] },
      { step: 3, sounds: ['rimshot'] },
      { step: 4, sounds: ['hihat_closed'] },
      { step: 6, sounds: ['kick', 'rimshot'] },
      { step: 8, sounds: ['rimshot', 'hihat_closed'] },
      { step: 10, sounds: ['snare'] },
      { step: 12, sounds: ['rimshot', 'hihat_closed'] },
      { step: 14, sounds: ['kick'] },
    ],
  },
];
