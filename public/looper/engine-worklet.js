// Looper engine (AudioWorklet). ALL timing, recording and playback live here, counted in whole audio frames.
//
// How sync is guaranteed:
//  * One master clock: t0 = the frame the first loop started, M = its length in frames.
//  * A loop of length N (= k*M, k = 1, 2 or 4) plays the sample at  p = (frame - t0 - rel) mod N.
//    p is DERIVED from the frame counter every sample, never accumulated, so loops cannot drift apart.
//  * Record / overdub / play / stop requests are applied on the exact sample of the next master boundary.
//  * Input that arrives at frame t is the sound that was made at t - L (L = measured round-trip latency).
//    Loops keep recording L extra frames after the end, and are read with that shift, so notes land on the beat.
//  * No allocation on the audio thread: buffers come in by transfer and go back out by transfer.
//
// Outputs: 0 = metronome, 1..24 = loop slots (mono). The page routes each one through gain/pan/effects.

const MAX_SLOTS = 24;
const MAX_LAYERS = 8;
const EDGE_FADE = 128;     // loop-edge fade (frames, ~2.7 ms)
const PUNCH_FADE = 256;    // overdub punch-in / punch-out fade (~5 ms)
const MUTE_FRAMES = 384;   // mute / unmute ramp (~8 ms)
const Q = 128;             // render quantum

// the 12-step grid inside one beat: where each metronome "feel" puts its extra ticks (in twelfths of a beat)
const FEELS = { beat: [0], eighth: [0, 6], swing: [0, 8], sixteenth: [0, 3, 6, 9], none: [] };

function posMod(a, n) { const r = a % n; return r < 0 ? r + n : r; }

class LooperCore {
  constructor(sr, post) {
    this.sr = sr;
    this.post = post || function () {};
    this.playing = true;
    this.latency = Math.round(0.04 * sr);
    this.t0 = -1;          // master start frame (-1 = no master yet)
    this.M = 0;            // master length in frames (0 = not set yet)
    this.slots = [];
    for (let i = 0; i < MAX_SLOTS; i++) this.slots.push(this.newSlot());
    this.first = -1;       // slot that is recording the master (free length) right now
    this.metro = { on: false, bpm: 100, beatFrames: Math.round(sr * 0.6), perBar: 4, sound: 'click', feel: 'beat', vol: 0.7, countIn: true, anchor: 0, nBeats: 0 };
    this.voices = [];
    for (let i = 0; i < 12; i++) this.voices.push({ on: false, start: 0, kind: 0, amp: 0, freq: 0 });
    this.noise = 12345;
    this.cal = null;
    this.lastFrame = -1;
    this.glitches = 0;
    this.q = 0;
  }

  newSlot() {
    return { st: 0, k: 1, len: 0, rel: 0, off: 0, base: null, baseBuf: null, layers: [], gain: 1, gTarget: 1, muted: false, pend: null, rec: null, od: null };
  }

  // ---- messages from the page -------------------------------------------------------------------------------
  command(m, frame) {
    const s = m.slot != null ? this.slots[m.slot] : null;
    switch (m.type) {
      case 'setup': if (m.latency >= 0) this.latency = Math.min(Math.round(m.latency), Math.round(0.5 * this.sr)); break;
      case 'metro': this.setMetro(m, frame); break;
      case 'record': this.cmdRecord(m, s, frame); break;
      case 'stopRec': this.cmdStopRec(m, s, frame); break;
      case 'overdub':
        if (!s || s.st !== 2 || s.od || s.pend || s.layers.length >= MAX_LAYERS || !this.M || m.buf.byteLength < s.len * 4) { this.freeBuf(m.buf); this.emitSlot(m.slot, 'od-refused'); break; }
        s.pend = 'od'; s.odBuf = new Float32Array(m.buf); this.emitSlot(m.slot);
        break;
      case 'stopOverdub':
        if (!s) break;
        if (s.pend === 'od') { this.freeBuf(s.odBuf.buffer); s.odBuf = null; s.pend = null; }
        else if (s.od && s.od.end < 0) s.pend = 'odEnd';
        this.emitSlot(m.slot);
        break;
      case 'play': if (s && s.st === 3) { s.pend = 'play'; this.emitSlot(m.slot); } break;
      case 'stop': if (s && s.st === 2) { s.pend = 'stop'; this.emitSlot(m.slot); } break;
      case 'mute': if (s) { s.muted = !!m.on; s.gTarget = s.muted ? 0 : 1; this.emitSlot(m.slot); } break;
      case 'undo': this.cmdUndo(m, s); break;
      case 'clear': this.cmdClear(m.slot); break;
      case 'transport': this.cmdTransport(!!m.play, frame); break;
      case 'calibrate': this.cal = { buf: new Float32Array(m.buf), start: frame, n: 0, clicks: m.clicks }; break;
      case 'snapshot': this.snapQ = []; for (let i = 0; i < MAX_SLOTS; i++) if (this.slots[i].base && this.slots[i].st >= 2) this.snapQ.push(i); if (!this.snapQ.length) this.post({ type: 'snapDone', n: 0 }); this.snapN = this.snapQ.length; break;
      case 'load': this.cmdLoad(m, frame); break;
      case 'ping': this.post({ type: 'pong', frame, t0: this.t0, M: this.M }); break;
    }
  }

