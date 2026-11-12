"use client";

import { useEffect, useRef } from "react";

export function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#10b981", "#34d399", "#38bdf8", "#fbbf24", "#f43f5e", "#a855f7", "#ffffff"];
    const pieces: Array<{
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
      rot: number;
      vRot: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 90; i++) {
      pieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.35 + (Math.random() - 0.5) * 50,
        w: Math.random() * 8 + 6,
        h: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: -Math.random() * 10 - 4,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let frame = 0;
    const render = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22; // gravity
        p.rot += p.vRot;
        if (frame > 60) {
          p.opacity = Math.max(0, p.opacity - 0.012);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (frame < 180) {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);

    const onResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}

