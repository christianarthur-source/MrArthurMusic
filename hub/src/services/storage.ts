import {
  UserPreferences,
  Area,
  Project,
  TaskItem,
  LessonPlan,
  ClassSection,
  CalendarEvent,
  CalendarSubscription,
  ChorusSong,
  ConcertProgram,
  SeatingChart,
  JournalEntry,
  ResourceLink,
  InstrumentItem,
  BeatPattern,
  TaskListType
} from '../types';
import {
  INITIAL_PREFERENCES,
  INITIAL_AREAS,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_LESSON_PLANS,
  INITIAL_CLASSES,
  INITIAL_CHORUS_SONGS,
  INITIAL_CONCERT,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_CALENDAR_SUBSCRIPTIONS,
  INITIAL_SEATING_CHARTS,
  INITIAL_JOURNAL_ENTRIES,
  INITIAL_RESOURCES,
  INITIAL_INVENTORY,
  INITIAL_BEAT_PATTERNS
} from './initialData';

const STORAGE_KEYS = {
  PREFERENCES: 'mth_preferences',
  AREAS: 'mth_areas',
  PROJECTS: 'mth_projects',
  TASKS: 'mth_tasks',
  LESSONS: 'mth_lessons',
  CLASSES: 'mth_classes',
  EVENTS: 'mth_events',
  CALENDAR_SUBSCRIPTIONS: 'mth_calendar_subscriptions',
  CHORUS_SONGS: 'mth_chorus_songs',
  CONCERTS: 'mth_concerts',
  SEATING_CHARTS: 'mth_seating_charts',
  JOURNAL: 'mth_journal',
  RESOURCES: 'mth_resources',
  INVENTORY: 'mth_inventory',
  BEAT_PATTERNS: 'mth_beat_patterns'
};

type Listener = () => void;

