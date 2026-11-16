import React, { useState } from 'react';
import { X, CircleHelp, Maximize2, Minimize2, Link2, Printer, LayoutGrid, Check } from 'lucide-react';
import { MetronomeTool } from './MetronomeTool';
import { TempoTapper } from './TempoTapper';
import { SolfegeTrainer } from './SolfegeTrainer';
import { InstrumentZoo } from './InstrumentZoo';
import { DynamicEars } from './DynamicEars';
import { MusicTuner } from './MusicTuner';
import { MusicSymbolMatch } from './MusicSymbolMatch';
import { SongStarter } from './SongStarter';
import { useDialogBehavior } from '../Modal';
import { shouldIgnoreShortcut } from '../../utils/keyGuard';
import { readUrlParam, urlForRoute } from '../../routes';
import { TOOL_HELP } from './toolHelp';
import { TOOL_PRINTABLES } from './toolPrintables';

export type ToolId =
  | 'metronome'
  | 'tempo-tapper'
  | 'solfege-trainer'
  | 'instrument-zoo'
  | 'dynamic-ears'
  | 'song-starter'
  | 'music-symbol-match'
  | 'tuner';

interface ClassroomToolBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTool?: ToolId;
  /** Called when the student picks another tool tab (the landing page keeps the address in step). */
  onToolChange?: (tool: ToolId) => void;
}

interface ToolTabMeta {
  id: ToolId;
  title: string;
  emoji: string;
  subtitle: string;
  accentColor: string;
  badgeBg: string;
}

