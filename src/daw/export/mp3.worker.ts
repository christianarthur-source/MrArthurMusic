/// <reference lib="webworker" />
import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * MP3 encoding off the main thread, so the page stays responsive while a song is encoded.
 * The encoder (LAME, LGPL) is loaded only when someone exports an MP3.
 *
 * In:  { channels: Float32Array[], sampleRate, kbps }
 * Out: { progress } … then { data: Uint8Array[] } or { error }
 */

interface Job {
  channels: Float32Array[];
  sampleRate: number;
  kbps: number;
}

const BLOCK = 1152 * 8;

function toInt16(src: Float32Array, from: number, to: number): Int16Array {
  const out = new Int16Array(to - from);
  for (let i = from; i < to; i++) {
    const v = Math.max(-1, Math.min(1, src[i]));
    out[i - from] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

self.onmessage = (e: MessageEvent<Job>) => {
  try {
    const { channels, sampleRate, kbps } = e.data;
    const stereo = channels.length > 1;
    const enc = new Mp3Encoder(stereo ? 2 : 1, sampleRate, kbps);
    const parts: Uint8Array[] = [];
    const n = channels[0].length;
    let lastReport = 0;
    for (let i = 0; i < n; i += BLOCK) {
      const end = Math.min(n, i + BLOCK);
      const l = toInt16(channels[0], i, end);
      const out = stereo ? enc.encodeBuffer(l, toInt16(channels[1], i, end)) : enc.encodeBuffer(l);
      if (out.length) parts.push(new Uint8Array(out));
      if (end / n - lastReport >= 0.05) {
        lastReport = end / n;
        self.postMessage({ progress: lastReport });
      }
    }
    const tail = enc.flush();
    if (tail.length) parts.push(new Uint8Array(tail));
    self.postMessage({ data: parts });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
