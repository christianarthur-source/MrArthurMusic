/**
 * Daily Planner helpers: carrying unfinished checklist items forward (like a paper planner's
 * "migrate" arrow), and the AI "Plan my day" and "Summarize this week" features.
 */
import { CHECKLIST_CLASS, plainText, sanitizeHtml } from './plannerContent';
import { storage } from './storage';
import { classesOn } from './rotation';
import { writeWithAI, extractJson } from './aiWriter';
import { PlannerPage } from '../types';

const LOOK_BACK_DAYS = 21;

const pad = (n: number) => String(n).padStart(2, '0');
const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (ymd: string, days: number) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return toYMD(new Date(y, m - 1, d + days));
};
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const parse = (html: string) => new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild as HTMLElement;
const openItems = (root: HTMLElement) =>
  Array.from(root.querySelectorAll(`ul.${CHECKLIST_CLASS} > li`)).filter((li) => !['true', 'moved'].includes(li.getAttribute('data-checked') || '') && li.textContent?.trim());

/** The most recent earlier page with unchecked checklist items, if any. */
export function unfinishedBefore(date: string): { date: string; items: string[] } | null {
  for (let i = 1; i <= LOOK_BACK_DAYS; i++) {
    const d = shift(date, -i);
    const page = storage.getPlannerPage(d);
    if (!page) continue;
    const items = openItems(parse(page.html)).map((li) => li.textContent!.trim());
    if (items.length) return { date: d, items };
  }
  return null;
}

/** Adds the unfinished items to `toDate` as a checklist and marks them "moved" on `fromDate`. */
export function carryOver(fromDate: string, toDate: string): number {
  const from = storage.getPlannerPage(fromDate);
  if (!from) return 0;
  const root = parse(from.html);
  const items = openItems(root);
  items.forEach((li) => li.setAttribute('data-checked', 'moved'));
  storage.savePlannerPage({ ...from, html: sanitizeHtml(root.innerHTML) });

  const to = storage.getPlannerPage(toDate) || { date: toDate, html: '', attachments: [], updatedAt: '' };
  const list = `<h3>Carried over</h3><ul class="${CHECKLIST_CLASS}">${items.map((li) => `<li>${escapeHtml(li.textContent!.trim())}</li>`).join('')}</ul>`;
  storage.savePlannerPage({ ...to, html: list + to.html, carryHandled: true });
  return items.length;
}

export function dismissCarry(date: string) {
  const page = storage.getPlannerPage(date) || { date, html: '', attachments: [], updatedAt: '' };
  storage.savePlannerPage({ ...page, carryHandled: true });
}

// ---------------------------------------------------------------------------
// AI

function dayContext(date: string): string {
  const rotation = storage.getRotation();
  const { day, classes } = classesOn(date, rotation);
  const lessons = storage.getLessonPlans();
  const classLines = classes.map((c) => {
    const log = storage.getClassLog(c.id);
    const today = log.find((e) => e.date === date);
    const last = [...log].reverse().find((e) => e.date < date && e.note);
    const lesson = lessons.find((l) => l.id === (today?.lessonId || [...log].reverse().find((e) => e.date < date && e.lessonId)?.lessonId));
    return `- ${c.start} ${c.name || 'Class'}${lesson ? ` (lesson: ${lesson.title})` : ''}${last?.note ? ` (last time: ${last.note})` : ''}`;
  });
  const events = storage
    .getEvents()
    .filter((e) => e.startDate.slice(0, 10) === date)
    .map((e) => `- ${e.startDate.length > 10 ? e.startDate.slice(11, 16) : 'All day'} ${e.title}`);
  const tasks = storage
    .getTasks()
    .filter((t) => !t.completed && (t.dueDate === date || (t.dueDate && t.dueDate < date) || t.listType === 'today'))
    .map((t) => `- ${t.title}${t.dueDate && t.dueDate < date ? ' (overdue)' : ''}${t.priority === 'high' ? ' (high priority)' : ''}`);
  const page = storage.getPlannerPage(date);
  const carried = unfinishedBefore(date);
  return [
    `Date: ${date}${day ? ` (rotation Day ${day})` : ''}`,
    classLines.length ? `Classes:\n${classLines.join('\n')}` : 'No classes in the rotation today.',
    events.length ? `Calendar:\n${events.join('\n')}` : '',
    tasks.length ? `Tasks:\n${tasks.join('\n')}` : '',
    carried && !page?.carryHandled ? `Unfinished from ${carried.date}:\n${carried.items.map((i) => `- ${i}`).join('\n')}` : '',
    page?.html ? `Already on today's page: ${plainText(page.html).slice(0, 1500)}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Drafts a morning plan (priorities, reminders) as page HTML from the day's classes, events and tasks. */
export async function planMyDay(date: string): Promise<string> {
  const { text } = await writeWithAI(
    `You help an elementary music and chorus teacher plan their school day on a paper-style planner page.
Use only what is in the provided day context; don't invent meetings, students or events.
Respond ONLY with JSON: {"priorities": ["up to 3 short must-dos"], "reminders": ["short reminders tied to specific classes, materials or events"], "tip": "one short encouraging line"}`,
    dayContext(date),
    1200
  );
  const plan = extractJson<{ priorities?: string[]; reminders?: string[]; tip?: string }>(text);
  const li = (items: string[] = []) => items.filter(Boolean).slice(0, 6).map((i) => `<li>${escapeHtml(String(i))}</li>`).join('');
  return sanitizeHtml(
    [
      '<h3>Plan for today</h3>',
      plan.priorities?.length ? `<ul class="${CHECKLIST_CLASS}">${li(plan.priorities)}</ul>` : '',
      plan.reminders?.length ? `<ul>${li(plan.reminders)}</ul>` : '',
      plan.tip ? `<div><i>${escapeHtml(plan.tip)}</i></div>` : ''
    ].join('')
  );
}

/** A short end-of-week summary from the week's planner pages, class notes and completed tasks. */
export async function summarizeWeek(weekStart: string): Promise<string> {
  const days = Array.from({ length: 7 }, (_, i) => shift(weekStart, i));
  const pages = days.map((d) => [d, storage.getPlannerPage(d)] as [string, PlannerPage | null]).filter(([, p]) => p?.html);
  const notes = (storage.getRotation()?.days.flat() || []).flatMap((c) =>
    storage.getClassLog(c.id).filter((e) => days.includes(e.date) && e.note).map((e) => `- ${e.date} ${c.name}: ${e.note}`)
  );
  const done = storage
    .getTasks()
    .filter((t) => t.completed && t.completedAt && days.includes(t.completedAt.slice(0, 10)))
    .map((t) => `- ${t.title}`);
  const context = [
    `Week of ${weekStart}`,
    pages.length ? `Planner pages:\n${pages.map(([d, p]) => `${d}: ${plainText(p!.html).slice(0, 800)}`).join('\n')}` : 'No planner pages this week.',
    notes.length ? `Class notes:\n${[...new Set(notes)].join('\n')}` : '',
    done.length ? `Tasks completed:\n${done.join('\n')}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');
  const { text } = await writeWithAI(
    `You write a short, warm end-of-week summary for an elementary music teacher's journal, from their own planner notes.
Use only what's in the notes. Cover: what got done, how classes progressed, and what to carry into next week. 3 short paragraphs at most, plain text, no headings.`,
    context,
    900
  );
  return text.trim();
}
