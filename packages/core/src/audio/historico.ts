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
  // ⚠️ DUPLICAR É O CONTRÁRIO DE APAGAR, e não um caso do `cortar`. O corte MEXE no clipe de
  // origem (encolhe-o) e por isso carrega as duas durações; duplicar não lhe toca em nada — só
  // nasce uma cópia ao lado. Guardar o id do original mesmo assim não é enfeite: é o que
  // permite dizer "duplicar o clipe" e, um dia, encontrar de quem a cópia veio.
  | { tipo: 'duplicar'; clipeId: string; novoClipeId: string }
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

// ─── A SETA COM MAIS DE UMA PESSOA NA SALA ───────────────────────────────────
//
// A pilha é de cada um: só entra nela o que EU fiz. O perigo não é desfazer o passo do outro —
// é desfazer o MEU por cima do que o outro fez a seguir.
//
// Eu movo o clipe de 5 para 12. O Nuno move-o para 30. Eu carrego na seta, e ela escreve 5: o
// meu passo volta e o trabalho dele desaparece, sem aviso e sem forma de o trazer de volta,
// porque a pilha dele nunca soube que aquilo aconteceu.
//
// A regra que fecha isto é simples de dizer: a seta só anda se o mundo ainda estiver como o meu
// passo o deixou. Se alguém mexeu ali depois de mim, o passo caduca — e a tela diz porquê, em
// vez de fingir que não aconteceu nada.

/** A montagem como ela está agora, do ponto de vista de quem confere um passo. */
export interface MundoDaMontagem {
  /** As pistas VISÍVEIS: uma pista marcada para apagar não está aqui. */
  pistas: { id: string; clips?: { id: string }[] | null }[];
  /** Os clipes VISÍVEIS, com onde cada um está agora. */
  clipes: { id: string; track_id: string; start_seconds: number; duration_seconds: number }[];
}

/** Por que é que a seta não anda. `null` quando ela anda. */
export type PassoCaduco = string | null;

/**
 * O passo ainda pode ser aplicado?
 *
 * Devolve `null` quando sim, e a razão quando não — a tela mostra-a tal e qual.
 *
 * ⚠️ A COMPARAÇÃO É COM O QUE SE VÊ, e não com uma leitura ao servidor. Com o canal ao vivo
 * ligado, a montagem local é a do banco a menos de um segundo: conferir contra ela é conferir
 * contra a verdade, e sem pagar uma ida à rede num gesto que tem de ser instantâneo.
 */
export const conferirOPasso = (
  passo: PassoDaMontagem,
  mundo: MundoDaMontagem,
  sentido: 'desfazer' | 'refazer',
): PassoCaduco => {
  const voltando = sentido === 'desfazer';
  const clipe = (id: string) => mundo.clipes.find((c) => c.id === id);
  const pista = (id: string) => mundo.pistas.find((p) => p.id === id);
  const MEXERAM = 'Alguém mexeu nisto depois de você.';
  // Uma margem de arredondamento: os segundos viajam como texto e voltam como número.
  const mesmoSegundo = (a: number, b: number) => Math.abs(a - b) < 0.01;

  switch (passo.tipo) {
    case 'mover': {
      const alvo = clipe(passo.clipeId);
      if (!alvo) return MEXERAM;
      // Desfazer espera o clipe onde EU o pus; refazer, onde ele estava antes de mim.
      const esperado = voltando ? passo.para : passo.de;
      const pistaEsperada = voltando ? passo.paraPista : passo.dePista;
      if (!mesmoSegundo(Number(alvo.start_seconds), esperado)) return MEXERAM;
      if (pistaEsperada && alvo.track_id !== pistaEsperada) return MEXERAM;
      return null;
    }
    case 'apagarClipe':
      // Desfazer só faz sentido se ele ainda estiver removido; refazer, se ele tiver voltado.
      return (voltando ? !clipe(passo.clipeId) : !!clipe(passo.clipeId)) ? null : MEXERAM;
    case 'apagarPista':
      return (voltando ? !pista(passo.pistaId) : !!pista(passo.pistaId)) ? null : MEXERAM;
    case 'cortar': {
      const esquerdo = clipe(passo.clipeId);
      if (!esquerdo) return MEXERAM;
      const duracaoEsperada = voltando ? passo.duracaoDepois : passo.duracaoAntes;
      if (!mesmoSegundo(Number(esquerdo.duration_seconds), duracaoEsperada)) return MEXERAM;
      // O pedaço da direita existe depois do corte e não existe antes dele.
      const direito = !!clipe(passo.novoClipeId);
      return (voltando ? direito : !direito) ? null : MEXERAM;
    }
    case 'duplicar':
      // A cópia existe depois do gesto e não existe antes dele — o espelho exato do `apagarClipe`.
      return (voltando ? !!clipe(passo.novoClipeId) : !clipe(passo.novoClipeId)) ? null : MEXERAM;
    case 'acrescentarPistas': {
      if (!voltando) {
        // Refazer traz as pistas de volta: elas têm de estar fora de cena.
        return passo.pistaIds.every((id) => !pista(id)) ? null : MEXERAM;
      }
      // ⚠️ E DESFAZER SÓ SE ELAS CONTINUAREM VAZIAS. Uma faixa que nasceu do meu gesto mas que
      // já tem o áudio de outra pessoa dentro não é minha para desfazer: a seta apagava o
      // trabalho dela para desmanchar um gesto meu de dez minutos antes.
      const todas = passo.pistaIds.map(pista);
      if (todas.some((p) => !p)) return MEXERAM;
      return todas.every((p) => !(p?.clips || []).length)
        ? null
        : 'Esta faixa já tem áudio de alguém.';
    }
    default:
      return null;
  }
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
    case 'duplicar': return 'duplicar o clipe';
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
