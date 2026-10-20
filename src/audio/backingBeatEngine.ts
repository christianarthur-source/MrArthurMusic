/**
 * Backing Beat Engine for Big Staff Mode
 * Generates energetic, kid-friendly drum grooves (Rock, Dance, March, Stomp & Clap)
 * using Web Audio synthesis, synchronized to the score's tempo.
 */

export type BackingBeatType = 'none' | 'rock' | 'dance' | 'march' | 'claps';

export interface BackingBeatOption {
  id: BackingBeatType;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

export const BACKING_BEAT_OPTIONS: BackingBeatOption[] = [
  {
    id: 'none',
    name: 'No Drums',
    emoji: '🚫',
    description: 'Play melody only without background drums',
    color: 'from-slate-700 to-slate-800'
  },
  {
    id: 'rock',
    name: 'Rock Groove',
    emoji: '🎸',
    description: 'Classic Boom-Chak Rock & Roll drum beat!',
    color: 'from-rose-500 to-amber-500'
  },
  {
    id: 'dance',
    name: 'Dance Party',
    emoji: '✨',
    description: 'Bouncy pop dance beat with claps & shakers!',
    color: 'from-fuchsia-500 to-pink-500'
  },
  {
    id: 'march',
    name: 'Marching Band',
    emoji: '🥁',
    description: 'Crisp marching snare roll & big bass drum!',
    color: 'from-amber-500 to-emerald-500'
  },
  {
    id: 'claps',
    name: 'Stomp & Clap',
    emoji: '👏',
    description: 'Boom-Boom-Clap kindergarten playground groove!',
    color: 'from-cyan-500 to-blue-500'
  }
];

class BackingBeatEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private currentGroove: BackingBeatType = 'none';
  private timerId: number | null = null;
  private nextMeasureTime: number = 0;
  private bpm: number = 100;
  private previewTimerId: number | null = null;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Drum Synthesizers ---

