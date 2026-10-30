import { createContext, useContext, useSyncExternalStore } from 'react';
import { AudioEngine } from '../engine/engine';
import { InputRecorder } from '../engine/recorder';
import { LibraryCatalog } from '../library/catalog';
import { PreviewPlayer } from '../library/preview';
import { Project } from '../model/types';
import { ProjectStore } from '../model/store';
import { Autosaver } from '../persistence/projectRepo';
import { UiState, UiStore } from './uiStore';
import { ClipboardData } from '../model/ops';
import { LiveInput } from './liveInput';

/**
 * Everything one open studio needs. Created once per DAW mount; the audio
 * engine is independent of React and is driven by store subscriptions.
 */
export interface HostIntegration {
  /** Optional cloud save provided by the host site (classroom accounts). */
  cloudSave?: (project: Project) => Promise<{ ok: boolean; message?: string }>;
  cloudLabel?: string;
  /** Host-provided text filter (e.g. the site's profanity filter). Return false to reject. */
  textFilter?: (text: string) => boolean;
  onExit?: () => void;
  /** Host-provided short share link (e.g. the site's ?s= links). Without it the DAW makes a long self-contained link. */
  share?: (project: Project) => Promise<{ url: string } | null>;
}

export class Studio {
  readonly store: ProjectStore;
  readonly ui = new UiStore();
  readonly engine: AudioEngine;
  readonly catalog: LibraryCatalog;
  readonly autosave: Autosaver;
  readonly preview: PreviewPlayer;
  readonly recorder: InputRecorder;
  readonly live: LiveInput;
  clipboard: ClipboardData | null = null;
  private unsub: (() => void)[] = [];

  /** The catalog is owned by the caller (shared with the start screen). */
  constructor(
    project: Project,
    readonly host: HostIntegration,
    catalog: LibraryCatalog,
  ) {
    this.store = new ProjectStore(project);
    this.catalog = catalog;
    this.engine = new AudioEngine(project, this.catalog);
    this.preview = new PreviewPlayer(this.engine.ctx, this.catalog, this.engine.assets);
    this.recorder = new InputRecorder(this.engine.ctx);
    this.live = new LiveInput(this);
    this.autosave = new Autosaver(
      () => this.store.get(),
      () => this.store.revision,
    );
    this.autosave.markSaved();
    // Tell the student once per file when audio cannot be loaded (the clip stays, silent).
    const reported = new Set<string>();
    this.unsub.push(
      this.engine.assets.subscribe((assetId) => {
        const err = this.engine.assets.error(assetId);
        if (!err || reported.has(assetId)) return;
        reported.add(assetId);
        this.ui.toast('warn', `${err.message} Its clips will be silent — you can delete them or drag in a replacement.`);
      }),
    );
    this.unsub.push(
      this.store.subscribe(() => {
        const p = this.store.get();
        this.engine.setProject(p);
        if (!this.store.inGesture) this.autosave.notifyChange();
        this.pruneSelection(p);
      }),
    );
  }

  /** Drop selections that refer to deleted things (after undo, delete, etc.). */
  private pruneSelection(p: Project) {
    const s = this.ui.get();
    const ids = new Set(p.regions.map((r) => r.id));
    const sel = s.selectedRegions.filter((id) => ids.has(id));
    const patch: Partial<UiState> = {};
    if (sel.length !== s.selectedRegions.length) patch.selectedRegions = sel;
    if (s.editRegion && !ids.has(s.editRegion)) patch.editRegion = null;
    if (s.selectedTrack && !p.tracks.some((t) => t.id === s.selectedTrack)) patch.selectedTrack = null;
    if (Object.keys(patch).length) this.ui.set(patch);
  }

  loadProject(p: Project) {
    this.engine.stop();
    this.engine.seek(0);
    this.store.load(p);
    this.ui.set({ selectedRegions: [], selectedNotes: [], editRegion: null, selectedTrack: p.tracks[0]?.id ?? null, scrollX: 0, scrollY: 0 });
    this.autosave.markSaved();
  }

  async dispose() {
    for (const u of this.unsub) u();
    this.live.allNotesOff();
    await this.autosave.flush();
    this.autosave.dispose();
    this.preview.stop();
    this.recorder.close();
    await this.engine.dispose();
  }
}

export const StudioContext = createContext<Studio | null>(null);

export function useStudio(): Studio {
  const s = useContext(StudioContext);
  if (!s) throw new Error('useStudio outside StudioContext');
  return s;
}

export function useProject<T>(sel: (p: Project) => T): T {
  const s = useStudio();
  return useSyncExternalStore(s.store.subscribe, () => sel(s.store.get()));
}

export function useUi<T>(sel: (u: UiState) => T): T {
  const s = useStudio();
  return useSyncExternalStore(s.ui.subscribe, () => sel(s.ui.get()));
}

export function useEngineState() {
  const s = useStudio();
  return useSyncExternalStore(
    (fn) => s.engine.subscribe(fn),
    () => `${s.engine.state}|${s.engine.status}`,
  );
}

export function useSubscribe<T>(subscribe: (fn: () => void) => () => void, get: () => T): T {
  return useSyncExternalStore(subscribe, get);
}
