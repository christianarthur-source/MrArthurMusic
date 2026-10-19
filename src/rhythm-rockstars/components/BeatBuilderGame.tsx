import React, { useState, useEffect } from 'react';
import { RhythmPattern, RhythmUnit, LevelConfig } from '../types/rhythm';
import { createUnit } from '../data/rhythmCatalog';
import { NoteGlyphSVG } from './RhythmNotation';
import { audioEngine } from '../services/audioEngine';
import { SoundSettingsConfig } from '../types/game';
import { formatCountingSyllable } from '../utils/rhythmCounting';
import { Play, Check, Trash2, ArrowRight, Volume2, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BeatBuilderGameProps {
  levelConfig: LevelConfig;
  settings: SoundSettingsConfig;
  onPatternComplete: (points: number, isCorrect: boolean) => void;
  streak: number;
}

export const BeatBuilderGame: React.FC<BeatBuilderGameProps> = ({
  levelConfig,
  settings,
  onPatternComplete,
  streak
}) => {
  const [patternIndex, setPatternIndex] = useState(0);
  const targetPattern = levelConfig.patterns[patternIndex % levelConfig.patterns.length];

  // 4 slots for 4 beats
  const [slots, setSlots] = useState<(RhythmUnit | null)[]>([null, null, null, null]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number>(0);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingBuilt, setIsPlayingBuilt] = useState(false);
  const [checkResult, setCheckResult] = useState<'CORRECT' | 'WRONG' | null>(null);

  // Available palette units tailored to level
  const paletteUnits: RhythmUnit[] = [
    createUnit.quarter(),
    createUnit.eighthPair(),
    createUnit.quarterRest(),
    ...(levelConfig.levelNumber >= 3 ? [createUnit.sixteenthQuad()] : []),
    ...(levelConfig.levelNumber >= 4
      ? [createUnit.brokenEighthTwoSixteenth(), createUnit.brokenTwoSixteenthEighth()]
      : []),
    ...(levelConfig.levelNumber >= 5 ? [createUnit.triplet()] : [])
  ];

  useEffect(() => {
    // Reset slots on new target
    setSlots([null, null, null, null]);
    setSelectedSlotIndex(0);
    setCheckResult(null);
    audioEngine.stopAll();
    setIsPlayingTarget(false);
    setIsPlayingBuilt(false);

    // Play target rhythm once
    setTimeout(() => {
      handlePlayTarget();
    }, 400);
  }, [patternIndex, levelConfig.levelNumber]);

  const handlePlayTarget = async () => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.stopAll();
      setIsPlayingTarget(false);
      return;
    }

    setIsPlayingTarget(true);
    setIsPlayingBuilt(false);
    await audioEngine.playPattern(
      targetPattern,
      settings.tempoBpm,
      settings.soundKit,
      true,
      (p) => {
        if (p.isFinished) setIsPlayingTarget(false);
      }
    );
  };

  const handleAssignUnitToSlot = (unit: RhythmUnit) => {
    const updated = [...slots];
    updated[selectedSlotIndex] = unit;
    setSlots(updated);
    setCheckResult(null);

    // Advance to next slot automatically
    if (selectedSlotIndex < 3) {
      setSelectedSlotIndex(selectedSlotIndex + 1);
    }
  };

  const handleClearSlot = (slotIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...slots];
    updated[slotIdx] = null;
    setSlots(updated);
    setSelectedSlotIndex(slotIdx);
    setCheckResult(null);
  };

  const handlePlayBuilt = async () => {
    const filledUnits = slots.filter((u): u is RhythmUnit => u !== null);
    if (filledUnits.length === 0) return;

    if (audioEngine.getIsPlaying()) {
      audioEngine.stopAll();
      setIsPlayingBuilt(false);
      return;
    }

    const customPattern: RhythmPattern = {
      id: 'custom_built',
      name: 'Your Groove',
      level: levelConfig.levelNumber,
      timeSignature: '4/4',
      totalBeats: filledUnits.reduce((acc, u) => acc + u.durationBeats, 0),
      units: filledUnits,
      difficulty: 'Junior',
      tags: []
    };

    setIsPlayingBuilt(true);
    setIsPlayingTarget(false);
    await audioEngine.playPattern(
      customPattern,
      settings.tempoBpm,
      settings.soundKit,
      false,
      (p) => {
        if (p.isFinished) setIsPlayingBuilt(false);
      }
    );
  };

  const handleSubmitCheck = () => {
    // Check if slots are fully filled
    if (slots.some(s => s === null)) {
      alert('Please fill all 4 beats before submitting your groove!');
      return;
    }

    const targetUnits = targetPattern.units;
    let matches = true;

    if (targetUnits.length !== slots.length) {
      matches = false;
    } else {
      for (let i = 0; i < 4; i++) {
        if (slots[i]?.type !== targetUnits[i]?.type) {
          matches = false;
          break;
        }
      }
    }

    if (matches) {
      setCheckResult('CORRECT');
      audioEngine.playPowerChordFanfare();
      try {
        confetti({ particleCount: 70, spread: 70 });
      } catch {
        // ignore
      }
      const basePoints = levelConfig.basePointsPerQuestion || 100;
      onPatternComplete(Math.round(basePoints * 1.2 + streak * 30), true);
    } else {
      setCheckResult('WRONG');
      audioEngine.playGentleOops();
      onPatternComplete(0, false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center max-w-3xl mx-auto">
      {/* Target Audio Challenge Box */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl text-center">
        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block mb-1">
          🔨 Beat Builder Detective
        </span>
        <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white mb-2">
          Listen to the Mystery Groove & Rebuild It!
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Click a note block from the tool rack below to place it into each beat slot.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handlePlayTarget}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
              isPlayingTarget
                ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30 animate-pulse'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md shadow-amber-400/20'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{isPlayingTarget ? 'Playing Mystery Groove...' : 'Hear Mystery Groove'}</span>
          </button>
        </div>
      </div>

      {/* 4 Beat Construction Slots */}
      <div className="w-full bg-slate-950/80 border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 shadow-inner">
        <div className="flex items-center justify-between mb-3 px-1 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider">Your 4/4 Beat Slots:</span>
          <span>Click a slot to edit</span>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {[0, 1, 2, 3].map((slotIdx) => {
            const unit = slots[slotIdx];
            const isSelected = selectedSlotIndex === slotIdx;

            return (
              <div
                key={slotIdx}
                onClick={() => setSelectedSlotIndex(slotIdx)}
                className={`flex flex-col items-center justify-center min-h-[120px] sm:min-h-[140px] rounded-2xl border-2 p-2 sm:p-3 transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                    : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                }`}
              >
                {/* Slot Beat Number */}
                <div className="absolute top-2 left-2 text-[10px] font-bold font-mono text-slate-500">
                  BEAT {slotIdx + 1}
                </div>

                {unit ? (
                  <>
                    <button
                      onClick={(e) => handleClearSlot(slotIdx, e)}
                      className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                      title="Clear Beat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="my-auto scale-90">
                      <NoteGlyphSVG type={unit.type} size="md" />
                    </div>
                    {settings.syllableStyle !== 'none' && (
                      <span className="text-[11px] font-bold text-amber-300 mt-1">
                        {settings.syllableStyle === 'kodaly'
                          ? unit.syllableKodaly
                          : formatCountingSyllable(unit, slotIdx + 1)}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="my-auto flex flex-col items-center text-slate-600">
                    <span className="text-2xl font-light">+</span>
                    <span className="text-[10px] font-semibold mt-1">Empty Beat</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Blocks Palette */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3 text-center sm:text-left">
          🎼 Note Block Rack (Tap to insert at Beat {selectedSlotIndex + 1})
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {paletteUnits.map((u, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleAssignUnitToSlot(u)}
              className="flex flex-col items-center p-3 bg-slate-950 hover:bg-slate-800 active:scale-95 border border-slate-800 hover:border-amber-400/60 rounded-2xl transition-all cursor-pointer group min-w-[76px] sm:min-w-[88px]"
            >
              <div className="scale-75 group-hover:scale-85 transition-transform">
                <NoteGlyphSVG type={u.type} size="sm" />
              </div>
              {settings.syllableStyle !== 'none' && (
                <span className="text-xs font-bold text-slate-200 mt-1 group-hover:text-amber-400">
                  {settings.syllableStyle === 'kodaly'
                    ? u.syllableKodaly
                    : formatCountingSyllable(u, selectedSlotIndex + 1)}
                </span>
              )}
              <span className="text-[10px] text-slate-500">{u.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons & Feedback */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePlayBuilt}
            disabled={slots.every(s => s === null)}
            className="flex-1 sm:flex-initial px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>{isPlayingBuilt ? 'Playing Your Beat...' : 'Test My Built Beat'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSubmitCheck}
            disabled={slots.some(s => s === null)}
            className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Submit Beat to Band!</span>
          </button>

          {checkResult === 'CORRECT' && (
            <button
              onClick={() => setPatternIndex(prev => prev + 1)}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
            >
              <span>Next Groove</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Result Alert */}
      {checkResult && (
        <div className="w-full mt-4">
          {checkResult === 'CORRECT' ? (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-center font-bold text-sm flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>You solved the mystery groove! Exact match! +Points awarded!</span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-center font-bold text-sm">
              <span>Not quite matching the mystery rhythm! Listen again and compare beat by beat.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
