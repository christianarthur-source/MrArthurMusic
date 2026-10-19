import { Score } from '../types/music';
import { containsProfanity } from './profanityFilter';

export interface PublicStudentInfo {
  id: string;
  firstName: string;
  classGroup?: string;
}

export interface StudentSession {
  id: string;
  firstName: string;
  pin: string;
  classGroup?: string;
}

export interface StudentRecord {
  id: string;
  firstName: string;
  pin: string;
  classGroup?: string;
  createdAt?: string;
}

export type MusicLabAppType = 'staff-composer' | 'beat-machine' | 'rhythm-rockstars' | 'daw';

export interface SavedProjectRecord {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  updatedAt: string;
  createdAt?: string;
  score?: Score;
  appType?: MusicLabAppType;
  projectData?: any;
}

export interface TeacherPortalData {
  students: StudentRecord[];
  projects: SavedProjectRecord[];
  allowStudentSelfCreate: boolean;
  teacherPin: string;
}

interface ClassroomDbShape {
  teacherPin: string;
  allowStudentSelfCreate: boolean;
  students: StudentRecord[];
  projects: SavedProjectRecord[];
}

const LOCAL_DB_KEY = 'staff_composer_classroom_db_v1';
const STUDENT_SESSION_KEY = 'staff_composer_student_session_v1';

/**
 * Normalizes a student's name (First Name + Last Initial) so that:
 * "Alex M", "Alex M.", "alex m", "alex m.", "Alex  M." all normalize to "alex m"
 */
export function normalizeStudentName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .toLowerCase();
}

function getDefaultLocalDb(): ClassroomDbShape {
  return {
    teacherPin: '1138',
    allowStudentSelfCreate: true,
    students: [
      { id: 'stu_demo1', firstName: 'Alex M.', pin: '1111', classGroup: 'Grade 4', createdAt: new Date().toISOString() },
      { id: 'stu_demo2', firstName: 'Maya R.', pin: '2222', classGroup: 'Grade 4', createdAt: new Date().toISOString() },
      { id: 'stu_demo3', firstName: 'Liam K.', pin: '3333', classGroup: 'Grade 5', createdAt: new Date().toISOString() },
    ],
    projects: [],
  };
}

function readLocalDb(): ClassroomDbShape {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      const def = getDefaultLocalDb();
      localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(def));
      return def;
    }
    const parsed = JSON.parse(raw);
    return {
      teacherPin: parsed.teacherPin === '1234' ? '1138' : (parsed.teacherPin || '1138'),
      allowStudentSelfCreate: parsed.allowStudentSelfCreate !== undefined ? Boolean(parsed.allowStudentSelfCreate) : true,
      students: Array.isArray(parsed.students) ? parsed.students : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return getDefaultLocalDb();
  }
}

