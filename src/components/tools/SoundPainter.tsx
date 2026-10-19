import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Undo2,
  Sparkles,
  Palette,
  Volume2,
  FileQuestion,
  HelpCircle,
  Lightbulb,
  Download,
  Flame,
} from 'lucide-react';
import {
  playSingingFace,
  playMetallicTriangle,
  playLineTone,
  playMusicNote,
  noteToFreq,
  getToolboxAudioContext,
} from './toolboxAudio';
import { Pitch } from '../../types/music';
import { containsProfanity } from '../../utils/profanityFilter';

// Color Palette for Kandinsky-style drawing
interface PaintColor {
  id: string;
  name: string;
  hex: string;
  instrument: string;
  glow: string;
}

const PALETTE: PaintColor[] = [
  { id: 'yellow', name: 'Sun Yellow', hex: '#FACC15', instrument: 'Bell Chimes', glow: 'shadow-yellow-400/50' },
  { id: 'rose', name: 'Bubblegum Rose', hex: '#F43F5E', instrument: 'Singing Voice', glow: 'shadow-rose-400/50' },
  { id: 'cyan', name: 'Neon Sky', hex: '#06B6D4', instrument: 'Concert Flute', glow: 'shadow-cyan-400/50' },
  { id: 'emerald', name: 'Spring Emerald', hex: '#10B981', instrument: 'Marimba', glow: 'shadow-emerald-400/50' },
  { id: 'purple', name: 'Cosmic Violet', hex: '#A855F7', instrument: 'Synth Harp', glow: 'shadow-purple-400/50' },
  { id: 'orange', name: 'Warm Sunset', hex: '#FB923C', instrument: 'Acoustic Guitar', glow: 'shadow-orange-400/50' },
];

// Pentatonic scale pitches from bottom to top (C3 up to C6)
const PENTATONIC_SCALE: Pitch[] = [
  { step: 'C', octave: 3 },
  { step: 'D', octave: 3 },
  { step: 'E', octave: 3 },
  { step: 'G', octave: 3 },
  { step: 'A', octave: 3 },
  { step: 'C', octave: 4 },
  { step: 'D', octave: 4 },
  { step: 'E', octave: 4 },
  { step: 'G', octave: 4 },
  { step: 'A', octave: 4 },
  { step: 'C', octave: 5 },
  { step: 'D', octave: 5 },
  { step: 'E', octave: 5 },
  { step: 'G', octave: 5 },
  { step: 'A', octave: 5 },
  { step: 'C', octave: 6 },
];

export interface DrawnShape {
  id: string;
  type: 'circle' | 'triangle' | 'line';
  color: string;
  points: { x: number; y: number }[]; // Normalized 0..1
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  center: { x: number; y: number }; // Normalized 0..1
  radius?: number; // Normalized
  pitch: Pitch;
  isActive?: boolean;
}

