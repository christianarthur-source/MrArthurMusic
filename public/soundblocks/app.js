// Sound Blocks: the screen. Pictures and colour, drag blocks onto stripes, press play, share a short link.
import { SLOTS, LANES, FUN_SPAN, FUN_CELLS, emptySong, isEmpty, placeLoop, moveLoop, removeLoop, placeFun, moveFun, removeFun, toPayload, fromPayload, cleanSong, slotSeconds, eventsFor } from './song.js';
import { Engine } from './engine.js';
import { createLink, readLinkFromLocation, hasLinkInLocation } from './share.js';

const $ = (id) => document.getElementById(id);
const catalog = await fetch('sounds.json').then((r) => r.json());
const engine = new Engine(catalog);

const STORE = 'soundblocks.v1.';
const store = {
  get(k) { try { return localStorage.getItem(STORE + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(STORE + k, v); } catch { /* private window or full: the song just is not remembered */ } },
};
const savedSong = (worldId) => {
  const raw = store.get('song.' + worldId);
  if (!raw) return null;
  try { return fromPayload(JSON.parse(raw), catalog); } catch { return null; }
};

let song = null;
let world = null;
let history = [];
let held = null; // { kind, id } picked up from the tray, waiting to be put on a stripe
let remix = false; // opened from a shared link and not changed yet
let saveTimer = 0;

const loopInfo = (id) => world.loops.find((l) => l.id === id);
const funInfo = (id) => catalog.fun.find((f) => f.id === id);
const info = (kind, id) => (kind === 'loop' ? loopInfo(id) : funInfo(id));
const wiggle = (el) => { el.classList.remove('hint'); void el.offsetWidth; el.classList.add('hint'); setTimeout(() => el.classList.remove('hint'), 600); };
const toast = (txt) => { const t = $('toast'); t.textContent = txt; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 1800); };

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
    b.setAttribute('aria-label', w.id === 'playground' ? 'Playground' : w.name);
    b.innerHTML = `<span class="pic" aria-hidden="true">${w.pic}</span><span class="name" aria-hidden="true">${w.name}</span>`;
    const s = savedSong(w.id);
    if (s && !isEmpty(s)) {
      const mini = document.createElement('span');
      mini.className = 'mini';
      mini.setAttribute('aria-hidden', 'true');
      const colors = new Map(w.loops.map((l) => [l.id, l.color]));
      for (let lane = 0; lane < LANES; lane++) for (let slot = 0; slot < SLOTS; slot++) {
        const i = document.createElement('i');
        const id = s.grid[lane][slot];
        if (id) i.style.background = colors.get(id);
        mini.append(i);
      }
      b.append(mini);
    }
    b.addEventListener('click', () => { engine.unlock(); openWorld(w.id, savedSong(w.id) || emptySong(w.id), false); });
    box.append(b);
  }
}

// ------------------------------------------------------------------ studio

function openWorld(id, startSong, fromLink) {
  stopPlaying();
  world = catalog.worlds.find((w) => w.id === id);
  song = cleanSong(startSong, catalog);
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
  $('worldChip').textContent = world.pic;
  $('remix').hidden = !remix;
  buildBoard();
  buildTray();
  renderSong();
  updateUndo();
  engine.song = song;
  engine.loadWorld(world).then(refreshTray);
  engine.loadFunInBackground().then(refreshTray);
  history.length = 0;
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
  if (hasLinkInLocation()) history_replace();
  renderHome();
}
function history_replace() { try { window.history.replaceState(null, '', location.pathname); } catch { /* ignore */ } }

function buildBoard() {
  const ruler = $('ruler');
  ruler.textContent = '';
  for (let i = 0; i < SLOTS; i++) ruler.append(document.createElement('i'));
  const lanes = $('lanes');
  lanes.querySelectorAll('.lane').forEach((n) => n.remove());
  for (let lane = 0; lane < LANES; lane++) {
    const row = document.createElement('div');
    row.className = 'lane';
    for (let slot = 0; slot < SLOTS; slot++) row.append(makeCell({ k: 'loop', lane, slot }));
    lanes.append(row);
  }
  const fun = document.createElement('div');
  fun.className = 'lane fun';
  for (let slot = 0; slot < SLOTS; slot++) {
    const g = document.createElement('div');
    g.className = 'fgroup';
    for (let h = 0; h < FUN_SPAN; h++) g.append(makeCell({ k: 'fun', pos: slot * FUN_SPAN + h }));
    fun.append(g);
  }
  lanes.append(fun);
  const ph = $('playhead');
  lanes.append(ph);
}