class StorageService {
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Storage listener error:', err);
      }
    });
  }

  private getItem<T>(key: string, defaultValue: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return defaultValue;
      return JSON.parse(data) as T;
    } catch (e) {
      console.warn(`Failed reading ${key} from localStorage, using defaults`, e);
      return defaultValue;
    }
  }

  private setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      this.notify();
    } catch (e) {
      console.error(`Failed writing ${key} to localStorage`, e);
    }
  }

  // Preferences
  public getPreferences(): UserPreferences {
    return this.getItem(STORAGE_KEYS.PREFERENCES, INITIAL_PREFERENCES);
  }

  public updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
    const current = this.getPreferences();
    const updated = { ...current, ...updates };
    this.setItem(STORAGE_KEYS.PREFERENCES, updated);
    return updated;
  }

  // Areas
  public getAreas(): Area[] {
    return this.getItem(STORAGE_KEYS.AREAS, INITIAL_AREAS);
  }

  public saveAreas(areas: Area[]): void {
    this.setItem(STORAGE_KEYS.AREAS, areas);
  }

  public addArea(area: Omit<Area, 'id'>): Area {
    const newArea: Area = {
      ...area,
      id: 'area-' + Date.now().toString(36)
    };
    const areas = this.getAreas();
    this.saveAreas([...areas, newArea]);
    return newArea;
  }

  public updateArea(id: string, updates: Partial<Area>): void {
    const areas = this.getAreas().map((a) => (a.id === id ? { ...a, ...updates } : a));
    this.saveAreas(areas);
  }

  public deleteArea(id: string): void {
    const areas = this.getAreas().filter((a) => a.id !== id);
    this.saveAreas(areas);

    // Unlink projects that were in this area
    const projects = this.getProjects().map((p) => (p.areaId === id ? { ...p, areaId: '' } : p));
    this.saveProjects(projects);

    // Unlink tasks that were in this area
    const tasks = this.getTasks().map((t) => (t.areaId === id ? { ...t, areaId: undefined } : t));
    this.saveTasks(tasks);
  }

  // Projects
  public getProjects(): Project[] {
    return this.getItem(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS);
  }

  public saveProjects(projects: Project[]): void {
    this.setItem(STORAGE_KEYS.PROJECTS, projects);
  }

  public addProject(project: Omit<Project, 'id'>): Project {
    const newProj: Project = {
      ...project,
      id: 'proj-' + Date.now().toString(36)
    };
    const projects = this.getProjects();
    this.saveProjects([...projects, newProj]);
    return newProj;
  }

  public updateProject(id: string, updates: Partial<Project>): void {
    const projects = this.getProjects().map((p) => (p.id === id ? { ...p, ...updates } : p));
    this.saveProjects(projects);
  }

  public deleteProject(id: string): void {
    const projects = this.getProjects().filter((p) => p.id !== id);
    this.saveProjects(projects);

    // Unlink tasks belonging to this project
    const tasks = this.getTasks().map((t) => (t.projectId === id ? { ...t, projectId: undefined } : t));
    this.saveTasks(tasks);
  }

  // Tasks
  public getTasks(): TaskItem[] {
    return this.getItem(STORAGE_KEYS.TASKS, INITIAL_TASKS);
  }

  public saveTasks(tasks: TaskItem[]): void {
    this.setItem(STORAGE_KEYS.TASKS, tasks);
  }

  public addTask(taskData: Partial<TaskItem>): TaskItem {
    const newTask: TaskItem = {
      id: 'task-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      title: taskData.title?.trim() || 'New Task',
      notes: taskData.notes || '',
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: taskData.dueDate,
      startDate: taskData.startDate,
      priority: taskData.priority || 'none',
      tags: taskData.tags || [],
      areaId: taskData.areaId,
      projectId: taskData.projectId,
      listType: taskData.listType || 'inbox',
      subtasks: taskData.subtasks || []
    };

    const tasks = this.getTasks();
    this.saveTasks([newTask, ...tasks]);
    return newTask;
  }

  public updateTask(id: string, updates: Partial<TaskItem>): void {
    const tasks = this.getTasks().map((t) => {
      if (t.id === id) {
        const isNowCompleted = updates.completed !== undefined ? updates.completed : t.completed;
        let listType = updates.listType || t.listType;
        if (updates.completed === true && t.listType !== 'logbook') {
          listType = 'logbook';
        } else if (updates.completed === false && t.listType === 'logbook') {
          listType = 'today';
        }

        return {
          ...t,
          ...updates,
          listType,
          completedAt: updates.completed ? new Date().toISOString() : undefined
        };
      }
      return t;
    });
    this.saveTasks(tasks);
  }

  public deleteTask(id: string): void {
    const tasks = this.getTasks().filter((t) => t.id !== id);
    this.saveTasks(tasks);
  }

  // Quick Task Parser (natural language for "Friday", "tomorrow", priority, tags)
  public parseQuickTaskInput(text: string, defaultList: TaskListType = 'inbox'): Partial<TaskItem> {
    let cleanText = text.trim();
    const result: Partial<TaskItem> = {
      title: '',
      listType: defaultList,
      priority: 'none',
      tags: []
    };

    // Check priority e.g. !high, !urgent, !med, !low
    if (/!(high|urgent)/i.test(cleanText)) {
      result.priority = 'high';
      cleanText = cleanText.replace(/!(high|urgent)/i, '').trim();
    } else if (/!(med|medium)/i.test(cleanText)) {
      result.priority = 'medium';
      cleanText = cleanText.replace(/!(med|medium)/i, '').trim();
    } else if (/!low/i.test(cleanText)) {
      result.priority = 'low';
      cleanText = cleanText.replace(/!low/i, '').trim();
    }

    // Check tags #tag
    const tagMatches = cleanText.match(/#(\w+)/g);
    if (tagMatches) {
      result.tags = tagMatches.map((t) => t.slice(1).toLowerCase());
      cleanText = cleanText.replace(/#(\w+)/g, '').trim();
    }

    // Check dates: today, tomorrow, monday..sunday, next week
    const today = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (/\btoday\b/i.test(cleanText)) {
      result.dueDate = toYMD(today);
      result.listType = 'today';
      cleanText = cleanText.replace(/\btoday\b/i, '').trim();
    } else if (/\btomorrow\b/i.test(cleanText)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      result.dueDate = toYMD(tomorrow);
      result.listType = 'today';
      cleanText = cleanText.replace(/\btomorrow\b/i, '').trim();
    } else if (/\bnext week\b/i.test(cleanText)) {
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      result.dueDate = toYMD(nextWeek);
      result.listType = 'upcoming';
      cleanText = cleanText.replace(/\bnext week\b/i, '').trim();
    } else {
      // Days of week
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < days.length; i++) {
        const regex = new RegExp(`\\b${days[i]}\\b`, 'i');
        if (regex.test(cleanText)) {
          const currentDay = today.getDay();
          const targetDay = i;
          let diff = targetDay - currentDay;
          if (diff <= 0) diff += 7;
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + diff);
          result.dueDate = toYMD(targetDate);
          result.listType = 'upcoming';
          cleanText = cleanText.replace(regex, '').trim();
          break;
        }
      }
    }

    result.title = cleanText || 'New Task';
    return result;
  }

  // Lesson Plans
  public getLessonPlans(): LessonPlan[] {
    return this.getItem(STORAGE_KEYS.LESSONS, INITIAL_LESSON_PLANS);
  }

  public saveLessonPlans(lessons: LessonPlan[]): void {
    this.setItem(STORAGE_KEYS.LESSONS, lessons);
  }

  public addLessonPlan(lesson: Omit<LessonPlan, 'id' | 'createdAt' | 'updatedAt'>): LessonPlan {
    const now = new Date().toISOString();
    const newLesson: LessonPlan = {
      ...lesson,
      id: 'lesson-' + Date.now().toString(36),
      createdAt: now,
      updatedAt: now
    };
    const lessons = this.getLessonPlans();
    this.saveLessonPlans([newLesson, ...lessons]);
    return newLesson;
  }

  public updateLessonPlan(id: string, updates: Partial<LessonPlan>): void {
    const lessons = this.getLessonPlans().map((l) =>
      l.id === id ? { ...l, ...updates, updatedAt: new Date().toISOString() } : l
    );
    this.saveLessonPlans(lessons);
  }

  public deleteLessonPlan(id: string): void {
    const lessons = this.getLessonPlans().filter((l) => l.id !== id);
    this.saveLessonPlans(lessons);
  }

  public duplicateLessonPlan(id: string): LessonPlan | null {
    const lesson = this.getLessonPlans().find((l) => l.id === id);
    if (!lesson) return null;
    const duplicated: LessonPlan = {
      ...lesson,
      id: 'lesson-' + Date.now().toString(36),
      title: `${lesson.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.saveLessonPlans([duplicated, ...this.getLessonPlans()]);
    return duplicated;
  }

  // Class Sections
  public getClasses(): ClassSection[] {
    return this.getItem(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
  }

  public saveClasses(classes: ClassSection[]): void {
    this.setItem(STORAGE_KEYS.CLASSES, classes);
  }

  public updateClass(id: string, updates: Partial<ClassSection>): void {
    const classes = this.getClasses().map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.saveClasses(classes);
  }

  // Calendar Events
  public getEvents(): CalendarEvent[] {
    return this.getItem(STORAGE_KEYS.EVENTS, INITIAL_CALENDAR_EVENTS);
  }

  public saveEvents(events: CalendarEvent[]): void {
    this.setItem(STORAGE_KEYS.EVENTS, events);
  }

  public addEvent(event: Omit<CalendarEvent, 'id'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: 'ev-' + Date.now().toString(36)
    };
    const events = this.getEvents();
    this.saveEvents([...events, newEvent]);
    return newEvent;
  }

  public addEvents(newEvents: Omit<CalendarEvent, 'id'>[]): number {
    if (!newEvents || newEvents.length === 0) return 0;
    const existing = this.getEvents();
    const created: CalendarEvent[] = [];
    let idx = 0;
    const baseId = 'ev-' + Date.now().toString(36);
    for (const item of newEvents) {
      created.push({
        ...item,
        id: `${baseId}-${(idx++).toString(36)}`
      });
    }
    this.saveEvents([...existing, ...created]);
    return created.length;
  }

  public updateEvent(id: string, updates: Partial<CalendarEvent>): void {
    const events = this.getEvents().map((e) => (e.id === id ? { ...e, ...updates } : e));
    this.saveEvents(events);
  }

  public deleteEvent(id: string): void {
    const events = this.getEvents().filter((e) => e.id !== id);
    this.saveEvents(events);
  }

  // Calendar Subscriptions
  public getSubscriptions(): CalendarSubscription[] {
    return this.getItem(STORAGE_KEYS.CALENDAR_SUBSCRIPTIONS, INITIAL_CALENDAR_SUBSCRIPTIONS);
  }

  public saveSubscriptions(subs: CalendarSubscription[]): void {
    this.setItem(STORAGE_KEYS.CALENDAR_SUBSCRIPTIONS, subs);
  }

  public addSubscription(sub: Omit<CalendarSubscription, 'id'>): CalendarSubscription {
    const newSub: CalendarSubscription = {
      ...sub,
      id: 'sub-' + Date.now().toString(36)
    };
    const subs = this.getSubscriptions();
    this.saveSubscriptions([...subs, newSub]);
    return newSub;
  }

  public updateSubscription(id: string, updates: Partial<CalendarSubscription>): void {
    const subs = this.getSubscriptions().map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.saveSubscriptions(subs);
  }

  public toggleSubscription(id: string): boolean {
    const subs = this.getSubscriptions();
    let newStatus = true;
    const updated = subs.map((s) => {
      if (s.id === id) {
        newStatus = !s.enabled;
        return { ...s, enabled: newStatus };
      }
      return s;
    });
    this.saveSubscriptions(updated);
    return newStatus;
  }

  /**
   * Unsubscribe from a calendar feed.
   * If removeEvents is true (default), all events belonging to this calendar subscription (sourceId === id)
   * are permanently removed from the user's schedule.
   */
  public deleteSubscription(
    id: string,
    removeEvents: boolean = true
  ): { removedSubscription: CalendarSubscription | null; removedEventsCount: number } {
    const subs = this.getSubscriptions();
    const target = subs.find((s) => s.id === id) || null;
    const remainingSubs = subs.filter((s) => s.id !== id);
    this.saveSubscriptions(remainingSubs);

    let removedCount = 0;
    if (removeEvents) {
      const events = this.getEvents();
      const filteredEvents = events.filter((e) => {
        if (e.sourceId === id) {
          removedCount++;
          return false;
        }
        return true;
      });
      if (removedCount > 0) {
        this.saveEvents(filteredEvents);
      }
    }

    return { removedSubscription: target, removedEventsCount: removedCount };
  }

  // Chorus Songs
  public getChorusSongs(): ChorusSong[] {
    return this.getItem(STORAGE_KEYS.CHORUS_SONGS, INITIAL_CHORUS_SONGS);
  }

  public saveChorusSongs(songs: ChorusSong[]): void {
    this.setItem(STORAGE_KEYS.CHORUS_SONGS, songs);
  }

  public addChorusSong(song: Omit<ChorusSong, 'id'>): ChorusSong {
    const newSong: ChorusSong = {
      ...song,
      id: 'song-' + Date.now().toString(36)
    };
    const songs = this.getChorusSongs();
    this.saveChorusSongs([newSong, ...songs]);
    return newSong;
  }

  public updateChorusSong(id: string, updates: Partial<ChorusSong>): void {
    const songs = this.getChorusSongs().map((s) => (s.id === id ? { ...s, ...updates } : s));
    this.saveChorusSongs(songs);
  }

  public deleteChorusSong(id: string): void {
    const songs = this.getChorusSongs().filter((s) => s.id !== id);
    this.saveChorusSongs(songs);
  }

  // Concert Program
  public getConcerts(): ConcertProgram[] {
    return this.getItem(STORAGE_KEYS.CONCERTS, [INITIAL_CONCERT]);
  }

  public saveConcerts(concerts: ConcertProgram[]): void {
    this.setItem(STORAGE_KEYS.CONCERTS, concerts);
  }

  public updateConcert(id: string, updates: Partial<ConcertProgram>): void {
    const concerts = this.getConcerts().map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.saveConcerts(concerts);
  }

  // Seating Charts
  public getSeatingCharts(): SeatingChart[] {
    return this.getItem(STORAGE_KEYS.SEATING_CHARTS, INITIAL_SEATING_CHARTS);
  }

  public saveSeatingCharts(charts: SeatingChart[]): void {
    this.setItem(STORAGE_KEYS.SEATING_CHARTS, charts);
  }

  public addSeatingChart(chart: Omit<SeatingChart, 'id' | 'createdAt'>): SeatingChart {
    const newChart: SeatingChart = {
      ...chart,
      id: 'chart-' + Date.now().toString(36),
      createdAt: new Date().toISOString()
    };
    const charts = this.getSeatingCharts();
    this.saveSeatingCharts([newChart, ...charts]);
    return newChart;
  }

  public updateSeatingChart(id: string, updates: Partial<SeatingChart>): void {
    const charts = this.getSeatingCharts().map((c) => (c.id === id ? { ...c, ...updates } : c));
    this.saveSeatingCharts(charts);
  }

  public deleteSeatingChart(id: string): void {
    const charts = this.getSeatingCharts().filter((c) => c.id !== id);
    this.saveSeatingCharts(charts);
  }

  // Journal
  public getJournalEntries(): JournalEntry[] {
    return this.getItem(STORAGE_KEYS.JOURNAL, INITIAL_JOURNAL_ENTRIES);
  }

  public saveJournalEntries(entries: JournalEntry[]): void {
    this.setItem(STORAGE_KEYS.JOURNAL, entries);
  }

  public addJournalEntry(entry: Omit<JournalEntry, 'id'>): JournalEntry {
    const newEntry: JournalEntry = {
      ...entry,
      id: 'jrn-' + Date.now().toString(36)
    };
    const entries = this.getJournalEntries();
    this.saveJournalEntries([newEntry, ...entries]);
    return newEntry;
  }

  public updateJournalEntry(id: string, updates: Partial<JournalEntry>): void {
    const entries = this.getJournalEntries().map((e) => (e.id === id ? { ...e, ...updates } : e));
    this.saveJournalEntries(entries);
  }

  public deleteJournalEntry(id: string): void {
    const entries = this.getJournalEntries().filter((e) => e.id !== id);
    this.saveJournalEntries(entries);
  }

  // Resources / Links
  public getResources(): ResourceLink[] {
    return this.getItem(STORAGE_KEYS.RESOURCES, INITIAL_RESOURCES);
  }

  public saveResources(links: ResourceLink[]): void {
    this.setItem(STORAGE_KEYS.RESOURCES, links);
  }

  public addResource(link: Omit<ResourceLink, 'id'>): ResourceLink {
    const newLink: ResourceLink = {
      ...link,
      id: 'link-' + Date.now().toString(36)
    };
    const links = this.getResources();
    this.saveResources([newLink, ...links]);
    return newLink;
  }

  public updateResource(id: string, updates: Partial<ResourceLink>): void {
    const links = this.getResources().map((l) => (l.id === id ? { ...l, ...updates } : l));
    this.saveResources(links);
  }

  public deleteResource(id: string): void {
    const links = this.getResources().filter((l) => l.id !== id);
    this.saveResources(links);
  }

  // Inventory
  public getInventory(): InstrumentItem[] {
    return this.getItem(STORAGE_KEYS.INVENTORY, INITIAL_INVENTORY);
  }

  public saveInventory(items: InstrumentItem[]): void {
    this.setItem(STORAGE_KEYS.INVENTORY, items);
  }

  public addInventoryItem(item: Omit<InstrumentItem, 'id'>): InstrumentItem {
    const newItem: InstrumentItem = {
      ...item,
      id: 'inv-' + Date.now().toString(36)
    };
    const items = this.getInventory();
    this.saveInventory([...items, newItem]);
    return newItem;
  }

  public updateInventoryItem(id: string, updates: Partial<InstrumentItem>): void {
    const items = this.getInventory().map((i) => (i.id === id ? { ...i, ...updates } : i));
    this.saveInventory(items);
  }

  public deleteInventoryItem(id: string): void {
    const items = this.getInventory().filter((i) => i.id !== id);
    this.saveInventory(items);
  }

  // Beat Patterns
  public getBeatPatterns(): BeatPattern[] {
    return this.getItem(STORAGE_KEYS.BEAT_PATTERNS, INITIAL_BEAT_PATTERNS);
  }

  public saveBeatPatterns(patterns: BeatPattern[]): void {
    this.setItem(STORAGE_KEYS.BEAT_PATTERNS, patterns);
  }

  // Backup & Restore
  public exportAllData(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      preferences: this.getPreferences(),
      areas: this.getAreas(),
      projects: this.getProjects(),
      tasks: this.getTasks(),
      lessons: this.getLessonPlans(),
      classes: this.getClasses(),
      events: this.getEvents(),
      calendarSubscriptions: this.getSubscriptions(),
      chorusSongs: this.getChorusSongs(),
      concerts: this.getConcerts(),
      seatingCharts: this.getSeatingCharts(),
      journal: this.getJournalEntries(),
      resources: this.getResources(),
      inventory: this.getInventory(),
      beatPatterns: this.getBeatPatterns()
    };
    return JSON.stringify(backup, null, 2);
  }

  public importAllData(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data.preferences) this.setItem(STORAGE_KEYS.PREFERENCES, data.preferences);
      if (data.areas) this.setItem(STORAGE_KEYS.AREAS, data.areas);
      if (data.projects) this.setItem(STORAGE_KEYS.PROJECTS, data.projects);
      if (data.tasks) this.setItem(STORAGE_KEYS.TASKS, data.tasks);
      if (data.lessons) this.setItem(STORAGE_KEYS.LESSONS, data.lessons);
      if (data.classes) this.setItem(STORAGE_KEYS.CLASSES, data.classes);
      if (data.events) this.setItem(STORAGE_KEYS.EVENTS, data.events);
      if (data.calendarSubscriptions) this.setItem(STORAGE_KEYS.CALENDAR_SUBSCRIPTIONS, data.calendarSubscriptions);
      if (data.chorusSongs) this.setItem(STORAGE_KEYS.CHORUS_SONGS, data.chorusSongs);
      if (data.concerts) this.setItem(STORAGE_KEYS.CONCERTS, data.concerts);
      if (data.seatingCharts) this.setItem(STORAGE_KEYS.SEATING_CHARTS, data.seatingCharts);
      if (data.journal) this.setItem(STORAGE_KEYS.JOURNAL, data.journal);
      if (data.resources) this.setItem(STORAGE_KEYS.RESOURCES, data.resources);
      if (data.inventory) this.setItem(STORAGE_KEYS.INVENTORY, data.inventory);
      if (data.beatPatterns) this.setItem(STORAGE_KEYS.BEAT_PATTERNS, data.beatPatterns);
      this.notify();
      return true;
    } catch (e) {
      console.error('Failed to import backup data:', e);
      return false;
    }
  }

  public resetToDefaults(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    this.notify();
  }
}

export const storage = new StorageService();
