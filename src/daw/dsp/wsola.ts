/**
 * WSOLA time-stretching (pitch-preserving) with optional pitch shift.
 *
 * Algorithm
 * ---------
 * - Hann-windowed frames (~23 ms 'fast', ~30 ms 'high'), synthesis hop = frame/2
 *   (50 % overlap; a periodic Hann at 50 % sums to exactly 1, and we still
 *   divide by the accumulated window sum so edges/odd cases never modulate).
 * - Frame k is centred at output sample k*Hs and nominally reads input around
 *   k*Hs/R. Its exact input position is chosen inside +/- tolerance by
 *   maximising the normalised cross-correlation with the "natural continuation"
 *   of the previous frame (prevStart + Hs) -> waveform continuity, no phasing.
 * - The search runs on a mono downmix; the SAME offsets are applied to every
 *   channel so the stereo image / inter-channel phase is preserved.
 * - Speed: a coarse search on a box-filtered, decimated downmix (x4 'fast',
 *   x2 'high') followed by a full-resolution refinement around the winner.
 *   Energy normalisation uses prefix sums (O(1) per lag).
 * - Transients: a cheap energy-ratio onset detector (5 ms windows, > 6 dB jump)
 *   finds attacks (detectTransients). For each attack, the frame whose nominal centre is nearest
 *   is the "anchor" (searched only +/- 2 ms, so the attack stays on the time
 *   grid); earlier frames are pushed back so they do not contain the attack (no
 *   pre-echo), later frames that still contain it use the exact continuation
 *   of the previous frame (all copies coincide -> no flams), and frames after
 *   that never re-read the attack. Timing error is bounded, not cumulative.
 * - Pitch shift by s semitones: stretch by ratio * 2^(s/12), then resample by
 *   2^(s/12) with a windowed-sinc interpolator (see resample.ts). The final
 *   length is always exactly Math.round(inputLength * ratio).
 *
 * Known artifacts / limitations
 * -----------------------------
 * - Transients: attacks are kept single and on time, but the material right
 *   after an attack is played at the original speed for one frame (~25 ms) and
 *   the following frames catch up, so decays may sound slightly "jumpy" at
 *   large ratios. Soft onsets (< ~6 dB energy jump in 5 ms) are not detected and
 *   may flam a little (copies a few ms apart). Very dense onsets (< ~40 ms
 *   apart) limit the similarity search and can add roughness to sustained
 *   content underneath.
 * - Polyphonic / chordal material can sound "phasey" or warbly, especially at
 *   large ratios (> 2 or < 0.5); WSOLA can only align to one dominant period.
 * - Very low bass (< ~45 Hz 'fast', < ~35 Hz 'high') has periods longer than
 *   the search range and may beat/flutter.
 * - Alignment uses an L+R downmix; out-of-phase stereo content (L = -R) cancels
 *   in the downmix and is aligned blindly (still phase-coherent, just not
 *   similarity-optimised).
 * - Pitch shift is "resampling" style: formants move with pitch (chipmunk /
 *   giant effect on vocals). Large shifts (+/-12) amplify the stretch artifacts
 *   above since the internal stretch factor is ratio * 2^(s/12).
 * - Pitch-up resampling low-passes at the new Nyquist (necessary, no aliasing).
 */

import { prepareResampler } from './resample';

export type StretchQuality = 'fast' | 'high';

export interface StretchOptions {
  /** output duration / input duration, clamped to [0.25, 4] */
  ratio: number;
  /** -12..12 */
  semitones: number;
  quality: StretchQuality;
  sampleRate: number;
}

export class StretchCancelledError extends Error {
  readonly cancelled = true;
  constructor(message = 'Time-stretch job was cancelled') {
    super(message);
    this.name = 'StretchCancelledError';
  }
}

export const MIN_RATIO = 0.25;
export const MAX_RATIO = 4;
export const MAX_SEMITONES = 12;

