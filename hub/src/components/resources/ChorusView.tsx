import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Mic2,
  Music,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  Video,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRememberedState } from '../../hooks/useRememberedState';
import { storage } from '../../services/storage';
import { addFiles } from '../../services/audioLibrary';
import { ChorusSong, ChorusVoicing, ConcertProgram, PartTrack } from '../../types';
import { PartPlayer } from './PartPlayer';

/** Chorus: the repertoire library (with voice-part practice tracks and a rehearsal log), concerts with a printable program, and warm-ups. */

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toLocaleDateString('en-CA');
const field =
  'w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500';
const label = 'text-[11px] font-bold uppercase tracking-wide text-stone-400 block mb-1';
const card = 'bg-white dark:bg-stone-900 rounded-3xl shadow-card border border-stone-200/80 dark:border-stone-800';

const VOICINGS: ChorusVoicing[] = ['Unison', '2-Part', '3-Part', 'SA', 'SSA', 'SAB', 'SATB', 'TB'];
const STATUSES: { id: ChorusSong['status']; label: string; color: string }[] = [
  { id: 'considering', label: 'Considering', color: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  { id: 'learning', label: 'Learning notes', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'refining', label: 'Refining', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'polished', label: 'Concert ready', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'performed', label: 'Performed', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300' }
];
const LEVELS = ['', 'Very easy', 'Easy', 'Medium', 'Challenging', 'Advanced'];
const statusOf = (id: ChorusSong['status']) => STATUSES.find((s) => s.id === id) || STATUSES[0];
const minutesOf = (len: string) => {
  const m = len.match(/^(\d+):(\d{1,2})$/);
  return m ? Number(m[1]) + Number(m[2]) / 60 : Number(len) || 0;
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const WARMUPS = [
  { step: 'Body', title: 'Puppet strings and shoulder rolls', time: '1 min', how: 'Feet apart, knees soft. Imagine a string lifting the top of your head. Roll shoulders back four times, then shake out arms and hands.' },
  { step: 'Body', title: 'Bubble-gum stretch', time: '1 min', how: 'Chew giant pretend gum, stretch it out of your mouth as far as it goes, then wind it back in. Loosens the jaw, lips and face.' },
  { step: 'Breath', title: 'Hissing snake', time: '2 min', how: 'Breathe in low and quiet for 4 counts (belly and ribs out, shoulders still). Hiss on "sss" for 8, then 12, then 16 counts. Who can last the longest?' },
  { step: 'Breath', title: 'Candle puffs', time: '1 min', how: 'Hold up a finger "candle". Blow it out with short "ff-ff-ff" puffs, feeling the belly bounce. Then one long, slow breath that only makes the flame flicker.' },
  { step: 'Voice', title: 'Sirens and slides', time: '2 min', how: 'Start low and slide up on "woo" like a fire engine, then back down. Follow your hand as it draws the shape. Keep it light and in head voice at the top.' },
  { step: 'Voice', title: 'Lip trills on 5-4-3-2-1', time: '2 min', how: 'Motorboat lips on sol-fa-mi-re-do, moving up by half steps. Then sing the same pattern on "mah-meh-mee-moh-moo" with a tall, open mouth.' },
  { step: 'Ear', title: 'Solfège echoes', time: '2 min', how: 'Sing short patterns with hand signs (do-mi-sol, sol-mi-do, do-re-mi-re-do) and have singers echo. Then show signs only and let them sing.' },
  { step: 'Diction', title: 'Tongue twister ladder', time: '2 min', how: '"Red leather, yellow leather" or "Unique New York" on one pitch, slowly then faster. Move up a step each time. Crisp lips, teeth and tip of the tongue.' }
];

type Tab = 'repertoire' | 'concerts' | 'warmups';

// ---------------------------------------------------------------------------
// Piece editor

const blankSong = (): Omit<ChorusSong, 'id'> => ({
  title: '',
  composer: '',
  arranger: '',
  voicing: '2-Part',
  key: '',
  tempoBpm: 0,
  durationString: '',
  status: 'considering',
  notes: '',
  targetConcert: '',
  sheetMusicDriveUrl: '',
  referenceUrl: '',
  copies: undefined,
  difficulty: undefined,
  parts: [],
  rehearsalHistory: []
});

const SongEditor: React.FC<{ song: ChorusSong | null; concerts: ConcertProgram[]; onSave: (s: Omit<ChorusSong, 'id'>) => void; onClose: () => void }> = ({ song, concerts, onSave, onClose }) => {
  const [s, setS] = useState<Omit<ChorusSong, 'id'>>(() => (song ? { ...blankSong(), ...song, parts: song.parts || [] } : blankSong()));
  const set = (patch: Partial<ChorusSong>) => setS((prev) => ({ ...prev, ...patch }));
  const setPart = (id: string, patch: Partial<PartTrack>) => set({ parts: (s.parts || []).map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const nextPartName = () => {
    const n = (s.parts || []).length;
    const names = s.voicing === 'SATB' ? ['Soprano', 'Alto', 'Tenor', 'Bass'] : s.voicing === 'SAB' ? ['Soprano', 'Alto', 'Baritone'] : s.voicing === 'SSA' ? ['Soprano 1', 'Soprano 2', 'Alto'] : s.voicing === 'SA' ? ['Soprano', 'Alto'] : [];
    return names[n] || (s.voicing === 'Unison' ? (n ? 'Accompaniment' : 'Melody') : `Part ${n + 1}`);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={song ? 'Edit piece' : 'Add a piece'} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (s.title.trim()) onSave({ ...s, title: s.title.trim(), parts: (s.parts || []).filter((p) => p.url?.trim() || p.localId) });
        }}
        className={`${card} w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">{song ? 'Edit piece' : 'Add a piece'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Title</label>
            <input autoFocus required value={s.title} onChange={(e) => set({ title: e.target.value })} className={field} placeholder="e.g. Sisi Ni Moja" />
          </div>
          <div>
            <label className={label}>Composer</label>
            <input value={s.composer} onChange={(e) => set({ composer: e.target.value })} className={field} />
          </div>
          <div>
            <label className={label}>Arranger</label>
            <input value={s.arranger || ''} onChange={(e) => set({ arranger: e.target.value })} className={field} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={label}>Voicing</label>
            <select value={s.voicing} onChange={(e) => set({ voicing: e.target.value as ChorusVoicing })} className={field}>
              {VOICINGS.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Key</label>
            <input value={s.key} onChange={(e) => set({ key: e.target.value })} className={field} placeholder="F major" />
          </div>
          <div>
            <label className={label}>Length</label>
            <input value={s.durationString} onChange={(e) => set({ durationString: e.target.value })} className={field} placeholder="3:20" />
          </div>
          <div>
            <label className={label}>Tempo</label>
            <input type="number" min={0} value={s.tempoBpm || ''} onChange={(e) => set({ tempoBpm: Number(e.target.value) })} className={field} placeholder="bpm" />
          </div>
          <div>
            <label className={label}>Copies</label>
            <input type="number" min={0} value={s.copies ?? ''} onChange={(e) => set({ copies: e.target.value === '' ? undefined : Number(e.target.value) })} className={field} />
          </div>
          <div>
            <label className={label}>Difficulty</label>
            <select value={s.difficulty || 0} onChange={(e) => set({ difficulty: Number(e.target.value) || undefined })} className={field}>
              <option value={0}>Not set</option>
              {LEVELS.slice(1).map((l, i) => (
                <option key={l} value={i + 1}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Status</label>
            <select value={s.status} onChange={(e) => set({ status: e.target.value as ChorusSong['status'] })} className={field}>
              {STATUSES.map((st) => (
                <option key={st.id} value={st.id}>{st.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Concert</label>
            <input list="chorus-concerts" value={s.targetConcert || ''} onChange={(e) => set({ targetConcert: e.target.value })} className={field} placeholder="Winter concert" />
            <datalist id="chorus-concerts">
              {concerts.map((c) => (
                <option key={c.id} value={c.title} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Score link (Drive, PDF)</label>
            <input type="url" value={s.sheetMusicDriveUrl || ''} onChange={(e) => set({ sheetMusicDriveUrl: e.target.value })} className={field} placeholder="https://drive.google.com/…" />
          </div>
          <div>
            <label className={label}>Performance video</label>
            <input type="url" value={s.referenceUrl || ''} onChange={(e) => set({ referenceUrl: e.target.value })} className={field} placeholder="https://youtube.com/…" />
          </div>
        </div>

        <div className="space-y-2">
          <label className={label}>Practice tracks</label>
          {(s.parts || []).map((p) => (
            <div key={p.id} className="flex gap-2 items-center">
              <input value={p.name} onChange={(e) => setPart(p.id, { name: e.target.value })} className={`${field} w-36 shrink-0`} aria-label="Part name" />
              {p.localId ? (
                <span className="flex-1 text-xs text-stone-500 truncate">Audio file on this device</span>
              ) : (
                <input value={p.url || ''} onChange={(e) => setPart(p.id, { url: e.target.value })} className={field} placeholder="Link to an audio file, Google Drive or YouTube" aria-label={`${p.name} link`} />
              )}
              <button type="button" onClick={() => set({ parts: (s.parts || []).filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.name}`} className="p-2 text-stone-400 hover:text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => set({ parts: [...(s.parts || []), { id: newId('part'), name: nextPartName(), url: '' }] })} className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add a link
            </button>
            <label className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Add audio files
              <input
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = '';
                  if (!files.length) return;
                  const stored = await addFiles(files, 'uploaded');
                  let parts = [...(s.parts || [])];
                  for (const t of stored) parts = [...parts, { id: newId('part'), name: t.title, localId: t.id }];
                  set({ parts });
                }}
              />
            </label>
          </div>
          <p className="text-[11px] text-stone-400">
            Audio file links (.mp3, .m4a…) and uploaded files play together with a volume for each part. Uploaded files stay on this device; links work everywhere.
          </p>
        </div>

        <div>
          <label className={label}>Notes</label>
          <textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} className={field} placeholder="Tricky spots, staging, solos, accompaniment…" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 dark:text-stone-300">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold">
            Save piece
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Repertoire

const Repertoire: React.FC<{ songs: ChorusSong[]; concerts: ConcertProgram[] }> = ({ songs, concerts }) => {
  const { showToast } = useApp();
  const [selectedId, setSelectedId] = useRememberedState<string | null>('chorus.song', null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editing, setEditing] = useState<ChorusSong | 'new' | null>(null);
  const [logMeasures, setLogMeasures] = useState('');
  const [logNotes, setLogNotes] = useState('');

  const filtered = songs.filter((s) => {
    const q = query.trim().toLowerCase();
    const hit = !q || [s.title, s.composer, s.arranger, s.voicing, s.targetConcert, s.notes].some((v) => v?.toLowerCase().includes(q));
    return hit && (statusFilter === 'all' || s.status === statusFilter);
  });
  const selected = songs.find((s) => s.id === selectedId) || filtered[0];

  const save = (data: Omit<ChorusSong, 'id'>) => {
    const stamped = { ...data, updatedAt: new Date().toISOString() };
    if (editing && editing !== 'new') {
      storage.updateChorusSong(editing.id, stamped);
      showToast('Piece saved', 'success');
    } else {
      const created = storage.addChorusSong(stamped);
      setSelectedId(created.id);
      showToast(`Added ${created.title}`, 'success');
    }
    setEditing(null);
  };

  const addLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !(logMeasures.trim() || logNotes.trim())) return;
    storage.updateChorusSong(selected.id, {
      rehearsalHistory: [{ date: today(), focusMeasures: logMeasures.trim(), notes: logNotes.trim() }, ...selected.rehearsalHistory]
    });
    setLogMeasures('');
    setLogNotes('');
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pieces" aria-label="Search pieces" className={`${field} pl-9`} />
          </div>
          <button type="button" onClick={() => setEditing('new')} className="px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />
            Add piece
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: 'all', label: `All (${songs.length})` }, ...STATUSES.map((s) => ({ id: s.id, label: s.label }))].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStatusFilter(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${statusFilter === s.id ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {songs.length === 0 ? (
          <div className={`${card} p-8 text-center space-y-2`}>
            <Music className="w-8 h-8 mx-auto text-rose-400" />
            <p className="font-bold text-stone-800 dark:text-stone-100">Your chorus library is empty</p>
            <p className="text-sm text-stone-500">Add the pieces on your shelf: voicing, copies, practice tracks for each part and a rehearsal log.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-colors ${selected?.id === s.id ? 'bg-white dark:bg-stone-800 border-rose-500 shadow-card' : 'bg-stone-50/70 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-stone-900 dark:text-white truncate">{s.title}</p>
                    <p className="text-xs text-stone-500 truncate">
                      {[s.composer, s.arranger && `arr. ${s.arranger}`].filter(Boolean).join(' · ') || ' '}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${statusOf(s.status).color}`}>{statusOf(s.status).label}</span>
                </div>
                <div className="flex flex-wrap gap-x-2 mt-1.5 text-[11px] text-stone-500 font-medium">
                  <span>{s.voicing}</span>
                  {s.key && <span>· {s.key}</span>}
                  {s.durationString && <span>· {s.durationString}</span>}
                  {(s.parts?.length || 0) > 0 && <span className="text-rose-600">· {s.parts!.length} track{s.parts!.length > 1 ? 's' : ''}</span>}
                </div>
              </button>
            ))}
            {filtered.length === 0 && <p className="text-sm text-stone-500 p-4">No pieces match.</p>}
          </div>
        )}
      </div>

      <div className="lg:col-span-7">
        {selected && (
          <div className={`${card} p-6 space-y-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">{selected.title}</h2>
                <p className="text-sm text-stone-500">{[selected.composer, selected.arranger && `arr. ${selected.arranger}`].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={selected.status}
                  onChange={(e) => storage.updateChorusSong(selected.id, { status: e.target.value as ChorusSong['status'] })}
                  aria-label="Status"
                  className={`text-xs font-bold rounded-xl px-2.5 py-1.5 border-0 ${statusOf(selected.status).color}`}
                >
                  {STATUSES.map((st) => (
                    <option key={st.id} value={st.id}>{st.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setEditing(selected)} aria-label="Edit piece" className="p-2 rounded-xl text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete "${selected.title}" from your library?`)) return;
                    storage.deleteChorusSong(selected.id);
                    setSelectedId(null);
                  }}
                  aria-label="Delete piece"
                  className="p-2 rounded-xl text-stone-500 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                ['Voicing', selected.voicing],
                ['Key', selected.key || '—'],
                ['Length', selected.durationString || '—'],
                ['Tempo', selected.tempoBpm ? `${selected.tempoBpm}` : '—'],
                ['Copies', selected.copies ?? '—'],
                ['Level', selected.difficulty ? LEVELS[selected.difficulty] : '—']
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-stone-50 dark:bg-stone-800/60 py-2 px-1">
                  <p className="text-[10px] font-bold uppercase text-stone-400">{k}</p>
                  <p className="text-sm font-bold text-stone-800 dark:text-stone-100 truncate">{v}</p>
                </div>
              ))}
            </div>

            {(selected.sheetMusicDriveUrl || selected.referenceUrl || selected.targetConcert) && (
              <div className="flex flex-wrap items-center gap-2">
                {selected.sheetMusicDriveUrl && (
                  <a href={selected.sheetMusicDriveUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-200 text-xs font-bold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Score
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selected.referenceUrl && (
                  <a href={selected.referenceUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    Performance
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {selected.targetConcert && (
                  <span className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {selected.targetConcert}
                  </span>
                )}
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Mic2 className="w-4 h-4 text-rose-500" />
                Practice tracks
              </h3>
              <PartPlayer parts={selected.parts || []} />
            </section>

            {selected.notes && <p className="text-sm text-stone-700 dark:text-stone-300 whitespace-pre-wrap">{selected.notes}</p>}

            <section className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-500" />
                Rehearsal log
              </h3>
              <form onSubmit={addLog} className="flex flex-wrap gap-2">
                <input value={logMeasures} onChange={(e) => setLogMeasures(e.target.value)} placeholder="Measures, e.g. 17–32" aria-label="Measures worked on" className={`${field} w-40`} />
                <input value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="What you worked on, what's next" aria-label="Rehearsal notes" className={`${field} flex-1 min-w-[12rem]`} />
                <button type="submit" className="px-3.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-bold">
                  Log today
                </button>
              </form>
              <div className="space-y-1.5">
                {selected.rehearsalHistory.map((r, i) => (
                  <div key={i} className="group flex items-start gap-3 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 text-sm">
                    <span className="text-xs font-mono text-stone-400 w-20 shrink-0 pt-0.5">{r.date}</span>
                    {r.focusMeasures && <span className="font-mono text-xs font-bold text-rose-600 shrink-0 pt-0.5">m. {r.focusMeasures}</span>}
                    <span className="flex-1 text-stone-700 dark:text-stone-300">{r.notes}</span>
                    <button
                      type="button"
                      onClick={() => storage.updateChorusSong(selected.id, { rehearsalHistory: selected.rehearsalHistory.filter((_, j) => j !== i) })}
                      aria-label="Remove log entry"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-stone-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {editing && <SongEditor song={editing === 'new' ? null : editing} concerts={concerts} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Concerts

const printProgram = (c: ConcertProgram, songs: ChorusSong[]) => {
  const rows = c.orderOfProgram
    .map((item) => {
      const song = item.songId ? songs.find((s) => s.id === item.songId) : null;
      const title = song ? song.title : item.customTitle || '';
      const credit = song ? [song.composer, song.arranger && `arr. ${song.arranger}`].filter(Boolean).join(', ') : '';
      return `<div class="row"><div><div class="t">${esc(title)}</div>${item.ensemble ? `<div class="e">${esc(item.ensemble)}</div>` : ''}${item.notes ? `<div class="n">${esc(item.notes)}</div>` : ''}</div><div class="c">${esc(credit)}</div></div>`;
    })
    .join('');
  const when = [c.date && new Date(`${c.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), c.time, c.location].filter(Boolean).join(' · ');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.title)}</title><style>
    body{font-family:Georgia,'Times New Roman',serif;max-width:640px;margin:48px auto;padding:0 24px;color:#1c1917}
    h1{text-align:center;font-size:30px;margin:0 0 6px} .when{text-align:center;color:#57534e;margin-bottom:28px}
    .row{display:flex;justify-content:space-between;gap:24px;padding:10px 0;border-bottom:1px dotted #a8a29e}
    .t{font-weight:bold;font-size:17px} .e{font-style:italic;color:#57534e;font-size:14px} .n{font-size:13px;color:#78716c}
    .c{text-align:right;font-size:14px;color:#44403c;white-space:nowrap} .notes{margin-top:28px;text-align:center;font-size:14px;color:#57534e;white-space:pre-wrap}
  </style></head><body><h1>${esc(c.title)}</h1><div class="when">${esc(when)}</div>${rows}${c.notes ? `<div class="notes">${esc(c.notes)}</div>` : ''}<script>window.onload=()=>window.print()</script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
};

const Concerts: React.FC<{ songs: ChorusSong[]; concerts: ConcertProgram[] }> = ({ songs, concerts }) => {
  const { showToast } = useApp();
  const [selectedId, setSelectedId] = useRememberedState<string | null>('chorus.concert', null);
  const sorted = useMemo(() => [...concerts].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [concerts]);
  const concert = concerts.find((c) => c.id === selectedId) || sorted[0];
  const update = (patch: Partial<ConcertProgram>) => concert && storage.updateConcert(concert.id, patch);
  const items = concert?.orderOfProgram || [];
  const setItems = (next: ConcertProgram['orderOfProgram']) => update({ orderOfProgram: next, repertoireIds: next.map((i) => i.songId).filter(Boolean) as string[] });
  const total = items.reduce((s, i) => s + (Number(i.durationMinutes) || 0), 0);

  const create = () => {
    const c: ConcertProgram = { id: newId('concert'), title: 'New concert', date: '', time: '7:00 PM', location: '', notes: '', repertoireIds: [], orderOfProgram: [] };
    storage.saveConcerts([c, ...concerts]);
    setSelectedId(c.id);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-2">
        <button type="button" onClick={create} className="w-full px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" />
          New concert
        </button>
        {sorted.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedId(c.id)}
            className={`w-full text-left p-3.5 rounded-2xl border ${concert?.id === c.id ? 'bg-white dark:bg-stone-800 border-rose-500 shadow-card' : 'bg-stone-50/70 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800 hover:bg-stone-100'}`}
          >
            <p className="font-bold text-stone-900 dark:text-white truncate">{c.title}</p>
            <p className="text-xs text-stone-500">
              {c.date ? new Date(`${c.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date yet'} · {c.orderOfProgram.length} item{c.orderOfProgram.length === 1 ? '' : 's'}
            </p>
          </button>
        ))}
        {!concerts.length && <p className="text-sm text-stone-500 p-3">Build a concert's run order from your repertoire, see the total time, and print the program.</p>}
      </div>

      <div className="lg:col-span-8">
        {concert && (
          <div className={`${card} p-6 space-y-5`}>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 flex gap-2">
                <input value={concert.title} onChange={(e) => update({ title: e.target.value })} aria-label="Concert name" className={`${field} text-lg font-bold`} />
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete "${concert.title}"?`)) return;
                    storage.saveConcerts(concerts.filter((c) => c.id !== concert.id));
                    setSelectedId(null);
                  }}
                  aria-label="Delete concert"
                  className="p-2.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Date</label>
                  <input type="date" value={concert.date} onChange={(e) => update({ date: e.target.value })} className={field} />
                </div>
                <div>
                  <label className={label}>Time</label>
                  <input value={concert.time} onChange={(e) => update({ time: e.target.value })} className={field} />
                </div>
              </div>
              <div>
                <label className={label}>Place</label>
                <input value={concert.location} onChange={(e) => update({ location: e.target.value })} className={field} placeholder="School auditorium" />
              </div>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Program order</h3>
                <span className="text-sm font-bold text-rose-600">
                  {Math.round(total)} min total
                </span>
              </div>
              {items.map((item, i) => {
                const move = (d: number) => {
                  const next = [...items];
                  [next[i], next[i + d]] = [next[i + d], next[i]];
                  setItems(next);
                };
                const patch = (p: Partial<(typeof items)[number]>) => setItems(items.map((it, j) => (j === i ? { ...it, ...p } : it)));
                return (
                  <div key={i} className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60">
                    <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <select
                      value={item.songId || ''}
                      onChange={(e) => {
                        const song = songs.find((s) => s.id === e.target.value);
                        patch({ songId: e.target.value || undefined, durationMinutes: song ? Math.max(1, Math.round(minutesOf(song.durationString))) || item.durationMinutes : item.durationMinutes });
                      }}
                      aria-label="Piece"
                      className={`${field} sm:w-48`}
                    >
                      <option value="">Other (type below)…</option>
                      {songs.map((s) => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                    {!item.songId && <input value={item.customTitle || ''} onChange={(e) => patch({ customTitle: e.target.value })} placeholder="Welcome, intermission…" aria-label="Item title" className={`${field} flex-1 min-w-[8rem]`} />}
                    <input value={item.ensemble} onChange={(e) => patch({ ensemble: e.target.value })} placeholder="Who performs" aria-label="Ensemble" className={`${field} flex-1 min-w-[8rem]`} />
                    <input type="number" min={0} value={item.durationMinutes} onChange={(e) => patch({ durationMinutes: Number(e.target.value) })} aria-label="Minutes" className={`${field} w-16`} />
                    <div className="flex">
                      <button type="button" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up" className="p-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-30">
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button type="button" disabled={i === items.length - 1} onClick={() => move(1)} aria-label="Move down" className="p-1.5 text-stone-400 hover:text-stone-700 disabled:opacity-30">
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove" className="p-1.5 text-stone-400 hover:text-rose-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2">
                <select
                  value=""
                  onChange={(e) => {
                    const song = songs.find((s) => s.id === e.target.value);
                    if (song) setItems([...items, { songId: song.id, ensemble: items[items.length - 1]?.ensemble || 'Chorus', durationMinutes: Math.max(1, Math.round(minutesOf(song.durationString))) || 3 }]);
                  }}
                  aria-label="Add a piece from your library"
                  className={`${field} w-auto`}
                >
                  <option value="">+ Add a piece from your library…</option>
                  {songs
                    .filter((s) => !items.some((i) => i.songId === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                </select>
                <button type="button" onClick={() => setItems([...items, { customTitle: '', ensemble: '', durationMinutes: 2 }])} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold">
                  + Other item
                </button>
              </div>
            </section>

            <div>
              <label className={label}>Program notes (printed at the bottom)</label>
              <textarea value={concert.notes} onChange={(e) => update({ notes: e.target.value })} rows={2} className={field} placeholder="Thank-yous, accompanist, reminders…" />
            </div>

            <button
              type="button"
              onClick={() => printProgram(concert, songs) || showToast('Allow pop-ups for this site to print the program', 'warning')}
              className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-bold flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Print program
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

export const ChorusView: React.FC = () => {
  const [tab, setTab] = useRememberedState<Tab>('chorus.tab', 'repertoire');
  const [songs, setSongs] = useState<ChorusSong[]>([]);
  const [concerts, setConcerts] = useState<ConcertProgram[]>([]);

  useEffect(() => {
    const load = () => {
      setSongs(storage.getChorusSongs());
      setConcerts(storage.getConcerts());
    };
    load();
    return storage.subscribe(load);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Chorus">
        {(
          [
            ['repertoire', 'Repertoire', Music],
            ['concerts', 'Concerts', CalendarDays],
            ['warmups', 'Warm-ups', Flame]
          ] as const
        ).map(([id, text, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${tab === id ? 'bg-rose-600 text-white shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'}`}
          >
            <Icon className="w-4 h-4" />
            {text}
          </button>
        ))}
      </div>

      {tab === 'repertoire' && <Repertoire songs={songs} concerts={concerts} />}
      {tab === 'concerts' && <Concerts songs={songs} concerts={concerts} />}
      {tab === 'warmups' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {WARMUPS.map((w) => (
            <div key={w.title} className={`${card} p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">{w.step}</span>
                <span className="text-[11px] font-mono text-stone-400">{w.time}</span>
              </div>
              <h3 className="font-bold text-stone-900 dark:text-white">{w.title}</h3>
              <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed">{w.how}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
