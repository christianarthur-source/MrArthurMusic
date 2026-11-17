import React from 'react';

/**
 * Picture logos for the "More classroom tools" tiles on the landing page.
 * Each one is a flat, bold 120x120 drawing with no text, so the tile can be recognised at a glance.
 * They are decorative: the tile's own label is the accessible name, so every drawing is aria-hidden.
 */

const P = {
  amber: '#fbbf24',
  amberDeep: '#f59e0b',
  orange: '#fb923c',
  rose: '#fb7185',
  pink: '#f472b6',
  violet: '#a78bfa',
  indigo: '#818cf8',
  sky: '#38bdf8',
  cyan: '#22d3ee',
  teal: '#2dd4bf',
  emerald: '#34d399',
  lime: '#a3e635',
  slate: '#0f172a',
  slateMid: '#1e293b',
  slateLine: '#475569',
  white: '#f8fafc',
};

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden="true" focusable="false">
    {children}
  </svg>
);

/** Beat Machine: a drum-pad grid with a few pads lit up. */
const BeatMachineArt = () => {
  const lit: Record<string, string> = { '0-0': P.rose, '1-1': P.amber, '2-0': P.sky, '0-2': P.emerald, '2-2': P.violet, '1-2': P.orange };
  return (
    <Svg>
      <rect x="10" y="12" width="100" height="96" rx="14" fill={P.slateMid} stroke={P.slateLine} strokeWidth="2" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const colour = lit[`${c}-${r}`];
          return (
            <g key={`${c}-${r}`}>
              {colour && <rect x={20 + c * 31 - 3} y={22 + r * 29 - 3} width="30" height="26" rx="9" fill={colour} opacity="0.28" />}
              <rect x={20 + c * 31} y={22 + r * 29} width="24" height="20" rx="6" fill={colour || '#334155'} />
              {colour && <rect x={23 + c * 31} y={25 + r * 29} width="18" height="5" rx="2.5" fill="#fff" opacity="0.35" />}
            </g>
          );
        })
      )}
    </Svg>
  );
};

/** Looper: a ring with a playhead dot and a big record button in the middle. */
const LooperArt = () => (
  <Svg>
    <circle cx="60" cy="52" r="34" fill="none" stroke={P.slateLine} strokeWidth="8" />
    <path d="M60 18 A34 34 0 1 1 28 64" fill="none" stroke={P.amber} strokeWidth="8" strokeLinecap="round" />
    <circle cx="60" cy="18" r="6" fill="#fff" />
    <circle cx="60" cy="52" r="17" fill={P.rose} />
    <circle cx="60" cy="52" r="6" fill="#fff" opacity="0.85" />
  </Svg>
);

/** Type Beat: a strip of coloured beat blocks above a few drum-coloured keys, one of them pressed. */
const TypeBeatArt = () => {
  const blocks = [P.rose, P.amber, P.orange, P.amber, P.rose, P.sky];
  const keys: [number, number, string][] = [
    [18, 66, P.rose],
    [48, 66, P.orange],
    [78, 66, P.amber],
    [33, 90, P.emerald],
    [63, 90, P.sky],
  ];
  return (
    <Svg>
      <rect x="8" y="12" width="104" height="40" rx="10" fill={P.slateMid} stroke={P.slateLine} strokeWidth="2" />
      {blocks.map((c, i) => (
        <g key={i}>
          {i === 3 && <rect x={14 + i * 16 - 3} y="17" width="20" height="30" rx="7" fill={c} opacity="0.3" />}
          <rect x={14 + i * 16} y={i === 3 ? 20 : 24} width="14" height={i === 3 ? 24 : 16} rx="4" fill={c} />
        </g>
      ))}
      {keys.map(([x, y, c], i) => (
        <g key={i} transform={i === 1 ? 'translate(0 2)' : undefined}>
          <rect x={x} y={y + (i === 1 ? 0 : 3)} width="24" height="20" rx="6" fill="#0b1220" />
          <rect x={x} y={y} width="24" height={i === 1 ? 20 : 18} rx="6" fill={c} />
          <rect x={x + 4} y={y + 3} width="16" height="4" rx="2" fill="#fff" opacity="0.35" />
        </g>
      ))}
    </Svg>
  );
};

