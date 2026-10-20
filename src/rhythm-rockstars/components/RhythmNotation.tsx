import React, { useMemo } from 'react';
import { RhythmPattern, RhythmUnit, NoteType } from '../types/rhythm';
import { SyllableStyle } from '../types/game';
import { getUnitsWithMeasureCounting } from '../utils/rhythmCounting';

interface RhythmNotationProps {
  pattern: RhythmPattern;
  highlightedUnitIndex?: number | null;
  syllableStyle?: SyllableStyle;
  interactive?: boolean;
  onUnitClick?: (unitIndex: number) => void;
  size?: 'sm' | 'md' | 'lg';
  showMeasureLines?: boolean;
}

// Individual Note SVG Renderer
export const NoteGlyphSVG: React.FC<{
  type: NoteType;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}> = ({ type, isActive = false, size = 'md' }) => {
  const height = size === 'sm' ? 64 : size === 'lg' ? 104 : 80;
  const strokeColor = isActive ? '#FACC15' : '#E2E8F0';
  const fillColor = isActive ? '#FACC15' : '#FFFFFF';

  // Base staff line height reference
  const staffLineY = 56;

  switch (type) {
    case 'quarter':
      return (
        <svg viewBox="0 0 60 90" height={height} className="overflow-visible">
          {/* Notehead */}
          <ellipse
            cx="24"
            cy="62"
            rx="9"
            ry="6.5"
            transform="rotate(-22 24 62)"
            fill={fillColor}
            className="transition-colors duration-150"
          />
          {/* Stem */}
          <line
            x1="32"
            y1="60"
            x2="32"
            y2="16"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'quarter_rest':
      return (
        <svg viewBox="0 0 50 90" height={height} className="overflow-visible">
          {/* Classic Quarter Rest Glyphic Path */}
          <path
            d="M 24 16 
               L 31 34 
               L 20 48 
               L 31 58 
               C 33 66 22 75 18 72 
               C 17 68 25 64 25 60 
               L 18 52 
               L 27 40 
               L 18 26 Z"
            fill={fillColor}
            className="transition-colors duration-150"
          />
        </svg>
      );

    case 'eighth_pair':
      return (
        <svg viewBox="0 0 90 90" height={height} className="overflow-visible">
          {/* Notehead 1 */}
          <ellipse cx="22" cy="62" rx="8.5" ry="6" transform="rotate(-22 22 62)" fill={fillColor} />
          {/* Stem 1 */}
          <line x1="29.5" y1="60" x2="29.5" y2="18" stroke={strokeColor} strokeWidth="3" />
          
          {/* Notehead 2 */}
          <ellipse cx="66" cy="62" rx="8.5" ry="6" transform="rotate(-22 66 62)" fill={fillColor} />
          {/* Stem 2 */}
          <line x1="73.5" y1="60" x2="73.5" y2="18" stroke={strokeColor} strokeWidth="3" />
          
          {/* Connecting Beam */}
          <polygon
            points="29.5,15 73.5,15 73.5,23 29.5,23"
            fill={fillColor}
          />
        </svg>
      );

    case 'eighth_rest_eighth': // 8th rest + 8th note
      return (
        <svg viewBox="0 0 90 90" height={height} className="overflow-visible">
          {/* Eighth Rest glyph (left side) */}
          <path
            d="M 24 38 C 22 35 18 36 17 38 C 16 41 18 43 21 43 C 24 43 26 40 28 36 L 25 58"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="18" cy="40" r="3" fill={fillColor} />

          {/* Eighth Note (right side) */}
          <ellipse cx="62" cy="62" rx="8.5" ry="6" transform="rotate(-22 62 62)" fill={fillColor} />
          <line x1="69.5" y1="60" x2="69.5" y2="18" stroke={strokeColor} strokeWidth="3" />
          <path
            d="M 69.5 18 Q 82 24 78 40"
            stroke={strokeColor}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'eighth_eighth_rest': // 8th note + 8th rest
      return (
        <svg viewBox="0 0 90 90" height={height} className="overflow-visible">
          {/* Eighth Note (left side) */}
          <ellipse cx="26" cy="62" rx="8.5" ry="6" transform="rotate(-22 26 62)" fill={fillColor} />
          <line x1="33.5" y1="60" x2="33.5" y2="18" stroke={strokeColor} strokeWidth="3" />
          <path
            d="M 33.5 18 Q 46 24 42 40"
            stroke={strokeColor}
            strokeWidth="3.2"
            fill="none"
            strokeLinecap="round"
          />

          {/* Eighth Rest glyph (right side) */}
          <path
            d="M 68 38 C 66 35 62 36 61 38 C 60 41 62 43 65 43 C 68 43 70 40 72 36 L 69 58"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="62" cy="40" r="3" fill={fillColor} />
        </svg>
      );

    case 'sixteenth_quad':
      return (
        <svg viewBox="0 0 130 90" height={height} className="overflow-visible">
          {/* 4 Noteheads */}
          {[16, 46, 76, 106].map((x, idx) => (
            <React.Fragment key={idx}>
              <ellipse cx={x} cy="62" rx="7.5" ry="5.5" transform={`rotate(-22 ${x} 62)`} fill={fillColor} />
              <line x1={x + 6.8} y1="60" x2={x + 6.8} y2="16" stroke={strokeColor} strokeWidth="2.8" />
            </React.Fragment>
          ))}
          {/* Top Beam */}
          <polygon points="22.8,14 112.8,14 112.8,20 22.8,20" fill={fillColor} />
          {/* Secondary Beam */}
          <polygon points="22.8,24 112.8,24 112.8,30 22.8,30" fill={fillColor} />
        </svg>
      );

    case 'broken_eighth_two_sixteenth': // Ti-Tika (1 8th + 2 16ths)
      return (
        <svg viewBox="0 0 110 90" height={height} className="overflow-visible">
          {/* 3 Noteheads: spaced 1 eighth, 2 sixteenths */}
          <ellipse cx="20" cy="62" rx="8" ry="6" transform="rotate(-22 20 62)" fill={fillColor} />
          <line x1="27" y1="60" x2="27" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          <ellipse cx="58" cy="62" rx="8" ry="6" transform="rotate(-22 58 62)" fill={fillColor} />
          <line x1="65" y1="60" x2="65" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          <ellipse cx="88" cy="62" rx="8" ry="6" transform="rotate(-22 88 62)" fill={fillColor} />
          <line x1="95" y1="60" x2="95" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Primary full beam */}
          <polygon points="27,14 95,14 95,20 27,20" fill={fillColor} />
          {/* Secondary beam across only 2nd and 3rd stems */}
          <polygon points="65,24 95,24 95,30 65,30" fill={fillColor} />
        </svg>
      );

    case 'broken_two_sixteenth_eighth': // Tika-Ti (2 16ths + 1 8th)
      return (
        <svg viewBox="0 0 110 90" height={height} className="overflow-visible">
          {/* 3 Noteheads */}
          <ellipse cx="20" cy="62" rx="8" ry="6" transform="rotate(-22 20 62)" fill={fillColor} />
          <line x1="27" y1="60" x2="27" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          <ellipse cx="50" cy="62" rx="8" ry="6" transform="rotate(-22 50 62)" fill={fillColor} />
          <line x1="57" y1="60" x2="57" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          <ellipse cx="88" cy="62" rx="8" ry="6" transform="rotate(-22 88 62)" fill={fillColor} />
          <line x1="95" y1="60" x2="95" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Primary full beam */}
          <polygon points="27,14 95,14 95,20 27,20" fill={fillColor} />
          {/* Secondary beam across 1st and 2nd stems only */}
          <polygon points="27,24 57,24 57,30 27,30" fill={fillColor} />
        </svg>
      );

    case 'broken_dotted_sixteenth': // Tim-Ka (dotted 8th + 16th)
      return (
        <svg viewBox="0 0 95 90" height={height} className="overflow-visible">
          {/* Dotted Eighth note */}
          <ellipse cx="22" cy="62" rx="8.5" ry="6" transform="rotate(-22 22 62)" fill={fillColor} />
          <circle cx="37" cy="62" r="3" fill={fillColor} />
          <line x1="29.5" y1="60" x2="29.5" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* 16th note */}
          <ellipse cx="72" cy="62" rx="8.5" ry="6" transform="rotate(-22 72 62)" fill={fillColor} />
          <line x1="79.5" y1="60" x2="79.5" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Full Beam */}
          <polygon points="29.5,14 79.5,14 79.5,20 29.5,20" fill={fillColor} />
          {/* 16th Stub beam pointing left from 2nd stem */}
          <polygon points="63,24 79.5,24 79.5,30 63,30" fill={fillColor} />
        </svg>
      );

    case 'broken_sixteenth_dotted': // Ka-Tim (16th + dotted 8th, Scotch Snap)
      return (
        <svg viewBox="0 0 95 90" height={height} className="overflow-visible">
          {/* 16th note on left */}
          <ellipse cx="22" cy="62" rx="8.5" ry="6" transform="rotate(-22 22 62)" fill={fillColor} />
          <line x1="29.5" y1="60" x2="29.5" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Dotted 8th note on right */}
          <ellipse cx="72" cy="62" rx="8.5" ry="6" transform="rotate(-22 72 62)" fill={fillColor} />
          <circle cx="87" cy="62" r="3" fill={fillColor} />
          <line x1="79.5" y1="60" x2="79.5" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Full Primary Beam */}
          <polygon points="29.5,14 79.5,14 79.5,20 29.5,20" fill={fillColor} />
          {/* 16th Stub beam pointing right from 1st stem */}
          <polygon points="29.5,24 46,24 46,30 29.5,30" fill={fillColor} />
        </svg>
      );

    case 'sixteenth_eighth_sixteenth': // Single-Beat Syncopation (16th + 8th + 16th)
      return (
        <svg viewBox="0 0 115 90" height={height} className="overflow-visible">
          {/* Notehead 1 (16th) */}
          <ellipse cx="20" cy="62" rx="7.5" ry="5.5" transform="rotate(-22 20 62)" fill={fillColor} />
          <line x1="27" y1="60" x2="27" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Notehead 2 (8th - middle) */}
          <ellipse cx="57" cy="62" rx="8" ry="6" transform="rotate(-22 57 62)" fill={fillColor} />
          <line x1="64" y1="60" x2="64" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Notehead 3 (16th) */}
          <ellipse cx="92" cy="62" rx="7.5" ry="5.5" transform="rotate(-22 92 62)" fill={fillColor} />
          <line x1="99" y1="60" x2="99" y2="16" stroke={strokeColor} strokeWidth="2.8" />

          {/* Full Primary Beam across all 3 stems */}
          <polygon points="27,14 99,14 99,20 27,20" fill={fillColor} />
          {/* 16th secondary beam stub pointing right from 1st stem */}
          <polygon points="27,24 42,24 42,30 27,30" fill={fillColor} />
          {/* 16th secondary beam stub pointing left from 3rd stem */}
          <polygon points="84,24 99,24 99,30 84,30" fill={fillColor} />
        </svg>
      );

    case 'triplet':
      return (
        <svg viewBox="0 0 115 95" height={height} className="overflow-visible">
          {/* Triplet bracket & numeral 3 */}
          <text
            x="57"
            y="9"
            textAnchor="middle"
            fill={fillColor}
            fontSize="13"
            fontWeight="bold"
            fontFamily="Outfit, sans-serif"
          >
            3
          </text>
          <path
            d="M 22 10 L 22 6 L 47 6 M 68 6 L 93 6 L 93 10"
            stroke={strokeColor}
            strokeWidth="1.5"
            fill="none"
          />

          {/* 3 Noteheads */}
          {[20, 57, 94].map((x, idx) => (
            <React.Fragment key={idx}>
              <ellipse cx={x} cy="64" rx="8" ry="6" transform={`rotate(-22 ${x} 64)`} fill={fillColor} />
              <line x1={x + 7} y1="62" x2={x + 7} y2="19" stroke={strokeColor} strokeWidth="2.8" />
            </React.Fragment>
          ))}
          {/* Beam */}
          <polygon points="27,17 101,17 101,23 27,23" fill={fillColor} />
        </svg>
      );

    case 'half':
      return (
        <svg viewBox="0 0 65 90" height={height} className="overflow-visible">
          {/* Open notehead */}
          <ellipse
            cx="26"
            cy="62"
            rx="9"
            ry="6.5"
            transform="rotate(-25 26 62)"
            fill="none"
            stroke={fillColor}
            strokeWidth="3.5"
          />
          {/* Stem */}
          <line
            x1="34"
            y1="60"
            x2="34"
            y2="16"
            stroke={strokeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'half_rest':
      return (
        <svg viewBox="0 0 50 90" height={height} className="overflow-visible">
          <line x1="4" y1={staffLineY} x2="46" y2={staffLineY} stroke="#64748B" strokeWidth="2" />
          {/* Half rest sits on top of staff line */}
          <rect
            x="16"
            y={staffLineY - 10}
            width="18"
            height="10"
            fill={fillColor}
            rx="1"
          />
        </svg>
      );

    case 'whole':
      return (
        <svg viewBox="0 0 70 90" height={height} className="overflow-visible">
          {/* Open whole notehead (no stem) */}
          <ellipse
            cx="35"
            cy="60"
            rx="13"
            ry="8"
            transform="rotate(-25 35 60)"
            fill="none"
            stroke={fillColor}
            strokeWidth="4"
          />
          <ellipse
            cx="35"
            cy="60"
            rx="5.5"
            ry="4"
            transform="rotate(35 35 60)"
            fill="#0F172A"
          />
        </svg>
      );

    case 'syncopation_beat': // Syn-co-pa (8th - Quarter - 8th)
      return (
        <svg viewBox="0 0 120 90" height={height} className="overflow-visible">
          {/* 8th note */}
          <ellipse cx="20" cy="62" rx="7.5" ry="5.5" transform="rotate(-22 20 62)" fill={fillColor} />
          <line x1="26.5" y1="60" x2="26.5" y2="20" stroke={strokeColor} strokeWidth="2.8" />
          <path d="M 26.5 20 Q 38 25 32 38" stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Quarter note (middle accent) */}
          <ellipse cx="60" cy="62" rx="9" ry="6.5" transform="rotate(-22 60 62)" fill={fillColor} />
          <line x1="68" y1="60" x2="68" y2="16" stroke={strokeColor} strokeWidth="3.2" strokeLinecap="round" />

          {/* 8th note */}
          <ellipse cx="98" cy="62" rx="7.5" ry="5.5" transform="rotate(-22 98 62)" fill={fillColor} />
          <line x1="104.5" y1="60" x2="104.5" y2="20" stroke={strokeColor} strokeWidth="2.8" />
          <path d="M 104.5 20 Q 116 25 110 38" stroke={strokeColor} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );

    default:
      return null;
  }
};

