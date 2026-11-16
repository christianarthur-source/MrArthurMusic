/**
 * Prints a small page of our own (a chart or a poster) without opening a pop-up window:
 * the page is built in a hidden frame and the browser's Print window is opened for it.
 * Everything that goes in is static text from this site, but values are still escaped.
 */

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const SHEET_CSS = `
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Fredoka', 'Trebuchet MS', Arial, sans-serif; color: #0f172a; margin: 0; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  p.sub { margin: 0 0 16px; color: #475569; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 15px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: middle; }
  th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
  .big { font-size: 22px; font-weight: 700; }
  .swatch { display: inline-block; width: 18px; height: 18px; border-radius: 50%; vertical-align: middle; margin-right: 8px; border: 1px solid #0f172a33; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .foot { margin-top: 18px; font-size: 12px; color: #64748b; }
`;

/** Opens the browser's Print window for a sheet. Returns false when printing is not available. */
export function printSheet(title: string, subtitle: string, bodyHtml: string): boolean {
  if (typeof document === 'undefined') return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.title = 'Print preview';
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  const cleanup = () => window.setTimeout(() => frame.remove(), 1500);
  frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${SHEET_CSS}</style></head><body>
    <h1>${escapeHtml(title)}</h1><p class="sub">${escapeHtml(subtitle)}</p>${bodyHtml}
    <p class="foot">Mr. Arthur's Music Lab &middot; mrarthurmusic.com</p></body></html>`;
  frame.onload = () => {
    try {
      const w = frame.contentWindow;
      if (!w) return cleanup();
      w.addEventListener('afterprint', cleanup);
      w.focus();
      w.print();
      window.setTimeout(cleanup, 60_000); // a Print window that never reports back
    } catch {
      cleanup();
    }
  };
  document.body.appendChild(frame);
  return true;
}
