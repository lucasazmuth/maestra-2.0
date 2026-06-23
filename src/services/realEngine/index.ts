// ─────────────────────────────────────────────────────────────────────────────
// Motor REAL v2 — Diagnóstico de carreira da Maestra (Anita Carvalho)
//
// Puro e determinístico (sem rede/Deno) para (a) ser testado via Jest aqui e
// (b) ser copiado para o edge `artist-diagnostic` no deploy (padrão _shared do repo).
//
// Spec: "Motor REAL — Especificação Consolidada". Quatro dimensões R·E·A·L, cada
// uma acende/apaga; o padrão de 4 bits mapeia 1 de 16 perfis (Beginner → Icon).
//   R: 3 componentes (⅓), acende com 2 de 3 altos.
//   E: 5 sinais ponderados (0–1), alto se ≥ 0,70.
//   A: 4 componentes (25%), acende com 3 de 4 altos.
//   L: 4 componentes (25%), acende com 3 de 4 — e os 2 de API sozinhos NÃO bastam.
//
// Ausência de dado (regra-mãe do doc, Parte 3):
//   • SEM Spotify  → todo componente de API recebe z mínimo (opção B).
//   • COM Spotify, sub-item ausente (ex.: sem TikTok) → EXCLUI o sub-item da média
//     do componente (não pune). Se o componente inteiro fica sem dado → ele é baixo.
//
// ⚠️ CORTES: marcados [SPEC] (vêm do doc) ou [PROPOSTA] (julgamento informado meu —
// top 5–10% / âncoras Loud&Clear — o doc deixa estes em aberto e sanciona ajuste).
// Tudo centralizado em CUTS para revisão/ajuste num lugar só.
// ─────────────────────────────────────────────────────────────────────────────

export type FonteRenda = 'musical' | 'nao_musical';
export type Cnpj = 'pf' | 'mei' | 'ltda';
export type Empresario = 'nao' | 'proprio' | 'parente' | 'mercado';

export interface RealInputsV2 {
  spotifyConnected: boolean;
  // ── API (number | null; null = ausente) ──
  spotifyListeners: number | null;      // R c1
  igFollowers: number | null;           // R c2
  tiktokFollowers: number | null;       // R c2
  youtubeMonthlyViews: number | null;   // R c3
  tiktokVideoViews: number | null;      // R c3 (média móvel 3m — o fetch já entrega suavizado)
  spotifyFollowers: number | null;      // A c1
  deezerFans: number | null;            // A c1
  igEngagement: number | null;          // A c2 (taxa %, 0..100)
  youtubeEngagement: number | null;     // A c2
  tiktokEngagement: number | null;      // A c2
  editorialPlaylists: number | null;    // L c3 (contagem)
  radioAirplay: number | null;          // L c4 (execuções/airplay)
  // ── Autorrelato (sempre presentes) ──
  showsPerMonth: number;                // A c3 — pergunta "por mês"; reescalono ×12 p/ a tabela anual
  avgAudience: number;                  // A c4 — público médio por show
  faturamento: number;                  // E s1 — R$/mês (média 12m)
  fonteRenda: FonteRenda;               // E s2
  investimento: number;                 // E s3 — R$ nos últimos 12m
  cnpj: Cnpj;                           // E s4
  empresario: Empresario;               // E s5
  premios: number;                      // L c1 — nível 0..4
  imprensa: number;                     // L c2 — nível 0..3
}

export interface ComponentDebug {
  key: string;
  label: string;
  z: number | null;   // null = ausente (não computado)
  high: boolean;
  absent: boolean;
}

export interface RealIndexV2 {
  version: 2;
  profile: { key: string; name: string; description: string; insights: string[] };
  pattern: { r: boolean; e: boolean; a: boolean; l: boolean };
  boletim: { r: number; e: number; a: number; l: number };       // 0–100 por dimensão
  cutLine: { r: number; e: number; a: number; l: number };       // linha de "alto" no boletim (0–100)
  components: {
    r: ComponentDebug[];
    a: ComponentDebug[];
    l: ComponentDebug[];
    e: { signals: { key: string; label: string; score: number; weight: number }[]; score: number };
  };
  inputs: RealInputsV2;
  computedAt: string;
}

