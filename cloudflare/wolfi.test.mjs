// Checks /api/wolfi (Wolfi accounts, classes and cloud scores) against an in-memory SQLite database
// wrapped to look like Cloudflare D1.
// Run: node cloudflare/wolfi.test.mjs   (no network; needs Node 22.5+ for node:sqlite)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const dir = mkdtempSync(join(tmpdir(), 'wolfi-test-'));
const out = join(dir, 'wolfi.mjs');
await build({ entryPoints: ['src/server/wolfi.ts'], bundle: true, format: 'esm', platform: 'neutral', mainFields: ['module', 'main'], conditions: ['worker', 'browser'], external: ['node:*'], outfile: out, logLevel: 'warning' });
const { handleWolfi } = await import(pathToFileURL(out).href);
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
const env = { WOLFI_DB: d1(sqlite), MASTER_TEACHER_PIN: 'T3acher!' };

const call = async (body, token, e = env, raw) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await handleWolfi(new Request('https://x/api/wolfi', { method: 'POST', body: raw ?? JSON.stringify(body), headers }), e);
  return [res.status, await res.json()];
};
let fails = 0, passes = 0;
const expect = (name, ok, got) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(got).slice(0, 300)));
  if (ok) passes++; else fails++;
};
const sql = (q, ...a) => sqlite.prepare(q).run(...a);
const MEI = (n) => `<mei xmlns="http://www.music-encoding.org/ns/mei"><music><body><mdiv><score><!-- ${n} --></score></mdiv></body></music></mei>`;

let r;

// ---- setup / transport ----
r = await call({ action: 'me' }, null, { MASTER_TEACHER_PIN: 'x' });
expect('no WOLFI_DB -> 503', r[0] === 503 && r[1].ok === false && r[1].error === 'Online saving is not set up yet.', r);
{
  const res = await handleWolfi(new Request('https://x/api/wolfi'), env);
  expect('GET -> 405', res.status === 405, res.status);
}
r = await call(null, null, env, '{not json');
expect('bad JSON -> 400', r[0] === 400 && !r[1].ok, r);
r = await call({ action: 'nope' });
expect('unknown action -> 400', r[0] === 400 && /Unknown action/.test(r[1].error), r);
r = await call({ action: 'me' });
expect('me without token -> 401', r[0] === 401 && !r[1].ok, r);
r = await call({ action: 'me' }, 'garbage');
expect('me with bad token -> 401', r[0] === 401, r);
r = await call(null, null, env, JSON.stringify({ action: 'me', pad: 'x'.repeat(3.2 * 1024 * 1024) }));
expect('body over 3 MB -> 413', r[0] === 413 && !r[1].ok, r);

// ---- teacher signup ----
r = await call({ action: 'signup', username: 'MrArthur', password: 'password1', teacherKey: 'wrong' });
expect('teacher signup with wrong key -> 403', r[0] === 403, r);
r = await call({ action: 'signup', username: 'mrarthur', password: 'password1', teacherKey: 'T3acher!' }, null, { WOLFI_DB: env.WOLFI_DB });
expect('teacher signup when no key configured -> 403', r[0] === 403, r);
r = await call({ action: 'signup', username: 'MrArthur', password: 'password1', displayName: 'Mr. Arthur', teacherKey: 'T3acher!' });
expect('teacher signup', r[0] === 200 && r[1].ok && r[1].token && r[1].user.role === 'teacher' && r[1].user.username === 'mrarthur' && r[1].user.displayName === 'Mr. Arthur' && Array.isArray(r[1].classes), r);
const teacher = { token: r[1].token, id: r[1].user.id };
expect('token is 43-char base64url', /^[A-Za-z0-9_-]{43}$/.test(teacher.token), teacher.token);
{
  const row = sqlite.prepare('SELECT * FROM sessions').get();
  expect('only token hash stored', row.token_hash !== teacher.token && row.token_hash.length === 43, row);
  const u = sqlite.prepare('SELECT * FROM users').get();
  expect('password stored as pbkdf2 with iterations', /^pbkdf2-sha256\$10000\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/.test(u.pw_hash), u.pw_hash);
  const cols = sqlite.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
  expect('no email column', !cols.some((c) => /mail/i.test(c)), cols);
}
r = await call({ action: 'signup', username: 'mrarthur', password: 'password1', teacherKey: 'T3acher!' });
expect('duplicate username (case-insensitive) -> 409', r[0] === 409, r);

