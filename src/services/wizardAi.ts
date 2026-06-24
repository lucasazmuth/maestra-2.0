import { supabase } from '../lib/supabase';
import { TASK_OWNER_SELF } from '../constants/maestra';
import type {
  ArtistIdentity,
  MissionParts,
  QuizQuestion,
  RecognitionTag,
  StrategyCategory,
  SwotAnalysis,
  Strategy,
  StrategyType,
  SpotifyProfile,
  VisionParts,
} from '../interfaces/maestra';

const STRATEGY_CATEGORIES: StrategyCategory[] = [
  'lancamentos',
  'digital',
  'branding',
  'show',
  'juridico',
  'equipe',
  'comercial',
  'captacao',
  'network',
  'imprensa',
  'merchan',
];

// Serviço de IA para o Wizard estratégico.
// Todas as chamadas passam pela Edge Function "wizard-ai" que usa Groq/Llama 3.3 70B.
// Custo: ~$0 (free tier Groq). Sem exposição de API key no frontend.

const uid = () => Math.random().toString(36).slice(2, 10);

// Contexto de plataforma do artista (Chartmetric resumo+profundo, quiz de criação,
// diagnóstico-base) — salvo no artist.content. Definido UMA vez pelo Wizard ao carregar
// o artista e injetado em toda chamada, pra a Nyta já chegar sabendo gênero/posição/audiência
// (sem re-perguntar). Ver helpers chartmetricContext/quizContext/diagnosticContext no edge.
let platformCtx: { chartmetric?: any; quizDiagnostic?: any; diagnostic?: any; realIndex?: any } = {};

export const setWizardPlatformContext = (ctx: {
  chartmetric?: any;
  quizDiagnostic?: any;
  diagnostic?: any;
  realIndex?: any;
}): void => {
  platformCtx = ctx || {};
};

export const clearWizardPlatformContext = (): void => {
  platformCtx = {};
};

async function callWizardAI(body: Record<string, any>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('wizard-ai', {
    body: { ...platformCtx, ...body },
  });
  if (error) throw new Error(error.message || 'Erro ao chamar IA');
  return data;
}

// O produto não usa travessões ("—"/"–") nos textos, mas a IA costuma inseri-los. Este tratamento
// remove o travessão de todo texto que volta da IA: vira vírgula quando separa orações e a pontuação
// redundante resultante é limpa. Aplicado em todas as saídas de texto do wizard-ai.
export const stripDashes = (s: string): string =>
  (s || '')
    .replace(/\s*[—–]\s*/g, ', ') // " — " / "–" viram ", "
    .replace(/\s+,/g, ',') // espaço antes de vírgula
    .replace(/,\s*,/g, ', ') // vírgulas duplicadas
    .replace(/,\s*([.;:!?…])/g, '$1') // vírgula colada em pontuação final
    .replace(/^[\s,]+/, '') // vírgula/espaço no início
    .replace(/\s{2,}/g, ' ')
    .trim();

// 3 a 5 objetivos estratégicos. `dossier`: Q&A consolidado da jornada (contexto extra).
export const createObjectives = async (
  identity: ArtistIdentity,
  spotify?: SpotifyProfile,
  dossier?: string
): Promise<string[]> => {
  const data = await callWizardAI({ action: 'createObjectives', identity, spotify, dossier });
  return data.objectives || [];
};

// ─── Metodologia Nyta (Roteiro + Docs 3–6) ────────────────────────────────────────────────────

// Visão: monta a frase a partir das 5 partes da fórmula, flexionada pelo gênero.
export const assembleVision = async (
  identity: ArtistIdentity,
  visionParts: VisionParts,
  recognitionTags: RecognitionTag[]
): Promise<string> => {
  const data = await callWizardAI({ action: 'assembleVision', identity, visionParts, recognitionTags });
  return stripDashes(String(data?.text || ''));
};

// Missão: combina os dois tempos (entrega + virada financeira) na fórmula do método.
export const assembleMission = async (
  identity: ArtistIdentity,
  missionParts: MissionParts
): Promise<string> => {
  const data = await callWizardAI({ action: 'assembleMission', identity, missionParts });
  return stripDashes(String(data?.text || ''));
};

// "Me ajuda a responder": a Nyta formula a resposta de uma etapa de texto aberto (história,
// o que falam, missão entrega/financeiro) a partir das respostas do artista às perguntas-guia.
export const composeOpenText = async (
  field: 'story' | 'oQueFalam' | 'entrega' | 'negocio' | 'paraQuem',
  identity: ArtistIdentity,
  answers: Record<string, string>
): Promise<string> => {
  const data = await callWizardAI({ action: 'composeOpenText', kind: field, identity, answers });
  return stripDashes(String(data?.text || ''));
};

