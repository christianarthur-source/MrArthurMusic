import { NoteDefinition, StaffClef, GameDifficulty } from '../types';

export const TREBLE_NOTES: NoteDefinition[] = [
  // Extended Below
  { step: 'G', octave: 3, midi: 55, freq: 196.00, displayName: 'G3 (3 Ledgers Below)', staffOffset: -9, ledgerOffsets: [-6, -8], difficulty: 'advanced', clef: 'treble' },
  { step: 'A', octave: 3, midi: 57, freq: 220.00, displayName: 'A3 (2 Ledgers Below)', staffOffset: -8, ledgerOffsets: [-6, -8], difficulty: 'advanced', clef: 'treble' },
  { step: 'B', octave: 3, midi: 59, freq: 246.94, displayName: 'B3 (Under Middle C)', staffOffset: -7, ledgerOffsets: [-6], difficulty: 'advanced', clef: 'treble' },
  { step: 'C', octave: 4, midi: 60, freq: 261.63, displayName: 'C4 (Middle C)', staffOffset: -6, ledgerOffsets: [-6], difficulty: 'intermediate', clef: 'treble' },
  { step: 'D', octave: 4, midi: 62, freq: 293.66, displayName: 'D4 (Space Below Line 1)', staffOffset: -5, difficulty: 'intermediate', clef: 'treble' },

  // 5 Lines & 4 Spaces (Beginner)
  { step: 'E', octave: 4, midi: 64, freq: 329.63, displayName: 'E4 (Line 1)', staffOffset: -4, difficulty: 'beginner', clef: 'treble' },
  { step: 'F', octave: 4, midi: 65, freq: 349.23, displayName: 'F4 (Space 1)', staffOffset: -3, difficulty: 'beginner', clef: 'treble' },
  { step: 'G', octave: 4, midi: 67, freq: 392.00, displayName: 'G4 (Line 2)', staffOffset: -2, difficulty: 'beginner', clef: 'treble' },
  { step: 'A', octave: 4, midi: 69, freq: 440.00, displayName: 'A4 (Space 2)', staffOffset: -1, difficulty: 'beginner', clef: 'treble' },
  { step: 'B', octave: 4, midi: 71, freq: 493.88, displayName: 'B4 (Line 3)', staffOffset: 0, difficulty: 'beginner', clef: 'treble' },
  { step: 'C', octave: 5, midi: 72, freq: 523.25, displayName: 'C5 (Space 3)', staffOffset: 1, difficulty: 'beginner', clef: 'treble' },
  { step: 'D', octave: 5, midi: 74, freq: 587.33, displayName: 'D5 (Line 4)', staffOffset: 2, difficulty: 'beginner', clef: 'treble' },
  { step: 'E', octave: 5, midi: 76, freq: 659.25, displayName: 'E5 (Space 4)', staffOffset: 3, difficulty: 'beginner', clef: 'treble' },
  { step: 'F', octave: 5, midi: 77, freq: 698.46, displayName: 'F5 (Line 5)', staffOffset: 4, difficulty: 'beginner', clef: 'treble' },

  // Extended Above
  { step: 'G', octave: 5, midi: 79, freq: 783.99, displayName: 'G5 (Space Above Line 5)', staffOffset: 5, difficulty: 'intermediate', clef: 'treble' },
  { step: 'A', octave: 5, midi: 81, freq: 880.00, displayName: 'A5 (1 Ledger Above)', staffOffset: 6, ledgerOffsets: [6], difficulty: 'intermediate', clef: 'treble' },
  { step: 'B', octave: 5, midi: 83, freq: 987.77, displayName: 'B5 (Space Above Ledger)', staffOffset: 7, ledgerOffsets: [6], difficulty: 'advanced', clef: 'treble' },
  { step: 'C', octave: 6, midi: 84, freq: 1046.50, displayName: 'C6 (2 Ledgers Above)', staffOffset: 8, ledgerOffsets: [6, 8], difficulty: 'advanced', clef: 'treble' },
];

