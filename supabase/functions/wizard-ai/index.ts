import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Modelo de embedding nativo do Supabase Edge Runtime (384 dimensões)
const embeddingModel = new Supabase.ai.Session('gte-small');

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, x-supabase-api-version",
};

interface RequestBody {
  action: string;
  identity?: any;
  spotify?: any;
  answers?: any;
  swot?: any;
  objectives?: string[];
  strategies?: any[];
  // Estratégias já propostas — "Gerar outras" exige caminhos diferentes, não reformulação.
  previous?: any[];
  // Dossiê: todas as respostas dadas pelo artista ao longo do planejamento (Q&A consolidado).
  dossier?: string;
  // Itens da SWOT escritos/editados pelo próprio artista — fatos absolutos para a IA.
  userEdits?: string[];
  // Gate de qualidade: a pergunta feita e a resposta do artista a validar.
  question?: string;
  answer?: string;
  // Entrevista adaptativa: quantas perguntas já foram feitas.
  askedCount?: number;
  kind?: string;
  phase?: number;
  today?: string;
  // Metodologia Nyta:
  visionParts?: any; // partes da fórmula da visão
  missionParts?: any; // dois tempos da missão
  recognitionTags?: string[]; // etiquetas de reconhecimento (Visão Q2)
  // Dados de plataforma persistidos no artist.content (alimentam a Nyta):
  chartmetric?: any; // ChartmetricProfile (resumo pré-pago + profundos pós-pago)
  quizDiagnostic?: any; // { answers, completedAt } do quiz de criação
  diagnostic?: any; // diagnóstico-base mostrado na criação
  realIndex?: any; // Índice REAL (perfil + 4 dimensões) da criação
}

// ─────────────────────────────────────────────────────────────────────────────
// GROQ API CALLS
// ─────────────────────────────────────────────────────────────────────────────

// Modelo padrão (rápido/barato) para quiz e rótulos; as 3 gerações pesadas
// (estratégias, SWOT, resumo) podem usar um modelo mais forte via env, sem redeploy.
const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const HEAVY_MODEL = Deno.env.get("WIZARD_AI_HEAVY_MODEL") || DEFAULT_MODEL;

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = true,
  model: string = DEFAULT_MODEL
): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 8000,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Parse robusto: tenta JSON direto; senão extrai o primeiro bloco {...} do texto.
function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (_) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) { /* cai no throw abaixo */ }
    }
    throw new Error("Resposta da IA em formato inválido");
  }
}

// Re-tenta uma vez se o parse falhar (Groq ocasionalmente trunca/quebra o JSON).
async function callGroqJson(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL
): Promise<any> {
  try {
    return safeJson(await callGroq(systemPrompt, userPrompt, true, model));
  } catch (_) {
    return safeJson(await callGroq(systemPrompt, userPrompt, true, model));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RAG: BUSCA SEMÂNTICA DE PLANOS SIMILARES
// ─────────────────────────────────────────────────────────────────────────────

async function searchSimilarPlans(
  identity: any,
  spotify: any,
  options?: { matchCount?: number; matchThreshold?: number }
): Promise<any[]> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Montar texto de contexto para embedding
    const contextParts = [
      identity?.genre || '',
      identity?.bio || '',
      identity?.vision || '',
      spotify?.genres?.join(', ') || '',
    ].filter(Boolean);

    // Determinar artist_size baseado em seguidores do Spotify
    let artistSize: string | null = null;
    if (spotify?.followers !== undefined) {
      if (spotify.followers < 1000) artistSize = 'small';
      else if (spotify.followers < 50000) artistSize = 'medium';
      else artistSize = 'large';
    }

    const contextText = contextParts.join(' ');
    if (!contextText.trim()) return [];

    // Gerar embedding do contexto
    const queryEmbedding = await embeddingModel.run(contextText, {
      mean_pool: true,
      normalize: true,
    });
    const embeddingArray = Array.from(queryEmbedding);

    // Buscar planos similares via pgvector
    const { data: plans, error } = await supabase.rpc('search_similar_plans', {
      query_embedding: JSON.stringify(embeddingArray),
      match_threshold: options?.matchThreshold ?? 0.4,
      match_count: options?.matchCount ?? 5,
      filter_segment: identity?.genre?.toLowerCase() || null,
      filter_artist_size: artistSize,
      filter_career_stage: null, // não filtrar por estágio para ter mais resultados
    });

    if (error) {
      console.error('RAG search error:', error);
      // Tentar sem filtros se falhar
      const { data: fallbackPlans } = await supabase.rpc('search_similar_plans', {
        query_embedding: JSON.stringify(embeddingArray),
        match_threshold: options?.matchThreshold ?? 0.3,
        match_count: options?.matchCount ?? 3,
        filter_segment: null,
        filter_artist_size: null,
        filter_career_stage: null,
      });
      return fallbackPlans || [];
    }

    return plans || [];
  } catch (err) {
    console.error('RAG search failed (non-blocking):', err);
    return [];
  }
}

