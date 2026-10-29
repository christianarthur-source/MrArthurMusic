/**
 * Microphone / line-input recording.
 *
 * Capture runs in an AudioWorklet so every captured sample has a known
 * AudioContext frame. The region is placed so that what the student played
 * against the beat lines up: we subtract output latency (they heard the beat
 * late) and input latency (their sound reached us late), plus an optional
 * user calibration offset.
 *
 * Browser limits (documented in ARCHITECTURE.md): latency values are
 * estimates reported by the browser; hardware-level round-trip latency and
 * ASIO-style low-latency monitoring are not available on the web.
 */

export interface InputDevice {
  deviceId: string;
  label: string;
}

export interface CaptureResult {
  channels: Float32Array[];
  sampleRate: number;
  /** Context time of the first captured sample. */
  startTime: number;
}

export class RecorderError extends Error {
  constructor(
    message: string,
    readonly kind: 'permission' | 'nodevice' | 'unsupported' | 'failed',
  ) {
    super(message);
    this.name = 'RecorderError';
  }
}

export async function listInputs(): Promise<InputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
}

export class InputRecorder {
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  readonly analyser: AnalyserNode;
  private monitorGain: GainNode;
  private chunks: Float32Array[][] = [];
  private startFrame = -1;
  private stopResolve: ((r: CaptureResult) => void) | null = null;
  private workletLoaded = false;
  onDisconnect: (() => void) | null = null;
  deviceId: string | null = null;

  constructor(private ctx: AudioContext) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = 0;
  }

  get isOpen() {
    return !!this.stream;
  }

  /** Requests microphone access. Only called when the student starts a recording feature. */
  async open(deviceId?: string): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new RecorderError('Recording is not supported in this browser.', 'unsupported');
    }
    if (!this.ctx.audioWorklet) throw new RecorderError('Recording needs a newer browser (AudioWorklet).', 'unsupported');
    this.close();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          // Music recording: keep the signal natural.
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new RecorderError('Microphone permission was denied. Click the lock icon in the address bar to allow the microphone, then try again.', 'permission');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new RecorderError('No microphone was found. Plug one in or check your sound settings.', 'nodevice');
      }
      throw new RecorderError(`Could not start the microphone (${name || 'unknown error'}).`, 'failed');
    }
    this.deviceId = deviceId ?? null;
    const track = this.stream.getAudioTracks()[0];
    track.onended = () => this.onDisconnect?.();
    if (!this.workletLoaded) {
      await this.ctx.audioWorklet.addModule(new URL('./recorder.worklet.js', import.meta.url));
      this.workletLoaded = true;
    }
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, 'daw-capture', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0; // keeps the worklet pulled by the graph without making sound
    this.source.connect(this.node).connect(this.sink).connect(this.ctx.destination);
    this.source.connect(this.analyser);
    this.source.connect(this.monitorGain);
    this.node.port.onmessage = (e) => this.onWorklet(e.data);
  }

  /** Route input to a track for monitoring (off by default: feedback risk without headphones). */
  setMonitor(dest: AudioNode | null) {
    this.monitorGain.disconnect();
    if (dest) {
      this.monitorGain.connect(dest);
      this.monitorGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.01);
    } else this.monitorGain.gain.value = 0;
  }

  /** Estimated input latency in seconds (browser-reported when available). */
  inputLatency(): number {
    const s = this.stream?.getAudioTracks()[0]?.getSettings() as MediaTrackSettings & { latency?: number };
    return typeof s?.latency === 'number' ? s.latency : 0.01;
  }

  start() {
    if (!this.node) throw new RecorderError('Microphone is not open.', 'failed');
    this.chunks = [];
    this.startFrame = -1;
    this.node.port.postMessage({ cmd: 'start' });
  }

  stop(): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
      if (!this.node) {
        reject(new RecorderError('Microphone is not open.', 'failed'));
        return;
      }
      this.stopResolve = resolve;
      this.node.port.postMessage({ cmd: 'stop' });
      setTimeout(() => {
        if (this.stopResolve) {
          this.stopResolve = null;
          reject(new RecorderError('The recording did not finish properly.', 'failed'));
        }
      }, 3000);
    });
  }

  private onWorklet(m: { type: string; channels?: Float32Array[]; startFrame: number }) {
    if (m.type === 'data' && m.channels) {
      if (this.startFrame < 0) this.startFrame = m.startFrame;
      this.chunks.push(m.channels);
    } else if (m.type === 'stopped' && this.stopResolve) {
      const nCh = this.chunks[0]?.length ?? 1;
      const total = this.chunks.reduce((n, c) => n + c[0].length, 0);
      const channels = Array.from({ length: nCh }, () => new Float32Array(total));
      let o = 0;
      for (const c of this.chunks) {
        c.forEach((ch, i) => channels[i].set(ch, o));
        o += c[0].length;
      }
      this.chunks = [];
      const resolve = this.stopResolve;
      this.stopResolve = null;
      resolve({ channels, sampleRate: this.ctx.sampleRate, startTime: Math.max(0, this.startFrame) / this.ctx.sampleRate });
    }
  }

  level(buf: Float32Array<ArrayBuffer>): number {
    if (!this.stream) return 0;
    this.analyser.getFloatTimeDomainData(buf);
    let p = 0;
    for (let i = 0; i < buf.length; i++) p = Math.max(p, Math.abs(buf[i]));
    return p;
  }

  close() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.source?.disconnect();
    this.node?.disconnect();
    this.sink?.disconnect();
    this.source = null;
    this.node = null;
  }
}
