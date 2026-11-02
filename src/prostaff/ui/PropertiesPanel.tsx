import React from 'react';
import { SlidersVertical, Trash2, X } from 'lucide-react';
import type { Score } from '../model/score';
import { ancestor, getId } from '../model/mei';
import * as E from '../model/edit';
import type { Selection, CommandResult } from '../model/edit';
import type { PaletteActions } from './Palette';
import { NoteIcon } from './NoteIcon';

const LEAVES = new Set(['note', 'chord', 'rest', 'space', 'mRest', 'mSpace', 'multiRest']);
const CONTROL_NAMES: Record<string, string> = {
  dynam: 'Dynamic', dir: 'Text', tempo: 'Tempo', harm: 'Chord symbol', slur: 'Slur', tie: 'Tie', hairpin: 'Hairpin', fermata: 'Fermata',
  trill: 'Trill', mordent: 'Mordent', turn: 'Turn', reh: 'Rehearsal mark', fing: 'Fingering', pedal: 'Pedal', octave: 'Octave line',
  gliss: 'Glissando', breath: 'Breath mark', caesura: 'Caesura', repeatMark: 'Repeat sign', arpeg: 'Arpeggio', clef: 'Clef', verse: 'Lyric', syl: 'Lyric',
};
const DURS: [string, string][] = [['1', 'Whole'], ['2', 'Half'], ['4', 'Quarter'], ['8', 'Eighth'], ['16', '16th'], ['32', '32nd']];
const ACC: Record<string, string> = { s: '♯', f: '♭', n: '♮', ss: '𝄪', x: '𝄪', ff: '𝄫' };
const KEYS: [number, string][] = [[-6, 'G♭'], [-5, 'D♭'], [-4, 'A♭'], [-3, 'E♭'], [-2, 'B♭'], [-1, 'F'], [0, 'C'], [1, 'G'], [2, 'D'], [3, 'A'], [4, 'E'], [5, 'B'], [6, 'F♯']];

export interface PropertiesOps {
  run: (fn: (s: Score) => CommandResult | void) => void;
  actions: PaletteActions;
  tie: () => void;
  openDialog: (kind: 'props' | 'parts' | 'transpose') => void;
  select: (sel: Selection) => void;
}

function pitchName(n: Element) {
  const acc = n.getAttribute('accid') || '';
  return `${(n.getAttribute('pname') || '?').toUpperCase()}${ACC[acc] || ''}${n.getAttribute('oct') || ''}`;
}

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="ps-prop-row">
    <span className="ps-prop-label">{label}</span>
    <div className="ps-prop-ctrls">{children}</div>
  </div>
);

