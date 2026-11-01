// Renders a playback schedule to a WAV file offline with the same SoundFont, mixer settings and reverb
// as live playback (faster than real time, with progress).
import { loadBank } from './soundfont';
import { DEFAULT_STAFF_MIX, type MasterMix, type StaffMix } from './player';
import type { Schedule } from './schedule';

const RATE = 44100;
const BLOCK = 128;

export async function renderWav(
  sched: Schedule,
  mix: Record<string, StaffMix>,
  master: MasterMix,
  onProgress: (stage: 'sounds' | 'render', fraction: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const [{ SpessaSynthProcessor, SoundBankLoader }, bank] = await Promise.all([import('spessasynth_core'), loadBank((f) => onProgress('sounds', f))]);
  const proc = new SpessaSynthProcessor(RATE);
  await proc.processorInitialized;
  proc.soundBankManager.addSoundBank(SoundBankLoader.fromArrayBuffer(bank.slice(0)), 'main');

  // channels like the live engine: one per part, drums on 10
  const channelOf = new Map<string, number>();
  const byPart = new Map<string, number>();
  let next = 0;
  for (const st of sched.channels) {
    if (st.drums) {
      channelOf.set(st.staffN, 9);
      continue;
    }
    let ch = byPart.get(st.partKey);
    if (ch === undefined) {
      if (next === 9) next++;
      ch = Math.min(next++, 15);
      byPart.set(st.partKey, ch);
      proc.programChange(ch, st.program);
    }
    channelOf.set(st.staffN, ch);
  }
  const anySolo = Object.values(mix).some((m) => m.solo);
  for (const st of sched.channels) {
    const m = { ...DEFAULT_STAFF_MIX, ...mix[st.staffN] };
    const ch = channelOf.get(st.staffN)!;
    const audible = !m.mute && (!anySolo || m.solo);
    proc.controllerChange(ch, 7 as never, Math.round((audible ? m.volume : 0) * 127));
    proc.controllerChange(ch, 10 as never, Math.round(64 + m.pan * 63));
    proc.controllerChange(ch, 91 as never, Math.round(Math.min(1, m.reverb * master.reverb * 2) * 127));
    proc.controllerChange(ch, 93 as never, 8);
  }

  // one timeline of MIDI events in seconds
  type Ev = { t: number; kind: 0 | 1 | 2; ch: number; a: number; b: number }; // 0 off, 1 on, 2 controller
  const evs: Ev[] = [];
  for (const n of sched.notes) {
    const ch = channelOf.get(n.staffN) ?? 0;
    const m = Math.max(0, Math.min(127, Math.round(n.midi)));
    evs.push({ t: n.time / 1000, kind: 1, ch, a: m, b: Math.max(1, Math.round(n.velocity * 127)) });
    evs.push({ t: (n.time + Math.max(30, n.dur)) / 1000, kind: 0, ch, a: m, b: 0 });
  }
  for (const p of sched.pedals) evs.push({ t: p.time / 1000, kind: 2, ch: channelOf.get(p.staffN) ?? 0, a: 64, b: p.down ? 127 : 0 });
  evs.sort((x, y) => x.t - y.t || x.kind - y.kind);
  const endT = (evs.length ? evs[evs.length - 1].t : 0) + 2.5; // let the reverb ring out
  const total = Math.ceil((endT * RATE) / BLOCK) * BLOCK;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  let e = 0;
  const gain = 2.6 * master.volume;
  for (let pos = 0; pos < total; pos += BLOCK) {
    const t = pos / RATE;
    while (e < evs.length && evs[e].t <= t) {
      const v = evs[e++];
      if (v.kind === 1) proc.noteOn(v.ch, v.a, v.b);
      else if (v.kind === 0) proc.noteOff(v.ch, v.a);
      else proc.controllerChange(v.ch, v.a as never, v.b);
    }
    proc.process(left, right, pos, BLOCK);
    if ((pos / BLOCK) % 2000 === 0) {
      onProgress('render', pos / total);
      if (signal?.aborted) throw new Error('Export cancelled.');
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress('render', 1);
  return encodeWav(left, right, gain);
}

function encodeWav(left: Float32Array, right: Float32Array, gain: number): Blob {
  // normalise gently so loud scores don't clip
  let peak = 0;
  for (let i = 0; i < left.length; i++) peak = Math.max(peak, Math.abs(left[i] * gain), Math.abs(right[i] * gain));
  const g = peak > 0.98 ? (gain * 0.98) / peak : gain;
  const n = left.length;
  const buf = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, left[i] * g));
    const r = Math.max(-1, Math.min(1, right[i] * g));
    v.setInt16(o, l * 0x7fff, true);
    v.setInt16(o + 2, r * 0x7fff, true);
    o += 4;
  }
  return new Blob([buf], { type: 'audio/wav' });
}
