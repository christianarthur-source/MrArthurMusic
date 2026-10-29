import { useEffect, useRef } from 'react';
import { snapTick, ticksPerBar, ticksPerBeat } from '../../model/time';
import { PPQ, Project } from '../../model/types';
import { useStudio } from '../studio';
import { COLORS } from './draw';
import { RULER_H, ticksToPx } from './layout';

/**
 * Bar/beat ruler. Click to move the playhead; drag to set a loop range;
 * drag the loop handles to adjust it.
 */
export function Ruler({ project, scrollX, width }: { project: Project; scrollX: number; width: number }) {
  const s = useStudio();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: 'seek' | 'range' | 'loopStart' | 'loopEnd'; anchor: number; moved: boolean } | null>(null);
  const ppb = project.editor.pxPerBeat;
  const sig = project.timeSigMap[0].sig;
  const barT = ticksPerBar(sig);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(width * dpr);
    c.height = Math.round(RULER_H * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0a0f1c';
    g.fillRect(0, 0, width, RULER_H);
    const x = (t: number) => ticksToPx(t, ppb) - scrollX;
    const t0 = (scrollX * PPQ) / ppb;
    const t1 = ((scrollX + width) * PPQ) / ppb;
    if (project.loop.enabled || project.loop.end > project.loop.start) {
      g.fillStyle = project.loop.enabled ? 'rgba(251,191,36,0.85)' : 'rgba(148,163,184,0.25)';
      g.fillRect(x(project.loop.start), 0, x(project.loop.end) - x(project.loop.start), 7);
    }
    const pxBar = ticksToPx(barT, ppb);
    const barStep = Math.max(1, Math.ceil(44 / pxBar));
    const beatT = ticksPerBeat(sig);
    g.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    for (let b = Math.floor(t0 / barT); b * barT <= t1; b++) {
      const xx = Math.round(x(b * barT));
      if (b % barStep === 0) {
        g.fillStyle = COLORS.textDim;
        g.fillRect(xx, 12, 1, RULER_H - 12);
        g.fillStyle = COLORS.text;
        g.fillText(String(b + 1), xx + 4, 24);
      }
      if (ticksToPx(beatT, ppb) > 10) {
        g.fillStyle = 'rgba(148,163,184,0.35)';
        for (let k = 1; k < sig.numerator; k++) g.fillRect(Math.round(x(b * barT + k * beatT)), RULER_H - 6, 1, 6);
      }
    }
    for (const m of project.markers) {
      const mx = x(m.tick);
      if (mx < -100 || mx > width) continue;
      g.fillStyle = COLORS.accent;
      g.beginPath();
      g.moveTo(mx, 8);
      g.lineTo(mx + 6, 8);
      g.lineTo(mx, 15);
      g.fill();
      g.font = '600 10px Inter, system-ui';
      g.fillText(m.name, mx + 8, 16);
    }
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(0, RULER_H - 1, width, 1);
  }, [project, scrollX, width, ppb, barT, sig]);

  const tickAt = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return Math.max(0, ((clientX - rect.left + scrollX) * PPQ) / ppb);
  };
  const snapIt = (t: number) => (project.editor.snap ? snapTick(t, Math.min(barT, ticksPerBeat(sig))) : Math.round(t));

  return (
    <canvas
      ref={canvas}
      className="block shrink-0 cursor-pointer select-none"
      style={{ width, height: RULER_H }}
      role="slider"
      aria-label="Timeline ruler: click to move the playhead, drag to set the loop"
      aria-valuenow={0}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const t = tickAt(e.clientX);
        const rect = canvas.current!.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const lx0 = ticksToPx(project.loop.start, ppb) - scrollX;
        const lx1 = ticksToPx(project.loop.end, ppb) - scrollX;
        const px = e.clientX - rect.left;
        let mode: 'seek' | 'range' | 'loopStart' | 'loopEnd' = 'seek';
        if (y < 10 && project.loop.enabled && Math.abs(px - lx0) < 6) mode = 'loopStart';
        else if (y < 10 && project.loop.enabled && Math.abs(px - lx1) < 6) mode = 'loopEnd';
        else if (y < 10) mode = 'range';
        drag.current = { mode, anchor: snapIt(t), moved: false };
        if (mode !== 'seek') s.store.beginGesture();
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const t = snapIt(tickAt(e.clientX));
        if (d.mode === 'seek') {
          if (Math.abs(t - d.anchor) >= barT / 4 || d.moved) {
            // dragging along the ruler body creates a loop range (like most DAWs)
            d.moved = true;
            d.mode = 'range';
            s.store.beginGesture();
          } else return;
        }
        d.moved = true;
        s.store.preview((p) => {
          let { start, end } = p.loop;
          if (d.mode === 'loopStart') start = Math.min(t, end - PPQ);
          else if (d.mode === 'loopEnd') end = Math.max(t, start + PPQ);
          else {
            start = Math.min(d.anchor, t);
            end = Math.max(d.anchor, t);
            if (end - start < PPQ) end = start + PPQ;
          }
          return { ...p, loop: { enabled: true, start, end } };
        });
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        if (d.mode === 'seek' || !d.moved) {
          s.store.cancelGesture();
          s.engine.seek(snapIt(tickAt(e.clientX)));
        } else s.store.commitGesture('Set loop range');
      }}
    />
  );
}
