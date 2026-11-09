/**
 * Classroom backend that runs on the Cloudflare Worker (POST /api/classroom).
 *
 * Students' and teachers' PINs are checked here, on the server, with the Supabase secret
 * key, which never reaches the browser. Every action that reads or changes student data
 * needs a valid student PIN or teacher PIN; managing teacher accounts needs a master PIN.
 *
 * Worker secrets (Cloudflare dashboard → the mrarthurmusic Worker → Settings → Variables):
 *   SUPABASE_SECRET_KEY   Supabase secret (or legacy service_role) key
 *   MASTER_TEACHER_PIN    master admin PIN (teachers marked is_master_admin are masters too)
 */
import { containsProfanity } from '../utils/profanityFilter';
import { formatStudentDisplayName, normalizeStudentName } from '../utils/studentNames';
import {
  allowedBadges,
  clampRhythmLevel,
  clampStaffWarsLevel,
  clampStreak,
  rhythmMaxPoints,
  staffWarsMaxScore,
} from './leaderboardRules';

export interface ClassroomEnv {
  SUPABASE_SECRET_KEY?: string;
  MASTER_TEACHER_PIN?: string;
}

const SUPABASE_URL = 'https://xnbhxrzzyjbthrobdkwb.supabase.co';
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const DEFAULT_SCHOOL = 'Music Lab Elementary';

/** An error whose message is safe and useful to show the student or teacher. */
class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function handleClassroom(request: Request, env: ClassroomEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  if (!env.SUPABASE_SECRET_KEY) {
    return json({ error: 'The classroom server is not set up yet. Please tell Mr. Arthur.' }, 503);
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'This song is too large to save.' }, 413);

  let payload: Record<string, any>;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: 'This song is too large to save.' }, 413);
    payload = JSON.parse(text);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  try {
    return json(await runAction(payload, new Db(env.SUPABASE_SECRET_KEY), env));
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, err.status);
    console.error('classroom action failed', payload.action, err);
    return json({ error: 'The classroom server had a problem. Please try again.' }, 502);
  }
}

// ---------------------------------------------------------------------------
// Supabase REST access with the secret key

const eq = (v: unknown) => `eq.${encodeURIComponent(String(v ?? ''))}`;

class Db {
  constructor(private readonly key: string) {}

  async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
      apikey: this.key,
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    // Legacy service_role keys are JWTs and must also be sent as a bearer token.
    if (!this.key.startsWith('sb_')) headers.Authorization = `Bearer ${this.key}`;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase ${res.status} on ${endpoint.split('?')[0]}: ${text.slice(0, 300)}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  upsert(table: string, rows: unknown[], returnRows = false) {
    return this.fetch(table, {
      method: 'POST',
      headers: { Prefer: `resolution=merge-duplicates${returnRows ? ',return=representation' : ''}` },
      body: JSON.stringify(rows),
    });
  }
}

// ---------------------------------------------------------------------------
// Who is asking

interface TeacherAuth {
  isMaster: boolean;
  teacher: any | null;
}

/**
 * The master admin's own account ("Mr. Arthur"). Its songs and assignments belong to whoever
 * signs in with MASTER_TEACHER_PIN; the PIN stored on the row itself no longer signs in.
 */
const MASTER_ACCOUNT_ID = 'teach_master';
const isMasterAccountId = (id: string) => id === MASTER_ACCOUNT_ID || id === 'teacher_master';

/** True when `pin` is a teacher's or the master PIN (used by other API routes such as /api/omr). */
export async function isTeacherPin(env: ClassroomEnv, pin: string): Promise<boolean> {
  if (!env.SUPABASE_SECRET_KEY) {
    const master = String(env.MASTER_TEACHER_PIN ?? '').trim();
    return master !== '' && pin.trim() === master;
  }
  try {
    await requireTeacher(new Db(env.SUPABASE_SECRET_KEY), env, { teacherPin: pin });
    return true;
  } catch {
    return false;
  }
}

async function requireTeacher(db: Db, env: ClassroomEnv, payload: Record<string, any>): Promise<TeacherAuth> {
  const pin = String(payload.teacherPin ?? '').trim();
  if (!pin) throw new UserError('Teacher PIN required.', 401);
  const master = String(env.MASTER_TEACHER_PIN ?? '').trim();
  if (master !== '' && pin === master) {
    const rows = (await db.fetch(`teachers?select=*&id=${eq(MASTER_ACCOUNT_ID)}`)) || [];
    return { isMaster: true, teacher: rows[0] ?? null };
  }
  const teachers = ((await db.fetch(`teachers?select=*&pin=${eq(pin)}`)) || []).filter((t: any) => !isMasterAccountId(t.id));
  const teacher = teachers[0] ?? null;
  if (!teacher) throw new UserError('Invalid Teacher PIN.', 401);
  return { isMaster: Boolean(teacher.is_master_admin), teacher };
}

async function requireMaster(db: Db, env: ClassroomEnv, payload: Record<string, any>, what: string) {
  const auth = await requireTeacher(db, env, payload);
  if (!auth.isMaster) throw new UserError(`Only Master Admin can ${what}.`, 403);
  return auth;
}

