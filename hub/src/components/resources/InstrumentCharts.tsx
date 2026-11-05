import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { useRememberedState } from '../../hooks/useRememberedState';

/**
 * Board-sized reference charts: soprano recorder fingerings (baroque, with an option for German F),
 * ukulele chord diagrams (GCEA tuning) and boomwhacker colors. Click any chart to show it full screen.
 */

// --- Recorder ----------------------------------------------------------------
// holes: thumb, then 1–7 from the top (1 = covered)
interface RecorderNote { name: string; step: number; accidental?: '♯' | '♭'; holes: number[] }
const RECORDER: RecorderNote[] = [
  { name: 'C', step: -2, holes: [1, 1, 1, 1, 1, 1, 1, 1] },
  { name: 'D', step: -1, holes: [1, 1, 1, 1, 1, 1, 1, 0] },
  { name: 'E', step: 0, holes: [1, 1, 1, 1, 1, 1, 0, 0] },
  { name: 'F', step: 1, holes: [1, 1, 1, 1, 1, 0, 1, 1] },
  { name: 'F♯', step: 1, accidental: '♯', holes: [1, 1, 1, 1, 0, 1, 1, 0] },
  { name: 'G', step: 2, holes: [1, 1, 1, 1, 0, 0, 0, 0] },
  { name: 'A', step: 3, holes: [1, 1, 1, 0, 0, 0, 0, 0] },
  { name: 'B♭', step: 4, accidental: '♭', holes: [1, 1, 0, 1, 1, 0, 0, 0] },
  { name: 'B', step: 4, holes: [1, 1, 0, 0, 0, 0, 0, 0] },
  { name: 'High C', step: 5, holes: [1, 0, 1, 0, 0, 0, 0, 0] },
  { name: 'High D', step: 6, holes: [0, 0, 1, 0, 0, 0, 0, 0] }
];
const GERMAN_F = [1, 1, 1, 1, 1, 0, 0, 0];

const CLEF_FONT = "'Noto Music','Bravura Text','Segoe UI Symbol','Apple Symbols',serif";

const Staff: React.FC<{ step: number; accidental?: string; x?: number; width?: number }> = ({ step, accidental, x = 20, width = 200 }) => {
  const bottom = 70; // E4 sits on the bottom line
  const y = bottom - step * 5;
  const nx = x + width * 0.62;
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={x} x2={x + width} y1={bottom - i * 10} y2={bottom - i * 10} stroke="currentColor" strokeWidth={1.2} />
      ))}
      <text x={x + 2} y={bottom + 6} fontSize={58} fontFamily={CLEF_FONT} fill="currentColor">
        𝄞
      </text>
      {step <= -2 && <line x1={nx - 13} x2={nx + 13} y1={bottom + 10} y2={bottom + 10} stroke="currentColor" strokeWidth={1.2} />}
      {step >= 12 && <line x1={nx - 13} x2={nx + 13} y1={bottom - 60} y2={bottom - 60} stroke="currentColor" strokeWidth={1.2} />}
      {accidental && (
        <text x={nx - 26} y={y + 6} fontSize={20} fill="currentColor" fontFamily="serif">
          {accidental}
        </text>
      )}
      <ellipse cx={nx} cy={y} rx={7.5} ry={5.3} transform={`rotate(-20 ${nx} ${y})`} fill="currentColor" />
      <line x1={nx + (step >= 4 ? -7 : 7)} x2={nx + (step >= 4 ? -7 : 7)} y1={y} y2={step >= 4 ? y + 34 : y - 34} stroke="currentColor" strokeWidth={1.4} />
    </g>
  );
};

const RecorderChart: React.FC<{ note: RecorderNote; germanF: boolean }> = ({ note, germanF }) => {
  const holes = note.name === 'F' && germanF ? GERMAN_F : note.holes;
  const ys = [150, 180, 210, 258, 288, 318, 348];
  const hole = (cx: number, cy: number, closed: number, r = 11) => (
    <circle cx={cx} cy={cy} r={r} fill={closed ? '#e11d48' : 'var(--chart-paper, #fff)'} stroke={closed ? '#e11d48' : 'currentColor'} strokeWidth={2.5} />
  );
  return (
    <svg viewBox="0 0 240 400" className="w-full h-full text-stone-900 dark:text-stone-100" role="img" aria-label={`Recorder fingering for ${note.name}`}>
      <Staff step={note.step} accidental={note.accidental} />
      <text x={120} y={118} textAnchor="middle" fontSize={22} fontWeight={800} fill="currentColor" fontFamily="Fredoka, system-ui, sans-serif">
        {note.name}
      </text>
      <rect x={150} y={128} width={44} height={248} rx={20} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeWidth={2} />
      {hole(110, 150, holes[0], 10)}
      <text x={110} y={176} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>
        thumb
      </text>
      {ys.map((y, i) => (
        <g key={i}>{hole(172, y, holes[i + 1])}</g>
      ))}
      <text x={212} y={184} fontSize={11} fontWeight={700} fill="currentColor" opacity={0.5}>
        L
      </text>
      <text x={212} y={306} fontSize={11} fontWeight={700} fill="currentColor" opacity={0.5}>
        R
      </text>
      <line x1={152} x2={192} y1={234} y2={234} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="3 3" />
    </svg>
  );
};

