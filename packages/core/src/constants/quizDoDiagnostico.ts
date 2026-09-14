import {
  FAIXAS_ANUAIS, FAIXAS_DE_FIXO, FAIXAS_DE_SALDO, FAIXAS_POR_SHOW,
  type ImprensaTipo, type ImprensaPorte, type TipoDeContratante, type FonteDeReceita,
} from '../services/realEngine';
import { FIXOS } from './realTextos';

// O ROTEIRO do Diagnóstico REAL v4.2 — o questionário inteiro, sem uma linha de interface.
//
// Subiu de `src/pages/ArtistCreate` para o núcleo quando o app nativo ganhou a criação de perfil.
// As chaves casam com os campos de `RealInputsV4` que o motor consome e que a edge
// `artist-diagnostic` mapeia em `buildRealInputsV4`: um roteiro por superfície significaria dois
// diagnósticos que o mesmo servidor lê de maneiras diferentes — e o erro apareceria como uma
// nota errada, não como uma tela quebrada.
//
// ⚠️ A ORDEM É A DA v4.2, e ela é o oposto da v4: o quiz abria pelo bloco financeiro, e começar
// pedindo dinheiro soa agressivo. Agora vai do mais leve ao mais sensível — atividade antes de
// dinheiro, sim/não e contagem antes de valores, conquistas antes de estrutura, dinheiro por
// último, quando a pessoa já investiu tempo e viu que o instrumento fala a língua dela.
//
// NADA disso muda o cálculo: as chaves, os tipos e as condições são os mesmos, e o motor não
// sabe em que ordem foi perguntado. O que muda é `QUIZ[]` e as TRANSIÇÕES de bloco.
//
// ⚠️ O QUE MUDOU DA v3 (§ Apêndice A): base ANUAL no E (shows por ano, seis cachês por tipo de
// contratante, nove fontes com "não sei", alíquota); bloco R de autodeclaração que só aparece
// quando a Chartmetric não trouxe o dado; e a matriz de imprensa passa a aceitar UM porte por
// tipo, o maior, porque é o teto de legitimação que o método mede.

export type QuizValue = string | number | boolean;
export type QuizFieldType = 'int' | 'select' | 'tabela';
/**
 * As chaves de CONTROLE, que não são resposta nenhuma (§3.2).
 *
 * Elas guardam um desvio que o artista pediu — "me ajude a calcular", "separa fonte por fonte" —
 * e por isso começam com `_`: a edge ignora o que não reconhece, e o prefixo faz a distinção
 * saltar à vista de quem lê o payload gravado.
 */
export type ChaveDeControle = '_detalhar' | '_cachePorTipo' | '_fontes';
export type QuizKey =
  | 'vinculo'
  | 'igFollowersSelf' | 'tiktokFollowersSelf' | 'youtubeViews28dSelf'
  | 'showsPerYear' | 'saldoFaixa'
  | 'cacheFaixa' | 'cacheByTypeFaixa' | 'outrasFaixa' | 'outrasPorFonteFaixa'
  | 'custoShowFaixa' | 'fixoFaixa' | 'lancFaixa'
  | 'temCnpj' | 'temEmpresario'
  | 'fazBilheteria' | 'pagantePct'
  | 'premios' | 'imprensaRepercussao' | 'imprensaMatrix' | 'imprensaFrequencia'
  | ChaveDeControle;

/**
 * O bloco a que a pergunta pertence (v4.2, §2).
 *
 * Existe para a TRANSIÇÃO: ela é do bloco, e não da pergunta. Amarrá-la à primeira pergunta de
 * cada bloco quebraria no bloco digital, onde a primeira pergunta é justamente a que mais some
 * (quem tem Instagram encontrado pela API pula ela e cai na do TikTok).
 */
export type QuizBloco = 'vinculo' | 'shows' | 'digital' | 'reconhecimento' | 'numeros' | 'detalhe';

/** Uma linha ou uma coluna da tabela de escolha única. */
export interface OpcaoDaTabela { key: string; label: string }

/**
 * Uma tabela de ESCOLHA ÚNICA POR LINHA (`type: 'tabela'`).
 *
 * ⚠️ ERA A MATRIZ DE IMPRENSA, E SÓ ELA. Os dois renderizadores — web e app — liam as constantes
 * `IMPRENSA_TIPOS` e `IMPRENSA_PORTES` direto do módulo e ignoravam a definição da pergunta: o
 * `type: 'matrix'` não descrevia uma forma, nomeava UMA pergunta. A segunda pergunta com esta
 * forma obrigaria a copiar os dois renderizadores inteiros, e a partir daí as duas cópias
 * divergiriam em silêncio de um lado só.
 *
 * Agora a forma está aqui e os dados vêm da pergunta.
 */
