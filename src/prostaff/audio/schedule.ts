// Builds the playback schedule from Verovio's timemap for the currently loaded score.
import type { VerovioToolkit } from 'verovio/esm';
import { isTabStaff, type Score } from '../model/score';
import { ancestor, child, descendants, getId } from '../model/mei';
import { sampleForProgram, instrumentById } from '../model/instruments';
import { DYNAMIC_VELOCITY, type Click, type Cue, type PedalEvent, type PlayNote } from './player';
import type { ChannelSetup } from './soundfont';
import { playOrder, tempoChanges, parseChord, voiceChord, harmonyElements } from './form';

/** Standard drum-set staff positions → General MIDI drum keys. */
const DRUM_MAP: Record<string, number> = {
  d4: 44, e4: 35, f4: 36, g4: 41, a4: 43, b4: 47, c5: 38, d5: 45, e5: 48, f5: 51, g5: 42, a5: 49, b5: 57, c6: 49,
};

export interface Schedule {
  notes: PlayNote[];
  pedals: PedalEvent[];
  channels: ChannelSetup[];
  cues: Cue[];
  clicks: Click[];
  idTime: Map<string, number>;
  measureTime: Map<string, number>;
  duration: number;
}

/** `concert`: the toolkit already holds sounding pitch (concert-pitch view), so no transposition is added. */
export function buildSchedule(tk: VerovioToolkit, score: Score, concert = false, opts: PlaybackOptions = DEFAULT_PLAYBACK): Schedule {
  const timemap = tk.renderToTimemap({ includeMeasures: true, includeRests: true });
  const staves = score.staves();
  const sampleOf = new Map<string, { sample: string; drums: boolean; semi: number }>();
  for (const s of staves) {
    const sd = score.staffDefs().find((d) => d.getAttribute('n') === s.n);
    const instr = sd ? descendants(sd, 'instrDef')[0] || (sd.parentElement ? child(sd.parentElement, 'instrDef') : null) : null;
    const drums = instr?.getAttribute('midi.channel') === '9' || instr?.getAttribute('midi.channel') === '10' || s.instrumentId === 'drumset' || s.clefShape === 'perc';
    const sample = s.instrumentId ? instrumentById(s.instrumentId).sample : sampleForProgram(s.program, drums);
    sampleOf.set(s.n, { sample: drums ? 'drum_kit' : sample, drums, semi: s.semi });
  }

  const tabStaves = new Set(score.staffDefs().filter(isTabStaff).map((d) => d.getAttribute('n') || ''));
  // dynamics per staff, by time
  const dyn = new Map<string, { t: number; v: number }[]>();
  const notes: PlayNote[] = [];
  const cues: Cue[] = [];
  const idTime = new Map<string, number>();
  const measureTime = new Map<string, number>();
  const pendingDyn: { staff: string; startid: string; v: number }[] = [];
  for (const d of descendants(score.doc, 'dynam')) {
    const text = (d.textContent || '').trim().toLowerCase();
    const v = DYNAMIC_VELOCITY[text];
    if (v === undefined) continue;
    const sid = (d.getAttribute('startid') || '').replace(/^#/, '');
    const startEl = sid ? score.byId(sid) : null;
    const staffN = d.getAttribute('staff') || ancestor(startEl, 'staff')?.getAttribute('n') || '1';
    if (sid) pendingDyn.push({ staff: staffN, startid: sid, v });
  }
  const timeOfId = (id: string) => {
    const mv = tk.getMIDIValuesForElement(id);
    return typeof mv?.time === 'number' ? mv.time : null;
  };

  for (const entry of timemap) {
    const t = entry.tstamp;
    if (entry.measureOn) measureTime.set(entry.measureOn, t);
    for (const id of [...(entry.on || []), ...(entry.restsOn || [])]) if (!idTime.has(id)) idTime.set(id, t);
    cues.push({ time: t, on: [...(entry.on || []), ...(entry.restsOn || [])], off: [...(entry.off || []), ...(entry.restsOff || [])], measureOn: entry.measureOn });
  }
  for (const p of pendingDyn) {
    const t = idTime.get(p.startid) ?? timeOfId(p.startid);
    if (t == null) continue;
    if (!dyn.has(p.staff)) dyn.set(p.staff, []);
    dyn.get(p.staff)!.push({ t, v: p.v });
  }
  for (const list of dyn.values()) list.sort((a, b) => a.t - b.t);
  const timeOf = (ref: string | null) => {
    const id = (ref || '').replace(/^#/, '');
    if (!id) return null;
    return idTime.get(id) ?? timeOfId(id);
  };
  const staffOfRef = (c: Element) => {
    const id = (c.getAttribute('startid') || '').replace(/^#/, '');
    return c.getAttribute('staff') || ancestor(id ? score.byId(id) : null, 'staff')?.getAttribute('n') || '1';
  };
  const levelAt = (staff: string, t: number) => {
    const list = dyn.get(staff);
    let v = 0.68;
    if (list) for (const d of list) {
      if (d.t <= t + 1) v = d.v;
      else break;
    }
    return v;
  };

  // crescendo / diminuendo hairpins swell the dynamic between their ends (toward the next marking if any)
  const ramps = new Map<string, { t0: number; t1: number; v0: number; v1: number }[]>();
  for (const h of descendants(score.doc, 'hairpin')) {
    const t0 = timeOf(h.getAttribute('startid'));
    const t1 = timeOf(h.getAttribute('endid'));
    if (t0 == null || t1 == null || t1 <= t0) continue;
    const staff = staffOfRef(h);
    const v0 = levelAt(staff, t0);
    const after = (dyn.get(staff) || []).find((d) => d.t >= t1 - 1 && d.t <= t1 + 1500);
    const cres = h.getAttribute('form') !== 'dim';
    const v1 = after ? after.v : Math.max(0.15, Math.min(1, v0 + (cres ? 0.22 : -0.22)));
    (ramps.get(staff) || ramps.set(staff, []).get(staff)!).push({ t0, t1, v0, v1 });
    if (!after) (dyn.get(staff) || dyn.set(staff, []).get(staff)!).push({ t: t1, v: v1 });
  }
  for (const list of dyn.values()) list.sort((a, b) => a.t - b.t);
  const velocityAt = (staff: string, t: number) => {
    for (const r of ramps.get(staff) || []) if (t >= r.t0 && t <= r.t1) return r.v0 + ((r.v1 - r.v0) * (t - r.t0)) / (r.t1 - r.t0);
    return levelAt(staff, t);
  };

  // slurs: notes inside are played legato (connected)
  const slurs = new Map<string, { t0: number; t1: number }[]>();
  for (const sl of descendants(score.doc, 'slur')) {
    const t0 = timeOf(sl.getAttribute('startid'));
    const t1 = timeOf(sl.getAttribute('endid'));
    if (t0 == null || t1 == null) continue;
    const staff = staffOfRef(sl);
    (slurs.get(staff) || slurs.set(staff, []).get(staff)!).push({ t0, t1 });
  }
  const legatoAt = (staff: string, t: number) => (slurs.get(staff) || []).some((r) => t >= r.t0 - 1 && t < r.t1 - 1);

  // sustain pedal marks
  const pedals: PedalEvent[] = [];
  for (const pd of descendants(score.doc, 'pedal')) {
    const t = timeOf(pd.getAttribute('startid'));
    if (t == null) continue;
    pedals.push({ time: pd.getAttribute('dir') === 'up' ? t + 20 : t + 5, staffN: staffOfRef(pd), down: pd.getAttribute('dir') !== 'up' });
  }
  pedals.sort((a, b) => a.time - b.time);

  for (const entry of timemap) {
    for (const id of entry.on || []) {
      const el = score.byId(id);
      if (!el || el.localName !== 'note') continue;
      const mv = tk.getMIDIValuesForElement(id);
      if (typeof mv?.pitch !== 'number') continue;
      const staffN = ancestor(el, 'staff')?.getAttribute('n') || '1';
      if (tabStaves.has(staffN)) continue; // tab mirrors another staff
      const info = sampleOf.get(staffN) || { sample: 'piano', drums: false, semi: 0 };
      let dur = typeof mv.duration === 'number' ? mv.duration : 500;
      const ev = ancestor(el, 'chord') || el;
      const artic = (ev.getAttribute('artic') || '') + ' ' + (el.getAttribute('artic') || '') + ' ' + descendants(ev, 'artic').map((a) => a.getAttribute('artic')).join(' ');
      let v = velocityAt(staffN, entry.tstamp);
      if (/stacis/.test(artic)) dur *= 0.3;
      else if (/(stacc|spicc)/.test(artic)) dur *= 0.45;
      else if (/ten/.test(artic)) dur *= 1;
      else if (legatoAt(staffN, entry.tstamp)) dur *= 1.04;
      else dur *= 0.9;
      if (/marc/.test(artic)) {
        v += 0.2;
        dur *= 0.85;
      } else if (/acc/.test(artic)) v += 0.15;
      v = Math.max(0.08, Math.min(1, v + (Math.random() - 0.5) * 0.04)); // a little human variation
      const midi = info.drums ? DRUM_MAP[(el.getAttribute('pname') || '') + (el.getAttribute('oct') || '')] ?? 38 : mv.pitch + (concert ? 0 : info.semi);
      notes.push({ time: entry.tstamp, dur, midi, staffN, velocity: v, sample: info.sample, id });
    }
  }
  notes.sort((a, b) => a.time - b.time);

  // metronome clicks: interpolate quarter-note positions to milliseconds
  const points = timemap.map((e) => ({ q: e.qstamp, t: e.tstamp }));
  const msAt = (q: number) => {
    if (!points.length) return 0;
    let i = 0;
    while (i < points.length - 1 && points[i + 1].q < q) i++;
    const a = points[i];
    const b = points[Math.min(i + 1, points.length - 1)];
    if (b.q === a.q) return a.t;
    return a.t + ((q - a.q) * (b.t - a.t)) / (b.q - a.q);
  };
  const clicks: Click[] = [];
  const measures = score.measures();
  const measureQ = new Map<string, number>();
  for (const e of timemap) if (e.measureOn) measureQ.set(e.measureOn, e.qstamp);
  for (const m of measures) {
    const id = getId(m);
    const q0 = measureQ.get(id);
    if (q0 === undefined) continue;
    const ctx = score.contextOf(m);
    const compound = ctx.unit === 8 && ctx.count % 3 === 0 && ctx.count > 3;
    const beatQ = compound ? 1.5 : 4 / ctx.unit;
    const beats = compound ? ctx.count / 3 : ctx.count;
    const lenQ = (score.capacity(m) / 3840) * 4;
    for (let b = 0; b < beats; b++) {
      const q = q0 + b * beatQ;
      if (m.getAttribute('metcon') === 'false' && b * beatQ >= lenQ) break;
      clicks.push({ time: msAt(q), accent: b === 0 });
    }
  }
  const last = timemap[timemap.length - 1];
  const channels: ChannelSetup[] = staves.map((st) => ({ staffN: st.n, partKey: String(st.partIndex), program: st.program, drums: sampleOf.get(st.n)?.drums ?? false }));
  const linear: Schedule = { notes, pedals, channels, cues, clicks, idTime, measureTime, duration: last ? last.tstamp : 0 };
  return arrange(score, linear, opts, timeOf);
}

export interface PlaybackOptions {
  repeats: boolean; // follow repeats, endings, D.C./D.S.
  swing: number; // 0 = straight; 0.167 = triplet swing (fraction of a quarter the off-beat moves)
  chords: 'piano' | 'guitar' | 'off'; // play chord symbols
}

export const DEFAULT_PLAYBACK: PlaybackOptions = { repeats: true, swing: 0, chords: 'piano' };

/**
 * Lays the measures out in playing order (repeats, endings, jumps) and applies rit./a tempo,
 * fermatas, swing and chord-symbol accompaniment.
 */
function arrange(score: Score, lin: Schedule, opts: PlaybackOptions, timeOf: (ref: string | null) => number | null): Schedule {
  const ms = score.measures();
  const ids = ms.map(getId);
  const starts = ids.map((id) => lin.measureTime.get(id));
  // measures the timemap skipped (empty) get the previous start
  for (let i = 0; i < starts.length; i++) if (starts[i] === undefined) starts[i] = i ? starts[i - 1]! : 0;
  const lastNoteEnd = lin.notes.reduce((a, n) => Math.max(a, n.time + n.dur), lin.duration);
  const ends = starts.map((_, i) => (i + 1 < starts.length ? starts[i + 1]! : Math.max(lin.duration, lastNoteEnd)));
  const measureOfTime = (t: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= t + 0.5) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const group = <T extends { time: number }>(list: T[]) => {
    const g: T[][] = ms.map(() => []);
    for (const x of list) g[measureOfTime(x.time)].push(x);
    return g;
  };
  const notesBy = group(lin.notes);
  const cuesBy = group(lin.cues);
  const pedalsBy = group(lin.pedals);

  // fermatas: hold the note about 70% longer and wait for it
  const fermataAt = new Map<number, { t: number; extra: number }[]>();
  for (const f of descendants(score.doc, 'fermata')) {
    const t = timeOf(f.getAttribute('startid'));
    if (t == null) continue;
    const k = measureOfTime(t);
    const n = lin.notes.find((x) => Math.abs(x.time - t) < 2);
    const extra = Math.min(2500, (n ? n.dur : 600) * 0.7);
    (fermataAt.get(k) || fermataAt.set(k, []).get(k)!).push({ t, extra });
  }
  const tempoMarks = tempoChanges(score);

  // chord symbols: block chords until the next symbol or the end of the measure
  const chordNotes: PlayNote[] = [];
  if (opts.chords !== 'off') {
    const harms = harmonyElements(score)
      .map((h) => ({ t: timeOf(h.getAttribute('startid')), text: (h.textContent || '').trim() }))
      .filter((h): h is { t: number; text: string } => h.t != null && !!h.text)
      .sort((a, b) => a.t - b.t);
    harms.forEach((h, i) => {
      const ch = parseChord(h.text);
      if (!ch) return;
      const k = measureOfTime(h.t);
      const until = Math.min(i + 1 < harms.length ? harms[i + 1].t : Infinity, ends[k]);
      for (const midi of voiceChord(ch)) chordNotes.push({ time: h.t, dur: Math.max(120, until - h.t - 30), midi, staffN: CHORD_STAFF, velocity: 0.5, sample: opts.chords === 'guitar' ? 'harp' : 'piano', id: '' });
    });
  }
  const chordsBy = group(chordNotes);

  const order = opts.repeats ? playOrder(score) : ms.map((_, i) => i);
  const notes: PlayNote[] = [];
  const cues: Cue[] = [];
  const pedals: PedalEvent[] = [];
  const clicks: Click[] = [];
  const idTime = new Map<string, number>();
  const measureTime = new Map<string, number>();
  let offset = 0;
  let ritStep = 0;
  for (const k of order) {
    const mark = tempoMarks.get(k);
    if (mark === 'rit') ritStep = Math.max(ritStep, 1);
    if (mark === 'atempo') ritStep = 0;
    const stretch = ritStep ? Math.min(1.35, 1 + 0.12 * ritStep) : 1;
    const s0 = starts[k]!;
    const len = ends[k] - s0;
    const ferm = (fermataAt.get(k) || []).sort((a, b) => a.t - b.t);
    const ctx = score.contextOf(ms[k]);
    const quarters = score.capacity(ms[k]) / 960;
    const qMs = quarters ? len / quarters : 600;
    const simple = ctx.unit === 4 || ctx.unit === 2;
    const at = (t: number) => {
      let x = (t - s0) * stretch;
      for (const f of ferm) if (t > f.t + 1) x += f.extra;
      return offset + x;
    };
    if (!measureTime.has(ids[k])) measureTime.set(ids[k], offset);
    for (const n of [...notesBy[k], ...chordsBy[k]]) {
      let t = at(n.time);
      let dur = n.dur * stretch;
      const f = ferm.find((x) => Math.abs(x.t - n.time) < 2);
      if (f) dur += f.extra;
      if (opts.swing && simple && n.staffN !== CHORD_STAFF) {
        const q = (n.time - s0) / qMs;
        const frac = q - Math.floor(q);
        const eighthish = n.dur < qMs * 0.62;
        if (Math.abs(frac - 0.5) < 0.04 && eighthish) {
          t += opts.swing * qMs * stretch;
          dur *= 1 - opts.swing * 1.6;
        } else if (frac < 0.04 && eighthish) dur *= 1 + opts.swing * 1.6;
      }
      notes.push({ ...n, time: t, dur });
      if (n.id && !idTime.has(n.id)) idTime.set(n.id, t);
    }
    for (const c of cuesBy[k]) cues.push({ ...c, time: at(c.time), measureOn: c.measureOn });
    for (const p of pedalsBy[k]) pedals.push({ ...p, time: at(p.time) });
    for (const c of lin.cues) for (const id of c.on) if (!idTime.has(id) && measureOfTime(c.time) === k) idTime.set(id, at(c.time));
    // metronome: one click per beat
    const compound = ctx.unit === 8 && ctx.count % 3 === 0 && ctx.count > 3;
    const beatQ = compound ? 1.5 : 4 / ctx.unit;
    for (let b = 0; b * beatQ < quarters - 0.001; b++) clicks.push({ time: offset + b * beatQ * qMs * stretch, accent: b === 0 });
    offset += len * stretch + ferm.reduce((a, f) => a + f.extra, 0);
    if (ritStep) ritStep++;
  }
  notes.sort((a, b) => a.time - b.time);
  cues.sort((a, b) => a.time - b.time);
  pedals.sort((a, b) => a.time - b.time);
  const channels = chordNotes.length ? [...lin.channels, { staffN: CHORD_STAFF, partKey: CHORD_STAFF, program: opts.chords === 'guitar' ? 24 : 0, drums: false }] : lin.channels;
  return { notes, pedals, channels, cues, clicks, idTime, measureTime, duration: offset };
}

export const CHORD_STAFF = 'chords';
