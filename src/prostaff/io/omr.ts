// Client side of sheet-music scanning: prepares page images, sends them to /api/omr, merges the pages.

export interface ScanPage {
  id: string;
  kind: 'image' | 'pdf';
  name: string;
  /** base64 without the data: prefix */
  data: string;
  mediaType: string;
  preview?: string; // object URL / data URL for thumbnails
  pdfPage?: number;
  pdfPages?: number;
  rotation?: number;
}

const MAX_EDGE = 2400;

/** Loads an image file or blob, applies rotation, downsizes it and returns a JPEG page. */
export async function imageToPage(blob: Blob, name: string, rotation = 0): Promise<ScanPage> {
  const bmp = await createImageBitmap(blob);
  const swap = rotation % 180 !== 0;
  const w0 = swap ? bmp.height : bmp.width;
  const h0 = swap ? bmp.width : bmp.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2);
  g.rotate((rotation * Math.PI) / 180);
  const dw = (swap ? h : w);
  const dh = (swap ? w : h);
  // light clean-up: grayscale with a little extra contrast helps on phone photos
  g.filter = 'grayscale(1) contrast(1.15)';
  g.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
  bmp.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'image',
    name,
    data: dataUrl.split(',')[1],
    mediaType: 'image/jpeg',
    preview: dataUrl,
    rotation,
  };
}

export async function rotatePage(page: ScanPage, blobSource: Blob | null): Promise<ScanPage> {
  const src = blobSource || (await (await fetch(page.preview!)).blob());
  const p = await imageToPage(src, page.name, 90);
  return { ...p, id: page.id };
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

/** Rough page count of a PDF (counts page objects). */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  const m = text.match(/\/Type\s*\/Page(?!s)/g);
  return Math.max(1, m ? m.length : 1);
}

export async function pdfToPages(file: File): Promise<ScanPage[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 15 * 1024 * 1024) throw new Error('That PDF is over 15 MB. Split it or export a smaller copy.');
  const count = pdfPageCount(bytes);
  if (count > 30) throw new Error('That PDF has more than 30 pages. Scan a smaller section at a time.');
  const data = bytesToBase64(bytes);
  return Array.from({ length: count }, (_, i) => ({
    id: Math.random().toString(36).slice(2),
    kind: 'pdf' as const,
    name: `${file.name} — page ${i + 1}`,
    data,
    mediaType: 'application/pdf',
    pdfPage: i + 1,
    pdfPages: count,
  }));
}

export interface ScanResult {
  musicxml: string;
  truncated?: boolean;
}

async function recognizeOne(page: ScanPage, index: number, total: number, pin: string, hint: string, signal?: AbortSignal): Promise<ScanResult> {
  const res = await fetch('/api/omr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    signal,
    body: JSON.stringify({
      teacherPin: pin,
      page: { mediaType: page.mediaType, data: page.data },
      pageNumber: page.kind === 'pdf' ? page.pdfPage : index + 1,
      pageCount: page.kind === 'pdf' ? page.pdfPages : total,
      hint,
    }),
  });
  const text = await res.text();
  const line = text.trim().split('\n').filter(Boolean).pop() || '';
  let parsed: any = null;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(res.status === 404 ? 'Scanning is only available on the live site (the /api/omr service).' : `The scanner returned an unexpected answer (${res.status}).`);
  }
  if (!parsed.ok) throw new Error(parsed.error || 'Recognition failed.');
  return { musicxml: parsed.musicxml, truncated: parsed.truncated };
}

/** Recognizes pages in parallel (a few at a time) and reports progress. */
export async function recognizePages(
  pages: ScanPage[], pin: string, hint: string, onProgress: (done: number, total: number) => void, signal?: AbortSignal,
): Promise<ScanResult[]> {
  const out: ScanResult[] = new Array(pages.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(4, pages.length) }, async () => {
    while (next < pages.length) {
      const i = next++;
      out[i] = await recognizeOne(pages[i], i, pages.length, pin, hint, signal);
      done++;
      onProgress(done, pages.length);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Continuation pages restate clef/key/time; remove those that only repeat what is already in force. */
function dropRestatedAttributes(targetPart: Element, firstNew: Element | undefined) {
  if (!firstNew) return;
  const attrs = firstNew.getElementsByTagName('attributes')[0];
  if (!attrs) return;
  const current = new Map<string, string>();
  for (const a of Array.from(targetPart.getElementsByTagName('attributes'))) {
    for (const c of Array.from(a.children)) {
      if (!['clef', 'key', 'time'].includes(c.tagName)) continue;
      current.set(c.tagName + ':' + (c.getAttribute('number') || '1'), norm(c));
    }
  }
  for (const c of Array.from(attrs.children)) {
    if (!['clef', 'key', 'time'].includes(c.tagName)) continue;
    if (current.get(c.tagName + ':' + (c.getAttribute('number') || '1')) === norm(c)) c.remove();
  }
}

function norm(e: Element) {
  return (e.textContent || '').replace(/\s+/g, '');
}

/** Joins the MusicXML of several pages into one score (parts matched by order, then by name). */
export function mergeMusicXml(xmls: string[]): string {
  const parser = new DOMParser();
  const docs = xmls.map((x) => parser.parseFromString(x, 'application/xml'));
  const base = docs[0];
  if (base.getElementsByTagName('parsererror').length) throw new Error('Page 1 could not be read back. Try scanning it again.');
  const baseParts = Array.from(base.getElementsByTagName('part'));
  const nameOf = (doc: Document, id: string) =>
    Array.from(doc.getElementsByTagName('score-part')).find((p) => p.getAttribute('id') === id)?.getElementsByTagName('part-name')[0]?.textContent?.trim().toLowerCase() || '';
  for (const doc of docs.slice(1)) {
    if (doc.getElementsByTagName('parsererror').length) continue;
    const parts = Array.from(doc.getElementsByTagName('part'));
    parts.forEach((part, i) => {
      let target = baseParts[i];
      const name = nameOf(doc, part.getAttribute('id') || '');
      if (name) {
        const byName = baseParts.find((bp) => nameOf(base, bp.getAttribute('id') || '') === name);
        if (byName && parts.length !== baseParts.length) target = byName;
      }
      if (!target) return;
      const ms = Array.from(part.getElementsByTagName('measure'));
      dropRestatedAttributes(target, ms[0]);
      for (const m of ms) {
        const copy = base.importNode(m, true) as Element;
        copy.removeAttribute('implicit'); // only the very first measure can be a pickup
        target.appendChild(copy);
      }
    });
  }
  for (const part of baseParts) {
    let n = 1;
    const ms = Array.from(part.getElementsByTagName('measure'));
    if (ms[0]?.getAttribute('implicit') === 'yes') n = 0;
    for (const m of ms) m.setAttribute('number', String(n++));
  }
  return new XMLSerializer().serializeToString(base);
}
