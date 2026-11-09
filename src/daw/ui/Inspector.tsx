import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { audioPlayback } from '../engine/scheduler';
import * as ops from '../model/ops';
import { secondsPerTick } from '../model/time';
import { AudioRegion, PPQ, Region, StretchMode } from '../model/types';
import { cx, EditableText, fmtDb, Slider } from './controls';
import { EffectsChain } from './Effects';
import { applyVoice, makeSampler, VoicePreset } from './actions';
import { useProject, useStudio, useUi } from './studio';

/**
 * Bottom panel "Clip & Effects". Two views, so nothing needs scrolling on a short Chromebook
 * screen: Clip (a header row plus side-by-side cards) and Effects (the track's effect chain).
 * Selecting a clip shows its Clip view; selecting just a track shows its effects.
 */
export function Inspector() {
  const s = useStudio();
  const selected = useUi((u) => u.selectedRegions);
  const trackId = useUi((u) => u.selectedTrack);
  const project = useProject((p) => p);
  const region = selected.length === 1 ? project.regions.find((r) => r.id === selected[0]) : undefined;
  const track = project.tracks.find((t) => t.id === (region?.trackId ?? trackId));
  const [view, setView] = useState<'clip' | 'effects'>(region ? 'clip' : 'effects');
  // Follow the selection: a newly selected clip shows its settings, a track alone shows effects.
  const regionId = region?.id ?? null;
  useEffect(() => setView(regionId ? 'clip' : 'effects'), [regionId]);
  const fxCount = track ? track.effects.length : project.master.effects.length;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 px-3 py-1.5" role="tablist" aria-label="Clip or effects">
        <TabButton active={view === 'clip'} onClick={() => setView('clip')} testId="inspector-clip">
          🎚️ Clip{region ? <span className="font-normal text-slate-400"> · {region.name}</span> : selected.length > 1 ? <span className="font-normal text-slate-400"> · {selected.length} clips</span> : null}
        </TabButton>
        <TabButton active={view === 'effects'} onClick={() => setView('effects')} testId="inspector-effects">
          ✨ Effects<span className="font-normal text-slate-400"> · {track ? track.name : 'Master'}{fxCount ? ` (${fxCount})` : ''}</span>
        </TabButton>
        {view === 'effects' && track && (
          <button type="button" className="ml-auto text-xs text-slate-400 underline hover:text-white" onClick={() => s.ui.set({ selectedTrack: null, selectedRegions: [] })}>
            Edit master effects
          </button>
        )}
      </div>
      <div className="daw-scroll min-h-0 flex-1 overflow-auto p-3">
        {view === 'clip' ? (
          region ? (
            <RegionProps region={region} />
          ) : (
            <p className="text-sm text-slate-400">
              {selected.length > 1 ? `${selected.length} clips selected. Drag to move them together, or press Ctrl+D to duplicate.` : 'Click a clip on the timeline to change its volume, fades, tempo, pitch and voice.'}
            </p>
          )
        ) : (
          <div aria-label="Track effects">
            {track ? <EffectsChain owner={{ trackId: track.id }} effects={track.effects} /> : <EffectsChain owner="master" effects={project.master.effects} />}
            {!track && <p className="mt-2 text-xs text-slate-500">Select a track to edit its effects. With no track selected you are editing the Master (the whole song).</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: React.ReactNode; testId: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={cx('max-w-[22rem] truncate rounded-lg px-3 py-1 text-sm font-semibold', active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')}
    >
      {children}
    </button>
  );
}

/** A titled box in the Clip view; cards sit side by side and wrap on narrow screens. */
function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-[12rem] flex-1 space-y-2 rounded-xl bg-slate-800/50 p-2.5 ring-1 ring-slate-800', className)} aria-label={title}>
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h4>
      {children}
    </section>
  );
}

const CLIP_COLORS = ['#F59E0B', '#EC4899', '#38BDF8', '#10B981', '#8B5CF6', '#F43F5E', '#06B6D4', '#A3E635'];

function RegionProps({ region }: { region: Region }) {
  const s = useStudio();
  const update = (label: string, patch: Partial<Region>, key?: string) => s.store.exec(label, (p) => ops.updateRegion(p, region.id, patch), key);
  const live = (patch: Partial<Region>) => {
    s.store.beginGesture();
    s.store.preview((p) => ops.updateRegion(p, region.id, patch));
  };
  const commit = (label: string) => s.store.commitGesture(label);
  const bars = (t: number) => +(t / (PPQ * 4)).toFixed(2);
  return (
    <div className="space-y-2.5 text-sm">
      {/* Header: name, where it is, loop, color, and the main actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <EditableText label="Clip name" value={region.name} className="max-w-[16rem] text-base font-semibold text-slate-100" onCommit={(v) => update('Rename clip', { name: v.slice(0, 60) })} />
        <span className="font-mono text-xs text-slate-400">
          bar {bars(region.start) + 1} · {bars(region.length)} bar{bars(region.length) === 1 ? '' : 's'}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-slate-300" title="Repeat the clip when you stretch its right edge">
          <input type="checkbox" className="accent-amber-400" checked={region.loop} onChange={() => update('Toggle clip loop', { loop: !region.loop })} />
          Loop
        </label>
        <div className="flex gap-1" role="group" aria-label="Clip color">
          {CLIP_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Clip color ${c}`} className={cx('h-4 w-4 rounded-full ring-1', region.color === c ? 'ring-2 ring-white' : 'ring-black/40')} style={{ background: c }} onClick={() => update('Clip color', { color: c })} />
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          {region.kind === 'audio' && (
            <button
              type="button"
              data-testid="make-sampler"
              className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300"
              title="Make an instrument from this sound: play it on the computer keys, on-screen piano or in the note editor"
              onClick={() => makeSampler(s, region.id)}
            >
              🎹 Play this sound on keys
            </button>
          )}
          {region.kind === 'midi' && (
            <button type="button" className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-amber-300" onClick={() => s.ui.set({ editRegion: region.id, bottom: 'editor' })}>
              ✏️ Edit {region.notes.length} notes
            </button>
          )}
        </div>
      </div>
      {region.kind === 'audio' && <AudioProps region={region} live={live} commit={commit} update={update} />}
    </div>
  );
}

const STRETCH_MODES: [StretchMode, string, string][] = [
  ['sync', 'Stretch', 'Changes speed to match the song tempo. The pitch stays the same.'],
  ['resample', 'Tape', 'Speeds up or slows down like a record. Faster = higher pitch.'],
  ['off', 'Off', 'Plays at the speed it was recorded.'],
];

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
    <>
      <div className="flex flex-wrap gap-2.5">
        <Card title="Volume & fades">
          <div>
            <div className="flex justify-between text-xs">
              <span>Volume</span>
              <span className="font-mono text-slate-400">{fmtDb(region.gainDb)}</span>
            </div>
            <Slider label="Clip volume" className="w-full" min={-24} max={12} step={0.5} value={region.gainDb} defaultValue={0} format={fmtDb} onChange={(v) => live({ gainDb: v })} onCommit={() => commit('Clip volume')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs">In <span className="font-mono text-slate-400">{Math.round(region.fadeIn * msPerTick)} ms</span></div>
              <Slider label="Fade in" className="w-full" min={0} max={Math.min(fadeMax, PPQ * 16)} step={PPQ / 32} value={region.fadeIn} defaultValue={0} onChange={(v) => live({ fadeIn: Math.min(v, region.length - region.fadeOut) })} onCommit={() => commit('Fade in')} />
            </div>
            <div>
              <div className="text-xs">Out <span className="font-mono text-slate-400">{Math.round(region.fadeOut * msPerTick)} ms</span></div>
              <Slider label="Fade out" className="w-full" min={0} max={Math.min(fadeMax, PPQ * 16)} step={PPQ / 32} value={region.fadeOut} defaultValue={0} onChange={(v) => live({ fadeOut: Math.min(v, region.length - region.fadeIn) })} onCommit={() => commit('Fade out')} />
            </div>
          </div>
        </Card>
        <Card title="Follow song tempo">
          <div className="flex rounded-lg bg-slate-900 p-0.5" role="radiogroup" aria-label="Follow song tempo">
            {STRETCH_MODES.map(([mode, label, help]) => {
              const disabled = mode !== 'off' && !asset?.originalBpm;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={region.stretch === mode}
                  disabled={disabled}
                  title={disabled ? `${help} (needs a loop with a known tempo)` : help}
                  onClick={() => update('Stretch mode', { stretch: mode })}
                  className={cx('flex-1 rounded-md px-2 py-1 text-xs disabled:opacity-35', region.stretch === mode ? 'bg-slate-600 font-semibold text-white' : 'text-slate-300 hover:text-white')}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className={cx('text-xs leading-snug', extreme ? 'text-rose-300' : 'text-slate-400')}>
            {extreme && <AlertTriangle size={12} className="mr-1 inline" />}
            {asset?.originalBpm && region.stretch !== 'off'
              ? `${asset.originalBpm} → ${bpm} BPM (${Math.round(rate * 100)}% speed)${extreme ? '. Big change; may sound rough.' : ''}`
              : asset?.originalBpm
                ? 'Plays at its own speed.'
                : 'Recordings play at their own speed.'}
          </p>
        </Card>
        <Card title="Pitch & direction">
          {region.stretch !== 'resample' ? (
            <div>
              <div className="flex justify-between text-xs">
                <span>Pitch</span>
                <span className="font-mono text-slate-400">{region.pitchSemitones > 0 ? '+' : ''}{region.pitchSemitones} semitones</span>
              </div>
              <Slider label="Pitch in semitones" className="w-full" min={-12} max={12} step={1} value={region.pitchSemitones} defaultValue={0} onChange={(v) => live({ pitchSemitones: Math.round(v) })} onCommit={() => commit('Change pitch')} />
            </div>
          ) : (
            <p className="text-xs text-slate-400">In Tape mode the tempo sets the pitch.</p>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-amber-400" checked={region.reversed} onChange={() => update('Reverse', { reversed: !region.reversed })} />
            Reverse (play backwards)
          </label>
        </Card>
        <Card title="Voice changer" className="min-w-[15rem]">
          <VoiceChanger region={region} />
        </Card>
      </div>
      {asset && (
        <p className="text-[11px] leading-snug text-slate-500">
          Source: {asset.name} · {asset.durationSec.toFixed(2)} s · {asset.channels === 1 ? 'mono' : 'stereo'} · {asset.sampleRate} Hz
          {asset.key ? ` · key ${asset.key}` : ''}
          {asset.ref.kind === 'library' ? ` · library loop (license: ${asset.license ?? 'see library'})` : ' · saved on this computer'}
        </p>
      )}
    </>
  );
}

const VOICES: { id: VoicePreset; label: string; help: string }[] = [
  { id: 'normal', label: '🙂 Normal', help: 'Original pitch, robot off' },
  { id: 'chipmunk', label: '🐿️ Chipmunk', help: 'Higher and squeaky (up 7)' },
  { id: 'giant', label: '👹 Giant', help: 'Lower and deep (down 7)' },
  { id: 'robot', label: '🤖 Robot', help: 'Adds the Robot effect to this track' },
  { id: 'radio', label: '📻 Radio', help: 'Thin, old-radio sound on this track' },
];

function VoiceChanger({ region }: { region: AudioRegion }) {
  const s = useStudio();
  const robotOn = useProject((p) => !!p.tracks.find((t) => t.id === region.trackId)?.effects.some((fx) => fx.type === 'robot' && !fx.bypass));
  const active: VoicePreset | null = robotOn ? 'robot' : region.pitchSemitones === 7 ? 'chipmunk' : region.pitchSemitones === -7 ? 'giant' : null;
  return (
    <div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Voice changer">
        {VOICES.map((v) => (
          <button
            key={v.id}
            type="button"
            title={v.help}
            aria-pressed={active === v.id}
            onClick={() => applyVoice(s, region.id, v.id)}
            className={cx('rounded-md px-2 py-1 text-xs', active === v.id ? 'bg-amber-400 font-semibold text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700')}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
