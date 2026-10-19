import React from 'react';
import { LevelConfig } from '../types/rhythm';
import { StudentProfile } from '../types/game';
import { Lock, Star, ChevronRight, Award } from 'lucide-react';

interface LevelSelectProps {
  levels: LevelConfig[];
  currentLevelNumber: number;
  onSelectLevel: (lvlNumber: number) => void;
  student: StudentProfile | null;
}

export const LevelSelect: React.FC<LevelSelectProps> = ({
  levels,
  currentLevelNumber,
  onSelectLevel,
  student
}) => {
  const studentPoints = student?.totalScore || 0;

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest block">
            Tour Stages & Rhythms
          </span>
          <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
            Select Your Rhythm Stage
          </h3>
        </div>

        <div className="text-right hidden sm:block">
          <span className="text-xs text-slate-400 block">Your Fame Score</span>
          <span className="font-mono font-black text-lg text-amber-400 tabular-nums">
            {studentPoints.toLocaleString()} pts
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {levels.map((lvl) => {
          const isUnlocked = lvl.unlockedByDefault || studentPoints >= lvl.minPointsToUnlock;
          const isCurrent = currentLevelNumber === lvl.levelNumber;
          const progress = student?.levelProgress[lvl.levelNumber];
          const starsEarned = progress?.stars || 0;

          return (
            <div
              key={lvl.levelNumber}
              onClick={() => isUnlocked && onSelectLevel(lvl.levelNumber)}
              className={`p-4 rounded-2xl border transition-all text-left relative flex flex-col justify-between ${
                isCurrent
                  ? 'bg-amber-400/10 border-amber-400/80 ring-2 ring-amber-400/40 shadow-lg'
                  : isUnlocked
                  ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-950 cursor-pointer'
                  : 'bg-slate-950/30 border-slate-900 opacity-60 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    Stage {lvl.levelNumber}
                  </span>

                  {isUnlocked ? (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((starIdx) => (
                        <Star
                          key={starIdx}
                          className={`w-3.5 h-3.5 ${
                            starIdx <= starsEarned
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Lock className="w-3 h-3" />
                      {lvl.minPointsToUnlock} pts
                    </span>
                  )}
                </div>

                <h4 className="font-display font-black text-base text-white truncate">
                  {lvl.title}
                </h4>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] font-bold text-amber-300">
                    {lvl.difficultyLabel}
                  </span>
                  <span className="text-[10px] font-black text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                    +{lvl.basePointsPerQuestion} pts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                  {lvl.description}
                </p>
              </div>

              {/* Rhythms Introduced Pill Row */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[170px]">
                  {lvl.rhythmTypesIntroduced.join(' · ')}
                </span>

                <span className="text-xl leading-none">{lvl.badgeIcon}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
