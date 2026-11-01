// Music-theory checks over the score: instrument ranges and common-practice part writing.
// Everything here is read-only: functions take a Score and return a list of issues the editor can show
// (and highlight by note id). Pitches are compared at sounding pitch (written MIDI + trans.semi).
import { ancestor, children, descendants, getId, keyAlter, midiOf, spellMidi, stepOf } from './mei';
import { Score, StaffInfo } from './score';
import { INSTRUMENTS } from './instruments';

export interface Issue {
  kind: 'range' | 'parallel5' | 'parallel8' | 'hidden' | 'crossing' | 'spacing' | 'leap' | 'unresolved7' | 'doubling';
  severity: 'warning' | 'info';
  message: string;
  measureN: string;
  noteIds: string[];
}

// ---------- reading notes ----------

interface NoteInfo {
  el: Element;
  id: string;
  midi: number; // sounding
  step: number; // written diatonic step (for interval spelling)
  tiedIn: boolean;
}

interface Ev {
  t: number;
  end: number;
  notes: NoteInfo[]; // empty for rests and spaces
  grace: boolean;
  tiedIn: boolean; // a tied continuation: sounds, but is not a new attack
}

const RESTS = new Set(['rest', 'space', 'mRest', 'mSpace', 'multiRest']);
const WRAPPERS = new Set(['beam', 'tuplet', 'graceGrp', 'bTrem', 'fTrem']);

