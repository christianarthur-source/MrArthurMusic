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

// ----------------------------------------------------
// ACCOMPANYING BEAT PRESETS ("BEATS!")
// ----------------------------------------------------
export interface AccompanyingBeat {
  id: string;
  name: string;
  emoji: string;
  bgGradient: string;
  borderColor: string;
  description: string;
  kickBeats: number[]; // e.g. [0, 2, 4]
  snareBeats: number[]; // e.g. [1, 3, 5]
  hihatBeats: number[]; // e.g. [0, 1, 2, 3, 4, 5]
  bassNoteFreqs?: number[];
}

export const ACCOMPANYING_BEATS: AccompanyingBeat[] = [
  {
    id: 'beat-none',
    name: 'Quiet Beat',
    emoji: '🤫',
    bgGradient: 'from-slate-800 to-slate-900',
    borderColor: 'border-slate-700',
    description: 'No drums, just sounds',
    kickBeats: [],
    snareBeats: [],
    hihatBeats: [],
  },
  {
    id: 'beat-pop',
    name: 'Sunny Pop',
    emoji: '☀️',
    bgGradient: 'from-amber-400 to-orange-500',
    borderColor: 'border-amber-300',
    description: 'Happy boom-clap bounce',
    kickBeats: [0, 2, 4],
    snareBeats: [1, 3, 5],
    hihatBeats: [0, 1, 2, 3, 4, 5],
    bassNoteFreqs: [130.81, 130.81, 164.81, 164.81, 196.0, 196.0], // C3, E3, G3
  },
  {
    id: 'beat-dance',
    name: 'Disco Party',
    emoji: '🎉',
    bgGradient: 'from-fuchsia-500 to-pink-500',
    borderColor: 'border-fuchsia-300',
    description: 'Fast 4-on-the-floor groove',
    kickBeats: [0, 1, 2, 3, 4, 5],
    snareBeats: [1, 3, 5],
    hihatBeats: [0, 1, 2, 3, 4, 5],
    bassNoteFreqs: [110.0, 130.81, 146.83, 110.0, 164.81, 196.0],
  },
  {
    id: 'beat-robot',
    name: 'Robot Funk',
    emoji: '🤖',
    bgGradient: 'from-cyan-500 to-blue-600',
    borderColor: 'border-cyan-300',
    description: 'Blippy space electro',
    kickBeats: [0, 3],
    snareBeats: [2, 5],
    hihatBeats: [1, 3, 4],
    bassNoteFreqs: [98.0, 110.0, 146.83, 98.0, 130.81, 146.83],
  },
  {
    id: 'beat-train',
    name: 'Chugga Train',
    emoji: '🚂',
    bgGradient: 'from-lime-400 to-emerald-600',
    borderColor: 'border-lime-300',
    description: 'Rocking train chug',
    kickBeats: [0, 1, 2, 3, 4, 5],
    snareBeats: [0, 2, 4],
    hihatBeats: [1, 3, 5],
    bassNoteFreqs: [130.81, 146.83, 164.81, 130.81, 146.83, 196.0],
  },
];

