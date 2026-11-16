import { useCallback, useEffect, useRef, useState } from 'react';
import { getToolboxAudioContext } from '../../components/tools/toolboxAudio';
import { detectPitch } from './mpm.ts';
import { Stabilizer, type StableOutput } from './stabilize.ts';

export interface TunerRange { minHz: number; maxHz: number }

export interface InputDevice { deviceId: string; label: string }

export interface TunerEngineOptions {
  a4: number;
  /** Limit the search (selected string); null = chromatic. */
  range: TunerRange | null;
}

/** `?tunerTest=<hz>`: feed a test tone instead of the microphone (dev builds and workers.dev previews only). */
export function getTunerTestHz(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('tunerTest');
    if (!raw) return null;
    const hz = Number(raw);
    if (!Number.isFinite(hz) || hz < 20 || hz > 5000) return null;
    const allowed = import.meta.env.DEV || window.location.hostname.endsWith('workers.dev') || window.location.hostname === 'localhost';
    return allowed ? hz : null;
  } catch {
    return null;
  }
}

const workletLoaded = new WeakSet<BaseAudioContext>();

function mapError(err: unknown): string {
  const name: string = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') {
    return 'Microphone access was denied. Please allow microphone permissions in your browser bar.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Plug one in or check your audio input settings.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return 'The microphone is busy or unavailable. Close other apps using it and try again.';
  }
  return 'Could not access microphone. Please check your audio input settings.';
}

export interface TunerEngine {
  start: (deviceId?: string | null) => Promise<void>;
  stop: () => void;
  listening: boolean;
  starting: boolean;
  error: string | null;
  devices: InputDevice[];
  deviceId: string | null;
  testHz: number | null;
  fallback: boolean;
  /** Latest smoothed reading; read it in a requestAnimationFrame loop (not React state). */
  stableRef: React.MutableRefObject<StableOutput | null>;
  /** Selected string is far outside the detected pitch ('low' = played note far below it). */
  farRef: React.MutableRefObject<{ dir: 'low' | 'high'; t: number } | null>;
  /** Smoothed input level, 0..1 (rms). */
  levelRef: React.MutableRefObject<number>;
}

