import { useState, useEffect, useRef } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; pulse: number; pulseSpeed: number;
}

function ParticleCanvas({ dimmed }: { dimmed: boolean }) {
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

    const count = Math.min(200, Math.floor((W * H) / 6500));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.55, vy: (Math.random() - 0.5) * 0.55,
      r: 0.8 + Math.random() * 2.2,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.012 + Math.random() * 0.018,
    }));

    const CONNECT = 140, MOUSE_R = 180;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const ps = particlesRef.current, m = mouseRef.current;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const dx = m.x - p.x, dy = m.y - p.y, d = Math.sqrt(dx*dx+dy*dy);
        if (d < MOUSE_R && d > 0) { p.vx += (dx/d)*0.022; p.vy += (dy/d)*0.022; }
        const speed = Math.sqrt(p.vx*p.vx+p.vy*p.vy);
        if (speed > 1.8) { p.vx=(p.vx/speed)*1.8; p.vy=(p.vy/speed)*1.8; }
        p.vx *= 0.991; p.vy *= 0.991;
        p.x += p.vx; p.y += p.vy; p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
        const pr = p.r + Math.sin(p.pulse) * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
        ctx.fillStyle = i % 3 === 0
          ? `rgba(90,173,212,${0.5+Math.sin(p.pulse)*0.3})`
          : `rgba(42,127,165,${0.55+Math.sin(p.pulse)*0.25})`;
        ctx.fill();
        if (p.r > 1.8) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, pr*2.5, 0, Math.PI*2);
          const g = ctx.createRadialGradient(p.x, p.y, pr, p.x, p.y, pr*2.5);
          g.addColorStop(0, "rgba(90,173,212,0.15)"); g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.fill();
        }
        for (let j = i+1; j < ps.length; j++) {
          const q = ps[j], cx = p.x-q.x, cy = p.y-q.y, cd = Math.sqrt(cx*cx+cy*cy);
          if (cd < CONNECT) {
            const alpha = (1-cd/CONNECT)*0.40;
            const grad = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
            grad.addColorStop(0, `rgba(90,173,212,${alpha})`);
            grad.addColorStop(1, `rgba(42,127,165,${alpha*0.7})`);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 0.5+(1-cd/CONNECT)*0.4;
            ctx.stroke();
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const handleMouse = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("mousemove", handleMouse);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", handleMouse); };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0"
      style={{ opacity: dimmed ? 0.18 : 0.65, transition: "opacity 0.5s ease", pointerEvents: "none" }} />
  );
}

interface AuthPageLayoutProps {
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: number;
}

export function AuthPageLayout({ subtitle, children, footer, maxWidth = 448 }: AuthPageLayoutProps) {
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [formFocused, setFormFocused] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    });
  };

  return (
    <div
      className="login-bg min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8"
      onMouseMove={handleMouseMove}
    >
      <div className="login-orb-1" />
      <div className="login-orb-2" />
      <div className="login-orb-3" />
      <div className="login-aurora" />

      <ParticleCanvas dimmed={formFocused} />

      <svg aria-hidden="true" style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%", pointerEvents:"none" }}>
        <filter id="auth-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#auth-grain)" opacity="0.04" />
      </svg>

      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        background:`radial-gradient(550px circle at ${mousePos.x}% ${mousePos.y}%, rgba(42,127,165,0.12) 0%, transparent 65%)`,
        opacity: formFocused ? 0.35 : 1, transition:"opacity 0.4s",
      }} />

      <div className="relative z-10 w-full login-enter" style={{ maxWidth }}>
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-5">
            <div className="login-shield-wrap rounded-xl p-2"
              style={{ background:"rgba(26,79,110,0.20)", border:"1px solid rgba(90,173,212,0.30)" }}>
              <img src="/teradime-triangle.png" alt="Teradime" className="login-logo-spin"
                style={{ width:64, height:64, objectFit:"contain", display:"block",
                  filter:"drop-shadow(0 0 6px rgba(90,173,212,0.4))" }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight"
            style={{ color:"#ddeaf5", textShadow:"0 2px 20px rgba(42,127,165,0.30)" }}>
            Asset Vantage Metrics
          </h1>
          <p className="mt-2 text-sm" style={{ color:"rgba(90,173,212,0.50)" }}>{subtitle}</p>
        </div>

        <div
          className="login-glass-card rounded-2xl px-8 py-8"
          onFocus={() => setFormFocused(true)}
          onBlur={() => setFormFocused(false)}
        >
          {children}
        </div>

        {footer && <div className="mt-6 text-center space-y-2">{footer}</div>}
      </div>
    </div>
  );
}
