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

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
