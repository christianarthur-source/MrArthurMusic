import { SoundSettingsConfig, SoundKit, SyllableStyle } from '../types/game';
import { audioEngine } from '../services/audioEngine';
import { Volume2, Sliders, Music, Check, X, Volume1 } from 'lucide-react';

interface SoundSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SoundSettingsConfig;
  onChangeSettings: (updated: Partial<SoundSettingsConfig>) => void;
}

export const SoundSettings: React.FC<SoundSettingsProps> = ({
  isOpen,
  onClose,
  settings,
  onChangeSettings
}) => {
  if (!isOpen) return null;

  const kits: { id: SoundKit; name: string; icon: string; desc: string }[] = [
    { id: 'rock_kit', name: 'Rock Snare Drum', icon: '🥁', desc: 'Crisp acoustic rock snare' },
    { id: 'woodblock', name: 'Classroom Woodblock', icon: '🪵', desc: 'Acoustic resonant temple block' },
    { id: 'cowbell_fever', name: 'Classic Cowbell', icon: '🔔', desc: 'Authentic tuned rock cowbell' },
    { id: 'electric_clap', name: 'Hand Claps', icon: '👏', desc: 'Crisp classroom body percussion' },
    { id: 'marimba', name: 'Warm Marimba', icon: '🎶', desc: 'Resonant wooden mallet chime' },
    { id: 'triangle', name: 'Steel Triangle', icon: '📐', desc: 'Shimmering orchestral chime' },
    { id: 'synth_rimshot', name: '808 Drum Machine', icon: '⚡', desc: 'Snappy electronic rimshot beat' },
    { id: 'agogo_bell', name: 'Agogô Latin Bell', icon: '🎵', desc: 'Dual-pitched samba bell' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center">
              <Sliders className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-xl font-display font-extrabold text-white tracking-tight">
                Music & Audio Settings
              </h3>
              <p className="text-xs text-slate-400">
                Customize counting syllables and drum sounds for your class
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="p-6 space-y-6">
          {/* 1. Syllable Display Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Rhythm Syllable Guide
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onChangeSettings({ syllableStyle: 'kodaly' })}
                className={`p-3 rounded-xl border text-center transition-all ${
                  settings.syllableStyle === 'kodaly'
                    ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-sm font-bold">Kodály</span>
                <span className="text-[10px] text-slate-400">Ta, Ti-Ti, Tika</span>
              </button>

              <button
                onClick={() => onChangeSettings({ syllableStyle: 'numbers' })}
                className={`p-3 rounded-xl border text-center transition-all ${
                  settings.syllableStyle === 'numbers'
                    ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-sm font-bold">Numbers</span>
                <span className="text-[10px] text-slate-400">1, 2 &, 3 e & a, 4</span>
              </button>

              <button
                onClick={() => onChangeSettings({ syllableStyle: 'none' })}
                className={`p-3 rounded-xl border text-center transition-all ${
                  settings.syllableStyle === 'none'
                    ? 'bg-amber-400/20 border-amber-400 text-white font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span className="block text-sm font-bold">Ear Only</span>
                <span className="text-[10px] text-slate-400">No text syllables</span>
              </button>
            </div>
          </div>

          {/* 2. Drum Kit Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Band Sound Kit
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {kits.map((kit) => (
                <button
                  key={kit.id}
                  onClick={() => {
                    onChangeSettings({ soundKit: kit.id });
                    audioEngine.playUniformRhythmNote(kit.id);
                  }}
                  className={`p-3 rounded-xl border text-left flex items-start justify-between gap-2 transition-all cursor-pointer group ${
                    settings.soundKit === kit.id
                      ? 'bg-amber-400/20 border-amber-400 text-white shadow-md shadow-amber-500/10'
                      : 'bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                  title={`Select ${kit.name} (Click to preview)`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl group-hover:scale-110 transition-transform">{kit.icon}</span>
                    <div>
                      <span className={`text-xs font-bold block ${settings.soundKit === kit.id ? 'text-amber-300' : 'text-white'}`}>
                        {kit.name}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{kit.desc}</span>
                    </div>
                  </div>
                  {settings.soundKit === kit.id && (
                    <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Metronome Count-In Toggle */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-sm font-bold text-white block">Metronome Count-In</span>
              <span className="text-xs text-slate-400">Plays "1, 2, 3, 4" clicks before each rhythm</span>
            </div>
            <button
              onClick={() => onChangeSettings({ countIn: !settings.countIn })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.countIn ? 'bg-amber-400' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-slate-950 transition-transform absolute top-0.5 ${
                  settings.countIn ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* 4. Tempo BPM Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Default Jam Tempo
              </span>
              <span className="font-mono font-bold text-amber-400 text-sm">
                {settings.tempoBpm} BPM
              </span>
            </div>
            <input
              type="range"
              min={70}
              max={130}
              step={2}
              value={settings.tempoBpm}
              onChange={(e) => onChangeSettings({ tempoBpm: parseInt(e.target.value, 10) })}
              className="w-full accent-amber-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>70 (Slow Practice)</span>
              <span>96 (Rock)</span>
              <span>130 (Turbo)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl transition-all"
          >
            Done & Rock On!
          </button>
        </div>
      </div>
    </div>
  );
};
