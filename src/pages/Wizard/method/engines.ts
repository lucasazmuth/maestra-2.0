// Motores determinísticos da Metodologia v2 — objetivos, estratégias, priorização e plano de ação.
// Funções puras (sem React, sem rede, sem LLM). Consomem as lookup tables deste diretório.

import { TASK_OWNER_SELF } from '../../../constants/maestra';
import type {
  ActionTask,
  ArtistContent,
  ArtistIdentity,
  MissionParts,
  RecognitionTag,
  Strategy,
} from '../../../interfaces/maestra';
import { STRATEGY_BY_ID } from './strategyBank';
import { MATRIX_A, MATRIX_B, MATRIX_C, TRANSVERSAL_FORCES } from './matrices';
import { OBJECTIVE_CODES, globalSum, objectiveToCode, scoreFor } from './priorityMatrix';
import { internalLabel, opportunityLabel } from './swotItems';

const uid = (): string => Math.random().toString(36).slice(2, 10);

// ─── Objetivos (Nyta_Etapa_Objetivos_v2) ────────────────────────────────────────────────────────

// Fonte 1 — etiqueta de reconhecimento (Visão Q2) → objetivos oferecidos.
const OBJECTIVE_TAG_MAP: Record<RecognitionTag, string[]> = {
  publico: ['Ampliar a agenda de shows', 'Ampliar os resultados digitais'],
  mercado: ['Ampliar a agenda de shows', 'Obter reconhecimento do mercado'],
  critica_midia: ['Obter reconhecimento da crítica', 'Obter reconhecimento dos veículos de mídia'],
  classe_artistica: ['Obter o reconhecimento da classe artística'],
  internacional: [], // tratado pela Fonte 2
};

// Fonte 4 — parte financeira da missão (tier) → objetivo financeiro literal.
const FINANCIAL_OBJECTIVE: Record<NonNullable<MissionParts['financialTier']>, string | null> = {
  hobby: null, // hobby não gera objetivo financeiro
  projeto: 'Alcançar sustentabilidade financeira para o projeto',
  eu: 'Gerar resultados financeiros relevantes',
  eu_parceiros: 'Gerar resultados financeiros para o projeto e seus parceiros',
};

// Limpeza defensiva de português: preposição duplicada ("para pra", "pra para", "para para") e
// espaços extras. Rede de segurança caso a frase de origem venha com duplicação.
const cleanPt = (s: string): string =>
  s
    .replace(/\b(para|pra)\s+(para|pra)\b/gi, 'para')
    .replace(/\s{2,}/g, ' ')
    .trim();

// Fonte 3 — objetivo simbólico = PRIMEIRA ORAÇÃO da missão JÁ MONTADA (polida pela IA), antes da
// parte financeira. Doc Objetivos_v2 §Fonte 3: "pegar a primeira oração da missao_frase, sem
// reformular". Usar a missão montada (e não as partes cruas) garante português correto.
const symbolicFromMission = (mission?: string): string | null => {
  const m = (mission || '').trim();
  if (!m) return null;
  const first = cleanPt(
    m
      .split(/,?\s+(?:gerando|e gerar|alcançando|obtendo|com isso gerando)\b/i)[0]
      .replace(/[.,;\s]+$/, '')
  );
  return first || null;
};

