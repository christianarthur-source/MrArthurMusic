import React, { useEffect, useState } from 'react';
import { Cloud, LogOut, Users, Link2, Copy, History, MessageSquare, Check, Trash2, Plus, KeyRound } from 'lucide-react';
import { Dialog } from './Dialogs';
import * as C from '../io/cloud';

// ---------- sign in / account ----------

export function AccountDialog({ user, classes, onAuth, onLogout, onOpen, onClose }: {
  user: C.WolfiUser | null;
  classes: C.WolfiClass[];
  onAuth: (user: C.WolfiUser, classes: C.WolfiClass[]) => void;
  onLogout: () => void;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  if (!user) return <SignIn onAuth={onAuth} onClose={onClose} />;
  return <Account user={user} classes={classes} onLogout={onLogout} onOpen={onOpen} onClose={onClose} onAuth={onAuth} />;
}

function SignIn({ onAuth, onClose }: { onAuth: (u: C.WolfiUser, c: C.WolfiClass[]) => void; onClose: () => void }) {
  const [mode, setMode] = useState<'login' | 'student' | 'teacher'>('login');
  const [f, setF] = useState({ username: '', password: '', displayName: '', classCode: '', teacherKey: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = mode === 'login'
        ? await C.login(f.username.trim(), f.password)
        : await C.signup({ username: f.username.trim(), password: f.password, displayName: f.displayName.trim() || undefined, classCode: mode === 'student' ? f.classCode.trim() : undefined, teacherKey: mode === 'teacher' ? f.teacherKey : undefined });
      onAuth(r.user, r.classes);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title={mode === 'login' ? 'Sign in to Wolfi' : mode === 'student' ? 'Create a student account' : 'Create a teacher account'}
      subtitle="Save scores online and open them on any computer. No email needed." onClose={onClose} size="small"
      footer={<>
        <button className="ps-btn ps-outline" onClick={onClose}>Cancel</button>
        <button className="ps-btn ps-primary" disabled={busy || !f.username || f.password.length < (mode === 'login' ? 1 : 8) || (mode === 'student' && !f.classCode) || (mode === 'teacher' && !f.teacherKey)} onClick={go}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); void go(); }}>
        <div className="ps-field"><label>Username</label><input className="ps-input" autoComplete="username" value={f.username} onChange={set('username')} placeholder="letters, numbers, . _ -" /></div>
        <div className="ps-field"><label>Password</label><input className="ps-input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} placeholder={mode === 'login' ? '' : 'at least 8 characters'} /></div>
        {mode !== 'login' && <div className="ps-field"><label>Display name (optional)</label><input className="ps-input" value={f.displayName} onChange={set('displayName')} placeholder="e.g. Sam R." /></div>}
        {mode === 'student' && <div className="ps-field"><label>Class code from your teacher</label><input className="ps-input" value={f.classCode} onChange={set('classCode')} style={{ textTransform: 'uppercase', letterSpacing: 2 }} /></div>}
        {mode === 'teacher' && <div className="ps-field"><label>Teacher key</label><input className="ps-input" type="password" value={f.teacherKey} onChange={set('teacherKey')} placeholder="the master teacher PIN" /></div>}
        <button type="submit" hidden />
      </form>
      {err && <p className="ps-error">{err}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, fontSize: 12 }}>
        {mode !== 'login' && <button className="ps-link" onClick={() => setMode('login')}>I have an account</button>}
        {mode !== 'student' && <button className="ps-link" onClick={() => setMode('student')}>New student (needs a class code)</button>}
        {mode !== 'teacher' && <button className="ps-link" onClick={() => setMode('teacher')}>New teacher</button>}
      </div>
    </Dialog>
  );
}

