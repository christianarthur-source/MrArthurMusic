/**
 * Subscribed calendar feeds (Google / iCloud iCal links): reading .ics text, syncing a feed
 * through the site's calendar helper, and refreshing feeds in the background so school
 * calendars stay current without pressing Sync.
 */
import { CalendarEvent, CalendarSubscription } from '../types';
import { cloudSync } from './cloudSync';
import { storage } from './storage';

/** How old a feed can get before the background refresh fetches it again. */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 60 * 60 * 1000;

export function inferCategory(title: string, desc: string): CalendarEvent['category'] {
  const combined = (title + ' ' + desc).toLowerCase();
  if (combined.includes('rehearsal') || combined.includes('chorus') || combined.includes('choir')) return 'rehearsal';
  if (combined.includes('concert') || combined.includes('performance') || combined.includes('festival') || combined.includes('informance') || combined.includes('holiday')) return 'concert';
  if (combined.includes('assembly')) return 'assembly';
  if (combined.includes('pd') || combined.includes('in-service') || combined.includes('conference') || combined.includes('workshop')) return 'pd';
  if (combined.includes('meeting') || combined.includes('duty') || combined.includes('committee')) return 'meeting';
  if (combined.includes('grade') || combined.includes('class') || combined.includes('music')) return 'class';
  return 'concert';
}

// iCalendar timestamp (YYYYMMDDTHHMMSS or YYYYMMDD) to YYYY-MM-DDTHH:mm
function formatIcsDate(val?: string): string {
  if (!val) return new Date().toISOString().slice(0, 16);
  const cleaned = val.replace(/[^0-9T]/g, '');
  if (cleaned.length >= 13) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T${cleaned.slice(9, 11)}:${cleaned.slice(11, 13)}`;
  }
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T09:00`;
  }
  return new Date().toISOString().slice(0, 16);
}

/** Parses .ics text into events (title, dates, location, description). */
export function parseIcsText(icsText: string): Partial<CalendarEvent>[] {
  const parsed: Partial<CalendarEvent>[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  let inEvent = false;
  let current: any = {};

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // handle line unfolding
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].slice(1);
      i++;
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current.title && current.startDate) {
        if (!current.endDate) current.endDate = current.startDate;
        parsed.push(current);
      }
      inEvent = false;
    } else if (inEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const tag = line.slice(0, colonIdx);
      const val = line.slice(colonIdx + 1).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').trim();

      if (tag === 'SUMMARY' || tag.startsWith('SUMMARY;')) current.title = val;
      else if (tag === 'DTSTART' || tag.startsWith('DTSTART;')) current.startDate = formatIcsDate(val);
      else if (tag === 'DTEND' || tag.startsWith('DTEND;')) current.endDate = formatIcsDate(val);
      else if (tag === 'LOCATION' || tag.startsWith('LOCATION;')) current.location = val;
      else if (tag === 'UID' || tag.startsWith('UID;')) current.uid = val;
      else if (tag === 'DESCRIPTION' || tag.startsWith('DESCRIPTION;')) current.description = val;
    }
  }
  return parsed;
}

/** Downloads a subscribed feed and replaces its events. Returns how many events it now has. */
export async function syncSubscription(sub: CalendarSubscription): Promise<number> {
  if (!sub.url) throw new Error('This calendar has no link to sync from.');
  let url = sub.url.trim();
  if (url.startsWith('webcal://')) url = 'https://' + url.slice(9);

  const res = await cloudSync.hubFetch(`/api/hub/calendar?url=${encodeURIComponent(url)}`);
  const icsData = res.ok ? await res.text() : '';
  if (!icsData.includes('BEGIN:VCALENDAR')) throw new Error(`Unable to load ${sub.name} from its provider.`);

  const newEvents: CalendarEvent[] = [];
  parseIcsText(icsData).forEach((item, idx) => {
    if (!item.title || !item.startDate) return;
    newEvents.push({
      id: `ev-${sub.id}-${idx}`,
      title: item.title,
      startDate: item.startDate,
      endDate: item.endDate || item.startDate,
      category: inferCategory(item.title, item.description || ''),
      location: item.location || '',
      color: sub.color,
      source: 'subscription',
      sourceId: sub.id,
      calendarName: sub.name
    });
  });
  const otherEvents = storage.getEvents().filter((e) => e.sourceId !== sub.id);
  storage.saveEvents([...otherEvents, ...newEvents]);
  storage.updateSubscription(sub.id, { lastSynced: new Date().toISOString(), eventCount: newEvents.length });
  return newEvents.length;
}

let refreshing = false;

/** Syncs every visible linked calendar that hasn't been synced in the last 12 hours. */
export async function refreshStaleSubscriptions(): Promise<void> {
  if (refreshing || !cloudSync.hasToken() || !navigator.onLine) return;
  refreshing = true;
  try {
    const now = Date.now();
    const stale = storage
      .getSubscriptions()
      .filter((s) => s.enabled && s.url && (!s.lastSynced || now - new Date(s.lastSynced).getTime() > REFRESH_AFTER_MS));
    for (const sub of stale) {
      try {
        await syncSubscription(sub);
      } catch (err) {
        console.warn(`Background refresh of ${sub.name} failed`, err);
      }
    }
  } finally {
    refreshing = false;
  }
}

let started = false;

/** Refreshes stale feeds now and then once an hour while the Hub is open. */
export function startCalendarAutoRefresh() {
  if (started) return;
  started = true;
  refreshStaleSubscriptions();
  setInterval(refreshStaleSubscriptions, CHECK_EVERY_MS);
}
