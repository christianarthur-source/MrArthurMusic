import React, { useState, useEffect, useMemo } from 'react';
import { DRUM_GROOVES, DrumGroove } from '../data/drumGrooves';
import { DrumKitType } from '../audio/acousticSamples';
import { X, Play, Square, Plus } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface DrumBeatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDrumTrack: (groove: DrumGroove) => void;
  onApplyToSelectedTrack?: (groove: DrumGroove) => void;
  hasSelectedTrack?: boolean;
}

export type DrumCategory = 'all' | 'rock_pop' | 'hiphop_808' | 'jazz_folk' | 'latin_world';

const CATEGORIES: {
  id: DrumCategory;
  label: string;
  icon: string;
  countPredicate: (g: DrumGroove) => boolean;
}[] = [
  {
    id: 'all',
    label: 'All Beats',
    icon: '🌟',
    countPredicate: () => true,
  },
  {
    id: 'rock_pop',
    label: 'Rock & Pop',
    icon: '🎸',
    countPredicate: (g) => g.kitType === 'drum_kit',
  },
  {
    id: 'hiphop_808',
    label: 'Hip-Hop & 808',
    icon: '🎛️',
    countPredicate: (g) => g.kitType === 'drum_808',
  },
  {
    id: 'jazz_folk',
    label: 'Jazz & Folk',
    icon: '🎷',
    countPredicate: (g) => g.kitType === 'drum_jazz',
  },
  {
    id: 'latin_world',
    label: 'Latin & World',
    icon: '🌴',
    countPredicate: (g) => g.kitType === 'drum_latin',
  },
];

function getKitBadgeInfo(kitType: DrumKitType) {
  switch (kitType) {
    case 'drum_808':
      return {
        label: '🎛️ 808 Machine',
        className: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      };
    case 'drum_jazz':
      return {
        label: '🎷 Jazz & Folk',
        className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      };
    case 'drum_latin':
      return {
        label: '🌴 Latin & World',
        className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      };
    case 'drum_kit':
    default:
      return {
        label: '🎸 Rock Kit',
        className: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      };
  }
}

