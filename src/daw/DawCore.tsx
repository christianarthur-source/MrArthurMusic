import { useCallback, useEffect, useRef, useState } from 'react';
import { createProject } from './model/factory';
import { Project } from './model/types';
import { validateProject, ValidationResult } from './model/validate';
import { saveProjectLocal } from './persistence/projectRepo';
import { cx, Modal } from './ui/controls';
import { ExportDialog } from './ui/dialogs/ExportDialog';
import { DiagnosticsDialog } from './ui/dialogs/Diagnostics';
import { RecordDialog, ShortcutsDialog, StorageDialog } from './ui/dialogs/Dialogs';
import { MidiEditor } from './ui/editors/MidiEditor';
import { Inspector } from './ui/Inspector';
import { LibraryPanel } from './ui/LibraryPanel';
import { Mixer } from './ui/Mixer';
import { AudioStatusBanner, ContextMenu, Toasts, Tutorial } from './ui/Overlays';
import { StartScreen } from './ui/StartScreen';
import { HostIntegration, Studio, StudioContext, useStudio, useUi } from './ui/studio';
import { Timeline } from './ui/timeline/Timeline';
import { TopBar } from './ui/TopBar';
import { TrackHeaders } from './ui/TrackHeaders';
import { TransportBar } from './ui/TransportBar';
import { BottomPanel } from './ui/uiStore';
import { useKeyboard, useMidiInput } from './ui/useKeyboard';
import { LibraryCatalog } from './library/catalog';
import './daw.css';

/**
 * Root of the DAW. Props are a superset of the existing site's DawApp props so
 * it can replace src/daw/App.tsx directly (see docs/PORTING.md).
 */
export interface DawAppProps {
  onBackToHub?: () => void;
  studentSession?: { id: string; firstName: string } | null;
  loadedProjectData?: unknown;
  onClearLoadedProjectData?: () => void;
  currentProjectId?: string | null;
  onProjectSaved?: (projectId: string) => void;
  onOpenClassroomModal?: () => void;
  onOpenAvatar?: () => void;
  /** Optional: cloud save provided by the host (classroom accounts). */
  cloudSave?: HostIntegration['cloudSave'];
  cloudLabel?: string;
  /** Optional: host text filter (e.g. profanity filter). */
  textFilter?: (text: string) => boolean;
  /** Where the loop library is served from. */
  libraryRoot?: string;
}

