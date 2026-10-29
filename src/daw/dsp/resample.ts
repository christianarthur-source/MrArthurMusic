/**
 * Band-limited resampling with a Blackman-windowed sinc kernel.
 *
 * The kernel is tabulated at TABLE_PHASES fractional positions (nearest-phase
 * lookup, no per-sample trig), each row normalised to unity DC gain. When
 * downsampling (factor > 1) the cutoff is lowered to the output Nyquist so
 * that pitch-up shifting does not alias.
 */

const TABLE_PHASES = 1024;
/** Fraction of the (lower) Nyquist frequency used as the kernel cutoff. */
const CUTOFF_MARGIN = 0.95;

export interface ResampleOptions {
  /** Number of sinc zero crossings per side (quality / speed trade-off). Default 16. */
  zeroCrossings?: number;
  /** Exact output length. Default: Math.round(input.length / factor). */
  outLength?: number;
}

/** A prepared resampler for one input buffer; call `render` repeatedly to fill ranges (lets callers chunk work). */
export interface PreparedResampler {
  readonly outLength: number;
  /** Fill out[from..to) */
  render(out: Float32Array, from: number, to: number): void;
}

const tableCache = new Map<string, { table: Float32Array; half: number }>();

function buildTable(factor: number, zeroCrossings: number): { table: Float32Array; half: number } {
  const fc = Math.min(1, 1 / factor) * CUTOFF_MARGIN; // cutoff relative to input Nyquist
  const key = `${fc.toFixed(6)}:${zeroCrossings}`;
  const cached = tableCache.get(key);
  if (cached) return cached;
  const half = Math.ceil(zeroCrossings / fc); // half-width in input samples
  const taps = 2 * half;
  const table = new Float32Array((TABLE_PHASES + 1) * taps);
  for (let q = 0; q <= TABLE_PHASES; q++) {
    const frac = q / TABLE_PHASES;
    const row = q * taps;
    let sum = 0;
    for (let k = 0; k < taps; k++) {
      const m = k - half + 1; // tap offsets -half+1 .. half
      const x = m - frac;
      const ax = Math.abs(x);
      let v = 0;
      if (ax < half) {
        const px = Math.PI * fc * x;
        const sinc = ax < 1e-9 ? 1 : Math.sin(px) / px;
        const wpos = (Math.PI * x) / half;
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

/**
 * Prepare a resampler. `factor` = input rate / output rate: output sample j is
 * read at input position j * factor (so factor 2 halves the length and raises
 * pitch an octave when played at the original rate).
 */
export function prepareResampler(input: Float32Array, factor: number, options: ResampleOptions = {}): PreparedResampler {
  if (!(factor > 0) || !Number.isFinite(factor)) throw new Error(`resample: factor must be a positive finite number (got ${factor})`);
  const zc = Math.max(2, Math.floor(options.zeroCrossings ?? 16));
  const outLength = Math.max(0, Math.floor(options.outLength ?? Math.round(input.length / factor)));
  const { table, half } = buildTable(factor, zc);
  const taps = 2 * half;
  // Zero-padded copy so the inner loop needs no bounds checks; non-finite samples become 0.
  const pad = 2 * half + 2;
  const n = input.length;
  const xp = new Float32Array(n + 2 * pad);
  for (let i = 0; i < n; i++) {
    const v = input[i];
    xp[pad + i] = v - v === 0 ? v : 0;
  }
  const maxPos = n + half; // positions beyond this only read zeros

  return {
    outLength,
    render(out: Float32Array, from: number, to: number) {
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
    },
  };
}

/**
 * Resample one channel. factor = input rate / output rate.
 * Output length is Math.round(input.length / factor) unless `options.outLength` is given.
 */
export function resampleChannel(input: Float32Array, factor: number, options: ResampleOptions = {}): Float32Array {
  if (factor === 1) {
    // Exact identity (the band-limiting kernel would otherwise ring at hard edges).
    const len = Math.max(0, Math.floor(options.outLength ?? input.length));
    const out = new Float32Array(len);
    out.set(input.subarray(0, Math.min(len, input.length)));
    return out;
  }
  const r = prepareResampler(input, factor, options);
  const out = new Float32Array(r.outLength);
  r.render(out, 0, r.outLength);
  return out;
}
