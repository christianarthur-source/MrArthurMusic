/**
 * Audio Studio library: the audio files you add, kept in this browser's IndexedDB so the
 * playlist is still there next time. Files stay on the device they were added on (they are
 * not part of Hub cloud sync).
 */

const DB_NAME = 'mth-audio-library';
const STORE = 'tracks';

export interface StoredTrack {
  id: string;
  title: string;
  fileType: string;
  source: 'local' | 'uploaded';
  addedAt: number;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Saving the audio file was cancelled.'));
  });
}

/** All saved tracks, oldest first (the order they were added). */
export async function listTracks(): Promise<StoredTrack[]> {
  const all = await run<StoredTrack[]>('readonly', (s) => s.getAll() as IDBRequest<StoredTrack[]>);
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

/** Saves audio files and returns their records. */
export async function addFiles(files: File[], source: StoredTrack['source']): Promise<StoredTrack[]> {
  // Ask the browser not to clear this storage when the device runs low on space.
  navigator.storage?.persist?.().catch(() => {});
  const now = Date.now();
  const tracks = files.map((file, i) => ({
    id: `track-${now.toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
    title: file.name.replace(/\.[^/.]+$/, ''),
    fileType: file.name.split('.').pop()?.toUpperCase() || 'AUDIO',
    source,
    addedAt: now + i,
    blob: file
  }));
  for (const track of tracks) await run('readwrite', (s) => s.put(track));
  return tracks;
}

export async function removeTrack(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
}
