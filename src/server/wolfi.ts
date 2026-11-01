/**
 * Wolfi accounts and cloud-saved scores (POST /api/wolfi), stored in Cloudflare D1 (env.WOLFI_DB).
 * Completely separate from the K-6 classroom data (Supabase, /api/classroom).
 *
 * Privacy (NY Ed Law 2-d): no emails and no real names are required or stored — only a username,
 * a password hash and an optional display name.
 *
 * Request:  POST JSON { action, ...fields }, signed-in actions send `Authorization: Bearer <token>`.
 * Response: { ok: true, ... } or { ok: false, error } (plus `conflict: true, version, updatedBy` on a save conflict).
 *
 * Worker bindings: WOLFI_DB (D1 database), MASTER_TEACHER_PIN (secret; the teacher key for creating teacher accounts).
 */
import { containsProfanity } from '../utils/profanityFilter';

// ---------------------------------------------------------------------------
// Minimal D1 types (so we don't depend on @cloudflare/workers-types)

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, any>>(column?: string): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } } & Record<string, any>>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1PreparedStatementLike;
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export interface WolfiEnv {
  WOLFI_DB?: D1DatabaseLike;
  MASTER_TEACHER_PIN?: string;
}

// ---------------------------------------------------------------------------
// Limits and settings

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const MAX_MEI_BYTES = Math.floor(1.8 * 1024 * 1024);
const PBKDF2_ITERATIONS = 10_000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
/** Only rewrite a session's expiry when it has been used at least this long after the last refresh. */
const SESSION_REFRESH_MS = 24 * 60 * 60 * 1000;
const ACTIVE_UPDATE_MS = 5 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 8;
const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;
const MAX_SNAPSHOTS = 30;
const MAX_COMMENT = 1000;
const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

/** An error whose message is safe and useful to show the student or teacher. */
class UserError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

const fail = (error: string, status: number, extra: Record<string, unknown> = {}) => json({ ok: false, error, ...extra }, status);

