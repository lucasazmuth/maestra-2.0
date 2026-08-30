import { CSSProperties, FC, useEffect, useRef } from 'react';

// Arquivo em JS puro de propósito: o app nativo embute ESTE mesmo código dentro de um
// WebView, e um .ts não rodaria lá sem um passo de compilação.
import { desenharConfete } from './confeteCanvas';

interface Props {
  // Mantido por compatibilidade de chamada; o confete é sempre sobre a viewport.
  fullscreen?: boolean;
  // Duração do "chuvisco" antes de parar de emitir (ms). Default 2600.
  durationMs?: number;
  style?: CSSProperties;
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
    return desenharConfete(canvas, { durationMs });
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
        zIndex: 'var(--z-confete)',
        ...style,
      }}
    />
  );
};

export default SuccessConfetti;
