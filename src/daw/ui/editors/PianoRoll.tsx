import { useEffect, useMemo, useRef, useState } from 'react';
import { midiNoteName } from '../../midi/gm';
import { newId } from '../../model/factory';
import * as ops from '../../model/ops';
import { gridTicks, snapTick, ticksPerBar, ticksPerBeat } from '../../model/time';
import { MidiNote, MidiRegion, PPQ, Track } from '../../model/types';
import { useProject, useStudio, useUi } from '../studio';
import { hexA } from '../timeline/draw';

/**
 * Piano roll for one MIDI clip. Shows one loop cycle (content ticks
 * 0..loopLength). Click to add, drag to move, drag the right edge to resize,
 * right-click/Alt-click to delete, drag in the velocity lane to set loudness.
 */

const KEY_W = 52;
const ROW_H = 12;
const VEL_H = 64;
const LOW = 21;
const HIGH = 108;

type Drag =
  | { kind: 'move'; ids: string[]; x0: number; y0: number; orig: Map<string, MidiNote>; anchor: MidiNote; lastDp: number }
  | { kind: 'resize'; ids: string[]; x0: number; orig: Map<string, MidiNote> }
  | { kind: 'velocity' }
  | { kind: 'select'; x0: number; y0: number; x1: number; y1: number };

