import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  ArrowLeft,
  Trophy,
  Zap,
  Sparkles,
  Flame,
  Shield,
  Mic,
  MicOff,
  Radio,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { StudentSession } from '../utils/classroomApi';
import {
  StaffClef,
  GameDifficulty,
  GameStatus,
  GameInputMode,
  InstrumentTransposition,
  ActiveNote,
  LaserBeam,
  ExplosionEffect,
  ScorePopup,
  Particle,
  NoteDefinition,
} from './types';
import {
  getAvailableNotes,
  getAllNotesForClef,
  getPresetMidiRange,
} from './data/staffNotes';
import { staffWarsAudio } from './audio/staffWarsAudio';
import { livePitchDetector, PitchDetectionResult } from './audio/pitchDetector';
import { SpaceCanvas } from './components/SpaceCanvas';

interface StaffWarsAppProps {
  onBackToHub: () => void;
  studentSession: StudentSession | null;
}

const CLEF_OPTIONS: { id: StaffClef; title: string; subtitle: string; icon: string }[] = [
  { id: 'treble', title: 'Treble Clef', subtitle: 'Flute, Violin, Piano RH & Voice', icon: '𝄞' },
  { id: 'bass', title: 'Bass Clef', subtitle: 'Cello, Bass, Tuba & Piano LH', icon: '𝄢' },
  { id: 'alto', title: 'Alto Clef', subtitle: 'Viola (Middle C on Line 3)', icon: '𝄡' },
  { id: 'tenor', title: 'Tenor Clef', subtitle: 'Upper Cello & Trombone', icon: '𝄡' },
  { id: 'grand', title: 'Grand Staff', subtitle: 'Treble + Bass Combined', icon: '𝄞/𝄢' },
];

const DIFFICULTY_OPTIONS: { id: GameDifficulty; title: string; badge: string; desc: string }[] = [
  { id: 'beginner', title: 'Cadet (Beginner)', badge: 'Lines & Spaces', desc: '5 Staff lines & 4 spaces only' },
  { id: 'intermediate', title: 'Pilot (Medium)', badge: 'Middle C + 1 Line', desc: 'Adds Middle C and 1 ledger line above/below' },
  { id: 'advanced', title: 'Jedi Master (Hard)', badge: 'Full Range', desc: 'Extended ledger lines for master readers' },
  { id: 'custom', title: 'Custom Range ⚙️', badge: 'Pick Any Range', desc: 'Set your own lowest & highest notes' },
];

const TRANSPOSITION_OPTIONS: { id: InstrumentTransposition; label: string; desc: string }[] = [
  { id: 'C', label: 'Concert Pitch (C)', desc: 'Flute, Oboe, Violin, Piano, Trombone, Mallets' },
  { id: 'Bb', label: 'B♭ Instruments', desc: 'Clarinet, Trumpet, Tenor Sax, Cornet' },
  { id: 'Eb', label: 'E♭ Instruments', desc: 'Alto Saxophone, Baritone Sax' },
  { id: 'F', label: 'F Instruments', desc: 'French Horn' },
];

const NOTE_LETTERS: ('A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G')[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

const SOLFEGE_MAP: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Ti',
};

