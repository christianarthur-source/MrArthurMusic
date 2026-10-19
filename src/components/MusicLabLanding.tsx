import React, { useState } from 'react';
import {
  Sparkles,
  Play,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  HelpCircle,
  Drum,
  Music,
  Flame,
  Volume2,
} from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';
import { ClassroomToolBoxModal, ToolId } from './tools/ClassroomToolBoxModal';

export type MusicLabAppId = 'hub' | 'staff-composer' | 'rhythm-rockstars' | 'beat-machine' | 'daw';

interface MusicLabLandingProps {
  onSelectApp: (appId: MusicLabAppId) => void;
  studentSession: StudentSession | null;
  onOpenClassroom: () => void;
  onOpenEdLaw: () => void;
  onOpenHelp: () => void;
  onOpenAvatar: () => void;
}

export const MusicLabLanding: React.FC<MusicLabLandingProps> = ({
  onSelectApp,
  studentSession,
  onOpenClassroom,
  onOpenEdLaw,
  onOpenHelp,
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

            <button
              type="button"
              onClick={onOpenHelp}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700/80 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Welcome Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider font-['Fredoka',sans-serif]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>Classroom Music Activity Hub</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight font-['Fredoka',sans-serif]">
            Pick Your Musical Activity! 🎵
          </h2>

          {studentSession && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome, {studentSession.firstName}! Your work saves automatically.</span>
            </div>
          )}
        </div>

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
            {/* Visual Preview: Giant Graphic Sheet Music Staff with Boomwhacker Notes */}
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
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
                  Click colorful notes on the musical staff, compose songs &amp; hear them play! 🎼
                </p>
              </div>

              {/* Big Interactive-Style Visual Staff Graphic */}
              <div className="p-4 rounded-2xl bg-slate-950/90 border-2 border-sky-500/30 flex items-center justify-center lg:justify-start gap-2 sm:gap-3 flex-wrap shadow-inner group-hover:border-sky-400 transition-colors">
                <span className="text-4xl select-none font-serif text-amber-300 font-bold">𝄞</span>
                {[
                  { name: 'C', color: '#EF4444' },
                  { name: 'D', color: '#F97316' },
                  { name: 'E', color: '#EAB308' },
                  { name: 'F', color: '#22C55E' },
                  { name: 'G', color: '#06B6D4' },
                  { name: 'A', color: '#3B82F6' },
                  { name: 'B', color: '#A855F7' },
                  { name: "C'", color: '#EF4444' },
                ].map((n, i) => (
                  <div
                    key={i}
                    style={{ backgroundColor: n.color }}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full text-slate-950 font-black text-sm sm:text-base flex items-center justify-center shadow-lg font-['Fredoka',sans-serif] group-hover:scale-115 transition-transform"
                  >
                    {n.name}
                  </div>
                ))}
                <span className="text-2xl sm:text-3xl ml-1">🎹 🥁 🎻</span>
              </div>

              {/* Fun Visual Pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                {[
                  '🌈 Boomwhacker Colors',
                  '🎹 Piano Keys',
                  '🥁 Real Drum Beats',
                  '👥 Ensemble Templates',
                ].map((badge) => (
                  <span
                    key={badge}
                    className="px-3 py-1 rounded-xl bg-slate-800/90 text-slate-200 text-xs font-bold border border-slate-700/80 shadow-xs"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            {/* Giant Action Button */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col items-center gap-2">
              <button
                type="button"
                className="w-full sm:w-auto px-8 py-5 rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 group-hover:from-sky-300 group-hover:to-indigo-400 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl shadow-sky-500/40 group-hover:scale-105 active:scale-95 transition-all cursor-pointer font-['Fredoka',sans-serif] border-2 border-white/20"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Open Staff Composer</span>
                <ArrowRight className="w-6 h-6" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. RHYTHM ROCK STARS */}
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
            {/* Tool 1: Staff Wars Reprise! */}
            <div
              onClick={() => setSelectedToolModal('staff-wars')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  ⚔️
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-cyan-300 transition-colors">
                    Staff Wars Reprise!
                  </h4>
                  <p className="text-xs text-cyan-300 font-bold mt-0.5">
                    Arcade note reading! Blast notes before they hit your barrier! 🛸
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs font-mono font-bold text-cyan-300 pt-1 px-1 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800">
                  <span>𝄞 Treble</span>
                  <span>•</span>
                  <span>𝄢 Bass</span>
                  <span>•</span>
                  <span>⚡ 3 Lives</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Play Staff Wars</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 2: Sound Painter */}
            <div
              onClick={() => setSelectedToolModal('sound-painter')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/40 border border-rose-500/30 hover:border-rose-400 hover:shadow-xl hover:shadow-rose-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🎨
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-rose-300 transition-colors">
                    Sound Painter
                  </h4>
                  <p className="text-xs text-rose-300 font-bold mt-0.5">
                    Kandinsky-style art! Draw singing faces, lines &amp; shapes! 🖌️
                  </p>
                </div>
                <div className="flex items-center justify-between text-2xl pt-1 px-1">
                  <span>⭕</span>
                  <span>〰️</span>
                  <span>🔺</span>
                  <span>✨</span>
                  <span>🌈</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-rose-400 group-hover:text-slate-950 text-rose-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Start Painting</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 3: Song Starter */}
            <div
              onClick={() => setSelectedToolModal('song-starter')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🎶
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Song Starter
                  </h4>
                  <p className="text-xs text-amber-300 font-bold mt-0.5">
                    Grades K-3rd song maker! Pick moods, chords &amp; melodies! ☀️
                  </p>
                </div>
                <div className="flex items-center justify-between text-2xl pt-1 px-1">
                  <span>☀️</span>
                  <span>🌙</span>
                  <span>🎃</span>
                  <span>⚡</span>
                  <span>🏝️</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-amber-400 group-hover:text-slate-950 text-amber-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Build Songs</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 4: Music Symbol Match */}
            <div
              onClick={() => setSelectedToolModal('music-symbol-match')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/40 border border-purple-500/30 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  🃏
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-purple-300 transition-colors">
                    Symbol Match
                  </h4>
                  <p className="text-xs text-purple-300 font-bold mt-0.5">
                    Memory match &amp; 45s speed challenge game! ⚡
                  </p>
                </div>
                <div className="flex items-center justify-around font-serif text-2xl text-purple-200 pt-1 px-1">
                  <span>♩</span>
                  <span>𝄽</span>
                  <span>𝄢</span>
                  <span>𝄞</span>
                  <span>𝄐</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-purple-400 group-hover:text-slate-950 text-purple-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Play Match Game</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 5: Tempo Tapper */}
            <div
              onClick={() => setSelectedToolModal('tempo-tapper')}
              className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-4xl group-hover:scale-110 transition-transform shadow-inner">
                  ⏱️
                </div>
                <div>
                  <h4 className="text-xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Tempo Tapper
                  </h4>
                  <p className="text-xs text-amber-300 font-bold mt-0.5">
                    Tap the speed to race your animal! 🐢 🐆 🚀
                  </p>
                </div>
                <div className="flex items-center justify-between text-2xl pt-1 px-1">
                  <span>🐢</span>
                  <span>🚶</span>
                  <span>🦘</span>
                  <span>🐎</span>
                  <span>🐆</span>
                  <span>🚀</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-amber-400 group-hover:text-slate-950 text-amber-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Open Tapper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 6: Do-Re-Mi Chimes */}
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
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-rose-500 group-hover:text-white text-rose-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Play Chimes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 7: Instrument Zoo */}
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
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Explore Zoo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 8: Dynamic Ears */}
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
                  className="w-full py-2.5 rounded-xl bg-slate-800 group-hover:bg-emerald-400 group-hover:text-slate-950 text-emerald-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Open Meter</span>
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

            <button
              type="button"
              onClick={onOpenHelp}
              className="px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/60 transition-colors cursor-pointer"
            >
              Help &amp; Shortcuts
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
