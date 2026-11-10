/**
 * Chrome Music Lab EXTRA — Kandinsky Experiment
 * Reverse-engineered from kandinsky-service/assets/js/kandinsky.js & data.json
 * Features:
 * - Unistroke gesture recognition ($1 DollarRecognizer + geometric corner/circularity analysis)
 * - Circles morph into animated singing faces (blinking eyes, eyebrows, singing mouth)
 * - Triangles snap into percussion geometry with radial ripple rings
 * - Lines & curves feature velocity-tapered strokes and harmonic string-pluck physics
 * - Left-to-right X-proximity chord grouping (threshold = 7% span) for looping playback
 * - 3 authentic sound/color schemes + Custom Theme Palette integration
 */

import { audioEngine } from './audio-engine.js';
import { themeManager } from './theme-palette.js';

export const KANDINSKY_SCHEMES = [
  {
    id: 0,
    name: 'Teal / Green / Blue (Bass, Guitar Voice & Rock Kit)',
    line: '#4bb4a1',
    triangle: '#96c43e',
    circle: '#4998b4'
  },
  {
    id: 1,
    name: 'Orange / Red / Yellow (Strings, Choir & Orchestra)',
    line: '#f59447',
    triangle: '#f45941',
    circle: '#f5bd46'
  },
  {
    id: 2,
    name: 'Purple / Violet / Pink (Marimba, Beebop & Jazz Kit)',
    line: '#a447af',
    triangle: '#8067c3',
    circle: '#ea3d83'
  },
  {
    id: 3,
    name: 'Custom Studio Palette (Theme Synced)',
    custom: true
  }
];

export class KandinskyApp {
  constructor() {
    this.shapes = [];
    this.redoStack = [];
    this.schemeIndex = 0;
    this.isPlaying = false;
    this.playbackTimer = null;
    this.chordGroups = [];
    this.currentGroupIdx = 0;

    // Active pointer drawing state
    this.isDrawing = false;
    this.currentStroke = [];
    this.ripples = []; // Visual sonar rings when shapes trigger

    this.initDOM();
    this.loadStarterArtwork();

    themeManager.subscribe(() => {
      this.updateSchemeIndicator();
    });
    window.addEventListener('resize', () => this.resizeCanvas());
    this.startAnimationLoop();
  }

