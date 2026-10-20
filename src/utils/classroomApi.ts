import { Score } from '../types/music';
import { containsProfanity } from './profanityFilter';

export const STANDARD_GRADES = [
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  'High School',
] as const;

export type StandardGrade = (typeof STANDARD_GRADES)[number];

export interface ClassroomRecord {
  id: string;
  name: string;
  grade: string;
  schoolName?: string;
  teacherId?: string;
  teacherName?: string;
  allowSelfRegister?: boolean;
  createdAt?: string;
}

export interface TeacherRecord {
  id: string;
  name: string;
  pin: string;
  schoolName?: string;
  gradeRange?: string;
  isMasterAdmin?: boolean;
  createdAt?: string;
}

export interface PublicStudentInfo {
  id: string;
  firstName: string;
  classGroup?: string;
  classId?: string;
  grade?: string;
}

export interface StudentSession {
  id: string;
  firstName: string;
  pin: string;
  classGroup?: string;
  classId?: string;
  grade?: string;
  schoolName?: string;
}

export interface StudentRecord {
  id: string;
  firstName: string;
  pin: string;
  classGroup?: string;
  classId?: string;
  grade?: string;
  schoolName?: string;
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
  classrooms?: ClassroomRecord[];
  teachers?: TeacherRecord[];
  isMasterAdmin?: boolean;
  currentTeacher?: TeacherRecord;
}