  setMetro(m, frame) {
    const mt = this.metro, wasOn = mt.on;
    if (m.bpm) { mt.bpm = m.bpm; mt.beatFrames = Math.max(1, Math.round(this.sr * 60 / m.bpm)); }
    if (m.perBar) mt.perBar = m.perBar;
    if (m.sound) mt.sound = m.sound;
    if (m.feel) mt.feel = m.feel;
    if (m.vol != null) mt.vol = m.vol;
    if (m.countIn != null) mt.countIn = !!m.countIn;
    if (m.on != null) mt.on = !!m.on;
    if (mt.on && !wasOn) mt.anchor = this.M ? this.t0 : frame;
    if (this.M) this.fitGrid();
    this.post({ type: 'metro', on: mt.on, bpm: this.gridBpm(), nBeats: mt.nBeats });
  }

  // with a master loop the beat grid always spans exactly M frames, so clicks and loops can never drift apart
  fitGrid() {
    const mt = this.metro, sec = this.M / this.sr;
    if (mt.nBeats && Math.abs(this.M - mt.nBeats * mt.beatFrames) < mt.nBeats) return; // recorded to the click: exact already
    let best = 4, bestD = 1e9;
    for (const n of [2, 3, 4, 6, 8, 12, 16, 24, 32]) {
      const d = Math.abs(60 * n / sec - 100);
      if (d < bestD) { bestD = d; best = n; }
    }
    mt.nBeats = best;
    if (best % mt.perBar) mt.perBar = best % 4 === 0 ? 4 : best;
  }
  gridBpm() { const mt = this.metro; return this.M && mt.nBeats ? 60 * mt.nBeats * this.sr / this.M : mt.bpm; }

  cmdRecord(m, s, frame) {
    if (!s || s.st !== 0 || s.pend || !this.playing) { this.freeBuf(m.buf); this.emitSlot(m.slot, 'refused'); return; }
    const buf = new Float32Array(m.buf);
    if (!this.M && this.first < 0) {
      // the FIRST loop: free length (or whole bars with the metronome); starts now, or after a one-bar count-in
      const mt = this.metro, bar = mt.beatFrames * mt.perBar;
      let start = frame;
      if (mt.on && mt.countIn) { start = frame + bar; s.st = 4; }
      else s.st = 1;
      if (mt.on) mt.anchor = frame;
      s.rec = { buf, start, n: 0, endLen: 0, first: true, L: this.latency };
      s.k = 1; this.first = m.slot; this.t0 = start;
      this.emitMaster();   // the page needs t0 now (to draw the count-in and the growing ring)
    } else if (this.M) {
      const k = m.k === 4 ? 4 : m.k === 2 ? 2 : 1;
      if (buf.length < k * this.M + this.latency) { this.freeBuf(m.buf); this.emitSlot(m.slot, 'refused'); return; }
      s.k = k; s.pend = 'rec'; s.recBuf = buf;
    } else { this.freeBuf(m.buf); this.emitSlot(m.slot, 'refused'); return; }
    this.emitSlot(m.slot);
  }

