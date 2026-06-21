import { SAY } from './nytaPersona';
import { getPhaseInfo } from '../../../constants/maestra';
import { flex } from './wizardData';
import type { ArtistContent, ArtistIdentity, RecognitionTag, VisionParts } from '../../../interfaces/maestra';

// Rótulo legível das fontes de reconhecimento (Visão Q2) para o reflexo da Q8.
const FONTE_LABEL: Record<RecognitionTag, string> = {
  publico: 'do público',
  critica_midia: 'da crítica e da mídia',
  mercado: 'do mercado',
  classe_artistica: 'dos seus pares (a classe artística)',
  internacional: '', // alcance geográfico, não é fonte de reconhecimento
};
const recognitionFontesLabel = (tags?: RecognitionTag[]): string => {
  const labels = (tags || []).map((t) => FONTE_LABEL[t]).filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
};

// Fonte de reconhecimento no formato "por [de quem]" da fórmula da Visão (Q10).
const FONTE_POR: Record<RecognitionTag, string> = {
  publico: 'pelo público',
  critica_midia: 'pela crítica e mídia',
  mercado: 'pelo mercado',
  classe_artistica: 'pelos seus pares',
  internacional: '',
};
const recognitionPorLabel = (tags?: RecognitionTag[]): string => {
  const labels = (tags || []).map((t) => FONTE_POR[t]).filter(Boolean);
  if (!labels.length) return '';
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
};

// Flexão feminina de substantivo/adjetivo da fórmula (concordância de gênero). Regras seguras do
// português: -or → -ora (produtor→produtora, inovador→inovadora) e -o → -a (autêntico→autêntica,
// criativo→criativa). Demais terminações (-a, -e, -ista, -al, -il, -ente…) ficam invariáveis.
const feminize = (word: string): string => {
  const w = (word || '').trim();
  if (!w) return w;
  if (/or$/i.test(w)) return w.replace(/or$/i, 'ora');
  if (/o$/i.test(w)) return w.replace(/o$/i, 'a');
  return w;
};

// Preposição + artigo da cidade. A maioria das cidades brasileiras não leva artigo ("em São Paulo",
// "em Salvador"); um conjunto conhecido leva o artigo "o" → contração "no" ("no Rio de Janeiro",
// "no Recife", "no Guarujá"). Heurística: qualquer "Rio …" + lista explícita; o resto fica "em".
const CITY_ARTICLE_NO = new Set(['recife', 'crato', 'guarujá', 'guaruja', 'cabo', 'gama']);
const cityPhrase = (city: string): string => {
  const c = city.trim();
  const low = c.toLowerCase();
  if (/^rio\b/.test(low) || CITY_ARTICLE_NO.has(low)) return `no ${c}`;
  return `em ${c}`;
};

// Monta o prefixo da fórmula da Visão (Q10) com as partes já coletadas; o artista completa o "que…".
// Ex.: "AZMUTH BEATS quer ser reconhecido nacionalmente, pelo público e pela crítica, como um produtor inovador que…"
const buildVisionFormulaPrefix = (id: ArtistIdentity, vp: VisionParts): string => {
  const name = id.name || 'Você';
  const fem = id.gender === 'ela';
  const reconhecid = flex(id.gender, { m: 'reconhecido', f: 'reconhecida', n: 'reconhecide' });
  const artigo = flex(id.gender, { m: 'um', f: 'uma', n: 'um' });
  // [região geográfica] derivada da cidade/UF (a pergunta de alcance geográfico não existe na v2),
  // com preposição+artigo corretos ("no Rio de Janeiro e região").
  const regiao = id.city ? `${cityPhrase(id.city)} e região` : '';
  const porFontes = recognitionPorLabel(id.recognitionTags);
  // Concordância de gênero: no feminino, flexiona substantivo e adjetivo ("uma artista autêntica").
  const subs = fem ? feminize(vp.substantivo || '') : vp.substantivo || '';
  const adj = fem ? feminize(vp.adjetivo || '') : vp.adjetivo || '';
  let s = `${name} quer ser ${reconhecid}`;
  if (regiao) s += ` ${regiao}`;
  if (porFontes) s += `, ${porFontes}`;
  s += `, como ${artigo} ${subs}${adj ? ` ${adj}` : ''} que…`;
  return s;
};