function Account({ user, classes, onLogout, onOpen, onClose, onAuth }: {
  user: C.WolfiUser; classes: C.WolfiClass[]; onLogout: () => void; onOpen: (id: string) => void; onClose: () => void; onAuth: (u: C.WolfiUser, c: C.WolfiClass[]) => void;
}) {
  const [tab, setTab] = useState<'scores' | 'classes' | 'account'>('scores');
  const [scores, setScores] = useState<C.CloudScoreSummary[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    C.listScores().then((r) => setScores(r.scores)).catch((e) => setErr(e.message));
  }, []);
  return (
    <Dialog title={user.displayName || user.username} subtitle={`${user.role === 'teacher' ? 'Teacher' : 'Student'} · @${user.username}`} onClose={onClose} size="medium"
      footer={<button className="ps-btn ps-outline" onClick={onLogout}><LogOut size={15} /> Sign out</button>}>
      <div className="ps-tabs">
        <button className={tab === 'scores' ? 'ps-on' : ''} onClick={() => setTab('scores')}><Cloud size={14} /> Online scores</button>
        <button className={tab === 'classes' ? 'ps-on' : ''} onClick={() => setTab('classes')}><Users size={14} /> {user.role === 'teacher' ? 'My classes' : 'Classes'}</button>
        <button className={tab === 'account' ? 'ps-on' : ''} onClick={() => setTab('account')}><KeyRound size={14} /> Password</button>
      </div>
      {err && <p className="ps-error">{err}</p>}
      {tab === 'scores' && <ScoreTable scores={scores} onOpen={onOpen} onDeleted={(id) => setScores((s) => s?.filter((x) => x.id !== id) || null)} />}
      {tab === 'classes' && (user.role === 'teacher' ? <TeacherClasses onOpen={onOpen} /> : <StudentClasses classes={classes} onJoined={(c) => onAuth(user, c)} />)}
      {tab === 'account' && <ChangePassword />}
    </Dialog>
  );
}

