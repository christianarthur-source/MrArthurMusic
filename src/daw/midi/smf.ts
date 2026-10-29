/**
 * Standard MIDI File (SMF) reader / writer.
 *
 * - Reads format 0 and 1 (format 2 and SMPTE time division are rejected).
 * - Every read is bounds-checked; malformed input throws MidiParseError, never RangeError.
 * - RMID (RIFF-wrapped) files are unwrapped.
 * - Writes format 1 with a conductor track (tempo + time signatures) followed by one track per SmfTrack.
 */

export interface SmfNote {
  pitch: number;
  start: number;
  length: number;
  velocity: number;
  channel: number;
}

export interface SmfTrack {
  name?: string;
  channel?: number;
  program?: number;
  isDrums: boolean;
  notes: SmfNote[];
}

export interface SmfFile {
  format: 0 | 1;
  ppq: number;
  tracks: SmfTrack[];
  tempos: { tick: number; bpm: number }[];
  timeSigs: { tick: number; numerator: number; denominator: number }[];
}

export class MidiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MidiParseError';
  }
}

export const MAX_TRACKS = 64;
export const MAX_NOTES = 200_000;
const DRUM_CHANNEL = 9;

// ---------------------------------------------------------------------------
// Bounds-checked byte reader
// ---------------------------------------------------------------------------

class Reader {
  pos: number;
  constructor(
    private readonly bytes: Uint8Array,
    start: number,
    readonly end: number,
  ) {
    this.pos = start;
  }
  get remaining(): number {
    return this.end - this.pos;
  }
  need(n: number, what: string): void {
    if (n < 0 || this.pos + n > this.end) {
      throw new MidiParseError(`Unexpected end of data while reading ${what} (offset ${this.pos})`);
    }
  }
  u8(what = 'byte'): number {
    this.need(1, what);
    return this.bytes[this.pos++];
  }
  peek(what = 'byte'): number {
    this.need(1, what);
    return this.bytes[this.pos];
  }
  u16(what = 'u16'): number {
    this.need(2, what);
    const v = (this.bytes[this.pos] << 8) | this.bytes[this.pos + 1];
    this.pos += 2;
    return v;
  }
  u32(what = 'u32'): number {
    this.need(4, what);
    const b = this.bytes;
    const p = this.pos;
    this.pos += 4;
    return ((b[p] << 24) >>> 0) + (b[p + 1] << 16) + (b[p + 2] << 8) + b[p + 3];
  }
  u32le(what = 'u32'): number {
    this.need(4, what);
    const b = this.bytes;
    const p = this.pos;
    this.pos += 4;
    return ((b[p + 3] << 24) >>> 0) + (b[p + 2] << 16) + (b[p + 1] << 8) + b[p];
  }
  ascii(n: number, what = 'string'): string {
    this.need(n, what);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.bytes[this.pos + i]);
    this.pos += n;
    return s;
  }
  slice(n: number, what = 'data'): Uint8Array {
    this.need(n, what);
    const s = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  skip(n: number, what = 'data'): void {
    this.need(n, what);
    this.pos += n;
  }
  /** Variable-length quantity: at most 4 bytes (28 bits). */
  vlq(what = 'variable-length quantity'): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8(what);
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return value >>> 0;
    }
    throw new MidiParseError(`Invalid ${what}: longer than 4 bytes (offset ${this.pos})`);
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function toBytes(data: ArrayBuffer | Uint8Array): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  throw new MidiParseError('Expected an ArrayBuffer or Uint8Array');
}

/** Returns [start, end) of the SMF payload, unwrapping RIFF/RMID if needed. */
function locateSmf(bytes: Uint8Array): [number, number] {
  const r = new Reader(bytes, 0, bytes.length);
  if (bytes.length < 4) throw new MidiParseError('File too short to be a MIDI file');
  const magic = r.ascii(4, 'file signature');
  if (magic === 'MThd') return [0, bytes.length];
  if (magic !== 'RIFF') throw new MidiParseError('Not a MIDI file (missing MThd header)');
  const riffLen = r.u32le('RIFF length');
  const riffEnd = Math.min(bytes.length, 8 + riffLen);
  const form = r.ascii(4, 'RIFF form type');
  if (form !== 'RMID') throw new MidiParseError(`Unsupported RIFF form "${form}" (expected RMID)`);
  const rr = new Reader(bytes, r.pos, riffEnd);
  while (rr.remaining >= 8) {
    const id = rr.ascii(4, 'RIFF chunk id');
    const len = rr.u32le('RIFF chunk length');
    if (len > rr.remaining) throw new MidiParseError(`RIFF chunk "${id}" length exceeds file size`);
    if (id === 'data') return [rr.pos, rr.pos + len];
    rr.skip(len + (len & 1 && rr.remaining > len ? 1 : 0), 'RIFF chunk');
  }
  throw new MidiParseError('RMID file contains no "data" chunk');
}

