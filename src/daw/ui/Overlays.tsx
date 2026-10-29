import { X } from 'lucide-react';
import { useEffect } from 'react';
import { cx } from './controls';
import { useProject, useStudio, useSubscribe, useUi } from './studio';

export function ContextMenu() {
  const s = useStudio();
  const menu = useUi((u) => u.menu);
  useEffect(() => {
    if (!menu) return;
    const close = () => s.ui.set({ menu: null });
    window.addEventListener('pointerdown', close);
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('blur', close);
    };
  }, [menu, s]);
  if (!menu) return null;
  const x = Math.min(menu.x, window.innerWidth - 230);
  const y = Math.min(menu.y, window.innerHeight - menu.items.length * 32 - 16);
  return (
    <div role="menu" className="fixed z-[90] w-56 rounded-xl border border-slate-700 bg-slate-900 p-1 text-sm shadow-2xl" style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      {menu.items.map((it, i) =>
        it.separator ? (
          <div key={i} className="my-1 h-px bg-slate-800" />
        ) : (
          <button
            key={i}
            role="menuitem"
            type="button"
            disabled={it.disabled}
            className={cx('flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left disabled:opacity-40', it.danger ? 'text-rose-300 hover:bg-rose-500/15' : 'text-slate-200 hover:bg-slate-800')}
            onClick={() => {
              s.ui.set({ menu: null });
              it.run?.();
            }}
          >
            {it.label}
            {it.shortcut && <span className="text-xs text-slate-500">{it.shortcut}</span>}
          </button>
        ),
      )}
    </div>
  );
}

export function Toasts() {
  const s = useStudio();
  const toasts = useUi((u) => u.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl px-4 py-2 text-sm shadow-xl ring-1',
            t.kind === 'error' ? 'bg-rose-950 text-rose-100 ring-rose-500/50' : t.kind === 'warn' ? 'bg-amber-950 text-amber-100 ring-amber-500/40' : t.kind === 'success' ? 'bg-emerald-950 text-emerald-100 ring-emerald-500/40' : 'bg-slate-800 text-slate-100 ring-slate-600',
          )}
        >
          <span>{t.text}</span>
          {t.action && (
            <button type="button" className="font-semibold underline" onClick={() => { t.action!.run(); s.ui.dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="opacity-60 hover:opacity-100" onClick={() => s.ui.dismiss(t.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/** Shown when the audio clock stops unexpectedly (tab suspended, device change). */
export function AudioStatusBanner() {
  const s = useStudio();
  const status = useSubscribe((fn) => s.engine.subscribe(fn), () => s.engine.status);
  if (status === 'ok') return null;
  return (
    <div className="flex items-center justify-center gap-3 bg-rose-900/80 px-3 py-1.5 text-sm text-rose-100" role="alert">
      {status === 'closed' || status === 'error' ? 'Audio stopped working. Reload the page to continue (your song is saved).' : 'Audio is paused by the browser.'}
      {status !== 'closed' && (
        <button type="button" className="rounded-lg bg-rose-100 px-3 py-0.5 font-semibold text-rose-900" onClick={() => void s.engine.unlock()}>
          Resume audio
        </button>
      )}
    </div>
  );
}

interface Step {
  title: string;
  body: string;
  done: (ctx: { tracks: number; regions: number; playing: boolean; effects: number }) => boolean;
}

const STEPS: Step[] = [
  { title: '1. Find a drum loop', body: 'In the Loop Library, tap 🥁 Drums, then press ▶ on a few sounds to hear them.', done: () => false },
  { title: '2. Add it to your song', body: 'Drag a loop onto the big timeline (or press + on it).', done: (c) => c.regions > 0 },
  { title: '3. Press play', body: 'Press the ▶ button or the Space bar. The yellow line shows where you are.', done: (c) => c.playing },
  { title: '4. Add more layers', body: 'Add a bass and a keys or guitar loop under your drums. Loops follow the song tempo automatically.', done: (c) => c.tracks >= 3 },
  { title: '5. Make it longer', body: 'Drag the right edge of a loop to repeat it. Use Ctrl+D to duplicate.', done: () => false },
  { title: '6. Add an effect', body: 'Select a track and open "Clip & Effects" at the bottom. Try the "Big Drums" preset!', done: (c) => c.effects > 0 },
  { title: '🎉 You made a song!', body: 'Save it (Ctrl+S) and use Export to download it as a WAV file.', done: () => false },
];

export function Tutorial() {
  const s = useStudio();
  const step = useUi((u) => u.tutorialStep);
  const tracks = useProject((p) => p.tracks.length);
  const regions = useProject((p) => p.regions.length);
  const effects = useProject((p) => p.tracks.reduce((n, t) => n + t.effects.length, 0));
  const playing = useSubscribe((fn) => s.engine.subscribe(fn), () => s.engine.state === 'playing');
  useEffect(() => {
    if (step === null) return;
    const cur = STEPS[step];
    if (cur?.done({ tracks, regions, playing, effects })) {
      const t = setTimeout(() => s.ui.set({ tutorialStep: Math.min(STEPS.length - 1, step + 1) }), 600);
      return () => clearTimeout(t);
    }
  }, [step, tracks, regions, playing, effects, s]);
  if (step === null) return null;
  const cur = STEPS[step];
  return (
    <div className="fixed bottom-6 right-6 z-[80] w-80 rounded-2xl border border-amber-400/50 bg-slate-900/95 p-4 shadow-2xl" role="dialog" aria-label="Tutorial">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="daw-display text-lg text-amber-300">{cur.title}</h3>
        <button type="button" aria-label="Close tutorial" className="text-slate-400 hover:text-white" onClick={() => s.ui.set({ tutorialStep: null })}>
          <X size={16} />
        </button>
      </div>
      <p className="text-sm text-slate-200">{cur.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Step {step + 1} of {STEPS.length}
        </span>
        <div className="flex gap-2">
          {step > 0 && (
            <button type="button" className="rounded-lg bg-slate-800 px-3 py-1 text-sm" onClick={() => s.ui.set({ tutorialStep: step - 1 })}>
              Back
            </button>
          )}
          <button type="button" className="rounded-lg bg-amber-400 px-3 py-1 text-sm font-semibold text-slate-950" onClick={() => s.ui.set({ tutorialStep: step + 1 < STEPS.length ? step + 1 : null })}>
            {step + 1 < STEPS.length ? 'Next' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
