import { StudentProfile, LeaderboardEntry } from '../types/game';
import { containsInappropriateLanguage, PROFANITY_WARNING_MESSAGE } from '../utils/profanityFilter';
import {
  fetchRhythmRockstarsLeaderboard,
  submitRhythmRockstarsScore,
  normalizeStudentName,
} from '../../utils/classroomApi';

const LOCAL_STORAGE_KEY = 'denti_rhythm_student_session';
const studentStorageKey = (studentId?: string) =>
  studentId ? `${LOCAL_STORAGE_KEY}_${studentId}` : LOCAL_STORAGE_KEY;

const DEFAULT_FALLBACK_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    id: 's_maya',
    name: 'Drummer Maya',
    avatar: '🥁',
    classCode: 'ROOM-101',
    totalScore: 3850,
    highestLevel: 6,
    highestStreak: 12,
    quizzesCompleted: 15,
    badgesCount: 5,
    starsCount: 18,
  },
  {
    rank: 2,
    id: 's_leo',
    name: 'Leo Shredder',
    avatar: '🎸',
    classCode: 'ROOM-101',
    totalScore: 2980,
    highestLevel: 5,
    highestStreak: 9,
    quizzesCompleted: 12,
    badgesCount: 3,
    starsCount: 14,
  },
  {
    rank: 3,
    id: 's_zoe',
    name: 'Zoe BeatBox',
    avatar: '🎤',
    classCode: 'ROOM-101',
    totalScore: 2150,
    highestLevel: 4,
    highestStreak: 8,
    quizzesCompleted: 10,
    badgesCount: 2,
    starsCount: 10,
  },
];

function profileToLeaderboardEntry(p: StudentProfile): LeaderboardEntry {
  const progressLevels = Object.keys(p.levelProgress || {})
    .map((k) => parseInt(k, 10))
    .filter((n) => Number.isFinite(n) && n >= 1);
  const highestLevel = Math.max(1, ...progressLevels);
  const starsCount = Object.values(p.levelProgress || {}).reduce(
    (sum, item) => sum + (Number(item?.stars) || 0),
    0
  );
  return {
    rank: 1,
    id: p.id,
    name: p.name,
    avatar: p.avatar || '🎸',
    classCode: p.classCode || 'Classroom',
    totalScore: Number(p.totalScore) || 0,
    highestLevel,
    highestStreak: Number(p.highestStreak) || 0,
    quizzesCompleted: Number(p.quizzesCompleted) || 0,
    badgesCount: Array.isArray(p.badges) ? p.badges.length : 1,
    starsCount,
  };
}

