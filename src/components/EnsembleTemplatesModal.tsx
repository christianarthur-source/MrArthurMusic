import React, { useState, useMemo } from 'react';
import { X, Users, Search, Music, Sparkles, ChevronRight, Check } from 'lucide-react';
import { Score } from '../types/music';
import {
  ENSEMBLE_TEMPLATES,
  EnsembleTemplate,
  createScoreFromEnsemble,
} from '../data/ensembleTemplates';

interface EnsembleTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScore: (score: Score) => void;
}

type CategoryFilter = 'all' | 'classical' | 'band' | 'jazz_rock' | 'duets' | 'choral_world';

const CATEGORY_TABS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'All Ensembles', icon: '🌟' },
  { id: 'classical', label: 'Classical & Chamber', icon: '🎻' },
  { id: 'duets', label: 'Piano & Duets', icon: '🎹' },
  { id: 'band', label: 'Bands & Winds', icon: '🎺' },
  { id: 'jazz_rock', label: 'Jazz, Rock & Techno', icon: '🎸' },
  { id: 'choral_world', label: 'Choral & World', icon: '👥' },
];

export const EnsembleTemplatesModal: React.FC<EnsembleTemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectScore,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [numMeasures, setNumMeasures] = useState<number>(4);

  const filteredEnsembles = useMemo(() => {
    return ENSEMBLE_TEMPLATES.filter((ens) => {
      const matchesCategory =
        selectedCategory === 'all' || ens.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        ens.name.toLowerCase().includes(q) ||
        ens.description.toLowerCase().includes(q) ||
        ens.instruments.some((i) => i.name.toLowerCase().includes(q));
      return matchesCategory && matchesQuery;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: EnsembleTemplate) => {
    const score = createScoreFromEnsemble(template, numMeasures);
    onSelectScore(score);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 select-none">
      <div className="bg-slate-900 border border-slate-700 text-slate-100 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-xl shadow-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white font-['Fredoka',sans-serif]">
                  + Ensemble Score Templates
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold">
                  Flat & Noteflight Presets
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Choose a professional score layout: string quartets, brass bands, jazz combos, rock bands, orchestras &amp; duets!
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ensembles (e.g. quartet, brass, rock, flute, orchestra)..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
            />
          </div>

          {/* Measure Length Selector */}
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Score Length:</span>
            {[4, 8, 16].map((bars) => (
              <button
                key={bars}
                type="button"
                onClick={() => setNumMeasures(bars)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  numMeasures === bars
                    ? 'bg-sky-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {bars} Bars
              </button>
            ))}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Ensembles Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 max-h-[60vh]">
          {filteredEnsembles.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="text-sm font-bold">No ensemble templates match &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-slate-500">Try searching for string, piano, band, or orchestra</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredEnsembles.map((ens) => (
                <div
                  key={ens.id}
                  onClick={() => handleSelectTemplate(ens)}
                  className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 shadow-lg hover:shadow-sky-500/10 cursor-pointer transition-all duration-150 group flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner">
                          {ens.icon}
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-black text-white group-hover:text-sky-300 transition-colors font-['Fredoka',sans-serif]">
                            {ens.name}
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {ens.instruments.length} Staves • {ens.tempo} BPM • {ens.timeSignature[0]}/{ens.timeSignature[1]}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 text-[10px] font-bold shrink-0">
                        {ens.category.replace('_', ' & ')}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed font-normal">
                      {ens.description}
                    </p>

                    {/* Instrumentation Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ens.instruments.map((inst, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-medium flex items-center gap-1"
                        >
                          <span className="opacity-60 font-mono text-[9px]">
                            {inst.clef === 'treble' ? '𝄞' : '𝄢'}
                          </span>
                          <span>{inst.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="pt-3.5 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">
                      Creates {numMeasures}-bar multi-track score
                    </span>
                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-sky-500/20 group-hover:bg-sky-500 text-sky-300 group-hover:text-slate-950 font-bold transition-all flex items-center gap-1 font-['Fredoka',sans-serif]"
                    >
                      <span>Load Ensemble</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <span>Tip: You can add or remove instruments anytime using the Track Mixer or + Instrument button.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
