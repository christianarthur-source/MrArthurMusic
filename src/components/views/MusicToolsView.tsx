import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { tunerEngine, TUNER_PRESETS, PitchData } from '../../services/tunerAudio';
import { audioEngine } from '../../services/audioEngine';
import { SongMakerSequencer } from './SongMakerSequencer';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Sliders,
  Sparkles,
  Music2,
  Clock
} from 'lucide-react';

export const MusicToolsView: React.FC = () => {
  const { preferences, showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'song-maker' | 'tuner' | 'metronome'>('song-maker');

  // --- TUNER STATE ---
  const [isTunerListening, setIsTunerListening] = useState(false);
  const [pitchData, setPitchData] = useState<PitchData | null>(null);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [refA4, setRefA4] = useState(preferences.tunerRefA4 || 440);
  const [noiseGate, setNoiseGate] = useState(0.015);
  const [micError, setMicError] = useState<string | null>(null);

  const toggleTuner = async () => {
    if (isTunerListening) {
      tunerEngine.stop();
      setIsTunerListening(false);
      setPitchData(null);
    } else {
      setMicError(null);
      tunerEngine.setRefA4(refA4);
      tunerEngine.setNoiseGate(noiseGate);
      const success = await tunerEngine.start((data) => {
        setPitchData(data);
      });
      if (success) {
        setIsTunerListening(true);
        showToast('Microphone active for tuning', 'info');
      } else {
        setMicError('Could not access microphone. Please grant mic permissions in your browser.');
      }
    }
  };

  useEffect(() => {
    return () => {
      if (tunerEngine.isRunning()) tunerEngine.stop();
    };
  }, []);

  // --- METRONOME STATE ---
  const [bpm, setBpm] = useState(108);
  const [beatsPerBar, setBeatsPerBar] = useState(4);
  const [subdivision, setSubdivision] = useState<'quarter' | 'eighth' | 'triplet' | 'sixteenth'>('quarter');
  const [soundScheme, setSoundScheme] = useState<'woodblock' | 'beep' | 'drum' | 'cowbell'>('woodblock');
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [activeBeat, setActiveBeat] = useState<number>(1);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  useEffect(() => {
    audioEngine.setMetronomeParams({
      bpm,
      beatsPerBar,
      subdivision,
      sound: soundScheme
    });
  }, [bpm, beatsPerBar, subdivision, soundScheme]);

  const toggleMetronome = () => {
    if (isMetronomePlaying) {
      audioEngine.stopMetronome();
      setIsMetronomePlaying(false);
    } else {
      audioEngine.startMetronome((beat) => {
        setActiveBeat(beat);
      });
      setIsMetronomePlaying(true);
    }
  };

  const handleTapTempo = () => {
    const now = performance.now();
    const newTaps = [...tapTimes, now].filter((t) => now - t < 3000).slice(-4);
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        setBpm(calculatedBpm);
      }
    }
  };

  // Keyboard shortcut listener for spacebar play/pause in metronome
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        if (activeTab === 'metronome') {
          e.preventDefault();
          toggleMetronome();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isMetronomePlaying]);

  const preset = TUNER_PRESETS[selectedPresetIndex];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
              <Music2 className="w-5 h-5" />
            </div>
            <span>Music Classroom Tools</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Google Song Maker sequencer, real-time chromatic tuner, and high-precision metronome.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1.5 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 gap-1 shadow-inner">
          <button
            onClick={() => {
              setActiveTab('song-maker');
              if (tunerEngine.isRunning()) tunerEngine.stop();
              setIsTunerListening(false);
              if (isMetronomePlaying) audioEngine.stopMetronome();
              setIsMetronomePlaying(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'song-maker'
                ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Song Maker Sequencer</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('tuner');
              if (isMetronomePlaying) audioEngine.stopMetronome();
              setIsMetronomePlaying(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'tuner'
                ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Chromatic Tuner</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('metronome');
              if (tunerEngine.isRunning()) tunerEngine.stop();
              setIsTunerListening(false);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeTab === 'metronome'
                ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Precision Metronome</span>
          </button>
        </div>
      </div>

      {/* 1. SONG MAKER SEQUENCER TAB */}
      {activeTab === 'song-maker' && <SongMakerSequencer />}

      {/* 2. CHROMATIC TUNER TAB */}
      {activeTab === 'tuner' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-col items-center text-center space-y-6">
            {/* Presets and Ref A4 Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-4 max-w-xl pb-4 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500">Preset:</span>
                <select
                  value={selectedPresetIndex}
                  onChange={(e) => setSelectedPresetIndex(Number(e.target.value))}
                  className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 text-xs font-medium px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700"
                >
                  {TUNER_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-stone-500">Reference:</span>
                <button
                  onClick={() => {
                    const newA = refA4 === 440 ? 442 : 440;
                    setRefA4(newA);
                    tunerEngine.setRefA4(newA);
                  }}
                  className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200"
                >
                  A4 = {refA4} Hz
                </button>
              </div>
            </div>

            {/* Target Instrument Notes (if preset has specific notes like Ukulele/Guitar) */}
            {preset.notes.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {preset.notes.map((n, i) => {
                  const isCurrentNote = pitchData?.noteName === n.note && pitchData?.octave === n.octave;
                  return (
                    <div
                      key={i}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
                        isCurrentNote
                          ? 'bg-emerald-500 text-white ring-4 ring-emerald-500/20 scale-105 shadow-md'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                      }`}
                    >
                      {n.note}
                      {n.octave} ({n.freq} Hz)
                    </div>
                  );
                })}
              </div>
            )}

            {/* Giant Pitch Display & Needle Gauge */}
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              {pitchData ? (
                <>
                  <div className="relative">
                    <span
                      className={`font-mono text-8xl sm:text-9xl font-black tracking-tight transition-colors duration-100 ${
                        pitchData.inTune
                          ? 'text-emerald-500 animate-pulse'
                          : Math.abs(pitchData.cents) < 15
                          ? 'text-amber-500'
                          : 'text-stone-800 dark:text-white'
                      }`}
                    >
                      {pitchData.noteName}
                    </span>
                    <span className="text-3xl font-mono font-bold text-stone-400 absolute -bottom-1 -right-6">
                      {pitchData.octave}
                    </span>
                  </div>

                  <div className="text-sm font-mono text-stone-500">
                    {pitchData.frequency} Hz • {pitchData.cents > 0 ? `+${pitchData.cents}` : pitchData.cents} cents
                  </div>

                  {/* Cent Gauge Visual Needle */}
                  <div className="w-72 sm:w-96 space-y-2">
                    <div className="relative h-4 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden border border-stone-200 dark:border-stone-700">
                      {/* Center In-Tune marker */}
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1.5 bg-emerald-500 z-10" />
                      {/* Needle indicator */}
                      <div
                        className={`absolute top-0 bottom-0 w-3 rounded-full transition-all duration-75 ${
                          pitchData.inTune ? 'bg-emerald-500 ring-4 ring-emerald-500/30' : 'bg-brand-600'
                        }`}
                        style={{
                          left: `calc(50% + ${(pitchData.cents / 50) * 45}%)`,
                          transform: 'translateX(-50%)'
                        }}
                      />
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-stone-400 px-1">
                      <span>-50 Flat</span>
                      <span className="text-emerald-500 font-bold">Perfect In-Tune</span>
                      <span>+50 Sharp</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-stone-400 space-y-2">
                  <p className="text-xl font-bold">
                    {isTunerListening ? 'Sing or play a note...' : 'Tuner is off'}
                  </p>
                  <p className="text-xs">
                    {isTunerListening
                      ? 'Room noise filtered by noise gate. Play clearly near microphone.'
                      : 'Click "Start Listening" to activate the microphone.'}
                  </p>
                </div>
              )}
            </div>

            {/* Error banner if microphone blocked */}
            {micError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-2xl text-xs text-rose-700 dark:text-rose-300 max-w-md">
                {micError}
              </div>
            )}

            {/* Start / Stop Button */}
            <button
              onClick={toggleTuner}
              className={`px-8 py-4 rounded-2xl font-bold text-sm flex items-center gap-3 shadow-elevated transition-all active:scale-95 ${
                isTunerListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              {isTunerListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              <span>{isTunerListening ? 'Stop Listening' : 'Start Microphone Listening'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. PRECISION METRONOME TAB */}
      {activeTab === 'metronome' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-10 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-col items-center text-center space-y-8">
            {/* Visual Beat Indicator Dots */}
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: beatsPerBar }).map((_, idx) => {
                const beatNum = idx + 1;
                const isCurrent = isMetronomePlaying && activeBeat === beatNum;
                const isDownbeat = beatNum === 1;

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl transition-all duration-75 flex items-center justify-center font-mono font-bold text-sm ${
                      isCurrent
                        ? isDownbeat
                          ? 'w-14 h-14 bg-gradient-to-tr from-amber-500 to-rose-500 text-white ring-8 ring-amber-500/30 scale-110 shadow-lg'
                          : 'w-12 h-12 bg-amber-500 text-white ring-6 ring-amber-500/20 scale-105 shadow-md'
                        : 'w-11 h-11 bg-stone-100 dark:bg-stone-800 text-stone-400'
                    }`}
                  >
                    {beatNum}
                  </div>
                );
              })}
            </div>

            {/* Huge Tempo Display */}
            <div className="space-y-2">
              <div className="font-mono text-7xl sm:text-9xl font-black text-stone-900 dark:text-white tracking-tight">
                {bpm}
              </div>
              <div className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                Beats Per Minute (BPM)
              </div>
            </div>

            {/* Tempo Slider & Buttons */}
            <div className="w-full max-w-md space-y-4">
              <input
                type="range"
                min="30"
                max="260"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full h-2.5 bg-stone-200 dark:bg-stone-700 rounded-lg appearance-none cursor-pointer accent-brand-600"
              />

              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setBpm((b) => Math.max(30, b - 5))}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700"
                >
                  -5
                </button>
                <button
                  onClick={() => setBpm((b) => Math.max(30, b - 1))}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700"
                >
                  -1
                </button>
                <button
                  onClick={handleTapTempo}
                  className="px-5 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-xs hover:bg-amber-200 transition-all border border-amber-300/60 shadow-sm"
                >
                  Tap Tempo
                </button>
                <button
                  onClick={() => setBpm((b) => Math.min(300, b + 1))}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700"
                >
                  +1
                </button>
                <button
                  onClick={() => setBpm((b) => Math.min(300, b + 5))}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 font-bold text-xs hover:bg-stone-200 dark:hover:bg-stone-700"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Time Signature, Subdivisions & Sound Scheme */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-semibold">Meter:</span>
                {[2, 3, 4, 6].map((num) => (
                  <button
                    key={num}
                    onClick={() => setBeatsPerBar(num)}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      beatsPerBar === num
                        ? 'bg-brand-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {num}/4
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-semibold">Subdivision:</span>
                {(['quarter', 'eighth', 'triplet', 'sixteenth'] as const).map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSubdivision(sub)}
                    className={`px-2.5 py-1.5 rounded-lg font-medium capitalize transition-all ${
                      subdivision === sub
                        ? 'bg-brand-600 text-white font-bold'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-stone-400 font-semibold">Sound:</span>
                <select
                  value={soundScheme}
                  onChange={(e) => setSoundScheme(e.target.value as any)}
                  className="bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-stone-200 dark:border-stone-700"
                >
                  <option value="woodblock">Woodblock (Orff Click)</option>
                  <option value="beep">Digital Beep</option>
                  <option value="drum">Acoustic Drum Kit</option>
                  <option value="cowbell">Cowbell</option>
                </select>
              </div>
            </div>

            {/* Big Start / Stop Button */}
            <button
              onClick={toggleMetronome}
              className={`px-10 py-4 rounded-2xl font-bold text-base flex items-center gap-3 shadow-elevated transition-all active:scale-95 ${
                isMetronomePlaying
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
              }`}
            >
              {isMetronomePlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
              <span>{isMetronomePlaying ? 'Pause Metronome' : 'Start Metronome'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
