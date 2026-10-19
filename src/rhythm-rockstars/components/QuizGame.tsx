import React, { useState, useEffect } from 'react';
import { RhythmPattern, LevelConfig } from '../types/rhythm';
import { LEVEL_QUESTION_COUNTS } from '../data/rhythmCatalog';
import { RhythmNotation } from './RhythmNotation';
import { audioEngine } from '../services/audioEngine';
import { SoundSettingsConfig, SoundKit } from '../types/game';
import confetti from 'canvas-confetti';
import { Play, RotateCcw, CheckCircle, XCircle, ArrowRight, Trophy, Sparkles, Volume2 } from 'lucide-react';

const kitLabels: Record<SoundKit, { name: string; icon: string }> = {
  rock_kit: { name: 'Rock Snare', icon: '🥁' },
  woodblock: { name: 'Woodblock', icon: '🪵' },
  cowbell_fever: { name: 'Cowbell', icon: '🔔' },
  electric_clap: { name: 'Hand Claps', icon: '👏' },
  marimba: { name: 'Marimba', icon: '🎶' },
  triangle: { name: 'Triangle', icon: '📐' },
  synth_rimshot: { name: '808 Rimshot', icon: '⚡' },
  agogo_bell: { name: 'Agogô Bell', icon: '🎵' },
  garage_drum: { name: 'Garage Rimshot', icon: '⚡' }
};

interface QuizGameProps {
  levelConfig: LevelConfig;
  settings: SoundSettingsConfig;
  onPatternComplete: (points: number, isCorrect: boolean) => void;
  onLevelComplete: (stars: number, accuracy: number, points: number) => void;
  onOpenLeaderboard: () => void;
  onNextLevel?: () => void;
  onChangeKit?: (kit: SoundKit) => void;
  streak: number;
}

