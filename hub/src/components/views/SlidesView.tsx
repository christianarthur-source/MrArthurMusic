import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  MonitorPlay,
  Plus,
  Presentation,
  Printer,
  Sparkles,
  Trash2,
  Wand2,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { useRememberedState, REMEMBERED_PREFIX } from '../../hooks/useRememberedState';
import {
  blankSlide,
  deckFromLesson,
  draftOutline,
  fillPictures,
  newDeckId,
  newSlideId,
  OutlineItem,
  research,
  REWRITE_PRESETS,
  rewriteSlide,
  THEMES,
  writeSlides
} from '../../services/slideMaker';
import { PICTURE_STYLES, WikiFact } from '../../services/imageTools';
import { listTracks, StoredTrack } from '../../services/audioLibrary';
import { exportDeckToPptx } from '../../services/pptxExport';
import { pickEngine } from '../../services/aiWriter';
import { SlideCanvas } from '../slides/SlideCanvas';
import { readPickerLists } from '../slides/LiveWidgets';
import { ImagePickerModal } from '../shared/ImagePickerModal';
import { DeckBrief, LessonPlan, PictureKind, Slide, SlideDeck, SlideLayout } from '../../types';

const LAYOUT_OPTIONS: { id: SlideLayout; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'image-right', label: 'Text + picture' },
  { id: 'image-full', label: 'Big picture' },
  { id: 'big-idea', label: 'Big idea' }
];
const INTERACTIVE_OPTIONS: { id: SlideLayout; label: string }[] = [
  { id: 'video', label: 'YouTube video' },
  { id: 'audio', label: 'Audio track' },
  { id: 'timer', label: 'Timer' },
  { id: 'picker', label: 'Name picker' }
];
const PICTURE_LAYOUTS: SlideLayout[] = ['title', 'image-right', 'image-full'];
const TONES = ['Friendly and fun', 'Calm and clear', 'Excited and energetic', 'Thoughtful and respectful'];
const SAVE_DELAY_MS = 600;

const field =
  'w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const label = 'text-[11px] font-bold uppercase tracking-wider text-stone-400';
const smallBtn =
  'p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 dark:hover:text-white disabled:opacity-30';

const youTubeLibrary = (): { youtubeId: string; title: string }[] => {
  try {
    return JSON.parse(localStorage.getItem('mth_youtube_videos') || '[]');
  } catch {
    return [];
  }
};
const parseYouTubeId = (text: string) => {
  const m = text.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(text.trim()) ? text.trim() : '';
};

