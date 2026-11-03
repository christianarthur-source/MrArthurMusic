import React, { useState } from 'react';
import { AlertTriangle, Info, Palette, Play, FileText, Keyboard, Printer } from 'lucide-react';
import { Dialog } from './Dialogs';
import type { PlaybackOptions } from '../audio/schedule';
import type { Issue } from '../model/analysis';
import type { EngravingFont } from '../engine/verovio';
import { TEXT_FONTS, textFont, type ThemeName, type CursorStyle } from './appearance';

export interface LayoutOptions {
  pageSize: 'letter' | 'a4';
  staffSize: number; // percent of normal
  perLine: number; // measures per line, 0 = automatic
}
export const DEFAULT_LAYOUT: LayoutOptions = { pageSize: 'letter', staffSize: 100, perLine: 0 };

export interface AppPrefs {
  midiInput: boolean;
  showRange: boolean;
  theme: ThemeName;
  cursor: CursorStyle;
  clickOffset: number; // ms; negative = earlier
  cursorOffset: number; // ms; negative = earlier
  textFont: string;
  metronome: boolean;
  countIn: boolean;
  keyStyle: KeyStyle;
}
/** Which app's keyboard shortcuts to follow where they differ (number keys, arrows, R, T, Space…). */
export type KeyStyle = 'wolfi' | 'flat' | 'noteflight';
export const DEFAULT_PREFS: AppPrefs = { midiInput: false, showRange: true, theme: 'dark', cursor: 'line', clickOffset: 0, cursorOffset: 0, textFont: 'classic', metronome: false, countIn: false, keyStyle: 'wolfi' };
const KEY_STYLES: [KeyStyle, string, string][] = [
  ['wolfi', 'Wolfi', 'Like MuseScore and Sibelius: 5 = quarter note, ↑ ↓ = half step'],
  ['flat', 'Flat', '1 = whole … 3 = quarter, 8 = rest, ↑ ↓ = scale step, = sharp, 0 natural'],
  ['noteflight', 'Noteflight', '↑ ↓ = scale step, Shift+↑ ↓ = half step, Space = rest, P = play, T = text'],
];

const SWINGS: [number, string][] = [[0, 'Straight'], [0.08, 'Light swing'], [0.167, 'Swing (triplet feel)'], [0.25, 'Hard swing']];
const MUSIC_FONTS: [EngravingFont, string][] = [
  ['Leipzig', 'Leipzig — classic'],
  ['Bravura', 'Bravura — bold, modern'],
  ['Leland', 'Leland — MuseScore style'],
  ['Gootville', 'Gootville — hand-copied look'],
  ['Petaluma', 'Petaluma — jazz handwritten'],
];
const CURSORS: [CursorStyle, string, string][] = [
  ['line', 'Smooth cursor', 'A thin line glides through the music'],
  ['notes', 'Light up notes', 'Each note glows as it sounds'],
  ['measure', 'Light up measure', 'The playing measure is tinted'],
  ['none', 'Off', 'Nothing moves during playback'],
];
export type SettingsTab = 'appearance' | 'playback' | 'page' | 'input';

