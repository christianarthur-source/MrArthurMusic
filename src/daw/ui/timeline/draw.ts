import { pickLevel } from '../../dsp/peaks';
import { AssetManager } from '../../engine/assets';
import { audioPlayback } from '../../engine/scheduler';
import { automationTargetInfo } from '../../model/automation';
import { expandMidiNotes } from '../../model/ops';
import { contentSegments } from '../../model/regionMath';
import { gridTicks, secondsPerTick, ticksPerBar, ticksPerBeat } from '../../model/time';
import { AudioRegion, MidiRegion, PPQ, Project, Region, Track } from '../../model/types';
import { Row, ticksToPx } from './layout';

/**
 * Canvas rendering of the arrangement. Pure function of (project, view, assets);
 * it never touches the audio graph. Only visible rows/regions/pixels are drawn,
 * so cost scales with the viewport, not the project size.
 */

export interface View {
  width: number;
  height: number;
  scrollX: number;
  scrollY: number;
  pxPerBeat: number;
  selected: Set<string>;
  dropHint: { tick: number; trackId: string | null; valid: boolean; label: string } | null;
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
}

export const COLORS = {
  bg: '#0b1220',
  rowA: '#0f172a',
  rowB: '#111c33',
  lane: '#0c1528',
  bar: 'rgba(148,163,184,0.28)',
  beat: 'rgba(148,163,184,0.12)',
  sub: 'rgba(148,163,184,0.05)',
  loop: 'rgba(251,191,36,0.07)',
  loopEdge: 'rgba(251,191,36,0.55)',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  select: '#ffffff',
  accent: '#fbbf24',
};

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawTimeline(ctx: CanvasRenderingContext2D, p: Project, rows: Row[], v: View, assets: AssetManager) {
  const { width: W, height: H, scrollX, scrollY, pxPerBeat } = v;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  const x = (tick: number) => ticksToPx(tick, pxPerBeat) - scrollX;
  const tickAtX = (px: number) => ((px + scrollX) * PPQ) / pxPerBeat;
  const t0 = tickAtX(0);
  const t1 = tickAtX(W);
  const tracks = new Map(p.tracks.map((t) => [t.id, t]));

  // Row backgrounds
  rows.forEach((r, i) => {
    const y = r.y - scrollY;
    if (y > H || y + r.h < 0) return;
    ctx.fillStyle = r.kind === 'lane' ? COLORS.lane : i % 2 ? COLORS.rowB : COLORS.rowA;
    ctx.fillRect(0, y, W, r.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + r.h - 1, W, 1);
  });

  drawGrid(ctx, p, v, t0, t1, x, H);

  // Loop range
  if (p.loop.enabled) {
    const lx0 = x(p.loop.start);
    const lx1 = x(p.loop.end);
    ctx.fillStyle = COLORS.loop;
    ctx.fillRect(lx0, 0, lx1 - lx0, H);
    ctx.fillStyle = COLORS.loopEdge;
    ctx.fillRect(Math.round(lx0), 0, 1, H);
    ctx.fillRect(Math.round(lx1), 0, 1, H);
  }

  // Regions
  const rowByTrack = new Map(rows.filter((r) => r.kind === 'track').map((r) => [r.trackId, r]));
  for (const r of p.regions) {
    if (r.start > t1 || r.start + r.length < t0) continue;
    const row = rowByTrack.get(r.trackId);
    const track = tracks.get(r.trackId);
    if (!row || !track) continue;
    const y = row.y - scrollY;
    if (y > H || y + row.h < 0) continue;
    drawRegion(ctx, p, r, track, x, y + 2, row.h - 4, v, assets, W);
  }

  // Automation lanes
  for (const row of rows) {
    if (row.kind !== 'lane') continue;
    const y = row.y - scrollY;
    if (y > H || y + row.h < 0) continue;
    const track = tracks.get(row.trackId)!;
    drawLane(ctx, track, row.target!, x, y, row.h, W);
  }

  // Markers
  for (const m of p.markers) {
    const mx = x(m.tick);
    if (mx < -2 || mx > W) continue;
    ctx.fillStyle = 'rgba(251,191,36,0.35)';
    ctx.fillRect(Math.round(mx), 0, 1, H);
  }

  // Drop preview
  if (v.dropHint) {
    const dx = x(v.dropHint.tick);
    const row = v.dropHint.trackId ? rowByTrack.get(v.dropHint.trackId) : null;
    const y = row ? row.y - scrollY : rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h - scrollY : 0;
    const h = row ? row.h : 64;
    ctx.fillStyle = v.dropHint.valid ? 'rgba(251,191,36,0.18)' : 'rgba(244,63,94,0.18)';
    ctx.strokeStyle = v.dropHint.valid ? COLORS.accent : '#f43f5e';
    ctx.setLineDash([5, 4]);
    ctx.fillRect(dx, y + 2, 140, h - 4);
    ctx.strokeRect(dx + 0.5, y + 2.5, 140, h - 5);
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.text;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillText(v.dropHint.label, dx + 6, y + 18);
  }

  if (v.marquee) {
    const { x0, y0, x1, y1 } = v.marquee;
    ctx.fillStyle = 'rgba(56,189,248,0.12)';
    ctx.strokeStyle = 'rgba(56,189,248,0.8)';
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, p: Project, v: View, t0: number, t1: number, x: (t: number) => number, H: number) {
  const sig = p.timeSigMap[0].sig;
  const barT = ticksPerBar(sig);
  const beatT = ticksPerBeat(sig);
  const pxBeat = ticksToPx(beatT, v.pxPerBeat);
  const g = gridTicks(p.editor.grid);
  const pxGrid = ticksToPx(g, v.pxPerBeat);
  // Choose the finest level that is at least 6 px apart.
  const step = pxGrid >= 6 ? g : pxBeat >= 6 ? beatT : barT * Math.max(1, Math.ceil(6 / ticksToPx(barT, v.pxPerBeat)));
  for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
    const xx = Math.round(x(t));
    ctx.fillStyle = t % barT === 0 ? COLORS.bar : t % beatT === 0 ? COLORS.beat : COLORS.sub;
    ctx.fillRect(xx, 0, 1, H);
  }
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  p: Project,
  r: Region,
  track: Track,
  x: (t: number) => number,
  y: number,
  h: number,
  v: View,
  assets: AssetManager,
  W: number,
) {
  const color = r.color ?? track.color;
  const x0 = x(r.start);
  const x1 = x(r.start + r.length);
  const cx0 = Math.max(x0, -2);
  const cx1 = Math.min(x1, W + 2);
  const selected = v.selected.has(r.id);
  const muted = r.muted || track.mute;
  ctx.save();
  ctx.globalAlpha = muted ? 0.4 : 1;
  ctx.fillStyle = hexA(color, selected ? 0.42 : 0.28);
  roundRect(ctx, x0, y, x1 - x0, h, 5);
  ctx.fill();
  ctx.save();
  roundRect(ctx, x0, y, x1 - x0, h, 5);
  ctx.clip();
  // Header strip
  ctx.fillStyle = hexA(color, selected ? 0.95 : 0.75);
  ctx.fillRect(cx0, y, cx1 - cx0, 15);

  if (r.kind === 'audio') drawWaveform(ctx, p, r, assets, x, cx0, cx1, y + 16, h - 17, color);
  else drawNotes(ctx, r, x, y + 16, h - 17, color, cx0, cx1);

  // Loop iteration notches
  if (r.loop) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const seg of contentSegments(r, Math.max(r.start, ((cx0 + v.scrollX) * PPQ) / v.pxPerBeat), ((cx1 + v.scrollX) * PPQ) / v.pxPerBeat)) {
      if (seg.contentStart === 0 && seg.start !== r.start) {
        const nx = Math.round(x(seg.start));
        ctx.fillRect(nx, y + 15, 1, h - 15);
        ctx.beginPath();
        ctx.arc(nx, y + 15, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Fades
  if (r.kind === 'audio' && (r.fadeIn > 0 || r.fadeOut > 0)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (r.fadeIn > 0) {
      ctx.moveTo(x0, y + h);
      ctx.lineTo(x(r.start + r.fadeIn), y + 16);
    }
    if (r.fadeOut > 0) {
      ctx.moveTo(x(r.start + r.length - r.fadeOut), y + 16);
      ctx.lineTo(x1, y + h);
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Name + status
  ctx.fillStyle = '#0b1220';
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  const status = regionStatus(p, r, assets);
  const label = (r.kind === 'audio' && r.loop ? '⟳ ' : '') + r.name + (status ? `  ·  ${status}` : '');
  ctx.fillText(label, Math.max(x0, 0) + 6, y + 11, Math.max(0, cx1 - Math.max(x0, 0) - 10));
  ctx.restore();

  // Fade handles on selection
  if (selected && r.kind === 'audio') {
    ctx.fillStyle = '#fff';
    const fx0 = x(r.start + r.fadeIn);
    const fx1 = x(r.start + r.length - r.fadeOut);
    ctx.fillRect(fx0 - 3, y + 16, 6, 6);
    ctx.fillRect(fx1 - 3, y + 16, 6, 6);
  }
  ctx.strokeStyle = selected ? COLORS.select : hexA(color, 0.9);
  ctx.lineWidth = selected ? 2 : 1;
  roundRect(ctx, x0 + 0.5, y + 0.5, x1 - x0 - 1, h - 1, 5);
  ctx.stroke();
  ctx.lineWidth = 1;
  if (status?.startsWith('missing')) {
    ctx.fillStyle = 'rgba(244,63,94,0.25)';
    roundRect(ctx, x0, y, x1 - x0, h, 5);
    ctx.fill();
  }
  ctx.restore();
}

function regionStatus(p: Project, r: Region, assets: AssetManager): string | null {
  if (r.kind !== 'audio') return null;
  const asset = p.assets[r.assetId];
  if (!asset) return 'missing audio';
  const st = assets.status(asset.id);
  if (st === 'error') return assets.error(asset.id)?.missing ? 'missing audio' : 'load error';
  if (st === 'loading' || st === 'idle') return 'loading…';
  const { spec } = audioPlayback(p, r);
  if (spec) {
    const prog = assets.processingProgress(asset.id, spec);
    if (prog !== null) return `fitting to tempo ${Math.round(prog * 100)}%`;
  }
  return null;
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  p: Project,
  r: AudioRegion,
  assets: AssetManager,
  x: (t: number) => number,
  cx0: number,
  cx1: number,
  y: number,
  h: number,
  color: string,
) {
  const asset = p.assets[r.assetId];
  const levels = asset ? assets.getPeaks(asset.id) : undefined;
  const buf = asset ? assets.peek(asset.id) : undefined;
  if (!levels || !buf || h < 6) return;
  const { rate } = audioPlayback(p, r);
  const spt = secondsPerTick(p.tempoMap[0].bpm);
  const sr = buf.sampleRate;
  const mid = y + h / 2;
  const amp = (h / 2) * Math.pow(10, r.gainDb / 20) * 0.95;
  ctx.fillStyle = hexA(color, 0.95);
  const pxTicks = x(r.start + 1000) - x(r.start); // px per 1000 ticks
  const ticksPerPx = 1000 / pxTicks;
  const samplesPerPx = ticksPerPx * spt * rate * sr;
  const level = pickLevel(levels, samplesPerPx);
  const n = level.max.length;
  for (const seg of contentSegments(r)) {
    const sx0 = Math.max(cx0, x(seg.start));
    const sx1 = Math.min(cx1, x(seg.end));
    for (let px = Math.floor(sx0); px < sx1; px++) {
      const tick = seg.start + (px - x(seg.start)) * ticksPerPx;
      const content = seg.contentStart + (tick - seg.start);
      let s0 = (r.sourceOffsetSec + content * spt * rate) * sr;
      let s1 = s0 + samplesPerPx;
      if (r.reversed) {
        const len = buf.length;
        [s0, s1] = [len - s1, len - s0];
      }
      let i0 = Math.floor(s0 / level.samplesPerPeak);
      const i1 = Math.max(i0 + 1, Math.ceil(s1 / level.samplesPerPeak));
      if (i0 >= n || i1 <= 0) continue;
      i0 = Math.max(0, i0);
      let lo = 0;
      let hi = 0;
      for (let i = i0; i < Math.min(n, i1); i++) {
        if (level.max[i] > hi) hi = level.max[i];
        if (level.min[i] < lo) lo = level.min[i];
      }
      const top = mid - Math.min(1, hi) * amp;
      const bot = mid - Math.max(-1, lo) * amp;
      ctx.fillRect(px, top, 1, Math.max(1, bot - top));
    }
  }
}

function drawNotes(ctx: CanvasRenderingContext2D, r: MidiRegion, x: (t: number) => number, y: number, h: number, color: string, cx0: number, cx1: number) {
  const notes = expandMidiNotes(r);
  if (!notes.length || h < 6) return;
  let lo = 127;
  let hi = 0;
  for (const n of notes) {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
  }
  const range = Math.max(12, hi - lo + 1);
  const nh = Math.max(2, Math.min(6, h / range));
  ctx.fillStyle = hexA(color, 1);
  for (const n of notes) {
    const nx0 = x(r.start + n.start);
    const nx1 = x(r.start + n.start + n.length);
    if (nx1 < cx0 || nx0 > cx1) continue;
    const ny = y + h - 2 - ((n.pitch - lo + (range - (hi - lo + 1)) / 2) / range) * (h - 4) - nh;
    ctx.fillRect(nx0, ny, Math.max(2, nx1 - nx0 - 1), nh);
  }
}

function drawLane(ctx: CanvasRenderingContext2D, track: Track, target: string, x: (t: number) => number, y: number, h: number, W: number) {
  const info = automationTargetInfo(track, target);
  const lane = track.automation.find((l) => l.target === target);
  if (!info || !lane) return;
  const vy = (v: number) => y + 6 + (1 - (v - info.min) / (info.max - info.min)) * (h - 12);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '500 10px Inter, system-ui, sans-serif';
  ctx.fillText(lane.points.length ? info.label : `${info.label} — click to add points`, 8, y + 14);
  const pts = lane.points;
  ctx.strokeStyle = hexA(track.color, lane.enabled ? 1 : 0.4);
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (!pts.length) {
    ctx.setLineDash([4, 4]);
    ctx.moveTo(0, vy(info.default));
    ctx.lineTo(W, vy(info.default));
  } else {
    ctx.moveTo(0, vy(pts[0].value));
    pts.forEach((pt, i) => {
      const px = x(pt.tick);
      if (i > 0 && pts[i - 1].curve === 'step') ctx.lineTo(px, vy(pts[i - 1].value));
      ctx.lineTo(px, vy(pt.value));
    });
    ctx.lineTo(W, vy(pts[pts.length - 1].value));
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#fff';
  for (const pt of pts) {
    const px = x(pt.tick);
    if (px < -5 || px > W + 5) continue;
    ctx.beginPath();
    ctx.arc(px, vy(pt.value), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Value <-> y for automation lanes (shared with the pointer handler). */
export function laneValueToY(track: Track, target: string, v: number, y: number, h: number): number {
  const info = automationTargetInfo(track, target)!;
  return y + 6 + (1 - (v - info.min) / (info.max - info.min)) * (h - 12);
}

export function laneYToValue(track: Track, target: string, py: number, y: number, h: number): number {
  const info = automationTargetInfo(track, target)!;
  const f = 1 - (py - y - 6) / (h - 12);
  return Math.min(info.max, Math.max(info.min, info.min + f * (info.max - info.min)));
}
