import { CatalogEntry } from '../library/catalogTypes';
import { createAudioRegion, createMidiRegion, newId } from '../model/factory';
import * as ops from '../model/ops';
import { gridTicks, secondsToTicks, snapTick, ticksPerBar, ticksToSeconds } from '../model/time';
import { AudioAssetInfo, MidiNote, PPQ, Project, Region } from '../model/types';
import { parseMidi, rescaleToPpq, writeMidi, SmfFile } from '../midi/smf';
import { encodeWav } from '../dsp/wav';
import { saveUserAudio } from '../persistence/projectRepo';
import { RecorderError } from '../engine/recorder';
import { downloadBlob, safeFileName } from '../export/render';
import { Studio } from './studio';

/**
 * Central command layer. Keyboard shortcuts, menus, toolbar buttons and
 * context menus all call these functions, so behaviour (and undo) is identical.
 */

const MAX_IMPORT_BYTES = 80 * 1024 * 1024;
const AUDIO_EXT = /\.(wav|mp3|ogg|oga|m4a|aac|flac|webm|aif|aiff)$/i;
const MIDI_EXT = /\.(mid|midi)$/i;

export function snap(s: Studio, tick: number, mode: 'round' | 'floor' = 'round'): number {
  const p = s.store.get();
  return p.editor.snap ? snapTick(tick, gridTicks(p.editor.grid), mode) : Math.round(tick);
}

const bar = (p: Project) => ticksPerBar(p.timeSigMap[0].sig);

// ------------------------------------------------------------------ transport

export function togglePlay(s: Studio) {
  if (s.engine.state === 'playing') {
    if (s.ui.get().recording) void stopRecording(s);
    else s.engine.pause();
  } else {
    s.preview.stop();
    void s.engine.unlock();
    s.engine.play();
  }
}

export function stop(s: Studio) {
  if (s.ui.get().recording) void stopRecording(s);
  s.engine.stop();
}

export function returnToStart(s: Studio) {
  s.engine.seek(s.store.get().loop.enabled ? s.store.get().loop.start : 0);
}

export function toggleLoop(s: Studio) {
  s.store.exec('Toggle loop', (p) => {
    let loop = { ...p.loop, enabled: !p.loop.enabled };
    const sel = p.regions.filter((r) => s.ui.get().selectedRegions.includes(r.id));
    if (loop.enabled && sel.length) {
      loop = { enabled: true, start: Math.min(...sel.map((r) => r.start)), end: Math.max(...sel.map((r) => r.start + r.length)) };
    }
    return { ...p, loop };
  });
}

export function toggleMetronome(s: Studio) {
  s.store.exec('Metronome', (p) => ({ ...p, editor: { ...p.editor, metronome: !p.editor.metronome } }));
}

export function setTempo(s: Studio, bpm: number) {
  if (!Number.isFinite(bpm)) return;
  s.store.exec('Change tempo', (p) => ops.setTempo(p, bpm), 'tempo');
}

const taps: number[] = [];
export function tapTempo(s: Studio) {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(now);
  if (taps.length > 6) taps.shift();
  if (taps.length >= 3) {
    const gaps = taps.slice(1).map((t, i) => t - taps[i]);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    setTempo(s, Math.round(60000 / avg));
  }
}

export function setTimeSig(s: Studio, num: number, den: number) {
  s.store.exec('Change time signature', (p) => ops.setTimeSignature(p, num, den));
}

// ------------------------------------------------------------------ selection & edit

export function selectedRegions(s: Studio): Region[] {
  const ids = new Set(s.ui.get().selectedRegions);
  return s.store.get().regions.filter((r) => ids.has(r.id));
}

export function undo(s: Studio) {
  const label = s.store.undoLabel();
  if (s.store.undo()) s.ui.toast('info', `Undid: ${label}`);
}
export function redo(s: Studio) {
  const label = s.store.redoLabel();
  if (s.store.redo()) s.ui.toast('info', `Redid: ${label}`);
}

