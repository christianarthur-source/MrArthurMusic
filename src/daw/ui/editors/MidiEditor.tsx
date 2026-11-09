import { useEffect, useState } from 'react';
import { InstrumentManifest } from '../../library/catalogTypes';
import * as ops from '../../model/ops';
import { ticksPerBar } from '../../model/time';
import { MidiRegion } from '../../model/types';
import { exportMidi, quantizeSelection, transformNotes } from '../actions';
import { arpeggiate, ArpPattern, strum } from '../../midi/noteTools';
import { ChordType, keyShortName } from '../../model/musicKey';
import { gridTicks } from '../../model/time';
import { cx } from '../controls';
import { useProject, useStudio, useUi } from '../studio';
import { PianoRoll } from './PianoRoll';
import { StepSequencer } from './StepSequencer';

const PPQ_HALF = 480; // arpeggios no slower than 8th notes

function GrooveSlider({ label, title, value, onChange }: { label: string; title: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1 text-slate-300" title={title}>
      {label}
      <input type="range" min={0} max={100} step={5} aria-label={label} className="w-16 accent-amber-400" value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <span className="w-8 font-mono text-slate-400">{Math.round(value * 100)}%</span>
    </label>
  );
}

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
  const [chord, setChord] = useState<ChordType | 'single'>('single');

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
        <GrooveSlider label="Swing" title="Swing: pushes every other 16th note later for a bouncy, shuffled feel" value={region.swing ?? 0} onChange={(v) => s.store.exec('Swing', (p) => ops.updateRegion(p, region.id, { swing: v }), `swing:${region.id}`)} />
        <GrooveSlider label="Humanize" title="Humanize: tiny random changes to timing and loudness so it sounds played by a person" value={region.humanize ?? 0} onChange={(v) => s.store.exec('Humanize', (p) => ops.updateRegion(p, region.id, { humanize: v }), `humanize:${region.id}`)} />
        <span className="ml-auto text-slate-500">{region.notes.length} notes</span>
      </div>
      {!showSteps && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-1 text-xs">
          <label className="flex items-center gap-1 text-slate-300" title="Click once in the piano roll to add a whole chord. With a song key, chords use only notes from the key.">
            Click adds
            <select aria-label="Chord tool" data-testid="chord-tool" className="h-7 rounded-md bg-slate-800 px-1 text-slate-100" value={chord} onChange={(e) => setChord(e.target.value as ChordType | 'single')}>
              <option value="single">One note</option>
              <option value="triad">Chord (3 notes)</option>
              <option value="seventh">7th chord (4 notes)</option>
              <option value="power">Power chord</option>
            </select>
          </label>
          <button
            type="button"
            aria-pressed={project.editor.keyLock && !!project.key}
            data-testid="key-lock"
            title={project.key ? 'Lock to key: notes you add or move snap to the song key, so nothing sounds wrong.' : 'Pick a song key (in the top bar) or add a loop with a key to use Lock to key.'}
            disabled={!project.key}
            onClick={() => s.store.exec('Lock to key', (p) => ({ ...p, editor: { ...p.editor, keyLock: !p.editor.keyLock } }))}
            className={cx('rounded-md px-2 py-0.5 disabled:opacity-40', project.editor.keyLock && project.key ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/50' : 'bg-slate-800 text-slate-200 hover:bg-slate-700')}
          >
            🔒 Lock to {project.key ? keyShortName(project.key) : 'key'}
          </button>
          <span className="mx-1 h-4 w-px bg-slate-700" />
          <label className="flex items-center gap-1 text-slate-300" title="Arpeggiate: turn chords into a pattern of single notes, one per grid step">
            Arpeggiate
            <select
              aria-label="Arpeggiate"
              className="h-7 rounded-md bg-slate-800 px-1 text-slate-100"
              value=""
              onChange={(e) => {
                const pattern = e.target.value as ArpPattern;
                if (!pattern) return;
                const g = gridTicks(project.editor.grid);
                transformNotes(s, region.id, 'Arpeggiate', (notes) => arpeggiate(notes, Math.min(g, PPQ_HALF), pattern));
              }}
            >
              <option value="">Pick…</option>
              <option value="up">Up ↑</option>
              <option value="down">Down ↓</option>
              <option value="updown">Up and down ↕</option>
              <option value="random">Random 🎲</option>
            </select>
          </label>
          <button type="button" className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700" title="Strum chords downward, like a guitar (low string first)" onClick={() => transformNotes(s, region.id, 'Strum down', (n) => strum(n, 'down'))}>
            Strum ↓
          </button>
          <button type="button" className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-200 hover:bg-slate-700" title="Strum chords upward (high string first)" onClick={() => transformNotes(s, region.id, 'Strum up', (n) => strum(n, 'up'))}>
            Strum ↑
          </button>
          <span className="text-slate-500">Works on the selected notes, or the whole clip.</span>
        </div>
      )}
      <div className="min-h-0 flex-1">
        {showSteps ? <StepSequencer region={region} track={track} availableNotes={kitNotes} noteNames={kitNames} /> : <PianoRoll region={region} track={track} chord={chord} />}
      </div>
    </div>
  );
}
