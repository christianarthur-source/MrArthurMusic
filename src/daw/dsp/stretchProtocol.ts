/** Message protocol + handler logic for the stretch worker (kept separate so it is unit-testable without a Worker). */

import { StretchCancelledError, stretchChannelsAsync, type StretchOptions } from './wsola';

export type StretchRequest =
  | { type: 'stretch'; jobId: number; channels: Float32Array[]; opts: StretchOptions }
  | { type: 'cancel'; jobId: number };

export type StretchResponse =
  | { type: 'progress'; jobId: number; fraction: number }
  | { type: 'done'; jobId: number; channels: Float32Array[] }
  | { type: 'error'; jobId: number; message: string; cancelled: boolean };

export type PostFn = (msg: StretchResponse, transfer?: Transferable[]) => void;

/** Minimum interval between progress messages (ms). */
const PROGRESS_INTERVAL_MS = 50;

/**
 * Create the worker-side message handler. Jobs run one at a time (serialised);
 * 'cancel' can arrive while a job runs because the async stretch yields to the
 * event loop periodically, and also cancels jobs that are queued but not started.
 */
export function createStretchHandler(post: PostFn): (msg: StretchRequest) => void {
  const cancelled = new Set<number>();
  let chain: Promise<void> = Promise.resolve();

  const run = async (jobId: number, channels: Float32Array[], opts: StretchOptions) => {
    if (cancelled.delete(jobId)) {
      post({ type: 'error', jobId, message: 'Time-stretch job was cancelled', cancelled: true });
      return;
    }
    let lastProgress = 0;
    try {
      const out = await stretchChannelsAsync(
        channels,
        opts,
        (fraction) => {
          const now = Date.now();
          if (fraction < 1 && now - lastProgress < PROGRESS_INTERVAL_MS) return;
          lastProgress = now;
          post({ type: 'progress', jobId, fraction });
        },
        () => cancelled.has(jobId),
      );
      post(
        { type: 'done', jobId, channels: out },
        out.map((c) => c.buffer as ArrayBuffer),
      );
    } catch (err) {
      const isCancel = err instanceof StretchCancelledError;
      post({
        type: 'error',
        jobId,
        message: err instanceof Error ? err.message : String(err),
        cancelled: isCancel,
      });
    } finally {
      cancelled.delete(jobId);
    }
  };

  return (msg: StretchRequest) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cancel') {
      cancelled.add(msg.jobId);
      return;
    }
    if (msg.type === 'stretch') {
      const { jobId, channels, opts } = msg;
      chain = chain.then(() => run(jobId, channels, opts));
    }
  };
}
