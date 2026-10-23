import React, { useState, useEffect } from 'react';
import { DRUM_GROOVES, DrumGroove, DrumStyle } from '../data/drumGrooves';
import { X, Play, Square, Plus, Sparkles, Drum, Music } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface DrumBeatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDrumTrack: (groove: DrumGroove) => void;
  onApplyToSelectedTrack?: (groove: DrumGroove) => void;
  hasSelectedTrack?: boolean;
}

export const DrumBeatsModal: React.FC<DrumBeatsModalProps> = ({
  isOpen,
  onClose,
  onAddDrumTrack,
  onApplyToSelectedTrack,
  hasSelectedTrack,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<DrumStyle | 'All'>('All');
  const [playingGrooveId, setPlayingGrooveId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number>(0);

  useEffect(() => {
    // Stop preview on modal close or unmount
    if (!isOpen) {
      soundEngine.stopDrumPreview();
      setPlayingGrooveId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const styles: (DrumStyle | 'All')[] = [
    'All',
    'Rock',
    'Pop',
    'Indie',
    'Jazz',
    'World',
    'Latin',
    'African',
    'Folk',
  ];

  const filteredGrooves = DRUM_GROOVES.filter(
    (g) => selectedStyle === 'All' || g.style === selectedStyle
  );

  const handleTogglePreview = (groove: DrumGroove) => {
    if (playingGrooveId === groove.id) {
      soundEngine.stopDrumPreview();
      setPlayingGrooveId(null);
      setActiveStep(0);
    } else {
      setPlayingGrooveId(groove.id);
      setActiveStep(0);
      soundEngine.playDrumGroove(
        groove.previewPattern,
        groove.tempo,
        4, // play 4 bars of preview
        (step: number) => {
          setActiveStep(step);
        },
        () => {
          setPlayingGrooveId(null);
          setActiveStep(0);
        }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 via-amber-500 to-indigo-500 flex items-center justify-center text-2xl shadow-lg ring-4 ring-rose-500/20">
              🥁
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Pre-Made Drum Beats & Grooves</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Selectable Styles
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentic drum rhythms for Rock, Pop, Indie, Jazz, World, Latin, African, and Folk music.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.stopDrumPreview();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Style Selector Tabs */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              className={`px-3.5 py-2 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                selectedStyle === style
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-750'
              }`}
            >
              {style === 'All' && <span>🌟 All Styles</span>}
              {style === 'Rock' && <span>🎸 Rock</span>}
              {style === 'Jazz' && <span>🎷 Jazz</span>}
              {style === 'Folk' && <span>🪕 Folk</span>}
              {style === 'Pop' && <span>🎧 Pop</span>}
              {style === 'Latin' && <span>💃 Latin</span>}
              {style === 'African' && <span>🌍 African</span>}
            </button>
          ))}
        </div>

        {/* Drum Key / Legend Banner */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-slate-300 flex items-center gap-1">
            <Music className="w-3.5 h-3.5 text-rose-400" /> Standard Drum Notation:
          </span>
          <span><b className="text-rose-400">F4</b>: Bass Kick</span>
          <span><b className="text-sky-400">C5</b>: Snare Drum</span>
          <span><b className="text-amber-400">G5</b>: Closed Hi-Hat</span>
          <span><b className="text-emerald-400">A5</b>: Open Hat / Crash</span>
          <span><b className="text-indigo-400">E5</b>: Rimshot / Clave</span>
          <span><b className="text-purple-400">F5</b>: Ride / Cowbell</span>
        </div>

        {/* Beats Grid */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGrooves.map((groove) => {
              const isPlaying = playingGrooveId === groove.id;

              return (
                <div
                  key={groove.id}
                  className={`bg-slate-800/70 border rounded-2xl p-4 transition-all flex flex-col justify-between ${
                    isPlaying
                      ? 'border-rose-500 bg-slate-800 shadow-xl shadow-rose-500/10 ring-2 ring-rose-500/30'
                      : 'border-slate-700/80 hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Header: Title & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{groove.name}</h3>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {groove.style}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>{groove.timeSignature[0]}/{groove.timeSignature[1]} Meter</span>
                          <span>·</span>
                          <span className="font-mono text-amber-300">{groove.tempo} BPM</span>
                          <span>·</span>
                          <span>{groove.badge}</span>
                        </div>
                      </div>

                      {/* Preview Button */}
                      <button
                        onClick={() => handleTogglePreview(groove)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 ${
                          isPlaying
                            ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        }`}
                        title={isPlaying ? 'Stop Preview' : 'Listen to Preview'}
                      >
                        {isPlaying ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {groove.description}
                    </p>

                    {/* Step Visualizer */}
                    <div className="mt-3 p-2 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between gap-1">
                      {Array.from({ length: 16 }).map((_, stepIdx) => {
                        const isCurrentStep = isPlaying && activeStep === stepIdx;
                        const hasSound = groove.previewPattern.some((ev) => ev.step === stepIdx);

                        return (
                          <div
                            key={stepIdx}
                            className={`h-4 flex-1 rounded-sm transition-all ${
                              isCurrentStep
                                ? 'bg-amber-400 scale-110 shadow-xs shadow-amber-400'
                                : hasSound
                                ? stepIdx % 4 === 0
                                  ? 'bg-rose-500'
                                  : 'bg-rose-500/50'
                                : 'bg-slate-800'
                            }`}
                            title={`Step ${stepIdx + 1}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleSelectGroove(groove)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add as Drum Track</span>
                    </button>

                    {hasSelectedTrack && onApplyToSelectedTrack && (
                      <button
                        onClick={() => {
                          soundEngine.stopDrumPreview();
                          setPlayingGrooveId(null);
                          onApplyToSelectedTrack(groove);
                          onClose();
                        }}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-all"
                        title="Fill the selected staff with this drum groove"
                      >
                        Apply to Selected Staff
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
