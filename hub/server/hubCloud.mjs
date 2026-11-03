/**
 * Music Teacher Hub PIN lock and cloud sync, stored in Cloudflare D1 (env.HUB_DB).
 *
 *   GET  /api/hub/status       { pinSet }                       is a Hub PIN set up yet?
 *   POST /api/hub/setup        { masterPin, pin } -> { token }  first-time PIN, or reset a forgotten one
 *   POST /api/hub/login        { pin } -> { token }
 *   POST /api/hub/logout       (signed in)                      ends this device's session
 *   POST /api/hub/change-pin   { currentPin, newPin } -> { token }  signs out every other device
 *   GET  /api/hub/sync         (signed in) -> { items: { key: { value, updatedAt } } }
 *   PUT  /api/hub/sync         (signed in) { key, value | null } -> { updatedAt }
 *
 * The Hub is one person's workspace: there is a single PIN (PBKDF2 hash in hub_config) and any
 * number of signed-in devices (hub_sessions; tokens are stored hashed). Setting the first PIN or
 * resetting it needs the site's master teacher PIN (Worker secret MASTER_TEACHER_PIN), so nobody
 * else can claim an empty Hub. Wrong PINs are counted across all devices: 5 in 15 minutes locks
 * sign-in for the rest of that window.
 *
 * Synced data is the app's localStorage values (JSON text), one row set per key. Values are
 * split into chunks to stay under D1's 2 MB row limit.
 */
const PBKDF2_ITERATIONS = 10_000;
const SESSION_DAYS = 180;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const MIN_PIN_LENGTH = 6;
const MAX_PIN_LENGTH = 64;
const MAX_BODY_BYTES = 24 * 1024 * 1024;
const MAX_VALUE_CHARS = 20 * 1024 * 1024;
const CHUNK_CHARS = 500_000;
const KEY_RE = /^mth_[a-z0-9_]{1,60}$/;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS hub_config (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hub_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hub_login_attempts (
    at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS hub_data (
    key TEXT NOT NULL,
    chunk INTEGER NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (key, chunk)
  )`,
];

const schemaReady = new WeakMap();

function ensureSchema(db) {
  let p = schemaReady.get(db);
  if (!p) {
    p = db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(() => undefined);
    p.catch(() => schemaReady.delete(db)); // retry on the next request if it failed
    schemaReady.set(db, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Responses and errors

class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const fail = (error, status) => json({ ok: false, error }, status);

// ---------------------------------------------------------------------------
// Crypto helpers

const enc = new TextEncoder();
const now = () => Date.now();

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function sha256(text) {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

async function pbkdf2(pin, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

async function hashPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(await pbkdf2(pin, salt, PBKDF2_ITERATIONS))}`;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPin(pin, stored) {
  const [scheme, iterations, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2') return false;
  return timingSafeEqual(await pbkdf2(pin, fromB64url(salt), Number(iterations)), fromB64url(hash));
}

function timingSafeStringEqual(a, b) {
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}

// ---------------------------------------------------------------------------
// PIN, sessions and lockout

async function getPinHash(db) {
  const row = await db.prepare(`SELECT value FROM hub_config WHERE name = 'pin_hash'`).first();
  return row ? row.value : null;
}

function checkNewPin(pin) {
  if (pin.length < MIN_PIN_LENGTH) throw new UserError(`Please choose a PIN of at least ${MIN_PIN_LENGTH} characters.`);
  if (pin.length > MAX_PIN_LENGTH) throw new UserError('That PIN is too long.');
}

async function newSession(db) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const t = now();
  await db
    .prepare(`INSERT INTO hub_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)`)
    .bind(await sha256(token), t, t + SESSION_DAYS * 24 * 60 * 60 * 1000)
    .run();
  return token;
}

function bearerToken(request) {
  const m = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') || '');
  return m ? m[1] : '';
}

/** True when the request carries a valid, unexpired session token. */
export async function isSignedIn(request, env) {
  const db = env.HUB_DB;
  const token = bearerToken(request);
  if (!db || !token) return false;
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT expires_at FROM hub_sessions WHERE token_hash = ?`)
    .bind(await sha256(token))
    .first();
  return !!row && row.expires_at > now();
}

async function assertNotLockedOut(db) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM hub_login_attempts WHERE at > ?`)
    .bind(now() - LOGIN_WINDOW_MS)
    .first();
  if ((row?.n ?? 0) >= LOGIN_MAX_FAILS) {
    throw new UserError('Too many wrong PINs. Please wait 15 minutes and try again.', 429);
  }
}

async function recordFailure(db) {
  const t = now();
  await db.batch([
    db.prepare(`DELETE FROM hub_login_attempts WHERE at <= ?`).bind(t - LOGIN_WINDOW_MS),
    db.prepare(`INSERT INTO hub_login_attempts (at) VALUES (?)`).bind(t),
  ]);
}

// ---------------------------------------------------------------------------
// Synced data

async function readAll(db) {
  const { results } = await db.prepare(`SELECT key, chunk, value, updated_at FROM hub_data ORDER BY key, chunk`).all();
  const items = {};
  for (const r of results) {
    const item = (items[r.key] ??= { value: '', updatedAt: r.updated_at });
    item.value += r.value;
  }
  return items;
}

async function writeKey(db, key, value) {
  const t = now();
  const writes = [db.prepare(`DELETE FROM hub_data WHERE key = ?`).bind(key)];
  if (value !== null) {
    for (let i = 0, chunk = 0; i < value.length || chunk === 0; i += CHUNK_CHARS, chunk++) {
      writes.push(
        db
          .prepare(`INSERT INTO hub_data (key, chunk, value, updated_at) VALUES (?, ?, ?, ?)`)
          .bind(key, chunk, value.slice(i, i + CHUNK_CHARS), t)
      );
    }
  }
  await db.batch(writes);
  return t;
}

// ---------------------------------------------------------------------------
// Entry point

async function readBody(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) throw new UserError('That is too large to save.', 413);
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) throw new UserError('That is too large to save.', 413);
  try {
    const body = JSON.parse(new TextDecoder().decode(buf));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new UserError('Invalid request.');
  }
}