  cmdStopRec(m, s, frame) {
    if (!s) return;
    if (s.st === 4) { this.abortFirst(m.slot); return; }          // still counting in
    if (s.st === 1 && s.rec && s.rec.first && !s.rec.endLen) {
      const mt = this.metro, r = s.rec, elapsed = frame - r.start;
      const maxLen = r.buf.length - this.latency - Q;
      let N;
      if (mt.on) {
        const bar = mt.beatFrames * mt.perBar;
        N = Math.max(1, Math.round(elapsed / bar)) * bar;
        while (N > maxLen) N -= bar;
        if (N < bar) N = bar;
      } else N = Math.min(elapsed, maxLen);
      if (N < Math.round(0.25 * this.sr)) { this.abortFirst(m.slot); return; }
      this.finishFirstLength(m.slot, N);
    } else if (s.pend === 'rec') {                                  // cancel a not-yet-started recording
      this.freeBuf(s.recBuf.buffer); s.recBuf = null; s.pend = null; this.emitSlot(m.slot);
    } else if (s.st === 1 && s.rec && !s.rec.first) {               // cancel a recording in progress
      this.freeBuf(s.rec.buf.buffer); s.rec = null; s.st = 0; this.emitSlot(m.slot);
    }
  }

  finishFirstLength(i, N) {
    const s = this.slots[i], r = s.rec;
    r.endLen = N; s.len = N; s.off = r.L; s.rel = 0; s.k = 1;
    this.M = N; this.first = -1;
    const mt = this.metro;
    if (mt.on) { mt.nBeats = Math.round(N / mt.beatFrames); }
    else mt.nBeats = 0;
    mt.anchor = this.t0;
    if (mt.on) this.fitGrid();
    this.emitMaster();
    this.emitSlot(i);
  }

  abortFirst(i) {
    const s = this.slots[i];
    if (s.rec) this.freeBuf(s.rec.buf.buffer);
    s.rec = null; s.st = 0; this.first = -1; this.t0 = -1;
    this.emitSlot(i);
  }

  cmdUndo(m, s) {
    if (!s) return;
    if (s.pend === 'od') { this.freeBuf(s.odBuf.buffer); s.odBuf = null; s.pend = null; }
    else if (s.od) { this.freeBuf(s.od.layer.buffer); s.od = null; if (s.pend === 'odEnd') s.pend = null; }
    else if (s.layers.length) this.freeBuf(s.layers.pop().buffer);
    this.emitSlot(m.slot);
  }

  cmdClear(i) {
    const s = this.slots[i];
    if (!s) return;
    if (s.rec) this.freeBuf(s.rec.buf.buffer);
    if (s.recBuf) this.freeBuf(s.recBuf.buffer);
    if (s.odBuf) this.freeBuf(s.odBuf.buffer);
    if (s.od) this.freeBuf(s.od.layer.buffer);
    if (s.baseBuf) this.freeBuf(s.baseBuf);
    else if (s.base) this.freeBuf(s.base.buffer);
    for (const l of s.layers) this.freeBuf(l.buffer);
    if (this.first === i) { this.first = -1; this.t0 = -1; }
    this.slots[i] = this.newSlot();
    if (this.slots.every(x => x.st === 0 && !x.pend)) { this.M = 0; this.t0 = -1; this.first = -1; this.metro.nBeats = 0; this.emitMaster(); }
    this.emitSlot(i);
  }

  // save / export: one slot per render quantum, each mixed down (base + layers) into a plain array on the master timeline
  snapStep() {
    const i = this.snapQ.shift(), s = this.slots[i];
    if (s && s.base) {
      const out = new Float32Array(s.len);
      for (let p = 0; p < s.len; p++) { let v = s.base[p + s.off]; for (let l = 0; l < s.layers.length; l++) v += s.layers[l][p]; out[p] = v; }
      this.post({ type: 'snap', i, len: s.len, k: s.k, rel: s.rel, muted: s.muted, buf: out.buffer }, [out.buffer]);
    }
    if (!this.snapQ.length) this.post({ type: 'snapDone', n: this.snapN });
  }

