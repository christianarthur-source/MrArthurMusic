import React, { useState } from 'react';
import { X, Sparkles, SlidersHorizontal, Volume2 } from 'lucide-react';
import { MetronomeTool } from './MetronomeTool';
import { TempoTapper } from './TempoTapper';
import { SolfegeTrainer } from './SolfegeTrainer';
import { InstrumentZoo } from './InstrumentZoo';
import { DynamicEars } from './DynamicEars';
import { MusicTuner } from './MusicTuner';
import { MusicSymbolMatch } from './MusicSymbolMatch';

export type ToolId =
  | 'metronome'
  | 'tempo-tapper'
  | 'solfege-trainer'
  | 'instrument-zoo'
  | 'dynamic-ears'
  | 'sound-painter'
  | 'song-starter'
  | 'music-symbol-match'
  | 'tuner';

interface ClassroomToolBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTool?: ToolId;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
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
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  Interactive Mini-Tools
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Fast utilities for tempo, pitch, instrument discovery &amp; dynamic levels
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
            title="Close Tool Box"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Strip */}
        <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {TOOL_TABS.map((tab) => {
            const isActive = activeTool === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTool(tab.id)}
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
                    className={`text-[9px] font-medium leading-none ${
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

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTool === 'metronome' && <MetronomeTool />}
          {activeTool === 'tempo-tapper' && <TempoTapper />}
          {activeTool === 'solfege-trainer' && <SolfegeTrainer />}
          {activeTool === 'instrument-zoo' && <InstrumentZoo />}
          {activeTool === 'dynamic-ears' && <DynamicEars />}
          {activeTool === 'music-symbol-match' && <MusicSymbolMatch />}
          {activeTool === 'tuner' && <MusicTuner />}
        </div>
      </div>
    </div>
  );
};
