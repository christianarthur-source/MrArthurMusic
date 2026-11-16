import { useEffect, useReducer } from 'react';
import { Modal } from './controls';

/**
 * In-app replacement for window.confirm (audit WP-6.1): same Escape / focus behaviour as every other DAW window.
 * `askConfirm()` resolves true/false. <AskHost /> must be mounted once; without it the browser's confirm() is used.
 */
interface Req {
  id: number;
  message: string;
  title: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (v: boolean) => void;
}
let nextId = 1;
let queue: Req[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function askConfirm(message: string, opts: { title?: string; confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(window.confirm(message));
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { id: nextId++, message, title: opts.title ?? 'Are you sure?', confirmLabel: opts.confirmLabel ?? 'OK', danger: !!opts.danger, resolve }];
    emit();
  });
}

export function AskHost() {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    listeners.add(force);
    return () => {
      listeners.delete(force);
    };
  }, []);
  const req = queue[0];
  if (!req) return null;
  const done = (v: boolean) => {
    req.resolve(v);
    queue = queue.filter((r) => r.id !== req.id);
    emit();
  };
  return (
    <Modal key={req.id} title={req.title} onClose={() => done(false)}>
      <p className="mb-5 whitespace-pre-line text-sm text-slate-300">{req.message}</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="min-h-10 rounded-lg border border-slate-600 bg-slate-800 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-700" onClick={() => done(false)}>
          Cancel
        </button>
        <button
          type="button"
          className={`min-h-10 rounded-lg px-4 text-sm font-bold ${req.danger ? 'bg-rose-500 text-white hover:bg-rose-400' : 'bg-amber-400 text-slate-900 hover:bg-amber-300'}`}
          onClick={() => done(true)}
        >
          {req.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
