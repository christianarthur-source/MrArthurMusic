import React, { useEffect, useState } from 'react';
import { CalendarClock, Snowflake, Plus, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { useRememberedState } from '../../hooks/useRememberedState';
import { classesOn, cycleDayFor, defaultRotation, formatTime, resizeCycle, setDayFor, toYMD } from '../../services/rotation';
import { GradeLevel, RotationClass, RotationSettings } from '../../types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const GRADES: GradeLevel[] = ['K', '1', '2', '3', '4', '5', '6', 'Chorus'];

const shortDate = (ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};

const card = 'bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-card border border-stone-200/80 dark:border-stone-800';
const input =
  'text-xs px-2.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';

/** Set up the Day 1…N class rotation and see which day today and the coming weeks are. */
export const RotationView: React.FC = () => {
  const { showToast } = useApp();
  const [rotation, setRotation] = useState<RotationSettings | null>(storage.getRotation());
  const [editDay, setEditDay] = useRememberedState('rotation.editDay', 1);
  const [newDayOff, setNewDayOff] = useState('');
  const today = toYMD(new Date());

  useEffect(() => storage.subscribe(() => setRotation(storage.getRotation())), []);

  const save = (next: RotationSettings) => {
    setRotation(next);
    storage.saveRotation(next);
  };

  if (!rotation) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className={`${card} text-center space-y-4`}>
          <CalendarClock className="w-10 h-10 mx-auto text-brand-600" />
          <h1 className="text-xl font-bold text-stone-900 dark:text-white">Set up your class rotation</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Tell the Hub how many days your cycle has. It works out which day each school day is, skips snow days and
            holidays, and shows today's classes on your home screen and planner.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {[2, 4, 5, 6, 8, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => save(defaultRotation(n))}
                className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
              >
                {n}-day cycle
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400">Today will start as Day 1. You can change that right after.</p>
        </div>
      </div>
    );
  }

  const day = Math.min(editDay, rotation.cycleLength);
  const todayInfo = classesOn(today, rotation);
  const isDayOffToday = rotation.noSchoolDates.includes(today);
  const upcoming: { date: string; day: number | null }[] = [];
  for (let i = 0, d = new Date(); upcoming.length < 14 && i < 40; i++, d.setDate(d.getDate() + 1)) {
    const ymd = toYMD(d);
    const n = cycleDayFor(ymd, rotation);
    if (n || rotation.noSchoolDates.includes(ymd)) upcoming.push({ date: ymd, day: n });
  }

  const updateClass = (id: string, updates: Partial<RotationClass>) => {
    const days = rotation.days.map((list, i) => (i === day - 1 ? list.map((c) => (c.id === id ? { ...c, ...updates } : c)) : list));
    save({ ...rotation, days });
  };

  const addClass = () => {
    const list = rotation.days[day - 1] || [];
    const last = [...list].sort((a, b) => a.start.localeCompare(b.start)).pop();
    const start = last?.end || '08:30';
    const [h, m] = start.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, h, m + 40);
    const end = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    const added: RotationClass = { id: `rc-${Date.now().toString(36)}`, start, end, name: '' };
    save({ ...rotation, days: rotation.days.map((l, i) => (i === day - 1 ? [...l, added] : l)) });
  };

  const removeClass = (id: string) =>
    save({ ...rotation, days: rotation.days.map((l, i) => (i === day - 1 ? l.filter((c) => c.id !== id) : l)) });

  const copyDayTo = (target: number) => {
    const copy = (rotation.days[day - 1] || []).map((c) => ({ ...c, id: `rc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}` }));
    save({ ...rotation, days: rotation.days.map((l, i) => (i === target - 1 ? copy : l)) });
    showToast(`Copied Day ${day}'s classes to Day ${target}`, 'success');
  };

  const toggleDayOff = (date: string) => {
    const off = rotation.noSchoolDates.includes(date)
      ? rotation.noSchoolDates.filter((d) => d !== date)
      : [...rotation.noSchoolDates, date].sort();
    save({ ...rotation, noSchoolDates: off });
  };

  const classesForDay = [...(rotation.days[day - 1] || [])].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-bold text-stone-900 dark:text-white">Class Rotation</h1>
      </div>

      {/* Today */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className={`${card} lg:col-span-1 space-y-4`}>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">{shortDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            <div className="text-4xl font-extrabold text-stone-900 dark:text-white mt-1">
              {todayInfo.day ? `Day ${todayInfo.day}` : isDayOffToday ? 'No school' : 'Not a school day'}
            </div>
          </div>
          {todayInfo.classes.length > 0 && (
            <ul className="space-y-1.5">
              {todayInfo.classes.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2 text-sm">
                  <span className="w-16 shrink-0 text-xs font-mono text-stone-500">{formatTime(c.start)}</span>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">{c.name || 'Untitled class'}</span>
                  {c.room && <span className="text-xs text-stone-400">{c.room}</span>}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {rotation.schoolDays.includes(new Date().getDay()) && (
              <button
                type="button"
                onClick={() => toggleDayOff(today)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${isDayOffToday ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200' : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200'}`}
              >
                <Snowflake className="w-3.5 h-3.5" />
                {isDayOffToday ? 'School is open today after all' : 'No school today'}
              </button>
            )}
            {todayInfo.day && (
              <label className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
                Today is actually
                <select
                  value={todayInfo.day}
                  onChange={(e) => save(setDayFor(rotation, today, Number(e.target.value)))}
                  className="bg-transparent font-bold focus:outline-none"
                  aria-label="Set today's rotation day"
                >
                  {Array.from({ length: rotation.cycleLength }, (_, i) => (
                    <option key={i} value={i + 1}>Day {i + 1}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Coming days */}
        <div className={`${card} lg:col-span-2`}>
          <h2 className="text-sm font-bold text-stone-900 dark:text-white mb-3">Next two weeks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {upcoming.map(({ date, day: n }) => (
              <button
                key={date}
                type="button"
                onClick={() => n && setEditDay(n)}
                title={n ? `Edit Day ${n}'s classes` : 'Day off'}
                className={`p-2.5 rounded-2xl text-left border transition-colors ${
                  date === today ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800'
                }`}
              >
                <div className="text-[11px] text-stone-500">{shortDate(date)}</div>
                <div className={`text-base font-bold ${n ? 'text-stone-900 dark:text-white' : 'text-sky-600'}`}>{n ? `Day ${n}` : 'No school'}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cycle settings */}
        <div className={`${card} space-y-5`}>
          <h2 className="text-sm font-bold text-stone-900 dark:text-white">Cycle</h2>
          <label className="flex items-center justify-between gap-3 text-xs font-semibold text-stone-600 dark:text-stone-300">
            Days in the cycle
            <select
              value={rotation.cycleLength}
              onChange={(e) => save(resizeCycle(rotation, Number(e.target.value)))}
              className={input}
            >
              {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n} days</option>
              ))}
            </select>
          </label>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">School days</span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w, i) => {
                const on = rotation.schoolDays.includes(i);
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      save({ ...rotation, schoolDays: on ? rotation.schoolDays.filter((d) => d !== i) : [...rotation.schoolDays, i].sort() })
                    }
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${on ? 'bg-brand-600 text-white' : 'bg-stone-100 dark:bg-stone-800 text-stone-500'}`}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Days off (holidays, snow days, conferences)</span>
            <p className="text-[11px] text-stone-400">The rotation doesn't advance on these days.</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newDayOff && !rotation.noSchoolDates.includes(newDayOff)) toggleDayOff(newDayOff);
                setNewDayOff('');
              }}
            >
              <input type="date" value={newDayOff} onChange={(e) => setNewDayOff(e.target.value)} className={`${input} flex-1`} aria-label="Day off to add" />
              <button type="submit" disabled={!newDayOff} className="px-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-semibold">
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {rotation.noSchoolDates.filter((d) => d >= toYMD(new Date(Date.now() - 30 * 86400000))).map((d) => (
                <span key={d} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-200 dark:border-sky-800">
                  {shortDate(d)}
                  <button type="button" onClick={() => toggleDayOff(d)} aria-label={`Remove ${d}`} className="p-0.5 rounded-full hover:bg-sky-200/60">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Classes per day */}
        <div className={`${card} lg:col-span-2 space-y-4`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold text-stone-900 dark:text-white mr-auto">Classes</h2>
            <div className="flex flex-wrap rounded-xl bg-stone-100 dark:bg-stone-800 p-1 text-xs font-semibold" role="tablist" aria-label="Rotation day">
              {Array.from({ length: rotation.cycleLength }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  role="tab"
                  aria-selected={day === n}
                  onClick={() => setEditDay(n)}
                  className={`px-2.5 py-1.5 rounded-lg ${day === n ? 'bg-white dark:bg-stone-900 shadow-sm text-stone-900 dark:text-white' : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'}`}
                >
                  Day {n}
                </button>
              ))}
            </div>
          </div>

          {classesForDay.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400 py-6 text-center">No classes on Day {day} yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="hidden sm:grid grid-cols-[5.5rem_5.5rem_1fr_5.5rem_6rem_2rem] gap-2 text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
                <span>Start</span><span>End</span><span>Class</span><span>Grade</span><span>Room</span><span />
              </div>
              {classesForDay.map((c) => (
                <div key={c.id} className="grid grid-cols-2 sm:grid-cols-[5.5rem_5.5rem_1fr_5.5rem_6rem_2rem] gap-2 items-center p-2 sm:p-1 rounded-2xl bg-stone-50 sm:bg-transparent dark:bg-stone-800/40 sm:dark:bg-transparent">
                  <input type="time" value={c.start} onChange={(e) => updateClass(c.id, { start: e.target.value })} className={input} aria-label="Start time" />
                  <input type="time" value={c.end || ''} onChange={(e) => updateClass(c.id, { end: e.target.value })} className={input} aria-label="End time" />
                  <input value={c.name} onChange={(e) => updateClass(c.id, { name: e.target.value })} placeholder="e.g. Kent – Grade 2" className={`${input} col-span-2 sm:col-span-1`} aria-label="Class name" />
                  <select value={c.grade || ''} onChange={(e) => updateClass(c.id, { grade: (e.target.value || undefined) as GradeLevel | undefined })} className={input} aria-label="Grade">
                    <option value="">Grade</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>{g === 'Chorus' ? 'Chorus' : g === 'K' ? 'K' : `Gr ${g}`}</option>
                    ))}
                  </select>
                  <input value={c.room || ''} onChange={(e) => updateClass(c.id, { room: e.target.value })} placeholder="Room" className={input} aria-label="Room" />
                  <button type="button" onClick={() => removeClass(c.id)} aria-label="Remove class" className="justify-self-end p-2 text-stone-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="button" onClick={addClass} className="px-3 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add class to Day {day}
            </button>
            {classesForDay.length > 0 && rotation.cycleLength > 1 && (
              <select
                value=""
                onChange={(e) => e.target.value && copyDayTo(Number(e.target.value))}
                className={input}
                aria-label={`Copy Day ${day}'s classes to another day`}
              >
                <option value="">Copy Day {day} to…</option>
                {Array.from({ length: rotation.cycleLength }, (_, i) => i + 1)
                  .filter((n) => n !== day)
                  .map((n) => (
                    <option key={n} value={n}>Day {n} (replaces its classes)</option>
                  ))}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
