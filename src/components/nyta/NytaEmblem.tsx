import { FC, useId } from 'react';

import styles from './NytaEmblem.module.scss';

// Emblema da Nyta — o rosto da inteligência da Maestra em todo o app (chat do wizard, rail,
// header, mobile nav, telas de upsell). Substituiu o orb em Lottie: o desenho é um SVG de
// ~1,5 kB inline, então não carrega JSON nem roda runtime de animação por instância — e num
// chat com dezenas de mensagens isso é dezenas de players a menos.
//
// A silhueta vem do arquivo do design (shape=emblem only). O que muda aqui é a cor: no
// original o corpo é branco (feito pra fundo escuro) e no design novo tudo é claro, então o
// corpo virou o gradiente da marca — azul de ação (#3361ff) até o roxo da Nyta (#7420f1) —
// com o visor e a barriga no navy do desenho e os olhos no ciano.
//
// `state='thinking'` liga a animação de processamento: a cabeça inclina, os olhos varrem de
// um lado pro outro e os três pontos da barriga acendem um por um, como quem está pensando.
// Em repouso o emblema fica parado de propósito: ele aparece em toda mensagem do chat, e
// dezenas deles se mexendo ao mesmo tempo viram ruído.

export type NytaEmblemState = 'idle' | 'thinking';

// `tone` é sobre o fundo, não sobre gosto: 'brand' é o gradiente pra superfície clara, e 'onDark'
// devolve o corpo branco do arquivo original, pros lugares onde a Nyta fica sobre roxo (o botão
// dela na navegação mobile) e o gradiente sumiria contra o fundo.
export type NytaEmblemTone = 'brand' | 'onDark';

// Silhueta do emblema (viewBox 72×72). A cabeça e o corpo são dois blocos separados justamente
// pra cabeça poder se mexer sem arrastar o resto.
const HEAD_D = 'M51.8815 37.6329C47.8329 39.2562 43.4627 40.2574 38.8919 40.5168C38.1036 40.5616 37.3094 40.5843 36.5098 40.5843C35.7102 40.5843 34.9159 40.5616 34.1276 40.5168C29.5557 40.2574 25.1846 39.2557 21.1351 37.6318C12.6371 34.2237 5.55601 28.0748 1.00977 20.2921C8.09588 8.16146 21.3404 0 36.5098 0C51.6792 0 64.9237 8.16146 72.0098 20.2921C67.463 28.0757 60.3808 34.2251 51.8815 37.6329Z';
const BODY_D = 'M21.1346 40.7908C20.1556 40.3982 19.1954 39.9692 18.2557 39.5055C15.2019 41.6359 12.6202 44.2892 10.6763 47.3163C13.9805 52.4617 19.1271 56.5269 25.3034 58.7801C28.2465 59.8537 31.4235 60.5159 34.7464 60.6875H38.209C41.5311 60.516 47.3701 63.7752 38.8914 71.9999C45.0687 69.7469 58.9746 52.4623 62.2791 47.3163C60.3407 44.2978 57.7682 41.651 54.7258 39.5237C53.797 39.9809 52.8482 40.4042 51.881 40.7919C47.8324 42.4152 43.4622 43.4165 38.8914 43.6759C38.1031 43.7206 37.3088 43.7433 36.5092 43.7433C35.7096 43.7433 34.9154 43.7206 34.1271 43.6759C29.5552 43.4164 25.184 42.4148 21.1346 40.7908Z';

// Os três pontos da barriga, da esquerda pra direita — a ordem em que acendem.
const BELLY_DOTS = [27.4929, 36.4778, 45.4651];

export const NytaEmblem: FC<{ state?: NytaEmblemState; tone?: NytaEmblemTone; className?: string }> = ({
  state = 'idle', tone = 'brand', className,
}) => {
  // O id do gradiente precisa ser único por instância: com vários emblemas na tela, ids
  // repetidos fazem todos apontarem pro primeiro <defs> do documento.
  const gradientId = `nyta-emblem-${useId().replace(/:/g, '')}`;
  const shell = tone === 'onDark' ? '#fff' : `url(#${gradientId})`;

  return (
    <svg
      viewBox='0 0 72 72'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      className={`${styles.emblem} ${state === 'thinking' ? styles.thinking : ''} ${className || ''}`}
      aria-hidden
      focusable='false'
    >
      <defs>
        <linearGradient id={gradientId} x1='4' y1='2' x2='66' y2='70' gradientUnits='userSpaceOnUse'>
          <stop stopColor='#3361ff' />
          <stop offset='1' stopColor='#7420f1' />
        </linearGradient>
      </defs>

      {/* Cabeça antes do corpo: na junção o corpo passa por cima, que é o que esconde a costura
          quando a cabeça inclina. */}
      <g className={styles.head}>
        <path fillRule='evenodd' clipRule='evenodd' d={HEAD_D} fill={shell} />
        <rect x='19.3916' y='15.1012' width='34.3112' height='12.1348' rx='6.06741' fill='#162550' />
        <g className={styles.eyes}>
          <ellipse cx='27.4929' cy='21.1013' rx='2.24656' ry='2.22472' fill='#04fed1' />
          <ellipse cx='46.009' cy='21.1013' rx='2.24656' ry='2.22472' fill='#04fed1' />
        </g>
      </g>

      <path d={BODY_D} fill={shell} />

      {BELLY_DOTS.map((cx, i) => (
        <ellipse
          key={cx}
          className={styles.dot}
          style={{ animationDelay: `${i * 0.18}s` }}
          cx={cx}
          cy='51.0336'
          rx='2.24656'
          ry='2.22472'
          fill='#162550'
        />
      ))}
    </svg>
  );
};

export default NytaEmblem;