// ---- username / password rules ----
for (const [u, why] of [['ab', 'too short'], ['a'.repeat(25), 'too long'], ['has space', 'space'], ['emoji😀', 'emoji'], ['bad!name', 'punctuation']]) {
  r = await call({ action: 'signup', username: u, password: 'password1', teacherKey: 'T3acher!' });
  expect(`username rejected (${why})`, r[0] === 400 && !r[1].ok, r);
}
r = await call({ action: 'signup', username: 'ok.name_1-x', password: 'short', teacherKey: 'T3acher!' });
expect('short password rejected', r[0] === 400 && /8 characters/.test(r[1].error), r);
r = await call({ action: 'signup', username: 'shithead', password: 'password1', teacherKey: 'T3acher!' });
expect('inappropriate username rejected', r[0] === 400, r);

// ---- classes ----
r = await call({ action: 'class_create', name: 'Band 7' }, teacher.token);
expect('class_create', r[0] === 200 && r[1].class.name === 'Band 7' && /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(r[1].class.code) && r[1].class.teacherName === 'Mr. Arthur', r);
const band = r[1].class;
r = await call({ action: 'class_create', name: 'Chorus 8' }, teacher.token);
const chorus = r[1].class;
r = await call({ action: 'class_create', name: '' }, teacher.token);
expect('class_create needs a name', r[0] === 400, r);

// ---- student signup ----
r = await call({ action: 'signup', username: 'alice', password: 'password1' });
expect('student signup without class code -> 400', r[0] === 400, r);
r = await call({ action: 'signup', username: 'alice', password: 'password1', classCode: 'ZZZZZZ' });
expect('student signup with unknown code -> 404', r[0] === 404, r);
r = await call({ action: 'signup', username: 'Alice', password: 'password1', classCode: band.code.toLowerCase() });
expect('student signup (code case-insensitive)', r[0] === 200 && r[1].user.role === 'student' && r[1].user.displayName === '' && r[1].classes.length === 1 && r[1].classes[0].id === band.id && r[1].classes[0].teacherName === 'Mr. Arthur', r);
const alice = { token: r[1].token, id: r[1].user.id };
r = await call({ action: 'signup', username: 'bob', password: 'password2', displayName: 'Bob B', classCode: band.code });
const bob = { token: r[1].token, id: r[1].user.id };
r = await call({ action: 'signup', username: 'carol', password: 'password3', classCode: chorus.code });
const carol = { token: r[1].token, id: r[1].user.id };
r = await call({ action: 'signup', username: 'MsOther', password: 'password4', teacherKey: 'T3acher!' });
const other = { token: r[1].token, id: r[1].user.id };
r = await call({ action: 'class_create', name: 'Other class' }, other.token);
const otherClass = r[1].class;
r = await call({ action: 'signup', username: 'dave', password: 'password5', classCode: otherClass.code });
const dave = { token: r[1].token, id: r[1].user.id };

r = await call({ action: 'class_create', name: 'Nope' }, alice.token);
expect('student cannot class_create -> 403', r[0] === 403, r);
r = await call({ action: 'class_list' }, alice.token);
expect('student cannot class_list -> 403', r[0] === 403, r);
r = await call({ action: 'class_join', code: chorus.code }, teacher.token);
expect('teacher cannot class_join -> 403', r[0] === 403, r);
r = await call({ action: 'class_join', code: 'ZZZZZZ' }, alice.token);
expect('class_join unknown code -> 404', r[0] === 404, r);
r = await call({ action: 'class_join', code: chorus.code }, alice.token);
expect('class_join', r[0] === 200 && r[1].classes.length === 2, r);
r = await call({ action: 'class_join', code: chorus.code }, alice.token);
expect('class_join twice is harmless', r[0] === 200 && r[1].classes.length === 2, r);