  // restore a saved session into an empty engine (all loops start together at the next frame)
  cmdLoad(m, frame) {
    if (this.M || this.first >= 0 || !m.loops || !m.loops.length) { for (const l of (m.loops || [])) this.freeBuf(l.buf); this.post({ type: 'loadDone', ok: false }); return; }
    this.M = m.M; this.t0 = frame; this.playing = true;
    this.metro.nBeats = 0; this.metro.anchor = frame;
    for (const l of m.loops) {
      const s = this.slots[l.slot] = this.newSlot();
      s.base = new Float32Array(l.buf); s.baseBuf = l.buf; s.len = l.len; s.k = l.k; s.rel = l.rel; s.off = 0; s.st = 2;
      if (l.muted) { s.muted = true; s.gain = 0; s.gTarget = 0; }
      this.emitSlot(l.slot);
    }
    this.emitMaster();
    this.post({ type: 'loadDone', ok: true });
  }

  cmdTransport(play, frame) {
    if (play === this.playing) return;
    this.playing = play;
    if (!play) {
      if (this.first >= 0) { const s = this.slots[this.first]; if (s.st === 1) this.cmdStopRec({ slot: this.first }, s, frame); else if (s.st === 4) this.abortFirst(this.first); }
      for (let i = 0; i < MAX_SLOTS; i++) {
        const s = this.slots[i];
        if (s.pend === 'rec') { this.freeBuf(s.recBuf.buffer); s.recBuf = null; }
        if (s.pend === 'od') { this.freeBuf(s.odBuf.buffer); s.odBuf = null; }
        s.pend = null;
        if (s.od) { s.od.end = frame - 1; }
        if (s.st === 1 && s.rec && !s.rec.first) { this.freeBuf(s.rec.buf.buffer); s.rec = null; s.st = 0; }
        this.emitSlot(i);
      }
    } else {
      if (this.M) { this.t0 = frame; this.metro.anchor = frame; }
      this.metro.anchor = frame;
    }
    this.emitMaster();
  }

  freeBuf(ab) { if (ab && ab.byteLength) this.post({ type: 'free', buf: ab }, [ab]); }

  emitSlot(i, note) {
    const s = this.slots[i];
    this.post({
      type: 'slot', i, st: s.st, k: s.k, len: s.len, layers: s.layers.length, muted: s.muted,
      pend: s.pend, od: !!s.od, rel: s.rel, note: note || '',
    });
  }
  emitMaster() { this.post({ type: 'master', t0: this.t0, M: this.M, playing: this.playing, bpm: this.gridBpm(), nBeats: this.metro.nBeats, frame: this.lastFrame + Q }); }

  // ---- the render loop ---------------------------------------------------------------------------------------
  process(frame, input, outs) {
    if (this.lastFrame >= 0 && frame !== this.lastFrame + Q) this.glitches++;
    this.lastFrame = frame;
    const nOut = outs.length;
    for (let o = 0; o < nOut; o++) outs[o].fill(0);
    const M = this.M, t0 = this.t0, L = this.latency;
    const met = outs[0];

    // input level (for the little mic meter)
    let peak = 0;
    if (input) for (let i = 0; i < Q; i++) { const a = input[i] < 0 ? -input[i] : input[i]; if (a > peak) peak = a; }
    this.peak = Math.max(this.peak || 0, peak);
    if ((++this.q & 7) === 0) { this.post({ type: 'level', peak: this.peak, glitches: this.glitches, frame }); this.peak = 0; }

    if (this.snapQ && this.snapQ.length) this.snapStep();

    // calibration: play clicks, record the room
    if (this.cal) this.runCal(frame, input, met);

    // first master boundary inside this quantum (sample-exact)
    let bIdx = -1;
    if (M > 0 && this.playing && t0 >= 0 && this.first < 0) {
      const toB = posMod(t0 - frame, M);
      if (toB < Q) bIdx = toB;
    }

    if (this.playing) this.metroBlock(frame, met);

    for (let i = 0; i < Q; i++) {
      const f = frame + i;
      if (i === bIdx) this.boundary(f);
      const x = input ? input[i] : 0;
      for (let si = 0; si < MAX_SLOTS; si++) {
        const s = this.slots[si];
        if (s.st === 0) continue;
        // the first loop's count-in ends and recording starts
        if (s.st === 4 && f >= s.rec.start) { s.st = 1; this.emitSlot(si); }
        if (s.st === 1 && s.rec) {
          const r = s.rec;
          if (!this.playing) continue;
          const j = f - r.start;
          if (j >= 0 && j < r.buf.length) {
            // edge fade-in at the true loop start (raw index L after the latency shift)
            const d = j - r.L;
            r.buf[j] = d >= 0 && d < EDGE_FADE ? x * d / EDGE_FADE : x;
            r.n = j + 1;
          }
          if (r.first && !r.endLen && j >= r.buf.length - r.L - Q) this.cmdStopRec({ slot: si }, s, f); // buffer full: end the loop here
          if (r.endLen) {
            if (j >= r.endLen) { s.st = 2; this.emitSlot(si); }
          }
        }
        // first-loop tail: keep recording L frames after the end
        if (s.st === 2 && s.rec) {
          const r = s.rec, j = f - r.start;
          if (j < r.endLen + r.L) { const d = j - r.L; r.buf[j] = d >= 0 && d < EDGE_FADE ? x * d / EDGE_FADE : x; r.n = j + 1; }
          else this.finalizeBase(si);
        }
        if (s.od) this.writeOverdub(si, s, f, x);
        const src = s.base || (s.rec ? s.rec.buf : null);   // right after the end of the first pass the base is still being finished
        if (s.st === 2 && this.playing && src) {
          // mute ramp
          if (s.gain !== s.gTarget) {
            const step = 1 / MUTE_FRAMES;
            s.gain = s.gain < s.gTarget ? Math.min(s.gTarget, s.gain + step) : Math.max(s.gTarget, s.gain - step);
          }
          if (s.gain === 0) continue;
          const p = posMod(f - t0 - s.rel, s.len);
          let v = src[p + s.off];
          for (let li = 0; li < s.layers.length; li++) v += s.layers[li][p];
          if (s.od) { /* the layer being recorded is not monitored */ }
          outs[1 + si][i] = v * s.gain;
        }
      }
    }
  }

