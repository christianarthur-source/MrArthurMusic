import React, { useMemo } from 'react';
import { X, Sliders, Volume2, VolumeX, ShieldCheck, RotateCcw } from 'lucide-react';
import { DawFxSettings, DawProject, DawTrack } from '../types';

interface MixerModalProps {
  project: DawProject;
  onUpdateTrackFx: (trackId: string, fx: Partial<DawFxSettings>) => void;
  onUpdateMasterVolume: (vol: number) => void;
  onToggleMuteTrack?: (trackId: string) => void;
  onToggleSoloTrack?: (trackId: string) => void;
  onClose: () => void;
}

/**
 * Converts linear volume gain (0 to 1.5) to standard audio decibels (dB)
 */
function gainToDbString(gain: number): string {
  if (gain <= 0.0001) return '-∞ dB';
  const db = 20 * Math.log10(gain);
  if (Math.abs(db) < 0.05) return '0.0 dB';
  return db > 0 ? `+${db.toFixed(1)} dB` : `${db.toFixed(1)} dB`;
}

/**
 * Format stereo pan (-1.0 to +1.0) into L50 / C / R50 readout
 */
function formatPan(pan: number): string {
  if (Math.abs(pan) < 0.05) return 'C';
  if (pan < 0) return `L ${Math.round(Math.abs(pan) * 100)}`;
  return `R ${Math.round(pan * 100)}`;
}

