import { computePeaksInWorker } from '../dsp/peaksClient';
import { PeakLevel } from '../dsp/peaks';
import { StretchService } from '../dsp/stretchService';
import { StretchQuality } from '../dsp/wsola';
import { CatalogEntry } from '../library/catalogTypes';
import { LibraryCatalog } from '../library/catalog';
import { idbGet, StoredAsset } from '../persistence/idb';
import { AudioAssetInfo } from '../model/types';

/**
 * Loads, decodes, caches and processes audio assets.
 *
 * - Library audio: fetched via the Cache API (persistent, evictable), decoded
 *   once, gapless-trimmed using the catalog's frames/encoderDelay.
 * - User audio: original bytes from IndexedDB.
 * - Decoded buffers are deduplicated by asset id; in-flight loads are shared.
 * - Memory policy: buffers referenced by the open project are pinned; others are
 *   evicted LRU beyond DECODED_BUDGET. Stretched results have their own budget.
 */

export const AUDIO_CACHE_NAME = 'mrdaw-audio-v1';
const DECODED_BUDGET = 192 * 1024 * 1024; // bytes of Float32 PCM
const PROCESSED_BUDGET = 160 * 1024 * 1024;
const MAX_FETCH_BYTES = 50 * 1024 * 1024;

export type AssetStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ProcessSpec {
  ratio: number; // output duration / input duration
  semitones: number;
  reversed: boolean;
}

export class AssetError extends Error {
  constructor(
    message: string,
    readonly missing = false,
  ) {
    super(message);
    this.name = 'AssetError';
  }
}

interface DecodedEntry {
  buffer: AudioBuffer;
  bytes: number;
  lastUsed: number;
}

const bufBytes = (b: AudioBuffer) => b.length * b.numberOfChannels * 4;

export function processKey(assetId: string, s: ProcessSpec, q: StretchQuality) {
  return `${assetId}|${s.ratio.toFixed(5)}|${s.semitones}|${s.reversed ? 'r' : 'f'}|${q}`;
}

export class AssetManager {
  private decoded = new Map<string, DecodedEntry>();
  private loading = new Map<string, Promise<AudioBuffer>>();
  private errors = new Map<string, AssetError>();
  private peaks = new Map<string, PeakLevel[]>();
  private processed = new Map<string, DecodedEntry>();
  private processing = new Map<string, { abort: AbortController; progress: number }>();
  private pinned = new Set<string>();
  private listeners = new Set<(assetId: string) => void>();
  quality: StretchQuality = 'fast';
  readonly stretch: StretchService;

  constructor(
    private ctx: BaseAudioContext,
    private catalog: LibraryCatalog | null,
  ) {
    this.stretch = new StretchService();
  }

