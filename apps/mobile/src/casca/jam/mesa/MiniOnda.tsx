import { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';

// A onda de uma pista, em miniatura.
//
// Desenhada a partir dos picos que a MESA já tem — ela descodificou o áudio para tocar, e os
// números estão ali. A alternativa seria pôr um `Onda` (o WebView com wavesurfer) por pista, e
// isso descodificaria o mesmo áudio outra vez: com seis stems, o PCM inteiro duas vezes na
// memória, e seis WebViews debaixo de uma lista. Num aparelho, é a diferença entre funcionar e
// ser morto pelo sistema.
//
// A parte já tocada fica na cor de ação, o resto em cinza — é a mesma leitura da onda grande,
// e dispensa uma agulha por cima.

/** Quantas barras. 60 é o que cabe em ~300 pt sem virar um borrão. */
export const BARRAS = 60;

const LARGURA = 2;
const INTERVALO = 2;
const ALTURA = 34;
/** Uma barra sempre visível: silêncio absoluto é uma linha, não um vazio. */
const MINIMA = 2;

export const MiniOnda = memo(({ picos, progresso, apagada }: {
  picos: number[];
  /** 0..1. Quanto da pista já passou. */
  progresso: number;
  /** Muda ou calada pelo solo de outra: a onda perde a cor, como o som perdeu a voz. */
  apagada?: boolean;
}) => {
  if (!picos.length) {
    return <View style={estilos.vazia} />;
  }

  const largura = picos.length * (LARGURA + INTERVALO);
  const ate = progresso * picos.length;

  return (
    <Svg width="100%" height={ALTURA} viewBox={`0 0 ${largura} ${ALTURA}`} preserveAspectRatio="none">
      {picos.map((pico, i) => {
        const alta = Math.max(MINIMA, pico * ALTURA);
        return (
          <Rect
            key={i}
            x={i * (LARGURA + INTERVALO)}
            y={(ALTURA - alta) / 2}
            width={LARGURA}
            height={alta}
            rx={1}
            fill={apagada ? COR_EDITOR.estrela : i < ate ? AZUL_DO_EDITOR : COR_EDITOR.contornoDaVersao}
          />
        );
      })}
    </Svg>
  );
});

MiniOnda.displayName = 'MiniOnda';

const estilos = StyleSheet.create({
  // O lugar da onda enquanto ela não existe: sem isto a linha da pista encolhe e salta quando
  // o áudio acaba de carregar.
  vazia: { height: ALTURA },
});
