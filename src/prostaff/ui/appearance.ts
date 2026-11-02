// Look-and-feel choices: the app theme and the typeface for the score's words (titles, tempo, lyrics,
// expressions). The music symbols come from the engraving font, chosen separately (Verovio's `font`).

export type ThemeName = 'dark' | 'light';
export type CursorStyle = 'line' | 'notes' | 'measure' | 'none';

export interface TextFont {
  id: string;
  label: string;
  family: string; // CSS font-family list (single quotes only: it goes inside an SVG attribute)
}

export const TEXT_FONTS: TextFont[] = [
  { id: 'classic', label: 'Classic (Times)', family: "'Times New Roman', Times, serif" },
  { id: 'garamond', label: 'Garamond', family: "'EB Garamond', Garamond, serif" },
  { id: 'baskerville', label: 'Baskerville', family: "'Libre Baskerville', Baskerville, serif" },
  { id: 'modern', label: 'Modern sans', family: "Inter, 'Helvetica Neue', Arial, sans-serif" },
  { id: 'jazz', label: 'Handwritten (jazz)', family: "Kalam, 'Marker Felt', 'Comic Sans MS', cursive" },
];

/** Google Fonts stylesheet with the app's own fonts and every score text font (files load only when used). */
export const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Music' +
  '&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Kalam:wght@400;700&display=swap';

export function textFont(id: string | undefined): TextFont {
  return TEXT_FONTS.find((f) => f.id === id) || TEXT_FONTS[0];
}

/** Swaps the engraved page's text typeface (Verovio sets it once, on the page's inner <svg>). */
export function applyTextFont(svg: string, id: string | undefined): string {
  const f = textFont(id);
  if (f.id === 'classic') return svg;
  return svg.replace(/font-family="Times, serif"/g, `font-family="${f.family}"`);
}
