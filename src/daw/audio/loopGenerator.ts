import { DawLoopItem } from '../types';

// In-memory cache for rendered loop AudioBuffers and waveform peaks
const loopBufferCache = new Map<string, { buffer: AudioBuffer; waveform: number[] }>();

/**
 * Extracts a normalized 64-point waveform peak array from an AudioBuffer
 * for beautiful instant waveform rendering on timeline clips.
 */
export function extractWaveformPeaks(buffer: AudioBuffer, numPoints: number = 64): number[] {
  const channelData = buffer.getChannelData(0);
  const step = Math.floor(channelData.length / numPoints);
  const peaks: number[] = [];

  for (let i = 0; i < numPoints; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks.push(Math.min(1.0, Math.max(0.04, max * 1.25)));
  }

  return peaks;
}

/**
 * Procedurally renders realistic, studio-quality loops in an OfflineAudioContext.
 * Generates an AudioBuffer in ~15 milliseconds with zero network latency.
 */
export async function getOrGenerateLoopAudio(
  loop: DawLoopItem,
  audioCtx: BaseAudioContext
): Promise<{ buffer: AudioBuffer; waveform: number[] }> {
  const cached = loopBufferCache.get(loop.id);
  if (cached) return cached;

  // Duration in seconds: (beats / (BPM / 60))
  const beatSec = 60 / loop.bpm;
  const totalDuration = loop.durationBeats * beatSec;
  const sampleRate = audioCtx.sampleRate || 44100;

  // Offline rendering context for lightning fast non-blocking generation
  const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

  // Master compressor on the rendering bus for punchy modern mastering
  const comp = offlineCtx.createDynamicsCompressor();
  comp.threshold.setValueAtTime(-14, 0);
  comp.ratio.setValueAtTime(4.0, 0);
  comp.attack.setValueAtTime(0.003, 0);
  comp.release.setValueAtTime(0.18, 0);
  comp.connect(offlineCtx.destination);

  const mainGain = offlineCtx.createGain();
  mainGain.gain.setValueAtTime(0.85, 0);
  mainGain.connect(comp);

  const id = loop.audioGeneratorId || loop.id;

  // Helper: Synthesize punchy acoustic/trap kick
  const playKick = (t: number, deep808: boolean = false) => {
    const osc = offlineCtx.createOscillator();
    const g = offlineCtx.createGain();
    osc.type = 'sine';
    const startFreq = deep808 ? 140 : 160;
    const endFreq = deep808 ? 36 : 46;
    const decay = deep808 ? 0.75 : 0.28;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.08);

    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(g);
    g.connect(mainGain);
    osc.start(t);
    osc.stop(t + decay + 0.02);
  };

  // Helper: Snare or Clap
  const playSnareOrClap = (t: number, isClap: boolean = false) => {
    // Noise burst
    const bufferSize = offlineCtx.sampleRate * (isClap ? 0.22 : 0.28);
    const noiseBuffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = isClap ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(isClap ? 1400 : 850, t);

    const g = offlineCtx.createGain();
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isClap ? 0.18 : 0.25));

    noise.connect(filter);
    filter.connect(g);
    g.connect(mainGain);
    noise.start(t);

    // Body tone
    if (!isClap) {
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(185, t);
      osc.frequency.exponentialRampToValueAtTime(75, t + 0.1);
      oscGain.gain.setValueAtTime(0.45, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(oscGain);
      oscGain.connect(mainGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  };

  // Helper: Crisp Hi-Hat
  const playHat = (t: number, open: boolean = false) => {
    const dur = open ? 0.35 : 0.055;
    const noiseBuffer = offlineCtx.createBuffer(1, Math.ceil(offlineCtx.sampleRate * dur), offlineCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7200, t);

    const g = offlineCtx.createGain();
    g.gain.setValueAtTime(open ? 0.45 : 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(mainGain);
    noise.start(t);
  };

  // Helper: Harmonic note synth for bass/keys/melody
  const playTone = (
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol: number = 0.5,
    filterCutoff: number = 3000
  ) => {
    const osc = offlineCtx.createOscillator();
    const g = offlineCtx.createGain();
    const f = offlineCtx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);

    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterCutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(300, filterCutoff * 0.4), t + dur);

    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol * 0.85, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);

    osc.connect(f);
    f.connect(g);
    g.connect(mainGain);
    osc.start(t);
    osc.stop(t + dur + 0.08);
  };

  // ==========================================
  // DISPATCH LOOP SYNTHESIS PATTERNS
  // ==========================================
  if (id === 'hiphop_boom_bap_drums' || id === 'rock_stadium_kit' || id === 'funk_breakbeat_drums') {
    // 2-bar drum patterns across 8 beats
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      // Kick on 0, 2.5, 4, 6.5
      if (b === 0 || b === 4) playKick(t);
      if (b === 2.5 || b === 6.5) playKick(t + 0.5 * beatSec);

      // Snare on 2 and 6
      if (b === 2 || b === 6) playSnareOrClap(t);

      // 8th-note Hi-Hats
      playHat(t);
      playHat(t + 0.5 * beatSec, b === 3 || b === 7);
    }
  } else if (id === 'hiphop_trap_808_beat') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b === 0 || b === 3 || b === 4.5) playKick(t, true);
      if (b === 2 || b === 6) playSnareOrClap(t, true); // Trap clap
      // Trap rolling hi-hats (triplets on beat 7)
      if (b === 7) {
        for (let k = 0; k < 6; k++) playHat(t + (k / 6) * beatSec);
      } else {
        playHat(t);
        playHat(t + 0.5 * beatSec);
      }
    }
  } else if (id === 'pop_disco_dance_beat') {
    // 4-on-the-floor
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      playKick(t);
      if (b % 2 === 1) playSnareOrClap(t, true);
      playHat(t + 0.5 * beatSec, true); // Open hat on off-beat
    }
  } else if (id === 'lofi_dusty_beat') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b === 0 || b === 3.5 || b === 5) playKick(t);
      if (b === 2 || b === 6) playSnareOrClap(t);
      playHat(t + (b % 2 === 1 ? 0.02 : 0)); // Unquantized swing
    }
  } else if (id === 'hiphop_808_sub_bass') {
    // Deep 808 sub notes in Fm: F1 (43.65), Ab1 (51.91), Bb1 (58.27), C2 (65.41)
    const notes = [
      { f: 43.65, b: 0, d: 2.8 },
      { f: 51.91, b: 3, d: 1.2 },
      { f: 58.27, b: 4.5, d: 1.5 },
      { f: 43.65, b: 6, d: 1.8 },
    ];
    notes.forEach((n) => playTone(n.f, n.b * beatSec, n.d * beatSec, 'sine', 0.95, 600));
  } else if (id === 'pop_slap_bass_groove' || id === 'rock_driving_pick_bass') {
    // Funky bassline: A1, C2, D2, E2
    const notes = [
      { f: 55.0, b: 0, d: 0.7 },
      { f: 55.0, b: 0.75, d: 0.7 },
      { f: 65.41, b: 2, d: 0.8 },
      { f: 73.42, b: 3.5, d: 0.8 },
      { f: 82.41, b: 4, d: 0.7 },
      { f: 55.0, b: 6, d: 1.5 },
    ];
    notes.forEach((n) => playTone(n.f, n.b * beatSec, n.d * beatSec, 'triangle', 0.8, 1800));
  } else if (id === 'lofi_upright_acoustic_bass') {
    // Warm jazz walking bass: D2 (73.42), F2 (87.31), G2 (98.0), A2 (110.0)
    const walking = [73.42, 87.31, 98.0, 110.0, 98.0, 87.31, 73.42, 65.41];
    walking.forEach((f, idx) => playTone(f, idx * beatSec, 0.85 * beatSec, 'triangle', 0.85, 750));
  } else if (id === 'lofi_warm_rhodes' || id === 'hiphop_dark_grand_piano') {
    // Lush jazz/chill chords: Dm7 -> Gm7 -> C7 -> Fmaj7
    const chords = [
      { notes: [146.83, 174.61, 220.0, 261.63], b: 0, d: 1.8 }, // Dm7
      { notes: [196.0, 233.08, 293.66, 349.23], b: 2, d: 1.8 }, // Gm7
      { notes: [130.81, 164.81, 196.0, 233.08], b: 4, d: 1.8 }, // C7
      { notes: [174.61, 220.0, 261.63, 329.63], b: 6, d: 1.8 }, // Fmaj7
    ];
    chords.forEach((c) => {
      c.notes.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'sine', 0.38, 2400));
    });
  } else if (id === 'pop_bright_electric_piano' || id === 'pop_acoustic_guitar_strum') {
    // Upbeat chords: C -> G -> Am -> F
    const progression = [
      { notes: [261.63, 329.63, 392.0], b: 0, d: 1.8 },
      { notes: [196.0, 246.94, 293.66], b: 2, d: 1.8 },
      { notes: [220.0, 261.63, 329.63], b: 4, d: 1.8 },
      { notes: [174.61, 220.0, 261.63], b: 6, d: 1.8 },
    ];
    progression.forEach((c) => {
      c.notes.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'triangle', 0.42, 3800));
    });
  } else if (id === 'rock_electric_power_riff') {
    // Power chords: E5 (164.81, 246.94), G5 (196.0, 293.66), A5 (220.0, 329.63)
    const power = [
      { f: [164.81, 246.94], b: 0, d: 1.5 },
      { f: [196.0, 293.66], b: 2, d: 1.5 },
      { f: [220.0, 329.63], b: 4, d: 1.5 },
      { f: [164.81, 246.94], b: 6, d: 1.8 },
    ];
    power.forEach((p) => {
      p.f.forEach((freq) => playTone(freq, p.b * beatSec, p.d * beatSec, 'sawtooth', 0.35, 2800));
    });
  } else if (id === 'cinematic_taiko_impact') {
    // Thunderous taiko hits on 0, 2, 4, 6
    for (let b = 0; b < 8; b += 2) {
      playKick(b * beatSec, true);
    }
  } else {
    // Default melodic pattern (kalimba, flute, pop synth hook)
    const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25];
    melody.forEach((f, idx) => playTone(f, idx * beatSec, 0.75 * beatSec, 'triangle', 0.5, 4500));
  }

  // Render the audio buffer
  const renderedBuffer = await offlineCtx.startRendering();
  const peaks = extractWaveformPeaks(renderedBuffer, 64);
  const result = { buffer: renderedBuffer, waveform: peaks };

  loopBufferCache.set(loop.id, result);
  return result;
}

/**
 * Decodes a user-imported audio file (WAV, MP3, etc.) into an AudioBuffer with waveform peaks.
 */
export async function decodeUploadedAudio(
  file: File,
  audioCtx: BaseAudioContext
): Promise<{ buffer: AudioBuffer; waveform: number[]; durationBeats: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const waveform = extractWaveformPeaks(audioBuffer, 64);
  // Estimate duration in beats assuming standard 120 BPM
  const durationBeats = Math.max(1, Math.round((audioBuffer.duration / 0.5) * 2) / 2);
  return { buffer: audioBuffer, waveform, durationBeats };
}
