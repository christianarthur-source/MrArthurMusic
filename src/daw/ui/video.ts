import { createAudioRegion } from '../model/factory';
import * as ops from '../model/ops';
import { secondsToTicks, ticksToSeconds } from '../model/time';
import { AudioAssetInfo, AudioRegion, Project } from '../model/types';
import { loadUserBlob, MAX_VIDEO_BYTES, saveUserVideo } from '../persistence/projectRepo';
import { Studio } from './studio';

/**
 * Scoring to video. The audio engine's clock is the master: the <video> element only
 * follows it (see useVideoSync in VideoTrack.tsx), so music and picture never drift apart.
 */

export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm';

/** The linked audio clip (the video's own sound), if it is still on the timeline. */
export function linkedAudioRegion(p: Project): AudioRegion | undefined {
  const v = p.video;
  if (!v?.audioTrackId || !v.assetId) return undefined;
  return p.regions.find((r): r is AudioRegion => r.kind === 'audio' && r.trackId === v.audioTrackId && r.assetId === `usr:${v.assetId}`);
}

/** Song time (seconds) at which the video's first frame plays. Follows the linked audio clip. */
export function videoStartSec(p: Project): number {
  const v = p.video;
  if (!v) return 0;
  const r = linkedAudioRegion(p);
  if (r) return ticksToSeconds(p.tempoMap, r.start) - r.sourceOffsetSec;
  return ticksToSeconds(p.tempoMap, v.startTick);
}

const urls = new Map<string, string>();
const restored = new Set<() => void>();
/** Notified when a missing video file was downloaded again (so players reload it). */
export function onVideoRestored(fn: () => void) {
  restored.add(fn);
  return () => void restored.delete(fn);
}
/** A playable URL for the project's video (object URLs are cached per stored file). */
export async function videoUrl(p: Project): Promise<string | null> {
  const v = p.video;
  if (!v) return null;
  if (v.src) return v.src;
  if (!v.assetId) return null;
  const hit = urls.get(v.assetId);
  if (hit) return hit;
  const blob = await loadUserBlob(v.assetId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(v.assetId, url);
  return url;
}

/** Reads a video's size and length; fails when this browser cannot play the format. */
export function probeVideo(url: string): Promise<{ durationSec: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const done = () => {
      el.removeAttribute('src');
      el.load();
    };
    el.onloadedmetadata = () => {
      const r = { durationSec: el.duration, width: el.videoWidth, height: el.videoHeight };
      done();
      if (!Number.isFinite(r.durationSec) || !r.width) reject(new Error('This video could not be read.'));
      else resolve(r);
    };
    el.onerror = () => {
      done();
      reject(new Error('This browser cannot play that video format. Please use an MP4 (H.264) video.'));
    };
    el.src = url;
  });
}

/** Seconds between preview frames on the video track (about 40 frames per video). */
export const thumbStep = (durationSec: number) => Math.max(1, Math.min(10, durationSec / 40));

const thumbs = new Map<string, Promise<string[]>>();
/** Small JPEG frames every `step` seconds for the video track (cached per video). */
export function videoThumbnails(url: string, durationSec: number, step: number, onProgress?: (f: number) => void): Promise<string[]> {
  const key = `${url}|${step}`;
  let job = thumbs.get(key);
  if (!job) {
    job = (async () => {
      const el = document.createElement('video');
      el.muted = true;
      el.preload = 'auto';
      el.src = url;
      await new Promise<void>((res, rej) => {
        el.onloadeddata = () => res();
        el.onerror = () => rej(new Error('video'));
      });
      const h = 54;
      const w = Math.round((h * el.videoWidth) / el.videoHeight) || 96;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      const out: string[] = [];
      for (let t = 0; t < durationSec; t += step) {
        el.currentTime = Math.min(t + 0.05, durationSec - 0.05);
        await new Promise<void>((res) => {
          el.onseeked = () => res();
        });
        g.drawImage(el, 0, 0, w, h);
        out.push(c.toDataURL('image/jpeg', 0.6));
        onProgress?.(Math.min(1, (t + step) / durationSec));
      }
      el.removeAttribute('src');
      el.load();
      return out;
    })();
    thumbs.set(key, job);
    job.catch(() => thumbs.delete(key));
  }
  return job;
}

