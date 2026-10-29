/**
 * Loop-library catalog format ("mrdaw-catalog" v1).
 *
 * Produced by scripts/ingest-library.mjs, served as static immutable files:
 *   <root>/manifest.json                 small, fetched first (no-cache / short TTL)
 *   <root>/shards/<n>.<hash>.json        CatalogShard, immutable
 *   <root>/audio/<id>.<hash>.mp3         full-quality asset, immutable
 *   <root>/preview/<id>.<hash>.mp3       low-bitrate preview, immutable
 * All URLs inside the manifest/shards are relative to <root>.
 */

export type InstrumentCategory =
  | 'drums'
  | 'electronic-drums'
  | 'percussion'
  | 'bass'
  | 'synth-bass'
  | 'electric-guitar'
  | 'acoustic-guitar'
  | 'piano'
  | 'keys'
  | 'synth'
  | 'strings'
  | 'brass'
  | 'woodwinds'
  | 'vocals'
  | 'mallets'
  | 'world'
  | 'fx';

export type Genre =
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'rnb-soul'
  | 'electronic'
  | 'jazz'
  | 'blues'
  | 'funk'
  | 'country'
  | 'folk'
  | 'latin'
  | 'reggae'
  | 'cinematic'
  | 'world'
  | 'ambient'
  | 'lofi';

export type Confidence = 'verified' | 'estimated' | 'unknown';

export interface CatalogLicense {
  id: string; // SPDX-like id, e.g. "CC0-1.0", "CC-BY-4.0", "Proprietary-Licensed", or "UNVERIFIED"
  attribution?: string;
  url?: string;
}

export interface CatalogEntry {
  id: string; // stable asset id, never derived from the file name at runtime
  version: number; // bumped when the audio changes
  name: string;
  instrument: InstrumentCategory;
  subcategory?: string;
  genres: Genre[];
  tags: string[];
  moods: string[];
  energy?: 1 | 2 | 3;
  bpm?: number;
  bpmConfidence: Confidence;
  key?: string; // e.g. "C", "F#m"
  keyConfidence: Confidence;
  timeSig: [number, number];
  bars?: number;
  durationSec: number;
  frames: number; // exact source length in sample frames at sampleRate
  encoderDelay: number; // leading priming frames in the encoded file
  oneShot: boolean;
  channels: number;
  sampleRate: number;
  codec: 'mp3';
  bitrateKbps: number;
  audio: string; // relative URL of the full asset
  bytes: number;
  preview: string; // relative URL of the preview asset
  previewBytes: number;
  previewEncoderDelay: number;
  loudnessLufs?: number;
  peakDb?: number;
  peaks: string; // 64 bytes as hex (128 chars); max |sample| per bucket scaled 0..255
  acoustic?: boolean;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  pack: string;
  creator?: string;
  source?: string;
  description?: string;
  license: CatalogLicense;
  review: 'approved' | 'needs-review';
  sha256: string; // of the delivered full asset file
}

/** Columnar shard: rows[i][j] is the value of fields[j] for entry i (undefined -> null). */
export interface CatalogShard {
  format: 'mrdaw-catalog-shard';
  version: number;
  fields: (keyof CatalogEntry)[];
  rows: unknown[][];
}

export interface CatalogManifest {
  format: 'mrdaw-catalog';
  version: number; // catalog build version (monotonic)
  generatedAt: string;
  count: number;
  shards: { url: string; count: number; bytes: number }[];
  facets: {
    instrument: Record<string, number>;
    genre: Record<string, number>;
    mood: Record<string, number>;
    key: Record<string, number>;
  };
  packs: { id: string; name: string; license: CatalogLicense; count: number }[];
}

/** Sampled-instrument manifest for instrument tracks: <root>/instruments.json */
export interface InstrumentManifest {
  format: 'mrdaw-instruments';
  version: number;
  baseUrl: string; // absolute path on the site, e.g. "/audio/samples/"
  instruments: {
    id: string;
    name: string;
    family: string;
    kind: 'melodic' | 'drumkit';
    /** melodic: MIDI note -> relative sample URL. drumkit: GM drum note -> relative sample URL. */
    samples: Record<string, string>;
    range?: [number, number];
    /** Drum kits: display names for GM notes (e.g. "Cajon Slap"). */
    noteNames?: Record<string, string>;
    license: CatalogLicense;
  }[];
}

export function decodePeaks(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}
