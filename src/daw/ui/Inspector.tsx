import { AlertTriangle } from 'lucide-react';
import { audioPlayback } from '../engine/scheduler';
import * as ops from '../model/ops';
import { secondsPerTick } from '../model/time';
import { AudioRegion, PPQ, Region, StretchMode } from '../model/types';
import { cx, EditableText, fmtDb, Slider } from './controls';
import { EffectsChain } from './Effects';
import { useProject, useStudio, useUi } from './studio';

/** Bottom panel: selected clip properties + selected track's effects. */
export function Inspector() {
  const s = useStudio();
  const selected = useUi((u) => u.selectedRegions);
  const trackId = useUi((u) => u.selectedTrack);
  const project = useProject((p) => p);
  const region = selected.length === 1 ? project.regions.find((r) => r.id === selected[0]) : undefined;
  const track = project.tracks.find((t) => t.id === (region?.trackId ?? trackId));
  return (
    <div className="flex h-full min-h-0 gap-4 overflow-hidden p-3">
      <section className="w-80 shrink-0 overflow-y-auto" aria-label="Clip properties">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Clip</h3>
        {region ? (
          <RegionProps region={region} />
        ) : selected.length > 1 ? (
          <p className="text-sm text-slate-400">{selected.length} clips selected. Drag to move them together, or press Ctrl+D to duplicate.</p>
        ) : (
          <p className="text-sm text-slate-500">Click a clip on the timeline to change its volume, fades, tempo and pitch.</p>
        )}
      </section>
      <section className="min-w-0 flex-1 overflow-hidden" aria-label="Track effects">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
          Effects {track ? <span className="normal-case text-slate-200">· {track.name}</span> : <span className="normal-case">· Master</span>}
        </h3>
        {track ? <EffectsChain owner={{ trackId: track.id }} effects={track.effects} /> : <EffectsChain owner="master" effects={project.master.effects} />}
        {!track && <p className="mt-2 text-xs text-slate-500">Select a track to edit its effects. With no track selected you are editing the Master (the whole song).</p>}
        <button type="button" className="mt-2 text-xs text-slate-400 underline hover:text-white" onClick={() => s.ui.set({ selectedTrack: null, selectedRegions: [] })}>
          Edit master effects
        </button>
      </section>
    </div>
  );
}

function RegionProps({ region }: { region: Region }) {
  const s = useStudio();
  const update = (label: string, patch: Partial<Region>, key?: string) => s.store.exec(label, (p) => ops.updateRegion(p, region.id, patch), key);
  const live = (patch: Partial<Region>) => {
    s.store.beginGesture();
    s.store.preview((p) => ops.updateRegion(p, region.id, patch));
  };
  const commit = (label: string) => s.store.commitGesture(label);
  const bars = (t: number) => (t / (PPQ * 4)).toFixed(2);
  return (
    <div className="space-y-3 text-sm">
      <EditableText label="Clip name" value={region.name} className="text-base font-semibold text-slate-100" onCommit={(v) => update('Rename clip', { name: v.slice(0, 60) })} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-400">
        <span>Starts at bar</span>
        <span className="font-mono text-slate-200">{(region.start / (PPQ * 4) + 1).toFixed(2)}</span>
        <span>Length (bars)</span>
        <span className="font-mono text-slate-200">{bars(region.length)}</span>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="accent-amber-400" checked={region.loop} onChange={() => update('Toggle clip loop', { loop: !region.loop })} />
        <span>Loop (repeat when you stretch the right edge)</span>
      </label>
      {region.kind === 'audio' && <AudioProps region={region} live={live} commit={commit} update={update} />}
      {region.kind === 'midi' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">{region.notes.length} notes</p>
          <button type="button" className="rounded-lg bg-amber-400 px-3 py-1.5 text-sm font-semibold text-slate-950" onClick={() => s.ui.set({ editRegion: region.id, bottom: 'editor' })}>
            Edit notes
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {['#F59E0B', '#EC4899', '#38BDF8', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#A3E635'].map((c) => (
          <button key={c} type="button" aria-label={`Clip color ${c}`} className={cx('h-5 w-5 rounded-full ring-1', region.color === c ? 'ring-white' : 'ring-black/40')} style={{ background: c }} onClick={() => update('Clip color', { color: c })} />
        ))}
      </div>
    </div>
  );
}

