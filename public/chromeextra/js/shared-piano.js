/**
 * Chrome Music Lab EXTRA — Shared Piano Experiment
 * Reverse-engineered from Shared-Piano/src.73787edc.js
 * Features:
 * - Multi-octave interactive keyboard (mouse glissando, computer QWERTY/ZXCV rows, WebMIDI)
 * - Upward-scrolling Piano Roll Canvas with sustain trails, note labels & animal emoji tags
 * - 7 instruments (Piano, Marimba, Strings, Woodwind, Synth, Drum Kit, Drum Machine)
 * - Real-time multi-tab room sync via BroadcastChannel + interactive "AI Duet Partner"
 * - Settings panel (Octaves, Note Names, Solfege, Custom Note Labels, Emojis, Transpose, Metronome)
 */

import { audioEngine, NOTE_NAMES_SHARP, midiToNoteName } from './audio-engine.js';
import { themeManager } from './theme-palette.js';

export const ANIMAL_AVATARS = [
  { emoji: '🐶', name: 'Puppy' },
  { emoji: '🐱', name: 'Kitty' },
  { emoji: '🦊', name: 'Fox' },
  { emoji: '🐼', name: 'Panda' },
  { emoji: '🐨', name: 'Koala' },
  { emoji: '🐯', name: 'Tiger' },
  { emoji: '🦁', name: 'Lion' },
  { emoji: '🐸', name: 'Frog' },
  { emoji: '🦉', name: 'Owl' },
  { emoji: '🦄', name: 'Unicorn' }
];

export const SOLFEGE_NAMES = ['Do', 'Di', 'Re', 'Ri', 'Mi', 'Fa', 'Fi', 'Sol', 'Si', 'La', 'Li', 'Ti'];

export const KEYBOARD_MAP = {
  // Lower octave (C3 = 48 .. E4 = 64)
  KeyZ: 48, KeyS: 49, KeyX: 50, KeyD: 51, KeyC: 52, KeyV: 53,
  KeyG: 54, KeyB: 55, KeyH: 56, KeyN: 57, KeyJ: 58, KeyM: 59,
  Comma: 60, KeyL: 61, Period: 62, Semicolon: 63, Slash: 64,
  // Upper octave (C4 = 60 .. E5 = 76)
  KeyQ: 60, Digit2: 61, KeyW: 62, Digit3: 63, KeyE: 64, KeyR: 65,
  Digit5: 66, KeyT: 67, Digit6: 68, KeyY: 69, Digit7: 70, KeyU: 71,
  KeyI: 72, Digit9: 73, KeyO: 74, Digit0: 75, KeyP: 76
};

export class SharedPianoApp {
  constructor() {
    this.myAvatar = ANIMAL_AVATARS[Math.floor(Math.random() * 6)];
    this.aiAvatar = { emoji: '🤖', name: 'AI Duet Bot' };

    this.settings = {
      instrument: 'piano',
      octaves: 3,
      startOctave: 3, // C3 (MIDI 48)
      transpose: 0,
      noteNameMode: 'letters', // 'letters' | 'solfege' | 'custom' | 'hide'
      customNoteNames: [...NOTE_NAMES_SHARP],
      showEmojis: true,
      showTrails: true,
      sustain: false,
      metronomeOn: false,
      bpm: 110,
      aiDuetMode: 'off' // 'off' | 'harmony' | 'echo' | 'bassGroove'
    };

    this.activeNotes = new Map(); // key: `${owner}:${midi}` -> trail object
    this.trailHistory = [];       // Completed & active rising note bars
    this.peers = new Map();       // Remote tab peers
    this.keyElements = new Map(); // midi -> DOM element
    this.isMouseDown = false;
    this.lastMouseMidi = null;
    this.heldComputerKeys = new Set();
    this.metronomeTimer = null;
    this.metronomeBeat = 0;
    this.aiTimer = null;

    this.initDOM();
    this.buildKeyboardDOM();
    this.initBroadcastRoom();
    this.initWebMIDI();

    themeManager.subscribe(() => {
      this.updateKeyColors();
    });
    window.addEventListener('resize', () => this.resizeCanvas());

    if (window.ResizeObserver && this.rollCanvas) {
      const ro = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      ro.observe(this.rollCanvas);
      if (this.keyboardContainer) ro.observe(this.keyboardContainer);
    }

    this.startRollLoop();
  }

