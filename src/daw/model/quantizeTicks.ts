/** Quantize a single note start (and keep its end aligned when it was on-grid). */
export function quantizeTicks(start: number, length: number, grid: number, strength = 1): { start: number; length: number } {
  if (grid <= 0) return { start, length };
  const target = Math.round(start / grid) * grid;
  const ns = Math.max(0, Math.round(start + (target - start) * strength));
  return { start: ns, length: Math.max(1, length) };
}
