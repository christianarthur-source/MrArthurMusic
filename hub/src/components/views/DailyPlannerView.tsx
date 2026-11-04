import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRememberedState } from '../../hooks/useRememberedState';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  Pin,
  Lightbulb,
  ImagePlus,
  Link2,
  X,
  ExternalLink,
  Trash2,
  NotebookPen,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Search
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { classesOn, formatTime } from '../../services/rotation';
import { compressImage, faviconFor, linkTitle, plainText, safeLinkUrl } from '../../services/plannerContent';
import { RichEditor } from '../planner/RichEditor';
import { ImagePickerModal } from '../shared/ImagePickerModal';
import { CarryOverBanner, ClassesPanel, ReflectionCard, TasksPanel } from '../planner/DayPanels';
import { planMyDay, summarizeWeek } from '../../services/plannerTools';
import { CalendarEvent, PlannerAttachment, PlannerPage, PlannerPaper, PlannerSettings } from '../../types';

// ---------------------------------------------------------------------------
// Dates (pages are keyed by local calendar date, YYYY-MM-DD)

const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (s: string, n: number) => {
  const d = fromYMD(s);
  d.setDate(d.getDate() + n);
  return toYMD(d);
};
const addMonths = (s: string, n: number) => {
  const d = fromYMD(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toYMD(d);
};
/** Weeks start on Monday, like a school planner. */
const weekStart = (s: string) => {
  const d = fromYMD(s);
  return addDays(s, -((d.getDay() + 6) % 7));
};
const dayOfYear = (s: string) => {
  const d = fromYMD(s);
  return Math.round((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000) + 1;
};
/** ISO 8601 week number: weeks start Monday, week 1 holds the year's first Thursday. */
const isoWeek = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7)); // Thursday of this week
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  return 1 + Math.floor((date.getTime() - yearStart) / 86400000 / 7);
};
const fmt = (s: string, opts: Intl.DateTimeFormatOptions) => fromYMD(s).toLocaleDateString(undefined, opts);

// ---------------------------------------------------------------------------
// A tip for each day, in the spirit of a paper planner's margin notes

const TIPS = [
  'Write tomorrow’s first task before you leave school today, and the morning starts itself.',
  'Pick the three things that would make today a good day. Everything else is a bonus.',
  'Batch the small stuff: emails, copies and sign-ups go in one block, not scattered all day.',
  'A two-minute task done now beats a reminder you have to read five more times.',
  'Plan your hardest thinking for the time of day you have the most energy.',
  'Leave a little white space in the day. Something always comes up between classes.',
  'Before a concert week, list everything that needs a person’s name next to it.',
  'Celebrate one small win from today, even if it was just a great steady beat.',
  'When a list gets long, circle the one item that unlocks the others.',
  'Rehearsal notes are most useful written within an hour of the rehearsal.',
  'A tidy cart at the end of the day is a gift to tomorrow-you.',
  'Say the goal out loud to your class: it helps them, and it keeps you on track.',
  'If something keeps moving to tomorrow, break it into a smaller first step.',
  'Check the week ahead on Friday. Mondays go better when nothing surprises you.',
  'Keep one running list for “someday” ideas so they stop cluttering today.',
  'Five minutes of reflection after the last class makes next year’s planning easy.',
  'Group errands by place: office, copy room, auditorium, music closet.',
  'Write down what worked, not just what didn’t. Future lessons need both.',
  'A short walk between blocks is planning time too.',
  'Protect one planning period a week for the work that never feels urgent.',
  'Set out tomorrow’s first-period materials before you go home.',
  'Note which songs the class asked to sing again. That’s your engagement data.',
  'Done is better than perfect for most forms and emails.',
  'Look back at this day last month: progress is easier to see from a distance.'
];
const tipFor = (date: string) => TIPS[(dayOfYear(date) + fromYMD(date).getFullYear()) % TIPS.length];