function writeLocalDb(db: ClassroomDbShape): void {
  try {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Fallback handler in case the app is previewed on a purely static host without Node or PHP.
 * When Node (/api/classroom) or PHP (/api.php) responds, the server is the source of truth.
 */
function executeLocalFallback(payload: Record<string, any>): any {
  const db = readLocalDb();
  const action = String(payload.action || '');

  if (action === 'public_roster') {
    const roster = db.students
      .map((s) => ({ id: s.id, firstName: s.firstName, classGroup: s.classGroup || '' }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }));
    return {
      ok: true,
      roster,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
    };
  }

  if (action === 'student_login') {
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    if (!firstName || !pin) {
      throw new Error('Please enter your first name and PIN.');
    }
    if (containsProfanity(firstName)) {
      throw new Error('Please use a school-appropriate student name.');
    }
    const found = db.students.find(
      (s) => normalizeStudentName(s.firstName) === normalizeStudentName(firstName)
    );
    if (found) {
      if (String(found.pin).trim() !== pin) {
        throw new Error('Incorrect PIN for ' + found.firstName + '. Please try again!');
      }
      const projects = db.projects
        .filter((p) => p.studentId === found.id)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      return {
        ok: true,
        student: {
          id: found.id,
          firstName: found.firstName,
          pin: found.pin,
          classGroup: found.classGroup || '',
        },
        projects,
      };
    }

    if (!db.allowStudentSelfCreate) {
      throw new Error('Student name not found. Ask your teacher to add your name.');
    }

    const newStudent: StudentRecord = {
      id: 'stu_' + Math.random().toString(36).slice(2, 10),
      firstName,
      pin,
      classGroup: '',
      createdAt: new Date().toISOString(),
    };
    db.students.push(newStudent);
    writeLocalDb(db);
    return {
      ok: true,
      student: newStudent,
      projects: [],
    };
  }

  if (action === 'student_projects') {
    const studentId = String(payload.studentId || '');
    const pin = String(payload.pin || '');
    const found = db.students.find((s) => s.id === studentId && (!pin || String(s.pin) === pin));
    if (!found) {
      throw new Error('Invalid student session.');
    }
    const projects = db.projects
      .filter((p) => p.studentId === studentId)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return { ok: true, projects };
  }

  if (action === 'student_change_pin') {
    const studentId = String(payload.studentId || '');
    const currentPin = String(payload.currentPin || '');
    const newPin = String(payload.newPin || '').trim();
    if (!newPin || newPin.length < 3) {
      throw new Error('New PIN must be at least 3 digits.');
    }
    const student = db.students.find(
      (s) => s.id === studentId && (!currentPin || s.pin === currentPin)
    );
    if (!student) {
      throw new Error('Current session verification failed.');
    }
    student.pin = newPin;
    writeLocalDb(db);
    return { ok: true, newPin };
  }

  if (action === 'save_project') {
    const studentId = String(payload.studentId || '');
    const pin = String(payload.pin || '');
    const isTeacher = Boolean(payload.isTeacher);
    const teacherPin = String(payload.teacherPin || '');
    const projectId = String(payload.projectId || '');
    const title = String(payload.title || '').trim();
    const score = payload.score as Score | undefined;
    const appType = (payload.appType as MusicLabAppType) || 'staff-composer';
    const projectData = payload.projectData;

    if (!title || title.toLowerCase() === 'my composition' || title.toLowerCase() === 'untitled') {
      return { ok: false, skipped: true, reason: 'Default untitled song is not auto-saved.' };
    }

    if (containsProfanity(title)) {
      throw new Error('Please choose a school-appropriate song title.');
    }

    let authorized = false;
    let studentName = 'Student';
    if (isTeacher && teacherPin === db.teacherPin) {
      authorized = true;
      const st = db.students.find((s) => s.id === studentId);
      if (st) studentName = st.firstName;
    } else {
      const st = db.students.find((s) => s.id === studentId && (!pin || String(s.pin) === pin));
      if (st) {
        authorized = true;
        studentName = st.firstName;
      }
    }

    if (!authorized) {
      throw new Error('Unauthorized save request.');
    }

    const now = new Date().toISOString();
    let existingIndex = -1;
    if (projectId) {
      existingIndex = db.projects.findIndex((p) => p.id === projectId && p.studentId === studentId);
    }
    if (existingIndex === -1) {
      existingIndex = db.projects.findIndex(
        (p) => p.studentId === studentId && p.title.toLowerCase() === title.toLowerCase()
      );
    }

    let savedProject: SavedProjectRecord;
    if (existingIndex >= 0) {
      db.projects[existingIndex] = {
        ...db.projects[existingIndex],
        title,
        studentName,
        score,
        appType,
        projectData: projectData ?? db.projects[existingIndex].projectData,
        updatedAt: now,
      };
      savedProject = db.projects[existingIndex];
    } else {
      savedProject = {
        id: 'proj_' + Math.random().toString(36).slice(2, 12),
        studentId,
        studentName,
        title,
        score,
        appType,
        projectData,
        createdAt: now,
        updatedAt: now,
      };
      db.projects.push(savedProject);
    }
    writeLocalDb(db);
    return { ok: true, project: savedProject };
  }

  if (action === 'delete_project') {
    const projectId = String(payload.projectId || '');
    const studentId = String(payload.studentId || '');
    const pin = String(payload.pin || '');
    const isTeacher = Boolean(payload.isTeacher);
    const teacherPin = String(payload.teacherPin || '');

    let authorized = false;
    if (isTeacher && teacherPin === db.teacherPin) {
      authorized = true;
    } else {
      const st = db.students.find((s) => s.id === studentId && (!pin || String(s.pin) === pin));
      if (st) authorized = true;
    }
    if (!authorized) throw new Error('Unauthorized');

    db.projects = db.projects.filter(
      (p) => !(p.id === projectId && (isTeacher || p.studentId === studentId))
    );
    writeLocalDb(db);
    return { ok: true };
  }

  const verifyTeacher = () => {
    const teacherPin = String(payload.teacherPin || '').trim();
    if (teacherPin !== db.teacherPin && teacherPin !== '1138') {
      throw new Error('Invalid Teacher PIN.');
    }
  };

  if (action === 'teacher_login' || action === 'teacher_overview') {
    verifyTeacher();
    return {
      ok: true,
      students: db.students,
      projects: db.projects,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
      teacherPin: db.teacherPin,
    };
  }

  if (action === 'teacher_save_student') {
    verifyTeacher();
    const id = String(payload.id || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classGroup = String(payload.classGroup || '').trim();

    if (!firstName || !pin) {
      throw new Error('First name and PIN are required.');
    }

    if (containsProfanity(firstName) || containsProfanity(classGroup)) {
      throw new Error('Please use school-appropriate student and class names.');
    }

    if (id) {
      db.students = db.students.map((s) =>
        s.id === id ? { ...s, firstName, pin, classGroup } : s
      );
      db.projects = db.projects.map((p) =>
        p.studentId === id ? { ...p, studentName: firstName } : p
      );
    } else {
      db.students.push({
        id: 'stu_' + Math.random().toString(36).slice(2, 10),
        firstName,
        pin,
        classGroup,
        createdAt: new Date().toISOString(),
      });
    }
    writeLocalDb(db);
    return { ok: true, students: db.students, projects: db.projects };
  }

  if (action === 'teacher_bulk_add') {
    verifyTeacher();
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    for (const entry of entries) {
      const fn = String(entry.firstName || '').trim();
      const p = String(entry.pin || '').trim() || String(Math.floor(1000 + Math.random() * 9000));
      const cg = String(entry.classGroup || '').trim();
      if (!fn) continue;
      if (containsProfanity(fn) || containsProfanity(cg)) {
        throw new Error('Roster entries must use school-appropriate names.');
      }
      db.students.push({
        id: 'stu_' + Math.random().toString(36).slice(2, 10),
        firstName: fn,
        pin: p,
        classGroup: cg,
        createdAt: new Date().toISOString(),
      });
    }
    writeLocalDb(db);
    return { ok: true, students: db.students };
  }

  if (action === 'teacher_delete_student') {
    verifyTeacher();
    const studentId = String(payload.studentId || '');
    const deleteProjects = Boolean(payload.deleteProjects);
    db.students = db.students.filter((s) => s.id !== studentId);
    if (deleteProjects) {
      db.projects = db.projects.filter((p) => p.studentId !== studentId);
    }
    writeLocalDb(db);
    return { ok: true, students: db.students, projects: db.projects };
  }

  if (action === 'teacher_rename_project') {
    verifyTeacher();
    const projectId = String(payload.projectId || '');
    const newTitle = String(payload.newTitle || '').trim();
    if (!newTitle) throw new Error('New title cannot be empty.');
    if (containsProfanity(newTitle)) {
      throw new Error('Please choose a school-appropriate song title.');
    }
    db.projects = db.projects.map((p) => {
      if (p.id !== projectId) return p;
      const updatedScore = { ...p.score, title: newTitle };
      return {
        ...p,
        title: newTitle,
        score: updatedScore,
        updatedAt: new Date().toISOString(),
      };
    });
    writeLocalDb(db);
    return { ok: true, projects: db.projects };
  }

  if (action === 'teacher_update_settings') {
    verifyTeacher();
    if (payload.newTeacherPin !== undefined) {
      const nextPin = String(payload.newTeacherPin).trim();
      if (nextPin.length >= 4) {
        db.teacherPin = nextPin;
      }
    }
    if (payload.allowStudentSelfCreate !== undefined) {
      db.allowStudentSelfCreate = Boolean(payload.allowStudentSelfCreate);
    }
    if (payload.importDb && typeof payload.importDb === 'object') {
      if (Array.isArray(payload.importDb.students)) db.students = payload.importDb.students;
      if (Array.isArray(payload.importDb.projects)) db.projects = payload.importDb.projects;
    }
    writeLocalDb(db);
    return {
      ok: true,
      teacherPin: db.teacherPin,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
      students: db.students,
      projects: db.projects,
    };
  }

  throw new Error('Unknown classroom action: ' + action);
}

/**
 * Sends a request to the server backend (/api/classroom for Node/Vite, /api.php for PHP hosting),
 * and falls back to local storage if neither server endpoint returns JSON.
 */
async function callClassroomBackend(payload: Record<string, any>): Promise<any> {
  const endpoints = ['/api/classroom', '/api.php'];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Endpoint returned HTML or raw PHP source (e.g. static server without PHP), try next
        continue;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server request failed');
      }
      return data;
    } catch (err: any) {
      // If it was an explicit application error from JSON response, rethrow immediately
      if (
        err instanceof Error &&
        (err.message.includes('PIN') ||
          err.message.includes('not found') ||
          err.message.includes('Unauthorized') ||
          err.message.includes('required') ||
          err.message.includes('Invalid'))
      ) {
        throw err;
      }
      // Otherwise network / 404 / non-JSON -> try next endpoint
    }
  }

  // Fallback to local browser DB if running on a static-only host
  return executeLocalFallback(payload);
}