export function deleteSelection(s: Studio) {
  const ids = s.ui.get().selectedRegions;
  if (!ids.length) return;
  s.store.exec(ids.length > 1 ? `Delete ${ids.length} clips` : 'Delete clip', (p) => ops.removeRegions(p, ids));
  s.ui.set({ selectedRegions: [] });
}

export function copy(s: Studio) {
  const c = ops.copyRegions(s.store.get(), s.ui.get().selectedRegions);
  if (c) s.clipboard = c;
  return !!c;
}

export function cut(s: Studio) {
  if (copy(s)) deleteSelection(s);
}

export function paste(s: Studio) {
  const clip = s.clipboard;
  if (!clip) return;
  const at = snap(s, s.engine.currentTick(), 'floor');
  let created: string[] = [];
  s.store.exec('Paste', (p) => {
    const r = ops.pasteRegions(p, clip, at, s.ui.get().selectedTrack ?? undefined);
    created = r.created;
    return r.project;
  });
  s.ui.set({ selectedRegions: created });
}

export function duplicate(s: Studio) {
  let created: string[] = [];
  s.store.exec('Duplicate', (p) => {
    const r = ops.duplicateRegions(p, s.ui.get().selectedRegions);
    created = r.created;
    return r.project;
  });
  if (created.length) s.ui.set({ selectedRegions: created });
}

export function splitAtPlayhead(s: Studio) {
  const tick = Math.round(s.engine.currentTick());
  const p = s.store.get();
  let ids = s.ui.get().selectedRegions;
  if (!ids.length) ids = p.regions.filter((r) => r.start < tick && tick < r.start + r.length).map((r) => r.id);
  splitAt(s, ids, tick);
}

export function splitAt(s: Studio, ids: string[], tick: number) {
  if (!ids.length) return;
  s.store.exec('Split', (p) => ops.splitRegions(p, ids, tick).project);
}

export function selectAll(s: Studio) {
  s.ui.set({ selectedRegions: s.store.get().regions.map((r) => r.id) });
}

export function merge(s: Studio) {
  const r = ops.mergeMidiRegions(s.store.get(), s.ui.get().selectedRegions);
  if (r.error) {
    s.ui.toast('warn', r.error);
    return;
  }
  s.store.exec('Merge clips', () => r.project);
  s.ui.set({ selectedRegions: r.merged ? [r.merged] : [] });
}

export function nudge(s: Studio, dir: -1 | 1) {
  const ids = s.ui.get().selectedRegions;
  if (!ids.length) return;
  const g = gridTicks(s.store.get().editor.grid);
  s.store.exec('Nudge', (p) => ops.moveRegions(p, ids, dir * g, 0), 'nudge');
}

export function quantizeSelection(s: Studio) {
  const p = s.store.get();
  const ids = s.ui.get().editRegion ? [s.ui.get().editRegion!] : s.ui.get().selectedRegions;
  const g = gridTicks(p.editor.grid);
  const midi = p.regions.filter((r) => ids.includes(r.id) && r.kind === 'midi');
  if (!midi.length) {
    s.ui.toast('info', 'Select a MIDI clip to quantize its notes.');
    return;
  }
  const notes = s.ui.get().selectedNotes;
  s.store.exec('Quantize', (proj) => midi.reduce((acc, r) => ops.quantizeRegionNotes(acc, r.id, g, notes.length ? notes : undefined), proj));
}

export function zoom(s: Studio, factor: number, anchorPx?: number) {
  const p = s.store.get();
  const old = p.editor.pxPerBeat;
  const next = Math.min(400, Math.max(4, old * factor));
  if (next === old) return;
  const ui = s.ui.get();
  const anchor = anchorPx ?? ui.timelineWidth / 2;
  const beatAtAnchor = (ui.scrollX + anchor) / old;
  // Zoom is a view setting: saved with the project but not an undo step.
  s.store.preview((x) => ({ ...x, editor: { ...x.editor, pxPerBeat: next } }));
  s.store.commitGesture('Zoom');
  s.ui.set({ scrollX: Math.max(0, beatAtAnchor * next - anchor) });
}

