import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Sparkles,
  Mic,
  Gamepad2,
  RotateCcw,
  CircleDot,
  Share2,
  ChevronDown,
  Check,
  Music,
  ArrowLeft,
  UserCheck,
  Save,
  Cloud,
} from 'lucide-react';
import { StudentSession } from '../../utils/classroomApi';
import { soundEngine as globalSoundEngine } from '../../audio/soundEngine';

interface HeaderProps {
  onBackToHub?: () => void;
  studentSession?: StudentSession | null;
  onOpenClassroomModal?: () => void;
  onOpenAvatar?: () => void;
  onSaveSong?: () => void;
  isSaving?: boolean;
  currentSongTitle?: string;
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  onResetAll: () => void;
  isEchoOn: boolean;
  onToggleEcho: () => void;
  isReverbOn?: boolean;
  onToggleReverb?: () => void;
  isBitcrusherOn?: boolean;
  onToggleBitcrusher?: () => void;
  isDistortionOn?: boolean;
  onToggleDistortion?: () => void;
  isFilterOn?: boolean;
  onToggleFilter?: () => void;
  onOpenVoiceRecorder: () => void;
  onOpenRhythmGame: () => void;
  onOpenShare: () => void;
  onOpenNotateSong?: () => void;
  onOpenSecretLightShow?: () => void;
  isRecordingSong: boolean;
  onToggleSongRecord: () => void;
  totalSteps: 8 | 16;
  onToggleTotalSteps: (steps: 8 | 16) => void;
}

export interface TempoMarking {
  term: string;
  emoji: string;
  bpm: number;
}

export const TEMPO_MARKINGS: TempoMarking[] = [
  { term: 'Adagio', emoji: '🐢', bpm: 70 },
  { term: 'Andante', emoji: '🚶', bpm: 92 },
  { term: 'Moderato', emoji: '🦘', bpm: 112 },
  { term: 'Allegro', emoji: '🐆', bpm: 132 },
  { term: 'Presto', emoji: '🚀', bpm: 156 },
];

export const getTempoDescription = (bpm: number): { term: string; translation: string } => {
  if (bpm < 76) return { term: 'Adagio', translation: 'Slow' };
  if (bpm < 105) return { term: 'Andante', translation: 'Walking Pace' };
  if (bpm < 125) return { term: 'Moderato', translation: 'Moderate' };
  if (bpm < 150) return { term: 'Allegro', translation: 'Fast' };
  return { term: 'Presto', translation: 'Very Fast' };
};

