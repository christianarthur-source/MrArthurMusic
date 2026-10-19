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
  normalizeStudentName,
  formatStudentDisplayName,
  changeStudentPin,
  saveStudentSession,
} from '../utils/classroomApi';
import { containsProfanity } from '../utils/profanityFilter';

export function getAppDescriptor(appType?: MusicLabAppType) {
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
  onManualSaveCurrentSong: (customTitle?: string) => Promise<void>;
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

  // Teacher - Settings state
  const [newTeacherPinField, setNewTeacherPinField] = useState<string>('');

  // Refresh data when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setLoginError(null);
    setTeacherError(null);
    setTeacherNotice(null);

    if (openInTeacherMode) {
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
  }, [isOpen, studentSession, editingAsTeacher, openInTeacherMode, activeTeacherPin]);

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
        id: editingClassId || undefined,
        name: classFormName.trim(),
        grade: classFormGrade,
        teacherName: classFormTeacher.trim(),
        allowSelfRegister: classFormSelfRegister,
      });
      setClassrooms(res.classrooms);
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
      setClassrooms(res.classrooms);
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
        id: editingTeacherId || undefined,
        name: teacherFormName.trim(),
        pin: teacherFormPin.trim(),
        schoolName: teacherFormSchool.trim(),
        gradeRange: teacherFormGrades.trim(),
      });
      setTeachers(res.teachers);
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
      setTeachers(res.teachers);
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
    if (projectStudentFilter !== 'ALL' && p.studentId !== projectStudentFilter) {
      return false;
    }
    if (projectAppFilter !== 'ALL' && (p.appType || 'staff-composer') !== projectAppFilter) {
      return false;
    }
    const q = projectSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.studentName.toLowerCase().includes(q)
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
                onClick={() => setMode('student')}
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
                        <span>Step 2: Choose Your Classroom</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Music classes in <strong>{selectedGrade || 'your grade'}</strong>
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
                          {cls.teacherName && (
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
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span>
                                  Saved{' '}
                                  {new Date(proj.updatedAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                  })}{' '}
                                  at{' '}
                                  {new Date(proj.updatedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
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
                    onClick={() => setTeacherTab('classrooms')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
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
                                  onClick={() => {
                                    setProjectStudentFilter(stu.id);
                                    setTeacherTab('projects');
                                  }}
                                  className="text-sky-400 hover:underline cursor-pointer"
                                >
                                  {songCount} song{songCount === 1 ? '' : 's'}
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

                  {/* Classrooms List */}
                  <div className="space-y-2">
                    {classrooms.map((cls) => {
                      const studentCount = allStudents.filter(
                        (s) => s.classId === cls.id || (cls.name && s.classGroup === cls.name)
                      ).length;
                      return (
                        <div
                          key={cls.id}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                              {cls.grade}
                            </span>
                            <span className="font-bold text-sm text-white">{cls.name}</span>
                            {cls.teacherName && (
                              <span className="text-slate-400">Teacher: {cls.teacherName}</span>
                            )}
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
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

                          <div className="flex items-center gap-1.5 shrink-0">
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
                      return (
                        <div
                          key={tch.id}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="font-bold text-sm text-white">{tch.name}</span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono text-amber-300 font-bold">
                              PIN: {tch.pin}
                            </span>
                            {tch.schoolName && (
                              <span className="text-slate-400">🏫 {tch.schoolName}</span>
                            )}
                            {tch.gradeRange && (
                              <span className="text-slate-400">🎵 {tch.gradeRange}</span>
                            )}
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

              {/* TAB B: STUDENT PROJECTS */}
              {teacherTab === 'projects' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
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
                      <option value="ALL">All Students ({allProjects.length})</option>
                      {allStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} ({allProjects.filter((p) => p.studentId === s.id).length})
                        </option>
                      ))}
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
                    <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center text-xs text-slate-400">
                      No saved student projects match this filter.
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
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span>
                                      Updated{' '}
                                      {new Date(proj.updatedAt).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                      })}{' '}
                                      at{' '}
                                      {new Date(proj.updatedAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
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
    </div>
  );
};
