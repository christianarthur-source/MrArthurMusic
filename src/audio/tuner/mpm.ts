// Pitch detector: McLeod Pitch Method (normalized square difference function) computed with an
// FFT, picking the FIRST key maximum that is >= K x the highest one (this prevents octave
// errors), then refined with parabolic interpolation, measured over several periods for
// sub-cent precision. Pure functions, no DOM. Erasable-syntax TypeScript (Node can run it).

export interface PitchResult {
  hz: number;
  clarity: number;
  period: number;
}

export interface DetectOptions {
  minHz?: number;
  maxHz?: number;
  /** Key-maximum selection constant (McLeod's k). */
  k?: number;
  /** Peaks below this height are not trusted at all. */
  minClarity?: number;
}

const fftCache = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>();

function tables(n: number) {
  let t = fftCache.get(n);
  if (t) return t;
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n);
    sin[i] = Math.sin((2 * Math.PI * i) / n);
  }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    rev[i] = r;
  }
  t = { cos, sin, rev };
  fftCache.set(n, t);
  return t;
}

/** In-place radix-2 complex FFT. `inverse` computes the unscaled inverse transform. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  const { cos, sin, rev } = tables(n);
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sgn = inverse ? 1 : -1;
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0, w = 0; k < half; k++, w += step) {
        const wr = cos[w];
        const wi = sgn * sin[w];
        const a = start + k;
        const b = a + half;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

let scratchRe = new Float64Array(0);
let scratchIm = new Float64Array(0);
// Side data of the last nsdf() call, used to evaluate the NSDF at fractional lags.
let lastPower = new Float64Array(0);
let lastM = new Float64Array(0);
let lastN = 0;

/** Normalized square difference function of `x` for lags 0..x.length-1. */
export function nsdf(x: Float32Array | Float64Array): Float64Array {
  const w = x.length;
  let n = 1;
  while (n < 2 * w) n <<= 1;
  if (scratchRe.length !== n) {
    scratchRe = new Float64Array(n);
    scratchIm = new Float64Array(n);
  }
  const re = scratchRe;
  const im = scratchIm;
  let mean = 0;
  for (let i = 0; i < w; i++) mean += x[i];
  mean /= w;
  re.fill(0);
  im.fill(0);
  for (let i = 0; i < w; i++) re[i] = x[i] - mean;
  fft(re, im);
  if (lastPower.length !== n) lastPower = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = re[i] * re[i] + im[i] * im[i];
    lastPower[i] = re[i];
    im[i] = 0;
  }
  lastN = n;
  fft(re, im, true);
  // m'(tau) = sum over j of (x_j^2 + x_(j+tau)^2), built incrementally from m'(0).
  const out = new Float64Array(w);
  if (lastM.length !== w) lastM = new Float64Array(w);
  let m = 0;
  for (let i = 0; i < w; i++) {
    const v = x[i] - mean;
    m += 2 * v * v;
  }
  for (let tau = 0; tau < w; tau++) {
    lastM[tau] = m;
    out[tau] = m > 1e-20 ? (2 * (re[tau] / n)) / m : 0;
    const a = x[tau] - mean;
    const b = x[w - 1 - tau] - mean;
    m -= a * a + b * b;
  }
  return out;
}

/** NSDF at a fractional lag, evaluated exactly from the stored power spectrum. */
function nsdfAt(lag: number): number {
  const n = lastN;
  const P = lastPower;
  const wv = (2 * Math.PI * lag) / n;
  let sum = P[0] + P[n >> 1] * Math.cos(Math.PI * lag);
  // Chebyshev-style recurrence keeps this to one multiply-add per bin.
  const c = 2 * Math.cos(wv);
  let c0 = Math.cos(wv); // cos(1*wv)
  let cm = 1;            // cos(0)
  for (let k = 1; k < n >> 1; k++) {
    sum += 2 * P[k] * c0;
    const next = c * c0 - cm;
    cm = c0;
    c0 = next;
  }
  const r = sum / n;
  const i0 = Math.floor(lag);
  const f = lag - i0;
  const m = lastM[i0] * (1 - f) + lastM[Math.min(i0 + 1, lastM.length - 1)] * f;
  return m > 1e-20 ? (2 * r) / m : 0;
}

function parabolic(y0: number, y1: number, y2: number): number {
  const denom = y0 - 2 * y1 + y2;
  if (denom === 0) return 0;
  const d = (0.5 * (y0 - y2)) / denom;
  return Math.abs(d) < 1 ? d : 0;
}

export function detectPitch(buf: Float32Array, sampleRate: number, opts: DetectOptions = {}): PitchResult | null {
  const { minHz = 27, maxHz = 4200, k = 0.9, minClarity = 0.6 } = opts;
  const w = buf.length;
  const r = nsdf(buf);
  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(Math.ceil(sampleRate / minHz), (w >> 1) - 1);
  if (maxTau <= minTau + 2) return null;

  // Key maxima: highest point of each positive stretch of the NSDF.
  const peaks: number[] = [];
  let tau = 1;
  while (tau < maxTau + 1 && r[tau] > 0) tau++; // skip the lag-0 lobe
  while (tau < maxTau + 1) {
    while (tau < maxTau + 1 && r[tau] <= 0) tau++;
    let best = -1;
    let bestV = 0;
    while (tau < maxTau + 1 && r[tau] > 0) {
      if (r[tau] > bestV) { bestV = r[tau]; best = tau; }
      tau++;
    }
    if (best >= minTau && best <= maxTau && best > 0 && best < w - 1) peaks.push(best);
  }
  if (peaks.length === 0) return null;
  let top = 0;
  for (const p of peaks) if (r[p] > top) top = r[p];
  if (top < minClarity) return null;
  let pick = -1;
  for (const p of peaks) {
    if (r[p] >= k * top) { pick = p; break; }
  }
  if (pick < 0) return null;

  const d0 = parabolic(r[pick - 1], r[pick], r[pick + 1]);
  let period = pick + d0;
  const clarity = Math.min(1, r[pick] - 0.25 * (r[pick - 1] - r[pick + 1]) * d0);

  // Refine over several periods: a peak n periods away has the same relative position error
  // spread over n x the lag, so the period estimate gets ~n times more precise.
  const nMax = Math.min(16, Math.floor(((w >> 1) - 2) / period));
  for (let n = nMax; n >= 2; n--) {
    const center = Math.round(period * n);
    const span = Math.max(1, Math.min(Math.ceil(n * 0.5) + 1, Math.floor(period / 2) - 1));
    let bi = -1;
    let bv = -Infinity;
    for (let i = center - span; i <= center + span; i++) {
      if (i < 1 || i >= w - 1) continue;
      if (r[i] > bv) { bv = r[i]; bi = i; }
    }
    if (bi < 2 || bi >= w - 2) continue;
    if (!(r[bi] >= r[bi - 1] && r[bi] >= r[bi + 1])) continue;
    if (bv < 0.8 * r[pick]) continue;
    let at = bi + parabolic(r[bi - 1], r[bi], r[bi + 1]);
    if (period < 64) {
      // Narrow peaks (high notes, many harmonics) bias a 3-point parabola: re-fit on a finer grid.
      for (const step of [0.25, 0.06]) {
        const f0 = nsdfAt(at - step);
        const f1 = nsdfAt(at);
        const f2 = nsdfAt(at + step);
        at += step * parabolic(f0, f1, f2);
      }
    }
    const refined = at / n;
    if (Math.abs(refined - period) < 0.6) {
      period = refined;
      break;
    }
  }
  return { hz: sampleRate / period, clarity, period };
}
