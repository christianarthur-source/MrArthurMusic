import type { StudentSession } from './utils/classroomApi';
import { isToolId } from './routes';

/**
 * What the landing page offers, grouped by what students do with it.
 * Each entry's "grades" lists the grade bands it suits (the grade filter hides the rest); "all" suits every band.
 * The picture cards themselves are drawn in MusicLabLanding.tsx.
 */

export type LabGroup = 'create' | 'play' | 'practice' | 'tools';
export type GradeBand = 'K-2' | '3-5' | '6-8';
export type GradeFilter = 'all' | GradeBand;

export const GRADE_BANDS: readonly GradeBand[] = ['K-2', '3-5', '6-8'];

export interface LabEntry {
  id: string;
  title: string;
  emoji: string;
  group: LabGroup;
  grades: 'all' | readonly GradeBand[];
  /** Where it lives: an app/tool route id, or a path for a separate page. */
  to: { app: string } | { path: string };
}

export const LAB_ENTRIES: readonly LabEntry[] = [
  { id: 'staff-composer', title: 'Staff Composer', emoji: '🎼', group: 'create', grades: 'all', to: { app: 'staff-composer' } },
  { id: 'beat-machine', title: 'Beat Machine', emoji: '🥁', group: 'create', grades: 'all', to: { app: 'beat-machine' } },
  { id: 'daw', title: 'Studio DAW', emoji: '🎚️', group: 'create', grades: ['3-5', '6-8'], to: { app: 'daw' } },
  { id: 'song-starter', title: 'Song Starter', emoji: '🎶', group: 'create', grades: ['K-2'], to: { app: 'song-starter' } },
  { id: 'midimusic', title: 'MIDI MUSIC', emoji: '🎹', group: 'create', grades: 'all', to: { path: '/midimusic/' } },
  { id: 'chromeextra', title: 'Chrome Music Lab EXTRA', emoji: '🧪', group: 'create', grades: 'all', to: { path: '/chromeextra/' } },
  { id: 'typebeat', title: 'Type Beat', emoji: '⌨️', group: 'create', grades: 'all', to: { path: '/typebeat/' } },
  { id: 'staff-wars', title: 'Staff Wars', emoji: '🚀', group: 'play', grades: ['3-5', '6-8'], to: { app: 'staff-wars' } },
  { id: 'rhythm-rockstars', title: 'Rhythm Rock Stars', emoji: '🎸', group: 'play', grades: 'all', to: { app: 'rhythm-rockstars' } },
  { id: 'solfege-trainer', title: 'Do-Re-Mi Trainer', emoji: '🔔', group: 'practice', grades: ['K-2', '3-5'], to: { app: 'solfege-trainer' } },
  { id: 'music-symbol-match', title: 'Symbol Match', emoji: '🃏', group: 'practice', grades: ['K-2', '3-5'], to: { app: 'music-symbol-match' } },
  { id: 'dynamic-ears', title: 'Dynamic Ears', emoji: '👂', group: 'practice', grades: 'all', to: { app: 'dynamic-ears' } },
  { id: 'instrument-zoo', title: 'Instrument Zoo', emoji: '🎻', group: 'practice', grades: ['K-2', '3-5'], to: { app: 'instrument-zoo' } },
  { id: 'metronome', title: 'Metronome', emoji: '⏱️', group: 'tools', grades: 'all', to: { app: 'metronome' } },
  { id: 'tempo-tapper', title: 'Tap Tempo', emoji: '👆', group: 'tools', grades: 'all', to: { app: 'tempo-tapper' } },
  { id: 'tuner', title: 'Instrument Tuner', emoji: '🎸', group: 'tools', grades: ['3-5', '6-8'], to: { app: 'tuner' } },
];

export function entryById(id: string): LabEntry | undefined {
  return LAB_ENTRIES.find((e) => e.id === id);
}

export function matchesGrade(entry: LabEntry, filter: GradeFilter): boolean {
  return filter === 'all' || entry.grades === 'all' || entry.grades.includes(filter);
}

/** Web address of an entry, relative to the folder the Music Lab lives in. */
export function hrefForEntry(entry: LabEntry): string {
  if ('path' in entry.to) return entry.to.path;
  return `?app=${entry.to.app}`;
}

// --- "Continue where you left off" ---------------------------------------------------------------
// The last few tools a signed-in student opened on this device. A small local list under its own new key,
// one per student; nothing is sent anywhere and no saved work is touched.

const RECENT_KEY_PREFIX = 'mrarthur_lab_recent_v1:';
const RECENT_MAX = 3;

function recentKey(session: Pick<StudentSession, 'id'>): string {
  return `${RECENT_KEY_PREFIX}${session.id}`;
}

export function readRecentTools(session: Pick<StudentSession, 'id'> | null): string[] {
  if (!session) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(recentKey(session)) || '[]');
    return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string' && !!entryById(id)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Remembers that the signed-in student just opened an app or tool (does nothing when nobody is signed in). */
export function recordRecentTool(session: Pick<StudentSession, 'id'> | null, id: string): void {
  if (!session) return;
  const known = entryById(id) || isToolId(id);
  if (!known || id === 'hub' || id === 'big-staff') return;
  try {
    const next = [id, ...readRecentTools(session).filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(session), JSON.stringify(next));
  } catch {
    // storage blocked or full: the row just stays empty
  }
}
