import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { ChorusSong, ConcertProgram } from '../../types';
import {
  Users,
  Plus,
  Music,
  Calendar,
  Sparkles,
  Printer,
  FileText,
  Clock,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Volume2
} from 'lucide-react';

export const ChorusManagerView: React.FC = () => {
  const { showToast } = useApp();

  const [songs, setSongs] = useState<ChorusSong[]>([]);
  const [concerts, setConcerts] = useState<ConcertProgram[]>([]);
  const [activeTab, setActiveTab] = useState<'repertoire' | 'warmups' | 'concert-builder'>('repertoire');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  // New song modal state
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newComposer, setNewComposer] = useState('');
  const [newVoicing, setNewVoicing] = useState<'Unison' | '2-Part' | '3-Part' | 'SSA'>('2-Part');
  const [newKey, setNewKey] = useState('F Major');
  const [newTempo, setNewTempo] = useState(120);

  const reloadData = () => {
    const loadedSongs = storage.getChorusSongs();
    setSongs(loadedSongs);
    setConcerts(storage.getConcerts());
    if (!selectedSongId && loadedSongs.length > 0) {
      setSelectedSongId(loadedSongs[0].id);
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const selectedSong = songs.find((s) => s.id === selectedSongId) || songs[0];
  const activeConcert = concerts[0];

  const handleCreateSong = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const created = storage.addChorusSong({
      title: newTitle.trim(),
      composer: newComposer.trim() || 'Traditional',
      voicing: newVoicing,
      key: newKey,
      tempoBpm: Number(newTempo) || 120,
      durationString: '3:00',
      status: 'learning',
      notes: 'New chorus literature selection.',
      targetConcert: 'Winter Concert 2026',
      rehearsalHistory: []
    });

    setIsAddSongOpen(false);
    setSelectedSongId(created.id);
    setNewTitle('');
    setNewComposer('');
    showToast(`Added ${created.title} to Chorus repertoire`, 'success');
  };

  const handleStatusChange = (songId: string, status: ChorusSong['status']) => {
    storage.updateChorusSong(songId, { status });
    showToast(`Updated status to ${status}`, 'info');
  };

  // Vocal Warmup Routines
  const warmupRoutines = [
    {
      category: '1. Physical & Posture Alignment',
      title: 'The Puppet String & Shoulder Roll',
      time: '2 mins',
      instructions: 'Singers stand with feet shoulder-width apart. Imagine a puppet string pulling up from the crown of the head. Roll shoulders backward 4 times, then drop and release tension.'
    },
    {
      category: '2. Breath Management & Rib Expansion',
      title: 'Hissing Snake & Candle Flame Pulse',
      time: '3 mins',
      instructions: 'Inhale silently for 4 counts expanding lower ribs ("fill the inner tube"). Exhale on a sustained "sss" for 16 counts. Follow with 4 pulsing "shh-shh-shh" breaths engaging the intercostal muscles.'
    },
    {
      category: '3. Phonation & Resonant Vowels',
      title: 'Descending 5-Tone Lip Trills & Tall Vowels',
      time: '4 mins',
      instructions: 'Lip trill / buzz on 5-note descending scale (Sol-Fa-Mi-Re-Do). Transition to pure open Italian vowels: "Mah-Meh-Mee-Moh-Moo" with dropped jaw and tall vertical mouth opening.'
    },
    {
      category: '4. Diction & Consonant Articulation',
      title: 'Crisp Consonants: "Tip of the Tongue, the Teeth, the Lips"',
      time: '3 mins',
      instructions: 'Rapid rhythmic chant on a single pitch: "The tip of the tongue, the teeth, the lips, make crisp clear sounds on fingertips!" Energize the lips and teeth.'
    }
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-rose-600" />
            <span>Fifth & Sixth-Grade Chorus Manager</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Repertoire mastery, sectional balance (Soprano & Alto), vocal warmup routines, and concert program builder.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60">
          <button
            onClick={() => setActiveTab('repertoire')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'repertoire'
                ? 'bg-white dark:bg-stone-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Repertoire
          </button>
          <button
            onClick={() => setActiveTab('warmups')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'warmups'
                ? 'bg-white dark:bg-stone-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Vocal Warmups
          </button>
          <button
            onClick={() => setActiveTab('concert-builder')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'concert-builder'
                ? 'bg-white dark:bg-stone-900 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Concert Program Builder
          </button>
        </div>
      </div>

      {/* 1. REPERTOIRE TAB */}
      {activeTab === 'repertoire' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Repertoire List */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Chorus Literature ({songs.length})
              </h3>
              <button
                onClick={() => setIsAddSongOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Song</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {songs.map((song) => {
                const isSelected = song.id === selectedSongId;
                const statusColors = {
                  considering: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
                  learning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                  refining: 'bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
                  polished: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                  performed: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                };

                return (
                  <div
                    key={song.id}
                    onClick={() => setSelectedSongId(song.id)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border text-left ${
                      isSelected
                        ? 'bg-white dark:bg-stone-800 border-rose-500 shadow-card'
                        : 'bg-stone-50/70 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                        {song.voicing}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColors[song.status]}`}>
                        {song.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                      {song.title}
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-1">
                      {song.composer}
                    </p>

                    <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-stone-400">
                      <span>{song.key}</span>
                      <span>•</span>
                      <span>{song.tempoBpm} BPM</span>
                      <span>•</span>
                      <span>{song.durationString}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Song Details, Rehearsal Logs & Section Notes */}
          <div className="lg:col-span-7">
            {selectedSong ? (
              <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-100 dark:border-stone-800">
                  <div>
                    <h2 className="text-2xl font-extrabold text-stone-900 dark:text-white">
                      {selectedSong.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                      Composed by {selectedSong.composer} {selectedSong.arranger && `• Arr. ${selectedSong.arranger}`}
                    </p>
                  </div>

                  <select
                    value={selectedSong.status}
                    onChange={(e) => handleStatusChange(selectedSong.id, e.target.value as any)}
                    className="text-xs font-bold rounded-xl px-3 py-1.5 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200"
                  >
                    <option value="considering">Considering</option>
                    <option value="learning">Learning Notes</option>
                    <option value="refining">Refining & Polishing</option>
                    <option value="polished">Polished / Memorized</option>
                    <option value="performed">Performed in Concert</option>
                  </select>
                </div>

                {/* Score & Rehearsal Link */}
                {selectedSong.sheetMusicDriveUrl && (
                  <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-blue-900 dark:text-blue-200">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>Google Drive Sheet Music Score & Part Recordings</span>
                    </div>
                    <a
                      href={selectedSong.sheetMusicDriveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-blue-700"
                    >
                      <span>Open Drive File</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {/* Section Breakdown (Part 1 Soprano / Part 2 Alto) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      Part 1 (Soprano Section Focus)
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {selectedSong.part1Notes || 'Melody line, high head voice resonance, pure vowel placement.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Part 2 (Alto Section Focus)
                    </h4>
                    <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                      {selectedSong.part2Notes || 'Harmonic counterpoint, holding independent pitch, anchor notes.'}
                    </p>
                  </div>
                </div>

                {/* Measure-by-Measure Rehearsal History */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-500" />
                    Rehearsal Log & Focus Measures
                  </h4>

                  <div className="space-y-2">
                    {selectedSong.rehearsalHistory.length === 0 ? (
                      <p className="text-xs text-stone-400">No rehearsal log entries yet.</p>
                    ) : (
                      selectedSong.rehearsalHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between font-semibold">
                            <span className="font-mono text-brand-600 dark:text-brand-400">
                              {item.focusMeasures}
                            </span>
                            <span className="text-[11px] text-stone-400 font-mono">{item.date}</span>
                          </div>
                          <p className="text-stone-600 dark:text-stone-300">{item.notes}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-stone-400">Select a song to view details.</div>
            )}
          </div>
        </div>
      )}

      {/* 2. VOCAL WARMUPS TAB */}
      {activeTab === 'warmups' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                Choral Vocal Warmup Sequence
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Pedagogically sequenced routines for elementary singers: posture alignment, breath support, resonant vowels, and consonant diction.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {warmupRoutines.map((routine, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      {routine.category}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                      {routine.time}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-stone-900 dark:text-white">
                    {routine.title}
                  </h3>

                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-serif">
                    {routine.instructions}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. CONCERT PROGRAM BUILDER TAB */}
      {activeTab === 'concert-builder' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
              <div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Annual Concert Program
                </span>
                <h2 className="text-xl font-bold text-stone-900 dark:text-white mt-1">
                  {activeConcert.title}
                </h2>
                <p className="text-xs text-stone-500">
                  {activeConcert.date} at {activeConcert.time} • {activeConcert.location}
                </p>
              </div>

              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold flex items-center gap-2 shadow-sm shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>Print Concert Program</span>
              </button>
            </div>

            {/* Concert Order Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Order of Program & Stage Flow
              </h3>

              <div className="space-y-2">
                {activeConcert.orderOfProgram.map((item, idx) => {
                  const song = item.songId ? songs.find((s) => s.id === item.songId) : null;
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                            {song ? `${song.title} (${song.composer})` : item.customTitle}
                          </h4>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            Ensemble: <span className="font-semibold">{item.ensemble}</span>
                            {item.notes && ` • ${item.notes}`}
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-mono font-bold text-stone-400 shrink-0">
                        ~{item.durationMinutes} min
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Total Run-Time Calculation */}
            <div className="p-4 rounded-2xl bg-stone-100 dark:bg-stone-800 flex items-center justify-between text-xs font-bold">
              <span className="text-stone-600 dark:text-stone-300">
                Estimated Total Concert Duration:
              </span>
              <span className="font-mono text-sm text-brand-600 dark:text-brand-400">
                {activeConcert.orderOfProgram.reduce((s, i) => s + i.durationMinutes, 0)} minutes
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add Song Modal */}
      {isAddSongOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSong}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">
              Add Chorus Repertoire Piece
            </h3>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Sisi Ni Moja"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Composer</label>
              <input
                type="text"
                value={newComposer}
                onChange={(e) => setNewComposer(e.target.value)}
                placeholder="e.g. Jacob Narverud"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Voicing</label>
                <select
                  value={newVoicing}
                  onChange={(e) => setNewVoicing(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="2-Part">2-Part</option>
                  <option value="Unison">Unison</option>
                  <option value="3-Part">3-Part</option>
                  <option value="SSA">SSA</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Key</label>
                <input
                  type="text"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddSongOpen(false)}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                Save Piece
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
