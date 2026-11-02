// Follow-along during playback: maps the playing time to a point on the engraved page, so a thin cursor
// can glide through the music (or the playing measure can be tinted). Positions come from the notes that
// actually sound: between two onsets on the same line the cursor moves at an even speed; at the end of a
// line (or a repeat jump) it runs to the barline and then jumps to the next note.
import type { Cue } from '../audio/player';

export interface FollowPoint {
  t: number; // ms in the playing order
  x: number;
  top: number;
  bottom: number;
  sys: Element; // the system (line of music)
  endX: number; // right barline of the measure this onset is in
  mLeft: number;
}

export interface FollowPos {
  x: number;
  top: number;
  bottom: number;
  mLeft: number;
  mRight: number;
}

type Box = { left: number; right: number; top: number; bottom: number };

/** Builds the timeline from the playback cues and the drawn pages (coordinates relative to `pagesEl`). */
export function buildFollow(pagesEl: HTMLElement, cues: Cue[]): FollowPoint[] {
  const base = pagesEl.getBoundingClientRect();
  const rel = (r: DOMRect): Box => ({ left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top });
  const byId = new Map<string, Element>();
  pagesEl.querySelectorAll('g[id]').forEach((g) => byId.set(g.id, g));

  // a system's vertical extent is its staff lines (not lyrics or dynamics)
  const sysBox = new Map<Element, { top: number; bottom: number }>();
  const systemBox = (sys: Element) => {
    let b = sysBox.get(sys);
    if (!b) {
      let top = Infinity;
      let bottom = -Infinity;
      const m = sys.querySelector('g.measure');
      m?.querySelectorAll(':scope > g.staff > path').forEach((p) => {
        const r = rel(p.getBoundingClientRect());
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      });
      if (!isFinite(top)) {
        const r = rel(sys.getBoundingClientRect());
        top = r.top;
        bottom = r.bottom;
      }
      b = { top, bottom };
      sysBox.set(sys, b);
    }
    return b;
  };
  // a measure's horizontal extent is its own staff-line segment (barline to barline)
  const mBox = new Map<Element, { left: number; right: number }>();
  const measureBox = (m: Element) => {
    let b = mBox.get(m);
    if (!b) {
      const line = m.querySelector(':scope > g.staff > path');
      const r = rel((line || m).getBoundingClientRect());
      b = { left: r.left, right: r.right };
      mBox.set(m, b);
    }
    return b;
  };

  const out: FollowPoint[] = [];
  let measure: Element | null = null;
  for (const c of cues) {
    if (c.measureOn) measure = byId.get(c.measureOn) || measure;
    let x = Infinity;
    let el: Element | null = null;
    for (const id of c.on) {
      const g = byId.get(id);
      if (!g) continue;
      const kind = g.getAttribute('class') || '';
      let gx: number;
      if (/\b(mRest|multiRest|mSpace)\b/.test(kind)) {
        const m = g.closest('g.measure');
        const mb = m ? measureBox(m) : null;
        gx = mb ? mb.left + (mb.right - mb.left) * 0.08 : rel(g.getBoundingClientRect()).left;
      } else {
        const head = g.querySelector('g.notehead') || g;
        const r = rel(head.getBoundingClientRect());
        if (r.right - r.left <= 0) continue;
        gx = (r.left + r.right) / 2;
      }
      if (gx < x) {
        x = gx;
        el = g;
      }
    }
    if (!el) continue;
    const sys = el.closest('g.system');
    const m = el.closest('g.measure') || measure;
    if (!sys || !m) continue;
    const sb = systemBox(sys);
    const mb = measureBox(m);
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.t - c.time) < 1) continue; // same moment (another staff)
    out.push({ t: c.time, x, top: sb.top, bottom: sb.bottom, sys, endX: mb.right, mLeft: mb.left });
  }
  return out;
}

/** Where the music is at `t` ms. `end` is the end of the piece. */
export function followAt(points: FollowPoint[], t: number, end: number): FollowPos | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  if (t <= points[0].t) lo = 0;
  else {
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (points[mid].t <= t) lo = mid;
      else hi = mid - 1;
    }
  }
  const a = points[lo];
  const b = points[lo + 1];
  const span = (b ? b.t : end) - a.t;
  const f = span > 0 ? Math.max(0, Math.min(1, (t - a.t) / span)) : 0;
  // keep gliding to the next note on the same line; otherwise run to this measure's barline
  const target = b && b.sys === a.sys && b.x >= a.x - 1 ? b.x : a.endX - 3;
  const x = a.x + (target - a.x) * f;
  // the tinted measure: the one the cursor is in
  let mLeft = a.mLeft;
  let mRight = a.endX;
  if (b && b.sys === a.sys && x >= b.mLeft && b.mLeft > a.mLeft) {
    mLeft = b.mLeft;
    mRight = b.endX;
  }
  return { x, top: a.top, bottom: a.bottom, mLeft, mRight };
}