/** The options for whatever is selected: notes, measures, or a marking. Nothing selected shows the score. */
export function PropertiesPanel({ score, sel, ops, onClose }: { score: Score; sel: Selection; ops: PropertiesOps; onClose: () => void }) {
  const { run, actions } = ops;
  const first = sel.kind === 'events' ? score.byId(sel.ids[0]) : null;
  const del = <button className="ps-btn ps-danger ps-prop-del" onClick={() => run((s) => E.deleteSelection(s, sel))}><Trash2 size={14} /> Delete</button>;

  let title = 'Score';
  let body: React.ReactNode;

  if (first && LEAVES.has(E.eventOf(first).localName)) {
    // ---- notes and rests ----
    const events = E.selectedEvents(score, sel);
    const notes = E.selectedNotes(score, sel);
    const ev = E.eventOf(first);
    const isRest = !notes.length;
    const dur = ev.getAttribute('dur') || (ev.localName === 'chord' ? ev.querySelector('note')?.getAttribute('dur') : '') || '';
    const dots = Number(ev.getAttribute('dots') || 0);
    title = events.length > 1 ? `${events.length} ${isRest ? 'rests' : 'notes'}` : isRest ? 'Rest' : ev.localName === 'chord' ? 'Chord' : `Note ${pitchName(notes[0])}`;
    const artic = (a: string) => notes.some((n) => (E.eventOf(n).getAttribute('artic') || n.getAttribute('artic') || '').split(' ').includes(a) || !!E.eventOf(n).querySelector(`artic[artic="${a}"]`));
    const m = ancestor(ev, 'measure');
    body = (
      <>
        {m && <p className="ps-prop-sub">Measure {m.getAttribute('n')} · staff {E.locate(ev).staffN} · voice {E.locate(ev).layerN}</p>}
        <Row label="Length">
          {DURS.map(([d, name]) => (
            <button key={d} className={`ps-tool${dur === d ? ' ps-on' : ''}`} title={name} aria-label={name} onClick={() => run((s) => E.setDuration(s, sel, d, 0))}><NoteIcon dur={d} size={18} /></button>
          ))}
          <button className={`ps-tool${dots ? ' ps-on' : ''}`} title="Dotted" onClick={() => run((s) => E.toggleDot(s, sel))}><b>•</b></button>
        </Row>
        {!isRest && (
          <>
            <Row label="Pitch">
              <button className="ps-btn ps-outline" title="Up a step (↑)" onClick={() => run((s) => E.transposeNotes(s, sel, 1, 'step'))}>▲ Step</button>
              <button className="ps-btn ps-outline" title="Down a step (↓)" onClick={() => run((s) => E.transposeNotes(s, sel, -1, 'step'))}>▼ Step</button>
              <button className="ps-btn ps-outline" title="Up an octave (Ctrl+↑)" onClick={() => run((s) => E.transposeNotes(s, sel, 1, 'octave'))}>▲ 8ve</button>
              <button className="ps-btn ps-outline" title="Down an octave (Ctrl+↓)" onClick={() => run((s) => E.transposeNotes(s, sel, -1, 'octave'))}>▼ 8ve</button>
              <button className="ps-btn ps-outline" title="Transpose by any interval" onClick={() => ops.openDialog('transpose')}>Transpose…</button>
            </Row>
            <Row label="Accidental">
              {([[-1, '♭', 'Flat'], [0, '♮', 'Natural'], [1, '♯', 'Sharp']] as [number, string, string][]).map(([a, g, name]) => (
                <button key={a} className="ps-tool" title={name} onClick={() => actions.accidental(a)}><span className="ps-glyph">{g}</span></button>
              ))}
            </Row>
            <Row label="Marks">
              {([['stacc', '·', 'Staccato'], ['ten', '–', 'Tenuto'], ['acc', '>', 'Accent'], ['marc', '^', 'Marcato']] as [string, string, string][]).map(([a, g, name]) => (
                <button key={a} className={`ps-tool${artic(a) ? ' ps-on' : ''}`} title={name} onClick={() => actions.artic(a)}><span className="ps-glyph">{g}</span></button>
              ))}
              <button className="ps-tool" title="Fermata" onClick={() => actions.control('fermata', { place: 'above' })}><span className="ps-glyph">𝄐</span></button>
            </Row>
            <Row label="Connect">
              <button className="ps-btn ps-outline" title="Tie to the next note (T)" onClick={ops.tie}>Tie</button>
              <button className="ps-btn ps-outline" title="Slur over the selection (S)" onClick={() => actions.spanner('slur')}>Slur</button>
              <button className="ps-btn ps-outline" title="Make a triplet (Ctrl+3)" onClick={() => actions.tuplet(3)}>Triplet</button>
            </Row>
            <Row label="Stem">
              {(['up', 'down'] as const).map((d) => (
                <button key={d} className={`ps-btn ps-outline${ev.getAttribute('stem.dir') === d ? ' ps-on' : ''}`} onClick={() => actions.noteAttr('stem.dir', d)}>{d === 'up' ? 'Up' : 'Down'}</button>
              ))}
              <button className="ps-btn ps-outline" onClick={() => actions.noteAttr('stem.dir', null)}>Auto</button>
            </Row>
          </>
        )}
        <Row label="Add">
          <button className="ps-btn ps-outline" onClick={() => actions.prompt('lyrics')}>Lyric</button>
          <button className="ps-btn ps-outline" onClick={() => actions.prompt('chord')}>Chord</button>
          <button className="ps-btn ps-outline" onClick={() => actions.control('dynam', {}, 'mf')}>Dynamic</button>
        </Row>
        {del}
      </>
    );
  } else if (first) {
    // ---- a marking: dynamic, text, slur, chord symbol… ----
    const kind = first.localName;
    title = CONTROL_NAMES[kind] || kind;
    const text = (first.textContent || '').trim();
    const placeable = !['clef', 'tie', 'arpeg', 'verse', 'syl', 'gliss'].includes(kind);
    const place = first.getAttribute('place');
    body = (
      <>
        {text && <p className="ps-prop-sub">“{text}”</p>}
        {placeable && (
          <Row label="Place">
            {(['above', 'below'] as const).map((p) => (
              <button
                key={p}
                className={`ps-btn ps-outline${place === p ? ' ps-on' : ''}`}
                onClick={() => run((s) => {
                  const el = s.byId(getId(first));
                  if (el) el.setAttribute('place', p);
                  return { selection: sel };
                })}
              >
                {p === 'above' ? 'Above' : 'Below'}
              </button>
            ))}
          </Row>
        )}
        {kind === 'harm' && <Row label="Edit"><button className="ps-btn ps-outline" onClick={() => actions.prompt('chord')}>Change chord…</button></Row>}
        {del}
      </>
    );
  } else if (sel.kind === 'measures') {
    // ---- measures ----
    const ms = E.measuresOf(score, sel);
    const a = ms[0]?.getAttribute('n');
    const b = ms[ms.length - 1]?.getAttribute('n');
    title = ms.length > 1 ? `Measures ${a}–${b}` : `Measure ${a}`;
    const ctx = ms[0] ? score.contextOf(ms[0]) : null;
    body = (
      <>
        {ctx && <p className="ps-prop-sub">{ctx.count}/{ctx.unit} time</p>}
        <Row label="Time">
          {([[2, 4], [3, 4], [4, 4], [6, 8], [2, 2]] as [number, number][]).map(([c, u]) => (
            <button key={`${c}/${u}`} className={`ps-btn ps-outline${ctx && ctx.count === c && ctx.unit === u ? ' ps-on' : ''}`} onClick={() => actions.meter(c, u)}>{c}/{u}</button>
          ))}
          <button className="ps-btn ps-outline" onClick={() => actions.prompt('meter')}>Other…</button>
        </Row>
        <Row label="Key">
          <select className="ps-select ps-prop-select" defaultValue="" onChange={(e) => { if (e.target.value !== '') actions.key(Number(e.target.value)); e.target.value = ''; }}>
            <option value="">Change key…</option>
            {KEYS.map(([f, name]) => <option key={f} value={f}>{name} major</option>)}
          </select>
        </Row>
        <Row label="Barline">
          <button className="ps-btn ps-outline" onClick={() => actions.barline('dbl')}>Double</button>
          <button className="ps-btn ps-outline" onClick={() => actions.barline('end')}>Final</button>
          <button className="ps-btn ps-outline" onClick={() => actions.barline('rptstart')}>𝄆 Start</button>
          <button className="ps-btn ps-outline" onClick={() => actions.barline('rptend')}>End 𝄇</button>
        </Row>
        <Row label="Endings">
          <button className="ps-btn ps-outline" onClick={() => actions.ending('1')}>1st</button>
          <button className="ps-btn ps-outline" onClick={() => actions.ending('2')}>2nd</button>
        </Row>
        <Row label="Notes">
          <button className="ps-btn ps-outline" title="Up a step" onClick={() => run((s) => E.transposeNotes(s, sel, 1, 'step'))}>▲ Step</button>
          <button className="ps-btn ps-outline" title="Down a step" onClick={() => run((s) => E.transposeNotes(s, sel, -1, 'step'))}>▼ Step</button>
          <button className="ps-btn ps-outline" title="Transpose by any interval" onClick={() => ops.openDialog('transpose')}>Transpose…</button>
        </Row>
        <p className="ps-hint">Drag inside the selected {ms.length > 1 ? 'measures' : 'measure'} to move every note up or down.</p>
        <Row label="Measures">
          <button className="ps-btn ps-outline" onClick={() => actions.insertMeasure()}>Insert before</button>
          <button className="ps-btn ps-outline" onClick={() => actions.addMeasures(1)}>+1 at end</button>
          <button className="ps-btn ps-outline" onClick={() => actions.pageBreak('sb')}>Line break</button>
        </Row>
        <button className="ps-btn ps-danger ps-prop-del" onClick={() => actions.deleteMeasures()}><Trash2 size={14} /> Delete {ms.length > 1 ? 'measures' : 'measure'}</button>
      </>
    );
  } else {
    // ---- nothing selected: the score ----
    const meta = score.getMeta();
    const ms = score.measures();
    const ctx = ms[0] ? score.contextOf(ms[0]) : null;
    const parts = score.staves();
    body = (
      <>
        <p className="ps-prop-sub ps-prop-title">{meta.title || 'Untitled'}{meta.composer ? ` · ${meta.composer}` : ''}</p>
        <Row label="Score">
          <span className="ps-prop-info">{ms.length} measures{ctx ? ` · ${ctx.count}/${ctx.unit}` : ''} · {parts.length} {parts.length === 1 ? 'staff' : 'staves'}</span>
        </Row>
        <Row label="Edit">
          <button className="ps-btn ps-outline" onClick={() => ops.openDialog('props')}>Title & credits…</button>
          <button className="ps-btn ps-outline" onClick={() => ops.openDialog('parts')}>Instruments…</button>
          <button className="ps-btn ps-outline" onClick={() => ops.openDialog('transpose')}>Transpose…</button>
        </Row>
        <Row label="Select">
          <button className="ps-btn ps-outline" onClick={() => ops.select({ kind: 'measures', measureIds: ms.map(getId), staves: score.staffDefs().map((d) => d.getAttribute('n') || '1') })}>Whole score</button>
        </Row>
        <p className="ps-hint">Click a note, a measure or a marking to see its options here. Drag across notes to select several.</p>
      </>
    );
  }

  return (
    <aside className="ps-props" aria-label="Properties">
      <header>
        <SlidersVertical size={15} />
        <b>{title}</b>
        <span style={{ flex: 1 }} />
        <button className="ps-btn" onClick={onClose} aria-label="Close properties" title="Hide properties"><X size={15} /></button>
      </header>
      <div className="ps-props-body">{body}</div>
    </aside>
  );
}
