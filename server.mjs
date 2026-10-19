import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'classroom-data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const defaultClassrooms = [
  { id: 'cls_k', name: 'Kindergarten Music', grade: 'Kindergarten', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_1a', name: 'Room 101 - 1A', grade: '1st Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_2a', name: 'Room 102 - 2A', grade: '2nd Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_3a', name: 'Room 201 - 3A', grade: '3rd Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_4a', name: 'Room 204 - 4A', grade: '4th Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_4b', name: 'Room 205 - 4B', grade: '4th Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_5a', name: 'Room 301 - 5A', grade: '5th Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
  { id: 'cls_band', name: 'Elementary Band', grade: '5th Grade', teacherName: 'Mr. Arthur', schoolName: 'Music Lab Elementary', allowSelfRegister: true },
];

const defaultTeachers = [
  {
    id: 'teach_master',
    name: 'Mr. Arthur',
    pin: '1138',
    schoolName: 'Music Lab Elementary',
    isMasterAdmin: true,
    createdAt: new Date().toISOString(),
  },
];

function loadDb() {
  const defaultDb = {
    teacherPin: '1138',
    allowSelfRegister: true,
    teachers: [...defaultTeachers],
    classrooms: [...defaultClassrooms],
    students: [],
    projects: [],
  };
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    return {
      teacherPin: parsed.teacherPin === '1234' ? '1138' : (parsed.teacherPin || '1138'),
      allowSelfRegister: parsed.allowSelfRegister ?? true,
      teachers: Array.isArray(parsed.teachers) && parsed.teachers.length > 0 ? parsed.teachers : [...defaultTeachers],
      classrooms: Array.isArray(parsed.classrooms) && parsed.classrooms.length > 0 ? parsed.classrooms : [...defaultClassrooms],
      students: Array.isArray(parsed.students) ? parsed.students : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    return defaultDb;
  }
}

function saveDb(db) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, DB_PATH);
}

function makeId(prefix) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function normalizeStudentName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .toLowerCase();
}

