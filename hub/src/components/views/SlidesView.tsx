import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  ImagePlus,
  Loader2,
  MonitorPlay,
  Plus,
  Presentation,
  Printer,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { useRememberedState, REMEMBERED_PREFIX } from '../../hooks/useRememberedState';
import { blankSlide, draftDeck, ImageSource, newDeckId, newSlideId, THEMES } from '../../services/slideMaker';
import { SlideCanvas } from '../slides/SlideCanvas';
import { ImagePickerModal } from '../shared/ImagePickerModal';
import { LessonPlan, Slide, SlideDeck, SlideLayout } from '../../types';

const LAYOUT_OPTIONS: { id: SlideLayout; label: string }[] = [
  { id: 'title', label: 'Title' },
  { id: 'bullets', label: 'Bullets' },
  { id: 'image-right', label: 'Text + picture' },
  { id: 'image-full', label: 'Big picture' },
  { id: 'big-idea', label: 'Big idea' }
];
const SAVE_DELAY_MS = 600;

const field =
  'w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const smallBtn =
  'p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 dark:hover:bg-stone-800 dark:hover:text-white disabled:opacity-30';

/** Slide decks: make one from a lesson or topic with the free AI, edit it, present it, print it. */
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
      <NewDeckForm
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
              Click <strong>New deck</strong>, or <strong>Make Slides</strong> on any lesson. The free AI writes the slides and adds pictures.
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

  const print = () => {
    flush();
    setPrinting(true);
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
        <button type="button" onClick={print} className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5">
          <Printer className="w-4 h-4" />
          Print / PDF
        </button>
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

        {/* Current slide */}
        <div className="order-1 lg:order-2 space-y-2">
          <div className="rounded-2xl overflow-hidden shadow-xl">
            <SlideCanvas slide={slide} theme={deck.theme} />
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => insertSlide(blankSlide())} className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New slide
            </button>
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
            <span className="ml-auto text-xs text-stone-400">Slide {index + 1} of {deck.slides.length}</span>
          </div>
        </div>

        {/* Slide details */}
        <div className="order-3 bg-white dark:bg-stone-900 rounded-3xl p-4 border border-stone-200/80 dark:border-stone-800 space-y-3">
          <div className="flex flex-wrap gap-1">
            {LAYOUT_OPTIONS.map((l) => (
              <button key={l.id} type="button" onClick={() => setSlide({ layout: l.id })} aria-pressed={slide.layout === l.id} className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${slide.layout === l.id ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}>
                {l.label}
              </button>
            ))}
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Title</span>
            <input value={slide.title} onChange={(e) => setSlide({ title: e.target.value })} className={field} />
          </label>
          {(slide.layout === 'title' || slide.layout === 'image-full' || slide.layout === 'big-idea') && (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Subtitle</span>
              <input value={slide.subtitle || ''} onChange={(e) => setSlide({ subtitle: e.target.value })} className={field} />
            </label>
          )}
          {(slide.layout === 'bullets' || slide.layout === 'image-right') && (
            <label className="block space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Bullets (one per line)</span>
              <textarea
                value={slide.bullets.join('\n')}
                onChange={(e) => setSlide({ bullets: e.target.value.split('\n') })}
                onBlur={() => setSlide({ bullets: slide.bullets.map((b) => b.trim()).filter(Boolean) })}
                rows={4}
                className={field}
              />
            </label>
          )}
          {slide.layout !== 'bullets' && slide.layout !== 'big-idea' && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Picture</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPickingImage(true)} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5" />
                  {slide.image ? 'Change picture' : 'Add picture'}
                </button>
                {slide.image && (
                  <button type="button" onClick={() => setSlide({ image: undefined })} className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs font-semibold">
                    Remove
                  </button>
                )}
              </div>
              {slide.image?.credit && <p className="text-[11px] text-stone-400">{slide.image.credit}</p>}
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Speaker notes (only you see these)</span>
            <textarea value={slide.notes || ''} onChange={(e) => setSlide({ notes: e.target.value })} rows={4} className={field} />
          </label>
        </div>
      </div>

      {pickingImage && (
        <ImagePickerModal
          title="Picture for this slide"
          initialPrompt={slide.imageIdea || slide.title}
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

const NewDeckForm: React.FC<{ lessonId?: string; onCancel: () => void; onCreated: (deck: SlideDeck) => void }> = ({ lessonId, onCancel, onCreated }) => {
  const lessons = storage.getLessonPlans();
  const [source, setSource] = useState<'lesson' | 'topic'>(lessonId || lessons.length ? 'lesson' : 'topic');
  const [chosenLesson, setChosenLesson] = useState(lessonId || lessons[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [grade, setGrade] = useState('');
  const [images, setImages] = useRememberedState<ImageSource>('slides.imageSource', 'ai');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  const lesson: LessonPlan | undefined = lessons.find((l) => l.id === chosenLesson);
  const busy = !!progress;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setProgress('Starting…');
    try {
      const deck = await draftDeck({
        lesson: source === 'lesson' ? lesson : undefined,
        topic: source === 'topic' ? topic : undefined,
        grade,
        imageSource: images,
        onProgress: setProgress
      });
      onCreated(deck);
    } catch (err: any) {
      setError(err?.message || 'Could not make the slides. Please try again.');
      setProgress('');
    }
  };

  const startBlank = () => {
    const now = new Date().toISOString();
    onCreated({ id: newDeckId(), title: 'New deck', theme: 'navy', slides: [{ ...blankSlide('title'), title: 'New deck' }], createdAt: now, updatedAt: now });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
      <form onSubmit={create} className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <h1 className="text-lg font-bold text-stone-900 dark:text-white mr-auto">New slide deck</h1>
          <button type="button" onClick={onCancel} aria-label="Cancel" className="p-1.5 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-xs font-semibold w-fit">
          {(['lesson', 'topic'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setSource(s)} disabled={s === 'lesson' && !lessons.length} className={`px-3 py-1.5 rounded-lg disabled:opacity-40 ${source === s ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500'}`}>
              {s === 'lesson' ? 'From a lesson' : 'From a topic'}
            </button>
          ))}
        </div>

        {source === 'lesson' ? (
          <select value={chosenLesson} onChange={(e) => setChosenLesson(e.target.value)} className={field} aria-label="Lesson">
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title} (Grade {l.grade})</option>
            ))}
          </select>
        ) : (
          <div className="grid sm:grid-cols-[1fr_8rem] gap-2">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Instrument families of the orchestra" className={field} aria-label="Topic" required />
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className={field} aria-label="Grade">
              <option value="">Any grade</option>
              {['K', '1', '2', '3', '4', '5', '6'].map((g) => (
                <option key={g} value={g}>{g === 'K' ? 'Kindergarten' : `Grade ${g}`}</option>
              ))}
            </select>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-stone-600 dark:text-stone-300">Pictures</legend>
          {([
            ['ai', 'AI illustrations', 'Drawn for each slide (up to 6 per deck, from the free daily allowance)'],
            ['photos', 'Free photo library', 'Openly licensed photos from Openverse, credited on the slide'],
            ['none', 'No pictures', 'Add your own later']
          ] as [ImageSource, string, string][]).map(([id, label, hint]) => (
            <label key={id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${images === id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-900/20' : 'border-stone-200 dark:border-stone-700'}`}>
              <input type="radio" name="images" checked={images === id} onChange={() => setImages(id)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100">{label}</span>
                <span className="block text-xs text-stone-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || (source === 'lesson' ? !lesson : !topic.trim())} className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? progress : 'Make my slides'}
          </button>
          {!busy && (
            <button type="button" onClick={startBlank} className="text-xs font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
              or start with a blank deck
            </button>
          )}
        </div>
        {busy && <p className="text-xs text-stone-500">This takes about a minute with pictures. Keep this page open.</p>}
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
  const last = deck.slides.length - 1;

  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) setI((n) => Math.min(last, n + 1));
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) setI((n) => Math.max(0, n - 1));
      else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(last);
      else if (e.key.toLowerCase() === 'n') setNotes((v) => !v);
      else if (e.key === 'Escape') return; // leaving full screen closes (below)
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
  const iRef = useRef(i);
  iRef.current = i;

  const close = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else onClose(i);
  };

  return (
    <div ref={root} className="fixed inset-0 z-[60] bg-black flex items-center justify-center" onClick={() => setI((n) => Math.min(last, n + 1))}>
      <div style={{ width: 'min(100vw, 177.78vh)' }}>
        <SlideCanvas slide={deck.slides[i]} theme={deck.theme} />
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
