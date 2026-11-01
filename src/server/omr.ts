/**
 * POST /api/omr — sheet music recognition for Pro Staff.
 * Sends one page (a photo/scan, or one page of a PDF) to Claude and returns MusicXML.
 * Only teachers can use it (teacher or master PIN), because each page costs API credit.
 *
 * Body: { teacherPin, page: { mediaType, data(base64) }, pageNumber?, pageCount?, hint? }
 * The response streams blank lines while Claude works (keeps the connection open), then one JSON line:
 *   { ok: true, musicxml, usage } | { ok: false, error }
 */
import Anthropic from '@anthropic-ai/sdk';
import { isTeacherPin, type ClassroomEnv } from './classroomCloud';

export interface OmrEnv extends ClassroomEnv {
  ANTHROPIC_API_KEY?: string;
}

const MAX_BODY_BYTES = 24 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const SYSTEM = `You are an expert music engraver and copyist doing optical music recognition. You receive one page of printed or neatly handwritten sheet music and transcribe it into MusicXML 4.0 (score-partwise) that reproduces the page exactly, so it can be opened in notation software and edited.

Accuracy rules:
- Transcribe what is printed: every part and staff, every measure, every note, rest, chord tone, accidental, dot, tie, tuplet and grace note. Do not simplify, correct the composer, or invent material. If something is genuinely illegible, choose the most plausible reading that keeps the measure's rhythm complete.
- Read clefs, key signatures and time signatures at the start of every system and wherever they change; carry key-signature accidentals and in-measure accidentals the way a musician would when writing <alter>.
- Every measure's durations must add up to the time signature in every voice (use <forward> for hidden time, an implicit="yes" pickup measure when the first or last measure is short). Use <backup> between voices and staves. Multi-staff instruments (piano, harp, organ) are one part with <staves>.
- Include notations and directions that are printed: slurs, ties, articulations, accents, fermatas, ornaments (trill, mordent, turn), tremolos, arpeggios, glissandi, dynamics, hairpins (wedges), tempo and expression text (with <metronome> when a marking like ♩ = 120 is printed), rehearsal marks, chord symbols (<harmony>), fingerings, pedal marks, octave lines, breath marks, repeat barlines, volta endings, segno/coda/D.C./D.S./Fine, double and final barlines, and lyrics (every verse, with correct syllabic values).
- Part names and abbreviations as printed. If an instrument is a transposing instrument (B♭ clarinet/trumpet/tenor sax, E♭ alto/bari sax, F horn, guitar/bass sounding an octave lower), keep the pitches as written on the page and add the correct <transpose> element.
- On page 1 include the title, subtitle, composer, arranger and lyricist in <work>/<identification>/<credit> if printed.

Format rules (keep the output compact):
- Output ONLY the MusicXML document, starting with <?xml and ending with </score-partwise>. No markdown fences, no commentary.
- Use one <divisions> value for the whole score that makes every duration an integer (24 per quarter covers most music; use 48 or more if there are 64th notes or nested tuplets).
- Omit layout and appearance data: no default-x/default-y/relative-x, no <print> layout, no <stem> or <beam> elements, no <defaults>, no <appearance>, no indentation or blank lines. Always include <type>, <duration>, <voice> and <staff> (when the part has several staves).`;

