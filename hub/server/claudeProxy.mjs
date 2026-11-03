/**
 * Claude helper: POST /api/hub/claude  (body = an Anthropic Messages API request)
 *
 * Forwards lesson-generation requests to Anthropic using the key the teacher entered in Settings
 * (sent as the x-api-key header). Runs unchanged on Cloudflare Workers (site) and in Node 18+
 * (Vite dev middleware): it only uses fetch/Response.
 */
const MAX_BODY = 200 * 1024;

const json = (status, error) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export async function handleClaudeProxy(request) {
  if (request.method !== 'POST') return json(405, 'Only POST is allowed.');

  const apiKey = (request.headers.get('x-api-key') || '').trim();
  if (!apiKey) return json(400, 'Missing x-api-key header.');

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
