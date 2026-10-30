/**
 * Editor/view state that is NOT part of the document (not undoable, not saved
 * in the project): selection, tool, panels, scroll, modes, notifications.
 */

export type Tool = 'pointer' | 'split' | 'draw';
export type BottomPanel = 'none' | 'inspector' | 'editor' | 'mixer' | 'keyboard';
export type Dialog = 'none' | 'export' | 'shortcuts' | 'diagnostics' | 'record' | 'open' | 'storage' | 'about' | 'share' | 'video';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warn' | 'error';
  text: string;
  action?: { label: string; run: () => void };
}

export interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  run?: () => void;
  separator?: boolean;
}

export interface UiState {
  menu: { x: number; y: number; items: MenuItem[] } | null;
  selectedRegions: string[];
  selectedTrack: string | null;
  selectedNotes: string[];
  editRegion: string | null; // region open in the piano roll / step editor
  tool: Tool;
  libraryOpen: boolean;
  inspectorOpen: boolean;
  bottom: BottomPanel;
  bottomHeight: number;
  libraryWidth: number;
  dialog: Dialog;
  /** The floating video window (only when the song has a video). */
  videoWindow: boolean;
  /** Full-screen Theater Mode: the video with the song's music. */
  theater: boolean;
  /** A long job in progress (import, adding a video): shown as a progress bar. progress null = working, length unknown. */
  task: { label: string; progress: number | null } | null;
  beginner: boolean;
  toasts: Toast[];
  scrollX: number; // px
  scrollY: number; // px
  timelineWidth: number;
  dropHint: { tick: number; trackId: string | null; valid: boolean; label: string } | null;
  tutorialStep: number | null;
  recording: boolean;
  previewingId: string | null;
}

const LS_KEY = 'mrdaw.ui.v1';

function loadPrefs(): Partial<UiState> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<UiState>) : {};
  } catch {
    return {};
  }
}

export class UiStore {
  private s: UiState;
  private listeners = new Set<() => void>();
  private toastId = 0;

  constructor() {
    const prefs = loadPrefs();
    this.s = {
      menu: null,
      selectedRegions: [],
      selectedTrack: null,
      selectedNotes: [],
      editRegion: null,
      tool: 'pointer',
      libraryOpen: prefs.libraryOpen ?? true,
      inspectorOpen: prefs.inspectorOpen ?? true,
      bottom: 'none',
      bottomHeight: Math.min(480, Math.max(180, prefs.bottomHeight ?? 260)),
      libraryWidth: Math.min(520, Math.max(260, prefs.libraryWidth ?? 320)),
      dialog: 'none',
      videoWindow: true,
      theater: false,
      task: null,
      beginner: prefs.beginner ?? true,
      toasts: [],
      scrollX: 0,
      scrollY: 0,
      timelineWidth: 800,
      dropHint: null,
      tutorialStep: null,
      recording: false,
      previewingId: null,
    };
  }

  get = () => this.s;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  set(patch: Partial<UiState>) {
    this.s = { ...this.s, ...patch };
    if ('libraryOpen' in patch || 'inspectorOpen' in patch || 'beginner' in patch || 'bottomHeight' in patch || 'libraryWidth' in patch) {
      try {
        const { libraryOpen, inspectorOpen, beginner, bottomHeight, libraryWidth } = this.s;
        localStorage.setItem(LS_KEY, JSON.stringify({ libraryOpen, inspectorOpen, beginner, bottomHeight, libraryWidth }));
      } catch {
        /* storage disabled: preferences are per-session */
      }
    }
    for (const l of this.listeners) l();
  }

  toast(kind: Toast['kind'], text: string, action?: Toast['action'], ms = kind === 'error' ? 8000 : 4000) {
    const id = ++this.toastId;
    this.set({ toasts: [...this.s.toasts.slice(-3), { id, kind, text, action }] });
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.set({ toasts: this.s.toasts.filter((t) => t.id !== id) });
  }
}
