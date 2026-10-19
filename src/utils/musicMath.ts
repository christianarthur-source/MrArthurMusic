import {
  AccidentalType,
  ClefType,
  CountingMode,
  NoteDuration,
  NoteItem,
  NoteLabelMode,
  NoteStep,
  Pitch,
  Score,
} from '../types/music';

export const LINE_SPACING = 18;
export const STAFF_TOP_Y = 32; // Y position of top staff line inside a staff block
export const STAFF_HEIGHT = 4 * LINE_SPACING; // 72px for 5 lines

export const STEP_DIATONIC_OFFSET: Record<NoteStep, number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6,
};

export const DIATONIC_STEP_ORDER: NoteStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function getDiatonicIndex(step: NoteStep, octave: number): number {
  return octave * 7 + STEP_DIATONIC_OFFSET[step];
}

export function getPitchFromDiatonicIndex(index: number, accidental?: AccidentalType): Pitch {
  const octave = Math.floor(index / 7);
  const stepIndex = ((index % 7) + 7) % 7;
  const step = DIATONIC_STEP_ORDER[stepIndex];
  return {
    step,
    octave,
    accidental: accidental || null,
  };
}

// Treble top line is F5 (index 5*7 + 3 = 38)
// Bass top line is A3 (index 3*7 + 5 = 26)
export function getPitchY(pitch: Pitch, clef: ClefType): number {
  const diatonic = getDiatonicIndex(pitch.step, pitch.octave);
  const topLineDiatonic = clef === 'treble' ? 38 : 26; // F5 or A3
  const diff = topLineDiatonic - diatonic;
  return STAFF_TOP_Y + diff * (LINE_SPACING / 2);
}

// Convert Y coordinate back to nearest diatonic pitch
export function getPitchFromY(y: number, clef: ClefType): Pitch {
  const topLineDiatonic = clef === 'treble' ? 38 : 26;
  const stepUnits = Math.round((y - STAFF_TOP_Y) / (LINE_SPACING / 2));
  const diatonicIndex = topLineDiatonic - stepUnits;
  return getPitchFromDiatonicIndex(diatonicIndex);
}

// Boomwhacker / Chroma-Notes color map for middle-school visual learners
export const BOOMWHACKER_COLORS: Record<NoteStep, { bg: string; text: string; name: string }> = {
  C: { bg: '#EF4444', text: '#FFFFFF', name: 'Red' }, // Red
  D: { bg: '#F97316', text: '#FFFFFF', name: 'Orange' }, // Orange
  E: { bg: '#EAB308', text: '#18181B', name: 'Yellow' }, // Yellow
  F: { bg: '#22C55E', text: '#FFFFFF', name: 'Green' }, // Green
  G: { bg: '#06B6D4', text: '#FFFFFF', name: 'Teal' }, // Teal
  A: { bg: '#3B82F6', text: '#FFFFFF', name: 'Blue' }, // Blue
  B: { bg: '#A855F7', text: '#FFFFFF', name: 'Purple' }, // Purple
};

export const SEMITONE_OFFSETS: Record<NoteStep, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function getPitchFrequency(
  pitch: Pitch,
  keySignature: 'C' | 'G' | 'F' | 'D' | 'Bb' = 'C'
): number {
  let semitones = (pitch.octave - 4) * 12 + SEMITONE_OFFSETS[pitch.step] - 9; // A4 is 0
  let effectiveAccidental = pitch.accidental;

  if (!effectiveAccidental) {
    if (keySignature === 'G' && pitch.step === 'F') effectiveAccidental = 'sharp';
    else if (keySignature === 'D' && (pitch.step === 'F' || pitch.step === 'C')) effectiveAccidental = 'sharp';
    else if (keySignature === 'F' && pitch.step === 'B') effectiveAccidental = 'flat';
    else if (keySignature === 'Bb' && (pitch.step === 'B' || pitch.step === 'E')) effectiveAccidental = 'flat';
  }

  if (effectiveAccidental === 'sharp') semitones += 1;
  else if (effectiveAccidental === 'flat') semitones -= 1;
  return 440 * Math.pow(2, semitones / 12);
}