const str = (v) => (typeof v === 'string' ? v : '');

async function route(path, request, env, db) {
  const method = request.method;

  if (path === '/api/hub/status' && method === 'GET') {
    return { pinSet: !!(await getPinHash(db)) };
  }

  if (path === '/api/hub/setup' && method === 'POST') {
    const body = await readBody(request);
    const master = String(env.MASTER_TEACHER_PIN ?? '').trim();
    if (!master) throw new UserError('The site has no master teacher PIN set, so the Hub PIN cannot be set up yet.', 503);
    await assertNotLockedOut(db);
    if (!timingSafeStringEqual(str(body.masterPin).trim(), master)) {
      await recordFailure(db);
      throw new UserError('That master teacher PIN is not right.', 401);
    }
    const pin = str(body.pin);
    checkNewPin(pin);
    await db.batch([
      db.prepare(`INSERT INTO hub_config (name, value) VALUES ('pin_hash', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value`).bind(await hashPin(pin)),
      db.prepare(`DELETE FROM hub_sessions`),
      db.prepare(`DELETE FROM hub_login_attempts`),
    ]);
    return { token: await newSession(db) };
  }

  if (path === '/api/hub/login' && method === 'POST') {
    const body = await readBody(request);
    const pinHash = await getPinHash(db);
    if (!pinHash) throw new UserError('No Hub PIN is set up yet.', 409);
    await assertNotLockedOut(db);
    if (!(await verifyPin(str(body.pin), pinHash))) {
      await recordFailure(db);
      throw new UserError('Wrong PIN.', 401);
    }
    await db.prepare(`DELETE FROM hub_login_attempts`).run();
    return { token: await newSession(db) };
  }

  // Everything below needs a signed-in device.
  if (!(await isSignedIn(request, env))) throw new UserError('Please unlock the Hub with your PIN.', 401);

  if (path === '/api/hub/logout' && method === 'POST') {
    await db.prepare(`DELETE FROM hub_sessions WHERE token_hash = ?`).bind(await sha256(bearerToken(request))).run();
    return {};
  }

  if (path === '/api/hub/change-pin' && method === 'POST') {
    const body = await readBody(request);
    await assertNotLockedOut(db);
    if (!(await verifyPin(str(body.currentPin), await getPinHash(db)))) {
      await recordFailure(db);
      throw new UserError('Your current PIN is not right.', 401);
    }
    const pin = str(body.newPin);
    checkNewPin(pin);
    await db.batch([
      db.prepare(`UPDATE hub_config SET value = ? WHERE name = 'pin_hash'`).bind(await hashPin(pin)),
      db.prepare(`DELETE FROM hub_sessions`),
      db.prepare(`DELETE FROM hub_login_attempts`),
    ]);
    return { token: await newSession(db) };
  }

  if (path === '/api/hub/sync' && method === 'GET') {
    return { items: await readAll(db) };
  }

  if (path === '/api/hub/sync' && method === 'PUT') {
    const body = await readBody(request);
    const key = str(body.key);
    if (!KEY_RE.test(key)) throw new UserError('Invalid data key.');
    const value = body.value === null ? null : str(body.value);
    if (value !== null && value.length > MAX_VALUE_CHARS) throw new UserError('That is too large to save.', 413);
    return { updatedAt: await writeKey(db, key, value) };
  }

  throw new UserError('Not found.', 404);
}

export async function handleHubCloud(request, env) {
  const db = env.HUB_DB;
  if (!db) return fail('Hub cloud saving is not set up yet.', 503);
  try {
    await ensureSchema(db);
    const result = await route(new URL(request.url).pathname, request, env, db);
    return json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UserError) return fail(err.message, err.status);
    console.error('hub cloud error', err);
    return fail('Something went wrong saving to the cloud. Please try again.', 500);
  }
}
