// ─────────────────────────────────────────────────────────────────────────────
// Motor REAL v4 — Diagnóstico de carreira da Maestra (metodologia Anita Carvalho)
//
// Puro e determinístico (sem rede/Deno) para (a) ser testado via Jest aqui e
// (b) ser copiado para o edge `artist-diagnostic` no deploy (Deno não importa de
// fora do dir da função). MANTER OS DOIS ARQUIVOS EM SINCRONIA — há um teste que
// compara o hash dos dois e quebra o build se divergirem (§13.3).
//
// Spec: "Diagnóstico REAL · Especificação Metodológica e Técnica · v4" (06/09/2026),
// que substitui integralmente a v3. Quatro dimensões R·E·A·L, cada uma acende ou
// apaga por regra própria; o padrão de 4 bits endereça 1 de 16 perfis. As quatro
// notas NUNCA são somadas: o REAL é tipológico, não um escore composto (§1.3).
//
//   R: 3 componentes de peso igual, escala interpolada em log; acende com TODOS os
//      presentes ≥ 0,52 e no mínimo 2 presentes. §6
//   E: saldo ANUAL ajustado (receita − investimento decomposto) × bônus de estrutura;
//      acende em R$ 120 mil. §7
//   A: 3 componentes de limiar (engajamento SUSPENSO); acende com os 3 altos e
//      exige conversão presente. §8
//   L: 4 componentes ponderados com renormalização + trava de plataforma. §9
//
// "Alto" = CUTS.HIGH_Z (0,52). TOP ICON = CUTS.TOPICON_Z (1,64). O que cada um
// significa muda por dimensão e está declarado no §1.5 da spec.
//
// Nota 0–100 por dimensão (§11) — invariante: a nota NUNCA contradiz o aceso/apagado.
//   apagada ∈ [0, 69]   ·   acesa ∈ [70, 100]   ·   linha de acender fixa em 70.
//
// Toda constante mora em CUTS, com `calibrationVersion` gravada no diagnóstico (§12).
// ─────────────────────────────────────────────────────────────────────────────

export type Frequencia = 'esporadico' | 'lancamento' | 'perene';
export type PaganteFaixa = 'ate50' | '51-69' | '70-94' | '95-100';
export type ImprensaTipo = 'imprensa' | 'blogs' | 'influenciadores' | 'tv' | 'youtube' | 'podcasts';
export type ImprensaPorte = 'pequeno' | 'medio' | 'grande';
export interface ImprensaCell { tipo: ImprensaTipo; porte: ImprensaPorte }

/** Origem de cada dado de entrada (§1.5.5, §13.1). Sai no relatório como "informado por você". */
export type Proveniencia = 'api' | 'self' | 'absent';

/** Os 6 tipos de contratante do cachê médio (§3.2), na ordem do quiz. */
export type TipoDeContratante = 'corporativos' | 'orgaosPublicos' | 'particulares' | 'produtores' | 'casasDeShow' | 'outros';
export const TIPOS_DE_CONTRATANTE: readonly TipoDeContratante[] = ['corporativos', 'orgaosPublicos', 'particulares', 'produtores', 'casasDeShow', 'outros'];

/** As 9 fontes de receita fora dos shows (§3.2), na ordem do quiz. */
export type FonteDeReceita = 'distribuidora' | 'editora' | 'associacao' | 'publi' | 'patrocinios' | 'aulas' | 'produtos' | 'financiamento' | 'outras';
export const FONTES_DE_RECEITA: readonly FonteDeReceita[] = ['distribuidora', 'editora', 'associacao', 'publi', 'patrocinios', 'aulas', 'produtos', 'financiamento', 'outras'];

/** Valor de uma fonte: reais, ou "não sei" (conta zero e vira sinalização no relatório, §4). */
export type ValorDeFonte = number | 'nao_sei';
export type RevenueSources = Partial<Record<FonteDeReceita, ValorDeFonte>>;
export type CacheByType = Partial<Record<TipoDeContratante, number>>;

/** Faixa de alíquota do CNPJ — [EXIBIÇÃO], não entra no índice (§7.2). */
export type Aliquota = 'ate6' | '6-10' | '10-15' | 'acima15' | 'nao_sei';
/** Ponto médio de cada faixa, para a receita líquida estimada do relatório (§7.5). */
export const ALIQUOTA_PCT: Record<Exclude<Aliquota, 'nao_sei'>, number> = { ate6: 0.06, '6-10': 0.08, '10-15': 0.125, acima15: 0.18 };

export interface RealInputsV4 {
  spotifyConnected: boolean;
  /** Quando a Chartmetric respondeu — proveniência dos campos de API (§13.1). */
  fetchedAt?: string | null;

  // ── API (number | null; null = a consulta não trouxe o campo) ──
  spotifyListeners: number | null;      // R c1 + A c1 (conversão)
  igFollowers: number | null;           // R c2
  tiktokFollowers: number | null;       // R c2
  youtubeMonthlyViews: number | null;   // R c3 — média de até 3 meses (§6.1)
  spotifyFollowers: number | null;      // A c1 (conversão)
  deezerFans: number | null;            // [EXIBIÇÃO] §8.5
  igEngagement: number | null;          // [SUSPENSO] §8.2 — só exibição
  tiktokEngagement: number | null;
  youtubeEngagement: number | null;
  editorialPlaylists: number | null;    // L c3 — null = não consultado; 0 = consulta vazia (§4)
  radioAirplay180d: number | null;      // L c4 — execuções em 180 dias

  // ── Autodeclaração de R, só quando a API não trouxe (§3.2). Zero = "não tenho essa rede" = ausente.
  igFollowersSelf: number | null;
  tiktokFollowersSelf: number | null;
  youtubeViews28dSelf: number | null;

