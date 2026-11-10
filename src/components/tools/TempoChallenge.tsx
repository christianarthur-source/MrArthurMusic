import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Play, RotateCcw, Trophy, Flame } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

/**
 * Tempo Challenge (inside the Tempo Tapper tool).
 * Students hear a 4-click count-in at a target tempo, then the clicks stop and they keep tapping.
 * Every tap after the count-in earns a point when their tempo (average of their last few taps)
 * is still within ±tolerance BPM of the target. A round is ROUND_TAPS scored taps.
 */

const COUNT_IN_BEATS = 4;
const ROUND_TAPS = 32;
const AVERAGE_OVER = 4; // intervals averaged for "your tempo" (smooths single wobbly taps)
const GIVE_UP_MS = 3000; // no tap for this long after the count-in ends the round
const TARGETS = [60, 80, 100, 120];
const BEST_KEY = 'tempoChallengeBest';

type Phase = 'ready' | 'countIn' | 'playing' | 'done';
type Feedback = { kind: 'steady' | 'fast' | 'slow' | 'warmup'; bpm: number | null };

function loadBest(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function saveBest(best: Record<string, number>) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // private window / storage blocked: best score just isn't remembered
  }
}

function click(accent: boolean) {
  try {
    soundEngine.playDrumHit(accent ? 'cowbell' : 'rimshot', 0, accent ? 0.9 : 0.6);
  } catch {
    // audio fail-safe
  }
}

