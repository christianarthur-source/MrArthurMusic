import React, { useState, useRef, useEffect } from 'react';
import { MelodyTrack, BassInstrument, MelodyNoteDefinition, ScaleMode } from '../types';
import { soundEngine } from '../audio/soundEngine';
import {
  Volume2,
  VolumeX,
  Dices,
  RotateCcw,
  Sparkles,
  Plus,
  Minus,
  ChevronDown,
  Check,
  Play,
  Square,
  Activity,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BassGridProps {
  bassTracks: MelodyTrack[];
  currentStep: number;
  totalStepsInMeasure: 8 | 16;
  activeMeasure: number;
  totalMeasures: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onChangeActiveMeasure: (measureIndex: number) => void;
  onAddMeasure: () => void;
  onRemoveMeasure?: () => void;
  instrument: BassInstrument;
  onChangeInstrument: (inst: BassInstrument) => void;
  scaleMode: ScaleMode;
  onChangeScaleMode: (mode: ScaleMode) => void;
  octaves?: 1 | 2;
  onChangeOctaves?: (octaves: 1 | 2) => void;
  onToggleStep: (noteIndex: number, absoluteStepIndex: number) => void;
  onResetBass: () => void;
  onMagicBass: () => void;
  onLoadBassPreset: (presetId: string) => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const BASS_INSTRUMENTS: {
  id: BassInstrument;
  name: string;
  emoji: string;
}[] = [
  { id: 'bass-guitar', name: 'Bass Guitar', emoji: '🎸' },
  { id: 'synth-bass', name: 'Synth Bass', emoji: '🛸' },
  { id: 'string-bass', name: 'String Bass', emoji: '🎻' },
  { id: 'tuba', name: 'Tuba', emoji: '🎺' },
  { id: 'bass-synth', name: 'Funky Bass Synth', emoji: '⚡' },
];

export const BASS_PRESETS = [
  { id: 'root-bounce', name: 'Root Bounce', emoji: '💣' },
  { id: 'walking-bass', name: 'Walking Bass', emoji: '🚶‍♂️' },
  { id: 'disco-octaves', name: 'Disco Octaves', emoji: '🪩' },
  { id: 'funky-thumb', name: 'Funky Slap', emoji: '💥' },
];

export const FULL_MAJOR_BASS_NOTES: MelodyNoteDefinition[] = [
  { id: 'c3-bass', name: 'C3', solfege: 'High Do Bass', frequency: 130.81, color: 'from-fuchsia-600 to-purple-800', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'b2-bass', name: 'B2', solfege: 'Ti Bass', frequency: 123.47, color: 'from-purple-600 to-indigo-800', glowColor: 'rgba(147,51,234,0.8)' },
  { id: 'a2-bass', name: 'A2', solfege: 'La Bass', frequency: 110.0, color: 'from-indigo-600 to-blue-800', glowColor: 'rgba(79,70,229,0.8)' },
  { id: 'g2-bass', name: 'G2', solfege: 'Sol Bass', frequency: 98.0, color: 'from-blue-600 to-cyan-800', glowColor: 'rgba(37,99,235,0.8)' },
  { id: 'f2-bass', name: 'F2', solfege: 'Fa Bass', frequency: 87.31, color: 'from-teal-600 to-emerald-800', glowColor: 'rgba(13,148,136,0.8)' },
  { id: 'e2-bass', name: 'E2', solfege: 'Mi Bass', frequency: 82.41, color: 'from-emerald-600 to-green-800', glowColor: 'rgba(5,150,105,0.8)' },
  { id: 'd2-bass', name: 'D2', solfege: 'Re Bass', frequency: 73.42, color: 'from-amber-600 to-orange-800', glowColor: 'rgba(217,119,6,0.8)' },
  { id: 'c2-bass', name: 'C2', solfege: 'Low Do Bass', frequency: 65.41, color: 'from-rose-600 to-red-800', glowColor: 'rgba(225,29,72,0.8)' },
];

export const PENTATONIC_BASS_NOTES: MelodyNoteDefinition[] = [
  { id: 'c3-bass', name: 'C3', solfege: 'High Do Bass', frequency: 130.81, color: 'from-fuchsia-600 to-purple-800', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'a2-bass', name: 'A2', solfege: 'La Bass', frequency: 110.0, color: 'from-indigo-600 to-blue-800', glowColor: 'rgba(79,70,229,0.8)' },
  { id: 'g2-bass', name: 'G2', solfege: 'Sol Bass', frequency: 98.0, color: 'from-blue-600 to-cyan-800', glowColor: 'rgba(37,99,235,0.8)' },
  { id: 'e2-bass', name: 'E2', solfege: 'Mi Bass', frequency: 82.41, color: 'from-emerald-600 to-green-800', glowColor: 'rgba(5,150,105,0.8)' },
  { id: 'd2-bass', name: 'D2', solfege: 'Re Bass', frequency: 73.42, color: 'from-amber-600 to-orange-800', glowColor: 'rgba(217,119,6,0.8)' },
  { id: 'c2-bass', name: 'C2', solfege: 'Low Do Bass', frequency: 65.41, color: 'from-rose-600 to-red-800', glowColor: 'rgba(225,29,72,0.8)' },
];

export const FULL_MINOR_BASS_NOTES: MelodyNoteDefinition[] = [
  { id: 'c3-bass', name: 'C3', solfege: 'High Do Bass', frequency: 130.81, color: 'from-fuchsia-600 to-purple-800', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'bb2-bass', name: 'B♭2', solfege: 'Te Bass', frequency: 116.54, color: 'from-purple-600 to-indigo-800', glowColor: 'rgba(147,51,234,0.8)' },
  { id: 'ab2-bass', name: 'A♭2', solfege: 'Le Bass', frequency: 103.83, color: 'from-indigo-600 to-blue-800', glowColor: 'rgba(79,70,229,0.8)' },
  { id: 'g2-bass', name: 'G2', solfege: 'Sol Bass', frequency: 98.0, color: 'from-blue-600 to-cyan-800', glowColor: 'rgba(37,99,235,0.8)' },
  { id: 'f2-bass', name: 'F2', solfege: 'Fa Bass', frequency: 87.31, color: 'from-teal-600 to-emerald-800', glowColor: 'rgba(13,148,136,0.8)' },
  { id: 'eb2-bass', name: 'E♭2', solfege: 'Me Bass', frequency: 77.78, color: 'from-emerald-600 to-green-800', glowColor: 'rgba(5,150,105,0.8)' },
  { id: 'd2-bass', name: 'D2', solfege: 'Re Bass', frequency: 73.42, color: 'from-amber-600 to-orange-800', glowColor: 'rgba(217,119,6,0.8)' },
  { id: 'c2-bass', name: 'C2', solfege: 'Low Do Bass', frequency: 65.41, color: 'from-rose-600 to-red-800', glowColor: 'rgba(225,29,72,0.8)' },
];

export const CHROMATIC_BASS_NOTES: MelodyNoteDefinition[] = [
  { id: 'c3-bass', name: 'C3', solfege: 'High Do Bass', frequency: 130.81, color: 'from-fuchsia-600 to-purple-800', glowColor: 'rgba(192,38,211,0.8)' },
  { id: 'b2-bass', name: 'B2', solfege: 'Ti Bass', frequency: 123.47, color: 'from-purple-600 to-indigo-800', glowColor: 'rgba(147,51,234,0.8)' },
  { id: 'bb2-bass', name: 'B♭2', solfege: 'Te Bass', frequency: 116.54, color: 'from-indigo-600 to-purple-800', glowColor: 'rgba(99,102,241,0.8)' },
  { id: 'a2-bass', name: 'A2', solfege: 'La Bass', frequency: 110.0, color: 'from-indigo-600 to-blue-800', glowColor: 'rgba(79,70,229,0.8)' },
  { id: 'ab2-bass', name: 'A♭2', solfege: 'Le Bass', frequency: 103.83, color: 'from-blue-600 to-indigo-800', glowColor: 'rgba(59,130,246,0.8)' },
  { id: 'g2-bass', name: 'G2', solfege: 'Sol Bass', frequency: 98.0, color: 'from-blue-600 to-cyan-800', glowColor: 'rgba(37,99,235,0.8)' },
  { id: 'fs2-bass', name: 'F♯2', solfege: 'Fi Bass', frequency: 92.50, color: 'from-cyan-600 to-teal-800', glowColor: 'rgba(13,148,136,0.8)' },
  { id: 'f2-bass', name: 'F2', solfege: 'Fa Bass', frequency: 87.31, color: 'from-teal-600 to-emerald-800', glowColor: 'rgba(13,148,136,0.8)' },
  { id: 'e2-bass', name: 'E2', solfege: 'Mi Bass', frequency: 82.41, color: 'from-emerald-600 to-green-800', glowColor: 'rgba(5,150,105,0.8)' },
  { id: 'eb2-bass', name: 'E♭2', solfege: 'Me Bass', frequency: 77.78, color: 'from-green-600 to-emerald-800', glowColor: 'rgba(5,150,105,0.8)' },
  { id: 'd2-bass', name: 'D2', solfege: 'Re Bass', frequency: 73.42, color: 'from-amber-600 to-orange-800', glowColor: 'rgba(217,119,6,0.8)' },
  { id: 'cs2-bass', name: 'C♯2', solfege: 'Ra Bass', frequency: 69.30, color: 'from-orange-600 to-rose-800', glowColor: 'rgba(225,29,72,0.8)' },
  { id: 'c2-bass', name: 'C2', solfege: 'Low Do Bass', frequency: 65.41, color: 'from-rose-600 to-red-800', glowColor: 'rgba(225,29,72,0.8)' },
];

export const FULL_MAJOR_BASS_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  ...FULL_MAJOR_BASS_NOTES,
  { id: 'b1-bass', name: 'B1', solfege: 'Sub Ti Bass', frequency: 61.74, color: 'from-red-600 to-rose-900', glowColor: 'rgba(190,18,60,0.8)' },
  { id: 'a1-bass', name: 'A1', solfege: 'Sub La Bass', frequency: 55.0, color: 'from-rose-700 to-pink-900', glowColor: 'rgba(159,18,57,0.8)' },
  { id: 'g1-bass', name: 'G1', solfege: 'Sub Sol Bass', frequency: 49.0, color: 'from-purple-800 to-slate-900', glowColor: 'rgba(107,33,168,0.8)' },
  { id: 'f1-bass', name: 'F1', solfege: 'Sub Fa Bass', frequency: 43.65, color: 'from-indigo-800 to-slate-900', glowColor: 'rgba(55,48,163,0.8)' },
  { id: 'e1-bass', name: 'E1', solfege: 'Sub Mi Bass', frequency: 41.2, color: 'from-blue-800 to-slate-900', glowColor: 'rgba(30,58,138,0.8)' },
  { id: 'd1-bass', name: 'D1', solfege: 'Sub Re Bass', frequency: 36.71, color: 'from-cyan-800 to-slate-900', glowColor: 'rgba(22,78,99,0.8)' },
  { id: 'c1-bass', name: 'C1', solfege: 'Sub Do Bass', frequency: 32.7, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
];

export const PENTATONIC_BASS_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  ...PENTATONIC_BASS_NOTES,
  { id: 'a1-bass', name: 'A1', solfege: 'Sub La Bass', frequency: 55.0, color: 'from-rose-700 to-pink-900', glowColor: 'rgba(159,18,57,0.8)' },
  { id: 'g1-bass', name: 'G1', solfege: 'Sub Sol Bass', frequency: 49.0, color: 'from-purple-800 to-slate-900', glowColor: 'rgba(107,33,168,0.8)' },
  { id: 'e1-bass', name: 'E1', solfege: 'Sub Mi Bass', frequency: 41.2, color: 'from-blue-800 to-slate-900', glowColor: 'rgba(30,58,138,0.8)' },
  { id: 'd1-bass', name: 'D1', solfege: 'Sub Re Bass', frequency: 36.71, color: 'from-cyan-800 to-slate-900', glowColor: 'rgba(22,78,99,0.8)' },
  { id: 'c1-bass', name: 'C1', solfege: 'Sub Do Bass', frequency: 32.7, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
];

export const FULL_MINOR_BASS_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  ...FULL_MINOR_BASS_NOTES,
  { id: 'bb1-bass', name: 'B♭1', solfege: 'Sub Te Bass', frequency: 58.27, color: 'from-red-600 to-rose-900', glowColor: 'rgba(190,18,60,0.8)' },
  { id: 'ab1-bass', name: 'A♭1', solfege: 'Sub Le Bass', frequency: 51.91, color: 'from-rose-700 to-pink-900', glowColor: 'rgba(159,18,57,0.8)' },
  { id: 'g1-bass', name: 'G1', solfege: 'Sub Sol Bass', frequency: 49.0, color: 'from-purple-800 to-slate-900', glowColor: 'rgba(107,33,168,0.8)' },
  { id: 'f1-bass', name: 'F1', solfege: 'Sub Fa Bass', frequency: 43.65, color: 'from-indigo-800 to-slate-900', glowColor: 'rgba(55,48,163,0.8)' },
  { id: 'eb1-bass', name: 'E♭1', solfege: 'Sub Me Bass', frequency: 38.89, color: 'from-blue-800 to-slate-900', glowColor: 'rgba(30,58,138,0.8)' },
  { id: 'd1-bass', name: 'D1', solfege: 'Sub Re Bass', frequency: 36.71, color: 'from-cyan-800 to-slate-900', glowColor: 'rgba(22,78,99,0.8)' },
  { id: 'c1-bass', name: 'C1', solfege: 'Sub Do Bass', frequency: 32.7, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
];

export const CHROMATIC_BASS_NOTES_2_OCTAVES: MelodyNoteDefinition[] = [
  ...CHROMATIC_BASS_NOTES,
  { id: 'b1-bass', name: 'B1', solfege: 'Sub Ti Bass', frequency: 61.74, color: 'from-red-600 to-rose-900', glowColor: 'rgba(190,18,60,0.8)' },
  { id: 'bb1-bass', name: 'B♭1', solfege: 'Sub Te Bass', frequency: 58.27, color: 'from-rose-700 to-pink-900', glowColor: 'rgba(159,18,57,0.8)' },
  { id: 'a1-bass', name: 'A1', solfege: 'Sub La Bass', frequency: 55.0, color: 'from-purple-800 to-slate-900', glowColor: 'rgba(107,33,168,0.8)' },
  { id: 'ab1-bass', name: 'A♭1', solfege: 'Sub Le Bass', frequency: 51.91, color: 'from-indigo-800 to-slate-900', glowColor: 'rgba(55,48,163,0.8)' },
  { id: 'g1-bass', name: 'G1', solfege: 'Sub Sol Bass', frequency: 49.0, color: 'from-blue-800 to-slate-900', glowColor: 'rgba(30,58,138,0.8)' },
  { id: 'fs1-bass', name: 'F♯1', solfege: 'Sub Fi Bass', frequency: 46.25, color: 'from-cyan-800 to-slate-900', glowColor: 'rgba(22,78,99,0.8)' },
  { id: 'f1-bass', name: 'F1', solfege: 'Sub Fa Bass', frequency: 43.65, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
  { id: 'e1-bass', name: 'E1', solfege: 'Sub Mi Bass', frequency: 41.2, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
  { id: 'eb1-bass', name: 'E♭1', solfege: 'Sub Me Bass', frequency: 38.89, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
  { id: 'd1-bass', name: 'D1', solfege: 'Sub Re Bass', frequency: 36.71, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
  { id: 'cs1-bass', name: 'C♯1', solfege: 'Sub Ra Bass', frequency: 34.65, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
  { id: 'c1-bass', name: 'C1', solfege: 'Sub Do Bass', frequency: 32.7, color: 'from-slate-800 to-black', glowColor: 'rgba(15,23,42,0.8)' },
];

export function getBassNotes(scaleMode: ScaleMode, octaves: 1 | 2 = 1): MelodyNoteDefinition[] {
  if (octaves === 2) {
    if (scaleMode === 'major') return FULL_MAJOR_BASS_NOTES_2_OCTAVES;
    if (scaleMode === 'minor') return FULL_MINOR_BASS_NOTES_2_OCTAVES;
    if (scaleMode === 'chromatic') return CHROMATIC_BASS_NOTES_2_OCTAVES;
    return PENTATONIC_BASS_NOTES_2_OCTAVES;
  }
  if (scaleMode === 'major') return FULL_MAJOR_BASS_NOTES;
  if (scaleMode === 'minor') return FULL_MINOR_BASS_NOTES;
  if (scaleMode === 'chromatic') return CHROMATIC_BASS_NOTES;
  return PENTATONIC_BASS_NOTES;
}

export const BassGrid: React.FC<BassGridProps> = ({
  bassTracks,
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
  onResetBass,
  onMagicBass,
  onLoadBassPreset,
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
    BASS_INSTRUMENTS.find((i) => i.id === instrument) || BASS_INSTRUMENTS[0];

  const previewNote = (freq: number) => {
    soundEngine.playBassNote(freq, instrument, 0, volume);
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

    const activeEl = container.querySelector<HTMLElement>(`[data-bass-step="${currentStep}"]`);
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

  // Smooth scroll when measures added
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
    const targetEl = container.querySelector<HTMLElement>(`[data-bass-measure="${mIdx}"]`);
    if (targetEl) {
      const leftPos = Math.max(0, targetEl.offsetLeft - 230);
      container.scrollTo({ left: leftPos, behavior: 'smooth' });
    }
  };

  return (
    <div className="rounded-3xl border-2 border-app-border bg-app-card/90 p-4 sm:p-5 shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Top Header: Title + Controls Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-app-border pb-3">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 active:scale-95 ${
                isPlaying
                  ? 'bg-purple-500 hover:bg-purple-400 text-slate-950 shadow-[0_0_20px_rgba(168,85,247,0.7)] ring-2 ring-purple-300'
                  : 'bg-purple-500 hover:bg-purple-400 text-slate-950 shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:scale-105'
              }`}
              title={isPlaying ? 'Pause' : 'Play Bassline'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Square className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 translate-x-0.5" />
              )}
            </button>
          )}
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 text-xl shadow-lg animate-bounce-sm">
            🎸
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Bass
          </h3>
        </div>

        {/* Clean Controls: Instrument Dropdown, Preset Dropdown, Magic Bass, Mute, Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Instrument Dropdown Menu */}
          <div className="relative" ref={instrumentDropdownRef}>
            <button
              onClick={() => {
                setIsInstrumentMenuOpen(!isInstrumentMenuOpen);
                setIsPresetMenuOpen(false);
              }}
              className="flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 border border-slate-700 transition-all active:scale-95 shadow-md"
              title="Choose Bass Instrument"
            >
              <span className="text-sm">{currentInstrumentObj.emoji}</span>
              <span>{currentInstrumentObj.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isInstrumentMenuOpen && (
              <div className="absolute top-11 left-0 z-40 w-52 rounded-2xl border-2 border-purple-500/80 bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-purple-400">
                  Select Bass Instrument:
                </div>
                {BASS_INSTRUMENTS.map((inst) => {
                  const isSelected = inst.id === instrument;
                  return (
                    <button
                      key={inst.id}
                      onClick={() => {
                        onChangeInstrument(inst.id);
                        setIsInstrumentMenuOpen(false);
                        soundEngine.playBassNote(110, inst.id, 0, volume);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-purple-600 text-white font-black'
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

          {/* Preset Bass Patterns Dropdown */}
          <div className="relative" ref={presetDropdownRef}>
            <button
              onClick={() => {
                setIsPresetMenuOpen(!isPresetMenuOpen);
                setIsInstrumentMenuOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-amber-300 hover:bg-slate-700 border border-slate-700 transition-all active:scale-95"
              title="Load Pre-made Bassline"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Load Bassline</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {isPresetMenuOpen && (
              <div className="absolute top-11 left-0 z-40 w-48 rounded-2xl border-2 border-amber-400/80 bg-slate-900 p-1.5 shadow-2xl space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-amber-300">
                  Choose Bassline:
                </div>
                {BASS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onLoadBassPreset(preset.id);
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

          {/* Magic Bass Generator */}
          <button
            onClick={() => {
              onMagicBass();
              confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 px-3 py-2 text-xs font-black text-white shadow-md hover:scale-105 active:scale-95 transition-all"
            title="Generate a funky low-end bassline!"
          >
            <Dices className="h-3.5 w-3.5" />
            <span>Magic Bass 🎲</span>
          </button>

          {/* Mute Bass */}
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-xs font-black transition-all ${
              isMuted
                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Unmute bass' : 'Mute bass'}
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>

          {/* Reset Bass Button */}
          <button
            onClick={onResetBass}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 transition-colors"
            title="Reset all bass notes"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Measures Timeline Bar & Scale Switcher Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5 rounded-2xl bg-purple-950/40 p-2.5 border border-purple-900/60">
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline Length info */}
          <span className="text-xs font-black uppercase tracking-wider text-purple-300">
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
              className="flex items-center gap-1 rounded-lg bg-purple-600/70 px-2.5 py-1 text-xs font-black text-white hover:bg-purple-500 transition-all shadow-xs"
              title="Extend bassline further to the right (+ 16 steps)"
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
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-400 shadow-md font-black ring-2 ring-purple-400/40'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                }`}
                title={octaves === 1 ? 'Expand bass range by an additional octave (+1 Octave)' : 'Collapse bass range to 1 octave'}
              >
                <span>{octaves === 1 ? '1 Octave (Default)' : '2 Octaves (+1 Octave) ✨'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Timeline Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto pb-4 select-none scrollbar-thin scrollbar-thumb-slate-700/80 scrollbar-track-slate-900/60 rounded-2xl"
      >
        <div className="min-w-fit space-y-2">
          {/* Header Row: Sticky Notes Label + Continuous Measures Ruler */}
          <div className="flex items-center">
            <div className="sticky left-0 z-30 flex w-44 sm:w-52 shrink-0 items-center justify-between pr-3 bg-slate-900/95 backdrop-blur-md border-r border-slate-800 rounded-xl py-1">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Bass Notes ({bassTracks.length})
              </span>
              <span className="text-[10px] text-purple-400 font-bold">Tap to test 🔊</span>
            </div>

            <div className="flex items-center gap-3 pl-3">
              {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                <div
                  key={mIdx}
                  data-bass-measure={mIdx}
                  className="flex flex-col gap-1 rounded-2xl bg-slate-950/70 p-2 border border-slate-800 shadow-xs"
                >
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 items-center justify-center rounded-md bg-purple-500/20 px-2 text-[10px] sm:text-xs font-black text-purple-300 border border-purple-500/30">
                        Measure {mIdx + 1}
                      </span>
                      {isPlaying && Math.floor(currentStep / totalStepsInMeasure) === mIdx && (
                        <span className="h-2 w-2 rounded-full bg-purple-400 animate-ping" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      Steps {mIdx * totalStepsInMeasure + 1}–{(mIdx + 1) * totalStepsInMeasure}
                    </span>
                  </div>

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
                          data-bass-step={absStep}
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

              {totalMeasures < 4 && (
                <button
                  onClick={onAddMeasure}
                  className="flex h-[62px] w-24 shrink-0 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-black transition-all hover:scale-102 active:scale-95 gap-1 shadow-sm"
                  title={`Extend bassline further to the right (+ ${totalStepsInMeasure} steps)`}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px]">+ Measure</span>
                </button>
              )}
            </div>
          </div>

          {/* Bass Note Rows */}
          {bassTracks.map((track, trackIdx) => {
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
                    title="Tap to preview this bass pitch"
                    className={`flex w-full items-center justify-between rounded-xl bg-gradient-to-r ${
                      track.note.color
                    } px-3 py-2 text-left text-white shadow-md transition-all hover:scale-102 active:scale-95 group`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/30 text-xs font-black">
                        {track.note.name}
                      </span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs font-black drop-shadow">{track.note.solfege}</span>
                        <span className="text-[10px] text-white/80 font-bold">
                          {Math.round(track.note.frequency)} Hz
                        </span>
                      </div>
                    </div>
                    <Activity className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                  </button>
                </div>

                {/* Step Buttons */}
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
                            data-bass-step={absStep}
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
                                ♩
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
