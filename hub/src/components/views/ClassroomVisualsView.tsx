import React, { useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import {
  Sparkles,
  Music,
  Volume2,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Layers,
  Award,
  BookOpen,
  Image as ImageIcon,
  ChevronRight,
  Play,
  Sliders,
  CheckCircle2,
  Info
} from 'lucide-react';

export const ClassroomVisualsView: React.FC = () => {
  const [activeCategory, setActiveCategoryState] = useState<'staff' | 'piano' | 'rhythm' | 'solfege' | 'dynamics' | 'instruments'>(() => {
    try {
      const hash = window.location.hash;
      if (hash.includes('visuals-piano')) return 'piano';
      if (hash.includes('visuals-rhythm')) return 'rhythm';
      if (hash.includes('visuals-solfege')) return 'solfege';
      if (hash.includes('visuals-dynamics')) return 'dynamics';
      if (hash.includes('visuals-instruments')) return 'instruments';
    } catch {}
    return 'staff';
  });

  const setActiveCategory = (cat: 'staff' | 'piano' | 'rhythm' | 'solfege' | 'dynamics' | 'instruments') => {
    setActiveCategoryState(cat);
    try {
      window.location.hash = '#visuals-' + cat;
    } catch {}
  };

  // Staff State
  const [clef, setClef] = useState<'treble' | 'bass' | 'grand'>('treble');
  const [staffDisplayMode, setStaffDisplayMode] = useState<'interactive' | 'diagram'>('interactive');
  const [showNoteNames, setShowNoteNames] = useState(true);
  const [showSolfege, setShowSolfege] = useState(false);
  const [showMnemonics, setShowMnemonics] = useState(true);
  const [colorCodedNotes, setColorCodedNotes] = useState(true);
  const [isFullscreenStaff, setIsFullscreenStaff] = useState(false);

  // Piano State
  const [pianoDisplayMode, setPianoDisplayMode] = useState<'interactive' | 'diagram'>('interactive');

  // Solfege State
  const [solfegeDisplayMode, setSolfegeDisplayMode] = useState<'interactive' | 'historical_chart'>('interactive');

  // Play pitch helper
  const playPitch = (noteName: string) => {
    audioEngine.unlockAudio();
    audioEngine.playMusicalNote(noteName, 1.0);
  };

  // Color mapping based on Boomwhackers standard
  const getNoteColor = (pitch: string): string => {
    if (!colorCodedNotes) return '#4f46e5';
    const noteLetter = pitch.charAt(0);
    switch (noteLetter) {
      case 'C': return '#ef4444'; // Red
      case 'D': return '#f97316'; // Orange
      case 'E': return '#eab308'; // Yellow
      case 'F': return '#84cc16'; // Light Green
      case 'G': return '#10b981'; // Teal / Green
      case 'A': return '#3b82f6'; // Blue
      case 'B': return '#a855f7'; // Purple
      default: return '#6366f1';
    }
  };

  // Treble Clef notes (Lines: E4, G4, B4, D5, F5 | Spaces: F4, A4, C5, E5 | Middle C4 ledger)
  const trebleNotes = [
    { pitch: 'C4', label: 'C', solfege: 'Do', type: 'ledger', line: 'Middle C', y: 155, mnemonic: 'Middle C Ledger Line' },
    { pitch: 'D4', label: 'D', solfege: 'Re', type: 'space', line: 'Below Staff', y: 142, mnemonic: 'Space below bottom line' },
    { pitch: 'E4', label: 'E', solfege: 'Mi', type: 'line', line: 'Line 1', y: 130, mnemonic: 'Every (Line 1)' },
    { pitch: 'F4', label: 'F', solfege: 'Fa', type: 'space', line: 'Space 1', y: 118, mnemonic: 'F in FACE (Space 1)' },
    { pitch: 'G4', label: 'G', solfege: 'Sol', type: 'line', line: 'Line 2', y: 106, mnemonic: 'Good (Line 2)' },
    { pitch: 'A4', label: 'A', solfege: 'La', type: 'space', line: 'Space 2', y: 94, mnemonic: 'A in FACE (Space 2)' },
    { pitch: 'B4', label: 'B', solfege: 'Ti', type: 'line', line: 'Line 3', y: 82, mnemonic: 'Boy (Line 3)' },
    { pitch: 'C5', label: 'C', solfege: 'Do', type: 'space', line: 'Space 3', y: 70, mnemonic: 'C in FACE (Space 3)' },
    { pitch: 'D5', label: 'D', solfege: 'Re', type: 'line', line: 'Line 4', y: 58, mnemonic: 'Does (Line 4)' },
    { pitch: 'E5', label: 'E', solfege: 'Mi', type: 'space', line: 'Space 4', y: 46, mnemonic: 'E in FACE (Space 4)' },
    { pitch: 'F5', label: 'F', solfege: 'Fa', type: 'line', line: 'Line 5', y: 34, mnemonic: 'Fine (Line 5)' },
    { pitch: 'G5', label: 'G', solfege: 'Sol', type: 'space', line: 'Above Staff', y: 22, mnemonic: 'Space above top line' }
  ];

  // Bass Clef notes (Lines: G2, B2, D3, F3, A3 | Spaces: A2, C3, E3, G3)
  const bassNotes = [
    { pitch: 'F2', label: 'F', solfege: 'Fa', type: 'space', line: 'Below Staff', y: 142, mnemonic: 'Space below bottom line' },
    { pitch: 'G2', label: 'G', solfege: 'Sol', type: 'line', line: 'Line 1', y: 130, mnemonic: 'Good (Line 1)' },
    { pitch: 'A2', label: 'A', solfege: 'La', type: 'space', line: 'Space 1', y: 118, mnemonic: 'All (Space 1)' },
    { pitch: 'B2', label: 'B', solfege: 'Ti', type: 'line', line: 'Line 2', y: 106, mnemonic: 'Boys (Line 2)' },
    { pitch: 'C3', label: 'C', solfege: 'Do', type: 'space', line: 'Space 2', y: 94, mnemonic: 'Cows (Space 2)' },
    { pitch: 'D3', label: 'D', solfege: 'Re', type: 'line', line: 'Line 3', y: 82, mnemonic: 'Do (Line 3)' },
    { pitch: 'E3', label: 'E', solfege: 'Mi', type: 'space', line: 'Space 3', y: 70, mnemonic: 'Eat (Space 3)' },
    { pitch: 'F3', label: 'F', solfege: 'Fa', type: 'line', line: 'Line 4', y: 58, mnemonic: 'Fine (Line 4)' },
    { pitch: 'G3', label: 'G', solfege: 'Sol', type: 'space', line: 'Space 4', y: 46, mnemonic: 'Grass (Space 4)' },
    { pitch: 'A3', label: 'A', solfege: 'La', type: 'line', line: 'Line 5', y: 34, mnemonic: 'Always (Line 5)' },
    { pitch: 'B3', label: 'B', solfege: 'Ti', type: 'space', line: 'Above Staff', y: 22, mnemonic: 'Space above staff' },
    { pitch: 'C4', label: 'C', solfege: 'Do', type: 'ledger', line: 'Middle C', y: 10, mnemonic: 'Middle C Ledger Line' }
  ];

  // Wide 2-Octave Classroom Piano (C4 – C6)
  const pianoKeys = [
    { note: 'C4', isBlack: false, label: 'C4', solfege: 'Do', color: '#ef4444' },
    { note: 'C#4', isBlack: true, label: 'C#', offsetLeft: 38 },
    { note: 'D4', isBlack: false, label: 'D4', solfege: 'Re', color: '#f97316' },
    { note: 'D#4', isBlack: true, label: 'D#', offsetLeft: 92 },
    { note: 'E4', isBlack: false, label: 'E4', solfege: 'Mi', color: '#eab308' },
    { note: 'F4', isBlack: false, label: 'F4', solfege: 'Fa', color: '#84cc16' },
    { note: 'F#4', isBlack: true, label: 'F#', offsetLeft: 200 },
    { note: 'G4', isBlack: false, label: 'G4', solfege: 'Sol', color: '#10b981' },
    { note: 'G#4', isBlack: true, label: 'G#', offsetLeft: 254 },
    { note: 'A4', isBlack: false, label: 'A4', solfege: 'La', color: '#3b82f6' },
    { note: 'A#4', isBlack: true, label: 'A#', offsetLeft: 308 },
    { note: 'B4', isBlack: false, label: 'B4', solfege: 'Ti', color: '#a855f7' },
    { note: 'C5', isBlack: false, label: 'C5', solfege: 'Do', color: '#ef4444' },
    { note: 'C#5', isBlack: true, label: 'C#', offsetLeft: 416 },
    { note: 'D5', isBlack: false, label: 'D5', solfege: 'Re', color: '#f97316' },
    { note: 'D#5', isBlack: true, label: 'D#', offsetLeft: 470 },
    { note: 'E5', isBlack: false, label: 'E5', solfege: 'Mi', color: '#eab308' },
    { note: 'F5', isBlack: false, label: 'F5', solfege: 'Fa', color: '#84cc16' },
    { note: 'F#5', isBlack: true, label: 'F#', offsetLeft: 578 },
    { note: 'G5', isBlack: false, label: 'G5', solfege: 'Sol', color: '#10b981' },
    { note: 'G#5', isBlack: true, label: 'G#', offsetLeft: 632 },
    { note: 'A5', isBlack: false, label: 'A5', solfege: 'La', color: '#3b82f6' },
    { note: 'A#5', isBlack: true, label: 'A#', offsetLeft: 686 },
    { note: 'B5', isBlack: false, label: 'B5', solfege: 'Ti', color: '#a855f7' },
    { note: 'C6', isBlack: false, label: 'C6', solfege: 'High Do', color: '#ef4444' }
  ];

  // Curwen Solfege with authentic hand postures & scale degrees
  const solfegeScale = [
    {
      degree: 8,
      syllable: 'Do (High)',
      note: 'C5',
      color: '#ef4444',
      hand: '✊ High Fist',
      posture: 'Firm fist held triumphantly above head',
      vibe: 'Home, Resolution, Triumphant'
    },
    {
      degree: 7,
      syllable: 'Ti',
      note: 'B4',
      color: '#a855f7',
      hand: '☝️ Pointing Up',
      posture: 'Index finger pointing upward toward High Do',
      vibe: 'Leading tone, Urgency, Pulling home'
    },
    {
      degree: 6,
      syllable: 'La',
      note: 'A4',
      color: '#3b82f6',
      hand: '⛺ Curved Tent',
      posture: 'Hand draped downward like a willow or gentle roof',
      vibe: 'Gentle, Yearning, Melancholy'
    },
    {
      degree: 5,
      syllable: 'Sol',
      note: 'G4',
      color: '#10b981',
      hand: '✋ Palm Facing Chest',
      posture: 'Flat vertical hand with palm facing inward toward chest',
      vibe: 'Bright, Grand, Majestic anchor'
    },
    {
      degree: 4,
      syllable: 'Fa',
      note: 'F4',
      color: '#84cc16',
      hand: '👎 Thumb Down',
      posture: 'Fist with thumb pointed resolutely downward toward Mi',
      vibe: 'Gravity, Downward lean, Solemn'
    },
    {
      degree: 3,
      syllable: 'Mi',
      note: 'E4',
      color: '#eab308',
      hand: '🫱 Flat Horizontal',
      posture: 'Flat palm held horizontally facing floor at stomach level',
      vibe: 'Calm, Peaceful, Stable ground'
    },
    {
      degree: 2,
      syllable: 'Re',
      note: 'D4',
      color: '#f97316',
      hand: '📐 Angled Ramp',
      posture: 'Flat hand tilted 45° upward like a ramp rising to Mi',
      vibe: 'Hopeful, Questioning, Expectant'
    },
    {
      degree: 1,
      syllable: 'Do (Low)',
      note: 'C4',
      color: '#ef4444',
      hand: '✊ Firm Low Fist',
      posture: 'Closed firm fist held solidly at waist level',
      vibe: 'The Root, Solid Ground, Foundation'
    }
  ];

  // Kodály Rhythm Syllable Flashcards
  const rhythmCards = [
    { name: 'Quarter Note', beats: '1 Beat', syllable: 'Ta', type: 'quarter', sub: 'Walking beat' },
    { name: 'Paired Eighth Notes', beats: '1 Beat (2 half-beats)', syllable: 'Ti - Ti', type: 'eighth_pair', sub: 'Running beat' },
    { name: 'Four Sixteenth Notes', beats: '1 Beat (4 fast quarters)', syllable: 'Tikka - Tikka', type: 'sixteenth_four', sub: 'Galloping beat' },
    { name: 'Half Note', beats: '2 Beats', syllable: 'Ta - a', type: 'half', sub: 'Step, hold' },
    { name: 'Dotted Half Note', beats: '3 Beats', syllable: 'Ta - a - a', type: 'dotted_half', sub: 'Waltz meter' },
    { name: 'Whole Note', beats: '4 Beats', syllable: 'Ta - a - a - a', type: 'whole', sub: 'Long bell ring' },
    { name: 'Quarter Rest', beats: '1 Silent Beat', syllable: 'Shh / Rest', type: 'quarter_rest', sub: 'Silent heartbeat' },
    { name: 'Syncopation', beats: '2 Beats total', syllable: 'Syn - co - pa', type: 'syncopa', sub: 'Offbeat groove' }
  ];

  const renderRhythmSymbol = (type: string) => {
    switch (type) {
      case 'quarter':
        return (
          <svg viewBox="0 0 60 70" className="w-16 h-20 mx-auto fill-stone-900 dark:fill-white stroke-stone-900 dark:stroke-white">
            <ellipse cx="22" cy="52" rx="10" ry="7" transform="rotate(-25 22 52)" />
            <line x1="30" y1="52" x2="30" y2="12" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
      case 'eighth_pair':
        return (
          <svg viewBox="0 0 80 70" className="w-20 h-20 mx-auto fill-stone-900 dark:fill-white stroke-stone-900 dark:stroke-white">
            <ellipse cx="20" cy="52" rx="9" ry="6.5" transform="rotate(-25 20 52)" />
            <line x1="27" y1="52" x2="27" y2="15" strokeWidth="3.5" />
            <ellipse cx="60" cy="52" rx="9" ry="6.5" transform="rotate(-25 60 52)" />
            <line x1="67" y1="52" x2="67" y2="15" strokeWidth="3.5" />
            <rect x="26" y="12" width="43" height="7" strokeWidth="0" />
          </svg>
        );
      case 'sixteenth_four':
        return (
          <svg viewBox="0 0 110 70" className="w-28 h-20 mx-auto fill-stone-900 dark:fill-white stroke-stone-900 dark:stroke-white">
            {[18, 44, 70, 96].map((x, i) => (
              <g key={i}>
                <ellipse cx={x - 6} cy="52" rx="7.5" ry="5.5" transform={`rotate(-25 ${x - 6} 52)`} />
                <line x1={x} y1="52" x2={x} y2="14" strokeWidth="3" />
              </g>
            ))}
            <rect x="17" y="12" width="80" height="5" strokeWidth="0" />
            <rect x="17" y="21" width="80" height="5" strokeWidth="0" />
          </svg>
        );
      case 'half':
        return (
          <svg viewBox="0 0 60 70" className="w-16 h-20 mx-auto stroke-stone-900 dark:stroke-white">
            <ellipse cx="22" cy="52" rx="10" ry="7" transform="rotate(-25 22 52)" fill="none" strokeWidth="4" />
            <line x1="30" y1="52" x2="30" y2="12" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
      case 'dotted_half':
        return (
          <svg viewBox="0 0 70 70" className="w-20 h-20 mx-auto stroke-stone-900 dark:stroke-white fill-stone-900 dark:fill-white">
            <ellipse cx="22" cy="52" rx="10" ry="7" transform="rotate(-25 22 52)" fill="none" strokeWidth="4" />
            <line x1="30" y1="52" x2="30" y2="12" strokeWidth="4" strokeLinecap="round" />
            <circle cx="44" cy="52" r="3.5" strokeWidth="0" />
          </svg>
        );
      case 'whole':
        return (
          <svg viewBox="0 0 60 70" className="w-16 h-20 mx-auto stroke-stone-900 dark:stroke-white">
            <ellipse cx="30" cy="38" rx="15" ry="9" transform="rotate(-25 30 38)" fill="none" strokeWidth="4.5" />
          </svg>
        );
      case 'quarter_rest':
        return (
          <svg viewBox="0 0 50 70" className="w-14 h-20 mx-auto fill-stone-900 dark:fill-white stroke-stone-900 dark:stroke-white">
            <path d="M22,12 L30,24 L18,36 C23,36 29,39 27,48 C22,48 20,43 24,39 L16,34 L26,22 Z" strokeWidth="1" />
          </svg>
        );
      case 'syncopa':
        return (
          <svg viewBox="0 0 90 70" className="w-24 h-20 mx-auto fill-stone-900 dark:fill-white stroke-stone-900 dark:stroke-white">
            {/* Eighth */}
            <ellipse cx="18" cy="52" rx="7" ry="5.5" transform="rotate(-25 18 52)" />
            <line x1="24" y1="52" x2="24" y2="18" strokeWidth="3" />
            <path d="M24,18 Q30,24 33,32" fill="none" strokeWidth="3" />
            {/* Quarter */}
            <ellipse cx="44" cy="52" rx="8" ry="6" transform="rotate(-25 44 52)" />
            <line x1="51" y1="52" x2="51" y2="15" strokeWidth="3.5" />
            {/* Eighth */}
            <ellipse cx="70" cy="52" rx="7" ry="5.5" transform="rotate(-25 70 52)" />
            <line x1="76" y1="52" x2="76" y2="18" strokeWidth="3" />
            <path d="M76,18 Q82,24 85,32" fill="none" strokeWidth="3" />
          </svg>
        );
      default:
        return null;
    }
  };

  const currentNotes = clef === 'bass' ? bassNotes : trebleNotes;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </span>
            <span>Interactive Music Literacy Visuals & Smartboard Posters</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Extra-large, high-contrast visual teaching aids for classroom smartboards: labeled music staff, full piano keyboard, Curwen solfege, and Kodály rhythm flashcards.
          </p>
        </div>

        {/* Visual Category Switcher */}
        <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 overflow-x-auto scrollbar-none">
          {[
            { id: 'staff', label: 'Five-Line Staff' },
            { id: 'piano', label: 'Piano Keyboard' },
            { id: 'solfege', label: 'Curwen Solfege' },
            { id: 'rhythm', label: 'Rhythm Cards' },
            { id: 'dynamics', label: 'Dynamics & Tempo' },
            { id: 'instruments', label: 'Orchestra Families' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === cat.id
                  ? 'bg-white dark:bg-stone-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. EXTRA-LARGE FIVE-LINE MUSIC STAFF */}
      {activeCategory === 'staff' && (
        <div className={`space-y-6 ${isFullscreenStaff ? 'fixed inset-0 z-50 bg-white dark:bg-stone-950 p-6 overflow-y-auto' : ''}`}>
          {/* Controls Bar */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 sm:p-5 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Clef Switcher */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-stone-400 mr-1">Clef:</span>
              <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => setClef('treble')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    clef === 'treble'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  𝄞 Treble Clef
                </button>
                <button
                  onClick={() => setClef('bass')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    clef === 'bass'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                  }`}
                >
                  𝄢 Bass Clef
                </button>
              </div>
            </div>

            {/* View Mode: Interactive vs Official Diagram */}
            <div className="flex items-center gap-2">
              <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => setStaffDisplayMode('interactive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    staffDisplayMode === 'interactive'
                      ? 'bg-white dark:bg-stone-900 text-indigo-600 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                  <span>Interactive Smartboard</span>
                </button>
                <button
                  onClick={() => setStaffDisplayMode('diagram')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    staffDisplayMode === 'diagram'
                      ? 'bg-white dark:bg-stone-900 text-indigo-600 shadow-xs'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Diagram Poster</span>
                </button>
              </div>

              {/* Toggles */}
              {staffDisplayMode === 'interactive' && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowNoteNames(!showNoteNames)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      showNoteNames
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200'
                    }`}
                  >
                    {showNoteNames ? 'Note Letters ON' : 'Note Letters OFF'}
                  </button>

                  <button
                    onClick={() => setShowSolfege(!showSolfege)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      showSolfege
                        ? 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200'
                    }`}
                  >
                    {showSolfege ? 'Solfege ON' : 'Solfege OFF'}
                  </button>

                  <button
                    onClick={() => setColorCodedNotes(!colorCodedNotes)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      colorCodedNotes
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border-stone-200'
                    }`}
                    title="Color notes with Boomwhacker / rainbow pitch colors"
                  >
                    Boomwhacker Colors
                  </button>
                </div>
              )}

              {/* Fullscreen Smartboard Toggle */}
              <button
                onClick={() => setIsFullscreenStaff(!isFullscreenStaff)}
                className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 hover:text-stone-900 dark:hover:text-white"
                title={isFullscreenStaff ? 'Exit Fullscreen' : 'Smartboard Fullscreen Projection'}
              >
                {isFullscreenStaff ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Interactive Scalable Large SVG Staff */}
          {staffDisplayMode === 'interactive' ? (
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-stone-900 dark:text-white">
                    {clef === 'treble' ? '𝄞 Treble Clef Note Explorer' : '𝄢 Bass Clef Note Explorer'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Click or tap any note on the staff to hear its pitch and view mnemonic hints.
                  </p>
                </div>

                <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-xl">
                  <Volume2 className="w-4 h-4" />
                  <span>Click note for sound</span>
                </div>
              </div>

              {/* GIGANTIC HIGH-CONTRAST SVG STAFF */}
              <div className="p-4 sm:p-8 bg-stone-50 dark:bg-stone-800/40 rounded-3xl overflow-x-auto flex justify-center border border-stone-200/70 dark:border-stone-800">
                <svg
                  viewBox="0 0 1000 240"
                  className="w-full min-w-[700px] max-w-5xl select-none"
                  style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }}
                >
                  {/* 5 Prominent Staff Lines (Thicker, dark lines) */}
                  <line x1="50" y1="34" x2="950" y2="34" stroke="#475569" strokeWidth="3" />
                  <line x1="50" y1="58" x2="950" y2="58" stroke="#475569" strokeWidth="3" />
                  <line x1="50" y1="82" x2="950" y2="82" stroke="#475569" strokeWidth="3" />
                  <line x1="50" y1="106" x2="950" y2="106" stroke="#475569" strokeWidth="3" />
                  <line x1="50" y1="130" x2="950" y2="130" stroke="#475569" strokeWidth="3" />

                  {/* Sturdy Barlines */}
                  <line x1="50" y1="34" x2="50" y2="130" stroke="#1e293b" strokeWidth="4" />
                  <line x1="950" y1="34" x2="950" y2="130" stroke="#1e293b" strokeWidth="5" />
                  <line x1="940" y1="34" x2="940" y2="130" stroke="#1e293b" strokeWidth="2" />

                  {/* Clef Symbol */}
                  {clef === 'treble' ? (
                    <text x="60" y="122" fontSize="125" fontFamily="serif" fill="#1e293b" className="dark:fill-stone-100 font-bold">
                      𝄞
                    </text>
                  ) : (
                    <text x="60" y="105" fontSize="110" fontFamily="serif" fill="#1e293b" className="dark:fill-stone-100 font-bold">
                      𝄢
                    </text>
                  )}

                  {/* Notes Rendered Across Staff */}
                  {currentNotes.map((note, idx) => {
                    const xPos = 175 + idx * 62;
                    const noteColor = getNoteColor(note.pitch);

                    return (
                      <g
                        key={note.pitch}
                        onClick={() => playPitch(note.pitch)}
                        className="cursor-pointer group"
                      >
                        {/* Middle C Ledger line */}
                        {note.type === 'ledger' && (
                          <line
                            x1={xPos - 22}
                            y1={note.y}
                            x2={xPos + 22}
                            y2={note.y}
                            stroke="#475569"
                            strokeWidth="3.5"
                          />
                        )}

                        {/* Extra-Large Note Head */}
                        <ellipse
                          cx={xPos}
                          cy={note.y}
                          rx="15"
                          ry="10.5"
                          transform={`rotate(-20 ${xPos} ${note.y})`}
                          fill={noteColor}
                          stroke="#0f172a"
                          strokeWidth="2.5"
                        />

                        {/* Bold Note Stem */}
                        <line
                          x1={xPos + 13}
                          y1={note.y}
                          x2={xPos + 13}
                          y2={note.y - 45}
                          stroke="#1e293b"
                          strokeWidth="3.5"
                          className="dark:stroke-stone-100"
                        />

                        {/* Big Note Letter Name Label */}
                        {showNoteNames && (
                          <text
                            x={xPos}
                            y={195}
                            fontSize="22"
                            fontFamily="system-ui, -apple-system, sans-serif"
                            fontWeight="900"
                            textAnchor="middle"
                            fill={noteColor}
                            className="group-hover:scale-125 transition-transform"
                          >
                            {note.label}
                          </text>
                        )}

                        {/* Solfege Syllable Label */}
                        {showSolfege && (
                          <text
                            x={xPos}
                            y={220}
                            fontSize="14"
                            fontFamily="system-ui, sans-serif"
                            fontWeight="bold"
                            textAnchor="middle"
                            fill="#64748b"
                            className="dark:fill-stone-400"
                          >
                            {note.solfege}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Visual Mnemonic Flash Cards Below Staff */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clef === 'treble' ? (
                  <>
                    <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 tracking-wider">
                          Treble Lines Mnemonic (Bottom to Top)
                        </span>
                        <span className="text-xs font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-lg">
                          Lines 1–5
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 text-2xl font-black text-amber-900 dark:text-amber-100 font-mono">
                        <span>E</span>-<span>G</span>-<span>B</span>-<span>D</span>-<span>F</span>
                      </div>
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                        &quot;Every Good Boy Does Fine&quot;
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                        Alternative: <em>&quot;Every Good Burger Deserves Fries&quot;</em>
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border-2 border-blue-300 dark:border-blue-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider">
                          Treble Spaces Mnemonic (Bottom to Top)
                        </span>
                        <span className="text-xs font-bold bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-lg">
                          Spaces 1–4
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">
                        <span>F</span>-<span>A</span>-<span>C</span>-<span>E</span>
                      </div>
                      <p className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        &quot;FACE in the Space&quot; (Spells the word FACE!)
                      </p>
                      <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                        Middle C sits on the ledger line right below the treble staff.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300 tracking-wider">
                          Bass Lines Mnemonic (Bottom to Top)
                        </span>
                        <span className="text-xs font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-lg">
                          Lines 1–5
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 text-2xl font-black text-emerald-900 dark:text-emerald-100 font-mono">
                        <span>G</span>-<span>B</span>-<span>D</span>-<span>F</span>-<span>A</span>
                      </div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
                        &quot;Good Boys Do Fine Always&quot;
                      </p>
                      <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                        Alternative: <em>&quot;Great Big Dogs Fight Animals&quot;</em>
                      </p>
                    </div>

                    <div className="p-5 rounded-3xl bg-purple-50 dark:bg-purple-950/40 border-2 border-purple-300 dark:border-purple-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-purple-700 dark:text-purple-300 tracking-wider">
                          Bass Spaces Mnemonic (Bottom to Top)
                        </span>
                        <span className="text-xs font-bold bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded-lg">
                          Spaces 1–4
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 text-2xl font-black text-purple-900 dark:text-purple-100 font-mono">
                        <span>A</span>-<span>C</span>-<span>E</span>-<span>G</span>
                      </div>
                      <p className="text-sm font-bold text-purple-800 dark:text-purple-200">
                        &quot;All Cows Eat Grass&quot;
                      </p>
                      <p className="text-xs text-purple-700/80 dark:text-purple-300/80">
                        Middle C sits on the ledger line above the bass staff.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* High-Res Labeled Diagram Poster View */
            <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                <div>
                  <h3 className="text-lg font-black text-stone-900 dark:text-white">
                    Grand Staff Labeled Notes & Pitch Chart
                  </h3>
                  <p className="text-xs text-stone-500">
                    High-resolution educational vector diagram showing Treble Clef, Bass Clef, and Middle C connection.
                  </p>
                </div>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-xl">
                  Wikimedia Educational Vector
                </span>
              </div>

              {/* Diagram Container */}
              <div className="p-4 sm:p-8 bg-white dark:bg-stone-800 rounded-3xl border border-stone-200 dark:border-stone-700 flex flex-col items-center justify-center">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/1/11/Grand_staff_labeled_notes.svg"
                  alt="Grand Staff labeled notes with treble and bass clefs"
                  className="w-full max-w-4xl h-auto object-contain py-4"
                  loading="lazy"
                />
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700 flex items-center gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  Notice how <strong>Middle C (C4)</strong> acts as the central pivot between the Treble Clef and the Bass Clef. In elementary chorus, female voices and unchanged boy trebles read the Treble Clef, while developing baritone voices read the Bass Clef.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. EXTRA-LARGE PIANO KEYBOARD WITH LABELED KEYS */}
      {activeCategory === 'piano' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h3 className="text-lg font-black text-stone-900 dark:text-white">
                Classroom Piano Keyboard (C4 to C6)
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Extra-large keys with note letter names and solfege labels clearly visible for whole-class demonstration.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => setPianoDisplayMode('interactive')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    pianoDisplayMode === 'interactive'
                      ? 'bg-white dark:bg-stone-900 text-indigo-600 shadow-xs'
                      : 'text-stone-500'
                  }`}
                >
                  Interactive Piano
                </button>
                <button
                  onClick={() => setPianoDisplayMode('diagram')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    pianoDisplayMode === 'diagram'
                      ? 'bg-white dark:bg-stone-900 text-indigo-600 shadow-xs'
                      : 'text-stone-500'
                  }`}
                >
                  Piano & Clefs Chart
                </button>
              </div>
            </div>
          </div>

          {pianoDisplayMode === 'interactive' ? (
            <div className="space-y-4">
              {/* Massive Piano Keyboard */}
              <div className="p-4 sm:p-8 bg-stone-100 dark:bg-stone-800 rounded-3xl flex justify-center overflow-x-auto shadow-inner border border-stone-200 dark:border-stone-700">
                <div className="relative flex h-64 sm:h-72 select-none bg-stone-950 p-2.5 rounded-3xl shadow-2xl">
                  {pianoKeys.map((key) => {
                    if (key.isBlack) {
                      return (
                        <button
                          key={key.note}
                          onClick={() => playPitch(key.note)}
                          className="absolute z-10 w-9 sm:w-11 h-36 sm:h-44 bg-gradient-to-b from-stone-900 to-black text-white rounded-b-xl shadow-xl active:bg-brand-600 hover:bg-stone-800 border border-stone-800 transition-all flex flex-col justify-end pb-3 items-center"
                          style={{ left: key.offsetLeft }}
                        >
                          <span className="text-[11px] font-mono font-bold text-stone-300">
                            {key.label}
                          </span>
                        </button>
                      );
                    }

                    return (
                      <button
                        key={key.note}
                        onClick={() => playPitch(key.note)}
                        className="w-12 sm:w-14 h-full bg-white hover:bg-indigo-50 active:bg-indigo-100 text-stone-900 rounded-b-2xl border-x border-b border-stone-300 shadow-md transition-colors flex flex-col justify-between items-center py-3"
                      >
                        {/* Top Solfege indicator */}
                        <span
                          className="w-6 h-6 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: key.color }}
                        >
                          {key.solfege?.slice(0, 2)}
                        </span>

                        {/* Bottom Note Name */}
                        <div className="text-center">
                          <span className="text-sm font-black text-stone-900 block font-mono">
                            {key.label}
                          </span>
                          <span className="text-[10px] font-bold text-stone-400 block">
                            {key.solfege}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Helper legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-stone-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" /> C = Red
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-orange-500" /> D = Orange
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-yellow-500" /> E = Yellow
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-lime-500" /> F = Light Green
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" /> G = Teal / Green
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-blue-500" /> A = Blue
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-purple-500" /> B = Purple
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-6 bg-white dark:bg-stone-800 rounded-3xl border border-stone-200 dark:border-stone-700 flex justify-center">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/9/92/Piano_keyboard_and_clefs.svg"
                  alt="Piano keyboard and musical staff clefs"
                  className="w-full max-w-4xl h-auto"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. CURWEN SOLFEGE TONE LADDER & HAND SIGNS */}
      {activeCategory === 'solfege' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h3 className="text-lg font-black text-stone-900 dark:text-white">
                Curwen / Kodály Solfege Hand Signs Ladder
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Click any solfege tone to hear the singing pitch and display the physical hand sign posture.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setSolfegeDisplayMode(solfegeDisplayMode === 'interactive' ? 'historical_chart' : 'interactive')
                }
                className="px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold border border-stone-200 dark:border-stone-700 hover:bg-stone-200 transition-all"
              >
                {solfegeDisplayMode === 'interactive' ? 'Show Curwen 1884 Chart' : 'Show Interactive Ladder'}
              </button>
            </div>
          </div>

          {solfegeDisplayMode === 'interactive' ? (
            <div className="max-w-2xl mx-auto space-y-3">
              {solfegeScale.map((step) => (
                <button
                  key={step.degree}
                  onClick={() => playPitch(step.note)}
                  className="w-full p-4 rounded-3xl flex items-center justify-between text-left transition-all hover:scale-[1.02] shadow-sm border-2 group"
                  style={{
                    backgroundColor: `${step.color}12`,
                    borderColor: `${step.color}45`
                  }}
                >
                  <div className="flex items-center gap-4">
                    {/* Scale Degree Badge */}
                    <div
                      className="w-12 h-12 rounded-2xl font-black text-base text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform shrink-0"
                      style={{ backgroundColor: step.color }}
                    >
                      {step.degree}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-stone-900 dark:text-white">
                          {step.syllable} ({step.note})
                        </h4>
                        <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-white/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200/50">
                          {step.hand}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300 font-medium mt-0.5">
                        {step.posture}
                      </p>
                      <p className="text-[11px] text-stone-400 italic">
                        Character: {step.vibe}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white dark:bg-stone-800 shadow-xs text-stone-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 flex flex-col items-center">
              <div className="p-6 bg-white dark:bg-stone-800 rounded-3xl border border-stone-200 dark:border-stone-700 max-w-xl">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/2/28/Curwen_handsigns.jpg"
                  alt="Original 1884 Curwen hand signs chart from John Curwen's Standard Course"
                  className="w-full h-auto rounded-2xl shadow-sm"
                />
              </div>
              <p className="text-xs text-stone-500 text-center font-serif">
                Original 1884 John Curwen <em>Standard Course of Tonic Sol-Fa</em> chart detailing the physical posture and psychological effect of each degree.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 4. OVERSIZED KODÁLY RHYTHM FLASHCARDS */}
      {activeCategory === 'rhythm' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-stone-800">
            <div>
              <h3 className="text-lg font-black text-stone-900 dark:text-white">
                Kodály Rhythm Flashcards & Beat Syllables
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Large, high-contrast flashcards for echo clapping, rhythm reading, and beat counting.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {rhythmCards.map((card, idx) => (
              <div
                key={idx}
                onClick={() => {
                  audioEngine.unlockAudio();
                  audioEngine.playWoodblock(0, false, 1.0);
                }}
                className="group p-6 rounded-3xl bg-stone-50 dark:bg-stone-800/60 border-2 border-stone-200/80 dark:border-stone-700 hover:border-indigo-500 cursor-pointer transition-all hover:scale-[1.03] shadow-card flex flex-col justify-between space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-xl text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {card.beats}
                  </span>
                  <Volume2 className="w-4 h-4 text-stone-400 group-hover:text-indigo-600 transition-colors" />
                </div>

                {/* Extra-Large Musical Symbol */}
                <div className="text-center py-2 flex flex-col items-center justify-center min-h-[90px]">
                  <div className="group-hover:scale-110 transition-transform">
                    {renderRhythmSymbol(card.type)}
                  </div>
                  <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 block mt-2">
                    &quot;{card.syllable}&quot;
                  </span>
                </div>

                <div className="text-center pt-2 border-t border-stone-200/60 dark:border-stone-700">
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200">
                    {card.name}
                  </h4>
                  <p className="text-[11px] text-stone-400 font-medium">
                    {card.sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. DYNAMICS & TEMPO LADDER */}
      {activeCategory === 'dynamics' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div>
            <h3 className="text-lg font-black text-stone-900 dark:text-white">
              Dynamics & Expressive Tempo Reference Posters
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Italian terms from whisper soft to roaring loud, and slow turtle to lightning fast tempo.
            </p>
          </div>

          {/* Dynamics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { symbol: 'ppp', name: 'Pianississimo', level: 'Whisper Soft', color: 'bg-blue-50 text-blue-900 border-blue-200' },
              { symbol: 'pp', name: 'Pianissimo', level: 'Very Soft', color: 'bg-sky-50 text-sky-900 border-sky-200' },
              { symbol: 'p', name: 'Piano', level: 'Soft', color: 'bg-teal-50 text-teal-900 border-teal-200' },
              { symbol: 'mp', name: 'Mezzo Piano', level: 'Medium Soft', color: 'bg-emerald-50 text-emerald-900 border-emerald-200' },
              { symbol: 'mf', name: 'Mezzo Forte', level: 'Medium Loud', color: 'bg-amber-50 text-amber-900 border-amber-200' },
              { symbol: 'f', name: 'Forte', level: 'Loud', color: 'bg-orange-50 text-orange-900 border-orange-200' },
              { symbol: 'ff', name: 'Fortissimo', level: 'Very Loud', color: 'bg-rose-50 text-rose-900 border-rose-200' },
              { symbol: 'fff', name: 'Fortississimo', level: 'Roaring Loud', color: 'bg-red-100 text-red-950 border-red-300' }
            ].map((d, i) => (
              <div key={i} className={`p-5 rounded-3xl text-center border-2 ${d.color} shadow-xs`}>
                <span className="font-serif text-4xl sm:text-5xl font-black block mb-2">{d.symbol}</span>
                <span className="text-xs font-black block">{d.name}</span>
                <span className="text-[11px] opacity-80 font-medium">{d.level}</span>
              </div>
            ))}
          </div>

          {/* Tempo Markings */}
          <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
            <h4 className="text-sm font-bold text-stone-900 dark:text-white mb-3">
              Tempo Markings (Beats Per Minute)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { term: 'Largo', bpm: '40–60 BPM', meaning: 'Very slow and broad (Turtle)' },
                { term: 'Andante', bpm: '76–108 BPM', meaning: 'Walking speed pace' },
                { term: 'Moderato', bpm: '108–120 BPM', meaning: 'Moderate speed' },
                { term: 'Allegro', bpm: '120–168 BPM', meaning: 'Fast, quick, and bright (Cheetah)' },
                { term: 'Presto', bpm: '168–200 BPM', meaning: 'Very fast, lightning speed' }
              ].map((t, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
                  <span className="text-base font-black text-indigo-600 block">{t.term}</span>
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">{t.bpm}</span>
                  <p className="text-[11px] text-stone-400 mt-1">{t.meaning}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. ORCHESTRA INSTRUMENT FAMILIES */}
      {activeCategory === 'instruments' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
          <div>
            <h3 className="text-lg font-black text-stone-900 dark:text-white">
              The 4 Instrument Families of the Symphony Orchestra
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Sound production methods, key instruments, and classroom Orff instrument connections.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                family: 'Strings Family',
                color: 'from-amber-500 to-amber-700',
                instruments: 'Violin, Viola, Cello, Double Bass, Harp, Ukulele, Guitar',
                vibration: 'Sound is produced when strings vibrate by bowing (arco) or plucking (pizzicato). Hollow wooden body amplifies sound.',
                tip: 'Smallest = highest pitch (Violin); Largest = lowest pitch (Double Bass).'
              },
              {
                family: 'Woodwinds Family',
                color: 'from-emerald-500 to-emerald-700',
                instruments: 'Flute, Piccolo, Clarinet, Oboe, Bassoon, Saxophone, Soprano Recorder',
                vibration: 'Sound is made by blowing air across an edge (flute) or vibrating single/double reeds. Pitch changes by opening and closing tone holes.',
                tip: 'Flute and recorder split air; Clarinet uses 1 reed; Oboe & Bassoon use 2 reeds vibrating together.'
              },
              {
                family: 'Brass Family',
                color: 'from-orange-500 to-orange-700',
                instruments: 'Trumpet, French Horn, Trombone, Euphonium, Tuba',
                vibration: 'Sound is produced by buzzing lips into a cup-shaped metal mouthpiece. Valves or slide change the length of the tubing.',
                tip: 'Trombone uses a slide; Tuba uses 18 feet of coiled brass tubing.'
              },
              {
                family: 'Percussion & Orff Barred Instruments',
                color: 'from-purple-500 to-purple-700',
                instruments: 'Timpani, Bass Drum, Snare Drum, Xylophone, Glockenspiel, Metallophone, Triangle, Djembe',
                vibration: 'Sound is produced by striking, shaking, or scraping. Pitched percussion plays melodies; unpitched keeps the steady beat.',
                tip: 'Orff xylophones have wooden rosewood bars; Glockenspiels have metal steel bars.'
              }
            ].map((fam, i) => (
              <div
                key={i}
                className="p-6 rounded-3xl bg-white dark:bg-stone-800/80 border-2 border-stone-200/80 dark:border-stone-700 shadow-card space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-8 rounded-lg bg-gradient-to-b ${fam.color}`} />
                  <h4 className="text-base font-black text-stone-900 dark:text-white">{fam.family}</h4>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-stone-400 block">Instruments:</span>
                  <p className="text-xs font-bold text-stone-800 dark:text-stone-200 leading-relaxed">
                    {fam.instruments}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase text-stone-400 block">How Sound is Made:</span>
                  <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                    {fam.vibration}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-900/60 text-stone-500 text-[11px] font-medium italic">
                  💡 Classroom tip: {fam.tip}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
