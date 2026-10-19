import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Trophy, X, RotateCcw, Volume2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundEngine } from '../audio/soundEngine';
import { SoundType } from '../types';

interface RhythmGameModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GamePad {
  id: SoundType;
  name: string;
  emoji: string;
  color: string;
  activeColor: string;
}

const GAME_PADS: GamePad[] = [
  { id: 'kick', name: 'Kick', emoji: '🥁', color: 'bg-rose-500', activeColor: 'bg-rose-300 ring-rose-400' },
  { id: 'snare', name: 'Snare', emoji: '💥', color: 'bg-amber-500', activeColor: 'bg-amber-300 ring-amber-400' },
  { id: 'clap', name: 'Clap', emoji: '👏', color: 'bg-emerald-500', activeColor: 'bg-emerald-300 ring-emerald-400' },
  { id: 'boing', name: 'Boing', emoji: '🌀', color: 'bg-purple-500', activeColor: 'bg-purple-300 ring-purple-400' },
];

const CHALLENGES: { title: string; sequence: SoundType[]; bpm: number }[] = [
  { title: 'Level 1: Stomp & Clap', sequence: ['kick', 'clap', 'kick', 'clap'], bpm: 100 },
  { title: 'Level 2: Snappy Bounce', sequence: ['kick', 'snare', 'boing', 'snare'], bpm: 105 },
  { title: 'Level 3: Double Trouble', sequence: ['kick', 'kick', 'clap', 'boing'], bpm: 110 },
  { title: 'Level 4: Funky Groove', sequence: ['snare', 'kick', 'clap', 'clap', 'boing'], bpm: 115 },
  { title: 'Level 5: Master Beat Champ', sequence: ['kick', 'snare', 'kick', 'clap', 'boing', 'kick'], bpm: 120 },
];

export const RhythmGameModal: React.FC<RhythmGameModalProps> = ({ isOpen, onClose }) => {
  const [level, setLevel] = useState(0);
  const [stars, setStars] = useState(0);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [highlightPad, setHighlightPad] = useState<SoundType | null>(null);
  const [playerInput, setPlayerInput] = useState<SoundType[]>([]);
  const [feedback, setFeedback] = useState<string>('Listen to Barnaby the Beat Bear!');
  const [feedbackState, setFeedbackState] = useState<'neutral' | 'success' | 'tryAgain'>('neutral');

  const currentChallenge = CHALLENGES[level];
  const demoTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (isOpen) {
      startLevelDemo();
    }
    return () => {
      demoTimeoutRefs.current.forEach(clearTimeout);
    };
  }, [isOpen, level]);

  if (!isOpen) return null;

  const startLevelDemo = () => {
    demoTimeoutRefs.current.forEach(clearTimeout);
    demoTimeoutRefs.current = [];
    setIsPlayingDemo(true);
    setPlayerInput([]);
    setFeedback('Listen carefully to the rhythm...');
    setFeedbackState('neutral');

    const stepInterval = (60 / currentChallenge.bpm) * 1000 * 0.75;

    currentChallenge.sequence.forEach((sound, idx) => {
      const timer = setTimeout(() => {
        soundEngine.playSound(sound);
        setHighlightPad(sound);

        setTimeout(() => {
          setHighlightPad(null);
        }, stepInterval * 0.5);

        // When demo completes
        if (idx === currentChallenge.sequence.length - 1) {
          setTimeout(() => {
            setIsPlayingDemo(false);
            setFeedback('Your turn! Tap the rhythm back!');
          }, stepInterval * 0.8);
        }
      }, (idx + 1) * stepInterval);

      demoTimeoutRefs.current.push(timer);
    });
  };

  const handlePadTap = (sound: SoundType) => {
    if (isPlayingDemo) return;

    soundEngine.playSound(sound);
    setHighlightPad(sound);
    setTimeout(() => setHighlightPad(null), 150);

    const newInput = [...playerInput, sound];
    setPlayerInput(newInput);

    const currentStep = newInput.length - 1;
    const targetSound = currentChallenge.sequence[currentStep];

    if (sound !== targetSound) {
      // Wrong note
      setFeedbackState('tryAgain');
      setFeedback('Oops! Almost! Listen again and give it another try!');
      soundEngine.playSound('plop', 0, 0.7, 0.5);
      setTimeout(() => {
        startLevelDemo();
      }, 1200);
      return;
    }

    // If whole sequence matches!
    if (newInput.length === currentChallenge.sequence.length) {
      setFeedbackState('success');
      setFeedback('🎉 AWESOME RHYTHM! You nailed it!');
      soundEngine.playSound('coin');
      setStars((prev) => prev + 1);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });

      setTimeout(() => {
        if (level < CHALLENGES.length - 1) {
          setLevel((prev) => prev + 1);
        } else {
          setFeedback('🏆 WOW! You beat all levels! You are an Official Beat Master!');
        }
      }, 1600);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-3xl border-4 border-indigo-500 bg-slate-900 p-6 text-white shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Mascot & Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-indigo-600 text-3xl shadow-lg animate-bounce-sm">
            🐻
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-amber-300">Rhythm Detective</h2>
              <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-black text-amber-300 border border-amber-400/30">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                {stars} Stars ⭐
              </span>
            </div>
            <p className="text-xs font-bold text-slate-300">
              {currentChallenge.title}
            </p>
          </div>
        </div>

        {/* Feedback Mascot Speech Bubble */}
        <div
          className={`my-5 rounded-2xl p-4 text-center font-black transition-all ${
            feedbackState === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : feedbackState === 'tryAgain'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
          }`}
        >
          <span className="text-lg">{feedback}</span>
        </div>

        {/* Sequence Progress Dots */}
        <div className="mb-6 flex justify-center gap-2">
          {currentChallenge.sequence.map((_, i) => {
            const isCompleted = i < playerInput.length;
            const isCurrent = i === playerInput.length && !isPlayingDemo;
            return (
              <div
                key={i}
                className={`h-4 w-4 rounded-full border-2 transition-all ${
                  isCompleted
                    ? 'border-emerald-400 bg-emerald-400 scale-110 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                    : isCurrent
                    ? 'border-amber-400 bg-amber-400/40 animate-pulse'
                    : 'border-slate-600 bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {/* 4 Chunky Game Pads */}
        <div className="grid grid-cols-2 gap-4">
          {GAME_PADS.map((pad) => {
            const isLit = highlightPad === pad.id;
            return (
              <button
                key={pad.id}
                onClick={() => handlePadTap(pad.id)}
                disabled={isPlayingDemo}
                className={`group flex h-28 flex-col items-center justify-center rounded-2xl p-4 text-white font-black shadow-lg transition-all active:scale-95 ${
                  pad.color
                } ${
                  isLit
                    ? 'ring-6 ring-white scale-105 shadow-[0_0_25px_rgba(255,255,255,0.8)]'
                    : 'hover:brightness-110'
                } ${isPlayingDemo ? 'cursor-not-allowed opacity-90' : 'cursor-pointer'}`}
              >
                <span className="text-4xl transition-transform group-hover:scale-110">
                  {pad.emoji}
                </span>
                <span className="mt-1 text-base tracking-wide">{pad.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action button to hear it again */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={startLevelDemo}
            disabled={isPlayingDemo}
            className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Play Rhythm Again
          </button>

          <span className="text-xs font-bold text-slate-400">
            {isPlayingDemo ? '👂 Listen...' : '👉 Tap the buttons!'}
          </span>
        </div>
      </div>
    </div>
  );
};
