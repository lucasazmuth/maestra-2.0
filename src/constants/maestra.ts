import type {
  AccessLevel,
  Artist,
  CatalogStatus,
  EventStatus,
  EventType,
} from '../interfaces/maestra';

// Onboarding obrigatório: o wizard tem 9 etapas (índices 0–8). `content.step >= 9` marca a
// conclusão e libera o painel/módulos.
// v3 (metodologia Nyta) reescreve quase todas as etapas; planos de versões anteriores são
// arquivados em phaseHistory e refeitos no método novo (migração forçada). Por isso a conclusão
// passa a EXIGIR a versão atual: quem concluiu numa escala antiga reabre o wizard no método novo.
export const WIZARD_TOTAL_STEPS = 10;
// v5 = Metodologia v2 (geração determinística: objetivos/estratégias/priorização/plano de ação).
// O bump força a migração: planos das versões anteriores são arquivados em phaseHistory e refeitos.
export const WIZARD_VERSION = 5;
// Metodologia v2: cap de 5 objetivos (era 6), para manter foco (Nyta_Etapa_Objetivos_v2 §3).
export const MAX_OBJECTIVES = 5;

// Valor sentinela gravado em `ActionTask.owner` quando o responsável é o DONO DO PERFIL.
// Membros da equipe são gravados pelo e-mail (que sempre contém "@", então nunca colide).
// É o responsável padrão de toda tarefa nova (gerada pela Nyta ou criada à mão).
export const TASK_OWNER_SELF = 'owner';

// Perguntas de exemplo da Nyta (chips clicáveis) — compartilhadas pelo estado inicial do chat
// e pelo banner do Dashboard. Clicar abre/usa o chat já enviando a pergunta.
export const NYTA_SUGGESTIONS = [
  'Qual é o meu próximo passo no plano de ação?',
  'Qual deve ser o meu foco esta semana?',
  'Analise meu catálogo e me dê ideias',
  'Resuma minha agenda dos próximos dias',
];

// Desliga o paywall em desenvolvimento (REACT_APP_DISABLE_PAYWALL=true no .env).
// O banner de upsell continua visível; só os redirects/bloqueios são suprimidos.
export const PAYWALL_DISABLED = process.env.REACT_APP_DISABLE_PAYWALL === 'true';

// Habilita o Floating Modal da Nyta Assistente no lugar da página dedicada de chat.
export const FEATURE_NYTA_MODAL = process.env.REACT_APP_FEATURE_NYTA_MODAL === 'true';

export const isOnboardingComplete = (artist?: Artist | null): boolean => {
  const c = artist?.content;
  if (!c) return false;
  // Só está concluído quem terminou o wizard NA VERSÃO ATUAL. Versões anteriores são
  // reconduzidas pelo método novo (a migração arquiva o plano antigo e reinicia em step 0).
  if ((c.wizardVersion ?? 1) < WIZARD_VERSION) return false;
  return (c.step ?? 0) >= WIZARD_TOTAL_STEPS;
};

export const CATALOG_STATUS: Record<CatalogStatus, { label: string; color: string }> = {
  composition: { label: 'Composição', color: '#6b7280' },
  recording: { label: 'Gravação', color: '#e91429' },
  production: { label: 'Produção', color: '#f59e0b' },
  mixing: { label: 'Mixagem', color: '#3b82f6' },
  mastering: { label: 'Masterização', color: '#a855f7' },
  released: { label: 'Lançado', color: '#af2896' },
};

export const CATALOG_STATUS_OPTIONS = (Object.keys(CATALOG_STATUS) as CatalogStatus[]).map(
  (id) => ({ id, ...CATALOG_STATUS[id] })
);

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

export const SPLIT_ROLES = [
  'Autor',
  'Compositor',
  'Intérprete',
  'Produtor',
  'Músico',
  'Arranjador',
  'Editora',
  'Gravadora',
];

export const EVENT_TYPES: Record<EventType, { label: string; color: string }> = {
  release: { label: 'Lançamento', color: '#a855f7' },
  rehearsal: { label: 'Ensaio', color: '#f59e0b' },
  studio: { label: 'Estúdio', color: '#3b82f6' },
  meeting: { label: 'Reunião', color: '#af2896' },
  interview: { label: 'Entrevista', color: '#ec4899' },
  task: { label: 'Tarefa', color: '#16a34a' },
  other: { label: 'Outro', color: '#6b7280' },
};

export const EVENT_TYPE_OPTIONS = (Object.keys(EVENT_TYPES) as EventType[]).map((id) => ({
  id,
  ...EVENT_TYPES[id],
}));

export const EVENT_STATUS: Record<EventStatus, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: '#3b82f6' },
  completed: { label: 'Concluído', color: '#af2896' },
  cancelled: { label: 'Cancelado', color: '#e91429' },
};

export const ACCESS_LEVELS: Record<AccessLevel, string> = {
  plan: 'Plano de ação',
  team: 'Equipe',
  finance: 'Financeiro',
  catalog: 'Catálogo',
  agenda: 'Agenda',
  releases: 'Lançamentos',
  full: 'Acesso completo',
};

/** Níveis de acesso disponíveis no MVP (exclui Financeiro e Lançamentos, ainda não implementados) */
export const MVP_ACCESS_LEVELS: Pick<typeof ACCESS_LEVELS, 'plan' | 'team' | 'catalog' | 'agenda' | 'full'> = {
  plan: 'Plano de ação',
  team: 'Equipe',
  catalog: 'Catálogo',
  agenda: 'Agenda',
  full: 'Acesso completo',
};

export const MVP_ACCESS_LEVEL_OPTIONS = (Object.keys(MVP_ACCESS_LEVELS) as (keyof typeof MVP_ACCESS_LEVELS)[]).map((id) => ({
  id: id as AccessLevel,
  label: MVP_ACCESS_LEVELS[id],
}));

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
    focus: 'Montar bases: equipe, catálogo, processos e plano.',
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
