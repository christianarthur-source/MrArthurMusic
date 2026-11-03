import React from 'react';
import { useApp } from '../../context/AppContext';
import { useClassroomTimer } from '../../context/TimerContext';
import { Logo } from './Logo';
import {
  Presentation,
  Search,
  Moon,
  Sun,
  Timer,
  Settings,
  Sparkles,
  Music
} from 'lucide-react';

export const Header: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    openTeachMode,
    setIsCommandPaletteOpen,
    setActiveView,
    activeView
  } = useApp();

  const { isRunning, timeLeft, setIsFloatingVisible, isFloatingVisible } = useClassroomTimer();

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timerBadge = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const toggleDarkMode = () => {
    updatePreferences({ darkMode: !preferences.darkMode });
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md border-b border-stone-200/80 dark:border-stone-800 transition-colors">
      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <Logo
            compact
            appName={preferences.appName}
            teacherName={preferences.teacherName || 'Music Teacher'}
          />
        </div>

        {/* Desktop School & Room info with fun music badge */}
        <div className="hidden lg:flex items-center gap-2.5">
          {preferences.schoolName && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {preferences.schoolName}
            </span>
          )}
          {preferences.schoolName && preferences.roomNumber && (
            <span className="text-xs text-stone-300 dark:text-stone-600">•</span>
          )}
          {preferences.roomNumber && (
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              {preferences.roomNumber}
            </span>
          )}
        </div>
      </div>

      {/* Center Search Pill */}
      <button
        onClick={() => setIsCommandPaletteOpen(true)}
        className="hidden md:flex items-center justify-between w-72 lg:w-96 px-3.5 py-1.5 text-xs text-stone-400 bg-stone-100 hover:bg-stone-200/80 dark:bg-stone-800/80 dark:hover:bg-stone-800 text-left rounded-xl transition-all border border-stone-200/40 dark:border-stone-700/50"
      >
        <span className="flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-stone-400" />
          <span className="text-stone-500 dark:text-stone-400">Search lessons, tasks, chorus...</span>
        </span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded text-stone-500 shadow-subtle">
          ⌘K
        </kbd>
      </button>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Floating Timer Toggle */}
        <button
          onClick={() => {
            if (activeView === 'timer') {
              setIsFloatingVisible(!isFloatingVisible);
            } else {
              setIsFloatingVisible(!isFloatingVisible);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isRunning
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-mono'
              : 'hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
          }`}
          title="Classroom Timer Widget"
        >
          <Timer className={`w-4 h-4 ${isRunning ? 'text-amber-600 animate-spin' : ''}`} />
          <span className="hidden sm:inline font-mono">{isRunning ? timerBadge : 'Timer'}</span>
        </button>

        {/* Mobile Search Button */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="md:hidden p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
          title="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Dark Mode */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={preferences.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {preferences.darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button
          onClick={() => setActiveView('settings')}
          className={`p-2 rounded-xl transition-colors ${
            activeView === 'settings'
              ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-white'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Settings & Data Management"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Dedicated Teach Mode Button (Prominent & High Contrast for Projectors/Cart) */}
        <button
          onClick={() => openTeachMode()}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow-elevated transition-all active:scale-95"
          title="Launch Full-Screen Teach Mode for Projector/Smart Board"
        >
          <Presentation className="w-4 h-4" />
          <span className="hidden sm:inline">Teach Mode</span>
        </button>
      </div>
    </header>
  );
};
