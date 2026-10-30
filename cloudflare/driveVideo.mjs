/**
 * Google Drive video download helper: GET /api/drive-video?id=<Drive file id>
 *
 * Google Drive does not let web pages download its files directly (no CORS), so the DAW asks
 * the site to fetch a publicly shared Drive video and pass it through. Runs unchanged on
 * Cloudflare Workers (site) and in Node 18+ (Vite dev middleware): it only uses fetch/Response.
 *
 * Safety: only Drive file ids are accepted (this is not a general proxy), only video
 * responses are passed on, and files over MAX_BYTES are refused. Cloudflare caches the
 * Drive response for an hour, so a whole class opening the same assignment downloads
 * it from Google once.
 */
const MAX_BYTES = 300 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

const json = (status, error) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function handleDriveVideo(request) {
  if (request.method !== 'GET') return json(405, 'Only GET is allowed.');
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!ID_RE.test(id)) return json(400, 'That is not a Google Drive file link.');
  let res;
  try {
    res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, {
      headers: { 'user-agent': 'MrArthurMusic-DAW/1.0' },
      redirect: 'follow',
      cf: { cacheEverything: true, cacheTtl: 3600 }, // Cloudflare only; ignored elsewhere
    });
  } catch {
    return json(502, 'Could not reach Google Drive. Try again in a moment.');
  }
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  if (res.status === 404) return json(404, 'Google Drive could not find that video. Check the link.');
  if (type.includes('text/html')) {
    const page = await res.text().catch(() => '');
    if (/too many users|quota/i.test(page)) return json(429, 'This video is busy on Google Drive (too many downloads today). Try again later, or download it and use “From this computer”.');
    if (/accounts\.google\.com|sign in|request access|you need access/i.test(page)) return json(403, 'That video isn’t shared publicly. In Google Drive, set it to “Anyone with the link”, then try again.');
    return json(502, 'Google Drive didn’t send the video. Make sure the link is to a video shared as “Anyone with the link”.');
  }
  if (!res.ok) return json(502, `Google Drive answered with an error (${res.status}). Try again later.`);
  const disposition = res.headers.get('content-disposition') ?? '';
  const isVideo = type.startsWith('video/') || (type.startsWith('application/octet-stream') && /\.(mp4|m4v|mov|webm)\b/i.test(disposition));
  if (!isVideo) return json(415, 'That Google Drive file isn’t a video (MP4, MOV or WebM).');
  const size = Number(res.headers.get('content-length')) || 0;
  if (size > MAX_BYTES) return json(413, 'That video is too large (limit 300 MB). Try a shorter clip or a smaller (720p) version.');
  const headers = new Headers({ 'content-type': type.startsWith('video/') ? type : 'video/mp4', 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' });
  if (size) headers.set('content-length', String(size));
  if (disposition) headers.set('content-disposition', disposition.replace(/^attachment/i, 'inline'));
  return new Response(res.body, { status: 200, headers });
}
