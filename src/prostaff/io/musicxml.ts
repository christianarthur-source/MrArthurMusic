// MEI → MusicXML 4.0 (score-partwise) export. Works on the MEI document directly and never mutates it.
// Times are tracked in quarter notes (floats) and converted to <divisions> at output; the divisions value
// is chosen so every note duration (dots and tuplets included) is a whole number.

import { ACCID_TO_ALTER, ancestor, child, children, descendants, getId, keyAlter, parseKeySig } from '../model/mei';

// ---------- small helpers ----------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function attrs(a: Record<string, string | number | undefined | null | false>): string {
  let s = '';
  for (const [k, v] of Object.entries(a)) if (v !== undefined && v !== null && v !== false && v !== '') s += ` ${k}="${esc(String(v))}"`;
  return s;
}

function tag(name: string, content: string | number | null | undefined, a: Record<string, string | number | undefined | null | false> = {}): string {
  if (content === null || content === undefined || content === '') return `<${name}${attrs(a)}/>`;
  return `<${name}${attrs(a)}>${typeof content === 'number' ? content : content}</${name}>`;
}

function textTag(name: string, text: string, a: Record<string, string | number | undefined | null | false> = {}): string {
  return `<${name}${attrs(a)}>${esc(text)}</${name}>`;
}

/** Visible text of an element, whitespace collapsed; `skip` drops matching descendants (e.g. SMuFL glyph rends). */
function textOf(e: Element | null | undefined, skip?: (x: Element) => boolean): string {
  if (!e) return '';
  let s = '';
  const walk = (n: Node) => {
    for (let c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 || c.nodeType === 4) s += c.nodeValue || '';
      else if (c.nodeType === 1) {
        const x = c as Element;
        if (skip && skip(x)) continue;
        if (x.localName === 'lb') s += ' ';
        else walk(x);
      }
    }
  };
  walk(e);
  return s.replace(/\s+/g, ' ').trim();
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return Math.abs(a);
}
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

