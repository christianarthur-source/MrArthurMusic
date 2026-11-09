/**
 * Song keys, scales and chords (pure; no browser APIs).
 *
 * A song key is a tonic pitch class (0 = C … 11 = B) and a mode. Loops in the library carry a
 * key string such as "C", "F#m", "Bb" or "D#m"; `parseKey` reads those.
 */

export type KeyMode = 'major' | 'minor';

export interface SongKey {
  tonic: number; // 0..11, C = 0
  mode: KeyMode;
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Names students usually see on sheet music (one spelling per key).
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]; // natural minor

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** "C", "F#m", "Bb", "D#m", "Ebmin", "A minor" → SongKey; anything else → null. */
export function parseKey(s: string | undefined | null): SongKey | null {
  if (!s) return null;
  const m = /^\s*([A-Ga-g])([#b♯♭]?)\s*(m|min|minor|maj|major|M)?\s*$/.exec(s);
  if (!m) return null;
  const base = LETTER[m[1].toUpperCase()];
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const q = m[3] ?? '';
  const minor = q === 'm' || q === 'min' || q === 'minor';
  return { tonic: mod12(base + acc), mode: minor ? 'minor' : 'major' };
}

export function keyName(k: SongKey): string {
  return k.mode === 'major' ? `${MAJOR_NAMES[k.tonic]} major` : `${MINOR_NAMES[k.tonic]} minor`;
}

export function keyShortName(k: SongKey): string {
  return k.mode === 'major' ? MAJOR_NAMES[k.tonic] : `${MINOR_NAMES[k.tonic]}m`;
}

export function pitchClassName(pc: number): string {
  return SHARP_NAMES[mod12(pc)];
}

export const ALL_KEYS: SongKey[] = [
  ...Array.from({ length: 12 }, (_, i) => ({ tonic: i, mode: 'major' as const })),
  ...Array.from({ length: 12 }, (_, i) => ({ tonic: i, mode: 'minor' as const })),
];

/** Pitch classes in the key's scale (natural minor for minor keys), tonic first. */
export function scalePitchClasses(k: SongKey): number[] {
  return (k.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => mod12(k.tonic + s));
}

export function inScale(k: SongKey, pitch: number): boolean {
  return scalePitchClasses(k).includes(mod12(pitch));
}

/** Nearest scale note to `pitch` (ties go up), so a locked piano roll never writes a wrong note. */
export function snapToScale(k: SongKey, pitch: number): number {
  if (inScale(k, pitch)) return pitch;
  if (inScale(k, pitch + 1)) return pitch + 1;
  return pitch - 1; // diatonic scales never have two out-of-scale semitones in a row
}

/** Pitch class of the relative major (C minor → Eb). Keys that share notes compare equal here. */
function relativeMajor(k: SongKey): number {
  return k.mode === 'major' ? k.tonic : mod12(k.tonic + 3);
}

/**
 * Semitones to move a loop in `loopKey` so it fits `songKey`, in -5..+6 (the smallest move).
 * Relative keys count as a match (a C minor loop fits an Eb major song with no move), so loops
 * are pitched as little as possible, which keeps them sounding natural.
 */
export function semitonesToMatch(loopKey: SongKey, songKey: SongKey): number {
  const d = mod12(relativeMajor(songKey) - relativeMajor(loopKey));
  return d > 6 ? d - 12 : d;
}

export type ChordType = 'triad' | 'seventh' | 'power';

/**
 * A chord whose root is `root` (a MIDI note). With a key, the chord uses only notes of that
 * key's scale (so clicking any scale note gives the "right" chord: I, ii, iii, IV…); without a
 * key it is a major triad / dominant-free major 7th / power chord.
 */
export function chordNotes(root: number, type: ChordType, key?: SongKey | null): number[] {
  if (type === 'power') return [root, root + 7, root + 12].filter((n) => n <= 127);
  const count = type === 'seventh' ? 4 : 3;
  let notes: number[];
  if (key && inScale(key, root)) {
    const scale = scalePitchClasses(key);
    const deg = scale.indexOf(mod12(root));
    notes = [root];
    let prev = root;
    for (let i = 1; i < count; i++) {
      const pc = scale[(deg + i * 2) % 7];
      let n = prev + 1;
      while (mod12(n) !== pc) n++;
      notes.push(n);
      prev = n;
    }
  } else {
    notes = type === 'seventh' ? [root, root + 4, root + 7, root + 11] : [root, root + 4, root + 7];
  }
  return notes.filter((n) => n >= 0 && n <= 127);
}

/** Roman-numeral label for a chord built on a scale degree (e.g. "IV", "vi"), or '' if not in the key. */
export function chordLabel(root: number, key?: SongKey | null): string {
  if (!key || !inScale(key, root)) return '';
  const deg = scalePitchClasses(key).indexOf(mod12(root));
  const quality = chordNotes(60 + mod12(root - key.tonic) + key.tonic, 'triad', key);
  const third = quality[1] - quality[0];
  const fifth = quality[2] - quality[0];
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const n = numerals[deg];
  if (fifth === 6) return `${n.toLowerCase()}°`;
  return third === 4 ? n : n.toLowerCase();
}
