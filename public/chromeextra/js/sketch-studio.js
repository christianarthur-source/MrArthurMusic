/**
 * Chrome Music Lab EXTRA — Sketch Studio Experiment
 * Reverse-engineered & inspired by Cymatics Sketch Max (AU / C++ JUCE architecture).
 * 
 * Features:
 * - 8 Authentic Art Mediums: Chalk, Marker, Crayon, Neon, Watercolor, Paint Splatter, Pencil, Spray Paint
 * - Thickness-to-Velocity: Stroke width dynamically controls note loudness & velocity (Thin = pp, Thick = ff)
 * - Playback Modes: Scan Mode (left-to-right sweep) and Trace Mode (path following)
 * - Articulation: Glide Mode (continuous portamento slide) vs Step Mode (scale retrigger)
 * - Musical Scales: Pentatonic, Major, Minor, Blues, Dorian, Chromatic with configurable Root & Octaves
 * - Interactive Canvas Themes: Chalkboard, Whiteboard, Neon Dark, Lined Paper, Blueprint
 * - FX Rack: Tone (filter cutoff), Decay (envelope release), Space (reverb wet), Delay (echo)
 * - Educational Presets: Bouncing Wave, Neon Skyline, Star Constellation, Raindrop Splatter, Smiling Face
 * - Artwork PNG Download & Offline WAV Audio Rendering
 */

import { audioEngine, midiToFreq, midiToNoteName, SCALES } from './audio-engine.js';
import { themeManager } from './theme-palette.js';

export const SKETCH_MEDIUMS = [
  { id: 'chalk', name: 'Chalk', desc: 'Warm Rhodes tines, powdery textured strokes', defaultWidth: 14, color: '#e0e6ed' },
  { id: 'marker', name: 'Marker', desc: 'Punchy electric synth, bold rounded lines', defaultWidth: 12, color: '#00e5ff' },
  { id: 'crayon', name: 'Crayon', desc: 'Playful acoustic marimba, textured waxy lines', defaultWidth: 10, color: '#ffb300' },
  { id: 'neon', name: 'Neon', desc: 'Glowing analog saw lead, luminous laser bloom', defaultWidth: 8, color: '#ff007f' },
  { id: 'watercolor', name: 'Watercolor', desc: 'Ambient glass pad, translucent blending washes', defaultWidth: 20, color: '#00e676' },
  { id: 'splatter', name: 'Paint Splatter', desc: 'Kalimba chime bursts, dynamic droplets', defaultWidth: 16, color: '#d500f9' },
  { id: 'pencil', name: 'Pencil', desc: 'Delicate music box bell, crisp graphite grain', defaultWidth: 4, color: '#cfd8dc' },
  { id: 'spray', name: 'Spray Paint', desc: 'Shimmering airy synth, diffuse particle mist', defaultWidth: 24, color: '#76ff03' }
];

export const DRUM_GROOVES = {
  none: {
    id: 'none',
    name: 'No Beat (Off)',
    kit: 'electronic',
    pattern: {}
  },
  lofi: {
    id: 'lofi',
    name: '☕️ Lo-Fi Hip Hop',
    kit: 'lofi',
    pattern: {
      low:  [0, 6, 10, 16, 22, 26],
      mid:  [8, 24],
      high: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
    }
  },
  dance: {
    id: 'dance',
    name: '⚡️ Four-on-the-Floor',
    kit: 'electronic',
    pattern: {
      low:  [0, 4, 8, 12, 16, 20, 24, 28],
      mid:  [8, 24],
      high: [2, 6, 10, 14, 18, 22, 26, 30]
    }
  },
  boombap: {
    id: 'boombap',
    name: '🎤 Classic Boom-Bap',
    kit: 'kit',
    pattern: {
      low:  [0, 5, 11, 16, 21, 27],
      mid:  [8, 24],
      high: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
    }
  },
  trap: {
    id: 'trap',
    name: '🔥 Trap 808',
    kit: 'electronic',
    pattern: {
      low:  [0, 7, 16, 22, 25],
      mid:  [8, 24],
      high: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 19, 20, 22, 24, 26, 28, 29, 30, 31]
    }
  },
  afrobeat: {
    id: 'afrobeat',
    name: '🌴 Afrobeats / Latin',
    kit: 'latin',
    pattern: {
      low:  [0, 6, 12, 16, 22, 28],
      mid:  [8, 20, 24],
      high: [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30]
    }
  },
  rock: {
    id: 'rock',
    name: '🥁 Driving Rock Kit',
    kit: 'kit',
    pattern: {
      low:  [0, 6, 16, 22],
      mid:  [8, 24],
      high: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
    }
  }
};

