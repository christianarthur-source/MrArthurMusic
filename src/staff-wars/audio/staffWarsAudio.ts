/**
 * Synthesizes retro sci-fi lasers, multi-stage heavy explosions, alarms,
 * musical pitches for ear training, and an iconic Star Wars-inspired space march theme
 * using the Web Audio API without requiring any external audio asset downloads.
 */

class StaffWarsAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isMusicMuted: boolean = false;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicPlaying: boolean = false;
  private musicTimerId: any = null;
  private musicStep: number = 0;

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      // Master FX gain
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.sfxGain.connect(this.ctx.destination);

      // Music gain
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.28, this.ctx.currentTime);
      this.musicGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ctx && this.sfxGain) {
      const target = muted ? 0 : 0.85;
      this.sfxGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMusicMuted(muted: boolean) {
    this.isMusicMuted = muted;
    if (this.ctx && this.musicGain) {
      const target = muted ? 0 : 0.28;
      this.musicGain.gain.setValueAtTime(target, this.ctx.currentTime);
    }
  }

  public getMusicMuted(): boolean {
    return this.isMusicMuted;
  }

  public isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  /**
   * Laser blaster sound
   */
  public playLaser(isCorrect: boolean = true) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime;

    if (isCorrect) {
      // Classic Star Wars style blaster: downward frequency sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1500, t);
      osc.frequency.exponentialRampToValueAtTime(130, t + 0.16);

      gain.gain.setValueAtTime(0.75, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, t);
      filter.frequency.exponentialRampToValueAtTime(450, t + 0.16);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.17);
    } else {
      // Deflected blaster / error buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.linearRampToValueAtTime(120, t + 0.2);

      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.21);
    }
  }

  /**
   * Multi-stage, movie-theater deep space explosion
   */
  public playExplosion() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime;
    const duration = 0.85;

    // Stage 1: Supersonic Initial Impact Crack
    const crackOsc = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crackOsc.type = 'square';
    crackOsc.frequency.setValueAtTime(900, t);
    crackOsc.frequency.exponentialRampToValueAtTime(70, t + 0.05);
    crackGain.gain.setValueAtTime(0.8, t);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    crackOsc.connect(crackGain);
    crackGain.connect(this.sfxGain);
    crackOsc.start(t);
    crackOsc.stop(t + 0.06);

    // Stage 2: Heavy Resonant Blast Noise (Pinkish swept filtered noise)
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let lastVal = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastVal = (lastVal + 0.04 * white) / 1.04;
      data[i] = lastVal * 2.8 + white * 0.35;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(1600, t);
    filter1.frequency.exponentialRampToValueAtTime(55, t + duration);
    filter1.Q.setValueAtTime(3.5, t);

    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(1400, t);
    filter2.frequency.exponentialRampToValueAtTime(45, t + duration);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(1.1, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseSource.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSource.start(t);

    // Stage 3: Massive 808 Sub-Bass Boom (Pitch dive 130Hz -> 28Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(135, t);
    subOsc.frequency.exponentialRampToValueAtTime(26, t + 0.65);

    subGain.gain.setValueAtTime(1.0, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 0.68);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);

    subOsc.start(t);
    subOsc.stop(t + 0.7);
  }

  /**
   * Note impact on shield / clef damage
   */
  public playShieldHit() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime;

    // Siren alarm drop
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.3);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.31);
  }

  /**
   * Play the true musical pitch of the note for educational ear training
   */
  public playNotePitch(freq: number) {
    if (this.isMuted || !freq) return;
    const ctx = this.initContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime;
    const duration = 0.55;

    // Warm bell / synth chime
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, t);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  /**
   * Level up fanfare
   */
  public playLevelUp() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [466.16, 587.33, 698.46, 932.33]; // Bb major arpeggio
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.65, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.29);
    });
  }

  /**
   * Game over sequence
   */
  public playGameOver() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [311.13, 293.66, 277.18, 261.63];
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.39);
    });
  }

  // =========================================================================
  // STAR WARS INSPIRED SPACE MARCH MUSIC SEQUENCER
  // =========================================================================

  /**
   * Starts the looping Star Wars-style space march
   */
  public startMusic() {
    if (this.musicPlaying) return;
    const ctx = this.initContext();
    if (!ctx) return;

    this.musicPlaying = true;
    this.musicStep = 0;

    // Tempo: ~104 BPM => 1 beat = 0.577s => 16th note = 0.144s
    const stepDurationMs = 144;

    const scheduleNext = () => {
      if (!this.musicPlaying) return;
      this.playMusicStep(this.musicStep);
      this.musicStep = (this.musicStep + 1) % 64; // 64 sixteenth steps = 4 bars
      this.musicTimerId = setTimeout(scheduleNext, stepDurationMs);
    };

    scheduleNext();
  }

  public stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimerId) {
      clearTimeout(this.musicTimerId);
      this.musicTimerId = null;
    }
  }

  public toggleMusic(): boolean {
    if (this.musicPlaying && !this.musicIsMuted()) {
      this.setMusicMuted(true);
      return false;
    } else {
      this.setMusicMuted(false);
      if (!this.musicPlaying) {
        this.startMusic();
      }
      return true;
    }
  }

  private musicIsMuted(): boolean {
    return this.isMusicMuted || this.isMuted;
  }

  /**
   * Synthesizes brass lead fanfare + orchestral march pulse
   */
  private playMusicStep(step: number) {
    if (this.musicIsMuted()) return;
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;

    const t = ctx.currentTime;

    // Bass / Tympani March on beats (every 4 steps)
    if (step % 4 === 0) {
      const beatIdx = Math.floor(step / 4);
      // Bb2 -> Bb2 -> F2 -> Bb2
      const bassFreqs = [116.54, 116.54, 87.31, 116.54];
      const freq = bassFreqs[beatIdx % bassFreqs.length];

      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(freq, t);

      bassGain.gain.setValueAtTime(0.4, t);
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

      bassOsc.connect(bassGain);
      bassGain.connect(this.musicGain);

      bassOsc.start(t);
      bassOsc.stop(t + 0.33);

      // Light march snare noise tap on beats 2 & 4
      if (beatIdx % 2 === 1) {
        const snareNoise = ctx.createBufferSource();
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        snareNoise.buffer = buf;

        const sFilter = ctx.createBiquadFilter();
        sFilter.type = 'highpass';
        sFilter.frequency.setValueAtTime(1800, t);

        const sGain = ctx.createGain();
        sGain.gain.setValueAtTime(0.12, t);
        sGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

        snareNoise.connect(sFilter);
        sFilter.connect(sGain);
        sGain.connect(this.musicGain);

        snareNoise.start(t);
      }
    }

    // Iconic Star Wars Style Brass Lead Melody
    // 64 sixteenth notes (4 bars of 4/4):
    // Bar 1:
    //   Steps 0, 1, 2: Triplet pickup F4 (349.23)
    //   Step 4..11: Bb4 (466.16) - long heroic tonic
    //   Step 12..15: F5 (698.46) - high fifth
    // Bar 2:
    //   Step 16: Eb5 (622.25)
    //   Step 18: D5 (587.33)
    //   Step 20: C5 (523.25)
    //   Step 22..27: Bb5 (932.33) - apex note!
    //   Step 28..31: F5 (698.46)
    // Bar 3:
    //   Step 32: Eb5 (622.25)
    //   Step 34: D5 (587.33)
    //   Step 36: C5 (523.25)
    //   Step 38..43: Bb5 (932.33)
    //   Step 44..47: F5 (698.46)
    // Bar 4:
    //   Step 48: Eb5 (622.25)
    //   Step 50: D5 (587.33)
    //   Step 52: Eb5 (622.25)
    //   Step 54..63: C5 (523.25) resolving into start

    let leadNote: { freq: number; dur: number } | null = null;

    if (step === 0 || step === 1 || step === 2) {
      leadNote = { freq: 349.23, dur: 0.12 }; // F4 triplet
    } else if (step === 4) {
      leadNote = { freq: 466.16, dur: 1.1 };  // Bb4 long tonic
    } else if (step === 12) {
      leadNote = { freq: 698.46, dur: 0.5 };  // F5
    } else if (step === 16) {
      leadNote = { freq: 622.25, dur: 0.25 }; // Eb5
    } else if (step === 18) {
      leadNote = { freq: 587.33, dur: 0.25 }; // D5
    } else if (step === 20) {
      leadNote = { freq: 523.25, dur: 0.25 }; // C5
    } else if (step === 22) {
      leadNote = { freq: 932.33, dur: 0.75 }; // Bb5
    } else if (step === 28) {
      leadNote = { freq: 698.46, dur: 0.5 };  // F5
    } else if (step === 32) {
      leadNote = { freq: 622.25, dur: 0.25 }; // Eb5
    } else if (step === 34) {
      leadNote = { freq: 587.33, dur: 0.25 }; // D5
    } else if (step === 36) {
      leadNote = { freq: 523.25, dur: 0.25 }; // C5
    } else if (step === 38) {
      leadNote = { freq: 932.33, dur: 0.75 }; // Bb5
    } else if (step === 44) {
      leadNote = { freq: 698.46, dur: 0.5 };  // F5
    } else if (step === 48) {
      leadNote = { freq: 622.25, dur: 0.25 }; // Eb5
    } else if (step === 50) {
      leadNote = { freq: 587.33, dur: 0.25 }; // D5
    } else if (step === 52) {
      leadNote = { freq: 622.25, dur: 0.25 }; // Eb5
    } else if (step === 54) {
      leadNote = { freq: 523.25, dur: 1.2 };  // C5 resolution
    }

    if (leadNote) {
      // Dual detuned brass sawtooth synth
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const bFilter = ctx.createBiquadFilter();
      const bGain = ctx.createGain();

      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';

      oscA.frequency.setValueAtTime(leadNote.freq, t);
      oscB.frequency.setValueAtTime(leadNote.freq * 1.004, t); // slight chorus detune

      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(2600, t);
      bFilter.Q.setValueAtTime(2.2, t);

      bGain.gain.setValueAtTime(0.001, t);
      bGain.gain.linearRampToValueAtTime(0.24, t + 0.04);
      bGain.gain.exponentialRampToValueAtTime(0.001, t + leadNote.dur);

      oscA.connect(bFilter);
      oscB.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.musicGain);

      oscA.start(t);
      oscB.start(t);
      oscA.stop(t + leadNote.dur + 0.05);
      oscB.stop(t + leadNote.dur + 0.05);
    }
  }
}

export const staffWarsAudio = new StaffWarsAudioEngine();
