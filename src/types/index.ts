// Core Type Definitions for Music Teacher Command Center

export type GradeLevel = 'K' | '1' | '2' | '3' | '4' | '5' | '6' | 'Chorus' | 'All';

export interface UserPreferences {
  appName: string;
  teacherName: string;
  schoolName: string;
  roomNumber: string;
  darkMode: boolean;
  accentColor: string; // 'blue' | 'amber' | 'emerald' | 'rose' | 'purple'
  defaultClassDuration: number; // in minutes, e.g. 35, 40, 45
  metronomeSound: 'woodblock' | 'beep' | 'drum' | 'cowbell';
  tunerRefA4: number; // default 440
  googleDriveClientId?: string;
  googleCalendarConnected: boolean;
  aiApiKey?: string;
  aiProvider?: 'builtin' | 'claude' | 'gemini';
  claudeApiKey?: string;
  geminiApiKey?: string;
  pinnedNavigation: string[];
}

export type TaskListType = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  notes?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
  dueDate?: string; // YYYY-MM-DD
  startDate?: string;
  priority: 'none' | 'low' | 'medium' | 'high';
  tags: string[];
  areaId?: string;
  projectId?: string;
  listType: TaskListType;
  subtasks: Subtask[];
  linkedEntityId?: string; // e.g. lesson or chorus song
  linkedEntityType?: 'lesson' | 'chorus' | 'event';
}

