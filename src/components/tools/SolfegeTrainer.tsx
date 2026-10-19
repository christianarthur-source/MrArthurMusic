import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sparkles, Volume2, Trophy, RotateCcw, Play, CheckCircle2, XCircle } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import { Pitch } from '../../types/music';

interface SolfegeNote {
  syllable: string;
  handSignName: string;
  handEmoji: string;
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  octave: number;
  keyNum: string;
  color: string;
  textColor: string;
  borderGlow: string;
  description: string;
}

const SOLFEGE_SCALE: SolfegeNote[] = [
  {
    syllable: 'Do',
    handSignName: 'Fist at Waist',
    handEmoji: '✊',
    step: 'C',
    octave: 4,
    keyNum: '1',
    color: '#EF4444',
    textColor: 'text-red-400',
    borderGlow: 'hover:shadow-red-500/40 border-red-500/50',
    description: 'Home tone / Tonic note',
  },
  {
    syllable: 'Re',
    handSignName: 'Slanted Palm Up',
    handEmoji: '✋',
    step: 'D',
    octave: 4,
    keyNum: '2',
    color: '#F97316',
    textColor: 'text-orange-400',
    borderGlow: 'hover:shadow-orange-500/40 border-orange-500/50',
    description: 'Stepping upward to the 2nd',
  },
  {
    syllable: 'Mi',
    handSignName: 'Flat Palm Down',
    handEmoji: '🫱',
    step: 'E',
    octave: 4,
    keyNum: '3',
    color: '#EAB308',
    textColor: 'text-yellow-400',
    borderGlow: 'hover:shadow-yellow-500/40 border-yellow-500/50',
    description: 'Bright major 3rd',
  },
  {
    syllable: 'Fa',
    handSignName: 'Thumbs Down',
    handEmoji: '👎',
    step: 'F',
    octave: 4,
    keyNum: '4',
    color: '#22C55E',
    textColor: 'text-emerald-400',
    borderGlow: 'hover:shadow-emerald-500/40 border-emerald-500/50',
    description: '4th scale step pointing to Mi',
  },
  {
    syllable: 'Sol',
    handSignName: 'Palm Facing In',
    handEmoji: '🫲',
    step: 'G',
    octave: 4,
    keyNum: '5',
    color: '#06B6D4',
    textColor: 'text-cyan-400',
    borderGlow: 'hover:shadow-cyan-500/40 border-cyan-500/50',
    description: 'Dominant 5th pitch',
  },
  {
    syllable: 'La',
    handSignName: 'Curved Palm Down',
    handEmoji: '🫳',
    step: 'A',
    octave: 4,
    keyNum: '6',
    color: '#3B82F6',
    textColor: 'text-blue-400',
    borderGlow: 'hover:shadow-blue-500/40 border-blue-500/50',
    description: 'Sweet 6th degree',
  },
  {
    syllable: 'Ti',
    handSignName: 'Index Pointing Up',
    handEmoji: '☝️',
    step: 'B',
    octave: 4,
    keyNum: '7',
    color: '#A855F7',
    textColor: 'text-purple-400',
    borderGlow: 'hover:shadow-purple-500/40 border-purple-500/50',
    description: 'Leading tone reaching for Do',
  },
  {
    syllable: "Do'",
    handSignName: 'High Fist',
    handEmoji: '✊',
    step: 'C',
    octave: 5,
    keyNum: '8',
    color: '#EF4444',
    textColor: 'text-red-400',
    borderGlow: 'hover:shadow-red-500/40 border-red-500/50',
    description: 'High tonic octave',
  },
];

type GameMode = 'free-play' | 'mystery-quiz';
type QuizDifficulty = 'easy' | 'medium' | 'full';

