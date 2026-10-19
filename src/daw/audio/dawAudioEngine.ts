import { DawClip, DawFxSettings, DawProject, DawTrack } from '../types';
import { soundEngine } from '../../audio/soundEngine';

interface ActivePlaybackSource {
  stop: (time?: number) => void;
}

export class DawAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentBeat: number = 0;
  private bpm: number = 120;
  private startCtxTime: number = 0;
  private startBeatOffset: number = 0;
  private timerId: number | null = null;

  // Track channel strip nodes keyed by trackId
  private trackNodes = new Map<
    string,
    {
      input: GainNode;
      volume: GainNode;
      panner: StereoPannerNode | GainNode;
      eqLow: BiquadFilterNode;
      eqMid: BiquadFilterNode;
      eqHigh: BiquadFilterNode;
      reverbSend: GainNode;
      delaySend: GainNode;
    }
  >();

  private masterBus: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private activeSources: ActivePlaybackSource[] = [];

  // Mic recording
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  // Playhead update callback for UI synchronization
  public onPlayheadTick?: (currentBeat: number) => void;
  public onPlaybackEnded?: () => void;

  public ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.setupMasterBus(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupMasterBus(ctx: AudioContext) {
    this.masterCompressor = ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-14, 0);
    this.masterCompressor.ratio.setValueAtTime(4, 0);

    this.masterBus = ctx.createGain();
    this.masterBus.gain.setValueAtTime(1.0, 0);

    this.masterCompressor.connect(this.masterBus);
    this.masterBus.connect(ctx.destination);
  }

  /**
   * Initializes or updates track audio processing strips (Volume, Pan, 3-Band EQ, FX sends)
   */
  public syncTracks(tracks: DawTrack[], masterVolume: number = 1.0) {
    const ctx = this.ensureContext();
    if (this.masterBus) {
      this.masterBus.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.02);
    }

    const anySolo = tracks.some((t) => t.solo);

    tracks.forEach((track) => {
      let nodes = this.trackNodes.get(track.id);
      if (!nodes) {
        const input = ctx.createGain();
        const volume = ctx.createGain();

        let panner: StereoPannerNode | GainNode;
        if (ctx.createStereoPanner) {
          panner = ctx.createStereoPanner();
        } else {
          panner = ctx.createGain();
        }

        const eqLow = ctx.createBiquadFilter();
        eqLow.type = 'lowshelf';
        eqLow.frequency.setValueAtTime(250, 0);

        const eqMid = ctx.createBiquadFilter();
        eqMid.type = 'peaking';
        eqMid.frequency.setValueAtTime(1200, 0);
        eqMid.Q.setValueAtTime(1.0, 0);

        const eqHigh = ctx.createBiquadFilter();
        eqHigh.type = 'highshelf';
        eqHigh.frequency.setValueAtTime(4500, 0);

        const reverbSend = ctx.createGain();
        const delaySend = ctx.createGain();

        // Connect chain: input -> eqLow -> eqMid -> eqHigh -> volume -> panner -> masterCompressor
        input.connect(eqLow);
        eqLow.connect(eqMid);
        eqMid.connect(eqHigh);
        eqHigh.connect(volume);
        volume.connect(panner);
        panner.connect(this.masterCompressor || ctx.destination);

        nodes = { input, volume, panner, eqLow, eqMid, eqHigh, reverbSend, delaySend };
        this.trackNodes.set(track.id, nodes);
      }

      // Compute audible gain: muted if track.muted OR if any other track is soloed and this is not
      const isAudible = !track.muted && (!anySolo || track.solo);
      const effectiveVol = isAudible ? (track.fx?.volume ?? 1.0) : 0.0;
      nodes.volume.gain.setTargetAtTime(effectiveVol, ctx.currentTime, 0.02);

      // Pan
      if ('pan' in nodes.panner && nodes.panner.pan) {
        nodes.panner.pan.setTargetAtTime(track.fx?.pan ?? 0, ctx.currentTime, 0.02);
      }

      // 3-Band EQ
      nodes.eqLow.gain.setTargetAtTime(track.fx?.eqLow ?? 0, ctx.currentTime, 0.02);
      nodes.eqMid.gain.setTargetAtTime(track.fx?.eqMid ?? 0, ctx.currentTime, 0.02);
      nodes.eqHigh.gain.setTargetAtTime(track.fx?.eqHigh ?? 0, ctx.currentTime, 0.02);
    });
  }

  /**
   * Starts playback from currentBeat across all tracks and clips
   */
  public play(project: DawProject) {
    const ctx = this.ensureContext();
    this.stopSources();
    this.syncTracks(project.tracks, project.masterVolume);

    this.bpm = project.bpm;
    this.isPlaying = true;
    this.startCtxTime = ctx.currentTime;
    this.startBeatOffset = this.currentBeat;

    const beatSec = 60 / this.bpm;

    // Schedule all clips on audible tracks
    project.tracks.forEach((track) => {
      const nodes = this.trackNodes.get(track.id);
      if (!nodes) return;

      track.clips.forEach((clip) => {
        // Only schedule if clip starts after currentBeat or is currently active
        const clipEndBeat = clip.startBeat + clip.durationBeats;
        if (clipEndBeat <= this.startBeatOffset) return;

        // Audio clip scheduling
        if (clip.type === 'audio' && clip.audioBuffer) {
          const clipStartSec = Math.max(0, (clip.startBeat - this.startBeatOffset) * beatSec);
          const startOffsetSec =
            clip.startBeat < this.startBeatOffset
              ? (this.startBeatOffset - clip.startBeat) * beatSec
              : 0;
          const playDurationSec = (clipEndBeat - Math.max(clip.startBeat, this.startBeatOffset)) * beatSec;

          const src = ctx.createBufferSource();
          src.buffer = clip.audioBuffer;
          src.loop = clip.isLooping || false;

          const clipGain = ctx.createGain();
          clipGain.gain.setValueAtTime(clip.gain ?? 1.0, 0);

          src.connect(clipGain);
          clipGain.connect(nodes.input);

          const startTime = this.startCtxTime + clipStartSec;
          src.start(startTime, startOffsetSec, playDurationSec);
          this.activeSources.push({ stop: (t) => { try { src.stop(t || 0); } catch {} } });
        }

        // MIDI clip scheduling
        if (clip.type === 'midi' && clip.midiNotes && clip.midiNotes.length > 0) {
          clip.midiNotes.forEach((mNote) => {
            const noteMasterBeat = clip.startBeat + mNote.startBeat;
            if (noteMasterBeat < this.startBeatOffset) return;

            const noteStartSec = (noteMasterBeat - this.startBeatOffset) * beatSec;
            const noteDurSec = mNote.durationBeats * beatSec;
            const freq = 440 * Math.pow(2, (mNote.midi - 69) / 12);
            const startTime = this.startCtxTime + noteStartSec;

            // Trigger synth note through soundEngine onto track input
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            g.gain.setValueAtTime(0.001, startTime);
            g.gain.linearRampToValueAtTime(0.65 * mNote.velocity, startTime + 0.01);
            g.gain.setValueAtTime(0.55 * mNote.velocity, startTime + noteDurSec * 0.85);
            g.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDurSec);

            osc.connect(g);
            g.connect(nodes.input);
            osc.start(startTime);
            osc.stop(startTime + noteDurSec + 0.05);

            this.activeSources.push({ stop: (t) => { try { osc.stop(t || 0); } catch {} } });
          });
        }
      });
    });

    // Start UI playhead tick interval
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx) return;
      const elapsedSec = this.ctx.currentTime - this.startCtxTime;
      const beatsAdvanced = elapsedSec * (this.bpm / 60);
      let nextBeat = this.startBeatOffset + beatsAdvanced;

      // Handle Loop Region
      if (project.loopRegion.enabled && nextBeat >= project.loopRegion.endBeat) {
        this.seek(project.loopRegion.startBeat);
        this.play(project);
        return;
      }

      this.currentBeat = nextBeat;
      if (this.onPlayheadTick) {
        this.onPlayheadTick(this.currentBeat);
      }
    }, 25);
  }

  public pause() {
    this.isPlaying = false;
    this.stopSources();
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public stop() {
    this.pause();
    this.currentBeat = 0;
    if (this.onPlayheadTick) {
      this.onPlayheadTick(0);
    }
  }

  public seek(beat: number) {
    this.currentBeat = Math.max(0, beat);
    if (this.onPlayheadTick) {
      this.onPlayheadTick(this.currentBeat);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentBeat(): number {
    return this.currentBeat;
  }

  private stopSources() {
    this.activeSources.forEach((s) => s.stop());
    this.activeSources = [];
  }

  /**
   * Live microphone recording onto armed track
   */
  public async startMicRecording(): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.recordedChunks = [];

    const options = MediaRecorder.isTypeSupported('audio/webm')
      ? { mimeType: 'audio/webm' }
      : undefined;
    this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.start(100);
  }

  public async stopMicRecording(): Promise<{ buffer: AudioBuffer; blob: Blob }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = this.ensureContext();
          const buffer = await ctx.decodeAudioData(arrayBuffer);

          if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((t) => t.stop());
            this.mediaStream = null;
          }
          resolve({ buffer, blob });
        } catch (err) {
          reject(err);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * High-speed offline mixdown export to uncompressed CD-quality stereo WAV file
   */
  public async exportToWav(project: DawProject): Promise<Blob> {
    const bpm = project.bpm;
    const beatSec = 60 / bpm;

    // Calculate total song length
    let maxBeat = 16;
    project.tracks.forEach((t) => {
      t.clips.forEach((c) => {
        maxBeat = Math.max(maxBeat, c.startBeat + c.durationBeats);
      });
    });

    const totalSeconds = maxBeat * beatSec + 2.0; // Extra tail for reverbs
    const sampleRate = 44100;
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSeconds * sampleRate), sampleRate);

    // Master bus
    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(project.masterVolume, 0);
    masterGain.connect(offlineCtx.destination);

    const anySolo = project.tracks.some((t) => t.solo);

    // Render each track
    project.tracks.forEach((track) => {
      const isAudible = !track.muted && (!anySolo || track.solo);
      if (!isAudible) return;

      const trackGain = offlineCtx.createGain();
      trackGain.gain.setValueAtTime(track.fx?.volume ?? 1.0, 0);
      trackGain.connect(masterGain);

      track.clips.forEach((clip) => {
        if (clip.type === 'audio' && clip.audioBuffer) {
          const src = offlineCtx.createBufferSource();
          src.buffer = clip.audioBuffer;
          const startTime = clip.startBeat * beatSec;
          const durSec = clip.durationBeats * beatSec;

          const clipG = offlineCtx.createGain();
          clipG.gain.setValueAtTime(clip.gain ?? 1.0, 0);

          src.connect(clipG);
          clipG.connect(trackGain);
          src.start(startTime, 0, durSec);
        }
      });
    });

    const renderedBuffer = await offlineCtx.startRendering();
    return audioBufferToWavBlob(renderedBuffer);
  }
}

/**
 * Converts an AudioBuffer into an uncompressed stereo 16-bit PCM WAV Blob
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const left = buffer.getChannelData(0);
  const right = numChannels > 1 ? buffer.getChannelData(1) : left;
  const numSamples = buffer.length;

  const dataLength = numSamples * numChannels * 2;
  const bufferLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Interleave audio samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const sLeft = Math.max(-1, Math.min(1, left[i]));
    view.setInt16(offset, sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7fff, true);
    offset += 2;

    const sRight = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, sRight < 0 ? sRight * 0x8000 : sRight * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const dawAudioEngine = new DawAudioEngine();
