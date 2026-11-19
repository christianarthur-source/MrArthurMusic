// Sound Blocks: the screen. Pick a world, drag blocks onto stripes, add effects, record your own voice, share a short link.
import {
  LANES, MIN_SLOTS, MAX_SLOTS, FUN_SPAN, FX_NAMES, emptySong, isEmpty, hasFx, isMic, micIdsIn, lastSlotEmpty,
  placeLoop, moveLoop, removeLoop, placeFun, moveFun, removeFun, addSlot, removeSlot, setFx, clearFx,
  toPayload, fromPayload, cleanSong, slotSeconds, eventsFor,
} from './song.js';
import { Engine } from './engine.js';
import { createLink, readLinkFromLocation, hasLinkInLocation } from './share.js';

const $ = (id) => document.getElementById(id);
const catalog = await fetch('sounds.json').then((r) => r.json());
const engine = new Engine(catalog);

// ------------------------------------------------------------------ storage (songs: localStorage; recordings: IndexedDB, never uploaded)

const STORE = 'soundblocks.v2.';
const store = {
  get(k) { try { return localStorage.getItem(STORE + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(STORE + k, v); } catch { /* private window or full: the song just is not remembered */ } },
  keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith(STORE)); } catch { return []; } },
};
const rawSaved = (worldId) => { const raw = store.get('song.' + worldId); try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
const savedSong = (worldId) => { const p = rawSaved(worldId); return p ? fromPayload(p, catalog) : null; };

// Recordings do not fit in a share link and hold the child's voice, so they stay in this browser only.
const idb = {
  db: null,
  open() {
    if (this.db) return this.db;
    this.db = new Promise((resolve) => {
      try {
        const req = indexedDB.open('soundblocks', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('clips', { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
    return this.db;
  },
  async tx(mode, fn) {
    const db = await this.open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const t = db.transaction('clips', mode);
        const r = fn(t.objectStore('clips'));
        t.oncomplete = () => resolve(r && 'result' in r ? r.result : true);
        t.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  },
  put(rec) { return this.tx('readwrite', (s) => s.put(rec)); },
  all() { return this.tx('readonly', (s) => s.getAll()).then((r) => r || []); },
  del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
};

function computePeaks(pcm, buckets = 64) {
  let hex = '';
  let top = 0;
  const vals = [];
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * pcm.length) / buckets);
    const end = Math.max(start + 1, Math.floor(((b + 1) * pcm.length) / buckets));
    let m = 0;
    for (let i = start; i < end && i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > m) m = a; }
    vals.push(m);
    top = Math.max(top, m);
  }
  for (const v of vals) hex += Math.min(255, Math.round((top ? v / top : 0) * 255)).toString(16).padStart(2, '0');
  return hex;
}

async function loadClips() {
  const clips = await idb.all();
  // keep only recordings some saved song still uses (an unused one is a recording nobody can reach any more)
  const used = new Set();
  for (const k of store.keys()) {
    if (!/\.(song|backup)\./.test(k)) continue;
    try { for (const id of micIdsFromRaw(JSON.parse(localStorage.getItem(k)))) used.add(id); } catch { /* skip */ }
  }
  for (const c of clips) {
    if (!used.has(c.id) && Date.now() - (c.t || 0) > 24 * 3600 * 1000) { idb.del(c.id); continue; }
    engine.addClip(c.id, c.data, c.sr, c.peaks);
  }
}
// Songs on this device remember their recordings in a side list (the share payload leaves them out).
const micIdsFromRaw = (payload) => (payload && Array.isArray(payload.m) ? payload.m.filter((x) => typeof x === 'string') : []);
await loadClips();

// ------------------------------------------------------------------ state

let song = null;
let world = null;
let history = [];
let held = null; // { kind, id } picked up from the tray, waiting to be put on a stripe
let remix = false; // opened from a shared link and not changed yet
let saveTimer = 0;
let recording = false;

const loopInfo = (id) => world.loops.find((l) => l.id === id);
const funInfo = (id) => catalog.fun.find((f) => f.id === id);
const MIC_COLOR = '#f43f5e';
function info(kind, id) {
  if (isMic(id)) { const m = engine.mics.get(id); return { pic: '🎤', label: 'My voice', color: MIC_COLOR, peaks: m && m.peaks, frames: m && m.frames, sr: m && m.sr }; }
  if (kind === 'rec') return { pic: '🎤', label: 'Record', color: MIC_COLOR };
  return kind === 'loop' ? loopInfo(id) : funInfo(id);
}
const wiggle = (el) => { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), 600); };
const toast = (txt) => { const t = $('toast'); t.textContent = txt; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); };
const micIds = () => new Set(engine.mics.keys());

// ------------------------------------------------------------------ home

