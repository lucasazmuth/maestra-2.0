import { FC, useId } from 'react';

import styles from './NytaEmblem.module.scss';

// Emblema da Nyta — o rosto da inteligência da Maestra em todo o app (chat do wizard, rail,
// header, mobile nav, telas de upsell).
//
// A marca é a ESTRELA DE QUATRO PONTAS do set do design (Vector: pontas nos eixos, arestas
// côncavas) — o glifo clássico de IA, no gradiente da marca. Os outros dois glifos do set são
// a mesma estrela em movimento, e é isso que a animação de "pensar" conta: a estrela acelera
// e vira o RASTRO DE GIRO (Star 9, o redemoinho de pontas nas quinas), depois o FLARE
// (Star 4, os quatro raios finos), e volta a pousar como estrela. `state='thinking'` liga o
// ciclo: o conjunto gira contínuo e as três formas se revezam por crossfade — durante o giro,
// a troca lê como metamorfose, sem depender de interpolação de path (que exige estrutura de
// curvas idêntica entre navegadores; os três arquivos têm estruturas diferentes).
//
// Os paths são os EXATOS dos arquivos do design, sem redesenho. Em repouso o emblema fica
// parado de propósito: ele aparece em toda mensagem do chat, e dezenas dele se mexendo ao
// mesmo tempo viram ruído.

export type NytaEmblemState = 'idle' | 'thinking';

// `tone` é sobre o fundo, não sobre gosto: 'brand' é o gradiente pra superfície clara, e
// 'onDark' pinta a estrela de branco, pros lugares onde a Nyta fica sobre roxo (o botão dela
// na navegação mobile) e o gradiente sumiria contra o fundo.
export type NytaEmblemTone = 'brand' | 'onDark';

// Estrela de quatro pontas (Vector) — a marca em repouso.
const SPARK = 'M12 0C13.4908 7.48588 16.4707 10.4947 24 12C16.469 13.5053 13.4891 16.5141 12 24C10.5092 16.5141 7.52927 13.5035 0 12C7.53102 10.4947 10.5109 7.48588 12 0Z';
// Rastro de giro (Star 9) — a estrela em rotação.
const SWOOSH = 'M23.9623 0.0378516C17.3728 6.66832 17.3852 17.3852 24 24C17.3852 17.3852 6.6682 17.3726 0.0377344 23.9621C6.62719 17.3318 6.61477 6.61477 0 0C6.61477 6.61477 17.3318 6.62754 23.9623 0.0378516Z';
// Flare (Star 4) — a estrela irradiando.
const FLARE = 'M1.86419 22.5938C6.74265 18.9135 9.18188 17.0734 12 17.0734C14.8182 17.0734 17.2574 18.9135 22.1359 22.5938L24 24L22.5937 22.1359C18.9135 17.2575 17.0733 14.8182 17.0733 12.0001C17.0733 9.18192 18.9135 6.74269 22.5937 1.86422L24 5.60626e-05L22.1359 1.40634C17.2574 5.08659 14.8182 6.92672 12 6.92672C9.18188 6.92672 6.74266 5.08659 1.8642 1.40634L-1.52588e-05 0L1.40632 1.86421C5.08656 6.74269 6.92668 9.18192 6.92668 12.0001C6.92668 14.8182 5.08656 17.2575 1.40632 22.1359L3.19758e-05 24.0001L1.86419 22.5938Z';

export const NytaEmblem: FC<{ state?: NytaEmblemState; tone?: NytaEmblemTone; className?: string }> = ({
  state = 'idle', tone = 'brand', className,
}) => {
  // O id do gradiente precisa ser único por instância: com vários emblemas na tela, ids
  // repetidos fazem todos apontarem pro primeiro <defs> do documento.
  const gradientId = `nyta-emblem-${useId().replace(/:/g, '')}`;
  const fill = tone === 'onDark' ? '#fff' : `url(#${gradientId})`;

  return (
    <svg
      viewBox='0 0 24 24'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={`${styles.emblem} ${state === 'thinking' ? styles.thinking : ''} ${className || ''}`}
      aria-hidden
      focusable='false'
    >
      {tone !== 'onDark' && (
        <defs>
          {/* Mesmo degradê do botão "Nyta IA" do rail (.rail-nyta): #a143ff -> #7420f1. A cor
              da Nyta é essa — o azul de ação é do resto do app, não dela. */}
          <linearGradient id={gradientId} x1='3' y1='3' x2='21' y2='21' gradientUnits='userSpaceOnUse'>
            <stop stopColor='#a143ff' />
            <stop offset='1' stopColor='#7420f1' />
          </linearGradient>
        </defs>
      )}

      <g className={styles.spin}>
        <path className={styles.spark} d={SPARK} fill={fill} />
        <path className={styles.swoosh} d={SWOOSH} fill={fill} />
        <path className={styles.flare} d={FLARE} fill={fill} />
      </g>
    </svg>
  );
};

export default NytaEmblem;