export async function handleOmr(request: Request, env: OmrEnv, ctx?: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
  if (request.method !== 'POST') return jsonError('Use POST.', 405);
  if (!env.ANTHROPIC_API_KEY) return jsonError('Sheet music scanning is not set up on the server yet (ANTHROPIC_API_KEY is missing).', 503);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return jsonError('That file is too large. Use a photo or PDF under about 15 MB.', 413);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonError('Bad request.', 400);
  }
  const pin = String(body?.teacherPin ?? '').trim();
  if (!pin || !(await isTeacherPin(env, pin))) return jsonError('Scanning sheet music needs a teacher PIN.', 401);
  const page = body?.page;
  const mediaType = String(page?.mediaType || '');
  const data = String(page?.data || '');
  if (!data || (!IMAGE_TYPES.has(mediaType) && mediaType !== 'application/pdf')) return jsonError('Send a JPEG, PNG or WebP image, or a PDF.', 400);
  const pageNumber = Math.max(1, Math.min(200, Number(body?.pageNumber) || 1));
  const pageCount = Math.max(pageNumber, Math.min(200, Number(body?.pageCount) || 1));
  const hint = String(body?.hint || '').slice(0, 500);

  const source = mediaType === 'application/pdf'
    ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } } as const)
    : ({ type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg', data } } as const);
  const ask = [
    mediaType === 'application/pdf'
      ? `Transcribe ONLY page ${pageNumber} of this ${pageCount}-page PDF into MusicXML.`
      : `Transcribe this page (page ${pageNumber} of ${pageCount}) into MusicXML.`,
    pageNumber > 1 ? 'This is a continuation page: skip title credits, but keep every part in the same order as the score.' : '',
    hint ? `Notes from the teacher about this score: ${hint}` : '',
  ].filter(Boolean).join('\n');

  // Stream blank lines while waiting so proxies keep the connection open, then the result as JSON.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const beat = setInterval(() => void writer.write(enc.encode('\n')).catch(() => {}), 10000);
  const work = (async () => {
    try {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1 });
      const msg = await client.beta.messages.create(
        {
          model: 'claude-opus-5-5',
          max_tokens: 64000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'high' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: SYSTEM,
          messages: [{ role: 'user', content: [source, { type: 'text', text: ask }] }],
        },
        { timeout: 20 * 60 * 1000 },
      );
      if (msg.stop_reason === 'refusal') throw new Error('The page could not be processed. Try a clearer photo.');
      let text = '';
      for (const block of msg.content) if (block.type === 'text') text += block.text;
      const musicxml = extractXml(text);
      if (!musicxml) throw new Error(msg.stop_reason === 'max_tokens' ? 'This page is too dense to read in one go. Try cropping it into halves.' : 'No music was found on this page.');
      await writer.write(enc.encode(JSON.stringify({ ok: true, musicxml, truncated: msg.stop_reason === 'max_tokens', usage: msg.usage }) + '\n'));
    } catch (err) {
      let message = err instanceof Error ? err.message : 'Recognition failed.';
      if (err instanceof Anthropic.RateLimitError) message = 'The scanner is busy. Wait a minute and try again.';
      else if (err instanceof Anthropic.AuthenticationError) message = 'The server API key is not valid.';
      else if (err instanceof Anthropic.BadRequestError) message = 'The page could not be sent to the scanner (' + err.message.slice(0, 160) + ').';
      else if (err instanceof Anthropic.APIError) message = `The scanner had a problem (${err.status}). Try again.`;
      await writer.write(enc.encode(JSON.stringify({ ok: false, error: message }) + '\n')).catch(() => {});
    } finally {
      clearInterval(beat);
      await writer.close().catch(() => {});
    }
  })();
  ctx?.waitUntil(work);
  return new Response(readable, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

/** Pulls the MusicXML document out of the reply (tolerates stray fences or text). */
export function extractXml(text: string): string {
  const start = text.indexOf('<?xml') >= 0 ? text.indexOf('<?xml') : text.indexOf('<score-partwise');
  if (start < 0) return '';
  const endTag = '</score-partwise>';
  const end = text.lastIndexOf(endTag);
  if (end < 0) {
    // truncated: close what we can so the measures read so far are kept
    const lastMeasure = text.lastIndexOf('</measure>');
    if (lastMeasure < 0) return '';
    return text.slice(start, lastMeasure + '</measure>'.length) + '</part>' + endTag;
  }
  return text.slice(start, end + endTag.length);
}

function jsonError(error: string, status: number) {
  return new Response(JSON.stringify({ ok: false, error }) + '\n', { status, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
}
