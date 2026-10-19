import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Download,
  Music,
  Award,
} from 'lucide-react';
import {
  BeatTrack,
  MelodyTrack,
  MelodyInstrument,
  BassInstrument,
} from '../types';
import { getTempoDescription } from './Header';
import confetti from 'canvas-confetti';

interface SheetMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  bpm: number;
  totalMeasures: number;
  totalStepsInMeasure: 8 | 16;
  tracks: BeatTrack[];
  melodyTracks: MelodyTrack[];
  melodyInstrument: MelodyInstrument;
  bassTracks: MelodyTrack[];
  bassInstrument: BassInstrument;
}

type StaveViewMode = 'all' | 'treble' | 'bass' | 'drums';

// Helper to convert treble note names (e.g. "c4", "g4", "c5") to Staff Y-offset
// 5 staff lines: E4 (40), G4 (30), B4 (20), D5 (10), F5 (0)
function getTrebleNoteStaffY(noteId: string): { y: number; ledgerLines: number[]; noteName: string } {
  const cleanId = noteId.toLowerCase().replace('-bass', '');

  switch (cleanId) {
    case 'c4': return { y: 50, ledgerLines: [50], noteName: 'C4' };
    case 'cs4': return { y: 50, ledgerLines: [50], noteName: 'C♯4' };
    case 'd4': return { y: 45, ledgerLines: [], noteName: 'D4' };
    case 'eb4': return { y: 40, ledgerLines: [], noteName: 'E♭4' }; // Eb same Y as E but flatted
    case 'e4': return { y: 40, ledgerLines: [], noteName: 'E4' };
    case 'f4': return { y: 35, ledgerLines: [], noteName: 'F4' };
    case 'fs4': return { y: 35, ledgerLines: [], noteName: 'F♯4' };
    case 'g4': return { y: 30, ledgerLines: [], noteName: 'G4' };
    case 'ab4': return { y: 25, ledgerLines: [], noteName: 'A♭4' }; // Ab same Y as A but flatted
    case 'a4': return { y: 25, ledgerLines: [], noteName: 'A4' };
    case 'bb4': return { y: 20, ledgerLines: [], noteName: 'B♭4' }; // Bb same Y as B but flatted
    case 'b4': return { y: 20, ledgerLines: [], noteName: 'B4' };
    case 'c5': return { y: 15, ledgerLines: [], noteName: 'C5' };
    case 'cs5': return { y: 15, ledgerLines: [], noteName: 'C♯5' };
    case 'd5': return { y: 10, ledgerLines: [], noteName: 'D5' };
    case 'eb5': return { y: 5, ledgerLines: [], noteName: 'E♭5' };
    case 'e5': return { y: 5, ledgerLines: [], noteName: 'E5' };
    case 'f5': return { y: 0, ledgerLines: [], noteName: 'F5' };
    case 'fs5': return { y: 0, ledgerLines: [], noteName: 'F♯5' };
    case 'g5': return { y: -5, ledgerLines: [-5], noteName: 'G5' };
    case 'ab5': return { y: -10, ledgerLines: [-10], noteName: 'A♭5' };
    case 'a5': return { y: -10, ledgerLines: [-10], noteName: 'A5' };
    case 'bb5': return { y: -15, ledgerLines: [-15], noteName: 'B♭5' };
    case 'b5': return { y: -15, ledgerLines: [-15], noteName: 'B5' };
    case 'c6': return { y: -20, ledgerLines: [-20], noteName: 'C6' };
    default: return { y: 30, ledgerLines: [], noteName: noteId.toUpperCase().replace('S', '♯').replace('B', '♭') };
  }
}

