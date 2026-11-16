import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings2, Check, ChevronDown, RotateCcw } from 'lucide-react';
import { getToolboxAudioContext } from '../toolboxAudio';
import { useTunerEngine } from '../../../audio/tuner/useTunerEngine.ts';
import { midiToHz, noteLabel } from '../../../audio/tuner/noteMath.ts';
import { getInstrumentPresets } from './presets.ts';
import { TunerCanvas, deriveView, type TunerView } from './TunerCanvas.tsx';
import { TunerSettings, TOLERANCES, useTunerSettings } from './TunerSettings.tsx';

const HOLD_MS = 600;
type Status = 'idle' | 'listening' | 'low' | 'high' | 'in' | 'far-low' | 'far-high';

export const TunerTool: React.FC = () => {
  const [settings, update] = useTunerSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [targetStringId, setTargetStringId] = useState<string | null>(null);
  const [tuned, setTuned] = useState<Record<string, boolean>>({});
  const [celebrate, setCelebrate] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [liveText, setLiveText] = useState('');
  const [level, setLevel] = useState(0);
  const [closestId, setClosestId] = useState<string | null>(null);
  const [lastMidi, setLastMidi] = useState<number | null>(null);

  const presets = useMemo(() => getInstrumentPresets(settings.a4), [settings.a4]);
  const preset = presets.find((p) => p.id === settings.presetId) ?? presets[0];
  const targetString = preset.strings.find((s) => s.id === targetStringId) ?? null;
  const tol = TOLERANCES[settings.tolerance].cents;

  const range = useMemo(
    () => (targetString ? { minHz: targetString.targetFreq * Math.pow(2, -7 / 12), maxHz: targetString.targetFreq * Math.pow(2, 7 / 12) } : null),
    [targetString],
  );
  const engine = useTunerEngine({ a4: settings.a4, range });
  const viewRef = useRef<TunerView | null>(null);
  const holdRef = useRef(0);
  const holdMs = useRef(0);
  const cfgRef = useRef({ preset, targetString, tol, canvas: { a4: settings.a4, targetMidi: targetString ? targetString.midi : null, strings: preset.strings.map((x) => x.midi) } });
  cfgRef.current = { preset, targetString, tol, canvas: { a4: settings.a4, targetMidi: targetString ? targetString.midi : null, strings: preset.strings.map((x) => x.midi) } };
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Low-rate UI state (status, level, string check marks) derived from the high-rate refs.
  useEffect(() => {
    if (!engine.listening) {
      holdMs.current = 0;
      holdRef.current = 0;
      setStatus('idle');
      setLevel(0);
      return;
    }
    let lastLive = 0;
    let lastT = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - lastT;
      lastT = now;
      const { preset: pr, targetString: ts, tol: tl } = cfgRef.current;
      const view = deriveView(engine.stableRef.current, cfgRef.current.canvas);
      let next: Status = 'listening';
      if (view) {
        next = Math.abs(view.cents) <= tl ? 'in' : view.cents < 0 ? 'low' : 'high';
        if (!view.held) setLastMidi(view.refMidi);
      } else if (engine.farRef.current && now - engine.farRef.current.t < 600) {
        next = engine.farRef.current.dir === 'low' ? 'far-low' : 'far-high';
      }
      setStatus((p) => (p === next ? p : next));
      setLevel(Math.min(1, Math.max(0, (20 * Math.log10(Math.max(engine.levelRef.current, 1e-5)) + 60) / 40)));

      const inTune = !!view && !view.held && next === 'in';
      if (inTune) holdMs.current = Math.min(HOLD_MS, holdMs.current + dt);
      else holdMs.current = Math.max(0, holdMs.current - dt * 2);
      holdRef.current = holdMs.current / HOLD_MS;
      if (view && ts === null && pr.strings.length > 0) {
        const s = pr.strings.find((x) => x.midi === view.refMidi);
        setClosestId(s ? s.id : null);
      }
      if (inTune && holdMs.current >= HOLD_MS && pr.strings.length > 0) {
        const s = ts ?? pr.strings.find((x) => x.midi === view!.refMidi);
        if (s) {
          setTuned((prev) => {
            if (prev[s.id]) return prev;
            const n = { ...prev, [s.id]: true };
            if (pr.strings.every((x) => n[x.id])) {
              setCelebrate(true);
              if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
              celebrateTimer.current = setTimeout(() => setCelebrate(false), 4000);
            }
            return n;
          });
        }
      }
      // Screen-reader text changes at most once a second.
      if (now - lastLive > 1000) {
        lastLive = now;
        setLiveText(next === 'in' ? 'In tune' : next === 'low' ? 'Too low' : next === 'high' ? 'Too high' : '');
      }
    }, 50);
    return () => clearInterval(id);
  }, [engine.listening, engine.farRef, engine.levelRef, engine.stableRef]);

  useEffect(() => () => { if (celebrateTimer.current) clearTimeout(celebrateTimer.current); }, []);

  // Reference tone (concert pitch).
  const toneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const stopTone = useCallback(() => {
    const t = toneRef.current;
    toneRef.current = null;
    setPlaying(null);
    if (!t) return;
    try {
      const ctx = t.gain.context;
      t.gain.gain.cancelScheduledValues(ctx.currentTime);
      t.gain.gain.setValueAtTime(Math.max(t.gain.gain.value, 0.0001), ctx.currentTime);
      t.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      t.osc.stop(ctx.currentTime + 0.1);
      t.osc.onended = () => { try { t.osc.disconnect(); t.gain.disconnect(); } catch { /* ignore */ } };
    } catch { /* already stopped */ }
  }, []);
  const playTone = useCallback(async (freq: number, label: string) => {
    if (toneRef.current && playing === label) { stopTone(); return; }
    stopTone();
    try {
      const ctx = await getToolboxAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      toneRef.current = { osc, gain };
      setPlaying(label);
    } catch { /* audio blocked */ }
  }, [playing, stopTone]);
  useEffect(() => stopTone, [stopTone]);

  // New instrument: forget checks and the selected string.
  const changePreset = (id: string) => {
    update({ presetId: id });
    setTargetStringId(null);
    setTuned({});
    setClosestId(null);
  };

  const canvasCfg = {
    a4: settings.a4,
    tolerance: tol,
    targetMidi: targetString ? targetString.midi : null,
    strings: useMemo(() => preset.strings.map((s) => s.midi), [preset]),
    transposition: settings.transposition,
    useFlats: settings.useFlats,
    showHistory: settings.showHistory,
    showStrobe: settings.showStrobe,
    listening: engine.listening,
  };

  const toneFreq = targetString ? targetString.targetFreq : midiToHz(lastMidi ?? 69, settings.a4);
  const toneLabel = targetString ? `${targetString.note}${targetString.octave}` : noteLabel(lastMidi ?? 69, settings.useFlats);

  const statusStyle: Record<Status, string> = {
    idle: 'text-slate-400 border-slate-700',
    listening: 'text-sky-300 border-sky-500/40',
    low: 'text-amber-300 border-amber-400/50 bg-amber-500/10',
    high: 'text-amber-300 border-amber-400/50 bg-amber-500/10',
    in: 'text-emerald-300 border-emerald-400/60 bg-emerald-500/10',
    'far-low': 'text-amber-300 border-amber-400/50',
    'far-high': 'text-amber-300 border-amber-400/50',
  };
  const hasStrings = preset.strings.length > 0;
  const statusText: Record<Status, string> = {
    idle: 'Press Start, then play one note',
    listening: 'Listening… play a note',
    low: hasStrings ? 'Too low — tighten ↑' : 'Too low — raise the pitch ↑',
    high: hasStrings ? 'Too high — loosen ↓' : 'Too high — lower the pitch ↓',
    in: 'In tune ✓',
    'far-low': 'Far too low for this string ↑',
    'far-high': 'Far too high for this string ↓',
  };

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-3 select-none font-sans" data-testid="tuner-tool">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
        <span className="text-2xl" aria-hidden="true">{preset.emoji}</span>
        <div className="relative flex-1 min-w-[160px]">
          <label htmlFor="tuner-instrument" className="sr-only">Instrument</label>
          <select
            id="tuner-instrument" value={preset.id} onChange={(e) => changePreset(e.target.value)}
            className="appearance-none w-full min-h-[44px] pl-3 pr-9 rounded-xl bg-slate-900 border border-slate-700 font-bold text-sm text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300"
          >
            {presets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        <button
          type="button" aria-label="Settings" aria-expanded={showSettings} onClick={() => setShowSettings((v) => !v)}
          className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300 ${showSettings ? 'bg-teal-500/20 border-teal-400 text-teal-200' : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'}`}
        >
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {hasStrings && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Strings">
          <button
            type="button" onClick={() => setTargetStringId(null)} aria-pressed={targetStringId === null}
            className={`min-h-[44px] px-3 rounded-xl text-sm font-bold border cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300 ${targetStringId === null ? 'bg-teal-400 text-slate-950 border-teal-300' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
          >Auto ⚡</button>
          {preset.strings.map((s) => {
            const sel = targetStringId === s.id;
            const near = targetStringId === null && closestId === s.id && engine.listening;
            return (
              <button
                key={s.id} type="button" aria-pressed={sel} data-string={s.id}
                onClick={() => setTargetStringId(sel ? null : s.id)}
                className={`min-h-[44px] min-w-[56px] px-3 rounded-xl text-sm font-black border cursor-pointer flex items-center justify-center gap-1 focus-visible:outline-2 focus-visible:outline-teal-300 ${
                  tuned[s.id] ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' : sel || near ? 'bg-teal-500/20 border-teal-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-200'
                }`}
              >
                {tuned[s.id] && <Check className="w-4 h-4 text-emerald-400" aria-label="in tune" />}
                <span className="font-['Fredoka',sans-serif] text-base">{s.note}{s.octave}</span>
              </button>
            );
          })}
          {Object.keys(tuned).length > 0 && (
            <button type="button" onClick={() => { setTuned({}); setCelebrate(false); }} className="min-h-[44px] px-3 rounded-xl text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Reset checks
            </button>
          )}
        </div>
      )}

      {showSettings && (
        <TunerSettings
          settings={settings} update={update} devices={engine.devices} deviceId={engine.deviceId}
          onDevice={(id) => { update({ deviceId: id }); void engine.start(id); }}
        />
      )}

      {engine.error && (
        <div role="alert" className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm font-semibold flex items-center justify-between gap-3">
          <span>{engine.error}</span>
          <button type="button" onClick={() => void engine.start(settings.deviceId)} className="min-h-[44px] px-3 rounded-lg bg-rose-500 text-slate-950 font-bold text-sm cursor-pointer">Try again</button>
        </div>
      )}

      {celebrate && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 text-slate-950 font-black text-center">
          🎉 All strings in tune! Great job! 🌟
        </div>
      )}

      {/* Display */}
      <div className={`rounded-3xl border bg-gradient-to-b from-slate-900 to-slate-950 px-1 pt-2 pb-2 transition-colors ${status === 'in' ? 'border-emerald-400/70' : 'border-slate-800'}`}>
        <TunerCanvas stableRef={engine.stableRef} config={canvasCfg} viewRef={viewRef} holdRef={holdRef} />
        <div className="px-3 pb-2">
          <div
            data-testid="tuner-status" data-status={status}
            className={`min-h-[44px] flex items-center justify-center rounded-2xl border font-black text-base font-['Fredoka',sans-serif] ${statusStyle[status]}`}
          >
            {statusText[status]}
          </div>
          <div className="sr-only" aria-live="polite" role="status">{liveText}</div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
        <button
          type="button" data-testid="tuner-toggle" disabled={engine.starting}
          onClick={() => (engine.listening ? engine.stop() : void engine.start(settings.deviceId))}
          className={`min-h-[52px] px-6 rounded-2xl font-black text-base flex items-center gap-2 cursor-pointer font-['Fredoka',sans-serif] focus-visible:outline-2 focus-visible:outline-teal-300 disabled:opacity-60 ${engine.listening ? 'bg-rose-500 text-white' : 'bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950'}`}
        >
          {engine.listening ? <><MicOff className="w-5 h-5" /> Stop listening</> : <><Mic className="w-5 h-5" /> {engine.starting ? 'Starting…' : 'Start listening'}</>}
        </button>
        <div className="flex-1 min-w-[120px]" aria-hidden="true">
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Input level</div>
          <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
        </div>
        <button
          type="button" onClick={() => void playTone(toneFreq, toneLabel)}
          aria-label={`Play reference tone ${toneLabel}`}
          className={`min-h-[44px] px-4 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300 ${playing === toneLabel ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
        >
          {playing === toneLabel ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />} {toneLabel}
        </button>
        {engine.testHz && <span className="text-xs text-amber-300 font-mono">test tone {engine.testHz} Hz</span>}
      </div>
    </div>
  );
};
