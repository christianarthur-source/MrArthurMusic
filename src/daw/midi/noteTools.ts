import { newId } from '../model/factory';
import { MidiNote, PPQ } from '../model/types';

/**
 * Note transforms for the piano roll: arpeggiate, strum, and groove (swing + humanize).
 * Arpeggiate and strum write ordinary notes (undoable edits); groove is applied while the
 * clip plays, so the step grid keeps showing straight 16ths.
 */

export type ArpPattern = 'up' | 'down' | 'updown' | 'random';

/** Notes that start together (within a small window) form a chord. */
function chords(notes: MidiNote[], window = PPQ / 16): MidiNote[][] {
  const sorted = [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  const out: MidiNote[][] = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n.start - last[0].start <= window) last.push(n);
    else out.push([n]);
  }
  return out;
}

/** Small deterministic PRNG so "random" arps and humanize are the same every time. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Replace each chord in `notes` with a run of single notes, one every `rate` ticks, for as long
 * as the chord was held. Single notes are left alone. Returns the new note list.
 */
export function arpeggiate(notes: MidiNote[], rate: number, pattern: ArpPattern, octaves = 1): MidiNote[] {
  const step = Math.max(PPQ / 16, Math.round(rate));
  const out: MidiNote[] = [];
  for (const c of chords(notes)) {
    if (c.length < 2) {
      out.push(...c);
      continue;
    }
    const pitches = [...new Set(c.map((n) => n.pitch))].sort((a, b) => a - b);
    const span: number[] = [];
    for (let o = 0; o < Math.max(1, Math.min(3, octaves)); o++) for (const p of pitches) if (p + 12 * o <= 127) span.push(p + 12 * o);
    let seq: number[];
    if (pattern === 'down') seq = [...span].reverse();
    else if (pattern === 'updown') seq = span.length > 2 ? [...span, ...span.slice(1, -1).reverse()] : span;
    else seq = span;
    const start = Math.min(...c.map((n) => n.start));
    const end = Math.max(...c.map((n) => n.start + n.length));
    const vel = Math.round(c.reduce((a, n) => a + n.velocity, 0) / c.length);
    const rnd = seeded(`${start}:${pitches.join(',')}`);
    for (let t = start, i = 0; t < end; t += step, i++) {
      const pitch = pattern === 'random' ? span[Math.floor(rnd() * span.length)] : seq[i % seq.length];
      out.push({ id: newId('n'), pitch, start: t, length: Math.min(step, end - t), velocity: vel });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Strum: offset the notes of each chord one after another (low to high for 'down' strokes,
 * like a guitar strummed downward; high to low for 'up'). `spread` is ticks between strings.
 */
export function strum(notes: MidiNote[], direction: 'down' | 'up', spread = PPQ / 24): MidiNote[] {
  const out: MidiNote[] = [];
  for (const c of chords(notes)) {
    if (c.length < 2) {
      out.push(...c);
      continue;
    }
    const order = [...c].sort((a, b) => (direction === 'down' ? a.pitch - b.pitch : b.pitch - a.pitch));
    const start = Math.min(...c.map((n) => n.start));
    order.forEach((n, i) => {
      const s = start + Math.round(i * spread);
      const end = n.start + n.length;
      out.push({ ...n, start: s, length: Math.max(PPQ / 32, end - s), velocity: Math.max(1, Math.min(127, n.velocity - i * 4)) });
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

const SIXTEENTH = PPQ / 4;

/**
 * Groove applied at playback: `swing` (0..1) pushes every off-beat 16th later, up to a full
 * triplet feel at 1; `humanize` (0..1) nudges timing by up to ±10 ms-ish (PPQ/48) and
 * loudness by up to ±12, using a seed per note so playback and export always match.
 */
export function applyGroove(notes: MidiNote[], swing = 0, humanize = 0, loopLength?: number): MidiNote[] {
  if (swing <= 0 && humanize <= 0) return notes;
  return notes.map((n) => {
    let start = n.start;
    if (swing > 0) {
      const pos = start % (SIXTEENTH * 2);
      // Off-beat 16ths move later by up to a third of a 16th: at swing 1 they land on the triplet.
      if (Math.abs(pos - SIXTEENTH) <= PPQ / 48) start += Math.round(swing * (SIXTEENTH / 3));
    }
    let velocity = n.velocity;
    if (humanize > 0) {
      const rnd = seeded(n.id);
      start += Math.round((rnd() * 2 - 1) * humanize * (PPQ / 48));
      velocity = Math.round(velocity + (rnd() * 2 - 1) * humanize * 12);
    }
    start = Math.max(0, start);
    if (loopLength !== undefined) start = Math.min(start, Math.max(0, loopLength - 1));
    if (start === n.start && velocity === n.velocity) return n;
    return { ...n, start, velocity: Math.max(1, Math.min(127, velocity)) };
  });
}