// Bass staff lines: G2 (40), B2 (30), D3 (20), F3 (10), A3 (0)
function getBassNoteStaffY(noteId: string): { y: number; ledgerLines: number[]; noteName: string } {
  const cleanId = noteId.toLowerCase();

  switch (cleanId) {
    case 'c2-bass':
    case 'c2': return { y: 60, ledgerLines: [50, 60], noteName: 'C2' };
    case 'cs2-bass':
    case 'cs2': return { y: 60, ledgerLines: [50, 60], noteName: 'C♯2' };
    case 'd2-bass':
    case 'd2': return { y: 55, ledgerLines: [50], noteName: 'D2' };
    case 'eb2-bass':
    case 'eb2': return { y: 50, ledgerLines: [50], noteName: 'E♭2' };
    case 'e2-bass':
    case 'e2': return { y: 50, ledgerLines: [50], noteName: 'E2' };
    case 'f2-bass':
    case 'f2': return { y: 45, ledgerLines: [], noteName: 'F2' };
    case 'fs2-bass':
    case 'fs2': return { y: 45, ledgerLines: [], noteName: 'F♯2' };
    case 'g2-bass':
    case 'g2': return { y: 40, ledgerLines: [], noteName: 'G2' };
    case 'ab2-bass':
    case 'ab2': return { y: 35, ledgerLines: [], noteName: 'A♭2' };
    case 'a2-bass':
    case 'a2': return { y: 35, ledgerLines: [], noteName: 'A2' };
    case 'bb2-bass':
    case 'bb2': return { y: 30, ledgerLines: [], noteName: 'B♭2' };
    case 'b2-bass':
    case 'b2': return { y: 30, ledgerLines: [], noteName: 'B2' };
    case 'c3-bass':
    case 'c3': return { y: 25, ledgerLines: [], noteName: 'C3' };
    case 'cs3-bass':
    case 'cs3': return { y: 25, ledgerLines: [], noteName: 'C♯3' };
    case 'd3-bass':
    case 'd3': return { y: 20, ledgerLines: [], noteName: 'D3' };
    case 'eb3-bass':
    case 'eb3': return { y: 15, ledgerLines: [], noteName: 'E♭3' };
    case 'e3-bass':
    case 'e3': return { y: 15, ledgerLines: [], noteName: 'E3' };
    case 'f3-bass':
    case 'f3': return { y: 10, ledgerLines: [], noteName: 'F3' };
    case 'fs3-bass':
    case 'fs3': return { y: 10, ledgerLines: [], noteName: 'F♯3' };
    case 'g3-bass':
    case 'g3': return { y: 5, ledgerLines: [], noteName: 'G3' };
    case 'ab3-bass':
    case 'ab3': return { y: 0, ledgerLines: [], noteName: 'A♭3' };
    case 'a3-bass':
    case 'a3': return { y: 0, ledgerLines: [], noteName: 'A3' };
    default: return { y: 25, ledgerLines: [], noteName: noteId.toUpperCase().replace('S', '♯').replace('B', '♭') };
  }
}