export function DawApp(props: DawAppProps) {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [screen, setScreen] = useState<'start' | 'studio'>('start');
  const [catalog, setCatalog] = useState<LibraryCatalog | null>(null);
  const studioRef = useRef<Studio | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const hostRef = useRef<HostIntegration>({});
  hostRef.current.cloudSave = props.cloudSave;
  hostRef.current.cloudLabel = props.cloudLabel;
  hostRef.current.textFilter = props.textFilter;
  hostRef.current.onExit = props.onBackToHub;

  // Objects with workers/audio are created in effects so StrictMode's simulated
  // unmount cannot dispose them while still in use.
  const libraryRoot = props.libraryRoot ?? '/daw-library/';
  useEffect(() => {
    const c = new LibraryCatalog(libraryRoot);
    setCatalog(c);
    return () => c.dispose();
  }, [libraryRoot]);
  // Release audio (AudioContext, workers) when leaving the DAW route.
  useEffect(
    () => () => {
      void studioRef.current?.dispose();
      studioRef.current = null;
    },
    [],
  );

  const open = useCallback(
    (r: ValidationResult, opts: { tutorial?: boolean; fresh?: boolean } = {}) => {
      let st = studio;
      if (!st) {
        if (!catalog) return;
        st = new Studio(r.project, hostRef.current, catalog);
        studioRef.current = st;
        setStudio(st);
        // Dev-only handle for browser tests/diagnostics; stripped from production builds.
        if (import.meta.env.DEV) (window as unknown as { __daw: Studio }).__daw = st;
        st.ui.set({ selectedTrack: r.project.tracks[0]?.id ?? null });
      } else st.loadProject(r.project);
      if (opts.fresh) {
        // New songs are saved right away so they show up in "My songs".
        void saveProjectLocal(r.project).then(() => st!.autosave.markSaved());
      }
      st.ui.set({ tutorialStep: opts.tutorial ? 0 : null });
      setWarnings(r.warnings);
      setScreen('studio');
    },
    [studio, catalog],
  );

  // Project handed over by the host (classroom portal / shared link)
  const { loadedProjectData, onClearLoadedProjectData } = props;
  useEffect(() => {
    if (!loadedProjectData || !catalog) return;
    try {
      open(validateProject(loadedProjectData));
    } catch (err) {
      setWarnings([err instanceof Error ? err.message : 'This project could not be opened.']);
    }
    onClearLoadedProjectData?.();
  }, [loadedProjectData, catalog]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="daw-root fixed inset-0 flex flex-col bg-slate-950  text-slate-100">
      {!catalog ? null : screen === 'start' || !studio ? (
        <StartScreen catalog={catalog} onOpen={open} onExit={props.onBackToHub} studentName={props.studentSession?.firstName} />
      ) : (
        <StudioContext.Provider value={studio}>
          <StudioView
            onHome={async () => {
              await studio.autosave.flush();
              studio.engine.stop();
              studio.preview.stop();
              setScreen('start');
            }}
            currentProjectId={props.currentProjectId ?? null}
            onProjectSaved={props.onProjectSaved}
            onNeedLogin={props.onOpenClassroomModal}
          />
        </StudioContext.Provider>
      )}
      {warnings.length > 0 && (
        <Modal title="Heads up" onClose={() => setWarnings([])}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button type="button" className="mt-4 rounded-lg bg-amber-400 px-4 py-1.5 font-semibold text-slate-950" onClick={() => setWarnings([])}>
            OK
          </button>
        </Modal>
      )}
    </div>
  );
}

