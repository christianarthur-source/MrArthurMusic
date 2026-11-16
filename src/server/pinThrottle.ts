/**
 * A best-effort pause for repeated wrong PINs. Generous on purpose (young children type PINs):
 * 10 wrong guesses for one student or teacher, then about a minute's pause with a friendly
 * message. Never a permanent lock, and it only ever pauses the account that was being guessed,
 * so one student's mistakes can never stop a different student from signing in.
 *
 * The counters live in this Worker isolate's memory. Cloudflare may run several isolates and
 * recycles them, so this slows guessing down but is not a hard guarantee. A durable, shared
 * counter would need a storage binding (KV, a Durable Object or a database table), which needs
 * a deploy-config or schema change. See the WP-3 report.
 */

export const PIN_MAX_FAILS = 10;
/** Looser limit for guesses that cannot be tied to one teacher account (keyed by network address). */
export const PIN_MAX_FAILS_UNIDENTIFIED = 30;
export const PIN_PAUSE_MS = 60_000;
/** Old mistakes are forgotten after this long without a new one. */
const FORGET_AFTER_MS = 10 * 60_000;
const MAX_BUCKETS = 5000;

interface Bucket {
  fails: number;
  last: number;
  blockedUntil: number;
}

const buckets = new Map<string, Bucket>();

/** Milliseconds left on the pause for this key (0 = not paused). */
export function pauseRemainingMs(key: string, now = Date.now()): number {
  const b = buckets.get(key);
  if (!b) return 0;
  if (b.blockedUntil > now) return b.blockedUntil - now;
  // The pause is over (or the old mistakes are stale): start fresh.
  if (b.blockedUntil || now - b.last > FORGET_AFTER_MS) buckets.delete(key);
  return 0;
}

/** Records one wrong guess. Returns true when this guess started a pause. */
export function recordWrongPin(key: string, max = PIN_MAX_FAILS, now = Date.now()): boolean {
  let b = buckets.get(key);
  if (!b || b.blockedUntil || now - b.last > FORGET_AFTER_MS) {
    b = { fails: 0, last: now, blockedUntil: 0 };
    buckets.set(key, b);
  }
  b.fails += 1;
  b.last = now;
  if (buckets.size > MAX_BUCKETS) prune(now);
  if (b.fails >= max) {
    b.blockedUntil = now + PIN_PAUSE_MS;
    return true;
  }
  return false;
}

/** A correct sign-in clears the count. */
export function clearWrongPins(key: string): void {
  buckets.delete(key);
}

function prune(now: number) {
  for (const [k, b] of buckets) {
    if (b.blockedUntil ? b.blockedUntil <= now : now - b.last > FORGET_AFTER_MS) buckets.delete(k);
  }
  // Still too many: drop the oldest entries (Map keeps insertion order).
  for (const k of buckets.keys()) {
    if (buckets.size <= MAX_BUCKETS) break;
    buckets.delete(k);
  }
}
