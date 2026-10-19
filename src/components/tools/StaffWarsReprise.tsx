import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trophy,
  RotateCcw,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Sparkles,
  Flame,
  HelpCircle,
  Play,
  Pause,
  Swords,
  Radio,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Settings2,
} from 'lucide-react';
import {
  playLaserSound,
  playExplosionSound,
  playShieldDamageSound,
  playMusicNote,
  noteToFreq,
  getToolboxAudioContext,
} from './toolboxAudio';
import { Pitch } from '../../types/music';

export type StaffWarsClef = 'treble' | 'bass' | 'alto' | 'tenor' | 'grand';
export type StaffWarsMode = 'arcade' | 'live-mic';
export type FlightDirection = 'right-to-left' | 'left-to-right';
export type RangePreset = 'lines-spaces' | 'ledgers' | 'full-range';

// Instrument Transposition Settings for Staff Wars Live
export interface InstrumentTransposition {
  id: string;
  name: string;
  family: string;
  clef: StaffWarsClef;
  transpositionSemitones: number; // e.g. Bb trumpet is +2 semitones to convert concert to written
  octaveOffset: number;
  emoji: string;
}

export const LIVE_INSTRUMENTS: InstrumentTransposition[] = [
  { id: 'concert-c', name: 'Concert Pitch (Flute / Violin / Piano / Voice)', family: 'Concert', clef: 'treble', transpositionSemitones: 0, octaveOffset: 0, emoji: '🎹' },
  { id: 'recorder', name: 'Soprano Recorder (Concert C)', family: 'Woodwinds', clef: 'treble', transpositionSemitones: 0, octaveOffset: 0, emoji: '🪵' },
  { id: 'bb-trumpet', name: 'B♭ Trumpet / Cornet', family: 'Brass', clef: 'treble', transpositionSemitones: 2, octaveOffset: 0, emoji: '🎺' },
  { id: 'bb-clarinet', name: 'B♭ Clarinet', family: 'Woodwinds', clef: 'treble', transpositionSemitones: 2, octaveOffset: 0, emoji: '🎷' },
  { id: 'eb-alto-sax', name: 'E♭ Alto Saxophone', family: 'Woodwinds', clef: 'treble', transpositionSemitones: 9, octaveOffset: 0, emoji: '🎷' },
  { id: 'bb-tenor-sax', name: 'B♭ Tenor Saxophone', family: 'Woodwinds', clef: 'treble', transpositionSemitones: 14, octaveOffset: 0, emoji: '🎷' },
  { id: 'f-horn', name: 'F French Horn', family: 'Brass', clef: 'treble', transpositionSemitones: 7, octaveOffset: 0, emoji: '📯' },
  { id: 'trombone', name: 'Trombone / Euphonium (Bass Clef)', family: 'Brass', clef: 'bass', transpositionSemitones: 0, octaveOffset: 0, emoji: '🎺' },
  { id: 'tuba', name: 'Tuba (Bass Clef)', family: 'Brass', clef: 'bass', transpositionSemitones: 0, octaveOffset: 0, emoji: '📯' },
  { id: 'cello', name: 'Cello (Bass Clef)', family: 'Strings', clef: 'bass', transpositionSemitones: 0, octaveOffset: 0, emoji: '🎻' },
  { id: 'viola', name: 'Viola (Alto Clef)', family: 'Strings', clef: 'alto', transpositionSemitones: 0, octaveOffset: 0, emoji: '🎻' },
  { id: 'bassoon', name: 'Bassoon (Bass / Tenor Clef)', family: 'Woodwinds', clef: 'bass', transpositionSemitones: 0, octaveOffset: 0, emoji: '🪵' },
];

export interface StaffWarsTarget {
  id: string;
  step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
  accidental?: '♯' | '♭' | '♮';
  octave: number;
  clef: 'treble' | 'bass' | 'alto' | 'tenor';
  staffOffset: number; // 0 = Line 1, 1 = Space 1, 2 = Line 2, etc.
  posX: number; // 0 to 100 (% of staff width)
  hasLedgerLine?: boolean;
  ledgerPositions?: number[];
}

// Staff layout definitions per clef:
// staffOffset 0 = bottom staff line (Line 1)
// staffOffset 8 = top staff line (Line 5)
// -2, -4 = ledger lines below Line 1
// 10, 12 = ledger lines above Line 5