r = await call({ action: 'me' }, alice.token);
expect('me (student)', r[0] === 200 && r[1].user.username === 'alice' && r[1].classes.map((c) => c.name).join() === 'Band 7,Chorus 8', r);
r = await call({ action: 'me' }, teacher.token);
expect('me (teacher) lists owned classes', r[0] === 200 && r[1].classes.length === 2 && r[1].classes[0].code === band.code, r);

// ---- scores ----
r = await call({ action: 'score_save', title: 'My Song', composer: 'Alice', mei: MEI(1) }, alice.token);
expect('score_save new', r[0] === 200 && r[1].id && r[1].version === 1 && !isNaN(Date.parse(r[1].updatedAt)), r);
const song = r[1].id;
r = await call({ action: 'score_save', title: 'x', mei: '' }, alice.token);
expect('score_save without mei -> 400', r[0] === 400, r);
r = await call({ action: 'score_save', title: 'Big', mei: 'x'.repeat(1.85 * 1024 * 1024) }, alice.token);
expect('MEI over 1.8 MB -> 413', r[0] === 413 && !r[1].ok, r);
r = await call({ action: 'score_save', id: 'no_such', title: 'x', mei: MEI(0) }, alice.token);
expect('score_save unknown id -> 404', r[0] === 404, r);

r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(2), baseVersion: 1 }, alice.token);
expect('score_save with matching baseVersion', r[0] === 200 && r[1].id === song && r[1].version === 2, r);
r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(3), baseVersion: 1 }, alice.token);
expect('stale baseVersion -> 409 conflict', r[0] === 409 && r[1].ok === false && r[1].conflict === true && r[1].version === 2 && r[1].updatedBy === 'alice' && r[1].error, r);
r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(3) }, alice.token);
expect('overwrite without baseVersion', r[0] === 200 && r[1].version === 3, r);

r = await call({ action: 'score_get', id: song }, alice.token);
expect('score_get (owner)', r[0] === 200 && r[1].score.mei === MEI(3) && r[1].score.version === 3 && r[1].score.canEdit === true && r[1].score.shareToken === null && Array.isArray(r[1].score.collaborators) && r[1].score.ownerName === 'alice' && r[1].score.title === 'My Song' && r[1].score.composer === 'Alice', r);

// permissions to read
r = await call({ action: 'score_get', id: song }, bob.token);
expect('classmate cannot read unshared score -> 404', r[0] === 404, r);
r = await call({ action: 'score_get', id: song }, dave.token);
expect('student from another class cannot read -> 404', r[0] === 404, r);
r = await call({ action: 'score_get', id: song }, other.token);
expect('teacher of another class cannot read -> 404', r[0] === 404, r);
r = await call({ action: 'score_get', id: song }, teacher.token);
expect('teacher of the class can read (read-only)', r[0] === 200 && r[1].score.canEdit === false && r[1].score.mei === MEI(3), r);
r = await call({ action: 'score_save', id: song, title: 'Hack', mei: MEI(9) }, teacher.token);
expect('teacher (not collaborator) cannot save -> 403', r[0] === 403, r);
r = await call({ action: 'score_save', id: song, title: 'Hack', mei: MEI(9) }, bob.token);
expect('classmate cannot save -> 404', r[0] === 404, r);

// score_list
r = await call({ action: 'score_list' }, alice.token);
expect('score_list own', r[0] === 200 && r[1].scores.length === 1 && r[1].scores[0].id === song && r[1].scores[0].shared === false && r[1].scores[0].canEdit === true && r[1].scores[0].ownerId === alice.id && r[1].scores[0].version === 3 && !('mei' in r[1].scores[0]), r);
r = await call({ action: 'score_list' }, bob.token);
expect('score_list for bob is empty', r[0] === 200 && r[1].scores.length === 0, r);
r = await call({ action: 'score_list', userId: alice.id }, teacher.token);
expect('teacher lists a student\'s scores', r[0] === 200 && r[1].scores.length === 1 && r[1].scores[0].canEdit === false, r);
r = await call({ action: 'score_list', userId: alice.id }, other.token);
expect('other teacher cannot list student -> 403', r[0] === 403, r);
r = await call({ action: 'score_list', userId: alice.id }, bob.token);
expect('student cannot list another student -> 403', r[0] === 403, r);

