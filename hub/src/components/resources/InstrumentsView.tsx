import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Boxes, CheckCircle2, Guitar, ImagePlus, Loader2, MapPin, Pencil, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useRememberedState } from '../../hooks/useRememberedState';
import { storage } from '../../services/storage';
import { compressImage } from '../../services/plannerContent';
import { InstrumentCategory, InstrumentCheckout, InstrumentItem } from '../../types';
import { ImagePickerModal } from '../shared/ImagePickerModal';

const InstrumentCharts = lazy(() => import('./InstrumentCharts').then((m) => ({ default: m.InstrumentCharts })));

/** Instruments: the room's inventory (with photos, condition and repairs), student check-outs, and fingering / chord charts. */

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const today = () => new Date().toLocaleDateString('en-CA');
const field =
  'w-full text-sm px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500';
const label = 'text-[11px] font-bold uppercase tracking-wide text-stone-400 block mb-1';
const card = 'bg-white dark:bg-stone-900 rounded-3xl shadow-card border border-stone-200/80 dark:border-stone-800';

export const CATEGORIES: { id: InstrumentCategory; label: string; emoji: string }[] = [
  { id: 'orff_barred', label: 'Orff / barred', emoji: '🎼' },
  { id: 'unpitched_percussion', label: 'Small percussion', emoji: '🪇' },
  { id: 'drums', label: 'Drums', emoji: '🥁' },
  { id: 'boomwhackers', label: 'Boomwhackers', emoji: '🌈' },
  { id: 'recorder', label: 'Recorders', emoji: '🎶' },
  { id: 'ukulele', label: 'Ukuleles', emoji: '🪕' },
  { id: 'guitar', label: 'Guitars', emoji: '🎸' },
  { id: 'keyboard', label: 'Keyboards / piano', emoji: '🎹' },
  { id: 'strings', label: 'Orchestral strings', emoji: '🎻' },
  { id: 'winds', label: 'Band / winds', emoji: '🎺' },
  { id: 'electronic', label: 'Tech & sound', emoji: '🔊' },
  { id: 'accessory', label: 'Mallets, stands, cases', emoji: '🧰' },
  { id: 'other', label: 'Other', emoji: '📦' }
];
const catOf = (id: string) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
const CONDITIONS: { id: InstrumentItem['condition']; label: string; color: string }[] = [
  { id: 'excellent', label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  { id: 'good', label: 'Good', color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  { id: 'needs_tuning', label: 'Needs tuning', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  { id: 'repair_needed', label: 'Needs repair', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' }
];
const condOf = (id: string) => CONDITIONS.find((c) => c.id === id) || CONDITIONS[1];
const openOuts = (i: InstrumentItem) => (i.checkouts || []).filter((c) => !c.returned);
const outCount = (i: InstrumentItem) => openOuts(i).reduce((s, c) => s + (c.quantity || 1), 0);
const shortDate = (d?: string) => (d ? new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

// ---------------------------------------------------------------------------

const ItemEditor: React.FC<{ item: InstrumentItem | null; locations: string[]; onSave: (i: Omit<InstrumentItem, 'id'>) => void; onClose: () => void }> = ({ item, locations, onSave, onClose }) => {
  const [it, setIt] = useState<Omit<InstrumentItem, 'id'>>(
    () => item || { name: '', category: 'orff_barred', location: locations[0] || 'Music room', quantity: 1, condition: 'good', notes: '', assetTag: '', checkouts: [] }
  );
  const [finding, setFinding] = useState(false);
  const set = (p: Partial<InstrumentItem>) => setIt((prev) => ({ ...prev, ...p }));

  return (
    <div role="dialog" aria-modal="true" aria-label={item ? 'Edit instrument' : 'Add an instrument'} className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (it.name.trim()) onSave({ ...it, name: it.name.trim(), location: it.location.trim() || 'Music room' });
        }}
        className={`${card} w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-4`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-900 dark:text-white">{item ? 'Edit instrument' : 'Add an instrument'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-4">
          <div className="w-28 shrink-0 space-y-1.5">
            <div className="w-28 h-28 rounded-2xl bg-stone-100 dark:bg-stone-800 overflow-hidden flex items-center justify-center text-4xl">
              {it.image ? <img src={it.image} alt="" className="w-full h-full object-cover" /> : catOf(it.category).emoji}
            </div>
            <button type="button" onClick={() => setFinding(true)} className="w-full px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-bold flex items-center justify-center gap-1">
              <ImagePlus className="w-3 h-3" />
              Find photo
            </button>
            <label className="w-full px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer">
              <Upload className="w-3 h-3" />
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) set({ image: await compressImage(f, 640) });
                }}
              />
            </label>
            {it.image && (
              <button type="button" onClick={() => set({ image: undefined })} className="w-full text-[11px] text-stone-400 hover:text-rose-600">
                Remove photo
              </button>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className={label}>Name / model</label>
              <input autoFocus required value={it.name} onChange={(e) => set({ name: e.target.value })} className={field} placeholder="e.g. Studio 49 alto xylophone" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Type</label>
                <select value={it.category} onChange={(e) => set({ category: e.target.value as InstrumentCategory })} className={field}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label}>How many</label>
                <input type="number" min={0} value={it.quantity} onChange={(e) => set({ quantity: Math.max(0, Number(e.target.value)) })} className={field} />
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Where it lives</label>
            <input list="inst-locations" value={it.location} onChange={(e) => set({ location: e.target.value })} className={field} placeholder="Music cart" />
            <datalist id="inst-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div>
            <label className={label}>Condition</label>
            <select value={it.condition} onChange={(e) => set({ condition: e.target.value as InstrumentItem['condition'] })} className={field}>
              {CONDITIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={label}>Serial / asset tag</label>
            <input value={it.assetTag || ''} onChange={(e) => set({ assetTag: e.target.value })} className={field} />
          </div>
        </div>
        <div>
          <label className={label}>Notes and repairs</label>
          <textarea value={it.notes || ''} onChange={(e) => set({ notes: e.target.value })} rows={3} className={field} placeholder="Mallets included, missing F bar, restrung 9/2026…" />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 dark:text-stone-300">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold">
            Save
          </button>
        </div>
      </form>
      {finding && (
        <ImagePickerModal
          title="Find a photo of this instrument"
          initialPrompt={it.name}
          wide={false}
          onClose={() => setFinding(false)}
          onPick={(img) => {
            set({ image: img.src });
            setFinding(false);
          }}
        />
      )}
    </div>
  );
};

const CheckoutForm: React.FC<{ item: InstrumentItem; onClose: () => void }> = ({ item, onClose }) => {
  const free = item.quantity - outCount(item);
  const [who, setWho] = useState('');
  const [qty, setQty] = useState(1);
  const [due, setDue] = useState('');
  return (
    <div role="dialog" aria-modal="true" aria-label="Check out" className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!who.trim()) return;
          const c: InstrumentCheckout = { id: newId('out'), who: who.trim(), out: today(), due: due || undefined, quantity: qty > 1 ? qty : undefined };
          storage.updateInventoryItem(item.id, { checkouts: [c, ...(item.checkouts || [])], updatedAt: new Date().toISOString() });
          onClose();
        }}
        className={`${card} w-full max-w-sm p-6 space-y-3`}
      >
        <h3 className="text-lg font-bold text-stone-900 dark:text-white">Check out: {item.name}</h3>
        <p className="text-xs text-stone-500">{free} of {item.quantity} available</p>
        <div>
          <label className={label}>Who has it</label>
          <input autoFocus required value={who} onChange={(e) => setWho(e.target.value)} className={field} placeholder="Student or class" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {item.quantity > 1 && (
            <div>
              <label className={label}>How many</label>
              <input type="number" min={1} max={Math.max(1, free)} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className={field} />
            </div>
          )}
          <div>
            <label className={label}>Due back</label>
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={field} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold text-stone-600 dark:text-stone-300">
            Cancel
          </button>
          <button type="submit" className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold">
            Check out
          </button>
        </div>
      </form>
    </div>
  );
};

