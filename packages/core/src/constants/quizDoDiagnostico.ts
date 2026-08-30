import type { ImprensaTipo, ImprensaPorte } from '../services/realEngine';

// O ROTEIRO do Diagnóstico REAL v3 — o questionário inteiro, sem uma linha de interface.
//
// Subiu de `src/pages/ArtistCreate` para o núcleo quando o app nativo ganhou a criação de perfil.
// As chaves casam com os campos de `RealInputsV3` que o motor consome e que a edge
// `artist-diagnostic` mapeia em `buildRealInputsV3`: um roteiro por superfície significaria dois
// diagnósticos que o mesmo servidor lê de maneiras diferentes — e o erro apareceria como uma
// nota errada, não como uma tela quebrada.
//
// A ORDEM também é conteúdo: `vinculo` é a primeira de propósito (enquadra o resto e é
// registrada com IP e a versão dos Termos vigente), e os `skipIf` desenham o caminho real de
// quem não faz show ou não teve imprensa.

// Roteiro do Diagnóstico REAL v3 (autorrelato). As chaves casam com os campos de RealInputsV3
// consumidos pelo motor (src/services/realEngine) e mapeados no edge (buildRealInputsV3).
export type QuizValue = string | number | boolean;
export type QuizFieldType = 'int' | 'currency' | 'select' | 'revenue' | 'matrix';
export type QuizKey =
  | 'vinculo'
  | 'showsPerMonth' | 'cache' | 'revenueSources' | 'investimento'
  | 'temCnpj' | 'temEmpresario' | 'premios'
  | 'imprensaRepercussao' | 'imprensaMatrix' | 'imprensaFrequencia'
  | 'fazBilheteria' | 'pagantePct';
export interface QuizDef {
  key: QuizKey;
  q: string;
  type: QuizFieldType;
  placeholder?: string;
  options?: { label: string; value: QuizValue }[];
  // Pula a pergunta quando a condição é verdadeira (ex.: cachê só se faz shows).
  skipIf?: (a: Record<string, any>) => boolean;
}

// Fontes da composição de receita fora-shows (§5.4) — a soma alimenta o E; as partes, a pizza.
export const REVENUE_SOURCES: { key: string; label: string }[] = [
  { key: 'streaming', label: 'Streaming (Spotify, Deezer, YouTube…)' },
  { key: 'direitos', label: 'Direitos (autorais, conexos, fonográficos)' },
  { key: 'publi', label: 'Publicidade e patrocínio' },
  { key: 'aulas', label: 'Aulas e cursos' },
  { key: 'editais', label: 'Editais e prêmios em dinheiro' },
  { key: 'venda', label: 'Venda de produtos e merch' },
  { key: 'outros', label: 'Outras fontes musicais' },
];

// Matriz de imprensa (§7.3) — tipo de veículo × porte. O usuário marca onde já apareceu.
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

// Receita do E = (shows × cachê) + soma das fontes fora shows. Estrutura (CNPJ/empresário) modula.
export const QUIZ: QuizDef[] = [
  { key: 'vinculo', type: 'select', q: 'Antes de começar: qual a sua relação com esse artista?', options: VINCULO_OPCOES },
  { key: 'showsPerMonth', type: 'int', q: 'Quantos shows você costuma fazer por mês?', placeholder: 'Ex: 4' },
  { key: 'cache', type: 'currency', q: 'Qual o seu cachê médio por show?', placeholder: '0', skipIf: (a) => Number(a.showsPerMonth) <= 0 },
  { key: 'revenueSources', type: 'revenue', q: 'Fora os shows, quanto você fatura por mês com música em cada fonte? (pode deixar em zero o que não se aplica)' },
  { key: 'investimento', type: 'currency', q: 'Nos últimos 12 meses, quanto você investiu na sua carreira?', placeholder: '0' },
  { key: 'temCnpj', type: 'select', q: 'Você tem CNPJ para suas atividades musicais?', options: SIM_NAO },
  { key: 'temEmpresario', type: 'select', q: 'Você tem empresário/a?', options: SIM_NAO },
  { key: 'premios', type: 'select', q: 'Qual o maior reconhecimento em premiações que você já teve?', options: [
    { label: 'Nunca fui indicada nem premiada', value: 0 },
    { label: 'Indicação a prêmio local/regional', value: 1 },
    { label: 'Ganhei prêmio local/regional', value: 2 },
    { label: 'Indicação a prêmio nacional', value: 3 },
    { label: 'Ganhei prêmio nacional', value: 4 },
    { label: 'Indicação a prêmio internacional', value: 5 },
    { label: 'Ganhei prêmio internacional', value: 6 },
  ] },
  { key: 'imprensaRepercussao', type: 'select', q: 'Você já teve repercussão de mídia (imprensa, blogs, TV, influenciadores, podcasts) com seu trabalho musical?', options: SIM_NAO },
  { key: 'imprensaMatrix', type: 'matrix', q: 'Onde seu trabalho já apareceu? Marque os tipos e portes de veículo.', skipIf: (a) => !a.imprensaRepercussao },
  { key: 'imprensaFrequencia', type: 'select', q: 'Com que frequência seu trabalho aparece na mídia?', skipIf: (a) => !a.imprensaRepercussao, options: [
    { label: 'Esporadicamente', value: 'esporadico' },
    { label: 'Nos períodos de lançamento', value: 'lancamento' },
    { label: 'Com frequência, de forma perene', value: 'perene' },
  ] },
  { key: 'fazBilheteria', type: 'select', q: 'Você faz shows de bilheteria em que seja a atração principal?', options: SIM_NAO },
  { key: 'pagantePct', type: 'select', q: 'Em média, qual % do público dos seus shows é pagante?', skipIf: (a) => !a.fazBilheteria, options: [
    { label: 'Até 50%', value: 'ate50' },
    { label: '51% a 69%', value: '51-69' },
    { label: '70% a 94%', value: '70-94' },
    { label: '95% a 100%', value: '95-100' },
  ] },
];

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
  'Medindo alcance e engajamento',
  'Cruzando os dados do seu quiz',
  'Avaliando sua saúde financeira',
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
  analisando: (nome: string) => `Deixa eu cruzar esses dados e montar um diagnóstico de ${nome}…`,
} as const;
