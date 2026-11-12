// MIDI MUSIC — a browser instrument studio for students (mrarthurmusic.com/midimusic).
// Sound: the MuseScore_General SoundFont (MIT) played by spessasynth (Apache-2.0) inside an AudioWorklet,
// so notes go straight from the MIDI/pointer/key event to the audio thread with no scheduling delay.
import { WorkletSynthesizer } from './vendor/spessasynth.js';

// The SoundFont is shared with the rest of the site (same origin, cached by the browser for 30 days).
const SF_PARTS = ['/audio/soundfont/MuseScore_General.sf3.partaa', '/audio/soundfont/MuseScore_General.sf3.partab'];
const SF_BYTES = 39900972;
const PROCESSOR_URL = new URL('./vendor/spessasynth_processor.min.js', import.meta.url).href;

// ---------------------------------------------------------------- instruments
// [General MIDI program, friendly name]
const CATEGORIES = [
  { id: 'piano', name: 'Pianos', em: '🎹', c: '#ffb020', list: [[0, 'Grand Piano'], [1, 'Bright Piano'], [2, 'Electric Grand'], [3, 'Honky-Tonk Piano'], [4, 'Electric Piano'], [5, 'Sparkle Electric Piano'], [6, 'Harpsichord'], [7, 'Clavinet']] },
  { id: 'mallet', name: 'Bells & Mallets', em: '🔔', c: '#5cd6ff', list: [[11, 'Vibraphone'], [12, 'Marimba'], [13, 'Xylophone'], [9, 'Glockenspiel'], [8, 'Celesta'], [10, 'Music Box'], [14, 'Tubular Bells'], [15, 'Dulcimer'], [108, 'Kalimba'], [114, 'Steel Drums'], [112, 'Tinkle Bell']] },
  { id: 'organ', name: 'Organs', em: '⛪', c: '#c58bff', list: [[19, 'Church Organ'], [16, 'Drawbar Organ'], [17, 'Percussive Organ'], [18, 'Rock Organ'], [20, 'Reed Organ'], [21, 'Accordion'], [23, 'Tango Accordion'], [22, 'Harmonica']] },
  { id: 'guitar', name: 'Guitars', em: '🎸', c: '#ff7a59', list: [[24, 'Nylon Guitar'], [25, 'Steel Guitar'], [26, 'Jazz Guitar'], [27, 'Clean Electric Guitar'], [28, 'Muted Guitar'], [29, 'Overdrive Guitar'], [30, 'Distortion Guitar'], [31, 'Guitar Harmonics'], [105, 'Banjo'], [104, 'Sitar'], [106, 'Shamisen'], [107, 'Koto']] },
  { id: 'bass', name: 'Bass', em: '🎚️', c: '#7fe08a', list: [[32, 'Acoustic Bass'], [33, 'Finger Bass'], [34, 'Pick Bass'], [35, 'Fretless Bass'], [36, 'Slap Bass 1'], [37, 'Slap Bass 2'], [38, 'Synth Bass 1'], [39, 'Synth Bass 2']] },
  { id: 'strings', name: 'Strings', em: '🎻', c: '#ff8fb1', list: [[48, 'String Orchestra'], [49, 'Slow Strings'], [40, 'Violin'], [41, 'Viola'], [42, 'Cello'], [43, 'Double Bass'], [45, 'Pizzicato Strings'], [44, 'Tremolo Strings'], [46, 'Harp'], [110, 'Fiddle'], [55, 'Orchestra Hit']] },
  { id: 'brass', name: 'Brass', em: '🎺', c: '#ffd447', list: [[56, 'Trumpet'], [57, 'Trombone'], [60, 'French Horn'], [58, 'Tuba'], [59, 'Muted Trumpet'], [61, 'Brass Section'], [62, 'Synth Brass 1'], [63, 'Synth Brass 2']] },
  { id: 'wind', name: 'Woodwinds', em: '🎷', c: '#6fe3c4', list: [[73, 'Flute'], [72, 'Piccolo'], [71, 'Clarinet'], [68, 'Oboe'], [69, 'English Horn'], [70, 'Bassoon'], [64, 'Soprano Sax'], [65, 'Alto Sax'], [66, 'Tenor Sax'], [67, 'Baritone Sax'], [74, 'Recorder'], [75, 'Pan Flute'], [79, 'Ocarina'], [78, 'Whistle'], [76, 'Blown Bottle'], [77, 'Shakuhachi'], [109, 'Bagpipe'], [111, 'Shanai']] },
  { id: 'voice', name: 'Voices', em: '🎤', c: '#ff9ce6', list: [[52, 'Choir Aahs'], [53, 'Voice Oohs'], [54, 'Synth Voice'], [91, 'Choir Pad'], [85, 'Voice Lead']] },
  { id: 'lead', name: 'Synth Leads', em: '⚡', c: '#8aa2ff', list: [[80, 'Square Lead'], [81, 'Saw Lead'], [82, 'Calliope'], [83, 'Chiff Lead'], [84, 'Charang'], [86, 'Fifths Lead'], [87, 'Bass & Lead'], [50, 'Synth Strings 1'], [51, 'Synth Strings 2']] },
  { id: 'pad', name: 'Synth Pads', em: '🌌', c: '#b59cff', list: [[89, 'Warm Pad'], [88, 'New Age Pad'], [90, 'Polysynth'], [92, 'Bowed Glass'], [93, 'Metallic Pad'], [94, 'Halo Pad'], [95, 'Sweep Pad'], [96, 'Rain'], [97, 'Soundtrack'], [98, 'Crystal'], [99, 'Atmosphere'], [100, 'Brightness'], [101, 'Goblins'], [102, 'Echoes'], [103, 'Sci-Fi']] },
  { id: 'drums', name: 'Drums', em: '🥁', c: '#ff5d5d', list: [[47, 'Timpani'], [116, 'Taiko Drum'], [117, 'Melodic Tom'], [118, 'Synth Drum'], [115, 'Woodblock'], [113, 'Agogo'], [119, 'Reverse Cymbal']], drums: [[0, 'Drum Kit']] },
  // General MIDI's "Gunshot" (127) is left out on purpose: this is for an elementary school.
  { id: 'fx', name: 'Sound Effects', em: '🚁', c: '#9be15d', list: [[122, 'Seashore'], [123, 'Bird Tweet'], [124, 'Telephone'], [125, 'Helicopter'], [126, 'Applause'], [120, 'Guitar Fret Noise'], [121, 'Breath Noise']] },
];

