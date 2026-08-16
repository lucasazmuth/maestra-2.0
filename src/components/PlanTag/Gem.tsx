import { FC, useId } from 'react';

// Gema facetada do selo de plano — topo em leque e ponta embaixo, no espírito do selo de
// referência. Desenhada aqui em 24×24 porque o arquivo original tem 1,9 MB (traz imagens
// embutidas): o que importa é a silhueta com o degradê.
//
// Vive num componente próprio porque aparece em mais de um lugar (o selo no topo e o card do
// Pro nas Configurações) e as duas precisam ser a MESMA gema — foi o pedido.
//
// As cores vêm de variáveis CSS (--plan-gem-from/mid/to), então quem usa decide o tom sem
// precisar passar props: o selo muda por estado do plano, o card usa o tom do Pro.
export const Gem: FC<{ size?: number; className?: string }> = ({ size = 12, className }) => {
  // Um id por instância: com duas gemas na tela, ids repetidos fazem as duas apontarem para o
  // primeiro <defs> do documento.
  const gradientId = `plan-gem-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill='none'
      className={className}
      aria-hidden
      focusable='false'
    >
      <defs>
        <linearGradient id={gradientId} x1='12' y1='4' x2='12' y2='20' gradientUnits='userSpaceOnUse'>
          <stop stopColor='var(--plan-gem-from, #5b8cff)' />
          <stop offset='.45' stopColor='var(--plan-gem-mid, #3361ff)' />
          <stop offset='1' stopColor='var(--plan-gem-to, #2a54e0)' />
        </linearGradient>
      </defs>
      <path d='M7 4h10l4 5-9 11L3 9l4-5Z' fill={`url(#${gradientId})`} />
      <path
        d='M7 4l2.6 5L12 20 14.4 9 17 4M3 9h18'
        stroke='#fff'
        strokeOpacity='.55'
        strokeWidth='1.1'
        strokeLinejoin='round'
      />
    </svg>
  );
};

export default Gem;
