import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';
// The main site's Staff Composer notation, palette, sounds and music math (see src/types/main.d.ts)
import { ScoreRenderer } from '@main/components/ScoreRenderer';
import { RhythmicPalette } from '@main/components/RhythmicPalette';
import { soundEngine } from '@main/audio/soundEngine';
import { createEmptyMeasure } from '@main/data/templates';
import { cleanMeasureRests, getMeasureCapacity, insertNoteAtBeat } from '@main/utils/musicMath';
import { useRememberedState } from '../../hooks/useRememberedState';

/**
 * Staff Composer Lite: a quick, projector-sized version of the Staff Composer on mrarthurmusic.com
 * for showing examples. One staff, two bars to start (add more as needed), the main site's
 * advanced note tools and sounds, and big note-name and counting labels for teaching.
 */

type Score = any;
type Pitch = any;

const SOUNDS = [
  { id: 'piano_treble', name: 'Piano' },
  { id: 'xylophone', name: 'Xylophone' },
  { id: 'glockenspiel', name: 'Glockenspiel' },
  { id: 'recorder', name: 'Recorder' },
  { id: 'flute', name: 'Flute' },
  { id: 'violin', name: 'Violin' },
  { id: 'voice_oohs', name: 'Voices' }
];
const TIME_SIGNATURES: [number, number][] = [[4, 4], [3, 4], [2, 4], [6, 8]];
const LABEL_MODES = [
  { id: 'off', name: 'No note names' },
  { id: 'letters', name: 'Letter names' },
  { id: 'solfege_movable', name: 'Solfège (movable do)' },
  { id: 'solfege_fixed', name: 'Solfège (fixed do)' },
  { id: 'scale_degrees', name: 'Scale numbers' }
];
const COUNTING_MODES = [
  { id: 'off', name: 'No counting' },
  { id: 'numbers', name: 'Counting (1 + 2 +)' },
  { id: 'kodaly', name: 'Kodály (ta, ti-ti)' }
];
const BIG_LABELS = 1.9;
const HISTORY_LIMIT = 60;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function blankScore(timeSignature: [number, number] = [4, 4], clef: 'treble' | 'bass' = 'treble', instrumentId = 'piano_treble'): Score {
  return {
    id: 'score_lite',
    title: 'Example',
    composer: '',
    tempo: 96,
    timeSignature,
    keySignature: 'C',
    tracks: [
      {
        id: 'track_lite',
        name: SOUNDS.find((s) => s.id === instrumentId)?.name || 'Piano',
        instrumentId,
        clef,
        volume: 0.9,
        muted: false,
        soloed: false,
        measures: [createEmptyMeasure(timeSignature), createEmptyMeasure(timeSignature)]
      }
    ]
  };
}

