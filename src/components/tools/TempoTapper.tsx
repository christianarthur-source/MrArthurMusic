import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, RotateCcw, Sparkles } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

interface AnimalTier {
  name: string;
  emoji: string;
  term: string;
  pronunciation: string;
  meaning: string;
  minBpm: number;
  maxBpm: number;
  badgeBg: string;
  badgeText: string;
  borderGlow: string;
}

const ANIMAL_TIERS: AnimalTier[] = [
  {
    name: 'Sleepy Turtle',
    emoji: '🐢',
    term: 'Largo',
    pronunciation: 'LAHR-go',
    meaning: 'Broad & Very Slow',
    minBpm: 0,
    maxBpm: 59,
    badgeBg: 'bg-indigo-950/80',
    badgeText: 'text-indigo-300 border-indigo-500/40',
    borderGlow: 'from-indigo-500 to-blue-600',
  },
  {
    name: 'Walking Penguin',
    emoji: '🐧',
    term: 'Andante',
    pronunciation: 'ahn-DAHN-tay',
    meaning: 'At a Walking Pace',
    minBpm: 60,
    maxBpm: 79,
    badgeBg: 'bg-sky-950/80',
    badgeText: 'text-sky-300 border-sky-500/40',
    borderGlow: 'from-sky-500 to-cyan-500',
  },
  {
    name: 'Hopping Kangaroo',
    emoji: '🦘',
    term: 'Moderato',
    pronunciation: 'mod-er-AH-toe',
    meaning: 'Moderate & Easygoing',
    minBpm: 80,
    maxBpm: 107,
    badgeBg: 'bg-emerald-950/80',
    badgeText: 'text-emerald-300 border-emerald-500/40',
    borderGlow: 'from-emerald-500 to-teal-400',
  },
  {
    name: 'Galloping Horse',
    emoji: '🐎',
    term: 'Allegro',
    pronunciation: 'ah-LEH-gro',
    meaning: 'Fast, Quick & Bright',
    minBpm: 108,
    maxBpm: 139,
    badgeBg: 'bg-amber-950/80',
    badgeText: 'text-amber-300 border-amber-500/40',
    borderGlow: 'from-amber-400 to-orange-500',
  },
  {
    name: 'Sprinting Cheetah',
    emoji: '🐆',
    term: 'Presto',
    pronunciation: 'PRESS-toe',
    meaning: 'Very Fast & Energetic',
    minBpm: 140,
    maxBpm: 179,
    badgeBg: 'bg-rose-950/80',
    badgeText: 'text-rose-300 border-rose-500/40',
    borderGlow: 'from-rose-500 to-red-500',
  },
  {
    name: 'Supersonic Rocket',
    emoji: '🚀',
    term: 'Prestissimo',
    pronunciation: 'press-TEESS-ee-mo',
    meaning: 'As Fast as Lightning!',
    minBpm: 180,
    maxBpm: 999,
    badgeBg: 'bg-purple-950/80',
    badgeText: 'text-purple-300 border-purple-500/40',
    borderGlow: 'from-purple-500 to-pink-500',
  },
];

function getTierForBpm(bpm: number): AnimalTier {
  const found = ANIMAL_TIERS.find((t) => bpm >= t.minBpm && bpm <= t.maxBpm);
  return found || ANIMAL_TIERS[2]; // Default to Moderato
}

