import React, { useState, useEffect } from 'react';
import { useApp, NavView } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { Logo } from './Logo';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  BookOpen,
  Music2,
  Sliders,
  Users,
  Grid,
  Sparkles,
  Timer,
  FolderSync,
  BookMarked,
  Boxes,
  Video,
  ChevronLeft,
  ChevronRight,
  Music
} from 'lucide-react';

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export const Sidebar: React.FC = () => {
  const {
    activeView,
    setActiveView,
    preferences,
    isSidebarCollapsed,
    setIsSidebarCollapsed
  } = useApp();

  const [todayTaskCount, setTodayTaskCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const tasks = storage.getTasks();
      const count = tasks.filter((t) => !t.completed && (t.listType === 'today' || t.listType === 'inbox')).length;
      setTodayTaskCount(count);
    };
    updateCount();
    const unsub = storage.subscribe(updateCount);
    return unsub;
  }, []);

  const navGroups: { group: string; items: NavItem[] }[] = [
    {
      group: 'Workspace',
      items: [
        { id: 'home', label: 'Home Dashboard', icon: LayoutDashboard },
        { id: 'tasks', label: 'Tasks', icon: CheckSquare, badgeCount: todayTaskCount },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'planner', label: 'Lesson Planner', icon: BookOpen }
      ]
    },
    {
      group: 'Music Studio',
      items: [
        { id: 'tools', label: 'Song Maker & Tools', icon: Music2 },
        { id: 'audio-studio', label: 'Audio Practice Lab', icon: Sliders },
      ]
    },
    {
      group: 'Classroom',
      items: [
        { id: 'visuals', label: 'Music Literacy Visuals', icon: Sparkles },
        { id: 'timer', label: 'Classroom Timer', icon: Timer },
        { id: 'seating', label: 'Seating Charts', icon: Grid },
      ]
    },
    {
      group: 'Resources',
      items: [
        { id: 'resources', label: 'Drive & Resource Library', icon: FolderSync },
        { id: 'journal', label: 'Daily Journal', icon: BookMarked },
        { id: 'youtube', label: 'YouTube Browser', icon: Video }
      ]
    }
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col h-screen sticky top-0 bg-stone-100/70 dark:bg-stone-900/80 border-r border-stone-200/80 dark:border-stone-800 transition-all duration-300 z-20 ${
        isSidebarCollapsed ? 'w-20' : 'w-[270px]'
      }`}
    >
      {/* Brand Header with Custom Logo */}
      <div className={`flex items-center border-b border-stone-200/60 dark:border-stone-800 ${
        isSidebarCollapsed ? 'p-3 justify-center' : 'p-4 justify-between'
      }`}>
        <Logo
          collapsed={isSidebarCollapsed}
          appName={preferences.appName}
          teacherName={preferences.teacherName || 'Music Teacher'}
        />
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.group}>
            {!isSidebarCollapsed && (
              <h3 className="px-3 mb-1.5 text-[11px] font-semibold tracking-wider uppercase text-stone-400 dark:text-stone-500">
                {group.group}
              </h3>
            )}
            <nav className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-white dark:bg-stone-800 text-brand-600 dark:text-brand-400 shadow-card font-semibold'
                        : 'text-stone-600 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-white'
                    } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-stone-400'}`} />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    {!isSidebarCollapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300">
                        {item.badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Collapse Button */}
      <div className="p-3 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between">
        {!isSidebarCollapsed && (
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Music Teacher Hub v1.0
          </span>
        )}
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800 transition-colors ml-auto"
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};
