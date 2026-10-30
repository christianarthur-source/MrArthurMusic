import { newId } from '../model/factory';
import { Project } from '../model/types';
import { validateProject, ValidationResult } from '../model/validate';
import { idbAll, idbDelete, idbGet, idbPut, StoredAsset, StoredProject } from './idb';
import { readZip, writeZip, ZipEntry } from './zip';

/**
 * Local project storage (IndexedDB) and portable project files.
 *
 * File formats:
 *   *.mrdaw.json  project document only (library loops are referenced by id;
 *                 user recordings/imports are NOT included)
 *   *.mrdaw.zip   archive: project.json + audio/<assetId>.<ext> for every user asset
 */

export const MAX_USER_AUDIO_BYTES = 80 * 1024 * 1024;

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await idbAll<StoredProject>('projects');
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProjectLocal(p: Project): Promise<void> {
  await idbPut<StoredProject>('projects', { id: p.id, title: p.title, updatedAt: p.updatedAt, json: JSON.stringify(p) });
}

export async function loadProjectLocal(id: string): Promise<ValidationResult> {
  const row = await idbGet<StoredProject>('projects', id);
  if (!row) throw new Error('That song was not found on this computer.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    throw new Error('This saved song is damaged and cannot be opened.');
  }
  return validateProject(parsed);
}

export async function deleteProjectLocal(id: string): Promise<void> {
  await idbDelete('projects', id);
}

export function duplicateProject(p: Project, title?: string): Project {
  const now = new Date().toISOString();
  return { ...p, id: newId('proj'), title: (title ?? `${p.title} (copy)`).slice(0, 60), createdAt: now, updatedAt: now };
}

// ------------------------------------------------------------- user audio

const SAFE_NAME = (s: string) => s.replace(/[^\w\-. ]+/g, '').slice(0, 80) || 'audio';

export async function saveUserAudio(blob: Blob, name: string): Promise<string> {
  if (blob.size > MAX_USER_AUDIO_BYTES) throw new Error('That audio file is too large (limit 80 MB).');
  const id = newId('usr');
  await idbPut<StoredAsset>('assets', { id, blob, name: SAFE_NAME(name), mime: blob.type || 'application/octet-stream', createdAt: new Date().toISOString() });
  return id;
}

export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

/** A student's video file, kept on this computer like recordings (its sound can be an audio asset too). */
export async function saveUserVideo(blob: Blob, name: string, id = newId('usr')): Promise<string> {
  if (blob.size > MAX_VIDEO_BYTES) throw new Error('That video is too large (limit 300 MB). Try a shorter clip or a smaller (720p) version.');
  await idbPut<StoredAsset>('assets', { id, blob, name: SAFE_NAME(name), mime: blob.type || 'video/mp4', createdAt: new Date().toISOString() });
  return id;
}

export async function loadUserBlob(id: string): Promise<Blob | null> {
  return (await idbGet<StoredAsset>('assets', id))?.blob ?? null;
}

export async function userAudioExists(id: string): Promise<boolean> {
  return !!(await idbGet<StoredAsset>('assets', id));
}

/** Remove user audio not referenced by any saved project. Returns bytes freed. */
export async function collectUnusedAudio(): Promise<number> {
  const [projects, assets] = await Promise.all([idbAll<StoredProject>('projects'), idbAll<StoredAsset>('assets')]);
  const used = new Set<string>();
  for (const p of projects) for (const m of p.json.matchAll(/"assetId":"(usr_[A-Za-z0-9]+)"/g)) used.add(m[1]);
  let freed = 0;
  const cutoff = Date.now() - 24 * 3600 * 1000; // keep fresh, unsaved recordings for a day
  for (const a of assets) {
    if (!used.has(a.id) && Date.parse(a.createdAt) < cutoff) {
      freed += a.blob.size;
      await idbDelete('assets', a.id);
    }
  }
  return freed;
}

// ------------------------------------------------------------- files