export const MixerModal: React.FC<MixerModalProps> = ({
  project,
  onUpdateTrackFx,
  onUpdateMasterVolume,
  onToggleMuteTrack,
  onToggleSoloTrack,
  onClose,
}) => {
  // Reset all faders to 0.0 dB (unity gain: 1.0)
  const handleResetAllFaders = () => {
    project.tracks.forEach((t) => {
      onUpdateTrackFx(t.id, { volume: 1.0 });
    });
    onUpdateMasterVolume(1.0);
  };

  const anySolo = useMemo(() => project.tracks.some((t) => t.solo), [project.tracks]);

  return (
    <div className="h-[430px] sm:h-[460px] max-h-[85vh] bg-gradient-to-b from-[#0F1422] via-[#0C101A] to-[#070A12] border-t-2 border-slate-700/80 flex flex-col shadow-2xl select-none z-30 transition-all">
      <style>{`
        .vertical-fader {
          -webkit-appearance: slider-vertical;
          writing-mode: vertical-lr;
          direction: rtl;
          width: 26px;
          height: 100%;
          cursor: ns-resize;
          background: transparent;
        }
        .vertical-fader::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 14px;
          border-radius: 3px;
          background: linear-gradient(to bottom, #f8fafc, #94a3b8 50%, #475569);
          border: 1px solid #ffffff;
          box-shadow: 0 2px 5px rgba(0,0,0,0.7), inset 0 1px 0 #ffffff;
          cursor: ns-resize;
        }
        .vertical-fader-master::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 30px;
          height: 16px;
          border-radius: 3px;
          background: linear-gradient(to bottom, #fef08a, #f59e0b 50%, #b45309);
          border: 1px solid #fde047;
          box-shadow: 0 2px 6px rgba(245,158,11,0.6), inset 0 1px 0 #ffffff;
          cursor: ns-resize;
        }
      `}</style>

      {/* Console Top Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider font-['Fredoka',sans-serif]">
                Studio Mixing Console
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Multi-Channel Staging
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden md:block">
              Vertical Console Faders • 3-Band Parametric EQ • Reverb Send • Stereo Pan • Brickwall Limiter
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetAllFaders}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold border border-slate-700 cursor-pointer transition-colors"
            title="Reset all track and master faders to 0.0 dB (Unity Gain)"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Zero Faders (0 dB)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            title="Close Mixer Console"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Console Channel Strips Bay */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 flex items-stretch gap-2.5 bg-gradient-to-b from-[#090D16] to-[#06080E]">
        {project.tracks.map((track) => {
          const isAudible = !track.muted && (!anySolo || track.solo);
          const volDbStr = gainToDbString(track.fx?.volume ?? 1.0);

          return (
            <div
              key={track.id}
              style={{ borderTopColor: track.color }}
              className="w-36 sm:w-40 bg-gradient-to-b from-slate-900 via-[#101726] to-[#0A0E18] rounded-2xl p-2.5 border-t-4 border border-slate-800 flex flex-col justify-between shrink-0 shadow-xl transition-all"
            >
              {/* Top Identity: Color accent, icon & track name */}
              <div className="text-center pb-1.5 border-b border-slate-800 shrink-0">
                <div className="flex items-center justify-center gap-1.5 truncate">
                  <span className="text-sm shrink-0">{track.icon}</span>
                  <span className="text-xs font-black text-white truncate font-['Fredoka',sans-serif]">
                    {track.name}
                  </span>
                </div>
                <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mt-0.5">
                  {track.type}
                </div>
              </div>

              {/* Pan Control */}
              <div className="py-1 px-1 bg-slate-950/60 rounded-xl border border-slate-800/80 my-1 shrink-0">
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 px-1 mb-0.5">
                  <span>PAN</span>
                  <button
                    type="button"
                    onClick={() => onUpdateTrackFx(track.id, { pan: 0 })}
                    className="font-mono text-cyan-300 hover:text-white cursor-pointer px-1 rounded hover:bg-slate-800"
                    title="Click to Center Pan (C)"
                  >
                    {formatPan(track.fx?.pan ?? 0)}
                  </button>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={track.fx?.pan ?? 0}
                  onChange={(e) => onUpdateTrackFx(track.id, { pan: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400 h-1 bg-slate-900 rounded cursor-pointer"
                  title={`Stereo Pan: ${formatPan(track.fx?.pan ?? 0)} (Double click Center)`}
                />
              </div>

              {/* 3-Band Parametric EQ Section */}
              <div className="py-1.5 px-2 bg-slate-950/60 rounded-xl border border-slate-800/80 my-1 space-y-1 text-[9px] font-mono shrink-0">
                <div className="flex items-center justify-between text-slate-400 font-sans font-bold text-[8px] uppercase tracking-wider pb-0.5 border-b border-slate-800/60">
                  <span>3-Band EQ</span>
                  <button
                    type="button"
                    onClick={() => onUpdateTrackFx(track.id, { eqLow: 0, eqMid: 0, eqHigh: 0 })}
                    className="text-[8px] text-slate-400 hover:text-amber-300 font-bold cursor-pointer"
                    title="Reset EQ to flat (0dB)"
                  >
                    Flat
                  </button>
                </div>

                {/* High EQ */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-emerald-400 font-bold">HI</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={track.fx?.eqHigh ?? 0}
                    onChange={(e) => onUpdateTrackFx(track.id, { eqHigh: parseFloat(e.target.value) })}
                    className="w-16 accent-emerald-400 h-1 bg-slate-900 rounded cursor-pointer"
                    title={`High Shelf (4.5kHz): ${track.fx?.eqHigh ?? 0} dB`}
                  />
                  <span className="text-slate-400 text-[8px] w-6 text-right">
                    {(track.fx?.eqHigh ?? 0) > 0 ? `+${track.fx?.eqHigh}` : `${track.fx?.eqHigh ?? 0}`}
                  </span>
                </div>

                {/* Mid EQ */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sky-400 font-bold">MID</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={track.fx?.eqMid ?? 0}
                    onChange={(e) => onUpdateTrackFx(track.id, { eqMid: parseFloat(e.target.value) })}
                    className="w-16 accent-sky-400 h-1 bg-slate-900 rounded cursor-pointer"
                    title={`Mid Peaking (1.2kHz): ${track.fx?.eqMid ?? 0} dB`}
                  />
                  <span className="text-slate-400 text-[8px] w-6 text-right">
                    {(track.fx?.eqMid ?? 0) > 0 ? `+${track.fx?.eqMid}` : `${track.fx?.eqMid ?? 0}`}
                  </span>
                </div>

                {/* Low EQ */}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-amber-400 font-bold">LOW</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={track.fx?.eqLow ?? 0}
                    onChange={(e) => onUpdateTrackFx(track.id, { eqLow: parseFloat(e.target.value) })}
                    className="w-16 accent-amber-400 h-1 bg-slate-900 rounded cursor-pointer"
                    title={`Low Shelf (250Hz): ${track.fx?.eqLow ?? 0} dB`}
                  />
                  <span className="text-slate-400 text-[8px] w-6 text-right">
                    {(track.fx?.eqLow ?? 0) > 0 ? `+${track.fx?.eqLow}` : `${track.fx?.eqLow ?? 0}`}
                  </span>
                </div>
              </div>

              {/* Reverb Send (Verb) */}
              <div className="py-1 px-2 bg-slate-950/60 rounded-xl border border-slate-800/80 my-1 shrink-0">
                <div className="flex items-center justify-between text-[9px] font-bold text-purple-300 mb-0.5">
                  <span>VERB</span>
                  <span className="font-mono text-[9px] text-purple-200">
                    {Math.round((track.fx?.reverbWet ?? 0) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={track.fx?.reverbWet ?? 0}
                  onChange={(e) => onUpdateTrackFx(track.id, { reverbWet: parseFloat(e.target.value) })}
                  className="w-full accent-purple-400 h-1 bg-slate-900 rounded cursor-pointer"
                  title={`Studio Hall Reverb Send: ${Math.round((track.fx?.reverbWet ?? 0) * 100)}%`}
                />
              </div>

              {/* Mute (M) & Solo (S) Buttons */}
              <div className="grid grid-cols-2 gap-1.5 py-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleMuteTrack && onToggleMuteTrack(track.id)}
                  className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                    track.muted
                      ? 'bg-rose-600 border-rose-400 text-white shadow-md shadow-rose-600/40'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={track.muted ? 'Track Muted (Click to Unmute)' : 'Mute Track (M)'}
                >
                  M
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSoloTrack && onToggleSoloTrack(track.id)}
                  className={`py-1 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                    track.solo
                      ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-md shadow-amber-400/40'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={track.solo ? 'Track Soloed (Click to Unsolo)' : 'Solo Track (S)'}
                >
                  S
                </button>
              </div>

              {/* Vertical Fader & Level Meter Section */}
              <div className="flex-1 min-h-[140px] max-h-[170px] bg-slate-950/80 rounded-xl border border-slate-800/80 p-2 flex items-center justify-between gap-1.5 relative overflow-hidden">
                {/* dB Scale Markings */}
                <div className="flex flex-col justify-between h-full text-[8px] font-mono text-slate-500 select-none py-1 text-right w-4">
                  <span>+6</span>
                  <span className="text-amber-400/90 font-bold">0</span>
                  <span>-6</span>
                  <span>-12</span>
                  <span>-24</span>
                  <span>-∞</span>
                </div>

                {/* Center: Recessed Vertical Fader Slot */}
                <div className="flex-1 h-full flex items-center justify-center relative">
                  {/* Subtle fader guide slot line */}
                  <div className="absolute top-2 bottom-2 w-1.5 bg-slate-900 rounded-full border border-slate-800 pointer-events-none" />
                  {/* Unity gain horizontal reference mark */}
                  <div
                    style={{ bottom: `${(1.0 / 1.5) * 100}%` }}
                    className="absolute left-1 right-1 h-px bg-amber-400/40 pointer-events-none"
                    title="0 dB Unity Gain reference mark"
                  />

                  {/* Vertical Fader Input */}
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.02"
                    value={track.fx?.volume ?? 1.0}
                    onChange={(e) => onUpdateTrackFx(track.id, { volume: parseFloat(e.target.value) })}
                    className="vertical-fader z-10"
                    title={`${track.name} Fader: ${volDbStr}`}
                  />
                </div>

                {/* Right: Dynamic Multi-Segment Peak LED Level Meter Bar */}
                <div className="w-2.5 h-full bg-slate-900 rounded-sm border border-slate-800 flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
                  {[...Array(12)].map((_, i) => {
                    const segmentRatio = (i + 1) / 12;
                    const trackVolRatio = isAudible ? (track.fx?.volume ?? 1.0) / 1.5 : 0;
                    const isLit = trackVolRatio >= segmentRatio;

                    let colorClass = 'bg-emerald-500/80 shadow-emerald-500/40';
                    if (i >= 8 && i < 10) colorClass = 'bg-amber-400 shadow-amber-400/40';
                    if (i >= 10) colorClass = 'bg-rose-500 shadow-rose-500/40';

                    return (
                      <div
                        key={i}
                        className={`w-full flex-1 rounded-[1px] transition-all duration-75 ${
                          isLit ? colorClass : 'bg-slate-800/40'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Digital dB Display Box */}
              <div
                onClick={() => onUpdateTrackFx(track.id, { volume: 1.0 })}
                className="mt-1 py-1 rounded-lg bg-slate-950 border border-slate-800 text-center cursor-pointer hover:border-amber-400/60 transition-colors shrink-0"
                title="Click to reset fader to 0.0 dB (Unity Gain)"
              >
                <span
                  className={`text-[10px] font-mono font-bold ${
                    volDbStr === '0.0 dB'
                      ? 'text-amber-400'
                      : volDbStr.startsWith('+')
                      ? 'text-rose-400'
                      : 'text-slate-300'
                  }`}
                >
                  {volDbStr}
                </span>
              </div>
            </div>
          );
        })}

        {/* =========================================================================
            MASTER BUS CHANNEL STRIP (Pinned on the right)
            ========================================================================= */}
        <div className="w-40 sm:w-44 bg-gradient-to-b from-slate-900 via-[#181828] to-[#0D0D1A] rounded-2xl p-2.5 border-t-4 border-amber-400 border border-slate-800 flex flex-col justify-between shrink-0 shadow-2xl ml-auto">
          {/* Master Bus Header */}
          <div className="text-center pb-1.5 border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-amber-400 text-sm">🎚️</span>
              <span className="text-xs font-black text-amber-300 uppercase tracking-wider font-['Fredoka',sans-serif]">
                Master Bus
              </span>
            </div>
            <div className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400/80 mt-0.5">
              Stereo Output
            </div>
          </div>

          {/* Master Brickwall Peak Limiter Badge */}
          <div className="py-1 px-1.5 bg-slate-950/80 rounded-xl border border-amber-400/30 my-1 shrink-0 flex items-center justify-center gap-1.5 shadow-inner">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-tight">
              Limiter: Protected
            </span>
          </div>

          {/* Master Info & Output Stats */}
          <div className="py-1.5 px-2 bg-slate-950/60 rounded-xl border border-slate-800/80 my-1 text-center shrink-0">
            <span className="text-[9px] text-slate-400 font-mono block">
              Tracks Active: <strong className="text-white">{project.tracks.length}</strong>
            </span>
            <span className="text-[8px] text-emerald-400/90 font-mono block mt-0.5">
              Peak: -1.0 dBFS Max
            </span>
          </div>

          {/* Master Output Section: Master Fader flanked by Dual Left/Right Meters */}
          <div className="flex-1 min-h-[140px] max-h-[170px] bg-slate-950/80 rounded-xl border border-slate-800/80 p-2 flex items-center justify-between gap-1.5 relative overflow-hidden">
            {/* dB Scale Markings */}
            <div className="flex flex-col justify-between h-full text-[8px] font-mono text-slate-500 select-none py-1 text-right w-4">
              <span>+6</span>
              <span className="text-amber-400 font-bold">0</span>
              <span>-6</span>
              <span>-12</span>
              <span>-24</span>
              <span>-∞</span>
            </div>

            {/* Left Peak Meter */}
            <div className="w-2 h-full bg-slate-900 rounded-sm border border-slate-800 flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
              {[...Array(12)].map((_, i) => {
                const isLit = (project.masterVolume / 1.5) >= (i + 1) / 12;
                let colorClass = 'bg-emerald-500/80';
                if (i >= 8 && i < 10) colorClass = 'bg-amber-400';
                if (i >= 10) colorClass = 'bg-rose-500';

                return (
                  <div
                    key={i}
                    className={`w-full flex-1 rounded-[1px] transition-all duration-75 ${
                      isLit ? colorClass : 'bg-slate-800/40'
                    }`}
                  />
                );
              })}
            </div>

            {/* Center: Recessed Master Vertical Fader Slot */}
            <div className="flex-1 h-full flex items-center justify-center relative">
              <div className="absolute top-2 bottom-2 w-1.5 bg-slate-900 rounded-full border border-slate-800 pointer-events-none" />
              <div
                style={{ bottom: `${(1.0 / 1.5) * 100}%` }}
                className="absolute left-1 right-1 h-px bg-amber-400/60 pointer-events-none"
                title="0 dB Unity Gain reference mark"
              />

              <input
                type="range"
                min="0"
                max="1.5"
                step="0.02"
                value={project.masterVolume}
                onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
                className="vertical-fader vertical-fader-master z-10"
                title={`Master Volume Fader: ${gainToDbString(project.masterVolume)}`}
              />
            </div>

            {/* Right Peak Meter */}
            <div className="w-2 h-full bg-slate-900 rounded-sm border border-slate-800 flex flex-col-reverse p-0.5 gap-0.5 overflow-hidden">
              {[...Array(12)].map((_, i) => {
                const isLit = (project.masterVolume / 1.5) >= (i + 1) / 12;
                let colorClass = 'bg-emerald-500/80';
                if (i >= 8 && i < 10) colorClass = 'bg-amber-400';
                if (i >= 10) colorClass = 'bg-rose-500';

                return (
                  <div
                    key={i}
                    className={`w-full flex-1 rounded-[1px] transition-all duration-75 ${
                      isLit ? colorClass : 'bg-slate-800/40'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Master dB Display Box */}
          <div
            onClick={() => onUpdateMasterVolume(1.0)}
            className="mt-1 py-1 rounded-lg bg-slate-950 border border-amber-400/50 text-center cursor-pointer hover:border-amber-400 transition-colors shrink-0 shadow-sm"
            title="Click to reset Master fader to 0.0 dB (Unity Gain)"
          >
            <span
              className={`text-[10px] font-mono font-bold ${
                gainToDbString(project.masterVolume) === '0.0 dB'
                  ? 'text-amber-400'
                  : gainToDbString(project.masterVolume).startsWith('+')
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {gainToDbString(project.masterVolume)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
