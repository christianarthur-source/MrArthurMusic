import React from 'react';
import { NoteStep, Pitch } from '../types/music';
import { BOOMWHACKER_COLORS } from '../utils/musicMath';
import { ChevronDown, ChevronUp, Music } from 'lucide-react';

interface VirtualPianoProps {
  onPlayAndInsertPitch: (pitch: Pitch) => void;
  boomwhackerColors: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const VirtualPiano: React.FC<VirtualPianoProps> = ({
  onPlayAndInsertPitch,
  boomwhackerColors,
  isOpen,
  onToggleOpen,
}) => {
  // 2 Octaves: C3 to B4 or C4 to B5. Let's provide C3 to B4 + C5 (15 white keys, 10 black keys)
  const octaves = [3, 4];
  const whiteSteps: NoteStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  // Black keys positions relative to white key index (0 to 6)
  // C# is between 0 (C) and 1 (D)
  // D# is between 1 (D) and 2 (E)
  // F# is between 3 (F) and 4 (G)
  // G# is between 4 (G) and 5 (A)
  // A# is between 5 (A) and 6 (B)
  const blackKeyDefs: { step: NoteStep; accidental: 'sharp'; offsetIndex: number }[] = [
    { step: 'C', accidental: 'sharp', offsetIndex: 0 },
    { step: 'D', accidental: 'sharp', offsetIndex: 1 },
    { step: 'F', accidental: 'sharp', offsetIndex: 3 },
    { step: 'G', accidental: 'sharp', offsetIndex: 4 },
    { step: 'A', accidental: 'sharp', offsetIndex: 5 },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900 border-t border-slate-700 shadow-2xl transition-all duration-300">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/90 text-slate-200 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-sky-400" />
          <span>Virtual Piano & Pitch Explorer (Grades 5–8)</span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Click keys to play & insert notes, or press keys A–G
          </span>
        </div>
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
        >
          <span>{isOpen ? 'Minimize' : 'Expand Piano'}</span>
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Keyboard Area */}
      {isOpen && (
        <div className="px-4 py-3 overflow-x-auto flex justify-center bg-slate-950">
          <div className="relative inline-flex pb-1">
            {octaves.map((octave, octIdx) => (
              <div key={octave} className="relative flex">
                {/* White Keys */}
                {whiteSteps.map((step) => {
                  const bw = BOOMWHACKER_COLORS[step];
                  const pitch: Pitch = { step, octave };

                  return (
                    <button
                      key={`${step}${octave}`}
                      onClick={() => onPlayAndInsertPitch(pitch)}
                      className="group relative w-11 h-36 bg-gradient-to-b from-white via-white to-slate-100 hover:to-sky-100 border-r border-slate-300 rounded-b-md shadow-xs active:bg-sky-200 active:translate-y-0.5 transition-all flex flex-col justify-end items-center pb-2.5 focus:outline-hidden"
                    >
                      {/* Boomwhacker colored dot or pill */}
                      {boomwhackerColors && (
                        <div
                          className="w-3.5 h-3.5 rounded-full mb-1 shadow-xs"
                          style={{ backgroundColor: bw.bg }}
                        />
                      )}
                      <span className="font-bold text-slate-800 text-sm">{step}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{octave}</span>
                    </button>
                  );
                })}

                {/* Black Keys */}
                {blackKeyDefs.map((bKey) => {
                  // White key width is 44px (w-11)
                  const leftPos = bKey.offsetIndex * 44 + 31;
                  const pitch: Pitch = {
                    step: bKey.step,
                    octave,
                    accidental: bKey.accidental,
                  };

                  return (
                    <button
                      key={`${bKey.step}#${octave}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayAndInsertPitch(pitch);
                      }}
                      style={{ left: `${leftPos}px` }}
                      className="group absolute top-0 z-10 w-6 h-22 bg-gradient-to-b from-slate-900 via-slate-800 to-black hover:to-slate-700 rounded-b-sm shadow-md active:bg-slate-700 active:translate-y-0.5 transition-all flex flex-col justify-end items-center pb-1.5 focus:outline-hidden"
                    >
                      <span className="text-[10px] font-bold text-slate-300 leading-tight">
                        {bKey.step}♯
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Final high C5 key */}
            <button
              onClick={() => onPlayAndInsertPitch({ step: 'C', octave: 5 })}
              className="group relative w-11 h-36 bg-gradient-to-b from-white via-white to-slate-100 hover:to-sky-100 border-r border-slate-300 rounded-b-md shadow-xs active:bg-sky-200 active:translate-y-0.5 transition-all flex flex-col justify-end items-center pb-2.5 focus:outline-hidden"
            >
              {boomwhackerColors && (
                <div
                  className="w-3.5 h-3.5 rounded-full mb-1 shadow-xs"
                  style={{ backgroundColor: BOOMWHACKER_COLORS['C'].bg }}
                />
              )}
              <span className="font-bold text-slate-800 text-sm">C</span>
              <span className="text-[10px] text-slate-400 font-mono">5</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