async function requireStudent(db: Db, studentId: string, pin: string, message: string) {
  if (!studentId || !pin) throw new UserError(message, 401);
  const rows = (await db.fetch(`students?select=*&id=${eq(studentId)}`)) || [];
  const student = rows[0];
  if (!student || String(student.pin).trim() !== pin.trim()) throw new UserError(message, 401);
  return student;
}

// ---------------------------------------------------------------------------
// Row → client shapes (unchanged from the previous browser-side code)

const projectOut = (p: any) => ({
  id: p.id,
  studentId: p.student_id,
  studentName: p.student_name,
  title: p.title,
  appType: p.app_type,
  score: p.score,
  projectData: p.project_data,
  isAssignment: Boolean(p.project_data?._assignment?.isAssignment),
  assignmentInstructions: p.project_data?._assignment?.instructions || '',
  assignmentSourceTitle: p.project_data?._assignment?.sourceTitle || p.title,
  assignedByTeacher: p.project_data?._assignment?.assignedByTeacher || '',
  createdAt: p.created_at,
  updatedAt: p.updated_at,
});

const classroomOut = (c: any) => ({
  id: c.id,
  name: c.name,
  grade: c.grade,
  teacherName: c.teacher_name || '',
  schoolName: c.school_name || DEFAULT_SCHOOL,
  allowSelfRegister: c.allow_self_register !== false,
});

/** Teachers' PINs are only shown to master admins; the master account's stored PIN is never shown. */
const teacherOut = (t: any, showPin: boolean) => ({
  id: t.id,
  name: t.name,
  pin: showPin && !isMasterAccountId(t.id) ? t.pin : '',
  schoolName: t.school_name,
  isMasterAdmin: Boolean(t.is_master_admin) || isMasterAccountId(t.id),
});

