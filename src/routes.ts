import type { MusicLabAppId } from './components/MusicLabLanding';
import type { ToolId } from './components/tools/ClassroomToolBoxModal';

/**
 * The one place that knows which web addresses open which part of the Music Lab.
 * (Before, three separate pieces of code each re-read the address.)
 *
 * Addresses that keep working, exactly as before:
 *   /?app=staff-composer | rhythm-rockstars | beat-machine | daw | staff-wars
 *   /?app=big-staff, /?app=kids, /big-staff, /bigstaff, /kids          (Big Staff)
 *   ?share= / ?score= / ?s= / ?link= / ?song= / ?project= / ?daw=      (share links, also after the #)
 *   #app=..., #share=..., #mrdaw=...
 * New: /?app=metronome and the other Tool Box tools (see TOOL_ROUTES).
 */

export const SITE_NAME = "Mr. Arthur's Music Lab";

/** Apps that open as a whole page of their own. */
export type AppRouteId = Exclude<MusicLabAppId, 'hub' | 'big-staff'>;

const APP_ROUTE_IDS: readonly AppRouteId[] = ['staff-composer', 'rhythm-rockstars', 'beat-machine', 'daw', 'staff-wars'];

/** Tool Box tools: a window on top of the landing page, but each has its own address now. */
export const TOOL_ROUTES = [
  { id: 'metronome', title: 'Metronome' },
  { id: 'tempo-tapper', title: 'Tap Tempo' },
  { id: 'solfege-trainer', title: 'Do-Re-Mi Trainer' },
  { id: 'instrument-zoo', title: 'Instrument Zoo' },
  { id: 'dynamic-ears', title: 'Dynamic Ears' },
  { id: 'song-starter', title: 'Song Starter' },
  { id: 'music-symbol-match', title: 'Symbol Match' },
  { id: 'tuner', title: 'Instrument Tuner' },
] as const satisfies readonly { id: ToolId; title: string }[];

const APP_TITLES: Record<MusicLabAppId, string> = {
  hub: SITE_NAME,
  'staff-composer': 'Staff Composer',
  'big-staff': 'Big Staff',
  'rhythm-rockstars': 'Rhythm Rock Stars',
  'beat-machine': 'Beat Machine',
  daw: 'Studio DAW',
  'staff-wars': 'Staff Wars',
};

export function isToolId(value: string | null | undefined): value is ToolId {
  return !!value && TOOL_ROUTES.some((t) => t.id === value);
}

/** Every page title in the suite reads "Tool Name · Mr. Arthur's Music Lab". */
export function pageTitle(toolName?: string | null): string {
  return toolName ? `${toolName} · ${SITE_NAME}` : SITE_NAME;
}

export interface RouteState {
  app: MusicLabAppId;
  /** Staff Composer opened in the K-1 "Big Staff" view. */
  bigStaff: boolean;
  /** A Tool Box tool open on the landing page. */
  tool: ToolId | null;
}

export function titleForRoute(route: RouteState): string {
  if (route.tool) return pageTitle(TOOL_ROUTES.find((t) => t.id === route.tool)?.title);
  if (route.app === 'hub') return SITE_NAME;
  if (route.app === 'staff-composer' && route.bigStaff) return pageTitle(APP_TITLES['big-staff']);
  return pageTitle(APP_TITLES[route.app]);
}