export const SoundPainter: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedColor, setSelectedColor] = useState<PaintColor>(PALETTE[0]);
  const [shapes, setShapes] = useState<DrawnShape[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadPos, setPlayheadPos] = useState<number>(0); // 0 to 1
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(4); // loop duration in seconds
  const [showReflection, setShowReflection] = useState<boolean>(false);
  const [reflectionText, setReflectionText] = useState<{
    mood: string;
    shapesMeaning: string;
    pitchExplanation: string;
  }>({
    mood: 'Cheerful and energetic',
    shapesMeaning: 'Circles are singing stars, lines are ocean wave melodies, triangles are lightning beats!',
    pitchExplanation: 'Drawing high up makes bright bird sounds, drawing near the bottom makes low thunder sounds.',
  });

  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastActiveShapesRef = useRef<Set<string>>(new Set());

  // Convert canvas pixel coordinates to 0..1 normalized coords
  const getNormalizedPoint = useCallback((e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Map normalized Y (0 at top, 1 at bottom) to musical pitch (higher Y pixel = lower pitch)
  const mapYToPitch = useCallback((y: number): Pitch => {
    const invertedY = 1 - Math.max(0, Math.min(1, y));
    const idx = Math.min(
      PENTATONIC_SCALE.length - 1,
      Math.floor(invertedY * PENTATONIC_SCALE.length)
    );
    return PENTATONIC_SCALE[idx];
  }, []);

  // Classify stroke: Circle, Triangle, or Line
  const classifyStroke = useCallback(
    (pts: { x: number; y: number }[], color: string): DrawnShape => {
      let minX = 1;
      let maxX = 0;
      let minY = 1;
      let maxY = 0;
      let sumX = 0;
      let sumY = 0;

      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        sumX += p.x;
        sumY += p.y;
      }

      const count = pts.length;
      const centerX = sumX / count;
      const centerY = sumY / count;
      const width = maxX - minX;
      const height = maxY - minY;

      const firstPt = pts[0];
      const lastPt = pts[pts.length - 1];
      const endDist = Math.hypot(firstPt.x - lastPt.x, firstPt.y - lastPt.y);
      const diagonal = Math.hypot(width, height);

      // Check circularity
      const isClosed = endDist < Math.max(0.08, diagonal * 0.35);
      const aspectRatio = width / (height || 0.001);

      let shapeType: 'circle' | 'triangle' | 'line' = 'line';

      if (isClosed && diagonal > 0.05 && pts.length >= 8) {
        if (aspectRatio >= 0.55 && aspectRatio <= 1.8) {
          // Check variance of radius to see if it's circular
          const avgRadius = diagonal / 2;
          let variance = 0;
          for (const p of pts) {
            const dist = Math.hypot(p.x - centerX, p.y - centerY);
            variance += Math.abs(dist - avgRadius);
          }
          variance /= pts.length;
          if (variance < avgRadius * 0.45) {
            shapeType = 'circle';
          } else {
            shapeType = 'triangle';
          }
        } else {
          shapeType = 'triangle';
        }
      }

      const pitch = mapYToPitch(centerY);

      return {
        id: 'shape-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        type: shapeType,
        color,
        points: pts,
        bounds: { minX, maxX, minY, maxY },
        center: { x: centerX, y: centerY },
        radius: diagonal / 2,
        pitch,
      };
    },
    [mapYToPitch]
  );

  // Play a shape's unique sound
  const playShapeSound = useCallback((shape: DrawnShape) => {
    const freq = noteToFreq(shape.pitch.step, shape.pitch.octave);
    if (shape.type === 'circle') {
      playSingingFace(freq, 0.65);
    } else if (shape.type === 'triangle') {
      playMetallicTriangle(Math.min(1800, freq * 1.5));
    } else {
      playLineTone(freq, 0.35);
    }
  }, []);

  // Stroke event handlers
  const handleStartDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawingRef.current = true;
    const pt = getNormalizedPoint(e, canvas);
    currentStrokeRef.current = [pt];
    getToolboxAudioContext().catch(() => {});
  };

  const handleMoveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = getNormalizedPoint(e, canvas);
    const last = currentStrokeRef.current[currentStrokeRef.current.length - 1];
    // Add point if moved slightly
    if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.005) {
      currentStrokeRef.current.push(pt);
      // Play brief feedback tone as you paint
      if (currentStrokeRef.current.length % 5 === 0) {
        const p = mapYToPitch(pt.y);
        playLineTone(noteToFreq(p.step, p.octave), 0.12);
      }
    }
  };

  const handleEndDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const pts = currentStrokeRef.current;
    if (pts.length >= 2) {
      const shape = classifyStroke(pts, selectedColor.hex);
      setShapes((prev) => [...prev, shape]);
      playShapeSound(shape);
    }
    currentStrokeRef.current = [];
  };

  // Playback Loop Animation & Sound Trigger
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastActiveShapesRef.current.clear();
      return;
    }

    let startTime = performance.now();
    const loopDurationMs = playbackSpeed * 1000;

    const tick = (now: number) => {
      const elapsed = (now - startTime) % loopDurationMs;
      const currentPos = elapsed / loopDurationMs;
      setPlayheadPos(currentPos);

      // Check for shapes intersecting current playhead window
      const triggerThreshold = 0.025;
      const activeIds = new Set<string>();

      shapes.forEach((s) => {
        let triggerX = s.center.x;
        if (s.type === 'line') {
          // Find point on line closest to currentPos
          const matching = s.points.find((p) => Math.abs(p.x - currentPos) < triggerThreshold);
          if (matching) triggerX = matching.x;
        }

        const isHit = Math.abs(triggerX - currentPos) < triggerThreshold;
        if (isHit) {
          activeIds.add(s.id);
          if (!lastActiveShapesRef.current.has(s.id)) {
            playShapeSound(s);
          }
        }
      });

      lastActiveShapesRef.current = activeIds;
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, shapes, playShapeSound]);

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Subtle starry/grid background
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal staff-pitch guidelines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 8; i++) {
      const y = (height / 9) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw all saved shapes
    shapes.forEach((shape) => {
      const isActive = lastActiveShapesRef.current.has(shape.id);

      ctx.save();
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = shape.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'circle') {
        const cx = shape.center.x * width;
        const cy = shape.center.y * height;
        const r = Math.max(16, (shape.radius || 0.05) * width);

        // Glow ring
        if (isActive) {
          ctx.beginPath();
          ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
          ctx.fillStyle = shape.color + '44';
          ctx.fill();
        }

        // Circle body
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = shape.color;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Adorable Kandinsky Singing Face!
        const eyeOffset = r * 0.35;
        const eyeY = cy - r * 0.15;
        const eyeR = Math.max(2.5, r * 0.12);

        // Eyes
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(cx - eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
        ctx.arc(cx + eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
        ctx.fill();

        // Mouth (open wide when singing / active!)
        const mouthY = cy + r * 0.3;
        ctx.beginPath();
        if (isActive) {
          // Open singing mouth "O"
          ctx.ellipse(cx, mouthY, r * 0.28, r * 0.35, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#0F172A';
          ctx.fill();
          // Tongue
          ctx.beginPath();
          ctx.arc(cx, mouthY + r * 0.15, r * 0.15, 0, Math.PI);
          ctx.fillStyle = '#F43F5E';
          ctx.fill();
        } else {
          // Happy resting smile
          ctx.arc(cx, mouthY - r * 0.05, r * 0.3, 0.1 * Math.PI, 0.9 * Math.PI);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
        }
      } else if (shape.type === 'triangle') {
        // Metallic triangle / polygon
        const cx = shape.center.x * width;
        const cy = shape.center.y * height;
        const size = Math.max(20, (shape.radius || 0.05) * width * 1.3);

        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy + size * 0.8);
        ctx.lineTo(cx - size, cy + size * 0.8);
        ctx.closePath();

        ctx.fillStyle = shape.color + (isActive ? 'CC' : '88');
        ctx.fill();
        ctx.lineWidth = isActive ? 4 : 2.5;
        ctx.strokeStyle = isActive ? '#FFFFFF' : shape.color;
        ctx.stroke();

        // Center jewel sparkle
        ctx.beginPath();
        ctx.arc(cx, cy + size * 0.2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      } else {
        // Flowing line / wave
        if (shape.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x * width, shape.points[0].y * height);
          for (let i = 1; i < shape.points.length; i++) {
            ctx.lineTo(shape.points[i].x * width, shape.points[i].y * height);
          }
          ctx.lineWidth = isActive ? 8 : 5;
          ctx.strokeStyle = isActive ? '#FFFFFF' : shape.color;
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Draw active stroke currently in progress
    if (currentStrokeRef.current.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = selectedColor.hex;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const pts = currentStrokeRef.current;
      ctx.moveTo(pts[0].x * width, pts[0].y * height);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * width, pts[i].y * height);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw vertical sweeping playhead
    if (isPlaying) {
      const px = playheadPos * width;
      const grad = ctx.createLinearGradient(px - 10, 0, px + 10, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = grad;
      ctx.fillRect(px - 10, 0, 20, height);

      // Playhead needle
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
      ctx.stroke();
    }
  }, [shapes, playheadPos, isPlaying, selectedColor]);

  // Resize canvas to parent container width/height
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.max(380, Math.floor(rect.width * 0.55));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Preset Artwork Examples
  const loadPreset = (presetName: 'singing-sun' | 'fireworks' | 'ocean') => {
    if (presetName === 'singing-sun') {
      const sunCenter = { x: 0.25, y: 0.25 };
      const circlePts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 24; i++) {
        const rad = (i / 24) * Math.PI * 2;
        circlePts.push({
          x: sunCenter.x + Math.cos(rad) * 0.08,
          y: sunCenter.y + Math.sin(rad) * 0.12,
        });
      }

      // Rolling hill melody line
      const hillPts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 40; i++) {
        const nx = i / 40;
        const ny = 0.75 + Math.sin(nx * Math.PI * 4) * 0.12;
        hillPts.push({ x: nx, y: ny });
      }

      const sunShape: DrawnShape = {
        id: 'sun-1',
        type: 'circle',
        color: '#FACC15',
        points: circlePts,
        bounds: { minX: 0.17, maxX: 0.33, minY: 0.13, maxY: 0.37 },
        center: sunCenter,
        radius: 0.08,
        pitch: { step: 'E', octave: 5 },
      };

      const hillShape: DrawnShape = {
        id: 'hill-1',
        type: 'line',
        color: '#10B981',
        points: hillPts,
        bounds: { minX: 0, maxX: 1, minY: 0.63, maxY: 0.87 },
        center: { x: 0.5, y: 0.75 },
        pitch: { step: 'C', octave: 4 },
      };

      setShapes([sunShape, hillShape]);
    } else if (presetName === 'fireworks') {
      const newShapes: DrawnShape[] = [];
      const colors = ['#F43F5E', '#06B6D4', '#A855F7', '#FACC15'];
      for (let i = 0; i < 4; i++) {
        const cx = 0.2 + i * 0.2;
        const cy = 0.25 + (i % 2) * 0.2;
        newShapes.push({
          id: 'tri-' + i,
          type: 'triangle',
          color: colors[i],
          points: [
            { x: cx, y: cy - 0.08 },
            { x: cx + 0.06, y: cy + 0.06 },
            { x: cx - 0.06, y: cy + 0.06 },
          ],
          bounds: { minX: cx - 0.06, maxX: cx + 0.06, minY: cy - 0.08, maxY: cy + 0.06 },
          center: { x: cx, y: cy },
          radius: 0.07,
          pitch: mapYToPitch(cy),
        });
      }
      setShapes(newShapes);
    } else {
      // Ocean wave lines
      const wave1: { x: number; y: number }[] = [];
      const wave2: { x: number; y: number }[] = [];
      for (let i = 0; i <= 30; i++) {
        const nx = i / 30;
        wave1.push({ x: nx, y: 0.45 + Math.sin(nx * 8) * 0.08 });
        wave2.push({ x: nx, y: 0.7 + Math.cos(nx * 6) * 0.06 });
      }
      setShapes([
        {
          id: 'wave-1',
          type: 'line',
          color: '#06B6D4',
          points: wave1,
          bounds: { minX: 0, maxX: 1, minY: 0.37, maxY: 0.53 },
          center: { x: 0.5, y: 0.45 },
          pitch: { step: 'G', octave: 4 },
        },
        {
          id: 'wave-2',
          type: 'line',
          color: '#3B82F6',
          points: wave2,
          bounds: { minX: 0, maxX: 1, minY: 0.64, maxY: 0.76 },
          center: { x: 0.5, y: 0.7 },
          pitch: { step: 'C', octave: 4 },
        },
      ]);
    }
    setIsPlaying(true);
  };

  const handleClear = () => {
    setShapes([]);
    setIsPlaying(false);
  };

  const handleUndo = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  return (
    <div className="space-y-4 select-none">
      {/* Title & Introduction */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-3xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-2xl shadow-lg">
            🎨
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-white font-['Fredoka',sans-serif]">
                Sound Painter
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                Chrome Music Lab &apos;Kandinsky&apos; Inspired
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Draw lines, circles, and triangles! Watch them sing, chime, and turn into music.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm shadow-lg transition-all cursor-pointer font-['Fredoka',sans-serif] ${
              isPlaying
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-400/30'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/30'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Play Loop</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleUndo}
            disabled={shapes.length === 0}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 transition-colors"
            title="Undo Last Stroke"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={shapes.length === 0}
            className="p-2.5 rounded-2xl bg-slate-800 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 transition-colors"
            title="Clear Canvas"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Drawing Stage & Left Palette Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        {/* Color Palette & Presets Column */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 p-4 rounded-3xl space-y-4">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Color Timbres</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-2 gap-2">
              {PALETTE.map((c) => {
                const isSelected = selectedColor.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    className={`flex items-center gap-2 p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-white shadow-md scale-102 ring-2 ring-white/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full shrink-0 shadow-inner ${isSelected ? c.glow : ''}`}
                    />
                    <div className="overflow-hidden">
                      <div className="text-[11px] font-bold text-white truncate">{c.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{c.instrument}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loop Speed / Tempo */}
          <div className="border-t border-slate-800 pt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-300">Loop Speed</span>
              <span className="text-[10px] font-mono text-amber-400">
                {playbackSpeed === 6 ? '🐢 Slow' : playbackSpeed === 4 ? '🚶 Medium' : '🐆 Fast'}
              </span>
            </div>
            <div className="flex gap-1.5">
              {[
                { sec: 6, label: 'Slow' },
                { sec: 4, label: 'Med' },
                { sec: 2.5, label: 'Fast' },
              ].map((s) => (
                <button
                  key={s.sec}
                  type="button"
                  onClick={() => setPlaybackSpeed(s.sec)}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-black transition-all ${
                    playbackSpeed === s.sec
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sample Artwork Starters */}
          <div className="border-t border-slate-800 pt-3">
            <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Sample Artwork</span>
            </label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => loadPreset('singing-sun')}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-amber-300 flex items-center justify-between transition-colors cursor-pointer border border-slate-700/60"
              >
                <span>☀️ Singing Sun &amp; Hill</span>
                <span className="text-slate-500 text-[10px]">Load</span>
              </button>
              <button
                type="button"
                onClick={() => loadPreset('fireworks')}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-rose-300 flex items-center justify-between transition-colors cursor-pointer border border-slate-700/60"
              >
                <span>🎆 Starry Triangles</span>
                <span className="text-slate-500 text-[10px]">Load</span>
              </button>
              <button
                type="button"
                onClick={() => loadPreset('ocean')}
                className="w-full text-left px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-cyan-300 flex items-center justify-between transition-colors cursor-pointer border border-slate-700/60"
              >
                <span>🌊 Ocean Waves</span>
                <span className="text-slate-500 text-[10px]">Load</span>
              </button>
            </div>
          </div>

          {/* Reflection Toggle */}
          <div className="border-t border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowReflection(!showReflection)}
              className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-amber-400/20 to-rose-400/20 hover:from-amber-400/30 hover:to-rose-400/30 border border-amber-400/40 text-amber-300 font-black text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Lightbulb className="w-4 h-4 text-amber-300" />
              <span>{showReflection ? 'Hide Art Reflection' : 'Explain My Artwork! 📝'}</span>
            </button>
          </div>
        </div>

        {/* Interactive Drawing Canvas */}
        <div className="lg:col-span-9 bg-slate-900/90 border border-slate-800 p-3 sm:p-4 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col items-center">
          {/* Top Canvas Guide */}
          <div className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="text-amber-400">▲</span> High Pitches (Birds &amp; Bells)
            </span>
            <span className="text-slate-400">
              Draw circles for singing faces, lines for melodies!
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-sky-400">▼</span> Low Pitches (Tuba &amp; Waves)
            </span>
          </div>

          <div className="w-full relative rounded-2xl overflow-hidden border-2 border-slate-800 shadow-inner bg-slate-950 cursor-crosshair touch-none">
            <canvas
              ref={canvasRef}
              onMouseDown={handleStartDraw}
              onMouseMove={handleMoveDraw}
              onMouseUp={handleEndDraw}
              onMouseLeave={handleEndDraw}
              onTouchStart={handleStartDraw}
              onTouchMove={handleMoveDraw}
              onTouchEnd={handleEndDraw}
              className="w-full h-auto block"
            />

            {shapes.length === 0 && !isPlaying && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-500 space-y-2 p-4 text-center">
                <div className="text-4xl animate-bounce">🖌️</div>
                <div className="text-sm font-bold text-slate-400">
                  Click and drag anywhere to paint your music!
                </div>
                <div className="text-xs text-slate-500 max-w-sm">
                  Tip: Draw a closed circle to create a singing face, or draw lines to create melodies!
                </div>
              </div>
            )}
          </div>

          {/* Quick Shape Helper Legend */}
          <div className="w-full mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-bold text-rose-300">⭕ Circles</div>
              <div className="text-[10px] text-slate-400">Singing face voices</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-bold text-sky-300">〰️ Lines</div>
              <div className="text-[10px] text-slate-400">Gliding melody notes</div>
            </div>
            <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="font-bold text-amber-300">🔺 Triangles</div>
              <div className="text-[10px] text-slate-400">Metallic percussion chime</div>
            </div>
          </div>
        </div>
      </div>

      {/* Educational Reflection: "Explain Your Music & Art" */}
      {showReflection && (
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 border-2 border-indigo-500/40 p-5 rounded-3xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-indigo-500/30 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎓</span>
              <div>
                <h4 className="text-lg font-black text-white font-['Fredoka',sans-serif]">
                  Music &amp; Art Reflection Card
                </h4>
                <p className="text-xs text-indigo-300">
                  Explain how your visual symbols match your musical composition!
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono">
              Classroom Presentation Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-300">
                1. What is the mood of your piece?
              </label>
              <input
                type="text"
                value={reflectionText.mood}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!containsProfanity(val)) {
                    setReflectionText((prev) => ({ ...prev, mood: val }));
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-amber-400"
                placeholder="e.g. Dreamy, playful, soaring..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-rose-300">
                2. What do your shapes represent?
              </label>
              <textarea
                rows={2}
                value={reflectionText.shapesMeaning}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!containsProfanity(val)) {
                    setReflectionText((prev) => ({ ...prev, shapesMeaning: val }));
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-rose-400 resize-none"
                placeholder="e.g. My circles are thunder, lines are the wind..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-sky-300">
                3. How do your pitches relate to position?
              </label>
              <textarea
                rows={2}
                value={reflectionText.pitchExplanation}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!containsProfanity(val)) {
                    setReflectionText((prev) => ({ ...prev, pitchExplanation: val }));
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-hidden focus:border-sky-400 resize-none"
                placeholder="e.g. High objects sound high, low objects sound deep..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
