import { CSSProperties, FC, useEffect, useRef } from 'react';
import lottie from 'lottie-web';

import rawDiamond from '../../assets/gradient-diamond.json';
import { paintDiamond, type ToneStops } from './paintDiamond';

export type PlanTone = 'pro' | 'pending' | 'free';

// Mesmas três paletas do selo (PlanTag.module.scss) — pro no azul primário, pendente no âmbar de
// aviso, free apagado. Repetidas aqui porque o Lottie precisa da cor em RGB no próprio JSON, não
// dá pra herdar var(--...) como a gema estática antiga fazia.
const TONE_STOPS: Record<PlanTone, ToneStops> = {
  pro: ['#5b8cff', '#3361ff', '#2a54e0'],
  pending: ['#f0b429', '#dd9a12', '#f0b429'],
  free: ['#c3d0e4', '#aebfda', '#c3d0e4'],
};

interface Props {
  tone?: PlanTone;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Diamante animado do selo de plano. Substitui a gema estática (era um SVG parado): a mesma peça
// aparece no selo do topo, no card do Pro nas Configurações e na tela de assinatura — o pedido
// original da gema ("as duas precisam ser a MESMA gema") continua valendo, só que agora anima.
//
// Fica em loop contínuo — é ele quem carrega a animação "viva" da pílula; o brilho por trás
// (ShineOverlay) toca só uma vez, ao carregar a página.
export const Diamond: FC<Props> = ({ tone = 'pro', size = 24, className, style }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: paintDiamond(rawDiamond, TONE_STOPS[tone]),
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    });
    return () => anim.destroy();
  }, [tone]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={className}
      style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0, ...style }}
    />
  );
};

export default Diamond;
