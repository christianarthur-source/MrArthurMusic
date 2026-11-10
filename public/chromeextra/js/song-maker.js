/**
 * Chrome Music Lab EXTRA — Song Maker Experiment
 * Enhanced with "EXTRA" Advanced Features:
 * - 10 Tonal Instruments (Marimba, Piano, Strings, Woodwind, Synth, 8-Bit Retro, Kalimba, Brass Fanfare, Steelpan, Music Box)
 * - 7 Drum Kits (Electronic, Blocks, Kit, Conga, 8-Bit Game, Latin Party, Lo-Fi Vinyl)
 * - 3-Row Drum Grid Option (Hi-Hat / Snare / Kick) or Classic 2-Row (High / Low)
 * - Extra Musical Scales (Major, Minor, Pentatonic, Chromatic, Blues, Dorian)
 * - Arpeggiator / Melody Generator (instant creative inspiration)
 * - Drum Beat Generator (fills four-on-the-floor, funk, or syncopated groove)
 * - Transpose / Shift (+/- semitones & shift octave)
 * - Invert Melody & Reverse / Flip Song
 * - Dynamic Neon Note Trail & Visual Particle Sparks
 * - Microphone Pitch Detection
 * - WAV & MIDI format-0 export
 */

import { audioEngine, SCALES, NOTE_NAMES_SHARP, midiToNoteName } from './audio-engine.js';
import { themeManager } from './theme-palette.js';

// ---------- Short share links (same shared_links table as Beat Maker / Staff Composer) ----------
// On mrarthurmusic.com these become …/chromeextra/?s=abc123. The key is the site's public
// (publishable) Supabase key, already used by the rest of the site for share links.
const SHARE_DB_URL = 'https://xnbhxrzzyjbthrobdkwb.supabase.co/rest/v1/shared_links';
const SHARE_DB_KEY = 'sb_publishable_JipVOkkWnwggeTM6uv7sEQ_rcLwiMmZ';
const SHARE_APP_TYPE = 'song-maker';
const SHARE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/l/I

function shareLinkBase() {
  // Links made on a preview or local copy still point at the real site, which reads the same table.
  const host = location.hostname;
  const local = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.workers.dev');
  const origin = local ? 'https://mrarthurmusic.com' : location.origin;
  return `${origin}/chromeextra/`;
}

async function createSongShortLink(payload) {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const slug = Array.from(bytes, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join('');
  try {
    const res = await fetch(SHARE_DB_URL, {
      method: 'POST',
      headers: { apikey: SHARE_DB_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id: slug, app_type: SHARE_APP_TYPE, title: 'Song Maker song', payload })
    });
    if (!res.ok) {
      console.warn(`[Song Maker] share link save failed: ${res.status}`);
      return null;
    }
    return `${shareLinkBase()}?s=${slug}`;
  } catch (err) {
    console.warn('[Song Maker] share link save failed', err);
    return null;
  }
}

