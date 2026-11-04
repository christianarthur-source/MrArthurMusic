/**
 * Stock image search: GET /api/hub/stock-images
 *   ?status=1                                  -> { sources: { pixabay, pexels, unsplash } } (which have keys)
 *   ?source=pixabay|pexels|unsplash&q=<words>  -> { results }
 *     &type=all|photo|illustration|vector  &orientation=any|landscape|square|portrait
 *     &color=<name>  &page=<n>
 *   ?track=<Unsplash download_location>        -> tells Unsplash a photo was used (their API rule)
 *
 * Free libraries with free API keys, kept as Worker secrets so they never reach the browser:
 *   PIXABAY_API_KEY  (photos, illustrations and vector clip art; kid-safe filter on)
 *   PEXELS_API_KEY   (professional photos)
 *   UNSPLASH_ACCESS_KEY (artistic photos; photographer credit and hotlinking required)
 * A source without a key reports configured: false and returns no results. Searches are cached
 * for a day (Pixabay asks for this).
 */
const MAX_QUERY = 100;
const PER_PAGE = 24;

const json = (body, status = 200, cacheSeconds = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheSeconds ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  });

const cached = { cf: { cacheTtl: 86400, cacheEverything: true } };

// Colors offered in the finder, mapped to each library's own names
const COLORS = {
  red: { pixabay: 'red', pexels: 'red', unsplash: 'red' },
  orange: { pixabay: 'orange', pexels: 'orange', unsplash: 'orange' },
  yellow: { pixabay: 'yellow', pexels: 'yellow', unsplash: 'yellow' },
  green: { pixabay: 'green', pexels: 'green', unsplash: 'green' },
  blue: { pixabay: 'blue', pexels: 'blue', unsplash: 'blue' },
  purple: { pixabay: 'lilac', pexels: 'violet', unsplash: 'purple' },
  pink: { pixabay: 'pink', pexels: 'pink', unsplash: 'magenta' },
  brown: { pixabay: 'brown', pexels: 'brown', unsplash: null },
  black: { pixabay: 'black', pexels: 'black', unsplash: 'black' },
  white: { pixabay: 'white', pexels: 'white', unsplash: 'white' },
  gray: { pixabay: 'gray', pexels: 'gray', unsplash: 'black_and_white' },
};

