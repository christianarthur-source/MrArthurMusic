import React from 'react';
import { Volume2, VolumeX, Play, Square, FastForward, Music } from 'lucide-react';
import { GameMode, SoundKit } from '../types/game';

interface StageHeaderProps {
  stageName: string;
  levelNumber: number;
  activeBeat: number | null; // 1 to 4
  isCountIn: boolean;
  isPlaying: boolean;
  onPlayRhythm: () => void;
  onStopRhythm: () => void;
  soundKit: SoundKit;
  onSelectKit?: (kit: SoundKit) => void;
  tempoBpm: number;
  onSetTempo: (bpm: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  streak: number;
  showPlayControls?: boolean;
  currentMode?: GameMode;
}

export const StageHeader: React.FC<StageHeaderProps> = ({
  stageName,
  levelNumber,
  activeBeat,
  isCountIn,
  isPlaying,
  onPlayRhythm,
  onStopRhythm,
  soundKit,
  onSelectKit,
  tempoBpm,
  onSetTempo,
  isMuted,
  onToggleMute,
  streak,
  showPlayControls = true,
  currentMode = 'quiz'
}) => {
  const kitOptions: { id: SoundKit; name: string; icon: string }[] = [
    { id: 'rock_kit', name: 'Rock Snare', icon: '🥁' },
    { id: 'woodblock', name: 'Woodblock', icon: '🪵' },
    { id: 'cowbell_fever', name: 'Cowbell', icon: '🔔' },
    { id: 'electric_clap', name: 'Hand Claps', icon: '👏' },
    { id: 'marimba', name: 'Marimba', icon: '🎶' },
    { id: 'triangle', name: 'Triangle', icon: '📐' },
    { id: 'synth_rimshot', name: '808 Rimshot', icon: '⚡' },
    { id: 'agogo_bell', name: 'Agogô Bell', icon: '🎵' }
  ];

  const modeTitleMap: Record<GameMode, { title: string; subtitle: string; gradient: string }> = {
    quiz: {
      title: '🎧 BEAT DECODER',
      subtitle: 'Listen & Decode the Groove',
      gradient: 'from-amber-200 via-yellow-300 to-amber-500'
    },
    tap: {
      title: '⚡ RHYTHM TAPPER',
      subtitle: 'Tap the Beat in Real-Time',
      gradient: 'from-amber-300 via-orange-300 to-amber-500'
    },
    builder: {
      title: '🥁 BEAT BUILDER',
      subtitle: 'Construct Your Rock Pattern',
      gradient: 'from-cyan-300 via-amber-200 to-amber-400'
    },
    rhythm_quiz: {
      title: '🧩 RHYTHM QUIZ',
      subtitle: 'Rockstar Music Theory Challenge',
      gradient: 'from-rose-300 via-amber-200 to-red-400'
    },
    streak_rush: {
      title: '🔥 STREAK RUSH',
      subtitle: 'Non-Stop Rhythm Mania',
      gradient: 'from-red-400 via-orange-400 to-amber-300'
    }
  };

  const activeTitle = modeTitleMap[currentMode] || modeTitleMap.quiz;

  return (
    <div className="w-full relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl mb-6">
      {/* Background Graphic Layer */}
      <div className="absolute inset-0 opacity-25 mix-blend-luminosity pointer-events-none">
        <img
          src="/src/assets/images/rockstar_stage_banner_1791818144423.jpg"
          alt="Rockstar Stage"
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Graceful fallback to styled stage gradient
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
      </div>

      {/* Stage Spotlights Bar */}
      <div className="relative z-10 px-4 sm:px-6 pt-4 pb-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Level, RED & White DENTI badge & Stage Title */}
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1 flex-wrap">
              {/* Prominent RED & White DENTI School Branding */}
              <span className="px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-black text-xs sm:text-sm tracking-wider border-2 border-white shadow-md shadow-red-600/50 uppercase shrink-0">
                DENTI
              </span>
              <span className="bg-slate-950/80 px-2 py-0.5 rounded-lg border border-slate-800 text-amber-300 font-extrabold text-xs">
                STAGE {levelNumber}
              </span>
              <span>·</span>
              <span className="text-slate-200 font-extrabold text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">{stageName}</span>
              {streak >= 3 && (
                <>
                  <span>·</span>
                  <span className="text-rose-400 font-black animate-pulse text-xs">🔥 {streak}X COMBO!</span>
                </>
              )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
              <h2 className="text-sm sm:text-base md:text-lg font-display font-black tracking-tight leading-snug uppercase">
                <span className={`bg-gradient-to-r ${activeTitle.gradient} bg-clip-text text-transparent drop-shadow-md`}>
                  {activeTitle.title}
                </span>
              </h2>
              <span className="text-xs sm:text-sm text-slate-300 font-semibold">
                · {activeTitle.subtitle}
              </span>
            </div>
          </div>

          {/* Controls Strip (Playback & Sound Dropdown) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Play / Listen button (only when showPlayControls is enabled) */}
            {showPlayControls && (
              isPlaying ? (
                <button
                  onClick={onStopRhythm}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-900/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Beat
                </button>
              ) : (
                <button
                  onClick={onPlayRhythm}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  Play Stage Groove
                </button>
              )
            )}

            {/* Rhythm Sound Dropdown Menu */}
            {onSelectKit && (
              <div className="flex items-center gap-1.5 bg-slate-950/90 rounded-xl border border-slate-800 px-3 py-1.5 shadow-md">
                <Music className="w-4 h-4 text-amber-400 shrink-0" />
                <label htmlFor="rhythm-sound-select" className="text-xs font-extrabold uppercase tracking-wider text-slate-300 whitespace-nowrap hidden sm:inline">
                  Sound:
                </label>
                <select
                  id="rhythm-sound-select"
                  value={soundKit}
                  onChange={(e) => onSelectKit(e.target.value as SoundKit)}
                  className="bg-slate-900 text-amber-300 font-extrabold text-xs sm:text-sm rounded-lg px-2.5 py-1 border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-inner"
                  style={{ colorScheme: 'dark' }}
                >
                  {kitOptions.map((kit) => (
                    <option key={kit.id} value={kit.id} className="bg-slate-900 text-slate-100 font-semibold py-1">
                      {kit.icon} {kit.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tempo Selector */}
            <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-800 p-1 text-xs">
              <button
                onClick={() => onSetTempo(74)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  tempoBpm <= 80 ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Practice Slow Tempo (74 BPM)"
              >
                Slow
              </button>
              <button
                onClick={() => onSetTempo(96)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  tempoBpm > 80 && tempoBpm <= 105 ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Normal Rock Tempo (96 BPM)"
              >
                Normal
              </button>
              <button
                onClick={() => onSetTempo(120)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                  tempoBpm > 105 ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
                title="Rockstar Turbo Tempo (120 BPM)"
              >
                <FastForward className="w-3 h-3 inline mr-1" />
                Turbo
              </button>
            </div>

            {/* Mute Button */}
            <button
              onClick={onToggleMute}
              className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              aria-label="Toggle Mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
