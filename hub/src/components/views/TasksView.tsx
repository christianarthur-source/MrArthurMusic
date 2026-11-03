import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { storage } from '../../services/storage';
import { TaskItem, TaskListType, Area, Project, Subtask } from '../../types';
import {
  Inbox,
  Star,
  Calendar,
  Layers,
  Archive,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Tag,
  CheckSquare,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FolderPlus,
  ListTodo,
  Check,
  Folder,
  Pencil,
  AlertCircle,
  X,
  Palette,
  Sliders,
  Music,
  BookOpen,
  FileText,
  Award
} from 'lucide-react';
import confetti from 'canvas-confetti';

const COLOR_PALETTE = [
  '#0c87eb', // Brand Blue
  '#d97706', // Amber / Gold
  '#059669', // Emerald / Green
  '#4f46e5', // Indigo
  '#7c3aed', // Purple / Violet
  '#e11d48', // Rose / Red
  '#ea580c', // Orange
  '#0891b2', // Teal / Cyan
  '#475569'  // Slate / Charcoal
];

export const TasksView: React.FC = () => {
  const { showToast } = useApp();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeList, setActiveList] = useState<TaskListType>('today');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(() => {
    try {
      const hash = window.location.hash;
      const m = hash.match(/area-([a-zA-Z0-9_-]+)/);
      return m ? m[0] : null;
    } catch {}
    return null;
  });
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    try {
      const hash = window.location.hash;
      const m = hash.match(/proj-([a-zA-Z0-9_-]+)/);
      return m ? m[0] : null;
    } catch {}
    return null;
  });

  // New task input state
  const [quickInput, setQuickInput] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Project Modal State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(() => {
    try {
      return window.location.hash.includes('modal-project');
    } catch {}
    return false;
  });
  const [editingProject, setEditingProject] = useState<Project | null>(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0] || null;
      }
    } catch {}
    return null;
  });
  const [projectTitle, setProjectTitle] = useState(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0]?.title || '';
      }
    } catch {}
    return '';
  });
  const [projectAreaId, setProjectAreaId] = useState(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0]?.areaId || '';
      }
    } catch {}
    return '';
  });
  const [projectColor, setProjectColor] = useState(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0]?.color || '#d97706';
      }
    } catch {}
    return '#4f46e5';
  });
  const [projectDeadline, setProjectDeadline] = useState(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0]?.deadline || '';
      }
    } catch {}
    return '';
  });
  const [projectNotes, setProjectNotes] = useState(() => {
    try {
      if (window.location.hash.includes('modal-project')) {
        return storage.getProjects()[0]?.notes || '';
      }
    } catch {}
    return '';
  });
  const [projectCompleted, setProjectCompleted] = useState(false);

  // Area Modal State
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(() => {
    try {
      return window.location.hash.includes('modal-area');
    } catch {}
    return false;
  });
  const [editingArea, setEditingArea] = useState<Area | null>(() => {
    try {
      if (window.location.hash.includes('modal-area')) {
        return storage.getAreas()[0] || null;
      }
    } catch {}
    return null;
  });
  const [areaName, setAreaName] = useState(() => {
    try {
      if (window.location.hash.includes('modal-area')) {
        return storage.getAreas()[0]?.name || '';
      }
    } catch {}
    return '';
  });
  const [areaColor, setAreaColor] = useState(() => {
    try {
      if (window.location.hash.includes('modal-area')) {
        return storage.getAreas()[0]?.color || '#0c87eb';
      }
    } catch {}
    return '#0c87eb';
  });
  const [areaIcon, setAreaIcon] = useState('Folder');

  // Confirmation Delete Dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'project' | 'area';
    id: string;
    name: string;
  } | null>(null);

  const reloadData = () => {
    setTasks(storage.getTasks());
    setAreas(storage.getAreas());
    setProjects(storage.getProjects());
  };

  useEffect(() => {
    reloadData();
    const unsub = storage.subscribe(reloadData);
    return unsub;
  }, []);

  // Quick Task Creation
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const parsed = storage.parseQuickTaskInput(quickInput, activeList);
    if (selectedAreaId) parsed.areaId = selectedAreaId;
    if (selectedProjectId) parsed.projectId = selectedProjectId;

    const newTask = storage.addTask(parsed);
    setQuickInput('');
    showToast(`Added: ${newTask.title}`, 'success');
  };

  const handleToggleComplete = (task: TaskItem) => {
    const isNowCompleted = !task.completed;
    storage.updateTask(task.id, { completed: isNowCompleted });
    if (isNowCompleted) {
      showToast('Completed!', 'success');
      try {
        confetti({
          particleCount: 45,
          spread: 60,
          origin: { y: 0.7 }
        });
      } catch {}
    }
  };

  const handleDeleteTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storage.deleteTask(id);
    showToast('Task deleted', 'info');
  };

  const handleAddSubtask = (taskId: string) => {
    if (!newSubtaskTitle.trim()) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newSub: Subtask = {
      id: 'sub-' + Date.now().toString(36),
      title: newSubtaskTitle.trim(),
      completed: false
    };
    storage.updateTask(taskId, {
      subtasks: [...(task.subtasks || []), newSub]
    });
    setNewSubtaskTitle('');
  };

  const handleToggleSubtask = (taskId: string, subId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !task.subtasks) return;
    const updated = task.subtasks.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s));
    storage.updateTask(taskId, { subtasks: updated });
  };

  // --- Project CRUD Handlers ---
  const openCreateProject = (defaultAreaId?: string) => {
    setEditingProject(null);
    setProjectTitle('');
    setProjectAreaId(defaultAreaId || (areas.length > 0 ? areas[0].id : ''));
    setProjectColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setProjectDeadline('');
    setProjectNotes('');
    setProjectCompleted(false);
    setIsProjectModalOpen(true);
  };

  const openEditProject = (proj: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProject(proj);
    setProjectTitle(proj.title);
    setProjectAreaId(proj.areaId || '');
    setProjectColor(proj.color || '#4f46e5');
    setProjectDeadline(proj.deadline || '');
    setProjectNotes(proj.notes || '');
    setProjectCompleted(proj.completed || false);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectTitle.trim()) return;

    if (editingProject) {
      storage.updateProject(editingProject.id, {
        title: projectTitle.trim(),
        areaId: projectAreaId,
        color: projectColor,
        deadline: projectDeadline || undefined,
        notes: projectNotes.trim() || undefined,
        completed: projectCompleted
      });
      showToast(`Updated project "${projectTitle.trim()}"`, 'success');
    } else {
      const created = storage.addProject({
        title: projectTitle.trim(),
        areaId: projectAreaId,
        color: projectColor,
        deadline: projectDeadline || undefined,
        notes: projectNotes.trim() || undefined,
        completed: false
      });
      setSelectedProjectId(created.id);
      setSelectedAreaId(null);
      showToast(`Created project "${created.title}"`, 'success');
    }

    setIsProjectModalOpen(false);
    reloadData();
  };

  const executeDeleteProject = (id: string) => {
    storage.deleteProject(id);
    if (selectedProjectId === id) {
      setSelectedProjectId(null);
      setActiveList('today');
    }
    setDeleteConfirm(null);
    setIsProjectModalOpen(false);
    showToast('Project deleted', 'info');
    reloadData();
  };

  // --- Area CRUD Handlers ---
  const openCreateArea = () => {
    setEditingArea(null);
    setAreaName('');
    setAreaColor(COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)]);
    setAreaIcon('Folder');
    setIsAreaModalOpen(true);
  };

  const openEditArea = (area: Area, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingArea(area);
    setAreaName(area.name);
    setAreaColor(area.color || '#0c87eb');
    setAreaIcon(area.icon || 'Folder');
    setIsAreaModalOpen(true);
  };

  const handleSaveArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) return;

    if (editingArea) {
      storage.updateArea(editingArea.id, {
        name: areaName.trim(),
        color: areaColor,
        icon: areaIcon
      });
      showToast(`Updated area "${areaName.trim()}"`, 'success');
    } else {
      const created = storage.addArea({
        name: areaName.trim(),
        color: areaColor,
        icon: areaIcon
      });
      setSelectedAreaId(created.id);
      setSelectedProjectId(null);
      showToast(`Created area "${created.name}"`, 'success');
    }

    setIsAreaModalOpen(false);
    reloadData();
  };

  const executeDeleteArea = (id: string) => {
    storage.deleteArea(id);
    if (selectedAreaId === id) {
      setSelectedAreaId(null);
      setActiveList('today');
    }
    setDeleteConfirm(null);
    setIsAreaModalOpen(false);
    showToast('Area deleted', 'info');
    reloadData();
  };

  // Filter tasks based on view selection
  const filteredTasks = tasks.filter((t) => {
    if (selectedAreaId && t.areaId !== selectedAreaId) return false;
    if (selectedProjectId && t.projectId !== selectedProjectId) return false;

    if (activeList === 'logbook') {
      return t.completed;
    }

    if (t.completed) return false;

    if (activeList === 'today') {
      return t.listType === 'today';
    } else if (activeList === 'inbox') {
      return t.listType === 'inbox';
    } else if (activeList === 'upcoming') {
      return t.listType === 'upcoming';
    } else if (activeList === 'anytime') {
      return t.listType === 'anytime' || t.listType === 'today' || t.listType === 'inbox';
    } else if (activeList === 'someday') {
      return t.listType === 'someday';
    }
    return true;
  });

  const listNavItems: { type: TaskListType; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { type: 'inbox', label: 'Inbox', icon: Inbox, count: tasks.filter((t) => !t.completed && t.listType === 'inbox').length },
    { type: 'today', label: 'Today', icon: Star, count: tasks.filter((t) => !t.completed && t.listType === 'today').length },
    { type: 'upcoming', label: 'Upcoming', icon: Calendar, count: tasks.filter((t) => !t.completed && t.listType === 'upcoming').length },
    { type: 'anytime', label: 'Anytime', icon: Layers, count: tasks.filter((t) => !t.completed && t.listType !== 'someday' && t.listType !== 'logbook').length },
    { type: 'someday', label: 'Someday', icon: Archive, count: tasks.filter((t) => !t.completed && t.listType === 'someday').length },
    { type: 'logbook', label: 'Logbook', icon: CheckCircle2, count: tasks.filter((t) => t.completed).length }
  ];

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedArea = areas.find((a) => a.id === selectedAreaId);

  // Statistics for selected project or area
  const projAllTasks = selectedProject ? tasks.filter((t) => t.projectId === selectedProject.id) : [];
  const projCompletedTasks = projAllTasks.filter((t) => t.completed).length;
  const projTotalTasks = projAllTasks.length;

  const areaProjects = selectedArea ? projects.filter((p) => p.areaId === selectedArea.id) : [];
  const areaTasks = selectedArea ? tasks.filter((t) => t.areaId === selectedArea.id && !t.completed) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-white flex items-center gap-2.5">
            <span className="p-2 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-md">
              <CheckSquare className="w-5 h-5" />
            </span>
            <span>Things Task Manager</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Productivity workspace with custom Projects, Areas of Responsibility, and natural language capture.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openCreateProject(selectedAreaId || undefined)}
            className="px-3.5 py-2 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <FolderPlus className="w-4 h-4 text-amber-500" />
            <span>New Project</span>
          </button>

          <button
            onClick={openCreateArea}
            className="px-3.5 py-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Area</span>
          </button>
        </div>
      </div>

      {/* 2-Column Things Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Lists, Projects & Areas */}
        <div className="lg:col-span-4 space-y-5">
          {/* Main Things Core Lists */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-3 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-0.5">
            {listNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeList === item.type && !selectedAreaId && !selectedProjectId;
              return (
                <button
                  key={item.type}
                  onClick={() => {
                    setActiveList(item.type);
                    setSelectedAreaId(null);
                    setSelectedProjectId(null);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${item.type === 'today' ? 'text-amber-500' : 'text-stone-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Projects Section */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between pb-1 px-1">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Active Projects ({projects.length})
              </h3>
              <button
                onClick={() => openCreateProject(selectedAreaId || undefined)}
                className="p-1 rounded-xl text-stone-400 hover:text-brand-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="Create New Project"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {projects.length === 0 ? (
                <p className="text-xs text-stone-400 italic px-2 py-1">No active projects yet.</p>
              ) : (
                projects.map((proj) => {
                  const isSelected = selectedProjectId === proj.id;
                  const projTasks = tasks.filter((t) => t.projectId === proj.id && !t.completed);

                  return (
                    <div
                      key={proj.id}
                      className={`group/proj w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200 shadow-xs border border-amber-200 dark:border-amber-800'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedProjectId(proj.id);
                          setSelectedAreaId(null);
                        }}
                        className="flex items-center gap-2 truncate flex-1 text-left"
                      >
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: proj.color }}
                        />
                        <span className="truncate">{proj.title}</span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {projTasks.length > 0 && (
                          <span className="text-[10px] font-mono text-stone-400">
                            {projTasks.length}
                          </span>
                        )}
                        <button
                          onClick={(e) => openEditProject(proj, e)}
                          className="opacity-0 group-hover/proj:opacity-100 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                          title="Edit Project"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Areas of Responsibility Section */}
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-4 shadow-card border border-stone-200/80 dark:border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between pb-1 px-1">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Areas of Responsibility ({areas.length})
              </h3>
              <button
                onClick={openCreateArea}
                className="p-1 rounded-xl text-stone-400 hover:text-brand-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                title="Create New Area"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              {areas.length === 0 ? (
                <p className="text-xs text-stone-400 italic px-2 py-1">No areas created yet.</p>
              ) : (
                areas.map((area) => {
                  const isSelected = selectedAreaId === area.id;
                  const count = tasks.filter((t) => t.areaId === area.id && !t.completed).length;

                  return (
                    <div
                      key={area.id}
                      className={`group/area w-full flex items-center justify-between px-3 py-2 rounded-2xl text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 shadow-xs border border-brand-200 dark:border-brand-800'
                          : 'text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedAreaId(area.id);
                          setSelectedProjectId(null);
                        }}
                        className="flex items-center gap-2 truncate flex-1 text-left"
                      >
                        <Folder className="w-3.5 h-3.5 shrink-0" style={{ color: area.color }} />
                        <span className="truncate">{area.name}</span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {count > 0 && (
                          <span className="text-[10px] font-mono text-stone-400">
                            {count}
                          </span>
                        )}
                        <button
                          onClick={(e) => openEditArea(area, e)}
                          className="opacity-0 group-hover/area:opacity-100 p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all"
                          title="Edit Area"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Task List, Active Filter Banner & Capture Bar */}
        <div className="lg:col-span-8 space-y-4">
          {/* Quick Capture Input */}
          <form onSubmit={handleQuickAdd}>
            <div className="flex items-center gap-3 p-4 rounded-3xl bg-white dark:bg-stone-900 shadow-card border border-stone-200/80 dark:border-stone-800 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
              <Plus className="w-5 h-5 text-stone-400 shrink-0" />
              <input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder={
                  selectedProject
                    ? `Add task to ${selectedProject.title}... (e.g. 'Print music Friday !high')`
                    : selectedArea
                    ? `Add task to ${selectedArea.name}...`
                    : "New Task... (e.g. 'Order recorder ribbons Friday #chorus !high')"
                }
                className="flex-1 bg-transparent text-xs sm:text-sm text-stone-900 dark:text-white placeholder-stone-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!quickInput.trim()}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white text-xs font-bold rounded-2xl transition-all shadow-xs shrink-0"
              >
                Add Task
              </button>
            </div>
          </form>

          {/* Context Banner: Selected Project Details */}
          {selectedProject && (
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-card space-y-3 animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: selectedProject.color }}
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                      Project
                    </span>
                    {(() => {
                      const areaObj = areas.find((a) => a.id === selectedProject.areaId);
                      return areaObj ? (
                        <span className="text-[10px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg">
                          Area: {areaObj.name}
                        </span>
                      ) : null;
                    })()}
                    {selectedProject.deadline && (
                      <span className="text-[10px] font-mono text-stone-500 flex items-center gap-1 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg">
                        <Calendar className="w-3 h-3 text-stone-400" />
                        Due {selectedProject.deadline}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-black text-stone-900 dark:text-white">
                    {selectedProject.title}
                  </h2>

                  {selectedProject.notes && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 font-serif leading-relaxed">
                      {selectedProject.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => openEditProject(selectedProject)}
                    className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Project</span>
                  </button>

                  <button
                    onClick={() =>
                      setDeleteConfirm({
                        type: 'project',
                        id: selectedProject.id,
                        name: selectedProject.title
                      })
                    }
                    className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Project Progress Bar */}
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${projTotalTasks === 0 ? 0 : Math.round((projCompletedTasks / projTotalTasks) * 100)}%`,
                      backgroundColor: selectedProject.color
                    }}
                  />
                </div>
                <span className="text-[11px] font-mono text-stone-500">
                  {projCompletedTasks} of {projTotalTasks} completed
                </span>
              </div>
            </div>
          )}

          {/* Context Banner: Selected Area Details */}
          {selectedArea && (
            <div className="p-5 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 shrink-0" style={{ color: selectedArea.color }} />
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-lg border border-brand-200 dark:border-brand-800">
                    Area of Responsibility
                  </span>
                </div>

                <h2 className="text-xl font-black text-stone-900 dark:text-white">
                  {selectedArea.name}
                </h2>

                <p className="text-xs text-stone-400 font-mono">
                  {areaProjects.length} {areaProjects.length === 1 ? 'project' : 'projects'} • {areaTasks.length} {areaTasks.length === 1 ? 'active task' : 'active tasks'}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={() => openCreateProject(selectedArea.id)}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-1.5 border border-amber-200 dark:border-amber-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Project</span>
                </button>

                <button
                  onClick={() => openEditArea(selectedArea)}
                  className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Area</span>
                </button>

                <button
                  onClick={() =>
                    setDeleteConfirm({
                      type: 'area',
                      id: selectedArea.id,
                      name: selectedArea.name
                    })
                  }
                  className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Delete Area"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Regular List Heading (when neither a project nor area is selected) */}
          {!selectedProject && !selectedArea && (
            <div className="flex items-center justify-between px-2 pt-1">
              <h2 className="text-lg font-black text-stone-900 dark:text-white capitalize flex items-center gap-2">
                <span>{activeList} Tasks</span>
              </h2>
              <span className="text-xs text-stone-400 font-mono">
                {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
          )}

          {/* Tasks List */}
          <div className="space-y-2.5">
            {filteredTasks.length === 0 ? (
              <div className="bg-white dark:bg-stone-900 rounded-3xl p-12 text-center border border-stone-200/80 dark:border-stone-800 shadow-card">
                <CheckCircle2 className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
                <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
                  No tasks in this list
                </h3>
                <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">
                  Use the quick capture box above to add lesson preparation, rehearsal goals, or parent notices.
                </p>
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isExpanded = expandedTaskId === task.id;
                const area = areas.find((a) => a.id === task.areaId);
                const project = projects.find((p) => p.id === task.projectId);
                const subtaskCount = task.subtasks?.length || 0;
                const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

                return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-3xl bg-white dark:bg-stone-900 border transition-all ${
                      isExpanded
                        ? 'border-brand-500 shadow-elevated'
                        : 'border-stone-200/80 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 shadow-card'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <button
                        onClick={() => handleToggleComplete(task)}
                        className="mt-0.5 text-stone-400 hover:text-brand-600 transition-colors shrink-0"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <div
                        className="min-w-0 flex-1 cursor-pointer"
                        onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3
                            className={`text-xs sm:text-sm font-bold leading-snug ${
                              task.completed
                                ? 'line-through text-stone-400 dark:text-stone-500'
                                : 'text-stone-900 dark:text-white'
                            }`}
                          >
                            {task.title}
                          </h3>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {task.dueDate && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-stone-400" />
                                {task.dueDate}
                              </span>
                            )}
                            <button
                              onClick={(e) => handleDeleteTask(task.id, e)}
                              className="p-1 text-stone-400 hover:text-rose-500 rounded-lg transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {task.notes && (
                          <p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 mt-1">
                            {task.notes}
                          </p>
                        )}

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {project && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                              {project.title}
                            </span>
                          )}
                          {area && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                              {area.name}
                            </span>
                          )}
                          {task.priority === 'high' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              !High
                            </span>
                          )}
                          {task.tags.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500"
                            >
                              #{t}
                            </span>
                          ))}
                          {subtaskCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 flex items-center gap-1">
                              <CheckSquare className="w-3 h-3 text-brand-500" />
                              {completedSubtasks}/{subtaskCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Checklist Subtasks & Notes Editor */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800/80 pl-8 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                          Checklist Subtasks
                        </h4>

                        <div className="space-y-1.5">
                          {task.subtasks?.map((sub) => (
                            <div
                              key={sub.id}
                              onClick={() => handleToggleSubtask(task.id, sub.id)}
                              className="flex items-center gap-2 text-xs cursor-pointer hover:text-brand-600 transition-colors"
                            >
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center ${
                                  sub.completed
                                    ? 'bg-brand-600 border-brand-600 text-white'
                                    : 'border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                {sub.completed && <Check className="w-3 h-3" />}
                              </div>
                              <span
                                className={
                                  sub.completed
                                    ? 'line-through text-stone-400'
                                    : 'text-stone-700 dark:text-stone-300'
                                }
                              >
                                {sub.title}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Add subtask input */}
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSubtask(task.id);
                              }
                            }}
                            placeholder="Add subtask step..."
                            className="text-xs px-3 py-1.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl flex-1 text-stone-900 dark:text-white"
                          />
                          <button
                            onClick={() => handleAddSubtask(task.id)}
                            className="px-3 py-1.5 bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 text-stone-800 dark:text-stone-200 text-xs font-semibold rounded-xl"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* --- CREATE / EDIT PROJECT MODAL --- */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveProject}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-500" />
                <span>{editingProject ? 'Edit Project' : 'Create New Project'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsProjectModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Project Title
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="e.g. Winter Concert Repertoire & Staging"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                  Area of Responsibility
                </label>
                <select
                  value={projectAreaId}
                  onChange={(e) => setProjectAreaId(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white"
                >
                  <option value="">(None / General)</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                  Target Deadline
                </label>
                <input
                  type="date"
                  value={projectDeadline}
                  onChange={(e) => setProjectDeadline(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white"
                />
              </div>
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1.5">
                Project Accent Color
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProjectColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform shrink-0 ${
                      projectColor === c ? 'scale-125 ring-2 ring-offset-2 ring-stone-900 dark:ring-white' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Project Notes & Objectives
              </label>
              <textarea
                value={projectNotes}
                onChange={(e) => setProjectNotes(e.target.value)}
                rows={3}
                placeholder="Key goals, performance venue, or preparation steps..."
                className="w-full text-xs px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white"
              />
            </div>

            {/* Completed Toggle for Existing Project */}
            {editingProject && (
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={projectCompleted}
                  onChange={(e) => setProjectCompleted(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Mark Project as Completed
                </span>
              </label>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
              {editingProject ? (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      type: 'project',
                      id: editingProject.id,
                      name: editingProject.title
                    })
                  }
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- CREATE / EDIT AREA MODAL --- */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleSaveArea}
            className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
              <h3 className="text-base font-black text-stone-900 dark:text-white flex items-center gap-2">
                <Folder className="w-5 h-5 text-brand-600" />
                <span>{editingArea ? 'Edit Area of Responsibility' : 'New Area of Responsibility'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAreaModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1">
                Area Name
              </label>
              <input
                type="text"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
                placeholder="e.g. General Music (K–6) or 6th Grade Chorus"
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1.5">
                Area Theme Color
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAreaColor(c)}
                    className={`w-7 h-7 rounded-full transition-transform shrink-0 ${
                      areaColor === c ? 'scale-125 ring-2 ring-offset-2 ring-stone-900 dark:ring-white' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-stone-400 block mb-1.5">
                Area Icon
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'Music', label: 'Music', icon: Music },
                  { id: 'Sparkles', label: 'Concert', icon: Sparkles },
                  { id: 'BookOpen', label: 'Curriculum', icon: BookOpen },
                  { id: 'Sliders', label: 'Audio', icon: Sliders },
                  { id: 'FileText', label: 'Admin', icon: FileText },
                  { id: 'Award', label: 'Assessment', icon: Award },
                  { id: 'Layers', label: 'Units', icon: Layers },
                  { id: 'Folder', label: 'Folder', icon: Folder }
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = areaIcon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAreaIcon(item.id)}
                      className={`p-2.5 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400'
                          : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800">
              {editingArea ? (
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      type: 'area',
                      id: editingArea.id,
                      name: editingArea.name
                    })
                  }
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAreaModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  {editingArea ? 'Save Changes' : 'Create Area'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* --- CONFIRM DELETE DIALOG --- */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-stone-200 dark:border-stone-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-stone-900 dark:text-white">
                Delete {deleteConfirm.type === 'project' ? 'Project' : 'Area'}?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                Are you sure you want to delete <strong>&quot;{deleteConfirm.name}&quot;</strong>?
                {deleteConfirm.type === 'project'
                  ? ' Associated tasks will remain in your lists but will no longer belong to this project.'
                  : ' Any projects and tasks inside this area will be safely unassigned.'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-2xl text-stone-600 dark:text-stone-300 text-xs font-bold hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.type === 'project') {
                    executeDeleteProject(deleteConfirm.id);
                  } else {
                    executeDeleteArea(deleteConfirm.id);
                  }
                }}
                className="px-5 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-all"
              >
                Delete {deleteConfirm.type === 'project' ? 'Project' : 'Area'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