export interface TabelaDeEscolhaUnica {
  linhas: readonly OpcaoDaTabela[];
  colunas: readonly OpcaoDaTabela[];
  /**
   * O rótulo da coluna que LIMPA a linha, desenhada antes das outras ("Nunca").
   *
   * Opcional porque nem toda tabela precisa dela: numa escala de faixas, "Nada" é a faixa 0, uma
   * resposta legítima — e não a ausência de resposta.
   */
  vazio?: string;
  /**
   * A linha abre a lista de colunas, uma de cada vez, em vez de as mostrar todas.
   *
   * ⚠️ É ESCOLHA DE PRODUTO, E NÃO DE ESTILO. Três chips de porte cabem numa linha a 375px; nove
   * faixas de cachê não cabem em lado nenhum. Com a linha a expandir, a escala aparece inteira,
   * uma linha de cada vez, e a tabela continua a caber no telemóvel.
   */
  expansivel?: boolean;
  /**
   * Como o mapa `{ linha: coluna }` vira o valor gravado, e como ele volta.
   *
   * Andam em par e existem por causa da imprensa, que grava um array de `{ tipo, porte }` desde a
   * v3. Sem eles a migração mudaria a forma do payload de uma pergunta já em produção, o que não
   * é generalizar coisa nenhuma — é aproveitar a boleia para mexer noutra coisa. Uma tabela nova
   * omite os dois e grava o mapa como ele é.
   */
  saida?: (marcado: Record<string, string>) => unknown;
  entrada?: (gravado: unknown) => Record<string, string>;
}

/** O valor de uma linha sem escolha. */
export const LINHA_SEM_ESCOLHA = '';

/** O mapa `{ linha: coluna }` a partir do que estava gravado na resposta. */
export const mapaDaTabela = (def: QuizDef, gravado: unknown): Record<string, string> => {
  if (def.tabela?.entrada) return def.tabela.entrada(gravado);
  return gravado && typeof gravado === 'object' && !Array.isArray(gravado)
    ? { ...(gravado as Record<string, string>) }
    : {};
};

/**
 * A coluna está marcada nesta linha?
 *
 * ⚠️ O `??` É O QUE FAZ A COLUNA QUE LIMPA ACENDER NUMA LINHA INTOCADA. A linha que o artista
 * ainda não tocou não tem valor nenhum no mapa, e a coluna que limpa tem a chave vazia: comparar
 * `undefined` com `''` dá falso, e a tabela abre com as seis linhas sem nada marcado — como se
 * "Nunca" fosse uma resposta que ele ainda tivesse de dar, quando é o estado inicial dela.
 *
 * Mora aqui porque é a MESMA regra nas duas superfícies, e é do tipo que se reescreve à mão sem
 * pensar: cada lado tinha a sua, e bastava uma perder o `??` para a tabela abrir diferente na web
 * e no app.
 */
export const colunaMarcada = (
  marcado: Record<string, string>,
  linha: string,
  coluna: string,
): boolean => (marcado[linha] ?? LINHA_SEM_ESCOLHA) === coluna;

/** O valor a gravar a partir do mapa `{ linha: coluna }`. */
export const respostaDaTabela = (def: QuizDef, marcado: Record<string, string>): unknown => {
  if (def.tabela?.saida) return def.tabela.saida(marcado);
  return Object.fromEntries(
    Object.entries(marcado).filter(([, v]) => v !== LINHA_SEM_ESCOLHA),
  );
};

export interface QuizDef {
  key: QuizKey;
  bloco: QuizBloco;
  q: string;
  type: QuizFieldType;
  /** Linha de apoio abaixo da pergunta, quando ela precisa de instrução (ex.: onde achar o número). */
  ajuda?: string;
  placeholder?: string;
  options?: { label: string; value: QuizValue }[];
  /** Pula a pergunta quando a condição é verdadeira (ex.: o cachê de quem não fez show). */
  skipIf?: (a: Record<string, any>) => boolean;
  /** Obrigatório em `type: 'tabela'`, e sem sentido nos outros. */
  tabela?: TabelaDeEscolhaUnica;
  /**
   * A resposta é gravada DENTRO da chave, nesta sub-chave.
   *
   * É o que permite as nove perguntas por fonte de receita gravarem todas em
   * `outrasPorFonteFaixa`, cada uma na sua fonte. Nove chaves de topo, uma por fonte, obrigariam
   * a edge a remontar o objeto — e a edge já está publicada.
   */
  sub?: string;
  /**
   * O botão sob as opções que abre um desvio EM VEZ DE responder a pergunta (§3.2).
   *
   * ⚠️ NÃO É UMA OPÇÃO A MAIS. Ele grava uma chave de controlo e avança sem responder, e é
   * justamente a ausência da resposta que o motor lê depois: quem pede ajuda para calcular o
   * saldo não responde QE.2, e é essa ausência que escolhe o caminho detalhado.
   */
  escape?: QuizEscape;
  /**
   * Uma fala que SUBSTITUI a transição do bloco quando a condição bate (§3.2).
   *
   * Duas coisas dependem dela: o QD.z, que explica a falta das perguntas de palco a quem não fez
   * show nenhum, e o QD.9, que fecha o detalhamento antes de voltar ao CNPJ. As duas são falas de
   * transição que não pertencem a um bloco inteiro, e sim a um caminho dentro dele.
   */
  transicaoSe?: { quando: (a: Record<string, any>) => boolean; texto: string }[];
}