/**
 * Add (or replace) the song's video. With `withAudio`, its sound becomes a clip on a
 * "Video sound" track (linked: moving the clip moves the video).
 */
export async function addVideo(s: Studio, source: File | string, withAudio: boolean): Promise<boolean> {
  try {
    return await addVideoSteps(s, source, withAudio);
  } finally {
    s.ui.set({ task: null });
  }
}

async function addVideoSteps(s: Studio, source: File | string, withAudio: boolean): Promise<boolean> {
  const fromLink = typeof source === 'string';
  const steps = (withAudio ? 4 : 3) + (fromLink ? 1 : 0);
  let step = 0;
  const task = (label: string, progress: number | null) => s.ui.set({ task: { label: `Step ${step} of ${steps}: ${label}`, progress } });
  let file: File;
  if (fromLink) {
    step++;
    task('downloading the video…', null);
    try {
      file = await downloadVideoLink(source, (f) => task('downloading the video…', f));
    } catch (err) {
      s.ui.toast('error', err instanceof Error ? err.message : String(err));
      return false;
    }
  } else file = source;
  step++;
  task('checking the video…', null);
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 60) || 'Video';
  const tmp = URL.createObjectURL(file);
  let meta: { durationSec: number; width: number; height: number };
  try {
    meta = await probeVideo(tmp);
  } catch (err) {
    s.ui.toast('error', err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    URL.revokeObjectURL(tmp);
  }
  if (meta.durationSec > 15 * 60) {
    s.ui.toast('error', 'Videos longer than 15 minutes are not supported. Try a shorter clip.');
    return false;
  }
  let assetId: string;
  step++;
  task('saving it on this computer…', null);
  try {
    assetId = await saveUserVideo(file, file.name);
  } catch (err) {
    s.ui.toast('error', err instanceof Error ? err.message : 'The video could not be saved on this computer.');
    return false;
  }
  let audio: { info: AudioAssetInfo; buffer: AudioBuffer } | null = null;
  if (withAudio) {
    step++;
    task('reading the video’s sound…', null);
    try {
      const buffer = await s.engine.assets.decode(await file.arrayBuffer(), name);
      const info: AudioAssetInfo = { id: `usr:${assetId}`, ref: { kind: 'user', assetId }, name: `${name} (sound)`, durationSec: buffer.duration, sampleRate: buffer.sampleRate, channels: Math.min(2, buffer.numberOfChannels) };
      s.engine.assets.put(info.id, buffer);
      audio = { info, buffer };
    } catch {
      s.ui.toast('info', 'This video has no sound we can use, so only the picture was added.');
    }
  }
  s.store.exec(s.store.get().video ? 'Replace video' : 'Add video', (p) => {
    let proj = withoutVideo(p, true);
    let audioTrackId: string | undefined;
    if (audio) {
      const r = ops.addTrack(proj, 'audio', 'Video sound', undefined, 0);
      proj = r.project;
      audioTrackId = r.track.id;
      const length = Math.max(1, Math.round(secondsToTicks(proj.tempoMap, audio.info.durationSec)));
      const region = createAudioRegion({ trackId: audioTrackId, name: audio.info.name, start: 0, length, loopLength: length, assetId: audio.info.id, stretch: 'off' });
      proj = ops.addRegions(proj, [region], [audio.info]);
    }
    return { ...proj, video: { assetId, name, durationSec: meta.durationSec, width: meta.width, height: meta.height, startTick: 0, audioTrackId, link: fromLink ? source : undefined } };
  });
  // Make the timeline preview frames now, so the student sees them being made.
  step++;
  task('making preview pictures…', 0);
  const url = await videoUrl(s.store.get());
  if (url) await videoThumbnails(url, meta.durationSec, thumbStep(meta.durationSec), (f) => task('making preview pictures…', f)).catch(() => undefined);
  s.engine.seek(0);
  s.ui.set({ videoWindow: true });
  s.ui.toast('success', `Added "${name}". Press Play to score it, or open Theater Mode to watch it big.`);
  return true;
}

