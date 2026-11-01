// Larger editing tools: rebarring, MIDI step entry, explode/reduce, drum notes by name, linked guitar
// tab, chord-symbol suggestions, and multi-measure rests for parts.
import {
  WHOLE, ancestor, child, children, cloneFresh, descendants, el, getId, keyAlter, largestFit, midiOf, newId, setId, stepOf, alterToAccid,
} from './mei';
import { Score } from './score';
import { EditError, enterPitchAt, addChordPitch, cursorTarget, eventOf, insertMeasures, keyAt, locate, renumber, spellInKey, type CommandResult, type InputState, type Selection, measuresOf } from './edit';

// ---------- rebarring ----------

interface Piece {
  el: Element; // a note/chord/rest/space or a whole tuplet (kept together)
  ticks: number;
  splittable: boolean;
}

function piecesOfLayer(score: Score, layer: Element): Piece[] {
  score.unbeam(layer);
  score.expandMeasureRests(layer);
  const out: Piece[] = [];
  for (const c of children(layer)) {
    const ticks = score.itemTicks(c, ancestor(layer, 'measure')!);
    out.push({ el: c, ticks, splittable: ['note', 'chord', 'rest', 'space'].includes(c.localName) && !c.getAttribute('grace') });
  }
  return out;
}

function setDur(e: Element, dur: string, dots: number) {
  e.setAttribute('dur', dur);
  if (dots) e.setAttribute('dots', String(dots));
  else e.removeAttribute('dots');
  e.removeAttribute('dur.ppq');
}

/** Breaks `ticks` into written durations (dotted where possible). */
function durationsFor(ticks: number): { dur: string; dots: number }[] {
  const out: { dur: string; dots: number }[] = [];
  let left = ticks;
  while (left > 1) {
    const f = largestFit(left);
    if (!f) break;
    out.push(f);
    let t = WHOLE / Number(f.dur);
    let add = t;
    for (let i = 0; i < f.dots; i++) {
      add /= 2;
      t += add;
    }
    left -= t;
  }
  return out;
}

/** Copies of `piece` filling `ticks`, tied together when they are notes. */
function splitPiece(p: Element, ticks: number, first: boolean): Element[] {
  const parts = durationsFor(ticks);
  return parts.map((d, i) => {
    const c = first && i === 0 ? p : cloneFresh(p);
    for (const k of Array.from(c.getElementsByTagName('*'))) if (!(first && i === 0) && ['verse', 'artic'].includes(k.localName)) k.remove();
    if (!(first && i === 0)) c.removeAttribute('artic');
    setDur(c, d.dur, d.dots);
    return c;
  });
}

function tieChain(chain: Element[]) {
  if (chain.length < 2) return;
  chain.forEach((e, i) => {
    const notes = e.localName === 'chord' ? children(e, 'note') : e.localName === 'note' ? [e] : [];
    for (const n of notes) {
      const old = n.getAttribute('tie');
      const pos = i === 0 ? (old === 't' || old === 'm' ? 'm' : 'i') : i === chain.length - 1 ? (old === 'i' || old === 'm' ? 'm' : 't') : 'm';
      n.setAttribute('tie', pos);
    }
  });
}

/**
 * Re-flows the music from `from` to the next meter change into measures of the current meter,
 * splitting notes across barlines with ties (like MuseScore). Measures are added or removed as needed.
 */