  subscribe(fn: (assetId: string) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit(assetId: string) {
    for (const l of this.listeners) l(assetId);
  }

  status(assetId: string): AssetStatus {
    if (this.decoded.has(assetId)) return 'ready';
    if (this.errors.has(assetId)) return 'error';
    if (this.loading.has(assetId)) return 'loading';
    return 'idle';
  }

  error(assetId: string): AssetError | undefined {
    return this.errors.get(assetId);
  }

  peek(assetId: string): AudioBuffer | undefined {
    const e = this.decoded.get(assetId);
    if (e) e.lastUsed = performance.now();
    return e?.buffer;
  }

  getPeaks(assetId: string): PeakLevel[] | undefined {
    return this.peaks.get(assetId);
  }

  /** Pin the assets used by the open project; unpinned buffers become evictable. */
  setPinned(ids: Iterable<string>) {
    this.pinned = new Set(ids);
    this.evict();
  }

  load(asset: AudioAssetInfo): Promise<AudioBuffer> {
    const have = this.peek(asset.id);
    if (have) return Promise.resolve(have);
    const inflight = this.loading.get(asset.id);
    if (inflight) return inflight;
    this.errors.delete(asset.id);
    const p = this.fetchAndDecode(asset)
      .then((buffer) => {
        this.decoded.set(asset.id, { buffer, bytes: bufBytes(buffer), lastUsed: performance.now() });
        this.loading.delete(asset.id);
        this.evict();
        this.emit(asset.id);
        this.computePeaks(asset.id, buffer);
        return buffer;
      })
      .catch((err: unknown) => {
        this.loading.delete(asset.id);
        const e = err instanceof AssetError ? err : new AssetError(err instanceof Error ? err.message : String(err));
        this.errors.set(asset.id, e);
        this.emit(asset.id);
        throw e;
      });
    this.loading.set(asset.id, p);
    this.emit(asset.id);
    return p;
  }

  /** Register an already-decoded buffer (fresh recording / import). */
  put(assetId: string, buffer: AudioBuffer) {
    this.decoded.set(assetId, { buffer, bytes: bufBytes(buffer), lastUsed: performance.now() });
    this.errors.delete(assetId);
    this.emit(assetId);
    this.computePeaks(assetId, buffer);
  }

  private computePeaks(assetId: string, buffer: AudioBuffer) {
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
    computePeaksInWorker(channels)
      .then((levels) => {
        this.peaks.set(assetId, levels);
        this.emit(assetId);
      })
      .catch((err: unknown) => console.warn('[daw] waveform peaks failed', err));
  }

  private async fetchAndDecode(asset: AudioAssetInfo): Promise<AudioBuffer> {
    if (asset.ref.kind === 'user') {
      const row = await idbGet<StoredAsset>('assets', asset.ref.assetId);
      if (!row) throw new AssetError(`The recording or imported file "${asset.name}" is not on this computer.`, true);
      return this.decode(await row.blob.arrayBuffer(), asset.name);
    }
    if (!this.catalog) throw new AssetError('Loop library is not available.', true);
    const entry = await this.catalog.getEntry(asset.ref.assetId);
    if (!entry) throw new AssetError(`The loop "${asset.name}" is no longer in the library.`, true);
    const bytes = await this.fetchLibrary(this.catalog.url(entry.audio));
    const buf = await this.decode(bytes, asset.name);
    return this.gaplessTrim(buf, entry);
  }

  async fetchLibrary(url: string): Promise<ArrayBuffer> {
    let cache: Cache | null = null;
    try {
      cache = typeof caches !== 'undefined' ? await caches.open(AUDIO_CACHE_NAME) : null;
      const hit = await cache?.match(url);
      if (hit) return await hit.arrayBuffer();
    } catch (err) {
      console.warn('[daw] audio cache unavailable', err);
    }
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new AssetError('Could not download audio. Check the internet connection and try again.');
    }
    if (!res.ok) throw new AssetError(`Audio download failed (HTTP ${res.status}).`, res.status === 404);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > MAX_FETCH_BYTES) throw new AssetError('Audio file is too large.');
    const body = await res.arrayBuffer();
    if (cache) {
      cache.put(url, new Response(body.slice(0), { headers: { 'content-type': res.headers.get('content-type') ?? 'audio/mpeg' } })).catch(() => {
        /* quota exceeded: playback still works from memory */
      });
    }
    return body;
  }

  async decode(bytes: ArrayBuffer, name: string): Promise<AudioBuffer> {
    try {
      return await this.ctx.decodeAudioData(bytes);
    } catch {
      throw new AssetError(`"${name}" could not be decoded. It may be damaged or in an unsupported format.`);
    }
  }

  /**
   * MP3 adds encoder priming/padding. Browsers differ on whether decodeAudioData
   * removes it, so we use the exact source length and delay from the catalog.
   */
  private gaplessTrim(buf: AudioBuffer, entry: CatalogEntry): AudioBuffer {
    const k = buf.sampleRate / entry.sampleRate;
    const want = Math.round(entry.frames * k);
    const delay = Math.round(entry.encoderDelay * k);
    const extra = buf.length - want;
    if (extra <= 2) return buf; // browser already trimmed
    const start = extra >= delay * 0.9 && buf.length >= delay + want ? delay : 0;
    const out = this.ctx.createBuffer(buf.numberOfChannels, want, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      out.copyToChannel(buf.getChannelData(c).subarray(start, start + want), c);
    }
    return out;
  }

  // ------------------------------------------------------------- processing

  getProcessed(assetId: string, spec: ProcessSpec): AudioBuffer | undefined {
    const e = this.processed.get(processKey(assetId, spec, this.quality));
    if (e) e.lastUsed = performance.now();
    return e?.buffer;
  }

  processingProgress(assetId: string, spec: ProcessSpec): number | null {
    return this.processing.get(processKey(assetId, spec, this.quality))?.progress ?? null;
  }

  /** Ensure a processed (stretched / pitched / reversed) variant exists. */
  requestProcessed(assetId: string, spec: ProcessSpec): Promise<AudioBuffer> {
    const key = processKey(assetId, spec, this.quality);
    const have = this.processed.get(key);
    if (have) return Promise.resolve(have.buffer);
    const src = this.peek(assetId);
    if (!src) return Promise.reject(new AssetError('Source audio is not loaded yet.'));
    const existing = this.processing.get(key) as ({ promise?: Promise<AudioBuffer> } & { abort: AbortController; progress: number }) | undefined;
    if (existing?.promise) return existing.promise;
    const abort = new AbortController();
    const job: { abort: AbortController; progress: number; promise?: Promise<AudioBuffer> } = { abort, progress: 0 };
    this.processing.set(key, job);
    let channels = Array.from({ length: src.numberOfChannels }, (_, c) => src.getChannelData(c));
    if (spec.reversed) channels = channels.map((ch) => ch.slice().reverse());
    const needsStretch = Math.abs(spec.ratio - 1) > 1e-4 || spec.semitones !== 0;
    const work = needsStretch
      ? this.stretch.process(channels, { ratio: spec.ratio, semitones: spec.semitones, quality: this.quality, sampleRate: src.sampleRate }, abort.signal, (f) => {
          job.progress = f;
          this.emit(assetId);
        })
      : Promise.resolve(channels);
    job.promise = work
      .then((out) => {
        const buffer = this.ctx.createBuffer(out.length, out[0].length, src.sampleRate);
        out.forEach((ch, c) => buffer.copyToChannel(ch as Float32Array<ArrayBuffer>, c));
        this.processed.set(key, { buffer, bytes: bufBytes(buffer), lastUsed: performance.now() });
        this.processing.delete(key);
        this.evict();
        this.emit(assetId);
        return buffer;
      })
      .catch((err: unknown) => {
        this.processing.delete(key);
        this.emit(assetId);
        throw err;
      });
    return job.promise;
  }

  /** Cancel processing jobs that are no longer needed. */
  cancelProcessingExcept(keep: Set<string>) {
    for (const [key, job] of this.processing) {
      if (!keep.has(key)) {
        job.abort.abort();
        this.processing.delete(key);
      }
    }
  }

  // ------------------------------------------------------------- memory

  memoryUsage() {
    let decoded = 0;
    let processed = 0;
    for (const e of this.decoded.values()) decoded += e.bytes;
    for (const e of this.processed.values()) processed += e.bytes;
    return { decoded, processed, decodedCount: this.decoded.size, processedCount: this.processed.size };
  }

  private evict() {
    const run = (map: Map<string, DecodedEntry>, budget: number, isPinned: (k: string) => boolean) => {
      let total = 0;
      for (const e of map.values()) total += e.bytes;
      if (total <= budget) return;
      const victims = [...map.entries()].filter(([k]) => !isPinned(k)).sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      for (const [k, e] of victims) {
        if (total <= budget) break;
        map.delete(k);
        total -= e.bytes;
      }
    };
    run(this.decoded, DECODED_BUDGET, (k) => this.pinned.has(k));
    run(this.processed, PROCESSED_BUDGET, (k) => this.pinned.has(k.split('|')[0]) && performance.now() - (this.processed.get(k)?.lastUsed ?? 0) < 60000);
  }

  dispose() {
    for (const j of this.processing.values()) j.abort.abort();
    this.stretch.dispose();
    this.decoded.clear();
    this.processed.clear();
  }
}
