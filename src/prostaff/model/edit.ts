// Editing commands. Every command mutates the Score's MEI document in place; the editor snapshots the
// document beforehand for undo and re-renders afterwards.
import {
  WHOLE, ancestor, child, children, cloneFresh, descendants, durToTicks, el, getId, setId, keyAlter, largestFit,
  midiOf, PNAMES, splitTicks, stepOf, fromStep, keySigString, alterToAccid,
} from './mei';
import { Score, LEAF_EVENTS, tempoGlyph, setKeySig, tabStaffDef } from './score';
import { instrumentById, writtenFifths } from './instruments';

export interface InputState {
  dur: string; // '1' | '2' | '4' ...
  dots: number;
  voice: string; // layer n
}

export type Selection =
  | { kind: 'none' }
  | { kind: 'events'; ids: string[] }
  | { kind: 'measures'; measureIds: string[]; staves: string[] };

export const NONE: Selection = { kind: 'none' };

export class EditError extends Error {}

// ---------- navigation ----------

const isLeaf = (e: Element) => LEAF_EVENTS.has(e.localName) && !(e.localName === 'note' && ancestor(e, 'chord'));

/** All leaf events of one staff/layer across the whole score, in time order. */
export function leafSequence(score: Score, staffN: string, layerN: string, includeGrace = false): Element[] {
  const out: Element[] = [];
  for (const m of score.measures()) {
    const layer = score.layerEl(m, staffN, layerN);
    if (!layer) continue;
    const walk = (c: Element) => {
      for (const x of children(c)) {
        if (isLeaf(x)) {
          if (includeGrace || !x.getAttribute('grace')) out.push(x);
        } else if (['beam', 'tuplet', 'graceGrp', 'bTrem', 'fTrem'].includes(x.localName)) {
          if (x.localName !== 'graceGrp' || includeGrace) walk(x);
        }
      }
    };
    walk(layer);
  }
  return out;
}

/** The selectable event an element belongs to (a note inside a chord counts as the chord for timing). */
export function eventOf(e: Element): Element {
  if (e.localName === 'note') return ancestor(e, 'chord') || e;
  return e;
}

export function locate(e: Element) {
  const layer = ancestor(e, 'layer')!;
  const staff = ancestor(e, 'staff')!;
  const measure = ancestor(e, 'measure')!;
  return { layer, staff, measure, staffN: staff?.getAttribute('n') || '1', layerN: layer?.getAttribute('n') || '1' };
}

export function neighbor(score: Score, e: Element, dir: 1 | -1, includeGrace = true): Element | null {
  const ev = eventOf(e);
  const { staffN, layerN } = locate(ev);
  const seq = leafSequence(score, staffN, layerN, includeGrace);
  const i = seq.indexOf(ev);
  return i < 0 ? null : seq[i + dir] || null;
}

// ---------- layer preparation ----------

/** Flattens beams and whole-measure rests so a layer's items can be overwritten. */
function prepare(score: Score, layer: Element) {
  score.unbeam(layer);
  score.expandMeasureRests(layer);
}

function startTick(score: Score, item: Element): number {
  const container = item.parentElement!;
  let t = 0;
  for (const c of children(container)) {
    if (c === item) break;
    t += score.itemTicks(c, ancestor(container, 'measure') || (container as Element));
  }
  return t;
}

function itemAtTick(score: Score, container: Element, tick: number): Element | null {
  let t = 0;
  for (const c of children(container)) {
    const d = score.itemTicks(c);
    if (d === 0) continue;
    if (t + d > tick + 0.001) return c;
    t += d;
  }
  return null;
}

/** Returns the item in its (prepared) container; resolves elements that `prepare` replaced. */
function resolveTarget(score: Score, target: Element): Element | null {
  const ev = eventOf(target);
  const layer = ancestor(ev, 'layer')!;
  if (ev.localName === 'mRest' || ev.localName === 'mSpace' || ev.localName === 'multiRest') {
    prepare(score, layer);
    return itemAtTick(score, layer, 0);
  }
  prepare(score, layer);
  return ev;
}

function idsIn(e: Element): string[] {
  const ids = [getId(e)];
  for (const d of Array.from(e.getElementsByTagName('*'))) ids.push(getId(d));
  return ids.filter(Boolean);
}