function makeCell(d) {
  const c = document.createElement('div');
  c.className = 'cell';
  c.tabIndex = 0;
  c.setAttribute('role', 'button');
  c.dataset.k = d.k;
  if (d.k === 'loop') { c.dataset.lane = d.lane; c.dataset.slot = d.slot; c.setAttribute('aria-label', `Stripe ${d.lane + 1}, place ${d.slot + 1}`); }
  else { c.dataset.pos = d.pos; c.setAttribute('aria-label', `Fun sound place ${d.pos + 1}`); }
  return c;
}

function blockEl(kind, id, extra = {}) {
  const i = info(kind, id);
  const b = document.createElement('div');
  b.className = 'block' + (kind === 'fun' ? ' f' : '');
  b.style.setProperty('--c', kind === 'loop' ? i.color : '#fbbf24');
  b.dataset.k = kind;
  b.dataset.id = id;
  b.dataset.drag = '1';
  Object.assign(b.dataset, extra);
  const e = document.createElement('span');
  e.className = 'e';
  e.setAttribute('aria-hidden', 'true');
  e.textContent = i.pic;
  b.append(e);
  return b;
}

function renderSong() {
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
      b.setAttribute('aria-hidden', 'true');
      cell.append(b);
      const i = info(k, id);
      cell.setAttribute('aria-label', `${i.label}, ${k === 'loop' ? `stripe ${+cell.dataset.lane + 1}, place ${+cell.dataset.slot + 1}` : `place ${+cell.dataset.pos + 1}`}. Press Delete to remove.`);
    } else {
      cell.setAttribute('aria-label', k === 'loop' ? `Stripe ${+cell.dataset.lane + 1}, place ${+cell.dataset.slot + 1}, empty` : `Fun sound place ${+cell.dataset.pos + 1}, empty`);
    }
  }
}

function buildTray() {
  const loops = $('trayLoops');
  const funs = $('trayFun');
  loops.textContent = '';
  funs.textContent = '';
  for (const l of world.loops) loops.append(trayBlock('loop', l));
  for (const f of catalog.fun) funs.append(trayBlock('fun', f));
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
    b.classList.toggle('loading', !engine.isReady(id) && !engine.failed.has(id));
    b.classList.toggle('failed', engine.failed.has(id));
    const isHeld = !!held && held.id === id;
    b.classList.toggle('held', isHeld);
    b.setAttribute('aria-pressed', String(isHeld));
  }
  $('studio').dataset.held = held ? held.kind : '';
  if (!held) $('studio').removeAttribute('data-held');
}
engine.onReady = () => { if (!$('studio').hidden) refreshTray(); if (engine.playing) engine.sync(); };

// ------------------------------------------------------------------ changing the song

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
  renderSong();
  updateUndo();
  if (engine.playing) engine.setSong(song); else engine.song = song;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}
function save() { if (song && !remix) store.set('song.' + song.world, JSON.stringify(toPayload(song))); }
function updateUndo() { $('undoBtn').disabled = history.length === 0; }
function undo() {
  if (!history.length) return;
  song = history.pop();
  renderSong();
  updateUndo();
  if (engine.playing) engine.setSong(song); else engine.song = song;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
}

function putHeld(cell) {
  const k = cell.dataset.k;
  if (!held || held.kind !== k) return false;
  const next = k === 'loop' ? placeLoop(song, +cell.dataset.lane, +cell.dataset.slot, held.id) : placeFun(song, +cell.dataset.pos, held.id);
  commit(next);
  if (!engine.playing) engine.preview(held.id);
  return true;
}

// ------------------------------------------------------------------ pointer: tap and drag