export const StaffWarsApp: React.FC<StaffWarsAppProps> = ({
  onBackToHub,
  studentSession,
}) => {
  // Mission Setup State
  const [clef, setClef] = useState<StaffClef>('treble');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('beginner');
  const [useSolfege, setUseSolfege] = useState<boolean>(false);
  const [inputMode, setInputMode] = useState<GameInputMode>('buttons');
  const [transposition, setTransposition] = useState<InstrumentTransposition>('C');

  // Custom Range State
  const [customMinMidi, setCustomMinMidi] = useState<number>(64); // E4 default
  const [customMaxMidi, setCustomMaxMidi] = useState<number>(77); // F5 default

  // Audio Controls
  const [isMuted, setIsMuted] = useState<boolean>(() => staffWarsAudio.getMuted());
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(true);

  // Live Mic State
  const [micActive, setMicActive] = useState<boolean>(false);
  const [isRequestingMic, setIsRequestingMic] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [detectedPitch, setDetectedPitch] = useState<PitchDetectionResult | null>(null);

  // Game Status
  const [status, setStatus] = useState<GameStatus>('menu');
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [maxStreak, setMaxStreak] = useState<number>(0);
  const [notesHit, setNotesHit] = useState<number>(0);
  const [notesMissed, setNotesMissed] = useState<number>(0);
  // Student High Score key helper
  const getHighScoreKey = (session: StudentSession | null) => {
    return session?.id ? `staff_wars_high_score_${session.id}` : 'staff_wars_high_score';
  };

  const [highScore, setHighScore] = useState<number>(0);

  // Synchronize High Score with logged-in student or guest session
  useEffect(() => {
    try {
      const key = getHighScoreKey(studentSession);
      const saved = localStorage.getItem(key);
      setHighScore(saved ? parseInt(saved, 10) : 0);
    } catch {
      setHighScore(0);
    }
  }, [studentSession]);

  // Interactive Visuals
  const [activeNote, setActiveNote] = useState<ActiveNote | null>(null);
  const [lasers, setLasers] = useState<LaserBeam[]>([]);
  const [explosions, setExplosions] = useState<ExplosionEffect[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [isShieldShaking, setIsShieldShaking] = useState<boolean>(false);
  const [lastFeedback, setLastFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null);

  // Game Loop Refs
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const noteListRef = useRef<NoteDefinition[]>([]);
  const activeNoteRef = useRef<ActiveNote | null>(null);
  activeNoteRef.current = activeNote;

  // Initialize or update notes pool
  useEffect(() => {
    if (difficulty === 'custom') {
      noteListRef.current = getAvailableNotes(clef, 'custom', customMinMidi, customMaxMidi);
    } else {
      const range = getPresetMidiRange(clef, difficulty);
      setCustomMinMidi(range.minMidi);
      setCustomMaxMidi(range.maxMidi);
      noteListRef.current = getAvailableNotes(clef, difficulty);
    }
  }, [clef, difficulty, customMinMidi, customMaxMidi]);

  // Clean up audio & mic when exiting
  useEffect(() => {
    return () => {
      staffWarsAudio.stopMusic();
      livePitchDetector.stop();
    };
  }, []);

  // Toggle master sound effects
  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    staffWarsAudio.setMuted(next);
  };

  // Toggle background Star Wars music
  const toggleMusic = () => {
    const next = !isMusicEnabled;
    setIsMusicEnabled(next);
    staffWarsAudio.setMusicMuted(!next);
    if (next && !staffWarsAudio.isMusicPlaying()) {
      staffWarsAudio.startMusic();
    }
  };

  // Trigger Particle Explosion
  const triggerExplosion = useCallback((x: number, y: number) => {
    const particles: Particle[] = [];
    const colors = ['#fde047', '#fb923c', '#ef4444', '#38bdf8', '#ffffff'];

    for (let i = 0; i < 35; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 2.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 4.5 + 2,
        alpha: 1.0,
        life: 0,
        maxLife: Math.random() * 22 + 25,
      });
    }

    const explosion: ExplosionEffect = {
      id: 'exp_' + Math.random().toString(36).substring(2, 9),
      x,
      y,
      particles,
      ringRadius: 10,
      ringMaxRadius: 75,
      ringColor: '#fbbf24',
      createdAt: Date.now(),
    };

    setExplosions((prev) => [...prev, explosion]);
  }, []);

  // Spawn Next Note with progressive speed scaling
  const spawnNote = useCallback((currentLevel: number) => {
    const pool = noteListRef.current;
    if (pool.length === 0) return;

    let randomDef = pool[Math.floor(Math.random() * pool.length)];
    if (activeNoteRef.current && pool.length > 1) {
      while (
        randomDef.step === activeNoteRef.current.def.step &&
        randomDef.octave === activeNoteRef.current.def.octave
      ) {
        randomDef = pool[Math.floor(Math.random() * pool.length)];
      }
    }

    const baseSpeed = 14.0;
    const speed = baseSpeed + (currentLevel - 1) * 4.5;

    const newNote: ActiveNote = {
      id: 'note_' + Math.random().toString(36).substring(2, 9),
      def: randomDef,
      xPercent: 100,
      speedPercentPerSec: speed,
      clef: randomDef.clef,
      isHit: false,
      spawnTime: Date.now(),
    };

    setActiveNote(newNote);
  }, []);

  // Handle Note Collision with Clef / Shield (GUARANTEED 3 LIVES)
  const handleNoteMissed = useCallback(() => {
    staffWarsAudio.playShieldHit();
    setIsShieldShaking(true);
    setTimeout(() => setIsShieldShaking(false), 350);

    setStreak(0);
    setNotesMissed((prev) => prev + 1);

    if (activeNoteRef.current) {
      setLastFeedback({
        text: `Shield Damaged! That note was ${activeNoteRef.current.def.step}`,
        isCorrect: false,
      });
      // CRITICAL: Immediately mark note as hit so collision loop does not trigger repeatedly
      activeNoteRef.current.isHit = true;
    }
    setActiveNote((prev) => (prev ? { ...prev, isHit: true } : null));

    setLives((prevLives) => {
      const remaining = prevLives - 1;
      if (remaining <= 0) {
        setStatus('gameover');
        staffWarsAudio.playGameOver();
        livePitchDetector.stop();
        setMicActive(false);
        return 0;
      } else {
        setTimeout(() => {
          spawnNote(level);
        }, 450);
        return remaining;
      }
    });
  }, [level, spawnNote]);

  // Main Game Loop (Updates note position across staff)
  useEffect(() => {
    if (status !== 'playing') return;

    let animId: number;

    const loop = (time: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
      }
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      if (activeNoteRef.current && !activeNoteRef.current.isHit) {
        const nextX = activeNoteRef.current.xPercent - activeNoteRef.current.speedPercentPerSec * dt;

        // Collision threshold: note reaches the clef at 0%
        if (nextX <= 0) {
          activeNoteRef.current.isHit = true; // Guard immediately
          handleNoteMissed();
        } else {
          setActiveNote((prev) => (prev ? { ...prev, xPercent: nextX } : null));
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [status, handleNoteMissed]);

  // Handle Player Note Answer (from Buttons, Keyboard, or Live Mic)
  const handleAnswer = useCallback(
    (letter: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G') => {
      if (status !== 'playing' || !activeNote || activeNote.isHit) return;

      const targetStep = activeNote.def.step;
      const isCorrect = letter === targetStep;

      if (isCorrect) {
        // Direct Hit! Sized for 520px canvas
        const canvasWidth = 1000;
        const minNoteX = 95;
        const maxNoteX = canvasWidth - 45;
        const noteTargetX = minNoteX + (activeNote.xPercent / 100) * (maxNoteX - minNoteX);
        const middleY = 520 * 0.42;
        const staffLineSpacing = 28;
        const noteTargetY = middleY - activeNote.def.staffOffset * (staffLineSpacing * 0.5);

        // Add Laser Beam from spaceship at bottom straight to the note
        const shipY = 520 - 56;
        const laser: LaserBeam = {
          id: 'laser_' + Math.random().toString(36).substring(2, 9),
          startX: noteTargetX,
          startY: shipY - 26,
          targetX: noteTargetX,
          targetY: noteTargetY,
          color: '#22c55e',
          createdAt: Date.now(),
          durationMs: 140,
        };
        setLasers((prev) => [...prev, laser]);

        // Trigger Explosion & Sound FX
        staffWarsAudio.playLaser(true);
        setTimeout(() => {
          staffWarsAudio.playExplosion();
          staffWarsAudio.playNotePitch(activeNote.def.freq);
          triggerExplosion(noteTargetX, noteTargetY);
        }, 40);

        // Calculate score & streak
        const streakBonus = streak * 25;
        const pointsEarned = 100 + streakBonus;
        const newScore = score + pointsEarned;
        setScore(newScore);

        if (newScore > highScore) {
          setHighScore(newScore);
          try {
            const key = getHighScoreKey(studentSession);
            localStorage.setItem(key, String(newScore));

            // Record in student leaderboard map if logged in
            if (studentSession?.id) {
              const studentScoresKey = 'staff_wars_student_leaderboard';
              const existing = JSON.parse(localStorage.getItem(studentScoresKey) || '{}');
              existing[studentSession.id] = {
                studentId: studentSession.id,
                firstName: studentSession.firstName,
                classGroup: studentSession.classGroup,
                highScore: newScore,
                updatedAt: new Date().toISOString(),
              };
              localStorage.setItem(studentScoresKey, JSON.stringify(existing));
            }
          } catch {}
        }

        const newStreak = streak + 1;
        setStreak(newStreak);
        setMaxStreak((prev) => Math.max(prev, newStreak));
        setNotesHit((prev) => prev + 1);

        // Score popup
        const scorePopup: ScorePopup = {
          id: 'pop_' + Math.random().toString(36).substring(2, 9),
          x: noteTargetX,
          y: noteTargetY - 22,
          text: `+${pointsEarned}${newStreak >= 3 ? ' 🔥' : ''}`,
          color: newStreak >= 5 ? '#facc15' : '#38bdf8',
          createdAt: Date.now(),
        };
        setScorePopups((prev) => [...prev, scorePopup]);

        // Feedback banner
        setLastFeedback({
          text: `🎯 Direct Hit: ${targetStep}! (+${pointsEarned} PTS)`,
          isCorrect: true,
        });

        // Mark note as hit
        setActiveNote((prev) => (prev ? { ...prev, isHit: true } : null));

        // Level Up every 10 notes
        const totalHit = notesHit + 1;
        if (totalHit % 10 === 0) {
          const nextLvl = level + 1;
          setLevel(nextLvl);
          staffWarsAudio.playLevelUp();
          try {
            confetti({ particleCount: 65, spread: 75, origin: { y: 0.5 } });
          } catch {}
          setLastFeedback({
            text: `🚀 HYPERSPACE LEVEL ${nextLvl}! Notes are moving faster!`,
            isCorrect: true,
          });
        }

        // Spawn next note (faster delay on higher levels)
        const spawnDelay = Math.max(180, 320 - (level - 1) * 25);
        setTimeout(() => {
          spawnNote(level);
        }, spawnDelay);
      } else {
        // Wrong note!
        staffWarsAudio.playLaser(false);
        setIsShieldShaking(true);
        setTimeout(() => setIsShieldShaking(false), 240);

        setStreak(0);
        setNotesMissed((prev) => prev + 1);

        setLastFeedback({
          text: `Missed! You entered ${letter}, but target is ${targetStep}`,
          isCorrect: false,
        });
      }
    },
    [status, activeNote, streak, score, highScore, notesHit, level, triggerExplosion, spawnNote]
  );


  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;
  const lastMicTriggerRef = useRef<number>(0);
  const lastUiUpdateRef = useRef<number>(0);

  // Robust Live Mic Starter with graceful error and permission handling
  const startLiveMic = useCallback(async (): Promise<boolean> => {
    setIsRequestingMic(true);
    setMicError(null);
    try {
      const success = await livePitchDetector.start((result) => {
        const now = performance.now();
        if (now - lastUiUpdateRef.current > 75) {
          lastUiUpdateRef.current = now;
          setDetectedPitch(result);
        }

        if (result && result.writtenStep) {
          if (now - lastMicTriggerRef.current > 350) {
            if (activeNoteRef.current && !activeNoteRef.current.isHit) {
              if (result.writtenStep === activeNoteRef.current.def.step) {
                lastMicTriggerRef.current = now;
                handleAnswerRef.current(result.writtenStep);
              }
            }
          }
        }
      }, transposition);

      setMicActive(success);
      if (!success) {
        setMicError('Microphone permission blocked or not available in this browser.');
      }
      return success;
    } catch (err: any) {
      console.error('Failed to start live mic:', err);
      setMicActive(false);
      setMicError(err?.message || 'Microphone access failed');
      return false;
    } finally {
      setIsRequestingMic(false);
    }
  }, [transposition]);

  // Live Mic Pitch Detection Listener
  useEffect(() => {
    if (status !== 'playing' || inputMode !== 'mic') {
      if (status !== 'menu' || inputMode !== 'mic') {
        livePitchDetector.stop();
        setMicActive(false);
        setDetectedPitch(null);
      }
      return;
    }

    if (!micActive && !isRequestingMic) {
      startLiveMic();
    }
  }, [status, inputMode, micActive, isRequestingMic, startLiveMic]);

  // Start new game
  const startGame = async () => {
    // If in live mic mode and not yet active, request immediately within user click gesture
    if (inputMode === 'mic' && !micActive) {
      await startLiveMic();
    }
    setScore(0);
    setLives(3);
    setLevel(1);
    setStreak(0);
    setMaxStreak(0);
    setNotesHit(0);
    setNotesMissed(0);
    setLasers([]);
    setExplosions([]);
    setScorePopups([]);
    setLastFeedback(null);
    setStatus('playing');

    // Start background Star Wars music
    if (isMusicEnabled) {
      staffWarsAudio.startMusic();
    }

    spawnNote(1);
    lastTimeRef.current = performance.now();
  };

  // Keyboard shortcut listener for A, B, C, D, E, F, G and Spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toUpperCase();
      if (status === 'menu' && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        startGame();
      } else if (status === 'playing') {
        if (NOTE_LETTERS.includes(key as any)) {
          e.preventDefault();
          handleAnswer(key as any);
        }
      } else if (status === 'gameover' && (e.code === 'Space' || e.key === 'Enter')) {
        e.preventDefault();
        startGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleAnswer]);

  const allNotes = getAllNotesForClef(clef);

  return (
    <div className="min-h-screen bg-[#050714] text-white flex flex-col font-['Fredoka',sans-serif] select-none">
      {/* Top Galactic Header */}
      <header className="px-4 sm:px-6 py-3.5 bg-slate-950/90 border-b border-amber-500/30 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              staffWarsAudio.stopMusic();
              livePitchDetector.stop();
              onBackToHub();
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-black transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Music Lab Home</span>
          </button>

          <div className="flex items-center gap-2.5">
            <img
              src="/staff-wars/logo.png"
              alt="Staff Wars"
              className="w-8 h-8 rounded-lg object-cover border border-amber-400/50 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
            />
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wider text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] leading-none">
                STAFF WARS
              </h1>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 block font-mono mt-0.5">
                {inputMode === 'mic' ? 'Live Instrument Edition 🎤' : 'Galactic Note Defense 🚀'}
              </span>
            </div>
          </div>
        </div>

        {/* Header Badges & Audio Controls */}
        <div className="flex items-center gap-2.5">
          {studentSession && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-xs text-indigo-300">
              <span>🚀 Cadet:</span>
              <span className="font-black text-white">{studentSession.firstName}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-amber-300">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono font-bold">BEST: {highScore.toLocaleString()}</span>
          </div>

          {/* Music Toggle */}
          <button
            type="button"
            onClick={toggleMusic}
            className={`p-2 rounded-xl border cursor-pointer transition-colors ${
              isMusicEnabled
                ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.3)]'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={isMusicEnabled ? 'Music: ON' : 'Music: OFF'}
          >
            <Music className="w-4 h-4" />
          </button>

          {/* SFX Mute Toggle */}
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 cursor-pointer transition-colors"
            title={isMuted ? 'Unmute SFX' : 'Mute SFX'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* Main Content Area (Enlarged Globally) */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-5 flex flex-col justify-center">
        {/* 1. MISSION SETUP / MENU SCREEN */}
        {status === 'menu' && (
          <div className="max-w-3xl mx-auto w-full bg-slate-900/95 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(251,191,36,0.18)] animate-in fade-in zoom-in-95 duration-200 space-y-6 text-center">
            {/* Title Logo Image */}
            <div className="flex flex-col items-center">
              <img
                src="/staff-wars/logo.png"
                alt="Staff Wars"
                className="w-full max-w-[340px] sm:max-w-[400px] rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.3)] border border-amber-400/40 object-contain hover:scale-102 transition-transform duration-300"
              />
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mt-3">
                Enemy musical notes are flying toward the staff! Name the note or play it on your instrument to fire your starfighter lasers!
              </p>
            </div>

            {/* Input Mode Selector: Buttons vs Live Mic */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                1. Select Gameplay Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setInputMode('buttons')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    inputMode === 'buttons'
                      ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-lg font-black'
                      : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⌨️</span>
                    <span className="font-extrabold text-sm text-white">Keyboard & Buttons</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click buttons or press keys A through G to blast notes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setInputMode('mic')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    inputMode === 'mic'
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] font-black'
                      : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎤</span>
                    <span className="font-extrabold text-sm text-white">Live Microphone (Star Wars Live)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Play your acoustic instrument into the mic to shoot lasers!
                  </p>
                </button>
              </div>
            </div>

            {/* Instrument Transposition (Only in Mic Mode) */}
            {inputMode === 'mic' && (
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 text-left space-y-2.5">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                    Instrument Tuning & Transposition:
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {TRANSPOSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTransposition(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        transposition === opt.id
                          ? 'bg-cyan-400 text-slate-950 font-black border-cyan-300 shadow-md'
                          : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-black">{opt.label}</div>
                      <div
                        className={`text-[10px] truncate ${
                          transposition === opt.id ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Live Mic Test & Permission */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 gap-3 text-xs mt-2">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        micActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50'
                          : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-white block">
                        {micActive ? 'Microphone Active & Ready' : 'Microphone Permission'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {micActive
                          ? detectedPitch
                            ? `Heard note: ${detectedPitch.writtenNoteName} (${detectedPitch.frequency.toFixed(0)} Hz)`
                            : 'Listening... Play your instrument to test!'
                          : micError
                          ? micError
                          : 'Click to grant browser microphone permission'}
                      </span>
                    </div>
                  </div>

                  {!micActive ? (
                    <button
                      type="button"
                      onClick={() => startLiveMic()}
                      disabled={isRequestingMic}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black text-xs transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
                    >
                      {isRequestingMic ? 'Connecting...' : '🎙️ Test & Allow Microphone'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Ready
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Clef Selection */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                2. Choose Your Clef:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {CLEF_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setClef(opt.id)}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      clef === opt.id
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-lg scale-102 font-black'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    <div className="text-3xl leading-none">{opt.icon}</div>
                    <div className="text-xs font-bold mt-1 truncate">{opt.title}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty & Range Selection */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                3. Note Range & Difficulty:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DIFFICULTY_OPTIONS.map((diff) => (
                  <button
                    key={diff.id}
                    type="button"
                    onClick={() => setDifficulty(diff.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      difficulty === diff.id
                        ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-md font-bold'
                        : 'bg-slate-950/80 hover:bg-slate-800 text-slate-400 border-slate-800'
                    }`}
                  >
                    <div className="font-extrabold text-xs text-white truncate">{diff.title}</div>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{diff.desc}</p>
                  </button>
                ))}
              </div>

              {/* Custom Lowest & Highest Note Selectors */}
              {difficulty === 'custom' && (
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-sky-400/50 space-y-3 mt-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-sky-300">
                      Configure Note Range Boundaries:
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Lowest Note:
                      </label>
                      <select
                        value={customMinMidi}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCustomMinMidi(val);
                          if (val > customMaxMidi) setCustomMaxMidi(val);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-sky-400"
                      >
                        {allNotes.map((n) => (
                          <option key={'min_' + n.midi} value={n.midi}>
                            {n.displayName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-300 block mb-1">
                        Highest Note:
                      </label>
                      <select
                        value={customMaxMidi}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCustomMaxMidi(val);
                          if (val < customMinMidi) setCustomMinMidi(val);
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-sky-400"
                      >
                        {allNotes.map((n) => (
                          <option key={'max_' + n.midi} value={n.midi}>
                            {n.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Currently spawning {noteListRef.current.length} unique pitches within this range.
                  </p>
                </div>
              )}
            </div>

            {/* Note Naming Style: Letters vs Solfege (in button mode) */}
            {inputMode === 'buttons' && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
                <div>
                  <span className="font-bold text-white">Button Naming Style:</span>
                  <p className="text-[11px] text-slate-400">Switch between letter names and vocal Solfege</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700">
                  <button
                    type="button"
                    onClick={() => setUseSolfege(false)}
                    className={`px-3 py-1 rounded-lg font-black transition-colors ${
                      !useSolfege ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    A - B - C
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseSolfege(true)}
                    className={`px-3 py-1 rounded-lg font-black transition-colors ${
                      useSolfege ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Do - Re - Mi
                  </button>
                </div>
              </div>
            )}

            {/* Launch Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={startGame}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-xl sm:text-2xl shadow-xl shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer tracking-wider"
              >
                <Play className="w-7 h-7 fill-current" />
                <span>LAUNCH MISSION (Spacebar)</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. GAMEPLAY SCREEN */}
        {status === 'playing' && (
          <div className="space-y-4">
            {/* HUD Status Bar */}
            <div className="grid grid-cols-3 items-center px-4 py-3 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
              {/* Shield / Lives */}
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider">
                  Shield:
                </span>
                <div className="flex items-center gap-1.5 text-lg">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <span
                      key={idx}
                      className={`transition-all duration-300 ${
                        idx < lives
                          ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                          : 'text-slate-700 grayscale opacity-40'
                      }`}
                    >
                      🚀
                    </span>
                  ))}
                </div>
              </div>

              {/* Level & Speed Escalation */}
              <div className="flex flex-col items-center">
                <span className="text-[10px] uppercase font-bold text-sky-400 tracking-widest font-mono">
                  HYPERSPACE LEVEL {level}
                </span>
                <div className="flex items-center gap-1 text-xs text-slate-300 font-bold">
                  <span>Speed:</span>
                  <span className="text-amber-400 font-mono">
                    {Math.round(14 + (level - 1) * 4.5)}% / sec
                  </span>
                </div>
              </div>

              {/* Score & Streak */}
              <div className="flex items-center justify-end gap-3">
                {streak >= 2 && (
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black animate-pulse">
                    <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>{streak}x</span>
                  </div>
                )}
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                    SCORE
                  </span>
                  <span className="text-lg font-black font-mono text-amber-400 leading-none">
                    {score.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Space Canvas with Extended Staff, Crisp Clef, Spaceship & Lasers */}
            <SpaceCanvas
              clef={clef}
              activeNote={activeNote}
              lasers={lasers}
              explosions={explosions}
              scorePopups={scorePopups}
              isShieldShaking={isShieldShaking}
              lives={lives}
            />

            {/* LIVE MICROPHONE HUD TUNER (When in Mic Mode) */}
            {inputMode === 'mic' && (
              <div className="p-4 rounded-2xl bg-cyan-950/40 border-2 border-cyan-400/50 shadow-[0_0_25px_rgba(6,182,212,0.25)] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-3 rounded-xl border ${
                      detectedPitch
                        ? 'bg-cyan-400 text-slate-950 border-cyan-300 animate-pulse'
                        : 'bg-slate-900 text-cyan-400 border-cyan-700'
                    }`}
                  >
                    <Mic className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-cyan-300 uppercase tracking-wider">
                        Live Pitch Detector ({transposition} Instrument):
                      </span>
                      {micActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 animate-pulse">
                          ● LISTENING
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startLiveMic()}
                          disabled={isRequestingMic}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-lg transition-all cursor-pointer animate-bounce"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>{isRequestingMic ? 'Connecting...' : 'Click to Allow Microphone'}</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Play the note shown on the staff. When in tune, your starfighter will fire!
                    </p>
                  </div>
                </div>

                {/* Pitch Reading & Cents Tuning Gauge */}
                <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-xl border border-cyan-500/30">
                  <div>
                    <span className="text-[10px] uppercase text-slate-400 block font-mono">
                      HEARD PITCH
                    </span>
                    <span
                      className={`text-2xl font-black font-mono ${
                        detectedPitch && activeNote && detectedPitch.writtenStep === activeNote.def.step
                          ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                          : detectedPitch
                          ? 'text-cyan-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {detectedPitch ? detectedPitch.writtenNoteName : '--'}
                    </span>
                  </div>

                  {detectedPitch && (
                    <div className="text-left font-mono text-[10px]">
                      <div className="text-slate-400">
                        Tune: {detectedPitch.cents > 0 ? `+${detectedPitch.cents}` : detectedPitch.cents}¢
                      </div>
                      <div className="text-slate-400">
                        {Math.round(detectedPitch.frequency)} Hz
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FEEDBACK BANNER */}
            <div className="min-h-[28px] text-center">
              {lastFeedback && (
                <span
                  className={`inline-block px-4 py-1 rounded-xl text-xs sm:text-sm font-black border transition-all animate-in fade-in duration-150 ${
                    lastFeedback.isCorrect
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                      : 'bg-rose-500/20 border-rose-400 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                  }`}
                >
                  {lastFeedback.text}
                </span>
              )}
            </div>

            {/* ARCADE BUTTONS INPUT (When in Buttons Mode - Enlarged) */}
            {inputMode === 'buttons' && (
              <div className="grid grid-cols-7 gap-2 sm:gap-3.5 pt-1">
                {NOTE_LETTERS.map((letter) => {
                  const label = useSolfege ? SOLFEGE_MAP[letter] : letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => handleAnswer(letter)}
                      className="py-5 sm:py-6 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-amber-400 hover:to-yellow-500 text-slate-100 hover:text-slate-950 border-2 border-slate-700 hover:border-amber-300 font-black text-2xl sm:text-3xl shadow-xl active:scale-95 transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 group"
                    >
                      <span className="tracking-wider group-hover:scale-110 transition-transform">
                        {label}
                      </span>
                      <span className="text-[11px] text-slate-400 group-hover:text-slate-900 font-mono font-bold">
                        [{letter}]
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 3. GAME OVER SCREEN */}
        {status === 'gameover' && (
          <div className="max-w-md mx-auto w-full bg-slate-900/95 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(244,63,94,0.25)] animate-in fade-in zoom-in-95 duration-200 space-y-6 text-center">
            <div className="space-y-2">
              <span className="text-4xl block">💥</span>
              <h2 className="text-3xl font-black text-rose-400 tracking-wider">
                MISSION FAILED
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                The note bypassed your defenses! Great attempt, Cadet.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Final Score:</span>
                <span className="font-mono font-black text-amber-400 text-xl">
                  {score.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Max Hyperspace Level:</span>
                <span className="font-mono font-bold text-sky-400">{level}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Notes Blasted:</span>
                <span className="font-mono font-bold text-emerald-400">{notesHit}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Best Combo Streak:</span>
                <span className="font-mono font-bold text-amber-400">{maxStreak}🔥</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={startGame}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-lg shadow-xl shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>PLAY AGAIN (Spacebar)</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('menu')}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 cursor-pointer transition-colors"
              >
                Change Clef or Settings
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
