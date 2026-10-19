import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, ChevronLeft, ChevronRight, X, Music, Sparkles, Mic } from 'lucide-react';
import { InstrumentId, NoteStep, Pitch, AccidentalType } from '../../types/music';
import { soundEngine } from '../../audio/soundEngine';
import { DAW_INSTRUMENTS } from './InstrumentPickerModal';

interface VirtualPianoKeyboardProps {
  currentInstrumentId: InstrumentId;
  trackName?: string;
  isRecording?: boolean;
  currentBeat?: number;
  onOpenInstrumentPicker?: () => void;
  onRecordNote?: (note: { midi: number; pitch: Pitch; startBeat: number; durationBeats: number }) => void;
  onClose?: () => void;
}

interface KeyConfig {
  step: NoteStep;
  octaveOffset: number; // 0 for base octave, 1 for higher
  accidental?: AccidentalType;
  midiOffset: number; // semitones above base C
  isBlack: boolean;
  keyboardKey?: string;
  label: string;
}

// 25-Key piano keyboard configuration (2 full octaves + top C: C4 to C6)
const PIANO_KEYS: KeyConfig[] = [
  // Octave 1
  { step: 'C', octaveOffset: 0, midiOffset: 0, isBlack: false, keyboardKey: 'A', label: 'C' },
  { step: 'C', octaveOffset: 0, accidental: 'sharp', midiOffset: 1, isBlack: true, keyboardKey: 'W', label: 'C#' },
  { step: 'D', octaveOffset: 0, midiOffset: 2, isBlack: false, keyboardKey: 'S', label: 'D' },
  { step: 'D', octaveOffset: 0, accidental: 'sharp', midiOffset: 3, isBlack: true, keyboardKey: 'E', label: 'D#' },
  { step: 'E', octaveOffset: 0, midiOffset: 4, isBlack: false, keyboardKey: 'D', label: 'E' },
  { step: 'F', octaveOffset: 0, midiOffset: 5, isBlack: false, keyboardKey: 'F', label: 'F' },
  { step: 'F', octaveOffset: 0, accidental: 'sharp', midiOffset: 6, isBlack: true, keyboardKey: 'T', label: 'F#' },
  { step: 'G', octaveOffset: 0, midiOffset: 7, isBlack: false, keyboardKey: 'G', label: 'G' },
  { step: 'G', octaveOffset: 0, accidental: 'sharp', midiOffset: 8, isBlack: true, keyboardKey: 'Y', label: 'G#' },
  { step: 'A', octaveOffset: 0, midiOffset: 9, isBlack: false, keyboardKey: 'H', label: 'A' },
  { step: 'A', octaveOffset: 0, accidental: 'sharp', midiOffset: 10, isBlack: true, keyboardKey: 'U', label: 'A#' },
  { step: 'B', octaveOffset: 0, midiOffset: 11, isBlack: false, keyboardKey: 'J', label: 'B' },

  // Octave 2
  { step: 'C', octaveOffset: 1, midiOffset: 12, isBlack: false, keyboardKey: 'K', label: 'C' },
  { step: 'C', octaveOffset: 1, accidental: 'sharp', midiOffset: 13, isBlack: true, keyboardKey: 'O', label: 'C#' },
  { step: 'D', octaveOffset: 1, midiOffset: 14, isBlack: false, keyboardKey: 'L', label: 'D' },
  { step: 'D', octaveOffset: 1, accidental: 'sharp', midiOffset: 15, isBlack: true, keyboardKey: 'P', label: 'D#' },
  { step: 'E', octaveOffset: 1, midiOffset: 16, isBlack: false, keyboardKey: ';', label: 'E' },
  { step: 'F', octaveOffset: 1, midiOffset: 17, isBlack: false, keyboardKey: "'", label: 'F' },
  { step: 'F', octaveOffset: 1, accidental: 'sharp', midiOffset: 18, isBlack: true, label: 'F#' },
  { step: 'G', octaveOffset: 1, midiOffset: 19, isBlack: false, label: 'G' },
  { step: 'G', octaveOffset: 1, accidental: 'sharp', midiOffset: 20, isBlack: true, label: 'G#' },
  { step: 'A', octaveOffset: 1, midiOffset: 21, isBlack: false, label: 'A' },
  { step: 'A', octaveOffset: 1, accidental: 'sharp', midiOffset: 22, isBlack: true, label: 'A#' },
  { step: 'B', octaveOffset: 1, midiOffset: 23, isBlack: false, label: 'B' },

  // High C
  { step: 'C', octaveOffset: 2, midiOffset: 24, isBlack: false, label: 'C' },
];

