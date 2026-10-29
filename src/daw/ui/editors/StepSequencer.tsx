import { useMemo } from 'react';
import { gmDrumName } from '../../midi/gm';
import { newId } from '../../model/factory';
import * as ops from '../../model/ops';
import { ticksPerBar } from '../../model/time';
import { MidiRegion, PPQ, Track } from '../../model/types';
import { cx } from '../controls';
import { useProject, useStudio } from '../studio';

/**
 * Drum grid editing the same MIDI notes as the piano roll (16th-note steps).
 * Click = normal hit, Shift-click = accent, Alt-click = soft.
 */

export const DRUM_ROWS: { note: number; label: string }[] = [
  { note: 36, label: 'Kick' },
  { note: 38, label: 'Snare' },
  { note: 39, label: 'Clap' },
  { note: 42, label: 'Closed Hat' },
  { note: 46, label: 'Open Hat' },
  { note: 37, label: 'Rimshot' },
  { note: 50, label: 'High Tom' },
  { note: 47, label: 'Mid Tom' },
  { note: 45, label: 'Low Tom' },
  { note: 49, label: 'Crash' },
  { note: 51, label: 'Ride' },
  { note: 56, label: 'Cowbell' },
  { note: 70, label: 'Shaker' },
  { note: 62, label: 'Conga' },
];

const STEP = PPQ / 4;

export function StepSequencer({ region, track, availableNotes, noteNames }: { region: MidiRegion; track: Track; availableNotes: Set<number> | null; noteNames?: Record<string, string> }) {
  const s = useStudio();
  const sig = useProject((p) => p.timeSigMap[0].sig);
  const barT = ticksPerBar(sig);
  const span = region.loop ? region.loopLength : region.length;
  const steps = Math.min(64, Math.max(1, Math.round(span / STEP)));
  const stepsPerBar = Math.round(barT / STEP);
  const rows = useMemo(() => {
    if (noteNames && Object.keys(noteNames).length) {
      // Kit-defined rows, ordered like DRUM_ROWS where possible (kick/snare first)
      const order = new Map(DRUM_ROWS.map((r, i) => [r.note, i]));
      return Object.entries(noteNames)
        .map(([n, label]) => ({ note: Number(n), label }))
        .sort((a, b) => (order.get(a.note) ?? 100 + a.note) - (order.get(b.note) ?? 100 + b.note));
    }
    return DRUM_ROWS.filter((r) => !availableNotes || availableNotes.has(r.note));
  }, [availableNotes, noteNames]);
  const hits = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of region.notes) {
      if (n.start % STEP !== 0) continue;
      m.set(`${n.pitch}:${n.start / STEP}`, n.velocity);
    }
    return m;
  }, [region.notes]);

  const toggle = (note: number, step: number, e: React.MouseEvent) => {
    const key = `${note}:${step}`;
    const vel = e.shiftKey ? 127 : e.altKey ? 60 : 100;
    const existing = hits.get(key);
    let notes = region.notes.filter((n) => !(n.pitch === note && n.start === step * STEP));
    if (existing === undefined || (existing !== vel && (e.shiftKey || e.altKey))) {
      notes = [...notes, { id: newId('n'), pitch: note, start: step * STEP, length: STEP, velocity: vel }];
      s.engine.auditionNote(track.id, note, vel);
    }
    s.store.exec(existing === undefined ? 'Add drum hit' : 'Remove drum hit', (p) => ops.setNotes(p, region.id, notes));
  };

  return (
    <div className="daw-scroll h-full overflow-auto p-2" data-testid="step-sequencer">
      <table className="border-separate border-spacing-0.5">
        <tbody>
          {rows.map((r) => (
            <tr key={r.note}>
              <th scope="row" className="sticky left-0 z-10 bg-slate-900 pr-2 text-right text-xs font-medium text-slate-300">
                <button type="button" className="hover:text-amber-300" title={gmDrumName(r.note) ?? r.label} onClick={() => s.engine.auditionNote(track.id, r.note)}>
                  {r.label}
                </button>
              </th>
              {Array.from({ length: steps }, (_, i) => {
                const v = hits.get(`${r.note}:${i}`);
                const beatStart = i % 4 === 0;
                const barStart = i % stepsPerBar === 0;
                return (
                  <td key={i} className={cx(barStart && i > 0 && 'pl-1.5')}>
                    <button
                      type="button"
                      aria-label={`${r.label} step ${i + 1}${v ? ' on' : ' off'}`}
                      aria-pressed={!!v}
                      onClick={(e) => toggle(r.note, i, e)}
                      className={cx(
                        'block h-6 w-6 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-sky-400',
                        v ? '' : beatStart ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-800 hover:bg-slate-700',
                      )}
                      style={v ? { background: track.color, opacity: 0.45 + (v / 127) * 0.55 } : undefined}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">Click a square to add a hit. Shift-click = loud (accent), Alt-click = soft. Each square is a 16th note.</p>
    </div>
  );
}
