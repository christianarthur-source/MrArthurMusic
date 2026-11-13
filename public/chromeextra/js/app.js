/**
 * Chrome Music Lab EXTRA — Main Application Controller
 * Coordinates Hub navigation, Experiment lifecycle, Theme & Color Palette Studio,
 * and the interactive 8-key Footer Piano Easter Egg (from shell/js/app.js).
 */

import { themeManager, PRESET_THEMES, DEFAULT_CML_NOTES } from './theme-palette.js';
import { audioEngine } from './audio-engine.js';
import { SongMakerApp } from './song-maker.js';
import { KandinskyApp } from './kandinsky.js';
import { SharedPianoApp } from './shared-piano.js';
import { RhythmApp } from './rhythm.js';
import { SketchStudioApp } from './sketch-studio.js';

class ChromeMusicLabExtraApp {
  constructor() {
    this.activeView = 'hub';
    this.songMaker = new SongMakerApp();
    this.kandinsky = new KandinskyApp();
    this.sharedPiano = new SharedPianoApp();
    this.rhythm = new RhythmApp();
    this.sketchStudio = new SketchStudioApp();

    this.initNavigation();
    this.initThemePaletteDrawer();
    this.initFooterPianoEasterEgg();
    this.initAudioUnlock();
    this.handleInitialRoute();
  }

