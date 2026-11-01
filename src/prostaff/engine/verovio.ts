// Loads the Verovio engraving engine (WebAssembly) on first use. Only Pro Staff pulls this in.
import type { VerovioToolkit as VerovioToolkitT } from 'verovio/esm';

let toolkitPromise: Promise<VerovioToolkitT> | null = null;

export function getToolkit(): Promise<VerovioToolkitT> {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([import('verovio/wasm'), import('verovio/esm')]);
      const mod = await createVerovioModule();
      const tk = new VerovioToolkit(mod);
      return tk;
    })();
    toolkitPromise.catch(() => {
      toolkitPromise = null;
    });
  }
  return toolkitPromise;
}

/** A second toolkit for conversions (imports, transposition) so the display toolkit keeps its data. */
let convertPromise: Promise<VerovioToolkitT> | null = null;
export function getConverter(): Promise<VerovioToolkitT> {
  if (!convertPromise) {
    convertPromise = (async () => {
      await getToolkit();
      const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([import('verovio/wasm'), import('verovio/esm')]);
      const mod = await createVerovioModule();
      return new VerovioToolkit(mod);
    })();
  }
  return convertPromise;
}

export type EngravingFont = 'Leipzig' | 'Bravura' | 'Leland' | 'Petaluma' | 'Gootville';

export interface ViewOptions {
  layout: 'page' | 'continuous';
  zoom: number; // percent
  font: EngravingFont;
  concertPitch: boolean;
  pageWidth: number; // in Verovio units (tenths of mm at scale 100)
}

export const DEFAULT_VIEW: ViewOptions = { layout: 'page', zoom: 55, font: 'Leipzig', concertPitch: false, pageWidth: 2100 };

export function renderOptions(v: ViewOptions, hasEncodedBreaks: boolean): Record<string, unknown> {
  const continuous = v.layout === 'continuous';
  return {
    scale: v.zoom,
    font: v.font,
    pageWidth: continuous ? 60000 : v.pageWidth,
    pageHeight: continuous ? 60000 : 2970,
    adjustPageHeight: true,
    adjustPageWidth: continuous,
    breaks: continuous ? 'none' : hasEncodedBreaks ? 'smart' : 'auto',
    header: continuous ? 'none' : 'auto',
    footer: 'none', // no "engraved with Verovio" logo on the page
    pageMarginTop: 60,
    pageMarginBottom: 60,
    pageMarginLeft: 80,
    pageMarginRight: 80,
    spacingSystem: 12,
    spacingStaff: 10,
    justifyVertically: false,
    transposeToSoundingPitch: v.concertPitch,
    mnumInterval: 1,
    svgViewBox: false,
    svgBoundingBoxes: false,
    svgHtml5: false,
    svgFormatRaw: true,
    xmlIdSeed: 1,
    condense: 'none',
    // roomier measures so empty bars are easy to click and write in
    measureMinWidth: 30,
    spacingLinear: 0.35,
    lyricSize: 4.2,
    midiTempoAdjustment: 1,
    expand: '',
  };
}

/** Engraving options for printing / PDF: full US Letter pages (8.5 × 11 in, 1 unit = 0.1 mm). */
export function printOptions(v: ViewOptions, hasEncodedBreaks: boolean): Record<string, unknown> {
  return {
    ...renderOptions({ ...v, layout: 'page' }, hasEncodedBreaks),
    scale: 100,
    pageWidth: 2159,
    pageHeight: 2794,
    adjustPageHeight: false,
    justifyVertically: true,
    pageMarginTop: 100,
    pageMarginBottom: 100,
    pageMarginLeft: 120,
    pageMarginRight: 120,
    spacingSystem: 14,
    header: 'auto',
    footer: 'none',
  };
}
