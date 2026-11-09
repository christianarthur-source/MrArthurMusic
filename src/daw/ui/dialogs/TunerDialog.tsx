import { useEffect, useRef, useState } from 'react';
import { detectPitch, PitchReading } from '../../dsp/pitch';
import { midiNoteName } from '../../midi/gm';
import { Modal } from '../controls';
import { useStudio } from '../studio';

/**
 * Tuner: listens to the microphone and shows the nearest note and how sharp or flat it is.
 * The microphone is opened only while this window is open and released when it closes.
 */
export function TunerDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [reading, setReading] = useState<PitchReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const held = useRef<{ r: PitchReading; at: number } | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let source: MediaStreamAudioSourceNode | null = null;
    let cancelled = false;
    const ctx = s.engine.ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const frame = new Float32Array(analyser.fftSize);
    (async () => {
      try {
        await s.engine.unlock();
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        source = ctx.createMediaStreamSource(stream);
        source.connect(analyser); // not connected to the speakers: no feedback
        timer = window.setInterval(() => {
          analyser.getFloatTimeDomainData(frame);
          const r = detectPitch(frame, ctx.sampleRate);
          const now = performance.now();
          if (r && r.clarity > 0.8) {
            held.current = { r, at: now };
            setReading(r);
          } else if (held.current && now - held.current.at > 600) {
            held.current = null;
            setReading(null);
          }
        }, 80);
      } catch {
        setError('The microphone is blocked or not available. Allow the microphone for this site, then open the tuner again.');
      }
    })();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      source?.disconnect();
      analyser.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [s]);

  const cents = reading?.cents ?? 0;
  const inTune = !!reading && Math.abs(cents) <= 5;
  return (
    <Modal title="🎵 Tuner" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 py-2" data-testid="tuner">
        {error ? (
          <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">{error}</p>
        ) : (
          <>
            <div className={inTune ? 'text-7xl font-bold text-emerald-300' : 'text-7xl font-bold text-slate-100'} aria-live="polite">
              {reading ? midiNoteName(reading.midi) : '—'}
            </div>
            <div className="relative h-10 w-full max-w-sm rounded-full bg-slate-800" aria-hidden>
              <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-emerald-400/70" />
              {reading && (
                <div
                  className={inTune ? 'absolute top-1 h-8 w-2 -translate-x-1/2 rounded-full bg-emerald-300' : 'absolute top-1 h-8 w-2 -translate-x-1/2 rounded-full bg-amber-400'}
                  style={{ left: `${50 + cents}%`, transition: 'left 80ms linear' }}
                />
              )}
            </div>
            <p className="h-5 text-sm text-slate-300">
              {!reading
                ? 'Play or sing one note…'
                : inTune
                  ? 'In tune!'
                  : cents < 0
                    ? `${-cents} cents flat: tighten / go a little higher`
                    : `${cents} cents sharp: loosen / go a little lower`}
            </p>
            {reading && <p className="font-mono text-xs text-slate-500">{reading.hz.toFixed(1)} Hz</p>}
            <p className="text-center text-xs text-slate-500">Ukulele strings (top to bottom): G C E A · Guitar: E A D G B E</p>
          </>
        )}
      </div>
    </Modal>
  );
}
