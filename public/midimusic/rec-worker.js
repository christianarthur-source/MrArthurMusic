// Turns the recorded sound into a file, away from the page so playing stays smooth.
// It writes a WAV file. (An MP3 encoder can be dropped in here: see encodeChunk / finish.)
let chunks = [];
let frames = 0;
let rate = 48000;

function encodeChunk(l, r) {
  const out = new Int16Array(l.length * 2);
  for (let i = 0; i < l.length; i++) { out[2 * i] = l[i]; out[2 * i + 1] = r[i]; }
  chunks.push(out);
  frames += l.length;
}

function finish() {
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