export const BASS_NOTES: NoteDefinition[] = [
  // Extended Below
  { step: 'C', octave: 2, midi: 36, freq: 65.41, displayName: 'C2 (2 Ledgers Below)', staffOffset: -8, ledgerOffsets: [-6, -8], difficulty: 'advanced', clef: 'bass' },
  { step: 'D', octave: 2, midi: 38, freq: 73.42, displayName: 'D2 (Under 1st Ledger)', staffOffset: -7, ledgerOffsets: [-6], difficulty: 'advanced', clef: 'bass' },
  { step: 'E', octave: 2, midi: 40, freq: 82.41, displayName: 'E2 (1 Ledger Below)', staffOffset: -6, ledgerOffsets: [-6], difficulty: 'intermediate', clef: 'bass' },
  { step: 'F', octave: 2, midi: 41, freq: 87.31, displayName: 'F2 (Space Below Line 1)', staffOffset: -5, difficulty: 'intermediate', clef: 'bass' },

  // 5 Lines & 4 Spaces (Beginner)
  { step: 'G', octave: 2, midi: 43, freq: 98.00, displayName: 'G2 (Line 1)', staffOffset: -4, difficulty: 'beginner', clef: 'bass' },
  { step: 'A', octave: 2, midi: 45, freq: 110.00, displayName: 'A2 (Space 1)', staffOffset: -3, difficulty: 'beginner', clef: 'bass' },
  { step: 'B', octave: 2, midi: 47, freq: 123.47, displayName: 'B2 (Line 2)', staffOffset: -2, difficulty: 'beginner', clef: 'bass' },
  { step: 'C', octave: 3, midi: 48, freq: 130.81, displayName: 'C3 (Space 2)', staffOffset: -1, difficulty: 'beginner', clef: 'bass' },
  { step: 'D', octave: 3, midi: 50, freq: 146.83, displayName: 'D3 (Line 3)', staffOffset: 0, difficulty: 'beginner', clef: 'bass' },
  { step: 'E', octave: 3, midi: 52, freq: 164.81, displayName: 'E3 (Space 3)', staffOffset: 1, difficulty: 'beginner', clef: 'bass' },
  { step: 'F', octave: 3, midi: 53, freq: 174.61, displayName: 'F3 (Line 4)', staffOffset: 2, difficulty: 'beginner', clef: 'bass' },
  { step: 'G', octave: 3, midi: 55, freq: 196.00, displayName: 'G3 (Space 4)', staffOffset: 3, difficulty: 'beginner', clef: 'bass' },
  { step: 'A', octave: 3, midi: 57, freq: 220.00, displayName: 'A3 (Line 5)', staffOffset: 4, difficulty: 'beginner', clef: 'bass' },

  // Extended Above
  { step: 'B', octave: 3, midi: 59, freq: 246.94, displayName: 'B3 (Space Above Line 5)', staffOffset: 5, difficulty: 'intermediate', clef: 'bass' },
  { step: 'C', octave: 4, midi: 60, freq: 261.63, displayName: 'C4 (Middle C)', staffOffset: 6, ledgerOffsets: [6], difficulty: 'intermediate', clef: 'bass' },
  { step: 'D', octave: 4, midi: 62, freq: 293.66, displayName: 'D4 (Above Middle C)', staffOffset: 7, ledgerOffsets: [6], difficulty: 'advanced', clef: 'bass' },
  { step: 'E', octave: 4, midi: 64, freq: 329.63, displayName: 'E4 (2 Ledgers Above)', staffOffset: 8, ledgerOffsets: [6, 8], difficulty: 'advanced', clef: 'bass' },
];

