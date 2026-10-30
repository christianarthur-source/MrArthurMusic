import { ReactNode, useEffect, useRef, useState } from 'react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function IconButton({
  label,
  onClick,
  active,
  children,
  className,
  disabled,
  tone = 'default',
  shortcut,
  testId,
  size = 'md',
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'danger' | 'record' | 'play';
  shortcut?: string;
  testId?: string;
  /** lg: the big transport buttons. */
  size?: 'md' | 'lg';
}) {
  return (
    <button
      type="button"
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        size === 'lg' ? 'h-11 min-w-11 rounded-xl px-2.5 text-base' : 'h-8 min-w-8 rounded-lg px-2 text-sm',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
        active
          ? tone === 'record'
            ? 'bg-rose-500 text-white'
            : 'bg-amber-400 text-slate-950'
          : tone === 'play'
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            : tone === 'accent'
            ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
            : tone === 'danger'
              ? 'text-rose-300 hover:bg-rose-500/20'
              : tone === 'record'
                ? size === 'lg'
                  ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/30'
                  : 'text-rose-400 hover:bg-rose-500/20'
                : 'text-slate-200 hover:bg-slate-700/70',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SmallToggle({ label, title, active, onClick, color }: { label: string; title: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        'h-6 w-6 rounded-md text-[11px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-sky-400',
        active ? `${color} text-slate-950` : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200',
      )}
    >
      {label}
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  label,
  format,
  className,
  vertical,
  defaultValue,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  label: string;
  format?: (v: number) => string;
  className?: string;
  vertical?: boolean;
  defaultValue?: number;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      title={`${label}: ${format ? format(value) : value}${defaultValue !== undefined ? ' (double-click to reset)' : ''}`}
      aria-valuetext={format ? format(value) : String(value)}
      className={cx('daw-range', vertical && 'daw-range-vertical', className)}
      min={min}
      max={max}
      step={step ?? (max - min) / 200}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onDoubleClick={() => {
        if (defaultValue !== undefined) {
          onChange(defaultValue);
          onCommit?.();
        }
      }}
    />
  );
}

/** Level meter that reads an analyser ~30x/s without re-rendering React. */
export function Meter({ read, vertical, className }: { read: () => number; vertical?: boolean; className?: string }) {
  const bar = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let held = 0;
    let clipUntil = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const peak = read();
      held = Math.max(peak, held * 0.85);
      const db = held > 0 ? 20 * Math.log10(held) : -90;
      const f = Math.max(0, Math.min(1, (db + 54) / 54));
      if (bar.current) {
        if (vertical) bar.current.style.height = `${f * 100}%`;
        else bar.current.style.width = `${f * 100}%`;
        bar.current.style.background = db > -1 ? '#f43f5e' : db > -9 ? '#fbbf24' : '#34d399';
      }
      if (peak >= 0.99) clipUntil = t + 1500;
      if (clip.current) clip.current.style.opacity = t < clipUntil ? '1' : '0';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [read, vertical]);
  return (
    <div className={cx('relative overflow-hidden rounded-sm bg-slate-950', vertical ? 'w-2' : 'h-1.5', className)} aria-hidden>
      <div ref={bar} className={cx('absolute bottom-0 left-0', vertical ? 'w-full' : 'h-full')} />
      <div ref={clip} className={cx('absolute bg-rose-500 opacity-0', vertical ? 'top-0 h-1 w-full' : 'right-0 h-full w-1')} />
    </div>
  );
}

