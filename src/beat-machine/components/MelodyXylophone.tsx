import React, { useState } from 'react';
import { Sparkles, Music, Play, Square } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';
import { SoundType } from '../types';

interface MelodyXylophoneProps {
  onNoteTriggered?: (sound: SoundType) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

interface XyloKey {
  sound: SoundType;
  label: string;
  solfege: string;
  color: string;
  height: string;
}

const XYLO_KEYS: XyloKey[] = [
  { sound: 'xylo-c', label: 'C', solfege: 'Do', color: 'from-rose-500 to-red-600', height: 'h-48' },
  { sound: 'xylo-d', label: 'D', solfege: 'Re', color: 'from-orange-500 to-amber-600', height: 'h-44' },
  { sound: 'xylo-e', label: 'E', solfege: 'Mi', color: 'from-amber-400 to-yellow-500', height: 'h-40' },
  { sound: 'xylo-g', label: 'G', solfege: 'Sol', color: 'from-emerald-400 to-green-600', height: 'h-36' },
  { sound: 'xylo-a', label: 'A', solfege: 'La', color: 'from-sky-400 to-blue-600', height: 'h-32' },
  { sound: 'xylo-c2', label: 'C5', solfege: 'High Do', color: 'from-purple-500 to-violet-700', height: 'h-28' },
];

export const MelodyXylophone: React.FC<MelodyXylophoneProps> = ({
  onNoteTriggered,
  isPlaying = false,
  onTogglePlay,
}) => {
  const [activeKey, setActiveKey] = useState<SoundType | null>(null);

  const handlePlayKey = (sound: SoundType) => {
    soundEngine.playSound(sound);
    setActiveKey(sound);
    if (onNoteTriggered) {
      onNoteTriggered(sound);
    }
    setTimeout(() => {
      setActiveKey(null);
    }, 200);
  };

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
              title={isPlaying ? 'Pause' : 'Play Beat'}
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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-yellow-400 text-lg shadow-md">
              🌈
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Rainbow Melody Xylophone</h3>
              <p className="text-xs font-semibold text-slate-300">
                Play magical melodies over your beat! (Pentatonic scale: every note sounds great!)
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-slate-900/60 px-3 py-1 text-xs font-bold text-amber-300 border border-slate-700">
          <Sparkles className="h-3.5 w-3.5" />
          Always Harmonious
        </div>
      </div>

      {/* Chunky Xylophone Bars */}
      <div className="relative flex items-end justify-center gap-2 sm:gap-3 rounded-2xl bg-slate-950/60 p-4 border border-slate-800">
        {/* Support rail visual top and bottom */}
        <div className="pointer-events-none absolute top-8 left-4 right-4 h-2 rounded-full bg-amber-900/40" />
        <div className="pointer-events-none absolute bottom-8 left-4 right-4 h-2 rounded-full bg-amber-900/40" />

        {XYLO_KEYS.map((key) => {
          const isPressed = activeKey === key.sound;
          return (
            <button
              key={key.sound}
              onClick={() => handlePlayKey(key.sound)}
              className={`relative flex flex-1 flex-col items-center justify-between rounded-2xl bg-gradient-to-b ${
                key.color
              } ${key.height} p-2 text-white shadow-lg transition-all active:scale-95 ${
                isPressed
                  ? 'scale-105 ring-4 ring-white shadow-[0_0_20px_rgba(255,255,255,0.7)] -translate-y-1'
                  : 'hover:-translate-y-1 hover:brightness-110'
              }`}
            >
              {/* Top rivet */}
              <div className="h-3 w-3 rounded-full bg-slate-900/40 border border-white/40" />

              {/* Note names */}
              <div className="my-auto flex flex-col items-center">
                <span className="text-xl sm:text-2xl font-black drop-shadow-md">{key.label}</span>
                <span className="text-[11px] sm:text-xs font-bold text-white/90 drop-shadow">
                  {key.solfege}
                </span>
              </div>

              {/* Bottom rivet */}
              <div className="h-3 w-3 rounded-full bg-slate-900/40 border border-white/40" />
            </button>
          );
        })}
      </div>
    </div>
  );
};