// Tempo terms
export function getTempoDescription(bpm: number): { term: string; explanation: string } {
  if (bpm < 60) return { term: 'Largo', explanation: 'Broad & very slow' };
  if (bpm < 76) return { term: 'Adagio', explanation: 'Slow & majestic' };
  if (bpm < 108) return { term: 'Andante', explanation: 'Walking pace' };
  if (bpm < 120) return { term: 'Moderato', explanation: 'Moderate speed' };
  if (bpm < 168) return { term: 'Allegro', explanation: 'Fast, lively & cheerful' };
  return { term: 'Presto', explanation: 'Very, very fast!' };
}

// Measure math: calculate capacity in whole-note units (1 = 4/4)
export function getMeasureCapacity(timeSignature: [number, number]): number {
  const [beats, beatValue] = timeSignature;
  return beats * (1 / beatValue);
}

// Calculate effective duration of a note item
export function getItemDuration(item: NoteItem): number {
  let dur = item.isDotted ? item.duration * 1.5 : item.duration;
  if (item.isTriplet) {
    dur = (dur * 2) / 3;
  }
  return dur;
}

// Calculate current filled duration of measure
export function getMeasureFilledDuration(items: NoteItem[]): number {
  return items.reduce((sum, item) => sum + getItemDuration(item), 0);
}

// Subdivide remaining duration into standard musical rests
export function subdivideRemainingRests(remainingDuration: number): NoteItem[] {
  const rests: NoteItem[] = [];
  let remaining = Math.round(remainingDuration * 10000) / 10000;

  // Standard duration units (including triplet subdivisions when needed)
  const standardDurations: { duration: NoteDuration; isDotted?: boolean; isTriplet?: boolean; value: number }[] = [
    { duration: 1, value: 1.0 },
    { duration: 0.5, isDotted: true, value: 0.75 },
    { duration: 0.5, value: 0.5 },
    { duration: 0.25, isDotted: true, value: 0.375 },
    { duration: 0.25, value: 0.25 },
    { duration: 0.125, isDotted: true, value: 0.1875 },
    { duration: 0.25, isTriplet: true, value: 0.25 * (2 / 3) },
    { duration: 0.125, value: 0.125 },
    { duration: 0.125, isTriplet: true, value: 0.125 * (2 / 3) },
    { duration: 0.0625, value: 0.0625 },
    { duration: 0.0625, isTriplet: true, value: 0.0625 * (2 / 3) },
  ];

  while (remaining >= 0.035) {
    let matched = false;
    for (const d of standardDurations) {
      if (remaining >= d.value - 0.002) {
        rests.push({
          id: 'rest_' + Math.random().toString(36).substring(2, 9),
          type: 'rest',
          duration: d.duration,
          isDotted: d.isDotted,
          isTriplet: d.isTriplet,
        });
        remaining = Math.round((remaining - d.value) * 10000) / 10000;
        matched = true;
        break;
      }
    }
    if (!matched) break;
  }

  return rests;
}

// Helper to rebuild measure timeline from list of note entries
export function rebuildMeasureFromNotes(
  notes: { start: number; end: number; item: NoteItem }[],
  capacity: number
): NoteItem[] {
  notes.sort((a, b) => a.start - b.start);
  const resultItems: NoteItem[] = [];
  let cursorBeat = 0;

  for (const noteEntry of notes) {
    const gapBefore = noteEntry.start - cursorBeat;
    if (gapBefore >= 0.03) {
      const rests = subdivideRemainingRests(gapBefore);
      resultItems.push(...rests);
    }
    resultItems.push(noteEntry.item);
    cursorBeat = noteEntry.end;
  }

  const remainingGap = capacity - cursorBeat;
  if (remainingGap >= 0.03) {
    const rests = subdivideRemainingRests(remainingGap);
    resultItems.push(...rests);
  }

  return resultItems.length > 0 ? resultItems : subdivideRemainingRests(capacity);
}

