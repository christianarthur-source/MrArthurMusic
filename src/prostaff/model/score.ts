import {
  MEI_NS, WHOLE, ACCID_TO_ALTER, alterToAccid, ancestor, child, children, descendants, durToTicks, el, ensureIds,
  eventTicks, getId, keyAlter, keySigString, parseKeySig, parseXml, serialize, splitTicks,
} from './mei';
import { INSTRUMENTS, InstrumentDef, instrumentById, writtenFifths } from './instruments';

export interface MeasureContext {
  count: number;
  unit: number;
  keys: Record<string, number>; // staff n -> fifths (written)
}

export interface StaffInfo {
  n: string;
  label: string;
  abbr: string;
  instrumentId: string;
  program: number;
  semi: number;
  clefShape: string;
  partIndex: number; // staves of one instrument (a piano) share a part index
  partName: string;
}

export const LEAF_EVENTS = new Set(['note', 'chord', 'rest', 'space', 'mRest', 'mSpace', 'multiRest']);
export const ZERO_ITEMS = new Set(['clef', 'keySig', 'meterSig', 'barLine', 'custos', 'graceGrp', 'annot']);

export class Score {
  doc: Document;
  private ctxCache: Map<Element, MeasureContext> | null = null;
  private measureCache: Element[] | null = null;

  constructor(doc: Document) {
    this.doc = doc;
    ensureIds(this.root);
  }

  static fromMei(text: string) {
    return new Score(parseXml(text));
  }

  get root() {
    return this.doc.documentElement;
  }

  clone() {
    return Score.fromMei(this.toString());
  }

  toString() {
    return serialize(this.doc);
  }

  private idIndex: Map<string, Element> | null = null;

  invalidate() {
    this.ctxCache = null;
    this.measureCache = null;
    this.idIndex = null;
  }

  // ---------- structure ----------

  get scoreEl(): Element {
    return descendants(this.doc, 'score')[0];
  }
  get mainScoreDef(): Element {
    return child(this.scoreEl, 'scoreDef') || descendants(this.scoreEl, 'scoreDef')[0];
  }
  get section(): Element {
    return child(this.scoreEl, 'section') || descendants(this.scoreEl, 'section')[0];
  }

  measures(): Element[] {
    if (!this.measureCache) this.measureCache = descendants(this.scoreEl, 'measure');
    return this.measureCache;
  }

  byId(id: string): Element | null {
    if (!id) return null;
    // getElementById does not know about xml:id in XML documents, so keep an index.
    const hit = this.idIndex?.get(id);
    if (hit && hit.isConnected && getId(hit) === id) return hit;
    this.idIndex = new Map();
    const all = this.doc.getElementsByTagNameNS(MEI_NS, '*');
    for (let i = 0; i < all.length; i++) this.idIndex.set(getId(all[i]), all[i]);
    return this.idIndex.get(id) || null;
  }

  staffDefs(): Element[] {
    return descendants(this.mainScoreDef, 'staffDef');
  }

  staves(): StaffInfo[] {
    const out: StaffInfo[] = [];
    let partIndex = -1;
    let lastGroup: Element | null = null;
    for (const sd of this.staffDefs()) {
      const grp = sd.parentElement;
      const groupLabel = grp && grp.localName === 'staffGrp' ? child(grp, 'label')?.textContent?.trim() : '';
      const ownLabel = child(sd, 'label')?.textContent?.trim() || sd.getAttribute('label') || '';
      const isGroupPart = !!groupLabel && !ownLabel && children(grp!, 'staffDef').length > 1;
      if (!(isGroupPart && grp === lastGroup)) partIndex++;
      lastGroup = isGroupPart ? grp : null;
      const type = sd.getAttribute('type') || '';
      const instrumentId = type.startsWith('ps:') ? type.slice(3) : '';
      const instrDef = descendants(sd, 'instrDef')[0] || (grp ? child(grp, 'instrDef') : null);
      const program = Number(instrDef?.getAttribute('midi.instrnum') ?? (instrumentId ? instrumentById(instrumentId).program : 0)) || 0;
      out.push({
        n: sd.getAttribute('n') || String(out.length + 1),
        label: ownLabel || groupLabel || '',
        abbr: child(sd, 'labelAbbr')?.textContent?.trim() || '',
        instrumentId,
        program,
        semi: Number(sd.getAttribute('trans.semi') || 0),
        clefShape: sd.getAttribute('clef.shape') || child(sd, 'clef')?.getAttribute('shape') || 'G',
        partIndex,
        partName: ownLabel || groupLabel || `Staff ${out.length + 1}`,
      });
    }
    return out;
  }

