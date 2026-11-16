/**
 * A gentle, device-side pause after repeated wrong PINs. 10 wrong tries for the same student (or
 * teacher), then about a minute's pause with a friendly message, never a permanent lock. It
 * survives a page reload (localStorage) and clears on a correct sign-in. The class server has its
 * own pause too (src/server/pinThrottle.ts); this one just keeps young children from hammering
 * the keypad and gives them a clear message and countdown.
 */

const STORAGE_KEY = 'mrarthur_pin_pause_v1';
export const PIN_TRIES_BEFORE_PAUSE = 10;
export const PIN_PAUSE_SECONDS = 60;
/** Old mistakes are forgotten after this long without a new one. */
const FORGET_AFTER_MS = 10 * 60_000;

interface Entry {
  fails: number;
  last: number;
  until: number;
}
type Store = Record<string, Entry>;

function load(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: Store, now: number) {
  // Drop anything that no longer matters so the key never grows.
  for (const k of Object.keys(store)) {
    const e = store[k];
    if (!e || typeof e !== 'object' || (e.until ? e.until <= now : now - e.last > FORGET_AFTER_MS)) delete store[k];
  }
  try {
    if (Object.keys(store).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the pause then only lasts until the page is reloaded
    memory = store;
  }
}

// Fallback when localStorage is blocked (private window, school policy).
let memory: Store | null = null;
const read = (): Store => (memory ? memory : load());

/** Key for a student's sign-in: the typed name (as the server sees it) plus the class picked. */
export const studentPinKey = (normalizedName: string, classId: string) => `s:${normalizedName}|${classId || ''}`;
/** Key for a teacher's sign-in: the picked teacher's id (or 'any' when no name was picked). */
export const teacherPinKey = (teacherId?: string) => `t:${teacherId || 'any'}`;

/** Seconds left on the pause for this key (0 = not paused). */
export function pinPauseSecondsLeft(key: string, now = Date.now()): number {
  const e = read()[key];
  if (!e || !(e.until > now)) return 0;
  return Math.ceil((e.until - now) / 1000);
}

/** True when any key is currently paused (used to run the countdown timer). */
export function anyPinPauseActive(now = Date.now()): boolean {
  return Object.values(read()).some((e) => e && e.until > now);
}

/** Records one wrong PIN. Returns the pause in seconds when this try used up the allowance, else 0. */
export function noteWrongPin(key: string, now = Date.now()): number {
  const store = read();
  let e = store[key];
  if (!e || e.until || now - e.last > FORGET_AFTER_MS) e = { fails: 0, last: now, until: 0 };
  e.fails += 1;
  e.last = now;
  if (e.fails >= PIN_TRIES_BEFORE_PAUSE) e.until = now + PIN_PAUSE_SECONDS * 1000;
  store[key] = e;
  save(store, now);
  return e.until ? PIN_PAUSE_SECONDS : 0;
}

/** The server said to wait: show the same pause here. */
export function noteServerPause(key: string, seconds: number, now = Date.now()): void {
  const store = read();
  const secs = Math.min(120, Math.max(1, Math.round(seconds || PIN_PAUSE_SECONDS)));
  store[key] = { fails: PIN_TRIES_BEFORE_PAUSE, last: now, until: now + secs * 1000 };
  save(store, now);
}

/** A correct sign-in clears the count. */
export function clearWrongPins(key: string): void {
  const store = read();
  if (!(key in store)) return;
  delete store[key];
  save(store, Date.now());
}

export const studentPauseMessage = (seconds: number) =>
  `Too many tries. Ask your teacher for your PIN, or wait ${seconds > 1 ? `${seconds} seconds` : 'a moment'} and try again.`;
export const teacherPauseMessage = (seconds: number) =>
  `Too many tries. Please wait ${seconds > 1 ? `${seconds} seconds` : 'a moment'} and try again.`;
