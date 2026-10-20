export type NoteType = 
  | 'quarter'                     // 1 beat
  | 'quarter_rest'                // 1 beat rest
  | 'eighth_pair'                 // 2 eighth notes (1 beat)
  | 'eighth_rest_eighth'          // 8th rest followed by 8th note (1 beat)
  | 'eighth_eighth_rest'          // 8th note followed by 8th rest (1 beat)
  | 'sixteenth_quad'              // 4 sixteenth notes (1 beat)
  | 'broken_eighth_two_sixteenth' // 1 eighth + 2 sixteenths (ti-tika) (1 beat)
  | 'broken_two_sixteenth_eighth' // 2 sixteenths + 1 eighth (tika-ti) (1 beat)
  | 'broken_dotted_sixteenth'     // dotted eighth + sixteenth (tim-ka) (1 beat)
  | 'broken_sixteenth_dotted'     // sixteenth + dotted eighth (ka-tim) (1 beat)
  | 'sixteenth_eighth_sixteenth'  // sixteenth + eighth + sixteenth (syn-co-pa) (1 beat)
  | 'triplet'                     // 3 eighth-note triplet (1 beat)
  | 'half'                        // 2 beats
  | 'half_rest'                   // 2 beats rest
  | 'whole'                       // 4 beats
  | 'syncopation_beat';           // eighth - quarter - eighth across 2 beats

export interface RhythmUnit {
  type: NoteType;
  durationBeats: number; // e.g. 1, 2, 4
  name: string;
  syllableKodaly: string; // e.g. "ta", "ti-ti", "tika-tika", "ti-tika", "tri-po-let", "ta-ah", "shh"
  syllableCounting: string; // e.g. "1", "1 &", "1 e & a", "1 & a", "1 la li", "1 - 2"
  // Audio playback sub-events relative to unit start in beats
  events: Array<{
    offsetBeats: number; // e.g. 0, 0.5, 0.25, 0.75
    durationBeats: number;
    accent?: boolean;
    isRest?: boolean;
  }>;
}

export interface RhythmPattern {
  id: string;
  name: string;
  level: number;
  timeSignature: '4/4';
  totalBeats: number; // usually 4 (1 measure) or 8 (2 measures)
  units: RhythmUnit[];
  difficulty: 'Rookie' | 'Junior' | 'Pro' | 'Shredder' | 'Virtuoso' | 'Legend' | 'Secret Rockstar';
  tags: string[];
}

export interface LevelConfig {
  levelNumber: number;
  title: string;
  stageName: string;
  difficultyLabel: string;
  basePointsPerQuestion: number;
  description: string;
  unlockedByDefault: boolean;
  minPointsToUnlock: number;
  badgeId: string;
  badgeTitle: string;
  badgeIcon: string;
  rhythmTypesIntroduced: string[];
  patterns: RhythmPattern[];
}
