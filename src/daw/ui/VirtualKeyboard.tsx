import { Minus, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { addTrack } from './actions';
import { cx } from './controls';
import { useStudio, useSubscribe, useUi } from './studio';

/**
 * On-screen piano (bottom panel "Keyboard", N or Ctrl+K). Plays the selected instrument
 * track like a MIDI keyboard would, and records while recording. Also shows which MIDI
 * controllers are connected and the computer-keyboard letters.
 */

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const LETTERS: Record<number, string> = { 0: 'A', 1: 'W', 2: 'S', 3: 'E', 4: 'D', 5: 'F', 6: 'T', 7: 'G', 8: 'Y', 9: 'H', 10: 'U', 11: 'J', 12: 'K', 13: 'O', 14: 'L' };
const OCTAVES = 3;

export function VirtualKeyboard() {
  const s = useStudio();
  useSubscribe(s.live.subscribe, s.live.snapshot);
  useUi((u) => u.selectedTrack);
  const recording = useUi((u) => u.recording);
  const [velocity, setVelocity] = useState(100);
  const pointers = useRef(new Map<number, number>());
  const target = s.live.target();
  const octave = s.live.octave;
  const low = 12 * octave; // one octave below the computer-key octave, so it sits in the middle
  const typedC = 12 * (octave + 1);

  const press = (id: number, pitch: number) => {
    const prev = pointers.current.get(id);
    if (prev === pitch) return;
    if (prev !== undefined) s.live.noteOff(prev);
    pointers.current.set(id, pitch);
    s.live.noteOn(pitch, velocity);
  };
  const lift = (id: number) => {
    const prev = pointers.current.get(id);
    if (prev === undefined) return;
    pointers.current.delete(id);
    s.live.noteOff(prev);
  };

  const whites: number[] = [];
  for (let o = 0; o < OCTAVES; o++) for (const w of WHITE) whites.push(low + o * 12 + w);
  whites.push(low + OCTAVES * 12);
  const keyProps = (pitch: number) => ({
    'data-pitch': pitch,
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); // let the finger slide to other keys
      press(e.pointerId, pitch);
    },
    onPointerEnter: (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId)) press(e.pointerId, pitch);
    },
  });
  const label = (pitch: number) => {
    const typed = pitch - typedC;
    return LETTERS[typed];
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2" onPointerUp={(e) => lift(e.pointerId)} onPointerCancel={(e) => lift(e.pointerId)} onPointerLeave={(e) => lift(e.pointerId)}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
        {target ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: target.color }} />
            Playing <b className="text-slate-100">{target.name}</b>
            {recording && s.live.recordingMidi && <span className="rounded bg-rose-500 px-1.5 font-bold text-white">REC</span>}
          </span>
        ) : (
          <button type="button" className="rounded-lg bg-amber-400 px-2 py-1 font-semibold text-slate-950" onClick={() => s.ui.set({ selectedTrack: addTrack(s, 'instrument', 'piano', 'Piano') })}>
            + Add a piano track to play
          </button>
        )}
        <span className="flex items-center gap-1">
          Octave
          <button type="button" aria-label="Octave down (Z)" title="Octave down (Z)" className="rounded bg-slate-800 p-1 hover:bg-slate-700" onClick={() => s.live.setOctave(octave - 1)}>
            <Minus size={12} />
          </button>
          <span className="w-6 text-center font-mono">C{octave}</span>
          <button type="button" aria-label="Octave up (X)" title="Octave up (X)" className="rounded bg-slate-800 p-1 hover:bg-slate-700" onClick={() => s.live.setOctave(octave + 1)}>
            <Plus size={12} />
          </button>
        </span>
        <label className="flex items-center gap-1" title="How hard the on-screen keys are played">
          Velocity
          <input type="range" min={20} max={127} value={velocity} onChange={(e) => setVelocity(Number(e.target.value))} className="daw-range w-20" aria-label="Velocity" />
        </label>
        <button
          type="button"
          aria-pressed={s.live.sustain}
          title="Sustain pedal: notes keep ringing until you turn it off (a MIDI sustain pedal works too)"
          className={cx('rounded-lg px-2 py-1 font-semibold', s.live.sustain ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}
          onClick={() => s.live.setSustain(!s.live.sustain)}
        >
          Sustain
        </button>
        <span className="text-slate-500">Computer keys: A–L play, W E T Y U O = black keys, Z / X = octave</span>
        <MidiStatus />
      </div>
      <div className="relative min-h-[80px] flex-1 select-none touch-none" role="group" aria-label="Piano keyboard">
        <div className="flex h-full gap-px">
          {whites.map((p) => (
            <button
              key={p}
              type="button"
              tabIndex={-1}
              aria-label={`Note ${p}`}
              {...keyProps(p)}
              className={cx('relative flex flex-1 flex-col items-center justify-end rounded-b-md pb-1 text-[10px] font-semibold transition-colors', s.live.active.has(p) ? 'bg-amber-300 text-slate-900' : 'bg-slate-100 text-slate-500 hover:bg-white')}
            >
              {label(p) && <span className="mb-0.5 rounded bg-slate-300/70 px-1 text-slate-700">{label(p)}</span>}
              {p % 12 === 0 && <span>C{p / 12 - 1}</span>}
            </button>
          ))}
        </div>
        {whites.slice(0, -1).map((p, i) => {
          if ([4, 11].includes(p % 12)) return null; // no black key after E and B
          const b = p + 1;
          return (
            <button
              key={b}
              type="button"
              tabIndex={-1}
              aria-label={`Note ${b}`}
              {...keyProps(b)}
              className={cx('absolute top-0 z-10 flex h-[60%] flex-col items-center justify-end rounded-b-md pb-1 text-[10px] font-semibold', s.live.active.has(b) ? 'bg-amber-400 text-slate-900' : 'bg-slate-900 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700')}
              style={{ left: `calc(${((i + 1) / whites.length) * 100}% - ${(0.6 / whites.length) * 50}%)`, width: `${(0.6 / whites.length) * 100}%` }}
            >
              {label(b)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MidiStatus() {
  const s = useStudio();
  const { devices, midiError } = s.live;
  if (midiError) return <span className="ml-auto text-amber-300/80">{midiError}</span>;
  if (!devices.length) return <span className="ml-auto text-slate-500" title="Plug in a USB or Bluetooth MIDI keyboard or pad controller; it will appear here.">No MIDI keyboard connected</span>;
  return (
    <span className="ml-auto flex items-center gap-1 text-emerald-300" title={devices.map((d) => d.name).join(', ')}>
      <span className="h-2 w-2 rounded-full bg-emerald-400" />
      MIDI: {devices.length === 1 ? devices[0].name : `${devices.length} devices`}
    </span>
  );
}