const Z_MIN = -1.5;        // z mínimo p/ ausência sem Spotify (opção B)
const HIGH_CUT_Z = 0;      // [PROPOSTA] um componente "acende" quando z ≥ 0

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// value <= edges[i] → zs[i]; acima do último edge → zs[last]. (zs.length === edges.length+1)
function zByBuckets(v: number, edges: number[], zs: number[]): number {
  if (!Number.isFinite(v)) return zs[0];
  for (let i = 0; i < edges.length; i++) if (v <= edges[i]) return zs[i];
  return zs[zs.length - 1];
}

// ════════════════════ CORTES (z-tables, pesos, mapeamentos) ════════════════════
export const CUTS = {
  // ── R ──
  spotifyListeners: { // [PROPOSTA] âncora Loud&Clear: 1M ouvintes = alto (top ~5% mundial)
    edges: [10_000, 50_000, 200_000, 1_000_000, 5_000_000, 20_000_000],
    zs: [-1.5, -1.0, -0.5, -0.2, 0.6, 1.6, 2.5],
  },
  socialFollowers: { // [PROPOSTA] IG/TikTok seguidores (alcance); alto ≈ >500k
    edges: [1_000, 10_000, 50_000, 200_000, 500_000, 2_000_000],
    zs: [-1.5, -1.0, -0.5, -0.2, 0.3, 1.2, 2.3],
  },
  youtubeViews: { // [SPEC] views/mês — alto = 5M/mês
    edges: [10_000, 50_000, 200_000, 1_000_000, 5_000_000, 20_000_000],
    zs: [-1.2, -0.7, -0.2, 0.5, 1.2, 1.9, 2.5],
  },
  tiktokViews: { // [SPEC] views/mês (média 3m) — alto ≈ 20M
    edges: [50_000, 250_000, 1_000_000, 5_000_000, 20_000_000, 100_000_000],
    zs: [-1.2, -0.7, -0.2, 0.4, 1.1, 1.8, 2.5],
  },
  // ── A ──
  musicFollowers: { // [PROPOSTA] Spotify followers; alto ≈ >250k
    edges: [1_000, 10_000, 50_000, 250_000, 1_000_000, 5_000_000],
    zs: [-1.5, -1.0, -0.4, -0.1, 0.5, 1.4, 2.4],
  },
  deezerFans: { // Deezer fans; alto ≈ >100k (Anita: plataforma nicho no BR → corte mais justo que SP)
    edges: [1_000, 10_000, 50_000, 100_000, 500_000, 2_000_000],
    zs: [-1.5, -1.0, -0.4, -0.1, 0.5, 1.4, 2.4],
  },
  engagement: { // [PROPOSTA] taxa de engajamento % (IG/YT/TikTok); alto ≈ >4%
    edges: [0.5, 1, 2, 4, 7, 12],
    zs: [-1.5, -1.0, -0.5, -0.1, 0.5, 1.4, 2.3],
  },
  showsAnnual: { // [SPEC] tabela recalibrada n=40 (12 meses); input = showsPerMonth×12
    edges: [0, 5, 15, 30, 60],
    zs: [-1.5, -1.0, -0.5, 0.5, 1.0, 1.5],
  },
  publicoPorShow: { // [PROPOSTA] público médio por show; alto ≈ >500
    edges: [50, 200, 500, 2_000, 10_000],
    zs: [-1.2, -0.6, -0.1, 0.7, 1.6, 2.4],
  },
  // ── L ──
  // [PROPOSTA] prêmios/imprensa por nível → z; "alto" exige nível alto (júri/imprensa de peso).
  premiosZ: [-1.0, -0.3, 0.2, 1.0, 2.0], // níveis 0..4 (nunca → internacional)
  premiosHighFrom: 3,                    // alto = nacional ou internacional
  imprensaZ: [-1.0, 0.0, 1.0, 2.0],      // níveis 0..3
  imprensaHighFrom: 2,                   // alto = nacional ou internacional
  editorialPlaylists: { // [PROPOSTA] contagem de playlists editoriais; alto ≈ ≥3
    edges: [0, 1, 3, 10, 30],
    zs: [-1.2, -0.4, 0.1, 0.8, 1.6, 2.4],
  },
  radioAirplay: { // [PROPOSTA — alta incerteza] total de execuções; alto ≈ >50
    edges: [0, 10, 50, 200, 1_000],
    zs: [-1.0, -0.3, 0.2, 1.0, 1.8, 2.5],
  },
  // ── E (sinais 0–1 + pesos) ──
  e: {
    weights: { faturamento: 0.25, fonte: 0.20, investimento: 0.20, cnpj: 0.175, empresario: 0.175 }, // [SPEC]
    highFrom: 0.70, // [SPEC] E alto se ≥ 0,70
    // [PROPOSTA] faturamento R$/mês → 0–1 (faixas antigas + âncora R$50k = elite)
    faturamento: { edges: [0, 1_000, 5_000, 10_000, 20_000, 50_000], scores: [0.0, 0.10, 0.30, 0.50, 0.65, 0.85, 1.0] },
    fonte: { musical: 1.0, nao_musical: 0.0 },                  // [SPEC]
    cnpj: { pf: 0.0, mei: 0.6, ltda: 1.0 },                     // [SPEC]
    empresario: { nao: 0.0, proprio: 0.3, parente: 0.7, mercado: 1.0 }, // [SPEC]
    investHealthyRatio: 0.30, // [SPEC-ish] reinvestir até ~30% do faturamento = saudável
  },
  // ── Boletim 0–100 ──
  boletim: { zLo: -2, zHi: 2.5 }, // [PROPOSTA] z∈[-2,2.5] → 0–100 linear
} as const;

