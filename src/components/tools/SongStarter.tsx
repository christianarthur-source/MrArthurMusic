import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Dices,
  Volume2,
  Plus,
  Trash2,
  ChevronRight,
  Music2,
  Smile,
  Heart,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { playMusicNote, getToolboxAudioContext, noteToFreq, playLineTone } from './toolboxAudio';
import { Pitch } from '../../types/music';

// Musical Moods
interface SongMood {
  id: string;
  name: string;
  emoji: string;
  subtitle: string;
  bpm: number;
  key: string;
  color: string;
  accent: string;
  chords: string[]; // Chord names
  instrument: string;
  bassFreqs: number[]; // Root notes for 4 bars
}

const SONG_MOODS: SongMood[] = [
  {
    id: 'happy',
    name: 'Happy Sunny Pop',
    emoji: '☀️',
    subtitle: 'Bright, cheerful, smiling groove',
    bpm: 118,
    key: 'C Major',
    color: 'from-amber-400 to-orange-500',
    accent: 'border-amber-400 text-amber-300',
    chords: ['C', 'G', 'Am', 'F'],
    instrument: 'marimba',
    bassFreqs: [130.81, 98.0, 110.0, 87.31], // C3, G2, A2, F2
  },
  {
    id: 'chill',
    name: 'Chill Sunset Lofi',
    emoji: '🌙',
    subtitle: 'Cozy, gentle, relaxing daydream',
    bpm: 88,
    key: 'F Major',
    color: 'from-sky-400 to-indigo-500',
    accent: 'border-sky-400 text-sky-300',
    chords: ['F', 'C', 'Dm', 'Bb'],
    instrument: 'piano',
    bassFreqs: [87.31, 130.81, 146.83, 116.54],
  },
  {
    id: 'spooky',
    name: 'Spooky Detective',
    emoji: '🎃',
    subtitle: 'Sneaky mystery, tip-toe footsteps',
    bpm: 100,
    key: 'A Minor',
    color: 'from-purple-500 to-rose-600',
    accent: 'border-purple-400 text-purple-300',
    chords: ['Am', 'Dm', 'E7', 'Am'],
    instrument: 'glockenspiel',
    bassFreqs: [110.0, 146.83, 164.81, 110.0],
  },
  {
    id: 'energetic',
    name: 'Super Hero Rock',
    emoji: '⚡',
    subtitle: 'Fast, bold, adventure power',
    bpm: 132,
    key: 'G Major',
    color: 'from-rose-500 to-amber-500',
    accent: 'border-rose-400 text-rose-300',
    chords: ['G', 'D', 'Em', 'C'],
    instrument: 'xylophone',
    bassFreqs: [98.0, 146.83, 82.41, 130.81],
  },
  {
    id: 'island',
    name: 'Tropical Island',
    emoji: '🏝️',
    subtitle: 'Bouncy calypso, dancing waves',
    bpm: 110,
    key: 'C Major',
    color: 'from-teal-400 to-emerald-500',
    accent: 'border-teal-400 text-teal-300',
    chords: ['C', 'F', 'G', 'C'],
    instrument: 'flute',
    bassFreqs: [130.81, 87.31, 98.0, 130.81],
  },
];

// Note options for young learners
interface MelodyNoteOption {
  id: string;
  label: string;
  animal: string;
  solfege: string;
  step: 'C' | 'D' | 'E' | 'G' | 'A';
  octave: number;
  color: string;
}

const MELODY_NOTES: MelodyNoteOption[] = [
  { id: 'C5', label: 'High Do', animal: '🐱 Cat', solfege: 'Do', step: 'C', octave: 5, color: 'bg-red-500' },
  { id: 'A4', label: 'La', animal: '🐶 Dog', solfege: 'La', step: 'A', octave: 4, color: 'bg-purple-500' },
  { id: 'G4', label: 'Sol', animal: '🐰 Bunny', solfege: 'Sol', step: 'G', octave: 4, color: 'bg-blue-500' },
  { id: 'E4', label: 'Mi', animal: '🐻 Bear', solfege: 'Mi', step: 'E', octave: 4, color: 'bg-yellow-500 text-slate-900' },
  { id: 'D4', label: 'Re', animal: '🐸 Frog', solfege: 'Re', step: 'D', octave: 4, color: 'bg-orange-500' },
  { id: 'C4', label: 'Low Do', animal: '🦁 Lion', solfege: 'Do', step: 'C', octave: 4, color: 'bg-red-600' },
  { id: 'REST', label: 'Rest', animal: '💤 Shh', solfege: 'Rest', step: 'C', octave: 0, color: 'bg-slate-800 text-slate-400' },
];

