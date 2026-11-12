// Sampler microphone tap (AudioWorklet). It hands the microphone sound to the page in small mono blocks,
// each with its loudest value so the page can draw a level meter. Nothing is played back or sent anywhere.
class SamplerTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(1024);
    this.n = 0;
    this.peak = 0;
  }

  process(inputs) {
    const ch = inputs[0][0];
    for (let i = 0; i < 128; i++) {
      const v = ch ? ch[i] : 0;
      this.buf[this.n++] = v;
      const a = v < 0 ? -v : v;
      if (a > this.peak) this.peak = a;
    }
    if (this.n >= 1024) {
      this.port.postMessage({ pcm: this.buf.slice(), peak: this.peak });
      this.n = 0;
      this.peak = 0;
    }
    return true;
  }
}
registerProcessor('mm-sampler', SamplerTap);
