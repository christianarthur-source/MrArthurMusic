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
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  active?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  tone?: 'default' | 'accent' | 'danger' | 'record';
  shortcut?: string;
  testId?: string;
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
        'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-400',
        active
          ? tone === 'record'
            ? 'bg-rose-500 text-white'
            : 'bg-amber-400 text-slate-950'
          : tone === 'accent'
            ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25'
            : tone === 'danger'
              ? 'text-rose-300 hover:bg-rose-500/20'
              : tone === 'record'
                ? 'text-rose-400 hover:bg-rose-500/20'
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
