// Sound Blocks: audio. Loads the world's loops, plays previews, plays the song with a small look-ahead scheduler,
// runs the effects, and records microphone clips.
// Every sound is started at an exact AudioContext time, so loops that start in the same slot stay locked together.
import { eventsFor, slotSeconds, isMic } from './song.js';

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
    this.mics = new Map(); // recording id -> { id, frames, sr, peaks }
    this.clipData = new Map(); // recording id -> Float32Array (mono)
    this.playing = false;
    this.entries = new Map(); // key -> { src, gain, cell, id }
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
      this.buildFx();
      for (const id of this.clipData.keys()) this.makeClipBuffer(id);
    }
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  // ---- effects: song sounds -> crunch -> muffle -> (dry + echo + reverb) -> master. Previews skip the effects. ----
  buildFx() {
    const c = this.ctx;
    this.bus = c.createGain();
    const dryC = c.createGain();
    const shaper = c.createWaveShaper();
    const wetC = c.createGain();
    const drive = 4; // soft saturation: quiet sounds get warmer, loud ones are held near the same level
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / (curve.length - 1)) * 2 - 1; curve[i] = (Math.tanh(drive * x) / Math.tanh(drive)) * 0.62; }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const post = c.createGain();
    this.bus.connect(dryC).connect(post);
    this.bus.connect(shaper).connect(wetC).connect(post);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 20000;
    lp.Q.value = 0.7;
    post.connect(lp);
    const split = c.createGain();
    lp.connect(split);
    split.connect(this.master); // dry
    const delay = c.createDelay(2);
    delay.delayTime.value = 0.4;
    const fb = c.createGain();
    fb.gain.value = 0.42;
    const echoWet = c.createGain();
    echoWet.gain.value = 0;
    split.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(echoWet).connect(this.master);
    const conv = c.createConvolver();
    conv.buffer = this.impulse(2.2);
    const revWet = c.createGain();
    revWet.gain.value = 0;
    split.connect(conv);
    conv.connect(revWet).connect(this.master);
    this.fxNodes = { dryC, wetC, lp, delay, echoWet, revWet };
  }

  impulse(seconds) {
    const c = this.ctx;
    const len = Math.round(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /** fx = { echo, reverb, muffle, crunch } 0-100; bpm lets the echo fall on a dotted eighth. */
  setFx(fx, bpm = 100) {
    if (!this.ctx) this.unlock();
    const n = this.fxNodes;
    const t = this.ctx.currentTime;
    const a = (v) => Math.max(0, Math.min(100, v)) / 100;
    const ramp = (param, v) => { try { param.setTargetAtTime(v, t, 0.04); } catch { param.value = v; } };
    ramp(n.echoWet.gain, a(fx.echo) * 0.7);
    ramp(n.delay.delayTime, Math.min(1.9, (60 / bpm) * 0.75));
    ramp(n.revWet.gain, a(fx.reverb) * 1.4);
    ramp(n.lp.frequency, 20000 * Math.pow(350 / 20000, a(fx.muffle)));
    ramp(n.wetC.gain, a(fx.crunch) * 0.85);
    ramp(n.dryC.gain, 1 - a(fx.crunch) * 0.55);
  }

  // ---- loading ----
  soundInfo(id) {
    if (isMic(id)) return this.mics.get(id);
    for (const w of this.catalog.worlds) for (const l of w.loops) if (l.id === id) return l;
    return this.catalog.fun.find((f) => f.id === id);
  }

  /** Fetch + decode one sound (shared in-flight promise). Resolves to the buffer, or null when it cannot be loaded. */
  load(id) {
    if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id));
    if (this.pending.has(id)) return this.pending.get(id);
    const info = this.soundInfo(id);
    if (!info || isMic(id)) return Promise.resolve(null);
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

  isReady(id) { return this.buffers.has(id) || this.mics.has(id); }

  /** A short beep for the count-in. */
  beep(freq = 660, seconds = 0.12) {
    const c = this.unlock();
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    o.type = 'sine';
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.01);
    g.gain.linearRampToValueAtTime(0, t + seconds);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + seconds + 0.02);
  }

  loadWorld(world) { return Promise.all(world.loops.map((l) => this.load(l.id))); }
  /** Quietly fetch the fun sounds one by one after the loops. */
  async loadFunInBackground() { for (const f of this.catalog.fun) await this.load(f.id); }

  /** Make a recording playable. pcm is mono Float32 at the context's sample rate (or `sr`). */
  addClip(id, pcm, sr, peaks) {
    this.mics.set(id, { id, frames: pcm.length, sr, peaks });
    this.clipData.set(id, pcm);
    if (this.ctx) this.makeClipBuffer(id); // otherwise it is made when the audio context is unlocked
    this.onReady(id);
  }
  makeClipBuffer(id) {
    const pcm = this.clipData.get(id);
    const info = this.mics.get(id);
    if (!pcm || !info || this.buffers.has(id)) return;
    const buf = this.ctx.createBuffer(1, pcm.length, info.sr);
    buf.copyToChannel(pcm, 0);
    this.buffers.set(id, buf);
  }
  hasClip(id) { return this.mics.has(id); }

  // ---- previews: one at a time ----
  async preview(id) {
    const buf = await this.load(id) || this.buffers.get(id);
    if (!buf) return false;
    this.stopPreview();
    const info = this.soundInfo(id);
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain).connect(this.master);
    const now = ctx.currentTime;
    const len = Math.min(buf.duration, (info && info.max) || 6);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + FADE);
    gain.gain.setValueAtTime(1, now + len - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + len);
    src.start(now, 0, len);
    this.prev = { src, gain, id, t0: now, len };
    src.onended = () => { if (this.prev && this.prev.src === src) { this.prev = null; this.onPreviewEnd(id); } };
    return true;
  }
  onPreviewEnd() {}
  stopPreview() {
    if (!this.prev) return;
    const { src, gain, id } = this.prev;
    this.prev = null;
    this.fadeStop(src, gain);
    this.onPreviewEnd(id);
  }
  get previewing() { return this.prev ? this.prev.id : null; }
  /** 0..1 how far the current preview has played (for the waveform), or null. */
  previewProgress() {
    if (!this.prev) return null;
    return Math.max(0, Math.min(1, (this.ctx.currentTime - this.prev.t0) / this.prev.len));
  }

  fadeStop(src, gain) {
    const t = this.ctx.currentTime;
    try { gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 0.03); src.stop(t + 0.04); } catch { /* already stopped */ }
  }

  // ---- the song ----
  get world() { return this.song ? this.catalog.worlds.find((w) => w.id === this.song.world) : null; }
  songLen() { const w = this.world; return w ? this.song.slots * slotSeconds(w) : 0; }

  setSong(song) {
    this.song = song;
    if (this.playing) this.sync();
  }

  /** startSlot lets the song begin partway in (used while recording a clip). */
  play(song, startSlot = 0) {
    this.unlock();
    this.stopPreview();
    this.song = song;
    if (this.playing) return;
    this.playing = true;
    const offset = startSlot * slotSeconds(this.world);
    this.t0 = this.ctx.currentTime + 0.1 - offset;
    this.scheduledUntil = offset;
    this.passes = [{ idx: 0, base: 0, len: this.songLen() }];
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    for (const e of this.entries.values()) this.fadeStop(e.src, e.gain);
    this.entries.clear();
    this.passes = [];
  }

  /** Where the song is now: seconds into the current pass, the pass length (changes only at a pass boundary), or null when stopped. */
  position() {
    if (!this.playing) return null;
    const out = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    const T = this.ctx.currentTime - out - this.t0;
    const p = this.passes.find((q) => T >= q.base && T < q.base + q.len) || this.passes[this.passes.length - 1];
    return { t: Math.max(0, T - p.base), len: p.len, pass: p.idx, started: T >= 0 };
  }

  tick() {
    const w = this.world;
    if (!w || !this.playing) return;
    const T = this.ctx.currentTime - this.t0;
    const horizon = T + LOOKAHEAD;
    const events = eventsFor(this.song, this.catalog);
    let guard = 0;
    while (this.scheduledUntil < horizon && guard++ < 8) {
      const cur = this.passes[this.passes.length - 1];
      const end = cur.base + cur.len;
      const to = Math.min(horizon, end);
      for (const ev of events) {
        const abs = cur.base + ev.start;
        if (ev.start < cur.len && abs >= this.scheduledUntil && abs < to) this.start(ev, cur.idx, abs, 0);
      }
      this.scheduledUntil = to;
      if (to >= end) { // a new pass starts here, and it takes the song's length as it is now (so "+" grows the song at the loop point)
        this.passes.push({ idx: cur.idx + 1, base: end, len: this.songLen() });
      }
    }
    while (this.passes.length > 2 && this.passes[0].base + this.passes[0].len < T - 1) this.passes.shift();
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
    const T = this.ctx.currentTime - this.t0;
    if (T < 0) return;
    for (const p of this.passes) {
      if (T >= p.base + p.len) continue;
      for (const ev of events) {
        if (ev.start >= p.len) continue;
        const abs = p.base + ev.start;
        if (abs >= this.scheduledUntil && p === this.passes[this.passes.length - 1]) continue; // the next tick will schedule it
        if (abs + ev.dur <= T + 0.03) continue; // already over
        this.start(ev, p.idx, abs, Math.max(0, T + 0.03 - abs));
      }
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
    src.connect(gain).connect(this.bus);
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

  // ---- microphone ----
  /** Where the recorded clip goes if the song was playing while it was made: the sound comes back late by the device's delay. */
  async openMic() {
    this.unlock();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('no mic support'), { code: 'unsupported' });
    if (!this.recReady) {
      await this.ctx.audioWorklet.addModule('recorder-worklet.js');
      this.recReady = true;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (err) {
      throw Object.assign(new Error('mic blocked'), { code: err && err.name === 'NotFoundError' ? 'none' : 'blocked' });
    }
    const src = this.ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(this.ctx, 'sb-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    src.connect(node).connect(mute).connect(this.ctx.destination); // silent: the microphone must never play back
    const session = {
      node,
      sr: this.ctx.sampleRate,
      onLevel: () => {},
      /** Start capturing now. Resolves with mono Float32 samples exactly `seconds` long. */
      capture: (seconds, compensateSeconds = 0) => new Promise((resolve, reject) => {
        const frames = Math.round(seconds * this.ctx.sampleRate);
        const skip = Math.round(compensateSeconds * this.ctx.sampleRate);
        node.port.onmessage = (e) => {
          if (e.data.type === 'level') session.onLevel(e.data.v);
          else if (e.data.type === 'done') {
            const raw = e.data.data;
            let out = raw;
            if (skip > 0 && skip < raw.length) { out = new Float32Array(raw.length); out.set(raw.subarray(skip)); }
            resolve(out);
          }
        };
        session.cancelled = () => reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }));
        node.port.postMessage({ type: 'start', frames: frames + skip });
      }),
      cancel: () => { node.port.postMessage({ type: 'cancel' }); if (session.cancelled) session.cancelled(); },
      close: () => {
        try { stream.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ }
        try { src.disconnect(); node.disconnect(); mute.disconnect(); } catch { /* already gone */ }
      },
    };
    return session;
  }
}
