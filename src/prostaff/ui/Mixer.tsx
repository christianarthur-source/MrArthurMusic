import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { DEFAULT_MASTER_MIX, DEFAULT_STAFF_MIX, type MasterMix, type StaffMix } from '../audio/player';

export interface MixerPart {
  name: string;
  ns: string[]; // staff numbers of the part
}

const pct = (v: number) => `${Math.round(v * 100)}`;
const db = (v: number) => (v <= 0.001 ? '−∞' : `${(20 * Math.log10(v / 0.8)).toFixed(1)}`);
const panLabel = (p: number) => (Math.abs(p) < 0.04 ? 'C' : p < 0 ? `L${Math.round(-p * 100)}` : `R${Math.round(p * 100)}`);

function Knob({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <label className="ps-mx-knob" title={`${label}: ${display} (double-click to reset)`}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <small>{display}</small>
    </label>
  );
}

export function Mixer({ parts, mix, master, engine, onStrip, onMaster, onReset, onClose }: {
  parts: MixerPart[];
  mix: Record<string, StaffMix>;
  master: MasterMix;
  engine: string;
  onStrip: (ns: string[], patch: Partial<StaffMix>) => void;
  onMaster: (patch: Partial<MasterMix>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const anySolo = parts.some((p) => mix[p.ns[0]]?.solo);
  return (
    <section className="ps-mx" aria-label="Mixer">
      <header>
        <b>Mixer</b>
        <small>{engine}</small>
        <span style={{ flex: 1 }} />
        <button className="ps-btn" onClick={onReset} title="Reset all faders"><RotateCcw size={14} /> Reset</button>
        <button className="ps-btn" onClick={onClose} aria-label="Close mixer"><X size={16} /></button>
      </header>
      <div className="ps-mx-strips">
        {parts.map((p) => {
          const m = { ...DEFAULT_STAFF_MIX, ...mix[p.ns[0]] };
          const set = (patch: Partial<StaffMix>) => onStrip(p.ns, patch);
          const dim = m.mute || (anySolo && !m.solo);
          return (
            <div key={p.ns.join(',')} className={`ps-mx-strip${dim ? ' ps-dim' : ''}`}>
              <div className="ps-mx-name" title={p.name}>{p.name}</div>
              <Knob label="Reverb" value={m.reverb} min={0} max={1} step={0.01} onChange={(v) => set({ reverb: v })} display={pct(m.reverb)} />
              <div onDoubleClick={() => set({ pan: 0 })}>
                <Knob label="Pan" value={m.pan} min={-1} max={1} step={0.02} onChange={(v) => set({ pan: v })} display={panLabel(m.pan)} />
              </div>
              <div className="ps-mx-fader" onDoubleClick={() => set({ volume: DEFAULT_STAFF_MIX.volume })}>
                <input type="range" min={0} max={1} step={0.01} value={m.volume} onChange={(e) => set({ volume: Number(e.target.value) })} aria-label={`${p.name} volume`} />
              </div>
              <small className="ps-mx-db">{db(m.volume)} dB</small>
              <div className="ps-mx-ms">
                <button className={m.mute ? 'ps-on ps-mute' : ''} onClick={() => set({ mute: !m.mute })} title="Mute">M</button>
                <button className={m.solo ? 'ps-on' : ''} onClick={() => set({ solo: !m.solo })} title="Solo">S</button>
              </div>
            </div>
          );
        })}
        <div className="ps-mx-strip ps-mx-master">
          <div className="ps-mx-name">Master</div>
          <Knob label="Hall reverb" value={master.reverb} min={0} max={1} step={0.01} onChange={(v) => onMaster({ reverb: v })} display={pct(master.reverb)} />
          <div onDoubleClick={() => onMaster({ brightness: DEFAULT_MASTER_MIX.brightness })}>
            <Knob label="Tone" value={master.brightness} min={-1} max={1} step={0.05} onChange={(v) => onMaster({ brightness: v })} display={master.brightness > 0.05 ? 'bright' : master.brightness < -0.05 ? 'warm' : 'flat'} />
          </div>
          <div className="ps-mx-fader" onDoubleClick={() => onMaster({ volume: DEFAULT_MASTER_MIX.volume })}>
            <input type="range" min={0} max={1} step={0.01} value={master.volume} onChange={(e) => onMaster({ volume: Number(e.target.value) })} aria-label="Master volume" />
          </div>
          <small className="ps-mx-db">{master.volume <= 0.001 ? "−∞" : (20 * Math.log10(master.volume / 0.85)).toFixed(1)} dB</small>
          <div className="ps-mx-ms" />
        </div>
      </div>
    </section>
  );
}
