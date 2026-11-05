import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Maximize2, Minimize2, Volume2 } from 'lucide-react';
import { useRememberedState } from '../../hooks/useRememberedState';

/** How long the room must stay over the line before the alert shows. */
const TOO_LOUD_AFTER_MS = 2000;

const alertTone = () => {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.85);
    setTimeout(() => ctx.close(), 1200);
  } catch {}
};

/**
 * Classroom noise meter: listens through the microphone and shows how loud the room is.
 * Audio is only measured in the browser; nothing is recorded or sent anywhere.
 */
export const VolumeMeterView: React.FC = () => {
  const [limit, setLimit] = useRememberedState('volume.limit', 65); // 0–100 on the meter
  const [sensitivity, setSensitivity] = useRememberedState('volume.sensitivity', 50); // 0–100
  const [sound, setSound] = useRememberedState('volume.sound', false);
  const [listening, setListening] = useState(false);
  const [level, setLevel] = useState(0);
  const [tooLoud, setTooLoud] = useState(false);
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);
  const settings = useRef({ limit, sensitivity, sound });
  settings.current = { limit, sensitivity, sound };

  const stop = () => {
    if (!audio.current) return;
    cancelAnimationFrame(audio.current.raf);
    audio.current.stream.getTracks().forEach((t) => t.stop());
    audio.current.ctx.close();
    audio.current = null;
    setListening(false);
    setLevel(0);
    setTooLoud(false);
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const ctx = new AudioContext();
      await ctx.resume(); // some browsers (iPad Safari) start audio paused until asked
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      let smoothed = 0;
      let overSince = 0;
      let alerted = false;
      let lastFrame = performance.now();

      const frame = () => {
        const now = performance.now();
        const dt = Math.min(1, (now - lastFrame) / 1000);
        lastFrame = now;
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        const rms = Math.sqrt(sum / samples.length);
        // Loudness in dB mapped onto 0–100; sensitivity shifts how quiet a room reads as "0"
        const db = 20 * Math.log10(rms || 1e-8);
        const floor = -70 + (settings.current.sensitivity - 50) * -0.4;
        const target = Math.max(0, Math.min(100, ((db - floor) / -floor) * 100));
        // Rise within ~0.1 s, fall over ~0.7 s, measured in real time so slow screens don't lag
        const tau = target > smoothed ? 0.08 : 0.7;
        smoothed += (target - smoothed) * (1 - Math.exp(-dt / tau));
        setLevel(smoothed);

        if (smoothed > settings.current.limit) {
          if (!overSince) overSince = now;
          if (now - overSince > TOO_LOUD_AFTER_MS) {
            setTooLoud(true);
            if (!alerted && settings.current.sound) alertTone();
            alerted = true;
          }
        } else if (smoothed < settings.current.limit - 5) {
          overSince = 0;
          alerted = false;
          setTooLoud(false);
        }
        if (audio.current) audio.current.raf = requestAnimationFrame(frame);
      };
      audio.current = { ctx, stream, raf: requestAnimationFrame(frame) };
      setListening(true);
    } catch (err: any) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again.'
          : 'No microphone was found on this device.'
      );
    }
  };

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      stop();
    };
  }, []);

  const zone = level > limit ? 'loud' : level > limit * 0.7 ? 'warn' : 'ok';
  const zoneText = { ok: 'Just right', warn: 'Getting loud', loud: 'Too loud!' }[tooLoud ? 'loud' : zone === 'loud' ? 'warn' : zone];
  const barColor = tooLoud || zone === 'loud' ? 'bg-rose-500' : zone === 'warn' ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-brand-600" />
        <h1 className="text-xl font-bold text-stone-900 dark:text-white">Volume Meter</h1>
      </div>

      <div
        ref={stage}
        className={`relative rounded-3xl p-6 sm:p-10 shadow-card transition-colors duration-300 flex flex-col justify-center ${
          tooLoud ? 'bg-rose-600 animate-pulse' : 'bg-stone-900'
        } text-white ${fullscreen ? 'min-h-screen' : 'min-h-[24rem]'}`}
      >
        <button
          type="button"
          onClick={() => (document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen?.().catch(() => {}))}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          className="absolute top-4 right-4 p-2 rounded-xl bg-white/15 hover:bg-white/25"
        >
          {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        <div className={`text-center font-extrabold mb-8 ${fullscreen ? 'text-[8vw]' : 'text-5xl sm:text-6xl'}`} aria-live="polite">
          {listening ? zoneText : 'Volume Meter'}
        </div>

        {/* Meter */}
        <div className="relative h-16 sm:h-20 rounded-full bg-white/10 overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-[width] duration-75`} style={{ width: `${level}%` }} />
          <div className="absolute inset-y-0 w-1 bg-white shadow" style={{ left: `calc(${limit}% - 2px)` }} title="Too-loud line" />
        </div>
        <div className="flex justify-between text-xs text-white/60 mt-2">
          <span>Quiet</span>
          <span>Too-loud line</span>
          <span>Loud</span>
        </div>

        <div className="mt-8 flex justify-center">
          {listening ? (
            <button type="button" onClick={stop} className="px-6 py-3 rounded-2xl bg-white/15 hover:bg-white/25 font-bold flex items-center gap-2">
              <MicOff className="w-5 h-5" />
              Stop listening
            </button>
          ) : (
            <button type="button" onClick={start} className="px-6 py-3 rounded-2xl bg-white text-stone-900 font-bold flex items-center gap-2 hover:scale-105 transition-transform">
              <Mic className="w-5 h-5" />
              Start listening
            </button>
          )}
        </div>
        {error && <p className="mt-4 text-center text-sm text-rose-200">{error}</p>}
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-6 shadow-card border border-stone-200/80 dark:border-stone-800 grid sm:grid-cols-3 gap-5 text-sm">
        <label className="space-y-2">
          <span className="font-semibold text-stone-700 dark:text-stone-200">Too-loud line</span>
          <input type="range" min={20} max={95} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-full" />
          <span className="block text-xs text-stone-500">Lower it for quiet work time, raise it for singing and games.</span>
        </label>
        <label className="space-y-2">
          <span className="font-semibold text-stone-700 dark:text-stone-200">Microphone sensitivity</span>
          <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="w-full" />
          <span className="block text-xs text-stone-500">Turn it up if the meter barely moves.</span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="mt-1" />
          <span>
            <span className="font-semibold text-stone-700 dark:text-stone-200 block">Chime when too loud</span>
            <span className="text-xs text-stone-500">Plays once each time the room goes over the line.</span>
          </span>
        </label>
      </div>
      <p className="text-xs text-stone-400 text-center">The microphone is only measured on this device. Nothing is recorded or uploaded.</p>
    </div>
  );
};