// ---------------------------------------------------------------------------

const PAPERS: { id: PlannerPaper; label: string }[] = [
  { id: 'lined', label: 'Lined' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'grid', label: 'Grid' },
  { id: 'plain', label: 'Plain' }
];

const MAX_IMAGES_PER_PAGE = 12;
const emptyPage = (date: string): PlannerPage => ({ date, html: '', attachments: [], updatedAt: '' });
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const eventsOn = (events: CalendarEvent[], date: string) =>
  events
    .filter((e) => {
      const start = e.startDate.slice(0, 10);
      const end = (e.endDate || e.startDate).slice(0, 10);
      return start === date || (e.allDay && start <= date && date < end);
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

const eventTime = (e: CalendarEvent) => {
  if (e.allDay || e.startDate.length <= 10) return 'All day';
  const d = new Date(e.startDate);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

export const DailyPlannerView: React.FC = () => {
  const { showToast } = useApp();
  const today = toYMD(new Date());
  const [date, setDate] = useRememberedState('dailyPlanner.date', today);
  const [turn, setTurn] = useState<'next' | 'prev' | ''>('');
  const [settings, setSettings] = useState<PlannerSettings>(storage.getPlannerSettings());
  const [, setVersion] = useState(0);
  const [viewer, setViewer] = useState<PlannerAttachment | null>(null);
  const [linkFormFor, setLinkFormFor] = useState<string | null>(null);
  const [findImageFor, setFindImageFor] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkName, setLinkName] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const imageTargetDate = useRef(date);

  // Re-read pages when anything is saved or synced from another device.
  useEffect(
    () =>
      storage.subscribe(() => {
        setSettings(storage.getPlannerSettings());
        setVersion((v) => v + 1);
      }),
    []
  );

  const view = settings.view;
  const paperClass = settings.paper === 'plain' ? '' : `planner-paper-${settings.paper}`;
  const events = storage.getEvents();
  const rotation = storage.getRotation();

  const updateSettings = (updates: Partial<PlannerSettings>) => {
    storage.updatePlannerSettings(updates);
    setSettings(storage.getPlannerSettings());
  };

  const go = (to: string) => {
    if (to === date) return;
    setTurn(to > date ? 'next' : 'prev');
    setDate(to);
  };

  const step = (dir: 1 | -1) => {
    if (view === 'day') go(addDays(date, dir));
    else if (view === 'week') go(addDays(date, 7 * dir));
    else go(addMonths(date, dir));
  };

  // Arrow keys turn pages when you're not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- page edits ----

  const pageFor = (d: string) => storage.getPlannerPage(d) || emptyPage(d);

  const saveHtml = (d: string, html: string) => storage.savePlannerPage({ ...pageFor(d), html });

  const addAttachments = (d: string, items: PlannerAttachment[]) => {
    const page = pageFor(d);
    storage.savePlannerPage({ ...page, attachments: [...page.attachments, ...items] });
  };

  const removeAttachment = (d: string, id: string) => {
    const page = pageFor(d);
    storage.savePlannerPage({ ...page, attachments: page.attachments.filter((a) => a.id !== id) });
  };

  const addImages = async (d: string, files: File[]) => {
    const existing = pageFor(d).attachments.filter((a) => a.kind === 'image').length;
    const room = MAX_IMAGES_PER_PAGE - existing;
    if (room <= 0) {
      showToast(`A page holds up to ${MAX_IMAGES_PER_PAGE} images`, 'warning');
      return;
    }
    const added: PlannerAttachment[] = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push({
          id: newId('img'),
          kind: 'image',
          url: await compressImage(file),
          title: file.name.replace(/\.[^.]+$/, ''),
          addedAt: new Date().toISOString()
        });
      } catch (err: any) {
        showToast(err?.message || 'Could not add that image', 'error');
      }
    }
    if (added.length) {
      addAttachments(d, added);
      showToast(`Added ${added.length} image${added.length > 1 ? 's' : ''} to ${fmt(d, { month: 'short', day: 'numeric' })}`, 'success');
    }
    if (files.length > room) showToast(`Only ${room} more image${room > 1 ? 's' : ''} fit on this page`, 'warning');
  };

  const pickImages = (d: string) => {
    imageTargetDate.current = d;
    fileInput.current?.click();
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkFormFor) return;
    const url = safeLinkUrl(linkUrl);
    if (!url) {
      showToast('That does not look like a web address', 'error');
      return;
    }
    addAttachments(linkFormFor, [
      { id: newId('link'), kind: 'link', url, title: linkName.trim() || linkTitle(url), addedAt: new Date().toISOString() }
    ]);
    setLinkFormFor(null);
    setLinkUrl('');
    setLinkName('');
  };

  // ---- AI ----

  const [aiBusy, setAiBusy] = useState<'' | 'plan' | 'week'>('');
  const [weekSummary, setWeekSummary] = useState<string | null>(null);

  const planDay = async () => {
    setAiBusy('plan');
    try {
      const plan = await planMyDay(date);
      saveHtml(date, plan + pageFor(date).html);
      showToast('Added a plan to the top of your page', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not plan your day', 'error');
    } finally {
      setAiBusy('');
    }
  };

  const summarizeThisWeek = async () => {
    setAiBusy('week');
    try {
      setWeekSummary(await summarizeWeek(weekStart(date)));
    } catch (err: any) {
      showToast(err?.message || 'Could not summarize the week', 'error');
    } finally {
      setAiBusy('');
    }
  };

  // ---- header ----

  const weekFrom = weekStart(date);
  const title =
    view === 'day'
      ? fmt(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : view === 'week'
        ? `${fmt(weekFrom, { month: 'short', day: 'numeric' })} – ${fmt(addDays(weekFrom, 6), { month: 'short', day: 'numeric', year: 'numeric' })}`
        : fmt(date, { month: 'long', year: 'numeric' });

  const viewButtons: { id: PlannerSettings['view']; label: string; icon: React.ElementType }[] = [
    { id: 'day', label: 'Day', icon: CalendarDays },
    { id: 'week', label: 'Week', icon: CalendarRange },
    { id: 'month', label: 'Month', icon: LayoutGrid }
  ];

  const turnClass = turn ? `planner-turn-${turn}` : '';
  // Changes with every page turn, so the page (and the flipping sheet) re-animate
  const pageKey = `${view}-${view === 'month' ? date.slice(0, 7) : view === 'week' ? weekFrom : date}`;
  const sideZone =
    'no-print hidden md:flex w-10 xl:w-16 shrink-0 items-center justify-center rounded-2xl text-stone-300 hover:text-stone-600 hover:bg-stone-200/50 dark:text-stone-600 dark:hover:text-stone-300 dark:hover:bg-white/5 transition-colors';

  // ---- pieces ----

  // Plain render functions (not components), so editors inside keep focus across re-renders.
  const renderAttachments = (d: string, page: PlannerPage) => {
    const images = page.attachments.filter((a) => a.kind === 'image');
    const links = page.attachments.filter((a) => a.kind === 'link');
    return (
      <div className="space-y-3">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => pickImages(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-stone-900/5 hover:bg-stone-900/10"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            Add image
          </button>
          <button
            type="button"
            onClick={() => setFindImageFor(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-stone-900/5 hover:bg-stone-900/10"
          >
            <Search className="w-3.5 h-3.5" />
            Find image
          </button>
          <button
            type="button"
            onClick={() => setLinkFormFor(linkFormFor === d ? null : d)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-stone-900/5 hover:bg-stone-900/10"
          >
            <Link2 className="w-3.5 h-3.5" />
            Add link
          </button>
          <span className="text-[11px] text-stone-400">You can also paste or drop images onto the page.</span>
        </div>

        {linkFormFor === d && (
          <form onSubmit={submitLink} className="no-print flex flex-wrap gap-2">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              aria-label="Link address"
              className="flex-1 min-w-[12rem] text-xs px-3 py-2 rounded-lg bg-white/80 border border-stone-300"
            />
            <input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="Name (optional)"
              aria-label="Link name"
              className="w-40 text-xs px-3 py-2 rounded-lg bg-white/80 border border-stone-300"
            />
            <button type="submit" className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold">
              Add
            </button>
          </form>
        )}

        {links.length > 0 && (
          <div className="space-y-1.5">
            {links.map((l) => (
              <div key={l.id} className="group flex items-center gap-2 rounded-lg bg-white/70 border border-stone-200 px-2.5 py-1.5">
                <img src={faviconFor(l.url)} alt="" className="w-4 h-4 rounded-sm" loading="lazy" />
                <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 text-sm truncate hover:underline">
                  {l.title || linkTitle(l.url)}
                </a>
                <ExternalLink className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => removeAttachment(d, l.id)}
                  aria-label="Remove link"
                  className="no-print p-1 rounded text-stone-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
            {images.map((img, i) => (
              <figure
                key={img.id}
                className="group relative bg-white p-1.5 pb-5 shadow-md"
                style={{ transform: `rotate(${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg)` }}
              >
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 bg-amber-200/70 rotate-[-3deg]" aria-hidden />
                <button type="button" onClick={() => setViewer(img)} className="block w-full" aria-label={`Open ${img.title || 'image'}`}>
                  <img src={img.url} alt={img.title || ''} className="w-full aspect-square object-cover" loading="lazy" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAttachment(d, img.id)}
                  aria-label="Remove image"
                  className="no-print absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEvents = (d: string) => {
    const list = eventsOn(events, d);
    const { day: cycleDay, classes } = classesOn(d, rotation);
    if (!list.length && !cycleDay) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {cycleDay && (
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-600 text-white"
            title={classes.map((c) => `${formatTime(c.start)} ${c.name}`).join('\n') || undefined}
          >
            Day {cycleDay}
            {classes.length > 0 && <span className="font-medium opacity-80">· {classes.length} class{classes.length === 1 ? '' : 'es'}</span>}
          </span>
        )}
        {list.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/80 border border-stone-200"
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || '#0c87eb' }} />
            <span className="text-stone-500">{eventTime(e)}</span>
            <span>{e.title}</span>
          </span>
        ))}
      </div>
    );
  };

  // ---- views ----

  const renderDay = () => {
    const page = pageFor(date);
    return (
      <div className="grid gap-0 lg:grid-cols-2">
        {/* Left page: the day */}
        <section className={`planner-page ${paperClass} rounded-xl lg:rounded-r-none p-5 sm:p-8 space-y-5 min-h-[44rem] lg:border-r lg:border-stone-300/70`}>
          <header className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">{fmt(date, { weekday: 'long' })}</div>
              <div className="font-serif text-[2rem] sm:text-5xl leading-none whitespace-nowrap">{fmt(date, { month: 'long', day: 'numeric' })}</div>
            </div>
            <div className="text-right text-[11px] text-stone-500 leading-tight">
              <div className="font-serif text-lg text-stone-700">{fromYMD(date).getFullYear()}</div>
              <div className="whitespace-nowrap">Day {dayOfYear(date)}</div>
              <div className="whitespace-nowrap">Week {isoWeek(date)}</div>
              {date === today && <div className="font-semibold text-brand-600">Today</div>}
            </div>
          </header>

          <div className="flex gap-2.5 rounded-lg bg-amber-100/60 px-3 py-2 text-sm italic font-serif text-stone-700">
            <Lightbulb className="w-4 h-4 shrink-0 mt-1 text-amber-600 not-italic" />
            <span>{tipFor(date)}</span>
          </div>

          {renderEvents(date)}

          {date === today && <CarryOverBanner date={date} onDone={(m) => m && showToast(m, 'success')} />}

          {date >= today && (
            <button
              type="button"
              onClick={planDay}
              disabled={!!aiBusy}
              className="no-print px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 disabled:opacity-60"
            >
              {aiBusy === 'plan' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiBusy === 'plan' ? 'Planning your day…' : 'Plan my day with AI'}
            </button>
          )}

          <RichEditor
            key={date}
            value={page.html}
            onChange={(html) => saveHtml(date, html)}
            onImageFiles={(files) => addImages(date, files)}
            onMakeTask={(text) => {
              storage.addTask({ title: text.slice(0, 200), dueDate: date, listType: date === today ? 'today' : 'upcoming' });
              showToast(`Added to Tasks: ${text.slice(0, 60)}`, 'success');
            }}
            placeholder="What’s on today’s page?"
            minHeightClass="min-h-[21rem]"
          />

          {renderAttachments(date, page)}

          {date <= today && <ReflectionCard key={date} date={date} onSaved={(m) => showToast(m, 'success')} />}
        </section>

        {/* Right page: classes, tasks and permanent notes */}
        <section className={`planner-page ${paperClass} rounded-xl lg:rounded-l-none p-5 sm:p-8 space-y-6 min-h-[44rem] mt-4 lg:mt-0`}>
          <ClassesPanel date={date} />
          <TasksPanel date={date} today={today} />
          {settings.showPermanent && (
            <section className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5 text-rose-500" />
                Permanent notes
              </h3>
              <RichEditor
                value={storage.getPlannerPermanent().html}
                onChange={(html) => storage.savePlannerPermanent(html)}
                placeholder="Notes you want on every page: goals, routines, phone numbers…"
                minHeightClass="min-h-[10rem]"
              />
            </section>
          )}
        </section>
      </div>
    );
  };

  const renderWeek = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekFrom, i));
    const renderDayBlock = (d: string, tall = false) => {
      const page = pageFor(d);
      const images = page.attachments.filter((a) => a.kind === 'image').length;
      const links = page.attachments.filter((a) => a.kind === 'link').length;
      return (
        <div key={d} className={`flex flex-col border-b border-stone-300/70 last:border-b-0 py-3 ${tall ? 'min-h-[15rem]' : 'min-h-[11rem]'}`}>
          <div className="flex items-baseline justify-between mb-1">
            <button type="button" onClick={() => { updateSettings({ view: 'day' }); go(d); }} className="flex items-baseline gap-2 hover:text-brand-600" title="Open this day">
              <span className={`font-serif text-2xl leading-none ${d === today ? 'text-brand-600' : ''}`}>{fromYMD(d).getDate()}</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">{fmt(d, { weekday: 'long' })}</span>
            </button>
            <span className="flex items-center gap-2 text-[11px] text-stone-400">
              {images > 0 && (<span className="flex items-center gap-0.5"><ImageIcon className="w-3 h-3" />{images}</span>)}
              {links > 0 && (<span className="flex items-center gap-0.5"><Link2 className="w-3 h-3" />{links}</span>)}
            </span>
          </div>
          {renderEvents(d)}
          <div className="flex-1">
            <RichEditor
              key={d}
              compact
              value={page.html}
              onChange={(html) => saveHtml(d, html)}
              onImageFiles={(files) => addImages(d, files)}
              placeholder=""
              minHeightClass="min-h-[5.25rem]"
            />
          </div>
        </div>
      );
    };
    return (
      <div className="grid lg:grid-cols-2">
        <section className={`planner-page ${paperClass} rounded-xl lg:rounded-r-none px-5 sm:px-8 py-3 lg:border-r lg:border-stone-300/70`}>
          {days.slice(0, 3).map((d) => renderDayBlock(d, true))}
        </section>
        <section className={`planner-page ${paperClass} rounded-xl lg:rounded-l-none px-5 sm:px-8 py-3 mt-4 lg:mt-0`}>
          {days.slice(3).map((d) => renderDayBlock(d))}
        </section>
      </div>
    );
  };

  const renderMonth = () => {
    const first = date.slice(0, 8) + '01';
    const gridStart = weekStart(first);
    const pages = storage.getPlannerMonth(date.slice(0, 7));
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const visible = cells[35].slice(0, 7) === date.slice(0, 7) ? cells : cells.slice(0, 35);
    const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(gridStart, i), { weekday: 'short' }));
    return (
      <section className="planner-page rounded-xl p-3 sm:p-6">
        <div className="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-stone-500 pb-2">
          {weekdays.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 border-t border-l border-stone-300/70">
          {visible.map((d) => {
            const inMonth = d.slice(0, 7) === date.slice(0, 7);
            const page = inMonth ? pages[d] : storage.getPlannerPage(d);
            const preview = page ? plainText(page.html) : '';
            const thumb = page?.attachments.find((a) => a.kind === 'image');
            const dayEvents = eventsOn(events, d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => { updateSettings({ view: 'day' }); go(d); }}
                className={`relative text-left border-r border-b border-stone-300/70 p-1.5 sm:p-2 min-h-[5rem] sm:min-h-[7rem] hover:bg-amber-100/40 transition-colors ${inMonth ? '' : 'opacity-40'}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-serif text-base sm:text-lg leading-none ${d === today ? 'w-7 h-7 -m-1 rounded-full bg-brand-600 text-white flex items-center justify-center' : ''}`}>
                    {fromYMD(d).getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="flex gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || '#0c87eb' }} />
                      ))}
                    </span>
                  )}
                </div>
                {preview && <p className="mt-1 text-[11px] leading-snug text-stone-600 line-clamp-3 hidden sm:block">{preview}</p>}
                {preview && <span className="sm:hidden block mt-1 w-1.5 h-1.5 rounded-full bg-stone-500" />}
                {thumb && <img src={thumb.url} alt="" className="hidden sm:block absolute bottom-1.5 right-1.5 w-8 h-8 object-cover rounded shadow" loading="lazy" />}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = '';
          if (files.length) addImages(imageTargetDate.current, files);
        }}
      />

      {/* Toolbar */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-auto">
          <NotebookPen className="w-5 h-5 text-brand-600" />
          <h1 className="text-xl font-bold text-stone-900 dark:text-white">Daily Planner</h1>
        </div>

        <div className="flex rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-xs font-semibold" role="tablist" aria-label="Planner view">
          {viewButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => updateSettings({ view: id })}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${view === id ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <select
          value={settings.paper}
          onChange={(e) => updateSettings({ paper: e.target.value as PlannerPaper })}
          aria-label="Paper style"
          className="text-xs font-semibold px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 border-0 text-stone-700 dark:text-stone-200"
        >
          {PAPERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label} paper</option>
          ))}
        </select>

        {view === 'week' && (
          <button
            type="button"
            onClick={summarizeThisWeek}
            disabled={!!aiBusy}
            className="text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 bg-violet-100 hover:bg-violet-200 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 disabled:opacity-60"
          >
            {aiBusy === 'week' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiBusy === 'week' ? 'Summarizing…' : 'Summarize this week'}
          </button>
        )}

        {view === 'day' && (
          <button
            type="button"
            onClick={() => updateSettings({ showPermanent: !settings.showPermanent })}
            aria-pressed={settings.showPermanent}
            className={`text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 ${settings.showPermanent ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'}`}
          >
            <Pin className="w-3.5 h-3.5" />
            Permanent notes
          </button>
        )}
      </div>

      {/* Date bar */}
      <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`} className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => step(1)} aria-label={`Next ${view}`} className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h2 className="font-serif text-xl sm:text-2xl text-stone-900 dark:text-white mx-1">{title}</h2>
        <div className="ml-auto flex items-center gap-2">
          {date !== today && (
            <button type="button" onClick={() => go(today)} className="text-xs font-semibold px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white">
              Today
            </button>
          )}
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && go(e.target.value)}
            aria-label="Go to date"
            className="text-xs px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 border-0 text-stone-700 dark:text-stone-200"
          />
        </div>
      </div>

      <div className="flex items-stretch gap-1 sm:gap-2">
        {/* Click the space beside the notebook to turn the page */}
        <button type="button" onClick={() => step(-1)} aria-label={`Previous ${view}`} title={`Previous ${view}`} className={sideZone}>
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Notebook: always light paper in a charcoal frame, whatever the app theme */}
        <div className="planner-notebook flex-1 min-w-0 rounded-[1.75rem] bg-stone-800 p-2 sm:p-3 shadow-xl shadow-stone-900/20" style={{ perspective: '2400px' }}>
          <div className="relative">
            <div key={pageKey} className={`relative ${turnClass}`}>
              {view === 'day' && renderDay()}
              {view === 'week' && renderWeek()}
              {view === 'month' && renderMonth()}
              {view !== 'month' && (
                <div className="hidden lg:block pointer-events-none absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" aria-hidden />
              )}
            </div>
            {/* The sheet that flips over (kept outside the fading page so it starts fully opaque) */}
            {turn && (
              <div key={`flip-${pageKey}`} aria-hidden className={`planner-flip planner-flip-${turn} ${view === 'month' ? 'planner-flip-single' : ''}`}>
                <div className={`planner-page ${paperClass} absolute inset-0 rounded-xl`} />
              </div>
            )}
          </div>
        </div>

        <button type="button" onClick={() => step(1)} aria-label={`Next ${view}`} title={`Next ${view}`} className={sideZone}>
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      <p className="no-print text-xs text-stone-400 text-center">
        Click beside the notebook or use ← and → to turn pages. ⌘/Ctrl-click a link in your notes to open it.
      </p>

      {weekSummary !== null && (
        <div role="dialog" aria-modal="true" aria-label="Week summary" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setWeekSummary(null)}>
          <div className="w-full max-w-xl bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              Week of {fmt(weekFrom, { month: 'long', day: 'numeric' })}
            </h2>
            <textarea value={weekSummary} onChange={(e) => setWeekSummary(e.target.value)} rows={10} aria-label="Week summary" className="w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  storage.addJournalEntry({
                    date: today,
                    title: `Week of ${fmt(weekFrom, { month: 'short', day: 'numeric' })}`,
                    content: weekSummary,
                    tags: ['weekly-summary'],
                    mood: 'good',
                    energyLevel: 3,
                    templateType: 'daily_reflection'
                  });
                  setWeekSummary(null);
                  showToast('Week summary saved to your Daily Journal', 'success');
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
              >
                Save to journal
              </button>
              <button type="button" onClick={() => setWeekSummary(null)} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-sm font-semibold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {findImageFor && (
        <ImagePickerModal
          title="Find a picture for this page"
          wide={false}
          onClose={() => setFindImageFor(null)}
          onPick={(img) => {
            const d = findImageFor;
            setFindImageFor(null);
            if (pageFor(d).attachments.filter((a) => a.kind === 'image').length >= MAX_IMAGES_PER_PAGE) {
              showToast(`A page holds up to ${MAX_IMAGES_PER_PAGE} images`, 'warning');
              return;
            }
            addAttachments(d, [{ id: newId('img'), kind: 'image', url: img.src, title: img.alt || img.credit, addedAt: new Date().toISOString() }]);
            showToast('Picture added to the page', 'success');
          }}
        />
      )}

      {viewer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewer.title || 'Image'}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <img src={viewer.url} alt={viewer.title || ''} className="max-w-full max-h-full rounded shadow-2xl" />
          <button type="button" onClick={() => setViewer(null)} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/25">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