export function fitProject(s: Studio) {
  const p = s.store.get();
  const end = Math.max(ops.projectEndTick(p), bar(p) * 8);
  const width = s.ui.get().timelineWidth - 40;
  const ppb = Math.min(400, Math.max(4, (width / end) * PPQ));
  s.store.preview((x) => ({ ...x, editor: { ...x.editor, pxPerBeat: ppb } }));
  s.store.commitGesture('Fit');
  s.ui.set({ scrollX: 0 });
}

// ------------------------------------------------------------------ tracks

export function addTrack(s: Studio, kind: 'audio' | 'instrument', instrumentId?: string, name?: string) {
  let id = '';
  s.store.exec('Add track', (p) => {
    const r = ops.addTrack(p, kind, name, instrumentId);
    id = r.track.id;
    return r.project;
  });
  s.ui.set({ selectedTrack: id });
  return id;
}

export function removeTrack(s: Studio, trackId: string) {
  const t = s.store.get().tracks.find((x) => x.id === trackId);
  if (!t) return;
  s.store.exec(`Delete track "${t.name}"`, (p) => ops.removeTracks(p, [trackId]));
  s.ui.toast('info', `Deleted "${t.name}".`, { label: 'Undo', run: () => undo(s) });
}

// ------------------------------------------------------------------ library loops

export function loopAssetInfo(e: CatalogEntry): AudioAssetInfo {
  return {
    id: `lib:${e.id}`,
    ref: { kind: 'library', assetId: e.id, version: e.version },
    name: e.name,
    durationSec: e.durationSec,
    sampleRate: e.sampleRate,
    channels: e.channels,
    originalBpm: e.oneShot ? undefined : e.bpm,
    bars: e.bars,
    key: e.key,
    license: e.license.id,
    attribution: e.license.attribution,
  };
}

/** Region length for a loop at the project tempo, in ticks. */
export function loopTicks(p: Project, e: CatalogEntry): { length: number; synced: boolean } {
  if (!e.oneShot && e.bpm) {
    const beats = e.bars ? e.bars * e.timeSig[0] * (4 / e.timeSig[1]) : Math.max(1, Math.round((e.durationSec * e.bpm) / 60));
    return { length: Math.round(beats * PPQ), synced: true };
  }
  return { length: Math.max(PPQ / 8, Math.round(secondsToTicks(p.tempoMap, e.durationSec))), synced: false };
}

/** Add a library loop at `tick` on `trackId` (or a new audio track). Returns the region id. */
export function addLoop(s: Studio, e: CatalogEntry, tick: number, trackId?: string | null): string | null {
  const p0 = s.store.get();
  let target = trackId ? p0.tracks.find((t) => t.id === trackId) : undefined;
  if (target && target.kind !== 'audio') target = undefined;
  const { length, synced } = loopTicks(p0, e);
  const ratio = e.bpm ? p0.tempoMap[0].bpm / e.bpm : 1;
  if (synced && (ratio < 0.5 || ratio > 2)) {
    s.ui.toast('warn', `"${e.name}" was recorded at ${e.bpm} BPM. Stretching it to ${p0.tempoMap[0].bpm} BPM is extreme and may sound rough.`);
  }
  let regionId = '';
  s.store.exec(`Add "${e.name}"`, (p) => {
    let proj = p;
    let tId = target?.id;
    if (!tId) {
      const r = ops.addTrack(proj, 'audio', trackNameFor(e));
      proj = r.project;
      tId = r.track.id;
    }
    const region = createAudioRegion({
      trackId: tId,
      name: e.name,
      start: Math.max(0, Math.round(tick)),
      length,
      loopLength: length,
      loop: !e.oneShot,
      assetId: `lib:${e.id}`,
      stretch: synced ? 'sync' : 'off',
    });
    regionId = region.id;
    return ops.addRegions(proj, [region], [loopAssetInfo(e)]);
  });
  s.ui.set({ selectedRegions: [regionId], selectedTrack: s.store.get().regions.find((r) => r.id === regionId)?.trackId ?? null });
  return regionId;
}