// collaborators
r = await call({ action: 'score_collaborators', id: song, usernames: ['Bob', 'dave', 'nobody', 'alice', 'carol'] }, alice.token);
expect('score_collaborators adds classmates, skips others', r[0] === 200 && r[1].collaborators.join() === 'bob,carol' && r[1].skipped.sort().join() === 'alice,dave,nobody', r);
r = await call({ action: 'score_collaborators', id: song, usernames: ['bob'] }, bob.token);
expect('collaborator cannot change collaborators -> 403', r[0] === 403, r);
r = await call({ action: 'score_list' }, bob.token);
expect('shared score appears for collaborator', r[0] === 200 && r[1].scores.length === 1 && r[1].scores[0].shared === true && r[1].scores[0].canEdit === true && r[1].scores[0].ownerName === 'alice', r);
r = await call({ action: 'score_get', id: song }, bob.token);
expect('collaborator can read', r[0] === 200 && r[1].score.canEdit && r[1].score.collaborators.join() === 'bob,carol' && r[1].score.shareToken === null, r);
r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(4), baseVersion: 3 }, bob.token);
expect('collaborator can save', r[0] === 200 && r[1].version === 4, r);
r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(5), baseVersion: 3 }, alice.token);
expect('conflict reports who saved last', r[0] === 409 && r[1].conflict && r[1].updatedBy === 'Bob B' && r[1].version === 4, r);
r = await call({ action: 'score_delete', id: song }, bob.token);
expect('collaborator cannot delete -> 403', r[0] === 403, r);
r = await call({ action: 'score_collaborators', id: song, usernames: ['carol'] }, alice.token);
expect('collaborator list replaced', r[0] === 200 && r[1].collaborators.join() === 'carol' && r[1].skipped.length === 0, r);
r = await call({ action: 'score_get', id: song }, bob.token);
expect('removed collaborator loses access', r[0] === 404, r);
r = await call({ action: 'score_collaborators', id: song, usernames: 'carol' }, alice.token);
expect('usernames must be an array', r[0] === 400, r);
// teacher can be a collaborator (shares a class with the owner)
r = await call({ action: 'score_collaborators', id: song, usernames: ['carol', 'mrarthur'] }, alice.token);
expect('teacher of owner can be added as collaborator', r[0] === 200 && r[1].collaborators.join() === 'carol,mrarthur', r);
r = await call({ action: 'score_get', id: song }, teacher.token);
expect('teacher collaborator canEdit', r[0] === 200 && r[1].score.canEdit === true, r);
r = await call({ action: 'score_collaborators', id: song, usernames: ['carol'] }, alice.token);

// versions
{
  const n = sqlite.prepare('SELECT COUNT(*) AS n FROM score_versions WHERE score_id = ?').get(song).n;
  expect('only one snapshot within 10 minutes', n === 1, n);
}
sql('UPDATE score_versions SET saved_at = saved_at - 11*60*1000 WHERE score_id = ?', song);
r = await call({ action: 'score_save', id: song, title: 'My Song', composer: 'Alice', mei: MEI(6) }, alice.token);
r = await call({ action: 'score_versions', id: song }, alice.token);
expect('snapshot after 10 minutes', r[0] === 200 && r[1].versions.length === 2 && r[1].versions[0].n === 2 && r[1].versions[0].savedBy === 'alice' && r[1].versions[0].size === MEI(6).length && !isNaN(Date.parse(r[1].versions[0].savedAt)), r);
r = await call({ action: 'score_version_get', id: song, n: 1 }, alice.token);
expect('score_version_get first snapshot', r[0] === 200 && r[1].mei === MEI(1), r);
r = await call({ action: 'score_version_get', id: song, n: 99 }, alice.token);
expect('score_version_get missing -> 404', r[0] === 404, r);
r = await call({ action: 'score_versions', id: song }, teacher.token);
expect('teacher can list versions', r[0] === 200 && r[1].versions.length === 2, r);
r = await call({ action: 'score_versions', id: song }, bob.token);
expect('outsider cannot list versions -> 404', r[0] === 404, r);
for (let i = 0; i < 32; i++) {
  sql('UPDATE score_versions SET saved_at = saved_at - 11*60*1000 WHERE score_id = ?', song);
  await call({ action: 'score_save', id: song, title: 'My Song', mei: MEI(100 + i) }, alice.token);
}
r = await call({ action: 'score_versions', id: song }, alice.token);
expect('at most 30 snapshots kept, newest first', r[1].versions.length === 30 && r[1].versions[0].n === 34 && r[1].versions[29].n === 5, r[1].versions.map((v) => v.n));

