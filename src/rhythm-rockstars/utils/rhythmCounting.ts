import { RhythmUnit } from '../types/rhythm';

/**
 * Formats standard music number counting for a given RhythmUnit
 * based on its starting beat number within the measure (1, 2, 3, 4 in 4/4 time).
 * 
 * Examples:
 * Beat 1 Quarter: "1"
 * Beat 2 8th-pair: "2 &"
 * Beat 3 16th-quad: "3 e & a"
 * Beat 4 Quarter Rest: "(4)"
 * Beat 1 Half note: "1 - 2"
 * Beat 3 Half note: "3 - 4"
 */
export function formatCountingSyllable(unit: RhythmUnit, beatNumber: number): string {
  const b = beatNumber;
  const nextB = b + 1;

  switch (unit.type) {
    case 'quarter':
      return `${b}`;

    case 'quarter_rest':
      return `(${b})`;

    case 'eighth_pair':
      return `${b} &`;

    case 'sixteenth_quad':
      return `${b} e & a`;

    case 'broken_eighth_two_sixteenth': // Ti-Tika (1 8th + 2 16ths)
      return `${b} & a`;

    case 'broken_two_sixteenth_eighth': // Tika-Ti (2 16ths + 1 8th)
      return `${b} e &`;

    case 'broken_dotted_sixteenth': // Tim-Ka (dotted 8th + 16th)
      return `${b} .. a`;

    case 'triplet': // 8th note triplet (Tri-po-let)
      return `${b} la li`;

    case 'half': // 2 beats
      return `${b} - ${nextB}`;

    case 'half_rest': // 2 beats rest
      return `(${b} - ${nextB})`;

    case 'whole': // 4 beats
      return `${b} - ${b + 1} - ${b + 2} - ${b + 3}`;

    case 'syncopation_beat': // 2 beats (8th - Quarter - 8th)
      return `${b} & (${nextB}) &`;

    default: {
      if (unit.syllableCounting) {
        // Fallback: replace initial digit with beat number
        return unit.syllableCounting.replace(/\b1\b/g, `${b}`);
      }
      return `${b}`;
    }
  }
}

/**
 * Calculates start beat (1, 2, 3, 4) and progression counting string
 * for each unit in an array of RhythmUnits in 4/4 time.
 */
export function getUnitsWithMeasureCounting(units: RhythmUnit[]): {
  unit: RhythmUnit;
  beatNumber: number;
  countingText: string;
}[] {
  let accumulatedBeats = 0;
  return units.map((unit) => {
    // 1-indexed beat within the 4/4 bar
    const beatNumber = (Math.floor(accumulatedBeats) % 4) + 1;
    const countingText = formatCountingSyllable(unit, beatNumber);
    accumulatedBeats += unit.durationBeats;
    return {
      unit,
      beatNumber,
      countingText
    };
  });
}
