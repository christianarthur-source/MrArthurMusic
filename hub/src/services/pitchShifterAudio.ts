// Studio DAW Audio Engine with Real Decoded Waveform & Hardware-Accelerated Pitch Shifting
// Supports: MP3, WAV, OGG, M4A, AAC, FLAC, local files, and bundled accompaniment blobs.
// Tempo and pitch are independent: playback runs through a time-stretch AudioWorklet
// (timeStretchWorklet.js). Browsers without AudioWorklet fall back to playbackRate/detune,
// where speed and pitch move together.

import timeStretchWorkletUrl from './timeStretchWorklet.js?url';

export interface WaveformPoint {
  min: number;
  max: number;
  rms: number;
}

export interface TrackWaveformData {
  points: WaveformPoint[];
  duration: number;
  sampleRate: number;
  channels: number;
}

export type EngineState = 'stopped' | 'playing' | 'paused' | 'loading';

class AudioPlayerEngine {
  private audioCtx: AudioContext | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentBufferKey: string | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private stretchNode: AudioWorkletNode | null = null;
  private stretchReady: Promise<boolean> | null = null;
  private stretchBufferKey: string | null = null;

  private startTime: number = 0;
  private wallStartTime: number = 0;
  private pausedAt: number = 0;
  private playbackRate: number = 1.0;
  private semitones: number = 0;
  private volume: number = 1.0;
  private state: EngineState = 'stopped';

  // A-B Looping
  private loopA: number | null = null;
  private loopB: number | null = null;

  // Waveform peak cache
  private waveformCache: Map<string, TrackWaveformData> = new Map();

  // Listeners
  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onStateChangeCallbacks: Set<(state: EngineState) => void> = new Set();
  private onEndedCallbacks: Set<() => void> = new Set();
  private timerId: number | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private getContext(): AudioContext {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    return this.audioCtx;
  }

