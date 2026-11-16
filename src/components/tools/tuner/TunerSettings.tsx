import React, { useCallback, useState } from 'react';
import { TRANSPOSITIONS, type TranspositionKey } from '../../../audio/tuner/noteMath.ts';
import type { InputDevice } from '../../../audio/tuner/useTunerEngine.ts';

export type ToleranceKey = 'kids' | 'standard' | 'pro';
export const TOLERANCES: Record<ToleranceKey, { label: string; cents: number }> = {
  kids: { label: 'Kids ±8¢', cents: 8 },
  standard: { label: 'Standard ±5¢', cents: 5 },
  pro: { label: 'Pro ±2¢', cents: 2 },
};

export interface TunerSettingsState {
  a4: number;
  tolerance: ToleranceKey;
  useFlats: boolean;
  transposition: TranspositionKey;
  showHistory: boolean;
  showStrobe: boolean;
  presetId: string;
  deviceId: string | null;
}

const KEY = 'tuner.settings.v2';
const DEFAULTS: TunerSettingsState = {
  a4: 440,
  tolerance: 'kids',
  useFlats: false,
  transposition: 'C',
  showHistory: true,
  showStrobe: false,
  presetId: 'chromatic',
  deviceId: null,
};

function load(): TunerSettingsState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<TunerSettingsState>;
    const a4 = typeof p.a4 === 'number' && p.a4 >= 415 && p.a4 <= 466 ? Math.round(p.a4) : 440;
    return {
      ...DEFAULTS,
      ...p,
      a4,
      tolerance: p.tolerance && p.tolerance in TOLERANCES ? p.tolerance : 'kids',
      transposition: p.transposition && p.transposition in TRANSPOSITIONS ? p.transposition : 'C',
    };
  } catch {
    return DEFAULTS;
  }
}

export function useTunerSettings(): [TunerSettingsState, (patch: Partial<TunerSettingsState>) => void] {
  const [state, setState] = useState<TunerSettingsState>(load);
  const update = useCallback((patch: Partial<TunerSettingsState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return [state, update];
}

const chip = (on: boolean) =>
  `min-h-[44px] px-3 rounded-xl text-sm font-bold border cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-300 ${
    on ? 'bg-teal-400 text-slate-950 border-teal-300' : 'bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800'
  }`;

interface Props {
  settings: TunerSettingsState;
  update: (patch: Partial<TunerSettingsState>) => void;
  devices: InputDevice[];
  deviceId: string | null;
  onDevice: (id: string) => void;
}

export const TunerSettings: React.FC<Props> = ({ settings, update, devices, deviceId, onDevice }) => (
  <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-4 text-sm text-slate-200" data-testid="tuner-settings">
    <div>
      <div className="flex items-center justify-between font-bold">
        <label htmlFor="tuner-a4">Reference pitch (A4)</label>
        <span className="font-mono text-teal-300">{settings.a4} Hz</span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <button type="button" className={chip(false)} aria-label="Lower A4 by 1 Hz" onClick={() => update({ a4: Math.max(415, settings.a4 - 1) })}>−</button>
        <input
          id="tuner-a4" type="range" min={415} max={466} step={1} value={settings.a4}
          onChange={(e) => update({ a4: Number(e.target.value) })}
          className="flex-1 min-w-[120px] h-11 accent-teal-400"
        />
        <button type="button" className={chip(false)} aria-label="Raise A4 by 1 Hz" onClick={() => update({ a4: Math.min(466, settings.a4 + 1) })}>+</button>
        {[440, 442].map((hz) => (
          <button key={hz} type="button" className={chip(settings.a4 === hz)} onClick={() => update({ a4: hz })}>{hz}</button>
        ))}
      </div>
    </div>

    <div>
      <div className="font-bold mb-2">In-tune tolerance</div>
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TOLERANCES) as ToleranceKey[]).map((k) => (
          <button key={k} type="button" className={chip(settings.tolerance === k)} aria-pressed={settings.tolerance === k} onClick={() => update({ tolerance: k })}>
            {TOLERANCES[k].label}
          </button>
        ))}
      </div>
    </div>

    <div>
      <div className="font-bold mb-2">Note names</div>
      <div className="flex gap-2">
        <button type="button" className={chip(!settings.useFlats)} aria-pressed={!settings.useFlats} onClick={() => update({ useFlats: false })}>Sharps ♯</button>
        <button type="button" className={chip(settings.useFlats)} aria-pressed={settings.useFlats} onClick={() => update({ useFlats: true })}>Flats ♭</button>
      </div>
    </div>

    <div>
      <label className="font-bold mb-2 block" htmlFor="tuner-transpose">Transposing instrument</label>
      <select
        id="tuner-transpose" value={settings.transposition}
        onChange={(e) => update({ transposition: e.target.value as TranspositionKey })}
        className="min-h-[44px] w-full rounded-xl bg-slate-900 border border-slate-700 px-3 font-bold text-white"
      >
        {(Object.keys(TRANSPOSITIONS) as TranspositionKey[]).map((k) => (
          <option key={k} value={k}>{TRANSPOSITIONS[k].label}</option>
        ))}
      </select>
      <p className="text-xs text-slate-400 mt-1">Shows the note you read. Reference tones stay at concert pitch.</p>
    </div>

    {devices.length > 1 && (
      <div>
        <label className="font-bold mb-2 block" htmlFor="tuner-mic">Microphone</label>
        <select
          id="tuner-mic" value={deviceId ?? ''} onChange={(e) => onDevice(e.target.value)}
          className="min-h-[44px] w-full rounded-xl bg-slate-900 border border-slate-700 px-3 font-bold text-white"
        >
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
      </div>
    )}

    <div className="flex gap-2 flex-wrap">
      <button type="button" className={chip(settings.showHistory)} aria-pressed={settings.showHistory} onClick={() => update({ showHistory: !settings.showHistory })}>Pitch history</button>
      <button type="button" className={chip(settings.showStrobe)} aria-pressed={settings.showStrobe} onClick={() => update({ showStrobe: !settings.showStrobe })}>Strobe</button>
    </div>
  </div>
);