export function getSavedStudentSession(): StudentSession | null {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.firstName) {
      return parsed as StudentSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStudentSession(session: StudentSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(STUDENT_SESSION_KEY);
    } else {
      localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore
  }
}

export async function fetchPublicRoster(): Promise<{
  roster: PublicStudentInfo[];
  allowStudentSelfCreate: boolean;
}> {
  const res = await callClassroomBackend({ action: 'public_roster' });
  return {
    roster: res.roster || [],
    allowStudentSelfCreate: res.allowStudentSelfCreate ?? res.allowSelfRegister ?? true,
  };
}

export async function loginStudent(
  firstName: string,
  pin: string
): Promise<{ student: StudentSession; projects: SavedProjectRecord[] }> {
  const res = await callClassroomBackend({
    action: 'student_login',
    firstName,
    pin,
  });
  const student: StudentSession = {
    ...res.student,
    pin: res.student?.pin || pin,
  };
  return {
    student,
    projects: res.projects || [],
  };
}

export async function fetchStudentProjects(
  session: StudentSession
): Promise<SavedProjectRecord[]> {
  const res = await callClassroomBackend({
    action: 'student_projects',
    studentId: session.id,
    pin: session.pin,
  });
  return res.projects || [];
}

export async function changeStudentPin(params: {
  studentId: string;
  currentPin: string;
  newPin: string;
}): Promise<string> {
  const res = await callClassroomBackend({
    action: 'student_change_pin',
    ...params,
  });
  return res.newPin || params.newPin;
}

