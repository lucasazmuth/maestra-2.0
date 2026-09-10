import type { ImprensaTipo, ImprensaPorte, TipoDeContratante, FonteDeReceita } from '../services/realEngine';
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
export type QuizFieldType = 'int' | 'currency' | 'select' | 'revenue' | 'cache' | 'matrix';
export type QuizKey =
  | 'vinculo'
  | 'igFollowersSelf' | 'tiktokFollowersSelf' | 'youtubeViews28dSelf'
  | 'showsPerYear' | 'cacheByType' | 'revenueSources'
  | 'custoPorShow' | 'custoFixoMensal' | 'investLancamentos12m'
  | 'temCnpj' | 'aliquota' | 'temEmpresario'
  | 'fazBilheteria' | 'pagantePct'
  | 'premios' | 'imprensaRepercussao' | 'imprensaMatrix' | 'imprensaFrequencia';

/**
 * O bloco a que a pergunta pertence (v4.2, §2).
 *
 * Existe para a TRANSIÇÃO: ela é do bloco, e não da pergunta. Amarrá-la à primeira pergunta de
 * cada bloco quebraria no bloco digital, onde a primeira pergunta é justamente a que mais some
 * (quem tem Instagram encontrado pela API pula ela e cai na do TikTok).
 */
export type QuizBloco = 'vinculo' | 'shows' | 'digital' | 'reconhecimento' | 'estrutura' | 'numeros';

export interface QuizDef {
  key: QuizKey;
  bloco: QuizBloco;
  q: string;
  type: QuizFieldType;
  /** Linha de apoio abaixo da pergunta, quando ela precisa de instrução (ex.: onde achar o número). */
  ajuda?: string;
  placeholder?: string;
  options?: { label: string; value: QuizValue }[];
  /** Pula a pergunta quando a condição é verdadeira (ex.: alíquota só para quem tem CNPJ). */
  skipIf?: (a: Record<string, any>) => boolean;
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
/** A opção que zera a linha na matriz de imprensa. Fica antes dos portes. */
export const IMPRENSA_NUNCA = 'nunca';

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
  estrutura:
    'Duas perguntas rápidas sobre a estrutura por trás do artista. Elas ajudam a entender como o '
    + 'seu dinheiro circula, e é o assunto do próximo bloco.',
  numeros:
    'Agora a parte que ninguém gosta de responder, e que é exatamente a que mais muda o '
    + 'diagnóstico: dinheiro. Ninguém vê esses números além de você. Estimativa vale, não precisa '
    + 'ser exato. Se não souber alguma coisa, marca "não sei" ou deixa em zero e segue.',
};

/** Pula o cachê e o custo por show de quem não fez show nenhum nos últimos 12 meses. */
const semShows = (a: Record<string, any>): boolean => !(Number(a?.showsPerYear) > 0);

