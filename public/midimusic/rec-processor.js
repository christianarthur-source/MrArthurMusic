// Recorder tap (AudioWorklet). It only listens: it sits beside the path to the speakers, so recording
// adds no delay to what the student hears. Sound is sent straight to the encoder worker in 16-bit blocks.
class Recorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.out = null;
    this.on = false;
    this.L = new Int16Array(4096);
    this.R = new Int16Array(4096);
    this.n = 0;
    this.port.onmessage = (e) => {
      if (e.data.port) this.out = e.data.port;
      if ('on' in e.data) {
        if (this.on && !e.data.on) this.flush(true);
        this.on = e.data.on;
        if (this.on) this.n = 0;
      }
    };
  }

  flush(end) {
    if (this.out) {
      if (this.n) this.out.postMessage({ l: this.L.slice(0, this.n), r: this.R.slice(0, this.n) });
      if (end) this.out.postMessage({ end: true });
    }
    this.n = 0;
  }

  process(inputs) {
    if (!this.on) return true;
    const l = inputs[0][0];
    const r = inputs[0][1] || l;
    for (let i = 0; i < 128; i++) {
      // silence arrives as "no channels": keep counting so pauses stay in the recording
      const a = l ? Math.max(-1, Math.min(1, l[i])) : 0;
      const b = r ? Math.max(-1, Math.min(1, r[i])) : 0;
      this.L[this.n] = a * 32767;
      this.R[this.n] = b * 32767;
      this.n++;
    }
    if (this.n >= 4096) this.flush(false);
    return true;
  }
}
registerProcessor('mm-recorder', Recorder);
