import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface ThanksgivingThemeOverlayProps {
  onClose: () => void;
}

/** A pilgrim's tall black hat with a gold buckle (there's no emoji for one). */
const PilgrimHat: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 56" className={className} aria-hidden="true">
    <ellipse cx="32" cy="48" rx="30" ry="7" fill="#1c1410" />
    <path d="M14 47 L19 8 Q32 3 45 8 L50 47 Z" fill="#2a1d16" />
    <path d="M16.5 34 L47.5 34 L48.6 43 L15.4 43 Z" fill="#3b2a20" />
    <rect x="25" y="32" width="14" height="13" rx="1.5" fill="none" stroke="#f5c542" strokeWidth="3" />
  </svg>
);

/** Leaves drifting down the screen (positions, sizes and timings are fixed so they don't jump on re-render). */
const LEAVES = [
  { left: '6%', delay: '0s', dur: '13s', size: 'text-3xl', glyph: '🍂' },
  { left: '18%', delay: '4s', dur: '16s', size: 'text-2xl', glyph: '🍁' },
  { left: '31%', delay: '8s', dur: '14s', size: 'text-3xl', glyph: '🍂' },
  { left: '47%', delay: '2s', dur: '18s', size: 'text-2xl', glyph: '🍁' },
  { left: '62%', delay: '6s', dur: '15s', size: 'text-3xl', glyph: '🍂' },
  { left: '76%', delay: '10s', dur: '17s', size: 'text-2xl', glyph: '🍁' },
  { left: '90%', delay: '3s', dur: '14s', size: 'text-3xl', glyph: '🍂' },
];

export const ThanksgivingThemeOverlay: React.FC<ThanksgivingThemeOverlayProps> = ({ onClose }) => {
  const [showBanner, setShowBanner] = useState<boolean>(true);

  // The "unlocked" banner fades after a few seconds; the theme stays until it's closed
  useEffect(() => {
    const timer = setTimeout(() => setShowBanner(false), 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Theme indicator with a Close button */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2 print:hidden select-none animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-950/90 border-2 border-orange-500/80 shadow-2xl backdrop-blur-md text-orange-200">
          <span className="text-base animate-bounce">🦃</span>
          <span className="text-xs font-black tracking-wider uppercase font-['Fredoka',sans-serif] text-orange-300">
            Thanksgiving Mode
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Return to Normal Theme"
            className="ml-2 flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-600 hover:bg-orange-500 active:scale-95 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer border border-orange-400"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Theme</span>
          </button>
        </div>
      </div>

      {/* Secret theme unlocked */}
      {showBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-90 slide-in-from-bottom-4 duration-300 print:hidden select-none">
          <div className="bg-amber-950/95 border-2 border-orange-500 text-orange-100 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
            <span className="text-3xl animate-bounce">🦃</span>
            <div>
              <div className="flex items-center gap-1.5 text-orange-300 font-extrabold text-sm font-['Fredoka',sans-serif]">
                <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                <span>SECRET THANKSGIVING THEME UNLOCKED!</span>
                <span className="text-base">🍁</span>
              </div>
              <p className="text-xs text-orange-100/90 font-medium">
                Happy Thanksgiving! Enjoy the autumn colors, falling leaves, turkeys, and pies. Click &quot;Close Theme&quot; anytime to return to normal!
              </p>
            </div>
            <span className="text-3xl animate-pulse">🥧</span>
          </div>
        </div>
      )}

      {/* Harvest garland across the top corners */}
      <div className="fixed top-0 left-0 pointer-events-none z-30 print:hidden select-none text-3xl sm:text-4xl flex gap-1 opacity-90 -rotate-6 origin-top-left pl-2">
        <span>🍁</span><span>🍂</span><span>🌾</span>
      </div>
      <div className="fixed top-0 right-48 sm:right-64 pointer-events-none z-30 print:hidden select-none text-3xl sm:text-4xl flex gap-1 opacity-90 rotate-6 origin-top-right">
        <span>🌾</span><span>🍂</span><span>🍁</span>
      </div>

      {/* Falling leaves */}
      <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden print:hidden select-none">
        {LEAVES.map((l, i) => (
          <span
            key={i}
            className={`tg-leaf absolute -top-12 ${l.size} opacity-80`}
            style={{ left: l.left, animationDelay: l.delay, animationDuration: l.dur }}
          >
            {l.glyph}
          </span>
        ))}
      </div>

      {/* Characters and harvest things around the edges, slightly overlapping the staff */}
      <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden print:hidden select-none">
        {/* Turkey strutting, top left */}
        <div className="absolute top-20 left-2 sm:left-6 text-5xl sm:text-6xl drop-shadow-[0_0_14px_rgba(251,146,60,0.6)] animate-bounce" style={{ animationDuration: '3.2s' }}>
          🦃
        </div>

        {/* Pilgrim hat, mid-left */}
        <div className="absolute top-60 left-2 sm:left-5 md:left-8 w-14 sm:w-16 drop-shadow-[0_0_12px_rgba(245,197,66,0.45)] animate-pulse" style={{ animationDuration: '3.4s' }}>
          <PilgrimHat className="w-full h-auto" />
        </div>

        {/* Harvest basket, mid-right */}
        <div className="absolute top-72 right-2 sm:right-4 md:right-8 text-5xl sm:text-6xl drop-shadow-[0_0_14px_rgba(249,115,22,0.7)]">
          🧺
        </div>

        {/* Corn, upper right */}
        <div className="absolute top-1/3 right-1 sm:right-3 md:right-6 text-4xl sm:text-5xl drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]">
          🌽
        </div>

        {/* Pie, bottom right */}
        <div className="absolute bottom-16 right-2 sm:right-6 md:right-12 text-6xl sm:text-7xl drop-shadow-[0_0_20px_rgba(251,146,60,0.8)] animate-pulse" style={{ animationDuration: '2.4s' }}>
          🥧
        </div>

        {/* Second turkey, bottom left */}
        <div className="absolute bottom-20 left-2 sm:left-6 md:left-10 text-5xl sm:text-6xl drop-shadow-[0_0_14px_rgba(251,146,60,0.5)] animate-bounce" style={{ animationDuration: '4.5s' }}>
          🦃
        </div>

        {/* Sunflower and apple sprinkled */}
        <div className="absolute top-44 right-16 sm:right-24 text-3xl sm:text-4xl drop-shadow-lg animate-bounce" style={{ animationDuration: '5s' }}>
          🌻
        </div>
        <div className="absolute bottom-40 left-12 sm:left-20 text-3xl sm:text-4xl drop-shadow-lg animate-bounce" style={{ animationDuration: '4s' }}>
          🍎
        </div>
      </div>
    </>
  );
};