// O roteiro da conversa (metodologia Nyta): dado o draft, resolve deterministicamente o próximo
// "beat" — o que a Nyta fala e qual widget coleta a resposta. O `step` persistido é a âncora
// (progresso/retomada); os sub-passos derivam da presença dos campos coletados.
//
// Ordem das etapas (Roteiro + Docs 3–6):
//   0 Identidade  — gênero gramatical, estilo musical, estágio, história, mapa de referências
//   1 Visão       — cidade/UF + fórmula de 5 partes + montagem/validação
//   2 Missão+Valores — 2 tempos + montagem/validação + valores seedados
//   3 Objetivos   — derivados (4 camadas), financeiro travado
//   4 Diagnóstico — SWOT (campo aberto + chips) + board
//   5 Estratégias — cruzamento (fraqueza×oportunidade) + universais
//   6 Prioridades — matriz de impacto (10–12)
//   7 Cronograma  — 12 meses
//   8 Plano final — resumo executivo

export type WidgetSpec =
  | { kind: 'gender' }
  | { kind: 'genre' }
  | { kind: 'stage' }
  | { kind: 'textHelp'; field: 'oQueFalam' | 'entrega' | 'paraQuem' }
  | { kind: 'referenceHorizons' }
  | { kind: 'cityInput' }
  | { kind: 'visionPorQuem' }
  | { kind: 'visionSubstantivo' }
  | { kind: 'visionAdjetivo' }
  | { kind: 'visionReview' }
  | { kind: 'missionFinancial' }
  | { kind: 'missionReview' }
  | { kind: 'values' }
  | { kind: 'objectives' }
  | { kind: 'swotInternal' }
  | { kind: 'swotOpportunities' }
  | { kind: 'swotThreats' }
  | { kind: 'swotBoard' }
  | { kind: 'strategies' }
  | { kind: 'priority' }
  | { kind: 'planSetup' }
  | { kind: 'timeline' }
  | { kind: 'final' }
  | { kind: 'retry' };

export type PrepareAction =
  | 'assembleVision'
  | 'assembleMission'
  | 'generateStrategies'
  | 'schedule'
  | 'summary';

export interface Beat {
  stage: string;
  say: string[];
  widget: WidgetSpec | null;
  prepare?: PrepareAction;
  // o texto digitado no input do chat é a resposta deste beat
  acceptsText?: boolean;
  // dados completos mas step atrasado (recuperação de queda) → orquestrador persiste
  autoPersistStep?: number;
}

// Metodologia v2: o plano de ação semeia tarefas canônicas com PRAZOS SUGERIDOS (cascata por
// prioridade, a partir do início + duração escolhidos). O gate verifica a EXISTÊNCIA de tarefas,
// não a presença de prazos específicos (senão entraria em loop re-gerando o plano indefinidamente).
const hasSchedule = (draft: ArtistContent) =>
  (draft.strategies || []).some((s) => (s.tasks || []).length > 0);