interface RawTrack {
  name?: string;
  notes: SmfNote[];
  programs: Map<number, number>;
  channelsUsed: Set<number>;
}

interface ParseState {
  noteCount: number;
  tempos: { tick: number; bpm: number }[];
  timeSigs: { tick: number; numerator: number; denominator: number }[];
}

const decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { fatal: false }) : null;
function decodeText(b: Uint8Array): string {
  if (decoder) return decoder.decode(b).replace(/\0+$/, '').trim();
  let s = '';
  for (const c of b) s += String.fromCharCode(c);
  return s.replace(/\0+$/, '').trim();
}

/** Data byte count for channel voice messages, indexed by (status >> 4) - 8. */
const CHANNEL_DATA_LEN = [2, 2, 2, 2, 1, 1, 2];

function parseTrack(r: Reader, state: ParseState, trackIndex: number): RawTrack {
  const track: RawTrack = { notes: [], programs: new Map(), channelsUsed: new Set() };
  const open = new Map<number, { start: number; velocity: number }[]>();
  let tick = 0;
  let running = 0;

  const closeNote = (ch: number, pitch: number, at: number): void => {
    const key = (ch << 7) | pitch;
    const q = open.get(key);
    if (!q || q.length === 0) return; // stray note-off
    const on = q.shift()!;
    if (q.length === 0) open.delete(key);
    track.notes.push({
      pitch,
      channel: ch,
      start: on.start,
      length: Math.max(1, at - on.start),
      velocity: on.velocity,
    });
  };

  while (r.remaining > 0) {
    const delta = r.vlq('delta time');
    tick += delta;
    if (tick > 0x7fffffff) throw new MidiParseError(`Track ${trackIndex}: tick position overflow`);

    let status = r.peek('event status');
    if (status & 0x80) {
      r.pos++;
    } else {
      if (!running) throw new MidiParseError(`Track ${trackIndex}: data byte without running status (offset ${r.pos})`);
      status = running;
    }

    if (status === 0xff) {
      running = 0;
      const type = r.u8('meta type');
      const len = r.vlq('meta length');
      const data = r.slice(len, 'meta event data');
      if (type === 0x2f) break; // end of track
      if (type === 0x03 && track.name === undefined) {
        const name = decodeText(data);
        if (name) track.name = name;
      } else if (type === 0x51 && len >= 3) {
        const us = (data[0] << 16) | (data[1] << 8) | data[2];
        if (us > 0) state.tempos.push({ tick, bpm: Math.round((60_000_000 / us) * 1000) / 1000 }); // us/qn is lossy; 0.001 bpm precision
      } else if (type === 0x58 && len >= 2) {
        const dd = data[1];
        if (data[0] > 0 && dd <= 7) state.timeSigs.push({ tick, numerator: data[0], denominator: 1 << dd });
      }
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      running = 0;
      const len = r.vlq('sysex length');
      r.skip(len, 'sysex data');
      continue;
    }
    if (status >= 0xf1) {
      // System common / realtime messages are not legal in SMF, but skip them safely.
      running = 0;
      const len = status === 0xf2 ? 2 : status === 0xf1 || status === 0xf3 ? 1 : 0;
      r.skip(len, 'system message');
      continue;
    }

    running = status;
    const kind = status >> 4;
    const ch = status & 0x0f;
    const d1 = r.u8('event data') & 0x7f;
    const d2 = CHANNEL_DATA_LEN[kind - 8] === 2 ? r.u8('event data') & 0x7f : 0;

    if (kind === 0x9 && d2 > 0) {
      if (++state.noteCount > MAX_NOTES) {
        throw new MidiParseError(`File contains more than ${MAX_NOTES} notes; refusing to load`);
      }
      const key = (ch << 7) | d1;
      let q = open.get(key);
      if (!q) open.set(key, (q = []));
      q.push({ start: tick, velocity: d2 });
      track.channelsUsed.add(ch);
    } else if (kind === 0x8 || kind === 0x9) {
      closeNote(ch, d1, tick);
    } else if (kind === 0xc) {
      if (!track.programs.has(ch)) track.programs.set(ch, d1);
    }
  }

  // Close notes still sounding at end of track.
  for (const [key, q] of open) {
    for (const on of q) {
      track.notes.push({
        pitch: key & 0x7f,
        channel: key >> 7,
        start: on.start,
        length: Math.max(1, tick - on.start),
        velocity: on.velocity,
      });
    }
  }
  track.notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  return track;
}

function sortDedupe<T extends { tick: number }>(events: T[]): T[] {
  const sorted = events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.tick - b.e.tick || a.i - b.i)
    .map((x) => x.e);
  const out: T[] = [];
  for (const e of sorted) {
    if (out.length && out[out.length - 1].tick === e.tick) out[out.length - 1] = e; // last wins
    else out.push(e);
  }
  return out;
}

