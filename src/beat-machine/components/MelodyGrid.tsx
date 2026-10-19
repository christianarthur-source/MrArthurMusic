import React, { useState, useRef, useEffect } from 'react';
import { MelodyTrack, MelodyInstrument, MelodyNoteDefinition, ScaleMode } from '../types';
import { soundEngine } from '../audio/soundEngine';
import {
  Volume2,
  VolumeX,
  Dices,
  RotateCcw,
  Music,
  Sparkles,
  Plus,
  Minus,
  ChevronDown,
  Check,
  Play,
  Square,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface MelodyGridProps {
  melodyTracks: MelodyTrack[];
  currentStep: number;
  totalStepsInMeasure: 8 | 16;
  activeMeasure: number;
  totalMeasures: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onChangeActiveMeasure: (measureIndex: number) => void;
  onAddMeasure: () => void;
  onRemoveMeasure?: () => void;
  instrument: MelodyInstrument;
  onChangeInstrument: (inst: MelodyInstrument) => void;
  scaleMode: ScaleMode;
  onChangeScaleMode: (mode: ScaleMode) => void;
  octaves?: 1 | 2;
  onChangeOctaves?: (octaves: 1 | 2) => void;
  onToggleStep: (noteIndex: number, absoluteStepIndex: number) => void;
  onResetMelody: () => void;
  onMagicMelody: () => void;
  onLoadSongPreset: (presetId: string) => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const MELODY_INSTRUMENTS: {
  id: MelodyInstrument;
  name: string;
  emoji: string;
}[] = [
  { id: 'xylo', name: 'Rainbow Xylo', emoji: '🌈' },
  { id: 'strings', name: 'Strings (Violin)', emoji: '🎻' },
  { id: 'brass', name: 'Brass (Trumpet)', emoji: '🎺' },
  { id: 'woodwinds', name: 'Woodwinds (Flute)', emoji: '🪵' },
  { id: 'guitar', name: 'Acoustic Guitar', emoji: '🎸' },
  { id: 'chiptune', name: '8-Bit Arcade', emoji: '🕹️' },
  { id: 'piano', name: 'Toy Piano', emoji: '🎹' },
  { id: 'synth', name: 'Space Synth', emoji: '🛸' },
  { id: 'flute', name: 'Pan Flute', emoji: '🪈' },
];

export const MELODY_PRESETS = [
  { id: 'twinkle', name: 'Twinkle Star', emoji: '⭐' },
  { id: 'mary-lamb', name: "Mary's Lamb", emoji: '🐑' },
  { id: 'space-arp', name: 'Space Arpeggio', emoji: '🚀' },
  { id: 'arcade-hero', name: 'Arcade Hook', emoji: '👾' },
];

export const FULL_MAJOR_NOTES: MelodyNoteDefinition[] = [
  { id: 'c5', name: 'C5', solfege: 'High Do', frequency: 523.25, color: 'from-purple-500 to-violet-600', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'b4', name: 'B4', solfege: 'Ti', frequency: 493.88, color: 'from-indigo-500 to-purple-600', glowColor: 'rgba(99,102,241,0.8)' },
  { id: 'a4', name: 'A4', solfege: 'La', frequency: 440.0, color: 'from-blue-500 to-indigo-600', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'g4', name: 'G4', solfege: 'Sol', frequency: 392.0, color: 'from-emerald-400 to-teal-600', glowColor: 'rgba(52,211,153,0.8)' },
  { id: 'f4', name: 'F4', solfege: 'Fa', frequency: 349.23, color: 'from-lime-400 to-emerald-500', glowColor: 'rgba(163,230,53,0.8)' },
  { id: 'e4', name: 'E4', solfege: 'Mi', frequency: 329.63, color: 'from-yellow-400 to-amber-500', glowColor: 'rgba(250,204,21,0.8)' },
  { id: 'd4', name: 'D4', solfege: 'Re', frequency: 293.66, color: 'from-orange-500 to-amber-600', glowColor: 'rgba(249,115,22,0.8)' },
  { id: 'c4', name: 'C4', solfege: 'Low Do', frequency: 261.63, color: 'from-rose-500 to-red-600', glowColor: 'rgba(244,63,94,0.8)' },
];

export const PENTATONIC_NOTES: MelodyNoteDefinition[] = [
  { id: 'c5', name: 'C5', solfege: 'High Do', frequency: 523.25, color: 'from-purple-500 to-violet-600', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'a4', name: 'A4', solfege: 'La', frequency: 440.0, color: 'from-blue-500 to-indigo-600', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'g4', name: 'G4', solfege: 'Sol', frequency: 392.0, color: 'from-emerald-400 to-teal-600', glowColor: 'rgba(52,211,153,0.8)' },
  { id: 'e4', name: 'E4', solfege: 'Mi', frequency: 329.63, color: 'from-yellow-400 to-amber-500', glowColor: 'rgba(250,204,21,0.8)' },
  { id: 'd4', name: 'D4', solfege: 'Re', frequency: 293.66, color: 'from-orange-500 to-amber-600', glowColor: 'rgba(249,115,22,0.8)' },
  { id: 'c4', name: 'C4', solfege: 'Low Do', frequency: 261.63, color: 'from-rose-500 to-red-600', glowColor: 'rgba(244,63,94,0.8)' },
];

export const FULL_MAJOR_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  { id: 'c6', name: 'C6', solfege: 'High High Do', frequency: 1046.5, color: 'from-fuchsia-400 to-pink-500', glowColor: 'rgba(232,121,249,0.8)' },
  { id: 'b5', name: 'B5', solfege: 'High Ti', frequency: 987.77, color: 'from-purple-400 to-fuchsia-500', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'a5', name: 'A5', solfege: 'High La', frequency: 880.0, color: 'from-violet-400 to-purple-500', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'g5', name: 'G5', solfege: 'High Sol', frequency: 783.99, color: 'from-indigo-400 to-violet-500', glowColor: 'rgba(129,140,248,0.8)' },
  { id: 'f5', name: 'F5', solfege: 'High Fa', frequency: 698.46, color: 'from-cyan-400 to-blue-500', glowColor: 'rgba(34,211,238,0.8)' },
  { id: 'e5', name: 'E5', solfege: 'High Mi', frequency: 659.25, color: 'from-teal-400 to-cyan-500', glowColor: 'rgba(45,212,191,0.8)' },
  { id: 'd5', name: 'D5', solfege: 'High Re', frequency: 587.33, color: 'from-emerald-400 to-teal-500', glowColor: 'rgba(52,211,153,0.8)' },
  ...FULL_MAJOR_NOTES,
];

export const PENTATONIC_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  { id: 'c6', name: 'C6', solfege: 'High High Do', frequency: 1046.5, color: 'from-fuchsia-400 to-pink-500', glowColor: 'rgba(232,121,249,0.8)' },
  { id: 'a5', name: 'A5', solfege: 'High La', frequency: 880.0, color: 'from-violet-400 to-purple-500', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'g5', name: 'G5', solfege: 'High Sol', frequency: 783.99, color: 'from-indigo-400 to-violet-500', glowColor: 'rgba(129,140,248,0.8)' },
  { id: 'e5', name: 'E5', solfege: 'High Mi', frequency: 659.25, color: 'from-teal-400 to-cyan-500', glowColor: 'rgba(45,212,191,0.8)' },
  { id: 'd5', name: 'D5', solfege: 'High Re', frequency: 587.33, color: 'from-emerald-400 to-teal-500', glowColor: 'rgba(52,211,153,0.8)' },
  ...PENTATONIC_NOTES,
];