// Objetivos: derivados pelo mapa de 4 camadas (Doc 3). Retorna a lista + o objetivo financeiro
// (obrigatório/não-removível). `recognitionTags` define os objetivos operacionais (camada 4).
export const deriveObjectives = async (
  identity: ArtistIdentity,
  recognitionTags: RecognitionTag[],
  spotify?: SpotifyProfile
): Promise<{ objectives: string[]; financial: string }> => {
  const data = await callWizardAI({ action: 'deriveObjectives', identity, recognitionTags, spotify });
  const objectives: string[] = Array.isArray(data?.objectives) ? data.objectives.map(String).filter(Boolean) : [];
  const financial = String(data?.financial || '');
  return { objectives, financial };
};

const sanitizeCategory = (c: any): StrategyCategory | undefined =>
  STRATEGY_CATEGORIES.includes(c) ? (c as StrategyCategory) : undefined;

// Estratégias: cruzamento (fraqueza×oportunidade, força×ameaça) + universais (Doc 5).
// Cada estratégia volta classificada numa das 11 categorias (para a priorização). Sem tasks —
// o cronograma (etapa 7) é quem gera as tarefas.
export const generateStrategies = async (
  identity: ArtistIdentity,
  swot: SwotAnalysis,
  objectives: string[],
  recognitionTags: RecognitionTag[],
  spotify?: SpotifyProfile,
  previous?: Strategy[],
  dossier?: string,
  userEdits?: string[]
): Promise<Strategy[]> => {
  const data = await callWizardAI({
    action: 'generateStrategies',
    identity,
    spotify,
    swot,
    objectives,
    recognitionTags,
    dossier,
    userEdits,
    previous: (previous || []).map((s) => ({ type: s.type, title: s.title, description: s.description })),
  });
  return (data.strategies || []).map((s: any) => ({
    id: uid(),
    type: (s.type as StrategyType) || 'WO',
    title: String(s.title || 'Estratégia'),
    description: s.description,
    why: s.why,
    category: sanitizeCategory(s.category),
    score: 0,
    tasks: [],
  }));
};

// Priorização: a matriz de notas estratégia × objetivo (Doc 6 §1). A pontuação sugerida vem de
// `suggestPriorityScores` (action existente); o widget PriorityScale aplica o cálculo e o ranking.

// Perguntas de diagnóstico para SWOT
export const createSwotQuiz = async (
  identity: ArtistIdentity,
  spotify?: SpotifyProfile
): Promise<string[]> => {
  const data = await callWizardAI({ action: 'createSwotQuiz', identity, spotify });
  return data.questions || [];
};

// Normaliza perguntas vindas da IA: aceita objeto rico ou string pura (se o modelo
// desobedecer o formato, a UI cai no modo texto livre).
const normalizeQuestions = (raw: any[]): QuizQuestion[] =>
  (raw || [])
    .map((q: any): QuizQuestion | null => {
      if (typeof q === 'string') return { question: q, options: [], multi: false };
      if (!q?.question) return null;
      return {
        question: String(q.question),
        options: Array.isArray(q.options) ? q.options.map(String).filter(Boolean) : [],
        multi: !!q.multi,
      };
    })
    .filter((q): q is QuizQuestion => !!q);

// Perguntas de diagnóstico SWOT com opções de resposta (bolhas).
// `objectives` entram como "fatos já conhecidos" — a IA é proibida de re-perguntar.
export const createSwotQuizV2 = async (
  identity: ArtistIdentity,
  spotify?: SpotifyProfile,
  objectives?: string[]
): Promise<QuizQuestion[]> => {
  const data = await callWizardAI({ action: 'createSwotQuizV2', identity, spotify, objectives });
  return normalizeQuestions(data.questions);
};

// Perguntas de cruzamento estratégico com opções de resposta (bolhas)
export const createStrategyQuizV2 = async (
  swot: SwotAnalysis,
  objectives: string[]
): Promise<QuizQuestion[]> => {
  const data = await callWizardAI({ action: 'createStrategyQuizV2', swot, objectives });
  return normalizeQuestions(data.questions);
};

// Normaliza UMA pergunta vinda da IA (quizzes adaptativos um-a-um).
const normalizeOneQuestion = (q: any): QuizQuestion | null => {
  if (!q?.question) return null;
  return {
    question: String(q.question),
    options: Array.isArray(q.options) ? q.options.map(String).filter(Boolean) : [],
    multi: !!q.multi,
  };
};

