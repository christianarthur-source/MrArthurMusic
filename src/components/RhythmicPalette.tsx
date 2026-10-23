import React, { useState, useRef, useEffect } from 'react';
import {
  AccidentalType,
  ArticulationType,
  DynamicMarking,
  NoteDuration,
  SelectionState,
  UiMode,
  VoltaEnding,
} from '../types/music';
import { getSelectedMeasureIndices } from '../utils/musicMath';
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
  HelpCircle,
  MousePointer,
  Copy,
  ClipboardPaste,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  Repeat,
  Type,
  Check,
  Sparkles,
  Plus,
} from 'lucide-react';

interface RhythmicPaletteProps {
  uiMode: UiMode;
  onChangeUiMode: (mode: UiMode) => void;
  onReset: () => void;
  onAddMeasure: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  activeDuration: NoteDuration;
  onChangeDuration: (d: NoteDuration) => void;
  isRestMode: boolean;
  onToggleRestMode: () => void;
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
  currentMeasureHasRepeatStart?: boolean;
  currentMeasureHasRepeatEnd?: boolean;
  currentMeasureEnding?: VoltaEnding;
  onToggleEnding?: (ending: 1 | 2) => void;
  onToggleRepeatStart?: () => void;
  onToggleRepeatEnd?: () => void;
  onToggleRepeatMeasure?: () => void;
  onRepeatWholeSong?: () => void;
  onClearAllRepeats?: () => void;
  selectedNoteLyric?: string;
  onUpdateSelectedNoteLyric?: (lyric: string, advanceNext?: boolean) => void;
  onDeleteSelected: () => void;
  selection: SelectionState | null;
  hasClipboard: boolean;
  onCopyMeasure: () => void;
  onPasteMeasure: () => void;
  onMoveMeasureLeft: () => void;
  onMoveMeasureRight: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenHelp: () => void;
  isBigStaff?: boolean;
  onToggleBigStaff?: () => void;
}

