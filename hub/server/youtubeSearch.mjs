/**
 * YouTube search helper: GET /api/hub/youtube-search?q=<query>
 *
 * YouTube's search page can't be read from the browser (no CORS), so the site fetches it and
 * pulls the video list out of the page's embedded ytInitialData JSON. Runs unchanged on
 * Cloudflare Workers (site) and in Node 18+ (Vite dev middleware): it only uses fetch/Response.
 * Cloudflare caches each query for an hour so repeated classroom searches don't hit YouTube.
 */
const MAX_QUERY = 200;
const MARKER = 'var ytInitialData = ';

const json = (status, body, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });

const text = (t) => t?.runs?.map((r) => r.text).join('') || t?.simpleText || '';

export function parseYouTubeResults(html) {
  const idx = html.indexOf(MARKER);
  if (idx === -1) return [];
  const start = idx + MARKER.length;
  const end = html.indexOf(';</script>', start);
  if (end === -1) return [];

  let data;
  try {
    data = JSON.parse(html.slice(start, end));
  } catch {
    return [];
  }

  const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
  const results = [];
  for (const section of sections) {
    for (const item of section?.itemSectionRenderer?.contents || []) {
      const v = item?.videoRenderer;
      if (!v?.videoId) continue;
      results.push({
        id: v.videoId,
        title: text(v.title) || 'Untitled Video',
        channel: text(v.ownerText) || 'YouTube Channel',
        duration: v.lengthText?.simpleText || '',
        thumbnail: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        views: v.viewCountText?.simpleText || '',
        publishedTime: v.publishedTimeText?.simpleText || '',
      });
    }
  }
  return results;
}

export async function handleYouTubeSearch(request) {
  if (request.method !== 'GET') return json(405, { error: 'Only GET is allowed.' });

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (!q) return json(400, { error: 'Missing q query parameter.' });
  if (q.length > MAX_QUERY) return json(400, { error: 'Search is too long.' });

  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!res.ok) return json(502, { error: `YouTube responded with HTTP ${res.status}` });

    const results = parseYouTubeResults(await res.text());
    if (results.length === 0) return json(502, { error: 'YouTube returned a page without search results.' });
    return json(200, { results }, 3600);
  } catch (err) {
    return json(502, { error: err?.message || 'YouTube search failed.' });
  }
}
