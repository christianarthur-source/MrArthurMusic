import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ImagePlus, Info, Loader2, Search, Sparkles, Upload, X } from 'lucide-react';
import { compressImage } from '../../services/plannerContent';
import {
  generateImage,
  keepImage,
  lookupWikipedia,
  photoToImage,
  PickedImage,
  PICTURE_STYLES,
  searchPhotos,
  searchStock,
  STOCK_NAMES,
  StockOrientation,
  StockSource,
  stockStatus,
  stockToImage,
  StockType,
  wikiToImage
} from '../../services/imageTools';
import { PictureStyle } from '../../types';

/**
 * The Image Finder: one search across Wikipedia, Pixabay, Pexels, Unsplash and the free photo
 * libraries (Openverse / Wikimedia Commons), plus AI drawing and upload, with type, shape and
 * color filters and a large preview. Stock libraries appear once their keys are added to the site.
 */

interface Props {
  title?: string;
  /** Starting words for the search and the AI drawing. */
  initialPrompt?: string;
  /** Wide (16:9) pictures for slides; otherwise square-ish. Sets the starting shape filter. */
  wide?: boolean;
  /** What the picture is of: a named subject (Wikipedia image first) and/or a description. */
  suggest?: { subject?: string; idea: string };
  /** A deck's drawing style: illustrations are preferred unless it's "realistic". */
  style?: PictureStyle;
  onPick: (image: PickedImage) => void;
  onClose: () => void;
}

type Tab = 'best' | 'wikipedia' | StockSource | 'library' | 'ai' | 'upload';

interface Candidate {
  key: string;
  thumb: string;
  badge: string;
  kind: string;
  width: number;
  height: number;
  image: PickedImage;
}

const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown', 'black', 'white', 'gray'];
const TYPES: { id: StockType; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'photo', label: 'Photos' },
  { id: 'illustration', label: 'Illustrations' },
  { id: 'vector', label: 'Clip art' }
];
const SHAPES: { id: StockOrientation; label: string }[] = [
  { id: 'landscape', label: 'Wide' },
  { id: 'square', label: 'Square' },
  { id: 'any', label: 'Any shape' }
];

/** Mixes result lists one from each in turn, so "Best matches" shows every library near the top. */
function interleave(lists: Candidate[][]): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const c = l[i];
      if (c && !seen.has(c.thumb)) {
        seen.add(c.thumb);
        out.push(c);
      }
    }
  }
  return out;
}