// Sections in a song
type SectionType = 'intro' | 'verse' | 'chorus' | 'outro';

interface SongSection {
  id: string;
  type: SectionType;
  title: string;
  emoji: string;
  color: string;
  border: string;
  melody: string[]; // 8 notes (ids from MELODY_NOTES)
}

const DEFAULT_SECTIONS: SongSection[] = [
  {
    id: 'sec-intro',
    type: 'intro',
    title: 'Intro',
    emoji: '🟡',
    color: 'bg-amber-500/20 text-amber-300',
    border: 'border-amber-400/40',
    melody: ['C4', 'E4', 'G4', 'REST', 'C4', 'E4', 'G4', 'REST'],
  },
  {
    id: 'sec-verse',
    type: 'verse',
    title: 'Verse',
    emoji: '🔵',
    color: 'bg-sky-500/20 text-sky-300',
    border: 'border-sky-400/40',
    melody: ['E4', 'E4', 'G4', 'G4', 'A4', 'A4', 'G4', 'REST'],
  },
  {
    id: 'sec-chorus',
    type: 'chorus',
    title: 'Chorus',
    emoji: '🔴',
    color: 'bg-rose-500/20 text-rose-300',
    border: 'border-rose-400/40',
    melody: ['C5', 'C5', 'A4', 'G4', 'E4', 'D4', 'C4', 'REST'],
  },
  {
    id: 'sec-outro',
    type: 'outro',
    title: 'Outro',
    emoji: '🟢',
    color: 'bg-emerald-500/20 text-emerald-300',
    border: 'border-emerald-400/40',
    melody: ['G4', 'E4', 'D4', 'C4', 'C4', 'REST', 'C4', 'REST'],
  },
];

