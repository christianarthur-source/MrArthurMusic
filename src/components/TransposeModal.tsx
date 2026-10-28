import React, { useState } from 'react';
import { X, ArrowUp, ArrowDown, Music2, RefreshCw, Layers } from 'lucide-react';
import { KeySignature, Score } from '../types/music';
import { transposePitch, transposeKeySignature } from '../utils/musicMath';

interface TransposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: Score;
  selectedTrackIndex: number;
  onApplyTranspose: (newScore: Score) => void;
}

export const TransposeModal: React.FC<TransposeModalProps> = ({
  isOpen,
  onClose,
  score,
  selectedTrackIndex,
  onApplyTranspose,
}) => {
  const [semitones, setSemitones] = useState<number>(2);
  const [targetScope, setTargetScope] = useState<'all' | 'selected'>('all');
  const [updateKeySignature, setUpdateKeySignature] = useState<boolean>(true);

  if (!isOpen) return null;

  const activeTrack = score.tracks[selectedTrackIndex] || score.tracks[0];
  const projectedKey = updateKeySignature
    ? transposeKeySignature(score.keySignature, semitones)
    : score.keySignature;

  const handleApply = () => {
    if (semitones === 0) {
      onClose();
      return;
    }

    const nextScore: Score = JSON.parse(JSON.stringify(score));
    if (updateKeySignature) {
      nextScore.keySignature = projectedKey;
    }

    nextScore.tracks.forEach((track, tIdx) => {
      if (targetScope === 'selected' && tIdx !== selectedTrackIndex) return;

      // Skip unpitched drum percussion
      const isPercussion =
        track.instrumentId === 'drum_kit' ||
        track.instrumentId === 'drum_808' ||
        track.instrumentId === 'drum_jazz' ||
        track.instrumentId === 'drum_latin' ||
        track.instrumentId === 'triangle' ||
        track.instrumentId === 'tambourine' ||
        track.instrumentId === 'woodblock';

      if (isPercussion) return;

      track.measures.forEach((measure) => {
        measure.items.forEach((item) => {
          if (item.type === 'note') {
            if (item.pitch) {
              item.pitch = transposePitch(item.pitch, semitones, nextScore.keySignature);
            }
            if (item.pitches && item.pitches.length > 0) {
              item.pitches = item.pitches.map((p) =>
                transposePitch(p, semitones, nextScore.keySignature)
              );
            }
          }
        });
      });
    });

    onApplyTranspose(nextScore);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center shadow-lg ring-4 ring-amber-500/20">
              <RefreshCw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Transpose Score</h2>
              <p className="text-xs text-slate-400">Shift pitches and keys up or down</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          {/* Quick Interval Presets */}
          <div>
            <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wider text-[10px]">
              Quick Interval Buttons
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSemitones(-12)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === -12
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                -1 Octave
              </button>
              <button
                type="button"
                onClick={() => setSemitones(-2)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === -2
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                -1 Whole Step
              </button>
              <button
                type="button"
                onClick={() => setSemitones(-1)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === -1
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                -1 Half Step
              </button>
              <button
                type="button"
                onClick={() => setSemitones(1)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === 1
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                +1 Half Step
              </button>
              <button
                type="button"
                onClick={() => setSemitones(2)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === 2
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                +1 Whole Step
              </button>
              <button
                type="button"
                onClick={() => setSemitones(12)}
                className={`py-2 px-1 rounded-xl font-bold border transition-all cursor-pointer ${
                  semitones === 12
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-750'
                }`}
              >
                +1 Octave
              </button>
              <button
                type="button"
                onClick={() => setSemitones(2)} // Bb instrument: Concert C -> D (+2)
                className="col-span-2 py-2 px-1 rounded-xl font-bold bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/30 transition-all cursor-pointer"
                title="B♭ Instruments (Trumpet, Clarinet, Tenor Sax)"
              >
                🎺 B♭ Instrument (+2)
              </button>
            </div>
          </div>

          {/* Semitone Slider & Direct Counter */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
            <div>
              <div className="font-extrabold text-sm text-slate-200">
                {semitones > 0 ? `+${semitones}` : semitones} Semitones
              </div>
              <div className="text-[11px] text-slate-400">
                Key of {score.keySignature} {updateKeySignature ? `➔ Key of ${projectedKey}` : '(Key signature unchanged)'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSemitones((s) => Math.max(-24, s - 1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSemitones((s) => Math.min(24, s + 1))}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="block text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              Apply To
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetScope('all')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                  targetScope === 'all'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <Layers className="w-4 h-4 text-sky-400" />
                <span>All Tracks</span>
              </button>
              <button
                type="button"
                onClick={() => setTargetScope('selected')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold border transition-all cursor-pointer ${
                  targetScope === 'selected'
                    ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <Music2 className="w-4 h-4 text-amber-400" />
                <span className="truncate">{activeTrack?.name || 'Selected Track'}</span>
              </button>
            </div>
          </div>

          {/* Checkbox for updating Key Signature */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-slate-300">
            <input
              type="checkbox"
              checked={updateKeySignature}
              onChange={(e) => setUpdateKeySignature(e.target.checked)}
              className="w-4 h-4 rounded-md accent-amber-500 cursor-pointer"
            />
            <span>Also update Score Key Signature to match transposed root</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 font-black text-white shadow-lg cursor-pointer transition-all"
          >
            Apply Transpose
          </button>
        </div>
      </div>
    </div>
  );
};
