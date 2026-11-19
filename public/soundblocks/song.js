// Sound Blocks: the song model. Pure functions only (no DOM, no audio), so Node tests can import this file.
//
// A song is a grid of blocks:
//   loops: LANES rows x SLOTS columns, each cell holds a loop id or null (one loop = one slot long)
//   fun:   one row of FUN_CELLS cells (half a slot each) holding a fun-sound id or null
// Everything is replaced, never edited in place, so undo is just "keep the old object".

export const SLOTS = 6;
export const LANES = 4;
export const FUN_SPAN = 2; // fun cells per slot
export const FUN_CELLS = SLOTS * FUN_SPAN;
export const MAX_PAYLOAD_BLOCKS = LANES * SLOTS + FUN_CELLS;
export const SHARE_VERSION = 1;

export function emptySong(world) {
  return {
    world,
    grid: Array.from({ length: LANES }, () => Array(SLOTS).fill(null)),
    fun: Array(FUN_CELLS).fill(null),
  };
}

const copy = (s) => ({ world: s.world, grid: s.grid.map((r) => r.slice()), fun: s.fun.slice() });

export function countBlocks(s) {
  return s.grid.flat().filter(Boolean).length + s.fun.filter(Boolean).length;
}
export const isEmpty = (s) => countBlocks(s) === 0;

const okLoop = (lane, slot) => Number.isInteger(lane) && Number.isInteger(slot) && lane >= 0 && lane < LANES && slot >= 0 && slot < SLOTS;
const okFun = (pos) => Number.isInteger(pos) && pos >= 0 && pos < FUN_CELLS;

export function placeLoop(s, lane, slot, id) {
  if (!okLoop(lane, slot)) return s;
  const n = copy(s);
  n.grid[lane][slot] = id;
  return n;
}
/** Move a loop to another cell. If the target is taken, the two swap. */
export function moveLoop(s, from, to) {
  if (!okLoop(from.lane, from.slot) || !okLoop(to.lane, to.slot)) return s;
  if (from.lane === to.lane && from.slot === to.slot) return s;
  const n = copy(s);
  const a = n.grid[from.lane][from.slot];
  n.grid[from.lane][from.slot] = n.grid[to.lane][to.slot];
  n.grid[to.lane][to.slot] = a;
  return n;
}
export function removeLoop(s, lane, slot) {
  return placeLoop(s, lane, slot, null);
}

export function placeFun(s, pos, id) {
  if (!okFun(pos)) return s;
  const n = copy(s);
  n.fun[pos] = id;
  return n;
}
export function moveFun(s, from, to) {
  if (!okFun(from) || !okFun(to) || from === to) return s;
  const n = copy(s);
  const a = n.fun[from];
  n.fun[from] = n.fun[to];
  n.fun[to] = a;
  return n;
}
export const removeFun = (s, pos) => placeFun(s, pos, null);

/** Drop blocks that are not in this catalog (a sound that no longer exists must never break a song). */
export function cleanSong(s, catalog) {
  const w = catalog.worlds.find((x) => x.id === s.world);
  if (!w) return null;
  const loops = new Set(w.loops.map((l) => l.id));
  const fun = new Set(catalog.fun.map((f) => f.id));
  const n = copy(s);
  n.grid = n.grid.map((r) => r.map((id) => (id && loops.has(id) ? id : null)));
  n.fun = n.fun.map((id) => (id && fun.has(id) ? id : null));
  return n;
}

// ---- share payload (small JSON, stored in the shared_links table) --------------------------------------
// { v:1, w:'playground', l:[[lane,slot,'xylo'],...], f:[[pos,'bikebell'],...] }  (loop ids lose their "<world>-" prefix)

export function toPayload(s) {
  const l = [];
  s.grid.forEach((row, lane) => row.forEach((id, slot) => { if (id) l.push([lane, slot, id.slice(s.world.length + 1)]); }));
  const f = [];
  s.fun.forEach((id, pos) => { if (id) f.push([pos, id.slice(4)]); });
  return { v: SHARE_VERSION, w: s.world, l, f };
}

/** Turn untrusted data (from the network or the URL) into a song, or null. Unknown or out-of-range blocks are skipped. */
export function fromPayload(p, catalog) {
  if (!p || typeof p !== 'object' || p.v !== SHARE_VERSION || typeof p.w !== 'string') return null;
  const world = catalog.worlds.find((w) => w.id === p.w);
  if (!world) return null;
  const loops = new Set(world.loops.map((l) => l.id));
  const fun = new Set(catalog.fun.map((f) => f.id));
  let s = emptySong(world.id);
  const l = Array.isArray(p.l) ? p.l.slice(0, MAX_PAYLOAD_BLOCKS) : [];
  for (const e of l) {
    if (!Array.isArray(e) || e.length !== 3 || typeof e[2] !== 'string') continue;
    const id = `${world.id}-${e[2]}`;
    if (okLoop(e[0], e[1]) && loops.has(id)) s = placeLoop(s, e[0], e[1], id);
  }
  const f = Array.isArray(p.f) ? p.f.slice(0, MAX_PAYLOAD_BLOCKS) : [];
  for (const e of f) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[1] !== 'string') continue;
    const id = `fun-${e[1]}`;
    if (okFun(e[0]) && fun.has(id)) s = placeFun(s, e[0], id);
  }
  return s;
}

// ---- timing ---------------------------------------------------------------------------------------------

/** Seconds in one slot (one loop) of a world. Every loop in a world has the same length. */
export const slotSeconds = (world) => world.loops[0].frames / world.loops[0].sr;
export const songSeconds = (world) => SLOTS * slotSeconds(world);

/** Every sound the song plays, with its start time (seconds from the start of the song) and length. */
export function eventsFor(s, catalog) {
  const world = catalog.worlds.find((w) => w.id === s.world);
  if (!world) return [];
  const slotLen = slotSeconds(world);
  const loops = new Map(world.loops.map((l) => [l.id, l]));
  const fun = new Map(catalog.fun.map((f) => [f.id, f]));
  const out = [];
  s.grid.forEach((row, lane) => row.forEach((id, slot) => {
    const l = id && loops.get(id);
    if (l) out.push({ cell: `L${lane}.${slot}`, kind: 'loop', id, start: slot * slotLen, dur: l.frames / l.sr });
  }));
  s.fun.forEach((id, pos) => {
    const f = id && fun.get(id);
    if (f) out.push({ cell: `F${pos}`, kind: 'fun', id, start: (pos * slotLen) / FUN_SPAN, dur: Math.min(f.max, f.frames / f.sr) });
  });
  return out.sort((a, b) => a.start - b.start);
}