/** O botão de desvio sob as opções de uma pergunta. */
export interface QuizEscape {
  rotulo: string;
  chave: ChaveDeControle;
  /** Sai como link discreto em vez de botão — o convite do QD.2b é um "se quiser". */
  comoLink?: boolean;
}
/**
 * O que a consulta prévia à Chartmetric trouxe (§3.1, passo 2). As telas depositam este objeto na
 * chave `CTX_API` das respostas ANTES de abrir o quiz, e é ele que decide quais perguntas de
 * autodeclaração de R aparecem.
 *
 * Rede de segurança (§3.1, passo 6): se a consulta falhar, o objeto não existe e as três perguntas
 * aparecem — é melhor perguntar de novo do que calcular o R sobre nada.
 */
export interface ApiDisponivel {
  igFollowers?: number | null;
  tiktokFollowers?: number | null;
  youtubeMonthlyViews?: number | null;
}
export const CTX_API = '_api';

/** Pula a autodeclaração quando a API já trouxe o campo com valor útil. */
const jaVeioDaApi = (campo: keyof ApiDisponivel) => (a: Record<string, any>): boolean => {
  const v = a?.[CTX_API]?.[campo];
  return v != null && Number(v) > 0;
};

/**
 * Mensagem da tela de orientação, antes do quiz (§3.1, passo 3).
 *
 * ⚠️ É O F9, E NÃO UMA SEGUNDA REDAÇÃO DELE. Havia dois textos para a mesma tela: este, escrito
 * no código, e o F9 do `realTextos`, escrito pela Anita. O que aparecia era este, e ele já tinha
 * divergido — prometia "usar o dado automático assim que ele existir" onde a spec diz "ler os
 * números sozinho", e perdia a frase que importa para quem está prestes a responder trinta
 * perguntas: "enquanto isso, o que a gente não conseguir ler você informa".
 */
export const ORIENTACAO_SPOTIFY = FIXOS.F9;

/** Os 6 tipos de contratante do cachê médio (§3.2), na ordem da spec. */
export const TIPOS_DE_CONTRATANTE_QUIZ: { key: TipoDeContratante; label: string }[] = [
  { key: 'corporativos', label: 'Corporativos (eventos fechados de empresas, festas de fim de ano)' },
  { key: 'orgaosPublicos', label: 'Órgãos públicos (prefeituras, fundações, Sescs)' },
  { key: 'particulares', label: 'Particulares (casamentos, aniversários, bodas)' },
  { key: 'produtores', label: 'Produtores de eventos (festivais e outros eventos)' },
  { key: 'casasDeShow', label: 'Casas de show e espaços de bilheteria (bares, teatros)' },
  { key: 'outros', label: 'Outros tipos de contratante' },
];

/**
 * As 9 fontes de receita fora dos shows (§3.2), na ordem da spec.
 *
 * O rótulo completa a pergunta "Quanto você recebeu nos últimos 12 meses...", por isso cada um
 * começa em minúscula e termina em interrogação.
 */
export const REVENUE_SOURCES: { key: FonteDeReceita; label: string }[] = [
  { key: 'distribuidora', label: 'da sua distribuidora?' },
  { key: 'editora', label: 'da sua editora?' },
  { key: 'associacao', label: 'da sua associação (direitos de execução)?' },
  { key: 'publi', label: 'em publis e ativações com marcas?' },
  { key: 'patrocinios', label: 'com patrocínios e editais?' },
  { key: 'aulas', label: 'com aulas, cursos e mentorias?' },
  { key: 'produtos', label: 'com venda de produtos físicos?' },
  { key: 'financiamento', label: 'de financiamento coletivo?' },
  { key: 'outras', label: 'de outras fontes relacionadas à música?' },
];

/** O valor que uma linha de receita assume quando o artista marca "não sei" (§4). */
export const NAO_SEI = 'nao_sei';

// Matriz de imprensa (§9.3) — tipo de veículo × porte. UMA escolha por tipo: o MAIOR porte.
export const IMPRENSA_TIPOS: { key: ImprensaTipo; label: string }[] = [
  { key: 'imprensa', label: 'Imprensa (jornal, revista, portal)' },
  { key: 'tv', label: 'Veículos de TV' },
  { key: 'influenciadores', label: 'Influenciadores do nicho musical' },
  { key: 'youtube', label: 'Canais no YouTube' },
  { key: 'podcasts', label: 'Podcasts' },
  { key: 'blogs', label: 'Blogs especializados' },
];
export const IMPRENSA_PORTES: { key: ImprensaPorte; label: string }[] = [
  { key: 'pequeno', label: 'Pequeno' },
  { key: 'medio', label: 'Médio' },
  { key: 'grande', label: 'Grande' },
];
export const SIM_NAO: { label: string; value: QuizValue }[] = [{ label: 'Sim', value: true }, { label: 'Não', value: false }];

// Declaração de vínculo com o artista. Primeira pergunta de propósito: enquadra o resto do
// questionário e é registrada com IP e a versão dos Termos vigente (ver a edge artist-diagnostic).
//
// NÃO BLOQUEIA: a última opção deixa qualquer pessoa seguir sem declarar vínculo. O objetivo não é
// impedir — é que quem forjar um diagnóstico de terceiro tenha afirmado algo, numa data, sob os
// Termos daquele momento. "Apenas conhecendo" também é informação: sai no PDF como tal.
export const VINCULO_OPCOES: { label: string; value: QuizValue }[] = [
  { label: 'Sou o artista', value: 'sou_o_artista' },
  { label: 'Faço parte da equipe do artista', value: 'equipe' },
  { label: 'Represento o artista (empresário, produtor, gravadora)', value: 'representante' },
  { label: 'Estou apenas conhecendo a ferramenta', value: 'conhecendo' },
];