export interface Area {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Project {
  id: string;
  title: string;
  areaId: string;
  notes?: string;
  deadline?: string;
  completed: boolean;
  color: string;
}

export interface ActivityStep {
  id: string;
  title: string;
  durationMinutes: number;
  description: string;
  materials?: string[];
  musicalConcept?: string; // e.g. 'Beat', 'Rhythm', 'Pitch', 'Form', 'Movement', 'Singing'
  notes?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  grade: GradeLevel;
  unit: string;
  durationMinutes: number;
  overview: string;
  objectives: string[];
  musicalConcepts: string[];
  standards: string[]; // NYS Arts standards codes e.g. 'MU:Cr1.1.4a'
  materialsNeeded: string[];
  activities: ActivityStep[];
  assessmentStrategy: string;
  differentiationNotes?: string;
  teacherReflection?: string;
  driveLinks?: string[];
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
}

export interface ClassSection {
  id: string;
  name: string; // e.g. '1-Smith', '4-Rodriguez'
  grade: GradeLevel;
  room: string;
  meetingDayTime: string; // e.g. 'Day 2, Period 3 (10:15 - 10:55)'
  lastLessonDeliveredId?: string;
  lastDeliveredDate?: string;
  completedActivitiesCount?: number;
  notesForNextTime?: string;
  studentCount: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO date string or YYYY-MM-DDTHH:mm
  endDate: string;
  allDay?: boolean;
  category: 'class' | 'chorus' | 'concert' | 'assembly' | 'meeting' | 'duty' | 'pd' | 'rehearsal';
  location?: string;
  grade?: GradeLevel;
  color?: string;
  source: 'local' | 'imported_ics' | 'google' | 'subscription';
  sourceId?: string;
  calendarName?: string;
}

export interface CalendarSubscription {
  id: string;
  name: string;
  description?: string;
  color: string;
  sourceType: 'local' | 'ics_url' | 'ics_file' | 'google' | 'apple';
  url?: string;
  enabled: boolean;
  eventCount?: number;
  lastSynced?: string;
  isBuiltIn?: boolean;
}

export interface ChorusSong {
  id: string;
  title: string;
  composer: string;
  arranger?: string;
  voicing: 'Unison' | '2-Part' | '3-Part' | 'SSA' | 'SAB';
  key: string;
  tempoBpm: number;
  durationString: string; // e.g. '3:20'
  status: 'considering' | 'learning' | 'refining' | 'polished' | 'performed';
  notes: string;
  targetConcert?: string; // e.g. 'Winter Concert 2026'
  part1Notes?: string;
  part2Notes?: string;
  audioTrackUrl?: string;
  sheetMusicDriveUrl?: string;
  rehearsalHistory: {
    date: string;
    focusMeasures: string;
    notes: string;
  }[];
}

export interface ConcertProgram {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  repertoireIds: string[];
  orderOfProgram: {
    songId?: string;
    customTitle?: string;
    ensemble: string; // e.g. '6th Grade Chorus', '5th Grade Select', 'Combined Finale'
    notes?: string;
    durationMinutes: number;
  }[];
}

export interface SeatStudent {
  id: string;
  name: string; // First name or Initials (privacy-friendly)
  seatNumber: number;
  voicePart?: 'Part 1' | 'Part 2' | 'Soprano' | 'Alto';
  notes?: string;
  tags?: string[]; // e.g. 'needs front', 'strong leader', 'recorder helper'
}

export interface SeatingChart {
  id: string;
  title: string;
  classSectionId?: string;
  grade: GradeLevel;
  layoutType: 'semicircle' | 'rows' | 'risers' | 'tables' | 'horseshoe';
  rowsCount: number;
  seatsPerRow: number;
  teacherDeskPosition: 'front-center' | 'front-left' | 'front-right';
  pianoPosition: 'left' | 'right' | 'none';
  instrumentCartPosition: 'back' | 'front-left' | 'front-right';
  students: {
    row: number;
    col: number;
    student: SeatStudent;
  }[];
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  tags: string[];
  mood: 'great' | 'good' | 'neutral' | 'challenging' | 'exhausting';
  energyLevel: 1 | 2 | 3 | 4 | 5;
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'indoor_recess';
  location?: string;
  gradeLevel?: GradeLevel;
  photoUrl?: string; // base64 or object URL for photo attachment
  starred?: boolean;
  templateType?: 'daily_reflection' | 'what_worked' | 'reuse_next_year' | 'chorus_notes' | 'concert_debrief' | 'sub_plan';
  pinned?: boolean;
}

export interface ResourceLink {
  id: string;
  title: string;
  url: string;
  description?: string;
  category: 'drive' | 'youtube' | 'game' | 'theory' | 'sheet_music' | 'listening' | 'movement';
  grade: GradeLevel;
  tags: string[];
  isGoogleDrive: boolean;
  driveType?: 'doc' | 'sheet' | 'slide' | 'folder' | 'pdf';
  isFavorite: boolean;
  lastUsed?: string;
  thumbnailUrl?: string;
}

export interface InstrumentItem {
  id: string;
  name: string; // e.g. 'Soprano Xylophone (Studio 49)', 'Baritone Ukulele #3'
  category: 'orff_barred' | 'ukulele' | 'recorder' | 'unpitched_percussion' | 'boomwhackers' | 'electronic';
  location: 'Music Cart' | 'Room 104 Shelf A' | 'Closet B' | 'Stage';
  quantity: number;
  condition: 'excellent' | 'good' | 'needs_tuning' | 'repair_needed';
  notes?: string;
}

export interface AudioPracticeTrack {
  id: string;
  title: string;
  fileName: string;
  artist?: string;
  blobUrl?: string;
  duration: number;
  markers: {
    id: string;
    time: number;
    label: string;
    notes?: string;
  }[];
  loopA?: number;
  loopB?: number;
  playbackSpeed: number; // 0.5 to 1.5
  pitchShiftSemitones: number; // -12 to +12
  isBuiltin?: boolean;
}

export interface SongMakerPattern {
  id: string;
  title: string;
  tempo: number;
  steps: number; // 16
  melodyInstrument: 'xylophone' | 'piano' | 'synth' | 'marimba';
  drumInstrument: 'acoustic' | 'electronic' | 'orff';
  melodyPitches: string[]; // ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4']
  melodyGrid: boolean[][]; // [pitchIndex][stepIndex]
  drumGrid: boolean[][]; // [0=Kick, 1=Snare/Woodblock, 2=HiHat/Triangle][stepIndex]
}

export interface BeatPattern {
  id: string;
  title: string;
  tempo: number;
  timeSignature: '4/4' | '3/4' | '6/8';
  steps: number; // 16
  tracks: {
    name: string;
    sound: string;
    volume: number;
    muted: boolean;
    solo: boolean;
    grid: boolean[];
  }[];
  category: 'educational' | 'groove' | 'world' | 'custom';
}
