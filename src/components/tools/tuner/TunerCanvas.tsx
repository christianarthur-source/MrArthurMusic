import React, { useEffect, useRef } from 'react';
import type { StableOutput } from '../../../audio/tuner/stabilize.ts';
import { midiToHz, noteLabel, noteName, noteOctave, writtenMidi, type TranspositionKey } from '../../../audio/tuner/noteMath.ts';

export interface TunerView {
  active: boolean;
  held: boolean;
  refMidi: number;
  noteMidi: number;
  cents: number;
  hz: number;
  targetHz: number;
}

export interface TunerCanvasConfig {
  a4: number;
  tolerance: number;
  /** Explicit target string (MIDI) or null. */
  targetMidi: number | null;
  /** MIDI notes of the preset strings, used for auto string detection. */
  strings: number[];
  transposition: TranspositionKey;
  useFlats: boolean;
  showHistory: boolean;
  showStrobe: boolean;
  listening: boolean;
}

interface Props {
  stableRef: React.MutableRefObject<StableOutput | null>;
  config: TunerCanvasConfig;
  /** Written every frame so the page can derive low-rate UI state from it. */
  viewRef: React.MutableRefObject<TunerView | null>;
  /** 0..1 progress of the hold-in-tune ring (written by the page). */
  holdRef: React.MutableRefObject<number>;
}

const COLORS = {
  inTune: '#34d399',
  off: '#fbbf24',
  idle: '#475569',
  text: '#e2e8f0',
  sub: '#94a3b8',
  tick: '#64748b',
  accent: '#2dd4bf',
};

const HISTORY_MS = 8000;

export function deriveView(o: StableOutput | null, cfg: Pick<TunerCanvasConfig, 'a4' | 'targetMidi' | 'strings'>): TunerView | null {
  if (!o || !o.active) return null;
  let ref = o.noteMidi;
  if (cfg.targetMidi !== null) ref = cfg.targetMidi;
  else if (cfg.strings.length > 0) {
    let bestD = Infinity;
    for (const s of cfg.strings) {
      const d = Math.abs(s - o.midi);
      if (d < bestD) { bestD = d; ref = s; }
    }
    // Far from every string (more than ~2 semitones): show the plain chromatic note instead.
    if (bestD > 2.5) ref = o.noteMidi;
  }
  return {
    active: true,
    held: o.held,
    refMidi: ref,
    noteMidi: o.noteMidi,
    cents: (o.midi - ref) * 100,
    hz: o.hz,
    targetHz: midiToHz(ref, cfg.a4),
  };
}

export function canvasHeight(showHistory: boolean, showStrobe: boolean, width: number): number {
  const note = width < 420 ? 150 : 180;
  return note + 56 + 78 + 76 + (showStrobe ? 44 : 0) + (showHistory ? 112 : 0);
}

export const TunerCanvas: React.FC<Props> = ({ stableRef, config, viewRef, holdRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let cssW = 0;
    let cssH = 0;
    let dpr = 1;
    const resize = () => {
      const c = cfgRef.current;
      const rect = canvas.getBoundingClientRect();
      cssW = Math.max(240, Math.round(rect.width));
      cssH = canvasHeight(c.showHistory, c.showStrobe, cssW);
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let pos = 0; // spring-smoothed cents shown by the marker
    let vel = 0;
    let strobe = 0;
    let lastT = performance.now();
    let lastShowKey = '';
    const hist: { t: number; c: number | null }[] = [];
    let lastHist = 0;
    let raf = 0;

    const frame = (nowMs: number) => {
      raf = requestAnimationFrame(frame);
      const cfg = cfgRef.current;
      const key = `${cfg.showHistory}-${cfg.showStrobe}`;
      if (key !== lastShowKey) { lastShowKey = key; resize(); }
      const dt = Math.min(0.05, (nowMs - lastT) / 1000);
      lastT = nowMs;

      const view = deriveView(stableRef.current, cfg);
      viewRef.current = view;

      // Critically damped spring toward the measured cents (clamped to the ruler).
      const target = view ? Math.max(-55, Math.min(55, view.cents)) : 0;
      const w = 22;
      const acc = w * w * (target - pos) - 2 * w * vel;
      vel += acc * dt;
      pos += vel * dt;
      if (!view) { pos = 0; vel = 0; }
      strobe += (view ? view.cents : 0) * dt * 0.35;

      if (nowMs - lastHist > 30) {
        lastHist = nowMs;
        hist.push({ t: nowMs, c: view && !view.held ? view.cents : null });
        while (hist.length && nowMs - hist[0].t > HISTORY_MS) hist.shift();
      }

      draw(ctx, cssW, cssH, dpr, cfg, view, pos, strobe, hist, nowMs, holdRef.current, reduced);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      viewRef.current = null;
    };
  }, [stableRef, viewRef, holdRef]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Tuner display: note, cents ruler and pitch history"
      data-testid="tuner-canvas"
      className="block w-full"
      style={{ height: canvasHeight(config.showHistory, config.showStrobe, 360) }}
    />
  );
};

