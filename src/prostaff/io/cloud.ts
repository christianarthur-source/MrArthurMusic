// Client for Wolfi accounts and online scores (POST /api/wolfi, Cloudflare D1). Separate from the K-6
// classroom logins. The session token is kept in this browser only.

export interface WolfiUser {
  id: string;
  username: string;
  displayName: string;
  role: 'student' | 'teacher';
}
export interface WolfiClass {
  id: string;
  name: string;
  code: string;
  teacherName?: string;
}
export interface CloudScoreSummary {
  id: string;
  title: string;
  composer: string;
  updatedAt: string;
  version: number;
  ownerId: string;
  ownerName: string;
  shared: boolean;
  canEdit: boolean;
}
export interface CloudScore extends CloudScoreSummary {
  mei: string;
  shareToken: string | null;
  collaborators: string[];
}
export interface Member {
  id: string;
  username: string;
  displayName: string;
  scoreCount: number;
  lastActive: string | null;
}
export interface Comment {
  id: string;
  authorName: string;
  authorRole: string;
  measure: string;
  staff: string | null;
  text: string;
  createdAt: string;
  resolved: boolean;
}

const KEY = 'wolfi:token';

export class CloudError extends Error {
  constructor(message: string, public status: number, public data: any) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(KEY, t);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function api<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch('/api/wolfi', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new CloudError('No connection to the server. Your work is still saved in this browser.', 0, null);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    throw new CloudError(res.status === 404 ? 'Online saving works on the live site (mrarthurmusic.com).' : `Server error (${res.status}).`, res.status, null);
  }
  if (!res.ok || data?.ok === false) {
    if (res.status === 401 && token && action !== 'login' && action !== 'signup') setToken(null);
    throw new CloudError(data?.error || `Server error (${res.status}).`, res.status, data);
  }
  return data as T;
}

export async function signup(f: { username: string; password: string; displayName?: string; classCode?: string; teacherKey?: string }) {
  const r = await api<{ token: string; user: WolfiUser; classes: WolfiClass[] }>('signup', f);
  setToken(r.token);
  return r;
}
export async function login(username: string, password: string) {
  const r = await api<{ token: string; user: WolfiUser; classes: WolfiClass[] }>('login', { username, password });
  setToken(r.token);
  return r;
}
export async function logout() {
  try {
    await api('logout');
  } finally {
    setToken(null);
  }
}
export const me = () => api<{ user: WolfiUser; classes: WolfiClass[] }>('me');
export const listScores = (userId?: string) => api<{ scores: CloudScoreSummary[] }>('score_list', userId ? { userId } : {});
export const getScore = (id: string) => api<{ score: CloudScore }>('score_get', { id }).then((r) => r.score);
export const saveScore = (s: { id?: string; title: string; composer: string; mei: string; baseVersion?: number }) => api<{ id: string; version: number; updatedAt: string }>('score_save', s);
export const deleteScore = (id: string) => api('score_delete', { id });
export const versions = (id: string) => api<{ versions: { n: number; savedAt: string; savedBy: string; size: number }[] }>('score_versions', { id });
export const versionMei = (id: string, n: number) => api<{ mei: string }>('score_version_get', { id, n }).then((r) => r.mei);
export const shareLink = (id: string, enabled: boolean) => api<{ shareToken: string | null }>('score_share_link', { id, enabled });
export const sharedGet = (shareToken: string) => api<{ title: string; composer: string; mei: string; ownerName: string }>('shared_get', { shareToken });
export const setCollaborators = (id: string, usernames: string[]) => api<{ collaborators: string[]; skipped?: string[] }>('score_collaborators', { id, usernames });
export const comments = (scoreId: string) => api<{ comments: Comment[] }>('comments_list', { scoreId }).then((r) => r.comments);
export const addComment = (scoreId: string, measure: string, text: string, staff?: string) => api<{ comment: Comment }>('comment_add', { scoreId, measure, text, staff });
export const resolveComment = (id: string, resolved: boolean) => api('comment_resolve', { id, resolved });
export const deleteComment = (id: string) => api('comment_delete', { id });
export const classList = () => api<{ classes: (WolfiClass & { members: Member[] })[] }>('class_list');
export const classCreate = (name: string) => api<{ class: WolfiClass }>('class_create', { name });
export const classJoin = (code: string) => api<{ classes: WolfiClass[] }>('class_join', { code });
export const removeMember = (classId: string, userId: string) => api('class_remove_member', { classId, userId });
export const resetPassword = (userId: string, newPassword: string) => api('teacher_reset_password', { userId, newPassword });
export const changePassword = (oldPassword: string, newPassword: string) => api('change_password', { oldPassword, newPassword });