export const VirtualPianoKeyboard: React.FC<VirtualPianoKeyboardProps> = ({
  currentInstrumentId,
  trackName,
  isRecording = false,
  currentBeat = 0,
  onOpenInstrumentPicker,
  onRecordNote,
  onClose,
}) => {
  const [baseOctave, setBaseOctave] = useState<number>(4); // Default C4
  const [activeMidiNotes, setActiveMidiNotes] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState<boolean>(false);
  const isMouseDownRef = useRef<boolean>(false);

  // Active instrument details
  const instrumentInfo =
    DAW_INSTRUMENTS.find((inst) => inst.id === currentInstrumentId) || {
      id: currentInstrumentId,
      name: 'Virtual Instrument',
      icon: '🎹',
      category: 'Keyboards',
    };

  // Trigger playing a note
  const triggerNote = useCallback(
    (keyConf: KeyConfig) => {
      const actualOctave = baseOctave + keyConf.octaveOffset;
      const pitch: Pitch = {
        step: keyConf.step,
        octave: actualOctave,
        accidental: keyConf.accidental,
      };

      const baseMidiForC = (baseOctave + 1) * 12;
      const midiNumber = baseMidiForC + keyConf.midiOffset;

      // Visual press
      setActiveMidiNotes((prev) => new Set([...prev, midiNumber]));
      setTimeout(() => {
        setActiveMidiNotes((prev) => {
          const next = new Set(prev);
          next.delete(midiNumber);
          return next;
        });
      }, sustain ? 700 : 250);

      // Audio engine execution
      soundEngine.playNotePreview(pitch, currentInstrumentId, sustain ? 1.2 : 0.55);

      // Record to timeline if DAW recording is active
      if (isRecording && onRecordNote) {
        onRecordNote({
          midi: midiNumber,
          pitch,
          startBeat: Math.round(currentBeat * 4) / 4,
          durationBeats: 1,
        });
      }
    },
    [baseOctave, currentBeat, currentInstrumentId, isRecording, onRecordNote, sustain]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Octave Shift shortcuts
      if (e.key === 'z' || e.key === 'Z') {
        setBaseOctave((prev) => Math.max(1, prev - 1));
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        setBaseOctave((prev) => Math.min(6, prev + 1));
        return;
      }

      // Space is reserved for play/pause in DAW
      if (e.code === 'Space') return;

      const upperKey = e.key.toUpperCase();
      const matchedKey = PIANO_KEYS.find(
        (k) => k.keyboardKey && (k.keyboardKey.toUpperCase() === upperKey || k.keyboardKey === e.key)
      );

      if (matchedKey && !e.repeat) {
        triggerNote(matchedKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerNote]);

  // Mouse up global listener for glissando dragging
  useEffect(() => {
    const handleMouseUp = () => {
      isMouseDownRef.current = false;
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const whiteKeys = PIANO_KEYS.filter((k) => !k.isBlack);

  return (
    <div className="h-72 bg-slate-900 border-t border-slate-800 flex flex-col shadow-2xl select-none z-30">
      {/* Top Header Bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{instrumentInfo.icon}</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white font-['Fredoka',sans-serif]">
                  {trackName ? `${trackName} • ` : ''}{instrumentInfo.name}
                </span>
                {isRecording && (
                  <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse font-bold">
                    <Mic className="w-2.5 h-2.5" />
                    LIVE RECORDING
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Play using mouse clicks or computer keyboard keys [A–L]
              </p>
            </div>
          </div>

          {/* Change Instrument Button */}
          {onOpenInstrumentPicker && (
            <button
              type="button"
              onClick={onOpenInstrumentPicker}
              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-bold border border-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Change Instrument</span>
            </button>
          )}
        </div>

        {/* Octave Shift & Sustain Controls */}
        <div className="flex items-center gap-2">
          {/* Sustain Pedal Toggle */}
          <button
            type="button"
            onClick={() => setSustain((prev) => !prev)}
            className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              sustain
                ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-xs'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Toggle piano sustain pedal"
          >
            Sustain: {sustain ? 'ON' : 'OFF'}
          </button>

          {/* Octave Controls */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setBaseOctave((prev) => Math.max(1, prev - 1))}
              disabled={baseOctave <= 1}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              title="Lower Octave (Z)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-amber-300 px-2">
              Octave {baseOctave} (C{baseOctave})
            </span>
            <button
              type="button"
              onClick={() => setBaseOctave((prev) => Math.min(6, prev + 1))}
              disabled={baseOctave >= 6}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
              title="Raise Octave (X)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Close Drawer Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              title="Close Virtual Piano"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Piano Keys Area */}
      <div className="flex-1 bg-slate-950 p-3 flex justify-center items-center overflow-x-auto">
        <div
          className="relative flex h-full max-h-52 w-full max-w-4xl"
          onMouseDown={() => {
            isMouseDownRef.current = true;
          }}
        >
          {/* White Keys */}
          {whiteKeys.map((wKey, wIdx) => {
            const actualOctave = baseOctave + wKey.octaveOffset;
            const baseMidiForC = (baseOctave + 1) * 12;
            const midiNumber = baseMidiForC + wKey.midiOffset;
            const isActive = activeMidiNotes.has(midiNumber);

            return (
              <div
                key={`white_${wIdx}`}
                onMouseDown={() => triggerNote(wKey)}
                onMouseEnter={() => {
                  if (isMouseDownRef.current) triggerNote(wKey);
                }}
                className={`flex-1 h-full rounded-b-xl border border-slate-300/40 relative flex flex-col justify-end items-center pb-2 transition-all cursor-pointer select-none active:scale-[0.99] ${
                  isActive
                    ? 'bg-amber-300 shadow-inner scale-[0.98]'
                    : 'bg-gradient-to-b from-slate-100 to-white hover:bg-slate-50 shadow-md'
                }`}
              >
                {/* Note Name & Octave */}
                <span className="text-[11px] font-black font-['Fredoka',sans-serif] text-slate-900 leading-tight">
                  {wKey.step}
                  <sub className="text-[9px] font-mono text-slate-500">{actualOctave}</sub>
                </span>

                {/* Keyboard Binding Badge */}
                {wKey.keyboardKey && (
                  <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-200 text-slate-600 mt-1 shadow-xs border border-slate-300">
                    {wKey.keyboardKey}
                  </span>
                )}
              </div>
            );
          })}

          {/* Black Keys (Positioned absolutely over white keys) */}
          {PIANO_KEYS.map((keyConf, kIdx) => {
            if (!keyConf.isBlack) return null;

            const actualOctave = baseOctave + keyConf.octaveOffset;
            const baseMidiForC = (baseOctave + 1) * 12;
            const midiNumber = baseMidiForC + keyConf.midiOffset;
            const isActive = activeMidiNotes.has(midiNumber);

            // Calculate horizontal offset based on which white key it sits between
            // White keys are: C, D, E, F, G, A, B (index 0 to 14)
            const whiteIndexMap: Record<number, number> = {
              1: 0.68,   // C#1
              3: 1.72,   // D#1
              6: 3.68,   // F#1
              8: 4.7,    // G#1
              10: 5.72,  // A#1
              13: 7.68,  // C#2
              15: 8.72,  // D#2
              18: 10.68, // F#2
              20: 11.7,  // G#2
              22: 12.72, // A#2
            };

            const leftRatio = (whiteIndexMap[keyConf.midiOffset] || 0) / whiteKeys.length;

            return (
              <div
                key={`black_${kIdx}`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  triggerNote(keyConf);
                }}
                onMouseEnter={() => {
                  if (isMouseDownRef.current) triggerNote(keyConf);
                }}
                style={{
                  left: `${leftRatio * 100}%`,
                  width: `${(0.68 / whiteKeys.length) * 100}%`,
                  height: '62%',
                }}
                className={`absolute top-0 rounded-b-lg border border-slate-900 z-20 flex flex-col justify-end items-center pb-1.5 transition-all cursor-pointer select-none active:scale-[0.98] ${
                  isActive
                    ? 'bg-amber-400 ring-2 ring-amber-300 shadow-lg shadow-amber-400/50'
                    : 'bg-gradient-to-b from-slate-800 to-slate-950 hover:bg-slate-800 shadow-md'
                }`}
              >
                <span className={`text-[10px] font-black font-['Fredoka',sans-serif] ${isActive ? 'text-slate-950' : 'text-amber-300'}`}>
                  {keyConf.label}
                </span>
                {keyConf.keyboardKey && (
                  <span className={`text-[8px] font-mono font-bold px-1 rounded mt-0.5 ${isActive ? 'bg-slate-950 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700'}`}>
                    {keyConf.keyboardKey}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
