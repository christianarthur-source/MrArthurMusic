import React from 'react';
import { X, Sliders, Volume2, Sparkles } from 'lucide-react';
import { DawFxSettings, DawProject, DawTrack } from '../types';

interface MixerModalProps {
  project: DawProject;
  onUpdateTrackFx: (trackId: string, fx: Partial<DawFxSettings>) => void;
  onUpdateMasterVolume: (vol: number) => void;
  onClose: () => void;
}

export const MixerModal: React.FC<MixerModalProps> = ({
  project,
  onUpdateTrackFx,
  onUpdateMasterVolume,
  onClose,
}) => {
  return (
    <div className="h-72 bg-slate-900 border-t border-slate-800 flex flex-col shadow-2xl select-none z-30">
      {/* Header bar */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-rose-400" />
          <span className="text-sm font-black text-white font-['Fredoka',sans-serif]">
            Audio Mixer &amp; FX Console
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Adjust EQ, Reverb, Delay &amp; Volume per track
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Channel Strips Row */}
      <div className="flex-1 overflow-x-auto p-3 flex items-stretch gap-3 bg-slate-950/80">
        {project.tracks.map((track) => (
          <div
            key={track.id}
            style={{ borderTopColor: track.color }}
            className="w-36 bg-slate-900 rounded-xl p-2.5 border-t-4 border border-slate-800 flex flex-col justify-between shrink-0 shadow-md"
          >
            {/* Track Name */}
            <div className="text-center pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-white truncate block">
                {track.icon} {track.name}
              </span>
            </div>

            {/* EQ & FX Controls */}
            <div className="space-y-1.5 py-2 text-[10px] font-mono">
              {/* EQ Bass */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Low</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={track.fx.eqLow}
                  onChange={(e) => onUpdateTrackFx(track.id, { eqLow: parseFloat(e.target.value) })}
                  className="w-16 accent-amber-400 h-1 bg-slate-950 rounded cursor-pointer"
                  title={`Low EQ: ${track.fx.eqLow} dB`}
                />
              </div>

              {/* EQ Mid */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">Mid</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={track.fx.eqMid}
                  onChange={(e) => onUpdateTrackFx(track.id, { eqMid: parseFloat(e.target.value) })}
                  className="w-16 accent-sky-400 h-1 bg-slate-950 rounded cursor-pointer"
                  title={`Mid EQ: ${track.fx.eqMid} dB`}
                />
              </div>

              {/* EQ High */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-slate-400">High</span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  value={track.fx.eqHigh}
                  onChange={(e) => onUpdateTrackFx(track.id, { eqHigh: parseFloat(e.target.value) })}
                  className="w-16 accent-emerald-400 h-1 bg-slate-950 rounded cursor-pointer"
                  title={`High EQ: ${track.fx.eqHigh} dB`}
                />
              </div>

              {/* Reverb Send */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
                <span className="text-purple-300">Verb</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={track.fx.reverbWet}
                  onChange={(e) => onUpdateTrackFx(track.id, { reverbWet: parseFloat(e.target.value) })}
                  className="w-16 accent-purple-400 h-1 bg-slate-950 rounded cursor-pointer"
                  title={`Reverb: ${Math.round(track.fx.reverbWet * 100)}%`}
                />
              </div>
            </div>

            {/* Fader & Volume */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-slate-400">Vol</span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={track.fx.volume}
                onChange={(e) => onUpdateTrackFx(track.id, { volume: parseFloat(e.target.value) })}
                className="w-20 accent-amber-400 h-1.5 bg-slate-950 rounded cursor-pointer"
              />
            </div>
          </div>
        ))}

        {/* Master Output Channel */}
        <div className="w-36 bg-slate-900/90 rounded-xl p-2.5 border-t-4 border-amber-400 border border-slate-800 flex flex-col justify-between shrink-0 shadow-lg ml-auto">
          <div className="text-center pb-1 border-b border-slate-800">
            <span className="text-xs font-black text-amber-300 uppercase tracking-wider font-['Fredoka',sans-serif]">
              Master Bus
            </span>
          </div>

          <div className="py-4 text-center">
            <span className="text-3xl">🎚️</span>
            <p className="text-[10px] text-slate-400 font-mono mt-2">Stereo Limiter</p>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-amber-400 font-bold">Main</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={project.masterVolume}
              onChange={(e) => onUpdateMasterVolume(parseFloat(e.target.value))}
              className="w-20 accent-amber-400 h-2 bg-slate-950 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