export const SheetMusicModal: React.FC<SheetMusicModalProps> = ({
  isOpen,
  onClose,
  bpm,
  totalMeasures,
  totalStepsInMeasure,
  tracks,
  melodyTracks,
  melodyInstrument,
  bassTracks,
  bassInstrument,
}) => {
  const [staveMode, setStaveMode] = useState<StaveViewMode>('all');
  const [studentName, setStudentName] = useState<string>('Young Composer');
  // Requirement 2: Default song title is "My Song"
  const [songTitle, setSongTitle] = useState<string>('My Song');
  const svgRef = useRef<SVGSVGElement | null>(null);

  if (!isOpen) return null;

  const tempoDesc = getTempoDescription(bpm);

  // Print Sheet Music
  const handlePrint = () => {
    window.print();
  };

  // Convert SVG Sheet Music to high-res PNG image download
  const handleDownloadPng = () => {
    if (!svgRef.current) return;

    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Calculate exact intrinsic aspect ratio dimensions
      const svgWidth = 900;
      const svgHeight = staveMode === 'all' ? 730 : 370;
      const scale = 2.5; // High resolution 2.5x print quality

      const canvas = document.createElement('canvas');
      canvas.width = svgWidth * scale;
      canvas.height = svgHeight * scale;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = pngUrl;
        downloadLink.download = `${songTitle.toLowerCase().replace(/\s+/g, '-')}-sheet-music.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);

        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
        });
      }
    };
    img.src = url;
  };

  // Dimensions & Layout calculations
  const staveWidth = 780;
  const startX = 70;
  const measureWidth = staveWidth / totalMeasures;
  const stepsPerBeat = totalStepsInMeasure / 4; // 4 in 16-step mode, 2 in 8-step mode

  // Measure-Aware Note X Coordinate Engine (keeps all notes strictly inside bar lines)
  const calculateNoteX = (mIdx: number, sInMeasure: number): number => {
    const measureStartX = startX + mIdx * measureWidth;
    if (mIdx === 0) {
      // Clef & 4/4 Time Signature occupy space up to 62px
      const leftMargin = 62;
      const rightMargin = 15;
      const usableWidth = measureWidth - leftMargin - rightMargin;
      return measureStartX + leftMargin + (sInMeasure + 0.5) * (usableWidth / totalStepsInMeasure);
    } else {
      const leftMargin = 15;
      const rightMargin = 15;
      const usableWidth = measureWidth - leftMargin - rightMargin;
      return measureStartX + leftMargin + (sInMeasure + 0.5) * (usableWidth / totalStepsInMeasure);
    }
  };

  // Rhythmic Notation Beam Engine for Melody / Bass
  const renderRhythmicStaveGroup = (
    noteTracks: MelodyTrack[],
    getStaffY: (noteId: string) => { y: number; ledgerLines: number[]; noteName: string },
    color: string,
    staveYOffset: number,
    isBass: boolean = false
  ) => {
    const renderedElements: React.ReactNode[] = [];

    for (let mIdx = 0; mIdx < totalMeasures; mIdx++) {
      const measureStartStep = mIdx * totalStepsInMeasure;

      // Group active notes by beat (4 beats per measure)
      for (let bIdx = 0; bIdx < 4; bIdx++) {
        const beatStartStep = measureStartStep + bIdx * stepsPerBeat;
        const activeNotesInBeat: {
          noteId: string;
          absStep: number;
          stepInBeat: number;
          y: number;
          ledgerLines: number[];
          noteName: string;
          noteX: number;
        }[] = [];

        for (let sInBeat = 0; sInBeat < stepsPerBeat; sInBeat++) {
          const absStep = beatStartStep + sInBeat;
          const sInMeasure = bIdx * stepsPerBeat + sInBeat;
          noteTracks.forEach((t) => {
            if (t.steps[absStep]) {
              const { y, ledgerLines, noteName } = getStaffY(t.note.id);
              const noteX = calculateNoteX(mIdx, sInMeasure);

              activeNotesInBeat.push({
                noteId: t.note.id,
                absStep,
                stepInBeat: sInBeat,
                y,
                ledgerLines,
                noteName,
                noteX,
              });
            }
          });
        }

        // If no notes in beat: render quarter rest symbol 𝄽 on middle staff line (Y=20)
        if (activeNotesInBeat.length === 0) {
          const beatCenterStepInMeasure = (bIdx + 0.5) * stepsPerBeat - 0.5;
          const beatCenterX = calculateNoteX(mIdx, beatCenterStepInMeasure);
          renderedElements.push(
            <text
              key={`rest-${staveYOffset}-${mIdx}-${bIdx}`}
              x={beatCenterX}
              y="24"
              textAnchor="middle"
              className="text-lg font-black fill-slate-400 font-sans"
            >
              𝄽
            </text>
          );
          continue;
        }

        // Determine common stem top beam line (highest note or fixed top)
        const highestY = Math.min(...activeNotesInBeat.map((n) => n.y));
        const beamY = Math.min(-18, highestY - 24);

        // Case A: Multiple active 8th / 16th notes in beat -> Draw Connected Beams!
        if (activeNotesInBeat.length >= 2) {
          const minX = activeNotesInBeat[0].noteX;
          const maxX = activeNotesInBeat[activeNotesInBeat.length - 1].noteX;

          // Primary horizontal beam line
          renderedElements.push(
            <line
              key={`beam-primary-${staveYOffset}-${mIdx}-${bIdx}`}
              x1={minX + 4}
              y1={beamY}
              x2={maxX + 4}
              y2={beamY}
              stroke={color}
              strokeWidth="3.5"
            />
          );

          // If in 16-step mode and includes 16th subdivisions, draw secondary 16th beam!
          if (totalStepsInMeasure === 16) {
            renderedElements.push(
              <line
                key={`beam-secondary-${staveYOffset}-${mIdx}-${bIdx}`}
                x1={minX + 4}
                y1={beamY + 5}
                x2={maxX + 4}
                y2={beamY + 5}
                stroke={color}
                strokeWidth="2"
              />
            );
          }

          // Individual Noteheads and Stems connected to the beam
          activeNotesInBeat.forEach((n, nIdx) => {
            renderedElements.push(
              <g key={`note-beamed-${staveYOffset}-${mIdx}-${bIdx}-${nIdx}`}>
                {/* Ledger Lines */}
                {n.ledgerLines.map((lY, lIdx) => (
                  <line
                    key={`ledger-${n.absStep}-${lIdx}`}
                    x1={n.noteX - 9}
                    y1={lY}
                    x2={n.noteX + 9}
                    y2={lY}
                    stroke="#0f172a"
                    strokeWidth="1.2"
                  />
                ))}

                {/* Vertical Stem to Beam */}
                <line
                  x1={n.noteX + 4}
                  y1={n.y}
                  x2={n.noteX + 4}
                  y2={beamY}
                  stroke={color}
                  strokeWidth="1.6"
                />

                {/* Oval Note Head (filled for 8th/16th notes) */}
                <ellipse
                  cx={n.noteX}
                  cy={n.y}
                  rx="5"
                  ry="4"
                  transform={`rotate(-20 ${n.noteX} ${n.y})`}
                  fill={color}
                />

                {/* Accidental (Sharp / Flat) */}
                {n.noteName.includes('♯') && (
                  <text x={n.noteX - 14} y={n.y + 4} fontSize="12" fill={color} fontWeight="900" fontFamily="serif">♯</text>
                )}
                {n.noteName.includes('♭') && (
                  <text x={n.noteX - 14} y={n.y + 4} fontSize="12" fill={color} fontWeight="900" fontFamily="serif">♭</text>
                )}
              </g>
            );
          });
        } else {
          // Case B: Single Note in Beat -> Draw Flags or Quarter Stem
          const n = activeNotesInBeat[0];
          const isSixteenth = totalStepsInMeasure === 16 && (n.stepInBeat === 1 || n.stepInBeat === 3);
          const isEighth = totalStepsInMeasure === 8 || (totalStepsInMeasure === 16 && (n.stepInBeat === 2));

          renderedElements.push(
            <g key={`note-single-${staveYOffset}-${mIdx}-${bIdx}`}>
              {/* Ledger Lines */}
              {n.ledgerLines.map((lY, lIdx) => (
                <line
                  key={`ledger-s-${n.absStep}-${lIdx}`}
                  x1={n.noteX - 9}
                  y1={lY}
                  x2={n.noteX + 9}
                  y2={lY}
                  stroke="#0f172a"
                  strokeWidth="1.2"
                />
              ))}

              {/* Vertical Stem */}
              <line
                x1={n.noteX + 4}
                y1={n.y}
                x2={n.noteX + 4}
                y2={beamY}
                stroke={color}
                strokeWidth="1.6"
              />

              {/* 16th Note Double Flag or 8th Note Single Flag */}
              {isSixteenth && (
                <>
                  <path
                    d={`M ${n.noteX + 4} ${beamY} Q ${n.noteX + 13} ${beamY + 4} ${n.noteX + 11} ${beamY + 12}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                  />
                  <path
                    d={`M ${n.noteX + 4} ${beamY + 6} Q ${n.noteX + 13} ${beamY + 10} ${n.noteX + 11} ${beamY + 18}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                  />
                </>
              )}

              {isEighth && (
                <path
                  d={`M ${n.noteX + 4} ${beamY} Q ${n.noteX + 13} ${beamY + 4} ${n.noteX + 11} ${beamY + 12}`}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                />
              )}

              {/* Oval Note Head */}
              <ellipse
                cx={n.noteX}
                cy={n.y}
                rx="5"
                ry="4"
                transform={`rotate(-20 ${n.noteX} ${n.y})`}
                fill={color}
              />

              {/* Accidental (Sharp / Flat) */}
              {n.noteName.includes('♯') && (
                <text x={n.noteX - 14} y={n.y + 4} fontSize="12" fill={color} fontWeight="900" fontFamily="serif">♯</text>
              )}
              {n.noteName.includes('♭') && (
                <text x={n.noteX - 14} y={n.y + 4} fontSize="12" fill={color} fontWeight="900" fontFamily="serif">♭</text>
              )}
            </g>
          );
        }
      }
    }

    return renderedElements;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-auto w-full max-w-5xl rounded-3xl border-2 border-amber-400/60 bg-slate-900 text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 p-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 text-slate-950 shadow-md">
              <Music className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-amber-300 tracking-tight flex items-center gap-2">
                <span>Sheet Music Notation</span>
                <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-400/30">
                  🎼 Accurate 8th & 16th Rhythm Score
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Accurate Western notation staves with 8th/16th note beams, flags, rests, and pitch labels for your composition!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-850 p-4 border-b border-slate-800 text-xs sm:text-sm">
          {/* Editable Song Title & Composer Name */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400 font-bold text-xs uppercase">Title:</span>
              <input
                type="text"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="bg-transparent font-black text-amber-300 focus:outline-none w-48 sm:w-56"
                placeholder="Song Title"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
              <span className="text-slate-400 font-bold text-xs uppercase">Composer:</span>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="bg-transparent font-black text-cyan-300 focus:outline-none w-36 sm:w-44"
                placeholder="Student Name"
              />
            </div>
          </div>

          {/* Stave Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStaveMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                staveMode === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Grand Staff (All)
            </button>
            <button
              onClick={() => setStaveMode('treble')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                staveMode === 'treble'
                  ? 'bg-pink-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎼 Melody
            </button>
            <button
              onClick={() => setStaveMode('bass')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                staveMode === 'bass'
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🄱 Bass
            </button>
            <button
              onClick={() => setStaveMode('drums')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                staveMode === 'drums'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🥁 Drums
            </button>
          </div>

          {/* Actions: Print & Save Image */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 font-bold text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700 active:scale-95 transition-transform"
            >
              <Printer className="h-4 w-4" />
              <span>Print Score</span>
            </button>

            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 font-black text-slate-950 shadow-lg hover:from-amber-300 hover:to-orange-400 active:scale-95 transition-transform"
            >
              <Download className="h-4 w-4" />
              <span>Save Sheet Music PNG</span>
            </button>
          </div>
        </div>

        {/* Sheet Music Printable SVG Document Scroll Container */}
        <div className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-8 flex justify-center">
          {/* Authentic White Paper Sheet Document */}
          <div className="w-full max-w-[880px] bg-white text-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-slate-200 print:shadow-none print:p-0 print:border-none print:w-full">
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              width="900"
              height={staveMode === 'all' ? 730 : 370}
              viewBox={staveMode === 'all' ? '0 0 900 730' : '0 0 900 370'}
              className="w-full h-auto font-serif select-none"
              style={{ backgroundColor: '#ffffff' }}
            >
              {/* Score Header Title */}
              <text x="450" y="55" textAnchor="middle" fill="#0f172a" fontSize="24" fontWeight="900" fontFamily="sans-serif">
                {songTitle}
              </text>
              <text x="450" y="80" textAnchor="middle" fill="#475569" fontSize="14" fontWeight="600" fontFamily="sans-serif">
                Composed by {studentName} • Mr. Arthur's Beat Machine
              </text>

              {/* Tempo & Time Signature Header Line */}
              <text x="70" y="115" textAnchor="start" fill="#1e293b" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                {tempoDesc.term} ({tempoDesc.translation}) ♩ = {bpm} BPM
              </text>

              <text x="830" y="115" textAnchor="end" fill="#1e293b" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                Time: 4/4 • {totalMeasures} {totalMeasures === 1 ? 'Measure' : 'Measures'} ({totalStepsInMeasure === 16 ? '16th Notes' : '8th Notes'})
              </text>

              <line x1="70" y1="125" x2="830" y2="125" stroke="#cbd5e1" strokeWidth="1" />

              {/* --- STAVE 1: TREBLE CLEF (MELODY) --- */}
              {(staveMode === 'all' || staveMode === 'treble') && (
                <g id="treble-stave" transform="translate(0, 160)">
                  {/* Stave Header Label */}
                  <text x="70" y="-38" fill="#1e1b4b" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                    Melody 🎼
                  </text>

                  {/* 5 Staff Lines */}
                  {[0, 10, 20, 30, 40].map((lineY, idx) => (
                    <line
                      key={`treble-line-${idx}`}
                      x1={startX}
                      y1={lineY}
                      x2={startX + staveWidth}
                      y2={lineY}
                      stroke="#1e293b"
                      strokeWidth="1.2"
                    />
                  ))}

                  {/* Treble Clef Symbol */}
                  <text x={startX + 8} y="38" fill="#0f172a" fontSize="30" fontWeight="900" fontFamily="sans-serif">
                    🎼
                  </text>

                  {/* 4/4 Time Signature */}
                  <text x={startX + 45} y="18" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>
                  <text x={startX + 45} y="36" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>

                  {/* Vertical Bar Lines dividing measures */}
                  {Array.from({ length: totalMeasures + 1 }).map((_, mIdx) => {
                    const barX = startX + mIdx * measureWidth;
                    const isFirst = mIdx === 0;
                    const isLast = mIdx === totalMeasures;
                    return (
                      <g key={`treble-bar-${mIdx}`}>
                        {isLast ? (
                          <>
                            {/* Double Bar Line at end of score */}
                            <line x1={barX - 4} y1="0" x2={barX - 4} y2="40" stroke="#0f172a" strokeWidth="1.2" />
                            <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth="3.5" />
                          </>
                        ) : (
                          <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth={isFirst ? '2' : '1.5'} />
                        )}
                        {mIdx < totalMeasures && (
                          <text
                            x={mIdx === 0 ? barX + 62 : barX + 6}
                            y="-22"
                            fill="#64748b"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="sans-serif"
                          >
                            m.{mIdx + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Render Melody Notes with Beams & Rhythmic Flags */}
                  {renderRhythmicStaveGroup(melodyTracks, getTrebleNoteStaffY, '#1e1b4b', 160, false)}
                </g>
              )}

              {/* --- STAVE 2: BASS CLEF (BASS LINE) --- */}
              {(staveMode === 'all' || staveMode === 'bass') && (
                <g id="bass-stave" transform={`translate(0, ${staveMode === 'bass' ? 160 : 320})`}>
                  {/* Stave Header Label */}
                  <text x="70" y="-38" fill="#581c87" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                    Bass 🎸
                  </text>

                  {/* 5 Staff Lines */}
                  {[0, 10, 20, 30, 40].map((lineY, idx) => (
                    <line
                      key={`bass-line-${idx}`}
                      x1={startX}
                      y1={lineY}
                      x2={startX + staveWidth}
                      y2={lineY}
                      stroke="#1e293b"
                      strokeWidth="1.2"
                    />
                  ))}

                  {/* Bass Clef Symbol */}
                  <text x={startX + 8} y="32" fill="#0f172a" fontSize="24" fontWeight="900" fontFamily="sans-serif">
                    𝄢
                  </text>

                  {/* 4/4 Time Signature */}
                  <text x={startX + 45} y="18" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>
                  <text x={startX + 45} y="36" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>

                  {/* Vertical Bar Lines dividing measures */}
                  {Array.from({ length: totalMeasures + 1 }).map((_, mIdx) => {
                    const barX = startX + mIdx * measureWidth;
                    const isFirst = mIdx === 0;
                    const isLast = mIdx === totalMeasures;
                    return (
                      <g key={`bass-bar-${mIdx}`}>
                        {isLast ? (
                          <>
                            <line x1={barX - 4} y1="0" x2={barX - 4} y2="40" stroke="#0f172a" strokeWidth="1.2" />
                            <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth="3.5" />
                          </>
                        ) : (
                          <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth={isFirst ? '2' : '1.5'} />
                        )}
                        {mIdx < totalMeasures && (
                          <text
                            x={mIdx === 0 ? barX + 62 : barX + 6}
                            y="-22"
                            fill="#64748b"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="sans-serif"
                          >
                            m.{mIdx + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Render Bass Notes with Beams & Rhythmic Flags */}
                  {renderRhythmicStaveGroup(bassTracks, getBassNoteStaffY, '#581c87', 320, true)}
                </g>
              )}

              {/* Grand Staff Brace & Connecting Systemic Bar Lines */}
              {staveMode === 'all' && (
                <g id="grand-staff-connectors">
                  <line
                    x1={startX}
                    y1="160"
                    x2={startX}
                    y2="360"
                    stroke="#0f172a"
                    strokeWidth="3"
                  />
                  {Array.from({ length: totalMeasures + 1 }).map((_, mIdx) => {
                    const barX = startX + mIdx * measureWidth;
                    const isLast = mIdx === totalMeasures;
                    return (
                      <g key={`systemic-bar-${mIdx}`}>
                        {isLast ? (
                          <>
                            <line x1={barX - 4} y1="160" x2={barX - 4} y2="360" stroke="#0f172a" strokeWidth="1.2" />
                            <line x1={barX} y1="160" x2={barX} y2="360" stroke="#0f172a" strokeWidth="3.5" />
                          </>
                        ) : (
                          <line x1={barX} y1="160" x2={barX} y2="360" stroke="#0f172a" strokeWidth="1.5" />
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* --- STAVE 3: PERCUSSION / DRUMS --- */}
              {(staveMode === 'all' || staveMode === 'drums') && (
                <g id="drum-stave" transform={`translate(0, ${staveMode === 'drums' ? 160 : 470})`}>
                  {/* Stave Header Label */}
                  <text x="70" y="-38" fill="#065f46" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                    Drums 🥁
                  </text>

                  {/* 5 Staff Lines */}
                  {[0, 10, 20, 30, 40].map((lineY, idx) => (
                    <line
                      key={`drum-line-${idx}`}
                      x1={startX}
                      y1={lineY}
                      x2={startX + staveWidth}
                      y2={lineY}
                      stroke="#1e293b"
                      strokeWidth="1.2"
                    />
                  ))}

                  {/* Percussion Clef Symbol */}
                  <rect x={startX + 14} y="5" width="4" height="30" fill="#0f172a" />
                  <rect x={startX + 22} y="5" width="4" height="30" fill="#0f172a" />

                  {/* 4/4 Time Signature */}
                  <text x={startX + 45} y="18" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>
                  <text x={startX + 45} y="36" fill="#0f172a" fontSize="16" fontWeight="900" fontFamily="sans-serif">
                    4
                  </text>

                  {/* Vertical Bar Lines dividing measures */}
                  {Array.from({ length: totalMeasures + 1 }).map((_, mIdx) => {
                    const barX = startX + mIdx * measureWidth;
                    const isFirst = mIdx === 0;
                    const isLast = mIdx === totalMeasures;
                    return (
                      <g key={`drum-bar-${mIdx}`}>
                        {isLast ? (
                          <>
                            <line x1={barX - 4} y1="0" x2={barX - 4} y2="40" stroke="#0f172a" strokeWidth="1.2" />
                            <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth="3.5" />
                          </>
                        ) : (
                          <line x1={barX} y1="0" x2={barX} y2="40" stroke="#0f172a" strokeWidth={isFirst ? '2' : '1.5'} />
                        )}
                        {mIdx < totalMeasures && (
                          <text
                            x={mIdx === 0 ? barX + 62 : barX + 6}
                            y="-22"
                            fill="#64748b"
                            fontSize="10"
                            fontWeight="700"
                            fontFamily="sans-serif"
                          >
                            m.{mIdx + 1}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Render Drum Track Beats */}
                  {tracks.map((track, trackIdx) => {
                    let drumY = 20;
                    let isXNotehead = false;

                    const soundType = track.sample.soundType;
                    if (soundType === 'kick' || soundType === 'acoustic-kick') drumY = 40;
                    else if (soundType === 'snare' || soundType === 'acoustic-snare') drumY = 20;
                    else if (soundType === 'hihat' || soundType === 'closed-hat' || soundType === 'open-hat') {
                      drumY = 0;
                      isXNotehead = true;
                    } else if (soundType === 'clap' || soundType === 'shaker' || soundType === 'tambourine') drumY = 10;
                    else if (soundType === 'tom' || soundType === 'conga' || soundType === 'bongo') drumY = 30;
                    else {
                      drumY = 10 + (trackIdx % 4) * 8;
                    }

                    return track.steps.slice(0, totalMeasures * totalStepsInMeasure).map((isActive, sIdx) => {
                      if (!isActive) return null;

                      const measureIdx = Math.floor(sIdx / totalStepsInMeasure);
                      const stepInMeasure = sIdx % totalStepsInMeasure;
                      const noteX = calculateNoteX(measureIdx, stepInMeasure);

                      return (
                        <g key={`drum-note-${track.id}-${sIdx}`}>
                          {/* Stem */}
                          <line
                            x1={noteX + 4}
                            y1={drumY}
                            x2={noteX + 4}
                            y2={drumY - 18}
                            stroke="#065f46"
                            strokeWidth="1.5"
                          />

                          {/* Note head */}
                          {isXNotehead ? (
                            <text
                              x={noteX}
                              y={drumY + 4}
                              textAnchor="middle"
                              fill="#065f46"
                              fontSize="12"
                              fontWeight="900"
                              fontFamily="sans-serif"
                            >
                              ✕
                            </text>
                          ) : (
                            <ellipse
                              cx={noteX}
                              cy={drumY}
                              rx="5"
                              ry="4"
                              transform={`rotate(-20 ${noteX} ${drumY})`}
                              fill="#065f46"
                            />
                          )}

                        </g>
                      );
                    });
                  })}
                </g>
              )}

              {/* Legend & Educational Guide Footer */}
              <g id="score-footer" transform={`translate(70, ${staveMode === 'all' ? 610 : 250})`}>
                <rect x="0" y="0" width="760" height="90" rx="12" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />

                <text x="20" y="24" fill="#1e293b" fontSize="12" fontWeight="900" fontFamily="sans-serif">
                  🎓 Music Theory & Rhythm Guide for Students:
                </text>

                <text x="20" y="46" fill="#475569" fontSize="11" fontWeight="500" fontFamily="sans-serif">
                  • 8th & 16th Note Beams (♫ / 𝅘𝅥𝅯): Connected horizontal beams represent fast 8th and 16th note rhythms.
                </text>

                <text x="20" y="65" fill="#475569" fontSize="11" fontWeight="500" fontFamily="sans-serif">
                  • Quarter Rests (𝄽): Represent silent beats where no note is played.
                </text>

                <text x="20" y="82" fill="#475569" fontSize="11" fontWeight="500" fontFamily="sans-serif">
                  • Percussion Staff (🥁): Displays Kick, Snare, and Hi-Hat rhythmic beat patterns.
                </text>

                <text x="740" y="55" textAnchor="end" fill="#d97706" fontSize="12" fontWeight="700" fontFamily="sans-serif">
                  ★ Certified Student Composer Score ★
                </text>
              </g>
            </svg>
          </div>
        </div>

        {/* Modal Footer Banner */}
        <div className="flex items-center justify-between bg-slate-950 p-4 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <Award className="h-4 w-4 text-amber-400" />
            <span>Students can save sheet music as a PNG image or print directly for music class!</span>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-5 py-2 font-black text-white hover:bg-slate-700 transition-colors"
          >
            Done Viewing
          </button>
        </div>
      </div>
    </div>
  );
};
