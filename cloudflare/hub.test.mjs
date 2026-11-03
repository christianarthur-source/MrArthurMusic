// Checks /api/hub/* (Music Teacher Hub PIN lock and cloud sync) against an in-memory SQLite
// database wrapped to look like Cloudflare D1.
// Run: node cloudflare/hub.test.mjs   (no network; needs Node 22.5+ for node:sqlite)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(tmpdir(), 'hub-test-'));
const out = join(dir, 'hub.mjs');
await build({ entryPoints: ['hub/server/routes.mjs'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' });
const { HUB_API_ROUTES } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

// ---- a small D1-compatible adapter over node:sqlite ----
function d1(sqlite) {
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async (col) => {
      const row = sqlite.prepare(sql).get(...args);
      if (!row) return null;
      return col ? row[col] : { ...row };
    },
    all: async () => ({ results: sqlite.prepare(sql).all(...args).map((r) => ({ ...r })), success: true, meta: {} }),
    run: async () => {
      const r = sqlite.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (stmts) => {
      sqlite.exec('BEGIN');
      try {
        const res = [];
        for (const s of stmts) res.push(await s.run());
        sqlite.exec('COMMIT');
        return res;
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

const sqlite = new DatabaseSync(':memory:');
const env = { HUB_DB: d1(sqlite), MASTER_TEACHER_PIN: 'T3acher!' };

const call = async (path, { method = 'GET', body, token } = {}, e = env) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await HUB_API_ROUTES[path](
    new Request('https://x' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    e
  );
  return [res.status, await res.json()];
};
let fails = 0, passes = 0;
const expect = (name, ok, got) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(got).slice(0, 300)));
  ok ? passes++ : fails++;
};

// ---- setup ----
let [s, r] = await call('/api/hub/status');
expect('no PIN at first', s === 200 && r.pinSet === false, r);
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '123456' } });
expect('login before setup is refused', s === 409, r);
[s, r] = await call('/api/hub/setup', { method: 'POST', body: { masterPin: 'nope', pin: '123456' } });
expect('setup needs the master PIN', s === 401, r);
[s, r] = await call('/api/hub/setup', { method: 'POST', body: { masterPin: 'T3acher!', pin: '123' } });
expect('setup rejects a short PIN', s === 400, r);
[s, r] = await call('/api/hub/setup', { method: 'POST', body: { masterPin: 'T3acher!', pin: '482913' } });
expect('setup with master PIN gives a token', s === 200 && typeof r.token === 'string', r);
let token = r.token;
[s, r] = await call('/api/hub/status');
expect('PIN is set', r.pinSet === true, r);
[s, r] = await call('/api/hub/setup', { method: 'POST', body: { masterPin: '', pin: '999999' } }, { HUB_DB: env.HUB_DB });
expect('setup refused when the site has no master PIN', s === 503, r);

// ---- locked routes ----
[s, r] = await call('/api/hub/sync');
expect('sync needs a token', s === 401, r);
[s, r] = await call('/api/hub/sync', { token: 'made-up' });
expect('sync rejects a bad token', s === 401, r);
[s, r] = await call('/api/hub/youtube-search');
expect('youtube search needs a token', s === 401, r);
[s, r] = await call('/api/hub/calendar');
expect('calendar needs a token', s === 401, r);
[s, r] = await call('/api/hub/claude', { method: 'POST', body: {} });
expect('claude needs a token', s === 401, r);
[s, r] = await call('/api/hub/claude', { method: 'POST', body: {}, token });
expect('claude without any key explains itself', s === 400 && /API key/.test(r.error), r);

// ---- sync ----
[s, r] = await call('/api/hub/sync', { token });
expect('cloud starts empty', s === 200 && Object.keys(r.items).length === 0, r);
const tasks = JSON.stringify([{ id: 'task-1', title: 'Order risers ♫ – “quotes”' }]);
[s, r] = await call('/api/hub/sync', { method: 'PUT', token, body: { key: 'mth_tasks', value: tasks } });
expect('save a key', s === 200 && r.updatedAt > 0, r);
const big = JSON.stringify([{ id: 'jrn-1', photoUrl: 'data:image/jpeg;base64,' + 'A'.repeat(1_300_000) }]);
[s, r] = await call('/api/hub/sync', { method: 'PUT', token, body: { key: 'mth_journal', value: big } });
expect('save a value larger than one chunk', s === 200, r);
expect('large value is split into chunks', sqlite.prepare(`SELECT COUNT(*) AS n FROM hub_data WHERE key = 'mth_journal'`).get().n === 3);
[s, r] = await call('/api/hub/sync', { token });
expect('read back exactly', r.items.mth_tasks?.value === tasks && r.items.mth_journal?.value === big, Object.keys(r.items));
[s, r] = await call('/api/hub/sync', { method: 'PUT', token, body: { key: 'mth_journal', value: '[]' } });
expect('shrinking a value drops old chunks', sqlite.prepare(`SELECT COUNT(*) AS n FROM hub_data WHERE key = 'mth_journal'`).get().n === 1);
[s, r] = await call('/api/hub/sync', { method: 'PUT', token, body: { key: 'mth_tasks', value: null } });
[s, r] = await call('/api/hub/sync', { token });
expect('null deletes a key', s === 200 && !('mth_tasks' in r.items) && 'mth_journal' in r.items, r);
[s, r] = await call('/api/hub/sync', { method: 'PUT', token, body: { key: 'other_app_key', value: '1' } });
expect('only Hub keys are accepted', s === 400, r);

// ---- second device, change PIN, logout ----
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '482913' } });
expect('login on a second device', s === 200 && r.token && r.token !== token, r);
const token2 = r.token;
[s, r] = await call('/api/hub/change-pin', { method: 'POST', token, body: { currentPin: 'wrong1', newPin: '7777777' } });
expect('change PIN checks the current PIN', s === 401, r);
[s, r] = await call('/api/hub/change-pin', { method: 'POST', token, body: { currentPin: '482913', newPin: '7777777' } });
expect('change PIN gives a new token', s === 200 && r.token, r);
token = r.token;
[s, r] = await call('/api/hub/sync', { token: token2 });
expect('changing the PIN signs out other devices', s === 401, r);
[s, r] = await call('/api/hub/sync', { token });
expect('this device stays signed in', s === 200, r);
[s, r] = await call('/api/hub/logout', { method: 'POST', token });
[s, r] = await call('/api/hub/sync', { token });
expect('logout ends the session', s === 401, r);