function hashParamsOf(loc: Location): URLSearchParams {
  return new URLSearchParams((loc.hash || '').replace(/^#/, ''));
}

/** Reads one parameter from the query string or, failing that, from the part after the #. */
export function readUrlParam(loc: Location, ...names: string[]): string | null {
  const query = new URLSearchParams(loc.search);
  const hash = hashParamsOf(loc);
  for (const name of names) {
    const v = query.get(name) ?? hash.get(name);
    if (v) return v;
  }
  return null;
}

/** True for the Big Staff shortcuts (/big-staff, /kids, ?app=big-staff, ?kids, ...). */
export function isBigStaffLocation(loc: Location = window.location): boolean {
  try {
    const params = new URLSearchParams(loc.search);
    const hashParams = hashParamsOf(loc);
    const appParam = (params.get('app') || hashParams.get('app') || '').toLowerCase();
    if (appParam === 'big-staff' || appParam === 'bigstaff' || appParam === 'kids') return true;
    if (
      params.has('bigstaff') || params.has('big-staff') || hashParams.has('bigstaff') ||
      hashParams.has('big-staff') || params.has('kids') || hashParams.has('kids')
    ) {
      return true;
    }
    const modeParam = (params.get('mode') || hashParams.get('mode') || '').toLowerCase();
    if (
      (modeParam === 'easy' || modeParam === 'simple') &&
      (params.get('bigStaff') === '1' || params.get('bigStaff') === 'true' || params.has('bigStaff') || params.has('big-staff'))
    ) {
      return true;
    }
    const path = (loc.pathname || '').toLowerCase();
    if (path.endsWith('/big-staff') || path.endsWith('/bigstaff') || path.endsWith('/kids')) return true;
  } catch {
    // restricted frame: fall through
  }
  return false;
}

/** True when the address carries a saved/shared song or score (these load their own data on page load). */
export function hasShareParams(loc: Location = window.location): boolean {
  return !!readUrlParam(loc, 'share', 'score', 's', 'link', 'song', 'project', 'daw') || /[#&]mrdaw=/.test(loc.hash || '');
}

/** Which part of the Music Lab this address opens. Anything unrecognised opens the landing page. */
export function routeFromLocation(loc: Location = window.location): RouteState {
  try {
    if (isBigStaffLocation(loc)) return { app: 'staff-composer', bigStaff: true, tool: null };

    const appParam = readUrlParam(loc, 'app');
    if (appParam && (APP_ROUTE_IDS as readonly string[]).includes(appParam)) {
      return { app: appParam as AppRouteId, bigStaff: false, tool: null };
    }
    if (isToolId(appParam)) return { app: 'hub', bigStaff: false, tool: appParam };

    // Share links: a beat (?song=, or a long legacy ?s=), a DAW project, or a Staff Composer score.
    const s = readUrlParam(loc, 's');
    if (readUrlParam(loc, 'song') || (s && s.length > 16)) return { app: 'beat-machine', bigStaff: false, tool: null };
    if (readUrlParam(loc, 'project', 'daw')) return { app: 'daw', bigStaff: false, tool: null };
    if (readUrlParam(loc, 'share', 'score')) return { app: 'staff-composer', bigStaff: false, tool: null };
  } catch {
    // restricted frame: fall through
  }
  return { app: 'hub', bigStaff: false, tool: null };
}

/** The folder the Music Lab lives in, without a Big Staff shortcut ending (so "Music Lab" never lands back in Big Staff). */
function basePath(loc: Location): string {
  return (loc.pathname || '/').replace(/\/(big-staff|bigstaff|kids)\/?$/i, '/') || '/';
}

export function urlForRoute(route: RouteState, loc: Location = window.location): string {
  const base = basePath(loc);
  if (route.tool) return `${base}?app=${route.tool}`;
  if (route.app === 'hub') return base;
  if (route.app === 'staff-composer' && route.bigStaff) return `${base}?app=big-staff`;
  return `${base}?app=${route.app}`;
}

// --- history -------------------------------------------------------------------------------
// Each address we add to the browser history is marked, and remembers whether it was reached from the
// landing page. That lets the "Music Lab" button simply step back (so Back and the button agree)
// instead of piling up extra history entries.

interface SuiteHistoryState {
  suite: true;
  fromHub: boolean;
}

function readSuiteState(): SuiteHistoryState | null {
  try {
    const st = window.history.state as Partial<SuiteHistoryState> | null;
    return st && st.suite === true ? (st as SuiteHistoryState) : null;
  } catch {
    return null;
  }
}

/** Adds the route to the browser history (so the Back button returns to where the student was). */
export function pushRoute(route: RouteState, fromHub: boolean): void {
  try {
    const url = urlForRoute(route);
    if (url === window.location.pathname + window.location.search && !window.location.hash) return;
    window.history.pushState({ suite: true, fromHub } satisfies SuiteHistoryState, '', url);
  } catch {
    // history may be blocked in a restricted frame: the page still works, just without Back support
  }
}

/** Replaces the current history entry (e.g. switching tabs inside the Tool Box). Keeps its marker. */
export function replaceRoute(route: RouteState): void {
  try {
    const keep = readSuiteState() ?? { suite: true, fromHub: false };
    window.history.replaceState(keep, '', urlForRoute(route));
  } catch {
    // ignore
  }
}

/**
 * Goes back to the landing page. Steps back in history when this page was opened from the landing page
 * inside this visit; otherwise adds the landing page as a new entry. Returns true when it stepped back
 * (the caller then waits for the popstate event).
 */
export function goHomeInHistory(): boolean {
  const st = readSuiteState();
  if (st?.fromHub) {
    try {
      window.history.back();
      return true;
    } catch {
      // fall through to a normal push
    }
  }
  pushRoute({ app: 'hub', bigStaff: false, tool: null }, false);
  return false;
}
