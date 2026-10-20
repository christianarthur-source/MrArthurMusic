import React, { useState, useEffect, useMemo } from 'react';
import { RhythmPattern, RhythmUnit, LevelConfig } from '../types/rhythm';
import { createUnit } from '../data/rhythmCatalog';
import { NoteGlyphSVG } from './RhythmNotation';
import { audioEngine } from '../services/audioEngine';
import { SoundSettingsConfig } from '../types/game';
import { formatCountingSyllable } from '../utils/rhythmCounting';
import { Play, Check, Trash2, ArrowRight, Volume2, Sparkles, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';

interface BeatBuilderGameProps {
  levelConfig: LevelConfig;
  settings: SoundSettingsConfig;
  onPatternComplete: (points: number, isCorrect: boolean) => void;
  streak: number;
}

type PaletteCategory = 'all' | 'basics' | 'eighths' | 'sixteenths' | 'syncopa_triplets';

export const BeatBuilderGame: React.FC<BeatBuilderGameProps> = ({
  levelConfig,
  settings,
  onPatternComplete,
  streak
}) => {
  const [patternIndex, setPatternIndex] = useState(0);
  const targetPattern = levelConfig.patterns[patternIndex % levelConfig.patterns.length];

  // Placed rhythm units in the 4-beat measure
  const [placedUnits, setPlacedUnits] = useState<RhythmUnit[]>([]);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [isPlayingBuilt, setIsPlayingBuilt] = useState(false);
  const [playingUnitIndex, setPlayingUnitIndex] = useState<number | null>(null);
  const [checkResult, setCheckResult] = useState<'CORRECT' | 'WRONG' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<PaletteCategory>('all');
  const [showAllBlocks, setShowAllBlocks] = useState(false);

  // Calculate current filled beats
  const totalBeatsPlaced = useMemo(() => {
    return placedUnits.reduce((acc, u) => acc + u.durationBeats, 0);
  }, [placedUnits]);

  const beatsRemaining = Math.max(0, 4 - totalBeatsPlaced);

  // Full comprehensive catalog of all rhythm units
  const fullPaletteCatalog: { unit: RhythmUnit; category: PaletteCategory; minLevel: number }[] = useMemo(() => [
    // Basics & Rests
    { unit: createUnit.quarter(), category: 'basics', minLevel: 1 },
    { unit: createUnit.quarterRest(), category: 'basics', minLevel: 1 },
    { unit: createUnit.half(), category: 'basics', minLevel: 1 },
    { unit: createUnit.halfRest(), category: 'basics', minLevel: 1 },

    // Eighths & Offbeat Rests
    { unit: createUnit.eighthPair(), category: 'eighths', minLevel: 2 },
    { unit: createUnit.eighthRestEighth(), category: 'eighths', minLevel: 2 },
    { unit: createUnit.eighthEighthRest(), category: 'eighths', minLevel: 2 },

    // Sixteenths & Broken 16th Patterns
    { unit: createUnit.sixteenthQuad(), category: 'sixteenths', minLevel: 3 },
    { unit: createUnit.brokenEighthTwoSixteenth(), category: 'sixteenths', minLevel: 4 },
    { unit: createUnit.brokenTwoSixteenthEighth(), category: 'sixteenths', minLevel: 4 },
    { unit: createUnit.brokenDottedSixteenth(), category: 'sixteenths', minLevel: 4 },
    { unit: createUnit.brokenSixteenthDotted(), category: 'sixteenths', minLevel: 4 },
    { unit: createUnit.sixteenthEighthSixteenth(), category: 'sixteenths', minLevel: 4 },

    // Triplets & Syncopation
    { unit: createUnit.triplet(), category: 'syncopa_triplets', minLevel: 5 },
    { unit: createUnit.syncopationBeat(), category: 'syncopa_triplets', minLevel: 5 },
  ], []);

  // Filter palette units tailored to level, category, and target pattern guarantee
  const visiblePaletteUnits = useMemo(() => {
    const unitsMap = new Map<string, RhythmUnit>();

    // 1. Add unlocked units (or all if showAllBlocks toggle is on)
    fullPaletteCatalog.forEach(item => {
      const isLevelUnlocked = showAllBlocks || levelConfig.levelNumber >= item.minLevel;
      const isCategoryMatch = selectedCategory === 'all' || item.category === selectedCategory;
      if (isLevelUnlocked && isCategoryMatch) {
        unitsMap.set(item.unit.type, item.unit);
      }
    });

    // 2. CRITICAL GUARANTEE: Ensure EVERY unit present in targetPattern is ALWAYS present in palette
    targetPattern.units.forEach(tu => {
      if (!unitsMap.has(tu.type)) {
        unitsMap.set(tu.type, tu);
      }
    });

    return Array.from(unitsMap.values());
  }, [fullPaletteCatalog, levelConfig.levelNumber, selectedCategory, showAllBlocks, targetPattern]);

  useEffect(() => {
    // Reset placed units on new target pattern
    setPlacedUnits([]);
    setSelectedUnitIndex(null);
    setCheckResult(null);
    setPlayingUnitIndex(null);
    audioEngine.stopAll();
    setIsPlayingTarget(false);
    setIsPlayingBuilt(false);

    // Play target rhythm once
    const timer = setTimeout(() => {
      handlePlayTarget();
    }, 450);

    return () => clearTimeout(timer);
  }, [patternIndex, levelConfig.levelNumber]);

  const handlePlayTarget = async () => {
    if (audioEngine.getIsPlaying()) {
      audioEngine.stopAll();
      setIsPlayingTarget(false);
      return;
    }

    setIsPlayingTarget(true);
    setIsPlayingBuilt(false);
    setPlayingUnitIndex(null);

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

  const handleAddUnit = (unit: RhythmUnit) => {
    setCheckResult(null);

    // If a unit is currently selected, try to replace it:
    if (selectedUnitIndex !== null && selectedUnitIndex < placedUnits.length) {
      const existing = placedUnits[selectedUnitIndex];
      const beatsWithoutExisting = totalBeatsPlaced - existing.durationBeats;
      if (beatsWithoutExisting + unit.durationBeats <= 4) {
        const next = [...placedUnits];
        next[selectedUnitIndex] = unit;
        setPlacedUnits(next);
        setSelectedUnitIndex(null);
        return;
      }
    }

    // Otherwise, append to measure if it fits within 4 beats
    if (totalBeatsPlaced + unit.durationBeats <= 4) {
      setPlacedUnits(prev => [...prev, unit]);
      setSelectedUnitIndex(null);
    } else {
      alert(`"${unit.name}" takes ${unit.durationBeats} beat(s), but only ${beatsRemaining} beat(s) remain in this 4-beat measure. Clear a block or pick a smaller rhythm!`);
    }
  };

  const handleRemoveUnit = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCheckResult(null);
    setPlacedUnits(prev => prev.filter((_, idx) => idx !== index));
    if (selectedUnitIndex === index) {
      setSelectedUnitIndex(null);
    } else if (selectedUnitIndex !== null && selectedUnitIndex > index) {
      setSelectedUnitIndex(selectedUnitIndex - 1);
    }
  };

  const handleClearAll = () => {
    setCheckResult(null);
    setPlacedUnits([]);
    setSelectedUnitIndex(null);
  };

  const handlePlayBuilt = async () => {
    if (placedUnits.length === 0) return;

    if (audioEngine.getIsPlaying()) {
      audioEngine.stopAll();
      setIsPlayingBuilt(false);
      setPlayingUnitIndex(null);
      return;
    }

    const customPattern: RhythmPattern = {
      id: 'custom_built',
      name: 'Your Groove',
      level: levelConfig.levelNumber,
      timeSignature: '4/4',
      totalBeats: totalBeatsPlaced,
      units: placedUnits,
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
        if (p.unitIndex !== undefined) {
          setPlayingUnitIndex(p.unitIndex);
        }
        if (p.isFinished) {
          setIsPlayingBuilt(false);
          setPlayingUnitIndex(null);
        }
      }
    );
  };

  const handleSubmitCheck = () => {
    // 1. Check if measure is complete (strictly 4 beats)
    if (totalBeatsPlaced < 4) {
      alert(`Your groove has ${totalBeatsPlaced} beats. Please fill all 4 beats before submitting!`);
      return;
    }

    const targetUnits = targetPattern.units;
    let matches = true;

    if (targetUnits.length !== placedUnits.length) {
      matches = false;
    } else {
      for (let i = 0; i < targetUnits.length; i++) {
        if (placedUnits[i]?.type !== targetUnits[i]?.type) {
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

  // Compute beat start numbers for placed units
  const placedUnitsWithBeats = useMemo(() => {
    let accumulated = 0;
    return placedUnits.map((u, idx) => {
      const startBeat = Math.floor(accumulated) + 1;
      const endBeat = startBeat + u.durationBeats - 1;
      accumulated += u.durationBeats;
      return {
        unit: u,
        index: idx,
        startBeat,
        endBeat,
        durationBeats: u.durationBeats
      };
    });
  }, [placedUnits]);

  // Remaining empty beat numbers (1..4)
  const emptyBeats = useMemo(() => {
    const list: number[] = [];
    for (let b = totalBeatsPlaced + 1; b <= 4; b++) {
      list.push(b);
    }
    return list;
  }, [totalBeatsPlaced]);

  return (
    <div className="w-full flex flex-col items-center max-w-4xl mx-auto px-2 sm:px-4">
      {/* Target Audio Challenge Box */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl text-center">
        <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block mb-1">
          🔨 Beat Builder Detective · Level {levelConfig.levelNumber}
        </span>
        <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white mb-2">
          Listen to the Mystery Groove & Rebuild It!
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Tap rhythm blocks from the rack to fill exactly 4 beats in the measure.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handlePlayTarget}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
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

      {/* 4-Beat Measure Construction Bar */}
      <div className="w-full bg-slate-950/90 border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 shadow-2xl relative">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Your 4/4 Measure:
            </span>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                totalBeatsPlaced === 4
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {totalBeatsPlaced === 4 ? 'Full Measure (4/4 Beats)' : `${totalBeatsPlaced} / 4 Beats`}
            </span>
          </div>

          {placedUnits.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-xs font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Measure</span>
            </button>
          )}
        </div>

        {/* 4-Column Measure Grid */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full">
          {/* Placed Units */}
          {placedUnitsWithBeats.map(({ unit, index, startBeat, endBeat, durationBeats }) => {
            const isSelected = selectedUnitIndex === index;
            const isPlayingThis = isPlayingBuilt && playingUnitIndex === index;
            const spanClass = durationBeats === 2 ? 'col-span-2' : durationBeats === 4 ? 'col-span-4' : 'col-span-1';

            return (
              <div
                key={`placed-${index}`}
                onClick={() => setSelectedUnitIndex(isSelected ? null : index)}
                className={`${spanClass} flex flex-col items-center justify-between min-h-[140px] sm:min-h-[160px] rounded-2xl border-2 p-3 transition-all cursor-pointer relative group ${
                  isPlayingThis
                    ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_20px_rgba(52,211,153,0.4)] scale-[1.02]'
                    : isSelected
                    ? 'border-amber-400 bg-amber-400/15 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                    : 'border-slate-700/80 bg-slate-900/80 hover:border-slate-600'
                }`}
              >
                {/* Beat Span Header */}
                <div className="w-full flex items-center justify-between">
                  <span className="text-[10px] font-extrabold font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                    {durationBeats > 1 ? `BEATS ${startBeat}-${endBeat}` : `BEAT ${startBeat}`}
                  </span>
                  <button
                    onClick={(e) => handleRemoveUnit(index, e)}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-md transition-colors"
                    title="Remove Note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Note Glyph SVG */}
                <div className="my-auto scale-90 sm:scale-100 flex items-center justify-center">
                  <NoteGlyphSVG type={unit.type} size="md" />
                </div>

                {/* Syllable Label */}
                {settings.syllableStyle !== 'none' && (
                  <span className="text-[11px] sm:text-xs font-bold text-amber-300">
                    {settings.syllableStyle === 'kodaly'
                      ? unit.syllableKodaly
                      : formatCountingSyllable(unit, startBeat)}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 truncate max-w-full">{unit.name}</span>
              </div>
            );
          })}

          {/* Empty Beat Placeholders */}
          {emptyBeats.map((beatNum) => (
            <div
              key={`empty-${beatNum}`}
              className="col-span-1 flex flex-col items-center justify-center min-h-[140px] sm:min-h-[160px] rounded-2xl border-2 border-dashed border-slate-800 bg-slate-900/40 p-3 text-slate-600 hover:border-slate-700 transition-all select-none"
            >
              <span className="text-[10px] font-mono font-bold text-slate-500 mb-2">
                BEAT {beatNum}
              </span>
              <span className="text-3xl font-light text-slate-600 mb-1">+</span>
              <span className="text-[10px] font-semibold text-slate-500">Empty Beat</span>
            </div>
          ))}
        </div>
      </div>

      {/* Note Blocks Palette Rack */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl">
        {/* Category Filter Chips & Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-widest text-center sm:text-left">
            🎼 Rhythm Block Rack (Tap to Add {selectedUnitIndex !== null ? 'or Replace' : ''})
          </span>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Blocks
            </button>
            <button
              onClick={() => setSelectedCategory('basics')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'basics'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Notes & Rests
            </button>
            <button
              onClick={() => setSelectedCategory('eighths')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'eighths'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              8ths & Rests
            </button>
            <button
              onClick={() => setSelectedCategory('sixteenths')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'sixteenths'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              16ths & Broken
            </button>
            <button
              onClick={() => setSelectedCategory('syncopa_triplets')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'syncopa_triplets'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Syncopa & Triplets
            </button>

            <button
              onClick={() => setShowAllBlocks(prev => !prev)}
              className="text-[11px] font-bold text-amber-400/90 hover:text-amber-300 underline underline-offset-4 ml-1 cursor-pointer"
            >
              {showAllBlocks ? 'Level Mode' : 'Unlock All Blocks'}
            </button>
          </div>
        </div>

        {/* Blocks Grid */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {visiblePaletteUnits.map((u, pIdx) => {
            const nextBeatNum = totalBeatsPlaced + 1;
            const fits = totalBeatsPlaced + u.durationBeats <= 4 || selectedUnitIndex !== null;

            return (
              <button
                key={`${u.type}-${pIdx}`}
                onClick={() => handleAddUnit(u)}
                disabled={!fits}
                className={`flex flex-col items-center p-2.5 sm:p-3 bg-slate-950 border rounded-2xl transition-all cursor-pointer group min-w-[80px] sm:min-w-[96px] ${
                  fits
                    ? 'hover:bg-slate-800 border-slate-800 hover:border-amber-400/70 active:scale-95'
                    : 'opacity-40 border-slate-900 cursor-not-allowed'
                }`}
                title={
                  fits
                    ? `Add ${u.name} (${u.durationBeats} beat${u.durationBeats > 1 ? 's' : ''})`
                    : `Requires ${u.durationBeats} beat(s), only ${beatsRemaining} left in measure`
                }
              >
                <div className="scale-75 group-hover:scale-85 transition-transform">
                  <NoteGlyphSVG type={u.type} size="sm" />
                </div>
                {settings.syllableStyle !== 'none' && (
                  <span className="text-xs font-bold text-slate-200 mt-1 group-hover:text-amber-400">
                    {settings.syllableStyle === 'kodaly'
                      ? u.syllableKodaly
                      : formatCountingSyllable(u, nextBeatNum <= 4 ? nextBeatNum : 1)}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 text-center font-medium line-clamp-1 max-w-[84px]">
                  {u.name}
                </span>
                <span className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {u.durationBeats} {u.durationBeats === 1 ? 'beat' : 'beats'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Buttons & Feedback */}
      <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePlayBuilt}
            disabled={placedUnits.length === 0}
            className="flex-1 sm:flex-initial px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>{isPlayingBuilt ? 'Playing Your Beat...' : 'Test My Built Beat'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleSubmitCheck}
            disabled={totalBeatsPlaced !== 4}
            className="flex-1 sm:flex-initial px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Submit Beat to Band!</span>
          </button>

          {checkResult === 'CORRECT' && (
            <button
              onClick={() => setPatternIndex(prev => prev + 1)}
              className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
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
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-center font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>You solved the mystery groove! Exact match! +Points awarded!</span>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-center font-bold text-sm shadow-lg shadow-rose-500/20">
              <span>Not quite matching the mystery rhythm! Listen again and compare beat by beat.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
