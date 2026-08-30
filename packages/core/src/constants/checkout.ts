// O CHECKOUT do desbloqueio de um perfil.
//
// Os números e os textos moram aqui porque as duas superfícies cobram a MESMA coisa: o preço
// de fallback, o mínimo por parcela que a Asaas aceita, o que o pagamento libera e a razão
// social que aparece no extrato de quem paga. Uma segunda lista de benefícios no app seria uma
// segunda promessa sobre o mesmo produto.

/**
 * Preço do pagamento único.
 *
 * O valor real vem de `asaas_plan_config.profile_unlock_value` (editável sem deploy, o mesmo
 * caminho do preço da assinatura). Este fallback só vale enquanto a config não carrega — ou se
 * ela falhar.
 */
export const VALOR_PADRAO_DO_PERFIL = 199.9;

/**
 * A Asaas recusa parcela abaixo de R$ 5,00 (`invalid_value`, HTTP 400). O número máximo de
 * parcelas sai daí, e não de uma constante: se o preço mudar na config, o parcelamento
 * acompanha sozinho.
 */
export const VALOR_MINIMO_DA_PARCELA = 5;

/** Quantas parcelas cabem num valor, respeitando o mínimo da Asaas e o teto de 12. */
export const parcelasPossiveis = (valor: number): number =>
  Math.max(1, Math.min(12, Math.floor(valor / VALOR_MINIMO_DA_PARCELA)));

/** O que o pagamento único libera — a checklist curta do resumo. */
export const O_QUE_LIBERA = [
  'Planejamento estratégico',
  'Plano de ação com metas e cronograma',
  'Análise de audiência: ouvintes e cidades',
  'Músicas, agenda e equipe',
  'Acesso vitalício ao perfil',
] as const;

/**
 * Quem recebe.
 *
 * É o nome que aparece na fatura do cartão e no app do banco de quem paga o PIX. Sem ele, a
 * cobrança chega como uma empresa desconhecida — e vira contestação.
 */
export const RECEBEDOR = {
  razaoSocial: 'MUSIC RIO ACADEMY LTDA',
  cnpj: '22.826.985/0001-41',
} as const;

/** A chamada do topo do checkout. */
export const CHAMADA_DO_DESBLOQUEIO = {
  titulo: (nome?: string | null) =>
    `Comece hoje o planejamento${nome ? ` de ${nome}` : ' estratégico'}.`,
  apoio:
    'Você já tem o diagnóstico REAL da carreira. O próximo passo é o plano de ação: metas, '
    + 'estratégias e cronograma, construídos com a Nyta e a metodologia que já orientou centenas '
    + 'de artistas. Acesso vitalício ao perfil, num pagamento único.',
  pix:
    'Ao continuar, geramos um código PIX pra você pagar na hora. O acesso libera assim que o '
    + 'pagamento cair.',
  legal:
    'Pagamento único pelo acesso a este perfil. O perfil e o plano ficam seus pra sempre. A Nyta '
    + 'IA contínua é um plano à parte.',
} as const;
