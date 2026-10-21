import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Square,
  Volume2,
  VolumeX,
  Zap,
  Sparkles,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  Sliders,
} from 'lucide-react';

export type MetronomeSound = 'woodblock' | 'beep' | 'drumstick' | 'cowbell' | 'silent';
export type Subdivision = 1 | 2 | 3 | 4; // 1 = Quarter, 2 = Eighth, 3 = Triplet, 4 = 16th

interface AnimalTempo {
  name: string;
  emoji: string;
  term: string;
  pronunciation: string;
  meaning: string;
  minBpm: number;
  maxBpm: number;
  color: string;
  badgeBg: string;
}

const ANIMAL_TEMPOS: AnimalTempo[] = [
  {
    name: 'Sleepy Turtle',
    emoji: '🐢',
    term: 'Largo',
    pronunciation: 'LAHR-go',
    meaning: 'Broad & Very Slow',
    minBpm: 30,
    maxBpm: 59,
    color: 'from-blue-500 to-indigo-600',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    name: 'Walking Penguin',
    emoji: '🐧',
    term: 'Andante',
    pronunciation: 'ahn-DAHN-tay',
    meaning: 'At a Walking Pace',
    minBpm: 60,
    maxBpm: 79,
    color: 'from-sky-400 to-cyan-500',
    badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    name: 'Hopping Kangaroo',
    emoji: '🦘',
    term: 'Moderato',
    pronunciation: 'mod-er-AH-toe',
    meaning: 'Moderate & Easygoing',
    minBpm: 80,
    maxBpm: 107,
    color: 'from-emerald-400 to-teal-500',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    name: 'Galloping Horse',
    emoji: '🐎',
    term: 'Allegro',
    pronunciation: 'ah-LEH-gro',
    meaning: 'Fast, Quick & Bright',
    minBpm: 108,
    maxBpm: 139,
    color: 'from-amber-400 to-orange-500',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    name: 'Sprinting Cheetah',
    emoji: '🐆',
    term: 'Presto',
    pronunciation: 'PRESS-toe',
    meaning: 'Very Fast & Energetic',
    minBpm: 140,
    maxBpm: 179,
    color: 'from-rose-500 to-pink-500',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    name: 'Supersonic Rocket',
    emoji: '🚀',
    term: 'Prestissimo',
    pronunciation: 'press-TEE-see-mo',
    meaning: 'As Fast As Possible!',
    minBpm: 180,
    maxBpm: 250,
    color: 'from-purple-500 to-fuchsia-600',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
];

function getAnimalTempo(bpm: number): AnimalTempo {
  return (
    ANIMAL_TEMPOS.find((a) => bpm >= a.minBpm && bpm <= a.maxBpm) ||
    ANIMAL_TEMPOS[ANIMAL_TEMPOS.length - 1]
  );
}

export const MetronomeTool: React.FC = () => {
  // State
  const [bpm, setBpm] = useState<number>(120);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState<number>(4);
  const [subdivision, setSubdivision] = useState<Subdivision>(1);
  const [sound, setSound] = useState<MetronomeSound>('woodblock');
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Flashy feature (VirtualSheetMusic model)
  const [isFlashEnabled, setIsFlashEnabled] = useState<boolean>(true);
  const [flashIntensity, setFlashIntensity] = useState<'normal' | 'super'>('super');
  const [activeBeat, setActiveBeat] = useState<number>(0);
  const [isFlashing, setIsFlashing] = useState<'accent' | 'regular' | null>(null);

  // Tap Tempo state
  const tapTimestampsRef = useRef<number[]>([]);
  const [tapMessage, setTapMessage] = useState<string>('');

  // Web Audio Context & Scheduling References
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentSubdivisionRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const timerIdRef = useRef<number | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const flashTimeoutRef = useRef<number | null>(null);

  // Keep state refs up to date for scheduling loop
  const bpmRef = useRef(bpm);
  bpmRef.current = bpm;
  const beatsPerMeasureRef = useRef(beatsPerMeasure);
  beatsPerMeasureRef.current = beatsPerMeasure;
  const subdivisionRef = useRef(subdivision);
  subdivisionRef.current = subdivision;
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const isFlashEnabledRef = useRef(isFlashEnabled);
  isFlashEnabledRef.current = isFlashEnabled;

  const currentAnimal = getAnimalTempo(bpm);

  // Initialize or get AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Web Audio click synthesis
  const playClickSound = useCallback((time: number, isAccent: boolean, isSub: boolean) => {
    if (isMutedRef.current || soundRef.current === 'silent') return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const baseGain = volumeRef.current;
    const currentSound = soundRef.current;

    if (currentSound === 'woodblock') {
      // Woodblock: high resonant punch
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = isAccent ? 1200 : isSub ? 700 : 920;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, time + 0.04);

      const clickVolume = (isAccent ? 1.0 : isSub ? 0.4 : 0.75) * baseGain;
      gain.gain.setValueAtTime(clickVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.05);
    } else if (currentSound === 'beep') {
      // Digital Beep (Classic electronic metronome)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = isAccent ? 1760 : isSub ? 660 : 880; // A6 or A5
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      const clickVolume = (isAccent ? 0.8 : isSub ? 0.3 : 0.6) * baseGain;
      gain.gain.setValueAtTime(clickVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 0.04);
    } else if (currentSound === 'cowbell') {
      // 808 Style dual-oscillator Cowbell
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const bandpass = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';
      const root = isAccent ? 620 : isSub ? 450 : 587;
      osc1.frequency.setValueAtTime(root, time);
      osc2.frequency.setValueAtTime(root * 1.44, time);

      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(root * 1.8, time);
      bandpass.Q.setValueAtTime(2.5, time);

      const clickVolume = (isAccent ? 0.9 : isSub ? 0.35 : 0.65) * baseGain;
      gain.gain.setValueAtTime(clickVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

      osc1.connect(bandpass);
      osc2.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.08);
      osc2.stop(time + 0.08);
    } else if (currentSound === 'drumstick') {
      // Drumstick / Rimshot sharp noise click
      const bufferSize = ctx.sampleRate * 0.03;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.005));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isAccent ? 3200 : 2200, time);
      filter.Q.setValueAtTime(3.0, time);

      const gain = ctx.createGain();
      const clickVolume = (isAccent ? 1.0 : isSub ? 0.35 : 0.7) * baseGain;
      gain.gain.setValueAtTime(clickVolume, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(time);
    }
  }, []);

  // Trigger visual beat & flash
  const triggerVisuals = useCallback((beatIndex: number, isAccent: boolean) => {
    setActiveBeat(beatIndex);

    if (isFlashEnabledRef.current) {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      setIsFlashing(isAccent ? 'accent' : 'regular');
      flashTimeoutRef.current = window.setTimeout(() => {
        setIsFlashing(null);
      }, 110);
    }
  }, []);

  // Precise Web Audio lookahead scheduler
  const scheduleLookahead = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isPlayingRef.current) return;

    const scheduleAheadTime = 0.1; // 100ms lookahead
    const secondsPerBeat = 60.0 / bpmRef.current;
    const sub = subdivisionRef.current;
    const secondsPerTick = secondsPerBeat / sub;

    while (nextNoteTimeRef.current < ctx.currentTime + scheduleAheadTime) {
      const isSubTick = currentSubdivisionRef.current !== 0;
      const isAccent = currentBeatRef.current === 0 && !isSubTick;
      const currentBeatIndex = currentBeatRef.current;
      const tickTime = nextNoteTimeRef.current;

      // Play audio precisely at tickTime
      playClickSound(tickTime, isAccent, isSubTick);

      // Schedule visual update for the downbeat
      if (!isSubTick) {
        const delayMs = Math.max(0, (tickTime - ctx.currentTime) * 1000);
        setTimeout(() => {
          if (isPlayingRef.current) {
            triggerVisuals(currentBeatIndex, isAccent);
          }
        }, delayMs);
      }

      // Advance tick counters
      currentSubdivisionRef.current = (currentSubdivisionRef.current + 1) % sub;
      if (currentSubdivisionRef.current === 0) {
        currentBeatRef.current = (currentBeatRef.current + 1) % beatsPerMeasureRef.current;
      }

      nextNoteTimeRef.current += secondsPerTick;
    }

    // Loop every 25ms
    timerIdRef.current = window.setTimeout(scheduleLookahead, 25);
  }, [playClickSound, triggerVisuals]);

  // Start metronome
  const startMetronome = useCallback(() => {
    const ctx = getAudioContext();
    isPlayingRef.current = true;
    setIsPlaying(true);
    currentBeatRef.current = 0;
    currentSubdivisionRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05; // start immediately
    scheduleLookahead();
  }, [getAudioContext, scheduleLookahead]);

  // Stop metronome
  const stopMetronome = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (timerIdRef.current) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
    setIsFlashing(null);
    setActiveBeat(0);
  }, []);

  const togglePlay = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  // Keyboard shortcut: Spacebar toggles start/stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopMetronome();
    };
  }, [stopMetronome]);

  // Tap Tempo handler
  const handleTap = () => {
    const now = Date.now();
    const timestamps = tapTimestampsRef.current;

    // Reset if last tap was over 2.5 seconds ago
    if (timestamps.length > 0 && now - timestamps[timestamps.length - 1] > 2500) {
      timestamps.length = 0;
    }

    timestamps.push(now);
    // Keep last 4 taps
    if (timestamps.length > 4) {
      timestamps.shift();
    }

    if (timestamps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < timestamps.length; i++) {
        intervals.push(timestamps[i] - timestamps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      const clamped = Math.max(30, Math.min(250, calculatedBpm));
      setBpm(clamped);
      setTapMessage(`⚡ ${clamped} BPM`);
      setTimeout(() => setTapMessage(''), 2000);
    } else {
      setTapMessage('Tap again! 👆');
    }
  };

  const adjustBpm = (delta: number) => {
    setBpm((prev) => Math.max(30, Math.min(250, prev + delta)));
  };

  return (
    <div
      className={`relative rounded-3xl p-5 sm:p-7 border-2 transition-colors duration-100 overflow-hidden font-['Fredoka',sans-serif] ${
        isFlashing === 'accent'
          ? flashIntensity === 'super'
            ? 'bg-amber-400/35 border-amber-300 shadow-[0_0_80px_rgba(251,191,36,0.5)]'
            : 'bg-amber-500/20 border-amber-400'
          : isFlashing === 'regular'
          ? flashIntensity === 'super'
            ? 'bg-slate-800/90 border-sky-400/80 shadow-[0_0_40px_rgba(56,189,248,0.3)]'
            : 'bg-slate-800/60 border-slate-700'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      {/* Background ambient glow pulse on Beat 1 */}
      {isFlashing === 'accent' && (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-400/25 via-amber-500/10 to-transparent pointer-events-none animate-in fade-in duration-75" />
      )}

      {/* Top Bar: Title & Flash Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-3xl shadow-inner">
            ⏱️
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <span>Interactive Metronome</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${currentAnimal.badgeBg}`}>
                {currentAnimal.term}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              {currentAnimal.emoji} {currentAnimal.meaning} ({currentAnimal.pronunciation})
            </p>
          </div>
        </div>

        {/* Visual Flashy Mode Controls (Virtual Sheet Music inspired) */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setIsFlashEnabled((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              isFlashEnabled
                ? 'bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
            title="Toggle Visual Screen Flash on every beat"
          >
            <Zap className={`w-3.5 h-3.5 ${isFlashEnabled ? 'fill-current' : ''}`} />
            <span>⚡ Flash Screen: {isFlashEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {isFlashEnabled && (
            <button
              type="button"
              onClick={() => setFlashIntensity((prev) => (prev === 'super' ? 'normal' : 'super'))}
              className="px-2 py-1.5 rounded-xl text-[11px] font-bold text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Toggle Flash Brightness"
            >
              {flashIntensity === 'super' ? '🌟 Super Bright' : '✨ Gentle'}
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Side Controls & Right Side Beat Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* LEFT COLUMN: Tempo Display & Adjustment (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80">
          
          {/* Giant BPM Readout */}
          <div className="text-center relative py-2">
            <div className="flex items-center justify-center gap-3">
              <span className="text-6xl sm:text-7xl font-black text-white tracking-tight font-['Fredoka',sans-serif] drop-shadow-md">
                {bpm}
              </span>
              <div className="text-left flex flex-col justify-center">
                <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                  BPM
                </span>
                <span className="text-3xl filter drop-shadow">
                  {currentAnimal.emoji}
                </span>
              </div>
            </div>

            <div className="text-sm font-bold text-slate-300 mt-1">
              <span className="text-amber-300">{currentAnimal.term}</span> — {currentAnimal.name}
            </div>
          </div>

          {/* Stepper Buttons (-5, -1, +1, +5) & Tap Button */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => adjustBpm(-5)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-sm active:scale-95 transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="-5 BPM"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => adjustBpm(-1)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-sm active:scale-95 transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="-1 BPM"
            >
              <Minus className="w-4 h-4 inline" />
            </button>

            {/* Tap Tempo Button */}
            <button
              type="button"
              onClick={handleTap}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs sm:text-sm active:scale-95 transition-all cursor-pointer shadow-lg shadow-sky-500/20 border border-sky-400/40 flex items-center gap-1.5"
            >
              <span>👆 TAP TEMPO</span>
              {tapMessage && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[10px] font-mono">
                  {tapMessage}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => adjustBpm(1)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-sm active:scale-95 transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="+1 BPM"
            >
              <Plus className="w-4 h-4 inline" />
            </button>
            <button
              type="button"
              onClick={() => adjustBpm(5)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-sm active:scale-95 transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="+5 BPM"
            >
              +5
            </button>
          </div>

          {/* Smooth BPM Slider */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between text-[11px] font-bold text-slate-400 px-1">
              <span>🐢 30 Slow</span>
              <span>120 Moderato</span>
              <span>🚀 250 Fast</span>
            </div>
            <input
              type="range"
              min={30}
              max={250}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400 focus:outline-hidden"
            />
          </div>

          {/* Quick Animal Presets */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Animal Speed Presets:
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ANIMAL_TEMPOS.map((animal) => {
                const isCurrent = currentAnimal.term === animal.term;
                const mid = Math.round((animal.minBpm + animal.maxBpm) / 2);
                return (
                  <button
                    key={animal.term}
                    type="button"
                    onClick={() => setBpm(mid)}
                    className={`p-2 rounded-2xl text-center transition-all cursor-pointer border ${
                      isCurrent
                        ? 'bg-amber-400/20 border-amber-400 text-amber-300 shadow-md scale-102 font-black'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800 text-xs'
                    }`}
                  >
                    <div className="text-xl">{animal.emoji}</div>
                    <div className="text-[11px] font-bold truncate leading-tight mt-0.5">
                      {animal.term}
                    </div>
                    <div className="text-[9px] text-slate-400">{mid}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Beats, Subdivisions, Sounds & Huge Start Button (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-5 bg-slate-950/60 p-6 rounded-3xl border border-slate-800/80">
          
          {/* Beats Per Measure (Time Signature) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Beats Per Measure:
              </span>
              <span className="text-xs font-black text-amber-300 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                {beatsPerMeasure} / 4 Time
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((beats) => (
                <button
                  key={beats}
                  type="button"
                  onClick={() => {
                    setBeatsPerMeasure(beats);
                    if (isPlaying) {
                      currentBeatRef.current = 0;
                    }
                  }}
                  className={`flex-1 min-w-[36px] py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    beatsPerMeasure === beats
                      ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {beats}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Beat Indicator Circles */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center gap-3 min-h-[72px]">
            {Array.from({ length: beatsPerMeasure }).map((_, idx) => {
              const isCurrent = isPlaying && activeBeat === idx;
              const isAccent = idx === 0;

              return (
                <div
                  key={idx}
                  className={`relative flex items-center justify-center rounded-full font-black text-xs transition-all duration-75 ${
                    isCurrent
                      ? isAccent
                        ? 'w-12 h-12 bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-950 scale-125 shadow-[0_0_25px_rgba(251,191,36,0.8)] ring-4 ring-amber-300/40'
                        : 'w-11 h-11 bg-gradient-to-tr from-sky-400 to-cyan-300 text-slate-950 scale-120 shadow-[0_0_20px_rgba(56,189,248,0.7)] ring-4 ring-sky-300/40'
                      : isAccent
                      ? 'w-10 h-10 bg-amber-500/20 text-amber-300 border-2 border-amber-500/50'
                      : 'w-9 h-9 bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {isAccent && (
                    <span className="absolute -top-2 text-[10px]">👑</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Subdivisions (Soundbrenner inspired) */}
          <div className="space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
              Subdivision:
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { sub: 1 as Subdivision, label: 'Quarter', icon: '♩' },
                { sub: 2 as Subdivision, label: 'Eighth', icon: '♫' },
                { sub: 3 as Subdivision, label: 'Triplet', icon: '3' },
                { sub: 4 as Subdivision, label: '16th', icon: '♬' },
              ].map((opt) => (
                <button
                  key={opt.sub}
                  type="button"
                  onClick={() => setSubdivision(opt.sub)}
                  className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer flex flex-col items-center justify-center ${
                    subdivision === opt.sub
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <span className="text-base leading-none">{opt.icon}</span>
                  <span className="text-[10px] opacity-80">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound Selector & Volume */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400">Click Sound:</label>
              <select
                value={sound}
                onChange={(e) => setSound(e.target.value as MetronomeSound)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white focus:outline-hidden"
              >
                <option value="woodblock">🪵 Woodblock</option>
                <option value="beep">🔔 Digital Beep</option>
                <option value="drumstick">🥁 Drumsticks</option>
                <option value="cowbell">🐮 Cowbell</option>
                <option value="silent">🔇 Silent (Flash Only)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Volume:</span>
                <button
                  type="button"
                  onClick={() => setIsMuted((v) => !v)}
                  className="text-slate-400 hover:text-white"
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-slate-300" />}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={isMuted}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 disabled:opacity-40"
              />
            </div>
          </div>

          {/* HUGE Play / Stop Button */}
          <button
            type="button"
            onClick={togglePlay}
            className={`w-full py-4 rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-3 transition-all cursor-pointer shadow-xl active:scale-98 ${
              isPlaying
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 animate-pulse'
                : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 shadow-emerald-500/25'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-6 h-6 fill-current" />
                <span>STOP METRONOME (Spacebar)</span>
              </>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                <span>START METRONOME (Spacebar)</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Footer Info Tip */}
      <div className="mt-5 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>💡</span>
          <span>
            <b>Teacher Tip:</b> Turn on <b>⚡ Flash Screen</b> to display beats visually for classroom band or recorder rehearsals!
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-500">
          Microsecond-accurate Web Audio Lookahead Engine
        </div>
      </div>
    </div>
  );
};
