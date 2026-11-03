// High-Precision Web Audio API Engine
// Metronome Lookahead Scheduler, Beat Machine Drum Synthesizer,
// Pitch/Staff Synthesizer, and Timer Audio

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isUnlocked: boolean = false;

  // Metronome scheduler state
  private metronomeTimerId: number | null = null;
  private nextBeatTime: number = 0;
  private currentBeatInBar: number = 0;
  private metronomeBpm: number = 100;
  private metronomeBeatsPerBar: number = 4;
  private metronomeSubdivision: 'quarter' | 'eighth' | 'triplet' | 'sixteenth' = 'quarter';
  private metronomeSound: 'woodblock' | 'beep' | 'drum' | 'cowbell' = 'woodblock';
  private metronomeVolume: number = 0.8;
  private isMetronomePlaying: boolean = false;
  private onBeatTickCallback: ((beat: number, isSubdivision: boolean) => void) | null = null;

  // Lookahead settings (in seconds)
  private readonly lookahead: number = 25.0; // ms
  private readonly scheduleAheadTime: number = 0.1; // 100ms

  public getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    if (this.isUnlocked) return;
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        this.isUnlocked = true;
      });
    } else {
      this.isUnlocked = true;
    }
  }

  // --- SYNTHESIZED SOUND GENERATORS ---

  // Crisp Woodblock (Primary classroom click)
  public playWoodblock(time: number = 0, isHigh: boolean = false, volume: number = 0.8): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHigh ? 1100 : 800, playTime);
    osc.frequency.exponentialRampToValueAtTime(isHigh ? 850 : 600, playTime + 0.05);

    gain.gain.setValueAtTime(volume, playTime);
    gain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(playTime);
    osc.stop(playTime + 0.06);
  }

  // Pure Digital Beep
  public playBeep(time: number = 0, isHigh: boolean = false, volume: number = 0.7): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(isHigh ? 1600 : 880, playTime);

    gain.gain.setValueAtTime(volume * 0.4, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(playTime);
    osc.stop(playTime + 0.05);
  }

  // Cowbell
  public playCowbell(time: number = 0, isHigh: boolean = false, volume: number = 0.75): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(isHigh ? 840 : 587, playTime);
    osc2.frequency.setValueAtTime(isHigh ? 1200 : 845, playTime);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isHigh ? 1400 : 900, playTime);
    filter.Q.setValueAtTime(2.5, playTime);

    gain.gain.setValueAtTime(volume * 0.5, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(ctx.destination);

    osc1.start(playTime);
    osc2.start(playTime);
    osc1.stop(playTime + 0.2);
    osc2.stop(playTime + 0.2);
  }

  // Kick Drum (synthesized 808/acoustic blend)
  public playKick(time: number = 0, volume: number = 0.85): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, playTime);
    osc.frequency.exponentialRampToValueAtTime(45, playTime + 0.08);

    gain.gain.setValueAtTime(volume, playTime);
    gain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(playTime);
    osc.stop(playTime + 0.36);
  }

  // Snare Drum (with white noise snap)
  public playSnare(time: number = 0, volume: number = 0.8): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, playTime);
    osc.frequency.exponentialRampToValueAtTime(70, playTime + 0.07);
    oscGain.gain.setValueAtTime(volume * 0.6, playTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.12);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(playTime);
    osc.stop(playTime + 0.13);

    // Noise snap
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(950, playTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.7, playTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, playTime + 0.18);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(playTime);
    noise.stop(playTime + 0.19);
  }

  // Closed Hi-Hat
  public playClosedHiHat(time: number = 0, volume: number = 0.6): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, playTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(playTime);
    noise.stop(playTime + 0.06);
  }

  // Open Hi-Hat
  public playOpenHiHat(time: number = 0, volume: number = 0.6): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, playTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume * 0.5, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(playTime);
    noise.stop(playTime + 0.32);
  }

  // Hand Clap
  public playClap(time: number = 0, volume: number = 0.7): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;

    // Series of micro bursts for authentic handclap flutter
    [0, 0.012, 0.024].forEach((offset) => {
      const bufferSize = ctx.sampleRate * 0.04;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filt = ctx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.setValueAtTime(1200, playTime + offset);
      filt.Q.setValueAtTime(1.8, playTime + offset);
      const g = ctx.createGain();
      g.gain.setValueAtTime(volume * 0.45, playTime + offset);
      g.gain.exponentialRampToValueAtTime(0.001, playTime + offset + 0.035);
      src.connect(filt);
      filt.connect(g);
      g.connect(ctx.destination);
      src.start(playTime + offset);
      src.stop(playTime + offset + 0.04);
    });
  }

  // Triangle (Orff percussion)
  public playTriangle(time: number = 0, volume: number = 0.65): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(3200, playTime);
    osc2.frequency.setValueAtTime(4850, playTime);

    gain.gain.setValueAtTime(volume * 0.4, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(playTime);
    osc2.start(playTime);
    osc1.stop(playTime + 0.62);
    osc2.stop(playTime + 0.62);
  }

  // Agogo Bells (High and Low)
  public playAgogo(time: number = 0, isHigh: boolean = false, volume: number = 0.7): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isHigh ? 987 : 740, playTime);

    gain.gain.setValueAtTime(volume * 0.5, playTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(playTime);
    osc.stop(playTime + 0.24);
  }

  // --- CLASSROOM TIMER BELLS & CHIMES ---

  public playGentleTimerChime(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    // Harmonious Zen meditation chime (E, G#, B, E)
    const freqs = [329.63, 415.3, 493.88, 659.25];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 2.8);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 2.9);
    });
  }

  // --- INTERACTIVE PIANO & STAFF PITCH SYNTHESIZER ---

  // Play a musical pitch given MIDI note or frequency (with natural piano-like decay)
  public playMusicalNote(freqOrMidi: number | string, durationSec: number = 0.8, volume: number = 0.6): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    let freq = 440;
    if (typeof freqOrMidi === 'number') {
      if (freqOrMidi < 128) {
        // MIDI note number to Frequency
        freq = 440 * Math.pow(2, (freqOrMidi - 69) / 12);
      } else {
        freq = freqOrMidi;
      }
    } else {
      freq = this.noteNameToFrequency(freqOrMidi);
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 2, now); // 2nd harmonic warmth

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec + 0.05);
    osc2.stop(now + durationSec + 0.05);
  }

  // Google Song Maker style multi-instrument melodic synthesizer (Xylophone, Piano, Synth, Marimba)
  public playMelodyNote(
    noteName: string,
    instrument: 'xylophone' | 'piano' | 'synth' | 'marimba' = 'xylophone',
    time: number = 0,
    volume: number = 0.75
  ): void {
    const ctx = this.getContext();
    const playTime = time || ctx.currentTime;
    const freq = this.noteNameToFrequency(noteName);

    const osc1 = ctx.createOscillator();
    const gain = ctx.createGain();

    if (instrument === 'xylophone') {
      // Crisp wooden mallet strike: sine + fast decaying high partials
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, playTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 3, playTime);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(volume * 0.35, playTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.12);

      gain.gain.setValueAtTime(0.0001, playTime);
      gain.gain.linearRampToValueAtTime(volume, playTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.45);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(playTime);
      osc2.stop(playTime + 0.15);
    } else if (instrument === 'marimba') {
      // Warm, deeper resonator bar
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, playTime);

      gain.gain.setValueAtTime(0.0001, playTime);
      gain.gain.linearRampToValueAtTime(volume * 0.9, playTime + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.65);
    } else if (instrument === 'synth') {
      // Fun 8-bit / playful electronic lead
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, playTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, playTime);
      filter.frequency.exponentialRampToValueAtTime(400, playTime + 0.35);

      gain.gain.setValueAtTime(0.0001, playTime);
      gain.gain.linearRampToValueAtTime(volume * 0.5, playTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.4);

      osc1.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(playTime);
      osc1.stop(playTime + 0.45);
      return;
    } else {
      // Piano
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, playTime);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, playTime);

      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(volume * 0.3, playTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.7);

      gain.gain.setValueAtTime(0.0001, playTime);
      gain.gain.linearRampToValueAtTime(volume * 0.7, playTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.85);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(playTime);
      osc2.stop(playTime + 0.9);
    }

    osc1.connect(gain);
    gain.connect(ctx.destination);
    osc1.start(playTime);
    osc1.stop(playTime + 0.7);
  }

  public noteNameToFrequency(noteName: string): number {
    const notes: Record<string, number> = {
      C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
      G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
    };
    const match = noteName.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
    if (!match) return 440;
    const note = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    const octave = parseInt(match[2], 10);
    const semitone = notes[note] ?? 9;
    const midi = (octave + 1) * 12 + semitone;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // --- HIGH PRECISION METRONOME SCHEDULER ---

  public setMetronomeParams(params: {
    bpm?: number;
    beatsPerBar?: number;
    subdivision?: 'quarter' | 'eighth' | 'triplet' | 'sixteenth';
    sound?: 'woodblock' | 'beep' | 'drum' | 'cowbell';
    volume?: number;
  }): void {
    if (params.bpm !== undefined) this.metronomeBpm = Math.max(30, Math.min(300, params.bpm));
    if (params.beatsPerBar !== undefined) this.metronomeBeatsPerBar = params.beatsPerBar;
    if (params.subdivision !== undefined) this.metronomeSubdivision = params.subdivision;
    if (params.sound !== undefined) this.metronomeSound = params.sound;
    if (params.volume !== undefined) this.metronomeVolume = params.volume;
  }

  public startMetronome(onTick?: (beat: number, isSubdivision: boolean) => void): void {
    if (this.isMetronomePlaying) return;
    this.unlockAudio();
    const ctx = this.getContext();

    this.isMetronomePlaying = true;
    this.currentBeatInBar = 0;
    this.nextBeatTime = ctx.currentTime + 0.05;
    this.onBeatTickCallback = onTick || null;

    this.metronomeSchedulerLoop();
  }

  public stopMetronome(): void {
    this.isMetronomePlaying = false;
    if (this.metronomeTimerId !== null) {
      window.clearTimeout(this.metronomeTimerId);
      this.metronomeTimerId = null;
    }
  }

  public isMetronomeActive(): boolean {
    return this.isMetronomePlaying;
  }

  private metronomeSchedulerLoop = (): void => {
    if (!this.isMetronomePlaying) return;
    const ctx = this.getContext();

    while (this.nextBeatTime < ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleMetronomeBeat(this.nextBeatTime, this.currentBeatInBar);
      this.advanceMetronomeBeat();
    }

    this.metronomeTimerId = window.setTimeout(this.metronomeSchedulerLoop, this.lookahead);
  };

  private advanceMetronomeBeat(): void {
    const secondsPerQuarter = 60.0 / this.metronomeBpm;
    let stepDuration = secondsPerQuarter;

    if (this.metronomeSubdivision === 'eighth') {
      stepDuration = secondsPerQuarter / 2;
    } else if (this.metronomeSubdivision === 'triplet') {
      stepDuration = secondsPerQuarter / 3;
    } else if (this.metronomeSubdivision === 'sixteenth') {
      stepDuration = secondsPerQuarter / 4;
    }

    this.nextBeatTime += stepDuration;
    this.currentBeatInBar++;

    // Calculate subdivision steps per bar
    let stepsPerBeat = 1;
    if (this.metronomeSubdivision === 'eighth') stepsPerBeat = 2;
    if (this.metronomeSubdivision === 'triplet') stepsPerBeat = 3;
    if (this.metronomeSubdivision === 'sixteenth') stepsPerBeat = 4;

    const totalStepsInBar = this.metronomeBeatsPerBar * stepsPerBeat;
    if (this.currentBeatInBar >= totalStepsInBar) {
      this.currentBeatInBar = 0;
    }
  }

  private scheduleMetronomeBeat(time: number, stepIndex: number): void {
    let stepsPerBeat = 1;
    if (this.metronomeSubdivision === 'eighth') stepsPerBeat = 2;
    if (this.metronomeSubdivision === 'triplet') stepsPerBeat = 3;
    if (this.metronomeSubdivision === 'sixteenth') stepsPerBeat = 4;

    const isMainBeat = stepIndex % stepsPerBeat === 0;
    const beatNumber = Math.floor(stepIndex / stepsPerBeat) + 1;
    const isFirstBeat = isMainBeat && beatNumber === 1;

    // Trigger audible click based on chosen sound
    switch (this.metronomeSound) {
      case 'beep':
        this.playBeep(time, isFirstBeat, isMainBeat ? this.metronomeVolume : this.metronomeVolume * 0.45);
        break;
      case 'drum':
        if (isFirstBeat) {
          this.playKick(time, this.metronomeVolume);
        } else if (isMainBeat) {
          this.playSnare(time, this.metronomeVolume * 0.8);
        } else {
          this.playClosedHiHat(time, this.metronomeVolume * 0.5);
        }
        break;
      case 'cowbell':
        this.playCowbell(time, isFirstBeat, isMainBeat ? this.metronomeVolume : this.metronomeVolume * 0.4);
        break;
      case 'woodblock':
      default:
        this.playWoodblock(time, isFirstBeat, isMainBeat ? this.metronomeVolume : this.metronomeVolume * 0.4);
        break;
    }

    // Callback for UI visual pulse
    if (this.onBeatTickCallback) {
      const delayMs = Math.max(0, (time - this.getContext().currentTime) * 1000);
      window.setTimeout(() => {
        if (this.isMetronomePlaying && this.onBeatTickCallback) {
          this.onBeatTickCallback(beatNumber, !isMainBeat);
        }
      }, delayMs);
    }
  }
}

export const audioEngine = new AudioEngine();