  // ---------- metadata ----------

  private titleStmt(): Element {
    let head = descendants(this.doc, 'meiHead')[0];
    if (!head) {
      head = el(this.doc, 'meiHead');
      this.root.insertBefore(head, this.root.firstChild);
    }
    let fileDesc = child(head, 'fileDesc');
    if (!fileDesc) fileDesc = head.appendChild(el(this.doc, 'fileDesc'));
    let ts = child(fileDesc, 'titleStmt');
    if (!ts) ts = fileDesc.insertBefore(el(this.doc, 'titleStmt'), fileDesc.firstChild);
    if (!child(fileDesc, 'pubStmt')) fileDesc.appendChild(el(this.doc, 'pubStmt'));
    return ts;
  }

  getMeta() {
    const ts = this.titleStmt();
    const titles = children(ts, 'title');
    const main = titles.find((t) => (t.getAttribute('type') || 'main') === 'main' && t.textContent?.trim()) || titles[0];
    const sub = titles.find((t) => t.getAttribute('type') === 'subordinate');
    const pers = (role: string) =>
      descendants(ts, 'persName').find((p) => (p.getAttribute('role') || '').toLowerCase() === role)?.textContent?.trim() ||
      descendants(ts, role)[0]?.textContent?.trim() || '';
    return {
      title: main?.textContent?.trim() || '',
      subtitle: sub?.textContent?.trim() || '',
      composer: pers('composer'),
      lyricist: pers('lyricist'),
      arranger: pers('arranger'),
    };
  }

  setMeta(meta: Partial<ReturnType<Score['getMeta']>>) {
    const ts = this.titleStmt();
    const setTitle = (type: string, value: string | undefined) => {
      if (value === undefined) return;
      let t = children(ts, 'title').find((x) => (x.getAttribute('type') || 'main') === type);
      if (!t && type === 'main') t = children(ts, 'title').find((x) => !x.getAttribute('type'));
      if (!value) {
        if (t && type !== 'main') t.remove();
        else if (t) t.textContent = '';
        return;
      }
      if (!t) {
        t = el(this.doc, 'title', { type });
        const firstNonTitle = children(ts).find((x) => x.localName !== 'title');
        ts.insertBefore(t, firstNonTitle || null);
      }
      t.textContent = value;
    };
    setTitle('main', meta.title);
    setTitle('subordinate', meta.subtitle);
    let resp = child(ts, 'respStmt');
    for (const role of ['composer', 'lyricist', 'arranger'] as const) {
      const value = meta[role];
      if (value === undefined) continue;
      let p = descendants(ts, 'persName').find((x) => x.getAttribute('role') === role);
      if (!value) {
        p?.remove();
        continue;
      }
      if (!p) {
        if (!resp) resp = ts.appendChild(el(this.doc, 'respStmt'));
        p = resp.appendChild(el(this.doc, 'persName', { role }));
      }
      p.textContent = value;
    }
    // Verovio prints the page header from <pgHead> when one exists; drop imported headers so the edited
    // title/composer show.
    for (const h of descendants(this.mainScoreDef, 'pgHead')) h.remove();
  }

  // ---------- context: meter and key per measure ----------

  contextOf(measure: Element): MeasureContext {
    if (!this.ctxCache) this.computeContexts();
    return this.ctxCache!.get(measure) || { count: 4, unit: 4, keys: {} };
  }