function renderHome() {
  const box = $('worlds');
  box.textContent = '';
  for (const w of catalog.worlds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'world-card';
    b.style.setProperty('--c1', w.bg[0]);
    b.style.setProperty('--c2', w.bg[1]);
    b.setAttribute('aria-label', `${w.name}, ${w.bpm} beats per minute, key of ${w.key}`);
    b.innerHTML = `<span class="pic" aria-hidden="true">${w.pic}</span><span class="name" aria-hidden="true">${w.name}</span><span class="meta" aria-hidden="true">${w.bpm} BPM · ${w.key}</span>`;
    const s = savedSong(w.id);
    if (s && !isEmpty(s)) {
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.setAttribute('aria-hidden', 'true');
      const colors = new Map(w.loops.map((l) => [l.id, l.color]));
      for (let lane = 0; lane < LANES; lane++) for (let slot = 0; slot < MIN_SLOTS; slot++) {
        const i = document.createElement('i');
        const id = s.grid[lane][slot];
        if (id) i.style.background = isMic(id) ? MIC_COLOR : colors.get(id);
        mini.append(i);
      }
      b.append(mini);
    }
    b.addEventListener('click', () => { engine.unlock(); openWorld(w.id, restoreSong(w.id), false); });
    box.append(b);
  }
}

/** The saved song of a world, with this device's recordings put back (the stored copy lists them in `m`). */
function restoreSong(worldId) {
  const base = savedSong(worldId) || emptySong(worldId);
  const raw = rawSaved(worldId);
  if (raw && Array.isArray(raw.mg)) { // recordings: [[lane, slot, id], ...]
    let s = base;
    for (const e of raw.mg) if (Array.isArray(e) && isMic(e[2]) && engine.hasClip(e[2])) s = placeLoop(s, e[0], e[1], e[2]);
    return s;
  }
  return base;
}

// ------------------------------------------------------------------ studio

function openWorld(id, startSong, fromLink) {
  stopPlaying();
  world = catalog.worlds.find((w) => w.id === id);
  song = cleanSong(startSong, catalog, micIds());
  history = [];
  held = null;
  remix = fromLink;
  $('home').hidden = true;
  $('studio').hidden = false;
  $('studio').removeAttribute('data-held');
  const app = $('app');
  app.style.setProperty('--bg1', world.bg[0]);
  app.style.setProperty('--bg2', world.bg[1]);
  app.style.setProperty('--beat', `${60 / world.bpm}s`);
  $('worldPic').textContent = world.pic;
  $('worldName').textContent = world.name;
  $('worldInfo').textContent = `${world.bpm} BPM · Key of ${world.key.replace('m', ' minor')}`;
  $('remix').hidden = !remix;
  closeFx();
  buildBoard();
  buildTray();
  renderSong();
  syncFxUi();
  updateUndo();
  engine.song = song;
  if (engine.ctx) engine.setFx(song.fx, world.bpm);
  engine.loadWorld(world).then(refreshTray);
  engine.loadFunInBackground().then(refreshTray);
  window.scrollTo(0, 0);
  $('playBtn').focus({ preventScroll: true });
}

function goHome() {
  stopPlaying();
  engine.stopPreview();
  held = null;
  $('studio').hidden = true;
  $('home').hidden = false;
  const app = $('app');
  app.style.setProperty('--bg1', '#fde68a');
  app.style.setProperty('--bg2', '#fb923c');
  if (hasLinkInLocation()) { try { window.history.replaceState(null, '', location.pathname); } catch { /* ignore */ } }
  renderHome();
}

function buildBoard() {
  const slots = song.slots;
  $('board').dataset.slots = String(slots);
  $('track').style.setProperty('--slots', slots);
  const ruler = $('ruler');
  ruler.textContent = '';
  for (let i = 0; i < slots; i++) { const b = document.createElement('i'); b.textContent = String(i + 1); ruler.append(b); }
  const lanes = $('lanes');
  lanes.textContent = '';
  for (let lane = 0; lane < LANES; lane++) {
    const row = document.createElement('div');
    row.className = 'lane';
    for (let slot = 0; slot < slots; slot++) row.append(makeCell({ k: 'loop', lane, slot }));
    lanes.append(row);
  }
  const fun = document.createElement('div');
  fun.className = 'lane fun';
  for (let slot = 0; slot < slots; slot++) {
    const g = document.createElement('div');
    g.className = 'fgroup';
    for (let h = 0; h < FUN_SPAN; h++) g.append(makeCell({ k: 'fun', pos: slot * FUN_SPAN + h }));
    fun.append(g);
  }
  lanes.append(fun);
  updateAddButtons();
}

function updateAddButtons() {
  $('addBtn').disabled = song.slots >= MAX_SLOTS;
  $('addBtn').setAttribute('aria-label', song.slots >= MAX_SLOTS ? 'The song is as long as it can be' : `Add a measure. ${song.slots} of ${MAX_SLOTS}`);
  $('subBtn').disabled = song.slots <= MIN_SLOTS || !lastSlotEmpty(song);
  $('addcol').title = `${song.slots} of ${MAX_SLOTS} measures`;
}

