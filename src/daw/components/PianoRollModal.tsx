import React, { useState, useEffect, useCallback } from 'react';
import { Volume2, X, Plus, Trash2, Sparkles, Music } from 'lucide-react';
import { DawClip, DawMidiNote } from '../types';
import { InstrumentId } from '../../types/music';
import { soundEngine } from '../../audio/soundEngine';

interface PianoRollModalProps {
  clip: DawClip | null;
  onUpdateClipNotes: (clipId: string, notes: DawMidiNote[]) => void;
  onClose: () => void;
}

const PIANO_ROLL_KEYS = [
  { midi: 72, name: 'C5', isBlack: false },
  { midi: 71, name: 'B4', isBlack: false },
  { midi: 70, name: 'A#4', isBlack: true },
  { midi: 69, name: 'A4', isBlack: false },
  { midi: 68, name: 'G#4', isBlack: true },
  { midi: 67, name: 'G4', isBlack: false },
  { midi: 66, name: 'F#4', isBlack: true },
  { midi: 65, name: 'F4', isBlack: false },
  { midi: 64, name: 'E4', isBlack: false },
  { midi: 63, name: 'D#4', isBlack: true },
  { midi: 62, name: 'D4', isBlack: false },
  { midi: 61, name: 'C#4', isBlack: true },
  { midi: 60, name: 'C4', isBlack: false },
  { midi: 59, name: 'B3', isBlack: false },
  { midi: 58, name: 'A#3', isBlack: true },
  { midi: 57, name: 'A3', isBlack: false },
  { midi: 55, name: 'G3', isBlack: false },
  { midi: 53, name: 'F3', isBlack: false },
  { midi: 52, name: 'E3', isBlack: false },
  { midi: 50, name: 'D3', isBlack: false },
  { midi: 48, name: 'C3', isBlack: false },
];

export const PianoRollModal: React.FC<PianoRollModalProps> = ({
  clip,
  onUpdateClipNotes,
  onClose,
}) => {
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('piano_treble');
  const [activeMidiKey, setActiveMidiKey] = useState<number | null>(null);

  if (!clip) return null;

  const notes = clip.midiNotes || [];
  const durationBeats = clip.durationBeats || 8;
  const numBeats = Math.max(8, durationBeats);

  // Play audition note on click
  const handlePlayKey = (midi: number) => {
    setActiveMidiKey(midi);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    // Play sound preview
    try {
      soundEngine.playNotePreview({ step: 'C', octave: 4 }, selectedInstrument, 0.45, 'C');
    } catch {}
    setTimeout(() => setActiveMidiKey(null), 250);
  };

  // Toggle a note on the grid
  const handleCellClick = (midi: number, startBeat: number) => {
    const existingIdx = notes.findIndex(
      (n) => n.midi === midi && Math.abs(n.startBeat - startBeat) < 0.25
    );

    let updated: DawMidiNote[];
    if (existingIdx >= 0) {
      // Remove note
      updated = notes.filter((_, idx) => idx !== existingIdx);
    } else {
      // Add note (default duration: 1 beat)
      const newNote: DawMidiNote = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        midi,
        startBeat,
        durationBeats: 1,
        velocity: 0.85,
      };
      updated = [...notes, newNote];
      handlePlayKey(midi);
    }

    onUpdateClipNotes(clip.id, updated);
  };

  return (
    <div className="h-72 bg-slate-900 border-t border-slate-800 flex flex-col shadow-2xl select-none z-30">
      {/* Header bar: Instrument selector, tools, close */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">🎹</span>
          <span className="text-sm font-black text-white font-['Fredoka',sans-serif]">
            Piano Roll Editor — {clip.name}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Click grid to draw or erase notes
          </span>
        </div>

        {/* Instrument Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold hidden sm:inline">Instrument:</span>
          <select
            value={selectedInstrument}
            onChange={(e) => setSelectedInstrument(e.target.value as InstrumentId)}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white font-bold"
          >
            <option value="piano_treble">🎹 Grand Piano</option>
            <option value="electric_piano">🎹 Electric Rhodes</option>
            <option value="electric_bass">🎸 Slap Bass</option>
            <option value="acoustic_guitar">🎸 Acoustic Guitar</option>
            <option value="marimba">🪵 Marimba</option>
            <option value="flute">🪈 Concert Flute</option>
            <option value="violin">🎻 Violin</option>
            <option value="synth_lead">✨ Retro Synth</option>
          </select>

          {/* Clear notes */}
          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => onUpdateClipNotes(clip.id, [])}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/30 text-rose-300 text-xs font-bold border border-slate-700 cursor-pointer"
            >
              Clear Notes
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Piano Roll Grid Canvas */}
      <div className="flex-1 flex overflow-y-auto overflow-x-auto bg-slate-950">
        {/* Virtual Piano Keys on the Left */}
        <div className="w-20 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky left-0 z-10 shadow-md">
          {PIANO_ROLL_KEYS.map((k) => (
            <button
              key={k.midi}
              type="button"
              onClick={() => handlePlayKey(k.midi)}
              className={`h-5 border-b border-slate-800 flex items-center justify-between px-1.5 text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                activeMidiKey === k.midi
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : k.isBlack
                  ? 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span>{k.name}</span>
              {k.isBlack && <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />}
            </button>
          ))}
        </div>

        {/* Beat Columns & Note Cells */}
        <div className="flex-1 relative flex flex-col min-w-[600px]">
          {PIANO_ROLL_KEYS.map((k) => {
            return (
              <div
                key={k.midi}
                className={`h-5 border-b border-slate-900/60 flex relative ${
                  k.isBlack ? 'bg-slate-950/70' : 'bg-slate-900/20'
                }`}
              >
                {/* 1-beat grid columns */}
                {Array.from({ length: numBeats }).map((_, bIdx) => {
                  const hasNote = notes.some(
                    (n) => n.midi === k.midi && Math.abs(n.startBeat - bIdx) < 0.25
                  );
                  const isMeasureBorder = (bIdx + 1) % 4 === 0;

                  return (
                    <div
                      key={bIdx}
                      onClick={() => handleCellClick(k.midi, bIdx)}
                      className={`flex-1 border-r h-full transition-colors cursor-pointer relative flex items-center justify-center ${
                        isMeasureBorder ? 'border-slate-800' : 'border-slate-900/80'
                      } ${hasNote ? 'bg-amber-400/90' : 'hover:bg-slate-800/40'}`}
                    >
                      {hasNote && (
                        <div className="w-full h-3.5 mx-0.5 rounded-xs bg-amber-400 border border-amber-300 shadow-sm" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
