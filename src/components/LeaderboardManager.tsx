import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import {
  fetchRhythmRockstarsLeaderboard,
  fetchStaffWarsLeaderboard,
  teacherRemoveLeaderboardEntry,
} from '../utils/classroomApi';

type Game = 'staff_wars' | 'rhythm_rockstars';

interface Row {
  key: string;
  studentId?: string;
  name: string;
  score: number;
  detail: string;
}

const GAMES: { id: Game; label: string }[] = [
  { id: 'staff_wars', label: 'Staff Wars' },
  { id: 'rhythm_rockstars', label: 'Rhythm Rockstars' },
];

/** Teacher portal tab: see the game leaderboards and remove entries that don't belong. */
export function LeaderboardManager({ teacherPin }: { teacherPin: string }) {
  const [game, setGame] = useState<Game>('staff_wars');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // Only the latest request may update the list (switching boards quickly must not mix them up).
  const requestRef = useRef(0);

  const load = useCallback(async (which: Game) => {
    const req = ++requestRef.current;
    const current = () => req === requestRef.current;
    setLoading(true);
    setError(null);
    try {
      if (which === 'staff_wars') {
        const list = await fetchStaffWarsLeaderboard(1, 'all');
        if (!current()) return;
        setRows(
          list.map((e: any, i: number) => ({
            key: `${e.studentId || 'guest'}:${e.name}:${i}`,
            studentId: e.studentId || undefined,
            name: String(e.name || ''),
            score: Number(e.score) || 0,
            detail: `Level ${e.level || 1}${e.clef ? ` · ${e.clef}` : ''}${e.studentId ? '' : ' · guest'}`,
          })),
        );
      } else {
        const { leaderboard } = await fetchRhythmRockstarsLeaderboard();
        if (!current()) return;
        setRows(
          leaderboard.map((e: any, i: number) => ({
            key: `${e.id || 'guest'}:${e.name}:${i}`,
            studentId: e.id || undefined,
            name: String(e.name || ''),
            score: Number(e.totalScore) || 0,
            detail: `Level ${e.highestLevel || 1} · ${e.starsCount || 0} ★`,
          })),
        );
      }
    } catch (err: any) {
      if (!current()) return;
      setError(err?.message || 'Could not load the leaderboard.');
      setRows([]);
    } finally {
      if (current()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRows([]);
    load(game);
  }, [game, load]);

  const remove = async (row: Row) => {
    const gameLabel = GAMES.find((g) => g.id === game)?.label;
    if (!window.confirm(`Remove ${row.name} (${row.score.toLocaleString()}) from the ${gameLabel} leaderboard?`)) return;
    setBusyKey(row.key);
    setError(null);
    try {
      await teacherRemoveLeaderboardEntry({
        teacherPin,
        game,
        ...(row.studentId ? { studentId: row.studentId } : { name: row.name }),
      });
      await load(game);
    } catch (err: any) {
      setError(err?.message || 'Could not remove that entry.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGame(g.id)}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer ${
              game === g.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {g.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => load(game)}
          title="Refresh"
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-slate-400 text-[11px]">
        Anyone can view these boards. Remove an entry that looks wrong; the student can still play and earn a new score.
      </p>

      {error && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200">{error}</div>
      )}

      <div className="rounded-xl border border-slate-800 divide-y divide-slate-800 bg-slate-950/70">
        {rows.length === 0 && !loading && <div className="p-3 text-slate-400">No scores yet.</div>}
        {rows.map((row, i) => (
          <div key={row.key} className="flex items-center gap-3 px-3 py-2">
            <span className="w-6 text-right font-mono text-slate-500">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white truncate">{row.name}</div>
              <div className="text-[11px] text-slate-400">{row.detail}</div>
            </div>
            <span className="font-mono tabular-nums text-amber-300">{row.score.toLocaleString()}</span>
            <button
              type="button"
              onClick={() => remove(row)}
              disabled={busyKey !== null}
              title={`Remove ${row.name}`}
              aria-label={`Remove ${row.name}`}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white disabled:opacity-40 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