/**
 * As transições de bloco (v4.2, §2), na voz da Nyta.
 *
 * Não são perguntas: são a frase que explica por que o próximo assunto está sendo puxado. A do
 * bloco `numeros` é a que carrega o peso todo — é ela que diz, antes de pedir dinheiro, que
 * ninguém mais vê aquilo e que estimativa vale.
 *
 * O bloco 0 (vínculo) não tem transição: ele abre o quiz e uma frase antes da primeira pergunta
 * seria uma tela a mais antes de qualquer coisa ter começado.
 */
export const TRANSICOES: Partial<Record<QuizBloco, string>> = {
  shows:
    'Vamos começar pelo que você faz: os shows e o público. São perguntas rápidas, e zero é '
    + 'resposta válida. Todo mundo começa em algum lugar.',
  digital:
    'Alguns dados das suas redes eu não consegui buscar automaticamente. Me conta você, com o '
    + 'número que aparece hoje no seu perfil. Se não tiver a rede, deixa em zero. Depois, '
    + 'conectando suas redes no Spotify for Artists, isso passa a vir sozinho.',
  reconhecimento:
    'Agora me conta o que o mercado já reconheceu no seu trabalho: mídia e prêmios. Não é prova, '
    + 'é mapa. Se ainda não aconteceu, é só onde a gente vai trabalhar.',
  // QE.0 (v4.5). O bloco da estrutura deixou de existir: o CNPJ e o empresário mudaram-se para
  // cá, porque são perguntas de dinheiro e a fala que os anunciava dizia isso mesmo ("é o assunto
  // do próximo bloco"). O texto novo é da Anita, e o que ele promete é o desvio: "onde você não
  // souber, eu te ajudo a calcular".
  numeros:
    'Agora vamos falar de dinheiro, e eu vou te acompanhar nisso. Não precisa de planilha nem de '
    + 'contabilidade: a gente só quer entender se a música está te pagando. Onde você não souber, '
    + 'eu te ajudo a calcular.',
  // QD.0 — só quem pediu ajuda vê.
  detalhe:
    'Combinado, vamos fazer essa conta juntos, uma parte de cada vez. Em cada pergunta, escolhe a '
    + 'faixa que parece mais perto. Não precisa ser exato: o que importa é a ordem de grandeza.',
};

/** QD.z — quem não fez show nenhum não responde sobre palco, e precisa de saber por quê. */
const QD_Z = 'Como você não fez shows no último ano, o palco fica de fora dessa conta. Vamos pro '
  + 'que a música rendeu fora dele.';

/** QD.9 — o fecho do detalhamento, antes de voltar às duas últimas do bloco. */
const QD_9 = 'Pronto, a conta está feita. Eu somo tudo por aqui e te mostro no diagnóstico o que '
  + 'entra, o que sai e o que sobra.';

/** Pula o cachê e o custo por show de quem não fez show nenhum nos últimos 12 meses. */
const semShows = (a: Record<string, any>): boolean => !(Number(a?.showsPerYear) > 0);

/**
 * O artista está no desvio do detalhamento (§3.2).
 *
 * ⚠️ A SEGUNDA METADE É O QUE FAZ O "VOLTAR" FUNCIONAR SEM LIMPAR NADA. Quem pediu ajuda, voltou
 * a QE.2 e escolheu uma faixa tem as duas coisas gravadas: o pedido e a faixa. Se o desvio olhasse
 * só o pedido, ele continuaria a responder as sete perguntas do detalhe que já não valem para
 * nada — o motor ignora o detalhamento inteiro quando há faixa de saldo. Com a faixa presente as
 * perguntas desaparecem sozinhas, sem ninguém ter de apagar o pedido.
 */
const detalhando = (a: Record<string, any>): boolean => !!a?._detalhar && a?.saldoFaixa == null;

/** As opções de uma escala de faixas: o índice é o valor, o rótulo é o que a pessoa lê. */
const opcoesDaFaixa = (tabela: readonly { rotulo: string }[]) =>
  tabela.map((f, i) => ({ label: f.rotulo, value: i as QuizValue }));

/** As colunas de uma tabela de faixas — a mesma escala, em forma de coluna. */
const colunasDaFaixa = (tabela: readonly { rotulo: string }[]): OpcaoDaTabela[] =>
  tabela.map((f, i) => ({ key: String(i), label: f.rotulo }));

/**
 * QD.2b — uma pergunta por fonte de receita, geradas da MESMA lista que o motor consome.
 *
 * ⚠️ NÃO É UMA TABELA, E A RAZÃO É DE PRODUTO: nove colunas de chips não cabem em 375px. Cada
 * fonte vira um `select`, que é o renderizador que já existe e é nativo no telemóvel. O custo é
 * mais nove ecrãs para quem optou por detalhar fonte a fonte, e quem optou por isso escolheu-o.
 *
 * As nove gravam na MESMA chave, cada uma na sua `sub`: é `outrasPorFonteFaixa` que a edge lê, e
 * a edge já está publicada.
 */
