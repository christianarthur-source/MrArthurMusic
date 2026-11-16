// Scores are kept in this browser (IndexedDB), with autosave.

export interface StoredScore {
  id: string;
  title: string;
  composer: string;
  mei: string;
  updatedAt: number;
  createdAt: number;
}

const DB = 'mrarthur-prostaff';
const STORE = 'scores';

// One connection is shared by every read and write (autosave used to open a new one each time).
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      const db = req.result;
      // If the browser closes the connection, or another tab needs to upgrade, open again next time.
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('The score storage is busy in another tab.'));
  });
  dbPromise = p;
  p.catch(() => { if (dbPromise === p) dbPromise = null; });
  return p;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try {
      t = db.transaction(STORE, mode);
    } catch (err) {
      dbPromise = null; // stale connection: the next call reopens
      reject(err);
      return;
    }
    const req = fn(t.objectStore(STORE));
    // A write only counts once the whole transaction has been committed, not when the request returns.
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error || req.error);
    t.onabort = () => reject(t.error || req.error || new Error('The save was interrupted.'));
  });
}

export async function listScores(): Promise<Omit<StoredScore, 'mei'>[]> {
  try {
    const all = await tx<StoredScore[]>('readonly', (s) => s.getAll() as IDBRequest<StoredScore[]>);
    return all.map(({ mei: _mei, ...rest }) => rest).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function loadScore(id: string): Promise<StoredScore | null> {
  try {
    return (await tx<StoredScore | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredScore | undefined>)) || null;
  } catch {
    return null;
  }
}

export async function saveScore(rec: StoredScore): Promise<void> {
  await tx('readwrite', (s) => s.put(rec));
  try {
    localStorage.setItem('prostaff:last', rec.id);
  } catch {
    /* ignore */
  }
}

export async function deleteScore(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export function lastOpenedId(): string | null {
  try {
    return localStorage.getItem('prostaff:last');
  } catch {
    return null;
  }
}
