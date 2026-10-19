import React from 'react';
import {
  AccidentalType,
  NoteDuration,
  ViewLayout,
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
  Play,
  Pause,
  RotateCcw,
  MousePointer,
  Trash2,
  Undo2,
  Redo2,
  Plus,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Columns,
  Rows,
} from 'lucide-react';

interface FullScreenMiniPaletteProps {
  title: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRewind: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  activeDuration: NoteDuration;
  onChangeDuration: (d: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
  isDotted: boolean;
  onToggleDotted: () => void;
  activeAccidental: AccidentalType;
  onChangeAccidental: (acc: AccidentalType) => void;
  onDeleteSelected: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddMeasure: () => void;
  viewLayout: ViewLayout;
  onChangeViewLayout: (layout: ViewLayout) => void;
  scoreZoom: number;
  onChangeScoreZoom: (zoom: number) => void;
  onExitFullScreen: () => void;
}

export const FullScreenMiniPalette: React.FC<FullScreenMiniPaletteProps> = ({
  title,
  isPlaying,
  onTogglePlay,
  onRewind,
  isSelectMode,
  onToggleSelectMode,
  activeDuration,
  onChangeDuration,
  isRestMode,
  onToggleRestMode,
  isDotted,
  onToggleDotted,
  activeAccidental,
  onChangeAccidental,
  onDeleteSelected,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddMeasure,
  viewLayout,
  onChangeViewLayout,
  scoreZoom,
  onChangeScoreZoom,
  onExitFullScreen,
}) => {
  const durations: { value: NoteDuration; label: string }[] = [
    { value: 1, label: 'Whole' },
    { value: 0.5, label: 'Half' },
    { value: 0.25, label: 'Quarter' },
    { value: 0.125, label: '8th' },
    { value: 0.0625, label: '16th' },
  ];

  const renderMiniNoteIcon = (d: NoteDuration) => {
    if (d === 0.125) return <EighthNoteUIIcon className="w-5 h-5" />;
    if (d === 0.0625) return <SixteenthNoteUIIcon className="w-5 h-5" />;
    return (
      <svg viewBox="0 0 28 32" className="w-5 h-5 overflow-visible">
        <ellipse
          cx="11"
          cy="22"
          rx="6"
          ry="4.2"
          transform="rotate(-20 11 22)"
          fill={d < 0.5 ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2.2"
        />
        {d < 1 && (
          <line
            x1="16"
            y1="21"
            x2="16"
            y2="5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="sticky top-3 z-40 mx-auto max-w-fit px-3 py-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/90 shadow-2xl flex flex-wrap items-center gap-2 text-slate-100">
      {/* Title badge */}
      <span className="text-xs font-bold text-slate-300 px-2 max-w-[150px] truncate hidden sm:inline">
        {title || 'Untitled'}
      </span>

      <div className="h-5 w-px bg-slate-700 hidden sm:block" />

      {/* Play & Rewind */}
      <div className="flex items-center gap-1">
        <button
          onClick={onRewind}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          title="Rewind to Start"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
          }`}
          title="Play / Pause (Space)"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          <span>{isPlaying ? 'Stop' : 'Play'}</span>
        </button>
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* Cursor / Select */}
      <button
        onClick={onToggleSelectMode}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          isSelectMode
            ? 'bg-amber-500 text-slate-950 shadow-sm'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
        }`}
        title="Select / Cursor Mode"
      >
        <MousePointer className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Select</span>
      </button>

      {/* Durations */}
      <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
        {durations.map((d) => {
          const active = !isSelectMode && !isRestMode && activeDuration === d.value;
          return (
            <button
              key={d.value}
              onClick={() => {
                if (isSelectMode) onToggleSelectMode();
                onChangeDuration(d.value);
              }}
              className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                active
                  ? 'bg-sky-500 text-slate-950 shadow-sm scale-105'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={`${d.label} Note`}
            >
              {renderMiniNoteIcon(d.value)}
            </button>
          );
        })}

        {/* Rest Toggle */}
        <button
          onClick={() => {
            if (isSelectMode) onToggleSelectMode();
            onToggleRestMode();
          }}
          className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            !isSelectMode && isRestMode
              ? 'bg-amber-500 text-slate-950 shadow-sm scale-105'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="Rest Mode (R)"
        >
          <RestUIIcon className="w-5 h-5" />
        </button>

        {/* Dot Toggle */}
        <button
          onClick={onToggleDotted}
          className={`px-2 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
            isDotted
              ? 'bg-purple-500 text-white shadow-sm'
              : 'text-slate-300 hover:bg-slate-800'
          }`}
          title="Dotted Note (.)"
        >
          • Dot
        </button>
      </div>

      {/* Accidentals */}
      <div className="flex items-center gap-0.5 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
        {(
          [
            { id: 'sharp', label: 'Sharp', Icon: SharpUIIcon },
            { id: 'flat', label: 'Flat', Icon: FlatUIIcon },
            { id: 'natural', label: 'Natural', Icon: NaturalUIIcon },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeAccidental === id;
          return (
            <button
              key={id}
              onClick={() => onChangeAccidental(active ? null : id)}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                active
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* Edit & Measure Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={onDeleteSelected}
          className="p-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-colors cursor-pointer"
          title="Delete Selected Note or Clear Measure (Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-slate-300 transition-colors cursor-pointer"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onAddMeasure}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
          title="Add Measure"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">Bar</span>
        </button>
      </div>

      <div className="h-5 w-px bg-slate-700" />

      {/* View Toggle & Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={() =>
            onChangeViewLayout(viewLayout === 'vertical' ? 'horizontal' : 'vertical')
          }
          className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            viewLayout === 'horizontal'
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
          }`}
          title="Switch between Page View and Horizontal Auto-Scroll View"
        >
          {viewLayout === 'horizontal' ? (
            <>
              <Columns className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden lg:inline">Horizontal</span>
            </>
          ) : (
            <>
              <Rows className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden lg:inline">Page</span>
            </>
          )}
        </button>

        <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-800 px-1 py-0.5">
          <button
            onClick={() => onChangeScoreZoom(Math.max(1.0, Math.round((scoreZoom - 0.15) * 100) / 100))}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out Staff"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-indigo-300 px-1.5 min-w-[42px] text-center">
            {Math.round(scoreZoom * 100)}%
          </span>
          <button
            onClick={() => onChangeScoreZoom(Math.min(1.85, Math.round((scoreZoom + 0.15) * 100) / 100))}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom In Staff (Make Notes Bigger)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Exit Full Screen */}
      <button
        onClick={onExitFullScreen}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
        title="Exit Full Screen (Esc)"
      >
        <Minimize2 className="w-3.5 h-3.5" />
        <span>Exit Full Screen</span>
      </button>
    </div>
  );
};
