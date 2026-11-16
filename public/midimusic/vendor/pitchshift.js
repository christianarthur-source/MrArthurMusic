var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/daw/dsp/resample.ts
var TABLE_PHASES = 1024;
var CUTOFF_MARGIN = 0.95;
var tableCache = /* @__PURE__ */ new Map();
function buildTable(factor, zeroCrossings) {
  const fc = Math.min(1, 1 / factor) * CUTOFF_MARGIN;
  const key = `${fc.toFixed(6)}:${zeroCrossings}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const half = Math.ceil(zeroCrossings / fc);
  const taps = 2 * half;
  const table = new Float32Array((TABLE_PHASES + 1) * taps);
  for (let q = 0; q <= TABLE_PHASES; q++) {
    const frac = q / TABLE_PHASES;
    const row = q * taps;
    let sum = 0;
    for (let k = 0; k < taps; k++) {
      const m = k - half + 1;
      const x = m - frac;
      const ax = Math.abs(x);
      let v = 0;
      if (ax < half) {
        const px = Math.PI * fc * x;
        const sinc = ax < 1e-9 ? 1 : Math.sin(px) / px;
        const wpos = Math.PI * x / half;
        const win = 0.42 + 0.5 * Math.cos(wpos) + 0.08 * Math.cos(2 * wpos);
        v = fc * sinc * win;
      }
      table[row + k] = v;
      sum += v;
    }
    if (sum !== 0) for (let k = 0; k < taps; k++) table[row + k] /= sum;
  }
  const entry = { table, half };
  if (tableCache.size > 32) tableCache.clear();
  tableCache.set(key, entry);
  return entry;
}
function prepareResampler(input, factor, options = {}) {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error(`resample: factor must be a positive finite number (got ${factor})`);
  const zc = Math.max(2, Math.floor(options.zeroCrossings ?? 16));
  const outLength = Math.max(0, Math.floor(options.outLength ?? Math.round(input.length / factor)));
  const { table, half } = buildTable(factor, zc);
  const taps = 2 * half;
  const pad = 2 * half + 2;
  const n = input.length;
  const xp = new Float32Array(n + 2 * pad);
  for (let i = 0; i < n; i++) {
    const v = input[i];
    xp[pad + i] = v - v === 0 ? v : 0;
  }
  const maxPos = n + half;
  return {
    outLength,
    render(out, from, to) {
      const end = Math.min(to, outLength);
      for (let j = Math.max(0, from); j < end; j++) {
        const t = j * factor;
        let base = Math.floor(t);
        let q = Math.round((t - base) * TABLE_PHASES);
        if (q === TABLE_PHASES) {
          q = 0;
          base += 1;
        }
        if (base > maxPos) {
          out[j] = 0;
          continue;
        }
        const row = q * taps;
        const s0 = pad + base - half + 1;
        let acc = 0;
        for (let k = 0; k < taps; k++) acc += xp[s0 + k] * table[row + k];
        out[j] = acc;
      }
    }
  };
}

// src/daw/dsp/wsola.ts
var StretchCancelledError = class extends Error {
  constructor(message = "Time-stretch job was cancelled") {
    super(message);
    __publicField(this, "cancelled", true);
    this.name = "StretchCancelledError";
  }
};
var MIN_RATIO = 0.25;
var MAX_RATIO = 4;
var MAX_SEMITONES = 12;
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function normalizeStretchOptions(opts) {
  const ratio = Number.isFinite(opts.ratio) ? clamp(opts.ratio, MIN_RATIO, MAX_RATIO) : 1;
  const semitones = Number.isFinite(opts.semitones) ? clamp(opts.semitones, -MAX_SEMITONES, MAX_SEMITONES) : 0;
  const sampleRate = Number.isFinite(opts.sampleRate) && opts.sampleRate > 0 ? opts.sampleRate : 44100;
  const quality = opts.quality === "high" ? "high" : "fast";
  return { ratio, semitones, quality, sampleRate };
}
function getParams(quality, sr) {
  const ms = (x) => Math.round(sr * x / 1e3);
  if (quality === "high") {
    return { frame: 2 * ms(15), tol: ms(16), tolTransient: ms(2), decim: 2, zeroCrossings: 16, onsetBlock: ms(5) };
  }
  return { frame: 2 * ms(11.6), tol: ms(11), tolTransient: ms(2), decim: 4, zeroCrossings: 8, onsetBlock: ms(5) };
}
function* stretchGenerator(channels, options) {
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
  const result = [];
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
      yield wsolaShare + (1 - wsolaShare) * done / totalWork;
    }
    stretched[c] = new Float32Array(0);
    result.push(out);
  }
  return result;
}
function detectTransients(mono, blockSize, gain = 1) {
  const B = Math.max(16, Math.floor(blockSize / 2) * 2);
  const hop = B >> 1;
  const len = mono.length;
  const nh = Math.ceil(len / hop);
  const diff = new Float32Array(len);
  for (let i = 1; i < len; i++) diff[i] = mono[i] - mono[i - 1];
  const halfE = new Float64Array(nh + 1);
  for (let h = 0; h < nh; h++) {
    let e = 0;
    const end = Math.min(len, (h + 1) * hop);
    for (let i = h * hop; i < end; i++) e += diff[i] * diff[i];
    halfE[h] = e;
  }
  const winE = (h) => h < 0 ? 0 : halfE[h] + halfE[h + 1];
  const onsets = [];
  const absFloor = B * 1e-7 * gain * gain;
  let prevFlag = false;
  for (let h = 0; h < nh; h++) {
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
function* wsolaCore(channels, n, R, stLen, P, progScale) {
  const nCh = channels.length;
  const L = P.frame;
  const Hs = L >> 1;
  const tol = P.tol;
  const d = P.decim;
  const pad = L + tol + 4 * d + 16;
  const padLen = n + 2 * pad;
  const xp = [];
  const mono = new Float32Array(padLen);
  for (let c = 0; c < nCh; c++) {
    const a = new Float32Array(padLen);
    const src = channels[c];
    const m = Math.min(src.length, n);
    for (let i = 0; i < m; i++) {
      const v = src[i];
      const s = v - v === 0 ? v : 0;
      a[pad + i] = s;
      mono[pad + i] += s;
    }
    xp.push(a);
  }
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
  const w = new Float32Array(L);
  for (let i = 0; i < L; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L);
  const oOff = L;
  const outPadLen = stLen + 3 * L + 2;
  const outP = [];
  for (let c = 0; c < nCh; c++) outP.push(new Float32Array(outPadLen));
  const wsum = new Float32Array(outPadLen);
  const Ld = Math.floor(L / d);
  const minStart = 0;
  const maxStart = padLen - L - 2 * d - 1;
  const findBest = (target, loIn, hiIn, nominal) => {
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
      let bestScore2 = -Infinity;
      for (let j = jlo; j <= jhi; j++) {
        if (j < 0 || j + Ld >= nd) continue;
        let dot = 0;
        for (let i = 0; i < Ld; i++) dot += y[tj + i] * y[j + i];
        const e = py[j + Ld] - py[j];
        const score = dot / Math.sqrt(e + eps * invD);
        if (score > bestScore2) {
          bestScore2 = score;
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
  let oi = 0;
  let attackEnd = -Infinity;
  let lockUntil = -Infinity;
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
        const p = Math.round((t - pad) * R) - (c - Hs);
        if (p < Hs) {
          oi++;
          continue;
        }
        if (p <= L - 1) {
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
    if ((k & 15) === 15) yield progScale * k / (K + 1);
  }
  const result = [];
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
function stretchChannels(channels, opts, onProgress, shouldCancel) {
  const gen = stretchGenerator(channels, opts);
  for (; ; ) {
    if (shouldCancel?.()) throw new StretchCancelledError();
    const r = gen.next();
    if (r.done) {
      onProgress?.(1);
      return r.value;
    }
    onProgress?.(r.value);
  }
}
export {
  stretchChannels
};
