import { soundEngine } from '../../audio/soundEngine';
import { Pitch } from '../../types/music';
import { getToolboxAudioContext } from '../../audio/sharedContext';

export { getToolboxAudioContext };

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