// ---------------------------------------------------------------------------

type Tab = 'inventory' | 'checkouts' | 'charts';

export const InstrumentsView: React.FC = () => {
  const { showToast } = useApp();
  const [tab, setTab] = useRememberedState<Tab>('instruments.tab', 'inventory');
  const [items, setItems] = useState<InstrumentItem[]>([]);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useRememberedState('instruments.place', 'all');
  const [kind, setKind] = useRememberedState('instruments.kind', 'all');
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [editing, setEditing] = useState<InstrumentItem | 'new' | null>(null);
  const [lending, setLending] = useState<InstrumentItem | null>(null);

  useEffect(() => {
    const load = () => setItems(storage.getInventory());
    load();
    return storage.subscribe(load);
  }, []);

  const locations = useMemo(() => [...new Set(items.map((i) => i.location).filter(Boolean))].sort(), [items]);
  const kinds = useMemo(() => CATEGORIES.filter((c) => items.some((i) => i.category === c.id)), [items]);
  const needsWork = items.filter((i) => i.condition === 'needs_tuning' || i.condition === 'repair_needed');
  const outs = items.flatMap((i) => openOuts(i).map((c) => ({ item: i, c }))).sort((a, b) => (a.c.due || '9').localeCompare(b.c.due || '9'));
  const overdue = outs.filter((o) => o.c.due && o.c.due < today());
  const returnedRecently = items
    .flatMap((i) => (i.checkouts || []).filter((c) => c.returned).map((c) => ({ item: i, c })))
    .sort((a, b) => b.c.returned!.localeCompare(a.c.returned!))
    .slice(0, 15);

  const filtered = items.filter((i) => {
    const q = query.trim().toLowerCase();
    return (
      (!q || [i.name, i.notes, i.assetTag, i.location, catOf(i.category).label].some((v) => v?.toLowerCase().includes(q))) &&
      (place === 'all' || i.location === place) &&
      (kind === 'all' || i.category === kind) &&
      (!attentionOnly || needsWork.includes(i))
    );
  });

  const save = (data: Omit<InstrumentItem, 'id'>) => {
    const stamped = { ...data, updatedAt: new Date().toISOString() };
    if (editing && editing !== 'new') storage.updateInventoryItem(editing.id, stamped);
    else storage.addInventoryItem(stamped);
    showToast(`Saved ${data.name}`, 'success');
    setEditing(null);
  };

  const markReturned = (item: InstrumentItem, id: string) =>
    storage.updateInventoryItem(item.id, { checkouts: (item.checkouts || []).map((c) => (c.id === id ? { ...c, returned: today() } : c)) });

  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${active ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Instruments">
        {(
          [
            ['inventory', 'Inventory', Boxes],
            ['checkouts', `Checked out${outs.length ? ` (${outs.length})` : ''}`, ArrowRightLeft],
            ['charts', 'Fingering & chord charts', Guitar]
          ] as const
        ).map(([id, text, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 ${tab === id ? 'bg-brand-600 text-white shadow-sm' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'}`}
          >
            <Icon className="w-4 h-4" />
            {text}
          </button>
        ))}
      </div>

      {tab === 'inventory' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ['Items', items.length, ''],
              ['Instruments in all', items.reduce((s, i) => s + (i.quantity || 0), 0), ''],
              ['Need tuning or repair', needsWork.length, needsWork.length ? 'text-amber-600' : ''],
              ['Checked out', outs.reduce((s, o) => s + (o.c.quantity || 1), 0), overdue.length ? 'text-rose-600' : '']
            ].map(([k, v, color]) => (
              <div key={k as string} className={`${card} p-4`}>
                <p className={`text-2xl font-black ${color || 'text-stone-900 dark:text-white'}`}>{v}</p>
                <p className="text-xs font-semibold text-stone-500">{k}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="flex gap-1.5 overflow-x-auto pb-1 flex-1">
              <button type="button" onClick={() => setPlace('all')} className={chip(place === 'all')}>
                Everywhere
              </button>
              {locations.map((l) => (
                <button key={l} type="button" onClick={() => setPlace(l)} className={chip(place === l)}>
                  {l}
                </button>
              ))}
              {needsWork.length > 0 && (
                <button type="button" onClick={() => setAttentionOnly(!attentionOnly)} className={`${chip(attentionOnly)} flex items-center gap-1`}>
                  <AlertTriangle className="w-3 h-3" />
                  Needs attention
                </button>
              )}
            </div>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" className={`${field} lg:w-48`}>
              <option value="all">All types</option>
              {kinds.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <div className="relative lg:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search instruments" aria-label="Search instruments" className={`${field} pl-9`} />
            </div>
            <button type="button" onClick={() => setEditing('new')} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center justify-center gap-1.5 shrink-0">
              <Plus className="w-4 h-4" />
              Add instrument
            </button>
          </div>

          {items.length === 0 ? (
            <div className={`${card} p-10 text-center space-y-2`}>
              <Boxes className="w-8 h-8 mx-auto text-brand-400" />
              <p className="font-bold text-stone-800 dark:text-stone-100">No instruments yet</p>
              <p className="text-sm text-stone-500">Add what's in your room and closets: how many, where they live, their condition, and who has them.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((i) => {
                const out = outCount(i);
                return (
                  <div key={i.id} className={`${card} overflow-hidden flex flex-col`}>
                    <div className="h-36 bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-5xl relative">
                      {i.image ? <img src={i.image} alt="" className="w-full h-full object-cover" loading="lazy" /> : catOf(i.category).emoji}
                      <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${condOf(i.condition).color}`}>{condOf(i.condition).label}</span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-stone-900 dark:text-white leading-snug">{i.name}</h3>
                        <span className="text-sm font-black text-stone-500 shrink-0">×{i.quantity}</span>
                      </div>
                      <p className="text-xs text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {i.location}
                        {i.assetTag && <span className="ml-1 font-mono">· {i.assetTag}</span>}
                      </p>
                      {i.notes && <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-3">{i.notes}</p>}
                      {out > 0 && <p className="text-xs font-semibold text-brand-600">{out} checked out: {openOuts(i).map((c) => c.who).join(', ')}</p>}
                      <div className="mt-auto pt-2 flex items-center gap-1">
                        <button
                          type="button"
                          disabled={out >= i.quantity}
                          onClick={() => setLending(i)}
                          className="px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          Check out
                        </button>
                        <span className="flex-1" />
                        <button type="button" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirm(`Delete ${i.name}?`) && storage.deleteInventoryItem(i.id)}
                          aria-label={`Delete ${i.name}`}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <p className="text-sm text-stone-500">Nothing matches.</p>}
            </div>
          )}
        </>
      )}

      {tab === 'checkouts' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className={`${card} p-5 lg:col-span-2 space-y-2`}>
            <h3 className="font-bold text-stone-900 dark:text-white">Out right now</h3>
            {outs.length === 0 && <p className="text-sm text-stone-500">Nothing is checked out. Use "Check out" on an instrument in the inventory.</p>}
            {outs.map(({ item, c }) => {
              const late = c.due && c.due < today();
              return (
                <div key={c.id} className={`flex flex-wrap items-center gap-3 p-3 rounded-2xl ${late ? 'bg-rose-50 dark:bg-rose-950/40' : 'bg-stone-50 dark:bg-stone-800/60'}`}>
                  <span className="text-2xl">{catOf(item.category).emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900 dark:text-white truncate">
                      {c.who}
                      {(c.quantity || 1) > 1 && <span className="font-normal text-stone-500"> ×{c.quantity}</span>}
                    </p>
                    <p className="text-xs text-stone-500 truncate">{item.name} · since {shortDate(c.out)}</p>
                  </div>
                  {c.due && <span className={`text-xs font-bold ${late ? 'text-rose-600' : 'text-stone-500'}`}>{late ? 'Overdue' : 'Due'} {shortDate(c.due)}</span>}
                  <button type="button" onClick={() => markReturned(item, c.id)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Returned
                  </button>
                </div>
              );
            })}
          </div>
          <div className={`${card} p-5 space-y-2`}>
            <h3 className="font-bold text-stone-900 dark:text-white">Recently returned</h3>
            {returnedRecently.length === 0 && <p className="text-sm text-stone-500">Returns show up here.</p>}
            {returnedRecently.map(({ item, c }) => (
              <div key={c.id} className="text-sm flex justify-between gap-2">
                <span className="truncate text-stone-700 dark:text-stone-300">
                  {c.who} · {item.name}
                </span>
                <span className="text-xs text-stone-400 shrink-0">{shortDate(c.returned)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'charts' && (
        <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin text-stone-400 mx-auto my-10" />}>
          <InstrumentCharts />
        </Suspense>
      )}

      {editing && <ItemEditor item={editing === 'new' ? null : editing} locations={locations} onSave={save} onClose={() => setEditing(null)} />}
      {lending && <CheckoutForm item={lending} onClose={() => setLending(null)} />}
    </div>
  );
};
