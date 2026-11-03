import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { InstrumentItem } from '../../types';
import {
  Boxes,
  Plus,
  Wrench,
  Search,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Tag
} from 'lucide-react';

export const InventoryView: React.FC = () => {
  const { showToast } = useApp();

  const [items, setItems] = useState<InstrumentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<InstrumentItem['category']>('orff_barred');
  const [location, setLocation] = useState<InstrumentItem['location']>('Music Cart');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<InstrumentItem['condition']>('excellent');
  const [notes, setNotes] = useState('');

  const reloadData = () => {
    setItems(storage.getInventory());
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const created = storage.addInventoryItem({
      name: name.trim(),
      category,
      location,
      quantity: Number(quantity) || 1,
      condition,
      notes: notes.trim()
    });

    setIsAddOpen(false);
    setName('');
    setNotes('');
    showToast(`Added ${created.name}`, 'success');
  };

  const handleDelete = (id: string) => {
    storage.deleteInventoryItem(id);
    showToast('Item removed', 'info');
  };

  const filtered = items.filter((item) => {
    const matchesLoc = selectedLocation === 'all' || item.location === selectedLocation;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  const conditionColors = {
    excellent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    good: 'bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300',
    needs_tuning: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    repair_needed: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-brand-600" />
            <span>Music Cart & Instrument Inventory</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
            Track Orff barred instruments, rolling cart supplies, ukulele sets, and recorders.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Instrument</span>
        </button>
      </div>

      {/* Filter and Location Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'Music Cart', 'Room 104 Shelf A', 'Closet B', 'Stage'].map((loc) => (
            <button
              key={loc}
              onClick={() => setSelectedLocation(loc)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedLocation === loc
                  ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
              }`}
            >
              {loc === 'all' ? 'All Locations' : loc}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search instruments..."
            className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Inventory Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-3xl bg-white dark:bg-stone-900 shadow-card border border-stone-200/80 dark:border-stone-800 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                  Qty: {item.quantity}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${conditionColors[item.condition]}`}>
                    {item.condition.replace('_', ' ')}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 text-stone-400 hover:text-rose-500 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-sm font-bold text-stone-900 dark:text-white leading-snug">
                {item.name}
              </h3>

              {item.notes && (
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                  {item.notes}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs text-stone-500">
              <span className="font-semibold text-brand-600 dark:text-brand-400">
                📍 {item.location}
              </span>
              <span className="capitalize">{item.category.replace('_', ' ')}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Instrument Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddItem}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">
              Add Instrument to Inventory
            </h3>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Instrument Name & Model
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Studio 49 Alto Metallophone"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="orff_barred">Orff Barred Instrument</option>
                  <option value="ukulele">Ukulele</option>
                  <option value="recorder">Recorder</option>
                  <option value="unpitched_percussion">Unpitched Percussion</option>
                  <option value="boomwhackers">Boomwhackers</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  min="1"
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="Music Cart">Rolling Music Cart</option>
                  <option value="Room 104 Shelf A">Room 104 Shelf A</option>
                  <option value="Closet B">Closet B</option>
                  <option value="Stage">Stage / Auditorium</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Condition</label>
                <select
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="needs_tuning">Needs Tuning</option>
                  <option value="repair_needed">Repair Needed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="e.g. Includes pair of medium yarn mallets..."
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm"
              >
                Save Instrument
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
