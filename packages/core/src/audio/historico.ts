// AS DUAS SETAS DA MONTAGEM.
//
// Uma linha do tempo sem desfazer é uma linha do tempo onde ninguém experimenta: corta-se um
// clipe com medo, apaga-se uma pista com mais medo ainda, e o trabalho fica pela metade. As
// setas não são conveniência — são o que autoriza a experimentar.
//
// Este módulo é só a PILHA: ele guarda o que aconteceu e diz o que desfazer a seguir. Executar
// (falar com o banco, mexer na mesa) é da tela, que é quem tem essas mãos. A separação é o que
// torna isto testável sem áudio, sem rede e sem DOM.

/**
 * O que se pode desfazer.
 *
 * ⚠️ SÓ A MONTAGEM ENTRA AQUI: mover, cortar, apagar, acrescentar. Os campos de texto (título,
 * andamento, tom, ficha) ficam de fora de propósito — eles já têm o desfazer do próprio
 * navegador dentro do campo, e misturá-los nesta pilha faria uma seta às vezes mexer no áudio e
 * às vezes numa letra, sem quem olha conseguir prever qual.
 *
 * Cada passo carrega o que é preciso para o desandar E para o refazer: um `mover` sem o `de`
 * não sabe voltar, e um `cortar` sem o id do pedaço novo não sabe o que remover.
 */
export type PassoDaMontagem =
  // ⚠️ MOVER É NO TEMPO **E** ENTRE PISTAS, e o desfazer precisa dos dois. Arrastar um clipe
  // da voz para a bateria e carregar na seta punha-o de volta no segundo certo — na pista
  // errada, que é onde ele nunca esteve.
  | {
    tipo: 'mover';
    clipeId: string;
    de: number;
    para: number;
    /** Só quando o arrasto mudou de pista. Ausente, o clipe ficou onde estava. */
    dePista?: string;
    paraPista?: string;
  }
  | { tipo: 'apagarClipe'; clipeId: string }
  | { tipo: 'apagarPista'; pistaId: string }
  | { tipo: 'cortar'; clipeId: string; duracaoAntes: number; duracaoDepois: number; novoClipeId: string }
  | { tipo: 'acrescentarPistas'; pistaIds: string[] };

export interface Historico {
  /** O que já aconteceu, do mais antigo para o mais recente. O topo é o fim. */
  passado: PassoDaMontagem[];
  /** O que foi desfeito e ainda dá para refazer. O topo é o fim. */
  futuro: PassoDaMontagem[];
}

export const HISTORICO_VAZIO: Historico = { passado: [], futuro: [] };

/**
 * Quantos passos a pilha guarda.
 *
 * ⚠️ ELA TEM DE TER TETO. Uma sessão de montagem dura horas e um arrasto pode render dezenas de
 * passos por minuto; sem limite, a lista cresce para sempre e segura na memória ids de coisas
 * que já não existem. Cinquenta é fundo suficiente para qualquer engano real — ninguém desfaz
 * cinquenta gestos, desfaz dois ou três — e é uma lista curta o bastante para não se pensar
 * mais nela.
 */
export const LIMITE_DO_HISTORICO = 50;

/**
 * Regista um passo novo.
 *
 * ⚠️ E LIMPA O FUTURO. Desfazer três vezes e então fazer outra coisa apaga o que se ia refazer,
 * e é o comportamento certo: o refazer prometeria devolver uma montagem que já não existe, com
 * clipes que entretanto mudaram de sítio por baixo dela.
 */
export const registar = (historico: Historico, passo: PassoDaMontagem): Historico => ({
  passado: [...historico.passado, passo].slice(-LIMITE_DO_HISTORICO),
  futuro: [],
});

export const podeDesfazer = (historico: Historico): boolean => historico.passado.length > 0;
export const podeRefazer = (historico: Historico): boolean => historico.futuro.length > 0;

/**
 * Tira o último passo do passado e devolve-o, com a pilha já andada.
 *
 * `null` quando não há nada a desfazer: quem chama não precisa de perguntar antes.
 */
export const desfazer = (
  historico: Historico,
): { historico: Historico; passo: PassoDaMontagem } | null => {
  const passo = historico.passado[historico.passado.length - 1];
  if (!passo) return null;
  return {
    passo,
    historico: {
      passado: historico.passado.slice(0, -1),
      futuro: [...historico.futuro, passo],
    },
  };
};

export const refazer = (
  historico: Historico,
): { historico: Historico; passo: PassoDaMontagem } | null => {
  const passo = historico.futuro[historico.futuro.length - 1];
  if (!passo) return null;
  return {
    passo,
    historico: {
      passado: [...historico.passado, passo].slice(-LIMITE_DO_HISTORICO),
      futuro: historico.futuro.slice(0, -1),
    },
  };
};

/**
 * O que a seta faria a seguir, em palavras.
 *
 * ⚠️ UMA SETA MUDA NÃO SE USA. Duas setas iguais lado a lado não dizem o que vão desmanchar, e
 * quem hesita não carrega — o desfazer só serve a quem confia nele. O texto vai no `title` e no
 * rótulo de leitor de tela.
 */
export const descreverPasso = (passo?: PassoDaMontagem | null): string | null => {
  if (!passo) return null;
  switch (passo.tipo) {
    case 'mover': return 'mover o clipe';
    case 'apagarClipe': return 'remover o clipe';
    case 'apagarPista': return 'apagar a pista';
    case 'cortar': return 'dividir o clipe';
    case 'acrescentarPistas':
      return passo.pistaIds.length > 1
        ? `acrescentar ${passo.pistaIds.length} pistas`
        : 'acrescentar a pista';
    default: return null;
  }
};

/** "Desfazer: remover o clipe", ou só "Desfazer" quando não há nada. */
export const rotuloDaSeta = (
  acao: 'Desfazer' | 'Refazer',
  passo?: PassoDaMontagem | null,
): string => {
  const o = descreverPasso(passo);
  return o ? `${acao}: ${o}` : `${acao} (nada por agora)`;
};
