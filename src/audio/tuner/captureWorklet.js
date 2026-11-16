// AudioWorklet: copies microphone input into fixed 512-sample blocks and posts them to the page.
// Plain JS on purpose (worklet modules are loaded by URL and not transpiled). No outputs, so
// nothing is ever played back.
const BLOCK = 512;

class TunerCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(BLOCK);
    this.fill = 0;
    this.running = true;
    this.port.onmessage = (e) => {
      if (e.data && e.data.cmd === 'stop') this.running = false;
    };
  }

  process(inputs) {
    if (!this.running) return false;
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const n = Math.min(BLOCK - this.fill, ch.length - i);
      this.buf.set(ch.subarray(i, i + n), this.fill);
      this.fill += n;
      i += n;
      if (this.fill === BLOCK) {
        const out = this.buf;
        this.port.postMessage({ samples: out, sampleRate: sampleRate }, [out.buffer]);
        this.buf = new Float32Array(BLOCK);
        this.fill = 0;
      }
    }
    return true;
  }
}

registerProcessor('tuner-capture', TunerCapture);