let drag = null;
const MOVE = 8;

function targetAt(x, y, kind) {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.classList && el.classList.contains('cell') && el.dataset.k === kind) return { type: 'cell', el };
    if (el.id === 'trash') return { type: 'trash', el };
    if (el.id === 'tray') return { type: 'trash', el };
  }
  return null;
}

document.addEventListener('pointerdown', (e) => {
  engine.unlock();
  if (e.button > 0) return;
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el || $('studio').hidden) return;
  drag = { el, k: el.dataset.k, id: el.dataset.id, src: el.dataset.src, x0: e.clientX, y0: e.clientY, started: false, ghost: null, hot: null, pid: e.pointerId };
  if (drag.src === 'cell') {
    const c = el.parentElement;
    drag.from = drag.k === 'loop' ? { lane: +c.dataset.lane, slot: +c.dataset.slot } : +c.dataset.pos;
  }
});

window.addEventListener('pointermove', (e) => {
  if (!drag || e.pointerId !== drag.pid) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < MOVE) return;
    drag.started = true;
    const r = drag.el.getBoundingClientRect();
    const g = drag.el.cloneNode(true);
    g.classList.remove('on', 'held', 'pop', 'lifted', 'loading');
    g.classList.add('ghost');
    g.style.width = `${r.width}px`;
    g.style.height = `${r.height}px`;
    g.style.margin = '0';
    g.style.inset = 'auto';
    g.style.position = 'fixed';
    g.removeAttribute('data-drag');
    document.body.append(g);
    drag.ghost = g;
    drag.w = r.width;
    drag.h = r.height;
    if (drag.src === 'cell') drag.el.classList.add('lifted');
    if (drag.src === 'tray') { held = null; refreshTray(); }
    engine.unlock();
  }
  drag.ghost.style.transform = `translate(${e.clientX - drag.w / 2}px, ${e.clientY - drag.h / 2}px) scale(1.12) rotate(-3deg)`;
  const t = targetAt(e.clientX, e.clientY, drag.k);
  setHot(t);
  e.preventDefault();
}, { passive: false });

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
  if (d.hot) d.hot.classList.remove('hot', 'hot-del');
  if (d.ghost) d.ghost.remove();
  d.el.classList.remove('lifted');
  if (cancelled) return;
  if (!d.started) { tap(d); return; }
  const t = targetAt(e.clientX, e.clientY, d.k);
  if (!t) return;
  if (t.type === 'trash') {
    if (d.src === 'cell') commit(d.k === 'loop' ? removeLoop(song, d.from.lane, d.from.slot) : removeFun(song, d.from));
    return;
  }
  const c = t.el;
  let next = song;
  if (d.src === 'tray') next = d.k === 'loop' ? placeLoop(song, +c.dataset.lane, +c.dataset.slot, d.id) : placeFun(song, +c.dataset.pos, d.id);
  else next = d.k === 'loop' ? moveLoop(song, d.from, { lane: +c.dataset.lane, slot: +c.dataset.slot }) : moveFun(song, d.from, +c.dataset.pos);
  commit(next);
  if (d.src === 'tray' && !engine.playing) engine.preview(d.id);
}
window.addEventListener('pointerup', (e) => endDrag(e, false));
window.addEventListener('pointercancel', (e) => endDrag(e, true));

// a tap: hear a block, or pick one up from the tray to stamp onto stripes
function tap(d) {
  const id = d.id;
  if (d.src === 'tray') {
    if (held && held.id === id) { held = null; engine.stopPreview(); }
    else { held = { kind: d.k, id }; engine.preview(id); }
    refreshTray();
  } else {
    if (engine.previewing === id) engine.stopPreview(); else engine.preview(id);
  }
}

