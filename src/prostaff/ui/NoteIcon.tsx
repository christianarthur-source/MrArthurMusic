import React from 'react';

/** Duration icons drawn the same way for every note value (fonts draw ♩ and ♪ at a different size). */
export function NoteIcon({ dur, size = 22 }: { dur: string; size?: number }) {
  const d = Number(dur);
  const open = d <= 2;
  const stem = d >= 2;
  const flags = d >= 8 ? Math.log2(d) - 2 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <ellipse
        cx={stem ? 9.5 : 12}
        cy="18"
        rx="4.6"
        ry="3.3"
        transform={`rotate(-22 ${stem ? 9.5 : 12} 18)`}
        fill={open ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={open ? 1.7 : 0}
      />
      {stem && <rect x="13.1" y="2.5" width="1.6" height="15" rx="0.6" fill="currentColor" />}
      {Array.from({ length: flags }, (_, i) => (
        <path key={i} d={`M14.4 ${3 + i * 3.4} c 1.2 1.9 4.6 3.2 4.1 7 c -.5 -2.4 -2.4 -3.3 -4.1 -3.6 z`} fill="currentColor" />
      ))}
    </svg>
  );
}