function refId(v: string | null): string {
  return (v || '').trim().split(/\s+/)[0].replace(/^#/, '');
}

const EPS = 1e-6;
const WHOLE_MEASURE = new Set(['mRest', 'mSpace', 'multiRest', 'mRpt', 'mRpt2']);

const TYPE_NAMES: Record<string, string> = {
  long: 'long', breve: 'breve', '1': 'whole', '2': 'half', '4': 'quarter', '8': 'eighth', '16': '16th', '32': '32nd',
  '64': '64th', '128': '128th', '256': '256th', '512': '512th', '1024': '1024th',
};

const ALTER: Record<string, number> = { ...ACCID_TO_ALTER, ts: 3, tf: -3, xs: 3, sx: 3, sd: 1, su: 1, fu: -1, fd: -1, nu: 0, nd: 0 };

const ACCIDENTAL_NAMES: Record<string, string> = {
  s: 'sharp', f: 'flat', n: 'natural', ss: 'sharp-sharp', x: 'double-sharp', ff: 'flat-flat', ns: 'natural-sharp',
  nf: 'natural-flat', ts: 'triple-sharp', tf: 'triple-flat', xs: 'triple-sharp', sx: 'triple-sharp', su: 'sharp-up',
  sd: 'sharp-down', fu: 'flat-up', fd: 'flat-down', nu: 'natural-up', nd: 'natural-down',
};

const ARTICULATIONS: Record<string, string> = {
  acc: 'accent', stacc: 'staccato', ten: 'tenuto', stacciss: 'staccatissimo', stacis: 'staccatissimo', marc: 'strong-accent',
  spicc: 'spiccato', 'ten-stacc': 'detached-legato', dot: 'staccato', stroke: 'stress', unstress: 'unstress',
  'acc-soft': 'soft-accent', doit: 'doit', fall: 'falloff', plop: 'plop', scoop: 'scoop', 'acc-inv': 'accent',
  'marc-stacc': 'strong-accent', 'acc-stacc': 'accent',
};
const ARTIC_EXTRA: Record<string, string> = { 'marc-stacc': 'staccato', 'acc-stacc': 'staccato' };

const TECHNICAL: Record<string, string> = {
  upbow: 'up-bow', dnbow: 'down-bow', harm: 'harmonic', snap: 'snap-pizzicato', stop: 'stopped', lhpizz: 'stopped',
  open: 'open', dbltongue: 'double-tongue', trpltongue: 'triple-tongue', heel: 'heel', toe: 'toe', fingernail: 'fingernails',
  tap: 'tap',
};

const DYNAMICS = new Set([
  'p', 'pp', 'ppp', 'pppp', 'ppppp', 'pppppp', 'f', 'ff', 'fff', 'ffff', 'fffff', 'ffffff', 'mp', 'mf', 'sf', 'sfp', 'sfpp',
  'fp', 'rf', 'rfz', 'sfz', 'sffz', 'fz', 'n', 'pf', 'sfzp',
]);

const HEADS: Record<string, string> = {
  x: 'x', diamond: 'diamond', slash: 'slash', square: 'square', isotriangle: 'triangle', '+': 'cross', circle: 'circle-x',
  rectangle: 'rectangle', backslash: 'back slashed', oval: 'normal',
};

// ---------- model built in the first pass ----------

interface Part {
  id: string;
  staves: string[];
  name: string;
  abbr: string;
  program: number | null;
  channel: number | null;
}

interface PartGroup {
  first: number;
  last: number;
  symbol: string;
  name: string;
  abbr: string;
  barThru: boolean;
}

interface KeyState {
  fifths: number;
  mode: string;
}
interface ClefState {
  shape: string;
  line: string;
  dis: number;
  place: string;
}
interface StaffState {
  key: KeyState;
  clef: ClefState;
  semi: number;
  diat: number | null;
  lines: number;
}
interface MeterState {
  count: string;
  unit: number;
  sym: string;
  visible: boolean;
  present: boolean;
}

type EvKind = 'note' | 'chord' | 'rest' | 'mrest' | 'space' | 'clef' | 'key' | 'meter';

interface Ev {
  el: Element;
  kind: EvKind;
  start: number;
  dur: number;
  durText: string;
  dots: number;
  actual: number; // tuplet ratio, cumulative
  normal: number;
  grace: string;
  cue: boolean;
  tuplets: { type: 'start' | 'stop'; number: number; el: Element }[];
  beams: string[]; // beam values for levels 1..n
  trem: { type: 'single' | 'start' | 'stop'; marks: number } | null;
  staffN: string;
  layerN: string;
  mIdx: number;
  clef?: ClefState;
  key?: KeyState;
  meter?: MeterState;
}

interface Stream {
  staffN: string;
  layerN: string;
  events: Ev[];
}

interface Measure {
  el: Element;
  idx: number;
  number: string;
  cap: number;
  meter: MeterState;
  streams: Stream[];
  brk: '' | 'system' | 'page';
  timeChange: boolean;
  keyChanges: Set<string>;
  clefChanges: Set<string>;
  transChanges: Set<string>;
  keys: Record<string, KeyState>;
  clefs: Record<string, ClefState>;
  trans: Record<string, { semi: number; diat: number | null }>;
  endingStart: { number: string; text: string } | null;
  endingStop: { number: string; type: 'stop' | 'discontinue' } | null;
  leftRepeat: boolean;
}

interface Directive {
  kind: 'direction' | 'harmony' | 'attributes';
  staffN: string;
  placement: string;
  types: string[]; // direction-type contents, or the harmony/attributes inner XML
  sound: string;
}

interface Located {
  ev: Ev;
  note: Element | null;
}

interface Notations {
  tiedStop: string[];
  tiedStart: string[];
  slurStop: string[];
  slurStart: string[];
  other: string[];
  ornaments: string[];
  technical: string[];
  articulations: string[];
  fermatas: string[];
  arpeggiate: string[];
}

// ---------- entry point ----------

export function meiToMusicXml(meiDoc: Document): string {
  return new Exporter(meiDoc).run();
}

class Exporter {
  doc: Document;
  scoreEl: Element | null;
  mainDef: Element | null;
  parts: Part[] = [];
  groups: PartGroup[] = [];
  staffPart = new Map<string, { part: number; idx: number }>();
  staffOrder: string[] = [];
  state = new Map<string, StaffState>();
  meter: MeterState = { count: '4', unit: 4, sym: '', visible: true, present: false };
  measures: Measure[] = [];
  byId = new Map<string, Located>();
  alters = new Map<Element, number>();
  octShift = new Map<Element, number>();
  notations = new Map<Element, Notations>();
  lyricsOn = new Map<Element, Element[]>();
  before = new Map<Element, Directive[]>();
  after = new Map<Element, Directive[]>();
  at = new Map<number, { staffN: string; layerN: string; pos: number; d: Directive }[]>();
  denominators = new Set<number>();
  divisions = 960;
  tieCarry = new Map<string, Map<string, number>>();
  initialTempo: number | null = null;

  constructor(doc: Document) {
    this.doc = doc;
    this.scoreEl = descendants(doc, 'score')[0] || null;
    this.mainDef = this.scoreEl ? child(this.scoreEl, 'scoreDef') || descendants(this.scoreEl, 'scoreDef')[0] || null : null;
  }

  run(): string {
    this.buildParts();
    this.initState();
    if (this.scoreEl) this.collectMeasures();
    this.computeAlters();
    this.processControls();
    this.chooseDivisions();
    return this.write();
  }

  // ---------- parts ----------

  private ownLabel(sd: Element) {
    return textOf(child(sd, 'label')) || sd.getAttribute('label') || '';
  }

  private groupSymbol(g: Element) {
    return g.getAttribute('symbol') || child(g, 'grpSym')?.getAttribute('symbol') || '';
  }

  private isPartGroup(g: Element) {
    const defs = children(g, 'staffDef');
    if (defs.length < 2 || children(g, 'staffGrp').length) return false;
    if (defs.some((d) => this.ownLabel(d))) return false;
    return this.groupSymbol(g) === 'brace' || !!textOf(child(g, 'label'));
  }

  private program(e: Element | null): { program: number | null; channel: number | null } {
    const instr = e ? child(e, 'instrDef') || descendants(e, 'instrDef')[0] : null;
    const p = instr?.getAttribute('midi.instrnum');
    const c = instr?.getAttribute('midi.channel');
    return { program: p != null && p !== '' && isFinite(Number(p)) ? Number(p) : null, channel: c != null && c !== '' ? Number(c) : null };
  }

  private buildParts() {
    const root = this.mainDef ? child(this.mainDef, 'staffGrp') : null;
    const addPart = (staves: Element[], labelHost: Element, instrHost: Element) => {
      const ids = staves.map((s, i) => s.getAttribute('n') || String(this.staffOrder.length + i + 1));
      const pi = this.parts.length;
      const { program, channel } = this.program(instrHost);
      const fromDef = staves.length === 1 ? null : staves.map((s) => this.program(s)).find((p) => p.program !== null);
      this.parts.push({
        id: `P${pi + 1}`,
        staves: ids,
        name: textOf(child(labelHost, 'label')) || labelHost.getAttribute('label') || '',
        abbr: textOf(child(labelHost, 'labelAbbr')) || labelHost.getAttribute('label.abbr') || '',
        program: program ?? fromDef?.program ?? null,
        channel: channel ?? fromDef?.channel ?? null,
      });
      ids.forEach((n, i) => {
        this.staffPart.set(n, { part: pi, idx: i + 1 });
        this.staffOrder.push(n);
      });
    };
    const walk = (g: Element) => {
      const firstPart = this.parts.length;
      for (const c of children(g)) {
        if (c.localName === 'staffDef') addPart([c], c, c);
        else if (c.localName === 'staffGrp') {
          if (this.isPartGroup(c)) addPart(children(c, 'staffDef'), c, c);
          else walk(c);
        }
      }
      const lastPart = this.parts.length - 1;
      const symbol = this.groupSymbol(g);
      if (lastPart > firstPart && (symbol || textOf(child(g, 'label')))) {
        this.groups.push({
          first: firstPart,
          last: lastPart,
          symbol,
          name: textOf(child(g, 'label')),
          abbr: textOf(child(g, 'labelAbbr')),
          barThru: g.getAttribute('bar.thru') === 'true',
        });
      }
    };
    if (root) walk(root);
    else if (this.mainDef) for (const sd of descendants(this.mainDef, 'staffDef')) addPart([sd], sd, sd);
    if (!this.parts.length) {
      // no score definition: make one part per staff number found in the music
      const ns = new Set<string>();
      if (this.scoreEl) for (const s of descendants(this.scoreEl, 'staff')) ns.add(s.getAttribute('n') || '1');
      if (!ns.size) ns.add('1');
      for (const n of ns) {
        this.staffPart.set(n, { part: this.parts.length, idx: 1 });
        this.staffOrder.push(n);
        this.parts.push({ id: `P${this.parts.length + 1}`, staves: [n], name: '', abbr: '', program: null, channel: null });
      }
    }
  }

  // ---------- definitions (meter, key, clef, transposition) ----------

  private initState() {
    for (const n of this.staffOrder) {
      this.state.set(n, { key: { fifths: 0, mode: '' }, clef: { shape: 'G', line: '2', dis: 0, place: '' }, semi: 0, diat: null, lines: 5 });
    }
    if (this.mainDef) {
      this.applyScoreDef(this.mainDef);
      const bpm = this.mainDef.getAttribute('midi.bpm');
      if (bpm && isFinite(Number(bpm))) this.initialTempo = Number(bpm);
    }
  }

  private readMeter(def: Element) {
    const ms = child(def, 'meterSig');
    const count = def.getAttribute('meter.count') || ms?.getAttribute('count') || '';
    const unit = def.getAttribute('meter.unit') || ms?.getAttribute('unit') || '';
    const sym = def.getAttribute('meter.sym') || ms?.getAttribute('sym') || '';
    if (!count && !sym) return;
    this.meter = {
      count: count || (sym === 'cut' ? '2' : '4'),
      unit: Number(unit) || (sym === 'cut' ? 2 : 4),
      sym,
      visible: def.getAttribute('meter.form') !== 'invis' && ms?.getAttribute('form') !== 'invis' && ms?.getAttribute('visible') !== 'false',
      present: true,
    };
  }

  private readKey(def: Element): KeyState | null {
    const ks = child(def, 'keySig');
    // MEI 5 spells the attribute "keysig" (Verovio's ABC import writes it); older files use "key.sig"
    const sig = def.getAttribute('key.sig') ?? def.getAttribute('keysig') ?? ks?.getAttribute('sig') ?? null;
    if (sig === null) return null;
    return { fifths: parseKeySig(sig), mode: def.getAttribute('key.mode') || def.getAttribute('keymode') || ks?.getAttribute('mode') || '' };
  }

  private readClef(def: Element, prefix = 'clef.'): ClefState | null {
    const shape = def.getAttribute(prefix + 'shape');
    if (shape) {
      return {
        shape,
        line: def.getAttribute(prefix + 'line') || '',
        dis: Number(def.getAttribute(prefix + 'dis') || 0),
        place: def.getAttribute(prefix + 'dis.place') || '',
      };
    }
    const c = prefix ? child(def, 'clef') : null;
    return c ? this.readClef(c, '') : null;
  }

  private applyScoreDef(def: Element) {
    this.readMeter(def);
    const key = this.readKey(def);
    if (key) for (const st of this.state.values()) st.key = { ...key };
    for (const sd of descendants(def, 'staffDef')) this.applyStaffDef(sd);
  }

  private applyStaffDef(sd: Element) {
    const n = sd.getAttribute('n') || '';
    const st = this.state.get(n);
    this.readMeter(sd);
    if (!st) return;
    const key = this.readKey(sd);
    if (key) st.key = key;
    const clef = this.readClef(sd);
    if (clef) st.clef = clef;
    if (sd.hasAttribute('trans.semi')) {
      st.semi = Number(sd.getAttribute('trans.semi')) || 0;
      st.diat = sd.hasAttribute('trans.diat') ? Number(sd.getAttribute('trans.diat')) || 0 : null;
    }
    if (sd.hasAttribute('lines')) st.lines = Number(sd.getAttribute('lines')) || 5;
  }

  // ---------- measures and their events ----------

  private collectMeasures() {
    const found: { el: Element; defs: Element[]; brk: '' | 'system' | 'page' }[] = [];
    const endings: { first: number; last: number; el: Element }[] = [];
    let defs: Element[] = [];
    let brk: '' | 'system' | 'page' = '';
    const visit = (node: Element) => {
      for (const c of children(node)) {
        switch (c.localName) {
          case 'section':
          case 'div':
          case 'lem':
            visit(c);
            break;
          case 'app': {
            const pick = child(c, 'lem') || child(c, 'rdg');
            if (pick) visit(pick);
            break;
          }
          case 'ending': {
            const first = found.length;
            visit(c);
            if (found.length > first) endings.push({ first, last: found.length - 1, el: c });
            break;
          }
          case 'scoreDef':
          case 'staffDef':
            if (c !== this.mainDef) defs.push(c);
            break;
          case 'sb':
            if (!brk) brk = 'system';
            break;
          case 'pb':
            brk = 'page';
            break;
          case 'measure':
            found.push({ el: c, defs, brk });
            defs = [];
            brk = '';
            break;
        }
      }
    };
    visit(this.scoreEl!);

    found.forEach((f, i) => {
      const prevMeter = { ...this.meter };
      const snap = this.snapshot();
      for (const d of f.defs) {
        if (d.localName === 'scoreDef') this.applyScoreDef(d);
        else this.applyStaffDef(d);
      }
      const m: Measure = {
        el: f.el,
        idx: i,
        number: f.el.getAttribute('n') || String(i + 1),
        cap: 0,
        meter: { ...this.meter },
        streams: [],
        brk: i === 0 ? '' : f.brk,
        timeChange: i > 0 && (prevMeter.count !== this.meter.count || prevMeter.unit !== this.meter.unit || prevMeter.sym !== this.meter.sym),
        keyChanges: new Set(),
        clefChanges: new Set(),
        transChanges: new Set(),
        keys: {},
        clefs: {},
        trans: {},
        endingStart: null,
        endingStop: null,
        leftRepeat: false,
      };
      if (i > 0) {
        for (const [n, st] of this.state) {
          const old = snap.get(n)!;
          if (old.key.fifths !== st.key.fifths || old.key.mode !== st.key.mode) m.keyChanges.add(n);
          if (JSON.stringify(old.clef) !== JSON.stringify(st.clef)) m.clefChanges.add(n);
          if (old.semi !== st.semi || old.diat !== st.diat) m.transChanges.add(n);
        }
      }
      for (const [n, st] of this.state) {
        m.keys[n] = { ...st.key };
        m.clefs[n] = { ...st.clef };
        m.trans[n] = { semi: st.semi, diat: st.diat };
      }
      this.measures.push(m);
      this.buildMeasure(m);
    });

    // endings
    endings.forEach((e, k) => {
      const label = e.el.getAttribute('label') || '';
      let nums: string[] = [...((e.el.getAttribute('n') || '').match(/\d+/g) || label.match(/\d+/g) || [String(k + 1)])];
      nums = nums.filter((x) => Number(x) > 0);
      if (!nums.length) nums = [String(k + 1)];
      const number = nums.join(', ');
      const text = label || `${nums.join(', ')}.`;
      this.measures[e.first].endingStart = { number, text };
      const right = this.measures[e.last].el.getAttribute('right') || '';
      this.measures[e.last].endingStop = { number, type: right === 'rptend' || right === 'rptboth' ? 'stop' : 'discontinue' };
    });
    this.measures.forEach((m, i) => {
      const prevRight = i > 0 ? this.measures[i - 1].el.getAttribute('right') : '';
      m.leftRepeat = m.el.getAttribute('left') === 'rptstart' || prevRight === 'rptboth' || prevRight === 'rptstart';
    });
  }

  private snapshot(): Map<string, StaffState> {
    const out = new Map<string, StaffState>();
    for (const [n, st] of this.state) out.set(n, { ...st, key: { ...st.key }, clef: { ...st.clef } });
    return out;
  }

  private meterCap(meter: MeterState): number {
    const count = meter.count.split('+').reduce((a, b) => a + (Number(b) || 0), 0) || 4;
    return (count * 4) / (meter.unit || 4);
  }

  private buildMeasure(m: Measure) {
    m.cap = this.meterCap(m.meter);
    const staves = children(m.el, 'staff');
    for (const staff of staves) {
      const staffN = staff.getAttribute('n') || '1';
      if (!this.staffPart.has(staffN)) continue;
      const layers = children(staff, 'layer');
      layers.forEach((layer, li) => {
        const layerN = layer.getAttribute('n') || String(li + 1);
        const s: Stream = { staffN, layerN, events: [] };
        this.walkLayer(layer, s, m);
        m.streams.push(s);
      });
    }
    m.streams.sort((a, b) => this.staffOrder.indexOf(a.staffN) - this.staffOrder.indexOf(b.staffN) || Number(a.layerN) - Number(b.layerN));
    let longest = 0;
    for (const s of m.streams) {
      let end = 0;
      for (const e of s.events) if (!WHOLE_MEASURE.has(e.el.localName)) end = Math.max(end, e.start + e.dur);
      longest = Math.max(longest, end);
    }
    if (m.el.getAttribute('metcon') === 'false' && longest > 0) m.cap = longest;
    for (const s of m.streams) for (const e of s.events) if (WHOLE_MEASURE.has(e.el.localName)) e.dur = m.cap;
    this.addDenominator(m.cap);
  }

  private addDenominator(q: number) {
    // q is a quarter-note count; record the smallest denominator that makes it whole
    for (let d = 1; d <= 1 << 20; d *= 2) {
      for (const k of [1, 3, 5, 7, 9, 15, 21, 35, 45, 63, 105]) {
        const v = q * d * k;
        if (Math.abs(v - Math.round(v)) < 1e-6) {
          this.denominators.add(d * k);
          return;
        }
      }
    }
  }

  private walkLayer(layer: Element, s: Stream, m: Measure) {
    let t = 0;
    const tupletCount = { depth: 0 };
    const make = (el: Element, kind: EvKind, ctx: WalkCtx): Ev => ({
      el,
      kind,
      start: t,
      dur: 0,
      durText: '',
      dots: 0,
      actual: ctx.actual,
      normal: ctx.normal,
      grace: ctx.grace,
      cue: ctx.cue,
      tuplets: [],
      beams: [],
      trem: null,
      staffN: s.staffN,
      layerN: s.layerN,
      mIdx: m.idx,
    });
    interface WalkCtx {
      actual: number;
      normal: number;
      grace: string;
      cue: boolean;
      beam: Ev[] | null;
    }
    const walk = (container: Element, ctx: WalkCtx) => {
      for (const c of children(container)) {
        const name = c.localName;
        if (name === 'note' || name === 'chord' || name === 'rest' || name === 'space') {
          const ev = make(c, name, ctx);
          const own = c.getAttribute('grace') || '';
          if (own) ev.grace = own;
          if (c.getAttribute('cue') === 'true') ev.cue = true;
          let dur = c.getAttribute('dur');
          let dots = Number(c.getAttribute('dots') || 0);
          if (!dur && name === 'chord') {
            const n0 = children(c, 'note').find((n) => n.getAttribute('dur'));
            dur = n0?.getAttribute('dur') || null;
            if (n0 && !c.getAttribute('dots')) dots = Number(n0.getAttribute('dots') || 0);
          }
          if (!dur) dur = c.getAttribute('dur.ges') || null;
          let actual = ctx.actual;
          let normal = ctx.normal;
          const num = Number(c.getAttribute('num') || 0);
          const numbase = Number(c.getAttribute('numbase') || 0);
          const loneRatio = !!(num && numbase && !ancestor(c, 'tuplet'));
          if (loneRatio) {
            actual *= num;
            normal *= numbase;
          }
          ev.actual = actual;
          ev.normal = normal;
          ev.durText = dur || '';
          ev.dots = dots;
          if (!ev.grace && dur) ev.dur = this.quarters(dur, dots, actual, normal);
          if (ev.grace && /slash/.test(c.getAttribute('stem.mod') || '')) ev.grace = 'unacc';
          if (loneRatio && name !== 'space') {
            ev.tuplets.push({ type: 'start', number: tupletCount.depth + 1, el: c }, { type: 'stop', number: tupletCount.depth + 1, el: c });
          }
          s.events.push(ev);
          if (ctx.beam && !ev.grace && (name === 'note' || name === 'chord')) ctx.beam.push(ev);
          const sm = /^(\d)slash$/.exec(c.getAttribute('stem.mod') || '');
          if (sm && !ev.grace && !ev.trem) ev.trem = { type: 'single', marks: Number(sm[1]) };
          if (name === 'chord' && !sm) {
            const nm = children(c, 'note').map((n) => /^(\d)slash$/.exec(n.getAttribute('stem.mod') || '')).find(Boolean);
            if (nm && !ev.grace) ev.trem = { type: 'single', marks: Number(nm[1]) };
          }
          t += ev.dur;
          this.register(c, ev, null);
          if (name === 'chord') for (const n of children(c, 'note')) this.register(n, ev, n);
        } else if (name === 'mRest' || name === 'mSpace' || name === 'multiRest' || name === 'mRpt' || name === 'mRpt2') {
          const ev = make(c, name === 'mSpace' || name.startsWith('mRpt') ? 'space' : 'mrest', ctx);
          ev.dur = m.cap;
          s.events.push(ev);
          this.register(c, ev, null);
          t += m.cap;
        } else if (name === 'beam') {
          const group: Ev[] = [];
          walk(c, { ...ctx, beam: group });
          // a beam nested in another beam (Verovio writes this for beams crossing a tuplet) stays its own group
          this.setBeams(group);
        } else if (name === 'tuplet') {
          const num = Number(c.getAttribute('num') || 3) || 3;
          const numbase = Number(c.getAttribute('numbase') || 2) || 2;
          const from = s.events.length;
          tupletCount.depth++;
          const number = tupletCount.depth;
          walk(c, { ...ctx, actual: ctx.actual * num, normal: ctx.normal * numbase });
          tupletCount.depth--;
          const inner = s.events.slice(from).filter((e) => (e.kind === 'note' || e.kind === 'chord' || e.kind === 'rest') && !e.grace);
          if (inner.length) {
            inner[0].tuplets.push({ type: 'start', number, el: c });
            inner[inner.length - 1].tuplets.push({ type: 'stop', number, el: c });
          }
        } else if (name === 'graceGrp') {
          walk(c, { ...ctx, grace: c.getAttribute('grace') || 'unacc' });
        } else if (name === 'bTrem') {
          const from = s.events.length;
          walk(c, ctx);
          const ev = s.events.slice(from).find((e) => e.kind === 'note' || e.kind === 'chord');
          if (ev) {
            const unit = Number(c.getAttribute('unitdur') || 0);
            const own = /^(\d)slash$/.exec(ev.el.getAttribute('stem.mod') || c.getAttribute('stem.mod') || '');
            const marks = own ? Number(own[1]) : unit ? Math.max(1, Math.round(Math.log2(unit / 4))) - this.flagCount(ev.durText) : 3;
            ev.trem = { type: 'single', marks: Math.max(1, Math.min(8, marks)) };
          }
        } else if (name === 'fTrem') {
          const from = s.events.length;
          walk(c, ctx);
          const evs = s.events.slice(from).filter((e) => e.kind === 'note' || e.kind === 'chord');
          if (evs.length >= 2) {
            const unit = Number(c.getAttribute('unitdur') || 0);
            const marks = Number(c.getAttribute('beams') || 0) || (unit ? Math.max(1, Math.round(Math.log2(unit / 4))) : 3);
            evs[0].trem = { type: 'start', marks };
            evs[evs.length - 1].trem = { type: 'stop', marks };
          }
        } else if (name === 'clef') {
          const clef = this.readClef(c, '');
          if (clef) {
            const ev = make(c, 'clef', ctx);
            ev.clef = clef;
            s.events.push(ev);
            const st = this.state.get(s.staffN);
            if (st) st.clef = clef;
          }
        } else if (name === 'keySig') {
          const ev = make(c, 'key', ctx);
          ev.key = { fifths: parseKeySig(c.getAttribute('sig')), mode: c.getAttribute('mode') || '' };
          s.events.push(ev);
          const st = this.state.get(s.staffN);
          if (st) st.key = ev.key;
        } else if (name === 'meterSig') {
          const count = c.getAttribute('count');
          if (count || c.getAttribute('sym')) {
            const ev = make(c, 'meter', ctx);
            const sym = c.getAttribute('sym') || '';
            ev.meter = { count: count || '4', unit: Number(c.getAttribute('unit') || 4), sym, visible: c.getAttribute('visible') !== 'false', present: true };
            s.events.push(ev);
          }
        } else if (name === 'app') {
          const pick = child(c, 'lem') || child(c, 'rdg');
          if (pick) walk(pick, ctx);
        } else if (name === 'choice' || name === 'supplied' || name === 'add' || name === 'corr' || name === 'reg' || name === 'orig' || name === 'sic' || name === 'unclear') {
          if (name === 'choice') {
            const pick = child(c, 'corr') || child(c, 'reg') || children(c)[0];
            if (pick) walk(pick, ctx);
          } else walk(c, ctx);
        }
        // anything else (barLine, custos, annot, beatRpt, ...) is skipped
      }
    };
    walk(layer, { actual: 1, normal: 1, grace: '', cue: false, beam: null });
  }

  private flagCount(dur: string) {
    const d = Number(dur);
    return d >= 8 ? Math.round(Math.log2(d)) - 2 : 0;
  }

  private quarters(dur: string, dots: number, actual: number, normal: number): number {
    let num: number;
    let den: number;
    if (dur === 'breve') [num, den] = [8, 1];
    else if (dur === 'long') [num, den] = [16, 1];
    else if (dur === 'maxima') [num, den] = [32, 1];
    else {
      const d = Number(dur);
      if (!d || !isFinite(d)) return 0;
      [num, den] = [4, d];
    }
    // dots: x (2^(dots+1) - 1) / 2^dots
    num *= 2 ** (dots + 1) - 1;
    den *= 2 ** dots;
    num *= normal;
    den *= actual;
    const g = gcd(num, den);
    this.denominators.add(den / g);
    return num / den;
  }

  private register(el: Element, ev: Ev, note: Element | null) {
    const id = getId(el);
    if (id) this.byId.set(id, { ev, note });
  }

  private setBeams(group: Ev[]) {
    if (group.length < 2) return;
    const levels = group.map((e) => Math.max(1, this.flagCount(e.durText)));
    group.forEach((e, i) => {
      const out: string[] = [];
      for (let L = 1; L <= levels[i]; L++) {
        if (L === 1) {
          out.push(i === 0 ? 'begin' : i === group.length - 1 ? 'end' : 'continue');
          continue;
        }
        const p = i > 0 && levels[i - 1] >= L;
        const q = i < group.length - 1 && levels[i + 1] >= L;
        if (p && q) out.push('continue');
        else if (p) out.push('end');
        else if (q) out.push('begin');
        else out.push(i === 0 ? 'forward hook' : 'backward hook');
      }
      e.beams = out;
    });
  }

  // ---------- pitch spelling ----------

  private computeAlters() {
    // The editor and Verovio's importers write @accid.ges on every altered note, and Verovio plays a note
    // with neither @accid nor @accid.ges as natural. Only files without any gestural accidentals get their
    // pitch inferred from the key signature and earlier accidentals in the bar.
    const gesEncoded = !!this.scoreEl && (descendants(this.scoreEl, 'note').some((n) => n.hasAttribute('accid.ges')) || descendants(this.scoreEl, 'accid').some((a) => a.hasAttribute('accid.ges')));
    // octave lines shift sounding pitch; MEI keeps the displayed pitch in @oct
    for (const oc of this.scoreEl ? descendants(this.scoreEl, 'octave') : []) {
      const a = this.resolveStart(oc);
      const b = this.resolveEnd(oc) || a;
      if (!a || !b) continue;
      const dis = Number(oc.getAttribute('dis') || 8);
      const shift = (dis >= 22 ? 3 : dis >= 15 ? 2 : 1) * (oc.getAttribute('dis.place') === 'below' ? -1 : 1);
      const k0 = a.ev.mIdx * 1e6 + a.ev.start;
      const k1 = b.ev.mIdx * 1e6 + b.ev.start;
      for (let i = a.ev.mIdx; i <= b.ev.mIdx && i < this.measures.length; i++) {
        for (const s of this.measures[i].streams) {
          if (s.staffN !== a.ev.staffN) continue;
          for (const e of s.events) {
            const k = e.mIdx * 1e6 + e.start;
            if (k < k0 - EPS || k > k1 + EPS) continue;
            for (const n of this.notesOf(e)) this.octShift.set(n, shift);
          }
        }
      }
    }
    for (const m of this.measures) {
      const byStaff = new Map<string, { t: number; n: Element; o: number }[]>();
      let order = 0;
      for (const s of m.streams) {
        const list = byStaff.get(s.staffN) || [];
        byStaff.set(s.staffN, list);
        for (const e of s.events) for (const n of this.notesOf(e)) list.push({ t: e.start, n, o: order++ });
      }
      for (const [staffN, list] of byStaff) {
        list.sort((a, b) => a.t - b.t || a.o - b.o);
        const fifths = m.keys[staffN]?.fifths ?? 0;
        const state = new Map<string, number>();
        let carry = this.tieCarry.get(staffN);
        if (!carry) this.tieCarry.set(staffN, (carry = new Map()));
        for (const { n } of list) {
          const pname = n.getAttribute('pname');
          if (!pname) continue;
          const key = pname + (n.getAttribute('oct') || '');
          const accEl = child(n, 'accid');
          const written = n.getAttribute('accid') || accEl?.getAttribute('accid') || null;
          const ges = n.getAttribute('accid.ges') || accEl?.getAttribute('accid.ges') || null;
          const tie = n.getAttribute('tie') || n.parentElement?.getAttribute('tie') || '';
          let alter: number;
          if (written !== null) {
            alter = ALTER[written] ?? 0;
            state.set(key, alter);
          } else if (ges !== null) alter = ALTER[ges] ?? 0;
          else if (gesEncoded) alter = 0;
          else if (/[mt]/.test(tie) && carry.has(key)) alter = carry.get(key)!;
          else if (state.has(key)) alter = state.get(key)!;
          else alter = keyAlter(fifths, pname);
          this.alters.set(n, alter);
          if (/[im]/.test(tie)) carry.set(key, alter);
        }
      }
    }
  }

  private notesOf(e: Ev): Element[] {
    if (e.kind === 'note') return [e.el];
    if (e.kind === 'chord') return children(e.el, 'note');
    return [];
  }

  // ---------- control events ----------

  private resolveStart(c: Element): Located | null {
    const id = refId(c.getAttribute('startid'));
    if (id) return this.byId.get(id) || null;
    const m = ancestor(c, 'measure');
    const mi = m ? this.measures.findIndex((x) => x.el === m) : -1;
    const ts = c.getAttribute('tstamp');
    if (mi < 0 || ts === null) return null;
    return this.eventAt(mi, this.staffOf(c), c.getAttribute('layer'), this.tsToPos(this.measures[mi], Number(ts)));
  }

  private resolveEnd(c: Element): Located | null {
    const id = refId(c.getAttribute('endid'));
    if (id) return this.byId.get(id) || null;
    const pos = this.tstamp2(c);
    if (!pos) return null;
    return this.eventAt(pos.mIdx, this.staffOf(c), c.getAttribute('layer'), pos.pos);
  }

  private tstamp2(c: Element): { mIdx: number; pos: number } | null {
    const t2 = /^\s*(\d+)m\+([\d.]+)\s*$/.exec(c.getAttribute('tstamp2') || '');
    const m = ancestor(c, 'measure');
    const mi = m ? this.measures.findIndex((x) => x.el === m) : -1;
    if (!t2 || mi < 0) return null;
    const idx = Math.min(this.measures.length - 1, mi + Number(t2[1]));
    return { mIdx: idx, pos: this.tsToPos(this.measures[idx], Number(t2[2])) };
  }

  private staffOf(c: Element): string {
    const s = (c.getAttribute('staff') || '').trim().split(/\s+/)[0];
    if (s && this.staffPart.has(s)) return s;
    const start = this.byId.get(refId(c.getAttribute('startid')));
    return start ? start.ev.staffN : this.staffOrder[0];
  }

  private tsToPos(m: Measure, ts: number): number {
    if (!isFinite(ts)) return 0;
    return Math.max(0, ((ts - 1) * 4) / (m.meter.unit || 4));
  }

  /** The note, chord or rest sounding at `pos` in a staff (first layer unless one is given). */
  private eventAt(mIdx: number, staffN: string, layerN: string | null, pos: number): Located | null {
    const m = this.measures[mIdx];
    if (!m) return null;
    const streams = m.streams.filter((s) => s.staffN === staffN);
    const ordered = layerN ? [...streams.filter((s) => s.layerN === layerN), ...streams.filter((s) => s.layerN !== layerN)] : streams;
    for (const s of ordered) {
      let hit: Ev | null = null;
      for (const e of s.events) {
        if (e.kind !== 'note' && e.kind !== 'chord' && e.kind !== 'rest' && e.kind !== 'mrest') continue;
        if (e.grace) continue;
        if (e.start <= pos + EPS) hit = e;
      }
      if (hit) return { ev: hit, note: null };
    }
    return null;
  }

  private nt(el: Element): Notations {
    let n = this.notations.get(el);
    if (!n) {
      n = { tiedStop: [], tiedStart: [], slurStop: [], slurStart: [], other: [], ornaments: [], technical: [], articulations: [], fermatas: [], arpeggiate: [] };
      this.notations.set(el, n);
    }
    return n;
  }

  /** Element that carries a note-level notation: the referenced note, else the event itself. */
  private target(l: Located): Element {
    return l.note || l.ev.el;
  }

  private placeAttr(c: Element): string {
    const p = c.getAttribute('place') || '';
    return p === 'above' || p === 'below' ? p : '';
  }

  private addDirective(c: Element, d: Directive, when: 'before' | 'after' = 'before', loc?: Located | null) {
    const id = refId(c.getAttribute(when === 'after' ? 'endid' : 'startid'));
    if (id) {
      const l = loc || this.byId.get(id);
      if (l) {
        d.staffN = l.ev.staffN;
        const map = when === 'after' ? this.after : this.before;
        const list = map.get(l.ev.el) || [];
        list.push(d);
        map.set(l.ev.el, list);
        return;
      }
    }
    let mIdx: number;
    let pos: number;
    if (when === 'after') {
      const t2 = this.tstamp2(c);
      if (!t2) return;
      ({ mIdx, pos } = t2);
    } else {
      const m = ancestor(c, 'measure');
      mIdx = m ? this.measures.findIndex((x) => x.el === m) : -1;
      if (mIdx < 0) return;
      pos = this.tsToPos(this.measures[mIdx], Number(c.getAttribute('tstamp') ?? 1));
    }
    d.staffN = this.staffOf(c);
    const list = this.at.get(mIdx) || [];
    list.push({ staffN: d.staffN, layerN: c.getAttribute('layer') || '', pos, d });
    this.at.set(mIdx, list);
  }

  private dir(types: string[], placement = '', sound = ''): Directive {
    return { kind: 'direction', staffN: '', placement, types, sound };
  }

  private processControls() {
    const slurs: { part: number; a: Located; b: Located; place: string; key0: number; key1: number }[] = [];
    for (const m of this.measures) {
      for (const c of children(m.el)) {
        try {
          this.control(c, m, slurs);
        } catch {
          // a malformed control event is skipped rather than failing the export
        }
      }
    }
    // lyrics, articulations, fermatas etc. written on the notes themselves
    for (const m of this.measures) {
      for (const s of m.streams) {
        for (const e of s.events) {
          if (e.kind === 'note' || e.kind === 'chord' || e.kind === 'rest') this.ownMarks(e);
        }
      }
    }
    // slur numbers: reuse the lowest number free at the slur's start
    const byPart = new Map<number, typeof slurs>();
    for (const s of slurs) byPart.set(s.part, [...(byPart.get(s.part) || []), s]);
    for (const list of byPart.values()) {
      list.sort((x, y) => x.key0 - y.key0);
      const busyUntil: number[] = [];
      for (const s of list) {
        let n = 0;
        while (n < 16 && busyUntil[n] !== undefined && busyUntil[n] >= s.key0) n++;
        if (n >= 16) n = 0;
        busyUntil[n] = s.key1;
        this.nt(this.target(s.a)).slurStart.push(tag('slur', null, { type: 'start', number: n + 1, placement: s.place }));
        this.nt(this.target(s.b)).slurStop.push(tag('slur', null, { type: 'stop', number: n + 1 }));
      }
    }
  }

  private control(c: Element, m: Measure, slurs: { part: number; a: Located; b: Located; place: string; key0: number; key1: number }[]) {
    const name = c.localName;
    const place = this.placeAttr(c);
    switch (name) {
      case 'slur':
      case 'phrase': {
        const a = this.resolveStart(c);
        const b = this.resolveEnd(c);
        if (!a || !b) return;
        const key0 = a.ev.mIdx * 1e6 + a.ev.start;
        const key1 = b.ev.mIdx * 1e6 + b.ev.start;
        if (this.target(a) === this.target(b) || key1 < key0) return;
        const place2 = c.getAttribute('curvedir') === 'above' ? 'above' : c.getAttribute('curvedir') === 'below' ? 'below' : place;
        slurs.push({ part: this.staffPart.get(a.ev.staffN)?.part ?? 0, a, b, place: place2, key0, key1 });
        return;
      }
      case 'tie': {
        const a = this.resolveStart(c);
        const b = this.resolveEnd(c);
        if (!a || !b) return;
        const na = a.note || this.notesOf(a.ev)[0];
        const nb = b.note || this.notesOf(b.ev)[0];
        if (!na || !nb || na === nb) return;
        this.addTie(na, 'start');
        this.addTie(nb, 'stop');
        return;
      }
      case 'lv': {
        const a = this.resolveStart(c);
        const n = a && (a.note || this.notesOf(a.ev)[0]);
        if (n) this.nt(n).tiedStart.push(tag('tied', null, { type: 'let-ring' }));
        return;
      }
      case 'dynam': {
        const text = textOf(c);
        if (!text) return;
        this.addDirective(c, this.dir(this.dynamicsTypes(text), place || 'below'));
        return;
      }
      case 'hairpin': {
        const form = c.getAttribute('form') === 'dim' ? 'diminuendo' : 'crescendo';
        const startT = tag('wedge', null, { type: form, niente: c.getAttribute('niente') === 'true' && form === 'crescendo' ? 'yes' : undefined });
        const stopT = tag('wedge', null, { type: 'stop', niente: c.getAttribute('niente') === 'true' && form === 'diminuendo' ? 'yes' : undefined });
        if (!refId(c.getAttribute('endid')) && !c.getAttribute('tstamp2')) return;
        this.addDirective(c, this.dir([startT], place || 'below'));
        this.addDirective(c, this.dir([stopT], place || 'below'), 'after');
        return;
      }
      case 'dir':
      case 'anchoredText':
      case 'cpMark':
      case 'attacca': {
        const text = textOf(c);
        if (!text) return;
        this.addDirective(c, this.dir([this.wordsXml(c, text)], place || 'above'));
        return;
      }
      case 'tempo':
        this.tempo(c, place);
        return;
      case 'reh': {
        const text = textOf(c);
        if (!text) return;
        const rend = descendants(c, 'rend')[0]?.getAttribute('rend') || '';
        const enclosure = /circle/.test(rend) ? 'circle' : /box/.test(rend) ? 'square' : /none/.test(rend) ? 'none' : 'square';
        this.addDirective(c, this.dir([textTag('rehearsal', text, { enclosure })], place || 'above'));
        return;
      }
      case 'repeatMark': {
        const func = c.getAttribute('func') || '';
        const text = textOf(c);
        if (func === 'segno') this.addDirective(c, this.dir([tag('segno', null)], place || 'above', tag('sound', null, { segno: 'segno' })));
        else if (func === 'coda') this.addDirective(c, this.dir([tag('coda', null)], place || 'above', tag('sound', null, { coda: 'coda' })));
        else if (func === 'fine') this.addDirective(c, this.dir([textTag('words', text || 'Fine')], place || 'above', tag('sound', null, { fine: 'yes' })));
        else if (func === 'daCapo') this.addDirective(c, this.dir([textTag('words', text || 'D.C.')], place || 'above', tag('sound', null, { dacapo: 'yes' })));
        else if (func === 'dalSegno') this.addDirective(c, this.dir([textTag('words', text || 'D.S.')], place || 'above', tag('sound', null, { dalsegno: 'segno' })));
        else if (text) this.addDirective(c, this.dir([textTag('words', text)], place || 'above'));
        return;
      }
      case 'pedal': {
        const d = c.getAttribute('dir') || 'down';
        const type = d === 'up' ? 'stop' : d === 'bounce' ? 'change' : 'start';
        const line = c.getAttribute('form') === 'line' || c.getAttribute('form') === 'pedline' ? 'yes' : 'no';
        this.addDirective(c, this.dir([tag('pedal', null, { type, line, sign: line === 'yes' ? 'no' : 'yes' })], place || 'below'));
        return;
      }
      case 'octave': {
        const dis = Number(c.getAttribute('dis') || 8);
        const below = c.getAttribute('dis.place') === 'below';
        const size = dis >= 22 ? 22 : dis >= 15 ? 15 : 8;
        if (!refId(c.getAttribute('endid')) && !c.getAttribute('tstamp2')) return;
        this.addDirective(c, this.dir([tag('octave-shift', null, { type: below ? 'up' : 'down', size })], below ? 'below' : 'above'));
        this.addDirective(c, this.dir([tag('octave-shift', null, { type: 'stop', size })], below ? 'below' : 'above'), 'after');
        return;
      }
      case 'harm': {
        if (child(c, 'fb')) return;
        const text = textOf(c);
        if (!text) return;
        const d: Directive = { kind: 'harmony', staffN: '', placement: place || 'above', types: [harmonyXml(text)], sound: '' };
        this.addDirective(c, d);
        return;
      }
      case 'fermata': {
        const a = this.resolveStart(c);
        if (!a) return;
        const shape = c.getAttribute('shape');
        const content = shape === 'square' ? 'square' : shape === 'angular' ? 'angled' : 'normal';
        const inverted = c.getAttribute('form') === 'inv' || place === 'below';
        this.nt(this.target(a)).fermatas.push(textTag('fermata', content, { type: inverted ? 'inverted' : 'upright' }));
        return;
      }
      case 'trill': {
        const a = this.resolveStart(c);
        if (!a) return;
        const orn = this.nt(this.target(a)).ornaments;
        orn.push(tag('trill-mark', null, { placement: place }));
        const up = c.getAttribute('accidupper');
        const low = c.getAttribute('accidlower');
        if (up && ACCIDENTAL_NAMES[up]) orn.push(textTag('accidental-mark', ACCIDENTAL_NAMES[up], { placement: 'above' }));
        else if (low && ACCIDENTAL_NAMES[low]) orn.push(textTag('accidental-mark', ACCIDENTAL_NAMES[low], { placement: 'below' }));
        const b = this.resolveEnd(c);
        if (b && this.target(b) !== this.target(a)) {
          orn.push(tag('wavy-line', null, { type: 'start', number: 1 }));
          this.nt(this.target(b)).ornaments.push(tag('wavy-line', null, { type: 'stop', number: 1 }));
        }
        return;
      }
      case 'mordent': {
        const a = this.resolveStart(c);
        if (!a) return;
        const long = c.getAttribute('long') === 'true' ? 'yes' : undefined;
        const el = c.getAttribute('form') === 'lower' ? 'mordent' : 'inverted-mordent';
        const orn = this.nt(this.target(a)).ornaments;
        orn.push(tag(el, null, { long, placement: place }));
        this.accidMarks(c, orn);
        return;
      }
      case 'turn': {
        const a = this.resolveStart(c);
        if (!a) return;
        const lower = c.getAttribute('form') === 'lower';
        const delayed = c.getAttribute('delayed') === 'true';
        const el = delayed ? (lower ? 'delayed-inverted-turn' : 'delayed-turn') : lower ? 'inverted-turn' : 'turn';
        const orn = this.nt(this.target(a)).ornaments;
        orn.push(tag(el, null, { placement: place }));
        this.accidMarks(c, orn);
        return;
      }
      case 'arpeg': {
        const ids = (c.getAttribute('plist') || '').trim().split(/\s+/).map(refId).filter(Boolean);
        const notes = new Set<Element>();
        for (const id of ids) {
          const l = this.byId.get(id);
          if (!l) continue;
          if (l.note) notes.add(l.note);
          else for (const n of this.notesOf(l.ev)) notes.add(n);
        }
        if (!notes.size) {
          const a = this.resolveStart(c);
          if (a) for (const n of a.note ? [a.note] : this.notesOf(a.ev)) notes.add(n);
        }
        const order = c.getAttribute('order');
        const arrow = c.getAttribute('arrow') === 'true';
        for (const n of notes) {
          if (order === 'nonarp') this.nt(n).arpeggiate.push(tag('non-arpeggiate', null, { type: 'top' }));
          else this.nt(n).arpeggiate.push(tag('arpeggiate', null, { direction: arrow && order === 'down' ? 'down' : arrow ? 'up' : undefined }));
        }
        return;
      }
      case 'gliss': {
        const a = this.resolveStart(c);
        const b = this.resolveEnd(c);
        if (!a || !b || this.target(a) === this.target(b)) return;
        const lform = c.getAttribute('lform') || 'solid';
        const lineType = lform === 'wavy' ? 'wavy' : lform === 'dashed' ? 'dashed' : lform === 'dotted' ? 'dotted' : 'solid';
        const text = textOf(c);
        const na = a.note || this.notesOf(a.ev)[0] || a.ev.el;
        const nb = b.note || this.notesOf(b.ev)[0] || b.ev.el;
        this.nt(na).other.push(tag('glissando', text ? esc(text) : null, { type: 'start', number: 1, 'line-type': lineType }));
        this.nt(nb).other.push(tag('glissando', null, { type: 'stop', number: 1, 'line-type': lineType }));
        return;
      }
      case 'breath': {
        const a = this.resolveStart(c);
        if (a) this.nt(this.target(a)).articulations.push(tag('breath-mark', null, { placement: place }));
        return;
      }
      case 'caesura': {
        const a = this.resolveStart(c);
        if (a) this.nt(this.target(a)).articulations.push(tag('caesura', null, { placement: place }));
        return;
      }
      case 'fing': {
        const a = this.resolveStart(c);
        const text = textOf(c);
        if (a && text) this.nt(a.note || this.notesOf(a.ev)[0] || a.ev.el).technical.push(textTag('fingering', text, { placement: place }));
        return;
      }
    }
  }

  private accidMarks(c: Element, orn: string[]) {
    const up = c.getAttribute('accidupper');
    const low = c.getAttribute('accidlower');
    if (up && ACCIDENTAL_NAMES[up]) orn.push(textTag('accidental-mark', ACCIDENTAL_NAMES[up], { placement: 'above' }));
    if (low && ACCIDENTAL_NAMES[low]) orn.push(textTag('accidental-mark', ACCIDENTAL_NAMES[low], { placement: 'below' }));
  }

  private addTie(n: Element, type: 'start' | 'stop') {
    const nt = this.nt(n);
    const list = type === 'start' ? nt.tiedStart : nt.tiedStop;
    const t = tag('tied', null, { type });
    if (!list.includes(t)) list.push(t);
  }

  /** "mf" → <dynamics>; "p dolce" → dynamics + words; anything else → italic words. */
  private dynamicsTypes(text: string): string[] {
    const dyn = (t: string) => `<dynamics>${DYNAMICS.has(t) ? `<${t}/>` : textTag('other-dynamics', t)}</dynamics>`;
    const clean = text.replace(/[\s.]/g, '');
    if (/^[pmfrsnz]+$/.test(clean)) return [dyn(clean)];
    const lead = /^([pmfrsnz]+)\s+(.+)$/.exec(text);
    if (lead && DYNAMICS.has(lead[1])) return [dyn(lead[1]), textTag('words', lead[2], { 'font-style': 'italic' })];
    const trail = /^(.+?)\s+([pmfrsnz]+)$/.exec(text);
    if (trail && DYNAMICS.has(trail[2])) return [textTag('words', trail[1], { 'font-style': 'italic' }), dyn(trail[2])];
    return [textTag('words', text, { 'font-style': 'italic' })];
  }

  private wordsXml(c: Element, text: string): string {
    const rends = descendants(c, 'rend');
    const italic = rends.some((r) => r.getAttribute('fontstyle') === 'italic');
    const bold = rends.some((r) => r.getAttribute('fontweight') === 'bold');
    return textTag('words', text, { 'font-style': italic ? 'italic' : undefined, 'font-weight': bold ? 'bold' : undefined });
  }

  private tempo(c: Element, place: string) {
    const raw = textOf(c, (x) => x.localName === 'rend' && !!x.getAttribute('glyph.auth'));
    const mm = Number(c.getAttribute('mm') || 0);
    const unit = c.getAttribute('mm.unit') || '';
    const mmDots = Number(c.getAttribute('mm.dots') || 0);
    const bpm = Number(c.getAttribute('midi.bpm') || 0);
    let words = raw;
    if (mm || bpm) words = words.replace(/\s*[^\s\w(]*\s*=\s*\d+(?:\.\d+)?\s*\)?\s*$/u, '').replace(/[(\s]+$/, '').trim();
    const types: string[] = [];
    if (words) types.push(textTag('words', words, { 'font-weight': 'bold' }));
    const unitName = TYPE_NAMES[unit || '4'];
    let perMinute = mm;
    if (!perMinute && !words && bpm) perMinute = bpm;
    if (perMinute && unitName) {
      types.push(`<metronome parentheses="no">${tag('beat-unit', unitName)}${'<beat-unit-dot/>'.repeat(mmDots)}${tag('per-minute', Math.round(perMinute * 100) / 100)}</metronome>`);
    }
    // MusicXML's sound tempo is in quarter notes per minute
    const unitQ = unit ? this.quartersPlain(unit, mmDots) : 1;
    const qpm = mm ? mm * unitQ : bpm;
    const sound = qpm ? tag('sound', null, { tempo: Math.round(qpm * 100) / 100 }) : '';
    if (!types.length) {
      if (!sound) return;
      types.push(textTag('words', ''));
    }
    this.addDirective(c, this.dir(types, place || 'above', sound));
  }

  private quartersPlain(dur: string, dots: number) {
    const base = dur === 'breve' ? 8 : dur === 'long' ? 16 : 4 / (Number(dur) || 4);
    return base * (2 - 2 ** -dots);
  }

  /** Marks written on the event itself: articulations, fermata attribute, ties, lyrics. */
  private ownMarks(e: Ev) {
    const el = e.el;
    const notes = this.notesOf(e);
    const first = notes[0] || el;
    const artics: { a: string; place: string }[] = [];
    const collect = (x: Element) => {
      for (const a of (x.getAttribute('artic') || '').split(/\s+/).filter(Boolean)) artics.push({ a, place: '' });
      for (const k of children(x, 'artic')) for (const a of (k.getAttribute('artic') || '').split(/\s+/).filter(Boolean)) artics.push({ a, place: this.placeAttr(k) });
    };
    collect(el);
    if (e.kind === 'chord') for (const n of notes) collect(n);
    const seen = new Set<string>();
    for (const { a, place } of artics) {
      if (seen.has(a)) continue;
      seen.add(a);
      const nt = this.nt(first);
      if (ARTICULATIONS[a]) nt.articulations.push(tag(ARTICULATIONS[a], null, { placement: place }));
      if (ARTIC_EXTRA[a]) nt.articulations.push(tag(ARTIC_EXTRA[a], null, { placement: place }));
      if (TECHNICAL[a]) nt.technical.push(tag(TECHNICAL[a], null, { placement: place }));
    }
    const ferm = el.getAttribute('fermata');
    if (ferm) this.nt(first).fermatas.push(textTag('fermata', 'normal', { type: ferm === 'below' ? 'inverted' : 'upright' }));
    for (const n of notes) {
      const tie = n.getAttribute('tie') || el.getAttribute('tie') || '';
      if (/[mt]/.test(tie)) this.addTie(n, 'stop');
      if (/[im]/.test(tie)) this.addTie(n, 'start');
    }
    // lyrics, gathered onto the first note of a chord
    const verses: Element[] = [];
    for (const x of [el, ...notes]) {
      verses.push(...children(x, 'verse'));
      const loose = children(x, 'syl');
      if (loose.length) verses.push(x); // syl directly on the note acts as verse 1
    }
    if (verses.length) this.lyricsOn.set(first, verses);
  }

  // ---------- divisions ----------

  private chooseDivisions() {
    let d = 960;
    for (const den of this.denominators) {
      const next = lcm(d, den);
      if (next > 1e7) continue;
      d = next;
    }
    this.divisions = d;
  }

  private divs(q: number): number {
    return Math.round(q * this.divisions);
  }

  // ---------- writing ----------

  private write(): string {
    const out: string[] = [];
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
    out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
    out.push('<score-partwise version="4.0">');
    out.push(this.header());
    out.push(this.partList());
    this.parts.forEach((p, pi) => {
      out.push(`<part id="${p.id}">`);
      for (const m of this.measures) out.push(this.measureXml(m, pi));
      if (!this.measures.length) out.push(`<measure number="1">${this.firstAttributes(pi, null)}</measure>`);
      out.push('</part>');
    });
    out.push('</score-partwise>');
    return out.join('\n') + '\n';
  }

  private header(): string {
    const head = descendants(this.doc, 'meiHead')[0];
    const ts = head ? descendants(head, 'titleStmt')[0] : null;
    let title = '';
    let subtitle = '';
    const creators: string[] = [];
    if (ts) {
      const titles = children(ts, 'title');
      const main = titles.find((t) => (t.getAttribute('type') || 'main') === 'main' && textOf(t)) || titles.find((t) => textOf(t) && t.getAttribute('type') !== 'subordinate');
      title = textOf(main);
      subtitle = textOf(titles.find((t) => t.getAttribute('type') === 'subordinate'));
      for (const p of descendants(ts, 'persName')) {
        const role = (p.getAttribute('role') || '').toLowerCase();
        const name = textOf(p);
        if (role && name) creators.push(textTag('creator', name, { type: role }));
      }
      for (const role of ['composer', 'lyricist', 'arranger']) {
        for (const p of descendants(ts, role)) {
          const name = textOf(p);
          if (name && !creators.some((c) => c.includes(`type="${role}"`))) creators.push(textTag('creator', name, { type: role }));
        }
      }
    }
    let s = '';
    if (title) s += `<work>${textTag('work-title', title)}</work>\n`;
    if (subtitle) s += textTag('movement-title', subtitle) + '\n';
    const date = new Date().toISOString().slice(0, 10);
    s += `<identification>${creators.join('')}<encoding>${textTag('software', 'Staff Composer Pro Staff')}${textTag('encoding-date', date)}` +
      `<supports element="accidental" type="yes"/><supports element="beam" type="yes"/><supports element="stem" type="yes"/>` +
      `<supports element="print" attribute="new-system" type="yes" value="yes"/><supports element="print" attribute="new-page" type="yes" value="yes"/>` +
      `</encoding></identification>`;
    return s;
  }

  private partList(): string {
    const s: string[] = ['<part-list>'];
    let groupNo = 0;
    const open = new Map<PartGroup, number>();
    this.parts.forEach((p, pi) => {
      for (const g of this.groups.filter((x) => x.first === pi).sort((a, b) => b.last - a.last)) {
        const n = ++groupNo;
        open.set(g, n);
        const sym = ['brace', 'bracket', 'line', 'square'].includes(g.symbol) ? g.symbol : g.symbol === 'bracketsq' ? 'square' : 'none';
        s.push(
          `<part-group type="start" number="${n}">${g.name ? textTag('group-name', g.name) : ''}${g.abbr ? textTag('group-abbreviation', g.abbr) : ''}` +
            `${tag('group-symbol', sym)}${tag('group-barline', g.barThru ? 'yes' : 'no')}</part-group>`,
        );
      }
      const iid = `${p.id}-I1`;
      let sp = `<score-part id="${p.id}">${textTag('part-name', p.name, { 'print-object': p.name ? undefined : 'no' })}`;
      if (p.abbr) sp += textTag('part-abbreviation', p.abbr);
      sp += `<score-instrument id="${iid}">${textTag('instrument-name', p.name || `Part ${pi + 1}`)}</score-instrument>`;
      if (p.program !== null || p.channel !== null) {
        sp += `<midi-instrument id="${iid}">`;
        if (p.channel !== null && p.channel >= 0 && p.channel < 16) sp += tag('midi-channel', p.channel + 1);
        if (p.program !== null && p.program >= 0 && p.program < 128) sp += tag('midi-program', p.program + 1);
        sp += '</midi-instrument>';
      }
      sp += '</score-part>';
      s.push(sp);
      for (const g of this.groups.filter((x) => x.last === pi).sort((a, b) => a.first - b.first)) {
        s.push(`<part-group type="stop" number="${open.get(g)}"/>`);
      }
    });
    s.push('</part-list>');
    return s.join('\n');
  }

  private keyXml(k: KeyState, number?: number): string {
    const mode = ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'ionian', 'locrian'].includes(k.mode) ? k.mode : '';
    return `<key${attrs({ number })}>${tag('fifths', k.fifths)}${mode ? tag('mode', mode) : ''}</key>`;
  }

  private timeXml(m: MeterState): string {
    const symbol = m.sym === 'common' ? 'common' : m.sym === 'cut' ? 'cut' : undefined;
    return `<time${attrs({ symbol, 'print-object': m.visible ? undefined : 'no' })}>${textTag('beats', m.count)}${tag('beat-type', m.unit)}</time>`;
  }

  private clefXml(c: ClefState, number?: number): string {
    let sign = c.shape;
    let line = c.line;
    let oct = 0;
    if (c.dis) oct = (c.dis >= 22 ? 3 : c.dis >= 15 ? 2 : 1) * (c.place === 'above' ? 1 : -1);
    if (sign === 'perc') {
      sign = 'percussion';
      line = '';
    } else if (sign === 'TAB') {
      sign = 'TAB';
      line = '';
    } else if (sign === 'GG') {
      sign = 'G';
      oct = -1;
    } else if (!['G', 'F', 'C'].includes(sign)) {
      sign = 'G';
      line = '2';
    }
    if (!line && (sign === 'G' || sign === 'F' || sign === 'C')) line = sign === 'G' ? '2' : sign === 'F' ? '4' : '3';
    return `<clef${attrs({ number })}>${tag('sign', sign)}${line ? tag('line', line) : ''}${oct ? tag('clef-octave-change', oct) : ''}</clef>`;
  }

  private transposeXml(t: { semi: number; diat: number | null }, number?: number): string {
    const oct = Math.trunc(t.semi / 12);
    const chrom = t.semi - 12 * oct;
    const diatTotal = t.diat ?? Math.sign(t.semi) * ([0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6][Math.abs(t.semi) % 12] + 7 * Math.floor(Math.abs(t.semi) / 12));
    const diat = diatTotal - 7 * oct;
    return `<transpose${attrs({ number })}>${tag('diatonic', diat)}${tag('chromatic', chrom)}${oct ? tag('octave-change', oct) : ''}</transpose>`;
  }

  private firstAttributes(pi: number, m: Measure | null): string {
    const p = this.parts[pi];
    const keys = p.staves.map((n) => (m ? m.keys[n] : this.state.get(n)!.key));
    const clefs = p.staves.map((n) => (m ? m.clefs[n] : this.state.get(n)!.clef));
    const trans = p.staves.map((n) => (m ? m.trans[n] : { semi: this.state.get(n)!.semi, diat: this.state.get(n)!.diat }));
    let s = `<attributes>${tag('divisions', this.divisions)}`;
    const sameKey = keys.every((k) => k.fifths === keys[0].fifths && k.mode === keys[0].mode);
    s += sameKey ? this.keyXml(keys[0]) : keys.map((k, i) => this.keyXml(k, i + 1)).join('');
    const meter = m ? m.meter : this.meter;
    if (meter.present) s += this.timeXml(meter);
    if (p.staves.length > 1) s += tag('staves', p.staves.length);
    s += clefs.map((c, i) => this.clefXml(c, p.staves.length > 1 ? i + 1 : undefined)).join('');
    p.staves.forEach((n, i) => {
      const lines = this.state.get(n)?.lines ?? 5;
      if (lines !== 5) s += `<staff-details${attrs({ number: p.staves.length > 1 ? i + 1 : undefined })}>${tag('staff-lines', lines)}</staff-details>`;
    });
    if (trans.some((t) => t.semi)) {
      const same = trans.every((t) => t.semi === trans[0].semi && t.diat === trans[0].diat);
      s += same ? this.transposeXml(trans[0]) : trans.map((t, i) => (t.semi ? this.transposeXml(t, i + 1) : '')).join('');
    }
    return s + '</attributes>';
  }

  private changeAttributes(pi: number, m: Measure): string {
    const p = this.parts[pi];
    const multi = p.staves.length > 1;
    let s = '';
    const keyChanged = p.staves.filter((n) => m.keyChanges.has(n));
    if (keyChanged.length) {
      const keys = p.staves.map((n) => m.keys[n]);
      const sameKey = keys.every((k) => k.fifths === keys[0].fifths && k.mode === keys[0].mode);
      s += sameKey ? this.keyXml(keys[0]) : p.staves.map((n, i) => (m.keyChanges.has(n) ? this.keyXml(m.keys[n], i + 1) : '')).join('');
    }
    if (m.timeChange) s += this.timeXml(m.meter);
    s += p.staves.map((n, i) => (m.clefChanges.has(n) ? this.clefXml(m.clefs[n], multi ? i + 1 : undefined) : '')).join('');
    s += p.staves.map((n, i) => (m.transChanges.has(n) ? this.transposeXml(m.trans[n], multi ? i + 1 : undefined) : '')).join('');
    return s ? `<attributes>${s}</attributes>` : '';
  }

  private barlines(m: Measure, side: 'left' | 'right'): string {
    if (side === 'left') {
      if (!m.leftRepeat && !m.endingStart) return '';
      let s = '<barline location="left">';
      if (m.leftRepeat) s += tag('bar-style', 'heavy-light');
      if (m.endingStart) s += textTag('ending', m.endingStart.text, { number: m.endingStart.number, type: 'start' });
      if (m.leftRepeat) s += tag('repeat', null, { direction: 'forward' });
      return s + '</barline>';
    }
    const right = m.el.getAttribute('right') || '';
    const styles: Record<string, string> = {
      dbl: 'light-light', end: 'light-heavy', rptend: 'light-heavy', rptboth: 'light-heavy', invis: 'none', dashed: 'dashed',
      dotted: 'dotted', heavy: 'heavy', dbldashed: 'dashed', dbldotted: 'dotted', dblheavy: 'heavy-heavy', dblsegno: 'light-light',
    };
    const style = styles[right] || '';
    const backward = right === 'rptend' || right === 'rptboth';
    if (!style && !m.endingStop) return '';
    let s = '<barline location="right">';
    if (style) s += tag('bar-style', style);
    if (m.endingStop) s += tag('ending', null, { number: m.endingStop.number, type: m.endingStop.type });
    if (backward) s += tag('repeat', null, { direction: 'backward' });
    return s + '</barline>';
  }

  private measureXml(m: Measure, pi: number): string {
    const p = this.parts[pi];
    const out: string[] = [];
    const implicit = m.el.getAttribute('metcon') === 'false' ? 'yes' : undefined;
    out.push(`<measure${attrs({ number: m.number, implicit })}>`);
    if (m.brk === 'page') out.push('<print new-page="yes"/>');
    else if (m.brk === 'system') out.push('<print new-system="yes"/>');
    out.push(this.barlines(m, 'left'));
    if (m.idx === 0) out.push(this.firstAttributes(pi, m));
    else out.push(this.changeAttributes(pi, m));
    if (m.idx === 0 && pi === 0 && this.initialTempo && !descendants(m.el, 'tempo').length) {
      out.push(tag('sound', null, { tempo: this.initialTempo }));
    }

    const pending = (this.at.get(m.idx) || []).filter((x) => this.staffPart.get(x.staffN)?.part === pi);
    let streams = m.streams.filter((s) => this.staffPart.get(s.staffN)?.part === pi);
    // every staff of the part gets a stream so its positioned directions have a home
    for (const n of p.staves) if (!streams.some((s) => s.staffN === n)) streams.push({ staffN: n, layerN: '1', events: [] });
    streams.sort((a, b) => p.staves.indexOf(a.staffN) - p.staves.indexOf(b.staffN) || Number(a.layerN) - Number(b.layerN));
    // extra layers holding only invisible space (the editor's empty voice 2) are left out
    streams = streams.filter((s, i) => streams.findIndex((x) => x.staffN === s.staffN) === i || s.events.some((e) => e.kind !== 'space'));
    const used = new Set<object>();
    streams.forEach((s, si) => {
      const firstOfStaff = streams.findIndex((x) => x.staffN === s.staffN) === si;
      const mine = pending.filter((x) => x.staffN === s.staffN && !used.has(x) && (x.layerN ? x.layerN === s.layerN || (firstOfStaff && !streams.some((y) => y.staffN === s.staffN && y.layerN === x.layerN)) : firstOfStaff));
      for (const x of mine) used.add(x);
      mine.sort((a, b) => a.pos - b.pos);
      const cursor = this.streamXml(s, m, pi, mine, out);
      if (si < streams.length - 1 && cursor > 0) out.push(`<backup>${tag('duration', cursor)}</backup>`);
    });
    out.push(this.barlines(m, 'right'));
    out.push('</measure>');
    return out.filter(Boolean).join('\n');
  }

  private staffIdx(staffN: string, pi: number): number | undefined {
    return this.parts[pi].staves.length > 1 ? this.staffPart.get(staffN)?.idx : undefined;
  }

  private voiceOf(s: Stream, pi: number): number {
    const idx = (this.staffPart.get(s.staffN)?.idx || 1) - 1;
    let v = Number(s.layerN) || 1;
    if (idx > 0 && v <= 4 * idx) v += 4 * idx;
    void pi;
    return v;
  }

  private directiveXml(d: Directive, pi: number, offset: number): string {
    const staff = this.staffIdx(d.staffN, pi);
    const off = offset ? tag('offset', offset) : '';
    const st = staff ? tag('staff', staff) : '';
    if (d.kind === 'harmony') return `<harmony${attrs({ placement: d.placement })}>${d.types[0]}${off}${st}</harmony>`;
    const types = d.types.map((t) => `<direction-type>${t}</direction-type>`).join('');
    return `<direction${attrs({ placement: d.placement })}>${types}${off}${st}${d.sound}</direction>`;
  }

  /** Writes one layer; returns the cursor (in divisions) at its end. */
  private streamXml(s: Stream, m: Measure, pi: number, positioned: { pos: number; d: Directive }[], out: string[]): number {
    const voice = this.voiceOf(s, pi);
    const staff = this.staffIdx(s.staffN, pi);
    let cursor = 0;
    let qi = 0;
    // marks at the very end of the bar (e.g. "Fine" at beat 3.999) are written after the last note
    const atEnd = m.cap - 0.01;
    const flushUntil = (limit: number, evStart: number) => {
      while (qi < positioned.length && positioned[qi].pos < limit - EPS && positioned[qi].pos < atEnd) {
        const x = positioned[qi++];
        out.push(this.directiveXml(x.d, pi, this.divs(x.pos) - this.divs(evStart)));
      }
    };
    for (const e of s.events) {
      if (e.kind === 'clef' || e.kind === 'key' || e.kind === 'meter') {
        let inner = '';
        if (e.kind === 'clef' && e.clef) inner = this.clefXml(e.clef, staff);
        if (e.kind === 'key' && e.key) inner = this.keyXml(e.key, staff);
        if (e.kind === 'meter' && e.meter) inner = this.timeXml(e.meter);
        if (inner) out.push(`<attributes>${inner}</attributes>`);
        continue;
      }
      if (!e.grace && e.dur > 0) flushUntil(e.start + e.dur, e.start);
      for (const d of this.before.get(e.el) || []) out.push(this.directiveXml(d, pi, 0));
      if (e.kind === 'space' || (e.kind === 'mrest' && e.el.localName !== 'mRest' && e.el.localName !== 'multiRest')) {
        const d = this.divs(e.start + e.dur) - cursor;
        if (d > 0) out.push(`<forward>${tag('duration', d)}${tag('voice', voice)}${staff ? tag('staff', staff) : ''}</forward>`);
        cursor += Math.max(0, d);
      } else {
        const d = e.grace ? 0 : this.divs(e.start + e.dur) - this.divs(e.start);
        out.push(this.eventXml(e, d, voice, staff, m));
        cursor += d;
      }
      for (const d of this.after.get(e.el) || []) out.push(this.directiveXml(d, pi, 0));
    }
    while (qi < positioned.length) {
      const x = positioned[qi++];
      out.push(this.directiveXml(x.d, pi, x.pos >= atEnd ? 0 : this.divs(x.pos) - cursor));
    }
    return cursor;
  }

  private eventXml(e: Ev, duration: number, voice: number, staff: number | undefined, m: Measure): string {
    const el = e.el;
    if (e.kind === 'rest' || e.kind === 'mrest') {
      return this.noteXml(e, null, false, duration, voice, staff, m);
    }
    const notes = this.notesOf(e);
    if (!notes.length) return this.noteXml(e, null, false, duration, voice, staff, m);
    void el;
    return notes.map((n, i) => this.noteXml(e, n, i > 0, duration, voice, staff, m)).join('\n');
  }

  private noteXml(e: Ev, n: Element | null, chordFollower: boolean, duration: number, voice: number, staff: number | undefined, m: Measure): string {
    const el = e.el;
    const isRest = !n;
    const visible = (n?.getAttribute('visible') ?? el.getAttribute('visible')) !== 'false' && el.getAttribute('visible') !== 'false';
    let s = `<note${attrs({ 'print-object': visible ? undefined : 'no' })}>`;
    if (e.grace) s += tag('grace', null, { slash: e.grace === 'unacc' ? 'yes' : undefined });
    else if (e.cue || n?.getAttribute('cue') === 'true') s += '<cue/>';
    if (chordFollower) s += '<chord/>';
    if (isRest) {
      const ploc = el.getAttribute('ploc');
      const oloc = el.getAttribute('oloc');
      const inner = ploc && oloc ? `${tag('display-step', ploc.toUpperCase())}${tag('display-octave', oloc)}` : '';
      s += tag('rest', inner || null, { measure: e.kind === 'mrest' ? 'yes' : undefined });
    } else {
      const pname = (n!.getAttribute('pname.ges') || n!.getAttribute('pname') || 'c').toLowerCase();
      const shift = this.octShift.get(n!);
      let oct = Number(n!.getAttribute('oct') || 4);
      if (shift) oct = n!.hasAttribute('oct.ges') ? Number(n!.getAttribute('oct.ges')) : oct + shift;
      const perc = (m.clefs[e.staffN]?.shape || '') === 'perc';
      if (perc) {
        s += `<unpitched>${tag('display-step', pname.toUpperCase())}${tag('display-octave', oct)}</unpitched>`;
      } else {
        const alter = this.alters.get(n!) ?? 0;
        s += `<pitch>${tag('step', pname.toUpperCase())}${alter ? tag('alter', alter) : ''}${tag('octave', oct)}</pitch>`;
      }
    }
    if (!e.grace) s += tag('duration', duration);
    if (n && !(e.cue || n.getAttribute('cue') === 'true')) {
      const nt = this.notations.get(n);
      if (nt) {
        if (nt.tiedStop.length) s += '<tie type="stop"/>';
        if (nt.tiedStart.some((t) => t.includes('"start"'))) s += '<tie type="start"/>';
      }
    }
    s += tag('voice', voice);
    if (e.kind !== 'mrest' && TYPE_NAMES[e.durText]) {
      s += tag('type', TYPE_NAMES[e.durText], { size: e.cue && !e.grace ? 'cue' : undefined });
      s += '<dot/>'.repeat(Math.max(0, Math.min(4, e.dots)));
    }
    if (n) {
      const accEl = child(n, 'accid');
      const written = n.getAttribute('accid') || accEl?.getAttribute('accid') || '';
      if (written && ACCIDENTAL_NAMES[written]) {
        const caution = n.getAttribute('data-caution') === 'true' || accEl?.getAttribute('func') === 'caution';
        const enclose = accEl?.getAttribute('enclose') || n.getAttribute('enclose') || '';
        s += textTag('accidental', ACCIDENTAL_NAMES[written], {
          cautionary: caution ? 'yes' : undefined,
          parentheses: enclose === 'paren' ? 'yes' : undefined,
          bracket: enclose === 'brack' ? 'yes' : undefined,
        });
      }
    }
    if (e.actual !== e.normal) s += `<time-modification>${tag('actual-notes', e.actual)}${tag('normal-notes', e.normal)}</time-modification>`;
    if (n) {
      const stem = n.getAttribute('stem.dir') || el.getAttribute('stem.dir');
      const stemHidden = n.getAttribute('stem.visible') === 'false' || el.getAttribute('stem.visible') === 'false';
      if (stemHidden) s += tag('stem', 'none');
      else if (stem === 'up' || stem === 'down') s += tag('stem', stem);
      const head = n.getAttribute('head.shape') || el.getAttribute('head.shape') || '';
      if (HEADS[head]) s += tag('notehead', HEADS[head]);
    }
    if (staff) s += tag('staff', staff);
    if (!chordFollower && e.beams.length) s += e.beams.map((b, i) => tag('beam', b, { number: i + 1 })).join('');
    s += this.notationsXml(e, n, chordFollower);
    if (!chordFollower) s += this.lyricsXml(n || el);
    return s + '</note>';
  }

  private notationsXml(e: Ev, n: Element | null, chordFollower: boolean): string {
    const parts: string[] = [];
    const sources: Notations[] = [];
    if (n) {
      const a = this.notations.get(n);
      if (a) sources.push(a);
    }
    if (!chordFollower && (e.kind === 'chord' || !n)) {
      const b = this.notations.get(e.el);
      if (b) sources.push(b);
    }
    const take = (k: keyof Notations) => sources.flatMap((x) => x[k]);
    parts.push(...take('tiedStop'), ...take('tiedStart'), ...take('slurStop'), ...take('slurStart'));
    if (!chordFollower) {
      for (const t of e.tuplets.filter((x) => x.type === 'stop')) parts.push(tag('tuplet', null, { type: 'stop', number: t.number }));
      for (const t of e.tuplets.filter((x) => x.type === 'start')) {
        const bracket = t.el.getAttribute('bracket.visible');
        const numVis = t.el.getAttribute('num.visible');
        const format = t.el.getAttribute('num.format');
        parts.push(tag('tuplet', null, {
          type: 'start',
          number: t.number,
          bracket: bracket === 'false' ? 'no' : bracket === 'true' ? 'yes' : undefined,
          'show-number': numVis === 'false' ? 'none' : format === 'ratio' ? 'both' : undefined,
          placement: t.el.getAttribute('num.place') === 'below' || t.el.getAttribute('bracket.place') === 'below' ? 'below' : undefined,
        }));
      }
    }
    parts.push(...take('other'));
    const orn = take('ornaments');
    if (!chordFollower && e.trem) orn.push(textTag('tremolo', String(e.trem.marks), { type: e.trem.type }));
    if (orn.length) parts.push(`<ornaments>${orn.join('')}</ornaments>`);
    const tech = take('technical');
    if (tech.length) parts.push(`<technical>${tech.join('')}</technical>`);
    const art = take('articulations');
    if (art.length) parts.push(`<articulations>${art.join('')}</articulations>`);
    parts.push(...take('fermatas').slice(0, 2), ...take('arpeggiate').slice(0, 1));
    return parts.length ? `<notations>${parts.join('')}</notations>` : '';
  }

  private lyricsXml(host: Element): string {
    const verses = this.lyricsOn.get(host);
    if (!verses) return '';
    let s = '';
    const done = new Set<string>();
    for (const v of verses) {
      const number = v.localName === 'verse' ? v.getAttribute('n') || '1' : '1';
      if (done.has(number)) continue;
      const syls = children(v, 'syl');
      if (!syls.length) continue;
      let body = '';
      let extend = false;
      syls.forEach((syl, i) => {
        const text = textOf(syl);
        const wp = syl.getAttribute('wordpos') || '';
        const syllabic = wp === 'i' ? 'begin' : wp === 'm' ? 'middle' : wp === 't' ? 'end' : 'single';
        if (i > 0) body += '<elision/>';
        body += tag('syllabic', syllabic) + textTag('text', text);
        if (syl.getAttribute('con') === 'u') extend = true;
      });
      if (!syls.some((x) => textOf(x))) {
        if (!extend) continue;
        body = '';
      }
      done.add(number);
      const place = v.getAttribute('place');
      s += `<lyric${attrs({ number, placement: place === 'above' || place === 'below' ? place : undefined })}>${body}${extend ? '<extend/>' : ''}</lyric>`;
    }
    return s;
  }
}

// ---------- chord symbols ----------

const KINDS: [RegExp, string][] = [
  [/^(maj7|ma7|M7|Δ7?|j7)$/, 'major-seventh'],
  [/^(maj9|ma9|M9|Δ9)$/, 'major-ninth'],
  [/^(maj11|M11)$/, 'major-11th'],
  [/^(maj13|M13|Δ13)$/, 'major-13th'],
  [/^(m|min|mi|-)$/, 'minor'],
  [/^(m7|min7|mi7|-7)$/, 'minor-seventh'],
  [/^(m9|min9|mi9|-9)$/, 'minor-ninth'],
  [/^(m11|min11|-11)$/, 'minor-11th'],
  [/^(m13|min13|-13)$/, 'minor-13th'],
  [/^(m6|min6|-6)$/, 'minor-sixth'],
  [/^(m\(?maj7\)?|mM7|m\(M7\)|-\(?maj7\)?|-Δ7?|mΔ7?)$/, 'major-minor'],
  [/^(m7b5|m7♭5|min7b5|-7b5|ø7?|m7\(b5\))$/, 'half-diminished'],
  [/^(dim7|°7|o7)$/, 'diminished-seventh'],
  [/^(dim|°|o)$/, 'diminished'],
  [/^(aug7|\+7|7#5|7♯5|7\+5)$/, 'augmented-seventh'],
  [/^(aug|\+|#5|♯5)$/, 'augmented'],
  [/^(7)$/, 'dominant'],
  [/^(9)$/, 'dominant-ninth'],
  [/^(11)$/, 'dominant-11th'],
  [/^(13)$/, 'dominant-13th'],
  [/^(6|maj6|M6)$/, 'major-sixth'],
  [/^(sus4|sus)$/, 'suspended-fourth'],
  [/^(sus2)$/, 'suspended-second'],
  [/^(5)$/, 'power'],
  [/^(maj|M|ma|)$/, 'major'],
];

function stepAlter(acc: string): number {
  let a = 0;
  for (const ch of acc) {
    if (ch === '#' || ch === '♯') a += 1;
    else if (ch === 'b' || ch === '♭') a -= 1;
    else if (ch === '𝄪' || ch === 'x') a += 2;
    else if (ch === '𝄫') a -= 2;
  }
  return a;
}

/** Inner XML of a <harmony> element for a chord-symbol text like "F#m7b5" or "Bb/D". */
export function harmonyXml(text: string): string {
  const t = text.trim();
  const m = /^([A-Ga-g])([#♯b♭𝄪𝄫]?)(.*?)(?:\s*\/\s*([A-Ga-g])([#♯b♭𝄪𝄫]?))?$/u.exec(t);
  // "N.C." and other unparsable text: an empty-text root and kind "none", as the MusicXML spec suggests
  if (!m) return `<root><root-step text="">C</root-step></root>${textTag('kind', 'none', { text: t })}`;
  const [, step, acc, rest, bassStep, bassAcc] = m;
  const suffix = rest.trim();
  let kind = '';
  for (const [re, k] of KINDS) if (re.test(suffix)) {
    kind = k;
    break;
  }
  if (!kind) {
    // longest known prefix (e.g. "7(#9)" → dominant, "maj7#11" → major-seventh)
    for (let i = suffix.length - 1; i > 0 && !kind; i--) {
      const head = suffix.slice(0, i).replace(/[(\s]+$/, '');
      for (const [re, k] of KINDS) if (head && re.test(head)) {
        kind = k;
        break;
      }
    }
  }
  if (!kind) kind = suffix ? 'other' : 'major';
  const alter = stepAlter(acc);
  let s = `<root>${tag('root-step', step.toUpperCase())}${alter ? tag('root-alter', alter) : ''}</root>`;
  s += textTag('kind', kind, { text: suffix });
  if (bassStep) {
    const ba = stepAlter(bassAcc || '');
    s += `<bass>${tag('bass-step', bassStep.toUpperCase())}${ba ? tag('bass-alter', ba) : ''}</bass>`;
  }
  return s;
}
