import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Camera, Upload, RotateCw, Trash2, ArrowUp, ArrowDown, FileText, Music2 } from 'lucide-react';
import { INSTRUMENTS, TEMPLATES } from '../model/instruments';
import type { StoredScore } from '../io/storage';
import { imageToPage, pdfToPages, rotatePage, type ScanPage } from '../io/omr';
import type { StaffInfo } from '../model/score';

export function Dialog({ title, subtitle, onClose, size, children, footer }: {
  title: string; subtitle?: string; onClose: () => void; size?: 'small' | 'medium'; children: React.ReactNode; footer?: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  return (
    <div className="ps-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ps-dialog${size ? ' ps-' + size : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="ps-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="ps-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}

// ---------- new score ----------

export interface NewScoreOptions {
  title: string;
  subtitle: string;
  composer: string;
  instruments: string[];
  keyFifths: number;
  meterCount: number;
  meterUnit: number;
  tempo: number;
  tempoText: string;
  measures: number;
  pickupTicks: number;
}

const KEY_NAMES: [number, string][] = [
  [-7, 'C♭ major / A♭ minor'], [-6, 'G♭ major / E♭ minor'], [-5, 'D♭ major / B♭ minor'], [-4, 'A♭ major / F minor'], [-3, 'E♭ major / C minor'],
  [-2, 'B♭ major / G minor'], [-1, 'F major / D minor'], [0, 'C major / A minor'], [1, 'G major / E minor'], [2, 'D major / B minor'],
  [3, 'A major / F♯ minor'], [4, 'E major / C♯ minor'], [5, 'B major / G♯ minor'], [6, 'F♯ major / D♯ minor'], [7, 'C♯ major / A♯ minor'],
];

export function InstrumentPicker({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const families = useMemo(() => {
    const list = INSTRUMENTS.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
    const out: Record<string, typeof list> = {};
    for (const i of list) (out[i.family] ||= []).push(i);
    return out;
  }, [q]);
  return (
    <div>
      <input className="ps-input" placeholder="Search instruments…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
      <div className="ps-instr-list">
        {Object.entries(families).map(([fam, list]) => (
          <React.Fragment key={fam}>
            <h4>{fam}</h4>
            {list.map((i) => (
              <button key={i.id} onClick={() => onPick(i.id)}>{i.name}</button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export function NewScoreDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (o: NewScoreOptions) => void }) {
  const [tpl, setTpl] = useState('blank-piano');
  const [o, setO] = useState<NewScoreOptions>({
    title: 'Untitled Score', subtitle: '', composer: '', instruments: ['piano'], keyFifths: 0, meterCount: 4, meterUnit: 4,
    tempo: 100, tempoText: 'Moderato', measures: 16, pickupTicks: 0,
  });
  const set = (p: Partial<NewScoreOptions>) => setO((x) => ({ ...x, ...p }));
  const pickTemplate = (id: string) => {
    setTpl(id);
    const t = TEMPLATES.find((x) => x.id === id);
    if (t) set({ instruments: [...t.instruments] });
  };
  const meterValue = `${o.meterCount}/${o.meterUnit}`;
  return (
    <Dialog title="New score" subtitle="Choose an ensemble, then set up the piece. Everything can be changed later." onClose={onClose}
      footer={<>
        <button className="ps-btn ps-outline" onClick={onClose}>Cancel</button>
        <button className="ps-btn ps-primary" disabled={!o.instruments.length} onClick={() => onCreate(o)}>Create score</button>
      </>}>
      <div className="ps-label" style={{ marginBottom: 6 }}>Ensemble</div>
      <div className="ps-cards" style={{ marginBottom: 14 }}>
        {TEMPLATES.map((t) => (
          <button key={t.id} className={`ps-card${tpl === t.id ? ' ps-on' : ''}`} onClick={() => pickTemplate(t.id)}>
            <b>{t.name}</b><small>{t.description}</small>
          </button>
        ))}
        <button className={`ps-card${tpl === 'custom' ? ' ps-on' : ''}`} onClick={() => { setTpl('custom'); set({ instruments: [] }); }}>
          <b>Custom</b><small>Pick your own instruments</small>
        </button>
      </div>
      <div className="ps-label" style={{ marginBottom: 6 }}>Instruments ({o.instruments.length})</div>
      <div className="ps-chips" style={{ marginBottom: 8 }}>
        {o.instruments.map((id, i) => (
          <span key={i} className="ps-chip">
            {INSTRUMENTS.find((x) => x.id === id)?.name}
            <button aria-label="Move up" onClick={() => { if (i) { const a = [...o.instruments]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set({ instruments: a }); } }}><ArrowUp size={12} /></button>
            <button aria-label="Remove" onClick={() => set({ instruments: o.instruments.filter((_, j) => j !== i) })}><X size={12} /></button>
          </span>
        ))}
        {!o.instruments.length && <span style={{ color: 'var(--ps-muted)' }}>Add at least one instrument below.</span>}
      </div>
      <InstrumentPicker onPick={(id) => { setTpl('custom'); set({ instruments: [...o.instruments, id] }); }} />
      <div className="ps-row" style={{ marginTop: 16 }}>
        <div className="ps-field"><label>Title</label><input className="ps-input" value={o.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="ps-field"><label>Subtitle</label><input className="ps-input" value={o.subtitle} onChange={(e) => set({ subtitle: e.target.value })} /></div>
        <div className="ps-field"><label>Composer</label><input className="ps-input" value={o.composer} onChange={(e) => set({ composer: e.target.value })} /></div>
      </div>
      <div className="ps-row">
        <div className="ps-field"><label>Key (concert)</label>
          <select className="ps-select" value={o.keyFifths} onChange={(e) => set({ keyFifths: Number(e.target.value) })}>
            {KEY_NAMES.map(([f, n]) => <option key={f} value={f}>{n}</option>)}
          </select>
        </div>
        <div className="ps-field"><label>Time</label>
          <select className="ps-select" value={meterValue} onChange={(e) => { const [c, u] = e.target.value.split('/').map(Number); set({ meterCount: c, meterUnit: u }); }}>
            {['2/4', '3/4', '4/4', '5/4', '6/4', '2/2', '3/2', '3/8', '6/8', '9/8', '12/8', '5/8', '7/8'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="ps-field"><label>Pickup</label>
          <select className="ps-select" value={o.pickupTicks} onChange={(e) => set({ pickupTicks: Number(e.target.value) })}>
            <option value={0}>None</option><option value={480}>1 eighth</option><option value={960}>1 beat</option><option value={1920}>2 beats</option><option value={2880}>3 beats</option>
          </select>
        </div>
      </div>
      <div className="ps-row">
        <div className="ps-field"><label>Tempo text</label><input className="ps-input" value={o.tempoText} onChange={(e) => set({ tempoText: e.target.value })} /></div>
        <div className="ps-field"><label>Tempo (BPM)</label><input className="ps-input" type="number" min={20} max={320} value={o.tempo} onChange={(e) => set({ tempo: Math.max(20, Math.min(320, Number(e.target.value) || 100)) })} /></div>
        <div className="ps-field"><label>Measures</label><input className="ps-input" type="number" min={1} max={999} value={o.measures} onChange={(e) => set({ measures: Math.max(1, Math.min(999, Number(e.target.value) || 1)) })} /></div>
      </div>
    </Dialog>
  );
}

// ---------- library ----------

export function LibraryDialog({ scores, currentId, onOpen, onDelete, onClose, onNew }: {
  scores: Omit<StoredScore, 'mei'>[]; currentId: string; onOpen: (id: string) => void; onDelete: (id: string) => void; onClose: () => void; onNew: () => void;
}) {
  return (
    <Dialog title="My scores" subtitle="Saved in this browser. Export MusicXML or MEI to keep a copy elsewhere." onClose={onClose} size="medium"
      footer={<button className="ps-btn ps-primary" onClick={onNew}>New score</button>}>
      {!scores.length && <p style={{ color: 'var(--ps-muted)' }}>No saved scores yet.</p>}
      <table className="ps-table">
        <tbody>
          {scores.map((s) => (
            <tr key={s.id}>
              <td><FileText size={15} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--ps-accent)' }} /><b>{s.title || 'Untitled'}</b>{s.composer && <span style={{ color: 'var(--ps-muted)' }}> — {s.composer}</span>}{s.id === currentId && <small style={{ color: 'var(--ps-accent)', marginLeft: 8 }}>open</small>}</td>
              <td style={{ color: 'var(--ps-muted)', whiteSpace: 'nowrap' }}>{new Date(s.updatedAt).toLocaleString()}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="ps-btn ps-outline" onClick={() => onOpen(s.id)}>Open</button>
                <button className="ps-btn ps-danger" aria-label="Delete" onClick={() => { if (confirm(`Delete “${s.title}” from this browser?`)) onDelete(s.id); }}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

// ---------- score properties ----------

export function PropertiesDialog({ meta, onSave, onClose }: {
  meta: { title: string; subtitle: string; composer: string; lyricist: string; arranger: string }; onSave: (m: typeof meta) => void; onClose: () => void;
}) {
  const [m, setM] = useState(meta);
  return (
    <Dialog title="Score info" onClose={onClose} size="small"
      footer={<><button className="ps-btn ps-outline" onClick={onClose}>Cancel</button><button className="ps-btn ps-primary" onClick={() => onSave(m)}>Save</button></>}>
      {(['title', 'subtitle', 'composer', 'arranger', 'lyricist'] as const).map((k) => (
        <div key={k} className="ps-field"><label>{k}</label><input className="ps-input" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></div>
      ))}
    </Dialog>
  );
}

// ---------- parts ----------

export function PartsDialog({ staves, onAdd, onRemove, onRename, onMove, onProgram, onClose }: {
  staves: StaffInfo[]; onAdd: (id: string) => void; onRemove: (ns: string[]) => void; onRename: (n: string, name: string) => void;
  onMove: (n: string, dir: -1 | 1) => void; onProgram: (n: string, program: number) => void; onClose: () => void;
}) {
  const parts = useMemo(() => {
    const out: { index: number; name: string; staves: StaffInfo[] }[] = [];
    for (const s of staves) {
      const p = out.find((x) => x.index === s.partIndex);
      if (p) p.staves.push(s);
      else out.push({ index: s.partIndex, name: s.partName, staves: [s] });
    }
    return out;
  }, [staves]);
  const [adding, setAdding] = useState(false);
  return (
    <Dialog title="Instruments" subtitle="Rename, reorder, change sounds, add or remove parts." onClose={onClose} size="medium"
      footer={<button className="ps-btn ps-primary" onClick={onClose}>Done</button>}>
      <table className="ps-table">
        <thead><tr><th>Part</th><th>Sound</th><th /></tr></thead>
        <tbody>
          {parts.map((p) => (
            <tr key={p.index}>
              <td><input className="ps-input" defaultValue={p.name} onBlur={(e) => e.target.value !== p.name && onRename(p.staves[0].n, e.target.value)} /></td>
              <td>
                <select className="ps-select" value={p.staves[0].program} onChange={(e) => { for (const s of p.staves) onProgram(s.n, Number(e.target.value)); }}>
                  {PROGRAMS.map(([n, label]) => <option key={n} value={n}>{label}</option>)}
                </select>
              </td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="ps-btn" aria-label="Move up" onClick={() => onMove(p.staves[0].n, -1)}><ArrowUp size={15} /></button>
                <button className="ps-btn" aria-label="Move down" onClick={() => onMove(p.staves[0].n, 1)}><ArrowDown size={15} /></button>
                <button className="ps-btn ps-danger" aria-label="Remove" onClick={() => { if (confirm(`Remove ${p.name} and all of its music?`)) onRemove(p.staves.map((s) => s.n)); }}><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 14 }}>
        {adding ? <InstrumentPicker onPick={(id) => { onAdd(id); setAdding(false); }} /> : <button className="ps-btn ps-outline" onClick={() => setAdding(true)}><Music2 size={15} /> Add instrument</button>}
      </div>
    </Dialog>
  );
}

const PROGRAMS: [number, string][] = [
  [0, 'Grand piano'], [4, 'Electric piano'], [6, 'Harpsichord'], [7, 'Clavinet'], [11, 'Vibraphone'], [12, 'Marimba'], [13, 'Xylophone'], [9, 'Glockenspiel'],
  [14, 'Tubular bells'], [19, 'Organ'], [24, 'Nylon guitar (harp)'], [33, 'Bass'], [40, 'Violin'], [41, 'Viola'], [42, 'Cello'], [43, 'Contrabass'],
  [45, 'Pizzicato strings'], [46, 'Harp'], [48, 'String section'], [52, 'Choir (soft)'], [56, 'Trumpet'], [57, 'Trombone'], [58, 'Tuba'], [60, 'French horn'],
  [65, 'Saxophone'], [68, 'Oboe'], [70, 'Bassoon'], [71, 'Clarinet'], [72, 'Piccolo'], [73, 'Flute'], [74, 'Recorder'], [79, 'Ocarina'],
];

// ---------- transpose ----------

const INTERVALS: [string, string][] = [
  ['m2', 'Minor 2nd'], ['M2', 'Major 2nd'], ['m3', 'Minor 3rd'], ['M3', 'Major 3rd'], ['P4', 'Perfect 4th'], ['A4', 'Augmented 4th'],
  ['d5', 'Diminished 5th'], ['P5', 'Perfect 5th'], ['m6', 'Minor 6th'], ['M6', 'Major 6th'], ['m7', 'Minor 7th'], ['M7', 'Major 7th'], ['P8', 'Octave'],
];

/** Semitones in each interval, for transposing a selection. */
export const INTERVAL_SEMITONES: Record<string, number> = { m2: 1, M2: 2, m3: 3, M3: 4, P4: 5, A4: 6, d5: 6, P5: 7, m6: 8, M6: 9, m7: 10, M7: 11, P8: 12 };

export function TransposeDialog({ selection, onApply, onApplySelection, onClose }: {
  selection: string | null; // e.g. "3 notes" or "measures 2–4"; null when nothing is selected
  onApply: (spec: string) => void;
  onApplySelection: (semitones: number) => void;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<'selection' | 'score'>(selection ? 'selection' : 'score');
  const [mode, setMode] = useState<'interval' | 'key'>('interval');
  const [dir, setDir] = useState<'+' | '-'>('+');
  const [iv, setIv] = useState('M2');
  const [key, setKey] = useState('D');
  const onSel = scope === 'selection' && !!selection;
  const apply = () => (onSel ? onApplySelection((dir === '+' ? 1 : -1) * INTERVAL_SEMITONES[iv]) : onApply(mode === 'key' ? key : `${dir}${iv}`));
  return (
    <Dialog title="Transpose" subtitle={onSel ? `Moves the selected notes (${selection}); key signatures stay as they are.` : 'Moves every part, rewriting key signatures and spelling.'} onClose={onClose} size="small"
      footer={<><button className="ps-btn ps-outline" onClick={onClose}>Cancel</button><button className="ps-btn ps-primary" onClick={apply}>Transpose</button></>}>
      <div className="ps-field"><label>What</label>
        <select className="ps-select" value={onSel ? 'selection' : 'score'} onChange={(e) => setScope(e.target.value as 'selection' | 'score')}>
          <option value="selection" disabled={!selection}>{selection ? `Selection (${selection})` : 'Selection (select notes or measures first)'}</option>
          <option value="score">Whole score</option>
        </select>
      </div>
      {!onSel && (
        <div className="ps-field"><label>By</label>
          <select className="ps-select" value={mode} onChange={(e) => setMode(e.target.value as any)}><option value="interval">Interval</option><option value="key">To a key</option></select>
        </div>
      )}
      {mode === 'interval' || onSel ? (
        <div className="ps-row">
          <div className="ps-field"><label>Direction</label><select className="ps-select" value={dir} onChange={(e) => setDir(e.target.value as any)}><option value="+">Up</option><option value="-">Down</option></select></div>
          <div className="ps-field"><label>Interval</label><select className="ps-select" value={iv} onChange={(e) => setIv(e.target.value)}>{INTERVALS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
      ) : (
        <div className="ps-field"><label>New key (major, or minor with “m”)</label>
          <select className="ps-select" value={key} onChange={(e) => setKey(e.target.value)}>
            {['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'].map((k) => <option key={k} value={k}>{k.replace('b', '♭').replace('#', '♯')}</option>)}
          </select>
        </div>
      )}
    </Dialog>
  );
}

// ---------- scan sheet music ----------

export function ScanDialog({ onClose, onRecognize, busy, progress, error }: {
  onClose: () => void; onRecognize: (pages: ScanPage[], pin: string, hint: string) => void; busy: boolean; progress: { done: number; total: number } | null; error: string;
}) {
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [pin, setPin] = useState(() => {
    try { return sessionStorage.getItem('prostaff:pin') || ''; } catch { return ''; }
  });
  const [hint, setHint] = useState('');
  const [camera, setCamera] = useState(false);
  const [local, setLocal] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shotRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  // the stream is attached once the <video> exists (iPad Safari shows black if it is set too early)
  useEffect(() => {
    const v = videoRef.current;
    const st = streamRef.current;
    if (!camera || !v || !st) return;
    v.setAttribute('playsinline', 'true');
    v.muted = true;
    v.srcObject = st;
    const p = v.play();
    if (p) p.catch(() => setLocal('Tap the video to start the camera.'));
  }, [camera]);

  // is the scanner switched on for this site?
  const [serverReady, setServerReady] = useState<boolean | null>(null);
  useEffect(() => {
    fetch('/api/omr').then((r) => r.json()).then((d) => setServerReady(!!d?.configured)).catch(() => setServerReady(null));
  }, []);

  const startCamera = async () => {
    setLocal('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setLocal('This browser cannot open the camera here. Use “Take photo” instead.');
      return;
    }
    try {
      let s: MediaStream;
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = s;
      setCamera(true);
    } catch {
      setLocal('The camera could not be opened. Allow camera access in the browser settings, or use “Take photo / choose files”.');
    }
  };
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
  };
  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    const p = await imageToPage(blob, `Photo ${pages.length + 1}`);
    setPages((x) => [...x, p]);
  };
  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    setLocal('');
    const out: ScanPage[] = [];
    for (const f of Array.from(files)) {
      try {
        if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) out.push(...(await pdfToPages(f)));
        else if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic|gif)$/i.test(f.name)) out.push(await imageToPage(f, f.name));
        else setLocal(`${f.name} is not an image or PDF. To open MusicXML or MEI files, use File → Import.`);
      } catch (e) {
        setLocal(e instanceof Error ? e.message : `${f.name} could not be read.`);
      }
    }
    setPages((x) => [...x, ...out]);
  };
  const move = (i: number, d: -1 | 1) => setPages((x) => {
    const a = [...x];
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  const go = () => {
    try { sessionStorage.setItem('prostaff:pin', pin); } catch { /* ignore */ }
    stopCamera();
    onRecognize(pages, pin, hint);
  };
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;
  return (
    <Dialog title="Scan sheet music" subtitle="Photograph or upload printed music. Each page is read into a fully editable score." onClose={busy ? () => {} : () => { stopCamera(); onClose(); }}
      footer={<>
        {busy && <span style={{ marginRight: 'auto', color: 'var(--ps-muted)' }}>Reading {progress?.total || pages.length} page{(progress?.total || pages.length) === 1 ? '' : 's'}… this takes about 1–3 minutes per page.</span>}
        <button className="ps-btn ps-outline" disabled={busy} onClick={() => { stopCamera(); onClose(); }}>Cancel</button>
        <button className="ps-btn ps-primary" disabled={busy} onClick={() => {
          if (serverReady === false) return setLocal('Scanning is not switched on for this site yet (the server needs its Anthropic API key).');
          if (!pages.length) return setLocal('Add at least one page first: take a photo, capture with the camera, or choose images or a PDF.');
          if (!pin.trim()) return setLocal('Enter your teacher PIN.');
          go();
        }}>{busy ? 'Reading…' : `Read ${pages.length || ''} page${pages.length === 1 ? '' : 's'}`}</button>
      </>}>
      {serverReady === false && (
        <div className="ps-note ps-warn" style={{ marginBottom: 12 }}>
          Scanning isn't switched on for this site yet: the server needs an Anthropic API key (Cloudflare → Workers → mrarthurmusic → Settings → Variables and secrets → <code>ANTHROPIC_API_KEY</code>). You can still add pages here.
        </div>
      )}
      {!camera ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="ps-btn ps-outline" disabled={busy} onClick={startCamera}><Camera size={16} /> Use camera</button>
          <button className="ps-btn ps-outline" disabled={busy} onClick={() => shotRef.current?.click()}><Camera size={16} /> Take photo (phone/tablet)</button>
          <button className="ps-btn ps-outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} /> Choose images or PDF</button>
          <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf,.pdf" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={shotRef} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { void addFiles(e.target.files); e.target.value = ''; }} />
        </div>
      ) : (
        <div className="ps-camera" style={{ marginBottom: 14 }}>
          <video ref={videoRef} playsInline muted autoPlay onClick={() => void videoRef.current?.play()} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="ps-btn ps-primary" onClick={capture}><Camera size={16} /> Capture page</button>
            <button className="ps-btn ps-outline" onClick={stopCamera}>Done with camera</button>
            <span style={{ color: 'var(--ps-muted)', alignSelf: 'center' }}>Fill the frame with one page, flat and evenly lit.</span>
          </div>
        </div>
      )}
      {!!pages.length && (
        <div className="ps-thumbs" style={{ marginBottom: 14 }}>
          {pages.map((p, i) => (
            <div key={p.id} className="ps-thumb">
              {p.preview ? <img src={p.preview} alt={p.name} /> : <div style={{ textAlign: 'center', fontSize: 12 }}><FileText size={28} /><br />PDF page {p.pdfPage}</div>}
              <div className="ps-thumb-bar">
                <span>{i + 1}</span>
                <span>
                  <button aria-label="Move earlier" onClick={() => move(i, -1)}><ArrowUp size={12} /></button>
                  <button aria-label="Move later" onClick={() => move(i, 1)}><ArrowDown size={12} /></button>
                  {p.kind === 'image' && <button aria-label="Rotate" onClick={async () => { const r = await rotatePage(p, null); setPages((x) => x.map((y) => (y.id === p.id ? r : y))); }}><RotateCw size={12} /></button>}
                  <button aria-label="Remove" onClick={() => setPages((x) => x.filter((y) => y.id !== p.id))}><Trash2 size={12} /></button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="ps-row">
        <div className="ps-field"><label>Teacher PIN</label><input className="ps-input" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Required to use the scanner" /></div>
        <div className="ps-field"><label>Notes for the scanner (optional)</label><input className="ps-input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. Bb clarinet part, 3 verses of lyrics" /></div>
      </div>
      {busy && (
        <div style={{ margin: '6px 0 12px' }}>
          <div className={`ps-progress${!progress || progress.done === 0 ? ' ps-indeterminate' : ''}`}><div style={progress && progress.done ? { width: pct + '%' } : undefined} /></div>
          <small style={{ color: 'var(--ps-muted)' }}>{progress ? `${progress.done} of ${progress.total} pages read` : 'Starting…'}</small>
        </div>
      )}
      {(error || local) && <p className="ps-error">{error || local}</p>}
      <div className="ps-note">
        Tips: photograph one page at a time, straight on, with no shadows. Clean printed scores give the best results; check the result against the original and fix anything the scanner misread. Scanning uses Claude (Anthropic) and works on the live site with a teacher PIN.
      </div>
    </Dialog>
  );
}

// ---------- shortcuts ----------

type KeyStyleName = 'wolfi' | 'flat' | 'noteflight';

/** The shortcut list for a style (Wolfi, Flat or Noteflight); shared keys are the same in all three. */
function shortcutsFor(style: KeyStyleName): [string, [string, string][]][] {
  const flat = style === 'flat';
  const nf = style === 'noteflight';
  return [
    ['Note input', [
      ['N', 'Start / stop note input'], ['A – G', 'Enter a note'], ['Shift + A – G', 'Add a note to the chord'],
      flat ? ['1 – 7', 'Length: whole … 64th (3 = quarter)'] : ['1 – 7', 'Length: 64th … whole (5 = quarter)'],
      ['[  /  ]', 'Shorter / longer by one value'], ['.', 'Dot'],
      flat ? ['8', 'Rest'] : nf ? ['Space or 0', 'Rest'] : ['0 or R', 'Rest'],
      ...(flat ? [['9', 'Grace note'] as [string, string]] : []),
      ['Alt + 2 – 8', 'Add a 2nd … octave above (Shift: below)'],
      ['Shift + 3 / 5' + (nf ? '' : ' / 6'), 'Triplet / quintuplet' + (nf ? '' : ' / sextuplet')],
      flat ? ['V  /  Shift + V', 'Toggle voice / voice 2'] : nf ? ['U  /  L', 'Upper / lower voice'] : ['Ctrl + Alt + 1 – 4', 'Voice 1 – 4'],
    ]],
    ['Pitch', [
      flat || nf ? ['↑ / ↓', 'Up / down a scale step'] : ['↑ / ↓', 'Up / down a half step'],
      flat || nf ? ['Shift + ↑ / ↓', 'Up / down a half step'] : ['Alt + Shift + ↑ / ↓', 'Up / down a scale step'],
      ['Ctrl + ↑ / ↓', 'Up / down an octave'],
      flat ? ['-  =  0', 'Flat, sharp, natural'] : ['-  +  =', 'Flat, sharp, natural'],
      ...(nf ? [['_  /  *', 'Double flat / double sharp'] as [string, string]] : []),
      ['Z or J', 'Swap the spelling (C♯ ↔ D♭)'],
    ]],
    ['Markings', [
      [flat || nf ? ',' : ', or T', 'Tie'], ['S', 'Slur'], ['K', 'Chord symbol'],
      nf ? ['Ctrl + Shift + I', 'Lyrics'] : ['L', 'Lyrics'],
      [nf ? 'T or X' : 'X', 'Staff text'],
      [';  :  "', 'Staccato, tenuto, marcato'], ...(nf ? [['^', 'Fermata'] as [string, string]] : []),
      ['<  /  >', 'Crescendo / diminuendo hairpin'],
    ]],
    ['Selection', [
      ['← / →', 'Previous / next note'], ['Shift + ← / →', 'Extend selection'], ['Ctrl + ← / →', 'Previous / next measure'],
      ['Click inside a staff', 'Select the measure'], ['Shift + click', 'Select a range'], ['Drag across the staff', 'Select several notes'],
      ['Drag a note up / down', 'Change its pitch'], ['Ctrl + G', 'Go to a measure'], ['Esc', 'Select tool / clear selection'],
      ...(flat || nf ? [['R', 'Repeat the selection after itself'] as [string, string]] : []),
      ['Delete', 'Delete selection'],
    ]],
    ['Score', [
      ['Ctrl + K', 'Find any command'], ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'], ['Ctrl + C / X / V', 'Copy, cut, paste'],
      ['Ctrl + B', 'Add a measure'], ['Enter / Shift + Enter', 'Line break / page break'],
      nf ? ['P  /  Shift + P', 'Play from the start / from the selection'] : ['Space', 'Play / pause'],
      ...(nf ? [] : [['P  /  Shift + P', 'Play from the start / from the selection'] as [string, string]]),
      ['Home', 'Return to start'], ['Ctrl + S', 'Save'], ['?', 'This list'],
    ]],
  ];
}

export function ShortcutsDialog({ onClose, style = 'wolfi' }: { onClose: () => void; style?: KeyStyleName }) {
  const name = style === 'flat' ? 'Flat' : style === 'noteflight' ? 'Noteflight' : 'Wolfi';
  return (
    <Dialog title="Keyboard shortcuts" subtitle={`${name} style (change it in Settings → Input). On a Mac, use ⌘ for Ctrl.`} onClose={onClose}>
      <div className="ps-shortcuts">
        {shortcutsFor(style).map(([group, list]) => (
          <React.Fragment key={group}>
            <h4>{group}</h4>
            {list.map(([k, v]) => <div key={k}><span>{v}</span><span className="ps-kbd">{k}</span></div>)}
          </React.Fragment>
        ))}
      </div>
    </Dialog>
  );
}
