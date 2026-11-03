import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { JournalEntry } from '../../types';
import {
  BookMarked,
  Plus,
  Smile,
  Zap,
  Calendar,
  Sparkles,
  Pin,
  Trash2,
  FileText,
  Search,
  Check,
  Star,
  CloudSun,
  MapPin,
  Image as ImageIcon,
  History,
  LayoutGrid,
  List,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export const JournalView: React.FC = () => {
  const { showToast } = useApp();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<'entries' | 'calendar'>('entries');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterStarredOnly, setFilterStarredOnly] = useState(false);

  // Calendar Heatmap Navigation
  const [calDate, setCalDate] = useState<Date>(new Date(2026, 10, 3)); // Nov 2026 default

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mood, setMood] = useState<JournalEntry['mood']>('great');
  const [energyLevel, setEnergyLevel] = useState<JournalEntry['energyLevel']>(4);
  const [weather, setWeather] = useState<JournalEntry['weather']>('sunny');
  const [location, setLocation] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [starred, setStarred] = useState(false);
  const [tagsStr, setTagsStr] = useState('reflection, general-music');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const reloadData = () => {
    const loaded = storage.getJournalEntries();
    setEntries(loaded);
    if (!selectedEntryId && loaded.length > 0) {
      setSelectedEntryId(loaded[0].id);
    }
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const selectedEntry = entries.find((e) => e.id === selectedEntryId) || entries[0];

  const templates: { name: string; type: JournalEntry['templateType']; defaultTitle: string; defaultContent: string }[] = [
    {
      name: 'What Worked Well Today?',
      type: 'what_worked',
      defaultTitle: 'What Worked Well Today in Music',
      defaultContent: `Key breakthroughs and student engagement highlights:

1. Activity that succeeded:
2. Pedagogical reason it clicked:
3. Student response or quotes:
4. Quick adjustment for next lesson:`
    },
    {
      name: 'Reuse Next Year (Keeper)',
      type: 'reuse_next_year',
      defaultTitle: 'Gold-Standard Activity to Reuse Next Year',
      defaultContent: `Grade & Unit:
Activity Name:
Materials setup:

Why this activity is a keeper:
- Perfect pacing and zero dead time.
- All students participated enthusiastically regardless of prior singing experience.`
    },
    {
      name: 'Chorus & Rehearsal Debrief',
      type: 'chorus_notes',
      defaultTitle: 'Rehearsal Debrief & Target Measures',
      defaultContent: `Rehearsal piece:
Section focus (Part 1 vs Part 2):

1. Intonation and vowel blend:
2. Diction and crisp consonant releases:
3. Target measures for next rehearsal:`
    },
    {
      name: 'Emergency Sub Note',
      type: 'sub_plan',
      defaultTitle: 'Music Sub Note & Roster Reminders',
      defaultContent: `Schedule & Room:
Homeroom teachers & periods:
Behavior plan & reward system:

Activities for sub (e.g. Chrome Music Lab or video listening lesson in Link Library):`
    }
  ];

  const handleApplyTemplate = (tmpl: typeof templates[0]) => {
    setTitle(tmpl.defaultTitle);
    setContent(tmpl.defaultContent);
    setTagsStr(`template, ${tmpl.type}`);
    setIsEditing(true);
    showToast(`Loaded ${tmpl.name} template`, 'info');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        showToast('Photo is too large (max 2MB)', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
        showToast('Photo attached to reflection', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const created = storage.addJournalEntry({
      date,
      title: title.trim(),
      content: content.trim(),
      tags: tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      mood,
      energyLevel,
      weather,
      location,
      photoUrl,
      starred,
      pinned: false
    });

    setIsEditing(false);
    setSelectedEntryId(created.id);
    showToast('Journal reflection saved', 'success');
  };

  const toggleStar = (id: string, currentStarred?: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    storage.updateJournalEntry(id, { starred: !currentStarred });
    reloadData();
    showToast(!currentStarred ? 'Starred entry' : 'Unstarred entry', 'info');
  };

  const handleDelete = (id: string) => {
    storage.deleteJournalEntry(id);
    showToast('Entry removed', 'info');
  };

  const moodEmojis = {
    great: '😄 Great day',
    good: '🙂 Good',
    neutral: '😐 Neutral',
    challenging: '😓 Challenging',
    exhausting: '😴 Exhausting'
  };

  const weatherIcons: Record<string, string> = {
    sunny: '☀️ Sunny',
    cloudy: '⛅ Cloudy',
    rainy: '🌧️ Rainy',
    snowy: '❄️ Snowy',
    indoor_recess: '🏫 Indoor Recess'
  };

  // Extract all unique tags
  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags))).sort();

  // "On This Day" Finder (same month and day)
  const todayStr = new Date().toISOString().slice(5, 10); // MM-DD
  const onThisDayEntries = entries.filter((e) => e.date.endsWith(todayStr) || e.date.endsWith('11-03'));

  // Filtering
  const filteredEntries = entries.filter((entry) => {
    if (filterStarredOnly && !entry.starred) return false;
    if (selectedTag && !entry.tags.includes(selectedTag)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inTitle = entry.title.toLowerCase().includes(q);
      const inContent = entry.content.toLowerCase().includes(q);
      const inTags = entry.tags.some((t) => t.toLowerCase().includes(q));
      if (!inTitle && !inContent && !inTags) return false;
    }
    return true;
  });

  // Calendar Heatmap Calculations
  const calYear = calDate.getFullYear();
  const calMonth = calDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInCalMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calMonthTitle = calDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Hidden Photo Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
              <BookMarked className="w-5 h-5" />
            </div>
            <span>Daily Teaching Journal & Day One Reflections</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Capture lesson breakthroughs, tag keeper activities, log weather & mood, attach classroom photos, and revisit past reflections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle: List vs Calendar */}
          <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setViewMode('entries')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'entries'
                  ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Entries</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
          </div>

          <button
            onClick={() => {
              setTitle('Daily Teaching Reflection');
              setContent('');
              setDate(new Date().toISOString().split('T')[0]);
              setPhotoUrl(undefined);
              setStarred(false);
              setIsEditing(true);
            }}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* "On This Day" / Flashback Banner (Day One signature feature) */}
      {onThisDayEntries.length > 0 && !isEditing && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 border border-amber-300/60 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  On This Day in Music Class
                </span>
                <span className="text-xs font-mono text-stone-500">
                  ({onThisDayEntries[0].date})
                </span>
              </div>
              <h4 className="text-sm font-bold text-stone-900 dark:text-white">
                {onThisDayEntries[0].title}
              </h4>
            </div>
          </div>

          <button
            onClick={() => {
              setSelectedEntryId(onThisDayEntries[0].id);
              setViewMode('entries');
              setIsEditing(false);
            }}
            className="px-4 py-2 rounded-xl bg-white dark:bg-stone-900 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800 hover:bg-amber-50 shadow-xs self-start sm:self-auto shrink-0"
          >
            Read Flashback
          </button>
        </div>
      )}

      {/* Search Bar + Filter by Tag & Starred */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reflections, breakthrough ideas, tags..."
            className="w-full pl-9 pr-3 py-2 bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 rounded-2xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilterStarredOnly(!filterStarredOnly)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
              filterStarredOnly
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${filterStarredOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>Starred</span>
          </button>

          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="px-2.5 py-1.5 rounded-xl bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 text-xs font-bold flex items-center gap-1"
            >
              <span>#{selectedTag}</span>
              <X className="w-3 h-3" />
            </button>
          )}

          {allTags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
                selectedTag === tag
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200/80 dark:border-stone-700'
              }`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* CALENDAR HEATMAP VIEW */}
      {viewMode === 'calendar' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <h3 className="font-bold text-stone-900 dark:text-white text-base">
                Reflection Calendar ({calMonthTitle})
              </h3>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCalDate(new Date(calYear, calMonth - 1, 1))}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCalDate(new Date())}
                className="px-2.5 py-1 rounded-xl text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Today
              </button>
              <button
                onClick={() => setCalDate(new Date(calYear, calMonth + 1, 1))}
                className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase tracking-wider text-stone-400">
            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`blank-${i}`} className="h-16 rounded-2xl bg-stone-50/40 dark:bg-stone-800/10" />
            ))}

            {Array.from({ length: daysInCalMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const dayEntries = entries.filter((e) => e.date === dateStr);
              const hasEntries = dayEntries.length > 0;

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => {
                    if (hasEntries) {
                      setSelectedEntryId(dayEntries[0].id);
                      setViewMode('entries');
                      setIsEditing(false);
                    } else {
                      setDate(dateStr);
                      setTitle(`Reflection for ${dateStr}`);
                      setContent('');
                      setIsEditing(true);
                      setViewMode('entries');
                    }
                  }}
                  className={`h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    hasEntries
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:border-amber-500 shadow-xs'
                      : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200/60 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-stone-700 dark:text-stone-300">
                      {dayNum}
                    </span>
                    {hasEntries && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                    )}
                  </div>

                  {hasEntries && (
                    <div className="text-[10px] font-bold text-stone-900 dark:text-white line-clamp-2 leading-tight">
                      {dayEntries[0].title}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ENTRIES LIST & READER VIEW */}
      {viewMode === 'entries' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Entries List */}
          <div className="lg:col-span-5 space-y-2 max-h-[75vh] overflow-y-auto pr-1">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400 bg-stone-50 dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
                No journal reflections found matching your criteria.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const isSelected = entry.id === selectedEntryId;
                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setSelectedEntryId(entry.id);
                      setIsEditing(false);
                    }}
                    className={`p-4 rounded-3xl cursor-pointer transition-all border text-left ${
                      isSelected
                        ? 'bg-white dark:bg-stone-800 border-brand-500 shadow-card'
                        : 'bg-stone-50/70 dark:bg-stone-900/60 border-stone-200/60 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 font-mono text-stone-400">
                        <span>{entry.date}</span>
                        {entry.weather && (
                          <span title={entry.weather}>{weatherIcons[entry.weather]?.split(' ')[0]}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => toggleStar(entry.id, entry.starred, e)}
                          className="text-stone-400 hover:text-amber-500 p-1"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              entry.starred ? 'fill-amber-400 text-amber-500' : ''
                            }`}
                          />
                        </button>
                        <span className="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                          {moodEmojis[entry.mood]}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-stone-900 dark:text-white line-clamp-1">
                      {entry.title}
                    </h3>

                    <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                      {entry.content}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-stone-100 dark:border-stone-800/50">
                      <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      {entry.photoUrl && (
                        <span className="text-[10px] font-bold text-stone-400 flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Photo
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Entry Reader or Form */}
          <div className="lg:col-span-7">
            {isEditing ? (
              <form
                onSubmit={handleSaveEntry}
                className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    Write Journal Reflection
                  </h3>
                  <button
                    type="button"
                    onClick={() => setStarred(!starred)}
                    className="p-1.5 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 text-xs font-semibold"
                  >
                    <Star className={`w-4 h-4 ${starred ? 'fill-amber-400 text-amber-500' : 'text-stone-400'}`} />
                    <span>{starred ? 'Starred' : 'Star Entry'}</span>
                  </button>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm font-bold px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    placeholder="Reflection title..."
                    required
                  />
                </div>

                {/* Day One Context Grid: Date, Mood, Weather, Location */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Mood Rating</label>
                    <select
                      value={mood}
                      onChange={(e) => setMood(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    >
                      <option value="great">😄 Great Day</option>
                      <option value="good">🙂 Good Day</option>
                      <option value="neutral">😐 Neutral</option>
                      <option value="challenging">😓 Challenging</option>
                      <option value="exhausting">😴 Exhausting</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Weather Context</label>
                    <select
                      value={weather}
                      onChange={(e) => setWeather(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    >
                      <option value="sunny">☀️ Sunny</option>
                      <option value="cloudy">⛅ Cloudy</option>
                      <option value="rainy">🌧️ Rainy</option>
                      <option value="snowy">❄️ Snowy</option>
                      <option value="indoor_recess">🏫 Indoor Recess</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                      placeholder="Room 104, Music Cart, Auditorium..."
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">Reflection Content</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    className="w-full text-xs sm:text-sm px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-serif leading-relaxed"
                    placeholder="Write your teaching thoughts, student breakthroughs, or adjustments..."
                    required
                  />
                </div>

                {/* Photo Attachment preview or button */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-stone-400">Classroom Photo Attachment</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 border border-stone-200 dark:border-stone-700"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{photoUrl ? 'Change Photo' : 'Attach Photo'}</span>
                    </button>
                  </div>

                  {photoUrl && (
                    <div className="relative rounded-2xl overflow-hidden max-h-48 border border-stone-200 dark:border-stone-700">
                      <img src={photoUrl} alt="Reflection Attachment" className="w-full object-cover max-h-48" />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl(undefined)}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black text-white rounded-xl text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    value={tagsStr}
                    onChange={(e) => setTagsStr(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                    placeholder="orff, kindergarten, vocal-warmup, keeper..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm"
                  >
                    Save Reflection
                  </button>
                </div>
              </form>
            ) : selectedEntry ? (
              <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-6">
                {/* Header & Day One Meta Chips */}
                <div className="flex items-start justify-between pb-4 border-b border-stone-100 dark:border-stone-800 gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-stone-400 mb-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{selectedEntry.date}</span>
                      </div>
                      <span>•</span>
                      {selectedEntry.weather && (
                        <span>{weatherIcons[selectedEntry.weather]}</span>
                      )}
                      {selectedEntry.location && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-stone-500 font-sans">
                            <MapPin className="w-3 h-3" />
                            {selectedEntry.location}
                          </span>
                        </>
                      )}
                    </div>

                    <h2 className="text-xl font-extrabold text-stone-900 dark:text-white">
                      {selectedEntry.title}
                    </h2>

                    <div className="mt-2 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-brand-50 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 border border-brand-200 dark:border-brand-900">
                        {moodEmojis[selectedEntry.mood]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleStar(selectedEntry.id, selectedEntry.starred)}
                      className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
                      title={selectedEntry.starred ? 'Starred' : 'Star this entry'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          selectedEntry.starred ? 'fill-amber-400 text-amber-500' : 'text-stone-400'
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => handleDelete(selectedEntry.id)}
                      className="p-2 text-stone-400 hover:text-rose-500 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Photo Attachment if present */}
                {selectedEntry.photoUrl && (
                  <div className="rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm max-h-80">
                    <img
                      src={selectedEntry.photoUrl}
                      alt="Classroom documentation"
                      className="w-full object-cover max-h-80"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="text-sm sm:text-base font-serif text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap">
                  {selectedEntry.content}
                </div>

                {/* Tags */}
                <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-1.5">
                  {selectedEntry.tags.map((t) => (
                    <span
                      key={t}
                      onClick={() => setSelectedTag(t)}
                      className="px-2.5 py-1 rounded-xl text-xs font-medium bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer transition-all"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
                Select or create a reflection entry.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