export function nextBeat(draft: ArtistContent): Beat {
  const step = draft.step ?? 0;
  const id = draft.identity || {};
  const vp = id.visionParts || {};
  const mp = id.missionParts || {};

  // STEP 0 — Identidade (abertura + mapa de referências)
  if (step <= 0) {
    if (!id.gender)
      return { stage: 'identity.gender', say: SAY.askGender(), widget: { kind: 'gender' } };
    if (!(id.genre || '').trim()) {
      // Metodologia v2, Q2: se a Chartmetric já trouxe gênero(s), a Nyta só confirma; senão, lista.
      const cm = draft.chartmetricProfile;
      const cmGenres = cm?.genres?.length ? cm.genres : cm?.genre ? [cm.genre] : [];
      const say = cmGenres.length ? SAY.askGenreConfirm(cmGenres.join(', ')) : SAY.askGenreMusical();
      return { stage: 'identity.genre', say, widget: { kind: 'genre' } };
    }
    if (!id.stage)
      return { stage: 'identity.stage', say: SAY.askStage(), widget: { kind: 'stage' } };
    // Mapa de referências — uma frente por turno (Metodologia v2, Q5).
    const refs = id.references || {};
    if (refs.artisticas == null)
      return { stage: 'ref.artisticas', say: [...SAY.referencesIntro(id.name || 'você'), ...SAY.refArtisticas()], widget: null, acceptsText: true };
    if (refs.comunicacao == null)
      return { stage: 'ref.comunicacao', say: SAY.refComunicacao(), widget: null, acceptsText: true };
    if (refs.gestao == null)
      return { stage: 'ref.gestao', say: SAY.refGestao(), widget: null, acceptsText: true };
    if (refs.posicionamento == null)
      return { stage: 'ref.posicionamento', say: SAY.refPosicionamento(), widget: { kind: 'referenceHorizons' } };
    return { stage: 'identity.done', say: [], widget: null, autoPersistStep: 1 };
  }

  // STEP 1 — Visão (cidade/UF + fórmula + montagem)
  if (step === 1) {
    // A apresentação (texto + mapa inline + pergunta) é orquestrada no NytaChat (stage vision.city),
    // por isso o `say` fica vazio aqui — o orquestrador injeta o mapa de referências entre as falas.
    if (!id.city)
      return { stage: 'vision.city', say: [], widget: { kind: 'cityInput' } };
    if (!vp.porQuem?.length)
      return { stage: 'vision.porQuem', say: SAY.visionPorQuem(), widget: { kind: 'visionPorQuem' } };
    if (!vp.substantivo) {
      // Metodologia v2, Q8: reflete a fonte de reconhecimento antes de perguntar o substantivo.
      const fontes = recognitionFontesLabel(id.recognitionTags);
      const say = fontes
        ? [...SAY.visionPorQuemReflect(fontes), ...SAY.visionSubstantivo()]
        : SAY.visionSubstantivo();
      return { stage: 'vision.substantivo', say, widget: { kind: 'visionSubstantivo' } };
    }
    if (!vp.adjetivo)
      return { stage: 'vision.adjetivo', say: SAY.visionAdjetivo(), widget: { kind: 'visionAdjetivo' } };
    if (!vp.oQueFalam)
      return { stage: 'vision.oQueFalam', say: SAY.visionOQueFalam(buildVisionFormulaPrefix(id, vp)), widget: { kind: 'textHelp', field: 'oQueFalam' }, acceptsText: true };
    if (!(id.vision || '').trim())
      return { stage: 'vision.assemble', say: SAY.preparing(), widget: null, prepare: 'assembleVision' };
    return { stage: 'vision.review', say: SAY.visionReview(), widget: { kind: 'visionReview' } };
  }

  // STEP 2 — Missão (dois tempos: entrega + para quem → tier financeiro → montagem)
  if (step === 2) {
    if (!mp.entrega)
      return { stage: 'mission.entrega', say: SAY.missionEntrega(id.name || 'você'), widget: { kind: 'textHelp', field: 'entrega' }, acceptsText: true };
    if (!mp.paraQuem)
      return { stage: 'mission.paraQuem', say: SAY.missionParaQuem(), widget: { kind: 'textHelp', field: 'paraQuem' }, acceptsText: true };
    if (!mp.financialTier)
      return { stage: 'mission.financial', say: SAY.missionFinancial(), widget: { kind: 'missionFinancial' } };
    if (!(id.mission || '').trim())
      return { stage: 'mission.assemble', say: SAY.preparing(), widget: null, prepare: 'assembleMission' };
    return { stage: 'mission.review', say: SAY.missionReview(), widget: { kind: 'missionReview' } };
  }

  // STEP 3 — Valores (chips seedados da missão)
  if (step === 3) {
    if (!id.values?.length)
      return { stage: 'values', say: SAY.valuesIntro(), widget: { kind: 'values' } };
    return { stage: 'values.done', say: [], widget: null, autoPersistStep: 4 };
  }

  // STEP 4 — Objetivos (derivados; financeiro travado)
  if (step === 4)
    return { stage: 'objectives', say: SAY.objectivesIntro(), widget: { kind: 'objectives' } };

  // STEP 5 — Diagnóstico SWOT: interno (20 itens) → oportunidades → ameaças → board.
  // Cada fase é um beat com seu próprio balão de intro (Nyta fala) + widget limpo.
  if (step === 5) {
    const si = draft.swotInputs || {};
    if (!si.internal)
      return { stage: 'swot.internal', say: [...SAY.swotIntro(), ...SAY.swotInternalIntro()], widget: { kind: 'swotInternal' } };
    if (si.opportunities === undefined)
      return { stage: 'swot.opportunities', say: SAY.swotOportunidadesIntro(), widget: { kind: 'swotOpportunities' } };
    if (si.threats === undefined)
      return { stage: 'swot.threats', say: SAY.swotAmeacasIntro(), widget: { kind: 'swotThreats' } };
    // Comentário sobre o balanço: forças + oportunidades vs fraquezas + ameaças.
    const sw = draft.swotAnalysis;
    const favoravel = sw
      ? sw.strengths.length + sw.opportunities.length >= sw.weaknesses.length + sw.threats.length
      : true;
    return {
      stage: 'swot.board',
      say: [...SAY.swotReady(), ...SAY.swotBalance(favoravel)],
      widget: { kind: 'swotBoard' },
    };
  }

  // STEP 6 — Estratégias (cruzamento)
  if (step === 6) {
    if (!draft.strategies?.length)
      return { stage: 'strategies.prepare', say: SAY.preparing(), widget: null, prepare: 'generateStrategies' };
    return { stage: 'strategies.review', say: SAY.strategiesReady(), widget: { kind: 'strategies' } };
  }

  // STEP 7 — Priorização (matriz de notas estratégia × objetivo, Doc 6 §1)
  if (step === 7)
    return { stage: 'priority', say: SAY.priorityIntro(), widget: { kind: 'priority' } };

  // STEP 8 — Plano de Ação / Cronograma
  if (step === 8) {
    // Antes de semear as tarefas, pergunta início + duração (Metodologia v2): o cronograma nasce
    // com datas sugeridas, distribuídas por prioridade em cascata.
    if (!draft.planStart || !draft.planMonths)
      return { stage: 'schedule.setup', say: SAY.scheduleSetupIntro(), widget: { kind: 'planSetup' } };
    if (!hasSchedule(draft))
      return { stage: 'schedule.prepare', say: SAY.preparing(), widget: null, prepare: 'schedule' };
    return { stage: 'schedule.review', say: SAY.scheduleReady(), widget: { kind: 'timeline' } };
  }

  // step >= 9: resumo + conclusão (e revisita pós-conclusão)
  if (!draft.executiveSummary)
    return { stage: 'final.prepare', say: SAY.preparing(), widget: null, prepare: 'summary' };
  return { stage: 'final', say: [], widget: { kind: 'final' } };
}

