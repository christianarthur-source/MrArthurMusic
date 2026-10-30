import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  UserCheck,
  LogIn,
  LogOut,
  Shield,
  Music,
  Trash2,
  FolderOpen,
  Plus,
  Edit3,
  Check,
  Search,
  KeyRound,
  Users,
  Settings,
  Download,
  Upload,
  Sparkles,
  Printer,
  RefreshCw,
  ShieldCheck,
  FileText,
  GraduationCap,
  School,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Share2,
  BookOpen,
  Send,
  Eye,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { EdLawPrivacyModal } from './EdLawPrivacyModal';
import { Score } from '../types/music';
import {
  PublicStudentInfo,
  SavedProjectRecord,
  StudentRecord,
  StudentSession,
  MusicLabAppType,
  ClassroomRecord,
  TeacherRecord,
  STANDARD_GRADES,
  deleteStudentProject,
  fetchPublicRoster,
  fetchStudentProjects,
  loginStudent,
  loginTeacher,
  saveStudentProject,
  teacherBulkAddStudents,
  teacherDeleteStudent,
  teacherRenameProject,
  teacherSaveStudent,
  teacherUpdateSettings,
  teacherSaveClassroom,
  teacherDeleteClassroom,
  teacherSaveTeacher,
  teacherDeleteTeacher,
  teacherAssignProject,
  normalizeStudentName,
  formatStudentDisplayName,
  changeStudentPin,
  saveStudentSession,
} from '../utils/classroomApi';
import { createShortLink } from '../utils/shortLinkService';
import { containsProfanity } from '../utils/profanityFilter';

function safeFormatDate(dateVal: any, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString([], opts);
  } catch {
    return '';
  }
}

function safeFormatTime(dateVal: any, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], opts);
  } catch {
    return '';
  }
}

function getAppDescriptor(appType?: MusicLabAppType) {
  switch (appType) {
    case 'beat-machine':
      return {
        id: 'beat-machine' as const,
        name: 'Beat Machine',
        shortName: 'Beat Machine',
        emoji: '🥁',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        detail: 'Drum Groove & Synth',
        openColor: 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950',
      };
    case 'rhythm-rockstars':
      return {
        id: 'rhythm-rockstars' as const,
        name: 'Rhythm Rock Stars',
        shortName: 'Rock Stars',
        emoji: '🎸',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        detail: 'Rhythm Challenge',
        openColor: 'bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-400 hover:to-amber-400 text-slate-950',
      };
    case 'daw':
      return {
        id: 'daw' as const,
        name: 'Studio DAW',
        shortName: 'Studio DAW',
        emoji: '🎛️',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        detail: 'Multitrack Recording & Loops',
        openColor: 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white',
      };
    case 'staff-composer':
    default:
      return {
        id: 'staff-composer' as const,
        name: 'Staff Composer',
        shortName: 'Staff Composer',
        emoji: '🎼',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        detail: 'Sheet Music Score',
        openColor: 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950',
      };
  }
}

interface ClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentSession: StudentSession | null;
  onStudentLoginSuccess: (session: StudentSession, projects: SavedProjectRecord[]) => void;
  onStudentLogout: () => void;
  onStudentUpdateSession?: (session: StudentSession) => void;
  currentScore: Score;
  currentProjectId: string | null;
  onLoadProject: (
    project: SavedProjectRecord,
    asTeacher?: { teacherPin: string; studentName: string; studentId: string }
  ) => void;
  onStartNewSong: () => void;
  onManualSaveCurrentSong: (customTitle?: string, teacherOverride?: { teacherPin: string; teacherName: string; teacherId: string }) => Promise<void>;
  editingAsTeacher: { teacherPin: string; studentName: string; studentId: string } | null;
  onExitTeacherEditMode: () => void;
  openInTeacherMode?: boolean;
}

