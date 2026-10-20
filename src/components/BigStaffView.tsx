import React, { useState, useEffect, useMemo } from 'react';
import { Score, Pitch, NoteItem } from '../types/music';
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
  Headphones,
  Check,
  RotateCcw
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

type BigStaffTheme = 'classic' | 'rainbow' | 'space' | 'dino' | 'ocean';
type ActiveBigTool = 'quarter' | 'eighthPair' | 'quarterRest' | 'eraser';

interface ThemeConfig {
  id: BigStaffTheme;
  name: string;
  emoji: string;
  pageBg: string;
  staffLineColor: string;
  clefColor: string;
  barColor: string;
}

const THEMES: Record<BigStaffTheme, ThemeConfig> = {
  classic: {
    id: 'classic',
    name: 'Music Sheet',
    emoji: '🎼',
    pageBg: 'bg-[#FCFCFA]',
    staffLineColor: '#0F172A',
    clefColor: '#0F172A',
    barColor: '#0F172A'
  },
  rainbow: {
    id: 'rainbow',
    name: 'Rainbow',
    emoji: '🌈',
    pageBg: 'bg-gradient-to-b from-sky-50 via-pink-50 to-amber-50',
    staffLineColor: '#1E293B',
    clefColor: '#4F46E5',
    barColor: '#1E293B'
  },
  space: {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    pageBg: 'bg-[#0F172A]',
    staffLineColor: '#94A3B8',
    clefColor: '#FACC15',
    barColor: '#94A3B8'
  },
  dino: {
    id: 'dino',
    name: 'Dino Jungle',
    emoji: '🦕',
    pageBg: 'bg-[#064E3B]',
    staffLineColor: '#86EFAC',
    clefColor: '#FBBF24',
    barColor: '#86EFAC'
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🌊',
    pageBg: 'bg-[#082F49]',
    staffLineColor: '#7DD3FC',
    clefColor: '#38BDF8',
    barColor: '#7DD3FC'
  }
};

// Exact authentic Treble Clef SVG Path from NotationSymbols.tsx
const TREBLE_CLEF_PATH =
  'm12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z';

