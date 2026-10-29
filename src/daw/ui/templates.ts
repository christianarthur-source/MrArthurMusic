import { LibraryCatalog } from '../library/catalog';
import { CatalogEntry } from '../library/catalogTypes';
import { createAudioRegion, createMidiRegion, createProject, newId } from '../model/factory';
import * as ops from '../model/ops';
import { MidiNote, PPQ, Project } from '../model/types';
import { loopAssetInfo, loopTicks } from './actions';

/**
 * Starter projects. Library loops are chosen from the catalog at creation time
 * (so templates follow whatever licensed library is installed); drum and chord
 * parts are MIDI played by the sampled instruments.
 */

const S16 = PPQ / 4;
const BAR = PPQ * 4;

export type DrumPattern = Record<number, string>; // GM note -> 16 chars, 'x' hit, 'X' accent, 'o' soft

export const DRUM_PATTERNS: Record<string, { name: string; bpm: number; pattern: DrumPattern }> = {
  boomBap: { name: 'Boom Bap', bpm: 90, pattern: { 36: 'x.....x...x.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.xo' } },
  rock: { name: 'Rock Beat', bpm: 120, pattern: { 36: 'x.......x.x.....', 38: '....X.......X...', 42: 'x.x.x.x.x.x.x.x.', 49: 'x...............' } },
  fourOnFloor: { name: 'Four on the Floor', bpm: 124, pattern: { 36: 'X...X...X...X...', 39: '....x.......x...', 42: '..x...x...x...x.', 46: '..o...o...o...o.' } },
  trap: { name: 'Trap', bpm: 140, pattern: { 36: 'x.........x.....', 38: '........X.......', 42: 'x.x.x.xxx.x.x.xx' } },
  reggaeton: { name: 'Reggaeton', bpm: 95, pattern: { 36: 'x...x...x...x...', 38: '...x..x....x..x.', 42: 'x.x.x.x.x.x.x.x.' } },
  waltz: { name: 'Waltz (3/4)', bpm: 96, pattern: { 36: 'x...........', 38: '....o...o...', 42: 'x...x...x...' } },
};

export function patternNotes(p: DrumPattern): MidiNote[] {
  const notes: MidiNote[] = [];
  for (const [note, row] of Object.entries(p)) {
    [...row].forEach((c, i) => {
      if (c === '.') return;
      notes.push({ id: newId('n'), pitch: Number(note), start: i * S16, length: S16, velocity: c === 'X' ? 124 : c === 'o' ? 64 : 98 });
    });
  }
  return notes;
}

interface LoopSpec {
  /** Track name in the new song. */
  name: string;
  /** Words that identify the loop in the catalog (style, part, section). */
  text: string;
  /** Match the template key (pitched parts). */
  keyed?: boolean;
}

interface MidiSpec {
  name: string;
  instrument: string;
  notes: () => MidiNote[];
  cycleBars: number;
  bars: number;
}

export interface Template {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bpm: number;
  key?: string;
  sig?: [number, number];
  loops: LoopSpec[];
  midi: MidiSpec[];
}

/**
 * Templates are built from the CC0 "Studio Loops" construction kits: every part
 * of a template comes from the same style, section and key, so they fit together.
 */
