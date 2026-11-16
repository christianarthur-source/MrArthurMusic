import React from 'react';
import { useDialogBehavior } from './Modal';

/**
 * Friendly replacements for window.alert / window.confirm / window.prompt (audit WP-6.1).
 * They use the same window behaviour as every other pop-up (Escape, focus trap, focus restore) and, unlike the
 * browser boxes, they are styled like the site and are not blocked inside embedded or fullscreen pages.
 *
 *   if (!(await confirmDialog('Delete this song?', { confirmLabel: 'Delete', danger: true }))) return;
 *   await alertDialog('That file is not a song file.');
 *   const name = await promptDialog('Title for this song?', 'My song');   // null when cancelled
 *
 * <AppDialogHost /> must be mounted once (main.tsx). If it is not (a page that does not mount it), the calls fall
 * back to the browser's own boxes, so nothing ever silently does nothing.
 */

type Request =
  | { id: number; kind: 'alert'; message: string; title?: string; resolve: () => void }
  | { id: number; kind: 'confirm'; message: string; title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; resolve: (v: boolean) => void }
  | { id: number; kind: 'prompt'; message: string; title?: string; defaultValue: string; confirmLabel?: string; resolve: (v: string | null) => void };

let nextId = 1;
let queue: Request[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const hasHost = () => listeners.size > 0;

function push(r: Request) {
  queue = [...queue, r];
  emit();
}

export function alertDialog(message: string, opts: { title?: string } = {}): Promise<void> {
  if (!hasHost()) {
    window.alert(message);
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => push({ id: nextId++, kind: 'alert', message, title: opts.title, resolve }));
}

export function confirmDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  if (!hasHost()) return Promise.resolve(window.confirm(message));
  return new Promise<boolean>((resolve) => push({ id: nextId++, kind: 'confirm', message, ...opts, resolve }));
}

export function promptDialog(message: string, defaultValue = '', opts: { title?: string; confirmLabel?: string } = {}): Promise<string | null> {
  if (!hasHost()) return Promise.resolve(window.prompt(message, defaultValue));
  return new Promise<string | null>((resolve) => push({ id: nextId++, kind: 'prompt', message, defaultValue, ...opts, resolve }));
}

function DialogView({ req, done }: { req: Request; done: () => void }) {
  const [value, setValue] = React.useState(req.kind === 'prompt' ? req.defaultValue : '');
  const finished = React.useRef(false);
  const finish = (action: 'ok' | 'cancel') => {
    if (finished.current) return;
    finished.current = true;
    if (req.kind === 'alert') req.resolve();
    else if (req.kind === 'confirm') req.resolve(action === 'ok');
    else req.resolve(action === 'ok' ? value : null);
    done();
  };
  const ref = useDialogBehavior<HTMLDivElement>(() => finish('cancel'), { initialFocus: req.kind === 'prompt' ? 'none' : 'first' });
  const titleId = `app-dialog-${req.id}`;
  const okLabel = req.kind === 'alert' ? 'OK' : (req as { confirmLabel?: string }).confirmLabel || 'OK';
  const danger = req.kind === 'confirm' && req.danger;
  return (
    <div
      ref={ref}
      role={req.kind === 'alert' || danger ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && req.kind !== 'alert') finish('cancel');
      }}
    >
      <form
        className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-5 text-white shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          finish('ok');
        }}
      >
        <h2 id={titleId} className="whitespace-pre-line text-base font-bold leading-snug text-slate-100">
          {req.title || req.message}
        </h2>
        {req.title && <p className="mt-2 whitespace-pre-line text-sm text-slate-300">{req.message}</p>}
        {req.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            aria-labelledby={titleId}
            className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-base text-white outline-none focus:border-amber-400"
          />
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {req.kind !== 'alert' && (
            <button
              type="button"
              onClick={() => finish('cancel')}
              className="min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
            >
              {req.kind === 'confirm' && req.cancelLabel ? req.cancelLabel : 'Cancel'}
            </button>
          )}
          <button
            type="submit"
            className={`min-h-11 rounded-xl px-5 py-2 text-sm font-bold ${danger ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-amber-400 text-slate-900 hover:bg-amber-300'}`}
          >
            {okLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AppDialogHost() {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  const req = queue[0];
  if (!req) return null;
  return (
    <DialogView
      key={req.id}
      req={req}
      done={() => {
        queue = queue.filter((r) => r.id !== req.id);
        emit();
      }}
    />
  );
}