export const QUIZ: QuizDef[] = [
  { key: 'vinculo', bloco: 'vinculo', type: 'select', q: 'Antes de começar: qual a sua relação com esse artista?', options: VINCULO_OPCOES },

  // ── Bloco 1 · Seus shows e seu público (A + a contagem de shows) ──
  //
  // `showsPerYear` é do E, e mesmo assim abre o quiz: é contagem de ATIVIDADE, não dinheiro, e
  // continua alimentando o E igual. Abrir por aqui evita que a primeira resposta substantiva de
  // quem está começando seja um "não".
  { key: 'showsPerYear', bloco: 'shows', type: 'int', q: 'Quantos shows você fez nos últimos 12 meses, no total?', placeholder: '0' },
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
  { key: 'imprensaMatrix', bloco: 'reconhecimento', type: 'matrix', q: 'Para cada tipo de veículo, marque o maior porte em que seu trabalho já apareceu.', ajuda: 'Só o maior conta.', skipIf: (a) => !a.imprensaRepercussao },
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

  // ── Bloco 4 · Sua estrutura ──
  { key: 'temCnpj', bloco: 'estrutura', type: 'select', q: 'Você tem CNPJ para as suas atividades musicais?', options: SIM_NAO },
  { key: 'aliquota', bloco: 'estrutura', type: 'select', q: 'Qual é a alíquota atual de impostos do seu CNPJ?', ajuda: 'Isso não entra no cálculo do diagnóstico. Serve para estimar a sua receita líquida no relatório.', skipIf: (a) => !a.temCnpj, options: [
    { label: 'Até 6%', value: 'ate6' },
    { label: 'De 6% a 10%', value: '6-10' },
    { label: 'De 10% a 15%', value: '10-15' },
    { label: 'Acima de 15%', value: 'acima15' },
    { label: 'Não sei', value: 'nao_sei' },
  ] },
  { key: 'temEmpresario', bloco: 'estrutura', type: 'select', q: 'Você tem empresário ou empresária?', options: SIM_NAO },

  // ── Bloco 5 · Seus números (E) · por último ──
  //
  // A primeira pergunta retoma o número de shows que a pessoa deu no bloco 1. É o que faz o
  // pedido de cachê parecer continuação de uma conversa, e não interrogatório.
  //
  // O "se não souber com precisão, coloque sua melhor estimativa" saiu dos três `ajuda`: a
  // transição do bloco já diz isso uma vez, e repetir a ressalva a cada campo transformava a
  // instrução em ruído.
  { key: 'cacheByType', bloco: 'numeros', type: 'cache', q: 'Você me disse que fez {showsPerYear} no último ano. Agora, o cachê médio por tipo de contratante.', ajuda: 'Preencha os tipos que você atendeu e deixe em zero os que não se aplicam.', skipIf: semShows },
  { key: 'revenueSources', bloco: 'numeros', type: 'revenue', q: 'Fora os shows, quanto a música te rendeu nos últimos 12 meses em cada fonte?', ajuda: 'Se não souber alguma, marque "não sei".' },
  // O investimento decomposto (v4.1, §3.2). Antes era uma pergunta só, e a resposta não permitia
  // dizer nada: com o custo POR SHOW separado do fixo mensal e do que foi para lançamento, saem a
  // margem por show e o ponto de equilíbrio, que são as contas que decidem cachê.
  //
  // Os três textos delimitam o que NÃO entra, porque é aí que o artista erra: o que o contratante
  // paga não é custo dele, e comissão de empresário e imposto não entram no fixo.
  { key: 'custoPorShow', bloco: 'numeros', type: 'currency', q: 'Quanto custa, em média, produzir um show seu?', ajuda: 'Conte banda, equipe técnica e o que sai do seu bolso. Não conte o que o contratante paga, como transporte, hospedagem, alimentação e estrutura.', placeholder: '0', skipIf: semShows },
  { key: 'custoFixoMensal', bloco: 'numeros', type: 'currency', q: 'Quanto você gasta por mês com a carreira, mesmo nos meses sem show?', ajuda: 'Contador, assessoria de imprensa, gestão de redes, estúdio fixo, o que for recorrente. Não inclua comissão de empresário nem impostos.', placeholder: '0' },
  { key: 'investLancamentos12m', bloco: 'numeros', type: 'currency', q: 'Nos últimos 12 meses, quanto você investiu em gravação de músicas, clipes e campanhas de lançamento?', ajuda: 'Inclua assessoria e mídia paga dos lançamentos.', placeholder: '0' },
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
  const texto = pergunta && TRANSICOES[pergunta.bloco];
  if (!texto) return undefined;
  for (let i = indice - 1; i >= 0 && QUIZ[i].bloco === pergunta.bloco; i -= 1) {
    if (!QUIZ[i].skipIf?.(respostas)) return undefined;
  }
  return texto;
};

/**
 * O enunciado como a pessoa lê, com o que for interpolado já no lugar.
 *
 * Hoje é só `{showsPerYear}` no cachê. O marcador carrega o substantivo junto do número porque a
 * concordância é parte da interpolação: "fez 1 show" e "fez 12 shows" não saem do mesmo molde.
 */
export const enunciado = (pergunta: QuizDef, respostas: Record<string, any>): string => {
  if (!pergunta.q.includes('{showsPerYear}')) return pergunta.q;
  const shows = Math.max(0, Math.trunc(Number(respostas?.showsPerYear) || 0));
  return pergunta.q.replace('{showsPerYear}', shows === 1 ? '1 show' : `${shows} shows`);
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
export const totalDaTrilha = (respostas: Record<string, any>): number =>
  QUIZ.filter((p) => !(CHAVES_DO_BLOCO_R.includes(p.key) && p.skipIf?.(respostas))).length;

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