function makeCell(d) {
  const c = document.createElement('div');
  c.className = 'cell';
  c.tabIndex = 0;
  c.setAttribute('role', 'button');
  c.dataset.k = d.k;
  if (d.k === 'loop') { c.dataset.lane = d.lane; c.dataset.slot = d.slot; }
  else c.dataset.pos = d.pos;
  return c;
}

const WAVE_BARS = 32;
function waveEl(peaks) {
  const w = document.createElement('span');
  w.className = 'wave';
  w.setAttribute('aria-hidden', 'true');
  const vals = [];
  if (peaks) for (let i = 0; i < 64; i += 2) vals.push(Math.max(parseInt(peaks.substr(i * 2, 2), 16) || 0, parseInt(peaks.substr(i * 2 + 2, 2), 16) || 0));
  const top = Math.max(1, ...vals);
  for (let i = 0; i < WAVE_BARS; i++) {
    const b = document.createElement('i');
    const v = vals.length ? vals[i] / top : 0.25;
    b.style.setProperty('--h', `${Math.round(14 + 86 * Math.pow(v, 0.8))}%`);
    w.append(b);
  }
  return w;
}

function blockEl(kind, id, extra = {}) {
  const i = info(kind, id);
  const b = document.createElement('div');
  b.className = 'block' + (kind === 'fun' ? ' f' : '') + (kind === 'rec' ? ' micb' : '');
  b.style.setProperty('--c', i.color || '#fbbf24');
  b.dataset.k = kind;
  b.dataset.id = id;
  b.dataset.drag = '1';
  Object.assign(b.dataset, extra);
  const e = document.createElement('span');
  e.className = 'e';
  e.setAttribute('aria-hidden', 'true');
  e.textContent = i.pic;
  b.append(e);
  if (kind !== 'fun' && kind !== 'rec') b.append(waveEl(i.peaks));
  const lb = document.createElement('span');
  lb.className = 'lb';
  lb.setAttribute('aria-hidden', 'true');
  lb.textContent = i.label;
  b.append(lb);
  return b;
}

function cellLabel(cell, id) {
  const k = cell.dataset.k;
  const where = k === 'loop' ? `stripe ${+cell.dataset.lane + 1}, measure ${+cell.dataset.slot + 1}` : `fun sound place ${+cell.dataset.pos + 1}`;
  if (!id) return `${where}, empty`;
  return `${info(k, id).label}, ${where}. Press Delete to remove.`;
}

function renderSong() {
  if ($('board').dataset.slots !== String(song.slots)) buildBoard();
  for (const cell of $('lanes').querySelectorAll('.cell')) {
    const k = cell.dataset.k;
    const id = k === 'loop' ? song.grid[+cell.dataset.lane][+cell.dataset.slot] : song.fun[+cell.dataset.pos];
    const have = cell.firstElementChild;
    if (have && have.dataset.id === id) continue;
    cell.textContent = '';
    cell.classList.toggle('full', !!id);
    if (id) {
      const b = blockEl(k, id, { src: 'cell' });
      b.classList.add('pop');
      b.addEventListener('animationend', () => b.classList.remove('pop'), { once: true });
      b.setAttribute('aria-hidden', 'true');
      cell.append(b);
    }
    cell.setAttribute('aria-label', cellLabel(cell, id));
  }
  updateAddButtons();
}

function buildTray() {
  const loops = $('trayLoops');
  const funs = $('trayFun');
  loops.textContent = '';
  funs.textContent = '';
  const rec = blockEl('rec', 'rec', { src: 'tray' });
  rec.tabIndex = 0;
  rec.setAttribute('role', 'button');
  rec.setAttribute('aria-label', 'Microphone. Record your own voice, as long as one block.');
  rec.setAttribute('aria-pressed', 'false');
  loops.append(rec);
  for (const l of world.loops) loops.append(trayBlock('loop', l));
  for (const f of catalog.fun) funs.append(trayBlock('fun', f));
  loops.scrollLeft = 0;
  funs.scrollLeft = 0;
  refreshTray();
}
function trayBlock(kind, i) {
  const b = blockEl(kind, i.id, { src: 'tray' });
  b.tabIndex = 0;
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', i.label);
  b.setAttribute('aria-pressed', 'false');
  return b;
}
function refreshTray() {
  for (const b of $('tray').querySelectorAll('.block')) {
    const id = b.dataset.id;
    if (b.dataset.k !== 'rec') {
      b.classList.toggle('loading', !engine.isReady(id) && !engine.failed.has(id));
      b.classList.toggle('failed', engine.failed.has(id));
    }
    const isHeld = !!held && held.id === id;
    b.classList.toggle('held', isHeld);
    b.setAttribute('aria-pressed', String(isHeld));
  }
  if (held) $('studio').dataset.held = held.kind; else $('studio').removeAttribute('data-held');
}
engine.onReady = () => { if (!$('studio').hidden) refreshTray(); if (engine.playing) engine.sync(); };

