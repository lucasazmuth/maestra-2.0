import type {
  AccessLevel,
  Artist,
  CatalogStatus,
  EventStatus,
  EventType,
} from '../interfaces/maestra';
import { ENV } from '../nucleo/env';

// Onboarding obrigatório: o wizard tem 9 etapas (índices 0–8). `content.step >= 9` marca a
// conclusão e libera o painel/módulos.
// v3 (metodologia Nyta) reescreve quase todas as etapas; planos de versões anteriores são
// arquivados em phaseHistory e refeitos no método novo (migração forçada). Por isso a conclusão
// passa a EXIGIR a versão atual: quem concluiu numa escala antiga reabre o wizard no método novo.
// 9 etapas (Metodologia v2): a antiga etapa de Cronograma (início + datas) foi removida — as tarefas
// nascem na seleção do modal de prioridades (sem datas geradas por IA).
export const WIZARD_TOTAL_STEPS = 9;
// v5 = Metodologia v2 (geração determinística: objetivos/estratégias/priorização/plano de ação).
// O bump força a migração: planos das versões anteriores são arquivados em phaseHistory e refeitos.
export const WIZARD_VERSION = 5;
// Metodologia v2: cap de 5 objetivos (era 6), para manter foco (Nyta_Etapa_Objetivos_v2 §3).
export const MAX_OBJECTIVES = 5;

// Valor sentinela gravado em `ActionTask.owner` quando o responsável é o DONO DO PERFIL.
// Membros da equipe são gravados pelo e-mail (que sempre contém "@", então nunca colide).
// É o responsável padrão de toda tarefa nova (gerada pela Nyta ou criada à mão).
// Categorias de tarefa do Plano de Ação.
//
// Viveu em `src/pages/ActionPlan/TaskControls.tsx` enquanto só a web usava. Subiu pro núcleo
// quando o app nativo passou a precisar do MESMO rótulo no hero da home — e, de quebra, o
// `wizardAi` para de manter uma segunda lista de valores, que já estava uma categoria atrás.
//
// 'acoes' é o valor de FALLBACK quando a tarefa não tem categoria definida. "Ações" como rótulo
// lia como se fosse uma categoria deliberada — a maioria das tarefas cai aqui só por nunca ter
// sido categorizada. "Categoria" lê como os outros chips sem valor (`Sem prazo`, `Dono do
// perfil`): um placeholder honesto, não uma escolha.
export const TASK_TYPES: { v: string; label: string }[] = [
  { v: 'acoes', label: 'Categoria' },
  { v: 'produto_fonografico', label: 'Produto fonográfico' },
  { v: 'audio_visual', label: 'Audiovisual' },
  { v: 'design', label: 'Design' },
  { v: 'fotos', label: 'Fotos' },
  { v: 'figurino', label: 'Figurino' },
  { v: 'site', label: 'Site' },
  { v: 'textos', label: 'Textos' },
  { v: 'assessoria', label: 'Assessoria' },
  { v: 'marketing_digital', label: 'Marketing digital' },
  { v: 'media_kit', label: 'Media kit' },
  { v: 'radio', label: 'Rádio' },
  { v: 'show', label: 'Show' },
];

/** Só os valores — é o que a validação da resposta da IA precisa. */
export const TASK_TYPE_VALUES = TASK_TYPES.map((t) => t.v);

export const TASK_OWNER_SELF = 'owner';

// Perguntas de exemplo da Nyta (chips clicáveis) — compartilhadas pelo estado inicial do chat
// e pelo banner do Dashboard. Clicar abre/usa o chat já enviando a pergunta.
export const NYTA_SUGGESTIONS = [
  'Qual é o meu próximo passo no plano de ação?',
  'Qual deve ser o meu foco esta semana?',
  'Analise minhas músicas e me dê ideias',
  'Resuma minha agenda dos próximos dias',
];

// Desliga o paywall em desenvolvimento (REACT_APP_DISABLE_PAYWALL=true no .env).
// O banner de upsell continua visível; só os redirects/bloqueios são suprimidos.
export const PAYWALL_DISABLED = ENV.paywallDesligado;

// Habilita o Floating Modal da Nyta Assistente no lugar da página dedicada de chat.
export const FEATURE_NYTA_MODAL = ENV.nytaModal;

export const isOnboardingComplete = (artist?: Artist | null): boolean => {
  const c = artist?.content;
  if (!c) return false;
  // Só está concluído quem terminou o wizard NA VERSÃO ATUAL. Versões anteriores são
  // reconduzidas pelo método novo (a migração arquiva o plano antigo e reinicia em step 0).
  if ((c.wizardVersion ?? 1) < WIZARD_VERSION) return false;
  return (c.step ?? 0) >= WIZARD_TOTAL_STEPS;
};