  private connectOutput(node: AudioNode): void {
    const ctx = this.getContext();
    if (!this.gainNode) {
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = this.volume;
    }
    if (!this.analyserNode) {
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);
    }
    node.connect(this.analyserNode);
  }

  // Loads the time-stretch worklet once; resolves false if the browser can't run it.
  private ensureStretchNode(): Promise<boolean> {
    if (!this.stretchReady) {
      const ctx = this.getContext();
      this.stretchReady = (async () => {
        try {
          if (!ctx.audioWorklet) return false;
          await ctx.audioWorklet.addModule(timeStretchWorkletUrl);
          const node = new AudioWorkletNode(ctx, 'time-stretch-player', {
            numberOfInputs: 0,
            outputChannelCount: [2]
          });
          node.port.onmessage = (e) => {
            if (e.data?.type === 'ended') this.handleSourceEnded();
          };
          this.connectOutput(node);
          this.stretchNode = node;
          return true;
        } catch (err) {
          console.warn('Time-stretch worklet unavailable, speed will change pitch:', err);
          return false;
        }
      })();
    }
    return this.stretchReady;
  }

  private sendStretchParams(): void {
    this.stretchNode?.port.postMessage({
      type: 'params',
      tempo: this.playbackRate,
      pitch: Math.pow(2, this.semitones / 12)
    });
  }

  // How fast the playhead moves through the track.
  private effectiveSpeed(): number {
    return this.stretchNode ? this.playbackRate : this.playbackRate * Math.pow(2, this.semitones / 12);
  }

  private handleSourceEnded(): void {
    if (this.state !== 'playing') return;
    if (this.loopA !== null && this.loopB !== null && this.loopB > this.loopA) {
      this.play(this.loopA);
      return;
    }
    this.setState('stopped');
    this.pausedAt = 0;
    this.stopProgressTimer();
    this.onEndedCallbacks.forEach((cb) => cb());
  }

  private stopSource(): void {
    this.stretchNode?.port.postMessage({ type: 'stop' });
    if (this.sourceNode) {
      try {
        this.sourceNode.onended = null;
        this.sourceNode.stop();
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
  }

  public async unlock(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('AudioContext resume failed:', err);
      }
    }
  }

  // ----------------------------------------------------------------------
  // 1. Audio Loading & Decoding
  // ----------------------------------------------------------------------
  public async loadTrack(url: string, trackId: string): Promise<TrackWaveformData> {
    const ctx = this.getContext();
    await this.unlock();

    // Check if already loaded
    if (this.currentBuffer && this.currentBufferKey === trackId && this.waveformCache.has(trackId)) {
      return this.waveformCache.get(trackId)!;
    }

    this.setState('loading');

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      // Decode audio data into native PCM AudioBuffer
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      this.stopSource();
      this.currentBuffer = audioBuffer;
      this.currentBufferKey = trackId;

      if ((await this.ensureStretchNode()) && this.stretchNode && this.stretchBufferKey !== trackId) {
        const channels: Float32Array[] = [];
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c).slice());
        this.stretchNode.port.postMessage({ type: 'load', channels }, channels.map((ch) => ch.buffer));
        this.stretchBufferKey = trackId;
      }

      // Extract high-resolution waveform data (800 display bins)
      const waveformData = this.extractWaveformData(audioBuffer, 800);
      this.waveformCache.set(trackId, waveformData);

      this.setState(this.state === 'playing' ? 'playing' : 'stopped');
      return waveformData;
    } catch (err) {
      console.error('Failed to load/decode audio track:', err);
      this.setState('stopped');
      throw err;
    }
  }

  public extractWaveformData(buffer: AudioBuffer, numBins: number = 800): TrackWaveformData {
    const numChannels = buffer.numberOfChannels;
    const numSamples = buffer.length;
    const samplesPerBin = Math.max(1, Math.floor(numSamples / numBins));

    const chan0 = buffer.getChannelData(0);
    const chan1 = numChannels > 1 ? buffer.getChannelData(1) : chan0;

    const points: WaveformPoint[] = new Array(numBins);

    for (let bin = 0; bin < numBins; bin++) {
      const start = bin * samplesPerBin;
      const end = Math.min(start + samplesPerBin, numSamples);

      let min = 0;
      let max = 0;
      let sumSq = 0;

      for (let i = start; i < end; i++) {
        // Average channels for stereo representation
        const sample = (chan0[i] + chan1[i]) * 0.5;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
        sumSq += sample * sample;
      }

      const count = Math.max(1, end - start);
      const rms = Math.sqrt(sumSq / count);

      points[bin] = {
        min: Math.max(-1, Math.min(1, min)),
        max: Math.max(-1, Math.min(1, max)),
        rms: Math.max(0, Math.min(1, rms))
      };
    }

    return {
      points,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: numChannels
    };
  }

  public getCachedWaveform(trackId: string): TrackWaveformData | null {
    return this.waveformCache.get(trackId) || null;
  }

  // ----------------------------------------------------------------------
  // 2. Playback Control with Native Studio Pitch Shifting
  // ----------------------------------------------------------------------
  public play(offsetSeconds?: number): void {
    if (!this.currentBuffer) return;
    const ctx = this.getContext();
    this.unlock();

    this.stopSource();

    const duration = this.currentBuffer.duration;
    let startOffset = typeof offsetSeconds === 'number' ? offsetSeconds : this.pausedAt;
    if (startOffset >= duration) startOffset = 0;

    // A-B loop boundary check
    if (this.loopA !== null && this.loopB !== null && this.loopB > this.loopA) {
      if (startOffset < this.loopA || startOffset >= this.loopB) {
        startOffset = this.loopA;
      }
    }

    // Track playback start
    const effectiveSpeed = this.effectiveSpeed();
    this.startTime = ctx.currentTime - startOffset / effectiveSpeed;
    this.wallStartTime = performance.now() - (startOffset / effectiveSpeed) * 1000;
    this.pausedAt = startOffset;

    if (this.stretchNode && this.stretchBufferKey === this.currentBufferKey) {
      this.sendStretchParams();
      this.stretchNode.port.postMessage({ type: 'play', offset: startOffset });
      this.setState('playing');
      this.startProgressTimer();
      return;
    }

    // Fallback: AudioBufferSourceNode, where speed and pitch move together.
    const source = ctx.createBufferSource();
    source.buffer = this.currentBuffer;
    source.detune.value = this.semitones * 100;
    source.playbackRate.value = this.playbackRate;
    this.connectOutput(source);
    this.sourceNode = source;
    source.onended = () => this.handleSourceEnded();

    source.start(0, startOffset);
    this.setState('playing');
    this.startProgressTimer();
  }

  public pause(): void {
    if (this.state !== 'playing') return;
    this.pausedAt = this.getCurrentTime();
    this.stopSource();

    this.setState('paused');
    this.stopProgressTimer();
  }

  public stop(): void {
    this.stopSource();
    this.pausedAt = 0;
    this.setState('stopped');
    this.stopProgressTimer();
  }

  public seek(seconds: number): void {
    if (!this.currentBuffer) return;
    const clamped = Math.max(0, Math.min(this.currentBuffer.duration, seconds));
    this.pausedAt = clamped;

    if (this.state === 'playing') {
      this.play(clamped);
    } else {
      this.onTimeUpdateCallbacks.forEach((cb) => cb(clamped));
    }
  }

  // ----------------------------------------------------------------------
  // 3. Real-Time Pitch & Speed Controls
  // ----------------------------------------------------------------------
  public setPitch(semitones: number): void {
    const prevTime = this.state === 'playing' ? this.getCurrentTime() : this.pausedAt;
    this.semitones = Math.max(-12, Math.min(12, semitones));
    this.sendStretchParams();
    if (this.sourceNode && this.sourceNode.detune) {
      // AudioParam detune in cents (1 semitone = 100 cents)
      this.sourceNode.detune.value = this.semitones * 100;
      try {
        this.sourceNode.detune.setValueAtTime(this.semitones * 100, this.getContext().currentTime);
      } catch {}
    }
    if (this.state === 'playing' && this.audioCtx) {
      const effectiveSpeed = this.effectiveSpeed();
      this.startTime = this.audioCtx.currentTime - prevTime / effectiveSpeed;
      this.wallStartTime = performance.now() - (prevTime / effectiveSpeed) * 1000;
    }
  }

  public getPitch(): number {
    return this.semitones;
  }

  public setSpeed(rate: number): void {
    const prevTime = this.state === 'playing' ? this.getCurrentTime() : this.pausedAt;
    this.playbackRate = Math.max(0.25, Math.min(2.0, rate));
    this.sendStretchParams();
    if (this.sourceNode && this.sourceNode.playbackRate) {
      this.sourceNode.playbackRate.value = this.playbackRate;
      try {
        this.sourceNode.playbackRate.setValueAtTime(this.playbackRate, this.getContext().currentTime);
      } catch {}
    }
    if (this.state === 'playing' && this.audioCtx) {
      const effectiveSpeed = this.effectiveSpeed();
      this.startTime = this.audioCtx.currentTime - prevTime / effectiveSpeed;
      this.wallStartTime = performance.now() - (prevTime / effectiveSpeed) * 1000;
    }
  }

  public getSpeed(): number {
    return this.playbackRate;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
      try {
        this.gainNode.gain.setValueAtTime(this.volume, this.getContext().currentTime);
      } catch {}
    }
  }

  // ----------------------------------------------------------------------
  // 4. A-B Loop Controls
  // ----------------------------------------------------------------------
  public setLoopA(time: number | null): void {
    this.loopA = time;
  }

  public setLoopB(time: number | null): void {
    this.loopB = time;
  }

  public clearLoop(): void {
    this.loopA = null;
    this.loopB = null;
  }

  // ----------------------------------------------------------------------
  // 5. Position & Timer Updates
  // ----------------------------------------------------------------------
  public getCurrentTime(): number {
    if (this.state !== 'playing' || !this.currentBuffer || !this.audioCtx) {
      return this.pausedAt;
    }
    const effectiveSpeed = this.effectiveSpeed();
    const audioElapsed = (this.audioCtx.currentTime - this.startTime) * effectiveSpeed;
    const wallElapsed = ((performance.now() - this.wallStartTime) / 1000) * effectiveSpeed;

    // In active browser contexts, audioElapsed tracks hardware buffer clock accurately.
    // If the audio context clock is unrendered or suspended (e.g. headless/tab throttle), fallback cleanly to wallElapsed.
    const calculated = audioElapsed > 0.05 ? audioElapsed : Math.max(audioElapsed, wallElapsed);

    return Math.max(0, Math.min(this.currentBuffer.duration, calculated));
  }

  public getDuration(): number {
    return this.currentBuffer ? this.currentBuffer.duration : 0;
  }

  public getState(): EngineState {
    return this.state;
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    const update = () => {
      if (this.state === 'playing') {
        const time = this.getCurrentTime();

        // Check A-B loop boundary
        if (this.loopA !== null && this.loopB !== null && this.loopB > this.loopA) {
          if (time >= this.loopB) {
            this.seek(this.loopA);
            return;
          }
        }

        this.onTimeUpdateCallbacks.forEach((cb) => cb(time));
        this.timerId = requestAnimationFrame(update);
      }
    };
    this.timerId = requestAnimationFrame(update);
  }

  private stopProgressTimer(): void {
    if (this.timerId !== null) {
      cancelAnimationFrame(this.timerId);
      this.timerId = null;
    }
  }

  private setState(newState: EngineState): void {
    this.state = newState;
    this.onStateChangeCallbacks.forEach((cb) => cb(newState));
  }

  // ----------------------------------------------------------------------
  // 6. Event Subscriptions
  // ----------------------------------------------------------------------
  public onTimeUpdate(cb: (time: number) => void): () => void {
    this.onTimeUpdateCallbacks.add(cb);
    return () => this.onTimeUpdateCallbacks.delete(cb);
  }

  public onStateChange(cb: (state: EngineState) => void): () => void {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  public onEnded(cb: () => void): () => void {
    this.onEndedCallbacks.add(cb);
    return () => this.onEndedCallbacks.delete(cb);
  }
}

export const studioAudioEngine = new AudioPlayerEngine();
if (typeof window !== 'undefined') {
  (window as any).studioAudioEngine = studioAudioEngine;
}