// --- Ukulele -----------------------------------------------------------------
const UKE: { name: string; frets: number[] }[] = [
  { name: 'C', frets: [0, 0, 0, 3] },
  { name: 'Am', frets: [2, 0, 0, 0] },
  { name: 'F', frets: [2, 0, 1, 0] },
  { name: 'G', frets: [0, 2, 3, 2] },
  { name: 'G7', frets: [0, 2, 1, 2] },
  { name: 'C7', frets: [0, 0, 0, 1] },
  { name: 'Em', frets: [0, 4, 3, 2] },
  { name: 'Dm', frets: [2, 2, 1, 0] },
  { name: 'D', frets: [2, 2, 2, 0] },
  { name: 'D7', frets: [2, 2, 2, 3] },
  { name: 'A', frets: [2, 1, 0, 0] },
  { name: 'A7', frets: [0, 1, 0, 0] },
  { name: 'E7', frets: [1, 2, 0, 2] },
  { name: 'B♭', frets: [3, 2, 1, 1] }
];

const UkeChart: React.FC<{ chord: (typeof UKE)[number] }> = ({ chord }) => {
  const xs = [50, 83, 117, 150];
  const top = 80;
  const gap = 34;
  return (
    <svg viewBox="0 0 200 285" className="w-full h-full text-stone-900 dark:text-stone-100" role="img" aria-label={`Ukulele ${chord.name} chord`}>
      <text x={100} y={44} textAnchor="middle" fontSize={34} fontWeight={800} fill="currentColor" fontFamily="Fredoka, system-ui, sans-serif">
        {chord.name}
      </text>
      <rect x={xs[0]} y={top - 4} width={xs[3] - xs[0]} height={6} fill="currentColor" />
      {[1, 2, 3, 4, 5].map((f) => (
        <line key={f} x1={xs[0]} x2={xs[3]} y1={top + gap * f} y2={top + gap * f} stroke="currentColor" strokeWidth={1.5} strokeOpacity={0.6} />
      ))}
      {xs.map((x) => (
        <line key={x} x1={x} x2={x} y1={top} y2={top + gap * 5} stroke="currentColor" strokeWidth={2} />
      ))}
      {chord.frets.map((f, i) =>
        f === 0 ? (
          <circle key={i} cx={xs[i]} cy={top - 16} r={6} fill="none" stroke="currentColor" strokeWidth={2} />
        ) : (
          <circle key={i} cx={xs[i]} cy={top + gap * (f - 0.5)} r={11} fill="#e11d48" />
        )
      )}
      {['G', 'C', 'E', 'A'].map((s, i) => (
        <text key={s} x={xs[i]} y={top + gap * 5 + 26} textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor" opacity={0.6}>
          {s}
        </text>
      ))}
    </svg>
  );
};

// --- Boomwhackers --------------------------------------------------------------
const WHACKERS = [
  { note: 'C', sol: 'do', color: '#e8202a', ratio: 1 },
  { note: 'D', sol: 're', color: '#f7941d', ratio: 9 / 8 },
  { note: 'E', sol: 'mi', color: '#ffd400', ratio: 5 / 4 },
  { note: 'F', sol: 'fa', color: '#8dc63f', ratio: 4 / 3 },
  { note: 'G', sol: 'sol', color: '#00a79d', ratio: 3 / 2 },
  { note: 'A', sol: 'la', color: '#5b4ba0', ratio: 5 / 3 },
  { note: 'B', sol: 'ti', color: '#e1278f', ratio: 15 / 8 },
  { note: 'C', sol: 'do', color: '#e8202a', ratio: 2 }
];

