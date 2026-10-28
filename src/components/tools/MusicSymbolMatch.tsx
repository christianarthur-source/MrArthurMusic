import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  RotateCcw,
  Sparkles,
  Flame,
  Volume2,
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Shuffle,
} from 'lucide-react';
import {
  playCardFlipSound,
  playMatchChime,
  playWrongBuzzer,
  playMusicNote,
  getToolboxAudioContext,
} from './toolboxAudio';
import { SymbolVisual } from './SymbolVisual';

// Game Modes
export type SymbolMatchMode = 'memory' | 'speed';
export type SymbolCategory = 'all' | 'notes-rests' | 'dynamics' | 'clefs-signs' | 'articulations';

export interface MusicalSymbolItem {
  id: string;
  name: string;
  category: 'notes-rests' | 'dynamics' | 'clefs-signs' | 'articulations';
  definition: string;
  soundType: 'short' | 'long' | 'loud' | 'soft' | 'fast' | 'slow' | 'chord';
  badgeColor: string;
}

export const SYMBOL_DATABASE: MusicalSymbolItem[] = [
  // --- Notes ---
  {
    id: 'whole-note',
    name: 'Whole Note',
    category: 'notes-rests',
    definition: 'Receives 4 beats of sound (open oval)',
    soundType: 'long',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'half-note',
    name: 'Half Note',
    category: 'notes-rests',
    definition: 'Receives 2 beats of sound (open notehead + stem)',
    soundType: 'long',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'dotted-half',
    name: 'Dotted Half Note',
    category: 'notes-rests',
    definition: 'Receives 3 beats (2 beats + 1 dot)',
    soundType: 'long',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'quarter-note',
    name: 'Quarter Note',
    category: 'notes-rests',
    definition: 'Receives 1 beat of sound (solid notehead + stem)',
    soundType: 'short',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'eighth-note',
    name: 'Eighth Note',
    category: 'notes-rests',
    definition: 'Receives 1/2 beat of sound (1 flag on stem)',
    soundType: 'short',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    id: 'sixteenth-note',
    name: 'Sixteenth Note',
    category: 'notes-rests',
    definition: 'Receives 1/4 beat of sound (2 flags on stem)',
    soundType: 'short',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },

  // --- Rests ---
  {
    id: 'whole-rest',
    name: 'Whole Rest',
    category: 'notes-rests',
    definition: '4 beats of silence (hangs below the line)',
    soundType: 'long',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    id: 'half-rest',
    name: 'Half Rest',
    category: 'notes-rests',
    definition: '2 beats of silence (sits like a hat on the line)',
    soundType: 'long',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    id: 'quarter-rest',
    name: 'Quarter Rest',
    category: 'notes-rests',
    definition: '1 beat of silent rest',
    soundType: 'short',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    id: 'eighth-rest',
    name: 'Eighth Rest',
    category: 'notes-rests',
    definition: '1/2 beat of silent rest (1 hook)',
    soundType: 'short',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    id: 'sixteenth-rest',
    name: 'Sixteenth Rest',
    category: 'notes-rests',
    definition: '1/4 beat of silent rest (2 hooks)',
    soundType: 'short',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },

  // --- Dynamics ---
  {
    id: 'pianissimo',
    name: 'Pianissimo (pp)',
    category: 'dynamics',
    definition: 'Very soft (whisper quiet volume)',
    soundType: 'soft',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'piano',
    name: 'Piano (p)',
    category: 'dynamics',
    definition: 'Soft & gentle playing volume',
    soundType: 'soft',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    id: 'mezzo-piano',
    name: 'Mezzo-Piano (mp)',
    category: 'dynamics',
    definition: 'Medium soft (moderately quiet)',
    soundType: 'soft',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  {
    id: 'mezzo-forte',
    name: 'Mezzo-Forte (mf)',
    category: 'dynamics',
    definition: 'Medium loud (speaking voice volume)',
    soundType: 'loud',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  {
    id: 'forte',
    name: 'Forte (f)',
    category: 'dynamics',
    definition: 'Loud & strong sound',
    soundType: 'loud',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'fortissimo',
    name: 'Fortissimo (ff)',
    category: 'dynamics',
    definition: 'Very loud with full power!',
    soundType: 'loud',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'crescendo',
    name: 'Crescendo (<)',
    category: 'dynamics',
    definition: 'Gradually get louder',
    soundType: 'loud',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    id: 'decrescendo',
    name: 'Decrescendo (>)',
    category: 'dynamics',
    definition: 'Gradually get softer',
    soundType: 'soft',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },

  // --- Clefs & Signs ---
  {
    id: 'treble-clef',
    name: 'Treble Clef',
    category: 'clefs-signs',
    definition: 'G Clef: high notes & right hand on piano',
    soundType: 'chord',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  {
    id: 'bass-clef',
    name: 'Bass Clef',
    category: 'clefs-signs',
    definition: 'F Clef: low notes & left hand on piano',
    soundType: 'chord',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  {
    id: 'sharp',
    name: 'Sharp (♯)',
    category: 'clefs-signs',
    definition: 'Raises a pitch by 1/2 step (half step higher)',
    soundType: 'short',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
  {
    id: 'flat',
    name: 'Flat (♭)',
    category: 'clefs-signs',
    definition: 'Lowers a pitch by 1/2 step (half step lower)',
    soundType: 'short',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
  {
    id: 'natural',
    name: 'Natural (♮)',
    category: 'clefs-signs',
    definition: 'Cancels a previous sharp or flat',
    soundType: 'short',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
  },
  {
    id: 'fermata',
    name: 'Fermata',
    category: 'clefs-signs',
    definition: 'Hold the note longer than its normal count!',
    soundType: 'long',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },
  {
    id: 'repeat-sign',
    name: 'Repeat Sign',
    category: 'clefs-signs',
    definition: 'Go back and play that section of music again',
    soundType: 'chord',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  },

  // --- Articulations ---
  {
    id: 'staccato',
    name: 'Staccato (•)',
    category: 'articulations',
    definition: 'Play the note short, crisp, and detached',
    soundType: 'short',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  },
  {
    id: 'accent',
    name: 'Accent (>)',
    category: 'articulations',
    definition: 'Play the note with extra emphasis and punch!',
    soundType: 'loud',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  },
];

interface MemoryCard {
  id: string;
  pairId: string;
  cardType: 'symbol' | 'text';
  symbolItem: MusicalSymbolItem;
  isFlipped: boolean;
  isMatched: boolean;
}

export const MusicSymbolMatch: React.FC = () => {
  const [activeMode, setActiveMode] = useState<SymbolMatchMode>('memory');
  const [categoryFilter, setCategoryFilter] = useState<SymbolCategory>('all');
  const [showStudyGuide, setShowStudyGuide] = useState<boolean>(false);

  // Play audio for a symbol
  const playSymbolAudio = useCallback((item: MusicalSymbolItem) => {
    if (item.soundType === 'loud') {
      playMusicNote({ step: 'C', octave: 5 }, 'trumpet', 0.6);
    } else if (item.soundType === 'soft') {
      playMusicNote({ step: 'C', octave: 5 }, 'flute', 0.5);
    } else if (item.soundType === 'long') {
      playMusicNote({ step: 'G', octave: 4 }, 'piano', 1.2);
    } else if (item.soundType === 'short') {
      playMusicNote({ step: 'E', octave: 5 }, 'marimba', 0.3);
    } else if (item.soundType === 'fast') {
      playMusicNote({ step: 'C', octave: 5 }, 'xylophone', 0.2);
      setTimeout(() => playMusicNote({ step: 'E', octave: 5 }, 'xylophone', 0.2), 100);
      setTimeout(() => playMusicNote({ step: 'G', octave: 5 }, 'xylophone', 0.2), 200);
    } else {
      playMusicNote({ step: 'C', octave: 4 }, 'piano', 0.8);
      playMusicNote({ step: 'G', octave: 4 }, 'piano', 0.8);
    }
  }, []);

  // ----------------------------------------------------
  // MODE 1: MEMORY MATCH STATE
  // ----------------------------------------------------
  const [memoryCards, setMemoryCards] = useState<MemoryCard[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [memoryMoves, setMemoryMoves] = useState<number>(0);
  const [memoryMatches, setMemoryMatches] = useState<number>(0);
  const [memoryWon, setMemoryWon] = useState<boolean>(false);

  // Initialize Memory Deck
  const initMemoryGame = useCallback(() => {
    const pool =
      categoryFilter === 'all'
        ? SYMBOL_DATABASE
        : SYMBOL_DATABASE.filter((s) => s.category === categoryFilter);

    // Pick 6 random symbols (12 cards)
    const shuffledPool = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffledPool.slice(0, Math.min(6, shuffledPool.length));

    const cards: MemoryCard[] = [];
    selected.forEach((item, idx) => {
      // Symbol card
      cards.push({
        id: `card-sym-${idx}`,
        pairId: item.id,
        cardType: 'symbol',
        symbolItem: item,
        isFlipped: false,
        isMatched: false,
      });
      // Text / definition card
      cards.push({
        id: `card-txt-${idx}`,
        pairId: item.id,
        cardType: 'text',
        symbolItem: item,
        isFlipped: false,
        isMatched: false,
      });
    });

    // Shuffle the 12 cards
    cards.sort(() => 0.5 - Math.random());

    setMemoryCards(cards);
    setFlippedIndices([]);
    setMemoryMoves(0);
    setMemoryMatches(0);
    setMemoryWon(false);
  }, [categoryFilter]);

  useEffect(() => {
    if (activeMode === 'memory') {
      initMemoryGame();
    }
  }, [activeMode, categoryFilter, initMemoryGame]);

  const handleFlipCard = (idx: number) => {
    if (flippedIndices.length >= 2) return;
    const card = memoryCards[idx];
    if (card.isFlipped || card.isMatched) return;

    playCardFlipSound();

    const nextFlipped = [...flippedIndices, idx];
    setFlippedIndices(nextFlipped);

    setMemoryCards((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, isFlipped: true } : c))
    );

    if (nextFlipped.length === 2) {
      setMemoryMoves((m) => m + 1);
      const firstCard = memoryCards[nextFlipped[0]];
      const secondCard = memoryCards[nextFlipped[1]];

      if (firstCard.pairId === secondCard.pairId) {
        // MATCH!
        setTimeout(() => {
          playMatchChime();
          playSymbolAudio(firstCard.symbolItem);

          setMemoryCards((prev) =>
            prev.map((c) =>
              c.pairId === firstCard.pairId ? { ...c, isMatched: true } : c
            )
          );
          setMemoryMatches((m) => {
            const nextMatches = m + 1;
            const targetCount = memoryCards.length / 2;
            if (nextMatches >= targetCount) {
              setMemoryWon(true);
            }
            return nextMatches;
          });
          setFlippedIndices([]);
        }, 500);
      } else {
        // MISMATCH
        setTimeout(() => {
          playWrongBuzzer();
          setMemoryCards((prev) =>
            prev.map((c, i) =>
              nextFlipped.includes(i) ? { ...c, isFlipped: false } : c
            )
          );
          setFlippedIndices([]);
        }, 1100);
      }
    }
  };

  // ----------------------------------------------------
  // MODE 2: TIMED SPEED MATCH STATE
  // ----------------------------------------------------
  const [speedActive, setSpeedActive] = useState<boolean>(false);
  const [speedTimeLeft, setSpeedTimeLeft] = useState<number>(45);
  const [speedScore, setSpeedScore] = useState<number>(0);
  const [speedStreak, setSpeedStreak] = useState<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<MusicalSymbolItem | null>(null);
  const [speedOptions, setSpeedOptions] = useState<string[]>([]);
  const [feedbackState, setFeedbackState] = useState<'correct' | 'wrong' | null>(null);

  const nextSpeedQuestion = useCallback(() => {
    const pool =
      categoryFilter === 'all'
        ? SYMBOL_DATABASE
        : SYMBOL_DATABASE.filter((s) => s.category === categoryFilter);

    const target = pool[Math.floor(Math.random() * pool.length)];
    setCurrentPrompt(target);

    // Pick 3 distractors from the full database for diverse choices
    const otherPool = SYMBOL_DATABASE.filter((s) => s.id !== target.id);
    const shuffledOthers = [...otherPool].sort(() => 0.5 - Math.random());
    const distractors = shuffledOthers.slice(0, 3).map((s) => s.name);

    const opts = [target.name, ...distractors].sort(() => 0.5 - Math.random());
    setSpeedOptions(opts);
    setFeedbackState(null);
  }, [categoryFilter]);

  const startSpeedGame = () => {
    setSpeedScore(0);
    setSpeedStreak(0);
    setSpeedTimeLeft(45);
    setSpeedActive(true);
    nextSpeedQuestion();
    getToolboxAudioContext().catch(() => {});
  };

  // Timer loop for speed game
  useEffect(() => {
    if (!speedActive) return;

    if (speedTimeLeft <= 0) {
      setSpeedActive(false);
      return;
    }

    const timer = setInterval(() => {
      setSpeedTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [speedActive, speedTimeLeft]);

  const handleAnswerSpeed = (selectedName: string) => {
    if (!currentPrompt || feedbackState !== null) return;

    if (selectedName === currentPrompt.name) {
      // Correct!
      setFeedbackState('correct');
      playMatchChime();
      playSymbolAudio(currentPrompt);
      const streakBonus = Math.min(5, speedStreak + 1);
      setSpeedScore((s) => s + 100 * streakBonus);
      setSpeedStreak((str) => str + 1);

      setTimeout(() => {
        nextSpeedQuestion();
      }, 500);
    } else {
      // Wrong
      setFeedbackState('wrong');
      playWrongBuzzer();
      setSpeedStreak(0);

      setTimeout(() => {
        nextSpeedQuestion();
      }, 750);
    }
  };

  return (
    <div className="space-y-4 select-none font-['Fredoka',sans-serif]">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-3xl shadow-lg">
            🃏
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Music Symbol Match</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-300 border border-violet-400/40">
                Notes • Rests • Dynamics • Clefs
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Test your musical memory! Match engraved symbols to their names, meanings, and sounds.
            </p>
          </div>
        </div>

        {/* Mode Selector & Study Guide */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => setActiveMode('memory')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMode === 'memory'
                  ? 'bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🧠 Memory Match
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('speed')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeMode === 'speed'
                  ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ⚡ Speed Challenge
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowStudyGuide(!showStudyGuide)}
            className="p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Study Guide"
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-slate-400 font-bold shrink-0 mr-1">Filter:</span>
        {[
          { id: 'all', label: `All Symbols (${SYMBOL_DATABASE.length})` },
          { id: 'notes-rests', label: '🎼 Notes & Rests' },
          { id: 'dynamics', label: '🔊 Dynamics (pp - ff)' },
          { id: 'clefs-signs', label: '𝄞 Clefs & Accidentals' },
          { id: 'articulations', label: '🎯 Articulations' },
        ].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id as SymbolCategory)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
              categoryFilter === cat.id
                ? 'bg-slate-700 text-white border border-slate-500 shadow-sm'
                : 'bg-slate-950/70 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------------------------------
          VIEW A: MEMORY MATCH CONCENTRATION MODE
          ------------------------------------------------------------------------- */}
      {activeMode === 'memory' && (
        <div className="bg-slate-900/90 p-4 sm:p-5 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-400">
                Pairs Matched:{' '}
                <span className="text-amber-400 font-black text-sm">
                  {memoryMatches} / {memoryCards.length / 2}
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Moves: <span className="text-white font-black text-sm">{memoryMoves}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={initMemoryGame}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer border border-slate-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Shuffle New Cards</span>
            </button>
          </div>

          {/* Victory Modal Overlay */}
          {memoryWon && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-sky-500/20 border-2 border-emerald-400 text-center space-y-3 animate-in zoom-in-95">
              <div className="text-5xl animate-bounce">🏆</div>
              <h4 className="text-2xl font-black text-white">You Matched All Symbols!</h4>
              <p className="text-xs text-emerald-300 font-sans max-w-md mx-auto">
                Incredible job! You solved all {memoryCards.length / 2} musical pairs in only{' '}
                <span className="font-bold text-white">{memoryMoves} moves</span>.
              </p>
              <button
                type="button"
                onClick={initMemoryGame}
                className="px-6 py-2.5 rounded-2xl bg-emerald-400 text-slate-950 font-black text-sm hover:bg-emerald-300 shadow-lg cursor-pointer transition-all"
              >
                Play Another Game! 🌟
              </button>
            </div>
          )}

          {/* 12-Card Grid (3x4 or 4x3) */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {memoryCards.map((card, idx) => {
              const isOpen = card.isFlipped || card.isMatched;

              return (
                <div
                  key={card.id}
                  onClick={() => handleFlipCard(idx)}
                  className={`h-36 sm:h-40 rounded-2xl border-2 flex flex-col items-center justify-center p-3 text-center transition-all duration-300 cursor-pointer relative select-none ${
                    card.isMatched
                      ? 'border-emerald-400/80 bg-emerald-950/40 text-emerald-200 opacity-90 scale-98 shadow-inner'
                      : isOpen
                      ? 'border-violet-400 bg-slate-800 text-white shadow-xl scale-102 ring-2 ring-violet-400/40'
                      : 'border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 hover:border-slate-700 hover:scale-102 text-slate-600'
                  }`}
                >
                  {isOpen ? (
                    <div className="flex flex-col items-center justify-center space-y-1.5 h-full animate-in zoom-in-75 duration-150 w-full">
                      {card.cardType === 'symbol' ? (
                        <>
                          <div className="flex items-center justify-center h-16 w-full text-white my-auto">
                            <SymbolVisual id={card.symbolItem.id} size="md" color="#F8FAFC" />
                          </div>
                          <div className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">
                            Symbol Card
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-black text-sm text-amber-300 my-auto leading-snug">
                            {card.symbolItem.name}
                          </div>
                          <div className="text-[10px] text-slate-300 font-sans leading-tight">
                            {card.symbolItem.definition}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xl text-slate-400 shadow-inner">
                        🎵
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Tap Flip
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------
          VIEW B: TIMED SPEED CHALLENGE MODE
          ------------------------------------------------------------------------- */}
      {activeMode === 'speed' && (
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 space-y-5">
          {!speedActive ? (
            <div className="text-center py-8 space-y-4 max-w-md mx-auto">
              <div className="w-20 h-20 rounded-3xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-4xl mx-auto shadow-inner">
                ⚡
              </div>
              <div>
                <h4 className="text-2xl font-black text-white">45-Second Speed Quiz!</h4>
                <p className="text-xs text-slate-300 font-sans mt-1">
                  How many music symbols can you identify before time runs out? Build your combo
                  streak for multiplier points!
                </p>
              </div>

              {speedScore > 0 && (
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 inline-block text-center">
                  <div className="text-xs text-slate-400">Last Score</div>
                  <div className="text-2xl font-black text-amber-400">{speedScore} PTS</div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={startSpeedGame}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-base shadow-xl shadow-amber-400/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  Start Speed Match! 🚀
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Speed HUD */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-black text-sm">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>{speedTimeLeft}s</span>
                  </div>

                  <div className="text-sm font-black text-white">
                    Score: <span className="text-amber-400">{speedScore}</span>
                  </div>
                </div>

                {speedStreak > 1 && (
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black animate-pulse">
                    <Flame className="w-3.5 h-3.5 text-rose-400 fill-current" />
                    <span>{speedStreak}x Streak!</span>
                  </div>
                )}
              </div>

              {/* Spotlight Symbol */}
              {currentPrompt && (
                <div className="p-6 rounded-3xl bg-slate-950 border-2 border-slate-800 flex flex-col items-center justify-center text-center space-y-2 relative overflow-hidden min-h-[140px]">
                  <div className="py-2 flex items-center justify-center text-white">
                    <SymbolVisual id={currentPrompt.id} size="lg" color="#F8FAFC" />
                  </div>
                  <div className="text-xs text-slate-400 font-sans max-w-sm">
                    {currentPrompt.definition}
                  </div>

                  {feedbackState === 'correct' && (
                    <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-xs flex items-center justify-center text-emerald-300 font-black text-xl animate-in fade-in">
                      ✓ Correct! +{100 * Math.max(1, speedStreak)}
                    </div>
                  )}

                  {feedbackState === 'wrong' && (
                    <div className="absolute inset-0 bg-rose-500/20 backdrop-blur-xs flex items-center justify-center text-rose-300 font-black text-xl animate-in fade-in">
                      ✗ Oops! It was {currentPrompt.name}
                    </div>
                  )}
                </div>
              )}

              {/* 4 Multi-Choice Option Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {speedOptions.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleAnswerSpeed(opt)}
                    className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm border border-slate-700 hover:border-violet-400 transition-all text-center cursor-pointer shadow-md active:scale-98"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------------
          STUDY GUIDE REFERENCE MODAL / DRAWER
          ------------------------------------------------------------------------- */}
      {showStudyGuide && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 border-2 border-amber-400/40 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <h4 className="font-black text-white text-base">Musical Symbol Cheat Sheet</h4>
            </div>
            <button
              type="button"
              onClick={() => setShowStudyGuide(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-1 scrollbar-thin">
            {SYMBOL_DATABASE.map((item) => (
              <div
                key={item.id}
                onClick={() => playSymbolAudio(item)}
                className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex flex-col justify-between cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-center py-2 text-white min-h-[48px]">
                  <SymbolVisual id={item.id} size="sm" color="#F8FAFC" />
                </div>
                <div>
                  <div className="font-bold text-xs text-amber-300 leading-tight">{item.name}</div>
                  <div className="text-[10px] text-slate-400 font-sans mt-0.5 leading-tight">
                    {item.definition}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
