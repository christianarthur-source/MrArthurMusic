// Pure note/frequency helpers for the tuner. Erasable-syntax TypeScript (Node can run it).

export const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Transposing instruments: semitones added to the concert pitch to get the written pitch. */
export const TRANSPOSITIONS = {
  C: { label: 'C (concert)', semitones: 0 },
  Bb: { label: 'B♭ (trumpet, clarinet, tenor sax)', semitones: 2 },
  Eb: { label: 'E♭ (alto sax, baritone sax)', semitones: 9 },
  F: { label: 'F (French horn)', semitones: 7 },
} as const;
export type TranspositionKey = keyof typeof TRANSPOSITIONS;

export function hzToMidi(hz: number, a4: number): number {
  return 69 + 12 * Math.log2(hz / a4);
}

export function midiToHz(midi: number, a4: number): number {
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Cents of `hz` above `targetHz`. */
export function centsBetween(hz: number, targetHz: number): number {
  return 1200 * Math.log2(hz / targetHz);
}

export function noteName(midi: number, useFlats = false): string {
  const i = ((Math.round(midi) % 12) + 12) % 12;
  return (useFlats ? FLAT_NAMES : SHARP_NAMES)[i];
}

export function noteOctave(midi: number): number {
  return Math.floor(Math.round(midi) / 12) - 1;
}

export function noteLabel(midi: number, useFlats = false): string {
  return `${noteName(midi, useFlats)}${noteOctave(midi)}`;
}

/** The note a transposing player reads for a given concert MIDI note. */
export function writtenMidi(concertMidi: number, transposition: TranspositionKey): number {
  return concertMidi + TRANSPOSITIONS[transposition].semitones;
}