  private computeContexts() {
    const map = new Map<Element, MeasureContext>();
    let cur: MeasureContext = { count: 4, unit: 4, keys: {} };
    const applyDef = (def: Element, staffN?: string) => {
      const mc = def.getAttribute('meter.count');
      const mu = def.getAttribute('meter.unit');
      const ms = children(def, 'meterSig')[0];
      if (mc || ms) {
        const count = mc || ms?.getAttribute('count') || '4';
        cur.count = count.split('+').reduce((a, b) => a + Number(b || 0), 0) || 4;
        cur.unit = Number(mu || ms?.getAttribute('unit') || 4);
      }
      const ks = def.getAttribute('key.sig') ?? def.getAttribute('keysig') ?? children(def, 'keySig')[0]?.getAttribute('sig') ?? null;
      if (ks !== null) {
        const f = parseKeySig(ks);
        if (staffN) cur.keys[staffN] = f;
        else for (const sd of this.staffDefs()) cur.keys[sd.getAttribute('n') || ''] = f;
      }
    };
    const visit = (node: Element) => {
      for (let c = node.firstElementChild; c; c = c.nextElementSibling) {
        const name = c.localName;
        if (name === 'scoreDef') {
          cur = { ...cur, keys: { ...cur.keys } };
          applyDef(c);
          for (const sd of descendants(c, 'staffDef')) applyDef(sd, sd.getAttribute('n') || '');
        } else if (name === 'staffDef') {
          cur = { ...cur, keys: { ...cur.keys } };
          applyDef(c, c.getAttribute('n') || '');
        } else if (name === 'measure') {
          map.set(c, cur);
          // key changes inside a layer apply from the next measure on
          for (const ks of descendants(c, 'keySig')) {
            const staff = ancestor(ks, 'staff');
            if (!staff) continue;
            cur = { ...cur, keys: { ...cur.keys, [staff.getAttribute('n') || '']: parseKeySig(ks.getAttribute('sig')) } };
          }
        } else if (name === 'section' || name === 'ending' || name === 'lem' || name === 'rdg' || name === 'app' || name === 'choice') {
          visit(c);
        }
      }
    };
    const score = this.scoreEl;
    const first = this.mainScoreDef;
    if (first) {
      applyDef(first);
      for (const sd of descendants(first, 'staffDef')) applyDef(sd, sd.getAttribute('n') || '');
    }
    for (let c = score.firstElementChild; c; c = c.nextElementSibling) {
      if (c === first) continue;
      if (c.localName === 'section') visit(c);
      else if (c.localName === 'scoreDef') {
        cur = { ...cur, keys: { ...cur.keys } };
        applyDef(c);
      }
    }
    this.ctxCache = map;
  }

  capacity(measure: Element): number {
    if (measure.getAttribute('metcon') === 'false') {
      let max = 0;
      for (const layer of descendants(measure, 'layer')) max = Math.max(max, this.containerTicks(layer));
      return max || WHOLE / 4;
    }
    const ctx = this.contextOf(measure);
    return ctx.count * (WHOLE / ctx.unit);
  }

  // ---------- layers and items ----------

  staffEl(measure: Element, n: string): Element | null {
    return children(measure, 'staff').find((s) => (s.getAttribute('n') || '1') === n) || null;
  }

  layerEl(measure: Element, staffN: string, layerN: string, create = false): Element | null {
    let staff = this.staffEl(measure, staffN);
    if (!staff) {
      if (!create) return null;
      staff = el(this.doc, 'staff', { n: staffN });
      const after = children(measure, 'staff').find((s) => Number(s.getAttribute('n')) > Number(staffN));
      measure.insertBefore(staff, after || children(measure).find((c) => c.localName !== 'staff') || null);
    }
    let layer = children(staff, 'layer').find((l) => (l.getAttribute('n') || '1') === layerN) || null;
    if (!layer && create) {
      layer = el(this.doc, 'layer', { n: layerN });
      const after = children(staff, 'layer').find((l) => Number(l.getAttribute('n')) > Number(layerN));
      staff.insertBefore(layer, after || null);
      layer.appendChild(el(this.doc, 'mSpace'));
    }
    return layer;
  }

