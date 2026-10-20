import React from 'react';
import { Volume2, Mic, Trash2, Plus, VolumeX } from 'lucide-react';
import { DawTrack, TRACK_COLOR_PALETTE } from '../types';

interface TrackHeaderListProps {
  tracks: DawTrack[];
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onToggleArmRecord: (trackId: string) => void;
  onChangeVolume: (trackId: string, volume: number) => void;
  onChangePan: (trackId: string, pan: number) => void;
  onChangeTrackName: (trackId: string, name: string) => void;
  onAddTrack: (type: 'audio' | 'instrument') => void;
  onDeleteTrack: (trackId: string) => void;
  onChangeInstrument?: (trackId: string) => void;
}

export const TrackHeaderList: React.FC<TrackHeaderListProps> = ({
  tracks,
  selectedTrackId,
  onSelectTrack,
  onToggleMute,
  onToggleSolo,
  onToggleArmRecord,
  onChangeVolume,
  onChangePan,
  onChangeTrackName,
  onAddTrack,
  onDeleteTrack,
  onChangeInstrument,
}) => {
  return (
    <div className="w-56 sm:w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Top Header spacer aligned with timeline ruler */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 font-['Fredoka',sans-serif]">
          Tracks ({tracks.length})
        </span>

        {/* Add Track Button */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddTrack('audio')}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
            title="Add Audio / Loop Track"
          >
            <Plus className="w-3 h-3" />
            <span>Audio</span>
          </button>
          <button
            type="button"
            onClick={() => onAddTrack('instrument')}
            className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 text-[10px] font-bold border border-slate-700 flex items-center gap-1 cursor-pointer"
            title="Add Virtual Instrument Track"
          >
            <Plus className="w-3 h-3" />
            <span>MIDI</span>
          </button>
        </div>
      </div>

      {/* Vertical list of track strips (each h-24 matches timeline lanes) */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80">
        {tracks.map((track) => {
          const isSelected = selectedTrackId === track.id;

          return (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track.id)}
              style={{ borderLeftColor: track.color }}
              className={`h-24 px-2.5 py-2 flex flex-col justify-between border-l-4 transition-colors cursor-pointer group ${
                isSelected ? 'bg-slate-800/90' : 'bg-slate-900/60 hover:bg-slate-850'
              }`}
            >
              {/* Top row: Icon, Editable Name, Delete */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="text-base shrink-0">{track.icon}</span>
                  <input
                    type="text"
                    value={track.name}
                    onChange={(e) => onChangeTrackName(track.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full text-xs font-bold text-white bg-transparent focus:outline-none focus:bg-slate-950/80 px-1 rounded-sm truncate"
                  />
                </div>

                {tracks.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTrack(track.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-750 transition-all cursor-pointer"
                    title="Delete Track"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Middle row: Mute, Solo, Record Arm */}
              <div className="flex items-center gap-1.5">
                {/* Mute [M] */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMute(track.id);
                  }}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all cursor-pointer flex items-center justify-center ${
                    track.muted
                      ? 'bg-rose-500 text-white font-extrabold shadow-xs ring-1 ring-rose-400'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Mute Track"
                >
                  M
                </button>

                {/* Solo [S] */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSolo(track.id);
                  }}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all cursor-pointer flex items-center justify-center ${
                    track.solo
                      ? 'bg-amber-400 text-slate-950 font-extrabold shadow-xs ring-1 ring-amber-300'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Solo Track"
                >
                  S
                </button>

                {/* Arm Record [●] */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleArmRecord(track.id);
                  }}
                  className={`w-6 h-6 rounded-md text-[10px] font-black transition-all cursor-pointer flex items-center justify-center ${
                    track.armRecord
                      ? 'bg-rose-500 text-white animate-pulse shadow-xs ring-1 ring-rose-400'
                      : 'bg-slate-800 text-slate-500 hover:text-rose-400'
                  }`}
                  title="Arm Track for Recording"
                >
                  ●
                </button>

                {/* Track Type Indicator Pill / Instrument Selector */}
                {track.type === 'instrument' ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onChangeInstrument) onChangeInstrument(track.id);
                    }}
                    className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 ml-auto cursor-pointer flex items-center gap-1 transition-colors"
                    title="Change Virtual Instrument Sound"
                  >
                    <span>{track.icon || '🎹'}</span>
                    <span>MIDI</span>
                  </button>
                ) : (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-slate-950 border border-slate-800 text-slate-400 ml-auto">
                    {track.type}
                  </span>
                )}
              </div>

              {/* Bottom row: Volume & Pan Sliders */}
              <div className="flex items-center gap-2 pt-0.5">
                <div className="flex items-center gap-1 flex-1">
                  <Volume2 className="w-3 h-3 text-slate-500 shrink-0" />
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={track.fx.volume}
                    onChange={(e) => {
                      e.stopPropagation();
                      onChangeVolume(track.id, parseFloat(e.target.value));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full accent-amber-400 h-1 bg-slate-950 rounded-lg cursor-pointer"
                    title={`Volume: ${Math.round(track.fx.volume * 100)}%`}
                  />
                </div>

                <div className="flex items-center gap-1 w-16" title={`Pan: ${track.fx.pan.toFixed(2)}`}>
                  <span className="text-[9px] font-mono text-slate-500">P</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={track.fx.pan}
                    onChange={(e) => {
                      e.stopPropagation();
                      onChangePan(track.id, parseFloat(e.target.value));
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full accent-sky-400 h-1 bg-slate-950 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