function trackNameFor(e: CatalogEntry): string {
  const n = e.instrument.replace('-', ' ');
  return n.charAt(0).toUpperCase() + n.slice(1);
}

// ------------------------------------------------------------------ import

export async function importFiles(s: Studio, files: File[], tick?: number, trackId?: string | null) {
  for (const f of files) {
    if (MIDI_EXT.test(f.name)) await importMidi(s, f, tick);
    else if (AUDIO_EXT.test(f.name) || f.type.startsWith('audio/')) await importAudio(s, f, tick, trackId);
    else if (f.type.startsWith('video/')) s.ui.toast('info', 'To score a video, use File → Add video…');
    else s.ui.toast('warn', `"${cleanName(f.name)}" is not an audio or MIDI file.`);
  }
}

function cleanName(n: string) {
  // eslint-disable-next-line no-control-regex
  return n.replace(/[\u0000-\u001f<>]/g, '').replace(/\.[^.]+$/, '').slice(0, 60) || 'Audio';
}

export async function importAudio(s: Studio, file: File, tick?: number, trackId?: string | null) {
  const name = cleanName(file.name);
  if (file.size > MAX_IMPORT_BYTES) {
    s.ui.toast('error', `"${name}" is too large (limit 80 MB). Try a shorter clip or an MP3.`);
    return;
  }
  s.ui.set({ task: { label: `Importing "${name}"…`, progress: null } });
  try {
    const bytes = await file.arrayBuffer();
    const buffer = await s.engine.assets.decode(bytes.slice(0), name);
    if (buffer.duration > 15 * 60) throw new Error('Audio longer than 15 minutes is not supported.');
    const assetId = await saveUserAudio(file, file.name);
    const info: AudioAssetInfo = {
      id: `usr:${assetId}`,
      ref: { kind: 'user', assetId },
      name,
      durationSec: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: Math.min(2, buffer.numberOfChannels),
    };
    s.engine.assets.put(info.id, buffer);
    placeUserAudio(s, info, tick ?? snap(s, s.engine.currentTick(), 'floor'), trackId);
    s.ui.toast('success', `Imported "${name}" (${buffer.duration.toFixed(1)} s, ${buffer.numberOfChannels === 1 ? 'mono' : 'stereo'}, ${buffer.sampleRate} Hz).`);
  } catch (err) {
    s.ui.toast('error', err instanceof Error ? err.message : `Could not import "${name}".`);
  } finally {
    s.ui.set({ task: null });
  }
}

function placeUserAudio(s: Studio, info: AudioAssetInfo, tick: number, trackId?: string | null, label = 'Import audio') {
  let regionId = '';
  s.store.exec(label, (p) => {
    let proj = p;
    let tId = trackId && p.tracks.find((t) => t.id === trackId && t.kind === 'audio') ? trackId : undefined;
    if (!tId) {
      const r = ops.addTrack(proj, 'audio', info.name.slice(0, 30));
      proj = r.project;
      tId = r.track.id;
    }
    const length = Math.max(1, Math.round(secondsToTicks(proj.tempoMap, info.durationSec)));
    const region = createAudioRegion({ trackId: tId, name: info.name, start: Math.max(0, Math.round(tick)), length, loopLength: length, assetId: info.id, stretch: 'off' });
    regionId = region.id;
    return ops.addRegions(proj, [region], [info]);
  });
  s.ui.set({ selectedRegions: [regionId] });
}

const GM_DRUM_KIT = 'drum_kit';

