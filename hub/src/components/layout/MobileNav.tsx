import React, { useState } from 'react';
import { useApp, NavView } from '../../context/AppContext';
import {
  LayoutDashboard,
  BookOpen,
  CheckSquare,
  Music2,
  Users,
  MoreHorizontal,
  X,
  Grid,
  Sparkles,
  Timer,
  FolderSync,
  BookMarked,
  Boxes,
  Video,
  Settings,
  Calendar
} from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { activeView, setActiveView } = useApp();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const mainTabs = [
    { id: 'home' as NavView, label: 'Home', icon: LayoutDashboard },
    { id: 'planner' as NavView, label: 'Planner', icon: BookOpen },
    { id: 'tasks' as NavView, label: 'Tasks', icon: CheckSquare },
    { id: 'tools' as NavView, label: 'Song Maker', icon: Music2 },
    { id: 'audio-studio' as NavView, label: 'Studio', icon: Sparkles },
  ];

  const secondaryTabs = [
    { id: 'calendar' as NavView, label: 'Calendar', icon: Calendar },
    { id: 'visuals' as NavView, label: 'Literacy Visuals', icon: Sparkles },
    { id: 'timer' as NavView, label: 'Classroom Timer', icon: Timer },
    { id: 'seating' as NavView, label: 'Seating Charts', icon: Grid },
    { id: 'resources' as NavView, label: 'Drive Resources', icon: FolderSync },
    { id: 'journal' as NavView, label: 'Daily Journal', icon: BookMarked },
    { id: 'youtube' as NavView, label: 'YouTube Browser', icon: Video },
    { id: 'settings' as NavView, label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {/* More Menu Drawer */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden flex flex-col justify-end">
          <div className="bg-white dark:bg-stone-900 rounded-t-3xl p-5 border-t border-stone-200 dark:border-stone-800 shadow-2xl max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <h3 className="font-bold text-sm text-stone-900 dark:text-white">All Workspaces</h3>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 py-4">
              {secondaryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveView(tab.id);
                      setIsMoreOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl text-center transition-all ${
                      isActive
                        ? 'bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 font-medium border border-brand-200 dark:border-brand-800'
                        : 'bg-stone-50 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1.5" />
                    <span className="text-[11px] leading-tight line-clamp-1">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 lg:hidden bg-white/95 dark:bg-stone-900/95 backdrop-blur-lg border-t border-stone-200/80 dark:border-stone-800 px-2 py-1 flex items-center justify-around safe-bottom">
        {mainTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all ${
                isActive
                  ? 'text-brand-600 dark:text-brand-400 font-semibold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-all ${
            secondaryTabs.some((t) => t.id === activeView) ? 'text-brand-600 dark:text-brand-400 font-semibold' : ''
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">More</span>
        </button>
      </nav>
    </>
  );
};
