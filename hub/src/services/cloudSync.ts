/**
 * Cloud sync and PIN lock for the Hub (server side: hub/server/hubCloud.mjs).
 *
 * Every Hub value lives in localStorage under an `mth_` key, which keeps screens instant and
 * offline-friendly. This module mirrors those keys to the cloud:
 *   - a save marks its key pending; pending keys upload shortly after (and again on the next
 *     launch if the device was offline), so a change made on one device reaches the others;
 *   - pull() downloads the cloud copy on unlock and whenever the tab comes back into view.
 * The newest save of a key wins. Keys still waiting to upload are never overwritten by a pull.
 */

const TOKEN_KEY = 'mth_hub_token';
const PENDING_KEY = 'mth_sync_pending';
const LAST_SYNC_KEY = 'mth_hub_last_sync';
const LOCAL_ONLY = new Set([TOKEN_KEY, PENDING_KEY, LAST_SYNC_KEY]);
const UPLOAD_DELAY_MS = 1000;
const PULL_INTERVAL_MS = 2 * 60 * 1000;

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSync: number | null;
  pendingCount: number;
}

type Listener = () => void;

export class LockedError extends Error {}

const isSyncedKey = (key: string) => key.startsWith('mth_') && !LOCAL_ONLY.has(key);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

class CloudSync {
  private dataListeners = new Set<Listener>();
  private stateListeners = new Set<Listener>();
  private lockListeners = new Set<Listener>();
  // key -> change counter, so a save made while that key is uploading is not lost
  private pending: Record<string, number> = readJson(PENDING_KEY, {});
  private uploadTimer: ReturnType<typeof setTimeout> | null = null;
  private uploading = false;
  private started = false;
  private state: SyncState = {
    status: 'synced',
    lastSync: readJson<number | null>(LAST_SYNC_KEY, null),
    pendingCount: Object.keys(this.pending).length
  };

  // ---- subscriptions ----

  /** Called after a pull changed local data, so screens can reload from storage. */
  onDataChange(listener: Listener): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onStateChange(listener: Listener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /** Called when the server says this device is no longer unlocked. */
  onLocked(listener: Listener): () => void {
    this.lockListeners.add(listener);
    return () => this.lockListeners.delete(listener);
  }

  getState(): SyncState {
    return this.state;
  }

  private setState(updates: Partial<SyncState>) {
    this.state = { ...this.state, ...updates, pendingCount: Object.keys(this.pending).length };
    this.stateListeners.forEach((l) => l());
  }

  // ---- auth ----

  getToken(): string {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  private setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private handleLocked() {
    localStorage.removeItem(TOKEN_KEY);
    this.lockListeners.forEach((l) => l());
  }

  /** fetch() with this device's Hub session attached. Throws LockedError when signed out. */
  async hubFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const token = this.getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    const res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
      this.handleLocked();
      throw new LockedError('Please unlock the Hub with your PIN.');
    }
    return res;
  }

  private async api<T>(path: string, method = 'GET', body?: unknown, signedIn = true): Promise<T> {
    const init: RequestInit = {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    };
    const res = signedIn ? await this.hubFetch(path, init) : await fetch(path, init);
    const data = await res.json().catch(() => ({ ok: false, error: `Server error (${res.status})` }));
    if (!res.ok || !data.ok) throw new Error(data.error || `Server error (${res.status})`);
    return data as T;
  }

  async isPinSet(): Promise<boolean> {
    return (await this.api<{ pinSet: boolean }>('/api/hub/status', 'GET', undefined, false)).pinSet;
  }

  async setupPin(masterPin: string, pin: string): Promise<void> {
    const { token } = await this.api<{ token: string }>('/api/hub/setup', 'POST', { masterPin, pin }, false);
    this.setToken(token);
  }

  async login(pin: string): Promise<void> {
    const { token } = await this.api<{ token: string }>('/api/hub/login', 'POST', { pin }, false);
    this.setToken(token);
  }

