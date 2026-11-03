/**
 * Pictures for lessons and slides: AI drawings (free Cloudflare FLUX models), openly licensed
 * photos (Openverse, Wikimedia Commons) and Wikipedia's main images, all through the site's
 * Worker. Library photos are downloaded and kept with the deck, so decks work offline and
 * export to PowerPoint.
 */
import { PictureStyle } from '../types';
import { cloudSync } from './cloudSync';

export interface PickedImage {
  src: string; // data URL (kept with the deck) or, while browsing results, a web address
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

export interface WikiFact {
  title: string;
  extract: string;
  url: string;
  image: { url: string; width: number; height: number } | null;
}

export const PICTURE_STYLES: { id: PictureStyle; name: string; prompt: string }[] = [
  { id: 'storybook', name: 'Storybook', prompt: "Warm storybook watercolor illustration, soft colors, like a children's picture book." },
  { id: 'cartoon', name: 'Cartoon', prompt: 'Bright, friendly cartoon illustration with bold outlines and cheerful colors.' },
  { id: 'flat', name: 'Flat graphic', prompt: 'Clean flat vector illustration, simple shapes, modern classroom poster style.' },
  { id: 'realistic', name: 'Realistic', prompt: 'Realistic, well-lit photograph style, natural colors.' }
];

/** Added to every AI picture so results suit a K–6 classroom and leave words to the slide. */
const CLASSROOM_RULES =
  'Suitable for an elementary school music classroom. Clean composition. No text, no letters, no words, no logos, no sheet music notation.';

const styleText = (style: PictureStyle = 'storybook') => PICTURE_STYLES.find((s) => s.id === style)?.prompt || PICTURE_STYLES[0].prompt;

/** Re-encodes an image as a JPEG no larger than maxSide, so pictures stay quick to sync. */
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
      ctx.fillStyle = '#ffffff'; // transparent PNGs (common on Wikipedia) get a white background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

/** Downloads a library image through the site and returns it as a small data URL. */
export async function downloadImage(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await cloudSync.hubFetch(`/api/hub/image-proxy?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Could not fetch that picture (${res.status})`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await shrinkImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Makes a picture to keep: downloads library photos, leaves AI/uploaded ones as they are. */
export async function keepImage(image: PickedImage): Promise<PickedImage> {
  return image.src.startsWith('data:') ? image : { ...image, src: await downloadImage(image.src) };
}

/** Draws a picture from a description. `wide` asks for a 16:9 image (slides); otherwise square. */
export async function generateImage(description: string, wide = true, style?: PictureStyle): Promise<PickedImage> {
  const res = await cloudSync.hubFetch('/api/hub/ai-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: `${description.trim()}. ${styleText(style)} ${CLASSROOM_RULES}`, wide })
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

const wikiCache = new Map<string, Promise<WikiFact | null>>();

/** The Wikipedia article for a subject (summary, link and main picture), or null. */
export function lookupWikipedia(subject: string): Promise<WikiFact | null> {
  const key = subject.trim().toLowerCase();
  if (!wikiCache.has(key)) {
    wikiCache.set(
      key,
      cloudSync
        .hubFetch(`/api/hub/wiki?q=${encodeURIComponent(subject.trim())}`)
        .then((r) => r.json())
        .then((d) => (d?.ok && d.title ? (d as WikiFact) : null))
        .catch(() => null)
    );
  }
  return wikiCache.get(key)!;
}

export const photoToImage = (p: PhotoResult): PickedImage => ({
  src: p.url,
  alt: p.title,
  credit: `Photo: ${p.creator} · ${p.license}`,
  creditUrl: p.sourceUrl
});

export const wikiToImage = (w: WikiFact): PickedImage | null =>
  w.image ? { src: w.image.url, alt: w.title, credit: `Image: Wikipedia, ${w.title}`, creditUrl: w.url } : null;

const searchVariants = (idea: string) => {
  const parts = idea.split(/[,;:–—]/).map((p) => p.trim()).filter(Boolean);
  return [...new Set([idea.trim(), ...parts, parts[0]?.split(/\s+/).slice(-2).join(' ')].filter(Boolean))].slice(0, 4);
};

/** The best library photo for a picture idea, downloaded and ready to keep, or null. */
export async function firstPhoto(idea: string): Promise<PickedImage | null> {
  for (const query of searchVariants(idea)) {
    const results = await searchPhotos(query);
    const wide = results.find((r) => r.width >= r.height * 1.2) || results[0];
    if (wide) return keepImage(photoToImage(wide));
  }
  return null;
}

/** Picture options for a slide: its subject's Wikipedia image first, then library photos. */
export async function pictureOptions(subject: string | undefined, idea: string): Promise<{ wiki: PickedImage | null; photos: PhotoResult[] }> {
  const [wiki, photos] = await Promise.all([
    subject ? lookupWikipedia(subject).then((w) => (w ? wikiToImage(w) : null)) : Promise.resolve(null),
    (async () => {
      for (const query of searchVariants(subject ? `${subject}` : idea)) {
        const found = await searchPhotos(query).catch(() => []);
        if (found.length) return found;
      }
      return [] as PhotoResult[];
    })()
  ]);
  return { wiki, photos };
}
