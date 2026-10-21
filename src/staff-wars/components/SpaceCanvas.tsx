import React, { useRef, useEffect } from 'react';
import { ActiveNote, LaserBeam, ExplosionEffect, ScorePopup, StaffClef } from '../types';

interface SpaceCanvasProps {
  clef: StaffClef;
  activeNote: ActiveNote | null;
  lasers: LaserBeam[];
  explosions: ExplosionEffect[];
  scorePopups: ScorePopup[];
  isShieldShaking: boolean;
  lives: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
  twinkle: number;
}

interface ThrusterSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
}

// Vector path for crisp engraved Treble Clef
const TREBLE_CLEF_PATH_STR =
  'm12.049 3.5296c0.305 3.1263-2.019 5.6563-4.0772 7.7014-0.9349 0.897-0.155 0.148-0.6437 0.594-0.1022-0.479-0.2986-1.731-0.2802-2.11 0.1304-2.6939 2.3198-6.5875 4.2381-8.0236 0.309 0.5767 0.563 0.6231 0.763 1.8382zm0.651 16.142c-1.232-0.906-2.85-1.144-4.3336-0.885-0.1913-1.255-0.3827-2.51-0.574-3.764 2.3506-2.329 4.9066-5.0322 5.0406-8.5394 0.059-2.232-0.276-4.6714-1.678-6.4836-1.7004 0.12823-2.8995 2.156-3.8019 3.4165-1.4889 2.6705-1.1414 5.9169-0.57 8.7965-0.8094 0.952-1.9296 1.743-2.7274 2.734-2.3561 2.308-4.4085 5.43-4.0046 8.878 0.18332 3.334 2.5894 6.434 5.8702 7.227 1.2457 0.315 2.5639 0.346 3.8241 0.099 0.2199 2.25 1.0266 4.629 0.0925 6.813-0.7007 1.598-2.7875 3.004-4.3325 2.192-0.5994-0.316-0.1137-0.051-0.478-0.252 1.0698-0.257 1.9996-1.036 2.26-1.565 0.8378-1.464-0.3998-3.639-2.1554-3.358-2.262 0.046-3.1904 3.14-1.7356 4.685 1.3468 1.52 3.833 1.312 5.4301 0.318 1.8125-1.18 2.0395-3.544 1.8325-5.562-0.07-0.678-0.403-2.67-0.444-3.387 0.697-0.249 0.209-0.059 1.193-0.449 2.66-1.053 4.357-4.259 3.594-7.122-0.318-1.469-1.044-2.914-2.302-3.792zm0.561 5.757c0.214 1.991-1.053 4.321-3.079 4.96-0.136-0.795-0.172-1.011-0.2626-1.475-0.4822-2.46-0.744-4.987-1.116-7.481 1.6246-0.168 3.4576 0.543 4.0226 2.184 0.244 0.577 0.343 1.197 0.435 1.812zm-5.1486 5.196c-2.5441 0.141-4.9995-1.595-5.6343-4.081-0.749-2.153-0.5283-4.63 0.8207-6.504 1.1151-1.702 2.6065-3.105 4.0286-4.543 0.183 1.127 0.366 2.254 0.549 3.382-2.9906 0.782-5.0046 4.725-3.215 7.451 0.5324 0.764 1.9765 2.223 2.7655 1.634-1.102-0.683-2.0033-1.859-1.8095-3.227-0.0821-1.282 1.3699-2.911 2.6513-3.198 0.4384 2.869 0.9413 6.073 1.3797 8.943-0.5054 0.1-1.0211 0.143-1.536 0.143z';