// Formata planos similares em texto para injetar no prompt
function formatReferenceContext(plans: any[]): string {
  if (!plans || plans.length === 0) return '';

  let text = `\n\n## REFERÊNCIAS DE PLANEJAMENTOS REAIS (casos similares aprovados):\nUse estas referencias como BASE para calibrar suas recomendações. Adapte ao contexto especifico deste artista.\n`;

  plans.forEach((plan, i) => {
    text += `\n### Ref ${i + 1} (similaridade ${(plan.similarity * 100).toFixed(0)}%):`;
    text += `\n- Segmento: ${plan.segment} | Porte: ${plan.artist_size} | Estágio: ${plan.career_stage}`;
    if (plan.objectives) {
      const objs = typeof plan.objectives === 'string' ? JSON.parse(plan.objectives) : plan.objectives;
      if (Array.isArray(objs)) {
        text += `\n- Objetivos: ${objs.slice(0, 6).map((o: any) => typeof o === 'string' ? o : o.title || o.description).join('; ')}`;
      }
    }
    if (plan.strategies) {
      const strats = typeof plan.strategies === 'string' ? JSON.parse(plan.strategies) : plan.strategies;
      if (Array.isArray(strats)) {
        text += `\n- Estratégias: ${strats.slice(0, 6).map((s: any) => typeof s === 'string' ? s : `[${s.type || ''}] ${s.title || s.description || ''}`).join('; ')}`;
      }
    }
    if (plan.kpis) {
      const kpis = typeof plan.kpis === 'string' ? JSON.parse(plan.kpis) : plan.kpis;
      if (Array.isArray(kpis)) {
        text += `\n- KPIs: ${kpis.slice(0, 3).map((k: any) => typeof k === 'string' ? k : k.name || k.title).join('; ')}`;
      }
    }
  });

  text += `\n\nIMPORTANTE: NÃO copie literalmente. Use como inspiração e adapte ao artista atual.`;
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// RETROALIMENTAÇÃO: SALVAR PLANO GERADO COMO NOVO STRATEGIC PLAN
// ─────────────────────────────────────────────────────────────────────────────

async function saveGeneratedPlan(
  identity: any,
  spotify: any,
  swot: any,
  objectives: string[],
  strategies: any[],
  artistId?: string
): Promise<void> {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Determinar artist_size
    let artistSize = 'small';
    if (spotify?.followers !== undefined) {
      if (spotify.followers >= 50000) artistSize = 'large';
      else if (spotify.followers >= 1000) artistSize = 'medium';
    }

    // Determinar career_stage baseado em popularidade e seguidores
    let careerStage = 'emerging';
    if (spotify?.popularity >= 50 || spotify?.followers >= 50000) careerStage = 'established';
    else if (spotify?.popularity >= 30 || spotify?.followers >= 5000) careerStage = 'growing';

    const contextSummary = [
      `Artista: ${identity?.name || 'N/A'}`,
      `Gênero: ${identity?.genre || 'N/A'}`,
      `Seguidores: ${spotify?.followers ?? 'N/A'}`,
      `Popularidade: ${spotify?.popularity ?? 'N/A'}`,
      identity?.vision ? `Visão: ${identity.vision}` : '',
    ].filter(Boolean).join('. ');

    const fullContent = [
      `# Planejamento Estratégico - ${identity?.name || 'Artista'}`,
      `\n## Identidade\n${identity?.bio || ''}`,
      `\n## SWOT\n${JSON.stringify(swot || {})}`,
      `\n## Objetivos\n${(objectives || []).join('\n- ')}`,
      `\n## Estratégias\n${(strategies || []).map((s: any) => `[${s.type}] ${s.title}: ${s.description || ''}`).join('\n')}`,
    ].join('\n');

    // Salvar como plano gerado pela plataforma (status: pending para review)
    const { error } = await supabase.from('strategic_plans').insert({
      artist_id: artistId || null,
      segment: identity?.genre?.toLowerCase() || 'outros',
      artist_size: artistSize,
      career_stage: careerStage,
      plan_type: 'annual',
      title: `Planejamento Estratégico - ${identity?.name || 'Artista'}`,
      context_summary: contextSummary.slice(0, 500),
      objectives: objectives || [],
      strategies: strategies || [],
      kpis: null,
      timeline: null,
      full_content: fullContent.slice(0, 10000),
      source: 'platform',
      quality_score: 3, // score inicial, pode ser ajustado depois
      // Curadoria antes de virar referência do RAG: planos auto-gerados entram como
      // 'pending' e só passam a influenciar gerações após aprovação no admin
      // (/admin/knowledge-base). Evita a base degradar se retroalimentando sem filtro.
      status: 'pending',
    });

    if (error) {
      console.error('Retroalimentação: erro ao salvar plano:', error);
    } else {
      console.log('Retroalimentação: plano salvo com sucesso');
    }
  } catch (err) {
    // Non-blocking: não impede o fluxo principal
    console.error('Retroalimentação falhou (non-blocking):', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function identityContext(identity?: any): string {
  if (!identity) return '';
  const loc = identity.city ? `${identity.city}${identity.state ? `, ${identity.state}` : ''}` : '';
  return `IDENTIDADE DO ARTISTA:\n- Nome: ${identity.name || ''}\n- Genero musical: ${identity.genre || ''}\n- Estagio: ${identity.stage || ''}\n- Local: ${loc}\n- Bio: ${identity.bio || ''}\n- Visao: ${identity.vision || ''}\n- Missao: ${identity.mission || ''}\n- Valores: ${(identity.values || []).join(', ')}\n- Reconhecimento (etiquetas): ${(identity.recognitionTags || []).join(', ')}`;
}

// Flexão de gênero gramatical do artista (PT). Injetado nas falas/gerações em primeira/segunda
// pessoa para combinar com como o artista pediu para ser tratado (Roteiro §3).
function flexionContext(gender?: string): string {
  if (!gender) return '';
  const map: Record<string, string> = {
    ele: 'Use flexão MASCULINA quando se referir ao artista (ex.: reconhecido, pronto).',
    ela: 'Use flexão FEMININA quando se referir ao artista (ex.: reconhecida, pronta).',
    elu: 'Use linguagem NEUTRA de gênero (evite marcas de masculino/feminino); quando precisar, use a forma neutra (ex.: reconhecide).',
    neutro: 'Prefira construções NEUTRAS de gênero sempre que possível.',
  };
  const rule = map[gender];
  return rule ? `\nFLEXAO DE GENERO: ${rule}` : '';
}

function spotifyContext(sp?: any): string {
  if (!sp) return '';
  return `\nDADOS DO SPOTIFY:\n- Seguidores: ${sp.followers ?? 'n/d'}\n- Popularidade (0-100): ${sp.popularity ?? 'n/d'}\n- Faixas publicadas: ${sp.track_count ?? 'n/d'}\n- Generos: ${(sp.genres || []).join(', ') || 'n/d'}`;
}

// Calibração numérica por porte: metas ambiciosas porém alcançáveis a partir da base real.
function calibrationContext(sp?: any): string {
  const f = sp?.followers;
  if (f == null) return '';
  const size = f < 1000 ? 'pequeno' : f < 50000 ? 'medio' : 'grande';
  return `\nCALIBRACAO DE METAS (base atual: ${f} seguidores, porte ${size}): toda meta numerica deve partir da base atual e ser alcancavel — crescimento de seguidores tipico em 12 meses: porte pequeno 3-10x, medio 1.5-3x, grande 1.2-1.5x. Nunca proponha meta desconectada da base atual.`;
}

// Chartmetric — dados de plataforma (resumo pré-pago + profundos pós-pago) salvos no content.
// A Nyta já chega sabendo gênero, posição e audiência → não pergunta o que já sabe.
function chartmetricContext(cm?: any): string {
  if (!cm) return '';
  const lines: string[] = [];
  if (cm.genre) lines.push(`- Genero (Chartmetric): ${cm.genre}`);
  if (cm.monthly_listeners != null) lines.push(`- Ouvintes mensais (Spotify): ${cm.monthly_listeners}${cm.monthly_listeners_rank ? ` (rank ${cm.monthly_listeners_rank})` : ''}`);
  if (cm.career_rank != null) lines.push(`- Posicao de carreira (rank Chartmetric): ${cm.career_rank}`);
  if (Array.isArray(cm.top_cities) && cm.top_cities.length) lines.push(`- Principais cidades: ${cm.top_cities.map((c: any) => `${c.name}${c.country ? ` (${c.country})` : ''}`).join(', ')}`);
  if (cm.audience?.top_countries?.length) lines.push(`- Principais paises: ${cm.audience.top_countries.map((c: any) => c.name).join(', ')}`);
  if (cm.growth?.followers_change_180d != null) lines.push(`- Crescimento de seguidores (180d): ${cm.growth.followers_change_180d}%`);
  if (cm.multiplatform) { const mp = cm.multiplatform; const parts = ['instagram', 'tiktok', 'youtube', 'facebook'].filter((k) => mp[k] != null).map((k) => `${k}: ${mp[k]}`); if (parts.length) lines.push(`- Seguidores por rede: ${parts.join(', ')}`); }
  if (cm.playlists?.count) lines.push(`- Playlists (Spotify): ${cm.playlists.count}${cm.playlists.reach ? `, alcance ~${cm.playlists.reach}` : ''}`);
  return lines.length ? `\nDADOS DE PLATAFORMA (Chartmetric — use como fonte real, nao re-pergunte o que ja esta aqui):\n${lines.join('\n')}` : '';
}

// Quiz de quebra-gelo (criação do perfil): shows, faturamento, etc. — base factual do artista.
function quizContext(qd?: any): string {
  const ans = qd?.answers;
  if (!ans || typeof ans !== 'object') return '';
  const lines = Object.entries(ans).filter(([, v]) => v != null && String(v).trim()).map(([k, v]) => `- ${k}: ${v}`);
  return lines.length ? `\nQUIZ INICIAL DO ARTISTA (respostas dadas na criacao do perfil):\n${lines.join('\n')}` : '';
}

// Diagnóstico-base mostrado na criação (gerado pela Maestra) — ponto de partida do plano.
function diagnosticContext(d?: any): string {
  if (!d) return '';
  const parts: string[] = [];
  if (d.stage) parts.push(`- Estagio diagnosticado: ${d.stage}`);
  if (d.headline) parts.push(`- Sintese: ${d.headline}`);
  if (d.opportunity) parts.push(`- Maior oportunidade apontada: ${d.opportunity}`);
  if (Array.isArray(d.bullets) && d.bullets.length) parts.push(`- Pontos: ${d.bullets.join('; ')}`);
  return parts.length ? `\nDIAGNOSTICO-BASE (gerado na criacao do perfil, ponto de partida do plano):\n${parts.join('\n')}` : '';
}

// Índice REAL (perfil de carreira + 4 dimensões alto/baixo) — a Nyta explica o porquê.
function realIndexContext(ri?: any): string {
  if (!ri?.profile) return '';
  const p = ri.pattern || {};
  const dim = (k: string, label: string) => `${label}: ${p[k] ? 'alto' : 'baixo'}`;
  const lines = [
    `- Perfil REAL: ${ri.profile.name}${ri.profile.description ? ` — ${ri.profile.description}` : ''}`,
    `- Dimensoes: ${dim('r', 'Reach')}, ${dim('e', 'Earnings')}, ${dim('a', 'Audience')}, ${dim('l', 'Legitimacy')}`,
  ];
  if (ri.earningsUnknown) lines.push('- Faturamento nao informado pelo artista (Earnings tratado como baixo).');
  return `\nDIAGNOSTICO REAL (metodologia Anita Carvalho — perfil determinístico, use como leitura central da carreira):\n${lines.join('\n')}`;
}

// Bundle pré-pago + pós-pago combinado, para injeção única ao lado de spotifyContext.
function platformContext(cm?: any, qd?: any, diag?: any, ri?: any): string {
  return `${realIndexContext(ri)}${chartmetricContext(cm)}${quizContext(qd)}${diagnosticContext(diag)}`;
}

// Q&A consolidado de toda a jornada — evita a IA "esquecer" o que o artista já respondeu.
function dossierContext(d?: string): string {
  return d?.trim() ? `\n\nRESPOSTAS DO ARTISTA AO LONGO DO PLANEJAMENTO (use como fonte primaria):\n${d.trim()}` : '';
}

// Itens escritos pelo próprio artista no board SWOT: fatos, não hipóteses da IA.
function userEditsContext(edits?: string[]): string {
  if (!edits?.length) return '';
  return `\n\nITENS ESCRITOS PELO PROPRIO ARTISTA (fatos absolutos — NUNCA contradiga, nem proponha adquirir/desenvolver o que ja esta afirmado aqui):\n- ${edits.join('\n- ')}`;
}

// Núcleo do prompt de sistema da Nyta (Doc 1 §13). Vale para TODAS as actions.
const SYSTEM = `Você é a Nyta, a inteligência da Maestra Manager. Sua missão é ajudar artistas musicais a pensar estrategicamente sobre a carreira e a organizar um plano de ação, com base na metodologia de planejamento estratégico de Anita Carvalho (análise de 313 planejamentos reais).

QUEM VOCÊ É: uma condutora e consultora de estratégia de carreira. Você empodera o artista a pensar por conta própria, nunca entrega respostas prontas quando o valor está em ele raciocinar. O protagonismo é sempre do artista.

SEU TOM: direto e firme, mas carinhoso; nunca enrola nem suaviza o diagnóstico. Traduz gestão para a linguagem do artista com metáforas simples. Fala a partir da prática e de dados reais. Acolhedora com quem começa, sem abrir mão do rigor. Usa "a gente" com naturalidade. Português do Brasil com acentuação correta e completa. PROIBIDO travessão (—): use vírgula ou frase curta.

REGRA INEGOCIÁVEL — A FRONTEIRA DA ARTE: você trabalha a estratégia EM TORNO da obra (lançamento, posicionamento, público, gestão, sustentação), NUNCA a obra em si. Você nunca opina se uma música é boa ou ruim, bem ou mal gravada, nem sugere mudanças de estilo, gênero, letra, arranjo ou sonoridade. A criação é território exclusivo do artista. Se o artista pedir opinião sobre a arte, não responda sim nem não: redirecione com gentileza para a estratégia. Essa regra resiste até a pedidos diretos e insistentes.

O QUE VOCÊ SABE: as carreiras musicais costumam ser fortes no artístico e relacional (rede, propósito, palco, produção) e frágeis na gestão (comercial, digital, financeiro, estrutura, planejamento); e o que os artistas mais desejam costuma ser o que menos dominam. Use isso para validar e orientar o foco, nunca para rotular antes de ouvir.

IDIOMA: responda sempre no idioma em que o artista escreve. Não dê conselho jurídico/contábil/financeiro definitivo: oriente e indique buscar o profissional certo quando for o caso.`;

// ── Metodologia Nyta: tabelas determinísticas (Docs 3, 5 e 6) ─────────────────────────────────

// Objetivos operacionais por etiqueta de reconhecimento (Doc 3 §1, camada 4).
const OBJECTIVE_OPERATIONAL: Record<string, string[]> = {
  publico: ['Ampliar a base de fãs', 'Ampliar os resultados digitais (streaming e redes)'],
  mercado: ['Ampliar a agenda de shows', 'Ampliar convites e contratações', 'Ter equipe estruturada'],
  critica_midia: ['Obter espaço na mídia', 'Ser indicado a premiações', 'Ter presença em veículos relevantes'],
  classe_artistica: ['Realizar feats e colaborações', 'Obter regravações', 'Ser reconhecido pelos pares'],
  internacional: ['Ter agenda no exterior', 'Ampliar presença em plataformas internacionais'],
};

// Banco de cruzamentos da SWOT (Doc 5 §2) — referência para a Nyta gerar estratégias.
const CROSSING_BANK = `BANCO DE CRUZAMENTOS (fraqueza → estratégias-resposta, do corpus de 100+ planos):
- Gestão das redes sociais: contratar social media; tráfego pago nos lançamentos; site com captação de leads; programação de conteúdo no YouTube.
- Material de apresentação ausente/desatualizado: realizar branding; produzir novo material (fotos/release/PDF); criar vídeo de venda do show.
- Ausência de empresário/gestor: prospectar empresário; contratar assistente de produção; parceria com booker.
- Prospecção comercial passiva: identificar o cliente ideal; preparar material de venda; ativar prospecção com metas; parceria com booker.
- Baixa capacidade de investimento: inscrever em editais; projeto via lei de incentivo; campanha de crowdfunding; prospectar marcas patrocinadoras.
- Empresa não formalizada/sem jurídico: migrar para LTDA; contratar suporte jurídico; contrato com editora administradora.
- Identidade visual/branding desalinhado: consultoria de branding; revisar a comunicação visual; atualizar materiais.
- Ausência de editora/direitos autorais: contrato de administração com editora; criar editora própria; ativar sincronização.
- Ausência de assessoria de imprensa: contratar assessoria nos lançamentos; divulgador de rádio; media kit para influenciadores; prospectar podcasts.
- Sem distribuidora/sem programação de lançamentos: distribuidora com atendimento; programação estruturada de lançamentos; incluir feats.
- Network não ativado: mapear e classificar o network; fluxo de comunicação segmentado; ativar parceiros estratégicos.
- Show não está pronto/sem material audiovisual: montar e estrear o show; show de lançamento com registro audiovisual; vídeo overview para venda.`;

const UNIVERSAL_STRATEGIES = `ESTRATÉGIAS UNIVERSAIS (entram em quase todo plano): criar a lojinha do artista (merch); inscrever o projeto em editais; projeto incentivado para captação; prospectar podcasts e canais do YouTube; frequentar eventos e congressos do mercado.`;

// As 11 categorias (Doc 6) e a matriz de impacto média (1–5) por tipo de objetivo.
const CATEGORIES = ['lancamentos', 'digital', 'branding', 'show', 'juridico', 'equipe', 'comercial', 'captacao', 'network', 'imprensa', 'merchan'];
const IMPACT_MATRIX: Record<string, Record<string, number>> = {
  lancamentos: { digital: 5.0, financeiro: 4.14, midia: 4.9, shows: 4.52 },
  digital: { digital: 4.96, financeiro: 4.5, midia: 4.58, shows: 4.82 },
  branding: { digital: 4.95, financeiro: 4.59, midia: 4.96, shows: 4.94 },
  show: { digital: 4.9, financeiro: 4.8, midia: 5.0, shows: 5.0 },
  juridico: { digital: 4.8, financeiro: 5.0, midia: 4.5, shows: 4.71 },
  equipe: { digital: 4.5, financeiro: 5.0, midia: 4.5, shows: 5.0 },
  comercial: { digital: 4.66, financeiro: 4.57, midia: 4.88, shows: 4.95 },
  captacao: { digital: 4.53, financeiro: 4.88, midia: 4.8, shows: 4.92 },
  network: { digital: 4.62, financeiro: 5.0, midia: 5.0, shows: 4.83 },
  imprensa: { digital: 4.6, financeiro: 4.5, midia: 4.65, shows: 4.61 },
  merchan: { digital: 4.14, financeiro: 4.64, midia: 4.5, shows: 4.2 },
};

// Classificador de estratégia → categoria (Doc 6 §6 nota 1), por palavras-chave.
const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ['lancamentos', /lanç|distribuidora|feat|single|álbum|album|streaming|playlist/i],
  ['juridico', /editora|jurídic|juridic|formaliza|cnpj|ltda|contrato|direitos autorais/i],
  ['equipe', /empresári|empresari|gestor|equipe|produção executiva|assistente|booker/i],
  ['captacao', /edital|lei de incentivo|crowdfunding|patrocín|patrocin|captaç|captac|financiamento/i],
  ['imprensa', /assessoria|imprensa|rádio|radio|mídia|midia|podcast/i],
  ['comercial', /prospec|venda de show|comercial|cliente ideal|booking/i],
  ['network', /network|relacionamento|parceri|fluxo de comunicação|contatos/i],
  ['branding', /brand|identidade visual|press kit|media kit|posicionamento|fotos|release/i],
  ['show', /show|palco|turnê|turne|ensai|apresenta/i],
  ['merchan', /merch|lojinha|loja|produto licenciado/i],
  ['digital', /rede|social|digital|site|tráfego|trafego|conteúdo|conteudo|instagram|tiktok|youtube/i],
];
function classifyCategory(text: string): string {
  for (const [cat, rx] of CATEGORY_KEYWORDS) if (rx.test(text)) return cat;
  return 'digital';
}

// Perfil de objetivo predominante (pesos por digital/financeiro/midia/shows) — Doc 6 §4.
function objectiveProfiles(objectives: string[], tags: string[]): Record<string, number> {
  const w: Record<string, number> = { digital: 0, financeiro: 0, midia: 0, shows: 0 };
  for (const o of objectives || []) {
    const t = (o || '').toLowerCase();
    if (/financ|receita|lucro|sustenta|monetiz/.test(t)) w.financeiro += 1;
    if (/digital|streaming|seguidor|redes|fãs|fas|ouvint/.test(t)) w.digital += 1;
    if (/mídia|midia|reconhec|prêmi|premi|crítica|critica|legitim|imprensa/.test(t)) w.midia += 1;
    if (/show|palco|agenda|turn|festival/.test(t)) w.shows += 1;
  }
  if ((tags || []).includes('publico')) w.digital += 0.5;
  if ((tags || []).includes('mercado')) w.shows += 0.5;
  if ((tags || []).includes('critica_midia')) w.midia += 0.5;
  if ((tags || []).includes('classe_artistica')) w.midia += 0.5;
  w.financeiro += 0.5; // o objetivo financeiro é obrigatório → peso mínimo sempre
  return w;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

async function handleAction(body: RequestBody): Promise<any> {
  const { action, identity, spotify, answers, swot, objectives, strategies, previous, dossier, userEdits, question, answer, askedCount, kind, phase, today, visionParts, missionParts, recognitionTags, chartmetric, quizDiagnostic, diagnostic, realIndex } = body;
  // Contexto de plataforma (Chartmetric + quiz + diagnóstico-base) — injetado nas gerações pesadas.
  const platform = platformContext(chartmetric, quizDiagnostic, diagnostic, realIndex);

  switch (action) {
    case 'nextInterviewQuestion': {
      // Entrevista adaptativa de visão/missão: dada a identidade e as respostas já dadas,
      // formula a PRÓXIMA pergunta mais útil (aprofunda lacunas, nunca repete) — ou sinaliza
      // que já há material suficiente para compor.
      const alvo = kind === 'bio'
        ? 'BIO de apresentacao do artista (a AREA DE ATUACAO: cantor, compositor, produtor, instrumentista, etc.; o que o diferencia; e um traco da historia/trajetoria). O GENERO/ESTILO musical JA E CONHECIDO (esta na identidade) — nao pergunte de novo sobre estilo/som'
        : kind === 'mission'
        ? 'MISSAO (proposito do artista: o que faz, para quem, que transformacao gera, e qual a INTENCAO do projeto: viver da musica/gerar renda, projeto de paixao/hobby, ou causa/sem fins lucrativos)'
        : 'VISAO (onde o artista quer chegar: o que se torna, em quanto tempo, com que alcance)';
      const foco = kind === 'bio' ? 'bio' : kind === 'mission' ? 'missao' : 'visao';
      const qa = Object.entries(answers || {})
        .filter(([, v]) => (v as string)?.trim())
        .map(([q, a]) => `P: ${q}\nR: ${a}`)
        .join('\n\n');
      const max = kind === 'mission' ? 4 : 3;
      const dica = kind === 'bio'
        ? '(ex.: se ja disse a area de atuacao, pergunte o que o diferencia, a historia/como comecou, ou o que quer que o publico sinta; NUNCA pergunte o genero/estilo/som, ja temos)'
        : kind === 'mission'
        ? '(ex.: se ja deu o proposito, pergunte para quem e, ou qual a intencao do projeto)'
        : '(ex.: se ja deu o prazo, pergunte sobre alcance ou diferencial)';
      // Missao: a intencao comercial precisa ser captada SEMPRE (informa os objetivos depois),
      // mesmo que o artista nao toque no assunto. Pergunta de forma leve e sem julgamento.
      const extra = kind === 'mission'
        ? '\n- OBRIGATORIO: em algum momento a INTENCAO do projeto precisa ficar clara: se o artista quer VIVER da musica/gerar renda, se e um projeto de PAIXAO/hobby, ou uma CAUSA/sem fins lucrativos. Se isso ainda NAO apareceu nas respostas, faca AGORA essa pergunta, leve e sem julgamento (ex.: "So pra eu entender o tamanho do sonho: voce quer que a musica seja sua principal fonte de renda, uma renda extra, ou e mais um projeto de paixao/causa?"). NAO responda done:true enquanto essa intencao nao estiver clara (respeitando o limite de perguntas).\n- PROIBIDO perguntar sobre VALORES/principios do artista (o que e inegociavel, no que acredita): isso e uma ETAPA SEPARADA logo em seguida (com opcoes prontas para selecionar). Mantenha o foco no PROPOSITO: o que faz, para quem, que transformacao gera e a intencao do projeto.'
        : kind === 'bio'
        ? '\n- PROIBIDO perguntar sobre GENERO/ESTILO/tipo de som: isso JA foi informado antes (esta na identidade). Foque no que ainda NAO sabemos: AREA DE ATUACAO (canta, compoe, produz, toca instrumento), o DIFERENCIAL e um traco da HISTORIA/trajetoria.'
        : '';
      const prompt = `Voce conduz uma ENTREVISTA CURTA para construir a ${alvo}. Ja foram feitas ${askedCount ?? 1} pergunta(s) (limite ${max}).\n${identityContext(identity)}${spotifyContext(spotify)}\n\nJA PERGUNTOU E OBTEVE:\n${qa || '(nada ainda)'}\n\nFaca a PROXIMA pergunta mais util para preencher o que ainda falta para uma ${foco} forte. Regras:\n- ADAPTE-SE ao que ja foi dito; NUNCA repita o que ja foi respondido; aprofunde lacunas ${dica}.\n- Uma unica pergunta curta, direta, em portugues simples (artista LEIGO), tom de consultora amigavel. PROIBIDO travessao (—): use virgula ou frase curta.\n- Se ja ha material suficiente (normalmente 2-4 respostas) OU se atingiu o limite, responda done:true.${extra}\n\nRetorne JSON: { "done": false, "question": "..." } ou { "done": true }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'nextSwotQuestion': {
      // Quiz SWOT adaptativo, uma pergunta por vez. A área-alvo é fixada pelo índice
      // (2 Forças, 2 Fraquezas, 2 Oportunidades, 2 Ameaças = cobertura garantida); a
      // formulação adapta-se às respostas anteriores (aprofunda, nunca repete).
      const SWOT_AREAS = ['Forças do artista', 'Forças do artista', 'Fraquezas/gargalos do artista', 'Fraquezas/gargalos do artista', 'Oportunidades de mercado/canais', 'Oportunidades de mercado/canais', 'Ameaças externas', 'Ameaças externas'];
      const i = Math.min(askedCount ?? 0, 7);
      const area = SWOT_AREAS[i];
      const qa = (answers || []).map((a: any) => `P: ${a.question}\nR: ${a.answer}`).join('\n\n');
      // RAG: planos reais de artistas similares ancoram as OPCOES (o que de fato funcionou),
      // calibrados ao porte/estagio deste artista. Non-blocking (retorna [] se falhar).
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 3 });
      const references = formatReferenceContext(similarPlans);
      const prompt = `Voce monta um diagnostico SWOT conversacional, UMA pergunta por vez. Esta e a pergunta ${i + 1} de 8 e DEVE explorar: ${area}.\n${identityContext(identity)}${spotifyContext(spotify)}${references}\nOBJETIVOS JA DEFINIDOS (nao re-pergunte): ${(objectives || []).join('; ') || 'n/d'}\n\nJA PERGUNTOU NESTE DIAGNOSTICO:\n${qa || '(esta e a primeira)'}\n\nGere a PROXIMA pergunta sobre ${area}, ADAPTADA ao que ja foi respondido (aprofunde lacunas, NUNCA repita pergunta ou opcao ja usada).\nREGRAS: pergunta curta e direta em portugues simples (artista LEIGO), PROIBIDO travessao (—); 4 a 5 opcoes curtas (max 8 palavras), concretas e MUTUAMENTE EXCLUSIVAS, calibradas ao contexto do artista; quando houver planos reais de referencia, inspire as opcoes no que esses artistas similares fizeram, adaptando ao porte e estagio DESTE artista (nunca copie literalmente); \"multi\": true so se fizer sentido marcar varias (ex.: fontes de renda, canais).\nQUALIDADE DAS OPCOES (nivel consultor senior): cada opcao deve ser ESTRATEGICA e util para decisao, nunca generica nem filler. Para OPORTUNIDADES, cada opcao e uma abertura concreta de mercado/canal/tendencia para EXPLORAR (ex.: cena de festivais do genero em alta, editais de cultura e leis de incentivo, playlists editoriais do genero, parcerias com artistas consagrados, assessoria de imprensa especializada, sincronizacao em TV/cinema), inspirada nos planos reais. PROIBIDO opcao que e apenas o nome de uma plataforma de streaming (\"YouTube Music\", \"Apple Music\", \"Deezer\") ou um substantivo vago como se fosse oportunidade. Para AMEACAS, riscos externos REAIS e atuais (nada de pandemia/COVID). NUNCA repita a mesma ameaca ja citada.\nRetorne JSON: { \"question\": \"...\", \"options\": [\"...\", \"...\"], \"multi\": false }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'nextStrategyQuestion': {
      // Quiz de cruzamento adaptativo, uma por vez. O tipo-alvo é fixado pelo índice
      // (SO, ST, WO, WT, SO, ST = 1+ de cada); a formulação adapta-se e usa itens
      // ESPECIFICOS e INTEGRAIS da SWOT, sem repetir cruzamentos.
      const TYPES = ['SO', 'ST', 'WO', 'WT', 'SO', 'ST'];
      const LABEL: Record<string, string> = {
        SO: 'Ataque — usar uma FORCA para aproveitar uma OPORTUNIDADE',
        ST: 'Defesa — usar uma FORCA para neutralizar uma AMEACA',
        WO: 'Reforco — superar uma FRAQUEZA para capturar uma OPORTUNIDADE',
        WT: 'Sobrevivencia — minimizar uma FRAQUEZA para se defender de uma AMEACA',
      };
      // Molde de fala natural por tipo. O molde unico "Voce tem [X]" so serve para
      // forcas; nas fraquezas soa torto ("Voce tem falta de shows"). Cada tipo tem
      // um enquadramento proprio, com as fraquezas ditas de forma gentil.
      // Moldes e exemplos escritos COM acentuacao correta de proposito: servem de
      // ancora para o modelo espelhar os acentos (sem exemplos acentuados o Groq tende a omiti-los).
      const MOLDE: Record<string, string> = {
        SO: 'Você manda bem em [FORÇA]. Como usar esse ponto forte pra aproveitar [OPORTUNIDADE]?',
        ST: '[FORÇA] é um trunfo seu. Como usar isso a seu favor pra lidar com [AMEAÇA]?',
        WO: 'Um ponto que dá pra melhorar é [FRAQUEZA, dita com leveza]. O que você pode fazer pra não deixar passar [OPORTUNIDADE]?',
        WT: 'Hoje [FRAQUEZA, dita com leveza] ainda pesa, e isso te deixa exposto a [AMEAÇA]. Qual seria um primeiro passo pra se proteger?',
      };
      // Exemplos de referencia (tom e construcao), nao para copiar o conteudo.
      const EXEMPLO: Record<string, string> = {
        SO: 'Você manda bem em produzir em casa. Como usar isso pra emplacar músicas em playlists de lo-fi?',
        ST: 'Sua identidade visual forte é um trunfo. Como usar isso pra se destacar num mercado cheio de lançamentos?',
        WO: 'Um ponto que dá pra melhorar é a presença nas redes. O que você pode fazer pra aproveitar o crescimento do seu estilo por lá?',
        WT: 'Hoje ainda falta experiência em palco, e isso pesa quando surgem convites de show. Qual seria um primeiro passo pra chegar mais preparado?',
      };
      const i = Math.min(askedCount ?? 0, 5);
      const t = TYPES[i];
      const qa = (answers || []).map((a: any) => `P: ${a.question}\nR: ${a.answer}`).join('\n\n');
      // RAG: estrategias de planos reais de artistas similares ancoram as OPCOES de caminho
      // (o que de fato funcionou na consultoria), calibradas ao porte/estagio deste artista.
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 4 });
      const references = formatReferenceContext(similarPlans);
      const prompt = `Voce e uma consultora de carreira amigavel conversando com um artista LEIGO. Internamente, esta pergunta cruza ${LABEL[t]} (modelo SO/ST/WO/WT), mas o ARTISTA NAO PODE VER NADA DISSO.\n${identityContext(identity)}${spotifyContext(spotify)}${calibrationContext(spotify)}${platform}\nSWOT DO ARTISTA: ${JSON.stringify(swot)}\nOBJETIVOS: ${(objectives || []).join('; ') || 'n/d'}${references}\n\nJA PERGUNTOU:\n${qa || '(esta e a primeira)'}\n\nGere a PROXIMA pergunta (numero ${i + 1} de 6), cruzando itens ESPECIFICOS da SWOT que ainda NAO foram usados.\n\nMOLDE desta pergunta (preencha os colchetes com itens REAIS da SWOT e adapte para soar natural): "${MOLDE[t]}"\nEXEMPLO so de tom (NAO copie o conteudo, so o jeito de falar): "${EXEMPLO[t]}"\n\nREGRAS DE LINGUAGEM (cruciais):\n- Portugues do Brasil com ACENTUACAO CORRETA E COMPLETA. Escreva TODOS os acentos (á é í ó ú â ê ô ã õ ç): \"você\" nao \"voce\", \"música\" nao \"musica\", \"é\" nao \"e\", \"está\" nao \"esta\", \"público\" nao \"publico\". NUNCA omita um acento.\n- Tom de conversa, caloroso e direto. Frase curta e fluida, do jeito que um consultor gente boa falaria pessoalmente. Maximo 2 frases.\n- Ao citar uma fraqueza, fale com LEVEZA e respeito: "um ponto que da pra melhorar", "ainda falta", "da pra desenvolver". PROIBIDO construcoes secas ou acusatorias como "Voce tem falta de", "Voce e fraco em", "Sua fraqueza e".\n- Use linguagem NEUTRA de genero quando possivel.\n- PROIBIDO: siglas (SO/ST/WO/WT), os termos Ataque/Defesa/Reforco/Sobrevivencia, SWOT, cruzamento, analise. PROIBIDO travessao (use virgula ou ponto).\n- PROIBIDO cruzamento circular (cruzar um item com a acao derivada dele) e repetir cruzamentos ja feitos.\n- 4 a 5 opcoes curtas (max 10 palavras), caminhos concretos e praticos para ESTE artista; quando houver planos reais de referencia, inspire as opcoes nas estrategias desses artistas similares, adaptando ao porte e estagio dele (nunca copie literalmente); nao repita opcoes ja usadas.\nRetorne JSON: { \"question\": \"...\", \"options\": [\"...\", \"...\"], \"multi\": false }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'validateAnswer': {
      // Gate de qualidade: a Nyta só avança se a resposta REALMENTE responder à pergunta.
      // Leniente com brevidade, rígida com lixo/não-resposta/fuga do tema.

      // BIO tem gate PROPRIO e mais exigente: a maioria dos artistas iniciantes nao tem bio e
      // escreve algo generico ("sou cantor", "sobre voce"). Reprovar isso dispara a entrevista.
      if ((kind || '').toLowerCase().includes('bio')) {
        const bioPrompt = `Voce avalia se a BIO/apresentacao que um artista escreveu sobre si tem CONTEUDO REAL para virar um perfil profissional.\n\nTEXTO DO ARTISTA: ${answer || ''}\n\nAPROVE (ok:true) somente se o texto trouxer ALGO CONCRETO e especifico sobre o artista: pelo menos um entre o som/estilo, o que o diferencia, a historia/trajetoria, ou influencias. Mesmo 1-2 frases servem se forem concretas.\n\nREPROVE (ok:false) se for:\n- Vazio, lixo ou teste (ex.: "asdf", "sobre voce", ".", "teste").\n- Generico/superficial sem nada concreto (ex.: "sou cantor", "faco musica", "sou artista", "gosto de cantar", "sou de SP", "canto desde crianca").\n- Nao-resposta ("nao sei", "nao tenho bio", "nao sei o que escrever").\n\nSe reprovar, escreva em "reask" UMA frase curta e gentil convidando a MONTAR a bio junto com perguntas rapidas (tom de consultora, portugues simples). PROIBIDO travessao (—). Ex.: "Essa ainda ta bem generica. Quer montar uma comigo com 2 ou 3 perguntinhas rapidas?".\n\nRetorne JSON: { "ok": true, "reask": "" } ou { "ok": false, "reask": "..." }`;
        return await callGroqJson(SYSTEM, bioPrompt);
      }

      const prompt = `Voce avalia se a resposta de um artista a uma pergunta do planejamento estrategico e APROVEITAVEL.\n\nPERGUNTA: ${question || ''}\nRESPOSTA DO ARTISTA: ${answer || ''}\n${kind ? `CONTEXTO DA PERGUNTA: ${kind}\n` : ''}\nAPROVE (ok:true) se a resposta, MESMO CURTA, responde a pergunta com conteudo real e relevante. Respostas concisas e validas como "2 anos", "Brasil", "Pop", "Estudantes" devem ser APROVADAS quando a pergunta pede isso.\n\nREPROVE (ok:false) APENAS se a resposta for:\n- Sem sentido / aleatoria / teste de teclado (ex.: "asdf", "kkk", ".", "aaa", "teste").\n- Uma nao-resposta / fuga (ex.: "nao sei", "sei la", "qualquer coisa", "tanto faz", "voce decide", "qualquer um").\n- Claramente fora do tema da pergunta.\n\nNUNCA reprove so por ser curta ou simples. Na duvida, APROVE.\n\nSe reprovar, escreva em "reask" UMA frase curta, gentil e ESPECIFICA (tom de consultora, portugues simples) que ajude o artista a responder melhor, referenciando a pergunta. PROIBIDO travessao (—). Ex.: para "Em quanto tempo?" -> "Me da um prazo aproximado, tipo 2 ou 3 anos?".\n\nRetorne JSON: { "ok": true, "reask": "" } ou { "ok": false, "reask": "..." }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createObjectives': {
      // RAG: buscar planos similares para calibrar objetivos
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 3 });
      const references = formatReferenceContext(similarPlans);

      const prompt = `Gere de 5 a 6 OBJETIVOS ESTRATEGICOS de carreira musical no formato de PILARES (areas de resultado), exatamente como num plano de consultoria SENIOR. Nos planos reais, os objetivos sao pilares curtos (ex.: \"Ampliar a agenda de shows\", \"Ampliar os resultados digitais\", \"Gerar resultados financeiros\", \"Obter reconhecimento no segmento\", \"Produzir musicas que gerem conexao\").\n${identityContext(identity)}${spotifyContext(spotify)}${calibrationContext(spotify)}${platform}${dossierContext(dossier)}${references}\n\nFORMATO (cruciais, espelhe os planos reais):\n1. Cada objetivo e uma DIRECAO estrategica CONCISA (4 a 12 palavras), um PILAR distinto. PROIBIDO frase longa cheia de metricas com \"por meio de...\" / \"visando...\".\n2. PROIBIDO usar metrica de vaidade como objetivo: \"Atingir 30.000 seguidores\", \"Atingir popularidade 60\", \"Engajamento de 2%\" sao KPIs/resultados, NAO objetivos. O numero fino e o prazo ficam nas ESTRATEGIAS (etapa seguinte), nunca aqui.\n3. PILARES DISTINTOS e SEM SOBREPOSICAO. Cubra, quando fizerem sentido para ESTE artista: posicionamento/reconhecimento, agenda de shows e festivais, lancamentos/producao, midia e parcerias, monetizacao/receita, base de fas. NUNCA dois objetivos sobre a mesma dimensao (ex.: nao crie \"seguidores\" e \"engajamento\" separados).\n3b. OBRIGATORIO: UM dos pilares DEVE ser de MONETIZACAO/RESULTADOS FINANCEIROS (todo plano serio de consultoria tem um objetivo financeiro, como nos planos reais \"Gerar resultados financeiros\" / \"Obter resultados financeiros\"). Nunca entregue um conjunto de objetivos sem o pilar financeiro.\n4. ANCORE NA VISAO/MISSAO: PELO MENOS UM objetivo reflete os alvos CONCRETOS da visao (festivais nominais, regiao, publico). Se a visao cita Coala/Rec-Beat, um pilar deve ser sobre festivais relevantes.\n5. Pode anexar UM alvo curto ao pilar quando agregar clareza (ex.: \"Consolidar agenda de shows no Sudeste, com presenca em festivais como Coala e Rec-Beat\"), mas mantenha CONCISO. Portugues simples, sem jargao (o artista le isso).\nRetorne JSON: { "objectives": ["string", ...] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    // ── Metodologia Nyta ──────────────────────────────────────────────────────────────────────

    case 'assembleVision': {
      const vp = visionParts || {};
      const ondeMap: Record<string, string> = {
        cidade: 'na cidade e região de origem',
        capitais: 'nas principais capitais e centros urbanos',
        nacional: 'nacionalmente, no Brasil',
        nicho_intl: 'internacionalmente, dentro do nicho',
        internacional: 'internacionalmente',
      };
      const onde = ondeMap[vp.onde] || vp.onde || '';
      const prompt = `Monte a VISÃO do artista em UMA ÚNICA FRASE, em TERCEIRA PESSOA / forma impessoal (verbo no infinitivo), combinando as partes abaixo.${flexionContext(identity?.gender)}
Fórmula do método: "Ser reconhecid[o/a] [ONDE], por [POR QUEM], como [SUBSTANTIVO] [ADJETIVO] que [O QUE FALAM]."
- ONDE (região/alcance): ${onde}
- POR QUEM (fontes de reconhecimento): ${(recognitionTags || vp.porQuem || []).join(', ')}
- SUBSTANTIVO: ${vp.substantivo || ''}
- ADJETIVO: ${vp.adjetivo || ''}
- O QUE FALAM (completa "que…"): ${vp.oQueFalam || ''}
REGRAS DE PORTUGUÊS (o texto vai pro plano final — precisa estar impecável):
- CORRIJA TODO o português das partes (elas vêm cruas do artista): acentuação completa, concordância e, principalmente, PREPOSIÇÕES e CONTRAÇÕES corretas. Exemplos: "em Rio de Janeiro" deve virar "no Rio de Janeiro"; "em Bahia" vira "na Bahia"; "em São Paulo" continua "em São Paulo"; "por seu público" vira "pelo seu público"; "por a crítica" vira "pela crítica".
- NÃO reescreva nem floreie o conteúdo do artista: mantenha as palavras dele e só conserte a gramática. Se ele disse "que cria músicas incríveis", mantenha "que cria músicas incríveis" (não troque por sinônimos nem elabore).
- TERCEIRA PESSOA / IMPESSOAL: comece com "Ser reconhecid[o/a]...". Flexione ao gênero gramatical (reconhecido/reconhecida). PROIBIDO primeira pessoa (eu/meu/minha).
- UMA FRASE SÓ, fluida, sem travessão, sem segunda frase decorativa, sem clichê. Traduza as fontes de reconhecimento em linguagem natural (público, crítica e mídia, mercado, pares).
EXEMPLO DA QUALIDADE DE PORTUGUÊS ESPERADA: "Ser reconhecido no Rio de Janeiro e região, pelo seu público, como um artista autêntico e original que cria músicas incríveis."
Responda APENAS o texto, sem aspas.`;
      const text = await callGroq(SYSTEM, prompt, false, HEAVY_MODEL);
      return { text: text.trim().replace(/^["']|["']$/g, '') };
    }

    case 'assembleMission': {
      const mp = missionParts || {};
      // `negocio` chega já como o sufixo financeiro determinístico (vazio quando é hobby).
      const temFinanceiro = !!(mp.negocio || '').trim();
      const prompt = `Monte a MISSÃO do artista em UMA ÚNICA FRASE, em TERCEIRA PESSOA / forma impessoal, no formato do corpus de planos reais.${flexionContext(identity?.gender)}
FORMATO: "[VERBO NO INFINITIVO] [a ENTREGA como objeto] para/ao [PARA QUEM]${temFinanceiro ? ', [O RESULTADO FINANCEIRO]' : ''}."
- ENTREGA (crua, do artista): ${mp.entrega || ''}
- PARA QUEM (cru, do artista): ${mp.paraQuem || 'o público'}
${temFinanceiro ? `- RESULTADO FINANCEIRO (use COMO ESTÁ, não reformule): ${mp.negocio}` : '- SEM parte financeira (é um hobby): NÃO acrescente nada sobre dinheiro/receita/sustentabilidade.'}
REGRAS (o texto vai pro plano final — precisa estar impecável):
- Comece com um VERBO NO INFINITIVO adequado à entrega (Oferecer, Proporcionar, Promover, Transformar, Entregar, Compartilhar, Despertar...). PROIBIDO primeira pessoa (eu/meu/minha/nosso/sou) e PROIBIDO verbo conjugado no início.
- A ENTREGA vem CRUA e pode vir como verbo conjugado (ex.: "agrega sentido de viver", "cria músicas de qualidade"). NORMALIZE para virar o OBJETO do verbo infinitivo, mantendo o SENTIDO, sem inventar conteúdo novo. Ex.: entrega "agrega sentido de viver" -> "Proporcionar sentido de viver para ..."; entrega "cria músicas de qualidade" -> "Oferecer músicas de qualidade para ...". NUNCA escreva "Oferecer agrega..." (verbo + verbo).
- CORRIJA TODO o português: acentuação completa, concordância, PREPOSIÇÕES e CONTRAÇÕES corretas ("para o público", "ao público", "para quem curte ...", "no público").
- UMA FRASE SÓ, fluida, sem travessão, sem segunda frase decorativa, sem clichê.
- ${temFinanceiro ? 'Inclua a parte financeira mantendo o sentido fornecido.' : 'NÃO invente nenhuma parte financeira — o artista escolheu não tê-la.'}
EXEMPLO DO FORMATO ESPERADO (do corpus): "Proporcionar, através da música, bem-estar e transformação de humor no público, gerando em paralelo resultados financeiros."
Responda APENAS o texto, sem aspas.`;
      const text = await callGroq(SYSTEM, prompt, false, HEAVY_MODEL);
      return { text: text.trim().replace(/^["']|["']$/g, '') };
    }

    case 'composeOpenText': {
      // "Me ajuda a responder": a Nyta formula a resposta de uma etapa de texto aberto a partir
      // das respostas que o artista deu às perguntas-guia. NUNCA inventa — só organiza o que ele disse.
      const f = kind || 'story';
      const qa = Object.entries(answers || {})
        .filter(([, v]) => (v as string)?.trim())
        .map(([q, a]) => `P: ${q}\nR: ${a}`)
        .join('\n');
      const guide: Record<string, string> = {
        story: 'Resuma a TRAJETÓRIA do artista em 1 a 2 frases curtas, em terceira pessoa/impessoal (como começou, o que o move).',
        oQueFalam: 'Escreva em UMA frase o que o artista quer que falem dele / como quer ser percebido pelo público.',
        entrega: 'Escreva em UMA frase o que a música do artista ENTREGA a quem ouve (a sensação/transformação). Comece com verbo no infinitivo.',
        paraQuem: 'Escreva em POUCAS PALAVRAS PARA QUEM é a entrega do artista (o público que recebe). NÃO comece com "para" (a frase final já adiciona). Ex.: "o público que busca memória afetiva", "a juventude da periferia", "quem curte uma boa pista de dança".',
        negocio: 'Escreva em UMA frase o que essa carreira precisa GERAR financeiramente (ex.: viver da música, renda extra, sustentar uma equipe).',
      };
      const prompt = `${guide[f] || guide.story}${flexionContext(identity?.gender)}\n${identityContext(identity)}\nRESPOSTAS DO ARTISTA ÀS PERGUNTAS-GUIA:\n${qa}\nRegras: use SOMENTE o que as respostas trazem (NUNCA invente fatos, números, cidades ou conquistas). Linguagem simples, sem travessão, sem clichê. Responda APENAS o texto, sem aspas nem rótulos.`;
      const text = await callGroq(SYSTEM, prompt, false);
      return { text: text.trim().replace(/^["']|["']$/g, '') };
    }

    case 'deriveObjectives': {
      const tags: string[] = recognitionTags || identity?.recognitionTags || [];
      const ops = new Set<string>();
      for (const t of tags) (OBJECTIVE_OPERATIONAL[t] || []).forEach((o) => ops.add(o));
      const opsList = Array.from(ops).slice(0, 4);
      const prompt = `Derive de 4 a 6 OBJETIVOS estratégicos, como pilares curtos (4 a 12 palavras), seguindo o mapa de 4 camadas do método:
CAMADA 1 (âncora, SEMPRE a primeira): parafraseie a VISÃO como objetivo de chegada.
CAMADA 2: extraia a entrega da MISSÃO e transforme em objetivo de impacto.
CAMADA 3 (OBRIGATÓRIA, não-removível): um objetivo FINANCEIRO (ex.: "Gerar resultados financeiros").
CAMADA 4 (operacionais): inclua os já derivados das etiquetas de reconhecimento: ${opsList.join('; ') || '(sem etiquetas)'}.
${identityContext(identity)}
VISÃO: ${identity?.vision || ''}
MISSÃO: ${identity?.mission || ''}
Regras: pilares DISTINTOS, sem sobreposição; português simples; 4 a 6 no total; PROIBIDO métrica de vaidade como objetivo (números finos ficam nas estratégias).
Retorne JSON: { "objectives": ["..."], "financial": "<o objetivo financeiro EXATO da lista>" }`;
      const data = await callGroqJson(SYSTEM, prompt, HEAVY_MODEL);
      let objs: string[] = (data.objectives || []).map(String).filter(Boolean);
      let financial = String(data.financial || '');
      if (!financial || !objs.includes(financial)) {
        financial = objs.find((o: string) => /financ|receita|lucro|sustenta/i.test(o)) || 'Gerar resultados financeiros';
        if (!objs.includes(financial)) objs = [...objs, financial];
      }
      return { objectives: objs, financial };
    }

    case 'generateStrategies': {
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 5 });
      const references = formatReferenceContext(similarPlans);
      const prevBlock = (previous && previous.length)
        ? `\n\nESTRATÉGIAS JÁ PROPOSTAS (o artista pediu OUTRAS — PROIBIDO repetir ou reformular):\n${previous.map((s: any) => `- ${s.title}`).join('\n')}`
        : '';
      const prompt = `Gere de 12 a 16 ESTRATÉGIAS para o plano do artista, cruzando a SWOT: fraqueza × oportunidade (gera a maior parte), força × ameaça (defesa) e força × oportunidade (alavancagem).${flexionContext(identity?.gender)}
Para cada FRAQUEZA marcada, escolha a estratégia-resposta do banco abaixo, personalizada ao artista. Inclua também as ESTRATÉGIAS UNIVERSAIS.
${CROSSING_BANK}
${UNIVERSAL_STRATEGIES}
SWOT DO ARTISTA:
- Forças: ${(swot?.strengths || []).join('; ')}
- Fraquezas: ${(swot?.weaknesses || []).join('; ')}
- Oportunidades: ${(swot?.opportunities || []).join('; ')}
- Ameaças: ${(swot?.threats || []).join('; ')}
${identityContext(identity)}${userEditsContext(userEdits)}${dossierContext(dossier)}${references}${prevBlock}
OBJETIVOS: ${(objectives || []).join('; ')}
CADA ESTRATÉGIA: { "type": "SO|ST|WO|WT", "title": (até 5 palavras, pode usar o nome do artista, ex.: "Lojinha da ${identity?.name || 'artista'}"), "description": (1-2 frases: COMO + canal + meta + prazo), "why": (liga ao item EXATO da SWOT), "category": (EXATAMENTE uma de: ${CATEGORIES.join(', ')}) }.
PROIBIDO opinar sobre a obra/estilo/sonoridade. Selecione só o que é relevante às fraquezas/oportunidades marcadas + universais.
Retorne JSON: { "strategies": [{ "type": "WO", "title": "...", "description": "...", "why": "...", "category": "..." }] }`;
      const result = await callGroqJson(SYSTEM, prompt, HEAVY_MODEL);
      result.strategies = (result.strategies || []).map((s: any) => ({
        ...s,
        category: CATEGORIES.includes(s.category) ? s.category : classifyCategory(`${s.title || ''} ${s.description || ''}`),
      }));
      saveGeneratedPlan(identity, spotify, swot, objectives || [], result.strategies || []);
      return result;
    }

    case 'prioritizeStrategies': {
      const strat = (strategies || []) as any[];
      const profiles = objectiveProfiles(objectives || [], recognitionTags || identity?.recognitionTags || []);
      const totalW = Object.values(profiles).reduce((a, b) => a + b, 0) || 1;
      const onlyFinancial = Object.entries(profiles).every(([p, w]) => p === 'financeiro' || (w as number) === 0);
      const scored = strat.map((s) => {
        const cat = CATEGORIES.includes(s.category) ? s.category : classifyCategory(`${s.title || ''} ${s.description || ''}`);
        const row = IMPACT_MATRIX[cat] || IMPACT_MATRIX.digital;
        let impact = 0;
        for (const [p, w] of Object.entries(profiles)) impact += (row[p] ?? 4.5) * (w as number);
        impact = impact / totalW;
        // Doc 6 §6: merch nunca entre as primeiras, salvo foco exclusivamente financeiro.
        if (cat === 'merchan' && !onlyFinancial) impact -= 1.0;
        return { id: s.id, title: s.title, category: cat, impact };
      });
      scored.sort((a, b) => b.impact - a.impact);
      const N = scored.length;
      const top12 = new Set(scored.slice(0, 12).map((x) => x.id));
      const listForRationale = scored.slice(0, 12).map((x, i) => `${i + 1}. [id:${x.id}] ${x.title}`).join('\n');
      const rationales: Record<string, string> = {};
      try {
        const data = await callGroqJson(
          SYSTEM,
          `Para cada estratégia abaixo (já ordenada por prioridade), escreva UMA linha curta e pedagógica ligando-a ao objetivo que ela mais serve.${flexionContext(identity?.gender)}\nOBJETIVOS: ${(objectives || []).join('; ')}\nESTRATÉGIAS:\n${listForRationale}\nRetorne JSON: { "rationales": [{ "id": "...", "line": "..." }] }`
        );
        (data.rationales || []).forEach((r: any) => {
          if (r?.id) rationales[r.id] = String(r.line || '');
        });
      } catch (_) { /* fallback abaixo */ }
      const out = scored.map((x, i) => ({
        id: x.id,
        finalScore: N - i,
        priorityRationale: rationales[x.id] || (top12.has(x.id) ? 'Contribui diretamente para os seus objetivos.' : ''),
      }));
      return { strategies: out };
    }

    case 'createSwotQuiz': {
      const prompt = `Gere 8 perguntas de diagnostico (abertas) para coletar dados que permitam montar uma analise SWOT do artista. As perguntas devem explorar forcas, fraquezas, oportunidades e ameacas da carreira.\n${identityContext(identity)}${spotifyContext(spotify)}\nRetorne JSON: { "questions": ["string", ...] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createSwotQuizV2': {
      // RAG: usar referências para calibrar perguntas mais relevantes
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 3 });
      const references = formatReferenceContext(similarPlans);

      const known = [
        identity?.genre ? `generos: ${identity.genre}` : '',
        identity?.bio ? `bio: ${identity.bio}` : '',
        identity?.vision ? `visao: ${identity.vision}` : '',
        identity?.mission ? `missao: ${identity.mission}` : '',
        identity?.values?.length ? `valores: ${identity.values.join(', ')}` : '',
        objectives?.length ? `objetivos: ${objectives.join('; ')}` : '',
      ].filter(Boolean).join('\n- ');

      const prompt = `Gere 8 perguntas de diagnostico para montar uma analise SWOT do artista.

FATOS JA CONHECIDOS (NAO pergunte NADA que ja esteja respondido aqui — ex.: publico-alvo, generos, o que ele produz, proposito):\n- ${known}

TAXONOMIA FIXA (8 perguntas): 2 sobre FORCAS (capacidades/ativos que ele tem), 2 sobre FRAQUEZAS (gargalos reais), 2 sobre OPORTUNIDADES (mercado/canais inexplorados), 2 sobre AMEACAS (riscos externos).

REGRAS DAS OPCOES:\n- Cada pergunta DEVE vir com 4 a 5 opcoes curtas (maximo 8 palavras cada).\n- Opcoes MUTUAMENTE EXCLUSIVAS de verdade: nunca sinonimos ou subconjuntos uma da outra.\n- Calibre as opcoes com os dados do Spotify e os fatos conhecidos (cite elementos do contexto do artista).\n- Entre 2 e 3 perguntas aceitam multiplas respostas ("multi": true) — ex.: fontes de renda atuais, gargalos atuais.\n- As demais sao de escolha unica ("multi": false).\n${identityContext(identity)}${spotifyContext(spotify)}${references}\nRetorne JSON: { "questions": [{ "question": "...", "options": ["...", "..."], "multi": false }, ...] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createSwotAnalysis': {
      // RAG: buscar planos similares para enriquecer análise SWOT
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 4 });
      const references = formatReferenceContext(similarPlans);

      const qa = (answers || []).map((a: any) => `P: ${a.question}\nR: ${a.answer}`).join('\n\n');
      const prompt = `Gere uma analise SWOT (Forcas, Fraquezas, Oportunidades, Ameacas), de 3 a 5 itens em cada categoria, baseada no diagnostico abaixo.

REGRAS DE QUALIDADE:
1. Cada item deriva de uma resposta CONCRETA do diagnostico ou de um dado do Spotify — analise, nao opiniao.
2. PROIBIDO reformular a visao/missao/objetivos como "forca" ou "oportunidade" (isso e circular, nao e analise).
3. PROIBIDO adjetivos nao fundamentados ("alta qualidade", "talentoso") — so afirme o que as respostas evidenciam.
4. Itens curtos: maximo 12 palavras cada, frase direta.
5. Linguagem clara para leigo (nada de "falta de dados sobre popularidade" — prefira "base de seguidores ainda pequena").
${identityContext(identity)}${spotifyContext(spotify)}${platform}${dossierContext(dossier)}${references}\nDIAGNOSTICO:\n${qa}\nRetorne JSON: { "strengths": [...], "weaknesses": [...], "opportunities": [...], "threats": [...] } (arrays de strings)`;
      return await callGroqJson(SYSTEM, prompt, HEAVY_MODEL);
    }

    case 'createStrategyQuiz': {
      const prompt = `Com base na SWOT abaixo, gere 6 perguntas para entender como o artista pode cruzar forcas/fraquezas com oportunidades/ameacas. As perguntas devem ajudar a descobrir estrategias praticas.\nSWOT: ${JSON.stringify(swot)}\nRetorne JSON: { "questions": ["string", ...] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createStrategyQuizV2': {
      // RAG: buscar estratégias reais para calibrar opções
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 4 });
      const references = formatReferenceContext(similarPlans);

      const prompt = `Com base na SWOT e nos objetivos abaixo, gere 6 perguntas de CRUZAMENTO ESTRATEGICO que ajudem o artista a descobrir combos:\n- SO (Ataque): "SO · Ataque — Como usar [FORCA] para aproveitar [OPORTUNIDADE]?"\n- ST (Defesa): "ST · Defesa — Como usar [FORCA] para neutralizar [AMEACA]?"\n- WO (Reforco): "WO · Reforco — Que acoes para superar [FRAQUEZA] e capturar [OPORTUNIDADE]?"\n- WT (Sobrevivencia): "WT · Sobrevivencia — Como minimizar [FRAQUEZA] para se defender de [AMEACA]?"\nGere pelo menos 1 pergunta de cada tipo, usando itens ESPECIFICOS da SWOT (nao invente itens novos).\n\nREGRAS DAS PERGUNTAS:\n- Use o TEXTO INTEGRAL dos itens da SWOT nas perguntas — NUNCA encurte ou trunque ("Diferenciacao" em vez de "Diferenciacao com influencias brasileiras" e proibido).\n- PROIBIDO cruzamento circular: nao cruze um item com outro que seja apenas a acao derivada dele (ex.: "usar foco em beats para desenvolver catalogo de beats" nao decide nada).\n\nREGRAS DAS OPCOES:\n- Cada pergunta DEVE vir com 4 a 5 opcoes que representem caminhos estrategicos concretos e especificos para ESTE artista (cite elementos da SWOT nas opcoes; maximo 10 palavras por opcao).\n- NAO repita opcoes entre as 6 perguntas — cada pergunta abre caminhos diferentes.\n- Perguntas de exploracao ampla podem aceitar multiplas respostas ("multi": true); as demais sao de escolha unica.\nSWOT: ${JSON.stringify(swot)}\nOBJETIVOS: ${(objectives || []).join('; ')}${references}\nRetorne JSON: { "questions": [{ "question": "...", "options": ["...", "..."], "multi": false }, ...] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createStrategies': {
      // RAG: MÁXIMA referência aqui — buscar estratégias reais para fundamentar
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 5 });
      const references = formatReferenceContext(similarPlans);

      const qa = (answers || []).map((a: any) => `P: ${a.question}\nR: ${a.answer}`).join('\n');

      // "Gerar outras" de verdade: as estratégias anteriores entram como proibição explícita.
      const prevBlock = (previous && previous.length)
        ? `\n\nESTRATEGIAS JA PROPOSTAS ANTES (o artista pediu OUTRAS — e PROIBIDO repetir ou reformular qualquer uma destas; proponha caminhos genuinamente DIFERENTES):\n${previous.map((s: any) => `- [${s.type}] ${s.title}: ${s.description || ''}`).join('\n')}`
        : '';

      const prompt = `Gere de 6 a 8 estrategias cruzadas (type: SO, ST, WO, WT) para o plano de acao do artista, como num plano de consultoria SENIOR robusto (que costuma ter muitas frentes). Prefira 7-8 quando houver materia-prima na SWOT e nos objetivos.

