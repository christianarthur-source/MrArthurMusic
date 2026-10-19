import React, { useState, useEffect, useRef } from 'react';
import { BeatTrack, SoundType } from '../types';
import { ALL_AVAILABLE_SAMPLES, SOUND_PACKS, BEAT_PRESETS } from '../data/soundPacks';
import { getTempoDescription } from './Header';
import {
  Volume2,
  VolumeX,
  ChevronDown,
  RotateCcw,
  Plus,
  Minus,
  Play,
  Square,
  Sparkles,
  X,
  Check,
} from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface BeatGridProps {
  tracks: BeatTrack[];
  currentStep: number;
  totalStepsInMeasure: 8 | 16;
  activeMeasure: number;
  totalMeasures: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onChangeActiveMeasure: (m: number) => void;
  onAddMeasure: () => void;
  onRemoveMeasure?: () => void;
  onToggleStep: (trackIndex: number, absoluteStepIndex: number) => void;
  onResetBeats: () => void;
  onMagicBeat?: () => void;
  onToggleMute: (trackIndex: number) => void;
  onToggleSolo: (trackIndex: number) => void;
  onChangeVolume: (trackIndex: number, vol: number) => void;
  onChangePitch: (trackIndex: number, pitch: number) => void;
  onChangeSample: (trackIndex: number, soundType: SoundType) => void;
  currentPackId?: string;
  onSelectPack?: (packId: string) => void;
  onSelectPreset?: (presetId: string) => void;
}

