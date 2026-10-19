import React from 'react';
import {
  Music,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  HelpCircle,
  Sparkles,
  Sliders,
  Drum,
  FileMusic,
  Play,
  Layers,
  Award,
} from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';

export type MusicLabAppId = 'hub' | 'staff-composer' | 'rhythm-rockstars' | 'beat-machine';

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
  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Bar - Exact Staff Composer aesthetic */}
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

          {/* Right Header Navigation & Student Session */}
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
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Welcome Banner */}
        <div className="text-center space-y-2.5 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Elementary &amp; Middle School Music Class</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight font-['Fredoka',sans-serif]">
            Welcome to{' '}
            <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-sky-300 bg-clip-text text-transparent">
              Mr. Arthur&apos;s Music Lab
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
            Compose sheet music on the staff, master rhythm decoding, program beat patterns, and create songs together.
          </p>

          {studentSession && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-inner mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Signed in as <strong>{studentSession.firstName}</strong> — your compositions &amp; scores save automatically!
              </span>
            </div>
          )}
        </div>

        {/* PRIMARY FLAGSHIP APP: STAFF COMPOSER SHOWCASE */}
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0E1628] to-[#0A101D] border-2 border-sky-400/40 hover:border-sky-400/70 p-6 sm:p-8 shadow-2xl transition-all duration-300 group overflow-hidden">
          {/* Subtle Staff Lines in Background */}
          <div className="absolute inset-0 opacity-5 pointer-events-none flex flex-col justify-around py-4">
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-3.5 max-w-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-black uppercase tracking-wider font-['Fredoka',sans-serif]">
                  ⭐ Featured Classroom Studio
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                  ✓ Multi-Track Audio &amp; MIDI
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-['Fredoka',sans-serif] tracking-wide flex items-center gap-2.5">
                  <span className="bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                    Staff Composer
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-sky-300 font-extrabold uppercase tracking-wider mt-1">
                  Full Score Notation, Melody Writing &amp; Playback
                </p>
              </div>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                Click notes directly onto the treble and bass clef! Features Boomwhacker Chroma-Notes, letter names, beat counters, virtual piano, drum groove backings, and instant cloud saving.
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  '🎼 Treble & Bass Clefs',
                  '🌈 Boomwhacker Colors',
                  '🎹 Virtual Piano',
                  '🥁 Drum Groove Backings',
                  '📄 PDF, MIDI & WAV Export',
                  '☁️ Student Cloud Auto-Save',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 text-slate-200 text-xs font-semibold border border-slate-700/80 shadow-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Launch Button Strip */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => onSelectApp('staff-composer')}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 hover:from-sky-300 hover:to-indigo-400 text-slate-950 font-black text-base flex items-center justify-center gap-2.5 shadow-xl shadow-sky-500/30 hover:scale-102 active:scale-98 transition-all cursor-pointer font-['Fredoka',sans-serif]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Launch Staff Composer</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Free for all students</span>
                <span>•</span>
                <span>No sign-in required to compose</span>
              </div>
            </div>
          </div>
        </div>

        {/* SUB-APPLICATIONS & SUITE GRID */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl font-black text-white font-['Fredoka',sans-serif] tracking-wide flex items-center gap-2">
              <span>More Music Class Apps</span>
            </h3>
            <span className="text-xs text-slate-400">Integrated Suite</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. RHYTHM ROCK STARS */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-rose-500/30 hover:border-rose-400/60 p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-rose-500/10 group">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 text-2xl group-hover:scale-105 transition-transform">
                    🎸
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                    Ready to Play
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-rose-300 transition-colors">
                    Rhythm Rock Stars
                  </h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Beat Decoding &amp; Ear Training
                  </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Level up through 6 stages! Decode rhythm patterns, tap in real-time with drum audio, solve rhythm theory quizzes, and climb the class leaderboard.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['🎧 Beat Decoder', '⚡ Rhythm Tapper', '🥁 Beat Builder', '🏆 Leaderboard'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700/60"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('rhythm-rockstars')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer group-hover:gap-2.5 transition-all font-['Fredoka',sans-serif]"
                >
                  <span>Play Rhythm Rock Stars</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. BEAT MACHINE */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 hover:border-amber-400/60 p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-amber-500/10 group">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl group-hover:scale-105 transition-transform">
                    🥁
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Sequencer
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-amber-300 transition-colors">
                    Beat Machine
                  </h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    16-Step Drum Grid &amp; Grooves
                  </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Program drum rhythms across a 16-step grid. Layer acoustic and electronic kicks, snares, claps, and hi-hats with tempo and swing controls.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['16-Step Pad Grid', 'Kick & Snare', 'Hi-Hats & Claps', 'Tempo Sync'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700/60"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('beat-machine')}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer group-hover:gap-2.5 transition-all font-['Fredoka',sans-serif]"
                >
                  <Drum className="w-3.5 h-3.5" />
                  <span>Launch Beat Machine</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. CLASSROOM DAW */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-purple-500/30 hover:border-purple-400/60 p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/10 group">
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 text-2xl group-hover:scale-105 transition-transform">
                    🎚️
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    Audio Studio
                  </span>
                </div>

                <div>
                  <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif] group-hover:text-purple-300 transition-colors">
                    Classroom DAW
                  </h4>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Multi-Track Audio &amp; Mixer
                  </p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  Multi-track digital audio workstation for classroom music production. Arrange audio loops, mix instrument volume and stereo pan, and add audio effects.
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Multi-Track Mixer', 'Audio Loops', 'Stereo Pan', 'Master Effects'].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700/60"
                      >
                        {tag}
                      </span>
                    )
                  )}
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => onSelectApp('staff-composer')}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white font-black text-xs flex items-center justify-center gap-1.5 border border-slate-700/80 cursor-pointer transition-all font-['Fredoka',sans-serif]"
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Use Multi-Track in Staff Composer</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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
    </div>
  );
};