export function rebar(score: Score, from: Element) {
  score.invalidate();
  const all = score.measures();
  const startIdx = all.indexOf(from);
  let endIdx = all.length;
  for (let i = startIdx + 1; i < all.length; i++) {
    const prev = all[i].previousElementSibling;
    if (prev?.localName === 'scoreDef' && (prev.getAttribute('meter.count') || descendants(prev, 'meterSig').length)) {
      endIdx = i;
      break;
    }
  }
  const region = all.slice(startIdx, endIdx).filter((m) => m.getAttribute('metcon') !== 'false');
  if (!region.length) return;
  const cap = score.capacity(region[0]);
  const hadEnd = region[region.length - 1].getAttribute('right') === 'end';
  // gather streams per staff/layer
  const streams = new Map<string, Piece[]>();
  const staffNs = score.staffDefs().map((d) => d.getAttribute('n') || '1');
  for (const sn of staffNs) {
    const layerNs = new Set<string>();
    for (const m of region) for (const l of children(score.staffEl(m, sn) || el(score.doc, 'staff'), 'layer')) layerNs.add(l.getAttribute('n') || '1');
    for (const ln of layerNs) {
      const pieces: Piece[] = [];
      for (const m of region) {
        // the old capacity is what this measure held before the meter changed
        const layer = score.layerEl(m, sn, ln);
        const oldTicks = layer ? score.containerTicks(layer) : 0;
        if (!layer) {
          for (const d of durationsFor(oldTicks || cap)) pieces.push({ el: el(score.doc, 'space', { dur: d.dur, dots: d.dots || undefined }), ticks: WHOLE / Number(d.dur), splittable: true });
          continue;
        }
        pieces.push(...piecesOfLayer(score, layer));
      }
      streams.set(`${sn}|${ln}`, pieces);
    }
  }
  const totals = [...streams.values()].map((ps) => ps.reduce((a, p) => a + p.ticks, 0));
  const needed = Math.max(1, Math.ceil(Math.max(...totals, 1) / cap - 0.0001));
  // adjust the number of measures in the region
  while (region.length < needed) region.push(insertMeasures(score, region[region.length - 1], 1, 'after')[0]);
  while (region.length > needed) region.pop()!.remove();
  for (const m of region) {
    m.removeAttribute('right');
    for (const st of children(m, 'staff')) for (const l of children(st, 'layer')) while (l.firstChild) l.removeChild(l.firstChild);
  }
  // refill
  for (const [key, pieces] of streams) {
    const [sn, ln] = key.split('|');
    let mi = 0;
    let room = cap;
    const layerOf = (i: number) => score.layerEl(region[i], sn, ln, true)!;
    for (const l of [layerOf(0)]) while (l.firstChild) l.removeChild(l.firstChild);
    let layer = layerOf(0);
    for (const p of pieces) {
      let left = p.ticks;
      let first = true;
      const chain: Element[] = [];
      while (left > 0.001) {
        if (room <= 0.001) {
          mi++;
          if (mi >= region.length) break;
          layer = layerOf(mi);
          room = cap;
        }
        if (!p.splittable && left > room) {
          // a tuplet that does not fit: start it in the next measure
          for (const d of durationsFor(room)) layer.appendChild(el(score.doc, 'rest', { dur: d.dur, dots: d.dots || undefined }));
          room = 0;
          continue;
        }
        const take = Math.min(left, room);
        const parts = p.splittable ? splitPiece(p.el, take, first) : [p.el];
        for (const part of parts) layer.appendChild(part);
        chain.push(...parts);
        first = false;
        left -= take;
        room -= take;
      }
      if (p.el.localName === 'note' || p.el.localName === 'chord') tieChain(chain);
    }
    // fill the end of the last measure
    if (room > 0.001 && mi < region.length) for (const d of durationsFor(room)) layer.appendChild(el(score.doc, ln === '1' ? 'rest' : 'space', { dur: d.dur, dots: d.dots || undefined }));
    for (let i = mi + 1; i < region.length; i++) {
      const l = layerOf(i);
      if (!l.firstChild) l.appendChild(el(score.doc, ln === '1' ? 'mRest' : 'mSpace'));
    }
  }
  if (hadEnd || endIdx === all.length) region[region.length - 1].setAttribute('right', 'end');
  // control events follow the note they are attached to
  const allMeasures = new Set(region);
  for (const m of region) {
    for (const c of children(m)) {
      if (c.localName === 'staff') continue;
      const sid = (c.getAttribute('startid') || '').replace(/^#/, '');
      const target = sid ? score.byId(sid) : null;
      const tm = target ? ancestor(target, 'measure') : null;
      if (tm && tm !== m && allMeasures.has(tm)) tm.appendChild(c);
      else if (sid && !target) c.remove();
    }
  }
  renumber(score);
  score.invalidate();
  for (const m of region) for (const st of children(m, 'staff')) for (const l of children(st, 'layer')) score.tidyLayer(l);
  score.invalidate();
}

// ---------- MIDI step entry ----------

/** Enters the keys played on a MIDI keyboard (several keys = a chord) at the cursor. */
export function enterMidi(score: Score, cursorId: string | null, sel: Selection, midis: number[], input: InputState): CommandResult {
  if (!midis.length) return {};
  const target = cursorTarget(score, cursorId, sel, input);
  const { staffN } = locate(eventOf(target));
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  const semi = Number(sd?.getAttribute('trans.semi') || 0);
  const fifths = keyAt(score, target);
  const written = [...midis].sort((a, b) => a - b).map((m) => spellInKey(m - semi, fifths, true));
  const r = enterPitchAt(score, getId(target), written[0], input);
  const placed = (r.selection as { ids: string[] }).ids[0];
  for (const p of written.slice(1)) addChordPitch(score, placed, p);
  return { selection: { kind: 'events', ids: [placed] }, cursor: r.cursor };
}

// ---------- explode / reduce ----------

function eventsOf(layer: Element): Element[] {
  const out: Element[] = [];
  const walk = (c: Element) => {
    for (const x of children(c)) {
      if (['note', 'chord', 'rest', 'space', 'mRest', 'mSpace'].includes(x.localName)) out.push(x);
      else if (['beam', 'tuplet'].includes(x.localName)) walk(x);
    }
  };
  walk(layer);
  return out;
}

/** Splits the chords of the first selected staff into the staves below it (top note to the top staff). */
export function explode(score: Score, sel: Selection): CommandResult {
  if (sel.kind !== 'measures' || sel.staves.length < 2) throw new EditError('Select measures on the chord staff and the staves below it (shift-click), then Explode.');
  const [src, ...targets] = sel.staves;
  for (const mid of sel.measureIds) {
    const m = score.byId(mid)!;
    const srcLayer = score.layerEl(m, src, '1');
    if (!srcLayer) continue;
    targets.forEach((tn, ti) => {
      const st = score.staffEl(m, tn) || m.appendChild(el(score.doc, 'staff', { n: tn }));
      for (const l of children(st, 'layer')) l.remove();
      const copy = cloneFresh(srcLayer);
      copy.setAttribute('n', '1');
      for (const ch of descendants(copy, 'chord')) {
        const notes = children(ch, 'note').sort((a, b) => stepOf(b.getAttribute('pname')!, Number(b.getAttribute('oct'))) - stepOf(a.getAttribute('pname')!, Number(a.getAttribute('oct'))));
        const keep = notes[Math.min(ti + 1, notes.length - 1)];
        const n = keep.cloneNode(true) as Element;
        setId(n, newId('n'));
        n.setAttribute('dur', ch.getAttribute('dur') || '4');
        if (ch.getAttribute('dots')) n.setAttribute('dots', ch.getAttribute('dots')!);
        ch.parentElement!.replaceChild(n, ch);
      }
      st.appendChild(copy);
    });
    // the source staff keeps the top note
    for (const ch of descendants(srcLayer, 'chord')) {
      const notes = children(ch, 'note').sort((a, b) => stepOf(b.getAttribute('pname')!, Number(b.getAttribute('oct'))) - stepOf(a.getAttribute('pname')!, Number(a.getAttribute('oct'))));
      for (const n of notes.slice(1)) n.remove();
    }
  }
  score.invalidate();
  for (const mid of sel.measureIds) for (const sn of sel.staves) {
    const l = score.layerEl(score.byId(mid)!, sn, '1');
    if (l) score.tidyLayer(l);
  }
  return { selection: sel, message: `Exploded into ${targets.length} staves.` };
}

/** Combines the selected staves into the first one: chords where rhythms match, otherwise as voices. */
export function reduce(score: Score, sel: Selection): CommandResult {
  if (sel.kind !== 'measures' || sel.staves.length < 2) throw new EditError('Select measures across two or more staves (shift-click), then Reduce.');
  const [dst, ...srcs] = sel.staves;
  for (const mid of sel.measureIds) {
    const m = score.byId(mid)!;
    const dl = score.layerEl(m, dst, '1');
    if (!dl) continue;
    const dEvents = eventsOf(dl);
    const rhythm = (evs: Element[]) => evs.map((e) => `${e.localName === 'rest' || e.localName === 'mRest' ? 'r' : 'n'}${e.getAttribute('dur')}${e.getAttribute('dots') || ''}`).join(',');
    let voice = 2;
    for (const sn of srcs) {
      const sl = score.layerEl(m, sn, '1');
      if (!sl) continue;
      const sEvents = eventsOf(sl);
      if (rhythm(sEvents) === rhythm(dEvents)) {
        sEvents.forEach((se, i) => {
          const de = dEvents[i];
          const srcNotes = se.localName === 'chord' ? children(se, 'note') : se.localName === 'note' ? [se] : [];
          if (!srcNotes.length || (de.localName !== 'note' && de.localName !== 'chord')) return;
          let chord = de;
          if (de.localName === 'note') {
            chord = el(score.doc, 'chord', { dur: de.getAttribute('dur') || '4', dots: de.getAttribute('dots') || undefined });
            de.parentElement!.insertBefore(chord, de);
            chord.appendChild(de);
            de.removeAttribute('dur');
            de.removeAttribute('dots');
          }
          for (const n of srcNotes) {
            const c = cloneFresh(n);
            c.removeAttribute('dur');
            c.removeAttribute('dots');
            for (const v of children(c, 'verse')) v.remove();
            if (!children(chord, 'note').some((x) => x.getAttribute('pname') === c.getAttribute('pname') && x.getAttribute('oct') === c.getAttribute('oct'))) chord.appendChild(c);
          }
          dEvents[i] = chord;
        });
      } else if (voice <= 4) {
        const copy = cloneFresh(sl);
        copy.setAttribute('n', String(voice++));
        const st = score.staffEl(m, dst)!;
        for (const l of children(st, 'layer')) if (l.getAttribute('n') === copy.getAttribute('n')) l.remove();
        st.appendChild(copy);
      }
    }
  }
  score.invalidate();
  for (const mid of sel.measureIds) {
    const st = score.staffEl(score.byId(mid)!, dst);
    if (st) for (const l of children(st, 'layer')) score.tidyLayer(l);
  }
  return { selection: { kind: 'measures', measureIds: sel.measureIds, staves: [dst] }, message: 'Reduced into one staff.' };
}

// ---------- drum set ----------

export const DRUMS: { id: string; name: string; pname: string; oct: number; head?: string; artic?: string }[] = [
  { id: 'kick', name: 'Bass drum', pname: 'f', oct: 4 },
  { id: 'snare', name: 'Snare', pname: 'c', oct: 5 },
  { id: 'xstick', name: 'Cross-stick', pname: 'c', oct: 5, head: 'x' },
  { id: 'hh', name: 'Hi-hat', pname: 'g', oct: 5, head: 'x' },
  { id: 'hho', name: 'Open hi-hat', pname: 'g', oct: 5, head: 'x', artic: 'open' },
  { id: 'hhp', name: 'Pedal hi-hat', pname: 'd', oct: 4, head: 'x' },
  { id: 'ride', name: 'Ride', pname: 'f', oct: 5, head: 'x' },
  { id: 'crash', name: 'Crash', pname: 'a', oct: 5, head: 'x' },
  { id: 'tom1', name: 'High tom', pname: 'e', oct: 5 },
  { id: 'tom2', name: 'Mid tom', pname: 'd', oct: 5 },
  { id: 'tom3', name: 'Floor tom', pname: 'a', oct: 4 },
];

/** Writes a drum by name: at the cursor in note input, or stacked onto the selected note. */
export function drumNote(score: Score, cursorId: string | null, sel: Selection, id: string, input: InputState, mode: 'input' | 'normal'): CommandResult {
  const d = DRUMS.find((x) => x.id === id);
  if (!d) return {};
  const decorate = (n: Element) => {
    if (d.head) n.setAttribute('head.shape', d.head);
    else n.removeAttribute('head.shape');
    if (d.artic) n.setAttribute('artic', d.artic);
    n.removeAttribute('accid');
    n.setAttribute('accid.ges', 'n');
  };
  if (mode === 'normal' && sel.kind === 'events') {
    const r = addChordPitch(score, sel.ids[0], { pname: d.pname, oct: d.oct });
    const n = score.byId((r.selection as { ids: string[] }).ids[0]);
    if (n) decorate(n);
    return r;
  }
  const target = cursorTarget(score, cursorId, sel, input);
  const r = enterPitchAt(score, getId(target), { pname: d.pname, oct: d.oct, alter: 0 }, input);
  const n = score.byId((r.selection as { ids: string[] }).ids[0]);
  if (n) decorate(n);
  return r;
}

// ---------- linked guitar tab ----------

const STANDARD_TUNING = [64, 59, 55, 50, 45, 40]; // e4 b3 g3 d3 a2 e2 (string 1 = high e)

/** Fills every tab staff from the notation staff it is linked to (staffDef @corresp="#<staffDef id>"). */
export function syncTabs(score: Score) {
  const defs = score.staffDefs();
  const tabs = defs.filter((d) => (d.getAttribute('notationtype') || '').startsWith('tab'));
  if (!tabs.length) return;
  for (const tab of tabs) {
    const srcId = (tab.getAttribute('corresp') || '').replace(/^#/, '');
    const src = defs.find((d) => getId(d) === srcId);
    if (!src) continue;
    const srcN = src.getAttribute('n')!;
    const tabN = tab.getAttribute('n')!;
    for (const m of score.measures()) {
      const s = score.staffEl(m, srcN);
      if (!s) continue;
      const old = score.staffEl(m, tabN);
      const copy = s.cloneNode(true) as Element;
      copy.setAttribute('n', tabN);
      setId(copy, getId(s) + '-tab');
      const walk = (x: Element) => {
        const id = getId(x);
        if (id) setId(x, id + '-tab');
        for (const c of children(x)) walk(c);
      };
      for (const c of children(copy)) walk(c);
      for (const v of descendants(copy, 'verse')) v.remove();
      for (const c of descendants(copy, 'clef')) c.remove();
      // frets: lowest position, one note per string, high strings for high notes
      const fifths = 0;
      for (const ch of [...descendants(copy, 'chord'), ...descendants(copy, 'note').filter((n) => !ancestor(n, 'chord'))]) {
        const notes = ch.localName === 'chord' ? children(ch, 'note') : [ch];
        const used = new Set<number>();
        const sorted = [...notes].sort((a, b) => pitchOf(b, fifths) - pitchOf(a, fifths));
        for (const n of sorted) {
          const p = pitchOf(n, fifths);
          let best = -1;
          let bestFret = 99;
          STANDARD_TUNING.forEach((open, i) => {
            const fret = p - open;
            if (fret >= 0 && fret <= 19 && !used.has(i) && fret < bestFret) {
              best = i;
              bestFret = fret;
            }
          });
          if (best < 0) {
            n.remove();
            continue;
          }
          used.add(best);
          n.setAttribute('tab.course', String(best + 1));
          n.setAttribute('tab.fret', String(bestFret));
        }
      }
      if (old) m.replaceChild(copy, old);
      else m.insertBefore(copy, s.nextSibling);
    }
  }
  score.invalidate();
}

function pitchOf(n: Element, fifths: number) {
  const pname = n.getAttribute('pname') || 'c';
  return midiOf(pname, Number(n.getAttribute('oct') || 4), Score.alterOf(n, keyAlter(fifths, pname)));
}

/** Strips the "-tab" suffix so clicks on tab numbers select the linked note. */
export function untabId(id: string) {
  return id.endsWith('-tab') ? id.slice(0, -4) : id;
}

// ---------- chord-symbol suggestions ----------

const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11];
const ROMAN = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const LETTERS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const FLAT_LETTERS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'C♭'];