/** Every instrument as { id, name, prog, drum, cat }. */
let INSTRUMENTS = [];
function buildInstruments() {
  INSTRUMENTS = [];
  for (const cat of CATEGORIES) {
    for (const [prog, name] of cat.drums ?? []) INSTRUMENTS.push({ id: 'd' + prog, name, prog, drum: true, cat });
    for (const [prog, name] of cat.list) INSTRUMENTS.push({ id: 'm' + prog, name, prog, drum: false, cat });
  }
}
buildInstruments();
const byId = (id) => INSTRUMENTS.find((i) => i.id === id);

// ---------------------------------------------------------------- saved settings
const STORE_KEY = 'midimusic.v1';
const saved = (() => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
})();
function save(patch) {
  Object.assign(saved, patch);
  try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch { /* private window: settings just don't persist */ }
}

// ---------------------------------------------------------------- audio engine
class Engine {
  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.synth = null;
    this.ch = 0; // 0 = melodic instrument, 9 = drum kit
    this.prog = 0;
    this.reverb = 45;
    this.sustain = false;
    this.voices = new Map(); // starter-synth voices, used only until the SoundFont has loaded
    this.held = new Set();
  }

  async load(onProgress) {
    const [bank] = await Promise.all([downloadBank(onProgress), this.ctx.audioWorklet.addModule(PROCESSOR_URL)]);
    const synth = new WorkletSynthesizer(this.ctx);
    const makeup = this.ctx.createGain();
    makeup.gain.value = 2.4; // the SoundFont is mixed quietly
    synth.connect(makeup);
    makeup.connect(this.master);
    await synth.soundBankManager.addSoundBank(bank, 'main');
    await synth.isReady;
    for (const v of this.voices.keys()) this.starterOff(v, true);
    this.synth = synth;
    for (const ch of [0, 9]) {
      synth.controllerChange(ch, 91, this.reverb);
      synth.controllerChange(ch, 93, 0);
      synth.controllerChange(ch, 64, this.sustain ? 127 : 0);
    }
    synth.programChange(this.ch, this.prog);
    this.warm();
    return synth;
  }

  setInstrument(prog, drum) {
    const ch = drum ? 9 : 0;
    if (this.synth && ch !== this.ch) this.synth.stopAll(false);
    this.ch = ch;
    this.prog = prog;
    if (!this.synth) return;
    this.synth.programChange(ch, prog);
    this.synth.controllerChange(ch, 1, 0);
    this.warm();
  }

  /** The SoundFont's samples are compressed and decoded the first time they are used. Touch them silently
   *  on a spare channel right after choosing an instrument, so the first real notes do not stutter. */
  warm() {
    const s = this.synth;
    if (!s || this.ch === 9) return;
    const token = (this.warmToken = (this.warmToken || 0) + 1);
    s.controllerChange(15, 7, 0);
    s.controllerChange(15, 91, 0);
    s.programChange(15, this.prog);
    const jobs = [];
    for (const vel of [100, 50, 125, 20]) for (let n = 36; n <= 96; n += 3) jobs.push([n, vel]);
    const step = () => {
      if (token !== this.warmToken) return;
      for (const [n, vel] of jobs.splice(0, 7)) {
        s.noteOn(15, n, vel);
        s.noteOff(15, n);
      }
      if (jobs.length) setTimeout(step, 40);
    };
    step();
  }

  noteOn(note, vel) {
    if (note < 0 || note > 127) return;
    if (this.synth) this.synth.noteOn(this.ch, note, vel);
    else this.starterOn(note, vel);
  }

  noteOff(note) {
    if (note < 0 || note > 127) return;
    if (this.synth) this.synth.noteOff(this.ch, note);
    else this.starterOff(note, false);
  }

  setSustain(on) {
    this.sustain = on;
    if (this.synth) this.synth.controllerChange(this.ch, 64, on ? 127 : 0);
    else if (!on) for (const n of [...this.voices.keys()]) if (!this.held.has(n)) this.starterOff(n, true);
  }

  cc(controller, value) { this.synth?.controllerChange(this.ch, controller, value); }
  bend(value14) { this.synth?.pitchWheel(this.ch, value14); }
  pressure(value) { this.synth?.channelPressure(this.ch, value); }
  setReverb(value) {
    this.reverb = value;
    for (const ch of [0, 9]) this.synth?.controllerChange(ch, 91, value);
  }
  panic() {
    this.synth?.stopAll(true);
    for (const n of [...this.voices.keys()]) this.starterOff(n, true);
  }

  // A tiny built-in electric-piano tone so the keys make sound from the first second, before the
  // 40 MB SoundFont has arrived on a slow school connection.
  starterOn(note, vel) {
    this.starterOff(note, true);
    const { ctx } = this;
    const t = ctx.currentTime;
    const f = 440 * Math.pow(2, (note - 69) / 12);
    const g = ctx.createGain();
    const peak = 0.03 + 0.17 * (vel / 127) ** 2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0, t + 0.004, 0.9);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.3;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(this.master);
    o1.start(t);
    o2.start(t);
    this.voices.set(note, { g, o1, o2 });
    this.held.add(note);
  }

  starterOff(note, force) {
    this.held.delete(note);
    if (this.sustain && !force) return;
    const v = this.voices.get(note);
    if (!v) return;
    this.voices.delete(note);
    const t = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setTargetAtTime(0, t, 0.05);
    v.o1.stop(t + 0.4);
    v.o2.stop(t + 0.4);
  }
}