const BoomwhackerChart: React.FC = () => (
  <svg viewBox="0 0 800 410" className="w-full h-full text-stone-900 dark:text-stone-100" role="img" aria-label="Boomwhacker colors from C to high C">
    {WHACKERS.map((w, i) => {
      const h = 330 / w.ratio;
      const x = 20 + i * 97;
      const dark = w.note === 'E';
      return (
        <g key={i}>
          <rect x={x} y={360 - h} width={72} height={h} rx={14} fill={w.color} />
          <rect x={x + 10} y={360 - h + 10} width={10} height={Math.max(10, h - 70)} rx={5} fill="#fff" opacity={0.25} />
          <text x={x + 36} y={350} textAnchor="middle" fontSize={34} fontWeight={800} fill={dark ? '#1c1917' : '#fff'} fontFamily="Fredoka, system-ui, sans-serif">
            {w.note}
          </text>
          <text x={x + 36} y={392} textAnchor="middle" fontSize={22} fontWeight={700} fill="currentColor" fontFamily="Fredoka, system-ui, sans-serif">
            {w.sol}
          </text>
        </g>
      );
    })}
  </svg>
);

// ---------------------------------------------------------------------------

type Kind = 'recorder' | 'ukulele' | 'boomwhackers';

export const InstrumentCharts: React.FC = () => {
  const [kind, setKind] = useRememberedState<Kind>('charts.kind', 'recorder');
  const [germanF, setGermanF] = useRememberedState('charts.germanF', false);
  const [big, setBig] = useState<number | null>(null);

  const charts: { key: string; render: () => React.ReactNode }[] =
    kind === 'recorder'
      ? RECORDER.map((n) => ({ key: n.name, render: () => <RecorderChart note={n} germanF={germanF} /> }))
      : kind === 'ukulele'
        ? UKE.map((c) => ({ key: c.name, render: () => <UkeChart chord={c} /> }))
        : [{ key: 'boomwhackers', render: () => <BoomwhackerChart /> }];

  useEffect(() => {
    if (big === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBig(null);
      if (e.key === 'ArrowRight') setBig((b) => (b === null ? b : (b + 1) % charts.length));
      if (e.key === 'ArrowLeft') setBig((b) => (b === null ? b : (b - 1 + charts.length) % charts.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [big, charts.length]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-bold ${active ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['recorder', 'Recorder'],
            ['ukulele', 'Ukulele chords'],
            ['boomwhackers', 'Boomwhacker colors']
          ] as const
        ).map(([id, text]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={chip(kind === id)}>
            {text}
          </button>
        ))}
        {kind === 'recorder' && (
          <label className="ml-2 text-xs text-stone-500 flex items-center gap-1.5">
            <input type="checkbox" checked={germanF} onChange={(e) => setGermanF(e.target.checked)} />
            German-fingering recorders (F)
          </label>
        )}
        <span className="ml-auto text-xs text-stone-400 flex items-center gap-1">
          <Maximize2 className="w-3.5 h-3.5" />
          Click a chart to show it full screen
        </span>
      </div>

      <div className={kind === 'boomwhackers' ? '' : `grid gap-3 ${kind === 'recorder' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6' : 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7'}`}>
        {charts.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setBig(i)}
            aria-label={`Show ${c.key} full screen`}
            className={`bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 p-2 hover:border-brand-400 hover:shadow-card transition [--chart-paper:#fff] dark:[--chart-paper:#1c1917] ${kind === 'boomwhackers' ? 'w-full max-w-4xl p-6' : ''}`}
          >
            {c.render()}
          </button>
        ))}
      </div>
      {kind === 'recorder' && <p className="text-xs text-stone-500">Filled holes are covered. The thumb hole is on the back. Notes are written at the pitch students read (soprano recorder sounds an octave higher).</p>}

      {big !== null && charts[big] && (
        <div role="dialog" aria-modal="true" aria-label={charts[big].key} className="fixed inset-0 z-50 bg-white dark:bg-stone-950 flex items-center justify-center [--chart-paper:#fff] dark:[--chart-paper:#0c0a09]" onClick={() => setBig(null)}>
          <div className="h-[92vh] w-[92vw] flex items-center justify-center [&>svg]:max-h-full [&>svg]:max-w-full" onClick={(e) => e.stopPropagation()}>
            {charts[big].render()}
          </div>
          <button type="button" onClick={() => setBig(null)} aria-label="Close" className="absolute top-4 right-4 p-2 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
            <X className="w-6 h-6" />
          </button>
          {charts.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setBig((big - 1 + charts.length) % charts.length); }} aria-label="Previous" className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setBig((big + 1) % charts.length); }} aria-label="Next" className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