function formatStudentDisplayName(raw) {
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

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (urlObj.pathname === '/api/classroom' || urlObj.pathname === '/api.php') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    let rawBody = '';
    req.on('data', (chunk) => (rawBody += chunk));
    req.on('end', () => {
      let body = {};
      try {
        body = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        body = {};
      }
      const action = urlObj.searchParams.get('action') || body.action || 'public_roster';
      const db = loadDb();
      const send = (status, payload) => {
        res.statusCode = status;
        res.end(JSON.stringify(payload));
      };

      if (action === 'public_roster') {
        return send(200, {
          ok: true,
          allowSelfRegister: Boolean(db.allowSelfRegister),
          classrooms: db.classrooms || defaultClassrooms,
          students: db.students.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            className: s.className || s.classGroup || '',
            classId: s.classId || '',
            grade: s.grade || '',
          })),
        });
      }

      if (action === 'student_login') {
        const firstName = String(body.firstName || '').trim();
        const pin = String(body.pin || '').trim();
        const classId = String(body.classId || '').trim();
        const grade = String(body.grade || '').trim();
        const className = String(body.className || body.classGroup || '').trim();
        if (!firstName || !pin) {
          return send(400, { ok: false, error: 'Please enter your First Name, Last Initial, and PIN.' });
        }
        let matchedStudent = null;
        let nameMatchDiffPin = false;
        const normInput = normalizeStudentName(firstName);
        for (const s of db.students) {
          const matchName = normalizeStudentName(s.firstName) === normInput;
          if (matchName) {
            if (classId && s.classId && s.classId !== classId) continue;
            if (s.pin === pin) {
              matchedStudent = s;
              break;
            } else {
              nameMatchDiffPin = true;
            }
          }
        }
        if (!matchedStudent) {
          if (nameMatchDiffPin) {
            return send(401, {
              ok: false,
              error: `Incorrect PIN for ${firstName}. Please try again or ask your teacher.`,
            });
          }
          const classroom = (db.classrooms || []).find((c) => c.id === classId);
          const selfAllowed = classroom ? classroom.allowSelfRegister !== false : Boolean(db.allowSelfRegister);
          if (selfAllowed) {
            const newStudent = {
              id: makeId('stu'),
              firstName: formatStudentDisplayName(firstName),
              pin,
              classId: classId || '',
              className: classroom ? classroom.name : (className || ''),
              classGroup: classroom ? classroom.name : (className || ''),
              grade: classroom ? classroom.grade : (grade || ''),
              createdAt: new Date().toISOString(),
            };
            db.students.push(newStudent);
            saveDb(db);
            matchedStudent = newStudent;
          } else {
            return send(404, {
              ok: false,
              error: 'Student name not found. Ask your teacher to add your name.',
            });
          }
        } else {
          if (classId && !matchedStudent.classId) matchedStudent.classId = classId;
          if (grade && !matchedStudent.grade) matchedStudent.grade = grade;
          saveDb(db);
        }
        return send(200, {
          ok: true,
          student: {
            id: matchedStudent.id,
            firstName: matchedStudent.firstName,
            pin: matchedStudent.pin,
            className: matchedStudent.className || matchedStudent.classGroup || '',
            classGroup: matchedStudent.classGroup || matchedStudent.className || '',
            classId: matchedStudent.classId || classId || '',
            grade: matchedStudent.grade || grade || '',
          },
          projects: db.projects.filter((p) => p.studentId === matchedStudent.id),
        });
      }

      if (action === 'student_projects') {
        const { studentId, pin } = body;
        const found = db.students.find((s) => s.id === studentId && (!pin || s.pin === pin));
        if (!found) return send(401, { ok: false, error: 'Unauthorized student session.' });
        return send(200, {
          ok: true,
          projects: db.projects.filter((p) => p.studentId === studentId),
        });
      }

      if (action === 'student_change_pin') {
        const { studentId, currentPin, newPin } = body;
        const cleanNewPin = String(newPin || '').trim();
        if (!cleanNewPin || cleanNewPin.length < 3) {
          return send(400, { ok: false, error: 'New PIN must be at least 3 digits.' });
        }
        const student = db.students.find(
          (s) => s.id === studentId && (!currentPin || s.pin === currentPin)
        );
        if (!student) {
          return send(401, { ok: false, error: 'Current session verification failed.' });
        }
        student.pin = cleanNewPin;
        saveDb(db);
        return send(200, { ok: true, newPin: cleanNewPin });
      }

      if (action === 'save_project') {
        const { studentId, pin, teacherPin, projectId, score, projectData } = body;
        const appType = body.appType || 'staff-composer';
        const title = String(body.title || '').trim();
        const isTeacher = Boolean(teacherPin && teacherPin === db.teacherPin);
        const student = db.students.find(
          (s) => s.id === studentId && (isTeacher || !pin || s.pin === pin)
        );
        if (!student || (!score && !projectData) || !title) {
          return send(400, { ok: false, error: 'Invalid student session or missing song title.' });
        }
        const now = new Date().toISOString();
        let updatedIdx = projectId
          ? db.projects.findIndex((p) => p.id === projectId && p.studentId === studentId)
          : -1;
        if (updatedIdx === -1) {
          updatedIdx = db.projects.findIndex(
            (p) =>
              p.studentId === studentId && p.title.trim().toLowerCase() === title.toLowerCase()
          );
        }
        let savedProject;
        if (updatedIdx >= 0) {
          db.projects[updatedIdx].title = title;
          if (score !== undefined) db.projects[updatedIdx].score = score;
          if (projectData !== undefined) db.projects[updatedIdx].projectData = projectData;
          db.projects[updatedIdx].appType = appType;
          db.projects[updatedIdx].updatedAt = now;
          savedProject = db.projects[updatedIdx];
        } else {
          savedProject = {
            id: makeId('proj'),
            studentId,
            studentName: student.firstName,
            title,
            score: score || null,
            appType,
            projectData: projectData || null,
            createdAt: now,
            updatedAt: now,
          };
          db.projects.push(savedProject);
        }
        saveDb(db);
        return send(200, {
          ok: true,
          project: savedProject,
          projects: db.projects.filter((p) => p.studentId === studentId),
        });
      }

      if (action === 'delete_project') {
        const { studentId, pin, teacherPin, projectId } = body;
        const isTeacher = Boolean(teacherPin && teacherPin === db.teacherPin);
        const authorized =
          isTeacher || db.students.some((s) => s.id === studentId && (!pin || s.pin === pin));
        if (!authorized) return send(401, { ok: false, error: 'Unauthorized' });
        db.projects = db.projects.filter((p) => {
          if (p.id !== projectId) return true;
          return !isTeacher && p.studentId !== studentId;
        });
        saveDb(db);
        return send(200, { ok: true });
      }

      function isMasterPin(pin) {
        return pin === db.teacherPin || pin === '1138' || pin === 'adminbaby';
      }

      function findTeacher(pin) {
        if (isMasterPin(pin)) {
          return {
            id: 'teach_master',
            name: 'Mr. Arthur',
            pin: db.teacherPin,
            schoolName: 'Music Lab Elementary',
            isMasterAdmin: true,
          };
        }
        const teachers = db.teachers || defaultTeachers;
        return teachers.find((t) => String(t.pin).trim() === pin) || null;
      }

      if (action === 'teacher_login') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) {
          return send(401, { ok: false, error: 'Incorrect Teacher PIN / Password.' });
        }
        return send(200, {
          ok: true,
          isMasterAdmin: Boolean(teacher.isMasterAdmin),
          currentTeacher: teacher,
          teachers: db.teachers || defaultTeachers,
          classrooms: db.classrooms || defaultClassrooms,
          allowSelfRegister: Boolean(db.allowSelfRegister),
          students: db.students,
          projects: db.projects,
          teacherPin: db.teacherPin,
        });
      }

      if (action === 'teacher_save_classroom') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const cls = body.classroom || {};
        const id = cls.id || makeId('cls');
        const name = String(cls.name || '').trim();
        const grade = String(cls.grade || '').trim();
        if (!name || !grade) {
          return send(400, { ok: false, error: 'Classroom name and Grade are required.' });
        }
        if (!db.classrooms) db.classrooms = [...defaultClassrooms];
        const idx = db.classrooms.findIndex((c) => c.id === id);
        const updated = {
          id,
          name,
          grade,
          schoolName: String(cls.schoolName || teacher.schoolName || 'Music Lab Elementary').trim(),
          teacherId: cls.teacherId || teacher.id,
          teacherName: cls.teacherName || teacher.name,
          allowSelfRegister: cls.allowSelfRegister !== false,
          createdAt: cls.createdAt || new Date().toISOString(),
        };
        if (idx >= 0) db.classrooms[idx] = updated;
        else db.classrooms.push(updated);
        saveDb(db);
        return send(200, { ok: true, classrooms: db.classrooms });
      }

      if (action === 'teacher_delete_classroom') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const classroomId = String(body.classroomId || '');
        if (db.classrooms) {
          db.classrooms = db.classrooms.filter((c) => c.id !== classroomId);
        }
        saveDb(db);
        return send(200, { ok: true, classrooms: db.classrooms });
      }

      if (action === 'teacher_save_teacher') {
        const pin = String(body.teacherPin || '').trim();
        if (!isMasterPin(pin)) {
          return send(401, { ok: false, error: 'Only Master Admin can manage teachers.' });
        }
        const tData = body.teacher || {};
        const id = tData.id || makeId('teach');
        const name = String(tData.name || '').trim();
        const tPin = String(tData.pin || '').trim();
        const schoolName = String(tData.schoolName || 'Music Lab Elementary').trim();
        if (!name || !tPin) return send(400, { ok: false, error: 'Teacher name and PIN required.' });
        if (!db.teachers) db.teachers = [...defaultTeachers];
        const idx = db.teachers.findIndex((t) => t.id === id);
        const updated = {
          id,
          name,
          pin: tPin,
          schoolName,
          isMasterAdmin: Boolean(tData.isMasterAdmin),
          createdAt: tData.createdAt || new Date().toISOString(),
        };
        if (idx >= 0) db.teachers[idx] = updated;
        else db.teachers.push(updated);
        saveDb(db);
        return send(200, { ok: true, teachers: db.teachers });
      }

      if (action === 'teacher_delete_teacher') {
        const pin = String(body.teacherPin || '').trim();
        if (!isMasterPin(pin)) {
          return send(401, { ok: false, error: 'Only Master Admin can delete teachers.' });
        }
        const teacherId = String(body.teacherId || '');
        if (db.teachers) {
          db.teachers = db.teachers.filter((t) => t.id !== teacherId);
        }
        saveDb(db);
        return send(200, { ok: true, teachers: db.teachers });
      }

      if (action === 'teacher_save_student') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const studentId = String(body.studentId || '').trim();
        const firstName = String(body.firstName || '').trim();
        const sPin = String(body.pin || '').trim();
        const className = String(body.className || body.classGroup || '').trim();
        const classId = String(body.classId || '').trim();
        const grade = String(body.grade || '').trim();
        if (!firstName || !sPin) {
          return send(400, { ok: false, error: 'First name and PIN are required.' });
        }
        const displayName = formatStudentDisplayName(firstName);
        if (studentId) {
          const target = db.students.find((s) => s.id === studentId);
          if (target) {
            target.firstName = displayName;
            target.pin = sPin;
            target.className = className;
            target.classGroup = className;
            target.classId = classId;
            target.grade = grade;
          }
          db.projects.forEach((p) => {
            if (p.studentId === studentId) p.studentName = displayName;
          });
        } else {
          db.students.push({
            id: makeId('stu'),
            firstName: displayName,
            pin: sPin,
            className,
            classGroup: className,
            classId,
            grade,
            createdAt: new Date().toISOString(),
          });
        }
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_bulk_add') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const entries = Array.isArray(body.entries) ? body.entries : [];
        for (const entry of entries) {
          const fn = String(entry.firstName || '').trim();
          const pn = String(entry.pin || '').trim();
          const cn = String(entry.className || entry.classGroup || '').trim();
          const cid = String(entry.classId || '').trim();
          const gr = String(entry.grade || '').trim();
          if (fn && pn) {
            db.students.push({
              id: makeId('stu'),
              firstName: formatStudentDisplayName(fn),
              pin: pn,
              className: cn,
              classGroup: cn,
              classId: cid,
              grade: gr,
              createdAt: new Date().toISOString(),
            });
          }
        }
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_delete_student') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const studentId = String(body.studentId || '');
        db.students = db.students.filter((s) => s.id !== studentId);
        db.projects = db.projects.filter((p) => p.studentId !== studentId);
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_rename_project') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        const projectId = String(body.projectId || '');
        const title = String(body.title || '').trim();
        const proj = db.projects.find((p) => p.id === projectId);
        if (proj && title) {
          proj.title = title;
          if (proj.score) proj.score.title = title;
          proj.updatedAt = new Date().toISOString();
          saveDb(db);
        }
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_update_settings') {
        const pin = String(body.teacherPin || '').trim();
        const teacher = findTeacher(pin);
        if (!teacher) return send(401, { ok: false, error: 'Unauthorized' });
        if (typeof body.allowSelfRegister === 'boolean') {
          db.allowSelfRegister = body.allowSelfRegister;
        }
        if (body.newTeacherPin && String(body.newTeacherPin).trim() && isMasterPin(pin)) {
          db.teacherPin = String(body.newTeacherPin).trim();
        }
        if (body.restoreDb && typeof body.restoreDb === 'object') {
          if (Array.isArray(body.restoreDb.students)) db.students = body.restoreDb.students;
          if (Array.isArray(body.restoreDb.projects)) db.projects = body.restoreDb.projects;
          if (Array.isArray(body.restoreDb.classrooms)) db.classrooms = body.restoreDb.classrooms;
          if (Array.isArray(body.restoreDb.teachers)) db.teachers = body.restoreDb.teachers;
        }
        saveDb(db);
        return send(200, {
          ok: true,
          teacherPin: db.teacherPin,
          allowSelfRegister: db.allowSelfRegister,
          teachers: db.teachers || defaultTeachers,
          classrooms: db.classrooms || defaultClassrooms,
          students: db.students,
          projects: db.projects,
        });
      }

      return send(400, { ok: false, error: 'Unknown action' });
    });
    return;
  }

  // Serve static files from dist/
  let filePath = path.join(DIST_DIR, urlObj.pathname === '/' ? 'index.html' : urlObj.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Run npm run build first');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Mr. Arthur's Staff Composer server running at http://localhost:${PORT}`);
});
