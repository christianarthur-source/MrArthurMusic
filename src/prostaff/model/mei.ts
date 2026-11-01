// Low-level helpers for working with an MEI document (the score's source of truth).
// Durations are measured in ticks: a quarter note is 960 ticks, a whole note 3840.

export const MEI_NS = 'http://www.music-encoding.org/ns/mei';
export const XML_NS = 'http://www.w3.org/XML/1998/namespace';

export const WHOLE = 3840;
export const QUARTER = 960;

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newId(prefix = 'p'): string {
  let s = prefix;
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) s += ID_CHARS[b % ID_CHARS.length];
  return s;
}

export function getId(el: Element | null | undefined): string {
  return el ? el.getAttributeNS(XML_NS, 'id') || el.getAttribute('xml:id') || '' : '';
}

export function setId(el: Element, id: string) {
  el.setAttributeNS(XML_NS, 'xml:id', id);
}

export function el(doc: Document, name: string, attrs: Record<string, string | number | undefined> = {}, id = true): Element {
  const e = doc.createElementNS(MEI_NS, name);
  if (id) setId(e, newId(name.slice(0, 1)));
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== '') e.setAttribute(k, String(v));
  return e;
}

export function children(parent: Element, name?: string): Element[] {
  const out: Element[] = [];
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) out.push(c);
  return out;
}

export function child(parent: Element, name: string): Element | null {
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c;
  return null;
}

export function descendants(root: Element | Document, name: string): Element[] {
  return Array.from(root.getElementsByTagNameNS(MEI_NS, name));
}

export function ancestor(e: Element | null, name: string): Element | null {
  for (let p = e?.parentElement ?? null; p; p = p.parentElement) if (p.localName === name) return p;
  return null;
}

/** Gives every element that lacks one an xml:id, so it can be selected and edited. */
export function ensureIds(root: Element) {
  const walk = (e: Element) => {
    if (!getId(e)) setId(e, newId(e.localName.slice(0, 1)));
    for (let c = e.firstElementChild; c; c = c.nextElementSibling) walk(c);
  };
  walk(root);
}

/** Deep-clones an element and gives the clone (and its descendants) fresh ids. */
export function cloneFresh(e: Element): Element {
  const c = e.cloneNode(true) as Element;
  const walk = (x: Element) => {
    setId(x, newId(x.localName.slice(0, 1)));
    for (let k = x.firstElementChild; k; k = k.nextElementSibling) walk(k);
  };
  walk(c);
  return c;
}

// ---------- durations ----------

export const DURS = [1, 2, 4, 8, 16, 32, 64, 128];
export const BREVE = 'breve';

export function durToTicks(dur: string | null, dots = 0): number {
  if (!dur) return 0;
  let base = dur === 'breve' ? WHOLE * 2 : dur === 'long' ? WHOLE * 4 : WHOLE / Number(dur);
  if (!isFinite(base)) return 0;
  let t = base;
  for (let i = 0; i < dots; i++) {
    base /= 2;
    t += base;
  }
  return t;
}

/** Duration of a leaf event (note/chord/rest/space) in ticks, ignoring tuplets. */
export function eventTicks(e: Element): number {
  if (e.getAttribute('grace')) return 0;
  const ppq = e.getAttribute('dur.ppq');
  const dots = Number(e.getAttribute('dots') || 0);
  let dur = e.getAttribute('dur');
  if (!dur && e.localName === 'note') {
    const chord = ancestor(e, 'chord');
    if (chord) return eventTicks(chord);
  }
  if (!dur && e.localName === 'chord') {
    const n = children(e, 'note')[0];
    dur = n?.getAttribute('dur') || null;
  }
  if (!dur && ppq) return 0;
  return durToTicks(dur, dots);
}

/** Largest single (optionally dotted) duration that fits in `ticks`. */
export function largestFit(ticks: number, allowDots = true): { dur: string; dots: number } | null {
  for (const d of DURS) {
    const base = WHOLE / d;
    if (allowDots && base * 1.5 <= ticks && d > 1) {
      if (base * 1.75 <= ticks && d >= 4) return { dur: String(d), dots: 2 };
      return { dur: String(d), dots: 1 };
    }
    if (base <= ticks) return { dur: String(d), dots: 0 };
  }
  return null;
}

/** Splits a span into plain (undotted) durations, longest first. */
export function splitTicks(ticks: number): { dur: string; dots: number }[] {
  const out: { dur: string; dots: number }[] = [];
  let left = ticks;
  for (const d of DURS) {
    const base = WHOLE / d;
    while (left >= base) {
      out.push({ dur: String(d), dots: 0 });
      left -= base;
    }
  }
  return out;
}

// ---------- pitch ----------

export const PNAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const PC = [0, 2, 4, 5, 7, 9, 11];
const SHARP_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b'];
const FLAT_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f'];

export const ACCID_TO_ALTER: Record<string, number> = { s: 1, f: -1, ss: 2, x: 2, ff: -2, n: 0, 'ns': 1, 'nf': -1, su: 1, fd: -1 };
export function alterToAccid(a: number): string {
  return a === 1 ? 's' : a === -1 ? 'f' : a === 2 ? 'x' : a === -2 ? 'ff' : 'n';
}

/** "2s" / "3f" / "0" / "mixed" → circle-of-fifths number (sharps positive). */
export function parseKeySig(sig: string | null | undefined): number {
  if (!sig) return 0;
  const m = /^(\d+)([sf])$/.exec(sig.trim());
  if (!m) return 0;
  return m[2] === 's' ? Number(m[1]) : -Number(m[1]);
}
export function keySigString(fifths: number): string {
  return fifths === 0 ? '0' : fifths > 0 ? `${fifths}s` : `${-fifths}f`;
}
export function keyAlter(fifths: number, pname: string): number {
  if (fifths > 0) return SHARP_ORDER.slice(0, fifths).includes(pname) ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.slice(0, -fifths).includes(pname) ? -1 : 0;
  return 0;
}

export function midiOf(pname: string, oct: number, alter: number): number {
  return (oct + 1) * 12 + PC[PNAMES.indexOf(pname)] + alter;
}

/** Diatonic step number (c4 = 28). */
export function stepOf(pname: string, oct: number) {
  return oct * 7 + PNAMES.indexOf(pname);
}
export function fromStep(step: number) {
  return { pname: PNAMES[((step % 7) + 7) % 7], oct: Math.floor(step / 7) };
}

/** Spells a MIDI number, preferring sharps or flats. */
export function spellMidi(midi: number, preferFlats: boolean): { pname: string; oct: number; alter: number } {
  const pc = ((midi % 12) + 12) % 12;
  const sharpNames: [string, number][] = [['c', 0], ['c', 1], ['d', 0], ['d', 1], ['e', 0], ['f', 0], ['f', 1], ['g', 0], ['g', 1], ['a', 0], ['a', 1], ['b', 0]];
  const flatNames: [string, number][] = [['c', 0], ['d', -1], ['d', 0], ['e', -1], ['e', 0], ['f', 0], ['g', -1], ['g', 0], ['a', -1], ['a', 0], ['b', -1], ['b', 0]];
  const [pname, alter] = (preferFlats ? flatNames : sharpNames)[pc];
  const oct = Math.floor((midi - alter) / 12) - 1;
  return { pname, oct, alter };
}

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error('The file is not valid XML: ' + (err.textContent || '').slice(0, 160));
  return doc;
}

export function serialize(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}
