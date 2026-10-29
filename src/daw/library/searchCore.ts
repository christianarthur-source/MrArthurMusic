import { CatalogEntry, CatalogShard } from './catalogTypes';

/**
 * Pure search/index logic (runs inside the search worker; unit-tested in node).
 * Index: token -> sorted entry indices, plus numeric columns for range filters.
 */

export interface LibraryQuery {
  text?: string;
  instruments?: string[];
  genres?: string[];
  moods?: string[];
  keys?: string[];
  bpmMin?: number;
  bpmMax?: number;
  maxDurationSec?: number;
  kind?: 'loop' | 'oneshot' | 'any';
  ids?: string[]; // restrict to (favorites / recents / collection)
  approvedOnly?: boolean;
  /** Restrict to these packs (e.g. templates use only the CC0 Studio kits). */
  packs?: string[];
  sort?: 'relevance' | 'name' | 'bpm' | 'duration';
  tempoHint?: number; // relevance boost for loops near this BPM
  /** Show one row per loop name; other keys of the same loop become `alternates`. */
  collapseKeys?: boolean;
  offset?: number;
  limit?: number;
}

export interface KeyAlternate {
  id: string;
  key?: string;
}

export type LibraryRow = CatalogEntry & { alternates?: KeyAlternate[] };

export interface LibraryResult {
  total: number;
  rows: LibraryRow[];
  tookMs: number;
}

export function decodeShard(shard: CatalogShard): CatalogEntry[] {
  if (shard.format !== 'mrdaw-catalog-shard') throw new Error('Bad catalog shard format');
  return shard.rows.map((row) => {
    const e: Record<string, unknown> = {};
    shard.fields.forEach((f, i) => {
      if (row[i] !== null && row[i] !== undefined) e[f] = row[i];
    });
    return e as unknown as CatalogEntry;
  });
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9#]+/)
    .filter(Boolean);
}

export class SearchIndex {
  entries: CatalogEntry[] = [];
  private byId = new Map<string, number>();
  private tokens = new Map<string, number[]>();
  private sortedTokens: string[] = [];

  add(entries: CatalogEntry[]) {
    for (const e of entries) {
      if (this.byId.has(e.id)) continue;
      const idx = this.entries.length;
      this.entries.push(e);
      this.byId.set(e.id, idx);
      const words = new Set(
        tokenize([e.name, e.instrument.replace('-', ' '), e.subcategory ?? '', ...e.genres, ...e.tags, ...e.moods, e.key ?? '', e.pack, e.description ?? ''].join(' ')),
      );
      for (const w of words) {
        let list = this.tokens.get(w);
        if (!list) this.tokens.set(w, (list = []));
        list.push(idx);
      }
    }
    this.sortedTokens = [...this.tokens.keys()].sort();
  }

  get(id: string): CatalogEntry | undefined {
    const i = this.byId.get(id);
    return i === undefined ? undefined : this.entries[i];
  }

  /** Indices matching every query word (each word matches as a prefix of any token). */
  private textMatches(words: string[]): Map<number, number> | null {
    if (!words.length) return null;
    let result: Map<number, number> | null = null;
    for (const w of words) {
      const hits = new Map<number, number>();
      // binary search for the first token >= w, then walk while prefix matches
      let lo = 0;
      let hi = this.sortedTokens.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.sortedTokens[mid] < w) lo = mid + 1;
        else hi = mid;
      }
      for (let i = lo; i < this.sortedTokens.length && this.sortedTokens[i].startsWith(w); i++) {
        const tok = this.sortedTokens[i];
        const score = tok === w ? 3 : 1;
        for (const idx of this.tokens.get(tok)!) hits.set(idx, Math.max(hits.get(idx) ?? 0, score));
      }
      if (result === null) result = hits;
      else {
        const next = new Map<number, number>();
        for (const [idx, s] of hits) {
          const prev: number | undefined = result.get(idx);
          if (prev !== undefined) next.set(idx, prev + s);
        }
        result = next;
      }
      if (result.size === 0) break;
    }
    return result;
  }

  query(q: LibraryQuery): LibraryResult {
    const t0 = performance.now();
    const words = tokenize(q.text ?? '');
    const text = this.textMatches(words);
    const inst = q.instruments?.length ? new Set(q.instruments) : null;
    const genres = q.genres?.length ? new Set(q.genres) : null;
    const moods = q.moods?.length ? new Set(q.moods) : null;
    const keys = q.keys?.length ? new Set(q.keys) : null;
    const ids = q.ids ? new Set(q.ids) : null;
    const out: { idx: number; score: number }[] = [];
    const candidates: Iterable<number> = text ? text.keys() : this.entries.keys();
    for (const idx of candidates) {
      const e = this.entries[idx];
      if (ids && !ids.has(e.id)) continue;
      if (q.approvedOnly && e.review !== 'approved') continue;
      if (q.packs && !q.packs.includes(e.pack)) continue;
      if (inst && !inst.has(e.instrument)) continue;
      if (genres && !e.genres.some((g) => genres.has(g))) continue;
      if (moods && !e.moods.some((m) => moods.has(m))) continue;
      if (keys && !(e.key && keys.has(e.key))) continue;
      if (q.kind === 'loop' && e.oneShot) continue;
      if (q.kind === 'oneshot' && !e.oneShot) continue;
      if (q.bpmMin !== undefined && (e.bpm === undefined || e.bpm < q.bpmMin)) continue;
      if (q.bpmMax !== undefined && (e.bpm === undefined || e.bpm > q.bpmMax)) continue;
      if (q.maxDurationSec !== undefined && e.durationSec > q.maxDurationSec) continue;
      let score = text ? text.get(idx)! : 0;
      if (q.tempoHint && e.bpm) score += Math.max(0, 1 - Math.abs(e.bpm - q.tempoHint) / 40);
      out.push({ idx, score });
    }
    const sort = q.sort ?? 'relevance';
    const name = (i: number) => this.entries[i].name;
    out.sort((a, b) => {
      if (sort === 'name') return name(a.idx).localeCompare(name(b.idx));
      if (sort === 'bpm') return (this.entries[a.idx].bpm ?? 999) - (this.entries[b.idx].bpm ?? 999);
      if (sort === 'duration') return this.entries[a.idx].durationSec - this.entries[b.idx].durationSec;
      return b.score - a.score || name(a.idx).localeCompare(name(b.idx));
    });
    const offset = q.offset ?? 0;
    const limit = Math.min(500, q.limit ?? 100);
    if (q.collapseKeys) {
      const groups = new Map<string, LibraryRow>();
      for (const o of out) {
        const e = this.entries[o.idx];
        const g = groups.get(e.name);
        if (!g) groups.set(e.name, { ...e, alternates: [{ id: e.id, key: e.key }] });
        else g.alternates!.push({ id: e.id, key: e.key });
      }
      const rows = [...groups.values()];
      for (const r of rows) r.alternates!.sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''));
      return { total: rows.length, rows: rows.slice(offset, offset + limit), tookMs: performance.now() - t0 };
    }
    return {
      total: out.length,
      rows: out.slice(offset, offset + limit).map((o) => this.entries[o.idx]),
      tookMs: performance.now() - t0,
    };
  }
}
