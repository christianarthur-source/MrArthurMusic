import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  kbd?: string;
  run: () => void;
}

/** Scores how well a command matches the typed words (0 = no match). */
function score(c: Command, words: string[]): number {
  const label = c.label.toLowerCase();
  const hay = `${label} ${c.group.toLowerCase()} ${(c.keywords || '').toLowerCase()}`;
  let total = 0;
  for (const w of words) {
    const i = hay.indexOf(w);
    if (i < 0) return 0;
    total += label.startsWith(w) ? 6 : label.includes(' ' + w) ? 4 : i < label.length ? 3 : 1;
  }
  return total + 1 / (1 + label.length / 40);
}

/** Ctrl/⌘+K: type what you want ("crescendo", "transpose", "key of D") and press Enter. */
export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return commands.filter((c) => c.group === 'Suggested').concat(commands.filter((c) => c.group !== 'Suggested')).slice(0, 60);
    return commands
      .map((c) => ({ c, s: score(c, words) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 60)
      .map((x) => x.c);
  }, [q, commands]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (c: Command | undefined) => {
    if (!c) return;
    onClose();
    // let the dialog close (and focus return) before the command runs
    window.setTimeout(() => c.run(), 0);
  };

  return (
    <div className="ps-overlay ps-cmdk-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ps-cmdk" role="dialog" aria-label="Find a command">
        <div className="ps-cmdk-input">
          <Search size={16} />
          <input
            autoFocus
            value={q}
            placeholder="Type a command: crescendo, transpose, key of D, add measures…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
            }}
            aria-label="Search commands"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="ps-cmdk-list" ref={listRef} role="listbox">
          {results.map((c, i) => (
            <button
              key={c.id}
              data-i={i}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'ps-on' : ''}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(c)}
            >
              <span>{c.label}</span>
              <small>{c.group}</small>
              {c.kbd && <kbd>{c.kbd}</kbd>}
            </button>
          ))}
          {!results.length && <p className="ps-cmdk-empty">Nothing matches “{q}”. Try fewer or different words.</p>}
        </div>
      </div>
    </div>
  );
}