export function EditableText({ value, onCommit, className, label, maxLength = 40 }: { value: string; onCommit: (v: string) => void; className?: string; label: string; maxLength?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        className={cx('truncate text-left hover:underline focus-visible:outline-2 focus-visible:outline-sky-400', className)}
        title={`${label} (click to rename)`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
      >
        {value}
      </button>
    );
  }
  return (
    <input
      autoFocus
      aria-label={label}
      maxLength={maxLength}
      className={cx('w-full rounded bg-slate-800 px-1 outline-none ring-1 ring-amber-400', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft !== value) onCommit(draft.trim());
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cx('max-h-[90vh] w-full overflow-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="daw-display text-xl text-amber-300">{title}</h2>
          <button className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fmtDb = (v: number) => (v <= -60 ? '-∞ dB' : `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`);
export const fmtPan = (v: number) => (Math.abs(v) < 0.01 ? 'Center' : v < 0 ? `${Math.round(-v * 100)}% Left` : `${Math.round(v * 100)}% Right`);

// Fader taper (dB ↔ 0..1 travel), roughly like a console fader: more travel near 0 dB.
const TAPER: [number, number][] = [
  [-60, 0],
  [-48, 0.07],
  [-36, 0.16],
  [-24, 0.3],
  [-12, 0.5],
  [-6, 0.64],
  [0, 0.8],
  [6, 1],
];
export function dbToTravel(db: number): number {
  if (db <= TAPER[0][0]) return 0;
  for (let i = 1; i < TAPER.length; i++) {
    const [d1, t1] = TAPER[i];
    const [d0, t0] = TAPER[i - 1];
    if (db <= d1) return t0 + ((db - d0) / (d1 - d0)) * (t1 - t0);
  }
  return 1;
}
export function travelToDb(t: number): number {
  if (t <= 0) return TAPER[0][0];
  for (let i = 1; i < TAPER.length; i++) {
    const [d1, t1] = TAPER[i];
    const [d0, t0] = TAPER[i - 1];
    if (t <= t1) return d0 + ((t - t0) / (t1 - t0)) * (d1 - d0);
  }
  return TAPER[TAPER.length - 1][0];
}

const FADER_MARKS = [6, 0, -6, -12, -24, -48];
const CAP = 28; // cap height in px

/** Console-style volume fader (dB). Drag the cap (Shift = fine), arrow keys, double-click resets. */
export function Fader({
  value,
  onChange,
  onCommit,
  label,
  defaultValue = 0,
  accent = '#fbbf24',
}: {
  value: number;
  onChange: (db: number) => void;
  onCommit?: () => void;
  label: string;
  defaultValue?: number;
  accent?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; t: number; h: number } | null>(null);
  const t = dbToTravel(value);
  const set = (travel: number) => onChange(Math.round(travelToDb(Math.max(0, Math.min(1, travel))) * 10) / 10);
  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={-60}
      aria-valuemax={6}
      aria-valuenow={value}
      aria-valuetext={fmtDb(value)}
      title={`${label}: ${fmtDb(value)} (drag; Shift = fine; double-click = 0 dB)`}
      className="relative h-full min-h-[110px] w-11 shrink-0 cursor-ns-resize touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      onPointerDown={(e) => {
        const r = ref.current!.getBoundingClientRect();
        const h = r.height - CAP;
        const capTop = r.top + (1 - t) * h;
        e.currentTarget.setPointerCapture(e.pointerId);
        if (e.clientY < capTop || e.clientY > capTop + CAP) {
          // Clicked the groove: jump there, then drag.
          const nt = 1 - (e.clientY - r.top - CAP / 2) / h;
          set(nt);
          drag.current = { y: e.clientY, t: Math.max(0, Math.min(1, nt)), h };
        } else drag.current = { y: e.clientY, t, h };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        set(d.t - ((e.clientY - d.y) / d.h) * (e.shiftKey ? 0.2 : 1));
      }}
      onPointerUp={() => {
        if (!drag.current) return;
        drag.current = null;
        onCommit?.();
      }}
      onDoubleClick={() => {
        onChange(defaultValue);
        onCommit?.();
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 3 : 0.5;
        onChange(Math.max(-60, Math.min(6, value + (e.key === 'ArrowUp' ? step : -step))));
      }}
      onKeyUp={(e) => (e.key === 'ArrowUp' || e.key === 'ArrowDown') && onCommit?.()}
    >
      {/* scale */}
      {FADER_MARKS.map((m) => (
        <div key={m} className="pointer-events-none absolute left-0 flex w-full items-center" style={{ top: `calc(${CAP / 2}px + ${(1 - dbToTravel(m))} * (100% - ${CAP}px))` }}>
          <span className="w-4 -translate-y-px text-right font-mono text-[8px] leading-none text-slate-500">{m > 0 ? `+${m}` : m}</span>
          <span className={cx('ml-1 h-px', m === 0 ? 'w-full bg-slate-500' : 'w-full bg-slate-700/70')} />
        </div>
      ))}
      {/* groove */}
      <div className="pointer-events-none absolute bottom-[14px] left-[calc(50%+6px)] top-[14px] w-1.5 -translate-x-1/2 rounded-full bg-slate-950 ring-1 ring-slate-700" />
      {/* cap */}
      <div
        className="pointer-events-none absolute left-[calc(50%+6px)] flex w-7 -translate-x-1/2 items-center justify-center rounded-[5px] border border-slate-950/60 bg-gradient-to-b from-slate-200 via-slate-400 to-slate-500 shadow-[0_2px_4px_rgba(0,0,0,.6)]"
        style={{ height: CAP, top: `calc(${1 - t} * (100% - ${CAP}px))` }}
      >
        <div className="h-0.5 w-full" style={{ background: accent }} />
      </div>
    </div>
  );
}

/** Progress bar; `progress` null shows a moving "working…" bar for steps with no known length. */
export function ProgressBar({ progress, label }: { progress: number | null; label?: string }) {
  const pct = progress === null ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <div className="space-y-1" role="progressbar" aria-label={label ?? 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
      {label && (
        <div className="flex justify-between gap-2 text-xs text-slate-300">
          <span className="truncate">{label}</span>
          {pct !== null && <span className="font-mono text-slate-400">{pct}%</span>}
        </div>
      )}
      <div className="relative h-2 overflow-hidden rounded bg-slate-800">
        {pct === null ? <div className="daw-indeterminate absolute inset-y-0 w-1/3 rounded bg-amber-400" /> : <div className="h-full bg-amber-400 transition-[width] duration-200" style={{ width: `${pct}%` }} />}
      </div>
    </div>
  );
}