// share links
r = await call({ action: 'score_share_link', id: song, enabled: true }, carol.token);
expect('collaborator cannot make share link -> 403', r[0] === 403, r);
r = await call({ action: 'score_share_link', id: song, enabled: true }, alice.token);
const shareToken = r[1].shareToken;
expect('score_share_link on', r[0] === 200 && typeof shareToken === 'string' && shareToken.length >= 20, r);
r = await call({ action: 'score_share_link', id: song, enabled: true }, alice.token);
expect('share link is stable', r[1].shareToken === shareToken, r);
r = await call({ action: 'score_get', id: song }, alice.token);
expect('score_get shows shareToken to owner', r[1].score.shareToken === shareToken, r);
r = await call({ action: 'shared_get', shareToken });
expect('shared_get without login', r[0] === 200 && r[1].title === 'My Song' && r[1].mei === MEI(131) && r[1].ownerName === 'alice' && !('id' in r[1]), r);
r = await call({ action: 'shared_get', shareToken: 'nope' });
expect('shared_get bad token -> 404', r[0] === 404, r);
r = await call({ action: 'score_share_link', id: song, enabled: false }, alice.token);
expect('score_share_link off', r[0] === 200 && r[1].shareToken === null, r);
r = await call({ action: 'shared_get', shareToken });
expect('disabled link stops working', r[0] === 404, r);

// comments
r = await call({ action: 'comment_add', scoreId: song, measure: 3, text: 'Nice phrase here!' }, teacher.token);
expect('teacher comment_add', r[0] === 200 && r[1].comment.authorName === 'Mr. Arthur' && r[1].comment.authorRole === 'teacher' && r[1].comment.measure === 3 && r[1].comment.staff === null && r[1].comment.resolved === false && !isNaN(Date.parse(r[1].comment.createdAt)), r);
const tComment = r[1].comment.id;
r = await call({ action: 'comment_add', scoreId: song, measure: 1, staff: 2, text: 'Check this rhythm' }, carol.token);
expect('collaborator comment_add with staff', r[0] === 200 && r[1].comment.staff === 2 && r[1].comment.authorRole === 'student', r);
const cComment = r[1].comment.id;
r = await call({ action: 'comment_add', scoreId: song, measure: 1, text: 'x' }, bob.token);
expect('outsider cannot comment -> 404', r[0] === 404, r);
r = await call({ action: 'comment_add', scoreId: song, measure: 1, text: 'x'.repeat(1001) }, alice.token);
expect('comment over 1000 chars -> 400', r[0] === 400, r);
r = await call({ action: 'comment_add', scoreId: song, measure: 1, text: '   ' }, alice.token);
expect('empty comment -> 400', r[0] === 400, r);
r = await call({ action: 'comment_add', scoreId: song, text: 'no measure' }, alice.token);
expect('comment needs measure -> 400', r[0] === 400, r);
r = await call({ action: 'comments_list', scoreId: song }, alice.token);
expect('comments_list', r[0] === 200 && r[1].comments.length === 2 && r[1].comments[0].text === 'Check this rhythm', r);
r = await call({ action: 'comments_list', scoreId: song }, dave.token);
expect('outsider cannot list comments -> 404', r[0] === 404, r);
r = await call({ action: 'comment_resolve', id: tComment, resolved: true }, alice.token);
expect('comment_resolve', r[0] === 200 && r[1].comment.resolved === true, r);
r = await call({ action: 'comments_list', scoreId: song }, teacher.token);
expect('resolved shows in list', r[1].comments.find((c) => c.id === tComment).resolved === true, r);
r = await call({ action: 'comment_resolve', id: tComment, resolved: true }, bob.token);
expect('outsider cannot resolve -> 404', r[0] === 404, r);
r = await call({ action: 'comment_delete', id: tComment }, carol.token);
expect('collaborator cannot delete someone else\'s comment -> 403', r[0] === 403, r);
r = await call({ action: 'comment_delete', id: cComment }, carol.token);
expect('author deletes own comment', r[0] === 200, r);
r = await call({ action: 'comment_add', scoreId: song, measure: 2, text: 'hmm' }, carol.token);
const cComment2 = r[1].comment.id;
r = await call({ action: 'comment_delete', id: cComment2 }, teacher.token);
expect('teacher deletes a comment', r[0] === 200, r);
r = await call({ action: 'comment_delete', id: tComment }, alice.token);
expect('owner deletes a comment', r[0] === 200, r);
r = await call({ action: 'comment_delete', id: tComment }, alice.token);
expect('deleting missing comment -> 404', r[0] === 404, r);

