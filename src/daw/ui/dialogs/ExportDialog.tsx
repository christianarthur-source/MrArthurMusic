import { useRef, useState } from 'react';
import { analyse, defaultRange, downloadBlob, renderProject, RenderCancelled, safeFileName, toWavBlob, trimTail } from '../../export/render';
import { barToTick, formatSeconds, tickToBarBeat, ticksToSeconds } from '../../model/time';
import { projectToArchive, projectToJson } from '../../persistence/projectRepo';
import { exportMidi } from '../actions';
import { Modal, ProgressBar } from '../controls';
import { useProject, useStudio } from '../studio';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const project = useProject((p) => p);
  const def = defaultRange(project);
  const [fromBar, setFromBar] = useState(tickToBarBeat(project.timeSigMap, def.fromTick).bar);
  const [toBar, setToBar] = useState(Math.max(tickToBarBeat(project.timeSigMap, def.toTick - 1).bar + 1, 2));
  const [sampleRate, setSampleRate] = useState(44100);
  const [bits, setBits] = useState<16 | 24>(16);
  const [tail, setTail] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fromTick = barToTick(project.timeSigMap, fromBar);
  const toTick = barToTick(project.timeSigMap, toBar);
  const seconds = ticksToSeconds(project.tempoMap, toTick) - ticksToSeconds(project.tempoMap, fromTick);

  const run = async () => {
    setResult(null);
    setWarn(null);
    if (toTick <= fromTick) {
      setWarn('The end bar must be after the start bar.');
      return;
    }
    abort.current = new AbortController();
    setProgress(0);
    try {
      s.engine.pause();
      const problems = await s.engine.prepare(project);
      if (problems.length) setWarn(`Some audio is missing and will be silent: ${problems.join('; ')}`);
      const buf = await renderProject(project, s.engine.assets, s.engine.instruments, {
        fromTick,
        toTick,
        sampleRate,
        tailSec: tail ? 4 : 0,
        signal: abort.current.signal,
        onProgress: setProgress,
      });
      const minFrames = Math.round(seconds * sampleRate);
      const channels = tail ? trimTail(buf, minFrames) : Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c).slice(0, minFrames));
      const a = analyse(buf);
      const blob = toWavBlob(channels, sampleRate, bits);
      downloadBlob(blob, safeFileName(project.title, 'wav'));
      const dur = channels[0].length / sampleRate;
      const notes = [`Saved ${safeFileName(project.title, 'wav')} — ${formatSeconds(dur)} long, ${(blob.size / 1048576).toFixed(1)} MB, peak ${a.peakDb.toFixed(1)} dBFS.`];
      if (a.silent) notes.push('Warning: the export is silent. Are all tracks muted?');
      if (a.clippedSamples > 0) notes.push(`Warning: ${a.clippedSamples} samples hit full scale. Turn the master or loud tracks down a little.`);
      if (Math.abs(dur - seconds) > 0.01 && !tail) notes.push(`Note: length ${dur.toFixed(3)} s differs from range ${seconds.toFixed(3)} s.`);
      setResult(notes.join(' '));
    } catch (err) {
      if (err instanceof RenderCancelled) setResult('Export cancelled.');
      else setWarn(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const downloadProject = async (zip: boolean) => {
    try {
      if (zip) downloadBlob(await projectToArchive(project), safeFileName(project.title, 'mrdaw.zip'));
      else downloadBlob(new Blob([projectToJson(project)], { type: 'application/json' }), safeFileName(project.title, 'mrdaw.json'));
    } catch (err) {
      setWarn(err instanceof Error ? err.message : String(err));
    }
  };

  const hasUserAudio = Object.values(project.assets).some((a) => a.ref.kind === 'user');

  return (
    <Modal title="Export & download" onClose={() => (abort.current ? abort.current.abort() : onClose())}>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-200">🎧 Audio file (WAV)</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1 text-slate-300">
            From bar
            <input type="number" min={1} value={fromBar} onChange={(e) => setFromBar(Math.max(1, Number(e.target.value)))} className="rounded-lg bg-slate-800 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-slate-300">
            To bar (end, not included)
            <input type="number" min={2} value={toBar} onChange={(e) => setToBar(Math.max(2, Number(e.target.value)))} className="rounded-lg bg-slate-800 px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1 text-slate-300">
            Sample rate
            <select value={sampleRate} onChange={(e) => setSampleRate(Number(e.target.value))} className="rounded-lg bg-slate-800 px-2 py-1">
              <option value={44100}>44.1 kHz (CD quality)</option>
              <option value={48000}>48 kHz (video)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-slate-300">
            Bit depth
            <select value={bits} onChange={(e) => setBits(Number(e.target.value) as 16 | 24)} className="rounded-lg bg-slate-800 px-2 py-1">
              <option value={16}>16-bit (smaller, plays everywhere)</option>
              <option value={24}>24-bit (studio)</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" className="accent-amber-400" checked={tail} onChange={(e) => setTail(e.target.checked)} />
          Let echoes and reverb ring out at the end
        </label>
        <p className="text-xs text-slate-500">
          Length: {formatSeconds(seconds)} · about {((seconds * sampleRate * 2 * (bits / 8)) / 1048576).toFixed(1)} MB. MP3 export is not available yet (see the project docs); WAV files can be uploaded or converted anywhere.
        </p>
        {progress !== null ? (
          <div className="space-y-2">
            <ProgressBar progress={progress} label="Exporting your song…" />
            <button type="button" className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" data-testid="export-wav" className="rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300" onClick={() => void run()}>
            Export WAV
          </button>
        )}
        {result && <p className="rounded-lg bg-emerald-500/10 p-2 text-sm text-emerald-200" role="status">{result}</p>}
        {warn && <p className="rounded-lg bg-rose-500/10 p-2 text-sm text-rose-200" role="alert">{warn}</p>}
      </section>
      <hr className="my-4 border-slate-800" />
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-slate-200">💾 Project file (to open later or on another computer)</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => void downloadProject(true)}>
            Download project + my recordings (.zip)
          </button>
          <button type="button" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => void downloadProject(false)}>
            Project only (.json)
          </button>
          <button type="button" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm hover:bg-slate-700" onClick={() => exportMidi(s)}>
            MIDI notes (.mid)
          </button>
        </div>
        {hasUserAudio && <p className="text-xs text-slate-500">Your song has recordings or imported audio. Use the .zip to bring them along — the .json file only contains library loops and notes.</p>}
      </section>
    </Modal>
  );
}