/** Staff Wars: a spaceship firing a laser at an enemy note. */
const StaffWarsArt = () => (
  <Svg>
    {[28, 42, 56, 70, 84].map((y) => (
      <line key={y} x1="6" y1={y} x2="114" y2={y} stroke={P.sky} strokeWidth="1.5" opacity="0.28" />
    ))}
    {/* stars */}
    {[[16, 14], [104, 20], [96, 98], [20, 90], [60, 10]].map(([x, y], i) => (
      <circle key={i} cx={x} cy={y} r="2" fill={P.white} opacity="0.7" />
    ))}
    {/* laser */}
    <rect x="57" y="42" width="6" height="42" rx="3" fill={P.rose} />
    <rect x="58.5" y="42" width="3" height="42" rx="1.5" fill="#fecdd3" />
    {/* enemy note, hit */}
    <path d="M60 6 L64 16 L75 14 L68 22 L76 30 L65 28 L60 38 L55 28 L44 30 L52 22 L45 14 L56 16 Z" fill={P.amber} />
    <ellipse cx="57" cy="26" rx="7.5" ry="5.5" transform="rotate(-20 57 26)" fill={P.slate} />
    <rect x="62" y="12" width="3" height="14" rx="1.5" fill={P.slate} />
    {/* ship */}
    <path d="M60 80 L74 106 L60 100 L46 106 Z" fill={P.sky} />
    <path d="M60 80 L66 100 L60 100 L54 100 Z" fill="#e0f2fe" />
    <path d="M46 106 L36 112 L48 98 Z" fill={P.indigo} />
    <path d="M74 106 L84 112 L72 98 Z" fill={P.indigo} />
    <circle cx="60" cy="94" r="3.5" fill={P.slate} />
    <path d="M55 107 L60 117 L65 107 Z" fill={P.orange} />
  </Svg>
);

/** Song Starter: stacked sound blocks with a note on top. */
const SongStarterArt = () => (
  <Svg>
    <rect x="20" y="82" width="80" height="26" rx="8" fill={P.sky} />
    <rect x="20" y="82" width="80" height="8" rx="4" fill="#fff" opacity="0.25" />
    <rect x="30" y="54" width="60" height="26" rx="8" fill={P.emerald} />
    <rect x="30" y="54" width="60" height="8" rx="4" fill="#fff" opacity="0.25" />
    <rect x="40" y="26" width="40" height="26" rx="8" fill={P.rose} />
    <rect x="40" y="26" width="40" height="8" rx="4" fill="#fff" opacity="0.25" />
    {/* studs */}
    {[34, 46, 58, 70].map((x) => <circle key={x} cx={x + 6} cy="95" r="3" fill="#fff" opacity="0.45" />)}
    {[44, 58, 72].map((x) => <circle key={x} cx={x + 3} cy="67" r="3" fill="#fff" opacity="0.45" />)}
    {/* note */}
    <ellipse cx="54" cy="19" rx="8" ry="6" transform="rotate(-20 54 19)" fill={P.amber} />
    <rect x="59" y="0" width="3.5" height="19" rx="1.75" fill={P.amber} />
    <path d="M62 1 C 70 3 74 8 72 14 C 70 9 66 8 62 8 Z" fill={P.amber} />
  </Svg>
);

/** Do-Re-Mi Trainer: rainbow chime bells. */
const SolfegeArt = () => {
  const bells = [
    { c: P.rose, h: 70 },
    { c: P.orange, h: 62 },
    { c: P.amber, h: 54 },
    { c: P.emerald, h: 46 },
    { c: P.sky, h: 38 },
    { c: P.violet, h: 30 },
  ];
  return (
    <Svg>
      <rect x="8" y="14" width="104" height="7" rx="3.5" fill={P.slateLine} />
      {bells.map((b, i) => {
        const x = 14 + i * 16.4;
        return (
          <g key={i}>
            <line x1={x} y1="21" x2={x} y2={26} stroke={P.slateLine} strokeWidth="2.5" />
            <rect x={x - 6.5} y="26" width="13" height={b.h} rx="6.5" fill={b.c} />
            <rect x={x - 4} y="30" width="3" height={b.h - 12} rx="1.5" fill="#fff" opacity="0.35" />
            <circle cx={x} cy={26 + b.h + 6} r="3.4" fill={P.white} opacity="0.9" />
          </g>
        );
      })}
    </Svg>
  );
};

