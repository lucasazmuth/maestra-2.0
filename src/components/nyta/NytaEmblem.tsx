import { FC, useId } from 'react';

import styles from './NytaEmblem.module.scss';

// Emblema da Nyta — o rosto da inteligência da Maestra em todo o app (chat do wizard, rail,
// header, mobile nav, telas de upsell).
//
// O desenho é a FAÍSCA do set de formas do design (Triangle.svg, glifo central): quatro folhas
// em corte diagonal de 45°, a mesma linguagem geométrica do símbolo da Maestra — que é um "N"
// de cortes diagonais. É o que amarra a Nyta ao resto da marca: o robô anterior era redondo e
// orgânico, parecia de outro sistema. A faísca ainda por cima é o glifo universal de "IA".
// As folhas levam o gradiente da marca (azul de ação → roxo da Nyta) e o vão central vira um
// losango ciano — o "olho" da Nyta, herdado dos olhos ciano do robô.
//
// `state='thinking'` liga a animação de processamento: as folhas apagam e acendem uma por vez
// em sentido horário (o mesmo gesto dos três pontinhos que acendiam um a um) e o núcleo pulsa.
// Em repouso o emblema fica parado de propósito: ele aparece em toda mensagem do chat, e
// dezenas dele se mexendo ao mesmo tempo viram ruído.

export type NytaEmblemState = 'idle' | 'thinking';

// `tone` é sobre o fundo, não sobre gosto: 'brand' é o gradiente pra superfície clara, e
// 'onDark' pinta as folhas de branco, pros lugares onde a Nyta fica sobre roxo (o botão dela
// na navegação mobile) e o gradiente sumiria contra o fundo.
export type NytaEmblemTone = 'brand' | 'onDark';

// As quatro folhas da faísca, nas coordenadas ORIGINAIS do Triangle.svg (o glifo vive no tile
// 132–156 × 44–68); o <g> abaixo translada o tile pra origem. Ordem: topo, direita, baixo,
// esquerda — o sentido horário em que elas acendem ao pensar.
const LEAVES = [
  'M146.161 53.3588C146.56 52.9604 146.759 52.7611 146.867 52.5232C146.955 52.33 146.999 52.1198 146.996 51.9077C146.992 51.6464 146.889 51.384 146.684 50.8592L144 44L141.316 50.8592C141.111 51.384 141.008 51.6464 141.004 51.9077C141.001 52.1198 141.045 52.33 141.133 52.5232C141.241 52.7611 141.44 52.9604 141.839 53.3588L143.45 54.9702C143.647 55.1667 143.745 55.2649 143.859 55.3C143.951 55.3283 144.049 55.3283 144.141 55.3C144.255 55.2649 144.353 55.1666 144.55 54.9701L146.161 53.3588Z',
  'M156 56L149.141 58.6841C148.616 58.8894 148.354 58.9921 148.092 58.9957C147.88 58.9986 147.67 58.9547 147.477 58.867C147.239 58.7589 147.04 58.5597 146.641 58.1612L145.03 56.5499C144.833 56.3534 144.735 56.2551 144.7 56.1412C144.672 56.0492 144.672 55.9509 144.7 55.8589C144.735 55.7449 144.833 55.6467 145.03 55.4502L146.641 53.8388C147.04 53.4404 147.239 53.2411 147.477 53.1331C147.67 53.0453 147.88 53.0014 148.092 53.0043C148.354 53.0079 148.616 53.1106 149.141 53.316L156 56Z',
  'M146.161 58.6412C146.56 59.0396 146.759 59.2389 146.867 59.4768C146.955 59.67 146.999 59.8802 146.996 60.0923C146.992 60.3536 146.889 60.616 146.684 61.1408L144 68L141.316 61.1408C141.111 60.616 141.008 60.3536 141.004 60.0923C141.001 59.8802 141.045 59.67 141.133 59.4768C141.241 59.2389 141.44 59.0396 141.839 58.6412L143.45 57.0298C143.647 56.8333 143.745 56.7351 143.859 56.7C143.951 56.6717 144.049 56.6717 144.141 56.7C144.255 56.7351 144.353 56.8334 144.55 57.0299L146.161 58.6412Z',
  'M141.359 58.1612C140.96 58.5597 140.761 58.7589 140.523 58.867C140.33 58.9547 140.12 58.9986 139.908 58.9957C139.646 58.9921 139.384 58.8894 138.859 58.6841L132 56L138.859 53.316C139.384 53.1106 139.646 53.0079 139.908 53.0043C140.12 53.0014 140.33 53.0453 140.523 53.1331C140.761 53.2411 140.96 53.4404 141.359 53.8388L142.97 55.4502C143.167 55.6467 143.265 55.7449 143.3 55.8589C143.328 55.9509 143.328 56.0492 143.3 56.1412C143.265 56.2551 143.167 56.3534 142.97 56.5499L141.359 58.1612Z',
];

// Losango do vão central da faísca (as folhas se afastam do centro em 45°, sobrando exatamente
// um diamante). Levemente menor que o vão pra não encostar nas folhas.
const CORE = 'M144 54.9 L145.1 56 L144 57.1 L142.9 56 Z';

export const NytaEmblem: FC<{ state?: NytaEmblemState; tone?: NytaEmblemTone; className?: string }> = ({
  state = 'idle', tone = 'brand', className,
}) => {
  // O id do gradiente precisa ser único por instância: com vários emblemas na tela, ids
  // repetidos fazem todos apontarem pro primeiro <defs> do documento.
  const gradientId = `nyta-emblem-${useId().replace(/:/g, '')}`;
  const leafFill = tone === 'onDark' ? '#fff' : `url(#${gradientId})`;

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
          {/* userSpaceOnUse nas coordenadas do TILE (132–156 × 44–68), porque o gradiente é
              compartilhado pelas 4 folhas — em objectBoundingBox cada folha ganharia o seu e a
              faísca ficaria remendada. */}
          <linearGradient id={gradientId} x1='134' y1='46' x2='154' y2='66' gradientUnits='userSpaceOnUse'>
            <stop stopColor='#3361ff' />
            <stop offset='1' stopColor='#7420f1' />
          </linearGradient>
        </defs>
      )}

      {/* Translada o tile original do Triangle.svg pra origem — os paths ficam com as
          coordenadas EXATAS do arquivo do design, sem reescrever números. */}
      <g transform='translate(-132 -44)'>
        {LEAVES.map((d, i) => (
          <path key={d.slice(0, 12)} className={styles.leaf} style={{ animationDelay: `${i * 0.35}s` }} d={d} fill={leafFill} />
        ))}
        <path className={styles.core} d={CORE} fill='#04fed1' />
      </g>
    </svg>
  );
};

export default NytaEmblem;