export const SKETCH_THEMES = {
  chalkboard: {
    id: 'chalkboard',
    name: 'Chalkboard',
    bg: '#1c2321',
    grid: 'rgba(255, 255, 255, 0.06)',
    guide: 'rgba(255, 255, 255, 0.16)',
    scanHead: '#00e5ff'
  },
  whiteboard: {
    id: 'whiteboard',
    name: 'Whiteboard',
    bg: '#f8fafc',
    grid: 'rgba(0, 0, 0, 0.05)',
    guide: 'rgba(0, 0, 0, 0.14)',
    scanHead: '#d50000'
  },
  neon: {
    id: 'neon',
    name: 'Neon Dark',
    bg: '#080812',
    grid: 'rgba(0, 229, 255, 0.09)',
    guide: 'rgba(255, 0, 127, 0.2)',
    scanHead: '#00ffff'
  },
  notebook: {
    id: 'notebook',
    name: 'Lined Paper',
    bg: '#fbf9f1',
    grid: 'rgba(70, 130, 180, 0.08)',
    guide: 'rgba(70, 130, 180, 0.26)',
    scanHead: '#e91e63'
  },
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint',
    bg: '#0a2540',
    grid: 'rgba(0, 212, 255, 0.14)',
    guide: 'rgba(255, 255, 255, 0.3)',
    scanHead: '#ffe600'
  }
};

export class SketchStudioApp {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.width = 800;
    this.height = 450;
    this.strokes = []; // { id, medium, width, points: [{x, y, p}], color, isSplatter }
    this.redoStack = [];
    this.activeStroke = null;
    this.isDrawing = false;
    this.tool = 'draw'; // 'draw', 'eraser'

    // Parameters
    this.currentMedium = 'chalk';
    this.penWidth = 14;
    this.theme = 'chalkboard';
    this.mode = 'scan'; // 'scan', 'trace'
    this.articulation = 'step'; // 'step', 'glide'
    this.scaleName = 'pentatonic';
    this.rootMidi = 60; // C4
    this.octaves = 2;
    this.showGuides = true;
    this.bpm = 100;

    // Add a Beat! Drum Groove Engine
    this.beatGroove = 'lofi';
    this.beatVolume = 0.75;
    this.lastBeatStep = -1;

    // FX
    this.fx = {
      tone: 0.65,
      decay: 0.5,
      space: 0.35,
      delay: 0,
      chorus: false
    };

    // Playback state
    this.isPlaying = false;
    this.playheadPos = 0; // 0 to 1
    this.lastFrameTime = 0;
    this.animId = null;
    this.activeHits = []; // { x, y, time, color, radius }
    this.glideVoices = new Map();