async function fetchSharedSong(slug) {
  try {
    const res = await fetch(`${SHARE_DB_URL}?id=eq.${encodeURIComponent(slug)}&select=app_type,payload`, {
      headers: { apikey: SHARE_DB_KEY }
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch {
    return null;
  }
}

export const TONAL_INSTRUMENTS = [
  { id: 'marimba',  label: 'Marimba',   icon: 'marimba' },
  { id: 'piano',    label: 'Piano',     icon: 'piano' },
  { id: 'strings',  label: 'Strings',   icon: 'strings' },
  { id: 'woodwind', label: 'Woodwind',  icon: 'woodwind' },
  { id: 'synth',    label: 'Synth',     icon: 'synth' },
  { id: '8bit',     label: '8-Bit Retro', icon: '8bit' },
  { id: 'kalimba',  label: 'Kalimba',   icon: 'kalimba' },
  { id: 'brass',    label: 'Brass',     icon: 'brass' },
  { id: 'steelpan', label: 'Steelpan',  icon: 'steelpan' },
  { id: 'musicbox', label: 'Music Box', icon: 'musicbox' }
];

export const DRUM_KITS = [
  { id: 'electronic', label: 'Electronic',  icon: 'electronic' },
  { id: 'blocks',     label: 'Blocks',      icon: 'blocks' },
  { id: 'kit',        label: 'Acoustic Kit', icon: 'kit' },
  { id: 'conga',      label: 'Conga / Bongo', icon: 'conga' },
  { id: '8bit',       label: '8-Bit Beats', icon: '8bit' },
  { id: 'latin',      label: 'Latin Party', icon: 'latin' },
  { id: 'lofi',       label: 'Lo-Fi Chill', icon: 'lofi' }
];

export class SongMakerApp {
  constructor() {
    this.settings = {
      bars: 4,
      beats: 4,
      splitBeats: 2,
      scale: 'major',
      rootPitch: 0,      // 0 = C .. 11 = B
      rootOctave: 4,     // 3 = Low, 4 = Middle (MIDI 60), 5 = High
      octaves: 2,        // 1 to 3 octaves
      bpm: 120,
      instrumentIndex: 0,
      drumKitIndex: 0,
      drumRowCount: 3    // 3 rows: High (Hi-Hat / Triangle), Mid (Snare / Woodblock), Low (Kick / Conga)
    };

    this.scaleMidiNotes = []; // Top-to-bottom MIDI note mapping for each row
    this.tonalGrid = [];      // [row][col] boolean
    this.drumGrid = [[], [], []]; // [0 = high, 1 = mid, 2 = low][col] boolean
    this.history = [];        // Undo stack

    this.isPlaying = false;
    this.currentStep = -1;
    this.stepTimer = null;

    // Pointer drag painting state
    this.isPointerDown = false;
    this.paintMode = true;
    this.hoverCell = null;

    // Keyboard selector cursor
    this.cursor = { active: false, section: 'tonal', row: 0, col: 0 };

    // Microphone pitch detection state
    this.micActive = false;
    this.micRaf = null;
    this.lastMicInsertTime = 0;

    // Animated note pop scale map: key "r,c" -> timestamp
    this.notePopTimes = new Map();
    // Visual celebratory particles on beats
    this.particles = [];

    this.initDOM();
    this.rebuildGrid(false);
    this.loadStarterMelody();

    themeManager.subscribe(() => this.render());
    window.addEventListener('resize', () => {
      this.resizeCanvases();
    });

    if (window.ResizeObserver && this.tonalCanvas) {
      const ro = new ResizeObserver(() => {
        this.resizeCanvases();
      });
      ro.observe(this.tonalCanvas);
      if (this.drumCanvas) ro.observe(this.drumCanvas);
    }

    this.startParticleLoop();
  }

  get totalCols() {
    return this.settings.bars * this.settings.beats * this.settings.splitBeats;
  }

  get currentInstrument() {
    return TONAL_INSTRUMENTS[this.settings.instrumentIndex].id;
  }

  get currentDrumKit() {
    return DRUM_KITS[this.settings.drumKitIndex].id;
  }

  get drumRows() {
    return this.settings.drumRowCount || 3;
  }

  computeScaleNotes() {
    const intervals = SCALES[this.settings.scale] || SCALES.major;
    const baseMidi = (this.settings.rootOctave + 1) * 12 + this.settings.rootPitch;
    const notes = [];
    for (let oct = 0; oct < this.settings.octaves; oct++) {
      for (const semi of intervals) {
        notes.push(baseMidi + oct * 12 + semi);
      }
    }
    // Include top tonic cap note
    notes.push(baseMidi + this.settings.octaves * 12);
    this.scaleMidiNotes = notes.reverse();
  }

  rowIndexToMidi(row) {
    return this.scaleMidiNotes[row] || 60;
  }

  rebuildGrid(preserveExisting = true) {
    this.computeScaleNotes();
    const numRows = this.scaleMidiNotes.length;
    const numCols = this.totalCols;
    const dRows = this.drumRows;

    const newTonal = Array.from({ length: numRows }, (_, r) =>
      Array.from({ length: numCols }, (__, c) =>
        preserveExisting && this.tonalGrid[r] && this.tonalGrid[r][c] ? true : false
      )
    );

    const newDrum = Array.from({ length: dRows }, (_, r) =>
      Array.from({ length: numCols }, (__, c) =>
        preserveExisting && this.drumGrid[r] && this.drumGrid[r][c] ? true : false
      )
    );

    this.tonalGrid = newTonal;
    this.drumGrid = newDrum;
    this.resizeCanvases();
  }

  saveUndoSnapshot() {
    this.history.push({
      tonal: this.tonalGrid.map(row => [...row]),
      drum: this.drumGrid.map(row => [...row])
    });
    if (this.history.length > 50) {
      this.history.shift();
    }
    this.updateUndoButtonState();
  }

  undo() {
    if (this.history.length === 0) return;
    const prev = this.history.pop();
    this.tonalGrid = prev.tonal;
    this.drumGrid = prev.drum;
    this.updateUndoButtonState();
    this.render();
  }

  updateUndoButtonState() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this.history.length === 0;
      this.undoBtn.style.opacity = this.history.length === 0 ? '0.45' : '1';
    }
  }

  initDOM() {
    this.tonalCanvas = document.getElementById('sm-tonal-canvas');
    this.drumCanvas = document.getElementById('sm-perc-canvas');
    this.playBtn = document.getElementById('sm-play-btn');
    this.instBtn = document.getElementById('sm-inst-btn');
    this.drumBtn = document.getElementById('sm-drum-btn');
    this.tempoSlider = document.getElementById('sm-tempo-slider');
    this.tempoValue = document.getElementById('sm-tempo-val');
    this.micBtn = document.getElementById('sm-mic-btn');
    this.undoBtn = document.getElementById('sm-undo-btn');
    this.clearBtn = document.getElementById('sm-clear-btn');
    this.settingsBtn = document.getElementById('sm-settings-btn');
    this.saveBtn = document.getElementById('sm-save-btn');
    this.presetSelect = document.getElementById('sm-preset-select');
    this.noteLabelsToggle = document.getElementById('sm-show-labels-btn');
    this.magicBtn = document.getElementById('sm-magic-btn');
    this.showNoteLabels = true;

    this.bindCanvasEvents(this.tonalCanvas, 'tonal');
    this.bindCanvasEvents(this.drumCanvas, 'drum');

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    if (this.instBtn) {
      this.instBtn.addEventListener('click', () => {
        this.settings.instrumentIndex = (this.settings.instrumentIndex + 1) % TONAL_INSTRUMENTS.length;
        this.updateInstrumentButtons();
        audioEngine.playTonalNote(this.currentInstrument, 60, 0.28, 0, 0.75);
      });
    }

    if (this.drumBtn) {
      this.drumBtn.addEventListener('click', () => {
        this.settings.drumKitIndex = (this.settings.drumKitIndex + 1) % DRUM_KITS.length;
        this.updateInstrumentButtons();
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'low', 0, 0.8);
        setTimeout(() => audioEngine.playSongMakerDrum(this.currentDrumKit, 'mid', 0, 0.8), 100);
        setTimeout(() => audioEngine.playSongMakerDrum(this.currentDrumKit, 'high', 0, 0.8), 200);
      });
    }

    if (this.tempoSlider) {
      this.tempoSlider.addEventListener('input', (e) => {
        this.settings.bpm = parseInt(e.target.value, 10) || 120;
        if (this.tempoValue) this.tempoValue.textContent = this.settings.bpm;
        if (this.isPlaying) {
          this.restartLoopTimer();
        }
      });
    }

    if (this.micBtn) {
      this.micBtn.addEventListener('click', () => this.toggleMicrophone());
    }

    if (this.undoBtn) {
      this.undoBtn.addEventListener('click', () => this.undo());
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.rebuildGrid(false);
        this.render();
      });
    }

    if (this.noteLabelsToggle) {
      this.noteLabelsToggle.addEventListener('click', () => {
        this.showNoteLabels = !this.showNoteLabels;
        this.noteLabelsToggle.classList.toggle('active', this.showNoteLabels);
        this.render();
      });
    }

    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val) {
          this.loadPresetSong(val);
          e.target.value = '';
          e.target.blur();
        }
      });
    }

    // "EXTRA Magic Tools" Modal wiring
    this.initMagicModal();
    // Settings Modal wiring
    this.initSettingsModal();
    // Save / Export Modal wiring
    this.initSaveModal();

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      const view = document.getElementById('view-song-maker');
      if (!view || !view.classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        this.moveKeyboardCursor(e.key);
      } else if (e.key === 'Enter') {
        if (this.cursor.active) {
          e.preventDefault();
          this.toggleCellAtCursor();
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (this.cursor.active) {
          e.preventDefault();
          this.clearCellAtCursor();
        }
      }
    });

    this.updateInstrumentButtons();
    this.updateUndoButtonState();
  }

  bindCanvasEvents(canvas, section) {
    if (!canvas) return;

    const getCell = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const rows = section === 'tonal' ? this.tonalGrid.length : this.drumRows;
      const cols = this.totalCols;
      const col = Math.floor((x / rect.width) * cols);
      const row = Math.floor((y / rect.height) * rows);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return { section, row, col };
    };

    const handleDown = (ev) => {
      ev.preventDefault();
      const cell = getCell(ev);
      if (!cell) return;
      this.saveUndoSnapshot();
      this.isPointerDown = true;
      this.cursor = { active: true, ...cell };

      const grid = section === 'tonal' ? this.tonalGrid : this.drumGrid;
      const currentVal = grid[cell.row][cell.col];
      this.paintMode = !currentVal;
      this.applyCellPaint(cell, this.paintMode);
    };

    const handleMove = (ev) => {
      const cell = getCell(ev);
      this.hoverCell = cell;
      if (this.isPointerDown && cell) {
        const grid = section === 'tonal' ? this.tonalGrid : this.drumGrid;
        if (grid[cell.row][cell.col] !== this.paintMode) {
          this.applyCellPaint(cell, this.paintMode);
        }
      } else {
        this.render();
      }
    };

    const handleUp = () => {
      this.isPointerDown = false;
    };

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    canvas.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      this.render();
    });

    canvas.addEventListener('touchstart', handleDown, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
  }

  applyCellPaint(cell, value) {
    const { section, row, col } = cell;
    if (section === 'tonal') {
      this.tonalGrid[row][col] = value;
      if (value) {
        const midi = this.rowIndexToMidi(row);
        audioEngine.playTonalNote(this.currentInstrument, midi, 0.3, 0, 0.8);
        this.notePopTimes.set(`t:${row},${col}`, performance.now());
        this.spawnNoteParticle(section, row, col);
      }
    } else {
      this.drumGrid[row][col] = value;
      if (value) {
        const soundType = this.drumRows === 3
          ? (row === 0 ? 'high' : row === 1 ? 'mid' : 'low')
          : (row === 0 ? 'high' : 'low');
        audioEngine.playSongMakerDrum(this.currentDrumKit, soundType, 0, 0.85);
        this.notePopTimes.set(`d:${row},${col}`, performance.now());
        this.spawnNoteParticle(section, row, col);
      }
    }
    this.render();
  }

  spawnNoteParticle(section, row, col) {
    const canvas = section === 'tonal' ? this.tonalCanvas : this.drumCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cols = this.totalCols;
    const rows = section === 'tonal' ? this.tonalGrid.length : this.drumRows;
    const cx = ((col + 0.5) / cols) * canvas.width;
    const cy = ((row + 0.5) / rows) * canvas.height;
    const color = section === 'tonal'
      ? themeManager.getNoteColor(this.rowIndexToMidi(row))
      : themeManager.getTheme().accent;

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = Math.random() * 2.5 + 1.2;
      this.particles.push({
        section,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 0.9,
        size: Math.random() * 3.5 + 2
      });
    }
  }

  moveKeyboardCursor(key) {
    if (!this.cursor.active) {
      this.cursor = { active: true, section: 'tonal', row: Math.floor(this.tonalGrid.length / 2), col: 0 };
      this.render();
      return;
    }

    const maxTonalRow = this.tonalGrid.length - 1;
    const maxCol = this.totalCols - 1;
    const maxDrumRow = this.drumRows - 1;

    if (key === 'ArrowLeft') {
      this.cursor.col = Math.max(0, this.cursor.col - 1);
    } else if (key === 'ArrowRight') {
      this.cursor.col = Math.min(maxCol, this.cursor.col + 1);
    } else if (key === 'ArrowUp') {
      if (this.cursor.section === 'drum') {
        if (this.cursor.row > 0) {
          this.cursor.row--;
        } else {
          this.cursor.section = 'tonal';
          this.cursor.row = maxTonalRow;
        }
      } else {
        this.cursor.row = Math.max(0, this.cursor.row - 1);
      }
    } else if (key === 'ArrowDown') {
      if (this.cursor.section === 'tonal') {
        if (this.cursor.row < maxTonalRow) {
          this.cursor.row++;
        } else {
          this.cursor.section = 'drum';
          this.cursor.row = 0;
        }
      } else {
        this.cursor.row = Math.min(maxDrumRow, this.cursor.row + 1);
      }
    }
    this.render();
  }

  toggleCellAtCursor() {
    const { section, row, col } = this.cursor;
    const grid = section === 'tonal' ? this.tonalGrid : this.drumGrid;
    this.saveUndoSnapshot();
    this.applyCellPaint({ section, row, col }, !grid[row][col]);
    this.cursor.col = (this.cursor.col + 1) % this.totalCols;
    this.render();
  }

  clearCellAtCursor() {
    const { section, row, col } = this.cursor;
    this.saveUndoSnapshot();
    this.applyCellPaint({ section, row, col }, false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  play() {
    audioEngine.ensureContext();
    this.isPlaying = true;
    if (this.playBtn) {
      this.playBtn.classList.add('playing');
      this.playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <rect x="6" y="5" width="4.5" height="14" rx="1.5"/>
          <rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/>
        </svg>`;
    }
    this.currentStep = -1;
    this.tickStep();
    this.restartLoopTimer();
  }

  stop() {
    this.isPlaying = false;
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    this.currentStep = -1;
    if (this.playBtn) {
      this.playBtn.classList.remove('playing');
      this.playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z"/>
        </svg>`;
    }
    this.render();
  }

  getStepDurationSec() {
    return (60 / this.settings.bpm) / this.settings.splitBeats;
  }

  restartLoopTimer() {
    if (this.stepTimer) clearInterval(this.stepTimer);
    const intervalMs = this.getStepDurationSec() * 1000;
    this.stepTimer = setInterval(() => this.tickStep(), intervalMs);
  }

  tickStep() {
    this.currentStep = (this.currentStep + 1) % this.totalCols;
    const col = this.currentStep;
    const stepDur = this.getStepDurationSec();

    // Play tonal notes in this column
    for (let row = 0; row < this.tonalGrid.length; row++) {
      if (this.tonalGrid[row][col]) {
        const midi = this.rowIndexToMidi(row);
        audioEngine.playTonalNote(this.currentInstrument, midi, stepDur * 0.95, 0, 0.8);
        this.notePopTimes.set(`t:${row},${col}`, performance.now());
        this.spawnNoteParticle('tonal', row, col);
      }
    }

    // Play percussion notes in this column
    if (this.drumRows === 3) {
      if (this.drumGrid[0] && this.drumGrid[0][col]) {
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'high', 0, 0.85);
        this.notePopTimes.set(`d:0,${col}`, performance.now());
      }
      if (this.drumGrid[1] && this.drumGrid[1][col]) {
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'mid', 0, 0.85);
        this.notePopTimes.set(`d:1,${col}`, performance.now());
      }
      if (this.drumGrid[2] && this.drumGrid[2][col]) {
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'low', 0, 0.85);
        this.notePopTimes.set(`d:2,${col}`, performance.now());
      }
    } else {
      if (this.drumGrid[0] && this.drumGrid[0][col]) {
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'high', 0, 0.85);
        this.notePopTimes.set(`d:0,${col}`, performance.now());
      }
      if (this.drumGrid[1] && this.drumGrid[1][col]) {
        audioEngine.playSongMakerDrum(this.currentDrumKit, 'low', 0, 0.85);
        this.notePopTimes.set(`d:1,${col}`, performance.now());
      }
    }

    this.render();
  }

  async toggleMicrophone() {
    if (this.micActive) {
      this.micActive = false;
      audioEngine.stopMicrophone();
      if (this.micRaf) cancelAnimationFrame(this.micRaf);
      if (this.micBtn) {
        this.micBtn.classList.remove('active');
        this.micBtn.querySelector('.btn-label').textContent = 'Mic';
      }
      this.render();
      return;
    }

    const ok = await audioEngine.startMicrophone();
    if (!ok) {
      alert('Could not access microphone. Please allow microphone permissions to sing notes into Song Maker.');
      return;
    }

    this.micActive = true;
    if (!this.cursor.active) {
      this.cursor = { active: true, section: 'tonal', row: Math.floor(this.tonalGrid.length / 2), col: 0 };
    }
    if (this.micBtn) {
      this.micBtn.classList.add('active');
    }

    const pollMic = () => {
      if (!this.micActive) return;
      const res = audioEngine.detectMicPitch();
      if (res && res.midi !== null) {
        let closestRow = 0;
        let minDiff = 999;
        this.scaleMidiNotes.forEach((m, r) => {
          const diff = Math.abs(m - res.midi);
          if (diff < minDiff) {
            minDiff = diff;
            closestRow = r;
          }
        });

        this.cursor.section = 'tonal';
        this.cursor.row = closestRow;
        if (this.micBtn) {
          this.micBtn.querySelector('.btn-label').textContent = `Mic (${res.noteName})`;
        }

        const now = performance.now();
        if (now - this.lastMicInsertTime > 420 && res.clarity > 0.88) {
          this.lastMicInsertTime = now;
          this.saveUndoSnapshot();
          this.applyCellPaint({ section: 'tonal', row: closestRow, col: this.cursor.col }, true);
          this.cursor.col = (this.cursor.col + 1) % this.totalCols;
        }
      }
      this.render();
      this.micRaf = requestAnimationFrame(pollMic);
    };
    this.micRaf = requestAnimationFrame(pollMic);
  }

  updateInstrumentButtons() {
    const inst = TONAL_INSTRUMENTS[this.settings.instrumentIndex];
    const drum = DRUM_KITS[this.settings.drumKitIndex];
    if (this.instBtn) {
      this.instBtn.querySelector('.btn-label').textContent = inst.label;
      this.instBtn.querySelector('.inst-icon-slot').innerHTML = this.getInstrumentSvg(inst.id);
    }
    if (this.drumBtn) {
      this.drumBtn.querySelector('.btn-label').textContent = drum.label;
      this.drumBtn.querySelector('.inst-icon-slot').innerHTML = this.getDrumSvg(drum.id);
    }
  }

  getInstrumentSvg(id) {
    switch (id) {
      case 'marimba':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="3" height="14" rx="1"/><rect x="8.5" y="6.5" width="3" height="11" rx="1"/><rect x="14" y="8" width="3" height="8" rx="1"/><circle cx="19.5" cy="7" r="2" fill="currentColor"/><line x1="19.5" y1="9" x2="19.5" y2="18"/></svg>`;
      case 'piano':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/><rect x="7" y="4" width="3.5" height="9" fill="currentColor"/><rect x="13.5" y="4" width="3.5" height="9" fill="currentColor"/></svg>`;
      case 'strings':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6c-2.5 1-3.5 3.5-2 6-2 2-2.5 5 0 7 2.5 2 6.5 1 8-1.5 1.5-2.5.5-5-1-6 1.5-1.5 1.5-4-.5-5.5-2-1.5-4.5 0-4.5 0z"/><line x1="14" y1="10" x2="20" y2="4"/><line x1="4" y1="19" x2="19" y2="11"/></svg>`;
      case 'woodwind':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 19L19 5"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><path d="M4 17l3 3"/></svg>`;
      case '8bit':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 12h3m-1.5-1.5v3m6-1.5h.01m2.5-1.5h.01"/></svg>`;
      case 'kalimba':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5,4 19,4 17,20 7,20"/><line x1="8" y1="4" x2="8" y2="12"/><line x1="10" y1="4" x2="10" y2="14"/><line x1="12" y1="4" x2="12" y2="16"/><line x1="14" y1="4" x2="14" y2="14"/><line x1="16" y1="4" x2="16" y2="12"/></svg>`;
      case 'brass':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13h9l6-5v10l-6-5"/><circle cx="6" cy="10" r="1" fill="currentColor"/><circle cx="8" cy="10" r="1" fill="currentColor"/></svg>`;
      case 'steelpan':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="9" ry="7"/><circle cx="12" cy="12" r="2.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="15" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/><circle cx="15" cy="15" r="1.5"/></svg>`;
      case 'musicbox':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="12" cy="13" r="3"/><path d="M12 4v3m0 0l3-2"/></svg>`;
      case 'synth':
      default:
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2 12 6 12 9 4 15 20 18 12 22 12"/></svg>`;
    }
  }

  getDrumSvg(id) {
    switch (id) {
      case 'electronic':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor"/></svg>`;
      case 'blocks':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="4 9 12 5 20 9 12 13"/><polyline points="4 9 4 15 12 19 20 15 20 9"/></svg>`;
      case 'conga':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="6" rx="6" ry="2.5"/><path d="M6 6c0 6 1.5 11 3 14h6c1.5-3 3-8 3-14"/></svg>`;
      case '8bit':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="9" y="14" width="6" height="6"/></svg>`;
      case 'latin':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="8,4 16,4 18,18 6,18"/><circle cx="12" cy="18" r="1.5"/></svg>`;
      case 'lofi':
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>`;
      case 'kit':
      default:
        return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="6"/><line x1="4" y1="5" x2="10" y2="9"/><line x1="20" y1="5" x2="14" y2="9"/></svg>`;
    }
  }

  resizeCanvases() {
    if (!this.tonalCanvas || !this.drumCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const tRect = this.tonalCanvas.getBoundingClientRect();
    const dRect = this.drumCanvas.getBoundingClientRect();

    if (tRect.width > 0 && tRect.height > 0) {
      this.tonalCanvas.width = Math.floor(tRect.width * dpr);
      this.tonalCanvas.height = Math.floor(tRect.height * dpr);
    }
    if (dRect.width > 0 && dRect.height > 0) {
      this.drumCanvas.width = Math.floor(dRect.width * dpr);
      this.drumCanvas.height = Math.floor(dRect.height * dpr);
    }
    this.render();
  }

  startParticleLoop() {
    const loop = () => {
      this.updateParticles();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateParticles() {
    if (this.particles.length === 0) return;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha *= 0.92;
      p.size *= 0.95;
      if (p.alpha < 0.05 || p.size < 0.5) {
        this.particles.splice(i, 1);
      }
    }
    this.render();
  }

  render() {
    if (!this.tonalCanvas || !this.drumCanvas) return;
    const theme = themeManager.getTheme();
    const dpr = window.devicePixelRatio || 1;
    const now = performance.now();
    let hasActiveAnimation = false;

    // 1. Render Tonal Grid Canvas
    const tCtx = this.tonalCanvas.getContext('2d');
    const tW = this.tonalCanvas.width;
    const tH = this.tonalCanvas.height;
    const rows = this.tonalGrid.length;
    const cols = this.totalCols;
    const cellW = tW / cols;
    const cellH = tH / rows;
    const stepsPerBeat = this.settings.splitBeats;
    const stepsPerBar = this.settings.beats * stepsPerBeat;

    tCtx.clearRect(0, 0, tW, tH);

    // Bar Striping
    for (let col = 0; col < cols; col++) {
      const barIdx = Math.floor(col / stepsPerBar);
      tCtx.fillStyle = barIdx % 2 === 0 ? theme.bgCanvas : theme.bgCanvasAlt;
      tCtx.fillRect(col * cellW, 0, cellW + 0.5, tH);
    }

    // Active Playhead Column Highlight with trailing glow
    if (this.isPlaying && this.currentStep >= 0) {
      tCtx.fillStyle = theme.mode === 'light'
        ? 'rgba(56, 189, 248, 0.18)'
        : 'rgba(56, 189, 248, 0.12)';
      tCtx.fillRect(this.currentStep * cellW, 0, cellW, tH);
    }

    // Horizontal Pitch Lines
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * cellH) + 0.5;
      const midi = this.rowIndexToMidi(r);
      const isOctaveRoot = r > 0 && r < rows && ((midi - this.settings.rootPitch) % 12 === 0);
      tCtx.strokeStyle = isOctaveRoot ? theme.gridBarLine : theme.gridLine;
      tCtx.lineWidth = isOctaveRoot ? 2 * dpr : 1 * dpr;
      tCtx.beginPath();
      tCtx.moveTo(0, y);
      tCtx.lineTo(tW, y);
      tCtx.stroke();
    }

    // Vertical Beat Lines
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * cellW) + 0.5;
      const isBarLine = c % stepsPerBar === 0;
      const isBeatLine = c % stepsPerBeat === 0;

      tCtx.save();
      if (isBarLine) {
        tCtx.strokeStyle = theme.gridBarLine;
        tCtx.lineWidth = 2 * dpr;
      } else if (isBeatLine) {
        tCtx.strokeStyle = theme.gridBeatLine;
        tCtx.lineWidth = 1.5 * dpr;
      } else {
        tCtx.strokeStyle = theme.gridLine;
        tCtx.lineWidth = 1 * dpr;
        tCtx.setLineDash([3 * dpr, 3 * dpr]);
      }
      tCtx.beginPath();
      tCtx.moveTo(x, 0);
      tCtx.lineTo(x, tH);
      tCtx.stroke();
      tCtx.restore();
    }

    // Draw Tonal Notes
    for (let r = 0; r < rows; r++) {
      const midi = this.rowIndexToMidi(r);
      const noteColor = themeManager.getNoteColor(midi);
      const noteName = midiToNoteName(midi, false, false);

      for (let c = 0; c < cols; c++) {
        const isActive = this.tonalGrid[r][c];
        const isHovered = this.hoverCell && this.hoverCell.section === 'tonal' && this.hoverCell.row === r && this.hoverCell.col === c;

        if (!isActive && !isHovered) continue;

        let scale = 1;
        const popTime = this.notePopTimes.get(`t:${r},${c}`);
        if (popTime) {
          const elapsed = now - popTime;
          if (elapsed < 240) {
            scale = 1 + 0.22 * Math.sin((elapsed / 240) * Math.PI);
            hasActiveAnimation = true;
          } else {
            this.notePopTimes.delete(`t:${r},${c}`);
          }
        }

        const pad = 2 * dpr;
        const w = (cellW - pad * 2) * scale;
        const h = (cellH - pad * 2) * scale;
        const cx = (c + 0.5) * cellW;
        const cy = (r + 0.5) * cellH;

        tCtx.save();
        if (isActive) {
          tCtx.fillStyle = noteColor;
          if (this.isPlaying && this.currentStep === c) {
            tCtx.shadowColor = noteColor;
            tCtx.shadowBlur = 16 * dpr;
          }
        } else {
          tCtx.fillStyle = themeManager.getNoteColor(midi, 0.38);
        }

        this.roundRect(tCtx, cx - w / 2, cy - h / 2, w, h, 4 * dpr);
        tCtx.fill();

        if (isActive && this.showNoteLabels && cellH >= 15 * dpr && cellW >= 18 * dpr) {
          tCtx.fillStyle = '#ffffff';
          tCtx.font = `700 ${Math.min(11 * dpr, cellH * 0.52)}px system-ui, -apple-system, sans-serif`;
          tCtx.textAlign = 'center';
          tCtx.textBaseline = 'middle';
          tCtx.shadowColor = 'rgba(0,0,0,0.45)';
          tCtx.shadowBlur = 2 * dpr;
          tCtx.fillText(noteName, cx, cy + 0.5 * dpr);
        }
        tCtx.restore();
      }

      if (this.showNoteLabels && cellH >= 14 * dpr) {
        tCtx.save();
        tCtx.fillStyle = theme.textSecondary;
        tCtx.globalAlpha = 0.55;
        tCtx.font = `600 ${Math.min(10 * dpr, cellH * 0.48)}px system-ui, sans-serif`;
        tCtx.textAlign = 'left';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(noteName, 5 * dpr, (r + 0.5) * cellH);
        tCtx.restore();
      }
    }

    // Keyboard Cursor
    if (this.cursor.active && this.cursor.section === 'tonal') {
      tCtx.save();
      tCtx.strokeStyle = theme.accent;
      tCtx.lineWidth = 2.5 * dpr;
      this.roundRect(
        tCtx,
        this.cursor.col * cellW + 2 * dpr,
        this.cursor.row * cellH + 2 * dpr,
        cellW - 4 * dpr,
        cellH - 4 * dpr,
        4 * dpr
      );
      tCtx.stroke();
      tCtx.restore();
    }

    // Render Tonal Particles
    for (const p of this.particles) {
      if (p.section !== 'tonal') continue;
      tCtx.save();
      tCtx.fillStyle = p.color;
      tCtx.globalAlpha = p.alpha;
      tCtx.beginPath();
      tCtx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.restore();
    }

    // 2. Render Percussion Grid Canvas (2 or 3 rows)
    const dCtx = this.drumCanvas.getContext('2d');
    const dW = this.drumCanvas.width;
    const dH = this.drumCanvas.height;
    const dRows = this.drumRows;
    const dCellW = dW / cols;
    const dCellH = dH / dRows;

    dCtx.clearRect(0, 0, dW, dH);

    for (let col = 0; col < cols; col++) {
      const barIdx = Math.floor(col / stepsPerBar);
      dCtx.fillStyle = barIdx % 2 === 0 ? theme.bgCanvas : theme.bgCanvasAlt;
      dCtx.fillRect(col * dCellW, 0, dCellW + 0.5, dH);
    }

    if (this.isPlaying && this.currentStep >= 0) {
      dCtx.fillStyle = theme.mode === 'light'
        ? 'rgba(56, 189, 248, 0.18)'
        : 'rgba(56, 189, 248, 0.12)';
      dCtx.fillRect(this.currentStep * dCellW, 0, dCellW, dH);
    }

    // Percussion Grid lines
    for (let r = 0; r <= dRows; r++) {
      const y = Math.round(r * dCellH) + 0.5;
      dCtx.strokeStyle = r === 0 ? theme.gridBarLine : theme.gridLine;
      dCtx.lineWidth = r === 0 ? 2 * dpr : 1 * dpr;
      dCtx.beginPath();
      dCtx.moveTo(0, y);
      dCtx.lineTo(dW, y);
      dCtx.stroke();
    }

    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * dCellW) + 0.5;
      const isBarLine = c % stepsPerBar === 0;
      const isBeatLine = c % stepsPerBeat === 0;
      dCtx.save();
      if (isBarLine) {
        dCtx.strokeStyle = theme.gridBarLine;
        dCtx.lineWidth = 2 * dpr;
      } else if (isBeatLine) {
        dCtx.strokeStyle = theme.gridBeatLine;
        dCtx.lineWidth = 1.5 * dpr;
      } else {
        dCtx.strokeStyle = theme.gridLine;
        dCtx.lineWidth = 1 * dpr;
        dCtx.setLineDash([3 * dpr, 3 * dpr]);
      }
      dCtx.beginPath();
      dCtx.moveTo(x, 0);
      dCtx.lineTo(x, dH);
      dCtx.stroke();
      dCtx.restore();
    }

    // Draw Percussion Glyphs (Triangle, Diamond, Circle)
    for (let r = 0; r < dRows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * dCellW;
        const cy = (r + 0.5) * dCellH;
        const isActive = this.drumGrid[r] && this.drumGrid[r][c];
        const isHovered = this.hoverCell && this.hoverCell.section === 'drum' && this.hoverCell.row === r && this.hoverCell.col === c;

        if (!isActive && !isHovered) {
          dCtx.fillStyle = theme.gridBeatLine;
          dCtx.beginPath();
          dCtx.arc(cx, cy, 2.2 * dpr, 0, Math.PI * 2);
          dCtx.fill();
          continue;
        }

        let scale = 1;
        const popTime = this.notePopTimes.get(`d:${r},${c}`);
        if (popTime) {
          const elapsed = now - popTime;
          if (elapsed < 240) {
            scale = 1 + 0.28 * Math.sin((elapsed / 240) * Math.PI);
            hasActiveAnimation = true;
          } else {
            this.notePopTimes.delete(`d:${r},${c}`);
          }
        }

        const radius = Math.min(dCellW, dCellH) * 0.35 * scale;
        dCtx.save();
        dCtx.fillStyle = isActive ? theme.accent : themeManager.hexToRgba(theme.accent, 0.45);
        if (isActive && this.isPlaying && this.currentStep === c) {
          dCtx.shadowColor = theme.accent;
          dCtx.shadowBlur = 14 * dpr;
        }

        if (dRows === 3) {
          if (r === 0) {
            // Row 0 = High Percussion: Upward Triangle
            dCtx.beginPath();
            dCtx.moveTo(cx, cy - radius);
            dCtx.lineTo(cx + radius * 0.95, cy + radius * 0.8);
            dCtx.lineTo(cx - radius * 0.95, cy + radius * 0.8);
            dCtx.closePath();
            dCtx.fill();
          } else if (r === 1) {
            // Row 1 = Mid Percussion: Diamond
            dCtx.beginPath();
            dCtx.moveTo(cx, cy - radius * 0.9);
            dCtx.lineTo(cx + radius * 0.9, cy);
            dCtx.lineTo(cx, cy + radius * 0.9);
            dCtx.lineTo(cx - radius * 0.9, cy);
            dCtx.closePath();
            dCtx.fill();
          } else {
            // Row 2 = Low Percussion: Solid Circle
            dCtx.beginPath();
            dCtx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
            dCtx.fill();
          }
        } else {
          if (r === 0) {
            dCtx.beginPath();
            dCtx.moveTo(cx, cy - radius);
            dCtx.lineTo(cx + radius * 0.95, cy + radius * 0.8);
            dCtx.lineTo(cx - radius * 0.95, cy + radius * 0.8);
            dCtx.closePath();
            dCtx.fill();
          } else {
            dCtx.beginPath();
            dCtx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
            dCtx.fill();
          }
        }
        dCtx.restore();
      }
    }

    if (this.cursor.active && this.cursor.section === 'drum') {
      dCtx.save();
      dCtx.strokeStyle = theme.accent;
      dCtx.lineWidth = 2.5 * dpr;
      this.roundRect(
        dCtx,
        this.cursor.col * dCellW + 2 * dpr,
        this.cursor.row * dCellH + 2 * dpr,
        dCellW - 4 * dpr,
        dCellH - 4 * dpr,
        4 * dpr
      );
      dCtx.stroke();
      dCtx.restore();
    }

    // Render Drum Particles
    for (const p of this.particles) {
      if (p.section !== 'drum') continue;
      dCtx.save();
      dCtx.fillStyle = p.color;
      dCtx.globalAlpha = p.alpha;
      dCtx.beginPath();
      dCtx.arc(p.x, p.y, p.size * dpr, 0, Math.PI * 2);
      dCtx.fill();
      dCtx.restore();
    }

    if (hasActiveAnimation) {
      requestAnimationFrame(() => this.render());
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* =========================================================================
     EXTRA Magic Creativity Tools (Arpeggiator, Beat Generator, Transpose, Flip)
     ========================================================================= */
  initMagicModal() {
    const modal = document.getElementById('sm-magic-modal');
    const openBtn = document.getElementById('sm-magic-btn');
    const closeBtn = document.getElementById('sm-magic-close');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => modal.classList.add('open'));
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    // Arpeggiator / Melody Generator
    const arpBtn = document.getElementById('sm-magic-arp');
    if (arpBtn) {
      arpBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.generateArpeggio();
        modal.classList.remove('open');
      });
    }

    // Drum Groove Fill
    const drumFillBtn = document.getElementById('sm-magic-drums');
    if (drumFillBtn) {
      drumFillBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.generateDrumGroove();
        modal.classList.remove('open');
      });
    }

    // Transpose Up / Down
    const shiftUpBtn = document.getElementById('sm-magic-shift-up');
    const shiftDownBtn = document.getElementById('sm-magic-shift-down');
    if (shiftUpBtn) {
      shiftUpBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.shiftGridPitch(-1); // Shift up in pitch = move up in rows
      });
    }
    if (shiftDownBtn) {
      shiftDownBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.shiftGridPitch(1);  // Shift down in pitch = move down in rows
      });
    }

    // Invert Pitch & Reverse Time
    const invertBtn = document.getElementById('sm-magic-invert');
    const reverseBtn = document.getElementById('sm-magic-reverse');
    if (invertBtn) {
      invertBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.tonalGrid.reverse();
        this.render();
      });
    }
    if (reverseBtn) {
      reverseBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.tonalGrid.forEach(row => row.reverse());
        this.drumGrid.forEach(row => row.reverse());
        this.render();
      });
    }
  }

  shiftGridPitch(delta) {
    const numRows = this.tonalGrid.length;
    const numCols = this.totalCols;
    const nextGrid = Array.from({ length: numRows }, () => Array(numCols).fill(false));

    for (let r = 0; r < numRows; r++) {
      const targetRow = r + delta;
      if (targetRow >= 0 && targetRow < numRows) {
        for (let c = 0; c < numCols; c++) {
          nextGrid[targetRow][c] = this.tonalGrid[r][c];
        }
      }
    }
    this.tonalGrid = nextGrid;
    this.render();
  }

  generateArpeggio() {
    const numRows = this.tonalGrid.length;
    const numCols = this.totalCols;
    this.tonalGrid = Array.from({ length: numRows }, () => Array(numCols).fill(false));

    const pattern = [0, 2, 4, 7, 9, 7, 4, 2];
    for (let col = 0; col < numCols; col++) {
      const stepIdx = pattern[col % pattern.length];
      const row = Math.max(0, Math.min(numRows - 1, numRows - 1 - stepIdx));
      this.tonalGrid[row][col] = true;
      // Add subtle harmonic root on beat downbeats
      if (col % 8 === 0) {
        this.tonalGrid[numRows - 1][col] = true;
      }
    }
    this.render();
  }

  generateDrumGroove() {
    const numCols = this.totalCols;
    const dRows = this.drumRows;
    this.drumGrid = Array.from({ length: dRows }, () => Array(numCols).fill(false));

    if (dRows === 3) {
      for (let c = 0; c < numCols; c++) {
        // High = Hi-hat on every 8th note
        if (c % 2 === 0) this.drumGrid[0][c] = true;
        // Mid = Snare on beats 2 and 4 (steps 2, 6 of 8)
        if (c % 4 === 2) this.drumGrid[1][c] = true;
        // Low = Kick on 1 and syncopated 3&
        if (c % 8 === 0 || c % 8 === 5) this.drumGrid[2][c] = true;
      }
    } else {
      for (let c = 0; c < numCols; c++) {
        if (c % 4 === 2) this.drumGrid[0][c] = true; // Snare
        if (c % 4 === 0) this.drumGrid[1][c] = true; // Kick
      }
    }
    this.render();
  }

  initSettingsModal() {
    const modal = document.getElementById('sm-settings-modal');
    const closeBtn = document.getElementById('sm-settings-close');
    const applyBtn = document.getElementById('sm-settings-apply');

    if (this.settingsBtn && modal) {
      this.settingsBtn.addEventListener('click', () => {
        document.getElementById('sm-opt-bars').value = this.settings.bars;
        document.getElementById('sm-opt-beats').value = this.settings.beats;
        document.getElementById('sm-opt-split').value = this.settings.splitBeats;
        document.getElementById('sm-opt-scale').value = this.settings.scale;
        document.getElementById('sm-opt-root').value = this.settings.rootPitch;
        document.getElementById('sm-opt-octave-start').value = this.settings.rootOctave;
        document.getElementById('sm-opt-range').value = this.settings.octaves;
        const drumRowSelect = document.getElementById('sm-opt-drum-rows');
        if (drumRowSelect) drumRowSelect.value = this.settings.drumRowCount;
        modal.classList.add('open');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    if (applyBtn && modal) {
      applyBtn.addEventListener('click', () => {
        this.saveUndoSnapshot();
        this.settings.bars = Math.max(1, Math.min(16, parseInt(document.getElementById('sm-opt-bars').value, 10) || 4));
        this.settings.beats = Math.max(2, Math.min(7, parseInt(document.getElementById('sm-opt-beats').value, 10) || 4));
        this.settings.splitBeats = Math.max(1, Math.min(4, parseInt(document.getElementById('sm-opt-split').value, 10) || 2));
        this.settings.scale = document.getElementById('sm-opt-scale').value;
        this.settings.rootPitch = parseInt(document.getElementById('sm-opt-root').value, 10) || 0;
        this.settings.rootOctave = parseInt(document.getElementById('sm-opt-octave-start').value, 10) || 4;
        this.settings.octaves = Math.max(1, Math.min(3, parseInt(document.getElementById('sm-opt-range').value, 10) || 2));

        const drumRowSelect = document.getElementById('sm-opt-drum-rows');
        if (drumRowSelect) {
          this.settings.drumRowCount = parseInt(drumRowSelect.value, 10) || 3;
        }

        this.rebuildGrid(true);
        if (this.isPlaying) this.restartLoopTimer();
        modal.classList.remove('open');
      });
    }
  }

  initSaveModal() {
    const modal = document.getElementById('sm-save-modal');
    const closeBtn = document.getElementById('sm-save-close');
    const wavBtn = document.getElementById('sm-export-wav');
    const midiBtn = document.getElementById('sm-export-midi');
    const copyJsonBtn = document.getElementById('sm-copy-json');
    const jsonTextarea = document.getElementById('sm-json-code');
    const loadJsonBtn = document.getElementById('sm-load-json');
    const shareBtn = document.getElementById('sm-share-btn');
    const shareUrl = document.getElementById('sm-share-url');
    const shareStatus = document.getElementById('sm-share-status');
    let sharedFor = null; // song JSON the current share link was made for

    if (this.saveBtn && modal) {
      this.saveBtn.addEventListener('click', () => {
        const json = JSON.stringify(this.getSongData());
        if (jsonTextarea) {
          jsonTextarea.value = json;
        }
        // A link made earlier still fits only if the song hasn't changed since
        if (shareUrl && json !== sharedFor) {
          shareUrl.value = '';
          if (shareStatus) shareStatus.textContent = '';
        }
        modal.classList.add('open');
      });
    }

    if (shareBtn && shareUrl) {
      shareBtn.addEventListener('click', async () => {
        const data = this.getSongData();
        const json = JSON.stringify(data);
        shareBtn.disabled = true;
        if (shareStatus) shareStatus.textContent = 'Making your link…';
        const url = await createSongShortLink(data);
        shareBtn.disabled = false;
        if (!url) {
          if (shareStatus) shareStatus.textContent = 'Couldn\'t make a link right now. You can still copy the Song Data below.';
          return;
        }
        sharedFor = json;
        shareUrl.value = url;
        shareUrl.select();
        try {
          await navigator.clipboard.writeText(url);
          if (shareStatus) shareStatus.textContent = 'Link copied! Paste it anywhere to share your song.';
        } catch {
          if (shareStatus) shareStatus.textContent = 'Here\'s your link: copy it to share your song.';
        }
      });
      shareUrl.addEventListener('focus', () => shareUrl.select());
    }

    // Opening a share link (…/chromeextra/?s=abc123) loads that song into Song Maker.
    this.openSharedSongFromUrl();

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    if (wavBtn) {
      wavBtn.addEventListener('click', async () => {
        wavBtn.textContent = 'Rendering WAV...';
        wavBtn.disabled = true;
        try {
          const blob = await audioEngine.exportSongMakerWav({
            totalCols: this.totalCols,
            stepDurationSec: this.getStepDurationSec(),
            instrument: this.currentInstrument,
            drumKit: this.currentDrumKit,
            tonalGrid: this.tonalGrid,
            drumGrid: this.drumGrid,
            drumRowCount: this.drumRows,
            rowIndexToMidi: (r) => this.rowIndexToMidi(r)
          });
          this.triggerDownload(blob, 'chrome-music-lab-extra-song.wav');
        } finally {
          wavBtn.textContent = 'Download WAV Audio (.wav)';
          wavBtn.disabled = false;
        }
      });
    }

    if (midiBtn) {
      midiBtn.addEventListener('click', () => {
        const blob = audioEngine.exportSongMakerMidi({
          totalCols: this.totalCols,
          bpm: this.settings.bpm,
          splitBeats: this.settings.splitBeats,
          tonalGrid: this.tonalGrid,
          drumGrid: this.drumGrid,
          drumRowCount: this.drumRows,
          rowIndexToMidi: (r) => this.rowIndexToMidi(r)
        });
        this.triggerDownload(blob, 'chrome-music-lab-extra-song.mid');
      });
    }

    if (copyJsonBtn && jsonTextarea) {
      copyJsonBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(jsonTextarea.value);
        copyJsonBtn.textContent = 'Copied to Clipboard!';
        setTimeout(() => { copyJsonBtn.textContent = 'Copy Song Data'; }, 1600);
      });
    }

    if (loadJsonBtn && jsonTextarea && modal) {
      loadJsonBtn.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(jsonTextarea.value);
          if (this.applySongData(parsed)) {
            modal.classList.remove('open');
          }
        } catch (err) {
          alert('Invalid Song JSON format.');
        }
      });
    }
  }

  getSongData() {
    return {
      settings: this.settings,
      tonalGrid: this.tonalGrid,
      drumGrid: this.drumGrid
    };
  }

  /** Load a song saved by getSongData(). Returns false if it isn't a Song Maker song. */
  applySongData(parsed) {
    if (!parsed || !parsed.settings || !Array.isArray(parsed.tonalGrid)) return false;
    this.saveUndoSnapshot();
    this.settings = { ...this.settings, ...parsed.settings };
    this.computeScaleNotes();
    this.tonalGrid = parsed.tonalGrid;
    this.drumGrid = parsed.drumGrid || [[], [], []];
    if (this.tempoSlider) this.tempoSlider.value = this.settings.bpm;
    if (this.tempoValue) this.tempoValue.textContent = this.settings.bpm;
    this.updateInstrumentButtons();
    this.resizeCanvases();
    return true;
  }

  async openSharedSongFromUrl() {
    const slug = new URLSearchParams(location.search).get('s');
    if (!slug || !/^[A-Za-z0-9]{4,12}$/.test(slug)) return;
    if (location.hash !== '#song-maker') location.hash = 'song-maker';
    const record = await fetchSharedSong(slug);
    if (!record || record.app_type !== SHARE_APP_TYPE || !this.applySongData(record.payload)) {
      alert('Sorry, that song link didn\'t work. It may have been typed wrong.');
    }
  }

  triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  loadStarterMelody() {
    this.loadPresetSong('synthwave-arp', false);
  }

  loadPresetSong(presetId, recordUndo = true) {
    if (recordUndo) this.saveUndoSnapshot();

    this.settings.bars = 4;
    this.settings.beats = 4;
    this.settings.splitBeats = 2;
    this.settings.scale = 'major';
    this.settings.rootPitch = 0;
    this.settings.rootOctave = 4;
    this.settings.octaves = 2;
    this.settings.drumRowCount = 3;
    this.rebuildGrid(false);

    const setMidi = (col, midi) => {
      const row = this.scaleMidiNotes.indexOf(midi);
      if (row !== -1 && col < this.totalCols) {
        this.tonalGrid[row][col] = true;
      }
    };

    if (presetId === 'synthwave-arp') {
      this.settings.bpm = 128;
      this.settings.instrumentIndex = 5; // 8-Bit Retro
      this.settings.drumKitIndex = 0;    // Electronic
      const arp = [
        69, 72, 76, 81, 76, 72, 69, 72,
        65, 69, 72, 77, 72, 69, 65, 69,
        60, 64, 67, 72, 67, 64, 60, 64,
        67, 71, 74, 79, 74, 71, 67, 71
      ];
      arp.forEach((m, c) => setMidi(c, m));
      for (let c = 0; c < 32; c++) {
        // High hi-hats
        if (c % 2 === 0) this.drumGrid[0][c] = true;
        // Mid snare
        if (c % 4 === 2) this.drumGrid[1][c] = true;
        // Low kick
        if (c % 4 === 0 || (c % 8 === 7)) this.drumGrid[2][c] = true;
      }
    } else if (presetId === 'kalimba-rain') {
      this.settings.scale = 'pentatonic';
      this.settings.bpm = 115;
      this.settings.instrumentIndex = 6; // Kalimba
      this.settings.drumKitIndex = 3;    // Conga / Bongo
      this.rebuildGrid(false);
      const kalimbaNotes = [72, 76, 79, 81, 84, 79, 76, 74, 72, 67, 69, 72, 76, 74, 69, 67];
      kalimbaNotes.forEach((m, i) => {
        setMidi(i * 2, m);
        if (i % 2 === 0) setMidi(i * 2 + 1, m + 4);
      });
      for (let c = 0; c < 32; c++) {
        if (c % 2 === 0) this.drumGrid[0][c] = true;
        if ([2, 6].includes(c % 8)) this.drumGrid[1][c] = true;
        if ([0, 3].includes(c % 8)) this.drumGrid[2][c] = true;
      }
    } else if (presetId === 'blues-jam') {
      this.settings.scale = 'blues';
      this.settings.bpm = 104;
      this.settings.instrumentIndex = 7; // Brass Fanfare
      this.settings.drumKitIndex = 2;    // Acoustic Kit
      this.rebuildGrid(false);
      const riffs = [60, 63, 65, 66, 67, 70, 72, 70, 67, 66, 65, 63];
      riffs.forEach((m, i) => {
        setMidi(i * 2, m);
      });
      for (let c = 0; c < 32; c++) {
        if (c % 2 === 0) this.drumGrid[0][c] = true;
        if (c % 4 === 2) this.drumGrid[1][c] = true;
        if (c % 4 === 0) this.drumGrid[2][c] = true;
      }
    } else if (presetId === 'caribbean-breeze') {
      this.settings.bpm = 126;
      this.settings.instrumentIndex = 8; // Steelpan
      this.settings.drumKitIndex = 5;    // Latin Party
      const pattern = [72, 74, 76, 79, 76, 74, 72, 76, 74, 72, 67, 72];
      pattern.forEach((m, i) => setMidi(i * 2, m));
      for (let c = 0; c < 32; c++) {
        if (c % 4 === 1 || c % 4 === 3) this.drumGrid[0][c] = true; // Cowbell
        if (c % 4 === 2) this.drumGrid[1][c] = true;                // Clave
        if (c % 4 === 0) this.drumGrid[2][c] = true;                // Low drum
      }
    } else if (presetId === 'ode-to-joy') {
      this.settings.bpm = 120;
      this.settings.instrumentIndex = 0; // Marimba
      this.settings.drumKitIndex = 0;    // Electronic
      const melody = [
        [0, 64], [2, 64], [4, 65], [6, 67],
        [8, 67], [10, 65], [12, 64], [14, 62],
        [16, 60], [18, 60], [20, 62], [22, 64],
        [24, 64], [27, 62], [28, 62]
      ];
      const bass = [
        [0, 72], [4, 71], [8, 69], [12, 67],
        [16, 65], [20, 64], [24, 62], [28, 60]
      ];
      melody.forEach(([c, m]) => setMidi(c, m + 12));
      bass.forEach(([c, m]) => setMidi(c, m - 12));
      for (let c = 0; c < 32; c += 2) {
        if (c % 4 === 0) this.drumGrid[2][c] = true;
        if (c % 4 === 2) this.drumGrid[1][c] = true;
      }
    } else if (presetId === 'twinkle') {
      this.settings.bpm = 112;
      this.settings.instrumentIndex = 9; // Music Box
      this.settings.drumKitIndex = 6;    // Lo-Fi
      const notes = [
        [0, 60], [2, 60], [4, 67], [6, 67], [8, 69], [10, 69], [12, 67],
        [16, 65], [18, 65], [20, 64], [22, 64], [24, 62], [26, 62], [28, 60]
      ];
      notes.forEach(([c, m]) => {
        setMidi(c, m + 12);
        if (c % 4 === 0) setMidi(c, 60);
      });
      for (let c = 0; c < 32; c += 4) {
        this.drumGrid[2][c] = true;
        this.drumGrid[1][c + 2] = true;
      }
    }

    if (this.tempoSlider) this.tempoSlider.value = this.settings.bpm;
    if (this.tempoValue) this.tempoValue.textContent = this.settings.bpm;
    this.updateInstrumentButtons();
    this.render();
  }
}