export function PianoRoll({ region, track }: { region: MidiRegion; track: Track }) {
  const s = useStudio();
  const editor = useProject((p) => p.editor);
  const sig = useProject((p) => p.timeSigMap[0].sig);
  const selectedNotes = useUi((u) => u.selectedNotes);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 240 });
  const [scroll, setScroll] = useState({ x: 0, y: (HIGH - 84) * ROW_H });
  const [ppb, setPpb] = useState(72);
  const drag = useRef<Drag | null>(null);
  const [box, setBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const grid = gridTicks(editor.grid);
  const snapT = (t: number) => (editor.snap ? snapTick(t, grid, 'floor') : Math.round(t));
  const sel = useMemo(() => new Set(selectedNotes), [selectedNotes]);
  const rollH = size.h - VEL_H;
  const contentLen = region.loop ? region.loopLength : Math.max(region.loopLength, region.length + region.contentOffset);

  // Center the view on the clip's notes when a clip is opened.
  const centered = useRef<string | null>(null);
  useEffect(() => {
    if (centered.current === region.id || size.h < 100) return;
    centered.current = region.id;
    const pitches = region.notes.map((n) => n.pitch);
    const mid = pitches.length ? (Math.min(...pitches) + Math.max(...pitches)) / 2 : 64;
    const h = size.h - VEL_H;
    setScroll({ x: 0, y: Math.max(0, Math.min((HIGH - LOW + 1) * ROW_H - h, (HIGH - mid) * ROW_H - h / 2)) });
  }, [region.id, region.notes, size.h]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xOf = (tick: number) => KEY_W + (tick * ppb) / PPQ - scroll.x;
  const tickOf = (x: number) => ((x - KEY_W + scroll.x) * PPQ) / ppb;
  const yOf = (pitch: number) => (HIGH - pitch) * ROW_H - scroll.y;
  const pitchOf = (y: number) => Math.max(LOW, Math.min(HIGH, HIGH - Math.floor((y + scroll.y) / ROW_H)));

  // Draw
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#0b1220';
    g.fillRect(0, 0, size.w, size.h);
    // rows
    for (let p = LOW; p <= HIGH; p++) {
      const y = yOf(p);
      if (y > rollH || y + ROW_H < 0) continue;
      const black = [1, 3, 6, 8, 10].includes(p % 12);
      g.fillStyle = black ? '#0c1426' : '#111b31';
      g.fillRect(KEY_W, y, size.w - KEY_W, ROW_H);
      if (p % 12 === 0) {
        g.fillStyle = 'rgba(148,163,184,0.25)';
        g.fillRect(KEY_W, y + ROW_H - 1, size.w - KEY_W, 1);
      }
    }
    // grid
    const barT = ticksPerBar(sig);
    const beatT = ticksPerBeat(sig);
    const t0 = Math.max(0, tickOf(KEY_W));
    const t1 = tickOf(size.w);
    const step = (grid * ppb) / PPQ >= 5 ? grid : beatT;
    for (let t = Math.floor(t0 / step) * step; t <= t1; t += step) {
      const x = Math.round(xOf(t));
      g.fillStyle = t % barT === 0 ? 'rgba(148,163,184,0.35)' : t % beatT === 0 ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.06)';
      g.fillRect(x, 0, 1, rollH);
    }
    // content end
    g.fillStyle = 'rgba(0,0,0,0.45)';
    const endX = xOf(contentLen);
    if (endX < size.w) g.fillRect(endX, 0, size.w - endX, rollH);
    // notes
    for (const n of region.notes) {
      const x = xOf(n.start);
      const w = Math.max(3, (n.length * ppb) / PPQ - 1);
      const y = yOf(n.pitch);
      if (x > size.w || x + w < KEY_W || y > rollH || y + ROW_H < 0) continue;
      g.fillStyle = sel.has(n.id) ? '#ffffff' : hexA(track.color, 0.55 + (n.velocity / 127) * 0.45);
      g.fillRect(x, y + 1, w, ROW_H - 2);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + w - 3, y + 1, 3, ROW_H - 2);
    }
    // keyboard
    for (let p = LOW; p <= HIGH; p++) {
      const y = yOf(p);
      if (y > rollH || y + ROW_H < 0) continue;
      const black = [1, 3, 6, 8, 10].includes(p % 12);
      g.fillStyle = black ? '#1e293b' : '#e2e8f0';
      g.fillRect(0, y, KEY_W, ROW_H - 1);
      if (p % 12 === 0) {
        g.fillStyle = '#0f172a';
        g.font = '600 9px Inter, system-ui';
        g.fillText(midiNoteName(p), 4, y + ROW_H - 3);
      }
    }
    // velocity lane
    g.fillStyle = '#070b14';
    g.fillRect(0, rollH, size.w, VEL_H);
    g.fillStyle = '#64748b';
    g.font = '600 9px Inter, system-ui';
    g.fillText('VELOCITY', 4, rollH + 14);
    for (const n of region.notes) {
      const x = xOf(n.start);
      if (x < KEY_W || x > size.w) continue;
      const h = (n.velocity / 127) * (VEL_H - 8);
      g.fillStyle = sel.has(n.id) ? '#fff' : track.color;
      g.fillRect(x, rollH + VEL_H - h - 2, 3, h);
    }
    if (box) {
      g.strokeStyle = 'rgba(56,189,248,0.9)';
      g.strokeRect(Math.min(box.x0, box.x1) + 0.5, Math.min(box.y0, box.y1) + 0.5, Math.abs(box.x1 - box.x0), Math.abs(box.y1 - box.y0));
    }
  });

  // Playhead overlay drawn via a separate rAF on a tiny absolutely positioned div
  const head = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = head.current;
      if (!el) return;
      const t = s.engine.currentTick();
      const rel = t - region.start;
      if (rel < 0 || rel >= region.length) {
        el.style.display = 'none';
        return;
      }
      let c = region.contentOffset + rel;
      if (region.loop) c %= region.loopLength;
      el.style.display = 'block';
      el.style.transform = `translateX(${xOf(c)}px)`;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });

  const setNotes = (notes: MidiNote[]) => s.store.preview((p) => ops.setNotes(p, region.id, notes));
  const local = (e: React.PointerEvent | React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const noteAt = (x: number, y: number) =>
    [...region.notes].reverse().find((n) => {
      const nx = xOf(n.start);
      const w = Math.max(3, (n.length * ppb) / PPQ);
      const ny = yOf(n.pitch);
      return x >= nx && x <= nx + w && y >= ny && y < ny + ROW_H;
    });

  const onDown = (e: React.PointerEvent) => {
    const { x, y } = local(e);
    canvas.current!.setPointerCapture(e.pointerId);
    if (y >= rollH) {
      drag.current = { kind: 'velocity' };
      s.store.beginGesture();
      setVelocityAt(x, y);
      return;
    }
    if (x < KEY_W) {
      s.engine.auditionNote(track.id, pitchOf(y));
      return;
    }
    const hit = noteAt(x, y);
    if (hit && (e.button === 2 || e.altKey)) {
      s.store.exec('Delete note', (p) => ops.setNotes(p, region.id, region.notes.filter((n) => n.id !== hit.id)));
      return;
    }
    if (e.button === 2) return;
    s.store.beginGesture();
    if (hit) {
      let ids = selectedNotes;
      if (e.shiftKey) ids = sel.has(hit.id) ? ids.filter((i) => i !== hit.id) : [...ids, hit.id];
      else if (!sel.has(hit.id)) ids = [hit.id];
      s.ui.set({ selectedNotes: ids });
      const orig = new Map(region.notes.filter((n) => ids.includes(n.id)).map((n) => [n.id, n]));
      const nx = xOf(hit.start) + (hit.length * ppb) / PPQ;
      if (nx - x <= 6) drag.current = { kind: 'resize', ids, x0: x, orig };
      else {
        drag.current = { kind: 'move', ids, x0: x, y0: y, orig, anchor: hit, lastDp: 0 };
        s.engine.auditionNote(track.id, hit.pitch, hit.velocity);
      }
      return;
    }
    if (e.shiftKey) {
      drag.current = { kind: 'select', x0: x, y0: y, x1: x, y1: y };
      return;
    }
    // Add a note
    const start = Math.max(0, snapT(tickOf(x)));
    if (start >= contentLen && region.loop) {
      s.store.cancelGesture();
      s.ui.toast('info', 'That is past the end of this looping clip. Make the loop longer in the toolbar.');
      return;
    }
    const note: MidiNote = { id: newId('n'), pitch: pitchOf(y), start, length: grid, velocity: 100 };
    setNotes([...region.notes, note]);
    s.ui.set({ selectedNotes: [note.id] });
    s.engine.auditionNote(track.id, note.pitch);
    drag.current = { kind: 'resize', ids: [note.id], x0: x, orig: new Map([[note.id, note]]) };
  };

  const setVelocityAt = (x: number, y: number) => {
    const v = Math.max(1, Math.min(127, Math.round(((rollH + VEL_H - 2 - y) / (VEL_H - 8)) * 127)));
    const target = region.notes.filter((n) => Math.abs(xOf(n.start) - x) <= 4 || (sel.has(n.id) && selectedNotes.length > 1 && Math.abs(xOf(n.start) - x) <= 4));
    if (!target.length) return;
    const ids = new Set(target.map((n) => n.id));
    setNotes(region.notes.map((n) => (ids.has(n.id) ? { ...n, velocity: v } : n)));
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const { x, y } = local(e);
    if (d.kind === 'velocity') return setVelocityAt(x, y);
    if (d.kind === 'select') {
      d.x1 = x;
      d.y1 = y;
      setBox({ x0: d.x0, y0: d.y0, x1: x, y1: y });
      return;
    }
    if (d.kind === 'move') {
      const dt = snapT(d.anchor.start + ((x - d.x0) * PPQ) / ppb) - d.anchor.start;
      const dp = pitchOf(y) - pitchOf(d.y0);
      const minStart = Math.min(...[...d.orig.values()].map((n) => n.start));
      const dtc = Math.max(dt, -minStart);
      const newPitch = Math.max(LOW, Math.min(HIGH, d.anchor.pitch + dp));
      setNotes(region.notes.map((n) => (d.orig.has(n.id) ? { ...n, start: d.orig.get(n.id)!.start + dtc, pitch: Math.max(0, Math.min(127, d.orig.get(n.id)!.pitch + dp)) } : n)));
      if (dp !== d.lastDp) {
        d.lastDp = dp;
        s.engine.auditionNote(track.id, newPitch, d.anchor.velocity, 0.15);
      }
      return;
    }
    if (d.kind === 'resize') {
      const dt = ((x - d.x0) * PPQ) / ppb;
      setNotes(
        region.notes.map((n) => {
          const o = d.orig.get(n.id);
          if (!o) return n;
          const end = editor.snap ? Math.max(o.start + grid, snapTick(o.start + o.length + dt, grid)) : Math.max(o.start + 10, Math.round(o.start + o.length + dt));
          return { ...n, length: end - o.start };
        }),
      );
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'select') {
      setBox(null);
      const ta = tickOf(Math.min(d.x0, d.x1));
      const tb = tickOf(Math.max(d.x0, d.x1));
      const pa = pitchOf(Math.max(d.y0, d.y1));
      const pb = pitchOf(Math.min(d.y0, d.y1));
      s.ui.set({ selectedNotes: region.notes.filter((n) => n.start + n.length > ta && n.start < tb && n.pitch >= pa && n.pitch <= pb).map((n) => n.id) });
      s.store.cancelGesture();
      return;
    }
    s.store.commitGesture(d.kind === 'velocity' ? 'Change velocity' : d.kind === 'move' ? 'Move notes' : 'Edit note');
  };

  return (
    <div ref={wrap} className="relative h-full min-h-0 w-full overflow-hidden" data-testid="piano-roll">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        className="block cursor-crosshair select-none"
        aria-label="Piano roll: click to add notes, drag to move, right-click to delete"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            setPpb((v) => Math.max(16, Math.min(400, v * (e.deltaY < 0 ? 1.15 : 1 / 1.15))));
          } else if (e.shiftKey) {
            setScroll((sc) => ({ ...sc, x: Math.max(0, sc.x + e.deltaY) }));
          } else {
            setScroll((sc) => ({ x: Math.max(0, sc.x + e.deltaX), y: Math.max(0, Math.min((HIGH - LOW + 1) * ROW_H - rollH, sc.y + e.deltaY)) }));
          }
        }}
      />
      <div ref={head} className="pointer-events-none absolute left-0 top-0 w-0.5 bg-amber-400" style={{ height: rollH, display: 'none' }} />
      <div className="absolute right-2 top-2 flex gap-1">
        <button type="button" className="rounded bg-slate-800/90 px-2 text-sm text-slate-200" aria-label="Zoom out" onClick={() => setPpb((v) => Math.max(16, v / 1.25))}>
          −
        </button>
        <button type="button" className="rounded bg-slate-800/90 px-2 text-sm text-slate-200" aria-label="Zoom in" onClick={() => setPpb((v) => Math.min(400, v * 1.25))}>
          +
        </button>
      </div>
    </div>
  );
}
