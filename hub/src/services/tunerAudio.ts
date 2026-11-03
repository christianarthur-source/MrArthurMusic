// Real-Time Chromatic Pitch Detection using Autocorrelation with Parabolic Interpolation

export interface PitchData {
  frequency: number;
  noteName: string;
  octave: number;
  cents: number;
  inTune: boolean;
  clarity: number; // 0 to 1 signal quality
  volumeRms: number; // 0 to 1
}

export interface TunerPreset {
  name: string;
  category: string;
  notes: { note: string; octave: number; freq: number }[];
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const TUNER_PRESETS: TunerPreset[] = [
  {
    name: 'Chromatic',
    category: 'General',
    notes: []
  },
  {
    name: 'Ukulele (Standard C: G4-C4-E4-A4)',
    category: 'Strings',
    notes: [
      { note: 'G', octave: 4, freq: 392.0 },
      { note: 'C', octave: 4, freq: 261.63 },
      { note: 'E', octave: 4, freq: 329.63 },
      { note: 'A', octave: 4, freq: 440.0 }
    ]
  },
  {
    name: 'Guitar (Standard: E-A-D-G-B-E)',
    category: 'Strings',
    notes: [
      { note: 'E', octave: 2, freq: 82.41 },
      { note: 'A', octave: 2, freq: 110.0 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'G', octave: 3, freq: 196.0 },
      { note: 'B', octave: 3, freq: 246.94 },
      { note: 'E', octave: 4, freq: 329.63 }
    ]
  },
  {
    name: 'Violin (G3-D4-A4-E5)',
    category: 'Strings',
    notes: [
      { note: 'G', octave: 3, freq: 196.0 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.0 },
      { note: 'E', octave: 5, freq: 659.25 }
    ]
  },
  {
    name: 'Viola (C3-G3-D4-A4)',
    category: 'Strings',
    notes: [
      { note: 'C', octave: 3, freq: 130.81 },
      { note: 'G', octave: 3, freq: 196.0 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'A', octave: 4, freq: 440.0 }
    ]
  },
  {
    name: 'Cello (C2-G2-D3-A3)',
    category: 'Strings',
    notes: [
      { note: 'C', octave: 2, freq: 65.41 },
      { note: 'G', octave: 2, freq: 98.0 },
      { note: 'D', octave: 3, freq: 146.83 },
      { note: 'A', octave: 3, freq: 220.0 }
    ]
  },
  {
    name: 'Recorder (Soprano C4-D6 Range)',
    category: 'Woodwind',
    notes: [
      { note: 'C', octave: 4, freq: 261.63 },
      { note: 'D', octave: 4, freq: 293.66 },
      { note: 'E', octave: 4, freq: 329.63 },
      { note: 'F', octave: 4, freq: 349.23 },
      { note: 'G', octave: 4, freq: 392.0 },
      { note: 'A', octave: 4, freq: 440.0 },
      { note: 'B', octave: 4, freq: 493.88 },
      { note: 'C', octave: 5, freq: 523.25 }
    ]
  }
];

export class TunerAudioEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private buffer: Float32Array = new Float32Array(2048);
  private refA4: number = 440;
  private isListening: boolean = false;
  private animationFrameId: number | null = null;
  private onPitchCallback: ((pitch: PitchData | null) => void) | null = null;
  private noiseGateThreshold: number = 0.015; // RMS threshold

  public setRefA4(freq: number): void {
    this.refA4 = Math.max(415, Math.min(466, freq));
  }

  public getRefA4(): number {
    return this.refA4;
  }

  public setNoiseGate(threshold: number): void {
    this.noiseGateThreshold = threshold;
  }

  public async start(onPitch: (pitch: PitchData | null) => void, deviceId?: string): Promise<boolean> {
    try {
      this.onPitchCallback = onPitch;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sourceNode.connect(this.analyser);

      this.buffer = new Float32Array(this.analyser.fftSize);
      this.isListening = true;

      this.detectLoop();
      return true;
    } catch (err) {
      console.error('Microphone access failed for tuner:', err);
      this.stop();
      return false;
    }
  }

  public stop(): void {
    this.isListening = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.onPitchCallback) {
      this.onPitchCallback(null);
    }
  }

  public isRunning(): boolean {
    return this.isListening;
  }

  private detectLoop = (): void => {
    if (!this.isListening || !this.analyser || !this.audioCtx) return;

    (this.analyser as any).getFloatTimeDomainData(this.buffer);

    // Calculate RMS volume
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);

    if (rms < this.noiseGateThreshold) {
      if (this.onPitchCallback) this.onPitchCallback(null);
      this.animationFrameId = requestAnimationFrame(this.detectLoop);
      return;
    }

    const pitchInfo = this.autoCorrelate(this.buffer, this.audioCtx.sampleRate);
    if (pitchInfo && pitchInfo.frequency > 50 && pitchInfo.frequency < 2500) {
      const pitchData = this.calculatePitchData(pitchInfo.frequency, pitchInfo.clarity, rms);
      if (this.onPitchCallback) this.onPitchCallback(pitchData);
    } else {
      if (this.onPitchCallback) this.onPitchCallback(null);
    }

    this.animationFrameId = requestAnimationFrame(this.detectLoop);
  };

  // Autocorrelation algorithm with parabolic peak interpolation
  private autoCorrelate(buf: Float32Array, sampleRate: number): { frequency: number; clarity: number } | null {
    const size = buf.length;
    const maxSamples = Math.floor(size / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    for (let i = 0; i < size; i++) {
      const val = buf[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return null;

    let lastCorrelation = 1;
    for (let offset = 4; offset < maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxSamples; i++) {
        correlation += Math.abs(buf[i] - buf[i + offset]);
      }
      correlation = 1 - correlation / maxSamples;

      if (correlation > 0.88 && correlation > lastCorrelation) {
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      }
      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.85 && bestOffset > 0) {
      // Parabolic interpolation for sub-sample accuracy
      const shift =
        (buf[bestOffset + 1] - buf[bestOffset - 1]) /
        (2 * (2 * buf[bestOffset] - buf[bestOffset - 1] - buf[bestOffset + 1]) || 1);
      const exactOffset = bestOffset + shift;
      const freq = sampleRate / exactOffset;
      return { frequency: freq, clarity: bestCorrelation };
    }

    return null;
  }

  private calculatePitchData(frequency: number, clarity: number, rms: number): PitchData {
    // 12 * log2(freq / A4) + 69 = midi number
    const midiNumber = 12 * (Math.log(frequency / this.refA4) / Math.log(2)) + 69;
    const roundedMidi = Math.round(midiNumber);
    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const octave = Math.floor(roundedMidi / 12) - 1;

    // Cents offset (-50 to +50)
    const exactIdealFreq = this.refA4 * Math.pow(2, (roundedMidi - 69) / 12);
    const cents = Math.floor((1200 * Math.log(frequency / exactIdealFreq)) / Math.log(2));
    const inTune = Math.abs(cents) <= 4; // within 4 cents is in-tune

    return {
      frequency: Math.round(frequency * 10) / 10,
      noteName,
      octave,
      cents: Math.max(-50, Math.min(50, cents)),
      inTune,
      clarity: Math.min(1, clarity),
      volumeRms: Math.min(1, rms * 5)
    };
  }
}

export const tunerEngine = new TunerAudioEngine();
