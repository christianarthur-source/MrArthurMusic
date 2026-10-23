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
const NOTE_NAMES_SHARP = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];

export function midiToSharpNoteName(midi: number): string {
  const clamped = Math.max(21, Math.min(108, Math.round(midi)));
  const noteName = NOTE_NAMES_SHARP[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${noteName}${octave}`;
}

export function midiToSoundfontNoteName(midi: number): string {
  const clamped = Math.max(21, Math.min(108, Math.round(midi)));
  const noteName = NOTE_NAMES_FLAT[clamped % 12];
  const octave = Math.floor(clamped / 12) - 1;
  return `${noteName}${octave}`;
}

export function freqToMidi(freq: number): number {
  return Math.round(69 + 12 * Math.log2(Math.max(20, freq) / 440));
}

/**
 * Maps instrument IDs directly to bundled local studio sample folders under /public/audio/samples/
 */
export const LOCAL_SAMPLE_INSTRUMENT_MAP: Partial<Record<InstrumentId, string>> = {
  piano_treble: 'piano',
  piano_bass: 'piano',
  electric_piano: 'electric_piano',
  organ: 'organ',
  jazz_organ: 'organ',
  flute: 'flute',
  piccolo: 'piccolo',
  clarinet: 'clarinet',
  bass_clarinet: 'bass_clarinet',
  bassoon: 'bassoon',
  contrabassoon: 'bassoon',
  alto_sax: 'alto_sax',
  tenor_sax: 'tenor_sax',
  baritone_sax: 'baritone_sax',
  trumpet: 'trumpet',
  cornet: 'trumpet',
  flugelhorn: 'trumpet',
  french_horn: 'french_horn',
  trombone: 'trombone',
  bass_trombone: 'trombone',
  tuba: 'tuba',
  euphonium: 'tuba',
  violin: 'violin',
  viola: 'viola',
  cello: 'cello',
  double_bass: 'double_bass',
  harp: 'harp',
  acoustic_guitar: 'acoustic_guitar',
  ukulele: 'acoustic_guitar',
  electric_guitar: 'electric_guitar',
  electric_bass: 'electric_bass',
  slap_bass: 'electric_bass',
  glockenspiel: 'glockenspiel',
  xylophone: 'xylophone',
  vibraphone: 'vibraphone',
};

/**
 * Available anchor note MIDI numbers for each local sample folder.
 */
export const LOCAL_INSTRUMENT_ANCHORS: Record<string, number[]> = {
  acoustic_guitar: [39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72],
  alto_sax: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81],
  baritone_sax: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69],
  bass_clarinet: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69],
  bassoon: [24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 69],
  cello: [36, 39, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72],
  clarinet: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
  double_bass: [30, 36, 42, 45],
  electric_bass: [24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60],
  electric_guitar: [42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72],
  electric_piano: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
  flute: [60, 69, 72, 81, 84, 93, 96],
  french_horn: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69],
  glockenspiel: [72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108],
  harp: [45, 48, 69, 72],
  organ: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72],
  piano: [21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108],
  piccolo: [72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108],
  tenor_sax: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72],
  trombone: [36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69],
  trumpet: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81],
  tuba: [24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57],
  vibraphone: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
  viola: [48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84],
  violin: [57, 60, 69, 72, 81, 84, 93, 96],
  xylophone: [60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96],
};

const ANCHOR_MIDI_NOTES = [
  21, 24, 27, 30, 33,
  36, 39, 42, 45,
  48, 51, 54, 57,
  60, 63, 66, 69,
  72, 75, 78, 81,
  84, 87, 90, 93,
  96, 99, 102, 105, 108
];

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

export function getNearestLocalAnchorMidi(folder: string, midi: number): number {
  const anchors = LOCAL_INSTRUMENT_ANCHORS[folder];
  if (!anchors || anchors.length === 0) return getNearestAnchorMidi(midi);
  let best = anchors[0];
  let bestDist = Math.abs(midi - best);
  for (let i = 1; i < anchors.length; i++) {
    const d = Math.abs(midi - anchors[i]);
    if (d < bestDist) {
      bestDist = d;
      best = anchors[i];
    }
  }
  return best;
}

// Acoustic Drum Kit, 808, Jazz Brush Kit, and Latin Percussion mapping (bundled under /public/audio/samples/)
export type DrumKitType = 'drum_kit' | 'drum_808' | 'drum_jazz' | 'drum_latin';

const drumSampleBufferCache = new Map<string, AudioBuffer>();
const pendingDrumFetchCache = new Map<string, Promise<AudioBuffer | null>>();

const DRUM_FILE_MAP: Record<string, string> = {
  kick: 'kick.mp3',
  snare: 'snare.mp3',
  hihat_closed: 'hihat.mp3',
  hihat_open: 'hihat_open.mp3',
  ride: 'ride.mp3',
  crash: 'crash.mp3',
  shaker: 'shaker.mp3',
  cowbell: 'cowbell.mp3',
  rimshot: 'rimshot.mp3',
  tom_high: 'tom1.mp3',
  tom_low: 'tom2.mp3',
  tom_floor: 'tom3.mp3',
  conga_open: 'conga_open.mp3',
  conga_slap: 'conga_slap.mp3',
};

export async function loadAcousticDrumSample(
  ctx: BaseAudioContext,
  sound: string,
  drumType: DrumKitType = 'drum_kit'
): Promise<AudioBuffer | null> {
  const fileName = DRUM_FILE_MAP[sound];
  if (!fileName) return null;

  const key = `${drumType}:${sound}`;
  const existing = drumSampleBufferCache.get(key);
  if (existing) return existing;

  const pending = pendingDrumFetchCache.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch(`/audio/samples/${drumType}/${fileName}`);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      drumSampleBufferCache.set(key, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    } finally {
      pendingDrumFetchCache.delete(key);
    }
  })();

  pendingDrumFetchCache.set(key, promise);
  return promise;
}

export function getAcousticDrumSample(
  ctx: BaseAudioContext,
  sound: string,
  drumType: DrumKitType = 'drum_kit'
): AudioBuffer | null {
  const key = `${drumType}:${sound}`;
  const cached = drumSampleBufferCache.get(key);
  if (cached) return cached;
  void loadAcousticDrumSample(ctx, sound, drumType);
  return null;
}

// Cache of decoded AudioBuffers keyed by `local:${folder}:${anchorMidi}` or `sf:${sfName}:${anchorMidi}`
const sampleBufferCache = new Map<string, AudioBuffer>();
const pendingFetchCache = new Map<string, Promise<AudioBuffer | null>>();

export async function loadLocalSampleAnchor(
  ctx: BaseAudioContext,
  folder: string,
  anchorMidi: number
): Promise<AudioBuffer | null> {
  const key = `local:${folder}:${anchorMidi}`;
  const existing = sampleBufferCache.get(key);
  if (existing) return existing;

  const pending = pendingFetchCache.get(key);
  if (pending) return pending;

  const sharpNote = midiToSharpNoteName(anchorMidi);
  const promise = (async () => {
    try {
      const res = await fetch(`/audio/samples/${folder}/${sharpNote}.mp3`);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
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

export async function loadSoundfontSampleAnchor(
  ctx: BaseAudioContext,
  sfName: string,
  anchorMidi: number
): Promise<AudioBuffer | null> {
  const key = `sf:${sfName}:${anchorMidi}`;
  const existing = sampleBufferCache.get(key);
  if (existing) return existing;

  const pending = pendingFetchCache.get(key);
  if (pending) return pending;

  const noteName = midiToSoundfontNoteName(anchorMidi);
  const promise = (async () => {
    try {
      const url = `${SOUNDFONT_CDN_BASE}/${sfName}-mp3/${noteName}.mp3`;
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
 * Backward compatibility alias for single-sample anchor fetch
 */
export async function loadSampleAnchor(
  ctx: BaseAudioContext,
  sfName: string,
  anchorMidi: number
): Promise<AudioBuffer | null> {
  if (sfName === 'acoustic_grand_piano') {
    return loadLocalSampleAnchor(ctx, 'piano', anchorMidi);
  }
  return loadSoundfontSampleAnchor(ctx, sfName, anchorMidi);
}

/**
 * Looks up a cached acoustic sample buffer for an instrument + frequency.
 * Checks fast local studio samples first, falling back to SoundFont CDN and physical synthesis.
 */
export function getAcousticSampleForFreq(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId,
  freq: number
): { buffer: AudioBuffer; playbackRate: number } | null {
  const targetMidi = 69 + 12 * Math.log2(Math.max(20, freq) / 440);
  const localFolder = LOCAL_SAMPLE_INSTRUMENT_MAP[instrumentId];

  if (localFolder) {
    const anchorMidi = getNearestLocalAnchorMidi(localFolder, Math.round(targetMidi));
    const key = `local:${localFolder}:${anchorMidi}`;
    const cached = sampleBufferCache.get(key);
    if (cached) {
      const semitoneDiff = targetMidi - anchorMidi;
      const playbackRate = Math.pow(2, semitoneDiff / 12);
      return { buffer: cached, playbackRate };
    }
    void loadLocalSampleAnchor(ctx, localFolder, anchorMidi);
    return null;
  }

  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return null;

  const anchorMidi = getNearestAnchorMidi(Math.round(targetMidi));
  const key = `sf:${sfName}:${anchorMidi}`;
  const cached = sampleBufferCache.get(key);

  if (cached) {
    const semitoneDiff = targetMidi - anchorMidi;
    const playbackRate = Math.pow(2, semitoneDiff / 12);
    return { buffer: cached, playbackRate };
  }

  void loadSoundfontSampleAnchor(ctx, sfName, anchorMidi);
  return null;
}

/**
 * Checks synchronously whether the acoustic sample anchor for this frequency is already cached.
 */
export function isAcousticSampleLoaded(
  instrumentId: InstrumentId,
  freq: number
): boolean {
  const targetMidi = 69 + 12 * Math.log2(Math.max(20, freq) / 440);
  const localFolder = LOCAL_SAMPLE_INSTRUMENT_MAP[instrumentId];
  if (localFolder) {
    const anchorMidi = getNearestLocalAnchorMidi(localFolder, Math.round(targetMidi));
    return sampleBufferCache.has(`local:${localFolder}:${anchorMidi}`);
  }
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return false;
  const anchorMidi = getNearestAnchorMidi(Math.round(targetMidi));
  return sampleBufferCache.has(`sf:${sfName}:${anchorMidi}`);
}

/**
 * Preloads the exact anchor samples needed for a list of Pitches on an instrument.
 */
export async function preloadPitches(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId,
  pitches: Pitch[]
): Promise<void> {
  if (pitches.length === 0) return;
  const localFolder = LOCAL_SAMPLE_INSTRUMENT_MAP[instrumentId];
  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!localFolder && !sfName) return;

  const semitoneMap: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const neededAnchors = new Set<number>();

  for (const p of pitches) {
    let midi = (p.octave + 1) * 12 + (semitoneMap[p.step] || 0);
    if (p.accidental === 'sharp') midi += 1;
    if (p.accidental === 'flat') midi -= 1;
    const anchor = localFolder
      ? getNearestLocalAnchorMidi(localFolder, midi)
      : getNearestAnchorMidi(midi);
    neededAnchors.add(anchor);
  }

  if (localFolder) {
    await Promise.allSettled(
      Array.from(neededAnchors).map((anchor) => loadLocalSampleAnchor(ctx, localFolder, anchor))
    );
  } else if (sfName) {
    await Promise.allSettled(
      Array.from(neededAnchors).map((anchor) => loadSoundfontSampleAnchor(ctx, sfName, anchor))
    );
  }
}

/**
 * Preloads register-aware anchor samples for a specific instrument so notes
 * across its natural playing range play with real acoustic samples immediately.
 */
export async function preloadInstrumentSamples(
  ctx: BaseAudioContext,
  instrumentId: InstrumentId
): Promise<void> {
  if (
    instrumentId === 'drum_kit' ||
    instrumentId === 'drum_808' ||
    instrumentId === 'drum_jazz' ||
    instrumentId === 'drum_latin'
  ) {
    const sounds = Object.keys(DRUM_FILE_MAP);
    await Promise.allSettled(
      sounds.map((s) => loadAcousticDrumSample(ctx, s, instrumentId as DrumKitType))
    );
    return;
  }

  const localFolder = LOCAL_SAMPLE_INSTRUMENT_MAP[instrumentId];
  if (localFolder) {
    const anchors = LOCAL_INSTRUMENT_ANCHORS[localFolder] || [];
    await Promise.allSettled(anchors.map((m) => loadLocalSampleAnchor(ctx, localFolder, m)));
    return;
  }

  const sfName = SOUNDFONT_INSTRUMENT_MAP[instrumentId];
  if (!sfName) return;

  const priorityAnchors = [48, 54, 60, 63, 66, 69, 72, 75, 78];
  await Promise.allSettled(priorityAnchors.map((midi) => loadSoundfontSampleAnchor(ctx, sfName, midi)));
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