export function parseMidi(data: ArrayBuffer | Uint8Array): SmfFile {
  const bytes = toBytes(data);
  const [start, end] = locateSmf(bytes);
  const r = new Reader(bytes, start, end);

  if (r.ascii(4, 'header id') !== 'MThd') throw new MidiParseError('Not a MIDI file (missing MThd header)');
  const headerLen = r.u32('header length');
  if (headerLen < 6) throw new MidiParseError(`Invalid MThd header length ${headerLen}`);
  if (headerLen > r.remaining) throw new MidiParseError('MThd header length exceeds file size');
  const headerEnd = r.pos + headerLen;
  const format = r.u16('format');
  const declaredTracks = r.u16('track count');
  const division = r.u16('time division');
  r.pos = headerEnd;

  if (format === 2) {
    throw new MidiParseError('MIDI format 2 (multiple independent sequences) is not supported');
  }
  if (format !== 0 && format !== 1) throw new MidiParseError(`Unknown MIDI format ${format}`);
  if (division & 0x8000) {
    throw new MidiParseError('SMPTE time division is not supported (only ticks-per-quarter-note files)');
  }
  if (division === 0) throw new MidiParseError('Invalid time division 0');
  if (declaredTracks > MAX_TRACKS) {
    throw new MidiParseError(`File declares ${declaredTracks} tracks; maximum supported is ${MAX_TRACKS}`);
  }

  const state: ParseState = { noteCount: 0, tempos: [], timeSigs: [] };
  const raw: RawTrack[] = [];
  while (r.remaining > 0) {
    if (r.remaining < 8) {
      // Trailing padding after the last declared track is tolerated; otherwise the file is cut off.
      if (raw.length >= declaredTracks) break;
      throw new MidiParseError('Unexpected end of data while reading chunk header');
    }
    const id = r.ascii(4, 'chunk id');
    const len = r.u32('chunk length');
    if (len > r.remaining) {
      throw new MidiParseError(`Chunk "${printable(id)}" length ${len} exceeds remaining file size ${r.remaining}`);
    }
    if (id !== 'MTrk') {
      r.skip(len, 'unknown chunk');
      continue;
    }
    if (raw.length >= MAX_TRACKS) {
      throw new MidiParseError(`File contains more than ${MAX_TRACKS} tracks; refusing to load`);
    }
    const tr = new Reader(bytes, r.pos, r.pos + len);
    raw.push(parseTrack(tr, state, raw.length));
    r.skip(len, 'track chunk');
  }
  if (raw.length === 0) throw new MidiParseError('MIDI file contains no tracks');
  if (raw.length < declaredTracks) {
    throw new MidiParseError(`File is truncated: header declares ${declaredTracks} tracks but only ${raw.length} found`);
  }

  const tracks: SmfTrack[] = [];
  for (const t of raw) {
    if (t.notes.length === 0) continue;
    const channels = [...new Set(t.notes.map((n) => n.channel))].sort((a, b) => a - b);
    for (const ch of channels) {
      const notes = channels.length === 1 ? t.notes : t.notes.filter((n) => n.channel === ch);
      let name = t.name;
      if (channels.length > 1) name = t.name ? `${t.name} (Ch ${ch + 1})` : `Channel ${ch + 1}`;
      const track: SmfTrack = { channel: ch, isDrums: ch === DRUM_CHANNEL, notes };
      if (name !== undefined) track.name = name;
      const program = t.programs.get(ch) ?? programFromOtherTracks(raw, ch);
      if (program !== undefined) track.program = program;
      tracks.push(track);
    }
  }

  return {
    format: format as 0 | 1,
    ppq: division,
    tracks,
    tempos: sortDedupe(state.tempos),
    timeSigs: sortDedupe(state.timeSigs),
  };
}

/** Some files put program changes in a separate (note-less) track on the same channel. */
function programFromOtherTracks(raw: RawTrack[], ch: number): number | undefined {
  for (const t of raw) {
    if (t.notes.length === 0 && t.programs.has(ch)) return t.programs.get(ch);
  }
  return undefined;
}

function printable(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, '?');
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