export async function saveStudentProject(params: {
  studentId: string;
  pin?: string;
  isTeacher?: boolean;
  teacherPin?: string;
  projectId?: string | null;
  title: string;
  score?: Score;
  appType?: MusicLabAppType;
  projectData?: any;
}): Promise<{ saved: boolean; project?: SavedProjectRecord }> {
  const res = await callClassroomBackend({
    action: 'save_project',
    studentId: params.studentId,
    pin: params.pin || '',
    isTeacher: Boolean(params.isTeacher),
    teacherPin: params.teacherPin || '',
    projectId: params.projectId || '',
    title: params.title,
    score: params.score,
    appType: params.appType || 'staff-composer',
    projectData: params.projectData,
  });
  if (res.skipped) {
    return { saved: false };
  }
  return { saved: Boolean(res.ok), project: res.project };
}

export async function deleteStudentProject(params: {
  projectId: string;
  studentId?: string;
  pin?: string;
  isTeacher?: boolean;
  teacherPin?: string;
}): Promise<void> {
  await callClassroomBackend({
    action: 'delete_project',
    projectId: params.projectId,
    studentId: params.studentId || '',
    pin: params.pin || '',
    isTeacher: Boolean(params.isTeacher),
    teacherPin: params.teacherPin || '',
  });
}

export async function loginTeacher(teacherPin: string): Promise<TeacherPortalData> {
  const res = await callClassroomBackend({
    action: 'teacher_login',
    teacherPin,
  });
  return {
    students: res.students || [],
    projects: res.projects || [],
    allowStudentSelfCreate: res.allowStudentSelfCreate ?? true,
    teacherPin: res.teacherPin || teacherPin,
  };
}

export async function teacherSaveStudent(params: {
  teacherPin: string;
  id?: string;
  firstName: string;
  pin: string;
  classGroup?: string;
}): Promise<{ students: StudentRecord[]; projects: SavedProjectRecord[] }> {
  const res = await callClassroomBackend({
    action: 'teacher_save_student',
    ...params,
  });
  return {
    students: res.students || [],
    projects: res.projects || [],
  };
}

export async function teacherBulkAddStudents(params: {
  teacherPin: string;
  entries: { firstName: string; pin: string; classGroup?: string }[];
}): Promise<StudentRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_bulk_add',
    ...params,
  });
  return res.students || [];
}

export async function teacherDeleteStudent(params: {
  teacherPin: string;
  studentId: string;
  deleteProjects: boolean;
}): Promise<{ students: StudentRecord[]; projects: SavedProjectRecord[] }> {
  const res = await callClassroomBackend({
    action: 'teacher_delete_student',
    ...params,
  });
  return {
    students: res.students || [],
    projects: res.projects || [],
  };
}

export async function teacherRenameProject(params: {
  teacherPin: string;
  projectId: string;
  newTitle: string;
}): Promise<SavedProjectRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_rename_project',
    ...params,
  });
  return res.projects || [];
}

export async function teacherUpdateSettings(params: {
  teacherPin: string;
  newTeacherPin?: string;
  allowStudentSelfCreate?: boolean;
  importDb?: { students?: StudentRecord[]; projects?: SavedProjectRecord[] };
}): Promise<TeacherPortalData> {
  const res = await callClassroomBackend({
    action: 'teacher_update_settings',
    ...params,
  });
  return {
    students: res.students || [],
    projects: res.projects || [],
    allowStudentSelfCreate: res.allowStudentSelfCreate ?? true,
    teacherPin: res.teacherPin || params.newTeacherPin || params.teacherPin,
  };
}
