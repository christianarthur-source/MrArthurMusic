import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  RotateCcw,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  Flame,
  HelpCircle,
  Play,
  Pause,
  Swords,
} from 'lucide-react';
import {
  playLaserSound,
  playExplosionSound,
  playShieldDamageSound,
  playMusicNote,
  noteToFreq,
  getToolboxAudioContext,
} from './toolboxAudio';
import { Pitch } from '../../types/music';

export type StaffWarsClef = 'treble' | 'bass' | 'alto';
export type StaffWarsDifficulty = 'cadet' | 'commander' | 'master';

interface TargetNote {
  id: string;
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  staffOffset: number; // 0 = bottom line (Line 1), 1 = Space 1, 2 = Line 2, 3 = Space 2, 4 = Line 3, etc.
  posX: number; // 0 to 100 (% of staff width)
  hasLedgerLine?: boolean;
  ledgerPositions?: number[]; // staffOffsets that need ledger lines
}

// Staff layout definitions per clef:
// staffOffset 0 = bottom staff line (Line 1)
// staffOffset 2 = Line 2
// staffOffset 4 = Line 3
// staffOffset 6 = Line 4
// staffOffset 8 = Line 5 (top staff line)
// staffOffset -2 = Ledger line below Line 1
// staffOffset 10 = Ledger line above Line 5

const TREBLE_NOTES: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  // Below staff
  { step: 'C', octave: 4, staffOffset: -2 }, // Middle C (ledger line)
  { step: 'D', octave: 4, staffOffset: -1 }, // Space below
  // On staff
  { step: 'E', octave: 4, staffOffset: 0 },  // Line 1
  { step: 'F', octave: 4, staffOffset: 1 },  // Space 1
  { step: 'G', octave: 4, staffOffset: 2 },  // Line 2
  { step: 'A', octave: 4, staffOffset: 3 },  // Space 2
  { step: 'B', octave: 4, staffOffset: 4 },  // Line 3
  { step: 'C', octave: 5, staffOffset: 5 },  // Space 3
  { step: 'D', octave: 5, staffOffset: 6 },  // Line 4
  { step: 'E', octave: 5, staffOffset: 7 },  // Space 4
  { step: 'F', octave: 5, staffOffset: 8 },  // Line 5
  // Above staff
  { step: 'G', octave: 5, staffOffset: 9 },  // Space above
  { step: 'A', octave: 5, staffOffset: 10 }, // Ledger line above
];

const BASS_NOTES: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  // Below staff
  { step: 'E', octave: 2, staffOffset: -2 }, // Ledger line below
  { step: 'F', octave: 2, staffOffset: -1 }, // Space below
  // On staff
  { step: 'G', octave: 2, staffOffset: 0 },  // Line 1
  { step: 'A', octave: 2, staffOffset: 1 },  // Space 1
  { step: 'B', octave: 2, staffOffset: 2 },  // Line 2
  { step: 'C', octave: 3, staffOffset: 3 },  // Space 2
  { step: 'D', octave: 3, staffOffset: 4 },  // Line 3
  { step: 'E', octave: 3, staffOffset: 5 },  // Space 3
  { step: 'F', octave: 3, staffOffset: 6 },  // Line 4
  { step: 'G', octave: 3, staffOffset: 7 },  // Space 4
  { step: 'A', octave: 3, staffOffset: 8 },  // Line 5
  // Above staff
  { step: 'B', octave: 3, staffOffset: 9 },  // Space above
  { step: 'C', octave: 4, staffOffset: 10 }, // Middle C (ledger line above)
];

