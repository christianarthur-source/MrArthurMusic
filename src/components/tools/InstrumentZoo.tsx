import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Search, Sparkles, Filter, Music } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import { InstrumentId, Pitch } from '../../types/music';

interface InstrumentCardInfo {
  id: InstrumentId;
  name: string;
  family: 'Strings' | 'Woodwinds' | 'Brass' | 'Percussion' | 'World & Popular';
  iconEmoji: string;
  clef: 'treble' | 'bass';
  pitchRange: string;
  familyColor: string;
  badgeBg: string;
  previewNotes: Pitch[];
  funFact: string;
  soundDescription: string;
}

const INSTRUMENT_ZOO_DATA: InstrumentCardInfo[] = [
  // STRINGS
  {
    id: 'violin',
    name: 'Violin',
    family: 'Strings',
    iconEmoji: '🎻',
    clef: 'treble',
    pitchRange: 'G3 to E7',
    familyColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    previewNotes: [
      { step: 'G', octave: 4 },
      { step: 'B', octave: 4 },
      { step: 'D', octave: 5 },
      { step: 'G', octave: 5 },
      { step: 'B', octave: 5 },
    ],
    funFact: 'Violin bows are strung with 150 to 200 hairs from horse tails!',
    soundDescription: 'Singing, sweet, and expressive bowed string sound.',
  },
  {
    id: 'cello',
    name: 'Cello',
    family: 'Strings',
    iconEmoji: '🎻',
    clef: 'bass',
    pitchRange: 'C2 to A4',
    familyColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    previewNotes: [
      { step: 'C', octave: 3 },
      { step: 'E', octave: 3 },
      { step: 'G', octave: 3 },
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
    ],
    funFact: 'The cellist sits down with the cello resting on an endpin on the floor!',
    soundDescription: 'Deep, warm, and resonant bass tone.',
  },
  {
    id: 'acoustic_guitar',
    name: 'Acoustic Guitar',
    family: 'Strings',
    iconEmoji: '🎸',
    clef: 'treble',
    pitchRange: 'E2 to B5',
    familyColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    previewNotes: [
      { step: 'E', octave: 3 },
      { step: 'G', octave: 3 },
      { step: 'B', octave: 3 },
      { step: 'E', octave: 4 },
      { step: 'G', octave: 4 },
    ],
    funFact: 'The hollow wooden body naturally amplifies the vibrating strings!',
    soundDescription: 'Warm, rhythmic acoustic strumming & fingerpicking.',
  },
  {
    id: 'harp',
    name: 'Concert Harp',
    family: 'Strings',
    iconEmoji: '🪕',
    clef: 'treble',
    pitchRange: 'C1 to G7',
    familyColor: '#F59E0B',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    previewNotes: [
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
      { step: 'G', octave: 4 },
      { step: 'B', octave: 4 },
      { step: 'D', octave: 5 },
      { step: 'G', octave: 5 },
    ],
    funFact: 'A concert harp has 47 strings and 7 foot pedals to change accidentals!',
    soundDescription: 'Heavenly, shimmering plucked glissandos.',
  },

  // WOODWINDS
  {
    id: 'flute',
    name: 'Concert Flute',
    family: 'Woodwinds',
    iconEmoji: '🪈',
    clef: 'treble',
    pitchRange: 'C4 to D7',
    familyColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    previewNotes: [
      { step: 'C', octave: 5 },
      { step: 'E', octave: 5 },
      { step: 'G', octave: 5 },
      { step: 'C', octave: 6 },
      { step: 'E', octave: 6 },
    ],
    funFact: 'Even though modern flutes are made of metal, they are woodwinds because sound is made by air splitting across a hole!',
    soundDescription: 'Bright, airy, silvery and birdsong-like.',
  },
  {
    id: 'recorder',
    name: 'Soprano Recorder',
    family: 'Woodwinds',
    iconEmoji: '🪈',
    clef: 'treble',
    pitchRange: 'C5 to D7',
    familyColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    previewNotes: [
      { step: 'C', octave: 5 },
      { step: 'D', octave: 5 },
      { step: 'E', octave: 5 },
      { step: 'G', octave: 5 },
      { step: 'A', octave: 5 },
    ],
    funFact: 'The recorder has been played in music classrooms and royal courts for over 700 years!',
    soundDescription: 'Pure, sweet classroom flute tone.',
  },
  {
    id: 'clarinet',
    name: 'Clarinet',
    family: 'Woodwinds',
    iconEmoji: '🎷',
    clef: 'treble',
    pitchRange: 'D3 to A6',
    familyColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    previewNotes: [
      { step: 'E', octave: 3 },
      { step: 'G', octave: 3 },
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
      { step: 'G', octave: 4 },
    ],
    funFact: 'Sound is created by a single cane wooden reed vibrating against a mouthpiece!',
    soundDescription: 'Mellow, woody low notes and soaring bright highs.',
  },
  {
    id: 'oboe',
    name: 'Oboe',
    family: 'Woodwinds',
    iconEmoji: '🎷',
    clef: 'treble',
    pitchRange: 'B3 to G6',
    familyColor: '#06B6D4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    previewNotes: [
      { step: 'A', octave: 4 },
      { step: 'C', octave: 5 },
      { step: 'E', octave: 5 },
      { step: 'A', octave: 5 },
    ],
    funFact: 'The oboe plays the concert "A" note to tune the entire orchestra before every concert!',
    soundDescription: 'Rich, piercing, lyrical double-reed sound.',
  },

  // BRASS
  {
    id: 'trumpet',
    name: 'B♭ Trumpet',
    family: 'Brass',
    iconEmoji: '🎺',
    clef: 'treble',
    pitchRange: 'F#3 to C6',
    familyColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    previewNotes: [
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
      { step: 'G', octave: 4 },
      { step: 'C', octave: 5 },
      { step: 'G', octave: 5 },
    ],
    funFact: 'You buzz your lips into a metal cup mouthpiece to produce sound on all brass instruments!',
    soundDescription: 'Heroic, radiant fanfare tone that cuts through the band.',
  },
  {
    id: 'trombone',
    name: 'Trombone',
    family: 'Brass',
    iconEmoji: '🎺',
    clef: 'bass',
    pitchRange: 'E2 to F5',
    familyColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    previewNotes: [
      { step: 'F', octave: 2 },
      { step: 'A', octave: 2 },
      { step: 'C', octave: 3 },
      { step: 'F', octave: 3 },
      { step: 'C', octave: 4 },
    ],
    funFact: 'The trombone uses a telescoping slide with 7 positions instead of finger valves!',
    soundDescription: 'Bold, commanding brass slides and majestic fanfares.',
  },
  {
    id: 'french_horn',
    name: 'French Horn',
    family: 'Brass',
    iconEmoji: '📯',
    clef: 'treble',
    pitchRange: 'F2 to C6',
    familyColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    previewNotes: [
      { step: 'C', octave: 4 },
      { step: 'F', octave: 4 },
      { step: 'A', octave: 4 },
      { step: 'C', octave: 5 },
    ],
    funFact: 'If you uncoiled all the tubing in a French horn, it would be over 12 feet long!',
    soundDescription: 'Noble, velvety, romantic hunting horn sound.',
  },
  {
    id: 'tuba',
    name: 'Tuba',
    family: 'Brass',
    iconEmoji: '🎺',
    clef: 'bass',
    pitchRange: 'D1 to F4',
    familyColor: '#EAB308',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    previewNotes: [
      { step: 'C', octave: 2 },
      { step: 'G', octave: 2 },
      { step: 'C', octave: 3 },
      { step: 'E', octave: 3 },
    ],
    funFact: 'The tuba is the largest and lowest-pitched instrument in the entire brass family!',
    soundDescription: 'Thunderous, earth-shaking orchestral bass foundation.',
  },

  // PERCUSSION
  {
    id: 'xylophone',
    name: 'Orchestral Xylophone',
    family: 'Percussion',
    iconEmoji: '🪵',
    clef: 'treble',
    pitchRange: 'F4 to C8',
    familyColor: '#10B981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    previewNotes: [
      { step: 'C', octave: 5 },
      { step: 'E', octave: 5 },
      { step: 'G', octave: 5 },
      { step: 'B', octave: 5 },
      { step: 'C', octave: 6 },
    ],
    funFact: 'The name "Xylophone" comes from the Greek words for "wood" and "sound"!',
    soundDescription: 'Crisp, bright, snappy wooden bar strikes with hard mallets.',
  },
  {
    id: 'marimba',
    name: 'Concert Marimba',
    family: 'Percussion',
    iconEmoji: '🪵',
    clef: 'treble',
    pitchRange: 'C2 to C7',
    familyColor: '#10B981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    previewNotes: [
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
      { step: 'G', octave: 4 },
      { step: 'C', octave: 5 },
      { step: 'E', octave: 5 },
    ],
    funFact: 'Metal resonator tubes hanging beneath each rosewood bar amplify the deep notes!',
    soundDescription: 'Warm, mellow, resonant wooden singing tones.',
  },
  {
    id: 'timpani',
    name: 'Timpani (Kettle Drums)',
    family: 'Percussion',
    iconEmoji: '🥁',
    clef: 'bass',
    pitchRange: 'C2 to C4',
    familyColor: '#10B981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    previewNotes: [
      { step: 'G', octave: 2 },
      { step: 'C', octave: 3 },
      { step: 'G', octave: 3 },
    ],
    funFact: 'Timpani are tuned to specific musical pitches using a foot pedal while playing!',
    soundDescription: 'Booming, dramatic orchestral thunder beats.',
  },

  // WORLD & POPULAR
  {
    id: 'ukulele',
    name: 'Hawaiian Ukulele',
    family: 'World & Popular',
    iconEmoji: '🪕',
    clef: 'treble',
    pitchRange: 'C4 to A5',
    familyColor: '#EC4899',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    previewNotes: [
      { step: 'G', octave: 4 },
      { step: 'C', octave: 4 },
      { step: 'E', octave: 4 },
      { step: 'A', octave: 4 },
    ],
    funFact: '"Ukulele" translates roughly to "jumping flea" in Hawaiian!',
    soundDescription: 'Cheerful, island-style strummed 4-string harmony.',
  },
  {
    id: 'pan_flute',
    name: 'Andean Pan Flute',
    family: 'World & Popular',
    iconEmoji: '🪈',
    clef: 'treble',
    pitchRange: 'G4 to G6',
    familyColor: '#EC4899',
    badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    previewNotes: [
      { step: 'E', octave: 5 },
      { step: 'G', octave: 5 },
      { step: 'A', octave: 5 },
      { step: 'B', octave: 5 },
      { step: 'D', octave: 6 },
    ],
    funFact: 'Made of multiple bamboo pipes of increasing lengths fastened together!',
    soundDescription: 'Earthy, breathy, folkloric mountain whistle.',
  },
];

