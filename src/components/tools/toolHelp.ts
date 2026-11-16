import type { ToolId } from './ClassroomToolBoxModal';

/** Short "how to use it" notes for the Tool Box help panel (open it with the ? button or the ? key). */
export interface ToolHelp {
  steps: string[];
  keys?: { key: string; action: string }[];
}

export const TOOL_HELP: Record<ToolId, ToolHelp> = {
  metronome: {
    steps: [
      'Pick a speed with the slider, the + / - buttons, the animal presets or Tap Tempo.',
      'Choose how many beats are in a measure and how each beat is divided (quarter, eighth, triplet, 16th).',
      'Press Start. The first beat of each measure is the strong one.',
      'Turn on Flash Screen if you want to see the beat as well as hear it.',
    ],
    keys: [{ key: 'Space', action: 'Start / stop the metronome' }],
  },
  'tempo-tapper': {
    steps: [
      'Tap the big button (or press Space) along with a steady beat, at least a few times.',
      'The BPM and the matching animal speed appear. Keep tapping to make it more accurate.',
      'Switch to the Tempo Challenge tab to test your steady beat.',
    ],
    keys: [{ key: 'Space', action: 'Tap the beat' }],
  },
  'solfege-trainer': {
    steps: [
      'Tap a colored bell to hear the note and see its Curwen hand sign.',
      'Use the practice patterns to sing along: Do-Re-Mi and more.',
      'Try the ear-training challenge: listen, then pick the bell you heard.',
    ],
    keys: [{ key: '1 – 8', action: 'Play Do, Re, Mi, Fa, Sol, La, Ti, high Do' }],
  },
  'instrument-zoo': {
    steps: [
      'Choose an instrument family to filter the list, or browse them all.',
      'Tap a note on an instrument card to hear that instrument.',
      'Read the card to learn how the instrument sounds and which clef it reads.',
    ],
  },
  'dynamic-ears': {
    steps: [
      'Turn the microphone on to see a live loudness meter. The browser will ask permission first.',
      'No microphone? Use the dynamics buttons (soft to loud) to see and hear each level.',
      'Start the 60-second Quiet Challenge to see if the class can stay quiet.',
    ],
  },
  'song-starter': {
    steps: [
      'Pick a beat, then drag sound blocks onto the lanes to build your song.',
      'Press Play Song to hear it.',
      'Use the Remove button on a block to take it out, or Clear All to start again.',
    ],
  },
  'music-symbol-match': {
    steps: [
      'Memory mode: flip two cards to find a symbol and its name.',
      'Speed mode: answer as many as you can before the 45 seconds are up.',
      'Open the Study Guide for a cheat sheet of notes, rests, clefs and dynamics.',
    ],
  },
  tuner: {
    steps: [
      'Pick your instrument (guitar, violin, bass and more), or leave it on Chromatic.',
      'Press Start Listening and allow the microphone, then play one note at a time.',
      'Watch the big ruler: the line moves left when you are too low and right when you are too high. The small ruler below shows tiny differences.',
      'When it says In tune and the ring fills, move on. Tap a string to tune just that one, or leave it on Auto.',
      'Band instruments: open Settings (gear) and choose B♭, E♭ or F to see the note you read. The speaker button plays the concert reference pitch.',
    ],
  },

};
