import React, { useState, useEffect, useMemo } from 'react';
import { INSTRUMENTS } from '../data/instruments';
import { InstrumentCategory, InstrumentDefinition } from '../types/music';
import { X, Plus, Volume2, Search, Drum } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface InstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInstrument: (inst: InstrumentDefinition) => void;
  onAddGrandPiano: () => void;
  onOpenDrumBeats?: () => void;
}

// Visual icons and emojis for all instruments
const INSTRUMENT_ICON_MAP: Record<string, string> = {
  // Woodwinds
  flute: '🪈',
  piccolo: '🪈',
  recorder: '🪈',
  pan_flute: '🪈',
  oboe: '🎷',
  english_horn: '🎷',
  clarinet: '🎷',
  bass_clarinet: '🎷',
  bassoon: '🪵',
  contrabassoon: '🪵',
  soprano_sax: '🎷',
  alto_sax: '🎷',
  tenor_sax: '🎷',
  bari_sax: '🎷',

  // Brass
  trumpet: '🎺',
  cornet: '🎺',
  flugelhorn: '🎺',
  muted_trumpet: '🎺',
  french_horn: '📯',
  trombone: '🎺',
  bass_trombone: '🎺',
  euphonium: '🎺',
  tuba: '🎺',
  brass_section: '🎺',

  // Strings
  violin: '🎻',
  viola: '🎻',
  cello: '🎻',
  double_bass: '🎻',
  string_ensemble: '🎻',
  pizzicato_strings: '🎻',
  tremolo_strings: '🎻',
  harp: '🪕',

  // Popular & World
  acoustic_guitar: '🎸',
  steel_guitar: '🎸',
  electric_guitar: '🎸',
  overdrive_guitar: '🎸',
  ukulele: '🪕',
  banjo: '🪕',
  sitar: '🪕',
  koto: '🪕',
  kalimba: '🎹',
  bagpipes: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  harmonica: '🌬️',
  accordion: '🪗',
  electric_bass: '🎸',
  slap_bass: '🎸',
  synth_bass: '🎛️',
  synth_lead: '🎹',
  synth_pad: '✨',
  choir_aahs: '👥',
  voice_oohs: '🗣️',

  // Keyboards
  piano_treble: '🎹',
  piano_bass: '🎹',
  electric_piano: '🎹',
  harpsichord: '🎹',
  clavinet: '🎹',
  celesta: '🔔',
  music_box: '🎵',
  organ: '⛪',
  jazz_organ: '🎹',

  // Percussion
  glockenspiel: '🔔',
  xylophone: '🪵',
  marimba: '🪵',
  vibraphone: '🔔',
  steel_drums: '🪘',
  timpani: '🥁',
  tubular_bells: '🔔',
  taiko_drum: '🥁',
  triangle: '🔺',
  tambourine: '🪘',
  woodblock: '🪵',
  cowbell: '🔔',
  congas: '🪘',
  djembe: '🪘',

  // Drums
  drum_kit: '🥁',
  drum_808: '🎛️',
  drum_jazz: '🎷',
  drum_latin: '🌴',

  // Sound Effects
  applause: '👏',
  laser_gun: '🔫',
  arcade_game: '👾',
  bird_tweet: '🐦',
  seashore: '🌊',
  thunder: '⚡',
  wind_gust: '💨',
  helicopter: '🚁',
  siren: '🚨',
  train_whistle: '🚂',
  scratch: '💿',
  cartoon_boing: '🎯',
};

