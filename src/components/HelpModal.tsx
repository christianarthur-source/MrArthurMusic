import React from 'react';
import { X, Keyboard, Sparkles, Lightbulb } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: '1, 2, 3, 4, 5', action: 'Set duration: Whole, Half, Quarter, 8th, 16th' },
    { key: 'A – G', action: 'Direct note letter entry (C, D, E, F, G, A, B)' },
    { key: 'R', action: 'Toggle rest mode or turn selected note into a rest' },
    { key: 'T', action: 'Toggle tie between consecutive notes' },
    { key: '.', action: 'Toggle dotted rhythm (1.5x length)' },
    { key: '↑ / ↓ (Up / Down)', action: 'Shift selected pitch up/down along staff lines & spaces' },
    { key: '← / → (Left / Right)', action: 'Navigate cursor to previous/next note or rest' },
    { key: 'Backspace / Delete', action: 'Replace selected note with equivalent rest' },
    { key: 'Spacebar', action: 'Play / Pause score playback' },
    { key: 'Ctrl + Z / Ctrl + Y', action: 'Undo / Redo edits' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900">
              Noteflight Keyboard Shortcuts & Student Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip for Students */}
        <div className="mt-3 p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900 leading-relaxed">
            <span className="font-bold">Music Teacher Tip:</span> Hover over any staff line or space to see the ghost note snap to position. Click to drop a note! Click an existing note and use the <span className="font-semibold">Up/Down arrows</span> to adjust the pitch.
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="mt-4 divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">{s.action}</span>
              <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-800 text-[11px] shrink-0 ml-2">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-all"
          >
            Got it, let's compose!
          </button>
        </div>
      </div>
    </div>
  );
};
