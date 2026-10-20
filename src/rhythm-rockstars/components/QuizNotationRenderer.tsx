import React from 'react';
import { TheoryQuestion } from '../data/theoryQuestions';

interface QuizNotationRendererProps {
  question: TheoryQuestion;
}

// Single SVG Note Renderer for Quiz
export const QuizSingleNoteSVG: React.FC<{
  type: string;
  color?: string;
  height?: number;
}> = ({ type, color = '#FBBF24', height = 70 }) => {
  switch (type) {
    case 'quarter':
      return (
        <svg viewBox="0 0 45 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="8.5" ry="6" transform="rotate(-22 18 56)" fill={color} />
          <line x1="25.5" y1="54" x2="25.5" y2="14" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );

    case 'half':
      return (
        <svg viewBox="0 0 45 80" height={height} className="overflow-visible">
          <ellipse
            cx="18"
            cy="56"
            rx="8.5"
            ry="6"
            transform="rotate(-25 18 56)"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
          />
          <line x1="25.5" y1="54" x2="25.5" y2="14" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
        </svg>
      );

    case 'whole':
      return (
        <svg viewBox="0 0 60 80" height={height} className="overflow-visible">
          <ellipse
            cx="30"
            cy="48"
            rx="13"
            ry="8"
            transform="rotate(-25 30 48)"
            fill="none"
            stroke={color}
            strokeWidth="3.8"
          />
          <ellipse
            cx="30"
            cy="48"
            rx="5.5"
            ry="3.8"
            transform="rotate(35 30 48)"
            fill="#020617"
          />
        </svg>
      );

    case 'dotted_half':
      return (
        <svg viewBox="0 0 62 80" height={height} className="overflow-visible">
          <ellipse
            cx="18"
            cy="56"
            rx="8.5"
            ry="6"
            transform="rotate(-25 18 56)"
            fill="none"
            stroke={color}
            strokeWidth="3.2"
          />
          <line x1="25.5" y1="54" x2="25.5" y2="14" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="36" cy="56" r="3.2" fill={color} />
        </svg>
      );

    case 'dotted_quarter':
      return (
        <svg viewBox="0 0 62 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="8.5" ry="6" transform="rotate(-22 18 56)" fill={color} />
          <line x1="25.5" y1="54" x2="25.5" y2="14" stroke={color} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="36" cy="56" r="3.2" fill={color} />
        </svg>
      );

    case 'single_eighth':
      return (
        <svg viewBox="0 0 55 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="8" ry="5.8" transform="rotate(-22 18 56)" fill={color} />
          <line x1="25" y1="54" x2="25" y2="14" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <path d="M 25 14 Q 38 21 34 38 Q 30 28 25 24" fill={color} />
        </svg>
      );

    case 'eighth_pair':
      return (
        <svg viewBox="0 0 80 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="8" ry="5.8" transform="rotate(-22 18 56)" fill={color} />
          <line x1="25" y1="54" x2="25" y2="14" stroke={color} strokeWidth="2.8" />
          <ellipse cx="58" cy="56" rx="8" ry="5.8" transform="rotate(-22 58 56)" fill={color} />
          <line x1="65" y1="54" x2="65" y2="14" stroke={color} strokeWidth="2.8" />
          <polygon points="25,12 65,12 65,19 25,19" fill={color} />
        </svg>
      );

    case 'sixteenth_quad':
      return (
        <svg viewBox="0 0 115 80" height={height} className="overflow-visible">
          {[14, 40, 66, 92].map((x, idx) => (
            <React.Fragment key={idx}>
              <ellipse cx={x} cy="56" rx="6.5" ry="4.8" transform={`rotate(-22 ${x} 56)`} fill={color} />
              <line x1={x + 5.8} y1="54" x2={x + 5.8} y2="14" stroke={color} strokeWidth="2.4" />
            </React.Fragment>
          ))}
          <polygon points="19.8,11 97.8,11 97.8,16.5 19.8,16.5" fill={color} />
          <polygon points="19.8,20 97.8,20 97.8,25.5 19.8,25.5" fill={color} />
        </svg>
      );

    case 'triplet':
      return (
        <svg viewBox="0 0 100 85" height={height + 5} className="overflow-visible">
          <text x="50" y="10" textAnchor="middle" fill={color} fontSize="13" fontWeight="900" fontFamily="sans-serif">
            3
          </text>
          <path d="M 20 11 L 20 6 L 40 6 M 60 6 L 80 6 L 80 11" stroke={color} strokeWidth="1.6" fill="none" />
          {[18, 50, 82].map((x, idx) => (
            <React.Fragment key={idx}>
              <ellipse cx={x} cy="58" rx="7" ry="5" transform={`rotate(-22 ${x} 58)`} fill={color} />
              <line x1={x + 6} y1="56" x2={x + 6} y2="17" stroke={color} strokeWidth="2.5" />
            </React.Fragment>
          ))}
          <polygon points="24,15 88,15 88,21 24,21" fill={color} />
        </svg>
      );

    case 'quarter_rest':
      return (
        <svg viewBox="0 0 45 80" height={height} className="overflow-visible">
          <path
            d="M 20 12 L 27 30 L 16 44 L 27 54 C 29 62 18 71 14 68 C 13 64 21 60 21 56 L 14 48 L 23 36 L 14 22 Z"
            fill={color}
          />
        </svg>
      );

    case 'half_rest':
      return (
        <svg viewBox="0 0 55 80" height={height} className="overflow-visible">
          {/* Staff Line */}
          <line x1="4" y1="46" x2="51" y2="46" stroke="#64748B" strokeWidth="2.5" />
          {/* Rect sitting on top */}
          <rect x="17" y="34" width="20" height="12" fill={color} rx="1" />
        </svg>
      );

    case 'whole_rest':
      return (
        <svg viewBox="0 0 55 80" height={height} className="overflow-visible">
          {/* Staff Line */}
          <line x1="4" y1="34" x2="51" y2="34" stroke="#64748B" strokeWidth="2.5" />
          {/* Rect hanging below */}
          <rect x="17" y="34" width="20" height="12" fill={color} rx="1" />
        </svg>
      );

    case 'syncopation_beat':
      return (
        <svg viewBox="0 0 120 80" height={height} className="overflow-visible">
          {/* 8th note #1 */}
          <ellipse cx="20" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 20 56)" fill={color} />
          <line x1="26.5" y1="54" x2="26.5" y2="14" stroke={color} strokeWidth="2.8" />
          <path d="M 26.5 14 Q 38 20 32 34" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />

          {/* Quarter note (middle accent) */}
          <ellipse cx="60" cy="56" rx="8.5" ry="6" transform="rotate(-22 60 56)" fill={color} />
          <line x1="67.5" y1="54" x2="67.5" y2="10" stroke={color} strokeWidth="3.2" strokeLinecap="round" />

          {/* 8th note #2 */}
          <ellipse cx="98" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 98 56)" fill={color} />
          <line x1="104.5" y1="54" x2="104.5" y2="14" stroke={color} strokeWidth="2.8" />
          <path d="M 104.5 14 Q 116 20 110 34" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'broken_eighth_two_sixteenth':
      return (
        <svg viewBox="0 0 100 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 18 56)" fill={color} />
          <line x1="24.5" y1="54" x2="24.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="52" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 52 56)" fill={color} />
          <line x1="58.5" y1="54" x2="58.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="80" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 80 56)" fill={color} />
          <line x1="86.5" y1="54" x2="86.5" y2="14" stroke={color} strokeWidth="2.6" />

          <polygon points="24.5,12 86.5,12 86.5,17.5 24.5,17.5" fill={color} />
          <polygon points="58.5,21 86.5,21 86.5,26.5 58.5,26.5" fill={color} />
        </svg>
      );

    case 'broken_two_sixteenth_eighth':
      return (
        <svg viewBox="0 0 100 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 18 56)" fill={color} />
          <line x1="24.5" y1="54" x2="24.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="42" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 42 56)" fill={color} />
          <line x1="48.5" y1="54" x2="48.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="78" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 78 56)" fill={color} />
          <line x1="84.5" y1="54" x2="84.5" y2="14" stroke={color} strokeWidth="2.6" />

          <polygon points="24.5,12 84.5,12 84.5,17.5 24.5,17.5" fill={color} />
          <polygon points="24.5,21 48.5,21 48.5,26.5 24.5,26.5" fill={color} />
        </svg>
      );

    case 'broken_dotted_sixteenth':
      return (
        <svg viewBox="0 0 85 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 18 56)" fill={color} />
          <circle cx="31" cy="56" r="2.8" fill={color} />
          <line x1="24.5" y1="54" x2="24.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="64" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 64 56)" fill={color} />
          <line x1="70.5" y1="54" x2="70.5" y2="14" stroke={color} strokeWidth="2.6" />

          <polygon points="24.5,12 70.5,12 70.5,17.5 24.5,17.5" fill={color} />
          <polygon points="56,21 70.5,21 70.5,26.5 56,26.5" fill={color} />
        </svg>
      );

    case 'broken_sixteenth_dotted':
      return (
        <svg viewBox="0 0 85 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 18 56)" fill={color} />
          <line x1="24.5" y1="54" x2="24.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="64" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 64 56)" fill={color} />
          <circle cx="77" cy="56" r="2.8" fill={color} />
          <line x1="70.5" y1="54" x2="70.5" y2="14" stroke={color} strokeWidth="2.6" />

          <polygon points="24.5,12 70.5,12 70.5,17.5 24.5,17.5" fill={color} />
          <polygon points="24.5,21 40,21 40,26.5 24.5,26.5" fill={color} />
        </svg>
      );

    case 'sixteenth_eighth_sixteenth':
      return (
        <svg viewBox="0 0 100 80" height={height} className="overflow-visible">
          <ellipse cx="18" cy="56" rx="7" ry="5" transform="rotate(-22 18 56)" fill={color} />
          <line x1="24.5" y1="54" x2="24.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="50" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 50 56)" fill={color} />
          <line x1="56.5" y1="54" x2="56.5" y2="14" stroke={color} strokeWidth="2.6" />

          <ellipse cx="80" cy="56" rx="7" ry="5" transform="rotate(-22 80 56)" fill={color} />
          <line x1="86.5" y1="54" x2="86.5" y2="14" stroke={color} strokeWidth="2.6" />

          <polygon points="24.5,12 86.5,12 86.5,17.5 24.5,17.5" fill={color} />
          <polygon points="24.5,21 38,21 38,26.5 24.5,26.5" fill={color} />
          <polygon points="73,21 86.5,21 86.5,26.5 73,26.5" fill={color} />
        </svg>
      );

    case 'eighth_rest_eighth':
      return (
        <svg viewBox="0 0 75 80" height={height} className="overflow-visible">
          {/* 8th rest */}
          <path
            d="M 20 32 C 18 29 14 30 13 32 C 12 35 14 37 17 37 C 19 37 21 34 23 30 L 20 50"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="14" cy="34" r="2.5" fill={color} />

          {/* 8th note */}
          <ellipse cx="52" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 52 56)" fill={color} />
          <line x1="58.5" y1="54" x2="58.5" y2="14" stroke={color} strokeWidth="2.6" />
          <path d="M 58.5 14 Q 69 19 66 33" stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </svg>
      );

    case 'eighth_eighth_rest':
      return (
        <svg viewBox="0 0 75 80" height={height} className="overflow-visible">
          {/* 8th note */}
          <ellipse cx="22" cy="56" rx="7.5" ry="5.5" transform="rotate(-22 22 56)" fill={color} />
          <line x1="28.5" y1="54" x2="28.5" y2="14" stroke={color} strokeWidth="2.6" />
          <path d="M 28.5 14 Q 39 19 36 33" stroke={color} strokeWidth="2.8" fill="none" strokeLinecap="round" />

          {/* 8th rest */}
          <path
            d="M 56 32 C 54 29 50 30 49 32 C 48 35 50 37 53 37 C 55 37 57 34 59 30 L 56 50"
            stroke={color}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="50" cy="34" r="2.5" fill={color} />
        </svg>
      );

    case 'time_3_4':
      return (
        <div className="flex flex-col items-center justify-center text-amber-400 font-extrabold font-display leading-none px-3">
          <span className="text-4xl sm:text-5xl">3</span>
          <span className="text-4xl sm:text-5xl mt-1">4</span>
        </div>
      );

    case 'time_4_4':
      return (
        <div className="flex flex-col items-center justify-center text-amber-400 font-extrabold font-display leading-none px-3">
          <span className="text-4xl sm:text-5xl">4</span>
          <span className="text-4xl sm:text-5xl mt-1">4</span>
        </div>
      );

    case 'time_6_8':
      return (
        <div className="flex flex-col items-center justify-center text-amber-400 font-extrabold font-display leading-none px-3">
          <span className="text-4xl sm:text-5xl">6</span>
          <span className="text-4xl sm:text-5xl mt-1">8</span>
        </div>
      );

    default:
      return null;
  }
};

