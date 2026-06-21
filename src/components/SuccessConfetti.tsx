import { CSSProperties, FC, useEffect, useRef } from 'react';

interface Props {
  // Mantido por compatibilidade de chamada; o confete é sempre sobre a viewport.
  fullscreen?: boolean;
  // Duração do "chuvisco" antes de parar de emitir (ms). Default 2600.
  durationMs?: number;
  style?: CSSProperties;
}

// Cores de celebração — base na marca (magenta/roxo) + acentos quentes pra leitura no escuro.
const COLORS = ['#af2896', '#d264bb', '#ffffff', '#ffd54a', '#5b8def', '#ff7ac6'];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  shape: 0 | 1; // 0 = retângulo, 1 = círculo
}

// Confete de celebração desenhado em canvas (sem dependência) — toca UMA vez e some.
// Usado nas telas de sucesso de pagamento (assinatura e pagamento único). Não bloqueia cliques.
export const SuccessConfetti: FC<Props> = ({ durationMs = 2600, style }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return; // respeita "reduzir movimento": sem confete

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces: Piece[] = [];
    const spawn = (n: number, fromBurst: boolean) => {
      for (let i = 0; i < n; i++) {
        if (fromBurst) {
          // Estouro inicial a partir do topo-centro, em leque.
          const angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.6;
          const speed = 6 + Math.random() * 7;
          pieces.push({
            x: W / 2 + (Math.random() - 0.5) * 120,
            y: H * 0.32,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.3,
            size: 6 + Math.random() * 6,
            color: COLORS[(Math.random() * COLORS.length) | 0],
            shape: Math.random() < 0.5 ? 0 : 1,
          });
        } else {
          // Chuvisco contínuo caindo do topo (largura toda).
          pieces.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 2,
            vy: 2 + Math.random() * 3,
            rot: Math.random() * Math.PI,
            vrot: (Math.random() - 0.5) * 0.25,
            size: 5 + Math.random() * 6,
            color: COLORS[(Math.random() * COLORS.length) | 0],
            shape: Math.random() < 0.5 ? 0 : 1,
          });
        }
      }
    };

    spawn(200, true); // estouro de abertura

    const start = performance.now();
    let raf = 0;
    const gravity = 0.16;
    const drag = 0.992;

    const frame = (now: number) => {
      const elapsed = now - start;
      // Emite chuvisco enquanto dentro da duração.
      if (elapsed < durationMs && pieces.length < 700) spawn(6, false);

      ctx.clearRect(0, 0, W, H);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;

        if (p.y > H + 30) {
          pieces.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Some suavemente o canvas perto do fim, e encerra quando tudo caiu.
      if (elapsed > durationMs) {
        canvas.style.opacity = String(Math.max(0, 1 - (elapsed - durationMs) / 800));
      }
      if (elapsed > durationMs + 800 || (elapsed > durationMs && pieces.length === 0)) {
        ctx.clearRect(0, 0, W, H);
        return; // fim
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 4000,
        ...style,
      }}
    />
  );
};

export default SuccessConfetti;
