// A curva do TETO: onde a soma das pistas para de crescer.
//
// ─── Por que existe ──────────────────────────────────────────────────────────
//
// Somar áudio é somar números. Duas pistas a meia escala, em fase, dão escala cheia; a terceira
// passa de 1.0, e o que passa de 1.0 não fica mais alto — fica CORTADO na quina, que é o
// estalo. Numa mesa com seis stems isso é o caso comum, não o raro, e quem ouvisse iria culpar
// os próprios ficheiros.
//
// ─── Por que uma curva, e não um compressor ──────────────────────────────────
//
// Porque o motor do telemóvel não tem compressor: a `react-native-audio-api` traz ganho, atraso,
// filtro, painel e modelador de onda — e nenhum `DynamicsCompressorNode`. Um limitador só na web
// seria um som diferente em cada superfície. O modelador existe nos dois, e uma curva é a mesma
// curva em qualquer motor.
//
// ─── O que a curva faz ───────────────────────────────────────────────────────
//
// Abaixo do JOELHO ela é a identidade: `y = x`, amostra por amostra, sem tocar em nada. É o que
// garante que uma mesa com duas pistas baixas soa exatamente como o ficheiro. Acima do joelho
// ela dobra suavemente com uma tangente hiperbólica e nunca alcança 1.0 — a distorção que ela
// acrescenta só existe onde a alternativa era o corte quadrado, que é muito pior.

/** Onde a curva deixa de ser reta. Abaixo disto, a mesa não toca no som. */
export const JOELHO = 0.7;

/**
 * A curva do modelador, com `pontos` amostras de −1 a 1.
 *
 * Pura e exportada de propósito: é a única parte do teto que se consegue afirmar num teste sem
 * um motor de áudio, e é onde um engano (uma curva que ampliasse, ou que não fosse monótona)
 * passaria despercebido para sempre.
 *
 * ⚠️ O domínio do modelador é [−1, 1] e nada mais: uma amostra a 1.8 recebe o valor da ponta da
 * curva. É isso que faz dele um teto — o excesso encosta e para, em vez de dar a volta.
 */
export const curvaDoTeto = (pontos: number): Float32Array => {
  const curva = new Float32Array(pontos);
  const sobra = 1 - JOELHO;
  for (let i = 0; i < pontos; i += 1) {
    // De −1 a 1, com as duas pontas incluídas.
    const x = pontos === 1 ? 0 : (i / (pontos - 1)) * 2 - 1;
    const modulo = Math.abs(x);
    const y = modulo <= JOELHO
      ? modulo
      : JOELHO + sobra * Math.tanh((modulo - JOELHO) / sobra);
    curva[i] = Math.sign(x) * y;
  }
  return curva;
};
