import { InstrumentId, Pitch, Score, Track } from '../types/music';
import { expandPlaybackMeasures, getItemDuration, getPitchFrequency } from '../utils/musicMath';
import { DrumSound, DrumStepEvent, getDrumSoundForPitch } from '../data/drumGrooves';
import {
  createConcertHallImpulse,
  DrumKitType,
  getAcousticDrumSample,
  getAcousticSampleForFreq,
  getHarmonicPeriodicWave,
  isAcousticSampleLoaded,
  preloadInstrumentSamples,
  preloadPitches,
  preloadScoreSamples,
} from './acousticSamples';

interface TrackChannelStrip {
  input: GainNode;
  driveShaper: WaveShaperNode;
  driveWetGain: GainNode;
  driveDryGain: GainNode;
  lowShelf: BiquadFilterNode;
  highShelf: BiquadFilterNode;
  chorusWetGain: GainNode;
  delayWetGain: GainNode;
  reverbSendGain: GainNode;
  panner: StereoPannerNode | GainNode;
  faderGain: GainNode;
  cleanup: () => void;
}

function makeWarmDriveCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = Math.max(0.1, amount * 28);
  const nSamples = 1024;
  const curve = new Float32Array(new ArrayBuffer(nSamples * 4));
  for (let i = 0; i < nSamples; i++) {
    const x = (i * 2) / nSamples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/**
 * Perceptual loudness normalization multipliers for all 87 instruments.
 * Balances quiet acoustic, plucked, and woodwind instruments against naturally
 * hot, dense brass, organs, and saturated overdrive guitars so that all instruments
 * play at a uniform, comfortable, and professional average listening level with zero distortion.
 */
export const INSTRUMENT_NORMALIZATION_SCALE: Record<InstrumentId, number> = {
  // Woodwinds (Flute, Pan Flute, Recorder and acoustic reeds need clean boost)
  flute: 1.35,
  piccolo: 1.05,
  recorder: 1.35,
  pan_flute: 1.40,
  oboe: 1.10,
  english_horn: 1.15,
  clarinet: 1.18,
  bass_clarinet: 1.20,
  bassoon: 1.18,
  contrabassoon: 1.20,
  soprano_sax: 0.88,
  alto_sax: 0.90,
  tenor_sax: 0.90,
  baritone_sax: 0.92,

  // Brass (Naturally powerful GM samples trimmed to prevent overpowering other staves)
  trumpet: 0.80,
  cornet: 0.82,
  flugelhorn: 0.95,
  muted_trumpet: 1.05,
  french_horn: 1.12,
  trombone: 0.80,
  bass_trombone: 0.80,
  euphonium: 0.88,
  tuba: 0.92,
  brass_section: 0.70,

  // Bowed & Orchestral Strings
  violin: 1.05,
  viola: 1.10,
  cello: 1.08,
  double_bass: 1.12,
  string_ensemble: 0.90,
  pizzicato_strings: 1.45,
  tremolo_strings: 1.00,
  harp: 1.35,

  // Popular, Band, Vocals & World
  acoustic_guitar: 1.38,
  steel_guitar: 1.25,
  electric_guitar: 1.05,
  overdrive_guitar: 0.72,
  ukulele: 1.40,
  banjo: 1.15,
  sitar: 1.20,
  koto: 1.25,
  kalimba: 1.45,
  bagpipes: 0.72,
  harmonica: 1.05,
  accordion: 0.85,
  electric_bass: 1.00,
  slap_bass: 0.95,
  synth_bass: 0.85,
  synth_lead: 0.75,
  synth_pad: 0.92,
  choir_aahs: 1.15,
  voice_oohs: 1.22,

  // Pitched Percussion & Mallets
  glockenspiel: 1.25,
  xylophone: 1.20,
  marimba: 1.25,
  vibraphone: 1.18,
  steel_drums: 1.15,
  timpani: 1.00,
  tubular_bells: 1.15,
  taiko_drum: 0.95,

  // Auxiliary Percussion
  triangle: 0.80,
  tambourine: 0.85,
  woodblock: 0.85,
  cowbell: 0.85,
  congas: 0.90,
  djembe: 0.90,

  // Keyboards
  piano_treble: 0.95,
  piano_bass: 0.95,
  electric_piano: 0.95,
  harpsichord: 1.15,
  clavinet: 1.05,
  celesta: 1.45,
  music_box: 1.40,
  organ: 0.72,
  jazz_organ: 0.76,

  // Drums
  drum_kit: 0.88,
  drum_808: 0.90,
  drum_jazz: 0.86,
  drum_latin: 0.88,

  // Sound Effects
  sfx_applause: 0.85,
  sfx_laser: 0.80,
  sfx_retro_8bit: 0.80,
  sfx_bird_tweet: 0.85,
  sfx_ocean_waves: 0.85,
  sfx_thunder: 0.85,
  sfx_wind_howl: 0.85,
  sfx_helicopter: 0.85,
  sfx_siren: 0.80,
  sfx_train_whistle: 0.82,
  sfx_vinyl_scratch: 0.82,
  sfx_cartoon_boing: 0.85,
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private scheduledSources: { stop: () => void }[] = [];
  private playheadTimer: number | null = null;
  private metronomeEnabled: boolean = true;
  private drumPreviewTimer: number | null = null;
  private isDrumPreviewPlaying: boolean = false;
  private drumPreviewSources: { stop: () => void }[] = [];
  private keepAliveNode: AudioBufferSourceNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private masterBusCache = new WeakMap<
    BaseAudioContext,
    { dryBus: GainNode; reverbBus: GainNode }
  >();
  private liveTrackStrips = new Map<string, TrackChannelStrip>();

  /**
   * Builds (or returns cached) master output buses (dryBus & reverbBus) for any AudioContext or OfflineAudioContext,
   * combining direct dry signal + stereo Concert Hall ConvolverNode reverb into a master compressor.
   */
  private getMasterBuses(ctx: BaseAudioContext): { dryBus: GainNode; reverbBus: GainNode } {
    const existing = this.masterBusCache.get(ctx);
    if (existing) return existing;

    const dryBus = ctx.createGain();
    dryBus.gain.setValueAtTime(0.96, ctx.currentTime);

    const reverbBus = ctx.createGain();
    reverbBus.gain.setValueAtTime(0.90, ctx.currentTime);

    // 1. Broadcast-quality Mastering Dynamics Compressor
    // Acts as transparent automatic program leveling across multiple instruments & chords
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-14, ctx.currentTime);
    comp.knee.setValueAtTime(12, ctx.currentTime);
    comp.ratio.setValueAtTime(3.8, ctx.currentTime);
    comp.attack.setValueAtTime(0.003, ctx.currentTime); // 3ms transparent transient preservation
    comp.release.setValueAtTime(0.15, ctx.currentTime);

    // 2. Studio Master Make-Up Gain: +2.3 dB (1.30x)
    // Elevates composition playback loudness to match clear solo audition presence
    const makeupGain = ctx.createGain();
    makeupGain.gain.setValueAtTime(1.30, ctx.currentTime);

    // 3. Studio Brickwall Peak Limiter
    // Ultra-fast lookahead peak clamp: catches high-energy ensemble peaks with zero distortion
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1.2, ctx.currentTime); // -1.2 dBFS ceiling
    limiter.knee.setValueAtTime(1.5, ctx.currentTime); // Sharp brickwall knee
    limiter.ratio.setValueAtTime(20.0, ctx.currentTime); // Brickwall limiting
    limiter.attack.setValueAtTime(0.0005, ctx.currentTime); // 0.5ms ultra-fast peak catch
    limiter.release.setValueAtTime(0.04, ctx.currentTime); // 40ms fast recovery without pumping

    // 4. True-Peak Broadcast Output Ceiling (-0.35 dBFS / 0.96x)
    // Final analog-safe ceiling guaranteeing zero digital overs or speaker clipping
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.96, ctx.currentTime);

    dryBus.connect(comp);

    // Wet path (Option 3: Stereo Concert Hall Convolution Reverb)
    try {
      const convolver = ctx.createConvolver();
      convolver.buffer = createConcertHallImpulse(ctx, 1.75, 3.4);
      const reverbHighcut = ctx.createBiquadFilter();
      reverbHighcut.type = 'lowpass';
      reverbHighcut.frequency.setValueAtTime(4200, ctx.currentTime);
      const wetGain = ctx.createGain();
      wetGain.gain.setValueAtTime(0.65, ctx.currentTime);

      reverbBus.connect(convolver);
      convolver.connect(reverbHighcut);
      reverbHighcut.connect(wetGain);
      wetGain.connect(comp);
    } catch {
      reverbBus.connect(comp);
    }

    comp.connect(makeupGain);
    makeupGain.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(ctx.destination);

    const buses = { dryBus, reverbBus };
    this.masterBusCache.set(ctx, buses);
    return buses;
  }

  private getMasterOutput(ctx: BaseAudioContext): AudioNode {
    return this.getMasterBuses(ctx).dryBus;
  }

  /**
   * Creates a full per-track Virtual Mixer Channel Strip with:
   * - Warm Drive/Saturation (WaveShaperNode)
   * - 2-Band EQ (Bass Low-Shelf 180Hz & Treble High-Shelf 3.5kHz)
   * - Stereo Chorus (LFO-Modulated Delay)
   * - Echo/Delay Send (Tempo-synced stereo feedback delay)
   * - Concert Hall Reverb Send
   * - Stereo Panner (-1 Left to +1 Right)
   * - Channel Volume Fader + Mute/Solo gating
   */
  private createTrackChannelStrip(
    ctx: BaseAudioContext,
    track: Track,
    hasSoloed: boolean,
    activeTrackCountScale: number,
    tempo: number = 108
  ): TrackChannelStrip {
    const { dryBus, reverbBus } = this.getMasterBuses(ctx);
    const now = ctx.currentTime;

    const input = ctx.createGain();
    input.gain.setValueAtTime(1.0, now);

    // 1. Warm Drive / Overdrive Saturation
    const driveAmt = Math.max(0, Math.min(1, track.fx?.drive ?? 0));
    const driveShaper = ctx.createWaveShaper();
    driveShaper.curve = makeWarmDriveCurve(driveAmt);
    driveShaper.oversample = '2x';
    const driveWetGain = ctx.createGain();
    const driveDryGain = ctx.createGain();
    driveWetGain.gain.setValueAtTime(driveAmt, now);
    driveDryGain.gain.setValueAtTime(1 - driveAmt * 0.65, now);

    // 2. 2-Band EQ (Low Shelf @ 180Hz, High Shelf @ 3500Hz)
    const lowShelf = ctx.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.setValueAtTime(180, now);
    lowShelf.gain.setValueAtTime(track.fx?.eqBass ?? 0, now);

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.setValueAtTime(3500, now);
    highShelf.gain.setValueAtTime(track.fx?.eqTreble ?? 0, now);

    input.connect(driveShaper);
    driveShaper.connect(driveWetGain);
    input.connect(driveDryGain);
    driveWetGain.connect(lowShelf);
    driveDryGain.connect(lowShelf);
    lowShelf.connect(highShelf);

    // 3. Stereo Chorus
    const chorusAmt = Math.max(0, Math.min(1, track.fx?.chorus ?? 0));
    const chorusDelay = ctx.createDelay(0.1);
    chorusDelay.delayTime.setValueAtTime(0.018, now);
    const chorusLfo = ctx.createOscillator();
    const chorusLfoDepth = ctx.createGain();
    chorusLfo.type = 'sine';
    chorusLfo.frequency.setValueAtTime(1.4, now);
    chorusLfoDepth.gain.setValueAtTime(0.0035, now);
    chorusLfo.connect(chorusLfoDepth);
    chorusLfoDepth.connect(chorusDelay.delayTime);
    chorusLfo.start(now);

    const chorusWetGain = ctx.createGain();
    chorusWetGain.gain.setValueAtTime(chorusAmt * 0.55, now);
    highShelf.connect(chorusDelay);
    chorusDelay.connect(chorusWetGain);

    // 4. Echo / Delay FX
    const delayAmt = Math.max(0, Math.min(1, track.fx?.delay ?? 0));
    const echoTimeSec = Math.max(0.14, Math.min(0.65, (60 / Math.max(40, tempo)) * 0.5)); // Dotted/Eighth feel
    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.setValueAtTime(echoTimeSec, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.36, now);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(2600, now);

    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    const delayWetGain = ctx.createGain();
    delayWetGain.gain.setValueAtTime(delayAmt * 0.6, now);
    highShelf.connect(delayNode);
    delayFilter.connect(delayWetGain);

    // 5. Stereo Panner (-1 Left to +1 Right)
    let panner: StereoPannerNode | GainNode;
    if ('createStereoPanner' in ctx && typeof ctx.createStereoPanner === 'function') {
      const sp = ctx.createStereoPanner();
      sp.pan.setValueAtTime(Math.max(-1, Math.min(1, track.pan ?? 0)), now);
      panner = sp;
    } else {
      panner = ctx.createGain();
    }

    highShelf.connect(panner);
    chorusWetGain.connect(panner);
    delayWetGain.connect(panner);

    // 6. Channel Fader (Volume + Mute/Solo)
    const isAudible = !track.muted && (!hasSoloed || track.soloed);
    const effectiveFader = isAudible ? track.volume * activeTrackCountScale : 0.00001;
    const faderGain = ctx.createGain();
    faderGain.gain.setValueAtTime(effectiveFader, now);

    panner.connect(faderGain);
    faderGain.connect(dryBus);

    // 7. Concert Hall Reverb Send (post-fader, post-pan)
    const reverbAmt = Math.max(0, Math.min(1, track.fx?.reverb ?? 0.25));
    const reverbSendGain = ctx.createGain();
    reverbSendGain.gain.setValueAtTime(reverbAmt * 0.85, now);
    faderGain.connect(reverbSendGain);
    reverbSendGain.connect(reverbBus);

    return {
      input,
      driveShaper,
      driveWetGain,
      driveDryGain,
      lowShelf,
      highShelf,
      chorusWetGain,
      delayWetGain,
      reverbSendGain,
      panner,
      faderGain,
      cleanup: () => {
        try {
          chorusLfo.stop();
          chorusLfo.disconnect();
          input.disconnect();
          faderGain.disconnect();
          reverbSendGain.disconnect();
        } catch {
          // ignore
        }
      },
    };
  }

  /**
   * Real-time Virtual Mixer update: immediately applies Fader, Pan, Mute/Solo, and FX changes
   * to currently playing tracks without restarting playback!
   */
  public updateLiveTrackMix(score: Score) {
    if (!this.ctx || !this.isPlaying || this.liveTrackStrips.size === 0) return;
    const now = this.ctx.currentTime;
    const hasSoloed = score.tracks.some((t) => t.soloed);
    const activeTracks = score.tracks.filter((t) => !t.muted && (!hasSoloed || t.soloed));
    const activeTrackCountScale = Math.max(0.82, 1 / Math.pow(Math.max(1, activeTracks.length), 0.18));

    score.tracks.forEach((track) => {
      const strip = this.liveTrackStrips.get(track.id);
      if (!strip) return;

      const isAudible = !track.muted && (!hasSoloed || track.soloed);
      const targetFader = isAudible ? track.volume * activeTrackCountScale : 0.00001;
      strip.faderGain.gain.setTargetAtTime(targetFader, now, 0.015);

      if ('pan' in strip.panner) {
        strip.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, track.pan ?? 0)), now, 0.015);
      }

      const driveAmt = Math.max(0, Math.min(1, track.fx?.drive ?? 0));
      strip.driveShaper.curve = makeWarmDriveCurve(driveAmt);
      strip.driveWetGain.gain.setTargetAtTime(driveAmt, now, 0.02);
      strip.driveDryGain.gain.setTargetAtTime(1 - driveAmt * 0.65, now, 0.02);

      strip.lowShelf.gain.setTargetAtTime(track.fx?.eqBass ?? 0, now, 0.02);
      strip.highShelf.gain.setTargetAtTime(track.fx?.eqTreble ?? 0, now, 0.02);
      strip.chorusWetGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, track.fx?.chorus ?? 0)) * 0.55,
        now,
        0.02
      );
      strip.delayWetGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, track.fx?.delay ?? 0)) * 0.6,
        now,
        0.02
      );
      strip.reverbSendGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, track.fx?.reverb ?? 0.25)) * 0.85,
        now,
        0.02
      );
    });
  }

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      try {
        this.ctx.resume();
      } catch {
        // ignore
      }
    }
    this.ensureKeepAlive(this.ctx);
    return this.ctx;
  }

  public async initContext(): Promise<AudioContext | null> {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }
    this.ensureKeepAlive(ctx);
    // Warm up default grand piano samples in background
    void preloadInstrumentSamples(ctx, 'piano_treble');
    return ctx;
  }

  /**
   * Plays a cheerful, higher-pitched happy bell chime when clicking Mr. Arthur's avatar.
   */
  public playWelcomeChime() {
    const ctx = this.ensureContext();
    const now = ctx.currentTime + 0.008;
    // Sparkling high C-major happy chime (E5, G5, C6)
    const notes = [
      { freq: 659.25, delay: 0.0, dur: 0.16, vol: 0.13 },
      { freq: 783.99, delay: 0.055, dur: 0.18, vol: 0.14 },
      { freq: 1046.5, delay: 0.11, dur: 0.28, vol: 0.16 },
    ];
    notes.forEach(({ freq, delay, dur, vol }) => {
      const start = now + delay;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      // Soft bell shimmer harmonic
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, start);
      overtoneGain.gain.setValueAtTime(0.28, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(vol, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + dur + 0.02);
      overtone.stop(start + dur + 0.02);
    });
  }


  public preloadScore(score: Score) {
    const ctx = this.ensureContext();
    void preloadScoreSamples(ctx, score);
  }

  private ensureKeepAlive(ctx: AudioContext) {
    if (this.keepAliveNode) return;
    try {
      const buffer = ctx.createBuffer(1, 1024, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.00001, ctx.currentTime);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      this.keepAliveNode = src;
    } catch {
      // ignore
    }
  }

  private getNoiseBuffer(ctx: BaseAudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const size = Math.floor(ctx.sampleRate * 2.5);
      this.noiseBuffer = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < size; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return this.noiseBuffer;
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public getMetronome(): boolean {
    return this.metronomeEnabled;
  }

  /**
   * Preloads real acoustic SoundFont samples for an instrument (optionally targeting specific pitches).
   */
  public async preloadInstrument(
    instrumentId: InstrumentId,
    pitches?: Pitch[]
  ): Promise<void> {
    const ctx = this.ensureContext();
    if (pitches && pitches.length > 0) {
      await preloadPitches(ctx, instrumentId, pitches);
    } else {
      await preloadInstrumentSamples(ctx, instrumentId);
    }
  }

  /**
   * Checks whether acoustic samples for an instrument pitch are already loaded.
   */
  public isSampleReady(
    instrumentId: InstrumentId,
    pitch: Pitch,
    keySignature: Score['keySignature'] = 'C'
  ): boolean {
    const freq = getPitchFrequency(pitch, keySignature);
    return isAcousticSampleLoaded(instrumentId, freq);
  }

  /**
   * Play a note or chord preview with guaranteed high-quality real acoustic sample playback.
   * Awaits acoustic sample preloading if not yet cached so students hear authentic orchestral/acoustic instruments.
   */
  public async playHighQualityNotePreview(
    pitch: Pitch | Pitch[],
    instrumentId: InstrumentId = 'piano_treble',
    durationSeconds: number = 0.65,
    keySignature: Score['keySignature'] = 'C'
  ): Promise<void> {
    const ctx = this.ensureContext();
    if (
      instrumentId === 'drum_kit' ||
      instrumentId === 'drum_808' ||
      instrumentId === 'drum_jazz' ||
      instrumentId === 'drum_latin'
    ) {
      await preloadInstrumentSamples(ctx, instrumentId);
      const pitches = Array.isArray(pitch) ? pitch : [pitch];
      const now = ctx.currentTime + 0.005;

      // If specific pitch(es) are provided (e.g. dragging a note up/down the staff or clicking lines/spaces),
      // audition the EXACT drum sample mapped to each line or space!
      if (pitches.length > 0) {
        pitches.forEach((p) => {
          const sound = getDrumSoundForPitch(p);
          this.playDrumHit(sound, now, 0.95, ctx, undefined, instrumentId as DrumKitType);
        });
      } else {
        // Fallback default rhythm groove preview if no pitch is specified
        this.playDrumHit('kick', now, 0.95, ctx, undefined, instrumentId as DrumKitType);
        this.playDrumHit('snare', now + 0.22, 0.9, ctx, undefined, instrumentId as DrumKitType);
        this.playDrumHit('hihat_closed', now + 0.44, 0.82, ctx, undefined, instrumentId as DrumKitType);
      }
      return;
    }
    const pitches = Array.isArray(pitch) ? pitch : [pitch];
    await preloadPitches(ctx, instrumentId, pitches);
    const startTime = ctx.currentTime + 0.002;
    pitches.forEach((p) => {
      const freq = getPitchFrequency(p, keySignature);
      this.synthesizeInstrumentNote(freq, startTime, durationSeconds, instrumentId, 0.88, p, ctx);
    });
  }

  // Play a single note or chord preview with instant execution
  public playNotePreview(
    pitch: Pitch | Pitch[],
    instrumentId: InstrumentId = 'piano_treble',
    durationSeconds: number = 0.55,
    keySignature: Score['keySignature'] = 'C'
  ) {
    void this.playHighQualityNotePreview(pitch, instrumentId, durationSeconds, keySignature);
  }

  // Synthesize realistic acoustic drum hit via Web Audio
  public playDrumHit(
    sound: DrumSound,
    startTime: number,
    volume: number = 0.8,
    targetCtx?: BaseAudioContext,
    destinationNode?: AudioNode,
    drumType: DrumKitType = 'drum_kit'
  ): { stop: () => void } {
    const ctx = targetCtx || this.ensureContext();
    const outGain = ctx.createGain();
    const hitTime = Math.max(startTime, ctx.currentTime + 0.001);
    outGain.gain.setValueAtTime(0.0001, hitTime);
    outGain.connect(destinationNode || this.getMasterOutput(ctx));

    const cleanupNodes: { stop?: (t: number) => void }[] = [];

    // Prioritize high-definition acoustic/808 studio drum sample if available
    const acousticBuf = getAcousticDrumSample(ctx, sound, drumType);
    if (acousticBuf) {
      const src = ctx.createBufferSource();
      src.buffer = acousticBuf;
      const soundGain =
        sound === 'ride' && drumType === 'drum_jazz'
          ? 0.72
          : sound === 'snare' && drumType === 'drum_jazz'
          ? 0.76
          : sound === 'ride'
          ? 0.85
          : 1.05;
      outGain.gain.setValueAtTime(volume * soundGain, hitTime);
      src.connect(outGain);
      src.start(hitTime);
      return {
        stop: () => {
          try {
            src.stop(0);
          } catch {
            // ignore
          }
        },
      };
    }

    switch (sound) {
      case 'kick': {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(135, hitTime);
        osc.frequency.exponentialRampToValueAtTime(42, hitTime + 0.085);

        outGain.gain.setValueAtTime(volume * 0.98, hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.34);

        osc.connect(outGain);
        osc.start(hitTime);
        osc.stop(hitTime + 0.36);
        cleanupNodes.push(osc);
        break;
      }

      case 'snare': {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, hitTime);
        osc.frequency.exponentialRampToValueAtTime(82, hitTime + 0.06);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(volume * 0.62, hitTime);
        oscGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.13);
        osc.connect(oscGain);
        oscGain.connect(outGain);

        const noiseBuffer = this.getNoiseBuffer(ctx);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1950, hitTime);
        noiseFilter.Q.setValueAtTime(1.1, hitTime);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(volume * 0.75, hitTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.19);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(outGain);

        outGain.gain.setValueAtTime(1.0, hitTime);

        osc.start(hitTime);
        osc.stop(hitTime + 0.15);
        noise.start(hitTime);
        noise.stop(hitTime + 0.21);
        cleanupNodes.push(osc, noise);
        break;
      }

      case 'hihat_closed':
      case 'shaker': {
        const noiseBuffer = this.getNoiseBuffer(ctx);
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(sound === 'shaker' ? 5500 : 7600, hitTime);

        outGain.gain.setValueAtTime(volume * (sound === 'shaker' ? 0.38 : 0.55), hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + (sound === 'shaker' ? 0.075 : 0.055));

        noise.connect(filter);
        filter.connect(outGain);

        noise.start(hitTime);
        noise.stop(hitTime + 0.085);
        cleanupNodes.push(noise);
        break;
      }

      case 'hihat_open':
      case 'crash':
      case 'ride': {
        const dur = sound === 'crash' ? 0.95 : sound === 'ride' ? 0.5 : 0.36;
        const noiseBuffer = this.getNoiseBuffer(ctx);

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = sound === 'ride' ? 'bandpass' : 'highpass';
        filter.frequency.setValueAtTime(sound === 'ride' ? 5800 : 6600, hitTime);
        if (sound === 'ride') filter.Q.setValueAtTime(2.4, hitTime);

        outGain.gain.setValueAtTime(volume * (sound === 'crash' ? 0.75 : 0.52), hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + dur);

        noise.connect(filter);
        filter.connect(outGain);

        noise.start(hitTime);
        noise.stop(hitTime + dur + 0.02);
        cleanupNodes.push(noise);
        break;
      }

      case 'tom_high':
      case 'tom_low': {
        const startFreq = sound === 'tom_high' ? 240 : 150;
        const endFreq = sound === 'tom_high' ? 115 : 72;

        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, hitTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, hitTime + 0.16);

        outGain.gain.setValueAtTime(volume * 0.85, hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.29);

        osc.connect(outGain);
        osc.start(hitTime);
        osc.stop(hitTime + 0.31);
        cleanupNodes.push(osc);
        break;
      }

      case 'rimshot': {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1150, hitTime);
        osc.frequency.exponentialRampToValueAtTime(380, hitTime + 0.032);

        outGain.gain.setValueAtTime(volume * 0.8, hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.065);

        osc.connect(outGain);
        osc.start(hitTime);
        osc.stop(hitTime + 0.075);
        cleanupNodes.push(osc);
        break;
      }

      case 'cowbell': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(585, hitTime);
        osc2.frequency.setValueAtTime(842, hitTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, hitTime);
        filter.Q.setValueAtTime(3.0, hitTime);

        outGain.gain.setValueAtTime(volume * 0.7, hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.19);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(outGain);

        osc1.start(hitTime);
        osc2.start(hitTime);
        osc1.stop(hitTime + 0.21);
        osc2.stop(hitTime + 0.21);
        cleanupNodes.push(osc1, osc2);
        break;
      }

      case 'conga_open':
      case 'conga_slap': {
        const isSlap = sound === 'conga_slap';
        const osc = ctx.createOscillator();
        osc.type = isSlap ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(isSlap ? 380 : 210, hitTime);
        osc.frequency.exponentialRampToValueAtTime(isSlap ? 180 : 130, hitTime + 0.08);

        outGain.gain.setValueAtTime(volume * 0.85, hitTime);
        outGain.gain.exponentialRampToValueAtTime(0.001, hitTime + (isSlap ? 0.11 : 0.26));

        osc.connect(outGain);
        osc.start(hitTime);
        osc.stop(hitTime + 0.3);
        cleanupNodes.push(osc);
        break;
      }
    }

    return {
      stop: () => {
        try {
          cleanupNodes.forEach((n) => n.stop && n.stop(0));
          outGain.gain.cancelScheduledValues(ctx.currentTime);
          outGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.01);
        } catch {
          // ignore
        }
      },
    };
  }

  // Play a drum groove loop preview
  public async playDrumGroove(
    pattern: DrumStepEvent[],
    tempo: number,
    bars: number = 2,
    onStep?: (step: number) => void,
    onComplete?: () => void,
    drumType: DrumKitType = 'drum_kit'
  ) {
    this.stopDrumPreview();
    const ctx = this.ensureContext();
    await preloadInstrumentSamples(ctx, drumType);

    this.isDrumPreviewPlaying = true;
    const secondsPer16th = 60 / tempo / 4;
    const totalSteps = 16 * bars;
    const startTime = ctx.currentTime + 0.05;

    for (let bar = 0; bar < bars; bar++) {
      pattern.forEach((event) => {
        const stepIndex = bar * 16 + event.step;
        const hitTime = startTime + stepIndex * secondsPer16th;
        event.sounds.forEach((snd) => {
          const handle = this.playDrumHit(snd, hitTime, 0.85, ctx, undefined, drumType);
          this.drumPreviewSources.push(handle);
        });
      });
    }

    let currentStep = 0;
    const intervalMs = secondsPer16th * 1000;
    this.drumPreviewTimer = window.setInterval(() => {
      if (!this.isDrumPreviewPlaying) {
        if (this.drumPreviewTimer !== null) clearInterval(this.drumPreviewTimer);
        return;
      }
      if (onStep) onStep(currentStep % 16);
      currentStep++;
      if (currentStep >= totalSteps) {
        this.stopDrumPreview();
        if (onComplete) onComplete();
      }
    }, intervalMs);
  }

  public stopDrumPreview() {
    this.isDrumPreviewPlaying = false;
    if (this.drumPreviewTimer !== null) {
      clearInterval(this.drumPreviewTimer);
      this.drumPreviewTimer = null;
    }
    this.drumPreviewSources.forEach((src) => src.stop());
    this.drumPreviewSources = [];
  }

  /**
   * Synthesizes all 12 pitch-responsive Sound Effects (sfx_*).
   * Placing notes higher or lower on the staff changes the pitch/speed of the effect!
   */
  private synthesizeSoundEffect(
    ctx: BaseAudioContext,
    instrumentId: InstrumentId,
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
    destinationNode?: AudioNode
  ): { stop: () => void } {
    const outGain = ctx.createGain();
    outGain.gain.setValueAtTime(0.0001, startTime);
    outGain.connect(destinationNode || this.getMasterOutput(ctx));

    const activeNodes: { stop?: (t: number) => void }[] = [];
    const pitchRatio = Math.max(0.45, Math.min(2.4, freq / 261.63)); // Relative to Middle C (C4)
    const fxDur = Math.max(duration, 0.45);

    switch (instrumentId) {
      case 'sfx_laser': {
        const osc = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const modGain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 4.2, startTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq * 0.22), startTime + Math.min(0.38, fxDur));

        mod.type = 'sine';
        mod.frequency.setValueAtTime(55 * pitchRatio, startTime);
        modGain.gain.setValueAtTime(120, startTime);
        mod.connect(modGain);
        modGain.connect(osc.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(4.5, startTime);
        filter.frequency.setValueAtTime(freq * 3.5, startTime);
        filter.frequency.exponentialRampToValueAtTime(180, startTime + Math.min(0.38, fxDur));

        osc.connect(filter);
        filter.connect(outGain);

        const stopAt = startTime + Math.min(0.42, fxDur + 0.05);
        outGain.gain.setValueAtTime(volume * 0.85, startTime);
        outGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);

        osc.start(startTime);
        mod.start(startTime);
        osc.stop(stopAt);
        mod.stop(stopAt);
        activeNodes.push(osc, mod);
        break;
      }

      case 'sfx_retro_8bit': {
        // Rapid 8-bit coin/power-up arpeggio (root -> 3rd -> 5th -> octave)
        const osc = ctx.createOscillator();
        osc.type = 'square';
        const stepSec = 0.055;
        const ratios = [1, 1.25, 1.5, 2.0, 2.5, 3.0];
        ratios.forEach((r, idx) => {
          osc.frequency.setValueAtTime(freq * r, startTime + idx * stepSec);
        });
        const totalArp = Math.max(duration, ratios.length * stepSec + 0.12);
        outGain.gain.setValueAtTime(volume * 0.65, startTime);
        outGain.gain.setValueAtTime(volume * 0.6, startTime + totalArp * 0.7);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + totalArp);

        osc.connect(outGain);
        osc.start(startTime);
        osc.stop(startTime + totalArp + 0.02);
        activeNodes.push(osc);
        break;
      }

      case 'sfx_bird_tweet': {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        osc.type = 'sine';
        const baseBirdFreq = Math.max(1400, Math.min(4200, freq * 4.5));
        osc.frequency.setValueAtTime(baseBirdFreq * 0.85, startTime);
        osc.frequency.exponentialRampToValueAtTime(baseBirdFreq * 1.35, startTime + 0.09);
        osc.frequency.exponentialRampToValueAtTime(baseBirdFreq * 0.92, startTime + 0.16);
        osc.frequency.exponentialRampToValueAtTime(baseBirdFreq * 1.45, startTime + 0.28);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(28 * pitchRatio, startTime);
        lfoGain.gain.setValueAtTime(baseBirdFreq * 0.08, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const tweetDur = Math.max(0.35, Math.min(duration, 0.75));
        outGain.gain.setValueAtTime(0.001, startTime);
        outGain.gain.linearRampToValueAtTime(volume * 0.75, startTime + 0.02);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + tweetDur);

        osc.connect(outGain);
        osc.start(startTime);
        lfo.start(startTime);
        osc.stop(startTime + tweetDur + 0.02);
        lfo.stop(startTime + tweetDur + 0.02);
        activeNodes.push(osc, lfo);
        break;
      }

      case 'sfx_applause': {
        // Multi-layered crowd clapping bursts + warm hall murmur
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);
        noise.loop = true;

        const bp1 = ctx.createBiquadFilter();
        bp1.type = 'bandpass';
        bp1.frequency.setValueAtTime(1150 * Math.sqrt(pitchRatio), startTime);
        bp1.Q.setValueAtTime(1.4, startTime);

        const bp2 = ctx.createBiquadFilter();
        bp2.type = 'bandpass';
        bp2.frequency.setValueAtTime(2450 * Math.sqrt(pitchRatio), startTime);
        bp2.Q.setValueAtTime(1.8, startTime);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sawtooth';
        lfo.frequency.setValueAtTime(13.5, startTime);
        lfoGain.gain.setValueAtTime(0.35, startTime);

        const modGain = ctx.createGain();
        modGain.gain.setValueAtTime(0.65, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(modGain.gain);

        noise.connect(bp1);
        noise.connect(bp2);
        bp1.connect(modGain);
        bp2.connect(modGain);
        modGain.connect(outGain);

        const appDur = Math.max(duration, 0.85);
        outGain.gain.setValueAtTime(0.001, startTime);
        outGain.gain.linearRampToValueAtTime(volume * 0.85, startTime + 0.06);
        outGain.gain.setValueAtTime(volume * 0.75, startTime + appDur * 0.7);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + appDur);

        noise.start(startTime);
        lfo.start(startTime);
        noise.stop(startTime + appDur + 0.04);
        lfo.stop(startTime + appDur + 0.04);
        activeNodes.push(noise, lfo);
        break;
      }

      case 'sfx_ocean_waves':
      case 'sfx_wind_howl': {
        const isWind = instrumentId === 'sfx_wind_howl';
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = isWind ? 'bandpass' : 'lowpass';
        filter.Q.setValueAtTime(isWind ? 6.5 : 1.5, startTime);
        const baseCutoff = isWind ? freq * 2.2 : 320 * pitchRatio;
        const peakCutoff = isWind ? freq * 3.8 : 1100 * pitchRatio;
        const waveDur = Math.max(duration, 0.9);

        filter.frequency.setValueAtTime(baseCutoff, startTime);
        filter.frequency.exponentialRampToValueAtTime(peakCutoff, startTime + waveDur * 0.45);
        filter.frequency.exponentialRampToValueAtTime(baseCutoff * 0.8, startTime + waveDur);

        noise.connect(filter);
        filter.connect(outGain);

        outGain.gain.setValueAtTime(0.001, startTime);
        outGain.gain.linearRampToValueAtTime(volume * 0.85, startTime + waveDur * 0.35);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + waveDur);

        noise.start(startTime);
        noise.stop(startTime + waveDur + 0.04);
        activeNodes.push(noise);
        break;
      }

      case 'sfx_thunder': {
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(950 * pitchRatio, startTime);
        filter.frequency.exponentialRampToValueAtTime(95, startTime + 1.2);

        const subOsc = ctx.createOscillator();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(68 * pitchRatio, startTime);
        subOsc.frequency.exponentialRampToValueAtTime(28, startTime + 1.1);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(0.45, startTime);
        subOsc.connect(subGain);
        subGain.connect(filter);

        noise.connect(filter);
        filter.connect(outGain);

        const thunderDur = Math.max(duration, 1.25);
        outGain.gain.setValueAtTime(volume * 0.98, startTime);
        outGain.gain.exponentialRampToValueAtTime(volume * 0.55, startTime + 0.18);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + thunderDur);

        noise.start(startTime);
        subOsc.start(startTime);
        noise.stop(startTime + thunderDur + 0.05);
        subOsc.stop(startTime + thunderDur + 0.05);
        activeNodes.push(noise, subOsc);
        break;
      }

      case 'sfx_helicopter': {
        const noise = ctx.createBufferSource();
        noise.buffer = this.getNoiseBuffer(ctx);
        noise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(480 * pitchRatio, startTime);

        const rotorLfo = ctx.createOscillator();
        rotorLfo.type = 'sine';
        rotorLfo.frequency.setValueAtTime(9.5 * pitchRatio, startTime);

        const chopperGate = ctx.createGain();
        chopperGate.gain.setValueAtTime(0.5, startTime);
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.setValueAtTime(0.48, startTime);
        rotorLfo.connect(lfoDepth);
        lfoDepth.connect(chopperGate.gain);

        noise.connect(filter);
        filter.connect(chopperGate);
        chopperGate.connect(outGain);

        const heliDur = Math.max(duration, 0.75);
        outGain.gain.setValueAtTime(volume * 0.9, startTime);
        outGain.gain.setValueAtTime(volume * 0.85, startTime + heliDur * 0.8);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + heliDur);

        noise.start(startTime);
        rotorLfo.start(startTime);
        noise.stop(startTime + heliDur + 0.04);
        rotorLfo.stop(startTime + heliDur + 0.04);
        activeNodes.push(noise, rotorLfo);
        break;
      }

      case 'sfx_siren': {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 1.4, startTime);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(2.2, startTime);
        lfoGain.gain.setValueAtTime(freq * 0.45, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const sirenDur = Math.max(duration, 0.8);
        outGain.gain.setValueAtTime(0.001, startTime);
        outGain.gain.linearRampToValueAtTime(volume * 0.72, startTime + 0.04);
        outGain.gain.setValueAtTime(volume * 0.7, startTime + sirenDur * 0.85);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + sirenDur);

        osc.connect(outGain);
        osc.start(startTime);
        lfo.start(startTime);
        osc.stop(startTime + sirenDur + 0.03);
        lfo.stop(startTime + sirenDur + 0.03);
        activeNodes.push(osc, lfo);
        break;
      }

      case 'sfx_train_whistle': {
        // Classic American steam locomotive 3-chime chord (Root + Minor 3rd + Perfect 4th/6th) + steam hiss
        const ratios = [1.0, 1.2, 1.5];
        const whistleDur = Math.max(duration, 0.7);
        ratios.forEach((r) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * r * 0.96, startTime);
          osc.frequency.linearRampToValueAtTime(freq * r, startTime + 0.06);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.32, startTime);
          osc.connect(g);
          g.connect(outGain);
          osc.start(startTime);
          osc.stop(startTime + whistleDur + 0.04);
          activeNodes.push(osc);
        });

        const steam = ctx.createBufferSource();
        steam.buffer = this.getNoiseBuffer(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(freq * 2.5, startTime);
        const steamGain = ctx.createGain();
        steamGain.gain.setValueAtTime(0.16, startTime);
        steam.connect(bp);
        bp.connect(steamGain);
        steamGain.connect(outGain);
        steam.start(startTime);
        steam.stop(startTime + whistleDur + 0.04);
        activeNodes.push(steam);

        outGain.gain.setValueAtTime(0.001, startTime);
        outGain.gain.linearRampToValueAtTime(volume * 0.85, startTime + 0.05);
        outGain.gain.setValueAtTime(volume * 0.8, startTime + whistleDur * 0.8);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + whistleDur);
        break;
      }

      case 'sfx_vinyl_scratch': {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const scratchDur = Math.min(Math.max(duration, 0.28), 0.55);
        osc.frequency.setValueAtTime(freq * 0.6, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 3.4, startTime + scratchDur * 0.45);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.45, startTime + scratchDur);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(2.5, startTime);
        filter.frequency.setValueAtTime(1600, startTime);

        osc.connect(filter);
        filter.connect(outGain);

        outGain.gain.setValueAtTime(volume * 0.82, startTime);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + scratchDur);

        osc.start(startTime);
        osc.stop(startTime + scratchDur + 0.02);
        activeNodes.push(osc);
        break;
      }

      case 'sfx_cartoon_boing':
      default: {
        const osc = ctx.createOscillator();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();

        osc.type = 'sine';
        const boingDur = Math.max(duration, 0.65);
        osc.frequency.setValueAtTime(freq * 0.65, startTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.65, startTime + boingDur * 0.8);

        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(16, startTime);
        lfoGain.gain.setValueAtTime(freq * 0.35, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(3.0, startTime);
        filter.frequency.setValueAtTime(freq * 2.0, startTime);

        osc.connect(filter);
        filter.connect(outGain);

        outGain.gain.setValueAtTime(volume * 0.9, startTime);
        outGain.gain.exponentialRampToValueAtTime(0.0001, startTime + boingDur);

        osc.start(startTime);
        lfo.start(startTime);
        osc.stop(startTime + boingDur + 0.03);
        lfo.stop(startTime + boingDur + 0.03);
        activeNodes.push(osc, lfo);
        break;
      }
    }

    return {
      stop: () => {
        try {
          activeNodes.forEach((n) => n.stop && n.stop(0));
          outGain.gain.cancelScheduledValues(ctx.currentTime);
          outGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
        } catch {
          // ignore
        }
      },
    };
  }

  /**
   * Dual-Layer Hybrid Instrument Note Engine:
   * Combines Option 1 (Real Multi-Sample SoundFont AudioBuffers with pitch-shifting)
   * + Option 3 (Fourier PeriodicWave Harmonic Tables + Physical Waveguide & Formant Modeling).
   */
  private synthesizeInstrumentNote(
    freq: number,
    startTime: number,
    duration: number,
    instrumentId: InstrumentId,
    volume: number = 0.7,
    pitch?: Pitch,
    targetCtx?: BaseAudioContext,
    destinationNode?: AudioNode
  ): { stop: () => void } {
    const ctx = targetCtx || this.ctx;
    if (!ctx) return { stop: () => {} };
    const outTarget = destinationNode || this.getMasterOutput(ctx);

    // Apply perceptual loudness normalization so quiet instruments (acoustic guitar, flute, celesta,
    // pizzicato strings, kalimba) are cleanly boosted and naturally hot/dense instruments (brass section,
    // pipe organ, overdrive guitar, synth lead) are trimmed, ensuring a uniform, comfortable average
    // listening level with zero distortion.
    const normMultiplier = INSTRUMENT_NORMALIZATION_SCALE[instrumentId] ?? 1.0;
    const normalizedVolume = Math.min(1.4, volume * normMultiplier);

    // 1. Special case: Drum Kits (Rock, 808 Machine, Jazz/Folk, Latin/World) map notes directly to realistic drum hits!
    if (
      instrumentId === 'drum_kit' ||
      instrumentId === 'drum_808' ||
      instrumentId === 'drum_jazz' ||
      instrumentId === 'drum_latin'
    ) {
      const sound = getDrumSoundForPitch(pitch);
      return this.playDrumHit(sound, startTime, normalizedVolume, ctx, outTarget, instrumentId as DrumKitType);
    }

    // 2. Auxiliary unpitched percussion shortcuts
    if (instrumentId === 'triangle') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4200, startTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(normalizedVolume * 0.7, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + Math.max(duration, 0.85));
      osc.connect(gain);
      gain.connect(outTarget);
      osc.start(startTime);
      osc.stop(startTime + 0.9);
      return { stop: () => gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.01) };
    }
    if (instrumentId === 'cowbell') return this.playDrumHit('cowbell', startTime, normalizedVolume, ctx, outTarget);
    if (instrumentId === 'woodblock') return this.playDrumHit('rimshot', startTime, normalizedVolume, ctx, outTarget);
    if (instrumentId === 'tambourine') return this.playDrumHit('shaker', startTime, normalizedVolume, ctx, outTarget);
    if (instrumentId === 'congas') {
      return this.playDrumHit(freq > 250 ? 'conga_slap' : 'conga_open', startTime, normalizedVolume, ctx, outTarget);
    }
    if (instrumentId === 'djembe') {
      return this.playDrumHit(freq > 260 ? 'conga_slap' : 'kick', startTime, normalizedVolume, ctx, outTarget);
    }

    // 3. Sound Effects (sfx_*)
    if (instrumentId.startsWith('sfx_')) {
      return this.synthesizeSoundEffect(ctx, instrumentId, freq, startTime, duration, normalizedVolume, outTarget);
    }

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, startTime);
    masterGain.connect(outTarget);

    const activeNodes: (AudioNode | { stop?: (t: number) => void })[] = [masterGain];

    // 4. OPTION 1: Check for cached Real Acoustic SoundFont Multi-Sample!
    const acousticSample = getAcousticSampleForFreq(ctx, instrumentId, freq);
    if (acousticSample) {
      const sampleSrc = ctx.createBufferSource();
      sampleSrc.buffer = acousticSample.buffer;
      sampleSrc.playbackRate.setValueAtTime(acousticSample.playbackRate, startTime);

      // Velocity/tone shaping filter so soft dynamics sound mellow and loud dynamics sound bright
      const toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      const brightnessCutoff = Math.min(18000, Math.max(1800, freq * (4.5 + normalizedVolume * 6.5)));
      toneFilter.frequency.setValueAtTime(brightnessCutoff, startTime);

      const sampleGain = ctx.createGain();
      sampleGain.gain.setValueAtTime(0.0001, startTime);

      // Plucked / mallet / keyboard instruments have natural sample decay
      const isPercussiveOrPlucked = [
        'piano_treble',
        'piano_bass',
        'electric_piano',
        'harpsichord',
        'clavinet',
        'celesta',
        'music_box',
        'glockenspiel',
        'xylophone',
        'marimba',
        'vibraphone',
        'steel_drums',
        'timpani',
        'taiko_drum',
        'tubular_bells',
        'harp',
        'pizzicato_strings',
        'acoustic_guitar',
        'steel_guitar',
        'electric_guitar',
        'ukulele',
        'banjo',
        'sitar',
        'koto',
        'kalimba',
        'electric_bass',
        'slap_bass',
      ].includes(instrumentId);

      const releaseTail = isPercussiveOrPlucked ? Math.max(2.2, duration + 1.2) : 0.22;
      const stopTime = startTime + duration + releaseTail;

      sampleGain.gain.linearRampToValueAtTime(normalizedVolume * 0.96, startTime + 0.005);
      if (isPercussiveOrPlucked) {
        // Allow the natural resonance of harp strings, acoustic guitar, marimba, xylophone, etc. to decay realistically
        sampleGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
      } else {
        sampleGain.gain.setValueAtTime(normalizedVolume * 0.90, startTime + duration * 0.92);
        sampleGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);
      }

      sampleSrc.connect(toneFilter);
      toneFilter.connect(sampleGain);
      sampleGain.connect(masterGain);

      masterGain.gain.setValueAtTime(1.0, startTime);

      sampleSrc.start(startTime);
      sampleSrc.stop(stopTime + 0.02);
      activeNodes.push(sampleSrc);

      // Keep real acoustic instruments 100% pure without synthetic oscillator bleed.
      // For sustained orchestral winds/strings, only add a subtle (4%) body hint if needed.
      const synthBlendVolume = isPercussiveOrPlucked ? 0 : normalizedVolume * 0.04;
      if (synthBlendVolume > 0) {
        const bodyHandle = this.synthesizeFourierPhysicalLayer(
          ctx,
          freq,
          startTime,
          duration,
          instrumentId,
          synthBlendVolume,
          masterGain
        );
        activeNodes.push(bodyHandle);
      }

      return {
        stop: () => {
          try {
            activeNodes.forEach((n) => 'stop' in n && n.stop && n.stop(0));
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
          } catch {
            // ignore
          }
        },
      };
    }

    // 5. OPTION 3: Full Fourier PeriodicWave + Physical Waveguide Modeling (instant zero-latency)
    masterGain.gain.setValueAtTime(1.0, startTime);
    const synthHandle = this.synthesizeFourierPhysicalLayer(
      ctx,
      freq,
      startTime,
      duration,
      instrumentId,
      normalizedVolume,
      masterGain
    );
    activeNodes.push(synthHandle);

    return {
      stop: () => {
        try {
          activeNodes.forEach((n) => 'stop' in n && n.stop && n.stop(0));
          masterGain.gain.cancelScheduledValues(ctx.currentTime);
          masterGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.015);
        } catch {
          // ignore
        }
      },
    };
  }

  /**
   * Option 3: Custom Fourier PeriodicWave Harmonic Synthesis + Physical Waveguide / Formant Modeling
   * covering all 82 orchestral, band, keyboard, vocal, and world instruments.
   */
  private synthesizeFourierPhysicalLayer(
    ctx: BaseAudioContext,
    freq: number,
    startTime: number,
    duration: number,
    instrumentId: InstrumentId,
    volume: number,
    destination: AudioNode
  ): { stop: () => void } {
    const layerGain = ctx.createGain();
    layerGain.gain.setValueAtTime(0.0001, startTime);
    layerGain.connect(destination);

    const nodes: { stop?: (t: number) => void }[] = [];

    switch (instrumentId) {
      // ===== WOODWINDS =====
      case 'flute':
      case 'piccolo':
      case 'recorder':
      case 'pan_flute': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'flute'));
        osc.frequency.setValueAtTime(freq, startTime);

        // Vibrato LFO
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(5.2, startTime);
        lfoGain.gain.setValueAtTime(instrumentId === 'recorder' ? freq * 0.004 : freq * 0.011, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        // Chiff / breath noise transient on attack (especially Pan Flute & Flute)
        const breath = ctx.createBufferSource();
        breath.buffer = this.getNoiseBuffer(ctx);
        const breathFilter = ctx.createBiquadFilter();
        breathFilter.type = 'bandpass';
        breathFilter.frequency.setValueAtTime(freq * 2.5, startTime);
        breathFilter.Q.setValueAtTime(3.5, startTime);
        const breathGain = ctx.createGain();
        const breathAmt = instrumentId === 'pan_flute' ? 0.22 : 0.09;
        breathGain.gain.setValueAtTime(volume * breathAmt, startTime);
        breathGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);
        breath.connect(breathFilter);
        breathFilter.connect(breathGain);
        breathGain.connect(layerGain);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * (instrumentId === 'recorder' ? 2.8 : 4.2), startTime);

        osc.connect(filter);
        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.06;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.78, startTime + 0.04);
        layerGain.gain.setValueAtTime(volume * 0.72, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        lfo.start(startTime);
        breath.start(startTime);
        osc.stop(stopTime);
        lfo.stop(stopTime);
        breath.stop(startTime + 0.11);
        nodes.push(osc, lfo, breath);
        break;
      }

      case 'oboe':
      case 'english_horn':
      case 'bassoon':
      case 'contrabassoon':
      case 'bagpipes':
      case 'harmonica':
      case 'accordion': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'oboe_reed'));
        osc.frequency.setValueAtTime(freq, startTime);

        // Dual vocal/reed formant filters
        const f1 = ctx.createBiquadFilter();
        const f2 = ctx.createBiquadFilter();
        f1.type = 'bandpass';
        f2.type = 'bandpass';
        const isLowReed = instrumentId === 'bassoon' || instrumentId === 'contrabassoon';
        f1.frequency.setValueAtTime(isLowReed ? 520 : 1250, startTime);
        f1.Q.setValueAtTime(2.6, startTime);
        f2.frequency.setValueAtTime(isLowReed ? 1150 : 2650, startTime);
        f2.Q.setValueAtTime(2.8, startTime);

        osc.connect(f1);
        osc.connect(f2);
        f1.connect(layerGain);
        f2.connect(layerGain);

        // Accordion / Bagpipes musette detuned chorus oscillator
        if (instrumentId === 'accordion' || instrumentId === 'bagpipes' || instrumentId === 'harmonica') {
          const osc2 = ctx.createOscillator();
          osc2.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'oboe_reed'));
          osc2.frequency.setValueAtTime(freq * 1.004, startTime);
          osc2.connect(f1);
          osc2.start(startTime);
          osc2.stop(startTime + duration + 0.06);
          nodes.push(osc2);
        }

        const stopTime = startTime + duration + 0.06;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.04);
        layerGain.gain.setValueAtTime(volume * 0.62, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime);
        nodes.push(osc);
        break;
      }

      case 'clarinet':
      case 'bass_clarinet': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'clarinet'));
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * (instrumentId === 'bass_clarinet' ? 2.8 : 4.2), startTime);

        osc.connect(filter);
        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.06;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.72, startTime + 0.035);
        layerGain.gain.setValueAtTime(volume * 0.65, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime);
        nodes.push(osc);
        break;
      }

      case 'soprano_sax':
      case 'alto_sax':
      case 'tenor_sax':
      case 'baritone_sax': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'saxophone'));
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(2.2, startTime);
        filter.frequency.setValueAtTime(freq * 1.8, startTime);
        filter.frequency.linearRampToValueAtTime(freq * 4.5, startTime + 0.06);
        filter.frequency.linearRampToValueAtTime(freq * 2.8, startTime + duration);

        osc.connect(filter);
        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.07;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.75, startTime + 0.04);
        layerGain.gain.setValueAtTime(volume * 0.65, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime);
        nodes.push(osc);
        break;
      }

      // ===== BRASS =====
      case 'trumpet':
      case 'cornet':
      case 'flugelhorn':
      case 'muted_trumpet':
      case 'french_horn':
      case 'trombone':
      case 'bass_trombone':
      case 'euphonium':
      case 'tuba':
      case 'brass_section': {
        const isWarm =
          instrumentId === 'french_horn' ||
          instrumentId === 'flugelhorn' ||
          instrumentId === 'euphonium' ||
          instrumentId === 'tuba';
        const isMuted = instrumentId === 'muted_trumpet';

        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, isWarm ? 'brass_warm' : 'brass_bright'));
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = isMuted ? 'bandpass' : 'lowpass';
        filter.Q.setValueAtTime(isMuted ? 4.5 : 2.8, startTime);
        if (isMuted) {
          filter.frequency.setValueAtTime(Math.max(1200, freq * 3.2), startTime);
        } else {
          filter.frequency.setValueAtTime(freq * 1.5, startTime);
          filter.frequency.linearRampToValueAtTime(freq * (isWarm ? 3.6 : 5.8), startTime + 0.065);
          filter.frequency.linearRampToValueAtTime(freq * (isWarm ? 2.4 : 3.2), startTime + duration);
        }

        osc.connect(filter);

        // Full Brass Section adds stereo ensemble detuned unison voices
        if (instrumentId === 'brass_section') {
          const osc2 = ctx.createOscillator();
          osc2.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'brass_bright'));
          osc2.frequency.setValueAtTime(freq * 1.0035, startTime);
          osc2.connect(filter);
          osc2.start(startTime);
          osc2.stop(startTime + duration + 0.08);
          nodes.push(osc2);
        }

        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.07;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.72, startTime + 0.035);
        layerGain.gain.setValueAtTime(volume * 0.6, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime);
        nodes.push(osc);
        break;
      }

      // ===== BOWED & ORCHESTRAL STRINGS =====
      case 'violin':
      case 'viola':
      case 'cello':
      case 'double_bass':
      case 'string_ensemble':
      case 'tremolo_strings': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'strings_bowed'));
        osc.frequency.setValueAtTime(freq, startTime);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = 'sine';
        const isTremolo = instrumentId === 'tremolo_strings';
        lfo.frequency.setValueAtTime(isTremolo ? 11.5 : 5.4, startTime);
        lfoGain.gain.setValueAtTime(freq * 0.012, startTime);
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * (instrumentId === 'double_bass' ? 2.8 : 4.5), startTime);

        osc.connect(filter);

        if (instrumentId === 'string_ensemble' || instrumentId === 'tremolo_strings') {
          const osc2 = ctx.createOscillator();
          osc2.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'strings_bowed'));
          osc2.frequency.setValueAtTime(freq * 1.004, startTime);
          osc2.connect(filter);
          osc2.start(startTime);
          osc2.stop(startTime + duration + 0.12);
          nodes.push(osc2);
        }

        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.1;
        const attackTime = Math.min(0.08, duration * 0.35);
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.72, startTime + attackTime);
        layerGain.gain.setValueAtTime(volume * 0.65, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        lfo.start(startTime);
        osc.stop(stopTime);
        lfo.stop(stopTime);
        nodes.push(osc, lfo);
        break;
      }

      // ===== PLUCKED STRINGS, GUITARS, WORLD & BASS =====
      case 'pizzicato_strings':
      case 'harp':
      case 'acoustic_guitar':
      case 'steel_guitar':
      case 'electric_guitar':
      case 'ukulele':
      case 'banjo':
      case 'sitar':
      case 'koto':
      case 'kalimba':
      case 'electric_bass':
      case 'slap_bass': {
        const isSitarOrBanjo = instrumentId === 'sitar' || instrumentId === 'banjo' || instrumentId === 'koto';
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(
          getHarmonicPeriodicWave(ctx, isSitarOrBanjo ? 'sitar_drone' : 'plucked_folk')
        );
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const peakMult =
          instrumentId === 'slap_bass' || instrumentId === 'steel_guitar' || isSitarOrBanjo ? 7.5 : 4.8;
        filter.frequency.setValueAtTime(freq * peakMult, startTime);
        filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 1.3), startTime + 0.38);

        osc.connect(filter);
        filter.connect(layerGain);

        const pluckSustain =
          instrumentId === 'pizzicato_strings'
            ? 0.35
            : instrumentId === 'harp'
            ? Math.max(duration + 0.4, 1.3)
            : Math.max(duration + 0.15, 0.75);

        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.85, startTime + 0.006);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + pluckSustain);

        osc.start(startTime);
        osc.stop(startTime + pluckSustain + 0.03);
        nodes.push(osc);
        break;
      }

      case 'overdrive_guitar':
      case 'synth_lead':
      case 'synth_bass': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'overdrive_rock'));
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 1.003, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(3.2, startTime);
        const startCutoff = instrumentId === 'synth_bass' ? freq * 6.0 : freq * 5.2;
        filter.frequency.setValueAtTime(startCutoff, startTime);
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(180, freq * 2.2),
          startTime + Math.max(0.25, duration * 0.7)
        );

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(layerGain);

        const stopTime = startTime + duration + 0.08;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.7, startTime + 0.012);
        layerGain.gain.setValueAtTime(volume * 0.62, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(stopTime);
        osc2.stop(stopTime);
        nodes.push(osc1, osc2);
        break;
      }

      // ===== CHOIR, VOCALS & SYNTH PADS =====
      case 'choir_aahs':
      case 'voice_oohs':
      case 'synth_pad': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'choir_voice'));
        osc2.setPeriodicWave(getHarmonicPeriodicWave(ctx, 'choir_voice'));
        osc1.frequency.setValueAtTime(freq * 0.998, startTime);
        osc2.frequency.setValueAtTime(freq * 1.003, startTime);

        const f1 = ctx.createBiquadFilter();
        f1.type = instrumentId === 'synth_pad' ? 'lowpass' : 'bandpass';
        f1.frequency.setValueAtTime(
          instrumentId === 'choir_aahs' ? 850 : instrumentId === 'voice_oohs' ? 420 : freq * 2.6,
          startTime
        );
        f1.Q.setValueAtTime(instrumentId === 'synth_pad' ? 1.2 : 2.2, startTime);

        osc1.connect(f1);
        osc2.connect(f1);
        f1.connect(layerGain);

        const stopTime = startTime + duration + 0.16;
        const attack = Math.min(0.12, duration * 0.4);
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.75, startTime + attack);
        layerGain.gain.setValueAtTime(volume * 0.68, startTime + duration * 0.85);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(stopTime);
        osc2.stop(stopTime);
        nodes.push(osc1, osc2);
        break;
      }

      // ===== PITCHED PERCUSSION =====
      case 'glockenspiel':
      case 'tubular_bells':
      case 'celesta':
      case 'music_box': {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(freq, startTime);
        osc2.frequency.setValueAtTime(freq * 3.01, startTime);
        gain2.gain.setValueAtTime(0.28, startTime);

        osc1.connect(layerGain);
        osc2.connect(gain2);
        gain2.connect(layerGain);

        const ringDur = Math.max(duration, 1.2);
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.85, startTime + 0.005);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + ringDur);

        osc1.start(startTime);
        osc2.start(startTime);
        osc1.stop(startTime + ringDur + 0.04);
        osc2.stop(startTime + ringDur + 0.04);
        nodes.push(osc1, osc2);
        break;
      }

      case 'xylophone':
      case 'marimba':
      case 'vibraphone':
      case 'steel_drums': {
        const osc = ctx.createOscillator();
        osc.type = instrumentId === 'xylophone' || instrumentId === 'steel_drums' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        // Steel drums have a characteristic octave + fifth harmonic shimmer
        if (instrumentId === 'steel_drums') {
          const ov = ctx.createOscillator();
          ov.type = 'sine';
          ov.frequency.setValueAtTime(freq * 2, startTime);
          const ovGain = ctx.createGain();
          ovGain.gain.setValueAtTime(0.35, startTime);
          ov.connect(ovGain);
          ovGain.connect(layerGain);
          ov.start(startTime);
          ov.stop(startTime + 0.65);
          nodes.push(ov);
        }

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3.5, startTime);

        osc.connect(filter);
        filter.connect(layerGain);

        const decayTime = instrumentId === 'xylophone' ? 0.35 : 0.75;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.9, startTime + 0.005);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decayTime);

        osc.start(startTime);
        osc.stop(startTime + decayTime + 0.04);
        nodes.push(osc);
        break;
      }

      case 'timpani':
      case 'taiko_drum': {
        const isTaiko = instrumentId === 'taiko_drum';
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        const baseFreq = isTaiko ? Math.min(140, freq * 0.65) : freq;
        osc.frequency.setValueAtTime(baseFreq * (isTaiko ? 1.35 : 1.08), startTime);
        osc.frequency.exponentialRampToValueAtTime(baseFreq, startTime + 0.09);

        const decay = isTaiko ? 0.95 : 1.2;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.95, startTime + 0.008);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

        osc.connect(layerGain);
        osc.start(startTime);
        osc.stop(startTime + decay + 0.05);
        nodes.push(osc);
        break;
      }

      // ===== ORGANS & KEYBOARDS =====
      case 'organ':
      case 'jazz_organ': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(
          getHarmonicPeriodicWave(ctx, instrumentId === 'jazz_organ' ? 'organ_jazz' : 'organ_church')
        );
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(layerGain);

        const stopTime = startTime + duration + 0.05;
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.72, startTime + 0.018);
        layerGain.gain.setValueAtTime(volume * 0.7, startTime + duration);
        layerGain.gain.linearRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime);
        nodes.push(osc);
        break;
      }

      case 'harpsichord':
      case 'clavinet': {
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(
          getHarmonicPeriodicWave(ctx, instrumentId === 'clavinet' ? 'clavinet' : 'harpsichord')
        );
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 6.5, startTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 2.2, startTime + 0.45);

        osc.connect(filter);
        filter.connect(layerGain);

        const sustainSec = Math.max(duration + 0.15, 0.65);
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.78, startTime + 0.005);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + sustainSec);

        osc.start(startTime);
        osc.stop(startTime + sustainSec + 0.03);
        nodes.push(osc);
        break;
      }

      case 'electric_piano':
      case 'piano_treble':
      case 'piano_bass':
      default: {
        const isEP = instrumentId === 'electric_piano';
        const osc = ctx.createOscillator();
        osc.setPeriodicWave(getHarmonicPeriodicWave(ctx, isEP ? 'epiano' : 'piano'));
        osc.frequency.setValueAtTime(freq, startTime);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * (isEP ? 4.5 : 6.0), startTime);
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(220, freq * 1.6),
          startTime + Math.max(duration + 0.2, 0.75)
        );

        osc.connect(filter);
        filter.connect(layerGain);

        const sustainSec = Math.max(duration + 0.22, 0.82);
        layerGain.gain.setValueAtTime(0.0001, startTime);
        layerGain.gain.linearRampToValueAtTime(volume * 0.82, startTime + 0.007);
        layerGain.gain.exponentialRampToValueAtTime(volume * 0.38, startTime + 0.16);
        layerGain.gain.exponentialRampToValueAtTime(0.0001, startTime + sustainSec);

        osc.start(startTime);
        osc.stop(startTime + sustainSec + 0.04);
        nodes.push(osc);
        break;
      }
    }

    return {
      stop: () => {
        try {
          nodes.forEach((n) => n.stop && n.stop(0));
          layerGain.gain.cancelScheduledValues(ctx.currentTime);
          layerGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.01);
        } catch {
          // ignore
        }
      },
    };
  }

  // Play full score directly on Web Audio graph starting instantly at Measure 0 Beat 0
  public playScore(
    score: Score,
    onProgress: (measureIndex: number, beatFraction: number, countInInfo?: { isCountIn: boolean; beat: number }) => void,
    onNoteTrigger: (noteId: string) => void,
    onFinished: () => void,
    loopMeasureIndex?: number | null,
    enableCountIn?: boolean
  ) {
    this.stopPlayback();
    const liveCtx = this.ensureContext();
    if (liveCtx.state === 'suspended') {
      try {
        liveCtx.resume();
      } catch {
        // ignore
      }
    }

    // Eagerly preload any missing samples for instruments in the score
    void preloadScoreSamples(liveCtx, score);

    this.isPlaying = true;
    const tempo = score.tempo; // BPM
    const secondsPerQuarter = 60 / tempo;
    const secondsPerWhole = secondsPerQuarter * 4;

    const [beatsPerMeasure, beatValue] = score.timeSignature;
    const measureDurationSec = (beatsPerMeasure / beatValue) * secondsPerWhole;

    const maxMeasures = Math.max(...score.tracks.map((t) => t.measures.length), 1);
    const playbackSequence = expandPlaybackMeasures(
      maxMeasures,
      score.tracks[0]?.measures || [],
      loopMeasureIndex,
      loopMeasureIndex !== null && loopMeasureIndex !== undefined ? 8 : 4
    );
    const totalSteps = playbackSequence.length;
    const totalDurationSec = Math.max(0.5, totalSteps * measureDurationSec);

    // Audio starts in 20ms - instantaneous playback response!
    const leadTime = 0.02;
    const countInDurationSec = enableCountIn ? measureDurationSec : 0;
    const startAudioTime = liveCtx.currentTime + leadTime + countInDurationSec;

    // 0) Render 1-measure Count-in if requested
    if (enableCountIn) {
      const beatSec = (1 / beatValue) * secondsPerWhole;
      const countInStart = liveCtx.currentTime + leadTime;
      for (let b = 0; b < beatsPerMeasure; b++) {
        const beatTime = countInStart + b * beatSec;
        const isDownbeat = b === 0;

        const osc = liveCtx.createOscillator();
        const gain = liveCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(isDownbeat ? 1800 : 1200, beatTime);

        gain.gain.setValueAtTime(0.0001, beatTime);
        gain.gain.linearRampToValueAtTime(isDownbeat ? 0.40 : 0.25, beatTime + 0.002);
        gain.gain.linearRampToValueAtTime(0.0001, beatTime + 0.05);

        osc.connect(gain);
        gain.connect(this.getMasterOutput(liveCtx));

        osc.start(beatTime);
        osc.stop(beatTime + 0.06);

        this.scheduledSources.push({
          stop: () => {
            try {
              osc.stop();
              osc.disconnect();
            } catch {}
          },
        });
      }
    }

    // 1) Render Metronome Click Track directly on liveCtx
    if (this.metronomeEnabled) {
      const beatSec = (1 / beatValue) * secondsPerWhole;
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        const measureStart = startAudioTime + stepIdx * measureDurationSec;
        for (let b = 0; b < beatsPerMeasure; b++) {
          const beatTime = measureStart + b * beatSec;
          const isDownbeat = b === 0;

          const osc = liveCtx.createOscillator();
          const gain = liveCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(isDownbeat ? 1600 : 900, beatTime);

          gain.gain.setValueAtTime(0.0001, beatTime);
          gain.gain.linearRampToValueAtTime(isDownbeat ? 0.30 : 0.15, beatTime + 0.003);
          gain.gain.linearRampToValueAtTime(0.0001, beatTime + 0.04);

          osc.connect(gain);
          gain.connect(this.getMasterOutput(liveCtx));

          osc.start(beatTime);
          osc.stop(beatTime + 0.05);

          this.scheduledSources.push({
            stop: () => {
              try {
                osc.stop();
                osc.disconnect();
              } catch {
                // ignore
              }
            },
          });
        }
      }
    }

    // 2) Render Tracks directly on liveCtx following playbackSequence (repeats & loops)
    const hasSoloed = score.tracks.some((t) => t.soloed);
    const activeTracks = score.tracks.filter((t) => !t.muted && (!hasSoloed || t.soloed));
    const activeTrackCountScale = Math.max(0.82, 1 / Math.pow(Math.max(1, activeTracks.length), 0.18));
    const noteEvents: { id: string; startTime: number }[] = [];

    score.tracks.forEach((track) => {
      // Create a live Virtual Mixer Channel Strip for every track so Mute/Solo/Fader/Pan/FX can be adjusted live during playback!
      const strip = this.createTrackChannelStrip(
        liveCtx,
        track,
        hasSoloed,
        activeTrackCountScale,
        tempo
      );
      this.liveTrackStrips.set(track.id, strip);

      const isTrackCurrentlyAudible = !track.muted && (!hasSoloed || track.soloed);

      // Flatten items across playbackSequence with start times so ties and repeats work seamlessly
      const flatItems: {
        item: Score['tracks'][0]['measures'][0]['items'][0];
        startTime: number;
        durationSec: number;
      }[] = [];
      playbackSequence.forEach((mIdx, stepIdx) => {
        const measure = track.measures[mIdx];
        if (!measure) return;
        const measureStartTime = startAudioTime + stepIdx * measureDurationSec;
        let currentItemOffsetSec = 0;
        measure.items.forEach((item) => {
          const itemDurationSec = getItemDuration(item) * secondsPerWhole;
          flatItems.push({
            item,
            startTime: measureStartTime + currentItemOffsetSec,
            durationSec: itemDurationSec,
          });
          currentItemOffsetSec += itemDurationSec;
        });
      });

      const tiedContinuationIndices = new Set<number>();

      flatItems.forEach((entry, idx) => {
        const { item, startTime: noteStartTime } = entry;
        let totalItemDurationSec = entry.durationSec;

        if (item.type === 'note') {
          if (isTrackCurrentlyAudible) {
            noteEvents.push({ id: item.id, startTime: noteStartTime });
          }

          if (tiedContinuationIndices.has(idx)) {
            return;
          }

          // Accumulate tied duration across consecutive tied notes
          let lookaheadIdx = idx;
          while (flatItems[lookaheadIdx]?.item.isTied && lookaheadIdx + 1 < flatItems.length) {
            const nextEntry = flatItems[lookaheadIdx + 1];
            if (nextEntry.item.type === 'note') {
              totalItemDurationSec += nextEntry.durationSec;
              tiedContinuationIndices.add(lookaheadIdx + 1);
              lookaheadIdx++;
            } else {
              break;
            }
          }

          const itemPitches =
            item.pitches && item.pitches.length > 0
              ? item.pitches
              : item.pitch
              ? [item.pitch]
              : [];

          const polyphonyScale = 1 / Math.sqrt(Math.max(1, itemPitches.length));

          itemPitches.forEach((p) => {
            // Note: track.volume and activeTrackCountScale are applied by strip.faderGain so live fader changes work!
            let effectiveVolume = 0.96 * polyphonyScale;
            if (item.dynamic) {
              const dynamicScales: Record<string, number> = {
                pp: 0.35,
                p: 0.5,
                mp: 0.7,
                mf: 0.85,
                f: 1.0,
                ff: 1.2,
                sfz: 1.25,
              };
              effectiveVolume *= dynamicScales[item.dynamic] ?? 1.0;
            }

            let notePlayDuration = totalItemDurationSec * 0.95;
            if (item.articulation === 'staccato') {
              notePlayDuration = totalItemDurationSec * 0.45;
            } else if (item.articulation === 'tenuto') {
              notePlayDuration = totalItemDurationSec * 0.99;
            } else if (item.articulation === 'accent') {
              effectiveVolume *= 1.25;
            } else if (item.articulation === 'marcato') {
              effectiveVolume *= 1.3;
              notePlayDuration = totalItemDurationSec * 0.6;
            } else if (item.articulation === 'fermata') {
              notePlayDuration = totalItemDurationSec * 1.4;
            }

            const soundNode = this.synthesizeInstrumentNote(
              getPitchFrequency(p, score.keySignature),
              noteStartTime,
              notePlayDuration,
              track.instrumentId,
              effectiveVolume,
              p,
              liveCtx,
              strip.input
            );
            if (soundNode) {
              this.scheduledSources.push(soundNode);
            }
          });
        }
      });
    });

    // 3) Synchronize visual note highlight triggers
    noteEvents.forEach((evt) => {
      const delayMs = Math.max(0, (evt.startTime - liveCtx.currentTime) * 1000);
      const timerId = window.setTimeout(() => {
        if (this.isPlaying) {
          onNoteTrigger(evt.id);
        }
      }, delayMs);
      this.scheduledSources.push({ stop: () => clearTimeout(timerId) });
    });

    // 4) High-precision playhead cursor animation loop
    const hardwareLatency = (liveCtx as any).outputLatency || (liveCtx as any).baseLatency || 0;

    let lastScrolledSystem = -1;

    const step = () => {
      if (!this.isPlaying || !this.ctx) {
        if (typeof window !== 'undefined') {
          const lineEl = document.getElementById('staff-playhead-cursor-line');
          if (lineEl) lineEl.style.display = 'none';
        }
        return;
      }

      const now = this.ctx.currentTime;
      const elapsedSec = now - startAudioTime - hardwareLatency;

      const lineEl = typeof window !== 'undefined' ? document.getElementById('staff-playhead-cursor-line') : null;
      const layoutData = typeof window !== 'undefined' ? (window as any).__SCORE_MEASURE_LAYOUT__ : null;
      const scrollContainer =
        typeof window !== 'undefined' ? document.getElementById('staff-composer-scroll-container') : null;
      const svgEl =
        typeof window !== 'undefined' ? document.getElementById('staff-composer-score-svg') : null;
      const mainScroll =
        typeof window !== 'undefined' ? document.getElementById('staff-composer-main-scroll') : null;

      if (elapsedSec < 0) {
        if (enableCountIn) {
          const countInElapsedSec = elapsedSec + countInDurationSec;
          const beatSec = (1 / beatValue) * secondsPerWhole;
          const currentBeat = Math.max(1, Math.min(beatsPerMeasure, Math.floor(countInElapsedSec / beatSec) + 1));
          onProgress(playbackSequence[0] ?? 0, 0, { isCountIn: true, beat: currentBeat });
        }
        const firstM = playbackSequence[0] ?? 0;
        if (lineEl && layoutData && layoutData.layoutMap) {
          const mLayout = layoutData.layoutMap.get(firstM);
          if (mLayout) {
            const cursorX = mLayout.x + 35;
            const cursorY1 = mLayout.systemTopY + 10;
            const cursorY2 = mLayout.systemTopY + layoutData.systemHeight - 10;
            lineEl.setAttribute('x1', cursorX.toString());
            lineEl.setAttribute('x2', cursorX.toString());
            lineEl.setAttribute('y1', cursorY1.toString());
            lineEl.setAttribute('y2', cursorY2.toString());
            lineEl.style.display = 'block';
          }
        }
      } else if (elapsedSec >= totalDurationSec) {
        if (lineEl) lineEl.style.display = 'none';
        this.stopPlayback();
        onFinished();
        return;
      } else {
        const relativeStep = elapsedSec / measureDurationSec;
        const stepIdx = Math.min(totalSteps - 1, Math.floor(relativeStep));
        const currentM = playbackSequence[stepIdx] ?? 0;
        const beatFraction = Math.max(0, Math.min(0.999, relativeStep - Math.floor(relativeStep)));

        onProgress(currentM, beatFraction, { isCountIn: false, beat: 0 });

        if (lineEl && layoutData && layoutData.layoutMap) {
          const mLayout = layoutData.layoutMap.get(currentM);
          if (mLayout) {
            const cursorX = mLayout.x + 35 + beatFraction * (layoutData.measureWidth - 60);
            const cursorY1 = mLayout.systemTopY + 10;
            const cursorY2 = mLayout.systemTopY + layoutData.systemHeight - 10;
            lineEl.setAttribute('x1', cursorX.toString());
            lineEl.setAttribute('x2', cursorX.toString());
            lineEl.setAttribute('y1', cursorY1.toString());
            lineEl.setAttribute('y2', cursorY2.toString());
            lineEl.style.display = 'block';

            // Steady, pleasant auto-scroll following the music
            if (svgEl && scrollContainer && layoutData.totalSvgWidth > 0) {
              const svgScaleX = svgEl.clientWidth / layoutData.totalSvgWidth;
              const svgScaleY = svgEl.clientHeight / Math.max(1, layoutData.totalSvgHeight || 1);

              if (
                !layoutData.isBigStaff &&
                (layoutData.viewLayout === 'horizontal' ||
                  scrollContainer.scrollWidth > scrollContainer.clientWidth + 8)
              ) {
                const continuousSvgX = mLayout.x + beatFraction * layoutData.measureWidth;
                const playheadPxX = continuousSvgX * svgScaleX;
                const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
                const desiredScrollLeft = Math.max(
                  0,
                  Math.min(maxScrollLeft, playheadPxX - scrollContainer.clientWidth * 0.35)
                );
                const diff = desiredScrollLeft - scrollContainer.scrollLeft;
                if (Math.abs(diff) > 120) {
                  scrollContainer.scrollLeft += diff * 0.14;
                } else {
                  scrollContainer.scrollLeft += diff * 0.25;
                }
              }

              // Vertical system tracking in Page View
              if (
                layoutData.viewLayout !== 'horizontal' &&
                mainScroll &&
                mLayout.systemIndex !== lastScrolledSystem
              ) {
                lastScrolledSystem = mLayout.systemIndex;
                const sysTopPx =
                  mLayout.systemTopY * svgScaleY +
                  svgEl.getBoundingClientRect().top -
                  mainScroll.getBoundingClientRect().top +
                  mainScroll.scrollTop;
                const targetTop = Math.max(0, sysTopPx - mainScroll.clientHeight * 0.25);
                if (Math.abs(targetTop - mainScroll.scrollTop) > 80) {
                  mainScroll.scrollTo({ top: targetTop, behavior: 'smooth' });
                }
              }
            }
          }
        }
      }

      this.playheadTimer = requestAnimationFrame(step);
    };

    this.playheadTimer = requestAnimationFrame(step);
  }

  // Render full score offline and download as a 16-bit PCM WAV file
  public async exportWav(score: Score): Promise<void> {
    const tempo = score.tempo;
    const secondsPerQuarter = 60 / tempo;
    const secondsPerWhole = secondsPerQuarter * 4;
    const [beatsPerMeasure, beatValue] = score.timeSignature;
    const measureDurationSec = (beatsPerMeasure / beatValue) * secondsPerWhole;

    const maxMeasures = Math.max(...score.tracks.map((t) => t.measures.length), 1);
    const playbackSequence = expandPlaybackMeasures(maxMeasures, score.tracks[0]?.measures || []);
    const totalDurationSec = Math.max(1.0, playbackSequence.length * measureDurationSec + 1.4);

    const sampleRate = 44100;
    const lengthInSamples = Math.ceil(totalDurationSec * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, lengthInSamples, sampleRate);

    // Preload acoustic samples before rendering WAV so exported file includes real samples
    await preloadScoreSamples(offlineCtx, score);

    const hasSoloed = score.tracks.some((t) => t.soloed);
    const activeTracks = score.tracks.filter((t) => !t.muted && (!hasSoloed || t.soloed));
    const activeTrackCountScale = Math.max(0.82, 1 / Math.pow(Math.max(1, activeTracks.length), 0.18));

    score.tracks.forEach((track) => {
      if (track.muted) return;
      if (hasSoloed && !track.soloed) return;

      const strip = this.createTrackChannelStrip(
        offlineCtx,
        track,
        hasSoloed,
        activeTrackCountScale,
        tempo
      );

      const flatItems: {
        item: Score['tracks'][0]['measures'][0]['items'][0];
        startTime: number;
        durationSec: number;
      }[] = [];
      playbackSequence.forEach((mIdx, stepIdx) => {
        const measure = track.measures[mIdx];
        if (!measure) return;
        const measureStartTime = 0.05 + stepIdx * measureDurationSec;
        let currentItemOffsetSec = 0;
        measure.items.forEach((item) => {
          const itemDurationSec = getItemDuration(item) * secondsPerWhole;
          flatItems.push({
            item,
            startTime: measureStartTime + currentItemOffsetSec,
            durationSec: itemDurationSec,
          });
          currentItemOffsetSec += itemDurationSec;
        });
      });

      const tiedContinuationIndices = new Set<number>();

      flatItems.forEach((entry, idx) => {
        const { item, startTime: noteStartTime } = entry;
        let totalItemDurationSec = entry.durationSec;

        if (item.type === 'note') {
          if (tiedContinuationIndices.has(idx)) return;

          let lookaheadIdx = idx;
          while (flatItems[lookaheadIdx]?.item.isTied && lookaheadIdx + 1 < flatItems.length) {
            const nextEntry = flatItems[lookaheadIdx + 1];
            if (nextEntry.item.type === 'note') {
              totalItemDurationSec += nextEntry.durationSec;
              tiedContinuationIndices.add(lookaheadIdx + 1);
              lookaheadIdx++;
            } else {
              break;
            }
          }

          const itemPitches =
            item.pitches && item.pitches.length > 0
              ? item.pitches
              : item.pitch
              ? [item.pitch]
              : [];

          const polyphonyScale = 1 / Math.sqrt(Math.max(1, itemPitches.length));

          itemPitches.forEach((p) => {
            let effectiveVolume = 0.96 * polyphonyScale;
            if (item.dynamic) {
              const dynamicScales: Record<string, number> = {
                pp: 0.35,
                p: 0.5,
                mp: 0.7,
                mf: 0.85,
                f: 1.0,
                ff: 1.2,
                sfz: 1.25,
              };
              effectiveVolume *= dynamicScales[item.dynamic] ?? 1.0;
            }

            let notePlayDuration = totalItemDurationSec * 0.95;
            if (item.articulation === 'staccato') notePlayDuration = totalItemDurationSec * 0.45;
            else if (item.articulation === 'tenuto') notePlayDuration = totalItemDurationSec * 0.99;
            else if (item.articulation === 'accent') effectiveVolume *= 1.25;
            else if (item.articulation === 'marcato') {
              effectiveVolume *= 1.3;
              notePlayDuration = totalItemDurationSec * 0.6;
            } else if (item.articulation === 'fermata') notePlayDuration = totalItemDurationSec * 1.4;

            this.synthesizeInstrumentNote(
              getPitchFrequency(p, score.keySignature),
              noteStartTime,
              notePlayDuration,
              track.instrumentId,
              effectiveVolume,
              p,
              offlineCtx,
              strip.input
            );
          });
        }
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    const wavBytes = encodeAudioBufferToWav(renderedBuffer);
    const blob = new Blob([wavBytes as unknown as BlobPart], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const safeTitle = (score.title || 'Untitled_Composition').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.wav`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  public stopPlayback() {
    this.isPlaying = false;
    if (this.playheadTimer !== null) {
      cancelAnimationFrame(this.playheadTimer);
      this.playheadTimer = null;
    }
    if (typeof window !== 'undefined') {
      const lineEl = document.getElementById('staff-playhead-cursor-line');
      if (lineEl) lineEl.style.display = 'none';
    }
    this.scheduledSources.forEach((src) => src.stop());
    this.scheduledSources = [];
    this.liveTrackStrips.forEach((strip) => strip.cleanup());
    this.liveTrackStrips.clear();
  }
}

function encodeAudioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return new Uint8Array(out);
}

export const soundEngine = new SoundEngine();
export const warmUpAudio = () => soundEngine.initContext();

// Eagerly unlock and activate Web Audio on first user interaction anywhere
if (typeof window !== 'undefined') {
  const warmUp = () => {
    soundEngine.initContext();
    window.removeEventListener('pointerdown', warmUp);
    window.removeEventListener('keydown', warmUp);
    window.removeEventListener('touchstart', warmUp);
    window.removeEventListener('mousedown', warmUp);
  };
  window.addEventListener('pointerdown', warmUp, { passive: true });
  window.addEventListener('keydown', warmUp, { passive: true });
  window.addEventListener('touchstart', warmUp, { passive: true });
  window.addEventListener('mousedown', warmUp, { passive: true });
}
