import { NoteItem, Score } from '../types/music';

export function createEmptyMeasure(timeSignature: [number, number] = [4, 4]): { id: string; items: NoteItem[] } {
  const [beats, beatVal] = timeSignature;
  const capacity = beats * (1 / beatVal);
  let items: NoteItem[];
  if (Math.abs(capacity - 0.5) < 0.001) {
    items = [
      {
        id: 'n_' + Math.random().toString(36).substring(2, 9),
        type: 'rest',
        duration: 0.5,
      },
    ];
  } else if (Math.abs(capacity - 0.75) < 0.001) {
    items = [
      {
        id: 'n_' + Math.random().toString(36).substring(2, 9),
        type: 'rest',
        duration: 0.5,
      },
      {
        id: 'n_' + Math.random().toString(36).substring(2, 9),
        type: 'rest',
        duration: 0.25,
      },
    ];
  } else {
    items = [
      {
        id: 'n_' + Math.random().toString(36).substring(2, 9),
        type: 'rest',
        duration: 1, // whole rest fills 4/4
      },
    ];
  }

  return {
    id: 'm_' + Math.random().toString(36).substring(2, 9),
    items,
  };
}

export const DEFAULT_BLANK_SCORE: Score = {
  id: 'score_blank_treble',
  title: 'My Composition',
  composer: 'Student Composer',
  tempo: 108,
  timeSignature: [4, 4],
  keySignature: 'C',
  tracks: [
    {
      id: 'track_treble_1',
      name: 'Treble Staff',
      instrumentId: 'piano_treble',
      clef: 'treble',
      volume: 0.85,
      muted: false,
      soloed: false,
      measures: [
        createEmptyMeasure(),
        createEmptyMeasure(),
        createEmptyMeasure(),
        createEmptyMeasure(),
      ],
    },
  ],
};

