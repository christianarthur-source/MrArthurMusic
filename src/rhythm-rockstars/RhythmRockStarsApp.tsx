/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GameMode, StudentProfile, SoundSettingsConfig } from './types/game';
import { LEVELS_CONFIG } from './data/rhythmCatalog';
import { apiClient } from './services/apiClient';
import { audioEngine } from './services/audioEngine';
import { Navbar } from './components/Navbar';
import { StageHeader } from './components/StageHeader';
import { LevelSelect } from './components/LevelSelect';
import { QuizGame } from './components/QuizGame';
import { TapGame } from './components/TapGame';
import { BeatBuilderGame } from './components/BeatBuilderGame';
import { RhythmQuizGame } from './components/RhythmQuizGame';
import { LeaderboardModal } from './components/LeaderboardModal';
import confetti from 'canvas-confetti';
import { SoundSettings } from './components/SoundSettings';
import { Trophy, Music, Zap, Flame, Award, Sparkles, Volume2 } from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';

export interface RhythmRockStarsAppProps {
  onBackToHub?: () => void;
  studentSession?: StudentSession | null;
  onOpenClassroomModal?: () => void;
  onOpenAvatar?: () => void;
}

export default function RhythmRockStarsApp({
  onBackToHub,
  studentSession = null,
  onOpenClassroomModal = () => {},
  onOpenAvatar = () => {},
}: RhythmRockStarsAppProps = {}) {
  // Current Student Session
  const [student, setStudent] = useState<StudentProfile | null>(() => apiClient.getLocalProfile());

  // Game Navigation & State
  const [currentMode, setCurrentMode] = useState<GameMode>('quiz');
  const [currentLevelNumber, setCurrentLevelNumber] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);

  // Secret Easter Egg Level 7 State - Hidden until secret button is clicked
  const [isSecretUnlocked, setIsSecretUnlocked] = useState<boolean>(false);
  const [secretToast, setSecretToast] = useState<string | null>(null);

  // Available levels based on secret unlock state
  const availableLevels = LEVELS_CONFIG.filter(l => l.levelNumber !== 7 || isSecretUnlocked);

  // Sound & Classroom Settings
  const [soundSettings, setSoundSettings] = useState<SoundSettingsConfig>({
    volume: 0.85,
    tempoBpm: 96,
    soundKit: 'rock_kit',
    countIn: true,
    syllableStyle: 'numbers',
    soundEffectsEnabled: true
  });
  const [isMuted, setIsMuted] = useState(false);

  // Playback & Stage Visual State
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number | null>(null);
  const [isCountIn, setIsCountIn] = useState(false);

  // Modals
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLevelMap, setShowLevelMap] = useState(false);

  // Synchronize global student session
  useEffect(() => {
    if (studentSession) {
      const existing = apiClient.getLocalProfile();
      if (!existing || existing.name !== studentSession.firstName) {
        const synced: StudentProfile = {
          id: studentSession.id,
          name: studentSession.firstName,
          avatar: '🎸',
          passcode: studentSession.pin || '1234',
          classCode: studentSession.classGroup || 'Classroom',
          totalScore: existing?.totalScore || 0,
          highestStreak: existing?.highestStreak || 0,
          quizzesCompleted: existing?.quizzesCompleted || 0,
          levelProgress: existing?.levelProgress || { 1: { stars: 3, highAccuracy: 100 } },
          badges: existing?.badges || ['rockstar_rookie'],
          updatedAt: new Date().toISOString(),
        };
        apiClient.saveLocalProfile(synced);
        setStudent(synced);
      } else {
        setStudent(existing);
      }
    } else {
      setStudent(null);
    }
  }, [studentSession]);

  // Active level config
  const activeLevelConfig = LEVELS_CONFIG.find(l => l.levelNumber === currentLevelNumber) || LEVELS_CONFIG[0];

  // Secret Level Unlock Handler
  const handleUnlockSecretLevel = () => {
    setIsSecretUnlocked(true);
    localStorage.setItem('denti_secret_l7_unlocked', 'true');
    setCurrentLevelNumber(7);
    audioEngine.playPowerChordFanfare();
    try {
      confetti({
        particleCount: 140,
        spread: 120,
        origin: { y: 0.15 },
        colors: ['#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']
      });
    } catch {
      // ignore
    }
    setSecretToast('⚡ SECRET LEVEL 7 UNLOCKED! Master Rockstar Underground Arena Activated (+750 PTS)!');
    setTimeout(() => {
      setSecretToast(null);
    }, 7000);
  };

  // Stop audio when changing modes or levels
  useEffect(() => {
    audioEngine.stopAll();
    setIsPlaying(false);
    setActiveBeat(null);
    setIsCountIn(false);
  }, [currentMode, currentLevelNumber]);

  // Handle Level Playback from Stage Header
  const handlePlayLevelBeat = async () => {
    if (isPlaying) {
      audioEngine.stopAll();
      setIsPlaying(false);
      setActiveBeat(null);
      setIsCountIn(false);
      return;
    }

    setIsPlaying(true);
    const pattern = activeLevelConfig.patterns[0];

    await audioEngine.playPattern(
      pattern,
      soundSettings.tempoBpm,
      soundSettings.soundKit,
      soundSettings.countIn,
      (progress) => {
        if (progress.isCountIn && progress.countInBeat !== undefined) {
          setIsCountIn(true);
          setActiveBeat(progress.countInBeat);
        } else if (progress.beatIndex !== undefined) {
          setIsCountIn(false);
          setActiveBeat(progress.beatIndex);
        }
        if (progress.isFinished) {
          setIsPlaying(false);
          setActiveBeat(null);
          setIsCountIn(false);
        }
      }
    );
  };

  const handleStopLevelBeat = () => {
    audioEngine.stopAll();
    setIsPlaying(false);
    setActiveBeat(null);
    setIsCountIn(false);
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
  };

  const handleUpdateSettings = (updated: Partial<SoundSettingsConfig>) => {
    setSoundSettings(prev => ({ ...prev, ...updated }));
  };

  // Score & Streak Recording
  const handlePatternComplete = async (pointsEarned: number, isCorrect: boolean) => {
    if (isCorrect) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);

      // Check badges for streak
      const newBadges: string[] = [];
      if (nextStreak >= 3 && !student?.badges.includes('streak_3')) newBadges.push('streak_3');
      if (nextStreak >= 5 && !student?.badges.includes('streak_5')) newBadges.push('streak_5');
      if (nextStreak >= 10 && !student?.badges.includes('streak_10')) newBadges.push('streak_10');

      if (student) {
        const updated = await apiClient.submitScore({
          studentId: student.id,
          pointsEarned,
          streak: nextStreak,
          level: currentLevelNumber,
          stars: 0,
          accuracy: 100,
          newBadges
        });
        if (updated) setStudent(updated);
      }
    } else {
      setStreak(0);
    }
  };

  const handleLevelComplete = async (stars: number, accuracy: number, points: number) => {
    const newBadges: string[] = [];
    if (activeLevelConfig.badgeId && !student?.badges.includes(activeLevelConfig.badgeId)) {
      newBadges.push(activeLevelConfig.badgeId);
    }
    if (accuracy === 100 && !student?.badges.includes('perfect_round')) {
      newBadges.push('perfect_round');
    }

    if (student) {
      const updated = await apiClient.submitScore({
        studentId: student.id,
        pointsEarned: points,
        streak,
        level: currentLevelNumber,
        stars,
        accuracy,
        newBadges
      });
      if (updated) setStudent(updated);
    }
  };

  const handleNextLevel = () => {
    const maxLvl = isSecretUnlocked ? 7 : 6;
    if (currentLevelNumber < maxLvl) {
      setCurrentLevelNumber(prev => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 relative">
      {/* Universal Top Bar */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={(mode) => setCurrentMode(mode)}
        studentSession={studentSession}
        studentScore={student?.totalScore ?? 0}
        onOpenClassroomModal={onOpenClassroomModal}
        onOpenAvatar={onOpenAvatar}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        onOpenSettings={() => setShowSettings(true)}
        streak={streak}
        isSecretUnlocked={isSecretUnlocked}
        onUnlockSecretLevel={handleUnlockSecretLevel}
        onBackToHub={onBackToHub}
      />

      {/* Secret Toast Banner */}
      {secretToast && (
        <div className="bg-gradient-to-r from-red-600 via-purple-600 to-amber-500 text-white font-extrabold px-4 py-3 text-center shadow-2xl border-b-2 border-amber-300 animate-bounce z-50 flex items-center justify-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
          <span className="text-sm sm:text-base tracking-wide">{secretToast}</span>
          <button
            onClick={() => setSecretToast(null)}
            className="ml-4 text-xs bg-black/40 hover:bg-black/60 px-2 py-1 rounded-lg border border-white/30 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Classroom Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        {/* Stage Header with 4-Beat Light System & Playback */}
        <StageHeader
          stageName={activeLevelConfig.stageName}
          levelNumber={activeLevelConfig.levelNumber}
          activeBeat={currentMode === 'quiz' ? null : activeBeat}
          isCountIn={isCountIn}
          isPlaying={isPlaying}
          onPlayRhythm={handlePlayLevelBeat}
          onStopRhythm={handleStopLevelBeat}
          soundKit={soundSettings.soundKit}
          onSelectKit={(kit) => {
            handleUpdateSettings({ soundKit: kit });
            audioEngine.playUniformRhythmNote(kit);
          }}
          tempoBpm={soundSettings.tempoBpm}
          onSetTempo={(bpm) => setSoundSettings(prev => ({ ...prev, tempoBpm: bpm }))}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          streak={streak}
          showPlayControls={currentMode !== 'quiz'}
          currentMode={currentMode}
        />

        {/* Quick Level Options Ribbon / Slider */}
        <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 sm:p-3 mb-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Level Options:
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
              activeLevelConfig.levelNumber === 7
                ? 'bg-purple-950 text-amber-300 border-purple-500/80 animate-pulse'
                : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
            }`}>
              {activeLevelConfig.levelNumber === 7 ? '⚡ Secret Lvl 7' : `Lvl ${activeLevelConfig.levelNumber}`} (+{activeLevelConfig.basePointsPerQuestion} pts)
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
            {availableLevels.map((lvl) => {
              const isCurrent = currentLevelNumber === lvl.levelNumber;
              const isSecret = lvl.levelNumber === 7;
              return (
                <button
                  key={lvl.levelNumber}
                  onClick={() => setCurrentLevelNumber(lvl.levelNumber)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSecret
                      ? isCurrent
                        ? 'bg-gradient-to-r from-red-600 via-purple-600 to-amber-400 text-white shadow-lg shadow-purple-500/40 ring-2 ring-amber-300 scale-105'
                        : 'bg-purple-950/90 text-amber-300 hover:text-white border border-purple-500/60'
                      : isCurrent
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-400/20 scale-105 ring-1 ring-amber-300'
                      : 'bg-slate-950/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={`${lvl.title}: ${lvl.difficultyLabel} (+${lvl.basePointsPerQuestion} pts)`}
                >
                  <span>{lvl.badgeIcon}</span>
                  <span>{isSecret ? '⚡ Secret Lvl 7' : `Lvl ${lvl.levelNumber}`}</span>
                  <span className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                    isCurrent ? 'bg-slate-950/30 text-slate-950 font-black' : 'text-amber-400 bg-slate-900'
                  }`}>
                    +{lvl.basePointsPerQuestion}pts
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowLevelMap(!showLevelMap)}
            className="text-xs font-bold text-slate-300 hover:text-amber-400 flex items-center justify-end gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span>{showLevelMap ? 'Hide Details ▲' : 'All Rhythms Info ▼'}</span>
          </button>
        </div>

        {/* Collapsible Stage Selector Map */}
        {showLevelMap && (
          <LevelSelect
            levels={availableLevels}
            currentLevelNumber={currentLevelNumber}
            onSelectLevel={(lvlNum) => {
              setCurrentLevelNumber(lvlNum);
              setShowLevelMap(false);
            }}
            student={student}
          />
        )}

        {/* Active Mini-Game View */}
        <div className="flex-1 w-full pb-8">
          {currentMode === 'quiz' && (
            <QuizGame
              levelConfig={activeLevelConfig}
              settings={soundSettings}
              onPatternComplete={handlePatternComplete}
              onLevelComplete={handleLevelComplete}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
              onNextLevel={currentLevelNumber < LEVELS_CONFIG.length ? handleNextLevel : undefined}
              onChangeKit={(kit) => {
                handleUpdateSettings({ soundKit: kit });
                audioEngine.playUniformRhythmNote(kit);
              }}
              streak={streak}
            />
          )}

          {currentMode === 'tap' && (
            <TapGame
              levelConfig={activeLevelConfig}
              settings={soundSettings}
              onPatternComplete={handlePatternComplete}
              streak={streak}
            />
          )}

          {currentMode === 'builder' && (
            <BeatBuilderGame
              levelConfig={activeLevelConfig}
              settings={soundSettings}
              onPatternComplete={handlePatternComplete}
              streak={streak}
            />
          )}

          {currentMode === 'rhythm_quiz' && (
            <RhythmQuizGame
              levelConfig={activeLevelConfig}
              settings={soundSettings}
              onPatternComplete={handlePatternComplete}
              onLevelComplete={handleLevelComplete}
              onOpenLeaderboard={() => setShowLeaderboard(true)}
              onNextLevel={currentLevelNumber < LEVELS_CONFIG.length ? handleNextLevel : undefined}
              streak={streak}
            />
          )}
        </div>

        {/* Featured Live Leaderboard Teaser Strip for Constant Engagement */}
        <div className="mt-auto pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 rounded-2xl p-4 border border-slate-800/80">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 flex items-center justify-center text-amber-400 text-xl font-bold shrink-0">
              🏆
            </div>
            <div>
              <span className="font-display font-extrabold text-white text-sm block">
                Leaderboard is Live!
              </span>
              <span className="text-xs text-slate-400">
                {student ? (
                  <>
                    Your Standing: <strong className="text-amber-400">Level {Math.max(1, ...Object.keys(student.levelProgress || {}).map(Number))}</strong> · <strong className="text-white font-mono">{student.totalScore.toLocaleString()} pts</strong>
                  </>
                ) : (
                  'Compete with players across all Chromebooks in real-time.'
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!studentSession ? (
              <button
                onClick={onOpenClassroomModal}
                className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Sign In to Save Scores
              </button>
            ) : null}

            <button
              onClick={() => setShowLeaderboard(true)}
              className="w-full sm:w-auto px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer font-['Fredoka',sans-serif]"
            >
              View Class Leaderboard
            </button>
          </div>
        </div>
      </main>

      {/* Modals */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        currentStudent={student}
        onPlayNow={() => setCurrentMode('quiz')}
      />

      <SoundSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={soundSettings}
        onChangeSettings={handleUpdateSettings}
      />
    </div>
  );
}
