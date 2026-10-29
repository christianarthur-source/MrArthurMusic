/**
 * Small analysis helpers for tests and in-browser self-tests.
 */

/** Root-mean-square over [start, end). */
export function rms(signal: Float32Array, start = 0, end = signal.length): number {
  const s = Math.max(0, start);
  const e = Math.min(signal.length, end);
  if (e <= s) return 0;
  let acc = 0;
  for (let i = s; i < e; i++) acc += signal[i] * signal[i];
  return Math.sqrt(acc / (e - s));
}

/** Maximum absolute sample value over [start, end). */
export function peakAbs(signal: Float32Array, start = 0, end = signal.length): number {
  let m = 0;
  const e = Math.min(signal.length, end);
  for (let i = Math.max(0, start); i < e; i++) {
    const a = Math.abs(signal[i]);
    if (a > m) m = a;
  }
  return m;
}

export interface FrequencyEstimateOptions {
  minHz?: number; // default 40
  maxHz?: number; // default 2000
  /** Analysis window length in samples (default: up to 8192, taken from the middle of the signal). */
  windowLength?: number;
}

/**
 * Fundamental frequency estimate via normalised autocorrelation of a window
 * from the middle of the signal, choosing the first strong peak (>= 90 % of
 * the global max, avoids octave errors) and refining with parabolic
 * interpolation. Returns 0 if the signal is too short or silent.
 */
export function estimateFrequency(signal: Float32Array, sampleRate: number, options: FrequencyEstimateOptions = {}): number {
  const minHz = options.minHz ?? 40;
  const maxHz = options.maxHz ?? 2000;
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.ceil(sampleRate / minHz);
  const avail = signal.length - maxLag - 2;
  if (avail < 2 * minLag) return 0;
  const W = Math.min(avail, options.windowLength ?? Math.max(8192, 2 * maxLag));
  const start = Math.floor((signal.length - W - maxLag - 2) / 2);

  const pre = new Float64Array(W + maxLag + 3);
  for (let i = 0; i < W + maxLag + 2; i++) {
    const v = signal[start + i];
    pre[i + 1] = pre[i] + v * v;
  }
  const e0 = pre[W] - pre[0];
  if (e0 <= 1e-12) return 0;

  const r = new Float64Array(maxLag + 2);
  for (let tau = minLag - 1; tau <= maxLag + 1; tau++) {
    let dot = 0;
    for (let i = 0; i < W; i++) dot += signal[start + i] * signal[start + i + tau];
    const e1 = pre[tau + W] - pre[tau];
    r[tau] = dot / Math.sqrt(e0 * e1 + 1e-20);
  }
  let gmax = -Infinity;
  for (let tau = minLag; tau <= maxLag; tau++) if (r[tau] > gmax) gmax = r[tau];
  if (!(gmax > 0)) return 0;
  let best = -1;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (r[tau] >= 0.9 * gmax && r[tau] >= r[tau - 1] && r[tau] >= r[tau + 1]) {
      best = tau;
      break;
    }
  }
  if (best < 0) return 0;
  const a = r[best - 1];
  const b = r[best];
  const c = r[best + 1];
  const denom = a - 2 * b + c;
  const delta = Math.abs(denom) > 1e-12 ? (0.5 * (a - c)) / denom : 0;
  return sampleRate / (best + Math.max(-1, Math.min(1, delta)));
}

/**
 * Onset detection on a peak envelope (1 ms hops). An onset is reported at hop h
 * when the envelope is >= `thresholdDb` (dBFS) AND at least 6 dB above the mean
 * envelope of the preceding 20 ms (so sustained background does not mask or
 * trigger onsets), with a 30 ms refractory period. The returned index is the
 * first sample in that hop reaching max(threshold, half the hop's peak).
 */
export function findOnsets(signal: Float32Array, sampleRate: number, thresholdDb: number): number[] {
  const thr = Math.pow(10, thresholdDb / 20);
  const hop = Math.max(1, Math.round(sampleRate / 1000));
  const nh = Math.ceil(signal.length / hop);
  const env = new Float32Array(nh);
  for (let h = 0; h < nh; h++) {
    const e = Math.min(signal.length, (h + 1) * hop);
    let m = 0;
    for (let i = h * hop; i < e; i++) {
      const a = Math.abs(signal[i]);
      if (a > m) m = a;
    }
    env[h] = m;
  }
  const HIST = 20;
  const REFRACTORY = 30;
  const onsets: number[] = [];
  let last = -Infinity;
  let histSum = 0;
  for (let h = 0; h < nh; h++) {
    const cnt = Math.min(h, HIST);
    const avg = cnt ? histSum / cnt : 0;
    if (env[h] >= thr && env[h] >= 2 * avg && h - last >= REFRACTORY) {
      const level = Math.max(thr, 0.5 * env[h]);
      let idx = h * hop;
      const e = Math.min(signal.length, idx + hop);
      while (idx < e - 1 && Math.abs(signal[idx]) < level) idx++;
      onsets.push(idx);
      last = h;
    }
    histSum += env[h];
    if (h >= HIST) histSum -= env[h - HIST];
  }
  return onsets;
}