// Para onde abrir um perfil, na ordem em que os bloqueios importam: cobrança em aberto trava
// tudo; sem planejamento concluído, o destino é o wizard — o dashboard só faz sentido depois
// que existe um plano pra ele mostrar.
//
// Mora aqui porque tem mais de uma porta de entrada pro perfil (a lista de artistas e a pilha
// de avatares do rail); com a regra copiada em cada uma, elas divergem na primeira mudança.
export const artistEntryRoute = (artist: Artist): string => {
  if (artist.role !== 'member' && artist.is_locked) return `/artists/${artist.id}/desbloquear`;
  if (!isOnboardingComplete(artist)) return `/artists/${artist.id}/wizard`;
  return `/artists/${artist.id}`;
};

export const CATALOG_STATUS: Record<CatalogStatus, { label: string; color: string }> = {
  composition: { label: 'Composição', color: '#6b7280' },
  recording: { label: 'Gravação', color: '#e91429' },
  production: { label: 'Produção', color: '#f59e0b' },
  mixing: { label: 'Mixagem', color: '#3b82f6' },
  mastering: { label: 'Masterização', color: '#a855f7' },
  released: { label: 'Lançado', color: '#9A4FD1' },
};

// "Produção" saiu da lista escolhível, mas continua em CATALOG_STATUS: músicas gravadas antes
// dessa mudança ainda têm esse status, e sem o rótulo elas mostrariam a chave crua na tela.
const HIDDEN_CATALOG_STATUSES: readonly CatalogStatus[] = ['production'];

export const CATALOG_STATUS_OPTIONS = (Object.keys(CATALOG_STATUS) as CatalogStatus[])
  .filter((id) => !HIDDEN_CATALOG_STATUSES.includes(id))
  .map((id) => ({ id, ...CATALOG_STATUS[id] }));

/**
 * Statuses considerados "ativos" para fins de contagem do limite de catálogo.
 * Faixas com qualquer um destes statuses contam contra o limite de 10 faixas (plano free).
 * Se um status "archived" ou "cancelled" for adicionado no futuro, ele NÃO deve estar aqui.
 */
export const ACTIVE_CATALOG_STATUSES: readonly CatalogStatus[] = [
  'composition',
  'recording',
  'production',
  'mixing',
  'mastering',
  'released',
] as const;

/** Retorna true se o status da faixa é considerado "ativo" para fins de limite de catálogo. */
export const isActiveCatalogStatus = (status: string): boolean =>
  (ACTIVE_CATALOG_STATUSES as readonly string[]).includes(status);

// ─── As pistas (stems) de uma gravação ──────────────────────────────────────

/**
 * O teto de pistas por gravação.
 *
 * É memória, não gosto: um stem de 4 minutos ocupa ~85 MB de PCM estéreo (~42 em mono) quando
 * descodificado para tocar. Oito estéreo passam dos 600 MB, que é onde um iPhone antigo começa
 * a ser morto pelo sistema.
 */
/**
 * Quantas pistas cabem numa gravação.
 *
 * Eram 8, e 8 é pouco: um projeto de stems tem dez, doze, às vezes vinte faixas — bateria
 * aberta em bombo, caixa, pratos e ambiências já gasta quatro. O teto existe pela memória (ver
 * `MEMORIA_DE_AVISO_BYTES`), e no computador há folga para isto; quem passar do aviso de peso
 * é avisado antes de descodificar.
 */
export const MAXIMO_DE_PISTAS = 24;

/**
 * O tamanho máximo de uma pista.
 *
 * 60 MB cabe um WAV 16-bit de 4 minutos com folga. O balde `catalog` aceita até 100 MB, então
 * este número é o nosso, e não o dele — um WAV 24-bit de 5 minutos passaria no balde e daria
 * 130 MB de PCM na memória por pista.
 */
export const LIMITE_DA_PISTA_BYTES = 60 * 1024 * 1024;

/**
 * A partir de quanto áudio a mesa avisa que pode ser demais.
 *
 * A conta: um WAV 16-bit estéreo gasta 4 bytes por quadro, e o PCM que a mesa guarda no
 * telemóvel (mono, vírgula flutuante) gasta os MESMOS 4 bytes por quadro. Por isso o tamanho do
 * ficheiro serve de estimativa direta da memória — para WAV. Para MP3 ele subestima por dez, e
 * o aviso é o que há: o número exato só se sabe depois de descodificar, que é tarde demais.
 *
 * 400 MB é onde um iPhone antigo começa a matar aplicações.
 */
