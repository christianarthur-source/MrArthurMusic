import React from 'react';
import { GameMode, StudentProfile } from '../types/game';
import { Trophy, Music, Zap, Flame, Settings, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  student: StudentProfile | null;
  onOpenProfile: () => void;
  onOpenLeaderboard: () => void;
  onOpenSettings: () => void;
  streak: number;
  isSecretUnlocked?: boolean;
  onUnlockSecretLevel: () => void;
  onBackToHub?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  student,
  onOpenProfile,
  onOpenLeaderboard,
  onOpenSettings,
  streak,
  isSecretUnlocked,
  onUnlockSecretLevel,
  onBackToHub,
}) => {
  return (
    <header className="w-full bg-slate-900/95 backdrop-blur-lg border-b border-slate-800/80 sticky top-0 z-40 transition-colors shadow-2xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5 min-h-[76px] sm:min-h-[86px] flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: Wordmark Brand with RED & White DENTI */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700/80 cursor-pointer shadow-xs transition-all mr-1 sm:mr-2 shrink-0"
              title="Back to Mr. Arthur's Music Lab Hub"
            >
              <span>← Music Lab Hub</span>
            </button>
          )}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectMode('quiz')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectMode('quiz');
              }
            }}
            className="flex items-center gap-2 sm:gap-3 text-left focus:outline-none group cursor-pointer select-none"
            title="Denti Rhythm Rockstars Home"
          >
            {/* Rock Icon Badge */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-red-600 via-rose-500 to-amber-400 flex items-center justify-center text-slate-950 font-black text-xl sm:text-2xl shadow-lg shadow-red-600/30 border-2 border-white/80 group-hover:scale-105 group-hover:rotate-2 transition-all shrink-0">
              🎸
            </div>

            {/* Brand Title Area */}
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {/* RED & WHITE "DENTI" */}
                <span className="inline-flex items-center justify-center px-2 sm:px-2.5 py-0.5 bg-red-600 text-white font-black text-sm sm:text-lg lg:text-xl tracking-wider rounded-lg sm:rounded-xl shadow-md shadow-red-600/50 border-2 border-white ring-1 ring-red-500/50 uppercase select-none shrink-0">
                  DENTI
                </span>

                {/* Colorful Title Text */}
                <span className="font-display font-black text-sm sm:text-base lg:text-lg xl:text-xl tracking-tight leading-none inline-flex items-center shrink-0">
                  <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent drop-shadow-sm">
                    RHYTHM
                  </span>{' '}
                  <span className="bg-gradient-to-r from-rose-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm ml-1">
                    ROCKSTARS
                  </span>
                  <span className="inline-block text-amber-300 text-sm sm:text-lg ml-0.5 animate-pulse">
                    ⚡
                  </span>
                  {/* Secret Easter Egg Button (Invisible until hovered/clicked) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnlockSecretLevel();
                    }}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-transparent border-none outline-none opacity-0 hover:opacity-20 focus:opacity-20 cursor-pointer inline-flex items-center justify-center transition-all ml-0.5 select-none"
                    title={isSecretUnlocked ? "Level 7 Secret Unlocked!" : "??? Secret Rockstar Door"}
                    aria-label="Secret Level 7 Easter Egg"
                  >
                    <span className="text-[10px]">⚡</span>
                  </button>
                </span>
              </div>

              {/* Engaging Classroom Subtitle */}
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-xs font-semibold tracking-wide">
                <span className="text-red-400 font-extrabold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                  Denti Elementary Music
                </span>
                <span className="text-slate-600 hidden md:inline">·</span>
                <span className="text-amber-300 font-bold hidden md:inline truncate max-w-[200px] lg:max-w-[280px]">
                  Interactive Beat Decoding & Leaderboard
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Mode Tabs - Fits on desktop/laptop displays without overflowing */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 bg-slate-950/80 p-1.5 xl:p-2 rounded-2xl border border-slate-800/90 shadow-2xl shrink-0">
          <button
            onClick={() => onSelectMode('quiz')}
            className={`flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-black tracking-wide uppercase whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              currentMode === 'quiz'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-400/30 scale-105 ring-2 ring-amber-300'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <span className="text-sm xl:text-base">🎧</span>
            <span>BEAT DECODER</span>
          </button>

          <button
            onClick={() => onSelectMode('tap')}
            className={`flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-black tracking-wide uppercase whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              currentMode === 'tap'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-400/30 scale-105 ring-2 ring-amber-300'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <span className="text-sm xl:text-base">⚡</span>
            <span>RHYTHM TAPPER</span>
          </button>

          <button
            onClick={() => onSelectMode('builder')}
            className={`flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-black tracking-wide uppercase whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              currentMode === 'builder'
                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-400/30 scale-105 ring-2 ring-amber-300'
                : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <span className="text-sm xl:text-base">🥁</span>
            <span>BEAT BUILDER</span>
          </button>

          <button
            onClick={() => onSelectMode('rhythm_quiz')}
            className={`flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-black tracking-wide uppercase whitespace-nowrap transition-all cursor-pointer shrink-0 ${
              currentMode === 'rhythm_quiz'
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white shadow-md shadow-red-600/40 scale-105 border border-amber-300 ring-2 ring-red-500'
                : 'text-rose-300 hover:text-white hover:bg-rose-950/50'
            }`}
          >
            <span className="text-sm xl:text-base">🧩</span>
            <span>RHYTHM QUIZ</span>
          </button>

          <button
            onClick={onOpenLeaderboard}
            className="flex items-center gap-1.5 px-2.5 xl:px-3 py-1.5 xl:py-2 rounded-xl text-xs xl:text-sm font-extrabold text-amber-300 hover:text-white hover:bg-amber-500/20 whitespace-nowrap transition-all cursor-pointer shrink-0"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>RANKS</span>
          </button>
        </nav>

        {/* Zone 3: Live Streak, Sound Settings & Student Action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Active Streak Badge */}
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 bg-gradient-to-r from-rose-500/20 to-amber-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-[11px] sm:text-xs font-extrabold animate-pulse shadow-md">
              <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>{streak} 🔥</span>
            </div>
          )}

          {/* Settings Trigger */}
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-950/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer shrink-0"
            title="Sound, Instruments & Counting Settings"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300" />
          </button>

          {/* Quick Leaderboard button on tablets/mobile */}
          <button
            onClick={onOpenLeaderboard}
            className="lg:hidden p-2 rounded-xl text-amber-400 bg-slate-950/60 hover:bg-amber-500/20 border border-slate-800 transition-colors cursor-pointer shrink-0"
            title="Classroom Leaderboard"
            aria-label="Classroom Leaderboard"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Student Profile Action */}
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-red-600/30 via-rose-500/30 to-amber-500/30 hover:from-red-600/40 hover:to-amber-500/40 border border-rose-500/40 rounded-xl text-xs sm:text-sm font-extrabold text-white transition-all shadow-md cursor-pointer hover:scale-102 shrink-0"
          >
            <span className="text-base leading-none">{student?.avatar || '🎸'}</span>
            <span className="max-w-[70px] sm:max-w-[110px] truncate">
              {student ? student.name : 'Sign In'}
            </span>
            {student && (
              <span className="text-amber-400 font-mono font-black ml-0.5 tabular-nums text-xs">
                {student.totalScore}p
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Sub-Navigation Bar */}
      <div className="lg:hidden flex items-center justify-around px-2 py-2.5 bg-slate-950/95 border-t border-slate-800 text-xs sm:text-sm font-black uppercase tracking-wider overflow-x-auto">
        <button
          onClick={() => onSelectMode('quiz')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            currentMode === 'quiz' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'text-slate-300 hover:text-white'
          }`}
        >
          🎧 DECODER
        </button>
        <button
          onClick={() => onSelectMode('tap')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            currentMode === 'tap' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'text-slate-300 hover:text-white'
          }`}
        >
          ⚡ TAPPER
        </button>
        <button
          onClick={() => onSelectMode('builder')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            currentMode === 'builder' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'text-slate-300 hover:text-white'
          }`}
        >
          🥁 BUILDER
        </button>
        <button
          onClick={() => onSelectMode('rhythm_quiz')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            currentMode === 'rhythm_quiz' ? 'bg-red-600 text-white font-black shadow-md border border-amber-300' : 'text-rose-400 hover:text-white'
          }`}
        >
          🧩 QUIZ
        </button>
        <button
          onClick={onOpenLeaderboard}
          className="px-3 py-1.5 rounded-xl text-amber-300 hover:text-amber-200"
        >
          🏆 RANKS
        </button>
      </div>
    </header>
  );
};
