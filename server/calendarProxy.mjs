/**
 * Calendar feed helper: GET /api/hub/calendar?url=<iCal or webcal link>
 *
 * Google and iCloud calendar feeds can't be read from the browser (no CORS), so the site fetches
 * them and passes the .ics text through. Runs unchanged on Cloudflare Workers (site) and in
 * Node 18+ (Vite dev middleware): it only uses fetch/Response.
 *
 * Safety: only http(s)/webcal links to public hostnames are accepted, only calendar text is
 * passed on, and feeds over MAX_BYTES are refused. Feeds are cached for 15 minutes.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/i;

const json = (status, error) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleCalendarProxy(request) {
  if (request.method !== 'GET') return json(405, 'Only GET is allowed.');

  let target = (new URL(request.url).searchParams.get('url') || '').trim();
  if (!target) return json(400, 'Missing url parameter.');
  if (target.startsWith('webcal://')) target = 'https://' + target.slice('webcal://'.length);

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return json(400, 'That is not a valid calendar link.');
  }
  if (!['https:', 'http:'].includes(targetUrl.protocol) || PRIVATE_HOST.test(targetUrl.hostname)) {
    return json(400, 'Only public calendar links are supported.');
  }

  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'text/calendar, text/plain, */*',
      },
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!res.ok) return json(502, `Remote calendar responded with HTTP ${res.status}`);

    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return json(413, 'That calendar feed is too large.');

    const body = await res.text();
    if (body.length > MAX_BYTES) return json(413, 'That calendar feed is too large.');
    if (!body.includes('BEGIN:VCALENDAR')) return json(502, 'That link did not return a calendar feed.');

    return new Response(body, {
      headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'public, max-age=900' },
    });
  } catch (err) {
    return json(502, err?.message || 'Failed to fetch calendar.');
  }
}