/** The project without its video; `dropAudio` also removes the linked sound track. */
function withoutVideo(p: Project, dropAudio: boolean): Project {
  if (!p.video) return p;
  const proj = dropAudio && p.video.audioTrackId ? ops.removeTracks(p, [p.video.audioTrackId]) : p;
  const { video: _drop, ...rest } = proj; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

/** Fix the video's start where it is now and stop following the sound clip. */
function unlinked(p: Project): Project {
  if (!p.video) return p;
  return { ...p, video: { ...p.video, startTick: Math.max(0, Math.round(secondsToTicks(p.tempoMap, Math.max(0, videoStartSec(p))))), audioTrackId: undefined } };
}

export function removeVideo(s: Studio) {
  s.store.exec('Remove video', (p) => withoutVideo(p, true));
  s.ui.set({ theater: false });
}

/** The video's sound becomes an ordinary audio track the student can edit freely. */
export function detachVideoSound(s: Studio) {
  s.store.exec('Detach video sound', (p) => {
    const id = p.video?.audioTrackId;
    const proj = unlinked(p);
    return id ? ops.updateTrack(proj, id, { name: `${p.video!.name} sound`.slice(0, 30) }) : proj;
  });
  s.ui.toast('info', 'The video sound is now a normal audio track. Moving it no longer moves the video.');
}

export function removeVideoSound(s: Studio) {
  s.store.exec('Remove video sound', (p) => {
    const id = p.video?.audioTrackId;
    const proj = unlinked(p);
    return id ? ops.removeTracks(proj, [id]) : proj;
  });
}

export function toggleVideoSoundMute(s: Studio) {
  const p = s.store.get();
  const t = p.tracks.find((x) => x.id === p.video?.audioTrackId);
  if (t) s.store.exec(t.mute ? 'Unmute video sound' : 'Mute video sound', (x) => ops.updateTrack(x, t.id, { mute: !t.mute }));
}

/** Jump to the video's first frame. */
export function seekToVideoStart(s: Studio) {
  const p = s.store.get();
  s.engine.seek(Math.max(0, Math.round(secondsToTicks(p.tempoMap, Math.max(0, videoStartSec(p))))));
}

// ------------------------------------------------------------------ video links

/** Where the site's Google Drive download helper lives (a Cloudflare Worker route; a Vite middleware in dev). */
export const DRIVE_PROXY = '/api/drive-video';

/**
 * Understands the links a teacher or student might paste. Google Drive links go through the
 * site's helper (Drive does not let web pages download its files directly); other https
 * links are fetched directly and work when that server allows it (e.g. the site itself).
 */
export function parseVideoLink(raw: string): { drive: string } | { direct: string } | { error: string } {
  const text = raw.trim();
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { error: 'That doesn’t look like a link. Copy the whole link (starting with https://) and paste it here.' };
  }
  if (u.protocol !== 'https:' && u.origin !== window.location.origin) return { error: 'Only secure (https://) links work.' };
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'drive.google.com' || host === 'drive.usercontent.google.com' || host === 'docs.google.com') {
    const id = /\/file\/d\/([A-Za-z0-9_-]{10,100})/.exec(u.pathname)?.[1] ?? u.searchParams.get('id');
    if (!id || !/^[A-Za-z0-9_-]{10,100}$/.test(id)) return { error: 'That Google Drive link doesn’t point to a file. In Drive, choose Share → Copy link on the video itself.' };
    return { drive: id };
  }
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com)$/.test(host)) {
    return { error: 'Videos from YouTube and similar sites can’t be added (they don’t allow downloads). Use a Google Drive link or a video file instead.' };
  }
  return { direct: u.href };
}

