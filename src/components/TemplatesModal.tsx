import React from 'react';
import { TEMPLATES } from '../data/templates';
import { Score } from '../types/music';
import { X, BookOpen, Star, Music, Award } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScore: (score: Score) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectScore,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Song Templates & Classroom Challenges
            </h2>
            <p className="text-xs text-slate-500">
              Pick a starter song or challenge puzzle to complete with your music class.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {Object.entries(TEMPLATES).map(([key, item]) => {
            const isChallenge = key.includes('challenge');

            return (
              <div
                key={key}
                onClick={() => {
                  onSelectScore(JSON.parse(JSON.stringify(item.score)));
                  onClose();
                }}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isChallenge
                    ? 'border-amber-300 bg-amber-50/50 hover:bg-amber-100/70 hover:border-amber-400 shadow-2xs'
                    : 'border-slate-200 hover:border-sky-400 hover:bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isChallenge ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isChallenge ? <Award className="w-5 h-5" /> : <Music className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700">
                        {item.name}
                      </h3>
                      {isChallenge && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                          Solve & Play
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {item.score.tracks.length} track(s) · {item.score.tempo} BPM · {item.score.timeSignature[0]}/{item.score.timeSignature[1]}
                    </div>
                  </div>
                </div>

                <button className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 group-hover:bg-sky-600 group-hover:text-white group-hover:border-transparent transition-all shrink-0">
                  Load Score
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