interface Params {
  frame: number; // L (even)
  tol: number; // search half-range, samples
  tolTransient: number;
  decim: number;
  zeroCrossings: number;
  onsetBlock: number; // onset detector block size, samples
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Clamp/sanitise options (NaN ratio -> 1, NaN semitones -> 0). */
export function normalizeStretchOptions(opts: StretchOptions): StretchOptions {
  const ratio = Number.isFinite(opts.ratio) ? clamp(opts.ratio, MIN_RATIO, MAX_RATIO) : 1;
  const semitones = Number.isFinite(opts.semitones) ? clamp(opts.semitones, -MAX_SEMITONES, MAX_SEMITONES) : 0;
  const sampleRate = Number.isFinite(opts.sampleRate) && opts.sampleRate > 0 ? opts.sampleRate : 44100;
  const quality: StretchQuality = opts.quality === 'high' ? 'high' : 'fast';
  return { ratio, semitones, quality, sampleRate };
}

/** Exact output length for a given input length and ratio (after clamping). */
export function stretchedLength(inputLength: number, ratio: number): number {
  const r = Number.isFinite(ratio) ? clamp(ratio, MIN_RATIO, MAX_RATIO) : 1;
  return Math.round(inputLength * r);
}

function getParams(quality: StretchQuality, sr: number): Params {
  const ms = (x: number) => Math.round((sr * x) / 1000);
  if (quality === 'high') {
    return { frame: 2 * ms(15), tol: ms(16), tolTransient: ms(2), decim: 2, zeroCrossings: 16, onsetBlock: ms(5) };
  }
  return { frame: 2 * ms(11.6), tol: ms(11), tolTransient: ms(2), decim: 4, zeroCrossings: 8, onsetBlock: ms(5) };
}

/**
 * Core generator: yields progress fractions in [0, 1) periodically and returns
 * the output channels. Both the sync and async front-ends drive it.
 */
export function* stretchGenerator(channels: Float32Array[], options: StretchOptions): Generator<number, Float32Array[], void> {
  const opts = normalizeStretchOptions(options);
  const nCh = channels.length;
  if (nCh === 0) return [];
  let n = 0;
  for (const c of channels) n = Math.max(n, c.length);
  const outLen = Math.round(n * opts.ratio);

  if (opts.ratio === 1 && opts.semitones === 0) {
    return channels.map((c) => {
      const o = new Float32Array(n);
      o.set(c);
      return o;
    });
  }
  if (n === 0 || outLen === 0) return channels.map(() => new Float32Array(outLen));

  const P = getParams(opts.quality, opts.sampleRate);
  const pitch = Math.pow(2, opts.semitones / 12);
  const R = opts.ratio * pitch;
  const stLen = opts.semitones === 0 ? outLen : Math.max(1, Math.round(n * R));
  const wsolaShare = opts.semitones === 0 ? 1 : 0.85;

  const stretched = yield* wsolaCore(channels, n, R, stLen, P, wsolaShare);
  if (opts.semitones === 0) return stretched;

  // Resample by `pitch` to the exact target length, in chunks so we can yield.
  const result: Float32Array[] = [];
  const CHUNK = 32768;
  const totalWork = nCh * outLen;
  let done = 0;
  for (let c = 0; c < nCh; c++) {
    const rs = prepareResampler(stretched[c], pitch, { outLength: outLen, zeroCrossings: P.zeroCrossings });
    const out = new Float32Array(outLen);
    for (let from = 0; from < outLen; from += CHUNK) {
      const to = Math.min(outLen, from + CHUNK);
      rs.render(out, from, to);
      done += to - from;
      yield wsolaShare + ((1 - wsolaShare) * done) / totalWork;
    }
    stretched[c] = new Float32Array(0); // release memory early
    result.push(out);
  }
  return result;
}

/**
 * Energy-jump transient detector (used to anchor attacks), run on the first
 * difference of the signal (high-frequency emphasis). Windows of `blockSize`
 * samples at half-window hops: a window whose energy exceeds 4x (6 dB) the
 * mean of the four preceding non-overlapping windows (plus a small absolute
 * floor) starts an onset; the position is refined to the first sample
 * reaching half the window's peak difference. Returns sample indices.
 * `gain` is the downmix gain (number of summed channels) for the floor.
 */
export function detectTransients(mono: Float32Array, blockSize: number, gain = 1): number[] {
  const B = Math.max(16, Math.floor(blockSize / 2) * 2);
  const hop = B >> 1;
  const len = mono.length;
  const nh = Math.ceil(len / hop);
  // Energy per half-block, then window energy = sum of two halves.
  // First difference = cheap high-frequency emphasis: attacks are broadband,
  // while sustained bass/tonal energy is strongly attenuated.
  const diff = new Float32Array(len);
  for (let i = 1; i < len; i++) diff[i] = mono[i] - mono[i - 1];
  const halfE = new Float64Array(nh + 1);
  for (let h = 0; h < nh; h++) {
    let e = 0;
    const end = Math.min(len, (h + 1) * hop);
    for (let i = h * hop; i < end; i++) e += diff[i] * diff[i];
    halfE[h] = e;
  }
  const winE = (h: number) => (h < 0 ? 0 : halfE[h] + halfE[h + 1]);
  const onsets: number[] = [];
  const absFloor = B * 1e-7 * gain * gain;
  let prevFlag = false;
  for (let h = 0; h < nh; h++) {
    // reference: windows starting at h-2, h-4, h-6, h-8 (do not overlap window h)
    let ref = 0;
    let cnt = 0;
    for (let q = h - 2; q >= 0 && q >= h - 8; q -= 2) {
      ref += winE(q);
      cnt++;
    }
    ref = cnt ? ref / cnt : 0;
    const flag = winE(h) > 4 * ref + absFloor;
    if (flag && !prevFlag) {
      const b0 = h * hop;
      const b1 = Math.min(len, b0 + B);
      let m = 0;
      for (let i = b0; i < b1; i++) m = Math.max(m, Math.abs(diff[i]));
      let t = b0;
      while (t < b1 && Math.abs(diff[t]) < 0.5 * m) t++;
      if (onsets.length === 0 || t - onsets[onsets.length - 1] > B) onsets.push(t);
    }
    prevFlag = flag;
  }
  return onsets;
}

function* wsolaCore(
  channels: Float32Array[],
  n: number,
  R: number,
  stLen: number,
  P: Params,
  progScale: number,
): Generator<number, Float32Array[], void> {
  const nCh = channels.length;
  const L = P.frame;
  const Hs = L >> 1;
  const tol = P.tol;
  const d = P.decim;
  const pad = L + tol + 4 * d + 16;
  const padLen = n + 2 * pad;

  // Padded, sanitised channel copies + mono downmix.
  const xp: Float32Array[] = [];
  const mono = new Float32Array(padLen);
  for (let c = 0; c < nCh; c++) {
    const a = new Float32Array(padLen);
    const src = channels[c];
    const m = Math.min(src.length, n);
    for (let i = 0; i < m; i++) {
      const v = src[i];
      const s = v - v === 0 ? v : 0; // NaN/Inf -> 0
      a[pad + i] = s;
      mono[pad + i] += s;
    }
    xp.push(a);
  }

  // Decimated (box-filtered) downmix and prefix sums of squares.
  const nd = Math.floor(padLen / d);
  const y = new Float32Array(nd);
  const invD = 1 / d;
  for (let j = 0, i = 0; j < nd; j++) {
    let s = 0;
    for (let k = 0; k < d; k++) s += mono[i++];
    y[j] = s * invD;
  }
  const py = new Float64Array(nd + 1);
  for (let j = 0; j < nd; j++) py[j + 1] = py[j] + y[j] * y[j];
  const px = new Float64Array(padLen + 1);
  for (let i = 0; i < padLen; i++) px[i + 1] = px[i] + mono[i] * mono[i];

  const B = Math.max(16, P.onsetBlock);
  const onsets = detectTransients(mono, B, nCh);

  // Periodic Hann window.
  const w = new Float32Array(L);
  for (let i = 0; i < L; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / L);

  const oOff = L;
  const outPadLen = stLen + 3 * L + 2;
  const outP: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) outP.push(new Float32Array(outPadLen));
  const wsum = new Float32Array(outPadLen);

