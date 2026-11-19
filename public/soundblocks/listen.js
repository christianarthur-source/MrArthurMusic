// Sound Blocks listening page: audition every loop, mix several together (all start on the same beat), mark the ones that do not fit.
import { Engine } from './engine.js';

const $ = (id) => document.getElementById(id);
const [catalog, extras] = await Promise.all([fetch('sounds.json').then((r) => r.json()), fetch('extras.json').then((r) => r.json()).catch(() => ({}))]);
const engine = new Engine(catalog);

const KEY = 'soundblocks.listen.v1';
let marks = {};
try { marks = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { marks = {}; }
const saveMarks = () => { try { localStorage.setItem(KEY, JSON.stringify(marks)); } catch { /* ignore */ } };

// where each extra loop came from
const origin = new Map();
for (const [wid, list] of Object.entries(extras)) for (const x of list) origin.set(`${wid}-x-${x.src.replace('freesound-cc0.', '')}`, x);

let world = catalog.worlds[0];
const mix = new Set(); // ids in the mix
const voices = new Map(); // id -> { src, gain }
let t0 = null;
let solo = null;

function ctx() { return engine.unlock(); }

async function startVoice(id) {
  if (voices.has(id)) return;
  const buf = await engine.load(id);
  if (!buf || !mix.has(id) || voices.has(id)) return;
  const c = ctx();
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain).connect(engine.master);
  const now = c.currentTime + 0.03;
  if (t0 === null) t0 = now;
  const offset = (((now - t0) % buf.duration) + buf.duration) % buf.duration; // join on the beat the others are on
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + 0.02);
  src.start(now, offset);
  voices.set(id, { src, gain });
}
function stopVoice(id) {
  const v = voices.get(id);
  if (!v) return;
  voices.delete(id);
  const t = ctx().currentTime;
  try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t); v.gain.gain.linearRampToValueAtTime(0, t + 0.03); v.src.stop(t + 0.05); } catch { /* done */ }
  if (voices.size === 0) t0 = null;
}
function stopAll() { for (const id of [...voices.keys()]) stopVoice(id); t0 = null; if (solo) { engine.stopPreview(); solo = null; } render(); }

function renderTabs() {
  const box = $('tabs');
  box.textContent = '';
  for (const w of catalog.worlds) {
    const bad = w.loops.filter((l) => marks[l.id] === 'no').length;
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(w === world));
    b.innerHTML = `${w.pic} ${w.name}${bad ? `<span class="dn">👎${bad}</span>` : ''}`;
    b.addEventListener('click', () => { stopAll(); world = w; mix.clear(); render(); });
    box.append(b);
  }
}

function render() {
  renderTabs();
  $('wname').textContent = `${world.pic} ${world.name} · ${world.bpm} BPM · ${world.key}`;
  const rows = $('rows');
  rows.textContent = '';
  for (const l of world.loops) {
    const x = origin.get(l.id);
    const m = marks[l.id];
    const row = document.createElement('div');
    row.className = `row${m === 'no' ? ' bad' : m === 'ok' ? ' good' : ''}`;
    const detail = x
      ? `from “${x.name}” · ${x.bpm} BPM → ${world.bpm}${x.key ? ` · ${x.key}${x.shift ? ` ${x.shift > 0 ? '+' : ''}${x.shift} semitones` : ''} → ${world.key}` : ' · no key (drums)'}`
      : 'came with this world’s kit';
    row.innerHTML = `<span class="sw" style="background:${l.color}"></span><span class="nm"><b>${l.pic} ${l.label}</b><span class="tag ${x ? 'x' : ''}">${x ? 'extra' : 'kit'}</span><small>${detail}</small></span>`;
    const play = document.createElement('button');
    play.className = 'rb';
    play.title = 'Hear it alone';
    play.textContent = solo === l.id ? '⏹' : '▶';
    play.addEventListener('click', async () => {
      if (solo === l.id) { engine.stopPreview(); solo = null; render(); return; }
      for (const id of [...voices.keys()]) stopVoice(id);
      mix.clear();
      solo = l.id;
      await engine.preview(l.id, true);
      engine.onPreviewEnd = () => { solo = null; render(); };
      render();
    });
    const mixCell = document.createElement('label');
    mixCell.className = 'mixcell note';
    mixCell.innerHTML = `<input type="checkbox" ${mix.has(l.id) ? 'checked' : ''}> in mix`;
    mixCell.querySelector('input').addEventListener('change', (e) => {
      if (solo) { engine.stopPreview(); solo = null; }
      if (e.target.checked) { mix.add(l.id); if (voices.size) startVoice(l.id); } else { mix.delete(l.id); stopVoice(l.id); }
    });
    const no = document.createElement('button');
    no.className = 'rb no';
    no.textContent = '👎';
    no.setAttribute('aria-pressed', String(m === 'no'));
    no.addEventListener('click', () => { marks[l.id] = m === 'no' ? undefined : 'no'; if (!marks[l.id]) delete marks[l.id]; saveMarks(); render(); });
    const ok = document.createElement('button');
    ok.className = 'rb ok';
    ok.textContent = '👍';
    ok.setAttribute('aria-pressed', String(m === 'ok'));
    ok.addEventListener('click', () => { marks[l.id] = m === 'ok' ? undefined : 'ok'; if (!marks[l.id]) delete marks[l.id]; saveMarks(); render(); });
    row.append(play, mixCell, no, ok);
    rows.append(row);
  }
  updateOut();
}

function updateOut() {
  const lines = [];
  for (const w of catalog.worlds) {
    const no = w.loops.filter((l) => marks[l.id] === 'no');
    if (!no.length) continue;
    lines.push(`${w.name}: swap out ` + no.map((l) => `${l.label} (${l.id})`).join(', '));
  }
  const ok = Object.values(marks).filter((v) => v === 'ok').length;
  $('out').value = lines.length ? lines.join('\n') + `\n(${ok} marked 👍)` : ok ? `Nothing to swap. ${ok} marked 👍.` : 'No marks yet.';
}

$('kitBtn').addEventListener('click', () => { mix.clear(); for (const l of world.loops) if (!origin.has(l.id)) mix.add(l.id); render(); });
$('mixPlay').addEventListener('click', async () => {
  engine.unlock();
  if (solo) { engine.stopPreview(); solo = null; }
  if (!mix.size) for (const l of world.loops) if (!origin.has(l.id)) mix.add(l.id);
  for (const id of [...voices.keys()]) if (!mix.has(id)) stopVoice(id);
  t0 = null;
  for (const id of [...voices.keys()]) stopVoice(id);
  await Promise.all([...mix].map((id) => engine.load(id)));
  for (const id of mix) startVoice(id);
  render();
});
$('mixStop').addEventListener('click', stopAll);
$('mixClear').addEventListener('click', () => { for (const id of [...voices.keys()]) stopVoice(id); mix.clear(); render(); });
$('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('out').value); $('copy').textContent = 'Copied ✔'; } catch { $('out').select(); $('copy').textContent = 'Press Cmd/Ctrl+C'; }
  setTimeout(() => { $('copy').textContent = 'Copy list'; }, 1800);
});
$('reset').addEventListener('click', () => { if (confirm('Forget all your marks?')) { marks = {}; saveMarks(); render(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });

render();
if (new URLSearchParams(location.search).has('debug')) window.__ls = { engine, mix, voices, marks };
