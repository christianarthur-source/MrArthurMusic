import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

interface StudentRecord {
  id: string;
  firstName: string;
  pin: string;
  className?: string;
  createdAt: string;
}

interface ProjectRecord {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  score: any;
  appType?: string;
  projectData?: any;
  createdAt: string;
  updatedAt: string;
}

interface ClassroomDb {
  teacherPin: string;
  allowSelfRegister: boolean;
  students: StudentRecord[];
  projects: ProjectRecord[];
}

function getClassroomDbPath() {
  const dir = path.resolve(__dirname, 'classroom-data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'db.json');
}

function loadClassroomDb(): ClassroomDb {
  const dbPath = getClassroomDbPath();
  const defaultDb: ClassroomDb = {
    teacherPin: '1234',
    allowSelfRegister: true,
    students: [],
    projects: [],
  };
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2), 'utf-8');
    return defaultDb;
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(raw);
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

function saveClassroomDb(db: ClassroomDb) {
  const dbPath = getClassroomDbPath();
  const tmpPath = dbPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpPath, dbPath);
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36).slice(-3)}`;
}

function normalizeStudentName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .toLowerCase();
}

function classroomApiPlugin(): Plugin {
  return {
    name: 'classroom-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/classroom', (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', () => {
          let body: any = {};
          try {
            body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            body = {};
          }

          const urlObj = new URL(req.url || '', 'http://localhost');
          const action = urlObj.searchParams.get('action') || body.action || 'public_roster';
          const db = loadClassroomDb();

          const send = (status: number, payload: any) => {
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

            let matchedStudent: StudentRecord | null = null;
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
                const newStudent: StudentRecord = {
                  id: makeId('stu'),
                  firstName,
                  pin,
                  className,
                  createdAt: new Date().toISOString(),
                };
                db.students.push(newStudent);
                saveClassroomDb(db);
                matchedStudent = newStudent;
              } else {
                return send(404, {
                  ok: false,
                  error: 'Student name not found. Ask your teacher to add your name.',
                });
              }
            }

            const projects = db.projects.filter((p) => p.studentId === matchedStudent!.id);
            return send(200, {
              ok: true,
              student: {
                id: matchedStudent.id,
                firstName: matchedStudent.firstName,
                pin: matchedStudent.pin,
                className: matchedStudent.className || '',
              },
              projects,
            });
          }

          if (action === 'student_projects') {
            const { studentId, pin } = body;
            const found = db.students.find(
              (s) => s.id === studentId && (!pin || s.pin === pin)
            );
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
            saveClassroomDb(db);
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
              return send(400, {
                ok: false,
                error: 'Invalid student session or missing song title.',
              });
            }

            const now = new Date().toISOString();
            let updatedIdx = -1;
            if (projectId) {
              updatedIdx = db.projects.findIndex(
                (p) => p.id === projectId && p.studentId === studentId
              );
            }
            if (updatedIdx === -1) {
              updatedIdx = db.projects.findIndex(
                (p) =>
                  p.studentId === studentId &&
                  p.title.trim().toLowerCase() === title.toLowerCase()
              );
            }

            let savedProject: ProjectRecord;
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
            saveClassroomDb(db);
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
            saveClassroomDb(db);
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
            if (body.teacherPin !== db.teacherPin) {
              return send(401, { ok: false, error: 'Unauthorized' });
            }
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

            saveClassroomDb(db);
            return send(200, { ok: true, students: db.students, projects: db.projects });
          }

          if (action === 'teacher_bulk_add') {
            if (body.teacherPin !== db.teacherPin) {
              return send(401, { ok: false, error: 'Unauthorized' });
            }
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
            saveClassroomDb(db);
            return send(200, { ok: true, students: db.students, projects: db.projects });
          }

          if (action === 'teacher_delete_student') {
            if (body.teacherPin !== db.teacherPin) {
              return send(401, { ok: false, error: 'Unauthorized' });
            }
            const studentId = String(body.studentId || '');
            db.students = db.students.filter((s) => s.id !== studentId);
            db.projects = db.projects.filter((p) => p.studentId !== studentId);
            saveClassroomDb(db);
            return send(200, { ok: true, students: db.students, projects: db.projects });
          }

          if (action === 'teacher_rename_project') {
            if (body.teacherPin !== db.teacherPin) {
              return send(401, { ok: false, error: 'Unauthorized' });
            }
            const projectId = String(body.projectId || '');
            const title = String(body.title || '').trim();
            const proj = db.projects.find((p) => p.id === projectId);
            if (proj && title) {
              proj.title = title;
              if (proj.score) proj.score.title = title;
              proj.updatedAt = new Date().toISOString();
              saveClassroomDb(db);
            }
            return send(200, { ok: true, students: db.students, projects: db.projects });
          }

          if (action === 'teacher_update_settings') {
            if (body.teacherPin !== db.teacherPin) {
              return send(401, { ok: false, error: 'Unauthorized' });
            }
            if (typeof body.allowSelfRegister === 'boolean') {
              db.allowSelfRegister = body.allowSelfRegister;
            }
            if (body.newTeacherPin && String(body.newTeacherPin).trim()) {
              db.teacherPin = String(body.newTeacherPin).trim();
            }
            if (body.restoreDb && typeof body.restoreDb === 'object') {
              if (Array.isArray(body.restoreDb.students)) {
                db.students = body.restoreDb.students;
              }
              if (Array.isArray(body.restoreDb.projects)) {
                db.projects = body.restoreDb.projects;
              }
            }
            saveClassroomDb(db);
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
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), classroomApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('/rhythm-rockstars/')) {
              return 'rhythm-rockstars';
            }
            if (id.includes('/beat-machine/')) {
              return 'beat-machine';
            }
          },
        },
      },
    },
  };
});
