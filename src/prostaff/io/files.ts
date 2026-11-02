// Importing and exporting score files.
import { getConverter } from '../engine/verovio';
import { Score } from '../model/score';
import { descendants, children, el } from '../model/mei';

export const IMPORT_ACCEPT = '.mei,.xml,.musicxml,.mxl,.abc,.txt';

/** Turns any supported file into an editable Score (MEI). */
export async function importScoreFile(file: File): Promise<Score> {
  const name = file.name.toLowerCase();
  const tk = await getConverter();
  tk.setOptions({ transpose: '', expand: '' });
  if (name.endsWith('.mxl')) {
    const buf = await file.arrayBuffer();
    if (!tk.loadZipDataBuffer(buf)) throw new Error('That compressed MusicXML file could not be read.');
    return normalizeImported(Score.fromMei(tk.getMEI({})), file.name);
  }
  const text = await file.text();
  return importScoreText(text, file.name);
}

export async function importScoreText(text: string, name = 'Imported score'): Promise<Score> {
  const tk = await getConverter();
  tk.setOptions({ transpose: '', expand: '' });
  const trimmed = text.trimStart();
  if (/<mei[\s>]/.test(trimmed.slice(0, 2000)) && /music-encoding/.test(trimmed.slice(0, 4000))) {
    // MEI: load through Verovio to validate, but keep our own copy so ids and details are preserved
    if (!tk.loadData(text)) throw new Error('Verovio could not read this MEI file.');
    return normalizeImported(Score.fromMei(text), name);
  }
  if (!tk.loadData(text)) throw new Error('This file is not a format Pro Staff can read (MusicXML, MEI or ABC).');
  return normalizeImported(Score.fromMei(tk.getMEI({})), name);
}

/** Small fixes so imported scores behave like ones made in the editor. */
export function normalizeImported(score: Score, fileName: string): Score {
  const meta = score.getMeta();
  // copy the credits into the title statement, which is what the page header prints
  score.setMeta({ title: meta.title || fileName.replace(/\.[^.]+$/, ''), composer: meta.composer, lyricist: meta.lyricist, arranger: meta.arranger });
  // Verovio writes <pgHead> page headers for some imports; the editor draws its own from the metadata
  for (const h of descendants(score.doc, 'pgHead')) h.remove();
  for (const h of descendants(score.doc, 'pgFoot')) h.remove();
  // every measure needs every staff for editing
  const staffNs = score.staffDefs().map((d) => d.getAttribute('n') || '1');
  for (const m of score.measures()) {
    for (const n of staffNs) {
      if (!score.staffEl(m, n)) {
        const st = el(score.doc, 'staff', { n });
        st.appendChild(el(score.doc, 'layer', { n: 1 })).appendChild(el(score.doc, 'mSpace'));
        const firstCtl = children(m).find((c) => c.localName !== 'staff');
        m.insertBefore(st, firstCtl || null);
      }
    }
  }
  score.invalidate();
  // files without beam information (and scanned pages) would show a flag on every eighth note
  for (const layer of descendants(score.doc, 'layer')) {
    if (descendants(layer, 'beam').length || descendants(layer, 'beamSpan').length) continue;
    const short = descendants(layer, 'note').concat(descendants(layer, 'chord')).filter((n) => Number(n.getAttribute('dur') || 0) >= 8 && !n.getAttribute('grace'));
    if (short.length >= 2) score.rebeam(layer);
  }
  score.invalidate();
  return score;
}

export function download(data: BlobPart, fileName: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function safeFileName(title: string) {
  return (title || 'score').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'score';
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Opens a print window with the engraved pages (US Letter), which the browser can save as PDF. */
export function printPages(svgPages: string[], title: string, pageSize: 'letter' | 'a4' = 'letter', fontsHref?: string) {
  const [pw, ph] = pageSize === 'a4' ? ['210mm', '297mm'] : ['8.5in', '11in'];
  const w = window.open('', '_blank');
  if (!w) throw new Error('Allow pop-ups to print or save as PDF.');
  // Each page is engraved at Letter proportions; give the outer <svg> a viewBox so it scales to the sheet.
  const pages = svgPages
    .map((svg) => {
      const fitted = svg.replace(/<svg([^>]*?)\swidth="([\d.]+)px"([^>]*?)\sheight="([\d.]+)px"/, '<svg$1$3 viewBox="0 0 $2 $4" preserveAspectRatio="xMidYMin meet"');
      return `<section class="page">${fitted}</section>`;
    })
    .join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${fontsHref ? `<link rel="stylesheet" href="${escapeHtml(fontsHref)}">` : ''}
<style>
@page { size: ${pageSize === 'a4' ? 'A4' : 'letter'} portrait; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: ${pw}; height: ${ph}; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.page svg { display: block; width: 100%; height: 100%; }
@media screen { body { background: #e7e5e4; padding: 0.25in 0; } .page { background: #fff; margin: 0 auto 0.25in; box-shadow: 0 2px 12px rgba(0,0,0,.15); } }
</style></head><body>${pages}<script>window.onload=()=>(document.fonts?document.fonts.ready:Promise.resolve()).then(()=>setTimeout(()=>window.print(),400))<\/script></body></html>`);
  w.document.close();
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
