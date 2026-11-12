// MIDI MUSIC — a browser instrument studio for students (mrarthurmusic.com/midimusic).
// Sound: the MuseScore_General SoundFont (MIT) played by spessasynth (Apache-2.0) inside an AudioWorklet,
// so notes go straight from the MIDI/pointer/key event to the audio thread with no scheduling delay.
import { WorkletSynthesizer } from './vendor/spessasynth.js';
import { SONGS, LEVELS, parseNotes } from './songs.js';

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
    this.ctx = new AudioContext({ latencyHint: 0 }) // 0 = the smallest output buffer the device allows;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.synth = null;
    this.ch = 0; // 0 = melodic instrument, 9 = drum kit
    this.prog = 0;
    this.want = { prog: 0, drum: false };
    this.reverb = 45;
    this.sustain = false;
    this.voices = new Map(); // starter-synth voices, used only until the SoundFont has loaded
    this.held = new Set();
  }

  async load(onProgress) {
    const [bank] = await Promise.all([downloadBank(onProgress), this.ctx.audioWorklet.addModule(PROCESSOR_URL)]);
    this.worker = new Worker(new URL('./bank-worker.js', import.meta.url), { type: 'module' });
    const kits = await new Promise((resolve, reject) => {
      this.worker.onerror = () => reject(new Error('The sound worker could not start'));
      this.worker.onmessage = (e) => (e.data.type === 'loaded' ? resolve(e.data.kits) : reject(new Error(e.data.message)));
      this.worker.postMessage({ type: 'load', buffer: bank }, [bank]);
    });
    this.worker.onerror = null;
    const synth = new WorkletSynthesizer(this.ctx);
    // the standard drum kit is always loaded next to the chosen instrument: "Play to a groove" uses it
    const kit = await new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => (e.data.type === 'built' ? resolve(e.data.buffer) : reject(new Error(e.data.message)));
      this.worker.postMessage({ type: 'build', id: 0, prog: 0, drum: true });
    });
    await synth.soundBankManager.addSoundBank(kit, 'kit');
    this.worker.onmessage = (e) => this.onBuilt(e.data);
    const makeup = this.ctx.createGain();
    makeup.gain.value = 2.4; // the SoundFont is mixed quietly
    synth.connect(makeup);
    makeup.connect(this.master);
    this.pendingSynth = synth;
    await this.setInstrument(this.want.prog, this.want.drum);
    return kits;
  }

  /** Chooses the instrument. The previous one keeps playing until the new one is decoded and ready. */
  setInstrument(prog, drum) {
    this.want = { prog, drum };
    if (!this.worker) return Promise.resolve(false);
    return new Promise((resolve) => {
      this.queued?.resolve(false); // a newer choice replaces one that has not started decoding yet
      this.queued = { prog, drum, resolve };
      this.pump();
    });
  }

  pump() {
    if (this.building || !this.queued) return;
    this.building = this.queued;
    this.queued = null;
    this.worker.postMessage({ type: 'build', id: 0, prog: this.building.prog, drum: this.building.drum });
  }

  async onBuilt(m) {
    const job = this.building;
    if (!job) return;
    let ok = false;
    try {
      if (m.type !== 'built') throw new Error(m.message);
      if (!this.queued) { // skip installing a sound the student has already moved on from
        const synth = this.synth ?? this.pendingSynth;
        await synth.soundBankManager.addSoundBank(m.buffer, 'inst');
        await synth.isReady;
        const ch = job.drum ? 9 : 0;
        if (this.synth && ch !== this.ch) synth.stopAll(false);
        for (const v of [...this.voices.keys()]) this.starterOff(v, true);
        this.synth = synth;
        this.ch = ch;
        this.prog = job.prog;
        synth.programChange(ch, job.prog);
        if (ch !== 9) synth.programChange(9, 0); // back to the standard kit for the groove
        synth.controllerChange(ch, 91, this.reverb);
        synth.controllerChange(ch, 93, 0);
        synth.controllerChange(ch, 1, 0);
        synth.controllerChange(ch, 64, this.sustain ? 127 : 0);
        ok = true;
      }
    } catch (err) {
      console.error(err);
    }
    this.building = null;
    job.resolve(ok);
    this.pump();
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

  /** Plays a drum of the kit at an exact audio-clock time (used by the groove). */
  drum(note, vel, time) {
    if (!this.synth) return;
    this.synth.noteOn(9, note, vel, { time });
    this.synth.noteOff(9, note, { time: time + 0.12 });
  }

  cc(controller, value) { this.synth?.controllerChange(this.ch, controller, value); }
  bend(value14) { this.synth?.pitchWheel(this.ch, value14); }
  pressure(value) { this.synth?.channelPressure(this.ch, value); }
  setReverb(value) {
    this.reverb = value;
    this.synth?.controllerChange(this.ch, 91, value);
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
  start: 60, // lowest visible key (always a C); middle C by default
  octaves: 2,
  want: Number(saved.octaves) || 2, // how many octaves the student wants to see
  transpose: 0,
  showNotes: saved.showNotes ?? true, // note names on the keys
  showKeys: saved.showKeys ?? !matchMedia('(pointer: coarse)').matches, // which computer key plays each note
  song: null, // { def, notes, i, demo } while a song guide is running
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
  if (state.song && src !== 'demo') songHit(key);
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
  if (state.song) return drawSongStatus(el);
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

/** The C that the computer keyboard's "A" key plays: the first key on screen (or near the middle of a wide keyboard). */
const typingBase = () => (state.octaves <= 2 ? state.start : state.start + 12 * Math.floor((state.octaves - 1) / 2));

// ---------------------------------------------------------------- on-screen keyboard
const kb = $('kb');
const KEY_CODES = ['KeyA', 'KeyW', 'KeyS', 'KeyE', 'KeyD', 'KeyF', 'KeyT', 'KeyG', 'KeyY', 'KeyH', 'KeyU', 'KeyJ', 'KeyK', 'KeyO', 'KeyL', 'KeyP', 'Semicolon', 'Quote'];
const KEY_CAPS = ['A', 'W', 'S', 'E', 'D', 'F', 'T', 'G', 'Y', 'H', 'U', 'J', 'K', 'O', 'L', 'P', ';', "'"];

function fitOctaves() {
  const w = kb.clientWidth || window.innerWidth;
  const most = Math.max(1, Math.min(7, Math.floor(w / (7 * 22)))); // never let white keys get thinner than about 22 px
  return Math.max(1, Math.min(most, state.want));
}

/** Slides the view by whole octaves so a note that is off-screen (from a MIDI keyboard or a song) can be seen. */
function follow(n) {
  const span = state.octaves * 12;
  if (n < state.start) setStart(Math.floor(n / 12) * 12);
  else if (n > state.start + span) setStart(Math.ceil((n - span) / 12) * 12);
}

/** Tells the stylesheet how wide a white key is, so the labels scale with the keys. */
function setKeyWidth() {
  kb.style.setProperty('--kw', (kb.clientWidth || window.innerWidth) / (state.octaves * 7 + 1) + 'px');
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
    if (state.showKeys && k >= 0 && k < KEY_CAPS.length) label += `<span class="kc">${KEY_CAPS[k]}</span>`;
    if (state.showNotes) label += `<span class="cn">${n % 12 === 0 ? noteName(n) : NOTE_NAMES[n % 12]}</span>`;
    else if (n % 12 === 0) label += `<span class="cn">${noteName(n)}</span>`;
    if (label) el.innerHTML = `<span class="lb">${label}</span>`;
    keyEls.set(n, el);
    frag.appendChild(el);
  }
  kb.appendChild(frag);
  setKeyWidth();
  $('octVal').textContent = `${noteName(first)}–${noteName(last)}`;
  showGuide(false);
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
  if (cmd === 0x90 && d[2] > 0) { press(src, d[1], d[2]); if (!state.song) follow(d[1]); } // the view stays put during a song
  else if (cmd === 0x80 || cmd === 0x90) release(src);
  else if (cmd === 0xb0) {
    if (d[1] === 64) { state.pedalDown = d[2] >= 64; updateSustain(); }
    else if (d[1] === 1) { engine.cc(1, d[2]); showMod(d[2] / 127); }
    else if (d[1] === 123 || d[1] === 120) { releaseAll('m:'); }
    // every other knob and slider is ignored on purpose: a bumped knob must never silence a student's keyboard
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

/** A tidy name for the top-right label. The school's keyboards get their proper names. */
function midiName(input) {
  const raw = String(input.name || '').trim();
  const all = `${input.manufacturer || ''} ${raw}`;
  if (/irig\s*keys\s*mini/i.test(all)) return 'iRig Keys Mini';
  if (/irig\s*keys/i.test(all)) return raw.replace(/irig\s*keys/i, 'iRig Keys').replace(/\s+(midi\s*)?(in|out)?\s*\d*$/i, '') || 'iRig Keys';
  if (/dmk[-\s]?25/i.test(all)) return 'Donner DMK-25';
  if (/\bn[-\s]?25\b/i.test(all)) return 'Donner N-25';
  let name = raw.replace(/\s*(midi\s*(in|out)?\s*\d*|port[-\s]?\d+)$/i, '').trim() || raw || 'MIDI keyboard';
  if (/donner/i.test(all) && !/donner/i.test(name)) name = 'Donner ' + name;
  return name.replace(/^DONNER\b/, 'Donner');
}

function refreshMidi() {
  if (!midiAccess) return;
  const names = [];
  for (const input of midiAccess.inputs.values()) {
    if (input.state === 'disconnected') continue;
    input.onmidimessage = onMidiMessage; // assigning again is harmless, and it opens a newly plugged-in device
    // Chromebooks list a built-in "Midi Through" port that is not a keyboard
    if (/midi through|^through/i.test(input.name || '')) continue;
    const name = midiName(input);
    if (!names.includes(name)) names.push(name); // some keyboards show up as two ports
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
  const tabs = [{ id: 'songs', name: '🎵 Songs', c: '#39e36b' }, { id: 'groove', name: '🥁 Grooves', c: '#ff7a59' }, { id: 'fav', name: '⭐ Favorites', c: '#ffb020' }, ...CATEGORIES.map((c) => ({ id: c.id, name: `${c.em} ${c.name}`, c: c.c }))];
  tabsEl.innerHTML = tabs.map((t) => `<button class="tab" role="tab" data-tab="${t.id}" style="--c:${t.c}" aria-selected="${t.id === state.tab && !searchEl.value}">${t.name}</button>`).join('');
  tabsEl.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function drawGrid() {
  const q = searchEl.value.trim().toLowerCase();
  if (!q && state.tab === 'songs') {
    gridEl.innerHTML = SONGS.map((sg) => `<button class="card song${state.song?.def === sg ? ' sel' : ''}" data-song="${sg.id}" style="--c:${LEVELS[sg.level].c}" title="${LEVELS[sg.level].name}"><span class="em">${LEVELS[sg.level].em}</span><span class="nm">${sg.title}</span></button>`).join('');
    return;
  }
  if (!q && state.tab === 'groove') return drawGrooves();
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
  $('curName').textContent = inst.name;
  $('curIcon').textContent = inst.drum ? '🥁' : inst.cat.em;
  $('current').classList.add('busy');
  document.documentElement.style.setProperty('--kc', inst.cat.c);
  save({ inst: inst.id });
  for (const el of gridEl.querySelectorAll('.card[data-id]')) el.classList.toggle('sel', el.dataset.id === inst.id);
  engine.setInstrument(inst.prog, inst.drum).then((ready) => {
    if (!ready || state.inst !== inst) return;
    $('current').classList.remove('busy');
    if (quiet || noteCount.size) return;
    // a quick preview so students hear what they picked even before touching a key
    const n = inst.drum ? 38 : inst.cat.id === 'bass' ? 36 : 60;
    engine.noteOn(n, 90);
    setTimeout(() => { if (!noteCount.has(n)) engine.noteOff(n); }, 350);
  });
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
  const tempoStep = e.target.closest('[data-tempo]');
  if (tempoStep) return setTempo(groove.bpm + Number(tempoStep.dataset.tempo));
  if (card?.dataset.groove) return toggleGroove(GROOVES.find((g) => g.id === card.dataset.groove));
  if (card?.dataset.song) return startSong(SONGS.find((sg) => sg.id === card.dataset.song));
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
function setOctaves(n) {
  state.want = Math.max(1, Math.min(7, n));
  if (state.song) state.beforeSong = null; // the student chose a size during a song: keep it afterwards
  save({ octaves: state.want });
  buildKeyboard();
}
$('zoomOut').addEventListener('click', () => setOctaves(state.octaves - 1));
$('zoomIn').addEventListener('click', () => setOctaves(state.octaves + 1));
function drawLabelButtons() {
  $('namesBtn').setAttribute('aria-pressed', String(state.showNotes));
  $('keysBtn').setAttribute('aria-pressed', String(state.showKeys));
}
$('namesBtn').addEventListener('click', () => { state.showNotes = !state.showNotes; save({ showNotes: state.showNotes }); drawLabelButtons(); buildKeyboard(); });
$('keysBtn').addEventListener('click', () => { state.showKeys = !state.showKeys; save({ showKeys: state.showKeys }); drawLabelButtons(); buildKeyboard(); });

// ---------------------------------------------------------------- song guide
// The next key of the tune blinks until the student plays it (in any octave, so a 25-key controller
// always works). "Listen" plays the tune for them first.
let demoTimers = [];
function stopDemo() {
  for (const t of demoTimers) clearTimeout(t);
  demoTimers = [];
  release('demo');
  if (state.song) state.song.demo = false;
}

function startSong(def) {
  stopDemo();
  const notes = parseNotes(def.notes);
  state.song = { def, notes, i: 0, demo: false };
  // Songs use one steady three-octave view (C3–C6 when the tune fits there), so the keyboard does not
  // jump around while the student is following the glowing keys.
  if (!state.beforeSong) state.beforeSong = { want: state.want, start: state.start };
  const lo = Math.min(...notes.map((x) => x.n));
  const hi = Math.max(...notes.map((x) => x.n));
  const low = lo >= 48 && hi <= 84 ? 48 : Math.floor(lo / 12) * 12;
  state.want = Math.max(3, Math.ceil((hi - low) / 12));
  buildKeyboard();
  setStart(low);
  $('songCtl').hidden = false;
  $('curSong').textContent = '🎵 ' + def.title;
  $('curSong').hidden = false;
  for (const el of gridEl.querySelectorAll('.card[data-song]')) el.classList.toggle('sel', el.dataset.song === def.id);
  showGuide(true);
  queuePlaying();
}

function stopSong() {
  stopDemo();
  state.song = null;
  $('songCtl').hidden = true;
  $('curSong').hidden = true;
  if (state.beforeSong) { // back to the view the student had before the song
    state.want = state.beforeSong.want;
    const start = state.beforeSong.start;
    state.beforeSong = null;
    buildKeyboard();
    setStart(start);
  }
  for (const el of gridEl.querySelectorAll('.card[data-song]')) el.classList.remove('sel');
  showGuide(false);
  queuePlaying();
}

/** Makes the next key of the song blink. When the tune repeats a note, the key goes dark for a moment
 *  after each hit and then asks again, with a badge counting how many more times to play it (×3, ×2…). */
let guideTimer = 0;
function showGuide(scroll, afterHit) {
  clearTimeout(guideTimer);
  for (const el of kb.querySelectorAll('.guide')) el.classList.remove('guide');
  const sg = state.song;
  $('listenBtn').textContent = sg?.demo ? '■ Stop' : '▶ Listen';
  if (!sg || sg.demo || sg.i >= sg.notes.length) return;
  const n = sg.notes[sg.i].n;
  if (scroll && (n < state.start || n > state.start + state.octaves * 12)) return follow(n); // rebuilding calls showGuide again
  const el = keyEls.get(n);
  if (!el) return;
  let run = 1;
  while (sg.i + run < sg.notes.length && sg.notes[sg.i + run].n === n) run++;
  el.dataset.rep = run > 1 ? '×' + run : '';
  const again = afterHit && sg.i > 0 && sg.notes[sg.i - 1].n === n;
  if (!again) { el.classList.add('guide'); return; }
  // same note again: a clear "got it" gap, then the glow comes back
  guideTimer = setTimeout(() => {
    if (state.song === sg && !sg.demo && sg.notes[sg.i]?.n === n) keyEls.get(n)?.classList.add('guide');
  }, 170);
}

function songHit(key) {
  const sg = state.song;
  if (sg.demo || sg.i >= sg.notes.length) return;
  if ((((key - sg.notes[sg.i].n) % 12) + 12) % 12 !== 0) return; // right note name, any octave
  sg.i++;
  if (sg.i >= sg.notes.length) toast(`🎉 You played “${sg.def.title}”! Great job!`);
  showGuide(true, true);
}

function drawSongStatus(el) {
  const sg = state.song;
  const done = sg.i >= sg.notes.length;
  const next = done ? '🎉 Finished!' : sg.demo ? '👂 Listen…' : `Next: <span class="chip">${sg.notes[sg.i].label}</span>`;
  el.innerHTML = `<span class="song-prog">${Math.min(sg.i, sg.notes.length)}/${sg.notes.length}</span><span class="song-next">${next}</span>`;
}

function listenToSong() {
  const sg = state.song;
  if (!sg) return;
  if (sg.demo) { stopDemo(); showGuide(true); queuePlaying(); return; }
  sg.demo = true;
  showGuide(false);
  queuePlaying();
  const beat = 60000 / sg.def.bpm;
  let t = 250;
  for (const note of sg.notes) {
    demoTimers.push(setTimeout(() => { follow(note.n); press('demo', note.n, 92); }, t));
    demoTimers.push(setTimeout(() => release('demo'), t + note.d * beat * 0.88));
    t += note.d * beat;
  }
  demoTimers.push(setTimeout(() => { stopDemo(); showGuide(true); queuePlaying(); }, t + 200));
}
$('listenBtn').addEventListener('click', () => { unlockAudio(); listenToSong(); });
$('againBtn').addEventListener('click', () => { if (state.song) startSong(state.song.def); });
$('songStopBtn').addEventListener('click', stopSong);

// ---------------------------------------------------------------- play to a groove
// Drum patterns on the standard kit. Each row is one drum; x = hit, X = accent, o = soft, - = very soft.
// "steps" per bar is 16 (sixteenth notes), or 12 for swing and waltz.
const GROOVES = [
  { id: 'click', name: 'Metronome', em: '⏱️', bpm: 100, beats: 4, parts: { 76: 'X...............', 77: '....x...x...x...' } },
  { id: 'rock', name: 'Rock', em: '🤘', bpm: 110, beats: 4, parts: { 36: 'X.......x.x.....', 38: '....X.......X...', 42: 'x.o.x.o.x.o.x.o.' } },
  { id: 'pop', name: 'Pop', em: '🎤', bpm: 104, beats: 4, parts: { 36: 'X.....x.x.......', 38: '....X.......X...', 42: 'x.o.x.o.x.o.x...', 46: '..............o.' } },
  { id: 'hiphop', name: 'Hip-Hop', em: '🎧', bpm: 88, beats: 4, parts: { 36: 'X......x..x.....', 38: '....X.......X...', 42: 'x.o.x.o.x.o.x.oo' } },
  { id: 'dance', name: 'Dance', em: '🪩', bpm: 122, beats: 4, parts: { 36: 'X...X...X...X...', 39: '....x.......x...', 46: '..o...o...o...o.' } },
  { id: 'funk', name: 'Funk', em: '🕺', bpm: 98, beats: 4, parts: { 36: 'X..x......x..x..', 38: '....X..-.-..X..-', 42: 'xoxoxoxoxoxoxoxo' } },
  { id: 'latin', name: 'Latin', em: '🪇', bpm: 116, beats: 4, parts: { 36: 'x..x....x..x....', 37: 'x..x..x...x..x..', 42: 'o.o.o.o.o.o.o.o.', 70: '..-...-...-...-.' } },
  { id: 'reggae', name: 'Reggae', em: '🌴', bpm: 76, beats: 4, parts: { 36: '........X.......', 37: '........x.......', 42: 'o.x.o.x.o.x.o.x.' } },
  { id: 'swing', name: 'Swing', em: '🎷', bpm: 126, beats: 4, steps: 12, parts: { 51: 'x..x.xx..x.x', 44: '...x.....x..', 36: 'o.....o.....' } },
  { id: 'waltz', name: 'Waltz', em: '💃', bpm: 116, beats: 3, steps: 12, parts: { 36: 'X...........', 42: '....x...x...', 37: '....o...o...' } },
];
const HIT = { X: 102, x: 86, o: 58, '-': 34 };
const groove = { style: null, bpm: Number(saved.bpm) || 100, step: 0, next: 0, timer: 0 };

function grooveTick() {
  const st = groove.style;
  if (!st || !engine.synth) return;
  const steps = st.steps || 16;
  const stepDur = (60 / groove.bpm) * st.beats / steps;
  const now = engine.ctx.currentTime;
  if (groove.next < now) groove.next = now + 0.03; // after the tab was hidden: pick up from here
  while (groove.next < now + 0.15) {
    for (const note in st.parts) {
      const vel = HIT[st.parts[note][groove.step]];
      if (vel) engine.drum(Number(note), vel, groove.next);
    }
    groove.step = (groove.step + 1) % steps;
    groove.next += stepDur;
  }
}

function toggleGroove(st) {
  unlockAudio();
  clearInterval(groove.timer);
  const stopping = !st || st === groove.style;
  groove.style = stopping ? null : st;
  if (!stopping) {
    if (!engine.synth) { groove.style = null; toast('The drums are still loading — try again in a moment.'); return; }
    setTempo(st.bpm);
    groove.step = 0;
    groove.next = engine.ctx.currentTime + 0.06;
    groove.timer = setInterval(grooveTick, 25);
    grooveTick();
  }
  $('grooveStopBtn').hidden = stopping;
  $('grooveStopBtn').textContent = stopping ? '' : `■ Stop ${st.name}`;
  if (state.tab === 'groove') drawGrid();
}

function setTempo(bpm) {
  groove.bpm = Math.max(50, Math.min(200, Math.round(bpm)));
  save({ bpm: groove.bpm });
  const val = $('tempoVal');
  if (val) { val.textContent = groove.bpm; $('tempo').value = groove.bpm; }
}

function drawGrooves() {
  gridEl.innerHTML = `<div class="tempo"><span class="ctl-label">Tempo</span><button class="step" data-tempo="-4" type="button" aria-label="Slower">−</button><input type="range" id="tempo" min="50" max="200" value="${groove.bpm}" aria-label="Tempo"><button class="step" data-tempo="4" type="button" aria-label="Faster">+</button><span class="tempo-val"><b id="tempoVal">${groove.bpm}</b> BPM</span><span class="tempo-hint">Pick a beat, then play along!</span></div>`
    + GROOVES.map((g) => `<button class="card${groove.style === g ? ' sel' : ''}" data-groove="${g.id}" style="--c:#ff7a59"><span class="em">${g.em}</span><span class="nm">${g.name}</span><span class="fav">${groove.style === g ? '■' : '▶'}</span></button>`).join('');
}
gridEl.addEventListener('input', (e) => { if (e.target.id === 'tempo') setTempo(Number(e.target.value)); });
gridEl.addEventListener('change', (e) => { if (e.target.id === 'tempo') e.target.blur(); });
$('grooveStopBtn').addEventListener('click', () => toggleGroove(null));

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
// The one delay this page cannot remove is in the speakers: Bluetooth adds 0.1–0.3 s. Tell the student.
let latencyChecked = false;
function checkOutputLatency() {
  if (latencyChecked || engine.ctx.state !== 'running') return;
  latencyChecked = true;
  setTimeout(() => {
    const ms = Math.round(((engine.ctx.outputLatency || 0) + engine.ctx.baseLatency) * 1000);
    document.querySelector('.vol').title = `Volume — sound output delay about ${ms} ms`;
    if (ms > 90) toast(`Your speakers or headphones add a delay (about ${ms} ms). Bluetooth does this — plug in wired headphones or use the built-in speakers.`);
  }, 1500);
}
engine.ctx.addEventListener('statechange', checkOutputLatency);
checkOutputLatency();
engine.ctx.addEventListener('statechange', () => { if (engine.ctx.state === 'running' && !startEl.hidden) unlockAudio(); });
// iPads suspend audio when the tab is hidden; wake it up again on return
document.addEventListener('visibilitychange', () => { if (!document.hidden && startEl.hidden && engine.ctx.state !== 'running') engine.ctx.resume(); });

const KIT_NAMES = { Standard: 'Drum Kit', Room: 'Room Drum Kit', Power: 'Rock Drum Kit', Electronic: 'Electronic Drum Kit', 'TR-808': '808 Beat Kit', Jazz: 'Jazz Drum Kit', Brush: 'Brush Drum Kit', Orchestra: 'Orchestra Percussion', 'Marching Bass': 'Marching Bass Drums', 'Marching Tenor': 'Marching Tenor Drums' };
function addDrumKits(list) {
  const kits = [...list].sort((a, b) => a.program - b.program);
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
    const kits = await engine.load((f) => {
      $('loadFill').style.width = Math.round(f * 100) + '%';
      $('loadText').textContent = f < 1 ? `Loading sounds ${Math.round(f * 100)}%` : 'Getting ready…';
    });
    addDrumKits(kits);
    $('current').classList.remove('busy');
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
drawLabelButtons();
buildKeyboard();
new ResizeObserver(() => { if (fitOctaves() !== state.octaves) buildKeyboard(); else setKeyWidth(); }).observe(kb);
initMidi();
loadSounds();
if (engine.ctx.state === 'running') unlockAudio();
if (location.search.includes('debug')) window.__mm = { engine, state, sources }; // for testing from the console