export const FULL_MINOR_NOTES: MelodyNoteDefinition[] = [
  { id: 'c5', name: 'C5', solfege: 'High Do', frequency: 523.25, color: 'from-purple-500 to-violet-600', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'bb4', name: 'B♭4', solfege: 'Te', frequency: 466.16, color: 'from-indigo-500 to-purple-600', glowColor: 'rgba(99,102,241,0.8)' },
  { id: 'ab4', name: 'A♭4', solfege: 'Le', frequency: 415.30, color: 'from-blue-500 to-indigo-600', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'g4', name: 'G4', solfege: 'Sol', frequency: 392.00, color: 'from-emerald-400 to-teal-600', glowColor: 'rgba(52,211,153,0.8)' },
  { id: 'f4', name: 'F4', solfege: 'Fa', frequency: 349.23, color: 'from-lime-400 to-emerald-500', glowColor: 'rgba(163,230,53,0.8)' },
  { id: 'eb4', name: 'E♭4', solfege: 'Me', frequency: 311.13, color: 'from-amber-400 to-yellow-500', glowColor: 'rgba(251,191,36,0.8)' },
  { id: 'd4', name: 'D4', solfege: 'Re', frequency: 293.66, color: 'from-orange-500 to-amber-600', glowColor: 'rgba(249,115,22,0.8)' },
  { id: 'c4', name: 'C4', solfege: 'Low Do', frequency: 261.63, color: 'from-rose-500 to-red-600', glowColor: 'rgba(244,63,94,0.8)' },
];

