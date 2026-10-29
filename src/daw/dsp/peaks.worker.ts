/// <reference lib="webworker" />
/**
 * Peaks worker. In: { jobId, channels, baseSamplesPerPeak?, levels? }
 * Out: { jobId, levels } (min/max buffers transferred) or { jobId, error }.
 */

import { computePeakLevels } from './peaks';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<{ jobId: number; channels: Float32Array[]; baseSamplesPerPeak?: number; levels?: number }>) => {
  const { jobId, channels, baseSamplesPerPeak, levels } = e.data;
  try {
    const out = computePeakLevels(channels, baseSamplesPerPeak, levels);
    const transfer: ArrayBuffer[] = [];
    for (const l of out) transfer.push(l.min.buffer as ArrayBuffer, l.max.buffer as ArrayBuffer);
    ctx.postMessage({ jobId, levels: out }, transfer);
  } catch (err) {
    ctx.postMessage({ jobId, error: err instanceof Error ? err.message : String(err) });
  }
};
