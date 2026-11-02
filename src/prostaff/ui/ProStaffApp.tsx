import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Play, Pause, Square, SkipBack, Maximize, Minimize, Undo2, Redo2, Settings, UserRound, MessageSquare, Wrench, ZoomIn, ZoomOut, PanelLeft, Repeat, Timer, SlidersHorizontal, Keyboard, ChevronDown, Pencil, Music, Camera,
} from 'lucide-react';
import type { VerovioToolkit } from 'verovio/esm';
import './prostaff.css';
import { getToolkit, getConverter, renderOptions, printOptions, DEFAULT_VIEW, type ViewOptions } from '../engine/verovio';
import { Score, isTabStaff } from '../model/score';
import { ancestor, child, children, descendants, getId, keyAlter, midiOf, stepOf, fromStep } from '../model/mei';
import * as E from '../model/edit';
import { NONE, type Selection, type InputState, type CommandResult, type Clip, EditError } from '../model/edit';
import { instrumentById } from '../model/instruments';
import { Player, DEFAULT_MASTER_MIX, DEFAULT_STAFF_MIX, type MasterMix, type StaffMix } from '../audio/player';
import { Mixer } from './Mixer';
import { WolfiBrand, wolfiFaviconHref } from './Logo';
import { NoteIcon } from './NoteIcon';
import { InlineEdit, HeaderEditor } from './TitleEdit';
import * as T from '../model/tools';
import { rangeIssues, partWritingIssues, outOfRangeNoteIds, type Issue } from '../model/analysis';
import * as Cloud from '../io/cloud';
import { AccountDialog, ShareDialog, VersionsDialog, CommentsPanel } from './CloudUI';
import { SettingsDialog, IssuesPanel, PrintPartsDialog, ProgressDialog, DEFAULT_LAYOUT, DEFAULT_PREFS, type LayoutOptions, type AppPrefs, type SettingsTab } from './Extras';
import { FONTS_HREF, applyTextFont } from './appearance';
import { buildFollow, followAt, type FollowPoint } from './follow';
import { DEFAULT_PLAYBACK, CHORD_STAFF, type PlaybackOptions } from '../audio/schedule';
import { renderWav } from '../audio/export';
import { buildSchedule, type Schedule } from '../audio/schedule';
import { importScoreFile, importScoreText, download, safeFileName, base64ToBytes, printPages, IMPORT_ACCEPT } from '../io/files';
import { listScores, loadScore, saveScore, deleteScore, lastOpenedId, type StoredScore } from '../io/storage';
import { recognizePages, mergeMusicXml, type ScanPage } from '../io/omr';
import { Palette, type PaletteActions } from './Palette';
import { NewScoreDialog, LibraryDialog, PropertiesDialog, PartsDialog, TransposeDialog, ScanDialog, ShortcutsDialog, type NewScoreOptions } from './Dialogs';

type DialogKind = null | 'new' | 'library' | 'props' | 'parts' | 'transpose' | 'scan' | 'shortcuts' | 'account' | 'share' | 'versions' | 'settings' | 'printParts';
type PromptKind = 'staff-text' | 'expression' | 'tempo' | 'rehearsal' | 'chord' | 'lyrics' | 'fingering' | 'meter' | 'roman' | 'figbass';

const DURATIONS: { dur: string; glyph: string; key: string; name: string }[] = [
  { dur: '1', glyph: '𝅝', key: '7', name: 'Whole' },
  { dur: '2', glyph: '𝅗𝅥', key: '6', name: 'Half' },
  { dur: '4', glyph: '♩', key: '5', name: 'Quarter' },
  { dur: '8', glyph: '♪', key: '4', name: 'Eighth' },
  { dur: '16', glyph: '𝅘𝅥𝅯', key: '3', name: '16th' },
  { dur: '32', glyph: '𝅘𝅥𝅰', key: '2', name: '32nd' },
  { dur: '64', glyph: '𝅘𝅥𝅱', key: '1', name: '64th' },
];
const KEY_TO_DUR: Record<string, string> = { '1': '64', '2': '32', '3': '16', '4': '8', '5': '4', '6': '2', '7': '1' };
const VOICE_COLORS = ['#5b8def', '#4fb37f', '#e08a3c', '#b07cd8'];
const CLICKABLE = [
  'note', 'rest', 'mRest', 'multiRest', 'chord', 'space', 'dynam', 'dir', 'tempo', 'harm', 'slur', 'hairpin', 'syl', 'fermata', 'trill', 'mordent', 'turn',
  'reh', 'fing', 'pedal', 'octave', 'gliss', 'breath', 'caesura', 'repeatMark', 'arpeg', 'clef', 'tie',
].map((c) => `g.${c}`).join(', ');

function loadView(): ViewOptions {
  try {
    return { ...DEFAULT_VIEW, ...JSON.parse(localStorage.getItem('prostaff:view2') || '{}') };
  } catch {
    return DEFAULT_VIEW;
  }
}

function newDocId() {
  return 'ps_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function defaultScore() {
  return Score.create({ title: 'Untitled Score', composer: '', instruments: ['piano'], keyFifths: 0, meterCount: 4, meterUnit: 4, tempo: 100, tempoText: 'Moderato', measures: 16 });
}

/** A copy of the score with only some staves, for part view (same ids, so editing still works). */
function partMei(score: Score, staffNs: string[]): string {
  const copy = score.clone();
  const keep = new Set(staffNs);
  for (const sd of copy.staffDefs()) {
    if (!keep.has(sd.getAttribute('n') || '')) {
      const p = sd.parentElement!;
      sd.remove();
      if (p.localName === 'staffGrp' && !descendants(p, 'staffDef').length) p.remove();
    }
  }
  const removed = new Set<string>();
  for (const m of copy.measures()) {
    for (const s of children(m, 'staff')) if (!keep.has(s.getAttribute('n') || '')) {
      for (const d of Array.from(s.getElementsByTagName('*'))) removed.add(getId(d));
      s.remove();
    }
  }
  for (const m of copy.measures()) {
    for (const c of children(m)) {
      if (c.localName === 'staff') continue;
      const st = c.getAttribute('staff');
      const sid = (c.getAttribute('startid') || '').replace(/^#/, '');
      if ((st && !st.split(' ').some((x) => keep.has(x))) || (sid && removed.has(sid))) c.remove();
    }
  }
  return copy.toString();
}

/** What the screen shows: the full score or some parts (with multi-measure rests), optionally N measures per line. */
function renderCopy(score: Score, staves: string[] | null, perLine: number): string {
  if (!staves && !perLine) return score.toString();
  const copy = staves ? Score.fromMei(partMei(score, staves)) : score.clone();
  if (staves) T.condenseRests(copy);
  if (perLine) T.breakEvery(copy, perLine);
  return copy.toString();
}

function soundingMidi(score: Score, note: Element): number {
  const fifths = E.keyAt(score, note);
  const pname = note.getAttribute('pname') || 'c';
  const midi = midiOf(pname, Number(note.getAttribute('oct') || 4), Score.alterOf(note, keyAlter(fifths, pname)));
  const staffN = ancestor(note, 'staff')?.getAttribute('n') || '1';
  const sd = score.staffDefs().find((d) => d.getAttribute('n') === staffN);
  return midi + Number(sd?.getAttribute('trans.semi') || 0);
}

/** Toolbar buttons shouldn't take keyboard focus: Space must always play/pause, not re-press the last button. */
function keepFocus(e: React.MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) e.preventDefault();
}

const PITCH_NAMES: Record<string, string> = { s: '♯', f: '♭', n: '', ss: '𝄪', x: '𝄪', ff: '𝄫' };

