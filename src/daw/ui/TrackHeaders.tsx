import { AudioLines, ChevronDown, ChevronUp, Copy, Mic, MoreVertical, Piano, Plus, Spline, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InstrumentDescriptor } from '../engine/instruments';
import { automatableTargets, automationTargetInfo } from '../model/automation';
import * as ops from '../model/ops';
import { Track } from '../model/types';
import { addTrack, removeTrack } from './actions';
import { cx, EditableText, fmtDb, fmtPan, Meter, SmallToggle, Slider } from './controls';
import { useProject, useStudio, useUi } from './studio';
import { computeRows, HEADER_W, RULER_H } from './timeline/layout';

export function useInstrumentList(): InstrumentDescriptor[] {
  const s = useStudio();
  const [list, setList] = useState<InstrumentDescriptor[]>([]);
  useEffect(() => {
    let live = true;
    s.engine.instruments.list().then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [s]);
  return list;
}

export function TrackHeaders() {
  const s = useStudio();
  const project = useProject((p) => p);
  const scrollY = useUi((u) => u.scrollY);
  const selectedTrack = useUi((u) => u.selectedTrack);
  const rows = useMemo(() => computeRows(project), [project]);
  const instruments = useInstrumentList();
  const [adding, setAdding] = useState(false);

  return (
    <div className="relative flex shrink-0 flex-col border-r border-slate-800 bg-slate-900" style={{ width: HEADER_W }}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-2" style={{ height: RULER_H }}>
        <div className="relative">
          <button
            type="button"
            data-testid="add-track"
            className="flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-400/25"
            onClick={() => setAdding((a) => !a)}
            aria-expanded={adding}
          >
            <Plus size={14} /> Track
          </button>
          {adding && (
            <div className="absolute left-0 top-8 z-50 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1 shadow-xl" onPointerLeave={() => setAdding(false)}>
              <MenuButton
                icon={<AudioLines size={15} />}
                title="Audio track"
                sub="Loops, recordings and imported audio"
                onClick={() => {
                  addTrack(s, 'audio');
                  setAdding(false);
                }}
              />
              <MenuButton
                icon={<Piano size={15} />}
                title="Instrument track"
                sub="Play and write notes (MIDI)"
                onClick={() => {
                  addTrack(s, 'instrument', 'piano', 'Piano');
                  setAdding(false);
                }}
              />
              <MenuButton
                icon={<span className="text-sm">🥁</span>}
                title="Drum machine track"
                sub="Program beats in the step sequencer"
                onClick={() => {
                  addTrack(s, 'instrument', 'drum_kit', 'Drums');
                  setAdding(false);
                }}
              />
            </div>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">{project.tracks.length} tracks</span>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div style={{ transform: `translateY(${-scrollY}px)` }}>
          {rows.map((row) => {
            const track = project.tracks.find((t) => t.id === row.trackId)!;
            return row.kind === 'track' ? (
              <TrackHeader key={row.trackId} track={track} height={row.h} selected={selectedTrack === track.id} instruments={instruments} index={project.tracks.indexOf(track)} count={project.tracks.length} />
            ) : (
              <LaneHeader key={`${row.trackId}:${row.target}`} track={track} target={row.target!} height={row.h} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MenuButton({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-800">
      <span className="mt-0.5 text-amber-300">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="block text-xs text-slate-400">{sub}</span>
      </span>
    </button>
  );
}

function TrackHeader({ track, height, selected, instruments, index, count }: { track: Track; height: number; selected: boolean; instruments: InstrumentDescriptor[]; index: number; count: number }) {
  const s = useStudio();
  const [menu, setMenu] = useState(false);
  const update = (label: string, patch: Partial<Track>, key?: string) => s.store.exec(label, (p) => ops.updateTrack(p, track.id, patch), key);
  const meterBuf = useMemo(() => new Float32Array(512), []);
  const readMeter = useCallback(() => s.engine.meterLevel(s.engine.graph.strip(track.id)?.meter, meterBuf), [s, track.id, meterBuf]);
  const compact = height < 64;

  return (
    <div
      className={cx('relative flex border-b border-black/40 pl-2 pr-1', selected ? 'bg-slate-800' : 'bg-slate-900 hover:bg-slate-800/60')}
      style={{ height }}
      onPointerDown={() => s.ui.set({ selectedTrack: track.id })}
      data-testid="track-header"
    >
      <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: track.color }} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pl-1.5">
        <div className="flex items-center gap-1">
          <span className="text-slate-400">{track.kind === 'audio' ? <AudioLines size={13} /> : <Piano size={13} />}</span>
          <EditableText
            label="Track name"
            value={track.name}
            className="min-w-0 flex-1 text-sm font-semibold text-slate-100"
            onCommit={(v) => {
              if (s.host.textFilter && !s.host.textFilter(v)) {
                s.ui.toast('warn', 'Please use school-appropriate words.');
                return;
              }
              update('Rename track', { name: v.slice(0, 40) });
            }}
          />
          <SmallToggle label="M" title={track.mute ? 'Unmute track' : 'Mute track'} active={track.mute} color="bg-sky-400" onClick={() => update('Mute', { mute: !track.mute })} />
          <SmallToggle label="S" title={track.solo ? 'Un-solo track' : 'Solo track (hear only this)'} active={track.solo} color="bg-amber-400" onClick={() => update('Solo', { solo: !track.solo })} />
          {track.kind === 'audio' && (
            <SmallToggle
              label="●"
              title={track.arm ? 'Disarm recording' : 'Arm for recording'}
              active={track.arm}
              color="bg-rose-500"
              onClick={() => s.store.exec('Arm track', (p) => ({ ...p, tracks: p.tracks.map((t) => ({ ...t, arm: t.id === track.id ? !track.arm : t.kind === 'audio' ? false : t.arm })) }))}
            />
          )}
          <button type="button" aria-label="Track options" title="Track options" className="rounded p-0.5 text-slate-400 hover:bg-slate-700 hover:text-white" onClick={() => setMenu((m) => !m)}>
            <MoreVertical size={15} />
          </button>
        </div>
        {!compact && (
          <div className="flex items-center gap-1.5">
            {track.kind === 'instrument' ? (
              <select
                aria-label="Instrument"
                className="h-6 min-w-0 flex-1 rounded-md bg-slate-800 px-1 text-xs text-slate-200"
                value={track.instrument?.id ?? 'piano'}
                onChange={(e) => update('Change instrument', { instrument: { id: e.target.value } })}
              >
                {groupBy(instruments, (i) => i.family).map(([fam, list]) => (
                  <optgroup key={fam} label={fam}>
                    {list.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {!instruments.some((i) => i.id === track.instrument?.id) && <option value={track.instrument?.id}>{track.instrument?.id}</option>}
              </select>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-slate-500">{track.arm ? <><Mic size={11} /> armed</> : 'Audio'}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Slider
            label="Volume"
            className="min-w-0 flex-1"
            min={-60}
            max={6}
            step={0.5}
            value={track.volumeDb}
            defaultValue={0}
            format={fmtDb}
            onChange={(v) => {
              s.store.beginGesture();
              s.store.preview((p) => ops.updateTrack(p, track.id, { volumeDb: v }));
            }}
            onCommit={() => s.store.commitGesture('Change volume')}
          />
          <Slider
            label="Pan"
            className="w-12"
            min={-1}
            max={1}
            step={0.02}
            value={track.pan}
            defaultValue={0}
            format={fmtPan}
            onChange={(v) => {
              s.store.beginGesture();
              s.store.preview((p) => ops.updateTrack(p, track.id, { pan: v }));
            }}
            onCommit={() => s.store.commitGesture('Change pan')}
          />
        </div>
        <Meter read={readMeter} />
      </div>
      {menu && (
        <div className="absolute right-1 top-7 z-50 w-56 rounded-xl border border-slate-700 bg-slate-900 p-1 text-sm shadow-xl" onPointerLeave={() => setMenu(false)}>
          <MenuRow icon={<Copy size={14} />} label="Duplicate track" onClick={() => s.store.exec('Duplicate track', (p) => ops.duplicateTrack(p, track.id))} />
          <MenuRow icon={<ChevronUp size={14} />} label="Move up" disabled={index === 0} onClick={() => s.store.exec('Move track', (p) => ops.moveTrack(p, track.id, index - 1))} />
          <MenuRow icon={<ChevronDown size={14} />} label="Move down" disabled={index === count - 1} onClick={() => s.store.exec('Move track', (p) => ops.moveTrack(p, track.id, index + 1))} />
          <div className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-slate-500">Automation lanes</div>
          {automatableTargets(track).map((t) => {
            const lane = track.automation.find((l) => l.target === t.target);
            return (
              <MenuRow
                key={t.target}
                icon={<Spline size={14} />}
                label={`${lane?.visible ? 'Hide' : 'Show'} ${t.label}`}
                onClick={() => s.store.exec('Show automation', (p) => ops.setLaneVisible(p, track.id, t.target, !lane?.visible))}
              />
            );
          })}
          <div className="flex gap-1 px-2 py-2">
            {['#F59E0B', '#EC4899', '#38BDF8', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#A3E635'].map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} className="h-5 w-5 rounded-full ring-1 ring-black/40" style={{ background: c }} onClick={() => update('Track color', { color: c })} />
            ))}
          </div>
          <div className="flex items-center gap-2 px-2 pb-2 text-xs text-slate-400">
            Height
            <button className="rounded bg-slate-800 px-2" onClick={() => update('Track height', { height: Math.max(44, track.height - 16) })}>−</button>
            <button className="rounded bg-slate-800 px-2" onClick={() => update('Track height', { height: Math.min(200, track.height + 16) })}>+</button>
          </div>
          <MenuRow icon={<Trash2 size={14} />} danger label="Delete track" onClick={() => removeTrack(s, track.id)} />
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon, label, onClick, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left disabled:opacity-40', danger ? 'text-rose-300 hover:bg-rose-500/15' : 'text-slate-200 hover:bg-slate-800')}
    >
      {icon}
      {label}
    </button>
  );
}

function LaneHeader({ track, target, height }: { track: Track; target: string; height: number }) {
  const s = useStudio();
  const info = automationTargetInfo(track, target);
  const lane = track.automation.find((l) => l.target === target);
  return (
    <div className="flex items-center gap-1 border-b border-black/40 bg-slate-950 pl-5 pr-1 text-xs text-slate-300" style={{ height }}>
      <Spline size={12} className="text-slate-500" />
      <span className="min-w-0 flex-1 truncate" title="Click in the lane to add points. Drag to move. Alt-click or double-click a point to delete. Shift-click adds a step.">
        {info?.label}
      </span>
      <button
        type="button"
        className={cx('rounded px-1.5 py-0.5 text-[10px]', lane?.enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500')}
        title={lane?.enabled ? 'Automation on (click to turn off)' : 'Automation off'}
        onClick={() => s.store.exec('Toggle automation', (p) => ({ ...p, tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, automation: t.automation.map((l) => (l.target === target ? { ...l, enabled: !l.enabled } : l)) } : t)) }))}
      >
        {lane?.enabled ? 'ON' : 'OFF'}
      </button>
      <button type="button" className="rounded px-1 text-slate-500 hover:text-rose-300" title="Clear all points" onClick={() => s.store.exec('Clear automation', (p) => ops.setAutomationPoints(p, track.id, target, []))}>
        Clear
      </button>
      <button type="button" className="rounded px-1 text-slate-500 hover:text-white" aria-label="Hide lane" onClick={() => s.store.exec('Hide automation', (p) => ops.setLaneVisible(p, track.id, target, false))}>
        ✕
      </button>
    </div>
  );
}

export function groupBy<T>(list: T[], key: (t: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const k = key(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return [...m];
}
