import { SharedSongData, MelodyInstrument, SoundType, ScaleMode, BassInstrument } from '../types';

export interface CompactSongPayload {
  v: 2;
  t?: string; // Title
  b?: number; // BPM
  m?: number; // Measures (1-4)
  st?: 8 | 16; // Steps in measure
  p?: string; // Pack ID
  i?: MelodyInstrument; // Instrument
  s?: ScaleMode; // Scale
  io?: 1 | 2; // Instrument Octaves
  bi?: BassInstrument; // Bass Instrument
  bs?: ScaleMode; // Bass Scale
  bo?: 1 | 2; // Bass Octaves
  d?: Record<string, number[]>; // Drum active steps (soundType -> step indices)
  n?: Record<string, number[]>; // Melody active steps (noteId -> step indices)
  ba?: Record<string, number[]>; // Bass active steps (noteId -> step indices)
  // FX Settings (boolean flags)
  fx?: {
    e?: boolean; // Echo
    r?: boolean; // Reverb
    bc?: boolean; // Bitcrusher
    di?: boolean; // Distortion
    fi?: boolean; // Filter
  };
}

/**
 * Returns the public app URL where anyone can open without Google or developer login.
 * In AI Studio, the development URL is ais-dev-* (which requires Google workspace developer auth),
 * whereas the public shared URL is ais-pre-* (which is freely accessible by anyone).
 */
export const getPublicBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  const currentOrigin = window.location.origin;
  // Automatically convert private development URL to public shared preview URL
  if (currentOrigin.includes('ais-dev-')) {
    return currentOrigin.replace('ais-dev-', 'ais-pre-');
  }
  return currentOrigin;
};

/**
 * Compress song data into a lightweight payload suitable for URL params.
 * Reduces 5,000+ characters of boolean arrays down to ~200-300 characters of active step indices.
 */
export const compressSong = (song: SharedSongData): CompactSongPayload => {
  const d: Record<string, number[]> = {};
  song.drumTracks?.forEach((track) => {
    const active: number[] = [];
    track.steps?.forEach((val, idx) => {
      if (val) active.push(idx);
    });
    if (active.length > 0) {
      d[track.soundType] = active;
    }
  });

  const n: Record<string, number[]> = {};
  song.melodyTracks?.forEach((track) => {
    const active: number[] = [];
    track.steps?.forEach((val, idx) => {
      if (val) active.push(idx);
    });
    if (active.length > 0) {
      n[track.noteId] = active;
    }
  });

  const ba: Record<string, number[]> = {};
  song.bassTracks?.forEach((track) => {
    const active: number[] = [];
    track.steps?.forEach((val, idx) => {
      if (val) active.push(idx);
    });
    if (active.length > 0) {
      ba[track.noteId] = active;
    }
  });

  return {
    v: 2,
    t: song.title || "Mr. Arthur's Beat",
    b: song.bpm || 110,
    m: song.measures || 1,
    st: song.totalStepsInMeasure || 16,
    p: song.packId || 'classic-hiphop',
    i: song.melodyInstrument || 'xylo',
    s: song.melodyScale || 'pentatonic',
    io: song.melodyOctaves || 1,
    bi: song.bassInstrument || 'synth-bass',
    bs: song.bassScale || 'pentatonic',
    bo: song.bassOctaves || 1,
    d,
    n,
    ba,
    fx: {
      e: song.isEchoOn,
      r: song.isReverbOn,
      bc: song.isBitcrusherOn,
      di: song.isDistortionOn,
      fi: song.isFilterOn,
    },
  };
};

/**
 * Decompress either a compact payload (v2) or a legacy payload (v1).
 */
export const decompressSong = (raw: any): SharedSongData | null => {
  if (!raw || typeof raw !== 'object') return null;

  // Legacy format where drumTracks and melodyTracks are already full arrays
  if (Array.isArray(raw.drumTracks) && Array.isArray(raw.melodyTracks)) {
    return raw as SharedSongData;
  }

  // Compact v2 format
  const compact = raw as CompactSongPayload;
  const drumTracks = Object.entries(compact.d || {}).map(([soundType, stepsList]) => {
    const steps = Array(64).fill(false);
    if (Array.isArray(stepsList)) {
      stepsList.forEach((s) => {
        if (typeof s === 'number' && s >= 0 && s < 64) {
          steps[s] = true;
        }
      });
    }
    return { soundType: soundType as SoundType, steps };
  });

  const melodyTracks = Object.entries(compact.n || {}).map(([noteId, stepsList]) => {
    const steps = Array(64).fill(false);
    if (Array.isArray(stepsList)) {
      stepsList.forEach((s) => {
        if (typeof s === 'number' && s >= 0 && s < 64) {
          steps[s] = true;
        }
      });
    }
    return { noteId, steps };
  });

  const bassTracks = Object.entries(compact.ba || {}).map(([noteId, stepsList]) => {
    const steps = Array(64).fill(false);
    if (Array.isArray(stepsList)) {
      stepsList.forEach((s) => {
        if (typeof s === 'number' && s >= 0 && s < 64) {
          steps[s] = true;
        }
      });
    }
    return { noteId, steps };
  });

  return {
    version: 2,
    title: compact.t || "Mr. Arthur's Beat",
    bpm: typeof compact.b === 'number' ? compact.b : 110,
    measures: typeof compact.m === 'number' ? Math.min(4, Math.max(1, compact.m)) : 1,
    totalStepsInMeasure: compact.st === 8 ? 8 : 16,
    packId: compact.p || 'classic-hiphop',
    drumTracks,
    melodyInstrument: compact.i || 'xylo',
    melodyScale: compact.s || 'pentatonic',
    melodyOctaves: compact.io === 2 ? 2 : 1,
    melodyTracks,
    bassInstrument: compact.bi || 'synth-bass',
    bassScale: compact.bs || 'pentatonic',
    bassOctaves: compact.bo === 2 ? 2 : 1,
    bassTracks,
    isEchoOn: compact.fx?.e ?? false,
    isReverbOn: compact.fx?.r ?? false,
    isBitcrusherOn: compact.fx?.bc ?? false,
    isDistortionOn: compact.fx?.di ?? false,
    isFilterOn: compact.fx?.fi ?? false,
  };
};

/**
 * Generate a publicly accessible shareable link that works without requiring login.
 */
export const createShareableSongUrl = (songData: SharedSongData): string => {
  try {
    const compact = compressSong(songData);
    const jsonStr = JSON.stringify(compact);
    const encoded = btoa(encodeURIComponent(jsonStr));

    const publicBase = getPublicBaseUrl();
    const url = new URL(window.location.pathname, publicBase);
    url.searchParams.set('song', encoded);
    return url.toString();
  } catch (err) {
    console.error('Error generating shareable link:', err);
    return window.location.href;
  }
};

/**
 * Extract and decode a song from either URL query parameters or hash fragment.
 */
export const extractSongFromLocation = (): SharedSongData | null => {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check URL query params (?song=...)
    const searchParams = new URLSearchParams(window.location.search);
    let songParam = searchParams.get('song') || searchParams.get('s');

    // 2. Check hash (#song=... or #s=...)
    if (!songParam && window.location.hash) {
      const hashContent = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashContent);
      songParam = hashParams.get('song') || hashParams.get('s') || hashContent;
    }

    if (!songParam) return null;

    // Decode base64 and URI component
    const decodedJson = decodeURIComponent(atob(songParam));
    const parsed = JSON.parse(decodedJson);
    return decompressSong(parsed);
  } catch (err) {
    console.warn('Could not parse shared song from URL', err);
    return null;
  }
};