export const TEMPLATES: Record<string, { name: string; description: string; score: Score }> = {
  blank: {
    name: 'Blank Treble Staff',
    description: 'Clean single blank treble clef staff with 4 empty measures.',
    score: DEFAULT_BLANK_SCORE,
  },
  band_trio: {
    name: 'Concert Band Trio',
    description: 'Flute, Trumpet, and Trombone trio with lively harmony.',
    score: {
      id: 'score_band_trio',
      title: 'Eagle Valley Fanfare',
      composer: 'Student Concert Band',
      tempo: 112,
      timeSignature: [4, 4],
      keySignature: 'C',
      tracks: [
        {
          id: 'track_flute',
          name: 'Flute',
          instrumentId: 'flute',
          clef: 'treble',
          volume: 0.8,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_fl_1',
              items: [
                { id: 'n_f1', type: 'note', pitch: { step: 'C', octave: 5 }, duration: 0.25 },
                { id: 'n_f2', type: 'note', pitch: { step: 'E', octave: 5 }, duration: 0.25 },
                { id: 'n_f3', type: 'note', pitch: { step: 'G', octave: 5 }, duration: 0.25 },
                { id: 'n_f4', type: 'note', pitch: { step: 'C', octave: 6 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_fl_2',
              items: [
                { id: 'n_f5', type: 'note', pitch: { step: 'B', octave: 5 }, duration: 0.5 },
                { id: 'n_f6', type: 'note', pitch: { step: 'G', octave: 5 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_fl_3',
              items: [
                { id: 'n_f7', type: 'note', pitch: { step: 'A', octave: 5 }, duration: 0.25 },
                { id: 'n_f8', type: 'note', pitch: { step: 'F', octave: 5 }, duration: 0.25 },
                { id: 'n_f9', type: 'note', pitch: { step: 'D', octave: 5 }, duration: 0.25 },
                { id: 'n_f10', type: 'note', pitch: { step: 'B', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_fl_4',
              items: [
                { id: 'n_f11', type: 'note', pitch: { step: 'C', octave: 5 }, duration: 1 },
              ],
            },
          ],
        },
        {
          id: 'track_tpt',
          name: 'Bb Trumpet',
          instrumentId: 'trumpet',
          clef: 'treble',
          volume: 0.75,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_tp_1',
              items: [
                { id: 'n_t1', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.5 },
                { id: 'n_t2', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tp_2',
              items: [
                { id: 'n_t3', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.25 },
                { id: 'n_t4', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                { id: 'n_t5', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tp_3',
              items: [
                { id: 'n_t6', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.5 },
                { id: 'n_t7', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tp_4',
              items: [
                { id: 'n_t8', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 1 },
              ],
            },
          ],
        },
        {
          id: 'track_tbn',
          name: 'Trombone',
          instrumentId: 'trombone',
          clef: 'bass',
          volume: 0.8,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_tb_1',
              items: [
                { id: 'n_b1', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 0.5 },
                { id: 'n_b2', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tb_2',
              items: [
                { id: 'n_b3', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 0.5 },
                { id: 'n_b4', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tb_3',
              items: [
                { id: 'n_b5', type: 'note', pitch: { step: 'F', octave: 2 }, duration: 0.5 },
                { id: 'n_b6', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tb_4',
              items: [
                { id: 'n_b7', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 1 },
              ],
            },
          ],
        },
      ],
    },
  },

  ode_to_joy_challenge: {
    name: 'Challenge: Beethoven\'s Ode to Joy',
    description: 'Find and fill in the 3 missing notes marked in orange!',
    score: {
      id: 'score_ode_to_joy',
      title: 'Ode to Joy (Fill-in-the-Blank Challenge)',
      composer: 'L. van Beethoven',
      tempo: 120,
      timeSignature: [4, 4],
      keySignature: 'C',
      tracks: [
        {
          id: 'track_ode_lead',
          name: 'Glockenspiel / Mallets',
          instrumentId: 'glockenspiel',
          clef: 'treble',
          volume: 0.85,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_od_1',
              items: [
                { id: 'o1', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
                { id: 'o2', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
                { id: 'o3', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                { id: 'o4', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_od_2',
              items: [
                { id: 'o5', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.25 },
                { id: 'o6', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                { id: 'o7', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
                // Missing note! (should be D4)
                { id: 'o8_blank', type: 'rest', duration: 0.25, isChallengeBlank: true },
              ],
            },
            {
              id: 'm_od_3',
              items: [
                { id: 'o9', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.25 },
                { id: 'o10', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.25 },
                // Missing note! (should be D4)
                { id: 'o11_blank', type: 'rest', duration: 0.25, isChallengeBlank: true },
                { id: 'o12', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_od_4',
              items: [
                { id: 'o13', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25, isDotted: true },
                { id: 'o14', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.125 },
                // Missing note! (should be D4 half note)
                { id: 'o15_blank', type: 'rest', duration: 0.5, isChallengeBlank: true },
              ],
            },
          ],
        },
        {
          id: 'track_ode_bass',
          name: 'Cello Harmony',
          instrumentId: 'cello',
          clef: 'bass',
          volume: 0.75,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_ob_1',
              items: [
                { id: 'ob1', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 0.5 },
                { id: 'ob2', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_ob_2',
              items: [
                { id: 'ob3', type: 'note', pitch: { step: 'E', octave: 3 }, duration: 0.5 },
                { id: 'ob4', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_ob_3',
              items: [
                { id: 'ob5', type: 'note', pitch: { step: 'A', octave: 2 }, duration: 0.5 },
                { id: 'ob6', type: 'note', pitch: { step: 'F', octave: 2 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_ob_4',
              items: [
                { id: 'ob7', type: 'note', pitch: { step: 'G', octave: 2 }, duration: 1 },
              ],
            },
          ],
        },
      ],
    },
  },

  twinkle_challenge: {
    name: 'Challenge: Twinkle Twinkle Little Star',
    description: 'Solve the missing high G and E note puzzle!',
    score: {
      id: 'score_twinkle',
      title: 'Twinkle Twinkle Little Star',
      composer: 'Traditional Song',
      tempo: 104,
      timeSignature: [4, 4],
      keySignature: 'C',
      tracks: [
        {
          id: 'track_twinkle',
          name: 'Violin Melody',
          instrumentId: 'violin',
          clef: 'treble',
          volume: 0.8,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_tw_1',
              items: [
                { id: 'tw1', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.25 },
                { id: 'tw2', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.25 },
                { id: 'tw3', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.25 },
                // Missing note! (should be G4)
                { id: 'tw4_blank', type: 'rest', duration: 0.25, isChallengeBlank: true },
              ],
            },
            {
              id: 'm_tw_2',
              items: [
                { id: 'tw5', type: 'note', pitch: { step: 'A', octave: 4 }, duration: 0.25 },
                { id: 'tw6', type: 'note', pitch: { step: 'A', octave: 4 }, duration: 0.25 },
                { id: 'tw7', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_tw_3',
              items: [
                { id: 'tw8', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                { id: 'tw9', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                // Missing note! (should be E4)
                { id: 'tw10_blank', type: 'rest', duration: 0.25, isChallengeBlank: true },
                { id: 'tw11', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_tw_4',
              items: [
                { id: 'tw12', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.25 },
                { id: 'tw13', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.25 },
                { id: 'tw14', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.5 },
              ],
            },
          ],
        },
      ],
    },
  },

  piano_solo: {
    name: 'Piano Solo (Grand Staff)',
    description: 'Linked Treble and Bass staves for keyboard composition.',
    score: {
      id: 'score_piano_solo',
      title: 'First Piano Invention',
      composer: 'Student Composer',
      tempo: 108,
      timeSignature: [4, 4],
      keySignature: 'C',
      tracks: [
        {
          id: 'track_rh',
          name: 'Piano (Right Hand)',
          instrumentId: 'piano_treble',
          clef: 'treble',
          volume: 0.8,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_pr_1',
              items: [
                { id: 'p_r1', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.25 },
                { id: 'p_r2', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.25 },
                { id: 'p_r3', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
                { id: 'p_r4', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_pr_2',
              items: [
                { id: 'p_r5', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.5 },
                { id: 'p_r6', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_pr_3',
              items: [
                { id: 'p_r7', type: 'note', pitch: { step: 'A', octave: 4 }, duration: 0.25 },
                { id: 'p_r8', type: 'note', pitch: { step: 'G', octave: 4 }, duration: 0.25 },
                { id: 'p_r9', type: 'note', pitch: { step: 'F', octave: 4 }, duration: 0.25 },
                { id: 'p_r10', type: 'note', pitch: { step: 'E', octave: 4 }, duration: 0.25 },
              ],
            },
            {
              id: 'm_pr_4',
              items: [
                { id: 'p_r11', type: 'note', pitch: { step: 'D', octave: 4 }, duration: 0.5 },
                { id: 'p_r12', type: 'note', pitch: { step: 'C', octave: 4 }, duration: 0.5 },
              ],
            },
          ],
        },
        {
          id: 'track_lh',
          name: 'Piano (Left Hand)',
          instrumentId: 'piano_bass',
          clef: 'bass',
          volume: 0.8,
          muted: false,
          soloed: false,
          measures: [
            {
              id: 'm_pl_1',
              items: [
                { id: 'p_l1', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 1 },
              ],
            },
            {
              id: 'm_pl_2',
              items: [
                { id: 'p_l2', type: 'note', pitch: { step: 'E', octave: 3 }, duration: 0.5 },
                { id: 'p_l3', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_pl_3',
              items: [
                { id: 'p_l4', type: 'note', pitch: { step: 'F', octave: 3 }, duration: 0.5 },
                { id: 'p_l5', type: 'note', pitch: { step: 'G', octave: 3 }, duration: 0.5 },
              ],
            },
            {
              id: 'm_pl_4',
              items: [
                { id: 'p_l6', type: 'note', pitch: { step: 'C', octave: 3 }, duration: 1 },
              ],
            },
          ],
        },
      ],
    },
  },
};
