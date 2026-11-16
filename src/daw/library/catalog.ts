import { CatalogEntry, CatalogManifest } from './catalogTypes';
import { LibraryQuery, LibraryResult } from './searchCore';
export type { LibraryRow } from './searchCore';

/**
 * Main-thread client for the catalog worker. Holds only result pages and a
 * small entry cache, never the whole catalog.
 */

type Listener = () => void;

export class LibraryCatalog {
  readonly root: string;
  manifest: CatalogManifest | null = null;
  loaded = 0;
  error: string | null = null;
  private worker!: Worker;
  private reqId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, CatalogEntry>();
  private listeners = new Set<Listener>();

  constructor(root = '/daw-library/') {
    this.root = new URL(root, location.href).href;
    this.startWorker();
  }

  private startWorker() {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./search.worker.ts', import.meta.url), { type: 'module' });
    } catch (e) {
      this.fail((e as Error)?.message || 'Loop library failed to start.');
      return;
    }
    this.worker = worker;
    worker.onmessage = (ev) => this.onMessage(ev.data);
    worker.onerror = (ev) => this.fail(ev.message || 'Loop library failed to start.');
    worker.postMessage({ type: 'init', root: this.root });
  }

  /** The worker died or never started: remember why and reject everything waiting on it (they used to wait forever). */
  private fail(message: string) {
    this.error = message;
    for (const p of this.pending.values()) p.reject(new Error(message));
    this.pending.clear();
    this.emit();
  }

  /** Start over after a failure (the Retry button). Cached entries are kept. */
  retry() {
    try {
      this.worker?.terminate();
    } catch {
      /* already gone */
    }
    this.error = null;
    this.loaded = 0;
    this.manifest = null;
    this.emit();
    this.startWorker();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const l of this.listeners) l();
  }

  private onMessage(m: { type: string; [k: string]: unknown }) {
    if (m.type === 'manifest') {
      this.manifest = m.manifest as CatalogManifest;
      this.emit();
    } else if (m.type === 'progress') {
      this.loaded = m.loaded as number;
      this.emit();
    } else if (m.type === 'error') {
      this.fail(m.message as string);
    } else if (m.type === 'result' || m.type === 'reqError') {
      const p = this.pending.get(m.reqId as number);
      if (!p) return;
      this.pending.delete(m.reqId as number);
      if (m.type === 'result') p.resolve(m.result);
      else p.reject(new Error(m.message as string));
    }
  }

  private request<T>(msg: Record<string, unknown>): Promise<T> {
    if (this.error) return Promise.reject(new Error(this.error));
    const reqId = ++this.reqId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(reqId, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ ...msg, reqId });
    });
  }

  async query(q: LibraryQuery): Promise<LibraryResult> {
    const res = await this.request<LibraryResult>({ type: 'query', query: q });
    for (const e of res.rows) this.cache.set(e.id, e);
    return res;
  }

  async getEntries(ids: string[]): Promise<(CatalogEntry | null)[]> {
    const missing = ids.filter((id) => !this.cache.has(id));
    if (missing.length) {
      const got = await this.request<(CatalogEntry | null)[]>({ type: 'get', ids: missing });
      got.forEach((e) => e && this.cache.set(e.id, e));
    }
    return ids.map((id) => this.cache.get(id) ?? null);
  }

  async getEntry(id: string): Promise<CatalogEntry | null> {
    return (await this.getEntries([id]))[0];
  }

  cached(id: string): CatalogEntry | undefined {
    return this.cache.get(id);
  }

  url(rel: string): string {
    const u = new URL(rel, this.root);
    if (u.origin !== new URL(this.root).origin) throw new Error('Refusing to load library audio from another site.');
    return u.href;
  }

  dispose() {
    this.worker.terminate();
  }
}