  boundary(f) {
    for (let si = 0; si < MAX_SLOTS; si++) {
      const s = this.slots[si];
      const act = s.pend;
      if (!act) continue;
      if (act === 'rec') {
        const N = s.k * this.M;
        s.rel = posMod(f - this.t0, N);
        s.rec = { buf: s.recBuf, start: f, n: 0, endLen: N, first: false, L: this.latency };
        s.recBuf = null; s.len = N; s.off = this.latency; s.st = 1; s.pend = null;
      } else if (act === 'od') {
        s.od = { layer: s.odBuf, start: f, end: -1 }; s.odBuf = null; s.pend = null;
      } else if (act === 'odEnd') {
        if (s.od) s.od.end = f; s.pend = null;
      } else if (act === 'play') { s.st = 2; s.pend = null; }
      else if (act === 'stop') { s.st = 3; s.pend = null; }
      this.emitSlot(si);
    }
  }

  writeOverdub(si, s, f, x) {
    const od = s.od, L = this.latency;
    const end = od.end >= 0 ? od.end + L : -1;
    if (end >= 0 && f >= end) {
      s.layers.push(od.layer); s.od = null; this.emitSlot(si); return;
    }
    const idx = posMod(f - this.t0 - s.rel - L, s.len);
    let w = Math.min(1, (f - od.start + 1) / PUNCH_FADE);
    if (end >= 0) { const wo = (end - f) / PUNCH_FADE; if (wo < w) w = wo; }
    od.layer[idx] += x * w;
  }

  // the first loop is done recording its tail: fade its two edges so the wrap point can never click
  finalizeBase(si) {
    const s = this.slots[si], r = s.rec, L = s.off, N = s.len, b = r.buf;
    // (the start edge was faded while recording; the end edge is faded now, a whole loop before it is first heard)
    for (let i = 0; i < EDGE_FADE; i++) b[L + N - 1 - i] *= i / EDGE_FADE;
    s.baseBuf = b.buffer; s.base = b; s.rec = null;
    this.emitSlot(si);
  }

