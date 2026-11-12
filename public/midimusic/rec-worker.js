// Turns the recorded sound into an MP3 file, away from the page so playing stays smooth.
// The sound is encoded as it arrives (lamejs, LGPL — vendor/lame.min.js), so stopping is instant and
// nothing big is kept in memory. If the encoder cannot load, the take is saved as a WAV file instead.
let mp3 = true;
try {
  importScripts('vendor/lame.min.js');
} catch {
  mp3 = false;
}

let encoder = null;
let chunks = [];
let frames = 0;
let rate = 48000;

function encodeChunk(l, r) {
  frames += l.length;
  if (encoder) {
    const out = encoder.encodeBuffer(l, r);
    if (out.length) chunks.push(new Uint8Array(out.buffer, out.byteOffset, out.length).slice());
    return;
  }
  const pcm = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) { pcm[2 * i] = l[i]; pcm[2 * i + 1] = r[i]; }
  chunks.push(pcm);
}

function finish() {
  if (encoder) {
    const tail = encoder.flush();
    if (tail.length) chunks.push(new Uint8Array(tail.buffer, tail.byteOffset, tail.length).slice());
    return { blob: new Blob(chunks, { type: 'audio/mpeg' }), ext: 'mp3' };
  }
  const bytes = frames * 4;
  const head = new DataView(new ArrayBuffer(44));
  const text = (o, s) => { for (let i = 0; i < s.length; i++) head.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); head.setUint32(4, 36 + bytes, true); text(8, 'WAVE');
  text(12, 'fmt '); head.setUint32(16, 16, true); head.setUint16(20, 1, true); head.setUint16(22, 2, true);
  head.setUint32(24, rate, true); head.setUint32(28, rate * 4, true); head.setUint16(32, 4, true); head.setUint16(34, 16, true);
  text(36, 'data'); head.setUint32(40, bytes, true);
  return { blob: new Blob([head, ...chunks], { type: 'audio/wav' }), ext: 'wav' };
}

self.onmessage = (e) => {
  if (e.data.type !== 'start') return;
  chunks = [];
  frames = 0;
  rate = e.data.sampleRate;
  encoder = null;
  if (mp3) {
    try { encoder = new lamejs.Mp3Encoder(2, rate, 160); } catch { encoder = null; } // stereo, 160 kbps
  }
  const port = e.data.port;
  port.onmessage = (ev) => {
    if (ev.data.end) {
      const done = finish();
      chunks = [];
      self.postMessage({ type: 'done', blob: done.blob, ext: done.ext, seconds: frames / rate });
      port.close();
    } else encodeChunk(ev.data.l, ev.data.r);
  };
};
