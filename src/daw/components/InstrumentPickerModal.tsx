import React, { useState } from 'react';
import { X, Volume2, Sparkles, Search, Check } from 'lucide-react';
import { InstrumentId } from '../../types/music';
import { soundEngine } from '../../audio/soundEngine';

export interface DawInstrumentOption {
  id: InstrumentId;
  name: string;
  category: 'Keyboards' | 'Guitars & Bass' | 'Strings' | 'Brass & Winds' | 'Synths' | 'Mallets & World';
  icon: string;
  description: string;
}

export const DAW_INSTRUMENTS: DawInstrumentOption[] = [
  // Keyboards
  { id: 'piano_treble', name: 'Concert Grand Piano', category: 'Keyboards', icon: '🎹', description: 'Rich, dynamic acoustic grand piano sound' },
  { id: 'electric_piano', name: 'Vintage Rhodes EP', category: 'Keyboards', icon: '⚡', description: 'Warm electric piano with chime bell tone' },
  { id: 'organ', name: 'Church Pipe Organ', category: 'Keyboards', icon: '⛪', description: 'Majestic pipe organ with deep acoustic sustain' },
  { id: 'jazz_organ', name: 'B3 Jazz Tonewheel Organ', category: 'Keyboards', icon: '🎷', description: 'Bluesy, punchy jazz drawbar organ' },
  { id: 'clavinet', name: 'Funky Clavinet', category: 'Keyboards', icon: '🪗', description: 'Crisp percussive staccato funk keys' },
  { id: 'harpsichord', name: 'Baroque Harpsichord', category: 'Keyboards', icon: '🎼', description: 'Bright, plucked classical keyboard' },
  { id: 'music_box', name: 'Lullaby Music Box', category: 'Keyboards', icon: '✨', description: 'Sweet, delicate crystalline metallic tines' },

  // Guitars & Bass
  { id: 'acoustic_guitar', name: 'Acoustic Steel Guitar', category: 'Guitars & Bass', icon: '🎸', description: 'Warm resonate fingerpicked folk guitar' },
  { id: 'electric_guitar', name: 'Clean Strat Guitar', category: 'Guitars & Bass', icon: '🎸', description: 'Bright electric guitar with punchy clarity' },
  { id: 'overdrive_guitar', name: 'Overdrive Rock Guitar', category: 'Guitars & Bass', icon: '⚡', description: 'Saturated crunch guitar for rock riffs' },
  { id: 'ukulele', name: 'Hawaiian Ukulele', category: 'Guitars & Bass', icon: '🏝️', description: 'Cheery, sunny high-pitched strumming' },
  { id: 'electric_bass', name: 'Classic Precision Bass', category: 'Guitars & Bass', icon: '🎸', description: 'Deep, punchy 4-string electric bass' },
  { id: 'slap_bass', name: 'Funk Slap Bass', category: 'Guitars & Bass', icon: '💥', description: 'Thumping thumb slap and aggressive pop' },
  { id: 'synth_bass', name: '808 Analog Synth Bass', category: 'Guitars & Bass', icon: '🔊', description: 'Fat analog low-end sub bass' },

  // Strings
  { id: 'string_ensemble', name: 'Symphony String Section', category: 'Strings', icon: '🎻', description: 'Lush cinematic violins and cellos' },
  { id: 'violin', name: 'Solo Concert Violin', category: 'Strings', icon: '🎻', description: 'Expressive, soaring solo acoustic violin' },
  { id: 'cello', name: 'Deep Solo Cello', category: 'Strings', icon: '🎻', description: 'Warm, emotional woody low strings' },
  { id: 'pizzicato_strings', name: 'Pizzicato Plucked Strings', category: 'Strings', icon: '✨', description: 'Short, playful plucked orchestra strings' },
  { id: 'harp', name: 'Concert Orchestral Harp', category: 'Strings', icon: '🪕', description: 'Dreamy flowing glissando harp' },

  // Brass & Winds
  { id: 'trumpet', name: 'Solo Brass Trumpet', category: 'Brass & Winds', icon: '🎺', description: 'Bright, ringing fanfare trumpet lead' },
  { id: 'french_horn', name: 'Epic French Horn', category: 'Brass & Winds', icon: '📯', description: 'Noble, resonant brass horn for themes' },
  { id: 'trombone', name: 'Tenor Trombone', category: 'Brass & Winds', icon: '🎺', description: 'Rich, bold sliding brass tones' },
  { id: 'brass_section', name: 'Big Band Brass Section', category: 'Brass & Winds', icon: '🎷', description: 'Punchy horn section stabs' },
  { id: 'flute', name: 'Concert Silver Flute', category: 'Brass & Winds', icon: '🪈', description: 'Pure, breathy woodwind melody' },
  { id: 'alto_sax', name: 'Soulful Alto Sax', category: 'Brass & Winds', icon: '🎷', description: 'Smooth, expressive jazz saxophone' },
  { id: 'pan_flute', name: 'Bamboo Pan Flute', category: 'Brass & Winds', icon: '🎋', description: 'Earthy Andean mountain pipes' },
  { id: 'harmonica', name: 'Blues Harmonica', category: 'Brass & Winds', icon: '👄', description: 'Gritty, bent-reed blues harp' },

  // Synths
  { id: 'synth_lead', name: 'Sawtooth EDM Lead', category: 'Synths', icon: '🎹', description: 'Cutting modern electronic synth melody' },
  { id: 'synth_pad', name: 'Cosmic Warm Pad', category: 'Synths', icon: '🌌', description: 'Slow-evolving atmospheric chord cushion' },
  { id: 'choir_aahs', name: 'Vocal Choir Aahs', category: 'Synths', icon: '👼', description: 'Ethereal human choir vocal harmony' },
  { id: 'voice_oohs', name: 'Soft Vocal Oohs', category: 'Synths', icon: '✨', description: 'Intimate choral ambient vocal pad' },

  // Mallets & World
  { id: 'marimba', name: 'Rosewood Marimba', category: 'Mallets & World', icon: '🪵', description: 'Deep, resonant wooden acoustic bars' },
  { id: 'glockenspiel', name: 'Orchestral Bells', category: 'Mallets & World', icon: '🔔', description: 'Shimmering metallic classroom bell chime' },
  { id: 'vibraphone', name: 'Jazz Vibraphone', category: 'Mallets & World', icon: '✨', description: 'Warm mellow vibes with motor tremolo' },
  { id: 'steel_drums', name: 'Caribbean Steel Drums', category: 'Mallets & World', icon: '🛢️', description: 'Tropical, uplifting Trinidadian pans' },
  { id: 'kalimba', name: 'African Thumb Piano', category: 'Mallets & World', icon: '🎶', description: 'Gentle, meditative thumb plucked tines' },
  { id: 'sitar', name: 'Indian Sitar', category: 'Mallets & World', icon: '🪕', description: 'Mystical resonant strings with sympathetic drone' },
  { id: 'banjo', name: 'Bluegrass 5-String Banjo', category: 'Mallets & World', icon: '🪕', description: 'Brisk, plucky acoustic country banjo' },
  { id: 'accordion', name: 'Parisian Accordion', category: 'Mallets & World', icon: '🪗', description: 'Charming French musette accordion' },
];