// ---------------------------------------------------------------------------
// Schema (created once per isolate per database)

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL CHECK (role IN ('student','teacher')),
    pw_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_active INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    teacher_id TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS classes_teacher ON classes(teacher_id)`,
  `CREATE TABLE IF NOT EXISTS class_members (
    class_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    PRIMARY KEY (class_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS class_members_user ON class_members(user_id)`,
  `CREATE TABLE IF NOT EXISTS scores (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    composer TEXT NOT NULL DEFAULT '',
    mei TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL,
    share_token TEXT UNIQUE
  )`,
  `CREATE INDEX IF NOT EXISTS scores_owner ON scores(owner_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS score_collaborators (
    score_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (score_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS score_collaborators_user ON score_collaborators(user_id)`,
  `CREATE TABLE IF NOT EXISTS score_versions (
    score_id TEXT NOT NULL,
    n INTEGER NOT NULL,
    mei TEXT NOT NULL,
    saved_at INTEGER NOT NULL,
    saved_by TEXT NOT NULL,
    size INTEGER NOT NULL,
    PRIMARY KEY (score_id, n)
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    score_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    measure INTEGER NOT NULL,
    staff INTEGER,
    text TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS comments_score ON comments(score_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    username TEXT NOT NULL,
    at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS login_attempts_user ON login_attempts(username, at)`,
];

const schemaReady = new WeakMap<D1DatabaseLike, Promise<void>>();

function ensureSchema(db: D1DatabaseLike): Promise<void> {
  let p = schemaReady.get(db);
  if (!p) {
    p = db.batch(SCHEMA.map((sql) => db.prepare(sql))).then(() => undefined);
    p.catch(() => schemaReady.delete(db)); // retry on the next request if it failed
    schemaReady.set(db, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Entry point

export async function handleWolfi(request: Request, env: WolfiEnv): Promise<Response> {
  if (request.method !== 'POST') return fail('Use POST.', 405);
  const db = env.WOLFI_DB;
  if (!db) return fail('Online saving is not set up yet.', 503);
  const tooLarge = 'This score is too large to save online.';
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) return fail(tooLarge, 413);

  let payload: Record<string, any>;
  try {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > MAX_BODY_BYTES) return fail(tooLarge, 413);
    payload = JSON.parse(new TextDecoder().decode(buf));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
  } catch {
    return fail('Invalid request.', 400);
  }

  try {
    await ensureSchema(db);
    const result = await runAction(new Ctx(db, env, request), String(payload.action || ''), payload);
    return json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof UserError) return fail(err.message, err.status, err.extra);
    console.error('wolfi action failed', payload.action, err);
    return fail('The server had a problem. Please try again.', 500);
  }
}

// ---------------------------------------------------------------------------
// Helpers

const enc = new TextEncoder();
const byteLength = (s: string) => enc.encode(s).byteLength;
const now = () => Date.now();
const iso = (ms: number | null | undefined) => (ms ? new Date(Number(ms)).toISOString() : null);

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const randomId = (prefix: string, bytes = 12) => `${prefix}_${b64url(randomBytes(bytes))}`;

function joinCode(): string {
  const r = randomBytes(6);
  let code = '';
  for (const b of r) code += JOIN_ALPHABET[b % JOIN_ALPHABET.length];
  return code;
}

async function sha256(text: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text))));
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Stored as `pbkdf2-sha256$<iterations>$<salt>$<hash>` (base64url), so iterations can be raised later. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; needsRehash: boolean }> {
  const [scheme, iterStr, saltStr, hashStr] = String(stored).split('$');
  const iterations = Number(iterStr);
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 1 || !saltStr || !hashStr) {
    return { ok: false, needsRehash: false };
  }
  const got = await pbkdf2(password, fromB64url(saltStr), iterations);
  return { ok: timingSafeEqual(got, fromB64url(hashStr)), needsRehash: iterations < PBKDF2_ITERATIONS };
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normUsername(v: unknown): string {
  return str(v).trim().toLowerCase();
}

function checkUsername(username: string) {
  if (username.length < 3 || username.length > 24) throw new UserError('Usernames need 3 to 24 characters.');
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new UserError('Usernames can only use letters, numbers, dots, dashes and underscores.');
  }
  if (containsProfanity(username)) throw new UserError('Please choose a school-appropriate username.');
}

function checkPassword(password: string) {
  if (password.length < 8) throw new UserError('Passwords need at least 8 characters.');
  if (password.length > 200) throw new UserError('That password is too long.');
}

function cleanDisplayName(v: unknown): string {
  const name = str(v).replace(/\s+/g, ' ').trim();
  if (name.length > 40) throw new UserError('Display names can be up to 40 characters.');
  if (name && containsProfanity(name)) throw new UserError('Please choose a school-appropriate display name.');
  return name;
}

const normCode = (v: unknown) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '');

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: 'student' | 'teacher';
  pw_hash: string;
  last_active: number | null;
}

const userOut = (u: UserRow) => ({ id: u.id, username: u.username, displayName: u.display_name || '', role: u.role });
const nameOf = (u: { display_name?: string | null; username?: string | null }) => u.display_name || u.username || '';

// ---------------------------------------------------------------------------
// Request context (db + signed-in user)

class Ctx {
  private me: UserRow | null | undefined;
  readonly token: string;

  constructor(readonly db: D1DatabaseLike, readonly env: WolfiEnv, request: Request) {
    const m = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '');
    this.token = m ? m[1].trim() : '';
  }

  q(sql: string, ...args: unknown[]) {
    return this.db.prepare(sql).bind(...args.map((a) => (a === undefined ? null : a)));
  }
  first<T = any>(sql: string, ...args: unknown[]) {
    return this.q(sql, ...args).first<T>();
  }
  async all<T = any>(sql: string, ...args: unknown[]): Promise<T[]> {
    return (await this.q(sql, ...args).all<T>()).results || [];
  }
  run(sql: string, ...args: unknown[]) {
    return this.q(sql, ...args).run();
  }

  /** The signed-in user, or a 401. Refreshes the session's 30-day expiry on use. */
  async user(): Promise<UserRow> {
    if (this.me === undefined) {
      this.me = null;
      if (this.token && this.token.length < 200) {
        const t = now();
        const row = await this.first<UserRow & { expires_at: number; token_hash: string }>(
          `SELECT u.*, s.expires_at, s.token_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
          await sha256(this.token),
        );
        if (row && row.expires_at > t) {
          this.me = row;
          const writes: D1PreparedStatementLike[] = [];
          if (row.expires_at - t < SESSION_MS - SESSION_REFRESH_MS) {
            writes.push(this.q(`UPDATE sessions SET expires_at = ? WHERE token_hash = ?`, t + SESSION_MS, row.token_hash));
          }
          if (!row.last_active || t - row.last_active > ACTIVE_UPDATE_MS) {
            writes.push(this.q(`UPDATE users SET last_active = ? WHERE id = ?`, t, row.id));
          }
          if (writes.length) await this.db.batch(writes);
        } else if (row) {
          await this.run(`DELETE FROM sessions WHERE token_hash = ?`, row.token_hash);
        }
      }
    }
    if (!this.me) throw new UserError('Please sign in again.', 401);
    return this.me;
  }

  async teacher(): Promise<UserRow> {
    const u = await this.user();
    if (u.role !== 'teacher') throw new UserError('Only teachers can do that.', 403);
    return u;
  }
}

async function newSession(c: Ctx, userId: string): Promise<string> {
  const token = b64url(randomBytes(32));
  const t = now();
  await c.db.batch([
    c.q(`DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?`, userId, t),
    c.q(`INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`, await sha256(token), userId, t, t + SESSION_MS),
    c.q(`UPDATE users SET last_active = ? WHERE id = ?`, t, userId),
  ]);
  return token;
}

async function classesFor(c: Ctx, u: UserRow) {
  const rows =
    u.role === 'teacher'
      ? await c.all(
          `SELECT c.id, c.name, c.code, t.display_name, t.username FROM classes c JOIN users t ON t.id = c.teacher_id
           WHERE c.teacher_id = ? ORDER BY c.created_at`,
          u.id,
        )
      : await c.all(
          `SELECT c.id, c.name, c.code, t.display_name, t.username FROM class_members m JOIN classes c ON c.id = m.class_id
           JOIN users t ON t.id = c.teacher_id WHERE m.user_id = ? ORDER BY m.joined_at`,
          u.id,
        );
  return rows.map((r: any) => ({ id: r.id, name: r.name, code: r.code, teacherName: nameOf(r) }));
}

async function isTeacherOf(c: Ctx, teacherId: string, studentId: string): Promise<boolean> {
  return !!(await c.first(
    `SELECT 1 AS x FROM classes cl JOIN class_members m ON m.class_id = cl.id WHERE cl.teacher_id = ? AND m.user_id = ? LIMIT 1`,
    teacherId,
    studentId,
  ));
}

/** True when two users are in a class together (as classmates, or as a class's teacher and a member). */
async function shareAClass(c: Ctx, a: string, b: string): Promise<boolean> {
  return !!(await c.first(
    `SELECT 1 AS x FROM class_members m1 JOIN class_members m2 ON m1.class_id = m2.class_id WHERE m1.user_id = ? AND m2.user_id = ?
     UNION ALL
     SELECT 1 AS x FROM classes cl JOIN class_members m ON m.class_id = cl.id
       WHERE (cl.teacher_id = ? AND m.user_id = ?) OR (cl.teacher_id = ? AND m.user_id = ?)
     LIMIT 1`,
    a, b, a, b, b, a,
  ));
}

interface ScoreAccess {
  score: any;
  canRead: boolean;
  canEdit: boolean;
  isOwner: boolean;
  isTeacher: boolean;
}

async function scoreAccess(c: Ctx, u: UserRow, id: unknown, withMei = false): Promise<ScoreAccess> {
  const scoreId = str(id);
  if (!scoreId) throw new UserError('Score id is required.');
  const score = await c.first(
    `SELECT s.id, s.owner_id, s.title, s.composer, ${withMei ? 's.mei,' : ''} s.version, s.updated_at, s.updated_by, s.share_token,
       o.username AS owner_username, o.display_name AS owner_display
     FROM scores s JOIN users o ON o.id = s.owner_id WHERE s.id = ?`,
    scoreId,
  );
  if (!score) throw new UserError('That score was not found.', 404);
  const isOwner = score.owner_id === u.id;
  const isCollab = !isOwner && !!(await c.first(`SELECT 1 AS x FROM score_collaborators WHERE score_id = ? AND user_id = ?`, score.id, u.id));
  const isTeacher = !isOwner && u.role === 'teacher' && (await isTeacherOf(c, u.id, score.owner_id));
  return { score, canRead: isOwner || isCollab || isTeacher, canEdit: isOwner || isCollab, isOwner, isTeacher };
}

async function readableScore(c: Ctx, u: UserRow, id: unknown, withMei = false) {
  const a = await scoreAccess(c, u, id, withMei);
  if (!a.canRead) throw new UserError('That score was not found.', 404); // don't reveal other students' scores
  return a;
}

async function ownedScore(c: Ctx, u: UserRow, id: unknown) {
  const a = await readableScore(c, u, id);
  if (!a.isOwner) throw new UserError('Only the owner of this score can do that.', 403);
  return a;
}

function cleanText(v: unknown, max: number, what: string): string {
  const s = str(v).trim();
  if (s.length > max) throw new UserError(`The ${what} can be up to ${max} characters.`);
  return s;
}

function intOrNull(v: unknown, what: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1_000_000) throw new UserError(`Invalid ${what}.`);
  return n;
}

const commentOut = (r: any) => ({
  id: r.id,
  authorName: nameOf(r),
  authorRole: r.role,
  measure: r.measure,
  staff: r.staff ?? null,
  text: r.text,
  createdAt: iso(r.created_at),
  resolved: !!r.resolved,
});

async function getComment(c: Ctx, id: unknown) {
  const comment = await c.first(
    `SELECT cm.*, u.username, u.display_name, u.role FROM comments cm JOIN users u ON u.id = cm.author_id WHERE cm.id = ?`,
    str(id),
  );
  if (!comment) throw new UserError('That comment was not found.', 404);
  return comment;
}

// ---------------------------------------------------------------------------
// Actions

async function runAction(c: Ctx, action: string, p: Record<string, any>): Promise<Record<string, unknown>> {
  switch (action) {
    // ---- accounts -----------------------------------------------------------
    case 'signup': {
      const username = normUsername(p.username);
      checkUsername(username);
      const password = str(p.password);
      checkPassword(password);
      const displayName = cleanDisplayName(p.displayName);
      const teacherKey = str(p.teacherKey).trim();
      let role: 'student' | 'teacher' = 'student';
      let classRow: any = null;
      if (teacherKey) {
        const master = str(c.env.MASTER_TEACHER_PIN).trim();
        if (!master || teacherKey !== master) throw new UserError('That teacher key is not right.', 403);
        role = 'teacher';
      } else {
        const code = normCode(p.classCode);
        if (!code) throw new UserError('Please enter the class code from your teacher.');
        classRow = await c.first(`SELECT id FROM classes WHERE code = ?`, code);
        if (!classRow) throw new UserError('That class code was not found. Check it with your teacher.', 404);
      }
      if (await c.first(`SELECT 1 AS x FROM users WHERE username = ?`, username)) {
        throw new UserError('That username is taken. Please choose another one.', 409);
      }
      const id = randomId('u');
      const t = now();
      const writes = [
        c.q(`INSERT INTO users (id, username, display_name, role, pw_hash, created_at, last_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          id, username, displayName, role, await hashPassword(password), t, t),
      ];
      if (classRow) writes.push(c.q(`INSERT INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)`, classRow.id, id, t));
      try {
        await c.db.batch(writes);
      } catch (e) {
        if (/UNIQUE/i.test(String((e as Error)?.message))) throw new UserError('That username is taken. Please choose another one.', 409);
        throw e;
      }
      const user = (await c.first<UserRow>(`SELECT * FROM users WHERE id = ?`, id))!;
      return { token: await newSession(c, id), user: userOut(user), classes: await classesFor(c, user) };
    }

    case 'login': {
      const username = normUsername(p.username);
      const password = str(p.password);
      if (!username || !password) throw new UserError('Please enter your username and password.');
      const t = now();
      const recent = await c.first<{ n: number }>(
        `SELECT COUNT(*) AS n FROM login_attempts WHERE username = ? AND at > ?`,
        username,
        t - LOGIN_WINDOW_MS,
      );
      if ((recent?.n ?? 0) >= LOGIN_MAX_FAILS) {
        throw new UserError('Too many wrong passwords. Please wait 15 minutes and try again, or ask your teacher to reset your password.', 429);
      }
      const user = await c.first<UserRow>(`SELECT * FROM users WHERE username = ?`, username);
      const check = user ? await verifyPassword(password, user.pw_hash) : { ok: false, needsRehash: false };
      if (!user || !check.ok) {
        await c.db.batch([
          c.q(`DELETE FROM login_attempts WHERE at <= ?`, t - LOGIN_WINDOW_MS),
          c.q(`INSERT INTO login_attempts (username, at) VALUES (?, ?)`, username, t),
        ]);
        throw new UserError('Wrong username or password.', 401);
      }
      const writes = [c.q(`DELETE FROM login_attempts WHERE username = ?`, username)];
      if (check.needsRehash) writes.push(c.q(`UPDATE users SET pw_hash = ? WHERE id = ?`, await hashPassword(password), user.id));
      await c.db.batch(writes);
      return { token: await newSession(c, user.id), user: userOut(user), classes: await classesFor(c, user) };
    }

    case 'logout': {
      if (c.token) await c.run(`DELETE FROM sessions WHERE token_hash = ?`, await sha256(c.token));
      return {};
    }

    case 'me': {
      const u = await c.user();
      return { user: userOut(u), classes: await classesFor(c, u) };
    }

    case 'change_password': {
      const u = await c.user();
      const newPassword = str(p.newPassword);
      if (!(await verifyPassword(str(p.oldPassword), u.pw_hash)).ok) throw new UserError('Your current password is not right.', 403);
      checkPassword(newPassword);
      // Sign out every other device.
      await c.db.batch([
        c.q(`UPDATE users SET pw_hash = ? WHERE id = ?`, await hashPassword(newPassword), u.id),
        c.q(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`, u.id, await sha256(c.token)),
      ]);
      return {};
    }

    // ---- classes ------------------------------------------------------------
    case 'class_create': {
      const u = await c.teacher();
      const name = cleanText(p.name, 60, 'class name');
      if (!name) throw new UserError('Please give the class a name.');
      if (containsProfanity(name)) throw new UserError('Please use a school-appropriate class name.');
      const id = randomId('c');
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = joinCode();
        if (await c.first(`SELECT 1 AS x FROM classes WHERE code = ?`, code)) continue;
        try {
          await c.run(`INSERT INTO classes (id, name, code, teacher_id, created_at) VALUES (?, ?, ?, ?, ?)`, id, name, code, u.id, now());
        } catch (e) {
          if (/UNIQUE/i.test(String((e as Error)?.message))) continue;
          throw e;
        }
        return { class: { id, name, code, teacherName: nameOf(u) } };
      }
      throw new UserError('Could not make a class code. Please try again.', 500);
    }

    case 'class_list': {
      const u = await c.teacher();
      const classes = await c.all(`SELECT id, name, code FROM classes WHERE teacher_id = ? ORDER BY created_at`, u.id);
      const members = await c.all(
        `SELECT m.class_id, s.id, s.username, s.display_name, s.last_active,
           (SELECT COUNT(*) FROM scores sc WHERE sc.owner_id = s.id) AS score_count
         FROM class_members m JOIN classes cl ON cl.id = m.class_id JOIN users s ON s.id = m.user_id
         WHERE cl.teacher_id = ? ORDER BY s.username`,
        u.id,
      );
      return {
        classes: classes.map((cl: any) => ({
          id: cl.id,
          name: cl.name,
          code: cl.code,
          members: members
            .filter((m: any) => m.class_id === cl.id)
            .map((m: any) => ({
              id: m.id,
              username: m.username,
              displayName: m.display_name || '',
              scoreCount: Number(m.score_count) || 0,
              lastActive: iso(m.last_active),
            })),
        })),
      };
    }

    case 'class_join': {
      const u = await c.user();
      if (u.role !== 'student') throw new UserError('Teachers make classes instead of joining them.', 403);
      const code = normCode(p.code);
      const cl = code ? await c.first(`SELECT id FROM classes WHERE code = ?`, code) : null;
      if (!cl) throw new UserError('That class code was not found. Check it with your teacher.', 404);
      await c.run(`INSERT OR IGNORE INTO class_members (class_id, user_id, joined_at) VALUES (?, ?, ?)`, cl.id, u.id, now());
      return { classes: await classesFor(c, u) };
    }

    case 'class_remove_member': {
      const u = await c.teacher();
      const cl = await c.first(`SELECT id FROM classes WHERE id = ? AND teacher_id = ?`, str(p.classId), u.id);
      if (!cl) throw new UserError('That class was not found.', 404);
      await c.run(`DELETE FROM class_members WHERE class_id = ? AND user_id = ?`, cl.id, str(p.userId));
      return {};
    }

    case 'teacher_reset_password': {
      const u = await c.teacher();
      const userId = str(p.userId);
      const student = await c.first<UserRow>(`SELECT * FROM users WHERE id = ?`, userId);
      if (!student || student.role !== 'student' || !(await isTeacherOf(c, u.id, userId))) {
        throw new UserError('That student is not in one of your classes.', 403);
      }
      const newPassword = str(p.newPassword);
      checkPassword(newPassword);
      await c.db.batch([
        c.q(`UPDATE users SET pw_hash = ? WHERE id = ?`, await hashPassword(newPassword), userId),
        c.q(`DELETE FROM sessions WHERE user_id = ?`, userId),
        c.q(`DELETE FROM login_attempts WHERE username = ?`, student.username),
      ]);
      return {};
    }

    // ---- scores -------------------------------------------------------------
    case 'score_list': {
      const u = await c.user();
      const mapRow = (r: any) => ({
        id: r.id,
        title: r.title,
        composer: r.composer,
        updatedAt: iso(r.updated_at),
        version: r.version,
        ownerId: r.owner_id,
        ownerName: r.owner_display || r.owner_username,
        shared: r.owner_id !== u.id,
        canEdit: r.owner_id === u.id || !!r.is_collab,
      });
      const cols = `s.id, s.title, s.composer, s.updated_at, s.version, s.owner_id, o.username AS owner_username, o.display_name AS owner_display`;
      const userId = str(p.userId);
      if (userId && userId !== u.id) {
        if (u.role !== 'teacher' || !(await isTeacherOf(c, u.id, userId))) {
          throw new UserError('That student is not in one of your classes.', 403);
        }
        const rows = await c.all(
          `SELECT ${cols}, EXISTS(SELECT 1 FROM score_collaborators k WHERE k.score_id = s.id AND k.user_id = ?) AS is_collab
           FROM scores s JOIN users o ON o.id = s.owner_id WHERE s.owner_id = ? ORDER BY s.updated_at DESC`,
          u.id,
          userId,
        );
        return { scores: rows.map(mapRow) };
      }
      const rows = await c.all(
        `SELECT ${cols}, 0 AS is_collab FROM scores s JOIN users o ON o.id = s.owner_id WHERE s.owner_id = ?
         UNION ALL
         SELECT ${cols}, 1 AS is_collab FROM score_collaborators k JOIN scores s ON s.id = k.score_id JOIN users o ON o.id = s.owner_id
           WHERE k.user_id = ? AND s.owner_id <> ?
         ORDER BY updated_at DESC`,
        u.id,
        u.id,
        u.id,
      );
      return { scores: rows.map(mapRow) };
    }

    case 'score_get': {
      const u = await c.user();
      const { score, canEdit, isOwner } = await readableScore(c, u, p.id, true);
      const collabs = await c.all(
        `SELECT u.username FROM score_collaborators k JOIN users u ON u.id = k.user_id WHERE k.score_id = ? ORDER BY u.username`,
        score.id,
      );
      return {
        score: {
          id: score.id,
          title: score.title,
          composer: score.composer,
          mei: score.mei,
          updatedAt: iso(score.updated_at),
          version: score.version,
          ownerId: score.owner_id,
          ownerName: score.owner_display || score.owner_username,
          canEdit,
          shareToken: isOwner ? score.share_token ?? null : null,
          collaborators: collabs.map((r: any) => r.username),
        },
      };
    }

    case 'score_save': {
      const u = await c.user();
      if (typeof p.mei !== 'string' || !p.mei.trim()) throw new UserError('There is no music to save.');
      const mei: string = p.mei;
      const size = byteLength(mei);
      if (size > MAX_MEI_BYTES) throw new UserError('This score is too large to save online.', 413);
      const title = cleanText(p.title, 200, 'title') || 'Untitled';
      const composer = cleanText(p.composer, 200, 'composer');
      const t = now();
      let id = str(p.id);
      let version: number;

      if (!id) {
        id = randomId('s', 15);
        version = 1;
        await c.run(
          `INSERT INTO scores (id, owner_id, title, composer, mei, version, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          id, u.id, title, composer, mei, t, t, u.id,
        );
      } else {
        const a = await scoreAccess(c, u, id);
        if (!a.canRead) throw new UserError('That score was not found.', 404);
        if (!a.canEdit) throw new UserError('You can view this score but not change it.', 403);
        const hasBase = p.baseVersion !== undefined && p.baseVersion !== null && p.baseVersion !== '';
        const base = hasBase ? Number(p.baseVersion) : a.score.version;
        const conflict = async () => {
          const cur = await c.first(
            `SELECT s.version, u.username, u.display_name FROM scores s LEFT JOIN users u ON u.id = s.updated_by WHERE s.id = ?`,
            id,
          );
          return new UserError('Someone else saved this score while you were editing.', 409, {
            conflict: true,
            version: cur?.version ?? a.score.version,
            updatedBy: cur ? nameOf(cur) : '',
          });
        };
        if (hasBase && base !== a.score.version) throw await conflict();
        const res = await c.run(
          `UPDATE scores SET title = ?, composer = ?, mei = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ? AND version = ?`,
          title, composer, mei, t, u.id, id, a.score.version,
        );
        if ((res?.meta?.changes ?? 1) === 0) {
          // Another save landed between our read and write.
          if (hasBase) throw await conflict();
          throw new UserError('Someone else is saving this score right now. Please try again.', 409);
        }
        version = a.score.version + 1;
      }

      // Version history: snapshot on the first save, then at most every 10 minutes; keep the newest 30.
      const last = await c.first<{ n: number; saved_at: number }>(
        `SELECT n, saved_at FROM score_versions WHERE score_id = ? ORDER BY n DESC LIMIT 1`,
        id,
      );
      if (!last || t - last.saved_at >= SNAPSHOT_EVERY_MS) {
        const n = (last?.n ?? 0) + 1;
        await c.db.batch([
          c.q(`INSERT INTO score_versions (score_id, n, mei, saved_at, saved_by, size) VALUES (?, ?, ?, ?, ?, ?)`, id, n, mei, t, u.id, size),
          c.q(`DELETE FROM score_versions WHERE score_id = ? AND n <= ?`, id, n - MAX_SNAPSHOTS),
        ]);
      }
      return { id, version, updatedAt: iso(t) };
    }

    case 'score_delete': {
      const u = await c.user();
      const { score } = await ownedScore(c, u, p.id);
      await c.db.batch([
        c.q(`DELETE FROM score_versions WHERE score_id = ?`, score.id),
        c.q(`DELETE FROM comments WHERE score_id = ?`, score.id),
        c.q(`DELETE FROM score_collaborators WHERE score_id = ?`, score.id),
        c.q(`DELETE FROM scores WHERE id = ?`, score.id),
      ]);
      return {};
    }

    case 'score_versions': {
      const u = await c.user();
      const { score } = await readableScore(c, u, p.id);
      const rows = await c.all(
        `SELECT v.n, v.saved_at, v.size, u.username, u.display_name FROM score_versions v LEFT JOIN users u ON u.id = v.saved_by
         WHERE v.score_id = ? ORDER BY v.n DESC`,
        score.id,
      );
      return { versions: rows.map((r: any) => ({ n: r.n, savedAt: iso(r.saved_at), savedBy: nameOf(r), size: r.size })) };
    }

    case 'score_version_get': {
      const u = await c.user();
      const { score } = await readableScore(c, u, p.id);
      const row = await c.first(`SELECT mei FROM score_versions WHERE score_id = ? AND n = ?`, score.id, Number(p.n));
      if (!row) throw new UserError('That saved version was not found.', 404);
      return { mei: row.mei };
    }

    case 'score_share_link': {
      const u = await c.user();
      const { score } = await ownedScore(c, u, p.id);
      let shareToken: string | null = null;
      if (p.enabled) {
        shareToken = score.share_token || b64url(randomBytes(18));
        if (shareToken !== score.share_token) await c.run(`UPDATE scores SET share_token = ? WHERE id = ?`, shareToken, score.id);
      } else if (score.share_token) {
        await c.run(`UPDATE scores SET share_token = NULL WHERE id = ?`, score.id);
      }
      return { shareToken };
    }

    case 'shared_get': {
      const token = str(p.shareToken).trim();
      const row =
        token && token.length < 100
          ? await c.first(
              `SELECT s.title, s.composer, s.mei, o.username, o.display_name FROM scores s JOIN users o ON o.id = s.owner_id WHERE s.share_token = ?`,
              token,
            )
          : null;
      if (!row) throw new UserError('This score is no longer shared.', 404);
      return { title: row.title, composer: row.composer, mei: row.mei, ownerName: nameOf(row) };
    }

    case 'score_collaborators': {
      const u = await c.user();
      const { score } = await ownedScore(c, u, p.id);
      if (!Array.isArray(p.usernames)) throw new UserError('Usernames must be a list.');
      if (p.usernames.length > 50) throw new UserError('A score can have up to 50 collaborators.');
      const wanted = [...new Set(p.usernames.map(normUsername).filter(Boolean))] as string[];
      const keep: { id: string; username: string }[] = [];
      const skipped: string[] = [];
      for (const name of wanted) {
        const other = await c.first(`SELECT id, username FROM users WHERE username = ?`, name);
        if (!other || other.id === u.id || !(await shareAClass(c, u.id, other.id))) skipped.push(name);
        else keep.push(other);
      }
      await c.db.batch([
        c.q(`DELETE FROM score_collaborators WHERE score_id = ?`, score.id),
        ...keep.map((k) => c.q(`INSERT INTO score_collaborators (score_id, user_id) VALUES (?, ?)`, score.id, k.id)),
      ]);
      return { collaborators: keep.map((k) => k.username).sort(), skipped };
    }

    // ---- comments -----------------------------------------------------------
    case 'comments_list': {
      const u = await c.user();
      const { score } = await readableScore(c, u, p.scoreId);
      const rows = await c.all(
        `SELECT cm.*, u.username, u.display_name, u.role FROM comments cm JOIN users u ON u.id = cm.author_id
         WHERE cm.score_id = ? ORDER BY cm.measure, cm.created_at`,
        score.id,
      );
      return { comments: rows.map(commentOut) };
    }

    case 'comment_add': {
      const u = await c.user();
      const { score } = await readableScore(c, u, p.scoreId);
      const measure = intOrNull(p.measure, 'measure');
      if (measure === null) throw new UserError('Please pick a measure for the comment.');
      const staff = intOrNull(p.staff, 'staff');
      const text = str(p.text).trim();
      if (!text) throw new UserError('The comment is empty.');
      if (text.length > MAX_COMMENT) throw new UserError(`Comments can be up to ${MAX_COMMENT} characters.`);
      const count = await c.first<{ n: number }>(`SELECT COUNT(*) AS n FROM comments WHERE score_id = ?`, score.id);
      if ((count?.n ?? 0) >= 500) throw new UserError('This score has too many comments. Delete some resolved ones first.');
      const id = randomId('cm');
      await c.run(
        `INSERT INTO comments (id, score_id, author_id, measure, staff, text, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        id, score.id, u.id, measure, staff, text, now(),
      );
      return { comment: commentOut(await getComment(c, id)) };
    }

    case 'comment_resolve': {
      const u = await c.user();
      const comment = await getComment(c, p.id);
      await readableScore(c, u, comment.score_id);
      await c.run(`UPDATE comments SET resolved = ? WHERE id = ?`, p.resolved ? 1 : 0, comment.id);
      return { comment: commentOut({ ...comment, resolved: p.resolved ? 1 : 0 }) };
    }

    case 'comment_delete': {
      const u = await c.user();
      const comment = await getComment(c, p.id);
      const a = await readableScore(c, u, comment.score_id);
      if (comment.author_id !== u.id && !a.isOwner && !a.isTeacher) {
        throw new UserError('Only the comment author, the score owner or a teacher can delete this comment.', 403);
      }
      await c.run(`DELETE FROM comments WHERE id = ?`, comment.id);
      return {};
    }
  }
  throw new UserError('Unknown action: ' + action);
}
