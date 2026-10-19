import React, { useState } from 'react';
import { INSTRUMENTS } from '../data/instruments';
import { InstrumentCategory, InstrumentDefinition } from '../types/music';
import { X, Plus, Sparkles, Volume2, Search, Drum } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface InstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInstrument: (inst: InstrumentDefinition) => void;
  onAddGrandPiano: () => void;
  onOpenDrumBeats?: () => void;
}

export const InstrumentModal: React.FC<InstrumentModalProps> = ({
  isOpen,
  onClose,
  onSelectInstrument,
  onAddGrandPiano,
  onOpenDrumBeats,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory | 'All'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const categories: (InstrumentCategory | 'All')[] = [
    'All',
    'Woodwinds',
    'Brass',
    'Strings',
    'Popular & World',
    'Keyboards',
    'Percussion',
    'Drums',
    'Sound Effects',
  ];

  const handlePreview = (e: React.MouseEvent, inst: InstrumentDefinition) => {
    e.stopPropagation();
    setPreviewingId(inst.id);
    const previewPitch = {
      step: (inst.clef === 'bass' ? 'C' : 'G') as any,
      octave: inst.defaultOctave,
    };
    soundEngine.playNotePreview(previewPitch, inst.id, 0.6);
    setTimeout(() => {
      setPreviewingId(null);
    }, 600);
  };

  const allInstruments = Object.values(INSTRUMENTS);
  const filteredInstruments = allInstruments.filter((inst) => {
    // Exclude auxiliary piano_bass if searching all
    if (inst.id === 'piano_bass' && selectedCategory !== 'Keyboards') return false;

    const matchesCategory = selectedCategory === 'All' || inst.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inst.description && inst.description.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                🎺
              </span>
              <span>Add Instrument or Sound Effect</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Full Orchestra (Woodwinds, Brass, Strings, Percussion), Popular & World Instruments, Keyboards, Drum Kit, and Sound Effects.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Shortcuts: Grand Piano & Drum Beats */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Grand Piano Staff */}
          <div className="p-3 bg-gradient-to-r from-indigo-950/50 to-slate-900 border border-indigo-800/40 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <span>🎹</span> Grand Piano Staff
              </div>
              <div className="text-[11px] text-slate-400">Linked Treble + Bass staves for two hands.</div>
            </div>
            <button
              onClick={() => {
                onAddGrandPiano();
                onClose();
              }}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Piano</span>
            </button>
          </div>

          {/* Drum Kit with Pre-made Beats */}
          <div className="p-3 bg-gradient-to-r from-rose-950/50 to-slate-900 border border-rose-800/40 rounded-2xl flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <Drum className="w-3.5 h-3.5 text-rose-400" /> Pre-made Drum Beats
              </div>
              <div className="text-[11px] text-slate-400">Rock, Jazz, Folk, Pop, Latin, African styles.</div>
            </div>
            {onOpenDrumBeats && (
              <button
                onClick={() => {
                  onClose();
                  onOpenDrumBeats();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 shrink-0"
              >
                <span>🥁</span>
                <span>Select Beat</span>
              </button>
            )}
          </div>
        </div>

        {/* Search and Category Tabs */}
        <div className="p-4 pb-2 space-y-3 bg-slate-900/60 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search instruments by name, family, or tone..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {cat === 'All' ? '🌟 All Families' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Instruments Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredInstruments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No instruments match "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredInstruments.map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => {
                    soundEngine.preloadInstrument(inst.id);
                    onSelectInstrument(inst);
                    onClose();
                  }}
                  className="bg-slate-800/80 hover:bg-slate-750 border border-slate-700/80 hover:border-sky-400/80 rounded-2xl p-3 cursor-pointer transition-all flex flex-col justify-between group hover:shadow-lg active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: inst.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate">
                          {inst.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span className="capitalize font-semibold text-sky-400">{inst.clef} Clef</span>
                          <span>·</span>
                          <span>{inst.category}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePreview(e, inst)}
                      title={`Preview ${inst.name} Sound`}
                      className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                        previewingId === inst.id
                          ? 'bg-amber-500 border-amber-400 text-slate-950 animate-bounce'
                          : 'bg-slate-700/60 border-slate-600/60 text-slate-300 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {inst.description && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {inst.description}
                    </p>
                  )}

                  <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 group-hover:text-sky-400 transition-colors">
                      Click to Add
                    </span>
                    <Plus className="w-4 h-4 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
