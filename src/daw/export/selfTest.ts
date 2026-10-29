import { estimateFrequency, rms } from '../dsp/analysis';
import { AssetManager } from '../engine/assets';
import { InstrumentBank } from '../engine/instruments';
import { createAudioRegion, createProject, createMidiRegion } from '../model/factory';
import * as ops from '../model/ops';
import { ticksToSeconds } from '../model/time';
import { AudioAssetInfo, PPQ, Project } from '../model/types';
import { renderProject } from './render';

/**
 * Browser self-test of the real scheduling path (OfflineAudioContext +
 * MixGraph + RegionScheduler). Uses synthetic test signals (clicks/sines)
 * as fixtures; they never appear in the loop library.
 */

export interface SelfTestResult {
  name: string;
  pass: boolean;
  detail: string;
}

const SR = 48000;
const PRE = 0.005; // silence before each click so declick ramps never touch it

function clickBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const b = ctx.createBuffer(2, Math.round(seconds * SR), SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    const i = Math.round(PRE * SR);
    for (let k = 0; k < 48; k++) d[i + k] = 0.9 * (1 - k / 48);
  }
  return b;
}

function sineBuffer(ctx: BaseAudioContext, seconds: number, hz: number): AudioBuffer {
  const b = ctx.createBuffer(2, Math.round(seconds * SR), SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / SR);
  }
  return b;
}

function asset(id: string, buf: AudioBuffer, originalBpm?: number): AudioAssetInfo {
  return { id, ref: { kind: 'user', assetId: `selftest_${id.replace(/\W/g, '')}` }, name: id, durationSec: buf.duration, sampleRate: SR, channels: 2, originalBpm };
}

/** Measure the first sample above threshold near each expected time. */
function onsetErrors(data: Float32Array, expected: number[], threshold = 0.2): { maxMs: number; missing: number } {
  let maxMs = 0;
  let missing = 0;
  for (const t of expected) {
    const center = Math.round((t + PRE) * SR);
    let found = -1;
    for (let i = Math.max(0, center - SR * 0.02); i < Math.min(data.length, center + SR * 0.02); i++) {
      if (Math.abs(data[i]) > threshold) {
        found = i;
        break;
      }
    }
    if (found < 0) missing++;
    else maxMs = Math.max(maxMs, (Math.abs(found - center) / SR) * 1000);
  }
  return { maxMs, missing };
}