  // ── E · base anual, últimos 12 meses (§7) ──
  showsPerYear: number;
  cacheByType: CacheByType;             // cachê médio por tipo de contratante; 0 = não atendeu
  revenueSources: RevenueSources;       // 9 fontes fora shows; 'nao_sei' conta 0 e sinaliza
  /**
   * O investimento decomposto (v4.1, §7.2). Antes era um número só, e um número só não permite
   * dizer nada útil: com o custo POR SHOW separado do fixo, saem a margem por show e o ponto de
   * equilíbrio, que são as duas contas que o artista de fato usa para decidir cachê.
   *
   * Nenhum dos três aceita "não sei" — zero ou estimativa (§4).
   */
  custoPorShow: number;          // banda, equipe técnica, o que sai do bolso do artista
  custoFixoMensal: number;       // contador, assessoria, gestão de redes, estúdio fixo
  investLancamentos12m: number;  // gravação, clipe, campanha de lançamento
  temCnpj: boolean;
  aliquota: Aliquota | null;            // [EXIBIÇÃO]
  temEmpresario: boolean;

  // ── A (§8) ──
  fazBilheteria: boolean;
  pagantePct: PaganteFaixa | null;

  // ── L (§9) ──
  premios: number;                      // nível 0..6 — o 6 (prêmio internacional) É VÁLIDO (§15)
  imprensaRepercussao: boolean;
  imprensaMatrix: ImprensaCell[];       // um porte por tipo, o MAIOR (§3.2)
  imprensaFrequencia: Frequencia;
}

/** Um dado de entrada com a origem declarada (§13.1). */
export interface Medida { value: number | null; source: Proveniencia; fetchedAt?: string | null }

export interface ComponentDebug {
  key: string;
  label: string;
  z: number | null;      // z do componente (null = componente de limiar, ou ausente)
  high: boolean;         // ≥ HIGH_Z / acima do corte "alto" da dimensão
  topicon: boolean;      // ≥ TOPICON_Z / acima do corte de elite
  present: boolean;      // §13.1 — o inverso de "ausente"; sai do cálculo quando falso
  /** Piso da régua DESTE componente: o menor z da tabela dele. Ver `progressoAteOCorte`. */
  zPiso?: number;
  /** Origem do dado que alimentou o componente, quando ele vem de um campo com proveniência. */
  source?: Proveniencia;
}

export interface RealIndexV4 {
  version: 4;
  calibrationVersion: string;
  profile: { key: string; name: string; description: string; insights: string[] };
  pattern: { r: boolean; e: boolean; a: boolean; l: boolean };
  boletim: { r: number; e: number; a: number; l: number };   // 0–100 por dimensão (§11)
  cutLine: { r: number; e: number; a: number; l: number };   // linha de acender no boletim (= 70)
  topIcon: boolean;                                          // TOP ICON global (§10)
  dimTopIcon: { r: boolean; e: boolean; a: boolean; l: boolean };
  components: {
    r: ComponentDebug[];
    a: ComponentDebug[];
    l: {
      premios: { nota: number; high: boolean; topicon: boolean; present: true };
      imprensa: { nota: number; high: boolean; present: true };
      playlists: { bin: 0 | 1 | null; present: boolean };   // null = não consultado (§4)
      radio: { bin: 1 | null; present: boolean };           // <6 execuções ou sem dado = ausente (§9.5)
      notaL: number;
      sinalPlataforma: boolean;
    };
    e: { saldoAjustado: number; high: boolean; topicon: boolean; present: true };
  };
  /** Tudo que o §13.1 manda gravar do E, para o relatório e para reconstituir a conta. */
  revenue: {
    showsPerYear: number;
    cacheByType: CacheByType;
    cacheMedio: number;
    receitaShows: number;
    receitaOutras: Partial<Record<FonteDeReceita, { valor: number; naoSei: boolean }>>;
    receitaOutrasTotal: number;
    receitaAnual: number;
    custoPorShow: number;
    custoShowsAnual: number;
    custoFixoMensal: number;
    custoFixoAnual: number;
    investLancamentos12m: number;
    investimentoAnual: number;
    saldo: number;
    bonus: number;
    saldoAjustado: number;
    aliquota: Aliquota | null;
    receitaLiquidaEstimada: number | null;   // null quando a alíquota não foi informada
    /** Cachê médio menos custo por show. `null` quando não há como saber (§7.5). */
    margemPorShow: number | null;
    /** Shows por ano que cobrem o custo fixo. `null` quando a margem não é positiva. */
    pontoEquilibrioShows: number | null;
  };
  /** [EXIBIÇÃO] §8.5 e §11.3.5 — "informativo, não entra no diagnóstico". */
  engagement: Record<'instagram' | 'tiktok' | 'youtube', { value: number; cut: number; above: boolean } | null>;
  deezerFans: number | null;
  /** Proveniência campo a campo (§13.1). */
  inputs: Record<string, Medida>;
  /** O que a interface precisa dizer em texto (§11.3). */
  flags: {
    naoSeiFontes: FonteDeReceita[];
    saldoNegativo: boolean;
    travaL: boolean;                 // nota_L ≥ 0,70 e a trava de plataforma barrou
    aSemBilheteria: boolean;
    rComponentesAusentes: string[];
    rComponentesInsuficientes: boolean;   // menos de 2 presentes: R não pode acender (§6.4)
    conversaoAusente: boolean;
    autodeclarados: string[];        // campos com source "self"
  };
  raw: RealInputsV4;
  computedAt: string;
}

/**
 * Traduz um quiz da v3 para as chaves da v4.
 *
 * Existe por causa do app nativo: ele só atualiza quando o usuário quiser na loja, e uma versão
 * antiga continua mandando `showsPerMonth`, um `cache` único e as sete fontes MENSAIS. Sem esta
 * tradução, a montagem das entradas não acharia nenhuma dessas chaves e devolveria zero em tudo —
 * o E e o A apagariam para essas pessoas, sem erro nenhum e sem nada no log.
 *
 * A conversão de base é a parte que importa: a v3 perguntava por MÊS (shows, cachê e cada fonte de
 * receita) e a v4 lê por ANO. Só o investimento já era anual nas duas.
 */
