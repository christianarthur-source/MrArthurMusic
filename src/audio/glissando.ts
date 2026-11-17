import { InstrumentId, KeySignature, NoteItem, NoteStep, Pitch } from '../types/music';
import { getPitchFrequency, STEP_DIATONIC_OFFSET } from '../utils/musicMath';

/**
 * Glissando playback planning (Staff Composer, Advanced mode).
 *
 * A note with `isGliss` slides to the next note. Like a real player:
 * - Strings, voice, winds, brass, guitars, synths: one continuous pitch slide. The target note is not
 *   re-struck, so it sounds like a single connected gesture (portamento-style).
 * - Keyboards, harp and mallets cannot bend pitch, so they play a quick scale run through the notes in
 *   between (the usual piano / harp glissando), then the target note is struck.
 * - Drums, unpitched percussion and sound effects ignore the glissando.
 */

export interface GlissFlatEntry {
  item: NoteItem;
  startTime: number;
  durationSec: number;
}

/** Pitch automation in cents relative to the voice's starting pitch, at absolute audio times. */
export type GlideCurve = { time: number; cents: number }[];

export type GlissPlan =
  | { mode: 'none' }
  | {
      mode: 'slide';
      /** One curve per voice (pitches sorted low to high). */
      curves: GlideCurve[];
      /** Seconds to add to the starting note's sounding length (merged target notes). */
      extraDurationSec: number;
      /** If set, the sliding sound must stop here (the target is re-struck because chord sizes differ). */
      endTime: number | null;
    }
  | {
      mode: 'run';
      notes: { pitch: Pitch; time: number; durationSec: number }[];
    };

const RUN_INSTRUMENTS = new Set<InstrumentId>([
  'piano_treble',
  'piano_bass',
  'electric_piano',
  'harpsichord',
  'clavinet',
  'celesta',
  'music_box',
  'organ',
  'jazz_organ',
  'accordion',
  'harp',
  'glockenspiel',
  'xylophone',
  'marimba',
  'vibraphone',
  'steel_drums',
  'tubular_bells',
  'kalimba',
]);

const NO_GLISS_INSTRUMENTS = new Set<InstrumentId>([
  'drum_kit',
  'drum_808',
  'drum_jazz',
  'drum_latin',
  'triangle',
  'tambourine',
  'woodblock',
  'cowbell',
  'congas',
  'djembe',
]);

const DIATONIC_STEPS: NoteStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

export function getGlissStyle(instrumentId: InstrumentId): 'slide' | 'run' | 'none' {
  if (NO_GLISS_INSTRUMENTS.has(instrumentId) || instrumentId.startsWith('sfx_')) return 'none';
  return RUN_INSTRUMENTS.has(instrumentId) ? 'run' : 'slide';
}

/** Pitches of a note item sorted from lowest to highest sounding pitch. */
export function sortedItemPitches(item: NoteItem, keySignature: KeySignature): Pitch[] {
  const raw = item.pitches && item.pitches.length > 0 ? item.pitches : item.pitch ? [item.pitch] : [];
  return [...raw].sort((a, b) => getPitchFrequency(a, keySignature) - getPitchFrequency(b, keySignature));
}

/** The part of a note before the slide starts: a short hold so the starting pitch is heard clearly. */
function holdBeforeSlide(durationSec: number): number {
  return Math.min(durationSec * 0.25, 0.35);
}

/**
 * Plans the glissando for the note at `startIdx` whose tie chain ends at `chainEndIdx`.
 * Target notes merged into a continuous slide are added to `continuationIndices` so the caller
 * does not strike them again.
 */
