import React, { useState, useEffect, useRef } from 'react';
import { audioEngine } from '../../services/audioEngine';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Volume2,
  Trash2,
  Shuffle,
  Music,
  Check
} from 'lucide-react';

interface PitchRow {
  note: string;
  name: string;
  solfege: string;
  color: string;
}

const MELODY_PITCHES: PitchRow[] = [
  { note: 'C5', name: 'High C', solfege: 'Do', color: '#ef4444' },
  { note: 'B4', name: 'B', solfege: 'Ti', color: '#a855f7' },
  { note: 'A4', name: 'A', solfege: 'La', color: '#3b82f6' },
  { note: 'G4', name: 'G', solfege: 'Sol', color: '#06b6d4' },
  { note: 'F4', name: 'F', solfege: 'Fa', color: '#22c55e' },
  { note: 'E4', name: 'E', solfege: 'Mi', color: '#eab308' },
  { note: 'D4', name: 'D', solfege: 'Re', color: '#f97316' },
  { note: 'C4', name: 'Low C', solfege: 'Do', color: '#ef4444' }
];

const DRUM_ROWS = [
  { id: 'hihat', label: 'Hi-Hat / Bell', icon: '▲', color: '#6366f1' },
  { id: 'snare', label: 'Snare / Block', icon: '◆', color: '#ec4899' },
  { id: 'kick', label: 'Bass Drum', icon: '●', color: '#f59e0b' }
];

const PRESETS: { name: string; tempo: number; melody: [number, number][]; drums: [number, number][] }[] = [
  {
    name: 'Twinkle Twinkle Little Star',
    tempo: 100,
    // [pitchIndex (0=C5, 7=C4), stepIndex (0-15)]
    melody: [
      [7, 0], [7, 1], [3, 2], [3, 3], [2, 4], [2, 5], [3, 6], // C C G G A A G -
      [4, 8], [4, 9], [5, 10], [5, 11], [6, 12], [6, 13], [7, 14] // F F E E D D C -
    ],
    drums: [
      [2, 0], [1, 2], [2, 4], [1, 6], [2, 8], [1, 10], [2, 12], [1, 14],
      [0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7],
      [0, 8], [0, 9], [0, 10], [0, 11], [0, 12], [0, 13], [0, 14], [0, 15]
    ]
  },
  {
    name: 'Hot Cross Buns (Grade 4 Recorder)',
    tempo: 88,
    melody: [
      [5, 0], [6, 2], [7, 4], // B A G - (scaled to E D C)
      [5, 8], [6, 10], [7, 12], // B A G -
      [7, 14], [7, 15] // G G
    ],
    drums: [
      [2, 0], [2, 4], [2, 8], [2, 12],
      [1, 2], [1, 6], [1, 10], [1, 14]
    ]
  },
  {
    name: 'Pentatonic Xylophone Jam',
    tempo: 116,
    melody: [
      [7, 0], [5, 1], [3, 2], [2, 3], [0, 4], [2, 5], [3, 6], [5, 7],
      [7, 8], [6, 9], [5, 10], [3, 11], [2, 12], [0, 13], [2, 14], [3, 15]
    ],
    drums: [
      [2, 0], [1, 4], [2, 6], [2, 8], [1, 12], [2, 14],
      [0, 2], [0, 6], [0, 10], [0, 14]
    ]
  },
  {
    name: 'Ode to Joy (Beethoven)',
    tempo: 108,
    melody: [
      [5, 0], [5, 1], [4, 2], [3, 3], [3, 4], [4, 5], [5, 6], [6, 7], // E E F G G F E D
      [7, 8], [7, 9], [6, 10], [5, 11], [5, 12], [6, 14]              // C C D E E D
    ],
    drums: [
      [2, 0], [1, 2], [2, 4], [1, 6], [2, 8], [1, 10], [2, 12], [1, 14]
    ]
  }
];