export const QuizNotationRenderer: React.FC<QuizNotationRendererProps> = ({ question }) => {
  const visualType = question.visualType;
  const equationItems = question.equationItems;

  // Render Equation or Sequence
  if (equationItems && equationItems.length > 0) {
    return (
      <div className="w-full max-w-2xl py-6 px-4 sm:px-8 bg-slate-950 border-2 border-amber-400/40 rounded-3xl shadow-2xl flex flex-wrap items-center justify-center gap-3 sm:gap-4 my-2 relative overflow-hidden group hover:border-amber-400 transition-colors">
        {/* Subtle Staff Lines in background */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col justify-between h-10 pointer-events-none opacity-25">
          <div className="w-full h-0.5 bg-slate-500" />
          <div className="w-full h-0.5 bg-slate-500" />
          <div className="w-full h-0.5 bg-slate-500" />
        </div>

        {equationItems.map((item, idx) => {
          if (item.type === 'note') {
            return (
              <div key={idx} className="relative z-10 flex items-center justify-center shrink-0">
                <QuizSingleNoteSVG type={item.value} height={65} />
              </div>
            );
          }

          if (item.type === 'operator') {
            return (
              <span
                key={idx}
                className="relative z-10 text-2xl sm:text-3xl font-black text-amber-400 font-mono shrink-0 px-1"
              >
                {item.value}
              </span>
            );
          }

          if (item.type === 'unknown') {
            return (
              <div
                key={idx}
                className="relative z-10 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 border-2 border-amber-300 text-slate-950 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse shrink-0"
              >
                ?
              </div>
            );
          }

          if (item.type === 'text') {
            return (
              <span
                key={idx}
                className="relative z-10 px-3 py-1.5 bg-slate-900 border border-slate-700 text-amber-300 font-extrabold text-sm sm:text-base rounded-xl shadow-sm shrink-0"
              >
                {item.value}
              </span>
            );
          }

          return null;
        })}
      </div>
    );
  }

  // Render Single Note Graphic
  if (visualType) {
    return (
      <div className="w-full max-w-md py-6 px-8 bg-slate-950 border-2 border-amber-400/40 rounded-3xl shadow-2xl flex items-center justify-center gap-4 my-2 relative overflow-hidden group hover:border-amber-400 transition-colors">
        {/* Subtle Staff Lines in background */}
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 flex flex-col justify-between h-10 pointer-events-none opacity-25">
          <div className="w-full h-0.5 bg-slate-500" />
          <div className="w-full h-0.5 bg-slate-500" />
          <div className="w-full h-0.5 bg-slate-500" />
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <QuizSingleNoteSVG type={visualType} height={85} />
        </div>
      </div>
    );
  }

  // Fallback if no visualType
  if (question.symbolNotation) {
    return (
      <div className="w-full max-w-md py-6 px-8 bg-slate-950 border-2 border-amber-400/40 rounded-3xl shadow-2xl flex items-center justify-center my-2">
        <span className="font-mono text-3xl sm:text-4xl font-extrabold text-amber-300 tracking-wider">
          {question.symbolNotation}
        </span>
      </div>
    );
  }

  return null;
};
