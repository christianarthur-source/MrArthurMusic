import React from 'react';
import logoTrimmed from '../../assets/logo-trimmed.png';
import logoIcon from '../../assets/logo-icon.png';

interface LogoProps {
  collapsed?: boolean;
  compact?: boolean;
  teacherName?: string;
  appName?: string;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  collapsed = false,
  compact = false,
  teacherName = 'Music Teacher',
  appName = 'Music Teacher Hub',
  className = ''
}) => {
  if (collapsed) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <div
          className="w-11 h-11 rounded-xl bg-[#14171c] border border-stone-800/90 flex items-center justify-center p-1.5 shadow-md shadow-stone-950/30 hover:scale-105 transition-transform duration-200 group"
          title={`${appName} — ${teacherName}`}
        >
          <img
            src={logoIcon}
            alt={appName}
            className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <div className="w-8 h-8 rounded-lg bg-[#14171c] border border-stone-800 flex items-center justify-center p-1 shadow-sm">
          <img src={logoIcon} alt={appName} className="w-full h-full object-contain" />
        </div>
        <div>
          <span className="font-extrabold text-xs text-stone-900 dark:text-white leading-tight block">
            {appName}
          </span>
          <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none block">
            {teacherName}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full select-none ${className}`}>
      <div className="w-full bg-[#13171d] hover:bg-[#171c24] rounded-xl p-2.5 shadow-md shadow-stone-950/20 border border-stone-800/80 transition-all duration-200 group">
        {/* Main Logo Image & Badge */}
        <div className="flex items-center justify-between gap-2">
          <img
            src={logoTrimmed}
            alt={appName}
            className="h-10 w-auto max-w-[175px] object-contain group-hover:scale-[1.02] transition-transform duration-200"
          />
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            ♫ K-6
          </span>
        </div>

        {/* Teacher Subtitle & Subheading */}
        <div className="mt-2 pt-1.5 border-t border-stone-800/80 flex items-center justify-between text-[11px] leading-tight">
          <span className="font-semibold text-stone-200 truncate tracking-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {teacherName}
          </span>
          <span className="text-[10px] text-stone-400 font-medium">
            Command Center
          </span>
        </div>
      </div>
    </div>
  );
};