export function SettingsDialog({ tab: initialTab = 'appearance', playback, layout, prefs, font, midiDevices, onPlayback, onLayout, onPrefs, onFont, onClose }: {
  tab?: SettingsTab; playback: PlaybackOptions; layout: LayoutOptions; prefs: AppPrefs; font: EngravingFont; midiDevices: string[];
  onPlayback: (p: PlaybackOptions) => void; onLayout: (l: LayoutOptions) => void; onPrefs: (p: AppPrefs) => void; onFont: (f: EngravingFont) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const tabs: [SettingsTab, string, React.ReactNode][] = [
    ['appearance', 'Appearance', <Palette size={14} key="a" />],
    ['playback', 'Playback', <Play size={14} key="p" />],
    ['page', 'Page', <FileText size={14} key="g" />],
    ['input', 'Input', <Keyboard size={14} key="i" />],
  ];
  return (
    <Dialog title="Settings" subtitle="Appearance, cursor and click timing are for this device; playback and page options are saved with the score." onClose={onClose} size="medium"
      footer={<button className="ps-btn ps-primary" onClick={onClose}>Done</button>}>
      <nav className="ps-tabs" role="tablist">
        {tabs.map(([id, label, icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'ps-on' : ''} onClick={() => setTab(id)}>{icon} {label}</button>
        ))}
      </nav>
      {tab === 'appearance' && (
        <>
          <h4 className="ps-set-head">Theme</h4>
          <div className="ps-cards ps-cards-2">
            {(['dark', 'light'] as ThemeName[]).map((t) => (
              <button key={t} className={`ps-card ps-theme-card${prefs.theme === t ? ' ps-on' : ''}`} onClick={() => onPrefs({ ...prefs, theme: t })}>
                <span className={`ps-swatch ps-swatch-${t}`}><i /><i /><i /></span>
                <b>{t === 'dark' ? 'Dark' : 'Light'}</b>
                <small>{t === 'dark' ? 'Easy on the eyes, for long sessions' : 'Bright, like paper on a desk'}</small>
              </button>
            ))}
          </div>
          <h4 className="ps-set-head">Fonts</h4>
          <div className="ps-row">
            <div className="ps-field"><label>Music symbols</label>
              <select className="ps-select" value={font} onChange={(e) => onFont(e.target.value as EngravingFont)}>
                {MUSIC_FONTS.map(([f, l]) => <option key={f} value={f}>{l}</option>)}
              </select>
            </div>
            <div className="ps-field"><label>Titles & text</label>
              <select className="ps-select" value={prefs.textFont} onChange={(e) => onPrefs({ ...prefs, textFont: e.target.value })}>
                {TEXT_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="ps-font-preview" style={{ fontFamily: textFont(prefs.textFont).family }}>
            <b>Autumn Song</b><span>Allegretto · <i>dolce</i> · words and music</span>
          </div>
        </>
      )}
      {tab === 'playback' && (
        <>
          <h4 className="ps-set-head">Follow along</h4>
          <div className="ps-cards ps-cards-2">
            {CURSORS.map(([c, l, d]) => (
              <button key={c} className={`ps-card${prefs.cursor === c ? ' ps-on' : ''}`} onClick={() => onPrefs({ ...prefs, cursor: c })}><b>{l}</b><small>{d}</small></button>
            ))}
          </div>
          <h4 className="ps-set-head">Timing</h4>
          <Offset label="Click" value={prefs.clickOffset} onChange={(v) => onPrefs({ ...prefs, clickOffset: v })} />
          <Offset label="Cursor" value={prefs.cursorOffset} onChange={(v) => onPrefs({ ...prefs, cursorOffset: v })} />
          <p className="ps-hint">Both already follow the sound itself. Bluetooth speakers and headphones add a delay the browser can't always see; if the click or cursor feels early or late there, nudge it while playing.</p>
          <h4 className="ps-set-head">Performance</h4>
          <label className="ps-toggle"><input type="checkbox" checked={playback.repeats} onChange={(e) => onPlayback({ ...playback, repeats: e.target.checked })} /> Play repeats, 1st/2nd endings, D.C. / D.S. / Coda</label>
          <div className="ps-row">
            <div className="ps-field"><label>Feel</label>
              <select className="ps-select" value={playback.swing} onChange={(e) => onPlayback({ ...playback, swing: Number(e.target.value) })}>
                {SWINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="ps-field"><label>Chord symbols</label>
              <select className="ps-select" value={playback.chords} onChange={(e) => onPlayback({ ...playback, chords: e.target.value as PlaybackOptions['chords'] })}>
                <option value="piano">Play on piano</option><option value="guitar">Play on guitar</option><option value="off">Don't play</option>
              </select>
            </div>
          </div>
        </>
      )}
      {tab === 'page' && (
        <>
          <h4 className="ps-set-head">Page layout</h4>
          <div className="ps-row">
            <div className="ps-field"><label>Paper</label>
              <select className="ps-select" value={layout.pageSize} onChange={(e) => onLayout({ ...layout, pageSize: e.target.value as LayoutOptions['pageSize'] })}>
                <option value="letter">US Letter</option><option value="a4">A4</option>
              </select>
            </div>
            <div className="ps-field"><label>Staff size</label>
              <select className="ps-select" value={layout.staffSize} onChange={(e) => onLayout({ ...layout, staffSize: Number(e.target.value) })}>
                {[70, 80, 90, 100, 110, 120, 130].map((v) => <option key={v} value={v}>{v === 100 ? 'Normal' : `${v}%`}</option>)}
              </select>
            </div>
            <div className="ps-field"><label>Measures per line</label>
              <select className="ps-select" value={layout.perLine} onChange={(e) => onLayout({ ...layout, perLine: Number(e.target.value) })}>
                <option value={0}>Automatic</option>{[2, 3, 4, 5, 6, 8].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </>
      )}
      {tab === 'input' && (
        <>
          <h4 className="ps-set-head">Keyboard shortcuts</h4>
          <div className="ps-cards">
            {KEY_STYLES.map(([k, l, d]) => (
              <button key={k} className={`ps-card${prefs.keyStyle === k ? ' ps-on' : ''}`} onClick={() => onPrefs({ ...prefs, keyStyle: k })}><b>{l}</b><small>{d}</small></button>
            ))}
          </div>
          <p className="ps-hint">Pick the app your students already know. Shared keys (letters A–G, <kbd>,</kbd> tie, <kbd>[</kbd> <kbd>]</kbd> length, <kbd>Z</kbd> spelling, <kbd>Alt</kbd>+<kbd>2</kbd>–<kbd>8</kbd> intervals) work in every style. Press <kbd>?</kbd> for the full list.</p>
          <h4 className="ps-set-head">Input & display</h4>
          <label className="ps-toggle"><input type="checkbox" checked={prefs.midiInput} onChange={(e) => onPrefs({ ...prefs, midiInput: e.target.checked })} /> MIDI keyboard input {prefs.midiInput && <small style={{ color: 'var(--ps-muted)' }}>— {midiDevices.length ? midiDevices.join(', ') : 'no keyboard found yet; plug one in'}</small>}</label>
          <label className="ps-toggle"><input type="checkbox" checked={prefs.showRange} onChange={(e) => onPrefs({ ...prefs, showRange: e.target.checked })} /> Show notes outside an instrument's range in red</label>
        </>
      )}
    </Dialog>
  );
}

function Offset({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="ps-offset">
      <span className="ps-offset-label">{label}</span>
      <small>Earlier</small>
      <input className="ps-range" type="range" min={-300} max={300} step={10} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} timing`} />
      <small>Later</small>
      <span className="ps-offset-val">{value === 0 ? 'In sync' : `${value > 0 ? '+' : '−'}${Math.abs(value)} ms`}</span>
      <button className="ps-link" style={{ visibility: value ? 'visible' : 'hidden' }} onClick={() => onChange(0)}>Reset</button>
    </div>
  );
}

export function IssuesPanel({ issues, onSelect, onClose }: { issues: Issue[]; onSelect: (i: Issue) => void; onClose: () => void }) {
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');
  return (
    <aside className="ps-comments" aria-label="Score check">
      <header><AlertTriangle size={15} /> <b>Score check</b><span style={{ flex: 1 }} /><button className="ps-btn" onClick={onClose} aria-label="Close">×</button></header>
      <div className="ps-comments-list">
        {!issues.length && <p style={{ color: 'var(--ps-ok)' }}>No problems found. Nice voice leading!</p>}
        {!!issues.length && <p style={{ color: 'var(--ps-muted)', fontSize: 12 }}>{warnings.length} to fix · {infos.length} to consider. Click one to see the notes.</p>}
        {[...warnings, ...infos].map((i, k) => (
          <button key={k} className={`ps-issue ps-${i.severity}`} onClick={() => onSelect(i)}>
            {i.severity === 'warning' ? <AlertTriangle size={13} /> : <Info size={13} />}
            <span><b>m. {i.measureN}</b> {i.message}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

export function PrintPartsDialog({ parts, onPrint, onClose }: { parts: { name: string; ns: string[] }[]; onPrint: (ns: string[][]) => void; onClose: () => void }) {
  const [chosen, setChosen] = useState<boolean[]>(parts.map(() => true));
  return (
    <Dialog title="Print parts" subtitle="Each part on its own pages, with multi-measure rests." onClose={onClose} size="small"
      footer={<>
        <button className="ps-btn ps-outline" onClick={onClose}>Cancel</button>
        <button className="ps-btn ps-primary" disabled={!chosen.some(Boolean)} onClick={() => onPrint(parts.filter((_, i) => chosen[i]).map((p) => p.ns))}>Print / save PDF</button>
      </>}>
      {parts.map((p, i) => (
        <label key={i} className="ps-toggle"><input type="checkbox" checked={chosen[i]} onChange={(e) => setChosen((c) => c.map((x, j) => (j === i ? e.target.checked : x)))} /> {p.name}</label>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button className="ps-link" onClick={() => setChosen(parts.map(() => true))}>All</button>
        <button className="ps-link" onClick={() => setChosen(parts.map(() => false))}>None</button>
      </div>
    </Dialog>
  );
}

export function ProgressDialog({ title, text, fraction, onCancel }: { title: string; text: string; fraction: number | null; onCancel?: () => void }) {
  return (
    <Dialog title={title} onClose={onCancel || (() => {})} size="small" footer={onCancel ? <button className="ps-btn ps-outline" onClick={onCancel}>Cancel</button> : undefined}>
      <div className={`ps-progress${fraction === null ? ' ps-indeterminate' : ''}`}><div style={fraction !== null ? { width: Math.round(fraction * 100) + '%' } : undefined} /></div>
      <p style={{ color: 'var(--ps-muted)' }}>{text}</p>
    </Dialog>
  );
}

/** Print mode: everything for getting the score onto paper or out of the app, in one place. */
export function PrintPanel({ layout, pageView, parts, onLayout, onPageView, onExport, onPrintParts }: {
  layout: LayoutOptions;
  pageView: boolean;
  parts: number;
  onLayout: (l: LayoutOptions) => void;
  onPageView: () => void;
  onExport: (kind: 'pdf' | 'musicxml' | 'midi' | 'mei' | 'svg' | 'wav') => void;
  onPrintParts: () => void;
}) {
  return (
    <aside className="ps-props ps-print-panel" aria-label="Print and export">
      <header><Printer size={15} /> <b>Print &amp; export</b></header>
      <div className="ps-props-body">
        <button className="ps-btn ps-primary ps-print-main" onClick={() => onExport('pdf')}><Printer size={15} /> Print / save as PDF</button>
        {parts > 1 && <button className="ps-btn ps-outline ps-print-main" onClick={onPrintParts}>Print parts…</button>}
        {!pageView && <p className="ps-hint">You're in continuous view. <button className="ps-link" onClick={onPageView}>Show pages</button> to see the layout.</p>}
        <h4 className="ps-set-head">Page</h4>
        <div className="ps-field"><label>Paper</label>
          <select className="ps-select" value={layout.pageSize} onChange={(e) => onLayout({ ...layout, pageSize: e.target.value as LayoutOptions['pageSize'] })}>
            <option value="letter">US Letter</option><option value="a4">A4</option>
          </select>
        </div>
        <div className="ps-field"><label>Staff size</label>
          <select className="ps-select" value={layout.staffSize} onChange={(e) => onLayout({ ...layout, staffSize: Number(e.target.value) })}>
            {[70, 80, 90, 100, 110, 120, 130].map((v) => <option key={v} value={v}>{v === 100 ? 'Normal' : `${v}%`}</option>)}
          </select>
        </div>
        <div className="ps-field"><label>Measures per line</label>
          <select className="ps-select" value={layout.perLine} onChange={(e) => onLayout({ ...layout, perLine: Number(e.target.value) })}>
            <option value={0}>Automatic</option>{[2, 3, 4, 5, 6, 8].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <h4 className="ps-set-head">Export</h4>
        <div className="ps-export-grid">
          <button className="ps-btn ps-outline" onClick={() => onExport('musicxml')}>MusicXML</button>
          <button className="ps-btn ps-outline" onClick={() => onExport('midi')}>MIDI</button>
          <button className="ps-btn ps-outline" onClick={() => onExport('wav')}>Audio (WAV)</button>
          <button className="ps-btn ps-outline" onClick={() => onExport('svg')}>SVG pages</button>
          <button className="ps-btn ps-outline" onClick={() => onExport('mei')}>MEI</button>
        </div>
        <p className="ps-hint">MusicXML opens in MuseScore, Sibelius, Finale, Dorico and Noteflight.</p>
      </div>
    </aside>
  );
}
