import React, { useState } from 'react';
import { ALL_AVAILABLE_SAMPLES } from '../data/soundPacks';
import { SoundSample, SoundType } from '../types';
import { soundEngine } from '../audio/soundEngine';
import {
  Volume2,
  Sparkles,
  Search,
  PlusCircle,
  Play,
  Square,
  Check,
  Disc3,
  SlidersHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { containsProfanity } from '../utils/profanityFilter';

interface SoundExplorerProps {
  onAssignToTrack?: (trackIndex: number, sample: SoundSample) => void;
  trackNames?: string[];
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

type CategoryFilter = 'all' | 'drums' | 'melody' | 'silly' | 'custom';

export const SoundExplorer: React.FC<SoundExplorerProps> = ({
  onAssignToTrack,
  trackNames = [],
  isPlaying = false,
  onTogglePlay,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<number>(1.0);
  const [assigningSample, setAssigningSample] = useState<SoundSample | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Sounds', icon: '🌟', count: ALL_AVAILABLE_SAMPLES.length },
    {
      id: 'drums',
      label: 'Drums & Beats',
      icon: '🥁',
      count: ALL_AVAILABLE_SAMPLES.filter((s) => s.category === 'drums').length,
    },
    {
      id: 'melody',
      label: 'Melodies & Chimes',
      icon: '🌈',
      count: ALL_AVAILABLE_SAMPLES.filter((s) => s.category === 'melody').length,
    },
    {
      id: 'silly',
      label: 'Cartoon & Silly FX',
      icon: '🤪',
      count: ALL_AVAILABLE_SAMPLES.filter((s) => s.category === 'silly').length,
    },
    {
      id: 'custom',
      label: 'Voice & Custom',
      icon: '🎤',
      count: ALL_AVAILABLE_SAMPLES.filter((s) => s.category === 'custom').length,
    },
  ];

  const filteredSamples = ALL_AVAILABLE_SAMPLES.filter((sample) => {
    const matchesCategory = selectedCategory === 'all' || sample.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      sample.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sample.funTag.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePlaySample = (sample: SoundSample) => {
    soundEngine.playSound(sample.soundType, 0, 1.0, selectedPitch);
    setActiveSoundId(sample.id);

    setTimeout(() => {
      setActiveSoundId(null);
    }, 350);
  };

  const handleAssignConfirm = (trackIdx: number) => {
    if (assigningSample && onAssignToTrack) {
      onAssignToTrack(trackIdx, assigningSample);
      setNotification(`Added ${assigningSample.name} to Track ${trackIdx + 1}! 🎵`);
      setAssigningSample(null);

      setTimeout(() => {
        setNotification(null);
      }, 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Explorer Header */}
      <div className="relative overflow-hidden rounded-3xl border-2 border-indigo-500/80 bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-6 shadow-2xl">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onTogglePlay && (
              <button
                onClick={onTogglePlay}
                className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 active:scale-95 ${
                  isPlaying
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.7)] ring-2 ring-emerald-300'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.5)] hover:scale-105'
                }`}
                title={isPlaying ? 'Pause' : 'Play Beat'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Square className="h-6 w-6 fill-slate-950" />
                ) : (
                  <Play className="h-6 w-6 fill-slate-950 translate-x-0.5" />
                )}
              </button>
            )}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 via-pink-500 to-indigo-500 text-3xl shadow-xl animate-bounce-sm">
              🧭
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Sound <span className="text-amber-400">Explorer</span>
                </h2>
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-amber-300 border border-amber-400/30">
                  {ALL_AVAILABLE_SAMPLES.length} Samples
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-300">
                Tap any sound to hear it instantly! Test different pitches and add your favorites to your beat!
              </p>
            </div>
          </div>

          {/* Global Pitch Modifier for Explorer testing */}
          <div className="flex items-center gap-2 rounded-2xl bg-slate-900/80 p-2 border border-slate-700">
            <span className="text-xs font-black uppercase tracking-wider text-slate-400 pl-1">
              Test Pitch:
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setSelectedPitch(0.7)}
                className={`rounded-xl px-2.5 py-1 text-xs font-black transition-all ${
                  selectedPitch === 0.7
                    ? 'bg-purple-500 text-white shadow-md scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                👾 Monster (Low)
              </button>
              <button
                onClick={() => setSelectedPitch(1.0)}
                className={`rounded-xl px-2.5 py-1 text-xs font-black transition-all ${
                  selectedPitch === 1.0
                    ? 'bg-pink-500 text-white shadow-md scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🧒 Normal
              </button>
              <button
                onClick={() => setSelectedPitch(1.5)}
                className={`rounded-xl px-2.5 py-1 text-xs font-black transition-all ${
                  selectedPitch === 1.5
                    ? 'bg-yellow-400 text-slate-950 shadow-md scale-105'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                🐿️ Chipmunk (High)
              </button>
            </div>
          </div>
        </div>

        {/* Ambient background stars */}
        <div className="pointer-events-none absolute -right-6 -bottom-6 text-8xl opacity-10">
          🎶
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 p-3.5 text-sm font-black text-emerald-300 shadow-lg animate-bounce-sm">
          <Check className="h-5 w-5 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as CategoryFilter)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/30 scale-102 ring-2 ring-pink-400/50'
                    : 'border border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500 hover:bg-slate-700/80 hover:text-white'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sounds or words..."
            className={`w-full rounded-2xl border py-2.5 pl-10 pr-8 text-xs sm:text-sm font-bold text-white placeholder-slate-400 focus:outline-none ${
              containsProfanity(searchQuery)
                ? 'border-rose-500 bg-rose-950/40 ring-2 ring-rose-500/30'
                : 'border-slate-700 bg-slate-800/90 focus:border-pink-500'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
          {containsProfanity(searchQuery) && (
            <div className="absolute left-0 -bottom-5 text-[10px] font-bold text-rose-400">
              Inappropriate search term blocked
            </div>
          )}
        </div>
      </div>

      {/* Grid of Sound Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {filteredSamples.map((sample) => {
          const isPlayingThis = activeSoundId === sample.id;

          return (
            <div
              key={sample.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border-2 transition-all duration-200 ${
                isPlayingThis
                  ? 'border-white bg-slate-800 scale-103 shadow-[0_0_30px_rgba(244,63,94,0.4)]'
                  : 'border-slate-700/90 bg-slate-800/80 hover:border-pink-400/80 hover:bg-slate-800 hover:shadow-xl'
              }`}
            >
              {/* Card Top / Header */}
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  {/* Big Chunky Sound Avatar (Click to Play) */}
                  <button
                    onClick={() => handlePlaySample(sample)}
                    className={`relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr ${
                      sample.color
                    } text-3xl shadow-lg transition-all active:scale-90 ${
                      isPlayingThis
                        ? 'scale-110 ring-4 ring-white animate-bounce-sm'
                        : 'group-hover:scale-105'
                    }`}
                    title="Tap to play sound!"
                  >
                    <span>{sample.icon}</span>

                    {/* Ripple ring animation when triggered */}
                    {isPlayingThis && (
                      <span className="absolute inset-0 rounded-2xl ring-4 ring-white animate-ping opacity-60" />
                    )}
                  </button>

                  {/* Fun tag pill */}
                  <span className="rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-black text-amber-300 border border-slate-700/80 shadow-xs">
                    {sample.funTag}
                  </span>
                </div>

                {/* Sound Name & Description */}
                <div className="mt-3">
                  <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors">
                    {sample.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-300">
                    {sample.description}
                  </p>
                </div>

                {/* Animated Waveform Bars */}
                <div className="mt-4 flex h-6 items-end gap-1 rounded-xl bg-slate-900/60 p-1.5 border border-slate-850">
                  {Array.from({ length: 12 }).map((_, barIdx) => {
                    const randomHeights = [20, 60, 100, 45, 80, 30, 90, 70, 40, 85, 55, 35];
                    const activeHeight = isPlayingThis ? randomHeights[barIdx] : 15;
                    return (
                      <div
                        key={barIdx}
                        className={`flex-1 rounded-full transition-all duration-150 ${
                          isPlayingThis
                            ? 'bg-gradient-to-t from-pink-500 to-yellow-400'
                            : 'bg-slate-700'
                        }`}
                        style={{ height: `${activeHeight}%` }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="border-t border-slate-700/80 bg-slate-900/60 p-3 flex items-center justify-between gap-2">
                {/* Big Play Button */}
                <button
                  onClick={() => handlePlaySample(sample)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs font-black transition-all active:scale-95 ${
                    isPlayingThis
                      ? 'bg-amber-400 text-slate-950 scale-102 font-black'
                      : 'bg-slate-800 text-slate-200 hover:bg-pink-500 hover:text-white'
                  }`}
                >
                  <Play className={`h-3.5 w-3.5 ${isPlayingThis ? 'fill-slate-950' : 'fill-current'}`} />
                  <span>{isPlayingThis ? 'Playing!' : 'Play Sample'}</span>
                </button>

                {/* Add To Beat Button */}
                {onAssignToTrack && (
                  <button
                    onClick={() => setAssigningSample(sample)}
                    className="flex items-center gap-1 rounded-xl bg-indigo-600/80 py-2 px-3 text-xs font-black text-indigo-100 hover:bg-indigo-500 hover:text-white transition-all active:scale-95"
                    title="Put into a track in your beat"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Add to Beat</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredSamples.length === 0 && (
        <div className="rounded-3xl border-2 border-slate-700 bg-slate-800/50 p-12 text-center">
          <div className="text-4xl">🔍</div>
          <h3 className="mt-3 text-lg font-black text-white">No sounds found!</h3>
          <p className="mt-1 text-sm font-semibold text-slate-400">
            Try searching for something else like "kick", "bell", "plop", or clear your search!
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
            className="mt-4 rounded-xl bg-pink-500 px-4 py-2 text-xs font-black text-white hover:bg-pink-400"
          >
            Show All Sounds
          </button>
        </div>
      )}

      {/* Track Assignment Modal */}
      {assigningSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl border-4 border-indigo-500 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-indigo-500 text-2xl shadow-lg">
                {assigningSample.icon}
              </div>
              <div>
                <h3 className="text-lg font-black text-white">
                  Add {assigningSample.name} to Beat
                </h3>
                <p className="text-xs font-semibold text-slate-300">
                  Which track row would you like to assign this sound to?
                </p>
              </div>
            </div>

            <div className="my-5 space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {trackNames.map((name, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAssignConfirm(idx)}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-800 p-3 text-left font-bold text-slate-200 transition-all hover:border-pink-400 hover:bg-slate-700 hover:text-white"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-xs font-black text-pink-300">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-black">{name}</span>
                  </div>
                  <span className="rounded-lg bg-indigo-500/30 px-2 py-0.5 text-xs font-bold text-indigo-300">
                    Replace
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssigningSample(null)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