export function planGlissando(
  flatItems: GlissFlatEntry[],
  startIdx: number,
  chainEndIdx: number,
  instrumentId: InstrumentId,
  keySignature: KeySignature,
  continuationIndices: Set<number>
): GlissPlan {
  const first = flatItems[chainEndIdx];
  if (!first?.item.isGliss) return { mode: 'none' };
  const firstTarget = flatItems[chainEndIdx + 1];
  if (!firstTarget || firstTarget.item.type !== 'note') return { mode: 'none' };

  const style = getGlissStyle(instrumentId);
  if (style === 'none') return { mode: 'none' };

  const startPitches = sortedItemPitches(flatItems[startIdx].item, keySignature);
  if (startPitches.length === 0) return { mode: 'none' };

  if (style === 'run') {
    const targetPitches = sortedItemPitches(firstTarget.item, keySignature);
    if (targetPitches.length === 0) return { mode: 'none' };
    // Run along the top line of the chord (the melody), white-key / harp style in the key signature.
    const from = startPitches[startPitches.length - 1];
    const to = targetPitches[targetPitches.length - 1];
    const fromDia = from.octave * 7 + STEP_DIATONIC_OFFSET[from.step];
    const toDia = to.octave * 7 + STEP_DIATONIC_OFFSET[to.step];
    const dir = toDia > fromDia ? 1 : -1;
    const steps: Pitch[] = [];
    for (let d = fromDia + dir; dir > 0 ? d < toDia : d > toDia; d += dir) {
      steps.push({ step: DIATONIC_STEPS[((d % 7) + 7) % 7], octave: Math.floor(d / 7) });
    }
    if (steps.length === 0) return { mode: 'none' };

    const hold = holdBeforeSlide(first.durationSec);
    const t0 = first.startTime + hold;
    const t1 = firstTarget.startTime - 0.01;
    const span = t1 - t0;
    if (span <= 0.02) return { mode: 'none' };
    // Keep the run playable: at most one note every 22 ms (a very fast real glissando).
    const maxNotes = Math.max(1, Math.floor(span / 0.022));
    const picked =
      steps.length <= maxNotes
        ? steps
        : Array.from({ length: maxNotes }, (_, i) => steps[Math.floor(((i + 0.5) * steps.length) / maxNotes)]);
    // A real glissando is a quick sweep: at most ~70 ms per note, timed to land on the target note.
    const gap = Math.min(span / picked.length, 0.07);
    const runStart = t1 - gap * picked.length;
    return {
      mode: 'run',
      notes: picked.map((pitch, i) => ({
        pitch,
        time: runStart + i * gap,
        durationSec: Math.max(0.09, gap * 1.6),
      })),
    };
  }

  // Continuous slide (one curve per voice).
  const baseFreqs = startPitches.map((p) => getPitchFrequency(p, keySignature));
  const curves: GlideCurve[] = baseFreqs.map(() => []);
  const currentCents = baseFreqs.map(() => 0);
  let extraDurationSec = 0;
  let endTime: number | null = null;
  let segIdx = chainEndIdx;

  while (flatItems[segIdx]?.item.isGliss) {
    const seg = flatItems[segIdx];
    const target = flatItems[segIdx + 1];
    if (!target || target.item.type !== 'note') break;
    const targetPitches = sortedItemPitches(target.item, keySignature);
    if (targetPitches.length === 0) break;

    const t0 = seg.startTime + holdBeforeSlide(seg.durationSec);
    const t1 = target.startTime;
    baseFreqs.forEach((base, v) => {
      const tp = targetPitches[Math.min(v, targetPitches.length - 1)];
      const cents = 1200 * Math.log2(getPitchFrequency(tp, keySignature) / base);
      curves[v].push({ time: t0, cents: currentCents[v] }, { time: t1, cents });
      currentCents[v] = cents;
    });

    if (targetPitches.length !== baseFreqs.length) {
      // Different chord size: slide into the target, then let it be struck normally.
      endTime = t1;
      break;
    }

    // Merge the target (and any notes tied to it) into this one sliding sound.
    let e = segIdx + 1;
    continuationIndices.add(e);
    extraDurationSec += flatItems[e].durationSec;
    while (flatItems[e].item.isTied && flatItems[e + 1]?.item.type === 'note') {
      e++;
      continuationIndices.add(e);
      extraDurationSec += flatItems[e].durationSec;
    }
    segIdx = e;
  }

  if (curves[0].length === 0) return { mode: 'none' };
  return { mode: 'slide', curves, extraDurationSec, endTime };
}

/** Writes a glide curve onto a detune-style AudioParam (value in cents). */
export function applyGlideToCents(param: AudioParam, curve: GlideCurve, baseCents = 0) {
  if (!curve.length) return;
  param.setValueAtTime(baseCents + curve[0].cents, curve[0].time);
  for (let i = 1; i < curve.length; i++) {
    const { time, cents } = curve[i];
    if (time <= curve[i - 1].time) param.setValueAtTime(baseCents + cents, time);
    else if (cents === curve[i - 1].cents) param.setValueAtTime(baseCents + cents, time);
    else param.linearRampToValueAtTime(baseCents + cents, time);
  }
}

/** Writes a glide curve onto a playbackRate AudioParam (exponential ramps = even slide in pitch). */
export function applyGlideToRate(param: AudioParam, curve: GlideCurve, baseRate: number) {
  if (!curve.length) return;
  const rate = (c: number) => baseRate * Math.pow(2, c / 1200);
  param.setValueAtTime(rate(curve[0].cents), curve[0].time);
  for (let i = 1; i < curve.length; i++) {
    const { time, cents } = curve[i];
    if (time <= curve[i - 1].time || cents === curve[i - 1].cents) param.setValueAtTime(rate(cents), time);
    else param.exponentialRampToValueAtTime(rate(cents), time);
  }
}
