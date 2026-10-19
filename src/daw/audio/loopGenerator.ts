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
 * Synthesizes punchy acoustic & modern drum transients, warm Rhodes/EP tones,
 * and harmonically rich instruments, automatically matching target project BPM.
 */
export async function getOrGenerateLoopAudio(
  loop: DawLoopItem,
  audioCtx: BaseAudioContext,
  targetBpm?: number
): Promise<{ buffer: AudioBuffer; waveform: number[] }> {
  const effectiveBpm = targetBpm && targetBpm > 0 ? targetBpm : loop.bpm;
  const cacheKey = `${loop.id}_${effectiveBpm}`;
  const cached = loopBufferCache.get(cacheKey);
  if (cached) return cached;

  // Duration in seconds: (beats / (BPM / 60))
  const beatSec = 60 / effectiveBpm;
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

  // Helper: Synthesize punchy acoustic/trap kick with transient beater click & deep low-end thump
  const playKick = (t: number, deep808: boolean = false) => {
    // 1. Low frequency thump
    const osc = offlineCtx.createOscillator();
    const g = offlineCtx.createGain();
    osc.type = 'sine';
    const startFreq = deep808 ? 140 : 180;
    const endFreq = deep808 ? 36 : 44;
    const decay = deep808 ? 0.75 : 0.28;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.07);

    g.gain.setValueAtTime(0.95, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(g);
    g.connect(mainGain);
    osc.start(t);
    osc.stop(t + decay + 0.02);

    // 2. Beater transient click (top-end attack punch)
    if (!deep808) {
      const clickOsc = offlineCtx.createOscillator();
      const clickGain = offlineCtx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(450, t);
      clickOsc.frequency.exponentialRampToValueAtTime(80, t + 0.015);
      clickGain.gain.setValueAtTime(0.4, t);
      clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

      clickOsc.connect(clickGain);
      clickGain.connect(mainGain);
      clickOsc.start(t);
      clickOsc.stop(t + 0.025);
    }
  };

  // Helper: Snare or Clap with realistic snare-wire rattle & dual-resonance
  const playSnareOrClap = (t: number, isClap: boolean = false) => {
    // Noise burst for snare wires / hand claps
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
    filter.frequency.setValueAtTime(isClap ? 1400 : 1200, t);

    const g = offlineCtx.createGain();
    g.gain.setValueAtTime(0.85, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isClap ? 0.18 : 0.24));

    noise.connect(filter);
    filter.connect(g);
    g.connect(mainGain);
    noise.start(t);

    // Body drum tone
    if (!isClap) {
      const osc = offlineCtx.createOscillator();
      const oscGain = offlineCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(210, t);
      osc.frequency.exponentialRampToValueAtTime(85, t + 0.1);
      oscGain.gain.setValueAtTime(0.5, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(oscGain);
      oscGain.connect(mainGain);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  };

  // Helper: Crisp metallic Hi-Hat modeled with inharmonic acoustic cymbal frequencies
  const playHat = (t: number, open: boolean = false) => {
    const dur = open ? 0.35 : 0.055;
    const noiseBuffer = offlineCtx.createBuffer(1, Math.ceil(offlineCtx.sampleRate * dur), offlineCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = offlineCtx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = offlineCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, t);

    // Add metallic ring oscillator
    const bellOsc = offlineCtx.createOscillator();
    const bellGain = offlineCtx.createGain();
    bellOsc.type = 'square';
    bellOsc.frequency.setValueAtTime(3200, t);
    bellGain.gain.setValueAtTime(0.06, t);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.12 : 0.03));
    bellOsc.connect(bellGain);
    bellGain.connect(mainGain);
    bellOsc.start(t);
    bellOsc.stop(t + dur);

    const g = offlineCtx.createGain();
    g.gain.setValueAtTime(open ? 0.45 : 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);

    noise.connect(filter);
    filter.connect(g);
    g.connect(mainGain);
    noise.start(t);
  };

  // Helper: Multi-harmonic acoustic tone synth for bass/keys/melody/plucks
  const playTone = (
    freq: number,
    t: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol: number = 0.5,
    filterCutoff: number = 3000
  ) => {
    // Primary oscillator
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

    // Subtle 2nd harmonic warmth for acoustic depth
    if (type === 'sine' || type === 'triangle') {
      const harmOsc = offlineCtx.createOscillator();
      const harmGain = offlineCtx.createGain();
      harmOsc.type = 'sine';
      harmOsc.frequency.setValueAtTime(freq * 2, t);
      harmGain.gain.setValueAtTime(vol * 0.22, t);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.6);
      harmOsc.connect(harmGain);
      harmGain.connect(mainGain);
      harmOsc.start(t);
      harmOsc.stop(t + dur);
    }
  };

  // ==========================================
  // DISPATCH LOOP SYNTHESIS PATTERNS
  // ==========================================
  if (
    id === 'hiphop_boom_bap_drums' ||
    id === 'rock_stadium_kit' ||
    id === 'funk_breakbeat_drums' ||
    id === 'motown_pocket_drums'
  ) {
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
      if (b === 7) {
        for (let k = 0; k < 6; k++) playHat(t + (k / 6) * beatSec);
      } else {
        playHat(t);
        playHat(t + 0.5 * beatSec);
      }
    }
  } else if (id === 'hiphop_drill_slide_beat') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b === 0 || b === 3.5 || b === 6) playKick(t, true);
      if (b === 2.5 || b === 6.5) playSnareOrClap(t, true);
      for (let k = 0; k < 3; k++) playHat(t + (k / 3) * beatSec);
    }
  } else if (id === 'pop_disco_dance_beat' || id === 'edm_festival_kick_build') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      playKick(t);
      if (b % 2 === 1) playSnareOrClap(t, true);
      playHat(t + 0.5 * beatSec, true);
    }
  } else if (id === 'pop_claps_shaker_groove' || id === 'lofi_tape_shaker_groove') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      playSnareOrClap(t, true);
      for (let s = 0; s < 4; s++) playHat(t + (s / 4) * beatSec);
    }
  } else if (id === 'punk_crash_beat') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      playKick(t);
      playKick(t + 0.5 * beatSec);
      if (b % 2 === 1) playSnareOrClap(t);
      playHat(t, true);
    }
  } else if (id === 'latin_afrobeat_shakers' || id === 'latin_conga_bongo_groove') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b % 2 === 0) playKick(t);
      if (b === 3 || b === 7) playSnareOrClap(t, true);
      playHat(t + 0.25 * beatSec);
      playHat(t + 0.75 * beatSec);
    }
  } else if (id === 'reggae_one_drop_drums') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b === 2 || b === 6) {
        playKick(t);
        playSnareOrClap(t);
      }
      playHat(t);
      playHat(t + 0.5 * beatSec);
    }
  } else if (id === 'lofi_dusty_beat') {
    for (let b = 0; b < 8; b++) {
      const t = b * beatSec;
      if (b === 0 || b === 3.5 || b === 5) playKick(t);
      if (b === 2 || b === 6) playSnareOrClap(t);
      playHat(t + (b % 2 === 1 ? 0.02 : 0));
    }
  } else if (id === 'hiphop_808_sub_bass' || id === 'lofi_sub_chill_808') {
    const notes = [
      { f: 43.65, b: 0, d: 2.8 },
      { f: 51.91, b: 3, d: 1.2 },
      { f: 58.27, b: 4.5, d: 1.5 },
      { f: 43.65, b: 6, d: 1.8 },
    ];
    notes.forEach((n) => playTone(n.f, n.b * beatSec, n.d * beatSec, 'sine', 0.95, 600));
  } else if (id === 'hiphop_drill_glide_bass') {
    const notes = [
      { f: 41.2, b: 0, d: 2.2 },
      { f: 55.0, b: 2.5, d: 1.0 },
      { f: 49.0, b: 4, d: 1.8 },
      { f: 61.74, b: 6, d: 1.5 },
    ];
    notes.forEach((n) => playTone(n.f, n.b * beatSec, n.d * beatSec, 'triangle', 0.9, 1200));
  } else if (id === 'synthwave_neon_bass') {
    for (let b = 0; b < 8; b++) {
      for (let s = 0; s < 4; s++) {
        const root = b < 4 ? 55.0 : 43.65;
        playTone(root, (b + s / 4) * beatSec, 0.2 * beatSec, 'sawtooth', 0.65, 1400);
      }
    }
  } else if (id === 'pop_slap_bass_groove' || id === 'rock_driving_pick_bass') {
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
    const walking = [73.42, 87.31, 98.0, 110.0, 98.0, 87.31, 73.42, 65.41];
    walking.forEach((f, idx) => playTone(f, idx * beatSec, 0.85 * beatSec, 'triangle', 0.85, 750));
  } else if (id === 'lofi_warm_rhodes' || id === 'hiphop_dark_grand_piano' || id === 'hiphop_soul_chops') {
    const chords = [
      { notes: [146.83, 174.61, 220.0, 261.63], b: 0, d: 1.8 },
      { notes: [196.0, 233.08, 293.66, 349.23], b: 2, d: 1.8 },
      { notes: [130.81, 164.81, 196.0, 233.08], b: 4, d: 1.8 },
      { notes: [174.61, 220.0, 261.63, 329.63], b: 6, d: 1.8 },
    ];
    chords.forEach((c) => {
      c.notes.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'sine', 0.38, 2400));
    });
  } else if (id === 'pop_bright_electric_piano' || id === 'pop_acoustic_guitar_strum' || id === 'bossa_nova_nylon') {
    const progression = [
      { notes: [261.63, 329.63, 392.0], b: 0, d: 1.8 },
      { notes: [196.0, 246.94, 293.66], b: 2, d: 1.8 },
      { notes: [220.0, 261.63, 329.63], b: 4, d: 1.8 },
      { notes: [174.61, 220.0, 261.63], b: 6, d: 1.8 },
    ];
    progression.forEach((c) => {
      c.notes.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'triangle', 0.42, 3800));
    });
  } else if (id === 'future_bass_super_saws' || id === 'trance_euro_gate') {
    const saws = [
      { notes: [220.0, 277.18, 329.63, 440.0], b: 0, d: 1.8 },
      { notes: [174.61, 220.0, 261.63, 349.23], b: 2, d: 1.8 },
      { notes: [196.0, 246.94, 293.66, 392.0], b: 4, d: 1.8 },
      { notes: [220.0, 277.18, 329.63, 440.0], b: 6, d: 1.8 },
    ];
    saws.forEach((c) => {
      c.notes.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'sawtooth', 0.28, 4800));
    });
  } else if (id === 'rock_electric_power_riff') {
    const power = [
      { f: [164.81, 246.94], b: 0, d: 1.5 },
      { f: [196.0, 293.66], b: 2, d: 1.5 },
      { f: [220.0, 329.63], b: 4, d: 1.5 },
      { f: [164.81, 246.94], b: 6, d: 1.8 },
    ];
    power.forEach((p) => {
      p.f.forEach((freq) => playTone(freq, p.b * beatSec, p.d * beatSec, 'sawtooth', 0.35, 2800));
    });
  } else if (id === 'funk_clavinet_chops' || id === 'funk_wah_guitar' || id === 'reggae_skank_guitar') {
    const stabs = [
      { f: [261.63, 329.63, 392.0], b: 0.5 },
      { f: [261.63, 329.63, 392.0], b: 1.5 },
      { f: [293.66, 349.23, 440.0], b: 2.5 },
      { f: [261.63, 329.63, 392.0], b: 4.5 },
      { f: [261.63, 329.63, 392.0], b: 5.5 },
      { f: [329.63, 392.0, 493.88], b: 6.5 },
    ];
    stabs.forEach((s) => {
      s.f.forEach((freq) => playTone(freq, s.b * beatSec, 0.35 * beatSec, 'triangle', 0.45, 3200));
    });
  } else if (id === 'salsa_montuno_piano') {
    const montuno = [
      { f: 440.0, b: 0.5 }, { f: 523.25, b: 1.0 }, { f: 659.25, b: 1.5 },
      { f: 440.0, b: 2.5 }, { f: 523.25, b: 3.0 }, { f: 587.33, b: 3.5 },
      { f: 392.0, b: 4.5 }, { f: 493.88, b: 5.0 }, { f: 587.33, b: 5.5 },
      { f: 392.0, b: 6.5 }, { f: 493.88, b: 7.0 }, { f: 659.25, b: 7.5 },
    ];
    montuno.forEach((m) => playTone(m.f, m.b * beatSec, 0.4 * beatSec, 'sine', 0.45, 3500));
  } else if (id === 'cinematic_taiko_impact') {
    for (let b = 0; b < 8; b += 2) playKick(b * beatSec, true);
  } else if (id === 'cyberpunk_arpeggio' || id === 'acid_303_res_line') {
    const scale = [293.66, 349.23, 440.0, 523.25, 587.33, 440.0, 349.23, 293.66];
    for (let b = 0; b < 8; b++) {
      for (let s = 0; s < 2; s++) {
        const noteIdx = (b * 2 + s) % scale.length;
        playTone(scale[noteIdx], (b + s * 0.5) * beatSec, 0.4 * beatSec, 'sawtooth', 0.35, 2600);
      }
    }
  } else if (id === 'cinematic_spiccato_strings') {
    const ostinato = [293.66, 293.66, 349.23, 349.23, 440.0, 440.0, 349.23, 329.63];
    for (let b = 0; b < 8; b++) {
      for (let s = 0; s < 4; s++) {
        const freq = ostinato[b % ostinato.length];
        playTone(freq, (b + s * 0.25) * beatSec, 0.18 * beatSec, 'sawtooth', 0.28, 2800);
      }
    }
  } else if (id === 'cinematic_brass_horns' || id === 'cinematic_choir_pad') {
    const chords = [
      { f: [116.54, 174.61, 233.08, 293.66], b: 0, d: 3.5 },
      { f: [130.81, 196.0, 261.63, 329.63], b: 4, d: 3.5 },
    ];
    chords.forEach((c) => {
      c.f.forEach((freq) => playTone(freq, c.b * beatSec, c.d * beatSec, 'sawtooth', 0.25, 2200));
    });
  } else if (id === 'cinematic_sub_drop_fx') {
    playKick(0, true);
    playKick(4 * beatSec, true);
  } else {
    // Melodic lead / kalimba / bells / plucks default
    const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25];
    melody.forEach((f, idx) => playTone(f, idx * beatSec, 0.75 * beatSec, 'triangle', 0.5, 4500));
  }

  // Render the audio buffer
  const renderedBuffer = await offlineCtx.startRendering();
  const peaks = extractWaveformPeaks(renderedBuffer, 64);
  const result = { buffer: renderedBuffer, waveform: peaks };

  loopBufferCache.set(cacheKey, result);
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
