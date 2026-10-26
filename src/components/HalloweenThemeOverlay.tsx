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
      <div className="fixed top-0 left-0 w-36 h-36 pointer-events-none z-30 opacity-70 print:hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full text-orange-300/40 fill-none stroke-current" strokeWidth="1.2">
          <path d="M 0,0 L 100,0 M 0,0 L 85,25 M 0,0 L 65,55 M 0,0 L 40,80 M 0,0 L 0,100" />
          <path d="M 0,20 Q 15,15 20,0 M 0,40 Q 30,30 40,0 M 0,60 Q 45,45 60,0 M 0,80 Q 60,60 80,0" />
          <circle cx="28" cy="28" r="2" fill="#fdba74" />
        </svg>
      </div>

      <div className="fixed top-0 right-0 w-36 h-36 pointer-events-none z-30 opacity-70 print:hidden">
        <svg viewBox="0 0 100 100" className="w-full h-full text-purple-400/40 fill-none stroke-current" strokeWidth="1.2">
          <path d="M 100,0 L 0,0 M 100,0 L 15,25 M 100,0 L 35,55 M 100,0 L 60,80 M 100,0 L 100,100" />
          <path d="M 100,20 Q 85,15 80,0 M 100,40 Q 70,30 60,0 M 100,60 Q 55,45 40,0 M 100,80 Q 40,60 20,0" />
        </svg>
      </div>

      {/* Fun Playful Animated/Floating Halloween Characters Sprinkled on Sides (Pointer-events none so they never block buttons or staff) */}
      <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden print:hidden select-none">
        {/* Floating Ghost top left */}
        <div className="absolute top-20 left-4 sm:left-8 text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.4)] animate-bounce" style={{ animationDuration: '3.2s' }}>
          👻
        </div>

        {/* Playful Bat flutter near top right */}
        <div className="absolute top-16 right-44 sm:right-56 text-2xl sm:text-3xl filter drop-shadow-[0_0_8px_rgba(251,146,60,0.6)] animate-pulse" style={{ animationDuration: '2.1s' }}>
          🦇
        </div>

        {/* Witch on broom mid-left */}
        <div className="absolute top-64 left-2 sm:left-6 text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(168,85,247,0.5)] animate-pulse" style={{ animationDuration: '2.8s' }}>
          🧙‍♀️
        </div>

        {/* Black cat perched mid-right */}
        <div className="absolute top-80 right-3 sm:right-6 text-3xl sm:text-4xl filter drop-shadow-[0_0_10px_rgba(249,115,22,0.5)] hover:scale-125 transition-transform">
          🐈‍⬛
        </div>

        {/* Friendly Dancing Skeleton bottom left */}
        <div className="absolute bottom-28 left-4 sm:left-8 text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(255,255,255,0.3)] animate-bounce" style={{ animationDuration: '4.5s' }}>
          💀
        </div>

        {/* Jack-o'-lantern bottom right */}
        <div className="absolute bottom-24 right-4 sm:right-10 text-3xl sm:text-4xl filter drop-shadow-[0_0_16px_rgba(249,115,22,0.8)] animate-pulse" style={{ animationDuration: '1.8s' }}>
          🎃
        </div>

        {/* Spider dangling from top center-left */}
        <div className="absolute top-0 left-1/4 flex flex-col items-center">
          <div className="w-[1px] h-12 bg-purple-300/40"></div>
          <span className="text-xl -mt-1 filter drop-shadow-[0_0_6px_rgba(192,132,252,0.6)]">🕷️</span>
        </div>

        {/* Candy treat sprinkled */}
        <div className="absolute top-44 right-12 text-2xl filter drop-shadow-md">
          🍬
        </div>
        <div className="absolute bottom-48 left-16 text-2xl filter drop-shadow-md">
          🍭
        </div>

        {/* Flying bats in the sky */}
        <div className="absolute top-36 left-1/3 text-lg opacity-75 animate-pulse" style={{ animationDuration: '3s' }}>
          🦇
        </div>
      </div>
    </>
  );
};
