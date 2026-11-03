/**
 * Free AI helper: POST /api/hub/free-ai  { system, prompt, max_tokens? } -> { text, model }
 *                 GET  /api/hub/free-ai  -> { configured }
 *
 * Runs lesson generation on Cloudflare Workers AI through the Worker's `AI` binding (wrangler.jsonc),
 * so there is no API key and it is covered by Workers AI's free daily allowance (10,000 neurons,
 * roughly 20-30 lessons a day with gpt-oss-120b). Requests stay inside Cloudflare.
 * In `npm run dev` there is no binding; set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to use
 * the Workers AI REST API instead.
 */
const MODELS = ['@cf/openai/gpt-oss-120b', '@cf/nvidia/nemotron-3-120b-a12b'];
const MAX_BODY = 100 * 1024;

const reply = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

// Workers AI models answer in different shapes (legacy, chat completions, responses API).
export function extractText(result) {
  if (!result) return '';
  if (typeof result === 'string') return result;
  if (typeof result.response === 'string') return result.response;
  const choice = result.choices?.[0];
  if (choice) return choice.message?.content || choice.text || '';
  if (Array.isArray(result.output)) {
    return result.output
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content || [])
      .map((part) => part.text || '')
      .join('');
  }
  if (typeof result.output_text === 'string') return result.output_text;
  return '';
}

async function runModel(env, model, input) {
  if (env.AI) return env.AI.run(model, input);
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.errors?.[0]?.message || `Workers AI request failed (${res.status})`);
  }
  return json.result;
}

export async function handleFreeAi(request, env = {}) {
  const configured = !!env.AI || !!(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
  if (request.method === 'GET') return reply(200, { ok: true, configured });
  if (request.method !== 'POST') return reply(405, { error: 'Only POST is allowed.' });
  if (!configured) return reply(503, { error: 'Free AI is not set up on this site (no Workers AI binding).' });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return reply(413, { error: 'Request is too large.' });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'Send JSON: { system, prompt }.' });
  }
  const system = String(body.system || '');
  const prompt = String(body.prompt || '').trim();
  if (!prompt) return reply(400, { error: 'Missing prompt.' });
  const max_tokens = Math.min(12000, Math.max(256, Number(body.max_tokens) || 8000));

  const messages = [
    // gpt-oss reads its reasoning effort from the system message.
    { role: 'system', content: `Reasoning: high\n\n${system}` },
    { role: 'user', content: prompt },
  ];

  let lastError = '';
  for (const model of MODELS) {
    try {
      const text = extractText(await runModel(env, model, { messages, max_tokens })).trim();
      if (text) return reply(200, { text, model });
      lastError = `${model} returned an empty answer.`;
    } catch (err) {
      lastError = err?.message || String(err);
    }
  }
  return reply(502, { error: lastError || 'Free AI request failed.' });
}
