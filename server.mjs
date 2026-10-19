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

function loadDb() {
  const defaultDb = {
    teacherPin: '1234',
    allowSelfRegister: true,
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
      teacherPin: parsed.teacherPin || '1234',
      allowSelfRegister: parsed.allowSelfRegister ?? true,
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
          students: db.students.map((s) => ({
            id: s.id,
            firstName: s.firstName,
            className: s.className || '',
          })),
        });
      }

      if (action === 'student_login') {
        const firstName = String(body.firstName || '').trim();
        const pin = String(body.pin || '').trim();
        const className = String(body.className || '').trim();
        if (!firstName || !pin) {
          return send(400, { ok: false, error: 'Please enter your First Name, Last Initial, and PIN.' });
        }
        let matchedStudent = null;
        let nameMatchDiffPin = false;
        const normInput = normalizeStudentName(firstName);
        for (const s of db.students) {
          if (normalizeStudentName(s.firstName) === normInput) {
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
          if (db.allowSelfRegister) {
            const newStudent = {
              id: makeId('stu'),
              firstName,
              pin,
              className,
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
        }
        return send(200, {
          ok: true,
          student: {
            id: matchedStudent.id,
            firstName: matchedStudent.firstName,
            pin: matchedStudent.pin,
            className: matchedStudent.className || '',
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
        const { studentId, pin, teacherPin, projectId, score } = body;
        const title = String(body.title || '').trim();
        const isTeacher = Boolean(teacherPin && teacherPin === db.teacherPin);
        const student = db.students.find(
          (s) => s.id === studentId && (isTeacher || !pin || s.pin === pin)
        );
        if (!student || !score || !title) {
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
          db.projects[updatedIdx].score = score;
          db.projects[updatedIdx].updatedAt = now;
          savedProject = db.projects[updatedIdx];
        } else {
          savedProject = {
            id: makeId('proj'),
            studentId,
            studentName: student.firstName,
            title,
            score,
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

      if (action === 'teacher_login') {
        if (body.teacherPin !== db.teacherPin) {
          return send(401, { ok: false, error: 'Incorrect Teacher PIN / Password.' });
        }
        return send(200, {
          ok: true,
          allowSelfRegister: Boolean(db.allowSelfRegister),
          students: db.students,
          projects: db.projects,
        });
      }

      if (action === 'teacher_save_student') {
        if (body.teacherPin !== db.teacherPin) return send(401, { ok: false, error: 'Unauthorized' });
        const studentId = String(body.studentId || '').trim();
        const firstName = String(body.firstName || '').trim();
        const pin = String(body.pin || '').trim();
        const className = String(body.className || '').trim();
        if (!firstName || !pin) {
          return send(400, { ok: false, error: 'First name and PIN are required.' });
        }
        if (studentId) {
          const target = db.students.find((s) => s.id === studentId);
          if (target) {
            target.firstName = firstName;
            target.pin = pin;
            target.className = className;
          }
          db.projects.forEach((p) => {
            if (p.studentId === studentId) p.studentName = firstName;
          });
        } else {
          db.students.push({
            id: makeId('stu'),
            firstName,
            pin,
            className,
            createdAt: new Date().toISOString(),
          });
        }
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_bulk_add') {
        if (body.teacherPin !== db.teacherPin) return send(401, { ok: false, error: 'Unauthorized' });
        const entries = Array.isArray(body.entries) ? body.entries : [];
        for (const entry of entries) {
          const fn = String(entry.firstName || '').trim();
          const pn = String(entry.pin || '').trim();
          const cn = String(entry.className || '').trim();
          if (fn && pn) {
            db.students.push({
              id: makeId('stu'),
              firstName: fn,
              pin: pn,
              className: cn,
              createdAt: new Date().toISOString(),
            });
          }
        }
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_delete_student') {
        if (body.teacherPin !== db.teacherPin) return send(401, { ok: false, error: 'Unauthorized' });
        const studentId = String(body.studentId || '');
        db.students = db.students.filter((s) => s.id !== studentId);
        db.projects = db.projects.filter((p) => p.studentId !== studentId);
        saveDb(db);
        return send(200, { ok: true, students: db.students, projects: db.projects });
      }

      if (action === 'teacher_rename_project') {
        if (body.teacherPin !== db.teacherPin) return send(401, { ok: false, error: 'Unauthorized' });
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
        if (body.teacherPin !== db.teacherPin) return send(401, { ok: false, error: 'Unauthorized' });
        if (typeof body.allowSelfRegister === 'boolean') {
          db.allowSelfRegister = body.allowSelfRegister;
        }
        if (body.newTeacherPin && String(body.newTeacherPin).trim()) {
          db.teacherPin = String(body.newTeacherPin).trim();
        }
        if (body.restoreDb && typeof body.restoreDb === 'object') {
          if (Array.isArray(body.restoreDb.students)) db.students = body.restoreDb.students;
          if (Array.isArray(body.restoreDb.projects)) db.projects = body.restoreDb.projects;
        }
        saveDb(db);
        return send(200, {
          ok: true,
          teacherPin: db.teacherPin,
          allowSelfRegister: db.allowSelfRegister,
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
