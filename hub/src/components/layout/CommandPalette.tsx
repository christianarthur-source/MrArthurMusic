import React, { useState, useEffect, useRef } from 'react';
import { useApp, NavView } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { useClassroomTimer } from '../../context/TimerContext';
import {
  Search,
  BookOpen,
  CheckSquare,
  Music2,
  Users,
  Grid,
  Timer,
  Presentation,
  FolderSync,
  Boxes,
  BookMarked,
  X,
  ArrowRight,
  Plus
} from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveView,
    openTeachMode,
    showToast
  } = useApp();
  const { setPresetSeconds, startTimer, setIsFloatingVisible } = useClassroomTimer();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const tasks = storage.getTasks();
  const lessons = storage.getLessonPlans();
  const chorusSongs = storage.getChorusSongs();
  const resources = storage.getResources();

  interface PaletteItem {
    id: string;
    title: string;
    category: 'Navigation' | 'Action' | 'Lesson' | 'Task' | 'Chorus' | 'Resource';
    icon: React.ComponentType<{ className?: string }>;
    action: () => void;
    detail?: string;
  }

  const allItems: PaletteItem[] = [
    // Actions
    {
      id: 'act-teach-mode',
      title: 'Launch Full-Screen Teach Mode',
      category: 'Action',
      icon: Presentation,
      action: () => {
        openTeachMode();
        setIsCommandPaletteOpen(false);
      },
      detail: 'Projector display for classroom cart'
    },
    {
      id: 'act-timer-5m',
      title: 'Start 5-Minute Classroom Activity Timer',
      category: 'Action',
      icon: Timer,
      action: () => {
        setPresetSeconds(300);
        startTimer();
        setIsFloatingVisible(true);
        setIsCommandPaletteOpen(false);
        showToast('5-minute timer started', 'info');
      },
      detail: 'Countdown with gentle chime'
    },
    {
      id: 'act-new-task',
      title: query ? `Create task: "${query}"` : 'Create a new task...',
      category: 'Action',
      icon: Plus,
      action: () => {
        if (query) {
          const parsed = storage.parseQuickTaskInput(query, 'today');
          storage.addTask(parsed);
          showToast(`Created task: ${parsed.title}`, 'success');
        }
        setActiveView('tasks');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Add to task manager'
    },

    // Navigation
    {
      id: 'nav-home',
      title: 'Go to Home Dashboard',
      category: 'Navigation',
      icon: BookOpen,
      action: () => {
        setActiveView('home');
        setIsCommandPaletteOpen(false);
      }
    },
    {
      id: 'nav-tuner',
      title: 'Open Chromatic Instrument Tuner',
      category: 'Navigation',
      icon: Music2,
      action: () => {
        setActiveView('tools');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Mic pitch detection'
    },
    {
      id: 'nav-metronome',
      title: 'Open Precision Metronome',
      category: 'Navigation',
      icon: Music2,
      action: () => {
        setActiveView('tools');
        setIsCommandPaletteOpen(false);
      },
      detail: '30-300 BPM lookahead scheduler'
    },
    {
      id: 'nav-beat-machine',
      title: 'Open Song Maker & Sequencer',
      category: 'Navigation',
      icon: Music2,
      action: () => {
        setActiveView('tools');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Google Song Maker style melody & drum grid'
    },
    {
      id: 'nav-audio-studio',
      title: 'Open Audio Practice Lab & Playlist',
      category: 'Navigation',
      icon: Music2,
      action: () => {
        setActiveView('audio-studio');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Local audio files, speed & pitch stretch'
    },
    {
      id: 'nav-seating',
      title: 'Open Seating Chart Maker',
      category: 'Navigation',
      icon: Grid,
      action: () => {
        setActiveView('seating');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Semi-circles, rows, risers'
    },
    {
      id: 'nav-journal',
      title: 'Open Daily Teaching Journal',
      category: 'Navigation',
      icon: BookMarked,
      action: () => {
        setActiveView('journal');
        setIsCommandPaletteOpen(false);
      },
      detail: 'Calendar view, timeline & prompts'
    },

    // Dynamic Lessons
    ...lessons.map((l) => ({
      id: `lesson-${l.id}`,
      title: `Lesson: [Grade ${l.grade}] ${l.title}`,
      category: 'Lesson' as const,
      icon: BookOpen,
      action: () => {
        setActiveView('planner');
        openTeachMode(l);
        setIsCommandPaletteOpen(false);
      },
      detail: `${l.durationMinutes} min • ${l.musicalConcepts.slice(0, 2).join(', ')}`
    })),

    // Dynamic Resources
    ...resources.map((r) => ({
      id: `res-${r.id}`,
      title: `Resource: ${r.title}`,
      category: 'Resource' as const,
      icon: FolderSync,
      action: () => {
        window.open(r.url, '_blank');
        setIsCommandPaletteOpen(false);
      },
      detail: r.isGoogleDrive ? 'Google Drive resource' : 'External web resource'
    }))
  ];

  const filteredItems = allItems.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.detail && item.detail.toLowerCase().includes(q))
    );
  }).slice(0, 10);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4 animate-in fade-in duration-150">
      <div
        className="bg-white dark:bg-stone-900 rounded-2xl shadow-elevated border border-stone-200 dark:border-stone-800 w-full max-w-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-stone-200 dark:border-stone-800 gap-3">
          <Search className="w-5 h-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, lesson, chorus song, or search..."
            className="flex-1 bg-transparent text-stone-900 dark:text-white placeholder-stone-400 text-sm focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-stone-100 dark:bg-stone-800 text-stone-500 rounded border border-stone-200 dark:border-stone-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-stone-100 dark:divide-stone-800/40">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-sm">
              No matching commands or resources found for &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-100'
                      : 'hover:bg-stone-50 dark:hover:bg-stone-800/60 text-stone-800 dark:text-stone-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-brand-600 text-white'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[10px] font-normal uppercase px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500">
                          {item.category}
                        </span>
                      </div>
                      {item.detail && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isSelected ? 'text-brand-600 dark:text-brand-400 translate-x-0.5' : 'text-stone-300 dark:text-stone-600 opacity-0'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-900/90 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>↑↓ to navigate</span>
            <span>•</span>
            <span>↵ to select</span>
          </div>
          <span>Music Teacher Hub Palette</span>
        </div>
      </div>
    </div>
  );
};
