import React, { useEffect, useRef, useState } from 'react';
import { Dices, Maximize2, Minimize2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRememberedState } from '../../hooks/useRememberedState';
import { storage } from '../../services/storage';
import { classesOn, toYMD } from '../../services/rotation';

interface NameList {
  id: string;
  title: string;
  names: string[];
  picked: string[]; // already chosen this round (when "no repeats" is on)
}

const SPIN_MS = 1600;

const chime = () => {
  try {
    const ctx = new AudioContext();
    [784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // No audio available: the pick still shows.
  }
};

/**
 * Random name picker for the projector. Lists stay on this device only (never uploaded) and
 * are cleared when the device is locked, since they hold student names.
 */
export const NamePickerView: React.FC = () => {
  const { showToast } = useApp();
  const [lists, setLists] = useRememberedState<NameList[]>('namePicker.lists', []);
  const [activeId, setActiveId] = useRememberedState<string | null>('namePicker.active', null);
  const [noRepeats, setNoRepeats] = useRememberedState('namePicker.noRepeats', true);
  const [sound, setSound] = useRememberedState('namePicker.sound', true);
  const [shown, setShown] = useState<string>('');
  const [spinning, setSpinning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  const active = lists.find((l) => l.id === activeId) || lists[0] || null;
  const remaining = active ? (noRepeats ? active.names.filter((n) => !active.picked.includes(n)) : active.names) : [];

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const updateActive = (updates: Partial<NameList>) => {
    if (!active) return;
    setLists((all) => all.map((l) => (l.id === active.id ? { ...l, ...updates } : l)));
  };

  const addList = (title = 'New class', names: string[] = []) => {
    const list: NameList = { id: `nl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title, names, picked: [] };
    setLists((all) => [...all, list]);
    setActiveId(list.id);
    return list;
  };

  const addTodaysClasses = () => {
    const { classes } = classesOn(toYMD(new Date()), storage.getRotation());
    const missing = classes.filter((c) => c.name && !lists.some((l) => l.title === c.name));
    if (!missing.length) {
      showToast(classes.length ? "Today's classes already have lists" : 'No classes in your rotation today', 'info');
      return;
    }
    missing.forEach((c) => addList(c.name));
    showToast(`Added ${missing.length} list${missing.length > 1 ? 's' : ''}. Paste each class's names in.`, 'success');
  };

  const pick = () => {
    if (!active || spinning) return;
    let pool = remaining;
    if (pool.length === 0) {
      if (!active.names.length) return;
      updateActive({ picked: [] }); // everyone has had a turn: start a new round
      pool = active.names;
    }
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setSpinning(true);
    const started = performance.now();
    const tick = () => {
      const elapsed = performance.now() - started;
      if (elapsed >= SPIN_MS) {
        setShown(winner);
        setSpinning(false);
        if (noRepeats) updateActive({ picked: [...(pool === active.names ? [] : active.picked), winner] });
        if (sound) chime();
        return;
      }
      setShown(active.names[Math.floor(Math.random() * active.names.length)]);
      // Slow down toward the end, like a wheel
      setTimeout(tick, 40 + (elapsed / SPIN_MS) ** 2 * 220);
    };
    tick();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.current?.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <Dices className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-bold text-stone-900 dark:text-white">Name Picker</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stage */}
        <div
          ref={stage}
          className={`lg:col-span-2 relative flex flex-col items-center justify-center text-center rounded-3xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-card p-6 ${
            fullscreen ? 'min-h-screen' : 'min-h-[22rem]'
          }`}
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25"
          >
            {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          {active && <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">{active.title}</div>}
          <div
            aria-live="polite"
            className={`font-extrabold my-6 break-words max-w-full transition-transform ${spinning ? 'opacity-80' : 'scale-105'} ${
              fullscreen ? 'text-[9vw]' : 'text-5xl sm:text-7xl'
            }`}
          >
            {shown || (active?.names.length ? 'Ready?' : 'Add names to begin')}
          </div>
          <button
            type="button"
            onClick={pick}
            disabled={!active?.names.length || spinning}
            className="px-8 py-4 rounded-2xl bg-white text-brand-700 font-extrabold text-lg shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 transition-transform"
          >
            {spinning ? 'Picking…' : 'Pick a name'}
          </button>
          {active && noRepeats && active.names.length > 0 && (
            <div className="mt-4 text-sm text-white/80">
              {remaining.length === 0 ? 'Everyone has had a turn. The next pick starts a new round.' : `${remaining.length} of ${active.names.length} still to go`}
            </div>
          )}
        </div>

        {/* Lists */}
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={active?.id || ''}
              onChange={(e) => setActiveId(e.target.value)}
              aria-label="Name list"
              className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white"
            >
              {lists.length === 0 && <option value="">No lists yet</option>}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.title} ({l.names.length})</option>
              ))}
            </select>
            <button type="button" onClick={() => addList()} aria-label="New list" className="p-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <button type="button" onClick={addTodaysClasses} className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700">
            Make lists for today's rotation classes
          </button>

          {active && (
            <>
              <input
                value={active.title}
                onChange={(e) => updateActive({ title: e.target.value })}
                aria-label="List name"
                className="w-full text-sm font-semibold px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white"
              />
              <textarea
                value={active.names.join('\n')}
                onChange={(e) =>
                  updateActive({
                    names: e.target.value.split('\n').map((n) => n.trimStart()).filter((n, i, all) => n || i === all.length - 1)
                  })
                }
                onBlur={() => updateActive({ names: active.names.map((n) => n.trim()).filter(Boolean) })}
                rows={10}
                placeholder={'One name per line\n(paste a whole class at once)'}
                aria-label="Names, one per line"
                className="w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white font-mono"
              />
              <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 dark:text-stone-300">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={noRepeats} onChange={(e) => setNoRepeats(e.target.checked)} />
                  Everyone once before repeats
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
                  Chime
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { updateActive({ picked: [] }); setShown(''); }} className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
                  <RotateCcw className="w-3.5 h-3.5" />
                  New round
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`Delete the list "${active.title}"?`)) return;
                    setLists((all) => all.filter((l) => l.id !== active.id));
                    setActiveId(null);
                    setShown('');
                  }}
                  className="ml-auto px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-stone-500 hover:text-rose-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete list
                </button>
              </div>
            </>
          )}
          <p className="text-[11px] text-stone-400">
            Name lists stay on this device only. They aren't uploaded, and locking the device clears them.
          </p>
        </div>
      </div>
    </div>
  );
};
