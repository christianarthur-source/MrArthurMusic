/// <reference lib="webworker" />
import { CatalogManifest, CatalogShard } from './catalogTypes';
import { decodeShard, LibraryQuery, SearchIndex } from './searchCore';

/**
 * Catalog worker: fetches the manifest and shards itself (parsing never blocks
 * the UI thread), builds the index progressively and answers queries.
 */

type In =
  | { type: 'init'; root: string }
  | { type: 'query'; reqId: number; query: LibraryQuery }
  | { type: 'get'; reqId: number; ids: string[] };

const index = new SearchIndex();
let manifest: CatalogManifest | null = null;
let ready: Promise<void> | null = null;

async function load(root: string) {
  const res = await fetch(new URL('manifest.json', root), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Loop library unavailable (HTTP ${res.status}).`);
  manifest = (await res.json()) as CatalogManifest;
  if (manifest.format !== 'mrdaw-catalog') throw new Error('Loop library manifest has an unknown format.');
  postMessage({ type: 'manifest', manifest });
  for (const s of manifest.shards) {
    const r = await fetch(new URL(s.url, root)); // immutable, hashed URL -> HTTP cache
    if (!r.ok) throw new Error(`Loop library shard failed (HTTP ${r.status}).`);
    index.add(decodeShard((await r.json()) as CatalogShard));
    postMessage({ type: 'progress', loaded: index.entries.length, total: manifest.count });
  }
}

self.onmessage = async (ev: MessageEvent<In>) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    ready = load(msg.root).catch((err: unknown) => {
      postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      throw err;
    });
    return;
  }
  try {
    if (!ready) throw new Error('Catalog not initialised');
    await ready;
    if (msg.type === 'query') postMessage({ type: 'result', reqId: msg.reqId, result: index.query(msg.query) });
    else if (msg.type === 'get') postMessage({ type: 'result', reqId: msg.reqId, result: msg.ids.map((id) => index.get(id) ?? null) });
  } catch (err) {
    postMessage({ type: 'reqError', reqId: msg.reqId, message: err instanceof Error ? err.message : String(err) });
  }
};
