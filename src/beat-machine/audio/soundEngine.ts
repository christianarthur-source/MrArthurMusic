import { SoundType, BassInstrument } from '../types';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private isEchoOn: boolean = false;

  private filterNode: BiquadFilterNode | null = null;
  private isFilterOn: boolean = false;

  private distortionNode: WaveShaperNode | null = null;
  private isDistortionOn: boolean = false;

  private bitcrusherNode: WaveShaperNode | null = null;
  private isBitcrusherOn: boolean = false;

  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private isReverbOn: boolean = false;

  // Custom recorded user sample buffer
  private customBuffer: AudioBuffer | null = null;

  // Recording functionality (WAV export)
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecordingSong: boolean = false;

  // Generate synthetic impulse response for cathedral reverb with balanced decay & soft resonance
  private createImpulseResponse(duration: number = 2.4, decay: number = 3.0): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // Exponential decay envelope for clean natural reverberation
      const envelope = Math.pow(1 - i / length, decay);
      // Gentle resonant reflections
      const resonanceLeft = Math.sin(t * 180 * Math.PI) * 0.06;
      const resonanceRight = Math.cos(t * 190 * Math.PI) * 0.06;
      left[i] = ((Math.random() * 2 - 1) * 0.6 + resonanceLeft) * envelope;
      right[i] = ((Math.random() * 2 - 1) * 0.6 + resonanceRight) * envelope;
    }
    return impulse;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Compressor to protect ears and keep levels punchy
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

      // Distortion Node (Warm Tube Drive)
      this.distortionNode = this.ctx.createWaveShaper();
      this.distortionNode.curve = null;

      // Bitcrusher Node (Retro 8-Bit Crunch)
      this.bitcrusherNode = this.ctx.createWaveShaper();
      this.bitcrusherNode.curve = null;

      // Filter Node (Lowpass)
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(20000, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(3, this.ctx.currentTime);

      // Convolver Reverb with balanced natural trail
      this.reverbNode = this.ctx.createConvolver();
      const impulse = this.createImpulseResponse(2.4, 3.0);
      if (impulse) {
        this.reverbNode.buffer = impulse;
      }
      this.reverbGain = this.ctx.createGain();
      this.reverbGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.reverbNode.connect(this.reverbGain);

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      // Delay / Echo send
      this.delayNode = this.ctx.createDelay();
      this.delayNode.delayTime.setValueAtTime(0.25, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);

      // Audio Chain: compressor -> distortionNode -> bitcrusherNode -> filterNode -> masterGain -> destination
      this.compressor.connect(this.distortionNode);
      this.distortionNode.connect(this.bitcrusherNode);
      this.bitcrusherNode.connect(this.filterNode);
      this.filterNode.connect(this.masterGain);

      this.delayFeedback.connect(this.masterGain);
      this.reverbGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Also create recording destination node for downloading beats!
      try {
        this.mediaStreamDest = this.ctx.createMediaStreamDestination();
        this.masterGain.connect(this.mediaStreamDest);
      } catch (err) {
        console.warn('MediaStreamDestination not supported', err);
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private makeDistortionCurve(amount: number = 25) {
    if (amount <= 0) return null;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  private makeBitcrusherCurve(bits: number = 4) {
    if (bits >= 16) return null;
    const n_samples = 44100;
    const steps = Math.pow(2, bits);
    const curve = new Float32Array(n_samples);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    return curve;
  }

  public ensureAudioContext() {
    this.initContext();
    return this.ctx;
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime, 0.05);
    }
  }

  public setEcho(enabled: boolean) {
    this.isEchoOn = enabled;
    if (this.delayFeedback && this.ctx) {
      this.delayFeedback.gain.setTargetAtTime(enabled ? 0.42 : 0, this.ctx.currentTime, 0.05);
    }
  }

  public getEcho(): boolean {
    return this.isEchoOn;
  }

  public setReverb(enabled: boolean) {
    this.isReverbOn = enabled;
    if (this.reverbGain && this.ctx) {
      // Balanced wet level for clean, natural reverb trail & space
      this.reverbGain.gain.setTargetAtTime(enabled ? 0.45 : 0, this.ctx.currentTime, 0.05);
    }
  }

  public getReverb(): boolean {
    return this.isReverbOn;
  }

  public setBitcrusher(enabled: boolean) {
    this.isBitcrusherOn = enabled;
    if (this.bitcrusherNode) {
      this.bitcrusherNode.curve = enabled ? this.makeBitcrusherCurve(4) : null;
    }
  }

  public getBitcrusher(): boolean {
    return this.isBitcrusherOn;
  }

  public setDistortion(enabled: boolean) {
    this.isDistortionOn = enabled;
    if (this.distortionNode) {
      this.distortionNode.curve = enabled ? this.makeDistortionCurve(35) : null;
    }
  }

  public getDistortion(): boolean {
    return this.isDistortionOn;
  }

  public setFilter(enabled: boolean) {
    this.isFilterOn = enabled;
    if (this.filterNode && this.ctx) {
      this.filterNode.frequency.setTargetAtTime(enabled ? 750 : 20000, this.ctx.currentTime, 0.05);
    }
  }

  public getFilter(): boolean {
    return this.isFilterOn;
  }

  public setCustomBuffer(buffer: AudioBuffer | null) {
    this.customBuffer = buffer;
  }

  public getCustomBuffer(): AudioBuffer | null {
    return this.customBuffer;
  }

  // --- PLAY MELODY NOTE ---
  public playMelodyNote(
    freq: number,
    instrument:
      | 'xylo'
      | 'chiptune'
      | 'piano'
      | 'synth'
      | 'flute'
      | 'strings'
      | 'woodwinds'
      | 'brass'
      | 'guitar' = 'xylo',
    timeOffset: number = 0,
    volume: number = 1.0
  ) {
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    const startTime = timeOffset > 0 ? timeOffset : this.ctx.currentTime;
    const vol = Math.max(0.01, Math.min(1.5, volume));

    const soundGain = this.ctx.createGain();
    soundGain.gain.setValueAtTime(vol, startTime);
    soundGain.connect(this.compressor);

    if (this.isEchoOn && this.delayNode) {
      const echoSend = this.ctx.createGain();
      echoSend.gain.setValueAtTime(0.35, startTime);
      soundGain.connect(echoSend);
      echoSend.connect(this.delayNode);
    }

    if (this.isReverbOn && this.reverbNode) {
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.setValueAtTime(0.55, startTime);
      soundGain.connect(reverbSend);
      reverbSend.connect(this.reverbNode);
    }

    switch (instrument) {
      case 'xylo':
        this.synthXylophone(freq, startTime, soundGain, 1.0);
        break;
      case 'chiptune':
        this.synthChiptuneNote(freq, startTime, soundGain);
        break;
      case 'piano':
        this.synthPianoNote(freq, startTime, soundGain);
        break;
      case 'synth':
        this.synthSpaceSynthNote(freq, startTime, soundGain);
        break;
      case 'flute':
        this.synthFluteNote(freq, startTime, soundGain);
        break;
      case 'strings':
        this.synthStringsNote(freq, startTime, soundGain);
        break;
      case 'woodwinds':
        this.synthWoodwindsNote(freq, startTime, soundGain);
        break;
      case 'brass':
        this.synthBrassNote(freq, startTime, soundGain);
        break;
      case 'guitar':
        this.synthGuitarNote(freq, startTime, soundGain);
        break;
    }
  }

  // --- PLAY BASS NOTE ---
  public playBassNote(
    freq: number,
    instrument: BassInstrument = 'synth-bass',
    timeOffset: number = 0,
    volume: number = 1.0
  ) {
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    const startTime = timeOffset > 0 ? timeOffset : this.ctx.currentTime;
    const vol = Math.max(0.01, Math.min(1.5, volume));

    const soundGain = this.ctx.createGain();
    soundGain.gain.setValueAtTime(vol, startTime);
    soundGain.connect(this.compressor);

    if (this.isEchoOn && this.delayNode) {
      const echoSend = this.ctx.createGain();
      echoSend.gain.setValueAtTime(0.25, startTime);
      soundGain.connect(echoSend);
      echoSend.connect(this.delayNode);
    }

    if (this.isReverbOn && this.reverbNode) {
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.setValueAtTime(0.45, startTime);
      soundGain.connect(reverbSend);
      reverbSend.connect(this.reverbNode);
    }

    switch (instrument) {
      case 'string-bass':
        this.synthStringBassNote(freq, startTime, soundGain);
        break;
      case 'synth-bass':
        this.synthSynthBassNote(freq, startTime, soundGain);
        break;
      case 'tuba':
        this.synthTubaNote(freq, startTime, soundGain);
        break;
      case 'bass-guitar':
        this.synthBassGuitarNote(freq, startTime, soundGain);
        break;
      case 'bass-synth':
        this.synthBassSynthNote(freq, startTime, soundGain);
        break;
      default:
        this.synthSynthBassNote(freq, startTime, soundGain);
        break;
    }
  }

  // 1. String Bass (Upright Double Bass)
  private synthStringBassNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 1.001, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.linearRampToValueAtTime(500, t + 0.04);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.5);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.85, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.6);
    osc2.stop(t + 0.6);
  }

  // 2. Synth Bass (Wobble Sub Bass)
  private synthSynthBassNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.3);
    filter.Q.setValueAtTime(5.0, t);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.5);
  }

  // 3. Tuba (Low Brass Rumble)
  private synthTubaNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 0.5, t); // Sub harmonic

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.5, t);
    filter.frequency.linearRampToValueAtTime(freq * 3.5, t + 0.06);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.8, t + 0.45);
    filter.Q.setValueAtTime(2.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.9, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.55);
    osc2.stop(t + 0.55);
  }

  // 4. Bass Guitar (Plucked Electric Bass)
  private synthBassGuitarNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(220, t + 0.25);

    gain.gain.setValueAtTime(0.95, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.55);
    osc2.stop(t + 0.55);
  }

  // 5. Bass Synth (Funky Slap Synth)
  private synthBassSynthNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 6, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.2);
    filter.Q.setValueAtTime(6.0, t);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  // Strings (Violin / Cello ensemble)
  private synthStringsNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq * 0.998, t);
    osc2.frequency.setValueAtTime(freq * 1.002, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.frequency.linearRampToValueAtTime(2200, t + 0.15);
    filter.frequency.exponentialRampToValueAtTime(800, t + 0.55);

    // Warm bowed string attack
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.65);
  }

  // Woodwinds (Clarinet / Oboe warm woodwind)
  private synthWoodwindsNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(5.2, t);
    vibratoGain.gain.setValueAtTime(freq * 0.015, t);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.5, t);
    filter.Q.setValueAtTime(1.8, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.65, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + 0.6);
    vibrato.stop(t + 0.6);
  }

  // Brass (Trumpet / French Horn fanfare punch)
  private synthBrassNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    // Brassy filter opening
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 1.2, t);
    filter.frequency.linearRampToValueAtTime(freq * 5.0, t + 0.05);
    filter.frequency.exponentialRampToValueAtTime(freq * 2.0, t + 0.35);
    filter.Q.setValueAtTime(4.5, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.7, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.48);
  }

  // Guitar (Acoustic Pluck with wooden body resonance)
  private synthGuitarNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t);
    osc2.frequency.setValueAtTime(freq * 2, t);

    // Acoustic wooden body filter
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 1.8, t);
    filter.Q.setValueAtTime(1.2, t);

    // Sharp pluck followed by natural string ring
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.75);
    osc2.stop(t + 0.75);
  }

  // Chiptune 8-Bit Lead
  private synthChiptuneNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq * 0.98, t);
    osc.frequency.linearRampToValueAtTime(freq, t + 0.02);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  // Toy Piano / Celesta
  private synthPianoNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, t);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, t);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.65);
  }

  // Space Synth Lead
  private synthSpaceSynthNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 5, t);
    filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + 0.35);
    filter.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  // Magic Whistle / Flute
  private synthFluteNote(freq: number, t: number, dest: GainNode) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(6.0, t);
    vibratoGain.gain.setValueAtTime(freq * 0.02, t);

    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.6, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    vibrato.start(t);
    osc.stop(t + 0.55);
    vibrato.stop(t + 0.55);
  }

  // --- PLAY SOUND SAMPLE ---
  public playSound(
    type: SoundType,
    timeOffset: number = 0,
    volume: number = 1.0,
    pitchRate: number = 1.0,
    customOverrideBuffer?: AudioBuffer
  ) {
    this.initContext();
    if (!this.ctx || !this.compressor) return;

    const startTime = timeOffset > 0 ? timeOffset : this.ctx.currentTime;
    const vol = Math.max(0.01, Math.min(1.5, volume));

    // Per-sound gain
    const soundGain = this.ctx.createGain();
    soundGain.gain.setValueAtTime(vol, startTime);
    soundGain.connect(this.compressor);

    // Optional echo send
    if (this.isEchoOn && this.delayNode) {
      const echoSend = this.ctx.createGain();
      echoSend.gain.setValueAtTime(0.35, startTime);
      soundGain.connect(echoSend);
      echoSend.connect(this.delayNode);
    }

    if (this.isReverbOn && this.reverbNode) {
      const reverbSend = this.ctx.createGain();
      reverbSend.gain.setValueAtTime(0.55, startTime);
      soundGain.connect(reverbSend);
      reverbSend.connect(this.reverbNode);
    }

    switch (type) {
      case 'kick':
        this.synthKick(startTime, soundGain, pitchRate);
        break;
      case 'snare':
        this.synthSnare(startTime, soundGain, pitchRate);
        break;
      case 'hihat':
        this.synthHiHat(startTime, soundGain, pitchRate);
        break;
      case 'clap':
        this.synthClap(startTime, soundGain, pitchRate);
        break;
      case 'tom':
        this.synthTom(startTime, soundGain, pitchRate);
        break;
      case 'plop':
        this.synthPlop(startTime, soundGain, pitchRate);
        break;
      case 'boing':
        this.synthBoing(startTime, soundGain, pitchRate);
        break;
      case 'zap':
        this.synthZap(startTime, soundGain, pitchRate);
        break;
      case 'coin':
        this.synthCoin(startTime, soundGain, pitchRate);
        break;
      case 'quack':
        this.synthQuack(startTime, soundGain, pitchRate);
        break;
      case 'cowbell':
        this.synthCowbell(startTime, soundGain, pitchRate);
        break;
      case 'robot':
        this.synthRobot(startTime, soundGain, pitchRate);
        break;
      case 'fart':
        this.synthFart(startTime, soundGain, pitchRate);
        break;
      case 'baby-cry':
        this.synthBabyCry(startTime, soundGain, pitchRate);
        break;
      case 'dog-bark':
        this.synthDogBark(startTime, soundGain, pitchRate);
        break;
      case 'cat-meow':
        this.synthCatMeow(startTime, soundGain, pitchRate);
        break;
      case 'vroom':
        this.synthVroom(startTime, soundGain, pitchRate);
        break;
      case 'siren':
        this.synthSiren(startTime, soundGain, pitchRate);
        break;
      case 'cow-moo':
        this.synthCowMoo(startTime, soundGain, pitchRate);
        break;
      case 'xylo-c':
        this.synthXylophone(261.63, startTime, soundGain, pitchRate); // C4
        break;
      case 'xylo-d':
        this.synthXylophone(293.66, startTime, soundGain, pitchRate); // D4
        break;
      case 'xylo-e':
        this.synthXylophone(329.63, startTime, soundGain, pitchRate); // E4
        break;
      case 'xylo-g':
        this.synthXylophone(392.0, startTime, soundGain, pitchRate); // G4
        break;
      case 'xylo-a':
        this.synthXylophone(440.0, startTime, soundGain, pitchRate); // A4
        break;
      case 'xylo-c2':
        this.synthXylophone(523.25, startTime, soundGain, pitchRate); // C5
        break;
      case 'bass-wobble':
        this.synthBassWobble(startTime, soundGain, pitchRate);
        break;
      case 'acoustic-kick':
        this.synthKick(startTime, soundGain, pitchRate * 0.9);
        break;
      case 'acoustic-snare':
        this.synthSnare(startTime, soundGain, pitchRate * 1.1);
        break;
      case 'closed-hat':
        this.synthHiHat(startTime, soundGain, pitchRate * 1.4);
        break;
      case 'open-hat':
        this.synthHiHat(startTime, soundGain, pitchRate * 0.7);
        break;
      case 'crash':
        this.synthSnare(startTime, soundGain, pitchRate * 0.5);
        break;
      case 'ride':
        this.synthHiHat(startTime, soundGain, pitchRate * 0.9);
        break;
      case 'conga':
        this.synthTom(startTime, soundGain, pitchRate * 1.3);
        break;
      case 'bongo':
        this.synthTom(startTime, soundGain, pitchRate * 1.8);
        break;
      case 'shaker':
        this.synthHiHat(startTime, soundGain, pitchRate * 2.0);
        break;
      case 'tambourine':
        this.synthClap(startTime, soundGain, pitchRate * 1.2);
        break;
      case 'custom-mic': {
        const bufferToPlay = customOverrideBuffer || this.customBuffer;
        if (bufferToPlay) {
          this.playAudioBuffer(bufferToPlay, startTime, soundGain, pitchRate);
        } else {
          // Fallback playful pop if no mic recording yet
          this.synthPlop(startTime, soundGain, pitchRate);
        }
        break;
      }
    }
  }

  // --- SYNTHESIZERS ---

  // 1. PUNCHY BOUNCY KICK
  private synthKick(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 160 * pitchRate;
    const endFreq = 38 * pitchRate;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.14);

    gain.gain.setValueAtTime(1.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.35);
  }

  // 2. CRISP POPPY SNARE
  private synthSnare(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;

    // Body tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(200 * pitchRate, t);
    osc.frequency.exponentialRampToValueAtTime(80 * pitchRate, t + 0.1);
    oscGain.gain.setValueAtTime(0.8, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.15);

    // Noise snap
    const noiseBuffer = this.getNoiseBuffer();
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(900 * pitchRate, t);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.9, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.25);
  }

  // 3. SHARP TICKY HI-HAT
  private synthHiHat(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(8500 * pitchRate, t);
    bandpass.Q.setValueAtTime(4.0, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.065);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(dest);

    noise.start(t);
    noise.stop(t + 0.08);
  }

  // 4. HAND CLAP
  private synthClap(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const noiseBuffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400 * pitchRate, t);
    filter.Q.setValueAtTime(2.5, t);

    const gain = this.ctx.createGain();
    filter.connect(gain);
    gain.connect(dest);

    // 3 mini bursts followed by tail
    const bursts = [0, 0.012, 0.024];
    bursts.forEach((offset) => {
      const src = this.ctx!.createBufferSource();
      src.buffer = noiseBuffer;
      src.connect(filter);
      src.start(t + offset);
      src.stop(t + offset + 0.012);
    });

    const tail = this.ctx.createBufferSource();
    tail.buffer = noiseBuffer;
    tail.connect(filter);
    gain.gain.setValueAtTime(0.9, t + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    tail.start(t + 0.035);
    tail.stop(t + 0.25);
  }

  // 5. CARTOON TOM
  private synthTom(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170 * pitchRate, t);
    osc.frequency.exponentialRampToValueAtTime(75 * pitchRate, t + 0.2);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 6. BUBBLE PLOP
  private synthPlop(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220 * pitchRate, t);
    osc.frequency.exponentialRampToValueAtTime(720 * pitchRate, t + 0.08);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  // 7. SPRING BOING (WOBBLY MODULATION)
  private synthBoing(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const masterBoingGain = this.ctx.createGain();

    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(280 * pitchRate, t);
    carrier.frequency.exponentialRampToValueAtTime(540 * pitchRate, t + 0.35);

    modulator.type = 'sine';
    modulator.frequency.setValueAtTime(18, t);
    modulator.frequency.linearRampToValueAtTime(8, t + 0.4);

    modGain.gain.setValueAtTime(140 * pitchRate, t);
    modGain.gain.exponentialRampToValueAtTime(5, t + 0.4);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    masterBoingGain.gain.setValueAtTime(0.85, t);
    masterBoingGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    carrier.connect(masterBoingGain);
    masterBoingGain.connect(dest);

    carrier.start(t);
    modulator.start(t);
    carrier.stop(t + 0.5);
    modulator.stop(t + 0.5);
  }

  // 8. LASER ZAP
  private synthZap(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200 * pitchRate, t);
    osc.frequency.exponentialRampToValueAtTime(60 * pitchRate, t + 0.14);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // 9. COIN 1-UP (CLASSIC RETRO ARCADY CHIME)
  private synthCoin(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    const note1 = 987.77 * pitchRate; // B5
    const note2 = 1318.51 * pitchRate; // E6

    osc.frequency.setValueAtTime(note1, t);
    osc.frequency.setValueAtTime(note2, t + 0.08);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.setValueAtTime(0.45, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.38);
  }

  // 10. CARTOON DUCK QUACK
  private synthQuack(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const bandpass = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320 * pitchRate, t);
    osc.frequency.exponentialRampToValueAtTime(190 * pitchRate, t + 0.2);

    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(800 * pitchRate, t);
    bandpass.Q.setValueAtTime(6.0, t);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // 11. COWBELL
  private synthCowbell(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(587 * pitchRate, t);
    osc2.frequency.setValueAtTime(845 * pitchRate, t);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000 * pitchRate, t);
    filter.Q.setValueAtTime(2.5, t);

    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.28);
    osc2.stop(t + 0.28);
  }

  // 12. ROBOT TALK BEEP
  private synthRobot(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    // Robotic stepped pitches
    osc.frequency.setValueAtTime(240 * pitchRate, t);
    osc.frequency.setValueAtTime(360 * pitchRate, t + 0.05);
    osc.frequency.setValueAtTime(480 * pitchRate, t + 0.1);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  // 13. RAINBOW XYLOPHONE / MARIMBA (Physical bell model)
  private synthXylophone(baseFreq: number, t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const freq = baseFreq * pitchRate;

    // Fundamental chime
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);
    gain1.gain.setValueAtTime(0.85, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    // Bright harmonic (strike mallet tap)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 3.02, t);
    gain2.gain.setValueAtTime(0.4, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc1.connect(gain1);
    osc2.connect(gain2);
    gain1.connect(dest);
    gain2.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.5);
    osc2.stop(t + 0.12);
  }

  // 14. BASS WOBBLE
  private synthBassWobble(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65 * pitchRate, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250 * pitchRate, t);
    filter.frequency.linearRampToValueAtTime(900 * pitchRate, t + 0.12);
    filter.frequency.exponentialRampToValueAtTime(120 * pitchRate, t + 0.35);
    filter.Q.setValueAtTime(6.0, t);

    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // 15. PLAY CUSTOM AUDIO BUFFER (MIC RECORDING)
  private playAudioBuffer(buffer: AudioBuffer, t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(pitchRate, t);
    src.connect(dest);
    src.start(t);
  }

  // Shared White Noise Buffer
  private noiseBufferCache: AudioBuffer | null = null;
  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBufferCache) return this.noiseBufferCache;
    const length = (this.ctx?.sampleRate || 44100) * 1;
    const buffer = this.ctx!.createBuffer(1, length, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBufferCache = buffer;
    return buffer;
  }

  // 13. Hilarious Realistic Whoopee Cushion Fart
  private synthFart(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const flutterLFO = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const distortion = this.ctx.createWaveShaper();
    const gain = this.ctx.createGain();

    const startFreq = 165 * pitchRate;
    const endFreq = Math.max(20, 32 * pitchRate);

    // Osc 1: Sawtooth sub growl
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(startFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(endFreq, t + 0.42);

    // Osc 2: Square sub texture
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(startFreq * 0.92, t);
    osc2.frequency.exponentialRampToValueAtTime(endFreq * 0.85, t + 0.42);

    // Rapid flutter LFO mimicking vibrating rubber cushion lips
    flutterLFO.type = 'sawtooth';
    flutterLFO.frequency.setValueAtTime(38, t);
    flutterLFO.frequency.linearRampToValueAtTime(22, t + 0.42);

    lfoGain.gain.setValueAtTime(0.85, t);
    flutterLFO.connect(lfoGain.gain);

    // Raspy distortion curve for authentic fart texture
    distortion.curve = this.makeDistortionCurve(45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750 * pitchRate, t);
    filter.frequency.exponentialRampToValueAtTime(160 * pitchRate, t + 0.42);
    filter.Q.setValueAtTime(4.5, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(1.1, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc1.connect(filter);
    osc2.connect(filter);

    // Crackling initial air puff
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    noise.connect(noiseGain);
    noiseGain.connect(filter);

    filter.connect(distortion);
    distortion.connect(lfoGain);
    lfoGain.connect(gain);
    gain.connect(dest);

    flutterLFO.start(t);
    osc1.start(t);
    osc2.start(t);
    noise.start(t);

    flutterLFO.stop(t + 0.46);
    osc1.stop(t + 0.46);
    osc2.stop(t + 0.46);
    noise.stop(t + 0.12);
  }

  // 14. Expressive Baby Cry ("Wah-Wah!")
  private synthBabyCry(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const formantFilter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const base = 520 * pitchRate;

    // Pitch envelope mimicking baby crying "Waaahhh-Waaah!"
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 0.8, t);
    osc.frequency.linearRampToValueAtTime(base * 1.45, t + 0.15);
    osc.frequency.linearRampToValueAtTime(base * 1.1, t + 0.32);
    osc.frequency.linearRampToValueAtTime(base * 1.55, t + 0.48);
    osc.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.72);

    // Tremolo / Vibrato modulation
    vibrato.type = 'sine';
    vibrato.frequency.setValueAtTime(7.5, t);
    vibratoGain.gain.setValueAtTime(32, t);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);

    // Vocal Formant Filter (Aah to Wah vocal filter sweep)
    formantFilter.type = 'bandpass';
    formantFilter.frequency.setValueAtTime(900, t);
    formantFilter.frequency.linearRampToValueAtTime(2100, t + 0.18);
    formantFilter.frequency.linearRampToValueAtTime(1200, t + 0.35);
    formantFilter.frequency.linearRampToValueAtTime(2300, t + 0.52);
    formantFilter.frequency.exponentialRampToValueAtTime(800, t + 0.72);
    formantFilter.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.85, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);

    osc.connect(formantFilter);
    formantFilter.connect(gain);
    gain.connect(dest);

    vibrato.start(t);
    osc.start(t);
    vibrato.stop(t + 0.78);
    osc.stop(t + 0.78);
  }

  // 15. Puppy Dog Bark
  private synthDogBark(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const startFreq = 260 * pitchRate;
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(startFreq, t);
    osc1.frequency.exponentialRampToValueAtTime(Math.max(20, 95 * pitchRate), t + 0.15);
    osc2.frequency.setValueAtTime(startFreq * 1.2, t);
    osc2.frequency.exponentialRampToValueAtTime(Math.max(20, 80 * pitchRate), t + 0.15);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, t);
    filter.Q.setValueAtTime(2.5, t);

    gain.gain.setValueAtTime(1.0, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.2);
    osc2.stop(t + 0.2);
  }

  // 16. Kitty Cat Meow
  private synthCatMeow(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const base = 380 * pitchRate;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.linearRampToValueAtTime(base * 1.7, t + 0.22);
    osc.frequency.linearRampToValueAtTime(base * 1.1, t + 0.48);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1250, t);
    filter.Q.setValueAtTime(3.5, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.75, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.55);
  }

  // 17. Car Vroom & Horn
  private synthVroom(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const engine = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(380 * pitchRate, t);
    osc2.frequency.setValueAtTime(460 * pitchRate, t);

    engine.type = 'sawtooth';
    engine.frequency.setValueAtTime(70 * pitchRate, t + 0.1);
    engine.frequency.linearRampToValueAtTime(220 * pitchRate, t + 0.35);
    engine.frequency.exponentialRampToValueAtTime(Math.max(20, 60 * pitchRate), t + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.58);

    osc1.connect(filter);
    osc2.connect(filter);
    engine.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    engine.start(t + 0.1);
    osc1.stop(t + 0.22);
    osc2.stop(t + 0.22);
    engine.stop(t + 0.6);
  }

  // 18. Rescue Siren
  private synthSiren(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const low = 650 * pitchRate;
    const high = 1100 * pitchRate;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(low, t);
    osc.frequency.linearRampToValueAtTime(high, t + 0.18);
    osc.frequency.linearRampToValueAtTime(low, t + 0.36);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.42);
  }

  // 19. Moo Cow
  private synthCowMoo(t: number, dest: GainNode, pitchRate: number) {
    if (!this.ctx) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    const start = 145 * pitchRate;
    osc1.type = 'triangle';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(start, t);
    osc1.frequency.linearRampToValueAtTime(start * 1.15, t + 0.15);
    osc1.frequency.exponentialRampToValueAtTime(Math.max(20, 90 * pitchRate), t + 0.55);

    osc2.frequency.setValueAtTime(start * 0.5, t);
    osc2.frequency.exponentialRampToValueAtTime(Math.max(20, 45 * pitchRate), t + 0.55);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.85, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.65);
    osc2.stop(t + 0.65);
  }

  // --- SONG RECORDING & EXPORT (.WAV) ---
  public startRecordingSong() {
    this.initContext();
    if (!this.mediaStreamDest) return;

    this.recordedChunks = [];
    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStreamDest.stream, {
        mimeType: 'audio/webm',
      });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(100);
      this.isRecordingSong = true;
    } catch (e) {
      console.warn('MediaRecorder error:', e);
    }
  }

  public stopRecordingSong(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || !this.isRecordingSong) {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecordingSong = false;
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public isSongRecording(): boolean {
    return this.isRecordingSong;
  }

  // Record 2 seconds from microphone and return AudioBuffer
  public async recordMicSample(durationSeconds: number = 2): Promise<AudioBuffer> {
    this.initContext();
    if (!this.ctx) throw new Error('AudioContext unavailable');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    return new Promise((resolve, reject) => {
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        try {
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
          this.customBuffer = decoded;
          resolve(decoded);
        } catch (err) {
          reject(err);
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, durationSeconds * 1000);
    });
  }

  public getCurrentTime(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }
}

export const soundEngine = new SoundEngine();
