// O ESPAÇO JAM COM MAIS DE UMA PESSOA DENTRO.
//
// Duas coisas acontecem quando duas pessoas abrem a mesma música: é preciso SABER que o outro
// está lá (os avatares no topo) e é preciso VER o que ele faz (a montagem a mexer-se sozinha).
//
// Aqui mora só o que se decide sem rede: quem está presente, o que é eco da minha própria
// escrita, e o que fazer com um evento que chegou. O canal em si — que é o mesmo Supabase
// Realtime que a conversa já usa — vive no `useJamAoVivo`, e as telas só recebem o resultado.
//
// ⚠️ PURO DE PROPÓSITO. "Duas pessoas a arrastar o mesmo clipe" não é uma asserção que se
// escreva com dois navegadores abertos; é uma asserção sobre uma função que recebe um evento e
// devolve uma decisão. É a única forma de isto ter testes a sério.

/** Quem está com o projeto aberto agora. */
export interface Presente {
  id: string;
  nome: string;
  foto?: string | null;
}

/**
 * A primeira letra, para o círculo de quem não tem foto.
 *
 * ⚠️ APARA ANTES DE DESISTIR. Feito ao contrário — `(nome || '?').trim()` — um nome só com
 * espaços passa pela guarda e sai vazio: o círculo fica sem letra nenhuma, que é pior do que a
 * interrogação, porque parece um erro de desenho em vez de um nome que falta.
 */
export const iniciais = (valor?: string | null): string => {
  const limpo = (valor || '').trim();
  return (limpo ? limpo.slice(0, 1) : '?').toUpperCase();
};

/**
 * A lista de avatares do topo, a partir do estado bruto do canal.
 *
 * O Supabase devolve um objeto de chaves para listas: a mesma pessoa em dois separadores
 * aparece duas vezes, e a ordem das chaves não é estável entre sincronizações.
 *
 * ⚠️ SEM REPETIDOS e com EU PRIMEIRO. Repetidos porque abrir o editor em dois separadores é
 * banal e três avatares iguais no topo só dizem "alguém está com o browser aberto"; eu primeiro
 * porque a fila muda de ordem a cada pessoa que entra, e uma fila que dança é uma fila que
 * ninguém lê. O resto sai por nome, que é a única ordem que não depende de quem chegou quando.
 */
export const pessoasPresentes = (
  estado: Record<string, Presente[]>,
  meuId?: string | null,
): Presente[] => {
  const porId = new Map<string, Presente>();
  Object.values(estado || {}).forEach((lista) => {
    (lista || []).forEach((pessoa) => {
      if (!pessoa?.id) return;
      porId.set(pessoa.id, pessoa);
    });
  });

  const todos = Array.from(porId.values())
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  const eu = todos.filter((p) => p.id === meuId);
  return [...eu, ...todos.filter((p) => p.id !== meuId)];
};

// ─── O ECO ───────────────────────────────────────────────────────────────────
//
// O Postgres manda de volta TUDO o que muda, incluindo o que fui eu a escrever. Aplicar o meu
// próprio eco quase sempre não faz mal — escrever o mesmo valor por cima do mesmo valor não
// muda nada. O caso em que faz mal é este, e ele acontece a cada arrasto: escrevo 12, continuo
// a arrastar até 20, e o eco do 12 chega depois. Sem uma memória do que eu próprio escrevi, o
// clipe salta para trás debaixo do dedo.

/** Quantas escritas minhas por linha valem a pena lembrar. Um arrasto longo não passa disto. */
const ESCRITAS_LEMBRADAS = 8;
/** Por quanto tempo. Passado isto, um eco atrasado já não é meu problema. */
const MEMORIA_MS = 15_000;

export interface EcoDasEscritas {
  /** Guarda a assinatura de uma linha como ela ficou depois de EU a escrever. */
  anotar: (id: string, assinatura: string) => void;
  /** Este evento é o retorno de uma escrita minha? */
  ehMeu: (id: string, assinatura: string, agora?: number) => boolean;
}

/**
 * A memória do que escrevi.
 *
 * ⚠️ ELA TEM UM BURACO CONHECIDO, e é melhor dizê-lo do que fingir que não: se a outra pessoa
 * puser a linha exatamente no valor onde eu a tive há pouco, eu trato o evento dela como meu e
 * ignoro-o — a minha tela fica a mostrar o meu valor até recarregar. É raro (exige que os dois
 * passem pelo mesmo número, no mesmo campo, na mesma janela de quinze segundos) e o estrago é
 * uma tela desatualizada, não um dado perdido. A alternativa era carimbar cada escrita com o id
 * da sessão, o que custa uma coluna nas duas tabelas mais quentes da montagem.
 */
export const criarEcoDasEscritas = (): EcoDasEscritas => {
  const minhas = new Map<string, { assinatura: string; quando: number }[]>();

  return {
    anotar: (id, assinatura) => {
      const lista = minhas.get(id) ?? [];
      lista.push({ assinatura, quando: Date.now() });
      minhas.set(id, lista.slice(-ESCRITAS_LEMBRADAS));
    },
    ehMeu: (id, assinatura, agora = Date.now()) => {
      const lista = minhas.get(id);
      if (!lista) return false;
      const vivas = lista.filter((e) => agora - e.quando < MEMORIA_MS);
      if (vivas.length !== lista.length) minhas.set(id, vivas);
      return vivas.some((e) => e.assinatura === assinatura);
    },
  };
};