// the tray scrolls sideways; the mouse wheel should too
for (const id of ['trayLoops', 'trayFun']) {
  $(id).addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) { e.currentTarget.scrollLeft += e.deltaY; e.preventDefault(); }
  }, { passive: false });
}

// ------------------------------------------------------------------ changing the song

function afterChange() {
  renderSong();
  updateUndo();
  if (engine.playing) engine.setSong(song); else engine.song = song;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
function commit(next) {
  if (next === song) return;
  if (remix) { // the first change to a shared song: keep the child's own saved song for this world safe, once
    const mine = store.get('song.' + world.id);
    if (mine) store.set('backup.' + world.id, mine);
    remix = false;
    $('remix').hidden = true;
  }
  history.push(song);
  if (history.length > 60) history.shift();
  song = next;
  afterChange();
  syncFxUi();
}
function save() {
  if (!song || remix) return;
  const p = toPayload(song);
  p.mg = []; // this device's recordings: [lane, slot, id]
  song.grid.forEach((row, lane) => row.forEach((id, slot) => { if (isMic(id) && slot < song.slots) p.mg.push([lane, slot, id]); }));
  p.m = [...new Set(p.mg.map((e) => e[2]))];
  store.set('song.' + song.world, JSON.stringify(p));
}
function updateUndo() { $('undoBtn').disabled = history.length === 0; }
function undo() {
  if (!history.length || recording) return;
  song = history.pop();
  afterChange();
  syncFxUi();
  if (engine.ctx) engine.setFx(song.fx, world.bpm);
}

function putHeld(cell) {
  if (!held) return false;
  const k = cell.dataset.k;
  if (held.kind === 'rec') {
    if (k !== 'loop') return false;
    const lane = +cell.dataset.lane, slot = +cell.dataset.slot;
    held = null;
    refreshTray();
    startRecording(lane, slot);
    return true;
  }
  if (held.kind !== k) return false;
  const next = k === 'loop' ? placeLoop(song, +cell.dataset.lane, +cell.dataset.slot, held.id) : placeFun(song, +cell.dataset.pos, held.id);
  commit(next);
  if (!engine.playing) engine.preview(held.id);
  return true;
}

// ------------------------------------------------------------------ pointer: tap and drag (a block is carried by the pointer)

let drag = null;
const MOVE = 6;
const cellKindOf = (kind) => (kind === 'rec' ? 'loop' : kind);

function targetAt(x, y, kind) {
  const want = cellKindOf(kind);
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList && el.classList.contains('cell') && el.dataset.k === want) return { type: 'cell', el };
    if (el.id === 'trash' || el.id === 'tray') return { type: 'trash', el };
  }
  return null;
}

document.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (e.button > 0 || recording) return;
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el || $('studio').hidden) return;
  drag = { el, k: el.dataset.k, id: el.dataset.id, src: el.dataset.src, x0: e.clientX, y0: e.clientY, started: false, ghost: null, hot: null, pid: e.pointerId, x: e.clientX, y: e.clientY };
  if (drag.src === 'cell') {
    const c = el.parentElement;
    drag.from = drag.k === 'loop' ? { lane: +c.dataset.lane, slot: +c.dataset.slot } : +c.dataset.pos;
  }
});

function startCarrying(e) {
  drag.started = true;
  const r = drag.el.getBoundingClientRect();
  const g = drag.el.cloneNode(true);
  g.classList.remove('on', 'held', 'pop', 'lifted', 'loading', 'carried');
  g.classList.add('ghost');
  g.removeAttribute('data-drag');
  g.removeAttribute('tabindex');
  g.removeAttribute('role');
  g.removeAttribute('aria-pressed');
  g.setAttribute('aria-hidden', 'true');
  const w = Math.max(r.width, 74);
  const h = Math.max(r.height, 60);
  Object.assign(g.style, { width: `${w}px`, height: `${h}px`, margin: '0', inset: 'auto', position: 'fixed', left: '0', top: '0' }); // keeps the block's own colour (--c)
  document.body.append(g);
  drag.ghost = g;
  drag.w = w;
  drag.h = h;
  document.body.classList.add('dragging');
  if (drag.src === 'cell') drag.el.classList.add('lifted'); else drag.el.classList.add('carried');
  if (drag.src === 'tray') { held = null; refreshTray(); }
  moveGhost(e.clientX, e.clientY);
  engine.unlock();
  autoScrollLoop();
}
function moveGhost(x, y) {
  // the block hangs from the pointer a little below its centre, like something being carried
  drag.ghost.style.transform = `translate(${x - drag.w / 2}px, ${y - drag.h * 0.42}px) scale(1.1) rotate(-4deg)`;
}

