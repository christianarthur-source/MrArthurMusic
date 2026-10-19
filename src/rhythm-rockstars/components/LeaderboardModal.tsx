import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, StudentProfile } from '../types/game';
import { apiClient } from '../services/apiClient';
import { Trophy, Flame, Star, RefreshCw, X, Award, Users } from 'lucide-react';

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
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.fetchLeaderboard(selectedClass);
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
  }, [isOpen, selectedClass]);

  if (!isOpen) return null;

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

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
                  Classroom Rockstars Leaderboard
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Live rankings synced across all classroom Chromebooks
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

        {/* Filter by Classroom code */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>Classroom:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {['ALL', 'ROOM-101', 'PERIOD-2', 'BAND-4'].map((code) => (
              <button
                key={code}
                onClick={() => setSelectedClass(code)}
                className={`px-3 py-1 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedClass === code
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {code === 'ALL' ? 'All Classes' : code}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Leaderboard Area */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {top3.map((entry, idx) => {
                const medalColors = [
                  'from-amber-400/20 border-amber-400/50 text-amber-300', // 1st
                  'from-slate-400/20 border-slate-400/50 text-slate-200', // 2nd
                  'from-amber-700/20 border-amber-600/50 text-amber-400'  // 3rd
                ];
                const medalIcon = ['🥇', '🥈', '🥉'][idx];

                const isMe = currentStudent?.id === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-2xl border bg-gradient-to-b ${medalColors[idx]} ${
                      isMe ? 'ring-2 ring-amber-400' : ''
                    } flex flex-col items-center text-center shadow-lg relative`}
                  >
                    <span className="text-2xl mb-1">{medalIcon}</span>
                    <span className="text-3xl mb-1">{entry.avatar}</span>
                    <span className="font-display font-extrabold text-sm text-white truncate max-w-full">
                      {entry.name} {isMe && '(You)'}
                    </span>

                    {/* Level Badge */}
                    <div className="my-1.5">
                      <span className="inline-block text-[11px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/40 shadow-sm">
                        Level {entry.highestLevel || 1}
                      </span>
                    </div>

                    {/* Total Score */}
                    <span className="text-xl font-mono font-black text-amber-400 tabular-nums">
                      {entry.totalScore.toLocaleString()} pts
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      Total Score
                    </span>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                      <span className="flex items-center gap-0.5">
                        <Flame className="w-3 h-3 text-rose-400" /> {entry.highestStreak} streak
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400" /> {entry.starsCount} ⭐
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Leaderboard Table List */}
          <div className="space-y-2">
            {rest.map((entry) => {
              const isMe = currentStudent?.id === entry.id;

              return (
                <div
                  key={entry.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe
                      ? 'bg-amber-400/10 border-amber-400/60 ring-1 ring-amber-400/40'
                      : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-7 text-center font-display font-black text-sm text-slate-400 tabular-nums">
                      #{entry.rank}
                    </span>
                    <span className="text-2xl shrink-0">{entry.avatar}</span>
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-white block truncate">
                        {entry.name} {isMe && <span className="text-amber-400 text-xs ml-1">(You)</span>}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="text-amber-300 font-extrabold bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Level {entry.highestLevel || 1}
                        </span>
                        <span>·</span>
                        <span>{entry.classCode}</span>
                        <span>·</span>
                        <span>{entry.quizzesCompleted} quizzes</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      <span className="font-mono">{entry.highestStreak} streak</span>
                    </div>

                    <div>
                      <span className="font-mono font-black text-base text-amber-400 block tabular-nums">
                        {entry.totalScore.toLocaleString()} pts
                      </span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Total Score</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length === 0 && !isLoading && (
            <div className="py-12 text-center text-slate-500 text-sm">
              No students recorded yet in this classroom section. Be the first Rockstar!
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
            Play & Rise the Ranks! 🎸
          </button>
        </div>
      </div>
    </div>
  );
};