type FamilyFilter = 'All' | 'Strings' | 'Woodwinds' | 'Brass' | 'Percussion' | 'World & Popular';

export const InstrumentZoo: React.FC = () => {
  const [selectedFamily, setSelectedFamily] = useState<FamilyFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);

  const previewTimerRef = useRef<number | null>(null);

  // Play instrument preview arpeggio
  const playInstrumentPreview = (inst: InstrumentCardInfo) => {
    if (previewTimerRef.current !== null) {
      clearInterval(previewTimerRef.current);
      previewTimerRef.current = null;
    }

    setCurrentlyPlayingId(inst.id);
    let noteIdx = 0;

    previewTimerRef.current = window.setInterval(() => {
      if (noteIdx >= inst.previewNotes.length) {
        if (previewTimerRef.current !== null) {
          clearInterval(previewTimerRef.current);
          previewTimerRef.current = null;
        }
        setCurrentlyPlayingId(null);
        return;
      }

      const p = inst.previewNotes[noteIdx];
      try {
        soundEngine.playNotePreview(p, inst.id, 0.45, 'C');
      } catch {
        // audio fail-safe
      }
      noteIdx++;
    }, 240);
  };

  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== null) {
        clearInterval(previewTimerRef.current);
      }
    };
  }, []);

  const filteredInstruments = INSTRUMENT_ZOO_DATA.filter((inst) => {
    const matchesFamily = selectedFamily === 'All' || inst.family === selectedFamily;
    const matchesSearch =
      searchQuery.trim() === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.family.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.funFact.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFamily && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search & Family Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        {/* Family Pill Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['All', 'Strings', 'Woodwinds', 'Brass', 'Percussion', 'World & Popular'] as FamilyFilter[]).map(
            (fam) => (
              <button
                key={fam}
                type="button"
                onClick={() => setSelectedFamily(fam)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer font-['Fredoka',sans-serif] ${
                  selectedFamily === fam
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {fam}
              </button>
            )
          )}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search violin, flute, tuba..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Grid of Interactive Instrument Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInstruments.map((inst) => {
          const isPlaying = currentlyPlayingId === inst.id;

          return (
            <div
              key={inst.id}
              className={`rounded-2xl p-4 sm:p-5 flex flex-col justify-between border-2 transition-all duration-200 group bg-slate-900/90 shadow-lg ${
                isPlaying
                  ? 'border-amber-400 shadow-xl shadow-amber-500/20 scale-102 ring-2 ring-amber-400/50'
                  : 'border-slate-800 hover:border-slate-700 hover:scale-101'
              }`}
            >
              <div className="space-y-3">
                {/* Header: Icon, Name & Family Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      {inst.iconEmoji}
                    </div>
                    <div>
                      <h4 className="text-base sm:text-lg font-black text-white font-['Fredoka',sans-serif]">
                        {inst.name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${inst.badgeBg}`}>
                        {inst.family}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-slate-400">
                    {inst.clef === 'treble' ? '🎼 Treble' : '𝄢 Bass'}
                  </span>
                </div>

                {/* Sound Description */}
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  {inst.soundDescription}
                </p>

                {/* Did You Know / Fun Fact */}
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-amber-200/90 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Did you know?</strong> {inst.funFact}
                  </span>
                </div>
              </div>

              {/* Action Button: Hear Me Play */}
              <div className="pt-4 mt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => playInstrumentPreview(inst)}
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all font-['Fredoka',sans-serif] ${
                    isPlaying
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                  }`}
                >
                  <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce text-slate-950' : 'text-amber-400'}`} />
                  <span>{isPlaying ? 'Playing Preview...' : 'Hear Me Play 🔊'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