export async function runTimingSelfTest(liveCtx: AudioContext, instruments: InstrumentBank): Promise<SelfTestResult[]> {
  const results: SelfTestResult[] = [];
  const assets = new AssetManager(liveCtx, null);
  const tmp = new OfflineAudioContext(2, SR, SR);
  try {
    // 1. Two tracks, looping one-beat clicks, offset by an eighth note; 16 bars at 113 BPM.
    {
      const bpm = 113;
      let p: Project = createProject('selftest', bpm);
      const click = clickBuffer(tmp, 0.25);
      const a = asset('click', click);
      assets.put(a.id, click);
      const t1 = ops.addTrack(p, 'audio');
      p = t1.project;
      const t2 = ops.addTrack(p, 'audio');
      p = t2.project;
      const len = 16 * 4 * PPQ;
      p = ops.addRegions(
        p,
        [
          createAudioRegion({ trackId: t1.track.id, name: 'A', start: 0, length: len, loopLength: PPQ, loop: true, assetId: a.id }),
          createAudioRegion({ trackId: t2.track.id, name: 'B', start: PPQ / 2, length: len - PPQ / 2, loopLength: PPQ, loop: true, assetId: a.id }),
        ],
        [a],
      );
      p = { ...p, master: { ...p.master, effects: [] } };
      const buf = await renderProject(p, assets, instruments, { fromTick: 0, toTick: len, sampleRate: SR, tailSec: 0 });
      const expected: number[] = [];
      for (let k = 0; k < 16 * 4 * 2 - 1; k++) expected.push(ticksToSeconds(p.tempoMap, (k * PPQ) / 2));
      const { maxMs, missing } = onsetErrors(buf.getChannelData(0), expected, 0.2 * 0.8);
      results.push({
        name: 'Two tracks stay aligned over 16 looping bars',
        pass: missing === 0 && maxMs <= 0.1,
        detail: `${expected.length} clicks, worst error ${maxMs.toFixed(3)} ms${missing ? `, ${missing} missing` : ''} (target ≤ 0.1 ms)`,
      });
    }

    // 2. Tempo change: same musical positions at 90 and 150 BPM.
    for (const bpm of [90, 150]) {
      let p = createProject('selftest', bpm);
      const click = clickBuffer(tmp, 0.1);
      const a = asset('click2', click);
      assets.put(a.id, click);
      const t = ops.addTrack(p, 'audio');
      p = t.project;
      const starts = [0, PPQ * 3, PPQ * 4 + PPQ / 3, PPQ * 9 + PPQ / 4];
      p = ops.addRegions(
        p,
        starts.map((st) => createAudioRegion({ trackId: t.track.id, name: 'c', start: st, length: PPQ / 4, assetId: a.id })),
        [a],
      );
      p = { ...p, master: { ...p.master, effects: [] } };
      const buf = await renderProject(p, assets, instruments, { fromTick: 0, toTick: PPQ * 12, sampleRate: SR, tailSec: 0 });
      const { maxMs, missing } = onsetErrors(buf.getChannelData(0), starts.map((st) => ticksToSeconds(p.tempoMap, st)), 0.15);
      results.push({ name: `Clip positions at ${bpm} BPM`, pass: missing === 0 && maxMs <= 0.1, detail: `worst error ${maxMs.toFixed(3)} ms${missing ? `, ${missing} missing` : ''}` });
    }

    // 3. Pitch-preserving tempo sync of a 440 Hz loop recorded at 120 BPM, played at 100 BPM.
    {
      let p = createProject('selftest', 100);
      const sine = sineBuffer(tmp, 2, 440); // one bar at 120 BPM
      const a = asset('sine', sine, 120);
      assets.put(a.id, sine);
      const t = ops.addTrack(p, 'audio');
      p = t.project;
      p = ops.addRegions(p, [createAudioRegion({ trackId: t.track.id, name: 's', start: 0, length: PPQ * 4, loopLength: PPQ * 4, loop: true, assetId: a.id, stretch: 'sync' })], [a]);
      p = { ...p, master: { ...p.master, effects: [] } };
      await assets.requestProcessed(a.id, { ratio: 120 / 100, semitones: 0, reversed: false });
      const buf = await renderProject(p, assets, instruments, { fromTick: 0, toTick: PPQ * 4, sampleRate: SR, tailSec: 0 });
      const d = buf.getChannelData(0);
      const f = estimateFrequency(d.subarray(SR * 0.5, SR * 1.5), SR);
      const expectedDur = ticksToSeconds(p.tempoMap, PPQ * 4);
      const tailRms = rms(d, Math.round((expectedDur - 0.2) * SR), Math.round((expectedDur - 0.05) * SR));
      results.push({
        name: 'Tempo sync keeps pitch (120 → 100 BPM)',
        pass: Math.abs(f / 440 - 1) < 0.01 && tailRms > 0.2,
        detail: `measured ${f.toFixed(1)} Hz (expected 440), loop fills ${expectedDur.toFixed(2)} s: ${tailRms > 0.2 ? 'yes' : 'no (gap at end)'}`,
      });
    }

    // 4. Volume automation silences the second bar.
    {
      let p = createProject('selftest', 120);
      const sine = sineBuffer(tmp, 4, 220);
      const a = asset('sine2', sine);
      assets.put(a.id, sine);
      const t = ops.addTrack(p, 'audio');
      p = t.project;
      p = ops.addRegions(p, [createAudioRegion({ trackId: t.track.id, name: 's', start: 0, length: PPQ * 8, assetId: a.id, loopLength: PPQ * 8 })], [a]);
      p = ops.setAutomationPoints(p, t.track.id, 'volume', [
        { id: 'a', tick: 0, value: 0, curve: 'step' },
        { id: 'b', tick: PPQ * 4, value: -60, curve: 'step' },
      ]);
      p = { ...p, master: { ...p.master, effects: [] } };
      const buf = await renderProject(p, assets, instruments, { fromTick: 0, toTick: PPQ * 8, sampleRate: SR, tailSec: 0 });
      const d = buf.getChannelData(0);
      const loud = rms(d, SR * 0.5, SR * 1.5);
      const quiet = rms(d, SR * 2.1, SR * 3.9);
      results.push({ name: 'Volume automation is applied on time', pass: loud > 0.1 && quiet < 0.001, detail: `bar 1 RMS ${loud.toFixed(3)}, bar 2 RMS ${quiet.toExponential(1)}` });
    }

    // 5. MIDI note timing (synth instrument, always available).
    {
      let p = createProject('selftest', 128);
      const t = ops.addTrack(p, 'instrument', 'synth', 'synth:pluck');
      p = t.project;
      const starts = [0, PPQ, PPQ * 2 + PPQ / 4, PPQ * 3 + PPQ / 2];
      p = ops.addRegions(p, [createMidiRegion({ trackId: t.track.id, start: 0, length: PPQ * 4, notes: starts.map((st, i) => ({ id: `n${i}`, pitch: 72, start: st, length: PPQ / 8, velocity: 127 })) })]);
      p = { ...p, master: { ...p.master, effects: [] } };
      await instruments.load('synth:pluck');
      const buf = await renderProject(p, assets, instruments, { fromTick: 0, toTick: PPQ * 4, sampleRate: SR, tailSec: 0.2 });
      const d = buf.getChannelData(0);
      let worst = 0;
      for (const st of starts) {
        const t0 = Math.round(ticksToSeconds(p.tempoMap, st) * SR);
        let i = Math.max(0, t0 - 480);
        while (i < t0 + 2400 && Math.abs(d[i]) < 0.01) i++;
        worst = Math.max(worst, ((i - t0) / SR) * 1000);
      }
      results.push({ name: 'MIDI notes start on time', pass: worst >= -0.05 && worst < 2, detail: `worst onset ${worst.toFixed(2)} ms after the note (synth attack is ~1 ms)` });
    }
  } finally {
    assets.dispose();
  }
  return results;
}