/** O que, numa PISTA, conta como uma mudança que a outra tela precisa de ver. */
export const assinaturaDaPista = (linha: Record<string, unknown>): string => JSON.stringify([
  linha.name ?? '', Number(linha.position) || 0, Number(linha.gain ?? 1),
  !!linha.muted, Number(linha.color_index) || 0, Number(linha.pan) || 0,
  linha.deleted_at ?? null,
]);

/** O mesmo, num CLIPE. `track_id` entra: arrastar de uma faixa para outra é mexer no clipe. */
export const assinaturaDoClipe = (linha: Record<string, unknown>): string => JSON.stringify([
  linha.track_id ?? '', Number(linha.start_seconds) || 0,
  Number(linha.offset_seconds) || 0, Number(linha.duration_seconds) || 0,
  linha.deleted_at ?? null,
]);

// ─── O QUE FAZER COM UM EVENTO ───────────────────────────────────────────────

export type EventoDoJam =
  | { tabela: 'catalog_tracks'; tipo: 'INSERT' | 'UPDATE' | 'DELETE'; linha: Record<string, unknown> }
  | { tabela: 'catalog_clips'; tipo: 'INSERT' | 'UPDATE' | 'DELETE'; linha: Record<string, unknown> };

export type DecisaoDoJam =
  | { faca: 'nada' }
  /** Recarregar a montagem inteira: chegou coisa que a tela não sabe montar sozinha. */
  | { faca: 'recarregar' }
  | { faca: 'remendarPista'; id: string; parte: Record<string, unknown> }
  | { faca: 'remendarClipe'; id: string; parte: Record<string, unknown> };

/**
 * O que a tela faz quando um evento chega.
 *
 * ⚠️ UM UPDATE REMENDA; UM INSERT RECARREGA. Um clipe novo traz um `file_id` cujo ficheiro a
 * tela pode nunca ter visto — sem a URL dele não há o que tocar nem o que desenhar, e inventar
 * uma linha pela metade seria pôr na montagem um retângulo mudo. Recarregar custa uma ida ao
 * servidor e acontece quando alguém ENVIA áudio, que é raro; remendar é o caso de cada arrasto,
 * e esse não pode custar uma leitura nem derrubar os buffers já descodificados.
 *
 * `DELETE` de verdade só acontece na limpeza do fim da sessão, e o que ela apaga já estava
 * marcado — a tela já não o mostrava. Recarregar ali é o mais honesto: o que sobrou é o que há.
 */
export const decidirOEvento = (
  evento: EventoDoJam,
  eco: Pick<EcoDasEscritas, 'ehMeu'>,
  conhecidos: { pistas: string[]; clipes: string[] },
): DecisaoDoJam => {
  const id = String(evento.linha.id ?? '');
  if (!id) return { faca: 'nada' };

  if (evento.tabela === 'catalog_tracks') {
    if (evento.tipo !== 'UPDATE' || !conhecidos.pistas.includes(id)) return { faca: 'recarregar' };
    if (eco.ehMeu(`pista:${id}`, assinaturaDaPista(evento.linha))) return { faca: 'nada' };
    // Uma pista marcada (ou trazida de volta) muda quantas faixas a tela desenha: isso não é
    // remendo de campo, é outra montagem.
    if (evento.linha.deleted_at) return { faca: 'recarregar' };
    return {
      faca: 'remendarPista',
      id,
      parte: {
        name: evento.linha.name,
        position: evento.linha.position,
        gain: evento.linha.gain,
        muted: evento.linha.muted,
        color_index: evento.linha.color_index,
        pan: evento.linha.pan,
      },
    };
  }

  if (evento.tipo !== 'UPDATE' || !conhecidos.clipes.includes(id)) return { faca: 'recarregar' };
  if (eco.ehMeu(`clipe:${id}`, assinaturaDoClipe(evento.linha))) return { faca: 'nada' };
  if (evento.linha.deleted_at) return { faca: 'recarregar' };
  // ⚠️ E A FAIXA DE DESTINO TEM DE EXISTIR AQUI. Apanhado no simulador: alguém arrastou o clipe
  // para uma faixa criada depois de esta tela ter lido a montagem, o remendo tirou-o de onde
  // estava e não o pôs em lado nenhum — o clipe DESAPARECEU do editor, e só voltava a
  // recarregar. Uma faixa que eu não conheço quer dizer que a minha montagem está velha, e o
  // que se faz com uma montagem velha é reler.
  if (!conhecidos.pistas.includes(String(evento.linha.track_id ?? ''))) return { faca: 'recarregar' };
  return {
    faca: 'remendarClipe',
    id,
    parte: {
      track_id: evento.linha.track_id,
      start_seconds: evento.linha.start_seconds,
      offset_seconds: evento.linha.offset_seconds,
      duration_seconds: evento.linha.duration_seconds,
    },
  };
};