/** Slide decks: describe one (or start from a lesson), review the outline, then edit, present and export. */
export const SlidesView: React.FC = () => {
  const { showToast } = useApp();
  const [decks, setDecks] = useState(storage.listDecks());
  const [openId, setOpenId] = useRememberedState<string | null>('slides.open', null);
  const [deck, setDeck] = useState<SlideDeck | null>(() => (openId ? storage.getDeck(openId) : null));
  const [current, setCurrent] = useRememberedState('slides.current', 0);
  const [creating, setCreating] = useState<{ lessonId?: string } | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [rewriting, setRewriting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<SlideDeck | null>(null);

  useEffect(() => storage.subscribe(() => setDecks(storage.listDecks())), []);

  // "Make Slides" in the Lesson Planner opens the new-deck form for that lesson.
  useEffect(() => {
    try {
      const key = REMEMBERED_PREFIX + 'slides.fromLesson';
      const lessonId = JSON.parse(localStorage.getItem(key) || 'null');
      if (lessonId) {
        localStorage.removeItem(key);
        setCreating({ lessonId });
      }
    } catch {}
  }, []);

  // Save edits shortly after they stop (decks with pictures are large), and on leaving.
  const flush = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (pending.current) storage.saveDeck(pending.current);
    pending.current = null;
  };
  useEffect(() => flush, []);

  const update = (next: SlideDeck) => {
    setDeck(next);
    pending.current = next;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DELAY_MS);
  };

  const open = (id: string | null) => {
    flush();
    setOpenId(id);
    setDeck(id ? storage.getDeck(id) : null);
    setCurrent(0);
  };

  // ---------------------------------------------------------------------------
  if (creating) {
    return (
      <NewDeckFlow
        lessonId={creating.lessonId}
        onCancel={() => setCreating(null)}
        onCreated={(created) => {
          storage.saveDeck(created);
          setCreating(null);
          open(created.id);
          showToast(`Made "${created.title}" with ${created.slides.length} slides`, 'success');
        }}
      />
    );
  }

  if (!deck) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-wrap items-center gap-3">
          <MonitorPlay className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-bold text-stone-900 dark:text-white mr-auto">Slides</h1>
          <button type="button" onClick={() => setCreating({})} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            New deck
          </button>
        </div>
        {decks.length === 0 ? (
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-10 text-center border border-stone-200/80 dark:border-stone-800 space-y-2">
            <p className="font-semibold text-stone-800 dark:text-stone-200">No decks yet</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Click <strong>New deck</strong> and describe what you want, or use <strong>Make Slides</strong> on any lesson.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {decks.map((d) => {
              const full = storage.getDeck(d.id);
              return (
                <button key={d.id} type="button" onClick={() => open(d.id)} className="text-left rounded-3xl overflow-hidden bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-card hover:border-brand-500 transition-colors">
                  {full?.slides[0] && <SlideCanvas slide={full.slides[0]} theme={full.theme} />}
                  <div className="p-4">
                    <div className="font-bold text-stone-900 dark:text-white truncate">{d.title}</div>
                    <div className="text-xs text-stone-500">{d.slideCount} slides · {new Date(d.updatedAt).toLocaleDateString()}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  const index = Math.min(current, deck.slides.length - 1);
  const slide = deck.slides[index];
  const isInteractive = INTERACTIVE_OPTIONS.some((o) => o.id === slide.layout);

  const setSlide = (updates: Partial<Slide>) =>
    update({ ...deck, slides: deck.slides.map((s, i) => (i === index ? { ...s, ...updates } : s)) });

  const insertSlide = (s: Slide) => {
    const slides = [...deck.slides];
    slides.splice(index + 1, 0, s);
    update({ ...deck, slides });
    setCurrent(index + 1);
  };

  const move = (dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= deck.slides.length) return;
    const slides = [...deck.slides];
    [slides[index], slides[to]] = [slides[to], slides[index]];
    update({ ...deck, slides });
    setCurrent(to);
  };

  const removeSlide = () => {
    if (deck.slides.length === 1) return;
    update({ ...deck, slides: deck.slides.filter((_, i) => i !== index) });
    setCurrent(Math.max(0, index - 1));
  };

  const rewrite = async (instruction: string) => {
    setMenu(null);
    if (!instruction.trim()) return;
    setRewriting(true);
    try {
      const target = slide;
      const changes = await rewriteSlide(deck, target, instruction);
      update({ ...deck, slides: deck.slides.map((s) => (s.id === target.id ? { ...s, ...changes } : s)) });
      showToast('Slide rewritten', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not rewrite the slide', 'error');
    } finally {
      setRewriting(false);
    }
  };

  const exportPptx = async () => {
    flush();
    setExportMsg('Starting…');
    try {
      await exportDeckToPptx(deck, setExportMsg);
      showToast('Downloaded the .pptx file', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not make the PowerPoint file', 'error');
    } finally {
      setExportMsg('');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-200">
      {/* Deck bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => open(null)} aria-label="All decks" className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <input value={deck.title} onChange={(e) => update({ ...deck, title: e.target.value })} aria-label="Deck title" className="flex-1 min-w-[12rem] text-lg font-bold bg-transparent text-stone-900 dark:text-white focus:outline-none" />
        <select value={deck.theme} onChange={(e) => update({ ...deck, theme: e.target.value as SlideDeck['theme'] })} aria-label="Theme" className="text-xs font-semibold px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 border-0 text-stone-700 dark:text-stone-200">
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <ExportMenu busyMessage={exportMsg} onPptx={exportPptx} onPrint={() => { flush(); setPrinting(true); }} />
        <button type="button" onClick={() => { flush(); setPresenting(true); }} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5">
          <Presentation className="w-4 h-4" />
          Present
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`Delete the deck "${deck.title}"?`)) return;
            storage.deleteDeck(deck.id);
            pending.current = null;
            open(null);
          }}
          aria-label="Delete deck"
          className="p-2 rounded-xl text-stone-400 hover:text-rose-600"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid lg:grid-cols-[11rem_1fr_19rem] gap-4 items-start">
        {/* Slide strip */}
        <div className="order-2 lg:order-1 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto lg:max-h-[75vh] pb-1">
          {deck.slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index}
              className={`shrink-0 w-36 lg:w-full rounded-lg overflow-hidden border-2 ${i === index ? 'border-brand-500' : 'border-transparent hover:border-stone-300 dark:hover:border-stone-600'}`}
            >
              <SlideCanvas slide={s} theme={deck.theme} number={i + 1} />
            </button>
          ))}
        </div>

        {/* Current slide (right-click for picture and rewrite options) */}
        <div className="order-1 lg:order-2 space-y-2">
          <div
            className="relative rounded-2xl overflow-hidden shadow-xl"
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY });
            }}
          >
            <SlideCanvas slide={slide} theme={deck.theme} />
            {rewriting && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-sm font-semibold gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Rewriting…
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <NewSlideMenu onAdd={(layout) => insertSlide({ ...blankSlide(layout), timerMinutes: layout === 'timer' ? 3 : undefined })} />
            <button type="button" onClick={() => insertSlide({ ...slide, id: newSlideId() })} className={smallBtn} title="Duplicate slide" aria-label="Duplicate slide">
              <Copy className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(-1)} disabled={index === 0} className={smallBtn} title="Move up" aria-label="Move slide up">
              <ArrowUp className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => move(1)} disabled={index === deck.slides.length - 1} className={smallBtn} title="Move down" aria-label="Move slide down">
              <ArrowDown className="w-4 h-4" />
            </button>
            <button type="button" onClick={removeSlide} disabled={deck.slides.length === 1} className={`${smallBtn} hover:text-rose-600`} title="Delete slide" aria-label="Delete slide">
              <Trash2 className="w-4 h-4" />
            </button>
            <span className="ml-auto text-xs text-stone-400">Right-click the slide for pictures and rewrites · Slide {index + 1} of {deck.slides.length}</span>
          </div>
        </div>

        {/* Slide details */}
        <div className="order-3 bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex flex-wrap gap-1">
            {(isInteractive ? INTERACTIVE_OPTIONS : LAYOUT_OPTIONS).map((l) => (
              <button key={l.id} type="button" onClick={() => setSlide({ layout: l.id })} aria-pressed={slide.layout === l.id} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${slide.layout === l.id ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}>
                {l.label}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className={label}>Title</span>
            <input value={slide.title} onChange={(e) => setSlide({ title: e.target.value })} className={field} />
          </label>
          {(slide.layout === 'title' || slide.layout === 'image-full' || slide.layout === 'big-idea') && (
            <label className="block space-y-1">
              <span className={label}>Subtitle</span>
              <input value={slide.subtitle || ''} onChange={(e) => setSlide({ subtitle: e.target.value })} className={field} />
            </label>
          )}
          {(slide.layout === 'bullets' || slide.layout === 'image-right') && (
            <label className="block space-y-1">
              <span className={label}>Bullets (one per line)</span>
              <textarea
                value={slide.bullets.join('\n')}
                onChange={(e) => setSlide({ bullets: e.target.value.split('\n') })}
                onBlur={() => setSlide({ bullets: slide.bullets.map((b) => b.trim()).filter(Boolean) })}
                rows={4}
                className={field}
              />
            </label>
          )}

          {isInteractive && <InteractiveSettings slide={slide} onChange={setSlide} />}

          {PICTURE_LAYOUTS.includes(slide.layout) && (
            <div className="space-y-1.5">
              <span className={label}>Picture</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPickingImage(true)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5" />
                  {slide.image ? 'Select a new image' : 'Add picture'}
                </button>
                {slide.image && (
                  <button type="button" onClick={() => setSlide({ image: undefined })} className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-semibold">
                    Remove
                  </button>
                )}
              </div>
              {slide.image?.credit && (
                <p className="text-[11px] text-stone-400">
                  {slide.image.creditUrl ? <a href={slide.image.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{slide.image.credit}</a> : slide.image.credit}
                </p>
              )}
            </div>
          )}

          {!isInteractive && (
            <div className="space-y-1.5">
              <span className={label}>Rewrite with AI</span>
              <div className="flex flex-wrap gap-1">
                {REWRITE_PRESETS.slice(0, 3).map((p) => (
                  <button key={p} type="button" disabled={rewriting} onClick={() => rewrite(p)} className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 disabled:opacity-40">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block space-y-1">
            <span className={label}>Speaker notes (only you see these)</span>
            <textarea value={slide.notes || ''} onChange={(e) => setSlide({ notes: e.target.value })} rows={4} className={field} />
          </label>

          {!!deck.sources?.length && (
            <div className="space-y-1 pt-1 border-t border-stone-100 dark:border-stone-800">
              <span className={label}>Facts came from</span>
              <ul className="text-xs space-y-0.5">
                {deck.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">{s.title}</a>
                    <span className="text-stone-400"> · Wikipedia</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {menu && (
        <SlideContextMenu
          x={menu.x}
          y={menu.y}
          canPicture={PICTURE_LAYOUTS.includes(slide.layout)}
          hasPicture={!!slide.image}
          canRewrite={!isInteractive}
          onClose={() => setMenu(null)}
          onNewImage={() => { setMenu(null); setPickingImage(true); }}
          onRemoveImage={() => { setMenu(null); setSlide({ image: undefined }); }}
          onRewrite={rewrite}
        />
      )}
      {pickingImage && (
        <ImagePickerModal
          title="Select a new image"
          initialPrompt={slide.imageIdea || slide.title}
          suggest={{ subject: slide.subject, idea: slide.imageIdea || slide.title }}
          style={deck.brief?.pictureStyle}
          onClose={() => setPickingImage(false)}
          onPick={(image) => {
            setSlide({ image });
            setPickingImage(false);
          }}
        />
      )}
      {presenting && <Presenter deck={deck} start={index} onClose={(at) => { setPresenting(false); setCurrent(at); }} />}
      {printing && <PrintDeck deck={deck} onDone={() => setPrinting(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Editor pieces

const ExportMenu: React.FC<{ busyMessage: string; onPptx: () => void; onPrint: () => void }> = ({ busyMessage, onPptx, onPrint }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={!!busyMessage} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
        {busyMessage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {busyMessage || 'Export'}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-72 rounded-2xl bg-white dark:bg-stone-800 shadow-xl border border-stone-200 dark:border-stone-700 p-2 text-sm" onMouseLeave={() => setOpen(false)}>
          <button type="button" onClick={() => { setOpen(false); onPptx(); }} className="w-full text-left p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700">
            <span className="block font-semibold text-stone-900 dark:text-white">PowerPoint / Keynote (.pptx)</span>
            <span className="block text-xs text-stone-500">Opens in PowerPoint and Apple Keynote. Text stays editable.</span>
          </button>
          <button type="button" onClick={() => { setOpen(false); onPptx(); }} className="w-full text-left p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700">
            <span className="block font-semibold text-stone-900 dark:text-white">Google Slides</span>
            <span className="block text-xs text-stone-500">Downloads the .pptx. In Google Drive: New → File upload, then open it with Google Slides.</span>
          </button>
          <button type="button" onClick={() => { setOpen(false); onPrint(); }} className="w-full text-left p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 flex items-start gap-2">
            <Printer className="w-4 h-4 mt-0.5 text-stone-400" />
            <span>
              <span className="block font-semibold text-stone-900 dark:text-white">Print / PDF</span>
              <span className="block text-xs text-stone-500">One slide per page.</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

const NewSlideMenu: React.FC<{ onAdd: (layout: SlideLayout) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        New slide
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-48 rounded-xl bg-white dark:bg-stone-800 shadow-xl border border-stone-200 dark:border-stone-700 p-1 text-xs" onMouseLeave={() => setOpen(false)}>
          {[...LAYOUT_OPTIONS, ...INTERACTIVE_OPTIONS].map((l, i) => (
            <React.Fragment key={l.id}>
              {i === LAYOUT_OPTIONS.length && <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">Interactive</div>}
              <button type="button" onClick={() => { setOpen(false); onAdd(l.id); }} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200">
                {l.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const SlideContextMenu: React.FC<{
  x: number;
  y: number;
  canPicture: boolean;
  hasPicture: boolean;
  canRewrite: boolean;
  onClose: () => void;
  onNewImage: () => void;
  onRemoveImage: () => void;
  onRewrite: (instruction: string) => void;
}> = ({ x, y, canPicture, hasPicture, canRewrite, onClose, onNewImage, onRemoveImage, onRewrite }) => {
  const [custom, setCustom] = useState('');
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const item = 'w-full text-left px-3 py-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-100';
  return (
    <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        role="menu"
        className="absolute w-64 rounded-xl bg-white dark:bg-stone-800 shadow-2xl border border-stone-200 dark:border-stone-700 p-1 text-sm"
        style={{ left: Math.min(x, window.innerWidth - 270), top: Math.min(y, window.innerHeight - 340) }}
        onClick={(e) => e.stopPropagation()}
      >
        {canPicture && (
          <>
            <button type="button" role="menuitem" onClick={onNewImage} className={`${item} flex items-center gap-2 font-semibold`}>
              <ImagePlus className="w-4 h-4 text-brand-600" />
              Select a new image
            </button>
            {hasPicture && (
              <button type="button" role="menuitem" onClick={onRemoveImage} className={item}>
                Remove image
              </button>
            )}
          </>
        )}
        {canRewrite && (
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1">
              <Wand2 className="w-3 h-3" /> Rewrite this slide
            </div>
            {REWRITE_PRESETS.map((p) => (
              <button key={p} type="button" role="menuitem" onClick={() => onRewrite(p)} className={item}>
                {p}
              </button>
            ))}
            <form className="p-1.5" onSubmit={(e) => { e.preventDefault(); onRewrite(custom); }}>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Or say what to change…" className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700" />
            </form>
          </>
        )}
      </div>
    </div>
  );
};

const InteractiveSettings: React.FC<{ slide: Slide; onChange: (u: Partial<Slide>) => void }> = ({ slide, onChange }) => {
  const [tracks, setTracks] = useState<StoredTrack[]>([]);
  const [videoText, setVideoText] = useState('');
  useEffect(() => {
    if (slide.layout === 'audio') listTracks().then(setTracks).catch(() => setTracks([]));
  }, [slide.layout]);

  if (slide.layout === 'video') {
    const library = youTubeLibrary();
    return (
      <div className="space-y-2">
        <span className={label}>Video</span>
        {library.length > 0 && (
          <select
            value={slide.video?.youtubeId || ''}
            onChange={(e) => {
              const v = library.find((x) => x.youtubeId === e.target.value);
              if (v) onChange({ video: { youtubeId: v.youtubeId, title: v.title }, title: slide.title || v.title });
            }}
            className={field}
            aria-label="Video from your YouTube library"
          >
            <option value="">From your YouTube library…</option>
            {library.map((v) => (
              <option key={v.youtubeId} value={v.youtubeId}>{v.title}</option>
            ))}
          </select>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const id = parseYouTubeId(videoText);
            if (id) onChange({ video: { youtubeId: id, title: slide.title || '' } });
            setVideoText('');
          }}
        >
          <input value={videoText} onChange={(e) => setVideoText(e.target.value)} placeholder="…or paste a YouTube link" className={field} aria-label="YouTube link" />
          <button type="submit" className="px-3 rounded-xl bg-brand-600 text-white text-xs font-semibold">Set</button>
        </form>
      </div>
    );
  }
  if (slide.layout === 'audio') {
    return (
      <label className="block space-y-1">
        <span className={label}>Track (from this device's Audio Studio)</span>
        <select
          value={slide.audio?.trackId || ''}
          onChange={(e) => {
            const t = tracks.find((x) => x.id === e.target.value);
            if (t) onChange({ audio: { trackId: t.id, title: t.title }, title: slide.title || t.title });
          }}
          className={field}
        >
          <option value="">{tracks.length ? 'Choose a track…' : 'No tracks yet: add some in the Audio Studio'}</option>
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
      </label>
    );
  }
  if (slide.layout === 'timer') {
    return (
      <label className="block space-y-1">
        <span className={label}>Minutes</span>
        <input type="number" min={0.25} max={60} step={0.25} value={slide.timerMinutes || 1} onChange={(e) => onChange({ timerMinutes: Math.max(0.25, Number(e.target.value) || 1) })} className={field} />
      </label>
    );
  }
  const lists = readPickerLists();
  return (
    <label className="block space-y-1">
      <span className={label}>Name list (from this device's Name Picker)</span>
      <select value={slide.pickerListId || ''} onChange={(e) => onChange({ pickerListId: e.target.value })} className={field}>
        <option value="">{lists.length ? 'Choose a list…' : 'No lists yet: make one in the Name Picker'}</option>
        {lists.map((l) => (
          <option key={l.id} value={l.id}>{l.title} ({l.names.length})</option>
        ))}
      </select>
    </label>
  );
};

// ---------------------------------------------------------------------------
// New deck: brief → research → outline review → build

type Step = 'brief' | 'working' | 'outline';

const NewDeckFlow: React.FC<{ lessonId?: string; onCancel: () => void; onCreated: (deck: SlideDeck) => void }> = ({ lessonId, onCancel, onCreated }) => {
  const lessons = storage.getLessonPlans();
  const startLesson = lessons.find((l) => l.id === lessonId);
  const [step, setStep] = useState<Step>('brief');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<'claude' | 'free' | null>(null);
  const [brief, setBrief] = useRememberedState<DeckBrief>('slides.lastBrief', {
    description: '',
    slideCount: 8,
    tone: TONES[0],
    pictureStyle: 'storybook',
    pictureSource: 'auto'
  });
  const [lessonChoice, setLessonChoice] = useState(lessonId || '');
  const [facts, setFacts] = useState<WikiFact[]>([]);
  const [plan, setPlan] = useState<{ title: string; theme: SlideDeck['theme']; outline: OutlineItem[] } | null>(null);
  const [showSources, setShowSources] = useState(!!brief.sourceText);

  useEffect(() => {
    pickEngine().then(setEngine);
    if (startLesson) setBrief((b) => ({ ...b, description: `Slides to teach my lesson "${startLesson.title}"`, grade: startLesson.grade === 'Chorus' || startLesson.grade === 'All' ? b.grade : startLesson.grade }));
  }, []);

  const lesson: LessonPlan | undefined = lessons.find((l) => l.id === lessonChoice);
  const set = (u: Partial<DeckBrief>) => setBrief((b) => ({ ...b, ...u }));

  const makeOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep('working');
    const fullBrief = { ...brief, lessonId: lesson?.id };
    try {
      setProgress('Looking up facts on Wikipedia…');
      const found = await research(fullBrief, lesson).catch(() => [] as WikiFact[]);
      setFacts(found);
      setProgress('Planning your slides…');
      setPlan(await draftOutline(fullBrief, found, lesson));
      setStep('outline');
    } catch (err: any) {
      if (lesson) {
        // No AI available: build straight from the lesson instead.
        const now = new Date().toISOString();
        const base = deckFromLesson(lesson);
        setProgress('The AI is unavailable, so building slides straight from the lesson…');
        const slides = await fillPictures(base.slides, { ...fullBrief, pictureSource: brief.pictureSource === 'ai' ? 'photos' : brief.pictureSource }, setProgress);
        onCreated({ id: newDeckId(), ...base, slides, brief: fullBrief, lessonId: lesson.id, createdAt: now, updatedAt: now });
        return;
      }
      setError(err?.message || 'Could not plan the slides. Please try again.');
      setStep('brief');
    }
  };

  const build = async () => {
    if (!plan) return;
    setError('');
    setStep('working');
    const fullBrief = { ...brief, lessonId: lesson?.id };
    try {
      setProgress('Writing your slides…');
      const slides = await writeSlides(fullBrief, facts, plan.outline, lesson);
      await fillPictures(slides, fullBrief, setProgress);
      const now = new Date().toISOString();
      onCreated({
        id: newDeckId(),
        title: plan.title,
        theme: plan.theme,
        lessonId: lesson?.id,
        brief: fullBrief,
        sources: facts.map((f) => ({ title: f.title, url: f.url })),
        slides,
        createdAt: now,
        updatedAt: now
      });
    } catch (err: any) {
      setError(err?.message || 'Could not write the slides. Please try again.');
      setStep('outline');
    }
  };

  const setItem = (id: string, u: Partial<OutlineItem>) => plan && setPlan({ ...plan, outline: plan.outline.map((o) => (o.id === id ? { ...o, ...u } : o)) });
  const moveItem = (i: number, dir: -1 | 1) => {
    if (!plan || i + dir < 0 || i + dir >= plan.outline.length) return;
    const outline = [...plan.outline];
    [outline[i], outline[i + dir]] = [outline[i + dir], outline[i]];
    setPlan({ ...plan, outline });
  };

  const header = (title: string) => (
    <div className="flex items-center gap-2">
      <Sparkles className="w-5 h-5 text-brand-600" />
      <h1 className="text-lg font-bold text-stone-900 dark:text-white mr-auto">{title}</h1>
      {engine && <span className="text-[11px] text-stone-400">Writing with {engine === 'claude' ? 'Claude Sonnet 5.5' : 'the free AI (Gemma 4)'}</span>}
      <button type="button" onClick={onCancel} aria-label="Cancel" className="p-1.5 text-stone-400 hover:text-stone-700">
        <X className="w-5 h-5" />
      </button>
    </div>
  );
  const card = 'bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-5';

  if (step === 'working') {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <div className={`${card} text-center`}>
          {header('New slide deck')}
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-brand-600" />
          <p className="font-semibold text-stone-800 dark:text-stone-100">{progress}</p>
          <p className="text-xs text-stone-500">Keep this page open. Pictures take a few seconds each.</p>
        </div>
      </div>
    );
  }

  if (step === 'outline' && plan) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className={card}>
          {header('Check the plan')}
          <input value={plan.title} onChange={(e) => setPlan({ ...plan, title: e.target.value })} className={`${field} text-base font-bold`} aria-label="Deck title" />
          {facts.length > 0 && (
            <div className="text-xs text-stone-600 dark:text-stone-300 flex flex-wrap items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              Facts from:
              {facts.map((f) => (
                <span key={f.url} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{f.title}</a>
                  <button type="button" onClick={() => setFacts(facts.filter((x) => x !== f))} aria-label={`Don't use ${f.title}`} className="text-stone-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-stone-500">Edit, reorder or remove slides before they're written. "Photo" pictures come from Wikipedia and photo libraries; "Illustration" pictures are drawn by AI.</p>
          <ol className="space-y-2">
            {plan.outline.map((o, i) => (
              <li key={o.id} className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/70 dark:border-stone-700 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-400 w-5">{i + 1}</span>
                  <input value={o.title} onChange={(e) => setItem(o.id, { title: e.target.value })} className={`${field} font-semibold`} aria-label={`Slide ${i + 1} title`} />
                  <select value={o.layout} onChange={(e) => setItem(o.id, { layout: e.target.value as SlideLayout })} className={`${field} w-36`} aria-label="Layout">
                    {LAYOUT_OPTIONS.map((l) => (
                      <option key={l.id} value={l.id}>{l.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => moveItem(i, -1)} className={smallBtn} aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => moveItem(i, 1)} className={smallBtn} aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setPlan({ ...plan, outline: plan.outline.filter((x) => x.id !== o.id) })} className={`${smallBtn} hover:text-rose-600`} aria-label="Remove slide"><Trash2 className="w-4 h-4" /></button>
                </div>
                <input value={o.purpose} onChange={(e) => setItem(o.id, { purpose: e.target.value })} placeholder="What this slide does" className={`${field} text-xs`} aria-label="Purpose" />
                {PICTURE_LAYOUTS.includes(o.layout) && (
                  <div className="grid sm:grid-cols-[8rem_1fr_10rem] gap-2">
                    <select value={o.pictureKind} onChange={(e) => setItem(o.id, { pictureKind: e.target.value as PictureKind })} className={`${field} text-xs`} aria-label="Picture kind">
                      <option value="photo">Photo</option>
                      <option value="illustration">Illustration</option>
                      <option value="none">No picture</option>
                    </select>
                    {o.pictureKind !== 'none' && <input value={o.pictureIdea} onChange={(e) => setItem(o.id, { pictureIdea: e.target.value })} placeholder="Describe the picture" className={`${field} text-xs`} aria-label="Picture idea" />}
                    {o.pictureKind === 'photo' && <input value={o.subject || ''} onChange={(e) => setItem(o.id, { subject: e.target.value || undefined })} placeholder="Subject (e.g. Bassoon)" className={`${field} text-xs`} aria-label="Subject" />}
                  </div>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setPlan({ ...plan, outline: [...plan.outline, { id: newSlideId(), title: 'New slide', purpose: '', layout: 'bullets', pictureKind: 'none', pictureIdea: '' }] })}
            className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add a slide
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={build} disabled={!plan.outline.length} className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Write slides and add pictures
            </button>
            <button type="button" onClick={() => setStep('brief')} className="px-4 py-2.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-semibold">
              Back to the brief
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <form onSubmit={makeOutline} className={card}>
        {header('Describe your deck')}
        <label className="block space-y-1">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">What should the slides cover?</span>
          <textarea
            value={brief.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
            required
            placeholder={'e.g. Introduce the woodwind family to 3rd graders: what makes them woodwinds, the instruments in an orchestra, how each one sounds, and a listening game at the end. Real photos of each instrument.'}
            className={field}
          />
        </label>

        <div className="grid sm:grid-cols-3 gap-3">
          <label className="block space-y-1">
            <span className={label}>Grade</span>
            <select value={brief.grade || ''} onChange={(e) => set({ grade: e.target.value || undefined })} className={field}>
              <option value="">Any elementary</option>
              {['K', '1', '2', '3', '4', '5', '6'].map((g) => (
                <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className={label}>About how many slides</span>
            <input type="number" min={3} max={16} value={brief.slideCount} onChange={(e) => set({ slideCount: Math.min(16, Math.max(3, Number(e.target.value) || 8)) })} className={field} />
          </label>
          <label className="block space-y-1">
            <span className={label}>Tone</span>
            <select value={brief.tone} onChange={(e) => set({ tone: e.target.value })} className={field}>
              {TONES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block space-y-1">
          <span className={label}>Must include (optional)</span>
          <input value={brief.mustInclude || ''} onChange={(e) => set({ mustInclude: e.target.value })} placeholder="Facts, vocabulary or a question you want on the slides" className={field} />
        </label>

        {lessons.length > 0 && (
          <label className="block space-y-1">
            <span className={label}>Base it on a lesson (optional)</span>
            <select value={lessonChoice} onChange={(e) => setLessonChoice(e.target.value)} className={field}>
              <option value="">No, just my description</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>{l.title} (Grade {l.grade})</option>
              ))}
            </select>
          </label>
        )}

        {showSources ? (
          <label className="block space-y-1">
            <span className={label}>Your own source material (optional, trusted over everything else)</span>
            <textarea value={brief.sourceText || ''} onChange={(e) => set({ sourceText: e.target.value })} rows={4} placeholder="Paste notes, a program note, an article you've checked…" className={field} />
          </label>
        ) : (
          <button type="button" onClick={() => setShowSources(true)} className="text-xs font-semibold text-brand-600 hover:underline">
            + Add your own source material
          </button>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-stone-700 dark:text-stone-200">Pictures</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {([
              ['auto', 'Best of both (recommended)', 'Real photos for real things (Wikipedia first), AI drawings for ideas and scenes'],
              ['photos', 'Real photos only', 'Wikipedia and openly licensed photo libraries, credited'],
              ['ai', 'AI drawings only', 'Every picture drawn in your chosen style'],
              ['none', 'No pictures', 'Add your own later']
            ] as [DeckBrief['pictureSource'], string, string][]).map(([id, name, hint]) => (
              <label key={id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${brief.pictureSource === id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-stone-200 dark:border-stone-700'}`}>
                <input type="radio" name="pictures" checked={brief.pictureSource === id} onChange={() => set({ pictureSource: id })} className="mt-1" />
                <span>
                  <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">{name}</span>
                  <span className="block text-xs text-stone-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
          {(brief.pictureSource === 'auto' || brief.pictureSource === 'ai') && (
            <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              Drawing style
              <select value={brief.pictureStyle} onChange={(e) => set({ pictureStyle: e.target.value as DeckBrief['pictureStyle'] })} className="text-xs px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 border-0">
                {PICTURE_STYLES.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
        </fieldset>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!brief.description.trim()} className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Plan my slides
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date().toISOString();
              onCreated({ id: newDeckId(), title: 'New deck', theme: 'navy', slides: [{ ...blankSlide('title'), title: 'New deck' }], createdAt: now, updatedAt: now });
            }}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            or start with a blank deck
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------

/** Full-screen presenting: arrows, space or click to advance; N shows notes; Esc ends. */
const Presenter: React.FC<{ deck: SlideDeck; start: number; onClose: (at: number) => void }> = ({ deck, start, onClose }) => {
  const [i, setI] = useState(start);
  const [notes, setNotes] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const iRef = useRef(i);
  iRef.current = i;
  const last = deck.slides.length - 1;

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) setI((n) => Math.min(last, n + 1));
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) setI((n) => Math.max(0, n - 1));
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else return;
      e.preventDefault();
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) onClose(iRef.current);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, []);

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else onClose(i);
  };

  return (
    <div ref={root} className="fixed inset-0 z-[60] bg-black flex items-center justify-center" onClick={() => setI((n) => Math.min(last, n + 1))}>
      <div style={{ width: 'min(100vw, 177.78vh)' }}>
        <SlideCanvas key={deck.slides[i].id} slide={deck.slides[i]} theme={deck.theme} live />
      </div>
      {notes && deck.slides[i].notes && (
        <div className="absolute bottom-4 left-4 right-4 max-h-[30vh] overflow-y-auto rounded-2xl bg-black/80 text-white text-base p-4" onClick={(e) => e.stopPropagation()}>
          {deck.slides[i].notes}
        </div>
      )}
      <div className="absolute top-3 right-3 flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <span className="text-white text-sm tabular-nums">{i + 1} / {deck.slides.length}</span>
        <button type="button" onClick={() => setNotes((v) => !v)} className="px-2 py-1 rounded-lg bg-white/15 text-white text-xs">Notes (N)</button>
        <button type="button" onClick={close} aria-label="End presentation" className="p-1.5 rounded-lg bg-white/15 text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/** Renders every slide one per landscape page and opens the print dialog (Save as PDF works too). */
const PrintDeck: React.FC<{ deck: SlideDeck; onDone: () => void }> = ({ deck, onDone }) => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@page { size: landscape; margin: 0.35in; }';
    document.head.appendChild(style);
    document.body.classList.add('printing-slides');
    const finish = () => {
      document.body.classList.remove('printing-slides');
      style.remove();
      onDone();
    };
    window.addEventListener('afterprint', finish, { once: true });
    // Give pictures a moment to load before the print dialog snapshots the page.
    const timer = setTimeout(() => window.print(), 600);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
      document.body.classList.remove('printing-slides');
      style.remove();
    };
  }, []);

  return createPortal(
    <div className="slides-print-root">
      {deck.slides.map((s, i) => (
        <div key={s.id} className="print-slide">
          <SlideCanvas slide={s} theme={deck.theme} number={i + 1} />
        </div>
      ))}
    </div>,
    document.body
  );
};
