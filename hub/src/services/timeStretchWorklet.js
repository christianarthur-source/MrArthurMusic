// AudioWorklet player that changes tempo and pitch independently (WSOLA time-stretch with
// resampled grains). Loaded by pitchShifterAudio.ts through `?url`, so this file must stay
// self-contained: no imports. TimeStretcher is exported so it can be tested in Node.

export class TimeStretcher {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    // ~46 ms grains with 50% overlap; a periodic Hann window sums to exactly 1 at this overlap.
    this.N = sampleRate > 64000 ? 4096 : 2048;
    this.hop = this.N / 2;
    // How far a grain may move to line up with the previous one (~9 ms).
    this.seekRange = Math.round(sampleRate * 0.009);
    this.window = new Float32Array(this.N);
    for (let j = 0; j < this.N; j++) this.window[j] = 0.5 - 0.5 * Math.cos((2 * Math.PI * j) / this.N);

    this.channels = [];
    this.mono = new Float32Array(0);
    this.length = 0;
    this.tempo = 1;
    this.pitch = 1;
    this.reset(0);
  }

  load(channels) {
    this.channels = channels;
    this.length = channels[0] ? channels[0].length : 0;
    // Downmix once, for lining grains up.
    this.mono = new Float32Array(this.length);
    for (const ch of channels) {
      for (let i = 0; i < this.length; i++) this.mono[i] += ch[i] / channels.length;
    }
    this.reset(0);
  }

  setParams(tempo, pitch) {
    this.tempo = tempo;
    this.pitch = pitch;
  }

  // Jump to a source position (in samples) and restart the grain stream there.
  reset(position) {
    const outChannels = Math.max(1, this.channels.length);
    this.acc = Array.from({ length: outChannels }, () => new Float32Array(this.N));
    this.pending = Array.from({ length: outChannels }, () => new Float32Array(this.hop));
    this.pendingPos = this.hop;
    this.prevStart = null;
    this.anaCenter = position;
    this.emitStart = position;
    // Prime with one grain so the first samples out are fully overlapped (no fade-in).
    this.synthesizeGrain();
    this.pendingPos = this.hop;
  }

  get finished() {
    return this.emitStart + this.tempo * this.pendingPos >= this.length;
  }

  // Source position (samples) of the next sample to be output.
  get position() {
    return Math.min(this.length, this.emitStart + this.tempo * this.pendingPos);
  }

  synthesizeGrain() {
    const { N, hop, tempo, pitch } = this;
    // Where this grain should start so its centre lands on the ideal source position.
    const ideal = this.anaCenter - (pitch * N) / 2;
    let start = ideal;
    if (this.prevStart !== null) {
      const target = this.prevStart + pitch * hop;
      // When tempo == pitch the grains simply continue each other (pure resampling).
      start = Math.abs(tempo - pitch) < 1e-6 ? target : this.bestAlignment(ideal, target);
    }

    const { acc, channels, window } = this;
    for (let c = 0; c < acc.length; c++) {
      const src = channels[c] || channels[0];
      const out = acc[c];
      if (!src) continue;
      for (let j = 0; j < N; j++) {
        const x = start + pitch * j;
        const i = Math.floor(x);
        if (i < 0 || i + 1 >= this.length) {
          if (i === this.length - 1) out[j] += src[i] * window[j];
          continue;
        }
        const f = x - i;
        out[j] += (src[i] + (src[i + 1] - src[i]) * f) * window[j];
      }
      // The first `hop` samples are now complete: move them out and shift the rest down.
      this.pending[c].set(out.subarray(0, hop));
      out.copyWithin(0, hop);
      out.fill(0, N - hop);
    }

    this.prevStart = start;
    this.emitStart = this.anaCenter - tempo * hop;
    this.anaCenter += tempo * hop;
    this.pendingPos = 0;
  }

  // Pick the start near `ideal` whose overlap best matches the natural continuation `target`.
  bestAlignment(ideal, target) {
    const { mono, length, seekRange } = this;
    const span = Math.max(64, Math.round(this.pitch * this.hop));
    const t0 = Math.round(target);
    const base = Math.round(ideal);

    const score = (offset) => {
      const s0 = base + offset;
      let corr = 0;
      let energy = 1e-9;
      for (let i = 0; i < span; i += 2) {
        const a = s0 + i;
        const b = t0 + i;
        const x = a >= 0 && a < length ? mono[a] : 0;
        const y = b >= 0 && b < length ? mono[b] : 0;
        corr += x * y;
        energy += x * x;
      }
      return corr / Math.sqrt(energy);
    };

    let best = 0;
    let bestScore = score(0);
    for (let d = -seekRange; d <= seekRange; d += 4) {
      if (d === 0) continue;
      const s = score(d);
      if (s > bestScore) { bestScore = s; best = d; }
    }
    const coarse = best;
    for (let d = coarse - 3; d <= coarse + 3; d++) {
      if (d === coarse) continue;
      const s = score(d);
      if (s > bestScore) { bestScore = s; best = d; }
    }
    return base + best;
  }

  // Fill output channel arrays; returns false once the source has run out.
  render(outputs, frames) {
    for (let f = 0; f < frames; f++) {
      if (this.pendingPos >= this.hop) this.synthesizeGrain();
      if (this.finished) {
        for (const out of outputs) out.fill(0, f);
        return false;
      }
      for (let c = 0; c < outputs.length; c++) {
        const p = this.pending[c] || this.pending[0];
        outputs[c][f] = p[this.pendingPos];
      }
      this.pendingPos++;
    }
    return true;
  }
}

if (typeof registerProcessor === 'function') {
  class TimeStretchProcessor extends AudioWorkletProcessor {
    constructor() {
      super();
      this.stretcher = new TimeStretcher(sampleRate);
      this.playing = false;
      this.port.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'load') {
          this.stretcher.load(msg.channels);
          this.playing = false;
        } else if (msg.type === 'params') {
          this.stretcher.setParams(msg.tempo, msg.pitch);
        } else if (msg.type === 'play') {
          this.stretcher.reset(Math.round(msg.offset * sampleRate));
          this.playing = true;
        } else if (msg.type === 'stop') {
          this.playing = false;
        }
      };
    }

    process(_inputs, outputs) {
      const out = outputs[0];
      if (!this.playing || this.stretcher.length === 0) return true;
      if (!this.stretcher.render(out, out[0].length)) {
        this.playing = false;
        this.port.postMessage({ type: 'ended' });
      }
      return true;
    }
  }
  registerProcessor('time-stretch-player', TimeStretchProcessor);
}
