import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  CheckCircle2,
  RotateCcw,
  Settings2,
  Music,
  Check,
  ChevronDown,
} from 'lucide-react';
import { getToolboxAudioContext } from './toolboxAudio';

// ---------------------------------------------------------------------------
// Pitch and Frequency Mathematics
// ---------------------------------------------------------------------------
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

interface TuningString {
  id: string;
  name: string;
  note: string;
  octave: number;
  midi: number;
  targetFreq: number;
}

export interface InstrumentPreset {
  id: string;
  name: string;
  category: string;
  emoji: string;
  description: string;
  strings: TuningString[];
}

function calculateTargetFreq(midi: number, a4Ref: number): number {
  return a4Ref * Math.pow(2, (midi - 69) / 12);
}

function createString(
  id: string,
  name: string,
  note: string,
  octave: number,
  midi: number,
  a4Ref: number
): TuningString {
  return {
    id,
    name,
    note,
    octave,
    midi,
    targetFreq: calculateTargetFreq(midi, a4Ref),
  };
}

function getInstrumentPresets(a4Ref: number): InstrumentPreset[] {
  return [
    {
      id: 'chromatic',
      name: 'Chromatic Tuner',
      category: 'All Instruments',
      emoji: '🎵',
      description: 'Tunes any instrument or singing voice automatically',
      strings: [],
    },
    {
      id: 'guitar-standard',
      name: 'Guitar (Standard)',
      category: 'Guitars',
      emoji: '🎸',
      description: 'Standard 6-string guitar tuning (E A D G B E)',
      strings: [
        createString('g6', '6th String', 'E', 2, 40, a4Ref),
        createString('g5', '5th String', 'A', 2, 45, a4Ref),
        createString('g4', '4th String', 'D', 3, 50, a4Ref),
        createString('g3', '3rd String', 'G', 3, 55, a4Ref),
        createString('g2', '2nd String', 'B', 3, 59, a4Ref),
        createString('g1', '1st String', 'E', 4, 64, a4Ref),
      ],
    },
    {
      id: 'guitar-drop-d',
      name: 'Guitar (Drop D)',
      category: 'Guitars',
      emoji: '⚡',
      description: 'Drop D heavy rock tuning (D A D G B E)',
      strings: [
        createString('g6d', '6th String', 'D', 2, 38, a4Ref),
        createString('g5', '5th String', 'A', 2, 45, a4Ref),
        createString('g4', '4th String', 'D', 3, 50, a4Ref),
        createString('g3', '3rd String', 'G', 3, 55, a4Ref),
        createString('g2', '2nd String', 'B', 3, 59, a4Ref),
        createString('g1', '1st String', 'E', 4, 64, a4Ref),
      ],
    },
    {
      id: 'ukulele',
      name: 'Ukulele (Standard C)',
      category: 'Folk & Plucked',
      emoji: '🌺',
      description: 'Standard Hawaiian soprano/concert ukulele (G C E A)',
      strings: [
        createString('u4', '4th String', 'G', 4, 67, a4Ref),
        createString('u3', '3rd String', 'C', 4, 60, a4Ref),
        createString('u2', '2nd String', 'E', 4, 64, a4Ref),
        createString('u1', '1st String', 'A', 4, 69, a4Ref),
      ],
    },
    {
      id: 'violin',
      name: 'Violin',
      category: 'Orchestral Strings',
      emoji: '🎻',
      description: 'Standard violin tuning in perfect fifths (G D A E)',
      strings: [
        createString('v4', '4th String (G)', 'G', 3, 55, a4Ref),
        createString('v3', '3rd String (D)', 'D', 4, 62, a4Ref),
        createString('v2', '2nd String (A)', 'A', 4, 69, a4Ref),
        createString('v1', '1st String (E)', 'E', 5, 76, a4Ref),
      ],
    },
    {
      id: 'viola',
      name: 'Viola',
      category: 'Orchestral Strings',
      emoji: '🎼',
      description: 'Standard viola tuning in fifths (C G D A)',
      strings: [
        createString('va4', '4th String (C)', 'C', 3, 48, a4Ref),
        createString('va3', '3rd String (G)', 'G', 3, 55, a4Ref),
        createString('va2', '2nd String (D)', 'D', 4, 62, a4Ref),
        createString('va1', '1st String (A)', 'A', 4, 69, a4Ref),
      ],
    },
    {
      id: 'cello',
      name: 'Cello',
      category: 'Orchestral Strings',
      emoji: '🎻',
      description: 'Deep orchestral cello tuning (C G D A)',
      strings: [
        createString('vc4', '4th String (C)', 'C', 2, 36, a4Ref),
        createString('vc3', '3rd String (G)', 'G', 2, 43, a4Ref),
        createString('vc2', '2nd String (D)', 'D', 3, 50, a4Ref),
        createString('vc1', '1st String (A)', 'A', 3, 57, a4Ref),
      ],
    },
    {
      id: 'bass-guitar',
      name: 'Bass (4-String)',
      category: 'Guitars',
      emoji: '🎸',
      description: 'Standard electric & upright bass (E A D G)',
      strings: [
        createString('b4', '4th String (E)', 'E', 1, 28, a4Ref),
        createString('b3', '3rd String (A)', 'A', 1, 33, a4Ref),
        createString('b2', '2nd String (D)', 'D', 2, 38, a4Ref),
        createString('b1', '1st String (G)', 'G', 2, 43, a4Ref),
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// High-Precision Pitch Detection with Parabolic Interpolation
// ---------------------------------------------------------------------------
function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minFreq: number = 38,   // Low D2 / E1
  maxFreq: number = 1100  // High C6
): { freq: number; confidence: number; rms: number } | null {
  const len = buffer.length;
  let sumSquares = 0;
  for (let i = 0; i < len; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / len);
  if (rms < 0.015) return null; // Noise floor gate

  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);

  let bestPeriod = -1;
  let maxCorr = -1;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let corr = 0;
    for (let i = 0; i < len - period; i++) {
      corr += buffer[i] * buffer[i + period];
    }
    const norm = corr / (len - period);
    if (norm > maxCorr) {
      maxCorr = norm;
      bestPeriod = period;
    }
  }

  if (bestPeriod <= minPeriod || bestPeriod >= maxPeriod) return null;

  // Parabolic interpolation around peak for sub-sample precision
  const p = bestPeriod;
  let prevCorr = 0;
  let nextCorr = 0;
  for (let i = 0; i < len - (p - 1); i++) prevCorr += buffer[i] * buffer[i + p - 1];
  for (let i = 0; i < len - (p + 1); i++) nextCorr += buffer[i] * buffer[i + p + 1];
  prevCorr /= len - (p - 1);
  nextCorr /= len - (p + 1);

  const delta = (nextCorr - prevCorr) / (2 * (2 * maxCorr - prevCorr - nextCorr) || 1);
  const refinedPeriod = p + (Math.abs(delta) < 1 ? delta : 0);

  const freq = sampleRate / refinedPeriod;
  const confidence = maxCorr / (rms * rms);

  if (confidence > 0.38 && freq >= minFreq && freq <= maxFreq) {
    return { freq, confidence, rms };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Component Implementation
// ---------------------------------------------------------------------------
export const MusicTuner: React.FC = () => {
  // Settings
  const [a4Calibration, setA4Calibration] = useState<number>(440);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('guitar-standard');
  const [targetStringId, setTargetStringId] = useState<string | null>(null); // null = Auto Detect
  const [isKidsMode, setIsKidsMode] = useState<boolean>(true); // ±8¢ tolerance for beginners vs ±3¢ pro
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Audio & Mic State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Live pitch values
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [detectedNote, setDetectedNote] = useState<string>('--');
  const [detectedOctave, setDetectedOctave] = useState<number | null>(null);
  const [centsDeviation, setCentsDeviation] = useState<number>(0);
  const [isInTune, setIsInTune] = useState<boolean>(false);
  const [closestStringId, setClosestStringId] = useState<string | null>(null);

  // Fun celebratory state
  const [tunedStrings, setTunedStrings] = useState<Record<string, boolean>>({});
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(null);

  // Reference Tone Generator
  const [playingToneNote, setPlayingToneNote] = useState<string | null>(null);
  const activeToneOscRef = useRef<OscillatorNode | null>(null);
  const activeToneGainRef = useRef<GainNode | null>(null);

  // Audio Context & Animation references
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inTuneDurationRef = useRef<number>(0);

  // Dynamic presets based on A4 calibration
  const presets = useMemo(() => getInstrumentPresets(a4Calibration), [a4Calibration]);
  const currentPreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) || presets[1],
    [presets, selectedPresetId]
  );

  // String target currently being tuned
  const currentTargetString = useMemo(() => {
    if (targetStringId) {
      return currentPreset.strings.find((s) => s.id === targetStringId) || null;
    }
    if (closestStringId) {
      return currentPreset.strings.find((s) => s.id === closestStringId) || null;
    }
    return null;
  }, [currentPreset, targetStringId, closestStringId]);

  // Stop tone generator
  const stopTone = useCallback(() => {
    if (activeToneGainRef.current && audioContextRef.current) {
      try {
        const now = audioContextRef.current.currentTime;
        activeToneGainRef.current.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      } catch {
        // ignore
      }
    }
    setTimeout(() => {
      try {
        activeToneOscRef.current?.stop();
        activeToneOscRef.current?.disconnect();
      } catch {
        // ignore
      }
      activeToneOscRef.current = null;
      activeToneGainRef.current = null;
      setPlayingToneNote(null);
    }, 90);
  }, []);

  // Play reference pitch for a string
  const playTone = useCallback(
    async (freq: number, noteLabel: string) => {
      if (playingToneNote === noteLabel) {
        stopTone();
        return;
      }
      stopTone();

      try {
        const ctx = await getToolboxAudioContext();
        if (!ctx) return;
        audioContextRef.current = ctx;

        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warm, smooth triangle tone with a hint of sine
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        activeToneOscRef.current = osc;
        activeToneGainRef.current = gain;
        setPlayingToneNote(noteLabel);
      } catch {
        // audio blocked
      }
    },
    [playingToneNote, stopTone]
  );

  // Start microphone listening
  const startListening = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const ctx = await getToolboxAudioContext();
      if (!ctx) throw new Error('Audio Context unavailable');
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096; // Long buffer for low bass resolution
      analyser.smoothingTimeConstant = 0.2;

      source.connect(analyser);
      analyserRef.current = analyser;
      mediaStreamRef.current = stream;

      setIsListening(true);
    } catch (err: any) {
      setMicError(
        err?.message?.includes('Permission')
          ? 'Microphone access was denied. Please allow microphone permissions in your browser bar.'
          : 'Could not access microphone. Please check your audio input settings.'
      );
      setIsListening(false);
    }
  };

  // Stop microphone listening
  const stopListening = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    analyserRef.current = null;
    setIsListening(false);
    setDetectedFreq(null);
    setDetectedNote('--');
    setDetectedOctave(null);
    setCentsDeviation(0);
    setIsInTune(false);
  }, []);

  // Main Audio Processing Loop
  useEffect(() => {
    if (!isListening) return;

    const analyser = analyserRef.current;
    const ctx = audioContextRef.current;
    if (!analyser || !ctx) return;

    const buffer = new Float32Array(analyser.fftSize);
    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');

    const tolerance = isKidsMode ? 7.5 : 3.0; // In-tune tolerance in cents

    const updatePitchLoop = () => {
      analyser.getFloatTimeDomainData(buffer);

      // Draw subtle sound wave oscilloscope
      if (canvas && canvasCtx) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        canvasCtx.beginPath();
        const sliceWidth = canvas.width / 128;
        let x = 0;
        for (let i = 0; i < 128; i++) {
          const v = buffer[i * 16] * 0.5 + 0.5;
          const y = v * canvas.height;
          if (i === 0) canvasCtx.moveTo(x, y);
          else canvasCtx.lineTo(x, y);
          x += sliceWidth;
        }
        canvasCtx.stroke();
      }

      // Detect Pitch
      const result = detectPitch(buffer, ctx.sampleRate);

      if (result) {
        const freq = result.freq;
        setDetectedFreq(freq);

        // Convert freq to exact MIDI pitch relative to current A4
        const midiExact = 69 + 12 * Math.log2(freq / a4Calibration);
        const midiNearest = Math.round(midiExact);
        const noteIndex = ((midiNearest % 12) + 12) % 12;
        const noteName = NOTE_NAMES[noteIndex];
        const octave = Math.floor(midiNearest / 12) - 1;

        setDetectedNote(noteName);
        setDetectedOctave(octave);

        // If target string is explicitly selected, measure deviation from that string
        let targetFreqToUse: number;
        let targetStrMatch: TuningString | null = null;

        if (targetStringId && currentPreset.strings.length > 0) {
          const found = currentPreset.strings.find((s) => s.id === targetStringId);
          if (found) {
            targetFreqToUse = found.targetFreq;
            targetStrMatch = found;
          } else {
            targetFreqToUse = calculateTargetFreq(midiNearest, a4Calibration);
          }
        } else if (currentPreset.strings.length > 0) {
          // Auto string detection: find closest instrument string
          let closest = currentPreset.strings[0];
          let minDiff = Infinity;
          for (const str of currentPreset.strings) {
            const diff = Math.abs(str.midi - midiExact);
            if (diff < minDiff) {
              minDiff = diff;
              closest = str;
            }
          }
          setClosestStringId(closest.id);
          targetStrMatch = closest;
          targetFreqToUse = closest.targetFreq;
        } else {
          // Chromatic mode
          targetFreqToUse = calculateTargetFreq(midiNearest, a4Calibration);
        }

        // Cents calculation: 1200 * log2(f / fTarget)
        const cents = 1200 * Math.log2(freq / targetFreqToUse);
        const clampedCents = Math.max(-50, Math.min(50, Math.round(cents)));
        setCentsDeviation(clampedCents);

        const inTune = Math.abs(cents) <= tolerance;
        setIsInTune(inTune);

        // Fun reward: Hold in tune for 0.6 seconds to mark string as tuned
        if (inTune && targetStrMatch) {
          inTuneDurationRef.current += 1;
          if (inTuneDurationRef.current > 18) {
            const sid = targetStrMatch.id;
            setTunedStrings((prev) => {
              if (prev[sid]) return prev;
              const next = { ...prev, [sid]: true };
              // Check if all strings tuned!
              if (
                currentPreset.strings.length > 0 &&
                currentPreset.strings.every((s) => next[s.id] || s.id === sid)
              ) {
                setCelebrationMessage(`🎉 ALL STRINGS IN TUNE! AMAZING JOB! 🌟`);
                setTimeout(() => setCelebrationMessage(null), 4000);
              }
              return next;
            });
          }
        } else {
          inTuneDurationRef.current = Math.max(0, inTuneDurationRef.current - 1);
        }
      } else {
        // Silence or low confidence
        inTuneDurationRef.current = 0;
      }

      animFrameIdRef.current = requestAnimationFrame(updatePitchLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(updatePitchLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [isListening, a4Calibration, currentPreset, targetStringId, isKidsMode]);

  // Clean up mic and tone on unmount
  useEffect(() => {
    return () => {
      stopListening();
      stopTone();
    };
  }, [stopListening, stopTone]);

  // Clear tuned strings when preset changes
  useEffect(() => {
    setTunedStrings({});
    setTargetStringId(null);
    setClosestStringId(null);
  }, [selectedPresetId]);

  // Gauge angle: maps -50 cents (-60 deg) to +50 cents (+60 deg)
  const needleRotation = (centsDeviation / 50) * 55;

  return (
    <div className="space-y-5 select-none font-sans">
      {/* Top Controls Toolbar: Instrument Selector & Mode Toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-md">
        {/* Instrument Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{currentPreset.emoji}</span>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
              Instrument
            </label>
            <div className="relative inline-block">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1 rounded-xl bg-slate-900 border border-slate-700 font-bold text-xs text-white focus:border-amber-400 focus:outline-hidden cursor-pointer"
              >
                {presets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Toggles: Kids Mode, Tuning Target, Settings */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Kids Tolerance Mode */}
          <button
            type="button"
            onClick={() => setIsKidsMode((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              isKidsMode
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40 shadow-xs'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Kids Mode gives a friendly ±8¢ tolerance for beginners"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isKidsMode ? 'Kids Friendly Mode (±8¢)' : 'Pro Precision (±3¢)'}</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
              showSettings
                ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Calibration & Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3 animate-in fade-in text-xs">
          <div className="flex items-center justify-between font-bold text-slate-300">
            <span>Reference Pitch (A4 Calibration)</span>
            <span className="text-amber-300 font-mono font-black">{a4Calibration} Hz</span>
          </div>
          <div className="flex items-center gap-2">
            {[432, 440, 442, 444].map((hz) => (
              <button
                key={hz}
                type="button"
                onClick={() => setA4Calibration(hz)}
                className={`flex-1 py-1.5 rounded-xl font-bold cursor-pointer transition-all border ${
                  a4Calibration === hz
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {hz} Hz {hz === 440 ? '(Standard)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mic Error Banner */}
      {micError && (
        <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{micError}</span>
          <button
            type="button"
            onClick={startListening}
            className="px-3 py-1 rounded-lg bg-rose-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* All Strings In Tune Celebration Banner */}
      {celebrationMessage && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black text-center text-sm sm:text-base shadow-xl animate-bounce">
          {celebrationMessage}
        </div>
      )}

      {/* =========================================================================
          CENTER STAGE: The Interactive Visual Tuner Gauge & Big Note Display
          ========================================================================= */}
      <div
        className={`relative p-6 sm:p-8 rounded-3xl border-3 transition-all duration-300 flex flex-col items-center justify-center text-center overflow-hidden shadow-2xl ${
          isInTune
            ? 'bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 border-emerald-400 shadow-emerald-500/25 ring-4 ring-emerald-400/20'
            : isListening && detectedFreq
            ? centsDeviation < 0
              ? 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border-amber-400/60 shadow-amber-500/10'
              : 'bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-950 border-rose-400/60 shadow-rose-500/10'
            : 'bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-slate-800'
        }`}
      >
        {/* Subtle Waveform Canvas in Background */}
        <canvas
          ref={canvasRef}
          width={280}
          height={60}
          className="absolute top-2 inset-x-0 mx-auto pointer-events-none opacity-30"
        />

        {/* Circular Pitch Gauge Arch (SVG) */}
        <div className="relative w-64 h-36 flex items-center justify-center">
          <svg viewBox="0 0 240 140" className="w-full h-full overflow-visible">
            {/* Background Arc: Flat (Left), Center (In Tune), Sharp (Right) */}
            {/* Flat arc: -50 to -5 */}
            <path
              d="M 25 120 A 95 95 0 0 1 100 28"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.35"
            />
            {/* In-tune sweet spot: -5 to +5 */}
            <path
              d="M 100 28 A 95 95 0 0 1 140 28"
              fill="none"
              stroke="#10B981"
              strokeWidth="14"
              strokeLinecap="round"
              opacity={isInTune ? '1' : '0.65'}
            />
            {/* Sharp arc: +5 to +50 */}
            <path
              d="M 140 28 A 95 95 0 0 1 215 120"
              fill="none"
              stroke="#F43F5E"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.35"
            />

            {/* Gauge Tick Marks */}
            {[-50, -30, -15, 0, 15, 30, 50].map((c) => {
              const rot = (c / 50) * 55;
              return (
                <g key={c} transform={`rotate(${rot} 120 120)`}>
                  <line
                    x1="120"
                    y1="18"
                    x2="120"
                    y2={c === 0 ? '30' : '24'}
                    stroke={c === 0 ? '#10B981' : '#94A3B8'}
                    strokeWidth={c === 0 ? '3' : '1.5'}
                  />
                </g>
              );
            })}

            {/* Center Pivot Point */}
            <circle cx="120" cy="120" r="7" fill="#38BDF8" className="shadow-lg" />

            {/* Animated Needle */}
            {isListening && detectedFreq && (
              <g
                transform={`rotate(${needleRotation} 120 120)`}
                className="transition-transform duration-100 ease-out"
              >
                <line
                  x1="120"
                  y1="120"
                  x2="120"
                  y2="16"
                  stroke={isInTune ? '#34D399' : centsDeviation < 0 ? '#FBBF24' : '#FB7185'}
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="filter drop-shadow-md"
                />
                <circle
                  cx="120"
                  cy="16"
                  r="5"
                  fill={isInTune ? '#34D399' : centsDeviation < 0 ? '#FBBF24' : '#FB7185'}
                />
              </g>
            )}
          </svg>

          {/* In-Tune Bullseye Glow */}
          {isInTune && (
            <div className="absolute top-1 text-2xl animate-ping opacity-75">
              ✨
            </div>
          )}
        </div>

        {/* Big Note Letter Display */}
        <div className="relative mt-1">
          <div className="flex items-baseline justify-center">
            <span
              className={`text-6xl sm:text-7xl font-black font-['Fredoka',sans-serif] tracking-tight transition-colors ${
                isInTune
                  ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(52,211,153,0.6)]'
                  : isListening && detectedFreq
                  ? centsDeviation < 0
                    ? 'text-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                    : 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.3)]'
                  : 'text-slate-600'
              }`}
            >
              {detectedNote}
            </span>
            {detectedOctave !== null && (
              <span className="text-2xl sm:text-3xl font-black text-slate-400 ml-1">
                {detectedOctave}
              </span>
            )}
          </div>

          {/* Dynamic Action Callout Badge */}
          <div className="mt-2 min-h-[34px] flex items-center justify-center">
            {isInTune ? (
              <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider font-['Fredoka',sans-serif] shadow-lg animate-pulse">
                <CheckCircle2 className="w-4 h-4 fill-current" />
                <span>PERFECT! IN TUNE!</span>
              </div>
            ) : isListening && detectedFreq ? (
              centsDeviation < 0 ? (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40 font-black text-xs uppercase tracking-wider font-['Fredoka',sans-serif]">
                  <span>↑ TUNE UP (TOO LOW)</span>
                  <span className="font-mono text-amber-200">({centsDeviation}¢)</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40 font-black text-xs uppercase tracking-wider font-['Fredoka',sans-serif]">
                  <span>↓ TUNE DOWN (TOO HIGH)</span>
                  <span className="font-mono text-rose-200">(+{centsDeviation}¢)</span>
                </div>
              )
            ) : isListening ? (
              <div className="text-xs text-sky-300 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>Listening for sound... Pluck a string or sing into your mic!</span>
              </div>
            ) : (
              <div className="text-xs text-slate-400">
                Click &quot;Start Listening&quot; to begin tuning
              </div>
            )}
          </div>

          {/* Technical Readout (Hz and Target) */}
          <div className="mt-2 text-xs font-mono text-slate-400 flex items-center justify-center gap-3">
            <span>
              Live: <strong className="text-white">{detectedFreq ? `${detectedFreq.toFixed(1)} Hz` : '--'}</strong>
            </span>
            <span>•</span>
            <span>
              Target:{' '}
              <strong className="text-slate-300">
                {currentTargetString ? `${currentTargetString.targetFreq.toFixed(1)} Hz` : `${a4Calibration} Hz`}
              </strong>
            </span>
          </div>
        </div>

        {/* Primary Mic Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            className={`flex items-center gap-2.5 px-6 py-3 rounded-2xl font-black text-sm transition-all cursor-pointer shadow-xl font-['Fredoka',sans-serif] active:scale-95 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 ring-2 ring-rose-400/40'
                : 'bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 shadow-emerald-500/30 hover:scale-105'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Mute Microphone</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 animate-pulse" />
                <span>Start Listening 🎙️</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* =========================================================================
          INSTRUMENT STRING BOARD (Guitar / Violin / Ukulele / Bass Pegs)
          ========================================================================= */}
      {currentPreset.strings.length > 0 && (
        <div className="p-4 rounded-3xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <span>{currentPreset.name} Strings</span>
                <span className="text-[10px] text-slate-500 font-normal">
                  ({Object.keys(tunedStrings).length} / {currentPreset.strings.length} in tune)
                </span>
              </h4>
              <p className="text-[11px] text-slate-400">
                Tap a string to tune it specifically, or use Auto-Detect!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTargetStringId(null)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                targetStringId === null
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              Auto-Detect Mode ⚡
            </button>
          </div>

          {/* Strings Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
            {currentPreset.strings.map((str) => {
              const isSelected = targetStringId === str.id;
              const isClosest = targetStringId === null && closestStringId === str.id;
              const isTuned = tunedStrings[str.id];
              const isTonePlaying = playingToneNote === `${str.note}${str.octave}`;

              return (
                <div
                  key={str.id}
                  onClick={() => setTargetStringId(isSelected ? null : str.id)}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative group flex flex-col justify-between gap-2 ${
                    isTuned
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-white shadow-emerald-500/10'
                      : isSelected || isClosest
                      ? 'bg-sky-500/20 border-sky-400 text-white shadow-sky-500/20 scale-102'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  {/* In Tune Check Badge */}
                  {isTuned && (
                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-black">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase leading-none">
                      {str.name.split(' ')[0]}
                    </div>
                    <div className="text-xl font-black font-['Fredoka',sans-serif] mt-0.5 text-white flex items-baseline justify-center">
                      <span>{str.note}</span>
                      <span className="text-xs text-slate-400 ml-0.5">{str.octave}</span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {str.targetFreq.toFixed(1)} Hz
                    </div>
                  </div>

                  {/* Play Reference Pitch Tone Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTone(str.targetFreq, `${str.note}${str.octave}`);
                    }}
                    className={`mt-1 py-1 px-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      isTonePlaying
                        ? 'bg-amber-400 text-slate-950 animate-pulse font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={`Hear ${str.note}${str.octave} reference tone`}
                  >
                    {isTonePlaying ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    <span>{isTonePlaying ? 'Stop' : 'Hear'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Reset All Checkmarks */}
      {Object.keys(tunedStrings).length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setTunedStrings({})}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Checked Strings</span>
          </button>
        </div>
      )}
    </div>
  );
};
