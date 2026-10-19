import React, { useState, useEffect } from 'react';
import { LevelConfig } from '../types/rhythm';
import { SoundSettingsConfig } from '../types/game';
import { TheoryQuestion, getTheoryQuestionsForLevel } from '../data/theoryQuestions';
import { QuizNotationRenderer } from './QuizNotationRenderer';
import { audioEngine } from '../services/audioEngine';
import confetti from 'canvas-confetti';
import { HelpCircle, CheckCircle2, XCircle, ArrowRight, Trophy, Sparkles, Volume2, RotateCcw, Award } from 'lucide-react';

interface RhythmQuizGameProps {
  levelConfig: LevelConfig;
  settings: SoundSettingsConfig;
  onPatternComplete: (points: number, isCorrect: boolean) => void;
  onLevelComplete: (stars: number, accuracy: number, points: number) => void;
  onOpenLeaderboard: () => void;
  onNextLevel?: () => void;
  streak: number;
}

export const RhythmQuizGame: React.FC<RhythmQuizGameProps> = ({
  levelConfig,
  settings,
  onPatternComplete,
  onLevelComplete,
  onOpenLeaderboard,
  onNextLevel,
  streak
}) => {
  const [questions, setQuestions] = useState<TheoryQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Load questions whenever level changes
  useEffect(() => {
    const list = getTheoryQuestionsForLevel(levelConfig.levelNumber);
    // Shuffle options for variety
    const prepared = list.map(q => ({
      ...q,
      options: [...q.options].sort(() => 0.5 - Math.random())
    }));
    setQuestions(prepared);
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setTotalAnswered(0);
    setShowSummary(false);
    audioEngine.stopAll();
  }, [levelConfig.levelNumber]);

  const currentQuestion: TheoryQuestion | undefined = questions[questionIndex];

  const handlePlaySampleAudio = async () => {
    if (isPlayingAudio) {
      audioEngine.stopAll();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    // Play a sample note sound matching the kit
    audioEngine.playUniformRhythmNote(settings.soundKit);
    setTimeout(() => {
      setIsPlayingAudio(false);
    }, 800);
  };

  const handleSelectOption = (optionId: string) => {
    if (isAnswered || !currentQuestion) return;
    audioEngine.stopAll();

    setSelectedOptionId(optionId);
    setIsAnswered(true);

    const chosenOption = currentQuestion.options.find(o => o.id === optionId);
    const isCorrect = chosenOption?.isCorrect ?? false;

    const newTotal = totalAnswered + 1;
    setTotalAnswered(newTotal);

    if (isCorrect) {
      const newCorrect = correctCount + 1;
      setCorrectCount(newCorrect);

      // Points calculation
      const basePoints = levelConfig.basePointsPerQuestion || 100;
      const streakMultiplier = Math.min(3, 1 + streak * 0.25);
      const pointsEarned = Math.round(basePoints * streakMultiplier);

      audioEngine.playSparkleChime();
      if ((streak + 1) % 3 === 0) {
        audioEngine.playPowerChordFanfare();
      }

      try {
        confetti({
          particleCount: 40 + streak * 10,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {
        // ignore
      }

      onPatternComplete(pointsEarned, true);
    } else {
      audioEngine.playGentleOops();
      onPatternComplete(0, false);
    }
  };

  const handleNextQuestion = () => {
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
    } else {
      // Level Completed
      const accuracy = Math.round((correctCount / Math.max(1, totalAnswered)) * 100);
      let stars = 1;
      if (accuracy >= 90) stars = 3;
      else if (accuracy >= 70) stars = 2;

      const basePoints = levelConfig.basePointsPerQuestion || 100;
      const totalLevelPoints = correctCount * basePoints + stars * 150;
      
      audioEngine.playPowerChordFanfare();
      onLevelComplete(stars, accuracy, totalLevelPoints);
      setShowSummary(true);
    }
  };

  const handleRestartLevel = () => {
    const list = getTheoryQuestionsForLevel(levelConfig.levelNumber);
    const prepared = list.map(q => ({
      ...q,
      options: [...q.options].sort(() => 0.5 - Math.random())
    }));
    setQuestions(prepared);
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setTotalAnswered(0);
    setShowSummary(false);
  };

  if (!currentQuestion) {
    return (
      <div className="p-8 text-center text-slate-400">
        Loading theory questions for Level {levelConfig.levelNumber}...
      </div>
    );
  }

  // LEVEL COMPLETE SUMMARY MODAL CARD
  if (showSummary) {
    const accuracy = Math.round((correctCount / Math.max(1, totalAnswered)) * 100);
    let stars = 1;
    if (accuracy >= 90) stars = 3;
    else if (accuracy >= 70) stars = 2;

    return (
      <div className="w-full max-w-2xl mx-auto bg-slate-900 border-2 border-amber-400/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center flex flex-col items-center gap-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 text-4xl shadow-xl shadow-amber-400/30 ring-4 ring-amber-400/40">
          🏆
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 block mb-1">
            Rhythm Quiz Level Complete!
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
            Level {levelConfig.levelNumber}: {levelConfig.title}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Great work mastering music theory concepts!
          </p>
        </div>

        {/* Stars */}
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3].map(starNum => (
            <span
              key={starNum}
              className={`text-4xl transition-transform ${
                starNum <= stars ? 'scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]' : 'opacity-30 grayscale'
              }`}
            >
              ⭐
            </span>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Questions Correct</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {correctCount} / {totalAnswered}
            </span>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-medium block">Theory Accuracy</span>
            <span className="text-2xl font-black text-amber-400 font-mono">
              {accuracy}%
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-md pt-2">
          <button
            onClick={handleRestartLevel}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Try Level Again
          </button>

          {onNextLevel ? (
            <button
              onClick={() => {
                setShowSummary(false);
                onNextLevel();
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Next Level</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenLeaderboard}
              className="w-full py-3 bg-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              View Class Leaderboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // ACTIVE QUIZ QUESTION CARD
  const optionLetters = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      {/* Quiz Game Top Info Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center text-xl font-bold">
            💡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-red-400 uppercase tracking-widest">
                Rhythm Theory Quiz
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-bold text-amber-400">
                Level {levelConfig.levelNumber}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-display">
              Question {questionIndex + 1} of {questions.length}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Audio sample button */}
          <button
            onClick={handlePlaySampleAudio}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              isPlayingAudio
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md shadow-amber-400/30 animate-pulse'
                : 'bg-slate-950/80 text-amber-300 border-amber-400/30 hover:bg-slate-800'
            }`}
            title="Listen to instrumental sample tone"
          >
            <Volume2 className="w-4 h-4" />
            <span>{isPlayingAudio ? 'Playing Sound...' : 'Test Sound'}</span>
          </button>

          {/* Points Potential */}
          <div className="px-3 py-1.5 bg-amber-400/10 border border-amber-400/30 rounded-xl text-xs font-mono font-bold text-amber-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>+{levelConfig.basePointsPerQuestion} pts</span>
          </div>
        </div>
      </div>

      {/* Main Theory Prompt Card */}
      <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center gap-6 relative overflow-hidden">
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Question Text Prompt */}
        <div className="max-w-xl">
          <span className="inline-block px-3 py-1 bg-red-600/20 text-red-300 border border-red-500/30 text-xs font-extrabold uppercase tracking-wider rounded-full mb-3">
            {currentQuestion.questionType.replace('_', ' ')}
          </span>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white leading-tight font-display">
            {currentQuestion.prompt}
          </h3>
          {currentQuestion.subPrompt && (
            <p className="text-sm text-slate-400 mt-2">
              {currentQuestion.subPrompt}
            </p>
          )}
        </div>

        {/* Visual Notation Symbol Display Box */}
        <QuizNotationRenderer question={currentQuestion} />

        {/* Multiple Choice Options Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-2xl mt-2">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOptionId === option.id;
            let btnStyle = 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-200 hover:border-slate-700';

            if (isAnswered) {
              if (option.isCorrect) {
                btnStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-200 ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-500/20';
              } else if (isSelected) {
                btnStyle = 'bg-rose-950/90 border-rose-500 text-rose-200 ring-2 ring-rose-500/50';
              } else {
                btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-50';
              }
            }

            return (
              <button
                key={option.id}
                onClick={() => handleSelectOption(option.id)}
                disabled={isAnswered}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 group relative cursor-pointer ${btnStyle} ${
                  !isAnswered ? 'hover:scale-[1.02] active:scale-[0.98]' : ''
                }`}
              >
                {/* Option Letter Avatar Badge */}
                <span
                  className={`w-9 h-9 rounded-xl font-mono font-black text-sm flex items-center justify-center shrink-0 border transition-colors ${
                    isAnswered && option.isCorrect
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                      : isAnswered && isSelected
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-900 text-amber-400 border-slate-800 group-hover:border-amber-400/50'
                  }`}
                >
                  {optionLetters[idx]}
                </span>

                {/* Option Label */}
                <span className="font-bold text-sm sm:text-base flex-1">
                  {option.label}
                </span>

                {/* Status Icon Indicator */}
                {isAnswered && option.isCorrect && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />
                )}
                {isAnswered && isSelected && !option.isCorrect && (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Explanation Banner when answered */}
        {isAnswered && (
          <div className="w-full max-w-2xl bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-lg">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {currentQuestion.options.find(o => o.id === selectedOptionId)?.isCorrect ? (
                  <span className="text-xl">🎉</span>
                ) : (
                  <span className="text-xl">💡</span>
                )}
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                  {currentQuestion.options.find(o => o.id === selectedOptionId)?.isCorrect
                    ? 'Correct Answer!'
                    : 'Theory Explanation'}
                </span>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5 leading-relaxed">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>

            <button
              onClick={handleNextQuestion}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer hover:scale-105 active:scale-95"
            >
              <span>{questionIndex + 1 < questions.length ? 'Next Question' : 'View Level Score'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
