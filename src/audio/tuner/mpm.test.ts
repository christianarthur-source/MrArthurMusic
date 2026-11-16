import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPitch } from './mpm.ts';

type Kind = 'sine' | 'saw' | 'string';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Band-limited tone so high notes are not aliased. */
export function tone(hz: number, sr: number, n: number, kind: Kind, opts: { harmonics?: number[]; amps?: number[]; phase?: number } = {}): Float32Array {
  const out = new Float32Array(n);
  let list: number[];
  let amp: (h: number) => number;
  if (opts.harmonics) {
    list = opts.harmonics;
    amp = (h) => (opts.amps ? opts.amps[opts.harmonics!.indexOf(h)] : 1 / h);
  } else if (kind === 'sine') {
    list = [1]; amp = () => 1;
  } else if (kind === 'saw') {
    list = []; for (let h = 1; h * hz < sr * 0.45; h++) list.push(h); amp = (h) => 1 / h;
  } else {
    list = [1, 2, 3, 4, 5, 6]; amp = (h) => 1 / h;
  }
  const ph = opts.phase ?? 0.3;
  for (const h of list) {
    if (h * hz >= sr / 2) continue;
    const a = amp(h);
    const w = (2 * Math.PI * h * hz) / sr;
    for (let i = 0; i < n; i++) out[i] += a * Math.sin(w * i + ph * h);
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  for (let i = 0; i < n; i++) out[i] = (out[i] / peak) * 0.5;
  return out;
}

const cents = (hz: number, ref: number) => 1200 * Math.log2(hz / ref);
const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

for (const sr of [44100, 48000]) {
  test(`accuracy at every semitone E1..C7, ${sr} Hz`, () => {
    const worst: Record<string, number> = {};
    for (let m = 28; m <= 96; m++) {
      const hz = midiHz(m);
      const win = hz < 90 ? 8192 : 4096;
      for (const kind of ['sine', 'saw', 'string'] as Kind[]) {
        const r = detectPitch(tone(hz, sr, win, kind), sr);
        assert.ok(r, `${kind} ${hz.toFixed(1)} Hz not detected`);
        const err = Math.abs(cents(r.hz, hz));
        assert.ok(err <= 0.5, `${kind} ${hz.toFixed(1)} Hz err ${err.toFixed(3)} cents`);
        if (m >= 45) assert.ok(err <= 0.1, `${kind} ${hz.toFixed(1)} Hz (A2+) err ${err.toFixed(3)} cents > 0.1`);
        worst[kind] = Math.max(worst[kind] ?? 0, err);
      }
    }
    console.log('worst error (cents)', sr, worst);
  });

  test(`offsets ±3, ±20, ±49 cents, ${sr} Hz`, () => {
    for (const m of [40, 45, 52, 57, 64, 69, 76, 88]) {
      for (const off of [-49, -20, -3, 3, 20, 49]) {
        const hz = midiHz(m) * Math.pow(2, off / 1200);
        const win = hz < 90 ? 8192 : 4096;
        const r = detectPitch(tone(hz, sr, win, 'string'), sr);
        assert.ok(r);
        assert.ok(Math.abs(cents(r.hz, hz)) <= 0.5, `${hz} off ${off}`);
      }
    }
  });
}

test('missing fundamental reports the fundamental', () => {
  for (const f0 of [82.41, 110, 196, 261.63, 440, 659.26]) {
    const win = f0 < 90 ? 8192 : 4096;
    const r = detectPitch(tone(f0, 48000, win, 'string', { harmonics: [2, 3, 4, 5, 6] }), 48000);
    assert.ok(r, `${f0}`);
    assert.ok(Math.abs(cents(r.hz, f0)) < 2, `${f0} -> ${r.hz}`);
  }
});

test('strong second harmonic gives no octave error', () => {
  for (const f0 of [82.41, 110, 196, 329.63, 440, 880]) {
    const win = f0 < 90 ? 8192 : 4096;
    const r = detectPitch(tone(f0, 44100, win, 'string', { harmonics: [1, 2, 3], amps: [1, 2, 0.5] }), 44100);
    assert.ok(r, `${f0}`);
    assert.ok(Math.abs(cents(r.hz, f0)) < 1, `${f0} -> ${r.hz}`);
  }
});

test('tone + white noise at 20 dB SNR stays within 2 cents', () => {
  const rand = rng(7);
  for (const f0 of [82.41, 220, 440, 987.77, 1760]) {
    const win = f0 < 90 ? 8192 : 4096;
    const x = tone(f0, 48000, win, 'string');
    let sig = 0;
    for (const v of x) sig += v * v;
    const sigma = Math.sqrt(sig / x.length / 100); // 20 dB below signal power
    for (let i = 0; i < x.length; i++) {
      const g = Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
      x[i] += g * sigma;
    }
    const r = detectPitch(x, 48000);
    assert.ok(r, `${f0}`);
    assert.ok(Math.abs(cents(r.hz, f0)) <= 2, `${f0} -> ${r.hz}`);
  }
});

test('white noise and silence return no pitch', () => {
  const rand = rng(11);
  for (let trial = 0; trial < 20; trial++) {
    const x = new Float32Array(4096);
    for (let i = 0; i < x.length; i++) x[i] = (rand() * 2 - 1) * 0.3;
    const r = detectPitch(x, 48000);
    assert.ok(!r || r.clarity < 0.9, `noise gave ${r?.hz} clarity ${r?.clarity}`);
  }
  assert.equal(detectPitch(new Float32Array(4096), 48000), null);
});

test('detection with an 8192 window takes under 2 ms', () => {
  const x = tone(82.41, 48000, 8192, 'string');
  for (let i = 0; i < 50; i++) detectPitch(x, 48000);
  const t0 = performance.now();
  const N = 200;
  for (let i = 0; i < N; i++) detectPitch(x, 48000);
  const per = (performance.now() - t0) / N;
  console.log('8192-window detection ms:', per.toFixed(3));
  assert.ok(per < 2, `${per} ms`);
});
