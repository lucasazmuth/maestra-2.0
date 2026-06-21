// Tipos do domínio Maestra. A tabela `artists` guarda quase tudo do planejamento estratégico
// num único blob JSON (`content`). Definimos um tipo forte para evitar drift entre Wizard,
// Dashboard, Plano de Ação e Catálogo.

export type AccessLevel = 'plan' | 'team' | 'finance' | 'catalog' | 'agenda' | 'releases' | 'full';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived';

export type StrategyType = 'SO' | 'ST' | 'WO' | 'WT';

// Gênero gramatical do artista (define a flexão de toda a fala da Nyta em PT).
// 'neutro' = "tanto faz" → preferir construções neutras.
export type ArtistGender = 'ele' | 'ela' | 'elu' | 'neutro';

// Estágio de carreira (Roteiro §3) — calibra profundidade e personaliza sugestões.
export type ArtistStage = 'comecando' | 'lancando' | 'vivendo' | 'consolidada';

// Fonte de reconhecimento (etiqueta invisível da Visão Q2 — Roteiro §8).
// Deriva o "por quem" da visão e, depois, os objetivos operacionais e a priorização.
export type RecognitionTag =
  | 'publico'
  | 'critica_midia'
  | 'mercado'
  | 'classe_artistica'
  | 'internacional';

// Perfil de objetivo predominante — usado pela matriz de impacto na priorização (Doc 6).
export type ObjectiveProfile = 'digital' | 'financeiro' | 'midia' | 'shows';

// As 11 categorias de estratégia da matriz de impacto (Doc 6 §2). Cada estratégia gerada
// é classificada numa delas para a priorização determinística.
export type StrategyCategory =
  | 'lancamentos'
  | 'digital'
  | 'branding'
  | 'show'
  | 'juridico'
  | 'equipe'
  | 'comercial'
  | 'captacao'
  | 'network'
  | 'imprensa'
  | 'merchan';

export type ActionTaskType =
  | 'produto_fonografico'
  | 'audio_visual'
  | 'design'
  | 'fotos'
  | 'figurino'
  | 'site'
  | 'textos'
  | 'assessoria'
  | 'marketing_digital'
  | 'media_kit'
  | 'radio'
  | 'show'
  | 'acoes';

export interface ActionTask {
  id: string;
  description: string;
  type?: ActionTaskType | string;
  owner?: string; // id/email do responsável (resolvido via artist_members)
  deadline?: string; // YYYY-MM-DD
  status: TaskStatus;
}

export interface Strategy {
  id: string;
  type: StrategyType;
  title: string;
  description?: string;
  // 1 frase ligando a estratégia ao item da SWOT que ela aproveita/ataca (gerada pela IA)
  why?: string;
  // Metodologia v2: chave canônica do banco de 53 estratégias (ex.: '1', '26', '41a', 'N3').
  // É a chave para a matriz de priorização (53×8) e o passo a passo canônico do plano de ação.
  bankId?: string;
  // Itens da SWOT que esta estratégia responde (rótulos), exibidos no tooltip "responde a…".
  swotRefs?: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[] };
  tasks: ActionTask[];
  score?: number;
  // Priorização (etapa 7): score 0-10 por índice de objetivo; finalScore = soma.
  objectiveScores?: Record<number, number>;
  finalScore?: number;
  // Categoria da matriz de impacto (Doc 6) — alimenta a priorização determinística.
  category?: StrategyCategory;
  // Linha pedagógica ligando a estratégia ao objetivo que ela serve (gerada na priorização).
  priorityRationale?: string;
}