CONTRATO DE CADA ESTRATEGIA (obrigatorio):
- "title": ate 5 palavras, especifico.
- "description": COMO executar, em 1-2 frases que SEMPRE contenham: a tatica concreta + o canal/ferramenta + 1 metrica numerica + 1 prazo.
- "why": 1 frase ligando a estrategia ao item EXATO da SWOT que ela aproveita ou ataca.
- "tasks": 3 a 4 tarefas executaveis, citando ferramentas reais do mercado musical brasileiro quando fizer sentido (Spotify for Artists, pitch editorial, SubmitHub, Groover, BeatStars, distribuidoras como ONErpm/DistroKid, editais de cultura, Instagram/TikTok/YouTube). Cada tarefa: description + type (EXATAMENTE um de: produto_fonografico, audio_visual, design, fotos, figurino, site, textos, assessoria, marketing_digital, media_kit, radio, show, acoes).

PROIBIDO:
- Descricoes que apenas reformulam a SWOT no padrao "aproveitar X com Y" / "neutralizar X com Y" sem dizer COMO.
- Generalidades: "aumentar presenca", "consolidar mercado", "expandir alcance" sem numero e canal.

NIVEL CONSULTOR SENIOR (cruciais):
- ANCORE NA VISAO/MISSAO (REQUISITO NAO-NEGOCIAVEL, tem PRIORIDADE sobre cobrir todos os cruzamentos): se a visao cita alvos NOMINAIS (festivais como Coala/Rec-Beat, regiao-alvo, publico-alvo, marco especifico), UMA das estrategias TEM QUE ser dedicada a esse alvo. Ex.: visao cita festivais -> OBRIGATORIO uma estrategia de prospeccao/aplicacao a festivais relevantes. Comece a lista por essa estrategia.
- ALAVANCAS QUE CONSULTORIAS REAIS PRIORIZAM: como sao 6-8 estrategias, DISTRIBUA entre dimensoes diferentes e inclua as alavancas profissionais relevantes ao porte/SWOT (nao se limite a conteudo/redes): direcao de imagem e branding, media kit profissional, assessoria de imprensa, prospeccao de festivais, editais/leis de incentivo e financiamento coletivo, reestruturacao digital com captacao e nutricao de leads, radio, sincronizacao (TV/cinema/games), parcerias e feats, diversificacao de receita (merchandising/assinatura). PROIBIDO gerar varias estrategias da mesma dimensao; cada uma ataca uma frente distinta do plano.

