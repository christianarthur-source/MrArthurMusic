// Sound Blocks: the song model. Pure functions only (no DOM, no audio), so Node tests can import this file.
//
// A song is a grid of blocks:
//   grid: LANES rows x MAX_SLOTS columns, each cell holds a loop id, a recording id ('mic-...') or null (one block = one slot long)
//   fun:  one row of MAX_SLOTS * FUN_SPAN cells (half a slot each) holding a fun-sound id or null
//   slots: how many columns are in use (MIN_SLOTS to MAX_SLOTS; the "+" button adds one)
//   fx:   the effect amounts, 0-100 each
// Everything is replaced, never edited in place, so undo is just "keep the old object".

export const LANES = 4;
export const MIN_SLOTS = 6;
export const MAX_SLOTS = 12; // twice the starting length, so a song can never grow without limit
export const FUN_SPAN = 2; // fun cells per slot
export const MAX_FUN = MAX_SLOTS * FUN_SPAN;
export const MAX_PAYLOAD_BLOCKS = LANES * MAX_SLOTS + MAX_FUN;
export const SHARE_VERSION = 2;
export const FX_NAMES = ['echo', 'reverb', 'muffle', 'crunch'];
export const isMic = (id) => typeof id === 'string' && id.startsWith('mic-');

const noFx = () => ({ echo: 0, reverb: 0, muffle: 0, crunch: 0 });

export function emptySong(world) {
  return {
    world,
    slots: MIN_SLOTS,
    grid: Array.from({ length: LANES }, () => Array(MAX_SLOTS).fill(null)),
    fun: Array(MAX_FUN).fill(null),
    fx: noFx(),
  };
}

const copy = (s) => ({ world: s.world, slots: s.slots, grid: s.grid.map((r) => r.slice()), fun: s.fun.slice(), fx: { ...s.fx } });

export function countBlocks(s) {
  return s.grid.flat().filter(Boolean).length + s.fun.filter(Boolean).length;
}
export const hasFx = (s) => FX_NAMES.some((n) => s.fx[n] > 0);
/** Blank means nothing to share or save: no blocks (effect settings alone do not count). */
export const isEmpty = (s) => countBlocks(s) === 0;
export const micIdsIn = (s) => [...new Set(s.grid.flat().filter(isMic))];

const okLoop = (s, lane, slot) => Number.isInteger(lane) && Number.isInteger(slot) && lane >= 0 && lane < LANES && slot >= 0 && slot < s.slots;
const okFun = (s, pos) => Number.isInteger(pos) && pos >= 0 && pos < s.slots * FUN_SPAN;

export function placeLoop(s, lane, slot, id) {
  if (!okLoop(s, lane, slot)) return s;
  const n = copy(s);
  n.grid[lane][slot] = id;
  return n;
}
/** Move a block to another cell. If the target is taken, the two swap. */
export function moveLoop(s, from, to) {
  if (!okLoop(s, from.lane, from.slot) || !okLoop(s, to.lane, to.slot)) return s;
  if (from.lane === to.lane && from.slot === to.slot) return s;
  const n = copy(s);
  const a = n.grid[from.lane][from.slot];
  n.grid[from.lane][from.slot] = n.grid[to.lane][to.slot];
  n.grid[to.lane][to.slot] = a;
  return n;
}
export const removeLoop = (s, lane, slot) => placeLoop(s, lane, slot, null);

export function placeFun(s, pos, id) {
  if (!okFun(s, pos)) return s;
  const n = copy(s);
  n.fun[pos] = id;
  return n;
}
export function moveFun(s, from, to) {
  if (!okFun(s, from) || !okFun(s, to) || from === to) return s;
  const n = copy(s);
  const a = n.fun[from];
  n.fun[from] = n.fun[to];
  n.fun[to] = a;
  return n;
}
export const removeFun = (s, pos) => placeFun(s, pos, null);

/** Is the last measure (column) free of blocks? Only then can it be taken away. */
export function lastSlotEmpty(s) {
  const c = s.slots - 1;
  return s.grid.every((r) => !r[c]) && !s.fun[c * FUN_SPAN] && !s.fun[c * FUN_SPAN + 1];
}
export function addSlot(s) {
  if (s.slots >= MAX_SLOTS) return s;
  const n = copy(s);
  n.slots += 1;
  return n;
}
export function removeSlot(s) {
  if (s.slots <= MIN_SLOTS || !lastSlotEmpty(s)) return s;
  const n = copy(s);
  n.slots -= 1;
  return n;
}

const clampFx = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
export function setFx(s, name, value) {
  if (!FX_NAMES.includes(name)) return s;
  const v = clampFx(value);
  if (s.fx[name] === v) return s;
  const n = copy(s);
  n.fx[name] = v;
  return n;
}
export function clearFx(s) {
  if (!hasFx(s)) return s;
  const n = copy(s);
  n.fx = noFx();
  return n;
}