export function daQuizV3(qz: Record<string, any> | null | undefined): Record<string, any> {
  if (!qz || typeof qz !== 'object') return {};
  // Só traduz o que É da v3: se já vier com as chaves novas, devolve como está.
  if (qz.showsPerYear != null || qz.cacheByType != null) return qz;
  const num0 = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const DE_PARA: Record<string, FonteDeReceita> = {
    streaming: 'distribuidora', direitos: 'associacao', publi: 'publi',
    aulas: 'aulas', editais: 'patrocinios', venda: 'produtos', outros: 'outras',
  };
  const revenueSources: Partial<Record<FonteDeReceita, number>> = {};
  for (const [k, v] of Object.entries(qz.revenueSources ?? {})) {
    const destino = DE_PARA[k];
    if (destino) revenueSources[destino] = (revenueSources[destino] ?? 0) + Math.max(0, num0(v)) * 12;
  }
  return {
    ...qz,
    showsPerYear: Math.max(0, Math.round(num0(qz.showsPerMonth) * 12)),
    // A v3 tinha um cachê médio só, sem tipo de contratante. Cai em "outros", que é o que ele é:
    // a média de tudo. O relatório mostra uma barra só, e é honesto — não inventamos uma
    // distribuição por tipo que a pessoa nunca informou.
    cacheByType: { outros: Math.max(0, num0(qz.cache)) },
    revenueSources,
    // O `investimento` da v3 era UM número, já anual ("quanto você investiu nos últimos 12
    // meses"). Ele cai inteiro em `investLancamentos12m`, que é o único balde anual dos três —
    // assim o saldo de um quiz antigo continua exatamente o mesmo de antes.
    //
    // Os outros dois ficam em zero, e isso é honesto: nunca perguntamos o custo por show nem o
    // fixo mensal a essas pessoas. A consequência é que a margem por show e o ponto de
    // equilíbrio não aparecem para elas, que é melhor do que aparecerem errados.
    investLancamentos12m: Math.max(0, num0(qz.investimento)),
    custoPorShow: 0,
    custoFixoMensal: 0,
    // A v3 não coletava alíquota nem autodeclaração de R: ficam ausentes, como devem.
    aliquota: null,
  };
}

// ════════════════════ CORTES — parâmetros de calibração (§12.1) ════════════════════
// Toda alteração aqui incrementa `calibrationVersion` (AAAA.MM) e fica gravada no diagnóstico.
export const CUTS = {
  calibrationVersion: '2026.09',
  HIGH_Z: 0.52,        // [SPEC] percentil 70 da referência da dimensão
  TOPICON_Z: 1.64,     // [SPEC] percentil 95
  r: {
    // [SPEC] Loud & Clear + extensão de elite [PROVISÓRIO] acima de 1M.
    listeners: { edges: [1e3, 5e3, 2e4, 1e5, 5e5, 1e6, 5e6, 2e7], zs: [-1.5, -1.2, -0.9, -0.6, -0.3, 0.0, 0.8, 1.7, 2.4] },
    // [PROVISÓRIO] Âncoras de corte fixadas: acende em 100 mil, gabarita em 1 milhão — os valores
    // 0,52 e 1,64 nas posições 4 e 5 SÃO o HIGH_Z e o TOPICON_Z. Se as constantes mudarem numa
    // recalibração, estas âncoras mudam junto (§6.2).
    social: { edges: [1e3, 5e3, 2e4, 1e5, 1e6, 5e6], zs: [-1.5, -1.2, -0.7, -0.2, 0.52, 1.64, 2.4] },
    // [PROVISÓRIO] Mesma lógica: acende em 1 milhão de views/mês, gabarita em 10 milhões.
    video: { edges: [1e4, 5e4, 2e5, 1e6, 1e7, 5e7], zs: [-1.5, -1.2, -0.7, -0.2, 0.52, 1.64, 2.4] },
    minComponentsPresent: 2,
    youtubeMovingAverageMonths: 3,
  },
  e: {
    saldoAcende: 120_000,       // [SPEC] ≈ P95 da renda individual nacional (PNAD Contínua)
    saldoTopIcon: 1_200_000,    // [SPEC] uma ordem de grandeza acima
    bonusEmpresario: 0.20,      // [SPEC] Pesquisa Empresariamento 2025
    bonusCnpj: 0.10,            // [SPEC]
  },
  a: {
    conversion: { minListeners: 1_000, high: 0.25, topicon: 0.333 },  // [PROVISÓRIO] benchmark 1:3–1:6
    shows: { high: 48, topicon: 240 },                                // [PROVISÓRIO] por ANO (4/mês e 20/mês)
    pagante: { high: ['70-94', '95-100'], topicon: ['95-100'] } as { high: readonly PaganteFaixa[]; topicon: readonly PaganteFaixa[] },
    // [SUSPENSO] §8.2 — cobertura de API entre 21% e 35%. Só exibição, jamais no cálculo.
    engagement: { suspended: true, display: { instagram: { high: 2.8, topicon: 6 }, tiktok: { high: 9, topicon: 15 }, youtube: { high: 4, topicon: 8 } } },
  },
  l: {
    weights: { premios: 0.30, imprensa: 0.30, playlists: 0.20, radio: 0.20 },  // [SPEC] §9.1
    highFrom: 0.70,
    // Níveis 0..6: 0=nunca, 1=indicação local, 2=ganhou local, 3=indicação nacional,
    // 4=ganhou nacional, 5=indicação internacional, 6=ganhou internacional.
    premiosNota: [0.0, 0.3, 0.5, 0.7, 0.85, 0.95, 1.0],
    premiosMaxLevel: 6,          // §15 — a v3 cortava em 5 e rebaixava quem ganhou prêmio internacional
    premiosHighFrom: 0.70,
    premiosTopIconFrom: 0.95,
    imprensaWeights: {           // [SPEC] §9.3 — pesos por tipo × porte [pequeno, médio, grande]
      imprensa: [75, 85, 100],
      tv: [80, 90, 100],
      influenciadores: [50, 70, 90],
      youtube: [50, 65, 80],
      podcasts: [30, 55, 80],
      blogs: [30, 45, 60],
    } as Record<ImprensaTipo, [number, number, number]>,
    imprensaFreq: { esporadico: 0.80, lancamento: 1.00, perene: 1.30 } as Record<Frequencia, number>,  // [SPEC]
    radioMinSpins180d: 6,        // [PROVISÓRIO] §9.5 — abaixo disso o componente é AUSENTE, não zero
    travaExcecaoPremios: 0.95,   // §9.6 — prêmio internacional dispensa o sinal de plataforma
  },
} as const;

const PORTE_IDX: Record<ImprensaPorte, 0 | 1 | 2> = { pequeno: 0, medio: 1, grande: 2 };