// Timeline-based note insertion: places a note at exact target beat,
// forming chords if a note already exists at that beat location!
export function insertNoteAtBeat(
  measureItems: NoteItem[],
  newNote: NoteItem,
  targetBeat: number,
  capacity: number
): NoteItem[] {
  const noteDuration = getItemDuration(newNote);
  // Clamp startBeat within [0, capacity - noteDuration]
  const startBeat = Math.max(0, Math.min(capacity - noteDuration, targetBeat));
  const endBeat = startBeat + noteDuration;

  // Find all existing notes (excluding rests) and their beat ranges
  const existingNotes: { start: number; end: number; item: NoteItem }[] = [];
  let currentBeat = 0;
  for (const item of measureItems) {
    const itemDur = getItemDuration(item);
    if (item.type === 'note') {
      existingNotes.push({
        start: currentBeat,
        end: currentBeat + itemDur,
        item,
      });
    }
    currentBeat += itemDur;
  }

  // Check if there is an existing note starting at the exact same beat location
  const sameStartNote = existingNotes.find(
    (n) => Math.abs(n.start - startBeat) < 0.05
  );

  if (sameStartNote && newNote.type === 'note' && newNote.pitch) {
    const p = newNote.pitch;
    const existingPitches =
      sameStartNote.item.pitches && sameStartNote.item.pitches.length > 0
        ? sameStartNote.item.pitches
        : sameStartNote.item.pitch
        ? [sameStartNote.item.pitch]
        : [];

    const isDuplicate = existingPitches.some(
      (ep) => ep.step === p.step && ep.octave === p.octave
    );

    if (!isDuplicate) {
      sameStartNote.item.pitches = [...existingPitches, p];
      sameStartNote.item.pitch = sameStartNote.item.pitches[0];
    }

    return rebuildMeasureFromNotes(existingNotes, capacity);
  }

  // Otherwise, filter out any existing notes that overlap with [startBeat, endBeat]
  const nonOverlapping = existingNotes.filter(
    (n) => n.end <= startBeat + 0.001 || n.start >= endBeat - 0.001
  );

  // If newNote is a note (not a rest), add it
  if (newNote.type === 'note') {
    if (!newNote.pitches && newNote.pitch) {
      newNote.pitches = [newNote.pitch];
    }
    nonOverlapping.push({ start: startBeat, end: endBeat, item: newNote });
  }

  return rebuildMeasureFromNotes(nonOverlapping, capacity);
}

// Clean and consolidate rests within a measure timeline
export function cleanMeasureRests(items: NoteItem[], capacity: number): NoteItem[] {
  const notes: { start: number; end: number; item: NoteItem }[] = [];
  let currentBeat = 0;

  for (const item of items) {
    const dur = getItemDuration(item);
    if (item.type === 'note') {
      notes.push({ start: currentBeat, end: currentBeat + dur, item });
    }
    currentBeat += dur;
  }

  const resultItems: NoteItem[] = [];
  let cursorBeat = 0;

  for (const noteEntry of notes) {
    const gapBefore = noteEntry.start - cursorBeat;
    if (gapBefore >= 0.03) {
      resultItems.push(...subdivideRemainingRests(gapBefore));
    }
    resultItems.push(noteEntry.item);
    cursorBeat = noteEntry.end;
  }

  const remainingGap = capacity - cursorBeat;
  if (remainingGap >= 0.03) {
    resultItems.push(...subdivideRemainingRests(remainingGap));
  }

  return resultItems.length > 0 ? resultItems : subdivideRemainingRests(capacity);
}

