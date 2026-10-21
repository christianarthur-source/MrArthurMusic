/**
 * High-performance real-time microphone pitch detector for "Staff Wars Live".
 * Uses time-domain autocorrelation / YIN-style NSDF to detect fundamental pitch,
 * note step, octave, cents deviation, and volume from acoustic instruments.
 */

export interface PitchDetectionResult {
  frequency: number;
  midi: number;
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  accidental: '' | '#' | 'b';
  octave: number;
  noteName: string; // e.g. "C4", "F#5"
  writtenStep: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'; // after instrument transposition
  writtenOctave: number;
  writtenNoteName: string;
  cents: number; // -50 to +50
  volume: number; // 0 to 1
  clarity: number; // 0 to 1 confidence
}

export type InstrumentTransposition = 'C' | 'Bb' | 'Eb' | 'F';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export class LivePitchDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animId: number | null = null;
  private isRunning: boolean = false;
  private transposition: InstrumentTransposition = 'C';
  private onPitchCallback: ((res: PitchDetectionResult | null) => void) | null = null;

  // Smoothing & stable pitch tracking
  private stableStep: string = '';
  private stableFrames: number = 0;
  private minStableFrames: number = 2; // ~60ms stability requirement

  public setTransposition(trans: InstrumentTransposition) {
    this.transposition = trans;
  }

  public getTransposition(): InstrumentTransposition {
    return this.transposition;
  }

  public async start(
    onPitch: (res: PitchDetectionResult | null) => void,
    transposition: InstrumentTransposition = 'C'
  ): Promise<boolean> {
    this.transposition = transposition;
    this.onPitchCallback = onPitch;

    if (this.isRunning) return true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.mediaStream = stream;
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;

      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);

      this.isRunning = true;
      this.stableStep = '';
      this.stableFrames = 0;

      this.processLoop();
      return true;
    } catch (err) {
      console.error('Failed to start Live Pitch Detector:', err);
      this.stop();
      return false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
    if (this.onPitchCallback) {
      this.onPitchCallback(null);
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private processLoop = () => {
    if (!this.isRunning || !this.analyser || !this.audioCtx) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    const result = this.detectPitch(buffer, this.audioCtx.sampleRate);
    if (result && this.onPitchCallback) {
      // Stability check
      if (result.writtenStep === this.stableStep) {
        this.stableFrames++;
      } else {
        this.stableStep = result.writtenStep;
        this.stableFrames = 1;
      }

      if (this.stableFrames >= this.minStableFrames) {
        this.onPitchCallback(result);
      } else {
        this.onPitchCallback(null);
      }
    } else if (this.onPitchCallback) {
      this.stableStep = '';
      this.stableFrames = 0;
      this.onPitchCallback(null);
    }

    this.animId = requestAnimationFrame(this.processLoop);
  };

  /**
   * Fast Normalized Square Difference Function (Autocorrelation)
   */
  private detectPitch(buf: Float32Array, sampleRate: number): PitchDetectionResult | null {
    // 1. RMS volume calculation
    let sumSquares = 0;
    for (let i = 0; i < buf.length; i++) {
      sumSquares += buf[i] * buf[i];
    }
    const rms = Math.sqrt(sumSquares / buf.length);
    if (rms < 0.012) {
      return null; // Silence / background noise
    }

    // 2. Autocorrelation
    const minPeriod = Math.floor(sampleRate / 1200); // Max pitch ~1200Hz
    const maxPeriod = Math.floor(sampleRate / 55);   // Min pitch ~55Hz (A1)
    let bestPeriod = -1;
    let maxCorr = -1;

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let corr = 0;
      let energy = 0;
      for (let i = 0; i < buf.length - period; i++) {
        corr += buf[i] * buf[i + period];
        energy += buf[i] * buf[i] + buf[i + period] * buf[i + period];
      }
      const normCorr = (2 * corr) / (energy + 1e-6);

      if (normCorr > 0.82 && normCorr > maxCorr) {
        maxCorr = normCorr;
        bestPeriod = period;
      }
    }

    if (bestPeriod === -1 || maxCorr < 0.82) {
      return null;
    }

    // 3. Parabolic Interpolation for exact sub-sample frequency
    const p = bestPeriod;
    let delta = 0;
    if (p > minPeriod && p < maxPeriod) {
      const alpha = this.getLagCorr(buf, p - 1);
      const beta = this.getLagCorr(buf, p);
      const gamma = this.getLagCorr(buf, p + 1);
      delta = (0.5 * (alpha - gamma)) / (alpha - 2 * beta + gamma + 1e-9);
    }

    const exactPeriod = bestPeriod + delta;
    const frequency = sampleRate / exactPeriod;

    // 4. MIDI Pitch & Note conversion
    // 440Hz is A4 (MIDI 69)
    const exactMidi = 12 * Math.log2(frequency / 440) + 69;
    const soundingMidi = Math.round(exactMidi);
    const cents = Math.round((exactMidi - soundingMidi) * 100);

    const noteIdx = ((soundingMidi % 12) + 12) % 12;
    const rawNoteStr = NOTE_NAMES[noteIdx];
    const soundingOctave = Math.floor(soundingMidi / 12) - 1;

    const soundingStep = rawNoteStr.charAt(0) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    const soundingAccidental = rawNoteStr.length > 1 ? '#' : '';

    // 5. Transpose sounding pitch to written pitch for student's instrument
    // E.g., Bb trumpet playing written C sounds concert Bb (soundingMidi = writtenMidi - 2)
    // Therefore writtenMidi = soundingMidi + 2
    let transposeOffset = 0;
    if (this.transposition === 'Bb') {
      transposeOffset = 2; // Up 2 semitones
    } else if (this.transposition === 'Eb') {
      transposeOffset = 9; // Up 9 semitones
    } else if (this.transposition === 'F') {
      transposeOffset = 7; // Up 7 semitones (perfect 5th)
    }

    const writtenMidi = soundingMidi + transposeOffset;
    const writtenNoteIdx = ((writtenMidi % 12) + 12) % 12;
    const writtenRawStr = NOTE_NAMES[writtenNoteIdx];
    const writtenOctave = Math.floor(writtenMidi / 12) - 1;
    const writtenStep = writtenRawStr.charAt(0) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

    return {
      frequency,
      midi: soundingMidi,
      step: soundingStep,
      accidental: soundingAccidental as '' | '#' | 'b',
      octave: soundingOctave,
      noteName: `${rawNoteStr}${soundingOctave}`,
      writtenStep,
      writtenOctave,
      writtenNoteName: `${writtenRawStr}${writtenOctave}`,
      cents,
      volume: Math.min(1, rms * 8),
      clarity: maxCorr,
    };
  }

  private getLagCorr(buf: Float32Array, lag: number): number {
    let corr = 0;
    let energy = 0;
    for (let i = 0; i < buf.length - lag; i++) {
      corr += buf[i] * buf[i + lag];
      energy += buf[i] * buf[i] + buf[i + lag] * buf[i + lag];
    }
    return (2 * corr) / (energy + 1e-6);
  }
}

export const livePitchDetector = new LivePitchDetector();
