/**
 * Ultra-efficient, high-precision real-time microphone pitch detector for "Staff Wars Live".
 * Optimized using McLeod Pitch Method (MPM) with early-exit peak picking,
 * zero garbage collection (preallocated buffers), and 25Hz throttled analysis
 * to ensure 60 FPS silky smooth gameplay without any lag or freezing.
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

  // Pre-allocated buffer to eliminate garbage collection pauses
  private timeBuffer: Float32Array = new Float32Array(new ArrayBuffer(2048 * Float32Array.BYTES_PER_ELEMENT));
  private nsdfBuffer: Float32Array = new Float32Array(1024);
  private lastProcessTime: number = 0;
  private readonly PROCESS_INTERVAL_MS: number = 38; // ~26 Hz update rate (real-time responsiveness, negligible CPU)

  // Stability tracking
  private stableStep: string = '';
  private stableFrames: number = 0;
  private readonly minStableFrames: number = 2; // ~75ms stability requirement

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

    if (this.isRunning && this.audioCtx && this.analyser) {
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }
      return true;
    }

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
      this.lastProcessTime = 0;

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
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {}
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
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

    const now = performance.now();
    // Throttle frequency analysis to ~26 Hz for zero frame drops on the main thread
    if (now - this.lastProcessTime >= this.PROCESS_INTERVAL_MS) {
      this.lastProcessTime = now;

      this.analyser.getFloatTimeDomainData(this.timeBuffer as any);
      const result = this.detectPitchMPM(this.timeBuffer, this.audioCtx.sampleRate);

      if (result && this.onPitchCallback) {
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
    }

    this.animId = requestAnimationFrame(this.processLoop);
  };

  /**
   * High-speed McLeod Pitch Method (MPM) with early-exit peak search.
   * Window size = 1024, search range = 55Hz (A1) to 1200Hz (D6).
   */
  private detectPitchMPM(buf: Float32Array, sampleRate: number): PitchDetectionResult | null {
    const W = 1024; // Analysis window size
    if (buf.length < W * 2) return null;

    // 1. RMS Energy check
    let sum0 = 0;
    for (let i = 0; i < W; i++) {
      const v = buf[i];
      sum0 += v * v;
    }
    const rms = Math.sqrt(sum0 / W);
    // Gated threshold: reject silence / ambient background noise
    if (rms < 0.015) {
      return null;
    }

    const minPeriod = Math.max(20, Math.floor(sampleRate / 1200)); // ~1200Hz max
    const maxPeriod = Math.min(W - 1, Math.floor(sampleRate / 55));  // ~55Hz min

    // 2. Compute Normalized Square Difference Function (NSDF) with early peak picking
    // nsdf(tau) = 2 * r(tau) / (m0 + m_tau)
    let bestPeriod = -1;
    let maxClarity = -1;
    let turnedNegative = false;

    // Zero out nsdfBuffer
    for (let i = 0; i <= maxPeriod; i++) {
      this.nsdfBuffer[i] = 0;
    }

    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      let r_tau = 0;
      let sum_tau = 0;

      for (let i = 0; i < W; i++) {
        const a = buf[i];
        const b = buf[i + tau];
        r_tau += a * b;
        sum_tau += b * b;
      }

      const nsdf = (2 * r_tau) / (sum0 + sum_tau + 1e-9);
      this.nsdfBuffer[tau] = nsdf;

      if (nsdf < 0) {
        turnedNegative = true;
      }

      // Early-exit peak picking: find first strong peak after zero-crossing
      if (turnedNegative && tau > minPeriod + 1) {
        const prev = this.nsdfBuffer[tau - 1];
        const prev2 = this.nsdfBuffer[tau - 2];

        // Did we just pass a local maximum at (tau - 1)?
        if (prev > prev2 && prev >= nsdf && prev > 0.78) {
          bestPeriod = tau - 1;
          maxClarity = prev;
          // Break immediately! The first prominent peak is the fundamental frequency!
          break;
        }
      }
    }

    if (bestPeriod === -1 || maxClarity < 0.78) {
      return null;
    }

    // 3. Parabolic Interpolation for exact fractional pitch
    const p = bestPeriod;
    const alpha = this.nsdfBuffer[p - 1];
    const beta = this.nsdfBuffer[p];
    const gamma = this.nsdfBuffer[p + 1];
    const denom = alpha - 2 * beta + gamma;
    const delta = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0;

    const exactPeriod = p + delta;
    if (exactPeriod <= 0) return null;

    const frequency = sampleRate / exactPeriod;
    if (frequency < 50 || frequency > 1400) return null;

    // 4. MIDI Pitch & Note Conversion
    // 440 Hz = A4 (MIDI 69)
    const exactMidi = 12 * Math.log2(frequency / 440) + 69;
    const soundingMidi = Math.round(exactMidi);
    const cents = Math.round((exactMidi - soundingMidi) * 100);

    const noteIdx = ((soundingMidi % 12) + 12) % 12;
    const rawNoteStr = NOTE_NAMES[noteIdx];
    const soundingOctave = Math.floor(soundingMidi / 12) - 1;

    const soundingStep = rawNoteStr.charAt(0) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    const soundingAccidental = rawNoteStr.length > 1 ? '#' : '';

    // 5. Instrument Transposition (Sounding pitch -> Written pitch for student)
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
      volume: Math.min(1, rms * 7),
      clarity: maxClarity,
    };
  }
}

export const livePitchDetector = new LivePitchDetector();