export const MEMORIA_DE_AVISO_BYTES = 400 * 1024 * 1024;

/** Sugestões para o nome da pista. São ATALHOS, não uma lista fechada: o campo é livre. */
export const PAPEIS_SUGERIDOS_DA_PISTA = [
  'Voz', 'Guia', 'Bateria', 'Baixo', 'Guitarra', 'Teclas', 'Outros',
] as const;

/**
 * O que se diz a quem carregou em gravar sem ter escolhido onde.
 *
 * ⚠️ NUMA MESA, O REC GLOBAL SÓ SABE O QUE FAZER SE ALGUMA FAIXA ESTIVER ARMADA. Armar o
 * transporte sem dizer em que faixa é meia intenção, e gravar por cima do que a pessoa não
 * escolheu é o tipo de engano que não se desfaz.
 *
 * ⚠️ O TEXTO APONTA PARA O BOTÃO, e não para o verbo. "Arme a faixa" pede um gesto que não está
 * escrito em lado nenhum da tela — ninguém procura "armar", procura onde carregar. O que a
 * pessoa vê é um círculo vermelho na linha da faixa, e é por aí que a frase começa.
 *
 * As palavras moram aqui porque as duas telas as escrevem, e elas já tinham divergido: a web
 * dizia "no botão vermelho dela" e o aplicativo "toque no círculo vermelho da faixa".
 */
export const AVISO_DE_ARMAR = {
  /** Só o aplicativo o mostra: o aviso dele é um `Alert`, que pede título. */
  titulo: 'Falta escolher a faixa',
  texto: 'Selecione o botão vermelho na faixa em que quer gravar.',
};

// As CLASSES de titular, no vocabulário das associações autorais.
//
// ⚠️ São duas listas, e não uma, porque são dois direitos diferentes: a OBRA é o que foi
// composto (letra e melodia), o FONOGRAMA é a gravação daquela obra. Um intérprete não tem
// classe na obra; um compositor não tem classe no fonograma. Uma lista só faz aparecer
// "Produtor fonográfico" no lugar onde se declara quem escreveu a canção — que é como se
// preenche errado um cadastro que depois paga (ou não paga) direitos a alguém.
//
// Os nomes saem do que o ECAD e a UBC praticam nos formulários deles.

/** Quem tem direito sobre a OBRA: quem a escreveu, e quem a edita. */
export const CLASSES_DA_OBRA = [
  'Compositor/Autor',
  'Versionista',
  'Adaptador',
  'Arranjador',
  'Editora',
  'Subeditora',
];

/** Quem tem direito sobre o FONOGRAMA: quem gravou, quem tocou, quem produziu. */
export const CLASSES_DO_FONOGRAMA = [
  'Intérprete',
  'Produtor fonográfico',
  'Músico acompanhante',
  'Músico',
  'Gravadora',
];

/**
 * As duas listas juntas.
 *
 * Fica para quem ainda não sabe separar os dois direitos — hoje, a ficha do app. Onde a
 * distinção existe (a ficha da web), usam-se as listas específicas.
 */
export const SPLIT_ROLES = [...CLASSES_DA_OBRA, ...CLASSES_DO_FONOGRAMA];

export const EVENT_TYPES: Record<EventType, { label: string; color: string }> = {
  release: { label: 'Lançamento', color: '#a855f7' },
  rehearsal: { label: 'Ensaio', color: '#f59e0b' },
  studio: { label: 'Estúdio', color: '#3b82f6' },
  meeting: { label: 'Reunião', color: '#9A4FD1' },
  interview: { label: 'Entrevista', color: '#ec4899' },
  // Roxo mais profundo para diferenciar tarefas dos compromissos,
  // mantendo a leitura dentro da paleta visual da Maestra.
  task: { label: 'Tarefa', color: '#8B5CF6' },
  other: { label: 'Outro', color: '#6b7280' },
};

export const EVENT_TYPE_OPTIONS = (Object.keys(EVENT_TYPES) as EventType[]).map((id) => ({
  id,
  ...EVENT_TYPES[id],
}));

export const EVENT_STATUS: Record<EventStatus, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: '#3b82f6' },
  completed: { label: 'Concluído', color: '#9A4FD1' },
  cancelled: { label: 'Cancelado', color: '#e91429' },
};

