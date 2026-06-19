import React, { useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; pulse: number; pulseSpeed: number;
}

function AppParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = window.innerWidth, H = window.innerHeight;

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(90, Math.floor((W * H) / 14000));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: 0.7 + Math.random() * 1.6,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.010 + Math.random() * 0.014,
    }));

    const CONNECT = 120, MOUSE_R = 140;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const ps = particlesRef.current, m = mouseRef.current;

      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_R && d > 0) { p.vx += (dx / d) * 0.015; p.vy += (dy / d) * 0.015; }
        const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > 1.4) { p.vx = (p.vx / spd) * 1.4; p.vy = (p.vy / spd) * 1.4; }
        p.vx *= 0.993; p.vy *= 0.993;
        p.x += p.vx; p.y += p.vy; p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;

        const pr = p.r + Math.sin(p.pulse) * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0
          ? `rgba(90,173,212,${0.35 + Math.sin(p.pulse) * 0.20})`
          : `rgba(42,127,165,${0.40 + Math.sin(p.pulse) * 0.18})`;
        ctx.fill();

        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j], cx = p.x - q.x, cy = p.y - q.y, cd = Math.sqrt(cx * cx + cy * cy);
          if (cd < CONNECT) {
            const alpha = (1 - cd / CONNECT) * 0.22;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(42,127,165,${alpha})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const handleMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", handleMouse);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas ref={canvasRef} style={{
      position: "fixed", inset: 0, width: "100%", height: "100%",
      opacity: 0.60, pointerEvents: "none", zIndex: -2,
    }} />
  );
}

export function AppDarkBackground() {
  const fixed: React.CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none" };

  return (
    <>
      <div style={{ ...fixed, background: "#070F1A", zIndex: -3 }} />
      <div className="login-orb-1" style={{ ...fixed, zIndex: -2 }} />
      <div className="login-orb-2" style={{ ...fixed, zIndex: -2 }} />
      <div className="login-orb-3" style={{ ...fixed, zIndex: -2 }} />
      <div className="login-aurora" style={{ ...fixed, zIndex: -2 }} />
      <AppParticleCanvas />
      <svg aria-hidden="true" style={{ ...fixed, zIndex: -1 }}>
        <filter id="app-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#app-grain)" opacity="0.035" />
      </svg>
    </>
  );
}
