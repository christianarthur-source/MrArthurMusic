import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Sparkles, AlertCircle, Trophy, Play, Pause, RotateCcw } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

interface DynamicTier {
  symbol: string;
  name: string;
  italian: string;
  meaning: string;
  rangeMin: number;
  rangeMax: number;
  color: string;
  bgColor: string;
  borderColor: string;
  emoji: string;
}

const DYNAMIC_TIERS: DynamicTier[] = [
  {
    symbol: 'pp',
    name: 'Pianissimo',
    italian: 'pee-ah-NEES-see-mo',
    meaning: 'Very Soft / Whisper Quiet',
    rangeMin: 0,
    rangeMax: 15,
    color: 'text-sky-300',
    bgColor: 'bg-sky-500/20',
    borderColor: 'border-sky-500/40',
    emoji: '🤫',
  },
  {
    symbol: 'p',
    name: 'Piano',
    italian: 'pee-AH-no',
    meaning: 'Soft & Gentle',
    rangeMin: 16,
    rangeMax: 32,
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/40',
    emoji: '🍃',
  },
  {
    symbol: 'mp',
    name: 'Mezzo-Piano',
    italian: 'MET-so pee-AH-no',
    meaning: 'Medium Soft / Partner Talk',
    rangeMin: 33,
    rangeMax: 50,
    color: 'text-teal-300',
    bgColor: 'bg-teal-500/20',
    borderColor: 'border-teal-500/40',
    emoji: '💬',
  },
  {
    symbol: 'mf',
    name: 'Mezzo-Forte',
    italian: 'MET-so FOR-tay',
    meaning: 'Medium Loud / Speaking Voice',
    rangeMin: 51,
    rangeMax: 70,
    color: 'text-amber-300',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/40',
    emoji: '🗣️',
  },
  {
    symbol: 'f',
    name: 'Forte',
    italian: 'FOR-tay',
    meaning: 'Loud & Projecting',
    rangeMin: 71,
    rangeMax: 85,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/40',
    emoji: '📢',
  },
  {
    symbol: 'ff',
    name: 'Fortissimo',
    italian: 'for-TEES-see-mo',
    meaning: 'Very Loud / Rock Band Blast!',
    rangeMin: 86,
    rangeMax: 100,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/20',
    borderColor: 'border-rose-500/40',
    emoji: '⚡',
  },
];

function getDynamicTier(level: number): DynamicTier {
  const found = DYNAMIC_TIERS.find((t) => level >= t.rangeMin && level <= t.rangeMax);
  return found || DYNAMIC_TIERS[0];
}