export const TempoTapper: React.FC = () => {
  const [bpm, setBpm] = useState<number>(100);
  const [tapTimes, setTapTimes] = useState<number[]>([]);
  const [isMetronomeActive, setIsMetronomeActive] = useState<boolean>(false);
  const [beatPulse, setBeatPulse] = useState<boolean>(false);
  const [runnerPosition, setRunnerPosition] = useState<number>(10);

  const metronomeTimerRef = useRef<number | null>(null);
  const currentTier = getTierForBpm(bpm);

  // Play tap sound effect
  const playTapClick = useCallback(() => {
    try {
      soundEngine.playDrumHit('rimshot', 0, 0.7);
    } catch {
      // Audio fallback
    }
  }, []);

  // Handle a new tap
  const handleTap = useCallback(() => {
    const now = Date.now();
    playTapClick();
    setBeatPulse(true);
    setTimeout(() => setBeatPulse(false), 120);

    setTapTimes((prev) => {
      // If last tap was more than 2.5 seconds ago, reset
      if (prev.length > 0 && now - prev[prev.length - 1] > 2500) {
        return [now];
      }
      const updated = [...prev, now];
      // Keep up to 6 recent taps
      const sliced = updated.slice(-6);

      if (sliced.length >= 2) {
        // Calculate average interval
        const intervals: number[] = [];
        for (let i = 1; i < sliced.length; i++) {
          intervals.push(sliced[i] - sliced[i - 1]);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        if (avgInterval > 0) {
          const calculatedBpm = Math.round(60000 / avgInterval);
          const clamped = Math.max(35, Math.min(240, calculatedBpm));
          setBpm(clamped);
        }
      }
      return sliced;
    });
  }, [playTapClick]);

  // Spacebar hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTap]);

  // Animated animal runner movement
  useEffect(() => {
    // Runner moves across the track based on BPM
    const speedMultiplier = bpm / 100;
    const interval = window.setInterval(() => {
      setRunnerPosition((prev) => (prev >= 88 ? 5 : prev + 1.2 * speedMultiplier));
    }, 40);
    return () => clearInterval(interval);
  }, [bpm]);

  // Metronome audio ticker
  useEffect(() => {
    if (!isMetronomeActive) {
      if (metronomeTimerRef.current !== null) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
      return;
    }

    const intervalMs = (60 / bpm) * 1000;
    let step = 0;

    metronomeTimerRef.current = window.setInterval(() => {
      try {
        if (step % 4 === 0) {
          soundEngine.playDrumHit('cowbell', 0, 0.9);
        } else {
          soundEngine.playDrumHit('rimshot', 0, 0.5);
        }
      } catch {
        // audio fail-safe
      }
      setBeatPulse(true);
      setTimeout(() => setBeatPulse(false), 90);
      step++;
    }, intervalMs);

    return () => {
      if (metronomeTimerRef.current !== null) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
    };
  }, [bpm, isMetronomeActive]);

  const handleReset = () => {
    setTapTimes([]);
    setBpm(100);
    setIsMetronomeActive(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Overview & Animal Speed Card */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r ${currentTier.borderGlow} p-0.5 shadow-2xl transition-all duration-300`}
      >
        <div className="bg-slate-950/95 backdrop-blur-xl rounded-[22px] p-5 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Giant Animated Animal Display */}
          <div className="flex items-center gap-5">
            <div
              className={`w-24 h-24 sm:w-28 sm:h-28 rounded-3xl ${currentTier.badgeBg} border-2 ${currentTier.badgeText} flex items-center justify-center text-5xl sm:text-6xl shadow-inner transition-transform duration-200 ${
                beatPulse ? 'scale-115 rotate-2' : 'scale-100'
              }`}
            >
              {currentTier.emoji}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-white/10 text-white">
                  Speed Tier
                </span>
                <span className="text-xs text-slate-400 font-mono">({currentTier.pronunciation})</span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-white font-['Fredoka',sans-serif] tracking-wide">
                {currentTier.term}
              </h3>
              <p className="text-sm font-bold text-amber-300">{currentTier.meaning}</p>
              <p className="text-xs text-slate-400">{currentTier.name} pace</p>
            </div>
          </div>

          {/* Right: Digital BPM Counter */}
          <div className="flex flex-col items-center md:items-end gap-2">
            <div className="text-center md:text-right">
              <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white drop-shadow-md">
                {bpm}{' '}
                <span className="text-xl sm:text-2xl font-bold font-['Fredoka',sans-serif] text-slate-400">
                  BPM
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-1">Beats Per Minute</p>
            </div>

            {/* Metronome & Reset Controls */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsMetronomeActive((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm ${
                  isMetronomeActive
                    ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isMetronomeActive ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Metronome ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Metronome OFF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleReset}
                title="Reset to 100 BPM"
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Animated Racetrack */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-800 p-4 overflow-hidden shadow-inner">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2 px-1">
          <span>🏁 START (Largo 40)</span>
          <span className="text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Live Track Race
          </span>
          <span>FINISH (Presto 200+) 🏆</span>
        </div>

        {/* Track Line */}
        <div className="relative h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center px-2">
          {/* Track Dash Pattern */}
          <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="w-2 h-0.5 bg-slate-400 rounded-full" />
            ))}
          </div>

          {/* Running Animal Sprite */}
          <div
            className="absolute transition-transform duration-75 text-3xl select-none"
            style={{
              left: `${runnerPosition}%`,
              transform: beatPulse ? 'translateY(-6px) scale(1.2)' : 'translateY(0px)',
            }}
          >
            {currentTier.emoji}
          </div>
        </div>
      </div>

      {/* Big Interactive Tap Button (Spacebar & Touch) */}
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        <button
          type="button"
          onClick={handleTap}
          className={`w-full max-w-md py-7 px-8 rounded-3xl bg-gradient-to-r from-amber-400 via-rose-500 to-sky-500 hover:from-amber-300 hover:to-sky-400 text-slate-950 font-black text-2xl sm:text-3xl font-['Fredoka',sans-serif] tracking-wide shadow-2xl shadow-rose-500/30 active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 select-none border-2 border-amber-300/60 ${
            beatPulse ? 'scale-102 ring-4 ring-amber-300/80' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <span>TAP TEMPO</span>
            <span className="text-2xl">🥁</span>
          </div>
          <span className="text-xs font-bold text-slate-900/80 font-sans tracking-normal">
            Click here or press <kbd className="px-2 py-0.5 bg-slate-900 text-amber-300 rounded-md font-mono">SPACEBAR</kbd>
          </span>
        </button>

        <p className="text-xs text-slate-400 text-center">
          {tapTimes.length < 2
            ? 'Tap 2 or more times to calculate tempo'
            : `Averaged over ${tapTimes.length} taps`}
        </p>
      </div>

      {/* Quick Tempo Presets Strip */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Classroom Speed Presets:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {ANIMAL_TIERS.map((tier) => (
            <button
              key={tier.term}
              type="button"
              onClick={() => {
                const targetBpm = Math.round((tier.minBpm + Math.min(tier.maxBpm, 200)) / 2);
                setBpm(targetBpm);
                setTapTimes([]);
                playTapClick();
              }}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                currentTier.term === tier.term
                  ? 'bg-slate-800 border-amber-400/80 shadow-md ring-1 ring-amber-400/50'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80 text-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{tier.emoji}</span>
                <span className="text-[10px] font-bold text-slate-400">
                  {tier.minBpm}–{tier.maxBpm > 300 ? '200+' : tier.maxBpm}
                </span>
              </div>
              <div className="font-extrabold text-xs text-white mt-1 font-['Fredoka',sans-serif]">
                {tier.term}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{tier.meaning}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