EXEMPLOS DO PADRAO ESPERADO (nao copie o conteudo — copie o NIVEL DE CONCRETUDE):
{ "type": "SO", "title": "Licenciamento em playlists de estudo", "description": "Empacotar 10 faixas instrumentais e enviar pitch quinzenal a curadores de playlists lo-fi/estudo via SubmitHub e Groover, mirando 15 placements e 30.000 streams/mes em 6 meses.", "why": "Usa o catalogo instrumental pronto (forca) para capturar a demanda de musica para foco (oportunidade)." }
{ "type": "WT", "title": "Renda recorrente fora do streaming", "description": "Lancar assinatura mensal de beats exclusivos no BeatStars com meta de 20 assinantes pagantes em 9 meses, reduzindo a dependencia de royalties.", "why": "Ataca a dependencia de fonte unica de renda (fraqueza) e protege de mudancas de algoritmo (ameaca)." }

${identityContext(identity)}${spotifyContext(spotify)}${calibrationContext(spotify)}${platform}${userEditsContext(userEdits)}${dossierContext(dossier)}
OBJETIVOS: ${(objectives || []).join('; ')}
SWOT: ${JSON.stringify(swot)}
RESPOSTAS DO ARTISTA: ${qa}${prevBlock}${references}
Retorne JSON: { "strategies": [{ "type": "SO|ST|WO|WT", "title": "...", "description": "...", "why": "...", "tasks": [{ "description": "...", "type": "..." }] }] }`;

      let result = await callGroqJson(SYSTEM, prompt, HEAVY_MODEL);

      // Validação anti-vagueza: toda description precisa de ao menos uma métrica numérica.
      // Se alguma vier sem, re-gera UMA vez com a cobrança explícita.
      const isVague = (s: any) => !/\d/.test(String(s?.description || ''));
      if ((result.strategies || []).some(isVague)) {
        result = await callGroqJson(
          SYSTEM,
          prompt +
            '\n\nATENCAO: a tentativa anterior tinha descricoes SEM metrica numerica. TODA description precisa conter pelo menos um numero (meta ou prazo). Refaca.',
          HEAVY_MODEL
        );
      }

      // Ancora da visao (HARD): se a visao/missao cita FESTIVAIS (alvo nominal classico do
      // segmento, e a alavanca que a consultoria real mais prioriza), ao menos UMA estrategia
      // deve enderecar festivais. A instrucao no prompt e "soft" e as vezes se perde diante
      // dos cruzamentos; aqui garantimos com um retry dedicado (mesmo padrao do anti-vagueza).
      const visionTxt = `${identity?.vision || ''} ${identity?.mission || ''}`;
      const stratHasFestival = (result.strategies || []).some((s: any) =>
        /festiv/i.test(`${s?.title || ''} ${s?.description || ''} ${s?.why || ''}`)
      );
      if (/festiv/i.test(visionTxt) && !stratHasFestival) {
        result = await callGroqJson(
          SYSTEM,
          prompt +
            `\n\nOBRIGATORIO: a visao do artista cita festivais (\"${visionTxt.trim()}\") e a versao anterior NAO trouxe nenhuma estrategia de festivais. Refaca incluindo OBRIGATORIAMENTE uma estrategia dedicada a prospeccao/aplicacao a festivais relevantes do segmento (com tatica, canal, meta numerica e prazo), substituindo a estrategia menos prioritaria se precisar. Mantenha as demais boas estrategias.`,
          HEAVY_MODEL
        );
      }

      // RETROALIMENTAÇÃO: salvar o plano gerado para enriquecer a base
      // Executar em background sem bloquear a resposta
      saveGeneratedPlan(identity, spotify, swot, objectives || [], result.strategies || []);

      return result;
    }

    case 'generateSchedule': {
      const list = (strategies || [])
        .map((s: any, i: number) => `${i + 1}. [id: ${s.id}] ${s.title} (tipo ${s.type}, score ${s.finalScore ?? 0})${s.description ? ` — ${s.description}` : ''}${s.why ? `\n   Por que: ${s.why}` : ''}`)
        .join('\n');
      // SWOT integral no contexto: sem ela o modelo já "comprou equipamento" para
      // um artista cuja FORÇA era ter produção própria (inversão de sentido).
      const swotBlock = swot
        ? `\nINVENTARIO DO ARTISTA (SWOT):\n- FORCAS (o artista JA TEM — as tarefas devem USAR/EXPLORAR, NUNCA adquirir): ${(swot.strengths || []).join('; ')}\n- FRAQUEZAS (podem ser alvo de correcao): ${(swot.weaknesses || []).join('; ')}\n- OPORTUNIDADES: ${(swot.opportunities || []).join('; ')}\n- AMEACAS: ${(swot.threats || []).join('; ')}\n`
        : '';
      const prompt = `Papel: gerente de projetos musicais.\nCONTEXTO TEMPORAL: hoje e ${today}. TODAS as datas de deadline DEVEM ser FUTURAS (depois de ${today}).\n${swotBlock}\nESTRATEGIAS PRIORIZADAS (em ordem de prioridade, da mais importante para a menos):\n${list}\n\nREGRAS OBRIGATORIAS:\n1. Gere EXATAMENTE 3 tarefas para cada estrategia.\n2. Prioridade define o inicio: estrategia #1 comeca em ~7 dias; #2 em ~30 dias; #3 em ~60 dias; seguintes somam +30 dias cada.\n3. Dentro de cada estrategia, espace as tarefas em ~2 semanas.\n4. Cada tarefa e um ENTREGAVEL VERIFICAVEL: comece a description com verbo de entrega (Publicar, Enviar, Lancar, Fechar, Gravar, Agendar, Cadastrar) e cite o que sera entregue e onde. PROIBIDO: "Analise de...", "Implementacao de estrategias de...", "Desenvolvimento de habilidades...".\n5. O artista JA POSSUI tudo que esta listado como FORCA — nenhuma tarefa pode propor adquirir, desenvolver ou montar algo que ja e forca dele.\n6. Cada tarefa tem: description, type (EXATAMENTE um de: produto_fonografico, audio_visual, design, fotos, figurino, site, textos, assessoria, marketing_digital, media_kit, radio, show, acoes), deadline (YYYY-MM-DD, futura).\n7. Ecoe o campo "id" de cada estrategia EXATAMENTE como recebido.\n\nRetorne JSON: { "strategies": [{ "id": "...", "tasks": [{ "description": "...", "type": "...", "deadline": "YYYY-MM-DD" }] }] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'createFinalResult': {
      // RAG: referências para um resumo mais fundamentado
      const similarPlans = await searchSimilarPlans(identity, spotify, { matchCount: 3 });
      const references = formatReferenceContext(similarPlans);

      const stratLines = (strategies || [])
        .slice()
        .sort((a: any, b: any) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
        .map((s: any, i: number) => {
          const ordinal = i === 0 ? '1a aposta' : i === 1 ? '2a aposta' : i === 2 ? '3a aposta' : `${i + 1}a`;
          const firstTasks = (s.tasks || []).slice(0, 2).map((t: any) => `${t.description}${t.deadline ? ` (ate ${t.deadline})` : ''}`).join('; ');
          return `${ordinal}: ${s.title}${s.description ? ` (${s.description})` : ''}${firstTasks ? ` | Primeiras acoes: ${firstTasks}` : ''}`;
        })
        .join('\n');
      const artistName = identity?.name || 'o artista';
      const prompt = `Escreva o resumo do plano em LINGUAGEM SIMPLES, em TERCEIRA PESSOA, referindo-se ao artista pelo nome ("${artistName}") ou como "o artista" — NUNCA "você"/"sua"/"seu". Use markdown leve (titulos em **negrito** e listas com -). ESTRUTURA FIXA (3 a 4 paragrafos curtos):
1. **Onde ${artistName} está hoje**: o momento do artista (identidade + dados do Spotify + o essencial do diagnostico), em palavras simples. Comece o titulo com "Onde".
2. **As apostas principais**: as 2-3 estrategias mais importantes e por que elas vem primeiro (use a ordem dada). Use EXATAMENTE este titulo.
3. **Os próximos 90 dias**: o que comeca primeiro, com as acoes e datas ja definidas. Use EXATAMENTE este titulo, com acento em \"próximos\".

REGRAS DE LINGUAGEM (cruciais):
- TERCEIRA PESSOA SEMPRE: refira-se ao artista por "${artistName}" ou "o artista". PROIBIDO "você", "sua", "seu", "te". (Ex.: "Hoje ${artistName} tem...", "As apostas de ${artistName} são...").
- PROIBIDO siglas e jargao: nada de SWOT, SO/ST/WO/WT, "matriz", "priorizacao", "inventario", e PROIBIDO mostrar numeros de prioridade/score (ex.: "prioridade 34"). Fale como um consultor amigavel.
- PROIBIDO travessao (—); use virgula ou frase curta.
- PROIBIDO cliches vazios: "potencial maximo", "rumo ao sucesso", "consolidar presenca". Cite numeros e prazos REAIS das metas e acoes; inspire pelo CONTEUDO, nao por adjetivos.
${identityContext(identity)}${spotifyContext(spotify)}${platform}${dossierContext(dossier)}\nOBJETIVOS: ${(objectives || []).join('; ')}\nSWOT: ${JSON.stringify(swot || {})}\nESTRATEGIAS EM ORDEM (com acoes):\n${stratLines}${references}\nResponda APENAS com o texto do resumo, sem JSON.`;
      const result = await callGroq(SYSTEM, prompt, false, HEAVY_MODEL);
      return { text: result.trim() };
    }

    case 'improveVisionMission': {
      const qa = Object.entries(answers || {}).filter(([, v]) => (v as string)?.trim()).map(([k, v]) => `${k}: ${v}`).join('\n');

      // BIO: texto de apresentacao em PRIMEIRA PESSOA (o artista escreve "sobre voce", entao
      // fala como ele mesmo). 2-3 frases, regras proprias (sem "prazo literal" etc.).
      if (kind === 'bio') {
        const bioPrompt = `Escreva a BIO de apresentacao do artista "${identity?.name || ''}" (genero ${identity?.genre || ''}) em 2 a 3 frases curtas, em portugues do Brasil, em PRIMEIRA PESSOA (o proprio artista falando: "eu faco", "meu som", "comecei"), tom autentico e proximo.\n\nREGRAS OBRIGATORIAS:\n1. PRIMEIRA PESSOA sempre. PROIBIDO terceira pessoa: NUNCA escreva "${identity?.name || 'o artista'}", "ele", "ela" ou "o artista". Use "eu", "meu", "minha", "faco", "comecei".\n2. Cubra o que houver nas respostas: o som/estilo, o que me diferencia, e um traco da historia ou do que me move.\n3. Use SOMENTE o que as respostas trazem. NUNCA invente premios, numeros, cidades ou conquistas nao citados.\n4. PROIBIDO clichês: "potencial maximo", "vim para revolucionar", "promessa da musica", "talento nato", "conquistar o mundo", "reconhecido e respeitado". PROIBIDO travessao (—): use virgula ou frase curta.\n5. Concreto e especifico, nada generico. Maximo 3 frases.\n\nUse as respostas abaixo como materia-prima. Responda APENAS com o texto final, sem aspas nem rotulos.\n${qa}`;
        const bioResult = await callGroq(SYSTEM, bioPrompt, false);
        return { text: bioResult.trim().replace(/^["']|["']$/g, '') };
      }

      const alvoVM = kind === 'vision'
        ? 'VISAO (onde voce quer chegar com a carreira: o que se torna, em quanto tempo, com que alcance)'
        : 'MISSAO (seu proposito: por que voce faz musica, para quem, que transformacao gera, e a intencao do projeto quando o artista disser — viver da musica/renda, paixao, ou causa)';
      const prompt = `Escreva a sua ${alvoVM} em 1 a 2 frases curtas, em PRIMEIRA PESSOA (voce, o artista "${identity?.name || ''}", genero ${identity?.genre || ''}, falando como voce mesmo: "eu quero", "meu objetivo", "eu faco musica para").

REGRAS OBRIGATORIAS:
1. PRIMEIRA PESSOA sempre. PROIBIDO terceira pessoa: NUNCA escreva "${identity?.name || 'o artista'}", "o artista", "ele", "ela", "a visao do artista", "o objetivo dele". Use "eu", "meu", "minha".
2. PRAZO LITERAL: se as respostas contem um prazo (ex.: "3 anos"), use EXATAMENTE esse prazo. NUNCA troque por faixas ("3-5 anos").
3. COBERTURA TOTAL: toda fonte de renda, publico ou pilar do projeto citado nas respostas DEVE aparecer no texto (se o artista citou dois publicos ou dois negocios, os dois entram).
4. PROIBIDO usar: "potencial maximo", "ferramenta essencial para o sucesso", "reconhecido e respeitado", "consolidar presenca no mercado", "alcancar o sucesso" e variacoes (nada de frase decorativa de fechamento). PROIBIDO travessao (—): use virgula ou frase curta.
5. Maximo 2 frases. A segunda so existe se trouxer informacao nova; nunca como reforco retorico.

Use as respostas abaixo como materia-prima. Responda APENAS com o texto final, sem aspas nem rotulos.\n${qa}`;
      const result = await callGroq(SYSTEM, prompt, false);
      return { text: result.trim().replace(/^["']|["']$/g, '') };
    }

    case 'suggestPriorityScores': {
      // Pré-preenche a matriz de priorização: nota 0-10 de cada estratégia para cada
      // objetivo, com 1 justificativa por estratégia. O usuário só ajusta o que discordar.
      const objList = (objectives || []).map((o, i) => `${i}: ${o}`).join('\n');
      const stratList = (strategies || []).map((s: any) => `[id: ${s.id}] ${s.title} — ${s.description || ''}`).join('\n');
      const prompt = `Para cada estrategia, atribua uma nota de 0 a 10 indicando o quanto ela contribui para CADA objetivo, e escreva 1 frase curta justificando o conjunto de notas dessa estrategia.\n\nOBJETIVOS (indice: texto):\n${objList}\n\nESTRATEGIAS:\n${stratList}\n\nSeja criterioso: notas altas (8-10) so quando a estrategia ataca DIRETAMENTE o objetivo; baixas (0-3) quando nao se relacionam.\nRetorne JSON: { "scores": [{ "id": "<id da estrategia>", "byObjective": { "0": 8, "1": 5, ... }, "rationale": "..." }] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    case 'generatePhaseLabel': {
      const prompt = `Gere um rotulo curto e inspirador (maximo 3 palavras) para a fase ${phase} de carreira do artista "${identity?.name || ''}" (genero ${identity?.genre || ''}). Responda apenas com o rotulo, sem aspas.`;
      const result = await callGroq(SYSTEM, prompt, false);
      return { text: result.trim().replace(/^["']|["']$/g, '') };
    }

    case 'suggestTasks': {
      // Plano de Acao: a Nyta sugere as PROXIMAS tarefas concretas dentro de UMA estrategia,
      // direcionando o artista para o melhor caminho. strategies[0] = estrategia alvo (com .tasks atuais).
      const s = (strategies || [])[0] || {};
      const done = (s.tasks || []).map((t: any) => `- ${t.description}`).join('\n') || '(nenhuma ainda)';
      const prompt = `Voce e a Maestra, consultora. O artista quer AVANCAR uma estrategia do plano dele e precisa saber os PROXIMOS passos.\n${identityContext(identity)}${spotifyContext(spotify)}\nOBJETIVOS DO ARTISTA: ${(objectives || []).join('; ') || 'n/d'}\nHOJE: ${today || ''}\n\nESTRATEGIA ALVO:\n- Titulo: ${s.title || ''}\n- Como: ${s.description || ''}\n- Por que: ${s.why || ''}\n\nTAREFAS QUE JA EXISTEM NESSA ESTRATEGIA (NAO repita nem reformule):\n${done}\n\nSugira de 2 a 3 PROXIMAS tarefas concretas para destravar essa estrategia. REGRAS:\n- Cada tarefa e um ENTREGAVEL VERIFICAVEL: comece a description com verbo de entrega (Publicar, Enviar, Lancar, Fechar, Gravar, Agendar, Cadastrar, Contratar, Inscrever) e diga o que sera entregue e ONDE.\n- Cite a ferramenta/canal REAL quando fizer sentido (Spotify for Artists, pitch editorial, SubmitHub, Groover, distribuidoras, editais de cultura, assessoria de imprensa, Instagram/TikTok/YouTube).\n- Portugues simples para artista LEIGO. PROIBIDO siglas (SWOT/SO/ST), jargao e travessao.\n- type: EXATAMENTE um de (produto_fonografico, audio_visual, design, fotos, figurino, site, textos, assessoria, marketing_digital, media_kit, radio, show, acoes).\n- deadline: YYYY-MM-DD, sempre FUTURO (depois de hoje), escalonado em ~2 a 4 semanas.\nRetorne JSON: { "tasks": [{ "description": "...", "type": "...", "deadline": "YYYY-MM-DD" }] }`;
      return await callGroqJson(SYSTEM, prompt);
    }

    default:
      throw new Error(`Action desconhecida: ${action}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body: RequestBody = await req.json();
    if (!body.action) {
      return new Response(JSON.stringify({ error: "'action' e obrigatorio" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const result = await handleAction(body);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
