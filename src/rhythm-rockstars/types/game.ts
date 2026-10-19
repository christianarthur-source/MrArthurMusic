export type GameMode = 'quiz' | 'tap' | 'builder' | 'rhythm_quiz' | 'streak_rush';

export interface StudentProfile {
  id: string;
  name: string;
  avatar: string;
  passcode: string;
  classCode: string;
  totalScore: number;
  highestStreak: number;
  quizzesCompleted: number;
  levelProgress: Record<number, { stars: number; highAccuracy: number }>;
  badges: string[];
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar: string;
  classCode: string;
  totalScore: number;
  highestLevel: number;
  highestStreak: number;
  quizzesCompleted: number;
  badgesCount: number;
  starsCount: number;
}

export type SoundKit =
  | 'rock_kit'
  | 'woodblock'
  | 'cowbell_fever'
  | 'electric_clap'
  | 'marimba'
  | 'triangle'
  | 'synth_rimshot'
  | 'agogo_bell'
  | 'garage_drum';

export type SyllableStyle = 'kodaly' | 'numbers' | 'none';

export interface SoundSettingsConfig {
  volume: number; // 0 to 1
  tempoBpm: number; // 70 to 130
  soundKit: SoundKit;
  countIn: boolean;
  syllableStyle: SyllableStyle;
  soundEffectsEnabled: boolean;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'rhythm' | 'streak' | 'accuracy' | 'practice';
}
