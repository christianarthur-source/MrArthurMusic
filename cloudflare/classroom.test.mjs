// Checks the classroom server's PIN rules against an in-memory fake of the Supabase REST API.
// Run: node cloudflare/classroom.test.mjs   (no network, no real data)
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'classroom-test-'));
const out = join(dir, 'classroomCloud.mjs');
await build({ entryPoints: ['src/server/classroomCloud.ts'], bundle: true, format: 'esm', platform: 'neutral', outfile: out, logLevel: 'warning' });
const { handleClassroom } = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const T = {
  students: [
    { id: 'stu_a', first_name: 'Test A.', pin: '4321', class_id: 'c1', class_group: 'G', grade: '3' },
    { id: 'stu_b', first_name: 'Bea B.', pin: '9999', class_id: 'c1' },
  ],
  teachers: [
    { id: 'teach_1', name: 'Ms T', pin: 'tpin1', is_master_admin: false },
    { id: 'teach_master', name: 'Mr. Arthur', pin: '1138', school_name: 'Denti Elementary', is_master_admin: false },
  ],
  projects: [{ id: 'p_b', student_id: 'stu_b', title: 'Bea Song', updated_at: '1' }],
  classrooms: [{ id: 'c1', name: 'G', grade: '3', allow_self_register: false }],
  classroom_config: [],
};
const KEY = { classroom_config: 'key' };

globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url);
  const table = u.pathname.split('/').pop();
  const rows = T[table];
  const filters = [...u.searchParams].filter(([k]) => !['select', 'order'].includes(k));
  const match = (r) =>
    filters.every(([k, v]) => {
      const [op, ...rest] = v.split('.');
      const val = rest.join('.');
      if (op === 'eq') return String(r[k]) === val;
      if (op === 'ilike') return new RegExp('^' + val.replace(/\*/g, '.*') + '$', 'i').test(r[k]);
      throw new Error('unsupported filter ' + op);
    });
  const method = opt.method || 'GET';
  if (method === 'GET') return new Response(JSON.stringify(rows.filter(match)), { status: 200 });
  if (method === 'DELETE') {
    T[table] = rows.filter((r) => !match(r));
    return new Response(null, { status: 204 });
  }
  if (method === 'PATCH') {
    rows.filter(match).forEach((r) => Object.assign(r, JSON.parse(opt.body)));
    return new Response(null, { status: 204 });
  }
  const k = KEY[table] || 'id';
  const saved = JSON.parse(opt.body).map((n) => {
    const e = rows.find((r) => r[k] === n[k]);
    if (e) return Object.assign(e, n);
    rows.push({ created_at: 'now', ...n });
    return n;
  });
  return new Response(JSON.stringify(saved), { status: 201 });
};

const env = { SUPABASE_SECRET_KEY: 'sb_secret_test', MASTER_TEACHER_PIN: 'M4ster!' };
const call = async (payload, e = env) => {
  const res = await handleClassroom(new Request('https://x/api/classroom', { method: 'POST', body: JSON.stringify(payload) }), e);
  return [res.status, await res.json()];
};
let fails = 0;
const expect = (name, ok, got) => {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (ok ? '' : ' -> ' + JSON.stringify(got).slice(0, 200)));
  if (!ok) fails++;
};
const mine = (id) => T.projects.filter((p) => p.student_id === id);
let r;

r = await call({ action: 'public_roster' });
expect('roster has no PINs', r[0] === 200 && r[1].roster.length === 2 && !JSON.stringify(r[1]).includes('4321'), r);
r = await call({ action: 'student_login', firstName: 'test a', pin: '4321', classId: 'c1' });
expect('student login (name normalised)', r[0] === 200 && r[1].student.id === 'stu_a', r);
r = await call({ action: 'student_login', firstName: 'Test A', pin: '0000', classId: 'c1' });
expect('wrong student PIN refused', r[0] === 401, r);
r = await call({ action: 'student_login', firstName: 'Newbie', pin: '1234', classId: 'c1' });
expect('self-register respects closed class', r[0] === 403, r);
r = await call({ action: 'student_projects', studentId: 'stu_b', pin: '' });
expect('songs need the PIN', r[0] === 401, r);
r = await call({ action: 'student_projects', studentId: 'stu_b', pin: '9999' });
expect('songs with the PIN', r[0] === 200 && r[1].projects.length === 1, r);
r = await call({ action: 'save_project', studentId: 'stu_a', pin: '', title: 'Hack' });
expect('save without PIN refused', r[0] === 401, r);
r = await call({ action: 'save_project', studentId: 'stu_a', pin: '4321', title: 'Mine', projectId: 'p_b' });
expect("can't overwrite another student's song", r[0] === 200 && r[1].project.id !== 'p_b' && T.projects.find((p) => p.id === 'p_b').student_id === 'stu_b', r);
r = await call({ action: 'save_project', studentId: 'stu_a', pin: '4321', title: 'mine' });
expect('same title updates the same song', mine('stu_a').length === 1, T.projects);
r = await call({ action: 'save_project', studentId: 'stu_a', pin: '4321', title: '%' });
expect('wildcard title is just a title', mine('stu_a').length === 2, T.projects);
r = await call({ action: 'delete_project', projectId: 'p_b', studentId: 'stu_a', pin: '4321' });
expect("can't delete another student's song", T.projects.some((p) => p.id === 'p_b'), r);
r = await call({ action: 'student_projects', studentId: 'stu_b&id=neq.x', pin: '9999' });
expect('id injection harmless', r[0] === 401, r);

