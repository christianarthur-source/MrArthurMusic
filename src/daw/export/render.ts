import { encodeWav } from '../dsp/wav';
import { AssetManager } from '../engine/assets';
import { InstrumentBank } from '../engine/instruments';
import { MixGraph } from '../engine/mixGraph';
import { RegionScheduler, segmentTimeMap } from '../engine/scheduler';
import { projectEndTick } from '../model/ops';
import { ticksToSeconds } from '../model/time';
import { Project } from '../model/types';

/**
 * Offline mixdown with OfflineAudioContext, using the same MixGraph and
 * RegionScheduler as live playback. Stretched audio comes from the same
 * processed-buffer cache, so export matches playback (verified by the
 * self-test in diagnostics; see TESTING.md).
 */

export interface RenderOptions {
  fromTick: number;
  toTick: number;
  sampleRate: number;
  tailSec: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

export interface RenderAnalysis {
  durationSec: number;
  peak: number;
  peakDb: number;
  clippedSamples: number;
  rmsDb: number;
  silent: boolean;
}

export class RenderCancelled extends Error {
  override name = 'RenderCancelled';
}

export function defaultRange(p: Project): { fromTick: number; toTick: number } {
  if (p.loop.enabled) return { fromTick: p.loop.start, toTick: p.loop.end };
  return { fromTick: 0, toTick: Math.max(projectEndTick(p), 1) };
}

export async function renderProject(
  project: Project,
  assets: AssetManager,
  instruments: InstrumentBank,
  opts: RenderOptions,
): Promise<AudioBuffer> {
  const seconds = ticksToSeconds(project.tempoMap, opts.toTick) - ticksToSeconds(project.tempoMap, opts.fromTick);
  if (seconds <= 0) throw new Error('The export range is empty.');
  if (seconds > 20 * 60) throw new Error('Exports are limited to 20 minutes.');
  const frames = Math.ceil((seconds + opts.tailSec) * opts.sampleRate);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: frames, sampleRate: opts.sampleRate });
  const graph = new MixGraph(ctx, ctx.destination, false);
  graph.sync(project);
  const scheduler = new RegionScheduler(ctx, graph, assets, instruments, false);
  const map = segmentTimeMap(project, opts.fromTick, 0);
  // Tail: let sound decay after the range, but nothing new starts after toTick.
  scheduler.scheduleWindow(project, opts.fromTick, opts.toTick, map, true);
  scheduler.scheduleAutomation(project, opts.fromTick, opts.toTick, map, true);
  if (scheduler.pending.size) {
    throw new Error('Some sounds are still loading. Wait a moment and export again.');
  }

  // Progress + cancellation via suspend points.
  const steps = 20;
  const dur = frames / opts.sampleRate;
  let cancelled = false;
  opts.signal?.addEventListener('abort', () => (cancelled = true), { once: true });
  for (let i = 1; i < steps; i++) {
    // suspend() times must be multiples of the 128-frame render quantum
    const t = (Math.floor(((dur * i) / steps) * opts.sampleRate / 128) * 128) / opts.sampleRate;
    ctx.suspend(t).then(() => {
      opts.onProgress?.(i / steps);
      // Leaving the context suspended abandons the render; it is garbage collected.
      if (!cancelled) void ctx.resume();
    }).catch(() => undefined);
  }
  const rendering = ctx.startRendering();
  const result = await Promise.race([
    rendering,
    new Promise<never>((_, reject) => opts.signal?.addEventListener('abort', () => reject(new RenderCancelled('Export cancelled.')), { once: true })),
  ]);
  opts.onProgress?.(1);
  graph.dispose();
  return result;
}

export function analyse(buf: AudioBuffer): RenderAnalysis {
  let peak = 0;
  let clipped = 0;
  let sumSq = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
      if (v >= 0.999) clipped++;
      sumSq += d[i] * d[i];
    }
  }
  const rms = Math.sqrt(sumSq / Math.max(1, buf.length * buf.numberOfChannels));
  return {
    durationSec: buf.duration,
    peak,
    peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity,
    clippedSamples: clipped,
    rmsDb: rms > 0 ? 20 * Math.log10(rms) : -Infinity,
    silent: peak < 1e-5,
  };
}

/** Trim the render tail to the last audible sample (+50 ms), never shorter than the range. */
export function trimTail(buf: AudioBuffer, minFrames: number): Float32Array[] {
  const chans = Array.from({ length: buf.numberOfChannels }, (_, c) => buf.getChannelData(c));
  let last = minFrames;
  for (const d of chans) {
    for (let i = d.length - 1; i >= last; i--) {
      if (Math.abs(d[i]) > 1e-4) {
        last = i + 1;
        break;
      }
    }
  }
  const end = Math.min(buf.length, last + Math.floor(buf.sampleRate * 0.05));
  return chans.map((d) => d.slice(0, end));
}

export function toWavBlob(channels: Float32Array[], sampleRate: number, bitDepth: 16 | 24 | 32): Blob {
  return new Blob([encodeWav(channels, sampleRate, bitDepth)], { type: 'audio/wav' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function safeFileName(title: string, ext: string): string {
  const base = title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'song';
  return `${base}.${ext}`;
}