// Mensagens de abertura: saudação no primeiro acesso, recap nas retomadas,
// e contexto de nova fase quando o ciclo recomeça via "Avançar de fase".
export function buildOpening(draft: ArtistContent, artistName: string): string[] {
  const step = draft.step ?? 0;
  const phase = draft.phase || 1;
  const fresh = step <= 0 && !draft.identity?.gender;

  if (fresh && phase <= 1) return SAY.greeting(artistName);

  if (step <= 1 && phase > 1) {
    const label = draft.phaseLabel || getPhaseInfo(phase).label;
    return SAY.newPhase(phase, label);
  }

  const milestones: [number, string][] = [
    [1, 'sua identidade'],
    [2, 'sua visão'],
    [3, 'sua missão'],
    [4, 'seus valores'],
    [5, 'seus objetivos'],
    [6, 'seu diagnóstico'],
    [7, 'suas estratégias'],
    [8, 'suas prioridades'],
    [9, 'o plano de ação'],
  ];
  const done = milestones.filter(([s]) => step >= s).map(([, label]) => label);
  const nextLabels: Record<number, string> = {
    0: 'fechar sua identidade',
    1: 'montar sua visão',
    2: 'definir sua missão',
    3: 'escolher seus valores',
    4: 'definir os objetivos',
    5: 'o diagnóstico',
    6: 'as estratégias',
    7: 'organizar as prioridades',
    8: 'o plano de ação',
    9: 'o resumo final',
  };
  if (!done.length) return SAY.greeting(artistName);
  return SAY.recap(done, nextLabels[Math.min(step, 9)]);
}

// Rótulo curto exibido na barra de progresso/StepNav por step lógico.
// Linguagem do artista, não do consultor: nada de "SWOT" ou "priorização".
export const STEP_LABELS = [
  'Identidade',
  'Visão',
  'Missão',
  'Valores',
  'Objetivos',
  'Diagnóstico',
  'Estratégias',
  'Prioridades',
  'Plano de ação',
  'Seu plano',
] as const;