async function downloadBank(onProgress) {
  const loaded = SF_PARTS.map(() => 0);
  const parts = await Promise.all(SF_PARTS.map(async (url, i) => {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Sound download failed (${res.status})`);
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded[i] += value.length;
      onProgress?.(Math.min(1, (loaded[0] + loaded[1]) / SF_BYTES));
    }
    return chunks;
  }));
  const out = new Uint8Array(loaded[0] + loaded[1]);
  let o = 0;
  for (const chunks of parts) for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

// ---------------------------------------------------------------- state
const $ = (id) => document.getElementById(id);
const engine = new Engine();
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const isBlack = (n) => [1, 3, 6, 8, 10].includes(((n % 12) + 12) % 12);
const noteName = (n) => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);

const state = {
  inst: byId(saved.inst) ?? byId('m0'),
  tab: saved.tab ?? 'piano',
  favs: new Set(Array.isArray(saved.favs) ? saved.favs : []),
  start: 48, // lowest visible key (always a C)
  octaves: 4,
  zoom: 0, // extra octaves the student asked to see (+) or hide (−)
  transpose: 0,
  labels: saved.labels ?? (matchMedia('(pointer: coarse)').matches ? 'notes' : 'keys'), // 'keys' | 'notes' | 'off'
  latch: false, spaceDown: false, pedalDown: false,
};

// ---------------------------------------------------------------- playing notes
// Each input (a finger, a computer key, a MIDI key) is a "source". The sounding note is remembered per
// source so changing the transpose while holding a key still releases the right note.
const sources = new Map(); // sourceId -> { key, note }
const keyCount = new Map(); // on-screen key -> how many sources hold it
const noteCount = new Map(); // sounding note -> how many sources hold it
const keyEls = new Map(); // note -> element

function press(src, key, vel) {
  if (sources.has(src)) release(src);
  const note = key + state.transpose;
  engine.noteOn(note, vel); // sound first, pixels second
  sources.set(src, { key, note });
  noteCount.set(note, (noteCount.get(note) || 0) + 1);
  const c = (keyCount.get(key) || 0) + 1;
  keyCount.set(key, c);
  if (c === 1) keyEls.get(key)?.classList.add('on');
  queuePlaying();
}

function release(src) {
  const s = sources.get(src);
  if (!s) return;
  sources.delete(src);
  const n = (noteCount.get(s.note) || 1) - 1;
  if (n <= 0) { noteCount.delete(s.note); engine.noteOff(s.note); } else noteCount.set(s.note, n);
  const c = (keyCount.get(s.key) || 1) - 1;
  if (c <= 0) { keyCount.delete(s.key); keyEls.get(s.key)?.classList.remove('on'); } else keyCount.set(s.key, c);
  queuePlaying();
}

function releaseAll(prefix) {
  for (const src of [...sources.keys()]) if (!prefix || src.startsWith(prefix)) release(src);
}

// "now playing" readout, drawn at most once per frame so it never slows the notes down
let playingQueued = false;
function queuePlaying() {
  if (playingQueued) return;
  playingQueued = true;
  requestAnimationFrame(drawPlaying);
}
const CHORDS = [['0,4,7', ''], ['0,3,7', 'm'], ['0,3,6', 'dim'], ['0,4,8', 'aug'], ['0,4,7,10', '7'], ['0,4,7,11', 'maj7'], ['0,3,7,10', 'm7'], ['0,5,7', 'sus4'], ['0,2,7', 'sus2'], ['0,4,7,9', '6'], ['0,3,6,9', 'dim7'], ['0,3,6,10', 'm7♭5'], ['0,7', '5']];
function chordName(notes) {
  const pcs = [...new Set(notes.map((n) => n % 12))];
  if (pcs.length < 2 || state.inst.drum) return '';
  const bass = notes[0] % 12;
  for (const root of [bass, ...pcs.filter((p) => p !== bass)]) {
    const shape = pcs.map((p) => (p - root + 12) % 12).sort((a, b) => a - b).join(',');
    const hit = CHORDS.find(([s]) => s === shape);
    if (hit) return NOTE_NAMES[root] + hit[1] + (root !== bass ? '/' + NOTE_NAMES[bass] : '');
  }
  return '';
}
function drawPlaying() {
  playingQueued = false;
  const el = $('playing');
  const notes = [...noteCount.keys()].sort((a, b) => a - b);
  if (!notes.length) {
    el.innerHTML = '<span class="playing-hint">Play something! 🎶</span>';
    return;
  }
  const chord = chordName(notes);
  el.innerHTML = (chord ? `<span class="chord">${chord}</span>` : '') + notes.slice(0, 10).map((n) => `<span class="chip">${noteName(n)}</span>`).join('');
}

// ---------------------------------------------------------------- sustain / transpose / octave
function updateSustain() {
  const on = state.latch || state.spaceDown || state.pedalDown;
  if (on !== engine.sustain) engine.setSustain(on);
  $('susBtn').setAttribute('aria-pressed', String(on));
}

function setTranspose(t) {
  state.transpose = Math.max(-12, Math.min(12, t));
  $('trVal').textContent = (state.transpose > 0 ? '+' : '') + state.transpose;
}

function setStart(start) {
  const max = 120 - state.octaves * 12;
  const next = Math.max(12, Math.min(max, start));
  if (next === state.start && keyEls.size) return;
  state.start = next;
  buildKeyboard();
}

/** The C that the computer keyboard's "A" key plays: the octave in the middle of what is on screen. */
const typingBase = () => state.start + 12 * Math.floor(state.octaves / 2);

// ---------------------------------------------------------------- on-screen keyboard
const kb = $('kb');
const KEY_CODES = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon', 'Quote'];
const KEY_CAPS = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';', "'"];

function fitOctaves() {
  const w = kb.clientWidth || window.innerWidth;
  const fit = Math.floor(w / (7 * 38)); // about 38 px per white key at the smallest
  return Math.max(1, Math.min(7, fit + state.zoom));
}

function buildKeyboard() {
  releaseAll('p:');
  const center = state.start + 6 * state.octaves; // keep the middle of the view where it was when resizing
  const octaves = fitOctaves();
  if (octaves !== state.octaves) {
    state.octaves = octaves;
    const snapped = Math.round((center - 6 * octaves) / 12) * 12;
    state.start = Math.max(12, Math.min(120 - octaves * 12, snapped));
  }
  const first = state.start;
  const last = first + state.octaves * 12; // ends on a C
  const whites = state.octaves * 7 + 1;
  const base = typingBase();
  kb.textContent = '';
  keyEls.clear();
  const frag = document.createDocumentFragment();
  let wi = 0;
  for (let n = first; n <= last; n++) {
    const el = document.createElement('div');
    const black = isBlack(n);
    el.className = 'key ' + (black ? 'b' : 'w') + (n === 60 ? ' mid' : '') + (keyCount.has(n) ? ' on' : '');
    el.dataset.n = n;
    if (black) {
      const bw = 0.62 / whites;
      el.style.width = bw * 100 + '%';
      el.style.left = (wi / whites - bw / 2) * 100 + '%';
    } else wi++;
    let label = '';
    const k = n - base;
    if (state.labels === 'keys' && k >= 0 && k < KEY_CAPS.length) label += `<span class="kc">${KEY_CAPS[k]}</span>`;
    if (state.labels === 'notes' && !black) label += `<span class="cn">${n % 12 === 0 ? noteName(n) : NOTE_NAMES[n % 12]}</span>`;
    else if (state.labels !== 'off' && n % 12 === 0) label += `<span class="cn">${noteName(n)}</span>`;
    if (label) el.innerHTML = `<span class="lb">${label}</span>`;
    keyEls.set(n, el);
    frag.appendChild(el);
  }
  kb.appendChild(frag);
  $('octVal').textContent = `${noteName(first)}–${noteName(last)}`;
}

// Pointer events: every finger is tracked separately (multitouch), and sliding across keys plays them.
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el || !el.classList?.contains('key')) return null;
  const r = el.getBoundingClientRect();
  const depth = Math.max(0, Math.min(1, (y - r.top) / r.height)); // lower on the key = louder, like a real piano
  return { n: Number(el.dataset.n), vel: Math.round(55 + 70 * depth) };
}
kb.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  e.preventDefault();
  unlockAudio();
  try { kb.setPointerCapture(e.pointerId); } catch { /* fine without capture */ }
  const k = keyAt(e.clientX, e.clientY);
  if (k) press('p:' + e.pointerId, k.n, k.vel);
});
kb.addEventListener('pointermove', (e) => {
  const src = 'p:' + e.pointerId;
  const cur = sources.get(src);
  if (!cur) return;
  const k = keyAt(e.clientX, e.clientY);
  if (k && k.n !== cur.key) press(src, k.n, k.vel);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) kb.addEventListener(type, (e) => release('p:' + e.pointerId));
kb.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------------------------------------------------------------- computer keyboard
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t instanceof HTMLInputElement && t.type === 'search') {
    if (e.key === 'Escape') t.blur();
    return;
  }
  const i = KEY_CODES.indexOf(e.code);
  if (i >= 0) {
    e.preventDefault();
    if (e.repeat) return;
    unlockAudio();
    press('k:' + e.code, typingBase() + i, 100);
    return;
  }
  switch (e.code) {
    case 'Space': e.preventDefault(); if (!e.repeat) { state.spaceDown = true; updateSustain(); } break;
    case 'KeyZ': case 'ArrowLeft': e.preventDefault(); setStart(state.start - 12); break;
    case 'KeyX': case 'ArrowRight': e.preventDefault(); setStart(state.start + 12); break;
    case 'ArrowDown': e.preventDefault(); setTranspose(state.transpose - 1); break;
    case 'ArrowUp': e.preventDefault(); setTranspose(state.transpose + 1); break;
    case 'Escape': releaseAll(); engine.panic(); break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') { state.spaceDown = false; updateSustain(); }
  release('k:' + e.code);
});
window.addEventListener('blur', () => { releaseAll('k:'); releaseAll('p:'); state.spaceDown = false; updateSustain(); });

// ---------------------------------------------------------------- pitch bend + modulation wheels
function makeWheel(el, { spring, onChange }) {
  const thumb = el.firstElementChild;
  let active = null;
  const set = (v, notify) => { // v: -1..1 for the bend wheel, 0..1 for the mod wheel
    thumb.style.top = (spring ? 50 - v * 42 : 92 - v * 84) + '%';
    if (notify) onChange(v);
  };
  const fromEvent = (e) => {
    const r = el.getBoundingClientRect();
    const f = 1 - Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return spring ? f * 2 - 1 : f;
  };
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); active = e.pointerId; el.setPointerCapture(e.pointerId); set(fromEvent(e), true); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === active) set(fromEvent(e), true); });
  const end = (e) => { if (e.pointerId !== active) return; active = null; if (spring) set(0, true); };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  set(0, false);
  return (v) => set(v, false);
}
const showBend = makeWheel($('bendWheel'), { spring: true, onChange: (v) => engine.bend(Math.round(8192 + v * 8191)) });
const showMod = makeWheel($('modWheel'), { spring: false, onChange: (v) => engine.cc(1, Math.round(v * 127)) });

// ---------------------------------------------------------------- MIDI keyboards
let midiAccess = null;
const midiBtn = $('midiBtn');
let hitTimer = 0;

function onMidiMessage(e) {
  const d = e.data;
  if (!d || d.length < 2) return;
  const cmd = d[0] & 0xf0;
  const src = 'm:' + (d[0] & 0x0f) + ':' + d[1];
  if (cmd === 0x90 && d[2] > 0) press(src, d[1], d[2]);
  else if (cmd === 0x80 || cmd === 0x90) release(src);
  else if (cmd === 0xb0) {
    if (d[1] === 64) { state.pedalDown = d[2] >= 64; updateSustain(); }
    else if (d[1] === 1) { engine.cc(1, d[2]); showMod(d[2] / 127); }
    else if (d[1] === 123 || d[1] === 120) { releaseAll('m:'); }
    else if (d[1] !== 7 && d[1] !== 0 && d[1] !== 32) engine.cc(d[1], d[2]); // volume and bank stay ours
  } else if (cmd === 0xe0) {
    const v = (d[2] << 7) | d[1];
    engine.bend(v);
    showBend((v - 8192) / 8192);
  } else if (cmd === 0xd0) engine.pressure(d[1]);
  else if (cmd === 0xc0) { const inst = byId('m' + d[1]); if (inst) selectInstrument(inst, true); }
  else return;
  if (!hitTimer) {
    midiBtn.classList.add('hit');
    hitTimer = setTimeout(() => { midiBtn.classList.remove('hit'); hitTimer = 0; }, 90);
  }
}

function refreshMidi() {
  if (!midiAccess) return;
  const names = [];
  for (const input of midiAccess.inputs.values()) {
    if (input.state === 'disconnected') continue;
    input.onmidimessage = onMidiMessage; // assigning again is harmless, and it opens a newly plugged-in device
    names.push(input.name || 'MIDI keyboard');
  }
  const was = midiBtn.dataset.names || '';
  const now = names.join('|');
  midiBtn.dataset.names = now;
  midiBtn.classList.toggle('on', names.length > 0);
  midiBtn.classList.remove('ask');
  $('midiText').textContent = names.length ? names[0] + (names.length > 1 ? ` +${names.length - 1}` : '') : 'Plug in a MIDI keyboard';
  midiBtn.title = names.length ? 'Connected: ' + names.join(', ') : 'No MIDI keyboard found yet. Plug one in with USB — it connects by itself.';
  if (now !== was) {
    if (!names.length && was) { releaseAll('m:'); state.pedalDown = false; updateSustain(); toast('MIDI keyboard unplugged'); }
    else if (names.length && midiBtn.dataset.ready) toast('🎹 ' + names[names.length - 1] + ' connected!');
  }
  midiBtn.dataset.ready = '1';
}

async function connectMidi(fromClick) {
  if (!navigator.requestMIDIAccess) {
    $('midiText').textContent = 'On-screen keys';
    midiBtn.title = 'This browser cannot use MIDI keyboards.';
    if (fromClick) toast('This browser can’t use MIDI keyboards. Try Chrome or Edge on a Chromebook or computer — or play the keys on the screen!');
    return;
  }
  if (midiAccess) { refreshMidi(); if (fromClick) toast(midiBtn.title); return; }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = refreshMidi; // hot-plugging
    refreshMidi();
  } catch {
    midiBtn.classList.add('ask');
    $('midiText').textContent = 'Allow MIDI';
    if (fromClick) toast('MIDI is blocked. Click the 🔒 next to the web address, allow “MIDI devices”, then reload.');
  }
}
midiBtn.addEventListener('click', () => { unlockAudio(); connectMidi(true); });

async function initMidi() {
  if (!navigator.requestMIDIAccess) return connectMidi(false);
  let granted = false;
  try { granted = (await navigator.permissions.query({ name: 'midi' })).state === 'granted'; } catch { /* older browsers */ }
  if (granted) return connectMidi(false);
  midiBtn.classList.add('ask');
  $('midiText').textContent = 'Connect MIDI keyboard';
}

// ---------------------------------------------------------------- instrument browser
const tabsEl = $('tabs');
const gridEl = $('grid');
const searchEl = $('search');

function drawTabs() {
  const tabs = [{ id: 'fav', name: '⭐ Favorites', c: '#ffb020' }, ...CATEGORIES.map((c) => ({ id: c.id, name: `${c.em} ${c.name}`, c: c.c }))];
  tabsEl.innerHTML = tabs.map((t) => `<button class="tab" role="tab" data-tab="${t.id}" style="--c:${t.c}" aria-selected="${t.id === state.tab && !searchEl.value}">${t.name}</button>`).join('');
  tabsEl.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function drawGrid() {
  const q = searchEl.value.trim().toLowerCase();
  let list;
  if (q) list = INSTRUMENTS.filter((i) => i.name.toLowerCase().includes(q) || i.cat.name.toLowerCase().includes(q));
  else if (state.tab === 'fav') list = INSTRUMENTS.filter((i) => state.favs.has(i.id));
  else list = INSTRUMENTS.filter((i) => i.cat.id === state.tab);
  if (!list.length) {
    gridEl.innerHTML = `<div class="empty">${q ? 'No sounds match that. Try another word!' : 'Tap the ☆ on any sound to keep it here.'}</div>`;
    return;
  }
  gridEl.innerHTML = list.map((i) => `<button class="card${i === state.inst ? ' sel' : ''}" data-id="${i.id}" style="--c:${i.cat.c}"><span class="em">${i.drum ? '🥁' : i.cat.em}</span><span class="nm">${i.name}</span><span class="fav${state.favs.has(i.id) ? ' on' : ''}" data-fav="${i.id}" role="button" aria-label="Favorite">${state.favs.has(i.id) ? '★' : '☆'}</span></button>`).join('');
}

function selectInstrument(inst, quiet) {
  if (inst.drum !== state.inst.drum) releaseAll();
  state.inst = inst;
  engine.setInstrument(inst.prog, inst.drum);
  $('curName').textContent = inst.name;
  $('curIcon').textContent = inst.drum ? '🥁' : inst.cat.em;
  document.documentElement.style.setProperty('--kc', inst.cat.c);
  save({ inst: inst.id });
  for (const el of gridEl.querySelectorAll('.card')) el.classList.toggle('sel', el.dataset.id === inst.id);
  if (!quiet) {
    // a quick preview so students hear what they picked even before touching a key
    const n = inst.drum ? 38 : inst.cat.id === 'bass' ? 36 : 60;
    engine.noteOn(n, 90);
    setTimeout(() => engine.noteOff(n), 350);
  }
}

tabsEl.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  searchEl.value = '';
  state.tab = tab.dataset.tab;
  save({ tab: state.tab });
  drawTabs();
  drawGrid();
  gridEl.scrollTop = 0;
});
gridEl.addEventListener('click', (e) => {
  unlockAudio();
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const id = fav.dataset.fav;
    if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
    save({ favs: [...state.favs] });
    drawGrid();
    return;
  }
  const card = e.target.closest('.card');
  const inst = card && byId(card.dataset.id);
  if (inst) selectInstrument(inst);
});
searchEl.addEventListener('input', () => { drawTabs(); drawGrid(); });

// ---------------------------------------------------------------- controls
$('octDown').addEventListener('click', () => setStart(state.start - 12));
$('octUp').addEventListener('click', () => setStart(state.start + 12));
$('trDown').addEventListener('click', () => setTranspose(state.transpose - 1));
$('trUp').addEventListener('click', () => setTranspose(state.transpose + 1));
$('trVal').addEventListener('dblclick', () => setTranspose(0));
$('susBtn').addEventListener('click', () => { state.latch = !(state.latch || state.spaceDown || state.pedalDown); state.spaceDown = false; updateSustain(); });
$('zoomOut').addEventListener('click', () => { if (state.octaves > 1) { state.zoom--; buildKeyboard(); } });
$('zoomIn').addEventListener('click', () => { if (state.octaves < 7) { state.zoom++; buildKeyboard(); } });
const LABEL_MODES = { keys: 'Labels: typing keys', notes: 'Labels: note names', off: 'Labels: off' };
function setLabels(mode) {
  state.labels = mode in LABEL_MODES ? mode : 'keys';
  $('labelBtn').textContent = LABEL_MODES[state.labels];
  save({ labels: state.labels });
  buildKeyboard();
}
$('labelBtn').addEventListener('click', () => { const m = Object.keys(LABEL_MODES); setLabels(m[(m.indexOf(state.labels) + 1) % m.length]); });

const volEl = $('vol');
const reverbEl = $('reverb');
const applyVol = () => { engine.master.gain.value = (volEl.value / 100) ** 2 * 1.25; };
volEl.value = saved.vol ?? 80;
reverbEl.value = saved.reverb ?? 45;
engine.reverb = Number(reverbEl.value);
applyVol();
volEl.addEventListener('input', () => { applyVol(); save({ vol: Number(volEl.value) }); });
reverbEl.addEventListener('input', () => { engine.setReverb(Number(reverbEl.value)); save({ reverb: Number(reverbEl.value) }); });
// sliders must not keep the keyboard focus, or the arrow keys would move them instead of the octave
for (const el of [volEl, reverbEl]) el.addEventListener('change', () => el.blur());
for (const b of document.querySelectorAll('button')) b.addEventListener('pointerup', () => b.blur());

const fsBtn = $('fsBtn');
if (!document.documentElement.requestFullscreen) fsBtn.hidden = true;
fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); });

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

// ---------------------------------------------------------------- start-up
// Browsers only let sound start after a tap or key press. MIDI notes do not count, so one tap is needed.
const startEl = $('start');
function unlockAudio() {
  if (engine.ctx.state !== 'running') engine.ctx.resume();
  if (!startEl.hidden) {
    startEl.hidden = true;
    if (!midiAccess) connectMidi(false); // ask for MIDI now that the student has tapped
  }
}
$('startBtn').addEventListener('click', unlockAudio);
engine.ctx.addEventListener('statechange', () => { if (engine.ctx.state === 'running' && !startEl.hidden) unlockAudio(); });
// iPads suspend audio when the tab is hidden; wake it up again on return
document.addEventListener('visibilitychange', () => { if (!document.hidden && startEl.hidden && engine.ctx.state !== 'running') engine.ctx.resume(); });

const KIT_NAMES = { Standard: 'Drum Kit', Room: 'Room Drum Kit', Power: 'Rock Drum Kit', Electronic: 'Electronic Drum Kit', 'TR-808': '808 Beat Kit', Jazz: 'Jazz Drum Kit', Brush: 'Brush Drum Kit', Orchestra: 'Orchestra Percussion', 'Marching Bass': 'Marching Bass Drums', 'Marching Tenor': 'Marching Tenor Drums' };
function addDrumKits(synth) {
  const kits = (synth.presetList || []).filter((p) => p.isDrum).sort((a, b) => a.program - b.program);
  if (!kits.length) return;
  const seen = new Set();
  const cat = CATEGORIES.find((c) => c.id === 'drums');
  cat.drums = [];
  for (const k of kits) {
    const raw = String(k.name || '').trim();
    // the SoundFont has many near-identical variants ("Standard 3", "OldMarchingBass"): keep one of each kind
    if (seen.has(k.program) || !raw || /\d$/.test(raw) && !/808$/.test(raw) || /^old/i.test(raw)) continue;
    seen.add(k.program);
    const name = KIT_NAMES[raw] ?? (/kit|drum|snare|cymbal|bass|tenor/i.test(raw) ? raw : raw + ' Kit');
    cat.drums.push([k.program, name]);
  }
  if (!cat.drums.length) cat.drums = [[0, 'Drum Kit']];
  const keep = state.inst.id;
  buildInstruments();
  state.inst = byId(keep) ?? byId('m0');
}

async function loadSounds() {
  const pill = $('loadPill');
  pill.hidden = false;
  try {
    const synth = await engine.load((f) => {
      $('loadFill').style.width = Math.round(f * 100) + '%';
      $('loadText').textContent = f < 1 ? `Loading sounds ${Math.round(f * 100)}%` : 'Getting ready…';
    });
    addDrumKits(synth);
    engine.setInstrument(state.inst.prog, state.inst.drum);
    drawGrid();
    pill.hidden = true;
  } catch (err) {
    console.error(err);
    $('loadText').textContent = 'Starter piano only';
    pill.title = 'The full sound library could not load. Check the connection and reload the page.';
    toast('The big sound library could not load, so only the starter piano works. Try reloading the page.');
  }
}

setTranspose(0);
drawTabs();
selectInstrument(state.inst, true);
drawGrid();
setLabels(state.labels);
setStart(60 - 12 * Math.floor(state.octaves / 2));
new ResizeObserver(() => { if (fitOctaves() !== state.octaves) buildKeyboard(); }).observe(kb);
initMidi();
loadSounds();
if (engine.ctx.state === 'running') unlockAudio();
if (location.search.includes('debug')) window.__mm = { engine, state, sources }; // for testing from the console
