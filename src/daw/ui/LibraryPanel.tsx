import { GripVertical, Heart, Loader2, Play, Plus, Search, SlidersHorizontal, Square, X } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CatalogEntry, decodePeaks } from '../library/catalogTypes';
import { LibraryQuery, LibraryRow } from '../library/searchCore';
import { snapTick, ticksPerBar } from '../model/time';
import { kvGet, kvSet } from '../persistence/idb';
import { addLoop } from './actions';
import { cx } from './controls';
import { useProject, useStudio, useSubscribe } from './studio';
import { LOOP_DRAG_MIME } from './timeline/Timeline';

const ROW_H = 58;

export const INSTRUMENT_LABELS: Record<string, { label: string; emoji: string }> = {
  drums: { label: 'Drums', emoji: '🥁' },
  'electronic-drums': { label: 'Beats', emoji: '🎛️' },
  percussion: { label: 'Percussion', emoji: '🪘' },
  bass: { label: 'Bass', emoji: '🎸' },
  'synth-bass': { label: 'Synth Bass', emoji: '🔊' },
  'electric-guitar': { label: 'Electric Guitar', emoji: '⚡' },
  'acoustic-guitar': { label: 'Acoustic Guitar', emoji: '🪕' },
  piano: { label: 'Piano', emoji: '🎹' },
  keys: { label: 'Keys', emoji: '🎹' },
  synth: { label: 'Synth', emoji: '🌈' },
  strings: { label: 'Strings', emoji: '🎻' },
  brass: { label: 'Brass', emoji: '🎺' },
  woodwinds: { label: 'Woodwinds', emoji: '🪈' },
  vocals: { label: 'Vocals', emoji: '🎤' },
  mallets: { label: 'Mallets', emoji: '🔔' },
  world: { label: 'World', emoji: '🌍' },
  fx: { label: 'Sound FX', emoji: '✨' },
};

const GENRE_LABELS: Record<string, string> = {
  pop: 'Pop', rock: 'Rock', hiphop: 'Hip-Hop', 'rnb-soul': 'R&B / Soul', electronic: 'Electronic', jazz: 'Jazz', blues: 'Blues', funk: 'Funk', country: 'Country', folk: 'Folk', latin: 'Latin', reggae: 'Reggae', cinematic: 'Cinematic', world: 'World', ambient: 'Ambient', lofi: 'Lo-Fi',
};

type Tab = 'all' | 'favorites' | 'recent';

