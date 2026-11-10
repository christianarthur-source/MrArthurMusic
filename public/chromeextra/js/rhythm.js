/**
 * Chrome Music Lab EXTRA — Rhythm Experiment
 * Reverse-engineered from rhythm-service/main.js & rhythm-service/lib.js
 * Features:
 * - 4 Character Pair Scenes:
 *   1. Monkeys (3/4 meter, 6 steps, 105 BPM) — Triangle & Timpani High/Low
 *   2. Monsters (4/4 meter, 8 steps, 96 BPM) — Hi-Hat, Snare & Bass Tom
 *   3. Robots (5/4 meter, 10 steps, 170 BPM) — Clave & Woodblocks High/Low
 *   4. Birds (6/4 meter, 12 steps, 160 BPM) — Cowbell & Congas High/Low
 * - Interactive Character Stage: breathing, blinking, "adoring look" toward partner,
 *   beat-synced head bobbing, arm-strike animations, and direct click-to-play hitboxes!
 * - 3-Track Step Sequencer with custom instrument symbols + EXTRA BPM & pattern controls.
 */

import { audioEngine } from './audio-engine.js';
import { themeManager } from './theme-palette.js';

export const RHYTHM_SCENES = [
  {
    id: 'monkeys',
    title: '3/4 Meter — Timpani & Triangle',
    meterLabel: '3 / 4',
    beats: 6,
    timeSignature: 3,
    defaultBpm: 105,
    bigChar: { name: 'Big Monkey', colorIdx: 2, secondaryIdx: 3 },
    smallChar: { name: 'Small Monkey', colorIdx: 0, secondaryIdx: 11 },
    rows: [
      { name: 'Triangle',     symbol: 'triangle', colorIdx: 4, actor: 'small', arm: 'both' },
      { name: 'Timpani High', symbol: 'circleSm', colorIdx: 2, actor: 'big',   arm: 'left' },
      { name: 'Timpani Low',  symbol: 'circleLg', colorIdx: 0, actor: 'big',   arm: 'right' }
    ],
    defaultPattern: [
      [1, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [1, 0, 0, 0, 1, 0]
    ]
  },
  {
    id: 'monsters',
    title: '4/4 Meter — Drum Kit & Bass Tom',
    meterLabel: '4 / 4',
    beats: 8,
    timeSignature: 4,
    defaultBpm: 96,
    bigChar: { name: 'Blue Monster', colorIdx: 8, secondaryIdx: 7 },
    smallChar: { name: 'Green Monster', colorIdx: 5, secondaryIdx: 6 },
    rows: [
      { name: 'Hi-Hat',   symbol: 'diamond',  colorIdx: 4, actor: 'big',   arm: 'right' },
      { name: 'Snare',    symbol: 'square',   colorIdx: 8, actor: 'big',   arm: 'left' },
      { name: 'Bass Tom', symbol: 'circleLg', colorIdx: 5, actor: 'small', arm: 'both' }
    ],
    defaultPattern: [
      [1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 1, 0],
      [1, 0, 0, 1, 1, 0, 0, 0]
    ]
  },
  {
    id: 'robots',
    title: '5/4 Meter — Clave & Woodblocks',
    meterLabel: '5 / 4',
    beats: 10,
    timeSignature: 5,
    defaultBpm: 170,
    bigChar: { name: 'Gold Robot', colorIdx: 3, secondaryIdx: 2 },
    smallChar: { name: 'Violet Robot', colorIdx: 9, secondaryIdx: 10 },
    rows: [
      { name: 'Clave',          symbol: 'bar',      colorIdx: 10, actor: 'small', arm: 'both' },
      { name: 'Woodblock High', symbol: 'rectSm',   colorIdx: 3,  actor: 'big',   arm: 'right' },
      { name: 'Woodblock Low',  symbol: 'rectLg',   colorIdx: 1,  actor: 'big',   arm: 'left' }
    ],
    defaultPattern: [
      [1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 0, 0]
    ]
  },
  {
    id: 'birds',
    title: '6/4 Meter — Cowbell & Congas',
    meterLabel: '6 / 4',
    beats: 12,
    timeSignature: 6,
    defaultBpm: 160,
    bigChar: { name: 'Flamingo Bird', colorIdx: 11, secondaryIdx: 0 },
    smallChar: { name: 'Teal Bird', colorIdx: 7, secondaryIdx: 8 },
    rows: [
      { name: 'Cowbell',    symbol: 'trapezoid', colorIdx: 7,  actor: 'small', arm: 'both' },
      { name: 'Conga High', symbol: 'circleSm',  colorIdx: 11, actor: 'big',   arm: 'left' },
      { name: 'Conga Low',  symbol: 'circleLg',  colorIdx: 0,  actor: 'big',   arm: 'right' }
    ],
    defaultPattern: [
      [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
    ]
  }
];

export class RhythmApp {
  constructor() {
    this.sceneIndex = 0;
    this.patterns = RHYTHM_SCENES.map(s => s.defaultPattern.map(r => [...r]));
    this.bpms = RHYTHM_SCENES.map(s => s.defaultBpm);

    this.isPlaying = false;
    this.currentStep = -1;
    this.stepTimer = null;

    // Character animation states
    this.animState = {
      bigLeftStrike: 0,
      bigRightStrike: 0,
      smallStrike: 0,
      bigBlink: 0,
      smallBlink: 0,
      lookingAtEachOther: 0,
      headBobPhase: 0
    };

    this.initDOM();
    this.loadScene(0);

    themeManager.subscribe(() => {
      this.renderSequencerGrid();
    });
    window.addEventListener('resize', () => this.resizeCanvas());

    if (window.ResizeObserver && this.stageCanvas) {
      const ro = new ResizeObserver(() => {
        this.resizeCanvas();
      });
      ro.observe(this.stageCanvas);
    }

    this.startCharacterLoop();
  }

  get currentScene() {
    return RHYTHM_SCENES[this.sceneIndex];
  }

  initDOM() {
    this.stageCanvas = document.getElementById('rhythm-stage-canvas');
    this.gridContainer = document.getElementById('rhythm-seq-grid');
    this.playBtn = document.getElementById('rhythm-play-btn');
    this.prevBtn = document.getElementById('rhythm-prev-btn');
    this.nextBtn = document.getElementById('rhythm-next-btn');
    this.sceneTitleEl = document.getElementById('rhythm-scene-title');
    this.dotsContainer = document.getElementById('rhythm-scene-dots');
    this.bpmSlider = document.getElementById('rhythm-bpm-slider');
    this.bpmVal = document.getElementById('rhythm-bpm-val');
    this.clearBtn = document.getElementById('rhythm-clear-btn');
    this.resetBtn = document.getElementById('rhythm-reset-btn');

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => {
        this.loadScene((this.sceneIndex - 1 + RHYTHM_SCENES.length) % RHYTHM_SCENES.length);
      });
    }

    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => {
        this.loadScene((this.sceneIndex + 1) % RHYTHM_SCENES.length);
      });
    }

    if (this.bpmSlider) {
      this.bpmSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10) || 110;
        this.bpms[this.sceneIndex] = val;
        if (this.bpmVal) this.bpmVal.textContent = val;
        if (this.isPlaying) this.restartLoopTimer();
      });
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        const beats = this.currentScene.beats;
        this.patterns[this.sceneIndex] = [
          Array(beats).fill(0),
          Array(beats).fill(0),
          Array(beats).fill(0)
        ];
        this.renderSequencerGrid();
      });
    }

    if (this.resetBtn) {
      this.resetBtn.addEventListener('click', () => {
        this.patterns[this.sceneIndex] = this.currentScene.defaultPattern.map(r => [...r]);
        this.bpms[this.sceneIndex] = this.currentScene.defaultBpm;
        if (this.bpmSlider) this.bpmSlider.value = this.bpms[this.sceneIndex];
        if (this.bpmVal) this.bpmVal.textContent = this.bpms[this.sceneIndex];
        if (this.isPlaying) this.restartLoopTimer();
        this.renderSequencerGrid();
      });
    }

    if (this.stageCanvas) {
      this.stageCanvas.addEventListener('mousedown', (e) => this.handleStageClick(e));
      this.stageCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleStageClick(e.touches[0]);
      }, { passive: false });
    }

    setTimeout(() => this.resizeCanvas(), 40);
  }

  loadScene(idx) {
    this.sceneIndex = idx;
    const scene = this.currentScene;
    this.currentStep = -1;

    if (this.sceneTitleEl) {
      this.sceneTitleEl.textContent = scene.title;
    }

    if (this.bpmSlider) {
      this.bpmSlider.value = this.bpms[idx];
    }
    if (this.bpmVal) {
      this.bpmVal.textContent = this.bpms[idx];
    }

    if (this.dotsContainer) {
      this.dotsContainer.innerHTML = RHYTHM_SCENES.map((s, i) => `
        <button class="rhythm-dot-btn ${i === idx ? 'active' : ''}" data-idx="${i}">
          ${s.meterLabel}
        </button>
      `).join('');
      this.dotsContainer.querySelectorAll('.rhythm-dot-btn').forEach(btn => {
        btn.addEventListener('click', () => this.loadScene(parseInt(btn.dataset.idx, 10)));
      });
    }

    if (this.isPlaying) {
      this.restartLoopTimer();
    }

    this.renderSequencerGrid();
  }

  handleStageClick(ev) {
    if (!this.stageCanvas) return;
    audioEngine.ensureContext();
    const rect = this.stageCanvas.getBoundingClientRect();
    const xPct = (ev.clientX - rect.left) / rect.width;

    // Left third = Big character left arm (row 1), Center = Big character right arm (row 2), Right third = Small character (row 0)
    if (xPct < 0.36) {
      this.triggerRowSoundAndAnim(1);
    } else if (xPct < 0.64) {
      this.triggerRowSoundAndAnim(2);
    } else {
      this.triggerRowSoundAndAnim(0);
    }
  }

  triggerRowSoundAndAnim(rowIndex) {
    audioEngine.playRhythmSound(this.sceneIndex, rowIndex, 0, 0.9);
    const rowSpec = this.currentScene.rows[rowIndex];
    if (!rowSpec) return;

    if (rowSpec.actor === 'small') {
      this.animState.smallStrike = 1.0;
    } else if (rowSpec.arm === 'left') {
      this.animState.bigLeftStrike = 1.0;
    } else {
      this.animState.bigRightStrike = 1.0;
    }
  }

  renderSequencerGrid() {
    if (!this.gridContainer) return;
    const scene = this.currentScene;
    const pat = this.patterns[this.sceneIndex];
    const beats = scene.beats;

    this.gridContainer.style.setProperty('--rhythm-cols', beats);
    this.gridContainer.innerHTML = '';

    for (let r = 0; r < 3; r++) {
      const rowSpec = scene.rows[r];
      const rowColor = themeManager.getNoteColor(rowSpec.colorIdx);

      const rowEl = document.createElement('div');
      rowEl.className = 'rhythm-seq-row';

      // Left Track Label
      const labelEl = document.createElement('div');
      labelEl.className = 'rhythm-row-label';
      labelEl.innerHTML = `
        <span class="rhythm-row-dot" style="background:${rowColor}"></span>
        <span>${rowSpec.name}</span>
      `;
      labelEl.addEventListener('click', () => this.triggerRowSoundAndAnim(r));
      rowEl.appendChild(labelEl);

      // Step Cells container
      const stepsWrap = document.createElement('div');
      stepsWrap.className = 'rhythm-row-steps';

      for (let c = 0; c < beats; c++) {
        const isActive = !!pat[r][c];
        const isDownbeat = c % 2 === 0;
        const isPlayingCol = this.isPlaying && this.currentStep === c;

        const cell = document.createElement('button');
        cell.className = `rhythm-cell ${isActive ? 'active' : ''} ${isDownbeat ? 'downbeat' : ''} ${isPlayingCol ? 'playing-step' : ''}`;
        cell.style.setProperty('--cell-color', rowColor);
        cell.innerHTML = this.getSymbolSvg(rowSpec.symbol, isActive ? rowColor : 'currentColor');

        cell.addEventListener('click', () => {
          pat[r][c] = pat[r][c] ? 0 : 1;
          if (pat[r][c]) {
            this.triggerRowSoundAndAnim(r);
          }
          this.renderSequencerGrid();
        });

        stepsWrap.appendChild(cell);
      }

      rowEl.appendChild(stepsWrap);
      this.gridContainer.appendChild(rowEl);
    }
  }

  getSymbolSvg(symbol, color) {
    switch (symbol) {
      case 'triangle':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,4 20,19 4,19" fill="${color}"/></svg>`;
      case 'diamond':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="12,3 21,12 12,21 3,12" fill="${color}"/></svg>`;
      case 'square':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="5" width="14" height="14" rx="3" fill="${color}"/></svg>`;
      case 'bar':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="4" y="9" width="16" height="6" rx="3" fill="${color}"/></svg>`;
      case 'rectSm':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="5" y="7" width="14" height="10" rx="2" fill="${color}"/></svg>`;
      case 'rectLg':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><rect x="3" y="5" width="18" height="14" rx="3" fill="${color}"/></svg>`;
      case 'trapezoid':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><polygon points="7,4 17,4 20,20 4,20" fill="${color}"/></svg>`;
      case 'circleSm':
        return `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="6.5" fill="${color}"/></svg>`;
      case 'circleLg':
      default:
        return `<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="8.5" fill="${color}"/></svg>`;
    }
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
    this.renderSequencerGrid();
  }

  restartLoopTimer() {
    if (this.stepTimer) clearInterval(this.stepTimer);
    const bpm = this.bpms[this.sceneIndex] || 110;
    // Each subdivision step is an 8th note (2 steps per beat)
    const stepMs = ((60 / bpm) / 2) * 1000;
    this.stepTimer = setInterval(() => this.tickStep(), stepMs);
  }

  tickStep() {
    const scene = this.currentScene;
    const pat = this.patterns[this.sceneIndex];
    this.currentStep = (this.currentStep + 1) % scene.beats;
    const col = this.currentStep;

    for (let r = 0; r < 3; r++) {
      if (pat[r][col]) {
        this.triggerRowSoundAndAnim(r);
      }
    }

    this.renderSequencerGrid();
  }

  resizeCanvas() {
    if (!this.stageCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.stageCanvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.stageCanvas.width = Math.floor(rect.width * dpr);
      this.stageCanvas.height = Math.floor(rect.height * dpr);
    }
  }

  startCharacterLoop() {
    const animate = () => {
      this.renderCharacterStage();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  renderCharacterStage() {
    if (!this.stageCanvas) return;
    const ctx = this.stageCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = this.stageCanvas.width;
    const h = this.stageCanvas.height;
    if (w === 0 || h === 0) return;

    const theme = themeManager.getTheme();
    const scene = this.currentScene;
    const now = performance.now();

    // Decay strike animations
    this.animState.bigLeftStrike *= 0.84;
    this.animState.bigRightStrike *= 0.84;
    this.animState.smallStrike *= 0.84;

    if (Math.random() < 0.008) this.animState.bigBlink = 8;
    if (Math.random() < 0.008) this.animState.smallBlink = 8;
    if (Math.random() < 0.004) this.animState.lookingAtEachOther = 75;

    if (this.animState.bigBlink > 0) this.animState.bigBlink--;
    if (this.animState.smallBlink > 0) this.animState.smallBlink--;
    if (this.animState.lookingAtEachOther > 0) this.animState.lookingAtEachOther--;

    ctx.fillStyle = theme.bgCanvas;
    ctx.fillRect(0, 0, w, h);

    // Dynamically scale characters according to canvas height & width so they never clip
    const baseH = Math.min(h * 0.72, 220 * dpr);
    const scaleFactor = Math.min(1, baseH / (180 * dpr));

    const floorY = h * 0.88;
    ctx.strokeStyle = theme.gridBeatLine;
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.moveTo(w * 0.10, floorY);
    ctx.lineTo(w * 0.90, floorY);
    ctx.stroke();

    const breath = Math.sin(now * 0.0032) * 4 * dpr * scaleFactor;
    const headBob = this.isPlaying ? Math.abs(Math.sin(now * 0.012)) * 7 * dpr * scaleFactor : 0;

    // 1. Draw Big Character (Left-Center)
    const bigX = w * 0.38;
    const bigY = floorY;
    const bigColor = themeManager.getNoteColor(scene.bigChar.colorIdx);
    const bigSecColor = themeManager.getNoteColor(scene.bigChar.secondaryIdx);

    this.drawBigCharacter(ctx, bigX, bigY, bigColor, bigSecColor, breath, headBob, dpr * scaleFactor);

    // 2. Draw Small Character (Right)
    const smallX = w * 0.69;
    const smallY = floorY;
    const smallColor = themeManager.getNoteColor(scene.smallChar.colorIdx);
    const smallSecColor = themeManager.getNoteColor(scene.smallChar.secondaryIdx);

    this.drawSmallCharacter(ctx, smallX, smallY, smallColor, smallSecColor, breath, headBob, dpr * scaleFactor);
  }

  drawBigCharacter(ctx, x, floorY, bodyColor, accentColor, breath, headBob, dpr) {
    ctx.save();
    ctx.translate(x, floorY);

    const bodyW = 118 * dpr;
    const bodyH = 138 * dpr + breath - headBob * 0.5;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * dpr, bodyW * 0.65, 10 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Character Body Shape varies by sceneIndex (0: Monkey, 1: Monster, 2: Robot, 3: Bird)
    ctx.fillStyle = bodyColor;
    if (this.sceneIndex === 2) {
      // Boxy Robot
      this.roundRect(ctx, -bodyW / 2, -bodyH, bodyW, bodyH - 12 * dpr, 16 * dpr);
      ctx.fill();
      // Robot Antenna
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, -bodyH);
      ctx.lineTo(0, -bodyH - 22 * dpr);
      ctx.stroke();
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, -bodyH - 24 * dpr, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.sceneIndex === 1) {
      // Horned Monster
      ctx.beginPath();
      ctx.arc(0, -bodyH * 0.52, bodyW * 0.54, 0, Math.PI * 2);
      ctx.fill();
      // Monster Horns
      ctx.fillStyle = accentColor;
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(side * 28 * dpr, -bodyH * 0.9);
        ctx.lineTo(side * 48 * dpr, -bodyH * 1.15);
        ctx.lineTo(side * 12 * dpr, -bodyH * 0.98);
        ctx.closePath();
        ctx.fill();
      });
    } else {
      // Rounded Monkey / Bird
      this.roundRect(ctx, -bodyW / 2, -bodyH, bodyW, bodyH - 10 * dpr, 48 * dpr);
      ctx.fill();
      if (this.sceneIndex === 0) {
        // Monkey Ears
        [-1, 1].forEach(side => {
          ctx.fillStyle = bodyColor;
          ctx.beginPath();
          ctx.arc(side * (bodyW * 0.52), -bodyH * 0.72, 16 * dpr, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    // Eyes (looks toward partner on the right when lookingAtEachOther > 0)
    const lookX = this.animState.lookingAtEachOther > 0 ? 4 * dpr : 0;
    const eyeY = -bodyH * 0.72 + headBob;
    this.drawCharacterEyes(ctx, 0, eyeY, 22 * dpr, this.animState.bigBlink > 0, lookX, dpr);

    // Left & Right Arms + Mallets striking drums in front
    const leftAngle = -0.45 + this.animState.bigLeftStrike * 0.95;
    const rightAngle = 0.45 - this.animState.bigRightStrike * 0.95;

    // Left Arm + Drum 1 (High)
    ctx.save();
    ctx.translate(-bodyW * 0.45, -bodyH * 0.48);
    ctx.rotate(leftAngle);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 10 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-28 * dpr, 38 * dpr);
    ctx.stroke();
    ctx.restore();

    // Right Arm + Drum 2 (Low)
    ctx.save();
    ctx.translate(bodyW * 0.45, -bodyH * 0.48);
    ctx.rotate(rightAngle);
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 10 * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(28 * dpr, 38 * dpr);
    ctx.stroke();
    ctx.restore();

    // Foreground Instruments (2 Timpani / Drums / Woodblocks / Congas)
    const drum1Scale = 1 + this.animState.bigLeftStrike * 0.16;
    const drum2Scale = 1 + this.animState.bigRightStrike * 0.16;

    // Left Drum (High)
    ctx.save();
    ctx.translate(-44 * dpr, -22 * dpr);
    ctx.scale(drum1Scale, drum1Scale);
    ctx.fillStyle = accentColor;
    this.roundRect(ctx, -26 * dpr, -18 * dpr, 52 * dpr, 36 * dpr, 10 * dpr);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -16 * dpr, 24 * dpr, 6 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right Drum (Low)
    ctx.save();
    ctx.translate(44 * dpr, -24 * dpr);
    ctx.scale(drum2Scale, drum2Scale);
    ctx.fillStyle = themeManager.getNoteColor(this.currentScene.rows[2].colorIdx);
    this.roundRect(ctx, -32 * dpr, -22 * dpr, 64 * dpr, 44 * dpr, 12 * dpr);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -20 * dpr, 29 * dpr, 7 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  drawSmallCharacter(ctx, x, floorY, bodyColor, accentColor, breath, headBob, dpr) {
    ctx.save();
    ctx.translate(x, floorY);

    const bodyW = 84 * dpr;
    const bodyH = 96 * dpr + breath * 0.8 - headBob * 0.4;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 4 * dpr, bodyW * 0.6, 8 * dpr, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = bodyColor;
    if (this.sceneIndex === 2) {
      this.roundRect(ctx, -bodyW / 2, -bodyH, bodyW, bodyH - 8 * dpr, 12 * dpr);
      ctx.fill();
    } else {
      this.roundRect(ctx, -bodyW / 2, -bodyH, bodyW, bodyH - 8 * dpr, 36 * dpr);
      ctx.fill();
    }

    // Eyes (looks left toward Big Partner when lookingAtEachOther > 0)
    const lookX = this.animState.lookingAtEachOther > 0 ? -4 * dpr : 0;
    const eyeY = -bodyH * 0.68 + headBob;
    this.drawCharacterEyes(ctx, 0, eyeY, 16 * dpr, this.animState.smallBlink > 0, lookX, dpr);

    // Held Percussion Instrument (Triangle / Clave / Cowbell / Bass Tom)
    const strikeScale = 1 + this.animState.smallStrike * 0.25;
    ctx.save();
    ctx.translate(-36 * dpr, -bodyH * 0.45);
    ctx.scale(strikeScale, strikeScale);
    const instColor = themeManager.getNoteColor(this.currentScene.rows[0].colorIdx);
    ctx.strokeStyle = instColor;
    ctx.fillStyle = instColor;
    ctx.lineWidth = 4 * dpr;

    if (this.sceneIndex === 0) {
      // Metallic Triangle
      ctx.beginPath();
      ctx.moveTo(0, -18 * dpr);
      ctx.lineTo(18 * dpr, 14 * dpr);
      ctx.lineTo(-18 * dpr, 14 * dpr);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, 16 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
  }

  drawCharacterEyes(ctx, cx, cy, spacing, isBlinking, pupilOffsetX, dpr) {
    [-1, 1].forEach(side => {
      const ex = cx + side * spacing;
      if (isBlinking) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5 * dpr;
        ctx.beginPath();
        ctx.moveTo(ex - 7 * dpr, cy);
        ctx.lineTo(ex + 7 * dpr, cy);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, cy, 8.5 * dpr, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(ex + pupilOffsetX, cy, 4.2 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    });
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
}
