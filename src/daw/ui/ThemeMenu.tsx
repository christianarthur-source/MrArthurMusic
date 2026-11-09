import { Moon, Palette, Sun } from 'lucide-react';
import { useState } from 'react';
import { cx, IconButton } from './controls';
import { ACCENTS, DEFAULT_ACCENT, setTheme, useTheme } from './theme';

/** Top-bar button: light or dark theme and an accent color (remembered on this computer). */
export function ThemeMenu() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <IconButton label="Look: light or dark theme and accent color" active={open} onClick={() => setOpen((o) => !o)} testId="theme-menu">
        <Palette size={16} />
      </IconButton>
      {open && (
        <div role="dialog" aria-label="Theme" className="absolute right-0 top-9 z-[70] w-64 space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl" onPointerLeave={() => setOpen(false)}>
          <div className="flex rounded-lg bg-slate-800 p-0.5" role="radiogroup" aria-label="Theme">
            {(
              [
                ['dark', 'Dark', <Moon key="m" size={14} />],
                ['light', 'Light', <Sun key="s" size={14} />],
              ] as const
            ).map(([mode, label, icon]) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={theme.mode === mode}
                data-testid={`theme-${mode}`}
                onClick={() => setTheme({ mode })}
                className={cx('flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-sm', theme.mode === mode ? 'bg-slate-600 font-semibold text-white' : 'text-slate-400 hover:text-slate-200')}
              >
                {icon} {label}
              </button>
            ))}
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-400">Accent color</div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Accent color">
              {ACCENTS.map((a) => (
                <button
                  key={a.hex}
                  type="button"
                  role="radio"
                  aria-checked={theme.accent === a.hex}
                  aria-label={a.name}
                  title={a.name}
                  onClick={() => setTheme({ accent: a.hex })}
                  className={cx('h-7 w-7 rounded-full ring-offset-2 ring-offset-slate-900', theme.accent === a.hex ? 'ring-2 ring-slate-100' : 'ring-1 ring-black/30')}
                  style={{ background: a.hex }}
                />
              ))}
              <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/30" title="Pick any color" style={{ background: 'conic-gradient(#f43f5e, #fbbf24, #a3e635, #38bdf8, #a78bfa, #f43f5e)' }}>
                <span className="sr-only">Custom accent color</span>
                <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={theme.accent} onChange={(e) => setTheme({ accent: e.target.value })} />
              </label>
            </div>
            {theme.accent !== DEFAULT_ACCENT && (
              <button type="button" className="mt-2 text-xs text-slate-400 underline hover:text-slate-200" onClick={() => setTheme({ accent: DEFAULT_ACCENT })}>
                Back to gold
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Saved on this computer only.</p>
        </div>
      )}
    </div>
  );
}