  initDOM() {
    this.rollCanvas = document.getElementById('sp-roll-canvas');
    this.keyboardContainer = document.getElementById('sp-keyboard');
    this.instSelect = document.getElementById('sp-inst-select');
    this.sustainBtn = document.getElementById('sp-sustain-btn');
    this.metroBtn = document.getElementById('sp-metro-btn');
    this.clearBtn = document.getElementById('sp-clear-btn');
    this.settingsBtn = document.getElementById('sp-settings-btn');
    this.aiSelect = document.getElementById('sp-ai-select');
    this.avatarBar = document.getElementById('sp-avatar-bar');

    if (this.instSelect) {
      this.instSelect.addEventListener('change', (e) => {
        this.settings.instrument = e.target.value;
        audioEngine.playTonalNote(this.settings.instrument, 60, 0.3, 0, 0.8);
        this.instSelect.blur();
      });
    }

    if (this.sustainBtn) {
      this.sustainBtn.addEventListener('click', () => {
        this.settings.sustain = !this.settings.sustain;
        this.sustainBtn.classList.toggle('active', this.settings.sustain);
      });
    }

    if (this.metroBtn) {
      this.metroBtn.addEventListener('click', () => this.toggleMetronome());
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.trailHistory = [];
        this.activeNotes.clear();
      });
    }

    if (this.aiSelect) {
      this.aiSelect.addEventListener('change', (e) => {
        this.settings.aiDuetMode = e.target.value;
        this.updateAvatarBar();
        this.manageAiBassLoop();
        this.aiSelect.blur();
      });
    }

    this.initSettingsModal();
    this.bindComputerKeyboard();
    this.updateAvatarBar();
    setTimeout(() => this.resizeCanvas(), 40);
  }

  getNoteLabel(midi) {
    const semi = ((midi % 12) + 12) % 12;
    const mode = this.settings.noteNameMode;
    if (mode === 'hide') return '';
    if (mode === 'solfege') return SOLFEGE_NAMES[semi];
    if (mode === 'custom') return this.settings.customNoteNames[semi] || NOTE_NAMES_SHARP[semi];
    return NOTE_NAMES_SHARP[semi];
  }

  buildKeyboardDOM() {
    if (!this.keyboardContainer) return;
    this.keyboardContainer.innerHTML = '';
    this.keyElements.clear();

    const startMidi = (this.settings.startOctave + 1) * 12;
    const endMidi = startMidi + this.settings.octaves * 12;

    // Count white keys first so black keys can be positioned accurately
    const whiteMidis = [];
    for (let m = startMidi; m <= endMidi; m++) {
      const semi = m % 12;
      if ([0, 2, 4, 5, 7, 9, 11].includes(semi)) {
        whiteMidis.push(m);
      }
    }

    const totalWhites = whiteMidis.length;
    let whiteIndex = 0;

    for (let m = startMidi; m <= endMidi; m++) {
      const semi = m % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(semi);
      const keyEl = document.createElement('div');
      keyEl.dataset.midi = m;

      if (!isBlack) {
        keyEl.className = 'sp-key sp-key-white';
        keyEl.style.width = `${100 / totalWhites}%`;
        const label = document.createElement('span');
        label.className = 'sp-key-label';
        label.textContent = this.getNoteLabel(m);
        keyEl.appendChild(label);
        whiteIndex++;
      } else {
        keyEl.className = 'sp-key sp-key-black';
        const blackWidthPct = (100 / totalWhites) * 0.64;
        const leftPct = (whiteIndex * (100 / totalWhites)) - (blackWidthPct / 2);
        keyEl.style.width = `${blackWidthPct}%`;
        keyEl.style.left = `${leftPct}%`;
        const label = document.createElement('span');
        label.className = 'sp-key-label';
        label.textContent = this.getNoteLabel(m);
        keyEl.appendChild(label);
      }

      this.bindKeyPointerEvents(keyEl, m);
      this.keyboardContainer.appendChild(keyEl);
      this.keyElements.set(m, keyEl);
    }

    window.addEventListener('mouseup', () => {
      if (this.isMouseDown && this.lastMouseMidi !== null) {
        this.noteOff(this.lastMouseMidi, 'local');
      }
      this.isMouseDown = false;
      this.lastMouseMidi = null;
    });
  }

  bindKeyPointerEvents(keyEl, midi) {
    keyEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.isMouseDown = true;
      this.lastMouseMidi = midi;
      this.noteOn(midi, 'local', this.myAvatar.emoji, this.settings.instrument);
    });

    keyEl.addEventListener('mouseenter', () => {
      if (this.isMouseDown && this.lastMouseMidi !== midi) {
        if (this.lastMouseMidi !== null) {
          this.noteOff(this.lastMouseMidi, 'local');
        }
        this.lastMouseMidi = midi;
        this.noteOn(midi, 'local', this.myAvatar.emoji, this.settings.instrument);
      }
    });

    keyEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.noteOn(midi, 'local', this.myAvatar.emoji, this.settings.instrument);
    }, { passive: false });

    keyEl.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.noteOff(midi, 'local');
    });
  }

  bindComputerKeyboard() {
    window.addEventListener('keydown', (e) => {
      const view = document.getElementById('view-shared-piano');
      if (!view || !view.classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!this.settings.sustain) {
          this.settings.sustain = true;
          if (this.sustainBtn) this.sustainBtn.classList.add('active');
        }
        return;
      }

      const mappedMidi = KEYBOARD_MAP[e.code];
      if (mappedMidi !== undefined && !this.heldComputerKeys.has(e.code)) {
        this.heldComputerKeys.add(e.code);
        this.noteOn(mappedMidi, 'local', this.myAvatar.emoji, this.settings.instrument);
      }
    });

    window.addEventListener('keyup', (e) => {
      const view = document.getElementById('view-shared-piano');
      if (!view || !view.classList.contains('active')) return;

      if (e.code === 'Space') {
        this.settings.sustain = false;
        if (this.sustainBtn) this.sustainBtn.classList.remove('active');
        return;
      }

      const mappedMidi = KEYBOARD_MAP[e.code];
      if (mappedMidi !== undefined && this.heldComputerKeys.has(e.code)) {
        this.heldComputerKeys.delete(e.code);
        this.noteOff(mappedMidi, 'local');
      }
    });
  }

  noteOn(rawMidi, owner = 'local', emoji = '🐶', instrument = 'piano', fromBroadcast = false) {
    const midi = rawMidi + (owner === 'local' ? this.settings.transpose : 0);
    const now = performance.now();
    const duration = this.settings.sustain ? 1.4 : 0.55;

    audioEngine.playTonalNote(instrument, midi, duration, 0, 0.8);

    // Highlight key in DOM
    const keyEl = this.keyElements.get(rawMidi);
    const color = themeManager.getNoteColor(midi);
    if (keyEl) {
      keyEl.classList.add('pressed');
      keyEl.style.setProperty('--active-key-color', color);
      if (this.settings.showEmojis) {
        let badge = keyEl.querySelector('.sp-key-emoji');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'sp-key-emoji';
          keyEl.appendChild(badge);
        }
        badge.textContent = emoji;
      }
    }

    // Create rising trail bar
    const trail = {
      midi: rawMidi,
      soundMidi: midi,
      owner,
      emoji,
      instrument,
      startTime: now,
      endTime: null
    };
    this.activeNotes.set(`${owner}:${rawMidi}`, trail);
    this.trailHistory.push(trail);
    if (this.trailHistory.length > 260) {
      this.trailHistory.shift();
    }

    // Broadcast to other open tabs
    if (owner === 'local' && !fromBroadcast && this.channel) {
      this.channel.postMessage({
        type: 'noteOn',
        midi: rawMidi,
        emoji: this.myAvatar.emoji,
        instrument: this.settings.instrument
      });
    }

    // Trigger AI Duet response if enabled
    if (owner === 'local') {
      this.triggerAiDuetResponse(rawMidi);
    }
  }

  noteOff(rawMidi, owner = 'local', fromBroadcast = false) {
    const key = `${owner}:${rawMidi}`;
    const trail = this.activeNotes.get(key);
    if (trail) {
      trail.endTime = performance.now();
      this.activeNotes.delete(key);
    }

    const keyEl = this.keyElements.get(rawMidi);
    if (keyEl) {
      keyEl.classList.remove('pressed');
      const badge = keyEl.querySelector('.sp-key-emoji');
      if (badge) badge.remove();
    }

    if (owner === 'local' && !fromBroadcast && this.channel) {
      this.channel.postMessage({
        type: 'noteOff',
        midi: rawMidi
      });
    }
  }

  triggerAiDuetResponse(userMidi) {
    const mode = this.settings.aiDuetMode;
    if (mode === 'off') return;

    if (mode === 'harmony') {
      // Play a sweet major/minor 3rd + 5th chord accompaniment slightly delayed
      const third = userMidi + 4;
      const fifth = userMidi + 7;
      setTimeout(() => {
        this.noteOn(third, 'ai', this.aiAvatar.emoji, 'strings', true);
        setTimeout(() => this.noteOff(third, 'ai', true), 360);
      }, 90);
      setTimeout(() => {
        this.noteOn(fifth, 'ai', this.aiAvatar.emoji, 'strings', true);
        setTimeout(() => this.noteOff(fifth, 'ai', true), 420);
      }, 180);
    } else if (mode === 'echo') {
      // Call-and-response octave marimba echo
      const echoMidi = userMidi + 12 <= 84 ? userMidi + 12 : userMidi - 12;
      setTimeout(() => {
        this.noteOn(echoMidi, 'ai', this.aiAvatar.emoji, 'marimba', true);
        setTimeout(() => this.noteOff(echoMidi, 'ai', true), 260);
      }, 280);
    }
  }

  manageAiBassLoop() {
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
      this.aiTimer = null;
    }
    if (this.settings.aiDuetMode !== 'bassGroove') return;

    const bassPattern = [48, 55, 57, 53, 48, 52, 53, 55];
    let step = 0;
    this.aiTimer = setInterval(() => {
      const view = document.getElementById('view-shared-piano');
      if (!view || !view.classList.contains('active')) return;
      const m = bassPattern[step % bassPattern.length];
      this.noteOn(m, 'ai', this.aiAvatar.emoji, 'synth', true);
      setTimeout(() => this.noteOff(m, 'ai', true), 320);
      step++;
    }, 480);
  }

  toggleMetronome() {
    this.settings.metronomeOn = !this.settings.metronomeOn;
    if (this.metroBtn) {
      this.metroBtn.classList.toggle('active', this.settings.metronomeOn);
    }
    if (this.metronomeTimer) {
      clearInterval(this.metronomeTimer);
      this.metronomeTimer = null;
    }
    if (this.settings.metronomeOn) {
      this.metronomeBeat = 0;
      const interval = (60 / this.settings.bpm) * 1000;
      audioEngine.playMetronomeClick(true);
      this.metronomeTimer = setInterval(() => {
        this.metronomeBeat = (this.metronomeBeat + 1) % 4;
        audioEngine.playMetronomeClick(this.metronomeBeat === 0);
      }, interval);
    }
  }

  initBroadcastRoom() {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('cml_extra_shared_piano_room');
    this.channel.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (msg.type === 'noteOn') {
        this.peers.set(msg.emoji, { emoji: msg.emoji, lastSeen: Date.now() });
        this.updateAvatarBar();
        this.noteOn(msg.midi, `peer_${msg.emoji}`, msg.emoji, msg.instrument || 'piano', true);
      } else if (msg.type === 'noteOff') {
        this.noteOff(msg.midi, `peer_${msg.emoji}`, true);
      }
    };
  }

  async initWebMIDI() {
    if (!navigator.requestMIDIAccess) return;
    try {
      const midiAccess = await navigator.requestMIDIAccess();
      for (const input of midiAccess.inputs.values()) {
        input.onmidimessage = (event) => {
          const [status, data1, data2] = event.data;
          const cmd = status & 0xf0;
          if (cmd === 0x90 && data2 > 0) {
            this.noteOn(data1, 'local', this.myAvatar.emoji, this.settings.instrument);
          } else if (cmd === 0x80 || (cmd === 0x90 && data2 === 0)) {
            this.noteOff(data1, 'local');
          }
        };
      }
    } catch (e) {
      // WebMIDI optional
    }
  }

  updateAvatarBar() {
    if (!this.avatarBar) return;
    const pills = [
      `<div class="sp-avatar-pill you" title="You (${this.myAvatar.name})">
        <span class="sp-emoji">${this.myAvatar.emoji}</span>
        <span>You</span>
      </div>`
    ];

    if (this.settings.aiDuetMode !== 'off') {
      pills.push(`
        <div class="sp-avatar-pill ai" title="AI Jam Partner active">
          <span class="sp-emoji">${this.aiAvatar.emoji}</span>
          <span>AI Partner (${this.settings.aiDuetMode})</span>
        </div>
      `);
    }

    for (const peer of this.peers.values()) {
      pills.push(`
        <div class="sp-avatar-pill peer">
          <span class="sp-emoji">${peer.emoji}</span>
          <span>Room Tab</span>
        </div>
      `);
    }

    this.avatarBar.innerHTML = pills.join('');
  }

  updateKeyColors() {
    for (const [midi, el] of this.keyElements.entries()) {
      const label = el.querySelector('.sp-key-label');
      if (label) {
        label.textContent = this.getNoteLabel(midi);
      }
    }
  }

  resizeCanvas() {
    if (!this.rollCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.rollCanvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.rollCanvas.width = Math.floor(rect.width * dpr);
      this.rollCanvas.height = Math.floor(rect.height * dpr);
    }
  }

  startRollLoop() {
    const loop = () => {
      this.renderRoll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  renderRoll() {
    if (!this.rollCanvas) return;
    const ctx = this.rollCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = this.rollCanvas.width;
    const h = this.rollCanvas.height;
    if (w === 0 || h === 0) return;

    const theme = themeManager.getTheme();
    const now = performance.now();

    ctx.fillStyle = theme.bgCanvas;
    ctx.fillRect(0, 0, w, h);

    // Subtle vertical octave lane dividers
    const startMidi = (this.settings.startOctave + 1) * 12;
    const endMidi = startMidi + this.settings.octaves * 12;
    const totalSemis = Math.max(1, endMidi - startMidi + 1);

    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1 * dpr;
    for (let m = startMidi; m <= endMidi; m++) {
      if (m % 12 === 0) {
        const x = ((m - startMidi) / totalSemis) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    if (!this.settings.showTrails) return;

    const pixelsPerMs = 0.14 * dpr;
    const rollRect = this.rollCanvas.getBoundingClientRect();

    for (let i = this.trailHistory.length - 1; i >= 0; i--) {
      const item = this.trailHistory[i];
      const endT = item.endTime || now;
      const topDist = (now - item.startTime) * pixelsPerMs;
      const bottomDist = (now - endT) * pixelsPerMs;

      const yTop = h - topDist;
      const yBottom = h - bottomDist;

      if (yBottom < -40) {
        if (item.endTime) {
          this.trailHistory.splice(i, 1);
        }
        continue;
      }

      // Align trail horizontally with the actual DOM key if present
      let barX = ((item.midi - startMidi) / totalSemis) * w;
      let barW = Math.max(12 * dpr, (w / totalSemis) * 0.85);

      const keyEl = this.keyElements.get(item.midi);
      if (keyEl && rollRect.width > 0) {
        const kRect = keyEl.getBoundingClientRect();
        barX = ((kRect.left - rollRect.left) / rollRect.width) * w + 2 * dpr;
        barW = Math.max(8 * dpr, ((kRect.width) / rollRect.width) * w - 4 * dpr);
      }

      const barH = Math.max(12 * dpr, yBottom - yTop);
      const color = themeManager.getNoteColor(item.soundMidi);

      ctx.save();
      ctx.fillStyle = color;
      if (!item.endTime) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 14 * dpr;
      }
      this.roundRect(ctx, barX, yTop, barW, barH, 6 * dpr);
      ctx.fill();

      // Draw Note Label & Emoji inside rising bar if tall enough
      if (barH > 22 * dpr) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${11 * dpr}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = this.getNoteLabel(item.soundMidi);
        const text = this.settings.showEmojis ? `${item.emoji} ${label}` : label;
        ctx.fillText(text, barX + barW / 2, yTop + Math.min(barH / 2, 16 * dpr));
      }
      ctx.restore();
    }
  }

  roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
  }

  initSettingsModal() {
    const modal = document.getElementById('sp-settings-modal');
    const closeBtn = document.getElementById('sp-settings-close');
    const applyBtn = document.getElementById('sp-settings-apply');

    if (this.settingsBtn && modal) {
      this.settingsBtn.addEventListener('click', () => {
        document.getElementById('sp-opt-octaves').value = this.settings.octaves;
        document.getElementById('sp-opt-labels').value = this.settings.noteNameMode;
        document.getElementById('sp-opt-transpose').value = this.settings.transpose;
        document.getElementById('sp-opt-emojis').checked = this.settings.showEmojis;
        document.getElementById('sp-opt-trails').checked = this.settings.showTrails;
        modal.classList.add('open');
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('open'));
    }

    if (applyBtn && modal) {
      applyBtn.addEventListener('click', () => {
        this.settings.octaves = parseInt(document.getElementById('sp-opt-octaves').value, 10) || 3;
        this.settings.noteNameMode = document.getElementById('sp-opt-labels').value;
        this.settings.transpose = parseInt(document.getElementById('sp-opt-transpose').value, 10) || 0;
        this.settings.showEmojis = document.getElementById('sp-opt-emojis').checked;
        this.settings.showTrails = document.getElementById('sp-opt-trails').checked;

        // Read custom note names if edited
        for (let i = 0; i < 12; i++) {
          const inp = document.getElementById(`sp-custom-note-${i}`);
          if (inp && inp.value.trim()) {
            this.settings.customNoteNames[i] = inp.value.trim();
          }
        }

        this.buildKeyboardDOM();
        modal.classList.remove('open');
      });
    }
  }
}
