import { Project } from '../model/types';

/**
 * Self-contained share links: the whole project, deflate-compressed and base64url-encoded,
 * in the URL fragment (#mrdaw=…), which browsers never send to a server. Used when the host
 * offers no short links (or they fail). Library loops are referenced by id, so links stay small;
 * a student's own recordings are not included.
 */

const HASH_KEY = 'mrdaw';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function makeLongShareLink(p: Project): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(JSON.stringify(p)), new CompressionStream('deflate-raw'));
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?app=daw#${HASH_KEY}=${toBase64Url(packed)}`;
}

/** The project in this page's #mrdaw= link, if any (then removes it from the address bar). */
export async function readShareFromLocation(): Promise<unknown | null> {
  const m = new RegExp(`[#&]${HASH_KEY}=([A-Za-z0-9_-]+)`).exec(window.location.hash);
  if (!m) return null;
  history.replaceState(null, '', window.location.pathname + window.location.search);
  const json = await pipe(fromBase64Url(m[1]), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(json));
}
