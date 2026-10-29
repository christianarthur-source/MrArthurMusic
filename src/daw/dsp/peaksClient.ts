/** Tiny promise client for peaks.worker.ts (one shared lazily-created worker). */

import { computePeakLevels, type PeakLevel } from './peaks';

type PeaksReply = { jobId: number; levels?: PeakLevel[]; error?: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (l: PeakLevel[]) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  const w = new Worker(new URL('./peaks.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<PeaksReply>) => {
    const p = pending.get(e.data.jobId);
    if (!p) return;
    pending.delete(e.data.jobId);
    if (e.data.levels) p.resolve(e.data.levels);
    else p.reject(new Error(e.data.error ?? 'peaks worker failed'));
  };
  w.onerror = (e: ErrorEvent) => {
    e.preventDefault?.();
    const err = new Error(`peaks worker error: ${e.message || 'unknown'}`);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
    w.terminate();
    worker = null;
  };
  worker = w;
  return w;
}

/**
 * Compute peak levels off the main thread. Input channels are copied (caller
 * keeps its data). Falls back to computing synchronously where Worker is
 * unavailable (e.g. tests / SSR).
 */
export function computePeaksInWorker(channels: Float32Array[], baseSamplesPerPeak?: number, levels?: number): Promise<PeakLevel[]> {
  const w = getWorker();
  if (!w) {
    try {
      return Promise.resolve(computePeakLevels(channels, baseSamplesPerPeak, levels));
    } catch (err) {
      return Promise.reject(err);
    }
  }
  const jobId = nextId++;
  const copies = channels.map((c) => c.slice());
  return new Promise<PeakLevel[]>((resolve, reject) => {
    pending.set(jobId, { resolve, reject });
    w.postMessage({ jobId, channels: copies, baseSamplesPerPeak, levels }, copies.map((c) => c.buffer as ArrayBuffer));
  });
}

/** Terminate the shared peaks worker (pending jobs are rejected). */
export function disposePeaksWorker(): void {
  for (const p of pending.values()) p.reject(new Error('peaks worker disposed'));
  pending.clear();
  worker?.terminate();
  worker = null;
}