export const QuizGame: React.FC<QuizGameProps> = ({
  levelConfig,
  settings,
  onPatternComplete,
  onLevelComplete,
  onOpenLeaderboard,
  onNextLevel,
  onChangeKit,
  streak
}) => {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [targetPattern, setTargetPattern] = useState<RhythmPattern>(levelConfig.patterns[0]);
  const [choices, setChoices] = useState<RhythmPattern[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const [totalQuestionsAnswered, setTotalQuestionsAnswered] = useState(0);
  const [showLevelSummary, setShowLevelSummary] = useState(false);

  const totalQuestions = LEVEL_QUESTION_COUNTS[levelConfig.levelNumber] || 10;

  // Set up question with choices
  const setupQuestion = (qIdx: number) => {
    audioEngine.stopAll();
    const target = levelConfig.patterns[qIdx % levelConfig.patterns.length];
    setTargetPattern(target);
    setSelectedChoiceId(null);
    setIsAnswered(false);
    setIsPlayingTarget(false);

    // Pick 3 or 4 choices: target + other patterns from this level or nearby
    const others = levelConfig.patterns.filter(p => p.id !== target.id);
    const shuffledOthers = [...others].sort(() => 0.5 - Math.random()).slice(0, 2);
    const combined = [target, ...shuffledOthers].sort(() => 0.5 - Math.random());
    setChoices(combined);

    // Auto play target with gentle count-in on new question
    setTimeout(() => {
      handlePlayTarget(target);
    }, 400);
  };

  useEffect(() => {
    setShowLevelSummary(false);
    setupQuestion(questionIndex);
    return () => {
      audioEngine.stopAll();
    };
  }, [questionIndex, levelConfig.levelNumber]);

  const handlePlayTarget = async (patternToPlay = targetPattern) => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.stopAll();
      setIsPlayingTarget(false);
      return;
    }

    setIsPlayingTarget(true);

    await audioEngine.playPattern(
      patternToPlay,
      settings.tempoBpm,
      settings.soundKit,
      settings.countIn,
      (progress) => {
        if (progress.isFinished) {
          setIsPlayingTarget(false);
        }
      }
    );
  };

  const handleSelectChoice = (choice: RhythmPattern) => {
    if (isAnswered) return;
    audioEngine.stopAll();
    setIsPlayingTarget(false);

    const isCorrect = choice.id === targetPattern.id;
    setSelectedChoiceId(choice.id);
    setIsAnswered(true);

    const newAnswered = totalQuestionsAnswered + 1;
    setTotalQuestionsAnswered(newAnswered);

    if (isCorrect) {
      const newCorrect = correctAnswersCount + 1;
      setCorrectAnswersCount(newCorrect);

      // Points calculation: Harder levels are worth significantly more points!
      const basePoints = levelConfig.basePointsPerQuestion || 100;
      const streakMultiplier = Math.min(3, 1 + streak * 0.25);
      const points = Math.round(basePoints * streakMultiplier);

      // Audio celebration
      audioEngine.playSparkleChime();
      if ((streak + 1) % 3 === 0) {
        audioEngine.playPowerChordFanfare();
      }

      // Confetti burst for streak or correct
      try {
        confetti({
          particleCount: 50 + streak * 10,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {
        // ignore
      }

      onPatternComplete(points, true);
    } else {
      audioEngine.playGentleOops();
      onPatternComplete(0, false);
    }
  };

  const handleNextQuestion = () => {
    audioEngine.stopAll();
    if (questionIndex + 1 < totalQuestions) {
      setQuestionIndex(prev => prev + 1);
    } else {
      // Level Complete
      const accuracy = Math.round((correctAnswersCount / Math.max(1, totalQuestionsAnswered)) * 100);
      let stars = 1;
      if (accuracy >= 90) stars = 3;
      else if (accuracy >= 70) stars = 2;

      const basePoints = levelConfig.basePointsPerQuestion || 100;
      const totalLevelPoints = correctAnswersCount * basePoints + stars * Math.round(basePoints * 1.5);
      audioEngine.playPowerChordFanfare();
      audioEngine.playCrowdCheer();

      try {
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.5 }
        });
      } catch {
        // ignore
      }

      onLevelComplete(stars, accuracy, totalLevelPoints);
      setShowLevelSummary(true);
    }
  };

  const handleRestartLevel = () => {
    setShowLevelSummary(false);
    setQuestionIndex(0);
    setCorrectAnswersCount(0);
    setTotalQuestionsAnswered(0);
    setupQuestion(0);
  };

  if (showLevelSummary) {
    const accuracy = Math.round((correctAnswersCount / Math.max(1, totalQuestionsAnswered)) * 100);
    let stars = 1;
    if (accuracy >= 90) stars = 3;
    else if (accuracy >= 70) stars = 2;

    return (
      <div className="w-full max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mx-auto text-3xl mb-4">
          🎸
        </div>

        <h3 className="text-3xl font-display font-black text-white tracking-tight">
          Stage Cleared, Rockstar!
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          {levelConfig.title} · {levelConfig.stageName}
        </p>

        {/* Stars Display */}
        <div className="flex items-center justify-center gap-3 my-6">
          {[1, 2, 3].map((starIdx) => (
            <span
              key={starIdx}
              className={`text-4xl sm:text-5xl transition-transform duration-300 ${
                starIdx <= stars ? 'scale-110 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'opacity-25 grayscale'
              }`}
            >
              ⭐
            </span>
          ))}
        </div>

        {/* Score & Accuracy metrics */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8 text-left">
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Ear Accuracy</span>
            <span className="text-2xl font-display font-black text-amber-400 tabular-nums">
              {accuracy}%
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">
              {correctAnswersCount} / {totalQuestionsAnswered} correct
            </span>
          </div>

          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold block uppercase">Stage Reward</span>
            <span className="text-2xl font-display font-black text-rose-400 tabular-nums">
              +{correctAnswersCount * 120 + stars * 100} pts
            </span>
            <span className="text-xs text-slate-500 block mt-0.5">
              Syncing to Leaderboard
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenLeaderboard}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105"
          >
            <Trophy className="w-4 h-4" />
            View Leaderboard
          </button>

          {onNextLevel && (
            <button
              onClick={onNextLevel}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-105"
            >
              <Sparkles className="w-4 h-4" />
              Next Level Stage
            </button>
          )}

          <button
            onClick={handleRestartLevel}
            className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Replay Level
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Top Question Tracker */}
      <div className="w-full flex items-center justify-between mb-4 px-1 text-xs font-semibold text-slate-400">
        <div>
          <span>Question </span>
          <strong className="text-white font-mono tabular-nums">{questionIndex + 1}</strong>
          <span> of </span>
          <strong className="text-white font-mono tabular-nums">{totalQuestions}</strong>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-end max-w-[260px]">
          {Array.from({ length: totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${
                idx === questionIndex
                  ? 'bg-amber-400 ring-2 ring-amber-400/40 w-3.5 scale-110'
                  : idx < questionIndex
                  ? 'bg-emerald-500 w-1.5'
                  : 'bg-slate-800 w-1.5'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Ear-Training Audio Prompt Box */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 mb-6 shadow-xl flex flex-col items-center text-center">
        <div className="flex items-center gap-2 mb-1 flex-wrap justify-center">
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
            Level {levelConfig.levelNumber} · {levelConfig.difficultyLabel}
          </span>
          <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/30">
            +{levelConfig.basePointsPerQuestion} pts
          </span>
        </div>

        <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white mb-3">
          Which rhythm did the band play?
        </h3>

        {/* Large Playback Listener Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handlePlayTarget()}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-extrabold text-base transition-all transform active:scale-95 cursor-pointer shadow-lg ${
              isPlayingTarget
                ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/30'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20 hover:scale-105'
            }`}
          >
            {isPlayingTarget ? (
              <>
                <Volume2 className="w-5 h-5 animate-bounce" />
                Playing Beat...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-slate-950" />
                Hear Rhythm Again
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80 flex-wrap justify-center text-xs">
          <span className="text-slate-400 font-medium">Instrument Sound:</span>
          <span className="font-bold text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 shadow-sm">
            <span>{kitLabels[settings.soundKit]?.icon || '🥁'}</span>
            <span>{kitLabels[settings.soundKit]?.name || 'Rock Snare'}</span>
          </span>
          {onChangeKit && (
            <div className="flex items-center gap-1 flex-wrap">
              {(['rock_kit', 'woodblock', 'cowbell_fever', 'marimba', 'triangle', 'electric_clap', 'synth_rimshot', 'agogo_bell'] as SoundKit[]).map((kitId) => {
                if (kitId === settings.soundKit) return null;
                return (
                  <button
                    key={kitId}
                    onClick={() => {
                      onChangeKit(kitId);
                      audioEngine.playUniformRhythmNote(kitId);
                    }}
                    className="px-2 py-0.5 rounded-md bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 text-[11px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={`Switch rhythm sample to ${kitLabels[kitId].name}`}
                  >
                    {kitLabels[kitId].icon} {kitLabels[kitId].name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <span className="text-xs text-slate-400 mt-2">
          Chromebook hint: Tap to listen as many times as you need!
        </span>
      </div>

      {/* Multiple Choice Cards Grid */}
      <div className="w-full grid grid-cols-1 gap-4 mb-6">
        {choices.map((choice, index) => {
          const letter = String.fromCharCode(65 + index); // A, B, C
          const isSelected = selectedChoiceId === choice.id;
          const isTarget = choice.id === targetPattern.id;

          let cardBorder = 'border-slate-800 hover:border-amber-400/60 bg-slate-900/90';
          let badgeColor = 'bg-slate-800 text-slate-300';

          if (isAnswered) {
            if (isTarget) {
              cardBorder = 'border-emerald-500 bg-emerald-950/30 ring-2 ring-emerald-500/50';
              badgeColor = 'bg-emerald-500 text-slate-950';
            } else if (isSelected) {
              cardBorder = 'border-rose-500 bg-rose-950/30 ring-2 ring-rose-500/50';
              badgeColor = 'bg-rose-500 text-white';
            } else {
              cardBorder = 'border-slate-800/40 opacity-40 bg-slate-900/40';
            }
          }

          return (
            <div
              key={choice.id}
              onClick={() => handleSelectChoice(choice)}
              className={`w-full rounded-2xl border p-4 sm:p-5 transition-all duration-150 relative cursor-pointer group shadow-lg ${cardBorder} ${
                !isAnswered ? 'hover:scale-[1.01] active:scale-[0.99]' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                {/* Choice Letter Identifier */}
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-sm transition-colors ${badgeColor}`}>
                    {letter}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">
                    {choice.name}
                  </span>
                </div>
              </div>

              {/* Musical Notation Rendering - Pure static notation, no progression reveal */}
              <div className="pointer-events-none">
                <RhythmNotation
                  pattern={choice}
                  syllableStyle={settings.syllableStyle}
                  highlightedUnitIndex={null}
                  size="md"
                />
              </div>

              {/* Status Indicator Stamp on Answer */}
              {isAnswered && (
                <div className="absolute right-4 top-4">
                  {isTarget ? (
                    <div className="flex items-center gap-1 text-emerald-400 font-bold text-xs bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                      <CheckCircle className="w-4 h-4" />
                      Correct Beat!
                    </div>
                  ) : isSelected ? (
                    <div className="flex items-center gap-1 text-rose-400 font-bold text-xs bg-rose-950/80 px-2.5 py-1 rounded-lg border border-rose-500/40">
                      <XCircle className="w-4 h-4" />
                      Not quite!
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Answer Feedback Banner & Next Button */}
      {isAnswered && (
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-3">
            {selectedChoiceId === targetPattern.id ? (
              <>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl">
                  🎸
                </div>
                <div className="text-left">
                  <span className="font-display font-extrabold text-emerald-400 block text-base leading-tight">
                    Spot On! Rockstar Ears!
                  </span>
                  <span className="text-xs text-slate-400">
                    Combo Streak: <strong className="text-amber-400">{streak}x</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xl">
                  💡
                </div>
                <div className="text-left">
                  <span className="font-display font-extrabold text-amber-400 block text-base leading-tight">
                    Keep Rocking! The answer was highlighted above.
                  </span>
                  <span className="text-xs text-slate-400">
                    Listen to the note syllables to lock in the groove.
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={handleNextQuestion}
            className="w-full sm:w-auto px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-400/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>{questionIndex + 1 < levelConfig.patterns.length ? 'Next Beat' : 'See Results'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