  /** Nominal duration of a top-level item in a container (layer or tuplet). */
  itemTicks(item: Element, measure?: Element): number {
    switch (item.localName) {
      case 'note':
      case 'chord':
      case 'rest':
      case 'space':
        return eventTicks(item);
      case 'mRest':
      case 'mSpace':
        return measure ? this.capacity(measure) : 0;
      case 'multiRest':
        return measure ? this.capacity(measure) : 0;
      case 'beam':
      case 'graceGrp':
        return item.localName === 'graceGrp' ? 0 : children(item).reduce((a, c) => a + this.itemTicks(c, measure), 0);
      case 'tuplet': {
        const num = Number(item.getAttribute('num') || 3);
        const numbase = Number(item.getAttribute('numbase') || 2);
        const inner = children(item).reduce((a, c) => a + this.itemTicks(c, measure), 0);
        return (inner * numbase) / num;
      }
      case 'bTrem':
      case 'fTrem': {
        const first = children(item)[0];
        const t = first ? this.itemTicks(first, measure) : 0;
        return item.localName === 'fTrem' ? t * 2 : t;
      }
      case 'beatRpt':
        return durToTicks(item.getAttribute('beatdef') ? null : '4');
      default:
        return 0;
    }
  }

  containerTicks(container: Element): number {
    const measure = ancestor(container, 'measure') || undefined;
    return children(container).reduce((a, c) => a + this.itemTicks(c, measure), 0);
  }

  /** Capacity of an editable container: a layer's measure length, or a tuplet's inner span. */
  containerCapacity(container: Element): number {
    if (container.localName === 'tuplet') return children(container).reduce((a, c) => a + this.itemTicks(c), 0);
    const measure = ancestor(container, 'measure')!;
    return this.capacity(measure);
  }

  /** Removes <beam> wrappers (keeps their children) so a container's items are flat. */
  unbeam(container: Element) {
    for (const b of children(container)) {
      if (b.localName === 'beam' || b.localName === 'beamSpan') {
        while (b.firstChild) container.insertBefore(b.firstChild, b);
        b.remove();
      } else if (b.localName === 'tuplet') this.unbeam(b);
    }
    // nested beams that were inside beams
    if (children(container).some((c) => c.localName === 'beam')) this.unbeam(container);
  }

  /** Turns whole-measure rests into regular rests so the layer can be edited. */
  expandMeasureRests(layer: Element) {
    const measure = ancestor(layer, 'measure')!;
    for (const c of children(layer)) {
      if (c.localName === 'mRest' || c.localName === 'mSpace' || c.localName === 'multiRest') {
        const ticks = this.capacity(measure);
        const kind = c.localName === 'mSpace' ? 'space' : 'rest';
        const parts = ticks === WHOLE * 0.75 ? [{ dur: '2', dots: 1 }] : splitTicks(ticks);
        for (const p of parts) layer.insertBefore(el(this.doc, kind, { dur: p.dur, dots: p.dots || undefined }), c);
        c.remove();
      }
    }
  }

  /** Puts whole-measure rests back when a layer holds nothing but rests. */
  collapseMeasureRests(layer: Element) {
    const items = children(layer);
    if (!items.length) {
      layer.appendChild(el(this.doc, layer.getAttribute('n') === '1' ? 'mRest' : 'mSpace'));
      return;
    }
    const allRest = items.every((c) => c.localName === 'rest' && !c.getAttribute('visible'));
    const allSpace = items.every((c) => c.localName === 'space');
    if (!allRest && !allSpace) return;
    const measure = ancestor(layer, 'measure')!;
    if (measure.getAttribute('metcon') === 'false') return;
    const refs = this.referencedIds(measure);
    if (items.some((c) => refs.has(getId(c)))) return;
    for (const c of items) c.remove();
    layer.appendChild(el(this.doc, allRest ? 'mRest' : 'mSpace'));
  }

