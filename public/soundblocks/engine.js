// Sound Blocks: audio. Loads the world's loops, plays previews, and plays the song with a small look-ahead scheduler.
// Every sound is started at an exact AudioContext time, so loops that start in the same slot stay locked together.
import { SLOTS, eventsFor, slotSeconds } from './song.js';

const LOOKAHEAD = 0.3; // seconds scheduled ahead
const TICK_MS = 60;
const FADE = 0.012; // click-free starts and stops

export class Engine {
  constructor(catalog) {
    this.catalog = catalog;
    this.ctx = null;
    this.buffers = new Map(); // sound id -> AudioBuffer (gapless-trimmed)
    this.pending = new Map(); // sound id -> Promise
    this.failed = new Set();
    this.playing = false;
    this.entries = new Map(); // key -> { src, gain, cell, id, end }
    this.song = null;
    this.onReady = () => {};
  }

  /** Must run inside a click/tap the first time (browsers keep audio locked until then). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;
      const comp = this.ctx.createDynamicsCompressor(); // many loops at once must not clip
      comp.threshold.value = -12;
      comp.knee.value = 12;
      comp.ratio.value = 5;
      this.master.connect(comp).connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  soundInfo(id) {
    for (const w of this.catalog.worlds) for (const l of w.loops) if (l.id === id) return l;
    return this.catalog.fun.find((f) => f.id === id);
  }

  /** Fetch + decode one sound (shared in-flight promise). Resolves to the buffer, or null when it cannot be loaded. */
  load(id) {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id));
    if (this.pending.has(id)) return this.pending.get(id);
    const info = this.soundInfo(id);
    if (!info) return Promise.resolve(null);
    this.unlock();
    const p = fetch(info.file)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then((bytes) => this.ctx.decodeAudioData(bytes))
      .then((buf) => {
        const t = this.trim(buf, info);
        this.buffers.set(id, t);
        this.failed.delete(id);
        this.pending.delete(id);
        this.onReady(id);
        return t;
      })
      .catch((err) => {
        console.warn('[Sound Blocks] could not load', id, err);
        this.failed.add(id);
        this.pending.delete(id);
        this.onReady(id);
        return null;
      });
    this.pending.set(id, p);
    return p;
  }

  // MP3 adds a little silence at the start; browsers differ on whether decodeAudioData removes it, so use the catalog's exact numbers.
  trim(buf, info) {
    const k = buf.sampleRate / info.sr;
    const want = Math.round(info.frames * k);
    const delay = Math.round(info.delay * k);
    const extra = buf.length - want;
    if (extra <= 2) return buf; // the browser already trimmed it
    const start = extra >= delay * 0.9 && buf.length >= delay + want ? delay : 0;
    const out = this.ctx.createBuffer(buf.numberOfChannels, want, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start, start + want), c);
    return out;
  }

  isReady(id) { return this.buffers.has(id); }

  loadWorld(world) { return Promise.all(world.loops.map((l) => this.load(l.id))); }
  /** Quietly fetch the fun sounds one by one after the loops. */
  async loadFunInBackground() { for (const f of this.catalog.fun) await this.load(f.id); }

  // ---- previews: one at a time ----
  async preview(id) {
    const buf = await this.load(id);
    if (!buf) return false;
    this.stopPreview();
    const info = this.soundInfo(id);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    const now = ctx.currentTime;
    const len = Math.min(buf.duration, info.max || 6);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    gain.gain.setValueAtTime(1, now + len - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + len);
    src.start(now, 0, len);
    this.prev = { src, gain, id };
    src.onended = () => { if (this.prev && this.prev.src === src) { this.prev = null; this.onPreviewEnd(id); } };
    return true;
  }
  onPreviewEnd() {}
  stopPreview() {
    if (!this.prev) return;
    const { src, gain } = this.prev;
    this.prev = null;
    this.fadeStop(src, gain);
  }
  get previewing() { return this.prev ? this.prev.id : null; }

  fadeStop(src, gain) {
    const t = this.ctx.currentTime;
    try { gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 0.03); src.stop(t + 0.04); } catch { /* already stopped */ }
  }

  // ---- the song ----
  get world() { return this.song ? this.catalog.worlds.find((w) => w.id === this.song.world) : null; }

  setSong(song) {
    this.song = song;
    if (this.playing) this.sync();
  }

  play(song) {
    this.unlock();
    this.stopPreview();
    this.song = song;
    if (this.playing) return;
    this.playing = true;
    this.t0 = this.ctx.currentTime + 0.1;
    this.scheduledUntil = 0;
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    for (const e of this.entries.values()) this.fadeStop(e.src, e.gain);
    this.entries.clear();
  }

  /** Song time in seconds (wraps), and the pass number. null when stopped. */
  position() {
    if (!this.playing) return null;
    const w = this.world;
    const len = SLOTS * slotSeconds(w);
    const out = (this.ctx.outputLatency || this.ctx.baseLatency || 0);
    const T = this.ctx.currentTime - out - this.t0;
    return { t: ((T % len) + len) % len, len, pass: Math.floor(T / len), started: T >= 0 };
  }

  tick() {
    const w = this.world;
    if (!w || !this.playing) return;
    const len = SLOTS * slotSeconds(w);
    const T = this.ctx.currentTime - this.t0;
    const horizon = T + LOOKAHEAD;
    const events = eventsFor(this.song, this.catalog);
    const from = Math.floor(Math.max(this.scheduledUntil, 0) / len);
    const to = Math.floor(horizon / len);
    for (let k = from; k <= to; k++) {
      for (const ev of events) {
        const abs = k * len + ev.start;
        if (abs >= this.scheduledUntil && abs < horizon) this.start(ev, k, abs, 0);
      }
    }
    this.scheduledUntil = horizon;
  }

  /** The song changed while playing: stop what was removed or moved, and let new blocks join in time. */
  sync() {
    const w = this.world;
    if (!w) return;
    const events = eventsFor(this.song, this.catalog);
    const present = new Set(events.map((e) => `${e.cell}=${e.id}`));
    for (const [key, e] of this.entries) {
      if (!present.has(`${e.cell}=${e.id}`)) { this.fadeStop(e.src, e.gain); this.entries.delete(key); }
    }
    const len = SLOTS * slotSeconds(w);
    const T = this.ctx.currentTime - this.t0;
    if (T < 0) return;
    const k = Math.floor(T / len);
    for (const ev of events) {
      const abs = k * len + ev.start;
      if (abs >= this.scheduledUntil) continue; // the next tick will schedule it
      if (abs + ev.dur <= T + 0.03) continue; // already over this pass
      this.start(ev, k, abs, Math.max(0, T + 0.03 - abs));
    }
  }

  start(ev, pass, abs, offset) {
    const key = `${pass}:${ev.cell}`;
    const old = this.entries.get(key);
    if (old && old.id === ev.id) return; // already playing / scheduled
    if (old) { this.fadeStop(old.src, old.gain); this.entries.delete(key); }
    const buf = this.buffers.get(ev.id);
    if (!buf) { this.load(ev.id); return; } // not ready: onReady -> sync() lets it join late
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    const when = Math.max(ctx.currentTime, this.t0 + abs + offset);
    const len = ev.dur - offset;
    if (len <= 0.02) return;
    gain.gain.setValueAtTime(offset > 0 ? 0 : 1, when);
    if (offset > 0) gain.gain.linearRampToValueAtTime(1, when + FADE);
    if (ev.kind === 'fun') { // fun sounds fade out so a long sound never ends in a click
      gain.gain.setValueAtTime(1, Math.max(when, when + len - 0.08));
      gain.gain.linearRampToValueAtTime(0, when + len);
    }
    src.start(when, offset, ev.kind === 'fun' ? len : undefined);
    const entry = { src, gain, cell: ev.cell, id: ev.id };
    this.entries.set(key, entry);
    src.onended = () => { if (this.entries.get(key) === entry) this.entries.delete(key); };
  }
}