window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < MOVE) return;
    startCarrying(e);
  }
  moveGhost(e.clientX, e.clientY);
  setHot(targetAt(e.clientX, e.clientY, drag.k));
  e.preventDefault();
}, { passive: false });

/** Near the left or right edge of the song the stripes scroll along, so a block can be carried to a measure that is off screen. */
let autoRaf = 0;
function autoScrollLoop() {
  cancelAnimationFrame(autoRaf);
  const step = () => {
    if (!drag || !drag.started) return;
    const sc = $('scroller');
    const r = sc.getBoundingClientRect();
    const edge = 56;
    if (drag.y > r.top - 40 && drag.y < r.bottom + 40) {
      if (drag.x > r.right - edge) sc.scrollLeft += 14;
      else if (drag.x < r.left + edge) sc.scrollLeft -= 14;
      setHot(targetAt(drag.x, drag.y, drag.k));
    }
    autoRaf = requestAnimationFrame(step);
  };
  autoRaf = requestAnimationFrame(step);
}

function setHot(t) {
  const next = t ? t.el : null;
  if (drag.hot === next) return;
  if (drag.hot) drag.hot.classList.remove('hot', 'hot-del');
  drag.hot = next;
  if (next) next.classList.add(next.id === 'tray' ? 'hot-del' : 'hot');
  if (next && next.id === 'tray' && drag.src === 'tray') next.classList.remove('hot-del');
}

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.pid) return;
  const d = drag;
  drag = null;
  cancelAnimationFrame(autoRaf);
  document.body.classList.remove('dragging');
  if (d.hot) d.hot.classList.remove('hot', 'hot-del');
  d.el.classList.remove('lifted', 'carried');
  if (cancelled) { if (d.ghost) d.ghost.remove(); return; }
  if (!d.started) { tap(d); return; }
  const t = targetAt(e.clientX, e.clientY, d.k);
  if (!t) { flyBack(d); return; }
  if (d.ghost) d.ghost.remove();
  if (t.type === 'trash') {
    if (d.src === 'cell') commit(d.k === 'loop' ? removeLoop(song, d.from.lane, d.from.slot) : removeFun(song, d.from));
    return;
  }
  const c = t.el;
  if (d.k === 'rec') { startRecording(+c.dataset.lane, +c.dataset.slot); return; }
  let next = song;
  if (d.src === 'tray') next = d.k === 'loop' ? placeLoop(song, +c.dataset.lane, +c.dataset.slot, d.id) : placeFun(song, +c.dataset.pos, d.id);
  else next = d.k === 'loop' ? moveLoop(song, d.from, { lane: +c.dataset.lane, slot: +c.dataset.slot }) : moveFun(song, d.from, +c.dataset.pos);
  commit(next);
  if (d.src === 'tray' && !engine.playing) engine.preview(d.id);
}
/** A drop on nothing: the block slides back to where it came from. */
function flyBack(d) {
  const g = d.ghost;
  if (!g) return;
  const r = d.el.getBoundingClientRect();
  g.style.transition = 'transform .22s ease-out, opacity .22s';
  g.style.transform = `translate(${r.left + r.width / 2 - d.w / 2}px, ${r.top + r.height / 2 - d.h / 2}px) scale(1) rotate(0)`;
  g.style.opacity = '.3';
  setTimeout(() => g.remove(), 240);
}
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

// a tap: hear a block, or pick one up from the tray to stamp onto stripes
function tap(d) {
  const id = d.id;
  if (d.src === 'tray') {
    if (held && held.id === id) { held = null; engine.stopPreview(); }
    else { held = { kind: d.k, id }; if (d.k !== 'rec') engine.preview(id); else engine.stopPreview(); }
    refreshTray();
    startWaveLoop();
  } else {
    if (engine.previewing === id) engine.stopPreview(); else engine.preview(id);
    startWaveLoop();
  }
}