export const RhythmNotation: React.FC<RhythmNotationProps> = ({
  pattern,
  highlightedUnitIndex = null,
  syllableStyle = 'numbers',
  interactive = false,
  onUnitClick,
  size = 'md',
  showMeasureLines = true
}) => {
  const unitsWithCounting = useMemo(
    () => getUnitsWithMeasureCounting(pattern.units),
    [pattern.units]
  );

  const unitCount = unitsWithCounting.length;

  // Dynamically scale note glyph size and gap spacing to keep ALL notes strictly on ONE single line
  const effectiveSize = useMemo(() => {
    if (unitCount >= 7) return 'sm';
    if (unitCount >= 5 && size === 'lg') return 'md';
    return size;
  }, [unitCount, size]);

  const gapClass = useMemo(() => {
    if (unitCount >= 7) return 'gap-1 sm:gap-2';
    if (unitCount >= 5) return 'gap-1.5 sm:gap-3';
    return 'gap-3 sm:gap-5';
  }, [unitCount]);

  const itemPadding = useMemo(() => {
    if (unitCount >= 7) return 'px-0.5 py-1 sm:px-1';
    if (unitCount >= 5) return 'px-1 py-1 sm:px-1.5';
    return 'px-2 py-1.5';
  }, [unitCount]);

  return (
    <div className="w-full flex flex-col items-center select-none overflow-hidden">
      {/* 4/4 Staff Container */}
      <div className="w-full flex items-center justify-center bg-slate-900/90 rounded-2xl border border-slate-800 p-3 sm:p-5 shadow-inner relative overflow-x-auto">
        {/* Subtle Horizontal Staff Guide Lines */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col justify-between h-14 pointer-events-none opacity-20">
          <div className="w-full h-px bg-slate-400" />
          <div className="w-full h-px bg-slate-400" />
          <div className="w-full h-px bg-slate-400" />
        </div>

        {/* Time Signature (4/4) */}
        <div className="flex flex-col items-center justify-center mr-2 sm:mr-5 text-amber-400 font-bold font-display leading-none shrink-0 border-r border-slate-800 pr-2 sm:pr-4">
          <span className="text-xl sm:text-3xl">4</span>
          <span className="text-xl sm:text-3xl mt-0.5 sm:mt-1">4</span>
        </div>

        {/* Units / Notes Stream - STRICTLY SINGLE LINE (flex-nowrap) */}
        <div className={`flex items-center ${gapClass} flex-nowrap justify-center relative z-10 shrink-0 max-w-full overflow-x-auto py-1`}>
          {unitsWithCounting.map(({ unit, countingText }, idx) => {
            const isActive = highlightedUnitIndex === idx;

            return (
              <div
                key={idx}
                onClick={() => interactive && onUnitClick?.(idx)}
                className={`flex flex-col items-center shrink-0 transition-all duration-150 rounded-xl ${itemPadding} ${
                  interactive ? 'cursor-pointer hover:bg-slate-800/80' : ''
                } ${
                  isActive
                    ? 'bg-amber-400/20 ring-2 ring-amber-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] scale-105'
                    : 'bg-transparent'
                }`}
              >
                {/* Visual Note Glyph */}
                <div className={`transition-transform duration-150 ${isActive ? 'scale-110 animate-beat-glow' : ''}`}>
                  <NoteGlyphSVG type={unit.type} isActive={isActive} size={effectiveSize} />
                </div>

                {/* Syllable Label Tag */}
                {syllableStyle !== 'none' && (
                  <div className="mt-1 text-center whitespace-nowrap">
                    <span
                      className={`text-[11px] sm:text-sm font-semibold tracking-wide transition-colors ${
                        isActive
                          ? 'text-amber-300 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      {syllableStyle === 'kodaly' ? unit.syllableKodaly : countingText}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Measure Bar Line */}
        {showMeasureLines && (
          <div className="ml-2 sm:ml-5 flex items-center h-16 sm:h-20 border-r-4 border-double border-slate-600 shrink-0 pl-1 sm:pl-2" />
        )}
      </div>
    </div>
  );
};
