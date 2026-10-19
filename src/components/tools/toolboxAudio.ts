import { soundEngine } from '../../audio/soundEngine';
import { Pitch } from '../../types/music';

let audioCtx: AudioContext | null = null;

export async function getToolboxAudioContext(): Promise<AudioContext | null> {
  if (!audioCtx) {
    try {
      const winAudio = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (winAudio) {
        audioCtx = new winAudio();
      }
    } catch {
      // AudioContext unavailable
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    try {
      await audioCtx.resume();
    } catch {
      // resume failed or waiting for user interaction
    }
  }
  return audioCtx;
}

// Convert note letter & octave to frequency
export function noteToFreq(step: string, octave: number): number {
  const semitones: Record<string, number> = {
    C: 0, 'C#': 1, Db: 1,
    D: 2, 'D#': 3, Eb: 3,
    E: 4,
    F: 5, 'F#': 6, Gb: 6,
    G: 7, 'G#': 8, Ab: 8,
    A: 9, 'A#': 10, Bb: 10,
    B: 11,
  };
  const semi = semitones[step] ?? 0;
  // A4 = 440Hz, octave 4, A = 9 -> MIDI 69
  const midi = (octave + 1) * 12 + semi;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Play retro arcade laser sound (for Staff Wars)
 */
export async function playLaserSound(startFreq: number = 880): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(Math.max(300, startFreq * 1.5), now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);

  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.2);
}

/**
 * Play retro arcade explosion sound (for Staff Wars hit)
 */
export async function playExplosionSound(): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bufferSize = ctx.sampleRate * 0.25;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(80, now + 0.25);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(now);
  noise.stop(now + 0.26);
}

/**
 * Play shield damage warning sound
 */
export async function playShieldDamageSound(): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.setValueAtTime(110, now + 0.08);
  osc.frequency.setValueAtTime(90, now + 0.16);

  gain.gain.setValueAtTime(0.28, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play cute singing vowel (for Sound Painter faces)
 */
export async function playSingingFace(freq: number, duration: number = 0.6): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);
  // Add warm vibrato
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, now);

  // Formant-like bandpass for vocal "Ahhh" quality
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(Math.min(2200, Math.max(400, freq * 1.8)), now);
  filter.Q.setValueAtTime(3.5, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc2.start(now);
  osc.stop(now + duration + 0.05);
  osc2.stop(now + duration + 0.05);
}

/**
 * Play metallic triangle / chime sound (for Sound Painter polygons)
 */
export async function playMetallicTriangle(freq: number = 1200): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, now);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 1.483, now); // Inharmonic metallic ratio

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.75);
  osc2.stop(now + 0.75);
}

/**
 * Play a line tone with pitch
 */
export async function playLineTone(freq: number, duration: number = 0.35): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

/**
 * Card flip sound
 */
export async function playCardFlipSound(): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(540, now + 0.06);

  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Match success chime
 */
export async function playMatchChime(): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const pitches = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  pitches.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = now + idx * 0.07;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  });
}

/**
 * Gentle wrong buzzer
 */
export async function playWrongBuzzer(): Promise<void> {
  const ctx = await getToolboxAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(140, now);
  osc.frequency.setValueAtTime(110, now + 0.1);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.26);
}

/**
 * Play preview pitch with soundEngine or synth fallback
 */
export function playMusicNote(pitch: Pitch, instrument: string = 'piano', duration: number = 0.6): void {
  try {
    soundEngine.playNotePreview(pitch, instrument as any, duration, 'C');
  } catch {
    const f = noteToFreq(pitch.step, pitch.octave);
    playLineTone(f, duration);
  }
}
