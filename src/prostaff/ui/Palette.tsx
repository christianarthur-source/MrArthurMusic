import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DRUMS } from '../model/tools';

export interface PaletteActions {
  artic(name: string): void;
  control(name: string, attrs?: Record<string, string>, text?: string, rend?: Record<string, string>): void;
  spanner(name: string, attrs?: Record<string, string>): void;
  noteAttr(attr: string, value: string | null, on?: 'event' | 'note'): void;
  grace(kind: 'acc' | 'unacc'): void;
  accidental(alter: number): void;
  cautionary(): void;
  tuplet(n: number): void;
  prompt(kind: 'staff-text' | 'expression' | 'tempo' | 'rehearsal' | 'chord' | 'lyrics' | 'fingering' | 'meter' | 'roman' | 'figbass'): void;
  drum(id: string): void;
  clef(shape: string, line: number, dis?: number, place?: string): void;
  key(fifths: number): void;
  meter(count: number, unit: number, sym?: string): void;
  barline(kind: string): void;
  ending(n: string): void;
  repeatMark(func: string, text: string): void;
  dirText(text: string, italic?: boolean): void;
  addMeasures(n: number): void;
  insertMeasure(): void;
  deleteMeasures(): void;
  pageBreak(kind: 'sb' | 'pb'): void;
}

export interface PaletteItem {
  label: React.ReactNode;
  title: string;
  run: (a: PaletteActions) => void;
  sub?: string;
}

const G = (s: string) => <span className="ps-glyph">{s}</span>;
const D = (s: string) => <span className="ps-dyn">{s}</span>;
const T = (s: string) => <span className="ps-txt">{s}</span>;

const KEYS: [number, string][] = [
  [-7, 'C♭'], [-6, 'G♭'], [-5, 'D♭'], [-4, 'A♭'], [-3, 'E♭'], [-2, 'B♭'], [-1, 'F'], [0, 'C'], [1, 'G'], [2, 'D'], [3, 'A'], [4, 'E'], [5, 'B'], [6, 'F♯'], [7, 'C♯'],
];

