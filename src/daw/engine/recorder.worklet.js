// AudioWorklet: captures input PCM with the exact context frame of the first sample.
// Plain JS on purpose: worklet modules are loaded by URL and not transpiled.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.chunks = [];
    this.frames = 0;
    this.startFrame = -1;
    this.port.onmessage = (e) => {
      if (e.data.cmd === 'start') {
        this.active = true;
        this.startFrame = -1;
      } else if (e.data.cmd === 'stop') {
        this.active = false;
        this.flush(true);
      }
    };
  }

  flush(final) {
    if (this.chunks.length) {
      const chans = this.chunks[0].length;
      const total = this.chunks.reduce((n, c) => n + c[0].length, 0);
      const out = [];
      for (let ch = 0; ch < chans; ch++) {
        const buf = new Float32Array(total);
        let o = 0;
        for (const c of this.chunks) {
          buf.set(c[ch], o);
          o += c[ch].length;
        }
        out.push(buf);
      }
      this.port.postMessage({ type: 'data', channels: out, startFrame: this.startFrame, frames: this.frames }, out.map((b) => b.buffer));
      this.chunks = [];
    }
    if (final) this.port.postMessage({ type: 'stopped', startFrame: this.startFrame });
  }

  process(inputs) {
    const input = inputs[0];
    if (this.active && input && input.length) {
      if (this.startFrame < 0) {
        this.startFrame = currentFrame;
        this.frames = 0;
      }
      this.chunks.push(input.map((ch) => ch.slice()));
      this.frames += input[0].length;
      // ~0.37 s per message at 44.1 kHz keeps message overhead low
      if (this.chunks.length >= 128) this.flush(false);
    }
    return true;
  }
}
registerProcessor('daw-capture', CaptureProcessor);