const PERGUNTAS_POR_FONTE: QuizDef[] = REVENUE_SOURCES.map((f) => ({
  key: 'outrasPorFonteFaixa' as QuizKey,
  sub: f.key,
  bloco: 'detalhe' as QuizBloco,
  type: 'select' as QuizFieldType,
  q: `Nos últimos 12 meses, quanto entrou ${f.label}`,
  options: [
    ...opcoesDaFaixa(FAIXAS_ANUAIS),
    // QD.ns — "não sei" é resposta, e o relatório devolve-a como gestão a fazer (§4).
    { label: 'Não sei essa', value: NAO_SEI },
  ],
  skipIf: (a: Record<string, any>) => !detalhando(a) || !a._fontes,
}));

export const QUIZ: QuizDef[] = [
  { key: 'vinculo', bloco: 'vinculo', type: 'select', q: 'Antes de começar: qual a sua relação com esse artista?', options: VINCULO_OPCOES },

  // ── Bloco 1 · Seus shows e seu público (A) ──
  //
  // ⚠️ O `showsPerYear` SAIU DAQUI NA v4.5. Ele é do E, e o bloco do dinheiro agora abre com ele:
  // os textos da Anita para o bloco E pressupõem-no ali ("Pra começar: quantos shows você fez"),
  // e o enunciado do cachê retoma o número na pergunta seguinte. Com o bloco partido, a retomada
  // atravessava três blocos e dezassete perguntas.
  { key: 'fazBilheteria', bloco: 'shows', type: 'select', q: 'Você faz shows de bilheteria em que seja a atração principal?', options: SIM_NAO },
  { key: 'pagantePct', bloco: 'shows', type: 'select', q: 'Em média, qual porcentagem do público dos seus shows de bilheteria é pagante?', skipIf: (a) => !a.fazBilheteria, options: [
    { label: 'Até 50%', value: 'ate50' },
    { label: 'De 51% a 69%', value: '51-69' },
    { label: 'De 70% a 94%', value: '70-94' },
    { label: 'De 95% a 100%', value: '95-100' },
  ] },

  // ── Bloco 2 · Sua presença digital (R) · só quando a API não trouxe o dado (§3.2) ──
  //
  // Zero aqui significa "não tenho essa rede" e é tratado como ausente pelo motor, não como zero
  // seguidores: um canal que não existe não pode puxar o alcance para baixo.
  //
  // O bloco fica DEPOIS dos shows, e não na abertura, porque para quem tem rede pequena informar
  // o número logo de cara também pesa.
  { key: 'igFollowersSelf', bloco: 'digital', type: 'int', q: 'Quantos seguidores você tem no Instagram hoje?', ajuda: 'Se não tiver Instagram, deixe em zero.', placeholder: '0', skipIf: jaVeioDaApi('igFollowers') },
  { key: 'tiktokFollowersSelf', bloco: 'digital', type: 'int', q: 'E no TikTok, quantos seguidores?', ajuda: 'Se não tiver TikTok, deixe em zero.', placeholder: '0', skipIf: jaVeioDaApi('tiktokFollowers') },
  { key: 'youtubeViews28dSelf', bloco: 'digital', type: 'int', q: 'Quantas visualizações seu canal do YouTube teve nos últimos 28 dias?', ajuda: 'Esse número aparece no YouTube Studio. Se não tiver canal, deixe em zero.', placeholder: '0', skipIf: jaVeioDaApi('youtubeMonthlyViews') },

  // ── Bloco 3 · Seu reconhecimento (L) ──
  { key: 'imprensaRepercussao', bloco: 'reconhecimento', type: 'select', q: 'Você já teve repercussão de mídia (imprensa, blogs, TV, influenciadores, podcasts) com seu trabalho musical?', options: SIM_NAO },
  {
    key: 'imprensaMatrix',
    bloco: 'reconhecimento',
    type: 'tabela',
    q: 'Para cada tipo de veículo, marque o maior porte em que seu trabalho já apareceu.',
    ajuda: 'Só o maior conta.',
    skipIf: (a) => !a.imprensaRepercussao,
    tabela: {
      linhas: IMPRENSA_TIPOS,
      colunas: IMPRENSA_PORTES,
      vazio: 'Nunca',
      // A forma gravada é a da v3, e continua a ser: um array de `{ tipo, porte }`, só com as
      // linhas marcadas. O motor e o saneador da edge leem isso há meses.
      saida: (m) => Object.entries(m)
        .filter(([, porte]) => !!porte)
        .map(([tipo, porte]) => ({ tipo, porte })),
      entrada: (g) => Object.fromEntries(
        (Array.isArray(g) ? g : [])
          .filter((c: unknown): c is { tipo: string; porte: string } => !!c && typeof c === 'object')
          .map((c) => [c.tipo, c.porte]),
      ),
    },
  },
  { key: 'imprensaFrequencia', bloco: 'reconhecimento', type: 'select', q: 'Com que frequência seu trabalho aparece na mídia?', skipIf: (a) => !a.imprensaRepercussao, options: [
    { label: 'Esporadicamente', value: 'esporadico' },
    { label: 'Nos períodos de lançamento', value: 'lancamento' },
    { label: 'Com frequência, de forma perene', value: 'perene' },
  ] },
  // "Ainda não participei de premiações" no lugar de "Nunca tive indicação nem prêmio": mesmo
  // valor (0), e a leitura deixa de ser um veredito sobre a carreira de quem está começando.
  { key: 'premios', bloco: 'reconhecimento', type: 'select', q: 'Qual é o maior reconhecimento em prêmios que seu trabalho já teve?', options: [
    { label: 'Ainda não participei de premiações', value: 0 },
    { label: 'Indicação a prêmio local ou regional', value: 1 },
    { label: 'Prêmio local ou regional', value: 2 },
    { label: 'Indicação a prêmio nacional', value: 3 },
    { label: 'Prêmio nacional', value: 4 },
    { label: 'Indicação a prêmio internacional', value: 5 },
    { label: 'Prêmio internacional', value: 6 },
  ] },

  // ══════════ Bloco 4 · Seus números (E) · o bloco do dinheiro, contíguo ══════════
  //
  // A v4.5 inverteu a pergunta. O que o índice precisa é o SALDO, e o artista raramente sabe as
  // partes — mas consegue estimar o todo, se lhe derem uma faixa. Então o núcleo são quatro
  // perguntas, e o detalhamento é um desvio opcional. Nada é digitado: tudo é faixa.
  //
  // O CNPJ e o empresário mudaram-se para cá com o bloco da estrutura, que deixou de existir. São
  // perguntas de dinheiro, e a fala que as anunciava já dizia isso.
  { key: 'showsPerYear', bloco: 'numeros', type: 'int', q: 'Pra começar: quantos shows você fez nos últimos 12 meses?', ajuda: 'Se não tiver certeza, estime. E lembre-se de que se você quer viver de música, esse é um número importante pra guardar.', placeholder: '0' },
  {
    key: 'saldoFaixa',
    bloco: 'numeros',
    type: 'select',
    q: 'Agora pensa no último ano inteiro. Tudo o que a música te pagou, menos tudo o que você gastou pra ela acontecer: banda, equipe, gravação, divulgação, contador, assessorias. Quanto sobrou pra você, por mês?',
    ajuda: 'Escolhe a faixa mais perto. Se essa conta não estiver clara na sua cabeça, eu te ajudo com algumas perguntas.',
    options: opcoesDaFaixa(FAIXAS_DE_SALDO),
    // QE.2b — o desvio. Grava o pedido e avança SEM responder, e é a ausência da resposta que o
    // motor lê como "somar as parcelas" (§3.2).
    escape: { rotulo: 'Me ajude a calcular', chave: '_detalhar' },
  },

  // ── O detalhamento (QD.1 a QD.5) · só para quem pediu ajuda ──
  //
  // O bloco inteiro desaparece quando há faixa de saldo, e é assim que o "Voltar" funciona sem
  // limpar nada: voltar a QE.2 e escolher uma faixa apaga estas sete perguntas sozinho.
  {
    key: 'cacheFaixa', bloco: 'detalhe', type: 'select',
    q: 'Primeiro, o que entra pelo palco. Quanto você costuma receber de cachê por show, em média?',
    options: opcoesDaFaixa(FAIXAS_POR_SHOW),
    skipIf: (a) => !detalhando(a) || semShows(a),
  },
  {
    key: '_cachePorTipo', bloco: 'detalhe', type: 'select',
    q: 'Em uma operação saudável, o cachê muda muito conforme quem contrata. Vamos separar por tipo de contratante?',
    options: [{ label: 'Vamos', value: true }, { label: 'Agora não', value: false }],
    skipIf: (a) => !detalhando(a) || semShows(a),
  },
  {
    key: 'cacheByTypeFaixa', bloco: 'detalhe', type: 'tabela',
    q: 'Quanto você costuma receber de cada tipo de contratante?',
    ajuda: 'Tipo que você não atende fica em branco.',
    skipIf: (a) => !detalhando(a) || semShows(a) || !a._cachePorTipo,
    tabela: {
      linhas: TIPOS_DE_CONTRATANTE_QUIZ,
      colunas: colunasDaFaixa(FAIXAS_POR_SHOW),
      // Sem coluna que limpa: a faixa "Nada" é a coluna 0, e é resposta legítima. O que fica em
      // branco é o tipo que ele não atende, e isso é a ausência de linha.
      expansivel: true,
    },
  },
  {
    key: 'outrasFaixa', bloco: 'detalhe', type: 'select',
    q: 'Agora o que entra fora do palco. Nos últimos 12 meses, quanto a música te rendeu com distribuidora, editora, associação, marcas, patrocínios e editais, aulas, produtos e financiamento coletivo, tudo somado?',
    options: opcoesDaFaixa(FAIXAS_ANUAIS),
    // QD.2b — o segundo desvio, e este é um convite discreto: "se quiser".
    escape: { rotulo: 'Se quiser, a gente separa fonte por fonte.', chave: '_fontes', comoLink: true },
    skipIf: (a) => !detalhando(a),
    // QD.z substitui a abertura do bloco para quem não fez show: sem palco, esta é a primeira
    // pergunta do detalhamento, e a ausência das duas anteriores precisa de explicação.
    transicaoSe: [{ quando: (a) => detalhando(a) && semShows(a), texto: QD_Z }],
  },
  ...PERGUNTAS_POR_FONTE,
  {
    key: 'custoShowFaixa', bloco: 'detalhe', type: 'select',
    q: 'Agora o que sai. Quanto custa, em média, produzir um show seu?',
    ajuda: 'Banda, equipe técnica, o que sai do seu bolso. O que o contratante paga, como transporte, hospedagem, alimentação e estrutura, não entra.',
    options: opcoesDaFaixa(FAIXAS_POR_SHOW),
    skipIf: (a) => !detalhando(a) || semShows(a),
  },
  {
    key: 'fixoFaixa', bloco: 'detalhe', type: 'select',
    q: 'E o que sai todo mês, mesmo quando não tem show: contador, assessoria de imprensa, gestão de redes, estúdio fixo. Quanto dá por mês?',
    ajuda: 'Comissão de empresário e impostos ficam de fora.',
    options: opcoesDaFaixa(FAIXAS_DE_FIXO),
    skipIf: (a) => !detalhando(a),
  },
  {
    key: 'lancFaixa', bloco: 'detalhe', type: 'select',
    q: 'Por último, o que você investiu em fazer música nova nos últimos 12 meses: gravação, clipes e campanhas de lançamento.',
    options: opcoesDaFaixa(FAIXAS_ANUAIS),
    skipIf: (a) => !detalhando(a),
  },

  // ── As duas últimas do bloco do dinheiro. Quem detalhou chega aqui pelo QD.9. ──
  {
    key: 'temCnpj', bloco: 'numeros', type: 'select',
    q: 'Duas últimas, rápidas. Você tem CNPJ para as suas atividades musicais?',
    options: SIM_NAO,
    transicaoSe: [{ quando: detalhando, texto: QD_9 }],
  },
  { key: 'temEmpresario', bloco: 'numeros', type: 'select', q: 'E você tem empresário ou empresária?', options: SIM_NAO },
];

