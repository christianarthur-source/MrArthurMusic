import React from 'react';
import { useClassroomTimer } from '../../context/TimerContext';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Bell,
  Plus,
  Maximize2,
  Sparkles
} from 'lucide-react';

export const ClassroomTimerView: React.FC = () => {
  const {
    timeLeft,
    totalDuration,
    isRunning,
    isCompleted,
    startTimer,
    pauseTimer,
    resetTimer,
    setPresetSeconds,
    addSeconds,
    voiceAnnouncements,
    setVoiceAnnouncements,
    soundAlert,
    setSoundAlert,
    mode,
    setMode
  } = useClassroomTimer();

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progress = totalDuration > 0 ? (timeLeft / totalDuration) : 0;
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const presets = [
    { label: '1m Clean Up', sec: 60 },
    { label: '2m Transition', sec: 120 },
    { label: '3m Warm Up', sec: 180 },
    { label: '5m Activity', sec: 300 },
    { label: '10m Sectional', sec: 600 },
    { label: '15m Rehearsal', sec: 900 },
    { label: '20m Partner Work', sec: 1200 },
    { label: '30m Period', sec: 1800 },
    { label: '40m Full Class', sec: 2400 }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-12 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-col items-center text-center space-y-8">
        {/* Top Controls Bar */}
        <div className="w-full flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMode('countdown');
                resetTimer();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'countdown'
                  ? 'bg-brand-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
              }`}
            >
              Countdown Mode
            </button>
            <button
              onClick={() => {
                setMode('stopwatch');
                resetTimer();
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                mode === 'stopwatch'
                  ? 'bg-brand-600 text-white'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
              }`}
            >
              Stopwatch
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceAnnouncements(!voiceAnnouncements)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                voiceAnnouncements
                  ? 'bg-stone-100 dark:bg-stone-800 text-brand-600 border-brand-200 dark:border-brand-800'
                  : 'text-stone-400 border-stone-200 dark:border-stone-700'
              }`}
            >
              {voiceAnnouncements ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{voiceAnnouncements ? 'Spoken Cues On' : 'Voice Off'}</span>
            </button>

            <button
              onClick={() => setSoundAlert(!soundAlert)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                soundAlert
                  ? 'bg-stone-100 dark:bg-stone-800 text-amber-600 border-amber-200 dark:border-amber-800'
                  : 'text-stone-400 border-stone-200 dark:border-stone-700'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{soundAlert ? 'Chime Alert On' : 'Chime Off'}</span>
            </button>
          </div>
        </div>

        {/* Circular Progress Ring & Large Clock */}
        <div className="relative flex items-center justify-center">
          <svg width="340" height="340" className="rotate-[-90deg]">
            {/* Background ring */}
            <circle
              cx="170"
              cy="170"
              r={radius}
              stroke="currentColor"
              strokeWidth="16"
              className="text-stone-100 dark:text-stone-800 fill-none"
            />
            {/* Progress ring */}
            {mode === 'countdown' && (
              <circle
                cx="170"
                cy="170"
                r={radius}
                stroke="currentColor"
                strokeWidth="16"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`transition-all duration-500 fill-none ${
                  isCompleted
                    ? 'text-rose-500 animate-pulse'
                    : timeLeft < 30 && isRunning
                    ? 'text-amber-500'
                    : 'text-brand-600'
                }`}
              />
            )}
          </svg>

          {/* Time Display */}
          <div className="absolute flex flex-col items-center justify-center">
            <span
              className={`font-mono text-6xl sm:text-7xl font-black tracking-tight ${
                isCompleted
                  ? 'text-rose-600 animate-bounce'
                  : timeLeft < 30 && isRunning
                  ? 'text-amber-500'
                  : 'text-stone-900 dark:text-white'
              }`}
            >
              {formattedTime}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-stone-400 mt-1">
              {isCompleted ? 'Time is up!' : mode === 'countdown' ? 'Classroom Timer' : 'Stopwatch'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {isRunning ? (
            <button
              onClick={pauseTimer}
              className="px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex items-center gap-2 shadow-elevated transition-all active:scale-95"
            >
              <Pause className="w-5 h-5 fill-white" />
              <span>Pause Timer</span>
            </button>
          ) : (
            <button
              onClick={startTimer}
              className="px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold flex items-center gap-2 shadow-elevated transition-all active:scale-95"
            >
              <Play className="w-5 h-5 fill-white ml-0.5" />
              <span>Start Timer</span>
            </button>
          )}

          <button
            onClick={resetTimer}
            className="p-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-all"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={() => addSeconds(60)}
            className="px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>1 Minute</span>
          </button>

          <button
            onClick={() => addSeconds(30)}
            className="px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>30 Sec</span>
          </button>
        </div>

        {/* Classroom Quick Presets */}
        <div className="w-full max-w-2xl pt-6 border-t border-stone-100 dark:border-stone-800 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Quick Activity Duration Presets
          </h3>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {presets.map((preset) => (
              <button
                key={preset.sec}
                onClick={() => setPresetSeconds(preset.sec)}
                className="px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-stone-800/80 hover:bg-brand-50 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-300 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200/60 dark:border-stone-700 transition-all"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
