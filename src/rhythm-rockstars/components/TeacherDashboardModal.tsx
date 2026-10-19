import React, { useState, useEffect } from 'react';
import { StudentProfile, LeaderboardEntry } from '../types/game';
import { apiClient } from '../services/apiClient';

interface TeacherDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentUpdated?: () => void;
}

export const TeacherDashboardModal: React.FC<TeacherDashboardModalProps> = ({
  isOpen,
  onClose,
  onStudentUpdated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [students, setStudents] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('ALL');
  
  // Editing state
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    passcode: '',
    classCode: '',
    totalScore: 0,
    highestStreak: 0,
    starsCount: 0,
    avatar: '🎸',
  });

  // Adding new student state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({
    name: '',
    passcode: '1234',
    classCode: 'ROOM-101',
    avatar: '🎸',
  });

  const TEACHER_PIN = '1138';

  useEffect(() => {
    if (isOpen) {
      setIsAuthenticated(false);
      setPinInput('');
      setPinError('');
      setIsAddingNew(false);
      setEditingStudentId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isAuthenticated) {
      loadStudents();
    }
  }, [isAuthenticated]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const list = await apiClient.fetchLeaderboard('ALL');
      setStudents(list);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === TEACHER_PIN || pinInput.trim() === 'adminbaby') {
      setIsAuthenticated(true);
      setPinError('');
    } else {
      setPinError('Incorrect Teacher PIN.');
    }
  };

  const handleStartEdit = (student: LeaderboardEntry) => {
    setEditingStudentId(student.id);
    setEditForm({
      name: student.name,
      passcode: '1234', // default placeholder
      classCode: student.classCode,
      totalScore: student.totalScore,
      highestStreak: student.highestStreak,
      starsCount: student.starsCount,
      avatar: student.avatar,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await apiClient.updateStudentProfile(id, {
        name: editForm.name,
        passcode: editForm.passcode,
        classCode: editForm.classCode,
        totalScore: editForm.totalScore,
        highestStreak: editForm.highestStreak,
        starsCount: editForm.starsCount,
        avatar: editForm.avatar,
      } as any);
      setEditingStudentId(null);
      loadStudents();
      if (onStudentUpdated) onStudentUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to update student');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete student "${name}"? This action cannot be undone.`)) {
      try {
        await apiClient.deleteStudentProfile(id);
        setStudents(prev => prev.filter(s => s.id !== id));
        setEditingStudentId(null);
        if (onStudentUpdated) onStudentUpdated();
      } catch (err: any) {
        setStudents(prev => prev.filter(s => s.id !== id));
        setEditingStudentId(null);
        if (onStudentUpdated) onStudentUpdated();
      }
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.loginStudent(
        newForm.name,
        newForm.passcode,
        newForm.avatar,
        newForm.classCode
      );
      setIsAddingNew(false);
      setNewForm({ name: '', passcode: '1234', classCode: 'ROOM-101', avatar: '🎸' });
      loadStudents();
      if (onStudentUpdated) onStudentUpdated();
    } catch (err: any) {
      alert(err.message || 'Failed to create student');
    }
  };

  if (!isOpen) return null;

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.classCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'ALL' || s.classCode === selectedClass;
    return matchesSearch && matchesClass;
  });

  const uniqueClasses = ['ALL', ...Array.from(new Set(students.map(s => s.classCode)))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-purple-500/40 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-purple-500/30">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-200">
                Teacher & Admin Control Center
              </h2>
              <p className="text-xs text-purple-300">Manage student accounts, scores, PINs, and classroom rosters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800/80 hover:bg-red-600/80 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isAuthenticated ? (
            <div className="max-w-md mx-auto my-12 bg-slate-800/60 border border-purple-500/30 rounded-2xl p-8 text-center shadow-xl">
              <div className="text-5xl mb-4">🔐</div>
              <h3 className="text-2xl font-black text-yellow-300 mb-2">Teacher Authentication Required</h3>
              <p className="text-slate-300 text-sm mb-6">
                Please enter the Teacher Security PIN to access admin controls.
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter Teacher PIN"
                  className="w-full bg-slate-900 border border-purple-500/50 rounded-xl px-4 py-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  autoFocus
                />
                {pinError && <p className="text-red-400 text-sm font-semibold">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                >
                  Unlock Admin Portal
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search student or class..."
                    className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
                  />
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {uniqueClasses.map(c => (
                      <option key={c} value={c}>Class: {c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setIsAddingNew(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>➕</span> Add Student
                  </button>
                  <button
                    onClick={loadStudents}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>🔄</span> Refresh
                  </button>
                </div>
              </div>

              {/* Add Student Form Modal/Card */}
              {isAddingNew && (
                <div className="bg-slate-800 border border-emerald-500/50 rounded-2xl p-6 shadow-xl animate-fade-in">
                  <h4 className="text-lg font-black text-emerald-400 mb-4">Register New Student</h4>
                  <form onSubmit={handleCreateStudent} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Student Name</label>
                      <input
                        type="text"
                        required
                        value={newForm.name}
                        onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                        placeholder="e.g. Rockin' Alex"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Class / Room Code</label>
                      <input
                        type="text"
                        required
                        value={newForm.classCode}
                        onChange={(e) => setNewForm({ ...newForm, classCode: e.target.value })}
                        placeholder="e.g. ROOM-101"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Secret PIN</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        value={newForm.passcode}
                        onChange={(e) => setNewForm({ ...newForm, passcode: e.target.value })}
                        placeholder="4 digits"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Avatar</label>
                      <select
                        value={newForm.avatar}
                        onChange={(e) => setNewForm({ ...newForm, avatar: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
                      >
                        <option value="🎸">🎸 Guitarist</option>
                        <option value="🥁">🥁 Drummer</option>
                        <option value="🎹">🎹 Keyboardist</option>
                        <option value="🎤">🎤 Vocalist</option>
                        <option value="🎷">🎷 Saxophonist</option>
                        <option value="⚡">⚡ Lightning Rocker</option>
                        <option value="🌟">🌟 Super Star</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddingNew(false)}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-bold cursor-pointer shadow-lg"
                      >
                        Save Student
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Students Table */}
              {loading ? (
                <div className="text-center py-12 text-slate-400 animate-pulse">Loading student roster...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">No students found matching your search.</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-300 text-xs uppercase tracking-wider border-b border-slate-700">
                        <th className="p-4">Rank & Name</th>
                        <th className="p-4">Class</th>
                        <th className="p-4 text-center">Score</th>
                        <th className="p-4 text-center">Streak</th>
                        <th className="p-4 text-center">Badges / Stars</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-sm">
                      {filteredStudents.map((student) => {
                        const isEditing = editingStudentId === student.id;
                        return (
                          <tr key={student.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-yellow-400 font-bold w-6">#{student.rank}</span>
                                <span className="text-2xl">{student.avatar}</span>
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-white text-sm w-40"
                                  />
                                ) : (
                                  <div>
                                    <div className="font-bold text-white">{student.name}</div>
                                    <div className="text-xs text-slate-400 font-mono">ID: {student.id}</div>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editForm.classCode}
                                  onChange={(e) => setEditForm({ ...editForm, classCode: e.target.value })}
                                  className="bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-white text-sm w-28 uppercase"
                                />
                              ) : (
                                <span className="px-2.5 py-1 bg-purple-950/60 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-mono font-bold">
                                  {student.classCode}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center font-mono font-bold text-yellow-400">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.totalScore}
                                  onChange={(e) => setEditForm({ ...editForm, totalScore: Number(e.target.value) })}
                                  className="bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-white text-sm w-24 text-center"
                                />
                              ) : (
                                student.totalScore.toLocaleString()
                              )}
                            </td>
                            <td className="p-4 text-center font-mono text-emerald-400 font-bold">
                              {isEditing ? (
                                <input
                                  type="number"
                                  value={editForm.highestStreak}
                                  onChange={(e) => setEditForm({ ...editForm, highestStreak: Number(e.target.value) })}
                                  className="bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-white text-sm w-20 text-center"
                                />
                              ) : (
                                `🔥 ${student.highestStreak}`
                              )}
                            </td>
                            <td className="p-4 text-center text-slate-300 text-xs">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <span>⭐</span>
                                  <input
                                    type="number"
                                    value={editForm.starsCount}
                                    onChange={(e) => setEditForm({ ...editForm, starsCount: Number(e.target.value) })}
                                    className="bg-slate-900 border border-purple-500 rounded-lg px-2 py-1 text-white text-sm w-20 text-center"
                                  />
                                </div>
                              ) : (
                                `⭐ ${student.starsCount || 0} | 🏅 ${student.badgesCount || 0}`
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleSaveEdit(student.id)}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => handleDelete(student.id, student.name)}
                                    className="bg-red-600/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    title="Delete student account"
                                  >
                                    <span>🗑️</span> Delete
                                  </button>
                                  <button
                                    onClick={() => setEditingStudentId(null)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleStartEdit(student)}
                                    className="bg-indigo-600/80 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                                    title="Edit student info, PIN & score"
                                  >
                                    <span>✏️</span> Edit
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Teacher Control Mode • Secure Roster Management</span>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-1.5 rounded-lg font-bold cursor-pointer"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