function colorFor(view: TunerView | null, tol: number): string {
  if (!view) return COLORS.idle;
  return Math.abs(view.cents) <= tol ? COLORS.inTune : COLORS.off;
}

function ruler(
  g: CanvasRenderingContext2D, x0: number, x1: number, y: number, h: number, range: number,
  tickEvery: number, labelEvery: number, tol: number, pos: number | null, color: string, labelFont: string,
) {
  const px = (c: number) => x0 + ((c + range) / (2 * range)) * (x1 - x0);
  // in-tune zone
  g.fillStyle = 'rgba(52,211,153,0.16)';
  const zl = px(-Math.min(tol, range));
  const zr = px(Math.min(tol, range));
  g.fillRect(zl, y, zr - zl, h);
  g.strokeStyle = COLORS.tick;
  g.fillStyle = COLORS.sub;
  g.textAlign = 'center';
  g.textBaseline = 'top';
  g.font = labelFont;
  for (let c = -range; c <= range + 1e-9; c += tickEvery) {
    const major = Math.abs(c % labelEvery) < 1e-9;
    const x = px(c);
    g.lineWidth = c === 0 ? 2 : 1;
    g.strokeStyle = c === 0 ? COLORS.inTune : COLORS.tick;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y + (c === 0 ? h : major ? h * 0.62 : h * 0.4));
    g.stroke();
    if (major) g.fillText(c > 0 ? `+${c}` : `${c}`, x, y + h + 4);
  }
  if (pos !== null) {
    const x = px(Math.max(-range, Math.min(range, pos)));
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, y - 2);
    g.lineTo(x, y + h);
    g.stroke();
    g.beginPath();
    g.moveTo(x - 8, y - 12);
    g.lineTo(x + 8, y - 12);
    g.lineTo(x, y - 1);
    g.closePath();
    g.fill();
  }
}

