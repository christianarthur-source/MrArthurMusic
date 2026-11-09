import { CSSProperties, useSyncExternalStore } from 'react';
import { COLORS } from './timeline/draw';

/**
 * Light/dark theme and accent color for the DAW. A student's choice is remembered on this
 * computer (localStorage). Colors work by swapping Tailwind's color variables inside
 * `.daw-root` (see daw.css), so a theme change costs one style recalculation and nothing while
 * the DAW runs; canvases read `COLORS`, which `applyCanvasTheme` refills.
 */

export type ThemeMode = 'dark' | 'light';

export interface ThemePrefs {
  mode: ThemeMode;
  accent: string; // #rrggbb
}

export const DEFAULT_ACCENT = '#fbbf24';

export const ACCENTS: { name: string; hex: string }[] = [
  { name: 'Gold', hex: '#fbbf24' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Coral', hex: '#fb7185' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Violet', hex: '#a78bfa' },
  { name: 'Sky', hex: '#38bdf8' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Lime', hex: '#a3e635' },
];

const LS_KEY = 'mrdaw.theme';
const HEX_RE = /^#[0-9a-f]{6}$/i;

function load(): ThemePrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') as Partial<ThemePrefs>;
    return { mode: raw.mode === 'light' ? 'light' : 'dark', accent: typeof raw.accent === 'string' && HEX_RE.test(raw.accent) ? raw.accent : DEFAULT_ACCENT };
  } catch {
    return { mode: 'dark', accent: DEFAULT_ACCENT };
  }
}

let prefs = load();
const listeners = new Set<() => void>();

export function getTheme(): ThemePrefs {
  return prefs;
}

export function setTheme(patch: Partial<ThemePrefs>) {
  const accent = patch.accent && HEX_RE.test(patch.accent) ? patch.accent.toLowerCase() : prefs.accent;
  prefs = { mode: patch.mode ?? prefs.mode, accent };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode: the choice lasts until the page closes */
  }
  applyCanvasTheme(prefs);
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTheme(): ThemePrefs {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
}

/** 0..1 perceived brightness of a #rrggbb color. */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Accent buttons use dark text, so a very dark custom accent is lifted toward white until that
 * text stays readable.
 */
export function readableAccent(hex: string): string {
  if (!HEX_RE.test(hex)) return DEFAULT_ACCENT;
  let n = parseInt(hex.slice(1), 16);
  for (let i = 0; i < 10 && luminance(`#${n.toString(16).padStart(6, '0')}`) < 0.3; i++) {
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    n = (Math.round(r + (255 - r) * 0.2) << 16) | (Math.round(g + (255 - g) * 0.2) << 8) | Math.round(b + (255 - b) * 0.2);
  }
  return `#${n.toString(16).padStart(6, '0')}`;
}

const mix = (c: string, pct: number, other: 'white' | 'black') => `color-mix(in oklab, ${c} ${pct}%, ${other})`;

/** Attributes for `.daw-root`: the theme name and, for a custom accent, the accent color scale. */
export function themeRootProps(p: ThemePrefs): { 'data-theme': ThemeMode; style: CSSProperties } {
  const style: Record<string, string> = {};
  if (p.accent !== DEFAULT_ACCENT) {
    const a = readableAccent(p.accent);
    style['--color-amber-400'] = a;
    style['--color-amber-500'] = mix(a, 82, 'black');
    style['--color-amber-950'] = p.mode === 'dark' ? mix(a, 22, 'black') : mix(a, 12, 'white');
    if (p.mode === 'dark') {
      style['--color-amber-300'] = mix(a, 72, 'white');
      style['--color-amber-200'] = mix(a, 50, 'white');
      style['--color-amber-100'] = mix(a, 30, 'white');
    } else {
      // On light backgrounds accent-colored text must be darker to stay readable.
      style['--color-amber-300'] = mix(a, 58, 'black');
      style['--color-amber-200'] = mix(a, 48, 'black');
      style['--color-amber-100'] = mix(a, 40, 'black');
    }
  }
  return { 'data-theme': p.mode, style: style as CSSProperties };
}

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const DARK = {
  bg: '#0b1220',
  rowA: '#0f172a',
  rowB: '#111c33',
  lane: '#0c1528',
  rowLine: 'rgba(0,0,0,0.35)',
  bar: 'rgba(148,163,184,0.28)',
  beat: 'rgba(148,163,184,0.12)',
  sub: 'rgba(148,163,184,0.05)',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  select: '#ffffff',
  ruler: '#0a0f1c',
  rulerTick: 'rgba(148,163,184,0.35)',
  rulerLine: 'rgba(0,0,0,0.5)',
  rollBg: '#0b1220',
  rollWhite: '#111b31',
  rollBlack: '#0c1426',
  rollTonic: '#1c2a4a',
  rollInKey: '#15223d',
  rollOutKey: '#090f1c',
  rollOutKeyLocked: '#05080f',
  rollOctave: 'rgba(148,163,184,0.25)',
  rollEnd: 'rgba(0,0,0,0.45)',
  keyWhite: '#e2e8f0',
  keyBlack: '#1e293b',
  keyLabel: '#0f172a',
  velBg: '#070b14',
  velLabel: '#64748b',
};

const LIGHT: typeof DARK = {
  bg: '#e9eef5',
  rowA: '#ffffff',
  rowB: '#f6f8fb',
  lane: '#eef2f7',
  rowLine: 'rgba(15,23,42,0.10)',
  bar: 'rgba(51,65,85,0.32)',
  beat: 'rgba(51,65,85,0.14)',
  sub: 'rgba(51,65,85,0.06)',
  text: '#0f172a',
  textDim: '#475569',
  select: '#0f172a',
  ruler: '#f1f5f9',
  rulerTick: 'rgba(51,65,85,0.35)',
  rulerLine: 'rgba(15,23,42,0.18)',
  rollBg: '#f1f5f9',
  rollWhite: '#ffffff',
  rollBlack: '#eef2f7',
  rollTonic: '#fff3d1',
  rollInKey: '#ffffff',
  rollOutKey: '#e5e9f0',
  rollOutKeyLocked: '#d6dce6',
  rollOctave: 'rgba(51,65,85,0.25)',
  rollEnd: 'rgba(15,23,42,0.10)',
  keyWhite: '#ffffff',
  keyBlack: '#334155',
  keyLabel: '#0f172a',
  velBg: '#e2e8f0',
  velLabel: '#475569',
};

/** Fill the canvas palette for the theme. Canvases pick it up on their next draw. */
export function applyCanvasTheme(p: ThemePrefs) {
  const accent = readableAccent(p.accent);
  Object.assign(COLORS, p.mode === 'light' ? LIGHT : DARK, {
    accent,
    loop: rgba(accent, p.mode === 'light' ? 0.12 : 0.07),
    loopEdge: rgba(accent, p.mode === 'light' ? 0.8 : 0.55),
    loopBar: rgba(accent, 0.85),
    accentSoft: rgba(accent, 0.35),
    dropOk: rgba(accent, 0.18),
  });
}

applyCanvasTheme(prefs);
