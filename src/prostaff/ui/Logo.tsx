import React from 'react';

/** Wolfi's mark: two beamed eighth notes in a fine circle — simple, gold, musical. */
export function WolfiMark({ size = 30, color = '#e0b45e' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="29.5" fill="none" stroke={color} strokeWidth="2" opacity="0.9" />
      <circle cx="32" cy="32" r="25.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.45" />
      {/* note heads */}
      <ellipse cx="22.5" cy="43.5" rx="6.2" ry="4.4" transform="rotate(-24 22.5 43.5)" fill={color} />
      <ellipse cx="41" cy="39.5" rx="6.2" ry="4.4" transform="rotate(-24 41 39.5)" fill={color} />
      {/* stems */}
      <rect x="27.3" y="20.5" width="2.2" height="22" rx="1" fill={color} />
      <rect x="45.8" y="16.5" width="2.2" height="22" rx="1" fill={color} />
      {/* beam */}
      <path d="M27.3 19.2 L48 14.6 L48 20.2 L27.3 24.8 Z" fill={color} />
    </svg>
  );
}

/** The mark as an SVG string, for the browser-tab icon. */
export function wolfiFaviconHref() {
  const c = '#e0b45e';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15171c"/><ellipse cx="22.5" cy="43.5" rx="6.6" ry="4.8" transform="rotate(-24 22.5 43.5)" fill="${c}"/><ellipse cx="41" cy="39.5" rx="6.6" ry="4.8" transform="rotate(-24 41 39.5)" fill="${c}"/><rect x="27.6" y="19" width="2.8" height="24" rx="1.2" fill="${c}"/><rect x="46" y="15" width="2.8" height="24" rx="1.2" fill="${c}"/><path d="M27.6 18 L48.8 13.2 L48.8 19.6 L27.6 24.4 Z" fill="${c}"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function WolfiBrand() {
  return (
    <div className="ps-brand" aria-label="Wolfi — Pro Staff Notation">
      <WolfiMark />
      <div className="ps-brand-text">
        <b>Wolfi</b>
        <span>Pro Staff Notation</span>
      </div>
    </div>
  );
}