/** Drop blocks that are not in this catalog (a sound that no longer exists must never break a song).
 *  micIds = the recordings this device actually has. */
export function cleanSong(s, catalog, micIds = new Set()) {
  const w = catalog.worlds.find((x) => x.id === s.world);
  if (!w) return null;
  const loops = new Set(w.loops.map((l) => l.id));
  const fun = new Set(catalog.fun.map((f) => f.id));
  const n = copy(s);
  n.grid = n.grid.map((r) => r.map((id) => (id && (loops.has(id) || (isMic(id) && micIds.has(id))) ? id : null)));
  n.fun = n.fun.map((id) => (id && fun.has(id) ? id : null));
  return n;
}

// ---- share payload (small JSON, stored in the shared_links table) --------------------------------------
// { v:2, w:'hero', n:8, l:[[lane,slot,'k-trumpet-tune'],...], f:[[pos,'bikebell'],...], x:[echo,reverb,muffle,crunch] }
// (loop ids lose their "<world>-" prefix). Recordings never leave the device, so they are not in the payload.

export function toPayload(s) {
  const l = [];
  s.grid.forEach((row, lane) => row.forEach((id, slot) => { if (id && !isMic(id) && slot < s.slots) l.push([lane, slot, id.slice(s.world.length + 1)]); }));
  const f = [];
  s.fun.forEach((id, pos) => { if (id && pos < s.slots * FUN_SPAN) f.push([pos, id.slice(4)]); });
  return { v: SHARE_VERSION, w: s.world, n: s.slots, l, f, x: FX_NAMES.map((k) => s.fx[k]) };
}

/** Turn untrusted data (from the network, the URL or storage) into a song, or null. Unknown or out-of-range bits are skipped. */
export function fromPayload(p, catalog) {
  if (!p || typeof p !== 'object' || p.v !== SHARE_VERSION || typeof p.w !== 'string') return null;
  const world = catalog.worlds.find((w) => w.id === p.w);
  if (!world) return null;
  const loops = new Set(world.loops.map((l) => l.id));
  const fun = new Set(catalog.fun.map((f) => f.id));
  let s = emptySong(world.id);
  const n = Number.isInteger(p.n) ? Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, p.n)) : MIN_SLOTS;
  s = { ...s, slots: n };
  const l = Array.isArray(p.l) ? p.l.slice(0, MAX_PAYLOAD_BLOCKS) : [];
  for (const e of l) {
    if (!Array.isArray(e) || e.length !== 3 || typeof e[2] !== 'string') continue;
    const id = `${world.id}-${e[2]}`;
    if (okLoop(s, e[0], e[1]) && loops.has(id)) s = placeLoop(s, e[0], e[1], id);
  }
  const f = Array.isArray(p.f) ? p.f.slice(0, MAX_PAYLOAD_BLOCKS) : [];
  for (const e of f) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[1] !== 'string') continue;
    const id = `fun-${e[1]}`;
    if (okFun(s, e[0]) && fun.has(id)) s = placeFun(s, e[0], id);
  }
  if (Array.isArray(p.x)) FX_NAMES.forEach((k, i) => { s = setFx(s, k, p.x[i]); });
  return s;
}

// ---- timing ---------------------------------------------------------------------------------------------

/** Seconds in one slot (one loop) of a world. Every loop in a world has the same length. */
export const slotSeconds = (world) => world.loops[0].frames / world.loops[0].sr;
export const songSeconds = (world, slots) => slots * slotSeconds(world);

/** Every sound the song plays, with its start time (seconds from the start of the song) and length. */
export function eventsFor(s, catalog) {
  const world = catalog.worlds.find((w) => w.id === s.world);
  if (!world) return [];
  const slotLen = slotSeconds(world);
  const loops = new Map(world.loops.map((l) => [l.id, l]));
  const fun = new Map(catalog.fun.map((f) => [f.id, f]));
  const out = [];
  s.grid.forEach((row, lane) => row.forEach((id, slot) => {
    if (!id || slot >= s.slots) return;
    const l = loops.get(id);
    if (l) out.push({ cell: `L${lane}.${slot}`, kind: 'loop', id, start: slot * slotLen, dur: l.frames / l.sr });
    else if (isMic(id)) out.push({ cell: `L${lane}.${slot}`, kind: 'loop', id, start: slot * slotLen, dur: slotLen }); // a recording is exactly one slot long
  }));
  s.fun.forEach((id, pos) => {
    const f = id && fun.get(id);
    if (f && pos < s.slots * FUN_SPAN) out.push({ cell: `F${pos}`, kind: 'fun', id, start: (pos * slotLen) / FUN_SPAN, dur: Math.min(f.max, f.frames / f.sr) });
  });
  return out.sort((a, b) => a.start - b.start);
}