/** Ids of notes that end a <tie> control element (the other way ties are encoded besides @tie). */
function tieEnds(score: Score): Set<string> {
  const out = new Set<string>();
  for (const t of descendants(score.scoreEl, 'tie')) {
    const end = (t.getAttribute('endid') || '').replace(/^#/, '');
    if (end) out.add(end);
  }
  return out;
}

const isTiedIn = (e: Element, ends: Set<string>) => /^[mt]$/.test(e.getAttribute('tie') || '') || ends.has(getId(e));

/**
 * Timed events of every layer in one staff of one measure. Accidentals carry through the bar across all
 * layers of the staff (like the editor's respell), starting from the key signature.
 */
function staffEvents(score: Score, measure: Element, staff: StaffInfo, ends: Set<string>): Map<string, Ev[]> {
  const out = new Map<string, Ev[]>();
  const staffEl = score.staffEl(measure, staff.n);
  if (!staffEl) return out;
  const fifths = score.contextOf(measure).keys[staff.n] ?? 0;
  const all: { t: number; info: NoteInfo; pname: string; oct: number }[] = [];
  for (const layer of children(staffEl, 'layer')) {
    const evs: Ev[] = [];
    let t = 0;
    const walk = (container: Element, scale: number) => {
      for (const c of children(container)) {
        if (WRAPPERS.has(c.localName)) {
          let s = scale;
          if (c.localName === 'tuplet') s = (scale * Number(c.getAttribute('numbase') || 2)) / Number(c.getAttribute('num') || 3);
          walk(c, s);
          continue;
        }
        const isNote = c.localName === 'note' || c.localName === 'chord';
        if (!isNote && !RESTS.has(c.localName)) continue;
        const grace = !!c.getAttribute('grace') || !!ancestor(c, 'graceGrp');
        const ticks = grace ? 0 : score.itemTicks(c, measure) * scale;
        const ev: Ev = { t, end: t + ticks, notes: [], grace, tiedIn: false };
        if (isNote) {
          const notes = c.localName === 'chord' ? children(c, 'note') : [c];
          const chordTied = c.localName === 'chord' && isTiedIn(c, ends);
          for (const n of notes) {
            const pname = n.getAttribute('pname');
            const oct = n.getAttribute('oct');
            if (!pname || oct === null) continue;
            const info: NoteInfo = { el: n, id: getId(n), midi: 0, step: stepOf(pname, Number(oct)), tiedIn: chordTied || isTiedIn(n, ends) };
            ev.notes.push(info);
            all.push({ t, info, pname, oct: Number(oct) });
          }
          ev.tiedIn = ev.notes.length > 0 && ev.notes.every((n) => n.tiedIn);
        }
        evs.push(ev);
        t += ticks;
      }
    };
    walk(layer, 1);
    out.set(layer.getAttribute('n') || '1', evs);
  }
  // sort is stable, so notes at the same tick keep layer order
  all.sort((a, b) => a.t - b.t);
  const state = new Map<string, number>();
  for (const { info, pname, oct } of all) {
    const key = pname + oct;
    const alter = Score.alterOf(info.el, state.has(key) ? state.get(key)! : keyAlter(fifths, pname));
    state.set(key, alter);
    info.midi = midiOf(pname, oct, alter) + staff.semi;
  }
  return out;
}

const isPercussion = (s: StaffInfo) => s.clefShape === 'perc' || !!INSTRUMENTS.find((i) => i.id === s.instrumentId)?.percussion;

const NAMES_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const NAMES_FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
function pitchName(midi: number, flats = false, withOctave = true): string {
  const { oct } = spellMidi(midi, flats);
  const name = (flats ? NAMES_FLAT : NAMES_SHARP)[((midi % 12) + 12) % 12];
  return withOctave ? name + oct : name;
}

// ---------- range ----------

interface RangeHit {
  note: NoteInfo;
  measureN: string;
  staff: StaffInfo;
  range: [number, number];
  out: boolean; // false = playable but near an extreme
}

function scanRange(score: Score): RangeHit[] {
  const hits: RangeHit[] = [];
  const ends = tieEnds(score);
  const staves = score.staves().filter((s) => !isPercussion(s));
  for (const measure of score.measures()) {
    for (const staff of staves) {
      const range = INSTRUMENTS.find((i) => i.id === staff.instrumentId)?.range;
      if (!range) continue;
      for (const evs of staffEvents(score, measure, staff, ends).values()) {
        for (const ev of evs) {
          for (const note of ev.notes) {
            const out = note.midi < range[0] || note.midi > range[1];
            const near = !out && (note.midi - range[0] < 2 || range[1] - note.midi < 2);
            if (out || near) hits.push({ note, measureN: measure.getAttribute('n') || '', staff, range, out });
          }
        }
      }
    }
  }
  return hits;
}

/** Notes outside their instrument's sounding range ("warning"), or within 2 semitones of an extreme ("info"). */
export function rangeIssues(score: Score): Issue[] {
  return scanRange(score).map(({ note, measureN, staff, range, out }) => {
    const low = note.midi - range[0] < range[1] - note.midi;
    const limit = pitchName(low ? range[0] : range[1]);
    const message = out
      ? `${pitchName(note.midi)} is too ${low ? 'low' : 'high'} for ${staff.partName} (${low ? 'lowest' : 'highest'} is ${limit})`
      : `${pitchName(note.midi)} is difficult for ${staff.partName} (near the ${low ? 'bottom' : 'top'} of its range)`;
    return { kind: 'range', severity: out ? 'warning' : 'info', message, measureN, noteIds: [note.id] };
  });
}

/** Ids of notes outside their instrument's playable range (for live red highlighting). */
export function outOfRangeNoteIds(score: Score): Set<string> {
  return new Set(scanRange(score).filter((h) => h.out).map((h) => h.note.id));
}

// ---------- part writing ----------

interface Voice {
  staff: StaffInfo;
  layerN: string;
  name: string;
}

interface Slot {
  midi: number;
  step: number;
  id: string;
  attack: boolean; // a new note starts here (not held, not a tied continuation)
}

interface Sonority {
  measureN: string;
  slots: (Slot | null)[]; // one per voice; null = rest / nothing sounding
}

/**
 * Builds the voices and the list of vertical sonorities, one at every onset in any voice.
 * Chord rule: a chord inside a layer stands for its top note, except in the lowest voice (the last layer
 * of the bottom staff), where it stands for its bottom note. Grace notes are ignored.
 */
function sonorities(score: Score): { voices: Voice[]; sons: Sonority[]; keyOf: (i: number) => number } {
  const ends = tieEnds(score);
  const staves = score.staves().filter((s) => !isPercussion(s));
  const measures = score.measures();
  const events = measures.map((m) => new Map(staves.map((s) => [s.n, staffEvents(score, m, s, ends)] as const)));

  // a voice is any (staff, layer) that holds at least one note somewhere
  const voices: Voice[] = [];
  for (const staff of staves) {
    const layers = new Set<string>();
    for (const per of events) for (const [n, evs] of per.get(staff.n)!) if (evs.some((e) => e.notes.length && !e.grace)) layers.add(n);
    const sorted = [...layers].sort((a, b) => Number(a) - Number(b));
    for (const n of sorted) voices.push({ staff, layerN: n, name: sorted.length > 1 ? `${staff.partName} (voice ${n})` : staff.partName });
  }

  const sons: Sonority[] = [];
  const sonMeasure: number[] = [];
  measures.forEach((m, mi) => {
    const streams = voices.map((v) => (events[mi].get(v.staff.n)!.get(v.layerN) || []).filter((e) => !e.grace));
    const onsets = [...new Set(streams.flatMap((evs) => evs.map((e) => e.t)))].sort((a, b) => a - b);
    for (const t of onsets) {
      const slots = streams.map((evs, vi) => {
        const ev = evs.find((e) => e.t <= t && t < e.end) || evs.find((e) => e.t === t);
        if (!ev || !ev.notes.length) return null;
        const lowest = vi === voices.length - 1;
        const note = ev.notes.reduce((a, b) => ((lowest ? b.midi < a.midi : b.midi > a.midi) ? b : a));
        return { midi: note.midi, step: note.step, id: note.id, attack: ev.t === t && !note.tiedIn };
      });
      sons.push({ measureN: m.getAttribute('n') || '', slots });
      sonMeasure.push(mi);
    }
  });
  // concert key (fifths) of the bottom voice's staff at a sonority, for the leading-tone check
  const keyOf = (i: number) => {
    const staff = voices[voices.length - 1]?.staff;
    if (!staff) return 0;
    const written = score.contextOf(measures[sonMeasure[i]]).keys[staff.n] ?? 0;
    return written + staff.semi * 7; // fifths shift for a transposition (mod 12 later)
  };
  return { voices, sons, keyOf };
}

/** Root of a major triad or dominant 7th (root, M3, P5?, m7?) formed by these pitch classes, or null. */
function dominantRoot(pcs: Set<number>): { root: number; seventh: boolean } | null {
  if (pcs.size < 2) return null;
  for (const r of pcs) {
    const allowed = new Set([r, (r + 4) % 12, (r + 7) % 12, (r + 10) % 12]);
    if (![...pcs].every((p) => allowed.has(p))) continue;
    if (!pcs.has((r + 4) % 12)) continue;
    const seventh = pcs.has((r + 10) % 12);
    if (seventh || pcs.has((r + 7) % 12)) return { root: r, seventh };
  }
  return null;
}

const pcOf = (m: number) => ((m % 12) + 12) % 12;

/**
 * Voice-leading checks between every pair of voices at consecutive sonorities, plus per-voice melodic
 * leaps and per-sonority spacing/crossing/doubling. Runs only for 2–8 voices.
 */
export function partWritingIssues(score: Score): Issue[] {
  const { voices, sons, keyOf } = sonorities(score);
  if (voices.length < 2 || voices.length > 8) return [];
  const issues: Issue[] = [];
  const add = (kind: Issue['kind'], severity: Issue['severity'], message: string, measureN: string, noteIds: string[]) =>
    issues.push({ kind, severity, message, measureN, noteIds: [...new Set(noteIds)] });
  const last = voices.length - 1;

  for (let si = 0; si < sons.length; si++) {
    const s2 = sons[si];
    const s1 = si > 0 ? sons[si - 1] : null;
    const mn = s2.measureN;

    // vertical: crossing and spacing between adjacent sounding voices (flag only where something new starts)
    for (let i = 0; i < last; i++) {
      const a = s2.slots[i];
      const b = s2.slots[i + 1];
      if (!a || !b || !(a.attack || b.attack)) continue;
      if (a.midi < b.midi) add('crossing', 'warning', `${voices[i].name} crosses below ${voices[i + 1].name}`, mn, [a.id, b.id]);
      else if (i + 1 < last && voices.length >= 3 && a.midi - b.midi > 12)
        add('spacing', 'warning', `More than an octave between ${voices[i].name} and ${voices[i + 1].name}`, mn, [a.id, b.id]);
    }

    // doubled leading tone: the 3rd of a dominant (V or V7 of the key, or any V7) in two voices
    const sounding = s2.slots.filter((x): x is Slot => !!x);
    if (sounding.length >= 3 && sounding.some((x) => x.attack)) {
      const dom = dominantRoot(new Set(sounding.map((x) => pcOf(x.midi))));
      const tonic = pcOf(keyOf(si) * 7); // major tonic of the key signature
      if (dom && (dom.seventh || dom.root === pcOf(tonic + 7) || dom.root === pcOf(tonic + 4))) {
        const lt = pcOf(dom.root + 4);
        const thirds = sounding.filter((x) => pcOf(x.midi) === lt);
        if (thirds.length >= 2) add('doubling', 'info', `Doubled leading tone (${pitchName(lt, false, false)})`, mn, thirds.map((x) => x.id));
      }
    }

    if (!s1) continue;
    // chordal 7th of a dominant 7th should step down when it moves (unless the chord stays the same)
    const s1Notes = s1.slots.filter((x): x is Slot => !!x);
    const dom1 = dominantRoot(new Set(s1Notes.map((x) => pcOf(x.midi))));
    if (dom1?.seventh && s1Notes.length >= 3) {
      const dom2 = dominantRoot(new Set(sounding.map((x) => pcOf(x.midi))));
      if (!(dom2 && dom2.root === dom1.root)) {
        s1.slots.forEach((a, vi) => {
          const b = s2.slots[vi];
          if (!a || !b || !b.attack || b.midi === a.midi || pcOf(a.midi) !== pcOf(dom1.root + 10)) return;
          const d = b.midi - a.midi;
          if (d !== -1 && d !== -2) add('unresolved7', 'info', `The 7th in ${voices[vi].name} should resolve down by step`, mn, [a.id, b.id]);
        });
      }
    }

    // pairs of voices that both move
    for (let i = 0; i < voices.length; i++) {
      for (let j = i + 1; j < voices.length; j++) {
        const a1 = s1.slots[i], a2 = s2.slots[i], b1 = s1.slots[j], b2 = s2.slots[j];
        if (!a1 || !a2 || !b1 || !b2 || !a2.attack || !b2.attack) continue;
        const da = a2.midi - a1.midi;
        const db = b2.midi - b1.midi;
        if (da === 0 || db === 0) continue;
        const i1 = pcOf(Math.abs(a1.midi - b1.midi));
        const i2 = pcOf(Math.abs(a2.midi - b2.midi));
        const ids = [a1.id, b1.id, a2.id, b2.id];
        const pair = `${voices[i].name} and ${voices[j].name}`;
        const same = Math.sign(da) === Math.sign(db);
        if (i1 === i2 && (i2 === 7 || i2 === 0)) {
          const fifth = i2 === 7;
          const what = fifth ? '5ths' : a1.midi === b1.midi && a2.midi === b2.midi ? 'unisons' : 'octaves';
          add(fifth ? 'parallel5' : 'parallel8', same ? 'warning' : 'info',
            same ? `Parallel ${what} between ${pair}` : `Consecutive ${what} by contrary motion between ${pair}`, mn, ids);
        } else if (i === 0 && j === last && same && (i2 === 7 || i2 === 0) && Math.abs(da) > 2) {
          add('hidden', 'warning', `Hidden ${i2 === 7 ? '5th' : 'octave'} in the outer voices (${voices[i].name} leaps)`, mn, ids);
        }
      }
    }
  }

  // melodic leaps in each voice: more than an octave, or an augmented 2nd / 4th (spelled from written notes)
  voices.forEach((v, vi) => {
    let prev: Slot | null = null;
    for (const s of sons) {
      const cur = s.slots[vi];
      if (!cur) {
        prev = null;
        continue;
      }
      if (!cur.attack) continue;
      if (prev && cur.midi !== prev.midi) {
        const semis = Math.abs(cur.midi - prev.midi);
        const steps = Math.abs(cur.step - prev.step);
        let what = '';
        if (semis > 12) what = 'Leap larger than an octave';
        else if (semis === 3 && steps === 1) what = 'Augmented 2nd';
        else if (semis === 6 && steps === 3) what = 'Augmented 4th';
        if (what) add('leap', 'warning', `${what} in ${v.name}`, s.measureN, [prev.id, cur.id]);
      }
      prev = cur;
    }
  });

  return issues;
}