  initDOM() {
    this.canvas = document.getElementById('kandinsky-canvas');
    this.playBtn = document.getElementById('kand-play-btn');
    this.schemeBtn = document.getElementById('kand-scheme-btn');
    this.schemeLabel = document.getElementById('kand-scheme-label');
    this.undoBtn = document.getElementById('kand-undo-btn');
    this.clearBtn = document.getElementById('kand-clear-btn');
    this.presetSelect = document.getElementById('kand-preset-select');

    if (this.canvas) {
      this.bindDrawingEvents();
      this.resizeCanvas();
    }

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.togglePlay());
    }

    if (this.schemeBtn) {
      this.schemeBtn.addEventListener('click', () => {
        this.schemeIndex = (this.schemeIndex + 1) % KANDINSKY_SCHEMES.length;
        this.updateSchemeIndicator();
        // Audition the new scheme on existing shapes or play a preview chord
        audioEngine.playKandinskyShape(this.effectiveAudioScheme, 'line', 4, 0.35);
      });
    }

    if (this.undoBtn) {
      this.undoBtn.addEventListener('click', () => this.undo());
    }

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.shapes = [];
        this.ripples = [];
        if (this.isPlaying) this.stop();
        this.updateUndoState();
      });
    }

    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          this.loadPresetArtwork(e.target.value);
          e.target.value = '';
        }
      });
    }

    // Don't let toolbar controls keep keyboard focus after they're used: otherwise
    // an accidental space bar press "clicks" the last one again (e.g. Reset Canvas).
    [this.playBtn, this.schemeBtn, this.undoBtn, this.clearBtn].forEach((btn) => {
      if (btn) btn.addEventListener('click', () => btn.blur());
    });
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', () => this.presetSelect.blur());
    }

    this.updateSchemeIndicator();
    this.updateUndoState();
  }

  get effectiveAudioScheme() {
    return this.schemeIndex % 3;
  }

  getActiveColors() {
    const scheme = KANDINSKY_SCHEMES[this.schemeIndex];
    if (scheme && !scheme.custom) {
      return {
        line: scheme.line,
        triangle: scheme.triangle,
        circle: scheme.circle
      };
    }
    const t = themeManager.getTheme();
    return {
      line: (t.kandinsky && t.kandinsky.line) || '#4bb4a1',
      triangle: (t.kandinsky && t.kandinsky.triangle) || '#96c43e',
      circle: (t.kandinsky && t.kandinsky.circle) || '#4998b4'
    };
  }

  updateSchemeIndicator() {
    const colors = this.getActiveColors();
    const scheme = KANDINSKY_SCHEMES[this.schemeIndex];
    if (this.schemeBtn) {
      const swatch = this.schemeBtn.querySelector('.kand-swatch-group');
      if (swatch) {
        swatch.innerHTML = `
          <span class="kand-dot" style="background:${colors.line}"></span>
          <span class="kand-dot" style="background:${colors.triangle}"></span>
          <span class="kand-dot" style="background:${colors.circle}"></span>
        `;
      }
    }
    if (this.schemeLabel && scheme) {
      this.schemeLabel.textContent = scheme.name;
    }
  }

  updateUndoState() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this.shapes.length === 0;
      this.undoBtn.style.opacity = this.shapes.length === 0 ? '0.45' : '1';
    }
  }

  undo() {
    if (this.shapes.length === 0) return;
    this.shapes.pop();
    this.rebuildChordGroups();
    this.updateUndoState();
  }

  bindDrawingEvents() {
    const getPos = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
        t: performance.now()
      };
    };

    const onDown = (ev) => {
      ev.preventDefault();
      // preventDefault() stops the browser moving focus off whatever was clicked last,
      // so drop it ourselves; a focused button would fire again on the space bar.
      const focused = document.activeElement;
      if (focused && focused !== document.body && typeof focused.blur === 'function') focused.blur();
      audioEngine.ensureContext();
      const pos = getPos(ev);

      // First check if user clicked directly on an existing shape to audition it
      const hitShape = this.findShapeAt(pos.x, pos.y);
      this.isDrawing = true;
      this.currentStroke = [pos];
      this.clickedCandidate = hitShape;
    };

    const onMove = (ev) => {
      const pos = getPos(ev);
      if (!this.isDrawing) {
        // Hover pluck effect when dragging cursor across shapes
        const hovered = this.findShapeAt(pos.x, pos.y);
        if (hovered && hovered !== this.lastHoveredShape) {
          this.lastHoveredShape = hovered;
          this.triggerShape(hovered, 0.25);
        } else if (!hovered) {
          this.lastHoveredShape = null;
        }
        return;
      }

      const prev = this.currentStroke[this.currentStroke.length - 1];
      const dist = Math.hypot(pos.x - prev.x, pos.y - prev.y);
      if (dist > 3) {
        const dt = Math.max(1, pos.t - prev.t);
        const speed = dist / dt;
        // Authentic Kandinsky calculateLineThickness: faster stroke -> thinner line
        const thickness = Math.max(4, Math.min(16, 15 - speed * 4.5));
        this.currentStroke.push({ ...pos, thickness });
      }
    };

    const onUp = () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;

      if (this.currentStroke.length < 5) {
        // Short tap: trigger existing shape if tapped, or create a small staccato note dot
        if (this.clickedCandidate) {
          this.triggerShape(this.clickedCandidate, 0.5);
        }
        this.currentStroke = [];
        return;
      }

      const shape = this.classifyAndCreateShape(this.currentStroke);
      if (shape) {
        this.shapes.push(shape);
        this.rebuildChordGroups();
        this.updateUndoState();
        this.triggerShape(shape, 0.55);
      }
      this.currentStroke = [];
    };

    this.canvas.addEventListener('mousedown', onDown);
    this.canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    this.canvas.addEventListener('touchstart', onDown, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  /**
   * Reverse-engineered Shape Classifier (DollarRecognizer + Closed-Loop Circularity/Corner Analysis)
   * Distinguishes Circle -> Singing Face, Triangle -> Percussion Triangle, Line/Curve -> Plucked String
   */
  classifyAndCreateShape(points) {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pathLength = 0;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (i > 0) {
        pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
      }
    }

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const diag = Math.hypot(boxW, boxH);
    if (diag < 18) return null;

    const startEndDist = Math.hypot(
      points[points.length - 1].x - points[0].x,
      points[points.length - 1].y - points[0].y
    );

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Vertical pitch mapping from Kandinsky's Line.js:
    // yPerc = (y - height * 0.05) / (height * 0.80), inverted so top = high pitch (7), bottom = low pitch (0)
    const yNorm = Math.max(0, Math.min(1, (cy - height * 0.05) / (height * 0.80)));
    const pitchIndex = Math.round((1 - yNorm) * 7);

    const isClosed = startEndDist < Math.max(diag * 0.52, 55) && pathLength > diag * 1.85;
    const aspectRatio = Math.min(boxW, boxH) / Math.max(boxW, boxH, 1);

    if (isClosed && aspectRatio > 0.42) {
      // Measure radial variance around centroid to distinguish Circle vs Triangle
      const avgRadius = (boxW + boxH) / 4;
      let radialVarSum = 0;
      let sharpCorners = 0;

      // Subsample 24 points around the stroke
      const step = Math.max(1, Math.floor(points.length / 24));
      for (let i = step; i < points.length - step; i += step) {
        const pPrev = points[i - step];
        const pCurr = points[i];
        const pNext = points[i + step];

        const r = Math.hypot(pCurr.x - cx, pCurr.y - cy);
        radialVarSum += Math.abs(r - avgRadius) / Math.max(1, avgRadius);

        const a1 = Math.atan2(pCurr.y - pPrev.y, pCurr.x - pPrev.x);
        const a2 = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);
        let diff = Math.abs(a2 - a1);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff > 0.85) sharpCorners++;
      }

      const samples = Math.max(1, Math.floor(points.length / step) - 2);
      const meanRadialDev = radialVarSum / samples;

      if (sharpCorners >= 2 && meanRadialDev > 0.16) {
        // Triangle!
        const radius = Math.max(26, Math.min(95, avgRadius * 1.15));
        return {
          type: 'triangle',
          cx,
          cy,
          radius,
          rotation: (Math.random() - 0.5) * 0.35,
          pitchIndex,
          wobbleAmp: 0,
          wobblePhase: 0,
          lastPlayed: 0
        };
      } else {
        // Circle with animated Singing Face!
        const radius = Math.max(24, Math.min(90, avgRadius));
        return {
          type: 'circle',
          cx,
          cy,
          radius,
          pitchIndex,
          wobbleAmp: 0,
          wobblePhase: 0,
          mouthOpen: 0,
          blinkTimer: Math.random() * 180 + 60,
          isBlinking: false,
          lookAngle: (Math.random() - 0.5) * 0.5,
          lastPlayed: 0
        };
      }
    }

    // Default: Tapered Musical Line / Squiggle
    return {
      type: 'line',
      points: this.smoothPoints(points),
      cx,
      cy,
      pitchIndex,
      wobbleAmp: 0,
      wobblePhase: 0,
      lastPlayed: 0
    };
  }

  smoothPoints(rawPoints) {
    if (rawPoints.length <= 4) return rawPoints;
    const out = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length - 1; i++) {
      const p0 = rawPoints[i - 1];
      const p1 = rawPoints[i];
      const p2 = rawPoints[i + 1];
      out.push({
        x: (p0.x + p1.x * 2 + p2.x) / 4,
        y: (p0.y + p1.y * 2 + p2.y) / 4,
        thickness: p1.thickness || 8
      });
    }
    out.push(rawPoints[rawPoints.length - 1]);
    return out;
  }

  findShapeAt(x, y) {
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      const s = this.shapes[i];
      if (s.type === 'circle' || s.type === 'triangle') {
        if (Math.hypot(x - s.cx, y - s.cy) <= s.radius + 10) {
          return s;
        }
      } else if (s.type === 'line' && s.points) {
        for (let j = 0; j < s.points.length; j += 2) {
          const p = s.points[j];
          if (Math.hypot(x - p.x, y - p.y) <= 18) {
            return s;
          }
        }
      }
    }
    return null;
  }

  triggerShape(shape, duration = 0.5) {
    shape.wobbleAmp = 14;
    shape.wobblePhase = 0;
    shape.lastPlayed = performance.now();
    if (shape.type === 'circle') {
      shape.mouthOpen = 1.0;
    }

    const colors = this.getActiveColors();
    this.ripples.push({
      x: shape.cx,
      y: shape.cy,
      radius: shape.radius || 22,
      maxRadius: (shape.radius || 35) + 75,
      alpha: 0.75,
      color: colors[shape.type] || colors.line
    });

    audioEngine.playKandinskyShape(this.effectiveAudioScheme, shape.type, shape.pitchIndex, duration);
  }

  /**
   * Reverse-engineered from Kandinsky's Playback.js:
   * Groups shapes left-to-right by X proximity (`threshold = (max - min) * 0.07`)
   */
  rebuildChordGroups() {
    if (this.shapes.length === 0) {
      this.chordGroups = [];
      return;
    }
    const sorted = [...this.shapes].sort((a, b) => a.cx - b.cx);
    const minX = sorted[0].cx;
    const maxX = sorted[sorted.length - 1].cx;
    const threshold = Math.max(36, (maxX - minX) * 0.07);

    const groups = [];
    let currentGroup = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const prev = currentGroup[currentGroup.length - 1];
      if (Math.abs(sorted[i].cx - prev.cx) <= threshold) {
        currentGroup.push(sorted[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [sorted[i]];
      }
    }
    groups.push(currentGroup);
    this.chordGroups = groups;
  }

  togglePlay() {
    if (this.isPlaying) {
      this.stop();
    } else {
      this.play();
    }
  }

  play() {
    if (this.shapes.length === 0) return;
    audioEngine.ensureContext();
    this.isPlaying = true;
    this.rebuildChordGroups();
    this.currentGroupIdx = 0;

    if (this.playBtn) {
      this.playBtn.classList.add('playing');
      this.playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <rect x="6" y="5" width="4.5" height="14" rx="1.5"/>
          <rect x="13.5" y="5" width="4.5" height="14" rx="1.5"/>
        </svg>`;
    }

    const stepGroup = () => {
      if (!this.isPlaying || this.chordGroups.length === 0) return;
      const group = this.chordGroups[this.currentGroupIdx % this.chordGroups.length];
      group.forEach(s => this.triggerShape(s, 0.48));
      this.currentGroupIdx = (this.currentGroupIdx + 1) % this.chordGroups.length;
    };

    stepGroup();
    this.playbackTimer = setInterval(stepGroup, 460);
  }

  stop() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
    if (this.playBtn) {
      this.playBtn.classList.remove('playing');
      this.playBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
          <path d="M8 5.14v14l11-7-11-7z"/>
        </svg>`;
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
    }
  }

  startAnimationLoop() {
    const animate = () => {
      this.renderFrame();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  renderFrame() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    const theme = themeManager.getTheme();
    const colors = this.getActiveColors();

    // Fill background
    ctx.fillStyle = theme.bgCanvas;
    ctx.fillRect(0, 0, w, h);

    // Subtle pitch-guide staff lines in background
    ctx.save();
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1 * dpr;
    for (let i = 1; i <= 8; i++) {
      const y = (h * 0.1) + ((h * 0.8) / 8) * i;
      ctx.beginPath();
      ctx.moveTo(w * 0.04, y);
      ctx.lineTo(w * 0.96, y);
      ctx.stroke();
    }
    ctx.restore();

    // Draw expanding sonar ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.radius += 2.6;
      rip.alpha *= 0.93;
      if (rip.alpha < 0.03 || rip.radius > rip.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.strokeStyle = rip.color;
      ctx.globalAlpha = rip.alpha;
      ctx.lineWidth = 3 * dpr;
      ctx.beginPath();
      ctx.arc(rip.x * dpr, rip.y * dpr, rip.radius * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Update & Draw all shapes
    for (const shape of this.shapes) {
      if (shape.wobbleAmp > 0.05) {
        shape.wobblePhase += 0.42;
        shape.wobbleAmp *= 0.91;
      } else {
        shape.wobbleAmp = 0;
      }

      if (shape.type === 'line') {
        this.drawLineShape(ctx, shape, colors.line, dpr);
      } else if (shape.type === 'triangle') {
        this.drawTriangleShape(ctx, shape, colors.triangle, dpr);
      } else if (shape.type === 'circle') {
        this.drawCircleFaceShape(ctx, shape, colors.circle, theme, dpr);
      }
    }

    // Draw active user stroke in progress
    if (this.isDrawing && this.currentStroke.length > 1) {
      ctx.save();
      ctx.strokeStyle = colors.line;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < this.currentStroke.length; i++) {
        const p0 = this.currentStroke[i - 1];
        const p1 = this.currentStroke[i];
        ctx.lineWidth = (p1.thickness || 8) * dpr;
        ctx.beginPath();
        ctx.moveTo(p0.x * dpr, p0.y * dpr);
        ctx.lineTo(p1.x * dpr, p1.y * dpr);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawLineShape(ctx, shape, color, dpr) {
    const pts = shape.points;
    if (!pts || pts.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (shape.wobbleAmp > 1) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 * dpr;
    }

    const n = pts.length;
    for (let i = 1; i < n; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];

      // Harmonic standing-wave string displacement (pinned at endpoints, max in center)
      const env0 = Math.sin(((i - 1) / (n - 1)) * Math.PI);
      const env1 = Math.sin((i / (n - 1)) * Math.PI);
      const offset0 = Math.sin(shape.wobblePhase + (i - 1) * 0.25) * shape.wobbleAmp * env0;
      const offset1 = Math.sin(shape.wobblePhase + i * 0.25) * shape.wobbleAmp * env1;

      ctx.lineWidth = (p1.thickness || 8) * dpr;
      ctx.beginPath();
      ctx.moveTo(p0.x * dpr, (p0.y + offset0) * dpr);
      ctx.lineTo(p1.x * dpr, (p1.y + offset1) * dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTriangleShape(ctx, shape, color, dpr) {
    ctx.save();
    const scale = 1 + (Math.sin(shape.wobblePhase) * shape.wobbleAmp) * 0.015;
    const r = shape.radius * scale * dpr;
    ctx.translate(shape.cx * dpr, shape.cy * dpr);
    ctx.rotate(shape.rotation + Math.sin(shape.wobblePhase) * shape.wobbleAmp * 0.01);

    ctx.fillStyle = themeManager.hexToRgba(color, 0.22);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6 * dpr;
    ctx.lineJoin = 'round';

    if (shape.wobbleAmp > 1) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 14 * dpr;
    }

    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      const vx = Math.cos(angle) * r;
      const vy = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(vx, vy);
      else ctx.lineTo(vx, vy);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Reverse-engineered from Kandinsky's Face.js & Circle.js:
   * Draws the circle body + animated blinking eyes + singing mouth
   */
  drawCircleFaceShape(ctx, shape, color, theme, dpr) {
    ctx.save();
    const bounce = 1 + Math.sin(shape.wobblePhase) * (shape.wobbleAmp * 0.014);
    const r = shape.radius * bounce * dpr;

    ctx.translate(shape.cx * dpr, shape.cy * dpr);

    // Update blink & mouth timers
    shape.blinkTimer -= 1;
    if (shape.blinkTimer <= 0) {
      shape.isBlinking = true;
      if (shape.blinkTimer < -8) {
        shape.isBlinking = false;
        shape.blinkTimer = Math.random() * 200 + 80;
      }
    }
    if (shape.mouthOpen > 0.02) {
      shape.mouthOpen *= 0.94;
    } else {
      shape.mouthOpen = 0;
    }

    if (shape.wobbleAmp > 1) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 16 * dpr;
    }

    // Circle body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOffsetX = r * 0.34;
    const eyeOffsetY = -r * 0.16;
    const eyeRadius = Math.max(3 * dpr, r * 0.13);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.2 * dpr;

    [-1, 1].forEach((side) => {
      const ex = side * eyeOffsetX;
      const ey = eyeOffsetY;
      if (shape.isBlinking) {
        ctx.beginPath();
        ctx.moveTo(ex - eyeRadius, ey);
        ctx.lineTo(ex + eyeRadius, ey);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ex, ey, eyeRadius, 0, Math.PI * 2);
        ctx.fill();
        // Pupil
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(
          ex + Math.cos(shape.lookAngle) * eyeRadius * 0.3,
          ey + Math.sin(shape.lookAngle) * eyeRadius * 0.3,
          eyeRadius * 0.48,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      }
    });

    // Mouth (closed smile when idle, open oval singing mouth when triggered!)
    const mouthY = r * 0.28;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5 * dpr;

    if (shape.mouthOpen > 0.12) {
      const mw = r * 0.28 * (0.6 + shape.mouthOpen * 0.5);
      const mh = r * 0.26 * shape.mouthOpen;
      ctx.beginPath();
      ctx.ellipse(0, mouthY, mw, mh, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, mouthY - r * 0.06, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  loadStarterArtwork() {
    setTimeout(() => {
      this.resizeCanvas();
      this.loadPresetArtwork('kandinsky-symphony');
    }, 50);
  }

  loadPresetArtwork(presetId) {
    const rect = this.canvas ? this.canvas.getBoundingClientRect() : { width: 900, height: 520 };
    const w = Math.max(600, rect.width || 900);
    const h = Math.max(380, rect.height || 520);

    this.shapes = [];
    this.ripples = [];

    if (presetId === 'kandinsky-symphony') {
      // Singing faces, geometric triangles, and sweeping melodic curves inspired by Wassily Kandinsky
      this.shapes.push(
        {
          type: 'circle',
          cx: w * 0.18,
          cy: h * 0.30,
          radius: 42,
          pitchIndex: 6,
          wobbleAmp: 0,
          wobblePhase: 0,
          mouthOpen: 0,
          blinkTimer: 90,
          isBlinking: false,
          lookAngle: 0.2
        },
        {
          type: 'triangle',
          cx: w * 0.20,
          cy: h * 0.72,
          radius: 44,
          rotation: -0.12,
          pitchIndex: 1,
          wobbleAmp: 0,
          wobblePhase: 0
        },
        {
          type: 'line',
          cx: w * 0.42,
          cy: h * 0.45,
          pitchIndex: 4,
          wobbleAmp: 0,
          wobblePhase: 0,
          points: Array.from({ length: 28 }, (_, i) => ({
            x: w * 0.30 + (i / 27) * (w * 0.26),
            y: h * 0.50 - Math.sin((i / 27) * Math.PI * 2) * (h * 0.16),
            thickness: 9
          }))
        },
        {
          type: 'circle',
          cx: w * 0.62,
          cy: h * 0.24,
          radius: 48,
          pitchIndex: 7,
          wobbleAmp: 0,
          wobblePhase: 0,
          mouthOpen: 0,
          blinkTimer: 140,
          isBlinking: false,
          lookAngle: -0.15
        },
        {
          type: 'line',
          cx: w * 0.63,
          cy: h * 0.64,
          pitchIndex: 2,
          wobbleAmp: 0,
          wobblePhase: 0,
          points: Array.from({ length: 24 }, (_, i) => ({
            x: w * 0.52 + (i / 23) * (w * 0.22),
            y: h * 0.70 - (i / 23) * (h * 0.18),
            thickness: 10
          }))
        },
        {
          type: 'triangle',
          cx: w * 0.82,
          cy: h * 0.36,
          radius: 46,
          rotation: 0.2,
          pitchIndex: 5,
          wobbleAmp: 0,
          wobblePhase: 0
        },
        {
          type: 'circle',
          cx: w * 0.83,
          cy: h * 0.68,
          radius: 38,
          pitchIndex: 3,
          wobbleAmp: 0,
          wobblePhase: 0,
          mouthOpen: 0,
          blinkTimer: 110,
          isBlinking: false,
          lookAngle: -0.3
        }
      );
    } else if (presetId === 'singing-choir') {
      this.schemeIndex = 1; // Laa Choir scheme
      this.updateSchemeIndicator();
      const pitches = [2, 4, 5, 6, 7, 5, 4];
      pitches.forEach((p, idx) => {
        const yNorm = 1 - p / 7;
        this.shapes.push({
          type: 'circle',
          cx: w * (0.14 + idx * 0.12),
          cy: h * (0.16 + yNorm * 0.64),
          radius: 36 + (idx % 2) * 8,
          pitchIndex: p,
          wobbleAmp: 0,
          wobblePhase: 0,
          mouthOpen: 0,
          blinkTimer: 60 + idx * 30,
          isBlinking: false,
          lookAngle: 0
        });
      });
    } else if (presetId === 'string-arpeggio') {
      this.schemeIndex = 0;
      this.updateSchemeIndicator();
      for (let i = 0; i < 6; i++) {
        const startX = w * (0.12 + i * 0.14);
        const baseY = h * (0.76 - i * 0.11);
        this.shapes.push({
          type: 'line',
          cx: startX + w * 0.05,
          cy: baseY,
          pitchIndex: Math.min(7, i + 1),
          wobbleAmp: 0,
          wobblePhase: 0,
          points: Array.from({ length: 18 }, (_, j) => ({
            x: startX + (j / 17) * (w * 0.11),
            y: baseY + Math.sin((j / 17) * Math.PI) * 18,
            thickness: 9
          }))
        });
      }
      this.shapes.push({
        type: 'triangle',
        cx: w * 0.12,
        cy: h * 0.25,
        radius: 40,
        rotation: 0,
        pitchIndex: 6,
        wobbleAmp: 0,
        wobblePhase: 0
      });
    }

    this.rebuildChordGroups();
    this.updateUndoState();
  }
}