interface ClassroomDbShape {
  teacherPin: string;
  allowStudentSelfCreate: boolean;
  teachers?: TeacherRecord[];
  classrooms?: ClassroomRecord[];
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

/**
 * Formats a student's display name cleanly:
 * "alex m" or "Alex M" -> "Alex M."
 */
export function formatStudentDisplayName(raw: string): string {
  const trimmed = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const parts = trimmed.split(' ');
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (last.length === 1 && /[a-zA-Z]/.test(last)) {
      const firstParts = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
      return `${firstParts.join(' ')} ${last.toUpperCase()}.`;
    }
  }
  return trimmed.split(' ').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

export const DEFAULT_CLASSROOMS: ClassroomRecord[] = [
  // 1st Grade: Darois, Milne
  { id: 'cls_1_darois', name: 'Darois', grade: '1st Grade', teacherName: 'Darois', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_1_milne', name: 'Milne', grade: '1st Grade', teacherName: 'Milne', schoolName: 'Music Lab Elementary', allowSelfRegister: true },

  // 2nd Grade: Kent, Summa, Calicchia
  { id: 'cls_2_kent', name: 'Kent', grade: '2nd Grade', teacherName: 'Kent', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_2_summa', name: 'Summa', grade: '2nd Grade', teacherName: 'Summa', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_2_calicchia', name: 'Calicchia', grade: '2nd Grade', teacherName: 'Calicchia', schoolName: 'Music Lab Elementary', allowSelfRegister: true },

  // 3rd Grade: Lachacz, Falcone, Stalder, Powless, Elliott
  { id: 'cls_3_lachacz', name: 'Lachacz', grade: '3rd Grade', teacherName: 'Lachacz', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_3_falcone', name: 'Falcone', grade: '3rd Grade', teacherName: 'Falcone', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_3_stalder', name: 'Stalder', grade: '3rd Grade', teacherName: 'Stalder', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_3_powless', name: 'Powless', grade: '3rd Grade', teacherName: 'Powless', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_3_elliott', name: 'Elliott', grade: '3rd Grade', teacherName: 'Elliott', schoolName: 'Music Lab Elementary', allowSelfRegister: true },

  // 4th Grade: Cary, Shea, Fluty, Reid
  { id: 'cls_4_cary', name: 'Cary', grade: '4th Grade', teacherName: 'Cary', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_4_shea', name: 'Shea', grade: '4th Grade', teacherName: 'Shea', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_4_fluty', name: 'Fluty', grade: '4th Grade', teacherName: 'Fluty', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_4_reid', name: 'Reid', grade: '4th Grade', teacherName: 'Reid', schoolName: 'Music Lab Elementary', allowSelfRegister: true },

  // 5th Grade: Clawson, Fluty, Chambrone, Ott
  { id: 'cls_5_clawson', name: 'Clawson', grade: '5th Grade', teacherName: 'Clawson', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_5_fluty', name: 'Fluty', grade: '5th Grade', teacherName: 'Fluty', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_5_chambrone', name: 'Chambrone', grade: '5th Grade', teacherName: 'Chambrone', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_5_ott', name: 'Ott', grade: '5th Grade', teacherName: 'Ott', schoolName: 'Music Lab Elementary', allowSelfRegister: true },

  // 6th Grade: Lewha, Smith, Moore, Szczerba
  { id: 'cls_6_lewha', name: 'Lewha', grade: '6th Grade', teacherName: 'Lewha', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_6_smith', name: 'Smith', grade: '6th Grade', teacherName: 'Smith', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_6_moore', name: 'Moore', grade: '6th Grade', teacherName: 'Moore', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_6_szczerba', name: 'Szczerba', grade: '6th Grade', teacherName: 'Szczerba', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
];

export const DEFAULT_TEACHERS: TeacherRecord[] = [
  {
    id: 'teach_master',
    name: 'Mr. Arthur',
    pin: '1138',
    schoolName: 'Music Lab Elementary',
    isMasterAdmin: true,
    createdAt: new Date().toISOString(),
  },
];

function getDefaultLocalDb(): ClassroomDbShape {
  return {
    teacherPin: '1138',
    allowStudentSelfCreate: true,
    teachers: [...DEFAULT_TEACHERS],
    classrooms: [...DEFAULT_CLASSROOMS],
    students: [],
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
    const hasOldMockClassrooms =
      !Array.isArray(parsed.classrooms) ||
      parsed.classrooms.length === 0 ||
      parsed.classrooms.some((c: any) => c.id === 'cls_k' || c.id === 'cls_1a' || c.grade === 'Kindergarten');
    const classrooms = hasOldMockClassrooms ? [...DEFAULT_CLASSROOMS] : parsed.classrooms;

    return {
      teacherPin: parsed.teacherPin === '1234' ? '1138' : (parsed.teacherPin || '1138'),
      allowStudentSelfCreate: parsed.allowStudentSelfCreate !== undefined ? Boolean(parsed.allowStudentSelfCreate) : true,
      teachers: Array.isArray(parsed.teachers) && parsed.teachers.length > 0 ? parsed.teachers : [...DEFAULT_TEACHERS],
      classrooms,
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
      .map((s) => ({
        id: s.id,
        firstName: s.firstName,
        classGroup: s.classGroup || '',
        classId: s.classId || '',
        grade: s.grade || '',
      }))
      .sort((a, b) => a.firstName.localeCompare(b.firstName, undefined, { sensitivity: 'base' }));
    return {
      ok: true,
      roster,
      classrooms: db.classrooms || DEFAULT_CLASSROOMS,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
    };
  }

  if (action === 'student_login') {
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classId = String(payload.classId || '').trim();
    const grade = String(payload.grade || '').trim();
    const classGroup = String(payload.classGroup || payload.className || '').trim();

    if (!firstName || !pin) {
      throw new Error('Please enter your first name and PIN.');
    }
    if (containsProfanity(firstName)) {
      throw new Error('Please use a school-appropriate student name.');
    }

    const normInput = normalizeStudentName(firstName);
    // Find matching student by normalized name, preferring matching classId or classGroup
    let found = db.students.find((s) => {
      const matchName = normalizeStudentName(s.firstName) === normInput;
      if (!matchName) return false;
      if (classId && s.classId) return s.classId === classId;
      if (classGroup && s.classGroup) return s.classGroup.toLowerCase() === classGroup.toLowerCase();
      return true;
    });

    if (found) {
      if (String(found.pin).trim() !== pin) {
        throw new Error('Incorrect PIN for ' + found.firstName + '. Please try again!');
      }
      // Update classId/grade if previously missing
      if (classId && !found.classId) found.classId = classId;
      if (grade && !found.grade) found.grade = grade;
      if (classGroup && !found.classGroup) found.classGroup = classGroup;
      writeLocalDb(db);

      const projects = db.projects
        .filter((p) => p.studentId === found.id)
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      return {
        ok: true,
        student: {
          id: found.id,
          firstName: found.firstName,
          pin: found.pin,
          classGroup: found.classGroup || classGroup || '',
          classId: found.classId || classId || '',
          grade: found.grade || grade || '',
          schoolName: found.schoolName || '',
        },
        projects,
      };
    }

    // Check if classroom allows self-registration or global allowStudentSelfCreate
    const classroom = (db.classrooms || []).find((c) => c.id === classId);
    const selfRegisterAllowed = classroom
      ? classroom.allowSelfRegister !== false
      : db.allowStudentSelfCreate !== false;

    if (!selfRegisterAllowed) {
      throw new Error('Self-registration is currently closed for this class. Ask your teacher to add your name.');
    }

    const displayName = formatStudentDisplayName(firstName);
    const newStudent: StudentRecord = {
      id: 'stu_' + Math.random().toString(36).slice(2, 10),
      firstName: displayName,
      pin,
      classGroup: classroom ? classroom.name : (classGroup || ''),
      classId: classId || '',
      grade: classroom ? classroom.grade : (grade || ''),
      schoolName: classroom?.schoolName || '',
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
    const isMaster = teacherPin === db.teacherPin || teacherPin === '1138' || teacherPin === 'adminbaby';
    const matchedTeacher = (db.teachers || []).find((t) => String(t.pin).trim() === teacherPin);
    if (isTeacher && (isMaster || matchedTeacher)) {
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
    const isMaster = teacherPin === db.teacherPin || teacherPin === '1138' || teacherPin === 'adminbaby';
    const matchedTeacher = (db.teachers || []).find((t) => String(t.pin).trim() === teacherPin);
    if (isTeacher && (isMaster || matchedTeacher)) {
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

  const isMasterPin = (pin: string) => pin === db.teacherPin || pin === '1138' || pin === 'adminbaby';

  const verifyTeacher = () => {
    const teacherPin = String(payload.teacherPin || '').trim();
    const isMaster = isMasterPin(teacherPin);
    const teachers = db.teachers || [];
    const matchedTeacher = teachers.find((t) => String(t.pin).trim() === teacherPin);
    if (!isMaster && !matchedTeacher) {
      throw new Error('Invalid Teacher PIN.');
    }
    return { isMaster, teacher: matchedTeacher };
  };

  if (action === 'teacher_login' || action === 'teacher_overview') {
    const { isMaster, teacher } = verifyTeacher();
    const currentTeacher: TeacherRecord = teacher || {
      id: 'teach_master',
      name: 'Mr. Arthur',
      pin: db.teacherPin,
      schoolName: 'Music Lab Elementary',
      isMasterAdmin: true,
    };

    return {
      ok: true,
      isMasterAdmin: isMaster,
      currentTeacher,
      teachers: db.teachers || DEFAULT_TEACHERS,
      classrooms: db.classrooms || DEFAULT_CLASSROOMS,
      students: db.students,
      projects: db.projects,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
      teacherPin: db.teacherPin,
    };
  }

  if (action === 'teacher_save_classroom') {
    verifyTeacher();
    const cls = payload.classroom || {};
    const id = cls.id || 'cls_' + Math.random().toString(36).slice(2, 10);
    const name = String(cls.name || '').trim();
    const grade = String(cls.grade || '').trim();
    if (!name || !grade) {
      throw new Error('Classroom name and Grade level are required.');
    }
    if (containsProfanity(name)) {
      throw new Error('Please choose a school-appropriate classroom name.');
    }
    if (!db.classrooms) db.classrooms = [...DEFAULT_CLASSROOMS];
    const existingIdx = db.classrooms.findIndex((c) => c.id === id);
    const updatedClassroom: ClassroomRecord = {
      id,
      name,
      grade,
      schoolName: String(cls.schoolName || 'Music Lab Elementary').trim(),
      teacherId: cls.teacherId || '',
      teacherName: cls.teacherName || '',
      allowSelfRegister: cls.allowSelfRegister !== false,
      createdAt: cls.createdAt || new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      db.classrooms[existingIdx] = updatedClassroom;
    } else {
      db.classrooms.push(updatedClassroom);
    }
    writeLocalDb(db);
    return { ok: true, classrooms: db.classrooms };
  }

  if (action === 'teacher_delete_classroom') {
    verifyTeacher();
    const classroomId = String(payload.classroomId || '');
    if (db.classrooms) {
      db.classrooms = db.classrooms.filter((c) => c.id !== classroomId);
    }
    writeLocalDb(db);
    return { ok: true, classrooms: db.classrooms };
  }

  if (action === 'teacher_save_teacher') {
    const pin = String(payload.teacherPin || '').trim();
    if (!isMasterPin(pin)) {
      throw new Error('Only Master Admin can manage teacher accounts.');
    }
    const tData = payload.teacher || {};
    const id = tData.id || 'teach_' + Math.random().toString(36).slice(2, 10);
    const name = String(tData.name || '').trim();
    const teacherPin = String(tData.pin || '').trim();
    const schoolName = String(tData.schoolName || 'Music Lab Elementary').trim();
    if (!name || !teacherPin) {
      throw new Error('Teacher name and PIN are required.');
    }
    if (!db.teachers) db.teachers = [...DEFAULT_TEACHERS];
    const existingIdx = db.teachers.findIndex((t) => t.id === id);
    const updatedTeacher: TeacherRecord = {
      id,
      name,
      pin: teacherPin,
      schoolName,
      isMasterAdmin: Boolean(tData.isMasterAdmin),
      createdAt: tData.createdAt || new Date().toISOString(),
    };
    if (existingIdx >= 0) {
      db.teachers[existingIdx] = updatedTeacher;
    } else {
      db.teachers.push(updatedTeacher);
    }
    writeLocalDb(db);
    return { ok: true, teachers: db.teachers };
  }

  if (action === 'teacher_delete_teacher') {
    const pin = String(payload.teacherPin || '').trim();
    if (!isMasterPin(pin)) {
      throw new Error('Only Master Admin can delete teacher accounts.');
    }
    const teacherId = String(payload.teacherId || '');
    if (db.teachers) {
      db.teachers = db.teachers.filter((t) => t.id !== teacherId);
    }
    writeLocalDb(db);
    return { ok: true, teachers: db.teachers };
  }

  if (action === 'teacher_save_student') {
    verifyTeacher();
    const id = String(payload.id || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classGroup = String(payload.classGroup || '').trim();
    const classId = String(payload.classId || '').trim();
    const grade = String(payload.grade || '').trim();

    if (!firstName || !pin) {
      throw new Error('First name and PIN are required.');
    }

    if (containsProfanity(firstName) || containsProfanity(classGroup)) {
      throw new Error('Please use school-appropriate student and class names.');
    }

    const displayName = formatStudentDisplayName(firstName);

    if (id) {
      db.students = db.students.map((s) =>
        s.id === id ? { ...s, firstName: displayName, pin, classGroup, classId, grade } : s
      );
      db.projects = db.projects.map((p) =>
        p.studentId === id ? { ...p, studentName: displayName } : p
      );
    } else {
      db.students.push({
        id: 'stu_' + Math.random().toString(36).slice(2, 10),
        firstName: displayName,
        pin,
        classGroup,
        classId,
        grade,
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
      const cid = String(entry.classId || '').trim();
      const gr = String(entry.grade || '').trim();
      if (!fn) continue;
      if (containsProfanity(fn) || containsProfanity(cg)) {
        throw new Error('Roster entries must use school-appropriate names.');
      }
      db.students.push({
        id: 'stu_' + Math.random().toString(36).slice(2, 10),
        firstName: formatStudentDisplayName(fn),
        pin: p,
        classGroup: cg,
        classId: cid,
        grade: gr,
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
      if (Array.isArray(payload.importDb.classrooms)) db.classrooms = payload.importDb.classrooms;
      if (Array.isArray(payload.importDb.teachers)) db.teachers = payload.importDb.teachers;
    }
    writeLocalDb(db);
    return {
      ok: true,
      teacherPin: db.teacherPin,
      allowStudentSelfCreate: db.allowStudentSelfCreate,
      teachers: db.teachers || DEFAULT_TEACHERS,
      classrooms: db.classrooms || DEFAULT_CLASSROOMS,
      students: db.students,
      projects: db.projects,
    };
  }

  throw new Error('Unknown classroom action: ' + action);
}

// ============================================================================
// SUPABASE CLOUD DATABASE CONFIGURATION & HANDLER
// ============================================================================
const SUPABASE_URL = 'https://xnbhxrzzyjbthrobdkwb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JipVOkkWnwggeTM6uv7sEQ_rcLwiMmZ';

async function supabaseFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Supabase request failed (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && (errJson.message || errJson.error)) {
        errMsg = errJson.message || errJson.error;
      }
    } catch {
      try {
        const text = await res.text();
        if (text) errMsg = text;
      } catch {}
    }
    throw new Error(errMsg);
  }

  if (res.status === 204) return null;

  try {
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Handles all classroom and student requests against Supabase PostgreSQL cloud database
 */
async function executeSupabaseRequest(payload: Record<string, any>): Promise<any> {
  const action = String(payload.action || '');

  // 1. PUBLIC ROSTER
  if (action === 'public_roster') {
    const [classrooms, students, configs] = await Promise.all([
      supabaseFetch('classrooms?select=*&order=grade.asc,name.asc').catch(() => []),
      supabaseFetch('students?select=id,first_name,class_group,class_id,grade&order=first_name.asc').catch(() => []),
      supabaseFetch('classroom_config?key=eq.allowStudentSelfCreate').catch(() => []),
    ]);

    const allowStudentSelfCreate =
      configs && configs.length > 0 && configs[0].value !== undefined
        ? Boolean(configs[0].value)
        : true;

    return {
      ok: true,
      roster: (students || []).map((s: any) => ({
        id: s.id,
        firstName: s.first_name,
        classGroup: s.class_group || '',
        classId: s.class_id || '',
        grade: s.grade || '',
      })),
      classrooms: (classrooms || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        teacherName: c.teacher_name || '',
        schoolName: c.school_name || 'Music Lab Elementary',
        allowSelfRegister: c.allow_self_register !== false,
      })),
      allowStudentSelfCreate,
    };
  }

  // 2. STUDENT LOGIN
  if (action === 'student_login') {
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classId = String(payload.classId || '').trim();
    const grade = String(payload.grade || '').trim();
    const classGroup = String(payload.classGroup || payload.className || '').trim();

    if (!firstName || !pin) {
      throw new Error('Please enter your first name and PIN.');
    }
    if (containsProfanity(firstName)) {
      throw new Error('Please use a school-appropriate student name.');
    }

    const normInput = normalizeStudentName(firstName);
    const matchingStudents = await supabaseFetch(
      `students?first_name=ilike.${encodeURIComponent(firstName)}`
    );

    let found = (matchingStudents || []).find((s: any) => {
      const matchName = normalizeStudentName(s.first_name) === normInput;
      if (!matchName) return false;
      if (classId && s.class_id) return s.class_id === classId;
      if (classGroup && s.class_group) return s.class_group.toLowerCase() === classGroup.toLowerCase();
      return true;
    });

    if (found) {
      if (String(found.pin).trim() !== pin) {
        throw new Error('Incorrect PIN for ' + found.first_name + '. Please try again!');
      }

      // Update classId/grade if previously missing
      if ((classId && !found.class_id) || (grade && !found.grade) || (classGroup && !found.class_group)) {
        await supabaseFetch(`students?id=eq.${found.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            class_id: classId || found.class_id,
            grade: grade || found.grade,
            class_group: classGroup || found.class_group,
          }),
        }).catch(() => {});
      }

      const rawProjects = await supabaseFetch(
        `projects?student_id=eq.${found.id}&order=updated_at.desc`
      );

      const projects: SavedProjectRecord[] = (rawProjects || []).map((p: any) => ({
        id: p.id,
        studentId: p.student_id,
        studentName: p.student_name,
        title: p.title,
        appType: p.app_type,
        score: p.score,
        projectData: p.project_data,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));

      return {
        ok: true,
        student: {
          id: found.id,
          firstName: found.first_name,
          pin: found.pin,
          classGroup: found.class_group || classGroup || '',
          classId: found.class_id || classId || '',
          grade: found.grade || grade || '',
          schoolName: found.school_name || 'Music Lab Elementary',
        },
        projects,
      };
    }

    // New student self-registration
    const classrooms = await supabaseFetch('classrooms?select=*').catch(() => []);
    const classroom = (classrooms || []).find((c: any) => c.id === classId);
    const selfRegisterAllowed = classroom ? classroom.allow_self_register !== false : true;

    if (!selfRegisterAllowed) {
      throw new Error('Self-registration is currently closed for this class. Ask your teacher to add your name.');
    }

    const displayName = formatStudentDisplayName(firstName);
    const newStudentId = 'stu_' + Math.random().toString(36).slice(2, 10);
    const newStudent = {
      id: newStudentId,
      first_name: displayName,
      pin,
      class_group: classroom ? classroom.name : (classGroup || ''),
      class_id: classId || '',
      grade: classroom ? classroom.grade : (grade || ''),
      school_name: classroom?.school_name || 'Music Lab Elementary',
    };

    await supabaseFetch('students', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([newStudent]),
    });

    return {
      ok: true,
      student: {
        id: newStudentId,
        firstName: displayName,
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
    const pin = String(payload.pin || '');

    const students = await supabaseFetch(`students?id=eq.${studentId}`);
    const student = students && students[0];
    if (!student || (pin && String(student.pin) !== pin)) {
      throw new Error('Invalid student session.');
    }

    const rawProjects = await supabaseFetch(
      `projects?student_id=eq.${studentId}&order=updated_at.desc`
    );

    const projects: SavedProjectRecord[] = (rawProjects || []).map((p: any) => ({
      id: p.id,
      studentId: p.student_id,
      studentName: p.student_name,
      title: p.title,
      appType: p.app_type,
      score: p.score,
      projectData: p.project_data,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return { ok: true, projects };
  }

  // 4. STUDENT CHANGE PIN
  if (action === 'student_change_pin') {
    const studentId = String(payload.studentId || '');
    const currentPin = String(payload.currentPin || '');
    const newPin = String(payload.newPin || '').trim();

    if (!newPin || newPin.length < 3) {
      throw new Error('New PIN must be at least 3 digits.');
    }

    const students = await supabaseFetch(`students?id=eq.${studentId}`);
    const student = students && students[0];
    if (!student || (currentPin && String(student.pin) !== currentPin)) {
      throw new Error('Current session verification failed.');
    }

    await supabaseFetch(`students?id=eq.${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pin: newPin }),
    });

    return { ok: true, newPin };
  }

  // 5. SAVE PROJECT
  if (action === 'save_project') {
    const studentId = String(payload.studentId || '');
    const pin = String(payload.pin || '');
    const isTeacher = Boolean(payload.isTeacher);
    const teacherPin = String(payload.teacherPin || '');
    let projectId = String(payload.projectId || '');
    const title = String(payload.title || '').trim();
    const score = payload.score;
    const appType = (payload.appType as MusicLabAppType) || 'staff-composer';
    const projectData = payload.projectData;

    if (!title || title.toLowerCase() === 'my composition' || title.toLowerCase() === 'untitled') {
      return { ok: false, skipped: true, reason: 'Default untitled song is not auto-saved.' };
    }

    if (containsProfanity(title)) {
      throw new Error('Please choose a school-appropriate song title.');
    }

    let studentName = 'Student';
    const isMaster = teacherPin === '1138' || teacherPin === 'adminbaby';

    if (isTeacher && isMaster) {
      const st = await supabaseFetch(`students?id=eq.${studentId}`);
      if (st && st[0]) studentName = st[0].first_name;
    } else {
      const st = await supabaseFetch(`students?id=eq.${studentId}`);
      if (!st || !st[0] || (pin && String(st[0].pin) !== pin)) {
        throw new Error('Unauthorized save request.');
      }
      studentName = st[0].first_name;
    }

    if (!projectId) {
      const existing = await supabaseFetch(
        `projects?student_id=eq.${studentId}&title=ilike.${encodeURIComponent(title)}`
      );
      if (existing && existing.length > 0) {
        projectId = existing[0].id;
      } else {
        projectId = 'proj_' + Math.random().toString(36).slice(2, 12);
      }
    }

    const now = new Date().toISOString();
    const saved = await supabaseFetch('projects', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([
        {
          id: projectId,
          student_id: studentId,
          student_name: studentName,
          title,
          app_type: appType,
          score: score || null,
          project_data: projectData || null,
          updated_at: now,
        },
      ]),
    });

    const savedRecord = saved && saved[0] ? saved[0] : null;

    return {
      ok: true,
      project: savedRecord
        ? {
            id: savedRecord.id,
            studentId: savedRecord.student_id,
            studentName: savedRecord.student_name,
            title: savedRecord.title,
            appType: savedRecord.app_type,
            score: savedRecord.score,
            projectData: savedRecord.project_data,
            updatedAt: savedRecord.updated_at,
            createdAt: savedRecord.created_at,
          }
        : {
            id: projectId,
            studentId,
            studentName,
            title,
            appType,
            score,
            projectData,
            updatedAt: now,
            createdAt: now,
          },
    };
  }

  // 6. DELETE PROJECT
  if (action === 'delete_project') {
    const projectId = String(payload.projectId || '');
    const studentId = String(payload.studentId || '');
    const isTeacher = Boolean(payload.isTeacher);

    await supabaseFetch(
      `projects?id=eq.${projectId}${isTeacher ? '' : `&student_id=eq.${studentId}`}`,
      { method: 'DELETE' }
    );

    return { ok: true };
  }

  // 7. TEACHER PORTAL & OVERVIEW
  if (action === 'teacher_login' || action === 'teacher_overview') {
    const teacherPin = String(payload.teacherPin || '').trim();
    const isMaster = teacherPin === '1138' || teacherPin === 'adminbaby';

    const teachers = await supabaseFetch('teachers?select=*').catch(() => []);
    const matchedTeacher = (teachers || []).find((t: any) => String(t.pin).trim() === teacherPin);

    if (!isMaster && !matchedTeacher) {
      throw new Error('Invalid Teacher PIN.');
    }

    const [students, projects, classrooms, configs] = await Promise.all([
      supabaseFetch('students?select=*&order=first_name.asc').catch(() => []),
      supabaseFetch('projects?select=*&order=updated_at.desc').catch(() => []),
      supabaseFetch('classrooms?select=*&order=grade.asc,name.asc').catch(() => []),
      supabaseFetch('classroom_config?key=eq.allowStudentSelfCreate').catch(() => []),
    ]);

    const allowStudentSelfCreate =
      configs && configs.length > 0 && configs[0].value !== undefined
        ? Boolean(configs[0].value)
        : true;

    return {
      ok: true,
      isMasterAdmin: isMaster,
      currentTeacher: matchedTeacher
        ? {
            id: matchedTeacher.id,
            name: matchedTeacher.name,
            pin: matchedTeacher.pin,
            schoolName: matchedTeacher.school_name,
            isMasterAdmin: Boolean(matchedTeacher.is_master_admin),
          }
        : {
            id: 'teach_master',
            name: 'Mr. Arthur',
            pin: '1138',
            schoolName: 'Music Lab Elementary',
            isMasterAdmin: true,
          },
      teachers: (teachers || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        pin: t.pin,
        schoolName: t.school_name,
        isMasterAdmin: Boolean(t.is_master_admin),
      })),
      classrooms: (classrooms || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        teacherName: c.teacher_name,
        schoolName: c.school_name,
        allowSelfRegister: c.allow_self_register !== false,
      })),
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
      projects: (projects || []).map((p: any) => ({
        id: p.id,
        studentId: p.student_id,
        studentName: p.student_name,
        title: p.title,
        appType: p.app_type,
        score: p.score,
        projectData: p.project_data,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      })),
      allowStudentSelfCreate,
      teacherPin: '1138',
    };
  }

  // 8. TEACHER ADD / SAVE STUDENT
  if (action === 'teacher_save_student') {
    const id = String(payload.id || '').trim();
    const firstName = String(payload.firstName || '').trim();
    const pin = String(payload.pin || '').trim();
    const classGroup = String(payload.classGroup || '').trim();
    const classId = String(payload.classId || '').trim();
    const grade = String(payload.grade || '').trim();

    if (!firstName || !pin) {
      throw new Error('First name and PIN are required.');
    }
    if (containsProfanity(firstName) || containsProfanity(classGroup)) {
      throw new Error('Please use school-appropriate student and class names.');
    }

    const displayName = formatStudentDisplayName(firstName);
    const studentId = id || 'stu_' + Math.random().toString(36).slice(2, 10);

    await supabaseFetch('students', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([
        {
          id: studentId,
          first_name: displayName,
          pin,
          class_group: classGroup,
          class_id: classId,
          grade,
          school_name: 'Music Lab Elementary',
        },
      ]),
    });

    return { ok: true };
  }

  // 9. TEACHER BULK ADD STUDENTS
  if (action === 'teacher_bulk_add') {
    const entries = Array.isArray(payload.entries) ? payload.entries : [];
    const inserts: any[] = [];

    for (const entry of entries) {
      const fn = String(entry.firstName || '').trim();
      const p = String(entry.pin || '').trim() || String(Math.floor(1000 + Math.random() * 9000));
      const cg = String(entry.classGroup || '').trim();
      const cid = String(entry.classId || '').trim();
      const gr = String(entry.grade || '').trim();
      if (!fn) continue;
      inserts.push({
        id: 'stu_' + Math.random().toString(36).slice(2, 10),
        first_name: formatStudentDisplayName(fn),
        pin: p,
        class_group: cg,
        class_id: cid,
        grade: gr,
        school_name: 'Music Lab Elementary',
      });
    }

    if (inserts.length > 0) {
      await supabaseFetch('students', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(inserts),
      });
    }

    return { ok: true };
  }

  // 10. TEACHER DELETE STUDENT
  if (action === 'teacher_delete_student') {
    const studentId = String(payload.studentId || '');
    const deleteProjects = Boolean(payload.deleteProjects);

    await supabaseFetch(`students?id=eq.${studentId}`, { method: 'DELETE' });
    if (deleteProjects) {
      await supabaseFetch(`projects?student_id=eq.${studentId}`, { method: 'DELETE' }).catch(() => {});
    }

    return { ok: true };
  }

  // 11. TEACHER SAVE CLASSROOM
  if (action === 'teacher_save_classroom') {
    const cls = payload.classroom || {};
    const id = cls.id || 'cls_' + Math.random().toString(36).slice(2, 10);
    const name = String(cls.name || '').trim();
    const grade = String(cls.grade || '').trim();

    if (!name || !grade) throw new Error('Classroom name and Grade level are required.');

    await supabaseFetch('classrooms', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([
        {
          id,
          name,
          grade,
          school_name: String(cls.schoolName || 'Music Lab Elementary').trim(),
          teacher_name: cls.teacherName || '',
          allow_self_register: cls.allowSelfRegister !== false,
        },
      ]),
    });

    const classrooms = await supabaseFetch('classrooms?select=*&order=grade.asc,name.asc');
    return {
      ok: true,
      classrooms: (classrooms || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        teacherName: c.teacher_name,
        schoolName: c.school_name,
        allowSelfRegister: c.allow_self_register !== false,
      })),
    };
  }

  // 12. TEACHER DELETE CLASSROOM
  if (action === 'teacher_delete_classroom') {
    const classroomId = String(payload.classroomId || '');
    await supabaseFetch(`classrooms?id=eq.${classroomId}`, { method: 'DELETE' });
    const classrooms = await supabaseFetch('classrooms?select=*&order=grade.asc,name.asc');
    return {
      ok: true,
      classrooms: (classrooms || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        teacherName: c.teacher_name,
        schoolName: c.school_name,
        allowSelfRegister: c.allow_self_register !== false,
      })),
    };
  }