  async changePin(currentPin: string, newPin: string): Promise<void> {
    const { token } = await this.api<{ token: string }>('/api/hub/change-pin', 'POST', { currentPin, newPin });
    this.setToken(token);
  }

  /**
   * Signs this device out and, once everything has uploaded, clears its local copy so a shared
   * computer keeps nothing behind. Changes that could not upload (offline) are kept on the device.
   */
  async lock(): Promise<void> {
    await this.flush().catch(() => {});
    await this.api('/api/hub/logout', 'POST', {}).catch(() => {});
    if (Object.keys(this.pending).length === 0) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && isSyncedKey(key)) localStorage.removeItem(key);
      }
      localStorage.removeItem(LAST_SYNC_KEY);
      this.state = { ...this.state, lastSync: null };
    }
    this.handleLocked();
  }

  // ---- uploading ----

  /** Records that a key changed locally; it uploads shortly. */
  markDirty(key: string) {
    if (!isSyncedKey(key)) return;
    this.pending[key] = (this.pending[key] || 0) + 1;
    this.savePending();
    this.setState({});
    this.scheduleUpload();
  }

  private savePending() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(this.pending));
    } catch {}
  }

  private scheduleUpload() {
    if (this.uploadTimer) clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => {
      this.uploadTimer = null;
      this.flush().catch(() => {});
    }, UPLOAD_DELAY_MS);
  }

  /** Uploads every pending key now. */
  async flush(): Promise<void> {
    if (this.uploading || !this.hasToken()) return;
    this.uploading = true;
    this.setState({ status: 'syncing' });
    try {
      for (const key of Object.keys(this.pending)) {
        const version = this.pending[key];
        await this.api('/api/hub/sync', 'PUT', { key, value: localStorage.getItem(key) });
        if (this.pending[key] === version) delete this.pending[key];
        this.savePending();
      }
      this.markSynced();
    } catch (err) {
      this.setState({ status: err instanceof LockedError || navigator.onLine ? 'error' : 'offline' });
      throw err;
    } finally {
      this.uploading = false;
    }
    if (Object.keys(this.pending).length) this.scheduleUpload();
  }

  private markSynced() {
    const lastSync = Date.now();
    localStorage.setItem(LAST_SYNC_KEY, JSON.stringify(lastSync));
    this.setState({ status: 'synced', lastSync });
  }

  // ---- downloading ----

  /**
   * Uploads pending changes, then copies the cloud data into localStorage.
   * On a device's first sync, data that exists only on this device is uploaded rather than
   * dropped; after that, a key missing from the cloud was deleted elsewhere and is removed here.
   */
  async pull(): Promise<void> {
    // Decided before flush(), which records a sync time of its own.
    const firstSync = this.state.lastSync === null;
    await this.flush();
    this.setState({ status: 'syncing' });
    let changed = false;
    try {
      const { items } = await this.api<{ items: Record<string, { value: string; updatedAt: number }> }>('/api/hub/sync');

      for (const [key, item] of Object.entries(items)) {
        if (!isSyncedKey(key) || key in this.pending) continue;
        if (localStorage.getItem(key) !== item.value) {
          localStorage.setItem(key, item.value);
          changed = true;
        }
      }

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key || !isSyncedKey(key) || key in items || key in this.pending) continue;
        if (firstSync) {
          this.pending[key] = 1;
        } else {
          localStorage.removeItem(key);
          changed = true;
        }
      }
      this.savePending();
      this.markSynced();
    } catch (err) {
      this.setState({ status: err instanceof LockedError || navigator.onLine ? 'error' : 'offline' });
      throw err;
    }

    if (changed) this.dataListeners.forEach((l) => l());
    if (Object.keys(this.pending).length) await this.flush();
  }

  /** Keeps this device in step: pulls when the tab returns to view, when back online, and every few minutes. */
  start() {
    if (this.started) return;
    this.started = true;
    const refresh = () => {
      if (document.visibilityState === 'visible' && this.hasToken()) this.pull().catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    setInterval(refresh, PULL_INTERVAL_MS);
  }
}

export const cloudSync = new CloudSync();
