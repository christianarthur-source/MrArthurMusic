import React, { useState, useEffect, useRef } from 'react';
import { RhythmPattern, LevelConfig } from '../types/rhythm';
import { RhythmNotation } from './RhythmNotation';
import { audioEngine } from '../services/audioEngine';
import { SoundSettingsConfig } from '../types/game';
import { Play, RotateCcw, Zap, Sparkles, Volume2, VolumeX } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TapGameProps {
  levelConfig: LevelConfig;
  settings: SoundSettingsConfig;
  onPatternComplete: (points: number, isCorrect: boolean) => void;
  streak: number;
}

interface TargetHit {
  timeOffsetSec: number;
  hit: boolean;
  accuracyLabel?: 'PERFECT' | 'GREAT' | 'OK' | 'MISSED';
}

export const TapGame: React.FC<TapGameProps> = ({
  levelConfig,
  settings,
  onPatternComplete,
  streak
}) => {
  const [patternIndex, setPatternIndex] = useState(0);
  const pattern = levelConfig.patterns[patternIndex % levelConfig.patterns.length];

  const [gameState, setGameState] = useState<'IDLE' | 'DEMO' | 'COUNT_IN' | 'TAPPING' | 'FINISHED'>('IDLE');
  const [activeUnitIdx, setActiveUnitIdx] = useState<number | null>(null);
  const [metronomeEnabled, setMetronomeEnabled] = useState(true);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; color: string } | null>(null);
  const [hitsStats, setHitsStats] = useState<{
    perfect: number;
    great: number;
    ok: number;
    missed: number;
    extraTaps: number;
  }>({
    perfect: 0,
    great: 0,
    ok: 0,
    missed: 0,
    extraTaps: 0
  });
  const [runAccuracy, setRunAccuracy] = useState<number | null>(null);

  const tapStartTimeRef = useRef<number>(0);
  const targetEventsRef = useRef<TargetHit[]>([]);
  const isPadPressed = useRef(false);
  const metronomeTimeoutsRef = useRef<number[]>([]);

  const clearMetronome = () => {
    metronomeTimeoutsRef.current.forEach(id => clearTimeout(id));
    metronomeTimeoutsRef.current = [];
  };

  // Extract all audio hit times in seconds from pattern
  const computeTargetHits = (p: RhythmPattern, tempoBpm: number): TargetHit[] => {
    const secPerBeat = 60 / tempoBpm;
    let accumulatedBeats = 0;
    const hits: TargetHit[] = [];

    p.units.forEach(unit => {
      unit.events.forEach(ev => {
        if (!ev.isRest) {
          hits.push({
            timeOffsetSec: (accumulatedBeats + ev.offsetBeats) * secPerBeat,
            hit: false
          });
        }
      });
      accumulatedBeats += unit.durationBeats;
    });

    return hits;
  };

  useEffect(() => {
    return () => {
      clearMetronome();
      audioEngine.stopAll();
    };
  }, []);

  // Demo playback so student hears how it sounds
  const handlePlayDemo = async () => {
    clearMetronome();
    if (gameState === 'DEMO') {
      audioEngine.stopAll();
      setGameState('IDLE');
      setActiveUnitIdx(null);
      return;
    }

    setGameState('DEMO');
    await audioEngine.playPattern(
      pattern,
      settings.tempoBpm,
      settings.soundKit,
      true,
      (progress) => {
        if (progress.unitIndex !== undefined) {
          setActiveUnitIdx(progress.unitIndex);
        }
        if (progress.isFinished) {
          setGameState('IDLE');
          setActiveUnitIdx(null);
        }
      }
    );
  };

  // Start live tapping challenge
  const handleStartTapping = async () => {
    clearMetronome();
    audioEngine.stopAll();
    setLastFeedback(null);
    setHitsStats({ perfect: 0, great: 0, ok: 0, missed: 0, extraTaps: 0 });
    setRunAccuracy(null);

    const targetHits = computeTargetHits(pattern, settings.tempoBpm);
    targetEventsRef.current = targetHits;

    setGameState('COUNT_IN');
    const secPerBeat = 60 / settings.tempoBpm;

    // 1. Metronome count-in (4 beats - ALWAYS played during count-off)
    for (let beat = 1; beat <= 4; beat++) {
      const tid = window.setTimeout(() => {
        audioEngine.playClick(beat === 1);
      }, (beat - 1) * secPerBeat * 1000);
      metronomeTimeoutsRef.current.push(tid);
    }

    // 2. Start tapping window exactly after count-in (4 beats delay)
    const tapStartDelayMs = 4 * secPerBeat * 1000;

    const startTid = window.setTimeout(() => {
      setGameState('TAPPING');
      tapStartTimeRef.current = performance.now();

      // Metronome clicks KEEP GOING during student tap attempt if metronomeEnabled is true!
      const totalBeats = pattern.totalBeats;
      for (let b = 0; b < totalBeats; b++) {
        const beatTid = window.setTimeout(() => {
          if (metronomeEnabled) {
            // Beat 1 of measure gets high pitch accent
            audioEngine.playClick(b % 4 === 0);
          }
        }, b * secPerBeat * 1000);
        metronomeTimeoutsRef.current.push(beatTid);
      }

      // End tapping after measure ends
      const totalMeasureSec = totalBeats * secPerBeat;
      const endTid = window.setTimeout(() => {
        evaluateFinishedRun();
      }, totalMeasureSec * 1000 + 350);
      metronomeTimeoutsRef.current.push(endTid);

    }, tapStartDelayMs);

    metronomeTimeoutsRef.current.push(startTid);
  };

  const handlePadTap = () => {
    // Drum sound immediately
    audioEngine.playPadHit(settings.soundKit);

    if (gameState !== 'TAPPING') return;

    const now = performance.now();
    const elapsedSec = (now - tapStartTimeRef.current) / 1000;

    // Find closest unhit target
    let closestIdx = -1;
    let minDiff = Infinity;

    targetEventsRef.current.forEach((tHit, idx) => {
      if (!tHit.hit) {
        const diff = Math.abs(elapsedSec - tHit.timeOffsetSec);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      }
    });

    // Strict timing windows for accurate scoring:
    // Perfect: <= 0.06s (60ms)
    // Great:   <= 0.12s (120ms)
    // OK:      <= 0.20s (200ms)
    // Missed/Off-time: > 0.20s
    if (closestIdx !== -1 && minDiff <= 0.20) {
      targetEventsRef.current[closestIdx].hit = true;

      if (minDiff <= 0.06) {
        setLastFeedback({ text: 'PERFECT! 🌟', color: 'text-amber-300' });
        setHitsStats(prev => ({ ...prev, perfect: prev.perfect + 1 }));
      } else if (minDiff <= 0.12) {
        setLastFeedback({ text: 'GREAT! 👍', color: 'text-emerald-400' });
        setHitsStats(prev => ({ ...prev, great: prev.great + 1 }));
      } else {
        const isEarly = elapsedSec < targetEventsRef.current[closestIdx].timeOffsetSec;
        setLastFeedback({ text: isEarly ? 'A Bit Early ⚠️' : 'A Bit Late ⚠️', color: 'text-amber-400' });
        setHitsStats(prev => ({ ...prev, ok: prev.ok + 1 }));
      }
    } else {
      setLastFeedback({ text: 'Extra Tap / Off Beat! ❌', color: 'text-rose-400' });
      setHitsStats(prev => ({ ...prev, extraTaps: prev.extraTaps + 1 }));
    }
  };

  const evaluateFinishedRun = () => {
    clearMetronome();
    setGameState('FINISHED');
    const totalTargets = targetEventsRef.current.length;
    const hitCount = targetEventsRef.current.filter(t => t.hit).length;
    const missedCount = totalTargets - hitCount;

    setHitsStats(prev => {
      const finalMissed = missedCount;

      // Calculate precision score:
      // Perfect = 100 pts per target
      // Great = 75 pts per target
      // OK = 40 pts per target
      // Extra tap penalty = -15 pts each
      const earnedPoints = (prev.perfect * 100) + (prev.great * 75) + (prev.ok * 40) - (prev.extraTaps * 15);
      const maxPossible = totalTargets * 100;
      const calcAccuracy = Math.max(0, Math.min(100, Math.round((earnedPoints / Math.max(1, maxPossible)) * 100)));

      setRunAccuracy(calcAccuracy);

      const isSuccess = calcAccuracy >= 70;

      if (isSuccess) {
        audioEngine.playPowerChordFanfare();
        const basePoints = levelConfig.basePointsPerQuestion || 100;
        const points = Math.round(basePoints * (calcAccuracy / 100) + (calcAccuracy >= 90 ? basePoints * 0.4 : 0));
        try {
          confetti({ particleCount: 60, spread: 60 });
        } catch {
          // ignore
        }
        onPatternComplete(points, true);
      } else {
        audioEngine.playGentleOops();
        onPatternComplete(0, false);
      }

      return {
        ...prev,
        missed: finalMissed
      };
    });
  };

  // Keyboard Spacebar listener for Chromebooks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isPadPressed.current) {
        isPadPressed.current = true;
        e.preventDefault();
        handlePadTap();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isPadPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  return (
    <div className="w-full flex flex-col items-center max-w-2xl mx-auto">
      {/* Pattern Visual Display */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
              Tap-Along Challenge
            </span>
            <h3 className="text-xl font-display font-black text-white">
              {pattern.name}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMetronomeEnabled(!metronomeEnabled)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                metronomeEnabled
                  ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 hover:bg-amber-400/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Toggle metronome click sound ON/OFF"
            >
              {metronomeEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Metronome: {metronomeEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={handlePlayDemo}
              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                gameState === 'DEMO'
                  ? 'bg-rose-500 text-white border-rose-400'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>{gameState === 'DEMO' ? 'Stop Demo' : 'Hear Demo'}</span>
            </button>
          </div>
        </div>

        <RhythmNotation
          pattern={pattern}
          syllableStyle={settings.syllableStyle}
          highlightedUnitIndex={activeUnitIdx}
          size="md"
        />
      </div>

      {/* Main Drum Pad Interactive Surface */}
      <div className="w-full flex flex-col items-center">
        {/* Dynamic Timing Feedback Badge */}
        <div className="h-8 mb-2 flex items-center justify-center">
          {lastFeedback ? (
            <span className={`text-base font-black font-display tracking-wider animate-bounce ${lastFeedback.color}`}>
              {lastFeedback.text}
            </span>
          ) : gameState === 'COUNT_IN' ? (
            <span className="text-rose-400 font-bold text-base animate-pulse">
              1, 2, READY, TAP! 🥁
            </span>
          ) : gameState === 'TAPPING' ? (
            <span className="text-amber-400 font-bold text-base animate-pulse">
              TAP WITH THE METRONOME! 🔥
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Chromebook shortcut: Tap the Drum Pad or hit the <strong className="text-slate-200">SPACEBAR</strong>!
            </span>
          )}
        </div>

        {/* Big Rock Drum Pad */}
        <button
          onClick={handlePadTap}
          className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-gradient-to-b from-slate-800 to-slate-950 border-8 border-slate-700 hover:border-amber-400/80 active:border-amber-400 active:scale-95 shadow-[0_15px_35px_rgba(0,0,0,0.6)] flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none group relative overflow-hidden"
        >
          {/* Pad texture ring */}
          <div className="absolute inset-4 rounded-full border border-slate-600/40 pointer-events-none" />
          <div className="absolute inset-8 rounded-full border border-slate-600/30 pointer-events-none" />

          <span className="text-5xl sm:text-6xl mb-2 group-hover:scale-110 group-active:scale-90 transition-transform">
            🥁
          </span>
          <span className="font-display font-black text-xl text-white tracking-wide">
            TAP PAD
          </span>
          <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider">
            Spacebar / Touch
          </span>
        </button>

        {/* Action Button Strip */}
        <div className="mt-8 flex items-center gap-3">
          {gameState !== 'TAPPING' && gameState !== 'COUNT_IN' && (
            <button
              onClick={handleStartTapping}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>{gameState === 'FINISHED' ? 'Tap Again' : 'Start Tap Test!'}</span>
            </button>
          )}

          <button
            onClick={() => {
              clearMetronome();
              audioEngine.stopAll();
              setGameState('IDLE');
              setPatternIndex(prev => prev + 1);
            }}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors cursor-pointer"
          >
            Next Rhythm
          </button>
        </div>

        {/* Results Card after round */}
        {gameState === 'FINISHED' && (
          <div className="mt-6 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center w-full max-w-sm">
            <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Rhythm Precision Report</span>
            <div className="grid grid-cols-4 gap-1 my-3">
              <div className="p-1.5 bg-slate-950/60 rounded-xl border border-amber-500/20">
                <span className="text-[10px] text-amber-400 block font-bold uppercase">Perfect</span>
                <span className="text-lg font-display font-black text-white">{hitsStats.perfect}</span>
              </div>
              <div className="p-1.5 bg-slate-950/60 rounded-xl border border-emerald-500/20">
                <span className="text-[10px] text-emerald-400 block font-bold uppercase">Great</span>
                <span className="text-lg font-display font-black text-white">{hitsStats.great}</span>
              </div>
              <div className="p-1.5 bg-slate-950/60 rounded-xl border border-amber-500/20">
                <span className="text-[10px] text-amber-400 block font-bold uppercase">OK</span>
                <span className="text-lg font-display font-black text-white">{hitsStats.ok}</span>
              </div>
              <div className="p-1.5 bg-slate-950/60 rounded-xl border border-rose-500/20">
                <span className="text-[10px] text-rose-400 block font-bold uppercase">Missed</span>
                <span className="text-lg font-display font-black text-white">{hitsStats.missed + hitsStats.extraTaps}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex justify-between items-center px-1">
              <span className="text-xs text-slate-400 font-medium">Precision Rating:</span>
              <span className={`text-sm sm:text-base font-black ${runAccuracy !== null && runAccuracy >= 70 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {runAccuracy}% {runAccuracy !== null && runAccuracy >= 70 ? 'PASSED! 🎉' : 'TRY AGAIN 🎯'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