export const SongStarter: React.FC = () => {
  const [selectedMood, setSelectedMood] = useState<SongMood>(SONG_MOODS[0]);
  const [sections, setSections] = useState<SongSection[]>(DEFAULT_SECTIONS);
  const [activeSectionId, setActiveSectionId] = useState<string>('sec-verse');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentPlaySectionIdx, setCurrentPlaySectionIdx] = useState<number>(0);
  const [currentPlayBeat, setCurrentPlayBeat] = useState<number>(0); // 0..7
  const [tempo, setTempo] = useState<number>(SONG_MOODS[0].bpm);

  const timerRef = useRef<number | null>(null);

  const activeSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  // Sync tempo when mood changes
  const handleSelectMood = (mood: SongMood) => {
    setSelectedMood(mood);
    setTempo(mood.bpm);
  };

  // Play a drum & bass tick on each beat
  const playBackingBeat = useCallback(
    async (beatIndex: number, mood: SongMood) => {
      const ctx = await getToolboxAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // 1. Bass accompaniment (changes every 2 beats)
      const chordIdx = Math.floor(beatIndex / 2) % mood.bassFreqs.length;
      const bassFreq = mood.bassFreqs[chordIdx];

      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.setValueAtTime(bassFreq, now);
      bassGain.gain.setValueAtTime(0.18, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.4);

      // 2. Playful rhythm click / drum
      if (beatIndex % 2 === 0) {
        // Kick on beats 0, 2, 4, 6
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.1);
        kickGain.gain.setValueAtTime(0.25, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kickOsc.connect(kickGain);
        kickGain.connect(ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.14);
      } else {
        // Snare / clap on beats 1, 3, 5, 7
        const snareOsc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareOsc.type = 'square';
        snareOsc.frequency.setValueAtTime(220, now);
        snareGain.gain.setValueAtTime(0.1, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        snareOsc.connect(snareGain);
        snareGain.connect(ctx.destination);
        snareOsc.start(now);
        snareOsc.stop(now + 0.1);
      }
    },
    []
  );

  // Play melody note
  const triggerNoteAudio = useCallback(
    (noteId: string, inst: string) => {
      if (noteId === 'REST') return;
      const noteMeta = MELODY_NOTES.find((n) => n.id === noteId);
      if (noteMeta && noteMeta.step) {
        playMusicNote({ step: noteMeta.step, octave: noteMeta.octave }, inst, 0.45);
      }
    },
    []
  );

  // Playback scheduler
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = (60 / tempo) * 500; // 8th note / 2 beats per second approx

    timerRef.current = window.setInterval(() => {
      setCurrentPlayBeat((prevBeat) => {
        const nextBeat = (prevBeat + 1) % 8;

        if (nextBeat === 0) {
          // Advance to next section
          setCurrentPlaySectionIdx((prevSec) => (prevSec + 1) % sections.length);
        }

        // Determine current note to play
        const secToPlay = sections[currentPlaySectionIdx] || sections[0];
        const noteId = secToPlay.melody[nextBeat];
        triggerNoteAudio(noteId, selectedMood.instrument);
        playBackingBeat(nextBeat, selectedMood);

        return nextBeat;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, tempo, sections, currentPlaySectionIdx, selectedMood, triggerNoteAudio, playBackingBeat]);

  // Update a note in the active section
  const handleSetNote = (beatIdx: number, noteId: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== activeSectionId) return s;
        const newMelody = [...s.melody];
        newMelody[beatIdx] = noteId;
        return { ...s, melody: newMelody };
      })
    );
    triggerNoteAudio(noteId, selectedMood.instrument);
  };

  // Roll a magic melody for active section
  const handleRandomMelody = () => {
    const pitchChoices = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'REST'];
    const newMelody = Array.from({ length: 8 }, () => {
      return pitchChoices[Math.floor(Math.random() * pitchChoices.length)];
    });
    // Ensure at least first beat is a note
    if (newMelody[0] === 'REST') newMelody[0] = 'C4';

    setSections((prev) =>
      prev.map((s) => (s.id === activeSectionId ? { ...s, melody: newMelody } : s))
    );
  };

  // Add a section
  const handleAddSection = (type: SectionType) => {
    const emojis: Record<SectionType, string> = {
      intro: '🟡',
      verse: '🔵',
      chorus: '🔴',
      outro: '🟢',
    };
    const titles: Record<SectionType, string> = {
      intro: 'Intro',
      verse: 'Verse 2',
      chorus: 'Chorus',
      outro: 'Outro',
    };
    const colors: Record<SectionType, string> = {
      intro: 'bg-amber-500/20 text-amber-300',
      verse: 'bg-sky-500/20 text-sky-300',
      chorus: 'bg-rose-500/20 text-rose-300',
      outro: 'bg-emerald-500/20 text-emerald-300',
    };
    const borders: Record<SectionType, string> = {
      intro: 'border-amber-400/40',
      verse: 'border-sky-400/40',
      chorus: 'border-rose-400/40',
      outro: 'border-emerald-400/40',
    };

    const newSec: SongSection = {
      id: 'sec-' + Date.now(),
      type,
      title: titles[type],
      emoji: emojis[type],
      color: colors[type],
      border: borders[type],
      melody: ['C4', 'E4', 'G4', 'REST', 'A4', 'G4', 'E4', 'C4'],
    };

    setSections((prev) => [...prev, newSec]);
    setActiveSectionId(newSec.id);
  };

  const handleRemoveSection = (id: string) => {
    if (sections.length <= 1) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
    if (activeSectionId === id) {
      const remaining = sections.filter((s) => s.id !== id);
      setActiveSectionId(remaining[0].id);
    }
  };

  return (
    <div className="space-y-5 select-none font-['Fredoka',sans-serif]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 p-4 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
            🎶
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white">Song Starter</h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40">
                Grades K-3rd Song Creator
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans">
              Pick your mood, build catchy melody patterns, and connect sections into a complete song!
            </p>
          </div>
        </div>

        {/* Big Kid-Friendly Play Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl font-black text-base shadow-xl transition-all cursor-pointer ${
              isPlaying
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 ring-4 ring-amber-400/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 ring-4 ring-emerald-500/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>Stop Song</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Play Song! 🚀</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Step 1: Pick Musical Mood & Style */}
      <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
            <span>Step 1: Pick A Musical Style &amp; Mood</span>
          </h4>
          <span className="text-xs text-slate-400">
            Speed: <span className="text-white font-bold">{tempo} BPM</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {SONG_MOODS.map((mood) => {
            const isSelected = selectedMood.id === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => handleSelectMood(mood)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-br ' + mood.color + ' text-slate-950 border-white shadow-lg scale-102 ring-2 ring-white/50'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-white'
                }`}
              >
                <div className="text-2xl mb-1">{mood.emoji}</div>
                <div>
                  <div className="font-black text-sm leading-tight">{mood.name}</div>
                  <div
                    className={`text-[10px] mt-0.5 leading-snug font-sans ${
                      isSelected ? 'text-slate-950/80 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {mood.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Song Form & Timeline */}
      <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-black text-sky-300 uppercase tracking-wider flex items-center gap-2">
              <span>Step 2: Song Sections &amp; Form</span>
            </h4>
            <p className="text-xs text-slate-400 font-sans">
              Click a section to edit its melody. Watch the song play in order!
            </p>
          </div>

          {/* Add Section Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1">+ Add:</span>
            {(['verse', 'chorus', 'outro'] as SectionType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleAddSection(type)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-slate-700 transition-colors"
              >
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Section Cards Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {sections.map((sec, idx) => {
            const isEditing = sec.id === activeSectionId;
            const isCurrentlyPlaying = isPlaying && currentPlaySectionIdx === idx;

            return (
              <div
                key={sec.id}
                onClick={() => setActiveSectionId(sec.id)}
                className={`flex-shrink-0 w-36 sm:w-44 p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                  isCurrentlyPlaying
                    ? 'ring-4 ring-amber-400 scale-104 shadow-xl'
                    : isEditing
                    ? 'border-white bg-slate-800 shadow-md'
                    : 'border-slate-800 bg-slate-950/60 opacity-80 hover:opacity-100'
                }`}
              >
                {isCurrentlyPlaying && (
                  <span className="absolute -top-2 -right-1 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider animate-pulse">
                    Playing Now
                  </span>
                )}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-lg">{sec.emoji}</span>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSection(sec.id);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="Delete Section"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="font-black text-sm text-white">{sec.title}</div>
                <div className="text-[10px] text-slate-400 font-sans mt-0.5">8 Beat Phrase</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: Melody Builder Grid for Selected Section */}
      <div className="bg-slate-900/90 p-4 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{activeSection.emoji}</span>
            <div>
              <h4 className="text-base font-black text-white">
                Editing: <span className="text-amber-300">{activeSection.title}</span> Melody
              </h4>
              <p className="text-xs text-slate-400 font-sans">
                Click any beat below and pick an animal note!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomMelody}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-black transition-colors cursor-pointer"
          >
            <Dices className="w-4 h-4" />
            <span>Magic Melody Dice 🎲</span>
          </button>
        </div>

        {/* 8-Beat Phrase Row */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {activeSection.melody.map((noteId, beatIdx) => {
            const noteMeta = MELODY_NOTES.find((n) => n.id === noteId) || MELODY_NOTES[0];
            const isPlayingThisBeat =
              isPlaying &&
              sections[currentPlaySectionIdx]?.id === activeSection.id &&
              currentPlayBeat === beatIdx;

            return (
              <div
                key={beatIdx}
                className={`p-2.5 rounded-2xl border-2 flex flex-col items-center justify-between transition-all ${
                  isPlayingThisBeat
                    ? 'border-amber-400 bg-amber-400/20 scale-108 shadow-xl shadow-amber-400/20'
                    : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <div className="text-[10px] font-bold text-slate-400 mb-1">
                  Beat {beatIdx + 1}
                </div>

                {/* Note Tile Badge */}
                <div
                  className={`w-full py-2.5 rounded-xl text-center font-black text-xs shadow-md transition-all ${noteMeta.color}`}
                >
                  <div className="text-sm">{noteMeta.animal.split(' ')[0]}</div>
                  <div className="text-[10px] leading-none mt-0.5">{noteMeta.solfege}</div>
                </div>

                {/* Quick Note Switcher Dropdown */}
                <select
                  value={noteId}
                  onChange={(e) => handleSetNote(beatIdx, e.target.value)}
                  className="mt-2 w-full text-[10px] bg-slate-800 border border-slate-700 rounded-lg text-white font-bold p-1 focus:outline-hidden"
                >
                  {MELODY_NOTES.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.animal} ({opt.solfege})
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {/* Animal Note Reference Piano Bar */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2 overflow-x-auto">
          <span className="text-xs text-slate-400 font-bold shrink-0">Tap to hear note:</span>
          <div className="flex gap-1.5">
            {MELODY_NOTES.filter((n) => n.id !== 'REST').map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => triggerNoteAudio(n.id, selectedMood.instrument)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black text-white hover:scale-105 active:scale-95 transition-all shadow-md ${n.color}`}
              >
                {n.animal}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
