// Sound Blocks: short share links. Same shared_links table and publishable key the rest of the site already uses
// (see Chrome Music Lab EXTRA's Song Maker). Falls back to a longer link that carries the song in the # part.
import { toPayload, fromPayload } from './song.js';

const DB_URL = 'https://xnbhxrzzyjbthrobdkwb.supabase.co/rest/v1/shared_links';
const DB_KEY = 'sb_publishable_JipVOkkWnwggeTM6uv7sEQ_rcLwiMmZ';
export const APP_TYPE = 'sound-blocks';
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0 O 1 l I

export function makeSlug(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function linkBase() {
  // Links made on a preview or local copy still point at the real site, which reads the same table.
  const host = location.hostname;
  const local = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.workers.dev');
  return `${local ? 'https://mrarthurmusic.com' : location.origin}/soundblocks/`;
}

const b64 = {
  enc: (str) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};

/** Returns { url, short } ('short' is false when the offline fallback link was used). Never throws. */
export async function createLink(song) {
  const payload = toPayload(song);
  const slug = makeSlug();
  try {
    const res = await fetch(DB_URL, {
      method: 'POST',
      headers: { apikey: DB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id: slug, app_type: APP_TYPE, title: 'Sound Blocks song', payload }),
    });
    if (res.ok) return { url: `${linkBase()}?s=${slug}`, short: true };
    console.warn(`[Sound Blocks] share save returned ${res.status}, using the long link`);
  } catch (err) {
    console.warn('[Sound Blocks] share save failed, using the long link', err);
  }
  return { url: `${linkBase()}#sb=${b64.enc(JSON.stringify(payload))}`, short: false };
}

/** Reads a song from the page address: ?s=slug (database) or #sb=... (long link). Resolves to a song or null. */
export async function readLinkFromLocation(catalog, loc = location) {
  const q = new URLSearchParams(loc.search).get('s');
  if (q && /^[A-Za-z0-9]{4,12}$/.test(q)) {
    try {
      const res = await fetch(`${DB_URL}?id=eq.${encodeURIComponent(q)}&select=app_type,payload`, { headers: { apikey: DB_KEY } });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0] && rows[0].app_type === APP_TYPE) return fromPayload(rows[0].payload, catalog);
      }
    } catch { /* fall through: no song */ }
    return null;
  }
  const h = /^#sb=([A-Za-z0-9_-]{1,4000})$/.exec(loc.hash || '');
  if (h) {
    try { return fromPayload(JSON.parse(b64.dec(h[1])), catalog); } catch { return null; }
  }
  return null;
}

export const hasLinkInLocation = (loc = location) => new URLSearchParams(loc.search).has('s') || /^#sb=/.test(loc.hash || '');
