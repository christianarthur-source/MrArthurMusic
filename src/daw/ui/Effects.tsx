import { ChevronLeft, ChevronRight, Power, Trash2 } from 'lucide-react';
import { CHAIN_PRESETS, EFFECT_DEFS, EFFECT_ORDER, ParamDef } from '../model/effectDefs';
import * as ops from '../model/ops';
import { EffectInstance, EffectType } from '../model/types';
import { cx } from './controls';
import { useStudio } from './studio';

type Owner = { trackId: string } | 'master';

/** Effect chain editor for a track or the master bus. */
export function EffectsChain({ owner, effects }: { owner: Owner; effects: EffectInstance[] }) {
  const s = useStudio();
  const add = (type: EffectType) => {
    if (effects.length >= 8) {
      s.ui.toast('warn', 'A track can have up to 8 effects.');
      return;
    }
    s.store.exec(`Add ${EFFECT_DEFS[type].name}`, (p) => ops.addEffect(p, owner, type));
  };
  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Add effect"
          className="h-8 rounded-lg bg-amber-400/15 px-2 text-sm font-semibold text-amber-300"
          value=""
          onChange={(e) => e.target.value && add(e.target.value as EffectType)}
        >
          <option value="">+ Add effect…</option>
          {EFFECT_ORDER.map((t) => (
            <option key={t} value={t}>
              {EFFECT_DEFS[t].name}
            </option>
          ))}
        </select>
        {owner !== 'master' && (
          <select
            aria-label="Effect preset"
            className="h-8 rounded-lg bg-slate-800 px-2 text-sm text-slate-200"
            value=""
            onChange={(e) => e.target.value && s.store.exec('Apply preset', (p) => ops.applyChainPreset(p, owner.trackId, e.target.value))}
            title="Presets replace this track's effects"
          >
            <option value="">✨ Presets…</option>
            {CHAIN_PRESETS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        )}
        {effects.length === 0 && <span className="text-xs text-slate-500">No effects yet. Try a preset like “Big Drums” or “Dreamy Keys”.</span>}
      </div>
      <div className="daw-scroll flex min-h-0 gap-2 overflow-x-auto pb-1">
        {effects.map((fx, i) => (
          <EffectCard key={fx.id} fx={fx} owner={owner} index={i} count={effects.length} />
        ))}
      </div>
    </div>
  );
}

function EffectCard({ fx, owner, index, count }: { fx: EffectInstance; owner: Owner; index: number; count: number }) {
  const s = useStudio();
  const def = EFFECT_DEFS[fx.type];
  return (
    <div className={cx('w-52 shrink-0 rounded-xl border p-2', fx.bypass ? 'border-slate-800 bg-slate-900/50 opacity-60' : 'border-slate-700 bg-slate-800/70')}>
      <div className="mb-1 flex items-center gap-1">
        <button
          type="button"
          aria-pressed={!fx.bypass}
          title={fx.bypass ? 'Effect is off (bypassed). Click to turn on.' : 'Effect is on. Click to bypass.'}
          className={cx('rounded p-1', fx.bypass ? 'text-slate-500' : 'text-emerald-400')}
          onClick={() => s.store.exec('Bypass effect', (p) => ops.updateEffect(p, owner, fx.id, { bypass: !fx.bypass }))}
        >
          <Power size={14} />
        </button>
        <span className="flex-1 truncate text-sm font-semibold text-slate-100" title={def.help}>
          {def.name}
        </span>
        <button type="button" aria-label="Move left" disabled={index === 0} className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30" onClick={() => s.store.exec('Reorder effects', (p) => ops.moveEffect(p, owner, fx.id, index - 1))}>
          <ChevronLeft size={14} />
        </button>
        <button type="button" aria-label="Move right" disabled={index === count - 1} className="rounded p-0.5 text-slate-400 hover:text-white disabled:opacity-30" onClick={() => s.store.exec('Reorder effects', (p) => ops.moveEffect(p, owner, fx.id, index + 1))}>
          <ChevronRight size={14} />
        </button>
        <button type="button" aria-label={`Remove ${def.name}`} className="rounded p-0.5 text-slate-500 hover:text-rose-300" onClick={() => s.store.exec(`Remove ${def.name}`, (p) => ops.removeEffect(p, owner, fx.id))}>
          <Trash2 size={13} />
        </button>
      </div>
      <p className="mb-1 line-clamp-2 text-[10px] leading-tight text-slate-500">{def.help}</p>
      <div className="space-y-1">
        {def.params.map((pd) => (
          <ParamSlider key={pd.key} def={pd} value={fx.params[pd.key]} onChange={(v, commit) => {
            if (!commit) {
              s.store.beginGesture();
              s.store.preview((p) => ops.updateEffect(p, owner, fx.id, { params: { [pd.key]: v } }));
            } else s.store.commitGesture(`${def.name} ${pd.label}`);
          }} />
        ))}
      </div>
    </div>
  );
}

function toSlider(def: ParamDef, v: number) {
  if (def.scale === 'log') return (Math.log(v / def.min) / Math.log(def.max / def.min)) * 1000;
  return ((v - def.min) / (def.max - def.min)) * 1000;
}
function fromSlider(def: ParamDef, x: number) {
  const f = x / 1000;
  let v = def.scale === 'log' ? def.min * Math.pow(def.max / def.min, f) : def.min + f * (def.max - def.min);
  if (def.step) v = Math.round(v / def.step) * def.step;
  return Math.min(def.max, Math.max(def.min, v));
}

export function formatParam(def: ParamDef, v: number): string {
  if (def.key === 'mode') return ['Low-pass', 'High-pass', 'Band-pass'][Math.round(v)] ?? String(v);
  if (def.unit === 'Hz') return v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`;
  if (def.unit === 's') return v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`;
  if (def.unit === 'dB') return `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
  if (def.unit === ':1') return `${v.toFixed(1)}:1`;
  if (def.max === 1 && def.min === 0) return `${Math.round(v * 100)}%`;
  return v.toFixed(2);
}

function ParamSlider({ def, value, onChange }: { def: ParamDef; value: number; onChange: (v: number, commit: boolean) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-300">{def.label.replace(/ \(.*\)/, '')}</span>
        <span className="font-mono text-slate-400">{formatParam(def, value)}</span>
      </div>
      <input
        type="range"
        className="daw-range w-full"
        aria-label={def.label}
        aria-valuetext={formatParam(def, value)}
        min={0}
        max={1000}
        step={def.key === 'mode' ? 500 : 1}
        value={toSlider(def, value)}
        onChange={(e) => onChange(fromSlider(def, Number(e.target.value)), false)}
        onPointerUp={() => onChange(value, true)}
        onKeyUp={() => onChange(value, true)}
        onDoubleClick={() => {
          onChange(def.default, false);
          onChange(def.default, true);
        }}
      />
    </label>
  );
}
