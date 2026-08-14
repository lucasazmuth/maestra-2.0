import { FC } from 'react';

import styles from './NytaEmblem.module.scss';

// Emblema da Nyta — o rosto da inteligência da Maestra em todo o app (chat do wizard, rail,
// header, mobile nav, telas de upsell).
//
// Em repouso, o emblema É o "N" da Maestra (o glifo final do set Group 50 do design). Ao
// "pensar" (`state='thinking'`), o N se desmonta nas formas primitivas do mesmo set — quadrado,
// moldura, triângulo, zigue-zague em M, diagonal — e se remonta, num ciclo de morphs. Esse é o
// conceito: a Nyta é a marca em movimento, pensando com as próprias formas do sistema.
//
// Não há SVG aqui: todos os glifos do set são polígonos de arestas retas (a linguagem da logo é
// corte duro, sem curvas), então cada forma é um `clip-path: polygon()` sobre o gradiente da
// marca, e o navegador interpola os vértices entre uma forma e outra — as arestas continuam
// retas DURANTE a transição, que é o que mantém o morph na mesma linguagem. Cada glifo foi
// decomposto em DUAS camadas de 6 vértices (todo glifo do set é a união de dois polígonos:
// o N são dois triângulos, a moldura são dois "L", o quadrado é o par de metades diagonais…),
// porque o morph exige o mesmo número de vértices em todos os quadros. As formas vivem no
// SCSS (NytaEmblem.module.scss), uma variável por polígono.
//
// Em repouso o emblema fica parado de propósito: ele aparece em toda mensagem do chat, e
// dezenas dele se mexendo ao mesmo tempo viram ruído.

export type NytaEmblemState = 'idle' | 'thinking';

// `tone` é sobre o fundo, não sobre gosto: 'brand' é o gradiente pra superfície clara, e
// 'onDark' pinta as formas de branco, pros lugares onde a Nyta fica sobre roxo (o botão dela
// na navegação mobile) e o gradiente sumiria contra o fundo.
export type NytaEmblemTone = 'brand' | 'onDark';

export const NytaEmblem: FC<{ state?: NytaEmblemState; tone?: NytaEmblemTone; className?: string }> = ({
  state = 'idle', tone = 'brand', className,
}) => (
  <span
    className={[
      styles.emblem,
      state === 'thinking' ? styles.thinking : '',
      tone === 'onDark' ? styles.onDark : '',
      className || '',
    ].join(' ').trim()}
  >
    <span className={styles.layerA} />
    <span className={styles.layerB} />
  </span>
);

export default NytaEmblem;
