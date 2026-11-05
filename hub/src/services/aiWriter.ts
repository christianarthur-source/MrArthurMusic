/**
 * One place to ask an AI for text. Uses Claude Sonnet 5.5 when the site has a Claude key or one
 * is saved in Settings (better with facts), and the free Gemma model on Cloudflare otherwise.
 */
import { cloudSync } from './cloudSync';
import { storage } from './storage';

export type WriterEngine = 'claude' | 'free';

let siteHasClaude: Promise<boolean> | null = null;

async function claudeAvailable(): Promise<boolean> {
  if (storage.getPreferences().claudeApiKey?.trim()) return true;
  siteHasClaude ??= cloudSync
    .hubFetch('/api/hub/claude')
    .then((r) => r.json())
    .then((d) => !!d?.configured)
    .catch(() => false);
  return siteHasClaude;
}

export async function pickEngine(): Promise<WriterEngine> {
  return (await claudeAvailable()) ? 'claude' : 'free';
}

/** Sends a system prompt and a request; returns the reply text and which AI wrote it. */
export async function writeWithAI(system: string, prompt: string, maxTokens = 4000): Promise<{ text: string; engine: WriterEngine }> {
  if ((await pickEngine()) === 'claude') {
    const key = storage.getPreferences().claudeApiKey?.trim();
    const res = await cloudSync.hubFetch('/api/hub/claude', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
      body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json().catch(() => null);
    const text = data?.content?.find?.((c: any) => c.type === 'text')?.text || data?.content?.[0]?.text;
    if (res.ok && text) return { text, engine: 'claude' };
    // Claude failed (bad key, no credit): fall through to the free model.
  }
  const res = await cloudSync.hubFetch('/api/hub/free-ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, prompt })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.text) throw new Error(data?.error || `The AI request failed (${res.status})`);
  return { text: data.text, engine: 'free' };
}

/** Pulls the JSON object or array out of an AI reply (models sometimes add fences or a sentence). */
export function extractJson<T = any>(text: string, kind: 'object' | 'array' = 'object'): T {
  const [open, close] = kind === 'object' ? ['{', '}'] : ['[', ']'];
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  if (start === -1 || end <= start) throw new Error('The AI reply was not in the expected format. Please try again.');
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    throw new Error('The AI reply was incomplete. Please try again.');
  }
}