export const RhythmicPalette: React.FC<RhythmicPaletteProps> = ({
  uiMode,
  onChangeUiMode,
  isBigStaff,
  onToggleBigStaff,
  onReset,
  onAddMeasure,
  isSelectMode,
  onToggleSelectMode,
  activeDuration,
  onChangeDuration,
  isRestMode,
  onToggleRestMode,
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
  currentMeasureHasRepeatStart = false,
  currentMeasureHasRepeatEnd = false,
  currentMeasureEnding = null,
  onToggleEnding,
  onToggleRepeatStart,
  onToggleRepeatEnd,
  onToggleRepeatMeasure,
  onRepeatWholeSong,
  onClearAllRepeats,
  selectedNoteLyric = '',
  onUpdateSelectedNoteLyric,
  onDeleteSelected,
  selection,
  hasClipboard,
  onCopyMeasure,
  onPasteMeasure,
  onMoveMeasureLeft,
  onMoveMeasureRight,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenHelp,
}) => {
  const isMeasureSelected = selection !== null && selection.itemIndex === -1;
  const hasSelection = selection !== null;
  const targetMeasureNum = (selection?.measureIndex ?? 0) + 1;
  const selectedMeasureIndices = getSelectedMeasureIndices(selection);
  const selectedMeasureCount = selectedMeasureIndices.length;
  const selectedMeasureRangeText =
    selectedMeasureCount > 1
      ? `${selectedMeasureIndices[0] + 1}–${selectedMeasureIndices[selectedMeasureIndices.length - 1] + 1}`
      : `${targetMeasureNum}`;

  const [openDropdown, setOpenDropdown] = useState<'repeat' | 'expressions' | 'lyric' | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const allDurations: { duration: NoteDuration; label: string; shortcut: string; icon: React.ReactNode }[] = [
    {
      duration: 1,
      label: 'Whole',
      shortcut: '1',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" className="fill-none stroke-current stroke-2">
          <ellipse cx="12" cy="12" rx="7" ry="5" transform="rotate(-15 12 12)" />
        </svg>
      ),
    },
    {
      duration: 0.5,
      label: 'Half',
      shortcut: '2',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" className="stroke-current stroke-2 fill-none">
          <ellipse cx="9" cy="15" rx="5" ry="3.5" transform="rotate(-15 9 15)" />
          <line x1="14" y1="14" x2="14" y2="4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      duration: 0.25,
      label: 'Quarter',
      shortcut: '3',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" className="stroke-current stroke-2 fill-current">
          <ellipse cx="9" cy="15" rx="5" ry="3.5" transform="rotate(-15 9 15)" />
          <line x1="14" y1="14" x2="14" y2="4" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      duration: 0.125,
      label: 'Eighth',
      shortcut: '4',
      icon: <EighthNoteUIIcon className="w-4 h-6 text-current" />,
    },
    {
      duration: 0.0625,
      label: '16th',
      shortcut: '5',
      icon: <SixteenthNoteUIIcon className="w-4 h-6 text-current" />,
    },
  ];

  const visibleDurations = allDurations.filter((d) => {
    if (uiMode === 'simple') {
      return d.duration === 0.25 || d.duration === 0.125;
    }
    if (uiMode === 'standard') {
      return d.duration >= 0.125;
    }
    return true;
  });

  const hasActiveExpression = Boolean(activeArticulation || activeDynamic);
  const hasActiveRepeat = Boolean(
    currentMeasureHasRepeatStart || currentMeasureHasRepeatEnd || currentMeasureEnding
  );

  return (
    <div
      ref={dropdownRef}
      className="w-full sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl px-3.5 py-2.5 flex flex-col gap-2 shadow-xl select-none"
    >
      {/* Main Unified Palette Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Mode Selector + Cursor Select + Durations + Rest */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Selector Segmented Tabs */}
          <div className="flex items-center gap-0.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                onChangeUiMode('simple');
                if (activeDuration < 0.125) onChangeDuration(0.25);
              }}
              title="Easy / Simple Mode (Colored & Labeled Notes)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                uiMode === 'simple'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/60'
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => {
                onChangeUiMode('standard');
                if (activeDuration < 0.125) onChangeDuration(0.25);
              }}
              title="Standard Mode"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                uiMode === 'standard'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-sky-300 hover:bg-slate-800/60'
              }`}
            >
              Standard
            </button>
            <button
              onClick={() => onChangeUiMode('advanced')}
              title="Advanced Mode (16th notes, Accidentals, Dots, Ties, Expressions)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                uiMode === 'advanced'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60'
              }`}
            >
              Advanced
            </button>
          </div>

          {/* Cursor Select Tool Button */}
          {uiMode !== 'simple' && (
            <button
              onClick={onToggleSelectMode}
              title="Cursor Select Tool (Click a notehead to select/drag that note, or click elsewhere in a measure to select the measure)"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
                isSelectMode
                  ? 'bg-sky-500 text-white ring-2 ring-sky-300'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
              }`}
            >
              <MousePointer className="w-3.5 h-3.5" />
              <span>Cursor</span>
            </button>
          )}

          {/* Note Durations + Rest */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            {visibleDurations.map((d) => {
              const isActive = activeDuration === d.duration && !isRestMode && !isSelectMode;
              return (
                <button
                  key={d.duration}
                  onClick={() => {
                    if (isSelectMode && (!selection || selection.itemIndex < 0)) {
                      onToggleSelectMode();
                    }
                    if (isRestMode) onToggleRestMode();
                    onChangeDuration(d.duration);
                  }}
                  title={`${d.label} Note (Press ${d.shortcut})`}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-300'
                      : 'text-slate-300 hover:bg-slate-700/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-center w-4.5 h-5">{d.icon}</div>
                  <span>{d.label}</span>
                </button>
              );
            })}

            <div className="w-px h-5 bg-slate-700 mx-0.5" />

            <button
              onClick={() => {
                if (isSelectMode) onToggleSelectMode();
                onToggleRestMode();
              }}
              title="Toggle Rest Mode (Press R)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isRestMode && !isSelectMode
                  ? 'bg-amber-500 text-slate-950 shadow-sm ring-1 ring-amber-300'
                  : 'text-slate-300 hover:bg-slate-700/70 hover:text-amber-400'
              }`}
            >
              <RestUIIcon className="w-3.5 h-4.5" />
              <span>Rest</span>
            </button>
          </div>

          {/* ✨ Big Staff! 🌈 Button (Simple Mode) */}
          {uiMode === 'simple' && onToggleBigStaff && (
            <button
              type="button"
              onClick={onToggleBigStaff}
              title={
                isBigStaff
                  ? 'Switch back to standard staff view'
                  : 'Switch to Big Staff view (Single large bar with peek of next bar for K/1st grade!)'
              }
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md select-none ${
                isBigStaff
                  ? 'bg-linear-to-r from-amber-400 via-rose-400 to-indigo-400 text-slate-950 ring-2 ring-amber-300 scale-105'
                  : 'bg-linear-to-r from-pink-500/20 via-purple-500/20 to-sky-500/20 hover:from-pink-500/35 hover:via-purple-500/35 hover:to-sky-500/35 text-white border border-pink-400/40 hover:border-pink-300 hover:scale-105'
              }`}
            >
              <span className="text-sm">✨</span>
              <span
                className={
                  isBigStaff
                    ? 'font-black tracking-wide'
                    : 'bg-linear-to-r from-amber-200 via-pink-200 to-sky-200 bg-clip-text text-transparent font-black tracking-wide'
                }
              >
                {isBigStaff ? 'Big Staff Active' : 'Big Staff!'}
              </span>
              <span className="text-sm">🌈</span>
            </button>
          )}

          {/* Repeat Sign Dropdown (Available in Standard & Advanced modes!) */}
          {uiMode !== 'simple' && (
            <div className="relative">
              <button
                onClick={() => setOpenDropdown((d) => (d === 'repeat' ? null : 'repeat'))}
                title="Add or remove Repeat Signs (|: and :|) and 1st/2nd Endings in the music"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  hasActiveRepeat
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span className="font-mono font-black tracking-tighter text-emerald-400">|: :|</span>
                <span>Repeat</span>
                {currentMeasureEnding && (
                  <span className="bg-amber-400 text-slate-950 px-1 py-0.2 rounded text-[10px] font-black leading-none font-serif">
                    {currentMeasureEnding}.
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-75" />
              </button>

              {openDropdown === 'repeat' && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pt-1 pb-0.5">
                    Measure {targetMeasureNum} Repeat Signs
                  </div>
                  <button
                    onClick={() => {
                      onToggleRepeatMeasure?.();
                      setOpenDropdown(null);
                    }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-emerald-300 transition-colors cursor-pointer"
                  >
                    <span>|: Repeat Measure {targetMeasureNum} :|</span>
                    {currentMeasureHasRepeatStart && currentMeasureHasRepeatEnd && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </button>
                  <button
                    onClick={() => {
                      onToggleRepeatStart?.();
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>|: Start Repeat on Measure {targetMeasureNum}</span>
                    {currentMeasureHasRepeatStart && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                  <button
                    onClick={() => {
                      onToggleRepeatEnd?.();
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>End Repeat :| on Measure {targetMeasureNum}</span>
                    {currentMeasureHasRepeatEnd && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                  <div className="h-px bg-slate-800 my-1" />
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 px-2.5 pt-1 pb-0.5">
                    1st & 2nd Endings (Volta)
                  </div>
                  <button
                    onClick={() => {
                      onToggleEnding?.(1);
                      setOpenDropdown(null);
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-serif font-black border border-amber-400/60 bg-amber-400/10 text-amber-300 rounded px-1.5 py-0.5 text-[11px] leading-none">
                        1.
                      </span>
                      <span>1st Ending on Measure {targetMeasureNum}</span>
                    </span>
                    {currentMeasureEnding === 1 && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  <button
                    onClick={() => {
                      onToggleEnding?.(2);
                      setOpenDropdown(null);
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <span className="font-serif font-black border border-amber-400/60 bg-amber-400/10 text-amber-300 rounded px-1.5 py-0.5 text-[11px] leading-none">
                        2.
                      </span>
                      <span>2nd Ending on Measure {targetMeasureNum}</span>
                    </span>
                    {currentMeasureEnding === 2 && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                  <div className="h-px bg-slate-800 my-1" />
                  <button
                    onClick={() => {
                      onRepeatWholeSong?.();
                      setOpenDropdown(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-800 text-left font-semibold text-sky-300 transition-colors cursor-pointer"
                  >
                    <Repeat className="w-3.5 h-3.5 text-sky-400" />
                    <span>|: Repeat Entire Song :|</span>
                  </button>
                  <button
                    onClick={() => {
                      onClearAllRepeats?.();
                      setOpenDropdown(null);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-rose-950/40 text-left font-semibold text-rose-300 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear All Repeats</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lyric Popover Button (Only shown in Advanced Mode) */}
          {uiMode === 'advanced' && onUpdateSelectedNoteLyric && (
            <div className="relative">
              <button
                onClick={() => setOpenDropdown((d) => (d === 'lyric' ? null : 'lyric'))}
                title="Add or edit lyrics underneath the selected note"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedNoteLyric
                    ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <Type className="w-3.5 h-3.5 text-purple-400" />
                <span>Lyrics</span>
              </button>

              {openDropdown === 'lyric' && (
                <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2 text-xs">
                  <div className="text-[11px] font-bold text-slate-300">
                    Lyric for Selected Note:
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={selectedNoteLyric}
                    onChange={(e) => onUpdateSelectedNoteLyric(e.target.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onUpdateSelectedNoteLyric(selectedNoteLyric, true);
                      } else if (e.key === 'Escape') {
                        setOpenDropdown(null);
                      }
                    }}
                    placeholder="Type word/syllable, press Enter..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:border-purple-400 focus:outline-hidden"
                  />
                  <div className="text-[10px] text-slate-400">
                    Press <b>Enter</b> or <b>Space</b> to move to the next note.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Advanced Mode Compact Controls: Modifiers, Accidentals & Consolidated Expressions Dropdown */}
          {uiMode === 'advanced' && (
            <>
              <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  onClick={onToggleDotted}
                  title="Dotted Rhythm (Press .)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isDotted ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  · Dot
                </button>
                <button
                  onClick={onToggleTied}
                  title="Tie Note (Press T)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isTied ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ‿ Tie
                </button>
                <button
                  onClick={onToggleTriplet}
                  title="Triplet (3 in the time of 2)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isTriplet ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ³ Triplet
                </button>
              </div>

              {/* Compact Accidentals */}
              <div className="flex items-center gap-0.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
                <button
                  onClick={() => onChangeAccidental(activeAccidental === 'sharp' ? null : 'sharp')}
                  title="Sharp (♯)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    activeAccidental === 'sharp'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <SharpUIIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onChangeAccidental(activeAccidental === 'flat' ? null : 'flat')}
                  title="Flat (♭)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    activeAccidental === 'flat'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <FlatUIIcon className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onChangeAccidental(activeAccidental === 'natural' ? null : 'natural')}
                  title="Natural (♮)"
                  className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                    activeAccidental === 'natural'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <NaturalUIIcon className="w-3 h-3" />
                </button>
              </div>

              {/* Consolidated Expressions (Articulations & Dynamics) Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setOpenDropdown((d) => (d === 'expressions' ? null : 'expressions'))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    hasActiveExpression
                      ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Expressions
                    {activeArticulation || activeDynamic
                      ? ` (${[activeArticulation, activeDynamic].filter(Boolean).join(', ')})`
                      : ''}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-75" />
                </button>

                {openDropdown === 'expressions' && (
                  <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Articulations & Accents
                      </div>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'accent', label: '>', title: 'Accent' },
                            { id: 'staccato', label: '·', title: 'Staccato' },
                            { id: 'tenuto', label: '—', title: 'Tenuto' },
                            { id: 'marcato', label: '^', title: 'Marcato' },
                            { id: 'fermata', label: '𝄐', title: 'Fermata' },
                          ] as const
                        ).map((art) => (
                          <button
                            key={art.id}
                            onClick={() =>
                              onChangeArticulation(activeArticulation === art.id ? null : art.id)
                            }
                            title={art.title}
                            className={`py-1.5 rounded-lg font-black text-center transition-all cursor-pointer ${
                              activeArticulation === art.id
                                ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {art.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-slate-800" />

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Dynamics (Volume Markings)
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {(
                          [
                            { id: 'pp', label: 'pp' },
                            { id: 'p', label: 'p' },
                            { id: 'mp', label: 'mp' },
                            { id: 'mf', label: 'mf' },
                            { id: 'f', label: 'f' },
                            { id: 'ff', label: 'ff' },
                            { id: 'sfz', label: 'sfz' },
                          ] as const
                        ).map((dyn) => (
                          <button
                            key={dyn.id}
                            onClick={() =>
                              onChangeDynamic(activeDynamic === dyn.id ? null : dyn.id)
                            }
                            className={`py-1.5 rounded-lg font-serif italic font-black text-center transition-all cursor-pointer ${
                              activeDynamic === dyn.id
                                ? 'bg-rose-600 text-white ring-1 ring-rose-300'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {dyn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right: + Measure, Undo/Redo, Delete, Reset, Help */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddMeasure}
            title="Add a new empty measure to the score"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Measure</span>
          </button>

          <div className="w-px h-5 bg-slate-800 mx-0.5" />
          {!isMeasureSelected && uiMode !== 'simple' && (
            <button
              onClick={onDeleteSelected}
              disabled={!hasSelection}
              title="Delete Selected Note (Backspace / Del)"
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                hasSelection
                  ? 'text-rose-400 hover:bg-rose-950/50 hover:text-rose-300'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              canUndo ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className={`p-1.5 rounded-xl transition-all cursor-pointer ${
              canRedo ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-slate-800 mx-0.5" />

          <button
            onClick={onReset}
            title="Reset: Erase all notes and start with a clean staff (Undoable)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-600/90 hover:bg-rose-500 text-white transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <button
            onClick={onOpenHelp}
            title="Shortcuts & Instructions"
            className="p-1.5 rounded-xl text-sky-400 hover:bg-slate-800 transition-all cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contextual Measure Action Bar (Only appears when a measure is clicked in Cursor mode) */}
      {isMeasureSelected && uiMode !== 'simple' && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-cyan-950/80 border border-cyan-500/60 px-3 py-1.5 rounded-xl text-xs">
          <span className="font-bold text-cyan-300">
            {selectedMeasureCount > 1
              ? `Measures ${selectedMeasureRangeText} Selected (${selectedMeasureCount} Measures):`
              : `Measure ${targetMeasureNum} Selected:`}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedMeasureCount <= 1 && (
              <button
                onClick={onToggleRepeatMeasure}
                title="Wrap this measure in Repeat Signs (|: :|)"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-emerald-700/80 text-emerald-100 hover:bg-emerald-600 transition-all cursor-pointer"
              >
                <span className="font-mono">|: :|</span>
                <span>Repeat Measure</span>
              </button>
            )}
            <button
              onClick={onCopyMeasure}
              title={
                selectedMeasureCount > 1
                  ? `Copy ${selectedMeasureCount} Measures (Ctrl+C)`
                  : 'Copy Measure Notes (Ctrl+C)'
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-cyan-800 text-cyan-100 hover:bg-cyan-700 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy{selectedMeasureCount > 1 ? ` (${selectedMeasureCount})` : ''}</span>
            </button>
            <button
              onClick={onPasteMeasure}
              disabled={!hasClipboard}
              title="Paste Measure Notes (Ctrl+V)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                hasClipboard
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
            {selectedMeasureCount <= 1 && (
              <>
                <button
                  onClick={onMoveMeasureLeft}
                  disabled={(selection?.measureIndex ?? 0) === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onMoveMeasureRight}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              onClick={onDeleteSelected}
              title={selectedMeasureCount > 1 ? `Delete ${selectedMeasureCount} Selected Measures` : 'Clear Measure'}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-rose-900/70 text-rose-200 hover:bg-rose-800 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{selectedMeasureCount > 1 ? `Delete (${selectedMeasureCount})` : 'Clear'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
