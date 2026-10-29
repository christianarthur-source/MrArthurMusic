/** General MIDI tables and note-name helpers. */

export const GM_FAMILIES = [
  'Piano', 'Chromatic Percussion', 'Organ', 'Guitar', 'Bass', 'Strings', 'Ensemble', 'Brass',
  'Reed', 'Pipe', 'Synth Lead', 'Synth Pad', 'Synth Effects', 'Ethnic', 'Percussive', 'Sound Effects',
] as const;
export type GmFamily = (typeof GM_FAMILIES)[number];

/** GM Level 1 program names, index = program number 0..127. */
export const GM_PROGRAM_NAMES: readonly string[] = [
  // Piano
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  // Chromatic Percussion
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  // Organ
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica',
  'Tango Accordion',
  // Guitar
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  // Bass
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1',
  'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  // Strings
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  // Ensemble
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs',
  'Synth Choir', 'Orchestra Hit',
  // Brass
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  // Reed
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  // Pipe
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  // Synth Lead
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)',
  'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  // Synth Pad
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)',
  'Pad 7 (halo)', 'Pad 8 (sweep)',
  // Synth Effects
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)',
  'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  // Ethnic
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  // Percussive
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  // Sound Effects
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause',
  'Gunshot',
];

export interface GmProgram {
  program: number;
  name: string;
  family: GmFamily;
}

/** Programs grouped by family (16 families × 8 programs). */
export const GM_PROGRAMS_BY_FAMILY: readonly { family: GmFamily; programs: GmProgram[] }[] = GM_FAMILIES.map(
  (family, f) => ({
    family,
    programs: GM_PROGRAM_NAMES.slice(f * 8, f * 8 + 8).map((name, i) => ({ program: f * 8 + i, name, family })),
  }),
);

export function gmProgramName(program: number): string {
  return GM_PROGRAM_NAMES[program] ?? `Program ${program}`;
}

export function gmFamilyOf(program: number): GmFamily | undefined {
  return GM_FAMILIES[Math.floor(program / 8)];
}

/** GM percussion key map (channel 10), note 35..81. */
export const GM_DRUM_NAMES: Readonly<Record<number, string>> = {
  35: 'Acoustic Bass Drum', 36: 'Bass Drum 1', 37: 'Side Stick', 38: 'Acoustic Snare', 39: 'Hand Clap',
  40: 'Electric Snare', 41: 'Low Floor Tom', 42: 'Closed Hi-Hat', 43: 'High Floor Tom', 44: 'Pedal Hi-Hat',
  45: 'Low Tom', 46: 'Open Hi-Hat', 47: 'Low-Mid Tom', 48: 'Hi-Mid Tom', 49: 'Crash Cymbal 1', 50: 'High Tom',
  51: 'Ride Cymbal 1', 52: 'Chinese Cymbal', 53: 'Ride Bell', 54: 'Tambourine', 55: 'Splash Cymbal', 56: 'Cowbell',
  57: 'Crash Cymbal 2', 58: 'Vibraslap', 59: 'Ride Cymbal 2', 60: 'Hi Bongo', 61: 'Low Bongo', 62: 'Mute Hi Conga',
  63: 'Open Hi Conga', 64: 'Low Conga', 65: 'High Timbale', 66: 'Low Timbale', 67: 'High Agogo', 68: 'Low Agogo',
  69: 'Cabasa', 70: 'Maracas', 71: 'Short Whistle', 72: 'Long Whistle', 73: 'Short Guiro', 74: 'Long Guiro',
  75: 'Claves', 76: 'Hi Wood Block', 77: 'Low Wood Block', 78: 'Mute Cuica', 79: 'Open Cuica', 80: 'Mute Triangle',
  81: 'Open Triangle',
};

export function gmDrumName(note: number): string | undefined {
  return GM_DRUM_NAMES[note];
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** MIDI note number → name with sharps, middle C (60) = "C4". */
export function midiNoteName(n: number): string {
  const v = Math.round(n);
  const pc = ((v % 12) + 12) % 12;
  return `${SHARP_NAMES[pc]}${Math.floor(v / 12) - 1}`;
}

/** Same as midiNoteName but using the sample-file convention ("s" for sharp): "Ds4", "Fs3". */
export function midiNoteFileName(n: number): string {
  return midiNoteName(n).replace('#', 's');
}

const PITCH_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * Parse a note name to a MIDI number ("C4" = 60). Accepts sharps as "#", "♯" or "s"
 * (sample-file convention, e.g. "Ds4"), flats as "b" or "♭", double accidentals, and
 * negative octaves ("C-1" = 0). Returns null for invalid names or results outside 0..127.
 */
export function noteNameToMidi(name: string): number | null {
  const m = /^\s*([A-Ga-g])((?:#|♯|s|b|♭|x){0,2})(-?\d{1,2})\s*$/.exec(name);
  if (!m) return null;
  let acc = 0;
  for (const c of m[2]) {
    if (c === '#' || c === '♯' || c === 's') acc += 1;
    else if (c === 'x') acc += 2;
    else acc -= 1;
  }
  const midi = (Number(m[3]) + 1) * 12 + PITCH_CLASS[m[1].toUpperCase()] + acc;
  return midi >= 0 && midi <= 127 ? midi : null;
}