r = await call({ action: 'teacher_delete_student', studentId: 'stu_b' });
expect('teacher action needs a PIN', r[0] === 401 && T.students.length === 2, r);
for (const pin of ['1138', 'adminbaby']) {
  r = await call({ action: 'teacher_login', teacherPin: pin });
  expect(`old PIN ${pin} refused`, r[0] === 401, r);
}
r = await call({ action: 'teacher_login', teacherPin: 'tpin1' });
expect('teacher login (not master, no other PINs)', r[0] === 200 && !r[1].isMasterAdmin && r[1].teacherPin === 'tpin1' && r[1].teachers.every((t) => t.id === 'teach_1' || t.pin === ''), r);
r = await call({ action: 'teacher_save_teacher', teacherPin: 'tpin1', teacher: { name: 'X', pin: 'abcd' } });
expect("regular teacher can't add teachers", r[0] === 403, r);
r = await call({ action: 'teacher_login', teacherPin: 'M4ster!' });
const me = r[1].currentTeacher;
expect('master PIN signs in as Mr. Arthur', r[0] === 200 && r[1].isMasterAdmin && me.id === 'teach_master' && me.schoolName === 'Denti Elementary' && me.pin === 'M4ster!', r[1]);
expect("master account's stored PIN is never shown", r[1].teachers.find((t) => t.id === 'teach_master').pin === '' && r[1].teachers.find((t) => t.id === 'teach_1').pin === 'tpin1', r[1].teachers);
r = await call({ action: 'save_project', isTeacher: true, teacherPin: 'M4ster!', studentId: 'teach_master', title: 'Lesson 1' });
expect("master saves into Mr. Arthur's songs", r[0] === 200 && r[1].project.studentName === 'Mr. Arthur', r);
r = await call({ action: 'save_project', isTeacher: true, teacherPin: 'tpin1', studentId: 'teach_master', title: 'Sneaky' });
expect("other teachers can't save into Mr. Arthur's songs", r[0] === 403, r);
r = await call({ action: 'save_project', isTeacher: true, teacherPin: 'tpin1', studentId: 'teach_1', title: 'My lesson' });
expect('teacher saves into own list', r[0] === 200, r);
r = await call({ action: 'save_project', isTeacher: true, teacherPin: 'tpin1', studentId: 'stu_b', title: 'From teacher' });
expect("teacher saves into a student's list", r[0] === 200 && r[1].project.studentName === 'Bea B.', r);
r = await call({ action: 'teacher_save_teacher', teacherPin: 'M4ster!', teacher: { name: 'New T', pin: 'nt99' } });
expect('master adds a teacher', r[0] === 200 && r[1].teachers.length === 3, r);
r = await call({ action: 'teacher_delete_teacher', teacherPin: 'M4ster!', teacherId: 'teach_master' });
expect("master account can't be deleted", r[0] === 400, r);
r = await call({ action: 'teacher_save_student', teacherPin: 'tpin1', firstName: 'cara c', pin: '5555', classId: 'c1' });
expect('teacher adds a student', r[0] === 200 && T.students.some((s) => s.first_name === 'Cara C.'), T.students);
r = await call({ action: 'teacher_assign_project', teacherPin: 'tpin1', sourceProject: { title: 'Assign 1', appType: 'daw', projectData: { a: 1 } }, targetStudentIds: ['stu_a', 'stu_b', 'stu_fake'] });
expect('assign skips unknown students', r[0] === 200 && r[1].assignedCount === 2, r);

await call({ action: 'staff_wars_submit_score', name: 'Test A.', score: 50, level: 1 });
r = await call({ action: 'staff_wars_leaderboard', level: 1 });
expect('Staff Wars leaderboard', r[1].leaderboard[0].score === 50, r);
r = await call({ action: 'public_roster' }, {});
expect('no secret key -> 503', r[0] === 503, r);
r = await call({ action: 'nope' });
expect('unknown action -> 400', r[0] === 400, r);

console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
