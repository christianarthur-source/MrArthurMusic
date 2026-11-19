import React, { useState } from 'react';
import { Sparkles, Play, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { StudentSession } from '../utils/classroomApi';
import { LazyClassroomToolBoxModal } from './tools/LazyClassroomToolBoxModal';
import type { ToolId } from './tools/ClassroomToolBoxModal';
import { GRADE_BANDS, GradeFilter, LabEntry, entryById, hrefForEntry, matchesGrade, readRecentTools } from '../labCatalog';
import { isToolId, urlForRoute } from '../routes';
import { LAB_TOOL_ART } from './LabToolArt';

export type MusicLabAppId = 'hub' | 'staff-composer' | 'rhythm-rockstars' | 'beat-machine' | 'daw' | 'staff-wars' | 'big-staff';

interface MusicLabLandingProps {
  onSelectApp: (appId: MusicLabAppId) => void;
  /** The Tool Box tool open on top of the landing page (it has its own address, /?app=metronome). */
  openTool: ToolId | null;
  onOpenTool: (tool: ToolId | null) => void;
  onSwitchTool: (tool: ToolId) => void;
  studentSession: StudentSession | null;
  onOpenClassroom: () => void;
  onOpenEdLaw: () => void;
  onOpenAvatar: () => void;
}

const GRADE_KEY = 'mrarthur_lab_grade_v1';

function readGradeFilter(): GradeFilter {
  try {
    const v = localStorage.getItem(GRADE_KEY);
    return v === 'K-2' || v === '3-5' || v === '6-8' ? v : 'all';
  } catch {
    return 'all';
  }
}

type AccentName = 'amber' | 'sky' | 'rose' | 'indigo' | 'violet' | 'cyan' | 'emerald' | 'orange' | 'teal';

interface Accent {
  border: string;
  shadow: string;
  tile: string;
  chip: string;
  text: string;
  titleHover: string;
  btnHover: string;
}

// Whole class names are written out so Tailwind can see them.
const ACCENTS: Record<AccentName, Accent> = {
  amber: { border: 'border-amber-500/40 hover:border-amber-400', shadow: 'hover:shadow-amber-500/15', tile: 'bg-amber-500/20 border-amber-400/40', chip: 'bg-amber-500/15 text-amber-300 border-amber-400/40', text: 'text-amber-300', titleHover: 'group-hover:text-amber-300', btnHover: 'group-hover:bg-amber-400' },
  sky: { border: 'border-sky-500/40 hover:border-sky-400', shadow: 'hover:shadow-sky-500/15', tile: 'bg-sky-500/20 border-sky-400/40', chip: 'bg-sky-500/15 text-sky-300 border-sky-400/40', text: 'text-sky-300', titleHover: 'group-hover:text-sky-300', btnHover: 'group-hover:bg-sky-400' },
  rose: { border: 'border-rose-500/40 hover:border-rose-400', shadow: 'hover:shadow-rose-500/15', tile: 'bg-rose-500/20 border-rose-400/40', chip: 'bg-rose-500/15 text-rose-300 border-rose-400/40', text: 'text-rose-300', titleHover: 'group-hover:text-rose-300', btnHover: 'group-hover:bg-rose-400' },
  indigo: { border: 'border-indigo-500/40 hover:border-indigo-400', shadow: 'hover:shadow-indigo-500/15', tile: 'bg-indigo-500/20 border-indigo-400/40', chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/40', text: 'text-indigo-300', titleHover: 'group-hover:text-indigo-300', btnHover: 'group-hover:bg-indigo-400' },
  violet: { border: 'border-violet-500/40 hover:border-violet-400', shadow: 'hover:shadow-violet-500/15', tile: 'bg-violet-500/20 border-violet-400/40', chip: 'bg-violet-500/15 text-violet-300 border-violet-400/40', text: 'text-violet-300', titleHover: 'group-hover:text-violet-300', btnHover: 'group-hover:bg-violet-400' },
  cyan: { border: 'border-cyan-500/40 hover:border-cyan-400', shadow: 'hover:shadow-cyan-500/15', tile: 'bg-cyan-500/20 border-cyan-400/40', chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-400/40', text: 'text-cyan-300', titleHover: 'group-hover:text-cyan-300', btnHover: 'group-hover:bg-cyan-400' },
  emerald: { border: 'border-emerald-500/40 hover:border-emerald-400', shadow: 'hover:shadow-emerald-500/15', tile: 'bg-emerald-500/20 border-emerald-400/40', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40', text: 'text-emerald-300', titleHover: 'group-hover:text-emerald-300', btnHover: 'group-hover:bg-emerald-400' },
  orange: { border: 'border-orange-500/40 hover:border-orange-400', shadow: 'hover:shadow-orange-500/15', tile: 'bg-orange-500/20 border-orange-400/40', chip: 'bg-orange-500/15 text-orange-300 border-orange-400/40', text: 'text-orange-300', titleHover: 'group-hover:text-orange-300', btnHover: 'group-hover:bg-orange-400' },
  teal: { border: 'border-teal-500/40 hover:border-teal-400', shadow: 'hover:shadow-teal-500/15', tile: 'bg-teal-500/20 border-teal-400/40', chip: 'bg-teal-500/15 text-teal-300 border-teal-400/40', text: 'text-teal-300', titleHover: 'group-hover:text-teal-300', btnHover: 'group-hover:bg-teal-400' },
};

interface Feature {
  emoji: string;
  title: string;
  badge: string;
  blurb: string;
  cta: string;
  accent: AccentName;
  art: React.ReactNode;
}

/** Small pictures for the four featured cards (all the same height). */
const KEYBOARD_ART = (
  <div className="relative h-full flex gap-0.5">
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <div key={i} className="flex-1 rounded-b-md bg-slate-100" />
    ))}
    {[1, 2, 4, 5, 6].map((i) => (
      <div key={i} className="absolute top-0 h-[58%] w-[7%] rounded-b-sm bg-slate-900 border border-slate-700" style={{ left: `calc(${(i / 8) * 100}% - 3.5%)` }} />
    ))}
  </div>
);

const BARS_ART = (
  <div className="h-full flex items-end gap-1.5">
    {[
      ['h-[40%]', 'bg-rose-400'],
      ['h-[75%]', 'bg-amber-400'],
      ['h-[55%]', 'bg-emerald-400'],
      ['h-[95%]', 'bg-sky-400'],
      ['h-[65%]', 'bg-violet-400'],
      ['h-[85%]', 'bg-pink-400'],
      ['h-[45%]', 'bg-teal-400'],
    ].map(([h, c], i) => (
      <div key={i} className={`flex-1 rounded-t-md ${h} ${c}`} />
    ))}
  </div>
);

const DAW_ART = (
  <div className="relative h-full flex flex-col justify-around">
    {[
      [['w-[34%] bg-rose-400', ''], ['w-[22%] bg-amber-400', 'ml-[6%]'], ['w-[24%] bg-rose-400', 'ml-[4%]']],
      [['w-[18%] bg-sky-400', 'ml-[10%]'], ['w-[40%] bg-emerald-400', 'ml-[4%]'], ['w-[14%] bg-sky-400', 'ml-[4%]']],
      [['w-[50%] bg-violet-400', ''], ['w-[30%] bg-indigo-400', 'ml-[6%]']],
    ].map((clips, row) => (
      <div key={row} className="flex h-3.5 rounded bg-slate-900">
        {clips.map(([c, m], i) => (
          <div key={i} className={`h-full rounded-sm ${c} ${m}`} />
        ))}
      </div>
    ))}
    <div className="absolute inset-y-0 left-[46%] w-0.5 bg-white/90 rounded-full" />
  </div>
);

const GEMS_ART = (
  <div className="relative h-full flex items-center justify-around">
    <div className="absolute inset-x-0 top-5 h-0.5 bg-slate-700" />
    <div className="absolute inset-x-0 top-9 h-0.5 bg-slate-700" />
    <div className="absolute inset-x-0 top-[3.25rem] h-0.5 bg-slate-700" />
    {[
      ['bg-rose-500 text-white', '♩'],
      ['bg-amber-400 text-slate-950', '♫'],
      ['bg-emerald-400 text-slate-950', '♩'],
      ['bg-sky-400 text-slate-950', '⚡'],
    ].map(([c, g], i) => (
      <div key={i} className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center z-10 ${c}`}>{g}</div>
    ))}
  </div>
);

/** The four tools right under Staff Composer, in this order. */
const FEATURED: { id: string; f: Feature }[] = [
  { id: 'midimusic', f: { emoji: '🎹', title: 'MIDI MUSIC', badge: 'Keyboard', blurb: 'Plug in a MIDI keyboard and play 140+ instruments, learn songs and jam with a beat.', cta: 'Open MIDI MUSIC', accent: 'amber', art: KEYBOARD_ART } },
  { id: 'chromeextra', f: { emoji: '🧪', title: 'Chrome Music Lab EXTRA', badge: 'Experiments', blurb: 'Song Maker, Kandinsky, Shared Piano and Rhythm, with custom colour themes.', cta: 'Open Music Lab EXTRA', accent: 'sky', art: BARS_ART } },
  { id: 'daw', f: { emoji: '🎚️', title: 'Studio DAW', badge: 'Studio', blurb: 'Mix loops, record microphone vocals and make full songs.', cta: 'Launch Studio DAW', accent: 'indigo', art: DAW_ART } },
  { id: 'rhythm-rockstars', f: { emoji: '🎸', title: 'Rhythm Rock Stars', badge: 'Rhythm game', blurb: 'Tap along to drum beats, decode rock rhythms and beat 6 stages!', cta: 'Play Rhythm Rock Stars', accent: 'rose', art: GEMS_ART } },
];

interface ToolCardDef {
  /** The only text on the tile. */
  title: string;
  accent: AccentName;
}

/** The additional classroom tools: one grid of picture tiles (see LabToolArt.tsx), every tile the same size. */
const TOOL_GROUPS: { heading: string; note: string; ids: string[] }[] = [
  { heading: 'Make and play', note: 'Beats, songs and games', ids: ['soundblocks', 'beat-machine', 'looper', 'typebeat', 'song-starter', 'staff-wars'] },
  { heading: 'Practice', note: 'Ears, symbols and instruments', ids: ['solfege-trainer', 'music-symbol-match', 'dynamic-ears', 'instrument-zoo'] },
  { heading: 'Teacher helpers', note: 'Smartboard ready', ids: ['metronome', 'tempo-tapper', 'tuner'] },
];
const TOOL_ORDER = TOOL_GROUPS.flatMap((g) => g.ids);

const TOOL_CARDS: Record<string, ToolCardDef> = {
  'beat-machine': { title: 'Beat Machine', accent: 'amber' },
  soundblocks: { title: 'Sound Blocks', accent: 'emerald' },
  looper: { title: 'Looper', accent: 'amber' },
  typebeat: { title: 'Type Beat', accent: 'rose' },
  'staff-wars': { title: 'Staff Wars', accent: 'sky' },
  'song-starter': { title: 'Song Starter', accent: 'orange' },
  'solfege-trainer': { title: 'Do-Re-Mi Trainer', accent: 'rose' },
  'music-symbol-match': { title: 'Symbol Match', accent: 'violet' },
  'dynamic-ears': { title: 'Dynamic Ears', accent: 'emerald' },
  'instrument-zoo': { title: 'Instrument Zoo', accent: 'cyan' },
  metronome: { title: 'Metronome', accent: 'amber' },
  'tempo-tapper': { title: 'Tap Tempo', accent: 'orange' },
  tuner: { title: 'Instrument Tuner', accent: 'teal' },
};

export const MusicLabLanding: React.FC<MusicLabLandingProps> = ({
  onSelectApp,
  openTool,
  onOpenTool,
  onSwitchTool,
  studentSession,
  onOpenClassroom,
  onOpenEdLaw,
  onOpenAvatar,
}) => {
  const [grade, setGradeState] = useState<GradeFilter>(readGradeFilter);
  const setGrade = (g: GradeFilter) => {
    setGradeState(g);
    try {
      localStorage.setItem(GRADE_KEY, g);
    } catch {
      // a remembered filter is a convenience only
    }
  };

  /**
   * Every card is a real link (so it can be opened in a new tab or bookmarked). A plain click is handled here,
   * without leaving the page; a click with Ctrl / Cmd / Shift, or a middle click, is left to the browser.
   */
  const link = (id: string) => {
    const entry = entryById(id);
    const isApp = id === 'big-staff' || (!!entry && 'app' in entry.to && !isToolId(id));
    const href =
      id === 'big-staff'
        ? urlForRoute({ app: 'staff-composer', bigStaff: true, tool: null })
        : entry
          ? 'path' in entry.to
            ? hrefForEntry(entry)
            : isToolId(id)
              ? urlForRoute({ app: 'hub', bigStaff: false, tool: id })
              : urlForRoute({ app: id as MusicLabAppId, bigStaff: false, tool: null })
          : '/';
    return {
      href,
      onClick: (e: React.MouseEvent) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (isToolId(id)) onOpenTool(id);
        else if (isApp) onSelectApp(id as MusicLabAppId);
      },
    };
  };

  const visible = (id: string) => {
    const entry = entryById(id);
    return !entry || matchesGrade(entry, grade);
  };

  const recent = readRecentTools(studentSession)
    .map((id) => entryById(id))
    .filter((e): e is LabEntry => !!e);

  /** Links for an entry: app and tool cards stay on the page; separate sites (MIDI MUSIC, Chrome Music Lab EXTRA) are plain links. */
  const linkProps = (id: string) => {
    const entry = entryById(id);
    return entry && 'path' in entry.to ? { href: hrefForEntry(entry) } : link(id);
  };

  /** One of the four featured tools: same size, same layout, only the picture and colour differ. */
  const featureCard = (id: string, f: Feature) => {
    const a = ACCENTS[f.accent];
    return (
      <a
        key={id}
        {...linkProps(id)}
        className={`group relative h-full flex flex-col rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 ${a.border} p-5 transition-all duration-200 hover:shadow-xl ${a.shadow} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className={`w-12 h-12 shrink-0 rounded-2xl border flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner ${a.tile}`}>
            <span aria-hidden="true">{f.emoji}</span>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-[12px] font-black uppercase tracking-wide border font-['Fredoka',sans-serif] ${a.chip}`}>{f.badge}</span>
        </div>
        <div aria-hidden="true" className="mt-3 h-20 shrink-0 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden p-2">
          {f.art}
        </div>
        <h3 className={`mt-3 text-xl font-black text-white font-['Fredoka',sans-serif] transition-colors ${a.titleHover}`}>{f.title}</h3>
        <p className={`mt-1 mb-4 text-xs font-bold leading-snug ${a.text}`}>{f.blurb}</p>
        <span className={`mt-auto w-full py-2.5 rounded-xl bg-slate-800 group-hover:text-slate-950 font-black text-sm flex items-center justify-center gap-1.5 transition-colors font-['Fredoka',sans-serif] ${a.text} ${a.btnHover}`}>
          <span>{f.cta}</span>
          <ArrowRight className="w-4 h-4" />
        </span>
      </a>
    );
  };

  /** A picture tile for the rest of the classroom tools: a big logo and just the tool's name. */
  const toolCard = (id: string) => {
    const t = TOOL_CARDS[id];
    const Art = LAB_TOOL_ART[id];
    if (!t || !Art) return null;
    const a = ACCENTS[t.accent];
    return (
      <a
        key={id}
        {...linkProps(id)}
        className={`group h-full flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border ${a.border} p-4 transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 ${a.shadow} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300`}
      >
        <div className={`w-full aspect-square max-w-[9.5rem] rounded-2xl border p-3 shadow-inner transition-transform group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${a.tile}`}>
          <Art />
        </div>
        <h3 className={`mt-auto text-base sm:text-lg font-black text-white text-center leading-tight font-['Fredoka',sans-serif] transition-colors ${a.titleHover}`}>{t.title}</h3>
      </a>
    );
  };


  const heroCard = (
        <section
          className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-[#0E1A33] to-[#080E1C] border-3 border-sky-400/60 hover:border-sky-300 p-6 sm:p-8 shadow-2xl transition-all duration-300 group overflow-hidden hover:shadow-sky-500/20"
        >
          {/* The whole card is one real link (a stretched link), so it can be opened in a new tab, bookmarked and reached by keyboard. */}
          <a
            {...link('staff-composer')}
            aria-label="Open Staff Composer"
            className="absolute inset-0 z-[5] rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          />
          {/* Decorative Staff Lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none flex flex-col justify-around py-8">
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
            <div className="h-0.5 bg-sky-200 w-full" />
          </div>

          <div className="relative z-10 pointer-events-none flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="space-y-4 max-w-2xl text-center lg:text-left w-full">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="px-3.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider font-['Fredoka',sans-serif] shadow-md flex items-center gap-1.5">
                  ⭐ Star App
                </span>
                <span className="px-3 py-1 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold font-['Fredoka',sans-serif]">
                  🎼 Sheet Music Maker
                </span>
              </div>

              <div>
                <h3 className="text-3xl sm:text-5xl font-black text-white font-['Fredoka',sans-serif] tracking-wide">
                  <span className="bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                    Staff Composer
                  </span>
                </h3>
                <p className="text-sm sm:text-base text-sky-200 font-bold mt-1">
                  Compose songs on the musical staff and hear them play! 🎼
                </p>
              </div>

              {/* Simple Music Staff with Notes Graphic */}
              <div className="w-full max-w-xl p-3 sm:p-4 rounded-2xl bg-slate-950/90 border-2 border-sky-500/30 group-hover:border-sky-400 transition-colors shadow-inner overflow-hidden">
                <svg
                  viewBox="0 0 520 120"
                  className="w-full h-auto text-slate-100"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {/* 5 Horizontal Staff Lines */}
                  <line x1="8" y1="26" x2="512" y2="26" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="44" x2="512" y2="44" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="62" x2="512" y2="62" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="80" x2="512" y2="80" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />
                  <line x1="8" y1="98" x2="512" y2="98" stroke="#94a3b8" strokeWidth="1.75" opacity="0.6" />

                  {/* Treble Clef */}
                  <text
                    x="16"
                    y="93"
                    fontSize="82"
                    fontFamily="serif, 'Noto Music', 'Bravura'"
                    fill="#f8fafc"
                    className="select-none pointer-events-none"
                  >
                    𝄞
                  </text>

                  {/* Time Signature 3/4 */}
                  <text
                    x="84"
                    y="58"
                    fontSize="32"
                    fontWeight="800"
                    fontFamily="serif"
                    textAnchor="middle"
                    fill="#f8fafc"
                    className="select-none"
                  >
                    3
                  </text>
                  <text
                    x="84"
                    y="94"
                    fontSize="32"
                    fontWeight="800"
                    fontFamily="serif"
                    textAnchor="middle"
                    fill="#f8fafc"
                    className="select-none"
                  >
                    4
                  </text>

                  {/* Measure 1 - Note 1: E4 (Quarter Note) */}
                  <ellipse cx="138" cy="98" rx="8.5" ry="6" transform="rotate(-20 138 98)" fill="#f8fafc" />
                  <line x1="146" y1="98" x2="146" y2="44" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 1 - Note 2: G4 (Quarter Note) */}
                  <ellipse cx="192" cy="80" rx="8.5" ry="6" transform="rotate(-20 192 80)" fill="#f8fafc" />
                  <line x1="200" y1="80" x2="200" y2="26" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 1 - Notes 3 & 4: Beamed 8th Notes (B4 & C5) */}
                  <ellipse cx="244" cy="62" rx="8.5" ry="6" transform="rotate(-20 244 62)" fill="#f8fafc" />
                  <line x1="236" y1="62" x2="236" y2="114" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  <ellipse cx="284" cy="53" rx="8.5" ry="6" transform="rotate(-20 284 53)" fill="#f8fafc" />
                  <line x1="276" y1="53" x2="276" y2="105" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Beam connecting stems */}
                  <polygon points="235,108 277,99 277,105 235,114" fill="#f8fafc" />

                  {/* Measure Barline */}
                  <line x1="330" y1="26" x2="330" y2="98" stroke="#94a3b8" strokeWidth="1.5" opacity="0.6" />

                  {/* Measure 2 - Note 5: D5 (Quarter Note) */}
                  <ellipse cx="372" cy="44" rx="8.5" ry="6" transform="rotate(-20 372 44)" fill="#f8fafc" />
                  <line x1="364" y1="44" x2="364" y2="98" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Measure 2 - Note 6: E5 (Half Note) */}
                  <ellipse cx="430" cy="35" rx="8.5" ry="6" transform="rotate(-20 430 35)" fill="none" stroke="#f8fafc" strokeWidth="2.5" />
                  <line x1="422" y1="35" x2="422" y2="89" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Double End Barline */}
                  <line x1="488" y1="26" x2="488" y2="98" stroke="#94a3b8" strokeWidth="1.5" opacity="0.8" />
                  <line x1="496" y1="26" x2="496" y2="98" stroke="#f8fafc" strokeWidth="4" />
                </svg>
              </div>
            </div>

            {/* Giant Action Button */}
            <div className="w-full lg:w-auto shrink-0 flex flex-col items-center gap-2.5">
              <span
                className="w-full sm:w-auto px-8 py-5 rounded-3xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 group-hover:from-sky-300 group-hover:to-indigo-400 text-slate-950 font-black text-lg sm:text-xl flex items-center justify-center gap-3 shadow-2xl shadow-sky-500/40 group-hover:scale-105 active:scale-95 transition-all cursor-pointer font-['Fredoka',sans-serif] border-2 border-white/20"
              >
                <Play className="w-6 h-6 fill-current" />
                <span>Open Staff Composer</span>
                <ArrowRight className="w-6 h-6" />
              </span>

              <a
                {...link('big-staff')}
                className="pointer-events-auto relative z-10 w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer font-['Fredoka',sans-serif] border border-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                title="Launch Staff Composer directly into Big Staff 1-bar view with Easy Mode for K-1st grade"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Big Staff (K-1st Easy Mode)</span>
              </a>
            </div>
          </div>
        </section>
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Top Bar - Clean & Kid-Friendly */}
      {/* Top Bar - Clean & Kid-Friendly */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 text-white shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Mr. Arthur Avatar & Brand */}
          <div className="flex items-center gap-3">
            <button aria-label="Click to view Mr. Arthur"
              type="button"
              onClick={onOpenAvatar}
              className="w-12 h-12 rounded-2xl bg-slate-950 overflow-hidden flex items-center justify-center shadow-lg ring-2 ring-amber-300/60 hover:ring-amber-300 hover:scale-105 active:scale-95 transition-all select-none shrink-0 cursor-pointer"
              title="Click to view Mr. Arthur"
            >
              <img
                src="/mr-arthur-avatar-96.webp"
                alt="Mr. Arthur"
                className="w-full h-full object-cover object-top"
              />
            </button>
            <h1 aria-label="Mr. Arthur's Music Lab" className="flex flex-col justify-center select-none m-0 font-normal">
              <span className="text-xs font-extrabold tracking-wider uppercase text-amber-300/95 font-['Fredoka',sans-serif] leading-tight">
                Mr. Arthur&apos;s
              </span>
              <span className="text-2xl sm:text-3xl font-black tracking-wide bg-gradient-to-r from-amber-300 via-rose-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent font-['Fredoka',sans-serif] leading-none">
                Music Lab
              </span>
            </h1>
          </div>

          {/* Right Header: Student Sign In & Help */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onOpenClassroom}
              title={
                studentSession
                  ? `Signed in as ${studentSession.firstName} — click to view saved songs or log out`
                  : 'Student Sign In'
              }
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs sm:text-sm font-black border transition-all cursor-pointer shadow-md font-['Fredoka',sans-serif] ${
                studentSession
                  ? 'bg-sky-500/20 border-sky-400/60 text-sky-300 hover:bg-sky-500/30'
                  : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-700'
              }`}
            >
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>{studentSession ? studentSession.firstName : 'Student Sign In'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">
        {studentSession && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Welcome, {studentSession.firstName}! Your work saves automatically.</span>
            </div>
          </div>
        )}

        {/* Continue where you left off: the last tools this signed-in student opened on this device */}
        {studentSession && recent.length > 0 && (
          <section aria-labelledby="continue-heading" className="space-y-3">
            <h2 id="continue-heading" className="text-xl font-black text-white font-['Fredoka',sans-serif]">
              Continue where you left off
            </h2>
            <ul className="flex flex-wrap gap-3">
              {recent.map((entry) => {
                const props = 'path' in entry.to ? { href: hrefForEntry(entry) } : link(entry.id);
                return (
                  <li key={entry.id}>
                    <a
                      {...props}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-100 font-black text-sm font-['Fredoka',sans-serif] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                    >
                      <span aria-hidden="true">{entry.emoji}</span>
                      <span>{entry.title}</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Grade filter: hides what does not suit the chosen grades (everything stays one click away under "All grades") */}
        <div role="group" aria-label="Show activities for a grade" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 mr-1">Show:</span>
          {(['all', ...GRADE_BANDS] as GradeFilter[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={grade === g}
              onClick={() => setGrade(g)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black border transition-colors cursor-pointer font-['Fredoka',sans-serif] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${
                grade === g
                  ? 'bg-amber-400 border-amber-300 text-slate-950'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {g === 'all' ? 'All grades' : `Grades ${g}`}
            </button>
          ))}
        </div>

        {/* Main tools: Staff Composer first, then the four featured tools in one even row */}
        {(visible('staff-composer') || FEATURED.some((x) => visible(x.id))) && (
          <section aria-labelledby="main-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-3">
              <h2 id="main-heading" className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif]">
                Main tools
              </h2>
              <span className="text-xs sm:text-sm text-slate-400 font-semibold">Where most music-making happens</span>
            </div>
            {visible('staff-composer') && heroCard}
            {FEATURED.some((x) => visible(x.id)) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {FEATURED.filter((x) => visible(x.id)).map((x) => featureCard(x.id, x.f))}
              </div>
            )}
          </section>
        )}

        {/* The rest of the classroom tools: one grid, every card the same size */}
        {TOOL_ORDER.some(visible) && (
          <section aria-labelledby="more-heading" className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-baseline gap-1 sm:gap-3">
              <h2 id="more-heading" className="text-2xl sm:text-3xl font-black text-white font-['Fredoka',sans-serif]">
                More classroom tools
              </h2>
              <span className="text-xs sm:text-sm text-slate-400 font-semibold">Drums, games, practice and teacher helpers · smartboard ready</span>
            </div>
            {TOOL_GROUPS.filter((g) => g.ids.some(visible)).map((g) => (
              <div key={g.heading} className="space-y-3">
                <h3 className="flex items-baseline gap-2 text-sm sm:text-base font-black uppercase tracking-wider text-slate-300 font-['Fredoka',sans-serif]">
                  {g.heading}
                  <span className="text-xs font-semibold normal-case tracking-normal text-slate-500">{g.note}</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{g.ids.filter(visible).map((id) => toolCard(id))}</div>
              </div>
            ))}
          </section>
        )}

        {/* Visible Footer with NY Ed Law § 2-d & Parents' Bill of Rights */}
        <footer className="w-full pt-6 pb-10 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">Mr. Arthur&apos;s Music Lab</span>
            <span className="opacity-40">•</span>
            <span>Elementary &amp; Middle School Music</span>
            <span className="opacity-40">•</span>
            <span>
              Instrument sounds: MusyngKite soundfont,{' '}
              <a
                href="https://creativecommons.org/licenses/by-sa/3.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-sky-300"
              >
                CC BY-SA 3.0
              </a>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenEdLaw}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 font-semibold transition-all cursor-pointer shadow-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>NY Ed Law § 2-d &amp; Parents&apos; Bill of Rights</span>
            </button>

            <a
              href="/Dentichorus/index.html"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-amber-300 hover:bg-slate-800/60 transition-colors text-[12px]"
            >
              Denti Chorus
            </a>
          </div>
        </footer>
      </main>

      {/* Classroom Tool Box Modal: each tool has its own address (/?app=metronome ...) */}
      <LazyClassroomToolBoxModal
        isOpen={openTool !== null}
        onClose={() => onOpenTool(null)}
        initialTool={openTool || 'tempo-tapper'}
        onToolChange={onSwitchTool}
      />
    </div>
  );
};