// ── Combinação por dimensão (quantos componentes altos p/ acender) ──
const COMBO = { r: 2, a: 3, l: 3 }; // [SPEC]: R 2/3, A 3/4, L 3/4

// ─────────────────────────── Helpers de componente ───────────────────────────

// z de um sub-item de API respeitando a regra de ausência.
function apiZ(value: number | null, table: { edges: readonly number[]; zs: readonly number[] }, spotifyConnected: boolean): number | null {
  if (!spotifyConnected) return Z_MIN;            // opção B: ausência conta como z mínimo
  if (value == null) return null;                 // sub-item ausente (com Spotify) → excluir
  return zByBuckets(value, table.edges as number[], table.zs as number[]);
}

// Componente = média dos sub-z presentes (exclui null). Sem nenhum presente → null (ausente → baixo).
function componentZ(subZs: (number | null)[]): number | null {
  const present = subZs.filter((z): z is number => z != null);
  if (!present.length) return null;
  return present.reduce((s, z) => s + z, 0) / present.length;
}

const isHigh = (z: number | null) => z != null && z >= HIGH_CUT_Z;

function comp(key: string, label: string, z: number | null): ComponentDebug {
  return { key, label, z: z == null ? null : round2(z), high: isHigh(z), absent: z == null };
}

// Boletim: z médio dos componentes (null = Z_MIN p/ exibição) → 0–100.
function zTo100(z: number): number {
  const { zLo, zHi } = CUTS.boletim;
  return Math.round(clamp((z - zLo) / (zHi - zLo), 0, 1) * 100);
}
function dimBoletim(components: ComponentDebug[]): number {
  const zs = components.map((c) => (c.z == null ? Z_MIN : c.z));
  return zTo100(zs.reduce((s, z) => s + z, 0) / zs.length);
}

// ─────────────────────────── E (5 sinais) ───────────────────────────
function bucketScore(v: number, edges: readonly number[], scores: readonly number[]): number {
  if (!Number.isFinite(v)) return scores[0];
  for (let i = 0; i < edges.length; i++) if (v <= edges[i]) return scores[i];
  return scores[scores.length - 1];
}
function investimentoScore(invest12: number, faturamentoMes: number): number {
  // [PROPOSTA] proporcional ao faturamento. Investir sem faturar = risco (baixo);
  // reinvestir até ~30% do faturamento = saudável (1,0); acima disso decai (sobre-exposição).
  if (faturamentoMes <= 0) return invest12 > 0 ? 0.10 : 0.20;
  const r = (invest12 / 12) / faturamentoMes;
  const h = CUTS.e.investHealthyRatio;
  if (r <= h) return clamp(0.40 + (r / h) * 0.60, 0.40, 1.0);
  return clamp(1.0 - (r - h) * 0.6, 0.40, 1.0);
}