export async function importMidi(s: Studio, file: File, tick?: number) {
  const name = cleanName(file.name);
  let smf: SmfFile;
  try {
    smf = rescaleToPpq(parseMidi(await file.arrayBuffer()), PPQ);
  } catch (err) {
    s.ui.toast('error', `"${name}": ${err instanceof Error ? err.message : 'not a valid MIDI file'}`);
    return;
  }
  if (!smf.tracks.length) {
    s.ui.toast('warn', `"${name}" has no notes.`);
    return;
  }
  const at = Math.max(0, Math.round(tick ?? 0));
  const p0 = s.store.get();
  const adoptTempo = p0.regions.length === 0 && smf.tempos.length > 0;
  s.store.exec(`Import MIDI "${name}"`, (p) => {
    let proj = adoptTempo ? ops.setTempo(p, smf.tempos[0].bpm) : p;
    if (adoptTempo && smf.timeSigs[0]) proj = ops.setTimeSignature(proj, smf.timeSigs[0].numerator, smf.timeSigs[0].denominator);
    for (const t of smf.tracks.slice(0, 16)) {
      const inst = t.isDrums ? GM_DRUM_KIT : programToInstrument(t.program);
      const r = ops.addTrack(proj, 'instrument', (t.name || name).slice(0, 30), inst);
      proj = r.project;
      const end = Math.max(...t.notes.map((n) => n.start + n.length));
      const length = Math.ceil(end / bar(proj)) * bar(proj);
      const notes: MidiNote[] = t.notes.map((n) => ({ id: newId('n'), pitch: n.pitch, start: n.start, length: n.length, velocity: n.velocity }));
      proj = ops.addRegions(proj, [createMidiRegion({ trackId: r.track.id, name: (t.name || name).slice(0, 40), start: at, length, loopLength: length, notes })]);
    }
    return proj;
  });
  s.ui.toast('success', `Imported ${Math.min(16, smf.tracks.length)} MIDI track(s) from "${name}"${adoptTempo ? ` at ${smf.tempos[0].bpm} BPM` : ''}.`);
}

/** Map a GM program to the closest sampled instrument from the site's sample set. */
export function programToInstrument(program?: number): string {
  if (program === undefined) return 'piano';
  const table: [number, string][] = [
    [3, 'piano'], [5, 'electric_piano'], [6, 'harpsichord'], [7, 'clavinet'], [8, 'glockenspiel'], [9, 'glockenspiel'],
    [10, 'vibraphone'], [11, 'vibraphone'], [12, 'marimba'], [13, 'xylophone'], [14, 'tubular_bells'], [15, 'dan_tranh'],
    [21, 'organ'], [23, 'harmonica'], [31, 'strumstick'], [39, 'upright_bass'], [40, 'violin'], [41, 'viola'], [42, 'cello'],
    [43, 'double_bass'], [44, 'violin'], [45, 'violin_pizz'], [46, 'harp'], [47, 'drum_orchestral'], [51, 'violin'],
    [55, 'violin'], [56, 'trumpet'], [57, 'trombone'], [58, 'tuba'], [59, 'trumpet'], [60, 'french_horn'], [63, 'trombone'],
    [67, 'tenor_sax'], [68, 'oboe'], [69, 'oboe'], [70, 'bassoon'], [71, 'clarinet'], [72, 'piccolo'], [73, 'flute'],
    [74, 'recorder'], [79, 'ocarina'], [87, 'synth:lead'], [95, 'synth:pad'], [103, 'synth:pad'], [104, 'dan_tranh'],
    [107, 'dan_tranh'], [108, 'kalimba'], [111, 'harmonica'], [112, 'tubular_bells'], [119, 'drum_latin'], [127, 'synth:pluck'],
  ];
  for (const [maxProgram, id] of table) if (program <= maxProgram) return id;
  return 'piano';
}

