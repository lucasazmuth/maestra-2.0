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

export interface TaskComment {
  id: string;
  body: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ActionTask {
  id: string;
  description: string;
  type?: ActionTaskType | string;
  owner?: string; // id/email do responsável (resolvido via artist_members)
  deadline?: string; // YYYY-MM-DD
  status: TaskStatus;
  comments?: TaskComment[];
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
// Respostas podem ser strings, números, booleanos ou estruturas (matriz de imprensa, composição
// de receita) a partir do diagnóstico V3 — por isso `any` no valor.
export interface QuizDiagnostic {
  answers: Record<string, any>;
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
// Tipo permissivo p/ suportar v1 (z-scores), v2 (boletim via z) e v3 (boletim §9 + TOP ICON).
export interface RealIndex {
  version?: number; // 3 = motor V3
  profile: { key: string; name: string; description: string; insights: string[] };
  // padrão R·E·A·L binarizado (true = alto).
  pattern: { r: boolean; e: boolean; a: boolean; l: boolean };
  // ── V3 (§9) ──
  boletim?: { r: number; e: number; a: number; l: number };   // 0–100 por dimensão
  cutLine?: { r: number; e: number; a: number; l: number };   // linha de acender (= 70 na V3)
  topIcon?: boolean;                                          // flag global (§8.2)
  dimTopIcon?: { r: boolean; e: boolean; a: boolean; l: boolean };
  components?: any;                                           // detalhamento por dimensão
  revenue?: { shows: number; foraShows: number; total: number; sources: Record<string, number> };
  engagement?: Record<'instagram' | 'tiktok' | 'youtube', { value: number; cut: number; above: boolean } | null>;
  // ── legado (v1) ──
  dimensions?: { r: number; e: number; a: number; l: number };
  realScore?: number;
  earningsUnknown?: boolean;
  // Dados brutos para o relatório (o "espelho") + contexto da Nyta. Shape varia por versão.
  inputs: Record<string, any>;
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

// Uma "foto" da trilha de voltar do wizard: o estado das respostas ANTES de uma pergunta ser
// respondida, o suficiente pra revivê-la ao clicar em "voltar". O `draft` vem sem os campos
// pesados de input (chartmetric/diagnóstico/spotify) — reidratados do draft atual ao restaurar.
export interface WizardBackTrailEntry {
  draft: ArtistContent;
  stage: string;
  // WidgetSpec do chat — tipado solto aqui pra não acoplar a interface de dados ao componente.
  widget: unknown;
  inputOn: boolean;
}

export interface ArtistContent {
  language?: 'pt' | 'en';
  step?: number;
  // Ausente/1 = escala antiga de 7 etapas; 2 = escala atual de 9 etapas.
  wizardVersion?: number;
  // Trilha do "voltar à pergunta anterior" — persistida pra funcionar após reload/entre sessões.
  // Gerada pelo próprio motor de beats (nunca diverge do nextBeat); limpa ao concluir o plano.
  wizardBackTrail?: WizardBackTrailEntry[];
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
  // Preenchidos SÓ para perfis onde o usuário é membro (não dono):
  //   access_levels → o que o dono concedeu no convite (governa o que o membro pode editar);
  //   owner_is_pro  → se o DONO do perfil é PRO (define o limite de faixas do perfil).
  access_levels?: AccessLevel[];
  owner_is_pro?: boolean;
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
  /** Campo livre da ficha: observações sobre a MÚSICA (a letra, que é da gravação, é `lyrics`). */
  details?: string | null;
  /** Quem mexeu por último. ⚠️ Não é `version_author_name`, que é quem CRIOU a gravação. */
  last_edited_by?: string | null;
  cover_image?: string | null;
  cover_image_name?: string | null;
  audio_file?: string | null;
  audio_file_name?: string | null;
  composition_splits?: Split[];
  recording_splits?: Split[];
  created_at?: string;
  updated_at?: string;
  /** Compatibilidade durante a migração para projetos/versões. */
  project_id?: string;
  version_id?: string;
  version_number?: number;
  version_stage?: string | null;
  version_status?: string | null;
  version_author_id?: string | null;
  version_author_name?: string | null;
  version_created_at?: string | null;
}

export type CatalogProjectStatus = CatalogStatus | 'archived' | 'on_hold' | string;
export type CatalogVersionStage = 'guia' | 'beat' | 'instrumental' | 'voz' | 'stems' | 'mix' | 'master' | 'referencia' | 'outro' | string;

export interface CatalogProject {
  id: string;
  artist_id: string;
  title: string;
  status: CatalogProjectStatus;
  genre?: string | null;
  bpm?: string | null;
  key?: string | null;
  /** Campo livre da ficha: observações sobre a música. */
  details?: string | null;
  /** Quem mexeu por último. */
  last_edited_by?: string | null;
  cover_image?: string | null;
  cover_image_name?: string | null;
  assignee?: { id: string; name: string } | null;
  /** UPC/EAN do LANÇAMENTO. É da música; o ISRC é da gravação e vive em `CatalogVersion`. */
  upc?: string | null;
  release_date?: string | null;
  primary_version_id?: string | null;
  created_at?: string;
  updated_at?: string;
  versions?: CatalogVersion[];
}

export interface CatalogVersion {
  id: string;
  project_id: string;
  version_number: number;
  stage: CatalogVersionStage;
  title?: string | null;
  status: string;
  audio_file?: string | null;
  audio_file_name?: string | null;
  duration?: string | null;
  bpm?: string | null;
  key?: string | null;
  /** ISRC desta GRAVAÇÃO. Cada versão tem o seu: o acústico não partilha o do original. */
  isrc?: string | null;
  genre?: string | null;
  lyrics?: string | null;
  author_id?: string | null;
  author_name?: string | null;
  author_avatar?: string | null;
  created_at?: string;
  updated_at?: string;
  files?: CatalogVersionFile[];
  /** A montagem: as faixas da linha do tempo, cada uma com os seus clipes. */
  tracks?: CatalogTrack[];
  /** O fader que fica depois de todos os outros. 0..1. */
  master_gain?: number;
  comments?: CatalogVersionComment[];
}

/**
 * Um arquivo de uma versão. `kind` diz o que ele é:
 *
 * - `stem`: uma PISTA da gravação (voz, bateria, baixo…), que toca junto com as outras na mesa
 *   do Espaço JAM. `position`, `gain` e `size_bytes` só fazem sentido aqui.
 * - `attachment`: um anexo qualquer (letra em PDF, referência), que não toca.
 *
 * O PAPEL do stem não é um campo: é o `name`, texto livre. Um enum obrigaria "808" e
 * "Vox dobra" a caírem em "outros".
 */
export interface CatalogVersionFile {
  id: string;
  version_id: string;
  name: string;
  file_url: string;
  file_type?: string | null;
  kind?: 'attachment' | 'stem' | null;
  /** A ordem da pista na mesa. Persiste: quem abre vê a mesma mesa que quem a montou. */
  position?: number;
  /** 0..1. O nível relativo é decisão de quem enviou, e persiste. Mutar e solo NÃO. */
  gain?: number | null;
  /** Para estimar memória e egress antes de descodificar. */
  size_bytes?: number | null;
  /** A duração do ficheiro inteiro, lida no envio: é o tamanho do clipe que nasce com ele. */
  duration_seconds?: number | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Uma PISTA da linha do tempo: uma faixa da mesa, com nome, cor, volume e mudo.
 *
 * A pista não tem áudio — ela é a faixa. O áudio vem dos CLIPES que moram nela.
 */
export interface CatalogTrack {
  id: string;
  version_id: string;
  name: string;
  /** A ordem na tela, de cima para baixo. */
  position: number;
  /** 0..1. O nível na mistura. Persiste: é decisão de quem montou. */
  gain: number;
  /** ⚠️ Persiste; o SOLO não. Mutar é decisão de arranjo, solar é gesto de escuta. */
  muted: boolean;
  /** O índice na paleta `CORES_DAS_PISTAS`. Guardado, para mover a pista não trocar a cor. */
  color_index: number;
  /** −1 esquerda, 0 centro, 1 direita. */
  pan?: number;
  /** Por agora só `audio` toca; os outros esperam o piano roll e o sequenciador. */
  kind?: 'audio' | 'synth' | 'piano' | 'drums';
  /**
   * Marcado para apagar, à espera do fim da sessão.
   *
   * ⚠️ NÃO CHEGA AQUI COM VALOR: a leitura da montagem já filtra os marcados, e o que esta tela
   * vê é sempre o que existe. O campo está no tipo porque a escrita passa por ele — apagar é
   * pôr a data, desfazer é tirá-la.
   */
  deleted_at?: string | null;
  clips?: CatalogClip[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Um CLIPE: um pedaço de um ficheiro, numa pista, num instante.
 *
 * Cortar ao meio não toca no ficheiro — nascem dois clipes que apontam para o mesmo áudio com
 * recortes diferentes. É por isso que a edição é instantânea e não destrói nada.
 */
export interface CatalogClip {
  id: string;
  track_id: string;
  file_id: string;
  /** Em que segundo da linha do tempo o clipe começa a soar. */
  start_seconds: number;
  /** A partir de que segundo DO FICHEIRO. Aparar a ponta esquerda mexe aqui. */
  offset_seconds: number;
  /** Quanto do ficheiro entra. Aparar a ponta direita mexe aqui. */
  duration_seconds: number;
  /** A URL do ficheiro, trazida junto pela leitura. Não é coluna desta tabela. */
  file_url?: string;
  /**
   * Marcado para apagar, à espera do fim da sessão.
   *
   * ⚠️ NÃO CHEGA AQUI COM VALOR: a leitura da montagem já filtra os marcados, e o que esta tela
   * vê é sempre o que existe. O campo está no tipo porque a escrita passa por ele — apagar é
   * pôr a data, desfazer é tirá-la.
   */
  deleted_at?: string | null;
  file_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogVersionComment {
  id: string;
  version_id: string;
  author_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  text: string;
  time_seconds?: number | null;
  created_at?: string;
  updated_at?: string;
}

/** Conversa geral do Espaço JAM. Diferente dos comentários, não pertence a uma versão/timestamp. */
export interface CatalogProjectMessage {
  id: string;
  project_id: string;
  author_id?: string | null;
  author_name: string;
  author_avatar?: string | null;
  text: string;
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

export type NotificationSource = 'manual' | 'auto_task' | 'auto_event' | 'auto_metric' | 'activation' | 'weekly';

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
