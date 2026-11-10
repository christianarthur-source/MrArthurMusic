/**
 * Chrome Music Lab EXTRA — Theme & Color Palette Manager
 * Reverse-engineered chromatic palette + Dark Mode default + Custom Theme Studio
 */

export const DEFAULT_CML_NOTES = [
  { pitch: 'C',  semitone: 0,  hex: '#E33059', name: 'Crimson Red' },
  { pitch: 'C#', semitone: 1,  hex: '#F75839', name: 'Vermilion' },
  { pitch: 'D',  semitone: 2,  hex: '#F7943D', name: 'Tangerine' },
  { pitch: 'D#', semitone: 3,  hex: '#F3B72F', name: 'Amber Gold' },
  { pitch: 'E',  semitone: 4,  hex: '#EDD929', name: 'Lemon Yellow' },
  { pitch: 'F',  semitone: 5,  hex: '#95C631', name: 'Lime Green' },
  { pitch: 'F#', semitone: 6,  hex: '#56A754', name: 'Emerald' },
  { pitch: 'G',  semitone: 7,  hex: '#11826D', name: 'Teal' },
  { pitch: 'G#', semitone: 8,  hex: '#3160A3', name: 'Cobalt Blue' },
  { pitch: 'A',  semitone: 9,  hex: '#5B37CC', name: 'Indigo Violet' },
  { pitch: 'A#', semitone: 10, hex: '#A347BF', name: 'Orchid Purple' },
  { pitch: 'B',  semitone: 11, hex: '#EA57B2', name: 'Magenta Pink' }
];