// ---- class management ----
r = await call({ action: 'class_list' }, teacher.token);
{
  const b = r[1].classes?.find((c) => c.id === band.id);
  const a = b?.members.find((m) => m.username === 'alice');
  expect('class_list with members, scoreCount, lastActive', r[0] === 200 && r[1].classes.length === 2 && b.members.length === 2 && a.scoreCount === 1 && !isNaN(Date.parse(a.lastActive)) && a.displayName === '' && b.code === band.code, r);
}
r = await call({ action: 'class_list' }, other.token);
expect('other teacher only sees own classes', r[0] === 200 && r[1].classes.length === 1 && r[1].classes[0].id === otherClass.id, r);
r = await call({ action: 'class_remove_member', classId: band.id, userId: bob.id }, other.token);
expect('other teacher cannot remove member -> 404', r[0] === 404, r);
r = await call({ action: 'teacher_reset_password', userId: alice.id, newPassword: 'newpass99' }, other.token);
expect('other teacher cannot reset password -> 403', r[0] === 403, r);
r = await call({ action: 'teacher_reset_password', userId: alice.id, newPassword: 'newpass99' }, bob.token);
expect('student cannot reset password -> 403', r[0] === 403, r);
r = await call({ action: 'teacher_reset_password', userId: other.id, newPassword: 'newpass99' }, teacher.token);
expect('teacher cannot reset another teacher -> 403', r[0] === 403, r);
r = await call({ action: 'teacher_reset_password', userId: alice.id, newPassword: 'short' }, teacher.token);
expect('reset needs 8+ chars', r[0] === 400, r);
r = await call({ action: 'class_remove_member', classId: band.id, userId: bob.id }, teacher.token);
expect('class_remove_member', r[0] === 200 && r[1].ok, r);
r = await call({ action: 'me' }, bob.token);
expect('removed student has no classes', r[1].classes.length === 0, r);
r = await call({ action: 'score_list', userId: bob.id }, teacher.token);
expect('teacher can no longer list removed student', r[0] === 403, r);