// Helper to determine ledger lines needed
export function getLedgerLines(pitch: Pitch, clef: ClefType): number[] {
  const diatonic = getDiatonicIndex(pitch.step, pitch.octave);
  const lines: number[] = [];
  
  if (clef === 'treble') {
    // Treble staff lines are:
    // Line 1: E4 (index 30) -> y = 60
    // Line 2: G4 (index 32) -> y = 50
    // Line 3: B4 (index 34) -> y = 40
    // Line 4: D5 (index 36) -> y = 30
    // Line 5: F5 (index 38) -> y = 20
    // Below staff:
    // C4 (index 28) -> y = 70 (1 ledger line)
    // A3 (index 26) -> y = 80 (2 ledger lines)
    if (diatonic <= 28) {
      for (let d = 28; d >= diatonic; d -= 2) {
        lines.push(STAFF_TOP_Y + (38 - d) * (LINE_SPACING / 2));
      }
    }
    // Above staff:
    // A5 (index 40) -> y = 10 (1 ledger line)
    // C6 (index 42) -> y = 0 (2 ledger lines)
    if (diatonic >= 40) {
      for (let d = 40; d <= diatonic; d += 2) {
        lines.push(STAFF_TOP_Y + (38 - d) * (LINE_SPACING / 2));
      }
    }
  } else {
    // Bass staff lines:
    // Line 1: G2 (index 18)
    // Line 2: B2 (index 20)
    // Line 3: D3 (index 22)
    // Line 4: F3 (index 24)
    // Line 5: A3 (index 26)
    // Below staff:
    // E2 (index 16) -> 1st ledger line below
    // C2 (index 14) -> 2nd ledger line below
    if (diatonic <= 16) {
      for (let d = 16; d >= diatonic; d -= 2) {
        lines.push(STAFF_TOP_Y + (26 - d) * (LINE_SPACING / 2));
      }
    }
    // Above staff:
    // C4 (Middle C, index 28) -> y = 15 (space above is B3=27.5, ledger is C4=10)
    // Actually in Bass clef:
    // A3 is line 5 (y=20, index 26)
    // B3 is space above (index 27, y=15)
    // C4 is ledger line (index 28, y=10)
    // E4 is ledger line (index 30, y=0)
    if (diatonic >= 28) {
      for (let d = 28; d <= diatonic; d += 2) {
        lines.push(STAFF_TOP_Y + (26 - d) * (LINE_SPACING / 2));
      }
    }
  }
  return lines;
}

const FIXED_SOLFEGE: Record<NoteStep, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Ti',
};

const MOVABLE_SOLFEGE_SYLLABLES = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];

const KEY_TONIC_STEP_INDEX: Record<Score['keySignature'], number> = {
  C: 0, // C
  G: 4, // G
  F: 3, // F
  D: 1, // D
  Bb: 6, // B(b)
};

export function getFormattedPitchLabel(
  pitch: Pitch,
  mode: NoteLabelMode,
  keySignature: Score['keySignature'] = 'C'
): string {
  if (mode === 'off') return '';
  if (mode === 'letters') {
    const acc =
      pitch.accidental === 'sharp' ? '♯' : pitch.accidental === 'flat' ? '♭' : '';
    return `${pitch.step}${acc}`;
  }
  if (mode === 'solfege_fixed') {
    return FIXED_SOLFEGE[pitch.step];
  }
  const stepIdx = STEP_DIATONIC_OFFSET[pitch.step];
  const tonicIdx = KEY_TONIC_STEP_INDEX[keySignature] ?? 0;
  const degreeIdx = ((stepIdx - tonicIdx) % 7 + 7) % 7;

  if (mode === 'solfege_movable') {
    return MOVABLE_SOLFEGE_SYLLABLES[degreeIdx];
  }
  if (mode === 'scale_degrees') {
    return String(degreeIdx + 1);
  }
  return pitch.step;
}