export const ImagePickerModal: React.FC<Props> = ({ title = 'Find a picture', initialPrompt = '', wide = true, suggest, style, onPick, onClose }) => {
  const startWords = (suggest?.subject || suggest?.idea || initialPrompt).split(/[,.]/)[0].slice(0, 80);
  const [query, setQuery] = useState(startWords);
  const [prompt, setPrompt] = useState(suggest?.idea || initialPrompt);
  const [drawStyle, setDrawStyle] = useState<PictureStyle>(style || 'storybook');
  const [tab, setTab] = useState<Tab>('best');
  const [type, setType] = useState<StockType>('all');
  const [shape, setShape] = useState<StockOrientation>(wide ? 'landscape' : 'any');
  const [color, setColor] = useState('');
  const [status, setStatus] = useState<Record<StockSource, boolean> | null>(null);
  const [results, setResults] = useState<Candidate[]>([]);
  const [page, setPage] = useState(1);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Candidate | null>(null);
  const searchId = useRef(0);

  useEffect(() => {
    stockStatus().then((s) => {
      setStatus(s);
      // Decks drawn in a cartoon/storybook/flat style start on illustrations when Pixabay is set up
      if (s.pixabay && style && style !== 'realistic' && !suggest?.subject) setType('illustration');
    });
  }, []);

  const stockSources = (['pixabay', 'pexels', 'unsplash'] as StockSource[]).filter((s) => status?.[s]);
  // Pexels and Unsplash only have photos; illustrations and clip art come from Pixabay
  const stockFor = (t: StockType) => stockSources.filter((s) => s === 'pixabay' || t === 'all' || t === 'photo');
  const photosOnly = type === 'all' || type === 'photo';

  const fromStock = (r: Awaited<ReturnType<typeof searchStock>>[number]): Candidate => ({
    key: r.id,
    thumb: r.thumbnail,
    badge: STOCK_NAMES[r.source],
    kind: r.kind,
    width: r.width,
    height: r.height,
    image: stockToImage(r)
  });

  const search = async (nextPage = 1) => {
    if (!query.trim() || tab === 'ai' || tab === 'upload' || !status) return;
    const id = ++searchId.current;
    setSearching(true);
    setError('');
    if (nextPage === 1) {
      setResults([]);
      setPreview(null);
    }
    const opts = { type, orientation: shape, color: color || undefined, page: nextPage };
    const stock = (source: StockSource) => searchStock(source, query, opts).then((r) => r.map(fromStock)).catch(() => [] as Candidate[]);
    const wiki = async (): Promise<Candidate[]> => {
      const w = await lookupWikipedia(suggest?.subject || query);
      const img = w && wikiToImage(w);
      return img && w?.image ? [{ key: `wiki-${w.title}`, thumb: w.image.url, badge: 'Wikipedia', kind: 'photo', width: w.image.width, height: w.image.height, image: img }] : [];
    };
    const library = (): Promise<Candidate[]> =>
      searchPhotos(query)
        .then((r) => r.map((p) => ({ key: p.url, thumb: p.thumbnail, badge: p.sourceUrl.includes('wikimedia') ? 'Wikimedia' : 'Openverse', kind: 'photo', width: p.width, height: p.height, image: photoToImage(p) })))
        .catch(() => []);

    try {
      let found: Candidate[] = [];
      if (tab === 'best') {
        const lists = await Promise.all([
          nextPage === 1 && photosOnly ? wiki() : Promise.resolve([]),
          ...stockFor(type).map(stock),
          // The free libraries fill in when no keyed library is set up for this kind of picture
          nextPage === 1 && photosOnly && stockFor(type).length < 2 ? library() : Promise.resolve([])
        ]);
        found = interleave(lists);
      } else if (tab === 'wikipedia') {
        found = nextPage === 1 ? await wiki() : [];
      } else if (tab === 'library') {
        found = nextPage === 1 ? await library() : [];
      } else {
        found = await stock(tab);
      }
      if (id !== searchId.current) return;
      // Shape filter for sources that don't support it themselves
      if (shape === 'landscape') found = found.filter((c) => !c.width || c.width >= c.height * 1.05);
      if (shape === 'square') found = found.filter((c) => !c.width || Math.abs(c.width / c.height - 1) < 0.3);
      setResults((prev) => (nextPage === 1 ? found : [...prev, ...found.filter((f) => !prev.some((p) => p.key === f.key))]));
      setPage(nextPage);
      if (nextPage === 1 && !found.length) setError('No pictures found. Try fewer or simpler words, or a different filter.');
    } finally {
      if (id === searchId.current) setSearching(false);
    }
  };

  // Search whenever the filters, tab or library list change
  useEffect(() => {
    search(1);
  }, [tab, type, shape, color, status]);

  const use = async (image: PickedImage) => {
    setBusy(true);
    setError('');
    try {
      onPick(await keepImage(image));
    } catch (err: any) {
      setError(err?.message || 'Could not get that picture. Please try another.');
    } finally {
      setBusy(false);
    }
  };

  const draw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const img = await generateImage(prompt, shape !== 'square', drawStyle);
      setPreview({ key: `ai-${Date.now()}`, thumb: img.src, badge: 'AI drawing', kind: 'illustration', width: 0, height: 0, image: img });
    } catch (err: any) {
      setError(err?.message || 'Could not draw that picture.');
    } finally {
      setBusy(false);
    }
  };

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'best', label: 'Best matches', show: true },
    { id: 'wikipedia', label: 'Wikipedia', show: true },
    { id: 'pixabay', label: 'Pixabay', show: !!status?.pixabay },
    { id: 'pexels', label: 'Pexels', show: !!status?.pexels },
    { id: 'unsplash', label: 'Unsplash', show: !!status?.unsplash },
    { id: 'library', label: 'Free library', show: true },
    { id: 'ai', label: 'AI drawing', show: true },
    { id: 'upload', label: 'Upload', show: true }
  ];
  const missing = (['pixabay', 'pexels', 'unsplash'] as StockSource[]).filter((s) => status && !status[s]);
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-semibold ${active ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'}`;
  const field =
    'text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';
  const thumbAspect = shape === 'square' ? 'aspect-square' : 'aspect-video';

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-6xl max-h-[94vh] flex flex-col bg-white dark:bg-stone-900 rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header and search */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg font-bold text-stone-900 dark:text-white mr-auto">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {tab !== 'ai' && tab !== 'upload' && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(1); }}>
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pictures, e.g. xylophone, kids dancing, orchestra" aria-label="Search pictures" className={`${field} w-full pl-9`} />
              </div>
              <button type="submit" className="px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">Search</button>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label="Picture source">
            {tabs.filter((t) => t.show).map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${tab === t.id ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'}`}>
                {t.id === 'ai' && <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5" />}
                {t.id === 'upload' && <Upload className="w-3 h-3 inline mr-1 -mt-0.5" />}
                {t.id === 'wikipedia' && <BookOpen className="w-3 h-3 inline mr-1 -mt-0.5" />}
                {t.label}
              </button>
            ))}
          </div>

          {tab !== 'ai' && tab !== 'upload' && tab !== 'wikipedia' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)} className={chip(type === t.id)} disabled={t.id !== 'all' && t.id !== 'photo' && !status?.pixabay} title={t.id === 'illustration' || t.id === 'vector' ? (status?.pixabay ? '' : 'Comes from Pixabay: add its key to turn this on') : ''}>
                  {t.label}
                </button>
              ))}
              <span className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" aria-hidden />
              {SHAPES.map((s) => (
                <button key={s.id} type="button" onClick={() => setShape(s.id)} className={chip(shape === s.id)}>
                  {s.label}
                </button>
              ))}
              <span className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" aria-hidden />
              <select value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color" className="text-xs font-semibold px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border-0 text-stone-600 dark:text-stone-300">
                <option value="">Any color</option>
                {COLORS.map((c) => (
                  <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Results and preview */}
        <div className="flex-1 min-h-0 grid lg:grid-cols-[1fr_22rem]">
          <div className="overflow-y-auto p-4 sm:p-5 space-y-4">
            {tab === 'ai' && (
              <form className="space-y-3 max-w-2xl" onSubmit={draw}>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Describe the picture, e.g. children playing colorful boomwhackers in a circle" className={`${field} w-full`} aria-label="Picture description" />
                <div className="flex flex-wrap items-center gap-2">
                  <select value={drawStyle} onChange={(e) => setDrawStyle(e.target.value as PictureStyle)} aria-label="Drawing style" className={field}>
                    {PICTURE_STYLES.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button type="submit" disabled={busy || !prompt.trim()} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {preview?.badge === 'AI drawing' ? 'Draw another' : 'Draw it'}
                  </button>
                  <span className="text-xs text-stone-500">Free AI on your Cloudflare account. Best for scenes and ideas, not exact instruments.</span>
                </div>
              </form>
            )}

            {tab === 'upload' && (
              <label className="block p-10 rounded-2xl border-2 border-dashed border-stone-300 dark:border-stone-700 text-center cursor-pointer hover:border-brand-400">
                <Upload className="w-6 h-6 mx-auto text-stone-400" />
                <span className="block mt-2 text-sm text-stone-600 dark:text-stone-300">Choose an image from this device</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    const src = await compressImage(file, 1280);
                    setPreview({ key: 'upload', thumb: src, badge: 'Your upload', kind: 'photo', width: 0, height: 0, image: { src, alt: file.name.replace(/\.[^.]+$/, '') } });
                  }}
                />
              </label>
            )}

            {tab !== 'ai' && tab !== 'upload' && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {results.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setPreview(c)}
                      onDoubleClick={() => use(c.image)}
                      title={`${c.image.alt || ''} — ${c.image.credit || c.badge}`}
                      className={`group relative ${thumbAspect} rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 border-2 ${preview?.key === c.key ? 'border-brand-500' : 'border-transparent hover:border-brand-300'}`}
                    >
                      <img src={c.thumb} alt={c.image.alt || ''} loading="lazy" className={`w-full h-full ${c.kind === 'photo' ? 'object-cover' : 'object-contain bg-white'} transition-transform group-hover:scale-105`} />
                      <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-white">
                        {c.badge}
                        {c.kind !== 'photo' && ` · ${c.kind === 'vector' ? 'clip art' : 'illustration'}`}
                      </span>
                    </button>
                  ))}
                  {searching &&
                    Array.from({ length: results.length ? 4 : 12 }, (_, i) => <div key={`s${i}`} className={`${thumbAspect} rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse`} />)}
                </div>
                {!searching && results.length > 0 && (tab === 'best' ? stockFor(type).length > 0 : ['pixabay', 'pexels', 'unsplash'].includes(tab)) && (
                  <div className="text-center">
                    <button type="button" onClick={() => search(page + 1)} className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 text-sm font-semibold">
                      Show more
                    </button>
                  </div>
                )}
                {missing.length > 0 && (
                  <p className="text-xs text-stone-500 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    For millions more pictures{missing.includes('pixabay') ? ', including illustrations and clip art' : ''}, add free {missing.map((m) => STOCK_NAMES[m]).join(', ')} keys to the site's Worker
                    {' '}(Cloudflare → mrarthurmusic → Settings → Variables and Secrets).
                  </p>
                )}
              </>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>

          {/* Large preview */}
          <aside className="border-t lg:border-t-0 lg:border-l border-stone-200 dark:border-stone-800 p-4 sm:p-5 space-y-3 overflow-y-auto bg-stone-50/60 dark:bg-stone-950/30">
            {preview ? (
              <>
                <div className="rounded-2xl overflow-hidden bg-white dark:bg-stone-800 flex items-center justify-center">
                  <img src={preview.image.src} alt={preview.image.alt || ''} className="max-h-[22rem] w-full object-contain" />
                </div>
                <div className="text-xs text-stone-500 space-y-0.5">
                  {preview.image.alt && <p className="font-semibold text-stone-700 dark:text-stone-200 line-clamp-2">{preview.image.alt}</p>}
                  <p>
                    {preview.image.creditUrl ? (
                      <a href={preview.image.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{preview.image.credit || preview.badge}</a>
                    ) : (
                      preview.image.credit || preview.badge
                    )}
                  </p>
                  {preview.width > 0 && <p>{preview.width} × {preview.height}</p>}
                </div>
                <button type="button" disabled={busy} onClick={() => use(preview.image)} className="w-full px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2">
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  Use this picture
                </button>
              </>
            ) : (
              <p className="text-sm text-stone-500 text-center py-10">Click a picture to see it large. Double-click to use it right away.</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};