  referencedIds(scope: Element): Set<string> {
    const out = new Set<string>();
    const walk = (e: Element) => {
      for (const a of ['startid', 'endid']) {
        const v = e.getAttribute(a);
        if (v) out.add(v.replace(/^#/, ''));
      }
      const plist = e.getAttribute('plist');
      if (plist) for (const p of plist.split(/\s+/)) out.add(p.replace(/^#/, ''));
      for (let c = e.firstElementChild; c; c = c.nextElementSibling) walk(c);
    };
    walk(scope);
    return out;
  }

  // ---------- beaming ----------

  /** Re-beams a layer by beat: eighth notes and shorter in the same beat group are joined. */
  rebeam(layer: Element) {
    this.unbeam(layer);
    const measure = ancestor(layer, 'measure')!;
    const ctx = this.contextOf(measure);
    const compound = ctx.unit === 8 && ctx.count % 3 === 0 && ctx.count > 3;
    let group = compound ? (WHOLE / 8) * 3 : WHOLE / ctx.unit;
    if (ctx.unit === 8 && !compound) group = WHOLE / 4;
    if (ctx.unit === 2 || ctx.unit === 1) group = WHOLE / 2;
    if (ctx.count === 4 && ctx.unit === 4 && this.allEighths(layer)) group = WHOLE / 2;
    this.beamContainer(layer, group, 0);
  }

  private allEighths(layer: Element) {
    const items = children(layer);
    return items.length > 0 && items.every((c) => (c.localName === 'note' || c.localName === 'chord') && c.getAttribute('dur') === '8' && !c.getAttribute('dots'));
  }

  private beamable(e: Element) {
    if (e.localName !== 'note' && e.localName !== 'chord') return false;
    if (e.getAttribute('grace')) return false;
    const d = Number(e.getAttribute('dur') || 0);
    return d >= 8;
  }

  private beamContainer(container: Element, group: number, startTick: number) {
    let t = startTick;
    let run: Element[] = [];
    let runGroup = -1;
    const flush = () => {
      if (run.length >= 2) {
        const beam = el(this.doc, 'beam');
        container.insertBefore(beam, run[0]);
        for (const r of run) beam.appendChild(r);
      }
      run = [];
      runGroup = -1;
    };
    for (const item of children(container)) {
      const ticks = this.itemTicks(item);
      if (item.localName === 'tuplet') {
        flush();
        const inner = children(item);
        if (inner.length >= 2 && inner.every((c) => this.beamable(c))) {
          const beam = el(this.doc, 'beam');
          item.insertBefore(beam, inner[0]);
          for (const r of inner) beam.appendChild(r);
        }
      } else if (this.beamable(item)) {
        const g = Math.floor((t + 0.0001) / group);
        const endG = Math.floor((t + ticks - 0.0001) / group);
        if (g !== endG) {
          flush();
        } else {
          if (runGroup !== -1 && g !== runGroup) flush();
          run.push(item);
          runGroup = g;
        }
      } else if (ticks > 0 || item.localName === 'rest' || item.localName === 'space') {
        flush();
      }
      t += ticks;
    }
    flush();
  }

  // ---------- accidentals ----------

  static alterOf(note: Element, fallback = 0): number {
    const a = note.getAttribute('accid');
    const g = note.getAttribute('accid.ges');
    const kid = child(note, 'accid');
    const ka = kid?.getAttribute('accid');
    const kg = kid?.getAttribute('accid.ges');
    const v = a ?? ka ?? g ?? kg;
    if (v == null) return fallback;
    return ACCID_TO_ALTER[v] ?? 0;
  }

  /** Re-writes visible accidentals in one staff of a measure from each note's real pitch. */
  respell(measure: Element, staffN: string) {
    const staff = this.staffEl(measure, staffN);
    if (!staff) return;
    const ctx = this.contextOf(measure);
    const fifths = ctx.keys[staffN] ?? 0;
    const timed: { t: number; note: Element }[] = [];
    for (const layer of children(staff, 'layer')) {
      let t = 0;
      const walk = (container: Element, scale: number) => {
        for (const c of children(container)) {
          if (c.localName === 'beam' || c.localName === 'graceGrp') {
            walk(c, scale);
            continue;
          }
          if (c.localName === 'tuplet') {
            const num = Number(c.getAttribute('num') || 3);
            const nb = Number(c.getAttribute('numbase') || 2);
            walk(c, (scale * nb) / num);
            continue;
          }
          if (c.localName === 'note') timed.push({ t, note: c });
          if (c.localName === 'chord') for (const n of children(c, 'note')) timed.push({ t, note: n });
          t += this.itemTicks(c) * scale;
        }
      };
      walk(layer, 1);
    }
    timed.sort((a, b) => a.t - b.t);
    const state = new Map<string, number>();
    for (const { note } of timed) {
      const pname = note.getAttribute('pname');
      const oct = note.getAttribute('oct');
      if (!pname || !oct) continue;
      const key = pname + oct;
      const prev = state.has(key) ? state.get(key)! : keyAlter(fifths, pname);
      const alter = Score.alterOf(note, prev);
      const tiedIn = /^[mt]$/.test(note.getAttribute('tie') || '');
      const cautionary = note.getAttribute('data-caution') === 'true';
      for (const k of children(note, 'accid')) k.remove();
      note.removeAttribute('accid');
      note.removeAttribute('accid.ges');
      if ((alter !== prev && !tiedIn) || cautionary) {
        note.setAttribute('accid', alterToAccid(alter));
      } else {
        note.setAttribute('accid.ges', alter === 0 ? 'n' : alterToAccid(alter) === 'x' ? 'ss' : alterToAccid(alter));
      }
      state.set(key, alter);
    }
  }

  /** Normalizes a layer after an edit. */
  tidyLayer(layer: Element) {
    this.rebeam(layer);
    this.collapseMeasureRests(layer);
    const measure = ancestor(layer, 'measure');
    const staff = ancestor(layer, 'staff');
    if (measure && staff) this.respell(measure, staff.getAttribute('n') || '1');
  }

  // ---------- creation ----------

  static create(opts: {
    title: string;
    subtitle?: string;
    composer?: string;
    instruments: string[];
    keyFifths: number;
    meterCount: number;
    meterUnit: number;
    tempo: number;
    tempoText?: string;
    measures: number;
    pickupTicks?: number;
  }): Score {
    const doc = document.implementation.createDocument(MEI_NS, 'mei', null);
    const mei = doc.documentElement;
    mei.setAttribute('meiversion', '5.1');
    const head = mei.appendChild(el(doc, 'meiHead'));
    const fd = head.appendChild(el(doc, 'fileDesc'));
    fd.appendChild(el(doc, 'titleStmt'));
    fd.appendChild(el(doc, 'pubStmt'));
    const music = mei.appendChild(el(doc, 'music'));
    const score = music.appendChild(el(doc, 'body')).appendChild(el(doc, 'mdiv')).appendChild(el(doc, 'score'));
    const scoreDef = score.appendChild(
      el(doc, 'scoreDef', { 'meter.count': opts.meterCount, 'meter.unit': opts.meterUnit, 'midi.bpm': opts.tempo }),
    );
    if (opts.meterCount === 4 && opts.meterUnit === 4) scoreDef.setAttribute('meter.sym', '');
    scoreDef.removeAttribute('meter.sym');
    const top = scoreDef.appendChild(el(doc, 'staffGrp', { symbol: opts.instruments.length > 1 ? 'bracket' : undefined, 'bar.thru': 'false' }));
    let n = 0;
    const defs: InstrumentDef[] = opts.instruments.map(instrumentById);
    const counts: Record<string, number> = {};
    for (const d of defs) counts[d.id] = (counts[d.id] || 0) + 1;
    const seen: Record<string, number> = {};
    for (const def of defs) {
      seen[def.id] = (seen[def.id] || 0) + 1;
      const numberSuffix = counts[def.id] > 1 ? ` ${seen[def.id]}` : '';
      const name = def.name + numberSuffix;
      const parent = def.clefs.length > 1 ? top.appendChild(el(doc, 'staffGrp', { symbol: 'brace', 'bar.thru': 'true' })) : top;
      if (def.clefs.length > 1) {
        parent.appendChild(el(doc, 'label')).textContent = name;
        parent.appendChild(el(doc, 'labelAbbr')).textContent = def.abbr + numberSuffix;
      }
      def.clefs.forEach((clef) => {
        n++;
        const sd = el(doc, 'staffDef', {
          n,
          lines: def.percussion ? 5 : 5,
          'clef.shape': clef.shape,
          'clef.line': clef.line,
          'clef.dis': clef.dis,
          'clef.dis.place': clef.disPlace,
          'trans.semi': def.semi,
          'trans.diat': def.diat,
          type: `ps:${def.id}`,
        });
        if (def.clefs.length === 1) {
          sd.appendChild(el(doc, 'label')).textContent = name;
          sd.appendChild(el(doc, 'labelAbbr')).textContent = def.abbr + numberSuffix;
        }
        sd.appendChild(el(doc, 'instrDef', { 'midi.instrnum': def.program, 'midi.channel': def.percussion ? 9 : undefined }));
        setKeySig(sd, def.percussion ? '0' : keySigString(writtenFifths(opts.keyFifths, def.semi)));
        parent.appendChild(sd);
      });
    }
    const section = score.appendChild(el(doc, 'section'));
    const s = new Score(doc);
    s.setMeta({ title: opts.title, subtitle: opts.subtitle || '', composer: opts.composer || '' });
    const staffNs = s.staffDefs().map((d) => d.getAttribute('n')!);
    const total = opts.measures + (opts.pickupTicks ? 1 : 0);
    for (let i = 0; i < total; i++) {
      const m = section.appendChild(el(doc, 'measure', { n: opts.pickupTicks ? i : i + 1 }));
      const pickup = i === 0 && opts.pickupTicks;
      if (pickup) m.setAttribute('metcon', 'false');
      for (const sn of staffNs) {
        const layer = m.appendChild(el(doc, 'staff', { n: sn })).appendChild(el(doc, 'layer', { n: 1 }));
        if (pickup) for (const p of splitTicks(opts.pickupTicks!)) layer.appendChild(el(doc, 'rest', { dur: p.dur }));
        else layer.appendChild(el(doc, 'mRest'));
      }
      if (i === total - 1) m.setAttribute('right', 'end');
    }
    const first = s.measures()[0];
    const tempo = el(doc, 'tempo', { staff: 1, tstamp: 1, 'midi.bpm': opts.tempo, mm: opts.tempo, 'mm.unit': opts.meterUnit === 8 && opts.meterCount % 3 === 0 ? 4 : opts.meterUnit, place: 'above' });
    if (opts.meterUnit === 8 && opts.meterCount % 3 === 0) tempo.setAttribute('mm.dots', '1');
    tempo.textContent = `${opts.tempoText ? opts.tempoText + ' ' : ''}${tempoGlyph(tempo)} = ${opts.tempo}`;
    first.appendChild(tempo);
    s.invalidate();
    return s;
  }
}

/** Writes a key signature as a <keySig> child (read by every MEI version Verovio supports). */
export function setKeySig(def: Element, sig: string) {
  def.removeAttribute('key.sig');
  def.removeAttribute('keysig');
  for (const k of children(def, 'keySig')) k.remove();
  const ks = el(def.ownerDocument!, 'keySig', { sig });
  const before = children(def).find((c) => !['label', 'labelAbbr', 'clef'].includes(c.localName));
  def.insertBefore(ks, before || null);
}

export function tempoGlyph(tempo: Element): string {
  const unit = tempo.getAttribute('mm.unit') || '4';
  const dotted = tempo.getAttribute('mm.dots') === '1';
  const g = unit === '2' ? '𝅗𝅥' : unit === '8' ? '♪' : '♩';
  return dotted ? `${g}.` : g;
}

export function instrumentsForPicker() {
  return INSTRUMENTS;
}