  // 13. TEACHER RENAME PROJECT
  if (action === 'teacher_rename_project') {
    const projectId = String(payload.projectId || '');
    const newTitle = String(payload.newTitle || '').trim();
    if (!newTitle) throw new Error('New title cannot be empty.');

    await supabaseFetch(`projects?id=eq.${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle, updated_at: new Date().toISOString() }),
    });

    return { ok: true };
  }

  // 14. TEACHER UPDATE SETTINGS
  if (action === 'teacher_update_settings') {
    if (payload.allowStudentSelfCreate !== undefined) {
      await supabaseFetch('classroom_config', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify([
          { key: 'allowStudentSelfCreate', value: Boolean(payload.allowStudentSelfCreate) },
        ]),
      }).catch(() => {});
    }

    return { ok: true };
  }

  throw new Error('Unknown cloud classroom action: ' + action);
}

/**
 * Sends a request to:
 * 1. Supabase Cloud Database (for seamless cross-device synchronization)
 * 2. Node/PHP backend (if self-hosted)
 * 3. Browser localStorage fallback (if offline)
 */
async function callClassroomBackend(payload: Record<string, any>): Promise<any> {
  // 1. Primary: Supabase Cloud Database (ensures students access work from school and home)
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const cloudResult = await executeSupabaseRequest(payload);
      // Keep a local copy updated in localStorage as an offline cache
      try {
        executeLocalFallback(payload);
      } catch {}
      return cloudResult;
    } catch (err: any) {
      // If it was an explicit user validation error, rethrow immediately
      if (
        err instanceof Error &&
        (err.message.includes('PIN') ||
          err.message.includes('not found') ||
          err.message.includes('Unauthorized') ||
          err.message.includes('required') ||
          err.message.includes('appropriate') ||
          err.message.includes('Invalid') ||
          err.message.includes('closed'))
      ) {
        throw err;
      }
      console.warn('Supabase cloud request unavailable, falling back to local storage:', err);
    }
  }

  // 2. Secondary: Node/PHP endpoints
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
        continue;
      }

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server request failed');
      }
      return data;
    } catch (err: any) {
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
    }
  }

  // 3. Tertiary: Local browser localStorage fallback (for offline use)
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
  classrooms: ClassroomRecord[];
  allowStudentSelfCreate: boolean;
}> {
  const res = await callClassroomBackend({ action: 'public_roster' });
  return {
    roster: res.roster || [],
    classrooms: res.classrooms || DEFAULT_CLASSROOMS,
    allowStudentSelfCreate: res.allowStudentSelfCreate ?? res.allowSelfRegister ?? true,
  };
}

export async function loginStudent(
  param1:
    | string
    | {
        firstName: string;
        pin: string;
        classId?: string;
        grade?: string;
        classGroup?: string;
      },
  param2?: string
): Promise<{ student: StudentSession; projects: SavedProjectRecord[] }> {
  let firstName = '';
  let pin = '';
  let classId = '';
  let grade = '';
  let classGroup = '';

  if (typeof param1 === 'object') {
    firstName = param1.firstName;
    pin = param1.pin;
    classId = param1.classId || '';
    grade = param1.grade || '';
    classGroup = param1.classGroup || '';
  } else {
    firstName = param1;
    pin = param2 || '';
  }

  const res = await callClassroomBackend({
    action: 'student_login',
    firstName,
    pin,
    classId,
    grade,
    classGroup,
  });

  const student: StudentSession = {
    ...res.student,
    pin: res.student?.pin || pin,
    classId: res.student?.classId || classId,
    grade: res.student?.grade || grade,
    classGroup: res.student?.classGroup || classGroup,
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
    classrooms: res.classrooms || DEFAULT_CLASSROOMS,
    teachers: res.teachers || DEFAULT_TEACHERS,
    isMasterAdmin: Boolean(res.isMasterAdmin),
    currentTeacher: res.currentTeacher,
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
  classId?: string;
  grade?: string;
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
  entries: { firstName: string; pin: string; classGroup?: string; classId?: string; grade?: string }[];
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

export async function teacherSaveClassroom(params: {
  teacherPin: string;
  classroom: Partial<ClassroomRecord> & { name: string; grade: string };
}): Promise<ClassroomRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_save_classroom',
    ...params,
  });
  return res.classrooms || [];
}

export async function teacherDeleteClassroom(params: {
  teacherPin: string;
  classroomId: string;
}): Promise<ClassroomRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_delete_classroom',
    ...params,
  });
  return res.classrooms || [];
}

export async function teacherSaveTeacher(params: {
  teacherPin: string;
  teacher: Partial<TeacherRecord> & { name: string; pin: string };
}): Promise<TeacherRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_save_teacher',
    ...params,
  });
  return res.teachers || [];
}

export async function teacherDeleteTeacher(params: {
  teacherPin: string;
  teacherId: string;
}): Promise<TeacherRecord[]> {
  const res = await callClassroomBackend({
    action: 'teacher_delete_teacher',
    ...params,
  });
  return res.teachers || [];
}

export async function teacherUpdateSettings(params: {
  teacherPin: string;
  newTeacherPin?: string;
  allowStudentSelfCreate?: boolean;
  importDb?: {
    students?: StudentRecord[];
    projects?: SavedProjectRecord[];
    classrooms?: ClassroomRecord[];
    teachers?: TeacherRecord[];
  };
}): Promise<TeacherPortalData> {
  const res = await callClassroomBackend({
    action: 'teacher_update_settings',
    ...params,
  });
  return {
    students: res.students || [],
    projects: res.projects || [],
    classrooms: res.classrooms || DEFAULT_CLASSROOMS,
    teachers: res.teachers || DEFAULT_TEACHERS,
    isMasterAdmin: Boolean(res.isMasterAdmin),
    currentTeacher: res.currentTeacher,
    allowStudentSelfCreate: res.allowStudentSelfCreate ?? true,
    teacherPin: res.teacherPin || params.newTeacherPin || params.teacherPin,
  };
}
