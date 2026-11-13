/**
 * Chrome Music Lab EXTRA — Unified Web Audio Synthesis, Pitch Detection, WAV & MIDI Engine
 * Provides zero-latency polyphonic audio across Song Maker, Kandinsky, Shared Piano, and Rhythm.
 */

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10]
};

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToMidi(freq) {
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

export function midiToNoteName(midi, useFlats = false, includeOctave = true) {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const pitch = names[((midi % 12) + 12) % 12];
  if (!includeOctave) return pitch;
  const octave = Math.floor(midi / 12) - 1;
  return `${pitch}${octave}`;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.noiseBuffer = null;
    this.activeVoices = new Map();
    this.micStream = null;
    this.micAnalyser = null;
    this.micBuffer = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master brickwall limiter / gentle compressor to protect against digital clipping distortion
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -5;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 10;
      this.compressor.attack.value = 0.002;
      this.compressor.release.value = 0.12;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.68; // Balanced master level for optimal dynamic headroom

      // Single clean signal path through compressor limiter to destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      this.noiseBuffer = this.createWhiteNoiseBuffer(this.ctx, 1.5);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  resumeAudioContext() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }
    // Reliable 1-sample buffer playback to wake up OS CoreAudio hardware
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch (e) {}
    return ctx;
  }

  createWhiteNoiseBuffer(context, duration = 1.5) {
    const bufferSize = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Play a tonal instrument note
   * Supported: marimba, piano, strings, woodwind, synth, 8bit, kalimba, brass, steelpan, musicbox
   */
  playTonalNote(instrument, midi, duration = 0.35, timeOffset = 0, velocity = 0.8, customCtx = null, customDest = null) {
    const ctx = customCtx || this.ensureContext();
    const dest = customDest || this.masterGain;
    const now = ctx.currentTime + Math.max(0, timeOffset);

    if (instrument === 'drum-kit' || instrument === 'drum-machine') {
      this.playKeyboardDrum(instrument, midi, now, velocity, ctx, dest);
      return;
    }

    const freq = midiToFreq(midi);
    const env = ctx.createGain();
    env.connect(dest);

    switch (instrument) {
      case 'marimba': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const harmGain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 4, now);

        harmGain.gain.setValueAtTime(0.28 * velocity, now);
        harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

        const releaseTime = Math.max(duration, 0.32);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.38 * velocity, now + 0.006);
        env.gain.exponentialRampToValueAtTime(0.0008, now + releaseTime);

        osc1.connect(env);
        osc2.connect(harmGain);
        harmGain.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + releaseTime + 0.02);
        osc2.stop(now + 0.08);
        break;
      }

      case 'piano': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(4, now);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq * 2, now);

        const osc2Gain = ctx.createGain();
        osc2Gain.gain.value = 0.25;
        const osc3Gain = ctx.createGain();
        osc3Gain.gain.value = 0.15;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(freq * 6.5, 9000), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.8, 600), now + Math.max(duration, 0.45));

        const releaseTime = Math.max(duration * 1.35, 0.45);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.36 * velocity, now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.14 * velocity, now + 0.14);
        env.gain.exponentialRampToValueAtTime(0.0008, now + releaseTime);

        osc1.connect(filter);
        osc2.connect(osc2Gain);
        osc2Gain.connect(filter);
        osc3.connect(osc3Gain);
        osc3Gain.connect(filter);
        filter.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + releaseTime + 0.03);
        osc2.stop(now + releaseTime + 0.03);
        osc3.stop(now + releaseTime + 0.03);
        break;
      }

      case 'strings': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.detune.setValueAtTime(-7, now);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(7, now);

        sub.type = 'triangle';
        sub.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(freq * 3.8, 4800), now);
        filter.Q.value = 0.8;

        const dur = Math.max(duration, 0.35);
        const attack = Math.min(0.055, dur * 0.25);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.22 * velocity, now + attack);
        env.gain.setValueAtTime(0.20 * velocity, now + dur * 0.75);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur + 0.18);

        osc1.connect(filter);
        osc2.connect(filter);
        sub.connect(filter);
        filter.connect(env);

        osc1.start(now);
        osc2.start(now);
        sub.start(now);
        const stopAt = now + dur + 0.20;
        osc1.stop(stopAt);
        osc2.stop(stopAt);
        sub.stop(stopAt);
        break;
      }

      case 'woodwind': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq, now);

        const sqGain = ctx.createGain();
        sqGain.gain.value = 0.35;

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(Math.min(freq * 2.8, 3600), now);
        filter.Q.value = 1.4;

        const dur = Math.max(duration, 0.28);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.28 * velocity, now + 0.022);
        env.gain.setValueAtTime(0.24 * velocity, now + dur * 0.8);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur + 0.09);

        osc1.connect(sqGain);
        sqGain.connect(filter);
        osc2.connect(filter);
        filter.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.11);
        osc2.stop(now + dur + 0.11);
        break;
      }

      case '8bit': {
        // Retro chiptune / GameBoy square wave with vibrato
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now);

        const dur = Math.max(duration * 0.85, 0.22);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.22 * velocity, now + 0.004);
        env.gain.setValueAtTime(0.18 * velocity, now + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(env);
        osc.start(now);
        osc.stop(now + dur + 0.02);
        break;
      }

      case 'kalimba': {
        // African thumb piano / mbira: metallic tine chime + subtle pluck transient
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq * 2.98, now); // Metallic inharmonic
        g2.gain.setValueAtTime(0.35 * velocity, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        const dur = Math.max(duration, 0.45);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.42 * velocity, now + 0.004);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

        osc1.connect(env);
        osc2.connect(g2);
        g2.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.02);
        osc2.stop(now + 0.1);
        break;
      }

      case 'brass': {
        // Powerful synth brass fanfare with dynamic resonant filter sweep
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now);
        osc1.detune.setValueAtTime(-5, now);

        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq, now);
        osc2.detune.setValueAtTime(5, now);

        filter.type = 'lowpass';
        filter.Q.value = 2.5;
        filter.frequency.setValueAtTime(Math.min(freq * 1.5, 900), now);
        filter.frequency.linearRampToValueAtTime(Math.min(freq * 5.5, 6500), now + 0.08);
        filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.8, 800), now + duration);

        const dur = Math.max(duration, 0.32);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.30 * velocity, now + 0.035);
        env.gain.setValueAtTime(0.26 * velocity, now + dur * 0.8);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur + 0.08);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.1);
        osc2.stop(now + dur + 0.1);
        break;
      }

      case 'steelpan': {
        // Caribbean Steel Drum pan: rich resonant bell harmonics
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const osc3 = ctx.createOscillator();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 2.02, now);
        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.28, now);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(freq * 3.96, now);
        const g3 = ctx.createGain();
        g3.gain.setValueAtTime(0.22, now);
        g3.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        const dur = Math.max(duration, 0.48);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.36 * velocity, now + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur);

        osc1.connect(env);
        osc2.connect(g2);
        g2.connect(env);
        osc3.connect(g3);
        g3.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc3.start(now);
        osc1.stop(now + dur + 0.02);
        osc2.stop(now + 0.2);
        osc3.stop(now + 0.12);
        break;
      }

      case 'musicbox': {
        // Delicate vintage music box tinkling bell
        const osc = ctx.createOscillator();
        const oscH = ctx.createOscillator();
        const gH = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 2, now); // Higher chime octave

        oscH.type = 'sine';
        oscH.frequency.setValueAtTime(freq * 8.05, now);
        gH.gain.setValueAtTime(0.18 * velocity, now);
        gH.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        const dur = Math.max(duration, 0.55);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.32 * velocity, now + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0005, now + dur);

        osc.connect(env);
        oscH.connect(gH);
        gH.connect(env);

        osc.start(now);
        oscH.start(now);
        osc.stop(now + dur + 0.02);
        oscH.stop(now + 0.06);
        break;
      }

      case 'synth':
      default: {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(freq * 0.5, now);
        const subGain = ctx.createGain();
        subGain.gain.value = 0.28;

        filter.type = 'lowpass';
        filter.Q.value = 3.2;
        filter.frequency.setValueAtTime(Math.min(freq * 7, 8500), now);
        filter.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.4, 320), now + Math.max(duration, 0.28));

        const dur = Math.max(duration, 0.28);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(0.28 * velocity, now + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0008, now + dur + 0.08);

        osc1.connect(filter);
        osc2.connect(subGain);
        subGain.connect(filter);
        filter.connect(env);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + dur + 0.1);
        osc2.stop(now + dur + 0.1);
        break;
      }
    }
  }

  /**
   * Play Song Maker Percussion
   * @param {string} kit - 'electronic' | 'blocks' | 'kit' | 'conga' | '8bit' | 'latin' | 'lofi'
   * @param {string} soundType - 'high' | 'mid' | 'low'
   */
  playSongMakerDrum(kit, soundType = 'low', timeOffset = 0, velocity = 0.85, customCtx = null, customDest = null) {
    const ctx = customCtx || this.ensureContext();
    const dest = customDest || this.masterGain;
    const now = ctx.currentTime + Math.max(0, timeOffset);

    // Normalize high / mid / low
    const isHigh = soundType === 'high';
    const isMid = soundType === 'mid';
    const isLow = soundType === 'low' || (!isHigh && !isMid);

    switch (kit) {
      case 'electronic': {
        if (isLow) {
          // 808 Deep Sub Kick
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(145, now);
          osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
          gain.gain.setValueAtTime(0.68 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.27);
        } else if (isMid) {
          // 808 Snare / Clap
          this.triggerNoiseBurst(ctx, dest, now, 0.14, 1800, 'bandpass', 0.45 * velocity);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(260, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.06);
          gain.gain.setValueAtTime(0.3 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.09);
        } else {
          // Crisp Closed Electronic Hi-Hat
          this.triggerNoiseBurst(ctx, dest, now, 0.07, 7200, 'highpass', 0.38 * velocity);
        }
        break;
      }

      case 'blocks': {
        // 3-pitch tuned temple woodblocks
        const baseFreq = isHigh ? 1120 : isMid ? 820 : 580;
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, now + 0.07);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2.4, now);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq, now);
        filter.Q.value = 6;

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.55 * velocity, now + 0.003);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.12);
        osc2.stop(now + 0.12);
        break;
      }

      case 'conga': {
        // Tumbadora / Conga / Quinto (3 distinct pitches)
        const freq = isHigh ? 440 : isMid ? 310 : 190;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * 1.18, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.035);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.88, now + 0.20);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.52 * velocity, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isHigh ? 0.15 : 0.24));

        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.26);
        this.triggerNoiseBurst(ctx, dest, now, 0.025, 1400, 'bandpass', 0.16 * velocity);
        break;
      }

      case '8bit': {
        // Retro chiptune noise burst + pitched blip kick
        if (isLow) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(130, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);
          gain.gain.setValueAtTime(0.55 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.19);
        } else if (isMid) {
          this.triggerNoiseBurst(ctx, dest, now, 0.09, 1200, 'bandpass', 0.45 * velocity);
        } else {
          this.triggerNoiseBurst(ctx, dest, now, 0.045, 5500, 'highpass', 0.4 * velocity);
        }
        break;
      }

      case 'latin': {
        // Cowbell (High), Clave (Mid), Bongo (Low)
        if (isHigh) {
          this.playCowbell(ctx, dest, now, velocity);
        } else if (isMid) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2450, now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.45 * velocity, now + 0.002);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.06);
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
          gain.gain.setValueAtTime(0.55 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.21);
        }
        break;
      }

      case 'lofi': {
        // Muffled vinyl kick, dusty brush snare, vinyl tick hat
        if (isLow) {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(95, now);
          osc.frequency.exponentialRampToValueAtTime(36, now + 0.18);
          filter.type = 'lowpass';
          filter.frequency.value = 280;
          gain.gain.setValueAtTime(0.65 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.29);
        } else if (isMid) {
          this.triggerNoiseBurst(ctx, dest, now, 0.22, 1100, 'bandpass', 0.28 * velocity);
        } else {
          this.triggerNoiseBurst(ctx, dest, now, 0.05, 4200, 'bandpass', 0.22 * velocity);
        }
        break;
      }

      case 'kit':
      default: {
        if (isLow) {
          // Acoustic Bass Drum
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(125, now);
          osc.frequency.exponentialRampToValueAtTime(44, now + 0.11);
          gain.gain.setValueAtTime(0.62 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.23);
          this.triggerNoiseBurst(ctx, dest, now, 0.018, 900, 'lowpass', 0.22 * velocity);
        } else if (isMid) {
          // Acoustic Snare Drum
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.exponentialRampToValueAtTime(125, now + 0.08);
          gain.gain.setValueAtTime(0.35 * velocity, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.12);
          this.triggerNoiseBurst(ctx, dest, now, 0.16, 1800, 'highpass', 0.42 * velocity);
        } else {
          // Acoustic Hi-Hat
          this.playHiHat(ctx, dest, now, 0.09, velocity);
        }
        break;
      }
    }
  }

  playRhythmSound(sceneIndex, rowIndex, timeOffset = 0, velocity = 0.9) {
    const ctx = this.ensureContext();
    const dest = this.masterGain;
    const now = ctx.currentTime + Math.max(0, timeOffset);

    if (sceneIndex === 0) {
      if (rowIndex === 0) {
        this.playMetallicTriangle(ctx, dest, now, velocity);
      } else if (rowIndex === 1) {
        this.playTimpani(ctx, dest, now, 196.0, velocity);
      } else {
        this.playTimpani(ctx, dest, now, 130.81, velocity);
      }
    } else if (sceneIndex === 1) {
      if (rowIndex === 0) {
        this.playHiHat(ctx, dest, now, 0.09, velocity);
      } else if (rowIndex === 1) {
        this.playSongMakerDrum('kit', 'mid', timeOffset, velocity);
      } else {
        this.playSongMakerDrum('kit', 'low', timeOffset, velocity);
      }
    } else if (sceneIndex === 2) {
      if (rowIndex === 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2450, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.45 * velocity, now + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (rowIndex === 1) {
        this.playSongMakerDrum('blocks', 'high', timeOffset, velocity);
      } else {
        this.playSongMakerDrum('blocks', 'low', timeOffset, velocity);
      }
    } else {
      if (rowIndex === 0) {
        this.playCowbell(ctx, dest, now, velocity);
      } else if (rowIndex === 1) {
        this.playSongMakerDrum('conga', 'high', timeOffset, velocity);
      } else {
        this.playSongMakerDrum('conga', 'low', timeOffset, velocity);
      }
    }
  }

  playKandinskyShape(schemeIndex, shapeType, pitchIndex = 4, duration = 0.45) {
    const ctx = this.ensureContext();
    const dest = this.masterGain;
    const now = ctx.currentTime;

    const scaleMidi = [48, 52, 55, 57, 60, 64, 67, 72];
    const clampedIdx = Math.max(0, Math.min(7, Math.round(pitchIndex)));
    const midi = scaleMidi[clampedIdx];
    const freq = midiToFreq(midi);

    if (shapeType === 'circle') {
      this.playVocalFormant(ctx, dest, now, freq * 1.5, schemeIndex, Math.max(duration, 0.55));
    } else if (shapeType === 'triangle') {
      if (schemeIndex === 0) {
        this.playHiHat(ctx, dest, now, 0.32, 0.7);
        this.playSongMakerDrum('kit', 'mid', 0, 0.85);
      } else if (schemeIndex === 1) {
        this.playMetallicTriangle(ctx, dest, now, 0.85);
        this.playTimpani(ctx, dest, now, 146.83, 0.65);
      } else {
        this.playCowbell(ctx, dest, now, 0.65);
        this.playSongMakerDrum('electronic', 'low', 0, 0.8);
      }
    } else {
      if (schemeIndex === 0) {
        this.playTonalNote('synth', midi - 12, duration, 0, 0.8);
      } else if (schemeIndex === 1) {
        this.playTonalNote('strings', midi, duration * 1.2, 0, 0.85);
      } else {
        this.playTonalNote('marimba', midi + 12, duration, 0, 0.85);
      }
    }
  }

  playVocalFormant(ctx, dest, now, freq, schemeIndex, duration = 0.55) {
    const source = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibGain = ctx.createGain();

    source.type = 'sawtooth';
    source.frequency.setValueAtTime(freq, now);

    sub.type = 'triangle';
    sub.frequency.setValueAtTime(freq, now);

    vibrato.frequency.value = 5.5;
    vibGain.gain.value = 4.5;
    vibrato.connect(vibGain);
    vibGain.connect(source.frequency);

    const formants = schemeIndex === 0
      ? [520, 1100, 2500]
      : schemeIndex === 1
        ? [800, 1200, 2800]
        : [380, 2100, 2900];

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.32, now + 0.045);
    env.gain.setValueAtTime(0.28, now + duration * 0.7);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);
    env.connect(dest);

    formants.forEach((fFreq, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(fFreq * 0.85, now);
      bp.frequency.exponentialRampToValueAtTime(fFreq, now + 0.09);
      bp.Q.value = 6 + i * 2;

      const fGain = ctx.createGain();
      fGain.gain.value = i === 0 ? 1.0 : i === 1 ? 0.65 : 0.35;

      source.connect(bp);
      sub.connect(bp);
      bp.connect(fGain);
      fGain.connect(env);
    });

    source.start(now);
    sub.start(now);
    vibrato.start(now);
    source.stop(now + duration + 0.03);
    sub.stop(now + duration + 0.03);
    vibrato.stop(now + duration + 0.03);
  }

  playMetallicTriangle(ctx, dest, now, velocity = 0.85) {
    const freqs = [2950, 4420, 6180, 8120];
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.linearRampToValueAtTime(0.25 * velocity, now + 0.003);
    master.gain.exponentialRampToValueAtTime(0.0008, now + 0.65);
    master.connect(dest);

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      g.gain.value = 1 / (idx + 1);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.68);
    });
  }

  playTimpani(ctx, dest, now, freq = 146.83, velocity = 0.85) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.12, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.055);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.45);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.5, now);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.22, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.62 * velocity, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.50);
    osc2.stop(now + 0.50);
  }

  playHiHat(ctx, dest, now, duration = 0.09, velocity = 0.8) {
    this.triggerNoiseBurst(ctx, dest, now, duration, 6500, 'highpass', 0.35 * velocity);
  }

  playCowbell(ctx, dest, now, velocity = 0.85) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(540, now);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.36 * velocity, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.19);
    osc2.stop(now + 0.19);
  }

  playKeyboardDrum(kitType, midi, now, velocity, ctx, dest) {
    const slot = ((midi % 6) + 6) % 6;
    const isElectronic = kitType === 'drum-machine';
    if (slot === 0) {
      this.playSongMakerDrum(isElectronic ? 'electronic' : 'kit', 'low', 0, velocity, ctx, dest);
    } else if (slot === 1) {
      this.playSongMakerDrum(isElectronic ? 'electronic' : 'kit', 'mid', 0, velocity, ctx, dest);
    } else if (slot === 2) {
      this.playSongMakerDrum(isElectronic ? 'electronic' : 'kit', 'high', 0, velocity, ctx, dest);
    } else if (slot === 3) {
      this.playHiHat(ctx, dest, now, 0.28, velocity);
    } else if (slot === 4) {
      this.playSongMakerDrum('conga', 'low', 0, velocity, ctx, dest);
    } else {
      this.playCowbell(ctx, dest, now, velocity);
    }
  }

  playMetronomeClick(isDownbeat = false) {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isDownbeat ? 1320 : 880, now);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  triggerNoiseBurst(ctx, dest, now, duration, filterFreq, filterType = 'highpass', peakGain = 0.3) {
    const noiseBuf = (ctx === this.ctx && this.noiseBuffer)
      ? this.noiseBuffer
      : this.createWhiteNoiseBuffer(ctx, Math.max(duration + 0.05, 0.5));
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.start(now);
    src.stop(now + duration + 0.01);
  }

  async startMicrophone() {
    this.ensureContext();
    if (this.micStream) return true;
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false
        }
      });
      const source = this.ctx.createMediaStreamSource(this.micStream);
      this.micAnalyser = this.ctx.createAnalyser();
      this.micAnalyser.fftSize = 2048;
      source.connect(this.micAnalyser);
      this.micBuffer = new Float32Array(this.micAnalyser.fftSize);
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable:', err);
      return false;
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
      this.micAnalyser = null;
    }
  }

  detectMicPitch() {
    if (!this.micAnalyser || !this.micBuffer || !this.ctx) return null;
    this.micAnalyser.getFloatTimeDomainData(this.micBuffer);

    let sumSq = 0;
    for (let i = 0; i < this.micBuffer.length; i++) {
      sumSq += this.micBuffer[i] * this.micBuffer[i];
    }
    const rms = Math.sqrt(sumSq / this.micBuffer.length);
    if (rms < 0.018) {
      return { rms, freq: null, midi: null, noteName: null };
    }

    const sampleRate = this.ctx.sampleRate;
    const minLag = Math.floor(sampleRate / 1000);
    const maxLag = Math.floor(sampleRate / 75);
    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < 1024; i++) {
        const a = this.micBuffer[i];
        const b = this.micBuffer[i + lag];
        corr += a * b;
        normA += a * a;
        normB += b * b;
      }
      const denom = Math.sqrt(normA * normB);
      const normCorr = denom > 0 ? corr / denom : 0;
      if (normCorr > bestCorr) {
        bestCorr = normCorr;
        bestLag = lag;
      }
    }

    if (bestCorr > 0.82 && bestLag > 0) {
      const freq = sampleRate / bestLag;
      const midi = freqToMidi(freq);
      return {
        rms: Math.min(1, rms * 6),
        freq,
        midi,
        noteName: midiToNoteName(midi),
        clarity: bestCorr
      };
    }

    return { rms: Math.min(1, rms * 6), freq: null, midi: null, noteName: null };
  }

  async exportSongMakerWav(songData) {
    const {
      totalCols,
      stepDurationSec,
      instrument,
      drumKit,
      tonalGrid,
      drumGrid,
      drumRowCount = 2,
      rowIndexToMidi
    } = songData;

    const totalDuration = totalCols * stepDurationSec + 1.0;
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

    const master = offlineCtx.createGain();
    master.gain.value = 0.75;
    master.connect(offlineCtx.destination);

    for (let col = 0; col < totalCols; col++) {
      const stepTime = col * stepDurationSec;
      for (let row = 0; row < tonalGrid.length; row++) {
        if (tonalGrid[row][col]) {
          const midi = rowIndexToMidi(row);
          this.playTonalNote(instrument, midi, stepDurationSec * 0.95, stepTime, 0.8, offlineCtx, master);
        }
      }

      // Drum row playback: 2 rows or 3 rows
      if (drumRowCount === 3) {
        if (drumGrid[0] && drumGrid[0][col]) {
          this.playSongMakerDrum(drumKit, 'high', stepTime, 0.85, offlineCtx, master);
        }
        if (drumGrid[1] && drumGrid[1][col]) {
          this.playSongMakerDrum(drumKit, 'mid', stepTime, 0.85, offlineCtx, master);
        }
        if (drumGrid[2] && drumGrid[2][col]) {
          this.playSongMakerDrum(drumKit, 'low', stepTime, 0.85, offlineCtx, master);
        }
      } else {
        if (drumGrid[0] && drumGrid[0][col]) {
          this.playSongMakerDrum(drumKit, 'high', stepTime, 0.85, offlineCtx, master);
        }
        if (drumGrid[1] && drumGrid[1][col]) {
          this.playSongMakerDrum(drumKit, 'low', stepTime, 0.85, offlineCtx, master);
        }
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new ArrayBuffer(length);
    const view = new DataView(out);
    const channels = [];
    let sample = 0;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data) => { view.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data) => { view.setUint32(pos, data, true); pos += 4; };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1); // PCM
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4);

    for (let i = 0; i < numOfChan; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out], { type: 'audio/wav' });
  }

  exportSongMakerMidi(songData) {
    const {
      totalCols,
      bpm,
      splitBeats,
      tonalGrid,
      drumGrid,
      drumRowCount = 2,
      rowIndexToMidi
    } = songData;

    const ticksPerBeat = 480;
    const ticksPerStep = Math.round(ticksPerBeat / splitBeats);
    const events = [];

    const microsecondsPerBeat = Math.round(60000000 / bpm);
    events.push({
      tick: 0,
      bytes: [
        0xFF, 0x51, 0x03,
        (microsecondsPerBeat >> 16) & 0xFF,
        (microsecondsPerBeat >> 8) & 0xFF,
        microsecondsPerBeat & 0xFF
      ]
    });

    for (let col = 0; col < totalCols; col++) {
      const startTick = col * ticksPerStep;
      const endTick = startTick + Math.max(1, ticksPerStep - 10);

      for (let row = 0; row < tonalGrid.length; row++) {
        if (tonalGrid[row][col]) {
          const midi = rowIndexToMidi(row);
          events.push({ tick: startTick, bytes: [0x90, midi & 0x7F, 100] });
          events.push({ tick: endTick,   bytes: [0x80, midi & 0x7F, 0] });
        }
      }

      if (drumRowCount === 3) {
        if (drumGrid[0] && drumGrid[0][col]) {
          events.push({ tick: startTick, bytes: [0x99, 42, 100] }); // Closed Hi-Hat
          events.push({ tick: endTick,   bytes: [0x89, 42, 0] });
        }
        if (drumGrid[1] && drumGrid[1][col]) {
          events.push({ tick: startTick, bytes: [0x99, 38, 100] }); // Snare
          events.push({ tick: endTick,   bytes: [0x89, 38, 0] });
        }
        if (drumGrid[2] && drumGrid[2][col]) {
          events.push({ tick: startTick, bytes: [0x99, 36, 105] }); // Kick
          events.push({ tick: endTick,   bytes: [0x89, 36, 0] });
        }
      } else {
        if (drumGrid[0] && drumGrid[0][col]) {
          events.push({ tick: startTick, bytes: [0x99, 38, 100] }); // Snare
          events.push({ tick: endTick,   bytes: [0x89, 38, 0] });
        }
        if (drumGrid[1] && drumGrid[1][col]) {
          events.push({ tick: startTick, bytes: [0x99, 36, 105] }); // Kick
          events.push({ tick: endTick,   bytes: [0x89, 36, 0] });
        }
      }
    }

    events.sort((a, b) => a.tick - b.tick);

    const writeVarLen = (val) => {
      const buffer = [val & 0x7F];
      while ((val >>= 7)) {
        buffer.unshift((val & 0x7F) | 0x80);
      }
      return buffer;
    };

    const trackBytes = [];
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      lastTick = ev.tick;
      trackBytes.push(...writeVarLen(delta), ...ev.bytes);
    }
    trackBytes.push(0x00, 0xFF, 0x2F, 0x00);

    const header = [
      0x4D, 0x54, 0x68, 0x64,
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x00,
      0x00, 0x01,
      (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF
    ];

    const len = trackBytes.length;
    const trackHeader = [
      0x4D, 0x54, 0x72, 0x6B,
      (len >> 24) & 0xFF,
      (len >> 16) & 0xFF,
      (len >> 8) & 0xFF,
      len & 0xFF
    ];

    const fullMidi = new Uint8Array([...header, ...trackHeader, ...trackBytes]);
    return new Blob([fullMidi], { type: 'audio/midi' });
  }

  /**
   * Sketch Studio Synthesis Engine
   * Implements reverse-engineered art mediums from Cymatics Sketch Max:
   * chalk, marker, crayon, neon, watercolor, splatter, pencil, spray
   */
  playSketchNote(medium, freqOrMidi, duration = 0.38, timeOffset = 0, velocity = 0.8, fx = {}, customCtx = null, customDest = null) {
    const ctx = customCtx || this.resumeAudioContext();

    // Lookahead ensures audio parameters are never scheduled in the past
    const now = Math.max(ctx.currentTime + Math.max(customCtx ? 0 : 0.005, timeOffset), 0.002);
    const freq = typeof freqOrMidi === 'number' && freqOrMidi < 128 ? midiToFreq(freqOrMidi) : (freqOrMidi || 440);
    const vel = Math.max(0.2, Math.min(1.2, velocity));
    const dur = Math.max(duration, 0.18);

    const toneVal = fx.tone !== undefined ? fx.tone : 0.7;
    const decayVal = fx.decay !== undefined ? fx.decay : 0.5;
    const effectiveDecay = Math.max(0.18, dur * (0.75 + decayVal * 1.6));

    // Master envelope for note
    const env = ctx.createGain();
    const dest = customDest || this.masterGain;
    env.connect(dest);

    // Filter node for Tone (minimum 850Hz to ensure full clarity & brightness)
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = Math.max(850, 400 + Math.pow(toneVal, 2) * 16000);
    filter.frequency.setValueAtTime(cutoff, now);
    filter.Q.setValueAtTime(1.0, now);
    filter.connect(env);

    try {
      switch (medium) {
        case 'chalk': {
          // Warm Rhodes electric piano / FM tines
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 2, now);

          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.32, now);
          g2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
          osc2.connect(g2);
          g2.connect(filter);
          osc1.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.55 * vel, now + 0.01);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay + 0.06);
          osc2.stop(now + effectiveDecay + 0.06);
          break;
        }

        case 'marker': {
          // Punchy resonant synth keys
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sawtooth';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 1.005, now);

          filter.Q.setValueAtTime(0.9, now);
          filter.frequency.setValueAtTime(cutoff * 1.4, now);
          filter.frequency.exponentialRampToValueAtTime(cutoff * 0.7, now + effectiveDecay * 0.8);

          osc1.connect(filter);
          osc2.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.52 * vel, now + 0.008);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay + 0.06);
          osc2.stop(now + effectiveDecay + 0.06);
          break;
        }

        case 'crayon': {
          // Playful wooden marimba / acoustic mallet
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 3.8, now);

          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.40, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
          osc2.connect(g2);
          g2.connect(filter);
          osc1.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.56 * vel, now + 0.005);
          env.gain.exponentialRampToValueAtTime(0.0008, now + Math.min(effectiveDecay, 0.65));

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay + 0.06);
          osc2.stop(now + effectiveDecay + 0.06);
          break;
        }

        case 'neon': {
          // Glowing analog saw lead (tamed resonance and balanced dual saw)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const g1 = ctx.createGain();
          const g2 = ctx.createGain();
          g1.gain.setValueAtTime(0.45, now);
          g2.gain.setValueAtTime(0.45, now);

          osc1.type = 'sawtooth';
          osc2.type = 'sawtooth';
          osc1.frequency.setValueAtTime(freq * 1.003, now);
          osc2.frequency.setValueAtTime(freq * 0.997, now);

          filter.Q.setValueAtTime(1.0, now);
          filter.frequency.setValueAtTime(cutoff * 0.9, now);
          filter.frequency.exponentialRampToValueAtTime(cutoff * 1.3, now + 0.035);
          filter.frequency.exponentialRampToValueAtTime(cutoff * 0.7, now + effectiveDecay);

          osc1.connect(g1);
          osc2.connect(g2);
          g1.connect(filter);
          g2.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.52 * vel, now + 0.015);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay * 1.2);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay * 1.2 + 0.06);
          osc2.stop(now + effectiveDecay * 1.2 + 0.06);
          break;
        }

        case 'watercolor': {
          // Ambient celestial glass pad
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sine';
          osc2.type = 'triangle';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 0.5, now);

          const subGain = ctx.createGain();
          subGain.gain.setValueAtTime(0.24, now);
          osc2.connect(subGain);
          subGain.connect(filter);
          osc1.connect(filter);

          const attackTime = 0.04;
          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.54 * vel, now + attackTime);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay * 1.5);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay * 1.5 + 0.06);
          osc2.stop(now + effectiveDecay * 1.5 + 0.06);
          break;
        }

        case 'splatter': {
          // Crisp kalimba / chime droplet burst
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 2.76, now);

          const g2 = ctx.createGain();
          g2.gain.setValueAtTime(0.42, now);
          g2.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
          osc2.connect(g2);
          g2.connect(filter);
          osc1.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.55 * vel, now + 0.003);
          env.gain.exponentialRampToValueAtTime(0.0008, now + Math.min(effectiveDecay, 0.45));

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay + 0.06);
          osc2.stop(now + effectiveDecay + 0.06);
          break;
        }

        case 'pencil': {
          // Music box / crystalline bells
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 3, now);

          const bellGain = ctx.createGain();
          bellGain.gain.setValueAtTime(0.30, now);
          bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc2.connect(bellGain);
          bellGain.connect(filter);
          osc1.connect(filter);

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.50 * vel, now + 0.004);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay * 0.95);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + effectiveDecay + 0.06);
          osc2.stop(now + effectiveDecay + 0.06);
          break;
        }

        case 'spray': {
          // Airy shimmer synth with noise burst
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          osc.connect(filter);

          if (this.noiseBuffer) {
            const noise = ctx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            const nFilter = ctx.createBiquadFilter();
            nFilter.type = 'bandpass';
            nFilter.frequency.setValueAtTime(Math.min(cutoff, 3500), now);
            nFilter.Q.setValueAtTime(1.5, now);
            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.20 * vel, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            noise.connect(nFilter);
            nFilter.connect(nGain);
            nGain.connect(filter);
            noise.start(now);
          }

          env.gain.setValueAtTime(0.001, now);
          env.gain.linearRampToValueAtTime(0.48 * vel, now + 0.02);
          env.gain.exponentialRampToValueAtTime(0.0008, now + effectiveDecay);

          osc.start(now);
          osc.stop(now + effectiveDecay + 0.06);
          break;
        }

        default:
          this.playTonalNote('piano', typeof freqOrMidi === 'number' && freqOrMidi < 128 ? freqOrMidi : 60, duration, timeOffset, velocity, customCtx, customDest);
      }
    } catch (synthErr) {
      console.warn('Sketch synth fallback triggered:', synthErr);
      this.playTonalNote('piano', typeof freqOrMidi === 'number' && freqOrMidi < 128 ? freqOrMidi : 60, duration, timeOffset, velocity, customCtx, customDest);
    }
  }

  /**
   * Continuous Glide Voice: Portamento glide across drawn stroke contours
   */
  startGlideVoice(medium, freq, velocity = 0.8, fx = {}) {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (e) {}
    }
    const now = ctx.currentTime + 0.01;
    const toneVal = fx.tone !== undefined ? fx.tone : 0.7;
    const cutoff = 300 + Math.pow(toneVal, 2) * 12500;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(0.45 * velocity, now + 0.025);

    filter.connect(env);
    env.connect(this.masterGain);

    const osc = ctx.createOscillator();
    osc.type = medium === 'neon' ? 'sawtooth' : (medium === 'marker' ? 'triangle' : 'sine');
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(filter);
    osc.start(now);

    return { osc, env, filter, ctx };
  }

  updateGlideVoice(voice, newFreq) {
    if (!voice || !voice.osc) return;
    const now = voice.ctx.currentTime + 0.01;
    voice.osc.frequency.cancelScheduledValues(now);
    voice.osc.frequency.linearRampToValueAtTime(newFreq, now + 0.05);
  }

  stopGlideVoice(voice, release = 0.15) {
    if (!voice || !voice.env) return;
    const now = voice.ctx.currentTime + 0.01;
    voice.env.gain.cancelScheduledValues(now);
    voice.env.gain.setValueAtTime(voice.env.gain.value, now);
    voice.env.gain.exponentialRampToValueAtTime(0.0008, now + release);
    setTimeout(() => {
      try {
        voice.osc.stop();
        voice.osc.disconnect();
      } catch (e) {}
    }, release * 1000 + 60);
  }
}

export const audioEngine = new AudioEngine();
