import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';

interface HalloweenThemeOverlayProps {
  onClose: () => void;
}

export const HalloweenThemeOverlay: React.FC<HalloweenThemeOverlayProps> = ({ onClose }) => {
  const [showSpookyBanner, setShowSpookyBanner] = useState<boolean>(true);

  // Auto-hide the celebratory banner after 5 seconds, but keep the subtle theme banner
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSpookyBanner(false);
    }, 4500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Top Floating Control Bar to easily Close Theme & indicator */}
      <div className="fixed top-3 right-4 z-50 flex items-center gap-2 print:hidden select-none animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-950/90 border-2 border-orange-500/80 shadow-2xl backdrop-blur-md text-orange-200">
          <span className="text-base animate-bounce">🎃</span>
          <span className="text-xs font-black tracking-wider uppercase font-['Fredoka',sans-serif] text-orange-300">
            Halloween Mode
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

      {/* Secret Theme Unlocked Toast Alert */}
      {showSpookyBanner && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-90 slide-in-from-bottom-4 duration-300 print:hidden select-none">
          <div className="bg-slate-950/95 border-2 border-orange-500 text-orange-200 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3">
            <span className="text-3xl animate-bounce">🎃</span>
            <div>
              <div className="flex items-center gap-1.5 text-orange-400 font-extrabold text-sm font-['Fredoka',sans-serif]">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                <span>SECRET HALLOWEEN THEME UNLOCKED!</span>
                <span className="text-base">👻</span>
              </div>
              <p className="text-xs text-orange-200/90 font-medium">
                Trick or Treat! Enjoy the spooky colors, bats, pumpkins, and spiders. Click &quot;Close Theme&quot; anytime to return to normal!
              </p>
            </div>
            <span className="text-3xl animate-pulse">🍬</span>
          </div>
        </div>
      )}

      {/* Atmospheric Cobwebs in the Top Corners */}
      <div className="fixed top-0 left-0 w-48 h-48 pointer-events-none z-30 opacity-75 print:hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full text-orange-300/50 fill-none stroke-current" strokeWidth="1.2">
          <path d="M 0,0 L 100,0 M 0,0 L 85,25 M 0,0 L 65,55 M 0,0 L 40,80 M 0,0 L 0,100" />
          <path d="M 0,20 Q 15,15 20,0 M 0,40 Q 30,30 40,0 M 0,60 Q 45,45 60,0 M 0,80 Q 60,60 80,0" />
          <circle cx="28" cy="28" r="2.5" fill="#fdba74" />
        </svg>
      </div>

      <div className="fixed top-0 right-0 w-48 h-48 pointer-events-none z-30 opacity-75 print:hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full text-purple-400/50 fill-none stroke-current" strokeWidth="1.2">
          <path d="M 100,0 L 0,0 M 100,0 L 15,25 M 100,0 L 35,55 M 100,0 L 60,80 M 100,0 L 100,100" />
          <path d="M 100,20 Q 85,15 80,0 M 100,40 Q 70,30 60,0 M 100,60 Q 55,45 40,0 M 100,80 Q 40,60 20,0" />
        </svg>
      </div>

      {/* Fun Playful Animated/Floating Halloween Characters Sprinkled on Sides & Slightly Overlapping Staff */}
      <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden print:hidden select-none">
        {/* Floating Ghost top left - Larger size */}
        <div className="absolute top-20 left-2 sm:left-6 text-5xl sm:text-6xl filter drop-shadow-[0_0_16px_rgba(255,255,255,0.6)] animate-bounce" style={{ animationDuration: '3.2s' }}>
          👻
        </div>

        {/* Playful Bat flutter near top right */}
        <div className="absolute top-16 right-44 sm:right-60 text-4xl sm:text-5xl filter drop-shadow-[0_0_12px_rgba(251,146,60,0.7)] animate-pulse" style={{ animationDuration: '2.1s' }}>
          🦇
        </div>

        {/* Witch flying on broom mid-left, peeking near staff edge */}
        <div className="absolute top-60 left-1 sm:left-4 md:left-8 text-5xl sm:text-6xl filter drop-shadow-[0_0_16px_rgba(168,85,247,0.7)] animate-pulse" style={{ animationDuration: '2.8s' }}>
          🧙‍♀️
        </div>

        {/* Big Black Cat perched mid-right, slightly overlapping container margin */}
        <div className="absolute top-72 right-2 sm:right-4 md:right-8 text-5xl sm:text-6xl filter drop-shadow-[0_0_14px_rgba(249,115,22,0.7)] hover:scale-125 transition-transform">
          🐈‍⬛
        </div>

        {/* Friendly Dancing Skeleton bottom left */}
        <div className="absolute bottom-20 left-2 sm:left-6 md:left-10 text-5xl sm:text-6xl filter drop-shadow-[0_0_16px_rgba(255,255,255,0.5)] animate-bounce" style={{ animationDuration: '4.5s' }}>
          💀
        </div>

        {/* Jack-o'-lantern bottom right glowing brightly */}
        <div className="absolute bottom-16 right-2 sm:right-6 md:right-12 text-6xl sm:text-7xl filter drop-shadow-[0_0_24px_rgba(249,115,22,0.9)] animate-pulse" style={{ animationDuration: '1.8s' }}>
          🎃
        </div>

        {/* Big Spider dangling from top center */}
        <div className="absolute top-0 left-1/4 flex flex-col items-center">
          <div className="w-[1.5px] h-20 bg-purple-300/60"></div>
          <span className="text-3xl sm:text-4xl -mt-1 filter drop-shadow-[0_0_10px_rgba(192,132,252,0.8)] animate-pulse">🕷️</span>
        </div>

        {/* Extra Fun Characters overlapping near score edges */}
        {/* Playful Mummy */}
        <div className="absolute top-1/3 right-1 sm:right-3 md:right-6 text-4xl sm:text-5xl filter drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]">
          🧟
        </div>

        {/* Candy treats sprinkled */}
        <div className="absolute top-44 right-16 sm:right-24 text-3xl sm:text-4xl filter drop-shadow-lg animate-bounce" style={{ animationDuration: '5s' }}>
          🍬
        </div>
        <div className="absolute bottom-40 left-12 sm:left-20 text-3xl sm:text-4xl filter drop-shadow-lg animate-bounce" style={{ animationDuration: '4s' }}>
          🍭
        </div>

        {/* Flying bats */}
        <div className="absolute top-32 left-1/3 text-3xl opacity-80 animate-pulse" style={{ animationDuration: '3s' }}>
          🦇
        </div>
      </div>
    </>
  );
};