/**
 * Suggests a diatonic chord symbol for each measure (or half measure in 4/4) from the melody on the
 * top staff: chord tones on strong beats and long notes count most; the piece starts and ends on I.
 */
export function suggestChords(score: Score, staffN?: string): CommandResult {
  const top = staffN || score.staffDefs()[0]?.getAttribute('n') || '1';
  const ms = score.measures();
  const fifths = score.contextOf(ms[0]).keys[top] ?? 0;
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === top);
  const semi = Number(sd?.getAttribute('trans.semi') || 0);
  const tonic = (((fifths * 7) % 12) + 12 + 120 + semi) % 12; // concert pitch of the key's tonic
  const names = fifths < 0 ? FLAT_LETTERS : LETTERS;
  let added = 0;
  ms.forEach((m, mi) => {
    const layer = score.layerEl(m, top, '1');
    if (!layer) return;
    const ctx = score.contextOf(m);
    const cap = score.capacity(m);
    const halves = ctx.count === 4 && ctx.unit === 4 ? 2 : 1;
    const evs: { t: number; d: number; pc: number; el: Element }[] = [];
    let t = 0;
    for (const e of eventsOf(layer)) {
      const d = score.itemTicks(e, m);
      const notes = e.localName === 'chord' ? children(e, 'note') : e.localName === 'note' ? [e] : [];
      for (const n of notes) evs.push({ t, d, pc: (pitchOf(n, ctx.keys[top] ?? 0) + semi + 120) % 12, el: e });
      t += d;
    }
    for (let h = 0; h < halves; h++) {
      const from = (cap / halves) * h;
      const to = (cap / halves) * (h + 1);
      const part = evs.filter((e) => e.t >= from - 0.5 && e.t < to - 0.5);
      if (!part.length) continue;
      if (descendants(m, 'harm').some((x) => part.some((p) => x.getAttribute('startid') === '#' + getId(p.el)))) continue;
      let best = 0;
      let bestScore = -Infinity;
      MAJOR_DEGREES.forEach((deg, i) => {
        const root = (tonic + deg) % 12;
        const triad = [root, (root + MAJOR_DEGREES[(i + 2) % 7] - deg + 12) % 12, (root + MAJOR_DEGREES[(i + 4) % 7] - deg + 12) % 12];
        let sc = 0;
        for (const e of part) {
          const strong = e.t === from || (e.t - from) % (WHOLE / ctx.unit) === 0;
          if (triad.includes(e.pc)) sc += (e.d / 960) * (strong ? 2 : 1) + (e.pc === root ? 0.3 : 0);
          else sc -= (e.d / 960) * (strong ? 1.2 : 0.4);
        }
        if (i === 0) sc += 0.4;
        if (i === 4 || i === 3) sc += 0.2;
        if (i === 6) sc -= 0.8;
        if ((mi === 0 && h === 0) || (mi === ms.length - 1 && h === halves - 1)) sc += i === 0 ? 3 : 0;
        if (sc > bestScore) {
          bestScore = sc;
          best = i;
        }
      });
      const root = (tonic + MAJOR_DEGREES[best]) % 12;
      const quality = [1, 2, 5].includes(best) ? 'm' : best === 6 ? 'dim' : '';
      const harm = el(score.doc, 'harm', { startid: '#' + getId(part[0].el), place: 'above', type: 'suggested' });
      harm.textContent = names[root] + quality;
      m.appendChild(harm);
      added++;
      void ROMAN;
    }
  });
  score.invalidate();
  return { message: added ? `Suggested ${added} chord symbols. Edit or delete any you don't like.` : 'No empty spots for chord symbols were found.' };
}