// ─────────────────────────── 16 perfis ───────────────────────────
interface ProfileDef { name: string; description: string; insights: string[] }
export const PROFILES: Record<string, ProfileDef> = {
  '1111': { name: 'Icon', description: 'A carreira plena: shows, faturamento, audiência digital e reconhecimento. As quatro áreas altas — pouquíssimas artistas alcançam.', insights: ['Você está nas quatro frentes. Poucas carreiras chegam aqui — o desafio agora é sustentar e escalar.', 'Com tudo alto, o risco é dispersão. Um plano mantém o foco no que realmente move o ponteiro.'] },
  '1110': { name: 'Hit', description: 'Você vende, lota casas e tem audiência digital forte. O público te ama e o mercado responde — mas a crítica e o reconhecimento ainda não acompanham.', insights: ['Você vende e tem público — mas a crítica e os prêmios ainda não acompanham. Isso pode ser uma escolha, ou uma oportunidade.', 'Legitimação não vem sozinha: ela é resultado de estratégia de imprensa e posicionamento intencional.'] },
  '1101': { name: 'Spotlight', description: 'Fatura, tem audiência digital e é reconhecida — uma carreira sólida que acontece principalmente fora dos palcos.', insights: ['Sua carreira acontece principalmente fora dos palcos — digital, faturamento e reconhecimento funcionam bem. O ao vivo ainda não é central.', 'Shows não são o único caminho — mas quando o ao vivo entrar, tende a amplificar tudo o que já funciona.'] },
  '1100': { name: 'Digital', description: 'Sua carreira acontece nas plataformas — você fatura e tem audiência digital relevante. Mas palco e reconhecimento ainda não fazem parte da história.', insights: ['Sua carreira existe nas plataformas e fatura. Mas sem palco e sem reconhecimento da crítica, ela fica exposta às mudanças de algoritmo.', 'Diversificar as fontes de receita e de visibilidade é o próximo passo natural.'] },
  '1011': { name: 'Underpaid', description: 'Você tem palco, audiência e reconhecimento — todos te valorizam. Mas isso não vira dinheiro. Você entrega muito mais do que recebe.', insights: ['Você entrega muito — palco, público, reconhecimento — e recebe pouco financeiramente. Isso tem nome: subprecificação ou falta de gestão comercial.', 'O problema não é talento nem demanda. É a conversão do que você tem em receita.'] },
  '1010': { name: 'Potential', description: 'Presença nos palcos e audiência digital — gente te vê e te acompanha. Mas não vira faturamento nem reconhecimento. Há muito potencial à espera.', insights: ['Você tem presença nos palcos e audiência digital — gente te vê. Mas ainda não vira dinheiro nem reconhecimento. O potencial está claro; falta a estratégia que o converte.', 'O caminho daqui costuma passar por gestão comercial e posicionamento mais intencional.'] },
  '1001': { name: 'Hype', description: 'O buzz existe — audiência digital e reconhecimento da crítica. Falta o palco e o faturamento acompanharem o burburinho.', insights: ['O buzz existe — alcance digital e reconhecimento da crítica. Mas sem palco e sem faturamento, é um castelo no digital.', 'Converter buzz em carreira sustentável exige estrutura: shows, venda, agenda.'] },
  '1000': { name: 'Influencer', description: 'Grande presença digital — gente te segue e te acompanha. Mas ainda não se traduz em shows, faturamento ou reconhecimento da crítica.', insights: ['Você tem alcance digital relevante — gente te segue e te acompanha. Mas ainda não se traduz em shows, receita ou reconhecimento.', 'Alcance sem conversão é oportunidade não capturada. A estratégia muda isso.'] },
  '0111': { name: 'Analog', description: 'Consagrada no mundo real — shows, faturamento e reconhecimento da crítica. Mas sua presença digital não acompanha o tamanho da carreira.', insights: ['Sua carreira é real e consolidada no mundo físico — shows, faturamento e reconhecimento funcionam. Mas o digital não acompanha o tamanho do que você faz.', 'Artistas analógicos muitas vezes têm o maior potencial digital represado. Com estratégia, esse é um gap que fecha rápido.'] },
  '0110': { name: 'Rising', description: 'A base do ao vivo funciona — você se apresenta e fatura com isso. Carreira com fundamento sólido, mas ainda pouco conhecida no digital e pela crítica.', insights: ['A base do ao vivo funciona — você se apresenta e fatura com isso. Uma carreira com fundamento sólido que ainda não aparece no digital nem para a crítica.', 'O próximo nível exige amplificação: digital e imprensa podem multiplicar o que já existe.'] },
  '0101': { name: 'Outlier', description: 'Você fatura e é reconhecida — sem depender de palco frequente nem de grande audiência digital. Combinação rara, comum em nichos ou bastidor.', insights: ['Você fatura e é reconhecida — sem depender de palco frequente nem de grande audiência digital. Uma combinação rara, comum em nichos, bastidores ou mercados muito específicos.', 'O desafio aqui costuma ser escala: como crescer sem perder o que faz o modelo funcionar.'] },
  '0100': { name: 'Moneymaker', description: 'Você fatura com música — mas sem palco expressivo, audiência ou reconhecimento. Muitas vezes o perfil de quem trabalha nos bastidores ou em nichos comerciais.', insights: ['Você fatura com música — mas sem palco expressivo, audiência ou reconhecimento. Perfil comum em quem trabalha nos bastidores: produção, composição, eventos corporativos.', 'Se quiser construir uma carreira de frente, o próximo passo é visibilidade intencional.'] },
  '0011': { name: 'Bet', description: 'O setor acredita em você — você se apresenta e é reconhecida pela crítica. Mas o grande público digital e o faturamento ainda não chegaram.', insights: ['O setor acredita em você — você se apresenta e a crítica valida. Mas o grande público digital e o faturamento ainda não chegaram.', 'Você tem o reconhecimento sem o alcance. Estratégia digital e gestão comercial são os próximos passos naturais.'] },
  '0010': { name: 'Paradox', description: 'Você se apresenta — mas isso ainda não virou faturamento, audiência ou reconhecimento. Toda a carreira concentrada no palco.', insights: ['Toda a sua carreira está concentrada no palco — mas ainda não vira faturamento, audiência digital ou reconhecimento.', 'Você mostra ao vivo. O próximo passo é fazer o palco trabalhar para você fora dele também.'] },
  '0001': { name: 'Cult', description: 'Reconhecida pela crítica e imprensa — mas sem palco, audiência ou faturamento que acompanhem. A artista de culto ou o grande mercado ainda não descobriu.', insights: ['A crítica e a imprensa reconhecem o que você faz — mas sem palco, público e faturamento, isso fica no papel.', 'Reconhecimento sem estrutura não se sustenta. É hora de construir as outras frentes.'] },
  '0000': { name: 'Beginner', description: 'Você está no começo da jornada — construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda artista que um dia chegou ao Icon.', insights: ['Você está no começo da jornada — construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda artista que um dia chegou ao Icon.', 'O valor de saber onde você está agora é enorme: dá direção. E direção é o que separa quem chega de quem fica rodando.'] },
};

