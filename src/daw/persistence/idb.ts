/**
 * Minimal promise wrapper over IndexedDB. Stores:
 *   projects : { id, title, updatedAt, json }       project documents (no audio)
 *   assets   : { id, blob, name, mime, createdAt }  user audio (recordings/imports), original bytes
 *   kv       : { key, value }                       favorites, recents, settings
 * Large audio is never put in localStorage.
 */

const DB_NAME = 'mrarthur-daw';
const DB_VERSION = 1;

export interface StoredProject {
  id: string;
  title: string;
  updatedAt: string;
  json: string;
  /** Present for crash-recovery snapshots that were never explicitly saved. */
  autosave?: boolean;
}

export interface StoredAsset {
  id: string;
  blob: Blob;
  name: string;
  mime: string;
  createdAt: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support local saving (IndexedDB unavailable).'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error ?? new Error('Could not open local storage.'));
    };
    req.onblocked = () => reject(new Error('Local storage is blocked by another open tab of the studio.'));
  });
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export async function idbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return wrap((await store(storeName, 'readonly')).get(key)) as Promise<T | undefined>;
}

export async function idbPut<T>(storeName: string, value: T): Promise<void> {
  const s = await store(storeName, 'readwrite');
  await wrap(s.put(value));
  await new Promise<void>((resolve, reject) => {
    s.transaction.oncomplete = () => resolve();
    s.transaction.onerror = () => reject(s.transaction.error);
    s.transaction.onabort = () => reject(s.transaction.error ?? new Error('Save aborted (storage may be full).'));
  });
}

export async function idbDelete(storeName: string, key: string): Promise<void> {
  await wrap((await store(storeName, 'readwrite')).delete(key));
}

export async function idbAll<T>(storeName: string): Promise<T[]> {
  return wrap((await store(storeName, 'readonly')).getAll()) as Promise<T[]>;
}

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await idbGet<{ key: string; value: T }>('kv', key);
    return row ? row.value : fallback;
  } catch {
    return fallback;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await idbPut('kv', { key, value });
}

export async function storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
  return { usage: e.usage ?? 0, quota: e.quota ?? 0, persisted };
}