/** Symbol Match: two memory cards, one flipped. */
const SymbolMatchArt = () => (
  <Svg>
    <g transform="rotate(-10 40 60)">
      <rect x="10" y="22" width="54" height="76" rx="9" fill={P.violet} />
      <rect x="16" y="28" width="42" height="64" rx="6" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.55" strokeDasharray="5 5" />
      <circle cx="37" cy="60" r="10" fill="#fff" opacity="0.35" />
      <path d="M33 60 L37 55 L41 60 L37 65 Z" fill="#fff" opacity="0.7" />
    </g>
    <g transform="rotate(9 80 60)">
      <rect x="50" y="18" width="58" height="80" rx="9" fill={P.white} stroke={P.violet} strokeWidth="3" />
      {/* a quarter note */}
      <ellipse cx="72" cy="76" rx="10" ry="7.5" transform="rotate(-20 72 76)" fill={P.slate} />
      <rect x="80" y="38" width="4" height="38" rx="2" fill={P.slate} />
      <path d="M84 38 C 94 42 98 50 94 58 C 92 51 88 49 84 49 Z" fill={P.slate} />
    </g>
  </Svg>
);

/** Dynamic Ears: an ear with sound waves and a loudness meter. */
const DynamicEarsArt = () => (
  <Svg>
    {/* ear */}
    <path
      d="M72 14 C 50 12 38 30 40 52 C 41 66 50 72 52 84 C 54 98 66 106 78 100 C 92 93 96 78 92 62 C 90 34 88 16 72 14 Z"
      fill={P.emerald}
    />
    <path d="M72 30 C 58 29 54 42 56 54 C 58 62 64 64 66 70" fill="none" stroke={P.slate} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
    <path d="M70 50 C 64 50 64 60 70 62 C 76 64 80 58 76 52" fill="none" stroke={P.slate} strokeWidth="5" strokeLinecap="round" opacity="0.55" />
    <ellipse cx="62" cy="26" rx="6" ry="3" transform="rotate(-30 62 26)" fill="#fff" opacity="0.35" />
    {/* sound waves */}
    <path d="M30 40 C 22 48 22 62 30 70" fill="none" stroke={P.amber} strokeWidth="5" strokeLinecap="round" />
    <path d="M18 30 C 5 44 5 66 18 80" fill="none" stroke={P.orange} strokeWidth="5" strokeLinecap="round" />
    {/* quiet meter */}
    {[
      [100, 76, P.emerald],
      [106, 64, P.lime],
      [112, 52, P.amber],
    ].map(([x, y, c], i) => (
      <rect key={i} x={x as number} y={y as number} width="5" height={(106 - (y as number)) as number} rx="2.5" fill={c as string} />
    ))}
  </Svg>
);

/** Instrument Zoo: a violin and bow. */
const InstrumentZooArt = () => (
  <Svg>
    <g transform="rotate(-24 58 62)">
      {/* neck + scroll */}
      <rect x="54" y="14" width="8" height="38" rx="3" fill="#7c2d12" />
      <circle cx="58" cy="11" r="6.5" fill="#7c2d12" />
      <circle cx="58" cy="11" r="2.4" fill={P.orange} />
      {/* body: two bouts and a waist */}
      <path
        d="M58 42 C 46 42 40 50 42 58 C 43 63 47 66 47 70 C 47 74 41 77 40 85 C 39 98 48 108 58 108 C 68 108 77 98 76 85 C 75 77 69 74 69 70 C 69 66 73 63 74 58 C 76 50 70 42 58 42 Z"
        fill={P.orange}
      />
      <path d="M50 50 C 46 54 46 58 47 61" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* strings, f-holes, bridge, tailpiece */}
      {[56.5, 58, 59.5].map((x) => <line key={x} x1={x} y1="16" x2={x} y2="98" stroke={P.white} strokeWidth="0.9" opacity="0.75" />)}
      <path d="M50 72 C 47 78 48 84 51 90" fill="none" stroke={P.slate} strokeWidth="3" strokeLinecap="round" />
      <path d="M66 72 C 69 78 68 84 65 90" fill="none" stroke={P.slate} strokeWidth="3" strokeLinecap="round" />
      <rect x="51" y="80" width="14" height="3.5" rx="1.5" fill={P.amber} />
      <path d="M54 94 H62 L60 108 H56 Z" fill="#7c2d12" />
    </g>
    {/* bow */}
    <line x1="12" y1="104" x2="110" y2="48" stroke={P.cyan} strokeWidth="4" strokeLinecap="round" />
    <line x1="12" y1="104" x2="110" y2="48" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    <rect x="6" y="98" width="14" height="10" rx="3" transform="rotate(-30 13 103)" fill={P.slate} stroke={P.cyan} strokeWidth="2" />
  </Svg>
);

