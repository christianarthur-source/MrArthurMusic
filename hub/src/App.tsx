import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { TimerProvider } from './context/TimerContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { FloatingTimer } from './components/layout/FloatingTimer';
import { CommandPalette } from './components/layout/CommandPalette';
import { ToastContainer } from './components/layout/ToastContainer';
import { TeachModeModal } from './components/views/TeachModeModal';

// Views
import { HomeDashboardView } from './components/views/HomeDashboardView';
import { LessonPlannerView } from './components/views/LessonPlannerView';
import { TasksView } from './components/views/TasksView';
import { CalendarView } from './components/views/CalendarView';
import { MusicToolsView } from './components/views/MusicToolsView';
import { AudioStudioView } from './components/views/AudioStudioView';
import { SeatingChartView } from './components/views/SeatingChartView';
import { ClassroomVisualsView } from './components/views/ClassroomVisualsView';
import { ClassroomTimerView } from './components/views/ClassroomTimerView';
import { ResourceLibraryView } from './components/views/ResourceLibraryView';
import { JournalView } from './components/views/JournalView';
import { YouTubeBrowserView } from './components/views/YouTubeBrowserView';
import { SettingsView } from './components/views/SettingsView';

const MainContent: React.FC = () => {
  const { activeView } = useApp();

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return <HomeDashboardView />;
      case 'planner':
        return <LessonPlannerView />;
      case 'tasks':
        return <TasksView />;
      case 'calendar':
        return <CalendarView />;
      case 'tools':
        return <MusicToolsView />;
      case 'audio-studio':
        return <AudioStudioView />;
      case 'seating':
        return <SeatingChartView />;
      case 'visuals':
        return <ClassroomVisualsView />;
      case 'timer':
        return <ClassroomTimerView />;
      case 'resources':
        return <ResourceLibraryView />;
      case 'journal':
        return <JournalView />;
      case 'youtube':
        return <YouTubeBrowserView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <HomeDashboardView />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-stone-50 dark:bg-stone-950 font-sans">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
          {renderView()}
        </main>
      </div>

      {/* Persistent & Overlay Elements */}
      <MobileNav />
      <FloatingTimer />
      <TeachModeModal />
      <CommandPalette />
      <ToastContainer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <TimerProvider>
        <MainContent />
      </TimerProvider>
    </AppProvider>
  );
};

export default App;
