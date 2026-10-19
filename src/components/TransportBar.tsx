import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Plus,
  Printer,
  BookOpen,
  Layers,
  Drum,
  FileMusic,
  Share2,
  Download,
  Upload,
  ChevronDown,
  Repeat,
  GraduationCap,
  Music,
  FileAudio,
  FileCode,
  Check,
  Maximize2,
  Columns,
  Rows,
  Sliders,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';
import { CountingMode, NoteLabelMode, ViewLayout } from '../types/music';
import { BOOMWHACKER_COLORS, getTempoDescription } from '../utils/musicMath';
import { soundEngine } from '../audio/soundEngine';

interface TransportBarProps {
  onBackToHub?: () => void;
  title: string;
  composer: string;
  onChangeTitle: (title: string) => void;
  onChangeComposer: (composer: string) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRewind: () => void;
  isLoopingMeasure: boolean;
  onToggleLoopMeasure: () => void;
  selectedMeasureNumber: number;
  tempo: number;
  onChangeTempo: (bpm: number) => void;
  metronome: boolean;
  onToggleMetronome: () => void;
  timeSignature: [number, number];
  onChangeTimeSignature: (ts: [number, number]) => void;
  keySignature: 'C' | 'G' | 'F' | 'D' | 'Bb';
  onChangeKeySignature: (ks: 'C' | 'G' | 'F' | 'D' | 'Bb') => void;
  onAddMeasure: () => void;
  onOpenTemplates: () => void;
  onOpenToolBox?: () => void;
  onPrint: () => void;
  onOpenInstrumentManager: () => void;
  onOpenDrumBeats: () => void;
  onNewBlankScore: () => void;
  trackCount: number;
  onToggleMixer: () => void;
  onShare: () => void;
  // View & Full Screen
  viewLayout: ViewLayout;
  onChangeViewLayout: (layout: ViewLayout) => void;
  onEnterFullScreen: () => void;
  // Student Helpers (consolidated into dropdown)
  noteLabelMode: NoteLabelMode;
  onChangeNoteLabelMode: (mode: NoteLabelMode) => void;
  countingMode: CountingMode;
  onChangeCountingMode: (mode: CountingMode) => void;
  boomwhackerColors: boolean;
  onToggleBoomwhackerColors: () => void;
  showBeatCounters: boolean;
  onToggleBeatCounters: () => void;
  // Exports (consolidated into dropdown)
  onExportPdf: () => void;
  onExportWav: () => void;
  onExportMidi: () => void;
  onExportMusicXml: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  lastSavedTime: string | null;
  studentFirstName?: string | null;
  editingAsTeacherStudentName?: string | null;
  cloudSaveStatus?: 'idle' | 'saving' | 'saved' | 'untitled';
  onOpenClassroomModal: () => void;
  isAvatarOpen: boolean;
  onOpenAvatar: () => void;
  onCloseAvatar: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  onBackToHub,
  title,
  composer,
  onChangeTitle,
  onChangeComposer,
  isPlaying,
  onTogglePlay,
  onRewind,
  isLoopingMeasure,
  onToggleLoopMeasure,
  selectedMeasureNumber,
  tempo,
  onChangeTempo,
  metronome,
  onToggleMetronome,
  timeSignature,
  onChangeTimeSignature,
  keySignature,
  onChangeKeySignature,
  onAddMeasure,
  onOpenTemplates,
  onOpenToolBox,
  onPrint,
  onOpenInstrumentManager,
  onOpenDrumBeats,
  onNewBlankScore,
  trackCount,
  onToggleMixer,
  onShare,
  viewLayout,
  onChangeViewLayout,
  onEnterFullScreen,
  noteLabelMode,
  onChangeNoteLabelMode,
  countingMode,
  onChangeCountingMode,
  boomwhackerColors,
  onToggleBoomwhackerColors,
  showBeatCounters,
  onToggleBeatCounters,
  onExportPdf,
  onExportWav,
  onExportMidi,
  onExportMusicXml,
  onExportJson,
  onImportJson,
  lastSavedTime,
  studentFirstName,
  editingAsTeacherStudentName,
  cloudSaveStatus = 'idle',
  onOpenClassroomModal,
  isAvatarOpen,
  onOpenAvatar,
  onCloseAvatar,
}) => {
  const tempoInfo = getTempoDescription(tempo);
  const [openMenu, setOpenMenu] = useState<'ensemble' | 'helpers' | 'export' | null>(null);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeHelperCount =
    (noteLabelMode !== 'off' ? 1 : 0) +
    (countingMode !== 'off' ? 1 : 0) +
    (boomwhackerColors ? 1 : 0) +
    (showBeatCounters ? 1 : 0);

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white shadow-xl relative z-40">
      {/* Brand & Score Title */}
      <div className="flex items-center gap-3.5 min-w-[240px]">
        {onBackToHub && (
          <button
            type="button"
            onClick={onBackToHub}
            title="Return to Mr. Arthur's Music Lab Hub"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Music Lab</span>
          </button>
        )}
        <div className="flex items-center gap-2.5 pr-4 border-r border-slate-700/80">
          <button
            type="button"
            onClick={() => {
              soundEngine.playWelcomeChime();
              onOpenAvatar();
            }}
            title="Click to enlarge Mr. Arthur's avatar!"
            className="w-11 h-11 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-amber-300/50 hover:ring-amber-300 hover:scale-110 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
          >
            <img
              src="/mr-arthur-avatar.jpg"
              alt="Mr. Arthur"
              className="w-full h-full object-cover object-top"
            />
          </button>
          <div className="flex flex-col justify-center select-none">
            <span className="text-[11px] sm:text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
              Mr. Arthur&apos;s
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
              Staff Composer
            </span>
          </div>
        </div>

        {/* Editable Score Title & Composer + Minimal Student Login Trigger */}
        <div className="flex items-center gap-2.5">
          <div className="flex flex-col">
            <input
              type="text"
              value={title}
              onChange={(e) => onChangeTitle(e.target.value)}
              placeholder="Score Title..."
              className="text-sm font-bold text-white border-b border-transparent hover:border-slate-600 focus:border-sky-400 focus:outline-hidden bg-transparent py-0.5 placeholder:text-slate-500 w-36 sm:w-44"
            />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={composer}
                onChange={(e) => onChangeComposer(e.target.value)}
                placeholder="Composer..."
                className="text-xs text-slate-400 border-b border-transparent hover:border-slate-600 focus:border-sky-400 focus:outline-hidden bg-transparent py-0.5 placeholder:text-slate-600 w-24 sm:w-28"
              />
              {cloudSaveStatus === 'saving' ? (
                <span className="text-[10px] text-sky-300 font-semibold hidden xl:inline">
                  Saving...
                </span>
              ) : cloudSaveStatus === 'saved' ? (
                <span className="text-[10px] text-emerald-400 font-semibold hidden xl:inline">
                  ✓ Auto-Saved
                </span>
              ) : cloudSaveStatus === 'untitled' ? (
                <span
                  title="Type a song title above to automatically save this song to your account"
                  className="text-[10px] text-amber-300/90 hidden xl:inline"
                >
                  Title to save
                </span>
              ) : (
                lastSavedTime && (
                  <span className="text-[10px] text-emerald-400/80 hidden xl:inline">
                    ✓ Saved
                  </span>
                )
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenClassroomModal}
            title={
              editingAsTeacherStudentName
                ? `Teacher Mode: Editing ${editingAsTeacherStudentName}'s song (click to open Teacher Portal)`
                : studentFirstName
                ? `Signed in as ${studentFirstName} — click to view your saved songs or log out`
                : 'Student Sign In'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
              editingAsTeacherStudentName
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
                : studentFirstName
                ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>
              {editingAsTeacherStudentName
                ? `🎓 ${editingAsTeacherStudentName}`
                : studentFirstName
                ? studentFirstName
                : 'Sign In'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Playback Transport + Tempo + Meter/Key */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={(e) => {
            e.currentTarget.blur();
            onRewind();
          }}
          title="Return to Start"
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => {
            e.currentTarget.blur();
            onTogglePlay();
          }}
          title={isPlaying ? 'Pause (Space)' : 'Play Score (Space)'}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 cursor-pointer ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 animate-pulse'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          <span>{isPlaying ? 'Pause' : 'Play'}</span>
        </button>

        {/* Loop Selected Measure Toggle */}
        <button
          onClick={onToggleLoopMeasure}
          title={`Loop Measure ${selectedMeasureNumber} during playback`}
          className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isLoopingMeasure
              ? 'bg-amber-500/20 border-amber-400 text-amber-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isLoopingMeasure ? `Loop M${selectedMeasureNumber}` : 'Loop'}
          </span>
        </button>

        {/* Metronome Toggle */}
        <button
          onClick={onToggleMetronome}
          title={`Metronome Click: ${metronome ? 'ON' : 'OFF'}`}
          className={`flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            metronome
              ? 'bg-sky-500/20 border-sky-400 text-sky-300'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Click</span>
        </button>

        {/* Compact Tempo Control */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 px-3 py-1 rounded-xl">
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-200">
              <span>{tempoInfo.term}</span>
              <span className="font-mono text-sky-400">{tempo} BPM</span>
            </div>
            <input
              type="range"
              min="40"
              max="208"
              value={tempo}
              onChange={(e) => onChangeTempo(Number(e.target.value))}
              className="w-24 sm:w-28 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400 mt-1"
            />
          </div>
        </div>

        {/* Compact Meter & Key */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-xs">
          <select
            value={`${timeSignature[0]}/${timeSignature[1]}`}
            onChange={(e) => {
              const [b, v] = e.target.value.split('/').map(Number);
              onChangeTimeSignature([b, v]);
            }}
            title="Time Signature (Meter)"
            className="font-bold text-white bg-transparent focus:outline-hidden cursor-pointer"
          >
            <option value="4/4" className="bg-slate-900 text-white">4/4</option>
            <option value="3/4" className="bg-slate-900 text-white">3/4</option>
            <option value="2/4" className="bg-slate-900 text-white">2/4</option>
            <option value="6/8" className="bg-slate-900 text-white">6/8</option>
          </select>
          <span className="text-slate-600">|</span>
          <select
            value={keySignature}
            onChange={(e) => onChangeKeySignature(e.target.value as any)}
            title="Key Signature"
            className="font-bold text-white bg-transparent focus:outline-hidden cursor-pointer"
          >
            <option value="C" className="bg-slate-900 text-white">Key: C</option>
            <option value="G" className="bg-slate-900 text-white">Key: G (1♯)</option>
            <option value="F" className="bg-slate-900 text-white">Key: F (1♭)</option>
            <option value="D" className="bg-slate-900 text-white">Key: D (2♯)</option>
            <option value="Bb" className="bg-slate-900 text-white">Key: B♭ (2♭)</option>
          </select>
        </div>
      </div>

      {/* Consolidated Right Dropdown Menus (Minimizing Clutter!) */}
      <div ref={menuContainerRef} className="flex items-center gap-2">
        {/* Quick Mixer Button (Replaced + Measure which moved down to the note palette) */}
        <button
          onClick={onToggleMixer}
          title="Open Virtual Studio Mixer (Faders, Pan, Mute/Solo & Studio FX)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 transition-all active:scale-95 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Mixer</span>
          <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/40 text-indigo-100 text-[10px] font-black">
            {trackCount}
          </span>
        </button>

        {/* 1) Ensemble & Songs Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu((m) => (m === 'ensemble' ? null : 'ensemble'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Instruments & Songs</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-75" />
          </button>

          {openMenu === 'ensemble' && (
            <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onOpenInstrumentManager();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-sky-300 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Add Instrument Track...</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onOpenDrumBeats();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-rose-300 transition-colors cursor-pointer"
              >
                <Drum className="w-4 h-4 text-rose-400" />
                <span>Add Drum Beat Pattern...</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onToggleMixer();
                }}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <span>Track Mixer / Mute / Solo</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                  {trackCount}
                </span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onOpenTemplates();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-amber-300 transition-colors cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-amber-400" />
                <span>Song Templates & Challenges</span>
              </button>
              {onOpenToolBox && (
                <button
                  onClick={() => {
                    setOpenMenu(null);
                    onOpenToolBox();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-sky-300 transition-colors cursor-pointer"
                >
                  <span className="text-sm">🎒</span>
                  <span>Classroom Tool Box (Tapper, Pitch, Zoo)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* 2) Student Helpers Dropdown (Letters, Solfege, Scale Degrees, Counting, Colors) */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu((m) => (m === 'helpers' ? null : 'helpers'))}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeHelperCount > 0
                ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
          >
            <GraduationCap className="w-4 h-4 text-amber-400" />
            <span>Helpers</span>
            {activeHelperCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                {activeHelperCount}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 opacity-75" />
          </button>

          {openMenu === 'helpers' && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 flex flex-col gap-2.5 text-xs">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Note Pitch Labels
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(
                    [
                      { id: 'off', label: 'Off (Standard Notation)' },
                      { id: 'letters', label: 'Note Letters (C, D, E, F, G...)' },
                      { id: 'solfege_movable', label: `Solfege - Movable Do (Key of ${keySignature})` },
                      { id: 'solfege_fixed', label: 'Solfege - Fixed Do (C = Do)' },
                      { id: 'scale_degrees', label: `Scale Degrees (1, 2, 3 in ${keySignature})` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onChangeNoteLabelMode(opt.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left font-semibold transition-colors cursor-pointer ${
                        noteLabelMode === opt.id
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {noteLabelMode === opt.id && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
                  Rhythm Counting Underlay
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {(
                    [
                      { id: 'off', label: 'Off' },
                      { id: 'numbers', label: 'Standard Counting (1 e & a)' },
                      { id: 'kodaly', label: 'Kodály Syllables (ta, ti-ti, ti-ri)' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => onChangeCountingMode(opt.id)}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left font-semibold transition-colors cursor-pointer ${
                        countingMode === opt.id
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {countingMode === opt.id && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-800" />

              {/* Visual Toggles */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={onToggleBoomwhackerColors}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                    boomwhackerColors
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Boomwhacker Note Colors</span>
                  <span className="text-[10px] font-bold">{boomwhackerColors ? 'ON' : 'OFF'}</span>
                </button>

                {boomwhackerColors && (
                  <div className="flex items-center justify-between px-2 py-1 bg-slate-950/80 rounded-lg">
                    {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((st) => (
                      <span
                        key={st}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                        style={{
                          backgroundColor: BOOMWHACKER_COLORS[st].bg,
                          color: BOOMWHACKER_COLORS[st].text,
                        }}
                      >
                        {st}
                      </span>
                    ))}
                  </div>
                )}

                <button
                  onClick={onToggleBeatCounters}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                    showBeatCounters
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Beat Ruler (1 - 2 - 3 - 4)</span>
                  <span className="text-[10px] font-bold">{showBeatCounters ? 'ON' : 'OFF'}</span>
                </button>
              </div>

              <div className="h-px bg-slate-800 my-2" />

              {/* Score View Layout */}
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 pb-1">
                Score View Layout
              </div>
              <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                <button
                  onClick={() => onChangeViewLayout('vertical')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                    viewLayout === 'vertical'
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50'
                      : 'text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Rows className="w-3.5 h-3.5" />
                  <span>Page View</span>
                </button>
                <button
                  onClick={() => onChangeViewLayout('horizontal')}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl font-semibold transition-colors cursor-pointer ${
                    viewLayout === 'horizontal'
                      ? 'bg-sky-500/25 text-sky-300 border border-sky-500/50'
                      : 'text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Horizontal</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick View Layout Toggle (Page vs Horizontal Auto-Scroll) */}
        <button
          onClick={() =>
            onChangeViewLayout(viewLayout === 'vertical' ? 'horizontal' : 'vertical')
          }
          className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            viewLayout === 'horizontal'
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-sm shadow-cyan-500/10'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title={
            viewLayout === 'horizontal'
              ? 'Horizontal Auto-Scroll View active — Click to switch to Vertical Page View'
              : 'Vertical Page View active — Click to switch to Horizontal Auto-Scroll View'
          }
        >
          {viewLayout === 'horizontal' ? (
            <>
              <Columns className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Horizontal</span>
            </>
          ) : (
            <>
              <Rows className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden xl:inline">Page View</span>
            </>
          )}
        </button>

        {/* Full Screen Composition Mode Button */}
        <button
          onClick={onEnterFullScreen}
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 transition-all cursor-pointer"
          title="Full Screen Mode: Larger staff & notes with a compact floating tool palette"
        >
          <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden xl:inline">Full Screen</span>
        </button>

        {/* 3) Share, Print & Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 transition-all cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Share</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-75" />
          </button>

          {openMenu === 'export' && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pt-1 pb-0.5">
                Shareable Link
              </div>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onShare();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-left font-bold text-sky-300 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>Share Link to Song</span>
              </button>

              <div className="h-px bg-slate-800 my-1" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pb-0.5">
                Sheet Music & Print
              </div>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onExportPdf();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-bold text-emerald-300 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Save PDF Directly (.pdf)</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onPrint();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-sky-400" />
                <span>Print Preview / Sheet Music</span>
              </button>

              <div className="h-px bg-slate-800 my-1" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pb-0.5">
                Audio & Notation Apps
              </div>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onExportWav();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-amber-300 transition-colors cursor-pointer"
              >
                <FileAudio className="w-4 h-4 text-amber-400" />
                <span>Download Audio (.wav)</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onExportMidi();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Music className="w-4 h-4 text-purple-400" />
                <span>Export MIDI (.mid)</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onExportMusicXml();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Export MusicXML (.musicxml)</span>
              </button>

              <div className="h-px bg-slate-800 my-1" />
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2.5 pb-0.5">
                Project File
              </div>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onExportJson();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Save Project File (.json)</span>
              </button>
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onImportJson();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-slate-800 text-left font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                <span>Load Project File (.json)</span>
              </button>
              <div className="h-px bg-slate-800 my-1" />
              <button
                onClick={() => {
                  setOpenMenu(null);
                  onNewBlankScore();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl hover:bg-rose-950/50 text-left font-semibold text-rose-300 transition-colors cursor-pointer"
              >
                <FileMusic className="w-4 h-4 text-rose-400" />
                <span>New Blank Staff</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mr. Arthur Avatar Pop-Out Modal (click anywhere on or off image to dismiss) */}
      {isAvatarOpen && (
        <div
          onClick={onCloseAvatar}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150 cursor-pointer"
        >
          <div className="relative bg-slate-900 border-2 border-amber-400/60 rounded-3xl p-4 sm:p-5 shadow-2xl max-w-sm w-full flex flex-col items-center gap-3 animate-in zoom-in-95 duration-150">
            <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden bg-black border border-slate-700 shadow-xl ring-2 ring-amber-400/30">
              <img
                src="/mr-arthur-avatar.jpg"
                alt="Mr. Arthur"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300 font-['Fredoka',sans-serif]">
                Welcome to
              </div>
              <div className="text-xl font-black bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif]">
                Mr. Arthur&apos;s Staff Composer!
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
