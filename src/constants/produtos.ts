/**
 * Cor de cada produto do ciclo de crescimento, como triplete "r, g, b".
 *
 * Fica separado do gradiente ([components/productTheme.ts]) porque a cor é dado e o gradiente é
 * um SVG importado — e um SVG importado é o que amarra um arquivo ao empacotador da web. O
 * núcleo (`useJourneyState`) precisa da cor; quem desenha fundo precisa dos dois.
 */
export const ACENTO_DO_PRODUTO = {
  real: '46, 196, 122', // verde — REAL · Diagnóstico
  planning: '154, 79, 209', // roxo da marca — Planejamento
  action: '154, 79, 209', // roxo da marca — Plano de Ação
} as const;
