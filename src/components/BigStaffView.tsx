import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Score, Pitch, NoteItem, Measure } from '../types/music';
import { BOOMWHACKER_COLORS } from '../utils/musicMath';
import { backingBeatEngine, BackingBeatType, BACKING_BEAT_OPTIONS } from '../audio/backingBeatEngine';
import {
  Play,
  Square,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Volume2,
  Sparkles,
  Music,
  Headphones,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BigStaffViewProps {
  score: Score;
  onUpdateScore: (newScore: Score) => void;
  onPlayScore: (onFinished?: () => void) => void;
  onStopPlayback: () => void;
  isPlaying: boolean;
  playheadPosition: { measureIndex: number; beatFraction: number } | null;
  onPlayPreview: (pitch: Pitch | Pitch[], instrumentId?: any) => void;
  onExitBigStaff: () => void;
}

type BigStaffTheme = 'space' | 'rainbow' | 'dino' | 'ocean' | 'rock';
type ActiveBigTool = 'quarter' | 'eighthPair' | 'quarterRest' | 'eraser';

interface ThemeConfig {
  id: BigStaffTheme;
  name: string;
  emoji: string;
  bgGradient: string;
  staffLineColor: string;
  textColor: string;
  cardBg: string;
  cardBorder: string;
  mascot: string;
}

const THEMES: Record<BigStaffTheme, ThemeConfig> = {
  space: {
    id: 'space',
    name: 'Outer Space',
    emoji: '🚀',
    bgGradient: 'from-slate-950 via-indigo-950 to-slate-900',
    staffLineColor: '#818cf8',
    textColor: 'text-indigo-200',
    cardBg: 'bg-slate-900/90',
    cardBorder: 'border-indigo-500/40',
    mascot: '🪐 🛸 ⭐ 🚀'
  },
  rainbow: {
    id: 'rainbow',
    name: 'Rainbow Kingdom',
    emoji: '🌈',
    bgGradient: 'from-sky-100 via-pink-50 to-amber-50',
    staffLineColor: '#6366f1',
    textColor: 'text-indigo-900',
    cardBg: 'bg-white/95',
    cardBorder: 'border-pink-300 shadow-pink-200/50',
    mascot: '☁️ 🌈 🧁 🎈'
  },
  dino: {
    id: 'dino',
    name: 'Dino Jungle',
    emoji: '🦕',
    bgGradient: 'from-emerald-950 via-teal-950 to-slate-950',
    staffLineColor: '#a3e635',
    textColor: 'text-emerald-200',
    cardBg: 'bg-emerald-950/80',
    cardBorder: 'border-lime-500/40',
    mascot: '🌿 🦕 🌋 🌴'
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Adventure',
    emoji: '🌊',
    bgGradient: 'from-cyan-950 via-blue-950 to-slate-950',
    staffLineColor: '#22d3ee',
    textColor: 'text-cyan-200',
    cardBg: 'bg-cyan-950/80',
    cardBorder: 'border-cyan-400/40',
    mascot: '🫧 🐬 🐠 🐙'
  },
  rock: {
    id: 'rock',
    name: 'Rock Concert',
    emoji: '🎸',
    bgGradient: 'from-purple-950 via-fuchsia-950 to-slate-950',
    staffLineColor: '#f472b6',
    textColor: 'text-fuchsia-200',
    cardBg: 'bg-purple-950/80',
    cardBorder: 'border-fuchsia-500/40',
    mascot: '⚡ 🎸 🥁 🎤'
  }
};

// Staff diatonic geometry (LINE_SPACING = 38px)
// Staff lines at Y = 80, 118, 156, 194, 232
// F5 = 80 (top line)
// E5 = 99 (space 4)
// D5 = 118 (line 4)
// C5 = 137 (space 3)
// B4 = 156 (line 3)
// A4 = 175 (space 2)
// G4 = 194 (line 2)
// F4 = 213 (space 1)
// E4 = 232 (line 1 - bottom line)
// D4 = 251 (space below staff)
// C4 = 270 (ledger line - Middle C)
const STAFF_PITCH_MAP: Array<{ step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; y: number; isLine: boolean; isLedger?: boolean }> = [
  { step: 'G', octave: 5, y: 61, isLine: false },
  { step: 'F', octave: 5, y: 80, isLine: true },
  { step: 'E', octave: 5, y: 99, isLine: false },
  { step: 'D', octave: 5, y: 118, isLine: true },
  { step: 'C', octave: 5, y: 137, isLine: false },
  { step: 'B', octave: 4, y: 156, isLine: true },
  { step: 'A', octave: 4, y: 175, isLine: false },
  { step: 'G', octave: 4, y: 194, isLine: true },
  { step: 'F', octave: 4, y: 213, isLine: false },
  { step: 'E', octave: 4, y: 232, isLine: true },
  { step: 'D', octave: 4, y: 251, isLine: false },
  { step: 'C', octave: 4, y: 270, isLine: true, isLedger: true },
];

export const BigStaffView: React.FC<BigStaffViewProps> = ({
  score,
  onUpdateScore,
  onPlayScore,
  onStopPlayback,
  isPlaying,
  playheadPosition,
  onPlayPreview,
  onExitBigStaff
}) => {
  const [currentTheme, setCurrentTheme] = useState<BigStaffTheme>('rainbow');
  const [activeTool, setActiveTool] = useState<ActiveBigTool>('quarter');
  const [activeBeat, setActiveBeat] = useState<BackingBeatType>('rock');
  const [isBeatModalOpen, setIsBeatModalOpen] = useState(false);
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState(0);
  const [hoveredPitch, setHoveredPitch] = useState<{ step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; y: number } | null>(null);
  const [hoveredBeat, setHoveredBeat] = useState<number | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const track = score.tracks[0];
  const measures = track ? track.measures : [];
  const theme = THEMES[currentTheme];

  // Stop beat when leaving or stopping playback
  useEffect(() => {
    return () => {
      backingBeatEngine.stop();
    };
  }, []);

  // Sync backing beat with score playback
  useEffect(() => {
    if (isPlaying) {
      if (activeBeat !== 'none') {
        backingBeatEngine.start(activeBeat, score.tempo);
      }
    } else {
      backingBeatEngine.stop();
    }
  }, [isPlaying, activeBeat, score.tempo]);

  // Scroll to active measure smoothly
  const scrollToMeasure = (idx: number) => {
    if (idx < 0 || idx >= measures.length) return;
    setSelectedMeasureIndex(idx);
    const container = scrollContainerRef.current;
    if (container) {
      const measureWidth = 480;
      container.scrollTo({ left: idx * (measureWidth + 24), behavior: 'smooth' });
    }
  };

  // Add new measure
  const handleAddMeasure = () => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const newMeasureId = 'm_' + Math.random().toString(36).slice(2, 9);
    nextScore.tracks.forEach((t) => {
      t.measures.push({
        id: newMeasureId,
        items: [
          { id: 'n_' + Math.random().toString(36).slice(2, 9), type: 'rest', duration: 0.25 },
          { id: 'n_' + Math.random().toString(36).slice(2, 9), type: 'rest', duration: 0.25 },
          { id: 'n_' + Math.random().toString(36).slice(2, 9), type: 'rest', duration: 0.25 },
          { id: 'n_' + Math.random().toString(36).slice(2, 9), type: 'rest', duration: 0.25 },
        ]
      });
    });
    onUpdateScore(nextScore);
    setTimeout(() => {
      scrollToMeasure(measures.length);
    }, 100);
  };

  // Place note or rest into measure
  const handleMeasureClick = (measureIdx: number, beat: number, pitchTarget?: typeof hoveredPitch) => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const targetTrack = nextScore.tracks[0];
    if (!targetTrack) return;
    const measure = targetTrack.measures[measureIdx];
    if (!measure) return;

    if (activeTool === 'eraser') {
      // Clear note at beat (replace with rest)
      const targetItemIdx = beat - 1;
      if (targetItemIdx >= 0 && targetItemIdx < measure.items.length) {
        measure.items[targetItemIdx] = {
          id: 'n_' + Math.random().toString(36).slice(2, 9),
          type: 'rest',
          duration: 0.25
        };
        onUpdateScore(nextScore);
      }
      return;
    }

    if (activeTool === 'quarterRest') {
      const targetItemIdx = beat - 1;
      const newItem: NoteItem = {
        id: 'n_' + Math.random().toString(36).slice(2, 9),
        type: 'rest',
        duration: 0.25
      };
      if (targetItemIdx < measure.items.length) {
        measure.items[targetItemIdx] = newItem;
      } else {
        measure.items.push(newItem);
      }
      onUpdateScore(nextScore);
      return;
    }

    const currentPitch = pitchTarget || hoveredPitch || { step: 'C', octave: 4, y: 270 };
    const p: Pitch = { step: currentPitch.step, octave: currentPitch.octave, accidental: null };

    // Play instant cheerful audio preview
    onPlayPreview(p, targetTrack.instrumentId);

    const targetItemIdx = beat - 1;
    const newItem: NoteItem = {
      id: 'n_' + Math.random().toString(36).slice(2, 9),
      type: 'note',
      pitch: p,
      pitches: [p],
      duration: activeTool === 'eighthPair' ? 0.125 : 0.25
    };

    if (activeTool === 'eighthPair') {
      // Create two 8th notes
      const newItem2: NoteItem = {
        id: 'n_' + Math.random().toString(36).slice(2, 9),
        type: 'note',
        pitch: p,
        pitches: [p],
        duration: 0.125
      };
      measure.items.splice(targetItemIdx, 1, newItem, newItem2);
    } else {
      if (targetItemIdx < measure.items.length) {
        measure.items[targetItemIdx] = newItem;
      } else {
        measure.items.push(newItem);
      }
    }

    onUpdateScore(nextScore);
  };

  // Convert mouse Y in measure to closest pitch on big staff
  const handleMouseMoveOverStaff = (e: React.MouseEvent<SVGElement>, beatIndex: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;

    let closest = STAFF_PITCH_MAP[0];
    let minDiff = Math.abs(relativeY - closest.y);

    for (const p of STAFF_PITCH_MAP) {
      const diff = Math.abs(relativeY - p.y);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    setHoveredPitch({ step: closest.step, octave: closest.octave, y: closest.y });
    setHoveredBeat(beatIndex);
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      onStopPlayback();
    } else {
      onPlayScore(() => {
        try {
          confetti({ particleCount: 60, spread: 60 });
        } catch {}
      });
    }
  };

  const handleTempoChange = (newTempo: number) => {
    const next = JSON.parse(JSON.stringify(score));
    next.tempo = newTempo;
    onUpdateScore(next);
  };

  return (
    <div className={`w-full min-h-[92vh] flex flex-col items-center justify-between bg-gradient-to-br ${theme.bgGradient} transition-colors duration-500 rounded-3xl p-3 sm:p-6 shadow-2xl relative select-none overflow-hidden border-2 ${theme.cardBorder}`}>
      {/* Top Banner Navigation & Theme Selector */}
      <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-4 z-20">
        {/* Back Button */}
        <button
          onClick={onExitBigStaff}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm bg-white/90 hover:bg-white text-slate-900 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-slate-300"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" />
          <span>Back to Normal Staff</span>
        </button>

        {/* Theme Picker */}
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
          {(Object.keys(THEMES) as BigStaffTheme[]).map((tKey) => {
            const t = THEMES[tKey];
            const isSelected = currentTheme === tKey;
            return (
              <button
                key={tKey}
                onClick={() => setCurrentTheme(tKey)}
                title={`Switch Theme: ${t.name}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-950 shadow-md font-extrabold scale-105'
                    : 'text-white/80 hover:bg-white/20'
                }`}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="hidden sm:inline">{t.name}</span>
              </button>
            );
          })}
        </div>

        {/* Add a Beat! Button */}
        <button
          onClick={() => setIsBeatModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 shadow-lg shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/30"
        >
          <Headphones className="w-4 h-4" />
          <span>
            {activeBeat === 'none'
              ? '🥁 Add a Beat!'
              : `🥁 Beat: ${BACKING_BEAT_OPTIONS.find((b) => b.id === activeBeat)?.name}`}
          </span>
        </button>
      </div>

      {/* Measure Navigation Bar (Center Header) */}
      <div className="flex items-center justify-center gap-4 mb-2 z-10">
        <button
          onClick={() => scrollToMeasure(selectedMeasureIndex - 1)}
          disabled={selectedMeasureIndex <= 0}
          className="p-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all cursor-pointer font-black"
          title="Previous Measure"
        >
          <ChevronLeft className="w-6 h-6 stroke-[3]" />
        </button>

        <div className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-black/50 backdrop-blur-md border border-white/20 text-white font-display font-extrabold text-base sm:text-lg">
          <span>Measure {selectedMeasureIndex + 1} of {measures.length}</span>
          <span className="text-xl">{theme.emoji}</span>
        </div>

        <button
          onClick={() => scrollToMeasure(selectedMeasureIndex + 1)}
          disabled={selectedMeasureIndex >= measures.length - 1}
          className="p-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed shadow-md transition-all cursor-pointer font-black"
          title="Next Measure"
        >
          <ChevronRight className="w-6 h-6 stroke-[3]" />
        </button>
      </div>

      {/* HUGE Horizontal Scrolling Measures Container */}
      <div
        ref={scrollContainerRef}
        className="w-full flex items-center gap-6 overflow-x-auto py-4 px-2 sm:px-6 scroll-smooth snap-x z-10 scrollbar-thin scrollbar-thumb-white/40"
      >
        {measures.map((measure, mIdx) => {
          const isCurrentPlayhead = playheadPosition?.measureIndex === mIdx;

          return (
            <div
              key={measure.id || mIdx}
              className={`snap-center shrink-0 w-[420px] sm:w-[480px] h-[360px] rounded-3xl p-4 flex flex-col justify-between shadow-2xl relative border-4 transition-all ${
                theme.cardBg
              } ${
                isCurrentPlayhead
                  ? 'border-amber-400 ring-4 ring-amber-400/50 scale-[1.02]'
                  : theme.cardBorder
              }`}
            >
              {/* Measure Number Header */}
              <div className="w-full flex items-center justify-between px-2">
                <span className="font-extrabold text-sm text-slate-600 font-mono tracking-wider">
                  MEASURE {mIdx + 1}
                </span>
                <span className="text-xs font-bold text-slate-400">4/4 TIME</span>
              </div>

              {/* The Giant Staff SVG */}
              <div className="relative w-full h-[290px] flex items-center justify-center">
                <svg
                  viewBox="0 0 460 290"
                  className="w-full h-full overflow-visible cursor-pointer"
                  onMouseLeave={() => {
                    setHoveredPitch(null);
                    setHoveredBeat(null);
                  }}
                >
                  {/* Big Treble Clef Graphic on Measure 1 */}
                  {mIdx === 0 && (
                    <g transform="translate(14, 52) scale(1.65)" opacity="0.95">
                      <path
                        d="M 16 75 C 13 65 14 55 18 45 C 22 35 25 24 23 14 C 22 6 18 0 15 0 C 13 0 12 4 13 8 C 14 15 11 25 7 35 C 3 45 0 57 1 68 C 2 82 12 95 24 96 C 35 97 45 88 44 75 C 43 62 33 55 22 55 C 17 55 14 57 12 60 C 12 55 15 48 20 40 L 21 82 C 21 95 19 108 14 116 C 10 122 4 124 0 120 C -3 117 -2 112 2 110 C 6 109 8 111 8 114 C 11 110 13 102 13 90 Z"
                        fill={currentTheme === 'rainbow' ? '#4f46e5' : '#e2e8f0'}
                      />
                    </g>
                  )}

                  {/* 5 Giant Staff Lines */}
                  {[80, 118, 156, 194, 232].map((yVal, idx) => (
                    <line
                      key={idx}
                      x1="10"
                      y1={yVal}
                      x2="450"
                      y2={yVal}
                      stroke={theme.staffLineColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  ))}

                  {/* Measure End Barlines */}
                  <line x1="450" y1="80" x2="450" y2="232" stroke={theme.staffLineColor} strokeWidth="5" strokeLinecap="round" />

                  {/* 4 Interactive Beat Columns */}
                  {[1, 2, 3, 4].map((beatNum) => {
                    const colX = mIdx === 0 ? 80 + (beatNum - 1) * 90 : 35 + (beatNum - 1) * 100;

                    return (
                      <g key={beatNum}>
                        {/* Hover & Click Area for this beat column */}
                        <rect
                          x={colX - 25}
                          y="40"
                          width="70"
                          height="240"
                          fill="transparent"
                          className="hover:fill-amber-400/10 transition-colors"
                          onMouseMove={(e) => handleMouseMoveOverStaff(e, beatNum)}
                          onClick={() => handleMeasureClick(mIdx, beatNum)}
                        />

                        {/* Subtle Beat Number at top */}
                        <text
                          x={colX + 8}
                          y="45"
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight="bold"
                          fill={currentTheme === 'rainbow' ? '#94a3b8' : '#64748b'}
                        >
                          BEAT {beatNum}
                        </text>
                      </g>
                    );
                  })}

                  {/* Render Placed Notes & Rests in this Measure */}
                  {measure.items.map((item, itemIdx) => {
                    if (item.type === 'rest') {
                      const beatX = (mIdx === 0 ? 88 : 45) + itemIdx * 94;
                      return (
                        <g key={item.id || itemIdx} transform={`translate(${beatX}, 140)`}>
                          {/* Giant Friendly Rest Glyph */}
                          <path
                            d="M 5 -20 L 14 -2 L 1 12 L 14 24 C 16 33 5 44 0 40 C -1 35 8 30 8 26 L 0 16 L 10 2 L 0 -14 Z"
                            fill={currentTheme === 'rainbow' ? '#6366f1' : '#fcd34d'}
                            transform="scale(1.3)"
                          />
                          <text
                            x="10"
                            y="48"
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="900"
                            fill={currentTheme === 'rainbow' ? '#475569' : '#cbd5e1'}
                          >
                            Shh
                          </text>
                        </g>
                      );
                    }

                    // Active Note Rendering
                    const p = item.pitch || { step: 'C', octave: 4 };
                    const pitchInfo = STAFF_PITCH_MAP.find((m) => m.step === p.step && m.octave === p.octave) || STAFF_PITCH_MAP[STAFF_PITCH_MAP.length - 1];
                    const noteY = pitchInfo.y;
                    const noteX = (mIdx === 0 ? 88 : 45) + itemIdx * 94;
                    const colorInfo = BOOMWHACKER_COLORS[p.step] || { bg: '#ef4444', text: '#ffffff' };
                    const isStemUp = noteY >= 156;

                    return (
                      <g
                        key={item.id || itemIdx}
                        className="cursor-pointer group hover:scale-110 transition-transform origin-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayPreview(p, track?.instrumentId);
                        }}
                      >
                        {/* Middle C Ledger Line */}
                        {pitchInfo.isLedger && (
                          <line
                            x1={noteX - 22}
                            y1={noteY}
                            x2={noteX + 22}
                            y2={noteY}
                            stroke={theme.staffLineColor}
                            strokeWidth="4"
                            strokeLinecap="round"
                          />
                        )}

                        {/* Note Stem */}
                        <line
                          x1={isStemUp ? noteX + 16 : noteX - 16}
                          y1={noteY}
                          x2={isStemUp ? noteX + 16 : noteX - 16}
                          y2={isStemUp ? noteY - 55 : noteY + 55}
                          stroke={currentTheme === 'rainbow' ? '#1e1b4b' : '#f8fafc'}
                          strokeWidth="4.5"
                          strokeLinecap="round"
                        />

                        {/* Giant Notehead (Boomwhacker Color) */}
                        <ellipse
                          cx={noteX}
                          cy={noteY}
                          rx="19"
                          ry="14.5"
                          transform={`rotate(-18 ${noteX} ${noteY})`}
                          fill={colorInfo.bg}
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          className="drop-shadow-lg"
                        />

                        {/* Bold Pitch Letter Name inside Notehead */}
                        <text
                          x={noteX}
                          y={noteY + 5}
                          textAnchor="middle"
                          fill={colorInfo.text}
                          fontSize="15"
                          fontWeight="900"
                          fontFamily="Outfit, sans-serif"
                        >
                          {p.step}
                        </text>

                        {/* Kodaly Syllable under note */}
                        <text
                          x={noteX}
                          y="278"
                          textAnchor="middle"
                          fontSize="13"
                          fontWeight="bold"
                          fill={currentTheme === 'rainbow' ? '#475569' : '#fde047'}
                        >
                          {item.duration === 0.125 ? 'Ti' : 'Ta'}
                        </text>
                      </g>
                    );
                  })}

                  {/* Translucent Hover Ghost Note Preview */}
                  {hoveredPitch && hoveredBeat && (
                    <g transform={`translate(${ (mIdx === 0 ? 88 : 45) + (hoveredBeat - 1) * 94 }, ${hoveredPitch.y})`} opacity="0.6">
                      {hoveredPitch.y === 270 && (
                        <line x1="-20" y1="0" x2="20" y2="0" stroke="#f59e0b" strokeWidth="4" />
                      )}
                      <ellipse cx="0" cy="0" rx="19" ry="14.5" transform="rotate(-18)" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />
                      <text x="0" y="5" textAnchor="middle" fill="#000000" fontSize="15" fontWeight="900">
                        {hoveredPitch.step}
                      </text>
                    </g>
                  )}
                </svg>
              </div>

              {/* Friendly Clear Measure Button */}
              <div className="w-full flex items-center justify-between pt-1 border-t border-slate-700/20 text-xs">
                <span className="text-[11px] font-bold text-slate-400">
                  Tap staff lines or spaces to play & place!
                </span>
                <button
                  onClick={() => {
                    const next = JSON.parse(JSON.stringify(score));
                    const m = next.tracks[0]?.measures[mIdx];
                    if (m) {
                      m.items = [
                        { id: 'n1', type: 'rest', duration: 0.25 },
                        { id: 'n2', type: 'rest', duration: 0.25 },
                        { id: 'n3', type: 'rest', duration: 0.25 },
                        { id: 'n4', type: 'rest', duration: 0.25 },
                      ];
                      onUpdateScore(next);
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                  title="Erase Measure"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* Big "+ Add Measure!" Button at the end of the scroll */}
        <button
          onClick={handleAddMeasure}
          className="snap-center shrink-0 w-[180px] h-[360px] rounded-3xl border-4 border-dashed border-white/30 bg-white/10 hover:bg-white/20 text-white flex flex-col items-center justify-center gap-3 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl"
        >
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <Plus className="w-10 h-10 stroke-[3]" />
          </div>
          <span className="font-display font-extrabold text-lg text-center px-4">
            Add Measure!
          </span>
        </button>
      </div>

      {/* Bottom Tool Rack & Controls (Designed for Young Hands) */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 mt-3 bg-black/40 backdrop-blur-md p-4 rounded-3xl border border-white/20 z-20">
        {/* Note Duration Tool Selector */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => setActiveTool('quarter')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-md ${
              activeTool === 'quarter'
                ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-300 scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span className="text-xl">🎵</span>
            <span>Quarter Note (Ta)</span>
          </button>

          <button
            onClick={() => setActiveTool('eighthPair')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-md ${
              activeTool === 'eighthPair'
                ? 'bg-sky-400 text-slate-950 ring-4 ring-sky-300 scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span className="text-xl">🎶</span>
            <span>Two 8ths (Ti-Ti)</span>
          </button>

          <button
            onClick={() => setActiveTool('quarterRest')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-md ${
              activeTool === 'quarterRest'
                ? 'bg-rose-400 text-slate-950 ring-4 ring-rose-300 scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span className="text-xl">🤫</span>
            <span>Rest (Shh)</span>
          </button>

          <button
            onClick={() => setActiveTool('eraser')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all cursor-pointer ${
              activeTool === 'eraser'
                ? 'bg-rose-600 text-white ring-4 ring-rose-400 scale-105'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            title="Eraser Tool"
          >
            <Trash2 className="w-4 h-4" />
            <span>Erase</span>
          </button>
        </div>

        {/* Speed / Tempo Toggle */}
        <div className="flex items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl">
          <button
            onClick={() => handleTempoChange(75)}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              score.tempo <= 80 ? 'bg-amber-400 text-slate-950 font-black' : 'text-white/80'
            }`}
          >
            🐢 Slow
          </button>
          <button
            onClick={() => handleTempoChange(100)}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              score.tempo > 80 && score.tempo < 125 ? 'bg-amber-400 text-slate-950 font-black' : 'text-white/80'
            }`}
          >
            🚶 Walk
          </button>
          <button
            onClick={() => handleTempoChange(135)}
            className={`px-2.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              score.tempo >= 125 ? 'bg-amber-400 text-slate-950 font-black' : 'text-white/80'
            }`}
          >
            🐰 Fast
          </button>
        </div>

        {/* Giant Play / Stop Button */}
        <button
          onClick={handlePlayToggle}
          className={`flex items-center gap-3 px-8 py-3.5 rounded-2xl font-display font-extrabold text-base sm:text-lg transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer ${
            isPlaying
              ? 'bg-rose-500 text-white shadow-rose-500/40 animate-pulse'
              : 'bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-emerald-500/30'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-5 h-5 fill-current" />
              <span>STOP SONG</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-current" />
              <span>PLAY SONG! 🎵</span>
            </>
          )}
        </button>
      </div>

      {/* "Add a Beat!" Backing Groove Selector Modal */}
      {isBeatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-pink-500/50 rounded-3xl p-6 shadow-2xl relative text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl">🥁</span>
                <h3 className="text-xl sm:text-2xl font-display font-black text-pink-400">
                  Pick a Groove For Your Song!
                </h3>
              </div>
              <button
                onClick={() => setIsBeatModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-5">
              Choose a fun drum groove. When you press Play, your melody will jam right along with the beat!
            </p>

            <div className="space-y-3 mb-6">
              {BACKING_BEAT_OPTIONS.map((opt) => {
                const isSelected = activeBeat === opt.id;

                return (
                  <div
                    key={opt.id}
                    onClick={() => setActiveBeat(opt.id)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 shadow-lg shadow-pink-500/20'
                        : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{opt.emoji}</span>
                      <div>
                        <h4 className="font-extrabold text-sm sm:text-base text-white">
                          {opt.name}
                        </h4>
                        <p className="text-[11px] text-slate-400">{opt.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {opt.id !== 'none' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            backingBeatEngine.preview(opt.id, score.tempo);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 transition-colors"
                          title="Preview Drum Sound"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-pink-400" />
                          <span>Test</span>
                        </button>
                      )}

                      {isSelected && (
                        <div className="w-7 h-7 rounded-full bg-pink-500 text-slate-950 flex items-center justify-center font-bold">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setIsBeatModalOpen(false)}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-md"
              >
                Let&apos;s Jam! 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
