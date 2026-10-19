export interface EquationItem {
  type: 'note' | 'operator' | 'unknown' | 'text';
  value: string;
}

export interface TheoryQuestion {
  id: string;
  levelNumber: number;
  questionType: 'note_name' | 'beat_value' | 'beat_sum' | 'measure_completion' | 'counting_syllables' | 'rest_name';
  prompt: string;
  subPrompt?: string;
  symbolNotation?: string;
  visualType?:
    | 'quarter'
    | 'eighth_pair'
    | 'sixteenth_quad'
    | 'half'
    | 'whole'
    | 'dotted_half'
    | 'dotted_quarter'
    | 'single_eighth'
    | 'triplet'
    | 'quarter_rest'
    | 'half_rest'
    | 'whole_rest'
    | 'time_3_4'
    | 'time_4_4'
    | 'time_6_8'
    | 'syncopation_beat'
    | 'broken_eighth_two_sixteenth'
    | 'broken_two_sixteenth_eighth'
    | 'broken_dotted_sixteenth';
  equationItems?: EquationItem[];
  options: {
    id: string;
    label: string;
    isCorrect: boolean;
  }[];
  explanation: string;
}

export const THEORY_QUESTIONS: TheoryQuestion[] = [
  // ==================== LEVEL 1 (10 QUESTIONS) ====================
  {
    id: 'tq_l1_1',
    levelNumber: 1,
    questionType: 'note_name',
    prompt: 'What is the name of this musical note?',
    visualType: 'quarter',
    symbolNotation: 'Quarter Note',
    options: [
      { id: 'opt1', label: 'Quarter Note', isCorrect: true },
      { id: 'opt2', label: 'Eighth Note Pair', isCorrect: false },
      { id: 'opt3', label: 'Half Note', isCorrect: false },
      { id: 'opt4', label: 'Whole Note', isCorrect: false }
    ],
    explanation: 'A Quarter Note receives 1 beat count in 4/4 time.'
  },
  {
    id: 'tq_l1_2',
    levelNumber: 1,
    questionType: 'beat_value',
    prompt: 'How many beats does a single Quarter Note get in 4/4 time?',
    equationItems: [
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter Note = ?',
    options: [
      { id: 'opt1', label: '1 Beat', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: 'Half a Beat (0.5)', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: 'A Quarter Note lasts for exactly 1 steady beat count.'
  },
  {
    id: 'tq_l1_3',
    levelNumber: 1,
    questionType: 'note_name',
    prompt: 'What is the name of these connected notes?',
    visualType: 'eighth_pair',
    symbolNotation: 'Eighth Notes Pair',
    options: [
      { id: 'opt1', label: 'Eighth Notes Pair', isCorrect: true },
      { id: 'opt2', label: 'Quarter Note', isCorrect: false },
      { id: 'opt3', label: 'Sixteenth Notes', isCorrect: false },
      { id: 'opt4', label: 'Half Rest', isCorrect: false }
    ],
    explanation: 'This is a pair of beamed Eighth Notes ("Ti-Ti"). Together they span 1 full beat.'
  },
  {
    id: 'tq_l1_4',
    levelNumber: 1,
    questionType: 'beat_sum',
    prompt: 'Add up the beats! What is the total value of this rhythm?',
    equationItems: [
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter + Eighth Pair = ?',
    options: [
      { id: 'opt1', label: '2 Beats', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: 'Quarter Note (1 beat) + Eighth Notes Pair (1 beat) = 2 total beats!'
  },
  {
    id: 'tq_l1_5',
    levelNumber: 1,
    questionType: 'rest_name',
    prompt: 'What symbol represents 1 beat of silence?',
    visualType: 'quarter_rest',
    symbolNotation: 'Quarter Rest',
    options: [
      { id: 'opt1', label: 'Quarter Rest', isCorrect: true },
      { id: 'opt2', label: 'Half Rest', isCorrect: false },
      { id: 'opt3', label: 'Whole Note', isCorrect: false },
      { id: 'opt4', label: 'Eighth Rest', isCorrect: false }
    ],
    explanation: 'This squiggle is a Quarter Rest! You remain silent for 1 beat count.'
  },
  {
    id: 'tq_l1_6',
    levelNumber: 1,
    questionType: 'counting_syllables',
    prompt: 'Which number count corresponds to the second beat in a measure?',
    visualType: 'time_4_4',
    symbolNotation: '4/4 Measure Beat Counting',
    options: [
      { id: 'opt1', label: 'Count 2', isCorrect: true },
      { id: 'opt2', label: 'Count 1', isCorrect: false },
      { id: 'opt3', label: 'Count 4', isCorrect: false },
      { id: 'opt4', label: 'Count &', isCorrect: false }
    ],
    explanation: 'As the measure progresses, beats are counted sequentially: 1, 2, 3, 4!'
  },
  {
    id: 'tq_l1_7',
    levelNumber: 1,
    questionType: 'beat_sum',
    prompt: 'What is the sum of two Quarter Notes?',
    equationItems: [
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter + Quarter = ?',
    options: [
      { id: 'opt1', label: '2 Beats', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '4 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: 'Each Quarter Note is 1 beat. 1 + 1 = 2 total beats.'
  },
  {
    id: 'tq_l1_8',
    levelNumber: 1,
    questionType: 'rest_name',
    prompt: 'If you see a Quarter Rest on beat 3, what do you do?',
    visualType: 'quarter_rest',
    symbolNotation: 'Quarter Rest on Beat 3',
    options: [
      { id: 'opt1', label: 'Stay silent on beat 3', isCorrect: true },
      { id: 'opt2', label: 'Clap loudly on beat 3', isCorrect: false },
      { id: 'opt3', label: 'Hold for 2 beats', isCorrect: false },
      { id: 'opt4', label: 'Skip to beat 1', isCorrect: false }
    ],
    explanation: 'A Quarter Rest means 1 silent beat! You rest quietly without tapping.'
  },
  {
    id: 'tq_l1_9',
    levelNumber: 1,
    questionType: 'counting_syllables',
    prompt: 'What Kodály syllable is commonly used for a Quarter Note?',
    visualType: 'quarter',
    symbolNotation: 'Kodály Syllable',
    options: [
      { id: 'opt1', label: 'Ta', isCorrect: true },
      { id: 'opt2', label: 'Ti-Ti', isCorrect: false },
      { id: 'opt3', label: 'Too-oo', isCorrect: false },
      { id: 'opt4', label: 'Shh', isCorrect: false }
    ],
    explanation: '"Ta" is the elementary Kodály syllable for a single quarter beat.'
  },
  {
    id: 'tq_l1_10',
    levelNumber: 1,
    questionType: 'beat_sum',
    prompt: 'How many beats is 1 Quarter Note + 1 Quarter Rest?',
    equationItems: [
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter Note + Quarter Rest = ?',
    options: [
      { id: 'opt1', label: '2 Beats total', isCorrect: true },
      { id: 'opt2', label: '1 Beat total', isCorrect: false },
      { id: 'opt3', label: '3 Beats total', isCorrect: false },
      { id: 'opt4', label: '0 Beats', isCorrect: false }
    ],
    explanation: '1 sound beat + 1 silent beat = 2 measure beats total!'
  },

  // ==================== LEVEL 2 (13 QUESTIONS) ====================
  {
    id: 'tq_l2_1',
    levelNumber: 2,
    questionType: 'note_name',
    prompt: 'What is the name of this open-headed note with a stem?',
    visualType: 'half',
    symbolNotation: 'Half Note',
    options: [
      { id: 'opt1', label: 'Half Note', isCorrect: true },
      { id: 'opt2', label: 'Quarter Note', isCorrect: false },
      { id: 'opt3', label: 'Whole Note', isCorrect: false },
      { id: 'opt4', label: 'Eighth Note', isCorrect: false }
    ],
    explanation: 'This open notehead with a stem is a Half Note ("Too-oo"). It receives 2 full beats!'
  },
  {
    id: 'tq_l2_2',
    levelNumber: 2,
    questionType: 'beat_sum',
    prompt: 'Calculate the total beats for this combination:',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Half Note + Quarter Note = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '4 Beats', isCorrect: false },
      { id: 'opt4', label: '1.5 Beats', isCorrect: false }
    ],
    explanation: 'Half Note (2 beats) + Quarter Note (1 beat) = 3 total beats.'
  },
  {
    id: 'tq_l2_3',
    levelNumber: 2,
    questionType: 'note_name',
    prompt: 'What is the name of this open oval note without a stem?',
    visualType: 'whole',
    symbolNotation: 'Whole Note',
    options: [
      { id: 'opt1', label: 'Whole Note', isCorrect: true },
      { id: 'opt2', label: 'Half Note', isCorrect: false },
      { id: 'opt3', label: 'Quarter Note', isCorrect: false },
      { id: 'opt4', label: 'Whole Rest', isCorrect: false }
    ],
    explanation: 'A Whole Note is an open circle without any stem. It fills 4 complete beats!'
  },
  {
    id: 'tq_l2_4',
    levelNumber: 2,
    questionType: 'measure_completion',
    prompt: 'How many Quarter Notes are needed to fill a complete 4/4 measure?',
    visualType: 'time_4_4',
    symbolNotation: '4/4 Measure Fill',
    options: [
      { id: 'opt1', label: '4 Quarter Notes', isCorrect: true },
      { id: 'opt2', label: '2 Quarter Notes', isCorrect: false },
      { id: 'opt3', label: '8 Quarter Notes', isCorrect: false },
      { id: 'opt4', label: '3 Quarter Notes', isCorrect: false }
    ],
    explanation: '4/4 time has 4 beats per measure, so 4 quarter notes fill the entire measure!'
  },
  {
    id: 'tq_l2_5',
    levelNumber: 2,
    questionType: 'rest_name',
    prompt: 'What rest sits on top of the middle staff line like a hat?',
    visualType: 'half_rest',
    symbolNotation: 'Half Rest',
    options: [
      { id: 'opt1', label: 'Half Rest (2 Beats)', isCorrect: true },
      { id: 'opt2', label: 'Whole Rest (4 Beats)', isCorrect: false },
      { id: 'opt3', label: 'Quarter Rest (1 Beat)', isCorrect: false },
      { id: 'opt4', label: 'Eighth Rest', isCorrect: false }
    ],
    explanation: 'A Half Rest looks like a hat sitting on the staff line. It lasts for 2 silent beats.'
  },
  {
    id: 'tq_l2_6',
    levelNumber: 2,
    questionType: 'beat_sum',
    prompt: 'Add up: Half Note + Half Note',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Half Note + Half Note = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '8 Beats', isCorrect: false }
    ],
    explanation: '2 beats + 2 beats = 4 beats total (a full 4/4 measure!).'
  },
  {
    id: 'tq_l2_7',
    levelNumber: 2,
    questionType: 'counting_syllables',
    prompt: 'How do you count a Half Note starting on beat 1?',
    visualType: 'half',
    symbolNotation: 'Half Note Counting',
    options: [
      { id: 'opt1', label: '1 - 2', isCorrect: true },
      { id: 'opt2', label: '1 &', isCorrect: false },
      { id: 'opt3', label: '1 e & a', isCorrect: false },
      { id: 'opt4', label: '1 - 2 - 3 - 4', isCorrect: false }
    ],
    explanation: 'A Half Note holds through beats 1 and 2, counted as "1 - 2"!'
  },
  {
    id: 'tq_l2_8',
    levelNumber: 2,
    questionType: 'rest_name',
    prompt: 'What rest hangs below the staff line like a hole/upside-down hat?',
    visualType: 'whole_rest',
    symbolNotation: 'Whole Rest',
    options: [
      { id: 'opt1', label: 'Whole Rest (4 Beats)', isCorrect: true },
      { id: 'opt2', label: 'Half Rest (2 Beats)', isCorrect: false },
      { id: 'opt3', label: 'Quarter Rest', isCorrect: false },
      { id: 'opt4', label: 'Eighth Rest', isCorrect: false }
    ],
    explanation: 'A Whole Rest hangs beneath a line like a hole in the ground. It gives 4 beats of silence!'
  },
  {
    id: 'tq_l2_9',
    levelNumber: 2,
    questionType: 'beat_value',
    prompt: 'How many beats does 1 Whole Note receive in 4/4 time?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '1 Beat', isCorrect: false }
    ],
    explanation: 'A Whole Note receives 4 complete beat counts.'
  },
  {
    id: 'tq_l2_10',
    levelNumber: 2,
    questionType: 'beat_sum',
    prompt: 'Calculate: Whole Note - Half Note = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - Half Note = ?',
    options: [
      { id: 'opt1', label: '2 Beats (Half Note)', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '0 Beats', isCorrect: false }
    ],
    explanation: '4 beats minus 2 beats equals 2 beats (the value of a Half Note!).'
  },
  {
    id: 'tq_l2_11',
    levelNumber: 2,
    questionType: 'counting_syllables',
    prompt: 'What Kodály syllable is used for a Half Note?',
    visualType: 'half',
    symbolNotation: 'Kodály Syllables',
    options: [
      { id: 'opt1', label: 'Ta-Ah', isCorrect: true },
      { id: 'opt2', label: 'Ta', isCorrect: false },
      { id: 'opt3', label: 'Ti-Ti', isCorrect: false },
      { id: 'opt4', label: 'Tika-Tika', isCorrect: false }
    ],
    explanation: '"Ta-Ah" represents the 2 sustained beats of a Half Note.'
  },
  {
    id: 'tq_l2_12',
    levelNumber: 2,
    questionType: 'measure_completion',
    prompt: 'A measure in 4/4 has 1 Half Note. What is needed to complete the measure?',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Half Note + ? = 4 Beats',
    options: [
      { id: 'opt1', label: '2 Beats (e.g. Half Note or 2 Quarters)', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: '4 beats required - 2 beats present = 2 beats needed to complete the measure!'
  },
  {
    id: 'tq_l2_13',
    levelNumber: 2,
    questionType: 'beat_sum',
    prompt: 'Add up: Quarter Note + Half Rest + Quarter Note',
    equationItems: [
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter + Half Rest + Quarter = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '2 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '1 beat + 2 silent beats + 1 beat = 4 beats in total.'
  },

  // ==================== LEVEL 3 (16 QUESTIONS) ====================
  {
    id: 'tq_l3_1',
    levelNumber: 3,
    questionType: 'note_name',
    prompt: 'What is the name of four connected notes with two top beam lines?',
    visualType: 'sixteenth_quad',
    symbolNotation: 'Sixteenth Notes Quad',
    options: [
      { id: 'opt1', label: 'Sixteenth Notes Quad', isCorrect: true },
      { id: 'opt2', label: 'Eighth Notes Pair', isCorrect: false },
      { id: 'opt3', label: 'Quarter Note', isCorrect: false },
      { id: 'opt4', label: 'Triplet Notes', isCorrect: false }
    ],
    explanation: 'Four notes connected by double beams are 16th Notes ("Tika-Tika"). All four fit in 1 beat!'
  },
  {
    id: 'tq_l3_2',
    levelNumber: 3,
    questionType: 'counting_syllables',
    prompt: 'How do you count a 4-pack of Sixteenth Notes on beat 1?',
    visualType: 'sixteenth_quad',
    symbolNotation: 'Counting Sixteenths',
    options: [
      { id: 'opt1', label: '1 e & a', isCorrect: true },
      { id: 'opt2', label: '1 & 2 &', isCorrect: false },
      { id: 'opt3', label: '1 la li', isCorrect: false },
      { id: 'opt4', label: '1 2 3 4', isCorrect: false }
    ],
    explanation: 'Standard numerical counting for 16th notes is "1 e & a"!'
  },
  {
    id: 'tq_l3_3',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'What is the total beat value of 4 Sixteenth Notes + 1 Quarter Note?',
    equationItems: [
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Sixteenths Quad + Quarter = ?',
    options: [
      { id: 'opt1', label: '2 Beats', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '1.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: 'Four 16th notes (1 beat) + Quarter Note (1 beat) = 2 total beats.'
  },
  {
    id: 'tq_l3_4',
    levelNumber: 3,
    questionType: 'note_name',
    prompt: 'What note has a dot next to a Half Note?',
    visualType: 'dotted_half',
    symbolNotation: 'Dotted Half Note',
    options: [
      { id: 'opt1', label: 'Dotted Half Note', isCorrect: true },
      { id: 'opt2', label: 'Quarter Note', isCorrect: false },
      { id: 'opt3', label: 'Whole Note', isCorrect: false },
      { id: 'opt4', label: 'Half Note', isCorrect: false }
    ],
    explanation: 'A dot adds half of the note\'s original value! Half Note (2) + 1 = 3 beats!'
  },
  {
    id: 'tq_l3_5',
    levelNumber: 3,
    questionType: 'beat_value',
    prompt: 'How many beats does a Dotted Half Note get in 4/4 or 3/4 time?',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Half Note = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '4 Beats', isCorrect: false },
      { id: 'opt4', label: '2.5 Beats', isCorrect: false }
    ],
    explanation: 'A Half Note is 2 beats, and the dot adds 1 beat = 3 beats total!'
  },
  {
    id: 'tq_l3_6',
    levelNumber: 3,
    questionType: 'beat_value',
    prompt: 'What does the TOP number in a 3/4 time signature tell you?',
    visualType: 'time_3_4',
    symbolNotation: '3/4 Time Signature',
    options: [
      { id: 'opt1', label: 'There are 3 beats in each measure', isCorrect: true },
      { id: 'opt2', label: 'Quarter notes get 3 beats', isCorrect: false },
      { id: 'opt3', label: 'Play 3 notes per minute', isCorrect: false },
      { id: 'opt4', label: 'Rest for 3 measures', isCorrect: false }
    ],
    explanation: 'The top number indicates how many beats are in every measure (3 beats!).'
  },
  {
    id: 'tq_l3_7',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'Calculate: Dotted Half Note + Quarter Note',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Half + Quarter = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '2 Beats', isCorrect: false }
    ],
    explanation: '3 beats + 1 beat = 4 beats (fills a 4/4 measure!).'
  },
  {
    id: 'tq_l3_8',
    levelNumber: 3,
    questionType: 'counting_syllables',
    prompt: 'What Kodály syllable is used for four Sixteenth Notes?',
    visualType: 'sixteenth_quad',
    symbolNotation: 'Kodály Syllables',
    options: [
      { id: 'opt1', label: 'Tika-Tika', isCorrect: true },
      { id: 'opt2', label: 'Ti-Ti', isCorrect: false },
      { id: 'opt3', label: 'Ta', isCorrect: false },
      { id: 'opt4', label: 'Syn-Co-Pa', isCorrect: false }
    ],
    explanation: '"Tika-Tika" is the classic classroom Kodály syllable for 16th notes.'
  },
  {
    id: 'tq_l3_9',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'Add: Eighth Note Pair + Sixteenth Notes Quad',
    equationItems: [
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Eighth Pair + Sixteenth Quad = ?',
    options: [
      { id: 'opt1', label: '2 Beats', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '6 Beats', isCorrect: false }
    ],
    explanation: '1 beat + 1 beat = 2 beats total.'
  },
  {
    id: 'tq_l3_10',
    levelNumber: 3,
    questionType: 'measure_completion',
    prompt: 'In 3/4 time, how many Quarter Notes fill one measure?',
    visualType: 'time_3_4',
    symbolNotation: '3/4 Time Measure Fill',
    options: [
      { id: 'opt1', label: '3 Quarter Notes', isCorrect: true },
      { id: 'opt2', label: '4 Quarter Notes', isCorrect: false },
      { id: 'opt3', label: '2 Quarter Notes', isCorrect: false },
      { id: 'opt4', label: '6 Quarter Notes', isCorrect: false }
    ],
    explanation: '3/4 time means 3 beats per measure, so 3 quarter notes fill it completely!'
  },
  {
    id: 'tq_l3_11',
    levelNumber: 3,
    questionType: 'beat_value',
    prompt: 'How many single 16th notes equal the value of 1 Quarter Note?',
    equationItems: [
      { type: 'unknown', value: '?' },
      { type: 'text', value: 'Sixteenth Notes' },
      { type: 'operator', value: '=' },
      { type: 'note', value: 'quarter' }
    ],
    symbolNotation: '? Sixteenth Notes = 1 Quarter Note',
    options: [
      { id: 'opt1', label: '4 Sixteenth Notes', isCorrect: true },
      { id: 'opt2', label: '2 Sixteenth Notes', isCorrect: false },
      { id: 'opt3', label: '8 Sixteenth Notes', isCorrect: false },
      { id: 'opt4', label: '3 Sixteenth Notes', isCorrect: false }
    ],
    explanation: 'Each 16th note is 1/4 of a beat. 4 sixteenth notes = 1 quarter note!'
  },
  {
    id: 'tq_l3_12',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'Calculate: Dotted Half Note + Half Rest',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Half + Half Rest = ?',
    options: [
      { id: 'opt1', label: '5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: 'Dotted Half (3) + Half Rest (2) = 5 total beats.'
  },
  {
    id: 'tq_l3_13',
    levelNumber: 3,
    questionType: 'counting_syllables',
    prompt: 'How is the second beat counted when preceded by a Quarter Note on beat 1?',
    visualType: 'time_4_4',
    symbolNotation: 'Quarter on Beat 1',
    options: [
      { id: 'opt1', label: 'Count 2', isCorrect: true },
      { id: 'opt2', label: 'Count 1 &', isCorrect: false },
      { id: 'opt3', label: 'Count 3', isCorrect: false },
      { id: 'opt4', label: 'Count e', isCorrect: false }
    ],
    explanation: 'The quarter note takes beat 1, so the next beat in sequence is beat 2!'
  },
  {
    id: 'tq_l3_14',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - Dotted Half Note = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - Dotted Half = ?',
    options: [
      { id: 'opt1', label: '1 Beat (Quarter Note)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '0.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '4 beats minus 3 beats = 1 beat (a Quarter Note!).'
  },
  {
    id: 'tq_l3_15',
    levelNumber: 3,
    questionType: 'measure_completion',
    prompt: 'A measure in 3/4 has a Half Note. What note is needed to complete beat 3?',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '3 Beats in 3/4' }
    ],
    symbolNotation: 'Half Note + ? = 3 Beats',
    options: [
      { id: 'opt1', label: '1 Quarter Note', isCorrect: true },
      { id: 'opt2', label: '1 Half Note', isCorrect: false },
      { id: 'opt3', label: '1 Whole Note', isCorrect: false },
      { id: 'opt4', label: '2 Quarter Notes', isCorrect: false }
    ],
    explanation: 'Half Note is 2 beats. Adding 1 Quarter Note (1 beat) equals 3 beats total.'
  },
  {
    id: 'tq_l3_16',
    levelNumber: 3,
    questionType: 'beat_sum',
    prompt: 'Add: 4 Sixteenth Notes + 2 Eighth Notes + 1 Quarter Note',
    equationItems: [
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Sixteenths + Eighths + Quarter = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '2 Beats', isCorrect: false },
      { id: 'opt4', label: '7 Beats', isCorrect: false }
    ],
    explanation: '1 beat + 1 beat + 1 beat = 3 beats total.'
  },

  // ==================== LEVEL 4 (19 QUESTIONS) ====================
  {
    id: 'tq_l4_1',
    levelNumber: 4,
    questionType: 'note_name',
    prompt: 'What pattern is 1 Eighth Note followed by 2 Sixteenth Notes?',
    visualType: 'eighth_pair',
    symbolNotation: 'Ti-Tika Pattern',
    options: [
      { id: 'opt1', label: 'Ti-Tika (8th + Two 16ths)', isCorrect: true },
      { id: 'opt2', label: 'Tika-Ti (Two 16ths + 8th)', isCorrect: false },
      { id: 'opt3', label: 'Tri-Po-Let', isCorrect: false },
      { id: 'opt4', label: 'Ta-Ah', isCorrect: false }
    ],
    explanation: 'Ti-Tika consists of one 8th note (half beat) plus two 16th notes (quarter beat each) = 1 beat total.'
  },
  {
    id: 'tq_l4_2',
    levelNumber: 4,
    questionType: 'counting_syllables',
    prompt: 'How is Ti-Tika (1 Eighth + 2 Sixteenths) counted numerically?',
    symbolNotation: 'Ti-Tika Counting',
    options: [
      { id: 'opt1', label: '1 & a', isCorrect: true },
      { id: 'opt2', label: '1 e &', isCorrect: false },
      { id: 'opt3', label: '1 e & a', isCorrect: false },
      { id: 'opt4', label: '1 & 2', isCorrect: false }
    ],
    explanation: 'The 8th note spans "1 &", and the two 16ths are "&" and "a", so it is spoken "1 & a"!'
  },
  {
    id: 'tq_l4_3',
    levelNumber: 4,
    questionType: 'note_name',
    prompt: 'What pattern is 2 Sixteenth Notes followed by 1 Eighth Note?',
    symbolNotation: 'Tika-Ti Pattern',
    options: [
      { id: 'opt1', label: 'Tika-Ti (Two 16ths + 8th)', isCorrect: true },
      { id: 'opt2', label: 'Ti-Tika', isCorrect: false },
      { id: 'opt3', label: 'Tim-Ka', isCorrect: false },
      { id: 'opt4', label: 'Syn-Co-Pa', isCorrect: false }
    ],
    explanation: 'Tika-Ti starts with two quick 16ths ("1 e") and ends with an 8th note ("&") = 1 beat total.'
  },
  {
    id: 'tq_l4_4',
    levelNumber: 4,
    questionType: 'counting_syllables',
    prompt: 'How is Tika-Ti (2 Sixteenths + 1 Eighth) counted numerically?',
    symbolNotation: 'Tika-Ti Counting',
    options: [
      { id: 'opt1', label: '1 e &', isCorrect: true },
      { id: 'opt2', label: '1 & a', isCorrect: false },
      { id: 'opt3', label: '1 e a', isCorrect: false },
      { id: 'opt4', label: '1 la li', isCorrect: false }
    ],
    explanation: 'Tika-Ti uses the first two 16th subdivisions "1 e" followed by the 8th duration on "&"!'
  },
  {
    id: 'tq_l4_5',
    levelNumber: 4,
    questionType: 'beat_value',
    prompt: 'What note has a dot next to a Quarter Note?',
    visualType: 'dotted_quarter',
    symbolNotation: 'Dotted Quarter Note',
    options: [
      { id: 'opt1', label: 'Dotted Quarter Note', isCorrect: true },
      { id: 'opt2', label: 'Dotted Half Note', isCorrect: false },
      { id: 'opt3', label: 'Quarter Rest', isCorrect: false },
      { id: 'opt4', label: 'Eighth Note', isCorrect: false }
    ],
    explanation: 'A Dotted Quarter Note receives 1.5 beats (1 quarter + 1 eighth note value).'
  },
  {
    id: 'tq_l4_6',
    levelNumber: 4,
    questionType: 'beat_value',
    prompt: 'How many beats does a Dotted Quarter Note get in 4/4 time?',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter Note = ?',
    options: [
      { id: 'opt1', label: '1.5 Beats (1 & a half)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '1 Beat', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: 'Quarter Note (1 beat) + Dot (0.5 beat) = 1.5 total beats!'
  },
  {
    id: 'tq_l4_7',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Add up: Dotted Quarter Note + Single Eighth Note',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Single Eighth = ?',
    options: [
      { id: 'opt1', label: '2 Beats', isCorrect: true },
      { id: 'opt2', label: '1.5 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '1 Beat', isCorrect: false }
    ],
    explanation: '1.5 beats + 0.5 beat = 2 complete beats!'
  },
  {
    id: 'tq_l4_8',
    levelNumber: 4,
    questionType: 'counting_syllables',
    prompt: 'What Kodály syllable is used for a Dotted Eighth + Sixteenth Note pattern?',
    symbolNotation: 'Tim-Ka Pattern',
    options: [
      { id: 'opt1', label: 'Tim-Ka', isCorrect: true },
      { id: 'opt2', label: 'Ti-Tika', isCorrect: false },
      { id: 'opt3', label: 'Tika-Ti', isCorrect: false },
      { id: 'opt4', label: 'Ta-Ah', isCorrect: false }
    ],
    explanation: '"Tim-Ka" represents a long dotted eighth followed by a short 16th note!'
  },
  {
    id: 'tq_l4_9',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Calculate: Dotted Quarter Note + Dotted Quarter Note + Quarter Note',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Dotted Quarter + Quarter = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '3.5 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 1.5 + 1 = 4 full beats in a measure!'
  },
  {
    id: 'tq_l4_10',
    levelNumber: 4,
    questionType: 'rest_name',
    prompt: 'How many beats is a Quarter Rest + Half Rest + Quarter Note?',
    equationItems: [
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Quarter Rest + Half Rest + Quarter = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '2 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '1 + 2 + 1 = 4 total beats.'
  },
  {
    id: 'tq_l4_11',
    levelNumber: 4,
    questionType: 'beat_value',
    prompt: 'What is the beat value of a Single Eighth Note?',
    visualType: 'single_eighth',
    symbolNotation: 'Single Eighth Note',
    options: [
      { id: 'opt1', label: '0.5 Beats (Half a Beat)', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '0.25 Beats', isCorrect: false },
      { id: 'opt4', label: '2 Beats', isCorrect: false }
    ],
    explanation: 'A Single Eighth Note has a flag on its stem and lasts for 0.5 beats.'
  },
  {
    id: 'tq_l4_12',
    levelNumber: 4,
    questionType: 'measure_completion',
    prompt: 'A measure in 4/4 has a Dotted Half Note (3 beats). What note completes the 4th beat?',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Dotted Half + ? = 4 Beats',
    options: [
      { id: 'opt1', label: '1 Quarter Note', isCorrect: true },
      { id: 'opt2', label: '1 Half Note', isCorrect: false },
      { id: 'opt3', label: '1 Eighth Note', isCorrect: false },
      { id: 'opt4', label: '2 Quarter Notes', isCorrect: false }
    ],
    explanation: '3 beats + 1 quarter note (1 beat) = 4 complete measure beats!'
  },
  {
    id: 'tq_l4_13',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Add: Ti-Tika (1 beat) + Tika-Ti (1 beat) + Half Note (2 beats)',
    equationItems: [
      { type: 'note', value: 'broken_eighth_two_sixteenth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_two_sixteenth_eighth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Ti-Tika + Tika-Ti + Half Note = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '2 Beats', isCorrect: false }
    ],
    explanation: '1 beat + 1 beat + 2 beats = 4 total beats.'
  },
  {
    id: 'tq_l4_14',
    levelNumber: 4,
    questionType: 'counting_syllables',
    prompt: 'In a Dotted Quarter + Single Eighth pair starting on beat 1, when is the 8th note played?',
    visualType: 'dotted_quarter',
    symbolNotation: 'Dotted Quarter + Eighth',
    options: [
      { id: 'opt1', label: 'On the "&" of beat 2', isCorrect: true },
      { id: 'opt2', label: 'On beat 2', isCorrect: false },
      { id: 'opt3', label: 'On beat 3', isCorrect: false },
      { id: 'opt4', label: 'On the "e" of beat 1', isCorrect: false }
    ],
    explanation: 'The dotted quarter holds through beat 1 and beat 2, so the eighth note hits right on "2 &"!'
  },
  {
    id: 'tq_l4_15',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - Dotted Quarter Note = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - Dotted Quarter = ?',
    options: [
      { id: 'opt1', label: '2.5 Beats (Dotted Half minus Quarter)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '1.5 Beats', isCorrect: false }
    ],
    explanation: '4 beats minus 1.5 beats = 2.5 beats total.'
  },
  {
    id: 'tq_l4_16',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Add: 2 Single Eighth Notes + 1 Dotted Half Note',
    equationItems: [
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Two Eighths + Dotted Half = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3.5 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '1 beat (two 8th notes) + 3 beats (dotted half) = 4 full beats.'
  },
  {
    id: 'tq_l4_17',
    levelNumber: 4,
    questionType: 'counting_syllables',
    prompt: 'What is the counting pattern for beat 3 when playing four 16th notes?',
    visualType: 'sixteenth_quad',
    symbolNotation: '16ths on Beat 3',
    options: [
      { id: 'opt1', label: '3 e & a', isCorrect: true },
      { id: 'opt2', label: '1 e & a', isCorrect: false },
      { id: 'opt3', label: '3 & 4 &', isCorrect: false },
      { id: 'opt4', label: '3 la li', isCorrect: false }
    ],
    explanation: 'On beat 3, 16th notes are counted sequentially as "3 e & a".'
  },
  {
    id: 'tq_l4_18',
    levelNumber: 4,
    questionType: 'beat_sum',
    prompt: 'Calculate: Half Note + Dotted Quarter Note + Single Eighth Note',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Half + Dotted Quarter + Eighth = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3.5 Beats', isCorrect: false },
      { id: 'opt3', label: '4.5 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '2 + 1.5 + 0.5 = 4 complete measure beats!'
  },
  {
    id: 'tq_l4_19',
    levelNumber: 4,
    questionType: 'rest_name',
    prompt: 'If a 4/4 measure has a Half Note (2 beats) and a Quarter Rest (1 beat), how much silence remains?',
    equationItems: [
      { type: 'note', value: 'half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Half + Quarter Rest + ? = 4 Beats',
    options: [
      { id: 'opt1', label: '1 Beat (e.g. Quarter Rest)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '0.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '2 beats sound + 1 beat rest leaves 1 remaining beat to complete 4 beats!'
  },

  // ==================== LEVEL 5 (22 QUESTIONS) ====================
  {
    id: 'tq_l5_1',
    levelNumber: 5,
    questionType: 'note_name',
    prompt: 'What pattern groups 3 Eighth Notes together under a bracket with the numeral 3?',
    visualType: 'triplet',
    symbolNotation: 'Eighth Note Triplet',
    options: [
      { id: 'opt1', label: 'Eighth Note Triplet (Tri-Po-Let)', isCorrect: true },
      { id: 'opt2', label: 'Sixteenth Quad', isCorrect: false },
      { id: 'opt3', label: 'Eighth Note Pair', isCorrect: false },
      { id: 'opt4', label: 'Quarter Note', isCorrect: false }
    ],
    explanation: 'A Triplet squeezes 3 equal notes into the time space of 2 regular 8th notes (1 beat total).'
  },
  {
    id: 'tq_l5_2',
    levelNumber: 5,
    questionType: 'counting_syllables',
    prompt: 'How is an Eighth Note Triplet on beat 1 spoken in Kodály or numerical style?',
    visualType: 'triplet',
    symbolNotation: 'Triplet Syllables',
    options: [
      { id: 'opt1', label: '1 la li  (or Tri-Po-Let)', isCorrect: true },
      { id: 'opt2', label: '1 e & a', isCorrect: false },
      { id: 'opt3', label: '1 & 2 &', isCorrect: false },
      { id: 'opt4', label: 'Ta-Ah-Ah', isCorrect: false }
    ],
    explanation: 'Triplets are counted "1 la li" (or spoken as "Tri-Po-Let") across 1 beat!'
  },
  {
    id: 'tq_l5_3',
    levelNumber: 5,
    questionType: 'note_name',
    prompt: 'What syncopated rhythm is an Eighth Note, Quarter Note, and Eighth Note grouped together?',
    visualType: 'syncopation_beat',
    symbolNotation: 'Syn-Co-Pa Pattern',
    options: [
      { id: 'opt1', label: 'Syn-Co-Pa (8th - Quarter - 8th)', isCorrect: true },
      { id: 'opt2', label: 'Tri-Po-Let', isCorrect: false },
      { id: 'opt3', label: 'Tika-Tika', isCorrect: false },
      { id: 'opt4', label: 'Ti-Tika', isCorrect: false }
    ],
    explanation: 'Syn-Co-Pa spans 2 full beats: 0.5 beat (Syn) + 1.0 beat (Co) + 0.5 beat (Pa)!'
  },
  {
    id: 'tq_l5_4',
    levelNumber: 5,
    questionType: 'beat_value',
    prompt: 'How many total beats does a complete Syn-Co-Pa unit last?',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa Total Beats',
    options: [
      { id: 'opt1', label: '2 Beats total', isCorrect: true },
      { id: 'opt2', label: '1 Beat total', isCorrect: false },
      { id: 'opt3', label: '3 Beats total', isCorrect: false },
      { id: 'opt4', label: '1.5 Beats', isCorrect: false }
    ],
    explanation: '0.5 + 1.0 + 0.5 = 2 complete beats across the measure!'
  },
  {
    id: 'tq_l5_5',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add up: Eighth Note Triplet + Eighth Note Triplet + Half Note',
    equationItems: [
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Triplet + Triplet + Half Note = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '1 beat (triplet) + 1 beat (triplet) + 2 beats (half note) = 4 beats total.'
  },
  {
    id: 'tq_l5_6',
    levelNumber: 5,
    questionType: 'beat_value',
    prompt: 'In a 6/8 time signature, which note gets 1 main pulse count?',
    visualType: 'time_6_8',
    symbolNotation: '6/8 Time Signature',
    options: [
      { id: 'opt1', label: 'Eighth Note', isCorrect: true },
      { id: 'opt2', label: 'Quarter Note', isCorrect: false },
      { id: 'opt3', label: 'Half Note', isCorrect: false },
      { id: 'opt4', label: 'Sixteenth Note', isCorrect: false }
    ],
    explanation: 'The bottom number 8 in 6/8 means the Eighth Note receives 1 count beat!'
  },
  {
    id: 'tq_l5_7',
    levelNumber: 5,
    questionType: 'measure_completion',
    prompt: 'How many Eighth Notes are in a full measure of 6/8 time?',
    visualType: 'time_6_8',
    symbolNotation: '6/8 Measure Fill',
    options: [
      { id: 'opt1', label: '6 Eighth Notes', isCorrect: true },
      { id: 'opt2', label: '8 Eighth Notes', isCorrect: false },
      { id: 'opt3', label: '3 Eighth Notes', isCorrect: false },
      { id: 'opt4', label: '4 Eighth Notes', isCorrect: false }
    ],
    explanation: '6/8 time signature has 6 eighth note counts in every measure.'
  },
  {
    id: 'tq_l5_8',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: Syn-Co-Pa (2 beats) + Syn-Co-Pa (2 beats)',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa + Syn-Co-Pa = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '6 Beats', isCorrect: false }
    ],
    explanation: '2 beats + 2 beats = 4 full beats in a measure!'
  },
  {
    id: 'tq_l5_9',
    levelNumber: 5,
    questionType: 'counting_syllables',
    prompt: 'How is Syn-Co-Pa counted on beats 1 and 2?',
    visualType: 'syncopation_beat',
    symbolNotation: 'Syn-Co-Pa Numerical Count',
    options: [
      { id: 'opt1', label: '1 & (2) &', isCorrect: true },
      { id: 'opt2', label: '1 e & a', isCorrect: false },
      { id: 'opt3', label: '1 & 2 &', isCorrect: false },
      { id: 'opt4', label: '1 la li 2 la li', isCorrect: false }
    ],
    explanation: 'The quarter note in the middle hits on "&" of beat 1 and holds through beat 2!'
  },
  {
    id: 'tq_l5_10',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: Dotted Quarter Note + Eighth Note Triplet + Quarter Note',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Triplet + Quarter = ?',
    options: [
      { id: 'opt1', label: '3.5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 1 + 1 = 3.5 beats total.'
  },
  {
    id: 'tq_l5_11',
    levelNumber: 5,
    questionType: 'note_name',
    prompt: 'In compound time like 6/8, how are the 6 beats usually grouped feeling-wise?',
    visualType: 'time_6_8',
    symbolNotation: '6/8 Dotted Quarter Pulse',
    options: [
      { id: 'opt1', label: '2 big dotted-quarter pulses (3 + 3)', isCorrect: true },
      { id: 'opt2', label: '3 even quarter pulses', isCorrect: false },
      { id: 'opt3', label: '4 marching beats', isCorrect: false },
      { id: 'opt4', label: '1 single long beat', isCorrect: false }
    ],
    explanation: '6/8 feels like two big swaying pulses, each containing 3 eighth note counts!'
  },
  {
    id: 'tq_l5_12',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - Syn-Co-Pa = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - Syn-Co-Pa = ?',
    options: [
      { id: 'opt1', label: '2 Beats (Half Note)', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '1.5 Beats', isCorrect: false }
    ],
    explanation: '4 beats minus 2 beats = 2 beats remaining.'
  },
  {
    id: 'tq_l5_13',
    levelNumber: 5,
    questionType: 'measure_completion',
    prompt: 'A measure in 4/4 has 1 Syn-Co-Pa (2 beats) and 1 Triplet (1 beat). What completes beat 4?',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Syn-Co-Pa + Triplet + ? = 4 Beats',
    options: [
      { id: 'opt1', label: '1 Quarter Note (1 beat)', isCorrect: true },
      { id: 'opt2', label: '1 Half Note', isCorrect: false },
      { id: 'opt3', label: '1 Eighth Note', isCorrect: false },
      { id: 'opt4', label: '1 Triplet', isCorrect: false }
    ],
    explanation: '2 beats + 1 beat = 3 beats. Adding 1 quarter note gives 4 complete beats.'
  },
  {
    id: 'tq_l5_14',
    levelNumber: 5,
    questionType: 'counting_syllables',
    prompt: 'What makes syncopation feel bouncy or unexpected in music?',
    visualType: 'syncopation_beat',
    symbolNotation: 'Syncopation Concept',
    options: [
      { id: 'opt1', label: 'Accent falls on off-beats instead of strong beats', isCorrect: true },
      { id: 'opt2', label: 'Playing only rests without any sound', isCorrect: false },
      { id: 'opt3', label: 'Playing as slow as possible', isCorrect: false },
      { id: 'opt4', label: 'Playing only whole notes', isCorrect: false }
    ],
    explanation: 'Syncopation shifts the rhythm accent away from the strong beats onto the unexpected off-beats!'
  },
  {
    id: 'tq_l5_15',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: 2 Eighth Note Triplets + Dotted Quarter Note + Single Eighth Note',
    equationItems: [
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Two Triplets + Dotted Quarter + Eighth = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3.5 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '1 + 1 + 1.5 + 0.5 = 4 full measure beats!'
  },
  {
    id: 'tq_l5_16',
    levelNumber: 5,
    questionType: 'beat_value',
    prompt: 'In 6/8 time, how many beats is a Dotted Quarter Note worth?',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'text', value: 'in 6/8 time' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter in 6/8 = ?',
    options: [
      { id: 'opt1', label: '3 Eighth Note counts', isCorrect: true },
      { id: 'opt2', label: '1.5 Eighth Note counts', isCorrect: false },
      { id: 'opt3', label: '6 Eighth Note counts', isCorrect: false },
      { id: 'opt4', label: '2 Eighth Note counts', isCorrect: false }
    ],
    explanation: 'A Quarter Note is 2 eighth counts + dot (1 eighth count) = 3 eighth counts in 6/8 time!'
  },
  {
    id: 'tq_l5_17',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: Sixteenth Quad + Eighth Triplet + Quarter Note',
    equationItems: [
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Sixteenths + Triplet + Quarter = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '2.5 Beats', isCorrect: false },
      { id: 'opt3', label: '4 Beats', isCorrect: false },
      { id: 'opt4', label: '2 Beats', isCorrect: false }
    ],
    explanation: '1 beat + 1 beat + 1 beat = 3 beats total.'
  },
  {
    id: 'tq_l5_18',
    levelNumber: 5,
    questionType: 'rest_name',
    prompt: 'Calculate: Dotted Half Note + Quarter Rest + Eighth Pair',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Half + Quarter Rest + Eighth Pair = ?',
    options: [
      { id: 'opt1', label: '5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '3 + 1 + 1 = 5 beats.'
  },
  {
    id: 'tq_l5_19',
    levelNumber: 5,
    questionType: 'counting_syllables',
    prompt: 'How many notes are played in 2 full Eighth Note Triplets?',
    visualType: 'triplet',
    symbolNotation: '2 Triplets Note Count',
    options: [
      { id: 'opt1', label: '6 Notes', isCorrect: true },
      { id: 'opt2', label: '3 Notes', isCorrect: false },
      { id: 'opt3', label: '4 Notes', isCorrect: false },
      { id: 'opt4', label: '8 Notes', isCorrect: false }
    ],
    explanation: 'Each triplet has 3 notes. 3 + 3 = 6 notes spanning 2 beats!'
  },
  {
    id: 'tq_l5_20',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: Syn-Co-Pa (2 beats) + Dotted Half Note (3 beats)',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa + Dotted Half = ?',
    options: [
      { id: 'opt1', label: '5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '3.5 Beats', isCorrect: false }
    ],
    explanation: '2 beats + 3 beats = 5 total beats.'
  },
  {
    id: 'tq_l5_21',
    levelNumber: 5,
    questionType: 'measure_completion',
    prompt: 'In 6/8 time, how many Dotted Quarter Notes fill a complete measure?',
    visualType: 'time_6_8',
    symbolNotation: '6/8 Dotted Quarter Fill',
    options: [
      { id: 'opt1', label: '2 Dotted Quarter Notes', isCorrect: true },
      { id: 'opt2', label: '3 Dotted Quarter Notes', isCorrect: false },
      { id: 'opt3', label: '1 Dotted Quarter Note', isCorrect: false },
      { id: 'opt4', label: '4 Dotted Quarter Notes', isCorrect: false }
    ],
    explanation: 'Each dotted quarter is 3 eighth counts. 3 + 3 = 6 eighth counts in 6/8 time!'
  },
  {
    id: 'tq_l5_22',
    levelNumber: 5,
    questionType: 'beat_sum',
    prompt: 'Add: Dotted Quarter Note + Single Eighth + Syn-Co-Pa',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Eighth + Syn-Co-Pa = ?',
    options: [
      { id: 'opt1', label: '4 Beats', isCorrect: true },
      { id: 'opt2', label: '3.5 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 0.5 + 2 = 4 complete beats (a full 4/4 measure!).'
  },

  // ==================== LEVEL 6 (25 QUESTIONS) ====================
  {
    id: 'tq_l6_1',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add up two Dotted Quarter Notes:',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Dotted Quarter = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '2.5 Beats', isCorrect: false },
      { id: 'opt3', label: '4 Beats', isCorrect: false },
      { id: 'opt4', label: '2 Beats', isCorrect: false }
    ],
    explanation: 'Each Dotted Quarter Note is 1.5 beats. 1.5 + 1.5 = 3 total beats!'
  },
  {
    id: 'tq_l6_2',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: (Two Quarter Notes) + Four Sixteenth Notes',
    equationItems: [
      { type: 'operator', value: '(' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: '(Quarter + Quarter) + Sixteenths = ?',
    options: [
      { id: 'opt1', label: '3 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '2.5 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: 'Two Quarter Notes (2 beats) + Four Sixteenth Notes (1 beat) = 3 total beats!'
  },
  {
    id: 'tq_l6_3',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add: Dotted Quarter + Dotted Quarter + Dotted Half Note',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Quarter + Dotted Quarter + Dotted Half = ?',
    options: [
      { id: 'opt1', label: '6 Beats', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '4.5 Beats', isCorrect: false },
      { id: 'opt4', label: '7 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 1.5 + 3 = 6 beats total.'
  },
  {
    id: 'tq_l6_4',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: Syn-Co-Pa + Triplet + Ti-Tika + Quarter Note',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_eighth_two_sixteenth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa + Triplet + Ti-Tika + Quarter = ?',
    options: [
      { id: 'opt1', label: '5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '4.5 Beats', isCorrect: false }
    ],
    explanation: '2 beats + 1 beat + 1 beat + 1 beat = 5 beats!'
  },
  {
    id: 'tq_l6_5',
    levelNumber: 6,
    questionType: 'measure_completion',
    prompt: 'In a 4/4 measure with 1 Dotted Quarter Note and 1 Sixteenth Quad, how many beats remain?',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Dotted Quarter (1.5) + Sixteenths (1) + ? = 4',
    options: [
      { id: 'opt1', label: '1.5 Beats (e.g. Dotted Quarter Note)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '1 Beat', isCorrect: false },
      { id: 'opt4', label: '2.5 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 1 = 2.5 beats. 4 - 2.5 = 1.5 beats remaining!'
  },
  {
    id: 'tq_l6_6',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - (Dotted Quarter + Single Eighth)',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'operator', value: '(' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - (Dotted Quarter + Eighth) = ?',
    options: [
      { id: 'opt1', label: '2 Beats (Half Note)', isCorrect: true },
      { id: 'opt2', label: '1 Beat', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '1.5 Beats', isCorrect: false }
    ],
    explanation: 'Dotted Quarter + Eighth = 2 beats. Whole Note (4) - 2 = 2 beats.'
  },
  {
    id: 'tq_l6_7',
    levelNumber: 6,
    questionType: 'counting_syllables',
    prompt: 'How many total sound events/taps occur in a measure containing: [Sixteenths Quad] + [Triplet] + [Eighth Pair] + [Quarter Note]?',
    symbolNotation: 'Event Count Master Calculation',
    options: [
      { id: 'opt1', label: '10 Taps/Sounds', isCorrect: true },
      { id: 'opt2', label: '8 Taps/Sounds', isCorrect: false },
      { id: 'opt3', label: '12 Taps/Sounds', isCorrect: false },
      { id: 'opt4', label: '9 Taps/Sounds', isCorrect: false }
    ],
    explanation: '4 (sixteenths) + 3 (triplet) + 2 (eighth pair) + 1 (quarter) = 10 total sound taps!'
  },
  {
    id: 'tq_l6_8',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add: 3 Dotted Quarter Notes + 1 Dotted Half Note',
    equationItems: [
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Three Dotted Quarters + Dotted Half = ?',
    options: [
      { id: 'opt1', label: '7.5 Beats', isCorrect: true },
      { id: 'opt2', label: '6 Beats', isCorrect: false },
      { id: 'opt3', label: '8 Beats', isCorrect: false },
      { id: 'opt4', label: '7 Beats', isCorrect: false }
    ],
    explanation: '1.5 + 1.5 + 1.5 = 4.5. Plus 3 = 7.5 beats!'
  },
  {
    id: 'tq_l6_9',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: Syn-Co-Pa + Tika-Ti + Ti-Tika + Quarter Rest',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_two_sixteenth_eighth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_eighth_two_sixteenth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa + Tika-Ti + Ti-Tika + Rest = ?',
    options: [
      { id: 'opt1', label: '5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '3.5 Beats', isCorrect: false }
    ],
    explanation: '2 + 1 + 1 + 1 = 5 beats.'
  },
  {
    id: 'tq_l6_10',
    levelNumber: 6,
    questionType: 'measure_completion',
    prompt: 'In 6/8 time, how many Eighth Notes equal 1 Dotted Half Note?',
    visualType: 'time_6_8',
    symbolNotation: '6/8 Dotted Half Conversion',
    options: [
      { id: 'opt1', label: '6 Eighth Notes', isCorrect: true },
      { id: 'opt2', label: '4 Eighth Notes', isCorrect: false },
      { id: 'opt3', label: '3 Eighth Notes', isCorrect: false },
      { id: 'opt4', label: '8 Eighth Notes', isCorrect: false }
    ],
    explanation: 'A Half Note is 4 eighth counts + Dot (2 eighth counts) = 6 eighth notes in 6/8 time!'
  },
  {
    id: 'tq_l6_11',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add: Whole Note + Whole Rest + Half Note',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'whole_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole + Whole Rest + Half = ?',
    options: [
      { id: 'opt1', label: '10 Beats', isCorrect: true },
      { id: 'opt2', label: '8 Beats', isCorrect: false },
      { id: 'opt3', label: '12 Beats', isCorrect: false },
      { id: 'opt4', label: '6 Beats', isCorrect: false }
    ],
    explanation: '4 + 4 + 2 = 10 beats total.'
  },
  {
    id: 'tq_l6_12',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: (Triplet + Triplet) + (Sixteenths + Sixteenths)',
    equationItems: [
      { type: 'operator', value: '(' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '+' },
      { type: 'operator', value: '(' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: '2 Triplets + 2 Sixteenth Quads = ?',
    options: [
      { id: 'opt1', label: '4 Beats (Full Measure!)', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '5 Beats', isCorrect: false },
      { id: 'opt4', label: '6 Beats', isCorrect: false }
    ],
    explanation: '2 beats (triplets) + 2 beats (sixteenths) = 4 full measure beats!'
  },
  {
    id: 'tq_l6_13',
    levelNumber: 6,
    questionType: 'counting_syllables',
    prompt: 'How many total notes are contained in 4 Sixteenth Quads?',
    visualType: 'sixteenth_quad',
    symbolNotation: '4 Sixteenth Quads Note Count',
    options: [
      { id: 'opt1', label: '16 Notes', isCorrect: true },
      { id: 'opt2', label: '12 Notes', isCorrect: false },
      { id: 'opt3', label: '8 Notes', isCorrect: false },
      { id: 'opt4', label: '20 Notes', isCorrect: false }
    ],
    explanation: '4 x 4 = 16 sixteenth notes spanning 4 full beats.'
  },
  {
    id: 'tq_l6_14',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - Half Rest - Quarter Rest = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'half_rest' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole - Half Rest - Quarter Rest = ?',
    options: [
      { id: 'opt1', label: '1 Beat (Quarter Note)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '0.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '4 - 2 - 1 = 1 beat remaining.'
  },
  {
    id: 'tq_l6_15',
    levelNumber: 6,
    questionType: 'measure_completion',
    prompt: 'In 4/4 time, a measure has a Syn-Co-Pa (2 beats) and a Dotted Quarter + Single Eighth (2 beats). Is the measure complete?',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats?' }
    ],
    symbolNotation: 'Measure Complete Check',
    options: [
      { id: 'opt1', label: 'Yes, exactly 4 Beats!', isCorrect: true },
      { id: 'opt2', label: 'No, it needs 1 more beat', isCorrect: false },
      { id: 'opt3', label: 'No, it has 5 beats', isCorrect: false },
      { id: 'opt4', label: 'No, it only has 3 beats', isCorrect: false }
    ],
    explanation: '2 beats + 2 beats = 4 beats. Perfect measure!'
  },
  {
    id: 'tq_l6_16',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: 4 Eighth Pairs + 2 Quarter Rests',
    equationItems: [
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: '4 Eighth Pairs + 2 Quarter Rests = ?',
    options: [
      { id: 'opt1', label: '6 Beats', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '8 Beats', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: '4 beats (four 8th pairs) + 2 beats (rests) = 6 total beats.'
  },
  {
    id: 'tq_l6_17',
    levelNumber: 6,
    questionType: 'counting_syllables',
    prompt: 'What is the subdivision count for beat 4 in a measure with 16th notes?',
    symbolNotation: '16th Subdivisions Beat 4',
    options: [
      { id: 'opt1', label: '4 e & a', isCorrect: true },
      { id: 'opt2', label: '1 e & a', isCorrect: false },
      { id: 'opt3', label: '4 & 1 &', isCorrect: false },
      { id: 'opt4', label: '4 la li', isCorrect: false }
    ],
    explanation: 'Beat 4 sixteenth notes are counted "4 e & a".'
  },
  {
    id: 'tq_l6_18',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add: Dotted Half Note + Dotted Quarter Note + Eighth Pair',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Dotted Half + Dotted Quarter + Eighth Pair = ?',
    options: [
      { id: 'opt1', label: '5.5 Beats', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '6 Beats', isCorrect: false },
      { id: 'opt4', label: '4.5 Beats', isCorrect: false }
    ],
    explanation: '3 + 1.5 + 1 = 5.5 beats total.'
  },
  {
    id: 'tq_l6_19',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: 3 Triplets + 1 Whole Note',
    equationItems: [
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Three Triplets + Whole Note = ?',
    options: [
      { id: 'opt1', label: '7 Beats', isCorrect: true },
      { id: 'opt2', label: '6 Beats', isCorrect: false },
      { id: 'opt3', label: '8 Beats', isCorrect: false },
      { id: 'opt4', label: '5 Beats', isCorrect: false }
    ],
    explanation: '3 beats (three triplets) + 4 beats (whole note) = 7 beats.'
  },
  {
    id: 'tq_l6_20',
    levelNumber: 6,
    questionType: 'measure_completion',
    prompt: 'How many 16th notes are required to fill a measure of 3/4 time?',
    visualType: 'time_3_4',
    symbolNotation: '16ths in 3/4 Measure',
    options: [
      { id: 'opt1', label: '12 Sixteenth Notes (3 quads)', isCorrect: true },
      { id: 'opt2', label: '16 Sixteenth Notes', isCorrect: false },
      { id: 'opt3', label: '8 Sixteenth Notes', isCorrect: false },
      { id: 'opt4', label: '6 Sixteenth Notes', isCorrect: false }
    ],
    explanation: '3 beats x 4 sixteenth notes per beat = 12 sixteenth notes!'
  },
  {
    id: 'tq_l6_21',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Subtract: Whole Note - Single Eighth Note = ?',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Whole Note - Single Eighth = ?',
    options: [
      { id: 'opt1', label: '3.5 Beats (Dotted Half + Quarter)', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '2.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3.75 Beats', isCorrect: false }
    ],
    explanation: '4 - 0.5 = 3.5 beats total.'
  },
  {
    id: 'tq_l6_22',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Add: Syn-Co-Pa + Dotted Half Note + Quarter Rest',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Syn-Co-Pa + Dotted Half + Quarter Rest = ?',
    options: [
      { id: 'opt1', label: '6 Beats', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '7 Beats', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: '2 + 3 + 1 = 6 beats.'
  },
  {
    id: 'tq_l6_23',
    levelNumber: 6,
    questionType: 'counting_syllables',
    prompt: 'What is the Kodály name for a syncopated 8th-Quarter-8th group?',
    visualType: 'syncopation_beat',
    symbolNotation: 'Kodály Syncopation Name',
    options: [
      { id: 'opt1', label: 'Syn-Co-Pa', isCorrect: true },
      { id: 'opt2', label: 'Ti-Tika', isCorrect: false },
      { id: 'opt3', label: 'Tri-Po-Let', isCorrect: false },
      { id: 'opt4', label: 'Tika-Tika', isCorrect: false }
    ],
    explanation: '"Syn-Co-Pa" is the Kodály syllable pattern for 8th - Quarter - 8th.'
  },
  {
    id: 'tq_l6_24',
    levelNumber: 6,
    questionType: 'beat_sum',
    prompt: 'Calculate: 2 Dotted Half Notes + 1 Whole Note',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'Two Dotted Halves + Whole Note = ?',
    options: [
      { id: 'opt1', label: '10 Beats', isCorrect: true },
      { id: 'opt2', label: '8 Beats', isCorrect: false },
      { id: 'opt3', label: '12 Beats', isCorrect: false },
      { id: 'opt4', label: '9 Beats', isCorrect: false }
    ],
    explanation: '3 + 3 + 4 = 10 beats in total.'
  },
  {
    id: 'tq_l6_25',
    levelNumber: 6,
    questionType: 'measure_completion',
    prompt: 'In a 4/4 measure, you play: [Tri-Po-Let] + [Ti-Tika] + [Tika-Ti]. What completes beat 4?',
    equationItems: [
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_eighth_two_sixteenth' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'broken_two_sixteenth_eighth' },
      { type: 'operator', value: '+' },
      { type: 'unknown', value: '?' },
      { type: 'operator', value: '=' },
      { type: 'text', value: '4 Beats' }
    ],
    symbolNotation: 'Master Measure Completion Check',
    options: [
      { id: 'opt1', label: '1 Quarter Note (1 beat)', isCorrect: true },
      { id: 'opt2', label: '1 Half Note', isCorrect: false },
      { id: 'opt3', label: '1 Eighth Note', isCorrect: false },
      { id: 'opt4', label: '1 Whole Note', isCorrect: false }
    ],
    explanation: '1 beat + 1 beat + 1 beat = 3 beats. Adding 1 quarter note completes the 4/4 measure!'
  },

  // ==================== LEVEL 7 (SECRET EASTER EGG LEVEL - 20 QUESTIONS) ====================
  {
    id: 'tq_l7_1',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET MASTER MATH: Add up [Syn-Co-Pa] + [Sixteenth Quad] + [Triplet] + [Dotted Quarter] + [Single Eighth]',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'single_eighth' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: Syn-Co-Pa + 16ths + Triplet + Dotted Quarter + 8th = ?',
    options: [
      { id: 'opt1', label: '6 Beats (+750 PTS!)', isCorrect: true },
      { id: 'opt2', label: '5 Beats', isCorrect: false },
      { id: 'opt3', label: '7 Beats', isCorrect: false },
      { id: 'opt4', label: '5.5 Beats', isCorrect: false }
    ],
    explanation: '2 (Syn-Co-Pa) + 1 (16ths) + 1 (triplet) + 1.5 (dotted quarter) + 0.5 (eighth) = 6 complete beats!'
  },
  {
    id: 'tq_l7_2',
    levelNumber: 7,
    questionType: 'counting_syllables',
    prompt: '⚡ SECRET SPEED DECODER: What total number of notes are in 2 Sixteenth Quads + 3 Triplets + 1 Syn-Co-Pa?',
    visualType: 'syncopation_beat',
    symbolNotation: 'SECRET: Mega Note Counter',
    options: [
      { id: 'opt1', label: '20 Total Notes', isCorrect: true },
      { id: 'opt2', label: '18 Total Notes', isCorrect: false },
      { id: 'opt3', label: '16 Total Notes', isCorrect: false },
      { id: 'opt4', label: '24 Total Notes', isCorrect: false }
    ],
    explanation: '8 (two 16th quads) + 9 (three triplets) + 3 (Syn-Co-Pa) = 20 total notes!'
  },
  {
    id: 'tq_l7_3',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET GAUNTLET: Calculate (Two Whole Notes) - (Three Dotted Quarters)',
    equationItems: [
      { type: 'operator', value: '(' },
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'whole' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '-' },
      { type: 'operator', value: '(' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (Whole + Whole) - (3 x Dotted Quarter) = ?',
    options: [
      { id: 'opt1', label: '3.5 Beats', isCorrect: true },
      { id: 'opt2', label: '4 Beats', isCorrect: false },
      { id: 'opt3', label: '3 Beats', isCorrect: false },
      { id: 'opt4', label: '2.5 Beats', isCorrect: false }
    ],
    explanation: '8 beats (two whole notes) minus 4.5 beats (three dotted quarters) = 3.5 beats!'
  },
  {
    id: 'tq_l7_4',
    levelNumber: 7,
    questionType: 'measure_completion',
    prompt: '⚡ SECRET 6/8 MASTERY: In 6/8 time, how many Sixteenth Notes equal 1 Dotted Half Note?',
    visualType: 'time_6_8',
    symbolNotation: 'SECRET: 6/8 16th Note Conversion',
    options: [
      { id: 'opt1', label: '12 Sixteenth Notes', isCorrect: true },
      { id: 'opt2', label: '16 Sixteenth Notes', isCorrect: false },
      { id: 'opt3', label: '8 Sixteenth Notes', isCorrect: false },
      { id: 'opt4', label: '6 Sixteenth Notes', isCorrect: false }
    ],
    explanation: 'A Dotted Half Note is 6 eighth counts in 6/8 time. Each eighth count contains 2 sixteenth notes = 12 sixteenth notes!'
  },
  {
    id: 'tq_l7_5',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET POLYRHYTHM: Add 4 Triplets + 2 Syn-Co-Pas + 1 Whole Note',
    equationItems: [
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: 4 Triplets + 2 Syn-Co-Pas + Whole Note = ?',
    options: [
      { id: 'opt1', label: '12 Beats', isCorrect: true },
      { id: 'opt2', label: '10 Beats', isCorrect: false },
      { id: 'opt3', label: '14 Beats', isCorrect: false },
      { id: 'opt4', label: '8 Beats', isCorrect: false }
    ],
    explanation: '4 beats (triplets) + 4 beats (two Syn-Co-Pas) + 4 beats (whole note) = 12 beats total!'
  },
  {
    id: 'tq_l7_6',
    levelNumber: 7,
    questionType: 'note_name',
    prompt: '⚡ SECRET THEORY: What is the exact subdivision duration of a single note in an Eighth Note Triplet?',
    visualType: 'triplet',
    symbolNotation: 'SECRET: Triplet Math',
    options: [
      { id: 'opt1', label: '1/3 of a beat (0.333 beats)', isCorrect: true },
      { id: 'opt2', label: '1/2 of a beat (0.5 beats)', isCorrect: false },
      { id: 'opt3', label: '1/4 of a beat (0.25 beats)', isCorrect: false },
      { id: 'opt4', label: '2/3 of a beat', isCorrect: false }
    ],
    explanation: '3 triplet notes squeeze into 1 beat, so each individual triplet note lasts exactly 1/3 of a beat!'
  },
  {
    id: 'tq_l7_7',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET EQUATION: (Dotted Half + Half Note) - (Syn-Co-Pa + Quarter Rest)',
    equationItems: [
      { type: 'operator', value: '(' },
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'half' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '-' },
      { type: 'operator', value: '(' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (3 + 2) - (2 + 1) = ?',
    options: [
      { id: 'opt1', label: '2 Beats (Half Note)', isCorrect: true },
      { id: 'opt2', label: '3 Beats', isCorrect: false },
      { id: 'opt3', label: '1 Beat', isCorrect: false },
      { id: 'opt4', label: '4 Beats', isCorrect: false }
    ],
    explanation: '5 beats minus 3 beats = 2 beats remaining!'
  },
  {
    id: 'tq_l7_8',
    levelNumber: 7,
    questionType: 'counting_syllables',
    prompt: '⚡ SECRET ROCKSTAR: How is a 16th note pattern on beat 2 counted when beat 1 is a Syn-Co-Pa?',
    visualType: 'syncopation_beat',
    symbolNotation: 'SECRET: Complex Beat Transition',
    options: [
      { id: 'opt1', label: '3 e & a (starts on beat 3!)', isCorrect: true },
      { id: 'opt2', label: '2 e & a', isCorrect: false },
      { id: 'opt3', label: '1 e & a', isCorrect: false },
      { id: 'opt4', label: '4 e & a', isCorrect: false }
    ],
    explanation: 'Syn-Co-Pa occupies beats 1 AND 2! Therefore, the very next beat pattern begins on beat 3 ("3 e & a")!'
  },
  {
    id: 'tq_l7_9',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET SPEED CALC: Add 5 Sixteenth Quads + 3 Quarter Notes',
    equationItems: [
      { type: 'text', value: '5 Sixteenth Quads' },
      { type: 'operator', value: '+' },
      { type: 'text', value: '3 Quarter Notes' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (5 x 16th Quads) + (3 x Quarters) = ?',
    options: [
      { id: 'opt1', label: '8 Beats', isCorrect: true },
      { id: 'opt2', label: '7 Beats', isCorrect: false },
      { id: 'opt3', label: '9 Beats', isCorrect: false },
      { id: 'opt4', label: '6 Beats', isCorrect: false }
    ],
    explanation: '5 beats + 3 beats = 8 beats in total!'
  },
  {
    id: 'tq_l7_10',
    levelNumber: 7,
    questionType: 'measure_completion',
    prompt: '⚡ SECRET MEASURE: In 4/4 time, two full measures contain how many total 16th note subdivisions?',
    visualType: 'time_4_4',
    symbolNotation: 'SECRET: Two Measures Subdivisions',
    options: [
      { id: 'opt1', label: '32 Sixteenth Subdivisions', isCorrect: true },
      { id: 'opt2', label: '16 Sixteenth Subdivisions', isCorrect: false },
      { id: 'opt3', label: '24 Sixteenth Subdivisions', isCorrect: false },
      { id: 'opt4', label: '64 Sixteenth Subdivisions', isCorrect: false }
    ],
    explanation: '8 total beats x 4 sixteenths per beat = 32 sixteenth note subdivisions across 2 measures!'
  },
  {
    id: 'tq_l7_11',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET ROCKSTAR: Add up 4 Dotted Quarter Notes + 2 Half Rests',
    equationItems: [
      { type: 'text', value: '4 Dotted Quarters' },
      { type: 'operator', value: '+' },
      { type: 'text', value: '2 Half Rests' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (4 x 1.5) + (2 x 2) = ?',
    options: [
      { id: 'opt1', label: '10 Beats', isCorrect: true },
      { id: 'opt2', label: '8 Beats', isCorrect: false },
      { id: 'opt3', label: '12 Beats', isCorrect: false },
      { id: 'opt4', label: '9 Beats', isCorrect: false }
    ],
    explanation: '6 beats (four dotted quarters) + 4 beats (two half rests) = 10 total beats.'
  },
  {
    id: 'tq_l7_12',
    levelNumber: 7,
    questionType: 'counting_syllables',
    prompt: '⚡ SECRET CHAMPION: What is the Kodály syllable string for 1 Triplet followed by 1 Sixteenth Quad?',
    symbolNotation: 'SECRET: Kodály Hybrid Combo',
    options: [
      { id: 'opt1', label: 'Tri-Po-Let Tika-Tika', isCorrect: true },
      { id: 'opt2', label: 'Ti-Ti Tika-Tika', isCorrect: false },
      { id: 'opt3', label: 'Ta Tika-Tika', isCorrect: false },
      { id: 'opt4', label: 'Syn-Co-Pa Tri-Po-Let', isCorrect: false }
    ],
    explanation: '"Tri-Po-Let" (beat 1) followed by "Tika-Tika" (beat 2).'
  },
  {
    id: 'tq_l7_13',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET MATH: Calculate Whole Note - (Sixteenth Quad + Triplet + Quarter Rest)',
    equationItems: [
      { type: 'note', value: 'whole' },
      { type: 'operator', value: '-' },
      { type: 'operator', value: '(' },
      { type: 'note', value: 'sixteenth_quad' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: ')' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: 4 - (1 + 1 + 1) = ?',
    options: [
      { id: 'opt1', label: '1 Beat (Quarter Note)', isCorrect: true },
      { id: 'opt2', label: '2 Beats', isCorrect: false },
      { id: 'opt3', label: '0.5 Beats', isCorrect: false },
      { id: 'opt4', label: '3 Beats', isCorrect: false }
    ],
    explanation: '4 beats - 3 beats = 1 beat remaining!'
  },
  {
    id: 'tq_l7_14',
    levelNumber: 7,
    questionType: 'measure_completion',
    prompt: '⚡ SECRET 3/4 TIME: How many total Eighth Note Triplets fit into one measure of 3/4 time?',
    visualType: 'time_3_4',
    symbolNotation: 'SECRET: Triplets in 3/4 Time',
    options: [
      { id: 'opt1', label: '3 Triplets (9 notes total)', isCorrect: true },
      { id: 'opt2', label: '4 Triplets', isCorrect: false },
      { id: 'opt3', label: '6 Triplets', isCorrect: false },
      { id: 'opt4', label: '2 Triplets', isCorrect: false }
    ],
    explanation: '3 beats per measure x 1 triplet per beat = 3 triplets (9 notes total).'
  },
  {
    id: 'tq_l7_15',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET FINALE: Add 2 Whole Notes + 3 Dotted Half Notes + 4 Quarter Notes',
    equationItems: [
      { type: 'text', value: '2 Whole Notes' },
      { type: 'operator', value: '+' },
      { type: 'text', value: '3 Dotted Halves' },
      { type: 'operator', value: '+' },
      { type: 'text', value: '4 Quarters' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (2 x 4) + (3 x 3) + (4 x 1) = ?',
    options: [
      { id: 'opt1', label: '21 Beats', isCorrect: true },
      { id: 'opt2', label: '18 Beats', isCorrect: false },
      { id: 'opt3', label: '24 Beats', isCorrect: false },
      { id: 'opt4', label: '19 Beats', isCorrect: false }
    ],
    explanation: '8 + 9 + 4 = 21 total beats!'
  },
  {
    id: 'tq_l7_16',
    levelNumber: 7,
    questionType: 'counting_syllables',
    prompt: '⚡ SECRET SUBDIVISION: How many 16th notes equal the duration of 1 Whole Note?',
    equationItems: [
      { type: 'unknown', value: '?' },
      { type: 'text', value: '16th Notes' },
      { type: 'operator', value: '=' },
      { type: 'note', value: 'whole' }
    ],
    symbolNotation: 'SECRET: ? 16th Notes = 1 Whole Note',
    options: [
      { id: 'opt1', label: '16 Sixteenth Notes', isCorrect: true },
      { id: 'opt2', label: '8 Sixteenth Notes', isCorrect: false },
      { id: 'opt3', label: '12 Sixteenth Notes', isCorrect: false },
      { id: 'opt4', label: '32 Sixteenth Notes', isCorrect: false }
    ],
    explanation: 'A Whole Note is 4 beats. 4 beats x 4 sixteenths per beat = 16 sixteenth notes!'
  },
  {
    id: 'tq_l7_17',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET PUZZLE: Calculate (3 x Syn-Co-Pa) + (2 x Triplet) + (1 x Quarter Rest)',
    equationItems: [
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'syncopation_beat' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'triplet' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter_rest' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: (3 x 2) + (2 x 1) + 1 = ?',
    options: [
      { id: 'opt1', label: '9 Beats', isCorrect: true },
      { id: 'opt2', label: '8 Beats', isCorrect: false },
      { id: 'opt3', label: '10 Beats', isCorrect: false },
      { id: 'opt4', label: '7.5 Beats', isCorrect: false }
    ],
    explanation: '6 + 2 + 1 = 9 total beats!'
  },
  {
    id: 'tq_l7_18',
    levelNumber: 7,
    questionType: 'measure_completion',
    prompt: '⚡ SECRET 6/8 TIME: In 6/8 time, how many Dotted Half Notes equal 12 eighth counts (2 full measures)?',
    visualType: 'time_6_8',
    symbolNotation: 'SECRET: 6/8 Two Measure Dotted Halves',
    options: [
      { id: 'opt1', label: '2 Dotted Half Notes', isCorrect: true },
      { id: 'opt2', label: '4 Dotted Half Notes', isCorrect: false },
      { id: 'opt3', label: '1 Dotted Half Note', isCorrect: false },
      { id: 'opt4', label: '3 Dotted Half Notes', isCorrect: false }
    ],
    explanation: 'In 6/8 time, each Dotted Half Note is 6 eighth counts. 2 x 6 = 12 eighth counts!'
  },
  {
    id: 'tq_l7_19',
    levelNumber: 7,
    questionType: 'beat_sum',
    prompt: '⚡ SECRET OVERLORD: Add 1 Dotted Half + 1 Dotted Quarter + 1 Quarter + 1 Eighth Pair',
    equationItems: [
      { type: 'note', value: 'dotted_half' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'dotted_quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'quarter' },
      { type: 'operator', value: '+' },
      { type: 'note', value: 'eighth_pair' },
      { type: 'operator', value: '=' },
      { type: 'unknown', value: '?' }
    ],
    symbolNotation: 'SECRET: 3 + 1.5 + 1 + 1 = ?',
    options: [
      { id: 'opt1', label: '6.5 Beats', isCorrect: true },
      { id: 'opt2', label: '6 Beats', isCorrect: false },
      { id: 'opt3', label: '7 Beats', isCorrect: false },
      { id: 'opt4', label: '5.5 Beats', isCorrect: false }
    ],
    explanation: '3 + 1.5 + 1 + 1 = 6.5 beats.'
  },
  {
    id: 'tq_l7_20',
    levelNumber: 7,
    questionType: 'counting_syllables',
    prompt: '⚡ SECRET GRAND FINALE: You conquered all 7 levels of Denti Rhythm Rockstars! What is the highest rank badge?',
    symbolNotation: 'SECRET: Rockstars Trophy Badge',
    options: [
      { id: 'opt1', label: 'Secret Rockstar Overlord (⚡)', isCorrect: true },
      { id: 'opt2', label: 'Rhythm Rookie', isCorrect: false },
      { id: 'opt3', label: 'Garage Jammer', isCorrect: false },
      { id: 'opt4', label: 'Beat Cadet', isCorrect: false }
    ],
    explanation: 'Congratulations! Conquering Level 7 awards you the Secret Rockstar Overlord badge!'
  }
];

export function getTheoryQuestionsForLevel(levelNumber: number): TheoryQuestion[] {
  const filtered = THEORY_QUESTIONS.filter(q => q.levelNumber === levelNumber);
  if (filtered.length > 0) return filtered;
  return THEORY_QUESTIONS.filter(q => q.levelNumber === 1);
}