/** Metronome: a wedge body with a swinging pendulum. */
const MetronomeArt = () => (
  <Svg>
    {/* body */}
    <path d="M44 14 H76 L100 106 H20 Z" fill={P.amber} />
    <path d="M44 14 H60 L60 106 H20 Z" fill="#fff" opacity="0.18" />
    <rect x="14" y="104" width="92" height="10" rx="5" fill="#b45309" />
    {/* window */}
    <path d="M52 30 H68 L78 90 H42 Z" fill={P.slate} />
    {/* scale marks */}
    {[40, 52, 64, 76].map((y, i) => <rect key={y} x={i % 2 ? 55 : 52} y={y} width={i % 2 ? 10 : 16} height="2.5" rx="1.25" fill={P.slateLine} />)}
    {/* pendulum */}
    <line x1="60" y1="94" x2="82" y2="22" stroke={P.rose} strokeWidth="4.5" strokeLinecap="round" />
    <rect x="70" y="42" width="16" height="12" rx="3" transform="rotate(18 78 48)" fill={P.rose} stroke={P.white} strokeWidth="2" />
    <circle cx="60" cy="94" r="5.5" fill={P.white} />
    {/* tick marks left and right */}
    <path d="M104 20 C 110 26 110 38 104 44" fill="none" stroke={P.sky} strokeWidth="4" strokeLinecap="round" />
    <path d="M14 20 C 8 26 8 38 14 44" fill="none" stroke={P.sky} strokeWidth="4" strokeLinecap="round" />
  </Svg>
);

/** Tap Tempo: a pointing finger tapping a pad with ripples. */
const TapTempoArt = () => (
  <Svg>
    {/* ripples */}
    <circle cx="50" cy="76" r="32" fill="none" stroke={P.orange} strokeWidth="3" opacity="0.3" />
    <circle cx="50" cy="76" r="22" fill="none" stroke={P.orange} strokeWidth="3.5" opacity="0.6" />
    <circle cx="50" cy="76" r="12" fill={P.orange} opacity="0.9" />
    {/* hand */}
    <path
      d="M62 14 C 56 14 52 18 52 24 L52 70 C 46 62 40 62 36 66 C 34 69 36 72 40 78 L58 104 C 62 110 68 112 76 112 H88 C 98 112 104 104 104 94 V62 C 104 56 100 52 94 52 C 92 48 88 46 84 48 C 82 44 76 44 72 48 V24 C 72 18 68 14 62 14 Z"
      fill={P.white}
    />
    <path d="M72 48 V64 M84 48 V64 M94 52 V64" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
    <path d="M62 22 V44" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" opacity="0" />
    {/* motion */}
    <path d="M30 22 L24 14 M22 34 L12 30 M40 14 L38 4" stroke={P.amber} strokeWidth="4" strokeLinecap="round" />
  </Svg>
);

/** Instrument Tuner: a dial with a needle in the green. */
const TunerArt = () => {
  const arc = (a0: number, a1: number, r: number) => {
    const p = (a: number) => [60 + r * Math.cos((a * Math.PI) / 180), 84 + r * Math.sin((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  return (
    <Svg>
      <path d="M8 96 A52 52 0 0 1 112 96 Z" fill={P.slateMid} stroke={P.slateLine} strokeWidth="2.5" />
      <path d={arc(190, 222, 42)} fill="none" stroke={P.rose} strokeWidth="9" strokeLinecap="round" />
      <path d={arc(228, 252, 42)} fill="none" stroke={P.amber} strokeWidth="9" strokeLinecap="round" />
      <path d={arc(258, 282, 42)} fill="none" stroke={P.emerald} strokeWidth="9" strokeLinecap="round" />
      <path d={arc(288, 312, 42)} fill="none" stroke={P.amber} strokeWidth="9" strokeLinecap="round" />
      <path d={arc(318, 350, 42)} fill="none" stroke={P.rose} strokeWidth="9" strokeLinecap="round" />
      {/* needle (pointing nearly straight up) */}
      <line x1="60" y1="84" x2="64" y2="42" stroke={P.white} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="60" cy="84" r="8" fill={P.teal} stroke={P.white} strokeWidth="3" />
      <rect x="8" y="100" width="104" height="8" rx="4" fill={P.teal} />
    </Svg>
  );
};

export const LAB_TOOL_ART: Record<string, React.FC> = {
  'beat-machine': BeatMachineArt,
  looper: LooperArt,
  typebeat: TypeBeatArt,
  'staff-wars': StaffWarsArt,
  'song-starter': SongStarterArt,
  'solfege-trainer': SolfegeArt,
  'music-symbol-match': SymbolMatchArt,
  'dynamic-ears': DynamicEarsArt,
  'instrument-zoo': InstrumentZooArt,
  metronome: MetronomeArt,
  'tempo-tapper': TapTempoArt,
  tuner: TunerArt,
};