const CATEGORIES: { id: InstrumentCategory | 'All'; label: string; icon: string }[] = [
  { id: 'All', label: 'All', icon: '🌟' },
  { id: 'Woodwinds', label: 'Woodwinds', icon: '🪈' },
  { id: 'Brass', label: 'Brass', icon: '🎺' },
  { id: 'Strings', label: 'Strings', icon: '🎻' },
  { id: 'Keyboards', label: 'Keyboards', icon: '🎹' },
  { id: 'Popular & World', label: 'Popular & World', icon: '🎸' },
  { id: 'Percussion', label: 'Percussion', icon: '🔔' },
  { id: 'Drums', label: 'Drums', icon: '🥁' },
  { id: 'Sound Effects', label: 'SFX', icon: '⚡' },
];

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

  const allInstruments = useMemo(() => Object.values(INSTRUMENTS), []);

  const filteredInstruments = useMemo(() => {
    return allInstruments.filter((inst) => {
      // Exclude secondary bass staff of piano when viewing all
      if (inst.id === 'piano_bass' && selectedCategory !== 'Keyboards') return false;

      const matchesCategory = selectedCategory === 'All' || inst.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        inst.name.toLowerCase().includes(query) ||
        inst.category.toLowerCase().includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [allInstruments, selectedCategory, searchQuery]);

  // Preload audio samples for visible instruments in the background
  useEffect(() => {
    if (!isOpen) return;
    const toPreload = filteredInstruments.slice(0, 12);
    toPreload.forEach((inst) => {
      const p = {
        step: (inst.clef === 'bass' ? 'C' : 'G') as any,
        octave: inst.defaultOctave,
      };
      soundEngine.preloadInstrument(inst.id, [p]);
    });
  }, [isOpen, selectedCategory, filteredInstruments]);

  if (!isOpen) return null;

  const handlePreview = async (e: React.MouseEvent, inst: InstrumentDefinition) => {
    e.stopPropagation();
    setPreviewingId(inst.id);
    const previewPitch = {
      step: (inst.clef === 'bass' ? 'C' : 'G') as any,
      octave: inst.defaultOctave,
    };
    await soundEngine.playHighQualityNotePreview(previewPitch, inst.id, 0.75);
    setTimeout(() => {
      setPreviewingId((curr) => (curr === inst.id ? null : curr));
    }, 700);
  };

  const handleSelect = (inst: InstrumentDefinition) => {
    soundEngine.preloadInstrument(inst.id);
    onSelectInstrument(inst);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center text-base">
              🎺
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Select Instrument</span>
                <span className="text-xs font-normal text-slate-400">
                  ({filteredInstruments.length})
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Shortcuts: Grand Piano & Drum Beats */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400">Quick Add:</span>
            <button
              onClick={() => {
                onAddGrandPiano();
                onClose();
              }}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>🎹</span>
              <span>Grand Piano (Treble + Bass)</span>
            </button>
          </div>

          {onOpenDrumBeats && (
            <button
              onClick={() => {
                onClose();
                onOpenDrumBeats();
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Drum className="w-3.5 h-3.5" />
              <span>Pre-made Drum Beats</span>
            </button>
          )}
        </div>

        {/* Search Bar & Category Navigation */}
        <div className="p-3 bg-slate-900/80 border-b border-slate-800 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search instruments by name..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-semibold"
              >
                Clear
              </button>
            )}
          </div>

          {/* Condensed Category Submenu Tabs - Flex Wrap with ZERO Horizontal Scrollbar */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {CATEGORIES.map((cat) => {
              const count =
                cat.id === 'All'
                  ? allInstruments.filter((i) => i.id !== 'piano_bass').length
                  : allInstruments.filter((i) => i.category === cat.id).length;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isSelected ? 'bg-sky-600 text-sky-100' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Condensed Instruments Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredInstruments.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No instruments match "{searchQuery}".
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {filteredInstruments.map((inst) => {
                const isPreviewing = previewingId === inst.id;
                const iconEmoji = INSTRUMENT_ICON_MAP[inst.id] || '🎵';
                const clefSymbol = inst.clef === 'bass' ? '𝄢' : '𝄞';
                const clefName = inst.clef === 'bass' ? 'Bass' : 'Treble';

                return (
                  <div
                    key={inst.id}
                    onClick={() => handleSelect(inst)}
                    className="bg-slate-800/70 hover:bg-slate-750 border border-slate-700/80 hover:border-sky-500/80 rounded-xl p-2.5 cursor-pointer transition-all flex items-center justify-between gap-2.5 group active:scale-[0.98]"
                  >
                    {/* Left: Avatar with Instrument Color & Icon */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-xs border border-white/10"
                        style={{
                          backgroundColor: `${inst.color}25`,
                          borderColor: `${inst.color}55`,
                        }}
                      >
                        <span>{iconEmoji}</span>
                      </div>

                      {/* Middle: Name & Clef/Family */}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate">
                          {inst.name}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span
                            className="font-serif font-black text-slate-300"
                            title={`${clefName} Clef`}
                          >
                            {clefSymbol} {clefName}
                          </span>
                          <span>·</span>
                          <span className="truncate">{inst.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Audio Preview & Add */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handlePreview(e, inst)}
                        title={`Audition ${inst.name}`}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isPreviewing
                            ? 'bg-amber-500 border-amber-400 text-slate-950 animate-bounce'
                            : 'bg-slate-700/60 border-slate-600/60 text-slate-300 hover:text-white hover:bg-slate-600'
                        }`}
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="w-6 h-6 rounded-lg bg-slate-700/40 group-hover:bg-sky-500 group-hover:text-white text-slate-500 flex items-center justify-center transition-all">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
