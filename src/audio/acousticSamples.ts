import { InstrumentId, Pitch, Score } from '../types/music';

const SOUNDFONT_CDN_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite';

/**
 * Maps Staff Composer InstrumentIds to MusyngKite General MIDI SoundFont instrument names.
 * Unpitched percussion and custom SFX use dedicated procedural/physical synthesis.
 */
export const SOUNDFONT_INSTRUMENT_MAP: Partial<Record<InstrumentId, string>> = {
  // Keyboards
  piano_treble: 'acoustic_grand_piano',
  piano_bass: 'acoustic_grand_piano',
  electric_piano: 'electric_piano_1',
  harpsichord: 'harpsichord',
  clavinet: 'clavinet',
  celesta: 'celesta',
  music_box: 'music_box',
  organ: 'church_organ',
  jazz_organ: 'drawbar_organ',

  // Woodwinds
  flute: 'flute',
  piccolo: 'piccolo',
  recorder: 'recorder',
  pan_flute: 'pan_flute',
  oboe: 'oboe',
  english_horn: 'english_horn',
  clarinet: 'clarinet',
  bass_clarinet: 'clarinet',
  bassoon: 'bassoon',
  contrabassoon: 'bassoon',
  soprano_sax: 'soprano_sax',
  alto_sax: 'alto_sax',
  tenor_sax: 'tenor_sax',
  baritone_sax: 'baritone_sax',

  // Brass
  trumpet: 'trumpet',
  cornet: 'trumpet',
  flugelhorn: 'trumpet',
  muted_trumpet: 'muted_trumpet',
  french_horn: 'french_horn',
  trombone: 'trombone',
  bass_trombone: 'trombone',
  euphonium: 'tuba',
  tuba: 'tuba',
  brass_section: 'brass_section',

  // Strings
  violin: 'violin',
  viola: 'viola',
  cello: 'cello',
  double_bass: 'contrabass',
  string_ensemble: 'string_ensemble_1',
  pizzicato_strings: 'pizzicato_strings',
  tremolo_strings: 'tremolo_strings',
  harp: 'orchestral_harp',

  // Popular, Band, Vocals & World
  acoustic_guitar: 'acoustic_guitar_nylon',
  steel_guitar: 'acoustic_guitar_steel',
  electric_guitar: 'electric_guitar_clean',
  overdrive_guitar: 'overdriven_guitar',
  ukulele: 'acoustic_guitar_nylon',
  banjo: 'banjo',
  sitar: 'sitar',
  koto: 'koto',
  kalimba: 'kalimba',
  bagpipes: 'bagpipe',
  harmonica: 'harmonica',
  accordion: 'accordion',
  electric_bass: 'electric_bass_finger',
  slap_bass: 'slap_bass_1',
  synth_bass: 'synth_bass_1',
  synth_lead: 'lead_2_sawtooth',
  synth_pad: 'pad_2_warm',
  choir_aahs: 'choir_aahs',
  voice_oohs: 'voice_oohs',

  // Pitched Percussion
  glockenspiel: 'glockenspiel',
  xylophone: 'xylophone',
  marimba: 'marimba',
  vibraphone: 'vibraphone',
  steel_drums: 'steel_drums',
  timpani: 'timpani',
  taiko_drum: 'taiko_drum',
  tubular_bells: 'tubular_bells',
};

const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Anchor MIDI notes spaced every 3 semitones (minor 3rds: C, Eb, Gb, A) across octaves 2 to 6.
 * Pitch-shifting at most +/- 1.5 semitones preserves natural acoustic formants while keeping
 * memory and bandwidth tiny.
 */
const ANCHOR_MIDI_NOTES = [
  36, 39, 42, 45, // Octave 2
  48, 51, 54, 57, // Octave 3
  60, 63, 66, 69, // Octave 4
  72, 75, 78, 81, // Octave 5
  84, 87, 90, 93, // Octave 6
];