const ALTO_NOTES: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  { step: 'D', octave: 3, staffOffset: -2 },
  { step: 'E', octave: 3, staffOffset: -1 },
  { step: 'F', octave: 3, staffOffset: 0 },  // Line 1
  { step: 'G', octave: 3, staffOffset: 1 },  // Space 1
  { step: 'A', octave: 3, staffOffset: 2 },  // Line 2
  { step: 'B', octave: 3, staffOffset: 3 },  // Space 2
  { step: 'C', octave: 4, staffOffset: 4 },  // Line 3 (Middle C)
  { step: 'D', octave: 4, staffOffset: 5 },  // Space 3
  { step: 'E', octave: 4, staffOffset: 6 },  // Line 4
  { step: 'F', octave: 4, staffOffset: 7 },  // Space 4
  { step: 'G', octave: 4, staffOffset: 8 },  // Line 5
  { step: 'A', octave: 4, staffOffset: 9 },
  { step: 'B', octave: 4, staffOffset: 10 },
];

export const StaffWarsReprise: React.FC = () => {
  const [clef, setClef] = useState<StaffWarsClef>('treble');
  const [difficulty, setDifficulty] = useState<StaffWarsDifficulty>('cadet');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [shields, setShields] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('mr_arthur_staff_wars_highscore') || 0);
    } catch {
      return 0;
    }
  });
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [activeNote, setActiveNote] = useState<TargetNote | null>(null);
  const [laserEffect, setLaserEffect] = useState<{ active: boolean; targetY: number } | null>(null);
  const [explosionEffect, setExplosionEffect] = useState<{ active: boolean; x: number; y: number } | null>(null);
  const [screenShake, setScreenShake] = useState<boolean>(false);

  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Available notes filtered by difficulty
  const getNotePool = useCallback(() => {
    let pool = TREBLE_NOTES;
    if (clef === 'bass') pool = BASS_NOTES;
    if (clef === 'alto') pool = ALTO_NOTES;

    if (difficulty === 'cadet') {
      // Line 1 to Line 5 only (offsets 0 to 8)
      return pool.filter((n) => n.staffOffset >= 0 && n.staffOffset <= 8);
    }
    // Commander & Master include ledger lines (-2 to 10)
    return pool;
  }, [clef, difficulty]);

  // Spawn a new note on the far left
  const spawnNote = useCallback(() => {
    const pool = getNotePool();
    const candidate = pool[Math.floor(Math.random() * pool.length)];

    const ledgers: number[] = [];
    if (candidate.staffOffset <= -2) {
      for (let o = -2; o >= candidate.staffOffset; o -= 2) ledgers.push(o);
    }
    if (candidate.staffOffset >= 10) {
      for (let o = 10; o <= candidate.staffOffset; o += 2) ledgers.push(o);
    }

    const newTarget: TargetNote = {
      id: 'note-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      step: candidate.step,
      octave: candidate.octave,
      staffOffset: candidate.staffOffset,
      posX: 16, // Start just after the clef (~16% across staff)
      hasLedgerLine: ledgers.length > 0,
      ledgerPositions: ledgers,
    };

    setActiveNote(newTarget);
  }, [getNotePool]);

  // Start / Restart Game
  const handleStartGame = () => {
    setShields(3);
    setScore(0);
    setLevel(1);
    setStreak(0);
    setIsGameOver(false);
    setIsPlaying(true);
    spawnNote();
    getToolboxAudioContext().catch(() => {});
  };

  // Main animation frame game loop: moves active note left to right
  useEffect(() => {
    if (!isPlaying || isGameOver) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }

    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const delta = (timestamp - lastTimestamp) / 1000;
      lastTimestamp = timestamp;

      // Speed increases with level and difficulty
      const baseSpeed = difficulty === 'cadet' ? 12 : difficulty === 'commander' ? 17 : 24;
      const speed = baseSpeed + (level - 1) * 3; // % per second

      setActiveNote((prev) => {
        if (!prev) return null;

        const nextX = prev.posX + speed * delta;

        // Check if note hit the shield boundary (at 92%)
        if (nextX >= 92) {
          // MISSED! Note hit the barrier
          playShieldDamageSound();
          setScreenShake(true);
          setTimeout(() => setScreenShake(false), 300);

          setShields((s) => {
            const nextShields = s - 1;
            if (nextShields <= 0) {
              setIsGameOver(true);
              setIsPlaying(false);
            }
            return nextShields;
          });

          setStreak(0);
          // Spawn next note after short delay
          setTimeout(spawnNote, 400);
          return null;
        }

        return { ...prev, posX: nextX };
      });

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [isPlaying, isGameOver, level, difficulty, spawnNote]);

  // Handle note guess (via button click or physical keyboard)
  const handleNoteGuess = useCallback(
    (guessedLetter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B') => {
      if (!isPlaying || isGameOver || !activeNote) return;

      if (guessedLetter === activeNote.step) {
        // CORRECT GUESS!
        // 1. Fire laser & play sounds
        playLaserSound(noteToFreq(activeNote.step, activeNote.octave));
        playExplosionSound();
        playMusicNote({ step: activeNote.step, octave: activeNote.octave }, 'piano', 0.5);

        // 2. Visual laser & explosion
        setLaserEffect({ active: true, targetY: activeNote.staffOffset });
        setExplosionEffect({ active: true, x: activeNote.posX, y: activeNote.staffOffset });

        setTimeout(() => setLaserEffect(null), 180);
        setTimeout(() => setExplosionEffect(null), 300);

        // 3. Points & streak
        // More points if blasted early (farther left)
        const earlyBonus = Math.max(10, Math.floor((92 - activeNote.posX) * 2));
        const streakBonus = Math.min(5, streak + 1);
        const earnedPoints = (100 + earlyBonus) * streakBonus;

        setScore((prev) => {
          const newScore = prev + earnedPoints;
          if (newScore > highScore) {
            setHighScore(newScore);
            try {
              localStorage.setItem('mr_arthur_staff_wars_highscore', String(newScore));
            } catch {}
          }
          return newScore;
        });

        setStreak((s) => {
          const nextStreak = s + 1;
          // Level up every 6 correct notes
          if (nextStreak % 6 === 0) {
            setLevel((l) => l + 1);
          }
          return nextStreak;
        });

        // 4. Spawn next note
        setActiveNote(null);
        setTimeout(spawnNote, 350);
      } else {
        // WRONG NOTE GUESS - Penalty: lose streak
        playShieldDamageSound();
        setStreak(0);
      }
    },
    [isPlaying, isGameOver, activeNote, streak, highScore, spawnNote]
  );

  // Keyboard shortcut listener (letters A-G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || isGameOver) return;
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(key)) {
        e.preventDefault();
        handleNoteGuess(key as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isGameOver, handleNoteGuess]);

  // Helper to convert staffOffset to vertical % in the staff box
  // Staff lines are offsets 0, 2, 4, 6, 8
  // We place offset 4 (Line 3, center) at 50%
  // Line spacing = 9% per offset (4.5% per step)
  const offsetToTopPercent = (offset: number): number => {
    // offset 4 is center = 50%
    // higher offset = higher pitch = smaller top %
    return 50 - (offset - 4) * 5.8;
  };

  return (
    <div className="space-y-4 select-none font-['Fredoka',sans-serif]">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg ring-2 ring-cyan-400/40">
            ⚔️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Staff Wars Reprise!</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40">
                Arcade Note Reading Battle
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Type or click the note name before the space note hits your defense shield!
            </p>
          </div>
        </div>

        {/* Stats & High Score Badge */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-slate-400">High: </span>
              <span className="font-black text-amber-400">{highScore}</span>
            </div>
          </div>

          {isPlaying && (
            <button
              type="button"
              onClick={() => setIsPlaying(false)}
              className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Pause Game"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Control Strip: Clef & Difficulty Selectors */}
      <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Clef Selection */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1">Clef:</span>
          {[
            { id: 'treble', label: '𝄞 Treble Clef' },
            { id: 'bass', label: '𝄢 Bass Clef' },
            { id: 'alto', label: '𝄡 Alto Clef' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={isPlaying}
              onClick={() => setClef(c.id as StaffWarsClef)}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                clef === c.id
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Difficulty Selection */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1">Speed:</span>
          {[
            { id: 'cadet', label: 'Cadet (Lines & Spaces)' },
            { id: 'commander', label: '+ Ledgers' },
            { id: 'master', label: 'Hyperdrive 🚀' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              disabled={isPlaying}
              onClick={() => setDifficulty(d.id as StaffWarsDifficulty)}
              className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                difficulty === d.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Arcade Battle Staff Arena */}
      <div
        className={`relative w-full h-72 sm:h-80 rounded-3xl bg-slate-950 border-3 border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col justify-between transition-transform duration-100 ${
          screenShake ? 'scale-98 ring-4 ring-rose-500 translate-x-1 -translate-y-1' : ''
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.1) 0%, rgba(15, 23, 42, 0.95) 100%)',
        }}
      >
        {/* Animated Warp Stars in Background */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/5 w-1 h-1 bg-white rounded-full animate-ping" />
          <div className="absolute top-3/4 left-2/3 w-1.5 h-1.5 bg-cyan-300 rounded-full" />
          <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-amber-300 rounded-full animate-pulse" />
          <div className="absolute top-2/3 left-1/4 w-1 h-1 bg-white rounded-full" />
        </div>

        {/* HUD Overlay: Shields, Level, Score, Streak */}
        <div className="relative z-20 px-5 py-3 flex items-center justify-between text-white border-b border-cyan-500/20 bg-slate-950/60 backdrop-blur-xs">
          {/* Shields */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Shields:
            </span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((shieldNum) => (
                <div
                  key={shieldNum}
                  className={`w-7 h-5 rounded-md flex items-center justify-center transition-all ${
                    shields >= shieldNum
                      ? 'bg-cyan-400 shadow-md shadow-cyan-400/50 text-slate-950 text-xs'
                      : 'bg-slate-800/80 border border-slate-700 opacity-40'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 fill-current" />
                </div>
              ))}
            </div>
          </div>

          {/* Level & Streak */}
          <div className="flex items-center gap-4">
            <div className="text-xs text-cyan-300 font-mono">
              LEVEL <span className="font-black text-white text-sm">{level}</span>
            </div>

            {streak > 1 && (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black animate-pulse">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{streak}x Combo!</span>
              </div>
            )}
          </div>

          {/* Current Score */}
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Score</div>
            <div className="text-lg font-black text-amber-400 leading-none">{score}</div>
          </div>
        </div>

        {/* =========================================================================
            MUSICAL STAFF LINES & FLYING NOTE ARENA
            ========================================================================= */}
        <div className="relative flex-1 w-full flex items-center">
          {/* 5 Staff Lines: Line 1 (bottom), 2, 3, 4, 5 (top) */}
          <div className="absolute inset-x-0 w-full pointer-events-none">
            {[8, 6, 4, 2, 0].map((offset) => {
              const topPos = offsetToTopPercent(offset);
              return (
                <div
                  key={offset}
                  style={{ top: `${topPos}%` }}
                  className="absolute inset-x-0 h-0.5 bg-cyan-400/70 shadow-xs shadow-cyan-400/50"
                />
              );
            })}
          </div>

          {/* Clef Glyph on the Left */}
          <div className="absolute left-6 text-6xl text-cyan-300 pointer-events-none font-serif leading-none drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
            {clef === 'treble' ? '𝄞' : clef === 'bass' ? '𝄢' : '𝄡'}
          </div>

          {/* Right-Hand Defense Shield Boundary Line */}
          <div className="absolute right-8 inset-y-4 w-1 bg-gradient-to-b from-cyan-400 via-rose-500 to-cyan-400 shadow-[0_0_15px_rgba(244,63,94,0.8)] flex items-center justify-center">
            <div className="absolute -top-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase tracking-wider animate-pulse">
              Barrier
            </div>
          </div>

          {/* ACTIVE MOVING NOTE */}
          {activeNote && isPlaying && !isGameOver && (
            <div
              style={{
                left: `${activeNote.posX}%`,
                top: `${offsetToTopPercent(activeNote.staffOffset)}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-30 transition-all duration-75 flex items-center justify-center pointer-events-none"
            >
              {/* Optional Ledger Lines */}
              {activeNote.hasLedgerLine &&
                activeNote.ledgerPositions?.map((ledgerOffset) => (
                  <div
                    key={ledgerOffset}
                    style={{
                      top: `${(ledgerOffset - activeNote.staffOffset) * -5.8}px`,
                    }}
                    className="absolute w-10 h-0.5 bg-cyan-300 shadow-xs shadow-cyan-300/80"
                  />
                ))}

              {/* Glowing Notehead / Alien Spacecraft */}
              <div className="relative w-8 h-6 rounded-full bg-gradient-to-r from-amber-300 via-rose-400 to-amber-300 border-2 border-white shadow-[0_0_16px_rgba(251,191,36,0.9)] transform -rotate-20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white shadow-xs" />
              </div>

              {/* Note Stem */}
              <div
                style={{
                  top: activeNote.staffOffset >= 4 ? '12px' : '-28px',
                  right: activeNote.staffOffset >= 4 ? '26px' : '2px',
                }}
                className="absolute w-0.5 h-7 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
              />
            </div>
          )}

          {/* Laser Blast Animation */}
          {laserEffect?.active && (
            <div
              style={{
                top: `${offsetToTopPercent(laserEffect.targetY)}%`,
              }}
              className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-300 to-white shadow-[0_0_20px_#38BDF8] z-40 animate-out fade-out duration-150"
            />
          )}

          {/* Explosion Particle Burst */}
          {explosionEffect?.active && (
            <div
              style={{
                left: `${explosionEffect.x}%`,
                top: `${offsetToTopPercent(explosionEffect.y)}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-50 text-4xl animate-ping pointer-events-none"
            >
              💥
            </div>
          )}

          {/* Start Screen / Game Over Screen Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-6 text-center space-y-4">
              {isGameOver ? (
                <div className="space-y-3 animate-in zoom-in-95">
                  <div className="text-5xl">💥</div>
                  <h4 className="text-2xl sm:text-3xl font-black text-rose-400">
                    Defenses Breached! Game Over
                  </h4>
                  <p className="text-xs text-slate-300 font-sans max-w-sm mx-auto">
                    Final Score:{' '}
                    <span className="text-amber-400 font-black text-base">{score}</span> • Level{' '}
                    <span className="text-white font-bold">{level}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Play Again 🚀
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-w-md animate-in fade-in">
                  <div className="text-5xl">🛸</div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white">
                    Defend the Musical Staff!
                  </h4>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    Notes fly across the staff towards your barrier. Press keys{' '}
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold">
                      A - G
                    </span>{' '}
                    on your keyboard or click the buttons below to blast them before they reach the
                    shield!
                  </p>
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-slate-950 font-black text-base shadow-xl shadow-cyan-400/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Launch Mission! ⚡
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note Controls: [ C ] [ D ] [ E ] [ F ] [ G ] [ A ] [ B ] */}
        <div className="relative z-20 px-4 py-3 bg-slate-950/80 border-t border-cyan-500/30 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline shrink-0">
            Click or Press Key:
          </span>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 flex-1 max-w-xl mx-auto">
            {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((noteLetter) => (
              <button
                key={noteLetter}
                type="button"
                disabled={!isPlaying || isGameOver}
                onClick={() => handleNoteGuess(noteLetter)}
                className="py-3 sm:py-3.5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-cyan-500 hover:to-blue-600 active:from-cyan-400 active:to-blue-500 text-white font-black text-base sm:text-lg border border-slate-700 hover:border-cyan-300 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-none"
              >
                <span>{noteLetter}</span>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5 hidden sm:inline">
                  [{noteLetter}]
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
