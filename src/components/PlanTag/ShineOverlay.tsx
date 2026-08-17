import { CSSProperties, FC, useEffect, useRef } from 'react';
import lottie from 'lottie-web';

import shineData from '../../assets/badge-shine.json';
import { paintShine } from './paintDiamond';
import type { PlanTone } from './Diamond';

// Brilho que atravessa a pílula do selo — extraído do mesmo mecanismo do Lottie de referência
// (duas barras claras deslizando em looping), mas sem o fundo laranja fixo nem o texto "Premium"
// do original: a pílula já tem cor e rótulo próprios, o Lottie entra só como o brilho por cima.
//
// A primeira versão usava barras brancas com mix-blend-mode: overlay, que sume sobre um fundo já
// quase branco (a pílula tem só 8-16% de opacidade de cor). Em vez disso, cada tom tinge as
// barras com a própria cor clara e sobe a opacidade — visível nos três estados em blend normal.
const SHINE_HEX: Record<PlanTone, string> = { pro: '#5b8cff', pending: '#f0b429', free: '#c3d0e4' };

export const ShineOverlay: FC<{ tone: PlanTone; className?: string; style?: CSSProperties }> = ({ tone, className, style }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      // Só ao carregar a página, não em loop pra sempre — o diamante é quem fica animando
      // continuamente; o brilho é só a saudação inicial da pílula.
      loop: false,
      autoplay: true,
      // 85% (tentativa anterior) virava um bloco quase sólido no tom "pro", que é bem saturado,
      // e atrapalhava a leitura do rótulo. Como a barra já é tingida com a cor do tom (não é mais
      // branco sobre mix-blend-mode), não precisa de tanta opacidade pra aparecer — 20% já lê
      // como um brilho passando, sem competir com o texto.
      animationData: paintShine(shineData, SHINE_HEX[tone], 20),
      // A pílula muda de largura conforme o rótulo (PRO/Pendente/FREE) — esticar sem manter
      // proporção faz o brilho preencher a largura real em vez de sobrar/faltar espaço.
      rendererSettings: { preserveAspectRatio: 'none' },
    });
    // Sem loop, o Lottie trava no último frame desenhado ao terminar — que não é necessariamente
    // fora da pílula, já que as barras se movem em ciclo (a posição final não é "vazia"). Isso
    // deixava um resquício diagonal parado sobre o selo depois que a animação acabava. Escondendo
    // no evento 'complete' (com uma transição suave) em vez de confiar no frame final.
    anim.addEventListener('complete', () => { el.style.opacity = '0'; });
    return () => anim.destroy();
  }, [tone]);

  return (
    <span
      ref={ref}
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        // Negativo: em pai com position:relative, isto pinta atrás do conteúdo em fluxo normal
        // (ícone + rótulo) mesmo eles não tendo z-index próprio — só o elemento posicionado
        // precisa recuar, o resto não precisa de tratamento especial.
        zIndex: -1,
        overflow: 'hidden',
        borderRadius: 'inherit',
        pointerEvents: 'none',
        opacity: 1,
        transition: 'opacity 0.5s ease',
        ...style,
      }}
    />
  );
};

export default ShineOverlay;