export function LibraryPanel() {
  const s = useStudio();
  const projectBpm = useProject((p) => p.tempoMap[0].bpm);
  const catalogState = useSubscribe(
    (fn) => s.catalog.subscribe(fn),
    () => `${s.catalog.manifest?.version ?? ''}|${s.catalog.loaded}|${s.catalog.error ?? ''}`,
  );
  const manifest = s.catalog.manifest;
  const [text, setText] = useState('');
  const [debounced, setDebounced] = useState('');
  const [instruments, setInstruments] = useState<string[]>([]);
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [key, setKey] = useState('');
  const [bpmRange, setBpmRange] = useState<[string, string]>(['', '']);
  const [kind, setKind] = useState<'any' | 'loop' | 'oneshot'>('any');
  const [sort, setSort] = useState<LibraryQuery['sort']>('relevance');
  const [fitTempo, setFitTempo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [rows, setRows] = useState<LibraryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [took, setTook] = useState(0);
  const [syncPreview, setSyncPreview] = useState(true);
  const [showUnreviewed, setShowUnreviewed] = useState(false);
  const preview = useSubscribe((fn) => s.preview.subscribe(fn), () => s.preview.state);
  const reqRef = useRef(0);

  useEffect(() => {
    void kvGet<string[]>('favorites', []).then(setFavorites);
    void kvGet<string[]>('recents', []).then(setRecents);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 150);
    return () => clearTimeout(t);
  }, [text]);

  const query = useMemo<LibraryQuery>(() => {
    const q: LibraryQuery = {
      text: debounced,
      instruments,
      genres: genre ? [genre] : undefined,
      moods: mood ? [mood] : undefined,
      keys: key ? [key] : undefined,
      kind,
      sort,
      tempoHint: projectBpm,
      limit: 400,
      approvedOnly: !showUnreviewed,
      collapseKeys: !key,
    };
    const lo = Number(bpmRange[0]);
    const hi = Number(bpmRange[1]);
    if (bpmRange[0] && Number.isFinite(lo)) q.bpmMin = lo;
    if (bpmRange[1] && Number.isFinite(hi)) q.bpmMax = hi;
    if (fitTempo) {
      q.bpmMin = Math.round(projectBpm * 0.85);
      q.bpmMax = Math.round(projectBpm * 1.15);
    }
    if (tab === 'favorites') q.ids = favorites;
    if (tab === 'recent') q.ids = recents;
    return q;
  }, [debounced, instruments, genre, mood, key, kind, sort, projectBpm, bpmRange, fitTempo, tab, favorites, recents, showUnreviewed]);

  useEffect(() => {
    const id = ++reqRef.current;
    setLoading(true);
    s.catalog
      .query(query)
      .then((res) => {
        if (id !== reqRef.current) return;
        let r = res.rows;
        if (tab === 'recent') r = [...r].sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
        setRows(r);
        setTotal(res.total);
        setTook(res.tookMs);
        setError(null);
      })
      .catch((e: Error) => id === reqRef.current && setError(e.message))
      .finally(() => id === reqRef.current && setLoading(false));
  }, [s, query, catalogState, tab, recents]);

  const toggleFav = useCallback(
    (id: string) => {
      setFavorites((f) => {
        const next = f.includes(id) ? f.filter((x) => x !== id) : [id, ...f].slice(0, 500);
        void kvSet('favorites', next).catch(() => s.ui.toast('warn', 'Could not save favorites on this computer.'));
        return next;
      });
    },
    [s],
  );

  const markRecent = useCallback((id: string) => {
    setRecents((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, 50);
      void kvSet('recents', next).catch(() => undefined);
      return next;
    });
  }, []);

  const onPreview = useCallback(
    (e: CatalogEntry) => {
      if (s.preview.state.id === e.id) s.preview.stop();
      else {
        if (s.engine.state === 'playing') s.engine.pause();
        void s.preview.play(e, syncPreview ? s.store.get().tempoMap[0].bpm : null);
      }
    },
    [s, syncPreview],
  );

  const onAdd = useCallback(
    (e: CatalogEntry) => {
      const p = s.store.get();
      const bar = ticksPerBar(p.timeSigMap[0].sig);
      const track = p.tracks.find((t) => t.id === s.ui.get().selectedTrack && t.kind === 'audio');
      // Place after the last clip on that track, or at the playhead on a new track.
      const onTrack = track ? p.regions.filter((r) => r.trackId === track.id) : [];
      const at = onTrack.length ? Math.max(...onTrack.map((r) => r.start + r.length)) : snapTick(Math.max(0, s.engine.currentTick()), bar, 'floor');
      addLoop(s, e, snapTick(at, bar, 'round'), track?.id);
      markRecent(e.id);
    },
    [s, markRecent],
  );

  const anyFilter = instruments.length || genre || mood || key || bpmRange[0] || bpmRange[1] || kind !== 'any' || fitTempo || text;
  const reset = () => {
    setText('');
    setInstruments([]);
    setGenre('');
    setMood('');
    setKey('');
    setBpmRange(['', '']);
    setKind('any');
    setFitTempo(false);
  };

  const instrumentFacets = Object.entries(manifest?.facets.instrument ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-slate-900" aria-label="Loop library">
      <div className="shrink-0 space-y-2 border-b border-slate-800 p-3">
        <div className="flex items-center justify-between">
          <h2 className="daw-display text-lg text-amber-300">Loop Library</h2>
          <span className="text-[11px] text-slate-500">{manifest ? `${manifest.count.toLocaleString()} sounds` : s.catalog.error ? '' : 'loading…'}</span>
        </div>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-500" />
          <input
            data-testid="library-search"
            className="h-9 w-full rounded-lg bg-slate-800 pl-8 pr-8 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
            placeholder="Search drums, guitar, chill…"
            value={text}
            aria-label="Search loops"
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {text && (
            <button className="absolute right-2 top-2 text-slate-400 hover:text-white" aria-label="Clear search" onClick={() => setText('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {instrumentFacets.map(([inst, n]) => {
            const meta = INSTRUMENT_LABELS[inst] ?? { label: inst, emoji: '🎵' };
            const on = instruments.includes(inst);
            return (
              <button
                key={inst}
                type="button"
                aria-pressed={on}
                title={`${meta.label} (${n})`}
                onClick={() => setInstruments((x) => (on ? x.filter((i) => i !== inst) : [...x, inst]))}
                className={cx('rounded-full px-2 py-0.5 text-xs transition-colors', on ? 'bg-amber-400 font-semibold text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <select aria-label="Genre" className="h-7 min-w-0 flex-1 rounded-md bg-slate-800 px-1 text-xs text-slate-200" value={genre} onChange={(e) => setGenre(e.target.value)}>
            <option value="">All genres</option>
            {Object.keys(manifest?.facets.genre ?? {})
              .sort()
              .map((g) => (
                <option key={g} value={g}>
                  {GENRE_LABELS[g] ?? g}
                </option>
              ))}
          </select>
          <button
            type="button"
            title={`Show loops close to your song tempo (${projectBpm} BPM)`}
            aria-pressed={fitTempo}
            onClick={() => setFitTempo((f) => !f)}
            className={cx('h-7 rounded-md px-2 text-xs', fitTempo ? 'bg-amber-400 font-semibold text-slate-950' : 'bg-slate-800 text-slate-300')}
          >
            ≈ {projectBpm} BPM
          </button>
          <button type="button" aria-expanded={showFilters} title="More filters" onClick={() => setShowFilters((f) => !f)} className={cx('h-7 rounded-md px-2', showFilters ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-300')}>
            <SlidersHorizontal size={14} />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            <select aria-label="Mood" className="h-7 rounded-md bg-slate-800 px-1 text-slate-200" value={mood} onChange={(e) => setMood(e.target.value)}>
              <option value="">Any mood</option>
              {Object.keys(manifest?.facets.mood ?? {}).sort().map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select aria-label="Key" className="h-7 rounded-md bg-slate-800 px-1 text-slate-200" value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="">Any key</option>
              {Object.keys(manifest?.facets.key ?? {}).sort().map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <input aria-label="Minimum BPM" placeholder="BPM min" className="h-7 w-full rounded-md bg-slate-800 px-1 text-slate-200" value={bpmRange[0]} onChange={(e) => setBpmRange([e.target.value.replace(/\D/g, '').slice(0, 3), bpmRange[1]])} onKeyDown={(e) => e.stopPropagation()} />
              <input aria-label="Maximum BPM" placeholder="max" className="h-7 w-full rounded-md bg-slate-800 px-1 text-slate-200" value={bpmRange[1]} onChange={(e) => setBpmRange([bpmRange[0], e.target.value.replace(/\D/g, '').slice(0, 3)])} onKeyDown={(e) => e.stopPropagation()} />
            </div>
            <select aria-label="Loop or one-shot" className="h-7 rounded-md bg-slate-800 px-1 text-slate-200" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              <option value="any">Loops & one-shots</option>
              <option value="loop">Loops only</option>
              <option value="oneshot">One-shots only</option>
            </select>
            <select aria-label="Sort" className="col-span-2 h-7 rounded-md bg-slate-800 px-1 text-slate-200" value={sort} onChange={(e) => setSort(e.target.value as LibraryQuery['sort'])}>
              <option value="relevance">Sort: best match</option>
              <option value="name">Sort: name</option>
              <option value="bpm">Sort: tempo</option>
              <option value="duration">Sort: length</option>
            </select>
            <label className="col-span-2 flex items-center gap-2 text-slate-400" title="Older loops copied from the previous studio. Their license has not been verified yet.">
              <input type="checkbox" className="accent-amber-400" checked={showUnreviewed} onChange={(e) => setShowUnreviewed(e.target.checked)} />
              Include legacy loops (license not verified)
            </label>
          </div>
        )}
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'favorites', 'recent'] as Tab[]).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} className={cx('rounded-md px-2 py-1', tab === t ? 'bg-slate-700 font-semibold text-white' : 'text-slate-400 hover:text-slate-200')}>
              {t === 'all' ? 'All' : t === 'favorites' ? `♥ Favorites (${favorites.length})` : 'Recent'}
            </button>
          ))}
          {anyFilter ? (
            <button type="button" className="ml-auto text-slate-400 underline hover:text-white" onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-slate-400" title="When on, previews are time-stretched to your song's tempo so you hear how they will fit. Pitch stays the same.">
          <input type="checkbox" checked={syncPreview} onChange={(e) => setSyncPreview(e.target.checked)} className="accent-amber-400" />
          Preview at song tempo
          <span className="ml-auto">
            {preview.id && !preview.loading && (preview.synced ? <span className="text-amber-300">♪ stretched to {projectBpm}</span> : <span className="text-sky-300">♪ original tempo</span>)}
          </span>
        </label>
      </div>
      {error && !s.catalog.error && <div className="mx-3 mt-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">Search failed: {error}</div>}
      {s.catalog.error ? (
        <div className="m-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">The loop library could not load: {s.catalog.error}</div>
      ) : (
        <VirtualList
          rows={rows}
          favorites={favorites}
          previewId={preview.id}
          previewLoading={preview.loading}
          onPreview={onPreview}
          onAdd={onAdd}
          onFav={toggleFav}
          onDragStart={markRecent}
          projectBpm={projectBpm}
          empty={loading ? 'Searching…' : tab === 'favorites' ? 'Tap ♥ on a sound to keep it here.' : tab === 'recent' ? 'Sounds you add will show up here.' : 'No sounds match. Try fewer filters.'}
        />
      )}
      <div className="shrink-0 border-t border-slate-800 px-3 py-1 text-[10px] text-slate-500">
        {total.toLocaleString()} result{total === 1 ? '' : 's'}
        {loading ? ' · searching…' : ` · ${took.toFixed(1)} ms`}
        {preview.error && <span className="text-rose-300"> · {preview.error}</span>}
      </div>
    </aside>
  );
}

function VirtualList(props: {
  rows: LibraryRow[];
  favorites: string[];
  previewId: string | null;
  previewLoading: boolean;
  onPreview: (e: CatalogEntry) => void;
  onAdd: (e: CatalogEntry) => void;
  onFav: (id: string) => void;
  onDragStart: (id: string) => void;
  projectBpm: number;
  empty: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(400);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    setScroll(0);
  }, [props.rows]);
  const first = Math.max(0, Math.floor(scroll / ROW_H) - 4);
  const last = Math.min(props.rows.length, Math.ceil((scroll + height) / ROW_H) + 4);
  const fav = new Set(props.favorites);
  if (!props.rows.length) return <div className="flex-1 p-6 text-center text-sm text-slate-500">{props.empty}</div>;
  return (
    <div ref={ref} className="daw-scroll min-h-0 flex-1 overflow-y-auto" onScroll={(e) => setScroll(e.currentTarget.scrollTop)} role="list" aria-label="Loops">
      <div style={{ height: props.rows.length * ROW_H, position: 'relative' }}>
        {props.rows.slice(first, last).map((e, i) => (
          <div key={e.id} style={{ position: 'absolute', top: (first + i) * ROW_H, left: 0, right: 0, height: ROW_H }}>
            <LoopRow
              entry={e}
              fav={fav.has(e.id)}
              playing={props.previewId === e.id}
              loading={props.previewId === e.id && props.previewLoading}
              onPreview={props.onPreview}
              onAdd={props.onAdd}
              onFav={props.onFav}
              onDragStart={props.onDragStart}
              projectBpm={props.projectBpm}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const LoopRow = memo(function LoopRow({
  entry: row,
  fav,
  playing,
  loading,
  onPreview,
  onAdd,
  onFav,
  onDragStart,
  projectBpm,
}: {
  entry: LibraryRow;
  fav: boolean;
  playing: boolean;
  loading: boolean;
  onPreview: (e: CatalogEntry) => void;
  onAdd: (e: CatalogEntry) => void;
  onFav: (id: string) => void;
  onDragStart: (id: string) => void;
  projectBpm: number;
}) {
  const s = useStudio();
  // Key versions of the same loop share one row; the picker swaps which one is used.
  const [variant, setVariant] = useState<CatalogEntry>(row);
  useEffect(() => setVariant(row), [row]);
  const entry = variant;
  const chooseKey = (id: string) => {
    if (id === entry.id) return;
    const cached = s.catalog.cached(id);
    if (cached) setVariant(cached);
    else void s.catalog.getEntry(id).then((e) => e && setVariant(e));
  };
  const meta = INSTRUMENT_LABELS[entry.instrument] ?? { label: entry.instrument, emoji: '🎵' };
  const stretch = entry.bpm && !entry.oneShot ? projectBpm / entry.bpm : 1;
  const extreme = stretch < 0.5 || stretch > 2;
  return (
    <div
      role="listitem"
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.setData(LOOP_DRAG_MIME, entry.id);
        ev.dataTransfer.setData('text/plain', entry.name);
        ev.dataTransfer.effectAllowed = 'copy';
        onDragStart(entry.id);
      }}
      className={cx('group mx-1 flex h-[54px] cursor-grab items-center gap-2 rounded-lg px-1.5 active:cursor-grabbing', playing ? 'bg-amber-400/10 ring-1 ring-amber-400/40' : 'hover:bg-slate-800')}
      title={`${entry.name}\n${entry.description ?? ''}\n${entry.creator ? `By ${entry.creator}\n` : ''}License: ${entry.license.id}${entry.license.attribution ? ` — ${entry.license.attribution}` : ''}\nDrag onto the timeline or press + to add.`}
      data-testid="loop-row"
    >
      <GripVertical size={14} className="shrink-0 text-slate-600 group-hover:text-slate-400" aria-hidden />
      <button
        type="button"
        aria-label={playing ? `Stop preview of ${entry.name}` : `Preview ${entry.name}`}
        onClick={() => onPreview(entry)}
        className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', playing ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700')}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : playing ? <Square size={12} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-100">{entry.name}</div>
        <div className="flex items-center gap-1.5 truncate text-[11px] text-slate-400">
          <span>
            {meta.emoji} {meta.label}
          </span>
          {entry.genres[0] && <span>· {GENRE_LABELS[entry.genres[0]] ?? entry.genres[0]}</span>}
          {row.alternates && row.alternates.length > 1 ? (
            <select
              aria-label={`Key of ${entry.name}`}
              title="This loop comes in several keys"
              className="h-4 rounded bg-slate-800 px-0.5 text-[11px] text-sky-300"
              value={entry.id}
              onChange={(e) => chooseKey(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {row.alternates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.key ?? '—'}
                </option>
              ))}
            </select>
          ) : (
            entry.key && <span className="text-sky-300">· {entry.key}</span>
          )}
        </div>
        <MiniWave peaks={entry.peaks} />
      </div>
      <div className="shrink-0 text-right font-mono text-[11px] leading-tight text-slate-400">
        <div className={cx(extreme && 'text-rose-300')} title={extreme ? 'Very different from your song tempo: stretching may sound rough' : undefined}>
          {entry.oneShot ? 'one-shot' : entry.bpm ? `${entry.bpm} bpm` : ''}
        </div>
        <div>{entry.bars ? `${entry.bars} bar${entry.bars === 1 ? '' : 's'}` : `${entry.durationSec.toFixed(1)}s`}</div>
      </div>
      <button type="button" aria-label={fav ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={fav} onClick={() => onFav(entry.id)} className={cx('shrink-0 rounded p-1', fav ? 'text-rose-400' : 'text-slate-600 hover:text-slate-300')}>
        <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
      </button>
      <button type="button" aria-label={`Add ${entry.name} to song`} title="Add to song" onClick={() => onAdd(entry)} className="shrink-0 rounded-md bg-amber-400/15 p-1 text-amber-300 hover:bg-amber-400/30" data-testid="add-loop">
        <Plus size={16} />
      </button>
    </div>
  );
});

const MiniWave = memo(function MiniWave({ peaks }: { peaks: string }) {
  const values = useMemo(() => (peaks ? Array.from(decodePeaks(peaks)) : []), [peaks]);
  if (!values.length) return null;
  return (
    <div className="mt-0.5 flex h-2.5 items-center gap-px opacity-70" aria-hidden>
      {values.filter((_, i) => i % 2 === 0).map((v, i) => (
        <div key={i} className="w-[2px] rounded-sm bg-slate-500" style={{ height: `${Math.max(8, (v / 255) * 100)}%` }} />
      ))}
    </div>
  );
});