export function exportMidi(s: Studio, regionIds?: string[]) {
  const p = s.store.get();
  const ids = regionIds ?? p.regions.filter((r) => r.kind === 'midi').map((r) => r.id);
  const tracks = p.tracks
    .filter((t) => t.kind === 'instrument')
    .map((t) => {
      const notes = p.regions
        .filter((r) => r.trackId === t.id && r.kind === 'midi' && ids.includes(r.id))
        .flatMap((r) => (r.kind === 'midi' ? ops.expandMidiNotes(r).map((n) => ({ ...n, start: n.start + r.start })) : []));
      const isDrums = !!t.instrument?.id.startsWith('drum');
      return { name: t.name, channel: isDrums ? 9 : 0, isDrums, notes: notes.map((n) => ({ pitch: n.pitch, start: n.start, length: n.length, velocity: n.velocity, channel: isDrums ? 9 : 0 })) };
    })
    .filter((t) => t.notes.length);
  if (!tracks.length) {
    s.ui.toast('info', 'There are no MIDI notes to export.');
    return;
  }
  // Give each melodic track its own channel (skipping the drum channel).
  let ch = 0;
  for (const t of tracks) {
    if (t.isDrums) continue;
    if (ch === 9) ch++;
    t.channel = ch;
    t.notes.forEach((n) => (n.channel = ch));
    ch = Math.min(15, ch + 1);
  }
  const data = writeMidi({
    format: 1,
    ppq: PPQ,
    tracks,
    tempos: p.tempoMap.map((t) => ({ tick: t.tick, bpm: t.bpm })),
    timeSigs: p.timeSigMap.map((t) => ({ tick: t.tick, numerator: t.sig.numerator, denominator: t.sig.denominator })),
  });
  downloadBlob(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'audio/midi' }), safeFileName(p.title, 'mid'));
}

// ------------------------------------------------------------------ recording

export async function prepareRecording(s: Studio, deviceId?: string): Promise<boolean> {
  try {
    await s.engine.unlock();
    await s.recorder.open(deviceId);
    s.recorder.onDisconnect = () => {
      s.ui.toast('error', 'The microphone was disconnected.');
      if (s.ui.get().recording) void stopRecording(s);
    };
    return true;
  } catch (err) {
    s.ui.toast('error', err instanceof RecorderError ? err.message : `Microphone error: ${String(err)}`);
    return false;
  }
}

let recordStartTick = 0;

/**
 * Record. An armed instrument track, or a selected instrument track when no audio track is
 * armed, records the notes played live (MIDI keyboard, computer keys, on-screen piano).
 * Otherwise the microphone records into the armed (or a new) audio track.
 */
export async function startRecording(s: Studio) {
  const p = s.store.get();
  const armedAudio = p.tracks.find((t) => t.arm && t.kind === 'audio');
  const sel = p.tracks.find((t) => t.id === s.ui.get().selectedTrack);
  const midiTrack = p.tracks.find((t) => t.arm && t.kind === 'instrument') ?? (!armedAudio && sel?.kind === 'instrument' ? sel : undefined);
  if (midiTrack) {
    await s.engine.unlock();
    s.preview.stop();
    if (s.engine.state === 'playing') s.engine.pause();
    recordStartTick = snap(s, s.engine.currentTick(), 'floor');
    s.ui.set({ selectedTrack: midiTrack.id });
    s.live.startTake(midiTrack.id, recordStartTick);
    s.engine.play(recordStartTick, { countInBars: p.editor.countInBars });
    s.ui.set({ recording: true });
    s.ui.toast('info', `Recording notes into "${midiTrack.name}". Play your MIDI keyboard, computer keys or the on-screen piano.`);
    return;
  }
  let track = p.tracks.find((t) => t.arm && t.kind === 'audio');
  if (!track) {
    const selAudio = sel?.kind === 'audio' ? sel : undefined;
    const id = selAudio?.id ?? addTrack(s, 'audio', undefined, 'Vocals');
    s.store.exec('Arm track', (x) => ops.updateTrack(x, id, { arm: true }));
    track = s.store.get().tracks.find((t) => t.id === id)!;
  }
  if (!s.recorder.isOpen && !(await prepareRecording(s))) return;
  s.preview.stop();
  if (s.engine.state === 'playing') s.engine.pause();
  recordStartTick = snap(s, s.engine.currentTick(), 'floor');
  s.recorder.start();
  s.engine.play(recordStartTick, { countInBars: p.editor.countInBars });
  s.ui.set({ recording: true });
}