export function projectToJson(p: Project): string {
  return JSON.stringify({ format: 'mrdaw-project', ...p }, null, 1);
}

const EXT: Record<string, string> = { 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'video/mp4': 'mp4', 'video/quicktime': 'mov' };

export async function projectToArchive(p: Project): Promise<Blob> {
  const entries: ZipEntry[] = [{ name: 'project.json', data: new TextEncoder().encode(projectToJson(p)) }];
  const missing: string[] = [];
  const userIds = new Set(Object.values(p.assets).flatMap((a) => (a.ref.kind === 'user' ? [a.ref.assetId] : [])));
  if (p.video?.assetId) userIds.add(p.video.assetId);
  for (const assetId of userIds) {
    const row = await idbGet<StoredAsset>('assets', assetId);
    if (!row) {
      missing.push(assetId);
      continue;
    }
    entries.push({ name: `audio/${assetId}.${EXT[row.mime] ?? 'bin'}`, data: new Uint8Array(await row.blob.arrayBuffer()) });
  }
  if (missing.length) console.warn('[daw] archive is missing audio:', missing);
  return new Blob([writeZip(entries) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

const MAX_PROJECT_FILE = 200 * 1024 * 1024;

/** Import a .json or .zip project file. User audio from archives is stored locally. */
export async function importProjectFile(file: File): Promise<ValidationResult> {
  if (file.size > MAX_PROJECT_FILE) throw new Error('That file is too large to be a project.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!isZip) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error('This file is not a studio project (it is not valid JSON).');
    }
    return validateProject(parsed);
  }
  const entries = readZip(bytes);
  const pj = entries.find((e) => e.name === 'project.json');
  if (!pj) throw new Error('This archive does not contain a project.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(pj.data));
  } catch {
    throw new Error('The project inside this archive is damaged.');
  }
  const result = validateProject(parsed);
  // Store archived audio under its original asset id (ids are validated, names never trusted as paths).
  for (const e of entries) {
    const m = /^audio\/(usr_[A-Za-z0-9]{1,40})\.(wav|mp3|ogg|webm|m4a|flac|mp4|mov|bin)$/.exec(e.name);
    if (!m) continue;
    const mime = Object.entries(EXT).find(([, x]) => x === m[2])?.[0] ?? 'application/octet-stream';
    await idbPut<StoredAsset>('assets', {
      id: m[1],
      blob: new Blob([e.data as Uint8Array<ArrayBuffer>], { type: mime }),
      name: m[1],
      mime,
      createdAt: new Date().toISOString(),
    });
  }
  return result;
}

// ------------------------------------------------------------- autosave

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Debounced autosave. Serializes only after edits pause (1.5 s), in idle time,
 * never on every playback frame. Flushes when the page is hidden/closed.
 */
export class Autosaver {
  status: SaveStatus = 'saved';
  lastError: string | null = null;
  lastSavedAt: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private savedRevision = -1;
  private listeners = new Set<() => void>();
  private onHide = () => {
    if (document.visibilityState === 'hidden') void this.flush();
  };

  constructor(
    private getProject: () => Project,
    private getRevision: () => number,
    private enabled: () => boolean = () => true,
  ) {
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onHide);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private set(s: SaveStatus) {
    this.status = s;
    for (const l of this.listeners) l();
  }

  markSaved() {
    this.savedRevision = this.getRevision();
    this.set('saved');
  }

  notifyChange() {
    if (this.getRevision() === this.savedRevision) return;
    if (this.status !== 'unsaved') this.set('unsaved');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (ric) ric(() => void this.flush(), { timeout: 2000 });
      else void this.flush();
    }, 1500);
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const rev = this.getRevision();
    if (rev === this.savedRevision || !this.enabled()) return;
    this.set('saving');
    try {
      await saveProjectLocal(this.getProject());
      this.savedRevision = rev;
      this.lastSavedAt = Date.now();
      this.lastError = null;
      this.set(this.getRevision() === rev ? 'saved' : 'unsaved');
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.set('error');
    }
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onHide);
  }
}