export const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Empty Song', emoji: '📄', description: 'Start from scratch.', bpm: 110, loops: [], midi: [] },
  {
    id: 'beat', name: 'Make a Beat', emoji: '🥁', description: 'Program your own drums on the step grid over a boom-bap bass and keys.', bpm: 90, key: 'Am',
    loops: [
      { name: 'Keys', text: 'boom bap electric piano verse', keyed: true },
      { name: 'Bass', text: 'boom bap upright bass verse', keyed: true },
    ],
    midi: [{ name: 'Drum Machine', instrument: 'drum_kit', notes: () => patternNotes(DRUM_PATTERNS.boomBap.pattern), cycleBars: 1, bars: 8 }],
  },
  {
    id: 'pop', name: 'Pop Song', emoji: '🎤', description: 'Drums, piano, bass and strings in C. Add a melody on top!', bpm: 110, key: 'C',
    loops: [
      { name: 'Drums', text: 'sunny pop drums' },
      { name: 'Piano', text: 'sunny pop piano chords verse', keyed: true },
      { name: 'Bass', text: 'sunny pop upright bass verse', keyed: true },
      { name: 'Strings', text: 'sunny pop string pad verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'lofi', name: 'Lo-Fi Hip-Hop', emoji: '🎧', description: 'Mellow electric piano, upright bass and soft drums.', bpm: 80, key: 'C',
    loops: [
      { name: 'Drums', text: 'lo fi study drums' },
      { name: 'Electric Piano', text: 'lo fi study electric piano verse', keyed: true },
      { name: 'Bass', text: 'lo fi study upright bass verse', keyed: true },
      { name: 'Kalimba', text: 'lo fi study kalimba verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'funk', name: 'Funk Groove', emoji: '🕺', description: 'Tight drums, clav, bass and horn hits.', bpm: 104, key: 'Dm',
    loops: [
      { name: 'Drums', text: 'funk groove funk drums' },
      { name: 'Clav', text: 'funk groove clav verse', keyed: true },
      { name: 'Bass', text: 'funk groove funk bass verse', keyed: true },
      { name: 'Horns', text: 'funk groove brass verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'folk', name: 'Folk & Country', emoji: '🪕', description: 'Train beat, plucked strings, bass and harmonica.', bpm: 100, key: 'G',
    loops: [
      { name: 'Drums', text: 'country road train beat' },
      { name: 'Strumstick', text: 'country road strumstick verse', keyed: true },
      { name: 'Bass', text: 'country road bass verse', keyed: true },
      { name: 'Harmonica', text: 'country road harmonica verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'jazz', name: 'Jazz Club', emoji: '🎷', description: 'Swing ride, walking bass, piano and sax.', bpm: 132, key: 'C',
    loops: [
      { name: 'Drums', text: 'jazz club swing ride' },
      { name: 'Bass', text: 'jazz club walking bass verse', keyed: true },
      { name: 'Piano', text: 'jazz club piano comping verse', keyed: true },
      { name: 'Sax', text: 'jazz club tenor sax verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'soundtrack', name: 'Movie Soundtrack', emoji: '🎬', description: 'Epic drums, driving cellos, strings and a horn theme.', bpm: 90, key: 'Dm',
    loops: [
      { name: 'Epic Drums', text: 'epic cinematic epic drums' },
      { name: 'Cellos', text: 'epic cinematic cello ostinato verse', keyed: true },
      { name: 'Strings', text: 'epic cinematic high strings verse', keyed: true },
      { name: 'Horns', text: 'epic cinematic horn theme verse', keyed: true },
    ],
    midi: [],
  },
  {
    id: 'soundscape', name: 'Soundscape', emoji: '🌌', description: 'Slow, dreamy textures. Try adding reverb and echo.', bpm: 70, key: 'D',
    loops: [
      { name: 'Organ', text: 'ambient dreams organ drone verse', keyed: true },
      { name: 'Harp', text: 'ambient dreams harp verse', keyed: true },
      { name: 'Vibes', text: 'ambient dreams vibes verse', keyed: true },
      { name: 'Ocarina', text: 'ambient dreams ocarina verse', keyed: true },
    ],
    midi: [],
  },
];

export async function buildTemplate(t: Template, catalog: LibraryCatalog): Promise<{ project: Project; missing: string[] }> {
  let p = createProject(t.id === 'blank' ? 'My Song' : `My ${t.name}`, t.bpm);
  if (t.sig) p = ops.setTimeSignature(p, t.sig[0], t.sig[1]);
  const missing: string[] = [];
  for (const spec of t.loops) {
    const res = await catalog.query({ text: spec.text, keys: spec.keyed && t.key ? [t.key] : undefined, kind: 'loop', approvedOnly: true, packs: ['cc0-studio'], limit: 5 });
    const entry: CatalogEntry | undefined = res.rows[0];
    if (!entry) {
      missing.push(spec.name);
      continue;
    }
    const r = ops.addTrack(p, 'audio', spec.name);
    p = r.project;
    const { length, synced } = loopTicks(p, entry);
    const region = createAudioRegion({
      trackId: r.track.id,
      name: entry.name,
      start: 0,
      length: Math.max(length, Math.ceil((8 * BAR) / length) * length),
      loopLength: length,
      loop: true,
      assetId: `lib:${entry.id}`,
      stretch: synced ? 'sync' : 'off',
    });
    p = ops.addRegions(p, [region], [loopAssetInfo(entry)]);
  }
  for (const m of t.midi) {
    const r = ops.addTrack(p, 'instrument', m.name, m.instrument);
    p = r.project;
    const cycle = m.cycleBars * BAR;
    p = ops.addRegions(p, [createMidiRegion({ trackId: r.track.id, name: m.name, start: 0, length: m.bars * BAR, loopLength: cycle, loop: true, notes: m.notes() })]);
  }
  p = { ...p, loop: { enabled: false, start: 0, end: 8 * BAR } };
  return { project: p, missing };
}
