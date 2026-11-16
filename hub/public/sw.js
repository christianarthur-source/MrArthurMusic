// Offline support for the Hub. Registered with scope /Hub/, so it never touches the rest of
// mrarthurmusic.com. Pages are network-first (fresh when online, cached copy offline); built
// assets under assets/ are cache-first (their filenames change on every build). /api/ calls are never
// cached. Registered only in production builds (see index.html).
const CACHE_NAME = 'music-teacher-hub-v3'; // v3 drops any page that was stored under a script/style URL
const SCOPE = new URL(self.registration.scope);
const INDEX_URL = new URL('index.html', SCOPE).toString();
const STATIC_ASSETS = [SCOPE.toString(), INDEX_URL, new URL('manifest.json', SCOPE).toString()];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

const putInCache = (request, response) => {
  if (response && response.status === 200 && response.type === 'basic') {
    // A missing /assets/x.js can come back as the app's index.html (200, text/html). Caching that
    // under the script's URL would break the app offline, so never store HTML for a non-page request.
    const type = response.headers.get('content-type') || '';
    if (request.mode !== 'navigate' && request.destination !== 'document' && type.includes('text/html')) return response;
    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith(new URL('assets/', SCOPE).pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => putInCache(request, response)))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => putInCache(request, response))
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || (request.mode === 'navigate' ? caches.match(INDEX_URL) : Response.error()))
      )
  );
});
