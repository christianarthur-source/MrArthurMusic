export type StaffClef = 'treble' | 'bass' | 'alto' | 'tenor' | 'grand';

export type GameDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'custom';

export type GameStatus = 'menu' | 'countdown' | 'playing' | 'paused' | 'gameover';

export type GameInputMode = 'buttons' | 'mic';

export type InstrumentTransposition = 'C' | 'Bb' | 'Eb' | 'F';

export interface NoteDefinition {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  octave: number;
  midi: number;
  freq: number;
  displayName: string; // e.g. "C4 (Middle C)"
  // Position in half-spaces from middle staff line (Line 3 = 0)
  // Positive = above line 3, Negative = below line 3
  // e.g. Line 3 = 0, Space 3 = 1, Line 4 = 2, Space 4 = 3, Line 5 = 4
  staffOffset: number;
  // Array of offsets for ledger lines needed (e.g. [-6] for Middle C in Treble)
  ledgerOffsets?: number[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  clef: StaffClef;
}

export interface ActiveNote {
  id: string;
  def: NoteDefinition;
  xPercent: number; // 100% (spawns right) -> 0% (target clef on left)
  speedPercentPerSec: number;
  clef: StaffClef;
  isHit: boolean;
  spawnTime: number;
}

export interface LaserBeam {
  id: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  color: string;
  createdAt: number;
  durationMs: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface ExplosionEffect {
  id: string;
  x: number;
  y: number;
  particles: Particle[];
  ringRadius: number;
  ringMaxRadius: number;
  ringColor: string;
  createdAt: number;
}

export interface ScorePopup {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  createdAt: number;
}