// ---- lockout ----
for (let i = 0; i < 4; i++) await call('/api/hub/login', { method: 'POST', body: { pin: '000000' } });
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '000000' } });
expect('fifth wrong PIN is still just wrong', s === 401, r);
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '7777777' } });
expect('then sign-in is locked, even with the right PIN', s === 429, r);
sqlite.prepare(`UPDATE hub_login_attempts SET at = at - ?`).run(16 * 60 * 1000);
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '7777777' } });
expect('lock lifts after 15 minutes', s === 200 && r.token, r);
[s, r] = await call('/api/hub/setup', { method: 'POST', body: { masterPin: 'T3acher!', pin: '5555555' } });
expect('master PIN resets a forgotten PIN', s === 200 && r.token, r);
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '5555555' } });
expect('new PIN works after reset', s === 200, r);

// ---- free AI (Workers AI binding) ----
[s, r] = await call('/api/hub/login', { method: 'POST', body: { pin: '5555555' } });
const aiToken = r.token;
const aiCalls = [];
const fakeAi = (reply) => ({ run: async (model, input) => { aiCalls.push(model); return reply(model, input); } });
[s, r] = await call('/api/hub/free-ai', { method: 'POST', body: { prompt: 'hi' } }, { ...env, AI: fakeAi(() => ({ response: 'x' })) });
expect('free AI needs a token', s === 401, r);
[s, r] = await call('/api/hub/free-ai', { token: aiToken });
expect('free AI reports when it is not switched on', s === 200 && r.configured === false, r);
[s, r] = await call('/api/hub/free-ai', { method: 'POST', token: aiToken, body: { prompt: 'hi' } });
expect('free AI explains when it is off', s === 503, r);
[s, r] = await call('/api/hub/free-ai', { method: 'POST', token: aiToken, body: { system: 'be brief', prompt: 'lesson' } }, { ...env, AI: fakeAi(() => ({ response: '{"title":"A"}' })) });
expect('free AI returns the classic reply shape', s === 200 && r.text === '{"title":"A"}', r);
[s, r] = await call('/api/hub/free-ai', { method: 'POST', token: aiToken, body: { prompt: 'lesson' } }, { ...env, AI: fakeAi(() => ({ choices: [{ message: { content: '{"title":"B"}' } }] })) });
expect('free AI returns the OpenAI-style reply shape', s === 200 && r.text === '{"title":"B"}', r);
aiCalls.length = 0;
[s, r] = await call('/api/hub/free-ai', { method: 'POST', token: aiToken, body: { prompt: 'lesson' } }, {
  ...env,
  AI: fakeAi((model) => { if (model.includes('gemma')) throw new Error('model retired'); return { response: 'from backup' }; }),
});
expect('free AI falls back to the next model', s === 200 && r.text === 'from backup' && aiCalls.length === 2, { r, aiCalls });
[s, r] = await call('/api/hub/free-ai', { method: 'POST', token: aiToken, body: { prompt: 'lesson' } }, {
  ...env,
  AI: fakeAi(() => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); }),
});
expect('free AI says when the daily allowance is used up', s === 429 && /allowance/.test(r.error), r);

