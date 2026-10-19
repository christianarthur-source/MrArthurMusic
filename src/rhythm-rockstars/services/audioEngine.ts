import { RhythmPattern } from '../types/rhythm';
import { SoundKit } from '../types/game';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;
  private activeTimeouts: number[] = [];
  private isCurrentlyPlaying: boolean = false;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, volume));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.85, this.ctx.currentTime);
    }
  }

  // --- Drum Synthesizers ---

  // Punchy Kick Drum
  public playKick(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency drop: 150Hz -> 30Hz
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.12);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Crisp Snare Drum (Tone + White Noise)
  public playSnare(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    // Body Tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain!);
    osc.start(t);
    osc.stop(t + 0.15);

    // Noise snare snap
    const bufferSize = ctx.sampleRate * 0.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);

    noise.start(t);
    noise.stop(t + 0.22);
  }

  // Hi-Hat (Metallic sizzle)
  public playHiHat(open = false, time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const bufferSize = ctx.sampleRate * (open ? 0.35 : 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(7500, t);
    filter.Q.setValueAtTime(2.5, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.3 : 0.07));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(t);
    noise.stop(t + (open ? 0.35 : 0.08));
  }

  // Authentic Cowbell (Dual tuned bandpass)
  public playCowbell(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(587, t); // D5
    osc2.frequency.setValueAtTime(845, t); // G#5

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.Q.setValueAtTime(3, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.32);
    osc2.stop(t + 0.32);
  }

  // Hand Clap
  public playClap(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.Q.setValueAtTime(1.5, t);

    // Multi-burst envelope for realistic clap
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.setValueAtTime(0.6, t + 0.01);
    gain.gain.setValueAtTime(0.2, t + 0.02);
    gain.gain.setValueAtTime(0.7, t + 0.03);
    gain.gain.setValueAtTime(0.2, t + 0.04);
    gain.gain.setValueAtTime(0.9, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(t);
    noise.stop(t + 0.25);
  }

  // Metronome Click / Woodblock - clean uniform click
  public playClick(highPitch = false, time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Accent beat 1 with higher pitch (1200Hz) vs inner beats (800Hz)
    osc.frequency.setValueAtTime(highPitch ? 1200 : 800, t);

    gain.gain.setValueAtTime(highPitch ? 0.85 : 0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  // Authentic Classroom Temple Woodblock
  public playWoodblock(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, t);
    osc1.frequency.exponentialRampToValueAtTime(680, t + 0.05);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, t);
    osc2.frequency.exponentialRampToValueAtTime(1020, t + 0.04);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    // Subtle wooden body impact click
    const bufferSize = Math.floor(ctx.sampleRate * 0.02);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const click = ctx.createBufferSource();
    click.buffer = buffer;
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'bandpass';
    clickFilter.frequency.setValueAtTime(1200, t);
    clickFilter.Q.setValueAtTime(4, t);
    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.5, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(this.masterGain!);
    click.start(t);
    click.stop(t + 0.02);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.08);
    osc2.stop(t + 0.08);
  }

  // Resonant Wooden Marimba Mallet Chime (Pitch C5 523.25Hz)
  public playMarimba(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const oscFund = ctx.createOscillator();
    const oscOver = ctx.createOscillator();
    const gainFund = ctx.createGain();
    const gainOver = ctx.createGain();

    oscFund.type = 'sine';
    oscFund.frequency.setValueAtTime(523.25, t);

    // Warm mallet bar overtone (3x fundamental)
    oscOver.type = 'sine';
    oscOver.frequency.setValueAtTime(1570, t);

    // Fundamental decays gently
    gainFund.gain.setValueAtTime(0, t);
    gainFund.gain.linearRampToValueAtTime(0.8, t + 0.004);
    gainFund.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    // Overtone decays fast (woody strike sound)
    gainOver.gain.setValueAtTime(0.35, t);
    gainOver.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    oscFund.connect(gainFund);
    oscOver.connect(gainOver);
    gainFund.connect(this.masterGain!);
    gainOver.connect(this.masterGain!);

    oscFund.start(t);
    oscOver.start(t);
    oscFund.stop(t + 0.4);
    oscOver.stop(t + 0.06);
  }

  // Shimmering Steel Triangle
  public playTriangle(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    // Metallic inharmonic frequencies
    const f1 = 3150;
    const f2 = 5270;
    const f3 = 7940;

    [f1, f2, f3].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const amp = idx === 0 ? 0.45 : idx === 1 ? 0.35 : 0.25;
      gain.gain.setValueAtTime(amp, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  // Snappy 808 Electronic Drum Rimshot
  public playSynthRimshot(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(1750, t);
    osc1.frequency.exponentialRampToValueAtTime(450, t + 0.03);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(420, t);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2100, t);
    filter.Q.setValueAtTime(2.5, t);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.07);
    osc2.stop(t + 0.07);
  }

  // Resonant Latin Agogô Percussion Bell
  public playAgogo(time?: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = time ?? ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1050, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1575, t);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1300, t);
    filter.Q.setValueAtTime(3, t);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.3);
    osc2.stop(t + 0.3);
  }

  // Uniform Rhythm Note Player - plays the EXACT same audio sample for all notes in a pattern
  // Never changes for the first note of a pair or for the first beat in a measure
  public playUniformRhythmNote(kit: SoundKit, time?: number) {
    switch (kit) {
      case 'rock_kit':
        // Uniform crisp snare drum sample for every single note
        this.playSnare(time);
        break;
      case 'woodblock':
        // Uniform authentic classroom woodblock hit
        this.playWoodblock(time);
        break;
      case 'cowbell_fever':
        // Uniform cowbell hit for every single note
        this.playCowbell(time);
        break;
      case 'electric_clap':
        // Uniform hand clap sample for every single note
        this.playClap(time);
        break;
      case 'marimba':
        // Uniform warm resonant marimba bar mallet hit
        this.playMarimba(time);
        break;
      case 'triangle':
        // Uniform shimmering orchestral triangle strike
        this.playTriangle(time);
        break;
      case 'synth_rimshot':
        // Uniform snappy 808 rimshot sample
        this.playSynthRimshot(time);
        break;
      case 'agogo_bell':
        // Uniform high Latin agogô bell ping
        this.playAgogo(time);
        break;
      case 'garage_drum':
        // Uniform punchy garage drum sample
        this.playSnare(time);
        break;
      default:
        this.playSnare(time);
    }
  }

  // Kit Dispatcher (enforces identical uniform audio sample regardless of accents or beats)
  public playInstrument(kit: SoundKit, _accent = false, time?: number) {
    this.playUniformRhythmNote(kit, time);
  }

  // Pad Hit (for live student tapping)
  public playPadHit(kit: SoundKit) {
    this.initContext();
    this.playUniformRhythmNote(kit);
  }

  // Celebration Rock Power Chord Fanfare
  public playPowerChordFanfare() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;

    // Rock chords: Root + 5th + Octave (E3 = 164.8, B3 = 246.9, E4 = 329.6)
    const notes = [
      { freq: 164.81, time: now },
      { freq: 246.94, time: now + 0.08 },
      { freq: 329.63, time: now + 0.16 },
      // High chord
      { freq: 440.00, time: now + 0.35 },
      { freq: 554.37, time: now + 0.35 },
      { freq: 659.25, time: now + 0.35 }
    ];

    notes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      // Lowpass for warm electric distortion
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, time);

      gain.gain.setValueAtTime(0.35, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(time);
      osc.stop(time + 0.85);
    });
  }

  // Star Sparkle Chime (for streaks & points)
  public playSparkleChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      gain.gain.setValueAtTime(0.25, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.35);
    });
  }

  // Crowd cheer synthetic noise burst
  public playCrowdCheer() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const t = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(1.0, t);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    noise.start(t);
    noise.stop(t + 1.25);
  }

  // Kid-friendly gentle "oops" blip (soft bounce)
  public playGentleOops() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain!);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  // Stop all scheduled playback
  public stopAll() {
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];
    this.isCurrentlyPlaying = false;
  }

  // Main Rhythm Sequencer
  public async playPattern(
    pattern: RhythmPattern,
    tempoBpm: number,
    kit: SoundKit,
    countIn: boolean,
    onProgress?: (progress: {
      isCountIn: boolean;
      countInBeat?: number;
      unitIndex?: number;
      beatIndex?: number;
      isFinished?: boolean;
    }) => void
  ): Promise<void> {
    this.stopAll();
    this.initContext();
    this.isCurrentlyPlaying = true;

    const secondsPerBeat = 60 / tempoBpm;

    return new Promise<void>((resolve) => {
      let currentOffsetSeconds = 0;

      // 1. Metronome Count-In (1, 2, 3, 4) - uniform clicks
      if (countIn) {
        for (let beat = 1; beat <= 4; beat++) {
          const beatTime = currentOffsetSeconds;
          const tid = window.setTimeout(() => {
            if (!this.isCurrentlyPlaying) return;
            this.playClick(false);
            onProgress?.({ isCountIn: true, countInBeat: beat });
          }, beatTime * 1000);
          this.activeTimeouts.push(tid);
          currentOffsetSeconds += secondsPerBeat;
        }
      }

      // 2. Play pattern units
      let accumulatedBeats = 0;
      pattern.units.forEach((unit, unitIdx) => {
        const unitStartBeat = accumulatedBeats;
        const unitStartTime = currentOffsetSeconds + unitStartBeat * secondsPerBeat;

        // Schedule visual unit trigger
        const unitTid = window.setTimeout(() => {
          if (!this.isCurrentlyPlaying) return;
          onProgress?.({
            isCountIn: false,
            unitIndex: unitIdx,
            beatIndex: Math.floor(unitStartBeat) + 1
          });
        }, unitStartTime * 1000);
        this.activeTimeouts.push(unitTid);

        // Schedule audio events for this unit - UNIFORM audio sample for every single note hit
        unit.events.forEach((ev) => {
          if (ev.isRest) return;
          const eventTime = unitStartTime + ev.offsetBeats * secondsPerBeat;
          const evTid = window.setTimeout(() => {
            if (!this.isCurrentlyPlaying) return;
            // Always uniform: never change for first note of pair or first beat of measure
            this.playUniformRhythmNote(kit);
          }, eventTime * 1000);
          this.activeTimeouts.push(evTid);
        });

        accumulatedBeats += unit.durationBeats;
      });

      // Total pattern end
      const totalDurationSec = currentOffsetSeconds + accumulatedBeats * secondsPerBeat + 0.3;
      const endTid = window.setTimeout(() => {
        this.isCurrentlyPlaying = false;
        onProgress?.({ isCountIn: false, isFinished: true });
        resolve();
      }, totalDurationSec * 1000);
      this.activeTimeouts.push(endTid);
    });
  }

  public getIsPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }
}

export const audioEngine = new AudioEngine();
