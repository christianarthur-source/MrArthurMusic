// Musical form for playback: the order measures are played in (repeats, 1st/2nd endings, D.C., D.S.,
// Fine, To Coda), plus chord-symbol parsing for accompaniment.
import type { Score } from '../model/score';
import { ancestor, children, descendants } from '../model/mei';

interface MeasureFlags {
  start: boolean; // |: on the left
  end: boolean; // :| on the right
  ending: number[] | null; // 1st/2nd ending numbers
  segno: boolean;
  coda: boolean;
  fine: boolean;
  toCoda: boolean;
  dc: 'fine' | 'coda' | 'end' | null;
  ds: 'fine' | 'coda' | 'end' | null;
}

function endingNumbers(n: string | null): number[] {
  if (!n) return [1];
  const out: number[] = [];
  for (const part of n.split(/[,\s]+/)) {
    const r = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (r) for (let i = Number(r[1]); i <= Number(r[2]); i++) out.push(i);
    else if (/^\d+/.test(part)) out.push(parseInt(part, 10));
  }
  return out.length ? out : [1];
}

function flagsOf(m: Element): MeasureFlags {
  const left = m.getAttribute('left') || '';
  const right = m.getAttribute('right') || '';
  const ending = ancestor(m, 'ending');
  const f: MeasureFlags = {
    start: left === 'rptstart' || left === 'rptboth',
    end: right === 'rptend' || right === 'rptboth',
    ending: ending ? endingNumbers(ending.getAttribute('n') || ending.getAttribute('label')) : null,
    segno: false, coda: false, fine: false, toCoda: false, dc: null, ds: null,
  };
  // a "start repeat" on the next measure's left can also be written as rptboth on this one
  for (const c of children(m)) {
    if (c.localName === 'staff') continue;
    const func = (c.getAttribute('func') || '').toLowerCase();
    const text = (c.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (func === 'segno' || /𝄋|\bsegno\b/.test(text)) f.segno = true;
    if ((func === 'coda' || /^𝄌$|^coda$/.test(text)) && !/to coda/.test(text)) f.coda = true;
    if (func === 'fine' || /^fine\.?$/.test(text)) f.fine = true;
    if (/to coda/.test(text)) f.toCoda = true;
    const tail = /al coda/.test(text) ? 'coda' : /al fine/.test(text) ? 'fine' : 'end';
    if (func === 'dacapo' || /\bd\.?\s?c\.?(\s|$)|da capo/.test(text)) f.dc = tail;
    if (func === 'dalsegno' || /\bd\.?\s?s\.?(\s|$)|dal segno/.test(text)) f.ds = tail;
  }
  return f;
}

/** Indexes into `score.measures()` in the order they are played. */
export function playOrder(score: Score): number[] {
  const ms = score.measures();
  const flags = ms.map(flagsOf);
  const n = ms.length;
  const order: number[] = [];
  const timesRepeated = new Map<number, number>();
  let repeatStart = 0;
  let pass = 1;
  let jumped: 'fine' | 'coda' | 'end' | null = null; // after D.C./D.S. repeats are not taken again
  let i = 0;
  const limit = n * 6 + 64;
  while (i < n && order.length < limit) {
    const f = flags[i];
    if (f.start && !jumped) repeatStart = i;
    if (f.ending) {
      // 1st ending on the first pass, 2nd on the second…; after a D.C./D.S. only the last ending
      const allowed = jumped ? f.ending.includes(maxEnding(flags, i)) : f.ending.includes(pass);
      if (!allowed) {
        i++;
        continue;
      }
    }
    order.push(i);
    if (jumped === 'fine' && f.fine) break;
    if (jumped === 'coda' && f.toCoda) {
      const coda = flags.findIndex((x, k) => k > i && x.coda);
      if (coda >= 0) {
        i = coda;
        jumped = 'end';
        continue;
      }
    }
    if (f.end && !jumped) {
      const count = timesRepeated.get(i) || 0;
      const passes = f.ending ? maxEnding(flags, i) : 2; // repeat once, or once per ending
      if (count + 1 < passes) {
        timesRepeated.set(i, count + 1);
        pass++;
        i = repeatStart;
        continue;
      }
      repeatStart = i + 1;
    }
    if (!jumped && (f.dc || f.ds)) {
      jumped = f.dc || f.ds;
      pass = 1;
      i = f.dc ? 0 : Math.max(0, flags.findIndex((x) => x.segno));
      continue;
    }
    if (f.ending && (i + 1 >= n || !flags[i + 1].ending)) {
      pass = 1;
      repeatStart = i + 1;
    }
    if (f.end && !f.ending) pass = 1;
    i++;
  }
  return order;
}

function maxEnding(flags: MeasureFlags[], i: number): number {
  // the highest ending number in the group that measure i belongs to
  let a = i;
  while (a > 0 && flags[a - 1].ending) a--;
  let b = i;
  while (b < flags.length - 1 && flags[b + 1].ending) b++;
  let max = 1;
  for (let k = a; k <= b; k++) for (const x of flags[k].ending || []) max = Math.max(max, x);
  return max;
}

/** Tempo-text markings by measure index: rit./rall. (slow down) and a tempo (resume). */
export function tempoChanges(score: Score): Map<number, 'rit' | 'atempo'> {
  const out = new Map<number, 'rit' | 'atempo'>();
  score.measures().forEach((m, i) => {
    for (const c of children(m)) {
      if (c.localName !== 'dir' && c.localName !== 'tempo') continue;
      const t = (c.textContent || '').toLowerCase();
      if (/\b(rit|ritard|ritardando|rall|rallentando)\b/.test(t)) out.set(i, 'rit');
      else if (/a tempo|tempo i\b/.test(t)) out.set(i, 'atempo');
    }
  });
  return out;
}

// ---------- chord symbols ----------

const ROOT_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** Parses a chord symbol like "F#m7b5", "B♭maj7/D", "Csus4", "G7(#9)" into pitch classes (root first). */
export function parseChord(text: string): { root: number; bass: number | null; tones: number[] } | null {
  const t = text.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[Δ△]/g, 'maj').replace(/ø/g, 'm7b5').replace(/°/g, 'dim').trim();
  const m = /^([A-Ga-g])([#b]?)(.*?)(?:\/([A-Ga-g])([#b]?))?$/.exec(t);
  if (!m) return null;
  const acc = (s: string) => (s === '#' ? 1 : s === 'b' ? -1 : 0);
  const root = (ROOT_PC[m[1].toLowerCase()] + acc(m[2]) + 12) % 12;
  const q = m[3].toLowerCase();
  let third = 4;
  let fifth = 7;
  const ext: number[] = [];
  if (/^(m(?!aj)|min|-)/.test(q)) third = 3;
  if (/dim/.test(q)) {
    third = 3;
    fifth = 6;
    if (/dim7/.test(q)) ext.push(9);
  }
  if (/aug|\+/.test(q)) fifth = 8;
  if (/sus4|sus(?!2)/.test(q)) third = 5;
  if (/sus2/.test(q)) third = 2;
  if (/b5/.test(q)) fifth = 6;
  if (/maj7|maj9|ma7|maj13|\bm\(maj7\)/.test(q)) ext.push(11);
  else if (/7|9|11|13/.test(q) && !/add9/.test(q) && !/6/.test(q.replace(/13/, ''))) ext.push(10);
  if (/6/.test(q.replace(/13/, '')) && !/b6/.test(q)) ext.push(9);
  if (/9|add9|add2/.test(q)) ext.push(/b9/.test(q) ? 13 : /#9/.test(q) ? 15 : 14);
  const tones = [0, third, fifth, ...ext].map((x) => (root + x) % 12);
  const bass = m[4] ? (ROOT_PC[m[4].toLowerCase()] + acc(m[5]) + 12) % 12 : null;
  return { root, bass, tones: [...new Set(tones)] };
}

/** A smooth close voicing between C3 and C5 with the bass an octave below. */
export function voiceChord(ch: { root: number; bass: number | null; tones: number[] }): number[] {
  const bass = 36 + (ch.bass ?? ch.root); // C2..B2
  const upper = ch.tones.map((pc) => {
    let n = 55 + ((pc - 55 % 12 + 12) % 12); // from G3 upward
    if (n > 66) n -= 12;
    return n;
  });
  return [bass, ...[...new Set(upper)].sort((a, b) => a - b)];
}

export function harmonyElements(score: Score) {
  return descendants(score.doc, 'harm').filter((h) => (h.getAttribute('type') || '') !== 'roman' && (h.getAttribute('type') || '') !== 'figbass');
}
