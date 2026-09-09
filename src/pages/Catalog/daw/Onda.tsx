import { FC, memo } from 'react';

// A onda de um clipe: dois envelopes espelhados no eixo do meio.
//
// É o desenho da referência — um polígono para cima e outro para baixo, ancorados na linha
// central, com um degradê que apaga nas pontas. Não é o mesmo que barras: uma onda contínua lê
// como som gravado, e barras leem como equalizador.
//
// Os números vêm da MESA, que descodificou o áudio para tocar e já os tem na mão. Pedir a um
// wavesurfer que desenhasse cada clipe descodificaria o mesmo ficheiro outra vez — e com seis
// pistas seria o PCM inteiro duas vezes na memória.

const LARGURA = 1000;
const ALTURA = 52;

export const Onda: FC<{ picos: number[]; cor: string }> = memo(({ picos, cor }) => {
  if (!picos.length) return null;

  const meio = ALTURA / 2;
  const n = picos.length;
  const acima: string[] = [];
  const abaixo: string[] = [];

  for (let i = 0; i < n; i += 1) {
    const x = (i / Math.max(1, n - 1)) * LARGURA;
    // O mínimo de 0.04 é o que faz o silêncio ser uma linha e não um buraco no desenho.
    const amplitude = Math.max(picos[i], 0.04) * (meio * 0.88);
    acima.push(`${x.toFixed(1)},${(meio - amplitude).toFixed(1)}`);
    abaixo.push(`${x.toFixed(1)},${(meio + amplitude).toFixed(1)}`);
  }

  const id = `onda-${cor.replace(/#/g, '')}`;

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio='none'
      width='100%'
      height='100%'
      style={{ display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={cor} stopOpacity='0.95' />
          <stop offset='50%' stopColor={cor} stopOpacity='0.55' />
          <stop offset='100%' stopColor={cor} stopOpacity='0.95' />
        </linearGradient>
      </defs>
      <polygon points={[`0,${meio}`, ...acima, `${LARGURA},${meio}`].join(' ')} fill={`url(#${id})`} />
      <polygon points={[`0,${meio}`, ...abaixo, `${LARGURA},${meio}`].join(' ')} fill={`url(#${id})`} />
    </svg>
  );
});

Onda.displayName = 'Onda';