// Staff line spacing: 36px
// Line 5 (top): 100
// Line 4: 136
// Line 3: 172
// Line 2 (G4): 208
// Line 1 (bottom): 244
// Space below (D4): 262
// Ledger line (C4 Middle C): 280
const STAFF_PITCH_MAP: Array<{
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  y: number;
  isLine: boolean;
  isLedger?: boolean;
}> = [
  { step: 'G', octave: 5, y: 82, isLine: false },
  { step: 'F', octave: 5, y: 100, isLine: true },
  { step: 'E', octave: 5, y: 118, isLine: false },
  { step: 'D', octave: 5, y: 136, isLine: true },
  { step: 'C', octave: 5, y: 154, isLine: false },
  { step: 'B', octave: 4, y: 172, isLine: true },
  { step: 'A', octave: 4, y: 190, isLine: false },
  { step: 'G', octave: 4, y: 208, isLine: true },
  { step: 'F', octave: 4, y: 226, isLine: false },
  { step: 'E', octave: 4, y: 244, isLine: true },
  { step: 'D', octave: 4, y: 262, isLine: false },
  { step: 'C', octave: 4, y: 280, isLine: true, isLedger: true },
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
  const [activeMeasureIndex, setActiveMeasureIndex] = useState(0);
  const [currentTheme, setCurrentTheme] = useState<BigStaffTheme>('classic');
  const [activeTool, setActiveTool] = useState<ActiveBigTool>('quarter');
  const [activeBeat, setActiveBeat] = useState<BackingBeatType>('rock');
  const [isBeatModalOpen, setIsBeatModalOpen] = useState(false);
  const [hoveredPitch, setHoveredPitch] = useState<{
    step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
    octave: number;
    y: number;
  } | null>(null);
  const [hoveredBeat, setHoveredBeat] = useState<number | null>(null);

  const track = score.tracks[0];
  const measures = track ? track.measures : [];
  const theme = THEMES[currentTheme];

  // Keep measure index bounded
  const safeMeasureIdx = Math.min(Math.max(0, activeMeasureIndex), Math.max(0, measures.length - 1));
  const currentMeasure = measures[safeMeasureIdx] || { items: [] };
  const nextMeasure = measures[safeMeasureIdx + 1];

  // Stop beat when leaving
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

  // When playhead moves during playback, advance the active measure automatically!
  useEffect(() => {
    if (isPlaying && playheadPosition && playheadPosition.measureIndex !== activeMeasureIndex) {
      setActiveMeasureIndex(playheadPosition.measureIndex);
    }
  }, [isPlaying, playheadPosition, activeMeasureIndex]);

  // Add new measure and advance directly into it
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
    setActiveMeasureIndex(measures.length);
  };

  // Place note or rest into active measure
  const handlePlaceNote = (beatNum: number, pitchTarget?: typeof hoveredPitch) => {
    const nextScore: Score = JSON.parse(JSON.stringify(score));
    const targetTrack = nextScore.tracks[0];
    if (!targetTrack) return;
    const measure = targetTrack.measures[safeMeasureIdx];
    if (!measure) return;

    const targetItemIdx = beatNum - 1;

    if (activeTool === 'eraser') {
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

    const currentPitch = pitchTarget || hoveredPitch || { step: 'C', octave: 4, y: 280 };
    const p: Pitch = { step: currentPitch.step, octave: currentPitch.octave, accidental: null };

    // Play immediate cheerful instrument sound
    onPlayPreview(p, targetTrack.instrumentId);

    if (activeTool === 'eighthPair') {
      const item1: NoteItem = {
        id: 'n_' + Math.random().toString(36).slice(2, 9),
        type: 'note',
        pitch: p,
        pitches: [p],
        duration: 0.125
      };
      const item2: NoteItem = {
        id: 'n_' + Math.random().toString(36).slice(2, 9),
        type: 'note',
        pitch: p,
        pitches: [p],
        duration: 0.125
      };
      measure.items.splice(targetItemIdx, 1, item1, item2);
    } else {
      const newItem: NoteItem = {
        id: 'n_' + Math.random().toString(36).slice(2, 9),
        type: 'note',
        pitch: p,
        pitches: [p],
        duration: 0.25
      };
      if (targetItemIdx < measure.items.length) {
        measure.items[targetItemIdx] = newItem;
      } else {
        measure.items.push(newItem);
      }
    }

    onUpdateScore(nextScore);
  };

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
          confetti({ particleCount: 70, spread: 70 });
        } catch {}
      });
    }
  };

  const isDark = currentTheme === 'space' || currentTheme === 'dino' || currentTheme === 'ocean';

  return (
    <div
      className={`w-full min-h-[85vh] flex flex-col justify-between ${theme.pageBg} transition-colors duration-500 rounded-3xl p-4 sm:p-7 shadow-2xl relative select-none border-2 border-slate-300/40 overflow-hidden`}
    >
      {/* ========================================================
          TWO CONTROL BARS ABOVE STAFF (Placed like the user's image)
         ======================================================== */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 z-20">
        {/* LEFT BAR: Note tools, Back button, Add a Beat */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-r from-amber-400 via-pink-500 to-rose-500 p-2 sm:p-2.5 rounded-2xl shadow-lg border-2 border-white/40">
          {/* Back to Normal Staff */}
          <button
            onClick={onExitBigStaff}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs bg-slate-900 text-white hover:bg-black transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[3]" />
            <span>Normal</span>
          </button>

          {/* Note Duration Tools */}
          <div className="flex items-center gap-1.5 bg-slate-950/40 p-1 rounded-xl">
            <button
              onClick={() => setActiveTool('quarter')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                activeTool === 'quarter'
                  ? 'bg-white text-slate-950 shadow-md font-black scale-105'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <span>🎵</span>
              <span className="hidden sm:inline">Quarter (Ta)</span>
            </button>

            <button
              onClick={() => setActiveTool('eighthPair')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                activeTool === 'eighthPair'
                  ? 'bg-white text-slate-950 shadow-md font-black scale-105'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <span>🎶</span>
              <span className="hidden sm:inline">2 Eighths (Ti-Ti)</span>
            </button>

            <button
              onClick={() => setActiveTool('quarterRest')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-black text-xs transition-all cursor-pointer ${
                activeTool === 'quarterRest'
                  ? 'bg-white text-slate-950 shadow-md font-black scale-105'
                  : 'text-white hover:bg-white/20'
              }`}
            >
              <span>🤫</span>
              <span className="hidden sm:inline">Rest (Shh)</span>
            </button>

            <button
              onClick={() => setActiveTool('eraser')}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTool === 'eraser'
                  ? 'bg-rose-700 text-white shadow-md scale-105'
                  : 'text-white hover:bg-white/20'
              }`}
              title="Eraser tool"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Add a Beat! Button */}
          <button
            onClick={() => setIsBeatModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs bg-yellow-300 hover:bg-yellow-200 text-slate-950 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Headphones className="w-3.5 h-3.5 text-pink-600" />
            <span>
              {activeBeat === 'none'
                ? 'Add Beat!'
                : `Beat: ${BACKING_BEAT_OPTIONS.find((b) => b.id === activeBeat)?.name.split(' ')[0]}`}
            </span>
          </button>
        </div>

        {/* RIGHT BAR: Play button, Tempo, Measure Nav, Themes */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 p-2 sm:p-2.5 rounded-2xl shadow-lg border-2 border-white/40">
          {/* Measure Navigation Indicator & Jump Buttons */}
          <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-xl text-white font-extrabold text-xs">
            <button
              onClick={() => setActiveMeasureIndex((prev) => Math.max(0, prev - 1))}
              disabled={safeMeasureIdx <= 0}
              className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 cursor-pointer"
              title="Previous Measure"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </button>
            <span className="px-1.5 font-mono">
              Measure {safeMeasureIdx + 1} of {measures.length}
            </span>
            <button
              onClick={() => setActiveMeasureIndex((prev) => Math.min(measures.length - 1, prev + 1))}
              disabled={safeMeasureIdx >= measures.length - 1}
              className="p-1 rounded-lg hover:bg-white/20 disabled:opacity-30 cursor-pointer"
              title="Next Measure"
            >
              <ChevronRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Tempo Buttons */}
          <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-xl text-white text-[11px] font-bold">
            <button
              onClick={() => {
                const next = JSON.parse(JSON.stringify(score));
                next.tempo = 75;
                onUpdateScore(next);
              }}
              className={`px-2 py-1 rounded-md transition-all ${
                score.tempo <= 80 ? 'bg-white text-slate-950 font-black' : 'hover:bg-white/20'
              }`}
            >
              🐢
            </button>
            <button
              onClick={() => {
                const next = JSON.parse(JSON.stringify(score));
                next.tempo = 100;
                onUpdateScore(next);
              }}
              className={`px-2 py-1 rounded-md transition-all ${
                score.tempo > 80 && score.tempo < 125
                  ? 'bg-white text-slate-950 font-black'
                  : 'hover:bg-white/20'
              }`}
            >
              🚶
            </button>
            <button
              onClick={() => {
                const next = JSON.parse(JSON.stringify(score));
                next.tempo = 135;
                onUpdateScore(next);
              }}
              className={`px-2 py-1 rounded-md transition-all ${
                score.tempo >= 125 ? 'bg-white text-slate-950 font-black' : 'hover:bg-white/20'
              }`}
            >
              🐰
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center gap-1 bg-slate-950/40 p-1 rounded-xl">
            {(Object.keys(THEMES) as BigStaffTheme[]).map((tKey) => {
              const t = THEMES[tKey];
              return (
                <button
                  key={tKey}
                  onClick={() => setCurrentTheme(tKey)}
                  className={`p-1 rounded-lg text-sm transition-all ${
                    currentTheme === tKey ? 'bg-white scale-110 shadow-sm' : 'hover:bg-white/20'
                  }`}
                  title={t.name}
                >
                  {t.emoji}
                </button>
              );
            })}
          </div>

          {/* GIANT PLAY / STOP BUTTON */}
          <button
            onClick={handlePlayToggle}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-black text-xs sm:text-sm shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer ${
              isPlaying
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-white text-slate-950 hover:bg-yellow-300'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                <span>STOP</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current text-emerald-600" />
                <span>PLAY!</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================
          THE BIG REGULAR STAFF (Exact Authentic Music Notation)
         ======================================================== */}
      <div className="w-full flex-1 flex items-center justify-between gap-4 relative overflow-x-hidden min-h-[380px]">
        {/* LEFT PEEK: Go Back button if past measure 1 */}
        {safeMeasureIdx > 0 && (
          <button
            onClick={() => setActiveMeasureIndex((prev) => Math.max(0, prev - 1))}
            className="absolute left-1 z-30 flex items-center gap-1.5 px-3 py-6 rounded-2xl bg-white/90 hover:bg-white text-slate-900 border-2 border-slate-300 shadow-xl font-black text-xs transition-all hover:scale-105 cursor-pointer"
            title={`Go back to Measure ${safeMeasureIdx}`}
          >
            <ChevronLeft className="w-5 h-5 stroke-[3]" />
            <span className="hidden sm:inline">Measure {safeMeasureIdx}</span>
          </button>
        )}

        {/* MAIN STAGE: Clef + Time Sig + Active Measure (Fills ~75-80% of width) */}
        <div className="flex-1 flex items-center h-[340px] relative select-none">
          <svg viewBox="0 0 900 340" className="w-full h-full overflow-visible">
            {/* CONTINUOUS 5 STAFF LINES ACROSS THE ENTIRE PAGE */}
            {[100, 136, 172, 208, 244].map((yVal, idx) => (
              <line
                key={`line-${idx}`}
                x1="0"
                y1={yVal}
                x2="900"
                y2={yVal}
                stroke={theme.staffLineColor}
                strokeWidth="3.6"
                strokeLinecap="square"
              />
            ))}

            {/* INITIAL MEASURE START BARLINE */}
            <line
              x1="6"
              y1="100"
              x2="6"
              y2="244"
              stroke={theme.barColor}
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* AUTHENTIC TREBLE CLEF SYMBOL (Scaled perfectly to line 2 G4) */}
            <g transform="translate(18, 48)">
              <svg width="85" height="245" viewBox="0 0 15.186 40.768" preserveAspectRatio="xMidYMid meet">
                <path fill={theme.clefColor} d={TREBLE_CLEF_PATH} />
              </svg>
            </g>

            {/* 4/4 TIME SIGNATURE (Bold Musical Numbers) */}
            <g transform="translate(112, 102)" fill={theme.clefColor}>
              <text x="0" y="58" fontSize="62" fontWeight="900" fontFamily="sans-serif">
                4
              </text>
              <text x="0" y="130" fontSize="62" fontWeight="900" fontFamily="sans-serif">
                4
              </text>
            </g>

            {/* MEASURE DIVIDER BARLINE AT END OF ACTIVE MEASURE */}
            <line
              x1="700"
              y1="100"
              x2="700"
              y2="244"
              stroke={theme.barColor}
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* ACTIVE MEASURE: 4 BEAT COLUMNS (Coordinates X = 175 to 700) */}
            {[1, 2, 3, 4].map((beatNum) => {
              const colX = 200 + (beatNum - 1) * 122;

              return (
                <g key={`beat-col-${beatNum}`}>
                  {/* Invisible Hover & Click target covering lines and ledger spaces */}
                  <rect
                    x={colX - 45}
                    y="50"
                    width="110"
                    height="270"
                    fill="transparent"
                    className="hover:fill-amber-400/10 transition-colors cursor-pointer"
                    onMouseMove={(e) => handleMouseMoveOverStaff(e, beatNum)}
                    onClick={() => handlePlaceNote(beatNum)}
                  />

                  {/* Beat Number Indicator */}
                  <text
                    x={colX + 10}
                    y="60"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="800"
                    fill={isDark ? '#94A3B8' : '#64748B'}
                  >
                    Beat {beatNum}
                  </text>
                </g>
              );
            })}

            {/* RENDER PLACED NOTES AND RESTS IN ACTIVE MEASURE */}
            {currentMeasure.items.map((item, itemIdx) => {
              const beatX = 210 + itemIdx * 122;

              if (item.type === 'rest') {
                return (
                  <g key={item.id || itemIdx} transform={`translate(${beatX}, 130)`}>
                    {/* Classic Quarter Rest Glyph */}
                    <path
                      d="M 12 16 L 20 34 L 9 48 L 20 58 C 22 66 11 75 7 72 C 6 68 14 64 14 60 L 7 52 L 16 40 L 7 26 Z"
                      fill={theme.clefColor}
                      transform="scale(1.35)"
                    />
                    <text
                      x="18"
                      y="78"
                      textAnchor="middle"
                      fontSize="14"
                      fontWeight="900"
                      fill={isDark ? '#FDE047' : '#475569'}
                    >
                      Shh
                    </text>
                  </g>
                );
              }

              // Active Note
              const p = item.pitch || { step: 'C', octave: 4 };
              const pitchInfo =
                STAFF_PITCH_MAP.find((m) => m.step === p.step && m.octave === p.octave) ||
                STAFF_PITCH_MAP[STAFF_PITCH_MAP.length - 1];
              const noteY = pitchInfo.y;
              const colorInfo = BOOMWHACKER_COLORS[p.step] || { bg: '#EF4444', text: '#FFFFFF' };
              const isStemUp = noteY >= 172;

              return (
                <g
                  key={item.id || itemIdx}
                  className="cursor-pointer group hover:scale-105 transition-transform"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayPreview(p, track?.instrumentId);
                  }}
                >
                  {/* Middle C Ledger Line */}
                  {pitchInfo.isLedger && (
                    <line
                      x1={beatX - 25}
                      y1={noteY}
                      x2={beatX + 25}
                      y2={noteY}
                      stroke={theme.staffLineColor}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Note Stem */}
                  <line
                    x1={isStemUp ? beatX + 17 : beatX - 17}
                    y1={noteY}
                    x2={isStemUp ? beatX + 17 : beatX - 17}
                    y2={isStemUp ? noteY - 60 : noteY + 60}
                    stroke={theme.staffLineColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />

                  {/* Big Notehead with Boomwhacker Color */}
                  <ellipse
                    cx={beatX}
                    cy={noteY}
                    rx="19"
                    ry="14.5"
                    transform={`rotate(-18 ${beatX} ${noteY})`}
                    fill={colorInfo.bg}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    className="drop-shadow-md"
                  />

                  {/* Pitch Letter Name inside notehead */}
                  <text
                    x={beatX}
                    y={noteY + 5}
                    textAnchor="middle"
                    fill={colorInfo.text}
                    fontSize="15"
                    fontWeight="900"
                    fontFamily="Outfit, sans-serif"
                  >
                    {p.step}
                  </text>

                  {/* Syllable Label under note */}
                  <text
                    x={beatX}
                    y="312"
                    textAnchor="middle"
                    fontSize="14"
                    fontWeight="bold"
                    fill={isDark ? '#FDE047' : '#334155'}
                  >
                    {item.duration === 0.125 ? 'Ti' : 'Ta'}
                  </text>
                </g>
              );
            })}

            {/* TRANSLUCENT HOVER GHOST NOTE PREVIEW */}
            {hoveredPitch && hoveredBeat && (
              <g
                transform={`translate(${210 + (hoveredBeat - 1) * 122}, ${hoveredPitch.y})`}
                opacity="0.65"
              >
                {hoveredPitch.y === 280 && (
                  <line x1="-22" y1="0" x2="22" y2="0" stroke="#F59E0B" strokeWidth="4" />
                )}
                <ellipse cx="0" cy="0" rx="19" ry="14.5" transform="rotate(-18)" fill="#FBBF24" stroke="#FFFFFF" strokeWidth="2" />
                <text x="0" y="5" textAnchor="middle" fill="#000000" fontSize="15" fontWeight="900">
                  {hoveredPitch.step}
                </text>
              </g>
            )}

            {/* ========================================================
                RIGHT PEEK: NEXT MEASURE / ADD MEASURE (User Requested)
               ======================================================== */}
            {nextMeasure ? (
              /* Preview of Next Measure: Clicking advances directly into it */
              <g
                transform="translate(700, 0)"
                className="cursor-pointer group"
                onClick={() => setActiveMeasureIndex((prev) => prev + 1)}
              >
                {/* Clickable Overlay */}
                <rect
                  x="0"
                  y="40"
                  width="200"
                  height="280"
                  fill="transparent"
                  className="group-hover:fill-emerald-400/10 transition-colors"
                />

                {/* Measure Label */}
                <text
                  x="80"
                  y="60"
                  fontSize="13"
                  fontWeight="bold"
                  fill={isDark ? '#6EE7B7' : '#059669'}
                >
                  Measure {safeMeasureIdx + 2} 👉
                </text>

                {/* Preview Notes in Next Measure */}
                {nextMeasure.items.map((it, nIdx) => {
                  const pX = 35 + nIdx * 40;
                  if (it.type === 'rest') {
                    return (
                      <circle key={nIdx} cx={pX} cy="172" r="5" fill="#94A3B8" opacity="0.6" />
                    );
                  }
                  const st = it.pitch?.step || 'C';
                  const clr = BOOMWHACKER_COLORS[st]?.bg || '#EF4444';
                  const yPos =
                    STAFF_PITCH_MAP.find(
                      (m) => m.step === it.pitch?.step && m.octave === it.pitch?.octave
                    )?.y || 208;
                  return (
                    <ellipse
                      key={nIdx}
                      cx={pX}
                      cy={yPos}
                      rx="10"
                      ry="7.5"
                      fill={clr}
                      opacity="0.8"
                    />
                  );
                })}

                {/* End Barline for peek */}
                <line x1="196" y1="100" x2="196" y2="244" stroke={theme.barColor} strokeWidth="3" opacity="0.5" />
              </g>
            ) : (
              /* Last Measure: Show "+ Add Measure!" Button */
              <g
                transform="translate(710, 0)"
                className="cursor-pointer group"
                onClick={handleAddMeasure}
              >
                <rect
                  x="10"
                  y="90"
                  width="160"
                  height="165"
                  rx="24"
                  fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'}
                  stroke={isDark ? '#A7F3D0' : '#10B981'}
                  strokeWidth="3"
                  strokeDasharray="8 6"
                  className="group-hover:scale-105 transition-transform"
                />
                <circle cx="90" cy="155" r="26" fill="#10B981" />
                <text x="90" y="165" textAnchor="middle" fontSize="30" fontWeight="900" fill="#FFFFFF">
                  +
                </text>
                <text
                  x="90"
                  y="205"
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="900"
                  fill={isDark ? '#A7F3D0' : '#065F46'}
                >
                  Add Measure
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* RIGHT PEEK BUTTON: Mobile/Touch Advance */}
        {nextMeasure && (
          <button
            onClick={() => setActiveMeasureIndex((prev) => prev + 1)}
            className="hidden sm:flex items-center gap-1.5 px-4 py-8 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-xl transition-all hover:scale-105 cursor-pointer z-30 ml-2"
          >
            <span>Next</span>
            <ChevronRight className="w-5 h-5 stroke-[3]" />
          </button>
        )}
      </div>

      {/* ========================================================
          BOTTOM HINT BAR: Kid-Friendly Instruction
         ======================================================== */}
      <div className="w-full flex items-center justify-between pt-3 border-t border-slate-300/40 text-xs text-slate-500">
        <span className="font-extrabold text-slate-600 flex items-center gap-1.5">
          <span>✨ Click any line or space to place a note!</span>
          <span className="text-slate-400">• Click the next measure on the right to advance 👉</span>
        </span>

        <button
          onClick={() => {
            const next = JSON.parse(JSON.stringify(score));
            const m = next.tracks[0]?.measures[safeMeasureIdx];
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
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-rose-100 text-slate-700 hover:text-rose-600 font-bold transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear This Measure</span>
        </button>
      </div>

      {/* ========================================================
          "ADD A BEAT!" GROOVE SELECTOR MODAL
         ======================================================== */}
      {isBeatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
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
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-md cursor-pointer"
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
