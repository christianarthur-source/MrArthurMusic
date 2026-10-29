import { Copy, FolderOpen, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteProjectLocal, duplicateProject, importProjectFile, listProjects, loadProjectLocal, ProjectSummary, saveProjectLocal } from '../persistence/projectRepo';
import { Project } from '../model/types';
import { ValidationResult } from '../model/validate';
import { buildTemplate, TEMPLATES } from './templates';
import { LibraryCatalog } from '../library/catalog';
import { cx } from './controls';

/** Project start screen: templates, recent songs, open a file. */
export function StartScreen({
  catalog,
  onOpen,
  onExit,
  studentName,
}: {
  catalog: LibraryCatalog;
  onOpen: (r: ValidationResult, opts?: { tutorial?: boolean; fresh?: boolean }) => void;
  onExit?: () => void;
  studentName?: string;
}) {
  const [recent, setRecent] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tutorial, setTutorial] = useState(true);
  const file = useRef<HTMLInputElement>(null);

  const refresh = () =>
    listProjects()
      .then(setRecent)
      .catch((e: Error) => {
        setRecent([]);
        setError(`Saved songs are unavailable: ${e.message}`);
      });
  useEffect(() => {
    void refresh();
  }, []);

  const start = async (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id)!;
    setBusy(id);
    setError(null);
    try {
      const { project, missing } = await buildTemplate(t, catalog);
      onOpen({ project, warnings: missing.length ? [`No library loop was found for: ${missing.join(', ')}.`] : [] }, { tutorial: tutorial && id === 'blank', fresh: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="daw-scroll h-full overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="daw-display text-4xl text-amber-300">Mr. Arthur&apos;s Studio</h1>
            <p className="mt-1 text-slate-400">{studentName ? `Welcome back, ${studentName}! ` : ''}Make music with real recorded loops, instruments and effects.</p>
          </div>
          {onExit && (
            <button type="button" className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700" onClick={onExit}>
              ← Back to Music Lab
            </button>
          )}
        </div>

        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">Start a new song</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`template-${t.id}`}
              disabled={!!busy}
              onClick={() => void start(t.id)}
              className={cx(
                'group rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-amber-400/60 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-sky-400 disabled:opacity-50',
                t.id === 'blank' && 'border-dashed',
              )}
            >
              <div className="text-3xl">{busy === t.id ? '⏳' : t.emoji}</div>
              <div className="mt-2 daw-display text-lg text-slate-100 group-hover:text-amber-300">{t.name}</div>
              <div className="mt-1 text-xs leading-snug text-slate-400">{t.description}</div>
              {t.id !== 'blank' && <div className="mt-2 font-mono text-[11px] text-slate-500">{t.bpm} BPM</div>}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" className="accent-amber-400" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} />
          Show me how (a 2-minute guided tour when I start an empty song)
        </label>

        <div className="mt-10 mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">My songs on this computer</h2>
          <button type="button" className="flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => file.current?.click()}>
            <FolderOpen size={15} /> Open a project file…
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,.zip,application/json,application/zip"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                onOpen(await importProjectFile(f));
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </div>
        {recent === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">No saved songs yet. Songs save automatically on this computer while you work.</p>
        ) : (
          <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-900/60">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    try {
                      onOpen(await loadProjectLocal(r.id));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : String(err));
                    }
                  }}
                >
                  <div className="truncate font-semibold text-slate-100 hover:text-amber-300">{r.title}</div>
                  <div className="text-xs text-slate-500">Edited {new Date(r.updatedAt).toLocaleString()}</div>
                </button>
                <button
                  type="button"
                  title="Make a copy"
                  aria-label={`Copy ${r.title}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  onClick={async () => {
                    const { project } = await loadProjectLocal(r.id);
                    await saveProjectLocal(duplicateProject(project));
                    void refresh();
                  }}
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  title="Delete"
                  aria-label={`Delete ${r.title}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                  onClick={async () => {
                    if (!confirm(`Delete "${r.title}" from this computer? This cannot be undone.`)) return;
                    await deleteProjectLocal(r.id);
                    void refresh();
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}
        <p className="mt-10 text-xs text-slate-600">
          Songs are saved in this browser. On shared computers, download your song (Export → project .zip) or save to your class account to keep it.
        </p>
      </div>
    </div>
  );
}

export type { Project };