/** Moves or removes control events that point at removed elements. */
function fixRefs(score: Score, removed: Element[], replacement: Element | null) {
  if (!removed.length) return;
  const firstIds = new Set(idsIn(removed[0]));
  const all = new Set(removed.flatMap(idsIn));
  const newId = replacement ? getId(replacement) : '';
  for (const m of score.measures()) {
    for (const c of children(m)) {
      if (c.localName === 'staff') continue;
      const s = (c.getAttribute('startid') || '').replace(/^#/, '');
      const e = (c.getAttribute('endid') || '').replace(/^#/, '');
      const plist = (c.getAttribute('plist') || '').split(/\s+/).map((p) => p.replace(/^#/, '')).filter(Boolean);
      if (s && all.has(s)) {
        if (newId && firstIds.has(s) && (!e || !all.has(e))) c.setAttribute('startid', '#' + newId);
        else c.remove();
        continue;
      }
      if (e && all.has(e)) {
        c.remove();
        continue;
      }
      if (plist.some((p) => all.has(p))) c.remove();
    }
  }
}

function makeEvent(score: Score, kind: 'note' | 'rest' | 'space', dur: string, dots: number, pitch?: { pname: string; oct: number; alter: number }) {
  const e = el(score.doc, kind, { dur, dots: dots || undefined });
  if (pitch && kind === 'note') {
    e.setAttribute('pname', pitch.pname);
    e.setAttribute('oct', String(pitch.oct));
    e.setAttribute('accid.ges', pitch.alter ? (alterToAccid(pitch.alter) === 'x' ? 'ss' : alterToAccid(pitch.alter)) : 'n');
  }
  return e;
}

function setDurAttrs(e: Element, dur: string, dots: number) {
  e.setAttribute('dur', dur);
  if (dots) e.setAttribute('dots', String(dots));
  else e.removeAttribute('dots');
  e.removeAttribute('dur.ppq');
  if (e.localName === 'chord') for (const n of children(e, 'note')) {
    n.removeAttribute('dur');
    n.removeAttribute('dots');
    n.removeAttribute('dur.ppq');
  }
}

function fillRests(score: Score, container: Element, before: Element | null, ticks: number) {
  if (ticks <= 0) return;
  for (const p of splitTicks(ticks)) container.insertBefore(makeEvent(score, 'rest', p.dur, p.dots), before);
}

/**
 * Writes `newEl` at `target`'s position, replacing as much following material as its length needs.
 * The new element is shortened when it would not fit in the measure (or tuplet).
 */
function overwrite(score: Score, target: Element, newEl: Element): Element {
  const container = target.parentElement!;
  const measure = ancestor(target, 'measure')!;
  const cap = score.containerCapacity(container);
  const items = children(container);
  const idx = items.indexOf(target);
  const start = startTick(score, target);
  let need = score.itemTicks(newEl, measure);
  if (start + need > cap + 0.001) {
    const fit = largestFit(cap - start);
    if (!fit) throw new EditError('There is no room left in this measure.');
    setDurAttrs(newEl, fit.dur, fit.dots);
    need = score.itemTicks(newEl, measure);
  }
  const removed: Element[] = [];
  let consumed = 0;
  for (let i = idx; i < items.length && consumed < need - 0.001; i++) {
    const it = items[i];
    const t = score.itemTicks(it, measure);
    if (t === 0) continue;
    consumed += t;
    removed.push(it);
  }
  container.insertBefore(newEl, removed[0] || null);
  const after = removed.length ? removed[removed.length - 1].nextSibling : newEl.nextSibling;
  for (const r of removed) r.remove();
  fixRefs(score, removed, newEl);
  if (consumed > need + 0.001) fillRests(score, container, after as Element | null, consumed - need);
  return newEl;
}

function afterEdit(score: Score, layer: Element) {
  score.invalidate();
  score.tidyLayer(layer);
  score.invalidate();
}

/** First leaf at/after an element's position (used for the input cursor). */
function nextCursor(score: Score, placed: Element): string {
  const { staffN, layerN, measure, layer } = locate(placed);
  // the next event in this measure, if any
  const seq = leafSequence(score, staffN, layerN, false).filter((x) => ancestor(x, 'measure') === measure);
  const i = seq.indexOf(eventOf(placed));
  if (i >= 0 && seq[i + 1]) return getId(seq[i + 1]);
  // otherwise the same voice in the next measure (created if that voice is not there yet)
  const all = score.measures();
  let next = all[all.indexOf(measure) + 1];
  if (!next) next = insertMeasures(score, measure, 1, 'after')[0];
  const voice = children(ancestor(layer, 'staff')!, 'layer')[0] === layer ? '1' : layerN;
  const target = voiceLayer(score, next, staffN, voice);
  score.invalidate();
  return getId(firstLeaf(target) || children(target)[0]);
}

// ---------- pitch helpers ----------

export function keyAt(score: Score, e: Element): number {
  const { measure, staffN } = locate(eventOf(e));
  return score.contextOf(measure).keys[staffN] ?? 0;
}

/** Spells a MIDI pitch in a key: key-signature spelling first, then naturals, then sharps/flats by direction. */
export function spellInKey(midi: number, fifths: number, up: boolean) {
  const cands: { pname: string; oct: number; alter: number; score: number }[] = [];
  for (const pname of PNAMES) {
    for (let alter = -2; alter <= 2; alter++) {
      const nat = midi - alter;
      const pcs = [0, 2, 4, 5, 7, 9, 11][PNAMES.indexOf(pname)];
      if ((((nat % 12) + 12) % 12) !== pcs) continue;
      const oct = Math.floor(nat / 12) - 1;
      let s = Math.abs(alter) * 10;
      if (alter === keyAlter(fifths, pname)) s = 0;
      else if (alter === 0) s = 3;
      else if (Math.abs(alter) === 1) s = (alter > 0) === (up || fifths > 0) ? 5 : 7;
      cands.push({ pname, oct, alter, score: s });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  return cands[0];
}

function notePitch(n: Element, fifths: number) {
  const pname = n.getAttribute('pname') || 'c';
  const oct = Number(n.getAttribute('oct') || 4);
  const alter = Score.alterOf(n, keyAlter(fifths, pname));
  return { pname, oct, alter, midi: midiOf(pname, oct, alter) };
}

function setPitch(n: Element, p: { pname: string; oct: number; alter: number }) {
  n.setAttribute('pname', p.pname);
  n.setAttribute('oct', String(p.oct));
  n.removeAttribute('accid');
  for (const k of children(n, 'accid')) k.remove();
  // always explicit, so a natural in a sharp key is not read back as sharp
  n.setAttribute('accid.ges', p.alter ? (alterToAccid(p.alter) === 'x' ? 'ss' : alterToAccid(p.alter)) : 'n');
}

/** The note nearest before a position in the same layer, used to pick the octave for letter entry. */
function previousPitch(score: Score, target: Element): { pname: string; oct: number } | null {
  let p: Element | null = target;
  for (let i = 0; i < 64 && p; i++) {
    p = neighbor(score, p, -1, true);
    if (!p) break;
    const n = p.localName === 'note' ? p : p.localName === 'chord' ? children(p, 'note').slice(-1)[0] : null;
    if (n) return { pname: n.getAttribute('pname') || 'c', oct: Number(n.getAttribute('oct') || 4) };
  }
  return null;
}

function defaultOctave(score: Score, target: Element): number {
  const { staffN } = locate(eventOf(target));
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  const shape = sd?.getAttribute('clef.shape') || child(sd!, 'clef')?.getAttribute('shape') || 'G';
  const line = Number(sd?.getAttribute('clef.line') || 2);
  if (shape === 'F') return 3;
  if (shape === 'C') return line >= 4 ? 3 : 4;
  return 4;
}

// ---------- commands ----------

export interface CommandResult {
  selection?: Selection;
  cursor?: string | null;
  message?: string;
  createdIds?: string[];
}

const TIMED = new Set(['note', 'chord', 'rest', 'space', 'mRest', 'mSpace', 'multiRest']);
const isTimed = (e: Element) => TIMED.has(e.localName);

/** Enters a note (or adds a chord tone) for a letter A–G. */
/** Enters a note for a letter A–G at the cursor (or adds a chord tone above the selected note). */
export function enterLetter(score: Score, cursorId: string | null, sel: Selection, letter: string, input: InputState, _mode: 'input' | 'normal', addToChord: boolean): CommandResult {
  const pname = letter.toLowerCase();
  if (addToChord) {
    const target = selectedEvent(score, sel);
    if (!target) throw new EditError('Select a note first.');
    return addChordTone(score, target, pname);
  }
  const target = cursorTarget(score, cursorId, sel, input);
  const fifths = keyAt(score, target);
  const prev = previousPitch(score, target);
  const oct = prev ? nearestOctave(pname, stepOf(prev.pname, prev.oct)) : defaultOctave(score, target);
  return enterPitchAt(score, getId(target), { pname, oct, alter: keyAlter(fifths, pname) }, input);
}

/** Writes a note of the input duration at an exact pitch, replacing what is at `targetId`. */
export function enterPitchAt(score: Score, targetId: string, pitch: { pname: string; oct: number; alter?: number }, input: InputState): CommandResult {
  const t = score.byId(targetId);
  if (!t) throw new EditError('Click inside a measure.');
  const fifths = keyAt(score, t);
  const resolved = resolveTarget(score, t)!;
  const alter = pitch.alter ?? keyAlter(fifths, pitch.pname);
  const note = makeEvent(score, 'note', input.dur, input.dots, { pname: pitch.pname, oct: pitch.oct, alter });
  const layer = ancestor(resolved, 'layer')!;
  const placed = overwrite(score, resolved, note);
  afterEdit(score, layer);
  const cursor = nextCursor(score, placed);
  return { selection: { kind: 'events', ids: [getId(placed)] }, cursor };
}

/** Adds an exact pitch to the note/chord `targetId` (no change if that pitch is already there). */
export function addChordPitch(score: Score, targetId: string, pitch: { pname: string; oct: number }): CommandResult {
  const t = score.byId(targetId);
  if (!t) throw new EditError('Select a note first.');
  const ev = eventOf(t);
  const existing = (ev.localName === 'chord' ? children(ev, 'note') : [ev]).find((n) => n.getAttribute('pname') === pitch.pname && n.getAttribute('oct') === String(pitch.oct));
  if (existing) return { selection: { kind: 'events', ids: [getId(existing)] } };
  const r = addChordTone(score, ev, pitch.pname);
  const added = score.byId((r.selection as { ids: string[] }).ids[0])!;
  added.setAttribute('oct', String(pitch.oct));
  sortChord(ancestor(added, 'chord')!);
  afterEdit(score, locate(added).layer);
  return r;
}

function nearestOctave(pname: string, fromStep: number): number {
  let best = 4;
  let bestDist = Infinity;
  for (let oct = 0; oct <= 8; oct++) {
    const d = Math.abs(stepOf(pname, oct) - fromStep);
    if (d < bestDist) {
      bestDist = d;
      best = oct;
    }
  }
  return best;
}

function addChordTone(score: Score, target: Element, pname: string): CommandResult {
  const ev = eventOf(target);
  if (ev.localName !== 'note' && ev.localName !== 'chord') throw new EditError('Chord tones can only be added to notes.');
  const fifths = keyAt(score, ev);
  let chord = ev;
  if (ev.localName === 'note') {
    chord = el(score.doc, 'chord', { dur: ev.getAttribute('dur') || '4', dots: ev.getAttribute('dots') || undefined });
    for (const a of ['stem.dir', 'artic', 'grace']) if (ev.getAttribute(a)) chord.setAttribute(a, ev.getAttribute(a)!);
    ev.parentElement!.insertBefore(chord, ev);
    chord.appendChild(ev);
    ev.removeAttribute('dur');
    ev.removeAttribute('dots');
    ev.removeAttribute('dur.ppq');
    // control events that pointed at the note keep pointing at it; Verovio resolves them through the chord
  }
  const notes = children(chord, 'note');
  const ref = target.localName === 'note' && ancestor(target, 'chord') ? target : notes[notes.length - 1];
  const refStep = stepOf(ref.getAttribute('pname') || 'c', Number(ref.getAttribute('oct') || 4));
  let oct = nearestOctave(pname, refStep);
  if (stepOf(pname, oct) <= refStep) oct++;
  const n = el(score.doc, 'note', { pname, oct });
  const alter = keyAlter(fifths, pname);
  n.setAttribute('accid.ges', alter ? alterToAccid(alter) : 'n');
  chord.appendChild(n);
  sortChord(chord);
  afterEdit(score, locate(chord).layer);
  return { selection: { kind: 'events', ids: [getId(n)] } };
}

function sortChord(chord: Element) {
  const notes = children(chord, 'note');
  notes.sort((a, b) => stepOf(a.getAttribute('pname')!, Number(a.getAttribute('oct'))) - stepOf(b.getAttribute('pname')!, Number(b.getAttribute('oct'))));
  for (const n of notes) chord.appendChild(n);
  for (const c of children(chord)) if (c.localName !== 'note') chord.appendChild(c);
}

export function enterRest(score: Score, cursorId: string | null, sel: Selection, input: InputState, mode: 'input' | 'normal'): CommandResult {
  if (mode === 'normal') return deleteSelection(score, sel);
  const target = cursorTarget(score, cursorId, sel, input);
  const resolved = resolveTarget(score, target)!;
  const layer = ancestor(resolved, 'layer')!;
  const placed = overwrite(score, resolved, makeEvent(score, 'rest', input.dur, input.dots));
  afterEdit(score, layer);
  return { selection: { kind: 'events', ids: [getId(placed)] }, cursor: nextCursor(score, placed) };
}

/** Where the next input goes: the cursor, else the selection, else the first measure. */
export function cursorTarget(score: Score, cursorId: string | null, sel: Selection, input: InputState): Element {
  let target = cursorId ? score.byId(cursorId) : null;
  if (!target && sel.kind === 'events') target = score.byId(sel.ids[sel.ids.length - 1]);
  if (!target && sel.kind === 'measures') {
    const m = score.byId(sel.measureIds[0])!;
    const layer = voiceLayer(score, m, sel.staves[0] || '1', input.voice);
    target = firstLeaf(layer);
  }
  if (!target) {
    const m = score.measures()[0];
    const layer = voiceLayer(score, m, score.staffDefs()[0]?.getAttribute('n') || '1', input.voice);
    target = firstLeaf(layer);
  }
  target = eventOf(target);
  // voice switching: put the cursor in the requested layer of the same staff and measure
  const loc = locate(target);
  const layer0 = voiceLayer(score, loc.measure, loc.staffN, input.voice);
  if (layer0 !== loc.layer) {
    const layer = layer0;
    const tick = startTick(score, target.parentElement === loc.layer ? target : ancestorIn(target, loc.layer));
    prepare(score, layer);
    target = itemAtTick(score, layer, tick) || children(layer)[0];
  }
  return target;
}

export function firstLeaf(container: Element): Element | null {
  for (const c of children(container)) {
    if (isLeaf(c) && !c.getAttribute('grace')) return c;
    if (['beam', 'tuplet', 'bTrem', 'fTrem'].includes(c.localName)) {
      const f = firstLeaf(c);
      if (f) return f;
    }
  }
  return null;
}

/** Voice 1 is a staff's first layer whatever its number (imports often use n="5"); others match by n. */
export function voiceLayer(score: Score, measure: Element, staffN: string, voice: string): Element {
  const staff = score.staffEl(measure, staffN);
  const layers = staff ? children(staff, 'layer') : [];
  if (voice === '1' && layers.length) return layers[0];
  return layers.find((l) => (l.getAttribute('n') || '1') === voice) || score.layerEl(measure, staffN, voice, true)!;
}

function ancestorIn(e: Element, container: Element): Element {
  let x = e;
  while (x.parentElement && x.parentElement !== container) x = x.parentElement;
  return x;
}

export function selectedEvent(score: Score, sel: Selection): Element | null {
  if (sel.kind !== 'events' || !sel.ids.length) return null;
  return score.byId(sel.ids[sel.ids.length - 1]);
}

export function selectedEvents(score: Score, sel: Selection): Element[] {
  if (sel.kind === 'events') {
    const seen = new Set<Element>();
    for (const id of sel.ids) {
      const e = score.byId(id);
      if (e) seen.add(e);
    }
    return [...seen];
  }
  if (sel.kind === 'measures') {
    const out: Element[] = [];
    for (const mid of sel.measureIds) {
      const m = score.byId(mid);
      if (!m) continue;
      for (const s of children(m, 'staff')) {
        if (sel.staves.length && !sel.staves.includes(s.getAttribute('n') || '')) continue;
        for (const l of children(s, 'layer')) {
          const walk = (c: Element) => {
            for (const x of children(c)) {
              if (isLeaf(x)) out.push(x);
              else walk(x);
            }
          };
          walk(l);
        }
      }
    }
    return out;
  }
  return [];
}

export function selectedNotes(score: Score, sel: Selection): Element[] {
  const out: Element[] = [];
  for (const e of selectedEvents(score, sel)) {
    if (e.localName === 'note') out.push(e);
    else if (e.localName === 'chord') out.push(...children(e, 'note'));
  }
  return [...new Set(out)];
}

/** Sets the duration of the selected events (normal mode). */
export function setDuration(score: Score, sel: Selection, dur: string, dots: number): CommandResult {
  const evs = selectedEvents(score, sel).map(eventOf).filter((e) => ['note', 'chord', 'rest', 'space'].includes(e.localName));
  if (!evs.length) throw new EditError('Select a note or rest.');
  const ids: string[] = [];
  for (const ev of [...new Set(evs)]) {
    if (!ev.isConnected) continue;
    const layer = ancestor(ev, 'layer')!;
    prepare(score, layer);
    const copy = ev.cloneNode(true) as Element;
    setDurAttrs(copy, dur, dots);
    // keep the same id so the selection and attached markings survive
    const container = ev.parentElement!;
    const measure = ancestor(ev, 'measure')!;
    const cap = score.containerCapacity(container);
    const start = startTick(score, ev);
    let need = score.itemTicks(copy, measure);
    if (start + need > cap + 0.001) {
      const fit = largestFit(cap - start)!;
      setDurAttrs(copy, fit.dur, fit.dots);
      need = score.itemTicks(copy, measure);
    }
    const old = score.itemTicks(ev, measure);
    if (need < old) {
      setDurAttrs(ev, copy.getAttribute('dur')!, Number(copy.getAttribute('dots') || 0));
      fillRests(score, container, ev.nextElementSibling, old - need);
    } else if (need > old) {
      setDurAttrs(ev, copy.getAttribute('dur')!, Number(copy.getAttribute('dots') || 0));
      // consume following items
      let extra = need - old;
      let next = ev.nextElementSibling;
      const removed: Element[] = [];
      while (next && extra > 0.001) {
        const t = score.itemTicks(next, measure);
        const n2 = next.nextElementSibling;
        if (t > 0) {
          removed.push(next);
          extra -= t;
        }
        next = n2;
      }
      for (const r of removed) r.remove();
      fixRefs(score, removed, null);
      if (extra < -0.001) fillRests(score, container, next, -extra);
    }
    afterEdit(score, layer);
    ids.push(getId(ev));
  }
  return { selection: { kind: 'events', ids } };
}

export function toggleDot(score: Score, sel: Selection): CommandResult {
  const ev = selectedEvent(score, sel);
  if (!ev) throw new EditError('Select a note or rest.');
  const e = eventOf(ev);
  const dots = Number(e.getAttribute('dots') || 0);
  return setDuration(score, sel, e.getAttribute('dur') || '4', dots ? 0 : 1);
}

export function deleteSelection(score: Score, sel: Selection): CommandResult {
  if (sel.kind === 'measures') {
    for (const mid of sel.measureIds) {
      const m = score.byId(mid);
      if (!m) continue;
      for (const s of children(m, 'staff')) {
        if (sel.staves.length && !sel.staves.includes(s.getAttribute('n') || '')) continue;
        for (const l of children(s, 'layer')) {
          const removed = children(l);
          for (const r of removed) r.remove();
          fixRefs(score, removed, null);
          if (l.getAttribute('n') !== '1') l.remove();
          else l.appendChild(el(score.doc, m.getAttribute('metcon') === 'false' ? 'rest' : 'mRest', m.getAttribute('metcon') === 'false' ? { dur: '4' } : {}));
        }
      }
    }
    score.invalidate();
    return { selection: sel };
  }
  const ids: string[] = [];
  for (const e of selectedEvents(score, sel)) {
    if (!e.isConnected) continue;
    // markings (dynamics, slurs, text…), lyrics and in-layer clefs are simply removed
    if (e.parentElement?.localName === 'measure' && e.localName !== 'staff') {
      e.remove();
      continue;
    }
    if (e.localName === 'verse' || e.localName === 'syl' || e.localName === 'clef' || e.localName === 'artic') {
      (e.localName === 'syl' ? ancestor(e, 'verse') || e : e).remove();
      continue;
    }
    const layer = ancestor(e, 'layer')!;
    if (e.localName === 'note' && ancestor(e, 'chord')) {
      const chord = ancestor(e, 'chord')!;
      const notes = children(chord, 'note');
      if (notes.length > 1) {
        e.remove();
        fixRefs(score, [e], null);
        if (notes.length === 2) unwrapChord(chord);
        afterEdit(score, layer);
        ids.push(getId(notes.find((n) => n !== e)!));
        continue;
      }
    }
    const ev = eventOf(e);
    if (ev.localName === 'rest' || ev.localName === 'mRest' || ev.localName === 'space') {
      ids.push(getId(ev));
      continue;
    }
    if (ev.getAttribute('grace')) {
      const n = neighbor(score, ev, 1) || neighbor(score, ev, -1);
      ev.remove();
      fixRefs(score, [ev], null);
      afterEdit(score, layer);
      if (n) ids.push(getId(n));
      continue;
    }
    const rest = el(score.doc, 'rest', { dur: ev.getAttribute('dur') || '4', dots: ev.getAttribute('dots') || undefined });
    ev.parentElement!.insertBefore(rest, ev);
    ev.remove();
    fixRefs(score, [ev], null);
    afterEdit(score, layer);
    if (rest.isConnected) ids.push(getId(rest));
  }
  return { selection: ids.length ? { kind: 'events', ids } : NONE };
}

function unwrapChord(chord: Element) {
  const notes = children(chord, 'note');
  if (notes.length !== 1) return;
  const n = notes[0];
  n.setAttribute('dur', chord.getAttribute('dur') || '4');
  if (chord.getAttribute('dots')) n.setAttribute('dots', chord.getAttribute('dots')!);
  for (const a of ['artic', 'stem.dir', 'grace']) if (chord.getAttribute(a) && !n.getAttribute(a)) n.setAttribute(a, chord.getAttribute(a)!);
  chord.parentElement!.insertBefore(n, chord);
  // keep the chord's id on the note so references stay valid
  const cid = getId(chord);
  for (const c of children(chord)) n.appendChild(c);
  chord.remove();
  for (const m of descendants(n.ownerDocument!.documentElement, 'measure')) {
    for (const c of children(m)) {
      for (const a of ['startid', 'endid']) if (c.getAttribute(a) === '#' + cid) c.setAttribute(a, '#' + getId(n));
    }
  }
}

/** Moves the selected notes by semitones (or octaves when `octave`), or diatonic steps. */
export function transposeNotes(score: Score, sel: Selection, amount: number, unit: 'semitone' | 'step' | 'octave'): CommandResult {
  const notes = selectedNotes(score, sel);
  if (!notes.length) throw new EditError('Select one or more notes.');
  const layers = new Set<Element>();
  for (const n of notes) {
    const fifths = keyAt(score, n);
    const p = notePitch(n, fifths);
    if (unit === 'octave') setPitch(n, { pname: p.pname, oct: p.oct + amount, alter: p.alter });
    else if (unit === 'step') {
      const s = fromStep(stepOf(p.pname, p.oct) + amount);
      setPitch(n, { ...s, alter: keyAlter(fifths, s.pname) });
    } else {
      const sp = spellInKey(p.midi + amount, fifths, amount > 0);
      setPitch(n, sp);
    }
    layers.add(locate(n).layer);
  }
  for (const l of layers) afterEdit(score, l);
  return { selection: sel };
}

/** Swaps each selected note to its other spelling (C♯ ↔ D♭, E ↔ F♭…), keeping the pitch. */
export function respellEnharmonic(score: Score, sel: Selection): CommandResult {
  const notes = selectedNotes(score, sel);
  if (!notes.length) throw new EditError('Select one or more notes.');
  const layers = new Set<Element>();
  for (const n of notes) {
    const fifths = keyAt(score, n);
    const p = notePitch(n, fifths);
    // every spelling of this pitch with at most a double accidental, simplest first
    const opts: { pname: string; oct: number; alter: number }[] = [];
    for (const pname of PNAMES) {
      for (let alter = -2; alter <= 2; alter++) {
        const nat = p.midi - alter;
        if ((((nat % 12) + 12) % 12) !== [0, 2, 4, 5, 7, 9, 11][PNAMES.indexOf(pname)]) continue;
        opts.push({ pname, oct: Math.floor(nat / 12) - 1, alter });
      }
    }
    opts.sort((a, b) => Math.abs(a.alter) - Math.abs(b.alter) || a.alter - b.alter);
    const single = opts.filter((o) => Math.abs(o.alter) <= 1);
    const pool = single.length > 1 ? single : opts;
    const at = pool.findIndex((o) => o.pname === p.pname && o.alter === p.alter);
    setPitch(n, pool[(at + 1) % pool.length]);
    layers.add(locate(n).layer);
  }
  for (const l of layers) afterEdit(score, l);
  return { selection: sel };
}

/** Adds a note `steps` scale steps above (positive) or below (negative) each selected note or chord. */
export function addInterval(score: Score, sel: Selection, steps: number): CommandResult {
  const events = selectedEvents(score, sel).filter((e) => e.localName === 'note' || e.localName === 'chord');
  if (!events.length) throw new EditError('Select a note to add an interval to.');
  const added: string[] = [];
  for (const ev0 of events) {
    const ev = eventOf(ev0);
    const notes = ev.localName === 'chord' ? children(ev, 'note') : [ev];
    const ref = notes.reduce((a, b) => {
      const sa = stepOf(a.getAttribute('pname') || 'c', Number(a.getAttribute('oct') || 4));
      const sb = stepOf(b.getAttribute('pname') || 'c', Number(b.getAttribute('oct') || 4));
      return steps > 0 ? (sb > sa ? b : a) : sb < sa ? b : a;
    });
    const target = fromStep(stepOf(ref.getAttribute('pname') || 'c', Number(ref.getAttribute('oct') || 4)) + steps);
    const r = addChordPitch(score, getId(ref), target);
    if (r.selection?.kind === 'events') added.push(...r.selection.ids);
  }
  return { selection: { kind: 'events', ids: added.length ? added : (sel.kind === 'events' ? sel.ids : []) } };
}

/** Makes each selected note or rest one value longer (+1) or shorter (-1): half ↔ quarter ↔ eighth… */
export function nudgeDuration(score: Score, sel: Selection, dir: 1 | -1): CommandResult {
  const ev = selectedEvent(score, sel);
  if (!ev) throw new EditError('Select a note or rest.');
  const order = ['1', '2', '4', '8', '16', '32', '64'];
  const e = eventOf(ev);
  const cur = e.getAttribute('dur') || (e.localName === 'chord' ? children(e, 'note')[0]?.getAttribute('dur') : '') || '4';
  const i = order.indexOf(cur);
  const next = order[Math.max(0, Math.min(order.length - 1, (i < 0 ? 2 : i) - dir))];
  if (next === cur) throw new EditError(dir > 0 ? 'That is already the longest value.' : 'That is already the shortest value.');
  return setDuration(score, sel, next, 0);
}

export function setAccidental(score: Score, sel: Selection, alter: number): CommandResult {
  const notes = selectedNotes(score, sel);
  if (!notes.length) throw new EditError('Select a note.');
  for (const n of notes) {
    n.removeAttribute('accid.ges');
    for (const k of children(n, 'accid')) k.remove();
    n.setAttribute('accid', alterToAccid(alter));
    afterEdit(score, locate(n).layer);
  }
  return { selection: sel };
}

export function toggleCautionary(score: Score, sel: Selection): CommandResult {
  for (const n of selectedNotes(score, sel)) {
    if (n.getAttribute('data-caution') === 'true') n.removeAttribute('data-caution');
    else n.setAttribute('data-caution', 'true');
    afterEdit(score, locate(n).layer);
  }
  return { selection: sel };
}

// ---------- ties, slurs, tuplets ----------

export function toggleTie(score: Score, sel: Selection, cursorId: string | null, input: InputState, mode: 'input' | 'normal'): CommandResult {
  const ev = selectedEvent(score, sel);
  if (!ev) throw new EditError('Select a note to tie.');
  const event = eventOf(ev);
  if (event.localName !== 'note' && event.localName !== 'chord') throw new EditError('Only notes can be tied.');
  const notes = event.localName === 'chord' ? children(event, 'note') : [event];
  const already = notes.some((n) => /[im]/.test(n.getAttribute('tie') || ''));
  let next = neighbor(score, event, 1, false);
  if (already) {
    for (const n of notes) {
      const t = n.getAttribute('tie');
      if (t === 'i') n.removeAttribute('tie');
      else if (t === 'm') n.setAttribute('tie', 't');
    }
    if (next) for (const n of next.localName === 'chord' ? children(next, 'note') : [next]) {
      const t = n.getAttribute('tie');
      if (t === 't') n.removeAttribute('tie');
      else if (t === 'm') n.setAttribute('tie', 'i');
    }
    score.invalidate();
    return { selection: sel };
  }
  const samePitch = (a: Element[], b: Element | null) => {
    if (!b) return false;
    const bn = b.localName === 'chord' ? children(b, 'note') : b.localName === 'note' ? [b] : [];
    return a.every((n) => bn.some((m) => m.getAttribute('pname') === n.getAttribute('pname') && m.getAttribute('oct') === n.getAttribute('oct')));
  };
  let cursor: string | null | undefined;
  if (!samePitch(notes, next)) {
    if (mode !== 'input' || !next) throw new EditError('The next note has a different pitch.');
    // in note input, tie creates the next note at the same pitch
    const target = resolveTarget(score, cursorId ? score.byId(cursorId) || next : next)!;
    const layer = ancestor(target, 'layer')!;
    const copy = cloneFresh(event);
    for (const k of Array.from(copy.getElementsByTagName('*'))) if (['verse', 'artic', 'syl'].includes(k.localName)) k.remove();
    copy.removeAttribute('artic');
    setDurAttrs(copy, input.dur, input.dots);
    next = overwrite(score, target, copy);
    afterEdit(score, layer);
    cursor = nextCursor(score, next);
  }
  const nextNotes = next!.localName === 'chord' ? children(next!, 'note') : [next!];
  for (const n of notes) {
    n.setAttribute('tie', n.getAttribute('tie') === 't' ? 'm' : 'i');
    const m = nextNotes.find((x) => x.getAttribute('pname') === n.getAttribute('pname') && x.getAttribute('oct') === n.getAttribute('oct'));
    if (m) m.setAttribute('tie', m.getAttribute('tie') === 'i' ? 'm' : 't');
  }
  score.invalidate();
  return cursor !== undefined ? { selection: { kind: 'events', ids: [getId(next!)] }, cursor } : { selection: sel };
}

function rangeEnds(score: Score, sel: Selection): [Element, Element] {
  const evs = selectedEvents(score, sel).map(eventOf).filter(isTimed);
  if (!evs.length) throw new EditError('Select the notes first.');
  const first = evs[0];
  const { staffN, layerN } = locate(first);
  const seq = leafSequence(score, staffN, layerN, true);
  const sorted = evs.filter((e) => seq.includes(e)).sort((a, b) => seq.indexOf(a) - seq.indexOf(b));
  let start = sorted[0] || first;
  let end = sorted[sorted.length - 1] || first;
  if (start === end) {
    const n = neighbor(score, start, 1, false);
    if (!n) throw new EditError('Select at least two notes.');
    end = n;
  }
  return [start, end];
}

/** Adds a spanner (slur, hairpin, gliss, octave line, pedal, trill extension) over the selection. */
export function addSpanner(score: Score, sel: Selection, name: string, attrs: Record<string, string> = {}): CommandResult {
  const [start, end] = rangeEnds(score, sel);
  const measure = ancestor(start, 'measure')!;
  const sp = el(score.doc, name, { startid: '#' + getId(start), endid: '#' + getId(end), ...attrs });
  if (name === 'pedal') {
    sp.removeAttribute('endid');
    sp.setAttribute('dir', 'down');
    const up = el(score.doc, 'pedal', { dir: 'up', startid: '#' + getId(end) });
    ancestor(end, 'measure')!.appendChild(up);
  }
  measure.appendChild(sp);
  score.invalidate();
  return { selection: sel, createdIds: [getId(sp)] };
}

/** Converts the selected event into a tuplet (3 = triplet, 5 = quintuplet…). */
export function makeTuplet(score: Score, sel: Selection, num: number, cursorId: string | null, input: InputState, mode: 'input' | 'normal'): CommandResult {
  let ev = mode === 'input' && cursorId ? score.byId(cursorId) : selectedEvent(score, sel);
  if (!ev) throw new EditError('Select a note or rest.');
  ev = resolveTarget(score, ev)!;
  const layer = ancestor(ev, 'layer')!;
  if (ancestor(ev, 'tuplet')) throw new EditError('Nested tuplets are not supported yet.');
  const dur = mode === 'input' ? input.dur : ev.getAttribute('dur') || '4';
  const d = Number(dur);
  if (!d || d >= 128) throw new EditError('That duration is too short for a tuplet.');
  let numbase = 1;
  while (numbase * 2 < num) numbase *= 2;
  if (num < 3) throw new EditError('Use 3 or more notes for a tuplet.');
  const innerDur = String(d * numbase);
  const tuplet = el(score.doc, 'tuplet', { num, numbase, 'num.visible': 'true', 'bracket.visible': 'auto' });
  // span = one `dur` note (two dotted-eighths-worth for a duplet)
  const spanEl = el(score.doc, 'rest', { dur });
  const placed = overwrite(score, ev, spanEl);
  placed.parentElement!.insertBefore(tuplet, placed);
  placed.remove();
  const first = ev.localName === 'note' || ev.localName === 'chord' ? ev.cloneNode(true) as Element : el(score.doc, 'rest', {});
  setDurAttrs(first, innerDur, 0);
  setId(first, getId(spanEl)); // markings that pointed at the old note were moved to spanEl
  tuplet.appendChild(first);
  for (let i = 1; i < num; i++) tuplet.appendChild(el(score.doc, 'rest', { dur: innerDur }));
  afterEdit(score, layer);
  return { selection: { kind: 'events', ids: [getId(first)] }, cursor: mode === 'input' ? getId(first) : undefined };
}

// ---------- attachments ----------

export function toggleArtic(score: Score, sel: Selection, artic: string): CommandResult {
  const evs = [...new Set(selectedEvents(score, sel).map(eventOf))].filter((e) => e.localName === 'note' || e.localName === 'chord');
  if (!evs.length) throw new EditError('Select notes to add articulations.');
  const has = (e: Element) => (e.getAttribute('artic') || '').split(/\s+/).includes(artic) || children(e, 'artic').some((a) => a.getAttribute('artic') === artic);
  const remove = evs.every(has);
  for (const e of evs) {
    const list = (e.getAttribute('artic') || '').split(/\s+/).filter(Boolean).filter((a) => a !== artic);
    for (const a of children(e, 'artic')) if (a.getAttribute('artic') === artic) a.remove();
    if (!remove) list.push(artic);
    if (list.length) e.setAttribute('artic', list.join(' '));
    else e.removeAttribute('artic');
  }
  score.invalidate();
  return { selection: sel };
}

export function setNoteAttr(score: Score, sel: Selection, attr: string, value: string | null, on: 'event' | 'note' = 'event'): CommandResult {
  const targets = on === 'note' ? selectedNotes(score, sel) : [...new Set(selectedEvents(score, sel).map(eventOf))];
  if (!targets.length) throw new EditError('Select notes first.');
  const allSame = targets.every((t) => t.getAttribute(attr) === value);
  for (const t of targets) {
    if (value === null || allSame) t.removeAttribute(attr);
    else t.setAttribute(attr, value);
  }
  score.invalidate();
  return { selection: sel };
}

/** Adds a control event attached to the first selected event (dynamics, text, fermata, ornaments…). */
export function addControl(score: Score, sel: Selection, name: string, attrs: Record<string, string> = {}, text?: string, rend?: Record<string, string>): CommandResult {
  const evs = selectedEvents(score, sel).map(eventOf).filter(isTimed);
  const targets = evs.length ? [evs[0]] : [];
  if (!targets.length) throw new EditError('Select a note first.');
  const ids: string[] = [];
  for (const t of targets) {
    const m = ancestor(t, 'measure')!;
    const c = el(score.doc, name, { startid: '#' + getId(t), ...attrs });
    if (text !== undefined) {
      if (rend) {
        const r = el(score.doc, 'rend', rend);
        r.textContent = text;
        c.appendChild(r);
      } else c.textContent = text;
    }
    m.appendChild(c);
    ids.push(getId(c));
  }
  score.invalidate();
  // keep the note selected so several markings can be added in a row
  return { selection: sel, createdIds: ids } as CommandResult;
}

export function addTempo(score: Score, sel: Selection, bpm: number, text: string, unit = '4', dots = 0): CommandResult {
  // midi.bpm counts quarter notes; scale from the marked beat (e.g. a dotted quarter = 1.5)
  const quarters = (4 / Number(unit)) * (dots ? 1.5 : 1);
  const r = addControl(score, sel, 'tempo', { 'midi.bpm': String(Math.round(bpm * quarters)), mm: String(bpm), 'mm.unit': unit, place: 'above', ...(dots ? { 'mm.dots': '1' } : {}) });
  const t = score.byId(r.createdIds![0])!;
  t.textContent = `${text ? text + ' ' : ''}${tempoGlyph(t)} = ${bpm}`;
  return r;
}

export function setLyric(score: Score, noteId: string, text: string, verseN = 1): CommandResult {
  const e = score.byId(noteId);
  if (!e) throw new EditError('Select a note.');
  const ev = eventOf(e);
  const note = ev.localName === 'chord' ? children(ev, 'note')[0] : ev;
  if (!note || note.localName !== 'note') throw new EditError('Lyrics go on notes.');
  for (const v of children(note, 'verse')) if ((v.getAttribute('n') || '1') === String(verseN)) v.remove();
  const clean = text.trim();
  if (clean) {
    const hyphen = clean.endsWith('-');
    const extender = clean.endsWith('_');
    const word = clean.replace(/[-_]+$/, '');
    const verse = el(score.doc, 'verse', { n: verseN });
    const syl = el(score.doc, 'syl', {});
    syl.textContent = word;
    const prev = neighbor(score, ev, -1, false);
    const prevSyl = prev ? descendants(prev, 'syl').find((s) => ancestor(s, 'verse')?.getAttribute('n') === String(verseN)) : null;
    const continuing = prevSyl?.getAttribute('con') === 'd';
    if (hyphen) {
      syl.setAttribute('con', 'd');
      syl.setAttribute('wordpos', continuing ? 'm' : 'i');
    } else if (continuing) syl.setAttribute('wordpos', 't');
    if (extender) syl.setAttribute('con', 'u');
    verse.appendChild(syl);
    note.appendChild(verse);
  }
  score.invalidate();
  return { selection: { kind: 'events', ids: [getId(ev)] } };
}

export function lyricOf(score: Score, id: string, verseN = 1): string {
  const e = score.byId(id);
  if (!e) return '';
  const syl = descendants(eventOf(e), 'syl').find((s) => (ancestor(s, 'verse')?.getAttribute('n') || '1') === String(verseN));
  if (!syl) return '';
  return (syl.textContent || '') + (syl.getAttribute('con') === 'd' ? '-' : syl.getAttribute('con') === 'u' ? '_' : '');
}

export function addGrace(score: Score, sel: Selection, kind: 'acc' | 'unacc'): CommandResult {
  const ev = selectedEvent(score, sel);
  if (!ev) throw new EditError('Select a note.');
  const event = eventOf(ev);
  if (event.localName !== 'note' && event.localName !== 'chord') throw new EditError('Grace notes go before notes.');
  const src = event.localName === 'chord' ? children(event, 'note').slice(-1)[0] : event;
  const g = el(score.doc, 'note', {
    pname: src.getAttribute('pname')!, oct: src.getAttribute('oct')!, dur: kind === 'unacc' ? '8' : '16', grace: kind,
    'stem.mod': kind === 'unacc' ? undefined : undefined,
  });
  if (src.getAttribute('accid.ges')) g.setAttribute('accid.ges', src.getAttribute('accid.ges')!);
  event.parentElement!.insertBefore(g, event);
  const layer = locate(event).layer;
  afterEdit(score, layer);
  return { selection: { kind: 'events', ids: [getId(g)] } };
}

// ---------- measures ----------

export function renumber(score: Score) {
  score.invalidate();
  const ms = score.measures();
  let n = ms[0]?.getAttribute('metcon') === 'false' ? 0 : 1;
  for (const m of ms) {
    m.setAttribute('n', String(n));
    n++;
  }
}

export function insertMeasures(score: Score, ref: Element | null, count: number, where: 'before' | 'after' | 'end'): Element[] {
  const staves = score.staffDefs().map((d) => d.getAttribute('n') || '1');
  const out: Element[] = [];
  const ms = score.measures();
  let anchor = where === 'end' || !ref ? ms[ms.length - 1] : ref;
  const parent = anchor ? anchor.parentElement! : score.section;
  for (let i = 0; i < count; i++) {
    const m = el(score.doc, 'measure', { n: 0 });
    for (const sn of staves) m.appendChild(el(score.doc, 'staff', { n: sn })).appendChild(el(score.doc, 'layer', { n: 1 })).appendChild(el(score.doc, 'mRest'));
    if (where === 'before' && ref) parent.insertBefore(m, ref);
    else {
      parent.insertBefore(m, anchor ? anchor.nextSibling : null);
      anchor = m;
    }
    out.push(m);
  }
  // keep the final barline at the end of the piece
  if (where !== 'before') {
    score.invalidate();
    const msAll = score.measures();
    const last = msAll[msAll.length - 1];
    const stray = msAll.filter((m) => m !== last && m.getAttribute('right') === 'end');
    if (stray.length) {
      for (const m of stray) m.removeAttribute('right');
      last.setAttribute('right', 'end');
    }
  }
  renumber(score);
  return out;
}

export function deleteMeasures(score: Score, sel: Selection): CommandResult {
  if (sel.kind !== 'measures') throw new EditError('Select whole measures (click an empty part of a staff).');
  const ms = sel.measureIds.map((id) => score.byId(id)).filter(Boolean) as Element[];
  if (ms.length >= score.measures().length) throw new EditError('A score needs at least one measure.');
  const hadEnd = ms.some((m) => m.getAttribute('right') === 'end');
  const removedIds = new Set(ms.flatMap((m) => idsIn(m)));
  for (const m of ms) m.remove();
  for (const m of score.measures()) {
    for (const c of children(m)) {
      const e = (c.getAttribute('endid') || '').replace(/^#/, '');
      if (e && removedIds.has(e)) c.remove();
    }
  }
  for (const e of descendants(score.scoreEl, 'ending')) if (!descendants(e, 'measure').length) e.remove();
  if (hadEnd) score.measures().slice(-1)[0]?.setAttribute('right', 'end');
  renumber(score);
  return { selection: NONE };
}

export function setBarline(score: Score, sel: Selection, kind: string): CommandResult {
  const ms = measuresOf(score, sel);
  if (!ms.length) throw new EditError('Select a measure or a note.');
  if (kind === 'rptstart') {
    const m = ms[0];
    m.getAttribute('left') === 'rptstart' ? m.removeAttribute('left') : m.setAttribute('left', 'rptstart');
  } else {
    const m = ms[ms.length - 1];
    if (kind === 'single' || m.getAttribute('right') === kind) m.removeAttribute('right');
    else m.setAttribute('right', kind);
  }
  score.invalidate();
  return { selection: sel };
}

export function measuresOf(score: Score, sel: Selection): Element[] {
  if (sel.kind === 'measures') return sel.measureIds.map((id) => score.byId(id)).filter(Boolean) as Element[];
  if (sel.kind === 'events') {
    const out: Element[] = [];
    for (const id of sel.ids) {
      const e = score.byId(id);
      const m = e && (e.localName === 'measure' ? e : ancestor(e, 'measure'));
      if (m && !out.includes(m)) out.push(m);
    }
    return out;
  }
  return [];
}

export function addEnding(score: Score, sel: Selection, n: string): CommandResult {
  const ms = measuresOf(score, sel);
  if (!ms.length) throw new EditError('Select the measures for the ending.');
  const parent = ms[0].parentElement!;
  if (parent.localName === 'ending') {
    // remove the ending: unwrap its measures
    while (parent.firstChild) parent.parentElement!.insertBefore(parent.firstChild, parent);
    parent.remove();
    score.invalidate();
    return { selection: sel };
  }
  if (!ms.every((m) => m.parentElement === parent)) throw new EditError('An ending must cover neighbouring measures in one section.');
  const all = children(parent);
  const idx = ms.map((m) => all.indexOf(m)).sort((a, b) => a - b);
  const ending = el(score.doc, 'ending', { n, label: `${n}.` });
  parent.insertBefore(ending, all[idx[0]]);
  for (let i = idx[0]; i <= idx[idx.length - 1]; i++) ending.appendChild(all[i]);
  score.invalidate();
  return { selection: sel };
}

export function addRepeatMark(score: Score, sel: Selection, func: string, text: string): CommandResult {
  const ms = measuresOf(score, sel);
  if (!ms.length) throw new EditError('Select a measure or a note.');
  const m = func === 'segno' || func === 'coda' ? ms[0] : ms[ms.length - 1];
  const ctx = score.contextOf(m);
  const atEnd = !(func === 'segno' || func === 'coda');
  const dir = el(score.doc, 'repeatMark', { func, staff: '1', tstamp: atEnd ? String(ctx.count + 0.999) : '1', place: 'above' });
  if (text) dir.textContent = text;
  m.appendChild(dir);
  score.invalidate();
  return { selection: sel };
}

export function addBreak(score: Score, sel: Selection, kind: 'sb' | 'pb'): CommandResult {
  const ms = measuresOf(score, sel);
  if (!ms.length) throw new EditError('Select a measure.');
  const m = ms[ms.length - 1];
  const next = m.nextElementSibling;
  if (next && (next.localName === 'sb' || next.localName === 'pb')) next.remove();
  else m.parentElement!.insertBefore(el(score.doc, kind), m.nextSibling);
  score.invalidate();
  return { selection: sel };
}

function defBefore(score: Score, m: Element): Element {
  const prev = m.previousElementSibling;
  if (prev && prev.localName === 'scoreDef') return prev;
  const def = el(score.doc, 'scoreDef');
  m.parentElement!.insertBefore(def, m);
  return def;
}

/** Changes the time signature from the first selected measure on, refitting the following measures. */
export function changeMeter(score: Score, sel: Selection, count: number, unit: number, sym?: string): CommandResult {
  const ms = measuresOf(score, sel);
  const m = ms[0] || score.measures()[0];
  const isFirst = m === score.measures()[0];
  const def = isFirst ? score.mainScoreDef : defBefore(score, m);
  def.setAttribute('meter.count', String(count));
  def.setAttribute('meter.unit', String(unit));
  if (sym) def.setAttribute('meter.sym', sym);
  else def.removeAttribute('meter.sym');
  for (const ms2 of descendants(def, 'meterSig')) ms2.remove();
  if (isFirst) for (const sd of score.staffDefs()) {
    for (const ms2 of children(sd, 'meterSig')) ms2.remove();
    sd.removeAttribute('meter.count');
    sd.removeAttribute('meter.unit');
  }
  score.invalidate();
  // the editor then re-flows the music into the new meter (tools.rebar)
  return { selection: sel };
}

/** Pads or trims every layer from `from` until the next meter change so measures add up (older behaviour). */
export function refit(score: Score, from: Element) {
  const all = score.measures();
  const startIdx = all.indexOf(from);
  for (let i = startIdx; i < all.length; i++) {
    const m = all[i];
    if (i > startIdx) {
      const prev = m.previousElementSibling;
      if (prev?.localName === 'scoreDef' && (prev.getAttribute('meter.count') || descendants(prev, 'meterSig').length)) break;
    }
    if (m.getAttribute('metcon') === 'false') continue;
    const cap = score.capacity(m);
    for (const layer of descendants(m, 'layer')) {
      const items = children(layer);
      if (items.length === 1 && ['mRest', 'mSpace'].includes(items[0].localName)) continue;
      prepare(score, layer);
      let total = score.containerTicks(layer);
      while (total > cap + 0.001) {
        const last = children(layer).filter((c) => score.itemTicks(c, m) > 0).slice(-1)[0];
        if (!last) break;
        const t = score.itemTicks(last, m);
        const keep = cap - (total - t);
        if (keep > 0 && (last.localName === 'note' || last.localName === 'chord' || last.localName === 'rest')) {
          const fit = largestFit(keep)!;
          setDurAttrs(last, fit.dur, fit.dots);
          total = total - t + score.itemTicks(last, m);
          if (total < cap) fillRests(score, layer, null, cap - total);
          total = score.containerTicks(layer);
          break;
        }
        last.remove();
        fixRefs(score, [last], null);
        total -= t;
      }
      if (total < cap - 0.001) fillRests(score, layer, null, cap - total);
      score.invalidate();
      score.tidyLayer(layer);
    }
  }
  score.invalidate();
}

/** Changes the key (concert pitch fifths) from the first selected measure on. */
export function changeKey(score: Score, sel: Selection, concertFifths: number): CommandResult {
  const ms = measuresOf(score, sel);
  const m = ms[0] || score.measures()[0];
  const isFirst = m === score.measures()[0];
  const staves = score.staves();
  if (isFirst) {
    for (const sd of score.staffDefs()) {
      const semi = Number(sd.getAttribute('trans.semi') || 0);
      const perc = (sd.getAttribute('clef.shape') || child(sd, 'clef')?.getAttribute('shape')) === 'perc';
      setKeySig(sd, perc ? '0' : keySigString(writtenFifths(concertFifths, semi)));
    }
    score.mainScoreDef.removeAttribute('key.sig');
    for (const k of children(score.mainScoreDef, 'keySig')) k.remove();
  } else {
    const def = defBefore(score, m);
    for (const k of descendants(def, 'keySig')) k.remove();
    setKeySig(def, keySigString(concertFifths));
    const grp = child(def, 'staffGrp');
    if (grp) grp.remove();
    const trans = staves.filter((s) => s.semi && writtenFifths(concertFifths, s.semi) !== concertFifths);
    if (trans.length) {
      const g = def.appendChild(el(score.doc, 'staffGrp'));
      for (const s of trans) setKeySig(g.appendChild(el(score.doc, 'staffDef', { n: s.n })), keySigString(writtenFifths(concertFifths, s.semi)));
    }
  }
  score.invalidate();
  respellFrom(score, m);
  return { selection: sel };
}

function respellFrom(score: Score, m: Element) {
  const all = score.measures();
  for (let i = all.indexOf(m); i < all.length; i++) {
    for (const s of children(all[i], 'staff')) score.respell(all[i], s.getAttribute('n') || '1');
  }
}

export function insertClef(score: Score, sel: Selection, shape: string, line: number, dis?: number, disPlace?: string): CommandResult {
  let target: Element | null = null;
  let staffN = '1';
  if (sel.kind === 'events') {
    const e = selectedEvent(score, sel);
    if (e) {
      target = eventOf(e);
      staffN = locate(target).staffN;
    }
  } else if (sel.kind === 'measures') {
    const m = score.byId(sel.measureIds[0])!;
    staffN = sel.staves[0] || '1';
    const layer = score.layerEl(m, staffN, '1', true)!;
    target = children(layer)[0];
  }
  if (!target) throw new EditError('Select a note or measure for the clef change.');
  const clef = el(score.doc, 'clef', { shape, line, dis, 'dis.place': disPlace });
  // a clef at the very start of the score changes the staff definition instead
  const m = ancestor(target, 'measure')!;
  const layer = ancestor(target, 'layer')!;
  const atStart = m === score.measures()[0] && score.itemTicks(children(layer)[0]) >= 0 && startTickInLayer(score, target) === 0;
  if (atStart) {
    const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN)!;
    for (const c of children(sd, 'clef')) c.remove();
    sd.setAttribute('clef.shape', shape);
    sd.setAttribute('clef.line', String(line));
    if (dis) {
      sd.setAttribute('clef.dis', String(dis));
      sd.setAttribute('clef.dis.place', disPlace || 'below');
    } else {
      sd.removeAttribute('clef.dis');
      sd.removeAttribute('clef.dis.place');
    }
  } else {
    const parentInLayer = ancestorIn(target, layer);
    layer.insertBefore(clef, parentInLayer);
  }
  score.invalidate();
  return { selection: sel };
}

function startTickInLayer(score: Score, e: Element): number {
  const layer = ancestor(e, 'layer')!;
  return startTick(score, ancestorIn(e, layer));
}

// ---------- copy / paste ----------

export interface Clip {
  kind: 'events' | 'measures';
  xml: string[]; // events: serialized leaf events; measures: serialized <staff> per measure
  staves?: string[];
}

export function copySelection(score: Score, sel: Selection): Clip | null {
  if (sel.kind === 'measures') {
    const xml: string[] = [];
    for (const id of sel.measureIds) {
      const m = score.byId(id);
      if (!m) continue;
      const staves = children(m, 'staff').filter((s) => !sel.staves.length || sel.staves.includes(s.getAttribute('n') || ''));
      xml.push(staves.map((s) => new XMLSerializer().serializeToString(s)).join('\u0000'));
    }
    return { kind: 'measures', xml, staves: sel.staves };
  }
  if (sel.kind === 'events') {
    const evs = [...new Set(selectedEvents(score, sel).map(eventOf))];
    if (!evs.length) return null;
    const { staffN, layerN } = locate(evs[0]);
    const seq = leafSequence(score, staffN, layerN, true);
    evs.sort((a, b) => seq.indexOf(a) - seq.indexOf(b));
    const first = seq.indexOf(evs[0]);
    const last = seq.indexOf(evs[evs.length - 1]);
    const range = seq.slice(first, last + 1).filter((e) => !ancestor(e, 'tuplet'));
    return { kind: 'events', xml: range.map((e) => new XMLSerializer().serializeToString(e)) };
  }
  return null;
}

export function paste(score: Score, sel: Selection, clip: Clip, cursorId: string | null, input: InputState): CommandResult {
  const parse = (x: string) => {
    const d = new DOMParser().parseFromString(x, 'application/xml');
    return score.doc.importNode(d.documentElement, true) as Element;
  };
  if (clip.kind === 'measures') {
    const ms = measuresOf(score, sel);
    if (!ms.length) throw new EditError('Select the measure to paste into.');
    let m: Element | null = ms[0];
    const all = score.measures();
    const ids: string[] = [];
    for (const block of clip.xml) {
      if (!m) m = insertMeasures(score, null, 1, 'end')[0];
      const staves = block.split('\u0000').map(parse);
      const targetStaves = sel.kind === 'measures' && sel.staves.length ? sel.staves : null;
      staves.forEach((s, i) => {
        const n = targetStaves ? targetStaves[i] || s.getAttribute('n') : s.getAttribute('n');
        const fresh = cloneFresh(s);
        fresh.setAttribute('n', n || '1');
        const old = score.staffEl(m!, n || '1');
        if (old) {
          m!.replaceChild(fresh, old);
          fixRefs(score, [old], null);
        } else m!.appendChild(fresh);
      });
      ids.push(getId(m));
      const idx = score.measures().indexOf(m);
      m = score.measures()[idx + 1] || null;
      score.invalidate();
    }
    void all;
    return { selection: { kind: 'measures', measureIds: ids, staves: sel.kind === 'measures' ? sel.staves : [] } };
  }
  let target: Element | null = cursorTarget(score, cursorId, sel, input);
  const placedIds: string[] = [];
  for (const x of clip.xml) {
    if (!target) break;
    const e = cloneFresh(parse(x));
    for (const k of Array.from(e.getElementsByTagName('*'))) if (k.localName === 'verse') k.remove();
    const resolved = resolveTarget(score, target)!;
    const layer = ancestor(resolved, 'layer')!;
    const m = ancestor(resolved, 'measure')!;
    const room = score.containerCapacity(resolved.parentElement!) - startTick(score, resolved);
    if (score.itemTicks(e, m) > room + 0.001) {
      // spill into the next measure
      const nextM = score.measures()[score.measures().indexOf(m) + 1] || insertMeasures(score, null, 1, 'end')[0];
      const { staffN, layerN } = locate(resolved);
      const nl = score.layerEl(nextM, staffN, layerN, true)!;
      prepare(score, nl);
      target = children(nl)[0];
      const r2 = resolveTarget(score, target)!;
      const placed = overwrite(score, r2, e);
      afterEdit(score, ancestor(placed, 'layer')!);
      placedIds.push(getId(placed));
      target = neighbor(score, placed, 1, false);
      continue;
    }
    const placed = overwrite(score, resolved, e);
    afterEdit(score, layer);
    placedIds.push(getId(placed));
    target = neighbor(score, placed, 1, false);
  }
  return { selection: { kind: 'events', ids: placedIds }, cursor: target ? getId(target) : null };
}

// ---------- parts ----------

export function addInstrument(score: Score, instrumentId: string, concertFifths?: number): CommandResult {
  const def = instrumentById(instrumentId);
  const sdefs = score.staffDefs();
  const nextN = Math.max(0, ...sdefs.map((d) => Number(d.getAttribute('n') || 0))) + 1;
  const firstM = score.measures()[0];
  const ctx = score.contextOf(firstM);
  const firstStaffKey = ctx.keys[sdefs[0]?.getAttribute('n') || '1'] ?? 0;
  const firstSemi = Number(sdefs[0]?.getAttribute('trans.semi') || 0);
  const concert = concertFifths ?? writtenFifths(firstStaffKey, -firstSemi);
  let top = child(score.mainScoreDef, 'staffGrp')!;
  if (!top) top = score.mainScoreDef.appendChild(el(score.doc, 'staffGrp'));
  if (!top.getAttribute('symbol')) top.setAttribute('symbol', 'bracket');
  const grouped = def.clefs.length > 1 || def.tab;
  const parent = grouped ? top.appendChild(el(score.doc, 'staffGrp', { symbol: def.tab ? undefined : 'brace', 'bar.thru': 'true' })) : top;
  if (grouped) {
    parent.appendChild(el(score.doc, 'label')).textContent = def.name;
    parent.appendChild(el(score.doc, 'labelAbbr')).textContent = def.abbr;
  }
  const newNs: string[] = [];
  def.clefs.forEach((clef, i) => {
    const n = String(nextN + i);
    newNs.push(n);
    const sd = el(score.doc, 'staffDef', {
      n, lines: 5, 'clef.shape': clef.shape, 'clef.line': clef.line, 'clef.dis': clef.dis, 'clef.dis.place': clef.disPlace,
      'trans.semi': def.semi, 'trans.diat': def.diat, type: `ps:${def.id}`,
    });
    setKeySig(sd, def.percussion ? '0' : keySigString(writtenFifths(concert, def.semi)));
    if (!grouped) {
      sd.appendChild(el(score.doc, 'label')).textContent = def.name;
      sd.appendChild(el(score.doc, 'labelAbbr')).textContent = def.abbr;
    }
    sd.appendChild(el(score.doc, 'instrDef', { 'midi.instrnum': def.program, 'midi.channel': def.percussion ? 9 : undefined }));
    parent.appendChild(sd);
    if (def.tab) {
      const tn = String(nextN + def.clefs.length);
      newNs.push(tn);
      parent.appendChild(tabStaffDef(score.doc, Number(tn), sd));
    }
  });
  for (const m of score.measures()) {
    for (const n of newNs) {
      const st = m.appendChild(el(score.doc, 'staff', { n }));
      const layer = st.appendChild(el(score.doc, 'layer', { n: 1 }));
      if (m.getAttribute('metcon') === 'false') for (const p of splitTicks(score.capacity(m))) layer.appendChild(el(score.doc, 'rest', { dur: p.dur }));
      else layer.appendChild(el(score.doc, 'mRest'));
      // keep staff elements before control events
      const firstCtl = children(m).find((c) => c.localName !== 'staff');
      if (firstCtl) m.insertBefore(st, firstCtl);
    }
  }
  score.invalidate();
  return { selection: NONE };
}

export function removePart(score: Score, staffNs: string[]): CommandResult {
  if (score.staffDefs().length <= staffNs.length) throw new EditError('A score needs at least one instrument.');
  for (const n of staffNs) {
    for (const sd of score.staffDefs().filter((d) => d.getAttribute('n') === n)) {
      const p = sd.parentElement!;
      sd.remove();
      if (p.localName === 'staffGrp' && !descendants(p, 'staffDef').length) p.remove();
    }
    for (const m of score.measures()) {
      const s = score.staffEl(m, n);
      if (s) {
        s.remove();
        fixRefs(score, [s], null);
      }
      for (const c of children(m)) if (c.localName !== 'staff' && c.getAttribute('staff') === n) c.remove();
    }
  }
  score.invalidate();
  return { selection: NONE };
}

export function renamePart(score: Score, staffN: string, name: string) {
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  if (!sd) return;
  const grp = sd.parentElement!;
  const holder = !child(sd, 'label') && grp.localName === 'staffGrp' && child(grp, 'label') ? grp : sd;
  let label = child(holder, 'label');
  if (!label) label = holder.insertBefore(el(score.doc, 'label'), holder.firstChild);
  label.textContent = name;
  score.invalidate();
}

/** Moves a part (all its staves) up or down in the score order. */
export function movePart(score: Score, staffN: string, dir: -1 | 1) {
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  if (!sd) return;
  const unit = sd.parentElement!.localName === 'staffGrp' && sd.parentElement!.getAttribute('symbol') === 'brace' ? sd.parentElement! : sd;
  const parent = unit.parentElement!;
  const sibs = children(parent).filter((c) => c.localName === 'staffDef' || c.localName === 'staffGrp');
  const i = sibs.indexOf(unit);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  if (dir < 0) parent.insertBefore(unit, sibs[j]);
  else parent.insertBefore(sibs[j], unit);
  score.invalidate();
}

export function setPartProgram(score: Score, staffN: string, program: number) {
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  if (!sd) return;
  let instr = descendants(sd, 'instrDef')[0];
  if (!instr) instr = sd.appendChild(el(score.doc, 'instrDef'));
  instr.setAttribute('midi.instrnum', String(program));
  score.invalidate();
}

export { durToTicks, WHOLE };
