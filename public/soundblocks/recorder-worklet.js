// Sound Blocks: records exactly N frames of microphone input, counted on the audio clock (not by timers).
// Messages in:  { type: 'start', frames } | { type: 'cancel' }
// Messages out: { type: 'level', v } about 20 times a second, and { type: 'done', data: Float32Array } when `frames` have been captured.
class SoundBlocksRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = null;
    this.n = 0;
    this.lv = 0;
    this.count = 0;
    this.port.onmessage = (e) => {
      if (e.data.type === 'start') { this.buf = new Float32Array(e.data.frames); this.n = 0; }
      else if (e.data.type === 'cancel') this.buf = null;
    };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    const size = ch ? ch.length : 128;
    if (ch) for (let i = 0; i < size; i++) { const a = Math.abs(ch[i]); if (a > this.lv) this.lv = a; }
    if (this.buf) {
      const take = Math.min(size, this.buf.length - this.n);
      if (ch) this.buf.set(ch.subarray(0, take), this.n); // no input yet counts as silence, so the length is always exact
      this.n += take;
      if (this.n >= this.buf.length) {
        const data = this.buf;
        this.buf = null;
        this.port.postMessage({ type: 'done', data }, [data.buffer]);
      }
    }
    if (++this.count % 8 === 0) { this.port.postMessage({ type: 'level', v: this.lv }); this.lv = 0; }
    return true;
  }
}
registerProcessor('sb-rec', SoundBlocksRecorder);
