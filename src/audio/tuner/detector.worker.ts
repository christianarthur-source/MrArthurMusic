// Module worker: keeps a ring buffer of the latest samples and runs the pitch detector on every
// 512-sample block (about 90 readings per second at 48 kHz).
import { detectPitch } from './mpm.ts';

interface Range { minHz: number; maxHz: number }
const FULL: Range = { minHz: 27, maxHz: 4200 };

const RING = 16384;
const ring = new Float32Array(RING);
let write = 0;
let filled = 0;
let range: Range | null = null;
let lastHz = 0;
const win4 = new Float32Array(4096);
const win8 = new Float32Array(8192);

const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(message: unknown): void;
};

function latest(out: Float32Array) {
  const n = out.length;
  let start = (write - n + RING) % RING;
  const first = Math.min(n, RING - start);
  out.set(ring.subarray(start, start + first), 0);
  if (first < n) out.set(ring.subarray(0, n - first), first);
}

scope.onmessage = (e: MessageEvent) => {
  const d = e.data;
  if (d.type === 'config') {
    range = d.range ?? null;
    return;
  }
  if (d.type === 'reset') {
    filled = 0; write = 0; lastHz = 0;
    return;
  }
  const samples: Float32Array = d.samples;
  const sr: number = d.sampleRate;
  for (let i = 0; i < samples.length; i++) {
    ring[write] = samples[i];
    write = (write + 1) % RING;
  }
  filled = Math.min(RING, filled + samples.length);
  if (filled < 4096) return;

  // Longer window for bass/cello so several periods fit; hysteresis stops it flapping.
  const useLong = lastHz > 0 && (lastHz < 90 || (lastHz < 110 && win8Active)) && filled >= 8192;
  win8Active = useLong;
  const win = useLong ? win8 : win4;
  latest(win);

  let sum = 0;
  const tail = Math.min(2048, win.length);
  for (let i = win.length - tail; i < win.length; i++) sum += win[i] * win[i];
  const rms = Math.sqrt(sum / tail);

  const r = range ?? FULL;
  let res = rms > 0.0005 ? detectPitch(win, sr, { minHz: r.minHz, maxHz: r.maxHz }) : null;
  let far: 'low' | 'high' | null = null;
  if (!res && range && rms > 0.0005) {
    const wide = detectPitch(win, sr, FULL);
    if (wide && wide.clarity >= 0.9) far = wide.hz < range.minHz ? 'low' : 'high';
  }
  lastHz = res ? res.hz : 0;
  scope.postMessage({ hz: res ? res.hz : null, clarity: res ? res.clarity : 0, rms, far });
};

let win8Active = false;