export function getBeatCountingLabel(
  beatOffsetInWholeNotes: number,
  item: NoteItem,
  timeSignature: [number, number],
  mode: CountingMode
): string {
  if (mode === 'off') return '';

  const [, beatValue] = timeSignature;
  const beatUnitWhole = 1 / beatValue; // e.g., 0.25 for quarter note beat
  const exactBeat = beatOffsetInWholeNotes / beatUnitWhole;
  const beatNumber = Math.floor(exactBeat + 0.001) + 1;
  const frac = Math.round((exactBeat - Math.floor(exactBeat + 0.001)) * 12) / 12;

  if (mode === 'kodaly') {
    if (item.type === 'rest') {
      return 'shh';
    }
    if (item.isTriplet) return 'tri-o-la';
    if (item.duration === 1) return 'ta-a-a-a';
    if (item.duration === 0.5) return item.isDotted ? 'ta-a-a' : 'ta-a';
    if (item.duration === 0.25) return item.isDotted ? 'ta-i' : 'ta';
    if (item.duration === 0.125) return 'ti';
    if (item.duration === 0.0625) return 'ti-ri';
    return 'ta';
  }

  // Standard numerical counting (1 e & a)
  let token = String(beatNumber);
  if (Math.abs(frac - 0.25) < 0.05) {
    token = 'e';
  } else if (Math.abs(frac - 0.5) < 0.05) {
    token = '&';
  } else if (Math.abs(frac - 0.75) < 0.05) {
    token = 'a';
  } else if (Math.abs(frac - 1 / 3) < 0.06) {
    token = 'trip';
  } else if (Math.abs(frac - 2 / 3) < 0.06) {
    token = 'let';
  }

  return item.type === 'rest' ? `(${token})` : token;
}

export function getMidiNoteNumber(
  pitch: Pitch,
  keySignature: Score['keySignature'] = 'C'
): number {
  let midi = (pitch.octave + 1) * 12 + SEMITONE_OFFSETS[pitch.step];
  let effectiveAccidental = pitch.accidental;

  if (!effectiveAccidental) {
    if (keySignature === 'G' && pitch.step === 'F') effectiveAccidental = 'sharp';
    else if (keySignature === 'D' && (pitch.step === 'F' || pitch.step === 'C'))
      effectiveAccidental = 'sharp';
    else if (keySignature === 'F' && pitch.step === 'B') effectiveAccidental = 'flat';
    else if (keySignature === 'Bb' && (pitch.step === 'B' || pitch.step === 'E'))
      effectiveAccidental = 'flat';
  }

  if (effectiveAccidental === 'sharp') midi += 1;
  else if (effectiveAccidental === 'flat') midi -= 1;
  return Math.max(0, Math.min(127, midi));
}

/**
 * Expands the measure playback sequence to honor repeat barlines (|: and :|)
 * or loop a single selected measure.
 */
export function expandPlaybackMeasures(
  measureCount: number,
  measures: { repeatStart?: boolean; repeatEnd?: boolean }[],
  loopMeasureIndex?: number | null,
  loopIterations: number = 4
): number[] {
  if (
    loopMeasureIndex !== null &&
    loopMeasureIndex !== undefined &&
    loopMeasureIndex >= 0 &&
    loopMeasureIndex < measureCount
  ) {
    return Array.from({ length: loopIterations }, () => loopMeasureIndex);
  }

  const sequence: number[] = [];
  const triggeredEndRepeats = new Set<number>();
  let lastRepeatStart = 0;

  let m = 0;
  let safetyCounter = 0;
  while (m < measureCount && safetyCounter < measureCount * 4) {
    safetyCounter++;
    if (measures[m]?.repeatStart) {
      lastRepeatStart = m;
    }
    sequence.push(m);

    if (measures[m]?.repeatEnd && !triggeredEndRepeats.has(m)) {
      triggeredEndRepeats.add(m);
      m = lastRepeatStart;
    } else {
      m++;
    }
  }

  return sequence.length > 0 ? sequence : [0];
}
