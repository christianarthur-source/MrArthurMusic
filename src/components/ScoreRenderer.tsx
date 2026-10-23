import React, { useEffect, useMemo, useState } from 'react';
import {
  ClefType,
  CountingMode,
  InstrumentCategory,
  InstrumentDefinition,
  Measure,
  NoteDuration,
  NoteItem,
  NoteLabelMode,
  Pitch,
  Score,
  SelectionState,
  Track,
  UiMode,
  ViewLayout,
} from '../types/music';
import { INSTRUMENTS } from '../data/instruments';
import { soundEngine } from '../audio/soundEngine';
import { Search, X, Volume2, Check, Music } from 'lucide-react';
import {
  BOOMWHACKER_COLORS,
  FLAT_BASS_OFFSETS,
  FLAT_TREBLE_OFFSETS,
  getBeatCountingLabel,
  getFormattedPitchLabel,
  getItemDuration,
  getKeyAccidentalInfo,
  getLedgerLines,
  getMeasureCapacity,
  getPitchFromY,
  getPitchY,
  getScoreHeaderWidth,
  getSelectedMeasureIndices,
  LINE_SPACING,
  SHARP_BASS_OFFSETS,
  SHARP_TREBLE_OFFSETS,
  shiftPitchByDiatonicSteps,
  STAFF_HEIGHT,
  STAFF_TOP_Y,
  STEP_DIATONIC_OFFSET,
} from '../utils/musicMath';
import {
  AccentSymbol,
  BassClefSymbol,
  DynamicSymbol,
  EighthRestSymbol,
  FermataSymbol,
  FlatSymbol,
  HalfRestSymbol,
  MarcatoSymbol,
  NaturalSymbol,
  QuarterRestSymbol,
  SharpSymbol,
  SixteenthRestSymbol,
  StaccatoSymbol,
  StemFlagSymbol,
  TenutoSymbol,
  TrebleClefSymbol,
  TripletBracketSymbol,
  WholeRestSymbol,
} from './NotationSymbols';

interface ScoreRendererProps {
  score: Score;
  selection: SelectionState | null;
  onSelect: (state: SelectionState | null, isShiftKey?: boolean) => void;
  onNoteInsertOrUpdate: (
    trackIndex: number,
    measureIndex: number,
    itemIndex: number,
    pitch: Pitch,
    targetBeat?: number,
    isDragUpdate?: boolean,
    originalPitch?: Pitch
  ) => void;
  onPlayPreview: (pitch: Pitch | Pitch[], instrumentId: any) => void;
  onShiftSelectedPitch?: (diatonicDelta: number) => void;
  onTransposeMeasure?: (trackIndex: number, measureIndices: number[], diatonicDelta: number) => void;
  onDeleteSelected?: () => void;
  onQuickAccidental?: (acc: 'sharp' | 'flat' | 'natural' | null) => void;
  isSelectMode: boolean;
  isRestMode?: boolean;
  uiMode?: UiMode;
  viewLayout?: ViewLayout;
  scoreZoom?: number;
  activeDuration: NoteDuration;
  activeAccidental: 'sharp' | 'flat' | 'natural' | null;
  activeDotted: boolean;
  activeTriplet?: boolean;
  showPitchNames: boolean;
  noteLabelMode?: NoteLabelMode;
  countingMode?: CountingMode;
  boomwhackerColors: boolean;
  showBeatCounters: boolean;
  playheadPosition: { measureIndex: number; beatFraction: number } | null;
  activePlayingNoteIds: Set<string>;
  onUpdateTrack?: (trackIndex: number, updates: Partial<Track>) => void;
  isBigStaff?: boolean;
  bigStaffMeasureIndex?: number;
  onBigStaffMeasureChange?: (measureIndex: number) => void;
  onBigStaffAddMeasure?: () => void;
}

interface BeamGroupNote {
  item: NoteItem;
  itemIndex: number;
  x: number;
  noteY: number;
  topNoteY: number;
  bottomNoteY: number;
  avgDiatonic: number;
  stemX: number;
  duration: NoteDuration;
  beatIndex: number;
}

interface BeamGroup {
  id: string;
  isStemDown: boolean;
  notes: BeamGroupNote[];
  beamY1: number;
  beamY2: number;
}

// Helper to identify drum / percussion tracks
export function isDrumTrack(track: Track): boolean {
  if (
    track.instrumentId === 'drum_kit' ||
    track.instrumentId === 'drum_808' ||
    track.instrumentId === 'drum_jazz' ||
    track.instrumentId === 'drum_latin'
  )
    return true;
  const drumPercussionIds = [
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
  ];
  if (drumPercussionIds.includes(track.instrumentId)) return true;
  const nameLower = (track.name || '').toLowerCase();
  return nameLower.includes('drum') || nameLower.includes('percussion') || nameLower.includes('cymb');
}

// Compute automatic rhythmic beaming for 8th and 16th notes (including multi-note chords on one stem) in a measure
function computeMeasureBeams(
  measure: Measure,
  layoutX: number,
  measureWidth: number,
  trackTopY: number,
  timeSignature: [number, number],
  clef: ClefType,
  isDrumTrack?: boolean,
  draggingItemIndex?: number | null,
  draggingPitch?: Pitch | null,
  measureDiatonicDelta?: number
): {
  beamGroups: BeamGroup[];
  beamedItemIndices: Set<number>;
  beamedStemDownMap: Map<number, boolean>;
} {
  const beamGroups: BeamGroup[] = [];
  const beamedItemIndices = new Set<number>();
  const beamedStemDownMap = new Map<number, boolean>();

  const capacity = getMeasureCapacity(timeSignature);
  let currentBeatOffset = 0;
  const beatGroupDuration = 0.25; // Group by quarter-note beat boundaries

  let currentGroupNotes: BeamGroupNote[] = [];

  measure.items.forEach((item, itemIndex) => {
    const itemDur = getItemDuration(item);
    const itemX = layoutX + 35 + (currentBeatOffset / capacity) * (measureWidth - 60);
    const beatIndex = Math.floor((currentBeatOffset + 0.0001) / beatGroupDuration);

    let rawPitches =
      draggingItemIndex === itemIndex && draggingPitch
        ? [draggingPitch]
        : item.pitches && item.pitches.length > 0
        ? item.pitches
        : item.pitch
        ? [item.pitch]
        : [];

    if (measureDiatonicDelta && measureDiatonicDelta !== 0 && rawPitches.length > 0) {
      rawPitches = rawPitches.map((p) => shiftPitchByDiatonicSteps(p, measureDiatonicDelta));
    }

    const isBeamable = item.type === 'note' && rawPitches.length > 0 && item.duration <= 0.125;

    if (isBeamable) {
      if (
        currentGroupNotes.length > 0 &&
        currentGroupNotes[0].beatIndex !== beatIndex
      ) {
        if (currentGroupNotes.length >= 2) {
          finalizeBeamGroup(
            currentGroupNotes,
            clef,
            beamGroups,
            beamedItemIndices,
            beamedStemDownMap,
            isDrumTrack
          );
        }
        currentGroupNotes = [];
      }

      const pitchYs = rawPitches.map((p) => trackTopY + getPitchY(p, clef));
      const topNoteY = Math.min(...pitchYs); // Smallest Y = highest notehead on staff
      const bottomNoteY = Math.max(...pitchYs); // Largest Y = lowest notehead on staff
      const diatonics = rawPitches.map((p) => p.octave * 7 + STEP_DIATONIC_OFFSET[p.step]);
      const avgDiatonic = diatonics.reduce((a, b) => a + b, 0) / diatonics.length;

      currentGroupNotes.push({
        item,
        itemIndex,
        x: itemX,
        noteY: pitchYs[0],
        topNoteY,
        bottomNoteY,
        avgDiatonic,
        stemX: itemX,
        duration: item.duration,
        beatIndex,
      });
    } else {
      if (currentGroupNotes.length >= 2) {
        finalizeBeamGroup(
          currentGroupNotes,
          clef,
          beamGroups,
          beamedItemIndices,
          beamedStemDownMap,
          isDrumTrack
        );
      }
      currentGroupNotes = [];
    }

    currentBeatOffset += itemDur;
  });

  if (currentGroupNotes.length >= 2) {
    finalizeBeamGroup(
      currentGroupNotes,
      clef,
      beamGroups,
      beamedItemIndices,
      beamedStemDownMap,
      isDrumTrack
    );
  }

  return { beamGroups, beamedItemIndices, beamedStemDownMap };
}

function finalizeBeamGroup(
  notes: BeamGroupNote[],
  clef: ClefType,
  beamGroups: BeamGroup[],
  beamedItemIndices: Set<number>,
  beamedStemDownMap: Map<number, boolean>,
  isDrumTrack?: boolean
) {
  const avgDiatonic = notes.reduce((sum, n) => sum + n.avgDiatonic, 0) / notes.length;
  const middleDiatonic = clef === 'treble' ? 34 : 22;
  const isStemDown = avgDiatonic >= middleDiatonic;

  const stemOffset = isDrumTrack ? 7.0 : 9.0;
  const updatedNotes = notes.map((n) => {
    beamedItemIndices.add(n.itemIndex);
    beamedStemDownMap.set(n.itemIndex, isStemDown);
    return {
      ...n,
      stemX: isStemDown ? n.x - stemOffset : n.x + stemOffset,
    };
  });

  const hasSixteenth = updatedNotes.some((n) => n.duration === 0.0625);
  const hasMultiNoteChord = updatedNotes.some((n) => n.bottomNoteY - n.topNoteY > 1);
  // Ensure the beam (and inner 16th beam) stays well clear of the highest/lowest notehead in every chord
  const minStemClearance = (hasSixteenth ? 48 : 42) + (hasMultiNoteChord ? 5 : 0);

  const firstNote = updatedNotes[0];
  const lastNote = updatedNotes[updatedNotes.length - 1];
  const spanX = lastNote.stemX - firstNote.stemX || 1;

  let beamY1: number;
  let beamY2: number;

  if (isStemDown) {
    // Stems go DOWN (larger Y): beam must be at least minStemClearance BELOW every chord's bottomNoteY
    const dy = Math.max(-16, Math.min(16, (lastNote.bottomNoteY - firstNote.bottomNoteY) * 0.35));
    beamY1 = Math.max(
      ...updatedNotes.map((n) => {
        const t = (n.stemX - firstNote.stemX) / spanX;
        return n.bottomNoteY + minStemClearance - t * dy;
      })
    );
    beamY2 = beamY1 + dy;
  } else {
    // Stems go UP (smaller Y): beam must be at least minStemClearance ABOVE every chord's topNoteY
    const dy = Math.max(-16, Math.min(16, (lastNote.topNoteY - firstNote.topNoteY) * 0.35));
    beamY1 = Math.min(
      ...updatedNotes.map((n) => {
        const t = (n.stemX - firstNote.stemX) / spanX;
        return n.topNoteY - minStemClearance - t * dy;
      })
    );
    beamY2 = beamY1 + dy;
  }

  beamGroups.push({
    id: 'bg_' + Math.random().toString(36).substring(2, 9),
    isStemDown,
    notes: updatedNotes,
    beamY1,
    beamY2,
  });
}

