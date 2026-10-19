import React from 'react';
import { Eye, Palette, Hash, Download, Upload, CheckCircle2 } from 'lucide-react';
import { BOOMWHACKER_COLORS } from '../utils/musicMath';
import { NoteStep } from '../types/music';

interface PedagogyBarProps {
  showPitchNames: boolean;
  onTogglePitchNames: () => void;
  boomwhackerColors: boolean;
  onToggleBoomwhackerColors: () => void;
  showBeatCounters: boolean;
  onToggleBeatCounters: () => void;
  lastSavedTime: string | null;
  onExportPdf?: () => void;
  onExportScore: () => void;
  onImportScore: () => void;
}

export const PedagogyBar: React.FC<PedagogyBarProps> = ({
  showPitchNames,
  onTogglePitchNames,
  boomwhackerColors,
  onToggleBoomwhackerColors,
  showBeatCounters,
  onToggleBeatCounters,
  lastSavedTime,
  onExportPdf,
  onExportScore,
  onImportScore,
}) => {
  const steps: NoteStep[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

  return (
    <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
      {/* Student Helper Mode Toggles */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="font-bold text-slate-400 tracking-wider uppercase text-[10px]">
          Student Helpers:
        </span>

        {/* Pitch Names Toggle */}
        <button
          onClick={onTogglePitchNames}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all shadow-xs ${
            showPitchNames
              ? 'bg-sky-500 text-white ring-1 ring-sky-300'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Note Letters</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
              showPitchNames ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {showPitchNames ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Boomwhacker Colors Toggle */}
        <button
          onClick={onToggleBoomwhackerColors}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all shadow-xs ${
            boomwhackerColors
              ? 'bg-amber-500 text-slate-950 ring-1 ring-amber-300'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Boomwhacker Colors</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
              boomwhackerColors ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {boomwhackerColors ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Beat Ruler Toggle */}
        <button
          onClick={onToggleBeatCounters}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all shadow-xs ${
            showBeatCounters
              ? 'bg-indigo-500 text-white ring-1 ring-indigo-300'
              : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          <span>Beat Counter (1-2-3-4)</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
              showBeatCounters ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}
          >
            {showBeatCounters ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Chroma-Notes Mini Legend (when enabled) */}
      {boomwhackerColors && (
        <div className="hidden xl:flex items-center gap-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 shadow-xs">
          <span className="text-[10px] text-slate-400 font-bold mr-1">Chroma:</span>
          {steps.map((st) => (
            <div
              key={st}
              className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-black shadow-xs"
              style={{
                backgroundColor: BOOMWHACKER_COLORS[st].bg,
                color: BOOMWHACKER_COLORS[st].text,
              }}
              title={`${st} = ${BOOMWHACKER_COLORS[st].name}`}
            >
              {st}
            </div>
          ))}
        </div>
      )}

      {/* Save status, Export & Import */}
      <div className="flex items-center gap-2.5">
        {lastSavedTime && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved {lastSavedTime}</span>
          </div>
        )}

        {onExportPdf && (
          <button
            onClick={onExportPdf}
            title="Save sheet music directly as a PDF file"
            className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save PDF</span>
          </button>
        )}

        <button
          onClick={onExportScore}
          title="Export score as JSON file"
          className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export JSON</span>
        </button>

        <button
          onClick={onImportScore}
          title="Load score from JSON file"
          className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Import</span>
        </button>
      </div>
    </div>
  );
};
