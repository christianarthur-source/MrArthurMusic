import React from 'react';
import {
  Music,
  Zap,
  Sliders,
  Disc3,
  Play,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  HelpCircle,
  Sparkles,
  Award,
  Layers,
  Radio,
} from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';

export type MusicLabAppId = 'hub' | 'staff-composer' | 'rhythm-rockstars';

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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0a0f1d] to-[#070b14] text-white flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAvatar}
              className="relative group cursor-pointer focus:outline-hidden"
              title="Click to view Mr. Arthur"
            >
              <img
                src="/mr-arthur-avatar.jpg"
                alt="Mr. Arthur"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-amber-400/80 shadow-md group-hover:scale-105 group-hover:ring-amber-300 transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight flex items-center gap-1.5">
                <span>Mr. Arthur&apos;s</span>
                <span className="bg-gradient-to-r from-amber-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
                  Music Lab
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Interactive Music Tools for Young Musicians
              </p>
            </div>
          </div>

          {/* Right Header Navigation & Student Session */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenClassroom}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                studentSession
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30'
                  : 'bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>
                {studentSession ? `Signed In (${studentSession.firstName})` : 'Student Sign In'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenHelp}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Welcome to Music Class</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Explore, Compose &amp; Play in{' '}
            <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-sky-300 bg-clip-text text-transparent">
              The Music Lab
            </span>
          </h2>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
            Choose an app below to write melodies on the staff, master rock rhythms, program beats,
            or produce classroom songs.
          </p>

          {studentSession && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-inner mt-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                Signed in as <strong>{studentSession.firstName}</strong> — your songs and progress save automatically!
              </span>
            </div>
          )}
        </div>

        {/* App Suite Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. STAFF COMPOSER CARD */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border border-sky-500/30 hover:border-sky-400/60 p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-sky-500/10 group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 text-2xl group-hover:scale-105 transition-transform">
                  🎼
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Ready to Play
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white group-hover:text-sky-300 transition-colors">
                  Staff Composer
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Interactive Sheet Music &amp; Song Creator
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Click notes onto treble and bass clef lines and spaces! Features Boomwhacker Chroma-Notes, pitch letter names, beat counters, virtual piano, multi-track audio playback, and instant song saving.
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Treble & Bass Clef',
                  'Boomwhacker Colors',
                  'Multi-Track Playback',
                  'PDF & MIDI Export',
                  'Auto-Save',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectApp('staff-composer')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 cursor-pointer group-hover:gap-3 transition-all"
              >
                <span>Launch Staff Composer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. RHYTHM ROCK STARS CARD */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border border-rose-500/30 hover:border-rose-400/60 p-6 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-rose-500/10 group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-300 text-2xl group-hover:scale-105 transition-transform">
                  🎸
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30">
                  Ready to Play
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white group-hover:text-rose-300 transition-colors">
                  Rhythm Rock Stars
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Gamified Rhythm Reading &amp; Tap Timing
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Level up through 6 rock stages! Practice rhythm clapping, tap in time with audio backings, solve multiple-choice rhythm quizzes, assemble beat patterns, earn stars, and climb the rockstar leaderboard.
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Rhythm Quizzes',
                  'Tap Timing Game',
                  'Beat Builder Puzzles',
                  'Rockstar Badges & Streaks',
                  'Class Leaderboards',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-semibold border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectApp('rhythm-rockstars')}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 cursor-pointer group-hover:gap-3 transition-all"
              >
                <span>Play Rhythm Rock Stars</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3. BEAT MACHINE CARD */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/80 to-slate-950 border border-slate-800 p-6 flex flex-col justify-between transition-all opacity-90 hover:opacity-100">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-2xl">
                  🥁
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Coming Soon to the Lab
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Beat Machine</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  16-Step Drum Sequencer &amp; Groove Creator
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Build drum beats on an interactive 16-step pad grid. Layer acoustic and electronic kicks, snares, claps, and hi-hats. Adjust tempo, swing, and volume to make classroom grooves.
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  '16-Step Pad Grid',
                  'Kick, Snare & Hi-Hat',
                  'Tempo & Swing Control',
                  'Pattern Export',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectApp('staff-composer')}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>(Available in Staff Composer Drum Tracks)</span>
              </button>
            </div>
          </div>

          {/* 4. CLASSROOM DAW CARD */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900/60 via-slate-900/80 to-slate-950 border border-slate-800 p-6 flex flex-col justify-between transition-all opacity-90 hover:opacity-100">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 text-2xl">
                  🎚️
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-400/20 text-purple-300 border border-purple-400/30">
                  Coming Soon to the Lab
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white">Classroom DAW</h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  Multi-Track Audio Studio &amp; Sound Mixer
                </p>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Multi-track digital audio workstation for classroom music production. Arrange audio loops, mix instrument volume and stereo pan, add reverb and echo, and export final songs.
              </p>

              {/* Feature Tags */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  'Multi-Track Timeline',
                  'Channel Faders & Pan',
                  'Reverb & Chorus FX',
                  'Audio Export',
                ].map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px] font-semibold border border-slate-700/60"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => onSelectApp('staff-composer')}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>(Available in Staff Composer Multi-Track Mixer)</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Main Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Mr. Arthur&apos;s Music Lab</span>
            <span>•</span>
            <span>Created for Elementary &amp; Middle School Music Classes</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenEdLaw}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>NY Ed Law § 2-d &amp; Parents&apos; Bill of Rights</span>
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={onOpenHelp}
              className="hover:text-white cursor-pointer"
            >
              Help &amp; Shortcuts
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