const round2 = (n: number) => Math.round(n * 100) / 100;
// Tira o ruído de ponto flutuante de uma média ponderada antes de comparar com corte ou virar nota.
// Sem isso, 0,30×0,95 + 0,30 + 0,20 + 0,20 dá 0,9849999999999999 em vez de 0,985: a nota do L cai de
// 99 para 98, e um valor que deveria bater exatamente no corte de 0,70 pode ficar abaixo e apagar a
// dimensão. Os pesos e as notas têm no máximo 2 casas, então 6 casas preservam todo valor legítimo.
const semRuido = (n: number) => Math.round(n * 1e6) / 1e6;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// ─────────────────────────── §5.1 · Escala normalizada ancorada ───────────────────────────
//
// A v3 usava degraus (`v <= edges[i] → zs[i]`): dentro de uma faixa, dobrar os ouvintes não movia
// a nota, e no fim da faixa um ouvinte a mais dava um salto. A v4 mantém as MESMAS âncoras e
// interpola entre elas NO LOGARITMO do valor bruto, que é a escala natural de um indicador de
// cauda longa — a distância de 10 mil para 100 mil vale o mesmo que de 100 mil para 1 milhão.
//
// Convenção de índice (declarada na spec): `zs[k]` é o valor da faixa que COMEÇA em `edges[k-1]`,
// e `zs[0]` é a faixa abaixo de `edges[0]`. Por isso a âncora vale no INÍCIO da faixa, e em
// `x = edges[i]` a função devolve exatamente `zs[i+1]` — há teste de borda para isso (§13.3).
export function escala(x: number | null | undefined, tabela: { edges: readonly number[]; zs: readonly number[] }): number | null {
  if (x == null || !Number.isFinite(x) || x <= 0) return null;   // AUSENTE
  const { edges, zs } = tabela;
  const n = edges.length;
  if (x < edges[0]) return zs[0];
  if (x >= edges[n - 1]) return zs[n];
  let i = 0;
  while (i < n - 1 && x >= edges[i + 1]) i += 1;
  const zIni = zs[i + 1];
  const zFim = zs[i + 2];
  const frac = (Math.log(x) - Math.log(edges[i])) / (Math.log(edges[i + 1]) - Math.log(edges[i]));
  return zIni + frac * (zFim - zIni);
}

// ─────────────────────────── §4 · Política de dados ausentes ───────────────────────────
//
// Um lugar só para a regra: API com valor > 0 vence; senão a autodeclaração > 0, marcada como
// "self"; senão ausente. Zero informado no quiz significa "não tenho essa rede" (§3.2) e é
// ausência, não zero seguidores — por isso não distingue de vazio aqui.
function resolver(api: number | null | undefined, self: number | null | undefined, fetchedAt?: string | null): Medida {
  if (api != null && Number.isFinite(api) && api > 0) return { value: api, source: 'api', fetchedAt: fetchedAt ?? null };
  if (self != null && Number.isFinite(self) && self > 0) return { value: self, source: 'self' };
  return { value: null, source: 'absent' };
}

// Componente = média dos sub-z presentes. Sem nenhum presente → null (componente ausente).
function mediaDosPresentes(subZs: (number | null)[]): number | null {
  const present = subZs.filter((z): z is number => z != null);
  if (!present.length) return null;
  return present.reduce((s, z) => s + z, 0) / present.length;
}

function zComp(key: string, label: string, z: number | null, zPiso: number, source?: Proveniencia): ComponentDebug {
  return {
    key, label,
    z: z == null ? null : round2(z),
    high: z != null && z >= CUTS.HIGH_Z,
    topicon: z != null && z >= CUTS.TOPICON_Z,
    present: z != null,
    zPiso,
    source,
  };
}

// ─────────────────────────── §11 · Boletim ───────────────────────────
//
// belowCut arredonda mas TRAVA em 69: a metade "apagada" é [0, 69], nunca 70 (invariante §11.1).
// Sem isso, um valor logo abaixo do corte arredondaria para 70 e contradiria o "apagado" — a nota
// jamais pode contradizer a leitura binária.
const belowCut = (x: number) => clamp(Math.round(x), 0, 69);

/** Progresso do componente entre o piso da TABELA DELE e a linha de acender: 0 no piso, 1 no corte. */
function progressoAteOCorte(z: number | null, zPiso: number): number {
  if (z == null) return 0;
  return clamp((z - zPiso) / (CUTS.HIGH_Z - zPiso), 0, 1);
}

/** Progresso do componente entre acender e o TOP ICON: 0 em 0,52, 1 em 1,64. */
function progressoAteOTopIcon(z: number | null): number {
  if (z == null) return 0;
  return clamp((z - CUTS.HIGH_Z) / (CUTS.TOPICON_Z - CUTS.HIGH_Z), 0, 1);
}

// Boletim de R (§11.2): média do PROGRESSO dos componentes presentes, nas duas metades da régua.
//
// Por que distância e não contagem: os três componentes de R são z contínuos, dá para dizer o
// quanto falta. Pela contagem, quem estivesse encostado no corte receberia a mesma nota de quem
// não tem nada, e um seguidor a mais poderia saltar dezenas de pontos de uma vez.
//
// Cada componente é medido contra o piso da PRÓPRIA tabela: as três não começam no mesmo z, e um
// piso único faria "sem dado nenhum" valer mais que zero.
function boletimR(comps: ComponentDebug[], acende: boolean): number {
  if (!comps.length) return 0;
  if (!acende) {
    const media = comps.reduce((s, c) => s + progressoAteOCorte(c.z, c.zPiso ?? CUTS.r.listeners.zs[0]), 0) / comps.length;
    return belowCut(media * 70);
  }
  const media = comps.reduce((s, c) => s + progressoAteOTopIcon(c.z), 0) / comps.length;
  return Math.round(70 + media * 30);
}

// Boletim de A (§8.4): por CONTAGEM sobre os 3 componentes.
//
// Diferente de R, os componentes de A são limiares (passou / não passou). Não existe "quão perto"
// de fazer bilheteria — então contar é a única leitura honesta.
function boletimA(comps: { high: boolean; topicon: boolean }[], acende: boolean): number {
  const n = comps.length;
  if (!n) return 0;
  if (!acende) return belowCut((comps.filter((c) => c.high).length / n) * 70);
  return Math.round(70 + (comps.filter((c) => c.topicon).length / n) * 30);
}

