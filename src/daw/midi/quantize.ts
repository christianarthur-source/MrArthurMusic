/** Grid quantization for note-like objects (positions in ticks). */

export interface QuantizableNote {
  start: number;
  length: number;
}

export interface QuantizeOptions {
  /** 0..1, how far to move toward the grid. Default 1. */
  strength?: number;
  /** Also quantize note ends (and thus lengths). Default false. */
  quantizeLength?: boolean;
  /** 0..1; every 2nd (odd-indexed) grid step is delayed by swing * grid / 2. Default 0. */
  swing?: number;
}

const clamp01 = (v: number | undefined, dflt: number): number =>
  v === undefined || !Number.isFinite(v) ? dflt : Math.max(0, Math.min(1, v));

/** Nearest (swung) grid position to `t`. */
function snap(t: number, grid: number, swingOffset: number): number {
  // Consider candidate grid indices around t; with swing the odd lines move right.
  const base = Math.floor(t / grid);
  let best = 0;
  let bestDist = Infinity;
  for (let k = base - 1; k <= base + 2; k++) {
    const pos = k * grid + (k % 2 !== 0 ? swingOffset : 0);
    const d = Math.abs(pos - t);
    if (d < bestDist) {
      bestDist = d;
      best = pos;
    }
  }
  return best;
}

export function quantizeNotes<T extends QuantizableNote>(
  notes: T[],
  gridTicks: number,
  opts: QuantizeOptions = {},
): T[] {
  const strength = clamp01(opts.strength, 1);
  const swing = clamp01(opts.swing, 0);
  const grid = gridTicks;
  if (!(grid > 0) || !Number.isFinite(grid)) {
    return notes.map((n) => ({ ...n, start: Math.max(0, n.start), length: Math.max(1, n.length) }));
  }
  const swingOffset = (swing * grid) / 2;

  return notes.map((n) => {
    const target = snap(n.start, grid, swingOffset);
    const start = Math.max(0, Math.round(n.start + (target - n.start) * strength));
    let length: number;
    if (opts.quantizeLength) {
      const end = n.start + n.length;
      let endTarget = snap(end, grid, swingOffset);
      if (endTarget <= target) endTarget = target + grid; // never collapse to zero length
      const newEnd = Math.round(end + (endTarget - end) * strength);
      length = newEnd - start;
    } else {
      length = Math.round(n.length);
    }
    return { ...n, start, length: Math.max(1, length) };
  });
}
