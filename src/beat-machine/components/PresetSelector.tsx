import React from 'react';
import { SOUND_PACKS, BEAT_PRESETS } from '../data/soundPacks';
import { Sparkles, Music, Compass } from 'lucide-react';
import { getTempoDescription } from './Header';

interface PresetSelectorProps {
  currentPackId: string;
  onSelectPack: (packId: string) => void;
  onSelectPreset: (presetId: string) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  currentPackId,
  onSelectPack,
  onSelectPreset,
}) => {
  return (
    <div className="space-y-3">
      {/* Sound Packs Row - Clean, minimal & without descriptions */}
      <div className="rounded-3xl border-2 border-slate-700 bg-slate-800/80 p-3.5 shadow-xl">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎒</span>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Sound Pack:
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {SOUND_PACKS.map((pack) => {
            const isSelected = currentPackId === pack.id;
            return (
              <button
                key={pack.id}
                onClick={() => onSelectPack(pack.id)}
                className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition-all active:scale-95 ${
                  isSelected
                    ? 'border-pink-400 bg-pink-500/20 text-white shadow-md scale-102 ring-2 ring-pink-400/40'
                    : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-800'
                }`}
              >
                <span className="text-xl shrink-0">{pack.emoji}</span>
                <span className="truncate text-xs font-black">{pack.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Instant Beat Adventures Presets - Clean & minimal */}
      <div className="rounded-3xl border-2 border-slate-700 bg-slate-800/80 p-3.5 shadow-xl">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-300">
              Ready Grooves:
            </h3>
          </div>
          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            1-Click Beats
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BEAT_PRESETS.map((preset) => {
            const tempo = getTempoDescription(preset.bpm);
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className="group flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/70 p-2.5 text-left transition-all hover:border-amber-400 hover:bg-slate-800 active:scale-95"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                    {preset.icon}
                  </span>
                  <div className="truncate">
                    <h4 className="truncate text-xs font-black text-white group-hover:text-amber-300">
                      {preset.title}
                    </h4>
                    <span className="text-[10px] font-bold text-slate-400">
                      {preset.bpm} BPM • {tempo.term}
                    </span>
                  </div>
                </div>
                <Music className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-1 opacity-70 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