export function useTunerEngine(opts: TunerEngineOptions): TunerEngine {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);

  const stableRef = useRef<StableOutput | null>(null);
  const farRef = useRef<{ dir: 'low' | 'high'; t: number } | null>(null);
  const levelRef = useRef(0);
  const stabilizer = useRef(new Stabilizer({ a4: opts.a4 }));
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const requestRef = useRef(0);
  const unmounted = useRef(false);
  const live = useRef<{
    stream: MediaStream | null;
    osc: OscillatorNode | null;
    source: AudioNode | null;
    node: AudioWorkletNode | null;
    worker: Worker | null;
    analyser: AnalyserNode | null;
    timer: ReturnType<typeof setInterval> | null;
    watchdog: ReturnType<typeof setTimeout> | null;
  }>({ stream: null, osc: null, source: null, node: null, worker: null, analyser: null, timer: null, watchdog: null });

  const testHz = getTunerTestHz();

  const onReading = useCallback((hz: number | null, clarity: number, rms: number, far: 'low' | 'high' | null) => {
    const now = performance.now();
    levelRef.current = rms > levelRef.current ? rms : levelRef.current * 0.9 + rms * 0.1;
    farRef.current = far ? { dir: far, t: now } : null;
    stableRef.current = stabilizer.current.push({ hz, clarity, rms }, now);
  }, []);

  const teardownGraph = useCallback(() => {
    const l = live.current;
    if (l.timer) clearInterval(l.timer);
    if (l.watchdog) clearTimeout(l.watchdog);
    try { l.node?.port.postMessage({ cmd: 'stop' }); } catch { /* ignore */ }
    try { l.node?.disconnect(); } catch { /* ignore */ }
    try { l.source?.disconnect(); } catch { /* ignore */ }
    try { l.analyser?.disconnect(); } catch { /* ignore */ }
    try { l.osc?.stop(); } catch { /* ignore */ }
    try { l.osc?.disconnect(); } catch { /* ignore */ }
    l.worker?.terminate();
    l.stream?.getTracks().forEach((t) => { t.onended = null; t.stop(); });
    live.current = { stream: null, osc: null, source: null, node: null, worker: null, analyser: null, timer: null, watchdog: null };
  }, []);

  const stop = useCallback(() => {
    requestRef.current++; // cancels a permission prompt that is still pending
    teardownGraph();
    stabilizer.current.reset();
    stableRef.current = null;
    farRef.current = null;
    levelRef.current = 0;
    if (!unmounted.current) {
      setListening(false);
      setStarting(false);
    }
  }, [teardownGraph]);

  // Main-thread detection with an AnalyserNode: used only when worklets/workers are unavailable.
  const startFallback = useCallback((ctx: AudioContext, source: AudioNode) => {
    const l = live.current;
    try { l.node?.disconnect(); } catch { /* ignore */ }
    l.worker?.terminate();
    l.node = null;
    l.worker = null;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    l.analyser = analyser;
    const big = new Float32Array(8192);
    const w4 = new Float32Array(4096);
    let lastHz = 0;
    l.timer = setInterval(() => {
      analyser.getFloatTimeDomainData(big);
      const long = lastHz > 0 && lastHz < 100;
      w4.set(big.subarray(4096));
      const buf = long ? big : w4;
      let sum = 0;
      for (let i = buf.length - 2048; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / 2048);
      const r = optsRef.current.range ?? { minHz: 27, maxHz: 4200 };
      const res = rms > 0.0005 ? detectPitch(buf, ctx.sampleRate, r) : null;
      lastHz = res ? res.hz : 0;
      onReading(res ? res.hz : null, res ? res.clarity : 0, rms, null);
    }, 33);
    setFallback(true);
  }, [onReading]);

  const start = useCallback(async (wantedDevice?: string | null) => {
    if (live.current.source || live.current.osc) teardownGraph();
    setError(null);
    setStarting(true);
    setFallback(false);
    const requestId = ++requestRef.current;
    const cancelled = () => unmounted.current || requestId !== requestRef.current;
    let stream: MediaStream | null = null;
    try {
      const ctx = await getToolboxAudioContext();
      if (!ctx) throw new Error('Audio Context unavailable');
      if (cancelled()) return;

      let source: AudioNode;
      const l = live.current;
      if (testHz) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = testHz;
        const g = ctx.createGain();
        g.gain.value = 0.3;
        osc.connect(g);
        osc.start();
        l.osc = osc;
        source = g;
      } else {
        const base: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        };
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: wantedDevice ? { ...base, deviceId: { exact: wantedDevice } } : base,
          });
        } catch (err) {
          if (wantedDevice && (err as { name?: string })?.name === 'OverconstrainedError') {
            stream = await navigator.mediaDevices.getUserMedia({ audio: base });
          } else {
            throw err;
          }
        }
        // Closed (or stopped) while the browser's permission prompt was open: release the mic now.
        if (cancelled()) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        l.stream = stream;
        const track = stream.getAudioTracks()[0];
        track.onended = () => {
          if (unmounted.current) return;
          setError('The microphone was disconnected. Plug it back in and press Start.');
          stop();
        };
        source = ctx.createMediaStreamSource(stream);
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled()) {
            setDevices(
              all
                .filter((d) => d.kind === 'audioinput')
                .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` })),
            );
            setDeviceId(track.getSettings().deviceId ?? wantedDevice ?? null);
          }
        } catch { /* device list is optional */ }
      }
      l.source = source;

      stabilizer.current.reset();
      stabilizer.current.setConfig({ a4: optsRef.current.a4 });

      let usedWorklet = false;
      if (typeof AudioWorkletNode !== 'undefined' && ctx.audioWorklet && typeof Worker !== 'undefined') {
        try {
          if (!workletLoaded.has(ctx)) {
            await ctx.audioWorklet.addModule(new URL('./captureWorklet.js', import.meta.url));
            workletLoaded.add(ctx);
          }
          if (cancelled()) { teardownGraph(); return; }
          const worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' });
          const node = new AudioWorkletNode(ctx, 'tuner-capture', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            channelCount: 1,
            channelCountMode: 'explicit',
          });
          worker.onmessage = (e: MessageEvent) => {
            const d = e.data;
            onReading(d.hz, d.clarity, d.rms, d.far);
          };
          worker.onerror = () => startFallback(ctx, source);
          let gotBlock = false;
          node.port.onmessage = (e: MessageEvent) => {
            gotBlock = true;
            worker.postMessage({ type: 'block', samples: e.data.samples, sampleRate: e.data.sampleRate }, [e.data.samples.buffer]);
          };
          worker.postMessage({ type: 'config', range: optsRef.current.range });
          source.connect(node);
          l.node = node;
          l.worker = worker;
          usedWorklet = true;
          // If the worklet never delivers audio (very old browsers), switch to the main-thread path.
          l.watchdog = setTimeout(() => {
            if (!gotBlock && !cancelled()) startFallback(ctx, source);
          }, 2000);
        } catch {
          usedWorklet = false;
        }
      }
      if (!usedWorklet) startFallback(ctx, source);
      setListening(true);
      setStarting(false);
    } catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      teardownGraph();
      if (unmounted.current || requestId !== requestRef.current) return;
      setError(mapError(err));
      setListening(false);
      setStarting(false);
    }
  }, [teardownGraph, startFallback, onReading, stop, testHz]);

  // Settings that change while listening.
  useEffect(() => {
    stabilizer.current.setConfig({ a4: opts.a4 });
  }, [opts.a4]);
  const rangeKey = opts.range ? `${opts.range.minHz}-${opts.range.maxHz}` : 'full';
  useEffect(() => {
    live.current.worker?.postMessage({ type: 'config', range: opts.range });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => {
    unmounted.current = false;
    return () => {
      unmounted.current = true;
      requestRef.current++;
      teardownGraph();
    };
  }, [teardownGraph]);

  return { start, stop, listening, starting, error, devices, deviceId, testHz, fallback, stableRef, farRef, levelRef };
}