const randomId = (prefix: string, len = 8) => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, len)}`;

async function listClassrooms(db: Db) {
  return ((await db.fetch('classrooms?select=*&order=grade.asc,name.asc')) || []).map(classroomOut);
}

async function listTeachers(db: Db, showPins: boolean) {
  return ((await db.fetch('teachers?select=*&order=name.asc')) || []).map((t: any) => teacherOut(t, showPins));
}

/** Which classes each teacher has marked as theirs ("My Classes"): { teacherId: classId[] }. */
async function myClassesMap(db: Db): Promise<Record<string, string[]>> {
  const rows = await db.fetch('classroom_config?key=eq.myClasses').catch(() => []);
  const v = rows && rows[0] ? rows[0].value : null;
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

/** The account a sign-in acts as: the master PIN is always Mr. Arthur's account. */
const accountIdOf = (auth: TeacherAuth, pin: string, env: ClassroomEnv) =>
  pin === String(env.MASTER_TEACHER_PIN ?? '').trim() || !auth.teacher ? MASTER_ACCOUNT_ID : String(auth.teacher.id);

async function selfCreateAllowed(db: Db) {
  const configs = await db.fetch('classroom_config?key=eq.allowStudentSelfCreate').catch(() => []);
  return configs && configs.length > 0 && configs[0].value !== undefined ? Boolean(configs[0].value) : true;
}

/** Finds a student's project by title (case-insensitive) without PostgREST wildcards. */
async function findProjectByTitle(db: Db, studentId: string, title: string) {
  const rows = (await db.fetch(`projects?select=id,title&student_id=${eq(studentId)}`)) || [];
  const want = title.trim().toLowerCase();
  return rows.find((p: any) => String(p.title || '').trim().toLowerCase() === want) ?? null;
}

// ---------------------------------------------------------------------------
// Actions

async function runAction(payload: Record<string, any>, db: Db, env: ClassroomEnv): Promise<any> {
  const action = String(payload.action || '');

  // 1. PUBLIC ROSTER (names and classes for the login picker; no PINs)
  if (action === 'public_roster') {
    const [classrooms, students, allowStudentSelfCreate] = await Promise.all([
      listClassrooms(db),
      db.fetch('students?select=id,first_name,class_group,class_id,grade&order=first_name.asc'),
      selfCreateAllowed(db),
    ]);
    return {
      ok: true,
      roster: (students || []).map((s: any) => ({
        id: s.id,
        firstName: s.first_name,
        classGroup: s.class_group || '',
        classId: s.class_id || '',
        grade: s.grade || '',
      })),
      classrooms,
      allowStudentSelfCreate,
    };
  }

  // 2. STUDENT LOGIN (or self-registration when the class allows it)
  if (action === 'student_login') {
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classId = String(payload.classId || '').trim();
    const grade = String(payload.grade || '').trim();
    const classGroup = String(payload.classGroup || payload.className || '').trim();

    if (!firstName || !pin) throw new UserError('Please enter your first name and PIN.');
    if (containsProfanity(firstName)) throw new UserError('Please use a school-appropriate student name.');

    const normInput = normalizeStudentName(firstName);
    const candidates = (await db.fetch(`students?select=*&first_name=ilike.${encodeURIComponent(firstName.replace(/[%_*\\]/g, ''))}*`)) || [];
    const found = candidates.find((s: any) => {
      if (normalizeStudentName(s.first_name) !== normInput) return false;
      if (classId && s.class_id) return s.class_id === classId;
      if (classGroup && s.class_group) return s.class_group.toLowerCase() === classGroup.toLowerCase();
      return true;
    });

    if (found) {
      if (String(found.pin).trim() !== pin) {
        throw new UserError('Incorrect PIN for ' + found.first_name + '. Please try again!', 401);
      }
      if ((classId && !found.class_id) || (grade && !found.grade) || (classGroup && !found.class_group)) {
        await db
          .fetch(`students?id=${eq(found.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              class_id: classId || found.class_id,
              grade: grade || found.grade,
              class_group: classGroup || found.class_group,
            }),
          })
          .catch(() => {});
      }
      const projects = (await db.fetch(`projects?student_id=${eq(found.id)}&order=updated_at.desc`)) || [];
      return {
        ok: true,
        student: {
          id: found.id,
          firstName: found.first_name,
          pin: found.pin,
          classGroup: found.class_group || classGroup || '',
          classId: found.class_id || classId || '',
          grade: found.grade || grade || '',
          schoolName: found.school_name || DEFAULT_SCHOOL,
        },
        projects: projects.map(projectOut),
      };
    }

    const classrooms = (await db.fetch('classrooms?select=*').catch(() => [])) || [];
    const classroom = classrooms.find((c: any) => c.id === classId);
    const selfRegisterAllowed = classroom ? classroom.allow_self_register !== false : await selfCreateAllowed(db);
    if (!selfRegisterAllowed) {
      throw new UserError('Self-registration is currently closed for this class. Ask your teacher to add your name.', 403);
    }
    if (pin.length < 3) throw new UserError('Please choose a PIN with at least 3 digits.');

    const newStudent = {
      id: randomId('stu'),
      first_name: formatStudentDisplayName(firstName),
      pin,
      class_group: classroom ? classroom.name : classGroup,
      class_id: classId,
      grade: classroom ? classroom.grade : grade,
      school_name: classroom?.school_name || DEFAULT_SCHOOL,
    };
    await db.upsert('students', [newStudent]);
    return {
      ok: true,
      student: {
        id: newStudent.id,
        firstName: newStudent.first_name,
        pin,
        classGroup: newStudent.class_group,
        classId: newStudent.class_id,
        grade: newStudent.grade,
        schoolName: newStudent.school_name,
      },
      projects: [],
    };
  }

  // 3. STUDENT PROJECTS
  if (action === 'student_projects') {
    const studentId = String(payload.studentId || '');
    await requireStudent(db, studentId, String(payload.pin || ''), 'Invalid student session.');
    const projects = (await db.fetch(`projects?student_id=${eq(studentId)}&order=updated_at.desc`)) || [];
    return { ok: true, projects: projects.map(projectOut) };
  }

  // 4. STUDENT CHANGE PIN
  if (action === 'student_change_pin') {
    const studentId = String(payload.studentId || '');
    const newPin = String(payload.newPin || '').trim();
    if (!newPin || newPin.length < 3) throw new UserError('New PIN must be at least 3 digits.');
    await requireStudent(db, studentId, String(payload.currentPin || ''), 'Current session verification failed.');
    await db.fetch(`students?id=${eq(studentId)}`, { method: 'PATCH', body: JSON.stringify({ pin: newPin }) });
    return { ok: true, newPin };
  }

  // 5. SAVE PROJECT (a student saving their own, or a teacher saving into a student's list)
  if (action === 'save_project') {
    const studentId = String(payload.studentId || '');
    let projectId = String(payload.projectId || '');
    const title = String(payload.title || '').trim();
    const appType = String(payload.appType || 'staff-composer');

    if (!title || title.toLowerCase() === 'my composition' || title.toLowerCase() === 'untitled') {
      return { ok: false, skipped: true, reason: 'Default untitled song is not auto-saved.' };
    }
    if (containsProfanity(title)) throw new UserError('Please choose a school-appropriate song title.');
    if (!studentId) throw new UserError('Unauthorized save request.', 401);

    let studentName = 'Student';
    if (payload.isTeacher) {
      const auth = await requireTeacher(db, env, payload);
      const st = (await db.fetch(`students?select=first_name&id=${eq(studentId)}`)) || [];
      if (st[0]) studentName = st[0].first_name;
      else {
        // A teacher's own song list: only that teacher (or a master admin) may save into it.
        if (!auth.isMaster && studentId !== auth.teacher?.id) throw new UserError('Unauthorized save request.', 403);
        const tch = (await db.fetch(`teachers?select=name&id=${eq(studentId)}`)) || [];
        if (tch[0]) studentName = tch[0].name;
        else if (isMasterAccountId(studentId)) studentName = auth.teacher?.name || 'Mr. Arthur';
        else throw new UserError('That student was not found.', 404);
      }
    } else {
      const st = await requireStudent(db, studentId, String(payload.pin || ''), 'Unauthorized save request.');
      studentName = st.first_name;
    }

    if (projectId) {
      // An existing id must belong to the same student; otherwise save as a new song.
      const owner = (await db.fetch(`projects?select=student_id&id=${eq(projectId)}`)) || [];
      if (owner[0] && owner[0].student_id !== studentId) projectId = '';
    }
    if (!projectId) projectId = (await findProjectByTitle(db, studentId, title))?.id ?? randomId('proj', 10);

    const now = new Date().toISOString();
    const saved = await db.upsert(
      'projects',
      [
        {
          id: projectId,
          student_id: studentId,
          student_name: studentName,
          title,
          app_type: appType,
          score: payload.score || null,
          project_data: payload.projectData || null,
          updated_at: now,
        },
      ],
      true,
    );
    const rec = saved && saved[0];
    return {
      ok: true,
      project: rec
        ? {
            id: rec.id,
            studentId: rec.student_id,
            studentName: rec.student_name,
            title: rec.title,
            appType: rec.app_type,
            score: rec.score,
            projectData: rec.project_data,
            updatedAt: rec.updated_at,
            createdAt: rec.created_at,
          }
        : { id: projectId, studentId, studentName, title, appType, score: payload.score, projectData: payload.projectData, updatedAt: now, createdAt: now },
    };
  }

  // 6. DELETE PROJECT
  if (action === 'delete_project') {
    const projectId = String(payload.projectId || '');
    if (!projectId) throw new UserError('Project id is required.');
    if (payload.isTeacher) {
      await requireTeacher(db, env, payload);
      await db.fetch(`projects?id=${eq(projectId)}`, { method: 'DELETE' });
    } else {
      const studentId = String(payload.studentId || '');
      await requireStudent(db, studentId, String(payload.pin || ''), 'Unauthorized delete request.');
      await db.fetch(`projects?id=${eq(projectId)}&student_id=${eq(studentId)}`, { method: 'DELETE' });
    }
    return { ok: true };
  }

  // 1b. PUBLIC TEACHER NAMES (for the teacher picker before the PIN; no PINs)
  if (action === 'public_teachers') {
    const rows = ((await db.fetch('teachers?select=id,name&order=name.asc')) || []).filter((t: any) => t.name);
    const list = rows.map((t: any) => ({ id: isMasterAccountId(t.id) ? MASTER_ACCOUNT_ID : t.id, name: t.name }));
    if (!list.some((t: any) => t.id === MASTER_ACCOUNT_ID)) list.unshift({ id: MASTER_ACCOUNT_ID, name: 'Mr. Arthur' });
    return { ok: true, teachers: list };
  }

  // 7. TEACHER PORTAL & OVERVIEW
  if (action === 'teacher_login' || action === 'teacher_overview') {
    const auth = await requireTeacher(db, env, payload);
    const { isMaster, teacher } = auth;
    const teacherPin = String(payload.teacherPin).trim();
    const accountId = accountIdOf(auth, teacherPin, env);
    // when a name was picked first, the PIN has to be that teacher's own
    const picked = String(payload.teacherId || '').trim();
    if (picked && !(picked === accountId || (isMasterAccountId(picked) && isMasterAccountId(accountId)))) {
      throw new UserError("That PIN doesn't match the teacher you picked.", 401);
    }
    const [students, projects, classrooms, teachers, allowStudentSelfCreate, myClasses] = await Promise.all([
      db.fetch('students?select=*&order=first_name.asc'),
      db.fetch('projects?select=*&order=updated_at.desc'),
      listClassrooms(db),
      db.fetch('teachers?select=*&order=name.asc'),
      selfCreateAllowed(db),
      myClassesMap(db),
    ]);
    return {
      ok: true,
      isMasterAdmin: isMaster,
      currentTeacher: teacher
        ? { ...teacherOut(teacher, true), pin: teacherPin, isMasterAdmin: isMaster }
        : { id: MASTER_ACCOUNT_ID, name: 'Mr. Arthur', pin: teacherPin, schoolName: DEFAULT_SCHOOL, isMasterAdmin: true },
      teachers: (teachers || []).map((t: any) => teacherOut(t, isMaster || t.id === teacher?.id)),
      classrooms,
      students: (students || []).map((s: any) => ({
        id: s.id,
        firstName: s.first_name,
        pin: s.pin,
        classGroup: s.class_group || '',
        classId: s.class_id || '',
        grade: s.grade || '',
        schoolName: s.school_name || '',
        createdAt: s.created_at,
      })),
      projects: (projects || []).map(projectOut),
      allowStudentSelfCreate,
      myClassIds: myClasses[accountId] || [],
      teacherPin,
    };
  }

  // 7b. A TEACHER'S OWN CLASS LIST ("My Classes")
  if (action === 'teacher_set_my_classes') {
    const auth = await requireTeacher(db, env, payload);
    const accountId = accountIdOf(auth, String(payload.teacherPin).trim(), env);
    const ids = Array.isArray(payload.classIds) ? [...new Set(payload.classIds.map((x: unknown) => String(x)).filter(Boolean))].slice(0, 200) : [];
    const map = await myClassesMap(db);
    map[accountId] = ids as string[];
    await db.upsert('classroom_config', [{ key: 'myClasses', value: map }]);
    return { ok: true, myClassIds: map[accountId] };
  }

  // 8. TEACHER ADD / SAVE STUDENT
  if (action === 'teacher_save_student') {
    await requireTeacher(db, env, payload);
    const id = String(payload.id || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classGroup = String(payload.classGroup || '').trim();
    if (!firstName || !pin) throw new UserError('First name and PIN are required.');
    if (containsProfanity(firstName) || containsProfanity(classGroup)) {
      throw new UserError('Please use school-appropriate student and class names.');
    }
    await db.upsert('students', [
      {
        id: id || randomId('stu'),
        first_name: formatStudentDisplayName(firstName),
        pin,
        class_group: classGroup,
        class_id: String(payload.classId || '').trim(),
        grade: String(payload.grade || '').trim(),
        school_name: DEFAULT_SCHOOL,
      },
    ]);
    return { ok: true };
  }

  // 9. TEACHER BULK ADD STUDENTS
  if (action === 'teacher_bulk_add') {
    await requireTeacher(db, env, payload);
    const entries = Array.isArray(payload.entries) ? payload.entries.slice(0, 500) : [];
    const inserts = entries
      .filter((e: any) => String(e?.firstName || '').trim())
      .map((e: any) => ({
        id: randomId('stu'),
        first_name: formatStudentDisplayName(String(e.firstName).trim()),
        pin: String(e.pin || '').trim() || String(1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000)),
        class_group: String(e.classGroup || '').trim(),
        class_id: String(e.classId || '').trim(),
        grade: String(e.grade || '').trim(),
        school_name: DEFAULT_SCHOOL,
      }));
    if (inserts.some((r: any) => containsProfanity(r.first_name) || containsProfanity(r.class_group))) {
      throw new UserError('Please use school-appropriate student and class names.');
    }
    if (inserts.length > 0) await db.upsert('students', inserts);
    return { ok: true };
  }

  // 10. TEACHER DELETE STUDENT
  if (action === 'teacher_delete_student') {
    await requireTeacher(db, env, payload);
    const studentId = String(payload.studentId || '');
    if (!studentId) throw new UserError('Student id is required.');
    await db.fetch(`students?id=${eq(studentId)}`, { method: 'DELETE' });
    if (payload.deleteProjects) {
      await db.fetch(`projects?student_id=${eq(studentId)}`, { method: 'DELETE' }).catch(() => {});
    }
    return { ok: true };
  }

  // 11. TEACHER SAVE CLASSROOM
  if (action === 'teacher_save_classroom') {
    await requireTeacher(db, env, payload);
    const cls = payload.classroom || {};
    const name = String(cls.name || '').trim();
    const grade = String(cls.grade || '').trim();
    if (!name || !grade) throw new UserError('Classroom name and Grade level are required.');
    if (containsProfanity(name)) throw new UserError('Please use a school-appropriate class name.');
    await db.upsert('classrooms', [
      {
        id: cls.id || randomId('cls'),
        name,
        grade,
        school_name: String(cls.schoolName || DEFAULT_SCHOOL).trim(),
        teacher_name: cls.teacherName || '',
        allow_self_register: cls.allowSelfRegister !== false,
      },
    ]);
    return { ok: true, classrooms: await listClassrooms(db) };
  }

  // 12. TEACHER DELETE CLASSROOM
  if (action === 'teacher_delete_classroom') {
    await requireTeacher(db, env, payload);
    const classroomId = String(payload.classroomId || '');
    if (!classroomId) throw new UserError('Classroom id is required.');
    await db.fetch(`classrooms?id=${eq(classroomId)}`, { method: 'DELETE' });
    return { ok: true, classrooms: await listClassrooms(db) };
  }

  // 13. TEACHER RENAME PROJECT
  if (action === 'teacher_rename_project') {
    await requireTeacher(db, env, payload);
    const projectId = String(payload.projectId || '');
    const newTitle = String(payload.newTitle || '').trim();
    if (!newTitle) throw new UserError('New title cannot be empty.');
    if (containsProfanity(newTitle)) throw new UserError('Please choose a school-appropriate song title.');
    await db.fetch(`projects?id=${eq(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle, updated_at: new Date().toISOString() }),
    });
    return { ok: true };
  }

  // 14. TEACHER UPDATE SETTINGS
  if (action === 'teacher_update_settings') {
    await requireTeacher(db, env, payload);
    if (payload.allowStudentSelfCreate !== undefined) {
      await db.upsert('classroom_config', [{ key: 'allowStudentSelfCreate', value: Boolean(payload.allowStudentSelfCreate) }]);
    }
    return { ok: true };
  }

  // 15. MASTER: SAVE / UPDATE TEACHER ACCOUNT
  if (action === 'teacher_save_teacher') {
    await requireMaster(db, env, payload, 'manage teacher accounts');
    const t = payload.teacher || {};
    const name = String(t.name || '').trim();
    const pin = String(t.pin || '').trim();
    if (!name || !pin) throw new UserError('Teacher name and PIN are required.');
    if (pin.length < 4) throw new UserError('Teacher PINs need at least 4 characters.');
    const clash = (await db.fetch(`teachers?select=id&pin=${eq(pin)}`)) || [];
    if (clash.some((x: any) => x.id !== t.id) || pin === String(env.MASTER_TEACHER_PIN ?? '').trim()) {
      throw new UserError('That PIN is already used. Please choose a different one.');
    }
    await db.upsert('teachers', [
      {
        id: t.id || randomId('teach'),
        name,
        pin,
        school_name: String(t.schoolName || DEFAULT_SCHOOL).trim(),
        is_master_admin: Boolean(t.isMasterAdmin),
      },
    ]);
    return { ok: true, teachers: await listTeachers(db, true) };
  }

  // 16. MASTER: DELETE TEACHER ACCOUNT
  if (action === 'teacher_delete_teacher') {
    await requireMaster(db, env, payload, 'delete teacher accounts');
    const teacherId = String(payload.teacherId || '');
    if (!teacherId) throw new UserError('Teacher id is required.');
    if (isMasterAccountId(teacherId)) throw new UserError('The master admin account cannot be deleted.');
    await db.fetch(`teachers?id=${eq(teacherId)}`, { method: 'DELETE' });
    return { ok: true, teachers: await listTeachers(db, true) };
  }

  // 17. TEACHER ASSIGN PROJECT TO STUDENTS / CLASSROOM
  if (action === 'teacher_assign_project') {
    const { isMaster, teacher } = await requireTeacher(db, env, payload);
    const teacherName = teacher?.name || (isMaster ? 'Mr. Arthur' : 'Teacher');
    const sourceProject = payload.sourceProject;
    const targetStudentIds: string[] = Array.isArray(payload.targetStudentIds) ? payload.targetStudentIds.map(String) : [];
    const instructions = String(payload.instructions || '').trim();
    if (!sourceProject) throw new UserError('Source project is required.');
    if (targetStudentIds.length === 0) {
      throw new UserError('Please select at least one student or classroom to assign this song to.');
    }

    const allStudents = (await db.fetch('students?select=id,first_name')) || [];
    const studentMap = new Map<string, string>(allStudents.map((s: any) => [s.id, s.first_name]));
    const now = new Date().toISOString();
    const title = String(sourceProject.title || '').trim() || 'Assignment';
    const rows: any[] = [];
    for (const studentId of targetStudentIds) {
      if (!studentMap.has(studentId)) continue;
      const existing = await findProjectByTitle(db, studentId, title);
      const score = sourceProject.score ? structuredClone(sourceProject.score) : null;
      let projectData = sourceProject.projectData ? structuredClone(sourceProject.projectData) : null;
      if (!projectData && (instructions || title)) projectData = {};
      if (projectData && typeof projectData === 'object') {
        projectData._assignment = { isAssignment: true, instructions, sourceTitle: title, assignedByTeacher: teacherName, assignedAt: now };
      }
      if (score) score.title = title;
      rows.push({
        id: existing?.id ?? randomId('proj', 10),
        student_id: studentId,
        student_name: studentMap.get(studentId) || 'Student',
        title,
        app_type: sourceProject.appType || 'staff-composer',
        score,
        project_data: projectData,
        updated_at: now,
      });
    }
    if (rows.length > 0) await db.upsert('projects', rows);
    const projects = (await db.fetch('projects?select=*&order=updated_at.desc')) || [];
    return { ok: true, assignedCount: rows.length, projects: projects.map(projectOut) };
  }

  // 18. STAFF WARS LEADERBOARD (public, main overall board + optional per-clef boards)
  if (action === 'staff_wars_leaderboard') {
    const level = Math.min(99, Math.max(1, parseInt(payload.level, 10) || 1));
    const rawClef = String(payload.clef || '').trim().toLowerCase();
    const validClefs = ['treble', 'bass', 'alto', 'tenor', 'grand'];
    if (validClefs.includes(rawClef)) {
      return { ok: true, level, clef: rawClef, leaderboard: await readClefLeaderboard(db, rawClef) };
    }
    return { ok: true, level, clef: 'all', leaderboard: await readLeaderboard(db) };
  }

  if (action === 'staff_wars_submit_score') {
    // Signed-in students must send their PIN; guests post under a typed name only.
    const studentId = payload.studentId ? String(payload.studentId) : null;
    const student = studentId
      ? await requireStudent(db, studentId, String(payload.pin || ''), 'Please sign in again to save your score.')
      : null;
    const name = student ? String(student.first_name || '').trim() : String(payload.name || '').trim().slice(0, 40);
    const score = parseInt(payload.score, 10);
    const level = clampStaffWarsLevel(payload.level);
    const rawClef = String(payload.clef || '').trim().toLowerCase();
    const validClefs = ['treble', 'bass', 'alto', 'tenor', 'grand'];
    const clef = validClefs.includes(rawClef) ? rawClef : null;
    if (!name || !Number.isFinite(score) || score < 0) throw new UserError('Invalid score.');
    if (score > staffWarsMaxScore(level)) throw new UserError(`That score isn't possible at level ${level}.`);
    if (!student && containsProfanity(name)) throw new UserError('Please use a school-appropriate name.');

    const normName = normalizeStudentName(name);
    // A student can claim a guest entry with their name; a guest never touches a student's entry.
    const isMine = (e: any) =>
      studentId
        ? e.studentId === studentId || (!e.studentId && normalizeStudentName(String(e.name || '')) === normName)
        : !e.studentId && normalizeStudentName(String(e.name || '')) === normName;
    const now = new Date().toISOString();
    const record = (list: any[], extra: Record<string, any>) => {
      // Prefer the student's own entry; only claim a same-name guest entry if they have none yet.
      const ownIdx = studentId ? list.findIndex((e: any) => e.studentId === studentId) : -1;
      const idx = ownIdx >= 0 ? ownIdx : list.findIndex(isMine);
      if (idx >= 0) {
        const prevScore = Number(list[idx].score) || 0;
        const prevLevel = Math.max(1, parseInt(list[idx].level, 10) || 1);
        Object.assign(list[idx], {
          score: Math.max(prevScore, score),
          name,
          level: score >= prevScore ? Math.max(prevLevel, level) : prevLevel,
          ...(score >= prevScore ? extra : {}),
          ...(studentId ? { studentId } : {}),
          updatedAt: now,
        });
      } else {
        list.push({ id: randomId('sw', 7), studentId, name, score, level, ...extra, updatedAt: now });
      }
      list.sort((a: any, b: any) => (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.level) || 1) - (Number(a.level) || 1));
      return list.slice(0, 100);
    };

    const top = record(await readLeaderboard(db), clef ? { clef } : {});
    const upserts: { key: string; value: any }[] = [
      { key: 'staff_wars_leaderboard', value: top },
      { key: 'staff_wars_leaderboard_level_1', value: top },
    ];
    let clefTop: any[] | null = null;
    if (clef) {
      clefTop = record(await readClefLeaderboard(db, clef), { clef });
      upserts.push({ key: `staff_wars_leaderboard_clef_${clef}`, value: clefTop });
    }

    await db.upsert('classroom_config', upserts);
    return { ok: true, level, clef: clef || 'all', leaderboard: top, ...(clefTop ? { clefLeaderboard: clefTop } : {}) };
  }

  // 19. RHYTHM ROCKSTARS LEADERBOARD & SCORE SYNC (viewing is public; posting needs the student's PIN)
  if (action === 'rhythm_rockstars_leaderboard') {
    const list = await readRhythmLeaderboard(db);
    const studentId = payload.studentId ? String(payload.studentId).trim() : '';
    const student = studentId ? list.find((e: any) => e.id === studentId) || null : null;
    return { ok: true, leaderboard: list, student };
  }

  if (action === 'rhythm_rockstars_submit_score') {
    const studentId = String(payload.studentId || '').trim();
    const studentRow = await requireStudent(db, studentId, String(payload.pin || ''), 'Please sign in again to save your score.');
    const name = String(studentRow.first_name || '').trim() || 'Rockstar';

    // Points are added on the server, trimmed to what one round can earn. Totals, quiz counts and
    // level progress reported by the browser are not trusted.
    const level = clampRhythmLevel(payload.level);
    const hasLevel = payload.level !== undefined && payload.level !== null;
    const stars = Math.max(0, Math.min(3, parseInt(payload.stars, 10) || 0));
    const accuracy = Math.max(0, Math.min(100, parseInt(payload.accuracy, 10) || 0));
    const streak = clampStreak(payload.streak);
    const pointsEarned = hasLevel
      ? Math.min(Math.max(0, parseInt(payload.pointsEarned, 10) || 0), rhythmMaxPoints(level, stars, streak))
      : 0;
    const avatar = String(payload.avatar || '🎸').slice(0, 8);
    const classCode = String(payload.classCode || 'Classroom').trim().slice(0, 40);

    const list = await readRhythmLeaderboard(db);
    const idx = list.findIndex((e: any) => e.id === studentId);
    const now = new Date().toISOString();
    const existing = idx >= 0 ? list[idx] : null;

    const mergedProgress: Record<string, { stars: number; highAccuracy: number }> = {
      ...(existing?.levelProgress && typeof existing.levelProgress === 'object' ? existing.levelProgress : {}),
    };
    if (hasLevel && (stars > 0 || accuracy > 0 || !mergedProgress[level])) {
      const prev = mergedProgress[level] || { stars: 0, highAccuracy: 0 };
      mergedProgress[level] = {
        stars: Math.max(prev.stars || 0, stars),
        highAccuracy: Math.max(prev.highAccuracy || 0, accuracy),
      };
    }

    const badges = Array.from(
      new Set<string>([
        ...(Array.isArray(existing?.badges) ? allowedBadges(existing.badges) : ['rockstar_rookie']),
        ...allowedBadges(payload.newBadges),
      ]),
    );

    const totalScore = (Number(existing?.totalScore) || 0) + pointsEarned;
    const highestStreak = Math.max(Number(existing?.highestStreak) || 0, hasLevel ? streak : 0);
    const quizzesCompleted = (Number(existing?.quizzesCompleted) || 0) + (pointsEarned > 0 ? 1 : 0);
    const progressLevels = Object.keys(mergedProgress)
      .map((k) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n) && n >= 1);
    const highestLevel = Math.max(1, Number(existing?.highestLevel) || 1, hasLevel ? level : 1, ...progressLevels);
    const starsCount = Object.values(mergedProgress).reduce((sum, p) => sum + (Number(p?.stars) || 0), 0);

    const updatedRecord = {
      id: studentId,
      name,
      avatar: payload.avatar ? avatar : existing?.avatar || '🎸',
      classCode: payload.classCode ? classCode : existing?.classCode || 'Classroom',
      totalScore,
      highestLevel,
      highestStreak,
      quizzesCompleted,
      levelProgress: mergedProgress,
      badges,
      badgesCount: badges.length,
      starsCount,
      updatedAt: now,
    };

    if (idx >= 0) list[idx] = updatedRecord;
    else list.push(updatedRecord);

    list.sort((a: any, b: any) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));
    const top = list.slice(0, 150).map((item: any, i: number) => ({ ...item, rank: i + 1 }));
    await db.upsert('classroom_config', [{ key: 'rhythm_rockstars_leaderboard', value: top }]);
    const savedStudent = top.find((e: any) => e.id === updatedRecord.id) || { ...updatedRecord, rank: top.length + 1 };
    return { ok: true, student: savedStudent, leaderboard: top };
  }

  // 20. TEACHER: REMOVE A LEADERBOARD ENTRY (any teacher)
  if (action === 'teacher_leaderboard_remove') {
    await requireTeacher(db, env, payload);
    const game = String(payload.game || '');
    const studentId = String(payload.studentId || '').trim();
    const normName = normalizeStudentName(String(payload.name || ''));
    if (!studentId && !normName) throw new UserError('Pick an entry to remove.');
    // A student's entry is matched by id; a guest's (no id) by name.
    const matches = (e: any, idKey: string) =>
      studentId ? String(e?.[idKey] || '') === studentId : !e?.[idKey] && normalizeStudentName(String(e?.name || '')) === normName;

    let rows: any[];
    let idKey: string;
    if (game === 'staff_wars') {
      rows = (await db.fetch('classroom_config?key=ilike.staff_wars_leaderboard*')) || [];
      idKey = 'studentId';
    } else if (game === 'rhythm_rockstars') {
      rows = (await db.fetch(`classroom_config?key=${eq('rhythm_rockstars_leaderboard')}`)) || [];
      idKey = 'id';
    } else {
      throw new UserError('Unknown game.');
    }
    let removed = 0;
    const upserts: { key: string; value: any }[] = [];
    for (const row of rows) {
      if (!row || !Array.isArray(row.value)) continue;
      const kept = row.value.filter((e: any) => !matches(e, idKey));
      if (kept.length !== row.value.length) {
        removed += row.value.length - kept.length;
        upserts.push({ key: row.key, value: kept });
      }
    }
    if (upserts.length) await db.upsert('classroom_config', upserts);
    return { ok: true, removed };
  }

  throw new UserError('Unknown classroom action: ' + action);
}