export const SECTIONS: { id: string; title: string; wide?: boolean; items: PaletteItem[] }[] = [
  {
    id: 'accidentals', title: 'Accidentals', items: [
      { label: G('𝄫'), title: 'Double flat', run: (a) => a.accidental(-2) },
      { label: G('♭'), title: 'Flat (-)', run: (a) => a.accidental(-1) },
      { label: G('♮'), title: 'Natural (=)', run: (a) => a.accidental(0) },
      { label: G('♯'), title: 'Sharp (+)', run: (a) => a.accidental(1) },
      { label: G('𝄪'), title: 'Double sharp', run: (a) => a.accidental(2) },
      { label: T('( ♮ )'), title: 'Cautionary accidental on/off', run: (a) => a.cautionary() },
    ],
  },
  {
    id: 'articulations', title: 'Articulations', items: [
      { label: G('·'), title: 'Staccato', run: (a) => a.artic('stacc') },
      { label: G('▾'), title: 'Staccatissimo', run: (a) => a.artic('stacis') },
      { label: G('–'), title: 'Tenuto', run: (a) => a.artic('ten') },
      { label: G('>'), title: 'Accent', run: (a) => a.artic('acc') },
      { label: G('^'), title: 'Marcato', run: (a) => a.artic('marc') },
      { label: G('𝄐'), title: 'Fermata', run: (a) => a.control('fermata', { place: 'above' }) },
      { label: G('𝆪'), title: 'Up bow', run: (a) => a.artic('upbow') },
      { label: G('𝆫'), title: 'Down bow', run: (a) => a.artic('dnbow') },
      { label: G('○'), title: 'Harmonic', run: (a) => a.artic('harm') },
      { label: G('+'), title: 'Stopped / left-hand pizz.', run: (a) => a.artic('stop') },
      { label: T('snap'), title: 'Snap pizzicato', run: (a) => a.artic('snap') },
      { label: G('’'), title: 'Breath mark', run: (a) => a.control('breath') },
      { label: G('//'), title: 'Caesura', run: (a) => a.control('caesura') },
      { label: T('trem'), title: 'Tremolo (3 slashes)', run: (a) => a.noteAttr('stem.mod', '3slash') },
    ],
  },
  {
    id: 'ornaments', title: 'Ornaments', items: [
      { label: T('tr'), title: 'Trill', run: (a) => a.control('trill', { place: 'above' }) },
      { label: G('𝆝'), title: 'Mordent', run: (a) => a.control('mordent', { form: 'lower' }) },
      { label: G('𝆞'), title: 'Inverted mordent', run: (a) => a.control('mordent', { form: 'upper' }) },
      { label: G('𝆗'), title: 'Turn', run: (a) => a.control('turn', { form: 'upper' }) },
      { label: T('arp'), title: 'Arpeggio (select a chord)', run: (a) => a.control('arpeg') },
      { label: T('gliss'), title: 'Glissando to the next note', run: (a) => a.spanner('gliss') },
      { label: T('grace'), title: 'Acciaccatura (slashed grace note)', run: (a) => a.grace('unacc') },
      { label: T('appogg.'), title: 'Appoggiatura', run: (a) => a.grace('acc') },
    ],
  },
  {
    id: 'dynamics', title: 'Dynamics', items: [
      ...['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'fp', 'sf', 'sfz', 'rfz'].map((d) => ({ label: D(d), title: d, run: (a: PaletteActions) => a.control('dynam', {}, d) })),
      { label: G('𝆒'), title: 'Crescendo hairpin (select notes)', run: (a) => a.spanner('hairpin', { form: 'cres' }) },
      { label: G('𝆓'), title: 'Diminuendo hairpin (select notes)', run: (a) => a.spanner('hairpin', { form: 'dim' }) },
      { label: D('cresc.'), title: 'cresc. text', run: (a) => a.control('dynam', {}, 'cresc.') },
    ],
  },
  {
    id: 'lines', title: 'Lines', items: [
      { label: G('⁀'), title: 'Slur (S)', run: (a) => a.spanner('slur') },
      { label: T('8va'), title: 'Octave higher', run: (a) => a.spanner('octave', { dis: '8', 'dis.place': 'above' }) },
      { label: T('8vb'), title: 'Octave lower', run: (a) => a.spanner('octave', { dis: '8', 'dis.place': 'below' }) },
      { label: T('15ma'), title: 'Two octaves higher', run: (a) => a.spanner('octave', { dis: '15', 'dis.place': 'above' }) },
      { label: T('Ped.'), title: 'Sustain pedal (select notes)', run: (a) => a.spanner('pedal') },
      { label: T('tr~~'), title: 'Trill line', run: (a) => a.spanner('trill', { place: 'above' }) },
    ],
  },
  {
    id: 'text', title: 'Text', wide: true, items: [
      { label: T('Staff text'), title: 'Staff text (X)', run: (a) => a.prompt('staff-text') },
      { label: T('Expression'), title: 'Italic expression like “dolce”', run: (a) => a.prompt('expression') },
      { label: T('Tempo'), title: 'Tempo marking', run: (a) => a.prompt('tempo') },
      { label: T('Rehearsal'), title: 'Rehearsal mark', run: (a) => a.prompt('rehearsal') },
      { label: T('Chord symbol'), title: 'Chord symbol (K)', run: (a) => a.prompt('chord') },
      { label: T('Lyrics'), title: 'Lyrics (L)', run: (a) => a.prompt('lyrics') },
      { label: T('Fingering'), title: 'Fingering', run: (a) => a.prompt('fingering') },
      { label: T('Roman numeral'), title: 'Roman numeral analysis (below the staff)', run: (a) => a.prompt('roman') },
      { label: T('Figured bass'), title: 'Figured bass numbers (below the staff)', run: (a) => a.prompt('figbass') },
      { label: T('rit.'), title: 'ritardando', run: (a) => a.dirText('rit.', true) },
      { label: T('a tempo'), title: 'a tempo', run: (a) => a.dirText('a tempo', false) },
    ],
  },
  {
    id: 'clefs', title: 'Clefs', items: [
      { label: G('𝄞'), title: 'Treble clef', run: (a) => a.clef('G', 2) },
      { label: G('𝄢'), title: 'Bass clef', run: (a) => a.clef('F', 4) },
      { label: G('𝄡'), title: 'Alto clef', run: (a) => a.clef('C', 3) },
      { label: <>{G('𝄡')}<small>tenor</small></>, title: 'Tenor clef', run: (a) => a.clef('C', 4) },
      { label: <>{G('𝄞')}<small>8vb</small></>, title: 'Treble clef 8vb (tenor voice, guitar)', run: (a) => a.clef('G', 2, 8, 'below') },
      { label: G('𝄥'), title: 'Percussion clef', run: (a) => a.clef('perc', 3) },
    ],
  },
  {
    id: 'keys', title: 'Key signatures (concert)', items: KEYS.map(([f, name]) => ({
      label: <>{T(name)}<small>{f === 0 ? '—' : f > 0 ? `${f}♯` : `${-f}♭`}</small></>, title: `${name} major / relative minor`, run: (a: PaletteActions) => a.key(f),
    })),
  },
  {
    id: 'time', title: 'Time signatures', items: [
      ...([[2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [3, 8], [6, 8], [9, 8], [12, 8], [2, 2], [3, 2], [7, 8]] as [number, number][]).map(([c, u]) => ({
        label: <span className="ps-txt" style={{ fontWeight: 700, lineHeight: 1 }}>{c}<br />{u}</span>, title: `${c}/${u}`, run: (a: PaletteActions) => a.meter(c, u),
      })),
      { label: G('𝄴'), title: 'Common time', run: (a) => a.meter(4, 4, 'common') },
      { label: G('𝄵'), title: 'Cut time', run: (a) => a.meter(2, 2, 'cut') },
      { label: T('other…'), title: 'Other time signature', run: (a) => a.prompt('meter') },
    ],
  },
  {
    id: 'barlines', title: 'Barlines & repeats', items: [
      { label: G('𝄁'), title: 'Double barline', run: (a) => a.barline('dbl') },
      { label: G('𝄂'), title: 'Final barline', run: (a) => a.barline('end') },
      { label: G('𝄆'), title: 'Start repeat', run: (a) => a.barline('rptstart') },
      { label: G('𝄇'), title: 'End repeat', run: (a) => a.barline('rptend') },
      { label: T('dashed'), title: 'Dashed barline', run: (a) => a.barline('dashed') },
      { label: T('1.'), title: '1st ending (select measures; again to remove)', run: (a) => a.ending('1') },
      { label: T('2.'), title: '2nd ending', run: (a) => a.ending('2') },
      { label: G('𝄋'), title: 'Segno', run: (a) => a.repeatMark('segno', '') },
      { label: G('𝄌'), title: 'Coda', run: (a) => a.repeatMark('coda', '') },
      { label: T('Fine'), title: 'Fine', run: (a) => a.dirText('Fine', true) },
      { label: T('D.C.'), title: 'Da capo', run: (a) => a.dirText('D.C.', true) },
      { label: T('D.C. al Fine'), title: 'D.C. al Fine', run: (a) => a.dirText('D.C. al Fine', true) },
      { label: T('D.S. al Coda'), title: 'D.S. al Coda', run: (a) => a.dirText('D.S. al Coda', true) },
      { label: T('To Coda'), title: 'To Coda', run: (a) => a.dirText('To Coda', true) },
    ],
  },
  {
    id: 'drums', title: 'Drum set', wide: true, items: DRUMS.map((d) => ({ label: T(d.name), title: `${d.name} — writes at the cursor, or stacks on the selected note`, run: (a: PaletteActions) => a.drum(d.id) })),
  },
  {
    id: 'notes', title: 'Note style', wide: true, items: [
      { label: T('Stem up'), title: 'Stem up', run: (a) => a.noteAttr('stem.dir', 'up') },
      { label: T('Stem down'), title: 'Stem down', run: (a) => a.noteAttr('stem.dir', 'down') },
      { label: T('Cue size'), title: 'Cue-size notes', run: (a) => a.noteAttr('cue', 'true') },
      { label: T('× head'), title: 'X notehead', run: (a) => a.noteAttr('head.shape', 'x', 'note') },
      { label: T('◇ head'), title: 'Diamond notehead', run: (a) => a.noteAttr('head.shape', 'diamond', 'note') },
      { label: T('slash'), title: 'Slash notehead', run: (a) => a.noteAttr('head.shape', 'slash', 'note') },
      { label: T('Triplet'), title: 'Triplet (Ctrl+3)', run: (a) => a.tuplet(3) },
      { label: T('Quintuplet'), title: 'Quintuplet (Ctrl+5)', run: (a) => a.tuplet(5) },
      { label: T('Sextuplet'), title: 'Sextuplet (Ctrl+6)', run: (a) => a.tuplet(6) },
    ],
  },
  {
    id: 'measures', title: 'Measures & layout', wide: true, items: [
      { label: T('+1 measure'), title: 'Add a measure at the end (Ctrl+B)', run: (a) => a.addMeasures(1) },
      { label: T('+4 measures'), title: 'Add four measures', run: (a) => a.addMeasures(4) },
      { label: T('Insert before'), title: 'Insert a measure before the selection', run: (a) => a.insertMeasure() },
      { label: T('Delete measures'), title: 'Delete the selected measures', run: (a) => a.deleteMeasures() },
      { label: T('System break'), title: 'Start a new line after this measure', run: (a) => a.pageBreak('sb') },
      { label: T('Page break'), title: 'Start a new page after this measure', run: (a) => a.pageBreak('pb') },
    ],
  },
];

/** Some palette sections laid out in one row (for the toolbar tabs), each with a small label. */
export function PaletteStrip({ actions, ids }: { actions: PaletteActions; ids: string[] }) {
  return (
    <>
      {ids.map((id) => {
        const s = SECTIONS.find((x) => x.id === id);
        if (!s) return null;
        return (
          <div key={id} className="ps-strip-group" role="group" aria-label={s.title}>
            <span className="ps-strip-label">{s.title.replace(/ \(concert\)/, '')}</span>
            <div className="ps-strip-items">
              {s.items.map((it, i) => (
                <button key={i} className={`ps-pal-item ps-strip-item${s.wide ? ' ps-wide' : ''}`} title={it.title} aria-label={it.title} onMouseDown={(e) => e.preventDefault()} onClick={() => it.run(actions)}>
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

export function Palette({ actions, collapsed }: { actions: PaletteActions; collapsed: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('prostaff:palette') || '') || {};
    } catch {
      return { accidentals: true, articulations: true, dynamics: true };
    }
  });
  const toggle = (id: string) => {
    const next = { ...open, [id]: !isOpen(id) };
    setOpen(next);
    try {
      localStorage.setItem('prostaff:palette', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };
  const isOpen = (id: string) => open[id] ?? ['accidentals', 'articulations', 'dynamics', 'text'].includes(id);
  return (
    <aside className={`ps-palette${collapsed ? ' ps-collapsed' : ''}`} aria-label="Palettes">
      {SECTIONS.map((s) => (
        <div key={s.id} className="ps-pal-section">
          <button className="ps-pal-head" onClick={() => toggle(s.id)} aria-expanded={isOpen(s.id)}>
            {s.title}
            {isOpen(s.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {isOpen(s.id) && (
            <div className={`ps-pal-grid${s.wide ? ' ps-wide' : ''}`}>
              {s.items.map((it, i) => (
                <button key={i} className="ps-pal-item" title={it.title} aria-label={it.title} onMouseDown={(e) => e.preventDefault()} onClick={() => it.run(actions)}>
                  {it.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
