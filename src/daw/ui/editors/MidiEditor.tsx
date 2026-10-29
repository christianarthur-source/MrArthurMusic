import { useEffect, useState } from 'react';
import { InstrumentManifest } from '../../library/catalogTypes';
import * as ops from '../../model/ops';
import { ticksPerBar } from '../../model/time';
import { MidiRegion } from '../../model/types';
import { exportMidi, quantizeSelection } from '../actions';
import { cx } from '../controls';
import { useProject, useStudio, useUi } from '../studio';
import { PianoRoll } from './PianoRoll';
import { StepSequencer } from './StepSequencer';

/** Bottom-panel editor for the MIDI clip in ui.editRegion. */
export function MidiEditor() {
  const s = useStudio();
  const editId = useUi((u) => u.editRegion);
  const selected = useUi((u) => u.selectedRegions);
  const project = useProject((p) => p);
  const regionId = editId ?? selected.find((id) => project.regions.find((r) => r.id === id)?.kind === 'midi');
  const region = project.regions.find((r) => r.id === regionId) as MidiRegion | undefined;
  const track = region ? project.tracks.find((t) => t.id === region.trackId) : undefined;
  const isDrums = !!track?.instrument?.id.startsWith('drum');
  const [mode, setMode] = useState<'auto' | 'roll' | 'steps'>('auto');
  const [kitNotes, setKitNotes] = useState<Set<number> | null>(null);
  const [kitNames, setKitNames] = useState<Record<string, string> | undefined>(undefined);
  const showSteps = mode === 'steps' || (mode === 'auto' && isDrums);

  useEffect(() => {
    if (!isDrums || !track?.instrument) return;
    let live = true;
    fetch('/daw-library/instruments.json')
      .then((r) => r.json() as Promise<InstrumentManifest>)
      .then((m) => {
        const inst = m.instruments.find((i) => i.id === track.instrument!.id);
        if (live && inst) {
          setKitNotes(new Set(Object.keys(inst.samples).map(Number)));
          setKitNames(inst.noteNames);
        }
      })
      .catch(() => live && setKitNotes(null));
    return () => {
      live = false;
    };
  }, [isDrums, track?.instrument?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!region || !track) {
    return <div className="p-6 text-sm text-slate-400">Double-click a MIDI clip to edit its notes — or double-click an empty spot on an instrument track to make a new clip.</div>;
  }
  const bar = ticksPerBar(project.timeSigMap[0].sig);
  const cycleBars = Math.round((region.loop ? region.loopLength : region.length) / bar);
  const setBars = (n: number) => {
    const len = Math.max(1, Math.min(16, n)) * bar;
    s.store.exec('Clip length', (p) => ops.updateRegion(p, region.id, region.loop ? { loopLength: len, length: Math.max(region.length, len) } : { loopLength: Math.max(region.loopLength, len), length: len }));
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-1.5 text-xs">
        <span className="h-3 w-3 rounded-full" style={{ background: track.color }} />
        <span className="font-semibold text-slate-100">{region.name}</span>
        <span className="text-slate-500">on {track.name}</span>
        <div className="ml-2 flex rounded-lg bg-slate-800 p-0.5">
          {(['roll', 'steps'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={(m === 'steps') === showSteps} onClick={() => setMode(m)} className={cx('rounded-md px-2 py-0.5', (m === 'steps') === showSteps ? 'bg-slate-600 text-white' : 'text-slate-400')}>
              {m === 'roll' ? '🎹 Piano roll' : '🥁 Step grid'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-slate-300">
          {region.loop ? 'Loop length' : 'Clip length'}
          <button type="button" className="rounded bg-slate-800 px-1.5" onClick={() => setBars(cycleBars - 1)} aria-label="Shorter">−</button>
          <span className="w-12 text-center font-mono">{cycleBars} bar{cycleBars === 1 ? '' : 's'}</span>
          <button type="button" className="rounded bg-slate-800 px-1.5" onClick={() => setBars(cycleBars + 1)} aria-label="Longer">+</button>
        </label>
        <label className="flex items-center gap-1 text-slate-300">
          <input type="checkbox" className="accent-amber-400" checked={region.loop} onChange={() => s.store.exec('Toggle clip loop', (p) => ops.updateRegion(p, region.id, { loop: !region.loop }))} />
          Loop
        </label>
        <button type="button" className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700" title="Move notes onto the grid (Q)" onClick={() => quantizeSelection(s)}>
          Quantize
        </button>
        <button type="button" className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700" onClick={() => exportMidi(s, [region.id])}>
          Export .mid
        </button>
        <span className="ml-auto text-slate-500">{region.notes.length} notes</span>
      </div>
      <div className="min-h-0 flex-1">
        {showSteps ? <StepSequencer region={region} track={track} availableNotes={kitNotes} noteNames={kitNames} /> : <PianoRoll region={region} track={track} />}
      </div>
    </div>
  );
}
