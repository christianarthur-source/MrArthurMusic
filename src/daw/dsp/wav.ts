/**
 * WAV (RIFF/WAVE) encode / decode.
 *
 * encodeWav: 16/24-bit PCM (format 1) or 32-bit IEEE float (format 3),
 * interleaved, little endian. Samples are clamped to [-1, 1]; 16-bit output
 * uses TPDF dither (+/- 1 LSB triangular). Scaling: x * 2^(bits-1), clipped to
 * the positive maximum (standard convention, decoded with / 2^(bits-1)).
 * For > 2 channels a plain format tag is still written (most readers accept it).
 *
 * parseWav: PCM 8/16/24/32-bit, IEEE float 32/64-bit, WAVE_FORMAT_EXTENSIBLE.
 */

export type WavBitDepth = 16 | 24 | 32;

export interface ParsedWav {
  sampleRate: number;
  bitDepth: number;
  channels: Float32Array[];
  /** 1 = PCM, 3 = IEEE float (after resolving WAVE_FORMAT_EXTENSIBLE). */
  format?: number;
}

function writeAscii(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

export function encodeWav(channels: Float32Array[], sampleRate: number, bitDepth: WavBitDepth): ArrayBuffer {
  if (bitDepth !== 16 && bitDepth !== 24 && bitDepth !== 32) throw new Error(`encodeWav: unsupported bit depth ${bitDepth}`);
  const nCh = Math.max(1, channels.length);
  let frames = 0;
  for (const c of channels) frames = Math.max(frames, c.length);
  const bytesPerSample = bitDepth / 8;
  const blockAlign = nCh * bytesPerSample;
  const dataBytes = frames * blockAlign;
  const pad = dataBytes & 1;
  const buf = new ArrayBuffer(44 + dataBytes + pad);
  const v = new DataView(buf);
  const sr = Math.max(1, Math.round(sampleRate));

  writeAscii(v, 0, 'RIFF');
  v.setUint32(4, 36 + dataBytes + pad, true);
  writeAscii(v, 8, 'WAVE');
  writeAscii(v, 12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, bitDepth === 32 ? 3 : 1, true);
  v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitDepth, true);
  writeAscii(v, 36, 'data');
  v.setUint32(40, dataBytes, true);

  const get = (c: number, i: number): number => {
    const ch = channels[c];
    if (!ch || i >= ch.length) return 0;
    const x = ch[i];
    if (!(x === x)) return 0; // NaN
    return x > 1 ? 1 : x < -1 ? -1 : x;
  };

  let off = 44;
  if (bitDepth === 32) {
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < nCh; c++) {
        v.setFloat32(off, get(c, i), true);
        off += 4;
      }
    }
  } else if (bitDepth === 24) {
    const scale = 8388608;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < nCh; c++) {
        let s = Math.round(get(c, i) * scale);
        if (s > 8388607) s = 8388607;
        else if (s < -8388608) s = -8388608;
        v.setUint8(off, s & 0xff);
        v.setUint8(off + 1, (s >> 8) & 0xff);
        v.setUint8(off + 2, (s >> 16) & 0xff);
        off += 3;
      }
    }
  } else {
    // 16-bit with TPDF dither (two uniform variables, +/- 1 LSB peak).
    let seed = 0x9e3779b9;
    const rand = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const scale = 32768;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < nCh; c++) {
        const x = get(c, i);
        const dither = rand() - rand();
        let s = Math.round(x * scale + dither);
        if (s > 32767) s = 32767;
        else if (s < -32768) s = -32768;
        v.setInt16(off, s, true);
        off += 2;
      }
    }
  }
  return buf;
}

function readAscii(v: DataView, off: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(v.getUint8(off + i));
  return s;
}

export function parseWav(buf: ArrayBuffer): ParsedWav {
  const v = new DataView(buf);
  if (buf.byteLength < 12 || readAscii(v, 0, 4) !== 'RIFF' || readAscii(v, 8, 4) !== 'WAVE') {
    throw new Error('parseWav: not a RIFF/WAVE file');
  }
  let off = 12;
  let fmt: { format: number; nCh: number; sampleRate: number; bits: number; blockAlign: number } | null = null;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.byteLength) {
    const id = readAscii(v, off, 4);
    const size = v.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > buf.byteLength) throw new Error('parseWav: truncated fmt chunk');
      let format = v.getUint16(body, true);
      const nCh = v.getUint16(body + 2, true);
      const sampleRate = v.getUint32(body + 4, true);
      const blockAlign = v.getUint16(body + 12, true);
      const bits = v.getUint16(body + 14, true);
      if (format === 0xfffe && size >= 40 && body + 26 <= buf.byteLength) {
        format = v.getUint16(body + 24, true); // first 2 bytes of SubFormat GUID
      }
      fmt = { format, nCh, sampleRate, bits, blockAlign };
    } else if (id === 'data') {
      dataOff = body;
      dataLen = Math.min(size, buf.byteLength - body); // tolerate bogus/streaming sizes
      if (fmt) break;
    }
    off = body + size + (size & 1);
    if (size === 0xffffffff) break;
  }
  if (!fmt) throw new Error('parseWav: missing fmt chunk');
  if (dataOff < 0) throw new Error('parseWav: missing data chunk');
  const { format, nCh, sampleRate, bits } = fmt;
  if (nCh < 1) throw new Error('parseWav: invalid channel count');
  const bytes = bits / 8;
  if (!Number.isInteger(bytes) || bytes < 1) throw new Error(`parseWav: unsupported bit depth ${bits}`);
  const blockAlign = fmt.blockAlign || nCh * bytes;
  const frames = Math.floor(dataLen / blockAlign);
  const channels: Float32Array[] = [];
  for (let c = 0; c < nCh; c++) channels.push(new Float32Array(frames));

  for (let i = 0; i < frames; i++) {
    const base = dataOff + i * blockAlign;
    for (let c = 0; c < nCh; c++) {
      const p = base + c * bytes;
      let x: number;
      if (format === 3) {
        if (bits === 32) x = v.getFloat32(p, true);
        else if (bits === 64) x = v.getFloat64(p, true);
        else throw new Error(`parseWav: unsupported float bit depth ${bits}`);
        if (!Number.isFinite(x)) x = 0;
      } else if (format === 1) {
        if (bits === 8) x = (v.getUint8(p) - 128) / 128;
        else if (bits === 16) x = v.getInt16(p, true) / 32768;
        else if (bits === 24) {
          const s = v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16);
          x = s / 8388608;
        } else if (bits === 32) x = v.getInt32(p, true) / 2147483648;
        else throw new Error(`parseWav: unsupported PCM bit depth ${bits}`);
      } else {
        throw new Error(`parseWav: unsupported format tag ${format} (only PCM and IEEE float)`);
      }
      channels[c][i] = x;
    }
  }
  return { sampleRate, bitDepth: bits, channels, format };
}
