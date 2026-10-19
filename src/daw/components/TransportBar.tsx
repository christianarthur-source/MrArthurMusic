import React from 'react';
import {
  Play,
  Square,
  Circle,
  Repeat,
  Volume2,
  Clock,
  Download,
  Cloud,
  Undo2,
  Redo2,
  Sliders,
  Music,
  FolderOpen,
  Mic,
} from 'lucide-react';
import { DawProject, DawSnapGrid, DawToolMode } from '../types';

interface TransportBarProps {
  project: DawProject;
  isPlaying: boolean;
  currentBeat: number;
  isRecording: boolean;
  activeDrawerTab: 'loops' | 'virtual-piano' | 'piano-roll' | 'mixer' | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleRecord: () => void;
  onChangeBpm: (bpm: number) => void;
  onChangeSnapGrid: (snap: DawSnapGrid) => void;
  onToggleLoopRegion: () => void;
  onToggleDrawerTab: (tab: 'loops' | 'virtual-piano' | 'piano-roll' | 'mixer') => void;
  onSaveProject: () => void;
  onExportWav: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isSaving?: boolean;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  project,
  isPlaying,
  currentBeat,
  isRecording,
  activeDrawerTab,
  onTogglePlay,
  onStop,
  onToggleRecord,
  onChangeBpm,
  onChangeSnapGrid,
  onToggleLoopRegion,
  onToggleDrawerTab,
  onSaveProject,
  onExportWav,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isSaving,
}) => {
  // Format currentBeat into Measure.Beat.Tick (e.g. 1.1.00)
  const measure = Math.floor(currentBeat / 4) + 1;
  const beatInMeasure = Math.floor(currentBeat % 4) + 1;
  const tick = Math.floor(((currentBeat % 1) * 100));
  const timeFormatted = `${measure}.${beatInMeasure}.${tick.toString().padStart(2, '0')}`;

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 text-white shadow-md select-none flex-wrap">
      {/* Left: Playback Controls & Time Display */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all cursor-pointer shadow-md ${
            isPlaying
              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 ring-2 ring-amber-300'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
          }`}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <div className="flex gap-1">
              <div className="w-1.5 h-4 bg-slate-950 rounded-xs" />
              <div className="w-1.5 h-4 bg-slate-950 rounded-xs" />
            </div>
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Stop Button */}
        <button
          type="button"
          onClick={onStop}
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
          title="Stop & Return to Start"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>

        {/* Record Button */}
        <button
          type="button"
          onClick={onToggleRecord}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border ${
            isRecording
              ? 'bg-rose-500 text-white animate-pulse border-rose-400 shadow-md shadow-rose-500/40'
              : 'bg-slate-800 hover:bg-slate-700 text-rose-400 border-slate-700'
          }`}
          title="Record Live Mic / Instrument"
        >
          <Circle className="w-4 h-4 fill-current" />
        </button>

        {/* Big Time / Measure Readout */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 font-mono text-xs sm:text-sm font-bold text-amber-300 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{timeFormatted}</span>
        </div>

        {/* Loop Region Toggle */}
        <button
          type="button"
          onClick={onToggleLoopRegion}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            project.loopRegion.enabled
              ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 shadow-xs'
              : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
          }`}
          title="Loop Section (Cycle)"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Loop</span>
        </button>
      </div>

      {/* Center: BPM & Snap Grid Controls */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Tempo / BPM */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">BPM</span>
          <input
            type="number"
            min={40}
            max={240}
            value={project.bpm}
            onChange={(e) => onChangeBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
            className="w-12 text-center text-xs font-bold text-white bg-transparent focus:outline-none"
          />
        </div>

        {/* Snap to Grid Selector */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400 hidden sm:inline mr-1">Snap</span>
          {(['1bar', '1/2', '1/4', '1/8'] as DawSnapGrid[]).map((snap) => (
            <button
              key={snap}
              type="button"
              onClick={() => onChangeSnapGrid(snap)}
              className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                project.snapGrid === snap
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {snap === '1bar' ? 'Bar' : snap}
            </button>
          ))}
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right: Drawer Tabs & Cloud Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Loop Library Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawerTab('loops')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            activeDrawerTab === 'loops'
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          <span>🔄</span>
          <span>Loops</span>
        </button>

        {/* Live Virtual Piano Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawerTab('virtual-piano')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            activeDrawerTab === 'virtual-piano'
              ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
          title="Play live virtual instruments with your computer keys"
        >
          <span>🎹</span>
          <span>Virtual Piano</span>
        </button>

        {/* Piano Roll / MIDI Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawerTab('piano-roll')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            activeDrawerTab === 'piano-roll'
              ? 'bg-sky-400 text-slate-950 border-sky-300 shadow-md font-black'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          <span>🎼</span>
          <span>Piano Roll</span>
        </button>

        {/* Mixer & FX Drawer Toggle */}
        <button
          type="button"
          onClick={() => onToggleDrawerTab('mixer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
            activeDrawerTab === 'mixer'
              ? 'bg-rose-500 text-white border-rose-400 shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Mixer</span>
        </button>

        {/* Save Song Button */}
        <button
          type="button"
          onClick={onSaveProject}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 transition-all cursor-pointer"
        >
          <Cloud className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isSaving ? 'Saving...' : 'Save ☁️'}</span>
        </button>

        {/* Export Audio Mixdown Button */}
        <button
          type="button"
          onClick={onExportWav}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 transition-all cursor-pointer shadow-md font-['Fredoka',sans-serif]"
          title="Download Mixdown as WAV file"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export WAV</span>
        </button>
      </div>
    </div>
  );
};
