import React, { useState } from 'react';
import { CountingMode, NoteLabelMode, Score, UiMode } from '../types/music';
import { ScoreRenderer } from './ScoreRenderer';
import { Printer, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { exportScoreToPdf } from '../utils/pdfExport';

interface PrintViewProps {
  score: Score;
  onExit: () => void;
  uiMode?: UiMode;
  showPitchNames: boolean;
  noteLabelMode?: NoteLabelMode;
  boomwhackerColors: boolean;
  showBeatCounters: boolean;
  countingMode?: CountingMode;
}

export const PrintView: React.FC<PrintViewProps> = ({
  score,
  onExit,
  uiMode = 'standard',
  showPitchNames,
  noteLabelMode,
  boomwhackerColors,
  showBeatCounters,
  countingMode,
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    const svgEl = document.querySelector<SVGSVGElement>('#staff-composer-score-svg');
    if (!svgEl || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await exportScoreToPdf(score, svgEl);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-6 sm:p-8 flex flex-col items-center print:p-0 print:block">
      {/* Non-printed control header */}
      <div className="w-full max-w-6xl flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 print:hidden">
        <button
          onClick={onExit}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Editor</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExportingPdf ? 'Generating PDF...' : 'Save PDF'}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Music Page */}
      <div className="w-full max-w-6xl print:max-w-none print:w-full bg-white flex flex-col items-center">
        {/* Title & Composer Header */}
        <div className="w-full text-center pb-6 print:pb-4 border-b-2 border-slate-900 mb-4 print:mb-2">
          <h1 className="text-3xl font-bold font-serif tracking-tight text-slate-950">
            {score.title || 'Untitled Composition'}
          </h1>
          <div className="flex justify-between items-center mt-3 text-sm text-slate-700 font-medium px-4">
            <span>
              Tempo: {score.tempo} BPM · Meter: {score.timeSignature[0]}/{score.timeSignature[1]}
            </span>
            <span className="italic">Arr. & Composed by: {score.composer || 'Student'}</span>
          </div>
        </div>

        {/* Score Render */}
        <div className="w-full overflow-visible [&_svg]:w-full [&_svg]:h-auto [&_svg]:max-w-full">
          <ScoreRenderer
            score={score}
            selection={null}
            onSelect={() => {}}
            onNoteInsertOrUpdate={() => {}}
            onPlayPreview={() => {}}
            isSelectMode={true}
            uiMode={uiMode}
            activeDuration={0.25}
            activeAccidental={null}
            activeDotted={false}
            showPitchNames={showPitchNames}
            noteLabelMode={noteLabelMode}
            boomwhackerColors={boomwhackerColors}
            showBeatCounters={showBeatCounters}
            countingMode={countingMode}
            playheadPosition={null}
            activePlayingNoteIds={new Set()}
          />
        </div>

        {/* Classroom footer */}
        <div className="w-full mt-8 print:mt-4 pt-4 border-t border-slate-300 flex justify-between text-xs text-slate-500 font-medium">
          <span>Student Name: _______________________</span>
          <span>Date: ________________</span>
          <span>Staff Composer</span>
        </div>
      </div>
    </div>
  );
};