/**
 * A transição que abre o bloco desta pergunta, quando há uma.
 *
 * Só sai na PRIMEIRA pergunta VISÍVEL do bloco — e "visível" é o que resolve o bloco digital:
 * se a API trouxe o Instagram mas não o TikTok, a transição aparece na pergunta do TikTok. Se
 * trouxe as três, nenhuma pergunta do bloco é visitada e a transição não existe.
 */
export const transicaoDoBloco = (indice: number, respostas: Record<string, any>): string | undefined => {
  const pergunta = QUIZ[indice];
  if (!pergunta) return undefined;

  // A fala do caminho vence a do bloco: é ela que explica por que ESTA pergunta está aqui, e a
  // do bloco já foi dita lá atrás (QD.9) ou não descreve o que a pessoa está a ver (QD.z).
  const doCaminho = pergunta.transicaoSe?.find((t) => t.quando(respostas));
  if (doCaminho) return doCaminho.texto;

  const texto = TRANSICOES[pergunta.bloco];
  if (!texto) return undefined;
  // ⚠️ O ARRAY INTEIRO, E NÃO ENQUANTO O BLOCO FOR O MESMO.
  //
  // O recuo contíguo bastava enquanto cada bloco era um trecho seguido do array. O bloco do
  // dinheiro deixou de o ser: o detalhamento parte-o ao meio, e o `temCnpj` do outro lado tem o
  // `lancFaixa` por vizinho. Com o recuo contíguo, o laço parava na primeira pergunta de outro
  // bloco e a transição QE.0 saía OUTRA VEZ, a meio do bloco, para quem detalhou.
  for (let i = 0; i < indice; i += 1) {
    if (QUIZ[i].bloco === pergunta.bloco && !QUIZ[i].skipIf?.(respostas)) return undefined;
  }
  return texto;
};

