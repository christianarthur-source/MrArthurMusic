import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Dices,
  Volume2,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  playMusicNote,
  getToolboxAudioContext,
  noteToFreq,
  playMatchChime,
  playCardFlipSound,
} from './toolboxAudio';

// Sound Blocks for Little Kids (K-2)
export interface SoundBlockDef {
  id: string;
  name: string;
  emoji: string;
  bgGradient: string;
  borderClass: string;
  category: 'mood' | 'beat' | 'instrument' | 'fx';
  description: string;
}

export const SOUND_BLOCKS: SoundBlockDef[] = [
  // --- Moods / Feelings ---
  {
    id: 'mood-sunny',
    name: 'Sunny',
    emoji: '☀️',
    bgGradient: 'from-amber-400 to-yellow-500',
    borderClass: 'border-amber-300',
    category: 'mood',
    description: 'Happy & bright!',
  },
  {
    id: 'mood-party',
    name: 'Party',
    emoji: '🎉',
    bgGradient: 'from-fuchsia-500 to-pink-500',
    borderClass: 'border-fuchsia-300',
    category: 'mood',
    description: 'Dance time!',
  },
  {
    id: 'mood-cozy',
    name: 'Cozy',
    emoji: '🌙',
    bgGradient: 'from-indigo-400 to-blue-500',
    borderClass: 'border-indigo-300',
    category: 'mood',
    description: 'Calm & gentle',
  },
  {
    id: 'mood-spooky',
    name: 'Spooky',
    emoji: '🎃',
    bgGradient: 'from-purple-600 to-violet-800',
    borderClass: 'border-purple-400',
    category: 'mood',
    description: 'Sneaky mystery!',
  },
  {
    id: 'mood-hero',
    name: 'Hero',
    emoji: '⚡',
    bgGradient: 'from-red-500 to-orange-500',
    borderClass: 'border-red-300',
    category: 'mood',
    description: 'Super strong!',
  },

  // --- Beats & Drums ---
  {
    id: 'beat-boom',
    name: 'Boom',
    emoji: '🥁',
    bgGradient: 'from-orange-500 to-amber-600',
    borderClass: 'border-orange-300',
    category: 'beat',
    description: 'Bass drum thump',
  },
  {
    id: 'beat-clap',
    name: 'Clap',
    emoji: '👏',
    bgGradient: 'from-teal-400 to-emerald-500',
    borderClass: 'border-teal-300',
    category: 'beat',
    description: 'Hands clapping',
  },
  {
    id: 'beat-robot',
    name: 'Robot',
    emoji: '🤖',
    bgGradient: 'from-cyan-500 to-blue-600',
    borderClass: 'border-cyan-300',
    category: 'beat',
    description: 'Beep boop beat',
  },
  {
    id: 'beat-train',
    name: 'Train',
    emoji: '🚂',
    bgGradient: 'from-lime-500 to-green-600',
    borderClass: 'border-lime-300',
    category: 'beat',
    description: 'Chugga chugga',
  },

  // --- Melody Instruments ---
  {
    id: 'inst-piano',
    name: 'Piano',
    emoji: '🎹',
    bgGradient: 'from-sky-400 to-indigo-500',
    borderClass: 'border-sky-300',
    category: 'instrument',
    description: 'Sweet piano keys',
  },
  {
    id: 'inst-cat',
    name: 'Kitty',
    emoji: '🐱',
    bgGradient: 'from-pink-400 to-rose-500',
    borderClass: 'border-pink-300',
    category: 'instrument',
    description: 'Meow meow high pitch',
  },
  {
    id: 'inst-frog',
    name: 'Froggy',
    emoji: '🐸',
    bgGradient: 'from-emerald-400 to-green-600',
    borderClass: 'border-emerald-300',
    category: 'instrument',
    description: 'Ribbit low notes',
  },
  {
    id: 'inst-bells',
    name: 'Bells',
    emoji: '🔔',
    bgGradient: 'from-yellow-300 to-amber-500',
    borderClass: 'border-yellow-200',
    category: 'instrument',
    description: 'Sparkly chimes',
  },
  {
    id: 'inst-xylophone',
    name: 'Rainbow',
    emoji: '🌈',
    bgGradient: 'from-rose-400 via-amber-300 to-sky-400',
    borderClass: 'border-amber-200',
    category: 'instrument',
    description: 'Wooden rainbow bars',
  },

  // --- Fun Sound FX ---
  {
    id: 'fx-sparkle',
    name: 'Sparkle',
    emoji: '✨',
    bgGradient: 'from-amber-300 to-pink-400',
    borderClass: 'border-amber-200',
    category: 'fx',
    description: 'Magic glitter dust',
  },
  {
    id: 'fx-rocket',
    name: 'Zoom',
    emoji: '🚀',
    bgGradient: 'from-red-500 to-purple-600',
    borderClass: 'border-red-300',
    category: 'fx',
    description: 'Blast off sound!',
  },
];