    this.initDOM();
  }

  initDOM() {
    this.canvas = document.getElementById('sketch-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Make sure container has a defined minimum height
    const container = this.canvas.parentElement;
    if (container && container.clientHeight < 200) {
      container.style.minHeight = '360px';
    }

    this.setupCanvasSize();
    window.addEventListener('resize', () => {
      this.setupCanvasSize();
      this.redraw();
    });

    this.initCanvasEvents();
    this.initControls();
    this.initKeyboardShortcuts();
    this.redraw();
  }

  setupCanvasSize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Ensure safe positive dimensions
    this.width = Math.max(rect.width > 0 ? rect.width : (this.canvas.parentElement?.clientWidth || 800), 320);
    this.height = Math.max(rect.height > 0 ? rect.height : (this.canvas.parentElement?.clientHeight || 450), 220);

    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);

    // Reset transform matrix before applying high-DPR scale
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initCanvasEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;
      const pressure = (e.pressure && e.pressure > 0) ? e.pressure : 1;
      return {
        x: Math.max(0, Math.min(this.width, clientX - rect.left)),
        y: Math.max(0, Math.min(this.height, clientY - rect.top)),
        p: pressure
      };
    };

    // Using Pointer Events for unified Mouse, Stylus/Pen & Touch handling
    const onPointerDown = (e) => {
      audioEngine.resumeAudioContext();

      this.isDrawing = true;
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch (err) {}

      const pos = getPos(e);

      if (e.button === 2) {
        // Right-click temporary eraser
        this.tool = 'eraser';
      }

      if (this.tool === 'eraser') {
        this.eraseAt(pos.x, pos.y);
        return;
      }

      this.lastDrawnMidi = Math.round(this.yToMidi(pos.y));
      const strokeColor = this.getNoteColorForY(pos.y);

      if (this.currentMedium === 'splatter') {
        this.createSplatterAt(pos.x, pos.y, this.penWidth, strokeColor);
        this.playLivePreviewNote(pos.y, this.penWidth);
        return;
      }

      this.activeStroke = {
        id: 's_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        medium: this.currentMedium,
        width: this.penWidth,
        color: strokeColor,
        points: [pos]
      };
      this.strokes.push(this.activeStroke);
      this.redoStack = [];

      this.playLivePreviewNote(pos.y, this.penWidth);
      this.redraw();
    };

    const onPointerMove = (e) => {
      if (!this.isDrawing) return;
      e.preventDefault(); // prevent touch scroll only while active drawing
      const pos = getPos(e);

      if (this.tool === 'eraser') {
        this.eraseAt(pos.x, pos.y);
        return;
      }

      if (this.activeStroke) {
        const lastPt = this.activeStroke.points[this.activeStroke.points.length - 1];
        const dist = Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y);
        if (dist >= 3) {
          this.activeStroke.points.push(pos);
          
          const currentMidi = this.yToMidi(pos.y);
          if (this.articulation === 'glide') {
            this.playLivePreviewNote(pos.y, this.penWidth);
          } else if (Math.round(currentMidi) !== this.lastDrawnMidi) {
            // Audition each new scale note as the user sketches across pitches!
            this.lastDrawnMidi = Math.round(currentMidi);
            this.playLivePreviewNote(pos.y, this.penWidth);
          }
          this.redraw();
        }
      }
    };

    const onPointerUp = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this.activeStroke = null;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch (err) {}

      if (this.tool === 'eraser' && e && e.button === 2) {
        this.tool = 'draw';
      }
      this.redraw();
    };

    // Global user unlock on any user interaction
    const unlock = () => {
      audioEngine.resumeAudioContext();
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });

    this.canvas.addEventListener('pointerdown', onPointerDown);
    this.canvas.addEventListener('pointermove', onPointerMove);
    this.canvas.addEventListener('pointerup', onPointerUp);
    this.canvas.addEventListener('pointercancel', onPointerUp);

    // Fallback mouse & touch listeners for WebKit / Safari
    this.canvas.addEventListener('mousedown', () => {
      audioEngine.resumeAudioContext();
    });
    this.canvas.addEventListener('touchstart', () => {
      audioEngine.resumeAudioContext();
    }, { passive: true });

    // Disable right-click context menu on canvas for right-click erase
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  eraseAt(x, y, radius = 24) {
    const beforeCount = this.strokes.length;
    this.strokes = this.strokes.filter(stroke => {
      return !stroke.points.some(pt => Math.hypot(pt.x - x, pt.y - y) < radius);
    });
    if (this.strokes.length !== beforeCount) {
      this.redraw();
    }
  }

  createSplatterAt(x, y, baseWidth, color) {
    const dropletCount = 6 + Math.floor(Math.random() * 8);
    const splatterPoints = [{ x, y, r: baseWidth * 0.7 }];

    for (let i = 0; i < dropletCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (baseWidth * 0.5) + Math.random() * (baseWidth * 2.5);
      const r = Math.max(2, (baseWidth * 0.25) * Math.random());
      splatterPoints.push({
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        r
      });
    }

    const stroke = {
      id: 'splat_' + Date.now(),
      medium: 'splatter',
      width: baseWidth,
      color,
      isSplatter: true,
      points: splatterPoints
    };
    this.strokes.push(stroke);
    this.redoStack = [];
    this.redraw();
  }

  getNoteColorForY(y) {
    const midi = this.yToMidi(y);
    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
    if (themeManager && typeof themeManager.getNoteColor === 'function') {
      return themeManager.getNoteColor(pitchClass);
    }
    const defaultColors = [
      '#E33059', '#F75839', '#F7943D', '#F3B72F',
      '#EDD929', '#95C631', '#56A754', '#11826D',
      '#3160A3', '#5B37CC', '#A347BF', '#EA57B2'
    ];
    return defaultColors[pitchClass] || '#00e5ff';
  }

  yToMidi(y) {
    const safeH = Math.max(this.height, 100);
    const norm = Math.max(0, Math.min(1, 1 - (y / safeH)));
    const totalSemitones = this.octaves * 12;
    const rawMidi = this.rootMidi + norm * totalSemitones;

    if (this.scaleName === 'chromatic') {
      return this.articulation === 'glide' ? rawMidi : Math.round(rawMidi);
    }

    // Snap to active scale degrees
    const scaleDegrees = SCALES[this.scaleName] || SCALES.pentatonic;
    const allScaleNotes = [];
    for (let oct = 0; oct <= this.octaves; oct++) {
      for (const deg of scaleDegrees) {
        allScaleNotes.push(this.rootMidi + oct * 12 + deg);
      }
    }

    let nearest = allScaleNotes[0];
    let minDiff = Infinity;
    for (const note of allScaleNotes) {
      const diff = Math.abs(note - rawMidi);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = note;
      }
    }
    return nearest;
  }

  midiToY(midi) {
    const safeH = Math.max(this.height, 100);
    const totalSemitones = this.octaves * 12;
    const norm = (midi - this.rootMidi) / totalSemitones;
    return (1 - Math.max(0, Math.min(1, norm))) * safeH;
  }

  playLivePreviewNote(y, width) {
    const midi = this.yToMidi(y);
    const velocity = Math.max(0.3, Math.min(1.2, width / 20));
    audioEngine.resumeAudioContext();
    audioEngine.playSketchNote(this.currentMedium, midi, 0.35, 0, velocity, this.fx);
  }

  initControls() {
    // Medium buttons
    const mediumButtons = document.querySelectorAll('.sketch-medium-btn');
    mediumButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mediumId = btn.getAttribute('data-medium');
        this.setMedium(mediumId);
      });
    });

    // Pen thickness slider
    const thicknessSlider = document.getElementById('sketch-pen-width');
    const thicknessVal = document.getElementById('sketch-pen-width-val');
    if (thicknessSlider) {
      thicknessSlider.value = this.penWidth;
      thicknessSlider.addEventListener('input', (e) => {
        this.penWidth = parseInt(e.target.value, 10);
        if (thicknessVal) thicknessVal.textContent = `${this.penWidth}px`;
      });
      // Double-click resets to medium (12px)
      thicknessSlider.addEventListener('dblclick', () => {
        this.penWidth = 12;
        thicknessSlider.value = 12;
        if (thicknessVal) thicknessVal.textContent = '12px (Medium)';
      });
    }

    // Play / Pause button
    const playBtn = document.getElementById('sketch-play-btn');
    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlay());
    }

    // Clear Canvas
    const clearBtn = document.getElementById('sketch-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearCanvas());
    }

    // Undo / Redo
    const undoBtn = document.getElementById('sketch-undo-btn');
    const redoBtn = document.getElementById('sketch-redo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
    if (redoBtn) redoBtn.addEventListener('click', () => this.redo());

    // Tools: Draw / Eraser
    const drawToolBtn = document.getElementById('sketch-tool-draw');
    const eraserToolBtn = document.getElementById('sketch-tool-eraser');
    if (drawToolBtn) {
      drawToolBtn.addEventListener('click', () => {
        this.tool = 'draw';
        drawToolBtn.classList.add('active');
        if (eraserToolBtn) eraserToolBtn.classList.remove('active');
      });
    }
    if (eraserToolBtn) {
      eraserToolBtn.addEventListener('click', () => {
        this.tool = 'eraser';
        eraserToolBtn.classList.add('active');
        if (drawToolBtn) drawToolBtn.classList.remove('active');
      });
    }

    // Articulation: Glide vs Step
    const articSelect = document.getElementById('sketch-artic-select');
    if (articSelect) {
      articSelect.addEventListener('change', (e) => {
        this.articulation = e.target.value;
      });
    }

    // Theme selector
    const themeSelect = document.getElementById('sketch-theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        this.theme = e.target.value;
        this.redraw();
      });
    }

    // Scale selector
    const scaleSelect = document.getElementById('sketch-scale-select');
    if (scaleSelect) {
      scaleSelect.addEventListener('change', (e) => {
        this.scaleName = e.target.value;
        this.redraw();
      });
    }

    // Octaves
    const octavesSelect = document.getElementById('sketch-octaves-select');
    if (octavesSelect) {
      octavesSelect.addEventListener('change', (e) => {
        this.octaves = parseInt(e.target.value, 10);
        this.redraw();
      });
    }

    // Tempo Slider
    const tempoSlider = document.getElementById('sketch-bpm-slider');
    const tempoVal = document.getElementById('sketch-bpm-val');
    if (tempoSlider) {
      tempoSlider.addEventListener('input', (e) => {
        this.bpm = parseInt(e.target.value, 10);
        if (tempoVal) tempoVal.textContent = `${this.bpm} BPM`;
      });
    }

    // FX Sliders: Tone & Decay
    const toneSlider = document.getElementById('sketch-fx-tone');
    if (toneSlider) {
      toneSlider.addEventListener('input', (e) => {
        this.fx.tone = parseFloat(e.target.value);
      });
    }
    const decaySlider = document.getElementById('sketch-fx-decay');
    if (decaySlider) {
      decaySlider.addEventListener('input', (e) => {
        this.fx.decay = parseFloat(e.target.value);
      });
    }

    // Add a Beat! Groove selector
    const beatSelect = document.getElementById('sketch-beat-select');
    if (beatSelect) {
      beatSelect.value = this.beatGroove;
      beatSelect.addEventListener('change', (e) => {
        this.beatGroove = e.target.value;
        // Preview a kick when a groove is selected
        if (this.beatGroove !== 'none') {
          try {
            audioEngine.ensureContext();
            const kit = DRUM_GROOVES[this.beatGroove]?.kit || 'electronic';
            audioEngine.playSongMakerDrum(kit, 'low', 0, 0.9 * this.beatVolume);
          } catch (err) {}
        }
      });
    }

    const beatVolSlider = document.getElementById('sketch-beat-vol');
    if (beatVolSlider) {
      beatVolSlider.value = this.beatVolume;
      beatVolSlider.addEventListener('input', (e) => {
        this.beatVolume = parseFloat(e.target.value);
      });
    }

    // Guides toggle
    const guidesToggle = document.getElementById('sketch-toggle-guides');
    if (guidesToggle) {
      guidesToggle.addEventListener('change', (e) => {
        this.showGuides = e.target.checked;
        this.redraw();
      });
    }

    // Presets dropdown
    const presetsSelect = document.getElementById('sketch-preset-select');
    if (presetsSelect) {
      presetsSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.loadPreset(e.target.value);
          e.target.value = '';
        }
      });
    }

    // Test Audio button
    const testAudioBtn = document.getElementById('sketch-test-audio-btn');
    if (testAudioBtn) {
      testAudioBtn.addEventListener('click', () => {
        try {
          audioEngine.resumeAudioContext();
          const notes = [60, 64, 67, 72];
          notes.forEach((midi, i) => {
            audioEngine.playSketchNote(this.currentMedium, midi, 0.35, i * 0.12, 0.95, this.fx);
          });
          testAudioBtn.textContent = '🎶 Playing!';
          setTimeout(() => { testAudioBtn.textContent = '🔊 Test Sound'; }, 1000);
        } catch (err) {
          console.error('Audio test failed:', err);
        }
      });
    }

    // Export PNG
    const exportPngBtn = document.getElementById('sketch-export-png');
    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => this.exportArtworkPng());
    }

    // Export WAV Audio
    const exportWavBtn = document.getElementById('sketch-export-wav');
    if (exportWavBtn) {
      exportWavBtn.addEventListener('click', () => this.exportAudioWav());
    }
  }

  setMedium(mediumId) {
    this.currentMedium = mediumId;
    const mediumInfo = SKETCH_MEDIUMS.find(m => m.id === mediumId);
    if (mediumInfo) {
      this.penWidth = mediumInfo.defaultWidth;
      const thicknessSlider = document.getElementById('sketch-pen-width');
      const thicknessVal = document.getElementById('sketch-pen-width-val');
      if (thicknessSlider) thicknessSlider.value = this.penWidth;
      if (thicknessVal) thicknessVal.textContent = `${this.penWidth}px`;
    }

    document.querySelectorAll('.sketch-medium-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-medium') === mediumId);
    });

    // Audition the unique synth tone of the chosen medium
    try {
      audioEngine.ensureContext();
      audioEngine.playSketchNote(mediumId, 60, 0.35, 0, 0.85, this.fx);
    } catch (e) {}
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const view = document.getElementById('view-sketch-studio');
      // If inside Hub, only run when view is active. If on standalone page, always run.
      if (view && !view.classList.contains('active')) return;

      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.key === 'd' || e.key === 'D') {
        this.tool = 'draw';
        document.getElementById('sketch-tool-draw')?.classList.add('active');
        document.getElementById('sketch-tool-eraser')?.classList.remove('active');
      } else if (e.key === 'e' || e.key === 'E') {
        this.tool = 'eraser';
        document.getElementById('sketch-tool-eraser')?.classList.add('active');
        document.getElementById('sketch-tool-draw')?.classList.remove('active');
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        this.clearCanvas();
      } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.undo();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        this.redo();
      }
    });
  }

  clearCanvas() {
    if (this.strokes.length === 0) return;
    this.redoStack.push([...this.strokes]);
    this.strokes = [];
    this.redraw();
  }

  undo() {
    if (this.strokes.length === 0) return;
    const removed = this.strokes.pop();
    this.redoStack.push(removed);
    this.redraw();
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const restored = this.redoStack.pop();
    if (Array.isArray(restored)) {
      this.strokes = restored;
    } else {
      this.strokes.push(restored);
    }
    this.redraw();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  play() {
    audioEngine.resumeAudioContext();
    this.isPlaying = true;
    this.lastFrameTime = performance.now();
    this.lastBeatStep = -1;

    const playBtn = document.getElementById('sketch-play-btn');
    if (playBtn) {
      playBtn.classList.add('playing');
      playBtn.innerHTML = '<span>⏸</span><span>Stop</span>';
    }

    this.runPlaybackLoop();
  }

  stop() {
    this.isPlaying = false;
    this.lastBeatStep = -1;
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.activeHits = [];

    this.glideVoices.forEach((voice) => {
      audioEngine.stopGlideVoice(voice, 0.05);
    });
    this.glideVoices.clear();

    const playBtn = document.getElementById('sketch-play-btn');
    if (playBtn) {
      playBtn.classList.remove('playing');
      playBtn.innerHTML = '<span>▶</span><span>Play</span>';
    }
    this.redraw();
  }

  runPlaybackLoop() {
    const loop = (now) => {
      if (!this.isPlaying) return;

      const delta = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      const totalBeats = 8;
      const secondsPerLoop = (60 / this.bpm) * totalBeats;
      const progressDelta = delta / secondsPerLoop;

      const prevPos = this.playheadPos;
      this.playheadPos = (this.playheadPos + progressDelta) % 1.0;

      // Synchronized "Add a Beat!" drum groove in exact tempo/meter
      const currStep = Math.floor(this.playheadPos * 32);
      if (currStep !== this.lastBeatStep) {
        this.lastBeatStep = currStep;
        if (this.beatGroove !== 'none') {
          this.triggerBeatStep(currStep);
        }
      }

      this.checkPlayheadIntersections(prevPos, this.playheadPos);

      this.activeHits = this.activeHits.filter(h => now - h.time < 500);

      this.redraw();
      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  }

  checkPlayheadIntersections(prevNormX, currNormX) {
    const prevX = prevNormX * this.width;
    const currX = currNormX * this.width;
    const wrapped = currX < prevX;
    const now = performance.now();
    this.strokeTriggerTimes = this.strokeTriggerTimes || new Map();

    for (const stroke of this.strokes) {
      if (stroke.isSplatter) {
        for (const pt of stroke.points) {
          const inRange = wrapped ? (pt.x >= prevX || pt.x <= currX) : (pt.x >= prevX && pt.x <= currX);
          if (inRange) {
            this.triggerStrokeNote(stroke, pt.y, pt.x, pt.r || stroke.width);
          }
        }
        continue;
      }

      // Check single point click
      if (stroke.points.length === 1) {
        const pt = stroke.points[0];
        const inRange = wrapped ? (pt.x >= prevX || pt.x <= currX) : (pt.x >= prevX && pt.x <= currX);
        if (inRange) {
          this.triggerStrokeNote(stroke, pt.y, pt.x, stroke.width);
        }
        continue;
      }

      // Check line segments
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        const minSegX = Math.min(p1.x, p2.x);
        const maxSegX = Math.max(p1.x, p2.x);

        const inRange = wrapped
          ? (minSegX >= prevX || maxSegX <= currX)
          : (maxSegX >= prevX && minSegX <= currX);

        if (inRange) {
          // Debounce continuous lines to musical rate (at least 80ms between note retriggers per stroke)
          const lastTrig = this.strokeTriggerTimes.get(stroke.id) || 0;
          if (now - lastTrig >= 80) {
            this.strokeTriggerTimes.set(stroke.id, now);
            const t = Math.abs(p2.x - p1.x) < 0.001 ? 0.5 : (currX - p1.x) / (p2.x - p1.x);
            const clampedT = Math.max(0, Math.min(1, t));
            const hitY = p1.y + clampedT * (p2.y - p1.y);

            this.triggerStrokeNote(stroke, hitY, currX, stroke.width);
          }
        }
      }
    }
  }

  triggerBeatStep(step) {
    const groove = DRUM_GROOVES[this.beatGroove];
    if (!groove || !groove.pattern) return;
    const kit = groove.kit || 'electronic';
    const vol = this.beatVolume;
    try {
      audioEngine.resumeAudioContext();
      if (groove.pattern.low && groove.pattern.low.includes(step)) {
        audioEngine.playSongMakerDrum(kit, 'low', 0, 0.95 * vol);
      }
      if (groove.pattern.mid && groove.pattern.mid.includes(step)) {
        audioEngine.playSongMakerDrum(kit, 'mid', 0, 0.9 * vol);
      }
      if (groove.pattern.high && groove.pattern.high.includes(step)) {
        audioEngine.playSongMakerDrum(kit, 'high', 0, 0.7 * vol);
      }
    } catch (e) {
      console.warn('triggerBeatStep error:', e);
    }
  }

  triggerStrokeNote(stroke, y, x, width) {
    const midi = this.yToMidi(y);
    const velocity = Math.max(0.3, Math.min(1.2, width / 20));
    audioEngine.resumeAudioContext();

    if (this.articulation === 'glide') {
      let voice = this.glideVoices.get(stroke.id);
      const freq = typeof midi === 'number' && midi < 128 ? midiToFreq(midi) : midi;
      if (!voice) {
        voice = audioEngine.startGlideVoice(stroke.medium, freq, velocity, this.fx);
        this.glideVoices.set(stroke.id, voice);
        setTimeout(() => {
          audioEngine.stopGlideVoice(voice, 0.2);
          this.glideVoices.delete(stroke.id);
        }, 350);
      } else {
        audioEngine.updateGlideVoice(voice, freq);
      }
    } else {
      audioEngine.playSketchNote(stroke.medium, midi, 0.35, 0, velocity, this.fx);
    }

    this.activeHits.push({
      x,
      y,
      time: performance.now(),
      color: stroke.color,
      radius: width * 1.4
    });
  }

  redraw() {
    if (!this.ctx) return;
    const themeConfig = SKETCH_THEMES[this.theme] || SKETCH_THEMES.chalkboard;

    // 1. Draw canvas background
    this.ctx.fillStyle = themeConfig.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 2. Draw guides and grid
    this.drawGuidesAndGrid(themeConfig);

    // 3. Draw all user strokes
    for (const stroke of this.strokes) {
      this.drawStroke(stroke);
    }

    // 4. Draw active in-progress stroke
    if (this.activeStroke) {
      this.drawStroke(this.activeStroke);
    }

    // 5. Draw playback hit ripples
    const now = performance.now();
    for (const hit of this.activeHits) {
      const age = (now - hit.time) / 500;
      if (age < 1) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(hit.x, hit.y, hit.radius + age * 26, 0, Math.PI * 2);
        this.ctx.strokeStyle = hit.color;
        this.ctx.lineWidth = 2 * (1 - age);
        this.ctx.globalAlpha = 1 - age;
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // 6. Draw vertical playhead scanline
    if (this.isPlaying) {
      const scanX = this.playheadPos * this.width;
      this.ctx.save();
      const grad = this.ctx.createLinearGradient(scanX - 12, 0, scanX + 12, 0);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0)');
      grad.addColorStop(0.5, themeConfig.scanHead);
      grad.addColorStop(1, 'rgba(0, 229, 255, 0)');

      this.ctx.fillStyle = grad;
      this.ctx.globalAlpha = 0.35;
      this.ctx.fillRect(scanX - 8, 0, 16, this.height);

      this.ctx.beginPath();
      this.ctx.moveTo(scanX, 0);
      this.ctx.lineTo(scanX, this.height);
      this.ctx.strokeStyle = themeConfig.scanHead;
      this.ctx.lineWidth = 2.5;
      this.ctx.globalAlpha = 0.95;
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawGuidesAndGrid(themeConfig) {
    if (!this.showGuides) return;

    this.ctx.save();
    const scaleDegrees = SCALES[this.scaleName] || SCALES.pentatonic;
    const totalSemitones = this.octaves * 12;

    for (let semi = 0; semi <= totalSemitones; semi++) {
      const deg = semi % 12;
      const isScaleNote = scaleDegrees.includes(deg);
      if (!isScaleNote && this.scaleName !== 'chromatic') continue;

      const midi = this.rootMidi + semi;
      const y = this.midiToY(midi);
      const isRoot = deg === 0;

      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.strokeStyle = isRoot ? themeConfig.guide : themeConfig.grid;
      this.ctx.lineWidth = isRoot ? 1.5 : 0.75;
      this.ctx.stroke();

      const noteName = midiToNoteName(midi, false, true);
      const pitchClass = ((midi % 12) + 12) % 12;
      const noteColor = (themeManager && typeof themeManager.getNoteColor === 'function')
        ? themeManager.getNoteColor(pitchClass)
        : '#00e5ff';

      this.ctx.fillStyle = noteColor;
      this.ctx.font = isRoot ? 'bold 11px system-ui' : '10px system-ui';
      this.ctx.globalAlpha = isRoot ? 0.95 : 0.7;
      this.ctx.fillText(noteName, 8, y - 3);
    }

    // Measure grid
    for (let b = 0; b <= 8; b++) {
      const x = (b / 8) * this.width;
      const isBar = b % 4 === 0;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.strokeStyle = isBar ? themeConfig.guide : themeConfig.grid;
      this.ctx.lineWidth = isBar ? 1.5 : 0.75;
      this.ctx.stroke();

      if (isBar && b < 8) {
        this.ctx.fillStyle = themeConfig.guide;
        this.ctx.font = 'bold 10px system-ui';
        this.ctx.globalAlpha = 0.6;
        this.ctx.fillText(`BAR ${b / 4 + 1}`, x + 6, 14);
      }
    }
    this.ctx.restore();
  }

  drawStroke(stroke) {
    if (stroke.isSplatter) {
      this.ctx.save();
      this.ctx.fillStyle = stroke.color;
      for (const pt of stroke.points) {
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
      return;
    }

    if (!stroke.points || stroke.points.length === 0) return;

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Handle single-point dot tap
    if (stroke.points.length === 1) {
      this.ctx.fillStyle = stroke.color;
      this.ctx.beginPath();
      this.ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    switch (stroke.medium) {
      case 'neon': {
        this.ctx.shadowColor = stroke.color;
        this.ctx.shadowBlur = 18;
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width + 4;
        this.ctx.globalAlpha = 0.5;
        this.drawPath(stroke.points);

        this.ctx.shadowBlur = 6;
        this.ctx.lineWidth = stroke.width;
        this.ctx.globalAlpha = 0.9;
        this.drawPath(stroke.points);

        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = Math.max(1.5, stroke.width * 0.35);
        this.ctx.globalAlpha = 0.95;
        this.drawPath(stroke.points);
        break;
      }
      case 'watercolor': {
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width * 1.5;
        this.ctx.globalAlpha = 0.3;
        this.drawPath(stroke.points);

        this.ctx.lineWidth = stroke.width;
        this.ctx.globalAlpha = 0.5;
        this.drawPath(stroke.points);
        break;
      }
      case 'spray': {
        this.ctx.fillStyle = stroke.color;
        this.ctx.globalAlpha = 0.4;
        for (const pt of stroke.points) {
          for (let k = 0; k < 6; k++) {
            const rad = Math.random() * stroke.width * 0.8;
            const ang = Math.random() * Math.PI * 2;
            this.ctx.fillRect(pt.x + Math.cos(ang) * rad, pt.y + Math.sin(ang) * rad, 2, 2);
          }
        }
        break;
      }
      default: { // chalk, marker, crayon, pencil
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        this.ctx.globalAlpha = 0.95;
        this.drawPath(stroke.points);
        break;
      }
    }
    this.ctx.restore();
  }

  drawPath(points) {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.ctx.lineTo(points[i].x, points[i].y);
    }
    this.ctx.stroke();
  }

  loadPreset(presetKey) {
    this.strokes = [];
    const w = this.width;
    const h = this.height;

    switch (presetKey) {
      case 'wave': {
        const pts = [];
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
          const normX = i / steps;
          const x = 30 + normX * (w - 60);
          const y = (h * 0.5) + Math.sin(normX * Math.PI * 4) * (h * 0.3);
          pts.push({ x, y, p: 0.8 });
        }
        this.strokes.push({
          id: 'preset_wave',
          medium: 'neon',
          width: 14,
          color: '#00e5ff',
          points: pts
        });
        break;
      }
      case 'skyline': {
        const towers = [
          { x1: 0.1, x2: 0.22, y: 0.65, medium: 'marker', color: '#ffb300' },
          { x1: 0.26, x2: 0.38, y: 0.45, medium: 'marker', color: '#ff007f' },
          { x1: 0.42, x2: 0.58, y: 0.28, medium: 'marker', color: '#00e5ff' },
          { x1: 0.62, x2: 0.74, y: 0.52, medium: 'marker', color: '#00e676' },
          { x1: 0.78, x2: 0.92, y: 0.35, medium: 'marker', color: '#d500f9' }
        ];
        towers.forEach((tw, idx) => {
          this.strokes.push({
            id: 'preset_tower_' + idx,
            medium: tw.medium,
            width: 16,
            color: tw.color,
            points: [
              { x: tw.x1 * w, y: tw.y * h, p: 0.9 },
              { x: tw.x2 * w, y: tw.y * h, p: 0.9 }
            ]
          });
        });
        break;
      }
      case 'constellation': {
        const stars = [
          { x: 0.12, y: 0.7, r: 18, color: '#ffea00' },
          { x: 0.28, y: 0.45, r: 14, color: '#00e5ff' },
          { x: 0.45, y: 0.6, r: 16, color: '#ff007f' },
          { x: 0.62, y: 0.32, r: 20, color: '#00e676' },
          { x: 0.78, y: 0.5, r: 14, color: '#d500f9' },
          { x: 0.9, y: 0.25, r: 18, color: '#ffea00' }
        ];
        this.strokes.push({
          id: 'preset_const_line',
          medium: 'pencil',
          width: 4,
          color: 'rgba(255, 255, 255, 0.6)',
          points: stars.map(s => ({ x: s.x * w, y: s.y * h, p: 0.6 }))
        });
        stars.forEach((s) => {
          this.createSplatterAt(s.x * w, s.y * h, s.r, s.color);
        });
        break;
      }
      case 'rain': {
        for (let i = 0; i < 28; i++) {
          const rx = 40 + Math.random() * (w - 80);
          const ry = 40 + Math.random() * (h - 80);
          const color = this.getNoteColorForY(ry);
          this.createSplatterAt(rx, ry, 10 + Math.random() * 12, color);
        }
        break;
      }
      case 'smile': {
        this.createSplatterAt(w * 0.35, h * 0.38, 22, '#00e5ff');
        this.createSplatterAt(w * 0.65, h * 0.38, 22, '#00e5ff');
        const smilePts = [];
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          const sx = w * 0.3 + t * (w * 0.4);
          const sy = h * 0.62 + Math.sin(t * Math.PI) * (h * 0.16);
          smilePts.push({ x: sx, y: sy, p: 0.9 });
        }
        this.strokes.push({
          id: 'preset_smile',
          medium: 'chalk',
          width: 18,
          color: '#ffb300',
          points: smilePts
        });
        break;
      }
    }
    this.redraw();
  }

  exportArtworkPng() {
    if (!this.canvas) return;
    const link = document.createElement('a');
    link.download = `cml-extra-sketch-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }

  async exportAudioWav() {
    if (this.strokes.length === 0) {
      alert('Draw some musical strokes first to export WAV audio!');
      return;
    }

    const exportBtn = document.getElementById('sketch-export-wav');
    if (exportBtn) exportBtn.textContent = 'Rendering WAV...';

    try {
      const totalBeats = 8;
      const secondsPerLoop = (60 / this.bpm) * totalBeats;
      const sampleRate = 44100;
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, Math.floor(sampleRate * (secondsPerLoop + 1.5)), sampleRate);

      // 1. Render Drum Groove if active
      if (this.beatGroove && this.beatGroove !== 'none') {
        const groove = DRUM_GROOVES[this.beatGroove];
        if (groove && groove.pattern) {
          const kit = groove.kit || 'electronic';
          const vol = this.beatVolume;
          for (let step = 0; step < 32; step++) {
            const stepTime = (step / 32) * secondsPerLoop;
            if (groove.pattern.low && groove.pattern.low.includes(step)) {
              audioEngine.playSongMakerDrum(kit, 'low', stepTime, 0.95 * vol, offlineCtx, offlineCtx.destination);
            }
            if (groove.pattern.mid && groove.pattern.mid.includes(step)) {
              audioEngine.playSongMakerDrum(kit, 'mid', stepTime, 0.9 * vol, offlineCtx, offlineCtx.destination);
            }
            if (groove.pattern.high && groove.pattern.high.includes(step)) {
              audioEngine.playSongMakerDrum(kit, 'high', stepTime, 0.7 * vol, offlineCtx, offlineCtx.destination);
            }
          }
        }
      }

      // 2. Render Drawn Strokes
      const simulatedSteps = 120;
      for (let s = 0; s < simulatedSteps; s++) {
        const prevNormX = s / simulatedSteps;
        const currNormX = (s + 1) / simulatedSteps;
        const timeOffset = prevNormX * secondsPerLoop;

        const prevX = prevNormX * this.width;
        const currX = currNormX * this.width;

        for (const stroke of this.strokes) {
          if (stroke.isSplatter) {
            for (const pt of stroke.points) {
              if (pt.x >= prevX && pt.x <= currX) {
                const midi = this.yToMidi(pt.y);
                const vel = Math.max(0.2, Math.min(1.2, (pt.r || stroke.width) / 24));
                audioEngine.playSketchNote(stroke.medium, midi, 0.4, timeOffset, vel, this.fx, offlineCtx, offlineCtx.destination);
              }
            }
            continue;
          }

          if (stroke.points.length === 1) {
            const pt = stroke.points[0];
            if (pt.x >= prevX && pt.x <= currX) {
              const midi = this.yToMidi(pt.y);
              const vel = Math.max(0.2, Math.min(1.2, stroke.width / 24));
              audioEngine.playSketchNote(stroke.medium, midi, 0.35, timeOffset, vel, this.fx, offlineCtx, offlineCtx.destination);
            }
            continue;
          }

          for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            if ((p2.x >= prevX && p1.x <= currX) || (p1.x >= prevX && p2.x <= currX)) {
              const hitY = (p1.y + p2.y) / 2;
              const midi = this.yToMidi(hitY);
              const vel = Math.max(0.2, Math.min(1.2, stroke.width / 24));
              audioEngine.playSketchNote(stroke.medium, midi, 0.35, timeOffset, vel, this.fx, offlineCtx, offlineCtx.destination);
            }
          }
        }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioEngine.audioBufferToWavBlob(renderedBuffer);

      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sketch-studio-${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Offline WAV render failed:', err);
    } finally {
      if (exportBtn) exportBtn.textContent = '💾 WAV';
    }
  }
}