// Pergunta rica de quiz (wizard v2). Perguntas legadas são strings simples;
// `options` vazio significa resposta por texto livre.
export interface QuizQuestion {
  question: string;
  options: string[];
  multi?: boolean;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

// Visão montada por partes (Roteiro §5). A frase final fica em `ArtistIdentity.vision`.
export interface VisionParts {
  onde?: string; // Q1 alcance geográfico (valor da opção)
  porQuem?: string[]; // Q2 fontes de reconhecimento (rótulos escolhidos, máx 2)
  substantivo?: string; // Q3 como o quê (flexionado por gênero)
  adjetivo?: string; // Q4 atributo
  oQueFalam?: string; // Q5 o que falam de você
}

// Tier financeiro da missão (Metodologia v2, Q12). Define o sufixo determinístico da frase de
// missão e se a Fonte 4 (objetivo financeiro) é gerada na etapa de Objetivos.
//   hobby        — "o que vier é lucro" → NÃO entra na missão, NÃO gera objetivo financeiro
//   projeto      — "alcançando em paralelo sustentabilidade financeira para o projeto"
//   eu           — "gerando em paralelo resultados financeiros relevantes"
//   eu_parceiros — "gerando em paralelo resultados financeiros para o projeto e seus parceiros"
export type MissionFinancialTier = 'hobby' | 'projeto' | 'eu' | 'eu_parceiros';

// Missão em dois tempos (Metodologia v2, Q12). A frase final fica em `ArtistIdentity.mission`.
export interface MissionParts {
  entrega?: string; // Tempo 1 — o que a carreira entrega/oferece/proporciona
  paraQuem?: string; // Tempo 1 — para quem é a entrega
  financialTier?: MissionFinancialTier; // Tempo 2 — a virada financeira (enum determinístico)
  negocio?: string; // (legado) Tempo 2 em texto livre — mantido só para leitura de planos antigos
  reviewed?: boolean; // a frase montada já foi validada (antes de coletar valores)
}

// Mapa de referências (Metodologia v2, Q5) — 4 frentes em ordem crescente de dificuldade.
// `posicionamento` vira 3 horizontes (com quem disputar espaço em 1, 3 e +5 anos).
export interface ReferenceHorizons {
  curto?: string; // 1 ano
  medio?: string; // 3 anos
  longo?: string; // +5 anos
}
export interface ArtistReferences {
  artisticas?: string;
  comunicacao?: string;
  gestao?: string;
  posicionamento?: ReferenceHorizons;
}

export interface ArtistIdentity {
  name?: string;
  genre?: string;
  bio?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  // ---- Metodologia Nyta (Roteiro §3–6) -------------------------------------------------------
  gender?: ArtistGender; // gênero gramatical — coletado 1º, antes de qualquer fala flexionada
  stage?: ArtistStage; // estágio de carreira
  city?: string;
  state?: string;
  references?: ArtistReferences;
  visionParts?: VisionParts;
  recognitionTags?: RecognitionTag[]; // derivado da Visão Q2 (+ Q1 internacional)
  missionParts?: MissionParts;
}

// Stats do Spotify salvas no perfil do artista, revalidadas ao acessar.
export interface SpotifyProfile {
  spotify_artist_id: string;
  name: string;
  image?: string;
  followers?: number;
  popularity?: number; // 0-100
  genres?: string[];
  track_count?: number;
  fetched_at: string; // ISO
}

// Dados da Chartmetric salvos no perfil (espelha o padrão do SpotifyProfile).
// Fase 1 (pré-pago, resumo): monthly_listeners, ranks, top_cities, genre.
// Fase 2 (pós-pago, profundo): growth, audience, multiplatform, playlists.
export interface ChartmetricProfile {
  cm_artist_id: number;
  monthly_listeners?: number | null;
  monthly_listeners_rank?: number | null;
  career_rank?: number | null;
  genre?: string | null; // gênero principal (single) — usado no contexto da Nyta
  // Gêneros da Chartmetric (principal + secundários, até 3). Metodologia v2: a Q2 pré-seleciona
  // todos como sugestão, já que o gênero único da Chartmetric é impreciso para artistas BR.
  genres?: string[];
  // Artistas similares (Metodologia v2 — referências de posicionamento / benchmark). Pré-pago.
  similar?: { name: string }[];
  // Seguidores no Spotify (usados no Índice REAL, dimensão Audience). Pré-pago.
  sp_followers?: number | null;
  top_cities?: { name: string; country: string; listeners: number }[];
  // Enriquecimento pós-pago (todos opcionais — preenchidos por artist-enrich-chartmetric):
  growth?: { listeners_30d_pct?: number; points?: { date: string; value: number }[] };
  audience?: {
    top_countries?: { name: string; pct?: number; listeners?: number }[];
    age?: { range: string; pct: number }[];
    gender?: { male?: number; female?: number };
  };
  multiplatform?: { spotify?: number; youtube?: number; tiktok?: number; instagram?: number };
  playlists?: { count?: number; reach?: number };
  enriched?: boolean; // true após o enriquecimento profundo pós-pago
  fetched_at: string; // ISO — controla cache (STALE), igual ao Spotify
  // Layered defense fields for API call waste elimination:
  cm_not_found?: boolean; // true when artist doesn't exist in Chartmetric's database
  cm_not_found_at?: string; // ISO — when the "not found" status was recorded (TTL: 7 days)
  enrichment_lock?: string | null; // ISO — temporary lock for concurrency deduplication (TTL: 2 min)
}

// Quiz de criação (shows/faturamento/lançamentos/equipe) salvo no perfil.
export interface QuizDiagnostic {
  answers: Record<string, string>;
  completedAt: string; // ISO
}

// Diagnóstico-base (compat: mapeado a partir do Índice REAL para alimentar Nyta/relatório).
export interface ArtistDiagnostic {
  stage?: string;
  headline?: string;
  bullets?: string[];
  opportunity?: string;
  metrics?: { label: string; value: string }[];
  generatedAt?: string; // ISO
}

// Índice REAL (metodologia Anita Carvalho): classifica o artista em 1 de 16 perfis
// a partir de 4 dimensões — Reach, Earnings, Audience, Legitimacy. Determinístico.
export interface RealIndex {
  profile: { key: string; name: string; description: string; insights: string[] };
  // padrão R·E·A·L binarizado (true = alto, z ≥ 0).
  pattern: { r: boolean; e: boolean; a: boolean; l: boolean };
  // z-scores por dimensão (lógica interna — NÃO exibidos ao artista).
  dimensions: { r: number; e: number; a: number; l: number };
  realScore: number; // média dos z (display/ranking — não exibido)
  earningsUnknown?: boolean; // artista respondeu "Não sei" no faturamento
  // Dados brutos para o relatório (o "espelho") + contexto da Nyta.
  inputs: {
    faturamento: string;
    shows_pagos: string;
    maior_publico: string;
    premios: string;
    imprensa: string;
    monthly_listeners?: number | null;
    sp_followers?: number | null;
    social?: { instagram?: number | null; tiktok?: number | null; youtube?: number | null };
  };
  computedAt: string; // ISO
}

// Catálogo publicado (vindo do Spotify) — somente leitura.
export interface SpotifyCatalogTrack {
  id: string;
  name: string;
  album?: string;
  album_image?: string;
  duration_ms?: number;
  preview_url?: string | null;
  spotify_url?: string;
}

export interface SpotifyCatalogAlbum {
  id: string;
  name: string;
  image?: string;
  release_date?: string;
  total_tracks?: number;
  spotify_url?: string;
}

export interface PhaseHistoryEntry {
  phase: number;
  phaseLabel?: string;
  objectives?: string[];
  strategies?: Strategy[];
  swotAnalysis?: SwotAnalysis;
  snapshotAt: string;
}

export interface ArtistContent {
  language?: 'pt' | 'en';
  step?: number;
  // Ausente/1 = escala antiga de 7 etapas; 2 = escala atual de 9 etapas.
  wizardVersion?: number;
  phase?: number;
  phaseLabel?: string;
  phaseHistory?: PhaseHistoryEntry[];
  identity?: ArtistIdentity;
  objectives?: string[];
  // Captura intermediária da SWOT (Metodologia v2). Os 20 itens internos viram IDs canônicos
  // (1–20) classificados, e oportunidades/ameaças viram IDs canônicos selecionados (1–22 / 1–13).
  // Essas seleções alimentam as matrizes determinísticas de geração de estratégias.
  swotInputs?: {
    // item interno (id 1–20) → classificação do artista
    internal?: Record<number, 'forte' | 'melhorar' | 'na'>;
    opportunities?: number[]; // ids de oportunidades marcadas (1–22)
    threats?: number[]; // ids de ameaças marcadas (1–13)
    // Acréscimos livres do artista por quadrante (entram na SwotAnalysis, não nas matrizes).
    forcasLivres?: string[];
    fraquezasLivres?: string[];
    oportunidadesLivres?: string[];
    ameacasLivres?: string[];
    // (legado v3) chip (label) → classificação — mantido só para leitura de planos antigos.
    chips?: Record<string, 'forca' | 'fraqueza' | 'na' | 'sim'>;
  };
  // Perfil de objetivo predominante (derivado p/ a matriz de impacto da priorização).
  objectiveProfile?: ObjectiveProfile[];
  // (legado v2) Quiz de diagnóstico — substituído por campo aberto + chips na metodologia Nyta.
  swotQuizQuestions?: (string | QuizQuestion)[];
  swotQuizAnswers?: Record<string, any>;
  swotAnalysis?: SwotAnalysis;
  // Itens do board SWOT adicionados/editados à mão pelo artista — a IA os trata
  // como fatos absolutos (nunca contradiz nem propõe "adquirir" o que já existe).
  swotUserEdits?: string[];
  strategyQuizQuestions?: (string | QuizQuestion)[];
  strategyQuizAnswers?: Record<string, any>;
  strategies?: Strategy[];
  // Plano de Ação (Metodologia v2): data de início e horizonte (em meses) escolhidos pelo artista.
  // Alimentam o cronograma sugerido em cascata por prioridade (engines.seedScheduledPlan).
  planStart?: string; // YYYY-MM-DD
  planMonths?: number;
  revenueGoals?: any[];
  executiveSummary?: string;
  spotifyProfile?: SpotifyProfile;
  spotifyCatalog?: {
    albums: SpotifyCatalogAlbum[];
    tracks: SpotifyCatalogTrack[];
  };
  // Diagnóstico de criação (persistido p/ não regerar) + base de conhecimento da Nyta.
  chartmetricProfile?: ChartmetricProfile;
  quizDiagnostic?: QuizDiagnostic;
  diagnostic?: ArtistDiagnostic;
  realIndex?: RealIndex;
}

export interface Artist {
  id: string;
  user_id: string;
  name: string;
  content: ArtistContent;
  // Estado de pagamento do perfil (cobrança única R$199,90):
  //   is_locked === true  → perfil criado, aguardando pagamento (pendente);
  //   is_locked === false → perfil pago/ativo (planejamento liberado).
  is_locked?: boolean;
  purchased_at?: string | null; // quando a cobrança única foi confirmada
  created_at?: string;
  updated_at?: string;
  // preenchido quando o usuário é membro (não dono)
  role?: 'owner' | 'member';
}

// Cobrança única (R$199,90) de criação/desbloqueio de um perfil de artista.
export interface ArtistPurchase {
  id: string;
  artist_id: string;
  user_id: string;
  asaas_payment_id: string | null;
  amount: number;
  billing_type?: 'PIX' | 'CREDIT_CARD' | null;
  status: 'pending' | 'received' | 'failed' | 'refunded';
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ArtistMember {
  id: string;
  artist_id: string;
  email: string;
  user_id?: string | null;
  name?: string | null;
  access_levels: AccessLevel[];
  status: 'pending' | 'active' | 'rejected';
  created_at?: string;
}

// ---- Catálogo ------------------------------------------------------------------------------

export type CatalogStatus =
  | 'composition'
  | 'recording'
  | 'production'
  | 'mixing'
  | 'mastering'
  | 'released';

export interface Split {
  id: string;
  name: string;
  role: string;
  percentage: number;
}

// Uma observação/interação no histórico da faixa.
export interface TrackHistoryNote {
  id: string;
  author: string;
  text: string;
  at: string; // ISO
}

export interface CatalogItem {
  id: string;
  artist_id: string;
  title: string;
  status: CatalogStatus | string;
  // Membro responsável pela faixa.
  assignee?: { id: string; name: string } | null;
  // Histórico de observações/interações da equipe.
  history?: TrackHistoryNote[];
  genre?: string | null;
  release_date?: string | null;
  isrc?: string | null;
  upc?: string | null;
  bpm?: string | null;
  key?: string | null;
  duration?: string | null;
  lyrics?: string | null;
  cover_image?: string | null;
  cover_image_name?: string | null;
  audio_file?: string | null;
  audio_file_name?: string | null;
  composition_splits?: Split[];
  recording_splits?: Split[];
  created_at?: string;
  updated_at?: string;
}

// ---- Agenda --------------------------------------------------------------------------------

export type EventType = 'release' | 'rehearsal' | 'studio' | 'meeting' | 'interview' | 'task' | 'other';
export type EventStatus = 'scheduled' | 'completed' | 'cancelled';

export interface AgendaEvent {
  id: string;
  artist_id: string;
  title: string;
  type: EventType | string;
  date: string; // YYYY-MM-DD
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  status: EventStatus | string;
  // Sincronização com o Plano de Ação: task_id liga o evento à tarefa de origem;
  // source distingue evento criado na Agenda ('manual') do gerado por tarefa ('action_plan').
  task_id?: string | null;
  source?: 'manual' | 'action_plan' | string;
  created_at?: string;
  updated_at?: string;
}

// ---- Métricas (ChatMetrics) ----------------------------------------------------------------

export interface MetricsSnapshot {
  id: string;
  artist_id: string;
  monthly_listeners: number | null;
  followers: number | null;
  popularity: number | null;
  track_count: number | null;
  top_cities: Array<{ name: string; country: string; listeners: number }> | null;
  growth_data: Record<string, number> | null;
  deltas: Record<string, { abs: number; pct: number }> | null;
  period_days: number | null;
  collected_at: string;
}

// ---- Notificações --------------------------------------------------------------------------

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type NotificationSource = 'manual' | 'auto_task' | 'auto_event' | 'auto_metric';

export interface NotificationItem {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  message?: string | null;
  link?: string | null;
  read: boolean;
  metadata?: Record<string, any> | null;
  created_at?: string;
  // Campos de lembretes automatizados (Maestra PRO)
  artist_id?: string | null;
  source?: NotificationSource;
  reference_type?: string | null;
  reference_id?: string | null;
  scheduled_for?: string | null;
  status?: 'active' | 'cancelled' | 'delivered';
}

export interface MusicGenre {
  id: string;
  name: string;
}
