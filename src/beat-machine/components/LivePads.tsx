import React, { useState, useEffect } from 'react';
import { Sparkles, Radio, Play, Square } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { ALL_AVAILABLE_SAMPLES } from '../data/soundPacks';
import { SoundType } from '../types';

interface LivePadsProps {
  onPadTrigger?: (soundType: SoundType) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

const PAD_CONFIG: { soundType: SoundType; key: string }[] = [
  { soundType: 'kick', key: '1' },
  { soundType: 'snare', key: '2' },
  { soundType: 'hihat', key: '3' },
  { soundType: 'clap', key: '4' },
  { soundType: 'tom', key: 'Q' },
  { soundType: 'cowbell', key: 'W' },
  { soundType: 'plop', key: 'E' },
  { soundType: 'boing', key: 'R' },
  { soundType: 'zap', key: 'A' },
  { soundType: 'coin', key: 'S' },
  { soundType: 'quack', key: 'D' },
  { soundType: 'robot', key: 'F' },
];

export const LivePads: React.FC<LivePadsProps> = ({
  onPadTrigger,
  isPlaying = false,
  onTogglePlay,
}) => {
  const [activePad, setActivePad] = useState<string | null>(null);

  const sampleMap = React.useMemo(() => {
    const map = new Map<SoundType, (typeof ALL_AVAILABLE_SAMPLES)[0]>();
    ALL_AVAILABLE_SAMPLES.forEach((s) => map.set(s.soundType, s));
    return map;
  }, []);

  const triggerSound = (soundType: SoundType, key: string) => {
    soundEngine.playSound(soundType);
    setActivePad(key);
    if (onPadTrigger) onPadTrigger(soundType);

    setTimeout(() => {
      setActivePad(null);
    }, 150);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const keyUpper = e.key.toUpperCase();
      const match = PAD_CONFIG.find((p) => p.key === keyUpper);
      if (match) {
        triggerSound(match.soundType, match.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="rounded-3xl border-2 border-slate-700 bg-slate-800/80 p-5 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {onTogglePlay && (
            <button
              onClick={onTogglePlay}
              className={`flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 active:scale-95 ${
                isPlaying
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.7)] ring-2 ring-emerald-300'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:scale-105'
              }`}
              title={isPlaying ? 'Pause (Space)' : 'Play Beat (Space)'}
              aria-label={isPlaying ? 'Pause beat (Space)' : 'Play beat (Space)'}
            >
              {isPlaying ? (
                <Square className="h-5 w-5 fill-slate-950" />
              ) : (
                <Play className="h-5 w-5 fill-slate-950 translate-x-0.5" />
              )}
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-lg shadow-md">
              🥁
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Live Jamming Drum Pads</h3>
              <p className="text-xs font-semibold text-slate-300">
                Tap or use keyboard keys [1-4, Q-R, A-F] to jam along live!
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-cyan-950/60 px-3 py-1 text-xs font-bold text-cyan-300 border border-cyan-800">
          <Radio className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
          Live Jam Station
        </div>
      </div>

      {/* Grid of 12 Big Bouncy Pads */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {PAD_CONFIG.map(({ soundType, key }) => {
          const sample = sampleMap.get(soundType);
          if (!sample) return null;
          const isPressed = activePad === key;

          return (
            <button
              key={key}
              onClick={() => triggerSound(soundType, key)}
              className={`group relative flex h-24 flex-col items-center justify-between rounded-2xl bg-gradient-to-b ${
                sample.color
              } p-2.5 text-white shadow-lg transition-all active:scale-95 ${
                isPressed
                  ? 'scale-105 ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.7)]'
                  : 'hover:scale-102 hover:brightness-110'
              }`}
            >
              {/* Keyboard badge */}
              <span className="self-end rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-black uppercase text-white/90">
                {key}
              </span>

              {/* Sample icon */}
              <span className="text-3xl transition-transform group-hover:scale-110">
                {sample.icon}
              </span>

              {/* Sample label */}
              <span className="truncate text-center text-xs font-black tracking-tight drop-shadow">
                {sample.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