  private playKick(t: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.12);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  private playSnare(t: number) {
    if (!this.ctx) return;
    // Tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(65, t + 0.1);
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    // Noise snap
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + 0.2);
  }

  private playHiHat(t: number, open: boolean = false) {
    if (!this.ctx) return;
    const duration = open ? 0.3 : 0.06;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(8000, t);
    filter.Q.setValueAtTime(3.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.45 : 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(t);
    noise.stop(t + duration + 0.02);
  }

  private playClap(t: number) {
    if (!this.ctx) return;
    // Multi-burst clap
    [0, 0.012, 0.024].forEach((offset, idx) => {
      if (!this.ctx) return;
      const burstTime = t + offset;
      const isLast = idx === 2;
      const dur = isLast ? 0.18 : 0.025;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, burstTime);
      filter.Q.setValueAtTime(1.8, burstTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isLast ? 0.6 : 0.35, burstTime);
      gain.gain.exponentialRampToValueAtTime(0.001, burstTime + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(burstTime);
      noise.stop(burstTime + dur + 0.01);
    });
  }

  private playStomp(t: number) {
    if (!this.ctx) return;
    // Heavy low acoustic foot stomp
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.16);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  // Schedule one 4/4 measure of the chosen groove starting at time `startTime`
  private scheduleMeasure(groove: BackingBeatType, startTime: number, secondsPerBeat: number) {
    const spb = secondsPerBeat;

    switch (groove) {
      case 'rock': {
        // Beat 1: Kick + Hat
        this.playKick(startTime);
        this.playHiHat(startTime, false);
        this.playHiHat(startTime + spb * 0.5, false);

        // Beat 2: Snare + Hat
        this.playSnare(startTime + spb * 1.0);
        this.playHiHat(startTime + spb * 1.0, false);
        this.playHiHat(startTime + spb * 1.5, false);

        // Beat 3: Kick + Hat
        this.playKick(startTime + spb * 2.0);
        this.playHiHat(startTime + spb * 2.0, false);
        this.playKick(startTime + spb * 2.5); // groovy upbeat kick
        this.playHiHat(startTime + spb * 2.5, false);

        // Beat 4: Snare + Open Hat
        this.playSnare(startTime + spb * 3.0);
        this.playHiHat(startTime + spb * 3.0, true);
        this.playHiHat(startTime + spb * 3.5, false);
        break;
      }

      case 'dance': {
        // Four-on-the-Floor Kick on 1, 2, 3, 4
        for (let b = 0; b < 4; b++) {
          this.playKick(startTime + spb * b);
          // Offbeat open hi-hat
          this.playHiHat(startTime + spb * (b + 0.5), true);
        }
        // Claps on 2 and 4
        this.playClap(startTime + spb * 1.0);
        this.playClap(startTime + spb * 3.0);
        break;
      }

      case 'march': {
        // Bass Drum on 1 and 3
        this.playKick(startTime);
        this.playKick(startTime + spb * 2.0);

        // Marching Snare pattern: 1, 1&, 2, 2&a, 3, 4, 4&
        this.playSnare(startTime);
        this.playSnare(startTime + spb * 0.5);
        this.playSnare(startTime + spb * 1.0);
        this.playSnare(startTime + spb * 1.5);
        this.playSnare(startTime + spb * 1.75);
        this.playSnare(startTime + spb * 2.0);
        this.playSnare(startTime + spb * 3.0);
        this.playSnare(startTime + spb * 3.5);

        // Cymbals
        this.playHiHat(startTime, true);
        this.playHiHat(startTime + spb * 2.0, true);
        break;
      }

      case 'claps': {
        // Kindergarten Stomp-Stomp-Clap
        // Beat 1: Stomp
        this.playStomp(startTime);
        // Beat 2: Stomp
        this.playStomp(startTime + spb * 1.0);
        // Beat 3: Loud Clap!
        this.playClap(startTime + spb * 2.0);
        // Beat 4: Shaker / Hi-Hat
        this.playHiHat(startTime + spb * 3.0, false);
        this.playHiHat(startTime + spb * 3.5, false);
        break;
      }

      default:
        break;
    }
  }

  /**
   * Starts looping the backing beat at the specified BPM.
   */
  public start(groove: BackingBeatType, bpm: number = 100) {
    this.stop();
    if (groove === 'none') return;

    const ctx = this.initContext();
    this.isRunning = true;
    this.currentGroove = groove;
    this.bpm = bpm;

    const secondsPerBeat = 60 / bpm;
    const measureDuration = secondsPerBeat * 4;

    this.nextMeasureTime = ctx.currentTime + 0.05;
    // Schedule first measure immediately
    this.scheduleMeasure(groove, this.nextMeasureTime, secondsPerBeat);
    this.nextMeasureTime += measureDuration;

    // Lookahead scheduler loop
    this.timerId = window.setInterval(() => {
      if (!this.isRunning || !this.ctx) return;
      const lookahead = 0.2; // 200ms lookahead
      while (this.nextMeasureTime < this.ctx.currentTime + lookahead) {
        this.scheduleMeasure(this.currentGroove, this.nextMeasureTime, 60 / this.bpm);
        this.nextMeasureTime += (60 / this.bpm) * 4;
      }
    }, 100);
  }

  /**
   * Stops the continuous backing beat.
   */
  public stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.previewTimerId !== null) {
      clearTimeout(this.previewTimerId);
      this.previewTimerId = null;
    }
  }

  /**
   * Plays a single 1-measure preview of a groove so students can hear it.
   */
  public preview(groove: BackingBeatType, bpm: number = 100) {
    this.stop();
    if (groove === 'none') return;

    const ctx = this.initContext();
    const secondsPerBeat = 60 / bpm;
    const startTime = ctx.currentTime + 0.05;

    this.scheduleMeasure(groove, startTime, secondsPerBeat);

    this.previewTimerId = window.setTimeout(() => {
      this.previewTimerId = null;
    }, secondsPerBeat * 4 * 1000 + 200);
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getCurrentGroove(): BackingBeatType {
    return this.currentGroove;
  }
}

export const backingBeatEngine = new BackingBeatEngine();