const TREBLE_POOL: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  { step: 'A', octave: 3, staffOffset: -4 }, // 2 ledgers below
  { step: 'B', octave: 3, staffOffset: -3 },
  { step: 'C', octave: 4, staffOffset: -2 }, // Middle C (1 ledger below)
  { step: 'D', octave: 4, staffOffset: -1 }, // Space below
  { step: 'E', octave: 4, staffOffset: 0 },  // Line 1
  { step: 'F', octave: 4, staffOffset: 1 },  // Space 1
  { step: 'G', octave: 4, staffOffset: 2 },  // Line 2
  { step: 'A', octave: 4, staffOffset: 3 },  // Space 2
  { step: 'B', octave: 4, staffOffset: 4 },  // Line 3
  { step: 'C', octave: 5, staffOffset: 5 },  // Space 3
  { step: 'D', octave: 5, staffOffset: 6 },  // Line 4
  { step: 'E', octave: 5, staffOffset: 7 },  // Space 4
  { step: 'F', octave: 5, staffOffset: 8 },  // Line 5
  { step: 'G', octave: 5, staffOffset: 9 },  // Space above
  { step: 'A', octave: 5, staffOffset: 10 }, // 1 ledger above
  { step: 'B', octave: 5, staffOffset: 11 },
  { step: 'C', octave: 6, staffOffset: 12 }, // 2 ledgers above
];

const BASS_POOL: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  { step: 'C', octave: 2, staffOffset: -4 },
  { step: 'D', octave: 2, staffOffset: -3 },
  { step: 'E', octave: 2, staffOffset: -2 }, // 1 ledger below
  { step: 'F', octave: 2, staffOffset: -1 }, // Space below
  { step: 'G', octave: 2, staffOffset: 0 },  // Line 1
  { step: 'A', octave: 2, staffOffset: 1 },  // Space 1
  { step: 'B', octave: 2, staffOffset: 2 },  // Line 2
  { step: 'C', octave: 3, staffOffset: 3 },  // Space 2
  { step: 'D', octave: 3, staffOffset: 4 },  // Line 3
  { step: 'E', octave: 3, staffOffset: 5 },  // Space 3
  { step: 'F', octave: 3, staffOffset: 6 },  // Line 4
  { step: 'G', octave: 3, staffOffset: 7 },  // Space 4
  { step: 'A', octave: 3, staffOffset: 8 },  // Line 5
  { step: 'B', octave: 3, staffOffset: 9 },  // Space above
  { step: 'C', octave: 4, staffOffset: 10 }, // Middle C (1 ledger above)
  { step: 'D', octave: 4, staffOffset: 11 },
  { step: 'E', octave: 4, staffOffset: 12 }, // 2 ledgers above
];

const ALTO_POOL: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  { step: 'B', octave: 2, staffOffset: -4 },
  { step: 'C', octave: 3, staffOffset: -3 },
  { step: 'D', octave: 3, staffOffset: -2 }, // 1 ledger below
  { step: 'E', octave: 3, staffOffset: -1 },
  { step: 'F', octave: 3, staffOffset: 0 },  // Line 1
  { step: 'G', octave: 3, staffOffset: 1 },
  { step: 'A', octave: 3, staffOffset: 2 },
  { step: 'B', octave: 3, staffOffset: 3 },
  { step: 'C', octave: 4, staffOffset: 4 },  // Line 3 (Middle C)
  { step: 'D', octave: 4, staffOffset: 5 },
  { step: 'E', octave: 4, staffOffset: 6 },
  { step: 'F', octave: 4, staffOffset: 7 },
  { step: 'G', octave: 4, staffOffset: 8 },  // Line 5
  { step: 'A', octave: 4, staffOffset: 9 },
  { step: 'B', octave: 4, staffOffset: 10 }, // 1 ledger above
  { step: 'C', octave: 5, staffOffset: 11 },
  { step: 'D', octave: 5, staffOffset: 12 }, // 2 ledgers above
];

const TENOR_POOL: { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number; staffOffset: number }[] = [
  { step: 'G', octave: 2, staffOffset: -4 },
  { step: 'A', octave: 2, staffOffset: -3 },
  { step: 'B', octave: 2, staffOffset: -2 },
  { step: 'C', octave: 3, staffOffset: -1 },
  { step: 'D', octave: 3, staffOffset: 0 },  // Line 1
  { step: 'E', octave: 3, staffOffset: 1 },
  { step: 'F', octave: 3, staffOffset: 2 },
  { step: 'G', octave: 3, staffOffset: 3 },
  { step: 'A', octave: 3, staffOffset: 4 },
  { step: 'B', octave: 3, staffOffset: 5 },
  { step: 'C', octave: 4, staffOffset: 6 },  // Line 4 (Middle C)
  { step: 'D', octave: 4, staffOffset: 7 },
  { step: 'E', octave: 4, staffOffset: 8 },  // Line 5
  { step: 'F', octave: 4, staffOffset: 9 },
  { step: 'G', octave: 4, staffOffset: 10 },
  { step: 'A', octave: 4, staffOffset: 11 },
  { step: 'B', octave: 4, staffOffset: 12 },
];

