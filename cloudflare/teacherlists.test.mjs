// Checks that the teacher's student/song lists are refetched when the class server answers only {ok:true}
// (src/utils/classroomApi.ts). Run: node cloudflare/teacherlists.test.mjs   (no network)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};
const calls = [];
let overviewFails = false;
const STUDENTS = [{ id: 's1', firstName: 'Ana', pin: '1234' }];
const PROJECTS = [{ id: 'p1', title: 'Song', studentId: 's1' }];
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body);
  calls.push(body.action);
  const json = (obj, status = 200) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => obj });
  if (body.action === 'teacher_overview') return overviewFails ? json({ error: 'nope' }, 500) : json({ ok: true, students: STUDENTS, projects: PROJECTS });
  return json({ ok: true }); // like the real cloud server for save / delete / rename
};

const dir = mkdtempSync(join(tmpdir(), 'teacherlists-test-'));
const out = join(dir, 'api.mjs');
await build({ entryPoints: ['src/utils/classroomApi.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' });
const api = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

let r = await api.teacherSaveStudent({ teacherPin: 'x', firstName: 'Ana', pin: '1234' });
assert.deepEqual(r.students, STUDENTS); assert.deepEqual(r.projects, PROJECTS);
assert.ok(calls.includes('teacher_overview'), 'save refetches the overview');

calls.length = 0;
assert.deepEqual(await api.teacherBulkAddStudents({ teacherPin: 'x', entries: [{ firstName: 'Ana', pin: '1234' }] }), STUDENTS);
r = await api.teacherDeleteStudent({ teacherPin: 'x', studentId: 's1', deleteProjects: true });
assert.deepEqual(r.students, STUDENTS);
assert.deepEqual(await api.teacherRenameProject({ teacherPin: 'x', projectId: 'p1', newTitle: 'New' }), PROJECTS);
assert.equal(calls.filter((c) => c === 'teacher_overview').length, 3);

overviewFails = true;
await assert.rejects(() => api.teacherDeleteStudent({ teacherPin: 'x', studentId: 's1', deleteProjects: false }), /Refresh/);

console.log('teacherlists: ok');