export const PRESET_THEMES = {
  'cml-dark': {
    id: 'cml-dark',
    name: 'Classic CML Dark (Default)',
    mode: 'dark',
    description: 'Authentic Chrome Music Lab 12-tone rainbow on a deep studio dark canvas.',
    bgPrimary: '#0f111a',
    bgSecondary: '#171a26',
    bgCanvas: '#121521',
    bgCanvasAlt: '#191d2d',
    gridLine: 'rgba(255, 255, 255, 0.09)',
    gridBeatLine: 'rgba(255, 255, 255, 0.22)',
    gridBarLine: 'rgba(255, 255, 255, 0.42)',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    accent: '#38bdf8',
    notes: [
      '#E33059', '#F75839', '#F7943D', '#F3B72F',
      '#EDD929', '#95C631', '#56A754', '#11826D',
      '#3160A3', '#5B37CC', '#A347BF', '#EA57B2'
    ],
    kandinsky: {
      line: '#4bb4a1',
      triangle: '#96c43e',
      circle: '#4998b4'
    }
  },
  'neon-synthwave': {
    id: 'neon-synthwave',
    name: 'Neon Synthwave',
    mode: 'dark',
    description: 'High-saturation cyberpunk lasers, electric cyan, hot magenta, and deep midnight purple.',
    bgPrimary: '#090414',
    bgSecondary: '#140929',
    bgCanvas: '#0c051a',
    bgCanvasAlt: '#160b2e',
    gridLine: 'rgba(236, 72, 153, 0.14)',
    gridBeatLine: 'rgba(56, 189, 248, 0.28)',
    gridBarLine: 'rgba(244, 114, 182, 0.55)',
    textPrimary: '#fdf4ff',
    textSecondary: '#d8b4fe',
    accent: '#f43f5e',
    notes: [
      '#ff0055', '#ff3300', '#ff6600', '#ffaa00',
      '#ffee00', '#99ff00', '#00ff66', '#00ffcc',
      '#00ccff', '#3366ff', '#9933ff', '#ff00cc'
    ],
    kandinsky: {
      line: '#00ffcc',
      triangle: '#ff007f',
      circle: '#bd00ff'
    }
  },
  'aurora-borealis': {
    id: 'aurora-borealis',
    name: 'Aurora Borealis',
    mode: 'dark',
    description: 'Nordic night sky with bioluminescent teals, arctic blues, and polar violets.',
    bgPrimary: '#071318',
    bgSecondary: '#0d2129',
    bgCanvas: '#09171d',
    bgCanvasAlt: '#10252e',
    gridLine: 'rgba(45, 212, 191, 0.10)',
    gridBeatLine: 'rgba(56, 189, 248, 0.24)',
    gridBarLine: 'rgba(94, 234, 212, 0.45)',
    textPrimary: '#ecfeff',
    textSecondary: '#7dd3fc',
    accent: '#2dd4bf',
    notes: [
      '#2dd4bf', '#14b8a6', '#06b6d4', '#0ea5e9',
      '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
      '#d946ef', '#ec4899', '#f43f5e', '#10b981'
    ],
    kandinsky: {
      line: '#2dd4bf',
      triangle: '#38bdf8',
      circle: '#a855f7'
    }
  },
  'sunset-lofi': {
    id: 'sunset-lofi',
    name: 'Warm Sunset Lo-Fi',
    mode: 'dark',
    description: 'Cozy dusk aesthetic with warm coral, peach, amber gold, and twilight plum.',
    bgPrimary: '#181016',
    bgSecondary: '#251822',
    bgCanvas: '#1c121a',
    bgCanvasAlt: '#281b25',
    gridLine: 'rgba(251, 146, 60, 0.11)',
    gridBeatLine: 'rgba(251, 146, 60, 0.25)',
    gridBarLine: 'rgba(244, 63, 94, 0.45)',
    textPrimary: '#fff1f2',
    textSecondary: '#fda4af',
    accent: '#fb923c',
    notes: [
      '#f43f5e', '#fb7185', '#f97316', '#fb923c',
      '#f59e0b', '#fbbf24', '#fde047', '#a3e635',
      '#34d399', '#38bdf8', '#818cf8', '#e879f9'
    ],
    kandinsky: {
      line: '#f59447',
      triangle: '#f45941',
      circle: '#f5bd46'
    }
  },
  'pastel-dream': {
    id: 'pastel-dream',
    name: 'Soft Pastel Dark',
    mode: 'dark',
    description: 'Gentle chalk-pastel tones on a slate-charcoal chalkboard for low eye strain.',
    bgPrimary: '#16181d',
    bgSecondary: '#20232a',
    bgCanvas: '#1a1d24',
    bgCanvasAlt: '#22262f',
    gridLine: 'rgba(255, 255, 255, 0.08)',
    gridBeatLine: 'rgba(255, 255, 255, 0.18)',
    gridBarLine: 'rgba(255, 255, 255, 0.35)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    accent: '#a5b4fc',
    notes: [
      '#fda4af', '#fdba74', '#fcd34d', '#fde047',
      '#bef264', '#86efac', '#6ee7b7', '#5eead4',
      '#7dd3fc', '#93c5fd', '#c4b5fd', '#f0abfc'
    ],
    kandinsky: {
      line: '#6ee7b7',
      triangle: '#fcd34d',
      circle: '#93c5fd'
    }
  },
  'amoled-pitch': {
    id: 'amoled-pitch',
    name: 'AMOLED High-Contrast',
    mode: 'dark',
    description: 'Pure #000000 black background with ultra-vivid accessible colors for classroom projectors.',
    bgPrimary: '#000000',
    bgSecondary: '#0d0d0d',
    bgCanvas: '#000000',
    bgCanvasAlt: '#0a0a0a',
    gridLine: 'rgba(255, 255, 255, 0.15)',
    gridBeatLine: 'rgba(255, 255, 255, 0.35)',
    gridBarLine: 'rgba(255, 255, 255, 0.65)',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    accent: '#00e5ff',
    notes: [
      '#ff1744', '#ff5722', '#ff9100', '#ffc400',
      '#ffea00', '#76ff03', '#00e676', '#1de9b6',
      '#00e5ff', '#2979ff', '#651fff', '#f50057'
    ],
    kandinsky: {
      line: '#00e5ff',
      triangle: '#76ff03',
      circle: '#ff1744'
    }
  },
  'cml-light': {
    id: 'cml-light',
    name: 'Original CML Light Mode',
    mode: 'light',
    description: 'The classic white-background Chrome Music Lab appearance for daytime comparison.',
    bgPrimary: '#f8fafc',
    bgSecondary: '#ffffff',
    bgCanvas: '#ffffff',
    bgCanvasAlt: '#f1f5f9',
    gridLine: 'rgba(15, 23, 42, 0.08)',
    gridBeatLine: 'rgba(15, 23, 42, 0.20)',
    gridBarLine: 'rgba(15, 23, 42, 0.38)',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    accent: '#2563eb',
    notes: [
      '#E33059', '#F75839', '#F7943D', '#F3B72F',
      '#EDD929', '#95C631', '#56A754', '#11826D',
      '#3160A3', '#5B37CC', '#A347BF', '#EA57B2'
    ],
    kandinsky: {
      line: '#4bb4a1',
      triangle: '#96c43e',
      circle: '#4998b4'
    }
  }
};