/**
 * Grava a resposta de uma pergunta.
 *
 * Mora aqui por causa da `sub`: as nove perguntas por fonte gravam todas em
 * `outrasPorFonteFaixa`, cada uma na sua chave, e as duas superfícies escreviam
 * `respostas[key] = valor` direto. Uma delas a esquecer a `sub` gravaria a última fonte por cima
 * de todas as outras, e o artista perderia oito respostas sem ver nada acontecer.
 */
export const gravarResposta = (
  respostas: Record<string, any>,
  pergunta: QuizDef,
  valor: unknown,
): void => {
  if (!pergunta.sub) { respostas[pergunta.key] = valor; return; }
  const atual = respostas[pergunta.key];
  respostas[pergunta.key] = {
    ...(atual && typeof atual === 'object' && !Array.isArray(atual) ? atual : {}),
    [pergunta.sub]: valor,
  };
};

/** O valor já gravado desta pergunta, respeitando a `sub`. */
export const respostaGravada = (respostas: Record<string, any>, pergunta: QuizDef): unknown => {
  const valor = respostas?.[pergunta.key];
  if (!pergunta.sub) return valor;
  return valor && typeof valor === 'object' ? valor[pergunta.sub] : undefined;
};

/**
 * Grava o desvio de um botão de escape, SEM responder a pergunta (§3.2).
 *
 * ⚠️ NÃO RESPONDER É O PONTO. Quem pede ajuda para calcular o saldo não responde QE.2, e é a
 * ausência dessa resposta que o motor lê como "somar as parcelas". Gravar um valor qualquer aqui
 * — zero, nulo explícito, uma faixa sentinela — mandava o artista pelo caminho direto com um
 * saldo que ele nunca informou.
 */
