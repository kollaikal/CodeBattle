
import React, { useRef, useEffect, useState } from 'react';
import { Player, AIGuard } from '../types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface ArenaCanvasProps {
  players: Player[];
  guards: AIGuard[];
  safeZone: { x: number; y: number; radius: number };
  localPlayerId: string;
}

const ArenaCanvas: React.FC<ArenaCanvasProps> = ({ players, guards, safeZone, localPlayerId }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const prevAliveCount = useRef<number>(players.length);

  useEffect(() => {
    const aliveCount = players.filter(p => p.isAlive).length;
    if (aliveCount < prevAliveCount.current) {
      // Someone died, spawn particles at their last location
      const deadPlayer = players.find(p => !p.isAlive && Math.abs(p.x) > 0); // Simplified check
      if (deadPlayer) {
        for (let i = 0; i < 20; i++) {
          particles.current.push({
            x: deadPlayer.x,
            y: deadPlayer.y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 1.0,
            color: deadPlayer.id === localPlayerId ? '#ef4444' : '#94a3b8'
          });
        }
      }
    }
    prevAliveCount.current = aliveCount;
  }, [players, localPlayerId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Draw Grid Background
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Draw Danger Zone
      ctx.fillStyle = 'rgba(127, 29, 29, 0.45)';
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2, true);
      ctx.fill();

      // Draw Safe Zone Border
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.arc(safeZone.x, safeZone.y, safeZone.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Particles
      particles.current = particles.current.filter(p => p.life > 0);
      particles.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
      });
      ctx.globalAlpha = 1.0;

      // Draw Players
      players.forEach(p => {
        if (!p.isAlive) return;

        ctx.fillStyle = p.id === localPlayerId ? '#22d3ee' : '#94a3b8';
        ctx.shadowBlur = p.id === localPlayerId ? 15 : 0;
        ctx.shadowColor = '#22d3ee';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(p.name, p.x, p.y - 14);

        const healthWidth = 24;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(p.x - healthWidth/2, p.y + 10, healthWidth, 4);
        ctx.fillStyle = p.health > 50 ? '#22c55e' : p.health > 20 ? '#eab308' : '#ef4444';
        ctx.fillRect(p.x - healthWidth/2, p.y + 10, (p.health / 100) * healthWidth, 4);
      });

      // Draw AI Guards
      guards.forEach(g => {
        ctx.fillStyle = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - 8);
        ctx.lineTo(g.x + 6, g.y + 6);
        ctx.lineTo(g.x - 6, g.y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [players, guards, safeZone, localPlayerId]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl w-full h-full object-contain"
    />
  );
};

export default ArenaCanvas;
