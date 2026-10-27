import React, { useState } from 'react';
import { DEFAULT_TRACK_FX, HALLOWEEN_TRACK_FX_FIRST, HALLOWEEN_TRACK_FX_MELODIC, HALLOWEEN_TRACK_FX_DRUMS, Track, TrackFxSettings } from '../types/music';
import { INSTRUMENTS } from '../data/instruments';
import {
  Volume2,
  VolumeX,
  Trash2,
  X,
  Plus,
  Sliders,
  Sparkles,
  RotateCcw,
  Radio,
} from 'lucide-react';

interface TrackStripProps {
  tracks: Track[];
  onUpdateTrack: (trackIndex: number, updates: Partial<Track>) => void;
  onRemoveTrack: (trackIndex: number) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenAddInstrument: () => void;
}

const INSTRUMENTS_BY_CATEGORY = Object.values(INSTRUMENTS).reduce((acc, inst) => {
  if (!acc[inst.category]) acc[inst.category] = [];
  acc[inst.category].push(inst);
  return acc;
}, {} as Record<string, (typeof INSTRUMENTS)[keyof typeof INSTRUMENTS][]>);

const FX_PRESETS: { name: string; fx: TrackFxSettings }[] = [
  {
    name: '🎃 Spooky Haunted',
    fx: { reverb: 0.90, delay: 0.45, chorus: 0.25, eqBass: 1, eqTreble: 2, drive: 0 },
  },
  {
    name: 'Studio Clean',
    fx: { reverb: 0.18, delay: 0, chorus: 0, eqBass: 0, eqTreble: 0, drive: 0 },
  },
  {
    name: 'Concert Hall',
    fx: { reverb: 0.65, delay: 0.08, chorus: 0.12, eqBass: 2, eqTreble: 1, drive: 0 },
  },
  {
    name: 'Echo / Delay',
    fx: { reverb: 0.28, delay: 0.55, chorus: 0.1, eqBass: 0, eqTreble: 2, drive: 0 },
  },
  {
    name: 'Lush Chorus',
    fx: { reverb: 0.35, delay: 0.15, chorus: 0.7, eqBass: 1, eqTreble: 2, drive: 0 },
  },
  {
    name: 'Warm Amp Drive',
    fx: { reverb: 0.22, delay: 0.12, chorus: 0, eqBass: 4, eqTreble: 3, drive: 0.55 },
  },
];

function formatPan(pan: number): string {
  if (Math.abs(pan) < 0.04) return 'C';
  if (pan < 0) return `L${Math.round(Math.abs(pan) * 100)}`;
  return `R${Math.round(pan * 100)}`;
}

