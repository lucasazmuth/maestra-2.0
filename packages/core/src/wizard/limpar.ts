// Remove travessões (—) de QUALQUER texto exibido no wizard (roteiro estático, texto gerado pela
// IA e dados já salvos no plano). Vira vírgula (uso apositivo/parentético), sem alterar o conteúdo,
// só a pontuação. Aplicado nos pontos de render (balões da Nyta + widgets + painel do plano) pra
// garantir que nada exiba "—", mesmo dado salvo antes da correção da fonte.
export const stripEmDash = (s: string): string =>
  s.replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',');