// ---- AI images and photo search ----
[s, r] = await call('/api/hub/ai-image', { method: 'POST', body: { prompt: 'drum' } }, { ...env, AI: fakeAi(() => ({ image: 'x' })) });
expect('AI image needs a token', s === 401, r);
[s, r] = await call('/api/hub/image-search');
expect('photo search needs a token', s === 401, r);
[s, r] = await call('/api/hub/ai-image', { method: 'POST', token: aiToken, body: { prompt: 'drum' } });
expect('AI image explains when it is off', s === 503, r);
[s, r] = await call('/api/hub/ai-image', { method: 'POST', token: aiToken, body: { prompt: '  ' } }, { ...env, AI: fakeAi(() => ({ image: 'x' })) });
expect('AI image needs a description', s === 400, r);
aiCalls.length = 0;
let kleinInput;
[s, r] = await call('/api/hub/ai-image', { method: 'POST', token: aiToken, body: { prompt: 'a xylophone' } }, {
  ...env,
  AI: fakeAi((model, input) => { kleinInput = input; return { image: 'iVBORw0KGgoAAAA' }; }),
});
expect('AI image uses FLUX.2 klein with a multipart request', s === 200 && aiCalls[0].includes('flux-2-klein') && !!kleinInput?.multipart?.contentType?.startsWith('multipart/form-data'), { r, aiCalls });
expect('AI image returns a PNG data URL', r.image === 'data:image/png;base64,iVBORw0KGgoAAAA', r);
aiCalls.length = 0;
[s, r] = await call('/api/hub/ai-image', { method: 'POST', token: aiToken, body: { prompt: 'a xylophone' } }, {
  ...env,
  AI: fakeAi((model) => { if (model.includes('klein')) throw new Error('bad multipart'); return { image: '/9j/4AAQ' }; }),
});
expect('AI image falls back to FLUX.1 schnell', s === 200 && r.model === 'flux-1-schnell' && r.image.startsWith('data:image/jpeg'), { r, aiCalls });
[s, r] = await call('/api/hub/ai-image', { method: 'POST', token: aiToken, body: { prompt: 'x' } }, {
  ...env,
  AI: fakeAi(() => { throw new Error('you have used up your daily free allocation of 10,000 neurons'); }),
});
expect('AI image says when the allowance is used up', s === 429, r);

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
