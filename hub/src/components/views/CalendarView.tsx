import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { CalendarEvent, CalendarSubscription } from '../../types';
import {
  Calendar as CalendarIcon,
  Plus,
  Download,
  Upload,
  Link as LinkIcon,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Trash2,
  CheckCircle2,
  LayoutGrid,
  List,
  Columns,
  Globe,
  FileText,
  Layers,
  CalendarX,
  UserMinus,
  RefreshCw,
  Check,
  AlertCircle
} from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { showToast } = useApp();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeCalendarFilter, setActiveCalendarFilter] = useState<string>('all');
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isManageSubscriptionsOpen, setIsManageSubscriptionsOpen] = useState(false);
  const [subscriptionToUnsubscribe, setSubscriptionToUnsubscribe] = useState<CalendarSubscription | null>(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);

  // Active Date for Month and Week Navigation
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 10, 3)); // Nov 3, 2026 default

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CalendarEvent['category']>('class');
  const [startDate, setStartDate] = useState('2026-11-03T10:15');
  const [endDate, setEndDate] = useState('2026-11-03T10:55');
  const [location, setLocation] = useState('');
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>('sub-primary');

  // Shared Link / ICS Import State
  const [importUrl, setImportUrl] = useState('');
  const [importIcsText, setImportIcsText] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubColor, setNewSubColor] = useState('#d97706');
  const [isImporting, setIsImporting] = useState(false);
  const icsFileInputRef = useRef<HTMLInputElement | null>(null);

  const reloadData = () => {
    setEvents(storage.getEvents());
    setSubscriptions(storage.getSubscriptions());
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const colors: Record<string, string> = {
      class: '#0c87eb',
      chorus: '#be123c',
      concert: '#d97706',
      assembly: '#059669',
      pd: '#7c3aed',
      meeting: '#475569',
      rehearsal: '#be123c'
    };

    const sub = subscriptions.find((s) => s.id === selectedSubscriptionId);
    const created = storage.addEvent({
      title: title.trim(),
      startDate,
      endDate,
      category,
      location,
      color: colors[category] || '#0c87eb',
      source: 'local',
      sourceId: selectedSubscriptionId,
      calendarName: sub?.name || 'Primary Schedule'
    });

    setIsAddEventOpen(false);
    setTitle('');
    showToast(`Added event: ${created.title}`, 'success');
  };

  const handleDeleteEvent = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    storage.deleteEvent(id);
    showToast('Event deleted', 'info');
  };

  const getSubscriptionEventCount = (subId: string) => {
    return events.filter((e) => (e.sourceId || 'sub-primary') === subId).length;
  };

  const handleConfirmUnsubscribe = () => {
    if (!subscriptionToUnsubscribe) return;
    const targetName = subscriptionToUnsubscribe.name;
    const { removedEventsCount } = storage.deleteSubscription(subscriptionToUnsubscribe.id, true);
    setSubscriptionToUnsubscribe(null);
    reloadData();
    showToast(`Unsubscribed from "${targetName}" and removed ${removedEventsCount} event(s)`, 'info');
  };

  const handleToggleSubscription = (subId: string) => {
    const newState = storage.toggleSubscription(subId);
    reloadData();
    const sub = subscriptions.find((s) => s.id === subId);
    showToast(`${sub?.name || 'Calendar'} is now ${newState ? 'visible' : 'hidden'}`, 'info');
  };

  const handleSyncSubscription = async (sub: CalendarSubscription) => {
    if (!sub.url) return;
    showToast(`Syncing ${sub.name}...`, 'info');
    let url = sub.url.trim();
    if (url.startsWith('webcal://')) {
      url = 'https://' + url.slice(9);
    }
    let icsData = '';
    try {
      const proxyUrl = `/api/hub/calendar?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) icsData = await res.text();
    } catch {}
    if (icsData && icsData.includes('BEGIN:VCALENDAR')) {
      const parsedList = parseIcsText(icsData);
      const allEvents = storage.getEvents();
      const otherEvents = allEvents.filter((e) => e.sourceId !== sub.id);
      const newEvents: CalendarEvent[] = [];
      parsedList.forEach((item, idx) => {
        if (item.title && item.startDate) {
          const cat = inferCategory(item.title, item.description || '');
          newEvents.push({
            id: `ev-${sub.id}-${idx}`,
            title: item.title,
            startDate: item.startDate,
            endDate: item.endDate || item.startDate,
            category: cat,
            location: item.location || 'School Auditorium',
            color: sub.color,
            source: 'subscription',
            sourceId: sub.id,
            calendarName: sub.name
          });
        }
      });
      storage.saveEvents([...otherEvents, ...newEvents]);
      storage.updateSubscription(sub.id, { lastSynced: new Date().toISOString() });
      reloadData();
      showToast(`Synced ${sub.name} (${newEvents.length} events updated)`, 'success');
    } else {
      showToast(`Unable to auto-sync feed from provider.`, 'warning');
    }
  };

  // Helper to infer category based on event text
  const inferCategory = (title: string, desc: string): CalendarEvent['category'] => {
    const combined = (title + ' ' + desc).toLowerCase();
    if (combined.includes('rehearsal') || combined.includes('chorus') || combined.includes('choir')) return 'rehearsal';
    if (combined.includes('concert') || combined.includes('performance') || combined.includes('festival') || combined.includes('informance') || combined.includes('holiday')) return 'concert';
    if (combined.includes('assembly')) return 'assembly';
    if (combined.includes('pd') || combined.includes('in-service') || combined.includes('conference') || combined.includes('workshop')) return 'pd';
    if (combined.includes('meeting') || combined.includes('duty') || combined.includes('committee')) return 'meeting';
    if (combined.includes('grade') || combined.includes('class') || combined.includes('music')) return 'class';
    return 'concert';
  };

  // Helper to format iCalendar timestamp (YYYYMMDDTHHMMSS or YYYYMMDD)
  const formatIcsDate = (val?: string): string => {
    if (!val) return new Date().toISOString().slice(0, 16);
    const cleaned = val.replace(/[^0-9T]/g, '');
    if (cleaned.length >= 13) {
      // 20261103T143000
      const y = cleaned.slice(0, 4);
      const m = cleaned.slice(4, 6);
      const d = cleaned.slice(6, 8);
      const h = cleaned.slice(9, 11);
      const min = cleaned.slice(11, 13);
      return `${y}-${m}-${d}T${h}:${min}`;
    } else if (cleaned.length >= 8) {
      // 20261103
      const y = cleaned.slice(0, 4);
      const m = cleaned.slice(4, 6);
      const d = cleaned.slice(6, 8);
      return `${y}-${m}-${d}T09:00`;
    }
    return new Date().toISOString().slice(0, 16);
  };

  // Parse ICS content into CalendarEvent list
  const parseIcsText = (icsText: string): Partial<CalendarEvent>[] => {
    const parsed: Partial<CalendarEvent>[] = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let inEvent = false;
    let current: any = {};

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      // handle line unfolding
      while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
        line += lines[i + 1].slice(1);
        i++;
      }

      if (line.startsWith('BEGIN:VEVENT')) {
        inEvent = true;
        current = {};
      } else if (line.startsWith('END:VEVENT')) {
        if (current.title && current.startDate) {
          if (!current.endDate) {
            current.endDate = current.startDate;
          }
          parsed.push(current);
        }
        inEvent = false;
      } else if (inEvent) {
        const colonIdx = line.indexOf(':');
        if (colonIdx === -1) continue;
        const tag = line.slice(0, colonIdx);
        const val = line.slice(colonIdx + 1).replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/g, ' ').trim();

        if (tag === 'SUMMARY' || tag.startsWith('SUMMARY;')) {
          current.title = val;
        } else if (tag === 'DTSTART' || tag.startsWith('DTSTART;')) {
          current.startDate = formatIcsDate(val);
        } else if (tag === 'DTEND' || tag.startsWith('DTEND;')) {
          current.endDate = formatIcsDate(val);
        } else if (tag === 'LOCATION' || tag.startsWith('LOCATION;')) {
          current.location = val;
        } else if (tag === 'UID' || tag.startsWith('UID;')) {
          current.uid = val;
        } else if (tag === 'DESCRIPTION' || tag.startsWith('DESCRIPTION;')) {
          current.description = val;
        }
      }
    }
    return parsed;
  };

  // Import from ICS file
  const handleIcsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const calTitle = newSubName.trim() || file.name.replace(/\.ics$/i, '');
        processIcsImport(text, calTitle, newSubColor || '#059669');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Process and save parsed events with deduplication and subscription tracking
  const processIcsImport = (
    icsData: string,
    customName?: string,
    customColor?: string,
    customUrl?: string
  ) => {
    try {
      const parsedList = parseIcsText(icsData);
      if (parsedList.length === 0) {
        showToast('No valid events found in calendar data', 'warning');
        return;
      }

      // Detect calendar title from X-WR-CALNAME if available
      let calName = customName?.trim() || newSubName.trim();
      if (!calName) {
        const calNameMatch = icsData.match(/X-WR-CALNAME:([^\r\n]+)/i);
        if (calNameMatch && calNameMatch[1]) {
          calName = calNameMatch[1].trim();
        } else if (customUrl?.includes('holiday')) {
          calName = 'Holidays in United States';
        } else if (customUrl) {
          calName = 'Subscribed Webcal Feed';
        } else {
          calName = 'Imported Calendar File';
        }
      }

      const assignedColor = customColor || newSubColor || '#d97706';

      // Create new Calendar Subscription
      const newSub = storage.addSubscription({
        name: calName,
        description: customUrl
          ? `Subscribed feed (${customUrl.slice(0, 40)}...)`
          : `Imported calendar on ${new Date().toLocaleDateString()}`,
        color: assignedColor,
        sourceType: customUrl?.startsWith('webcal') ? 'apple' : customUrl ? 'google' : 'ics_file',
        url: customUrl || '',
        enabled: true,
        lastSynced: new Date().toISOString()
      });

      const existingEvents = storage.getEvents();
      const toAdd: Omit<CalendarEvent, 'id'>[] = [];

      const categoryColors: Record<CalendarEvent['category'], string> = {
        class: '#0c87eb',
        chorus: '#be123c',
        rehearsal: '#be123c',
        concert: '#d97706',
        assembly: '#059669',
        pd: '#7c3aed',
        meeting: '#475569',
        duty: '#475569'
      };

      parsedList.forEach((item) => {
        // Deduplicate by title & startDate
        const exists = existingEvents.some(
          (ex) => ex.title.toLowerCase() === item.title?.toLowerCase() && ex.startDate === item.startDate
        );

        if (!exists && item.title && item.startDate) {
          const cat = inferCategory(item.title, item.description || '');
          toAdd.push({
            title: item.title,
            startDate: item.startDate,
            endDate: item.endDate || item.startDate,
            category: cat,
            location: item.location || 'School Auditorium',
            color: categoryColors[cat] || assignedColor,
            source: 'subscription',
            sourceId: newSub.id,
            calendarName: newSub.name
          });
        }
      });

      if (toAdd.length === 0) {
        showToast(`Subscribed to "${newSub.name}", but events were already imported`, 'info');
      } else {
        const count = storage.addEvents(toAdd);
        showToast(`Subscribed to "${newSub.name}" and imported ${count} event(s)!`, 'success');
      }

      reloadData();
      setIsImportModalOpen(false);
      setImportUrl('');
      setImportIcsText('');
      setNewSubName('');
    } catch (err) {
      console.error('ICS parse error:', err);
      showToast('Error parsing calendar file', 'error');
    }
  };

  // Handle Shared Calendar Link (Google / Apple Calendar webcal)
  const handleImportSharedLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim() && !importIcsText.trim()) {
      showToast('Please provide a calendar link or paste .ics text', 'warning');
      return;
    }

    if (importIcsText.trim()) {
      processIcsImport(importIcsText, newSubName || 'Custom iCal Feed', newSubColor || '#7c3aed');
      return;
    }

    let url = importUrl.trim();
    if (url.startsWith('webcal://')) {
      url = 'https://' + url.slice(9);
    }

    setIsImporting(true);
    let icsData = '';

    // Step 1: Fetch through the site's calendar helper (/api/hub/calendar?url=...)
    try {
      const proxyUrl = `/api/hub/calendar?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) {
        icsData = await res.text();
      }
    } catch (e) {
      console.warn('Local proxy attempt:', e);
    }

    // Step 2: Direct fetch attempt (if provider allows CORS)
    if (!icsData) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          icsData = await res.text();
        }
      } catch (e) {
        console.warn('Direct fetch attempt:', e);
      }
    }

    setIsImporting(false);

    if (icsData && icsData.includes('BEGIN:VCALENDAR')) {
      processIcsImport(icsData, newSubName || 'Subscribed Webcal Calendar', newSubColor || '#d97706', url);
    } else {
      showToast(
        'Direct download blocked by calendar provider. Please download the .ics file in your browser and upload it via Option 1.',
        'warning'
      );
    }
  };

  // Export iCalendar (.ics)
  const handleExportIcs = () => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Music Teacher Hub//Command Center Calendar//EN',
      'CALSCALE:GREGORIAN'
    ];

    events.forEach((ev) => {
      const dtStart = ev.startDate.replace(/[-:]/g, '').split('.')[0] + 'Z';
      const dtEnd = ev.endDate.replace(/[-:]/g, '').split('.')[0] + 'Z';
      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${ev.id}@musichub.local`);
      icsContent.push(`SUMMARY:${ev.title}`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      if (ev.location) icsContent.push(`LOCATION:${ev.location}`);
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'music-teacher-schedule.ics';
    a.click();
    showToast('Exported calendar as .ics for Apple / Google Calendar', 'success');
  };

  // Quick preset sample import for testing
  const loadSampleSchoolCalendar = () => {
    const sampleIcs = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sample District Calendar//EN
X-WR-CALNAME:District Fine Arts Festival & All-County
BEGIN:VEVENT
UID:district-101@school.edu
SUMMARY:District Fine Arts Festival & All-County Concert
DTSTART:20261120T190000
DTEND:20261120T210000
LOCATION:High School Performing Arts Center
DESCRIPTION:Combined district elementary and middle school choruses
END:VEVENT
BEGIN:VEVENT
UID:district-102@school.edu
SUMMARY:Kindergarten Thanksgiving Musical Informance
DTSTART:20261124T093000
DTEND:20261124T103000
LOCATION:Elementary Cafeteria Stage
DESCRIPTION:Kindergarten steady beat play-along for families
END:VEVENT
BEGIN:VEVENT
UID:district-103@school.edu
SUMMARY:Winter Holiday Concert (Grades 4-6)
DTSTART:20261215T183000
DTEND:20261215T200000
LOCATION:Main Auditorium
DESCRIPTION:Grade 4-5 general music ensembles & 6th grade chorus
END:VEVENT
END:VCALENDAR`;
    processIcsImport(sampleIcs, 'District Fine Arts Festival & All-County', '#d97706', 'webcal://district.k12.edu/fine-arts-schedule.ics');
  };

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const filteredEvents = events.filter((e) => {
    if (selectedCategory !== 'all' && e.category !== selectedCategory) {
      return false;
    }
    const subId = e.sourceId || 'sub-primary';
    if (activeCalendarFilter !== 'all' && subId !== activeCalendarFilter) {
      return false;
    }
    const sub = subscriptions.find((s) => s.id === subId);
    if (sub && !sub.enabled) {
      return false;
    }
    return true;
  });

  // Calculate Month Grid Days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Calculate Week Dates (Sun - Sat)
  const currentDayOfWeek = currentDate.getDay();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDayOfWeek);
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const monthTitle = currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' });
  const weekTitle = `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Hidden file input for .ics import */}
      <input
        ref={icsFileInputRef}
        type="file"
        accept=".ics,.ical,text/calendar"
        onChange={handleIcsFileUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <span>Class & Rehearsal Calendar</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Month grid, week schedule, and agenda view with Google & Apple Calendar import/export.
          </p>
        </div>

        {/* Action Buttons: Subscribed Calendars, Import, Export, Add Event */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsManageSubscriptionsOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Manage Subscribed Calendars & Feeds"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Calendars ({subscriptions.length})</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Import shared Apple or Google calendar"
          >
            <Upload className="w-4 h-4 text-sky-500" />
            <span>Import Calendar</span>
          </button>

          <button
            onClick={handleExportIcs}
            className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Export .ics file for Apple Calendar & Google Calendar"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Export .ics</span>
          </button>

          <button
            onClick={() => setIsAddEventOpen(true)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Month / Week / Agenda Switcher + Navigation + Filter Chips */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Arrows & Label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-2xl border border-stone-200/80 dark:border-stone-700/80">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-all"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 rounded-xl text-xs font-bold hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 transition-all"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-all"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
            {viewMode === 'month' ? monthTitle : viewMode === 'week' ? weekTitle : 'Agenda'}
          </h2>
        </div>

        {/* View Mode Switcher (Month, Week, Agenda) */}
        <div className="flex p-1 rounded-2xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200/80 dark:border-stone-700/80 self-start md:self-auto shadow-inner">
          <button
            onClick={() => setViewMode('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'month'
                ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Month</span>
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'week'
                ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Week</span>
          </button>
          <button
            onClick={() => setViewMode('agenda')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              viewMode === 'agenda'
                ? 'bg-white dark:bg-stone-900 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Agenda</span>
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'class', label: 'Music Classes' },
          { id: 'chorus', label: 'Chorus Rehearsals' },
          { id: 'concert', label: 'Concerts & Shows' },
          { id: 'assembly', label: 'Assemblies' },
          { id: 'pd', label: 'Professional Learning' }
        ].map((chip) => (
          <button
            key={chip.id}
            onClick={() => setSelectedCategory(chip.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === chip.id
                ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 shadow-sm'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Calendar Subscription Feeds & Visibility Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 shrink-0 flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-amber-500" />
          <span>Feeds:</span>
        </span>
        <button
          onClick={() => setActiveCalendarFilter('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all ${
            activeCalendarFilter === 'all'
              ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 shadow-xs'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
          }`}
        >
          All Feeds ({events.length})
        </button>
        {subscriptions.map((sub) => {
          const count = getSubscriptionEventCount(sub.id);
          const isSelected = activeCalendarFilter === sub.id;
          return (
            <div
              key={sub.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all border ${
                !sub.enabled
                  ? 'opacity-40 bg-stone-50 dark:bg-stone-900 border-stone-200 dark:border-stone-800 line-through'
                  : isSelected
                  ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white border-stone-400 dark:border-stone-600 shadow-xs'
                  : 'bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-100'
              }`}
            >
              <button
                onClick={() => handleToggleSubscription(sub.id)}
                className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center transition-transform hover:scale-125"
                style={{ backgroundColor: sub.color }}
                title={sub.enabled ? 'Click to hide this calendar' : 'Click to show this calendar'}
              />
              <button
                onClick={() => setActiveCalendarFilter(activeCalendarFilter === sub.id ? 'all' : sub.id)}
                className="font-medium hover:underline flex items-center gap-1"
              >
                <span>{sub.name}</span>
                <span className="text-[10px] opacity-60">({count})</span>
              </button>
              {!sub.isBuiltIn && (
                <button
                  onClick={() => setSubscriptionToUnsubscribe(sub)}
                  className="ml-1 p-0.5 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors"
                  title={`Unsubscribe from "${sub.name}"`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => setIsManageSubscriptionsOpen(true)}
          className="px-2 py-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-semibold shrink-0 flex items-center gap-1"
        >
          <span>Manage Feeds</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* 1. MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 sm:p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-3">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center text-xs font-black uppercase tracking-wider text-stone-400 pb-2 border-b border-stone-100 dark:border-stone-800">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Month Grid Cells (7 columns) */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank / Prev Month padding cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const dayNum = prevMonthDays - firstDayOfMonth + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-2xl bg-stone-50/50 dark:bg-stone-800/20 text-stone-300 dark:text-stone-600 text-xs font-mono select-none"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday =
                new Date().toISOString().split('T')[0] === dateStr;

              // Events occurring on this day
              const dayEvents = filteredEvents.filter((e) => e.startDate.startsWith(dateStr));

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayEvents({ date: dateStr, events: dayEvents });
                    } else {
                      setStartDate(`${dateStr}T10:00`);
                      setEndDate(`${dateStr}T10:45`);
                      setIsAddEventOpen(true);
                    }
                  }}
                  className={`min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isToday
                      ? 'bg-brand-50/50 dark:bg-brand-950/20 border-brand-300 dark:border-brand-800'
                      : 'bg-stone-50/80 dark:bg-stone-800/40 border-stone-200/60 dark:border-stone-800 hover:border-brand-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-stone-400 hidden sm:inline">
                        {dayEvents.length} event{dayEvents.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Event Chips */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold truncate text-white shadow-xs"
                        style={{ backgroundColor: ev.color || '#0c87eb' }}
                        title={`${ev.title} (${ev.startDate.split('T')[1]?.slice(0, 5)})`}
                      >
                        {ev.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[9px] font-bold text-stone-500 text-center">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 sm:p-6 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((dayDate, i) => {
              const dayStr = dayDate.toISOString().split('T')[0];
              const isToday = new Date().toISOString().split('T')[0] === dayStr;
              const dayEvents = filteredEvents.filter((e) => e.startDate.startsWith(dayStr));
              const dayName = dayDate.toLocaleDateString('default', { weekday: 'short' });
              const dateNumber = dayDate.getDate();

              return (
                <div
                  key={i}
                  className={`p-3 rounded-2xl border flex flex-col space-y-3 min-h-[280px] ${
                    isToday
                      ? 'bg-brand-50/40 dark:bg-brand-950/20 border-brand-300 dark:border-brand-800'
                      : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200/60 dark:border-stone-800'
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-stone-200/60 dark:border-stone-700/60">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                        {dayName}
                      </span>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        {dateNumber}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setStartDate(`${dayStr}T10:00`);
                        setEndDate(`${dayStr}T10:45`);
                        setIsAddEventOpen(true);
                      }}
                      className="p-1 rounded-lg text-stone-400 hover:text-brand-600 hover:bg-stone-200 dark:hover:bg-stone-700"
                      title="Add event on this day"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Events list */}
                  <div className="space-y-2 flex-1">
                    {dayEvents.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-[11px] text-stone-400 italic">
                        No events
                      </div>
                    ) : (
                      dayEvents.map((ev) => {
                        const time = ev.startDate.split('T')[1]?.slice(0, 5) || '10:00';
                        return (
                          <div
                            key={ev.id}
                            className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 shadow-xs space-y-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: ev.color || '#0c87eb' }}
                              />
                              <span className="text-[10px] font-mono font-bold text-stone-500">
                                {time}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-stone-900 dark:text-white leading-tight">
                              {ev.title}
                            </h4>
                            {ev.location && (
                              <p className="text-[10px] text-stone-400 truncate flex items-center gap-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                <span>{ev.location}</span>
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. AGENDA VIEW */}
      {viewMode === 'agenda' && (
        <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-4">
          <h3 className="text-sm font-bold text-stone-900 dark:text-white flex items-center justify-between">
            <span>Upcoming Classes & Schedule ({filteredEvents.length})</span>
          </h3>

          <div className="space-y-3">
            {filteredEvents.map((event) => {
              const dateStr = event.startDate.split('T')[0];
              const startTime = event.startDate.split('T')[1]?.slice(0, 5) || '09:00';
              const endTime = event.endDate.split('T')[1]?.slice(0, 5) || '09:40';

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-3">
                    <div
                      className="w-3 h-12 rounded-full shrink-0"
                      style={{ backgroundColor: event.color || '#0c87eb' }}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                          {event.category}
                        </span>
                        <span className="text-xs font-mono text-stone-400">{dateStr}</span>
                        {event.source === 'imported_ics' && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                            Imported
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate mt-0.5">
                        {event.title}
                      </h4>

                      <p className="text-xs text-stone-500 dark:text-stone-400 truncate flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{startTime} – {endTime}</span>
                        {event.location && (
                          <>
                            <span>•</span>
                            <MapPin className="w-3.5 h-3.5" />
                            <span>{event.location}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDeleteEvent(event.id, e)}
                    className="p-2 text-stone-400 hover:text-rose-500 rounded-xl transition-colors"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Day Events Popup Modal (from Month View click) */}
      {selectedDayEvents && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div>
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                  Events for Day
                </span>
                <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                  {selectedDayEvents.date}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="p-2 rounded-xl text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {selectedDayEvents.events.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/60 dark:border-stone-700 flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 dark:text-white">
                      {ev.title}
                    </h4>
                    <p className="text-[11px] text-stone-400">
                      {ev.startDate.split('T')[1]?.slice(0, 5)} - {ev.endDate.split('T')[1]?.slice(0, 5)} {ev.location && `• ${ev.location}`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      handleDeleteEvent(ev.id);
                      setSelectedDayEvents({
                        date: selectedDayEvents.date,
                        events: selectedDayEvents.events.filter((e) => e.id !== ev.id)
                      });
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  setStartDate(`${selectedDayEvents.date}T10:00`);
                  setEndDate(`${selectedDayEvents.date}T10:45`);
                  setSelectedDayEvents(null);
                  setIsAddEventOpen(true);
                }}
                className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold shadow-sm"
              >
                + Add Another Event
              </button>
              <button
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Calendar Link / ICS Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    Import External Calendar
                  </h3>
                  <p className="text-xs text-stone-400">
                    Import shared calendar links from Google, Apple, or Outlook.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                ✕
              </button>
            </div>

            {/* Calendar Subscription Name & Customization */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Subscription Name (Optional)
                </label>
                <input
                  type="text"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. District Fine Arts, Grade 5 Band..."
                  className="w-full text-xs px-3 py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-stone-500 uppercase block mb-1">
                  Badge Color
                </label>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {['#0c87eb', '#be123c', '#d97706', '#059669', '#7c3aed'].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setNewSubColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        newSubColor === c ? 'scale-115 border-stone-900 dark:border-white shadow-xs' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Option 1: Upload .ics file directly */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80 space-y-2">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                Option 1: Upload Calendar File (.ics / .ical)
              </span>
              <p className="text-[11px] text-stone-500">
                Export from Google Calendar or Apple Calendar, then drop or select the file here.
              </p>
              <button
                onClick={() => icsFileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-white dark:bg-stone-800 text-brand-600 dark:text-brand-400 text-xs font-bold border border-brand-200 dark:border-brand-800 shadow-xs hover:bg-brand-50"
              >
                Choose .ics File
              </button>
            </div>

            {/* Option 2: Shared Webcal URL */}
            <form onSubmit={handleImportSharedLink} className="space-y-3">
              <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
                Option 2: Shared Calendar Link (Google / Apple webcal)
              </span>
              <input
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="webcal://pXX-caldav.icloud.com/... or https://calendar.google.com/..."
                className="w-full text-xs px-3 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />

              <div>
                <label className="text-[11px] font-bold text-stone-400 block mb-1">
                  Or paste raw iCalendar (.ics) text:
                </label>
                <textarea
                  value={importIcsText}
                  onChange={(e) => setImportIcsText(e.target.value)}
                  placeholder="BEGIN:VCALENDAR&#10;BEGIN:VEVENT&#10;SUMMARY:Fine Arts Night&#10;..."
                  rows={3}
                  className="w-full text-xs font-mono p-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Google & Apple Calendar Direct Feed Sync</span>
                </span>
                <p className="text-[11px] leading-relaxed">
                  Paste any public or secret <strong>webcal://</strong> or <strong>https://</strong> iCal link from Google Calendar or Apple iCloud. The app proxies the feed and parses all events without CORS errors.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setImportUrl('https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                  >
                    Insert Google Calendar Feed URL
                  </button>
                  <button
                    type="button"
                    onClick={loadSampleSchoolCalendar}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-stone-800 border border-amber-300 dark:border-amber-700 text-[11px] font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100"
                  >
                    Insert District Fine Arts Schedule
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isImporting}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  {isImporting ? 'Syncing...' : 'Fetch & Import Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEvent}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <h3 className="text-lg font-bold text-stone-900 dark:text-white">
              Add Calendar Event
            </h3>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Event Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5th Grade Chorus Rehearsal"
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-medium"
              >
                <option value="class">Music Class</option>
                <option value="chorus">Chorus Rehearsal</option>
                <option value="concert">Concert / Performance</option>
                <option value="assembly">School Assembly</option>
                <option value="pd">Professional Development</option>
                <option value="meeting">Meeting / Duty</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Room 104, Auditorium, Gym..."
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Calendar Feed
              </label>
              <select
                value={selectedSubscriptionId}
                onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl font-medium"
              >
                {subscriptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isBuiltIn ? '(Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddEventOpen(false)}
                className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-sm"
              >
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manage Calendars & Subscriptions Modal */}
      {isManageSubscriptionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-5 animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                    Calendar Subscriptions & Feeds
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Manage connected calendars, toggle layers, sync feeds, or unsubscribe.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsManageSubscriptionsOpen(false)}
                className="p-1 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                ✕
              </button>
            </div>

            {/* List of active subscriptions */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block">
                Active Calendars ({subscriptions.length})
              </span>

              {subscriptions.map((sub) => {
                const count = getSubscriptionEventCount(sub.id);
                return (
                  <div
                    key={sub.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Toggle Visibility Checkbox */}
                      <button
                        onClick={() => handleToggleSubscription(sub.id)}
                        className="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all shadow-xs"
                        style={{
                          backgroundColor: sub.enabled ? sub.color : 'transparent',
                          borderColor: sub.color
                        }}
                        title={sub.enabled ? 'Click to hide this calendar layer' : 'Click to show this calendar layer'}
                      >
                        {sub.enabled && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                      </button>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4
                            className={`text-sm font-bold truncate ${
                              sub.enabled ? 'text-stone-900 dark:text-white' : 'text-stone-400 line-through'
                            }`}
                          >
                            {sub.name}
                          </h4>
                          {sub.isBuiltIn ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border border-sky-300/40">
                              Primary Schedule
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                              Subscribed Feed
                            </span>
                          )}
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                            {count} {count === 1 ? 'event' : 'events'}
                          </span>
                        </div>

                        {sub.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                            {sub.description}
                          </p>
                        )}

                        {sub.lastSynced && (
                          <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1">
                            Last synced: {new Date(sub.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(sub.lastSynced).toLocaleDateString()})
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions: Sync and Unsubscribe */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {sub.url && (
                        <button
                          onClick={() => handleSyncSubscription(sub)}
                          className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-brand-600 hover:bg-stone-100 dark:hover:bg-stone-600 border border-stone-200 dark:border-stone-600 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs"
                          title="Refresh / Re-sync feed from URL"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Sync</span>
                        </button>
                      )}

                      {!sub.isBuiltIn ? (
                        <button
                          onClick={() => setSubscriptionToUnsubscribe(sub)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                          title={`Unsubscribe from "${sub.name}" and remove all associated events`}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Unsubscribe</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-400 font-medium px-2 py-1">
                          Protected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick action to subscribe to a new calendar */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsManageSubscriptionsOpen(false);
                  setIsImportModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-brand-50 dark:bg-brand-950/60 hover:bg-brand-100 dark:hover:bg-brand-900/60 text-brand-700 dark:text-brand-300 text-xs font-bold border border-brand-200 dark:border-brand-800 flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Subscribe to Another Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setIsManageSubscriptionsOpen(false)}
                className="px-5 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unsubscribe Confirmation Modal */}
      {subscriptionToUnsubscribe && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900/60 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <CalendarX className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-900 dark:text-white leading-tight">
                  Unsubscribe from Calendar?
                </h3>
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                  {subscriptionToUnsubscribe.name}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 space-y-2">
              <p>
                Are you sure you want to unsubscribe from <strong>"{subscriptionToUnsubscribe.name}"</strong>?
              </p>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 font-semibold text-[11px]">
                <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                <span>
                  This will remove the calendar subscription and permanently delete all{' '}
                  <strong>{getSubscriptionEventCount(subscriptionToUnsubscribe.id)} scheduled events</strong> from your calendar.
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                You can re-subscribe anytime using a webcal link or .ics file.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSubscriptionToUnsubscribe(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmUnsubscribe}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <UserMinus className="w-4 h-4" />
                <span>Unsubscribe & Remove Events</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