// ---------- parts: multi-measure rests ----------

/** In a single-part copy, joins runs of empty measures into one measure with a multi-measure rest. */
export function condenseRests(score: Score) {
  const ms = score.measures();
  const empty = (m: Element) =>
    children(m, 'staff').every((st) => children(st, 'layer').every((l) => children(l).every((c) => ['mRest', 'mSpace'].includes(c.localName)))) &&
    !children(m).some((c) => !['staff'].includes(c.localName) && c.localName !== 'sb' && c.localName !== 'pb') &&
    !m.getAttribute('left') && !(m.getAttribute('right') || '').startsWith('rpt') && !ancestor(m, 'ending');
  let i = 0;
  while (i < ms.length) {
    if (!empty(ms[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < ms.length && empty(ms[j + 1]) && ms[j + 1].parentElement === ms[i].parentElement && ms[j + 1].previousElementSibling === ms[j]) j++;
    const run = j - i + 1;
    if (run >= 2) {
      for (const st of children(ms[i], 'staff')) {
        for (const l of children(st, 'layer')) {
          while (l.firstChild) l.removeChild(l.firstChild);
          l.appendChild(el(score.doc, 'multiRest', { num: run }));
        }
      }
      if (ms[j].getAttribute('right')) ms[i].setAttribute('right', ms[j].getAttribute('right')!);
      for (let k = i + 1; k <= j; k++) ms[k].remove();
    }
    i = j + 1;
  }
  score.invalidate();
}

/** Adds system breaks every `perLine` measures (for a render copy). */
export function breakEvery(score: Score, perLine: number) {
  if (perLine <= 0) return;
  for (const b of descendants(score.doc, 'sb')) b.remove();
  score.measures().forEach((m, i) => {
    if ((i + 1) % perLine === 0) m.parentElement!.insertBefore(el(score.doc, 'sb'), m.nextSibling);
  });
}

export { measuresOf, child, alterToAccid };
