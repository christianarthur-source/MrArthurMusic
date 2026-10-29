import { Region } from './types';

/**
 * A stretch of timeline during which a region plays contiguous content.
 * Looping regions produce one segment per loop iteration.
 */
export interface ContentSegment {
  start: number; // timeline tick (inclusive)
  end: number; // timeline tick (exclusive)
  contentStart: number; // content tick at `start`
}

/** Segments of `region` overlapping [from, to). Segments are clipped to the window. */
export function contentSegments(region: Region, from = -Infinity, to = Infinity): ContentSegment[] {
  const out: ContentSegment[] = [];
  const rStart = region.start;
  const rEnd = region.start + region.length;
  const lo = Math.max(from, rStart);
  const hi = Math.min(to, rEnd);
  if (hi <= lo) return out;
  const L = region.loopLength;
  if (!region.loop || L <= 0) {
    // Content exists for content ticks [0, L) only (L = full content when not looping)
    const segStart = rStart;
    const segEnd = Math.min(rEnd, rStart + Math.max(0, L - region.contentOffset));
    const s = Math.max(lo, segStart);
    const e = Math.min(hi, segEnd);
    if (e > s) out.push({ start: s, end: e, contentStart: region.contentOffset + (s - rStart) });
    return out;
  }
  // Looping: iteration k covers timeline [iterStart_k, iterStart_k + L)
  const phase0 = ((region.contentOffset % L) + L) % L;
  const firstIterStart = rStart - phase0; // timeline tick where content tick 0 of iteration 0 sits
  let k = Math.floor((lo - firstIterStart) / L);
  for (;;) {
    const iterStart = firstIterStart + k * L;
    if (iterStart >= hi) break;
    const s = Math.max(lo, iterStart);
    const e = Math.min(hi, iterStart + L);
    if (e > s) out.push({ start: s, end: e, contentStart: s - iterStart });
    k++;
    if (out.length > 100000) break; // safety
  }
  return out;
}

/** Content tick at timeline tick t, or null if the region is silent there. */
export function contentTickAt(region: Region, t: number): number | null {
  const seg = contentSegments(region, t, t + 1)[0];
  return seg ? seg.contentStart : null;
}

export function regionEnd(r: Region): number {
  return r.start + r.length;
}