export const ScoreRenderer: React.FC<ScoreRendererProps> = ({
  score,
  selection,
  onSelect,
  onNoteInsertOrUpdate,
  onPlayPreview,
  onShiftSelectedPitch,
  onTransposeMeasure,
  onDeleteSelected,
  onQuickAccidental,
  isSelectMode,
  isRestMode = false,
  uiMode = 'standard',
  viewLayout = 'vertical',
  scoreZoom = 1,
  activeDuration,
  activeAccidental,
  activeDotted,
  activeTriplet = false,
  showPitchNames,
  noteLabelMode,
  countingMode = 'off',
  boomwhackerColors,
  showBeatCounters,
  playheadPosition,
  activePlayingNoteIds,
  onUpdateTrack,
  isBigStaff = false,
  bigStaffMeasureIndex = 0,
  onBigStaffMeasureChange,
  onBigStaffAddMeasure,
}) => {
  const isSimpleMode = uiMode === 'simple';
  // In Simple mode: always show Boomwhacker colors & note names.
  // In Standard & Advanced modes: regular black notes unless explicitly enabled in pedagogy bar.
  const effectiveBoomwhacker = isSimpleMode ? true : boomwhackerColors;
  const effectiveNoteLabelMode: NoteLabelMode =
    noteLabelMode && noteLabelMode !== 'off'
      ? noteLabelMode
      : isSimpleMode || showPitchNames
      ? 'letters'
      : 'off';
  const effectiveShowPitchNames = effectiveNoteLabelMode !== 'off';

  // Minimal Staff Instrument Dropdown state
  const [pickerTrackIndex, setPickerTrackIndex] = useState<number | null>(null);
  const [instrumentSearch, setInstrumentSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory | 'All'>('All');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  // Ghost note state
  const [ghostNote, setGhostNote] = useState<{
    trackIndex: number;
    measureIndex: number;
    targetItemIndex: number;
    targetBeat: number;
    pitch: Pitch;
    x: number;
    y: number;
    isDrum?: boolean;
  } | null>(null);

  // Dragging note state (supports dragging a single note or a specific notehead within a chord, or full measure transposition)
  const [draggingNote, setDraggingNote] = useState<{
    trackIndex: number;
    measureIndex: number;
    itemIndex: number;
    originalPitch: Pitch;
    currentPitch: Pitch;
    hasMoved?: boolean;
    isMeasureDrag?: boolean;
  } | null>(null);

  const activeTrackIndex =
    selection?.trackIndex !== undefined &&
    selection.trackIndex >= 0 &&
    selection.trackIndex < score.tracks.length
      ? selection.trackIndex
      : 0;

  const visibleTracks = useMemo(() => {
    if (isBigStaff) {
      const trk = score.tracks[activeTrackIndex] || score.tracks[0];
      return trk ? [{ track: trk, trackIndex: activeTrackIndex }] : [];
    }
    return score.tracks.map((track, trackIndex) => ({ track, trackIndex }));
  }, [isBigStaff, score.tracks, activeTrackIndex]);

  const measureCount = Math.max(...score.tracks.map((t) => t.measures.length), 1);
  const trackCount = visibleTracks.length;
  const activeBigStaffMeasure = Math.max(0, Math.min(bigStaffMeasureIndex, measureCount - 1));

  // Layout metrics: in 'horizontal' view, all measures are rendered on a single continuous row
  const MEASURES_PER_SYSTEM = isBigStaff ? 1 : viewLayout === 'horizontal' ? Math.max(1, measureCount) : 2;
  const MEASURE_WIDTH = isBigStaff ? 620 : 480;
  const BIG_STAFF_PEEK_WIDTH = isBigStaff ? 150 : 0;
  const HEADER_WIDTH = getScoreHeaderWidth(score.keySignature);
  const INSTRUMENT_LABEL_WIDTH = 104;
  const LEFT_PADDING = 8;
  const TRACK_SPACING = 150;
  const TOP_PADDING = 40;
  const SYSTEM_GAP = 55;

  const staffStartX = LEFT_PADDING + INSTRUMENT_LABEL_WIDTH;
  const systemCount = isBigStaff ? 1 : Math.ceil(measureCount / MEASURES_PER_SYSTEM);
  const singleSystemHeight = isBigStaff ? TRACK_SPACING + 30 : trackCount * TRACK_SPACING + 20;
  const totalSvgWidth = isBigStaff
    ? staffStartX + HEADER_WIDTH + MEASURE_WIDTH + BIG_STAFF_PEEK_WIDTH
    : staffStartX + HEADER_WIDTH + MEASURES_PER_SYSTEM * MEASURE_WIDTH + 30;
  const totalSvgHeight = isBigStaff
    ? TOP_PADDING + singleSystemHeight + 35
    : TOP_PADDING + systemCount * (singleSystemHeight + SYSTEM_GAP) + 20;

  // Compute bounding boxes for each measure
  const measureLayout = useMemo(() => {
    const map = new Map<
      number,
      { systemIndex: number; measureInSystem: number; x: number; systemTopY: number }
    >();

    if (isBigStaff) {
      for (let m = 0; m < measureCount; m++) {
        const x = staffStartX + HEADER_WIDTH + (m - activeBigStaffMeasure) * MEASURE_WIDTH;
        map.set(m, {
          systemIndex: 0,
          measureInSystem: m - activeBigStaffMeasure,
          x,
          systemTopY: TOP_PADDING,
        });
      }
    } else {
      for (let m = 0; m < measureCount; m++) {
        const systemIndex = Math.floor(m / MEASURES_PER_SYSTEM);
        const measureInSystem = m % MEASURES_PER_SYSTEM;
        const systemTopY = TOP_PADDING + systemIndex * (singleSystemHeight + SYSTEM_GAP);
        const x = staffStartX + HEADER_WIDTH + measureInSystem * MEASURE_WIDTH;

        map.set(m, { systemIndex, measureInSystem, x, systemTopY });
      }
    }

    return map;
  }, [
    measureCount,
    singleSystemHeight,
    staffStartX,
    MEASURES_PER_SYSTEM,
    HEADER_WIDTH,
    isBigStaff,
    activeBigStaffMeasure,
    MEASURE_WIDTH,
  ]);

  useEffect(() => {
    (window as any).__SCORE_MEASURE_LAYOUT__ = {
      layoutMap: measureLayout,
      measureWidth: MEASURE_WIDTH,
      systemHeight: singleSystemHeight,
      totalSvgWidth,
      totalSvgHeight,
      viewLayout,
    };
  }, [measureLayout, MEASURE_WIDTH, singleSystemHeight, totalSvgWidth, totalSvgHeight, viewLayout]);

  // Window-level mousemove and mouseup listeners while dragging a notehead so dragging
  // works smoothly even when moving above/below the staff or releasing outside the measure
  useEffect(() => {
    if (!draggingNote) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const svgEl = document.getElementById('staff-composer-score-svg');
      if (!svgEl) return;
      const layout = measureLayout.get(draggingNote.measureIndex);
      const track = score.tracks[draggingNote.trackIndex];
      if (!layout || !track) return;

      const rect = svgEl.getBoundingClientRect();
      const scaleY = rect.height > 0 ? totalSvgHeight / rect.height : 1;
      const svgY = (e.clientY - rect.top) * scaleY;
      const trackTopY = isBigStaff
        ? layout.systemTopY
        : layout.systemTopY + draggingNote.trackIndex * TRACK_SPACING;
      const staffRelativeY = svgY - trackTopY;

      const rawNewPitch = getPitchFromY(staffRelativeY, track.clef);
      const newPitch: Pitch = {
        ...rawNewPitch,
        accidental: draggingNote.originalPitch.accidental,
      };

      if (
        newPitch.step !== draggingNote.currentPitch.step ||
        newPitch.octave !== draggingNote.currentPitch.octave
      ) {
        setDraggingNote((prev) =>
          prev ? { ...prev, currentPitch: newPitch, hasMoved: true } : null
        );
        onPlayPreview(newPitch, track.instrumentId);
      }
    };

    const handleWindowMouseUp = () => {
      if (draggingNote.hasMoved) {
        if (draggingNote.isMeasureDrag && onTransposeMeasure) {
          const origDia =
            draggingNote.originalPitch.octave * 7 +
            (STEP_DIATONIC_OFFSET[draggingNote.originalPitch.step] ?? 0);
          const currDia =
            draggingNote.currentPitch.octave * 7 +
            (STEP_DIATONIC_OFFSET[draggingNote.currentPitch.step] ?? 0);
          const diatonicDelta = currDia - origDia;
          if (diatonicDelta !== 0) {
            const selectedMeasures = getSelectedMeasureIndices(selection);
            const measuresToTranspose = selectedMeasures.includes(draggingNote.measureIndex)
              ? selectedMeasures
              : [draggingNote.measureIndex];
            onTransposeMeasure(draggingNote.trackIndex, measuresToTranspose, diatonicDelta);
          }
        } else {
          onNoteInsertOrUpdate(
            draggingNote.trackIndex,
            draggingNote.measureIndex,
            draggingNote.itemIndex,
            draggingNote.currentPitch,
            undefined,
            true,
            draggingNote.originalPitch
          );
        }
      }
      setDraggingNote(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingNote, measureLayout, onNoteInsertOrUpdate, onPlayPreview, onTransposeMeasure, score.tracks, selection, totalSvgHeight]);

  // Handle staff mouse move for ghost note preview
  const handleStaffMouseMove = (
    e: React.MouseEvent<SVGElement>,
    trackIndex: number,
    measureIndex: number
  ) => {
    if (draggingNote) {
      setGhostNote(null);
      return;
    }

    const layout = measureLayout.get(measureIndex);
    if (!layout) return;

    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width > 0 ? totalSvgWidth / rect.width : 1;
    const scaleY = rect.height > 0 ? totalSvgHeight / rect.height : 1;
    const svgY = (e.clientY - rect.top) * scaleY;
    const svgX = (e.clientX - rect.left) * scaleX;

    const track = score.tracks[trackIndex];
    if (!track) return;

    const trackTopY = isBigStaff ? layout.systemTopY : layout.systemTopY + trackIndex * TRACK_SPACING;
    const staffRelativeY = svgY - trackTopY;

    // Insert mode ghost note
    if (isSelectMode) {
      setGhostNote(null);
      return;
    }

    if (staffRelativeY < -40 || staffRelativeY > STAFF_HEIGHT + 60) {
      setGhostNote(null);
      return;
    }

    const measure = track.measures[measureIndex];
    const items = measure?.items || [];
    const capacity = getMeasureCapacity(score.timeSignature);
    const startX = layout.x + 35;
    const spanX = MEASURE_WIDTH - 60;

    // If hovering directly over an existing notehead, hide the ghost note so the user can
    // cleanly click, select, or drag that existing note!
    let checkBeat = 0;
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      const itDur = getItemDuration(it);
      const itX = startX + (checkBeat / capacity) * spanX;
      checkBeat += itDur;
      if (it.type === 'note') {
        const itPitches =
          it.pitches && it.pitches.length > 0 ? it.pitches : it.pitch ? [it.pitch] : [];
        const isHoveringExistingNotehead = itPitches.some((p) => {
          const py = trackTopY + getPitchY(p, track.clef);
          return Math.abs(svgX - itX) <= 17 && Math.abs(svgY - py) <= 13;
        });
        if (isHoveringExistingNotehead) {
          setGhostNote(null);
          return;
        }
      }
    }

    const pitch = getPitchFromY(staffRelativeY, track.clef);
    if (activeAccidental) {
      pitch.accidental = activeAccidental;
    }

    let effDuration = activeDotted ? activeDuration * 1.5 : activeDuration;
    if (activeTriplet) {
      effDuration = (effDuration * 2) / 3;
    }

    // Check if measure currently contains any notes
    const hasAnyNotes = items.some((it) => it.type === 'note');

    let targetBeat = 0;
    let targetIndex = 0;

    if (!hasAnyNotes) {
      targetBeat = 0;
      targetIndex = 0;
    } else {
      let currentBeat = 0;
      let matched = false;

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const itDur = getItemDuration(it);
        const itStartBeat = currentBeat;
        const itEndBeat = currentBeat + itDur;
        const itStartX = startX + (itStartBeat / capacity) * spanX;
        const itEndX = startX + (itEndBeat / capacity) * spanX;
        currentBeat = itEndBeat;

        // If hovering over or within this item's horizontal slice
        if (svgX < itEndX || idx === items.length - 1) {
          if (it.type === 'rest') {
            const restOffset = Math.max(0, svgX - itStartX);
            const restWidth = Math.max(1, itEndX - itStartX);
            const slotsInRest = Math.max(1, Math.round(itDur / effDuration));
            const slotWidth = restWidth / slotsInRest;
            const subSlot = Math.min(slotsInRest - 1, Math.floor(restOffset / slotWidth));
            targetBeat = Math.min(capacity - effDuration, itStartBeat + subSlot * effDuration);
            targetIndex = idx;
          } else {
            const noteThreshold = itStartX + Math.min(24, (itEndX - itStartX) * 0.45);
            if (svgX <= noteThreshold) {
              targetBeat = itStartBeat;
              targetIndex = idx;
            } else {
              targetBeat = Math.min(capacity - effDuration, itEndBeat);
              targetIndex = idx + 1;
            }
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        targetBeat = Math.max(0, capacity - effDuration);
        targetIndex = items.length;
      }
    }

    targetBeat = Math.max(0, Math.min(capacity - effDuration, Math.round(targetBeat * 10000) / 10000));
    const noteX = startX + (targetBeat / capacity) * spanX;

    const isDrum = isDrumTrack(track);

    setGhostNote({
      trackIndex,
      measureIndex,
      targetItemIndex: targetIndex,
      targetBeat,
      pitch,
      x: noteX,
      y: trackTopY + getPitchY(pitch, track.clef),
      isDrum,
    });
  };

  const handleStaffMouseLeave = () => {
    setGhostNote(null);
  };

  const handleStaffMouseUp = () => {
    // Handled by window mouseup listener when draggingNote is active
  };

  const handleMeasureClick = (trackIndex: number, measureIndex: number, e?: React.MouseEvent) => {
    if (isSelectMode) {
      onSelect({ trackIndex, measureIndex, itemIndex: -1 }, e?.shiftKey);
      return;
    }

    if (!ghostNote || ghostNote.trackIndex !== trackIndex || ghostNote.measureIndex !== measureIndex) return;
    const track = score.tracks[trackIndex];
    onNoteInsertOrUpdate(
      trackIndex,
      measureIndex,
      ghostNote.targetItemIndex,
      ghostNote.pitch,
      ghostNote.targetBeat
    );
    if (!isRestMode) {
      onPlayPreview(ghostNote.pitch, track.instrumentId);
    }
    if (isBigStaff && measureIndex !== activeBigStaffMeasure) {
      onBigStaffMeasureChange?.(measureIndex);
    }
  };

  const zoomedWidth = Math.round(totalSvgWidth * scoreZoom);
  const zoomedHeight = Math.round(totalSvgHeight * scoreZoom);

  return (
    <div className="w-full flex justify-center py-4 print:py-2 select-none relative">
      <div
        id="staff-composer-scroll-container"
        className="bg-white text-slate-900 border border-slate-300 rounded-3xl p-3 sm:p-5 shadow-2xl max-w-full overflow-x-auto print:border-none print:shadow-none print:p-0 print:overflow-visible print:w-full relative"
      >
        <svg
          id="staff-composer-score-svg"
          width={totalSvgWidth}
          height={totalSvgHeight}
          viewBox={`0 0 ${totalSvgWidth} ${totalSvgHeight}`}
          style={{
            width: `${zoomedWidth}px`,
            height: `${zoomedHeight}px`,
            minWidth: `${zoomedWidth}px`,
          }}
          className={`block font-sans mx-auto print:w-full print:h-auto ${
            isSelectMode ? 'cursor-default' : 'cursor-crosshair'
          }`}
          onMouseLeave={handleStaffMouseLeave}
          onMouseUp={handleStaffMouseUp}
        >
          <defs>
            <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {isBigStaff && (
              <clipPath id="big-staff-clip">
                <rect x="0" y="0" width={totalSvgWidth} height={totalSvgHeight} />
              </clipPath>
            )}
          </defs>

          {/* Render 2-bar system rows (or single large bar with peek in Big Staff mode) */}
          {Array.from({ length: systemCount }).map((_, systemIndex) => {
            const systemTopY = TOP_PADDING + systemIndex * (singleSystemHeight + SYSTEM_GAP);
            const systemMeasures = isBigStaff
              ? [
                  activeBigStaffMeasure,
                  ...(activeBigStaffMeasure + 1 < measureCount ? [activeBigStaffMeasure + 1] : []),
                ]
              : Array.from({ length: MEASURES_PER_SYSTEM })
                  .map((_, i) => systemIndex * MEASURES_PER_SYSTEM + i)
                  .filter((m) => m < measureCount);

            return (
              <g
                key={`system-${systemIndex}`}
                id={`system-${systemIndex}`}
                clipPath={isBigStaff ? 'url(#big-staff-clip)' : undefined}
              >
                {/* System Left Bracket connector */}
                {!isBigStaff && trackCount > 1 && (
                  <line
                    x1={staffStartX}
                    y1={systemTopY + STAFF_TOP_Y}
                    x2={staffStartX}
                    y2={systemTopY + (trackCount - 1) * TRACK_SPACING + STAFF_TOP_Y + STAFF_HEIGHT}
                    stroke="#334155"
                    strokeWidth="4"
                  />
                )}

                {/* System Initial Barline */}
                <line
                  x1={staffStartX + 2}
                  y1={systemTopY + STAFF_TOP_Y}
                  x2={staffStartX + 2}
                  y2={
                    systemTopY +
                    (isBigStaff ? 0 : (trackCount - 1) * TRACK_SPACING) +
                    STAFF_TOP_Y +
                    STAFF_HEIGHT
                  }
                  stroke="#475569"
                  strokeWidth="1.8"
                />

                {/* Render tracks in system */}
                {visibleTracks.map(({ track, trackIndex }) => {
                  const trackTopY = isBigStaff ? systemTopY : systemTopY + trackIndex * TRACK_SPACING;
                  const rawName = (track.name || '').trim();
                  let labelLine1 = rawName;
                  let labelLine2: string | null = null;
                  if (rawName.length > 12 && rawName.includes(' ')) {
                    const words = rawName.split(/\s+/);
                    const mid = Math.ceil(words.length / 2);
                    labelLine1 = words.slice(0, mid).join(' ');
                    labelLine2 = words.slice(mid).join(' ');
                  }

                  return (
                    <g key={`${track.id}-s${systemIndex}`}>
                      {/* Instrument label (clickable to change instrument) */}
                      <g
                        transform={`translate(${staffStartX - 8}, ${trackTopY + STAFF_TOP_Y})`}
                        className={onUpdateTrack ? "cursor-pointer group select-none" : "select-none"}
                        onClick={
                          onUpdateTrack
                            ? (e) => {
                                e.stopPropagation();
                                setPickerTrackIndex(trackIndex);
                              }
                            : undefined
                        }
                      >
                        {labelLine2 ? (
                          <text
                            x="0"
                            y="22"
                            fontSize="10.5"
                            fill="#0F172A"
                            fontWeight="700"
                            textAnchor="end"
                            className="font-sans group-hover:fill-indigo-600 transition-colors"
                          >
                            <tspan x="0" dy="0">
                              {labelLine1}
                            </tspan>
                            <tspan x="0" dy="13">
                              {labelLine2}
                            </tspan>
                          </text>
                        ) : (
                          <text
                            x="0"
                            y="30"
                            fontSize={rawName.length > 10 ? '10.5' : '11.5'}
                            fill="#0F172A"
                            fontWeight="700"
                            textAnchor="end"
                            className="font-sans group-hover:fill-indigo-600 transition-colors"
                          >
                            {labelLine1}
                          </text>
                        )}

                        {/* Minimal Instrument Change Link directly on staff */}
                        {onUpdateTrack && (
                          <g className="score-ui-only">
                            <rect
                              x="-56"
                              y={labelLine2 ? 40 : 38}
                              width="56"
                              height="15"
                              rx="4"
                              fill="#EEF2FF"
                              className="opacity-75 group-hover:opacity-100 group-hover:fill-indigo-100 transition-all"
                            />
                            <text
                              x="-6"
                              y={labelLine2 ? 51 : 49}
                              fontSize="9"
                              fill="#4F46E5"
                              fontWeight="700"
                              textAnchor="end"
                              className="font-sans group-hover:fill-indigo-700 select-none"
                            >
                              switch ▾
                            </text>
                          </g>
                        )}
                      </g>

                      {/* 5 Horizontal Staff Lines */}
                      {[0, 1, 2, 3, 4].map((lineIndex) => {
                        const lineY = trackTopY + STAFF_TOP_Y + lineIndex * LINE_SPACING;
                        const systemLineWidth = isBigStaff
                          ? staffStartX + HEADER_WIDTH + MEASURE_WIDTH + BIG_STAFF_PEEK_WIDTH
                          : staffStartX + HEADER_WIDTH + systemMeasures.length * MEASURE_WIDTH;

                        return (
                          <line
                            key={lineIndex}
                            x1={staffStartX}
                            y1={lineY}
                            x2={systemLineWidth}
                            y2={lineY}
                            stroke="#334155"
                            strokeWidth="1.6"
                          />
                        );
                      })}

                      {/* Clean Standalone Clef Symbol */}
                      {track.clef === 'treble' ? (
                        <TrebleClefSymbol x={staffStartX + 10} y={trackTopY + STAFF_TOP_Y} color="#0F172A" />
                      ) : (
                        <BassClefSymbol x={staffStartX + 10} y={trackTopY + STAFF_TOP_Y} color="#0F172A" />
                      )}

                      {/* Key Signature (All 12 Keys & Enharmonics) */}
                      {(() => {
                        const { type, count } = getKeyAccidentalInfo(score.keySignature);
                        if (!type || count === 0) return null;

                        const isTreble = track.clef === 'treble';
                        const offsets = type === 'sharp'
                          ? (isTreble ? SHARP_TREBLE_OFFSETS : SHARP_BASS_OFFSETS)
                          : (isTreble ? FLAT_TREBLE_OFFSETS : FLAT_BASS_OFFSETS);

                        const SymbolComponent = type === 'sharp' ? SharpSymbol : FlatSymbol;
                        const startAccX = staffStartX + 80;
                        const ACC_SPACING = 15;

                        return Array.from({ length: count }).map((_, i) => {
                          const accX = startAccX + i * ACC_SPACING;
                          const accY = trackTopY + STAFF_TOP_Y + offsets[i] * LINE_SPACING;
                          return <SymbolComponent key={i} x={accX} y={accY} />;
                        });
                      })()}

                      {/* Time Signature (Dynamically Positioned) */}
                      {systemIndex === 0 && (() => {
                        const { count } = getKeyAccidentalInfo(score.keySignature);
                        const timeSigX = staffStartX + (count === 0 ? 90 : 106 + (count - 1) * 15);
                        return (
                          <g
                            transform={`translate(${timeSigX}, ${trackTopY + STAFF_TOP_Y})`}
                            className="font-bold fill-slate-900 select-none pointer-events-none"
                            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                          >
                            <text
                              x="0"
                              y="18"
                              fontSize="34"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontWeight="bold"
                            >
                              {score.timeSignature[0]}
                            </text>
                            <text
                              x="0"
                              y="54"
                              fontSize="34"
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontWeight="bold"
                            >
                              {score.timeSignature[1]}
                            </text>
                          </g>
                        );
                      })()}

                      {/* Measures in system */}
                      {systemMeasures.map((measureIndex) => {
                        const measure = track.measures[measureIndex];
                        if (!measure) return null;
                        const layout = measureLayout.get(measureIndex)!;
                        const measureCapacity = getMeasureCapacity(score.timeSignature);
                        let currentMeasureBeat = 0;

                        const selectedMeasureIndices = getSelectedMeasureIndices(selection);
                        const isFullMeasureSelected =
                          selection?.trackIndex === trackIndex &&
                          selection?.itemIndex === -1 &&
                          selectedMeasureIndices.includes(measureIndex);

                        // Compute rhythmic beam groups for this measure
                        const isDraggingInMeasure =
                          draggingNote?.trackIndex === trackIndex &&
                          draggingNote?.measureIndex === measureIndex;
                        const measureDiatonicDelta =
                          isDraggingInMeasure && draggingNote?.isMeasureDrag
                            ? (draggingNote.currentPitch.octave * 7 + (STEP_DIATONIC_OFFSET[draggingNote.currentPitch.step] ?? 0)) -
                              (draggingNote.originalPitch.octave * 7 + (STEP_DIATONIC_OFFSET[draggingNote.originalPitch.step] ?? 0))
                            : 0;

                        const { beamGroups, beamedItemIndices, beamedStemDownMap } = computeMeasureBeams(
                          measure,
                          layout.x,
                          MEASURE_WIDTH,
                          trackTopY,
                          score.timeSignature,
                          track.clef,
                          isDrumTrack(track),
                          isDraggingInMeasure && !draggingNote?.isMeasureDrag ? draggingNote?.itemIndex : null,
                          isDraggingInMeasure && !draggingNote?.isMeasureDrag ? draggingNote?.currentPitch : null,
                          measureDiatonicDelta
                        );

                        return (
                          <g
                            key={measure.id}
                            onMouseMove={(e) => handleStaffMouseMove(e, trackIndex, measureIndex)}
                            onClick={(e) => handleMeasureClick(trackIndex, measureIndex, e)}
                          >
                            {/* Full Measure Selection Box Overlay */}
                            {isFullMeasureSelected && (
                              <g className="score-ui-only">
                                <rect
                                  x={layout.x}
                                  y={trackTopY + STAFF_TOP_Y - 14}
                                  width={MEASURE_WIDTH}
                                  height={STAFF_HEIGHT + 28}
                                  rx="8"
                                  fill="#06B6D4"
                                  fillOpacity="0.12"
                                  stroke="#0891B2"
                                  strokeWidth="2.5"
                                  strokeDasharray="6 4"
                                  className="animate-pulse"
                                />
                                <g transform={`translate(${layout.x + MEASURE_WIDTH / 2 - 75}, ${trackTopY + STAFF_TOP_Y - 28})`}>
                                  <rect x="0" y="0" width="150" height="22" rx="6" fill="#0891B2" />
                                  <text
                                    x="75"
                                    y="15"
                                    fontSize="11"
                                    fontWeight="bold"
                                    fill="#FFFFFF"
                                    textAnchor="middle"
                                  >
                                    {selectedMeasureIndices.length > 1
                                      ? `Bar ${measureIndex + 1} (${selectedMeasureIndices.length} Selected)`
                                      : `Measure ${measureIndex + 1} Selected`}
                                  </text>
                                </g>
                              </g>
                            )}

                            {/* Interactive Measure hit area */}
                            <rect
                              x={layout.x}
                              y={trackTopY - 15}
                              width={MEASURE_WIDTH}
                              height={STAFF_HEIGHT + 75}
                              fill="transparent"
                              className="hover:fill-sky-500/5 transition-colors"
                            />

                            {/* Barline at end of measure */}
                            {(!isBigStaff || measureIndex === activeBigStaffMeasure) && (
                              <line
                                x1={layout.x + MEASURE_WIDTH}
                                y1={trackTopY + STAFF_TOP_Y}
                                x2={layout.x + MEASURE_WIDTH}
                                y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                stroke="#334155"
                                strokeWidth={!isBigStaff && measureIndex === measureCount - 1 ? '2.0' : '1.8'}
                              />
                            )}
                            {!isBigStaff && measureIndex === measureCount - 1 && !measure.repeatEnd && (
                              <line
                                x1={layout.x + MEASURE_WIDTH + 6}
                                y1={trackTopY + STAFF_TOP_Y}
                                x2={layout.x + MEASURE_WIDTH + 6}
                                y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                stroke="#0F172A"
                                strokeWidth="4.5"
                              />
                            )}

                            {/* Start Repeat Barline */}
                            {measure.repeatStart && (
                              <g className="pointer-events-none">
                                <line
                                  x1={layout.x + 2}
                                  y1={trackTopY + STAFF_TOP_Y}
                                  x2={layout.x + 2}
                                  y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                  stroke="#0F172A"
                                  strokeWidth="5"
                                />
                                <line
                                  x1={layout.x + 8}
                                  y1={trackTopY + STAFF_TOP_Y}
                                  x2={layout.x + 8}
                                  y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                  stroke="#0F172A"
                                  strokeWidth="1.8"
                                />
                                <circle cx={layout.x + 15} cy={trackTopY + STAFF_TOP_Y + 27} r="3.4" fill="#0F172A" />
                                <circle cx={layout.x + 15} cy={trackTopY + STAFF_TOP_Y + 45} r="3.4" fill="#0F172A" />
                              </g>
                            )}

                            {/* End Repeat Barline */}
                            {measure.repeatEnd && (
                              <g className="pointer-events-none">
                                <circle cx={layout.x + MEASURE_WIDTH - 15} cy={trackTopY + STAFF_TOP_Y + 27} r="3.4" fill="#0F172A" />
                                <circle cx={layout.x + MEASURE_WIDTH - 15} cy={trackTopY + STAFF_TOP_Y + 45} r="3.4" fill="#0F172A" />
                                <line
                                  x1={layout.x + MEASURE_WIDTH - 8}
                                  y1={trackTopY + STAFF_TOP_Y}
                                  x2={layout.x + MEASURE_WIDTH - 8}
                                  y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                  stroke="#0F172A"
                                  strokeWidth="1.8"
                                />
                                <line
                                  x1={layout.x + MEASURE_WIDTH - 2}
                                  y1={trackTopY + STAFF_TOP_Y}
                                  x2={layout.x + MEASURE_WIDTH - 2}
                                  y2={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT}
                                  stroke="#0F172A"
                                  strokeWidth="5"
                                />
                              </g>
                            )}

                            {/* Volta Endings (1st and 2nd Ending Brackets) */}
                            {trackIndex === 0 && measure.ending && (
                              <g className="pointer-events-none select-none">
                                {(() => {
                                  const endingNum = measure.ending;
                                  const prevMeasure = track.measures[measureIndex - 1];
                                  const nextMeasure = track.measures[measureIndex + 1];
                                  const prevMeasureLayout = measureLayout.get(measureIndex - 1);
                                  const nextMeasureLayout = measureLayout.get(measureIndex + 1);

                                  // Start of ending if previous measure has different ending or is on a previous system row
                                  const isStartOfEnding =
                                    !prevMeasure ||
                                    prevMeasure.ending !== endingNum ||
                                    (prevMeasureLayout && prevMeasureLayout.systemIndex !== layout.systemIndex);

                                  // End of ending if next measure has different ending or is on a next system row
                                  const isEndOfEnding =
                                    !nextMeasure ||
                                    nextMeasure.ending !== endingNum ||
                                    (nextMeasureLayout && nextMeasureLayout.systemIndex !== layout.systemIndex);

                                  const bracketY = trackTopY + STAFF_TOP_Y - 24;
                                  const startX = layout.x + (isStartOfEnding ? 1 : 0);
                                  const endX = layout.x + MEASURE_WIDTH;
                                  const tickHeight = 14;

                                  return (
                                    <g>
                                      {/* Top Horizontal Bracket Bar */}
                                      <line
                                        x1={startX}
                                        y1={bracketY}
                                        x2={endX}
                                        y2={bracketY}
                                        stroke="#0F172A"
                                        strokeWidth="2.2"
                                      />

                                      {/* Left Downward Start Tick */}
                                      {isStartOfEnding && (
                                        <line
                                          x1={startX}
                                          y1={bracketY}
                                          x2={startX}
                                          y2={bracketY + tickHeight}
                                          stroke="#0F172A"
                                          strokeWidth="2.2"
                                        />
                                      )}

                                      {/* Volta Number Label ("1." or "2.") */}
                                      {isStartOfEnding && (
                                        <text
                                          x={startX + 7}
                                          y={bracketY + 11}
                                          fontSize="13"
                                          fontFamily="Georgia, serif"
                                          fontWeight="900"
                                          fill="#0F172A"
                                        >
                                          {endingNum}.
                                        </text>
                                      )}

                                      {/* Right Downward End Tick */}
                                      {(isEndOfEnding && (endingNum === 1 || measure.repeatEnd || !nextMeasure)) && (
                                        <line
                                          x1={endX - 2}
                                          y1={bracketY}
                                          x2={endX - 2}
                                          y2={bracketY + tickHeight}
                                          stroke="#0F172A"
                                          strokeWidth="2.2"
                                        />
                                      )}
                                    </g>
                                  );
                                })()}
                              </g>
                            )}

                            {/* Measure Number Badge */}
                            {(isBigStaff || trackIndex === 0) && (
                              <text
                                x={layout.x + (measure.repeatStart ? 20 : 8)}
                                y={trackTopY + STAFF_TOP_Y - (measure.ending ? 32 : 12)}
                                fontSize={isBigStaff ? '16' : '13'}
                                fill="#64748B"
                                fontWeight="700"
                              >
                                {measureIndex + 1}
                              </text>
                            )}

                            {/* Beat Counter */}
                            {showBeatCounters && (
                              <g
                                transform={`translate(${layout.x}, ${
                                  trackTopY + STAFF_TOP_Y + STAFF_HEIGHT + 26
                                })`}
                              >
                                {Array.from({ length: score.timeSignature[0] }).map((_, bIdx) => {
                                  const beatX = 35 + (bIdx / score.timeSignature[0]) * (MEASURE_WIDTH - 60);
                                  return (
                                    <g key={bIdx}>
                                      <line
                                        x1={beatX}
                                        y1={-12}
                                        x2={beatX}
                                        y2={-5}
                                        stroke="#94A3B8"
                                        strokeWidth="1.5"
                                      />
                                      <text
                                        x={beatX}
                                        y="6"
                                        fontSize="13"
                                        textAnchor="middle"
                                        fill="#64748B"
                                        fontWeight="700"
                                      >
                                        {bIdx + 1}
                                      </text>
                                    </g>
                                  );
                                })}
                              </g>
                            )}

                            {/* Render Beams for grouped 8th & 16th notes */}
                            {beamGroups.map((bg) => {
                              const firstNote = bg.notes[0];
                              const lastNote = bg.notes[bg.notes.length - 1];
                              const getBeamYAt = (x: number) => {
                                const t = (x - firstNote.stemX) / (lastNote.stemX - firstNote.stemX || 1);
                                return bg.beamY1 + t * (bg.beamY2 - bg.beamY1);
                              };

                              const primaryBeamThickness = 6.8;
                              const secondaryBeamThickness = 5.2;
                              const secOffset = bg.isStemDown ? -9.5 : 9.5;

                              return (
                                <g key={bg.id} className="pointer-events-none">
                                  {/* Render stems connecting all chord noteheads to beam */}
                                  {bg.notes.map((n) => {
                                    const bY = getBeamYAt(n.stemX);
                                    const stemStartY = bg.isStemDown ? n.topNoteY : n.bottomNoteY;
                                    const isStemSelected =
                                      selection?.trackIndex === trackIndex &&
                                      selection?.measureIndex === measureIndex &&
                                      selection?.itemIndex === n.itemIndex;
                                    return (
                                      <line
                                        key={n.itemIndex}
                                        x1={n.stemX}
                                        y1={stemStartY}
                                        x2={n.stemX}
                                        y2={bY}
                                        stroke={isStemSelected ? '#0284C7' : '#0F172A'}
                                        strokeWidth={isStemSelected ? '2.8' : '2.2'}
                                      />
                                    );
                                  })}

                                  {/* Primary Top/Outer Beam Bar (thicker standard engraving weight) */}
                                  <polygon
                                    points={`
                                      ${firstNote.stemX - 1.1},${bg.beamY1}
                                      ${lastNote.stemX + 1.1},${bg.beamY2}
                                      ${lastNote.stemX + 1.1},${bg.beamY2 + (bg.isStemDown ? -primaryBeamThickness : primaryBeamThickness)}
                                      ${firstNote.stemX - 1.1},${bg.beamY1 + (bg.isStemDown ? -primaryBeamThickness : primaryBeamThickness)}
                                    `}
                                    fill="#0F172A"
                                  />

                                  {/* Secondary Beam Bar for 16th Notes */}
                                  {(() => {
                                    const sixteenthSubgroups: BeamGroupNote[][] = [];
                                    let currentSub: BeamGroupNote[] = [];

                                    bg.notes.forEach((n) => {
                                      if (n.duration === 0.0625) {
                                        currentSub.push(n);
                                      } else {
                                        if (currentSub.length > 0) {
                                          sixteenthSubgroups.push(currentSub);
                                          currentSub = [];
                                        }
                                      }
                                    });
                                    if (currentSub.length > 0) sixteenthSubgroups.push(currentSub);

                                    return sixteenthSubgroups.map((sub, sIdx) => {
                                      if (sub.length >= 2) {
                                        const subFirst = sub[0];
                                        const subLast = sub[sub.length - 1];
                                        const y1 = getBeamYAt(subFirst.stemX) + secOffset;
                                        const y2 = getBeamYAt(subLast.stemX) + secOffset;

                                        return (
                                          <polygon
                                            key={sIdx}
                                            points={`
                                              ${subFirst.stemX - 1.1},${y1}
                                              ${subLast.stemX + 1.1},${y2}
                                              ${subLast.stemX + 1.1},${y2 + (bg.isStemDown ? -secondaryBeamThickness : secondaryBeamThickness)}
                                              ${subFirst.stemX - 1.1},${y1 + (bg.isStemDown ? -secondaryBeamThickness : secondaryBeamThickness)}
                                            `}
                                            fill="#0F172A"
                                          />
                                        );
                                      } else if (sub.length === 1) {
                                        // Partial secondary beam stub for single 16th note in a mixed group
                                        const single = sub[0];
                                        const y1 = getBeamYAt(single.stemX) + secOffset;
                                        const stubLen = 13;
                                        const isLastInGroup = single === lastNote;
                                        const stubX2 = isLastInGroup ? single.stemX - stubLen : single.stemX + stubLen;
                                        const y2 = getBeamYAt(stubX2) + secOffset;

                                        return (
                                          <polygon
                                            key={sIdx}
                                            points={`
                                              ${single.stemX},${y1}
                                              ${stubX2},${y2}
                                              ${stubX2},${y2 + (bg.isStemDown ? -secondaryBeamThickness : secondaryBeamThickness)}
                                              ${single.stemX},${y1 + (bg.isStemDown ? -secondaryBeamThickness : secondaryBeamThickness)}
                                            `}
                                            fill="#0F172A"
                                          />
                                        );
                                      }
                                      return null;
                                    });
                                  })()}
                                </g>
                              );
                            })}

                            {/* Render Triplet Brackets */}
                            {(() => {
                              const tripletGroups: { x1: number; x2: number; isStemDown: boolean }[] = [];
                              let curGroup: { x: number; isStemDown: boolean }[] = [];

                              let runningBeat = 0;
                              measure.items.forEach((it) => {
                                const itDur = getItemDuration(it);
                                const bRatio = runningBeat / measureCapacity;
                                const itX = layout.x + 35 + bRatio * (MEASURE_WIDTH - 60);
                                runningBeat += itDur;

                                if (it.isTriplet) {
                                  const diatonic = it.pitch
                                    ? it.pitch.octave * 7 + (STEP_DIATONIC_OFFSET[it.pitch.step] ?? 0)
                                    : 30;
                                  const middleDiatonic = track.clef === 'treble' ? 34 : 22;
                                  curGroup.push({ x: itX, isStemDown: diatonic >= middleDiatonic });
                                } else {
                                  if (curGroup.length >= 2) {
                                    tripletGroups.push({
                                      x1: curGroup[0].x,
                                      x2: curGroup[curGroup.length - 1].x,
                                      isStemDown: curGroup.filter((g) => g.isStemDown).length > curGroup.length / 2,
                                    });
                                  }
                                  curGroup = [];
                                }
                              });
                              if (curGroup.length >= 2) {
                                tripletGroups.push({
                                  x1: curGroup[0].x,
                                  x2: curGroup[curGroup.length - 1].x,
                                  isStemDown: curGroup.filter((g) => g.isStemDown).length > curGroup.length / 2,
                                });
                              }

                              return tripletGroups.map((tg, tgIdx) => (
                                <TripletBracketSymbol
                                  key={tgIdx}
                                  x1={tg.x1 - 8}
                                  x2={tg.x2 + 8}
                                  y={
                                    tg.isStemDown
                                      ? trackTopY + STAFF_TOP_Y + STAFF_HEIGHT + 14
                                      : trackTopY + STAFF_TOP_Y - 14
                                  }
                                  isAbove={!tg.isStemDown}
                                />
                              ));
                            })()}

                            {/* Notes & Rests */}
                            {measure.items.map((item, itemIndex) => {
                              const itemDur = getItemDuration(item);
                              const itemBeatStart = currentMeasureBeat;
                              const isFullMeasureRest = measure.items.length === 1 && item.type === 'rest';
                              const itemStartRatio = currentMeasureBeat / measureCapacity;
                              const beatRatio = isFullMeasureRest ? 0.5 : itemStartRatio;
                              const itemX = isFullMeasureRest
                                ? layout.x + MEASURE_WIDTH / 2
                                : layout.x + 35 + beatRatio * (MEASURE_WIDTH - 60);
                              currentMeasureBeat += itemDur;
                              const itemEndRatio = currentMeasureBeat / measureCapacity;

                              const isSelected =
                                selection?.trackIndex === trackIndex &&
                                selection?.measureIndex === measureIndex &&
                                selection?.itemIndex === itemIndex;

                              const isCurrentMeasure = playheadPosition?.measureIndex === measureIndex;
                              const beatPos = playheadPosition?.beatFraction ?? 0;
                              const isPlaying =
                                isCurrentMeasure &&
                                (
                                  activePlayingNoteIds.has(item.id) ||
                                  (beatPos >= itemStartRatio - 0.05 && beatPos <= itemEndRatio + 0.05)
                                );
                              const isBeamed = beamedItemIndices.has(itemIndex);
                              const countingText =
                                countingMode !== 'off'
                                  ? getBeatCountingLabel(itemBeatStart, item, score.timeSignature, countingMode)
                                  : '';

                              // REST Rendering
                              // Rests are pointer-events-none so clicking them in Cursor Select mode selects the measure,
                              // and clicking them in Insert mode places a note directly at that beat.
                              if (item.type === 'rest') {
                                return (
                                  <g
                                    key={item.id}
                                    className="pointer-events-none select-none"
                                  >
                                    {item.isChallengeBlank && (
                                      <g>
                                        <rect
                                          x={itemX - 20}
                                          y={trackTopY + STAFF_TOP_Y - 8}
                                          width="40"
                                          height={STAFF_HEIGHT + 16}
                                          rx="8"
                                          fill="#F97316"
                                          fillOpacity="0.22"
                                          stroke="#EA580C"
                                          strokeWidth="2.5"
                                          strokeDasharray="4 3"
                                        />
                                        <circle
                                          cx={itemX}
                                          cy={trackTopY + STAFF_TOP_Y - 12}
                                          r="9"
                                          fill="#F97316"
                                        />
                                        <text
                                          x={itemX}
                                          y={trackTopY + STAFF_TOP_Y - 8}
                                          fontSize="11"
                                          fontWeight="bold"
                                          fill="#FFFFFF"
                                          textAnchor="middle"
                                        >
                                          ?
                                        </text>
                                      </g>
                                    )}

                                    {isSelected && (
                                      <rect
                                        x={itemX - 18}
                                        y={trackTopY + STAFF_TOP_Y - 6}
                                        width="36"
                                        height={STAFF_HEIGHT + 12}
                                        rx="6"
                                        fill="#38BDF8"
                                        fillOpacity="0.25"
                                        stroke="#0284C7"
                                        strokeWidth="2"
                                        className="score-ui-only"
                                      />
                                    )}

                                    {item.duration === 1 && (
                                      <WholeRestSymbol x={itemX} y={trackTopY + STAFF_TOP_Y} color={isSelected ? '#0284C7' : '#0F172A'} />
                                    )}
                                    {item.duration === 0.5 && (
                                      <HalfRestSymbol x={itemX} y={trackTopY + STAFF_TOP_Y} color={isSelected ? '#0284C7' : '#0F172A'} />
                                    )}
                                    {item.duration === 0.25 && (
                                      <QuarterRestSymbol x={itemX} y={trackTopY + STAFF_TOP_Y} color={isSelected ? '#0284C7' : '#0F172A'} />
                                    )}
                                    {item.duration === 0.125 && (
                                      <EighthRestSymbol x={itemX} y={trackTopY + STAFF_TOP_Y} color={isSelected ? '#0284C7' : '#0F172A'} />
                                    )}
                                    {item.duration === 0.0625 && (
                                      <SixteenthRestSymbol x={itemX} y={trackTopY + STAFF_TOP_Y} color={isSelected ? '#0284C7' : '#0F172A'} />
                                    )}

                                    {item.isDotted && (
                                      <circle
                                        cx={itemX + 15}
                                        cy={trackTopY + STAFF_TOP_Y + 27}
                                        r="3.0"
                                        fill={isSelected ? '#0284C7' : '#0F172A'}
                                      />
                                    )}

                                    {countingText && (
                                      <text
                                        x={itemX}
                                        y={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT + (showBeatCounters ? 46 : 30)}
                                        fontSize="11"
                                        fontWeight="700"
                                        fill="#64748B"
                                        textAnchor="middle"
                                      >
                                        {countingText}
                                      </text>
                                    )}
                                  </g>
                                );
                              }

                              // NOTE Rendering (supports single notes & polyphonic chords with proper music notation norms!)
                              const allPitches =
                                item.pitches && item.pitches.length > 0
                                  ? item.pitches
                                  : item.pitch
                                  ? [item.pitch]
                                  : [];

                              if (allPitches.length === 0) return null;

                              const isDraggingThis =
                                draggingNote?.trackIndex === trackIndex &&
                                draggingNote?.measureIndex === measureIndex &&
                                draggingNote?.itemIndex === itemIndex;

                              const rawPitches = isDraggingThis && !draggingNote?.isMeasureDrag
                                ? allPitches.map((ap) =>
                                    ap.step === draggingNote.originalPitch.step &&
                                    ap.octave === draggingNote.originalPitch.octave
                                      ? draggingNote.currentPitch
                                      : ap
                                  )
                                : isDraggingInMeasure && draggingNote?.isMeasureDrag && measureDiatonicDelta !== 0
                                ? allPitches.map((ap) => shiftPitchByDiatonicSteps(ap, measureDiatonicDelta))
                                : allPitches;

                              // Sort pitches from lowest to highest (diatonic ascending, i.e., bottom notehead to top notehead)
                              const sortedPitches = [...rawPitches].sort((a, b) => {
                                const diaA = a.octave * 7 + STEP_DIATONIC_OFFSET[a.step];
                                const diaB = b.octave * 7 + STEP_DIATONIC_OFFSET[b.step];
                                return diaA - diaB;
                              });

                              const middleDiatonic = track.clef === 'treble' ? 34 : 22;
                              const isDrum = isDrumTrack(track);

                              // Calculate diatonics and Y coordinates for every pitch in the chord
                              const pitchInfos = sortedPitches.map((p, idx) => {
                                const diatonic = p.octave * 7 + STEP_DIATONIC_OFFSET[p.step];
                                const noteY = trackTopY + getPitchY(p, track.clef);
                                const ledgerLines = getLedgerLines(p, track.clef);
                                return { p, idx, diatonic, noteY, ledgerLines };
                              });

                              // Stem direction: if part of a beam group, match the beam group's stem direction;
                              // otherwise compute from average diatonic pitch of the chord
                              const avgDiatonic =
                                pitchInfos.reduce((sum, pi) => sum + pi.diatonic, 0) / pitchInfos.length;
                              const isStemDown = beamedStemDownMap.get(itemIndex) ?? (avgDiatonic >= middleDiatonic);

                              // Bounding Y positions for the chord
                              const topY = pitchInfos[pitchInfos.length - 1].noteY; // smallest Y (highest note)
                              const bottomY = pitchInfos[0].noteY; // largest Y (lowest note)

                              // Standard music notation: seconds displacement (adjacent staff steps)
                              const displacedIndices = new Set<number>();
                              if (isStemDown) {
                                for (let i = pitchInfos.length - 2; i >= 0; i--) {
                                  if (pitchInfos[i + 1].diatonic - pitchInfos[i].diatonic === 1) {
                                    if (!displacedIndices.has(i + 1)) {
                                      displacedIndices.add(i);
                                    }
                                  }
                                }
                              } else {
                                for (let i = 1; i < pitchInfos.length; i++) {
                                  if (pitchInfos[i].diatonic - pitchInfos[i - 1].diatonic === 1) {
                                    if (!displacedIndices.has(i - 1)) {
                                      displacedIndices.add(i);
                                    }
                                  }
                                }
                              }

                              const hasMultiChord = pitchInfos.length > 1;
                              const stemLength =
                                (item.duration === 0.0625 ? 46 : item.duration === 0.125 ? 42 : 40) +
                                (hasMultiChord && item.duration <= 0.125 ? 5 : 0);
                              const stemOffset = isDrum ? 7.0 : 9.0;
                              const stemX = isStemDown ? itemX - stemOffset : itemX + stemOffset;

                              // Stem spans from lowest notehead to highest notehead plus stem length
                              const stemY1 = isStemDown
                                ? topY + (item.duration >= 0.5 ? 2 : 0)
                                : bottomY - (item.duration >= 0.5 ? 2 : 0);
                              const stemY2 = isStemDown ? bottomY + stemLength : topY - stemLength;

                              return (
                                <g key={item.id}>
                                  {/* Selection Aura */}
                                  {isSelected && (
                                    <rect
                                      x={itemX - 18}
                                      y={topY - 14}
                                      width="36"
                                      height={Math.max(28, bottomY - topY + 28)}
                                      rx="8"
                                      fill="#38BDF8"
                                      fillOpacity="0.18"
                                      stroke="#0284C7"
                                      strokeWidth="1.8"
                                      className="score-ui-only pointer-events-none"
                                    />
                                  )}

                                  {/* Live Pitch Badge while Dragging */}
                                  {isDraggingThis && draggingNote && (
                                    <g
                                      transform={`translate(${itemX + 16}, ${
                                        trackTopY + getPitchY(draggingNote.currentPitch, track.clef) - 12
                                      })`}
                                      className="score-ui-only pointer-events-none"
                                    >
                                      <rect
                                        x="0"
                                        y="0"
                                        width={draggingNote.isMeasureDrag && measureDiatonicDelta !== 0 ? "70" : "42"}
                                        height="22"
                                        rx="6"
                                        fill="#0F172A"
                                        stroke="#38BDF8"
                                        strokeWidth="1.5"
                                      />
                                      <text
                                        x={draggingNote.isMeasureDrag && measureDiatonicDelta !== 0 ? 35 : 21}
                                        y="15"
                                        fontSize="12"
                                        fontWeight="800"
                                        fill="#38BDF8"
                                        textAnchor="middle"
                                      >
                                        {draggingNote.currentPitch.step}
                                        {draggingNote.currentPitch.accidental === 'sharp'
                                          ? '♯'
                                          : draggingNote.currentPitch.accidental === 'flat'
                                          ? '♭'
                                          : ''}
                                        {draggingNote.currentPitch.octave}
                                        {draggingNote.isMeasureDrag && measureDiatonicDelta !== 0 && (
                                          ` (${measureDiatonicDelta > 0 ? `+${measureDiatonicDelta}` : measureDiatonicDelta})`
                                        )}
                                      </text>
                                    </g>
                                  )}

                                  {isPlaying && (
                                    <rect
                                      x={itemX - 22}
                                      y={topY - 16}
                                      width="44"
                                      height={Math.max(32, bottomY - topY + 32)}
                                      rx="10"
                                      fill="#F59E0B"
                                      fillOpacity="0.40"
                                      stroke="#F59E0B"
                                      strokeWidth="3"
                                      filter="url(#glow)"
                                      className="score-ui-only pointer-events-none"
                                    />
                                  )}

                                  {/* Render Ledger Lines & Accidental & Notehead for EVERY pitch in chord */}
                                  {pitchInfos.map(({ p, idx, noteY, ledgerLines }) => {
                                    const isDisplaced = displacedIndices.has(idx);
                                    const noteX = isDisplaced ? (isStemDown ? itemX - 18 : itemX + 18) : itemX;

                                    const bwColor = BOOMWHACKER_COLORS[p.step];
                                    const noteFill = isSelected
                                      ? item.duration >= 0.5
                                        ? '#F0F9FF'
                                        : '#0284C7'
                                      : item.duration >= 0.5
                                      ? 'transparent'
                                      : effectiveBoomwhacker
                                      ? bwColor.bg
                                      : '#0F172A';
                                    const noteStroke = isSelected
                                      ? '#0284C7'
                                      : effectiveBoomwhacker
                                      ? bwColor.bg
                                      : '#0F172A';

                                    const accidentalOffset = 18 + idx * 11;
                                    const pitchLabelText = effectiveShowPitchNames
                                      ? getFormattedPitchLabel(p, effectiveNoteLabelMode, score.keySignature)
                                      : '';

                                    return (
                                      <g key={idx}>
                                        {/* Ledger Lines */}
                                        {ledgerLines.map((lineY, lIdx) => (
                                          <line
                                            key={lIdx}
                                            x1={noteX - 17}
                                            y1={trackTopY + lineY}
                                            x2={noteX + 17}
                                            y2={trackTopY + lineY}
                                            stroke="#334155"
                                            strokeWidth="2.0"
                                            className="pointer-events-none"
                                          />
                                        ))}

                                        {/* Accidental */}
                                        {p.accidental === 'sharp' && (
                                          <SharpSymbol x={noteX - accidentalOffset} y={noteY} color={isSelected ? '#0284C7' : '#0F172A'} />
                                        )}
                                        {p.accidental === 'flat' && (
                                          <FlatSymbol x={noteX - accidentalOffset} y={noteY} color={isSelected ? '#0284C7' : '#0F172A'} />
                                        )}
                                        {p.accidental === 'natural' && (
                                          <NaturalSymbol x={noteX - accidentalOffset} y={noteY} color={isSelected ? '#0284C7' : '#0F172A'} />
                                        )}

                                        {/* Interactive Notehead: generous hit area + drag support */}
                                        <g
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (e.shiftKey) {
                                              handleMeasureClick(trackIndex, measureIndex, e);
                                              return;
                                            }
                                            onSelect({ trackIndex, measureIndex, itemIndex });
                                            onPlayPreview(sortedPitches, track.instrumentId);
                                            if (isBigStaff && measureIndex !== activeBigStaffMeasure) {
                                              onBigStaffMeasureChange?.(measureIndex);
                                            }
                                          }}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            const currentSelectedMeasures = getSelectedMeasureIndices(selection);
                                            const isParentMeasureSelected =
                                              selection?.trackIndex === trackIndex &&
                                              selection?.itemIndex === -1 &&
                                              currentSelectedMeasures.includes(measureIndex);

                                            if (!isParentMeasureSelected) {
                                              onSelect({ trackIndex, measureIndex, itemIndex });
                                            }

                                            setDraggingNote({
                                              trackIndex,
                                              measureIndex,
                                              itemIndex,
                                              originalPitch: p,
                                              currentPitch: p,
                                              isMeasureDrag: isParentMeasureSelected,
                                            });
                                          }}
                                          className="cursor-grab active:cursor-grabbing group"
                                          style={{ pointerEvents: 'all' }}
                                        >
                                          {/* Generous invisible hit target so hollow Whole/Half notes & small noteheads are easy to grab */}
                                          <ellipse
                                            cx={noteX}
                                            cy={noteY}
                                            rx="16"
                                            ry="12"
                                            fill="transparent"
                                            style={{ pointerEvents: 'all' }}
                                          />
                                          {isDrum ? (
                                            <g className="transition-opacity group-hover:opacity-85">
                                              <circle cx={noteX} cy={noteY} r="10.5" fill="transparent" />
                                              {item.duration >= 0.5 && (
                                                <circle
                                                  cx={noteX}
                                                  cy={noteY}
                                                  r="9.5"
                                                  fill="none"
                                                  stroke={noteStroke}
                                                  strokeWidth="2.4"
                                                />
                                              )}
                                              <line
                                                x1={noteX - 7.5}
                                                y1={noteY - 7.5}
                                                x2={noteX + 7.5}
                                                y2={noteY + 7.5}
                                                stroke={noteStroke}
                                                strokeWidth={item.duration >= 0.5 ? '2.8' : '3.2'}
                                                strokeLinecap="round"
                                              />
                                              <line
                                                x1={noteX - 7.5}
                                                y1={noteY + 7.5}
                                                x2={noteX + 7.5}
                                                y2={noteY - 7.5}
                                                stroke={noteStroke}
                                                strokeWidth={item.duration >= 0.5 ? '2.8' : '3.2'}
                                                strokeLinecap="round"
                                              />
                                            </g>
                                          ) : (
                                            <g>
                                              {/* Subtle hover ring when unselected so the note never moves while giving immediate interactive feedback */}
                                              {!isSelected && (
                                                <ellipse
                                                  cx={noteX}
                                                  cy={noteY}
                                                  rx="14"
                                                  ry="10.5"
                                                  transform={`rotate(${item.duration === 1 ? -10 : -20} ${noteX} ${noteY})`}
                                                  fill="#38BDF8"
                                                  fillOpacity="0"
                                                  className="transition-all group-hover:fill-opacity-25 pointer-events-none"
                                                />
                                              )}
                                              <ellipse
                                                cx={noteX}
                                                cy={noteY}
                                                rx={item.duration === 1 ? '10.6' : '10.0'}
                                                ry="7.2"
                                                transform={`rotate(${item.duration === 1 ? -10 : -20} ${noteX} ${noteY})`}
                                                fill={noteFill}
                                                stroke={noteStroke}
                                                strokeWidth={item.duration >= 0.5 ? '3.2' : isSelected ? '2.0' : '1.8'}
                                                style={{ pointerEvents: 'all' }}
                                                className="transition-colors"
                                              />
                                            </g>
                                          )}
                                        </g>

                                        {/* Note Label (Letter, Solfege, or Scale Degree): dark slate text with subtle white halo */}
                                        {pitchLabelText && (
                                          <text
                                            x={noteX + (isDrum ? 0 : item.isDotted ? 22 : 15)}
                                            y={isDrum ? (isStemDown ? noteY - 12 : noteY + 18) : noteY + 4}
                                            textAnchor={isDrum ? 'middle' : 'start'}
                                            fontSize="12"
                                            fontWeight="800"
                                            fill={isSelected ? '#0369A1' : '#0F172A'}
                                            stroke="#FFFFFF"
                                            strokeWidth="3"
                                            strokeLinejoin="round"
                                            style={{ paintOrder: 'stroke' }}
                                            className="pointer-events-none select-none"
                                          >
                                            {pitchLabelText}
                                          </text>
                                        )}
                                      </g>
                                    );
                                  })}

                                  {/* Stem (unbeamed notes only) */}
                                  {!isBeamed && item.duration < 1 && (
                                    <line
                                      x1={stemX}
                                      y1={stemY1}
                                      x2={stemX}
                                      y2={stemY2}
                                      stroke={isSelected ? '#0284C7' : '#0F172A'}
                                      strokeWidth={isSelected ? '2.8' : '2.2'}
                                      className="pointer-events-none"
                                    />
                                  )}

                                  {/* Flags for single unbeamed 8th & 16th notes */}
                                  {!isBeamed && item.duration <= 0.125 && (
                                    <StemFlagSymbol
                                      x={stemX}
                                      y={stemY2}
                                      isUp={!isStemDown}
                                      isSixteenth={item.duration === 0.0625}
                                      color={isSelected ? '#0284C7' : '#0F172A'}
                                    />
                                  )}

                                  {/* Dot */}
                                  {item.isDotted && (
                                    <circle
                                      cx={itemX + 16}
                                      cy={bottomY}
                                      r="3.2"
                                      fill={isSelected ? '#0284C7' : '#0F172A'}
                                      className="pointer-events-none"
                                    />
                                  )}

                                  {/* Tie Curve */}
                                  {item.isTied && (() => {
                                    const tieStartX = itemX + 10;
                                    const isLastInMeasure = itemIndex === measure.items.length - 1;
                                    const tieEndX = isLastInMeasure
                                      ? layout.x + MEASURE_WIDTH + 22
                                      : layout.x + 35 + itemEndRatio * (MEASURE_WIDTH - 60) - 8;
                                    const tieY = isStemDown ? topY - 8 : bottomY + 8;
                                    const cpY = tieY + (isStemDown ? -14 : 14);
                                    return (
                                      <path
                                        d={`M ${tieStartX} ${tieY} Q ${(tieStartX + tieEndX) / 2} ${cpY} ${tieEndX} ${tieY}`}
                                        fill="none"
                                        stroke={isSelected ? '#0284C7' : '#0F172A'}
                                        strokeWidth={isSelected ? '2.8' : '2.2'}
                                        strokeLinecap="round"
                                        className="pointer-events-none"
                                      />
                                    );
                                  })()}

                                  {/* Articulations */}
                                  {item.articulation === 'accent' && (
                                    <AccentSymbol x={itemX} y={isStemDown ? topY - 16 : bottomY + 18} />
                                  )}
                                  {item.articulation === 'staccato' && (
                                    <StaccatoSymbol x={itemX} y={isStemDown ? topY - 14 : bottomY + 16} />
                                  )}
                                  {item.articulation === 'tenuto' && (
                                    <TenutoSymbol x={itemX} y={isStemDown ? topY - 14 : bottomY + 16} />
                                  )}
                                  {item.articulation === 'marcato' && (
                                    <MarcatoSymbol x={itemX} y={isStemDown ? topY - 18 : bottomY + 18} />
                                  )}
                                  {item.articulation === 'fermata' && (
                                    <FermataSymbol x={itemX} y={trackTopY + STAFF_TOP_Y - 16} isUp={true} />
                                  )}

                                  {/* Dynamics */}
                                  {item.dynamic && (
                                    <DynamicSymbol
                                      x={itemX}
                                      y={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT + 22}
                                      dynamic={item.dynamic}
                                    />
                                  )}

                                  {/* Counting Syllable Underlay */}
                                  {countingText && (
                                    <text
                                      x={itemX}
                                      y={trackTopY + STAFF_TOP_Y + STAFF_HEIGHT + (showBeatCounters ? 46 : 30)}
                                      fontSize="11"
                                      fontWeight="700"
                                      fill="#0284C7"
                                      textAnchor="middle"
                                      className="pointer-events-none select-none"
                                    >
                                      {countingText}
                                    </text>
                                  )}

                                  {/* Lyric Underlay (Only shown in Advanced Mode) */}
                                  {uiMode === 'advanced' && item.lyric && (
                                    <text
                                      x={itemX}
                                      y={
                                        trackTopY +
                                        STAFF_TOP_Y +
                                        STAFF_HEIGHT +
                                        (countingText ? (showBeatCounters ? 62 : 46) : showBeatCounters ? 46 : 32)
                                      }
                                      fontSize="12"
                                      fontWeight="600"
                                      fontStyle="italic"
                                      fill="#0F172A"
                                      textAnchor="middle"
                                      className="pointer-events-none select-none font-serif"
                                    >
                                      {item.lyric}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}

                      {/* Peeking placeholder if at the last measure in Big Staff mode */}
                      {isBigStaff && activeBigStaffMeasure + 1 >= measureCount && (
                        <g
                          className="cursor-pointer group select-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBigStaffAddMeasure?.();
                          }}
                        >
                          {/* Measure Number for next measure */}
                          <text
                            x={staffStartX + HEADER_WIDTH + MEASURE_WIDTH + 8}
                            y={trackTopY + STAFF_TOP_Y - 12}
                            fontSize="16"
                            fill="#94A3B8"
                            fontWeight="700"
                          >
                            {activeBigStaffMeasure + 2}
                          </text>

                          {/* Friendly Add Bar circle button right on the peeking staff */}
                          <g
                            transform={`translate(${staffStartX + HEADER_WIDTH + MEASURE_WIDTH + 52}, ${
                              trackTopY + STAFF_TOP_Y + 28
                            })`}
                          >
                            <circle
                              cx="0"
                              cy="0"
                              r="18"
                              fill="#38BDF8"
                              fillOpacity="0.18"
                              stroke="#0284C7"
                              strokeWidth="2"
                              strokeDasharray="3 3"
                              className="group-hover:fill-sky-400 group-hover:fill-opacity-35 transition-all"
                            />
                            <text
                              x="0"
                              y="6"
                              fontSize="22"
                              fontWeight="bold"
                              fill="#0284C7"
                              textAnchor="middle"
                              className="select-none"
                            >
                              +
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Ghost Note on Hover (Insert Mode) */}
          {ghostNote && !isSelectMode && (
            <g transform={`translate(0, 0)`} className="score-ui-only pointer-events-none opacity-85">
              <line
                x1={ghostNote.x - 22}
                y1={ghostNote.y}
                x2={ghostNote.x + 22}
                y2={ghostNote.y}
                stroke="#0284C7"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              {ghostNote.isDrum ? (
                <g>
                  {activeDuration >= 0.5 && (
                    <circle
                      cx={ghostNote.x}
                      cy={ghostNote.y}
                      r="8.5"
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="2.2"
                      strokeDasharray="3 2"
                    />
                  )}
                  <line
                    x1={ghostNote.x - 6.5}
                    y1={ghostNote.y - 6.5}
                    x2={ghostNote.x + 6.5}
                    y2={ghostNote.y + 6.5}
                    stroke="#0284C7"
                    strokeWidth="3.0"
                    strokeLinecap="round"
                  />
                  <line
                    x1={ghostNote.x - 6.5}
                    y1={ghostNote.y + 6.5}
                    x2={ghostNote.x + 6.5}
                    y2={ghostNote.y - 6.5}
                    stroke="#0284C7"
                    strokeWidth="3.0"
                    strokeLinecap="round"
                  />
                </g>
              ) : (
                <ellipse
                  cx={ghostNote.x}
                  cy={ghostNote.y}
                  rx="9.2"
                  ry="6.6"
                  transform={`rotate(-20 ${ghostNote.x} ${ghostNote.y})`}
                  fill={
                    activeDuration >= 0.5
                      ? 'none'
                      : effectiveBoomwhacker
                      ? BOOMWHACKER_COLORS[ghostNote.pitch.step].bg
                      : '#0284C7'
                  }
                  stroke={effectiveBoomwhacker ? BOOMWHACKER_COLORS[ghostNote.pitch.step].bg : '#0369A1'}
                  strokeWidth={activeDuration >= 0.5 ? '3.0' : '2.2'}
                />
              )}
              <g transform={`translate(${ghostNote.x + 13}, ${ghostNote.y - 11})`}>
                <rect x="0" y="0" width="36" height="20" rx="5" fill="#0284C7" className="shadow-md" />
                <text
                  x="18"
                  y="14"
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  fill="#FFFFFF"
                >
                  {ghostNote.pitch.step}
                  {ghostNote.pitch.accidental === 'sharp'
                    ? '♯'
                    : ghostNote.pitch.accidental === 'flat'
                    ? '♭'
                    : ''}
                  {ghostNote.pitch.octave}
                </text>
              </g>
            </g>
          )}

          {/* Direct-DOM Animated Playback Cursor Line */}
          <line
            id="staff-playhead-cursor-line"
            x1="0"
            y1="0"
            x2="0"
            y2="0"
            stroke="#EF4444"
            strokeWidth="3.5"
            strokeDasharray="5 3"
            className="pointer-events-none select-none transition-none"
            style={{ display: 'none' }}
          />
        </svg>
      </div>

      {/* Interactive Full Instrument Dropdown Modal */}
      {pickerTrackIndex !== null && onUpdateTrack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 score-ui-only"
          onClick={() => {
            setPickerTrackIndex(null);
            setInstrumentSearch('');
          }}
        >
          <div
            className="bg-slate-900 text-white rounded-3xl shadow-2xl max-w-xl w-full border border-slate-700/90 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Music className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Change Staff Instrument
                  </h3>
                  <p className="text-xs text-slate-400">
                    Track {pickerTrackIndex + 1}:{' '}
                    <span className="text-indigo-300 font-semibold">
                      {score.tracks[pickerTrackIndex]?.name}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPickerTrackIndex(null);
                  setInstrumentSearch('');
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Categories */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search instruments (e.g. Flute, Violin, Trumpet, Drums)..."
                  value={instrumentSearch}
                  onChange={(e) => setInstrumentSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2 bg-slate-800/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden focus:border-indigo-400 transition-colors"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-semibold">
                {(
                  [
                    'All',
                    'Woodwinds',
                    'Brass',
                    'Strings',
                    'Popular & World',
                    'Keyboards',
                    'Percussion',
                    'Drums',
                    'Sound Effects',
                  ] as (InstrumentCategory | 'All')[]
                ).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Instruments List */}
            <div className="overflow-y-auto p-4 max-h-[50vh] flex flex-col gap-1.5">
              {(() => {
                const currentTrackInstId = score.tracks[pickerTrackIndex]?.instrumentId;
                const allInsts = Object.values(INSTRUMENTS);
                const filtered = allInsts.filter((inst) => {
                  if (inst.id === 'piano_bass' && selectedCategory !== 'Keyboards') return false;
                  const matchesCat =
                    selectedCategory === 'All' || inst.category === selectedCategory;
                  const q = instrumentSearch.trim().toLowerCase();
                  const matchesSearch =
                    q === '' ||
                    inst.name.toLowerCase().includes(q) ||
                    inst.category.toLowerCase().includes(q) ||
                    (inst.description && inst.description.toLowerCase().includes(q));
                  return matchesCat && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No instruments found matching "{instrumentSearch}".
                    </div>
                  );
                }

                return filtered.map((inst) => {
                  const isCurrent = currentTrackInstId === inst.id;
                  const isPreviewing = previewingId === inst.id;

                  return (
                    <div
                      key={inst.id}
                      onClick={() => {
                        onUpdateTrack(pickerTrackIndex, {
                          instrumentId: inst.id,
                          name: inst.name,
                          clef: inst.clef,
                        });
                        const previewPitch = {
                          step: (inst.clef === 'bass' ? 'C' : 'G') as any,
                          octave: inst.defaultOctave,
                        };
                        soundEngine.playNotePreview(previewPitch, inst.id, 0.5);
                        setPickerTrackIndex(null);
                        setInstrumentSearch('');
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-600/20 border-indigo-500/60 text-white'
                          : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60 text-slate-200 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Clef Badge */}
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-serif font-black flex items-center justify-center shrink-0 ${
                            inst.clef === 'bass'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                          title={inst.clef === 'bass' ? 'Bass Clef' : 'Treble Clef'}
                        >
                          {inst.clef === 'bass' ? '𝄢' : '𝄞'}
                        </span>

                        <div className="flex flex-col">
                          <div className="text-xs font-bold leading-tight flex items-center gap-2">
                            <span>{inst.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded font-semibold">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">{inst.category}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Audio Preview Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewingId(inst.id);
                            const previewPitch = {
                              step: (inst.clef === 'bass' ? 'C' : 'G') as any,
                              octave: inst.defaultOctave,
                            };
                            soundEngine.playNotePreview(previewPitch, inst.id, 0.6);
                            setTimeout(() => {
                              setPreviewingId(null);
                            }, 600);
                          }}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isPreviewing
                              ? 'bg-emerald-500 text-white border-emerald-400 animate-pulse'
                              : 'bg-slate-700/70 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-600/60'
                          }`}
                          title="Preview instrument sound"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>

                        {isCurrent && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