export const SpaceCanvas: React.FC<SpaceCanvasProps> = ({
  clef,
  activeNote,
  lasers,
  explosions,
  scorePopups,
  isShieldShaking,
  lives,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const starsRef = useRef<Star[]>([]);
  const sparksRef = useRef<ThrusterSpark[]>([]);
  const shipXRef = useRef<number>(500);

  // Initialize starfield
  useEffect(() => {
    const stars: Star[] = [];
    const colors = ['#ffffff', '#fef08a', '#93c5fd', '#c4b5fd', '#6ee7b7'];
    for (let i = 0; i < 220; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2.2 + 0.6,
        speed: Math.random() * 0.08 + 0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
        twinkle: Math.random() * Math.PI * 2,
      });
    }
    starsRef.current = stars;
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let treblePath: Path2D | null = null;
    try {
      treblePath = new Path2D(TREBLE_CLEF_PATH_STR);
    } catch {
      treblePath = null;
    }

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark space background
      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, width, height);

      // Camera shake if hit
      ctx.save();
      if (isShieldShaking) {
        const shakeX = (Math.random() - 0.5) * 14;
        const shakeY = (Math.random() - 0.5) * 14;
        ctx.translate(shakeX, shakeY);
      }

      // Space nebula ambient glow
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        width * 0.1,
        width * 0.5,
        height * 0.42,
        width * 0.85
      );
      grad.addColorStop(0, 'rgba(30, 27, 75, 0.5)');
      grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.88)');
      grad.addColorStop(1, '#050714');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Parallax starfield
      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.x -= star.speed * 0.015;
        if (star.x < 0) {
          star.x = 1.0;
          star.y = Math.random();
        }
        star.twinkle += 0.04;

        const starX = star.x * width;
        const starY = star.y * height;
        const alpha = 0.4 + 0.6 * Math.sin(star.twinkle);

        ctx.fillStyle = star.color;
        ctx.globalAlpha = Math.max(0.2, alpha);
        ctx.beginPath();
        ctx.arc(starX, starY, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // LARGER GLOBAL STAFF DIMENSIONS
      // Increased line spacing from 22px to 28px for much taller, clearer visibility!
      const staffLineSpacing = 28;
      const middleY = height * 0.42; // Line 3 center
      const staffTopY = middleY - 2 * staffLineSpacing; // Line 5
      const staffBottomY = middleY + 2 * staffLineSpacing; // Line 1
      const staffLeftX = 0; // Extends all the way across left
      const staffRightX = width;

      // Map staff offset to Y coordinate
      // Line 3 = 0, positive goes UP, negative goes DOWN
      const getYForOffset = (offset: number) => {
        return middleY - offset * (staffLineSpacing * 0.5);
      };

      // 1. Draw 5 Bold Glowing Horizontal Staff Lines Across the Entire Screen
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 11;
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.88)';
      ctx.lineWidth = 3.2;

      for (let i = 0; i < 5; i++) {
        const lineY = staffTopY + i * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(staffLeftX, lineY);
        ctx.lineTo(staffRightX, lineY);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Beginning vertical barline at x = 24
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(24, staffTopY);
      ctx.lineTo(24, staffBottomY);
      ctx.stroke();

      // 2. Draw Clef directly ON Staff Lines (Larger & Appropriately Rendered)
      const clefX = 64;
      ctx.save();
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fef08a';

      if (clef === 'treble') {
        if (treblePath) {
          // Scaled to fit 28px line spacing seamlessly
          ctx.save();
          // Line 2 (G4) is at middleY + staffLineSpacing
          ctx.translate(clefX - 22, middleY - 72);
          ctx.scale(3.9, 3.9);
          ctx.fill(treblePath);
          ctx.restore();
        } else {
          ctx.font = 'bold 88px "Fredoka", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('𝄞', clefX, middleY - 6);
        }
      } else if (clef === 'bass') {
        ctx.font = 'bold 84px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄢', clefX + 4, middleY - 8);
      } else if (clef === 'alto' || clef === 'tenor') {
        ctx.font = 'bold 78px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cClefY = clef === 'alto' ? middleY : middleY - staffLineSpacing;
        ctx.fillText('𝄡', clefX + 2, cClefY);
      } else {
        // Grand staff
        ctx.font = 'bold 54px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('𝄞', clefX - 14, middleY - 18);
        ctx.fillText('𝄢', clefX + 18, middleY + 18);
      }
      ctx.restore();

      // Calculate Target Note Position
      let noteTargetX = width * 0.5;
      let noteTargetY = middleY;
      const minNoteX = 95; // Clef boundary
      const maxNoteX = width - 45;

      if (activeNote && !activeNote.isHit) {
        noteTargetX = minNoteX + (activeNote.xPercent / 100) * (maxNoteX - minNoteX);
        noteTargetY = getYForOffset(activeNote.def.staffOffset);

        // Draw Ledger Lines if above or below staff (Larger and Bolder)
        if (activeNote.def.ledgerOffsets && activeNote.def.ledgerOffsets.length > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.lineWidth = 3.2;
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 7;
          activeNote.def.ledgerOffsets.forEach((lOffset) => {
            const ledgerY = getYForOffset(lOffset);
            ctx.beginPath();
            ctx.moveTo(noteTargetX - 28, ledgerY);
            ctx.lineTo(noteTargetX + 28, ledgerY);
            ctx.stroke();
          });
          ctx.shadowBlur = 0;
        }

        // Engine Trail / Space Glow behind approaching note
        const engineGrad = ctx.createLinearGradient(noteTargetX, noteTargetY, noteTargetX + 65, noteTargetY);
        engineGrad.addColorStop(0, 'rgba(251, 191, 36, 0.85)');
        engineGrad.addColorStop(0.5, 'rgba(244, 63, 94, 0.45)');
        engineGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = engineGrad;
        ctx.beginPath();
        ctx.ellipse(noteTargetX + 24, noteTargetY, 40, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Musical Notehead (Tilted filled ellipse - LARGER: 21x15)
        ctx.save();
        ctx.translate(noteTargetX, noteTargetY);
        ctx.rotate(-0.35);

        // Outer neon glow
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 21, 15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner notehead core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Note Stem (Longer & bolder: strokeWidth 4.2, length 66px)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4.2;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        if (activeNote.def.staffOffset >= 0) {
          ctx.moveTo(noteTargetX - 15, noteTargetY);
          ctx.lineTo(noteTargetX - 15, noteTargetY + 66);
        } else {
          ctx.moveTo(noteTargetX + 15, noteTargetY);
          ctx.lineTo(noteTargetX + 15, noteTargetY - 66);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 3. Draw Spaceship at the Bottom (Enlarged and faithfully detailed)
      const shipY = height - 56;
      const targetShipX = activeNote && !activeNote.isHit ? noteTargetX : width * 0.5;
      // Smooth tracking lerp
      shipXRef.current += (targetShipX - shipXRef.current) * 0.12;
      const shipX = shipXRef.current;

      // Thruster spark generation
      if (Math.random() < 0.85) {
        sparksRef.current.push({
          x: shipX - 16 + (Math.random() - 0.5) * 5,
          y: shipY + 28,
          vx: (Math.random() - 0.5) * 1.8,
          vy: Math.random() * 3.5 + 2.5,
          alpha: 1.0,
          size: Math.random() * 3.5 + 2,
        });
        sparksRef.current.push({
          x: shipX + 16 + (Math.random() - 0.5) * 5,
          y: shipY + 28,
          vx: (Math.random() - 0.5) * 1.8,
          vy: Math.random() * 3.5 + 2.5,
          alpha: 1.0,
          size: Math.random() * 3.5 + 2,
        });
      }

      // Draw thruster sparks
      for (let i = sparksRef.current.length - 1; i >= 0; i--) {
        const p = sparksRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.045;
        if (p.alpha <= 0) {
          sparksRef.current.splice(i, 1);
        } else {
          ctx.save();
          ctx.fillStyle = p.alpha > 0.5 ? '#67e8f9' : '#38bdf8';
          ctx.globalAlpha = p.alpha;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 7;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw the X-Wing Starfighter Sprite (Scaled 1.25x for imposing presence)
      ctx.save();
      ctx.translate(shipX, shipY);
      ctx.scale(1.25, 1.25);

      // Dual Rear Engine Thruster Plumes
      const thrusterPulse = Math.sin(Date.now() * 0.03) * 3.5 + 14;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16;

      // Left engine flame
      const flameGradLeft = ctx.createLinearGradient(0, 16, 0, 16 + thrusterPulse);
      flameGradLeft.addColorStop(0, '#ffffff');
      flameGradLeft.addColorStop(0.3, '#38bdf8');
      flameGradLeft.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flameGradLeft;
      ctx.beginPath();
      ctx.ellipse(-13, 20, 5.5, thrusterPulse * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Right engine flame
      const flameGradRight = ctx.createLinearGradient(0, 16, 0, 16 + thrusterPulse);
      flameGradRight.addColorStop(0, '#ffffff');
      flameGradRight.addColorStop(0.3, '#38bdf8');
      flameGradRight.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = flameGradRight;
      ctx.beginPath();
      ctx.ellipse(13, 20, 5.5, thrusterPulse * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wings (S-foils with Red Squadron stripes)
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      // Left Wing
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-31, 8);
      ctx.lineTo(-33, 20);
      ctx.lineTo(-7, 19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Wing
      ctx.beginPath();
      ctx.moveTo(7, 4);
      ctx.lineTo(31, 8);
      ctx.lineTo(33, 20);
      ctx.lineTo(7, 19);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Red Squadron stripes on wings
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-28, 9, 8, 10);
      ctx.fillRect(-18, 11, 5, 8);
      ctx.fillRect(20, 9, 8, 10);
      ctx.fillRect(13, 11, 5, 8);

      // Wingtip Laser Cannon Barrels
      ctx.fillStyle = '#64748b';
      // Left cannon
      ctx.fillRect(-31, -19, 3.5, 36);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-32, -23, 5.5, 5.5);
      // Right cannon
      ctx.fillStyle = '#64748b';
      ctx.fillRect(28, -19, 3.5, 36);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(27, -23, 5.5, 5.5);

      // Ready laser diodes on cannon tips
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-31, -24, 3.5, 3.5);
      ctx.fillRect(28, -24, 3.5, 3.5);

      // Engine Nacelles (Cylinders on rear)
      ctx.fillStyle = '#475569';
      ctx.fillRect(-17, 7, 8, 15);
      ctx.fillRect(9, 7, 8, 15);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-16, 17, 6, 5);
      ctx.fillRect(10, 17, 6, 5);

      // Fuselage / Nose Cone (Pointed up towards staff)
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.lineTo(8, 4);
      ctx.lineTo(7, 19);
      ctx.lineTo(-7, 19);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fuselage center panel stripe
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-2.5, -23, 5, 26);

      // Cockpit Canopy (Cobalt / Cyan blue glass)
      ctx.fillStyle = '#1d4ed8';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(4.5, 2);
      ctx.lineTo(-4.5, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Specular highlight on canopy
      ctx.fillStyle = '#93c5fd';
      ctx.fillRect(-1.5, -9, 3, 5);

      ctx.restore(); // restore spaceship transform

      // 4. Draw Twin Lasers from Spaceship Wingtips
      const now = Date.now();
      lasers.forEach((laser) => {
        const elapsed = now - laser.createdAt;
        if (elapsed < laser.durationMs) {
          const leftCannonX = shipX - 38;
          const leftCannonY = shipY - 26;
          const rightCannonX = shipX + 38;
          const rightCannonY = shipY - 26;

          ctx.save();
          ctx.strokeStyle = laser.color;
          ctx.lineWidth = 7;
          ctx.shadowColor = laser.color;
          ctx.shadowBlur = 20;
          ctx.lineCap = 'round';

          // Twin converging beams to target note
          ctx.beginPath();
          ctx.moveTo(leftCannonX, leftCannonY);
          ctx.lineTo(laser.targetX - 5, laser.targetY);
          ctx.moveTo(rightCannonX, rightCannonY);
          ctx.lineTo(laser.targetX + 5, laser.targetY);
          ctx.stroke();

          // White-hot inner core
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(leftCannonX, leftCannonY);
          ctx.lineTo(laser.targetX - 5, laser.targetY);
          ctx.moveTo(rightCannonX, rightCannonY);
          ctx.lineTo(laser.targetX + 5, laser.targetY);
          ctx.stroke();

          // Muzzle flash on cannon tips
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = laser.color;
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(leftCannonX, leftCannonY, 8, 0, Math.PI * 2);
          ctx.arc(rightCannonX, rightCannonY, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      });

      // 5. Draw Particle Explosions
      explosions.forEach((exp) => {
        const expAge = (now - exp.createdAt) / 1000;

        // Shockwave ring
        const currentRing = exp.ringRadius + expAge * 170;
        if (currentRing < exp.ringMaxRadius) {
          ctx.save();
          ctx.strokeStyle = exp.ringColor;
          ctx.lineWidth = Math.max(1, 5 * (1 - currentRing / exp.ringMaxRadius));
          ctx.globalAlpha = 1 - currentRing / exp.ringMaxRadius;
          ctx.shadowColor = exp.ringColor;
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, currentRing, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Particle sparks
        exp.particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= 0.024;

          if (p.alpha > 0) {
            ctx.save();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      });

      // 6. Draw Floating Score Popups
      scorePopups.forEach((pop) => {
        const ageMs = now - pop.createdAt;
        if (ageMs < 1200) {
          const alpha = 1 - ageMs / 1200;
          const currentY = pop.y - (ageMs / 1200) * 50;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.font = 'bold 24px "Fredoka", sans-serif';
          ctx.fillStyle = pop.color;
          ctx.shadowColor = pop.color;
          ctx.shadowBlur = 12;
          ctx.textAlign = 'center';
          ctx.fillText(pop.text, pop.x, currentY);
          ctx.restore();
        }
      });

      ctx.restore(); // restore camera shake

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [clef, activeNote, lasers, explosions, scorePopups, isShieldShaking, lives]);

  return (
    <div className="relative w-full h-[440px] sm:h-[520px] rounded-3xl overflow-hidden border-2 border-slate-700/80 shadow-2xl bg-black">
      <canvas
        ref={canvasRef}
        width={1000}
        height={520}
        className="w-full h-full block"
      />
    </div>
  );
};
