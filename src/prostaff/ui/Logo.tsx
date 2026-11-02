import React from 'react';

/**
 * Wolfi's mark: a quarter note whose stem crosses a staff line, framed by an open circle.
 * The bottom-left quarter of the circle is left open for the note head. Fine gold lines.
 */
export function WolfiMark({ size = 30, color = '#e0b45e', weight = 1.1 }: { size?: number; color?: string; weight?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round">
        <path d="M9 24 A15 15 0 1 1 24 39" />
        <path d="M1.5 24 H24" />
        <path d="M24 1.5 V46.5" />
      </g>
      <ellipse cx="19.2" cy="31.4" rx="4.9" ry="3.5" transform="rotate(-24 19.2 31.4)" fill={color} />
    </svg>
  );
}

/** The mark as an SVG string, for the browser-tab icon (heavier lines so it reads at 16px). */
export function wolfiFaviconHref() {
  const c = '#e0b45e';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#15171c"/><g fill="none" stroke="${c}" stroke-width="3.4" stroke-linecap="round"><path d="M13 32 A19 19 0 1 1 32 51"/><path d="M6 32 H32"/><path d="M32 6 V58"/></g><ellipse cx="25.5" cy="41.5" rx="6.8" ry="4.9" transform="rotate(-24 25.5 41.5)" fill="${c}"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** Header lockup: the wordmark starts inside the circle, so the mark and the name read as one logo. */
export function WolfiBrand() {
  return (
    <div className="ps-brand" aria-label="Wolfi — Pro Staff Notation">
      <WolfiMark size={54} />
      <div className="ps-brand-text">
        <b>Wolfi</b>
        <span>Pro Staff Notation</span>
      </div>
    </div>
  );
}
