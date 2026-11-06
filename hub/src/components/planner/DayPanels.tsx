import React, { useEffect, useState } from 'react';
import { ArrowRight, BookMarked, CheckSquare, Plus, Presentation, Undo2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { classesOn, formatTime } from '../../services/rotation';
import { carryOver, dismissCarry, unfinishedBefore } from '../../services/plannerTools';
import { JournalEntry, RotationClass } from '../../types';

/**
 * The working parts of a Daily Planner day: today's classes (pinned lesson, Teach, "where we
 * left off"), tasks, unfinished items from earlier days, and an end-of-day reflection.
 * These sit on the always-light planner paper, so they use light colors only.
 */

const shortDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const sectionTitle = 'text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500 flex items-center gap-1.5';
const paperInput = 'w-full text-sm px-2.5 py-1.5 rounded-lg bg-white/80 border border-stone-300/80 focus:outline-none focus:ring-2 focus:ring-brand-500';

// ---------------------------------------------------------------------------

const ClassRow: React.FC<{ c: RotationClass; date: string }> = ({ c, date }) => {
  const log = storage.getClassLog(c.id);
  const todayEntry = log.find((e) => e.date === date);
  const earlier = log.filter((e) => e.date < date);
  const lastNote = [...earlier].reverse().find((e) => e.note);
  const [notes, setNotes] = useState(todayEntry?.notes || '');
  const [note, setNote] = useState(todayEntry?.note || '');

  useEffect(() => {
    const entry = storage.getClassLog(c.id).find((e) => e.date === date);
    setNotes(entry?.notes || '');
    setNote(entry?.note || '');
  }, [c.id, date]);

  return (
    <li className="py-3 border-b border-stone-300/60 last:border-b-0 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-mono font-medium text-stone-500">{formatTime(c.start)}</span>
        <span className="font-bold text-sm text-stone-800 truncate flex-1">{c.name || 'Class'}</span>
        {c.grade && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-200/70 text-stone-600">
            Gr {c.grade}
          </span>
        )}
      </div>
      <div className="pl-0 sm:pl-[4.5rem] space-y-2">
        {/* Expandable freeform class notes area */}
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            e.currentTarget.style.height = 'auto';
            e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
          }}
          onBlur={(e) => storage.saveClassLogEntry(c.id, date, { notes: e.currentTarget.value.trim() || undefined })}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = `${Math.max(el.scrollHeight, 44)}px`;
            }
          }}
          placeholder="Class notes, lesson plan, activities…"
          aria-label={`Notes for ${c.name}`}
          rows={1}
          className={`${paperInput} text-xs leading-relaxed resize-none overflow-hidden transition-[height]`}
        />

        {lastNote && (
          <p className="text-[11px] text-stone-500 italic">
            Last time ({shortDate(lastNote.date)}): {lastNote.note}
          </p>
        )}

        {/* Where we left off today field */}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={(e) => storage.saveClassLogEntry(c.id, date, { note: e.currentTarget.value.trim() || undefined })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Where we left off today…"
          aria-label={`Where ${c.name} left off`}
          className={`${paperInput} text-xs`}
        />
      </div>
    </li>
  );
};

export const ClassesPanel: React.FC<{ date: string }> = ({ date }) => {
  const { setActiveView } = useApp();
  const rotation = storage.getRotation();
  const { day, classes } = classesOn(date, rotation);
  return (
    <section className="space-y-1">
      <h3 className={sectionTitle}>
        <Presentation className="w-3.5 h-3.5" />
        Today's classes {day && <span className="ml-1 px-1.5 py-0.5 rounded bg-brand-600 text-white tracking-normal">Day {day}</span>}
      </h3>
      {!rotation ? (
        <button type="button" onClick={() => setActiveView('rotation')} className="text-sm text-brand-600 hover:underline">
          Set up your class rotation to see your classes here →
        </button>
      ) : classes.length === 0 ? (
        <p className="text-sm text-stone-500">{day ? `No classes on Day ${day}.` : 'No school today.'}</p>
      ) : (
        <ul>
          {classes.map((c) => (
            <ClassRow key={`${c.id}-${date}`} c={c} date={date} />
          ))}
        </ul>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------

export const TasksPanel: React.FC<{ date: string; today: string }> = ({ date, today }) => {
  const { setActiveView } = useApp();
  const [title, setTitle] = useState('');
  // Tasks ticked off here stay visible (crossed out) until you leave the page
  const [justDone, setJustDone] = useState<string[]>([]);
  useEffect(() => setJustDone([]), [date]);

  const tasks = storage
    .getTasks()
    .filter(
      (t) =>
        justDone.includes(t.id) ||
        (!t.completed && (t.dueDate === date || (date === today && (t.listType === 'today' || (!!t.dueDate && t.dueDate < today)))))
    )
    .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate || '').localeCompare(b.dueDate || ''));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    storage.addTask({ title: title.trim(), dueDate: date, listType: date === today ? 'today' : 'upcoming' });
    setTitle('');
  };

  return (
    <section className="space-y-1.5">
      <div className="flex items-center">
        <h3 className={`${sectionTitle} mr-auto`}>
          <CheckSquare className="w-3.5 h-3.5" />
          Tasks
        </h3>
        <button type="button" onClick={() => setActiveView('tasks')} className="text-[11px] text-brand-600 hover:underline">
          All tasks →
        </button>
      </div>
      {tasks.length === 0 && <p className="text-sm text-stone-500">Nothing due {date === today ? 'today' : 'this day'}.</p>}
      <ul className="space-y-1">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.completed}
              onChange={() => {
                storage.updateTask(t.id, { completed: !t.completed });
                setJustDone((d) => (d.includes(t.id) ? d : [...d, t.id]));
              }}
              aria-label={`Done: ${t.title}`}
              className="mt-1 accent-brand-600"
            />
            <span className={t.completed ? 'line-through text-stone-400' : ''}>
              {t.title}
              {t.dueDate && t.dueDate < today && !t.completed && <span className="ml-1.5 text-[10px] font-bold text-rose-600 uppercase">overdue</span>}
              {t.priority === 'high' && !t.completed && <span className="ml-1.5 text-[10px] font-bold text-amber-600 uppercase">high</span>}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="flex gap-1.5 pt-1">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for this day…" aria-label="New task" className={paperInput} />
        <button type="submit" aria-label="Add task" className="px-2 rounded-lg bg-stone-800 text-white">
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </section>
  );
};

