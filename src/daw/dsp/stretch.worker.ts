/// <reference lib="webworker" />
/**
 * Module Web Worker for time-stretch / pitch-shift jobs.
 *
 * In:  { type: 'stretch', jobId, channels: Float32Array[], opts: StretchOptions }
 *      { type: 'cancel', jobId }
 * Out: { type: 'progress', jobId, fraction }
 *      { type: 'done', jobId, channels }            (buffers transferred)
 *      { type: 'error', jobId, message, cancelled }
 */

import { createStretchHandler, type StretchRequest } from './stretchProtocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const handle = createStretchHandler((msg, transfer) => {
  ctx.postMessage(msg, transfer ?? []);
});

ctx.onmessage = (e: MessageEvent<StretchRequest>) => handle(e.data);