export default function ProStaffApp() {
  const scoreRef = useRef<Score | null>(null);
  const tkRef = useRef<VerovioToolkit | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [version, setVersion] = useState(0);
  const [docId, setDocId] = useState('');
  const [sel, setSel] = useState<Selection>(NONE);
  const [cursor, setCursor] = useState<string | null>(null);
  const [mode, setMode] = useState<'input' | 'normal'>('normal');
  const [input, setInput] = useState<InputState>({ dur: '4', dots: 0, voice: '1' });
  const [view, setView] = useState<ViewOptions>(loadView);
  const [partView, setPartView] = useState('all');
  const [pages, setPages] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [library, setLibrary] = useState<Omit<StoredScore, 'mei'>[]>([]);
  const [prompt, setPrompt] = useState<{ kind: PromptKind; anchor: string; value: string } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [palette, setPalette] = useState(() => window.innerWidth > 820);
  const [playing, setPlaying] = useState(false);
  const [tempoPct, setTempoPct] = useState(100);
  const [loop, setLoop] = useState(false);
  const [mix, setMix] = useState<Record<string, StaffMix>>({});
  const [masterMix, setMasterMix] = useState<MasterMix>(DEFAULT_MASTER_MIX);
  const [showMixer, setShowMixer] = useState(false);
  const [soundLoading, setSoundLoading] = useState<number | null>(null);
  const [headerEdit, setHeaderEdit] = useState<{ left: number; top: number } | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('appearance');
  const openSettings = (tab: SettingsTab) => {
    setSettingsTab(tab);
    setDialog('settings');
  };
  // the scanner turns itself on once the server has its API key
  const [scanReady, setScanReady] = useState(false);
  useEffect(() => {
    fetch('/api/omr').then((r) => r.json()).then((d) => setScanReady(!!d?.configured)).catch(() => setScanReady(false));
  }, []);
  // accounts & online saving
  const [user, setUser] = useState<Cloud.WolfiUser | null>(null);
  const [classes, setClasses] = useState<Cloud.WolfiClass[]>([]);
  const [cloud, setCloud] = useState<Cloud.CloudScore | null>(null); // the open score's online record
  const [readOnly, setReadOnly] = useState<string | null>(null); // why the score is view-only, if it is
  const [cloudState, setCloudState] = useState<'off' | 'saved' | 'saving' | 'error'>('off');
  const [side, setSide] = useState<null | 'comments' | 'issues'>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [progress, setProgress] = useState<{ title: string; text: string; fraction: number | null; abort?: AbortController } | null>(null);
  const [prefs, setPrefs] = useState<AppPrefs>(() => {
    try {
      return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('wolfi:prefs') || '{}') };
    } catch {
      return DEFAULT_PREFS;
    }
  });
  // the click and count-in stay as you left them (on this device)
  const metronome = prefs.metronome;
  const countIn = prefs.countIn;
  const setMetronome = (on: boolean) => setPrefs((p) => ({ ...p, metronome: on }));
  const setCountIn = (on: boolean) => setPrefs((p) => ({ ...p, countIn: on }));
  const [midiDevices, setMidiDevices] = useState<string[]>([]);
  const cloudRef = useRef<{ id: string | null; version: number | null }>({ id: null, version: null });
  const replaceScoreRef = useRef<(score: Score, id?: string, created?: number) => void>(() => {});
  const [scanBusy, setScanBusy] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [scanError, setScanError] = useState('');
  const undoRef = useRef<{ mei: string; sel: Selection; cursor: string | null }[]>([]);
  const redoRef = useRef<{ mei: string; sel: Selection; cursor: string | null }[]>([]);
  const clipRef = useRef<Clip | null>(null);
  const scheduleRef = useRef<Schedule | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createdRef = useRef<number>(Date.now());
  const player = useMemo(() => new Player(), []);
  const anchorRef = useRef<string | null>(null);

  // latest values for event handlers; the setters below update them immediately so fast typing
  // never acts on a stale cursor between renders
  const live = useRef({ sel, cursor, mode, input, prompt, dialog, user: null as Cloud.WolfiUser | null, readOnly: null as string | null });
  live.current = { sel, cursor, mode, input, prompt, dialog, user, readOnly };
  const updSel = useCallback((v: Selection) => { live.current.sel = v; setSel(v); }, []);
  const updCursor = useCallback((v: string | null) => { live.current.cursor = v; setCursor(v); }, []);
  const updMode = useCallback((v: 'input' | 'normal') => { live.current.mode = v; setMode(v); }, []);
  const updInput = useCallback((v: InputState | ((x: InputState) => InputState)) => {
    const nv = typeof v === 'function' ? v(live.current.input) : v;
    live.current.input = nv;
    setInput(nv);
  }, []);

  if (import.meta.env.DEV) (window as any).__prostaff = { score: () => scoreRef.current, tk: () => tkRef.current, live, player };

  const showToast = useCallback((msg: string, err = false) => {
    if (import.meta.env.DEV) ((window as any).__psToasts ||= []).push((err ? 'ERR: ' : '') + msg);
    setToast({ msg, err });
    window.clearTimeout((showToast as any)._t);
    (showToast as any)._t = window.setTimeout(() => setToast(null), err ? 5000 : 2800);
  }, []);

  // ---------- loading ----------

  useEffect(() => {
    document.title = 'Wolfi — Pro Staff Notation';
    const icon = document.createElement('link');
    icon.rel = 'icon';
    icon.type = 'image/svg+xml';
    icon.href = wolfiFaviconHref();
    const oldIcons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    oldIcons.forEach((l) => l.remove());
    document.head.appendChild(icon);
    const fonts = document.createElement('link');
    fonts.rel = 'stylesheet';
    fonts.href = FONTS_HREF;
    document.head.appendChild(fonts);
    let cancelled = false;
    (async () => {
      try {
        const [tk] = await Promise.all([getToolkit()]);
        if (cancelled) return;
        tkRef.current = tk;
        // who is signed in (online saving is optional)
        if (Cloud.getToken()) Cloud.me().then((r) => { setUser(r.user); setClasses(r.classes); }).catch(() => {});
        const shareToken = new URLSearchParams(location.search).get('share');
        if (shareToken) {
          try {
            const shared = await Cloud.sharedGet(shareToken);
            scoreRef.current = Score.fromMei(shared.mei);
            setDocId(newDocId());
            setReadOnly(`Shared by ${shared.ownerName} — view only. Edit to make your own copy.`);
            setReady(true);
            setVersion((v) => v + 1);
            return;
          } catch (e) {
            showToast(e instanceof Error ? e.message : 'That shared link could not be opened.', true);
          }
        }
        const last = lastOpenedId();
        const rec = last ? await loadScore(last) : null;
        if (rec) {
          scoreRef.current = Score.fromMei(rec.mei);
          T.syncTabs(scoreRef.current);
          cloudRef.current = { id: (scoreRef.current.getSettings() as { cloudId?: string }).cloudId || null, version: null };
          createdRef.current = rec.createdAt;
          setDocId(rec.id);
        } else {
          scoreRef.current = defaultScore();
          setDocId(newDocId());
          setDialog('new');
        }
        setReady(true);
        setVersion((v) => v + 1);
      } catch (e) {
        console.error(e);
        setLoadError('The notation engine could not be loaded. Check your connection and reload.');
      }
    })();
    return () => {
      cancelled = true;
      fonts.remove();
      icon.remove();
      oldIcons.forEach((l) => document.head.appendChild(l));
      player.stop(false);
    };
  }, [player]);

  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let t = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(t);
      t = window.setTimeout(() => setStageW((w) => (Math.abs(w - el.clientWidth) > 24 ? el.clientWidth : w)), 150);
    });
    ro.observe(el);
    setStageW(el.clientWidth);
    return () => ro.disconnect();
  }, [ready]);

  // per-score settings (saved in the score) and per-computer preferences
  const scoreSettings = (scoreRef.current?.getSettings() || {}) as { playback?: Partial<PlaybackOptions>; layout?: Partial<LayoutOptions> };
  const playback: PlaybackOptions = { ...DEFAULT_PLAYBACK, ...scoreSettings.playback };
  const layout: LayoutOptions = { ...DEFAULT_LAYOUT, ...scoreSettings.layout };
  const updateScoreSettings = (patch: Record<string, unknown>) => {
    const sc = scoreRef.current;
    if (!sc) return;
    sc.setSettings(patch);
    scheduleRef.current = null;
    setSaveState('unsaved');
    setVersion((v) => v + 1);
  };
  useEffect(() => {
    try {
      localStorage.setItem('wolfi:prefs', JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  // ---------- render ----------

  useEffect(() => {
    const tk = tkRef.current;
    const s = scoreRef.current;
    if (!ready || !tk || !s) return;
    setRendering(true);
    const hasBreaks = descendants(s.doc, 'sb').length + descendants(s.doc, 'pb').length > 0;
    try {
      // fit the page to the screen width (systems reflow); printing always uses full-size pages
      const phone = stageW > 0 && stageW < 600;
      const zoom = phone ? Math.min(view.zoom, 38) : view.zoom;
      const fitWidth = stageW ? Math.max(phone ? 800 : 1100, Math.min(view.pageWidth, Math.floor((stageW - (phone ? 24 : 56)) / (zoom / 100)))) : view.pageWidth;
      tk.setOptions({ ...renderOptions({ ...view, zoom, pageWidth: fitWidth }, hasBreaks), ...(layout.perLine ? { breaks: 'line' } : {}) });
      const mei = renderCopy(s, partView === 'all' ? null : partView.split(','), layout.perLine);
      if (!tk.loadData(mei)) throw new Error('render failed');
      const n = tk.getPageCount();
      const out: string[] = [];
      for (let i = 1; i <= n; i++) out.push(applyTextFont(tk.renderToSVG(i), prefs.textFont));
      setPages(out);
    } catch (e) {
      console.error(e);
      showToast('The score could not be drawn. Undo the last change (Ctrl+Z).', true);
    }
    scheduleRef.current = null;
    setRendering(false);
  }, [ready, version, view, partView, showToast, stageW, layout.perLine, prefs.textFont]);

  useEffect(() => {
    try {
      localStorage.setItem('prostaff:view2', JSON.stringify(view));
    } catch {
      /* ignore */
    }
  }, [view]);

  // ---------- online saving ----------

  const openCloud = useCallback(async (id: string) => {
    try {
      const rec = await Cloud.getScore(id);
      const score = Score.fromMei(rec.mei);
      score.setSettings({ cloudId: rec.id });
      T.syncTabs(score);
      replaceScoreRef.current(score, 'c_' + rec.id);
      cloudRef.current = { id: rec.id, version: rec.version };
      setCloud(rec);
      setReadOnly(rec.canEdit ? null : `${rec.ownerName}'s score — view only. Edit to make your own copy.`);
      setSaveState('saved');
      setCloudState('saved');
      setDialog(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That score could not be opened.', true);
    }
  }, [showToast]);

  const saveOnline = useCallback(async (force = false): Promise<void> => {
    const sc = scoreRef.current;
    if (!sc || !live.current.user || live.current.readOnly) return;
    const meta = sc.getMeta();
    const id = cloudRef.current.id || ((sc.getSettings() as { cloudId?: string }).cloudId ?? undefined) || undefined;
    setCloudState('saving');
    try {
      const r = await Cloud.saveScore({ id, title: meta.title || 'Untitled', composer: meta.composer, mei: sc.toString(), baseVersion: force || !id || cloudRef.current.version == null ? undefined : cloudRef.current.version });
      cloudRef.current = { id: r.id, version: r.version };
      if ((sc.getSettings() as { cloudId?: string }).cloudId !== r.id) sc.setSettings({ cloudId: r.id });
      setCloudState('saved');
    } catch (e) {
      if (e instanceof Cloud.CloudError && e.data?.conflict) {
        const keep = confirm(`${e.data.updatedBy || 'Someone'} saved a newer version of this score online.\n\nOK = keep YOUR version (replace theirs)\nCancel = open THEIR version`);
        if (keep) return saveOnline(true);
        if (id) await openCloud(id);
        return;
      }
      if (e instanceof Cloud.CloudError && e.status === 404 && id) {
        cloudRef.current = { id: null, version: null };
        sc.setSettings({ cloudId: null });
        return saveOnline();
      }
      if (e instanceof Cloud.CloudError && e.status === 401) setUser(null);
      setCloudState('error');
    }
  }, [openCloud]);

  // ---------- autosave ----------

  const saveNow = useCallback(async () => {
    const s = scoreRef.current;
    if (!s || !docId) return;
    setSaveState('saving');
    const meta = s.getMeta();
    try {
      await saveScore({ id: docId, title: meta.title || 'Untitled', composer: meta.composer, mei: s.toString(), createdAt: createdRef.current, updatedAt: Date.now() });
      setSaveState('saved');
      if (live.current.user && !live.current.readOnly) void saveOnline();
    } catch {
      setSaveState('unsaved');
      showToast('Could not save in this browser (storage may be full or blocked).', true);
    }
  }, [docId, showToast, saveOnline]);

  useEffect(() => {
    if (!ready || saveState !== 'unsaved') return;
    const t = window.setTimeout(() => void saveNow(), 1200);
    return () => window.clearTimeout(t);
  }, [version, ready, saveState, saveNow]);

  // ---------- commands ----------

  const run = useCallback((fn: (s: Score) => CommandResult | void) => {
    const s = scoreRef.current;
    if (!s) return;
    const before = s.toString();
    const { sel: curSel, cursor: curCursor } = live.current;
    try {
      const r = fn(s) || {};
      s.invalidate();
      T.syncTabs(s);
      if (live.current.readOnly) {
        // editing a view-only score makes it your own copy
        live.current.readOnly = null;
        setReadOnly(null);
        cloudRef.current = { id: null, version: null };
        s.setSettings({ cloudId: null });
        setCloud(null);
        setDocId(newDocId());
        showToast('This is now your own copy.');
      }
      undoRef.current.push({ mei: before, sel: curSel, cursor: curCursor });
      if (undoRef.current.length > 80) undoRef.current.shift();
      redoRef.current = [];
      if (r.selection) updSel(r.selection);
      if (r.cursor !== undefined) updCursor(r.cursor);
      if (r.message) showToast(r.message);
      setSaveState('unsaved');
      setVersion((v) => v + 1);
      return r;
    } catch (e) {
      scoreRef.current = Score.fromMei(before);
      if (e instanceof EditError) showToast(e.message, true);
      else {
        console.error(e);
        showToast('That change could not be made' + (e instanceof Error ? `: ${e.message}` : '.'), true);
      }
      setVersion((v) => v + 1);
      return undefined;
    }
  }, [showToast]);

  const undo = useCallback(() => {
    const s = scoreRef.current;
    const prev = undoRef.current.pop();
    if (!s || !prev) return;
    redoRef.current.push({ mei: s.toString(), sel: live.current.sel, cursor: live.current.cursor });
    scoreRef.current = Score.fromMei(prev.mei);
    updSel(prev.sel);
    updCursor(prev.cursor);
    setSaveState('unsaved');
    setVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    const s = scoreRef.current;
    const next = redoRef.current.pop();
    if (!s || !next) return;
    undoRef.current.push({ mei: s.toString(), sel: live.current.sel, cursor: live.current.cursor });
    scoreRef.current = Score.fromMei(next.mei);
    updSel(next.sel);
    updCursor(next.cursor);
    setSaveState('unsaved');
    setVersion((v) => v + 1);
  }, []);

  const audition = useCallback((ids: string[]) => {
    const s = scoreRef.current;
    if (!s) return;
    const midis: number[] = [];
    let sample = 'piano';
    let staffN = '1';
    let program = 0;
    for (const id of ids) {
      const e = s.byId(id);
      if (!e) continue;
      const notes = e.localName === 'note' ? [e] : e.localName === 'chord' ? children(e, 'note') : [];
      for (const n of notes) midis.push(soundingMidi(s, n));
      staffN = ancestor(e, 'staff')?.getAttribute('n') || '1';
      const st = s.staves().find((x) => x.n === staffN);
      if (st?.instrumentId) sample = instrumentById(st.instrumentId).sample;
      program = st?.program ?? 0;
    }
    if (midis.length && sample !== 'drum_kit') void player.audition(sample, midis, staffN, program);
  }, [player]);

  const replaceScore = useCallback((score: Score, id = newDocId(), created = Date.now()) => {
    player.stop(false);
    setPlaying(false);
    scoreRef.current = score;
    setReadOnly(null);
    live.current.readOnly = null;
    setCloud(null);
    const cid = (score.getSettings() as { cloudId?: string }).cloudId;
    cloudRef.current = { id: cid || null, version: null };
    setSide(null);
    createdRef.current = created;
    undoRef.current = [];
    redoRef.current = [];
    setDocId(id);
    updSel(NONE);
    updCursor(null);
    updMode('normal');
    setPartView('all');
    setSaveState('unsaved');
    setVersion((v) => v + 1);
    stageRef.current?.scrollTo({ top: 0, left: 0 });
  }, [player]);
  replaceScoreRef.current = replaceScore;

  /** Switches to note input with the cursor on the selected note/rest (or the selected measure's start). */
  const startInputCursor = useCallback((): string | null => {
    const sc = scoreRef.current;
    if (!sc) return null;
    const { sel: cur, input: inp } = live.current;
    let id: string | null = null;
    try {
      if (cur.kind === 'events') {
        const e = sc.byId(cur.ids[0]);
        if (e && ['note', 'chord', 'rest', 'space', 'mRest', 'mSpace'].includes(e.localName)) id = getId(E.eventOf(e));
      }
      if (!id) id = getId(E.cursorTarget(sc, null, cur, inp));
    } catch {
      id = null;
    }
    updMode('input');
    updCursor(id);
    return id;
  }, [updMode, updCursor]);

  // ---------- selection helpers ----------

  const selectId = useCallback((id: string, extend: boolean) => {
    const s = scoreRef.current!;
    const e = s.byId(id);
    if (!e) return;
    const { sel: cur, mode: m } = live.current;
    const isLeaf = ['note', 'chord', 'rest', 'space', 'mRest', 'mSpace', 'multiRest'].includes(e.localName);
    if (extend && cur.kind === 'events' && isLeaf) {
      const first = s.byId(cur.ids[0]);
      if (first && ['note', 'chord', 'rest', 'space', 'mRest'].includes(first.localName)) {
        const a = E.eventOf(first);
        const b = E.eventOf(e);
        const la = E.locate(a);
        const lb = E.locate(b);
        if (la.staffN === lb.staffN && la.layerN === lb.layerN) {
          const seq = E.leafSequence(s, la.staffN, la.layerN, true);
          const i = seq.indexOf(a);
          const j = seq.indexOf(b);
          if (i >= 0 && j >= 0) {
            const [x, y] = i < j ? [i, j] : [j, i];
            const ids = seq.slice(x, y + 1).map(getId);
            if (i > j) ids.reverse();
            updSel({ kind: 'events', ids: i <= j ? ids : ids.reverse() });
            return;
          }
        }
      }
    }
    updSel({ kind: 'events', ids: [id] });
    if (isLeaf) updCursor(getId(E.eventOf(e)));
    void m;
    if (isLeaf && (e.localName === 'note' || e.localName === 'chord')) audition([id]);
  }, [audition]);

  // ---------- mouse note entry ----------

  interface StaffGeom { staffId: string; left: number; right: number; top: number; space: number; lines: number }
  const pagesRef = useRef<HTMLDivElement>(null);
  const geomRef = useRef<StaffGeom[]>([]);
  const hoverRef = useRef<{ g: StaffGeom; pos: number; x: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; space: number; ledgers: number[] } | null>(null);

  /** Records where every staff's lines are on screen, relative to the pages container. */
  const measureStaves = useCallback(() => {
    const root = pagesRef.current;
    if (!root) return;
    const base = root.getBoundingClientRect();
    const out: StaffGeom[] = [];
    root.querySelectorAll('g.staff').forEach((g) => {
      const lines = Array.from(g.children).filter((c) => c.tagName === 'path');
      if (!lines.length || !g.id) return;
      const r0 = lines[0].getBoundingClientRect();
      const rN = lines[lines.length - 1].getBoundingClientRect();
      const top = r0.top + r0.height / 2 - base.top;
      const bottom = rN.top + rN.height / 2 - base.top;
      out.push({ staffId: g.id, left: r0.left - base.left, right: r0.right - base.left, top, space: lines.length > 1 ? (bottom - top) / (lines.length - 1) : 8, lines: lines.length });
    });
    geomRef.current = out;
  }, []);

  useLayoutEffect(() => {
    measureStaves();
  }, [pages, palette, measureStaves]);
  useEffect(() => {
    window.addEventListener('resize', measureStaves);
    return () => window.removeEventListener('resize', measureStaves);
  }, [measureStaves]);
  useEffect(() => {
    if (mode !== 'input') {
      setGhost(null);
      hoverRef.current = null;
    }
  }, [mode]);

  const onStageMove = useCallback((ev: React.MouseEvent) => {
    if (live.current.mode !== 'input' || !pagesRef.current) return;
    const base = pagesRef.current.getBoundingClientRect();
    const x = ev.clientX - base.left;
    const y = ev.clientY - base.top;
    let best: StaffGeom | null = null;
    let bestD = Infinity;
    for (const g of geomRef.current) {
      if (x < g.left || x > g.right) continue;
      const mid = g.top + ((g.lines - 1) * g.space) / 2;
      const d = Math.abs(y - mid);
      if (d < bestD && d < ((g.lines - 1) * g.space) / 2 + g.space * 4.5) {
        best = g;
        bestD = d;
      }
    }
    if (!best) {
      if (hoverRef.current) setGhost(null);
      hoverRef.current = null;
      return;
    }
    const maxPos = (best.lines - 1) * 2;
    const pos = Math.max(-9, Math.min(maxPos + 9, Math.round((y - best.top) / (best.space / 2))));
    hoverRef.current = { g: best, pos, x };
    const ledgers: number[] = [];
    for (let p = -2; p >= pos; p -= 2) ledgers.push(p);
    for (let p = maxPos + 2; p <= pos; p += 2) ledgers.push(p);
    setGhost((old) => {
      const ny = best!.top + (pos * best!.space) / 2;
      if (old && Math.abs(old.x - x) < 1 && old.y === ny) return old;
      return { x, y: ny, space: best!.space, ledgers: ledgers.map((p) => best!.top + (p * best!.space) / 2) };
    });
  }, []);

  /** The written pitch at a staff position (0 = top line, counting down in steps) for the staff's clef. */
  const pitchAt = (sc: Score, staffN: string, pos: number, lines: number) => {
    const sd = sc.staffDefs().find((d) => d.getAttribute('n') === staffN);
    const clefEl = sd ? child(sd, 'clef') : null;
    const shape = sd?.getAttribute('clef.shape') || clefEl?.getAttribute('shape') || 'G';
    const line = Number(sd?.getAttribute('clef.line') || clefEl?.getAttribute('line') || (shape === 'F' ? 4 : shape === 'C' ? 3 : 2));
    const dis = Number(sd?.getAttribute('clef.dis') || clefEl?.getAttribute('dis') || 0);
    const place = sd?.getAttribute('clef.dis.place') || clefEl?.getAttribute('dis.place') || 'below';
    const ref = shape === 'F' ? stepOf('f', 3) : shape === 'C' ? stepOf('c', 4) : stepOf('g', 4);
    let topStep = ref + (lines - (shape === 'perc' ? 2 : line)) * 2;
    if (dis) topStep += (place === 'above' ? 1 : -1) * (dis === 15 ? 14 : 7);
    return fromStep(topStep - pos);
  };

  const mouseEnter = useCallback((): boolean => {
    const h = hoverRef.current;
    const sc = scoreRef.current;
    const root = pagesRef.current;
    if (!h || !sc || !root) return false;
    const staffEl = sc.byId(h.g.staffId);
    const measure = staffEl ? ancestor(staffEl, 'measure') : null;
    if (!staffEl || !measure) return false;
    const staffN = staffEl.getAttribute('n') || '1';
    const pitch = pitchAt(sc, staffN, h.pos, h.g.lines);
    const inp = live.current.input;
    const base = root.getBoundingClientRect();
    const r = run((s2) => {
      const layer = E.voiceLayer(s2, measure, staffN, inp.voice);
      const layerN = layer.getAttribute('n') || '1';
      const leaves = E.leafSequence(s2, staffN, layerN, false).filter((x) => ancestor(x, 'measure') === measure);
      if (!leaves.length) throw new EditError('Click inside a measure.');
      // the event under (or just left of) the click
      let pick = leaves[0];
      let pickCenter = Infinity;
      for (const leaf of leaves) {
        const elx = root.querySelector(`[id="${CSS.escape(getId(leaf))}"]`);
        if (!elx) continue;
        const rr = elx.getBoundingClientRect();
        const left = rr.left - base.left;
        if (left - h.g.space * 0.9 <= h.x) {
          pick = leaf;
          pickCenter = left + rr.width / 2;
        }
      }
      const onIt = Math.abs(h.x - pickCenter) < h.g.space * 1.4;
      if (onIt && (pick.localName === 'note' || pick.localName === 'chord')) return E.addChordPitch(s2, getId(pick), pitch);
      return E.enterPitchAt(s2, getId(pick), pitch, inp);
    });
    if (r?.selection?.kind === 'events') audition(r.selection.ids);
    return true;
  }, [run, audition]);

  const onStageClick = useCallback((ev: React.MouseEvent) => {
    const s = scoreRef.current;
    if (!s) return;
    setMenu(null);
    if (live.current.mode === 'input' && !ev.shiftKey) {
      onStageMove(ev); // taps on touch screens have no hover before the click
      if (hoverRef.current && mouseEnter()) return;
    }
    const t = ev.target as Element;
    setHeaderEdit(null);
    const head = t.closest?.('g.pgHead');
    if (head) {
      const r = head.getBoundingClientRect();
      setHeaderEdit({ left: Math.max(8, Math.min(window.innerWidth - 340, r.left + r.width / 2 - 160)), top: r.bottom + 6 });
      return;
    }
    const hit = t.closest?.(CLICKABLE);
    const hitId = hit?.id ? T.untabId(hit.id) : '';
    if (hitId && s.byId(hitId)) {
      let id = hitId;
      const el = s.byId(id)!;
      if (el.localName === 'syl') id = getId(ancestor(el, 'verse') || el);
      selectId(id, ev.shiftKey);
      return;
    }
    const staffG = t.closest?.('g.staff');
    const measureG = t.closest?.('g.measure');
    if (measureG?.id && staffG?.id) {
      const staffEl = s.byId(T.untabId(staffG.id));
      const n = staffEl?.getAttribute('n') || '1';
      const cur = live.current.sel;
      if (ev.shiftKey && cur.kind === 'measures') {
        const ms = s.measures();
        const ids = ms.map(getId);
        const a = ids.indexOf(cur.measureIds[0]);
        const b = ids.indexOf(measureG.id);
        const [x, y] = a < b ? [a, b] : [b, a];
        const allN = s.staffDefs().map((d) => d.getAttribute('n') || '1');
        const sa = allN.indexOf(cur.staves[0] || n);
        const sb = allN.indexOf(n);
        const [p, q] = sa < sb ? [sa, sb] : [sb, sa];
        updSel({ kind: 'measures', measureIds: ids.slice(x, y + 1), staves: allN.slice(p, q + 1) });
      } else {
        updSel({ kind: 'measures', measureIds: [measureG.id], staves: [n] });
        if (live.current.mode === 'input') {
          const m = s.byId(measureG.id)!;
          const leaf = E.firstLeaf(E.voiceLayer(s, m, n, live.current.input.voice));
          updCursor(leaf ? getId(E.eventOf(leaf)) : null);
        }
      }
      return;
    }
    updSel(NONE);
  }, [selectId, mouseEnter, onStageMove]);

  // ---------- prompts (text entry) ----------

  const openPrompt = useCallback((kind: PromptKind) => {
    const s = scoreRef.current;
    if (!s) return;
    const { sel: cur } = live.current;
    if (kind === 'meter') {
      setPrompt({ kind, anchor: '', value: '5/8' });
      return;
    }
    let anchor = '';
    if (cur.kind === 'events') anchor = cur.ids[0];
    else if (cur.kind === 'measures') {
      const m = s.byId(cur.measureIds[0]);
      const layer = m ? s.layerEl(m, cur.staves[0] || '1', '1') : null;
      const leaf = layer ? E.leafSequence(s, cur.staves[0] || '1', '1').find((x) => ancestor(x, 'measure') === m) : null;
      anchor = leaf ? getId(leaf) : '';
      void layer;
    }
    if (!anchor) {
      showToast('Select a note first.', true);
      return;
    }
    const e = s.byId(anchor)!;
    anchor = getId(E.eventOf(e));
    let value = '';
    if (kind === 'lyrics') value = E.lyricOf(s, anchor);
    if (kind === 'chord') {
      const h = descendants(ancestor(e, 'measure')!, 'harm').find((x) => x.getAttribute('startid') === '#' + anchor);
      value = h?.textContent || '';
    }
    if (kind === 'tempo') value = 'Allegro 120';
    setPrompt({ kind, anchor, value });
  }, [showToast]);

  const commitPrompt = useCallback((advance: boolean, raw?: string) => {
    const p = live.current.prompt;
    const s = scoreRef.current;
    if (!p || !s) return;
    const text = (raw ?? p.value).trim();
    const sel1: Selection = { kind: 'events', ids: [p.anchor] };
    if (p.kind === 'meter') {
      const m = /^(\d+(?:\+\d+)*)\s*\/\s*(\d+)$/.exec(text);
      if (!m) {
        showToast('Type a time signature like 5/8 or 3+2/8.', true);
        return;
      }
      const count = m[1].split('+').reduce((a, b) => a + Number(b), 0);
      run((sc) => E.changeMeter(sc, live.current.sel, count, Number(m[2])));
      setPrompt(null);
      return;
    }
    if (text || p.kind === 'lyrics' || p.kind === 'chord') {
      run((sc) => {
        switch (p.kind) {
          case 'lyrics':
            return E.setLyric(sc, p.anchor, text);
          case 'chord': {
            const e = sc.byId(p.anchor);
            if (e) for (const h of descendants(ancestor(e, 'measure')!, 'harm')) if (h.getAttribute('startid') === '#' + p.anchor) h.remove();
            if (!text) return { selection: sel1 };
            return E.addControl(sc, sel1, 'harm', { place: 'above' }, text.replace(/b(?=\d|$|\/|m|M|s|a|d)/g, '♭').replace(/#/g, '♯'));
          }
          case 'staff-text':
            return E.addControl(sc, sel1, 'dir', { place: 'above' }, text);
          case 'expression':
            return E.addControl(sc, sel1, 'dir', { place: 'below' }, text, { fontstyle: 'italic' });
          case 'rehearsal':
            return E.addControl(sc, sel1, 'reh', { place: 'above' }, text, { rend: 'box' });
          case 'fingering':
            return E.addControl(sc, sel1, 'fing', { place: 'above' }, text);
          case 'roman':
            return E.addControl(sc, sel1, 'harm', { type: 'roman', place: 'below' }, text);
          case 'figbass': {
            const r = E.addControl(sc, sel1, 'harm', { type: 'figbass', place: 'below' });
            const h = sc.byId(r.createdIds![0])!;
            const fb = h.appendChild(sc.doc.createElementNS(h.namespaceURI, 'fb'));
            for (const f of text.split(/[\s,/]+|(?<=\d)(?=\d)/).filter(Boolean)) fb.appendChild(sc.doc.createElementNS(h.namespaceURI, 'f')).textContent = f.replace(/b/g, '♭').replace(/#/g, '♯');
            return r;
          }
          case 'tempo': {
            const bpm = Number((/(\d{2,3})/.exec(text) || [])[1] || 0);
            const words = text.replace(/\d{2,3}/, '').replace(/[♩=]/g, '').trim();
            if (!bpm) throw new EditError('Include a number for the tempo, e.g. “Allegro 132”.');
            return E.addTempo(sc, sel1, bpm, words);
          }
        }
      });
    }
    if (advance && (p.kind === 'lyrics' || p.kind === 'chord')) {
      // move to the next note (lyrics skip rests)
      let n = s.byId(p.anchor) ? E.neighbor(scoreRef.current!, scoreRef.current!.byId(p.anchor)!, 1, false) : null;
      if (p.kind === 'lyrics') while (n && n.localName !== 'note' && n.localName !== 'chord') n = E.neighbor(scoreRef.current!, n, 1, false);
      if (n) {
        const id = getId(n);
        updSel({ kind: 'events', ids: [id] });
        setPrompt({ kind: p.kind, anchor: id, value: p.kind === 'lyrics' ? E.lyricOf(scoreRef.current!, id) : '' });
        return;
      }
    }
    setPrompt(null);
  }, [run, showToast]);

  // ---------- palette actions ----------

  const actions: PaletteActions = useMemo(() => ({
    artic: (name) => run((s) => E.toggleArtic(s, live.current.sel, name)),
    control: (name, attrs, text, rend) => run((s) => {
      if (name === 'arpeg') {
        const ev = E.selectedEvent(s, live.current.sel);
        const ch = ev ? E.eventOf(ev) : null;
        if (!ch || ch.localName !== 'chord') throw new EditError('Select a chord for the arpeggio.');
        const m = ancestor(ch, 'measure')!;
        const a = s.doc.createElementNS('http://www.music-encoding.org/ns/mei', 'arpeg');
        a.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:id', 'a' + Math.random().toString(36).slice(2, 10));
        a.setAttribute('plist', '#' + getId(ch));
        m.appendChild(a);
        return { selection: live.current.sel };
      }
      return E.addControl(s, live.current.sel, name, attrs, text, rend);
    }),
    spanner: (name, attrs) => run((s) => E.addSpanner(s, live.current.sel, name, attrs)),
    noteAttr: (attr, value, on) => run((s) => E.setNoteAttr(s, live.current.sel, attr, value, on)),
    grace: (kind) => run((s) => E.addGrace(s, live.current.sel, kind)),
    accidental: (alter) => run((s) => E.setAccidental(s, live.current.sel, alter)),
    cautionary: () => run((s) => E.toggleCautionary(s, live.current.sel)),
    tuplet: (n) => {
      const r = run((s) => E.makeTuplet(s, live.current.sel, n, live.current.cursor, live.current.input, live.current.mode));
      if (r && live.current.mode === 'input') {
        // keep typing in the tuplet's own note value (a quarter-note triplet takes eighths)
        let numbase = 1;
        while (numbase * 2 < n) numbase *= 2;
        updInput((x) => ({ ...x, dur: String(Number(x.dur) * numbase), dots: 0 }));
      }
    },
    prompt: (kind) => openPrompt(kind),
    clef: (shape, line, dis, place) => run((s) => E.insertClef(s, live.current.sel, shape, line, dis, place)),
    key: (f) => run((s) => E.changeKey(s, live.current.sel, f)),
    meter: (c, u, sym) => run((s) => {
      const m = E.measuresOf(s, live.current.sel)[0] || s.measures()[0];
      const r = E.changeMeter(s, live.current.sel, c, u, sym);
      T.rebar(s, m);
      return { ...r, selection: NONE };
    }),
    drum: (id) => {
      const startCursor = live.current.mode === 'input' ? live.current.cursor : null;
      const r = run((s) => T.drumNote(s, startCursor, live.current.sel, id, live.current.input, live.current.mode));
      if (r?.selection?.kind === 'events') audition(r.selection.ids);
    },
    barline: (kind) => run((s) => E.setBarline(s, live.current.sel, kind)),
    ending: (n) => run((s) => E.addEnding(s, live.current.sel, n)),
    repeatMark: (func, text) => run((s) => E.addRepeatMark(s, live.current.sel, func, text)),
    dirText: (text, italic) => run((s) => {
      const r = E.addControl(s, live.current.sel, 'dir', { place: 'above' }, text, italic ? { fontstyle: 'italic', fontweight: 'bold' } : undefined);
      return { ...r, selection: live.current.sel };
    }),
    addMeasures: (n) => run((s) => {
      const ms = E.insertMeasures(s, null, n, 'end');
      return { message: `Added ${n} measure${n > 1 ? 's' : ''} (now ${s.measures().length}).`, selection: { kind: 'measures', measureIds: [getId(ms[0])], staves: [] } };
    }),
    insertMeasure: () => run((s) => {
      const ms = E.measuresOf(s, live.current.sel);
      if (!ms.length) throw new EditError('Select a measure to insert before.');
      E.insertMeasures(s, ms[0], 1, 'before');
      return { selection: live.current.sel };
    }),
    deleteMeasures: () => run((s) => {
      const cur = live.current.sel;
      const ms = E.measuresOf(s, cur);
      return E.deleteMeasures(s, { kind: 'measures', measureIds: ms.map(getId), staves: [] });
    }),
    pageBreak: (kind) => run((s) => E.addBreak(s, live.current.sel, kind)),
  }), [run, openPrompt, updInput, audition]);

  // ---------- keyboard ----------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { sel: cur, cursor: cc, mode: m, input: inp, prompt: pr, dialog: dl } = live.current;
      if (dl || pr || !scoreRef.current) return;
      const tgt = e.target as HTMLElement;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      const handled = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (mod && !e.shiftKey && k.toLowerCase() === 'z') { handled(); undo(); return; }
      if ((mod && e.shiftKey && k.toLowerCase() === 'z') || (mod && k.toLowerCase() === 'y')) { handled(); redo(); return; }
      if (mod && k.toLowerCase() === 's') { handled(); void saveNow().then(() => showToast('Saved in this browser.')); return; }
      if (mod && k.toLowerCase() === 'c') { handled(); const c = E.copySelection(scoreRef.current, cur); if (c) { clipRef.current = c; showToast('Copied.'); } return; }
      if (mod && k.toLowerCase() === 'x') { handled(); const c = E.copySelection(scoreRef.current, cur); if (c) { clipRef.current = c; run((s) => E.deleteSelection(s, cur)); } return; }
      if (mod && k.toLowerCase() === 'v') { handled(); const c = clipRef.current; if (c) run((s) => E.paste(s, cur, c, m === 'input' ? cc : null, inp)); return; }
      if (mod && k.toLowerCase() === 'b') { handled(); actions.addMeasures(1); return; }
      if (mod && k.toLowerCase() === 'k') { handled(); openPrompt('chord'); return; }
      if (mod && k.toLowerCase() === 'l') { handled(); openPrompt('lyrics'); return; }
      if (mod && e.altKey && /^[1-4]$/.test(e.code.replace('Digit', ''))) { handled(); updInput((x) => ({ ...x, voice: e.code.replace('Digit', '') })); return; }
      if (mod && /^Digit[3-9]$/.test(e.code)) { handled(); actions.tuplet(Number(e.code.slice(5))); return; }
      if (mod && k.toLowerCase() === 'a') {
        handled();
        const s = scoreRef.current;
        updSel({ kind: 'measures', measureIds: s.measures().map(getId), staves: s.staffDefs().map((d) => d.getAttribute('n') || '1') });
        return;
      }
      if (mod && !k.startsWith('Arrow')) return;
      if (k === ' ') { handled(); void togglePlay(); return; }
      if (k === 'Home') { handled(); rewind(); return; }
      if (k === 'Escape') {
        handled();
        if (m === 'input') updMode('normal');
        else updSel(NONE);
        return;
      }
      if (k === '?') { handled(); setDialog('shortcuts'); return; }
      if (k.toLowerCase() === 'n' && !e.altKey) {
        handled();
        if (m === 'input') updMode('normal');
        else {
          updMode('input');
          const s = scoreRef.current;
          const target = E.cursorTarget(s, null, cur, inp);
          updCursor(getId(target));
          if (cur.kind === 'none') updSel({ kind: 'events', ids: [getId(target)] });
        }
        return;
      }
      if (/^[a-g]$/i.test(k) && !e.altKey) {
        handled();
        // typing a letter always writes a note: start note input at the selection if needed
        const startCursor = m === 'input' ? cc : startInputCursor();
        const r = run((s) => E.enterLetter(s, startCursor, live.current.sel, k, inp, 'input', e.shiftKey));
        if (r?.selection?.kind === 'events') audition(r.selection.ids);
        return;
      }
      if (k === '0' || k.toLowerCase() === 'r') {
        handled();
        if (m === 'normal' && cur.kind === 'events' && E.selectedNotes(scoreRef.current, cur).length) run((s) => E.deleteSelection(s, cur));
        else {
          const startCursor = m === 'input' ? cc : startInputCursor();
          run((s) => E.enterRest(s, startCursor, live.current.sel, inp, 'input'));
        }
        return;
      }
      if (/^[1-7]$/.test(k)) {
        handled();
        const dur = KEY_TO_DUR[k];
        updInput((x) => ({ ...x, dur, dots: 0 }));
        if (m === 'normal' && cur.kind === 'events') run((s) => E.setDuration(s, cur, dur, 0));
        return;
      }
      if (k === '.') {
        handled();
        if (m === 'input') updInput((x) => ({ ...x, dots: x.dots ? 0 : 1 }));
        else run((s) => E.toggleDot(s, cur));
        return;
      }
      if (k === '+' ) { handled(); actions.accidental(1); return; }
      if (k === '-' || k === '_') { handled(); actions.accidental(-1); return; }
      if (k === '=') { handled(); actions.accidental(0); return; }
      if (k === 'ArrowUp' || k === 'ArrowDown') {
        handled();
        const dir = k === 'ArrowUp' ? 1 : -1;
        if (cur.kind === 'events' && E.selectedNotes(scoreRef.current, cur).length) {
          const r = run((s) => E.transposeNotes(s, cur, dir, e.altKey && e.shiftKey ? 'step' : mod || (e.shiftKey && !e.altKey) ? 'octave' : 'semitone'));
          if (r && cur.ids.length === 1) audition(cur.ids);
        }
        return;
      }
      if (k === 'ArrowLeft' || k === 'ArrowRight') {
        handled();
        const s = scoreRef.current;
        const dir = k === 'ArrowRight' ? 1 : -1;
        if (cur.kind === 'measures') {
          const ms = s.measures();
          const i = ms.findIndex((x) => getId(x) === cur.measureIds[dir > 0 ? cur.measureIds.length - 1 : 0]);
          const n = ms[i + dir];
          if (n) updSel({ kind: 'measures', measureIds: [getId(n)], staves: cur.staves });
          return;
        }
        const id = m === 'input' && cc ? cc : cur.kind === 'events' ? cur.ids[cur.ids.length - 1] : null;
        const elx = id ? s.byId(id) : null;
        if (!elx) return;
        let next: Element | null = E.eventOf(elx);
        if (e.altKey || mod) {
          const meas = ancestor(next, 'measure')!;
          const ms = s.measures();
          const target = ms[ms.indexOf(meas) + dir];
          if (!target) return;
          const loc = E.locate(next);
          next = E.leafSequence(s, loc.staffN, loc.layerN).find((x) => ancestor(x, 'measure') === target) || null;
        } else {
          next = E.neighbor(s, next, dir as 1 | -1, true);
        }
        if (!next) return;
        const nid = getId(next);
        if (e.shiftKey && cur.kind === 'events') selectId(nid, true);
        else {
          updSel({ kind: 'events', ids: [nid] });
          if (m === 'input') updCursor(nid);
        }
        return;
      }
      if (k === 'Delete' || k === 'Backspace') { handled(); run((s) => E.deleteSelection(s, cur)); return; }
      if (k.toLowerCase() === 't') { handled(); run((s) => E.toggleTie(s, cur, cc, inp, m)); return; }
      if (k.toLowerCase() === 's') { handled(); actions.spanner('slur'); return; }
      if (k.toLowerCase() === 'k') { handled(); openPrompt('chord'); return; }
      if (k.toLowerCase() === 'l') { handled(); openPrompt('lyrics'); return; }
      if (k.toLowerCase() === 'x') { handled(); openPrompt('staff-text'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, undo, redo, actions, openPrompt, audition, selectId, saveNow, showToast]);

  // ---------- playback ----------

  // follow-along: a cursor line or a tinted measure, positioned every frame from the heard time
  const followRef = useRef<{ points: FollowPoint[]; end: number } | null>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const measureHiRef = useRef<HTMLDivElement>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  useEffect(() => {
    followRef.current = null; // the page was redrawn: measure positions again
  }, [pages]);
  useEffect(() => {
    player.clickOffsetMs = prefs.clickOffset;
  }, [player, prefs.clickOffset]);

  const clearPlayHighlight = useCallback(() => {
    stageRef.current?.querySelectorAll('.ps-playing').forEach((n) => n.classList.remove('ps-playing'));
    if (lineRef.current) lineRef.current.style.opacity = '0';
    if (measureHiRef.current) measureHiRef.current.style.opacity = '0';
  }, []);

  const stop = useCallback(() => {
    player.stop(false);
    setPlaying(false);
    clearPlayHighlight();
  }, [player, clearPlayHighlight]);

  /** Stops and goes back to the beginning: the next Play starts at measure 1. */
  function rewind() {
    stop();
    updSel(NONE);
    updCursor(null);
    if (timeRef.current) timeRef.current.textContent = '0:00';
    stageRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }

  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => showToast('Full screen is not available in this browser.', true));
  };

  async function togglePlay() {
    if (player.playing) {
      stop();
      return;
    }
    const tk = tkRef.current;
    const s = scoreRef.current;
    if (!tk || !s) return;
    let sched = scheduleRef.current;
    if (!sched) {
      try {
        sched = buildSchedule(tk, s, view.concertPitch, playback);
      } catch (e) {
        console.error(e);
        showToast('Playback could not be prepared for this score.', true);
        return;
      }
      scheduleRef.current = sched;
    }
    const cur = live.current.sel;
    let from = 0;
    let loopRange: { start: number; end: number } | null = null;
    const timeOf = (id: string): number | undefined => {
      const e = s.byId(id);
      if (!e) return undefined;
      if (e.localName === 'measure') return sched!.measureTime.get(id);
      const ev = E.eventOf(e);
      const t = sched!.idTime.get(getId(ev)) ?? sched!.idTime.get(id);
      if (t !== undefined) return t;
      const m = ancestor(e, 'measure');
      return m ? sched!.measureTime.get(getId(m)) : undefined;
    };
    if (cur.kind === 'events') from = timeOf(cur.ids[0]) ?? 0;
    if (cur.kind === 'measures') from = sched.measureTime.get(cur.measureIds[0]) ?? 0;
    if (loop) {
      const ms = E.measuresOf(s, cur);
      if (ms.length) {
        const all = s.measures();
        const last = ms[ms.length - 1];
        const nextM = all[all.indexOf(last) + 1];
        const start = sched.measureTime.get(getId(ms[0])) ?? 0;
        const end = nextM ? sched.measureTime.get(getId(nextM)) ?? sched.duration : sched.duration + 1;
        loopRange = { start, end };
        from = start;
      }
    }
    player.metronome = metronome;
    player.mix = mix;
    followRef.current = null;
    player.onCue = (on, off, measure) => {
      const root = stageRef.current;
      if (!root) return;
      if (off.includes('*')) clearPlayHighlight();
      if (prefsRef.current.cursor === 'notes') {
        for (const id of off) root.querySelector(`[id="${CSS.escape(id)}"]`)?.classList.remove('ps-playing');
        for (const id of on) root.querySelector(`[id="${CSS.escape(id)}"]`)?.classList.add('ps-playing');
      }
      if (measure) {
        const el = root.querySelector(`[id="${CSS.escape(measure)}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          const sr = root.getBoundingClientRect();
          // follow the music only when the playing measure has actually left the view; then bring its
          // system near the top (a tall system never fits "fully" in a small window, so don't insist on that)
          const below = r.top > sr.bottom - 60;
          const above = r.bottom < sr.top + 30;
          const side = r.left > sr.right - 30 || r.right < sr.left + 30;
          if (below || above) root.scrollTo({ top: root.scrollTop + (r.top - sr.top) - 24, behavior: 'smooth' });
          if (side) root.scrollTo({ left: root.scrollLeft + (r.left - sr.left) - 60, behavior: 'smooth' });
        }
      }
    };
    player.onStop = () => {
      setPlaying(false);
      clearPlayHighlight();
    };
    player.onTime = (ms) => {
      if (timeRef.current) timeRef.current.textContent = fmtTime(ms) + ' / ' + fmtTime(sched!.duration);
      const style = prefsRef.current.cursor;
      const line = lineRef.current;
      const box = measureHiRef.current;
      if (style !== 'line' && style !== 'measure') return;
      if (!followRef.current && pagesRef.current) followRef.current = { points: buildFollow(pagesRef.current, sched!.cues), end: sched!.duration };
      const pos = followRef.current ? followAt(followRef.current.points, ms - prefsRef.current.cursorOffset * (tempoPct / 100), followRef.current.end) : null;
      if (!pos) return;
      const pad = (pos.bottom - pos.top) * 0.12 + 6;
      if (style === 'line' && line) {
        line.style.opacity = '1';
        line.style.height = `${pos.bottom - pos.top + pad * 2}px`;
        line.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${(pos.top - pad).toFixed(1)}px, 0)`;
      }
      if (style === 'measure' && box) {
        box.style.opacity = '1';
        box.style.width = `${pos.mRight - pos.mLeft}px`;
        box.style.height = `${pos.bottom - pos.top + pad * 2}px`;
        box.style.transform = `translate3d(${pos.mLeft.toFixed(1)}px, ${(pos.top - pad).toFixed(1)}px, 0)`;
      }
    };
    setPlaying(true);
    try {
      let startAt: number | undefined;
      if (countIn && sched.clicks.length > 1) {
        const beatMs = sched.clicks[1].time - sched.clicks[0].time;
        const firstM = s.measures()[0];
        const ctx = s.contextOf(firstM);
        const beats = ctx.unit === 8 && ctx.count % 3 === 0 && ctx.count > 3 ? ctx.count / 3 : ctx.count;
        startAt = await player.countIn(beats, beatMs, tempoPct / 100);
      }
      await player.play(sched, from, tempoPct / 100, loopRange, startAt);
    } catch (e) {
      console.error(e);
      setPlaying(false);
      showToast('Audio could not start. Click the page and try again.', true);
    }
  }

  useEffect(() => {
    player.metronome = metronome;
  }, [metronome, player]);
  useEffect(() => {
    player.mix = mix;
    player.applyMix();
  }, [mix, player]);
  useEffect(() => {
    player.masterMix = masterMix;
    player.applyMaster();
  }, [masterMix, player]);
  useEffect(() => {
    player.onLoading = (f) => setSoundLoading(f);
  }, [player]);
  // the mixer is saved inside the score (so it travels with online saves)
  useEffect(() => {
    const st = (scoreRef.current?.getSettings() || {}) as { mix?: Record<string, StaffMix>; master?: Partial<MasterMix> };
    setMix(st.mix || {});
    setMasterMix({ ...DEFAULT_MASTER_MIX, ...(st.master || {}) });
  }, [docId]);
  const saveMix = (nextMix: Record<string, StaffMix>, nextMaster: MasterMix) => {
    const sc = scoreRef.current;
    if (!sc) return;
    sc.setSettings({ mix: nextMix, master: nextMaster });
    setSaveState('unsaved');
  };

  // MIDI keyboard: notes played together become a chord at the cursor
  useEffect(() => {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!prefs.midiInput || !nav.requestMIDIAccess) {
      setMidiDevices([]);
      return;
    }
    let access: MIDIAccess | null = null;
    let held: number[] = [];
    let timer = 0;
    const onMsg = (e: MIDIMessageEvent) => {
      const d = e.data;
      if (!d || live.current.dialog || live.current.prompt) return;
      if ((d[0] & 0xf0) === 0x90 && d[2] > 0) {
        held.push(d[1]);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const notes = held;
          held = [];
          const startCursor = live.current.mode === 'input' ? live.current.cursor : startInputCursor();
          const r = run((sc) => T.enterMidi(sc, startCursor, live.current.sel, notes, live.current.input));
          if (r?.selection?.kind === 'events') audition(r.selection.ids);
        }, 45);
      }
    };
    nav.requestMIDIAccess().then((a) => {
      access = a;
      const bind = () => {
        const names: string[] = [];
        a.inputs.forEach((i) => {
          i.onmidimessage = onMsg;
          names.push(i.name || 'MIDI keyboard');
        });
        setMidiDevices(names);
      };
      bind();
      a.onstatechange = bind;
    }).catch(() => showToast('This browser did not allow MIDI keyboard access.', true));
    return () => {
      access?.inputs.forEach((i) => { i.onmidimessage = null; });
      window.clearTimeout(timer);
    };
  }, [prefs.midiInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- file operations ----------

  const createScore = (o: NewScoreOptions) => {
    try {
      const s = Score.create(o);
      replaceScore(s);
      setDialog(null);
      updMode('input');
      const first = E.leafSequence(s, s.staffDefs()[0].getAttribute('n') || '1', '1')[0];
      if (first) {
        updCursor(getId(first));
        updSel({ kind: 'events', ids: [getId(first)] });
      }
      showToast('New score ready. Type A–G to write notes, 1–7 to pick lengths.');
    } catch (e) {
      console.error(e);
      showToast('The score could not be created.', true);
    }
  };

  const openLibrary = async () => {
    setLibrary(await listScores());
    setDialog('library');
  };

  const openStored = async (id: string) => {
    const rec = await loadScore(id);
    if (!rec) return;
    try {
      replaceScore(Score.fromMei(rec.mei), rec.id, rec.createdAt);
      setSaveState('saved');
      setDialog(null);
    } catch {
      showToast('That score could not be opened.', true);
    }
  };

  const importFile = async (f: File) => {
    try {
      setRendering(true);
      const s = await importScoreFile(f);
      replaceScore(s);
      showToast(`Imported “${s.getMeta().title}”.`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'That file could not be imported.', true);
    } finally {
      setRendering(false);
    }
  };

  const recognize = async (pagesIn: ScanPage[], pin: string, hint: string) => {
    setScanBusy(true);
    setScanError('');
    setScanProgress({ done: 0, total: pagesIn.length });
    try {
      const results = await recognizePages(pagesIn, pin, hint, (done, total) => setScanProgress({ done, total }));
      const xml = results.length > 1 ? mergeMusicXml(results.map((r) => r.musicxml)) : results[0].musicxml;
      const s = await importScoreText(xml, 'Scanned score');
      replaceScore(s);
      setDialog(null);
      const truncated = results.some((r) => r.truncated);
      showToast(truncated ? 'Scan finished, but a page was cut short. Check the end of each page.' : 'Scan finished. Compare it with the original and fix anything misread.', truncated);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scanning failed.');
    } finally {
      setScanBusy(false);
      setScanProgress(null);
    }
  };

  // ---------- tools ----------

  const checkScore = () => {
    const sc = scoreRef.current;
    if (!sc) return;
    // tab staves only mirror the guitar staff, so leave them out of the check
    const tabNs = new Set(sc.staffDefs().filter(isTabStaff).map((d) => d.getAttribute('n') || ''));
    const target = tabNs.size ? Score.fromMei(partMei(sc, sc.staffDefs().map((d) => d.getAttribute('n') || '').filter((n) => !tabNs.has(n)))) : sc;
    const list = [...rangeIssues(target), ...partWritingIssues(target)];
    setIssues(list);
    setSide('issues');
  };

  const selectIssue = (i: Issue) => {
    const ids = i.noteIds.filter((id) => scoreRef.current?.byId(id));
    if (ids.length) updSel({ kind: 'events', ids });
    const el = ids[0] ? stageRef.current?.querySelector(`[id="${CSS.escape(ids[0])}"]`) : null;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const cloudRecord = async (): Promise<Cloud.CloudScore | null> => {
    if (!user) {
      setDialog('account');
      showToast('Sign in to save online, share and keep versions.');
      return null;
    }
    if (!cloudRef.current.id) await saveOnline();
    if (!cloudRef.current.id) {
      showToast('This score could not be saved online yet.', true);
      return null;
    }
    const rec = await Cloud.getScore(cloudRef.current.id);
    setCloud(rec);
    return rec;
  };

  const exportAudio = async () => {
    const tk = tkRef.current;
    const sc = scoreRef.current;
    if (!tk || !sc) return;
    const abort = new AbortController();
    setProgress({ title: 'Export audio', text: 'Preparing…', fraction: null, abort });
    try {
      const sched = scheduleRef.current || buildSchedule(tk, sc, view.concertPitch, playback);
      const blob = await renderWav(sched, mix, masterMix, (stage, f) => setProgress({ title: 'Export audio', text: stage === 'sounds' ? `Loading sounds… ${Math.round(f * 100)}%` : `Recording… ${Math.round(f * 100)}%`, fraction: f, abort }), abort.signal);
      download(blob, `${safeFileName(sc.getMeta().title)}.wav`, 'audio/wav');
    } catch (e) {
      if (!abort.signal.aborted) showToast(e instanceof Error ? e.message : 'Audio export failed.', true);
    } finally {
      setProgress(null);
    }
  };

  const printParts = async (groups: string[][]) => {
    const sc = scoreRef.current;
    if (!sc) return;
    setDialog(null);
    const conv = await getConverter();
    const pagesOut: string[] = [];
    for (const ns of groups) {
      const copy = Score.fromMei(partMei(sc, ns));
      T.condenseRests(copy);
      if (layout.perLine) T.breakEvery(copy, layout.perLine);
      conv.setOptions({ ...printOptions(view, true, layout), transpose: '' });
      conv.loadData(copy.toString());
      for (let i = 1; i <= conv.getPageCount(); i++) pagesOut.push(applyTextFont(conv.renderToSVG(i), prefs.textFont));
    }
    try {
      printPages(pagesOut, `${sc.getMeta().title || 'Score'} — parts`, layout.pageSize, FONTS_HREF);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Printing failed.', true);
    }
  };

  const exportAs = async (kind: 'musicxml' | 'mei' | 'midi' | 'pdf' | 'svg') => {
    const s = scoreRef.current;
    const tk = tkRef.current;
    setMenu(null);
    if (!s || !tk) return;
    const name = safeFileName(s.getMeta().title);
    try {
      if (kind === 'mei') download(s.toString(), `${name}.mei`, 'application/mei+xml');
      if (kind === 'musicxml') {
        const { meiToMusicXml } = await import('../io/musicxml');
        download(meiToMusicXml(s.doc), `${name}.musicxml`, 'application/vnd.recordare.musicxml+xml');
      }
      if (kind === 'midi') {
        const conv = await getConverter();
        conv.setOptions({ transpose: '' });
        conv.loadData(s.toString());
        const bytes = base64ToBytes(conv.renderToMIDI());
        download(bytes, `${name}.mid`, 'audio/midi');
      }
      if (kind === 'pdf' || kind === 'svg') {
        // always engrave pages for printing, whatever the screen layout
        const conv = await getConverter();
        conv.setOptions({ ...printOptions(view, layout.perLine > 0 || descendants(s.doc, 'sb').length + descendants(s.doc, 'pb').length > 0, layout), transpose: '' });
        conv.loadData(renderCopy(s, partView === 'all' ? null : partView.split(','), layout.perLine));
        const out: string[] = [];
        for (let i = 1; i <= conv.getPageCount(); i++) out.push(applyTextFont(conv.renderToSVG(i), prefs.textFont));
        if (kind === 'pdf') printPages(out, s.getMeta().title || 'Score', layout.pageSize, FONTS_HREF);
        else out.forEach((svg, i) => download(svg, `${name}${out.length > 1 ? `-p${i + 1}` : ''}.svg`, 'image/svg+xml'));
      }
    } catch (e) {
      console.error(e);
      showToast(e instanceof Error ? e.message : 'Export failed.', true);
    }
  };

  const transposeScore = async (spec: string) => {
    const s = scoreRef.current;
    if (!s) return;
    const conv = await getConverter();
    conv.setOptions({ transpose: spec });
    const ok = conv.loadData(s.toString());
    const mei = ok ? conv.getMEI({}) : '';
    conv.setOptions({ transpose: '' });
    if (!mei) {
      showToast('Transposition failed.', true);
      return;
    }
    run((sc) => {
      const t = Score.fromMei(mei);
      sc.doc = t.doc;
      sc.invalidate();
      return { selection: NONE, message: 'Transposed.' };
    });
    setDialog(null);
  };

  // ---------- derived UI state ----------

  const s = scoreRef.current;
  const meta = s ? s.getMeta() : { title: '', subtitle: '', composer: '', lyricist: '', arranger: '' };
  const staves = useMemo(() => (s ? s.staves() : []), [s, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const parts = useMemo(() => {
    const out: { name: string; ns: string[] }[] = [];
    for (const st of staves) {
      const p = out[st.partIndex];
      if (p) p.ns.push(st.n);
      else out[st.partIndex] = { name: st.partName, ns: [st.n] };
    }
    return out.filter(Boolean);
  }, [staves]);

  const status = useMemo(() => {
    if (!s) return '';
    if (sel.kind === 'measures') {
      const ms = sel.measureIds.map((id) => s.byId(id)).filter(Boolean) as Element[];
      if (!ms.length) return '';
      const a = ms[0].getAttribute('n');
      const b = ms[ms.length - 1].getAttribute('n');
      return `Measure${ms.length > 1 ? `s ${a}–${b}` : ` ${a}`}`;
    }
    if (sel.kind === 'events') {
      const e = s.byId(sel.ids[sel.ids.length - 1]);
      if (!e) return '';
      const m = ancestor(e, 'measure');
      const staffN = ancestor(e, 'staff')?.getAttribute('n');
      const st = staves.find((x) => x.n === staffN);
      let what: string = e.localName;
      const notes = e.localName === 'note' ? [e] : e.localName === 'chord' ? children(e, 'note') : [];
      if (notes.length) {
        what = notes.map((n) => {
          const acc = n.getAttribute('accid') || n.getAttribute('accid.ges') || '';
          return (n.getAttribute('pname') || '').toUpperCase() + (PITCH_NAMES[acc] ?? '') + (n.getAttribute('oct') || '');
        }).join(' ');
        const ev = E.eventOf(e);
        const d = DURATIONS.find((x) => x.dur === ev.getAttribute('dur'));
        if (d) what += ` · ${d.name.toLowerCase()}${ev.getAttribute('dots') ? ' dotted' : ''}`;
      } else if (e.localName === 'rest' || e.localName === 'mRest') what = 'rest';
      return `${sel.ids.length > 1 ? `${sel.ids.length} selected · ` : ''}${what}${m ? ` · m. ${m.getAttribute('n')}` : ''}${st ? ` · ${st.partName}` : ''}`;
    }
    return '';
  }, [s, sel, version, staves]);

  const highlightCss = useMemo(() => {
    if (!s) return '';
    const rules: string[] = [];
    if (prefs.showRange) {
      try {
        const out = [...outOfRangeNoteIds(s)].slice(0, 2000);
        if (out.length) rules.push(`${out.map((id) => `.ps-page [id="${id}"]`).join(',')}{color:#d64545;fill:#d64545}`);
      } catch {
        /* checking is best effort */
      }
    }
    const ids: string[] = [];
    if (sel.kind === 'events') ids.push(...sel.ids);
    if (sel.kind === 'measures') {
      for (const mid of sel.measureIds) {
        const m = s.byId(mid);
        if (!m) continue;
        for (const st of children(m, 'staff')) if (!sel.staves.length || sel.staves.includes(st.getAttribute('n') || '')) ids.push(getId(st));
      }
    }
    if (ids.length) {
      const sels = ids.slice(0, 4000).map((id) => `.ps-page [id="${id}"]`);
      rules.push(`${sels.join(',')}{color:var(--ps-sel)!important;fill:var(--ps-sel)!important}`);
      rules.push(`${sels.map((x) => x + ' *').join(',')}{color:var(--ps-sel)!important;fill:var(--ps-sel)!important}`);
    }
    if (mode === 'input' && cursor) {
      rules.push(`.ps-page [id="${cursor}"],.ps-page [id="${cursor}"] *{color:var(--ps-cursor)!important;fill:var(--ps-cursor)!important}`);
    }
    rules.push(`.ps-page .ps-playing,.ps-page .ps-playing *{color:var(--ps-play)!important;fill:var(--ps-play)!important}`);
    return rules.join('\n');
  }, [s, sel, cursor, mode, version, prefs.showRange]);

  // prompt position next to its anchor
  const [promptPos, setPromptPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!prompt) {
      setPromptPos(null);
      return;
    }
    anchorRef.current = prompt.anchor;
    const place = () => {
      const el = prompt.anchor ? stageRef.current?.querySelector(`[id="${CSS.escape(prompt.anchor)}"]`) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 80 || r.bottom > window.innerHeight - 80) el.scrollIntoView({ block: 'center', behavior: 'auto' });
        const r2 = el.getBoundingClientRect();
        setPromptPos({ left: Math.max(8, Math.min(window.innerWidth - 330, r2.left - 20)), top: Math.min(window.innerHeight - 60, r2.bottom + 12) });
      } else setPromptPos({ left: window.innerWidth / 2 - 150, top: 140 });
    };
    const t = window.setTimeout(place, 30);
    return () => window.clearTimeout(t);
  }, [prompt, pages]);

  const fmtTime = (ms: number) => {
    const t = Math.max(0, Math.floor(ms / 1000));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };

  // ---------- menus ----------

  const Menu = ({ id, label, children: items }: { id: string; label: React.ReactNode; children: React.ReactNode }) => (
    <div className="ps-menu">
      <button onClick={(e) => { e.stopPropagation(); setMenu(menu === id ? null : id); }} aria-expanded={menu === id}>{label} <ChevronDown size={13} /></button>
      {menu === id && <div className="ps-dropdown" onClick={() => setMenu(null)}>{items}</div>}
    </div>
  );
  const Item = ({ onClick, children: c, kbd, checked }: { onClick: () => void; children: React.ReactNode; kbd?: string; checked?: boolean }) => (
    <button onClick={onClick}>{checked !== undefined && <span className="ps-check">{checked ? '✓' : ''}</span>}{c}{kbd && <kbd>{kbd}</kbd>}</button>
  );

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  if (loadError) {
    return <div className="ps-root"><div className="ps-empty"><h2>Wolfi</h2><p>{loadError}</p></div></div>;
  }

  const setDur = (dur: string) => {
    updInput((x) => ({ ...x, dur, dots: 0 }));
    if (mode === 'normal' && sel.kind === 'events') run((sc) => E.setDuration(sc, sel, dur, 0));
  };

  return (
    <div className="ps-root" data-theme={prefs.theme} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) void importFile(f); }}>
      <style>{highlightCss}</style>
      <header className="ps-top">
        <WolfiBrand />
        <nav className="ps-menus" onClick={(e) => e.stopPropagation()}>
          <Menu id="file" label="File">
            <Item onClick={() => setDialog('new')}>New score…</Item>
            <Item onClick={openLibrary}>Open…</Item>
            <Item onClick={() => fileRef.current?.click()}>Import MusicXML / MEI / ABC…</Item>
            {scanReady
              ? <Item onClick={() => { setScanError(''); setDialog('scan'); }}>Scan sheet music…</Item>
              : <Item onClick={() => showToast('Scanning sheet music is coming soon.')}><span style={{ opacity: 0.5 }}>Scan sheet music — coming soon</span></Item>}
            <hr />
            <Item onClick={() => void saveNow().then(() => showToast('Saved in this browser.'))} kbd="Ctrl S">Save</Item>
            <hr />
            <Item onClick={() => exportAs('pdf')}>Print / save as PDF</Item>
            <Item onClick={() => exportAs('musicxml')}>Export MusicXML</Item>
            <Item onClick={() => exportAs('midi')}>Export MIDI</Item>
            <Item onClick={() => exportAs('mei')}>Export MEI</Item>
            <Item onClick={() => exportAs('svg')}>Export SVG pages</Item>
            <Item onClick={() => void exportAudio()}>Export audio (WAV)</Item>
            <Item onClick={() => setDialog('printParts')}>Print parts…</Item>
            <hr />
            <Item onClick={() => setDialog('account')}>{user ? 'Online scores…' : 'Sign in to save online…'}</Item>
            <Item onClick={async () => { if (await cloudRecord()) setDialog('share'); }}>Share…</Item>
            <Item onClick={async () => { if (await cloudRecord()) setDialog('versions'); }}>Version history…</Item>
          </Menu>
          <Menu id="edit" label="Edit">
            <Item onClick={undo} kbd="Ctrl Z">Undo</Item>
            <Item onClick={redo} kbd="Ctrl ⇧ Z">Redo</Item>
            <hr />
            <Item onClick={() => { const c = E.copySelection(scoreRef.current!, sel); if (c) clipRef.current = c; }} kbd="Ctrl C">Copy</Item>
            <Item onClick={() => { const c = clipRef.current; if (c) run((sc) => E.paste(sc, sel, c, mode === 'input' ? cursor : null, input)); }} kbd="Ctrl V">Paste</Item>
            <Item onClick={() => run((sc) => E.deleteSelection(sc, sel))} kbd="Del">Delete</Item>
            <hr />
            <Item onClick={() => { const sc = scoreRef.current!; updSel({ kind: 'measures', measureIds: sc.measures().map(getId), staves: sc.staffDefs().map((d) => d.getAttribute('n') || '1') }); }} kbd="Ctrl A">Select all</Item>
          </Menu>
          <Menu id="view" label="View">
            <Item checked={view.layout === 'page'} onClick={() => setView({ ...view, layout: 'page' })}>Page view</Item>
            <Item checked={view.layout === 'continuous'} onClick={() => setView({ ...view, layout: 'continuous' })}>Continuous view</Item>
            <hr />
            <Item checked={view.concertPitch} onClick={() => setView({ ...view, concertPitch: !view.concertPitch })}>Concert pitch</Item>
            <Item checked={palette} onClick={() => setPalette(!palette)}>Palettes</Item>
            <hr />
            <Item onClick={() => openSettings('appearance')}>Theme & fonts…</Item>
            <hr />
            <Item checked={partView === 'all'} onClick={() => setPartView('all')}>Full score</Item>
            {parts.map((p) => <Item key={p.ns.join(',')} checked={partView === p.ns.join(',')} onClick={() => setPartView(p.ns.join(','))}>Part: {p.name}</Item>)}
          </Menu>
          <Menu id="score" label="Score">
            <Item onClick={() => setDialog('props')}>Title & credits…</Item>
            <Item onClick={() => setDialog('parts')}>Instruments…</Item>
            <Item onClick={() => setDialog('transpose')}>Transpose…</Item>
            <hr />
            <Item onClick={() => actions.addMeasures(1)} kbd="Ctrl B">Add measure</Item>
            <Item onClick={() => actions.addMeasures(8)}>Add 8 measures</Item>
            <Item onClick={actions.insertMeasure}>Insert measure before selection</Item>
            <Item onClick={actions.deleteMeasures}>Delete selected measures</Item>
          </Menu>
          <Menu id="tools" label="Tools">
            <Item onClick={checkScore}>Check score (ranges & voice leading)</Item>
            <Item onClick={() => run((sc) => T.suggestChords(sc))}>Suggest chord symbols</Item>
            <hr />
            <Item onClick={() => run((sc) => T.explode(sc, live.current.sel))}>Explode chords into staves below</Item>
            <Item onClick={() => run((sc) => T.reduce(sc, live.current.sel))}>Reduce staves into one</Item>
            <hr />
            <Item onClick={async () => { if (await cloudRecord()) setSide('comments'); }}>Comments</Item>
            <Item onClick={() => openSettings('appearance')}>Settings…</Item>
          </Menu>
          <Menu id="help" label="Help">
            <Item onClick={() => setDialog('shortcuts')} kbd="?">Keyboard shortcuts</Item>
            <Item onClick={() => showToast('Press N, then type A–G. Numbers 1–7 set the length, arrows move the pitch, Space plays.')}>Quick start</Item>
            <Item onClick={() => showToast('Sounds: MuseScore General SoundFont (MIT) by S. Christian Collins, from FluidR3 by Frank Wen, played with spessasynth (Apache-2.0). Engraving: Verovio (LGPL-3.0).')}>Sounds & credits</Item>
          </Menu>
        </nav>
        <div className="ps-doc-title">
          <InlineEdit className="ps-inline-title" value={meta.title} placeholder="Untitled" onSave={(v) => run((sc) => { sc.setMeta({ title: v || 'Untitled' }); return {}; })} />
          <div className="ps-doc-sub">
            <InlineEdit value={meta.subtitle} placeholder="Add subtitle" onSave={(v) => run((sc) => { sc.setMeta({ subtitle: v }); return {}; })} />
            <span>·</span>
            <InlineEdit value={meta.composer} placeholder="Add composer" onSave={(v) => run((sc) => { sc.setMeta({ composer: v }); return {}; })} />
          </div>
          <small>{[readOnly ? 'View only' : saveState === 'saving' || cloudState === 'saving' ? 'Saving…' : saveState !== 'saved' ? 'Edited' : user && cloudRef.current.id ? (cloudState === 'error' ? 'Saved in this browser (online save failed)' : 'Saved online') : 'Saved in this browser'].filter(Boolean).join(' · ')}</small>
        </div>
        {scanReady ? (
          <button className="ps-btn ps-outline ps-hide-sm" onClick={() => { setScanError(''); setDialog('scan'); }}><Camera size={15} /> Scan</button>
        ) : (
          <button className="ps-btn ps-outline ps-hide-sm ps-soon" title="Scanning sheet music is coming soon" onClick={() => showToast('Scanning sheet music is coming soon.')}><Camera size={15} /> Scan <small>soon</small></button>
        )}
        {user && cloudRef.current.id && <button className={`ps-btn${side === 'comments' ? ' ps-on' : ''}`} title="Comments" onClick={async () => { if (side === 'comments') setSide(null); else if (await cloudRecord()) setSide('comments'); }}><MessageSquare size={16} /></button>}
        <button className="ps-btn" onClick={() => openSettings('appearance')} title="Settings" aria-label="Settings"><Settings size={17} /></button>
        <button className="ps-btn ps-outline" onClick={() => setDialog('account')} title={user ? 'Your account and online scores' : 'Sign in to save online'}>
          <UserRound size={15} /> <span className="ps-hide-sm">{user ? user.displayName || user.username : 'Sign in'}</span>
        </button>
        <input ref={fileRef} type="file" hidden accept={IMPORT_ACCEPT} onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
      </header>

      <div className="ps-bar" role="toolbar" aria-label="Playback" onMouseDown={keepFocus}>
        <div className="ps-transport">
          <button className="ps-play" onClick={() => void togglePlay()} title="Play / pause (Space)" aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}</button>
          <button className="ps-btn" onClick={stop} title="Stop" aria-label="Stop"><Square size={15} /></button>
          <button className="ps-btn" onClick={rewind} title="Return to start (Home)" aria-label="Return to start"><SkipBack size={15} /></button>
          <span className="ps-time" ref={timeRef}>0:00</span>
          <button className={`ps-btn${metronome ? ' ps-on' : ''}`} onClick={() => setMetronome(!metronome)} title="Metronome"><Timer size={15} /> <span className="ps-hide-sm">Click</span></button>
          <button className={`ps-btn${countIn ? ' ps-on' : ''}`} onClick={() => setCountIn(!countIn)} title="One-bar count-in"><span className="ps-hide-sm">Count-in</span><span className="ps-hide-sm" /></button>
          <button className={`ps-btn${loop ? ' ps-on' : ''}`} onClick={() => setLoop(!loop)} title="Loop the selected measures"><Repeat size={15} /></button>
          <label className="ps-btn ps-hide-sm" title="Playback tempo">
            <Music size={14} />
            <input className="ps-range" type="range" min={40} max={160} step={5} value={tempoPct} onChange={(e) => setTempoPct(Number(e.target.value))} />
            <span style={{ minWidth: 38 }}>{tempoPct}%</span>
          </label>
          <div style={{ position: 'relative' }}>
            <button className={`ps-btn${showMixer ? ' ps-on' : ''}`} onClick={() => setShowMixer(!showMixer)} title="Mixer"><SlidersHorizontal size={15} /> <span className="ps-hide-sm">Mixer</span></button>
            {soundLoading !== null && <span className="ps-loading-sound">Loading orchestra sounds… {Math.round(soundLoading * 100)}%</span>}
          </div>
        </div>
        <div className="ps-status">
          {status && <span>{status}</span>}
          <span><b>{mode === 'input' ? 'Adding notes — click the staff or type A–G' : 'Select — press N or type A–G to add notes'}</b> · {DURATIONS.find((d) => d.dur === input.dur)?.name}{input.dots ? ' dotted' : ''} · voice {input.voice}</span>
          {view.concertPitch && <span style={{ color: 'var(--ps-accent)' }}>Concert pitch</span>}
          {partView !== 'all' && <span style={{ color: 'var(--ps-accent)' }}>Part view</span>}
          <span>{pages.length} page{pages.length === 1 ? '' : 's'}</span>
        </div>
        {showMixer && (
          <Mixer
            parts={scoreRef.current && descendants(scoreRef.current.doc, 'harm').some((h) => !h.getAttribute('type') || h.getAttribute('type') === 'suggested') && playback.chords !== 'off' ? [...parts, { name: 'Chord symbols', ns: [CHORD_STAFF] }] : parts}
            mix={mix}
            master={masterMix}
            engine={player.engineName === 'soundfont' ? 'MuseScore General SoundFont · hall reverb' : 'Sounds load when you press Play'}
            onStrip={(ns, patch) => {
              const n = { ...mix };
              for (const sn of ns) n[sn] = { ...DEFAULT_STAFF_MIX, ...mix[sn], ...patch };
              setMix(n);
              saveMix(n, masterMix);
            }}
            onMaster={(patch) => {
              const m = { ...masterMix, ...patch };
              setMasterMix(m);
              saveMix(mix, m);
            }}
            onReset={() => { setMix({}); setMasterMix(DEFAULT_MASTER_MIX); saveMix({}, DEFAULT_MASTER_MIX); }}
            onClose={() => setShowMixer(false)}
          />
        )}
      </div>

      <div className="ps-toolbar" role="toolbar" aria-label="Note input" onMouseDown={keepFocus}>
        <div className="ps-tool-group">
          <button className="ps-tool" title="Palettes" onClick={() => setPalette(!palette)} aria-pressed={palette}><PanelLeft size={17} /></button>
          <button className={`ps-mode${mode === 'input' ? ' ps-on' : ''}`} title="Note input (N)" onClick={() => {
            if (mode === 'input') updMode('normal');
            else if (scoreRef.current) {
              updMode('input');
              const t = E.cursorTarget(scoreRef.current, null, sel, input);
              updCursor(getId(t));
            }
          }}><Pencil size={14} /> {mode === 'input' ? 'Adding notes' : 'Add notes'} <kbd style={{ marginLeft: 2 }}>N</kbd></button>
        </div>
        <div className="ps-tool-group">
          {DURATIONS.map((d) => (
            <button key={d.dur} className={`ps-tool${input.dur === d.dur ? ' ps-on' : ''}`} title={`${d.name} (${d.key})`} aria-label={d.name} onClick={() => setDur(d.dur)}><NoteIcon dur={d.dur} /></button>
          ))}
          <button className={`ps-tool${input.dots ? ' ps-on' : ''}`} title="Dot (.)" onClick={() => (mode === 'input' ? updInput({ ...input, dots: input.dots ? 0 : 1 }) : run((sc) => E.toggleDot(sc, sel)))}><b>•</b></button>
          <button className="ps-tool" title="Rest (0)" onClick={() => run((sc) => E.enterRest(sc, cursor, sel, input, mode))}><span className="ps-glyph">𝄽</span></button>
        </div>
        <div className="ps-tool-group">
          <button className="ps-tool" title="Flat (-)" onClick={() => actions.accidental(-1)}><span className="ps-glyph">♭</span></button>
          <button className="ps-tool" title="Natural (=)" onClick={() => actions.accidental(0)}><span className="ps-glyph">♮</span></button>
          <button className="ps-tool" title="Sharp (+)" onClick={() => actions.accidental(1)}><span className="ps-glyph">♯</span></button>
        </div>
        <div className="ps-tool-group">
          <button className="ps-tool" title="Tie (T)" onClick={() => run((sc) => E.toggleTie(sc, sel, cursor, input, mode))}><span className="ps-glyph">‿</span></button>
          <button className="ps-tool" title="Slur (S)" onClick={() => actions.spanner('slur')}><span className="ps-glyph">⁀</span></button>
          <button className="ps-tool" title="Triplet (Ctrl+3)" onClick={() => actions.tuplet(3)}><small style={{ color: 'inherit', fontWeight: 700 }}>3</small></button>
        </div>
        <div className="ps-tool-group" title="Voice (Ctrl+Alt+1–4)">
          {['1', '2', '3', '4'].map((v, i) => (
            <button key={v} className={`ps-tool`} onClick={() => updInput({ ...input, voice: v })} aria-pressed={input.voice === v} title={`Voice ${v}`}>
              <span className={`ps-voice${input.voice === v ? ' ps-on' : ''}`} style={{ color: VOICE_COLORS[i] }}>{v}</span>
            </button>
          ))}
        </div>
        <div className="ps-tool-group">
          <button className="ps-tool" title="Undo (Ctrl+Z)" onClick={undo}><Undo2 size={17} /></button>
          <button className="ps-tool" title="Redo (Ctrl+Shift+Z)" onClick={redo}><Redo2 size={17} /></button>
        </div>
        <div className="ps-tool-group">
          <button className="ps-tool" title="Zoom out" onClick={() => setView({ ...view, zoom: Math.max(20, view.zoom - 5) })}><ZoomOut size={17} /></button>
          <small style={{ minWidth: 34, textAlign: 'center' }}>{Math.round((view.zoom / 55) * 100)}%</small>
          <button className="ps-tool" title="Zoom in" onClick={() => setView({ ...view, zoom: Math.min(120, view.zoom + 5) })}><ZoomIn size={17} /></button>
          <button className="ps-tool" title="Keyboard shortcuts (?)" onClick={() => setDialog('shortcuts')}><Keyboard size={17} /></button>
          <button className="ps-tool" title={fullscreen ? 'Exit full screen' : 'Full screen'} aria-label="Full screen" onClick={toggleFullscreen}>{fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}</button>
        </div>
      </div>

      <main className="ps-main">
        <Palette actions={actions} collapsed={!palette} />
        <div className="ps-stage" ref={stageRef}>
          {!ready ? (
            <div className="ps-loading"><div className="ps-spinner" /> Loading the engraving engine…</div>
          ) : (
            <div
              ref={pagesRef}
              className={`ps-pages${view.layout === 'continuous' ? ' ps-continuous' : ''}${mode === 'input' ? ' ps-entering' : ''}`}
              onClick={onStageClick}
              onMouseMove={onStageMove}
              onMouseLeave={() => { hoverRef.current = null; setGhost(null); }}
            >
              {pages.map((svg, i) => <div key={i} className="ps-page" dangerouslySetInnerHTML={{ __html: svg }} />)}
              <div ref={measureHiRef} className="ps-follow-measure" aria-hidden="true" />
              <div ref={lineRef} className="ps-follow-line" aria-hidden="true" />
              {ghost && mode === 'input' && (
                <>
                  {ghost.ledgers.map((ly, i) => <div key={i} className="ps-ghost-ledger" style={{ left: ghost.x - ghost.space * 1.1, top: ly - 0.75, width: ghost.space * 2.2 }} />)}
                  <div className="ps-ghost" style={{ left: ghost.x - ghost.space * 0.65, top: ghost.y - ghost.space * 0.48, width: ghost.space * 1.3, height: ghost.space * 0.96 }} />
                </>
              )}
            </div>
          )}
          {rendering && <div style={{ position: 'absolute', top: 10, right: 14 }}><div className="ps-spinner" /></div>}
          {readOnly && <div className="ps-banner">{readOnly}</div>}
        </div>
        {side === 'comments' && user && cloudRef.current.id && (
          <CommentsPanel
            scoreId={cloudRef.current.id}
            user={user}
            measureLabel={(() => { const ms = E.measuresOf(scoreRef.current!, sel); return ms[0]?.getAttribute('n') || null; })()}
            onJump={(n) => { const m = scoreRef.current?.measures().find((x) => x.getAttribute('n') === n); if (m) { updSel({ kind: 'measures', measureIds: [getId(m)], staves: [] }); stageRef.current?.querySelector(`[id="${CSS.escape(getId(m))}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }}
            onClose={() => setSide(null)}
          />
        )}
        {side === 'issues' && <IssuesPanel issues={issues} onSelect={selectIssue} onClose={() => setSide(null)} />}
      </main>


      {prompt && promptPos && (
        <div className="ps-popover" style={{ left: promptPos.left, top: promptPos.top }}>
          <small>{({ 'staff-text': 'Text', expression: 'Expression', tempo: 'Tempo', rehearsal: 'Rehearsal', chord: 'Chord', lyrics: 'Lyric', fingering: 'Finger', meter: 'Time', roman: 'Roman', figbass: 'Figures' } as Record<string, string>)[prompt.kind]}</small>
          <input
            className="ps-input"
            autoFocus
            value={prompt.value}
            placeholder={prompt.kind === 'roman' ? 'e.g. I, IV6, V7, viio' : prompt.kind === 'figbass' ? 'e.g. 6 4, 7, 6/5' : prompt.kind === 'chord' ? 'e.g. Cmaj7, F#m7b5, Bb/D' : prompt.kind === 'lyrics' ? 'syllable (end with - to hyphenate)' : prompt.kind === 'tempo' ? 'e.g. Allegro 132' : ''}
            onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); setPrompt(null); return; }
              if (e.key === 'Enter') { e.preventDefault(); commitPrompt(false); return; }
              if ((prompt.kind === 'lyrics' || prompt.kind === 'chord') && (e.key === ' ' || e.key === 'Tab')) { e.preventDefault(); commitPrompt(true); return; }
              if (prompt.kind === 'lyrics' && e.key === '-') { e.preventDefault(); commitPrompt(true, prompt.value + '-'); }
            }}
          />
          <small>{prompt.kind === 'lyrics' || prompt.kind === 'chord' ? 'Space = next' : 'Enter'}</small>
        </div>
      )}

      {headerEdit && s && (
        <HeaderEditor
          meta={meta}
          pos={headerEdit}
          onSave={(m) => run((sc) => { sc.setMeta({ title: m.title || 'Untitled', subtitle: m.subtitle, composer: m.composer }); return {}; })}
          onClose={() => setHeaderEdit(null)}
        />
      )}
      {toast && <div className={`ps-toast${toast.err ? ' ps-err' : ''}`} role="status">{toast.msg}</div>}

      {dialog === 'new' && <NewScoreDialog onClose={() => setDialog(null)} onCreate={createScore} />}
      {dialog === 'library' && <LibraryDialog scores={library} currentId={docId} onOpen={openStored} onDelete={async (id) => { await deleteScore(id); setLibrary(await listScores()); }} onClose={() => setDialog(null)} onNew={() => setDialog('new')} />}
      {dialog === 'props' && s && <PropertiesDialog meta={meta} onClose={() => setDialog(null)} onSave={(m) => { run((sc) => { sc.setMeta(m); return {}; }); setDialog(null); }} />}
      {dialog === 'parts' && (
        <PartsDialog
          staves={staves}
          onClose={() => setDialog(null)}
          onAdd={(id) => run((sc) => E.addInstrument(sc, id))}
          onRemove={(ns) => run((sc) => E.removePart(sc, ns))}
          onRename={(n, name) => run((sc) => { E.renamePart(sc, n, name); return {}; })}
          onMove={(n, d) => run((sc) => { E.movePart(sc, n, d); return {}; })}
          onProgram={(n, p) => run((sc) => { E.setPartProgram(sc, n, p); return {}; })}
        />
      )}
      {dialog === 'transpose' && <TransposeDialog onClose={() => setDialog(null)} onApply={(spec) => void transposeScore(spec)} />}
      {dialog === 'scan' && <ScanDialog onClose={() => setDialog(null)} onRecognize={(p, pin, hint) => void recognize(p, pin, hint)} busy={scanBusy} progress={scanProgress} error={scanError} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={() => setDialog(null)} />}
      {dialog === 'account' && (
        <AccountDialog
          user={user}
          classes={classes}
          onAuth={(u, c) => { setUser(u); setClasses(c); live.current.user = u; showToast(`Signed in as ${u.displayName || u.username}. Your score now saves online too.`); void saveOnline(); }}
          onLogout={async () => { await Cloud.logout(); setUser(null); setClasses([]); setCloudState('off'); setDialog(null); showToast('Signed out. Scores still save in this browser.'); }}
          onOpen={(id) => void openCloud(id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'share' && cloud && <ShareDialog score={cloud} onClose={() => setDialog(null)} onChanged={(p) => setCloud({ ...cloud, ...p })} />}
      {dialog === 'versions' && cloudRef.current.id && (
        <VersionsDialog scoreId={cloudRef.current.id} onClose={() => setDialog(null)} onRestore={(meiText, label) => {
          run((sc) => {
            const t = Score.fromMei(meiText);
            t.setSettings({ cloudId: cloudRef.current.id });
            sc.doc = t.doc;
            sc.invalidate();
            return { selection: NONE, message: `Restored the version from ${label}. Undo (Ctrl+Z) to go back.` };
          });
          setDialog(null);
        }} />
      )}
      {dialog === 'settings' && (
        <SettingsDialog
          tab={settingsTab}
          font={view.font}
          onFont={(f) => setView({ ...view, font: f })}
          playback={playback}
          layout={layout}
          prefs={prefs}
          midiDevices={midiDevices}
          onPlayback={(p) => updateScoreSettings({ playback: p })}
          onLayout={(l) => updateScoreSettings({ layout: l })}
          onPrefs={setPrefs}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'printParts' && <PrintPartsDialog parts={parts} onClose={() => setDialog(null)} onPrint={(g) => void printParts(g)} />}
      {progress && <ProgressDialog title={progress.title} text={progress.text} fraction={progress.fraction} onCancel={progress.abort ? () => progress.abort!.abort() : undefined} />}
    </div>
  );
}