export const ALTO_NOTES: NoteDefinition[] = [
  // Extended Below
  { step: 'B', octave: 2, midi: 47, freq: 123.47, displayName: 'B2 (2 Ledgers Below)', staffOffset: -8, ledgerOffsets: [-6, -8], difficulty: 'advanced', clef: 'alto' },
  { step: 'C', octave: 3, midi: 48, freq: 130.81, displayName: 'C3 (Under 1st Ledger)', staffOffset: -7, ledgerOffsets: [-6], difficulty: 'advanced', clef: 'alto' },
  { step: 'D', octave: 3, midi: 50, freq: 146.83, displayName: 'D3 (1 Ledger Below)', staffOffset: -6, ledgerOffsets: [-6], difficulty: 'intermediate', clef: 'alto' },
  { step: 'E', octave: 3, midi: 52, freq: 164.81, displayName: 'E3 (Space Below)', staffOffset: -5, difficulty: 'intermediate', clef: 'alto' },

  // 5 Lines & 4 Spaces
  { step: 'F', octave: 3, midi: 53, freq: 174.61, displayName: 'F3 (Line 1)', staffOffset: -4, difficulty: 'beginner', clef: 'alto' },
  { step: 'G', octave: 3, midi: 55, freq: 196.00, displayName: 'G3 (Space 1)', staffOffset: -3, difficulty: 'beginner', clef: 'alto' },
  { step: 'A', octave: 3, midi: 57, freq: 220.00, displayName: 'A3 (Line 2)', staffOffset: -2, difficulty: 'beginner', clef: 'alto' },
  { step: 'B', octave: 3, midi: 59, freq: 246.94, displayName: 'B3 (Space 2)', staffOffset: -1, difficulty: 'beginner', clef: 'alto' },
  { step: 'C', octave: 4, midi: 60, freq: 261.63, displayName: 'C4 (Middle C - Line 3)', staffOffset: 0, difficulty: 'beginner', clef: 'alto' },
  { step: 'D', octave: 4, midi: 62, freq: 293.66, displayName: 'D4 (Space 3)', staffOffset: 1, difficulty: 'beginner', clef: 'alto' },
  { step: 'E', octave: 4, midi: 64, freq: 329.63, displayName: 'E4 (Line 4)', staffOffset: 2, difficulty: 'beginner', clef: 'alto' },
  { step: 'F', octave: 4, midi: 65, freq: 349.23, displayName: 'F4 (Space 4)', staffOffset: 3, difficulty: 'beginner', clef: 'alto' },
  { step: 'G', octave: 4, midi: 67, freq: 392.00, displayName: 'G4 (Line 5)', staffOffset: 4, difficulty: 'beginner', clef: 'alto' },

  // Extended Above
  { step: 'A', octave: 4, midi: 69, freq: 440.00, displayName: 'A4 (Space Above Line 5)', staffOffset: 5, difficulty: 'intermediate', clef: 'alto' },
  { step: 'B', octave: 4, midi: 71, freq: 493.88, displayName: 'B4 (1 Ledger Above)', staffOffset: 6, ledgerOffsets: [6], difficulty: 'intermediate', clef: 'alto' },
  { step: 'C', octave: 5, midi: 72, freq: 523.25, displayName: 'C5 (Space Above Ledger)', staffOffset: 7, ledgerOffsets: [6], difficulty: 'advanced', clef: 'alto' },
  { step: 'D', octave: 5, midi: 74, freq: 587.33, displayName: 'D5 (2 Ledgers Above)', staffOffset: 8, ledgerOffsets: [6, 8], difficulty: 'advanced', clef: 'alto' },
];

export const TENOR_NOTES: NoteDefinition[] = [
  // Extended Below
  { step: 'G', octave: 2, midi: 43, freq: 98.00, displayName: 'G2 (2 Ledgers Below)', staffOffset: -8, ledgerOffsets: [-6, -8], difficulty: 'advanced', clef: 'tenor' },
  { step: 'A', octave: 2, midi: 45, freq: 110.00, displayName: 'A2 (Under 1st Ledger)', staffOffset: -7, ledgerOffsets: [-6], difficulty: 'advanced', clef: 'tenor' },
  { step: 'B', octave: 2, midi: 47, freq: 123.47, displayName: 'B2 (1 Ledger Below)', staffOffset: -6, ledgerOffsets: [-6], difficulty: 'intermediate', clef: 'tenor' },
  { step: 'C', octave: 3, midi: 48, freq: 130.81, displayName: 'C3 (Space Below)', staffOffset: -5, difficulty: 'intermediate', clef: 'tenor' },

  // 5 Lines & 4 Spaces
  { step: 'D', octave: 3, midi: 50, freq: 146.83, displayName: 'D3 (Line 1)', staffOffset: -4, difficulty: 'beginner', clef: 'tenor' },
  { step: 'E', octave: 3, midi: 52, freq: 164.81, displayName: 'E3 (Space 1)', staffOffset: -3, difficulty: 'beginner', clef: 'tenor' },
  { step: 'F', octave: 3, midi: 53, freq: 174.61, displayName: 'F3 (Line 2)', staffOffset: -2, difficulty: 'beginner', clef: 'tenor' },
  { step: 'G', octave: 3, midi: 55, freq: 196.00, displayName: 'G3 (Space 2)', staffOffset: -1, difficulty: 'beginner', clef: 'tenor' },
  { step: 'A', octave: 3, midi: 57, freq: 220.00, displayName: 'A3 (Line 3)', staffOffset: 0, difficulty: 'beginner', clef: 'tenor' },
  { step: 'B', octave: 3, midi: 59, freq: 246.94, displayName: 'B3 (Space 3)', staffOffset: 1, difficulty: 'beginner', clef: 'tenor' },
  { step: 'C', octave: 4, midi: 60, freq: 261.63, displayName: 'C4 (Middle C - Line 4)', staffOffset: 2, difficulty: 'beginner', clef: 'tenor' },
  { step: 'D', octave: 4, midi: 62, freq: 293.66, displayName: 'D4 (Space 4)', staffOffset: 3, difficulty: 'beginner', clef: 'tenor' },
  { step: 'E', octave: 4, midi: 64, freq: 329.63, displayName: 'E4 (Line 5)', staffOffset: 4, difficulty: 'beginner', clef: 'tenor' },

  // Extended Above
  { step: 'F', octave: 4, midi: 65, freq: 349.23, displayName: 'F4 (Space Above Line 5)', staffOffset: 5, difficulty: 'intermediate', clef: 'tenor' },
  { step: 'G', octave: 4, midi: 67, freq: 392.00, displayName: 'G4 (1 Ledger Above)', staffOffset: 6, ledgerOffsets: [6], difficulty: 'intermediate', clef: 'tenor' },
  { step: 'A', octave: 4, midi: 69, freq: 440.00, displayName: 'A4 (Space Above Ledger)', staffOffset: 7, ledgerOffsets: [6], difficulty: 'advanced', clef: 'tenor' },
  { step: 'B', octave: 4, midi: 71, freq: 493.88, displayName: 'B4 (2 Ledgers Above)', staffOffset: 8, ledgerOffsets: [6, 8], difficulty: 'advanced', clef: 'tenor' },
];