export const apiClient = {
  // Local storage session helpers (per-student key + legacy key migration)
  getLocalProfile(studentId?: string, studentName?: string): StudentProfile | null {
    try {
      if (studentId) {
        const perStudentRaw = localStorage.getItem(studentStorageKey(studentId));
        if (perStudentRaw) {
          const parsed = JSON.parse(perStudentRaw) as StudentProfile;
          // Also check if legacy shared key has a higher score for this same student
          const legacyRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (legacyRaw) {
            const legacy = JSON.parse(legacyRaw) as StudentProfile;
            const sameStudent =
              legacy.id === studentId ||
              (studentName &&
                normalizeStudentName(legacy.name || '') === normalizeStudentName(studentName));
            if (sameStudent && (Number(legacy.totalScore) || 0) > (Number(parsed.totalScore) || 0)) {
              const merged: StudentProfile = {
                ...parsed,
                totalScore: Math.max(Number(parsed.totalScore) || 0, Number(legacy.totalScore) || 0),
                highestStreak: Math.max(Number(parsed.highestStreak) || 0, Number(legacy.highestStreak) || 0),
                quizzesCompleted: Math.max(
                  Number(parsed.quizzesCompleted) || 0,
                  Number(legacy.quizzesCompleted) || 0
                ),
                levelProgress: { ...(legacy.levelProgress || {}), ...(parsed.levelProgress || {}) },
                badges: Array.from(new Set([...(legacy.badges || []), ...(parsed.badges || [])])),
                updatedAt: new Date().toISOString(),
              };
              this.saveLocalProfile(merged);
              return merged;
            }
          }
          return parsed;
        }
      }

      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data) as StudentProfile;
        if (!studentId && !studentName) return parsed;
        const matchesId = studentId && parsed.id === studentId;
        const matchesName =
          studentName &&
          normalizeStudentName(parsed.name || '') === normalizeStudentName(studentName);
        if (matchesId || matchesName) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return null;
  },

  saveLocalProfile(profile: StudentProfile) {
    try {
      const serialized = JSON.stringify(profile);
      localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
      if (profile.id) {
        localStorage.setItem(studentStorageKey(profile.id), serialized);
      }
    } catch {
      // ignore
    }
  },

  clearLocalProfile() {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Synchronizes a student's local profile with the classroom cloud leaderboard:
   * - If the student already has local points (`totalScore > 0`), posts them to the cloud leaderboard
   *   so existing high scores immediately appear on the leaderboard.
   * - If the cloud has a higher score for this student (e.g., from another Chromebook), restores it locally.
   */
  async syncStudentProfile(profile: StudentProfile): Promise<StudentProfile> {
    this.saveLocalProfile(profile);
    try {
      if ((Number(profile.totalScore) || 0) > 0) {
        const res = await submitRhythmRockstarsScore({
          studentId: profile.id,
          name: profile.name,
          avatar: profile.avatar || '🎸',
          classCode: profile.classCode || 'Classroom',
          pointsEarned: 0,
          totalScore: profile.totalScore,
          streak: profile.highestStreak || 0,
          highestStreak: profile.highestStreak || 0,
          quizzesCompleted: profile.quizzesCompleted || 0,
          levelProgress: profile.levelProgress,
          badges: profile.badges,
        });
        if (res.student) {
          const synced: StudentProfile = {
            ...profile,
            totalScore: Math.max(Number(profile.totalScore) || 0, Number(res.student.totalScore) || 0),
            highestStreak: Math.max(
              Number(profile.highestStreak) || 0,
              Number(res.student.highestStreak) || 0
            ),
            quizzesCompleted: Math.max(
              Number(profile.quizzesCompleted) || 0,
              Number(res.student.quizzesCompleted) || 0
            ),
            levelProgress: {
              ...(profile.levelProgress || {}),
              ...(res.student.levelProgress || {}),
            },
            badges: Array.from(
              new Set([...(profile.badges || []), ...(res.student.badges || [])])
            ),
            updatedAt: res.student.updatedAt || new Date().toISOString(),
          };
          this.saveLocalProfile(synced);
          return synced;
        }
      } else {
        const { student: cloudStudent } = await fetchRhythmRockstarsLeaderboard(profile.id);
        if (cloudStudent && (Number(cloudStudent.totalScore) || 0) > 0) {
          const restored: StudentProfile = {
            ...profile,
            totalScore: Number(cloudStudent.totalScore) || 0,
            highestStreak: Math.max(
              Number(profile.highestStreak) || 0,
              Number(cloudStudent.highestStreak) || 0
            ),
            quizzesCompleted: Math.max(
              Number(profile.quizzesCompleted) || 0,
              Number(cloudStudent.quizzesCompleted) || 0
            ),
            levelProgress: {
              ...(profile.levelProgress || {}),
              ...(cloudStudent.levelProgress || {}),
            },
            badges: Array.from(
              new Set([...(profile.badges || []), ...(cloudStudent.badges || [])])
            ),
            updatedAt: cloudStudent.updatedAt || new Date().toISOString(),
          };
          this.saveLocalProfile(restored);
          return restored;
        }
      }
    } catch (err) {
      console.warn('Could not sync Rhythm Rockstars profile with cloud:', err);
    }
    return profile;
  },

  // Remote Backend Calls
  async loginStudent(name: string, passcode = '1234', avatar = '🎸', classCode = 'ROOM-101'): Promise<StudentProfile> {
    const cleanName = (name || '').trim();
    if (containsInappropriateLanguage(cleanName)) {
      throw new Error(PROFANITY_WARNING_MESSAGE);
    }

    const existing = this.getLocalProfile(undefined, cleanName);
    const baseProfile: StudentProfile = existing || {
      id: 'local_' + Date.now().toString(36),
      name: cleanName,
      avatar: avatar || '🎸',
      passcode: passcode || '1234',
      classCode: classCode || 'ROOM-101',
      totalScore: 0,
      highestStreak: 0,
      quizzesCompleted: 0,
      levelProgress: { 1: { stars: 3, highAccuracy: 100 } },
      badges: ['rockstar_rookie'],
      updatedAt: new Date().toISOString(),
    };
    return this.syncStudentProfile(baseProfile);
  },

  async submitScore(payload: {
    studentId: string;
    pointsEarned: number;
    streak: number;
    level: number;
    stars: number;
    accuracy: number;
    newBadges?: string[];
  }): Promise<StudentProfile | null> {
    // 1. Update local profile immediately so UI & offline state are always up to date
    const current =
      this.getLocalProfile(payload.studentId) ||
      this.getLocalProfile();

    let updatedLocal: StudentProfile | null = null;
    if (current) {
      const nextScore = (Number(current.totalScore) || 0) + (Number(payload.pointsEarned) || 0);
      const nextStreak = Math.max(Number(current.highestStreak) || 0, Number(payload.streak) || 0);
      const nextQuizzes = (Number(current.quizzesCompleted) || 0) + 1;
      const levelProgress = { ...(current.levelProgress || {}) };
      const prevLvl = levelProgress[payload.level] || { stars: 0, highAccuracy: 0 };
      levelProgress[payload.level] = {
        stars: Math.max(prevLvl.stars || 0, payload.stars || 0),
        highAccuracy: Math.max(prevLvl.highAccuracy || 0, payload.accuracy || 0),
      };
      const badges = [...(current.badges || [])];
      if (payload.newBadges) {
        payload.newBadges.forEach((b) => {
          if (!badges.includes(b)) badges.push(b);
        });
      }
      updatedLocal = {
        ...current,
        id: payload.studentId || current.id,
        totalScore: nextScore,
        highestStreak: nextStreak,
        quizzesCompleted: nextQuizzes,
        levelProgress,
        badges,
        updatedAt: new Date().toISOString(),
      };
      this.saveLocalProfile(updatedLocal);
    }

    // 2. Post to the classroom cloud leaderboard (/api/classroom -> rhythm_rockstars_submit_score)
    try {
      const res = await submitRhythmRockstarsScore({
        studentId: payload.studentId,
        name: updatedLocal?.name || 'Rockstar',
        avatar: updatedLocal?.avatar || '🎸',
        classCode: updatedLocal?.classCode || 'Classroom',
        pointsEarned: payload.pointsEarned,
        totalScore: updatedLocal?.totalScore,
        streak: payload.streak,
        highestStreak: updatedLocal?.highestStreak,
        quizzesCompleted: updatedLocal?.quizzesCompleted,
        level: payload.level,
        stars: payload.stars,
        accuracy: payload.accuracy,
        levelProgress: updatedLocal?.levelProgress,
        badges: updatedLocal?.badges,
        newBadges: payload.newBadges,
      });
      if (res.student && updatedLocal) {
        const merged: StudentProfile = {
          ...updatedLocal,
          totalScore: Math.max(updatedLocal.totalScore, Number(res.student.totalScore) || 0),
          highestStreak: Math.max(updatedLocal.highestStreak, Number(res.student.highestStreak) || 0),
          quizzesCompleted: Math.max(
            updatedLocal.quizzesCompleted,
            Number(res.student.quizzesCompleted) || 0
          ),
          levelProgress: {
            ...updatedLocal.levelProgress,
            ...(res.student.levelProgress || {}),
          },
          badges: Array.from(
            new Set([...updatedLocal.badges, ...(res.student.badges || [])])
          ),
          updatedAt: res.student.updatedAt || updatedLocal.updatedAt,
        };
        this.saveLocalProfile(merged);
        return merged;
      }
    } catch (err) {
      console.warn('Cloud score update failed, using updated local profile:', err);
    }

    return updatedLocal;
  },

  async updateStudentProfile(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile> {
    const current = this.getLocalProfile(id) || this.getLocalProfile();
    if (current) {
      if (updates.name) current.name = updates.name;
      if (updates.avatar) current.avatar = updates.avatar;
      if (updates.passcode) current.passcode = updates.passcode;
      if (updates.classCode) current.classCode = updates.classCode;
      if (updates.totalScore !== undefined) current.totalScore = updates.totalScore;
      if (updates.highestStreak !== undefined) current.highestStreak = updates.highestStreak;
      this.saveLocalProfile(current);
      return this.syncStudentProfile(current);
    }
    throw new Error('Student profile not found');
  },

  async deleteStudentProfile(id: string): Promise<boolean> {
    const current = this.getLocalProfile(id);
    if (current && current.id === id) {
      localStorage.removeItem(studentStorageKey(id));
      localStorage.removeItem('denti_rhythm_student');
    }

    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_student_ids') || '[]');
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('deleted_student_ids', JSON.stringify(deletedIds));
      }
    } catch {
      // ignore
    }

    return true;
  },

  async fetchLeaderboard(_classCode = 'ALL', currentStudent?: StudentProfile | null): Promise<LeaderboardEntry[]> {
    const activeStudent = currentStudent || this.getLocalProfile();

    // If the student has local points, make sure they are posted to the cloud leaderboard first
    if (activeStudent && (Number(activeStudent.totalScore) || 0) > 0) {
      try {
        await submitRhythmRockstarsScore({
          studentId: activeStudent.id,
          name: activeStudent.name,
          avatar: activeStudent.avatar || '🎸',
          classCode: activeStudent.classCode || 'Classroom',
          pointsEarned: 0,
          totalScore: activeStudent.totalScore,
          streak: activeStudent.highestStreak || 0,
          highestStreak: activeStudent.highestStreak || 0,
          quizzesCompleted: activeStudent.quizzesCompleted || 0,
          levelProgress: activeStudent.levelProgress,
          badges: activeStudent.badges,
        });
      } catch {
        // ignore if offline
      }
    }

    let cloudList: LeaderboardEntry[] = [];
    try {
      const { leaderboard } = await fetchRhythmRockstarsLeaderboard(activeStudent?.id);
      if (Array.isArray(leaderboard)) {
        cloudList = leaderboard;
      }
    } catch (err) {
      console.warn('Leaderboard fetch failed, using local + fallback entries:', err);
    }

    // Merge default entries, cloud entries, and the active student's profile (so logged-in students with >0 pts always see themselves)
    const map = new Map<string, LeaderboardEntry>();
    const combined: LeaderboardEntry[] = [...DEFAULT_FALLBACK_ENTRIES, ...cloudList];
    if (activeStudent && (Number(activeStudent.totalScore) || 0) > 0) {
      combined.push(profileToLeaderboardEntry(activeStudent));
    }

    for (const entry of combined) {
      const key = entry.id || normalizeStudentName(entry.name || '');
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || (Number(entry.totalScore) || 0) >= (Number(prev.totalScore) || 0)) {
        map.set(key, {
          ...prev,
          ...entry,
          totalScore: Math.max(Number(prev?.totalScore) || 0, Number(entry.totalScore) || 0),
          highestLevel: Math.max(Number(prev?.highestLevel) || 1, Number(entry.highestLevel) || 1),
          highestStreak: Math.max(Number(prev?.highestStreak) || 0, Number(entry.highestStreak) || 0),
          quizzesCompleted: Math.max(Number(prev?.quizzesCompleted) || 0, Number(entry.quizzesCompleted) || 0),
          starsCount: Math.max(Number(prev?.starsCount) || 0, Number(entry.starsCount) || 0),
          badgesCount: Math.max(Number(prev?.badgesCount) || 1, Number(entry.badgesCount) || 1),
        });
      }
    }

    let list = Array.from(map.values());

    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_student_ids') || '[]');
      list = list.filter((item) => !deletedIds.includes(item.id));
    } catch {
      // ignore
    }

    list.sort((a, b) => (Number(b.totalScore) || 0) - (Number(a.totalScore) || 0));

    return list.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  },
};