// Presets that toddlers/kindergarteners can pick in 1 tap
const FUN_PRESETS: { name: string; emoji: string; blockIds: string[] }[] = [
  {
    name: 'Sunny Day',
    emoji: '☀️',
    blockIds: ['mood-sunny', 'beat-boom', 'inst-piano', 'fx-sparkle', 'beat-clap', 'inst-xylophone'],
  },
  {
    name: 'Dance Party',
    emoji: '🎉',
    blockIds: ['mood-party', 'beat-boom', 'beat-clap', 'inst-bells', 'beat-robot', 'fx-rocket'],
  },
  {
    name: 'Animal Band',
    emoji: '🦁',
    blockIds: ['inst-cat', 'beat-boom', 'inst-frog', 'beat-clap', 'inst-xylophone', 'fx-sparkle'],
  },
  {
    name: 'Space Mystery',
    emoji: '🛸',
    blockIds: ['mood-spooky', 'beat-robot', 'inst-bells', 'beat-boom', 'fx-rocket', 'inst-piano'],
  },
];

export const SongStarter: React.FC = () => {
  // Kid song timeline: exactly 6 slots in the song box
  const [songSlots, setSongSlots] = useState<(string | null)[]>([
    'mood-sunny',
    'beat-boom',
    'inst-piano',
    'beat-clap',
    'inst-cat',
    'fx-sparkle',
  ]);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePlaySlot, setActivePlaySlot] = useState<number>(-1);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  // Play audio for a block
  const playBlockAudio = useCallback(async (blockId: string, stepNumber: number = 0) => {
    const ctx = await getToolboxAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (blockId) {
      // Moods: gentle chord swell
      case 'mood-sunny':
        playMusicNote({ step: 'C', octave: 4 }, 'piano', 0.8);
        playMusicNote({ step: 'E', octave: 4 }, 'piano', 0.8);
        playMusicNote({ step: 'G', octave: 4 }, 'piano', 0.8);
        break;
      case 'mood-party':
        playMusicNote({ step: 'F', octave: 4 }, 'marimba', 0.4);
        playMusicNote({ step: 'A', octave: 4 }, 'marimba', 0.4);
        playMusicNote({ step: 'C', octave: 5 }, 'marimba', 0.4);
        break;
      case 'mood-cozy':
        playMusicNote({ step: 'A', octave: 3 }, 'flute', 1.0);
        playMusicNote({ step: 'E', octave: 4 }, 'flute', 1.0);
        break;
      case 'mood-spooky':
        playMusicNote({ step: 'D', octave: 4 }, 'glockenspiel', 0.9);
        playMusicNote({ step: 'F', octave: 4 }, 'glockenspiel', 0.9);
        break;
      case 'mood-hero':
        playMusicNote({ step: 'G', octave: 3 }, 'trumpet', 0.6);
        playMusicNote({ step: 'D', octave: 4 }, 'trumpet', 0.6);
        playMusicNote({ step: 'G', octave: 4 }, 'trumpet', 0.6);
        break;

      // Beats
      case 'beat-boom': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case 'beat-clap': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      }
      case 'beat-robot': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(440 + (stepNumber % 3) * 110, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }
      case 'beat-train': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      }

      // Instruments
      case 'inst-piano': {
        const pitches: ('C' | 'D' | 'E' | 'G' | 'A')[] = ['C', 'E', 'G', 'A'];
        const p = pitches[stepNumber % pitches.length];
        playMusicNote({ step: p, octave: 4 }, 'piano', 0.6);
        break;
      }
      case 'inst-cat': {
        // High playful note
        const catPitches: ('E' | 'G' | 'A' | 'C')[] = ['G', 'A', 'C', 'E'];
        const cp = catPitches[stepNumber % catPitches.length];
        playMusicNote({ step: cp, octave: 5 }, 'flute', 0.4);
        break;
      }
      case 'inst-frog': {
        // Low bouncy pitch
        const frogPitches: ('C' | 'D' | 'E' | 'G')[] = ['C', 'D', 'E', 'D'];
        const fp = frogPitches[stepNumber % frogPitches.length];
        playMusicNote({ step: fp, octave: 3 }, 'marimba', 0.5);
        break;
      }
      case 'inst-bells': {
        playMusicNote({ step: 'C', octave: 6 }, 'glockenspiel', 0.8);
        break;
      }
      case 'inst-xylophone': {
        const xyloPitches: ('C' | 'D' | 'E' | 'G' | 'A')[] = ['C', 'D', 'E', 'G', 'A'];
        const xp = xyloPitches[stepNumber % xyloPitches.length];
        playMusicNote({ step: xp, octave: 5 }, 'xylophone', 0.35);
        break;
      }

      // FX
      case 'fx-sparkle': {
        playMatchChime();
        break;
      }
      case 'fx-rocket': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.42);
        break;
      }

      default:
        playCardFlipSound();
        break;
    }
  }, []);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setActivePlaySlot(-1);
      return;
    }

    const intervalMs = 600; // Kid-friendly comfortable tempo (~100 BPM)

    timerRef.current = window.setInterval(() => {
      setActivePlaySlot((prev) => {
        const next = (prev + 1) % songSlots.length;
        const blockId = songSlots[next];
        if (blockId) {
          playBlockAudio(blockId, next);
        }
        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, songSlots, playBlockAudio]);

  // Click on a sound block: places into first empty slot or last slot
  const handleTapBlock = (blockId: string) => {
    playBlockAudio(blockId);
    setSongSlots((prev) => {
      const emptyIdx = prev.findIndex((s) => s === null);
      if (emptyIdx !== -1) {
        const updated = [...prev];
        updated[emptyIdx] = blockId;
        return updated;
      }
      // If full, wrap around replacing active or first
      const updated = [...prev];
      updated[updated.length - 1] = blockId;
      return updated;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (blockId: string) => {
    setDraggedBlockId(blockId);
  };

  const handleDropOnSlot = (slotIdx: number) => {
    if (!draggedBlockId) return;
    setSongSlots((prev) => {
      const updated = [...prev];
      updated[slotIdx] = draggedBlockId;
      return updated;
    });
    playBlockAudio(draggedBlockId);
    setDraggedBlockId(null);
  };

  const handleClearSlot = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSongSlots((prev) => {
      const updated = [...prev];
      updated[slotIdx] = null;
      return updated;
    });
  };

  const handleRandomizeSong = () => {
    const randomSlots = Array.from({ length: 6 }, () => {
      const randomBlock = SOUND_BLOCKS[Math.floor(Math.random() * SOUND_BLOCKS.length)];
      return randomBlock.id;
    });
    setSongSlots(randomSlots);
    playMatchChime();
  };

  const handleClearAll = () => {
    setSongSlots([null, null, null, null, null, null]);
    setIsPlaying(false);
  };

  const handleLoadPreset = (preset: typeof FUN_PRESETS[0]) => {
    setSongSlots([...preset.blockIds]);
    playMatchChime();
  };

  return (
    <div className="space-y-6 select-none font-['Fredoka',sans-serif] text-slate-100 pb-4">
      {/* ----------------------------------------------------
          TOP HEADER: BIG, BOLD, FRIENDLY
          ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-sky-500/20 p-4 sm:p-5 rounded-3xl border-3 border-amber-400/50 shadow-xl">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-400 to-sky-400 flex items-center justify-center text-4xl shadow-lg ring-4 ring-amber-300/40 animate-bounce">
            🎶
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide">
              Song Starter!
            </h2>
            <p className="text-sm font-bold text-amber-300 mt-0.5">
              Drag sound blocks to build your song! 🎨
            </p>
          </div>
        </div>

        {/* Big Giant Play / Stop Button */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => {
              getToolboxAudioContext().catch(() => {});
              setIsPlaying(!isPlaying);
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-3 px-8 py-4 rounded-3xl font-black text-xl sm:text-2xl shadow-2xl transition-all cursor-pointer transform active:scale-95 ${
              isPlaying
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-6 ring-amber-400/30'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 hover:brightness-110 ring-6 ring-emerald-400/30 hover:scale-105'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-7 h-7 fill-current" />
                <span>Stop</span>
              </>
            ) : (
              <>
                <Play className="w-7 h-7 fill-current" />
                <span>Play Song! 🚀</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------
          THE BIG SONG BOX (DAW FOR KINDERGARTENERS)
          ---------------------------------------------------- */}
      <div className="bg-slate-950 p-5 sm:p-6 rounded-3xl border-4 border-sky-400/60 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span className="text-lg sm:text-xl font-black text-sky-300">
              My Song Box
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRandomizeSong}
              className="px-3.5 py-1.5 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-400/40 text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Dices className="w-4 h-4" />
              <span>Surprise Song 🎲</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              title="Clear Song Box"
            >
              Clear ✕
            </button>
          </div>
        </div>

        {/* 6 Giant Drop Slots */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {songSlots.map((blockId, idx) => {
            const blockDef = SOUND_BLOCKS.find((b) => b.id === blockId);
            const isCurrentBeat = isPlaying && activePlaySlot === idx;

            return (
              <div
                key={idx}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnSlot(idx)}
                onClick={() => {
                  if (blockId) playBlockAudio(blockId, idx);
                }}
                className={`relative min-h-[140px] sm:min-h-[160px] rounded-3xl border-4 flex flex-col items-center justify-center p-3 text-center transition-all duration-200 cursor-pointer select-none ${
                  isCurrentBeat
                    ? 'border-yellow-300 bg-amber-400/30 scale-108 shadow-2xl shadow-amber-400/40 ring-4 ring-yellow-300'
                    : blockDef
                    ? `border-white/80 bg-gradient-to-br ${blockDef.bgGradient} shadow-lg hover:scale-103`
                    : 'border-dashed border-slate-800 bg-slate-900/60 hover:border-sky-400/60 hover:bg-slate-900'
                }`}
              >
                {/* Step number badge */}
                <span className="absolute top-2 left-2.5 px-2 py-0.5 rounded-full bg-slate-950/60 text-white font-mono font-black text-[10px]">
                  #{idx + 1}
                </span>

                {blockDef ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handleClearSlot(idx, e)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-950/60 hover:bg-rose-500 text-white flex items-center justify-center text-xs font-black transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                    <span className="text-5xl sm:text-6xl mb-1 filter drop-shadow-md">
                      {blockDef.emoji}
                    </span>
                    <span className="font-black text-base sm:text-lg text-slate-950 bg-white/85 px-2.5 py-0.5 rounded-xl shadow-xs leading-tight">
                      {blockDef.name}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 space-y-1">
                    <Plus className="w-8 h-8 opacity-40" />
                    <span className="text-xs font-black uppercase tracking-wider opacity-60">
                      Drop Here
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------
          1-TAP PRESETS FOR QUICK FUN
          ---------------------------------------------------- */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-black text-amber-300 shrink-0">
          Try a Song:
        </span>
        {FUN_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handleLoadPreset(preset)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 text-white font-black text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer active:scale-95"
          >
            <span>{preset.emoji}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------
          SOUND BLOCKS PALETTE: DRAGGABLE & CLICKABLE
          ---------------------------------------------------- */}
      <div className="bg-slate-900/90 p-5 rounded-3xl border-2 border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>Pick Your Sound Blocks!</span>
              <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/40">
                Tap or Drag
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Click any block to hear it and add it to your song!
            </p>
          </div>
        </div>

        {/* Blocks Grid with Big Images and Bright Gradients */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {SOUND_BLOCKS.map((block) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => handleDragStart(block.id)}
              onClick={() => handleTapBlock(block.id)}
              className={`p-3 rounded-2xl border-2 ${block.borderClass} bg-gradient-to-br ${block.bgGradient} flex flex-col items-center justify-center text-center cursor-pointer shadow-lg hover:scale-108 active:scale-95 transition-all select-none group min-h-[105px]`}
            >
              <span className="text-4xl group-hover:scale-115 transition-transform filter drop-shadow-sm">
                {block.emoji}
              </span>
              <span className="font-black text-xs sm:text-sm text-slate-950 bg-white/90 px-2 py-0.5 rounded-lg shadow-xs mt-1.5 leading-none">
                {block.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