/** Downloads a video link to a File, reporting progress (0..1, or null when the size is unknown). */
export async function downloadVideoLink(link: string, onProgress: (f: number | null) => void): Promise<File> {
  const parsed = parseVideoLink(link);
  if ('error' in parsed) throw new Error(parsed.error);
  const url = 'drive' in parsed ? `${DRIVE_PROXY}?id=${encodeURIComponent(parsed.drive)}` : parsed.direct;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('drive' in parsed ? 'Could not reach the video download helper. Check the internet connection and try again.' : 'That website doesn’t allow its videos to be downloaded here. Try a Google Drive link, or download the video and use “From this computer”.');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !/^(video\/|application\/octet-stream)/.test(type)) {
    let msg = '';
    if (type.includes('json')) msg = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? '';
    else if ('drive' in parsed && type.includes('text/html') && res.ok) msg = 'Google Drive video links aren’t set up on this site yet. Download the video and use “From this computer” for now.';
    throw new Error(msg || ('drive' in parsed ? 'Google Drive didn’t send the video. Make sure it is shared as “Anyone with the link”, then try again.' : 'That link isn’t a video file.'));
  }
  const total = Number(res.headers.get('content-length')) || 0;
  if (total > MAX_VIDEO_BYTES) throw new Error('That video is too large (limit 300 MB). Try a shorter clip or a smaller (720p) version.');
  const name = decodeURIComponent(/filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? '') || ('drive' in parsed ? 'Drive video.mp4' : u2name(parsed.direct));
  const reader = res.body?.getReader();
  if (!reader) return new File([await res.blob()], name, { type: type.startsWith('video/') ? type : 'video/mp4' });
  const chunks: Uint8Array[] = [];
  let got = 0;
  onProgress(total ? 0 : null);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (got > MAX_VIDEO_BYTES) {
      void reader.cancel();
      throw new Error('That video is too large (limit 300 MB). Try a shorter clip or a smaller (720p) version.');
    }
    if (total) onProgress(got / total);
  }
  return new File(chunks as BlobPart[], name, { type: type.startsWith('video/') ? type : 'video/mp4' });
}

function u2name(href: string): string {
  return decodeURIComponent(new URL(href).pathname.split('/').pop() || 'video.mp4');
}

/**
 * The song's video file is not on this computer (e.g. a classmate's copy of a teacher's
 * assignment) but its link is known: download it again under the same id, so the picture
 * and its linked sound come back exactly as they were.
 */
let restoring: Promise<boolean> | null = null;
export function restoreVideoFromLink(s: Studio): Promise<boolean> {
  restoring ??= restoreOnce(s).finally(() => (restoring = null)); // one download at a time
  return restoring;
}

async function restoreOnce(s: Studio): Promise<boolean> {
  const v = s.store.get().video;
  if (!v?.link || !v.assetId) return false;
  try {
    const file = await downloadVideoLink(v.link, (f) => s.ui.set({ task: { label: `Downloading the video “${v.name}”…`, progress: f } }));
    await saveUserVideo(file, file.name, v.assetId);
    urls.delete(v.assetId);
    const sound = s.store.get().assets[`usr:${v.assetId}`];
    if (sound) await s.engine.assets.load(sound).catch(() => undefined);
    for (const fn of restored) fn();
    s.ui.toast('success', `Downloaded the video “${v.name}”.`);
    return true;
  } catch (err) {
    s.ui.toast('error', err instanceof Error ? err.message : String(err));
    return false;
  } finally {
    s.ui.set({ task: null });
  }
}
