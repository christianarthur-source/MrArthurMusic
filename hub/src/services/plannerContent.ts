/**
 * Helpers for Daily Planner content: cleaning rich-text HTML before it is saved, shrinking
 * images so pages stay quick to sync, and tidying links.
 */

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'MARK', 'SPAN', 'FONT',
  'P', 'DIV', 'BR', 'H2', 'H3', 'UL', 'OL', 'LI', 'A', 'BLOCKQUOTE', 'HR'
]);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH']);
const ALLOWED_STYLES = new Set(['color', 'background-color', 'text-decoration', 'font-weight', 'font-style']);

export const CHECKLIST_CLASS = 'planner-checklist';

export function safeLinkUrl(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Keeps only simple formatting (bold, lists, headings, colors, links) from editor or pasted HTML. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild as HTMLElement;

  const clean = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (DROP_WITH_CONTENT.has(child.tagName)) {
        child.remove();
        continue;
      }
      clean(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const name = attr.name.toLowerCase();
        const keep =
          (name === 'href' && child.tagName === 'A') ||
          (name === 'style') ||
          (name === 'color' && child.tagName === 'FONT') ||
          (name === 'data-checked' && child.tagName === 'LI') ||
          (name === 'class' && child.tagName === 'UL' && attr.value === CHECKLIST_CLASS);
        if (!keep) child.removeAttribute(attr.name);
      }
      if (child.tagName === 'A') {
        const href = safeLinkUrl(child.getAttribute('href') || '');
        if (href) {
          child.setAttribute('href', href);
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        } else {
          child.removeAttribute('href');
        }
      }
      const style = (child as HTMLElement).style;
      if (style && style.length) {
        for (const prop of Array.from(style)) if (!ALLOWED_STYLES.has(prop)) style.removeProperty(prop);
        if (/url\(|expression/i.test(child.getAttribute('style') || '')) child.removeAttribute('style');
        if (!style.length) child.removeAttribute('style');
      }
    }
  };

  clean(root);
  return root.innerHTML;
}

export function plainText(html: string): string {
  // Separate lines, list items and headings so they don't run together in previews.
  const spaced = html.replace(/<\/(h[1-6]|p|div|li|blockquote)>|<br\s*\/?>/gi, ' $&');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Reads an image file and returns a JPEG data URL no larger than maxSide pixels on its long edge. */
export function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image this browser can open.'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process that image.'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function linkTitle(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

export function faviconFor(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
  } catch {
    return '';
  }
}
