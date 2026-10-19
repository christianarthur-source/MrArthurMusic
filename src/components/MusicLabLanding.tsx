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
  SlidersHorizontal,
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
      {/* Top Bar - Staff Composer Aesthetic */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 text-white shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Mr. Arthur Avatar & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAvatar}
              className="w-11 h-11 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-amber-300/60 hover:ring-amber-300 hover:scale-105 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
              title="Click to view Mr. Arthur"
            >
              <img
                src="/mr-arthur-avatar.jpg"
                alt="Mr. Arthur"
                className="w-full h-full object-cover object-top"
              />
            </button>
            <div className="flex flex-col justify-center select-none">
              <span className="text-[11px] sm:text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
                Mr. Arthur&apos;s
              </span>
              <span className="text-xl sm:text-2xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-xs ${
                studentSession
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
                  : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{studentSession ? studentSession.firstName : 'Student Sign In'}</span>
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700/80 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {/* Welcome Header - High Visual Energy */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider font-['Fredoka',sans-serif]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>Music Class Activity Hub</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-['Fredoka',sans-serif]">
            Pick Your Musical Activity! 🎵
          </h2>

          {studentSession && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome back, {studentSession.firstName}! Your work saves automatically.</span>
            </div>
          )}
        </div>

        {/* =========================================================================
            FLAGSHIP APP #1: STAFF COMPOSER (Hero Star of the Site)
            ========================================================================= */}
        <section className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0F182E] to-[#080D1A] border-3 border-sky-400/50 hover:border-sky-400 p-6 sm:p-8 shadow-2xl transition-all duration-300 group overflow-hidden">
          {/* Decorative Background Staff Lines */}
          <div className="absolute inset-0 opacity-10 pointer-events-none flex flex-col justify-around py-6">
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Left Graphic & Visual Preview */}
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider font-['Fredoka',sans-serif] shadow-md flex items-center gap-1">
                  ⭐ Flagship Music Studio
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
                  🎼 Sheet Music &amp; Audio
                </span>
              </div>

              <div>
                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white font-['Fredoka',sans-serif] tracking-wide">
                  <span className="bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                    Staff Composer
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-sky-300 font-extrabold uppercase tracking-wider mt-1">
                  Click notes onto the staff, compose melodies, and hear your song play!
                </p>
              </div>

              {/* Graphic Staff Preview Bar with Boomwhacker Chroma-Notes */}
              <div className="p-3 sm:p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-center lg:justify-start gap-2 sm:gap-3 flex-wrap shadow-inner">
                <span className="text-3xl sm:text-4xl">🎼</span>
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
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center shadow-md font-['Fredoka',sans-serif] group-hover:scale-110 transition-transform"
                  >
                    {n.name}
                  </div>
                ))}
                <span className="text-xl sm:text-2xl ml-1">🎹 🥁</span>
              </div>

              {/* Big Graphic Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1">
                {[
                  '🌈 Boomwhacker Colors',
                  '🎹 Virtual Piano Keys',
                  '🥁 Real Drum Grooves',
                  '🖨️ PDF & Audio Export',
                  '☁️ Student Auto-Save',
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

            {/* Right: Giant Hero Action Button */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectApp('staff-composer')}
                className="w-full sm:w-auto px-8 py-5 rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl shadow-sky-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer font-['Fredoka',sans-serif] border-2 border-white/20"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Open Staff Composer</span>
                <ArrowRight className="w-6 h-6" />
              </button>
              <span className="text-xs text-sky-300 font-semibold">Free for all students • 1-Click Launch</span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FLAGSHIP APPS #2 & #3: RHYTHM ROCK STARS & BEAT MACHINE (Prominent Grid)
            ========================================================================= */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl sm:text-2xl font-black text-white font-['Fredoka',sans-serif] flex items-center gap-2">
              <span>Classroom Flagship Apps</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Interactive Music
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 1. RHYTHM ROCK STARS */}
            <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#180E1C] to-slate-950 border-2 border-rose-500/40 hover:border-rose-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-rose-500/20 group overflow-hidden">
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500 to-amber-500 p-0.5 shadow-xl group-hover:scale-108 transition-transform">
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
                  <p className="text-xs font-bold text-rose-400 uppercase tracking-wider mt-0.5">
                    Beat Decoding &amp; Ear-Training Game
                  </p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Level up through 6 rock stages! Listen to drum rhythms, decode patterns with quarter &amp; eighth notes, tap in real time, and top the class leaderboard.
                </p>

                {/* Big Visual Game Stage Pills */}
                <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs font-bold">
                  <div className="p-2 rounded-xl bg-slate-950 border border-rose-500/30 text-rose-300">
                    🎧 Listen &amp; Decode
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300">
                    ⚡ Rhythm Tapper
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-300">
                    🏆 Leaderboard
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('rhythm-rockstars')}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-500 via-red-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-rose-500/30 cursor-pointer group-hover:gap-3 transition-all font-['Fredoka',sans-serif]"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Play Rhythm Rock Stars</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. BEAT MACHINE */}
            <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#1C170E] to-slate-950 border-2 border-amber-500/40 hover:border-amber-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 group overflow-hidden">
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-yellow-500 p-0.5 shadow-xl group-hover:scale-108 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🥁
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/40 font-['Fredoka',sans-serif]">
                    🎛️ Drum Sequencer
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Beat Machine
                  </h4>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mt-0.5">
                    16-Step Drum Grid &amp; Beat Maker
                  </p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Program your own custom drum beats across an interactive 16-step pad grid! Mix kicks, snares, claps, hi-hats, and adjust tempo and swing.
                </p>

                {/* Graphic 16-Step Pad Grid Simulation */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 flex items-center justify-around gap-1">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-6 flex-1 rounded-md transition-all ${
                        i % 2 === 0
                          ? 'bg-amber-400 shadow-md shadow-amber-400/40'
                          : 'bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('beat-machine')}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-400/30 cursor-pointer group-hover:gap-3 transition-all font-['Fredoka',sans-serif]"
                >
                  <Drum className="w-5 h-5" />
                  <span>Launch Beat Machine</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 3. STUDIO DAW */}
            <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#130E26] to-slate-950 border-2 border-indigo-500/40 hover:border-indigo-400 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/20 group overflow-hidden">
              <div className="space-y-4">
                {/* Header Badge & Giant Icon */}
                <div className="flex items-center justify-between">
                  <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-xl group-hover:scale-108 transition-transform">
                    <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center text-3xl">
                      🎛️
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/40 font-['Fredoka',sans-serif]">
                    🎧 Digital Audio Workstation
                  </span>
                </div>

                <div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif] group-hover:text-indigo-300 transition-colors">
                    Studio DAW
                  </h4>
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mt-0.5">
                    Multi-Track Recording &amp; Loops
                  </p>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed font-normal">
                  Arrange audio loops, slice &amp; duplicate clips, record microphone vocals, play virtual instruments with Piano Roll &amp; USB MIDI, and export your song to WAV!
                </p>

                {/* Graphic Multitrack Arranger Simulation */}
                <div className="p-3 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-1.5">
                  <div className="h-3 rounded-md bg-amber-400/80 w-3/4 flex items-center px-1 text-[8px] font-mono text-slate-950 font-bold">
                    🥁 Drums
                  </div>
                  <div className="h-3 rounded-md bg-pink-500/80 w-1/2 ml-4 flex items-center px-1 text-[8px] font-mono text-white font-bold">
                    🎸 Bass
                  </div>
                  <div className="h-3 rounded-md bg-sky-400/80 w-5/6 flex items-center px-1 text-[8px] font-mono text-slate-950 font-bold">
                    🎹 Chords
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('daw')}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-indigo-500/30 cursor-pointer group-hover:gap-3 transition-all font-['Fredoka',sans-serif]"
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
              <h3 className="text-xl sm:text-2xl font-black text-white font-['Fredoka',sans-serif] flex items-center gap-2">
                <span>🎒 Music Class Tool Box</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono">
                  Quick Utilities
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Classroom mini-tools for tempo, pitch, orchestra instruments &amp; volume dynamics
              </p>
            </div>
            <span className="text-xs text-slate-400 font-semibold">1-Click Launch • Smartboard Ready</span>
          </div>

          {/* 4 Consolidated Graphic Tool Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tool 1: Tempo Tapper / BPM Animal Runner */}
            <div
              onClick={() => setSelectedToolModal('tempo-tapper')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400/80 hover:shadow-xl hover:shadow-amber-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
                  ⏱️
                </div>
                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Tempo Tapper
                  </h4>
                  <p className="text-xs text-amber-400 font-bold uppercase tracking-wider mt-0.5">
                    BPM Animal Runner
                  </p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tap spacebar or screen to find any song&apos;s speed! Watch your animal race from Turtle to Cheetah.
                </p>
                <div className="flex items-center gap-1.5 text-lg">
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
                  className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-amber-400 group-hover:text-slate-950 text-amber-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Open Tapper</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 2: Do-Re-Mi Pitch Trainer */}
            <div
              onClick={() => setSelectedToolModal('solfege-trainer')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-rose-500/30 hover:border-rose-400/80 hover:shadow-xl hover:shadow-rose-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
                  🔔
                </div>
                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-rose-300 transition-colors">
                    Do-Re-Mi Trainer
                  </h4>
                  <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mt-0.5">
                    Curwen Signs &amp; Chimes
                  </p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Interactive Boomwhacker chime bars with Curwen hand signs and an ear-training quiz game!
                </p>
                <div className="flex items-center gap-1">
                  {['#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6', '#A855F7'].map((c, i) => (
                    <div key={i} style={{ backgroundColor: c }} className="w-3.5 h-6 rounded-xs" />
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-rose-500 group-hover:text-white text-rose-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Play Chimes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 3: Instrument Petting Zoo */}
            <div
              onClick={() => setSelectedToolModal('instrument-zoo')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/30 hover:border-cyan-400/80 hover:shadow-xl hover:shadow-cyan-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
                  🎻
                </div>
                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-cyan-300 transition-colors">
                    Instrument Zoo
                  </h4>
                  <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mt-0.5">
                    Orchestra Sound Tour
                  </p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hear violin, flute, trumpet, and timpani! Explore orchestra families with audio previews and fun facts.
                </p>
                <div className="flex items-center gap-2 text-xl">
                  <span>🎻</span>
                  <span>🪈</span>
                  <span>🎺</span>
                  <span>🥁</span>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-cyan-400 group-hover:text-slate-950 text-cyan-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
                >
                  <span>Explore Zoo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Tool 4: Dynamic Ears / Decibel Meter */}
            <div
              onClick={() => setSelectedToolModal('dynamic-ears')}
              className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-emerald-500/30 hover:border-emerald-400/80 hover:shadow-xl hover:shadow-emerald-500/10 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-inner">
                  👂
                </div>
                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-emerald-300 transition-colors">
                    Dynamic Ears
                  </h4>
                  <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mt-0.5">
                    Noise Meter &amp; Dynamics
                  </p>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Musical sound meter from <em>pp</em> to <em>ff</em> with quiet classroom challenge timer!
                </p>
                <div className="flex items-center gap-1 font-serif italic font-bold text-xs text-emerald-300">
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
                  className="w-full py-2 rounded-xl bg-slate-800 group-hover:bg-emerald-400 group-hover:text-slate-950 text-emerald-300 font-black text-xs transition-colors flex items-center justify-center gap-1.5 font-['Fredoka',sans-serif]"
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
