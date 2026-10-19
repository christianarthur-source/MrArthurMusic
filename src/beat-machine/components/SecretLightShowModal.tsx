import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Square,
  Maximize2,
} from 'lucide-react';
import { BeatTrack, MelodyTrack } from '../types';

interface SecretLightShowModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  onChangeBpm: (bpm: number) => void;
  currentStep: number;
  totalStepsInMeasure: 8 | 16;
  totalMeasures: number;
  tracks: BeatTrack[];
  melodyTracks: MelodyTrack[];
  bassTracks: MelodyTrack[];
}

type PatternTheme = 'disco' | 'galaxy' | 'lasers' | 'bubbles' | 'fireworks';

interface FastParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  symbol?: string;
}

export const SecretLightShowModal: React.FC<SecretLightShowModalProps> = ({
  isOpen,
  onClose,
  isPlaying,
  onTogglePlay,
  bpm,
  onChangeBpm,
  currentStep,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<PatternTheme>('disco');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Lightweight particle array capped at max 16 items
  const particlesRef = useRef<FastParticle[]>([]);
  const lastStepRef = useRef<number>(currentStep);
  const beatFlashRef = useRef<number>(0);

  // Handle beat step updates (Pulse trigger with zero CPU overhead)
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep !== lastStepRef.current && isPlaying) {
      lastStepRef.current = currentStep;
      beatFlashRef.current = 1.0; // Trigger flash intensity

      // Spawn only 4-6 lightweight particles per beat step
      const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#06b6d4'];
      const symbols = ['🎵', '🎶', '⭐', '✨'];

      if (particlesRef.current.length < 16) {
        for (let i = 0; i < 4; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 4 + 2;
          particlesRef.current.push({
            x: 320,
            y: 180,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 6 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            symbol: symbols[Math.floor(Math.random() * symbols.length)],
          });
        }
      }
    }
  }, [currentStep, isPlaying, isOpen]);

  // Main Lightweight Canvas Render Loop (Fixed 640x360 buffer = 0% CPU load)
  useEffect(() => {
    if (!isOpen) return;

    let animationFrameId: number;
    let frame = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const speedMultiplier = bpm / 115;
      frame += isPlaying ? speedMultiplier : 0.2 * speedMultiplier;
      const w = 640;
      const h = 360;

      // Decaying beat flash
      if (beatFlashRef.current > 0) {
        beatFlashRef.current = Math.max(0, beatFlashRef.current - 0.08);
      }
      const flash = beatFlashRef.current;

      // 1. Fast clear background
      ctx.fillStyle = flash > 0.1 ? `rgba(${Math.floor(flash * 60)}, 10, 30, 1)` : '#090d16';
      ctx.fillRect(0, 0, w, h);

      // 2. Simple, High-Speed Themes (No shadowBlur, no radial gradients in loop)
      const angle = frame * 0.04;

      if (theme === 'disco') {
        const cx = w / 2;
        const cy = h / 2;

        // Rotating rays
        const rays = 10;
        for (let i = 0; i < rays; i++) {
          const rAngle = angle + (i * Math.PI * 2) / rays;
          const hue = (i * 36 + frame * 3) % 360;

          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(rAngle) * 400, cy + Math.sin(rAngle) * 400);
          ctx.strokeStyle = `hsl(${hue}, 90%, 60%)`;
          ctx.lineWidth = isPlaying ? 6 : 2;
          ctx.stroke();
        }

        // Center disco orb
        ctx.beginPath();
        ctx.arc(cx, cy, 32 + flash * 12, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${(frame * 5) % 360}, 100%, 70%)`;
        ctx.fill();
      } else if (theme === 'galaxy') {
        const cx = w / 2;
        const cy = h / 2;

        // Orbiting star nodes
        const stars = 12;
        for (let i = 0; i < stars; i++) {
          const rad = 60 + i * 12;
          const sx = cx + Math.cos(angle + i) * rad;
          const sy = cy + Math.sin(angle * 0.8 + i) * (rad * 0.6);
          const hue = (i * 30 + frame * 4) % 360;

          ctx.beginPath();
          ctx.arc(sx, sy, 6 + (i % 3) * 2, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
          ctx.fill();
        }
      } else if (theme === 'lasers') {
        // Scanning laser lines
        const lasers = 6;
        for (let i = 0; i < lasers; i++) {
          const lx = ((frame * 4 + i * 100) % (w + 100)) - 50;
          const hue = (i * 60 + frame * 5) % 360;

          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(w - lx, h);
          ctx.strokeStyle = `hsl(${hue}, 100%, 60%)`;
          ctx.lineWidth = isPlaying ? 4 : 2;
          ctx.stroke();
        }

        // Equalizer floor
        const bars = 16;
        const barW = w / bars;
        for (let b = 0; b < bars; b++) {
          const bh = Math.abs(Math.sin(angle * 2 + b * 0.8)) * (isPlaying ? 120 : 30);
          ctx.fillStyle = `hsl(${(b * 22 + frame * 4) % 360}, 90%, 55%)`;
          ctx.fillRect(b * barW + 2, h - bh, barW - 4, bh);
        }
      } else if (theme === 'bubbles') {
        // Floating bubbles
        const count = 10;
        for (let i = 0; i < count; i++) {
          const bx = (Math.sin(angle * 0.5 + i) * 0.4 + 0.5) * w;
          const by = (h + 50 - ((frame * 2 + i * 60) % (h + 100))) % h;
          const hue = (i * 36 + frame * 3) % 360;

          ctx.beginPath();
          ctx.arc(bx, by, 18, 0, Math.PI * 2);
          ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      } else if (theme === 'fireworks') {
        // Starburst fountain
        const cx = w / 2;
        const cy = h / 2;

        for (let i = 0; i < 8; i++) {
          const fAngle = (i * Math.PI) / 4 + angle;
          const dist = (frame * 3 + i * 20) % 180;
          const fx = cx + Math.cos(fAngle) * dist;
          const fy = cy + Math.sin(fAngle) * dist;

          ctx.beginPath();
          ctx.arc(fx, fy, 5, 0, Math.PI * 2);
          ctx.fillStyle = `hsl(${(i * 45 + frame * 6) % 360}, 100%, 65%)`;
          ctx.fill();
        }
      }

      // 3. Render Particles (Click / Beat triggers)
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.04;

        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.symbol) {
          ctx.font = '16px sans-serif';
          ctx.fillStyle = p.color;
          ctx.fillText(p.symbol, p.x, p.y);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, isPlaying, theme, bpm]);

  // Handle Canvas Tap Effect (Spawns max 6 particles)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Scale click coords to 640x360 buffer space
    const clickX = ((e.clientX - rect.left) / rect.width) * 640;
    const clickY = ((e.clientY - rect.top) / rect.height) * 360;

    const symbols = ['✨', '🎵', '🎶', '🌟', '⭐'];
    const colors = ['#f43f5e', '#a855f7', '#3b82f6', '#10b981', '#eab308'];

    if (particlesRef.current.length > 20) {
      particlesRef.current.splice(0, 8); // prune old
    }

    for (let i = 0; i < 6; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = Math.random() * 5 + 2;
      particlesRef.current.push({
        x: clickX,
        y: clickY,
        vx: Math.cos(pAngle) * pSpeed,
        vy: Math.sin(pAngle) * pSpeed,
        size: 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[200] flex flex-col bg-slate-950 text-white select-none overflow-hidden animate-in fade-in duration-150"
    >
      {/* 640x360 Lightweight Render Buffer scaled to full screen with GPU acceleration */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        onClick={handleCanvasClick}
        className="absolute inset-0 h-full w-full object-cover cursor-pointer"
      />

      {/* Header Overlay Bar */}
      <div className="relative z-10 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-cyan-400 text-xl shadow-md">
            🎵
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black bg-gradient-to-r from-amber-300 via-pink-400 to-cyan-300 bg-clip-text text-transparent">
                Secret Light Show! 🚀
              </h2>
              <span className="rounded-full bg-pink-500/20 px-2 py-0.5 text-[10px] font-black uppercase text-pink-300 border border-pink-500/30">
                Eco Mode ⚡
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Low-power, smooth screensaver for all devices!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            </span>
          </button>

          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-500 px-3.5 py-1.5 text-xs font-black text-white shadow-md active:scale-95 transition-all"
          >
            <X className="h-4 w-4" />
            <span>Close ✕</span>
          </button>
        </div>
      </div>

      {/* Center Prompt when Paused */}
      {!isPlaying && (
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center p-6 pointer-events-none">
          <div className="rounded-3xl bg-slate-900/80 border border-pink-500/30 p-6 backdrop-blur-xs max-w-sm">
            <span className="text-5xl block mb-2">🪩</span>
            <h3 className="text-xl font-black text-white mb-1">
              Press PLAY for Light Show!
            </h3>
            <p className="text-xs text-slate-300">
              Lightweight lights and colors pulse to your beat!
            </p>
          </div>
        </div>
      )}

      {/* Bottom Control Bar */}
      <div className="relative z-10 mt-auto p-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900/90 p-3 border border-slate-800 shadow-xl">
          {/* Play / Stop Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-black text-sm text-white shadow-lg transition-all active:scale-95 ${
              isPlaying
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/30'
                : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="h-4 w-4 fill-white" />
                <span>PAUSE LIGHT SHOW</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-slate-950" />
                <span>START LIGHT SHOW! 🎵</span>
              </>
            )}
          </button>

          {/* Theme Selector */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setTheme('disco')}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                theme === 'disco'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              🪩 Disco
            </button>

            <button
              onClick={() => setTheme('galaxy')}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                theme === 'galaxy'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              🌌 Galaxy
            </button>

            <button
              onClick={() => setTheme('lasers')}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                theme === 'lasers'
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              ⚡ Lasers
            </button>

            <button
              onClick={() => setTheme('bubbles')}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                theme === 'bubbles'
                  ? 'bg-rose-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              🫧 Bubbles
            </button>

            <button
              onClick={() => setTheme('fireworks')}
              className={`rounded-lg px-2.5 py-1 text-xs font-black transition-all ${
                theme === 'fireworks'
                  ? 'bg-emerald-400 text-slate-950'
                  : 'text-slate-300 hover:bg-slate-700/60'
              }`}
            >
              🎆 Fireworks
            </button>
          </div>

          {/* Tempo Controls */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs font-black text-amber-300">{bpm} BPM</span>
            <button
              onClick={() => onChangeBpm(Math.max(60, bpm - 10))}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-700 text-xs font-black text-white hover:bg-slate-600 active:scale-90"
            >
              -
            </button>
            <button
              onClick={() => onChangeBpm(Math.min(180, bpm + 10))}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-700 text-xs font-black text-white hover:bg-slate-600 active:scale-90"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
