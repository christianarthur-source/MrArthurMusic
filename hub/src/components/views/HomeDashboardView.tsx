import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useClassroomTimer } from '../../context/TimerContext';
import { storage } from '../../services/storage';
import { TaskItem, CalendarEvent, LessonPlan } from '../../types';
import {
  Sparkles,
  Presentation,
  CheckCircle2,
  Circle,
  Clock,
  Calendar as CalendarIcon,
  Music2,
  Timer,
  ChevronRight,
  Plus,
  BookOpen,
  Sliders,
  FolderSync,
  Play,
  Volume2,
  BookMarked
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const HomeDashboardView: React.FC = () => {
  const { preferences, setActiveView, openTeachMode, showToast } = useApp();
  const { setPresetSeconds, startTimer, setIsFloatingVisible } = useClassroomTimer();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lessons, setLessons] = useState<LessonPlan[]>([]);
  const [quickTaskText, setQuickTaskText] = useState('');

  const reloadData = () => {
    setTasks(storage.getTasks());
    setEvents(storage.getEvents());
    setLessons(storage.getLessonPlans());
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const todayTasks = tasks.filter((t) => t.listType === 'today' || t.listType === 'inbox');

  const handleToggleTask = (task: TaskItem) => {
    const isNowCompleted = !task.completed;
    storage.updateTask(task.id, { completed: isNowCompleted });
    if (isNowCompleted) {
      showToast('Task completed! Keep up the great work.', 'success');
      try {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
      } catch {}
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskText.trim()) return;
    const parsed = storage.parseQuickTaskInput(quickTaskText, 'today');
    storage.addTask(parsed);
    setQuickTaskText('');
    showToast(`Added: ${parsed.title}`, 'success');
  };

  const startQuickTimer = (minutes: number) => {
    setPresetSeconds(minutes * 60);
    startTimer();
    setIsFloatingVisible(true);
    showToast(`${minutes}-minute classroom timer started`, 'info');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* Top Welcome Banner with Musical Theme */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-stone-900 via-indigo-950 to-stone-900 text-white p-6 sm:p-8 shadow-elevated border border-stone-800">
        {/* Decorative background soundwave graphic */}
        <div className="absolute right-0 top-0 bottom-0 opacity-15 pointer-events-none flex items-center pr-8">
          <div className="flex items-center gap-1.5 h-32">
            {[40, 75, 25, 90, 60, 100, 45, 80, 55, 95, 30, 85, 70, 40, 65, 88].map((h, i) => (
              <div
                key={i}
                className="w-2 bg-gradient-to-t from-rose-500 to-amber-400 rounded-full"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            {(preferences.schoolName || preferences.roomNumber) && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold backdrop-blur border border-white/10">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{[preferences.schoolName, preferences.roomNumber].filter(Boolean).join(' • ')}</span>
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <span>Good day{preferences.teacherName ? `, ${preferences.teacherName}` : ''}</span>
              <span className="text-amber-400">♫</span>
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              Welcome to your music command center. Lesson plans, Google Song Maker style sequencer, local audio studio playlist, tuner, and Things-style task manager are ready.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              onClick={() => openTeachMode()}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-amber-500 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Presentation className="w-4 h-4" />
              <span>Launch Teach Mode</span>
            </button>
            <button
              onClick={() => setActiveView('tools')}
              className="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur transition-all flex items-center gap-2 border border-white/15"
            >
              <Music2 className="w-4 h-4 text-amber-400" />
              <span>Song Maker & Tools</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Launch Colorful Music Classroom Tools Bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-2">
          <Clock className="w-4 h-4 text-rose-500" />
          Quick Classroom Tools
        </span>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveView('tools')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all border border-amber-200 dark:border-amber-800"
          >
            <Music2 className="w-3.5 h-3.5 text-amber-500" />
            <span>Song Maker Sequencer</span>
          </button>
          <button
            onClick={() => setActiveView('tools')}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Volume2 className="w-3.5 h-3.5 text-brand-500" />
            <span>Chromatic Tuner</span>
          </button>
          <button
            onClick={() => setActiveView('tools')}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Timer className="w-3.5 h-3.5 text-emerald-500" />
            <span>Metronome</span>
          </button>
          <button
            onClick={() => setActiveView('audio-studio')}
            className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-600" />
            <span>Audio Lab & Playlist</span>
          </button>
          <button
            onClick={() => startQuickTimer(5)}
            className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold flex items-center gap-1.5 transition-all hover:bg-rose-100"
          >
            <Timer className="w-3.5 h-3.5 text-rose-600" />
            <span>Start 5m Timer</span>
          </button>
          <button
            onClick={() => setActiveView('visuals')}
            className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>Interactive Staff & Piano</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Schedule, Tasks, Creative Studios */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Left 2 Columns: Schedule & Today's Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Classes */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-brand-600" />
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  Today&apos;s Music Class Schedule
                </h2>
              </div>
              <button
                onClick={() => setActiveView('calendar')}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>Full Calendar (Month / Week)</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {events.slice(0, 3).map((event) => {
                const startTime = event.startDate.split('T')[1]?.slice(0, 5) || '09:00';
                const endTime = event.endDate.split('T')[1]?.slice(0, 5) || '09:40';
                return (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-100 dark:border-stone-800 hover:border-stone-200 dark:hover:border-stone-700 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      <div
                        className="w-2.5 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: event.color || '#0c87eb' }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                          {event.title}
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                          {event.location} • {startTime} - {endTime}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const matchingLesson = lessons.find((l) => l.grade === event.grade);
                        if (matchingLesson) {
                          openTeachMode(matchingLesson);
                        } else {
                          setActiveView('planner');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 dark:bg-brand-950 dark:hover:bg-brand-900 text-brand-700 dark:text-brand-300 text-xs font-semibold shrink-0 transition-all"
                    >
                      Teach Lesson
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Things 3 Inspired Today Tasks */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  Today&apos;s Priorities ({todayTasks.filter((t) => !t.completed).length})
                </h2>
              </div>
              <button
                onClick={() => setActiveView('tasks')}
                className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
              >
                <span>Task Manager</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Task Capture */}
            <form onSubmit={handleQuickAdd} className="mb-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200/70 dark:border-stone-700 focus-within:border-brand-500 transition-all">
                <Plus className="w-4 h-4 text-stone-400 shrink-0" />
                <input
                  type="text"
                  value={quickTaskText}
                  onChange={(e) => setQuickTaskText(e.target.value)}
                  placeholder="Quick add: e.g. 'Review pentatonic mallets !high' or 'Grade 4 belt tests Friday'"
                  className="flex-1 bg-transparent text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!quickTaskText.trim()}
                  className="px-3 py-1 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-semibold transition-all shrink-0"
                >
                  Add
                </button>
              </div>
            </form>

            {/* Task list items */}
            <div className="space-y-2">
              {todayTasks.length === 0 ? (
                <p className="text-center py-6 text-xs text-stone-400">All tasks completed for today! 🎉</p>
              ) : (
                todayTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task)}
                    className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer transition-colors border border-transparent hover:border-stone-100 dark:hover:border-stone-800"
                  >
                    <button className="mt-0.5 text-stone-400 group-hover:text-brand-600 transition-colors shrink-0">
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs sm:text-sm font-medium leading-snug ${
                          task.completed
                            ? 'line-through text-stone-400 dark:text-stone-500'
                            : 'text-stone-800 dark:text-stone-200'
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.notes && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
                          {task.notes}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {task.priority === 'high' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            High Priority
                          </span>
                        )}
                        {task.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Song Maker Spotlight & Audio Studio */}
        <div className="space-y-6">
          {/* Google Song Maker Style Feature Spotlight */}
          <div className="bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 text-white rounded-3xl p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur">
                Creative Studio
              </span>
              <button
                onClick={() => setActiveView('tools')}
                className="text-xs text-white/90 hover:text-white underline font-semibold"
              >
                Open Song Maker
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black leading-tight flex items-center gap-2">
                <span>Google-Style Song Maker</span>
                <span className="text-amber-200">✨</span>
              </h3>
              <p className="text-xs text-white/90 leading-relaxed font-medium">
                Colorful melody blocks with authentic xylophone, piano, and synth sounds + punchy real drum groove tracks.
              </p>
            </div>

            {/* Rainbow pitch blocks preview */}
            <div className="flex gap-1.5 py-2">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899'].map((color, i) => (
                <div
                  key={i}
                  className="h-8 flex-1 rounded-lg shadow-sm transform hover:scale-110 transition-transform cursor-pointer"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <button
              onClick={() => setActiveView('tools')}
              className="w-full py-2.5 rounded-2xl bg-white text-stone-900 font-bold text-xs text-center shadow-lg hover:bg-stone-50 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Interactive Sequencer</span>
            </button>
          </div>

          {/* Audio Practice Lab & Playlist Launcher */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>Audio Practice Lab & Playlist</span>
              </h3>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                New Playlist
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Load local audio files or play demo tracks with time-stretching (50%–150%), pitch shifting, and A–B repeat looping.
            </p>

            <button
              onClick={() => setActiveView('audio-studio')}
              className="w-full py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-stone-200 dark:border-stone-700"
            >
              <Sliders className="w-4 h-4" />
              <span>Open Audio Lab & Playlists</span>
            </button>
          </div>

          {/* Quick Curriculum Grade Navigator */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-3">
            <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600" />
              Elementary Curriculum (K–6)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Jump straight to grade units and NYS Arts Learning Standards alignment.
            </p>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {['K', '1', '2', '3', '4', '5', '6'].map((grade) => (
                <button
                  key={grade}
                  onClick={() => setActiveView('planner')}
                  className="py-2.5 px-2 rounded-xl bg-stone-100 hover:bg-brand-50 dark:bg-stone-800 dark:hover:bg-brand-950/60 hover:text-brand-600 dark:hover:text-brand-400 text-stone-800 dark:text-stone-200 text-xs font-bold text-center transition-all border border-stone-200/50 dark:border-stone-700/50"
                >
                  Grade {grade}
                </button>
              ))}
              <button
                onClick={() => setActiveView('journal')}
                className="py-2.5 px-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-bold text-center transition-all border border-rose-200 dark:border-rose-800 flex items-center justify-center gap-1"
              >
                <BookMarked className="w-3.5 h-3.5" />
                <span>Journal</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
