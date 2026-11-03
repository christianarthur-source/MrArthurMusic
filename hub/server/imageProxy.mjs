/**
 * Image fetcher: GET /api/hub/image-proxy?url=<image address> -> the image bytes
 *
 * Library photos (Wikipedia, Wikimedia Commons, Openverse/Flickr, museum collections) can't be
 * read by the browser directly (no CORS), so the site fetches them. Decks then keep their own
 * copy of each picture, which works offline and exports to PowerPoint. Only images from the
 * listed libraries are passed through, up to MAX_BYTES.
 */
const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_HOSTS = ['wikimedia.org', 'wikipedia.org', 'staticflickr.com', 'flickr.com', 'openverse.org', 'metmuseum.org', 'loc.gov', 'img.youtube.com', 'ytimg.com'];

const fail = (status, error) =>
  new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleImageProxy(request) {
  if (request.method !== 'GET') return fail(405, 'Only GET is allowed.');
  let target;
  try {
    target = new URL(new URL(request.url).searchParams.get('url') || '');
  } catch {
    return fail(400, 'That is not a valid image address.');
  }
  const allowed = target.protocol === 'https:' && ALLOWED_HOSTS.some((h) => target.hostname === h || target.hostname.endsWith('.' + h));
  if (!allowed) return fail(400, 'Only images from the built-in photo libraries can be fetched.');

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'MusicTeacherHub/1.0 (https://mrarthurmusic.com/Hub/)' },
      cf: { cacheTtl: 604800, cacheEverything: true },
    });
    const type = res.headers.get('content-type') || '';
    if (!res.ok) return fail(502, `The image host responded with HTTP ${res.status}`);
    if (!type.startsWith('image/')) return fail(502, 'That address did not return an image.');
    if (Number(res.headers.get('content-length') || 0) > MAX_BYTES) return fail(413, 'That image is too large.');
    const body = await res.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return fail(413, 'That image is too large.');
    return new Response(body, { headers: { 'content-type': type, 'cache-control': 'public, max-age=604800' } });
  } catch (err) {
    return fail(502, err?.message || 'Could not fetch that image.');
  }
}