export const TrackStrip: React.FC<TrackStripProps> = ({
  tracks,
  onUpdateTrack,
  onRemoveTrack,
  isOpen,
  onClose,
  onOpenAddInstrument,
}) => {
  const [selectedFxTrackIdx, setSelectedFxTrackIdx] = useState<number>(0);

  if (!isOpen) return null;

  const activeFxTrackIdx = Math.min(selectedFxTrackIdx, Math.max(0, tracks.length - 1));
  const activeFxTrack = tracks[activeFxTrackIdx];
  const activeFx: TrackFxSettings = {
    ...DEFAULT_TRACK_FX,
    ...(activeFxTrack?.fx || {}),
  };

  const updateTrackFx = (trackIndex: number, partialFx: Partial<TrackFxSettings>) => {
    const currentFx: TrackFxSettings = {
      ...DEFAULT_TRACK_FX,
      ...(tracks[trackIndex]?.fx || {}),
    };
    onUpdateTrack(trackIndex, {
      fx: {
        ...currentFx,
        ...partialFx,
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
      />

      {/* Virtual Studio Mixer Console Modal */}
      <div className="relative z-10 w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/90 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Console Top Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-white">
                  Virtual Studio Mixer & FX Console
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Live Audio Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Adjust channel faders, stereo panning (L/R), mute/solo, and studio effects (Reverb, Delay, Chorus, EQ & Drive) in real time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenAddInstrument();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Track</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Mixer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Mixer Content: Channel Fader Strips + FX Rack */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Vertical Channel Strips */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Channel Faders & Stereo Pan ({tracks.length} {tracks.length === 1 ? 'Track' : 'Tracks'})
              </span>
              <span className="text-[11px] text-slate-400">
                Click a channel to edit its FX rack →
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 pt-1">
              {tracks.map((track, trackIndex) => {
                const instDef = INSTRUMENTS[track.instrumentId];
                const isSelectedForFx = activeFxTrackIdx === trackIndex;
                const pan = track.pan ?? 0;
                const trackFx: TrackFxSettings = {
                  ...DEFAULT_TRACK_FX,
                  ...(track.fx || {}),
                };
                const effectiveVolPercent = track.muted ? 0 : Math.round(track.volume * 100);

                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedFxTrackIdx(trackIndex)}
                    className={`w-44 shrink-0 rounded-2xl p-3 flex flex-col justify-between gap-3 border transition-all cursor-pointer ${
                      isSelectedForFx
                        ? 'bg-slate-800/95 border-indigo-500 shadow-lg shadow-indigo-500/10'
                        : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Track Header & Color Pill */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: instDef?.color || '#38bdf8' }}
                          />
                          <span
                            className="text-xs font-extrabold text-white truncate"
                            title={track.name}
                          >
                            {track.name}
                          </span>
                        </div>
                        {tracks.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveTrack(trackIndex);
                            }}
                            title="Delete Track"
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Instrument Selector */}
                      <select
                        value={track.instrumentId}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const newInstId = e.target.value as any;
                          const newInst = INSTRUMENTS[newInstId as keyof typeof INSTRUMENTS];
                          if (newInst) {
                            onUpdateTrack(trackIndex, {
                              instrumentId: newInstId,
                              name: newInst.name,
                              clef: newInst.clef,
                            });
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-semibold rounded-lg px-2 py-1 focus:outline-hidden focus:border-indigo-400 cursor-pointer"
                      >
                        {Object.entries(INSTRUMENTS_BY_CATEGORY).map(([category, instList]) => (
                          <optgroup key={category} label={category} className="bg-slate-900 text-white">
                            {instList.map((inst) => (
                              <option key={inst.id} value={inst.id}>
                                {inst.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* Stereo Pan Control */}
                    <div
                      className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 flex flex-col gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400">PAN (L / R)</span>
                        <button
                          onClick={() => onUpdateTrack(trackIndex, { pan: 0 })}
                          title="Click to reset pan to Center"
                          className="text-cyan-300 hover:underline font-mono cursor-pointer"
                        >
                          {formatPan(pan)}
                        </button>
                      </div>
                      <input
                        type="range"
                        min="-1"
                        max="1"
                        step="0.05"
                        value={pan}
                        onChange={(e) =>
                          onUpdateTrack(trackIndex, { pan: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <div className="flex justify-between text-[9px] text-slate-500 font-bold">
                        <span>L</span>
                        <span>C</span>
                        <span>R</span>
                      </div>
                    </div>

                    {/* Mute / Solo Buttons */}
                    <div
                      className="grid grid-cols-2 gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onUpdateTrack(trackIndex, { muted: !track.muted })}
                        className={`py-1.5 rounded-lg text-xs font-black tracking-wide transition-all cursor-pointer ${
                          track.muted
                            ? 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                            : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Mute Track"
                      >
                        MUTE
                      </button>
                      <button
                        onClick={() => onUpdateTrack(trackIndex, { soloed: !track.soloed })}
                        className={`py-1.5 rounded-lg text-xs font-black tracking-wide transition-all cursor-pointer ${
                          track.soloed
                            ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/30'
                            : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
                        }`}
                        title="Solo Track"
                      >
                        SOLO
                      </button>
                    </div>

                    {/* Vertical Fader Section */}
                    <div
                      className="bg-slate-950 border border-slate-800/90 rounded-xl p-2.5 flex flex-col items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-full flex items-center justify-between text-[10px] font-bold">
                        <span className="text-slate-400 flex items-center gap-1">
                          {track.muted ? (
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                          LEVEL
                        </span>
                        <span className="font-mono text-emerald-300">{effectiveVolPercent}%</span>
                      </div>

                      {/* Vertical Fader Bar + Range Input */}
                      <div className="relative h-32 w-full flex items-center justify-center">
                        {/* dB Scale Tick Marks */}
                        <div className="absolute left-2 inset-y-1 flex flex-col justify-between text-[9px] font-mono text-slate-600 pointer-events-none">
                          <span>0dB</span>
                          <span>-6</span>
                          <span>-12</span>
                          <span>-24</span>
                          <span>-∞</span>
                        </div>

                        {/* Visual LED Meter Bar */}
                        <div className="w-3 h-28 bg-slate-900 rounded-full overflow-hidden border border-slate-800 flex flex-col justify-end mr-4">
                          <div
                            className={`w-full transition-all duration-100 rounded-full ${
                              track.muted
                                ? 'bg-rose-500/40'
                                : effectiveVolPercent > 85
                                ? 'bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-400'
                                : 'bg-gradient-to-t from-emerald-600 to-cyan-400'
                            }`}
                            style={{ height: `${effectiveVolPercent}%` }}
                          />
                        </div>

                        {/* Vertical Slider */}
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.02"
                          value={track.muted ? 0 : track.volume}
                          onChange={(e) =>
                            onUpdateTrack(trackIndex, {
                              volume: parseFloat(e.target.value),
                              muted: false,
                            })
                          }
                          className="w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-400 -rotate-90"
                          title={`Channel Volume: ${effectiveVolPercent}%`}
                        />
                      </div>
                    </div>

                    {/* Quick Mini FX Summary Pill */}
                    <div className="flex items-center justify-between text-[10px] px-1 pt-0.5 text-slate-400">
                      <span className="flex items-center gap-1 font-bold text-indigo-300">
                        <Sparkles className="w-3 h-3" />
                        FX Rack
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        Rev {Math.round(trackFx.reverb * 100)}% · Dly {Math.round(trackFx.delay * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Per-Track Studio FX Rack */}
          <div className="lg:col-span-5 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4">
            {activeFxTrack ? (
              <>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-indigo-400" />
                      <div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300">
                          Track FX Rack — {activeFxTrack.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Real-time Web Audio effects processor for this channel
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => updateTrackFx(activeFxTrackIdx, DEFAULT_TRACK_FX)}
                      title="Reset FX to default"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset FX</span>
                    </button>
                  </div>

                  {/* FX Presets */}
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                      Quick Studio FX Presets
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {FX_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => updateTrackFx(activeFxTrackIdx, preset.fx)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FX Controls Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* 1. Reverb */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-sky-300">Concert Hall Reverb</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {Math.round(activeFx.reverb * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeFx.reverb}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { reverb: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Adds stereo acoustic room & hall depth
                      </span>
                    </div>

                    {/* 2. Echo / Delay */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-purple-300">Stereo Echo / Delay</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {Math.round(activeFx.delay * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeFx.delay}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { delay: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Rhythmic repeating delay reflections
                      </span>
                    </div>

                    {/* 3. Stereo Chorus */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-cyan-300">Lush Chorus Widener</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {Math.round(activeFx.chorus * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeFx.chorus}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { chorus: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Modulated detuned ensemble shimmer
                      </span>
                    </div>

                    {/* 4. Warm Overdrive */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-amber-300">Warm Tube Drive</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {Math.round(activeFx.drive * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeFx.drive}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { drive: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Soft harmonic saturation & punch
                      </span>
                    </div>

                    {/* 5. Bass EQ */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-emerald-300">Bass EQ (180 Hz)</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeFx.eqBass > 0 ? `+${activeFx.eqBass}` : activeFx.eqBass} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={activeFx.eqBass}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { eqBass: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Boost or cut low-end warmth
                      </span>
                    </div>

                    {/* 6. Treble EQ */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-rose-300">Treble EQ (3.5 kHz)</span>
                        <span className="font-mono text-[11px] text-slate-300">
                          {activeFx.eqTreble > 0 ? `+${activeFx.eqTreble}` : activeFx.eqTreble} dB
                        </span>
                      </div>
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="1"
                        value={activeFx.eqTreble}
                        onChange={(e) =>
                          updateTrackFx(activeFxTrackIdx, { eqTreble: parseFloat(e.target.value) })
                        }
                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-400"
                      />
                      <span className="text-[10px] text-slate-500">
                        Boost or cut high-frequency sparkle
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/70 border border-slate-800/80 rounded-xl px-3 py-2 flex items-center justify-between">
                  <span>
                    Tip: All mixer faders, panning, and FX settings are included when you download a <b>.wav</b> audio file or share your song link!
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
