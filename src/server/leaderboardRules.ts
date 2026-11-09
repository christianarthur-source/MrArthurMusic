/**
 * Score limits for the public game leaderboards (Staff Wars, Rhythm Rockstars).
 *
 * The games run in the browser, so the server can't watch a round being played. These rules
 * reject or trim numbers no real round could produce. Used by the Cloudflare Worker
 * (classroomCloud.ts) and the Vite dev server (vite.config.ts).
 */
import { ALL_BADGES, LEVEL_QUESTION_COUNTS, LEVELS_CONFIG } from '../rhythm-rockstars/data/rhythmCatalog';

// ---------------------------------------------------------------------------
// Staff Wars: each hit is 100 points + 25 per streak step; a new level every 10 hits.

export const STAFF_WARS_MAX_LEVEL = 60;

export function clampStaffWarsLevel(raw: unknown): number {
  return Math.min(STAFF_WARS_MAX_LEVEL, Math.max(1, parseInt(String(raw), 10) || 1));
}

/** Highest score a perfect run (never missing) can have while on `level`. */
export function staffWarsMaxScore(level: number): number {
  const hits = clampStaffWarsLevel(level) * 10;
  return 100 * hits + 25 * ((hits * (hits - 1)) / 2);
}

/** Lowest level at which `score` is possible (for re-posting a saved high score whose level wasn't kept). */
export function staffWarsMinLevelFor(score: number): number {
  for (let lvl = 1; lvl < STAFF_WARS_MAX_LEVEL; lvl++) if (staffWarsMaxScore(lvl) >= score) return lvl;
  return STAFF_WARS_MAX_LEVEL;
}

// ---------------------------------------------------------------------------
// Rhythm Rockstars

export const RHYTHM_MAX_LEVEL = Math.max(...LEVELS_CONFIG.map((l) => l.levelNumber));
const MAX_STREAK = 1000;

export function clampRhythmLevel(raw: unknown): number {
  return Math.min(RHYTHM_MAX_LEVEL, Math.max(1, parseInt(String(raw), 10) || 1));
}

export function clampStreak(raw: unknown): number {
  return Math.min(MAX_STREAK, Math.max(0, parseInt(String(raw), 10) || 0));
}

/**
 * Most points one Rhythm Rockstars submission can add.
 * - A finished level (stars > 0): every question right plus the 3-star bonus.
 * - One pattern (stars = 0): quiz answers at the x3 streak cap, or Beat Builder's streak bonus.
 */
export function rhythmMaxPoints(level: number, stars: number, streak: number): number {
  const lvl = clampRhythmLevel(level);
  const base = LEVELS_CONFIG.find((l) => l.levelNumber === lvl)?.basePointsPerQuestion || 100;
  if (stars > 0) {
    const questions = LEVEL_QUESTION_COUNTS[lvl] || 10;
    return questions * base + 3 * Math.round(base * 1.5);
  }
  return Math.max(base * 3, Math.round(base * 1.2 + Math.min(clampStreak(streak), 200) * 30));
}

/** Badge ids the game can award; anything else sent by a browser is dropped. */
export const RHYTHM_BADGE_IDS = new Set<string>(['rockstar_rookie', ...ALL_BADGES.map((b) => b.id)]);

export function allowedBadges(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String).filter((b) => RHYTHM_BADGE_IDS.has(b)) : [];
}