export const ACCESS_LEVELS: Record<AccessLevel, string> = {
  plan: 'Plano de ação',
  team: 'Equipe',
  finance: 'Financeiro',
  catalog: 'Músicas',
  agenda: 'Agenda',
  releases: 'Lançamentos',
  full: 'Acesso completo',
};

/** Níveis de acesso disponíveis no MVP (exclui Financeiro e Lançamentos, ainda não implementados) */
export const MVP_ACCESS_LEVELS: Pick<typeof ACCESS_LEVELS, 'plan' | 'team' | 'catalog' | 'agenda' | 'full'> = {
  plan: 'Plano de ação',
  team: 'Equipe',
  catalog: 'Músicas',
  agenda: 'Agenda',
  full: 'Acesso completo',
};

export const MVP_ACCESS_LEVEL_OPTIONS = (Object.keys(MVP_ACCESS_LEVELS) as (keyof typeof MVP_ACCESS_LEVELS)[]).map((id) => ({
  id: id as AccessLevel,
  label: MVP_ACCESS_LEVELS[id],
}));

/**
 * O que cada módulo abre, em uma linha.
 *
 * "Equipe" ou "Plano de ação" sozinhos não dizem se a pessoa só vê ou também mexe — e quem
 * convida está decidindo justamente isso. O texto é o mesmo nas duas superfícies: uma frase
 * diferente no celular seria uma promessa diferente sobre o mesmo acesso.
 */
export const ACCESS_LEVEL_HINTS: Partial<Record<AccessLevel, string>> = {
  plan: 'Ver e editar tarefas e prazos',
  catalog: 'Músicas, versões e Espaço JAM',
  agenda: 'Compromissos e datas',
  team: 'Convidar e remover pessoas',
  full: 'Todos os módulos, inclusive os que entrarem depois',
};

export const ACCESS_LEVEL_OPTIONS = (Object.keys(ACCESS_LEVELS) as AccessLevel[]).map((id) => ({
  id,
  label: ACCESS_LEVELS[id],
}));

export interface CareerPhase {
  label: string;
  focus: string;
  antiFocus: string;
}

export const CAREER_PHASES: Record<number, CareerPhase> = {
  1: {
    label: 'Diagnóstico',
    focus: 'Entender o cenário, dados e identidade do artista.',
    antiFocus: 'Evite executar ações antes de mapear o contexto.',
  },
  2: {
    label: 'Estruturação',
    focus: 'Montar bases: equipe, músicas, processos e plano.',
    antiFocus: 'Evite escalar antes de ter estrutura mínima.',
  },
  3: {
    label: 'Execução',
    focus: 'Colocar o plano em prática: lançamentos e ações.',
    antiFocus: 'Evite dispersar o foco em muitas frentes.',
  },
  4: {
    label: 'Otimização',
    focus: 'Refinar o que funciona com base em métricas.',
    antiFocus: 'Evite mudar tudo; otimize o que já tem tração.',
  },
  5: {
    label: 'Expansão',
    focus: 'Ampliar alcance, mercados e receitas.',
    antiFocus: 'Evite perder a essência ao crescer.',
  },
};

// As fases são infinitas. Para `phase > 5` o foco/anti-foco ciclam pelos 5 arquétipos
// (o rótulo em si vem do `content.phaseLabel` gerado por IA ao avançar de fase).
export const getPhaseInfo = (phase: number): CareerPhase => {
  const idx = ((Math.max(1, phase) - 1) % 5) + 1;
  return CAREER_PHASES[idx];
};

export const formatMs = (ms?: number): string => {
  if (!ms) return '--:--';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Etapas herdadas das versões (guia, mix, master…). O modal da versão não pede mais a etapa —
// o título livre descreve melhor a gravação —, mas as versões antigas foram criadas sem título
// e o rótulo da etapa é o nome que elas têm. Compartilhado pelo Espaço Jam e pela ficha da
// música, senão a mesma versão aparece como "Guia" num lugar e "Versão 1" no outro.
export const CATALOG_VERSION_STAGES: { value: string; label: string }[] = [
  { value: 'guia', label: 'Guia' }, { value: 'beat', label: 'Beat' }, { value: 'instrumental', label: 'Instrumental' },
  { value: 'voz', label: 'Voz' }, { value: 'stems', label: 'Stems' }, { value: 'mix', label: 'Mixagem' },
  { value: 'master', label: 'Masterização' }, { value: 'referencia', label: 'Referência' },
];

export const getVersionStageLabel = (stage?: string | null): string =>
  CATALOG_VERSION_STAGES.find((item) => item.value === stage)?.label || stage || '';
