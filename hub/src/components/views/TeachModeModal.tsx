import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useClassroomTimer } from '../../context/TimerContext';
import { storage } from '../../services/storage';
import { LessonPlan, ActivityStep } from '../../types';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  CheckCircle,
  Timer,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  BookOpen
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const TeachModeModal: React.FC = () => {
  const { isTeachModeOpen, closeTeachMode, teachModeLesson } = useApp();
  const {
    timeLeft,
    totalDuration,
    isRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    setPresetSeconds,
    addSeconds,
    voiceAnnouncements,
    setVoiceAnnouncements
  } = useClassroomTimer();

  const [currentLesson, setCurrentLesson] = useState<LessonPlan | null>(teachModeLesson);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (teachModeLesson) {
      setCurrentLesson(teachModeLesson);
      setCurrentStepIndex(0);
      setCompletedSteps(new Set());
      if (teachModeLesson.activities[0]) {
        setPresetSeconds(teachModeLesson.activities[0].durationMinutes * 60);
      }
    }
  }, [teachModeLesson]);

  if (!isTeachModeOpen || !currentLesson) return null;

  const currentActivity: ActivityStep | undefined = currentLesson.activities[currentStepIndex];

  const handleStepChange = (index: number) => {
    if (index >= 0 && index < currentLesson.activities.length) {
      setCurrentStepIndex(index);
      const step = currentLesson.activities[index];
      setPresetSeconds(step.durationMinutes * 60);
    }
  };

  const handleNextStep = () => {
    setCompletedSteps((prev) => new Set(prev).add(currentStepIndex));
    if (currentStepIndex < currentLesson.activities.length - 1) {
      handleStepChange(currentStepIndex + 1);
    } else {
      // Completed all activities!
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Fallback
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTimer = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const allLessons = storage.getLessonPlans();

  return (
    <div className="fixed inset-0 z-50 bg-stone-950 text-white flex flex-col select-none overflow-hidden animate-in fade-in duration-200">
      {/* Top Teach Mode Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-900/90 backdrop-blur">
        <div className="flex items-center gap-4 min-w-0">
          <span className="px-3 py-1 bg-brand-600/30 text-brand-300 border border-brand-500/40 rounded-full text-xs font-bold uppercase tracking-wider">
            Teach Mode • Grade {currentLesson.grade}
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{currentLesson.title}</h1>
            <p className="text-xs text-stone-400 truncate">{currentLesson.unit}</p>
          </div>
        </div>

        {/* Lesson Switcher & Controls */}
        <div className="flex items-center gap-3">
          <select
            value={currentLesson.id}
            onChange={(e) => {
              const selected = allLessons.find((l) => l.id === e.target.value);
              if (selected) {
                setCurrentLesson(selected);
                setCurrentStepIndex(0);
                if (selected.activities[0]) {
                  setPresetSeconds(selected.activities[0].durationMinutes * 60);
                }
              }
            }}
            className="bg-stone-800 text-stone-200 text-xs rounded-xl px-3 py-2 border border-stone-700 focus:outline-none focus:border-brand-500"
          >
            {allLessons.map((l) => (
              <option key={l.id} value={l.id}>
                Grade {l.grade}: {l.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setVoiceAnnouncements(!voiceAnnouncements)}
            className={`p-2.5 rounded-xl border transition-all ${
              voiceAnnouncements
                ? 'bg-stone-800 border-stone-700 text-brand-400'
                : 'bg-stone-900 border-stone-800 text-stone-500'
            }`}
            title={voiceAnnouncements ? 'Voice Countdown Enabled' : 'Voice Countdown Muted'}
          >
            {voiceAnnouncements ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl text-stone-200 transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            onClick={closeTeachMode}
            className="p-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-xl transition-all"
            title="Exit Teach Mode (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Classroom Screen */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Huge Activity Display for Students / Smartboard */}
        <div className="flex-1 flex flex-col justify-between p-6 lg:p-12 overflow-y-auto">
          {currentActivity ? (
            <div className="space-y-6 max-w-4xl">
              <div className="flex items-center gap-3">
                <span className="px-3.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-sm font-semibold">
                  Step {currentStepIndex + 1} of {currentLesson.activities.length}
                </span>
                {currentActivity.musicalConcept && (
                  <span className="px-3.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {currentActivity.musicalConcept}
                  </span>
                )}
                <span className="text-stone-400 text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Planned: {currentActivity.durationMinutes} min
                </span>
              </div>

              {/* Huge Activity Headline */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                {currentActivity.title}
              </h2>

              {/* Instructions Callout */}
              <div className="p-6 sm:p-8 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-2xl space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                  Instructional Guidance & Prompts
                </h3>
                <p className="text-lg sm:text-xl text-stone-200 leading-relaxed font-serif">
                  {currentActivity.description}
                </p>

                {currentActivity.materials && currentActivity.materials.length > 0 && (
                  <div className="pt-4 border-t border-stone-800 flex flex-wrap gap-2 items-center">
                    <span className="text-xs font-semibold text-stone-400">Materials:</span>
                    {currentActivity.materials.map((m, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-stone-800 text-xs font-medium text-stone-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Lesson Objectives Checklist */}
              <div className="p-5 rounded-2xl bg-stone-900/40 border border-stone-800/80 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-400 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  Target Objective
                </h4>
                <ul className="space-y-1.5">
                  {currentLesson.objectives.map((obj, i) => (
                    <li key={i} className="text-sm text-stone-300 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-stone-400">No activities in this lesson.</div>
          )}

          {/* Activity Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-stone-800">
            <button
              onClick={() => handleStepChange(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              className="px-5 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 disabled:opacity-40 disabled:hover:bg-stone-800 text-stone-200 font-semibold flex items-center gap-2 transition-all"
            >
              <SkipBack className="w-5 h-5" />
              <span>Previous Activity</span>
            </button>

            <button
              onClick={handleNextStep}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-3 text-base shadow-elevated transition-all active:scale-95"
            >
              <span>
                {currentStepIndex === currentLesson.activities.length - 1
                  ? 'Complete Lesson! 🌟'
                  : 'Next Activity'}
              </span>
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Huge Classroom Projector Timer & Activity Sequence */}
        <div className="w-full lg:w-96 bg-stone-900/70 border-t lg:border-t-0 lg:border-l border-stone-800 p-6 flex flex-col justify-between">
          {/* Huge Timer Box */}
          <div className="bg-stone-950 rounded-3xl p-6 border border-stone-800 text-center space-y-4 shadow-xl">
            <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400">
              <Timer className="w-4 h-4 text-brand-400 animate-pulse" />
              <span>Activity Countdown</span>
            </div>

            <div
              className={`font-mono text-6xl sm:text-7xl font-extrabold tracking-tight ${
                timeLeft < 30 && isRunning
                  ? 'text-rose-500 animate-pulse'
                  : 'text-brand-400'
              }`}
            >
              {formattedTimer}
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center gap-3">
              {isRunning ? (
                <button
                  onClick={pauseTimer}
                  className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                  <Pause className="w-5 h-5 fill-white" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  onClick={startTimer}
                  className="px-6 py-3 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold flex items-center gap-2 shadow-lg transition-all"
                >
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                  <span>Start</span>
                </button>
              )}

              <button
                onClick={resetTimer}
                className="p-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition-all"
                title="Reset Timer"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                onClick={() => addSeconds(60)}
                className="px-3 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-sm font-bold transition-all"
                title="Add 1 minute"
              >
                +1m
              </button>
            </div>
          </div>

          {/* Activity Sequence Timeline */}
          <div className="flex-1 mt-6 overflow-y-auto space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">
              Lesson Activity Order
            </h4>
            {currentLesson.activities.map((step, idx) => {
              const isActive = idx === currentStepIndex;
              const isDone = completedSteps.has(idx);
              return (
                <button
                  key={step.id}
                  onClick={() => handleStepChange(idx)}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-center justify-between border ${
                    isActive
                      ? 'bg-brand-950/80 border-brand-500 text-white shadow-md'
                      : isDone
                      ? 'bg-stone-900/40 border-stone-800 text-stone-400'
                      : 'bg-stone-900/60 border-stone-800/80 text-stone-300 hover:bg-stone-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isActive
                          ? 'bg-brand-500 text-white'
                          : isDone
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {isDone ? '✓' : idx + 1}
                    </span>
                    <span className="text-xs font-semibold truncate">{step.title}</span>
                  </div>
                  <span className="text-[11px] font-mono text-stone-400 shrink-0">
                    {step.durationMinutes}m
                  </span>
                </button>
              );
            })}
          </div>

          {/* Music Teacher Cart Quick Note */}
          <div className="mt-4 pt-4 border-t border-stone-800 text-center">
            <p className="text-xs text-stone-500">
              Shortcut: Space = Start/Pause • Esc = Exit Teach Mode
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