// Autocorrelation Pitch Detector for Staff Wars Live
function detectPitchAutocorrelation(
  buffer: Float32Array,
  sampleRate: number
): { freq: number; confidence: number } | null {
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / buffer.length);
  if (rms < 0.02) return null; // Noise gate

  const minFreq = 55;   // A1
  const maxFreq = 1400; // F6
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);

  let bestPeriod = 0;
  let maxCorr = 0;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - period; i++) {
      corr += buffer[i] * buffer[i + period];
    }
    const norm = corr / (buffer.length - period);
    if (norm > maxCorr) {
      maxCorr = norm;
      bestPeriod = period;
    }
  }

  if (bestPeriod > minPeriod && bestPeriod < maxPeriod) {
    const freq = sampleRate / bestPeriod;
    const confidence = maxCorr / (rms * rms);
    if (confidence > 0.42 && freq >= minFreq && freq <= maxFreq) {
      return { freq, confidence };
    }
  }
  return null;
}

// Convert frequency to Pitch letter
function freqToPitchStep(
  freq: number,
  transpositionSemitones: number
): { step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'; octave: number } {
  // MIDI note = 69 + 12 * log2(freq / 440)
  const concertMidi = Math.round(69 + 12 * Math.log2(freq / 440));
  const writtenMidi = concertMidi + transpositionSemitones;

  const noteNames: ('C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B')[] = [
    'C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B',
  ];
  const step = noteNames[((writtenMidi % 12) + 12) % 12];
  const octave = Math.floor(writtenMidi / 12) - 1;

  return { step, octave };
}