export const CHROMATIC_NOTES: MelodyNoteDefinition[] = [
  { id: 'c5', name: 'C5', solfege: 'High Do', frequency: 523.25, color: 'from-fuchsia-500 to-pink-600', glowColor: 'rgba(217,70,239,0.8)' },
  { id: 'b4', name: 'B4', solfege: 'Ti', frequency: 493.88, color: 'from-purple-500 to-fuchsia-600', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'bb4', name: 'B♭4', solfege: 'Te', frequency: 466.16, color: 'from-indigo-500 to-purple-600', glowColor: 'rgba(99,102,241,0.8)' },
  { id: 'a4', name: 'A4', solfege: 'La', frequency: 440.00, color: 'from-blue-500 to-indigo-600', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'ab4', name: 'A♭4', solfege: 'Le', frequency: 415.30, color: 'from-sky-400 to-blue-600', glowColor: 'rgba(56,189,248,0.8)' },
  { id: 'g4', name: 'G4', solfege: 'Sol', frequency: 392.00, color: 'from-teal-400 to-cyan-600', glowColor: 'rgba(45,212,191,0.8)' },
  { id: 'fs4', name: 'F♯4', solfege: 'Fi', frequency: 369.99, color: 'from-emerald-400 to-teal-600', glowColor: 'rgba(52,211,153,0.8)' },
  { id: 'f4', name: 'F4', solfege: 'Fa', frequency: 349.23, color: 'from-green-400 to-emerald-500', glowColor: 'rgba(74,222,128,0.8)' },
  { id: 'e4', name: 'E4', solfege: 'Mi', frequency: 329.63, color: 'from-lime-400 to-green-500', glowColor: 'rgba(163,230,53,0.8)' },
  { id: 'eb4', name: 'E♭4', solfege: 'Me', frequency: 311.13, color: 'from-yellow-400 to-amber-500', glowColor: 'rgba(250,204,21,0.8)' },
  { id: 'd4', name: 'D4', solfege: 'Re', frequency: 293.66, color: 'from-orange-500 to-amber-600', glowColor: 'rgba(249,115,22,0.8)' },
  { id: 'cs4', name: 'C♯4', solfege: 'Ra', frequency: 277.18, color: 'from-rose-500 to-orange-600', glowColor: 'rgba(244,63,94,0.8)' },
  { id: 'c4', name: 'C4', solfege: 'Low Do', frequency: 261.63, color: 'from-red-600 to-rose-700', glowColor: 'rgba(225,29,72,0.8)' },
];

export const FULL_MINOR_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  { id: 'c6', name: 'C6', solfege: 'High High Do', frequency: 1046.5, color: 'from-fuchsia-400 to-pink-500', glowColor: 'rgba(232,121,249,0.8)' },
  { id: 'bb5', name: 'B♭5', solfege: 'High Te', frequency: 932.33, color: 'from-purple-400 to-fuchsia-500', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'ab5', name: 'A♭5', solfege: 'High Le', frequency: 830.61, color: 'from-violet-400 to-purple-500', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'g5', name: 'G5', solfege: 'High Sol', frequency: 783.99, color: 'from-indigo-400 to-violet-500', glowColor: 'rgba(129,140,248,0.8)' },
  { id: 'f5', name: 'F5', solfege: 'High Fa', frequency: 698.46, color: 'from-cyan-400 to-blue-500', glowColor: 'rgba(34,211,238,0.8)' },
  { id: 'eb5', name: 'E♭5', solfege: 'High Me', frequency: 622.25, color: 'from-teal-400 to-cyan-500', glowColor: 'rgba(45,212,191,0.8)' },
  { id: 'd5', name: 'D5', solfege: 'High Re', frequency: 587.33, color: 'from-emerald-400 to-teal-500', glowColor: 'rgba(52,211,153,0.8)' },
  ...FULL_MINOR_NOTES,
];

