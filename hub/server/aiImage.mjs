/**
 * AI image helper: POST /api/hub/ai-image  { prompt, wide? } -> { image: data URL, model }
 *
 * Draws a picture with a FLUX model on Cloudflare Workers AI (env.AI binding), using the
 * account's free daily allowance (an image costs roughly 60–110 neurons of the 10,000/day).
 * FLUX.2 [klein] is tried first (it can make 16:9 slide images); FLUX.1 [schnell] is the
 * fallback, with a simpler square-only request format.
 */
const MAX_PROMPT = 1500;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const mimeOf = (b64) => (b64.startsWith('iVBOR') ? 'image/png' : b64.startsWith('UklGR') ? 'image/webp' : 'image/jpeg');

async function flux2Klein(ai, prompt, wide) {
  const form = new FormData();
  form.append('prompt', prompt);
  form.append('width', '1024');
  form.append('height', wide ? '576' : '1024');
  const body = new Response(form);
  return ai.run('@cf/black-forest-labs/flux-2-klein-4b', {
    multipart: { body: body.body, contentType: body.headers.get('content-type') },
  });
}

async function flux1Schnell(ai, prompt) {
  return ai.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 6 });
}

export async function handleAiImage(request, env = {}) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Only POST is allowed.' }, 405);
  if (!env.AI) return json({ ok: false, error: 'AI images are not switched on for this site yet.' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : '';
  if (!prompt) return json({ ok: false, error: 'Describe the picture you want.' }, 400);
  const wide = body?.wide !== false;

  let lastError = '';
  for (const [model, draw] of [
    ['flux-2-klein-4b', () => flux2Klein(env.AI, prompt, wide)],
    ['flux-1-schnell', () => flux1Schnell(env.AI, prompt)],
  ]) {
    try {
      const result = await draw();
      const b64 = typeof result?.image === 'string' ? result.image : '';
      if (b64) return json({ ok: true, image: `data:${mimeOf(b64)};base64,${b64}`, model });
      lastError = 'The image model returned no picture.';
    } catch (err) {
      lastError = err?.message || String(err);
      if (/daily free allocation|neurons/i.test(lastError)) {
        return json({ ok: false, error: 'Today’s free AI allowance is used up. It resets daily; try the photo library instead.' }, 429);
      }
      if (/nsfw|safety|flagged/i.test(lastError)) {
        return json({ ok: false, error: 'The image model declined that description. Try wording it differently.' }, 422);
      }
    }
  }
  return json({ ok: false, error: `Could not draw that picture (${lastError}).` }, 502);
}