export const TempoChallenge: React.FC<{ startBpm: number }> = ({ startBpm }) => {
  const [target, setTarget] = useState<number>(() => Math.max(40, Math.min(200, startBpm)));
  const [tolerance, setTolerance] = useState<2 | 5>(2);
  const [phase, setPhase] = useState<Phase>('ready');
  const [countBeat, setCountBeat] = useState(0);
  const [points, setPoints] = useState(0);
  const [taps, setTaps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pulse, setPulse] = useState(false);
  const [best, setBest] = useState<Record<string, number>>(loadBest);
  const [newBest, setNewBest] = useState(false);

  const phaseRef = useRef<Phase>('ready');
  const tapTimesRef = useRef<number[]>([]);
  const timersRef = useRef<number[]>([]);
  const giveUpRef = useRef<number | null>(null);
  const scoreRef = useRef({ points: 0, taps: 0, streak: 0, bestStreak: 0 });

  const bestKey = `${target}:${tolerance}`;

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    if (giveUpRef.current !== null) {
      clearTimeout(giveUpRef.current);
      giveUpRef.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const finishRound = useCallback(() => {
    clearTimers();
    setPhaseBoth('done');
    const { points: p } = scoreRef.current;
    setBest((prev) => {
      const key = `${target}:${tolerance}`;
      if (p > (prev[key] || 0)) {
        const next = { ...prev, [key]: p };
        saveBest(next);
        setNewBest(true);
        return next;
      }
      return prev;
    });
  }, [target, tolerance]);

  const start = () => {
    clearTimers();
    tapTimesRef.current = [];
    scoreRef.current = { points: 0, taps: 0, streak: 0, bestStreak: 0 };
    setPoints(0);
    setTaps(0);
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setNewBest(false);
    setPhaseBoth('countIn');
    setCountBeat(0);

    const beatMs = 60000 / target;
    for (let i = 0; i < COUNT_IN_BEATS; i++) {
      timersRef.current.push(
        window.setTimeout(() => {
          click(i === 0);
          setCountBeat(i + 1);
        }, 300 + i * beatMs),
      );
    }
    // After the last count-in click the metronome goes quiet: the student keeps the beat.
    timersRef.current.push(
      window.setTimeout(() => {
        if (phaseRef.current !== 'countIn') return;
        setPhaseBoth('playing');
        armGiveUp();
      }, 300 + (COUNT_IN_BEATS - 0.5) * beatMs),
    );
  };

  const armGiveUp = () => {
    if (giveUpRef.current !== null) clearTimeout(giveUpRef.current);
    giveUpRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'playing') finishRound();
    }, GIVE_UP_MS);
  };

  const handleTap = useCallback(() => {
    const p = phaseRef.current;
    if (p === 'ready' || p === 'done') return;
    const now = performance.now();
    try {
      soundEngine.playDrumHit('snare', 0, 0.55);
    } catch {
      // audio fail-safe
    }
    setPulse(true);
    window.setTimeout(() => setPulse(false), 110);

    const times = tapTimesRef.current;
    times.push(now);
    if (times.length > AVERAGE_OVER + 1) times.shift();

    // Taps during the count-in (tapping along) only warm up the average.
    if (p === 'countIn') {
      setFeedback({ kind: 'warmup', bpm: null });
      return;
    }

    armGiveUp();
    const s = scoreRef.current;
    s.taps++;

    let yourBpm: number | null = null;
    if (times.length >= 2) {
      const avg = (times[times.length - 1] - times[0]) / (times.length - 1);
      yourBpm = 60000 / avg;
    }

    if (yourBpm !== null && Math.abs(yourBpm - target) <= tolerance) {
      s.points++;
      s.streak++;
      s.bestStreak = Math.max(s.bestStreak, s.streak);
      setFeedback({ kind: 'steady', bpm: yourBpm });
    } else {
      s.streak = 0;
      setFeedback({ kind: yourBpm !== null && yourBpm > target ? 'fast' : 'slow', bpm: yourBpm });
    }
    setPoints(s.points);
    setTaps(s.taps);
    setStreak(s.streak);
    setBestStreak(s.bestStreak);

    if (s.taps >= ROUND_TAPS) finishRound();
  }, [target, tolerance, finishRound]);

  // Spacebar taps (the Tempo Tapper's own spacebar handler is off while this mode is shown)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      e.preventDefault();
      // Keep a focused button from also being "clicked" by the spacebar
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (phaseRef.current === 'ready' || phaseRef.current === 'done') return;
      handleTap();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleTap]);

  const reset = () => {
    clearTimers();
    setPhaseBoth('ready');
    setFeedback(null);
    setCountBeat(0);
  };

  const busy = phase === 'countIn' || phase === 'playing';
  const pct = taps ? Math.round((points / taps) * 100) : 0;
  const stars = phase === 'done' ? (points >= 28 ? 3 : points >= 20 ? 2 : points >= 10 ? 1 : 0) : 0;

  // Meter: where "your tempo" sits relative to the target (±12 BPM shown)
  const span = 12;
  const offset = feedback?.bpm != null ? Math.max(-span, Math.min(span, feedback.bpm - target)) : 0;
  const needleLeft = 50 + (offset / span) * 50;
  const zoneWidth = (tolerance / span) * 100;

  const feedbackText = (() => {
    if (phase === 'countIn') return feedback?.kind === 'warmup' ? 'Tap along… get ready!' : 'Listen to the count-in…';
    if (phase === 'playing' && !feedback) return 'Keep the beat going on your own!';
    if (!feedback || feedback.kind === 'warmup') return '';
    if (feedback.kind === 'steady') return 'Steady! +1 ⭐';
    if (feedback.bpm == null) return 'Keep tapping!';
    return feedback.kind === 'fast' ? 'Rushing! Slow down a little 🐢' : 'Dragging! Speed up a little 🐇';
  })();

  return (
    <div className="space-y-5">
      {/* Settings */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Target tempo</span>
          {Array.from(new Set([...TARGETS, Math.max(40, Math.min(200, startBpm))]))
            .sort((a, b) => a - b)
            .map((t) => (
              <button
                key={t}
                type="button"
                disabled={busy}
                onClick={() => setTarget(t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-black font-mono border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  target === t
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
              >
                {t}
                {t === Math.max(40, Math.min(200, startBpm)) && !TARGETS.includes(t) ? ' (yours)' : ''}
              </button>
            ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Steady zone</span>
          {([2, 5] as const).map((tol) => (
            <button
              key={tol}
              type="button"
              disabled={busy}
              onClick={() => setTolerance(tol)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                tolerance === tol
                  ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              {tol === 2 ? '🏆 Pro: ±2 BPM' : '🌱 Starter: ±5 BPM'}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-400" /> Best: {best[bestKey] || 0}/{ROUND_TAPS}
          </span>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-slate-900 border border-amber-500/30 p-3 text-center">
          <div className="text-3xl sm:text-4xl font-black font-mono text-amber-300">{points}</div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Points</div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-rose-500/30 p-3 text-center">
          <div className="text-3xl sm:text-4xl font-black font-mono text-rose-300 flex items-center justify-center gap-1">
            {streak}
            {streak >= 5 && <Flame className="w-6 h-6 text-orange-400" />}
          </div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Streak</div>
        </div>
        <div className="rounded-2xl bg-slate-900 border border-sky-500/30 p-3 text-center">
          <div className="text-3xl sm:text-4xl font-black font-mono text-sky-300">
            {taps}
            <span className="text-base text-slate-500">/{ROUND_TAPS}</span>
          </div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taps</div>
        </div>
      </div>

      {/* Steadiness meter */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
          <span>🐢 Too slow</span>
          <span className="text-white font-mono">
            {feedback?.bpm != null ? `${Math.round(feedback.bpm)} BPM` : `${target} BPM`}
          </span>
          <span>Too fast 🐇</span>
        </div>
        <div className="relative h-8 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-400/60"
            style={{ left: `${50 - zoneWidth}%`, width: `${zoneWidth * 2}%` }}
          />
          <div
            className={`absolute top-0 bottom-0 w-1.5 -ml-[3px] rounded-full transition-all duration-150 ${
              feedback?.kind === 'steady' ? 'bg-emerald-300' : feedback?.bpm != null ? 'bg-rose-400' : 'bg-slate-500'
            }`}
            style={{ left: `${needleLeft}%` }}
          />
        </div>
        <p
          className={`text-center text-lg font-black font-['Fredoka',sans-serif] min-h-[1.75rem] ${
            feedback?.kind === 'steady' ? 'text-emerald-300' : feedback?.kind === 'fast' || feedback?.kind === 'slow' ? 'text-rose-300' : 'text-slate-300'
          }`}
        >
          {feedbackText}
        </p>
      </div>

      {/* Main button: Start / Tap / Play again */}
      <div className="flex flex-col items-center gap-3">
        {busy ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              handleTap();
            }}
            className={`w-full max-w-md py-7 px-8 rounded-3xl bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-500 text-slate-950 font-black text-2xl sm:text-3xl font-['Fredoka',sans-serif] shadow-2xl select-none border-2 border-emerald-300/60 transition-transform cursor-pointer touch-manipulation ${
              pulse ? 'scale-95' : ''
            }`}
          >
            {phase === 'countIn' ? (
              <span>
                {countBeat > 0 ? `${countBeat}…` : 'Ready…'} <span className="text-base font-bold">(count-in)</span>
              </span>
            ) : (
              <span>TAP THE BEAT 🥁</span>
            )}
            <span className="block text-xs font-bold text-slate-900/80 font-sans mt-1">
              Tap here or press{' '}
              <kbd className="px-2 py-0.5 bg-slate-900 text-emerald-300 rounded-md font-mono">SPACEBAR</kbd>
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              start();
            }}
            className="w-full max-w-md py-6 px-8 rounded-3xl bg-gradient-to-r from-amber-400 via-rose-500 to-sky-500 text-slate-950 font-black text-2xl font-['Fredoka',sans-serif] shadow-2xl border-2 border-amber-300/60 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Play className="w-6 h-6" />
            {phase === 'done' ? 'Play Again' : 'Start Challenge'}
          </button>
        )}

        {busy && (
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              reset();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Stop
          </button>
        )}

        {phase === 'ready' && (
          <p className="text-xs text-slate-400 text-center max-w-md">
            You&apos;ll hear {COUNT_IN_BEATS} clicks. Then the clicks stop: keep tapping at the same speed! Each tap
            scores a point while your tempo stays within ±{tolerance} BPM of {target}.
          </p>
        )}
      </div>

      {/* Results */}
      {phase === 'done' && (
        <div className="rounded-3xl bg-gradient-to-r from-amber-400 to-rose-500 p-0.5">
          <div className="rounded-[22px] bg-slate-950/95 p-5 text-center space-y-2">
            <div className="text-4xl">{stars ? '⭐'.repeat(stars) : '🥁'}</div>
            <h4 className="text-2xl font-black text-white font-['Fredoka',sans-serif]">
              {points} point{points === 1 ? '' : 's'}!
            </h4>
            <p className="text-sm text-slate-300">
              {taps < ROUND_TAPS
                ? `The beat stopped after ${taps} tap${taps === 1 ? '' : 's'}. `
                : ''}
              Steady on {pct}% of your taps • Longest streak: {bestStreak}
            </p>
            {newBest && <p className="text-sm font-black text-amber-300">🏆 New best score at {target} BPM!</p>}
            <p className="text-xs text-slate-400">
              {stars === 3
                ? 'Rock-steady! Try the Pro zone or a new tempo.'
                : stars >= 1
                  ? 'Nice beat! Listen to the count-in carefully and try to beat your score.'
                  : 'Tip: count “1-2-3-4” in your head while you tap.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