export const BeatGrid: React.FC<BeatGridProps> = ({
  tracks,
  currentStep,
  totalStepsInMeasure,
  activeMeasure: _activeMeasure,
  totalMeasures,
  isPlaying = false,
  onTogglePlay,
  onChangeActiveMeasure: _onChangeActiveMeasure,
  onAddMeasure,
  onRemoveMeasure,
  onToggleStep,
  onResetBeats,
  onMagicBeat,
  onToggleMute,
  onToggleSolo,
  onChangeVolume: _onChangeVolume,
  onChangePitch,
  onChangeSample,
  currentPackId = 'space-disco',
  onSelectPack,
  onSelectPreset,
}) => {
  const [selectedTrackIndexForSound, setSelectedTrackIndexForSound] = useState<number | null>(null);
  const [soundCategoryFilter, setSoundCategoryFilter] = useState<'all' | 'drums' | 'silly' | 'melody'>('all');
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const [isPackDropdownOpen, setIsPackDropdownOpen] = useState(false);
  const [isGrooveDropdownOpen, setIsGrooveDropdownOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevTotalMeasuresRef = useRef(totalMeasures);

  const handleStepMouseDown = (tIdx: number, absoluteStep: number, currentVal: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDown(true);
    const newVal = !currentVal;
    setDragMode(newVal);
    onToggleStep(tIdx, absoluteStep);
  };

  const handleStepMouseEnter = (tIdx: number, absoluteStep: number, currentVal: boolean) => {
    if (isMouseDown && dragMode !== null && currentVal !== dragMode) {
      onToggleStep(tIdx, absoluteStep);
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false);
      setDragMode(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    if (currentStep === 0) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const activeEl = container.querySelector<HTMLElement>(`[data-beat-step="${currentStep}"]`);
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const stepRect = activeEl.getBoundingClientRect();
      const stickyMargin = 220; // width of sticky track column

      if (stepRect.right > containerRect.right - 20) {
        container.scrollBy({ left: stepRect.right - containerRect.right + 100, behavior: 'smooth' });
      } else if (stepRect.left < containerRect.left + stickyMargin) {
        container.scrollBy({ left: stepRect.left - (containerRect.left + stickyMargin) - 40, behavior: 'smooth' });
      }
    }
  }, [currentStep, isPlaying]);

  // When measures are added, smoothly scroll to reveal the newly extended space
  useEffect(() => {
    if (totalMeasures > prevTotalMeasuresRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({
            left: scrollContainerRef.current.scrollWidth,
            behavior: 'smooth',
          });
        }
      }, 60);
    }
    prevTotalMeasuresRef.current = totalMeasures;
  }, [totalMeasures]);

  const scrollToMeasure = (mIdx: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const targetEl = container.querySelector<HTMLElement>(`[data-beat-measure="${mIdx}"]`);
    if (targetEl) {
      const leftPos = Math.max(0, targetEl.offsetLeft - 240);
      container.scrollTo({ left: leftPos, behavior: 'smooth' });
    }
  };

  const previewSound = (track: BeatTrack) => {
    soundEngine.playSound(track.sample.soundType, 0, track.volume, track.pitch);
  };

  const stepsPerMeasure = totalStepsInMeasure;
  const beatDivider = stepsPerMeasure === 16 ? 4 : 2;

  const activePack = SOUND_PACKS.find((p) => p.id === currentPackId) || SOUND_PACKS[0];

  return (
    <div className="rounded-3xl border-2 border-app-border bg-app-card/90 p-4 sm:p-5 shadow-2xl overflow-visible">
      {/* Top Bar: Play Button + Section Title + Timeline / Measures Controls + Magic Beat & Reset Buttons */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-app-border/80 pb-3">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 active:scale-95 ${
                isPlaying
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.7)] ring-2 ring-emerald-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:scale-105'
              }`}
              title={isPlaying ? 'Pause' : 'Play Drum Beat'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Square className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 translate-x-0.5" />
              )}
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-xl">🥁</span>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Drum Beat
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Song Timeline Length Info & Quick Jump */}
          <div className="flex items-center gap-1.5 rounded-xl bg-app-bg/90 p-1.5 border border-app-border">
            <span className="text-[11px] font-black uppercase tracking-wider text-pink-300 px-1">
              Song: {totalMeasures} {totalMeasures === 1 ? 'Measure' : 'Measures'} ({totalMeasures * stepsPerMeasure} Steps)
            </span>

            {/* Quick jump to measure buttons */}
            {totalMeasures > 1 && (
              <div className="flex items-center gap-1 border-l border-slate-700 pl-1.5">
                <span className="text-[10px] font-bold text-slate-400">Jump:</span>
                {Array.from({ length: totalMeasures }).map((_, mIdx) => {
                  const isCurrentPlayingMeasure = isPlaying && Math.floor(currentStep / stepsPerMeasure) === mIdx;
                  return (
                    <button
                      key={mIdx}
                      onClick={() => scrollToMeasure(mIdx)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-black transition-all ${
                        isCurrentPlayingMeasure
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                      title={`Jump to Measure ${mIdx + 1}`}
                    >
                      <span>M{mIdx + 1}</span>
                      {isCurrentPlayingMeasure && (
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Add Measure Button to extend song further to the right */}
            {totalMeasures < 4 && (
              <button
                onClick={onAddMeasure}
                className="flex items-center gap-1 rounded-lg bg-pink-600/80 px-2.5 py-1 text-xs font-black text-white hover:bg-pink-500 transition-all ml-1 shadow-xs"
                title={`Extend song further to the right (+ ${stepsPerMeasure} steps)`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Measure</span>
              </button>
            )}

            {/* Remove Measure Button if multiple measures */}
            {totalMeasures > 1 && onRemoveMeasure && (
              <button
                onClick={onRemoveMeasure}
                className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-xs font-black text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                title="Remove last measure"
              >
                <Minus className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Magic Beat Button in Drum Beat Section */}
          {onMagicBeat && (
            <button
              onClick={onMagicBeat}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-md hover:scale-105 active:scale-95 transition-all"
              title="Generate a instant surprising drum beat!"
            >
              <Sparkles className="h-4 w-4" />
              <span>Magic Beat 🎲</span>
            </button>
          )}

          {/* Reset Beats Button */}
          <button
            onClick={onResetBeats}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-black text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 transition-colors"
            title="Reset all drum beats"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Beats</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Timeline Container (Progresses Left to Right) */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto pb-4 select-none scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-900/60 rounded-2xl"
      >
        <div className="min-w-fit space-y-2.5">
          {/* Header Row: Sticky Sounds Label + Continuous Measures Beats Ruler */}
          <div className="flex items-center">
            {/* Sticky Left Corner Header */}
            <div className="sticky left-0 z-30 flex w-48 sm:w-60 shrink-0 items-center justify-between pr-3 bg-slate-800/95 backdrop-blur-md border-r border-slate-700/80 rounded-xl py-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Sounds ({tracks.length})
              </span>
              <span className="text-[10px] text-pink-400 font-bold">Tap to test 🔊</span>
            </div>

            {/* Extended Measures Timeline Ruler */}
            <div className="flex items-center gap-3 pl-3">
              {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                <div
                  key={mIdx}
                  data-beat-measure={mIdx}
                  className="flex flex-col gap-1 rounded-2xl bg-slate-900/80 p-2 border border-slate-700/80 shadow-xs"
                >
                  {/* Measure Header Banner */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 items-center justify-center rounded-md bg-pink-500/20 px-2 text-[10px] sm:text-xs font-black text-pink-300 border border-pink-500/30">
                        Measure {mIdx + 1}
                      </span>
                      {isPlaying && Math.floor(currentStep / stepsPerMeasure) === mIdx && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      Steps {mIdx * stepsPerMeasure + 1}–{(mIdx + 1) * stepsPerMeasure}
                    </span>
                  </div>

                  {/* Dynamic Beat Step Indicators */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: stepsPerMeasure }).map((_, sIdx) => {
                      const absStep = mIdx * stepsPerMeasure + sIdx;
                      const isStepActive = isPlaying && currentStep === absStep;
                      const beatNum = Math.floor(sIdx / beatDivider) + 1;
                      const isBeatStart = sIdx % beatDivider === 0;

                      return (
                        <div
                          key={sIdx}
                          data-beat-step={absStep}
                          className={`flex h-7 w-9 sm:w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center transition-all ${
                            isStepActive
                              ? 'bg-amber-400 text-slate-950 font-black scale-105 shadow-[0_0_12px_rgba(251,191,36,0.95)]'
                              : isBeatStart
                              ? 'bg-slate-700/90 text-amber-300 font-black border border-slate-600/70'
                              : 'bg-slate-900/80 text-slate-400 font-bold border border-slate-800'
                          }`}
                        >
                          <span className="text-[10px] sm:text-[11px] leading-none">
                            {isBeatStart ? `B${beatNum}` : `${(sIdx % beatDivider) + 1}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* End of timeline: "+ Measure" extension button if < 4 */}
              {totalMeasures < 4 && (
                <button
                  onClick={onAddMeasure}
                  className="flex h-[62px] w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 font-black transition-all hover:scale-102 active:scale-95 gap-1 shadow-sm"
                  title={`Extend song further to the right (+ ${stepsPerMeasure} steps)`}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">+ Measure</span>
                </button>
              )}
            </div>
          </div>

          {/* Track Rows with Sticky Instrument Controls and Horizontally Continuous Steps */}
          {tracks.map((track, trackIdx) => {
            return (
              <div
                key={track.id}
                className={`relative flex items-center rounded-2xl border p-2 transition-all ${
                  track.muted
                    ? 'border-slate-800 bg-slate-900/40 opacity-50'
                    : 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600'
                }`}
              >
                {/* Sticky Left Controls Column */}
                <div className="sticky left-0 z-20 flex w-48 sm:w-60 shrink-0 items-center gap-2 pr-3 bg-slate-900/95 backdrop-blur-md border-r border-slate-800/80 rounded-xl">
                  {/* Sound Preview Avatar Icon */}
                  <button
                    onClick={() => previewSound(track)}
                    title="Click to hear sound!"
                    className={`group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${
                      track.sample.color
                    } text-xl shadow-md transition-transform hover:scale-110 active:scale-95`}
                  >
                    <span className="group-hover:scale-110 transition-transform">
                      {track.sample.icon}
                    </span>
                  </button>

                  {/* Track Name & Instrument Switcher */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedTrackIndexForSound(trackIdx);
                          setSoundCategoryFilter('all');
                        }}
                        className="group/soundbtn flex items-center gap-1.5 truncate rounded-lg px-1.5 py-0.5 text-xs sm:text-sm font-black text-white hover:text-pink-300 hover:bg-slate-800 transition-colors"
                        title="Click to change drum sound"
                      >
                        <span className="truncate">{track.sample.name}</span>
                        <ChevronDown className="h-3 w-3 shrink-0 text-pink-400 group-hover/soundbtn:translate-y-0.5 transition-transform" />
                      </button>
                    </div>

                    {/* Pitch Shift Tag (Deep / High / Normal) */}
                    <div className="mt-1 flex items-center gap-1 text-[10px]">
                      <button
                        onClick={() => {
                          const pitches = [0.7, 1.0, 1.5];
                          const nextIdx = (pitches.indexOf(track.pitch) + 1) % pitches.length;
                          onChangePitch(trackIdx, pitches[nextIdx]);
                        }}
                        className="rounded-md bg-slate-800 px-1.5 py-0.5 font-bold text-slate-300 hover:bg-slate-700"
                        title="Pitch: Deep Monster / Normal / Squeaky Chipmunk"
                      >
                        {track.pitch < 0.9 ? '👾 Deep' : track.pitch > 1.2 ? '🐿️ High' : '🧒 Normal'}
                      </button>

                      {/* Mute Button */}
                      <button
                        onClick={() => onToggleMute(trackIdx)}
                        className={`rounded-md p-1 font-bold transition-colors ${
                          track.muted
                            ? 'bg-rose-500/30 text-rose-300'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title={track.muted ? 'Unmute' : 'Mute sound'}
                      >
                        {track.muted ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>

                      {/* Solo Button */}
                      <button
                        onClick={() => onToggleSolo(trackIdx)}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-black transition-colors ${
                          track.solo
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'bg-slate-800 text-slate-400 hover:text-amber-300'
                        }`}
                        title="Solo track"
                      >
                        S
                      </button>
                    </div>
                  </div>
                </div>

                {/* Extended Measures Step Buttons (Progresses Left to Right across measures) */}
                <div className="flex items-center gap-3 pl-3">
                  {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                    <div
                      key={mIdx}
                      className="flex items-center gap-1.5 rounded-2xl bg-slate-950/40 p-1.5 border border-slate-800/80 shadow-inner"
                    >
                      {Array.from({ length: stepsPerMeasure }).map((_, sIdx) => {
                        const absStep = mIdx * stepsPerMeasure + sIdx;
                        const isActive = track.steps[absStep];
                        const isCurrent = isPlaying && currentStep === absStep;
                        const isBeatQuarter = sIdx % beatDivider === 0;

                        return (
                          <button
                            key={sIdx}
                            data-beat-step={absStep}
                            onMouseDown={(e) => handleStepMouseDown(trackIdx, absStep, !!isActive, e)}
                            onMouseEnter={() => handleStepMouseEnter(trackIdx, absStep, !!isActive)}
                            className={`relative flex h-11 sm:h-12 w-9 sm:w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-90 ${
                              isActive
                                ? `bg-gradient-to-tr ${track.sample.color} border-white/70 text-white shadow-md font-black ${
                                    isCurrent
                                      ? 'scale-110 ring-4 ring-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.95)] z-10'
                                      : 'hover:scale-105'
                                  }`
                                : isCurrent
                                ? 'border-amber-400/90 bg-amber-400/25 ring-2 ring-amber-400/50'
                                : isBeatQuarter
                                ? 'border-slate-700 bg-slate-800 hover:border-slate-500 hover:bg-slate-700/60'
                                : 'border-slate-800/80 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800'
                            }`}
                          >
                            {isActive ? (
                              <span className="text-sm sm:text-base drop-shadow-sm select-none">
                                {track.sample.icon}
                              </span>
                            ) : (
                              <div
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isBeatQuarter ? 'bg-slate-500' : 'bg-slate-700/60'
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Dropdown Menus for Sound Packs & Ready Grooves inside the Drum Beat section */}
      <div className="mt-4 border-t border-slate-700/80 pt-4 flex flex-wrap items-center justify-between gap-3 relative z-30">
        {/* Sound Pack Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsPackDropdownOpen(!isPackDropdownOpen);
              setIsGrooveDropdownOpen(false);
            }}
            className="flex items-center gap-2 rounded-2xl bg-slate-900/95 px-4 py-2.5 text-xs font-black text-white border border-slate-700 hover:bg-slate-700 shadow-md transition-all active:scale-95"
          >
            <span className="text-base">{activePack.emoji}</span>
            <span>Sound Pack: {activePack.name}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isPackDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isPackDropdownOpen && (
            <div className="absolute left-0 bottom-full mb-2 z-50 w-72 sm:w-80 rounded-2xl border-2 border-pink-500/80 bg-slate-900 p-3 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-black uppercase text-pink-300">Choose Sound Pack 🎒</span>
                <button onClick={() => setIsPackDropdownOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {SOUND_PACKS.map((pack) => {
                  const isSelected = currentPackId === pack.id;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => {
                        onSelectPack?.(pack.id);
                        setIsPackDropdownOpen(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                        isSelected
                          ? 'border-pink-400 bg-pink-500/20 text-white font-black'
                          : 'border-slate-800 bg-slate-800/60 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-xl shrink-0">{pack.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black truncate">{pack.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">{pack.description}</div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-pink-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Ready Grooves Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setIsGrooveDropdownOpen(!isGrooveDropdownOpen);
              setIsPackDropdownOpen(false);
            }}
            className="flex items-center gap-2 rounded-2xl bg-slate-900/95 px-4 py-2.5 text-xs font-black text-amber-300 border border-slate-700 hover:bg-slate-700 shadow-md transition-all active:scale-95"
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span>Ready Grooves (1-Click Beats)</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isGrooveDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isGrooveDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-2 z-50 w-72 sm:w-80 rounded-2xl border-2 border-amber-400/80 bg-slate-900 p-3 shadow-2xl space-y-2 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                <span className="text-xs font-black uppercase text-amber-300">Choose Ready Groove 🎶</span>
                <button onClick={() => setIsGrooveDropdownOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto pr-1">
                {BEAT_PRESETS.map((preset) => {
                  const tempo = getTempoDescription(preset.bpm);
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        onSelectPreset?.(preset.id);
                        setIsGrooveDropdownOpen(false);
                      }}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/60 p-2.5 text-left transition-all hover:border-amber-400 hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl shrink-0">{preset.icon}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-white truncate">{preset.title}</div>
                          <div className="text-[10px] text-slate-400 truncate">{preset.bpm} BPM • {tempo.term}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-400 shrink-0">Load</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clean Drum Sound Selector Modal (Fixes bleed-through / clipping issues) */}
      {selectedTrackIndexForSound !== null && tracks[selectedTrackIndexForSound] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedTrackIndexForSound(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border-2 border-pink-400/80 bg-slate-900 p-5 sm:p-6 shadow-[0_0_50px_rgba(244,63,94,0.35)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr ${tracks[selectedTrackIndexForSound].sample.color} text-xl shadow-md`}
                >
                  {tracks[selectedTrackIndexForSound].sample.icon}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Choose Drum Sound
                  </h3>
                  <p className="text-xs text-pink-300 font-semibold">
                    Current: {tracks[selectedTrackIndexForSound].sample.name}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTrackIndexForSound(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="mt-4 flex items-center gap-1.5 rounded-xl bg-slate-950 p-1 border border-slate-800">
              {(
                [
                  { id: 'all', label: 'All Sounds' },
                  { id: 'drums', label: '🥁 Beats' },
                  { id: 'silly', label: '🤪 Silly FX' },
                  { id: 'melody', label: '🌈 Xylo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSoundCategoryFilter(tab.id)}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-black transition-all ${
                    soundCategoryFilter === tab.id
                      ? 'bg-pink-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sound Grid */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {ALL_AVAILABLE_SAMPLES.filter((sample) =>
                soundCategoryFilter === 'all' ? true : sample.category === soundCategoryFilter
              ).map((sample) => {
                const isSelected =
                  tracks[selectedTrackIndexForSound].sample.soundType === sample.soundType;

                return (
                  <button
                    key={sample.id}
                    onClick={() => {
                      onChangeSample(selectedTrackIndexForSound, sample.soundType);
                      soundEngine.playSound(sample.soundType);
                      setSelectedTrackIndexForSound(null);
                    }}
                    onMouseEnter={() => {
                      // Optional: play sound on preview or hover if desired
                    }}
                    className={`group relative flex items-center gap-2.5 rounded-2xl border-2 p-2.5 text-left transition-all active:scale-95 ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 text-white shadow-md'
                        : 'border-slate-800 bg-slate-800/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${sample.color} text-xl shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      {sample.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black text-white">
                        {sample.name}
                      </div>
                      <div className="truncate text-[10px] font-semibold text-slate-400">
                        {sample.funTag || sample.category}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom helper tip */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800 text-xs text-slate-400">
              <span>💡 Tap any sound to select and hear it instantly!</span>
              <button
                onClick={() => setSelectedTrackIndexForSound(null)}
                className="font-bold text-pink-400 hover:text-pink-300 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


