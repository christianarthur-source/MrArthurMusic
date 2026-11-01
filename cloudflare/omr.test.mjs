// Checks /api/omr (sheet-music scanning) against a fake Anthropic API and fake classroom PINs.
// Run: node cloudflare/omr.test.mjs   (no network, no API credit)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'omr-test-'));
const out = join(dir, 'omr.mjs');
await build({ entryPoints: ['src/server/omr.ts'], bundle: true, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], conditions: ['worker', 'browser'], external: ['node:*'], outfile: out, logLevel: 'warning' });
const { handleOmr, extractXml } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const XML = '<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Flute</part-name></score-part></part-list><part id="P1"><measure number="1"><note><rest/><duration>4</duration><type>whole</type></note></measure></part></score-partwise>';
let reply = { text: XML, stop: 'end_turn' };
let lastBody = null;
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.anthropic.com/v1/messages')) {
    lastBody = JSON.parse(opt.body);
    lastBody._headers = opt.headers;
    return new Response(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5', stop_reason: reply.stop,
      content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: reply.text }],
      usage: { input_tokens: 1500, output_tokens: 900 },
    }), { status: 200, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
  }
  throw new Error('unexpected fetch ' + u);
};

const env = { ANTHROPIC_API_KEY: 'sk-ant-test', MASTER_TEACHER_PIN: 'M4ster!' };
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
const call = async (body, e = env) => {
  const res = await handleOmr(new Request('https://x/api/omr', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), e, ctx);
  const text = await res.text();
  await Promise.all(pending);
  const line = text.trim().split('\n').filter(Boolean).pop();
  return [res.status, JSON.parse(line), text];
};
let fails = 0;
const expect = (name, ok, got) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(got).slice(0, 300)));
  if (!ok) fails++;
};
const page = { mediaType: 'image/jpeg', data: 'aGVsbG8=' };

let r = await call({ teacherPin: 'nope', page });
expect('wrong PIN refused', r[0] === 401 && !r[1].ok, r[1]);
r = await call({ teacherPin: 'M4ster!', page }, { MASTER_TEACHER_PIN: 'M4ster!' });
expect('no API key -> 503', r[0] === 503, r[1]);
r = await call({ teacherPin: 'M4ster!', page: { mediaType: 'text/html', data: 'x' } });
expect('bad media type refused', r[0] === 400, r[1]);
r = await call({ teacherPin: 'M4ster!', page, pageNumber: 2, pageCount: 3, hint: 'Bb clarinet' });
expect('master PIN scans a page', r[0] === 200 && r[1].ok && r[1].musicxml === XML, r[1]);
expect('uses claude-opus-5-5 with adaptive thinking', lastBody.model === 'claude-opus-5-5' && lastBody.thinking?.type === 'adaptive' && lastBody.output_config?.effort === 'high', lastBody);
expect('image sent as base64 image block', lastBody.messages[0].content[0].type === 'image' && lastBody.messages[0].content[0].source.data === 'aGVsbG8=', lastBody.messages[0].content[0]);
expect('page number and hint in the request', /page 2 of 3/.test(lastBody.messages[0].content[1].text) && /Bb clarinet/.test(lastBody.messages[0].content[1].text), lastBody.messages[0].content[1]);
expect('server-side fallback enabled', lastBody.fallbacks === 'default', lastBody.fallbacks);
r = await call({ teacherPin: 'M4ster!', page: { mediaType: 'application/pdf', data: 'JVBERi0=' }, pageNumber: 3, pageCount: 4 });
expect('PDF page sent as document with page number', r[1].ok && lastBody.messages[0].content[0].type === 'document' && /ONLY page 3 of this 4-page PDF/.test(lastBody.messages[0].content[1].text), lastBody.messages[0].content);
reply = { text: 'Here you go:\n```xml\n' + XML + '\n```', stop: 'end_turn' };
r = await call({ teacherPin: 'M4ster!', page });
expect('strips fences and chatter', r[1].ok && r[1].musicxml === XML, r[1]);
reply = { text: XML.replace('</part></score-partwise>', '<measure number="2"><note><rest/>'), stop: 'max_tokens' };
r = await call({ teacherPin: 'M4ster!', page });
expect('truncated reply keeps complete measures', r[1].ok && r[1].truncated && r[1].musicxml.endsWith('</measure></part></score-partwise>'), r[1]);
reply = { text: 'I cannot find any music here.', stop: 'end_turn' };
r = await call({ teacherPin: 'M4ster!', page });
expect('no music -> friendly error', !r[1].ok && /No music/.test(r[1].error), r[1]);
expect('extractXml empty on garbage', extractXml('hello') === '', null);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
