import { EditorSettings, Project } from './types';

/**
 * Single source of truth for the project document.
 *
 * Projects are immutable values; every edit produces a new object with
 * structural sharing, so undo/redo is a stack of references (cheap) and
 * consumers detect changes by identity.
 *
 * Gestures (drags) update the project transiently and commit one undo step.
 */

export interface HistoryEntry {
  label: string;
  project: Project;
}

type Listener = () => void;

/** View settings: saved with the project, but changing them is never an undo step and Undo/Redo leave them alone. */
export type ViewSettings = Pick<EditorSettings, 'snap' | 'grid' | 'pxPerBeat' | 'trackHeight' | 'metronome' | 'countInBars' | 'followPlayhead'>;
const VIEW_KEYS: (keyof ViewSettings)[] = ['snap', 'grid', 'pxPerBeat', 'trackHeight', 'metronome', 'countInBars', 'followPlayhead'];

/** `target` with the current view settings of `current` carried over. */
function keepView(target: Project, current: Project): Project {
  const editor = { ...target.editor };
  for (const k of VIEW_KEYS) (editor as Record<string, unknown>)[k] = current.editor[k];
  return { ...target, editor };
}

export class ProjectStore {
  private project: Project;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<Listener>();
  private gestureBase: Project | null = null;
  private lastCoalesce: { key: string; at: number } | null = null;
  /** Incremented on every committed change; persistence uses it to detect unsaved edits. */
  revision = 0;
  readonly limit: number;

  constructor(initial: Project, limit = 200) {
    this.project = initial;
    this.limit = limit;
  }

  get = (): Project => this.project;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const l of [...this.listeners]) l();
  }

  /** Replace the document and clear history (open/new project). */
  load(project: Project) {
    this.project = project;
    this.undoStack = [];
    this.redoStack = [];
    this.gestureBase = null;
    this.revision++;
    this.emit();
  }

  /**
   * Apply an undoable edit. Edits with the same coalesceKey within 800 ms merge
   * into one undo step (e.g. typing in a number field, nudging a knob).
   */
  exec(label: string, fn: (p: Project) => Project, coalesceKey?: string): boolean {
    if (this.gestureBase) this.commitGesture(label);
    const before = this.project;
    const after = fn(before);
    if (after === before) return false;
    const now = Date.now();
    const coalesce = coalesceKey && this.lastCoalesce?.key === coalesceKey && now - this.lastCoalesce.at < 800;
    if (!coalesce) this.pushUndo({ label, project: before });
    this.lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
    this.redoStack = [];
    this.project = touch(after);
    this.revision++;
    this.emit();
    return true;
  }

  /**
   * Change zoom / snap / grid / metronome / count-in. These are saved with the song (so it reopens the
   * way it was left) but are not edits: no undo step, and Undo does not zoom the view back or flip Snap.
   */
  setEditor(patch: Partial<ViewSettings>) {
    const apply = (p: Project): Project => ({ ...p, editor: { ...p.editor, ...patch } });
    if (this.gestureBase) this.gestureBase = apply(this.gestureBase);
    const next = apply(this.project);
    if (VIEW_KEYS.every((k) => next.editor[k] === this.project.editor[k])) return;
    this.project = touch(next);
    this.revision++;
    this.emit();
  }

  /** Start a gesture; subsequent preview() calls do not create undo steps. */
  beginGesture() {
    if (!this.gestureBase) this.gestureBase = this.project;
  }

  preview(fn: (base: Project) => Project) {
    if (!this.gestureBase) this.beginGesture();
    const next = fn(this.gestureBase!);
    if (next === this.project) return;
    this.project = next;
    this.emit();
  }

  commitGesture(label: string) {
    const base = this.gestureBase;
    this.gestureBase = null;
    if (!base || base === this.project) return;
    this.pushUndo({ label, project: base });
    this.redoStack = [];
    this.lastCoalesce = null;
    this.project = touch(this.project);
    this.revision++;
    this.emit();
  }

  cancelGesture() {
    if (!this.gestureBase) return;
    this.project = this.gestureBase;
    this.gestureBase = null;
    this.emit();
  }

  get inGesture() {
    return this.gestureBase !== null;
  }

  private pushUndo(e: HistoryEntry) {
    this.undoStack.push(e);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
  }

  /** The current project plus every state undo / redo can still bring back. */
  allProjects(): Project[] {
    return [this.project, ...this.undoStack.map((e) => e.project), ...this.redoStack.map((e) => e.project)];
  }

  canUndo = () => this.undoStack.length > 0;
  canRedo = () => this.redoStack.length > 0;
  undoLabel = () => this.undoStack[this.undoStack.length - 1]?.label;
  redoLabel = () => this.redoStack[this.redoStack.length - 1]?.label;

  undo(): boolean {
    if (this.gestureBase) this.cancelGesture();
    const e = this.undoStack.pop();
    if (!e) return false;
    this.redoStack.push({ label: e.label, project: this.project });
    this.project = keepView(e.project, this.project);
    this.lastCoalesce = null;
    this.revision++;
    this.emit();
    return true;
  }

  redo(): boolean {
    const e = this.redoStack.pop();
    if (!e) return false;
    this.undoStack.push({ label: e.label, project: this.project });
    this.project = keepView(e.project, this.project);
    this.lastCoalesce = null;
    this.revision++;
    this.emit();
    return true;
  }
}

function touch(p: Project): Project {
  return { ...p, updatedAt: new Date().toISOString() };
}