  initAudioUnlock() {
    const unlock = () => {
      try {
        audioEngine.resumeAudioContext();
        const banner = document.getElementById('sketch-audio-unlock-overlay');
        if (banner) banner.style.display = 'none';
      } catch (e) {}
    };
    ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });

    const unlockBtn = document.getElementById('sketch-audio-unlock-overlay');
    if (unlockBtn) {
      unlockBtn.addEventListener('click', unlock);
    }

    const updateBanner = () => {
      const banner = document.getElementById('sketch-audio-unlock-overlay');
      if (!banner) return;
      const isSketch = this.activeView === 'sketch-studio';
      if (isSketch && (!audioEngine.ctx || audioEngine.ctx.state !== 'running')) {
        banner.style.display = 'inline-flex';
      } else {
        banner.style.display = 'none';
      }
    };
    setInterval(updateBanner, 600);
  }

  initNavigation() {
    // Top nav tabs & Hub cards
    document.querySelectorAll('[data-nav-target]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.getAttribute('data-nav-target');
        if (target) {
          this.switchView(target);
        }
      });
    });

    window.addEventListener('hashchange', () => this.handleInitialRoute());
  }

  handleInitialRoute() {
    const hash = window.location.hash.replace('#', '').trim();
    const valid = ['hub', 'song-maker', 'kandinsky', 'shared-piano', 'rhythm', 'sketch-studio'];
    if (valid.includes(hash)) {
      this.switchView(hash, false);
    }
  }

  switchView(viewId, updateHash = true) {
    // Pause active loops in previous view so sounds don't overlap
    if (this.activeView !== viewId) {
      if (this.songMaker && this.songMaker.isPlaying) this.songMaker.stop();
      if (this.kandinsky && this.kandinsky.isPlaying) this.kandinsky.stop();
      if (this.rhythm && this.rhythm.isPlaying) this.rhythm.stop();
      if (this.sketchStudio && this.sketchStudio.isPlaying) this.sketchStudio.stop();
    }

    this.activeView = viewId;
    if (updateHash) {
      history.replaceState(null, '', `#${viewId}`);
    }

    document.querySelectorAll('.app-view').forEach(section => {
      section.classList.toggle('active', section.id === `view-${viewId}`);
    });

    document.querySelectorAll('.top-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-nav-target') === viewId);
    });

    // Resize active experiment canvases after DOM layout settles
    requestAnimationFrame(() => {
      if (viewId === 'song-maker') this.songMaker.resizeCanvases();
      if (viewId === 'kandinsky') this.kandinsky.resizeCanvas();
      if (viewId === 'shared-piano') this.sharedPiano.resizeCanvas();
      if (viewId === 'rhythm') this.rhythm.resizeCanvas();
      if (viewId === 'sketch-studio') {
        this.sketchStudio.setupCanvasSize();
        this.sketchStudio.redraw();
      }
    });
  }

  initThemePaletteDrawer() {
    const openBtn = document.getElementById('open-palette-btn');
    const closeBtn = document.getElementById('close-palette-btn');
    const drawer = document.getElementById('palette-drawer');
    const backdrop = document.getElementById('palette-backdrop');
    const quickModeBtn = document.getElementById('quick-theme-toggle');
    const resetPaletteBtn = document.getElementById('reset-palette-btn');

    const toggleDrawer = (open) => {
      if (!drawer || !backdrop) return;
      drawer.classList.toggle('open', open);
      backdrop.classList.toggle('open', open);
    };

    if (openBtn) openBtn.addEventListener('click', () => toggleDrawer(true));
    if (closeBtn) closeBtn.addEventListener('click', () => toggleDrawer(false));
    if (backdrop) backdrop.addEventListener('click', () => toggleDrawer(false));

    if (quickModeBtn) {
      quickModeBtn.addEventListener('click', () => {
        themeManager.toggleDarkLight();
      });
    }

    if (resetPaletteBtn) {
      resetPaletteBtn.addEventListener('click', () => {
        themeManager.resetToDefault();
      });
    }

    this.renderPaletteStudioControls();
    themeManager.subscribe(() => {
      this.syncPaletteStudioUI();
    });
  }

  renderPaletteStudioControls() {
    const presetContainer = document.getElementById('palette-presets-grid');
    const notesContainer = document.getElementById('palette-notes-grid');
    const kandContainer = document.getElementById('palette-kandinsky-grid');
    const bgCanvasInput = document.getElementById('palette-bg-canvas');
    const bgPrimaryInput = document.getElementById('palette-bg-primary');

    if (presetContainer) {
      presetContainer.innerHTML = Object.values(PRESET_THEMES).map(preset => `
        <button class="preset-theme-card" data-preset-id="${preset.id}">
          <div class="preset-card-header">
            <span class="preset-card-title">${preset.name}</span>
            <span class="preset-mode-badge ${preset.mode}">${preset.mode.toUpperCase()}</span>
          </div>
          <p class="preset-card-desc">${preset.description}</p>
          <div class="preset-swatch-bar" style="background:${preset.bgCanvas}">
            ${preset.notes.map(c => `<span style="background:${c}"></span>`).join('')}
          </div>
        </button>
      `).join('');

      presetContainer.querySelectorAll('.preset-theme-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-preset-id');
          themeManager.selectPreset(id);
        });
      });
    }

    if (notesContainer) {
      const currentNotes = themeManager.getTheme().notes;
      notesContainer.innerHTML = DEFAULT_CML_NOTES.map((n, idx) => `
        <label class="pitch-color-item">
          <span class="pitch-badge" id="pitch-badge-${idx}" style="background:${currentNotes[idx]}">${n.pitch}</span>
          <div class="pitch-meta">
            <span class="pitch-name">${n.pitch} Note</span>
            <span class="pitch-hex" id="pitch-hex-${idx}">${currentNotes[idx]}</span>
          </div>
          <input type="color" id="pitch-picker-${idx}" value="${currentNotes[idx]}" data-note-idx="${idx}" />
        </label>
      `).join('');

      notesContainer.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-note-idx'), 10);
          const hex = e.target.value;
          themeManager.setNoteColor(idx, hex);
          audioEngine.playTonalNote('marimba', 60 + idx, 0.25, 0, 0.65);
        });
      });
    }

    if (kandContainer) {
      const k = themeManager.getTheme().kandinsky || { line: '#4bb4a1', triangle: '#96c43e', circle: '#4998b4' };
      const items = [
        { key: 'line', label: 'Lines & Melodies', val: k.line },
        { key: 'triangle', label: 'Triangles (Percussion)', val: k.triangle },
        { key: 'circle', label: 'Circles (Singing Faces)', val: k.circle }
      ];
      kandContainer.innerHTML = items.map(item => `
        <label class="pitch-color-item">
          <span class="pitch-badge" id="kand-badge-${item.key}" style="background:${item.val}">●</span>
          <div class="pitch-meta">
            <span class="pitch-name">${item.label}</span>
            <span class="pitch-hex" id="kand-hex-${item.key}">${item.val}</span>
          </div>
          <input type="color" id="kand-picker-${item.key}" value="${item.val}" data-kand-key="${item.key}" />
        </label>
      `).join('');

      kandContainer.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('input', (e) => {
          const key = e.target.getAttribute('data-kand-key');
          themeManager.setKandinskyColor(key, e.target.value);
        });
      });
    }

    if (bgCanvasInput) {
      bgCanvasInput.addEventListener('input', (e) => {
        themeManager.setSurfaceColor('bgCanvas', e.target.value);
      });
    }

    if (bgPrimaryInput) {
      bgPrimaryInput.addEventListener('input', (e) => {
        themeManager.setSurfaceColor('bgPrimary', e.target.value);
      });
    }

    this.syncPaletteStudioUI();
  }

  syncPaletteStudioUI() {
    const state = themeManager.getTheme();

    document.querySelectorAll('.preset-theme-card').forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-preset-id') === state.id);
    });

    state.notes.forEach((hex, idx) => {
      const picker = document.getElementById(`pitch-picker-${idx}`);
      const badge = document.getElementById(`pitch-badge-${idx}`);
      const hexLabel = document.getElementById(`pitch-hex-${idx}`);
      if (picker && picker.value !== hex) picker.value = hex;
      if (badge) badge.style.background = hex;
      if (hexLabel) hexLabel.textContent = hex.toUpperCase();
    });

    if (state.kandinsky) {
      ['line', 'triangle', 'circle'].forEach(kKey => {
        const hex = state.kandinsky[kKey];
        const picker = document.getElementById(`kand-picker-${kKey}`);
        const badge = document.getElementById(`kand-badge-${kKey}`);
        const hexLabel = document.getElementById(`kand-hex-${kKey}`);
        if (picker && hex) picker.value = hex;
        if (badge && hex) badge.style.background = hex;
        if (hexLabel && hex) hexLabel.textContent = hex.toUpperCase();
      });
    }

    const bgCanvasInput = document.getElementById('palette-bg-canvas');
    const bgPrimaryInput = document.getElementById('palette-bg-primary');
    if (bgCanvasInput && state.bgCanvas) bgCanvasInput.value = state.bgCanvas;
    if (bgPrimaryInput && state.bgPrimary) bgPrimaryInput.value = state.bgPrimary;

    const quickModeBtn = document.getElementById('quick-theme-toggle');
    if (quickModeBtn) {
      quickModeBtn.innerHTML = state.mode === 'light'
        ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg><span>Dark Mode</span>`
        : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg><span>Light Mode</span>`;
    }
  }

  /**
   * Reverse-engineered from shell/js/app.js:
   * Interactive 8-key xylophone/piano bar in the Hub footer (C4 D4 E4 F4 G4 A4 B4 C5)
   */
  initFooterPianoEasterEgg() {
    const container = document.getElementById('hub-footer-piano');
    if (!container) return;

    const majorScaleMidis = [60, 62, 64, 65, 67, 69, 71, 72];
    const labels = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C5'];

    container.innerHTML = majorScaleMidis.map((midi, i) => {
      const semi = midi % 12;
      return `
        <button class="footer-piano-key" data-midi="${midi}" style="--key-color: var(--note-${semi})">
          <span class="footer-key-note">${labels[i]}</span>
        </button>
      `;
    }).join('');

    container.querySelectorAll('.footer-piano-key').forEach(btn => {
      const playKey = () => {
        const midi = parseInt(btn.getAttribute('data-midi'), 10);
        audioEngine.playTonalNote('marimba', midi, 0.4, 0, 0.8);
        btn.classList.add('ringing');
        setTimeout(() => btn.classList.remove('ringing'), 260);
      };
      btn.addEventListener('mousedown', playKey);
      btn.addEventListener('mouseenter', (e) => {
        if (e.buttons === 1) playKey();
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.cmlExtraApp = new ChromeMusicLabExtraApp();
});