const TOOL_TABS: ToolTabMeta[] = [
  {
    id: 'metronome',
    title: 'Metronome',
    emoji: '⏱️',
    subtitle: 'Beats, Flash & Sound',
    accentColor: 'from-amber-400 to-yellow-500',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'tempo-tapper',
    title: 'Tap Tempo',
    emoji: '👆',
    subtitle: 'BPM & Animal Speeds',
    accentColor: 'from-orange-400 to-amber-500',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
  {
    id: 'solfege-trainer',
    title: 'Do-Re-Mi Trainer',
    emoji: '🔔',
    subtitle: 'Curwen Signs & Chimes',
    accentColor: 'from-rose-400 to-pink-500',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'instrument-zoo',
    title: 'Instrument Zoo',
    emoji: '🎻',
    subtitle: 'Orchestra Sound Tour',
    accentColor: 'from-cyan-400 to-blue-500',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'dynamic-ears',
    title: 'Dynamic Ears',
    emoji: '👂',
    subtitle: 'Sound Meter & Dynamics',
    accentColor: 'from-emerald-400 to-teal-500',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'song-starter',
    title: 'Song Starter',
    emoji: '🎶',
    subtitle: 'K-2nd Song Box',
    accentColor: 'from-amber-400 to-pink-500',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'music-symbol-match',
    title: 'Symbol Match',
    emoji: '🃏',
    subtitle: 'Notes, Clefs & Rests',
    accentColor: 'from-violet-400 to-pink-500',
    badgeBg: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  {
    id: 'tuner',
    title: 'Instrument Tuner',
    emoji: '🎸',
    subtitle: 'Guitar, Violin, Bass & Mic',
    accentColor: 'from-teal-400 to-emerald-500',
    badgeBg: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
];

export const ClassroomToolBoxModal: React.FC<ClassroomToolBoxModalProps> = ({
  isOpen,
  onClose,
  initialTool = 'tempo-tapper',
  onToolChange,
}) => {
  const validInitial = TOOL_TABS.some((t) => t.id === initialTool) ? initialTool : 'tempo-tapper';
  const [activeTool, setActiveTool] = useState<ToolId>(validInitial);

  // Sync initialTool when opening
  React.useEffect(() => {
    if (isOpen) {
      const valid = TOOL_TABS.some((t) => t.id === initialTool) ? initialTool : 'tempo-tapper';
      setActiveTool(valid);
    }
  }, [isOpen, initialTool]);

  // Teacher conveniences (all in this browser only): how-to panel, full screen, shareable links, print-outs.
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

  // A "focus link" (?app=metronome&focus=1) opens one tool with the other tool tabs hidden.
  React.useEffect(() => {
    if (!isOpen) return;
    setHelpOpen(false);
    try {
      setFocusMode(readUrlParam(window.location, 'focus') === '1');
    } catch {
      setFocusMode(false);
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    onFs();
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [isOpen]);

  // Leaving the Tool Box also leaves full screen.
  React.useEffect(() => {
    if (isOpen) return;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }, [isOpen]);

  // "?" opens / closes the how-to panel (same rule as the other Tool Box keys: never while typing or behind another window).
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' && !(e.key === '/' && e.shiftKey)) return;
      if (shouldIgnoreShortcut(e, { allowOnButtons: true, ownDialog: '[aria-label="Tool Box"]' })) return;
      e.preventDefault();
      setHelpOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const toggleFullscreen = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen().catch(() => {});
    } catch {
      // not available in this browser
    }
  };

  const copyToolLink = async (focus: boolean) => {
    const path = urlForRoute({ app: 'hub', bigStaff: false, tool: activeTool });
    const url = `${window.location.origin}${path}${focus ? '&focus=1' : ''}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        ta.remove();
      } catch {
        ok = false;
      }
    }
    setLinkNote(ok ? (focus ? 'Focus link copied' : 'Link copied') : 'Could not copy. Copy the address from the browser bar.');
    window.setTimeout(() => setLinkNote(null), 2500);
  };

  const dlg = useDialogBehavior<HTMLDivElement>(onClose, { active: isOpen });
  if (!isOpen) return null;

  const help = TOOL_HELP[activeTool];
  const printable = TOOL_PRINTABLES[activeTool];
  const activeMeta = TOOL_TABS.find((t) => t.id === activeTool);
  const barBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer transition-colors';

  return (
    <div ref={dlg} role="dialog" aria-modal="true" aria-label="Tool Box" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border-2 border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800/90 bg-slate-950/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-2xl shadow-inner">
              🎒
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white font-['Fredoka',sans-serif] flex items-center gap-2">
                <span>Music Class Tool Box</span>
                <span className="text-[12px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  Interactive Mini-Tools
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Fast utilities for tempo, pitch, instrument discovery &amp; dynamic levels
              </p>
            </div>
          </div>

          <button aria-label="Close Tool Box"
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
            title="Close Tool Box"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip (hidden in focus mode: the link opens just this one tool) */}
        {!focusMode && (
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {TOOL_TABS.map((tab) => {
            const isActive = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTool(tab.id);
                  onToolChange?.(tab.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap font-['Fredoka',sans-serif] ${
                  isActive
                    ? 'bg-gradient-to-r ' + tab.accentColor + ' text-slate-950 shadow-lg scale-102'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                <span className="text-lg">{tab.emoji}</span>
                <div className="text-left">
                  <div className="leading-tight">{tab.title}</div>
                  <div
                    className={`text-[12px] font-medium leading-none ${
                      isActive ? 'text-slate-950/80' : 'text-slate-500'
                    }`}
                  >
                    {tab.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}

        {/* Helpers: how-to, full screen, links, print */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
          {focusMode && activeMeta && (
            <span className="text-sm font-black text-white font-['Fredoka',sans-serif] mr-1">
              {activeMeta.emoji} {activeMeta.title}
            </span>
          )}
          <button type="button" onClick={() => setHelpOpen((v) => !v)} aria-expanded={helpOpen} aria-controls="toolbox-howto" className={barBtn} title="How to use this tool (press ?)">
            <CircleHelp className="w-4 h-4" aria-hidden="true" />
            <span>How to use</span>
          </button>
          {canFullscreen && (
            <button type="button" onClick={toggleFullscreen} className={barBtn} title="Fill the whole screen, good for the projector">
              {isFullscreen ? <Minimize2 className="w-4 h-4" aria-hidden="true" /> : <Maximize2 className="w-4 h-4" aria-hidden="true" />}
              <span>{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
            </button>
          )}
          {printable && (
            <button type="button" onClick={() => printable.print()} className={barBtn} title="Open the print window for a chart you can hand out">
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span>{printable.label}</span>
            </button>
          )}
          <button type="button" onClick={() => copyToolLink(false)} className={barBtn} title="Copy a link that opens this tool">
            <Link2 className="w-4 h-4" aria-hidden="true" />
            <span>Copy link</span>
          </button>
          <button type="button" onClick={() => copyToolLink(true)} className={barBtn} title="Copy a link that opens only this tool, with the other tools hidden">
            <Link2 className="w-4 h-4" aria-hidden="true" />
            <span>Copy focus link</span>
          </button>
          {focusMode && (
            <button type="button" onClick={() => setFocusMode(false)} className={barBtn} title="Show the other tools again">
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
              <span>Show all tools</span>
            </button>
          )}
          <span role="status" aria-live="polite" className="text-xs font-bold text-emerald-300 inline-flex items-center gap-1">
            {linkNote && !linkNote.startsWith('Could not') && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
            {linkNote}
          </span>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {helpOpen && (
            <section id="toolbox-howto" role="region" aria-label={`How to use ${activeMeta?.title || 'this tool'}`} className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-black text-white font-['Fredoka',sans-serif]">How to use {activeMeta?.title}</h3>
                <button type="button" onClick={() => setHelpOpen(false)} className="text-xs font-bold text-sky-200 hover:text-white underline cursor-pointer">Hide</button>
              </div>
              <ol className="mt-2 list-decimal pl-5 space-y-1 text-slate-200">
                {help.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {help.keys && (
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                  {help.keys.map((k) => (
                    <span key={k.key} className="inline-flex items-center gap-1.5">
                      <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono font-bold text-white">{k.key}</kbd>
                      <span>{k.action}</span>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">Tip: press <kbd className="px-1 rounded bg-slate-800 border border-slate-600 font-mono">?</kbd> to show or hide this help.</p>
            </section>
          )}
          {activeTool === 'metronome' && <MetronomeTool />}
          {activeTool === 'tempo-tapper' && <TempoTapper />}
          {activeTool === 'solfege-trainer' && <SolfegeTrainer />}
          {activeTool === 'instrument-zoo' && <InstrumentZoo />}
          {activeTool === 'dynamic-ears' && <DynamicEars />}
          {activeTool === 'song-starter' && <SongStarter />}
          {activeTool === 'music-symbol-match' && <MusicSymbolMatch />}
          {activeTool === 'tuner' && <MusicTuner />}
        </div>
      </div>
    </div>
  );
};
