/**
 * Free AI helper: POST /api/hub/free-ai  { system, prompt } -> { text }
 *                 GET  /api/hub/free-ai  -> { configured }
 *
 * Runs an open model on Cloudflare Workers AI through the Worker's AI binding (env.AI), so it
 * needs no API key and uses the account's free daily allowance (10,000 neurons/day; a lesson
 * plan uses roughly 80). If the main model is ever retired, the next one in MODELS is tried.
 */
const MODELS = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-4-scout-17b-16e-instruct'];
const MAX_TOKENS = 3000;
const MAX_INPUT_CHARS = 30_000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Workers AI text models answer in either the classic or the OpenAI-style shape. */
function replyText(result) {
  if (typeof result === 'string') return result;
  if (typeof result?.response === 'string') return result.response;
  const message = result?.choices?.[0]?.message;
  if (typeof message?.content === 'string') return message.content;
  if (Array.isArray(message?.content)) return message.content.map((part) => part?.text || '').join('');
  return '';
}

export async function handleFreeAi(request, env = {}) {
  if (request.method === 'GET') return json({ ok: true, configured: !!env.AI });
  if (request.method !== 'POST') return json({ ok: false, error: 'Only POST is allowed.' }, 405);
  if (!env.AI) return json({ ok: false, error: 'The free AI is not switched on for this site yet.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }
  const system = typeof body?.system === 'string' ? body.system : '';
  const prompt = typeof body?.prompt === 'string' ? body.prompt : '';
  if (!prompt) return json({ ok: false, error: 'Missing prompt.' }, 400);
  if (system.length + prompt.length > MAX_INPUT_CHARS) return json({ ok: false, error: 'That request is too long.' }, 413);

  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ];
  let lastError = '';
  for (const model of MODELS) {
    try {
      const text = replyText(await env.AI.run(model, { messages, max_tokens: MAX_TOKENS }));
      if (text.trim()) return json({ ok: true, text, model });
      lastError = 'The AI returned an empty answer.';
    } catch (err) {
      lastError = err?.message || String(err);
      if (/daily free allocation|neurons|limit/i.test(lastError)) {
        return json({ ok: false, error: 'Today’s free AI allowance is used up. It resets daily, or use the Built-In engine.' }, 429);
      }
    }
  }
  return json({ ok: false, error: `The free AI could not answer (${lastError}).` }, 502);
}
