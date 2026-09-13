import { FC, memo } from 'react';

// A onda de um clipe: uma barra por pico, no eixo do meio.
//
// ⚠️ ERAM DOIS ENVELOPES PREENCHIDOS, e o argumento escrito aqui era que "uma onda contínua lê
// como som gravado, e barras leem como equalizador". O dono do produto viu as duas telas lado a
// lado e escolheu as barras — e a razão vence a minha: o app já desenhava assim, e o mesmo
// clipe com dois desenhos diferentes é o tipo de diferença que faz a pessoa duvidar de que está
// a olhar para a mesma coisa. Um desenho só, nas duas superfícies.
//
// Os números vêm da MESA, que descodificou o áudio para tocar e já os tem na mão. Pedir a um
// wavesurfer que desenhasse cada clipe descodificaria o mesmo ficheiro outra vez — e com seis
// pistas seria o PCM inteiro duas vezes na memória.

const LARGURA = 1000;
const ALTURA = 100;

export const Onda: FC<{ picos: number[]; cor: string }> = memo(({ picos, cor }) => {
  if (!picos.length) return null;

  const passo = LARGURA / picos.length;

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      preserveAspectRatio='none'
      width='100%'
      height='100%'
      style={{ display: 'block' }}
      aria-hidden
    >
      {picos.map((pico, i) => {
        // Uma barra sempre visível: silêncio absoluto é uma linha, não um buraco no desenho.
        const alta = Math.max(2, pico * ALTURA);
        return (
          <rect
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            x={i * passo}
            y={(ALTURA - alta) / 2}
            // 70 % do passo: a folga entre as barras é o que as faz ler como barras. Cheias,
            // voltavam a ser um bloco.
            width={Math.max(passo * 0.7, 0.4)}
            height={alta}
            fill={cor}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
});

Onda.displayName = 'Onda';
