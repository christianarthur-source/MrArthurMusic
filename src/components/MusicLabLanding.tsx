import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  Drum,
  Music,
  Flame,
  Volume2,
} from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';
import { ClassroomToolBoxModal, ToolId } from './tools/ClassroomToolBoxModal';

export type MusicLabAppId = 'hub' | 'staff-composer' | 'rhythm-rockstars' | 'beat-machine' | 'daw' | 'staff-wars' | 'big-staff';

interface MusicLabLandingProps {
  onSelectApp: (appId: MusicLabAppId) => void;
  studentSession: StudentSession | null;
  onOpenClassroom: () => void;
  onOpenEdLaw: () => void;
  onOpenAvatar: () => void;
}

export const MusicLabLanding: React.FC<MusicLabLandingProps> = ({
  onSelectApp,
  studentSession,
  onOpenClassroom,
  onOpenEdLaw,
  onOpenAvatar,
}) => {
  const [selectedToolModal, setSelectedToolModal] = useState<ToolId | null>(null);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Bar - Clean & Kid-Friendly */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 text-white shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Mr. Arthur Avatar & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAvatar}
              className="w-12 h-12 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-amber-300/60 hover:ring-amber-300 hover:scale-105 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
              title="Click to view Mr. Arthur"
            >
              <img
                src="/mr-arthur-avatar.jpg"
                alt="Mr. Arthur"
                className="w-full h-full object-cover object-top"
              />
            </button>
            <div className="flex flex-col justify-center select-none">
              <span className="text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
                Mr. Arthur&apos;s
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
                Music Lab
              </span>
            </div>
          </div>

          {/* Right Header: Student Sign In & Help */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenClassroom}
              title={
                studentSession
                  ? `Signed in as ${studentSession.firstName} — click to view saved songs or log out`
                  : 'Student Sign In'
              }
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-black border transition-all cursor-pointer shadow-md font-['Fredoka',sans-serif] ${
                studentSession
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
                  : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
              }`}
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>{studentSession ? studentSession.firstName : 'Student Sign In'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {studentSession && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome, {studentSession.firstName}! Your work saves automatically.</span>
            </div>
          </div>
        )}

        {/* =========================================================================
            FLAGSHIP APP #1: STAFF COMPOSER (Hero Graphic Showcase)
            ========================================================================= */}
        <section
          onClick={() => onSelectApp('staff-composer')}
          className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0E1A33] to-[#080E1C] border-3 border-sky-400/60 hover:border-sky-300 p-6 sm:p-8 shadow-2xl transition-all duration-300 group overflow-hidden cursor-pointer hover:shadow-sky-500/20"
        >
          {/* Decorative Staff Lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none flex flex-col justify-around py-8">
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-2xl text-center lg:text-left w-full">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="px-3.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider font-['Fredoka',sans-serif] shadow-md flex items-center gap-1.5">
                  ⭐ Star App
                </span>
                <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold font-['Fredoka',sans-serif]">
                  🎼 Sheet Music Maker
                </span>
              </div>

              <div>
                <h3 className="text-3xl sm:text-5xl font-black text-white font-['Fredoka',sans-serif] tracking-wide">
                  <span className="bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                    Staff Composer
                  </span>
                </h3>
                <p className="text-sm sm:text-base text-sky-200 font-bold mt-1">
                  Compose songs on the musical staff and hear them play! 🎼
                </p>
              </div>

              {/* Simple Music Staff with Notes Graphic */}
              <div className="w-full max-w-xl p-3 sm:p-4 rounded-2xl bg-slate-950/90 border-2 border-sky-500/30 group-hover:border-sky-400 transition-colors shadow-inner overflow-hidden">
                <svg
                  viewBox="0 0 520 120"
                  className="w-full h-auto text-slate-100"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {/* 5 Horizontal Staff Lines */}
                  <line x1="8" y1="26" x2="512" y2="26" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="44" x2="512" y2="44" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="62" x2="512" y2="62" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="80" x2="512" y2="80" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="98" x2="512" y2="98" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />

                  {/* Treble Clef */}
                  <text
                    x="16"
                    y="93"
                    fontSize="82"
                    fontFamily="serif, 'Noto Music', 'Bravura'"
                    fill="#f8fafc"
                    className="select-none pointer-events-none"
                  >
                    𝄞
                  </text>

                  {/* Time Signature 3/4 */}
                  <text
                    x="84"
                    y="58"
                    fontSize="32"
                    fontWeight="800"
                    fontFamily="serif"
                    textAnchor="middle"
                    fill="#f8fafc"
                    className="select-none"
                  >
                    3
                  </text>
                  <text
                    x="84"
                    y="94"
                    fontSize="32"
                    fontWeight="800"
                    fontFamily="serif"
                    textAnchor="middle"
                    fill="#f8fafc"
                    className="select-none"
                  >
                    4
                  </text>

                  {/* Measure 1 - Note 1: E4 (Quarter Note) */}
                  <ellipse cx="138" cy="98" rx="8.5" ry="6" transform="rotate(-20 138 98)" fill="#f8fafc" />
                  <line x1="146" y1="98" x2="146" y2="44" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 1 - Note 2: G4 (Quarter Note) */}
                  <ellipse cx="192" cy="80" rx="8.5" ry="6" transform="rotate(-20 192 80)" fill="#f8fafc" />
                  <line x1="200" y1="80" x2="200" y2="26" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 1 - Notes 3 & 4: Beamed 8th Notes (B4 & C5) */}
                  <ellipse cx="244" cy="62" rx="8.5" ry="6" transform="rotate(-20 244 62)" fill="#f8fafc" />
                  <line x1="236" y1="62" x2="236" y2="114" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  <ellipse cx="284" cy="53" rx="8.5" ry="6" transform="rotate(-20 284 53)" fill="#f8fafc" />
                  <line x1="276" y1="53" x2="276" y2="105" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Beam connecting stems */}
                  <polygon points="235,108 277,99 277,105 235,114" fill="#f8fafc" />

                  {/* Measure Barline */}
                  <line x1="330" y1="26" x2="330" y2="98" stroke="#94a3b8" strokeWidth="1.5" opacity="0.6" />

                  {/* Measure 2 - Note 5: D5 (Quarter Note) */}
                  <ellipse cx="372" cy="44" rx="8.5" ry="6" transform="rotate(-20 372 44)" fill="#f8fafc" />
                  <line x1="364" y1="44" x2="364" y2="98" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 2 - Note 6: E5 (Half Note) */}
                  <ellipse cx="430" cy="35" rx="8.5" ry="6" transform="rotate(-20 430 35)" fill="none" stroke="#f8fafc" strokeWidth="2.5" />
                  <line x1="422" y1="35" x2="422" y2="89" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Double End Barline */}
                  <line x1="488" y1="26" x2="488" y2="98" stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />
                  <line x1="496" y1="26" x2="496" y2="98" stroke="#f8fafc" strokeWidth="4" />
                </svg>
              </div>
            </div>

            {/* Giant Action Button */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col items-center gap-2.5">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-5 rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 group-hover:from-sky-300 group-hover:to-indigo-400 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl shadow-sky-500/40 group-hover:scale-105 active:scale-95 transition-all cursor-pointer font-['Fredoka',sans-serif] border-2 border-white/20"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Open Staff Composer</span>
                <ArrowRight className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectApp('big-staff');
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer font-['Fredoka',sans-serif] border border-amber-300"
                title="Launch Staff Composer directly into Big Staff 1-bar view with Easy Mode for K-1st grade"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Big Staff (K-1st Easy Mode)</span>
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FLAGSHIP APPS #2 & #3: RHYTHM ROCK STARS, BEAT MACHINE & STUDIO DAW
            ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] flex items-center gap-2">
              <span>Interactive Music Apps</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Play &amp; Create
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. STAFF WARS */}
            <div
              onClick={() => onSelectApp('staff-wars')}
              className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#1A1805] to-slate-950 border-2 border-amber-400/50 hover:border-amber-300 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/25 group overflow-hidden cursor-pointer"
            >
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-xl group-hover:scale-110 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🚀
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/40 font-['Fredoka',sans-serif]">
                    ⚡ Space Arcade
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Staff Wars
                  </h4>
                  <p className="text-xs font-bold text-amber-300 mt-1">
                    Blast enemy notes with spaceship lasers before they hit your clef! ⚡
                  </p>
                </div>

                {/* Big Visual Game Graphic: Space Highway with Clef Shield & Laser */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-400/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black font-['Fredoka',sans-serif] px-1 text-amber-300">
                    <span>SECTOR: TREBLE DEFENSE</span>
                    <span className="text-emerald-400 flex items-center gap-1 font-mono">
                      🚀 3 LIVES
                    </span>
                  </div>
                  <div className="relative h-12 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between px-3 overflow-hidden">
                    <div className="absolute inset-x-0 top-2 h-px bg-sky-400/40" />
                    <div className="absolute inset-x-0 top-4 h-px bg-sky-400/40" />
                    <div className="absolute inset-x-0 top-6 h-px bg-sky-400/40" />
                    <div className="absolute inset-x-0 top-8 h-px bg-sky-400/40" />
                    <div className="absolute inset-x-0 top-10 h-px bg-sky-400/40" />

                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-lg z-10 shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                      𝄞
                    </div>

                    <div className="flex-1 h-1 bg-gradient-to-r from-emerald-400 via-yellow-300 to-rose-500 mx-2 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />

                    <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg shadow-amber-400/50 z-10 animate-bounce">
                      ♩
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 group-hover:from-amber-300 group-hover:to-yellow-300 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/30 transition-all font-['Fredoka',sans-serif]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play Staff Wars</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. RHYTHM ROCK STARS */}
            <div
              onClick={() => onSelectApp('rhythm-rockstars')}
              className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#1F0E1E] to-slate-950 border-2 border-rose-500/40 hover:border-rose-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-rose-500/20 group overflow-hidden cursor-pointer"
            >
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 p-0.5 shadow-xl group-hover:scale-110 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🎸
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/40 font-['Fredoka',sans-serif]">
                    ⚡ Rhythm Game
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-rose-300 transition-colors">
                    Rhythm Rock Stars
                  </h4>
                  <p className="text-xs font-bold text-rose-300 mt-1">
                    Tap along to drum beats, decode rock rhythms &amp; beat 6 stages! 🎸
                  </p>
                </div>

                {/* Big Visual Game Graphic: Guitar Neck with Rhythm Gems */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-rose-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black font-['Fredoka',sans-serif] px-1 text-rose-300">
                    <span>STAGE 1: GARAGE ROCK</span>
                    <span className="text-amber-400 flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-current" /> 10x STREAK
                    </span>
                  </div>
                  {/* Guitar Strings & Floating Gems */}
                  <div className="relative h-12 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-around px-3 overflow-hidden">
                    <div className="absolute inset-x-0 top-3 h-0.5 bg-slate-700" />
                    <div className="absolute inset-x-0 top-6 h-0.5 bg-slate-700" />
                    <div className="absolute inset-x-0 top-9 h-0.5 bg-slate-700" />
                    <div className="w-7 h-7 rounded-full bg-rose-500 text-white font-black text-xs flex items-center justify-center shadow-lg shadow-rose-500/50 z-10 animate-bounce">
                      ♩
                    </div>
                    <div className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg shadow-amber-400/50 z-10">
                      ♫
                    </div>
                    <div className="w-7 h-7 rounded-full bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg shadow-emerald-400/50 z-10">
                      ♩
                    </div>
                    <div className="w-7 h-7 rounded-full bg-sky-400 text-slate-950 font-black text-xs flex items-center justify-center shadow-lg shadow-sky-400/50 z-10 animate-pulse">
                      ⚡
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 group-hover:from-rose-400 group-hover:to-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-rose-500/30 transition-all font-['Fredoka',sans-serif]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play Rhythm Rock Stars</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. BEAT MACHINE */}
            <div
              onClick={() => onSelectApp('beat-machine')}
              className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#1F180E] to-slate-950 border-2 border-amber-500/40 hover:border-amber-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 group overflow-hidden cursor-pointer"
            >
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-xl group-hover:scale-110 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🥁
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 font-['Fredoka',sans-serif]">
                    🎛️ Drum Maker
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Beat Machine
                  </h4>
                  <p className="text-xs font-bold text-amber-300 mt-1">
                    Tap the glowing pads to build awesome custom drum grooves! 🥁
                  </p>
                </div>

                {/* Big Visual 16-Pad Sequencer Simulation */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { icon: '💥', active: true, color: 'bg-amber-400 text-slate-950' },
                      { icon: '🥁', active: false, color: 'bg-slate-800 text-slate-400' },
                      { icon: '👏', active: true, color: 'bg-rose-400 text-slate-950' },
                      { icon: '🔔', active: true, color: 'bg-sky-400 text-slate-950' },
                      { icon: '🥁', active: false, color: 'bg-slate-800 text-slate-400' },
                      { icon: '💥', active: true, color: 'bg-amber-400 text-slate-950' },
                      { icon: '🔔', active: false, color: 'bg-slate-800 text-slate-400' },
                      { icon: '👏', active: true, color: 'bg-rose-400 text-slate-950' },
                    ].map((pad, idx) => (
                      <div
                        key={idx}
                        className={`h-9 rounded-xl flex items-center justify-center text-sm font-bold shadow-md transition-all ${
                          pad.active ? `${pad.color} scale-105 shadow-amber-400/30` : 'bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        {pad.icon}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 group-hover:from-amber-300 group-hover:to-yellow-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-400/30 transition-all font-['Fredoka',sans-serif]"
                >
                  <Drum className="w-5 h-5" />
                  <span>Launch Beat Machine</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 3. STUDIO DAW */}
            <div
              onClick={() => onSelectApp('daw')}
              className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#150F2B] to-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20 group overflow-hidden cursor-pointer"
            >
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-xl group-hover:scale-110 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🎛️
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 font-['Fredoka',sans-serif]">
                    🎧 Studio Recording
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-indigo-300 transition-colors">
                    Studio DAW
                  </h4>
                  <p className="text-xs font-bold text-indigo-300 mt-1">
                    Mix loops, record microphone vocals &amp; make full songs! 🎧
                  </p>
                </div>

                {/* Big Visual Multitrack Timeline Simulation */}
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-2">
                  <div className="h-4 rounded-lg bg-amber-500/90 w-4/5 flex items-center px-2 text-[10px] text-slate-950 font-black shadow-sm">
                    🥁 Hip-Hop Drums (120 BPM)
                  </div>
                  <div className="h-4 rounded-lg bg-pink-500/90 w-3/5 ml-4 flex items-center px-2 text-[10px] text-white font-black shadow-sm">
                    🎸 808 Sub Bass
                  </div>
                  <div className="h-4 rounded-lg bg-sky-400/90 w-5/6 flex items-center px-2 text-[10px] text-slate-950 font-black shadow-sm">
                    🎹 Warm Rhodes Chords
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 group-hover:from-indigo-400 group-hover:to-pink-400 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/30 transition-all font-['Fredoka',sans-serif]"
                >
                  <Music className="w-5 h-5" />
                  <span>Launch Studio DAW</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            CONSOLIDATED SECTION: 🎒 MUSIC CLASS TOOL BOX (Mini-Tools)
            ========================================================================= */}
        <section className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] flex items-center gap-2">
                <span>🎒 Music Class Tool Box</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                  Quick Utilities
                </span>
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">1-Click Launch • Smartboard Ready</span>
          </div>

          {/* 8 Large Visual Graphic Cards for Tool Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tool 1: Interactive Metronome (Active) */}
            <div
              onClick={() => setSelectedToolModal('metronome')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  ⏱️
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Metronome
                  </h4>
                  <p className="text-xs text-amber-300 font-bold mt-0.5">
                    Visual screen flash, woodblock clicks &amp; animal speeds! ⚡
                  </p>
                </div>
                <div className="flex items-center justify-between text-2xl pt-1 px-1">
                  <span>🐢</span>
                  <span>🐧</span>
                  <span>🦘</span>
                  <span>🐎</span>
                  <span>🐆</span>
                  <span>🚀</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-amber-400 group-hover:text-slate-950 text-amber-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Open Metronome</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 2: Do-Re-Mi Chimes (Active) */}
            <div
              onClick={() => setSelectedToolModal('solfege-trainer')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-rose-500/30 hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🔔
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-rose-300 transition-colors">
                    Do-Re-Mi Trainer
                  </h4>
                  <p className="text-xs text-rose-300 font-bold mt-0.5">
                    Play rainbow bells &amp; practice Curwen signs! 🌈
                  </p>
                </div>
                <div className="flex items-center gap-1.5 justify-center pt-2">
                  {['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#A855F7'].map((c, i) => (
                    <div key={i} style={{ backgroundColor: c }} className="w-4 h-8 rounded-md shadow-sm" />
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-rose-500 group-hover:text-white text-rose-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Play Chimes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 3: Instrument Zoo (Active) */}
            <div
              onClick={() => setSelectedToolModal('instrument-zoo')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🎻
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-cyan-300 transition-colors">
                    Instrument Zoo
                  </h4>
                  <p className="text-xs text-cyan-300 font-bold mt-0.5">
                    Tap to hear real orchestra instrument sounds! 🪈
                  </p>
                </div>
                <div className="flex items-center justify-around text-2xl pt-1">
                  <span>🎻</span>
                  <span>🪈</span>
                  <span>🎺</span>
                  <span>🥁</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Explore Zoo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 4: Dynamic Ears (Active) */}
            <div
              onClick={() => setSelectedToolModal('dynamic-ears')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  👂
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-emerald-300 transition-colors">
                    Dynamic Ears
                  </h4>
                  <p className="text-xs text-emerald-300 font-bold mt-0.5">
                    Classroom quiet meter &amp; sound challenges! 🤫
                  </p>
                </div>
                <div className="flex items-center justify-between font-serif italic font-black text-xs text-emerald-300 pt-2 px-1">
                  <span>pp</span>
                  <span>•</span>
                  <span>p</span>
                  <span>•</span>
                  <span>mf</span>
                  <span>•</span>
                  <span>f</span>
                  <span>•</span>
                  <span>ff</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-emerald-400 group-hover:text-slate-950 text-emerald-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Open Meter</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 5: Tempo Tapper (Active) */}
            <div
              onClick={() => setSelectedToolModal('tempo-tapper')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-orange-500/30 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  👆
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-orange-300 transition-colors">
                    Tempo Tapper
                  </h4>
                  <p className="text-xs text-orange-300 font-bold mt-0.5">
                    Tap the beat with your fingers to find any song&apos;s speed! ⏱️
                  </p>
                </div>
                <div className="flex items-center justify-around text-2xl pt-1">
                  <span>👆</span>
                  <span>✨</span>
                  <span>🥁</span>
                  <span>🎯</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-orange-400 group-hover:text-slate-950 text-orange-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Open Tapper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 6: Song Starter (Coming Soon - No link) */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-amber-950/20 border border-slate-800 select-none flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-3.5 right-3.5">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black text-[10px] uppercase font-['Fredoka',sans-serif] tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Coming Soon!</span>
                </span>
              </div>
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-4xl shadow-inner opacity-80">
                  🎶
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-200 font-['Fredoka',sans-serif]">
                    Song Starter
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Grades K-3rd song builder with moods, chords &amp; melodies!
                  </p>
                </div>
                <div className="flex items-center justify-between text-2xl pt-1 px-1 opacity-50">
                  <span>☀️</span>
                  <span>🌙</span>
                  <span>🎃</span>
                  <span>⚡</span>
                  <span>🏝️</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/60">
                <div className="w-full py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 font-black text-xs flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400/70" />
                  <span>Coming Soon!</span>
                </div>
              </div>
            </div>

            {/* Tool 7: Music Symbol Match (Coming Soon - No link) */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-purple-950/20 border border-slate-800 select-none flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-3.5 right-3.5">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-black text-[10px] uppercase font-['Fredoka',sans-serif] tracking-wider flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Coming Soon!</span>
                </span>
              </div>
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-4xl shadow-inner opacity-80">
                  🃏
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-200 font-['Fredoka',sans-serif]">
                    Music Symbol Match
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Match musical symbols, names, and sounds in memory &amp; speed modes!
                  </p>
                </div>
                <div className="flex items-center justify-around font-serif text-2xl text-purple-300/50 pt-1 px-1">
                  <span>♩</span>
                  <span>𝄽</span>
                  <span>𝄢</span>
                  <span>𝄞</span>
                  <span>𝄐</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/60">
                <div className="w-full py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 font-black text-xs flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400/70" />
                  <span>Coming Soon!</span>
                </div>
              </div>
            </div>

            {/* Tool 8: Instrument Tuner (Active) */}
            <div
              onClick={() => setSelectedToolModal('tuner')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-teal-500/30 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🎸
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-teal-300 transition-colors">
                    Instrument Tuner
                  </h4>
                  <p className="text-xs text-teal-300 font-bold mt-0.5">
                    Tune guitar, violin, bass &amp; more with your mic! 🎛️
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-teal-300/80 pt-1 px-1 bg-slate-950/40 p-1.5 rounded-xl border border-teal-500/20">
                  <span>🎸 Guitar</span>
                  <span>•</span>
                  <span>🎻 Violin</span>
                  <span>•</span>
                  <span>🪕 Uke</span>
                  <span>•</span>
                  <span>🎙️ Mic</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-teal-400 group-hover:text-slate-950 text-teal-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif] cursor-pointer"
                >
                  <span>Open Tuner</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Visible Footer with NY Ed Law § 2-d & Parents' Bill of Rights */}
        <footer className="w-full pt-6 pb-10 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Mr. Arthur&apos;s Music Lab</span>
            <span className="opacity-40">•</span>
            <span>Elementary &amp; Middle School Music</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenEdLaw}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 font-semibold transition-all cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>NY Ed Law § 2-d &amp; Parents&apos; Bill of Rights</span>
            </button>
          </div>
        </footer>
      </main>

      {/* Classroom Tool Box Modal */}
      <ClassroomToolBoxModal
        isOpen={selectedToolModal !== null}
        onClose={() => setSelectedToolModal(null)}
        initialTool={selectedToolModal || 'tempo-tapper'}
      />
    </div>
  );
};