export const DynamicEars: React.FC = () => {
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [level, setLevel] = useState<number>(10); // 0 to 100
  const [peakLevel, setPeakLevel] = useState<number>(15);

  // Classroom Quiet Challenge state
  const [challengeActive, setChallengeActive] = useState<boolean>(false);
  const [challengeSeconds, setChallengeSeconds] = useState<number>(60);
  const [challengeStars, setChallengeStars] = useState<number>(5);
  const [challengeWarning, setChallengeWarning] = useState<boolean>(false);

  // Audio Context & Analyser references
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const currentTier = getDynamicTier(level);

  // Clean up mic audio nodes
  const stopMic = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsMicListening(false);
  }, []);

  // Start listening to microphone
  const startMic = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsMicListening(true);

      const buffer = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);

        // Compute average volume
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const avg = sum / buffer.length;
        // Scale 0..128 to 0..100
        const calculated = Math.min(100, Math.round((avg / 90) * 100));

        setLevel(calculated);
        setPeakLevel((p) => Math.max(p, calculated));

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.error('Mic access error:', err);
      setMicError('Microphone access was not granted. You can still test with the dynamic buttons below!');
      setIsMicListening(false);
    }
  };

  useEffect(() => {
    return () => {
      stopMic();
    };
  }, [stopMic]);

  // Simulate volume level & play chime preview
  const simulateLevel = (targetLevel: number, symbol: string) => {
    setLevel(targetLevel);
    setPeakLevel((p) => Math.max(p, targetLevel));

    // Play a preview chime at proportional volume
    try {
      const volMap: Record<string, number> = {
        pp: 0.15,
        p: 0.3,
        mp: 0.5,
        mf: 0.7,
        f: 0.85,
        ff: 1.0,
      };
      const gain = volMap[symbol] || 0.5;
      soundEngine.playNotePreview({ step: 'C', octave: 5 }, 'glockenspiel', 0.6, 'C');
      soundEngine.playDrumHit('shaker', 0, gain);
    } catch {
      // Audio fail-safe
    }
  };

  // Classroom Challenge Timer
  useEffect(() => {
    if (!challengeActive) return;

    if (challengeSeconds <= 0) {
      setChallengeActive(false);
      return;
    }

    const timer = window.setInterval(() => {
      setChallengeSeconds((s) => s - 1);

      // Check if current level is too loud (Forte or Fortissimo)
      if (level >= 75) {
        setChallengeWarning(true);
        setChallengeStars((st) => Math.max(1, st - 1));
      } else {
        setChallengeWarning(false);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [challengeActive, challengeSeconds, level]);

  const handleStartChallenge = () => {
    setChallengeSeconds(60);
    setChallengeStars(5);
    setChallengeWarning(false);
    setChallengeActive(true);
    if (!isMicListening) {
      void startMic();
    }
  };

  const handleResetChallenge = () => {
    setChallengeActive(false);
    setChallengeSeconds(60);
    setChallengeStars(5);
    setChallengeWarning(false);
  };

  return (
    <div className="space-y-6">
      {/* Live Mic Toggle & Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={isMicListening ? stopMic : startMic}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-['Fredoka',sans-serif] flex items-center gap-2 shadow-md ${
              isMicListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
            }`}
          >
            {isMicListening ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>Turn Mic OFF</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 animate-pulse" />
                <span>Turn Mic ON (Live Meter)</span>
              </>
            )}
          </button>

          <span className="text-xs text-slate-400">
            {isMicListening ? 'Listening live in room' : 'Mic is idle — tap buttons to test'}
          </span>
        </div>

        {/* School Safe Privacy Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% Client-Side • Zero Audio Recorded or Stored</span>
        </div>
      </div>

      {micError && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{micError}</span>
        </div>
      )}

      {/* GIANT DYNAMIC LEVEL CARD */}
      <div
        className={`rounded-3xl p-6 sm:p-8 bg-slate-950 border-2 ${currentTier.borderColor} shadow-2xl transition-all duration-200 flex flex-col md:flex-row items-center justify-between gap-6`}
      >
        {/* Left: Giant Italian Dynamic Symbol */}
        <div className="flex items-center gap-5">
          <div
            className={`w-28 h-28 rounded-3xl ${currentTier.bgColor} border-2 ${currentTier.borderColor} flex flex-col items-center justify-center shadow-inner`}
          >
            <span className="text-4xl sm:text-5xl font-serif italic font-bold tracking-tight text-white drop-shadow">
              {currentTier.symbol}
            </span>
            <span className="text-xs mt-1">{currentTier.emoji}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white">
                Musical Dynamic
              </span>
              <span className="text-xs text-slate-400 font-mono">({currentTier.italian})</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif]">
              {currentTier.name}
            </h3>
            <p className="text-sm font-bold text-amber-300">{currentTier.meaning}</p>
          </div>
        </div>

        {/* Right: Sound Level Meter Readout */}
        <div className="text-center md:text-right">
          <div className="text-4xl sm:text-5xl font-black font-mono text-white">
            {level}%{' '}
            <span className="text-lg font-bold font-['Fredoka',sans-serif] text-slate-400">
              Volume
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Peak Level: <strong className="text-slate-300">{peakLevel}%</strong>
          </p>
        </div>
      </div>

      {/* GRADUATED COLOR VOLUME GAUGE BAR */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
          <span>pp (Quiet)</span>
          <span>p</span>
          <span>mp</span>
          <span>mf</span>
          <span>f</span>
          <span>ff (Blast!)</span>
        </div>

        <div className="relative h-7 rounded-2xl bg-slate-950 border border-slate-800 p-1 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-xl bg-gradient-to-r from-sky-400 via-emerald-400 via-amber-400 via-orange-400 to-rose-500 transition-all duration-150"
            style={{ width: `${Math.max(5, level)}%` }}
          />
        </div>
      </div>

      {/* DYNAMICS CLICK-TO-TEST BUTTONS */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Click to Preview Each Musical Dynamic:
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {DYNAMIC_TIERS.map((tier) => (
            <button
              key={tier.symbol}
              type="button"
              onClick={() => {
                const targetLvl = Math.round((tier.rangeMin + tier.rangeMax) / 2);
                simulateLevel(targetLvl, tier.symbol);
              }}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                currentTier.symbol === tier.symbol
                  ? 'bg-slate-800 border-amber-400 shadow-lg scale-102 ring-2 ring-amber-400/50'
                  : 'bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-300'
              }`}
            >
              <div className="text-2xl font-serif italic font-black text-white">{tier.symbol}</div>
              <div className="text-xs font-black font-['Fredoka',sans-serif] text-amber-300 mt-1">
                {tier.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">{tier.meaning}</div>
            </button>
          ))}
        </div>
      </div>

      {/* CLASSROOM QUIET CHALLENGE GAME */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-black text-white font-['Fredoka',sans-serif]">
                Classroom Quiet Challenge
              </h4>
              <p className="text-xs text-slate-400">
                Can your class keep the room in <em>piano</em> (soft) for 60 seconds?
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!challengeActive ? (
              <button
                type="button"
                onClick={handleStartChallenge}
                className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer font-['Fredoka',sans-serif]"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start 60s Challenge</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetChallenge}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Challenge Stats Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Timer:</span>
            <span className="text-xl font-mono font-black text-white">{challengeSeconds}s</span>
          </div>

          <div className="flex items-center gap-1 text-base">
            <span className="text-xs text-slate-400 font-bold mr-1">Class Stars:</span>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={i < challengeStars ? 'text-amber-400' : 'text-slate-700'}>
                ★
              </span>
            ))}
          </div>

          {challengeWarning && (
            <span className="text-xs font-black text-rose-400 animate-bounce">
              ⚠️ Getting a bit loud! Shhh...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
