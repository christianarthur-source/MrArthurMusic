/**
 * Service for creating and resolving clean, short shareable links (e.g. mrarthurmusic.com/?s=8kF2q9)
 * backed by Supabase with automatic offline fallback to compressed URLs.
 */

const SUPABASE_URL = 'https://xnbhxrzzyjbthrobdkwb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_JipVOkkWnwggeTM6uv7sEQ_rcLwiMmZ';

export type SupportedShareApp = 'staff-composer' | 'beat-machine' | 'daw' | 'staff-wars';

export interface SharedLinkRecord {
  id: string;
  app_type: SupportedShareApp;
  title: string | null;
  payload: any;
  created_at?: string;
}

// Unambiguous alphabet (excluding 0, O, 1, l, I) to prevent student confusion
const SHORT_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generate a random 6-character short code
 */
export function generateShortSlug(length: number = 6): string {
  let result = '';
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += SHORT_ALPHABET[bytes[i] % SHORT_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += SHORT_ALPHABET[Math.floor(Math.random() * SHORT_ALPHABET.length)];
    }
  }
  return result;
}

/**
 * Get public clean base URL
 */
export function getCleanBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  // Links made on Cloudflare preview/workers.dev addresses point at the real site
  // (share links are stored in the shared database, so the live site can open them).
  if (window.location.hostname.endsWith('.workers.dev')) {
    return 'https://mrarthurmusic.com';
  }
  // Automatically convert private development URL to public preview URL if needed
  if (origin.includes('ais-dev-')) {
    return origin.replace('ais-dev-', 'ais-pre-');
  }
  return origin;
}

/**
 * Build the full short shareable link URL
 */
export function formatShortUrl(slug: string): string {
  const base = getCleanBaseUrl();
  let pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Clean off trailing filename like index.html if present
  if (pathname.endsWith('/index.html') || pathname === 'index.html') {
    pathname = pathname.replace(/\/index\.html$/, '/');
  }
  
  const cleanPath = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${base}${cleanPath}?s=${slug}`;
}

/**
 * Store a song / score / project payload in Supabase shared_links and return a short URL.
 * Falls back to null if request fails so caller can use offline base64 fallback.
 */
export async function createShortLink(
  appType: SupportedShareApp,
  title: string | undefined | null,
  payload: any
): Promise<{ shortUrl: string; slug: string } | null> {
  const slug = generateShortSlug(6);
  
  const record = {
    id: slug,
    app_type: appType,
    title: title ? String(title).slice(0, 100) : null,
    payload,
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/shared_links`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (!res.ok) {
      console.warn(`[ShortLink] Supabase save returned ${res.status}, using offline fallback`);
      return null;
    }

    return {
      slug,
      shortUrl: formatShortUrl(slug),
    };
  } catch (err) {
    console.warn('[ShortLink] Network error while creating short link, using offline fallback', err);
    return null;
  }
}

/**
 * Fetch a shared song / score / project from Supabase by short code
 */
export async function fetchShortLink(slug: string): Promise<SharedLinkRecord | null> {
  if (!slug || slug.trim().length === 0) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/shared_links?id=eq.${encodeURIComponent(slug.trim())}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.warn(`[ShortLink] Failed to fetch short link ${slug}: ${res.status}`);
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as SharedLinkRecord;
    }
    return null;
  } catch (err) {
    console.error('[ShortLink] Error fetching short link', err);
    return null;
  }
}
