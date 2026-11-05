import React from 'react';
import { useClassroomTimer } from '../../context/TimerContext';
import { useApp } from '../../context/AppContext';
import { Play, Pause, RotateCcw, Plus, Maximize2, X, Bell } from 'lucide-react';

export const FloatingTimer: React.FC = () => {
  const {
    timeLeft,
    totalDuration,
    isRunning,
    isCompleted,
    isFloatingVisible,
    setIsFloatingVisible,
    startTimer,
    pauseTimer,
    resetTimer,
    addSeconds,
    mode
  } = useClassroomTimer();
  const { setActiveView } = useApp();

  if (!isFloatingVisible) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;

  return (
    <div className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-elevated border border-stone-200/80 dark:border-stone-800 p-3.5 w-72 transition-all">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100 dark:border-stone-800/60">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
          <Bell className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
          <span>Classroom Timer ({mode})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveView('timer')}
            title="Expand to Full Classroom Timer"
            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFloatingVisible(false)}
            title="Hide Floating Widget"
            className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div
            className={`font-mono font-bold text-3xl tracking-tight ${
              isCompleted
                ? 'text-rose-600 dark:text-rose-400 animate-bounce'
                : timeLeft < 30 && isRunning
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-stone-900 dark:text-white'
            }`}
          >
            {formattedTime}
          </div>
          {isCompleted && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">Time is up!</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isRunning ? (
            <button
              onClick={pauseTimer}
              className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition-all"
              title="Pause"
            >
              <Pause className="w-4 h-4 fill-white" />
            </button>
          ) : (
            <button
              onClick={startTimer}
              className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-sm transition-all"
              title="Start"
            >
              <Play className="w-4 h-4 fill-white ml-0.5" />
            </button>
          )}

          <button
            onClick={resetTimer}
            className="p-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl transition-all"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => addSeconds(60)}
            className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-0.5 transition-all"
            title="Add 1 Minute"
          >
            <Plus className="w-3 h-3" />
            <span>1m</span>
          </button>
        </div>
      </div>

      {mode === 'countdown' && (
        <div className="w-full bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden mt-2.5">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted ? 'bg-rose-500' : timeLeft < 30 ? 'bg-amber-500' : 'bg-brand-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
};