export const CHROMATIC_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  { id: 'c6', name: 'C6', solfege: 'High High Do', frequency: 1046.5, color: 'from-fuchsia-400 to-pink-500', glowColor: 'rgba(232,121,249,0.8)' },
  { id: 'b5', name: 'B5', solfege: 'High Ti', frequency: 987.77, color: 'from-purple-400 to-fuchsia-500', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'bb5', name: 'B♭5', solfege: 'High Te', frequency: 932.33, color: 'from-indigo-400 to-purple-500', glowColor: 'rgba(129,140,248,0.8)' },
  { id: 'a5', name: 'A5', solfege: 'High La', frequency: 880.0, color: 'from-violet-400 to-indigo-500', glowColor: 'rgba(168,85,247,0.8)' },
  { id: 'ab5', name: 'A♭5', solfege: 'High Le', frequency: 830.61, color: 'from-blue-400 to-violet-500', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'g5', name: 'G5', solfege: 'High Sol', frequency: 783.99, color: 'from-sky-400 to-blue-500', glowColor: 'rgba(56,189,248,0.8)' },
  { id: 'fs5', name: 'F♯5', solfege: 'High Fi', frequency: 739.99, color: 'from-teal-400 to-cyan-500', glowColor: 'rgba(45,212,191,0.8)' },
  { id: 'f5', name: 'F5', solfege: 'High Fa', frequency: 698.46, color: 'from-emerald-400 to-teal-500', glowColor: 'rgba(52,211,153,0.8)' },
  { id: 'e5', name: 'E5', solfege: 'High Mi', frequency: 659.25, color: 'from-green-400 to-emerald-500', glowColor: 'rgba(74,222,128,0.8)' },
  { id: 'eb5', name: 'E♭5', solfege: 'High Me', frequency: 622.25, color: 'from-yellow-400 to-green-500', glowColor: 'rgba(250,204,21,0.8)' },
  { id: 'd5', name: 'D5', solfege: 'High Re', frequency: 587.33, color: 'from-orange-500 to-amber-500', glowColor: 'rgba(249,115,22,0.8)' },
  { id: 'cs5', name: 'C♯5', solfege: 'High Ra', frequency: 554.37, color: 'from-rose-500 to-orange-500', glowColor: 'rgba(244,63,94,0.8)' },
  ...CHROMATIC_NOTES,
];

export function getMelodyNotes(scaleMode: ScaleMode, octaves: 1 | 2 = 1): MelodyNoteDefinition[] {
  if (octaves === 2) {
    if (scaleMode === 'major') return FULL_MAJOR_NOTES_2_OCTAVES;
    if (scaleMode === 'minor') return FULL_MINOR_NOTES_2_OCTAVES;
    if (scaleMode === 'chromatic') return CHROMATIC_NOTES_2_OCTAVES;
    return PENTATONIC_NOTES_2_OCTAVES;
  }
  if (scaleMode === 'major') return FULL_MAJOR_NOTES;
  if (scaleMode === 'minor') return FULL_MINOR_NOTES;
  if (scaleMode === 'chromatic') return CHROMATIC_NOTES;
  return PENTATONIC_NOTES;
}

