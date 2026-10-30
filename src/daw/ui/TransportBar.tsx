import {
  Circle,
  Magnet,
  Maximize2,
  MousePointer2,
  Pause,
  Pencil,
  Play,
  Repeat,
  Scissors,
  SkipBack,
  Square,
  Timer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatBarBeat, formatSeconds, GRID_DIVISIONS, tickToBarBeat, ticksToSeconds } from '../model/time';
import { GridDivision } from '../model/types';
import * as A from './actions';
import { cx, IconButton } from './controls';
import { useEngineState, useProject, useStudio, useUi } from './studio';

const TIME_SIGS: [number, number][] = [
  [4, 4],
  [3, 4],
  [2, 4],
  [5, 4],
  [6, 8],
  [7, 8],
  [9, 8],
  [12, 8],
];

const GRID_LABEL: Record<GridDivision, string> = {
  '1/1': '1 bar',
  '1/2': '1/2',
  '1/4': '1/4 (beat)',
  '1/8': '1/8',
  '1/16': '1/16',
  '1/32': '1/32',
  '1/4T': '1/4 triplet',
  '1/8T': '1/8 triplet',
  '1/16T': '1/16 triplet',
};

export function TransportBar() {
  const s = useStudio();
  const engineState = useEngineState();
  const playing = engineState.startsWith('playing');
  const recording = useUi((u) => u.recording);
  const beginner = useUi((u) => u.beginner);
  const tool = useUi((u) => u.tool);
  const bpm = useProject((p) => p.tempoMap[0].bpm);
  const sig = useProject((p) => p.timeSigMap[0].sig);
  const loopOn = useProject((p) => p.loop.enabled);
  const metronome = useProject((p) => p.editor.metronome);
  const snapOn = useProject((p) => p.editor.snap);
  const grid = useProject((p) => p.editor.grid);
  const countIn = useProject((p) => p.editor.countInBars);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-800 bg-slate-900/95 px-3 py-2" role="toolbar" aria-label="Transport">
      <div className="flex items-center gap-1.5 rounded-2xl bg-slate-950/70 p-1 ring-1 ring-slate-800">
        <IconButton size="lg" label="Back to start" shortcut="Home" onClick={() => A.returnToStart(s)}>
          <SkipBack size={20} />
        </IconButton>
        <IconButton size="lg" label="Stop" onClick={() => A.stop(s)}>
          <Square size={19} />
        </IconButton>
        <IconButton size="lg" label={playing ? 'Pause' : 'Play'} shortcut="Space" tone="play" active={playing && !recording} onClick={() => A.togglePlay(s)} className="w-20" testId="play">
          {playing ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
        </IconButton>
        <IconButton
          size="lg"
          label={recording ? 'Stop recording' : 'Record (microphone into an audio track, or notes into a selected instrument track)'}
          shortcut="R"
          tone="record"
          active={recording}
          onClick={() => (recording ? void A.stopRecording(s) : void A.startRecording(s))}
          className="w-14"
        >
          <Circle size={20} fill="currentColor" />
        </IconButton>
        <IconButton size="lg" label={loopOn ? 'Loop on' : 'Loop off'} shortcut="L" active={loopOn} onClick={() => A.toggleLoop(s)}>
          <Repeat size={20} />
        </IconButton>
        <IconButton size="lg" label={metronome ? 'Metronome on' : 'Metronome off'} shortcut="K" active={metronome} onClick={() => A.toggleMetronome(s)}>
          <Timer size={20} />
        </IconButton>
      </div>

      <PositionDisplay />

      <div className="flex items-center gap-2">
        <TempoField bpm={bpm} />
        <button
          type="button"
          className="rounded-lg bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          title="Tap tempo: tap this button in time with the music (3+ taps)"
          onClick={() => A.tapTempo(s)}
        >
          TAP
        </button>
        <label className="flex items-center gap-1 text-xs text-slate-400" title="Time signature: how many beats are in each bar">
          <span className="sr-only">Time signature</span>
          <select
            className="h-8 rounded-lg bg-slate-800 px-1 font-mono text-sm text-slate-100"
            value={`${sig.numerator}/${sig.denominator}`}
            onChange={(e) => {
              const [n, d] = e.target.value.split('/').map(Number);
              A.setTimeSig(s, n, d);
            }}
          >
            {TIME_SIGS.map(([n, d]) => (
              <option key={`${n}/${d}`} value={`${n}/${d}`}>
                {n}/{d}
              </option>
            ))}
          </select>
        </label>
        {!beginner && (
          <label className="flex items-center gap-1 text-xs text-slate-400" title="Count-in bars before recording">
            Count-in
            <select
              className="h-8 rounded-lg bg-slate-800 px-1 text-sm text-slate-100"
              value={countIn}
              onChange={(e) => s.store.exec('Count-in', (p) => ({ ...p, editor: { ...p.editor, countInBars: Number(e.target.value) } }))}
            >
              <option value={0}>Off</option>
              <option value={1}>1 bar</option>
              <option value={2}>2 bars</option>
            </select>
          </label>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 flex items-center gap-0.5 rounded-lg bg-slate-800/60 p-0.5" role="radiogroup" aria-label="Edit tool">
          <IconButton label="Select / move tool" shortcut="V" active={tool === 'pointer'} onClick={() => s.ui.set({ tool: 'pointer' })}>
            <MousePointer2 size={15} />
          </IconButton>
          <IconButton label="Split (scissors) tool" shortcut="B" active={tool === 'split'} onClick={() => s.ui.set({ tool: 'split' })}>
            <Scissors size={15} />
          </IconButton>
          <IconButton label="Draw MIDI clip tool" shortcut="P" active={tool === 'draw'} onClick={() => s.ui.set({ tool: 'draw' })}>
            <Pencil size={15} />
          </IconButton>
        </div>
        <IconButton
          label={snapOn ? 'Snap to grid: on' : 'Snap to grid: off'}
          shortcut="G"
          active={snapOn}
          onClick={() => s.store.exec('Snap', (p) => ({ ...p, editor: { ...p.editor, snap: !p.editor.snap } }))}
        >
          <Magnet size={15} />
        </IconButton>
        <select
          aria-label="Grid size"
          title="Grid size: where clips and notes snap to"
          className="h-8 rounded-lg bg-slate-800 px-1 text-xs text-slate-100"
          value={grid}
          onChange={(e) => s.store.exec('Grid', (p) => ({ ...p, editor: { ...p.editor, grid: e.target.value as GridDivision } }))}
        >
          {GRID_DIVISIONS.map((g) => (
            <option key={g} value={g}>
              {GRID_LABEL[g]}
            </option>
          ))}
        </select>
        <IconButton label="Zoom out" shortcut="-" onClick={() => A.zoom(s, 1 / 1.25)}>
          <ZoomOut size={15} />
        </IconButton>
        <IconButton label="Zoom in" shortcut="=" onClick={() => A.zoom(s, 1.25)}>
          <ZoomIn size={15} />
        </IconButton>
        <IconButton label="Fit song to window" shortcut="F" onClick={() => A.fitProject(s)}>
          <Maximize2 size={15} />
        </IconButton>
      </div>
    </div>
  );
}

function TempoField({ bpm }: { bpm: number }) {
  const s = useStudio();
  const [draft, setDraft] = useState(String(bpm));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setDraft(String(bpm));
  }, [bpm, focus]);
  const commit = () => {
    const v = Number(draft);
    if (Number.isFinite(v) && v >= 20 && v <= 300) A.setTempo(s, v);
    else setDraft(String(bpm));
  };
  return (
    <label className="flex items-center gap-1" title="Tempo in beats per minute (BPM). Loops automatically follow the tempo.">
      <input
        aria-label="Tempo (BPM)"
        data-testid="tempo"
        inputMode="decimal"
        className="h-10 w-20 rounded-xl bg-slate-800 px-2 text-center font-mono text-lg font-semibold text-amber-300 outline-none focus:ring-2 focus:ring-amber-400"
        value={draft}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          commit();
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const v = Math.max(20, Math.min(300, bpm + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1)));
            A.setTempo(s, v);
          }
        }}
      />
      <span className="text-xs font-semibold text-slate-400">BPM</span>
    </label>
  );
}

