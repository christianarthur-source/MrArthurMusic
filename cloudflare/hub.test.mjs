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

console.log(`\n${passes} passed, ${fails} failed`);
if (fails) process.exit(1);