async function searchPixabay(key, { q, type, orientation, color, page }) {
  const url = new URL('https://pixabay.com/api/');
  Object.entries({
    key,
    q: q.slice(0, MAX_QUERY),
    image_type: ['photo', 'illustration', 'vector'].includes(type) ? type : 'all',
    orientation: orientation === 'landscape' ? 'horizontal' : orientation === 'portrait' ? 'vertical' : 'all',
    safesearch: 'true',
    per_page: String(PER_PAGE),
    page: String(page),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  if (COLORS[color]?.pixabay) url.searchParams.set('colors', COLORS[color].pixabay);
  const res = await fetch(url, cached);
  if (!res.ok) throw new Error(`Pixabay responded with HTTP ${res.status}`);
  const data = await res.json();
  return (data.hits || [])
    .filter((h) => orientation !== 'square' || Math.abs(h.imageWidth / h.imageHeight - 1) < 0.25)
    .map((h) => ({
      id: `pixabay-${h.id}`,
      source: 'pixabay',
      kind: String(h.type || '').startsWith('vector') ? 'vector' : h.type === 'illustration' ? 'illustration' : 'photo',
      url: h.largeImageURL || h.webformatURL,
      thumbnail: h.webformatURL || h.previewURL,
      width: h.imageWidth || 0,
      height: h.imageHeight || 0,
      title: String(h.tags || '').split(',').slice(0, 3).join(', '),
      creator: h.user || 'Pixabay',
      creatorUrl: h.user && h.user_id ? `https://pixabay.com/users/${h.user}-${h.user_id}/` : '',
      sourceUrl: h.pageURL || 'https://pixabay.com/',
      license: 'Pixabay License',
    }));
}

async function searchPexels(key, { q, orientation, color, page }) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', q.slice(0, MAX_QUERY));
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('page', String(page));
  if (['landscape', 'portrait', 'square'].includes(orientation)) url.searchParams.set('orientation', orientation);
  if (COLORS[color]?.pexels) url.searchParams.set('color', COLORS[color].pexels);
  const res = await fetch(url, { headers: { Authorization: key }, ...cached });
  if (!res.ok) throw new Error(`Pexels responded with HTTP ${res.status}`);
  const data = await res.json();
  return (data.photos || []).map((p) => ({
    id: `pexels-${p.id}`,
    source: 'pexels',
    kind: 'photo',
    url: p.src?.large2x || p.src?.large || p.src?.original,
    thumbnail: p.src?.medium || p.src?.small,
    width: p.width || 0,
    height: p.height || 0,
    title: p.alt || '',
    creator: p.photographer || 'Pexels',
    creatorUrl: p.photographer_url || '',
    sourceUrl: p.url || 'https://www.pexels.com/',
    license: 'Pexels License',
  }));
}

async function searchUnsplash(key, { q, orientation, color, page }) {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', q.slice(0, MAX_QUERY));
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('page', String(page));
  url.searchParams.set('content_filter', 'high');
  if (orientation === 'landscape' || orientation === 'portrait') url.searchParams.set('orientation', orientation);
  if (orientation === 'square') url.searchParams.set('orientation', 'squarish');
  if (COLORS[color]?.unsplash) url.searchParams.set('color', COLORS[color].unsplash);
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, ...cached });
  if (!res.ok) throw new Error(`Unsplash responded with HTTP ${res.status}`);
  const data = await res.json();
  const ref = 'utm_source=music_teacher_hub&utm_medium=referral';
  return (data.results || []).map((p) => ({
    id: `unsplash-${p.id}`,
    source: 'unsplash',
    kind: 'photo',
    url: p.urls?.regular || p.urls?.full,
    thumbnail: p.urls?.small || p.urls?.thumb,
    width: p.width || 0,
    height: p.height || 0,
    title: p.alt_description || p.description || '',
    creator: p.user?.name || 'Unsplash',
    creatorUrl: p.user?.links?.html ? `${p.user.links.html}?${ref}` : '',
    sourceUrl: p.links?.html ? `${p.links.html}?${ref}` : 'https://unsplash.com/',
    license: 'Unsplash License',
    // Unsplash asks apps to show their image address (hotlink) and report each use
    hotlink: true,
    trackUrl: p.links?.download_location || '',
  }));
}

const SEARCHERS = {
  pixabay: { key: 'PIXABAY_API_KEY', search: searchPixabay },
  pexels: { key: 'PEXELS_API_KEY', search: searchPexels },
  unsplash: { key: 'UNSPLASH_ACCESS_KEY', search: searchUnsplash },
};

export async function handleStockImages(request, env = {}) {
  if (request.method !== 'GET') return json({ ok: false, error: 'Only GET is allowed.' }, 405);
  const params = new URL(request.url).searchParams;

  if (params.get('status')) {
    return json({ ok: true, sources: Object.fromEntries(Object.entries(SEARCHERS).map(([id, s]) => [id, !!env[s.key]])) });
  }

  const track = params.get('track');
  if (track) {
    let target;
    try {
      target = new URL(track);
    } catch {
      return json({ ok: false, error: 'Invalid tracking address.' }, 400);
    }
    if (target.hostname !== 'api.unsplash.com' || !env.UNSPLASH_ACCESS_KEY) return json({ ok: false, error: 'Not an Unsplash download address.' }, 400);
    await fetch(target, { headers: { Authorization: `Client-ID ${env.UNSPLASH_ACCESS_KEY}` } }).catch(() => null);
    return json({ ok: true });
  }

  const source = params.get('source') || '';
  const searcher = SEARCHERS[source];
  if (!searcher) return json({ ok: false, error: 'Unknown image source.' }, 400);
  const key = env[searcher.key];
  if (!key) return json({ ok: true, configured: false, results: [] });

  const q = (params.get('q') || '').trim();
  if (!q) return json({ ok: false, error: 'Missing q.' }, 400);
  if (q.length > MAX_QUERY) return json({ ok: false, error: 'Search is too long.' }, 400);
  const page = Math.min(20, Math.max(1, Number(params.get('page')) || 1));

  try {
    const results = await searcher.search(key, {
      q,
      type: params.get('type') || 'all',
      orientation: params.get('orientation') || 'any',
      color: params.get('color') || '',
      page,
    });
    return json({ ok: true, configured: true, results }, 200, 3600);
  } catch (err) {
    return json({ ok: false, configured: true, error: err?.message || 'Image search failed.' }, 502);
  }
}