export const MelodyGrid: React.FC<MelodyGridProps> = ({
  melodyTracks,
  currentStep,
  totalStepsInMeasure,
  activeMeasure: _activeMeasure,
  totalMeasures,
  isPlaying = false,
  onTogglePlay,
  onChangeActiveMeasure: _onChangeActiveMeasure,
  onAddMeasure,
  onRemoveMeasure,
  instrument,
  onChangeInstrument,
  scaleMode,
  onChangeScaleMode,
  octaves = 1,
  onChangeOctaves,
  onToggleStep,
  onResetMelody,
  onMagicMelody,
  onLoadSongPreset,
  volume,
  onChangeVolume: _onChangeVolume,
  isMuted,
  onToggleMute,
}) => {
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const [isInstrumentMenuOpen, setIsInstrumentMenuOpen] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  const instrumentDropdownRef = useRef<HTMLDivElement>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevTotalMeasuresRef = useRef(totalMeasures);

  const currentInstrumentObj =
    MELODY_INSTRUMENTS.find((i) => i.id === instrument) || MELODY_INSTRUMENTS[0];

  const previewNote = (freq: number) => {
    soundEngine.playMelodyNote(freq, instrument, 0, volume);
  };

  const handleStepMouseDown = (noteIdx: number, absoluteStep: number, currentVal: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    setIsMouseDown(true);
    const newVal = !currentVal;
    setDragMode(newVal);
    onToggleStep(noteIdx, absoluteStep);
  };

  const handleStepMouseEnter = (noteIdx: number, absoluteStep: number, currentVal: boolean) => {
    if (isMouseDown && dragMode !== null && currentVal !== dragMode) {
      onToggleStep(noteIdx, absoluteStep);
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        instrumentDropdownRef.current &&
        !instrumentDropdownRef.current.contains(e.target as Node)
      ) {
        setIsInstrumentMenuOpen(false);
      }
      if (
        presetDropdownRef.current &&
        !presetDropdownRef.current.contains(e.target as Node)
      ) {
        setIsPresetMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
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

    const activeEl = container.querySelector<HTMLElement>(`[data-melody-step="${currentStep}"]`);
    if (activeEl) {
      const containerRect = container.getBoundingClientRect();
      const stepRect = activeEl.getBoundingClientRect();
      const stickyMargin = 210; // width of sticky notes column

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
    const targetEl = container.querySelector<HTMLElement>(`[data-melody-measure="${mIdx}"]`);
    if (targetEl) {
      const leftPos = Math.max(0, targetEl.offsetLeft - 230);
      container.scrollTo({ left: leftPos, behavior: 'smooth' });
    }
  };

  return (
    <div className="rounded-3xl border-2 border-app-border bg-app-card/90 p-4 sm:p-5 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Top Header: Title + Minimal Controls Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-app-border pb-3">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 active:scale-95 ${
                isPlaying
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.7)] ring-2 ring-emerald-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:scale-105'
              }`}
              title={isPlaying ? 'Pause' : 'Play Melody'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Square className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 translate-x-0.5" />
              )}
            </button>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 via-pink-500 to-amber-400 text-xl shadow-lg animate-bounce-sm">
            🎹
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Melody
          </h3>
        </div>

        {/* Clean Controls: Instrument Dropdown, Preset Dropdown, Magic Tune, Mute, Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instrument Dropdown Menu */}
          <div className="relative" ref={instrumentDropdownRef}>
            <button
              onClick={() => {
                setIsInstrumentMenuOpen(!isInstrumentMenuOpen);
                setIsPresetMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 border border-slate-700 transition-all active:scale-95 shadow-md"
              title="Choose Melody Instrument"
            >
              <span className="text-sm">{currentInstrumentObj.emoji}</span>
              <span>{currentInstrumentObj.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isInstrumentMenuOpen && (
              <div className="absolute top-11 left-0 z-40 w-52 rounded-2xl border-2 border-pink-500/80 bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-pink-400">
                  Select Instrument:
                </div>
                {MELODY_INSTRUMENTS.map((inst) => {
                  const isSelected = inst.id === instrument;
                  return (
                    <button
                      key={inst.id}
                      onClick={() => {
                        onChangeInstrument(inst.id);
                        setIsInstrumentMenuOpen(false);
                        soundEngine.playMelodyNote(440, inst.id, 0, volume);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-pink-500 text-white font-black'
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{inst.emoji}</span>
                        <span>{inst.name}</span>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preset Tunes Dropdown */}
          <div className="relative" ref={presetDropdownRef}>
            <button
              onClick={() => {
                setIsPresetMenuOpen(!isPresetMenuOpen);
                setIsInstrumentMenuOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-amber-300 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95"
              title="Load Pre-made Melody"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Load Tune</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isPresetMenuOpen && (
              <div className="absolute top-11 left-0 z-40 w-44 rounded-2xl border-2 border-amber-400/80 bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-amber-300">
                  Choose Song:
                </div>
                {MELODY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onLoadSongPreset(preset.id);
                      setIsPresetMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs font-bold text-slate-200 hover:bg-amber-400 hover:text-slate-950 transition-colors"
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Magic Tune Generator */}
          <button
            onClick={() => {
              onMagicMelody();
              confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 text-xs font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all"
            title="Generate a surprising melody that harmonizes with your beat!"
          >
            <Dices className="h-3.5 w-3.5" />
            <span>Magic Tune 🎲</span>
          </button>

          {/* Mute Melody */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-black transition-all ${
              isMuted
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute melody' : 'Mute melody'}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* Reset Melody Button */}
          <button
            onClick={onResetMelody}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 transition-colors"
            title="Reset all melody notes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Measures Timeline Bar & Scale Switcher Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-indigo-950/40 p-2.5 border border-indigo-900/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline Length info */}
          <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
            Song: {totalMeasures} {totalMeasures === 1 ? 'Measure' : 'Measures'} ({totalMeasures * 16} Steps)
          </span>

          {/* Quick jump to measures */}
          {totalMeasures > 1 && (
            <div className="flex items-center gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 px-1">Jump:</span>
              {Array.from({ length: totalMeasures }).map((_, mIdx) => {
                const isCurrentlyPlaying = isPlaying && Math.floor(currentStep / 16) === mIdx;
                return (
                  <button
                    key={mIdx}
                    onClick={() => scrollToMeasure(mIdx)}
                    className={`flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-black transition-all ${
                      isCurrentlyPlaying
                        ? 'bg-amber-400 text-slate-950 shadow-md scale-102 font-black'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span>M{mIdx + 1}</span>
                    {isCurrentlyPlaying && (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-950 animate-ping" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Add Measure Button */}
          {totalMeasures < 4 && (
            <button
              onClick={onAddMeasure}
              className="flex items-center gap-1 rounded-lg bg-indigo-600/70 px-2.5 py-1 text-xs font-black text-white hover:bg-indigo-500 hover:text-white transition-all shadow-xs"
              title="Extend melody further to the right (+ 16 steps)"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Measure</span>
            </button>
          )}

          {/* Remove Measure Button */}
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

        {/* Scale & Octave Range Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400">
              Scale:
            </span>
            <div className="flex items-center rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs font-black">
              <button
                onClick={() => onChangeScaleMode('pentatonic')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  scaleMode === 'pentatonic'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🌈 Pentatonic
              </button>
              <button
                onClick={() => onChangeScaleMode('major')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  scaleMode === 'major'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎼 Major
              </button>
              <button
                onClick={() => onChangeScaleMode('minor')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  scaleMode === 'minor'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🌙 Minor
              </button>
              <button
                onClick={() => onChangeScaleMode('chromatic')}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  scaleMode === 'chromatic'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🎹 Chromatic
              </button>
            </div>
          </div>

          {/* Range / Octave Toggle */}
          {onChangeOctaves && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Range:
              </span>
              <button
                onClick={() => onChangeOctaves(octaves === 1 ? 2 : 1)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all active:scale-95 border ${
                  octaves === 2
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-pink-400 shadow-md font-black ring-2 ring-pink-400/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                }`}
                title={octaves === 1 ? 'Expand range by an additional octave (+1 Octave)' : 'Collapse range to 1 octave'}
              >
                <span>{octaves === 1 ? '1 Octave (Default)' : '2 Octaves (+1 Octave) ✨'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Timeline Container (Progresses Left to Right) */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto pb-4 select-none scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-900/60 rounded-2xl"
      >
        <div className="min-w-fit space-y-2">
          {/* Header Row: Sticky Notes Label + Continuous Measures Beats Ruler */}
          <div className="flex items-center">
            {/* Sticky Left Notes Header */}
            <div className="sticky left-0 z-30 flex w-44 sm:w-52 shrink-0 items-center justify-between pr-3 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 rounded-xl py-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Notes ({melodyTracks.length})
              </span>
              <span className="text-[10px] text-pink-400 font-bold">Tap to test 🎶</span>
            </div>

            {/* Extended Measures Timeline Ruler */}
            <div className="flex items-center gap-3 pl-3">
              {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                <div
                  key={mIdx}
                  data-melody-measure={mIdx}
                  className="flex flex-col gap-1 rounded-2xl bg-slate-950/70 p-2 border border-slate-800 shadow-xs"
                >
                  {/* Measure Header Banner */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 items-center justify-center rounded-md bg-indigo-500/20 px-2 text-[10px] sm:text-xs font-black text-indigo-300 border border-indigo-500/30">
                        Measure {mIdx + 1}
                      </span>
                      {isPlaying && Math.floor(currentStep / totalStepsInMeasure) === mIdx && (
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      Steps {mIdx * totalStepsInMeasure + 1}–{(mIdx + 1) * totalStepsInMeasure}
                    </span>
                  </div>

                  {/* Beat Step Indicators */}
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: totalStepsInMeasure }).map((_, sIdx) => {
                      const absStep = mIdx * totalStepsInMeasure + sIdx;
                      const isStepActive = isPlaying && currentStep === absStep;
                      const beatDivider = totalStepsInMeasure === 16 ? 4 : 2;
                      const beatNum = Math.floor(sIdx / beatDivider) + 1;
                      const isBeatStart = sIdx % beatDivider === 0;

                      return (
                        <div
                          key={sIdx}
                          data-melody-step={absStep}
                          className={`flex h-7 w-9 sm:w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center transition-all ${
                            isStepActive
                              ? 'bg-amber-400 text-slate-950 font-black scale-105 shadow-[0_0_12px_rgba(251,191,36,0.95)]'
                              : isBeatStart
                              ? 'bg-slate-700/80 text-amber-300 font-black border border-slate-600/70'
                              : 'bg-slate-900/70 text-slate-400 font-bold border border-slate-800'
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
                  className="flex h-[62px] w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-black transition-all hover:scale-102 active:scale-95 gap-1 shadow-sm"
                  title={`Extend melody further to the right (+ ${totalStepsInMeasure} steps)`}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">+ Measure</span>
                </button>
              )}
            </div>
          </div>

          {/* The Melody Note Rows (Pitched from high to low) with Continuous Measures */}
          {melodyTracks.map((track, trackIdx) => {
            return (
              <div
                key={track.note.id}
                className={`relative flex items-center rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5 transition-all hover:border-slate-700 ${
                  isMuted ? 'opacity-50' : ''
                }`}
              >
                {/* Sticky Left Note Header Key */}
                <div className="sticky left-0 z-20 flex w-44 sm:w-52 shrink-0 items-center pr-3 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 rounded-xl">
                  <button
                    onClick={() => previewNote(track.note.frequency)}
                    title="Tap to preview this pitch"
                    className={`flex w-full items-center justify-between rounded-xl bg-gradient-to-r ${
                      track.note.color
                    } px-3 py-2 text-left text-white shadow-md transition-all hover:scale-102 active:scale-95 group`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/25 text-xs font-black">
                        {track.note.name}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-black drop-shadow">{track.note.solfege}</span>
                        <span className="text-[10px] text-white/80 font-bold">
                          {Math.round(track.note.frequency)} Hz
                        </span>
                      </div>
                    </div>
                    <Music className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </button>
                </div>

                {/* Extended Measures Step Buttons (Progresses Left to Right across measures) */}
                <div className="flex items-center gap-3 pl-3">
                  {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                    <div
                      key={mIdx}
                      className="flex items-center gap-1.5 rounded-2xl bg-slate-950/40 p-1.5 border border-slate-800/80 shadow-inner"
                    >
                      {Array.from({ length: totalStepsInMeasure }).map((_, sIdx) => {
                        const absStep = mIdx * totalStepsInMeasure + sIdx;
                        const isActive = track.steps[absStep];
                        const isCurrent = isPlaying && currentStep === absStep;
                        const beatDivider = totalStepsInMeasure === 16 ? 4 : 2;
                        const isBeatQuarter = sIdx % beatDivider === 0;

                        return (
                          <button
                            key={sIdx}
                            data-melody-step={absStep}
                            onMouseDown={(e) => handleStepMouseDown(trackIdx, absStep, !!isActive, e)}
                            onMouseEnter={() => handleStepMouseEnter(trackIdx, absStep, !!isActive)}
                            className={`relative flex h-10 sm:h-11 w-9 sm:w-11 shrink-0 items-center justify-center rounded-xl border-2 transition-all active:scale-90 ${
                              isActive
                                ? `bg-gradient-to-tr ${track.note.color} border-white/80 text-white shadow-lg font-black ${
                                    isCurrent
                                      ? 'scale-115 ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.95)] z-10'
                                      : 'hover:scale-105'
                                  }`
                                : isCurrent
                                ? 'border-amber-400/90 bg-amber-400/25 ring-2 ring-amber-400/50'
                                : isBeatQuarter
                                ? 'border-slate-700 bg-slate-800/80 hover:border-slate-500 hover:bg-slate-700/60'
                                : 'border-slate-800 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800'
                            }`}
                          >
                            {isActive ? (
                              <span className="text-xs sm:text-sm font-black drop-shadow select-none">
                                ♪
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
    </div>
  );
};

