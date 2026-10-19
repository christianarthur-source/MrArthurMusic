import React from 'react';
import { GameMode } from '../types/game';
import { Trophy, Music, Zap, Flame, Settings, UserCheck, ArrowLeft } from 'lucide-react';
import { StudentSession } from '../../utils/classroomApi';
import { soundEngine } from '../../audio/soundEngine';

interface NavbarProps {
  currentMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  studentSession: StudentSession | null;
  onOpenClassroomModal: () => void;
  onOpenAvatar: () => void;
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
  studentSession,
  onOpenClassroomModal,
  onOpenAvatar,
  onOpenLeaderboard,
  onOpenSettings,
  streak,
  isSecretUnlocked,
  onUnlockSecretLevel,
  onBackToHub,
}) => {
  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white shadow-xl sticky top-0 z-40 select-none">
      {/* Left: Hub back button & Mr. Arthur branding */}
      <div className="flex items-center gap-3">
        {onBackToHub && (
          <button
            type="button"
            onClick={onBackToHub}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700/80 cursor-pointer shadow-xs transition-all active:scale-95 shrink-0"
            title="Back to Mr. Arthur's Music Lab Hub"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Music Lab</span>
          </button>
        )}

        <div className="flex items-center gap-2.5 pr-2 sm:pr-4 border-r border-slate-700/80">
          <button
            type="button"
            onClick={() => {
              soundEngine.playWelcomeChime();
              onOpenAvatar();
            }}
            title="Click to view Mr. Arthur (Secret Admin Portal available here!)"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-amber-300/50 hover:ring-amber-300 hover:scale-105 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
          >
            <img
              src="/mr-arthur-avatar.jpg"
              alt="Mr. Arthur"
              className="w-full h-full object-cover object-top"
            />
          </button>

          <div className="flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
              Mr. Arthur&apos;s
            </span>
            <span className="text-lg sm:text-2xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
              Rhythm Rock Stars
            </span>
          </div>

          {/* Secret Easter Egg Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUnlockSecretLevel();
            }}
            className="w-4 h-4 rounded-full opacity-0 hover:opacity-20 cursor-pointer inline-flex items-center justify-center transition-all ml-0.5"
            title={isSecretUnlocked ? 'Level 7 Secret Unlocked!' : '??? Secret Rockstar Door'}
          >
            <span className="text-[10px]">⚡</span>
          </button>
        </div>
      </div>

      {/* Middle: Clean Navigation Mode Tabs */}
      <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/70 p-1 sm:p-1.5 rounded-2xl border border-slate-800 shadow-inner overflow-x-auto max-w-full">
        <button
          onClick={() => onSelectMode('quiz')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer font-['Fredoka',sans-serif] shrink-0 ${
            currentMode === 'quiz'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <span>🎧</span>
          <span className="hidden md:inline">Beat</span> Decoder
        </button>

        <button
          onClick={() => onSelectMode('tap')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer font-['Fredoka',sans-serif] shrink-0 ${
            currentMode === 'tap'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <span>⚡</span>
          <span className="hidden md:inline">Rhythm</span> Tapper
        </button>

        <button
          onClick={() => onSelectMode('builder')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer font-['Fredoka',sans-serif] shrink-0 ${
            currentMode === 'builder'
              ? 'bg-amber-400 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <span>🥁</span>
          <span className="hidden md:inline">Beat</span> Builder
        </button>

        <button
          onClick={() => onSelectMode('rhythm_quiz')}
          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all cursor-pointer font-['Fredoka',sans-serif] shrink-0 ${
            currentMode === 'rhythm_quiz'
              ? 'bg-rose-500 text-white shadow-md font-black'
              : 'text-rose-300 hover:text-white hover:bg-rose-950/40'
          }`}
        >
          <span>🧩</span>
          <span className="hidden md:inline">Rhythm</span> Quiz
        </button>

        <button
          onClick={onOpenLeaderboard}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-300 hover:text-white hover:bg-amber-500/20 transition-all cursor-pointer font-['Fredoka',sans-serif] shrink-0"
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Ranks</span>
        </button>
      </nav>

      {/* Right: Streak, Settings & Unified Global Student Sign In */}
      <div className="flex items-center gap-2 shrink-0">
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-extrabold animate-pulse">
            <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
            <span>{streak} 🔥</span>
          </div>
        )}

        <button
          onClick={onOpenSettings}
          className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 transition-colors cursor-pointer"
          title="Sound &amp; Counting Settings"
        >
          <Settings className="w-4 h-4 text-amber-300" />
        </button>

        {/* Global Student Sign In button - Exact Staff Composer integration */}
        <button
          type="button"
          onClick={onOpenClassroomModal}
          title={
            studentSession
              ? `Signed in as ${studentSession.firstName} — click to view saved progress or log out`
              : 'Student Sign In'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
            studentSession
              ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
              : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>{studentSession ? studentSession.firstName : 'Sign In'}</span>
        </button>
      </div>
    </header>
  );
};