function StudioView({ onHome, currentProjectId, onProjectSaved, onNeedLogin }: { onHome: () => void; currentProjectId: string | null; onProjectSaved?: (id: string) => void; onNeedLogin?: () => void }) {
  const s = useStudio();
  const dialog = useUi((u) => u.dialog);
  const libraryOpen = useUi((u) => u.libraryOpen);
  const libraryWidth = useUi((u) => u.libraryWidth);
  const bottom = useUi((u) => u.bottom);
  const bottomHeight = useUi((u) => u.bottomHeight);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100);
  useEffect(() => {
    const h = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const save = useCallback(async () => {
    await s.autosave.flush();
    if (s.autosave.status === 'error') {
      s.ui.toast('error', `Could not save on this computer: ${s.autosave.lastError}. Download your song from Export to keep it.`);
      return;
    }
    const cloud = s.host.cloudSave;
    if (!cloud) {
      s.ui.toast('success', 'Saved on this computer.');
      return;
    }
    try {
      const r = await cloud(s.store.get());
      if (r.ok) s.ui.toast('success', r.message ?? `Saved to ${s.host.cloudLabel ?? 'your account'}.`);
      else {
        s.ui.toast('warn', r.message ?? 'Saved on this computer. Log in to save to your class account.');
        onNeedLogin?.();
      }
    } catch (err) {
      s.ui.toast('error', `Saved on this computer, but the class account save failed: ${err instanceof Error ? err.message : err}`);
    }
  }, [s, onNeedLogin]);
  void currentProjectId;
  void onProjectSaved;

  useKeyboard(s, dialog === 'none', () => void save());
  useMidiInput(s, true);

  const close = () => s.ui.set({ dialog: 'none' });

  return (
    <>
      <TopBar onHome={onHome} onSave={() => void save()} cloudLabel={s.host.cloudSave ? s.host.cloudLabel ?? 'class account' : undefined} />
      <AudioStatusBanner />
      <TransportBar />
      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <TrackHeaders />
            <Timeline />
          </div>
          <BottomDock bottom={bottom} height={bottomHeight} />
        </div>
        {libraryOpen && (
          <div className={cx('flex min-h-0 shrink-0 border-l border-slate-800', narrow && 'absolute inset-y-0 right-0 z-40 shadow-2xl')} style={{ width: libraryWidth }}>
            <Resizer
              onDrag={(dx) => s.ui.set({ libraryWidth: Math.min(520, Math.max(260, s.ui.get().libraryWidth - dx)) })}
              vertical
            />
            <div className="min-w-0 flex-1">
              <LibraryPanel />
            </div>
          </div>
        )}
      </div>
      {dialog === 'export' && <ExportDialog onClose={close} />}
      {dialog === 'shortcuts' && <ShortcutsDialog onClose={close} />}
      {dialog === 'diagnostics' && <DiagnosticsDialog onClose={close} />}
      {dialog === 'record' && <RecordDialog onClose={close} />}
      {dialog === 'storage' && <StorageDialog onClose={close} />}
      {dialog === 'about' && <AboutDialog onClose={close} />}
      <ContextMenu />
      <Toasts />
      <Tutorial />
    </>
  );
}

const TABS: { id: BottomPanel; label: string; key: string }[] = [
  { id: 'inspector', label: 'Clip & Effects', key: 'I' },
  { id: 'editor', label: 'Note Editor', key: 'X' },
  { id: 'mixer', label: 'Mixer', key: 'M' },
];

function BottomDock({ bottom, height }: { bottom: BottomPanel; height: number }) {
  const s = useStudio();
  return (
    <div className="flex shrink-0 flex-col border-t border-slate-800 bg-slate-900" style={{ height: bottom === 'none' ? undefined : height }}>
      {bottom !== 'none' && <Resizer onDrag={(_dx, dy) => s.ui.set({ bottomHeight: Math.min(window.innerHeight * 0.65, Math.max(160, s.ui.get().bottomHeight - dy)) })} />}
      <div className="flex shrink-0 items-center gap-1 px-2 py-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={bottom === t.id}
            title={`${t.label} (${t.key})`}
            className={cx('rounded-lg px-3 py-1 text-xs font-semibold', bottom === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}
            onClick={() => s.ui.set({ bottom: bottom === t.id ? 'none' : t.id })}
          >
            {t.label}
          </button>
        ))}
        {bottom !== 'none' && (
          <button type="button" className="ml-auto rounded px-2 text-xs text-slate-500 hover:text-white" onClick={() => s.ui.set({ bottom: 'none' })}>
            Hide ▾
          </button>
        )}
      </div>
      {bottom !== 'none' && (
        <div className="min-h-0 flex-1 overflow-hidden" role="tabpanel">
          {bottom === 'inspector' && <Inspector />}
          {bottom === 'editor' && <MidiEditor />}
          {bottom === 'mixer' && <Mixer />}
        </div>
      )}
    </div>
  );
}

function Resizer({ onDrag, vertical }: { onDrag: (dx: number, dy: number) => void; vertical?: boolean }) {
  const last = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cx('shrink-0 bg-slate-800 hover:bg-amber-400/60', vertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize')}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!last.current) return;
        onDrag(e.clientX - last.current.x, e.clientY - last.current.y);
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
    />
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const project = s.store.get();
  const credits = Object.values(project.assets).filter((a) => a.ref.kind === 'library');
  return (
    <Modal title="About & sound credits" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p>Mr. Arthur&apos;s Studio — a browser DAW for music students. Audio is processed on your computer; nothing is uploaded unless you save to a class account.</p>
        <h3 className="font-semibold text-slate-100">Loops used in this song</h3>
        {credits.length === 0 ? (
          <p className="text-slate-500">No library loops yet.</p>
        ) : (
          <ul className="max-h-60 space-y-1 overflow-auto text-xs">
            {credits.map((a) => (
              <li key={a.id}>
                <b>{a.name}</b> — license: {a.license ?? 'unknown'}
                {a.attribution ? ` · ${a.attribution}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Convenience for embedding/tests. */
export function newEmptyProject(): Project {
  return createProject();
}

export default DawApp;