export const StaffComposerLite: React.FC = () => {
  const [score, setScore] = useRememberedState<Score>('staffLite.score', () => blankScore());
  const [labelMode, setLabelMode] = useRememberedState('staffLite.labels', 'letters');
  const [countingMode, setCountingMode] = useRememberedState('staffLite.counting', 'off');
  const [colors, setColors] = useRememberedState('staffLite.colors', false);
  const [history, setHistory] = useState<Score[]>([score]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selection, setSelection] = useState<any>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isRestMode, setIsRestMode] = useState(false);
  const [activeDuration, setActiveDuration] = useState(0.25);
  const [isDotted, setIsDotted] = useState(false);
  const [isTied, setIsTied] = useState(false);
  const [isTriplet, setIsTriplet] = useState(false);
  const [activeAccidental, setActiveAccidental] = useState<any>(null);
  const [activeArticulation, setActiveArticulation] = useState<any>(null);
  const [activeDynamic, setActiveDynamic] = useState<any>(null);
  const [uiMode, setUiMode] = useState<'simple' | 'standard' | 'advanced'>('advanced');

  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState<{ measureIndex: number; beatFraction: number } | null>(null);
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());

  const track = score.tracks[0];

  // ---- history ----

  const pushScore = useCallback(
    (next: Score) => {
      setScore(next);
      setHistory((h) => [...h.slice(Math.max(0, historyIndex + 1 - HISTORY_LIMIT), historyIndex + 1), next]);
      setHistoryIndex((i) => Math.min(i + 1, HISTORY_LIMIT));
    },
    [historyIndex, setScore]
  );
  const undo = () => {
    if (historyIndex === 0) return;
    setHistoryIndex(historyIndex - 1);
    setScore(history[historyIndex - 1]);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex(historyIndex + 1);
    setScore(history[historyIndex + 1]);
  };

  /** Changes the selected note in Select mode; returns false if nothing is selected. */
  const editSelected = (change: (item: any) => void) => {
    if (!isSelectMode || !selection || selection.itemIndex < 0) return false;
    const next = clone(score);
    const measure = next.tracks[0].measures[selection.measureIndex];
    const item = measure?.items[selection.itemIndex];
    if (!item) return false;
    change(item);
    measure.items = cleanMeasureRests(measure.items, getMeasureCapacity(next.timeSignature));
    pushScore(next);
    return true;
  };

  // ---- note entry (adapted from the main Staff Composer) ----

  const handleNoteInsertOrUpdate = (
    trackIndex: number,
    measureIndex: number,
    itemIndex: number,
    pitch?: Pitch,
    targetBeat?: number,
    isDragUpdate?: boolean,
    originalPitch?: Pitch
  ) => {
    const next = clone(score);
    const measure = next.tracks[trackIndex]?.measures[measureIndex];
    if (!measure) return;
    const capacity = getMeasureCapacity(next.timeSignature);
    const existing = measure.items[itemIndex];

    // Dragging or (in Select mode) clicking an existing note changes its pitch / adds a chord tone
    if ((isDragUpdate || isSelectMode) && existing?.type === 'note' && pitch) {
      const pitches: Pitch[] = existing.pitches?.length ? existing.pitches : existing.pitch ? [existing.pitch] : [];
      const same = (a: Pitch, b: Pitch) => a.step === b.step && a.octave === b.octave;
      if (isDragUpdate) {
        if (originalPitch && pitches.length > 1) {
          let replaced = false;
          existing.pitches = pitches
            .map((p) => (!replaced && same(p, originalPitch) ? ((replaced = true), pitch) : p))
            .filter((p, i, all) => all.findIndex((x) => same(x, p)) === i);
        } else {
          existing.pitches = [pitch];
        }
      } else {
        existing.pitches = pitches.some((p) => same(p, pitch)) ? [pitch] : [...pitches, pitch];
      }
      existing.pitch = existing.pitches[0];
      pushScore(next);
      return;
    }

    const newItem = {
      id: 'n_' + Math.random().toString(36).substring(2, 9),
      type: isRestMode || !pitch ? 'rest' : 'note',
      pitch: isRestMode ? undefined : pitch,
      pitches: isRestMode || !pitch ? undefined : [pitch],
      duration: activeDuration,
      isDotted,
      isTied,
      isTriplet,
      articulation: isRestMode ? null : activeArticulation,
      dynamic: isRestMode ? null : activeDynamic
    };
    let beat = targetBeat;
    if (beat === undefined) {
      beat = 0;
      for (let i = 0; i < itemIndex && i < measure.items.length; i++) {
        const it = measure.items[i];
        let d = it.isDotted ? it.duration * 1.5 : it.duration;
        if (it.isTriplet) d = (d * 2) / 3;
        beat += d;
      }
    }
    measure.items = insertNoteAtBeat(measure.items, newItem, beat, capacity);
    pushScore(next);
    if (activeDynamic) setActiveDynamic(null);
    const idx = measure.items.findIndex((it: any) => it.id === newItem.id);
    setSelection({ trackIndex, measureIndex, itemIndex: Math.max(0, idx) });
  };

  const deleteSelected = () => {
    if (!selection) return;
    const next = clone(score);
    const t = next.tracks[0];
    if (selection.itemIndex === -1) {
      // A whole measure: clear it (or remove it if there's more than one and it's empty)
      const m = t.measures[selection.measureIndex];
      const isEmpty = m?.items.every((it: any) => it.type === 'rest');
      if (isEmpty && t.measures.length > 1) {
        t.measures.splice(selection.measureIndex, 1);
        setSelection(null);
      } else {
        t.measures[selection.measureIndex] = createEmptyMeasure(next.timeSignature);
      }
      pushScore(next);
      return;
    }
    const measure = t.measures[selection.measureIndex];
    const item = measure?.items[selection.itemIndex];
    if (!item || item.type !== 'note') return;
    if (item.pitches?.length > 1) {
      item.pitches.pop();
      item.pitch = item.pitches[0];
    } else {
      Object.assign(item, { type: 'rest', pitch: undefined, pitches: undefined, isTied: false });
      measure.items = cleanMeasureRests(measure.items, getMeasureCapacity(next.timeSignature));
    }
    pushScore(next);
  };

  const addMeasure = () => {
    const next = clone(score);
    next.tracks[0].measures.push(createEmptyMeasure(next.timeSignature));
    pushScore(next);
  };

  const removeLastMeasure = () => {
    if (track.measures.length <= 1) return;
    const next = clone(score);
    next.tracks[0].measures.pop();
    pushScore(next);
    setSelection(null);
  };

  const reset = (timeSignature = score.timeSignature, clef = track.clef, instrumentId = track.instrumentId) => {
    stop();
    pushScore(blankScore(timeSignature, clef, instrumentId));
    setSelection(null);
  };

  const preview = (pitch: Pitch | Pitch[]) => soundEngine.playNotePreview(pitch, track.instrumentId, 0.4, score.keySignature);

  // ---- playback ----

  function stop() {
    soundEngine.stopPlayback();
    setIsPlaying(false);
    setPlayhead(null);
    setPlayingIds(new Set());
  }

  const play = async () => {
    if (isPlaying) return stop();
    await soundEngine.initContext();
    setIsPlaying(true);
    soundEngine.setMetronome(false);
    soundEngine.playScore(
      score,
      (measureIndex: number, beatFraction: number) => setPlayhead({ measureIndex, beatFraction }),
      (noteId: string) => {
        setPlayingIds((prev) => new Set([...prev, noteId]));
        setTimeout(() => setPlayingIds((prev) => { const n = new Set(prev); n.delete(noteId); return n; }), 200);
      },
      () => {
        setIsPlaying(false);
        setPlayhead(null);
        setPlayingIds(new Set());
      },
      null,
      false
    );
  };

  useEffect(() => () => soundEngine.stopPlayback(), []);

  // ---- make the staff as big as the space allows ----

  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.2);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const svg = el.querySelector('#staff-composer-score-svg');
      const natural = Number(svg?.getAttribute('width')) || 1100;
      const available = el.clientWidth - 48; // the renderer's own padding and border
      setZoom(Math.max(0.5, Math.min(2.4, available / natural)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [score.timeSignature, score.keySignature]);

  // ---- controls ----

  const select = 'text-sm font-semibold px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500';
  const measures = track.measures.length;

  return (
    <div className="space-y-3" style={{ fontFamily: "'Fredoka', system-ui, sans-serif" }}>
      {/* Teaching labels and sound */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={play}
          className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 text-white shadow ${isPlaying ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Tempo
          <input
            type="range"
            min={50}
            max={180}
            value={score.tempo}
            onChange={(e) => setScore({ ...score, tempo: Number(e.target.value) })}
            className="w-24"
            aria-label="Tempo"
          />
          <span className="w-8 tabular-nums">{score.tempo}</span>
        </label>
        <select value={track.instrumentId} onChange={(e) => pushScore({ ...score, tracks: [{ ...track, instrumentId: e.target.value, name: SOUNDS.find((s) => s.id === e.target.value)?.name }] })} aria-label="Sound" className={select}>
          {SOUNDS.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select value={track.clef} onChange={(e) => pushScore({ ...score, tracks: [{ ...track, clef: e.target.value }] })} aria-label="Clef" className={select}>
          <option value="treble">Treble clef</option>
          <option value="bass">Bass clef</option>
        </select>
        <select
          value={score.timeSignature.join('/')}
          onChange={(e) => {
            const ts = e.target.value.split('/').map(Number) as [number, number];
            if (track.measures.some((m: any) => m.items.some((it: any) => it.type === 'note')) && !confirm('Changing the time signature clears the staff. Continue?')) return;
            reset(ts);
          }}
          aria-label="Time signature"
          className={select}
        >
          {TIME_SIGNATURES.map((ts) => (
            <option key={ts.join('/')} value={ts.join('/')}>{ts.join('/')} time</option>
          ))}
        </select>
        <span className="w-px h-7 bg-slate-300 mx-1" aria-hidden />
        <select value={labelMode} onChange={(e) => setLabelMode(e.target.value)} aria-label="Note names" className={select}>
          {LABEL_MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select value={countingMode} onChange={(e) => setCountingMode(e.target.value)} aria-label="Rhythm counting" className={select}>
          {COUNTING_MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={colors} onChange={(e) => setColors(e.target.checked)} />
          Boomwhacker colors
        </label>
      </div>

      {/* The main Staff Composer's note tools */}
      <RhythmicPalette
        uiMode={uiMode}
        onChangeUiMode={setUiMode}
        onReset={() => reset()}
        onAddMeasure={addMeasure}
        isSelectMode={isSelectMode}
        onToggleSelectMode={() => setIsSelectMode((v) => !v)}
        activeDuration={activeDuration}
        onChangeDuration={(d: number) => {
          setActiveDuration(d);
          setIsRestMode(false);
          editSelected((item) => (item.duration = d));
        }}
        isRestMode={isRestMode}
        onToggleRestMode={() => setIsRestMode((v) => !v)}
        isDotted={isDotted}
        onToggleDotted={() => editSelected((item) => (item.isDotted = !item.isDotted)) || setIsDotted((v) => !v)}
        isTied={isTied}
        onToggleTied={() => editSelected((item) => (item.isTied = !item.isTied)) || setIsTied((v) => !v)}
        isTriplet={isTriplet}
        onToggleTriplet={() => editSelected((item) => (item.isTriplet = !item.isTriplet)) || setIsTriplet((v) => !v)}
        activeAccidental={activeAccidental}
        onChangeAccidental={(a: any) => {
          setActiveAccidental(a);
          editSelected((item) => {
            if (item.type !== 'note') return;
            item.pitches = (item.pitches || [item.pitch]).map((p: any) => ({ ...p, accidental: a }));
            item.pitch = item.pitches[0];
          });
        }}
        activeArticulation={activeArticulation}
        onChangeArticulation={(art: any) => {
          setActiveArticulation(art);
          editSelected((item) => item.type === 'note' && (item.articulation = art));
        }}
        activeDynamic={activeDynamic}
        onChangeDynamic={(dyn: any) => {
          setActiveDynamic(dyn);
          editSelected((item) => item.type === 'note' && (item.dynamic = dyn));
        }}
        onDeleteSelected={deleteSelected}
        selection={selection}
        hasClipboard={false}
        onCopyMeasure={() => {}}
        onPasteMeasure={() => {}}
        onMoveMeasureLeft={() => {}}
        onMoveMeasureRight={() => {}}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={undo}
        onRedo={redo}
        onOpenHelp={() => {}}
      />

      {/* The staff, sized to fill the space */}
      <div ref={frame} className="w-full">
        <ScoreRenderer
          score={score}
          selection={selection}
          onSelect={(s: any) => setSelection(s)}
          onNoteInsertOrUpdate={handleNoteInsertOrUpdate}
          onPlayPreview={preview}
          onDeleteSelected={deleteSelected}
          onQuickAccidental={(a: any) => setActiveAccidental(a)}
          isSelectMode={isSelectMode}
          isRestMode={isRestMode}
          uiMode={uiMode}
          viewLayout="vertical"
          scoreZoom={zoom}
          activeDuration={activeDuration}
          activeAccidental={activeAccidental}
          activeDotted={isDotted}
          activeTriplet={isTriplet}
          showPitchNames={labelMode !== 'off'}
          noteLabelMode={labelMode}
          countingMode={countingMode}
          boomwhackerColors={colors}
          showBeatCounters={false}
          playheadPosition={playhead}
          activePlayingNoteIds={playingIds}
          labelScale={BIG_LABELS}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={addMeasure} className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-1.5 shadow">
          <Plus className="w-4 h-4" />
          Add measure
        </button>
        {measures > 1 && (
          <button type="button" onClick={removeLastMeasure} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold flex items-center gap-1.5">
            <Minus className="w-4 h-4" />
            Remove last measure
          </button>
        )}
        <button
          type="button"
          onClick={() => confirm('Clear the staff back to two empty measures?') && reset()}
          className="px-3 py-2 rounded-xl text-slate-500 hover:text-rose-600 text-sm font-semibold flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Start over
        </button>
        <span className="text-xs text-slate-400">{measures} measure{measures === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
};