/** Position readout updated from the audio clock (no React re-render per frame). */
function PositionDisplay() {
  const s = useStudio();
  const bars = useRef<HTMLSpanElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const [countIn, setCountIn] = useState(false);
  useEffect(() => {
    let raf = 0;
    let lastText = '';
    let lastCount = false;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const p = s.store.get();
      const tick = s.engine.currentTick();
      const ci = tick < 0;
      if (ci !== lastCount) {
        lastCount = ci;
        setCountIn(ci);
      }
      const t = formatBarBeat(tickToBarBeat(p.timeSigMap, Math.max(0, tick)));
      const sec = formatSeconds(ticksToSeconds(p.tempoMap, Math.max(0, tick)));
      const text = t + sec;
      if (text === lastText) return;
      lastText = text;
      if (bars.current) bars.current.textContent = t;
      if (time.current) time.current.textContent = sec;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [s]);
  return (
    <div
      className={cx('flex items-baseline gap-2 rounded-xl bg-slate-950 px-4 py-1.5 font-mono ring-1', countIn ? 'ring-rose-500' : 'ring-slate-800')}
      aria-live="off"
      title="Position: bar.beat.sixteenth and minutes:seconds"
    >
      <span ref={bars} className="min-w-[6rem] text-2xl font-semibold text-amber-300" data-testid="position">
        1.1.1
      </span>
      <span ref={time} className="text-sm text-slate-400">
        0:00.000
      </span>
      {countIn && <span className="text-xs font-bold text-rose-400">COUNT-IN</span>}
    </div>
  );
}