async function readLeaderboard(db: Db): Promise<any[]> {
  const configs = (await db.fetch('classroom_config?key=ilike.staff_wars_leaderboard*')) || [];
  const merged: any[] = [];
  for (const row of configs) {
    if (!row || !Array.isArray(row.value)) continue;
    const keyLevelMatch = String(row.key || '').match(/level_(\d+)/);
    const fallbackLevel = keyLevelMatch ? Math.max(1, parseInt(keyLevelMatch[1], 10) || 1) : 1;
    for (const entry of row.value) {
      if (!entry || !entry.name) continue;
      const entryScore = Number(entry.score) || 0;
      const entryLevel = Math.max(1, parseInt(entry.level, 10) || fallbackLevel);
      const studentId = entry.studentId ? String(entry.studentId) : null;
      const normName = normalizeStudentName(String(entry.name || ''));
      const idx = merged.findIndex(
        (e: any) =>
          studentId
            ? e.studentId === studentId
            : !e.studentId && normName && normalizeStudentName(String(e.name || '')) === normName,
      );
      if (idx >= 0) {
        const prev = merged[idx];
        const prevScore = Number(prev.score) || 0;
        const prevLevel = Math.max(1, parseInt(prev.level, 10) || 1);
        merged[idx] = {
          ...prev,
          ...(entryScore >= prevScore ? entry : {}),
          id: prev.id || entry.id,
          studentId: studentId || prev.studentId || null,
          name: entryScore >= prevScore ? entry.name : prev.name,
          score: Math.max(prevScore, entryScore),
          level: Math.max(prevLevel, entryLevel),
          updatedAt:
            entryScore >= prevScore
              ? entry.updatedAt || prev.updatedAt
              : prev.updatedAt || entry.updatedAt,
        };
      } else {
        merged.push({
          ...entry,
          studentId,
          score: entryScore,
          level: entryLevel,
        });
      }
    }
  }
  return merged
    .sort((a: any, b: any) => (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.level) || 1) - (Number(a.level) || 1))
    .slice(0, 100);
}

async function readClefLeaderboard(db: Db, clef: string): Promise<any[]> {
  const configs = (await db.fetch(`classroom_config?key=${eq(`staff_wars_leaderboard_clef_${clef}`)}`)) || [];
  const list = configs[0] && Array.isArray(configs[0].value) ? [...configs[0].value] : [];
  return list
    .sort((a: any, b: any) => (Number(b.score) || 0) - (Number(a.score) || 0) || (Number(b.level) || 1) - (Number(a.level) || 1))
    .slice(0, 100);
}

async function readRhythmLeaderboard(db: Db): Promise<any[]> {
  const configs = (await db.fetch(`classroom_config?key=${eq('rhythm_rockstars_leaderboard')}`)) || [];
  const list = configs[0] && Array.isArray(configs[0].value) ? [...configs[0].value] : [];
  return list
    .sort((a: any, b: any) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0))
    .slice(0, 150)
    .map((item: any, idx: number) => ({ ...item, rank: idx + 1 }));
}
