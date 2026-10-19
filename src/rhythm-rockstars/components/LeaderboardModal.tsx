import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, StudentProfile } from '../types/game';
import { apiClient } from '../services/apiClient';
import { Trophy, Flame, Star, RefreshCw, X, Award } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStudent: StudentProfile | null;
  onPlayNow: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentStudent,
  onPlayNow
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.fetchLeaderboard('ALL');
      setEntries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-bold text-xl">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-black text-xs tracking-wider border border-white shadow-sm">
                  DENTI
                </span>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                  Leaderboard
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live rankings synced across all players
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadLeaderboard}
              disabled={isLoading}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Simple Leaderboard List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1">
          {entries.map((entry) => {
            const isMe = currentStudent?.id === entry.id;
            const isTop1 = entry.rank === 1;
            const isTop2 = entry.rank === 2;
            const isTop3 = entry.rank === 3;

            return (
              <div
                key={entry.id}
                className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  isMe
                    ? 'bg-amber-400/15 border-amber-400/60 ring-2 ring-amber-400/40 shadow-md shadow-amber-400/10'
                    : isTop1
                    ? 'bg-gradient-to-r from-amber-400/15 via-slate-900 to-slate-900 border-amber-400/40'
                    : isTop2
                    ? 'bg-gradient-to-r from-slate-300/15 via-slate-900 to-slate-900 border-slate-400/30'
                    : isTop3
                    ? 'bg-gradient-to-r from-amber-700/15 via-slate-900 to-slate-900 border-amber-600/30'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Left: Rank, Avatar, Name & Details */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {/* Rank Badge */}
                  <div className="w-9 text-center shrink-0">
                    {isTop1 ? (
                      <span className="text-xl" title="#1 Gold">🥇</span>
                    ) : isTop2 ? (
                      <span className="text-xl" title="#2 Silver">🥈</span>
                    ) : isTop3 ? (
                      <span className="text-xl" title="#3 Bronze">🥉</span>
                    ) : (
                      <span className="font-display font-black text-sm text-slate-400 font-mono tabular-nums">
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                    {entry.avatar || '🎸'}
                  </div>

                  {/* Name & Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                        {entry.name}
                      </span>
                      {isMe && (
                        <span className="text-[11px] font-black text-amber-400 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30 shrink-0">
                          You
                        </span>
                      )}
                    </div>

                    {/* Sub details: Level, Streak, Quizzes, Stars */}
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="text-amber-300 font-bold bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                        Level {entry.highestLevel || 1}
                      </span>
                      <span>•</span>
                      <span className="text-slate-300">
                        {entry.quizzesCompleted} quizzes
                      </span>
                      {entry.highestStreak > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-rose-300 font-semibold">
                            <Flame className="w-3 h-3 text-rose-400 fill-rose-400" />
                            {entry.highestStreak} streak
                          </span>
                        </>
                      )}
                      {entry.starsCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-300 font-semibold">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            {entry.starsCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Points */}
                <div className="text-right shrink-0 pl-2">
                  <span className="font-mono font-black text-base sm:text-lg text-amber-400 block tabular-nums">
                    {entry.totalScore.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Points
                  </span>
                </div>
              </div>
            );
          })}

          {entries.length === 0 && !isLoading && (
            <div className="py-16 text-center text-slate-500 text-sm">
              No players recorded yet. Be the first Rockstar to play and rank!
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 text-center sm:text-left">
            Scores update automatically after completing each rhythm stage.
          </div>

          <button
            onClick={() => {
              onClose();
              onPlayNow();
            }}
            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            Play & Rise the Leaderboard! 🎸
          </button>
        </div>
      </div>
    </div>
  );
};