// ---------------------------------------------------------------------------

export const CarryOverBanner: React.FC<{ date: string; onDone: (message: string) => void }> = ({ date, onDone }) => {
  const page = storage.getPlannerPage(date);
  if (page?.carryHandled) return null;
  const found = unfinishedBefore(date);
  if (!found) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-3 py-2.5 text-sm space-y-1.5">
      <div className="font-semibold flex items-center gap-1.5">
        <Undo2 className="w-4 h-4 text-amber-600" />
        {found.items.length} unfinished from {shortDate(found.date)}
      </div>
      <ul className="text-xs text-stone-600 list-disc pl-5">
        {found.items.slice(0, 4).map((i, n) => (
          <li key={n}>{i}</li>
        ))}
        {found.items.length > 4 && <li>…and {found.items.length - 4} more</li>}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onDone(`Brought over ${carryOver(found.date, date)} item${found.items.length === 1 ? '' : 's'}`)}
          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Bring them over
        </button>
        <button type="button" onClick={() => { dismissCarry(date); onDone(''); }} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200/60 flex items-center gap-1">
          <X className="w-3.5 h-3.5" />
          Not now
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------

const MOODS: { id: JournalEntry['mood']; label: string }[] = [
  { id: 'great', label: 'Great' },
  { id: 'good', label: 'Good' },
  { id: 'neutral', label: 'Okay' },
  { id: 'challenging', label: 'Tough' },
  { id: 'exhausting', label: 'Exhausting' }
];

export const ReflectionCard: React.FC<{ date: string; onSaved: (message: string) => void }> = ({ date, onSaved }) => {
  const { setActiveView } = useApp();
  const page = storage.getPlannerPage(date);
  const saved = page?.reflectionId ? storage.getJournalEntries().find((j) => j.id === page.reflectionId) : null;
  const [mood, setMood] = useState<JournalEntry['mood']>('good');
  const [text, setText] = useState('');

  if (saved) {
    return (
      <section className="rounded-xl border border-stone-300/70 bg-white/60 px-3 py-2.5 text-sm space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <BookMarked className="w-4 h-4 text-brand-600" />
          Reflection saved to your journal
        </div>
        <p className="text-stone-600 line-clamp-3">{saved.content}</p>
        <button type="button" onClick={() => setActiveView('journal')} className="text-xs text-brand-600 hover:underline">
          Open the journal →
        </button>
      </section>
    );
  }

  const save = () => {
    if (!text.trim()) return;
    const entry = storage.addJournalEntry({
      date,
      title: `Reflection · ${shortDate(date)}`,
      content: text.trim(),
      tags: ['reflection'],
      mood,
      energyLevel: mood === 'great' ? 5 : mood === 'good' ? 4 : mood === 'neutral' ? 3 : 2,
      templateType: 'daily_reflection'
    });
    const current = storage.getPlannerPage(date) || { date, html: '', attachments: [], updatedAt: '' };
    storage.savePlannerPage({ ...current, reflectionId: entry.id });
    onSaved('Reflection saved to your Daily Journal');
  };

  return (
    <section className="rounded-xl border border-stone-300/70 bg-white/50 px-3 py-2.5 space-y-2">
      <h3 className={sectionTitle}>
        <BookMarked className="w-3.5 h-3.5" />
        End-of-day reflection
      </h3>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="How did today feel?">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mood === m.id}
            onClick={() => setMood(m.id)}
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${mood === m.id ? 'bg-brand-600 border-brand-600 text-white' : 'border-stone-300 text-stone-600'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="What went well? What would you change next time?" aria-label="Reflection" className={paperInput} />
      <button type="button" onClick={save} disabled={!text.trim()} className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-900 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5">
        <BookMarked className="w-3.5 h-3.5" />
        Save to journal
      </button>
    </section>
  );
};
