/**
 * Free-to-use photo search: GET /api/hub/image-search?q=<words> -> { results }
 *
 * Searches Openverse (openly licensed images from Flickr, Wikimedia Commons and others) and,
 * when it is slow, failing or finds nothing, Wikimedia Commons directly. Neither needs a key.
 * Each result carries the creator and license so slides can credit it. Results are cached for
 * a day.
 */
const MAX_QUERY = 200;
const OPENVERSE_TIMEOUT_MS = 5000;
const USER_AGENT = 'MusicTeacherHub/1.0 (https://mrarthurmusic.com/Hub/)';

const json = (body, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });

const stripTags = (html) => String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function searchOpenverse(q) {
  const api = new URL('https://api.openverse.org/v1/images/');
  api.searchParams.set('q', q);
  api.searchParams.set('page_size', '20'); // the most Openverse allows without an account
  api.searchParams.set('mature', 'false');
  const res = await fetch(api, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(OPENVERSE_TIMEOUT_MS),
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!res.ok) throw new Error(`Openverse responded with HTTP ${res.status}`);
  const data = await res.json();
  return (data?.results || [])
    .filter((r) => r?.url && !r.mature)
    .map((r) => ({
      url: r.url,
      thumbnail: r.thumbnail || r.url,
      title: r.title || '',
      creator: r.creator || 'Unknown',
      license: `CC ${String(r.license || '').toUpperCase()}${r.license_version ? ' ' + r.license_version : ''}`.trim(),
      licenseUrl: r.license_url || '',
      sourceUrl: r.foreign_landing_url || r.url,
      width: r.width || 0,
      height: r.height || 0,
    }));
}

async function searchWikimedia(q) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  Object.entries({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filemime:image/jpeg ${q}`, // photos, not charts and diagrams
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1280',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|ObjectName',
  }).forEach(([k, v]) => api.searchParams.set(k, v));
  const res = await fetch(api, { headers: { 'User-Agent': USER_AGENT }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`Wikimedia Commons responded with HTTP ${res.status}`);
  const data = await res.json();
  return Object.values(data?.query?.pages || {})
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .map((p) => {
      const info = p.imageinfo?.[0];
      if (!info?.thumburl) return null;
      const meta = info.extmetadata || {};
      return {
        url: info.thumburl,
        thumbnail: info.thumburl.replace(/\/1280px-/, '/320px-'),
        title: stripTags(meta.ObjectName?.value) || String(p.title || '').replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
        creator: stripTags(meta.Artist?.value).slice(0, 80) || 'Wikimedia Commons',
        license: stripTags(meta.LicenseShortName?.value) || 'See source',
        licenseUrl: meta.LicenseUrl?.value || '',
        sourceUrl: info.descriptionurl || info.url,
        width: info.width || 0,
        height: info.height || 0,
      };
    })
    .filter(Boolean);
}

export async function handleImageSearch(request) {
  if (request.method !== 'GET') return json({ ok: false, error: 'Only GET is allowed.' }, 405);
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (!q) return json({ ok: false, error: 'Missing q.' }, 400);
  if (q.length > MAX_QUERY) return json({ ok: false, error: 'Search is too long.' }, 400);

  // Ask both at once: Openverse's wider collection wins when it answers in time, otherwise the
  // Wikimedia results are already on their way.
  const wikimedia = searchWikimedia(q).catch((err) => err);
  let lastError = '';
  try {
    const results = await searchOpenverse(q);
    if (results.length) return json({ ok: true, results }, 200, 86400);
  } catch (err) {
    lastError = err?.message || String(err);
  }
  const fallback = await wikimedia;
  if (Array.isArray(fallback)) return json({ ok: true, results: fallback }, 200, fallback.length ? 86400 : 3600);
  return json({ ok: false, error: `Photo search failed (${lastError || fallback?.message}).` }, 502);
}
