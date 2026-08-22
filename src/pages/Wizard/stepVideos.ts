import { WIZARD_TOTAL_STEPS } from '../../constants/maestra';
import { STEP_LABELS } from './chat/script';

// Vídeo explicativo de cada etapa do planejamento.
//
// Vive aqui, e não em `src/constants/`, porque importa `STEP_LABELS` — e `constants/*` não importa
// de `pages/*` neste projeto (a dependência corre no sentido oposto).
//
// Pode ser a URL COMPLETA, em qualquer formato do YouTube, ou só o id: o `extractYouTubeId` do
// componente resolve os dois. Cole exatamente o que o YouTube der; menos transcrição, menos erro.
// Etapa com string vazia não mostra player — aparece o espaço reservado, e nada quebra.

/** Mapeia uma tupla para outra do MESMO comprimento, preservando a checagem posição a posição. */
type SameLength<T extends readonly unknown[], V> = { [K in keyof T]: V };

// Como `STEP_LABELS` é `as const`, isto é uma tupla de 9 posições — acrescentar uma etapa lá
// QUEBRA O BUILD aqui até que o vídeo dela seja declarado. É de propósito: as duas listas não
// podem sair de sincronia em silêncio.
export const STEP_VIDEOS: SameLength<typeof STEP_LABELS, string> = [
  'https://www.youtube.com/watch?v=-Zg9NF1SSgw', // 0 · Identidade
  'https://www.youtube.com/watch?v=hNBn1zBguE8', // 1 · Visão
  'https://www.youtube.com/watch?v=_aSEHa5ih0k', // 2 · Missão
  'https://www.youtube.com/watch?v=ImQVUQo1y3I', // 3 · Valores
  'https://www.youtube.com/watch?v=WOKQUImEbqo', // 4 · Objetivos
  'https://www.youtube.com/watch?v=kskXFwsQnUE', // 5 · Diagnóstico
  'https://www.youtube.com/watch?v=W0VT83nJG9E', // 6 · Estratégias
  'https://www.youtube.com/watch?v=dyC3z3ttGqo', // 7 · Prioridades
  'https://www.youtube.com/watch?v=n6r6k5pb0z8', // 8 · Seu plano
];

// As duas fontes numéricas do wizard sempre foram independentes: o "de 9" exibido vem de
// `STEP_LABELS.length`, e a checagem de "concluído" (`step >= WIZARD_TOTAL_STEPS`) vem da
// constante. Esta linha as amarra em tempo de compilação, sem custo nenhum em runtime.
const _mesmoTotal: typeof STEP_LABELS['length'] = WIZARD_TOTAL_STEPS;
void _mesmoTotal;
