import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createMidiRegion, newId } from '../../model/factory';
import * as ops from '../../model/ops';
import { gridTicks, snapTick, ticksPerBar, ticksPerBeat } from '../../model/time';
import { AutomationPoint, PPQ, Project, Region } from '../../model/types';
import { addLoop, copy, cut, deleteSelection, duplicate, importFiles, paste, snap, splitAt, zoom } from '../actions';
import { useProject, useStudio, useUi } from '../studio';
import { COLORS, drawTimeline, laneValueToY, laneYToValue, View } from './draw';
import { computeRows, contentHeight, Row, rowAt, ticksToPx } from './layout';
import { Ruler } from './Ruler';

export const LOOP_DRAG_MIME = 'application/x-mrdaw-loop';
const EDGE = 7;

type Drag =
  | { kind: 'move'; ids: string[]; startX: number; startY: number; origin: Region; rowIndex: number; copy: boolean; moved: boolean }
  | { kind: 'resize'; id: string; edge: 'start' | 'end' }
  | { kind: 'fade'; id: string; which: 'in' | 'out' }
  | { kind: 'marquee'; x0: number; y0: number; x1: number; y1: number; additive: boolean }
  | { kind: 'point'; trackId: string; target: string; pointId: string; row: Row };

export function Timeline() {
  const s = useStudio();
  const project = useProject((p) => p);
  const selectedRegions = useUi((u) => u.selectedRegions);
  const tool = useUi((u) => u.tool);
  const dropHint = useUi((u) => u.dropHint);
  const scrollX = useUi((u) => u.scrollX);
  const scrollY = useUi((u) => u.scrollY);
  const rows = useMemo(() => computeRows(project), [project]);
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [assetTick, setAssetTick] = useState(0);
  const [marquee, setMarquee] = useState<View['marquee']>(null);
  const drag = useRef<Drag | null>(null);
  const [cursor, setCursor] = useState('default');
  const ppb = project.editor.pxPerBeat;

  const endTick = Math.max(ops.projectEndTick(project) + ticksPerBar(project.timeSigMap[0].sig) * 16, ticksPerBar(project.timeSigMap[0].sig) * 64);
  const contentW = ticksToPx(endTick, ppb);
  const contentH = contentHeight(rows) + 160;

  // Redraw when audio assets finish loading / processing (waveforms, status).
  useEffect(() => {
    const off = s.engine.assets.subscribe(() => setAssetTick((n) => n + 1));
    return () => void off();
  }, [s]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      s.ui.set({ timelineWidth: el.clientWidth });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [s]);

  // Programmatic scroll (zoom, follow playhead)
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (Math.abs(el.scrollLeft - scrollX) > 1) el.scrollLeft = scrollX;
    if (Math.abs(el.scrollTop - scrollY) > 1) el.scrollTop = scrollY;
  }, [scrollX, scrollY]);

  const view: View = useMemo(
    () => ({ width: size.w, height: size.h, scrollX, scrollY, pxPerBeat: ppb, selected: new Set(selectedRegions), dropHint, marquee }),
    [size, scrollX, scrollY, ppb, selectedRegions, dropHint, marquee],
  );

  // Main canvas
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const raf = requestAnimationFrame(() => {
      if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
        c.width = Math.round(size.w * dpr);
        c.height = Math.round(size.h * dpr);
      }
      const g = c.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawTimeline(g, project, rows, view, s.engine.assets);
    });
    return () => cancelAnimationFrame(raf);
  }, [project, rows, view, size, assetTick, s]);

  // Playhead overlay: reads the audio clock every frame; never drives audio.
  useEffect(() => {
    const c = overlay.current;
    if (!c) return;
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;
    let lastX = -1;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (c.width !== Math.round(size.w * dpr) || c.height !== Math.round(size.h * dpr)) {
        c.width = Math.round(size.w * dpr);
        c.height = Math.round(size.h * dpr);
        lastX = -1;
      }
      const tick = s.engine.currentTick();
      const u = s.ui.get();
      const p = s.store.get();
      const px = ticksToPx(Math.max(0, tick), p.editor.pxPerBeat) - u.scrollX;
      if (s.engine.state === 'playing' && p.editor.followPlayhead && !drag.current && (px > u.timelineWidth * 0.92 || px < 0)) {
        s.ui.set({ scrollX: Math.max(0, u.scrollX + px - u.timelineWidth * 0.1) });
      }
      if (Math.abs(px - lastX) < 0.25) return;
      lastX = px;
      const g = c.getContext('2d')!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size.w, size.h);
      if (px >= -1 && px <= size.w + 1) {
        g.fillStyle = s.ui.get().recording ? '#f43f5e' : COLORS.accent;
        g.fillRect(Math.round(px) - 0.5, 0, 2, size.h);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [s, size]);

  const toContent = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const rect = scroller.current!.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      return { vx, vy, cx: vx + scrollX, cy: vy + scrollY, tick: Math.max(0, ((vx + scrollX) * PPQ) / ppb) };
    },
    [scrollX, scrollY, ppb],
  );

  const regionAt = useCallback(
    (cx: number, row: Row | null): Region | null => {
      if (!row || row.kind !== 'track') return null;
      const tick = (cx * PPQ) / ppb;
      const hits = project.regions.filter((r) => r.trackId === row.trackId && tick >= r.start && tick < r.start + r.length);
      return hits[hits.length - 1] ?? null;
    },
    [project, ppb],
  );

  const hitInfo = (e: { clientX: number; clientY: number }) => {
    const pos = toContent(e);
    const row = rowAt(rows, pos.cy);
    const region = regionAt(pos.cx, row);
    let zone: 'body' | 'start' | 'end' | 'fadeIn' | 'fadeOut' | null = null;
    if (region && row) {
      const x0 = ticksToPx(region.start, ppb);
      const x1 = ticksToPx(region.start + region.length, ppb);
      const w = x1 - x0;
      const yIn = pos.cy - row.y;
      if (region.kind === 'audio' && selectedRegions.includes(region.id) && yIn >= 14 && yIn <= 26) {
        const fx0 = ticksToPx(region.start + region.fadeIn, ppb);
        const fx1 = ticksToPx(region.start + region.length - region.fadeOut, ppb);
        if (Math.abs(pos.cx - fx0) <= 5) zone = 'fadeIn';
        else if (Math.abs(pos.cx - fx1) <= 5) zone = 'fadeOut';
      }
      if (!zone) {
        if (w > EDGE * 3 && pos.cx - x0 <= EDGE) zone = 'start';
        else if (w > EDGE * 3 && x1 - pos.cx <= EDGE) zone = 'end';
        else zone = 'body';
      }
    }
    return { ...pos, row, region, zone };
  };

  const snapT = (t: number) => (project.editor.snap ? snapTick(t, gridTicks(project.editor.grid)) : Math.round(t));

  // ------------------------------------------------------------ pointer handling

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // context menu handles right click
    if (e.target !== scroller.current && !(e.target as HTMLElement).dataset.spacer) return;
    // Ignore clicks on the native scrollbars
    const rect = scroller.current!.getBoundingClientRect();
    if (e.clientX - rect.left > scroller.current!.clientWidth || e.clientY - rect.top > scroller.current!.clientHeight) return;
    s.ui.set({ menu: null });
    const h = hitInfo(e);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    if (h.row?.kind === 'lane') {
      startPointDrag(h.row, h, e);
      return;
    }
    if (h.row) s.ui.set({ selectedTrack: h.row.trackId });

    if (h.region) {
      const r = h.region;
      if (tool === 'split') {
        splitAt(s, [r.id], snapT(h.tick));
        return;
      }
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      let sel = selectedRegions;
      if (additive) sel = sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id];
      else if (!sel.includes(r.id)) sel = [r.id];
      s.ui.set({ selectedRegions: sel });
      if (!sel.includes(r.id)) return;
      s.store.beginGesture();
      if (h.zone === 'start' || h.zone === 'end') drag.current = { kind: 'resize', id: r.id, edge: h.zone };
      else if (h.zone === 'fadeIn' || h.zone === 'fadeOut') drag.current = { kind: 'fade', id: r.id, which: h.zone === 'fadeIn' ? 'in' : 'out' };
      else {
        const trackRows = rows.filter((x) => x.kind === 'track');
        drag.current = {
          kind: 'move',
          ids: sel,
          startX: h.cx,
          startY: h.cy,
          origin: r,
          rowIndex: trackRows.findIndex((x) => x.trackId === r.trackId),
          copy: e.altKey,
          moved: false,
        };
      }
      return;
    }

    // Empty space
    if (tool === 'draw' && h.row) {
      createMidiAt(h.row.trackId, h.tick);
      return;
    }
    if (!(e.shiftKey || e.metaKey || e.ctrlKey)) s.ui.set({ selectedRegions: [] });
    drag.current = { kind: 'marquee', x0: h.vx, y0: h.vy, x1: h.vx, y1: h.vy, additive: e.shiftKey };
  };

  const startPointDrag = (row: Row, h: ReturnType<typeof hitInfo>, e: React.PointerEvent) => {
    const track = project.tracks.find((t) => t.id === row.trackId)!;
    const lane = track.automation.find((l) => l.target === row.target);
    const pts = lane?.points ?? [];
    const hit = pts.find((pt) => Math.abs(ticksToPx(pt.tick, ppb) - h.cx) <= 6 && Math.abs(laneValueToY(track, row.target!, pt.value, row.y, row.h) - h.cy) <= 6);
    if (hit && (e.altKey || e.detail >= 2)) {
      s.store.exec('Delete automation point', (p) => ops.setAutomationPoints(p, track.id, row.target!, pts.filter((x) => x.id !== hit.id)));
      return;
    }
    s.store.beginGesture();
    let pointId = hit?.id;
    if (!pointId) {
      const pt: AutomationPoint = { id: newId('pt'), tick: snapT(h.tick), value: laneYToValue(track, row.target!, h.cy, row.y, row.h), curve: e.shiftKey ? 'step' : 'linear' };
      pointId = pt.id;
      s.store.preview((p) => ops.setAutomationPoints(p, track.id, row.target!, [...pts, pt]));
    }
    drag.current = { kind: 'point', trackId: track.id, target: row.target!, pointId, row };
  };

  const createMidiAt = (trackId: string, tick: number) => {
    const p = s.store.get();
    const track = p.tracks.find((t) => t.id === trackId);
    if (!track || track.kind !== 'instrument') {
      s.ui.toast('info', 'MIDI clips go on instrument tracks. Add one with "+ Track".');
      return;
    }
    const barT = ticksPerBar(p.timeSigMap[0].sig);
    const start = snapTick(tick, barT, 'floor');
    const region = createMidiRegion({ trackId, start, length: barT, loopLength: barT, name: track.name });
    s.store.exec('New MIDI clip', (x) => ops.addRegions(x, [region]));
    s.ui.set({ selectedRegions: [region.id], editRegion: region.id, bottom: 'editor' });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) {
      const h = hitInfo(e);
      setCursor(
        h.row?.kind === 'lane'
          ? 'crosshair'
          : !h.region
            ? tool === 'draw'
              ? 'cell'
              : 'default'
            : tool === 'split'
              ? 'col-resize'
              : h.zone === 'start' || h.zone === 'end'
                ? 'ew-resize'
                : h.zone === 'fadeIn' || h.zone === 'fadeOut'
                  ? 'nesw-resize'
                  : 'grab',
      );
      return;
    }
    const pos = toContent(e);
    if (d.kind === 'marquee') {
      d.x1 = pos.vx;
      d.y1 = pos.vy;
      setMarquee({ x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 });
      return;
    }
    if (d.kind === 'move') {
      const dxTicks = ((pos.cx - d.startX) * PPQ) / ppb;
      if (!d.moved && Math.abs(pos.cx - d.startX) < 3 && Math.abs(pos.cy - d.startY) < 3) return;
      d.moved = true;
      const newStart = Math.max(0, snapT(d.origin.start + dxTicks));
      const delta = newStart - d.origin.start;
      const trackRows = rows.filter((x) => x.kind === 'track');
      const row = rowAt(rows, pos.cy);
      const idx = row ? trackRows.findIndex((x) => x.trackId === row.trackId) : d.rowIndex;
      const dTrack = idx >= 0 ? idx - d.rowIndex : 0;
      setCursor('grabbing');
      s.store.preview((base) => {
        if (!d.copy) return ops.moveRegions(base, d.ids, delta, dTrack);
        const clones = base.regions.filter((r) => d.ids.includes(r.id)).map((r) => ops.cloneRegion(r));
        const withClones = { ...base, regions: [...base.regions, ...clones] };
        return ops.moveRegions(withClones, clones.map((c) => c.id), delta, dTrack);
      });
      return;
    }
    if (d.kind === 'resize') {
      s.store.preview((base) => ops.resizeRegion(base, d.id, d.edge, snapT(pos.tick)));
      return;
    }
    if (d.kind === 'fade') {
      s.store.preview((base) => {
        const r = base.regions.find((x) => x.id === d.id);
        if (!r || r.kind !== 'audio') return base;
        const v = d.which === 'in' ? Math.round(pos.tick - r.start) : Math.round(r.start + r.length - pos.tick);
        const max = r.length - (d.which === 'in' ? r.fadeOut : r.fadeIn);
        return ops.updateRegion(base, r.id, { [d.which === 'in' ? 'fadeIn' : 'fadeOut']: Math.max(0, Math.min(max, v)) });
      });
      return;
    }
    if (d.kind === 'point') {
      const track = s.store.get().tracks.find((t) => t.id === d.trackId)!;
      const value = laneYToValue(track, d.target, pos.cy, d.row.y, d.row.h);
      const tick = Math.max(0, snapT(pos.tick));
      s.store.preview((base) => {
        const t = base.tracks.find((x) => x.id === d.trackId)!;
        const lane = t.automation.find((l) => l.target === d.target);
        const pts = (lane?.points ?? []).map((pt) => (pt.id === d.pointId ? { ...pt, tick, value } : pt));
        return ops.setAutomationPoints(base, d.trackId, d.target, pts);
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === 'marquee') {
      setMarquee(null);
      const x0 = Math.min(d.x0, d.x1) + scrollX;
      const x1 = Math.max(d.x0, d.x1) + scrollX;
      const y0 = Math.min(d.y0, d.y1) + scrollY;
      const y1 = Math.max(d.y0, d.y1) + scrollY;
      if (x1 - x0 < 3 && y1 - y0 < 3) return; // plain click
      const t0 = (x0 * PPQ) / ppb;
      const t1 = (x1 * PPQ) / ppb;
      const trackIds = new Set(rows.filter((r) => r.kind === 'track' && r.y + r.h > y0 && r.y < y1).map((r) => r.trackId));
      const hit = project.regions.filter((r) => trackIds.has(r.trackId) && r.start < t1 && r.start + r.length > t0).map((r) => r.id);
      s.ui.set({ selectedRegions: d.additive ? [...new Set([...selectedRegions, ...hit])] : hit });
      return;
    }
    const labels = { move: (d as { copy?: boolean }).copy ? 'Copy clips' : 'Move clips', resize: 'Resize clip', fade: 'Change fade', point: 'Edit automation' } as const;
    s.store.commitGesture(labels[d.kind]);
    setCursor('default');
    void e;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const h = hitInfo(e);
    if (h.region?.kind === 'midi') {
      s.ui.set({ editRegion: h.region.id, bottom: 'editor', selectedRegions: [h.region.id] });
    } else if (h.region?.kind === 'audio') {
      s.ui.set({ inspectorOpen: true });
    } else if (h.row?.kind === 'track' && !h.region) {
      createMidiAt(h.row.trackId, h.tick);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const h = hitInfo(e);
    const at = snap(s, h.tick, 'floor');
    if (h.region) {
      if (!selectedRegions.includes(h.region.id)) s.ui.set({ selectedRegions: [h.region.id] });
      const r = h.region;
      s.ui.set({
        menu: {
          x: e.clientX,
          y: e.clientY,
          items: [
            ...(r.kind === 'midi' ? [{ label: 'Edit notes…', run: () => s.ui.set({ editRegion: r.id, bottom: 'editor' }) }] : []),
            { label: 'Cut', shortcut: 'Ctrl+X', run: () => cut(s) },
            { label: 'Copy', shortcut: 'Ctrl+C', run: () => copy(s) },
            { label: 'Duplicate', shortcut: 'Ctrl+D', run: () => duplicate(s) },
            { label: 'Split here', shortcut: 'S', run: () => splitAt(s, s.ui.get().selectedRegions, snap(s, h.tick)) },
            { separator: true, label: '' },
            { label: r.loop ? 'Turn looping off' : 'Turn looping on', run: () => s.store.exec('Toggle clip loop', (p) => ops.updateRegion(p, r.id, { loop: !r.loop })) },
            { label: r.muted ? 'Unmute clip' : 'Mute clip', run: () => s.store.exec('Mute clip', (p) => ops.updateRegion(p, r.id, { muted: !r.muted })) },
            ...(r.kind === 'audio' ? [{ label: r.reversed ? 'Play forwards' : 'Reverse', run: () => s.store.exec('Reverse clip', (p) => ops.updateRegion(p, r.id, { reversed: !r.reversed })) }] : []),
            { label: 'Set loop to this clip', run: () => s.store.exec('Set loop', (p) => ({ ...p, loop: { enabled: true, start: r.start, end: r.start + r.length } })) },
            { separator: true, label: '' },
            { label: 'Delete', shortcut: 'Del', danger: true, run: () => deleteSelection(s) },
          ],
        },
      });
    } else {
      const tid = h.row?.trackId ?? null;
      s.ui.set({
        selectedTrack: tid,
        menu: {
          x: e.clientX,
          y: e.clientY,
          items: [
            { label: 'Paste here', shortcut: 'Ctrl+V', disabled: !s.clipboard, run: () => { s.engine.seek(at); paste(s); } },
            ...(h.row && project.tracks.find((t) => t.id === h.row!.trackId)?.kind === 'instrument'
              ? [{ label: 'New MIDI clip here', run: () => createMidiAt(h.row!.trackId, h.tick) }]
              : []),
            { label: 'Move playhead here', run: () => s.engine.seek(at) },
            { label: 'Add marker here', run: () => s.store.exec('Add marker', (p) => ops.addMarker(p, at, `Section ${p.markers.length + 1}`)) },
          ],
        },
      });
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = scroller.current!.getBoundingClientRect();
      zoom(s, e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left);
    }
  };

  // Non-passive wheel listener so ctrl+wheel zoom can preventDefault (browser zoom).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const h = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    el.addEventListener('wheel', h, { passive: false });
    return () => el.removeEventListener('wheel', h);
  }, []);

  // ------------------------------------------------------------ drag & drop (library loops, files)

  const dropTarget = (e: React.DragEvent) => {
    const pos = toContent(e);
    const row = rowAt(rows, pos.cy);
    const p = s.store.get();
    const barT = ticksPerBar(p.timeSigMap[0].sig);
    const tick = p.editor.snap ? snapTick(pos.tick, Math.max(barT, gridTicks(p.editor.grid)), 'floor') : Math.round(pos.tick);
    const track = row ? p.tracks.find((t) => t.id === row.trackId) : undefined;
    return { tick, track };
  };

  const onDragOver = (e: React.DragEvent) => {
    const isLoop = e.dataTransfer.types.includes(LOOP_DRAG_MIME);
    const isFile = e.dataTransfer.types.includes('Files');
    if (!isLoop && !isFile) return;
    e.preventDefault();
    const { tick, track } = dropTarget(e);
    const audioOk = !track || track.kind === 'audio';
    e.dataTransfer.dropEffect = 'copy';
    const label = isFile ? 'Drop to import' : !track ? 'New track' : audioOk ? `Add to ${track.name}` : 'New audio track';
    const prev = s.ui.get().dropHint;
    const trackId = track && audioOk ? track.id : null;
    if (!prev || prev.tick !== tick || prev.trackId !== trackId || prev.label !== label) {
      s.ui.set({ dropHint: { tick, trackId, valid: true, label } });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    s.ui.set({ dropHint: null });
    const { tick, track } = dropTarget(e);
    const tid = track?.kind === 'audio' ? track.id : null;
    const loopId = e.dataTransfer.getData(LOOP_DRAG_MIME);
    if (loopId) {
      const entry = s.catalog.cached(loopId);
      if (!entry) {
        s.ui.toast('error', 'That loop could not be found in the library.');
        return;
      }
      addLoop(s, entry, tick, tid);
      return;
    }
    if (e.dataTransfer.files.length) void importFiles(s, [...e.dataTransfer.files], tick, tid);
  };

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <Ruler project={project} scrollX={scrollX} width={size.w} />
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvas} className="pointer-events-none absolute inset-0 h-full w-full" style={{ width: size.w, height: size.h }} />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 z-10" style={{ width: size.w, height: size.h }} />
        <div
          ref={scroller}
          data-testid="timeline"
          className="daw-scroll absolute inset-0 z-20 overflow-auto"
          style={{ cursor }}
          tabIndex={0}
          aria-label="Arrangement timeline. Drag loops here. Use arrow keys to nudge selected clips."
          onScroll={(e) => {
            const el = e.currentTarget;
            s.ui.set({ scrollX: el.scrollLeft, scrollY: el.scrollTop, menu: null });
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
            setMarquee(null);
            s.store.cancelGesture();
          }}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
          onWheel={onWheel}
          onDragOver={onDragOver}
          onDragLeave={() => s.ui.set({ dropHint: null })}
          onDrop={onDrop}
        >
          <div data-spacer="1" style={{ width: contentW, height: Math.max(contentH, size.h) }} />
        </div>
        {project.tracks.length === 0 && <EmptyHint />}
      </div>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-900/80 px-8 py-6 text-center">
        <div className="daw-display text-2xl text-amber-300">Drag a loop here to start your song 🎶</div>
        <div className="mt-2 text-sm text-slate-400">Pick a sound in the Loop Library on the right, press ▶ to hear it, then drag it onto this space.</div>
      </div>
    </div>
  );
}

export function beatTicks(p: Project) {
  return ticksPerBeat(p.timeSigMap[0].sig);
}