export async function stopRecording(s: Studio) {
  if (!s.ui.get().recording) return;
  s.ui.set({ recording: false });
  if (s.live.recordingMidi) {
    const take = s.live.stopTake();
    s.engine.pause();
    if (!take || !take.notes.length) {
      s.ui.toast('warn', 'No notes were played, so nothing was recorded.');
      return;
    }
    const last = Math.max(...take.notes.map((n) => n.start + n.length));
    const bar = ticksPerBar(s.store.get().timeSigMap[0].sig);
    const length = Math.max(1, Math.ceil(last / bar)) * bar;
    const region = createMidiRegion({ trackId: take.trackId, start: take.startTick, length, name: 'Recorded notes', notes: take.notes });
    s.store.exec('Record notes', (x) => ops.addRegions(x, [region]));
    s.ui.set({ selectedRegions: [region.id], editRegion: region.id });
    s.ui.toast('success', `Recorded ${take.notes.length} note${take.notes.length === 1 ? '' : 's'}. Open the Note Editor (X) to fix any notes, or press Q to tidy the timing.`);
    return;
  }
  const stopTick = s.engine.currentTick();
  // Map the punch-in point to context time *before* stopping the transport.
  const punchTime = s.engine.timeAtTick(recordStartTick);
  s.engine.pause();
  try {
    const cap = await s.recorder.stop();
    const p = s.store.get();
    const track = p.tracks.find((t) => t.arm && t.kind === 'audio');
    if (!track) throw new Error('No armed track to record into.');
    // Latency compensation: the student heard tick T at punchTime + outputLatency
    // and their sound reached us inputLatency later.
    const latency = (s.engine.ctx.outputLatency || s.engine.ctx.baseLatency || 0) + s.recorder.inputLatency() + recordOffsetMs() / 1000;
    const startSample = Math.max(0, Math.round((punchTime + latency - cap.startTime) * cap.sampleRate));
    const durTicks = Math.max(0, stopTick - recordStartTick);
    const lenSamples = Math.min(cap.channels[0].length - startSample, Math.round(ticksToSeconds(p.tempoMap, durTicks) * cap.sampleRate) + Math.round(0.25 * cap.sampleRate));
    if (lenSamples < cap.sampleRate * 0.2) {
      s.ui.toast('warn', 'The recording was too short and was discarded.');
      return;
    }
    const channels = cap.channels.map((c) => c.slice(startSample, startSample + lenSamples));
    const wav = encodeWav(channels, cap.sampleRate, 24);
    const take = p.regions.filter((r) => r.trackId === track.id).length + 1;
    const name = `${track.name} take ${take}`;
    const assetId = await saveUserAudio(new Blob([wav], { type: 'audio/wav' }), `${name}.wav`);
    const buffer = s.engine.ctx.createBuffer(channels.length, lenSamples, cap.sampleRate);
    channels.forEach((c, i) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    const info: AudioAssetInfo = { id: `usr:${assetId}`, ref: { kind: 'user', assetId }, name, durationSec: buffer.duration, sampleRate: cap.sampleRate, channels: channels.length };
    s.engine.assets.put(info.id, buffer);
    placeUserAudio(s, info, recordStartTick, track.id, 'Record');
    s.ui.toast('success', `Recorded "${name}" (${buffer.duration.toFixed(1)} s). It is saved on this computer.`);
  } catch (err) {
    s.ui.toast('error', err instanceof Error ? err.message : 'Recording failed.');
  }
}

export function recordOffsetMs(): number {
  try {
    return Number(localStorage.getItem('mrdaw.recordOffsetMs') ?? 0) || 0;
  } catch {
    return 0;
  }
}
