import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Stabilizer } from './stabilize.ts';

const FRAME_MS = 1000 / 90;
const hzOf = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
const good = (midi: number) => ({ hz: hzOf(midi), clarity: 0.98, rms: 0.1 });
const silence = { hz: null, clarity: 0, rms: 0.0004 };

function run(s: Stabilizer, frames: { hz: number | null; clarity: number; rms: number }[], t0 = 0) {
  const outs = [];
  frames.forEach((f, i) => outs.push(s.push(f, t0 + i * FRAME_MS)));
  return outs;
}

test('steady tone converges to the exact pitch', () => {
  const s = new Stabilizer();
  const outs = run(s, Array(180).fill(good(69.1)));
  const last = outs[outs.length - 1]!;
  assert.equal(last.noteMidi, 69);
  assert.ok(Math.abs((last.midi - 69) * 100 - 10) < 0.05);
});

test('a single outlier frame does not move the output', () => {
  const s = new Stabilizer();
  run(s, Array(120).fill(good(69)));
  const before = s.push(good(69), 2000)!;
  const out = s.push({ hz: hzOf(69) * 1.5, clarity: 0.95, rms: 0.1 }, 2000 + FRAME_MS)!;
  assert.equal(out.noteMidi, 69);
  assert.ok(Math.abs(out.midi - before.midi) * 100 < 1, `moved ${(out.midi - before.midi) * 100} cents`);
});

test('a real semitone step is shown within 80 ms', () => {
  const s = new Stabilizer();
  const t0 = 0;
  run(s, Array(120).fill(good(69)), t0);
  const tStep = 120 * FRAME_MS;
  let changedAt = -1;
  for (let i = 0; i < 20; i++) {
    const t = tStep + i * FRAME_MS;
    const out = s.push(good(70), t);
    if (out && out.noteMidi === 70) { changedAt = t - tStep; break; }
  }
  assert.ok(changedAt >= 0 && changedAt <= 80, `changed after ${changedAt} ms`);
});

test('a tone hovering at +50 cents never flips the note', () => {
  const s = new Stabilizer();
  let seed = 3;
  const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed / 0x7fffffff - 0.5) * 8; }; // ±4 cents
  const frames = Array.from({ length: 600 }, () => good(69 + (50 + noise()) / 100));
  const outs = run(s, frames).filter(Boolean);
  const notes = new Set(outs.map((o) => o!.noteMidi));
  assert.equal(notes.size, 1, `notes seen: ${[...notes]}`);
});

test('silence holds the last reading for 400 ms dimmed, then clears', () => {
  const s = new Stabilizer();
  run(s, Array(120).fill(good(69)));
  const tEnd = 120 * FRAME_MS;
  const a = s.push(silence, tEnd + 100)!;
  assert.ok(a && a.held);
  assert.equal(s.push(silence, tEnd + 450), null);
});

test('noise-only frames (low clarity) are gated', () => {
  const s = new Stabilizer();
  const outs = run(s, Array(60).fill({ hz: 300, clarity: 0.4, rms: 0.1 }));
  assert.ok(outs.every((o) => o === null));
});
