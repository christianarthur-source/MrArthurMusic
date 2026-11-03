/**
 * Class rotation: which cycle day (Day 1, Day 2, …) a date falls on. The cycle only advances on
 * school days that aren't listed as days off, so a snow day pushes the whole rotation back.
 */
import { RotationClass, RotationSettings } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');
export const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const shift = (s: string, days: number) => {
  const d = fromYMD(s);
  d.setDate(d.getDate() + days);
  return toYMD(d);
};

export function defaultRotation(cycleLength = 6): RotationSettings {
  return {
    cycleLength,
    anchorDate: toYMD(new Date()),
    anchorDay: 1,
    schoolDays: [1, 2, 3, 4, 5],
    noSchoolDates: [],
    days: Array.from({ length: cycleLength }, () => [])
  };
}

export function isSchoolDay(date: string, r: RotationSettings): boolean {
  return r.schoolDays.includes(fromYMD(date).getDay()) && !r.noSchoolDates.includes(date);
}

/** The cycle day (1…cycleLength) for a date, or null if it isn't a school day. */
export function cycleDayFor(date: string, r: RotationSettings): number | null {
  if (!isSchoolDay(date, r) || r.cycleLength < 1) return null;
  // Count school days between the anchor and the date (negative when the date is earlier).
  let count = 0;
  if (date >= r.anchorDate) {
    // (An anchor on a day off isn't counted, so the first school day after it is the anchor day.)
    for (let d = r.anchorDate; d < date; d = shift(d, 1)) if (isSchoolDay(d, r)) count++;
  } else {
    for (let d = date; d < r.anchorDate; d = shift(d, 1)) if (isSchoolDay(d, r)) count--;
  }
  const zeroBased = (((r.anchorDay - 1 + count) % r.cycleLength) + r.cycleLength) % r.cycleLength;
  return zeroBased + 1;
}

/** Classes on a date, earliest first. */
export function classesOn(date: string, r: RotationSettings | null): { day: number | null; classes: RotationClass[] } {
  if (!r) return { day: null, classes: [] };
  const day = cycleDayFor(date, r);
  if (!day) return { day: null, classes: [] };
  return { day, classes: [...(r.days[day - 1] || [])].sort((a, b) => a.start.localeCompare(b.start)) };
}

/** Makes `date` count as `day` from now on (e.g. "today is actually Day 4"). */
export function setDayFor(r: RotationSettings, date: string, day: number): RotationSettings {
  return { ...r, anchorDate: date, anchorDay: day };
}

/** Changes the cycle length, keeping the classes already entered for the days that remain. */
export function resizeCycle(r: RotationSettings, cycleLength: number): RotationSettings {
  const days = Array.from({ length: cycleLength }, (_, i) => r.days[i] || []);
  return { ...r, cycleLength, days, anchorDay: Math.min(r.anchorDay, cycleLength) };
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h)) return hhmm;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
