/**
 * Main-thread client for the stretch worker: one worker, FIFO queue, at most
 * one job in flight, AbortSignal support.
 */

import type { StretchRequest, StretchResponse } from './stretchProtocol';
import type { StretchOptions } from './wsola';

export function createAbortError(message = 'The stretch job was aborted'): Error {
  if (typeof DOMException !== 'undefined') return new DOMException(message, 'AbortError');
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

export function isAbortError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { name?: unknown }).name === 'AbortError';
}

interface Job {
  id: number;
  channels: Float32Array[];
  opts: StretchOptions;
  resolve: (v: Float32Array[]) => void;
  reject: (e: unknown) => void;
  onProgress?: (f: number) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  /** Running job that was aborted: promise already rejected, waiting for the worker to acknowledge. */
  settled: boolean;
}

function defaultCreateWorker(): Worker {
  return new Worker(new URL('./stretch.worker.ts', import.meta.url), { type: 'module' });
}

export class StretchService {
  private readonly createWorker: () => Worker;
  private worker: Worker | null = null;
  private queue: Job[] = [];
  private running: Job | null = null;
  private nextId = 1;
  private disposed = false;

  constructor(createWorker?: () => Worker) {
    this.createWorker = createWorker ?? defaultCreateWorker;
  }

  /**
   * Stretch / pitch-shift `channels`. The input arrays are copied (callers keep
   * their data). Rejects with an AbortError (name === 'AbortError') if `signal`
   * aborts, or with an Error if the worker fails.
   */
  process(
    channels: Float32Array[],
    opts: StretchOptions,
    signal?: AbortSignal,
    onProgress?: (f: number) => void,
  ): Promise<Float32Array[]> {
    if (this.disposed) return Promise.reject(new Error('StretchService has been disposed'));
    if (signal?.aborted) return Promise.reject(createAbortError());
    return new Promise<Float32Array[]>((resolve, reject) => {
      const job: Job = {
        id: this.nextId++,
        channels: channels.map((c) => c.slice()),
        opts: { ...opts },
        resolve,
        reject,
        onProgress,
        signal,
        settled: false,
      };
      if (signal) {
        job.onAbort = () => this.abortJob(job);
        signal.addEventListener('abort', job.onAbort, { once: true });
      }
      this.queue.push(job);
      this.pump();
    });
  }

  /** Terminate the worker and reject every pending job. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const pending = [...(this.running ? [this.running] : []), ...this.queue];
    this.queue = [];
    this.running = null;
    for (const job of pending) this.settle(job, undefined, createAbortError('StretchService disposed'));
    this.worker?.terminate();
    this.worker = null;
  }

  /** Number of jobs waiting (excluding the running one). */
  get pendingCount(): number {
    return this.queue.length;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = this.createWorker();
    w.onmessage = (e: MessageEvent<StretchResponse>) => this.onMessage(e.data);
    w.onerror = (e: ErrorEvent) => {
      e.preventDefault?.();
      this.onWorkerFailure(new Error(`Stretch worker error: ${e.message || 'unknown error'}`));
    };
    w.onmessageerror = () => this.onWorkerFailure(new Error('Stretch worker message could not be deserialised'));
    this.worker = w;
    return w;
  }

  private pump(): void {
    if (this.disposed || this.running || this.queue.length === 0) return;
    const job = this.queue.shift()!;
    this.running = job;
    let worker: Worker;
    try {
      worker = this.ensureWorker();
    } catch (err) {
      this.running = null;
      this.settle(job, undefined, err instanceof Error ? err : new Error(String(err)));
      this.pump();
      return;
    }
    const channels = job.channels;
    job.channels = []; // ownership moves to the worker
    const msg: StretchRequest = { type: 'stretch', jobId: job.id, channels, opts: job.opts };
    try {
      worker.postMessage(msg, channels.map((c) => c.buffer as ArrayBuffer));
    } catch (err) {
      this.running = null;
      this.settle(job, undefined, err instanceof Error ? err : new Error(String(err)));
      this.pump();
    }
  }

  private abortJob(job: Job): void {
    const qi = this.queue.indexOf(job);
    if (qi >= 0) {
      this.queue.splice(qi, 1);
      this.settle(job, undefined, createAbortError());
      return;
    }
    if (this.running === job && !job.settled) {
      // Reject now; keep the slot busy until the worker acknowledges (max 1 concurrent).
      this.worker?.postMessage({ type: 'cancel', jobId: job.id } satisfies StretchRequest);
      this.settle(job, undefined, createAbortError());
    }
  }

  private onMessage(msg: StretchResponse): void {
    const job = this.running;
    if (!msg || !job || msg.jobId !== job.id) return;
    switch (msg.type) {
      case 'progress':
        if (!job.settled) job.onProgress?.(msg.fraction);
        return;
      case 'done':
        this.running = null;
        this.settle(job, msg.channels);
        this.pump();
        return;
      case 'error':
        this.running = null;
        this.settle(job, undefined, msg.cancelled ? createAbortError() : new Error(msg.message));
        this.pump();
        return;
    }
  }

  private onWorkerFailure(err: Error): void {
    const job = this.running;
    this.running = null;
    this.worker?.terminate();
    this.worker = null; // recreated lazily for the next job
    if (job) this.settle(job, undefined, err);
    this.pump();
  }

  private settle(job: Job, value?: Float32Array[], error?: unknown): void {
    if (job.settled) return;
    job.settled = true;
    if (job.signal && job.onAbort) job.signal.removeEventListener('abort', job.onAbort);
    if (error !== undefined) job.reject(error);
    else job.resolve(value ?? []);
  }
}
