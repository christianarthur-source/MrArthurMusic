import React from 'react';
import {
  AccidentalType,
  ArticulationType,
  DynamicMarking,
  NoteDuration,
  UiMode,
} from '../types/music';
import {
  EighthNoteUIIcon,
  FlatUIIcon,
  NaturalUIIcon,
  RestUIIcon,
  SharpUIIcon,
  SixteenthNoteUIIcon,
} from './NotationSymbols';
import {
  Undo2,
  Redo2,
  Trash2,
  MousePointer,
  Plus,
  Play,
  Square,
  ChevronUp,
} from 'lucide-react';

interface FloatingToolPaletteProps {
  isVisible: boolean;
  uiMode: UiMode;
  onChangeUiMode: (mode: UiMode) => void;
  activeDuration: NoteDuration;
  onChangeDuration: (d: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  isDotted: boolean;
  onToggleDotted: () => void;
  isTied: boolean;
  onToggleTied: () => void;
  isTriplet: boolean;
  onToggleTriplet: () => void;
  activeAccidental: AccidentalType;
  onChangeAccidental: (a: AccidentalType) => void;
  activeArticulation: ArticulationType;
  onChangeArticulation: (art: ArticulationType) => void;
  activeDynamic: DynamicMarking;
  onChangeDynamic: (dyn: DynamicMarking) => void;
  onAddMeasure: () => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onScrollToTop?: () => void;
}

export const FloatingToolPalette: React.FC<FloatingToolPaletteProps> = ({
  isVisible,
  uiMode,
  onChangeUiMode,
  activeDuration,
  onChangeDuration,
  isRestMode,
  onToggleRestMode,
  isSelectMode,
  onToggleSelectMode,
  isDotted,
  onToggleDotted,
  isTied,
  onToggleTied,
  isTriplet,
  onToggleTriplet,
  activeAccidental,
  onChangeAccidental,
  activeArticulation,
  onChangeArticulation,
  activeDynamic,
  onChangeDynamic,
  onAddMeasure,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isPlaying = false,
  onTogglePlay,
  onScrollToTop,
}) => {
  if (!isVisible) return null;

  const allDurations: { duration: NoteDuration; label: string; icon: React.ReactNode }[] = [
    {
      duration: 1,
      label: 'Whole',
      icon: (
        <svg viewBox="0 0 28 32" className="w-4 h-5 overflow-visible">
          <ellipse cx="12" cy="16" rx="7" ry="4.5" transform="rotate(-15 12 16)" fill="none" stroke="currentColor" strokeWidth="2.4" />
        </svg>
      ),
    },
    {
      duration: 0.5,
      label: 'Half',
      icon: (
        <svg viewBox="0 0 28 32" className="w-4 h-5 overflow-visible">
          <ellipse cx="10" cy="22" rx="6" ry="4.2" transform="rotate(-20 10 22)" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <line x1="15" y1="21" x2="15" y2="6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      duration: 0.25,
      label: 'Quarter',
      icon: (
        <svg viewBox="0 0 28 32" className="w-4 h-5 overflow-visible">
          <ellipse cx="10" cy="22" rx="6" ry="4.2" transform="rotate(-20 10 22)" fill="currentColor" stroke="currentColor" strokeWidth="2.2" />
          <line x1="15" y1="21" x2="15" y2="6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      duration: 0.125,
      label: '8th',
      icon: <EighthNoteUIIcon className="w-4 h-5 text-current" />,
    },
    {
      duration: 0.0625,
      label: '16th',
      icon: <SixteenthNoteUIIcon className="w-4 h-5 text-current" />,
    },
  ];

  const visibleDurations = allDurations.filter((d) => {
    if (uiMode === 'simple') return d.duration === 0.25 || d.duration === 0.125;
    if (uiMode === 'standard') return d.duration >= 0.125;
    return true;
  });

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] px-3.5 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-amber-400/50 shadow-2xl shadow-black/80 flex flex-wrap items-center justify-center gap-2 text-white select-none transition-all duration-200 animate-in fade-in slide-in-from-bottom-3"
      role="toolbar"
      aria-label="Floating Note Palette"
    >
      {/* Scroll to Top Indicator Button */}
      {onScrollToTop && (
        <button
          type="button"
          onClick={onScrollToTop}
          title="Back to top palette"
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      )}

      {/* Play / Stop Shortcut (if provided) */}
      {onTogglePlay && (
        <button
          type="button"
          onClick={onTogglePlay}
          title={isPlaying ? 'Stop Music (Space)' : 'Play Music (Space)'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
          }`}
        >
          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'Stop' : 'Play'}</span>
        </button>
      )}

      <div className="h-5 w-px bg-slate-700/80 hidden sm:block" />

      {/* Select / Cursor Mode Toggle */}
      <button
        type="button"
        onClick={onToggleSelectMode}
        title="Cursor / Select Mode (V)"
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
          isSelectMode
            ? 'bg-amber-400 text-slate-950 shadow-sm'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
        }`}
      >
        <MousePointer className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Select</span>
      </button>

      {/* Note Durations Group */}
      <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
        {visibleDurations.map((d) => {
          const isSelected = !isSelectMode && !isRestMode && activeDuration === d.duration;
          return (
            <button
              key={d.duration}
              type="button"
              onClick={() => {
                if (isSelectMode) onToggleSelectMode();
                if (isRestMode) onToggleRestMode();
                onChangeDuration(d.duration);
              }}
              title={`${d.label} Note`}
              className={`flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 shadow-md font-bold scale-105'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              {d.icon}
            </button>
          );
        })}

        {/* Rest Button */}
        <button
          type="button"
          onClick={() => {
            if (isSelectMode) onToggleSelectMode();
            onToggleRestMode();
          }}
          title="Rest Mode (R)"
          className={`flex items-center justify-center p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 ${
            !isSelectMode && isRestMode
              ? 'bg-rose-500 text-white shadow-md font-bold scale-105'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          <RestUIIcon className="w-4 h-5 text-current" />
        </button>

        {/* Dot Toggle */}
        <button
          type="button"
          onClick={onToggleDotted}
          title="Dotted Note (.)"
          className={`px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
            isDotted
              ? 'bg-purple-500 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
        >
          • Dot
        </button>
      </div>

      {/* Accidentals (Sharp, Flat, Natural) */}
      <div className="flex items-center gap-0.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
        {(
          [
            { id: 'sharp', label: 'Sharp (#)', Icon: SharpUIIcon },
            { id: 'flat', label: 'Flat (b)', Icon: FlatUIIcon },
            { id: 'natural', label: 'Natural (n)', Icon: NaturalUIIcon },
          ] as const
        ).map(({ id, label, Icon }) => {
          const isSelected = activeAccidental === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangeAccidental(isSelected ? null : id)}
              title={label}
              className={`p-1.5 rounded-lg transition-all cursor-pointer active:scale-95 ${
                isSelected
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-4" />
            </button>
          );
        })}
      </div>

      {/* Ties & Triplets (in Standard & Advanced Mode) */}
      {uiMode !== 'simple' && (
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={onToggleTied}
            title="Tie Note (T)"
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isTied
                ? 'bg-indigo-500 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Tie
          </button>
          <button
            type="button"
            onClick={onToggleTriplet}
            title="Triplet (3)"
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isTriplet
                ? 'bg-teal-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            Triplet
          </button>
        </div>
      )}

      {/* Add Bar */}
      <button
        type="button"
        onClick={onAddMeasure}
        title="Add Measure (+)"
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs border border-slate-700 transition-all cursor-pointer active:scale-95"
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Add Bar</span>
      </button>

      {/* Delete / Clear */}
      <button
        type="button"
        onClick={onDeleteSelected}
        title="Delete Selected Note / Measure (Backspace / Delete)"
        className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-all cursor-pointer active:scale-95"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {/* Undo & Redo */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 transition-all cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
