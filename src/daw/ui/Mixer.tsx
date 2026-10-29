import { AlertTriangle } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import * as ops from '../model/ops';
import { Track } from '../model/types';
import { cx, fmtDb, fmtPan, Meter, SmallToggle, Slider } from './controls';
import { useProject, useStudio } from './studio';

/** Mixing desk backed by the real audio graph (meters read the track analysers). */
export function Mixer() {
  const tracks = useProject((p) => p.tracks);
  return (
    <div className="daw-scroll flex h-full min-h-0 gap-2 overflow-x-auto p-3" role="region" aria-label="Mixer">
      {tracks.map((t) => (
        <Strip key={t.id} track={t} />
      ))}
      <MasterStrip />
    </div>
  );
}

function Strip({ track }: { track: Track }) {
  const s = useStudio();
  const buf = useMemo(() => new Float32Array(512), []);
  const read = useCallback(() => s.engine.meterLevel(s.engine.graph.strip(track.id)?.meter, buf), [s, track.id, buf]);
  const live = (patch: Partial<Track>) => {
    s.store.beginGesture();
    s.store.preview((p) => ops.updateTrack(p, track.id, patch));
  };
  const volAutomated = track.automation.some((l) => l.target === 'volume' && l.enabled && l.points.length);
  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 p-2">
      <div className="h-1 w-full rounded" style={{ background: track.color }} />
      <div className="w-full truncate text-center text-xs font-semibold text-slate-200" title={track.name}>
        {track.name}
      </div>
      <Slider label={`${track.name} pan`} className="w-full" min={-1} max={1} step={0.02} value={track.pan} defaultValue={0} format={fmtPan} onChange={(v) => live({ pan: v })} onCommit={() => s.store.commitGesture('Pan')} />
      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        <Slider vertical label={`${track.name} volume`} min={-60} max={6} step={0.5} value={track.volumeDb} defaultValue={0} format={fmtDb} onChange={(v) => live({ volumeDb: v })} onCommit={() => s.store.commitGesture('Volume')} />
        <Meter vertical read={read} />
      </div>
      <div className="font-mono text-[11px] text-slate-400">{volAutomated ? 'auto' : fmtDb(track.volumeDb)}</div>
      <div className="flex gap-1">
        <SmallToggle label="M" title="Mute" active={track.mute} color="bg-sky-400" onClick={() => s.store.exec('Mute', (p) => ops.updateTrack(p, track.id, { mute: !track.mute }))} />
        <SmallToggle label="S" title="Solo" active={track.solo} color="bg-amber-400" onClick={() => s.store.exec('Solo', (p) => ops.updateTrack(p, track.id, { solo: !track.solo }))} />
      </div>
      <button
        type="button"
        className={cx('w-full rounded-md px-1 py-0.5 text-[11px]', track.effects.length ? 'bg-violet-500/20 text-violet-200' : 'bg-slate-800 text-slate-400')}
        onClick={() => s.ui.set({ selectedTrack: track.id, selectedRegions: [], bottom: 'inspector' })}
      >
        FX {track.effects.length ? `(${track.effects.length})` : '+'}
      </button>
    </div>
  );
}

function MasterStrip() {
  const s = useStudio();
  const master = useProject((p) => p.master);
  const buf = useMemo(() => new Float32Array(1024), []);
  const read = useCallback(() => s.engine.meterLevel(s.engine.graph.masterMeter, buf), [s, buf]);
  const readPre = useCallback(() => s.engine.meterLevel(s.engine.graph.preLimiterMeter, buf), [s, buf]);
  return (
    <div className="ml-auto flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900 p-2">
      <div className="h-1 w-full rounded bg-amber-400" />
      <div className="text-xs font-bold text-amber-300">MASTER</div>
      <div className="flex min-h-0 flex-1 items-stretch gap-2">
        <Slider
          vertical
          label="Master volume"
          min={-60}
          max={6}
          step={0.5}
          value={master.volumeDb}
          defaultValue={0}
          format={fmtDb}
          onChange={(v) => {
            s.store.beginGesture();
            s.store.preview((p) => ({ ...p, master: { ...p.master, volumeDb: v } }));
          }}
          onCommit={() => s.store.commitGesture('Master volume')}
        />
        <Meter vertical read={read} />
        <Meter vertical read={readPre} className="opacity-60" />
      </div>
      <div className="font-mono text-[11px] text-slate-400">{fmtDb(master.volumeDb)}</div>
      <HotWarning read={readPre} />
      <button type="button" className="w-full rounded-md bg-slate-800 px-1 py-0.5 text-[11px] text-slate-300" onClick={() => s.ui.set({ selectedTrack: null, selectedRegions: [], bottom: 'inspector' })}>
        Master FX ({master.effects.length})
      </button>
    </div>
  );
}

/** Shows a warning when the summed mix (before the limiter) is clipping. */
function HotWarning({ read }: { read: () => number }) {
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      let until = 0;
      const id = setInterval(() => {
        const now = performance.now();
        if (read() > 1) until = now + 2500;
        el.style.visibility = now < until ? 'visible' : 'hidden';
      }, 100);
      return () => clearInterval(id);
    },
    [read],
  );
  return (
    <div ref={ref} className="flex items-center gap-1 text-[10px] font-semibold text-rose-300" style={{ visibility: 'hidden' }} title="The mix is louder than 0 dB before the limiter. Turn some tracks down to avoid distortion.">
      <AlertTriangle size={11} /> Too loud
    </div>
  );
}