// ----------------------------------------------------
// SOUND BLOCKS FOR LITTLE KIDS (K-2)
// ----------------------------------------------------
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
  // --- Moods / Feelings (Warm chords and textures) ---
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
    description: 'High happy pitch',
  },
  {
    id: 'inst-frog',
    name: 'Froggy',
    emoji: '🐸',
    bgGradient: 'from-emerald-400 to-green-600',
    borderClass: 'border-emerald-300',
    category: 'instrument',
    description: 'Low bouncy pitch',
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

// Multi-Track Track Definition
interface TrackLaneMeta {
  id: string;
  title: string;
  emoji: string;
  accentColor: string;
  tagColor: string;
}

const TRACK_LANES: TrackLaneMeta[] = [
  {
    id: 'lane-1',
    title: 'Track 1: Melody Stars',
    emoji: '⭐',
    accentColor: 'border-amber-400/50 bg-amber-950/20',
    tagColor: 'bg-amber-400 text-slate-950',
  },
  {
    id: 'lane-2',
    title: 'Track 2: Fun Sounds',
    emoji: '🎨',
    accentColor: 'border-pink-400/50 bg-pink-950/20',
    tagColor: 'bg-pink-400 text-slate-950',
  },
  {
    id: 'lane-3',
    title: 'Track 3: Rhythm & Beats',
    emoji: '🥁',
    accentColor: 'border-cyan-400/50 bg-cyan-950/20',
    tagColor: 'bg-cyan-400 text-slate-950',
  },
];

export const SongStarter: React.FC = () => {
  // 3 Multi-track Lines (6 slots each)
  const [tracks, setTracks] = useState<(string | null)[][]>([
    // Track 1 (Melody)
    ['inst-piano', 'inst-cat', 'inst-xylophone', 'inst-cat', 'inst-piano', 'fx-sparkle'],
    // Track 2 (Fun Sounds / Mood)
    ['mood-sunny', null, 'inst-bells', null, 'mood-party', 'fx-rocket'],
    // Track 3 (Rhythm / Drums)
    ['beat-boom', 'beat-clap', 'beat-boom', 'beat-clap', 'beat-boom', 'beat-clap'],
  ]);

  // Selected Accompanying Beat ("Beats!" option)
  const [selectedBeatId, setSelectedBeatId] = useState<string>('beat-pop');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePlaySlot, setActivePlaySlot] = useState<number>(-1);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);

  // Play audio for an individual block
  const playBlockAudio = useCallback(async (blockId: string, stepNumber: number = 0) => {
    const ctx = await getToolboxAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    switch (blockId) {
      // Moods: warm chords
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
        const catPitches: ('E' | 'G' | 'A' | 'C')[] = ['G', 'A', 'C', 'E'];
        const cp = catPitches[stepNumber % catPitches.length];
        playMusicNote({ step: cp, octave: 5 }, 'flute', 0.4);
        break;
      }
      case 'inst-frog': {
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

  // Play backing drums/bass for the active accompanying beat
  const playAccompanyingBeatStep = useCallback(
    async (stepIndex: number, beat: AccompanyingBeat) => {
      if (beat.id === 'beat-none') return;
      const ctx = await getToolboxAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Bass Note (if provided)
      if (beat.bassNoteFreqs && beat.bassNoteFreqs[stepIndex]) {
        const freq = beat.bassNoteFreqs[stepIndex];
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(freq, now);
        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.38);
      }

      // 2. Kick Drum
      if (beat.kickBeats.includes(stepIndex)) {
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.15);
        kickGain.gain.setValueAtTime(0.28, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.18);
      }

      // 3. Snare / Clap
      if (beat.snareBeats.includes(stepIndex)) {
        const snareOsc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareOsc.type = 'triangle';
        snareOsc.frequency.setValueAtTime(280, now);
        snareGain.gain.setValueAtTime(0.2, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        snareOsc.connect(snareGain);
        snareGain.connect(ctx.destination);
        snareOsc.start(now);
        snareOsc.stop(now + 0.12);
      }

      // 4. Hi-Hat tick
      if (beat.hihatBeats.includes(stepIndex)) {
        const hatOsc = ctx.createOscillator();
        const hatGain = ctx.createGain();
        hatOsc.type = 'highpass' as any;
        hatOsc.frequency.setValueAtTime(4500, now);
        hatGain.gain.setValueAtTime(0.06, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        hatOsc.connect(hatGain);
        hatGain.connect(ctx.destination);
        hatOsc.start(now);
        hatOsc.stop(now + 0.05);
      }
    },
    []
  );

  // Playback Loop: advances all 3 tracks simultaneously
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setActivePlaySlot(-1);
      return;
    }

    const intervalMs = 600; // Kid-friendly comfortable tempo (~100 BPM)
    const activeBeatDef = ACCOMPANYING_BEATS.find((b) => b.id === selectedBeatId) || ACCOMPANYING_BEATS[1];

    timerRef.current = window.setInterval(() => {
      setActivePlaySlot((prev) => {
        const next = (prev + 1) % 6;

        // 1. Play the accompanying beat
        playAccompanyingBeatStep(next, activeBeatDef);

        // 2. Play all blocks in this column across Track 1, 2, and 3
        tracks.forEach((lane) => {
          const blockId = lane[next];
          if (blockId) {
            playBlockAudio(blockId, next);
          }
        });

        return next;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, tracks, selectedBeatId, playBlockAudio, playAccompanyingBeatStep]);

  // Click on a sound block: places into first empty slot in Track 1, 2, or 3
  const handleTapBlock = (blockId: string) => {
    playBlockAudio(blockId);
    setTracks((prev) => {
      const updated = prev.map((lane) => [...lane]);
      // Find first empty slot in lane 0, then 1, then 2
      for (let l = 0; l < updated.length; l++) {
        const emptyIdx = updated[l].findIndex((s) => s === null);
        if (emptyIdx !== -1) {
          updated[l][emptyIdx] = blockId;
          return updated;
        }
      }
      // If completely full, overwrite last slot in track 1
      updated[0][updated[0].length - 1] = blockId;
      return updated;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (blockId: string) => {
    setDraggedBlockId(blockId);
  };

  const handleDropOnSlot = (laneIdx: number, slotIdx: number) => {
    if (!draggedBlockId) return;
    setTracks((prev) => {
      const updated = prev.map((lane) => [...lane]);
      updated[laneIdx][slotIdx] = draggedBlockId;
      return updated;
    });
    playBlockAudio(draggedBlockId);
    setDraggedBlockId(null);
  };

  const handleClearSlot = (laneIdx: number, slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTracks((prev) => {
      const updated = prev.map((lane) => [...lane]);
      updated[laneIdx][slotIdx] = null;
      return updated;
    });
  };

  const handleClearTrack = (laneIdx: number) => {
    setTracks((prev) => {
      const updated = prev.map((lane, idx) =>
        idx === laneIdx ? [null, null, null, null, null, null] : [...lane]
      );
      return updated;
    });
  };

  const handleClearAll = () => {
    setTracks([
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
      [null, null, null, null, null, null],
    ]);
    setIsPlaying(false);
  };

  const handleRandomizeSong = () => {
    const randomLanes = tracks.map(() =>
      Array.from({ length: 6 }, () => {
        // 75% chance of block, 25% empty
        if (Math.random() < 0.25) return null;
        const randomBlock = SOUND_BLOCKS[Math.floor(Math.random() * SOUND_BLOCKS.length)];
        return randomBlock.id;
      })
    );
    // Make sure at least first beat of track 1 has a sound
    if (!randomLanes[0][0]) randomLanes[0][0] = 'inst-piano';
    setTracks(randomLanes);
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
              Multi-Track DAW for Kindergarteners! 🎨
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
          "BEATS!" PICK AN ACCOMPANYING BEAT
          ---------------------------------------------------- */}
      <div className="bg-slate-900/90 p-4 rounded-3xl border-2 border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥁</span>
            <span className="text-base sm:text-lg font-black text-amber-300">
              Beats! (Pick Background Rhythm)
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">
            Plays with all tracks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {ACCOMPANYING_BEATS.map((beat) => {
            const isSelected = selectedBeatId === beat.id;
            return (
              <button
                key={beat.id}
                type="button"
                onClick={() => {
                  setSelectedBeatId(beat.id);
                  playAccompanyingBeatStep(0, beat);
                }}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  isSelected
                    ? 'border-white bg-gradient-to-br ' + beat.bgGradient + ' text-slate-950 shadow-xl scale-103 ring-4 ring-white/40'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-white'
                }`}
              >
                <span className="text-3xl">{beat.emoji}</span>
                <div>
                  <div className="font-black text-sm leading-tight">{beat.name}</div>
                  <div
                    className={`text-[10px] leading-none mt-0.5 ${
                      isSelected ? 'text-slate-950/80 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {beat.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ----------------------------------------------------
          THE MULTI-TRACK SONG BOX (3 LANES)
          ---------------------------------------------------- */}
      <div className="bg-slate-950 p-4 sm:p-6 rounded-3xl border-4 border-sky-400/60 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <span className="text-lg sm:text-xl font-black text-sky-300">
              My Song Box (3 Lines)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRandomizeSong}
              className="px-3.5 py-1.5 rounded-2xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border-2 border-purple-400/40 text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Dices className="w-4 h-4" />
              <span>Surprise Mix 🎲</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              title="Clear All Tracks"
            >
              Clear All ✕
            </button>
          </div>
        </div>

        {/* 3 Track Lanes */}
        <div className="space-y-4">
          {TRACK_LANES.map((laneMeta, laneIdx) => {
            const laneSlots = tracks[laneIdx];

            return (
              <div
                key={laneMeta.id}
                className={`p-3 sm:p-4 rounded-3xl border-2 ${laneMeta.accentColor} space-y-2`}
              >
                {/* Lane Header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{laneMeta.emoji}</span>
                    <span className="text-xs sm:text-sm font-black text-white">
                      {laneMeta.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClearTrack(laneIdx)}
                    className="text-[10px] text-slate-400 hover:text-rose-300 font-bold px-2 py-0.5 rounded-lg hover:bg-slate-800/80 transition-colors"
                  >
                    Clear line ✕
                  </button>
                </div>

                {/* 6 Giant Drop Slots per line */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 sm:gap-3">
                  {laneSlots.map((blockId, slotIdx) => {
                    const blockDef = SOUND_BLOCKS.find((b) => b.id === blockId);
                    const isCurrentBeat = isPlaying && activePlaySlot === slotIdx;

                    return (
                      <div
                        key={slotIdx}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropOnSlot(laneIdx, slotIdx)}
                        onClick={() => {
                          if (blockId) playBlockAudio(blockId, slotIdx);
                        }}
                        className={`relative min-h-[110px] sm:min-h-[125px] rounded-2xl border-3 flex flex-col items-center justify-center p-2 text-center transition-all duration-150 cursor-pointer select-none ${
                          isCurrentBeat
                            ? 'border-yellow-300 bg-amber-400/35 scale-105 shadow-xl shadow-amber-400/40 ring-4 ring-yellow-300'
                            : blockDef
                            ? `border-white/80 bg-gradient-to-br ${blockDef.bgGradient} shadow-md hover:scale-103`
                            : 'border-dashed border-slate-800 bg-slate-900/60 hover:border-sky-400/60 hover:bg-slate-900'
                        }`}
                      >
                        {/* Step number badge */}
                        <span className="absolute top-1.5 left-2 px-1.5 py-0.2 rounded-full bg-slate-950/60 text-white font-mono font-black text-[9px]">
                          #{slotIdx + 1}
                        </span>

                        {blockDef ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleClearSlot(laneIdx, slotIdx, e)}
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-slate-950/60 hover:bg-rose-500 text-white flex items-center justify-center text-[10px] font-black transition-colors"
                              title="Remove"
                            >
                              ✕
                            </button>
                            <span className="text-4xl sm:text-5xl mb-0.5 filter drop-shadow-md">
                              {blockDef.emoji}
                            </span>
                            <span className="font-black text-xs sm:text-sm text-slate-950 bg-white/90 px-2 py-0.2 rounded-md shadow-xs leading-tight">
                              {blockDef.name}
                            </span>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-600 space-y-0.5">
                            <Plus className="w-6 h-6 opacity-40" />
                            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                              Drop Sound
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
                Tap or Drag to Any Line
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Drag sounds to Track 1, 2, or 3 to hear them play together!
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