export const SongMakerSequencer: React.FC = () => {
  const [tempo, setTempo] = useState<number>(108);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [melodyInstrument, setMelodyInstrument] = useState<'xylophone' | 'piano' | 'synth' | 'marimba'>('xylophone');
  const [drumInstrument, setDrumInstrument] = useState<'acoustic' | 'electronic' | 'orff'>('acoustic');

  // Melody Grid: 8 rows (C5 to C4) x 16 steps
  const [melodyGrid, setMelodyGrid] = useState<boolean[][]>(() => {
    // Default load Twinkle Twinkle
    const grid = Array.from({ length: 8 }, () => Array(16).fill(false));
    PRESETS[0].melody.forEach(([pitchIdx, stepIdx]) => {
      grid[pitchIdx][stepIdx] = true;
    });
    return grid;
  });

  // Drum Grid: 3 rows (HiHat, Snare, Kick) x 16 steps
  const [drumGrid, setDrumGrid] = useState<boolean[][]>(() => {
    const grid = Array.from({ length: 3 }, () => Array(16).fill(false));
    PRESETS[0].drums.forEach(([drumIdx, stepIdx]) => {
      grid[drumIdx][stepIdx] = true;
    });
    return grid;
  });

  const timerRef = useRef<number | null>(null);

  // Toggle cell on melody grid
  const toggleMelodyCell = (pitchIdx: number, stepIdx: number) => {
    audioEngine.unlockAudio();
    const updated = melodyGrid.map((row) => [...row]);
    const newState = !updated[pitchIdx][stepIdx];
    updated[pitchIdx][stepIdx] = newState;
    setMelodyGrid(updated);

    if (newState) {
      // Audio preview on click!
      const pitch = MELODY_PITCHES[pitchIdx].note;
      audioEngine.playMelodyNote(pitch, melodyInstrument, 0, 0.8);
    }
  };

  // Toggle cell on drum grid
  const toggleDrumCell = (drumIdx: number, stepIdx: number) => {
    audioEngine.unlockAudio();
    const updated = drumGrid.map((row) => [...row]);
    const newState = !updated[drumIdx][stepIdx];
    updated[drumIdx][stepIdx] = newState;
    setDrumGrid(updated);

    if (newState) {
      // Audio preview on click!
      playDrumSound(drumIdx);
    }
  };

  const playDrumSound = (drumIdx: number, time: number = 0) => {
    if (drumInstrument === 'acoustic') {
      if (drumIdx === 2) audioEngine.playKick(time, 0.9);
      else if (drumIdx === 1) audioEngine.playSnare(time, 0.85);
      else audioEngine.playClosedHiHat(time, 0.6);
    } else if (drumInstrument === 'electronic') {
      if (drumIdx === 2) audioEngine.playKick(time, 0.95);
      else if (drumIdx === 1) audioEngine.playClap(time, 0.8);
      else audioEngine.playCowbell(time, true, 0.65);
    } else {
      // Orff percussion
      if (drumIdx === 2) audioEngine.playKick(time, 0.7); // Hand drum
      else if (drumIdx === 1) audioEngine.playWoodblock(time, false, 0.9);
      else audioEngine.playTriangle(time, 0.7);
    }
  };

  // Play / Pause sequencer loop
  const togglePlay = () => {
    if (isPlaying) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPlaying(false);
      setCurrentStep(0);
    } else {
      audioEngine.unlockAudio();
      setIsPlaying(true);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      // 16th note duration = (60 / tempo) / 4 * 1000 ms
      const intervalMs = (60.0 / tempo / 4.0) * 1000;
      let step = 0;

      timerRef.current = window.setInterval(() => {
        // Trigger melody notes for this step
        for (let pIdx = 0; pIdx < 8; pIdx++) {
          if (melodyGrid[pIdx][step]) {
            const pitch = MELODY_PITCHES[pIdx].note;
            audioEngine.playMelodyNote(pitch, melodyInstrument, 0, 0.85);
          }
        }

        // Trigger drum sounds for this step
        for (let dIdx = 0; dIdx < 3; dIdx++) {
          if (drumGrid[dIdx][step]) {
            playDrumSound(dIdx, 0);
          }
        }

        setCurrentStep(step);
        step = (step + 1) % 16;
      }, intervalMs);
    }

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, tempo, melodyGrid, drumGrid, melodyInstrument, drumInstrument]);

  const loadPreset = (presetName: string) => {
    const p = PRESETS.find((item) => item.name === presetName);
    if (!p) return;
    const newMelody = Array.from({ length: 8 }, () => Array(16).fill(false));
    p.melody.forEach(([pitchIdx, stepIdx]) => {
      newMelody[pitchIdx][stepIdx] = true;
    });

    const newDrums = Array.from({ length: 3 }, () => Array(16).fill(false));
    p.drums.forEach(([drumIdx, stepIdx]) => {
      newDrums[drumIdx][stepIdx] = true;
    });

    setMelodyGrid(newMelody);
    setDrumGrid(newDrums);
    setTempo(p.tempo);
  };

  const clearGrid = () => {
    setMelodyGrid(Array.from({ length: 8 }, () => Array(16).fill(false)));
    setDrumGrid(Array.from({ length: 3 }, () => Array(16).fill(false)));
  };

  const randomize = () => {
    audioEngine.unlockAudio();
    const newMelody = Array.from({ length: 8 }, () => Array(16).fill(false));
    for (let step = 0; step < 16; step++) {
      if (Math.random() > 0.45) {
        const randomPitch = Math.floor(Math.random() * 8);
        newMelody[randomPitch][step] = true;
      }
    }

    const newDrums = Array.from({ length: 3 }, () => Array(16).fill(false));
    for (let step = 0; step < 16; step++) {
      if (step % 4 === 0) newDrums[2][step] = true; // Kick
      if (step % 4 === 2) newDrums[1][step] = true; // Snare
      if (Math.random() > 0.5) newDrums[0][step] = true; // Hi-hat
    }

    setMelodyGrid(newMelody);
    setDrumGrid(newDrums);
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-3xl p-5 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6 select-none">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className={`p-4 rounded-2xl font-bold text-white shadow-elevated transition-all active:scale-95 flex items-center gap-2 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-600 ring-4 ring-amber-500/20'
                : 'bg-gradient-to-r from-rose-500 via-amber-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700'
            }`}
            title="Spacebar to Play/Pause"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
            <span className="text-sm">{isPlaying ? 'Stop' : 'Play Song'}</span>
          </button>

          <div>
            <h3 className="font-extrabold text-base text-stone-900 dark:text-white flex items-center gap-2">
              <span>Google Song Maker Studio</span>
              <span className="text-amber-500">✨</span>
            </h3>
            <p className="text-xs text-stone-400">
              Colorful pitch blocks (top) + rhythm beat blocks (bottom)
            </p>
          </div>
        </div>

        {/* Instrument Pickers & Tempo */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Melody Instrument */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
            <span className="text-stone-400 font-semibold">Melody:</span>
            <select
              value={melodyInstrument}
              onChange={(e) => setMelodyInstrument(e.target.value as any)}
              className="bg-transparent font-bold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
            >
              <option value="xylophone">🪵 Xylophone (Mallets)</option>
              <option value="piano">🎹 Warm Piano</option>
              <option value="synth">⚡ Fun Retro Synth</option>
              <option value="marimba">🔔 Marimba Bar</option>
            </select>
          </div>

          {/* Drum Instrument */}
          <div className="flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
            <span className="text-stone-400 font-semibold">Drums:</span>
            <select
              value={drumInstrument}
              onChange={(e) => setDrumInstrument(e.target.value as any)}
              className="bg-transparent font-bold text-stone-800 dark:text-stone-200 focus:outline-none cursor-pointer"
            >
              <option value="acoustic">🥁 Real Acoustic Drums</option>
              <option value="electronic">🎛️ Electronic 808 Kit</option>
              <option value="orff">🪘 Orff Hand Drum & Blocks</option>
            </select>
          </div>

          {/* Tempo */}
          <div className="flex items-center gap-2 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-mono font-bold">
            <span className="text-stone-400">Tempo:</span>
            <input
              type="range"
              min="60"
              max="200"
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-20 accent-brand-600 cursor-pointer"
            />
            <span>{tempo} BPM</span>
          </div>
        </div>
      </div>

      {/* Preset Selector & Quick Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-stone-400 font-semibold">Presets:</span>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPreset(p.name)}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 font-medium text-stone-700 dark:text-stone-300 transition-colors"
            >
              {p.name.split(' ')[0]} {p.name.split(' ')[1] || ''}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={randomize}
            className="px-3 py-1 rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-semibold flex items-center gap-1 hover:bg-purple-100"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Randomize</span>
          </button>
          <button
            onClick={clearGrid}
            className="px-3 py-1 rounded-xl bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 font-semibold flex items-center gap-1 hover:bg-stone-200"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Interactive Song Maker Grid Canvas */}
      <div className="overflow-x-auto pb-3">
        <div className="min-w-[720px] space-y-1">
          {/* Top Step Number Header */}
          <div
            className="gap-1 pl-28 pr-1 mb-1 text-center text-[10px] font-mono text-stone-400"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
          >
            {Array.from({ length: 16 }).map((_, stepIdx) => (
              <div
                key={stepIdx}
                className={`py-0.5 rounded transition-colors ${
                  stepIdx % 4 === 0 ? 'font-bold text-stone-800 dark:text-stone-200' : ''
                } ${currentStep === stepIdx && isPlaying ? 'bg-amber-400/30 text-amber-600 font-black' : ''}`}
              >
                {stepIdx % 4 === 0 ? Math.floor(stepIdx / 4) + 1 : '•'}
              </div>
            ))}
          </div>

          {/* MELODY SECTION (8 PITCH ROWS) */}
          <div className="space-y-1 p-2 rounded-2xl bg-stone-50/80 dark:bg-stone-950/40 border border-stone-200/60 dark:border-stone-800">
            {MELODY_PITCHES.map((pitch, pitchIdx) => (
              <div key={pitch.note} className="flex items-center gap-2">
                {/* Note Label */}
                <div className="w-24 flex items-center justify-between pr-2 text-right">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg text-white shadow-subtle shrink-0"
                    style={{ backgroundColor: pitch.color }}
                  >
                    {pitch.note}
                  </span>
                  <span className="text-[10px] font-semibold text-stone-400">
                    {pitch.solfege}
                  </span>
                </div>

                {/* 16 Step Melody Cells */}
                <div
                  className="gap-1 flex-1"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
                >
                  {Array.from({ length: 16 }).map((_, stepIdx) => {
                    const isCellActive = melodyGrid[pitchIdx][stepIdx];
                    const isPlayhead = isPlaying && currentStep === stepIdx;
                    const isBeatQuarter = stepIdx % 4 === 0;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleMelodyCell(pitchIdx, stepIdx)}
                        className={`h-7 rounded-lg transition-all duration-75 flex items-center justify-center ${
                          isCellActive
                            ? 'shadow-sm text-white scale-[1.02] ring-1 ring-black/10'
                            : isBeatQuarter
                            ? 'bg-stone-200/70 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700'
                            : 'bg-stone-100 dark:bg-stone-800/40 hover:bg-stone-200 dark:hover:bg-stone-700/60'
                        } ${isPlayhead ? 'ring-2 ring-amber-400 scale-105 z-10' : ''}`}
                        style={{
                          backgroundColor: isCellActive ? pitch.color : undefined
                        }}
                      >
                        {isCellActive && <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Section Divider Bar */}
          <div className="py-1 flex items-center gap-3 px-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Rhythm Section
            </span>
            <div className="flex-1 h-px bg-stone-200 dark:bg-stone-800" />
          </div>

          {/* DRUM SECTION (3 DRUM ROWS) */}
          <div className="space-y-1 p-2 rounded-2xl bg-amber-50/40 dark:bg-stone-950/40 border border-amber-200/50 dark:border-stone-800">
            {DRUM_ROWS.map((drum, drumIdx) => (
              <div key={drum.id} className="flex items-center gap-2">
                {/* Drum Label */}
                <div className="w-24 flex items-center justify-between pr-2 text-right">
                  <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300 truncate">
                    {drum.label.split('/')[0]}
                  </span>
                  <span className="text-xs text-stone-400 font-mono">{drum.icon}</span>
                </div>

                {/* 16 Step Drum Cells */}
                <div
                  className="gap-1 flex-1"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' }}
                >
                  {Array.from({ length: 16 }).map((_, stepIdx) => {
                    const isCellActive = drumGrid[drumIdx][stepIdx];
                    const isPlayhead = isPlaying && currentStep === stepIdx;
                    const isBeatQuarter = stepIdx % 4 === 0;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleDrumCell(drumIdx, stepIdx)}
                        className={`h-7 rounded-lg transition-all duration-75 flex items-center justify-center font-bold text-xs ${
                          isCellActive
                            ? 'text-white shadow-sm ring-1 ring-black/10'
                            : isBeatQuarter
                            ? 'bg-amber-100/70 dark:bg-stone-800 hover:bg-amber-200'
                            : 'bg-stone-100 dark:bg-stone-800/40 hover:bg-stone-200'
                        } ${isPlayhead ? 'ring-2 ring-amber-400 scale-105 z-10' : ''}`}
                        style={{
                          backgroundColor: isCellActive ? drum.color : undefined
                        }}
                      >
                        {isCellActive && <span className="text-[10px] leading-none text-white">{drum.icon}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