// taps on empty cells put the held block down; keyboard too
$('lanes').addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || drag) return;
  if (cell.firstElementChild) return; // taps on a block are handled as block taps
  if (!putHeld(cell)) wiggle($('tray'));
});
$('lanes').addEventListener('keydown', (e) => {
  const cell = e.target.closest && e.target.closest('.cell');
  if (!cell) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    const b = cell.firstElementChild;
    if (held && putHeld(cell)) return;
    if (b) { engine.previewing === b.dataset.id ? engine.stopPreview() : engine.preview(b.dataset.id); startWaveLoop(); } else wiggle($('tray'));
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (cell.dataset.k === 'loop') commit(removeLoop(song, +cell.dataset.lane, +cell.dataset.slot)); else commit(removeFun(song, +cell.dataset.pos));
  } else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    focusNeighbour(cell, e.key);
  }
});
$('tray').addEventListener('keydown', (e) => {
  const b = e.target.closest && e.target.closest('.block');
  if (!b) return;
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.stopPropagation();
    tap({ src: 'tray', k: b.dataset.k, id: b.dataset.id });
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const n = e.key === 'ArrowRight' ? b.nextElementSibling : b.previousElementSibling;
    if (n) { n.focus(); n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
});
function focusNeighbour(cell, key) {
  const all = [...$('lanes').querySelectorAll('.cell')];
  const rect = cell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  let best = null, bestD = 1e9;
  for (const c of all) {
    if (c === cell) continue;
    const r = c.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    if (key === 'ArrowRight' && dx <= 4) continue;
    if (key === 'ArrowLeft' && dx >= -4) continue;
    if (key === 'ArrowDown' && dy <= 4) continue;
    if (key === 'ArrowUp' && dy >= -4) continue;
    const dist = (key.endsWith('ight') || key.endsWith('eft')) ? Math.abs(dx) + Math.abs(dy) * 4 : Math.abs(dy) + Math.abs(dx) * 4;
    if (dist < bestD) { bestD = dist; best = c; }
  }
  if (best) { best.focus(); best.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
}

// ------------------------------------------------------------------ measures (the + button)

$('addBtn').addEventListener('click', () => {
  if (recording) return;
  commit(addSlot(song));
  const sc = $('scroller');
  requestAnimationFrame(() => { sc.scrollTo({ left: sc.scrollWidth, behavior: 'smooth' }); });
  if (song.slots >= MAX_SLOTS) toast('That is the longest song!');
});
$('subBtn').addEventListener('click', () => { if (!recording) commit(removeSlot(song)); });

// ------------------------------------------------------------------ playing, waveforms, playhead

let raf = 0;
function startPlaying() {
  if (recording) return;
  engine.play(song);
  engine.setFx(song.fx, world.bpm);
  $('playBtn').setAttribute('aria-pressed', 'true');
  $('playBtn').setAttribute('aria-label', 'Stop');
  $('playIco').textContent = '⏹';
  $('playTx').textContent = 'Stop';
  $('studio').classList.add('playing');
  startWaveLoop();
}
function stopPlaying() {
  engine.stop();
  $('playBtn').setAttribute('aria-pressed', 'false');
  $('playBtn').setAttribute('aria-label', 'Play');
  $('playIco').textContent = '▶';
  $('playTx').textContent = 'Play';
  $('studio').classList.remove('playing');
  clearActive();
}
function clearActive() {
  for (const b of document.querySelectorAll('.block.on')) b.classList.remove('on');
  for (const i of document.querySelectorAll('#ruler i.on')) i.classList.remove('on');
  for (const b of document.querySelectorAll('.block')) if (b._wn) setWave(b, 0);
}
function setWave(b, frac) {
  const bars = b.querySelector('.wave');
  if (!bars) return;
  const n = Math.round(frac * WAVE_BARS);
  const old = b._wn || 0;
  if (n === old) return;
  const kids = bars.children;
  if (n > old) for (let i = old; i < n; i++) kids[i].classList.add('on'); else for (let i = n; i < old; i++) kids[i].classList.remove('on');
  b._wn = n;
}
function startWaveLoop() {
  if (raf) return;
  raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  const p = engine.position();
  const pv = engine.previewing;
  // preview progress shows on that sound's blocks
  if (pv) {
    const frac = engine.previewProgress() ?? 0;
    for (const b of document.querySelectorAll(`.block[data-id="${pv}"]`)) setWave(b, frac);
  }
  if (!pv && !p) { for (const b of document.querySelectorAll('.block')) if (b._wn) setWave(b, 0); return; }
  if (p && p.started) {
    const slotLen = slotSeconds(world);
    const slots = song.slots;
    const slot = Math.min(slots - 1, Math.floor(p.t / slotLen));
    const track = $('track');
    const px = (p.t / slotLen) * (track.clientWidth / slots);
    $('playhead').style.transform = `translateX(${px}px)`;
    const sc = $('scroller');
    if (px > sc.scrollLeft + sc.clientWidth - 90 || px < sc.scrollLeft) sc.scrollLeft = Math.max(0, px - 90);
    const beads = $('ruler').children;
    for (let i = 0; i < beads.length; i++) beads[i].classList.toggle('on', i === slot);
    for (const cell of $('lanes').querySelectorAll('.cell.full')) {
      const b = cell.firstElementChild;
      let on;
      let frac = 0;
      if (cell.dataset.k === 'loop') {
        on = +cell.dataset.slot === slot;
        frac = on ? (p.t - slot * slotLen) / slotLen : 0;
      } else {
        const start = (+cell.dataset.pos * slotLen) / FUN_SPAN;
        on = p.t >= start && p.t < start + Math.min(funInfo(b.dataset.id).max, 1.2);
      }
      if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
      if (cell.dataset.k === 'loop') setWave(b, on ? frac : 0);
    }
  }
  raf = requestAnimationFrame(frame);
}
engine.onPreviewEnd = () => { startWaveLoop(); };

$('playBtn').addEventListener('click', () => { if (engine.playing) stopPlaying(); else startPlaying(); });
$('undoBtn').addEventListener('click', undo);
$('homeBtn').addEventListener('click', () => { if (!recording) goHome(); });

// ------------------------------------------------------------------ effects

function syncFxUi() {
  for (const input of document.querySelectorAll('[data-fx]')) input.value = String(song.fx[input.dataset.fx]);
  $('fxDot').hidden = !hasFx(song);
}
function closeFx() { $('fxPanel').hidden = true; $('fxBtn').setAttribute('aria-expanded', 'false'); }
$('fxBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const open = $('fxPanel').hidden;
  $('fxPanel').hidden = !open;
  $('fxBtn').setAttribute('aria-expanded', String(open));
  if (open) engine.unlock();
});
document.addEventListener('pointerdown', (e) => { if (!$('fxPanel').hidden && !e.target.closest('.fxwrap')) closeFx(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFx(); });
// dragging a slider changes the sound right away; it is one change for undo only when it is let go
for (const input of document.querySelectorAll('[data-fx]')) {
  input.addEventListener('input', () => {
    song = setFx(song, input.dataset.fx, input.value);
    engine.unlock();
    engine.song = song;
    engine.setFx(song.fx, world.bpm);
    $('fxDot').hidden = !hasFx(song);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  });
}
$('fxReset').addEventListener('click', () => {
  song = clearFx(song);
  engine.song = song;
  if (engine.ctx) engine.setFx(song.fx, world.bpm);
  syncFxUi();
  save();
});

// ------------------------------------------------------------------ clear

$('clearBtn').addEventListener('click', () => { if (recording) return; if (isEmpty(song) && !hasFx(song)) { wiggle($('tray')); return; } $('clearDlg').showModal(); });
$('clearNo').addEventListener('click', () => $('clearDlg').close());
$('clearYes').addEventListener('click', () => { $('clearDlg').close(); stopPlaying(); const s = emptySong(world.id); commit(s); syncFxUi(); if (engine.ctx) engine.setFx(song.fx, world.bpm); });

// ------------------------------------------------------------------ recording your own voice

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rec = { cancelled: false, session: null };

function showRec(big, sub, opts = {}) {
  $('recBig').textContent = big;
  $('recBig').classList.toggle('go', !!opts.go);
  $('recSub').textContent = sub;
  $('recBar').hidden = !opts.bar;
  $('recMeterBox').hidden = !opts.meter;
  $('recHearBox').hidden = !!opts.hideHear;
  $('recNote').hidden = !!opts.hideNote;
}
function hideRec() { $('rec').hidden = true; recording = false; }

async function startRecording(lane, slot) {
  if (recording) return;
  recording = true;
  rec.cancelled = false;
  stopPlaying();
  engine.stopPreview();
  $('rec').hidden = false;
  $('recCancel').setAttribute('aria-label', 'Cancel recording');
  showRec('🎤', 'Allow the microphone if your browser asks.', {});
  $('recProg').style.width = '0';
  let session;
  try {
    session = await engine.openMic();
  } catch (err) {
    const msg = err.code === 'blocked' ? 'The microphone is blocked. Allow it in your browser, then try again.' : err.code === 'none' ? 'No microphone was found on this computer.' : 'Recording does not work on this device.';
    showRec('🎤🚫', msg, { hideHear: true, hideNote: true });
    $('recCancel').setAttribute('aria-label', 'Close');
    $('recCancel').onclick = () => { $('recCancel').onclick = null; hideRec(); };
    return;
  }
  rec.session = session;
  $('recCancel').onclick = cancelRecording;
  const hear = () => $('recHear').checked;
  const slotLen = slotSeconds(world);
  let pcm = null;
  try {
    showRec('3', 'Get ready…', {});
    for (const n of [3, 2, 1]) {
      if (rec.cancelled) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
      $('recBig').textContent = String(n);
      engine.beep(n === 1 ? 880 : 660);
      await sleep(1000);
    }
    if (rec.cancelled) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
    const hearing = hear();
    let comp = 0;
    if (hearing) { // the song plays from the start of this measure, without the clip that is about to be replaced
      engine.song = placeLoop(song, lane, slot, null);
      engine.play(engine.song, slot);
      engine.setFx(song.fx, world.bpm);
      comp = 0.1 + (engine.ctx.baseLatency || 0) + (engine.ctx.outputLatency || 0); // the song starts 0.1 s after the mic, and sound takes time to reach the ears
    }
    showRec('🔴', `Recording… ${slotLen.toFixed(0)} seconds`, { go: true, bar: true, meter: true, hideHear: true, hideNote: true });
    session.onLevel = (v) => { $('recMeter').style.width = `${Math.min(100, Math.round(Math.sqrt(v) * 130))}%`; };
    const t0 = performance.now();
    const prog = setInterval(() => { $('recProg').style.width = `${Math.min(100, ((performance.now() - t0) / 1000 / slotLen) * 100)}%`; }, 60);
    try { pcm = await session.capture(slotLen, comp); } finally { clearInterval(prog); }
  } catch (err) {
    if (engine.playing) { engine.stop(); engine.song = song; }
    session.close();
    rec.session = null;
    hideRec();
    if (err.code !== 'cancelled') toast('Something went wrong. Try again.');
    return;
  }
  if (engine.playing) { engine.stop(); engine.song = song; }
  session.close();
  rec.session = null;
  let loud = 0;
  for (let i = 0; i < pcm.length; i += 64) loud = Math.max(loud, Math.abs(pcm[i]));
  const id = 'mic-' + Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
  const peaks = computePeaks(pcm);
  engine.addClip(id, pcm, session.sr, peaks);
  idb.put({ id, sr: session.sr, data: pcm, peaks, t: Date.now() });
  hideRec();
  commit(placeLoop(song, lane, slot, id));
  engine.preview(id);
  startWaveLoop();
  toast(loud < 0.02 ? 'That was very quiet. Try again closer to the mic.' : 'Nice! Your voice is in the song.');
}
function cancelRecording() {
  rec.cancelled = true;
  if (rec.session) rec.session.cancel();
  else hideRec();
}

// ------------------------------------------------------------------ share

let lastShare = { key: '', result: null };
let sharing = false;
function showShare(result) {
  $('shareSpin').hidden = true;
  $('shareReady').hidden = false;
  $('shareUrl').value = result.url;
  $('shareNote').hidden = micIdsIn(song).length === 0;
  const qr = $('qr');
  qr.textContent = '';
  if (result.url.length <= 260 && window.qrcode) {
    try {
      const q = window.qrcode(0, 'M');
      q.addData(result.url);
      q.make();
      qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      qr.hidden = false;
    } catch { qr.hidden = true; }
  } else qr.hidden = true;
  $('copyIco').textContent = '📋';
}
$('shareBtn').addEventListener('click', async () => {
  if (recording) return;
  const shareable = song.grid.flat().some((id) => id && !isMic(id)) || song.fun.some(Boolean);
  if (!shareable) { wiggle($('tray')); $('shareBtn').animate([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'none' }], 300); if (!isEmpty(song)) toast('Add some music blocks to share. Recordings stay on this computer.'); return; }
  if (sharing) return;
  stopPlaying();
  const key = JSON.stringify(toPayload(song));
  const dlg = $('shareDlg');
  dlg.showModal();
  if (lastShare.key === key && lastShare.result) { showShare(lastShare.result); return; } // same song: same link, no new row
  $('shareSpin').hidden = false;
  $('shareReady').hidden = true;
  sharing = true;
  const result = await createLink(song);
  sharing = false;
  lastShare = { key, result };
  if (dlg.open) showShare(result);
});
$('shareClose').addEventListener('click', () => $('shareDlg').close());
$('shareDlg').addEventListener('click', (e) => { if (e.target === $('shareDlg')) $('shareDlg').close(); });
$('copyBtn').addEventListener('click', async () => {
  const url = $('shareUrl').value;
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch {
    $('shareUrl').select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
  }
  $('copyIco').textContent = ok ? '✅' : '👆';
  if (!ok) $('shareUrl').select();
  setTimeout(() => { $('copyIco').textContent = '📋'; }, 1800);
});
$('shareUrl').addEventListener('focus', () => $('shareUrl').select());

// ------------------------------------------------------------------ keys

document.addEventListener('keydown', (e) => {
  if ($('studio').hidden || e.target.closest('dialog[open]') || recording) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('playBtn').click(); }
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (!recording) stopPlaying(); } });

// ------------------------------------------------------------------ start

if (hasLinkInLocation()) {
  const s = await readLinkFromLocation(catalog);
  if (s) openWorld(s.world, s, true);
  else { renderHome(); toast('That song could not be opened.'); try { window.history.replaceState(null, '', location.pathname); } catch { /* ignore */ } }
} else {
  renderHome();
}

// handy for tests: ?debug exposes the internals
if (new URLSearchParams(location.search).has('debug')) window.__sb = { engine, catalog, get song() { return song; }, commit, openWorld, startPlaying, stopPlaying, eventsFor, slotSeconds, startRecording, store };