// ─────────────────────────── §10 · 16 perfis ───────────────────────────
interface ProfileDef { name: string; description: string; insights: string[] }
export const PROFILES: Record<string, ProfileDef> = {
  '1111': { name: 'Icon', description: 'A carreira plena: shows, faturamento, audiência digital e reconhecimento. As quatro áreas altas, um patamar que pouquíssimas carreiras alcançam.', insights: ['Você está nas quatro frentes. Poucas carreiras chegam aqui. O desafio agora é sustentar e escalar.', 'Com tudo alto, o risco é dispersão. Um plano mantém o foco no que realmente move o ponteiro.'] },
  '1110': { name: 'Hit', description: 'Você vende, lota casas e tem audiência digital forte. O público te ama e o mercado responde, mas a crítica e o reconhecimento ainda não acompanham.', insights: ['Você vende e tem público, mas a crítica e os prêmios ainda não acompanham. Isso pode ser uma escolha, ou uma oportunidade.', 'Legitimação não vem sozinha: ela é resultado de estratégia de imprensa e posicionamento intencional.'] },
  '1101': { name: 'Spotlight', description: 'Fatura, tem audiência digital e tem reconhecimento. Uma carreira sólida que acontece principalmente fora dos palcos.', insights: ['Sua carreira acontece principalmente fora dos palcos. Digital, faturamento e reconhecimento funcionam bem, e o ao vivo ainda não é central.', 'Shows não são o único caminho. Mas quando o ao vivo entrar, tende a amplificar tudo o que já funciona.'] },
  '1100': { name: 'Digital', description: 'Sua carreira acontece nas plataformas: você fatura e tem audiência digital relevante. Palco e reconhecimento ainda não fazem parte da história.', insights: ['Sua carreira existe nas plataformas e fatura. Mas sem palco e sem reconhecimento da crítica, ela fica exposta às mudanças de algoritmo.', 'Diversificar as fontes de receita e de visibilidade é o próximo passo natural.'] },
  '1011': { name: 'Underpaid', description: 'Você tem palco, audiência e reconhecimento. Todos te valorizam, mas isso não vira dinheiro: você entrega muito mais do que recebe.', insights: ['Você entrega muito em palco, público e reconhecimento, e recebe pouco financeiramente. Isso tem nome: subprecificação ou falta de gestão comercial.', 'O problema não é talento nem demanda. É a conversão do que você tem em receita.'] },
  '1010': { name: 'Potential', description: 'Presença nos palcos e audiência digital: gente te vê e te acompanha. Mas não vira faturamento nem reconhecimento, e há muito potencial à espera.', insights: ['Você tem presença nos palcos e audiência digital, então gente te vê. Mas ainda não vira dinheiro nem reconhecimento. O potencial está claro; falta a estratégia que o converte.', 'O caminho daqui costuma passar por gestão comercial e posicionamento mais intencional.'] },
  '1001': { name: 'Hype', description: 'O buzz existe: audiência digital e reconhecimento da crítica. Falta o palco e o faturamento acompanharem o burburinho.', insights: ['O buzz existe: alcance digital e reconhecimento da crítica. Mas sem palco e sem faturamento, é um castelo no digital.', 'Converter buzz em carreira sustentável exige estrutura: shows, venda, agenda.'] },
  '1000': { name: 'Influencer', description: 'Grande presença digital: gente te segue e te acompanha. Mas ainda não se traduz em shows, faturamento ou reconhecimento da crítica.', insights: ['Você tem alcance digital relevante, gente te segue e te acompanha. Mas ainda não se traduz em shows, receita ou reconhecimento.', 'Alcance sem conversão é oportunidade não capturada. A estratégia muda isso.'] },
  '0111': { name: 'Analog', description: 'Uma carreira consagrada no mundo real: shows, faturamento e reconhecimento da crítica. Mas sua presença digital não acompanha o tamanho da carreira.', insights: ['Sua carreira é real e consolidada no mundo físico: shows, faturamento e reconhecimento funcionam. Mas o digital não acompanha o tamanho do que você faz.', 'Artistas analógicos muitas vezes têm o maior potencial digital represado. Com estratégia, esse é um gap que fecha rápido.'] },
  '0110': { name: 'Rising', description: 'A base do ao vivo funciona: você se apresenta e fatura com isso. Carreira com fundamento sólido, mas ainda pouco conhecida no digital e pela crítica.', insights: ['A base do ao vivo funciona: você se apresenta e fatura com isso. Uma carreira com fundamento sólido que ainda não aparece no digital nem para a crítica.', 'O próximo nível exige amplificação: digital e imprensa podem multiplicar o que já existe.'] },
  '0101': { name: 'Outlier', description: 'Você fatura e tem reconhecimento, sem depender de palco frequente nem de grande audiência digital. Combinação rara, comum em nichos ou bastidor.', insights: ['Você fatura e tem reconhecimento, sem depender de palco frequente nem de grande audiência digital. Uma combinação rara, comum em nichos, bastidores ou mercados muito específicos.', 'O desafio aqui costuma ser escala: como crescer sem perder o que faz o modelo funcionar.'] },
  '0100': { name: 'Moneymaker', description: 'Você fatura com música, mas sem palco expressivo, audiência ou reconhecimento. Muitas vezes é o perfil de quem trabalha nos bastidores ou em nichos comerciais.', insights: ['Você fatura com música, mas sem palco expressivo, audiência ou reconhecimento. É um perfil comum em quem trabalha nos bastidores: produção, composição, eventos corporativos.', 'Se quiser construir uma carreira de frente, o próximo passo é visibilidade intencional.'] },
  '0011': { name: 'Bet', description: 'O setor acredita em você: você se apresenta e a crítica valida o seu trabalho. Mas o grande público digital e o faturamento ainda não chegaram.', insights: ['O setor acredita em você: você se apresenta e a crítica valida. Mas o grande público digital e o faturamento ainda não chegaram.', 'Você tem o reconhecimento sem o alcance. Estratégia digital e gestão comercial são os próximos passos naturais.'] },
  '0010': { name: 'Paradox', description: 'Você se apresenta, mas isso ainda não virou faturamento, audiência ou reconhecimento. Toda a carreira está concentrada no palco.', insights: ['Toda a sua carreira está concentrada no palco, mas ainda não vira faturamento, audiência digital ou reconhecimento.', 'Você mostra ao vivo. O próximo passo é fazer o palco trabalhar para você fora dele também.'] },
  '0001': { name: 'Cult', description: 'A crítica e a imprensa reconhecem o seu trabalho, mas sem palco, audiência ou faturamento que acompanhem. É a carreira de culto, ou a que o grande mercado ainda não descobriu.', insights: ['A crítica e a imprensa reconhecem o que você faz. Sem palco, público e faturamento, isso fica no papel.', 'Reconhecimento sem estrutura não se sustenta. É hora de construir as outras frentes.'] },
  '0000': { name: 'Beginner', description: 'Você está no começo da jornada, construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda carreira que um dia chegou ao Icon.', insights: ['Você está no começo da jornada, construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda carreira que um dia chegou ao Icon.', 'O valor de saber onde você está agora é enorme: dá direção. E direção é o que separa quem chega de quem fica rodando.'] },
};