export const StaffWarsReprise: React.FC = () => {
  // Game Configuration (modeled after Staff Wars setup screen)
  const [clef, setClef] = useState<StaffWarsClef>('treble');
  const [playMode, setPlayMode] = useState<StaffWarsMode>('arcade');
  const [direction, setDirection] = useState<FlightDirection>('right-to-left'); // Authentic Staff Wars right-to-left default
  const [rangePreset, setRangePreset] = useState<RangePreset>('lines-spaces');
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentTransposition>(LIVE_INSTRUMENTS[0]);
  const [includeAccidentals, setIncludeAccidentals] = useState<boolean>(false);

  // Gameplay Live State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [shields, setShields] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('mr_arthur_staffwars_high') || 0);
    } catch {
      return 0;
    }
  });
  const [level, setLevel] = useState<number>(1);
  const [streak, setStreak] = useState<number>(0);
  const [totalAttempted, setTotalAttempted] = useState<number>(0);
  const [totalDestroyed, setTotalDestroyed] = useState<number>(0);
  const [missedNotes, setMissedNotes] = useState<{ note: string; clef: string }[]>([]);

  // Active Target Note
  const [activeTarget, setActiveTarget] = useState<StaffWarsTarget | null>(null);
  const [laserEffect, setLaserEffect] = useState<{ active: boolean; targetY: number; targetX: number } | null>(null);
  const [explosionEffect, setExplosionEffect] = useState<{ active: boolean; x: number; y: number } | null>(null);
  const [screenShake, setScreenShake] = useState<boolean>(false);
  const [levelUpAlert, setLevelUpAlert] = useState<boolean>(false);

  // Microphone Live State (Staff Wars Live)
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [micDetectedNote, setMicDetectedNote] = useState<string | null>(null);
  const [micVolume, setMicVolume] = useState<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micRafRef = useRef<number | null>(null);

  const gameLoopRef = useRef<number | null>(null);

  // Get active note pool based on clef & range preset
  const getActivePool = useCallback((targetClef: 'treble' | 'bass' | 'alto' | 'tenor') => {
    let pool = TREBLE_POOL;
    if (targetClef === 'bass') pool = BASS_POOL;
    if (targetClef === 'alto') pool = ALTO_POOL;
    if (targetClef === 'tenor') pool = TENOR_POOL;

    if (rangePreset === 'lines-spaces') {
      // Line 1 to Line 5 only (offsets 0 to 8)
      return pool.filter((n) => n.staffOffset >= 0 && n.staffOffset <= 8);
    }
    if (rangePreset === 'ledgers') {
      // Middle C and simple ledger lines (-2 to 10)
      return pool.filter((n) => n.staffOffset >= -2 && n.staffOffset <= 10);
    }
    // Full range (-4 to 12)
    return pool;
  }, [rangePreset]);

  // Spawn next note
  const spawnTarget = useCallback(() => {
    let chosenClef: 'treble' | 'bass' | 'alto' | 'tenor' = 'treble';
    if (clef === 'grand') {
      chosenClef = Math.random() > 0.5 ? 'treble' : 'bass';
    } else {
      chosenClef = clef;
    }

    const pool = getActivePool(chosenClef);
    const candidate = pool[Math.floor(Math.random() * pool.length)];

    // Calculate ledger lines needed
    const ledgers: number[] = [];
    if (candidate.staffOffset <= -2) {
      for (let o = -2; o >= candidate.staffOffset; o -= 2) ledgers.push(o);
    }
    if (candidate.staffOffset >= 10) {
      for (let o = 10; o <= candidate.staffOffset; o += 2) ledgers.push(o);
    }

    // Starting X position:
    // In classic right-to-left: note spawns on right (~90%) and flies toward clef on left (~14%)
    // In left-to-right: note spawns on left (~15%) and flies toward right (~88%)
    const startX = direction === 'right-to-left' ? 88 : 16;

    const newTarget: StaffWarsTarget = {
      id: 'target-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      step: candidate.step,
      octave: candidate.octave,
      clef: chosenClef,
      staffOffset: candidate.staffOffset,
      posX: startX,
      hasLedgerLine: ledgers.length > 0,
      ledgerPositions: ledgers,
    };

    setActiveTarget(newTarget);
    setTotalAttempted((a) => a + 1);
  }, [clef, direction, getActivePool]);

  // Handle note destruction on correct answer
  const handleCorrectHit = useCallback(
    (target: StaffWarsTarget) => {
      // 1. Audio: Laser + Explosion + Real acoustic note sound
      playLaserSound(noteToFreq(target.step, target.octave));
      playExplosionSound();
      playMusicNote({ step: target.step, octave: target.octave }, 'piano', 0.55);

      // 2. Visual: Laser beam & Explosion burst
      setLaserEffect({ active: true, targetY: target.staffOffset, targetX: target.posX });
      setExplosionEffect({ active: true, x: target.posX, y: target.staffOffset });

      setTimeout(() => setLaserEffect(null), 180);
      setTimeout(() => setExplosionEffect(null), 320);

      // 3. Scoring & Speed Streak
      // Bonus points for destroying farther away from your ship
      const distanceBonus =
        direction === 'right-to-left'
          ? Math.max(10, Math.floor((target.posX - 14) * 2))
          : Math.max(10, Math.floor((88 - target.posX) * 2));

      const streakMult = Math.min(5, streak + 1);
      const points = (100 + distanceBonus) * streakMult;

      setScore((s) => {
        const next = s + points;
        if (next > highScore) {
          setHighScore(next);
          try {
            localStorage.setItem('mr_arthur_staffwars_high', String(next));
          } catch {}
        }
        return next;
      });

      setTotalDestroyed((d) => d + 1);

      setStreak((st) => {
        const nextStreak = st + 1;
        // Level up every 10 notes destroyed (classic Staff Wars rule!)
        if (nextStreak > 0 && nextStreak % 10 === 0) {
          setLevel((lvl) => lvl + 1);
          setLevelUpAlert(true);
          setTimeout(() => setLevelUpAlert(false), 1400);
        }
        return nextStreak;
      });

      // 4. Spawn next target after brief pause
      setActiveTarget(null);
      setTimeout(spawnTarget, 300);
    },
    [direction, streak, highScore, spawnTarget]
  );

  // Handle missed note (breached defense shield)
  const handleBreach = useCallback(
    (target: StaffWarsTarget) => {
      playShieldDamageSound();
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 300);

      setMissedNotes((prev) => [
        ...prev,
        { note: `${target.step}${target.octave}`, clef: target.clef },
      ]);

      setShields((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsGameOver(true);
          setIsPlaying(false);
        }
        return next;
      });

      setStreak(0);
      setActiveTarget(null);
      setTimeout(spawnTarget, 400);
    },
    [spawnTarget]
  );

  // Submit a letter guess
  const handleLetterGuess = useCallback(
    (letter: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B') => {
      if (!isPlaying || isGameOver || isPaused || !activeTarget) return;

      if (letter === activeTarget.step) {
        handleCorrectHit(activeTarget);
      } else {
        // Wrong guess penalty: reset combo streak & play gentle error buzz
        playShieldDamageSound();
        setStreak(0);
      }
    },
    [isPlaying, isGameOver, isPaused, activeTarget, handleCorrectHit]
  );

  // Keyboard shortcut listener (letters A-G)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || isGameOver || isPaused) return;
      const key = e.key.toUpperCase();
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(key)) {
        e.preventDefault();
        handleLetterGuess(key as 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, isGameOver, isPaused, handleLetterGuess]);

  // Main animation game loop
  useEffect(() => {
    if (!isPlaying || isGameOver || isPaused) {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      return;
    }

    let lastTime = performance.now();

    const frame = (timestamp: number) => {
      const delta = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      // Speed increases with level: base speed 10% per second + 2.5% per level
      const speed = 10 + (level - 1) * 2.8;

      setActiveTarget((prev) => {
        if (!prev) return null;

        if (direction === 'right-to-left') {
          // Classic Staff Wars: Note moves left toward the clef (~14%)
          const nextX = prev.posX - speed * delta;
          if (nextX <= 14) {
            handleBreach(prev);
            return null;
          }
          return { ...prev, posX: nextX };
        } else {
          // Note moves right toward the barrier (~88%)
          const nextX = prev.posX + speed * delta;
          if (nextX >= 88) {
            handleBreach(prev);
            return null;
          }
          return { ...prev, posX: nextX };
        }
      });

      gameLoopRef.current = requestAnimationFrame(frame);
    };

    gameLoopRef.current = requestAnimationFrame(frame);

    return () => {
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, [isPlaying, isGameOver, isPaused, level, direction, handleBreach]);

  // ----------------------------------------------------
  // STAFF WARS LIVE: MICROPHONE PITCH DETECTION LOOP
  // ----------------------------------------------------
  const startMicListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      micAudioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      setIsMicListening(true);

      const buffer = new Float32Array(analyser.fftSize);

      let lastMatchedTime = 0;

      const detectLoop = () => {
        analyser.getFloatTimeDomainData(buffer);

        // Volume meter
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const vol = Math.min(100, Math.floor(Math.sqrt(sum / buffer.length) * 350));
        setMicVolume(vol);

        const result = detectPitchAutocorrelation(buffer, ctx.sampleRate);
        if (result && result.confidence > 0.45) {
          const detected = freqToPitchStep(
            result.freq,
            selectedInstrument.transpositionSemitones
          );
          setMicDetectedNote(`${detected.step}${detected.octave}`);

          // Check if this matches active target
          const now = performance.now();
          if (activeTarget && now - lastMatchedTime > 600) {
            if (detected.step === activeTarget.step) {
              lastMatchedTime = now;
              handleCorrectHit(activeTarget);
            }
          }
        } else {
          setMicDetectedNote(null);
        }

        micRafRef.current = requestAnimationFrame(detectLoop);
      };

      micRafRef.current = requestAnimationFrame(detectLoop);
    } catch {
      setIsMicListening(false);
      alert('Microphone access denied or unavailable. You can still play in Arcade Button Mode!');
    }
  };

  const stopMicListening = () => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    setIsMicListening(false);
    setMicDetectedNote(null);
    setMicVolume(0);
  };

  // Clean up mic on unmount
  useEffect(() => {
    return () => {
      stopMicListening();
    };
  }, []);

  // Start / Restart game
  const handleStartGame = () => {
    setShields(3);
    setScore(0);
    setLevel(1);
    setStreak(0);
    setTotalAttempted(0);
    setTotalDestroyed(0);
    setMissedNotes([]);
    setIsGameOver(false);
    setIsPaused(false);
    setIsPlaying(true);
    spawnTarget();
    getToolboxAudioContext().catch(() => {});

    if (playMode === 'live-mic' && !isMicListening) {
      startMicListening();
    }
  };

  // Convert staffOffset to vertical % in the 5-line staff box
  // Line 3 (offset 4) is vertical center = 50%
  const offsetToTop = (offset: number): number => {
    return 50 - (offset - 4) * 6.2;
  };

  return (
    <div className="space-y-4 select-none font-['Fredoka',sans-serif]">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/95 p-4 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center text-3xl shadow-lg ring-2 ring-cyan-400/40">
            ⚔️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Staff Wars Reprise!</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 border border-cyan-400/40">
                Original &amp; Live Edition
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Defend your clef! Blast floating notes with keyboard buttons or play on your real instrument!
            </p>
          </div>
        </div>

        {/* Mode Switcher & Stats */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <div className="bg-slate-950 p-1 rounded-2xl border border-slate-800 flex items-center">
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => {
                setPlayMode('arcade');
                stopMicListening();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                playMode === 'arcade'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              } disabled:opacity-50`}
            >
              🕹️ Arcade Mode
            </button>
            <button
              type="button"
              disabled={isPlaying}
              onClick={() => setPlayMode('live-mic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                playMode === 'live-mic'
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              } disabled:opacity-50`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Live Mic Mode</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-2xl border border-slate-800">
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-xs">
              <span className="text-slate-400">High: </span>
              <span className="font-black text-amber-400">{highScore}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Wars Setup Toolbar (Clef, Range, Direction, Instrument) */}
      <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Clefs */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold mr-1">Clef:</span>
          {[
            { id: 'treble', label: '𝄞 Treble' },
            { id: 'bass', label: '𝄢 Bass' },
            { id: 'alto', label: '𝄡 Alto' },
            { id: 'grand', label: '🎹 Grand Staff' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={isPlaying}
              onClick={() => setClef(c.id as StaffWarsClef)}
              className={`px-2.5 py-1 rounded-xl font-black transition-all cursor-pointer ${
                clef === c.id
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              } disabled:opacity-50`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Note Range Preset */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold mr-1">Range:</span>
          {[
            { id: 'lines-spaces', label: 'Lines & Spaces' },
            { id: 'ledgers', label: '+ Ledgers' },
            { id: 'full-range', label: 'Full 2-Octaves' },
          ].map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={isPlaying}
              onClick={() => setRangePreset(r.id as RangePreset)}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                rangePreset === r.id
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              } disabled:opacity-50`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Flight Direction Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-bold mr-1">Flight:</span>
          <button
            type="button"
            disabled={isPlaying}
            onClick={() =>
              setDirection(direction === 'right-to-left' ? 'left-to-right' : 'right-to-left')
            }
            className="px-2.5 py-1 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Toggle note flight direction"
          >
            {direction === 'right-to-left' ? (
              <>
                <ArrowLeft className="w-3 h-3 text-cyan-400" />
                <span>Classic (Right to Left)</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-3 h-3 text-amber-400" />
                <span>Left to Right</span>
              </>
            )}
          </button>
        </div>

        {/* Instrument Selector for Live Mic Mode */}
        {playMode === 'live-mic' && (
          <div className="w-full pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-rose-400 font-bold flex items-center gap-1">
                <Mic className="w-3.5 h-3.5" />
                <span>My Instrument:</span>
              </span>
              <select
                disabled={isPlaying}
                value={selectedInstrument.id}
                onChange={(e) => {
                  const inst = LIVE_INSTRUMENTS.find((i) => i.id === e.target.value);
                  if (inst) {
                    setSelectedInstrument(inst);
                    setClef(inst.clef);
                  }
                }}
                className="bg-slate-950 border border-slate-700 text-white rounded-xl px-2.5 py-1 font-bold text-xs focus:outline-hidden"
              >
                {LIVE_INSTRUMENTS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.emoji} {inst.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Mic Tuner Indicator */}
            {isMicListening && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                  <span>Volume:</span>
                  <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${micVolume}%` }}
                      className={`h-full transition-all ${
                        micVolume > 15 ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                </div>

                {micDetectedNote && (
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold text-xs animate-pulse">
                    Heard: {micDetectedNote}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          ARCADE SPACE BATTLE STAGE
          ========================================================================= */}
      <div
        className={`relative w-full h-80 sm:h-96 rounded-3xl bg-slate-950 border-3 border-cyan-500/50 overflow-hidden shadow-2xl flex flex-col justify-between transition-transform duration-100 ${
          screenShake ? 'scale-98 ring-4 ring-rose-500 translate-x-1 -translate-y-1' : ''
        }`}
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.12) 0%, rgba(15, 23, 42, 0.96) 100%)',
        }}
      >
        {/* Animated Warp Stars */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-ping" />
          <div className="absolute top-3/4 left-2/3 w-1.5 h-1.5 bg-cyan-300 rounded-full" />
          <div className="absolute top-1/3 left-3/4 w-1 h-1 bg-amber-300 rounded-full animate-pulse" />
          <div className="absolute top-2/3 left-1/5 w-1 h-1 bg-white rounded-full" />
        </div>

        {/* LEVEL UP NOTIFICATION BANNER */}
        {levelUpAlert && (
          <div className="absolute inset-x-0 top-12 z-50 flex items-center justify-center pointer-events-none animate-in zoom-in-95">
            <div className="px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-2xl ring-4 ring-white animate-bounce">
              ⚡ LEVEL {level}! SPEED INCREASED! ⚡
            </div>
          </div>
        )}

        {/* HUD Top Bar: Shields, Level, Streak, Score */}
        <div className="relative z-20 px-5 py-3 flex items-center justify-between text-white border-b border-cyan-500/20 bg-slate-950/70 backdrop-blur-xs">
          {/* Shields (3 Lives) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Shields:
            </span>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((shieldNum) => (
                <div
                  key={shieldNum}
                  className={`w-7 h-5 rounded-md flex items-center justify-center transition-all ${
                    shields >= shieldNum
                      ? 'bg-cyan-400 shadow-md shadow-cyan-400/50 text-slate-950 text-xs'
                      : 'bg-slate-800/80 border border-slate-700 opacity-30'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 fill-current" />
                </div>
              ))}
            </div>
          </div>

          {/* Level & Streak */}
          <div className="flex items-center gap-4">
            <div className="text-xs text-cyan-300 font-mono">
              LEVEL <span className="font-black text-white text-base">{level}</span>
            </div>

            {streak > 1 && (
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-black animate-pulse">
                <Flame className="w-3.5 h-3.5 text-rose-400 fill-current" />
                <span>{streak}x Combo!</span>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Score</div>
            <div className="text-xl font-black text-amber-400 leading-none">{score}</div>
          </div>
        </div>

        {/* =========================================================================
            MUSICAL STAFF LINES & FLYING TARGET NOTE
            ========================================================================= */}
        <div className="relative flex-1 w-full flex items-center">
          {/* 5 Staff Lines: Line 1 (bottom), 2, 3, 4, 5 (top) */}
          <div className="absolute inset-x-0 w-full pointer-events-none">
            {[8, 6, 4, 2, 0].map((offset) => {
              const topPos = offsetToTop(offset);
              return (
                <div
                  key={offset}
                  style={{ top: `${topPos}%` }}
                  className="absolute inset-x-0 h-0.5 bg-cyan-400/70 shadow-xs shadow-cyan-400/40"
                />
              );
            })}
          </div>

          {/* Clef Glyph on the Left */}
          <div className="absolute left-6 text-6xl text-cyan-300 pointer-events-none font-serif leading-none drop-shadow-[0_0_12px_rgba(6,182,212,0.6)]">
            {activeTarget?.clef === 'bass' ? '𝄢' : activeTarget?.clef === 'alto' ? '𝄡' : activeTarget?.clef === 'tenor' ? '𝄡' : '𝄞'}
          </div>

          {/* Defender Spaceship protecting the Clef (Left) */}
          <div className="absolute left-2.5 z-20 pointer-events-none">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_16px_rgba(6,182,212,0.8)] border border-white flex items-center justify-center text-sm">
              🚀
            </div>
          </div>

          {/* Defense Shield Barrier */}
          <div
            style={{ left: direction === 'right-to-left' ? '14%' : '88%' }}
            className="absolute inset-y-4 w-1 bg-gradient-to-b from-cyan-400 via-rose-500 to-cyan-400 shadow-[0_0_15px_rgba(244,63,94,0.8)] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute -top-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[8px] font-black uppercase tracking-wider animate-pulse">
              Barrier
            </div>
          </div>

          {/* ACTIVE MOVING NOTE */}
          {activeTarget && isPlaying && !isGameOver && (
            <div
              style={{
                left: `${activeTarget.posX}%`,
                top: `${offsetToTop(activeTarget.staffOffset)}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-30 transition-all duration-75 flex items-center justify-center pointer-events-none"
            >
              {/* Optional Ledger Lines */}
              {activeTarget.hasLedgerLine &&
                activeTarget.ledgerPositions?.map((ledgerOffset) => (
                  <div
                    key={ledgerOffset}
                    style={{
                      top: `${(ledgerOffset - activeTarget.staffOffset) * -6.2}px`,
                    }}
                    className="absolute w-11 h-0.5 bg-cyan-300 shadow-xs shadow-cyan-300/80"
                  />
                ))}

              {/* Glowing Notehead Alien Ship */}
              <div className="relative w-9 h-6 rounded-full bg-gradient-to-r from-amber-300 via-rose-400 to-amber-300 border-2 border-white shadow-[0_0_18px_rgba(251,191,36,0.9)] transform -rotate-20 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
              </div>

              {/* Note Stem */}
              <div
                style={{
                  top: activeTarget.staffOffset >= 4 ? '14px' : '-28px',
                  right: activeTarget.staffOffset >= 4 ? '28px' : '2px',
                }}
                className="absolute w-0.5 h-7 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]"
              />
            </div>
          )}

          {/* Laser Blast Animation from Ship */}
          {laserEffect?.active && (
            <div
              style={{
                top: `${offsetToTop(laserEffect.targetY)}%`,
                left: '12%',
                width: `${Math.max(20, laserEffect.targetX - 10)}%`,
              }}
              className="absolute h-1.5 bg-gradient-to-r from-cyan-400 via-white to-amber-300 shadow-[0_0_20px_#38BDF8] z-40 animate-out fade-out duration-150"
            />
          )}

          {/* Explosion Particle Burst */}
          {explosionEffect?.active && (
            <div
              style={{
                left: `${explosionEffect.x}%`,
                top: `${offsetToTop(explosionEffect.y)}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute z-50 text-5xl animate-ping pointer-events-none"
            >
              💥
            </div>
          )}

          {/* Start Screen / Game Over Screen Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-6 text-center space-y-4">
              {isGameOver ? (
                <div className="space-y-3 animate-in zoom-in-95 max-w-md">
                  <div className="text-5xl">💥</div>
                  <h4 className="text-2xl sm:text-3xl font-black text-rose-400">
                    Defenses Breached! Game Over
                  </h4>
                  <p className="text-xs text-slate-300 font-sans">
                    Final Score:{' '}
                    <span className="text-amber-400 font-black text-base">{score}</span> • Level{' '}
                    <span className="text-white font-bold">{level}</span> • Accuracy:{' '}
                    <span className="text-emerald-300 font-bold">
                      {totalAttempted > 0
                        ? Math.round((totalDestroyed / totalAttempted) * 100)
                        : 0}
                      %
                    </span>
                  </p>

                  {/* Review of Missed Notes */}
                  {missedNotes.length > 0 && (
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-left">
                      <div className="text-[11px] font-bold text-rose-300 mb-1">
                        Notes that slipped past:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(new Set(missedNotes.map((m) => m.note))).map((n) => (
                          <span
                            key={n}
                            className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white"
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Play Again 🚀
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-w-md animate-in fade-in">
                  <div className="text-5xl">🛸</div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white">
                    Defend the Musical Staff!
                  </h4>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    Notes float across the staff heading for your defense barrier. Identify each
                    note name before it hits your shields!
                  </p>
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-cyan-300 font-bold">
                    {playMode === 'arcade'
                      ? '🕹️ Arcade Mode: Click or press keys A - G on keyboard!'
                      : `🎤 Live Mic Mode: Play ${selectedInstrument.name} into your mic!`}
                  </div>
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-slate-950 font-black text-base shadow-xl shadow-cyan-400/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Launch Defense Mission! ⚡
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note Controls: [ C ] [ D ] [ E ] [ F ] [ G ] [ A ] [ B ] */}
        <div className="relative z-20 px-4 py-3 bg-slate-950/80 border-t border-cyan-500/30 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline shrink-0">
            {playMode === 'arcade' ? 'Press Key / Click:' : 'Playing via Mic:'}
          </span>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5 flex-1 max-w-xl mx-auto">
            {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((noteLetter) => (
              <button
                key={noteLetter}
                type="button"
                disabled={!isPlaying || isGameOver}
                onClick={() => handleLetterGuess(noteLetter)}
                className="py-3 sm:py-3.5 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 hover:from-cyan-500 hover:to-blue-600 active:from-cyan-400 active:to-blue-500 text-white font-black text-base sm:text-lg border border-slate-700 hover:border-cyan-300 transition-all cursor-pointer shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center leading-none"
              >
                <span>{noteLetter}</span>
                <span className="text-[9px] text-slate-400 font-mono mt-0.5 hidden sm:inline">
                  [{noteLetter}]
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
