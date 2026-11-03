/**
 * Wikipedia lookup: GET /api/hub/wiki?q=<subject> -> { title, extract, url, image }
 *
 * Finds the best-matching English Wikipedia article and returns its summary (used as source
 * facts so the slide AI writes from real information) and its main picture (usually the exact
 * right image for a named composer, instrument or place). No key needed; cached for a week.
 */
const MAX_QUERY = 150;
const USER_AGENT = 'MusicTeacherHub/1.0 (https://mrarthurmusic.com/Hub/)';

const json = (body, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });

const get = (url) =>
  fetch(url, { headers: { 'User-Agent': USER_AGENT }, cf: { cacheTtl: 604800, cacheEverything: true } });

export async function handleWikipedia(request) {
  if (request.method !== 'GET') return json({ ok: false, error: 'Only GET is allowed.' }, 405);
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (!q) return json({ ok: false, error: 'Missing q.' }, 400);
  if (q.length > MAX_QUERY) return json({ ok: false, error: 'Search is too long.' }, 400);

  try {
    const search = new URL('https://en.wikipedia.org/w/api.php');
    Object.entries({ action: 'query', list: 'search', srsearch: q, srlimit: '3', format: 'json' }).forEach(([k, v]) =>
      search.searchParams.set(k, v)
    );
    const found = await (await get(search)).json();
    for (const hit of found?.query?.search || []) {
      const res = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`);
      if (!res.ok) continue;
      const page = await res.json();
      if (page.type === 'disambiguation' || !page.extract) continue;
      const img = page.originalimage || page.thumbnail;
      return json(
        {
          ok: true,
          title: page.title,
          extract: String(page.extract).slice(0, 2000),
          url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
          image: img?.source ? { url: img.source.split('?')[0], width: img.width || 0, height: img.height || 0 } : null,
        },
        200,
        604800
      );
    }
    return json({ ok: true, title: null }, 200, 86400);
  } catch (err) {
    return json({ ok: false, error: err?.message || 'Wikipedia lookup failed.' }, 502);
  }
}