// ═════════════════════════════ Cálculo principal ═════════════════════════════
export function computeRealIndexV4(input: RealInputsV4): RealIndexV4 {
  const sp = input.spotifyConnected;
  const at = input.fetchedAt ?? null;
  const inputs: Record<string, Medida> = {};
  const marcar = (campo: string, m: Medida) => { inputs[campo] = m; return m; };

  // ════════ R · Reach (§6) ════════
  //
  // Sem Spotify: os ouvintes recebem o PISO da tabela (presente e baixo, §4) em vez de ausente.
  // É o que impede R de acender para quem declarou não ter perfil, sem tirar o componente da
  // conta — o boletim continua mostrando o progresso das outras frentes.
  const mListeners = sp
    ? marcar('spotifyListeners', resolver(input.spotifyListeners, null, at))
    : marcar('spotifyListeners', { value: null, source: 'absent' });
  const zListeners = sp ? escala(mListeners.value, CUTS.r.listeners) : CUTS.r.listeners.zs[0];

  const mIg = marcar('igFollowers', resolver(input.igFollowers, input.igFollowersSelf, at));
  const mTiktok = marcar('tiktokFollowers', resolver(input.tiktokFollowers, input.tiktokFollowersSelf, at));
  const mYoutube = marcar('youtubeMonthlyViews', resolver(input.youtubeMonthlyViews, input.youtubeViews28dSelf, at));

  // Sub-item ausente sai da média do componente; o componente é calculado com os presentes (§4).
  const zSocial = mediaDosPresentes([escala(mIg.value, CUTS.r.social), escala(mTiktok.value, CUTS.r.social)]);
  const zVideo = escala(mYoutube.value, CUTS.r.video);

  // Proveniência do componente social: "self" se qualquer um dos dois foi autodeclarado.
  const socialSource: Proveniencia = mIg.source === 'self' || mTiktok.source === 'self'
    ? 'self'
    : (mIg.source === 'api' || mTiktok.source === 'api' ? 'api' : 'absent');

  const rComps: ComponentDebug[] = [
    zComp('listeners', 'Ouvintes mensais Spotify', zListeners, CUTS.r.listeners.zs[0], sp ? mListeners.source : 'absent'),
    zComp('socialFollowers', 'Seguidores de rede (Instagram e TikTok)', zSocial, CUTS.r.social.zs[0], socialSource),
    zComp('videoViews', 'Consumo de vídeo (YouTube)', zVideo, CUTS.r.video.zs[0], mYoutube.source),
  ];
  const rPresentes = rComps.filter((c) => c.present);
  // §6.4 — R exige no mínimo 2 componentes presentes para PODER acender. Com um só, o sinal é
  // raso demais para sustentar a leitura de alcance, e a dimensão fica apagada por definição.
  const rSuficiente = rPresentes.length >= CUTS.r.minComponentsPresent;
  const rHigh = rSuficiente && rPresentes.every((c) => c.high);
  const rTopIcon = rSuficiente && rPresentes.every((c) => c.topicon);

  // ════════ E · Earnings (§7) — base ANUAL, saldo, não receita ════════
  const showsPerYear = Math.max(0, Math.round(Number(input.showsPerYear) || 0));
  const cacheByType: CacheByType = {};
  const cachesInformados: number[] = [];
  for (const tipo of TIPOS_DE_CONTRATANTE) {
    const v = Math.max(0, Number(input.cacheByType?.[tipo]) || 0);
    cacheByType[tipo] = v;
    if (v > 0) cachesInformados.push(v);
  }
  // Limitação declarada (§7.2): assume distribuição igual dos shows entre os tipos informados.
  // É a aproximação aceita em troca de não perguntar a quantidade de shows por tipo.
  const cacheMedio = cachesInformados.length ? cachesInformados.reduce((s, v) => s + v, 0) / cachesInformados.length : 0;
  const receitaShows = showsPerYear * cacheMedio;

  const receitaOutras: Partial<Record<FonteDeReceita, { valor: number; naoSei: boolean }>> = {};
  const naoSeiFontes: FonteDeReceita[] = [];
  let receitaOutrasTotal = 0;
  for (const fonte of FONTES_DE_RECEITA) {
    const bruto = input.revenueSources?.[fonte];
    const naoSei = bruto === 'nao_sei';
    // "Não sei" conta ZERO na soma e vira sinalização no relatório (§4). Contar zero subestima o
    // E de quem não controla as próprias receitas — e é exatamente isso que o texto do §11.3.4
    // devolve ao artista como gestão a fazer.
    const valor = naoSei ? 0 : Math.max(0, Number(bruto) || 0);
    receitaOutras[fonte] = { valor, naoSei };
    if (naoSei) naoSeiFontes.push(fonte);
    receitaOutrasTotal += valor;
  }

  const receitaAnual = receitaShows + receitaOutrasTotal;
  // §7.2 (v4.1) — o investimento anual é a soma de três parcelas. O custo por show multiplica os
  // MESMOS `showsPerYear` que o cachê: é isso que torna a margem por show e o ponto de equilíbrio
  // comparáveis, em vez de dois números que não se falam.
  const custoPorShow = Math.max(0, Number(input.custoPorShow) || 0);
  const custoFixoMensal = Math.max(0, Number(input.custoFixoMensal) || 0);
  const investLancamentos12m = Math.max(0, Number(input.investLancamentos12m) || 0);
  const custoShowsAnual = custoPorShow * showsPerYear;
  const custoFixoAnual = custoFixoMensal * 12;
  const investimentoAnual = custoShowsAnual + custoFixoAnual + investLancamentos12m;
  const saldo = receitaAnual - investimentoAnual;
  // Estrutura é BÔNUS na v4 (a v3 descontava de quem não tinha). Premiar a formalização em vez de
  // punir a ausência dela mantém o índice do lado de quem está começando.
  const bonus = 1 + (input.temEmpresario ? CUTS.e.bonusEmpresario : 0) + (input.temCnpj ? CUTS.e.bonusCnpj : 0);
  const saldoAjustado = saldo * bonus;
  const eHigh = saldoAjustado >= CUTS.e.saldoAcende;
  const eTopIcon = saldoAjustado >= CUTS.e.saldoTopIcon;

  // Impostos e comissão de empresário NÃO entram no índice (§7.2): descontá-los penalizaria a
  // formalização e o empresariamento, que o método premia com bônus. A alíquota alimenta só esta
  // linha de exibição.
  const aliquota = input.aliquota ?? null;
  const pct = aliquota && aliquota !== 'nao_sei' ? ALIQUOTA_PCT[aliquota] : null;
  const receitaLiquidaEstimada = pct == null ? null : Math.round(receitaAnual * (1 - pct));

  // §7.5 — margem por show e ponto de equilíbrio.
  //
  // A margem só existe quando há cachê informado: sem ele não há o que subtrair, e devolver o
  // custo negativo como "margem" seria inventar. O ponto de equilíbrio só existe com margem
  // positiva — com margem zero ou negativa nenhuma quantidade de shows cobre o fixo, e é isso
  // que o texto do relatório precisa dizer, não um número enorme.
  const margemPorShow = cacheMedio > 0 ? cacheMedio - custoPorShow : null;
  const pontoEquilibrioShows = margemPorShow != null && margemPorShow > 0 && custoFixoAnual > 0
    ? Math.ceil(custoFixoAnual / margemPorShow)
    : null;

  // ════════ A · Audience (§8) — 3 componentes; engajamento SUSPENSO ════════
  const mSpFollowers = marcar('spotifyFollowers', sp ? resolver(input.spotifyFollowers, null, at) : { value: null, source: 'absent' });
  // §8.1/§8.3 — a conversão exige um piso de ouvintes: abaixo de 1.000 a razão é ruído, e um
  // punhado de seguidores sobre uma base minúscula viraria uma conversão de elite.
  const convPresente = sp
    && mListeners.value != null && mListeners.value >= CUTS.a.conversion.minListeners
    && mSpFollowers.value != null;
  const conv = convPresente ? mSpFollowers.value! / mListeners.value! : null;
  const convComp: ComponentDebug = {
    key: 'conversion', label: 'Conversão (seguidores ÷ ouvintes)', z: null,
    high: conv != null && conv >= CUTS.a.conversion.high,
    topicon: conv != null && conv >= CUTS.a.conversion.topicon,
    present: convPresente,
    source: convPresente ? 'api' : 'absent',
  };
  const showsComp: ComponentDebug = {
    key: 'shows', label: 'Shows por ano', z: null,
    high: showsPerYear >= CUTS.a.shows.high,
    topicon: showsPerYear >= CUTS.a.shows.topicon,
    present: true, source: 'self',
  };
  // §8.3 — "não faz bilheteria" NÃO é ausência de dado: é leitura BAIXA. Quem não é atração
  // principal de show pago não comprova público próprio, e é esse o diferencial da dimensão.
  const pagHigh = input.fazBilheteria && input.pagantePct != null && CUTS.a.pagante.high.includes(input.pagantePct);
  const pagTop = input.fazBilheteria && input.pagantePct != null && CUTS.a.pagante.topicon.includes(input.pagantePct);
  const pagComp: ComponentDebug = {
    key: 'pagante', label: 'Público pagante', z: null,
    high: pagHigh, topicon: pagTop, present: true, source: 'self',
  };
  const aComps = [convComp, showsComp, pagComp];
  const aHigh = convPresente && aComps.every((c) => c.high);
  const aTopIcon = aHigh && aComps.every((c) => c.topicon);

  // ════════ L · Legitimacy (§9) ════════
  const premioLvl = clamp(Math.round(Number(input.premios) || 0), 0, CUTS.l.premiosMaxLevel);
  const notaPremios = CUTS.l.premiosNota[premioLvl];
  const premiosHigh = notaPremios >= CUTS.l.premiosHighFrom;
  const premiosTopIcon = notaPremios >= CUTS.l.premiosTopIconFrom;

  // Imprensa: MAIOR peso das células marcadas ÷ 100 × multiplicador de frequência (§9.3).
  // Máximo, não média: a matriz mede o TETO de legitimação alcançado, então marcar também um
  // veículo menor não pode baixar a nota. O volume entra pela frequência.
  let notaImprensa = 0;
  if (input.imprensaRepercussao && input.imprensaMatrix?.length) {
    const pesos = input.imprensaMatrix
      .map((c) => CUTS.l.imprensaWeights[c.tipo]?.[PORTE_IDX[c.porte]])
      .filter((w): w is number => Number.isFinite(w));
    if (pesos.length) {
      const base = Math.max(...pesos) / 100;
      const mult = CUTS.l.imprensaFreq[input.imprensaFrequencia] ?? 1.0;
      notaImprensa = Math.min(1, base * mult);
    }
  }

  // Playlists (§4): null = não consultado (sem Spotify) → ausente. 0 = a consulta voltou vazia,
  // o componente está PRESENTE valendo zero. A diferença importa: no primeiro caso os pesos
  // renormalizam, no segundo o zero pesa.
  const playlistsPresente = sp && input.editorialPlaylists != null;
  const playlistsBin: 0 | 1 | null = playlistsPresente ? (input.editorialPlaylists! >= 1 ? 1 : 0) : null;
  // Rádio (§9.5): 1 a 5 execuções contam como AUSENTE, não como zero — tratá-las como zero
  // deixaria um artista com poucas execuções pior do que um sem nenhuma.
  const radioPresente = sp && input.radioAirplay180d != null && input.radioAirplay180d >= CUTS.l.radioMinSpins180d;
  const radioBin: 1 | null = radioPresente ? 1 : null;

  const lParts: { w: number; v: number }[] = [
    { w: CUTS.l.weights.premios, v: notaPremios },
    { w: CUTS.l.weights.imprensa, v: notaImprensa },
  ];
  if (playlistsBin != null) lParts.push({ w: CUTS.l.weights.playlists, v: playlistsBin });
  if (radioBin != null) lParts.push({ w: CUTS.l.weights.radio, v: radioBin });
  const wSum = lParts.reduce((s, p) => s + p.w, 0);
  const notaL = wSum ? semRuido(lParts.reduce((s, p) => s + p.w * p.v, 0) / wSum) : 0;

  // Trava de plataforma COM EXCEÇÃO (§9.6). Prêmios e imprensa são autodeclarados; playlist e
  // rádio são os únicos sinais verificados de L, e a trava exige ao menos um. A exceção reconhece
  // o artista com prêmio internacional sem curadoria de plataforma: é o sinal autodeclarado mais
  // raro do método e o único conferível em listas públicas.
  const sinalPlataforma = playlistsBin === 1 || radioBin === 1;
  const excecaoPremios = notaPremios >= CUTS.l.travaExcecaoPremios;
  const lHigh = notaL >= CUTS.l.highFrom && (sinalPlataforma || excecaoPremios);
  const lTopIcon = lHigh && premiosTopIcon;
  const travaL = notaL >= CUTS.l.highFrom && !lHigh;

  // ════════ §10 · Padrão → perfil ════════
  const pattern = { r: rHigh, e: eHigh, a: aHigh, l: lHigh };
  const key = `${rHigh ? 1 : 0}${eHigh ? 1 : 0}${aHigh ? 1 : 0}${lHigh ? 1 : 0}`;
  const def = PROFILES[key];

  // ════════ §11 · Boletim 0–100 ════════
  const boletimE = (() => {
    if (saldoAjustado <= 0) return 0;
    if (saldoAjustado < CUTS.e.saldoAcende) return belowCut((saldoAjustado / CUTS.e.saldoAcende) * 70);
    if (saldoAjustado < CUTS.e.saldoTopIcon) return Math.round(70 + 30 * (Math.log10(saldoAjustado / CUTS.e.saldoAcende) / Math.log10(CUTS.e.saldoTopIcon / CUTS.e.saldoAcende)));
    return 100;
  })();
  // Usa lHigh (não só notaL): com a trava, nota_L pode passar de 0,70 SEM acender — belowCut
  // trava em 69 e preserva a invariante (§9.7, §11.1).
  const boletimL = lHigh
    ? Math.round(70 + ((notaL - CUTS.l.highFrom) / (1 - CUTS.l.highFrom)) * 30)
    : belowCut((notaL / CUTS.l.highFrom) * 70);

  const eng = (['instagram', 'tiktok', 'youtube'] as const).map((net) => {
    const value = net === 'instagram' ? input.igEngagement : net === 'tiktok' ? input.tiktokEngagement : input.youtubeEngagement;
    const cut = CUTS.a.engagement.display[net];
    if (value == null || !Number.isFinite(value)) return null;
    return { value: round2(Number(value)), cut: cut.high, above: Number(value) > cut.high };
  });

  const autodeclarados = Object.entries(inputs).filter(([, m]) => m.source === 'self').map(([k]) => k);

  return {
    version: 4,
    calibrationVersion: CUTS.calibrationVersion,
    profile: { key, name: def.name, description: def.description, insights: def.insights },
    pattern,
    boletim: {
      r: boletimR(rSuficiente ? rPresentes : rComps, rHigh),
      e: boletimE,
      a: boletimA(aComps, aHigh),
      l: boletimL,
    },
    cutLine: { r: 70, e: 70, a: 70, l: 70 },
    topIcon: rTopIcon && eTopIcon && aTopIcon && lTopIcon,
    dimTopIcon: { r: rTopIcon, e: eTopIcon, a: aTopIcon, l: lTopIcon },
    components: {
      r: rComps,
      a: aComps,
      l: {
        premios: { nota: notaPremios, high: premiosHigh, topicon: premiosTopIcon, present: true },
        imprensa: { nota: round2(notaImprensa), high: notaImprensa >= CUTS.l.highFrom, present: true },
        playlists: { bin: playlistsBin, present: playlistsBin != null },
        radio: { bin: radioBin, present: radioBin != null },
        notaL: round2(notaL),
        sinalPlataforma,
      },
      e: { saldoAjustado: Math.round(saldoAjustado), high: eHigh, topicon: eTopIcon, present: true },
    },
    revenue: {
      showsPerYear,
      cacheByType,
      cacheMedio: Math.round(cacheMedio),
      receitaShows: Math.round(receitaShows),
      receitaOutras,
      receitaOutrasTotal: Math.round(receitaOutrasTotal),
      receitaAnual: Math.round(receitaAnual),
      custoPorShow: Math.round(custoPorShow),
      custoShowsAnual: Math.round(custoShowsAnual),
      custoFixoMensal: Math.round(custoFixoMensal),
      custoFixoAnual: Math.round(custoFixoAnual),
      investLancamentos12m: Math.round(investLancamentos12m),
      investimentoAnual: Math.round(investimentoAnual),
      saldo: Math.round(saldo),
      bonus: round2(bonus),
      saldoAjustado: Math.round(saldoAjustado),
      aliquota,
      receitaLiquidaEstimada,
      margemPorShow: margemPorShow == null ? null : Math.round(margemPorShow),
      pontoEquilibrioShows,
    },
    engagement: { instagram: eng[0], tiktok: eng[1], youtube: eng[2] },
    deezerFans: input.deezerFans ?? null,
    inputs,
    flags: {
      naoSeiFontes,
      saldoNegativo: saldo < 0,
      travaL,
      aSemBilheteria: !input.fazBilheteria,
      rComponentesAusentes: rComps.filter((c) => !c.present).map((c) => c.key),
      rComponentesInsuficientes: !rSuficiente,
      conversaoAusente: !convPresente,
      autodeclarados,
    },
    raw: input,
    computedAt: new Date().toISOString(),
  };
}

export default computeRealIndexV4;