export const SolfegeTrainer: React.FC = () => {
  const [activeNoteIdx, setActiveNoteIdx] = useState<number | null>(null);
  const [mode, setMode] = useState<GameMode>('free-play');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium');

  // Quiz game state
  const [targetNoteIdx, setTargetNoteIdx] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizStreak, setQuizStreak] = useState<number>(0);
  const [quizFeedback, setQuizFeedback] = useState<{
    correct: boolean;
    guessedIdx: number;
    message: string;
  } | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState<boolean>(false);

  const seqTimerRef = useRef<number | null>(null);

  // Play pitch with sound engine
  const playPitch = useCallback((note: SolfegeNote, idx: number) => {
    const pitch: Pitch = { step: note.step, octave: note.octave };
    try {
      soundEngine.playNotePreview(pitch, 'xylophone', 0.65, 'C');
    } catch {
      // Audio fallback
    }
    setActiveNoteIdx(idx);
    setTimeout(() => {
      setActiveNoteIdx((curr) => (curr === idx ? null : curr));
    }, 300);
  }, []);

  // Filter notes available for current difficulty
  const getAvailableIndices = useCallback((): number[] => {
    if (difficulty === 'easy') {
      return [0, 1, 2]; // Do, Re, Mi
    }
    if (difficulty === 'medium') {
      return [0, 2, 4]; // Do, Mi, Sol
    }
    return [0, 1, 2, 3, 4, 5, 6, 7]; // Full scale
  }, [difficulty]);

  // Pick a new mystery note
  const pickNewMysteryNote = useCallback(() => {
    const indices = getAvailableIndices();
    const randomIdx = indices[Math.floor(Math.random() * indices.length)];
    setTargetNoteIdx(randomIdx);
    setQuizFeedback(null);

    // Play note immediately after picking
    setTimeout(() => {
      const note = SOLFEGE_SCALE[randomIdx];
      const pitch: Pitch = { step: note.step, octave: note.octave };
      try {
        soundEngine.playNotePreview(pitch, 'xylophone', 0.8, 'C');
      } catch {
        // fallback
      }
    }, 250);
  }, [getAvailableIndices]);

  // Start mystery quiz
  const handleStartQuiz = () => {
    setMode('mystery-quiz');
    setQuizScore(0);
    setQuizStreak(0);
    setQuizFeedback(null);
    pickNewMysteryNote();
  };

  // Replay current mystery note
  const replayMysteryNote = () => {
    if (targetNoteIdx === null) return;
    const note = SOLFEGE_SCALE[targetNoteIdx];
    const pitch: Pitch = { step: note.step, octave: note.octave };
    soundEngine.playNotePreview(pitch, 'xylophone', 0.8, 'C');
  };

  // Student makes a guess in quiz mode
  const handleGuess = (idx: number) => {
    if (targetNoteIdx === null || quizFeedback !== null) return;
    const guessedNote = SOLFEGE_SCALE[idx];
    playPitch(guessedNote, idx);

    if (idx === targetNoteIdx) {
      // Correct!
      setQuizScore((s) => s + 10 + quizStreak * 2);
      setQuizStreak((s) => s + 1);
      setQuizFeedback({
        correct: true,
        guessedIdx: idx,
        message: `Super ear! That was ${guessedNote.syllable}! 🎉`,
      });
      setTimeout(() => {
        pickNewMysteryNote();
      }, 1300);
    } else {
      // Incorrect
      setQuizStreak(0);
      setQuizFeedback({
        correct: false,
        guessedIdx: idx,
        message: `Nice try! That was ${guessedNote.syllable}. Listen closely!`,
      });
      setTimeout(() => {
        setQuizFeedback(null);
      }, 1500);
    }
  };

  // Keyboard 1-8 listeners for Chromebook accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      const keyInt = parseInt(e.key, 10);
      if (keyInt >= 1 && keyInt <= 8) {
        e.preventDefault();
        const noteIdx = keyInt - 1;
        if (mode === 'mystery-quiz') {
          handleGuess(noteIdx);
        } else {
          playPitch(SOLFEGE_SCALE[noteIdx], noteIdx);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, handleGuess, playPitch]);

  // Play a pre-programmed classroom pattern
  const playPattern = (indices: number[], speedMs: number = 400) => {
    if (isPlayingSequence) return;
    setIsPlayingSequence(true);

    let step = 0;
    seqTimerRef.current = window.setInterval(() => {
      if (step >= indices.length) {
        if (seqTimerRef.current) clearInterval(seqTimerRef.current);
        setIsPlayingSequence(false);
        setActiveNoteIdx(null);
        return;
      }
      const noteIdx = indices[step];
      const note = SOLFEGE_SCALE[noteIdx];
      playPitch(note, noteIdx);
      step++;
    }, speedMs);
  };

  useEffect(() => {
    return () => {
      if (seqTimerRef.current) clearInterval(seqTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Mode Switcher & Stats Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode('free-play')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-['Fredoka',sans-serif] ${
              mode === 'free-play'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            🎹 Free Play Chimes
          </button>
          <button
            type="button"
            onClick={handleStartQuiz}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-['Fredoka',sans-serif] flex items-center gap-1.5 ${
              mode === 'mystery-quiz'
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Ear Training Challenge</span>
          </button>
        </div>

        {mode === 'mystery-quiz' ? (
          <div className="flex items-center gap-4">
            {/* Difficulty Selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['easy', 'medium', 'full'] as QuizDifficulty[]).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => {
                    setDifficulty(diff);
                    setTimeout(pickNewMysteryNote, 100);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                    difficulty === diff
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {diff === 'easy' ? 'Do-Re-Mi' : diff === 'medium' ? 'Triad' : 'All 8'}
                </button>
              ))}
            </div>

            {/* Score & Streak */}
            <div className="flex items-center gap-3 text-xs font-mono font-bold">
              <span className="text-amber-300">⭐ {quizScore} pts</span>
              {quizStreak > 1 && (
                <span className="text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md">
                  🔥 {quizStreak} Streak!
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Song Presets */
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-bold">Play Songs:</span>
            <button
              type="button"
              disabled={isPlayingSequence}
              onClick={() => playPattern([2, 1, 0, 2, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 1, 0], 350)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Hot Cross Buns
            </button>
            <button
              type="button"
              disabled={isPlayingSequence}
              onClick={() => playPattern([4, 2, 4, 2, 0, 2, 4], 400)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Cuckoo (Sol-Mi)
            </button>
            <button
              type="button"
              disabled={isPlayingSequence}
              onClick={() => playPattern([0, 1, 2, 3, 4, 5, 6, 7], 300)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold border border-slate-700 cursor-pointer disabled:opacity-50"
            >
              Full Scale
            </button>
          </div>
        )}
      </div>

      {/* Quiz Prompt Bar when in challenge mode */}
      {mode === 'mystery-quiz' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-slate-900 to-indigo-950/80 border-2 border-rose-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={replayMysteryNote}
              className="w-12 h-12 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center text-xl shadow-lg shadow-rose-500/30 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Hear the mystery note again"
            >
              <Volume2 className="w-6 h-6 animate-pulse" />
            </button>
            <div>
              <h4 className="text-base font-black text-white font-['Fredoka',sans-serif]">
                Guess the Mystery Solfège Note!
              </h4>
              <p className="text-xs text-slate-300">
                Click the speaker to hear it again, then click the matching chime below.
              </p>
            </div>
          </div>

          {quizFeedback && (
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black ${
                quizFeedback.correct
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-500/20 border border-rose-500/50 text-rose-300'
              }`}
            >
              {quizFeedback.correct ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{quizFeedback.message}</span>
            </div>
          )}
        </div>
      )}

      {/* 8-NOTE BOOMWHACKER CHIME BARS & CURWEN HAND SIGNS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5 sm:gap-3">
        {SOLFEGE_SCALE.map((note, idx) => {
          const isActive = activeNoteIdx === idx;
          const isTargetQuizOption =
            mode === 'mystery-quiz' ? getAvailableIndices().includes(idx) : true;

          return (
            <button
              key={`${note.syllable}-${idx}`}
              type="button"
              disabled={!isTargetQuizOption}
              onClick={() => {
                if (mode === 'mystery-quiz') {
                  handleGuess(idx);
                } else {
                  playPitch(note, idx);
                }
              }}
              style={{
                height: `${240 - idx * 8}px`,
                backgroundColor: isActive ? note.color : undefined,
              }}
              className={`group relative rounded-2xl p-3 flex flex-col justify-between items-center transition-all duration-150 cursor-pointer select-none border-2 ${
                note.borderGlow
              } ${
                !isTargetQuizOption
                  ? 'opacity-25 pointer-events-none'
                  : isActive
                  ? 'scale-105 shadow-2xl text-slate-950 ring-4 ring-white/50'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-white hover:scale-102 shadow-lg'
              }`}
            >
              {/* Top: Curwen Hand Emoji & Number Key */}
              <div className="w-full flex items-center justify-between">
                <span className="text-2xl drop-shadow group-hover:scale-120 transition-transform">
                  {note.handEmoji}
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {note.keyNum}
                </span>
              </div>

              {/* Center: Hand Sign Visual Label */}
              <div className="text-center space-y-0.5">
                <div
                  className="w-4 h-4 rounded-full mx-auto shadow-inner"
                  style={{ backgroundColor: note.color }}
                />
                <div className="text-[10px] font-bold text-slate-400 leading-tight">
                  {note.step}
                  {note.octave}
                </div>
              </div>

              {/* Bottom: Syllable Title */}
              <div className="text-center w-full">
                <div
                  className="text-xl sm:text-2xl font-black font-['Fredoka',sans-serif] tracking-wide"
                  style={{ color: isActive ? '#020617' : note.color }}
                >
                  {note.syllable}
                </div>
                <div
                  className={`text-[9px] font-semibold truncate ${
                    isActive ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {note.handSignName}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Curwen Kodály Hand Signs Educational Legend */}
      <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Curwen Hand Signs:</strong> Practice signing with your hand as you sing each note.
            Press keys <strong>1 through 8</strong> on your keyboard to play!
          </span>
        </div>
        <div className="text-slate-500 font-mono text-[11px] shrink-0">
          Chroma-Notes / Boomwhacker Colors
        </div>
      </div>
    </div>
  );
};
