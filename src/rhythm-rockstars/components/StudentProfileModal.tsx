import React, { useState, useEffect } from 'react';
import { StudentProfile } from '../types/game';
import { apiClient } from '../services/apiClient';
import { ALL_BADGES } from '../data/rhythmCatalog';
import { containsInappropriateLanguage, PROFANITY_WARNING_MESSAGE } from '../utils/profanityFilter';
import { User, KeyRound, Award, Flame, Star, LogOut, Check, X, ShieldAlert, Edit3 } from 'lucide-react';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: StudentProfile | null;
  onLoginSuccess: (student: StudentProfile) => void;
  onLogout: () => void;
}

const AVATAR_CHOICES = ['🎸', '🥁', '🎤', '🎹', '⚡', '🎧', '🎺', '🎷'];

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({
  isOpen,
  onClose,
  student,
  onLoginSuccess,
  onLogout
}) => {
  const [isLoginMode, setIsLoginMode] = useState(!student);
  const [isEditing, setIsEditing] = useState(false);

  const [nameInput, setNameInput] = useState(student?.name || '');
  const [passcodeInput, setPasscodeInput] = useState(student?.passcode || '1234');
  const [selectedAvatar, setSelectedAvatar] = useState(student?.avatar || '🎸');
  const [classCodeInput, setClassCodeInput] = useState(student?.classCode || 'ROOM-101');

  // Edit fields
  const [editName, setEditName] = useState(student?.name || '');
  const [editPasscode, setEditPasscode] = useState(student?.passcode || '1234');
  const [editClassCode, setEditClassCode] = useState(student?.classCode || 'ROOM-101');
  const [editAvatar, setEditAvatar] = useState(student?.avatar || '🎸');
  const [editScore, setEditScore] = useState(student?.totalScore?.toString() || '0');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setNameInput(student.name);
      setPasscodeInput(student.passcode);
      setSelectedAvatar(student.avatar);
      setClassCodeInput(student.classCode);

      setEditName(student.name);
      setEditPasscode(student.passcode);
      setEditClassCode(student.classCode);
      setEditAvatar(student.avatar);
      setEditScore(student.totalScore.toString());
    }
    setIsLoginMode(!student);
    setIsEditing(false);
  }, [student, isOpen]);

  const isNameInappropriate = nameInput.trim() ? containsInappropriateLanguage(nameInput.trim()) : false;
  const isEditNameInappropriate = editName.trim() ? containsInappropriateLanguage(editName.trim()) : false;

  if (!isOpen) return null;

  const handleSaveOrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameInput.trim();
    if (!cleanName) {
      setErrorMessage('Please enter your Rockstar Name!');
      return;
    }

    if (containsInappropriateLanguage(cleanName)) {
      setErrorMessage(PROFANITY_WARNING_MESSAGE);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const loggedIn = await apiClient.loginStudent(
        nameInput.trim(),
        passcodeInput.trim() || '1234',
        selectedAvatar,
        classCodeInput.trim().toUpperCase() || 'ROOM-101'
      );
      onLoginSuccess(loggedIn);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    const cleanName = editName.trim();
    if (!cleanName) {
      setErrorMessage('Name cannot be empty!');
      return;
    }
    if (containsInappropriateLanguage(cleanName)) {
      setErrorMessage(PROFANITY_WARNING_MESSAGE);
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const updated = await apiClient.updateStudentProfile(student.id, {
        name: cleanName,
        passcode: editPasscode.trim() || '1234',
        classCode: editClassCode.trim().toUpperCase() || 'ROOM-101',
        avatar: editAvatar,
        totalScore: parseInt(editScore, 10) || 0
      });
      onLoginSuccess(updated);
      setIsEditing(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalStars = student
    ? Object.values(student.levelProgress).reduce((acc, curr) => acc + curr.stars, 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{student?.avatar || selectedAvatar}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-red-600 text-white font-black text-xs tracking-wider border border-white shadow-sm">
                  DENTI
                </span>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white tracking-tight">
                  {student && !isLoginMode
                    ? isEditing
                      ? 'Edit Rockstar Profile & Score'
                      : 'Rockstar Profile'
                    : 'Chromebook Sign-In'}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {student && !isLoginMode
                  ? isEditing
                    ? 'Update your stage name, passcode PIN, classroom or total score'
                    : 'Your badges, rhythm progress & sync stats'
                  : 'Enter your stage name to sync scores across school devices'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {student && !isLoginMode && !isEditing ? (
            /* Logged-In Student Dashboard */
            <div className="space-y-6">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Profile Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left relative">
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700 shadow"
                  title="Edit name, PIN, score"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile & PIN
                </button>

                <div className="w-20 h-20 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-4xl shadow-lg shrink-0">
                  {student.avatar}
                </div>
                <div className="flex-1 min-w-0 pr-16 sm:pr-0">
                  <h4 className="text-2xl font-display font-black text-white truncate">
                    {student.name}
                  </h4>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-slate-400 mt-1">
                    <span>Class: <strong className="text-slate-200">{student.classCode}</strong></span>
                    <span>·</span>
                    <span>Secret PIN: <strong className="text-slate-200">{student.passcode}</strong></span>
                  </div>

                  <div className="flex items-center justify-center sm:justify-start gap-4 mt-4 pt-3 border-t border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Score</span>
                      <span className="font-mono font-black text-xl text-amber-400 tabular-nums">
                        {student.totalScore.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Best Streak</span>
                      <span className="font-mono font-black text-xl text-rose-400 tabular-nums">
                        {student.highestStreak}x
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Stars Earned</span>
                      <span className="font-mono font-black text-xl text-amber-300 tabular-nums">
                        {totalStars} ⭐
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Badges Collection Showcase */}
              <div>
                <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Rockstar Badges ({student.badges.length} / {ALL_BADGES.length})</span>
                </h5>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {ALL_BADGES.map((b) => {
                    const isUnlocked = student.badges.includes(b.id);
                    return (
                      <div
                        key={b.id}
                        className={`p-3 rounded-2xl border text-center transition-all ${
                          isUnlocked
                            ? 'bg-amber-400/10 border-amber-400/40 text-white'
                            : 'bg-slate-950/40 border-slate-800/60 opacity-40 grayscale'
                        }`}
                      >
                        <span className="text-2xl block mb-1">{b.icon}</span>
                        <span className="font-bold text-xs block leading-tight text-slate-200">
                          {b.title}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1 line-clamp-2">
                          {b.description}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <button
                  onClick={() => setIsLoginMode(true)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Switch Rockstar Profile
                </button>

                <button
                  onClick={onLogout}
                  className="px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : student && !isLoginMode && isEditing ? (
            /* Edit Profile Form */
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Rockstar Stage Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={24}
                    required
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pick Your Band Instrument
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {AVATAR_CHOICES.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setEditAvatar(emoji)}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer ${
                        editAvatar === emoji
                          ? 'bg-amber-400/20 border-amber-400 scale-110 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Secret Passcode PIN
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editPasscode}
                      onChange={(e) => setEditPasscode(e.target.value)}
                      maxLength={8}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Class Room / Period
                  </label>
                  <input
                    type="text"
                    value={editClassCode}
                    onChange={(e) => setEditClassCode(e.target.value)}
                    maxLength={12}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Total Score (Teacher / Override)
                </label>
                <input
                  type="number"
                  value={editScore}
                  onChange={(e) => setEditScore(e.target.value)}
                  min="0"
                  max="99999"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-amber-400 font-mono font-bold focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  You can adjust your score or reset your secret PIN here.
                </span>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || isEditNameInappropriate}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm rounded-xl shadow-lg transition-all cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* Login / Registration Form */
            <form onSubmit={handleSaveOrLogin} className="space-y-5">
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Stage Name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Rockstar Stage Name
                  </label>
                  {isNameInappropriate && (
                    <span className="text-[11px] text-rose-400 font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Name not allowed
                    </span>
                  )}
                </div>
                <div className="relative">
                  <User className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${
                    isNameInappropriate ? 'text-rose-400' : 'text-slate-500'
                  }`} />
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. Drummer Maya, BeatMaster Leo"
                    maxLength={24}
                    required
                    className={`w-full bg-slate-950 border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors ${
                      isNameInappropriate
                        ? 'border-rose-500 focus:border-rose-400 text-rose-200'
                        : 'border-slate-800 focus:border-amber-400'
                    }`}
                  />
                </div>
                {isNameInappropriate ? (
                  <p className="text-[11px] text-rose-400 mt-1.5 flex items-center gap-1 font-medium">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    Inappropriate language is blocked. Please choose a fun, school-friendly name!
                  </p>
                ) : (
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Pick a cool stage name for the classroom leaderboard.
                  </span>
                )}
              </div>

              {/* Choose Rockstar Avatar */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Pick Your Band Instrument
                </label>
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {AVATAR_CHOICES.map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setSelectedAvatar(emoji)}
                      className={`w-11 h-11 rounded-xl text-xl flex items-center justify-center border transition-all cursor-pointer ${
                        selectedAvatar === emoji
                          ? 'bg-amber-400/20 border-amber-400 scale-110 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Passcode & Class Code Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Secret Passcode (PIN)
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={passcodeInput}
                      onChange={(e) => setPasscodeInput(e.target.value)}
                      placeholder="e.g. 1234"
                      maxLength={8}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none transition-colors"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Use this PIN to log in on any Chromebook!
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Class Room / Period
                  </label>
                  <input
                    type="text"
                    value={classCodeInput}
                    onChange={(e) => setClassCodeInput(e.target.value)}
                    placeholder="ROOM-101"
                    maxLength={12}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-colors uppercase font-mono"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Groups you with your classmates.
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSubmitting || isNameInappropriate}
                  className={`w-full py-3 font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isNameInappropriate
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                  }`}
                >
                  {isNameInappropriate ? (
                    <>
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <span>Choose a School-Friendly Name</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>{isSubmitting ? 'Syncing...' : 'Save & Join the Band!'}</span>
                    </>
                  )}
                </button>
              </div>

              {student && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLoginMode(false);
                      setIsEditing(false);
                    }}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel and back to profile
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
