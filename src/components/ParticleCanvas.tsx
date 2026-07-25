import { useEffect, useRef, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  hue: number;
}

interface ParticleCanvasProps {
  count?: number;
  colors?: string[];
  maxSpeed?: number;
  className?: string;
  interactive?: boolean;
}

const DEFAULT_COLORS = [
  "139, 92, 246",
  "6, 182, 212",
  "217, 70, 239",
  "244, 63, 94",
  "167, 139, 250",
];

function deviceAwareCount(requested: number): number {
  const cores = navigator.hardwareConcurrency || 4;
  const isMobile = window.innerWidth < 768;
  const cap = isMobile ? 35 : 70;
  const byCores = cores <= 2 ? 25 : cores <= 4 ? 45 : cap;
  return Math.min(requested, byCores, cap);
}

export default function ParticleCanvas({
  count = 60,
  colors = DEFAULT_COLORS,
  maxSpeed = 0.8,
  className = "",
  interactive = true,
}: ParticleCanvasProps) {
  const effectiveCount = deviceAwareCount(count);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isVisibleRef = useRef(true);
  const isFocusedRef = useRef(true);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const initParticle = useCallback(
    (w: number, h: number): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * maxSpeed,
      vy: (Math.random() - 0.5) * maxSpeed - 0.2,
      size: Math.random() * 3 + 1,
      alpha: Math.random() * 0.5 + 0.1,
      life: 0,
      maxLife: Math.random() * 300 + 200,
      hue: Math.floor(Math.random() * colors.length),
    }),
    [maxSpeed, colors.length]
  );

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    const onMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        cancelAnimationFrame(animRef.current);
      }
    };
    mql.addEventListener("change", onMotionChange);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };

    const debouncedResize = () => {
      clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(resize, 100);
    };

    resize();
    window.addEventListener("resize", debouncedResize);

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    observerRef.current.observe(canvas);

    const onVisibility = () => {
      isFocusedRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const w = () => canvas.clientWidth;
    const h = () => canvas.clientHeight;

    particlesRef.current = Array.from({ length: effectiveCount }, () => initParticle(w(), h()));

    const animate = () => {
      if (!isVisibleRef.current || !isFocusedRef.current) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      const cw = w();
      const ch = h();
      ctx.clearRect(0, 0, cw, ch);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        if (interactive) {
          const dx = mouseRef.current.x - p.x;
          const dy = mouseRef.current.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            p.vx -= dx * 0.002;
            p.vy -= dy * 0.002;
          }
        }

        if (p.life > p.maxLife || p.x < -20 || p.x > cw + 20 || p.y < -20 || p.y > ch + 20) {
          Object.assign(p, initParticle(cw, ch));
        }

        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        const fade = p.life < 30 ? p.life / 30 : p.life > p.maxLife - 30 ? (p.maxLife - p.life) / 30 : 1;
        const color = colors[p.hue % colors.length];

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.alpha * fade})`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.alpha * fade * 0.15})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", debouncedResize);
      observerRef.current?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      mql.removeEventListener("change", onMotionChange);
      clearTimeout(resizeTimerRef.current);
    };
  }, [effectiveCount, colors, maxSpeed, initParticle, interactive]);

  const onMouse = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const onLeave = useCallback(() => {
    mouseRef.current = { x: -1000, y: -1000 };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      onMouseMove={interactive ? onMouse : undefined}
      onMouseLeave={interactive ? onLeave : undefined}
    />
  );
}