export const gravarEscape = (respostas: Record<string, any>, pergunta: QuizDef): void => {
  if (pergunta.escape) respostas[pergunta.escape.chave] = true;
};

/** O índice SEGUINTE, pulando as perguntas que não se aplicam às respostas dadas até aqui. */
export const proximaPergunta = (de: number, respostas: Record<string, unknown>): number => {
  let i = de;
  while (i < QUIZ.length && QUIZ[i].skipIf?.(respostas)) i += 1;
  return i;
};

/** O índice ANTERIOR, com a mesma regra — espelha `proximaPergunta`. */
export const perguntaAnterior = (de: number, respostas: Record<string, unknown>): number => {
  let i = de;
  while (i >= 0 && QUIZ[i].skipIf?.(respostas)) i -= 1;
  return i;
};

/** As três perguntas de autodeclaração de R, que só existem quando a API não entregou o campo. */
export const CHAVES_DO_BLOCO_R: QuizKey[] = ['igFollowersSelf', 'tiktokFollowersSelf', 'youtubeViews28dSelf'];

/**
 * O tamanho da trilha para a barra de progresso.
 *
 * Desconta APENAS o bloco R que a consulta prévia já respondeu, porque essa é a única condição
 * conhecida antes do quiz começar e portanto a única estável. As demais condicionais (pagante,
 * imprensa, alíquota, cachê e custo por show) dependem de respostas que ainda virão: incluí-las
 * faria o total mudar no meio do caminho e a barra recuar, que é exatamente o defeito que a
 * régua absoluta existe para evitar.
 */
export const naTrilha = (pergunta: QuizDef, respostas: Record<string, any>): boolean => {
  // ⚠️ O DETALHAMENTO SAI DO NUMERADOR **E** DO DENOMINADOR, e é por isso que a barra CONGELA
  // enquanto se detalha, em vez de recuar.
  //
  // Ele é um desvio que a pessoa escolhe a meio do quiz, e pode ter de 4 a 16 perguntas conforme
  // ela abra ou não o cachê por tipo e as nove fontes. Contá-lo no denominador fazia o total
  // saltar no instante em que ela tocasse "Me ajude a calcular", e a barra recuava — que é o
  // defeito que a régua absoluta existe para evitar. Congelar é honesto: o desvio não é progresso
  // na trilha principal, é trabalho a mais que ela pediu.
  if (pergunta.bloco === 'detalhe') return false;
  return !(CHAVES_DO_BLOCO_R.includes(pergunta.key) && pergunta.skipIf?.(respostas));
};

export const totalDaTrilha = (respostas: Record<string, any>): number =>
  QUIZ.filter((p) => naTrilha(p, respostas)).length;

/** Quantas perguntas da trilha já ficaram para trás, incluindo a atual. */
export const posicaoNaTrilha = (indice: number, respostas: Record<string, any>): number =>
  QUIZ.filter((p, i) => i <= indice && naTrilha(p, respostas)).length;

/**
 * Os passos que a tela mostra enquanto o motor roda.
 *
 * Não é enfeite: são os recursos que a edge de fato consulta, na ordem em que os consulta. Um
 * spinner mudo não diria que há uma busca no Spotify, um cruzamento com o quiz e um cálculo do
 * índice acontecendo — e a espera é de vários segundos.
 */
export const PASSOS_DA_ANALISE = [
  'Analisando seu perfil no Spotify',
  'Buscando sua presença nas redes sociais',
  'Medindo alcance e consumo de vídeo',
  'Cruzando os dados do seu quiz',
  'Calculando o saldo da sua carreira',
  'Mapeando sua presença na mídia',
  'Calculando seu Índice REAL',
  'Montando seu diagnóstico',
] as const;

/** As falas da Maestra no fluxo — as mesmas nas duas superfícies. */
export const FALAS = {
  primeiroPerfil:
    'Vamos criar um perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.',
  outroPerfil:
    'Bora criar outro perfil de artista. Qual a gente vai trabalhar? Busca no Spotify que eu já trago os dados.',
  semSpotify:
    'Sem problema nenhum, todo mundo começa em algum lugar. Vou montar seu diagnóstico com a sua '
    + 'realidade de hoje, e o Spotify a gente conecta depois. Como é o seu nome artístico?',
  escolhido: (nome: string) =>
    `Boa! Vamos criar o diagnóstico de ${nome}. Vou te fazer algumas perguntas rápidas pra `
    + 'entender a sua realidade de hoje.',
  // O fechamento do quiz (v4.2). Ele fecha o que a pessoa acabou de fazer ("o que você me
  // contou") e diz o que vem agora, em vez de anunciar só a espera. O nome do artista saiu:
  // depois de dezoito perguntas sobre ele, dizer de quem é o diagnóstico não acrescenta.
  analisando:
    'Pronto, é isso. Deixa eu cruzar o que você me contou com o que eu busquei nas plataformas e '
    + 'montar o seu diagnóstico.',
} as const;