  const Ld = Math.floor(L / d);
  const minStart = 0;
  const maxStart = padLen - L - 2 * d - 1;

  /** Normalised cross-correlation search; returns the chosen frame start (padded coords). */
  const findBest = (target: number, loIn: number, hiIn: number, nominal: number): number => {
    const lo = clamp(loIn, minStart, maxStart);
    const hi = clamp(hiIn, minStart, maxStart);
    nominal = clamp(nominal, lo, hi);
    if (hi <= lo) return lo;
    const tgt = clamp(target, minStart, maxStart);
    const eT = px[tgt + L] - px[tgt];
    if (eT < 1e-10 * L) return nominal;
    const eps = eT * 1e-6 + 1e-20;

    let rLo = lo;
    let rHi = hi;
    if (d > 1 && hi - lo > 4 * d) {
      const tj = Math.round(tgt / d);
      const shift = tgt - tj * d;
      const jlo = Math.ceil((lo - shift) / d);
      const jhi = Math.floor((hi - shift) / d);
      let bestJ = clamp(Math.round((nominal - shift) / d), jlo, jhi);
      let bestScore = -Infinity;
      for (let j = jlo; j <= jhi; j++) {
        if (j < 0 || j + Ld >= nd) continue;
        let dot = 0;
        for (let i = 0; i < Ld; i++) dot += y[tj + i] * y[j + i];
        const e = py[j + Ld] - py[j];
        const score = dot / Math.sqrt(e + eps * invD);
        if (score > bestScore) {
          bestScore = score;
          bestJ = j;
        }
      }
      const center = bestJ * d + shift;
      rLo = Math.max(lo, center - d + 1);
      rHi = Math.min(hi, center + d - 1);
    }
    let best = clamp(nominal, rLo, rHi);
    let bestScore = -Infinity;
    for (let s = rLo; s <= rHi; s++) {
      let dot = 0;
      for (let i = 0; i < L; i++) dot += mono[tgt + i] * mono[s + i];
      const e = px[s + L] - px[s];
      const score = dot / Math.sqrt(e + eps);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    return best;
  };

  const K = Math.floor((stLen - 1) / Hs) + 1;
  const tolT = P.tolTransient;
  let prevStart = 0;
  let oi = 0; // next onset to anchor
  let attackEnd = -Infinity; // frames must not re-read the last anchored attack
  let lockUntil = -Infinity; // use exact continuation while target <= lockUntil
  for (let k = 0; k <= K; k++) {
    const c = k * Hs;
    const nominal = pad + Math.round(c / R) - Hs;
    let start = nominal;
    if (k === 0) {
      start = clamp(nominal, minStart, maxStart);
    } else {
      const target = prevStart + Hs;
      let anchored = false;
      while (oi < onsets.length) {
        const t = onsets[oi];
        // Offset inside this frame at which the attack must sit to land exactly at t*R.
        const p = Math.round((t - pad) * R) - (c - Hs);
        if (p < Hs) {
          oi++; // too late to anchor (only happens at the very start)
          continue;
        }
        if (p <= L - 1) {
          // Anchor frame: attack in the second half, next frame continues exactly,
          // so the attack is reproduced once, at full weight, on the time grid.
          start = findBest(target, Math.max(t - p - tolT, t - L + 1), Math.min(t - p + tolT, t - Hs), t - p);
          lockUntil = t + B;
          attackEnd = t + B;
          oi++;
          anchored = true;
        }
        break;
      }
      if (!anchored) {
        if (target <= lockUntil) {
          start = target;
        } else {
          let lo = Math.max(nominal - tol, attackEnd);
          let hi = Math.max(nominal + tol, lo);
          if (oi < onsets.length && onsets[oi] - L < hi) {
            // Frame before an anchor: keep the upcoming attack out (no pre-echo).
            hi = onsets[oi] - L;
            lo = Math.min(lo, Math.max(hi - 2 * tol, attackEnd));
            if (lo > hi) lo = hi;
          }
          start = findBest(target, lo, hi, nominal);
        }
      }
    }
    const ob = oOff + c - Hs;
    for (let ch = 0; ch < nCh; ch++) {
      const o = outP[ch];
      const x = xp[ch];
      for (let i = 0; i < L; i++) o[ob + i] += w[i] * x[start + i];
    }
    for (let i = 0; i < L; i++) wsum[ob + i] += w[i];
    prevStart = start;
    if ((k & 15) === 15) yield (progScale * k) / (K + 1);
  }

  const result: Float32Array[] = [];
  for (let ch = 0; ch < nCh; ch++) {
    const r = new Float32Array(stLen);
    const o = outP[ch];
    for (let i = 0; i < stLen; i++) {
      const ws = wsum[oOff + i];
      r[i] = ws > 1e-3 ? o[oOff + i] / ws : o[oOff + i];
    }
    result.push(r);
  }
  return result;
}

/**
 * Time-stretch (and optionally pitch-shift) a set of equal-length channels.
 * Output length is exactly Math.round(inputLength * ratio).
 * Throws StretchCancelledError if `shouldCancel()` returns true.
 */
export function stretchChannels(
  channels: Float32Array[],
  opts: StretchOptions,
  onProgress?: (fraction: number) => void,
  shouldCancel?: () => boolean,
): Float32Array[] {
  const gen = stretchGenerator(channels, opts);
  for (;;) {
    if (shouldCancel?.()) throw new StretchCancelledError();
    const r = gen.next();
    if (r.done) {
      onProgress?.(1);
      return r.value;
    }
    onProgress?.(r.value as number); // cast: hosts without strictNullChecks can't narrow IteratorResult
  }
}

/** Yield to the event loop (lets a worker receive 'cancel' messages). */
function yieldToEventLoop(): Promise<void> {
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        resolve();
      };
      ch.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Async variant used by the worker: identical output to `stretchChannels`, but
 * yields to the event loop every ~`sliceMs` of work so cancellation messages
 * can be processed.
 */
export async function stretchChannelsAsync(
  channels: Float32Array[],
  opts: StretchOptions,
  onProgress?: (fraction: number) => void,
  shouldCancel?: () => boolean,
  sliceMs = 20,
): Promise<Float32Array[]> {
  const gen = stretchGenerator(channels, opts);
  let sliceStart = Date.now();
  for (;;) {
    if (shouldCancel?.()) throw new StretchCancelledError();
    const r = gen.next();
    if (r.done) {
      onProgress?.(1);
      return r.value;
    }
    if (Date.now() - sliceStart >= sliceMs) {
      onProgress?.(r.value as number); // cast: hosts without strictNullChecks can't narrow IteratorResult
      await yieldToEventLoop();
      sliceStart = Date.now();
    }
  }
}