  // ---- metronome ---------------------------------------------------------------------------------------------
  metroBlock(frame, out) {
    const mt = this.metro;
    const counting = this.first >= 0 && this.slots[this.first].st === 4;
    if (!(mt.on || counting)) return;
    const offs = FEELS[mt.feel] || FEELS.beat;
    let num, den, anchor = mt.anchor;
    if (this.M && mt.nBeats) { num = this.M; den = mt.nBeats; anchor = this.t0; }
    else { num = mt.beatFrames; den = 1; }
    if (frame >= anchor) {
      const i0 = Math.floor(((frame - anchor) * den) / num) - 1;
      for (let i = Math.max(0, i0); i <= i0 + 2; i++) {
        const accent = (i % mt.perBar) === 0;
        for (let k = 0; k < offs.length; k++) {
          const pos = anchor + Math.floor(((i * 12 + offs[k]) * num) / (den * 12));
          if (pos >= frame && pos < frame + Q) this.trigger(pos, accent && offs[k] === 0, offs[k] !== 0);
        }
        if (!offs.length) continue;
      }
    }
    const vol = counting ? Math.max(mt.vol, 0.7) : mt.vol;
    for (let v = 0; v < this.voices.length; v++) {
      const vo = this.voices[v];
      if (!vo.on) continue;
      for (let i = 0; i < Q; i++) {
        const age = frame + i - vo.start;
        if (age < 0) continue;
        const t = age / this.sr;
        let y = 0;
        if (vo.kind === 0) { y = Math.sin(6.2831853 * vo.freq * t) * Math.exp(-t / 0.006); if (t > 0.06) { vo.on = false; break; } }                    // click
        else if (vo.kind === 1) { y = (Math.sin(6.2831853 * vo.freq * t) + 0.6 * Math.sin(6.2831853 * vo.freq * 1.58 * t)) * Math.exp(-t / 0.018); if (t > 0.12) { vo.on = false; break; } } // wood
        else if (vo.kind === 2) { y = Math.sin(6.2831853 * vo.freq * t) * Math.exp(-t / 0.05); if (t > 0.3) { vo.on = false; break; } }               // beep
        else { this.noise = (this.noise * 1664525 + 1013904223) >>> 0; y = ((this.noise / 4294967296) * 2 - 1) * Math.exp(-t / 0.02); if (t > 0.12) { vo.on = false; break; } } // hat
        out[i] += y * vo.amp * vol;
      }
    }
  }

  trigger(pos, accent, soft) {
    const mt = this.metro;
    let vo = null;
    for (let v = 0; v < this.voices.length; v++) if (!this.voices[v].on) { vo = this.voices[v]; break; }
    if (!vo) return;
    const kind = { click: 0, wood: 1, beep: 2, hat: 3 }[mt.sound] || 0;
    const base = { click: 1800, wood: 900, beep: 660, hat: 0 }[mt.sound] || 1800;
    vo.on = true; vo.start = pos; vo.kind = kind;
    vo.freq = accent ? base * 1.5 : base;
    vo.amp = (accent ? 0.9 : soft ? 0.35 : 0.6);
  }

  // ---- latency calibration -----------------------------------------------------------------------------------
  runCal(frame, input, out) {
    const c = this.cal;
    for (let i = 0; i < Q; i++) {
      const j = frame + i - c.start;
      if (j >= 0 && j < c.buf.length) { c.buf[j] = input ? input[i] : 0; }
      for (let k = 0; k < c.clicks.length; k++) {
        const d = j - c.clicks[k];
        if (d >= 0 && d < 96) out[i] += 0.9 * Math.sin(6.2831853 * 2000 * d / this.sr) * (1 - d / 96);
      }
    }
    if (frame + Q - c.start >= c.buf.length) {
      this.post({ type: 'cal', buf: c.buf.buffer, clicks: c.clicks, sr: this.sr }, [c.buf.buffer]);
      this.cal = null;
    }
  }
}

if (typeof registerProcessor !== 'undefined') {
  class LooperProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.core = new LooperCore(sampleRate, (m, t) => this.port.postMessage(m, t || []));
      this.port.onmessage = (e) => this.core.command(e.data, currentFrame);
      this.outs = [];
    }
    process(inputs, outputs) {
      this.outs.length = 0;
      for (let o = 0; o < outputs.length; o++) this.outs.push(outputs[o][0]);
      const inp = inputs[0] && inputs[0][0] ? inputs[0][0] : null;
      this.core.process(currentFrame, inp, this.outs);
      return true;
    }
  }
  registerProcessor('looper-engine', LooperProcessor);
} else if (typeof globalThis !== 'undefined') {
  globalThis.__LooperCore = LooperCore;
}