// ═════════════════════════════ Cálculo principal ═════════════════════════════
export function computeRealIndexV2(input: RealInputsV2): RealIndexV2 {
  const sp = input.spotifyConnected;

  // ── R: 3 componentes (⅓), acende com 2 de 3 ──
  const rComps: ComponentDebug[] = [
    comp('listeners', 'Ouvintes mensais Spotify', apiZ(input.spotifyListeners, CUTS.spotifyListeners, sp)),
    comp('socialFollowers', 'Seguidores de redes (IG + TikTok)', componentZ([
      apiZ(input.igFollowers, CUTS.socialFollowers, sp),
      apiZ(input.tiktokFollowers, CUTS.socialFollowers, sp),
    ])),
    comp('videoViews', 'Consumo de vídeo (YouTube + TikTok)', componentZ([
      apiZ(input.youtubeMonthlyViews, CUTS.youtubeViews, sp),
      apiZ(input.tiktokVideoViews, CUTS.tiktokViews, sp),
    ])),
  ];
  const rHigh = rComps.filter((c) => c.high).length >= COMBO.r;

  // ── A: 4 componentes (25%), acende com 3 de 4 ──
  const showsAnnual = Math.max(0, input.showsPerMonth) * 12; // pergunta por mês → tabela anual
  const aComps: ComponentDebug[] = [
    comp('musicFollowers', 'Seguidores de plataformas de música', componentZ([
      apiZ(input.spotifyFollowers, CUTS.musicFollowers, sp),
      apiZ(input.deezerFans, CUTS.deezerFans, sp),
    ])),
    comp('engagement', 'Taxa de engajamento (IG + YT + TikTok)', componentZ([
      apiZ(input.igEngagement, CUTS.engagement, sp),
      apiZ(input.youtubeEngagement, CUTS.engagement, sp),
      apiZ(input.tiktokEngagement, CUTS.engagement, sp),
    ])),
    comp('shows', 'Shows por mês', zByBuckets(showsAnnual, CUTS.showsAnnual.edges as unknown as number[], CUTS.showsAnnual.zs as unknown as number[])),
    comp('publico', 'Público médio por show', zByBuckets(Math.max(0, input.avgAudience), CUTS.publicoPorShow.edges as unknown as number[], CUTS.publicoPorShow.zs as unknown as number[])),
  ];
  const aHigh = aComps.filter((c) => c.high).length >= COMBO.a;

  // ── L: 4 componentes (25%), 3 de 4 — e as 2 de API sozinhas não bastam ──
  const premioLvl = clamp(Math.round(input.premios), 0, 4);
  const imprensaLvl = clamp(Math.round(input.imprensa), 0, 3);
  const premiosComp: ComponentDebug = { key: 'premios', label: 'Prêmios', z: CUTS.premiosZ[premioLvl], high: premioLvl >= CUTS.premiosHighFrom, absent: false };
  const imprensaComp: ComponentDebug = { key: 'imprensa', label: 'Imprensa e TV', z: CUTS.imprensaZ[imprensaLvl], high: imprensaLvl >= CUTS.imprensaHighFrom, absent: false };
  const lComps: ComponentDebug[] = [
    premiosComp,
    imprensaComp,
    comp('playlists', 'Playlists editoriais', apiZ(input.editorialPlaylists, CUTS.editorialPlaylists, sp)),
    comp('airplay', 'Airplay de rádio', apiZ(input.radioAirplay, CUTS.radioAirplay, sp)),
  ];
  const lCount = lComps.filter((c) => c.high).length;
  const lHasJury = premiosComp.high || imprensaComp.high; // API sozinha não basta
  const lHigh = lCount >= COMBO.l && lHasJury;

  // ── E: 5 sinais ponderados (0–1), alto se ≥ 0,70 ──
  const s1 = bucketScore(Math.max(0, input.faturamento), CUTS.e.faturamento.edges, CUTS.e.faturamento.scores);
  const s2 = CUTS.e.fonte[input.fonteRenda] ?? 0;
  const s3 = investimentoScore(Math.max(0, input.investimento), Math.max(0, input.faturamento));
  const s4 = CUTS.e.cnpj[input.cnpj] ?? 0;
  const s5 = CUTS.e.empresario[input.empresario] ?? 0;
  const w = CUTS.e.weights;
  // E = média ponderada dos 5 sinais. Fonte não-musical = 0,0 no sinal de 20% — puxa forte pra baixo,
  // mas SEM teto (decisão da Anita: não zera a dimensão; o peso de 20% já honra "a música sustenta?").
  const eScore = w.faturamento * s1 + w.fonte * s2 + w.investimento * s3 + w.cnpj * s4 + w.empresario * s5;
  const eHigh = eScore >= CUTS.e.highFrom;
  const eSignals = [
    { key: 'faturamento', label: 'Faturamento mensal', score: round2(s1), weight: w.faturamento },
    { key: 'fonte', label: 'Principal fonte de renda', score: round2(s2), weight: w.fonte },
    { key: 'investimento', label: 'Investimento na carreira', score: round2(s3), weight: w.investimento },
    { key: 'cnpj', label: 'CNPJ', score: round2(s4), weight: w.cnpj },
    { key: 'empresario', label: 'Empresário/a', score: round2(s5), weight: w.empresario },
  ];

  // ── Padrão → perfil ──
  const pattern = { r: rHigh, e: eHigh, a: aHigh, l: lHigh };
  const key = `${rHigh ? 1 : 0}${eHigh ? 1 : 0}${aHigh ? 1 : 0}${lHigh ? 1 : 0}`;
  const def = PROFILES[key];

  // ── Boletim 0–100 + linha de corte ──
  const cutLineRAL = zTo100(HIGH_CUT_Z);
  return {
    version: 2,
    profile: { key, name: def.name, description: def.description, insights: def.insights },
    pattern,
    boletim: { r: dimBoletim(rComps), e: Math.round(eScore * 100), a: dimBoletim(aComps), l: dimBoletim(lComps) },
    cutLine: { r: cutLineRAL, e: Math.round(CUTS.e.highFrom * 100), a: cutLineRAL, l: cutLineRAL },
    components: { r: rComps, a: aComps, l: lComps, e: { signals: eSignals, score: round2(eScore) } },
    inputs: input,
    computedAt: new Date().toISOString(),
  };
}

export default computeRealIndexV2;