interface InstrumentPickerModalProps {
  currentInstrumentId?: InstrumentId;
  onSelect: (instrument: DawInstrumentOption) => void;
  onClose: () => void;
  title?: string;
}

export const InstrumentPickerModal: React.FC<InstrumentPickerModalProps> = ({
  currentInstrumentId = 'piano_treble',
  onSelect,
  onClose,
  title = 'Choose Virtual Instrument',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const categories = ['All', 'Keyboards', 'Guitars & Bass', 'Strings', 'Brass & Winds', 'Synths', 'Mallets & World'];

  // Play an acoustic preview note
  const handlePreview = (inst: DawInstrumentOption, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPreviewingId(inst.id);

    // Play a friendly 2-note melody (C4 then G4)
    soundEngine.playNotePreview({ step: 'C', octave: 4 }, inst.id, 0.4);
    setTimeout(() => {
      soundEngine.playNotePreview({ step: 'G', octave: 4 }, inst.id, 0.5);
    }, 180);

    setTimeout(() => {
      setPreviewingId(null);
    }, 700);
  };

  const filtered = DAW_INSTRUMENTS.filter((inst) => {
    const matchCat = selectedCategory === 'All' || inst.category === selectedCategory;
    const matchSearch =
      searchQuery.trim() === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
      <div className="w-full max-w-3xl max-h-[85vh] bg-slate-900 border-2 border-sky-400 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-xl">
              🎹
            </div>
            <div>
              <h3 className="text-base font-black text-white font-['Fredoka',sans-serif] leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400">
                Select a virtual instrument to play live or sequence with MIDI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative w-44 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search instruments..."
                className="w-full pl-8 pr-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="px-5 py-2.5 border-b border-slate-800/80 bg-slate-900/90 flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-sky-400 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-750'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Instruments Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {filtered.map((inst) => {
            const isCurrent = currentInstrumentId === inst.id;
            const isPreviewing = previewingId === inst.id;

            return (
              <div
                key={inst.id}
                onClick={() => {
                  handlePreview(inst);
                  onSelect(inst);
                }}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 group text-left ${
                  isCurrent
                    ? 'bg-sky-500/15 border-sky-400 ring-2 ring-sky-400/40 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-950/70 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                      {inst.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-white font-['Fredoka',sans-serif] truncate">
                        {inst.name}
                      </div>
                      <span className="text-[10px] font-mono text-sky-400 font-bold">
                        {inst.category}
                      </span>
                    </div>
                  </div>

                  {/* Sound preview button */}
                  <button
                    type="button"
                    onClick={(e) => handlePreview(inst, e)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                      isPreviewing
                        ? 'bg-sky-400 text-slate-950 scale-105'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
                    }`}
                    title="Audition Instrument Sound"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isPreviewing ? 'animate-pulse' : ''}`} />
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {inst.description}
                </p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                  <span className="text-slate-400">Click to Select</span>
                  {isCurrent && (
                    <span className="flex items-center gap-1 text-sky-400 font-bold">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