class Writer {
  private buf = new Uint8Array(256);
  len = 0;
  private ensure(n: number): void {
    if (this.len + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + n) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
  u8(v: number): void {
    this.ensure(1);
    this.buf[this.len++] = v & 0xff;
  }
  u16(v: number): void {
    this.u8(v >> 8);
    this.u8(v);
  }
  u32(v: number): void {
    this.u8(v >>> 24);
    this.u8(v >>> 16);
    this.u8(v >>> 8);
    this.u8(v);
  }
  bytes(b: ArrayLike<number>): void {
    this.ensure(b.length);
    for (let i = 0; i < b.length; i++) this.buf[this.len++] = b[i] & 0xff;
  }
  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
  }
  vlq(v: number): void {
    v = Math.max(0, Math.min(0x0fffffff, Math.floor(v)));
    const stack = [v & 0x7f];
    v >>>= 7;
    while (v > 0) {
      stack.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    for (let i = stack.length - 1; i >= 0; i--) this.u8(stack[i]);
  }
  result(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

interface OutEvent {
  tick: number;
  /** Lower sorts first at equal tick: 0 meta, 1 program, 2 note-off, 3 note-on. */
  order: number;
  data: number[];
}

function writeTrackChunk(out: Writer, events: OutEvent[]): void {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const t = new Writer();
  let last = 0;
  for (const e of events) {
    t.vlq(e.tick - last);
    last = e.tick;
    t.bytes(e.data);
  }
  t.vlq(0);
  t.bytes([0xff, 0x2f, 0x00]);
  const body = t.result();
  out.ascii('MTrk');
  out.u32(body.length);
  out.bytes(body);
}

function metaEvent(tick: number, type: number, payload: ArrayLike<number>): OutEvent {
  const w = new Writer();
  w.u8(0xff);
  w.u8(type);
  w.vlq(payload.length);
  w.bytes(payload);
  return { tick, order: 0, data: Array.from(w.result()) };
}

function encodeText(s: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
  return Uint8Array.from(s, (c) => c.charCodeAt(0) & 0x7f);
}

const clampInt = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(v)));

export function writeMidi(file: SmfFile): Uint8Array {
  const ppq = Math.round(file.ppq);
  if (!(ppq >= 1 && ppq <= 0x7fff)) throw new RangeError(`ppq must be between 1 and 32767 (got ${file.ppq})`);
  const out = new Writer();
  out.ascii('MThd');
  out.u32(6);
  out.u16(1);
  out.u16(file.tracks.length + 1);
  out.u16(ppq);

  // Conductor track.
  const conductor: OutEvent[] = [];
  for (const t of file.tempos) {
    if (!(t.bpm > 0)) continue;
    const us = clampInt(60_000_000 / t.bpm, 1, 0xffffff);
    conductor.push(metaEvent(Math.max(0, Math.round(t.tick)), 0x51, [us >> 16, (us >> 8) & 0xff, us & 0xff]));
  }
  for (const ts of file.timeSigs) {
    const dd = Math.round(Math.log2(ts.denominator));
    if (!(dd >= 0 && dd <= 7) || ts.numerator < 1) continue;
    conductor.push(metaEvent(Math.max(0, Math.round(ts.tick)), 0x58, [clampInt(ts.numerator, 1, 255), dd, 24, 8]));
  }
  writeTrackChunk(out, conductor);

  for (const track of file.tracks) {
    const events: OutEvent[] = [];
    if (track.name) events.push(metaEvent(0, 0x03, encodeText(track.name)));
    const defaultCh = clampInt(track.channel ?? (track.isDrums ? DRUM_CHANNEL : 0), 0, 15);
    if (track.program !== undefined) {
      events.push({ tick: 0, order: 1, data: [0xc0 | defaultCh, clampInt(track.program, 0, 127)] });
    }
    for (const n of track.notes) {
      const ch = clampInt(Number.isFinite(n.channel) ? n.channel : defaultCh, 0, 15);
      const pitch = clampInt(n.pitch, 0, 127);
      const start = Math.max(0, Math.round(n.start));
      const end = start + Math.max(1, Math.round(n.length));
      events.push({ tick: start, order: 3, data: [0x90 | ch, pitch, clampInt(n.velocity, 1, 127)] });
      events.push({ tick: end, order: 2, data: [0x80 | ch, pitch, 0x40] });
    }
    writeTrackChunk(out, events);
  }
  return out.result();
}

// ---------------------------------------------------------------------------
// Resolution conversion
// ---------------------------------------------------------------------------

export function rescaleToPpq(file: SmfFile, targetPpq: number): SmfFile {
  if (!(targetPpq > 0)) throw new RangeError(`targetPpq must be positive (got ${targetPpq})`);
  const scale = targetPpq / file.ppq;
  const s = (t: number): number => Math.max(0, Math.round(t * scale));
  return {
    format: file.format,
    ppq: targetPpq,
    tracks: file.tracks.map((t) => ({
      ...t,
      notes: t.notes.map((n) => {
        const start = s(n.start);
        const end = s(n.start + n.length);
        return { ...n, start, length: Math.max(1, end - start) };
      }),
    })),
    tempos: file.tempos.map((t) => ({ ...t, tick: s(t.tick) })),
    timeSigs: file.timeSigs.map((t) => ({ ...t, tick: s(t.tick) })),
  };
}