// ---- login, rate limit, passwords, sessions ----
r = await call({ action: 'login', username: 'ALICE', password: 'password1' });
expect('login (username case-insensitive)', r[0] === 200 && r[1].token && r[1].user.id === alice.id && r[1].classes.length === 2, r);
const alice2 = r[1].token;
r = await call({ action: 'login', username: 'alice', password: 'wrongpass' });
expect('wrong password -> 401', r[0] === 401 && /Wrong username or password/.test(r[1].error), r);
r = await call({ action: 'login', username: 'ghost', password: 'whatever1' });
expect('unknown user -> 401 same message', r[0] === 401 && /Wrong username or password/.test(r[1].error), r);
for (let i = 0; i < 7; i++) await call({ action: 'login', username: 'alice', password: 'wrongpass' });
r = await call({ action: 'login', username: 'alice', password: 'password1' });
expect('9th attempt after 8 failures -> 429 even with right password', r[0] === 429 && !r[1].ok && /15 minutes/.test(r[1].error), r);
r = await call({ action: 'login', username: 'bob', password: 'password2' });
expect('rate limit is per username', r[0] === 200, r);
sql('UPDATE login_attempts SET at = at - 16*60*1000');
r = await call({ action: 'login', username: 'alice', password: 'password1' });
expect('allowed again after 15 minutes', r[0] === 200, r);
expect('failures cleared on success', sqlite.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE username='alice'").get().n === 0, null);
for (let i = 0; i < 8; i++) await call({ action: 'login', username: 'alice', password: 'wrongpass' });
r = await call({ action: 'teacher_reset_password', userId: alice.id, newPassword: 'newpass99' }, teacher.token);
expect('teacher_reset_password', r[0] === 200, r);
r = await call({ action: 'me' }, alice.token);
expect('reset signs the student out everywhere', r[0] === 401, r);
r = await call({ action: 'login', username: 'alice', password: 'newpass99' });
expect('reset clears lockout; new password works', r[0] === 200, r);
let aliceTok = r[1].token;
r = await call({ action: 'login', username: 'alice', password: 'password1' });
expect('old password no longer works', r[0] === 401, r);

r = await call({ action: 'login', username: 'alice', password: 'newpass99' });
const aliceOtherDevice = r[1].token;
r = await call({ action: 'change_password', oldPassword: 'nope', newPassword: 'another99' }, aliceTok);
expect('change_password with wrong old -> 403', r[0] === 403, r);
r = await call({ action: 'change_password', oldPassword: 'newpass99', newPassword: 'short' }, aliceTok);
expect('change_password new too short -> 400', r[0] === 400, r);
r = await call({ action: 'change_password', oldPassword: 'newpass99', newPassword: 'another99' }, aliceTok);
expect('change_password', r[0] === 200 && r[1].ok, r);
r = await call({ action: 'me' }, aliceTok);
expect('current session survives password change', r[0] === 200, r);
r = await call({ action: 'me' }, aliceOtherDevice);
expect('other sessions signed out after password change', r[0] === 401, r);
r = await call({ action: 'login', username: 'alice', password: 'another99' });
expect('login with changed password', r[0] === 200, r);

// expiry and refresh
sql('UPDATE sessions SET expires_at = ? WHERE user_id = ?', Date.now() - 1000, carol.id);
r = await call({ action: 'me' }, carol.token);
expect('expired token -> 401', r[0] === 401, r);
expect('expired session row removed', sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(carol.id).n === 0, null);
sql('UPDATE sessions SET expires_at = ? WHERE user_id = ?', Date.now() + 2 * 86400000, dave.id);
r = await call({ action: 'me' }, dave.token);
{
  const exp = sqlite.prepare('SELECT expires_at FROM sessions WHERE user_id = ?').get(dave.id).expires_at;
  expect('session refreshed to 30 days on use', r[0] === 200 && exp > Date.now() + 29 * 86400000, exp);
}
r = await call({ action: 'logout' }, aliceTok);
expect('logout', r[0] === 200 && r[1].ok, r);
r = await call({ action: 'me' }, aliceTok);
expect('token dead after logout', r[0] === 401, r);
r = await call({ action: 'logout' });
expect('logout without token is harmless', r[0] === 200, r);

// ---- delete ----
r = await call({ action: 'login', username: 'alice', password: 'another99' });
aliceTok = r[1].token;
await call({ action: 'comment_add', scoreId: song, measure: 1, text: 'keep?' }, aliceTok);
await call({ action: 'score_share_link', id: song, enabled: true }, aliceTok);
r = await call({ action: 'score_delete', id: song }, teacher.token);
expect('teacher cannot delete student score -> 403', r[0] === 403, r);
r = await call({ action: 'score_delete', id: song }, aliceTok);
expect('owner deletes score', r[0] === 200, r);
{
  const left = ['score_versions', 'comments', 'score_collaborators'].map((t) => sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE score_id = ?`).get(song).n);
  expect('versions, comments, collaborators deleted too', left.every((n) => n === 0), left);
}
r = await call({ action: 'score_get', id: song }, aliceTok);
expect('deleted score -> 404', r[0] === 404, r);

// ---- schema survives a second (fresh-isolate-like) database ----
{
  const env2 = { WOLFI_DB: d1(new DatabaseSync(':memory:')), MASTER_TEACHER_PIN: 'k' };
  r = await call({ action: 'signup', username: 'fresh', password: 'password1', teacherKey: 'k' }, null, env2);
  expect('works on a second empty database', r[0] === 200, r);
}

console.log(`${passes} passed, ${fails} failed`);
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