export const ClassroomModal: React.FC<ClassroomModalProps> = ({
  isOpen,
  onClose,
  studentSession,
  onStudentLoginSuccess,
  onStudentLogout,
  currentScore,
  currentProjectId,
  onLoadProject,
  onStartNewSong,
  onManualSaveCurrentSong,
  editingAsTeacher,
  onExitTeacherEditMode,
  openInTeacherMode = false,
  onStudentUpdateSession,
}) => {
  const [mode, setMode] = useState<'student' | 'teacher_auth' | 'teacher_portal'>('student');

  // Student 3-Step Guided Login: 'grade' -> 'classroom' -> 'login'
  const [studentStep, setStudentStep] = useState<'grade' | 'classroom' | 'login'>('grade');
  const [selectedGrade, setSelectedGrade] = useState<string>(() => {
    return localStorage.getItem('staff_composer_student_grade') || '';
  });
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return localStorage.getItem('staff_composer_student_class_id') || '';
  });

  // Public roster & classroom hierarchy for student selection
  const [roster, setRoster] = useState<PublicStudentInfo[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomRecord[]>([]);
  const [teachers, setTeachers] = useState<TeacherRecord[]>([]);
  const [isMasterAdmin, setIsMasterAdmin] = useState<boolean>(false);
  const [allowSelfCreate, setAllowSelfCreate] = useState<boolean>(true);
  const [firstNameInput, setFirstNameInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Logged-in student's saved projects
  const [studentProjects, setStudentProjects] = useState<SavedProjectRecord[]>([]);
  const [quickTitleInput, setQuickTitleInput] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Student change PIN state
  const [showChangePin, setShowChangePin] = useState<boolean>(false);
  const [newPinValue, setNewPinValue] = useState<string>('');
  const [pinChangeNotice, setPinChangeNotice] = useState<string | null>(null);
  const [pinChangeError, setPinChangeError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);

  // Teacher portal state
  const [teacherPinInput, setTeacherPinInput] = useState<string>('');
  const [activeTeacherPin, setActiveTeacherPin] = useState<string>('');
  // The account the server says this PIN belongs to (the master PIN signs in as "Mr. Arthur").
  const [signedInTeacher, setSignedInTeacher] = useState<TeacherRecord | null>(null);
  const [newTeacherPinField, setNewTeacherPinField] = useState<string>('');
  const [teacherTab, setTeacherTab] = useState<'students' | 'classrooms' | 'projects' | 'teachers' | 'settings'>('students');
  const [allStudents, setAllStudents] = useState<StudentRecord[]>([]);
  const [allProjects, setAllProjects] = useState<SavedProjectRecord[]>([]);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherNotice, setTeacherNotice] = useState<string | null>(null);

  // Teacher filters
  const [teacherGradeFilter, setTeacherGradeFilter] = useState<string>('ALL');
  const [teacherClassFilter, setTeacherClassFilter] = useState<string>('ALL');

  // Teacher - Add / Edit Student state
  const [newStuName, setNewStuName] = useState<string>('');
  const [newStuPin, setNewStuPin] = useState<string>('');
  const [newStuGrade, setNewStuGrade] = useState<string>('3rd Grade');
  const [newStuClassId, setNewStuClassId] = useState<string>('');
  const [newStuClass, setNewStuClass] = useState<string>('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStuName, setEditStuName] = useState<string>('');
  const [editStuPin, setEditStuPin] = useState<string>('');
  const [editStuGrade, setEditStuGrade] = useState<string>('');
  const [editStuClassId, setEditStuClassId] = useState<string>('');
  const [editStuClass, setEditStuClass] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [showBulkAdd, setShowBulkAdd] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');

  // Teacher - Classrooms Manager state
  const [showAddClassroom, setShowAddClassroom] = useState<boolean>(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classFormName, setClassFormName] = useState<string>('');
  const [classFormGrade, setClassFormGrade] = useState<string>('3rd Grade');
  const [classFormTeacher, setClassFormTeacher] = useState<string>('');
  const [classFormSelfRegister, setClassFormSelfRegister] = useState<boolean>(true);

  // Teacher - Teachers & Schools Manager state (Master Admin)
  const [showAddTeacher, setShowAddTeacher] = useState<boolean>(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherFormName, setTeacherFormName] = useState<string>('');
  const [teacherFormPin, setTeacherFormPin] = useState<string>('');
  const [teacherFormSchool, setTeacherFormSchool] = useState<string>('');
  const [teacherFormGrades, setTeacherFormGrades] = useState<string>('');

  // Student filter by app
  const [studentAppFilter, setStudentAppFilter] = useState<'ALL' | MusicLabAppType>('ALL');

  // Teacher - Projects filter & rename state
  const [projectSearch, setProjectSearch] = useState<string>('');
  const [projectStudentFilter, setProjectStudentFilter] = useState<string>('ALL');
  const [projectAppFilter, setProjectAppFilter] = useState<'ALL' | MusicLabAppType>('ALL');
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');

  // Teacher - Classrooms Drill-down View state
  const [selectedClassroomForView, setSelectedClassroomForView] = useState<ClassroomRecord | null>(null);

  // Teacher - Student Works Inspector Modal/Drawer state
  const [inspectedStudent, setInspectedStudent] = useState<StudentRecord | null>(null);

  // Teacher - Assignment Feature state
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);
  const [assignSourceProject, setAssignSourceProject] = useState<SavedProjectRecord | null>(null);
  const [assignInstructions, setAssignInstructions] = useState<string>('Add an ostinato pattern and 2 additional instruments to this composition!');
  const [assignTargetClassId, setAssignTargetClassId] = useState<string>('ALL');
  const [assignSelectedStudentIds, setAssignSelectedStudentIds] = useState<string[]>([]);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // Teacher - Quick Share Copied Feedback
  const [copiedShareLinkProjId, setCopiedShareLinkProjId] = useState<string | null>(null);

  // Refresh data when modal opens
  useEffect(() => {
    if (!isOpen) {
      setActiveTeacherPin('');
      return;
    }
    setLoginError(null);
    setTeacherError(null);
    setTeacherNotice(null);

    if (openInTeacherMode) {
      if (activeTeacherPin) {
        setMode('teacher_portal');
        return;
      }
      setTeacherPinInput('');
      setTeacherError(null);
      setTeacherNotice(null);
      setMode('teacher_auth');
      return;
    }

    if (editingAsTeacher && editingAsTeacher.teacherPin) {
      const pinToTry = editingAsTeacher.teacherPin;
      loginTeacher(pinToTry)
        .then((data) => {
          setActiveTeacherPin(pinToTry);
          setSignedInTeacher(data.currentTeacher ?? null);
          setAllStudents(data.students);
          setAllProjects(data.projects);
          setAllowSelfCreate(data.allowStudentSelfCreate);
          if (data.classrooms) setClassrooms(data.classrooms);
          if (data.teachers) setTeachers(data.teachers);
          setIsMasterAdmin(!!data.isMasterAdmin || pinToTry === '1138' || pinToTry === 'adminbaby');
          setMode('teacher_portal');
        })
        .catch(() => {
          setMode('teacher_auth');
        });
      return;
    }

    setMode('student');
    fetchPublicRoster()
      .then((data) => {
        setRoster(data.roster);
        setAllowSelfCreate(data.allowStudentSelfCreate);
        if (data.classrooms && data.classrooms.length > 0) {
          setClassrooms(data.classrooms);
          // If student already selected a valid classroom, start at login step
          const savedGrade = localStorage.getItem('staff_composer_student_grade') || '';
          const savedClassId = localStorage.getItem('staff_composer_student_class_id') || '';
          const matchedClass = data.classrooms.find((c) => c.id === savedClassId);
          if (matchedClass) {
            setSelectedGrade(matchedClass.grade);
            setSelectedClassId(matchedClass.id);
            setStudentStep('login');
          } else if (savedGrade && data.classrooms.some((c) => c.grade === savedGrade)) {
            setSelectedGrade(savedGrade);
            setStudentStep('classroom');
          } else {
            setStudentStep('grade');
          }
        } else {
          setStudentStep('login');
        }
      })
      .catch(() => {});

    if (studentSession) {
      fetchStudentProjects(studentSession)
        .then((projs) => setStudentProjects(projs))
        .catch(() => {});
    }
  }, [isOpen, studentSession, editingAsTeacher, openInTeacherMode]);

  // Derived grades from classrooms list, preserving standard educational order
  const availableGrades = useMemo(() => {
    if (!classrooms || classrooms.length === 0) return STANDARD_GRADES;
    const gradeSet = new Set(classrooms.map((c) => c.grade).filter(Boolean));
    const ordered = STANDARD_GRADES.filter((g) => gradeSet.has(g));
    gradeSet.forEach((g) => {
      if (!ordered.includes(g as any)) ordered.push(g as any);
    });
    return ordered.length > 0 ? ordered : STANDARD_GRADES;
  }, [classrooms]);

  // Derived classrooms for selected grade
  const classesInSelectedGrade = useMemo(() => {
    if (!selectedGrade) return classrooms;
    return classrooms.filter((c) => c.grade === selectedGrade);
  }, [classrooms, selectedGrade]);

  // Currently selected classroom object
  const selectedClassroom = useMemo(() => {
    return classrooms.find((c) => c.id === selectedClassId);
  }, [classrooms, selectedClassId]);

  // Students belonging to the currently selected classroom
  const studentsInSelectedClass = useMemo(() => {
    if (!selectedClassroom) return roster;
    return roster.filter((r) => {
      if (r.classId && r.classId === selectedClassroom.id) return true;
      if (r.classGroup && selectedClassroom.name && r.classGroup.toLowerCase() === selectedClassroom.name.toLowerCase()) return true;
      return false;
    });
  }, [roster, selectedClassroom]);

  const filteredRoster = useMemo(() => {
    const q = normalizeStudentName(firstNameInput);
    if (!q) return roster;
    return roster.filter(
      (r) =>
        normalizeStudentName(r.firstName).includes(q) ||
        (r.classGroup && r.classGroup.toLowerCase().includes(q))
    );
  }, [roster, firstNameInput]);

  if (!isOpen) return null;

  const isUntitledScore =
    !currentScore.title.trim() ||
    currentScore.title.trim().toLowerCase() === 'my composition' ||
    currentScore.title.trim().toLowerCase() === 'untitled';

  const handleStudentSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const cleanName = firstNameInput.trim().replace(/\s+/g, ' ');
    const cleanPin = pinInput.trim();

    if (!cleanName) {
      setLoginError('Please enter your First Name and Last Initial (e.g. Alex M or Alex M.)');
      return;
    }
    // Check for space between first name and last initial
    const parts = cleanName.split(' ');
    const isKnownRosterStudent = roster.some(
      (r) => normalizeStudentName(r.firstName) === normalizeStudentName(cleanName)
    );
    if (parts.length < 2 && !isKnownRosterStudent) {
      setLoginError('Please enter both your First Name and Last Initial separated by a space (e.g. Alex M or Alex M.)');
      return;
    }
    if (containsProfanity(cleanName)) {
      setLoginError('Please use a school-appropriate name.');
      return;
    }
    if (!cleanPin || cleanPin.length < 3) {
      setLoginError('Please enter your PIN.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginStudent({
        firstName: cleanName,
        pin: cleanPin,
        classId: selectedClassId || undefined,
        grade: selectedGrade || undefined,
        classGroup: selectedClassroom?.name || undefined,
      });
      setStudentProjects(res.projects);
      setPinInput('');
      onStudentLoginSuccess(res.student, res.projects);
    } catch (err: any) {
      setLoginError(err.message || 'Could not sign in. Please check your name and PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentSaveNow = async () => {
    if (!studentSession) return;
    setLoginError(null);

    let titleToSave = currentScore.title.trim();
    if (isUntitledScore) {
      if (!quickTitleInput.trim()) {
        setLoginError('Give your song a title above first so it can save to your account!');
        return;
      }
      if (containsProfanity(quickTitleInput.trim())) {
        setLoginError('Please choose a school-appropriate song title.');
        return;
      }
      titleToSave = quickTitleInput.trim();
    }

    setIsLoading(true);
    try {
      await onManualSaveCurrentSong(titleToSave);
      const updated = await fetchStudentProjects(studentSession);
      setStudentProjects(updated);
      setQuickTitleInput('');
      setSaveFeedback('Saved!');
      window.setTimeout(() => setSaveFeedback(null), 2500);
    } catch (err: any) {
      setLoginError(err.message || 'Could not save song.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStudentDeleteSong = async (project: SavedProjectRecord) => {
    if (!studentSession) return;
    if (!window.confirm(`Delete "${project.title}" from your saved songs?`)) return;
    try {
      await deleteStudentProject({
        projectId: project.id,
        studentId: studentSession.id,
        pin: studentSession.pin,
      });
      setStudentProjects((prev) => prev.filter((p) => p.id !== project.id));
    } catch (err: any) {
      setLoginError(err.message || 'Failed to delete song.');
    }
  };

  const handleStudentChangePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!studentSession) return;
    setPinChangeError(null);
    setPinChangeNotice(null);

    const cleanPin = newPinValue.trim().replace(/\s+/g, '');
    if (!cleanPin || cleanPin.length < 3) {
      setPinChangeError('PIN must be at least 3 digits.');
      return;
    }
    if (cleanPin === studentSession.pin) {
      setPinChangeError('New PIN must be different from your current PIN.');
      return;
    }

    setIsChangingPin(true);
    try {
      const updatedPin = await changeStudentPin({
        studentId: studentSession.id,
        currentPin: studentSession.pin || '',
        newPin: cleanPin,
      });

      const updatedSession: StudentSession = {
        ...studentSession,
        pin: updatedPin || cleanPin,
      };

      saveStudentSession(updatedSession);
      onStudentUpdateSession?.(updatedSession);

      setPinChangeNotice('PIN successfully updated!');
      setNewPinValue('');
      window.setTimeout(() => {
        setPinChangeNotice(null);
        setShowChangePin(false);
      }, 1800);
    } catch (err: any) {
      setPinChangeError(err.message || 'Failed to update PIN. Please try again.');
    } finally {
      setIsChangingPin(false);
    }
  };

  // Teacher Auth
  const handleTeacherUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    setIsLoading(true);
    const pin = teacherPinInput.trim();
    try {
      const data = await loginTeacher(pin);
      setActiveTeacherPin(pin);
      setSignedInTeacher(data.currentTeacher ?? null);
      setAllStudents(data.students);
      setAllProjects(data.projects);
      setAllowSelfCreate(data.allowStudentSelfCreate);
      if (data.classrooms) setClassrooms(data.classrooms);
      if (data.teachers) setTeachers(data.teachers);
      setIsMasterAdmin(!!data.isMasterAdmin || pin === '1138' || pin === 'adminbaby');
      setTeacherPinInput('');
      setMode('teacher_portal');
    } catch (err: any) {
      setTeacherError(err.message || 'Incorrect Teacher PIN.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    const fn = formatStudentDisplayName(newStuName.trim());
    const pin = newStuPin.trim();
    const targetClass = classrooms.find((c) => c.id === newStuClassId);
    const cg = targetClass?.name || newStuClass.trim();
    const gr = targetClass?.grade || newStuGrade || '';

    if (!fn || !pin) {
      setTeacherError('Student first name and PIN are required.');
      return;
    }
    if (containsProfanity(fn) || containsProfanity(cg)) {
      setTeacherError('Please use school-appropriate student and class names.');
      return;
    }
    try {
      const res = await teacherSaveStudent({
        teacherPin: activeTeacherPin,
        firstName: fn,
        pin,
        classGroup: cg,
        classId: newStuClassId || targetClass?.id || '',
        grade: gr,
      });
      setAllStudents(res.students);
      setAllProjects(res.projects);
      setNewStuName('');
      setNewStuPin('');
      setTeacherNotice(`Added ${fn} (PIN: ${pin})`);
      window.setTimeout(() => setTeacherNotice(null), 3000);
    } catch (err: any) {
      setTeacherError(err.message || 'Could not add student.');
    }
  };

  const handleSaveEditedStudent = async (studentId: string) => {
    setTeacherError(null);
    const fn = formatStudentDisplayName(editStuName.trim());
    const pin = editStuPin.trim();
    const targetClass = classrooms.find((c) => c.id === editStuClassId);
    const cg = targetClass?.name || editStuClass.trim();
    const gr = targetClass?.grade || editStuGrade || '';

    if (!fn || !pin) {
      setTeacherError('Name and PIN cannot be empty.');
      return;
    }
    if (containsProfanity(fn) || containsProfanity(cg)) {
      setTeacherError('Please use school-appropriate names.');
      return;
    }
    try {
      const res = await teacherSaveStudent({
        teacherPin: activeTeacherPin,
        id: studentId,
        firstName: fn,
        pin,
        classGroup: cg,
        classId: editStuClassId || targetClass?.id || '',
        grade: gr,
      });
      setAllStudents(res.students);
      setAllProjects(res.projects);
      setEditingStudentId(null);
      setTeacherNotice('Updated student account.');
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Could not update student.');
    }
  };

  const handleDeleteStudent = async (stu: StudentRecord) => {
    const stuProjCount = allProjects.filter((p) => p.studentId === stu.id).length;
    const msg =
      stuProjCount > 0
        ? `Remove ${stu.firstName} and also delete their ${stuProjCount} saved song(s)?`
        : `Remove ${stu.firstName} from the class roster?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await teacherDeleteStudent({
        teacherPin: activeTeacherPin,
        studentId: stu.id,
        deleteProjects: true,
      });
      setAllStudents(res.students);
      setAllProjects(res.projects);
    } catch (err: any) {
      setTeacherError(err.message || 'Could not delete student.');
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const targetClass = classrooms.find((c) => c.id === newStuClassId);

    const entries = lines.map((line) => {
      const parts = line.split(/[,\t]+/).map((p) => p.trim());
      const rawName = parts[0] || '';
      return {
        firstName: formatStudentDisplayName(rawName),
        pin: parts[1] || String(Math.floor(1000 + Math.random() * 9000)),
        classGroup: parts[2] || targetClass?.name || newStuClass.trim() || '',
        classId: targetClass?.id || newStuClassId || '',
        grade: targetClass?.grade || newStuGrade || '',
      };
    });

    for (const entry of entries) {
      if (containsProfanity(entry.firstName) || containsProfanity(entry.classGroup)) {
        setTeacherError(`Roster list contains inappropriate language ("${entry.firstName}"). Please fix before importing.`);
        return;
      }
    }

    try {
      const updated = await teacherBulkAddStudents({
        teacherPin: activeTeacherPin,
        entries,
      });
      setAllStudents(updated);
      setBulkText('');
      setShowBulkAdd(false);
      setTeacherNotice(`Imported ${entries.length} students!`);
      window.setTimeout(() => setTeacherNotice(null), 3000);
    } catch (err: any) {
      setTeacherError(err.message || 'Bulk import failed.');
    }
  };

  // Classroom Management Handlers
  const handleSaveClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    if (!classFormName.trim()) {
      setTeacherError('Classroom name is required.');
      return;
    }
    try {
      const res = await teacherSaveClassroom({
        teacherPin: activeTeacherPin,
        classroom: {
          id: editingClassId || undefined,
          name: classFormName.trim(),
          grade: classFormGrade,
          teacherName: classFormTeacher.trim(),
          allowSelfRegister: classFormSelfRegister,
        },
      });
      setClassrooms(res);
      setEditingClassId(null);
      setClassFormName('');
      setClassFormTeacher('');
      setShowAddClassroom(false);
      setTeacherNotice(editingClassId ? 'Classroom updated!' : 'Classroom created!');
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Failed to save classroom.');
    }
  };

  const handleDeleteClassroom = async (cls: ClassroomRecord) => {
    const count = allStudents.filter((s) => s.classId === cls.id || s.classGroup === cls.name).length;
    if (!window.confirm(`Delete classroom "${cls.name}"? ${count > 0 ? `(${count} students currently assigned)` : ''}`)) return;
    try {
      const res = await teacherDeleteClassroom({
        teacherPin: activeTeacherPin,
        classroomId: cls.id,
      });
      setClassrooms(res);
      setTeacherNotice(`Deleted classroom "${cls.name}".`);
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Failed to delete classroom.');
    }
  };

  // Teacher Account Management Handlers (Master Admin Only)
  const handleSaveTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError(null);
    if (!teacherFormName.trim() || !teacherFormPin.trim()) {
      setTeacherError('Teacher name and PIN are required.');
      return;
    }
    try {
      const res = await teacherSaveTeacher({
        teacherPin: activeTeacherPin,
        teacher: {
          id: editingTeacherId || undefined,
          name: teacherFormName.trim(),
          pin: teacherFormPin.trim(),
          schoolName: teacherFormSchool.trim(),
          gradeRange: teacherFormGrades.trim(),
        },
      });
      setTeachers(res);
      setEditingTeacherId(null);
      setTeacherFormName('');
      setTeacherFormPin('');
      setTeacherFormSchool('');
      setTeacherFormGrades('');
      setShowAddTeacher(false);
      setTeacherNotice(editingTeacherId ? 'Teacher account updated!' : 'Teacher account created!');
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Failed to save teacher.');
    }
  };

  const handleDeleteTeacher = async (t: TeacherRecord) => {
    if (t.isMasterAdmin || t.pin === '1138' || t.pin === 'adminbaby') {
      setTeacherError('Master Admin account cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete teacher account for "${t.name}"?`)) return;
    try {
      const res = await teacherDeleteTeacher({
        teacherPin: activeTeacherPin,
        teacherId: t.id,
      });
      setTeachers(res);
      setTeacherNotice(`Deleted teacher account for "${t.name}".`);
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Failed to delete teacher.');
    }
  };

  const handlePrintLoginCards = () => {
    const win = window.open('', '_blank', 'width=800,height=650');
    if (!win) return;

    const studentsToPrint = allStudents
      .filter((s) => {
        if (teacherGradeFilter !== 'ALL' && s.grade && s.grade !== teacherGradeFilter) {
          return false;
        }
        if (teacherClassFilter !== 'ALL' && s.classId && s.classId !== teacherClassFilter) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const gradeDiff = (a.grade || '').localeCompare(b.grade || '');
        if (gradeDiff !== 0) return gradeDiff;
        const classDiff = (a.classGroup || '').localeCompare(b.classGroup || '');
        if (classDiff !== 0) return classDiff;
        return a.firstName.localeCompare(b.firstName);
      });

    const cardsHtml = studentsToPrint
      .map(
        (s) => `
        <div class="card">
          <div class="app">🎵 Mr. Arthur's Music Lab</div>
          <div class="name">${s.firstName}</div>
          <div class="group">${s.grade ? `<strong>${s.grade}</strong> • ` : ''}${s.classGroup || 'General Music'}</div>
          <div class="pin">PIN: <strong>${s.pin}</strong></div>
        </div>`
      )
      .join('');

    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Student Login Cards - Mr. Arthur's Music Lab</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 20px; color: #0f172a; }
            h2 { margin-top: 0; font-size: 20px; }
            .meta { font-size: 13px; color: #64748b; margin-bottom: 16px; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
            .card { border: 2px dashed #94a3b8; border-radius: 12px; padding: 14px; text-align: center; page-break-inside: avoid; background: #fafafa; }
            .app { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 4px; }
            .name { font-size: 22px; font-weight: 800; margin: 4px 0; color: #0284c7; }
            .group { font-size: 12px; color: #475569; margin-bottom: 6px; }
            .pin { font-size: 15px; background: #e2e8f0; border-radius: 6px; padding: 4px 10px; display: inline-block; margin-top: 4px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h2>Student Login Cards (${studentsToPrint.length} Students)</h2>
          <div class="meta">Print and cut out individual cards for students. Students type their First Name &amp; Last Initial (periods optional) and PIN.</div>
          <div class="grid">${cardsHtml}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleTeacherRenameSong = async (projectId: string) => {
    const cleanRename = renameTitleInput.trim();
    if (!cleanRename) return;
    if (containsProfanity(cleanRename)) {
      setTeacherError('Please choose a school-appropriate song title.');
      return;
    }
    try {
      const updated = await teacherRenameProject({
        teacherPin: activeTeacherPin,
        projectId,
        newTitle: cleanRename,
      });
      setAllProjects(updated);
      setRenamingProjectId(null);
      setTeacherNotice('Renamed song.');
      window.setTimeout(() => setTeacherNotice(null), 2500);
    } catch (err: any) {
      setTeacherError(err.message || 'Could not rename project.');
    }
  };

  const handleTeacherDeleteSong = async (proj: SavedProjectRecord) => {
    if (!window.confirm(`Delete "${proj.title}" by ${proj.studentName}?`)) return;
    try {
      await deleteStudentProject({
        projectId: proj.id,
        isTeacher: true,
        teacherPin: activeTeacherPin,
      });
      setAllProjects((prev) => prev.filter((p) => p.id !== proj.id));
    } catch (err: any) {
      setTeacherError(err.message || 'Could not delete project.');
    }
  };

  // Quick Share Song link generator for Teacher/Admin
  const handleTeacherShareProject = async (proj: SavedProjectRecord) => {
    try {
      let shareUrl = '';
      if (proj.appType === 'beat-machine') {
        const payload = proj.projectData || { title: proj.title };
        const res = await createShortLink('beat-machine', proj.title, payload);
        shareUrl = res.shortUrl;
      } else if (proj.appType === 'daw') {
        const payload = proj.projectData || { title: proj.title };
        const res = await createShortLink('daw', proj.title, payload);
        shareUrl = res.shortUrl;
      } else {
        const shareData = {
          score: proj.score,
          title: proj.title,
        };
        const res = await createShortLink('staff-composer', proj.title, shareData);
        shareUrl = res.shortUrl;
      }

      if (shareUrl) {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShareLinkProjId(proj.id);
        setTeacherNotice(`Copied public share link for "${proj.title}" to clipboard!`);
        window.setTimeout(() => {
          setCopiedShareLinkProjId(null);
          setTeacherNotice(null);
        }, 3000);
      }
    } catch {
      setTeacherError('Could not create share link.');
    }
  };

  // Open Assignment Modal with chosen source project (or current active song)
  const handleOpenAssignModal = (sourceProj?: SavedProjectRecord) => {
    const projToAssign: SavedProjectRecord = sourceProj || {
      id: currentProjectId || 'current_active',
      studentId: 'teacher_master',
      studentName: 'Mr. Arthur',
      title: currentScore.title.trim() && !isUntitledScore ? currentScore.title.trim() : 'Class Melody Assignment',
      score: currentScore,
      appType: 'staff-composer',
      updatedAt: new Date().toISOString(),
    };

    setAssignSourceProject(projToAssign);
    setAssignInstructions('Add an ostinato pattern and 2 additional instruments to complete this song!');

    // Default target: if teacher has a selected classroom, pre-select it
    if (selectedClassroomForView) {
      setAssignTargetClassId(selectedClassroomForView.id);
      const studentIdsInClass = allStudents
        .filter((s) => s.classId === selectedClassroomForView.id || s.classGroup === selectedClassroomForView.name)
        .map((s) => s.id);
      setAssignSelectedStudentIds(studentIdsInClass);
    } else {
      setAssignTargetClassId('ALL');
      setAssignSelectedStudentIds(allStudents.map((s) => s.id));
    }

    setShowAssignModal(true);
  };

  // Execute assignment dispatch to student accounts
  const handleExecuteAssignment = async () => {
    if (!assignSourceProject) return;
    if (assignSelectedStudentIds.length === 0) {
      setTeacherError('Please select at least one student or classroom to receive this assignment.');
      return;
    }

    setIsAssigning(true);
    setTeacherError(null);
    try {
      const res = await teacherAssignProject({
        teacherPin: activeTeacherPin,
        sourceProject: assignSourceProject,
        targetStudentIds: assignSelectedStudentIds,
        instructions: assignInstructions,
      });

      if (res.projects && res.projects.length > 0) {
        setAllProjects(res.projects);
      } else {
        // Refresh overview
        const refreshed = await loginTeacher(activeTeacherPin);
        setAllProjects(refreshed.projects);
        setAllStudents(refreshed.students);
      }

      setShowAssignModal(false);
      setTeacherNotice(
        `Assigned "${assignSourceProject.title}" to ${res.assignedCount || assignSelectedStudentIds.length} students! Each student can now load and edit their own copy.`
      );
      window.setTimeout(() => setTeacherNotice(null), 4500);
    } catch (err: any) {
      setTeacherError(err.message || 'Failed to dispatch assignment.');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleExportClassroomBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      allowStudentSelfCreate: allowSelfCreate,
      classrooms,
      teachers,
      students: allStudents,
      projects: allProjects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClassroomBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!Array.isArray(parsed.students) || !Array.isArray(parsed.projects)) {
          setTeacherError('Invalid backup file format.');
          return;
        }
        const data = await teacherUpdateSettings({
          teacherPin: activeTeacherPin,
          importDb: {
            students: parsed.students,
            projects: parsed.projects,
            classrooms: parsed.classrooms,
            teachers: parsed.teachers,
          },
        });
        setAllStudents(data.students);
        setAllProjects(data.projects);
        if (data.classrooms) setClassrooms(data.classrooms);
        if (data.teachers) setTeachers(data.teachers);
        setTeacherNotice(
          `Restored ${data.students.length} students, ${data.projects.length} projects, and classrooms!`
        );
        window.setTimeout(() => setTeacherNotice(null), 3500);
      } catch {
        setTeacherError('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredStudentsList = allStudents.filter((s) => {
    if (teacherGradeFilter !== 'ALL' && s.grade && s.grade !== teacherGradeFilter) {
      return false;
    }
    if (teacherClassFilter !== 'ALL' && s.classId && s.classId !== teacherClassFilter) {
      return false;
    }
    const q = studentSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      s.firstName.toLowerCase().includes(q) ||
      (s.classGroup && s.classGroup.toLowerCase().includes(q)) ||
      (s.grade && s.grade.toLowerCase().includes(q)) ||
      s.pin.includes(q)
    );
  });

  const filteredProjectsList = allProjects.filter((p) => {
    if (projectStudentFilter !== 'ALL') {
      const matchedTch = teachers.find((t) => t.id === projectStudentFilter);
      if (matchedTch) {
        const isMaster = matchedTch.isMasterAdmin || matchedTch.pin === '1138' || matchedTch.pin === 'adminbaby';
        const tchNameLower = (matchedTch.name || '').toLowerCase();
        const projStudentNameLower = (p.studentName || '').toLowerCase();
        const matchesThisTeacher =
          p.studentId === matchedTch.id ||
          (isMaster && (p.studentId === 'teach_master' || p.studentId === 'teacher_master')) ||
          (tchNameLower && projStudentNameLower === tchNameLower);
        if (!matchesThisTeacher) return false;
      } else if (p.studentId !== projectStudentFilter) {
        return false;
      }
    }
    if (projectAppFilter !== 'ALL' && (p.appType || 'staff-composer') !== projectAppFilter) {
      return false;
    }
    const q = projectSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (p.title || '').toLowerCase().includes(q) ||
      (p.studentName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {mode === 'teacher_portal' || mode === 'teacher_auth' ? (
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                <Shield className="w-4 h-4" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
                <UserCheck className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold leading-tight">
                {mode === 'teacher_portal'
                  ? "Mr. Arthur's Teacher Admin Portal"
                  : mode === 'teacher_auth'
                  ? 'Teacher Admin Sign In'
                  : studentSession
                  ? `${studentSession.firstName}'s Saved Songs`
                  : 'Student Sign In'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {mode === 'teacher_portal'
                  ? 'Manage student names, PINs, and saved compositions'
                  : mode === 'teacher_auth'
                  ? 'Enter your Teacher PIN to manage students & projects'
                  : studentSession
                  ? 'Songs with a title save automatically to your account'
                  : 'Sign in with your First Name, Last Initial, and PIN — no email needed'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode !== 'student' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTeacherPin('');
                  setMode('student');
                }}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                ← Student View
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* 1. STUDENT SIGN-IN VIEW (Logged Out) */}
          {mode === 'student' && !studentSession && (
            <div className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">
                  {loginError}
                </div>
              )}

              {/* STEP 1: CHOOSE GRADE */}
              {studentStep === 'grade' && classrooms.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-sky-400" />
                        <span>Step 1: What Grade Are You In?</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Choose your grade level to find your music class
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentStep('login')}
                      className="text-[11px] text-slate-400 hover:text-sky-300 underline cursor-pointer"
                    >
                      Skip to All Classes →
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {availableGrades.map((grade) => {
                      const count = classrooms.filter((c) => c.grade === grade).length;
                      return (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => {
                            setSelectedGrade(grade);
                            localStorage.setItem('staff_composer_student_grade', grade);
                            setStudentStep('classroom');
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            selectedGrade === grade
                              ? 'bg-sky-500/20 border-sky-400 text-white shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xl">🎓</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-sky-300 border border-slate-700">
                              {count} {count === 1 ? 'class' : 'classes'}
                            </span>
                          </div>
                          <div className="font-bold text-sm text-white">{grade}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: CHOOSE CLASSROOM */}
              {studentStep === 'classroom' && classrooms.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <School className="w-4 h-4 text-amber-400" />
                        <span>Step 2: Choose Your Teacher / Classroom</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Teachers in <strong>{selectedGrade || 'your grade'}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStudentStep('grade')}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Change Grade</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {classesInSelectedGrade.map((cls) => {
                      const stuCount = roster.filter(
                        (r) => r.classId === cls.id || (cls.name && r.classGroup === cls.name)
                      ).length;
                      const isSelected = selectedClassId === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => {
                            setSelectedClassId(cls.id);
                            localStorage.setItem('staff_composer_student_class_id', cls.id);
                            setStudentStep('login');
                          }}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-white shadow-md'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 text-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-sm text-white">{cls.name}</div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                              {stuCount} {stuCount === 1 ? 'student' : 'students'}
                            </span>
                          </div>
                          {cls.teacherName && cls.teacherName.toLowerCase() !== cls.name.toLowerCase() && (
                            <div className="text-xs text-slate-400">
                              Teacher: <span className="text-slate-300 font-semibold">{cls.teacherName}</span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {classesInSelectedGrade.length === 0 && (
                      <div className="col-span-2 p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                        No classrooms found for {selectedGrade}.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: NAME & PIN (LOGIN / SELF-REGISTER) */}
              {(studentStep === 'login' || classrooms.length === 0) && (
                <form onSubmit={handleStudentSignIn} className="space-y-4">
                  {/* Selected Grade & Classroom Breadcrumb */}
                  {classrooms.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                          🎓 {selectedGrade || 'Grade'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          🏫 {selectedClassroom?.name || 'Classroom'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStudentStep('grade')}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                      >
                        Change Class ↻
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* First Name & Last Initial Input + Quick Roster Picker */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        1. First Name &amp; Last Initial (e.g. Alex M.)
                      </label>
                      <input
                        type="text"
                        value={firstNameInput}
                        onChange={(e) => setFirstNameInput(e.target.value)}
                        placeholder="e.g. Alex M or Alex M."
                        autoFocus
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:outline-hidden text-sm font-semibold text-white"
                      />
                      <p className="text-[11px] text-slate-400">
                        💡 Period is optional — <strong>Alex M</strong> and <strong>Alex M.</strong> sign into the exact same account!
                      </p>

                      {/* Quick Roster Picker for selected class */}
                      {studentsInSelectedClass.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] text-slate-400 font-semibold">
                            Tap your name from the roster:
                          </span>
                          <div className="max-h-36 overflow-y-auto flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            {studentsInSelectedClass
                              .filter((stu) => {
                                const q = normalizeStudentName(firstNameInput);
                                if (!q) return true;
                                return normalizeStudentName(stu.firstName).includes(q);
                              })
                              .map((stu) => {
                                const selected =
                                  normalizeStudentName(firstNameInput) ===
                                  normalizeStudentName(stu.firstName);
                                return (
                                  <button
                                    key={stu.id}
                                    type="button"
                                    onClick={() => setFirstNameInput(stu.firstName)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                      selected
                                        ? 'bg-sky-500 text-slate-950 shadow-xs'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    }`}
                                  >
                                    {stu.firstName}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Self registration feedback badge */}
                      {firstNameInput.trim() &&
                        !studentsInSelectedClass.some(
                          (r) => normalizeStudentName(r.firstName) === normalizeStudentName(firstNameInput)
                        ) &&
                        selectedClassroom?.allowSelfRegister !== false &&
                        allowSelfCreate && (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[11px] text-emerald-300 font-semibold">
                            ✓ New student "{formatStudentDisplayName(firstNameInput.trim())}" joining {selectedClassroom?.name || 'Class'} — enter a 4-digit PIN to create your account!
                          </div>
                        )}
                    </div>

                    {/* 4-Digit PIN Input + Keypad */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                        2. Secret PIN
                      </label>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={8}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\s+/g, ''))}
                        placeholder="Enter 4-digit PIN..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-400 focus:outline-hidden text-center tracking-[0.35em] text-lg font-black text-amber-300"
                      />

                      {/* Compact Number Pad for Touchscreens / Chromebooks */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', '⌫'].map(
                          (key) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                if (key === 'Clear') setPinInput('');
                                else if (key === '⌫') setPinInput((p) => p.slice(0, -1));
                                else if (pinInput.length < 8) setPinInput((p) => p + key);
                              }}
                              className="py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-xs font-bold text-slate-200 border border-slate-700/60 cursor-pointer"
                            >
                              {key}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsPrivacyModalOpen(true)}
                      className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-300 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>NY Ed Law § 2-d &amp; Student Privacy</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm shadow-lg cursor-pointer disabled:opacity-50"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 2. LOGGED-IN STUDENT VIEW ("My Songs") */}
          {mode === 'student' && studentSession && (
            <div className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">
                  {loginError}
                </div>
              )}

              {/* Current Song Auto-Save Status Box */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span className="text-xs font-bold text-slate-200">
                      Current Song on Staff:{' '}
                      <span className="text-sky-300">{currentScore.title || 'Untitled'}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isUntitledScore
                      ? 'Give your song a title below (or in the top bar) and it will save automatically!'
                      : '✓ Auto-Save is active for this titled song.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isUntitledScore && (
                    <input
                      type="text"
                      value={quickTitleInput}
                      onChange={(e) => setQuickTitleInput(e.target.value)}
                      placeholder="Enter a Song Title..."
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:border-sky-400 focus:outline-hidden"
                    />
                  )}
                  <button
                    type="button"
                    onClick={handleStudentSaveNow}
                    disabled={isLoading}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm cursor-pointer"
                  >
                    {saveFeedback || 'Save Song Now'}
                  </button>
                </div>
              </div>

              {/* Saved Songs List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    My Saved Songs ({studentProjects.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onStartNewSong();
                      onClose();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Start New Blank Song</span>
                  </button>
                </div>

                {/* Filter by App Pill Buttons */}
                {studentProjects.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {(
                      [
                        { id: 'ALL', label: `All (${studentProjects.length})`, emoji: '🎵' },
                        {
                          id: 'staff-composer',
                          label: `Staff Composer (${
                            studentProjects.filter((p) => !p.appType || p.appType === 'staff-composer')
                              .length
                          })`,
                          emoji: '🎼',
                        },
                        {
                          id: 'beat-machine',
                          label: `Beat Machine (${
                            studentProjects.filter((p) => p.appType === 'beat-machine').length
                          })`,
                          emoji: '🥁',
                        },
                        {
                          id: 'rhythm-rockstars',
                          label: `Rock Stars (${
                            studentProjects.filter((p) => p.appType === 'rhythm-rockstars').length
                          })`,
                          emoji: '🎸',
                        },
                        {
                          id: 'daw',
                          label: `Studio DAW (${
                            studentProjects.filter((p) => p.appType === 'daw').length
                          })`,
                          emoji: '🎛️',
                        },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStudentAppFilter(f.id)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                          studentAppFilter === f.id
                            ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-xs'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <span>{f.emoji}</span>
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {studentProjects.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-1">
                    <Music className="w-6 h-6 text-slate-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-300">
                      No saved songs yet!
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Create a song in Staff Composer or Beat Machine and click &quot;Save&quot; to keep it here!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {studentProjects
                      .filter((p) => studentAppFilter === 'ALL' || (p.appType || 'staff-composer') === studentAppFilter)
                      .map((proj) => {
                        const isCurrent = proj.id === currentProjectId;
                        const appMeta = getAppDescriptor(proj.appType);

                        return (
                          <div
                            key={proj.id}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                              isCurrent
                                ? 'bg-sky-500/15 border-sky-400/60'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-white truncate">
                                  {proj.title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 font-['Fredoka',sans-serif] ${appMeta.badgeClass}`}
                                  title={`Made in ${appMeta.name}`}
                                >
                                  <span>{appMeta.emoji}</span>
                                  <span>{appMeta.name}</span>
                                </span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/30 text-sky-200">
                                    Open Now
                                  </span>
                                )}
                                {proj.isAssignment && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                                    <BookOpen className="w-2.5 h-2.5 text-purple-300" />
                                    <span>Class Assignment</span>
                                  </span>
                                )}
                              </div>
                              {proj.assignmentInstructions && (
                                <div className="mt-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-[11px] text-purple-200 flex items-start gap-1.5">
                                  <span className="font-bold shrink-0">📝 Task:</span>
                                  <span>{proj.assignmentInstructions}</span>
                                </div>
                              )}
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span>
                                  Saved{' '}
                                  {safeFormatDate(proj.updatedAt)}{' '}
                                  at{' '}
                                  {safeFormatTime(proj.updatedAt)}
                                </span>
                                <span>•</span>
                                {proj.appType === 'beat-machine' ? (
                                  <span>
                                    🥁 {proj.projectData?.measures || 1} bar(s) • {proj.projectData?.bpm || 115} BPM
                                  </span>
                                ) : (
                                  <span>
                                    🎼 {proj.score?.tracks?.length || 1} track(s) • {proj.score?.tempo || 108} BPM
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onLoadProject(proj);
                                  onClose();
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer shadow-sm transition-all hover:scale-102 active:scale-98 font-['Fredoka',sans-serif] ${appMeta.openColor}`}
                                title={`Open in ${appMeta.name}`}
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Open in {appMeta.shortName}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStudentDeleteSong(proj)}
                                title="Delete song"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Student Change PIN Box */}
              {showChangePin && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-amber-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                      <KeyRound className="w-4 h-4" />
                      <span>Change Your Secret PIN</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowChangePin(false);
                        setPinChangeError(null);
                        setPinChangeNotice(null);
                        setNewPinValue('');
                      }}
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {pinChangeError && (
                    <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-medium">
                      {pinChangeError}
                    </div>
                  )}

                  {pinChangeNotice && (
                    <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium">
                      {pinChangeNotice}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={8}
                      value={newPinValue}
                      onChange={(e) => setNewPinValue(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Enter new 4-digit PIN..."
                      className="w-full sm:w-52 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-hidden text-center tracking-widest text-sm font-bold text-amber-300"
                    />

                    {/* Compact Controls */}
                    <div className="flex items-center gap-1">
                      {['Clear', '⌫'].map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            if (key === 'Clear') setNewPinValue('');
                            else if (key === '⌫') setNewPinValue((p) => p.slice(0, -1));
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 cursor-pointer"
                        >
                          {key}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStudentChangePin()}
                      disabled={isChangingPin || !newPinValue}
                      className="w-full sm:w-auto px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-sm cursor-pointer ml-auto"
                    >
                      {isChangingPin ? 'Saving...' : 'Save New PIN'}
                    </button>
                  </div>
                </div>
              )}

              {/* Footer with Change PIN and Logout */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePin((prev) => !prev);
                    setPinChangeError(null);
                    setPinChangeNotice(null);
                    setNewPinValue('');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold border border-slate-700/80 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{showChangePin ? 'Hide PIN Box' : 'Change My PIN'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onStudentLogout();
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 text-xs font-bold border border-slate-700 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out ({studentSession.firstName})</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. TEACHER AUTH VIEW */}
          {mode === 'teacher_auth' && (
            <form onSubmit={handleTeacherUnlock} className="max-w-sm mx-auto py-4 space-y-4">
              {teacherError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-medium">
                  {teacherError}
                </div>
              )}

              <div className="space-y-2 text-center">
                <KeyRound className="w-8 h-8 text-amber-300 mx-auto" />
                <label className="block text-sm font-bold text-white">
                  Enter Admin PIN
                </label>
                <input
                  type="password"
                  value={teacherPinInput}
                  onChange={(e) => setTeacherPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-amber-400 focus:outline-hidden text-center text-lg font-black tracking-widest text-amber-300"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-lg cursor-pointer"
              >
                {isLoading ? 'Unlocking...' : 'Unlock Admin Portal'}
              </button>
            </form>
          )}

          {/* 4. TEACHER ADMIN PORTAL VIEW */}
          {mode === 'teacher_portal' && (
            <div className="space-y-4">
              {editingAsTeacher && (
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-between text-xs">
                  <span className="text-amber-200 font-semibold">
                    🎓 Currently editing <strong>{editingAsTeacher.studentName}</strong>&apos;s project on the staff
                  </span>
                  <button
                    type="button"
                    onClick={onExitTeacherEditMode}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-bold cursor-pointer"
                  >
                    Done Editing Student Song
                  </button>
                </div>
              )}

              {/* Teacher Portal Sub-Navigation Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTeacherTab('students')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      teacherTab === 'students'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Students ({allStudents.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTeacherTab('classrooms');
                      setSelectedClassroomForView(null);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      teacherTab === 'classrooms'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>Classrooms ({classrooms.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTab('projects')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      teacherTab === 'projects'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>Projects ({allProjects.length})</span>
                  </button>
                  {isMasterAdmin && (
                    <button
                      type="button"
                      onClick={() => setTeacherTab('teachers')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                        teacherTab === 'teachers'
                          ? 'bg-amber-400 text-slate-950 shadow-sm'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Teachers &amp; Schools ({teachers.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAssignModal();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white shadow-sm cursor-pointer"
                    title="Send an assignment copy of a song to a classroom or students"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Assign Song</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeacherTab('settings')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      teacherTab === 'settings'
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Settings &amp; Backup</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    loginTeacher(activeTeacherPin)
                      .then((d) => {
                        setAllStudents(d.students);
                        setAllProjects(d.projects);
                        if (d.classrooms) setClassrooms(d.classrooms);
                        if (d.teachers) setTeachers(d.teachers);
                      })
                      .catch(() => {});
                  }}
                  title="Refresh list"
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {teacherError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
                  {teacherError}
                </div>
              )}
              {teacherNotice && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs font-semibold">
                  ✓ {teacherNotice}
                </div>
              )}

              {/* TAB A: STUDENTS & PINS */}
              {teacherTab === 'students' && (
                <div className="space-y-3">
                  {/* Add single student row */}
                  <form
                    onSubmit={handleAddStudent}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-end gap-2"
                  >
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        First Name &amp; Last Initial
                      </label>
                      <input
                        type="text"
                        value={newStuName}
                        onChange={(e) => setNewStuName(e.target.value)}
                        placeholder="e.g. Emma S."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        PIN
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newStuPin}
                          onChange={(e) => setNewStuPin(e.target.value)}
                          placeholder="4-digit"
                          className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300"
                        />
                        <button
                          type="button"
                          title="Generate random 4-digit PIN"
                          onClick={() =>
                            setNewStuPin(String(Math.floor(1000 + Math.random() * 9000)))
                          }
                          className="px-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer"
                        >
                          🎲
                        </button>
                      </div>
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Grade
                      </label>
                      <select
                        value={newStuGrade}
                        onChange={(e) => {
                          setNewStuGrade(e.target.value);
                          const available = classrooms.filter((c) => c.grade === e.target.value);
                          if (available.length > 0) setNewStuClassId(available[0].id);
                          else setNewStuClassId('');
                        }}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        {availableGrades.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                        Classroom
                      </label>
                      <select
                        value={newStuClassId}
                        onChange={(e) => setNewStuClassId(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      >
                        <option value="">(No specific class)</option>
                        {classrooms
                          .filter((c) => !newStuGrade || c.grade === newStuGrade)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      + Add Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkAdd((v) => !v)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Bulk Add
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintLoginCards}
                      title="Print student login cards"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cards</span>
                    </button>
                  </form>

                  {showBulkAdd && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <p className="text-xs text-slate-300 font-semibold">
                        Paste student list (one per line: <code>FirstName LastInitial, PIN, Class</code> — e.g. <code>Emma S, 1024, Room 101</code>):
                      </p>
                      <textarea
                        rows={4}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={'Emma S., 1024, Room 101\nNoah K, 2048, Room 101\nOlivia T.'}
                        className="w-full p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBulkAdd(false)}
                          className="px-3 py-1 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkImport}
                          className="px-3.5 py-1 rounded-lg bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          Import Students
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Student Quick Filter Tabs by Classroom */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Browse By Classroom:</span>
                      {teacherClassFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setTeacherClassFilter('ALL')}
                          className="text-amber-400 hover:underline cursor-pointer"
                        >
                          Show All Classes ({allStudents.length})
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                      <button
                        type="button"
                        onClick={() => {
                          setTeacherClassFilter('ALL');
                          setTeacherGradeFilter('ALL');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                          teacherClassFilter === 'ALL'
                            ? 'bg-amber-400 text-slate-950 shadow-sm'
                            : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        All Classes ({allStudents.length})
                      </button>
                      {classrooms.map((cls) => {
                        const inClassCount = allStudents.filter(
                          (s) => s.classId === cls.id || (cls.name && s.classGroup === cls.name)
                        ).length;
                        const isSelected = teacherClassFilter === cls.id;
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => {
                              setTeacherClassFilter(cls.id);
                              setTeacherGradeFilter(cls.grade || 'ALL');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-sky-400 text-slate-950 shadow-sm'
                                : 'bg-slate-950/80 border border-slate-800 text-slate-300 hover:border-sky-500/50 hover:bg-slate-800'
                            }`}
                          >
                            <span>{cls.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                              isSelected ? 'bg-slate-900 text-sky-200' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {inClassCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Filter & Search Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search students by name, class, or PIN..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <select
                      value={teacherGradeFilter}
                      onChange={(e) => {
                        setTeacherGradeFilter(e.target.value);
                        setTeacherClassFilter('ALL');
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="ALL">All Grades</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <select
                      value={teacherClassFilter}
                      onChange={(e) => setTeacherClassFilter(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="ALL">All Classrooms</option>
                      {classrooms
                        .filter((c) => teacherGradeFilter === 'ALL' || c.grade === teacherGradeFilter)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Student Roster Table */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {filteredStudentsList.map((stu) => {
                      const isEditing = editingStudentId === stu.id;
                      const songCount = allProjects.filter((p) => p.studentId === stu.id).length;
                      return (
                        <div
                          key={stu.id}
                          className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/90 flex items-center justify-between gap-2 text-xs"
                        >
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editStuName}
                                onChange={(e) => setEditStuName(e.target.value)}
                                className="px-2 py-1 rounded-sm bg-slate-900 border border-sky-400 text-white font-bold w-28"
                              />
                              <input
                                type="text"
                                value={editStuPin}
                                onChange={(e) => setEditStuPin(e.target.value)}
                                className="px-2 py-1 rounded-sm bg-slate-900 border border-amber-400 text-amber-300 font-mono w-20"
                              />
                              <select
                                value={editStuGrade}
                                onChange={(e) => setEditStuGrade(e.target.value)}
                                className="px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                              >
                                {availableGrades.map((g) => (
                                  <option key={g} value={g}>
                                    {g}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editStuClassId}
                                onChange={(e) => setEditStuClassId(e.target.value)}
                                className="px-2 py-1 rounded-sm bg-slate-900 border border-slate-700 text-slate-200 text-xs"
                              >
                                <option value="">(No class)</option>
                                {classrooms
                                  .filter((c) => !editStuGrade || c.grade === editStuGrade)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleSaveEditedStudent(stu.id)}
                                className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStudentId(null)}
                                className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-bold text-sm text-white">
                                  {stu.firstName}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-amber-300 font-bold">
                                  PIN: {stu.pin}
                                </span>
                                {stu.grade && (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30 text-[11px]">
                                    {stu.grade}
                                  </span>
                                )}
                                {stu.classGroup && (
                                  <span className="text-slate-400">{stu.classGroup}</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setInspectedStudent(stu)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 font-bold text-[11px] cursor-pointer"
                                  title="View and monitor student's saved compositions"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>{songCount} song{songCount === 1 ? '' : 's'}</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingStudentId(stu.id);
                                    setEditStuName(stu.firstName);
                                    setEditStuPin(stu.pin);
                                    setEditStuGrade(stu.grade || '');
                                    setEditStuClassId(stu.classId || '');
                                    setEditStuClass(stu.classGroup || '');
                                  }}
                                  title="Edit name or PIN"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(stu)}
                                  title="Delete student"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {filteredStudentsList.length === 0 && (
                      <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                        No students match the current search / filter.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB B: CLASSROOMS & GRADES */}
              {teacherTab === 'classrooms' && (
                <div className="space-y-4">
                  {/* Header bar with Add Classroom button */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <School className="w-4 h-4 text-amber-400" />
                        <span>Classrooms &amp; Grades Manager</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Organize students by grade and classroom so they can easily find their class
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClassId(null);
                        setClassFormName('');
                        setClassFormGrade('3rd Grade');
                        setClassFormTeacher('');
                        setClassFormSelfRegister(true);
                        setShowAddClassroom((v) => !v);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showAddClassroom ? 'Cancel' : 'Add Classroom'}</span>
                    </button>
                  </div>

                  {/* Add / Edit Classroom Form */}
                  {showAddClassroom && (
                    <form
                      onSubmit={handleSaveClassroom}
                      className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3"
                    >
                      <div className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                        {editingClassId ? 'Edit Classroom' : 'Create New Classroom'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Classroom Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={classFormName}
                            onChange={(e) => setClassFormName(e.target.value)}
                            placeholder="e.g. Room 101 - Mrs. Smith"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Grade *
                          </label>
                          <select
                            value={classFormGrade}
                            onChange={(e) => setClassFormGrade(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          >
                            {STANDARD_GRADES.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Teacher Name (Opt.)
                          </label>
                          <input
                            type="text"
                            value={classFormTeacher}
                            onChange={(e) => setClassFormTeacher(e.target.value)}
                            placeholder="e.g. Mrs. Smith"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={classFormSelfRegister}
                            onChange={(e) => setClassFormSelfRegister(e.target.checked)}
                            className="w-4 h-4 accent-amber-400 rounded-sm"
                          />
                          <span>Allow students to self-register into this classroom</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddClassroom(false);
                              setEditingClassId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                          >
                            {editingClassId ? 'Save Changes' : 'Create Class'}
                          </button>
                        </div>
                      </div>
                    </form>
                  )}

                  {/* Classrooms List / Drill-down View */}
                  {selectedClassroomForView ? (
                    <div className="space-y-3">
                      {/* Classroom Drill-down Banner */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/40 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedClassroomForView(null)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-bold cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>All Classrooms</span>
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white">
                                {selectedClassroomForView.name}
                              </span>
                              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 text-[11px]">
                                {selectedClassroomForView.grade}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {selectedClassroomForView.teacherName ? `Teacher: ${selectedClassroomForView.teacherName} • ` : ''}
                              Click any student to monitor, load, or share their saved compositions
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenAssignModal()}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs cursor-pointer shadow-sm"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Assign Song to Class</span>
                          </button>
                        </div>
                      </div>

                      {/* Clickable List of Students in this Classroom */}
                      <div className="space-y-2">
                        {allStudents
                          .filter(
                            (s) =>
                              s.classId === selectedClassroomForView.id ||
                              (selectedClassroomForView.name && s.classGroup === selectedClassroomForView.name)
                          )
                          .map((stu) => {
                            const studentWorks = allProjects.filter((p) => p.studentId === stu.id);
                            return (
                              <div
                                key={stu.id}
                                className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 transition-all flex items-center justify-between gap-3 text-xs"
                              >
                                <div
                                  onClick={() => setInspectedStudent(stu)}
                                  className="flex items-center gap-3 flex-wrap cursor-pointer flex-1"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/40 flex items-center justify-center font-bold text-sky-300 text-xs shrink-0">
                                    {stu.firstName.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-sm text-white hover:text-sky-300 transition-colors">
                                        {stu.firstName}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-amber-300 font-bold text-[11px]">
                                        PIN: {stu.pin}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                      <span>{studentWorks.length} song{studentWorks.length === 1 ? '' : 's'} saved</span>
                                      {studentWorks.length > 0 && (
                                        <span>• Latest: &quot;{studentWorks[0].title}&quot;</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setInspectedStudent(stu)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-bold text-xs cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Student Work ({studentWorks.length})</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}

                        {allStudents.filter(
                          (s) =>
                            s.classId === selectedClassroomForView.id ||
                            (selectedClassroomForView.name && s.classGroup === selectedClassroomForView.name)
                        ).length === 0 && (
                          <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                            No students registered in {selectedClassroomForView.name} yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2">
                        <div className="text-xs text-amber-200">
                          <span className="font-bold">👉 Interactive Classroom Selector:</span> Click any classroom below or use its <strong className="text-white">View Students</strong> button to see all students enrolled in that class, inspect their compositions, or share work.
                        </div>
                      </div>
                      {classrooms.map((cls) => {
                        const studentCount = allStudents.filter(
                          (s) => s.classId === cls.id || (cls.name && s.classGroup === cls.name)
                        ).length;
                        return (
                          <div
                            key={cls.id}
                            onClick={() => setSelectedClassroomForView(cls)}
                            className="group p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-400/70 hover:bg-slate-900/90 transition-all flex items-center justify-between gap-3 text-xs cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-3 flex-wrap flex-1">
                              <span className="px-2.5 py-1 rounded-md bg-sky-500/20 text-sky-300 font-extrabold border border-sky-500/30 text-xs">
                                {cls.grade}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-white group-hover:text-amber-300 transition-colors">
                                  {cls.name}
                                </span>
                                <span className="text-[11px] text-sky-400 group-hover:underline font-semibold flex items-center gap-1">
                                  <span>(Click to Open Roster)</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </span>
                              </div>
                              {cls.teacherName && (
                                <span className="text-slate-400">Teacher: {cls.teacherName}</span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold font-mono">
                                {studentCount} student{studentCount === 1 ? '' : 's'}
                              </span>
                              {cls.allowSelfRegister !== false ? (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  ✓ Self-Register Open
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-semibold">
                                  🔒 Self-Register Closed
                                </span>
                              )}
                            </div>

                            <div
                              className="flex items-center gap-1.5 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => setSelectedClassroomForView(cls)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer shadow-sm transition-all"
                                title="Open this classroom's student roster"
                              >
                                <Users className="w-3.5 h-3.5" />
                                <span>View Students ({studentCount})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClassId(cls.id);
                                  setClassFormName(cls.name);
                                  setClassFormGrade(cls.grade);
                                  setClassFormTeacher(cls.teacherName || '');
                                  setClassFormSelfRegister(cls.allowSelfRegister !== false);
                                  setShowAddClassroom(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Edit classroom"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClassroom(cls)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                title="Delete classroom"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {classrooms.length === 0 && (
                        <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                          No classrooms created yet. Click "+ Add Classroom" to start organizing grades and classes.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB C: TEACHERS & SCHOOLS (Master Admin Only) */}
              {teacherTab === 'teachers' && isMasterAdmin && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        <span>Master Admin: Teachers &amp; Schools</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Create and manage teacher logins across schools. You maintain master control with PIN 1138.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeacherId(null);
                        setTeacherFormName('');
                        setTeacherFormPin('');
                        setTeacherFormSchool('');
                        setTeacherFormGrades('');
                        setShowAddTeacher((v) => !v);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{showAddTeacher ? 'Cancel' : 'Add Teacher'}</span>
                    </button>
                  </div>

                  {/* Add / Edit Teacher Form */}
                  {showAddTeacher && (
                    <form
                      onSubmit={handleSaveTeacher}
                      className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3"
                    >
                      <div className="font-bold text-xs text-amber-300 uppercase tracking-wider">
                        {editingTeacherId ? 'Edit Teacher Account' : 'Create New Teacher Account'}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Teacher Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={teacherFormName}
                            onChange={(e) => setTeacherFormName(e.target.value)}
                            placeholder="e.g. Ms. Johnson"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Teacher PIN (4+ digits) *
                          </label>
                          <input
                            type="text"
                            required
                            value={teacherFormPin}
                            onChange={(e) => setTeacherFormPin(e.target.value)}
                            placeholder="e.g. 5432"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            School Name (Opt.)
                          </label>
                          <input
                            type="text"
                            value={teacherFormSchool}
                            onChange={(e) => setTeacherFormSchool(e.target.value)}
                            placeholder="e.g. Lincoln Elementary"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                            Grades / Subject (Opt.)
                          </label>
                          <input
                            type="text"
                            value={teacherFormGrades}
                            onChange={(e) => setTeacherFormGrades(e.target.value)}
                            placeholder="e.g. K-5 General Music"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddTeacher(false);
                            setEditingTeacherId(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          {editingTeacherId ? 'Save Changes' : 'Create Teacher'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Teachers List */}
                  <div className="space-y-2">
                    {teachers.map((tch) => {
                      const isMaster = tch.isMasterAdmin || tch.pin === '1138' || tch.pin === 'adminbaby';
                      const tchNameLower = (tch.name || '').toLowerCase();
                      const tchProjectCount = allProjects.filter((p) => {
                        const projStudentNameLower = (p.studentName || '').toLowerCase();
                        return (
                          p.studentId === tch.id ||
                          (isMaster && (p.studentId === 'teach_master' || p.studentId === 'teacher_master')) ||
                          (tchNameLower && projStudentNameLower === tchNameLower)
                        );
                      }).length;

                      return (
                        <div
                          key={tch.id}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div
                            onClick={() => {
                              setProjectStudentFilter(tch.id);
                              setTeacherTab('projects');
                            }}
                            className="flex items-center gap-3 flex-wrap cursor-pointer group"
                            title={`Click to view ${tch.name}'s songs (${tchProjectCount})`}
                          >
                            <span className="font-bold text-sm text-white group-hover:text-amber-300 group-hover:underline flex items-center gap-1.5">
                              <span>{tch.name}</span>
                              <FolderOpen className="w-3.5 h-3.5 text-amber-400 opacity-70 group-hover:opacity-100" />
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-amber-300 font-bold">
                              PIN: {tch.pin}
                            </span>
                            {tch.schoolName && (
                              <span className="text-slate-400">🏫 {tch.schoolName}</span>
                            )}
                            {tch.gradeRange && (
                              <span className="text-slate-400">🎵 {tch.gradeRange}</span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 font-bold border border-sky-500/30 text-[11px] flex items-center gap-1">
                              🎵 {tchProjectCount} song{tchProjectCount === 1 ? '' : 's'}
                            </span>
                            {isMaster ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-[10px]">
                                ⭐ Master Admin
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                                Teacher
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setProjectStudentFilter(tch.id);
                                setTeacherTab('projects');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
                              title={`View songs created by ${tch.name}`}
                            >
                              <Music className="w-3 h-3" />
                              <span>View Songs</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTeacherId(tch.id);
                                setTeacherFormName(tch.name);
                                setTeacherFormPin(tch.pin);
                                setTeacherFormSchool(tch.schoolName || '');
                                setTeacherFormGrades(tch.gradeRange || '');
                                setShowAddTeacher(true);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                              title="Edit teacher"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {!isMaster && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTeacher(tch)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                title="Delete teacher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB B: ALL PROJECTS (STUDENTS & TEACHERS) */}
              {teacherTab === 'projects' && (
                <div className="space-y-3">
                  {/* Active filter banner if a specific teacher or student is selected */}
                  {projectStudentFilter !== 'ALL' && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                      <span className="font-semibold flex items-center gap-1.5">
                        <span>🎵 Filtered to:</span>
                        <span className="font-bold text-white">
                          {teachers.find((t) => t.id === projectStudentFilter)?.name ||
                            allStudents.find((s) => s.id === projectStudentFilter)?.firstName ||
                            projectStudentFilter}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setProjectStudentFilter('ALL')}
                        className="text-[11px] underline text-amber-300 hover:text-white cursor-pointer"
                      >
                        Show All
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        let titleToSave = currentScore.title.trim();
                        if (isUntitledScore || !titleToSave) {
                          const prompted = window.prompt(
                            'Enter a title for this song to save under your teacher projects:',
                            'Class Lesson Melody'
                          );
                          if (!prompted || !prompted.trim()) return;
                          titleToSave = prompted.trim();
                        }
                        setIsLoading(true);
                        try {
                          const currentTeacher = teachers.find((t) => t.id === projectStudentFilter) ||
                            signedInTeacher ||
                            teachers.find((t) => t.isMasterAdmin || t.pin === '1138' || t.pin === 'adminbaby') || {
                              id: 'teach_master',
                              name: 'Mr. Arthur',
                              pin: activeTeacherPin || '1138',
                            };
                          await onManualSaveCurrentSong(titleToSave, {
                            teacherPin: activeTeacherPin || currentTeacher.pin || '1138',
                            teacherName: currentTeacher.name || 'Mr. Arthur',
                            teacherId: currentTeacher.id || 'teach_master',
                          });
                          const refreshed = await loginTeacher(activeTeacherPin || '1138');
                          setAllProjects(refreshed.projects);
                          setTeacherNotice(`Saved "${titleToSave}" under ${currentTeacher.name}!`);
                          window.setTimeout(() => setTeacherNotice(null), 3000);
                        } catch (err: any) {
                          setTeacherError(err.message || 'Could not save current song.');
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer shrink-0 shadow-sm"
                      title="Save the currently active song in Staff Composer as a teacher project"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Current Song as Teacher</span>
                    </button>

                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Search by song title or student name..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-white"
                      />
                    </div>
                    <select
                      value={projectStudentFilter}
                      onChange={(e) => setProjectStudentFilter(e.target.value)}
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="ALL">All Creators ({allProjects.length})</option>
                      {teachers.length > 0 && (
                        <optgroup label="Teachers & Admins">
                          {teachers.map((t) => {
                            const isMaster = t.isMasterAdmin || t.pin === '1138' || t.pin === 'adminbaby';
                            const tNameLower = (t.name || '').toLowerCase();
                            const count = allProjects.filter((p) => {
                              const projStudentNameLower = (p.studentName || '').toLowerCase();
                              return (
                                p.studentId === t.id ||
                                (isMaster && (p.studentId === 'teach_master' || p.studentId === 'teacher_master')) ||
                                (tNameLower && projStudentNameLower === tNameLower)
                              );
                            }).length;
                            return (
                              <option key={t.id} value={t.id}>
                                🎵 {t.name} ({count})
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                      <optgroup label="Students">
                        {allStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.firstName} ({allProjects.filter((p) => p.studentId === s.id).length})
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    <select
                      value={projectAppFilter}
                      onChange={(e) => setProjectAppFilter(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                    >
                      <option value="ALL">All Apps ({allProjects.length})</option>
                      <option value="staff-composer">
                        🎼 Staff Composer (
                        {allProjects.filter((p) => !p.appType || p.appType === 'staff-composer').length})
                      </option>
                      <option value="beat-machine">
                        🥁 Beat Machine ({allProjects.filter((p) => p.appType === 'beat-machine').length})
                      </option>
                      <option value="rhythm-rockstars">
                        🎸 Rock Stars ({allProjects.filter((p) => p.appType === 'rhythm-rockstars').length})
                      </option>
                      <option value="daw">
                        🎛️ Studio DAW ({allProjects.filter((p) => p.appType === 'daw').length})
                      </option>
                    </select>
                  </div>

                  {filteredProjectsList.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-slate-950/40 border border-slate-800 text-center space-y-2 text-xs text-slate-400">
                      <Music className="w-8 h-8 text-slate-600 mx-auto" />
                      <div className="font-bold text-white text-sm">
                        {projectStudentFilter !== 'ALL'
                          ? `No saved songs found for ${
                              teachers.find((t) => t.id === projectStudentFilter)?.name ||
                              allStudents.find((s) => s.id === projectStudentFilter)?.firstName ||
                              'this creator'
                            }`
                          : 'No saved songs match your search/filter.'}
                      </div>
                      <p className="text-slate-400 max-w-sm mx-auto">
                        {projectStudentFilter !== 'ALL'
                          ? 'Click "Save Current Song as Teacher" above to save the current song on your staff, or switch the filter to All Creators.'
                          : 'Try clearing your search query or switching creator/app filters above.'}
                      </p>
                      {projectStudentFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setProjectStudentFilter('ALL')}
                          className="mt-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
                        >
                          Show All Creators ({allProjects.length})
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                      {filteredProjectsList.map((proj) => {
                        const isRenaming = renamingProjectId === proj.id;
                        const appMeta = getAppDescriptor(proj.appType);

                        return (
                          <div
                            key={proj.id}
                            className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            {isRenaming ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={renameTitleInput}
                                  onChange={(e) => setRenameTitleInput(e.target.value)}
                                  className="px-2.5 py-1 rounded-sm bg-slate-900 border border-sky-400 text-white font-bold flex-1"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTeacherRenameSong(proj.id)}
                                  className="px-2.5 py-1 rounded-md bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setRenamingProjectId(null)}
                                  className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-sm text-white truncate">
                                      {proj.title}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 font-['Fredoka',sans-serif] ${appMeta.badgeClass}`}
                                    >
                                      <span>{appMeta.emoji}</span>
                                      <span>{appMeta.name}</span>
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-[11px]">
                                      by {proj.studentName}
                                    </span>
                                    {proj.isAssignment && (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30 flex items-center gap-1">
                                        <BookOpen className="w-2.5 h-2.5" />
                                        <span>Assignment</span>
                                      </span>
                                    )}
                                  </div>
                                  {proj.assignmentInstructions && (
                                    <div className="mt-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/25 text-[11px] text-purple-200">
                                      📝 <span className="font-semibold">Instructions:</span> {proj.assignmentInstructions}
                                    </div>
                                  )}
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span>
                                      Updated{' '}
                                      {safeFormatDate(proj.updatedAt)}{' '}
                                      at{' '}
                                      {safeFormatTime(proj.updatedAt)}
                                    </span>
                                    <span>•</span>
                                    {proj.appType === 'beat-machine' ? (
                                      <span>
                                        🥁 {proj.projectData?.measures || 1} bar(s) •{' '}
                                        {proj.projectData?.bpm || 115} BPM
                                      </span>
                                    ) : (
                                      <span>
                                        🎼 {proj.score?.tracks?.length || 1} track(s) •{' '}
                                        {proj.score?.tempo || 108} BPM
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onLoadProject(proj, {
                                        teacherPin: activeTeacherPin,
                                        studentName: proj.studentName,
                                        studentId: proj.studentId,
                                      });
                                      onClose();
                                    }}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer font-['Fredoka',sans-serif] ${appMeta.openColor}`}
                                    title={`Open in ${appMeta.name}`}
                                  >
                                    <FolderOpen className="w-3.5 h-3.5" />
                                    <span>Open in {appMeta.shortName}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTeacherShareProject(proj)}
                                    title="Copy public share link"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 cursor-pointer"
                                  >
                                    {copiedShareLinkProjId === proj.id ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Share2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignModal(proj)}
                                    title="Assign this song to students or classrooms"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenamingProjectId(proj.id);
                                      setRenameTitleInput(proj.title);
                                    }}
                                    title="Rename song title"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTeacherDeleteSong(proj)}
                                    title="Delete project"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB C: SETTINGS & BACKUP */}
              {teacherTab === 'settings' && (
                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-white text-sm">
                        Allow New Students to Self-Register on Sign In
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        When enabled, a student whose first name isn&apos;t on the list yet can type their first name and choose a 4-digit PIN to create their account automatically.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowSelfCreate}
                      onChange={async (e) => {
                        const nextVal = e.target.checked;
                        setAllowSelfCreate(nextVal);
                        try {
                          await teacherUpdateSettings({
                            teacherPin: activeTeacherPin,
                            allowStudentSelfCreate: nextVal,
                          });
                          setTeacherNotice('Updated classroom sign-in setting.');
                          window.setTimeout(() => setTeacherNotice(null), 2500);
                        } catch {
                          // ignore
                        }
                      }}
                      className="w-5 h-5 accent-amber-400 cursor-pointer shrink-0"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="font-bold text-white text-sm">Change Teacher Admin PIN</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={newTeacherPinField}
                        onChange={(e) => setNewTeacherPinField(e.target.value)}
                        placeholder="New Teacher PIN (4+ digits)..."
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (newTeacherPinField.trim().length < 4) {
                            setTeacherError('Teacher PIN must be at least 4 characters.');
                            return;
                          }
                          try {
                            const res = await teacherUpdateSettings({
                              teacherPin: activeTeacherPin,
                              newTeacherPin: newTeacherPinField.trim(),
                            });
                            setActiveTeacherPin(res.teacherPin);
                            setNewTeacherPinField('');
                            setTeacherNotice('Teacher PIN updated!');
                            window.setTimeout(() => setTeacherNotice(null), 2500);
                          } catch (err: any) {
                            setTeacherError(err.message || 'Failed to update PIN.');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-bold cursor-pointer"
                      >
                        Update PIN
                      </button>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white text-sm">
                        Classroom Database Backup (.json)
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Download a complete copy of all student names, PINs, and compositions, or restore from a backup file.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportClassroomBackup}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Backup</span>
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Restore Backup</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={handleImportClassroomBackup}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* NY State Education Law § 2-d Compliance & Privacy */}
                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>NY State Education Law § 2-d Compliance</span>
                      </div>
                      <p className="text-slate-400 text-[11px]">
                        Review the Parents&apos; Bill of Rights, data minimization policies, and print compliance documentation for your district Data Protection Officer (DPO).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsPrivacyModalOpen(true)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-semibold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View NY Ed Law § 2-d Statement</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* NY Ed Law § 2-d Compliance & Parents' Bill of Rights Modal */}
      <EdLawPrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />

      {/* STUDENT WORK INSPECTOR MODAL */}
      {inspectedStudent && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setInspectedStudent(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Inspector Header */}
            <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center font-bold text-sky-300 text-sm">
                  {inspectedStudent.firstName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-white">
                      {inspectedStudent.firstName}&apos;s Saved Compositions
                    </h3>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-amber-300 font-bold text-xs">
                      PIN: {inspectedStudent.pin}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {inspectedStudent.grade ? `${inspectedStudent.grade} • ` : ''}
                    {inspectedStudent.classGroup || 'General Music'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Student Projects List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {allProjects.filter((p) => p.studentId === inspectedStudent.id).length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                  <Music className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-semibold">{inspectedStudent.firstName} hasn&apos;t saved any songs yet.</p>
                  <p className="text-slate-500 mt-1">
                    Songs they name and work on will automatically show up here.
                  </p>
                </div>
              ) : (
                allProjects
                  .filter((p) => p.studentId === inspectedStudent.id)
                  .map((proj) => {
                    const appMeta = getAppDescriptor(proj.appType);
                    return (
                      <div
                        key={proj.id}
                        className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-white">
                              {proj.title}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 font-['Fredoka',sans-serif] ${appMeta.badgeClass}`}
                            >
                              <span>{appMeta.emoji}</span>
                              <span>{appMeta.name}</span>
                            </span>
                            {proj.isAssignment && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30 flex items-center gap-1">
                                <BookOpen className="w-2.5 h-2.5" />
                                <span>Assignment</span>
                              </span>
                            )}
                          </div>
                          {proj.assignmentInstructions && (
                            <div className="mt-1 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/25 text-[11px] text-purple-200">
                              📝 <span className="font-semibold">Task:</span> {proj.assignmentInstructions}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-1">
                            <span>
                              Updated{' '}
                              {safeFormatDate(proj.updatedAt)}{' '}
                              at{' '}
                              {safeFormatTime(proj.updatedAt)}
                            </span>
                            <span>•</span>
                            {proj.appType === 'beat-machine' ? (
                              <span>
                                🥁 {proj.projectData?.measures || 1} bar(s) • {proj.projectData?.bpm || 115} BPM
                              </span>
                            ) : (
                              <span>
                                🎼 {proj.score?.tracks?.length || 1} track(s) • {proj.score?.tempo || 108} BPM
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              onLoadProject(proj, {
                                teacherPin: activeTeacherPin,
                                studentName: proj.studentName,
                                studentId: proj.studentId,
                              });
                              setInspectedStudent(null);
                              onClose();
                            }}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold cursor-pointer font-['Fredoka',sans-serif] ${appMeta.openColor}`}
                            title={`Load and monitor ${proj.studentName}'s song`}
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Load Work</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTeacherShareProject(proj)}
                            title="Share student work (copy link)"
                            className="p-2 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 cursor-pointer"
                          >
                            {copiedShareLinkProjId === proj.id ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTeacherDeleteSong(proj)}
                            title="Delete project"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT DISPATCH MODAL */}
      {showAssignModal && assignSourceProject && (
        <div
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Assignment Header */}
            <div className="px-5 py-4 bg-slate-950 border-b border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Assign Song to Students
                  </h3>
                  <p className="text-xs text-purple-300/80">
                    Creates an individual editable copy for every selected student in their account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Assignment Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Song to Assign */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Song / Template To Assign:
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-sm">
                    {assignSourceProject.title}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30 font-['Fredoka',sans-serif]">
                    {getAppDescriptor(assignSourceProject.appType).name}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase text-slate-400">
                  Assignment Instructions (Visible to Students)
                </label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="e.g. Listen to the unfinished melody, add an ostinato pattern, and add 2 additional instruments!"
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-purple-400 focus:outline-hidden text-xs text-white"
                />
              </div>

              {/* Classroom / Target Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-slate-400">
                    Assign To Classroom:
                  </label>
                  <span className="text-[11px] text-purple-300 font-semibold">
                    {assignSelectedStudentIds.length} student{assignSelectedStudentIds.length === 1 ? '' : 's'} selected
                  </span>
                </div>

                <select
                  value={assignTargetClassId}
                  onChange={(e) => {
                    const classId = e.target.value;
                    setAssignTargetClassId(classId);
                    if (classId === 'ALL') {
                      setAssignSelectedStudentIds(allStudents.map((s) => s.id));
                    } else {
                      const matchedClass = classrooms.find((c) => c.id === classId);
                      const inClass = allStudents
                        .filter((s) => s.classId === classId || (matchedClass && s.classGroup === matchedClass.name))
                        .map((s) => s.id);
                      setAssignSelectedStudentIds(inClass);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="ALL">Entire Music School (All Classrooms &amp; Students)</option>
                  {classrooms.map((cls) => {
                    const count = allStudents.filter(
                      (s) => s.classId === cls.id || s.classGroup === cls.name
                    ).length;
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.grade} — {cls.name} ({count} students)
                      </option>
                    );
                  })}
                </select>

                {/* Individual Checkbox Toggle for Fine-Grained Control */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between text-[11px] border-b border-slate-800 pb-1.5">
                    <span className="font-semibold text-slate-300">Individual Student Toggles</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const relevant = assignTargetClassId === 'ALL'
                            ? allStudents
                            : allStudents.filter(
                                (s) =>
                                  s.classId === assignTargetClassId ||
                                  s.classGroup === classrooms.find((c) => c.id === assignTargetClassId)?.name
                              );
                          setAssignSelectedStudentIds(relevant.map((s) => s.id));
                        }}
                        className="text-purple-300 hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setAssignSelectedStudentIds([])}
                        className="text-slate-400 hover:underline cursor-pointer"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {(assignTargetClassId === 'ALL'
                      ? allStudents
                      : allStudents.filter(
                          (s) =>
                            s.classId === assignTargetClassId ||
                            s.classGroup === classrooms.find((c) => c.id === assignTargetClassId)?.name
                        )
                    ).map((stu) => {
                      const isChecked = assignSelectedStudentIds.includes(stu.id);
                      return (
                        <label
                          key={stu.id}
                          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-900 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignSelectedStudentIds((prev) => [...prev, stu.id]);
                              } else {
                                setAssignSelectedStudentIds((prev) => prev.filter((id) => id !== stu.id));
                              }
                            }}
                            className="w-4 h-4 accent-purple-500 rounded-sm"
                          />
                          <span className="truncate font-semibold text-white">{stu.firstName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-950 border-t border-purple-500/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigning || assignSelectedStudentIds.length === 0}
                onClick={handleExecuteAssignment}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 disabled:opacity-50 text-white font-bold text-xs shadow-lg cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isAssigning
                    ? 'Dispatching Assignment...'
                    : `Assign to ${assignSelectedStudentIds.length} Student${assignSelectedStudentIds.length === 1 ? '' : 's'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