const DEFAULT_ARTHUR_AVATAR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%230f172a"/><stop offset="50%" stop-color="%231e1b4b"/><stop offset="100%" stop-color="%23312e81"/></linearGradient><linearGradient id="skin" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%23fed7aa"/><stop offset="100%" stop-color="%23fdba74"/></linearGradient><linearGradient id="hair" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2378350f"/><stop offset="100%" stop-color="%23451a03"/></linearGradient><linearGradient id="shirt" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="%231e40af"/><stop offset="100%" stop-color="%231e3a8a"/></linearGradient><linearGradient id="guitar" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23b45309"/></linearGradient></defs><rect width="200" height="200" rx="30" fill="url(%23bg)"/><path d="M 40 200 C 40 145 65 130 100 130 C 135 130 160 145 160 200 Z" fill="url(%23shirt)"/><path d="M 75 95 Q 100 110 125 95 L 125 140 Q 100 150 75 140 Z" fill="url(%23skin)"/><path d="M 68 75 Q 68 115 100 115 Q 132 115 132 75 Q 132 40 100 40 Q 68 40 68 75 Z" fill="url(%23skin)"/><path d="M 60 65 C 58 35 85 20 100 20 C 120 20 142 35 140 65 C 130 45 115 35 100 35 C 85 35 70 45 60 65 Z" fill="url(%23hair)"/><circle cx="86" cy="68" r="5" fill="%231e293b"/><circle cx="114" cy="68" r="5" fill="%231e293b"/><circle cx="88" cy="66" r="1.5" fill="%23ffffff"/><circle cx="116" cy="66" r="1.5" fill="%23ffffff"/><path d="M 85 88 Q 100 102 115 88" fill="none" stroke="%23ffffff" stroke-width="4" stroke-linecap="round"/><ellipse cx="125" cy="155" rx="35" ry="24" fill="url(%23guitar)" transform="rotate(-15 125 155)"/><circle cx="120" cy="153" r="8" fill="%23451a03" transform="rotate(-15 125 155)"/><path d="M 125 155 L 185 125" stroke="%23fef08a" stroke-width="6" stroke-linecap="round"/><text x="100" y="190" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="11" fill="%23fbbf24" letter-spacing="1">MR. ARTHUR</text></svg>`;

export const Header: React.FC<HeaderProps> = ({
  onBackToHub,
  studentSession,
  onOpenClassroomModal,
  onOpenAvatar,
  onSaveSong,
  isSaving = false,
  currentSongTitle,
  isPlaying,
  onTogglePlay,
  bpm,
  onChangeBpm,
  onResetAll,
  isEchoOn,
  onToggleEcho,
  isReverbOn = false,
  onToggleReverb,
  isBitcrusherOn = false,
  onToggleBitcrusher,
  isDistortionOn = false,
  onToggleDistortion,
  isFilterOn = false,
  onToggleFilter,
  onOpenVoiceRecorder,
  onOpenRhythmGame,
  onOpenShare,
  onOpenNotateSong,
  onOpenSecretLightShow,
  isRecordingSong,
  onToggleSongRecord,
  totalSteps,
  onToggleTotalSteps,
}) => {
  const [isFxMenuOpen, setIsFxMenuOpen] = useState<boolean>(false);
  const [isExtrasOpen, setIsExtrasOpen] = useState<boolean>(false);

  const extrasRef = useRef<HTMLDivElement>(null);
  const activeFxCount = [isEchoOn, isReverbOn, isBitcrusherOn, isDistortionOn, isFilterOn].filter(Boolean).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (extrasRef.current && !extrasRef.current.contains(event.target as Node)) {
        setIsExtrasOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="relative z-50 rounded-3xl border border-slate-800 bg-slate-900/95 p-4 sm:p-5 shadow-2xl backdrop-blur-md">
      {/* Top Main Bar: Back Button, Brand with Mr. Arthur Avatar, and Student Sign-In / Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        {/* Left: Back to Hub + Brand */}
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
                globalSoundEngine.playWelcomeChime();
                if (onOpenAvatar) onOpenAvatar();
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

            <div className="flex flex-col justify-center select-none">
              <span className="text-[10px] sm:text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
                Mr. Arthur&apos;s
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
                  Beat Machine
                </span>
                <button
                  type="button"
                  onClick={onOpenSecretLightShow}
                  className="text-base sm:text-lg hover:scale-125 transition-transform cursor-pointer p-0.5 rounded-full hover:bg-slate-800/50"
                  title="Secret Light Show"
                >
                  🎵
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Student Sign-In */}
        <div className="flex items-center gap-2">
          {onOpenClassroomModal && (
            <button
              type="button"
              onClick={onOpenClassroomModal}
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
              <span>{studentSession ? studentSession.firstName : 'Sign In'}</span>
            </button>
          )}
        </div>
      </div>


      {/* Line 1: PLAY and Tempo on the Same Horizontal Axis */}
      <div className="flex items-center gap-3 border-t border-slate-800 pt-3 pb-2 overflow-x-auto no-scrollbar">
        {/* Compact PLAY / STOP Button */}
        <button
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause beat (Space)' : 'Play beat (Space)'}
          aria-label={isPlaying ? 'Pause beat (Space)' : 'Play beat (Space)'}
          className={`group flex items-center gap-1.5 rounded-xl px-4 py-2 font-black text-white shadow-md transition-all duration-200 active:scale-95 shrink-0 ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.5)]'
              : 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 hover:from-emerald-300 hover:to-teal-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="h-4 w-4 fill-white shrink-0" />
              <span className="text-xs sm:text-sm font-black tracking-wider">STOP</span>
              <kbd className="hidden sm:inline-flex items-center rounded bg-black/25 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-rose-100 uppercase border border-rose-300/30">
                Space
              </kbd>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-slate-950 shrink-0" />
              <span className="text-xs sm:text-sm font-black tracking-wider">PLAY</span>
              <kbd className="hidden sm:inline-flex items-center rounded bg-emerald-950/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-emerald-950 uppercase border border-emerald-950/20">
                Space
              </kbd>
            </>
          )}
        </button>

        {/* Musical Tempo Selector (Emoji + Term only, no descriptor strings) */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Tempo:
          </span>
          <div className="flex items-center gap-1 rounded-xl bg-slate-800/90 p-1 border border-slate-700 shadow-inner">
            {TEMPO_MARKINGS.map((tempo) => {
              const isSelected = Math.abs(bpm - tempo.bpm) < 11;
              return (
                <button
                  key={tempo.term}
                  onClick={() => onChangeBpm(tempo.bpm)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 scale-105 shadow-sm ring-1 ring-amber-300/50'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`${tempo.term} (${tempo.bpm} BPM)`}
                >
                  <span className="text-xs">{tempo.emoji}</span>
                  <span className="font-black text-xs">{tempo.term}</span>
                </button>
              );
            })}

            {/* Custom BPM +/- controls */}
            <div className="ml-1 flex items-center gap-1 border-l border-slate-700 pl-1.5">
              <button
                onClick={() => onChangeBpm(Math.max(60, bpm - 5))}
                className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-xs font-black text-white hover:bg-slate-600 active:scale-90 transition-transform"
                title="Decrease Tempo"
              >
                -
              </button>
              <span className="text-xs font-black text-amber-300 px-1 whitespace-nowrap">
                {bpm} <span className="text-[10px] text-slate-400 font-normal">BPM</span>
              </span>
              <button
                onClick={() => onChangeBpm(Math.min(180, bpm + 5))}
                className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-xs font-black text-white hover:bg-slate-600 active:scale-90 transition-transform"
                title="Increase Tempo"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Line 2: Share & Extras Dropdown + Secondary Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-800 pt-2.5">
        <div className="flex items-center gap-2">
          {/* Save Beat Button */}
          {onSaveSong && (
            <button
              onClick={onSaveSong}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md hover:from-emerald-300 hover:to-teal-400 active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
              title={
                studentSession
                  ? `Save "${currentSongTitle || 'My Beat'}" to ${studentSession.firstName}'s cloud account`
                  : 'Save Beat to Student Cloud Account'
              }
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Beat ☁️'}</span>
            </button>
          )}

          {/* Share Song Button */}
          <button
            onClick={onOpenShare}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 px-4 py-2 text-xs font-black text-slate-950 shadow-md hover:from-cyan-300 hover:to-blue-400 active:scale-95 transition-transform"
            title="Share beat with friends via public link"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Share</span>
          </button>

          {/* Extras Dropdown */}
          <div className="relative" ref={extrasRef}>
            <button
              onClick={() => setIsExtrasOpen(!isExtrasOpen)}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-black text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white shadow-md active:scale-95 transition-all"
            >
              <span>Extras 🌟</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExtrasOpen ? 'rotate-180' : ''}`} />
            </button>

            {isExtrasOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-52 rounded-2xl border-2 border-slate-600 bg-slate-900/98 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 space-y-1">
                <div className="px-3 py-1 border-b border-slate-800 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    Extras & Tools
                  </span>
                </div>

                {/* Record Song */}
                <button
                  onClick={() => {
                    onToggleSongRecord();
                    setIsExtrasOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                    isRecordingSong
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <CircleDot className={`h-3.5 w-3.5 ${isRecordingSong ? 'animate-ping text-white' : 'text-rose-400'}`} />
                  <span>{isRecordingSong ? 'Recording...' : 'Record Song 🎙️'}</span>
                </button>

                {/* Notate Song */}
                {onOpenNotateSong && (
                  <button
                    onClick={() => {
                      onOpenNotateSong();
                      setIsExtrasOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    <Music className="h-3.5 w-3.5 text-amber-400" />
                    <span>Notate Song 🎼</span>
                  </button>
                )}

                {/* Voice Lab */}
                <button
                  onClick={() => {
                    onOpenVoiceRecorder();
                    setIsExtrasOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                >
                  <Mic className="h-3.5 w-3.5 text-pink-400" />
                  <span>Voice Lab 🎤</span>
                </button>

                {/* Beat Detective */}
                <button
                  onClick={() => {
                    onOpenRhythmGame();
                    setIsExtrasOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-black text-slate-200 hover:bg-slate-800 hover:text-white transition-all"
                >
                  <Gamepad2 className="h-3.5 w-3.5 text-purple-400" />
                  <span>Beat Detective 🐻</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Controls: Steps, FX Rack, Reset */}
        <div className="flex items-center gap-2">
          {/* Steps Switcher: 8 vs 16 steps */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs font-black">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider px-1 font-bold">Steps:</span>
            <button
              onClick={() => onToggleTotalSteps(8)}
              className={`rounded-lg px-2 py-0.5 transition-all font-black text-xs ${
                totalSteps === 8
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              8
            </button>
            <button
              onClick={() => onToggleTotalSteps(16)}
              className={`rounded-lg px-2 py-0.5 transition-all font-black text-xs ${
                totalSteps === 16
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              16
            </button>
          </div>

          {/* Sound FX Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsFxMenuOpen(!isFxMenuOpen)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all border shadow-md ${
                activeFxCount > 0
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span>FX 🎛️</span>
              {activeFxCount > 0 && (
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cyan-300 text-slate-950 text-[9px] font-black animate-pulse">
                  {activeFxCount}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 text-slate-300 transition-transform ${isFxMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFxMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[90] bg-black/20"
                  onClick={() => setIsFxMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-[100] mt-2 w-56 rounded-2xl border-2 border-slate-600 bg-slate-900 p-2.5 shadow-2xl backdrop-blur-xl space-y-1">
                  <div className="px-2 py-0.5 border-b border-slate-800 mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                      Audio Effects Rack
                    </span>
                    {activeFxCount > 0 && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                        {activeFxCount} Active
                      </span>
                    )}
                  </div>

                  {/* Space Echo */}
                  <button
                    onClick={() => onToggleEcho()}
                    className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                      isEchoOn
                        ? 'bg-cyan-500/25 text-cyan-200 border-2 border-cyan-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Space Echo ✨</span>
                    </div>
                    {isEchoOn && <Check className="h-3.5 w-3.5 text-cyan-300" />}
                  </button>

                  {/* Cathedral Reverb */}
                  {onToggleReverb && (
                    <button
                      onClick={() => onToggleReverb()}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                        isReverbOn
                          ? 'bg-purple-500/25 text-purple-200 border-2 border-purple-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>🏰</span>
                        <span>Cathedral Reverb</span>
                      </div>
                      {isReverbOn && <Check className="h-3.5 w-3.5 text-purple-300" />}
                    </button>
                  )}

                  {/* 8-Bit Crusher */}
                  {onToggleBitcrusher && (
                    <button
                      onClick={() => onToggleBitcrusher()}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                        isBitcrusherOn
                          ? 'bg-emerald-500/25 text-emerald-200 border-2 border-emerald-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>👾</span>
                        <span>8-Bit Crusher</span>
                      </div>
                      {isBitcrusherOn && <Check className="h-3.5 w-3.5 text-emerald-300" />}
                    </button>
                  )}

                  {/* Distortion */}
                  {onToggleDistortion && (
                    <button
                      onClick={() => onToggleDistortion()}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                        isDistortionOn
                          ? 'bg-rose-500/25 text-rose-200 border-2 border-rose-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>⚡</span>
                        <span>Distortion</span>
                      </div>
                      {isDistortionOn && <Check className="h-3.5 w-3.5 text-rose-300" />}
                    </button>
                  )}

                  {/* Filter */}
                  {onToggleFilter && (
                    <button
                      onClick={() => onToggleFilter()}
                      className={`flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-black transition-all ${
                        isFilterOn
                          ? 'bg-amber-500/25 text-amber-200 border-2 border-amber-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>🌊</span>
                        <span>Warm Filter</span>
                      </div>
                      {isFilterOn && <Check className="h-3.5 w-3.5 text-amber-300" />}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Reset All */}
          <button
            onClick={onResetAll}
            className="flex items-center gap-1 rounded-xl bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-700 transition-colors"
            title="Reset all beats, melody, and bass"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
};
