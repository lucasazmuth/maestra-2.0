import { CSSProperties, FC, useEffect, useRef } from 'react';
import lottie from 'lottie-web';

import rawDiamond from '../../assets/gradient-diamond.json';
// As paletas e a pintura moram no núcleo: o app nativo mostra o MESMO selo, e o Lottie precisa
// da cor em RGB dentro do próprio JSON — não dá pra herdar `var(--...)`.
import { TONE_STOPS, paintDiamond, type PlanTone } from '@maestra/core/constants/planTagLottie';

export type { PlanTone };

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
