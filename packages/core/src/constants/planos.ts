// A ASSINATURA Maestra PRO, em palavras.
//
// Irmão do `checkout.ts`, que faz o mesmo para o pagamento único, e existe pela mesma razão: as
// duas superfícies falam do MESMO produto. Uma segunda lista de benefícios escrita no app seria
// uma segunda promessa sobre a mesma assinatura, e elas divergiriam no primeiro ajuste.
//
// ⚠️ SÓ TEXTO AQUI. Os ícones ficam de fora de propósito: o núcleo não conhece DOM nem React
// Native, e cada superfície desenha o seu a partir da `chave`. Uma lista de textos atravessa as
// duas; um `<FiTarget />` não atravessa nenhuma.

/** A chamada do topo — a mesma manchete nas duas telas de planos. */
export const CHAMADA_DO_PRO = {
  titulo: 'Faça mais com o Maestra PRO',
  apoio: 'Edição completa e a Nyta Assistente em todos os seus perfis.',
} as const;

export type ChaveDoBeneficio = 'executar' | 'nyta' | 'gestao' | 'acompanhar';

export interface GrupoDeBeneficios {
  chave: ChaveDoBeneficio;
  titulo: string;
  itens: readonly string[];
}

export const BENEFICIOS_DO_PRO: readonly GrupoDeBeneficios[] = [
  {
    chave: 'executar',
    titulo: 'Execute o seu plano',
    itens: ['Gestão de tarefas do plano de ação', 'Edição em todos os perfis que você acessa'],
  },
  {
    chave: 'nyta',
    titulo: 'Assistente de IA ao seu lado',
    // ⚠️ 100/dia por perfil, e NÃO "ilimitado": o limite vem de `nyta_plan_limits` (pro = 100) e o
    // contador é por (usuário, artista, dia UTC) em `nyta_daily_usage`. O próprio chat mostra
    // "X/100" no cabeçalho — prometer ilimitado aqui contradiria a tela seguinte.
    itens: [
      'Nyta Assistente — até 100 interações por dia em cada perfil',
      'Recomendações sob o contexto da sua carreira',
    ],
  },
  {
    chave: 'gestao',
    titulo: 'Gestão completa',
    itens: ['Músicas ilimitadas', 'Acesso a todos os perfis da conta'],
  },
] as const;

export const BENEFICIOS_DO_GRATIS: readonly GrupoDeBeneficios[] = [
  {
    chave: 'acompanhar',
    titulo: 'Acompanhe a carreira',
    itens: [
      'Veja o diagnóstico e o plano de ação',
      'Visualize músicas, agenda e equipe',
      'Apenas leitura, sem edição',
    ],
  },
] as const;

/** Os dois ciclos, como aparecem na lista de planos. O preço vem do servidor, nunca daqui. */
export const CICLOS_DO_PRO = [
  {
    chave: 'monthly',
    nome: 'Mensal',
    itens: ['Edição em todos os perfis da conta', 'Nyta Assistente em cada perfil', 'Cancele quando quiser'],
  },
  {
    chave: 'annual',
    nome: 'Anual',
    itens: ['Tudo o que o plano mensal tem', 'O ano inteiro, com desconto', 'Cancele quando quiser'],
  },
] as const;

/**
 * Como se paga a assinatura.
 *
 * ⚠️ "RECORRENTE" É O QUE DÁ PARA GARANTIR, e o texto para aí de propósito. A assinatura por PIX
 * tem DOIS caminhos e quem decide é o servidor: com `plan.pixAutomaticEnabled` ligado, a pessoa
 * autoriza uma vez e os débitos seguintes são automáticos; se a autorização falhar — conta sem o
 * produto, banco do pagador sem suporte, indisponibilidade —, o checkout cai no fluxo de cobrança
 * por ciclo, que é um QR novo a cada mês. Ver `src/pages/Subscription/index.tsx`.
 *
 * Prometer "débito automático" quebraria no dia em que o fallback entrasse; prometer "um QR por
 * mês" já está errado hoje, com a chave ligada. Recorrente é verdade nos dois.
 */
export const COMO_SE_PAGA = 'Cartão de crédito ou PIX recorrente.';

/**
 * ONDE SE ASSINA — o texto da folha do app.
 *
 * ⚠️ O ENDEREÇO É PARA SER LIDO E DIGITADO, não tocado. A App Store 3.1.3 (anti-steering) alcança
 * botão e link para outro meio de pagamento; um endereço escrito não é nem um nem outro. É por
 * isto que a rota da web deixou de ser `/assinatura` e passou a `/planos`: para caber numa frase
 * que alguém consegue copiar para a barra do navegador.
 *
 * Quem transformar isto num `Pressable` com `Linking.openURL` desfaz a razão de a tela existir —
 * e há um caso em `portaDaCobranca.test.ts` que apanha isso.
 */
export const ONDE_SE_ASSINA = {
  endereco: 'www.maestramanager.com/planos',
  titulo: 'Para assinar, acesse www.maestramanager.com/planos',
  corpo: 'Não é possível assinar pelo app.',
  entendi: 'Entendi',
} as const;
