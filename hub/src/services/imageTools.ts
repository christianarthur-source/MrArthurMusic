/**
 * Pictures for lessons and slides: AI drawings (free Cloudflare FLUX models) and openly
 * licensed photos (Openverse), both through the site's Worker.
 */
import { cloudSync } from './cloudSync';

export interface PickedImage {
  src: string; // data URL (AI / upload) or a photo's web address
  alt?: string;
  credit?: string; // e.g. "Photo: Jane Doe · CC BY 2.0"
  creditUrl?: string;
}

export interface PhotoResult {
  url: string;
  thumbnail: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
}

/** Added to every AI picture request so results suit a K–6 classroom and leave words to the slide. */
const CLASSROOM_STYLE =
  'Bright, friendly, colorful illustration suitable for an elementary school music classroom. ' +
  'Clean composition, no text, no letters, no words, no logos.';

/** Re-encodes an image as a JPEG no wider than maxSide, so pictures stay quick to sync. */
export function shrinkImage(src: string, maxSide = 1280, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not process that image.'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Draws a picture from a description. `wide` asks for a 16:9 image (slides); otherwise square. */
export async function generateImage(description: string, wide = true): Promise<PickedImage> {
  const res = await cloudSync.hubFetch('/api/hub/ai-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: `${description.trim()}. ${CLASSROOM_STYLE}`, wide })
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.image) throw new Error(data?.error || `Image request failed (${res.status})`);
  return { src: await shrinkImage(data.image), alt: description.trim(), credit: 'AI illustration' };
}

export async function searchPhotos(query: string): Promise<PhotoResult[]> {
  const res = await cloudSync.hubFetch(`/api/hub/image-search?q=${encodeURIComponent(query.trim())}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Photo search failed (${res.status})`);
  return data?.results || [];
}

export const photoToImage = (p: PhotoResult): PickedImage => ({
  src: p.url,
  alt: p.title,
  credit: `Photo: ${p.creator} · ${p.license}`,
  creditUrl: p.sourceUrl
});

/**
 * The first wide-ish photo for a picture idea, or null. Long ideas ("children tapping rhythm
 * sticks, steady beat") often find nothing, so shorter pieces of the idea are tried next.
 */
export async function firstPhoto(idea: string): Promise<PickedImage | null> {
  const parts = idea.split(/[,;:–—-]/).map((p) => p.trim()).filter(Boolean);
  const tries = [...new Set([idea.trim(), ...parts, parts[0]?.split(/\s+/).slice(-2).join(' ')].filter(Boolean))].slice(0, 4);
  for (const query of tries) {
    const results = await searchPhotos(query);
    const wide = results.find((r) => r.width >= r.height * 1.2) || results[0];
    if (wide) return photoToImage(wide);
  }
  return null;
}
