import { automationTargetInfo } from '../../model/automation';
import { PPQ, Project } from '../../model/types';

export const HEADER_W = 236;
export const RULER_H = 32;
export const LANE_H = 56;

export interface Row {
  kind: 'track' | 'lane';
  trackId: string;
  target?: string; // automation target for lanes
  y: number; // content y
  h: number;
}

/** Vertical layout of visible tracks and their visible automation lanes. */
export function computeRows(p: Project): Row[] {
  const rows: Row[] = [];
  let y = 0;
  for (const t of p.tracks) {
    if (t.hidden) continue;
    rows.push({ kind: 'track', trackId: t.id, y, h: t.height });
    y += t.height;
    for (const lane of t.automation) {
      if (!lane.visible || !automationTargetInfo(t, lane.target)) continue;
      rows.push({ kind: 'lane', trackId: t.id, target: lane.target, y, h: LANE_H });
      y += LANE_H;
    }
  }
  return rows;
}

export function contentHeight(rows: Row[]): number {
  const last = rows[rows.length - 1];
  return last ? last.y + last.h : 0;
}

export function rowAt(rows: Row[], y: number): Row | null {
  for (const r of rows) if (y >= r.y && y < r.y + r.h) return r;
  return null;
}

export const ticksToPx = (ticks: number, pxPerBeat: number) => (ticks * pxPerBeat) / PPQ;
export const pxToTicks = (px: number, pxPerBeat: number) => (px * PPQ) / pxPerBeat;