// Próxima pergunta adaptativa do diagnóstico SWOT (uma por vez, com base nas respostas).
// null em erro → o orquestrador encerra o quiz com o que já tem (fail-safe).
export const nextSwotQuestion = async (
  identity: ArtistIdentity,
  spotify: SpotifyProfile | undefined,
  objectives: string[],
  priorQA: { question: string; answer: string }[],
  askedCount: number
): Promise<QuizQuestion | null> => {
  try {
    const data = await callWizardAI({
      action: 'nextSwotQuestion',
      identity,
      spotify,
      objectives,
      answers: priorQA,
      askedCount,
    });
    return normalizeOneQuestion(data);
  } catch {
    return null;
  }
};

// Próxima pergunta adaptativa de cruzamento estratégico (uma por vez).
// identity/spotify alimentam o RAG no servidor (opções ancoradas em planos reais similares).
export const nextStrategyQuestion = async (
  swot: SwotAnalysis,
  objectives: string[],
  priorQA: { question: string; answer: string }[],
  askedCount: number,
  identity?: ArtistIdentity,
  spotify?: SpotifyProfile
): Promise<QuizQuestion | null> => {
  try {
    const data = await callWizardAI({
      action: 'nextStrategyQuestion',
      swot,
      objectives,
      answers: priorQA,
      askedCount,
      identity,
      spotify,
    });
    return normalizeOneQuestion(data);
  } catch {
    return null;
  }
};

// Análise SWOT a partir das respostas do quiz
export const createSwotAnalysis = async (
  identity: ArtistIdentity,
  answers: { question: string; answer: string }[],
  spotify?: SpotifyProfile,
  dossier?: string
): Promise<SwotAnalysis> => {
  const data = await callWizardAI({ action: 'createSwotAnalysis', identity, spotify, answers, dossier });
  return data as SwotAnalysis;
};

// Quiz de estratégia cruzada
export const createStrategyQuiz = async (swot: SwotAnalysis): Promise<string[]> => {
  const data = await callWizardAI({ action: 'createStrategyQuiz', swot });
  return data.questions || [];
};

// Estratégias cruzadas SO/ST/WO/WT com tarefas.
// `previous`: estratégias já propostas — em "Gerar outras" a IA é proibida de reformulá-las.
export const createStrategies = async (
  identity: ArtistIdentity,
  swot: SwotAnalysis,
  objectives: string[],
  answers: { question: string; answer: string }[],
  spotify?: SpotifyProfile,
  previous?: Strategy[],
  dossier?: string,
  userEdits?: string[]
): Promise<Strategy[]> => {
  const data = await callWizardAI({
    action: 'createStrategies',
    identity,
    spotify,
    swot,
    objectives,
    answers,
    dossier,
    userEdits,
    previous: (previous || []).map((s) => ({ type: s.type, title: s.title, description: s.description })),
  });
  const strategies: Strategy[] = (data.strategies || []).map((s: any) => ({
    id: uid(),
    type: (s.type as StrategyType) || 'SO',
    title: s.title,
    description: s.description,
    why: s.why,
    score: 0,
    tasks: (s.tasks || []).map((t: any) => ({
      id: uid(),
      description: t.description,
      type: t.type,
      owner: TASK_OWNER_SELF, // responsável inicial: o dono do perfil (reatribuível no Plano de Ação)
      status: 'todo' as const,
    })),
  }));
  return strategies;
};

const TASK_TYPES = [
  'produto_fonografico',
  'audio_visual',
  'design',
  'fotos',
  'figurino',
  'site',
  'textos',
  'assessoria',
  'marketing_digital',
  'media_kit',
  'radio',
  'show',
  'acoes',
];

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// Cronograma: 3 tarefas por estratégia, com prazos futuros distribuídos por prioridade
// (estratégia #1 → ~7 dias, #2 → ~30, #3 → ~60…). Recebe estratégias já ordenadas por
// finalScore desc e devolve as mesmas estratégias com as tasks substituídas.
export const generateSchedule = async (
  strategies: Strategy[],
  today: string,
  // SWOT integral: evita tarefas que "adquirem" capacidades que já são forças do artista
  swot?: SwotAnalysis
): Promise<Strategy[]> => {
  const payload = strategies.map((s) => ({
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    why: s.why,
    finalScore: s.finalScore ?? 0,
  }));

  let generated: any[] = [];
  try {
    const data = await callWizardAI({ action: 'generateSchedule', strategies: payload, today, swot });
    generated = data.strategies || [];
  } catch {
    generated = [];
  }

  return strategies.map((s, idx) => {
    const match =
      generated.find((g: any) => g.id === s.id) ||
      (generated[idx]?.tasks ? generated[idx] : undefined);
    const baseOffset = 7 + idx * 30;

    let tasks = (match?.tasks || []).map((t: any, ti: number) => {
      let deadline = typeof t.deadline === 'string' ? t.deadline.slice(0, 10) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || deadline <= today) {
        deadline = addDays(today, baseOffset + ti * 14);
      }
      return {
        id: uid(),
        description: String(t.description || 'Tarefa'),
        type: TASK_TYPES.includes(t.type) ? t.type : 'acoes',
        deadline,
        status: 'todo' as const,
      };
    });

    // Fallback sintético: a IA não devolveu tarefas para esta estratégia.
    if (!tasks.length) {
      tasks = [
        `Iniciar implementação: ${s.title}`,
        `Revisar progresso: ${s.title}`,
        `Finalizar e avaliar: ${s.title}`,
      ].map((description, ti) => ({
        id: uid(),
        description,
        type: 'acoes',
        deadline: addDays(today, baseOffset + ti * 14),
        status: 'todo' as const,
      }));
    }

    return { ...s, tasks };
  });
};

