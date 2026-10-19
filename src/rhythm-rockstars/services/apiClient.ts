import { StudentProfile, LeaderboardEntry } from '../types/game';
import { containsInappropriateLanguage, PROFANITY_WARNING_MESSAGE } from '../utils/profanityFilter';

const LOCAL_STORAGE_KEY = 'denti_rhythm_student_session';

export const apiClient = {
  // Local storage session helpers
  getLocalProfile(): StudentProfile | null {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) return JSON.parse(data);
    } catch {
      // ignore
    }
    return null;
  },

  saveLocalProfile(profile: StudentProfile) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(profile));
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

  // Remote Backend Calls
  async loginStudent(name: string, passcode = '1234', avatar = '🎸', classCode = 'ROOM-101'): Promise<StudentProfile> {
    const cleanName = (name || '').trim();
    if (containsInappropriateLanguage(cleanName)) {
      throw new Error(PROFANITY_WARNING_MESSAGE);
    }

    try {
      const res = await fetch('/api/students/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, passcode, avatar, classCode })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Login failed');
      }
      const data = await res.json();
      this.saveLocalProfile(data.student);
      return data.student;
    } catch (err: unknown) {
      if (err instanceof Error && err.message && !err.message.includes('Failed to fetch')) {
        throw err;
      }
      console.warn('Backend login unavailable, fallback to local session:', err);
      // Fallback local profile
      const local = this.getLocalProfile();
      if (local && local.name.toLowerCase() === cleanName.toLowerCase()) {
        return local;
      }
      const fallbackProfile: StudentProfile = {
        id: 'local_' + Date.now().toString(36),
        name: cleanName,
        avatar: avatar || '🎸',
        passcode: passcode || '1234',
        classCode: classCode || 'ROOM-101',
        totalScore: 0,
        highestStreak: 0,
        quizzesCompleted: 0,
        levelProgress: {},
        badges: [],
        updatedAt: new Date().toISOString()
      };
      this.saveLocalProfile(fallbackProfile);
      return fallbackProfile;
    }
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
    try {
      const res = await fetch('/api/students/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.student) {
          this.saveLocalProfile(data.student);
          return data.student;
        }
      }
    } catch (err) {
      console.warn('Backend score update failed, updating local profile:', err);
    }

    // Local fallback update
    const current = this.getLocalProfile();
    if (current && current.id === payload.studentId) {
      current.totalScore += payload.pointsEarned;
      if (payload.streak > current.highestStreak) {
        current.highestStreak = payload.streak;
      }
      current.quizzesCompleted += 1;
      const prevLvl = current.levelProgress[payload.level] || { stars: 0, highAccuracy: 0 };
      current.levelProgress[payload.level] = {
        stars: Math.max(prevLvl.stars, payload.stars),
        highAccuracy: Math.max(prevLvl.highAccuracy, payload.accuracy)
      };
      if (payload.newBadges) {
        payload.newBadges.forEach(b => {
          if (!current.badges.includes(b)) current.badges.push(b);
        });
      }
      this.saveLocalProfile(current);
      return current;
    }
    return null;
  },

  async updateStudentProfile(id: string, updates: Partial<StudentProfile>): Promise<StudentProfile> {
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Update failed');
      }
      const data = await res.json();
      this.saveLocalProfile(data.student);
      return data.student;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      // Local fallback
      const current = this.getLocalProfile();
      if (current && current.id === id) {
        if (updates.name) current.name = updates.name;
        if (updates.avatar) current.avatar = updates.avatar;
        if (updates.passcode) current.passcode = updates.passcode;
        if (updates.classCode) current.classCode = updates.classCode;
        if (updates.totalScore !== undefined) current.totalScore = updates.totalScore;
        if (updates.highestStreak !== undefined) current.highestStreak = updates.highestStreak;
        this.saveLocalProfile(current);
        return current;
      }
      throw new Error(message);
    }
  },

  async deleteStudentProfile(id: string): Promise<boolean> {
    try {
      await fetch(`/api/students/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn('Server delete request error:', err);
    }

    const current = this.getLocalProfile();
    if (current && current.id === id) {
      localStorage.removeItem('denti_rhythm_student');
    }

    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_student_ids') || '[]');
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('deleted_student_ids', JSON.stringify(deletedIds));
      }
    } catch (e) {
      // ignore
    }

    return true;
  },


  async fetchLeaderboard(classCode = 'ALL'): Promise<LeaderboardEntry[]> {
    let list: LeaderboardEntry[] = [];
    try {
      const res = await fetch(`/api/leaderboard?classCode=${encodeURIComponent(classCode)}`);
      if (res.ok) {
        const data = await res.json();
        list = data.leaderboard || [];
      }
    } catch (err) {
      console.warn('Leaderboard fetch failed, using fallback mock entries:', err);
    }

    if (list.length === 0) {
      // Fallback entries if offline
      list = [
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
          starsCount: 18
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
          starsCount: 14
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
          starsCount: 10
        }
      ];
    }

    try {
      const deletedIds = JSON.parse(localStorage.getItem('deleted_student_ids') || '[]');
      list = list.filter(item => !deletedIds.includes(item.id));
    } catch (e) {
      // ignore
    }

    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }
};