function draw(
  g: CanvasRenderingContext2D, W: number, H: number, dpr: number, cfg: TunerCanvasConfig, view: TunerView | null,
  pos: number, strobe: number, hist: { t: number; c: number | null }[], nowMs: number, hold: number, reduced: boolean,
) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const col = colorFor(view, cfg.tolerance);
  const alpha = view?.held ? 0.4 : 1;
  const pad = 16;
  const noteH = W < 420 ? 150 : 180;

  // --- Note
  const cx = W / 2;
  const cy = noteH / 2 + 4;
  const size = Math.min(noteH * 0.62, W * 0.32);
  g.globalAlpha = alpha;
  if (view) {
    const written = writtenMidi(view.refMidi, cfg.transposition);
    const name = noteName(written, cfg.useFlats);
    g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = col;
    const oct = `${noteOctave(written)}`;
    const nameW = g.measureText(name).width;
    g.font = `600 ${size * 0.34}px Fredoka, system-ui, sans-serif`;
    const octW = g.measureText(oct).width;
    const total = nameW + octW + 4;
    g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'left';
    g.fillText(name, cx - total / 2, cy);
    g.font = `600 ${size * 0.34}px Fredoka, system-ui, sans-serif`;
    g.fillStyle = COLORS.sub;
    g.fillText(oct, cx - total / 2 + nameW + 4, cy + size * 0.22);
    if (cfg.transposition !== 'C') {
      g.font = `600 13px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.fillText(`concert ${noteLabel(view.refMidi, cfg.useFlats)}`, cx, noteH - 6);
    }
  } else {
    g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = COLORS.idle;
    g.fillText('--', cx, cy);
  }
  g.globalAlpha = 1;

  // --- Hold ring around the note
  const rr = Math.min(noteH / 2 - 6, size * 0.95);
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(148,163,184,0.18)';
  g.beginPath();
  g.arc(cx, cy, rr, 0, Math.PI * 2);
  g.stroke();
  if (hold > 0) {
    g.strokeStyle = COLORS.inTune;
    g.beginPath();
    g.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, hold));
    g.stroke();
  }

  // --- Readouts
  let y = noteH + 4;
  g.globalAlpha = alpha;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  g.fillStyle = COLORS.text;
  g.font = `600 ${W < 420 ? 15 : 17}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const hzText = view ? `${view.hz.toFixed(1)} Hz` : '-- Hz';
  const tgtText = view ? `target ${view.targetHz.toFixed(1)} Hz` : '';
  const both = tgtText ? `${hzText}  ·  ${tgtText}` : hzText;
  g.fillText(g.measureText(both).width <= W - 16 ? both : hzText, cx, y + 18);
  g.fillStyle = col;
  g.font = `700 ${W < 420 ? 26 : 30}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const cents = view ? view.cents : 0;
  const cr = Math.round(cents * 10) / 10;
  const centsText = view ? `${cr < 0 ? '−' : '+'}${Math.abs(cr).toFixed(1)}¢` : '--.-¢';
  g.fillText(centsText, cx, y + 52);
  g.globalAlpha = 1;
  y += 70;

  // --- Main ruler
  g.font = '12px system-ui, sans-serif';
  g.fillStyle = COLORS.sub;
  g.textBaseline = 'top';
  g.textAlign = 'left';
  g.fillText('low ♭', pad, y - 2);
  g.textAlign = 'right';
  g.fillText('high ♯', W - pad, y - 2);
  const mainY = y + 18;
  g.globalAlpha = 1;
  ruler(g, pad + 8, W - pad - 8, mainY, 22, 50, 5, W < 340 ? 25 : 10, cfg.tolerance, view ? pos : null, col, '11px system-ui, sans-serif');
  y = mainY + 22 + 34;

  // --- Fine lane
  g.fillStyle = COLORS.sub;
  g.font = '11px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('fine ±10¢', pad, y - 2);
  const fineY = y + 16;
  ruler(g, pad + 8, W - pad - 8, fineY, 14, 10, 1, 5, cfg.tolerance, view ? Math.max(-10, Math.min(10, pos)) : null, col, '10px system-ui, sans-serif');
  y = fineY + 14 + 18;

  // --- Strobe
  if (cfg.showStrobe) {
    const sy = y + 4;
    const sh = 28;
    g.fillStyle = 'rgba(15,23,42,0.9)';
    g.fillRect(pad, sy, W - 2 * pad, sh);
    g.save();
    g.beginPath();
    g.rect(pad, sy, W - 2 * pad, sh);
    g.clip();
    const stripe = 22;
    const off = reduced ? 0 : ((strobe * 18) % (stripe * 2) + stripe * 2) % (stripe * 2);
    g.fillStyle = view && Math.abs(cents) <= cfg.tolerance ? 'rgba(52,211,153,0.7)' : 'rgba(45,212,191,0.55)';
    for (let x = pad - stripe * 2 + off; x < W - pad; x += stripe * 2) g.fillRect(x, sy, stripe, sh);
    g.restore();
    y = sy + sh + 14;
  }

  // --- History
  if (cfg.showHistory) {
    const hy = y + 6;
    const hh = 88;
    const hx0 = pad;
    const hx1 = W - pad;
    g.fillStyle = 'rgba(15,23,42,0.6)';
    g.fillRect(hx0, hy, hx1 - hx0, hh);
    const cy2 = (c: number) => hy + hh / 2 - (Math.max(-50, Math.min(50, c)) / 50) * (hh / 2 - 4);
    g.fillStyle = 'rgba(52,211,153,0.16)';
    g.fillRect(hx0, cy2(cfg.tolerance), hx1 - hx0, cy2(-cfg.tolerance) - cy2(cfg.tolerance));
    g.strokeStyle = COLORS.tick;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(hx0, cy2(0));
    g.lineTo(hx1, cy2(0));
    g.stroke();
    g.lineWidth = 2;
    g.lineJoin = 'round';
    g.strokeStyle = COLORS.accent;
    g.beginPath();
    let pen = false;
    for (const p of hist) {
      const x = hx1 - ((nowMs - p.t) / HISTORY_MS) * (hx1 - hx0);
      if (p.c === null) { pen = false; continue; }
      const yy = cy2(p.c);
      if (!pen) { g.moveTo(x, yy); pen = true; } else g.lineTo(x, yy);
    }
    g.stroke();
    g.fillStyle = COLORS.sub;
    g.font = '11px system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText('last 8 s', hx0 + 6, hy + 4);
  }
}
