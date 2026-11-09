/**
 * Monophonic pitch detection for the tuner (YIN-style difference function, pure and cheap:
 * one 2048-sample frame is a few milliseconds of work, run ~12 times a second).
 */

export interface PitchReading {
  hz: number;
  midi: number; // nearest MIDI note
  cents: number; // -50..50 from that note
  clarity: number; // 0..1, how periodic the sound is
}

export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1500): PitchReading | null {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.01) return null; // too quiet to tune

  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minHz));
  const w = n - maxLag;
  const d = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + lag];
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  // Cumulative mean normalized difference (YIN step 3).
  const cmnd = new Float32Array(maxLag + 1);
  let running = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag];
    cmnd[lag] = lag < minLag ? 1 : (d[lag] * lag) / (running || 1);
  }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cmnd[lag] < 0.15) {
      while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) return null;
  // Parabolic interpolation for sub-sample accuracy.
  const a = cmnd[best - 1] ?? cmnd[best];
  const b = cmnd[best];
  const c = cmnd[best + 1] ?? cmnd[best];
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const hz = sampleRate / (best + Math.max(-1, Math.min(1, shift)));
  const exact = 69 + 12 * Math.log2(hz / 440);
  const midi = Math.round(exact);
  return { hz, midi, cents: Math.round((exact - midi) * 100), clarity: Math.max(0, Math.min(1, 1 - b)) };
}