const STORAGE_KEY = 'cml_extra_theme_v1';

class ThemeManager {
  constructor() {
    this.listeners = new Set();
    this.state = this.loadState();
    this.applyToDOM();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.notes) && parsed.notes.length === 12) {
          return parsed;
        }
      }
    } catch (e) {
      // Ignore storage errors
    }
    return JSON.parse(JSON.stringify(PRESET_THEMES['cml-dark']));
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      // Ignore storage errors
    }
  }

  getTheme() {
    return this.state;
  }

  getNoteColor(semitoneOrMidi, alpha = 1) {
    const idx = ((semitoneOrMidi % 12) + 12) % 12;
    const hex = this.state.notes[idx] || DEFAULT_CML_NOTES[idx].hex;
    if (alpha >= 1) return hex;
    return this.hexToRgba(hex, alpha);
  }

  hexToRgba(hex, alpha = 1) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean.length === 3
      ? clean.split('').map(c => c + c).join('')
      : clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  selectPreset(presetId) {
    const preset = PRESET_THEMES[presetId];
    if (!preset) return;
    this.state = JSON.parse(JSON.stringify(preset));
    this.saveState();
    this.applyToDOM();
    this.notify();
  }

  toggleDarkLight() {
    if (this.state.mode === 'light') {
      this.selectPreset('cml-dark');
    } else {
      this.selectPreset('cml-light');
    }
  }

  setNoteColor(index, hex) {
    if (index < 0 || index >= 12) return;
    this.state.id = 'custom';
    this.state.name = 'Custom Palette';
    this.state.notes[index] = hex;
    this.saveState();
    this.applyToDOM();
    this.notify();
  }

  setKandinskyColor(shapeKey, hex) {
    if (!this.state.kandinsky) {
      this.state.kandinsky = { line: '#4bb4a1', triangle: '#96c43e', circle: '#4998b4' };
    }
    this.state.id = 'custom';
    this.state.name = 'Custom Palette';
    this.state.kandinsky[shapeKey] = hex;
    this.saveState();
    this.applyToDOM();
    this.notify();
  }

  setSurfaceColor(key, hex) {
    this.state.id = 'custom';
    this.state.name = 'Custom Palette';
    this.state[key] = hex;
    if (key === 'bgCanvas') {
      // Auto-compute subtle alt bar background
      this.state.bgCanvasAlt = this.adjustBrightness(hex, this.state.mode === 'light' ? -8 : 10);
    }
    this.saveState();
    this.applyToDOM();
    this.notify();
  }

  adjustBrightness(hex, amount) {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const clamp = (v) => Math.max(0, Math.min(255, v));
    const r = clamp(((num >> 16) & 255) + amount);
    const g = clamp(((num >> 8) & 255) + amount);
    const b = clamp((num & 255) + amount);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  resetToDefault() {
    this.selectPreset('cml-dark');
  }

  applyToDOM() {
    const root = document.documentElement;
    const s = this.state;
    root.setAttribute('data-theme-mode', s.mode || 'dark');
    root.style.setProperty('--bg-primary', s.bgPrimary);
    root.style.setProperty('--bg-secondary', s.bgSecondary);
    root.style.setProperty('--bg-canvas', s.bgCanvas);
    root.style.setProperty('--bg-canvas-alt', s.bgCanvasAlt);
    root.style.setProperty('--grid-line', s.gridLine);
    root.style.setProperty('--grid-beat-line', s.gridBeatLine);
    root.style.setProperty('--grid-bar-line', s.gridBarLine);
    root.style.setProperty('--text-primary', s.textPrimary);
    root.style.setProperty('--text-secondary', s.textSecondary);
    root.style.setProperty('--accent', s.accent);

    s.notes.forEach((hex, idx) => {
      root.style.setProperty(`--note-${idx}`, hex);
    });

    if (s.kandinsky) {
      root.style.setProperty('--kandinsky-line', s.kandinsky.line);
      root.style.setProperty('--kandinsky-triangle', s.kandinsky.triangle);
      root.style.setProperty('--kandinsky-circle', s.kandinsky.circle);
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this.state);
      } catch (e) {
        console.error('Theme listener error:', e);
      }
    }
  }
}

export const themeManager = new ThemeManager();
