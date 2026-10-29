/** Deterministic test-signal generators (used by unit tests and browser self-tests). */

export function sine(freq: number, seconds: number, sampleRate: number, amp = 0.5): Float32Array {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin(w * i);
  return out;
}

/** Fundamental plus harmonics 2..4 (amplitudes 1, 1/2, 1/3, 1/4), scaled to `amp` peak-ish. */
export function harmonicTone(freq: number, seconds: number, sampleRate: number, amp = 0.4): Float32Array {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  const w = (2 * Math.PI * freq) / sampleRate;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let h = 1; h <= 4; h++) v += Math.sin(w * h * i + h * 0.3) / h;
    out[i] = (amp * v) / 2;
  }
  return out;
}

/** Small xorshift PRNG returning values in [-1, 1). */
export function makeNoise(seed = 12345): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 2147483648 - 1;
  };
}

/** Percussive click train: decaying noise bursts (~15 ms) at `bpm`, quarter notes. Returns signal + onset sample indices. */
export function clickTrain(bpm: number, seconds: number, sampleRate: number, amp = 0.9): { signal: Float32Array; onsets: number[] } {
  const n = Math.round(seconds * sampleRate);
  const out = new Float32Array(n);
  const period = (60 / bpm) * sampleRate;
  const burst = Math.round(0.015 * sampleRate);
  const rnd = makeNoise(987);
  const onsets: number[] = [];
  for (let k = 0; ; k++) {
    const p = Math.round(k * period);
    if (p >= n) break;
    onsets.push(p);
    for (let i = 0; i < burst && p + i < n; i++) {
      const env = Math.exp(-i / (0.003 * sampleRate));
      out[p + i] = amp * env * (i === 0 ? 1 : rnd());
    }
  }
  return { signal: out, onsets };
}
