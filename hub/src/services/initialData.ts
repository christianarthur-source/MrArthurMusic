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
  BeatPattern
} from '../types';


// A new user starts with an empty workspace. Only the beat machine's preset patterns ship as
// starting content, since they are tools rather than sample records.

export const INITIAL_PREFERENCES: UserPreferences = {
  appName: 'Music Teacher Hub',
  teacherName: '',
  schoolName: '',
  roomNumber: '',
  darkMode: false,
  accentColor: 'blue',
  defaultClassDuration: 40,
  metronomeSound: 'woodblock',
  tunerRefA4: 440,
  googleCalendarConnected: false,
  aiProvider: 'builtin',
  claudeApiKey: '',
  geminiApiKey: '',
  pinnedNavigation: ['home', 'planner', 'tasks', 'tools', 'visuals', 'audio-studio']
};

export const INITIAL_AREAS: Area[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_TASKS: TaskItem[] = [];

export const INITIAL_LESSON_PLANS: LessonPlan[] = [];

export const INITIAL_CLASSES: ClassSection[] = [];

export const INITIAL_CHORUS_SONGS: ChorusSong[] = [];

export const INITIAL_CONCERT: ConcertProgram = {
  id: 'concert-1',
  title: 'Upcoming Concert',
  date: '',
  time: '',
  location: '',
  notes: '',
  repertoireIds: [],
  orderOfProgram: []
};

export const INITIAL_CALENDAR_SUBSCRIPTIONS: CalendarSubscription[] = [];

export const INITIAL_CALENDAR_EVENTS: CalendarEvent[] = [];

export const INITIAL_SEATING_CHARTS: SeatingChart[] = [];

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [];

export const INITIAL_RESOURCES: ResourceLink[] = [];

export const INITIAL_INVENTORY: InstrumentItem[] = [];

export const INITIAL_BEAT_PATTERNS: BeatPattern[] = [
  {
    id: 'pat-steady-beat',
    title: 'Kindergarten & 1st: Steady Heartbeat (Quarter Notes)',
    tempo: 84,
    timeSignature: '4/4',
    steps: 16,
    category: 'educational',
    tracks: [
      { name: 'Heartbeat Drum', sound: 'kick', volume: 0.9, muted: false, solo: false, grid: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
      { name: 'Woodblock Pulse', sound: 'woodblock', volume: 0.8, muted: false, solo: false, grid: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] },
      { name: 'Triangle Accent', sound: 'triangle', volume: 0.6, muted: false, solo: false, grid: [true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] },
      { name: 'Clap (Ti-Ti 8ths)', sound: 'clap', volume: 0.0, muted: true, solo: false, grid: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] }
    ]
  },
  {
    id: 'pat-ta-titi',
    title: 'Grade 1 Rhythm: Ta & Ti-Ti (Quarter & 8ths)',
    tempo: 96,
    timeSignature: '4/4',
    steps: 16,
    category: 'educational',
    tracks: [
      { name: 'Ta (Quarter)', sound: 'kick', volume: 0.85, muted: false, solo: false, grid: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
      { name: 'Ti-Ti (Eighths)', sound: 'woodblock', volume: 0.9, muted: false, solo: false, grid: [false, false, false, false, true, false, true, false, false, false, false, false, true, false, true, false] },
      { name: 'Rest / Shh (Beat 4)', sound: 'hihat_c', volume: 0.4, muted: false, solo: false, grid: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false] },
      { name: 'Agogo High', sound: 'agogo', volume: 0.7, muted: false, solo: false, grid: [true, false, false, false, true, false, true, false, true, false, false, false, true, false, true, false] }
    ]
  },
  {
    id: 'pat-clave-ostinato',
    title: 'Grade 5 & 6: Son Clave 3-2 Ostinato',
    tempo: 112,
    timeSignature: '4/4',
    steps: 16,
    category: 'world',
    tracks: [
      { name: 'Clave 3-2', sound: 'woodblock', volume: 0.95, muted: false, solo: false, grid: [true, false, false, true, false, false, true, false, false, false, true, false, true, false, false, false] },
      { name: 'Conga / Low Drum', sound: 'kick', volume: 0.8, muted: false, solo: false, grid: [true, false, false, false, false, false, true, false, false, false, false, false, true, false, false, false] },
      { name: 'Maracas (Steady 8ths)', sound: 'hihat_c', volume: 0.6, muted: false, solo: false, grid: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] },
      { name: 'Cowbell Accent', sound: 'cowbell', volume: 0.75, muted: false, solo: false, grid: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false] }
    ]
  },
  {
    id: 'pat-rock-groove',
    title: 'Classroom Pop / Rock Steady Groove',
    tempo: 108,
    timeSignature: '4/4',
    steps: 16,
    category: 'groove',
    tracks: [
      { name: 'Bass Kick', sound: 'kick', volume: 0.9, muted: false, solo: false, grid: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false] },
      { name: 'Snare Drum', sound: 'snare', volume: 0.9, muted: false, solo: false, grid: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] },
      { name: 'Closed Hi-Hat', sound: 'hihat_c', volume: 0.75, muted: false, solo: false, grid: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false] },
      { name: 'Open Hi-Hat', sound: 'hihat_o', volume: 0.65, muted: false, solo: false, grid: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false] },
      { name: 'Hand Clap', sound: 'clap', volume: 0.7, muted: false, solo: false, grid: [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false] }
    ]
  }
];