function AudioProps({
  region,
  live,
  commit,
  update,
}: {
  region: AudioRegion;
  live: (p: Partial<AudioRegion>) => void;
  commit: (l: string) => void;
  update: (l: string, p: Partial<AudioRegion>, k?: string) => void;
}) {
  const project = useProject((p) => p);
  const asset = project.assets[region.assetId];
  const { rate } = audioPlayback(project, region);
  const bpm = project.tempoMap[0].bpm;
  const extreme = region.stretch !== 'off' && (rate < 0.5 || rate > 2);
  const fadeMax = region.length;
  const msPerTick = secondsPerTick(bpm) * 1000;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs">
          <span>Clip volume</span>
          <span className="font-mono text-slate-400">{fmtDb(region.gainDb)}</span>
        </div>
        <Slider label="Clip volume" className="w-full" min={-24} max={12} step={0.5} value={region.gainDb} defaultValue={0} format={fmtDb} onChange={(v) => live({ gainDb: v })} onCommit={() => commit('Clip volume')} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs">Fade in <span className="font-mono text-slate-400">{Math.round(region.fadeIn * msPerTick)} ms</span></div>
          <Slider label="Fade in" className="w-full" min={0} max={Math.min(fadeMax, PPQ * 16)} step={PPQ / 32} value={region.fadeIn} defaultValue={0} onChange={(v) => live({ fadeIn: Math.min(v, region.length - region.fadeOut) })} onCommit={() => commit('Fade in')} />
        </div>
        <div>
          <div className="text-xs">Fade out <span className="font-mono text-slate-400">{Math.round(region.fadeOut * msPerTick)} ms</span></div>
          <Slider label="Fade out" className="w-full" min={0} max={Math.min(fadeMax, PPQ * 16)} step={PPQ / 32} value={region.fadeOut} defaultValue={0} onChange={(v) => live({ fadeOut: Math.min(v, region.length - region.fadeIn) })} onCommit={() => commit('Fade out')} />
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="mb-1 text-xs text-slate-300">Follow song tempo</legend>
        {(
          [
            ['sync', 'Stretch (keep pitch)', 'Changes speed to match the song tempo. The pitch stays the same.'],
            ['resample', 'Tape speed (pitch changes)', 'Speeds up or slows down like a record. Faster = higher pitch.'],
            ['off', 'Off (original speed)', 'Plays at the speed it was recorded.'],
          ] as [StretchMode, string, string][]
        ).map(([mode, label, help]) => (
          <label key={mode} className="flex items-start gap-2 text-xs" title={help}>
            <input type="radio" name={`stretch-${region.id}`} className="mt-0.5 accent-amber-400" checked={region.stretch === mode} disabled={mode !== 'off' && !asset?.originalBpm} onChange={() => update('Stretch mode', { stretch: mode })} />
            <span>
              {label}
              {mode !== 'off' && !asset?.originalBpm && <span className="text-slate-500"> (needs a loop with a known tempo)</span>}
            </span>
          </label>
        ))}
        {asset?.originalBpm && region.stretch !== 'off' && (
          <p className={cx('text-xs', extreme ? 'text-rose-300' : 'text-slate-400')}>
            {extreme && <AlertTriangle size={12} className="mr-1 inline" />}
            Recorded at {asset.originalBpm} BPM → playing at {bpm} BPM ({Math.round(rate * 100)}% speed){extreme ? '. That is a big change; it may sound rough.' : ''}
          </p>
        )}
      </fieldset>
      {region.stretch !== 'resample' && (
        <div>
          <div className="flex justify-between text-xs">
            <span>Pitch (semitones)</span>
            <span className="font-mono text-slate-400">{region.pitchSemitones > 0 ? '+' : ''}{region.pitchSemitones}</span>
          </div>
          <Slider label="Pitch in semitones" className="w-full" min={-12} max={12} step={1} value={region.pitchSemitones} defaultValue={0} onChange={(v) => live({ pitchSemitones: Math.round(v) })} onCommit={() => commit('Change pitch')} />
        </div>
      )}
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" className="accent-amber-400" checked={region.reversed} onChange={() => update('Reverse', { reversed: !region.reversed })} />
        Reverse (play backwards)
      </label>
      {asset && (
        <p className="text-[11px] leading-snug text-slate-500">
          Source: {asset.name} · {asset.durationSec.toFixed(2)} s · {asset.channels === 1 ? 'mono' : 'stereo'} · {asset.sampleRate} Hz
          {asset.ref.kind === 'library' ? ` · library loop (license: ${asset.license ?? 'see library'})` : ' · saved on this computer'}
        </p>
      )}
    </div>
  );
}