// Gera o UNIVERSO de objetivos oferecidos (Fontes 1+2+3+4, com dedup). O cap de 5 é aplicado pela
// UI (o artista escolhe). Determinístico — sem interpretação livre.
export const generateObjectives = (
  identity: ArtistIdentity,
  missionParts: MissionParts
): string[] => {
  const tags = identity.recognitionTags || [];
  const out: string[] = [];

  // Fonte 1 — tags de reconhecimento.
  tags.forEach((t) => (OBJECTIVE_TAG_MAP[t] || []).forEach((o) => out.push(o)));
  // Fonte 2 — alcance internacional (etiqueta derivada da Visão Q1).
  if (tags.includes('internacional')) out.push('Alcançar repercussão internacional');
  // Fonte 3 — missão simbólica (primeira oração da missão MONTADA).
  const sym = symbolicFromMission(identity.mission);
  if (sym) out.push(sym);
  // Fonte 4 — missão financeira.
  const fin = missionParts.financialTier ? FINANCIAL_OBJECTIVE[missionParts.financialTier] : null;
  if (fin) out.push(fin);

  // Dedup exato (preserva ordem da 1ª ocorrência).
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = o.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ─── Estratégias (Nyta_Etapa_Estrategias_v3) ────────────────────────────────────────────────────

// Camada 1 — preposição do nome (do/da). O gênero gramatical do artista é o sinal mais confiável;
// na ausência, cai na heurística do final do nome (termina em "a" átono → "da", senão "do").
const namePreposition = (name: string, gender?: ArtistIdentity['gender']): string => {
  if (gender === 'ela') return 'da';
  if (gender === 'ele') return 'do';
  return /a\s*$/i.test(name.trim()) ? 'da' : 'do';
};

// Camada 1 — substitui o placeholder [nome] (ex.: estratégia #43 "Lojinha do/da [nome]").
const personalizeName = (title: string, name?: string, gender?: ArtistIdentity['gender']): string => {
  if (!title.includes('[nome]')) return title;
  const n = (name || '').trim();
  if (!n) return title.replace(/do\/da \[nome\]/g, '').replace(/\[nome\]/g, '').replace(/\s+/g, ' ').trim();
  return title.replace(/do\/da \[nome\]/g, `${namePreposition(n, gender)} ${n}`).replace(/\[nome\]/g, n);
};

// Camada 4 — força como alavanca: prefixo determinístico inserido no título da estratégia quando
// uma força FOCADA (não-transversal) a potencializa (Matriz C). Máximo uma força por estratégia
// (a primeira da matriz). Mapa por id da força interna (1–20); transversais não têm entrada.
const FORCE_LEVER: Record<number, string> = {
  2: 'Alavancando seu repertório autoral',
  3: 'Alavancando sua produção musical',
  4: 'Alavancando seu show pronto',
  5: 'Alavancando sua presença de palco',
  6: 'Alavancando sua agenda de shows',
  7: 'Alavancando sua gestão comercial',
  11: 'Alavancando seu posicionamento',
  12: 'Alavancando sua identidade visual',
  13: 'Alavancando seu material de divulgação',
  14: 'Alavancando sua rede de contatos',
  15: 'Alavancando sua presença digital',
  16: 'Alavancando sua assessoria de imprensa',
  18: 'Alavancando sua distribuição',
  19: 'Alavancando seu conhecimento do mercado',
  20: 'Alavancando sua estrutura jurídica',
};
const applyForceLever = (title: string, forceIds: number[]): string => {
  const fId = forceIds.find((id) => FORCE_LEVER[id]);
  return fId ? `${FORCE_LEVER[fId]} — ${title}` : title;
};

// Resultado intermediário da geração, antes de virar Strategy.
interface GenItem {
  bankId: string;
  fromWeakness: number[]; // ids de fraquezas que dispararam
  fromOpportunity: number[]; // ids de oportunidades que dispararam
  fromForce: number[]; // ids de forças focadas que potencializam (Matriz C)
}

// Gera as estratégias a partir das seleções do Diagnóstico (Metodologia v2 §10).
// Ameaças NÃO geram estratégias (decisão mantida — ficam no radar do diagnóstico).
export const generateStrategies = (
  swot: NonNullable<ArtistContent['swotInputs']>,
  identity: ArtistIdentity
): Strategy[] => {
  const internal = swot.internal || {};
  const weaknesses = Object.keys(internal)
    .map(Number)
    .filter((id) => internal[id] === 'melhorar');
  const forces = Object.keys(internal)
    .map(Number)
    .filter((id) => internal[id] === 'forte' && !TRANSVERSAL_FORCES.has(id));
  const opportunities = swot.opportunities || [];

  const items = new Map<string, GenItem>();
  const ensure = (bankId: string): GenItem => {
    if (!items.has(bankId)) items.set(bankId, { bankId, fromWeakness: [], fromOpportunity: [], fromForce: [] });
    return items.get(bankId)!;
  };

  // Matriz A — fraquezas.
  weaknesses.forEach((wId) => (MATRIX_A[wId] || []).forEach((sid) => ensure(sid).fromWeakness.push(wId)));
  // Matriz B — oportunidades.
  opportunities.forEach((oId) => (MATRIX_B[oId] || []).forEach((sid) => ensure(sid).fromOpportunity.push(oId)));
  // Matriz C — forças focadas potencializam estratégias JÁ geradas (não criam novas).
  forces.forEach((fId) =>
    (MATRIX_C[fId] || []).forEach((sid) => {
      if (items.has(sid)) ensure(sid).fromForce.push(fId);
    })
  );

  // Ordena por seção do banco (3.1→3.27) e depois por id, e materializa as Strategy.
  const ordered = Array.from(items.values()).sort((a, b) => {
    const oa = STRATEGY_BY_ID[a.bankId]?.order ?? 99;
    const ob = STRATEGY_BY_ID[b.bankId]?.order ?? 99;
    if (oa !== ob) return oa - ob;
    return a.bankId.localeCompare(b.bankId, undefined, { numeric: true });
  });

  return ordered.map((g) => {
    const bank = STRATEGY_BY_ID[g.bankId];
    const forceLabels = g.fromForce.map(internalLabel).filter(Boolean);
    const swotRefs = {
      weaknesses: g.fromWeakness.map(internalLabel).filter(Boolean),
      opportunities: g.fromOpportunity.map(opportunityLabel).filter(Boolean),
      strengths: forceLabels,
    };
    // Camada 4 — força como alavanca inserida no próprio título; força focada → tipo SO (ataque).
    const baseTitle = personalizeName(bank?.title || g.bankId, identity.name, identity.gender);
    return {
      id: uid(),
      bankId: g.bankId,
      type: forceLabels.length ? 'SO' : 'WO',
      title: applyForceLever(baseTitle, g.fromForce),
      swotRefs,
      tasks: [],
      score: 0,
    } as Strategy;
  });
};

// ─── Priorização (Nyta_Matriz_Priorizacao_v2) ──────────────────────────────────────────────────

// Notas sugeridas (matriz 53×8) no formato consumido pelo widget PriorityScale:
//   { [strategyId]: { byObjective: { [objIndex]: nota } } }
// Cada objetivo do artista é classificado num dos 8 códigos; a nota vem da matriz.
export const suggestScores = (
  strategies: Strategy[],
  objectives: string[]
): Record<string, { byObjective: Record<number, number>; rationale: string }> => {
  const codes = objectives.map(objectiveToCode);
  const out: Record<string, { byObjective: Record<number, number>; rationale: string }> = {};
  for (const s of strategies) {
    const byObjective: Record<number, number> = {};
    codes.forEach((code, i) => {
      byObjective[i] = s.bankId ? scoreFor(s.bankId, code) : 5;
    });
    // Linha pedagógica: objetivo que esta estratégia mais serve.
    let topIdx = 0;
    objectives.forEach((_, i) => {
      if ((byObjective[i] ?? 0) > (byObjective[topIdx] ?? 0)) topIdx = i;
    });
    out[s.id] = {
      byObjective,
      rationale: objectives[topIdx] ? `Mais forte no objetivo "${objectives[topIdx]}".` : '',
    };
  }
  return out;
};

// Aplica a priorização determinística e ordena (com desempates §5): finalScore (soma das notas
// ponderadas igualmente = soma das notas por objetivo) → versatilidade global → ordem do banco
// (dependência lógica: branding/material antes de prospecção; show antes de prospecção).
export const prioritizeStrategies = (strategies: Strategy[], objectives: string[]): Strategy[] => {
  const scores = suggestScores(strategies, objectives);
  const withScores = strategies.map((s) => {
    const byObjective = scores[s.id]?.byObjective || {};
    const finalScore = objectives.reduce((sum, _o, i) => sum + (byObjective[i] || 0), 0);
    return {
      ...s,
      objectiveScores: byObjective,
      finalScore,
      priorityRationale: scores[s.id]?.rationale,
    } as Strategy;
  });
  return withScores.sort((a, b) => {
    if ((b.finalScore || 0) !== (a.finalScore || 0)) return (b.finalScore || 0) - (a.finalScore || 0);
    const gv = globalSum(b.bankId || '') - globalSum(a.bankId || '');
    if (gv !== 0) return gv;
    const oa = STRATEGY_BY_ID[a.bankId || '']?.order ?? 99;
    const ob = STRATEGY_BY_ID[b.bankId || '']?.order ?? 99;
    return oa - ob;
  });
};

// ─── Plano de Ação (Nyta_Etapa_Plano_de_Acao_v1) ───────────────────────────────────────────────

// Passo a passo canônico da estratégia → tarefas (responsável = dono; prazo/status vazios).
// As tarefas canônicas não têm placeholders, então o texto é literal.
export const buildActionPlan = (strategy: Strategy): ActionTask[] => {
  const bank = strategy.bankId ? STRATEGY_BY_ID[strategy.bankId] : undefined;
  const steps = bank?.tasks || [];
  return steps.map((description) => ({
    id: uid(),
    description,
    owner: TASK_OWNER_SELF,
    status: 'todo' as const,
  }));
};

// Distribui o plano de ação no tempo (Metodologia v2 — perguntar início + duração).
// Lógica "por prioridade, em cascata": as estratégias entram na ordem de prioridade (finalScore),
// cada uma com cadência ~semanal entre suas tarefas; as estratégias começam escalonadas (as mais
// prioritárias antes) e tudo é encaixado no horizonte (em meses) escolhido pelo artista. As datas
// são apenas SUGESTÕES — o artista ajusta cada uma no cronograma.
const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + Math.round(days));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const seedScheduledPlan = (
  strategies: Strategy[],
  startISO: string,
  months: number
): Strategy[] => {
  const ordered = strategies.slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0));
  const built = ordered.map((s) => ({ s, tasks: buildActionPlan(s) }));
  const n = built.length;
  const horizonDays = Math.max(30, Math.round((months || 12) * 30.44));
  const maxTasks = built.reduce((m, b) => Math.max(m, b.tasks.length), 1);

  // Cadência (dias entre tarefas da mesma estratégia) e stagger (dias entre o início de cada
  // estratégia). Padrão: cadência semanal; stagger calculado para a última tarefa cair no horizonte.
  let cadence = 7;
  const span = (maxTasks - 1) * cadence; // duração de uma estratégia em dias
  let stagger = n > 1 ? (horizonDays - span) / (n - 1) : 0;
  if (stagger < 4) {
    // Horizonte apertado: comprime a cadência mantendo um escalonamento mínimo de 4 dias.
    stagger = 4;
    cadence = Math.max(2, (horizonDays - stagger * (n - 1)) / Math.max(1, maxTasks - 1));
  } else if (stagger > 30) {
    // Sobra de horizonte: limita o escalonamento a ~1 mês (evita estratégias muito espaçadas).
    stagger = 30;
  }

  return built.map(({ s, tasks }, i) =>
    ({
      ...s,
      tasks: tasks.map((t, j) => ({
        ...t,
        deadline: addDays(startISO, i * stagger + j * cadence),
      })),
    })
  );
};

// Re-exporta o código de objetivo para a UI (badges/legendas), se necessário.
export { OBJECTIVE_CODES };