// Resumo executivo final
export const createFinalResult = async (
  identity: ArtistIdentity,
  swot: SwotAnalysis | undefined,
  objectives: string[],
  strategies: Strategy[],
  spotify?: SpotifyProfile,
  dossier?: string
): Promise<string> => {
  const data = await callWizardAI({ action: 'createFinalResult', identity, spotify, swot, objectives, strategies, dossier });
  return stripDashes(String(data?.text || ''));
};

// Notas sugeridas de priorização: nota 0-10 de cada estratégia para cada objetivo.
// Devolve, por estratégia, o mapa objectiveScores (índice→nota) + justificativa.
export const suggestPriorityScores = async (
  strategies: Strategy[],
  objectives: string[]
): Promise<Record<string, { byObjective: Record<number, number>; rationale: string }>> => {
  const payload = strategies.map((s) => ({ id: s.id, title: s.title, description: s.description }));
  const data = await callWizardAI({ action: 'suggestPriorityScores', strategies: payload, objectives });
  const out: Record<string, { byObjective: Record<number, number>; rationale: string }> = {};
  for (const row of data.scores || []) {
    if (!row?.id) continue;
    const byObjective: Record<number, number> = {};
    for (const [k, v] of Object.entries(row.byObjective || {})) {
      const n = Number(v);
      if (Number.isFinite(n)) byObjective[Number(k)] = Math.max(0, Math.min(10, n));
    }
    out[row.id] = { byObjective, rationale: String(row.rationale || '') };
  }
  return out;
};

// Gate de qualidade: a IA decide se a resposta livre do artista é aproveitável.
// Fail-open: qualquer erro (rede/IA) libera a resposta — nunca trava o usuário.
export const validateAnswer = async (
  question: string,
  answer: string,
  kind?: string
): Promise<{ ok: boolean; reask: string }> => {
  try {
    const data = await callWizardAI({ action: 'validateAnswer', question, answer, kind });
    return { ok: data?.ok !== false, reask: stripDashes(String(data?.reask || '')) };
  } catch {
    return { ok: true, reask: '' };
  }
};

// Entrevista adaptativa de visão/missão: próxima pergunta com base nas respostas.
// Fail-safe: erro → done:true (compõe com o que já tem, nunca trava a entrevista).
export const nextInterviewQuestion = async (
  field: 'vision' | 'mission' | 'bio',
  identity: ArtistIdentity,
  answers: Record<string, string>,
  askedCount: number,
  spotify?: SpotifyProfile
): Promise<{ done: boolean; question: string }> => {
  try {
    const data = await callWizardAI({
      action: 'nextInterviewQuestion',
      kind: field,
      identity,
      spotify,
      answers,
      askedCount,
    });
    return { done: data?.done === true, question: stripDashes(String(data?.question || '')) };
  } catch {
    return { done: true, question: '' };
  }
};

// Assistente de Visão/Missão
export const improveVisionMissionText = async (
  kind: 'vision' | 'mission' | 'bio',
  identity: ArtistIdentity,
  answers: Record<string, string>
): Promise<string> => {
  const data = await callWizardAI({ action: 'improveVisionMission', identity, kind, answers });
  return stripDashes(String(data?.text || ''));
};

// Plano de Ação: a Nyta sugere as próximas tarefas concretas dentro de uma estratégia,
// direcionando o artista pro melhor caminho. Fail-safe: erro → [].
export const suggestTasks = async (
  strategy: Strategy,
  objectives: string[],
  identity: ArtistIdentity,
  spotify?: SpotifyProfile
): Promise<{ description: string; type?: string; deadline?: string }[]> => {
  try {
    const data = await callWizardAI({
      action: 'suggestTasks',
      strategies: [strategy],
      objectives,
      identity,
      spotify,
      today: new Date().toISOString().split('T')[0],
    });
    return Array.isArray(data?.tasks)
      ? data.tasks.map((t: any) => ({ ...t, description: stripDashes(String(t?.description || '')) }))
      : [];
  } catch {
    return [];
  }
};