function ScoreTable({ scores, onOpen, onDeleted }: { scores: C.CloudScoreSummary[] | null; onOpen: (id: string) => void; onDeleted?: (id: string) => void }) {
  if (!scores) return <p style={{ color: 'var(--ps-muted)' }}>Loading…</p>;
  if (!scores.length) return <p style={{ color: 'var(--ps-muted)' }}>No online scores yet. Your open score is saved here automatically while you're signed in.</p>;
  return (
    <table className="ps-table">
      <tbody>
        {scores.map((s) => (
          <tr key={s.id}>
            <td><b>{s.title || 'Untitled'}</b>{s.composer && <span style={{ color: 'var(--ps-muted)' }}> — {s.composer}</span>}{s.shared && <small style={{ color: 'var(--ps-accent)', marginLeft: 8 }}>shared by {s.ownerName}</small>}</td>
            <td style={{ color: 'var(--ps-muted)', whiteSpace: 'nowrap' }}>{new Date(s.updatedAt).toLocaleString()}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className="ps-btn ps-outline" onClick={() => onOpen(s.id)}>Open</button>
              {onDeleted && !s.shared && <button className="ps-btn ps-danger" aria-label="Delete" onClick={async () => { if (confirm(`Delete “${s.title}” from your online scores? This cannot be undone.`)) { await C.deleteScore(s.id); onDeleted(s.id); } }}><Trash2 size={15} /></button>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StudentClasses({ classes, onJoined }: { classes: C.WolfiClass[]; onJoined: (c: C.WolfiClass[]) => void }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  return (
    <div>
      {classes.map((c) => <p key={c.id}><b>{c.name}</b> <span style={{ color: 'var(--ps-muted)' }}>— {c.teacherName}</span></p>)}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input className="ps-input" placeholder="Join another class: code" value={code} onChange={(e) => setCode(e.target.value)} style={{ textTransform: 'uppercase' }} />
        <button className="ps-btn ps-primary" disabled={!code} onClick={async () => { try { const r = await C.classJoin(code); onJoined(r.classes); setCode(''); setErr(''); } catch (e) { setErr((e as Error).message); } }}>Join</button>
      </div>
      {err && <p className="ps-error">{err}</p>}
    </div>
  );
}

function TeacherClasses({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<(C.WolfiClass & { members: C.Member[] })[] | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [student, setStudent] = useState<C.Member | null>(null);
  const [studentScores, setStudentScores] = useState<C.CloudScoreSummary[] | null>(null);
  const load = () => C.classList().then((r) => setData(r.classes)).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
  }, []);
  if (student) {
    return (
      <div>
        <button className="ps-link" onClick={() => { setStudent(null); setStudentScores(null); }}>← All classes</button>
        <h3 style={{ margin: '8px 0' }}>{student.displayName || student.username}</h3>
        <ScoreTable scores={studentScores} onOpen={onOpen} />
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="ps-input" placeholder="New class name, e.g. Music Theory P3" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="ps-btn ps-primary" disabled={!name.trim()} onClick={async () => { try { await C.classCreate(name.trim()); setName(''); await load(); } catch (e) { setErr((e as Error).message); } }}><Plus size={15} /> Create</button>
      </div>
      {err && <p className="ps-error">{err}</p>}
      {!data && <p style={{ color: 'var(--ps-muted)' }}>Loading…</p>}
      {data?.map((c) => (
        <div key={c.id} className="ps-class">
          <div className="ps-class-head"><b>{c.name}</b><span>Class code <code>{c.code}</code></span></div>
          {!c.members.length && <small style={{ color: 'var(--ps-muted)' }}>No students yet. Students join with the class code when they create an account.</small>}
          <table className="ps-table">
            <tbody>
              {c.members.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.displayName || m.username}</b> <small style={{ color: 'var(--ps-muted)' }}>@{m.username}</small></td>
                  <td style={{ color: 'var(--ps-muted)' }}>{m.scoreCount} score{m.scoreCount === 1 ? '' : 's'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="ps-btn ps-outline" onClick={async () => { setStudent(m); setStudentScores((await C.listScores(m.id)).scores); }}>Scores</button>
                    <button className="ps-btn" title="Reset password" onClick={async () => { const p = prompt(`New password for ${m.username} (at least 8 characters):`); if (p) { try { await C.resetPassword(m.id, p); alert('Password changed.'); } catch (e) { alert((e as Error).message); } } }}><KeyRound size={15} /></button>
                    <button className="ps-btn ps-danger" title="Remove from class" onClick={async () => { if (confirm(`Remove ${m.username} from ${c.name}?`)) { await C.removeMember(c.id, m.id); await load(); } }}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function ChangePassword() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <div>
      <div className="ps-field"><label>Current password</label><input className="ps-input" type="password" value={a} onChange={(e) => setA(e.target.value)} /></div>
      <div className="ps-field"><label>New password</label><input className="ps-input" type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder="at least 8 characters" /></div>
      <button className="ps-btn ps-primary" disabled={!a || b.length < 8} onClick={async () => { try { await C.changePassword(a, b); setMsg('Password changed.'); setA(''); setB(''); } catch (e) { setMsg((e as Error).message); } }}>Change password</button>
      {msg && <p style={{ color: 'var(--ps-muted)' }}>{msg}</p>}
    </div>
  );
}

// ---------- share ----------

export function ShareDialog({ score, onClose, onChanged }: { score: C.CloudScore; onClose: () => void; onChanged: (s: Partial<C.CloudScore>) => void }) {
  const [token, setToken] = useState(score.shareToken);
  const [names, setNames] = useState(score.collaborators.join(', '));
  const [msg, setMsg] = useState('');
  const link = token ? `${location.hostname.endsWith('.workers.dev') ? 'https://mrarthurmusic.com' : location.origin}/wolfie?share=${token}` : '';
  return (
    <Dialog title="Share" subtitle={score.title} onClose={onClose} size="small" footer={<button className="ps-btn ps-primary" onClick={onClose}>Done</button>}>
      <div className="ps-label" style={{ marginBottom: 6 }}><Link2 size={13} /> View-only link</div>
      {token ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="ps-input" readOnly value={link} onFocus={(e) => e.target.select()} />
          <button className="ps-btn ps-outline" onClick={() => { void navigator.clipboard?.writeText(link); setMsg('Link copied.'); }}><Copy size={15} /></button>
          <button className="ps-btn ps-danger" onClick={async () => { const r = await C.shareLink(score.id, false); setToken(r.shareToken); onChanged({ shareToken: null }); }}>Turn off</button>
        </div>
      ) : (
        <button className="ps-btn ps-outline" onClick={async () => { const r = await C.shareLink(score.id, true); setToken(r.shareToken); onChanged({ shareToken: r.shareToken }); }}>Create a view-only link</button>
      )}
      <p style={{ color: 'var(--ps-muted)', fontSize: 12 }}>Anyone with the link can view and play the score (not edit it).</p>
      <div className="ps-label" style={{ margin: '14px 0 6px' }}><Users size={13} /> Edit together</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="ps-input" placeholder="classmates' usernames, separated by commas" value={names} onChange={(e) => setNames(e.target.value)} />
        <button className="ps-btn ps-outline" onClick={async () => {
          try {
            const r = await C.setCollaborators(score.id, names.split(/[\s,]+/).map((x) => x.trim().replace(/^@/, '')).filter(Boolean));
            onChanged({ collaborators: r.collaborators });
            setNames(r.collaborators.join(', '));
            setMsg(r.skipped?.length ? `Not added (not in a class with you): ${r.skipped.join(', ')}` : 'Saved. They will see it in their online scores.');
          } catch (e) {
            setMsg((e as Error).message);
          }
        }}>Save</button>
      </div>
      <p style={{ color: 'var(--ps-muted)', fontSize: 12 }}>Collaborators can open and edit this score. If two people save at the same time, Wolfi asks which version to keep.</p>
      {msg && <p style={{ color: 'var(--ps-accent-2)' }}>{msg}</p>}
    </Dialog>
  );
}

// ---------- version history ----------

export function VersionsDialog({ scoreId, onRestore, onClose }: { scoreId: string; onRestore: (mei: string, label: string) => void; onClose: () => void }) {
  const [list, setList] = useState<{ n: number; savedAt: string; savedBy: string; size: number }[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    C.versions(scoreId).then((r) => setList([...r.versions].sort((a, b) => b.n - a.n))).catch((e) => setErr(e.message));
  }, [scoreId]);
  return (
    <Dialog title="Version history" subtitle="Snapshots are kept automatically every 10 minutes of editing (last 30)." onClose={onClose} size="small">
      {err && <p className="ps-error">{err}</p>}
      {!list && !err && <p style={{ color: 'var(--ps-muted)' }}>Loading…</p>}
      {list && !list.length && <p style={{ color: 'var(--ps-muted)' }}>No snapshots yet.</p>}
      <table className="ps-table">
        <tbody>
          {list?.map((v) => (
            <tr key={v.n}>
              <td><History size={14} style={{ verticalAlign: -2, marginRight: 6, color: 'var(--ps-accent)' }} />{new Date(v.savedAt).toLocaleString()}</td>
              <td style={{ color: 'var(--ps-muted)' }}>{v.savedBy}</td>
              <td style={{ textAlign: 'right' }}><button className="ps-btn ps-outline" onClick={async () => onRestore(await C.versionMei(scoreId, v.n), new Date(v.savedAt).toLocaleString())}>Restore</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

// ---------- comments ----------

export function CommentsPanel({ scoreId, user, measureLabel, onJump, onClose }: {
  scoreId: string; user: C.WolfiUser; measureLabel: string | null; onJump: (measure: string) => void; onClose: () => void;
}) {
  const [list, setList] = useState<C.Comment[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const load = () => C.comments(scoreId).then(setList).catch((e) => setErr(e.message));
  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [scoreId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <aside className="ps-comments" aria-label="Comments">
      <header><MessageSquare size={15} /> <b>Comments</b><span style={{ flex: 1 }} /><button className="ps-btn" onClick={onClose} aria-label="Close comments">×</button></header>
      <div className="ps-comments-list">
        {err && <p className="ps-error">{err}</p>}
        {list && !list.length && <p style={{ color: 'var(--ps-muted)' }}>No comments yet.</p>}
        {list?.map((c) => (
          <div key={c.id} className={`ps-comment${c.resolved ? ' ps-resolved' : ''}`}>
            <div className="ps-comment-head">
              <b>{c.authorName}</b>{c.authorRole === 'teacher' && <small className="ps-badge">teacher</small>}
              <button className="ps-link" onClick={() => onJump(c.measure)}>m. {c.measure}</button>
            </div>
            <p>{c.text}</p>
            <div className="ps-comment-actions">
              <button className="ps-link" onClick={async () => { await C.resolveComment(c.id, !c.resolved); void load(); }}><Check size={12} /> {c.resolved ? 'Reopen' : 'Resolve'}</button>
              <button className="ps-link" onClick={async () => { await C.deleteComment(c.id); void load(); }}><Trash2 size={12} /> Delete</button>
            </div>
          </div>
        ))}
      </div>
      <footer>
        <textarea className="ps-input" rows={3} placeholder={measureLabel ? `Comment on measure ${measureLabel}…` : 'Select a measure or note, then write a comment'} value={text} onChange={(e) => setText(e.target.value)} disabled={!measureLabel} />
        <button className="ps-btn ps-primary" disabled={!text.trim() || !measureLabel} onClick={async () => {
          try {
            await C.addComment(scoreId, measureLabel!, text.trim());
            setText('');
            void load();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}>Post as {user.displayName || user.username}</button>
      </footer>
    </aside>
  );
}