// taps on cells (empty ones put the held block down); keyboard too
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
    if (b) { engine.previewing === b.dataset.id ? engine.stopPreview() : engine.preview(b.dataset.id); } else wiggle($('tray'));
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
    if (n) n.focus();
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
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const dx = x - cx, dy = y - cy;
    if (key === 'ArrowRight' && dx <= 4) continue;
    if (key === 'ArrowLeft' && dx >= -4) continue;
    if (key === 'ArrowDown' && dy <= 4) continue;
    if (key === 'ArrowUp' && dy >= -4) continue;
    const dist = (key.endsWith('ight') || key.endsWith('eft')) ? Math.abs(dx) + Math.abs(dy) * 4 : Math.abs(dy) + Math.abs(dx) * 4;
    if (dist < bestD) { bestD = dist; best = c; }
  }
  if (best) best.focus();
}

// ------------------------------------------------------------------ playing

let raf = 0;
let laneWidth = 0;
function measure() { laneWidth = $('lanes').clientWidth; }
new ResizeObserver(measure).observe($('lanes'));

function startPlaying() {
  engine.play(song);
  $('playBtn').setAttribute('aria-pressed', 'true');
  $('playBtn').setAttribute('aria-label', 'Stop');
  $('playIco').textContent = '⏹';
  $('studio').classList.add('playing');
  measure();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}
function stopPlaying() {
  engine.stop();
  cancelAnimationFrame(raf);
  $('playBtn').setAttribute('aria-pressed', 'false');
  $('playBtn').setAttribute('aria-label', 'Play');
  $('playIco').textContent = '▶';
  $('studio').classList.remove('playing');
  for (const b of document.querySelectorAll('.block.on')) b.classList.remove('on');
  for (const b of document.querySelectorAll('#ruler i.on')) b.classList.remove('on');
}

function frame() {
  const p = engine.position();
  if (!p) return;
  if (p.started) {
    const slotLen = p.len / SLOTS;
    const slot = Math.min(SLOTS - 1, Math.floor(p.t / slotLen));
    $('playhead').style.transform = `translateX(${(p.t / p.len) * laneWidth}px)`;
    const beads = $('ruler').children;
    for (let i = 0; i < beads.length; i++) beads[i].classList.toggle('on', i === slot);
    for (const cell of $('lanes').querySelectorAll('.cell.full')) {
      const b = cell.firstElementChild;
      let on;
      if (cell.dataset.k === 'loop') on = +cell.dataset.slot === slot;
      else {
        const start = (+cell.dataset.pos * slotLen) / FUN_SPAN;
        on = p.t >= start && p.t < start + Math.min(funInfo(b.dataset.id).max, 1.2);
      }
      if (b.classList.contains('on') !== on) b.classList.toggle('on', on);
    }
  }
  raf = requestAnimationFrame(frame);
}

$('playBtn').addEventListener('click', () => { if (engine.playing) stopPlaying(); else startPlaying(); });
$('undoBtn').addEventListener('click', undo);
$('homeBtn').addEventListener('click', goHome);

// ------------------------------------------------------------------ clear

$('clearBtn').addEventListener('click', () => { if (isEmpty(song)) { wiggle($('tray')); return; } $('clearDlg').showModal(); });
$('clearNo').addEventListener('click', () => $('clearDlg').close());
$('clearYes').addEventListener('click', () => { $('clearDlg').close(); commit(emptySong(world.id)); });

// ------------------------------------------------------------------ share

let lastShare = { key: '', result: null };
let sharing = false;
function showShare(result) {
  $('shareSpin').hidden = true;
  $('shareReady').hidden = false;
  $('shareUrl').value = result.url;
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
  if (isEmpty(song)) { wiggle($('tray')); $('shareBtn').animate([{ transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'none' }], 300); return; }
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
  if ($('studio').hidden || e.target.closest('dialog[open]')) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if (typing) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); $('playBtn').click(); }
});
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); stopPlaying(); } });

// ------------------------------------------------------------------ start

if (hasLinkInLocation()) {
  const s = await readLinkFromLocation(catalog);
  if (s) { openWorld(s.world, s, true); }
  else { renderHome(); toast('😕'); history_replace(); }
} else {
  renderHome();
}

// handy for tests: ?debug exposes the internals
if (new URLSearchParams(location.search).has('debug')) window.__sb = { engine, catalog, get song() { return song; }, commit, openWorld, startPlaying, stopPlaying, eventsFor, slotSeconds };
