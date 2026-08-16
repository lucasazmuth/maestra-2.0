// Chaves de funcionalidade que nascem desligadas.
//
// Não confundir com configuração: o que está aqui existe pronto no código mas NÃO pode operar
// antes de uma autorização externa. Ligar sem essa autorização é o próprio problema que a chave
// evita.

/**
 * Consentimento para uso dos dados na pesquisa de doutorado (TCLE).
 *
 * DESLIGADA. Só pode ser ativada mediante ordem escrita da Anita acompanhada do número do parecer
 * de aprovação do Comitê de Ética em Pesquisa da ESPM. Sem o parecer, nenhum dado desta base pode
 * ser coletado com finalidade de pesquisa — a base é exclusivamente operacional (do produto).
 *
 * Para ligar: definir REACT_APP_TCLE_ENABLED=true no ambiente e registrar, no PR, a data da
 * ativação e o número do parecer.
 */
export const TCLE_ENABLED = process.env.REACT_APP_TCLE_ENABLED === 'true';
