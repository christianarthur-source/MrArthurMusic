import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserPreferences, LessonPlan } from '../types';
import { storage } from '../services/storage';

export type NavView =
  | 'home'
  | 'planner'
  | 'tasks'
  | 'calendar'
  | 'tools'
  | 'audio-studio'
  | 'seating'
  | 'visuals'
  | 'timer'
  | 'resources'
  | 'journal'
  | 'youtube'
  | 'settings';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface AppContextType {
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  isTeachModeOpen: boolean;
  teachModeLesson: LessonPlan | null;
  openTeachMode: (lesson?: LessonPlan) => void;
  closeTeachMode: () => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getInitialView = (): NavView => {
    try {
      const hash = window.location.hash.replace('#', '') as NavView;
      const validViews: NavView[] = [
        'home', 'planner', 'tasks', 'calendar', 'tools', 'audio-studio',
        'seating', 'visuals', 'timer', 'resources', 'journal', 'youtube', 'settings'
      ];
      if (hash.startsWith('visuals')) return 'visuals';
      if (hash.startsWith('tasks')) return 'tasks';
      if (hash.startsWith('planner')) return 'planner';
      if (validViews.includes(hash)) return hash;
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') as NavView;
      if (validViews.includes(viewParam)) return viewParam;
    } catch {}
    return 'home';
  };

  const [preferences, setPreferencesState] = useState<UserPreferences>(storage.getPreferences());
  const [activeView, setActiveViewState] = useState<NavView>(getInitialView);

  const setActiveView = (view: NavView) => {
    setActiveViewState(view);
    try {
      window.location.hash = '#' + view;
    } catch {}
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as NavView;
      const validViews: NavView[] = [
        'home', 'planner', 'tasks', 'calendar', 'tools', 'audio-studio',
        'seating', 'visuals', 'timer', 'resources', 'journal', 'youtube', 'settings'
      ];
      if (hash.startsWith('visuals')) {
        setActiveViewState('visuals');
      } else if (hash.startsWith('tasks')) {
        setActiveViewState('tasks');
      } else if (hash.startsWith('planner')) {
        setActiveViewState('planner');
      } else if (validViews.includes(hash)) {
        setActiveViewState(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [isTeachModeOpen, setIsTeachModeOpen] = useState<boolean>(false);
  const [teachModeLesson, setTeachModeLesson] = useState<LessonPlan | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sync preferences with storage
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      setPreferencesState(storage.getPreferences());
    });
    return unsub;
  }, []);

  // Sync Dark Mode class with <html>
  useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [preferences.darkMode]);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K for command palette, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    const updated = storage.updatePreferences(updates);
    setPreferencesState(updated);
  };

  const openTeachMode = (lesson?: LessonPlan) => {
    if (lesson) {
      setTeachModeLesson(lesson);
    } else {
      const allLessons = storage.getLessonPlans();
      setTeachModeLesson(allLessons[0] || null);
    }
    setIsTeachModeOpen(true);
  };

  const closeTeachMode = () => {
    setIsTeachModeOpen(false);
  };

  const showToast = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = 'toast-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 3800);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        preferences,
        updatePreferences,
        isTeachModeOpen,
        teachModeLesson,
        openTeachMode,
        closeTeachMode,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        toasts,
        showToast,
        removeToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
