import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Scissors, Copy, Trash2, Repeat, Maximize2 } from 'lucide-react';
import { DawClip, DawProject, DawSnapGrid, DawTrack } from '../types';

interface TimelineArrangerProps {
  project: DawProject;
  currentBeat: number;
  selectedClipId: string | null;
  onSelectClip: (clipId: string | null) => void;
  onSeek: (beat: number) => void;
  onMoveClip: (clipId: string, newStartBeat: number, newTrackId?: string) => void;
  onTrimClip: (clipId: string, newStartBeat: number, newDurationBeats: number) => void;
  onSplitClip: (clipId: string, splitBeat: number) => void;
  onDuplicateClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => void;
  onOpenPianoRollForClip?: (clipId: string) => void;
}

export const TimelineArranger: React.FC<TimelineArrangerProps> = ({
  project,
  currentBeat,
  selectedClipId,
  onSelectClip,
  onSeek,
  onMoveClip,
  onTrimClip,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onOpenPianoRollForClip,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pixels per beat (4 beats = 1 measure). 40px per beat = 160px per measure.
  const pixelsPerBeat = 36;
  const totalMeasures = 32;
  const totalBeats = totalMeasures * 4;
  const timelineWidth = totalBeats * pixelsPerBeat;

  // Snapping helper
  const getSnapIncrement = useCallback((snap: DawSnapGrid): number => {
    switch (snap) {
      case '1bar': return 4;
      case '1/2': return 2;
      case '1/4': return 1;
      case '1/8': return 0.5;
      case '1/16': return 0.25;
      default: return 1;
    }
  }, []);

  const snapToGrid = useCallback(
    (beat: number): number => {
      const inc = getSnapIncrement(project.snapGrid);
      return Math.max(0, Math.round(beat / inc) * inc);
    },
    [getSnapIncrement, project.snapGrid]
  );

  // Dragging state
  const [dragState, setDragState] = useState<{
    clipId: string;
    mode: 'move' | 'trim-left' | 'trim-right';
    startX: number;
    initialStartBeat: number;
    initialDurationBeats: number;
    initialTrackId: string;
  } | null>(null);

  // Ruler click/scrub handler
  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedBeat = Math.max(0, clickX / pixelsPerBeat);
    onSeek(snapToGrid(clickedBeat));
  };

  // Mouse move / up handlers for drag & drop
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaBeats = deltaX / pixelsPerBeat;

      if (dragState.mode === 'move') {
        const newStart = snapToGrid(dragState.initialStartBeat + deltaBeats);
        onMoveClip(dragState.clipId, newStart);
      } else if (dragState.mode === 'trim-right') {
        const newDur = Math.max(
          getSnapIncrement(project.snapGrid),
          snapToGrid(dragState.initialDurationBeats + deltaBeats)
        );
        onTrimClip(dragState.clipId, dragState.initialStartBeat, newDur);
      } else if (dragState.mode === 'trim-left') {
        const proposedStart = snapToGrid(dragState.initialStartBeat + deltaBeats);
        const maxStart = dragState.initialStartBeat + dragState.initialDurationBeats - getSnapIncrement(project.snapGrid);
        const clampedStart = Math.min(maxStart, proposedStart);
        const newDur = dragState.initialDurationBeats - (clampedStart - dragState.initialStartBeat);
        onTrimClip(dragState.clipId, clampedStart, newDur);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, getSnapIncrement, onMoveClip, onTrimClip, pixelsPerBeat, project.snapGrid, snapToGrid]);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-950 overflow-x-auto overflow-y-auto relative select-none"
    >
      <div style={{ width: `${timelineWidth}px` }} className="min-w-full">
        {/* ========================================================
            TOP RULER: Measures 1, 2, 3, 4, 5... & Loop Region
            ======================================================== */}
        <div
          onClick={handleRulerClick}
          className="h-10 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-30 cursor-pointer flex relative shadow-xs"
        >
          {/* Measure tick marks */}
          {Array.from({ length: totalMeasures }).map((_, mIdx) => {
            const isFourBar = (mIdx + 1) % 4 === 1;
            return (
              <div
                key={mIdx}
                style={{ width: `${4 * pixelsPerBeat}px` }}
                className="h-full border-r border-slate-800/80 flex items-center px-1 text-[11px] font-mono font-bold text-slate-400 relative"
              >
                <span className={isFourBar ? 'text-amber-300 font-extrabold' : 'text-slate-400'}>
                  {mIdx + 1}
                </span>

                {/* Sub-beat ticks */}
                <div className="absolute bottom-0 left-0 right-0 h-2 flex justify-between px-1 pointer-events-none opacity-40">
                  <div className="w-px h-1.5 bg-slate-600" />
                  <div className="w-px h-1.5 bg-slate-600" />
                  <div className="w-px h-1.5 bg-slate-600" />
                  <div className="w-px h-1.5 bg-slate-600" />
                </div>
              </div>
            );
          })}

          {/* Loop Region Highlight Overlay on Ruler */}
          {project.loopRegion.enabled && (
            <div
              style={{
                left: `${project.loopRegion.startBeat * pixelsPerBeat}px`,
                width: `${(project.loopRegion.endBeat - project.loopRegion.startBeat) * pixelsPerBeat}px`,
              }}
              className="absolute top-0 bottom-0 bg-amber-400/25 border-l-2 border-r-2 border-amber-400 pointer-events-none z-10"
            />
          )}

          {/* Playhead Marker on Ruler */}
          <div
            style={{ left: `${currentBeat * pixelsPerBeat}px` }}
            className="absolute top-0 bottom-0 -ml-2 pointer-events-none z-40 flex flex-col items-center"
          >
            <div className="w-4 h-3 bg-amber-400 rounded-b-xs shadow-md shadow-amber-400/50" />
          </div>
        </div>

        {/* ========================================================
            TRACK LANES & CLIPS
            ======================================================== */}
        <div className="relative divide-y divide-slate-800/60">
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className="h-24 relative bg-slate-950/40 hover:bg-slate-900/30 transition-colors"
            >
              {/* Measure vertical grid guidelines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                  <div
                    key={mIdx}
                    style={{ width: `${4 * pixelsPerBeat}px` }}
                    className="h-full border-r border-slate-900/80"
                  />
                ))}
              </div>

              {/* Render Clips on this Track */}
              {track.clips.map((clip) => {
                const isSelected = selectedClipId === clip.id;
                const clipLeft = clip.startBeat * pixelsPerBeat;
                const clipWidth = Math.max(16, clip.durationBeats * pixelsPerBeat);

                return (
                  <div
                    key={clip.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectClip(clip.id);
                    }}
                    onDoubleClick={() => {
                      if (clip.type === 'midi' && onOpenPianoRollForClip) {
                        onOpenPianoRollForClip(clip.id);
                      }
                    }}
                    style={{
                      left: `${clipLeft}px`,
                      width: `${clipWidth}px`,
                      backgroundColor: `${clip.color}25`,
                      borderColor: isSelected ? '#FBBF24' : clip.color,
                    }}
                    className={`absolute top-2 bottom-2 rounded-xl border-2 shadow-md flex flex-col justify-between overflow-hidden cursor-move transition-all group z-10 ${
                      isSelected ? 'ring-2 ring-amber-400/50 shadow-lg scale-101 z-20' : 'hover:brightness-110'
                    }`}
                    onMouseDown={(e) => {
                      // Avoid dragging when clicking trim handles
                      if ((e.target as HTMLElement).dataset.role === 'trim') return;
                      setDragState({
                        clipId: clip.id,
                        mode: 'move',
                        startX: e.clientX,
                        initialStartBeat: clip.startBeat,
                        initialDurationBeats: clip.durationBeats,
                        initialTrackId: track.id,
                      });
                    }}
                  >
                    {/* Left Trim Handle */}
                    <div
                      data-role="trim"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({
                          clipId: clip.id,
                          mode: 'trim-left',
                          startX: e.clientX,
                          initialStartBeat: clip.startBeat,
                          initialDurationBeats: clip.durationBeats,
                          initialTrackId: track.id,
                        });
                      }}
                      className="absolute left-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-amber-400 cursor-ew-resize transition-all z-20"
                      title="Drag to trim start"
                    />

                    {/* Clip Header Title & Quick Tools */}
                    <div
                      style={{ backgroundColor: `${clip.color}45` }}
                      className="px-2 py-0.5 flex items-center justify-between text-[10px] font-bold text-white border-b border-white/10"
                    >
                      <span className="truncate">{clip.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Duplicate Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateClip(clip.id);
                          }}
                          className="p-0.5 rounded hover:bg-white/20 text-white"
                          title="Duplicate Clip to Right"
                        >
                          <Copy className="w-2.5 h-2.5" />
                        </button>
                        {/* Split at Playhead */}
                        {currentBeat > clip.startBeat &&
                          currentBeat < clip.startBeat + clip.durationBeats && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSplitClip(clip.id, currentBeat);
                              }}
                              className="p-0.5 rounded hover:bg-white/20 text-white"
                              title="Slice/Split at Playhead"
                            >
                              <Scissors className="w-2.5 h-2.5" />
                            </button>
                          )}
                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClip(clip.id);
                          }}
                          className="p-0.5 rounded hover:bg-rose-500/40 text-rose-300"
                          title="Delete Clip"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Clip Body: SVG Waveform (for Audio) or Mini Note Bars (for MIDI) */}
                    <div className="flex-1 px-1.5 flex items-center relative overflow-hidden pointer-events-none">
                      {clip.type === 'audio' && clip.waveform && clip.waveform.length > 0 ? (
                        <svg className="w-full h-8 opacity-85" viewBox={`0 0 ${clip.waveform.length} 40`} preserveAspectRatio="none">
                          {clip.waveform.map((peak, pIdx) => {
                            const barHeight = Math.max(4, peak * 36);
                            const y = 20 - barHeight / 2;
                            return (
                              <rect
                                key={pIdx}
                                x={pIdx}
                                y={y}
                                width="0.75"
                                height={barHeight}
                                fill={clip.color}
                                rx="0.5"
                              />
                            );
                          })}
                        </svg>
                      ) : clip.type === 'midi' && clip.midiNotes && clip.midiNotes.length > 0 ? (
                        <div className="w-full h-full relative">
                          {clip.midiNotes.map((n, nIdx) => {
                            const noteX = (n.startBeat / clip.durationBeats) * 100;
                            const noteW = Math.max(2, (n.durationBeats / clip.durationBeats) * 100);
                            const noteY = 100 - ((n.midi - 36) / 48) * 100;
                            return (
                              <div
                                key={nIdx}
                                style={{
                                  left: `${noteX}%`,
                                  width: `${noteW}%`,
                                  top: `${Math.max(5, Math.min(85, noteY))}%`,
                                  backgroundColor: clip.color,
                                }}
                                className="h-1.5 rounded-xs absolute shadow-xs"
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 italic font-mono">
                          Audio Track
                        </div>
                      )}
                    </div>

                    {/* Right Trim Handle */}
                    <div
                      data-role="trim"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({
                          clipId: clip.id,
                          mode: 'trim-right',
                          startX: e.clientX,
                          initialStartBeat: clip.startBeat,
                          initialDurationBeats: clip.durationBeats,
                          initialTrackId: track.id,
                        });
                      }}
                      className="absolute right-0 top-0 bottom-0 w-2 hover:w-3 bg-white/20 hover:bg-amber-400 cursor-ew-resize transition-all z-20"
                      title="Drag to trim end"
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {/* ========================================================
              FULL-HEIGHT VERTICAL PLAYHEAD LINE ACROSS ALL TRACKS
              ======================================================== */}
          <div
            style={{ left: `${currentBeat * pixelsPerBeat}px` }}
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 shadow-md shadow-amber-400/80 pointer-events-none z-30"
          />
        </div>
      </div>
    </div>
  );
};
