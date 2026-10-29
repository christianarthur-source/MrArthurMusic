/**
 * Multi-resolution waveform peaks (mono: min/max over all channels).
 * Level 0 has `baseSamplesPerPeak` samples per peak; each further level halves
 * the resolution (doubles samplesPerPeak).
 */

export interface PeakLevel {
  samplesPerPeak: number;
  min: Float32Array;
  max: Float32Array;
}

export function computePeakLevels(channels: Float32Array[], baseSamplesPerPeak = 256, levels = 6): PeakLevel[] {
  const spp = Math.max(1, Math.floor(baseSamplesPerPeak));
  const nLevels = Math.max(1, Math.floor(levels));
  let n = 0;
  for (const c of channels) n = Math.max(n, c.length);
  const count = Math.ceil(n / spp);
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  for (let p = 0; p < count; p++) {
    const s = p * spp;
    let lo = Infinity;
    let hi = -Infinity;
    for (const ch of channels) {
      const e = Math.min(ch.length, s + spp);
      for (let i = s; i < e; i++) {
        const x = ch[i];
        if (x < lo) lo = x;
        if (x > hi) hi = x;
      }
    }
    // Empty / NaN-only buckets map to 0.
    min[p] = lo === Infinity || lo !== lo ? 0 : lo;
    max[p] = hi === -Infinity || hi !== hi ? 0 : hi;
  }
  const out: PeakLevel[] = [{ samplesPerPeak: spp, min, max }];
  for (let l = 1; l < nLevels; l++) {
    const prev = out[l - 1];
    const pc = prev.min.length;
    const c = Math.ceil(pc / 2);
    const mn = new Float32Array(c);
    const mx = new Float32Array(c);
    for (let i = 0; i < c; i++) {
      const a = 2 * i;
      const b = a + 1;
      if (b < pc) {
        mn[i] = Math.min(prev.min[a], prev.min[b]);
        mx[i] = Math.max(prev.max[a], prev.max[b]);
      } else {
        mn[i] = prev.min[a];
        mx[i] = prev.max[a];
      }
    }
    out.push({ samplesPerPeak: prev.samplesPerPeak * 2, min: mn, max: mx });
  }
  return out;
}

/**
 * Pick the level to draw at `samplesPerPixel`: the coarsest level that still
 * has at least one peak per pixel (largest samplesPerPeak <= samplesPerPixel).
 * When zoomed in beyond level 0 it returns the finest level; when zoomed out
 * beyond the coarsest it returns the coarsest.
 */
export function pickLevel(levels: PeakLevel[], samplesPerPixel: number): PeakLevel {
  if (levels.length === 0) throw new Error('pickLevel: no levels');
  let best = levels[0];
  for (const l of levels) {
    if (l.samplesPerPeak <= samplesPerPixel && l.samplesPerPeak >= best.samplesPerPeak) best = l;
  }
  return best;
}
