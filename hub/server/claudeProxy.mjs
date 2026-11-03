/**
 * Claude helper: POST /api/hub/claude  (body = an Anthropic Messages API request)
 *                GET  /api/hub/claude  -> { configured }  does the site have its own Claude key?
 *
 * Forwards lesson-generation requests to Anthropic. Uses the key entered in the Hub's Settings
 * (sent as the x-api-key header) when there is one, otherwise the site's ANTHROPIC_API_KEY Worker
 * secret. Runs unchanged on Cloudflare Workers (site) and in Node 18+ (Vite dev middleware).
 */
const MAX_BODY = 200 * 1024;

const json = (status, error) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleClaudeProxy(request, env = {}) {
  if (request.method === 'GET') {
    return new Response(JSON.stringify({ ok: true, configured: !!env.ANTHROPIC_API_KEY }), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (request.method !== 'POST') return json(405, 'Only POST is allowed.');

  const apiKey = (request.headers.get('x-api-key') || env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return json(400, 'No Claude API key: add ANTHROPIC_API_KEY to the site, or paste a key in the Hub Settings.');

  const body = await request.text();
  if (body.length > MAX_BODY) return json(413, 'Request is too large.');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (err) {
    return json(502, err?.message || 'Claude request failed.');
  }
}