/**
 * Returns all notes available for a clef, sorted by MIDI pitch ascending
 */
export function getAllNotesForClef(clef: StaffClef): NoteDefinition[] {
  let list: NoteDefinition[] = [];
  if (clef === 'treble') {
    list = [...TREBLE_NOTES];
  } else if (clef === 'bass') {
    list = [...BASS_NOTES];
  } else if (clef === 'alto') {
    list = [...ALTO_NOTES];
  } else if (clef === 'tenor') {
    list = [...TENOR_NOTES];
  } else if (clef === 'grand') {
    list = [...TREBLE_NOTES, ...BASS_NOTES];
  }
  return list.sort((a, b) => a.midi - b.midi);
}

/**
 * Get min & max MIDI for default presets
 */
export function getPresetMidiRange(clef: StaffClef, difficulty: 'beginner' | 'intermediate' | 'advanced'): { minMidi: number; maxMidi: number } {
  const notes = getAllNotesForClef(clef);
  let filtered = notes;
  if (difficulty === 'beginner') {
    filtered = notes.filter((n) => n.difficulty === 'beginner');
  } else if (difficulty === 'intermediate') {
    filtered = notes.filter((n) => n.difficulty === 'beginner' || n.difficulty === 'intermediate');
  }
  if (filtered.length === 0) return { minMidi: notes[0].midi, maxMidi: notes[notes.length - 1].midi };
  return {
    minMidi: Math.min(...filtered.map((n) => n.midi)),
    maxMidi: Math.max(...filtered.map((n) => n.midi)),
  };
}

/**
 * Filter pool of available notes based on Clef, Difficulty, or Custom Range
 */
export function getAvailableNotes(
  clef: StaffClef,
  difficulty: GameDifficulty,
  customMinMidi?: number,
  customMaxMidi?: number
): NoteDefinition[] {
  const sourceNotes = getAllNotesForClef(clef);

  if (difficulty === 'custom') {
    const minMidi = customMinMidi ?? 0;
    const maxMidi = customMaxMidi ?? 127;
    const filtered = sourceNotes.filter((n) => n.midi >= minMidi && n.midi <= maxMidi);
    return filtered.length > 0 ? filtered : sourceNotes;
  }

  if (difficulty === 'beginner') {
    return sourceNotes.filter((n) => n.difficulty === 'beginner');
  } else if (difficulty === 'intermediate') {
    return sourceNotes.filter((n) => n.difficulty === 'beginner' || n.difficulty === 'intermediate');
  } else {
    return sourceNotes; // all notes
  }
}