export const DrumBeatsModal: React.FC<DrumBeatsModalProps> = ({
  isOpen,
  onClose,
  onAddDrumTrack,
  onApplyToSelectedTrack,
  hasSelectedTrack,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DrumCategory>('all');
  const [playingGrooveId, setPlayingGrooveId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  // Preload all 4 specialized drum kits on modal mount
  useEffect(() => {
    if (isOpen) {
      soundEngine.preloadInstrument('drum_kit');
      soundEngine.preloadInstrument('drum_808');
      soundEngine.preloadInstrument('drum_jazz');
      soundEngine.preloadInstrument('drum_latin');
    } else {
      soundEngine.stopDrumPreview();
      setPlayingGrooveId(null);
      setActiveStep(0);
    }
  }, [isOpen]);

  const activeCategoryConfig = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategory) || CATEGORIES[0],
    [selectedCategory]
  );

  const filteredGrooves = useMemo(() => {
    return DRUM_GROOVES.filter(activeCategoryConfig.countPredicate);
  }, [activeCategoryConfig]);

  if (!isOpen) return null;

  const handleTogglePreview = (groove: DrumGroove) => {
    if (playingGrooveId === groove.id) {
      soundEngine.stopDrumPreview();
      setPlayingGrooveId(null);
      setActiveStep(0);
    } else {
      setPlayingGrooveId(groove.id);
      setActiveStep(0);
      const drumType = groove.kitType || 'drum_kit';
      soundEngine.playDrumGroove(
        groove.previewPattern,
        groove.tempo,
        4,
        (step: number) => {
          setActiveStep(step);
        },
        () => {
          setPlayingGrooveId(null);
          setActiveStep(0);
        },
        drumType
      );
    }
  };

  const handleSelectGroove = (groove: DrumGroove) => {
    soundEngine.stopDrumPreview();
    setPlayingGrooveId(null);
    onAddDrumTrack(groove);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-base">
              🥁
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Select Drum Beat</span>
                <span className="text-xs font-normal text-slate-400">
                  ({filteredGrooves.length} beats)
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.stopDrumPreview();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Consolidated Style Categories - Flex Wrap with ZERO horizontal scrollbar */}
        <div className="p-2.5 sm:p-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
          {CATEGORIES.map((cat) => {
            const count = DRUM_GROOVES.filter(cat.countPredicate).length;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected ? 'bg-rose-700 text-rose-100' : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Condensed Beats Grid */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredGrooves.map((groove) => {
              const isPlaying = playingGrooveId === groove.id;
              const kitInfo = getKitBadgeInfo(groove.kitType || 'drum_kit');

              return (
                <div
                  key={groove.id}
                  className={`bg-slate-800/70 border rounded-xl p-3 transition-all flex flex-col justify-between gap-2.5 ${
                    isPlaying
                      ? 'border-rose-500 bg-slate-800/95 shadow-md shadow-rose-500/10 ring-1 ring-rose-500/30'
                      : 'border-slate-700/80 hover:border-slate-600 hover:bg-slate-750'
                  }`}
                >
                  <div>
                    {/* Top Row: Title & Preview Button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-white truncate" title={groove.name}>
                          {groove.name}
                        </h3>
                      </div>

                      {/* Mini Preview Button */}
                      <button
                        onClick={() => handleTogglePreview(groove)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                          isPlaying
                            ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                            : 'bg-slate-700/80 text-slate-200 hover:text-white hover:bg-slate-600'
                        }`}
                        title={isPlaying ? 'Stop Preview' : 'Audition Beat'}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3 h-3 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current" />
                            <span>Play</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Metadata Badges Row: BPM, Meter, Kit Type */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px]">
                      {/* Tempo */}
                      <span className="px-1.5 py-0.5 rounded-md font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        {groove.tempo} BPM
                      </span>

                      {/* Meter */}
                      <span className="px-1.5 py-0.5 rounded-md font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/40">
                        {groove.timeSignature[0]}/{groove.timeSignature[1]}
                      </span>

                      {/* Kit Type */}
                      <span className={`px-1.5 py-0.5 rounded-md font-semibold border ${kitInfo.className}`}>
                        {kitInfo.label}
                      </span>

                      {/* Style */}
                      <span className="px-1.5 py-0.5 rounded-md font-medium text-slate-400">
                        {groove.style}
                      </span>
                    </div>

                    {/* Slim 16-Step Visualizer */}
                    <div className="mt-2.5 h-1.5 w-full bg-slate-950/80 rounded-full overflow-hidden flex gap-0.5 p-0.2">
                      {Array.from({ length: 16 }).map((_, stepIdx) => {
                        const isCurrentStep = isPlaying && activeStep === stepIdx;
                        const hasSound = groove.previewPattern.some((ev) => ev.step === stepIdx);

                        return (
                          <div
                            key={stepIdx}
                            className={`h-full flex-1 rounded-full transition-all ${
                              isCurrentStep
                                ? 'bg-amber-400'
                                : hasSound
                                ? stepIdx % 4 === 0
                                  ? 'bg-rose-500'
                                  : 'bg-rose-500/50'
                                : 'bg-slate-800'
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-700/50">
                    <button
                      onClick={() => handleSelectGroove(groove)}
                      className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Track</span>
                    </button>

                    {hasSelectedTrack && onApplyToSelectedTrack && (
                      <button
                        onClick={() => {
                          soundEngine.stopDrumPreview();
                          setPlayingGrooveId(null);
                          onApplyToSelectedTrack(groove);
                          onClose();
                        }}
                        className="px-2 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold rounded-lg border border-slate-600/50 transition-all"
                        title="Fill the selected staff with this rhythm"
                      >
                        Fill Staff
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