export function midiToSoundfontNoteName(midi: number): string {
  const clamped = Math.max(21, Math.min(108, Math.round(midi)));
  const noteName = NOTE_NAMES_FLAT[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${noteName}${octave}`;
}

export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(Math.max(20, freq) / 440));
}

export function getNearestAnchorMidi(midi: number): number {
  let best = ANCHOR_MIDI_NOTES[0];
  let bestDist = Math.abs(midi - best);
  for (let i = 1; i < ANCHOR_MIDI_NOTES.length; i++) {
    const d = Math.abs(midi - ANCHOR_MIDI_NOTES[i]);
    if (d < bestDist) {
      bestDist = d;
      best = ANCHOR_MIDI_NOTES[i];
    }
  }
  return best;
}

// Cache of decoded AudioBuffers keyed by `${sfInstrumentName}:${anchorMidi}`
const sampleBufferCache = new Map<string, AudioBuffer>();
const pendingFetchCache = new Map<string, Promise<AudioBuffer | null>>();

/**
 * Fetches and decodes a single anchor note MP3 from the MusyngKite SoundFont CDN.
 */
export async function loadSampleAnchor(
  ctx: BaseAudioContext,
  sfName: string,
  anchorMidi: number
): Promise<AudioBuffer | null> {
  const key = `${sfName}:${anchorMidi}`;
  const existing = sampleBufferCache.get(key);
  if (existing) return existing;

  const pending = pendingFetchCache.get(key);
  if (pending) return pending;

  const noteName = midiToSoundfontNoteName(anchorMidi);
  const url = `${SOUNDFONT_CDN_BASE}/${sfName}-mp3/${noteName}.mp3`;

  const promise = (async () => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      sampleBufferCache.set(key, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    } finally {
      pendingFetchCache.delete(key);
    }
  })();

  pendingFetchCache.set(key, promise);
  return promise;
}

/**
 * Looks up a cached acoustic sample buffer for an instrument + frequency.
 * If not yet cached, triggers a non-blocking background fetch for the nearest anchor note
 * and returns null so the engine can seamlessly play the Fourier/physical model immediately.
 */
export function getAcousticSampleForFreq(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId,
  freq: number
): { buffer: AudioBuffer; playbackRate: number } | null {
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return null;

  const targetMidi = 69 + 12 * Math.log2(Math.max(20, freq) / 440);
  const anchorMidi = getNearestAnchorMidi(Math.round(targetMidi));
  const key = `${sfName}:${anchorMidi}`;
  const cached = sampleBufferCache.get(key);

  if (cached) {
    const semitoneDiff = targetMidi - anchorMidi;
    const playbackRate = Math.pow(2, semitoneDiff / 12);
    return { buffer: cached, playbackRate };
  }

  // Trigger background load of this anchor + adjacent anchors
  void loadSampleAnchor(ctx, sfName, anchorMidi);
  return null;
}

/**
 * Checks synchronously whether the acoustic sample anchor for this frequency is already cached.
 */
export function isAcousticSampleLoaded(
  instrumentId: InstrumentId,
  freq: number
): boolean {
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return false;
  const targetMidi = 69 + 12 * Math.log2(Math.max(20, freq) / 440);
  const anchorMidi = getNearestAnchorMidi(Math.round(targetMidi));
  return sampleBufferCache.has(`${sfName}:${anchorMidi}`);
}

/**
 * Preloads the exact anchor samples needed for a list of Pitches on an instrument.
 */
export async function preloadPitches(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId,
  pitches: Pitch[]
): Promise<void> {
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName || pitches.length === 0) return;

  const semitoneMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const neededAnchors = new Set<number>();

  for (const p of pitches) {
    let midi = (p.octave + 1) * 12 + (semitoneMap[p.step] || 0);
    if (p.accidental === 'sharp') midi += 1;
    if (p.accidental === 'flat') midi -= 1;
    neededAnchors.add(getNearestAnchorMidi(midi));
  }

  await Promise.allSettled(
    Array.from(neededAnchors).map((anchor) => loadSampleAnchor(ctx, sfName, anchor))
  );
}

/**
 * Preloads register-aware anchor samples for a specific instrument so notes
 * across its natural playing range play with real acoustic samples immediately.
 */
export async function preloadInstrumentSamples(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId
): Promise<void> {
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return;

  const lowInstruments: InstrumentId[] = [
    'tuba',
    'cello',
    'double_bass',
    'contrabassoon',
    'bassoon',
    'electric_bass',
    'synth_bass',
    'timpani',
    'piano_bass',
  ];

  const highInstruments: InstrumentId[] = [
    'piccolo',
    'glockenspiel',
    'xylophone',
  ];

  let priorityAnchors: number[];
  if (lowInstruments.includes(instrumentId)) {
    priorityAnchors = [36, 39, 42, 45, 48, 51, 54, 57, 60];
  } else if (highInstruments.includes(instrumentId)) {
    priorityAnchors = [66, 69, 72, 75, 78, 81, 84, 87, 90];
  } else {
    priorityAnchors = [48, 54, 60, 63, 66, 69, 72, 75, 78];
  }

  await Promise.allSettled(priorityAnchors.map((midi) => loadSampleAnchor(ctx, sfName, midi)));
}

/**
 * Preloads all acoustic samples required for the active tracks of a Score.
 */
export async function preloadScoreSamples(ctx: BaseAudioContext, score: Score): Promise<void> {
  const uniqueInstruments = new Set<InstrumentId>();
  score.tracks.forEach((t) => {
    if (!t.muted) uniqueInstruments.add(t.instrumentId);
  });
  await Promise.allSettled(
    Array.from(uniqueInstruments).map((instId) => preloadInstrumentSamples(ctx, instId))
  );
}

// ============================================================================
// OPTION 3: FOURIER PERIODIC WAVE HARMONIC TABLES & CONCERT HALL REVERB
// ============================================================================

export type HarmonicTimbreFamily =
  | 'piano'
  | 'epiano'
  | 'harpsichord'
  | 'clavinet'
  | 'organ_church'
  | 'organ_jazz'
  | 'flute'
  | 'oboe_reed'
  | 'clarinet'
  | 'saxophone'
  | 'brass_bright'
  | 'brass_warm'
  | 'strings_bowed'
  | 'plucked_folk'
  | 'sitar_drone'
  | 'overdrive_rock'
  | 'choir_voice';

const HARMONIC_SPECTRA: Record<HarmonicTimbreFamily, number[]> = {
  // Partial amplitudes [H1, H2, H3, H4, H5, H6, H7, H8, H9, H10, H11, H12]
  piano: [1.0, 0.42, 0.24, 0.14, 0.09, 0.06, 0.03, 0.02, 0.01],
  epiano: [1.0, 0.18, 0.06, 0.02, 0.01, 0.04, 0.01],
  harpsichord: [0.7, 1.0, 0.85, 0.65, 0.5, 0.4, 0.32, 0.25, 0.18, 0.12],
  clavinet: [0.6, 0.9, 1.0, 0.8, 0.7, 0.55, 0.45, 0.35, 0.28, 0.2],
  organ_church: [1.0, 0.85, 0.6, 0.75, 0.3, 0.5, 0.15, 0.45, 0.1, 0.2],
  organ_jazz: [1.0, 0.9, 0.75, 0.55, 0.0, 0.35, 0.0, 0.25],
  flute: [1.0, 0.28, 0.09, 0.03, 0.01],
  oboe_reed: [0.45, 0.95, 1.0, 0.82, 0.65, 0.48, 0.35, 0.24, 0.16, 0.1],
  clarinet: [1.0, 0.06, 0.78, 0.05, 0.52, 0.04, 0.32, 0.02, 0.18, 0.01, 0.09],
  saxophone: [1.0, 0.78, 0.62, 0.48, 0.36, 0.25, 0.18, 0.12, 0.08],
  brass_bright: [0.75, 1.0, 0.92, 0.78, 0.64, 0.5, 0.38, 0.28, 0.2, 0.14, 0.09],
  brass_warm: [1.0, 0.88, 0.65, 0.45, 0.28, 0.16, 0.09, 0.04],
  strings_bowed: [1.0, 0.82, 0.66, 0.52, 0.42, 0.33, 0.26, 0.2, 0.15, 0.11, 0.08],
  plucked_folk: [1.0, 0.68, 0.48, 0.32, 0.22, 0.15, 0.1, 0.06, 0.04],
  sitar_drone: [0.8, 1.0, 0.9, 0.75, 0.68, 0.58, 0.5, 0.42, 0.35, 0.28, 0.22, 0.18],
  overdrive_rock: [1.0, 0.85, 0.95, 0.7, 0.8, 0.55, 0.65, 0.4, 0.5, 0.3, 0.35, 0.2],
  choir_voice: [1.0, 0.72, 0.48, 0.32, 0.22, 0.14, 0.08, 0.04],
};

const periodicWaveCache = new WeakMap<BaseAudioContext, Map<HarmonicTimbreFamily, PeriodicWave>>();

/**
 * Returns a cached Fourier PeriodicWave for the given AudioContext and timbre family.
 */
export function getHarmonicPeriodicWave(
  ctx: BaseAudioContext,
  family: HarmonicTimbreFamily
): PeriodicWave {
  let ctxMap = periodicWaveCache.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map();
    periodicWaveCache.set(ctx, ctxMap);
  }
  const existing = ctxMap.get(family);
  if (existing) return existing;

  const harmonics = HARMONIC_SPECTRA[family];
  const length = harmonics.length + 1;
  const real = new Float32Array(length);
  const imag = new Float32Array(length);
  real[0] = 0;
  imag[0] = 0;
  for (let i = 0; i < harmonics.length; i++) {
    // Alternate cosine/sine phase slightly to avoid harsh peak crest factors
    const phase = (i * 0.37) % (Math.PI * 2);
    real[i + 1] = harmonics[i] * Math.sin(phase);
    imag[i + 1] = harmonics[i] * Math.cos(phase);
  }

  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  ctxMap.set(family, wave);
  return wave;
}

/**
 * Synthesizes a realistic Stereo Concert Hall Impulse Response buffer with early reflections
 * and smooth exponential tail for ConvolverNode acoustic space.
 */
export function createConcertHallImpulse(
  ctx: BaseAudioContext,
  durationSeconds: number = 1.85,
  decayRate: number = 3.2
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  // Early reflections (first 65ms) simulating wooden stage walls
  const earlyTapsMs = [11, 19, 27, 36, 44, 53, 62];
  const earlyGains = [0.42, 0.35, 0.31, 0.26, 0.22, 0.19, 0.16];
  earlyTapsMs.forEach((ms, idx) => {
    const sampleIdxL = Math.floor((ms / 1000) * sampleRate);
    const sampleIdxR = Math.floor(((ms + (idx % 2 === 0 ? 2.3 : -1.8)) / 1000) * sampleRate);
    if (sampleIdxL < length) left[sampleIdxL] += earlyGains[idx] * (idx % 2 === 0 ? 1 : -1);
    if (sampleIdxR > 0 && sampleIdxR < length) right[sampleIdxR] += earlyGains[idx] * (idx % 2 === 0 ? -1 : 1);
  });

  // Diffuse stereo hall reverberation tail with warm lowpass damping
  let prevL = 0;
  let prevR = 0;
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const preDelayEnv = Math.min(1, t / 0.018);
    const decayEnv = Math.exp(-t * decayRate) * preDelayEnv;
    const rawL = (Math.random() * 2 - 1) * decayEnv * 0.38;
    const rawR = (Math.random() * 2 - 1) * decayEnv * 0.38;
    // One-pole air absorption damping
    prevL = prevL * 0.55 + rawL * 0.45;
    prevR = prevR * 0.55 + rawR * 0.45;
    left[i] += prevL;
    right[i] += prevR;
  }

  return impulse;
}
