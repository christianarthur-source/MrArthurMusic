import { useCallback, useEffect, useMemo, useState } from 'react';
import { listInputs, InputDevice } from '../../engine/recorder';
import { AUDIO_CACHE_NAME } from '../../engine/assets';
import { collectUnusedAudio } from '../../persistence/projectRepo';
import { storageEstimate } from '../../persistence/idb';
import { prepareRecording, recordOffsetMs } from '../actions';
import { Meter, Modal } from '../controls';
import { useStudio } from '../studio';

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['Home or Enter', 'Back to start'],
  ['R', 'Record (microphone, or notes on a selected instrument track)'],
  ['L', 'Loop on/off (loops the selected clips)'],
  ['K', 'Metronome'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Undo / redo'],
  ['Ctrl+C / X / V', 'Copy / cut / paste (at the playhead)'],
  ['Ctrl+D', 'Duplicate selected clips'],
  ['S', 'Split clips at the playhead'],
  ['Delete / Backspace', 'Delete selected clips or notes'],
  ['Ctrl+A', 'Select all clips'],
  ['← / →', 'Nudge selected clips by the grid'],
  ['V / B / P', 'Select / split / draw tool'],
  ['G', 'Snap to grid on/off'],
  ['- / =', 'Zoom out / in (or Ctrl+mouse wheel)'],
  ['F', 'Fit the song to the window'],
  ['Q', 'Quantize notes'],
  ['M / X / I', 'Mixer / editor / clip & effects panel'],
  ['N or Ctrl+K', 'On-screen piano keyboard'],
  ['Ctrl+S', 'Save'],
  ['Ctrl+E', 'Export'],
  ['A–L row (with the keyboard or note editor open)', 'Play notes on the computer keyboard (Z / X change octave)'],
  ['MIDI keyboard', 'Plug in any USB/Bluetooth MIDI keyboard or pad (Chrome/Edge); sustain pedal and Start/Stop buttons work'],
  ['?', 'Show this list'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose}>
      <table className="w-full text-sm">
        <tbody>
          {SHORTCUTS.map(([k, v]) => (
            <tr key={k} className="border-b border-slate-800">
              <td className="py-1.5 pr-3 font-mono text-xs text-amber-300">{k}</td>
              <td className="py-1.5 text-slate-300">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

export function RecordDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [device, setDevice] = useState<string>(s.recorder.deviceId ?? '');
  const [open, setOpen] = useState(s.recorder.isOpen);
  const [offset, setOffset] = useState(recordOffsetMs());
  const [monitor, setMonitor] = useState(false);
  const buf = useMemo(() => new Float32Array(1024), []);
  const read = useCallback(() => s.recorder.level(buf), [s, buf]);

  const connect = async (id?: string) => {
    const ok = await prepareRecording(s, id || undefined);
    setOpen(ok);
    if (ok) setDevices(await listInputs());
  };
  useEffect(() => {
    void listInputs().then(setDevices);
  }, []);
  useEffect(() => () => s.recorder.setMonitor(null), [s]);

  return (
    <Modal title="Recording setup" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        <p>
          To record your voice or an instrument, the browser needs permission to use the microphone. Nothing is uploaded: recordings are saved on this computer
          (and inside a .zip if you download your project).
        </p>
        {!open ? (
          <button type="button" className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white" onClick={() => void connect(device)}>
            🎤 Turn on microphone
          </button>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              Input
              <select
                className="rounded-lg bg-slate-800 px-2 py-1"
                value={device}
                onChange={(e) => {
                  setDevice(e.target.value);
                  void connect(e.target.value);
                }}
              >
                <option value="">Default microphone</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1 text-xs text-slate-400">Input level — sing or play: the bar should move but not turn red.</div>
              <Meter read={read} className="h-3" />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-amber-400"
                checked={monitor}
                onChange={(e) => {
                  setMonitor(e.target.checked);
                  const armed = s.store.get().tracks.find((t) => t.arm && t.kind === 'audio');
                  s.recorder.setMonitor(e.target.checked ? (s.engine.graph.strip(armed?.id ?? '')?.input ?? s.engine.graph.masterIn) : null);
                }}
              />
              Hear myself while recording (headphones only! Speakers will squeal)
            </label>
            <label className="flex flex-col gap-1">
              Timing adjustment: {offset} ms
              <input
                type="range"
                className="daw-range"
                min={-200}
                max={200}
                step={5}
                value={offset}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setOffset(v);
                  try {
                    localStorage.setItem('mrdaw.recordOffsetMs', String(v));
                  } catch {
                    /* per-session only */
                  }
                }}
              />
              <span className="text-xs text-slate-500">
                If your recordings land a little late, move this to the right; early, to the left. The studio already corrects for the delay the browser reports ({Math.round(((s.engine.ctx.outputLatency || s.engine.ctx.baseLatency || 0) + s.recorder.inputLatency()) * 1000)} ms).
              </span>
            </label>
            <p className="text-xs text-slate-500">Arm an audio track (● button), then press Record. You will hear a one-bar count-in first.</p>
          </>
        )}
      </div>
    </Modal>
  );
}

export function StorageDialog({ onClose }: { onClose: () => void }) {
  const s = useStudio();
  const [est, setEst] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = useCallback(() => {
    void storageEstimate().then(setEst);
  }, []);
  useEffect(refresh, [refresh]);
  const mem = s.engine.assets.memoryUsage();
  const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  return (
    <Modal title="Storage on this computer" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-300">
        {est ? (
          <p>
            The studio is using <b>{mb(est.usage)}</b> of about {mb(est.quota)} available for this site.
            {!est.persisted && ' The browser may clear this space if the computer runs low on storage, so download important songs as .zip files.'}
          </p>
        ) : (
          <p>Storage information is not available in this browser.</p>
        )}
        <p>
          In memory right now: {mb(mem.decoded)} of decoded audio ({mem.decodedCount} sounds), {mb(mem.processed)} of tempo-fitted audio.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
            onClick={async () => {
              await caches.delete(AUDIO_CACHE_NAME).catch(() => false);
              setMsg('Downloaded loops were cleared. They will download again when needed.');
              refresh();
            }}
          >
            Clear downloaded loops
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
            onClick={async () => {
              const freed = await collectUnusedAudio();
              setMsg(`Removed ${mb(freed)} of recordings not used by any saved song.`);
              refresh();
            }}
          >
            Remove unused recordings
          </button>
          {navigator.storage?.persist && est && !est.persisted && (
            <button
              type="button"
              className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
              onClick={async () => {
                const ok = await navigator.storage.persist();
                setMsg(ok ? 'Storage is now protected from automatic clearing.' : 'The browser did not allow protected storage.');
                refresh();
              }}
            >
              Ask browser to keep my songs
            </button>
          )}
        </div>
        {msg && <p className="text-emerald-300">{msg}</p>}
      </div>
    </Modal>
  );
}
