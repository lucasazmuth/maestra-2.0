// ─────────────────────────────────────────────────────────────────────────────
// Motor REAL v3 — Diagnóstico de carreira da Maestra (metodologia Anita Carvalho)
//
// Puro e determinístico (sem rede/Deno) para (a) ser testado via Jest aqui e
// (b) ser copiado para o edge `artist-diagnostic` no deploy (Deno não importa de
// fora do dir da função). MANTER OS DOIS ARQUIVOS EM SINCRONIA.
//
// Spec: "Índice REAL — Especificação Técnica" (V3). Quatro dimensões R·E·A·L, cada
// uma acende/apaga; o padrão de 4 bits mapeia 1 de 16 perfis (Beginner → Icon).
//   R: 3 componentes (⅓), acende com os 3 altos (régua mais rígida). §4
//   E: receita ancorada × modulador de estrutura; acende se receita_efetiva ≥ R$11.250. §5
//   A: 4 componentes (25%), acende com os 4 altos. §6
//   L: 4 componentes ponderados (.30/.30/.20/.20) com renormalização; acende se nota_L ≥ 0,70. §7
//
// "Alto" = percentil 70 (z ≥ 0,52). TOP ICON = percentil 95 (z ≥ 1,64). §3.2
//
// Ausência de dado (§3.3):
//   • SEM Spotify (opção A)  → todo componente de API recebe o z MÍNIMO da sua tabela.
//   • COM Spotify, sub-item ausente (opção B) → EXCLUI o sub-item da média do componente
//     (não pune). Componente inteiro sem dado → baixo.
//
// Nota 0–100 por dimensão (§9) — invariante: a nota NUNCA contradiz o aceso/apagado.
//   apagado ∈ [0, 70)   ·   aceso ∈ [70, 100]   ·   linha de acender fixa em 70.
//
// ⚠️ CORTES: marcados [SPEC] (vêm do doc) ou [PROPOSTA] (julgamento informado — o doc
// deixa estes em aberto e sanciona ajuste). Tudo centralizado em CUTS p/ recalibração (§11).
// ─────────────────────────────────────────────────────────────────────────────

export type Frequencia = 'esporadico' | 'lancamento' | 'perene';
export type PaganteFaixa = 'ate50' | '51-69' | '70-94' | '95-100';
export type ImprensaTipo = 'imprensa' | 'blogs' | 'influenciadores' | 'tv' | 'youtube' | 'podcasts';
export type ImprensaPorte = 'pequeno' | 'medio' | 'grande';
export interface ImprensaCell { tipo: ImprensaTipo; porte: ImprensaPorte }
export type RevenueSources = Partial<Record<string, number>>;

export interface RealInputsV3 {
  spotifyConnected: boolean;
  // ── API (number | null; null = ausente) ──
  spotifyListeners: number | null;      // R c1 + A c1 (conversão)
  igFollowers: number | null;           // R c2
  tiktokFollowers: number | null;       // R c2
  youtubeMonthlyViews: number | null;   // R c3 (só YouTube — TikTok views é acumulado, descartado §4.3)
  spotifyFollowers: number | null;      // A c1 (conversão)
  deezerFans: number | null;            // display (A) — não entra no índice v3
  igEngagement: number | null;          // A c2 (taxa %, 0..100)
  youtubeEngagement: number | null;     // A c2
  tiktokEngagement: number | null;      // A c2
  editorialPlaylists: number | null;    // L c3 (contagem → binário ≥1)
  radioAirplay: number | null;          // L c4 (execuções → binário; null/0 = ignorado, renormaliza)
  // ── Autorrelato ──
  showsPerMonth: number;                // E (receita) + A c3
  cache: number;                        // E — cachê médio por show (R$); receita_shows = shows × cache
  faturamentoForaShows: number;         // E — soma das fontes musicais fora shows (R$/mês)
  revenueSources: RevenueSources;       // composição da receita fora-shows (R$ por fonte) — pizza §5.4
  investimento: number;                 // diagnóstico (§5.4) — NÃO entra no índice
  temCnpj: boolean;                     // E (modulador)
  temEmpresario: boolean;               // E (modulador)
  premios: number;                      // L c1 — nível 0..5
  imprensaRepercussao: boolean;         // L c2 — P8 (filtro)
  imprensaMatrix: ImprensaCell[];       // L c2 — P9 (células tipo×porte marcadas)
  imprensaFrequencia: Frequencia;       // L c2 — P10 (multiplicador)
  fazBilheteria: boolean;               // A c4 — P11 (filtro)
  pagantePct: PaganteFaixa | null;      // A c4 — P12 (só se fazBilheteria)
}

export interface ComponentDebug {
  key: string;
  label: string;
  z: number | null;      // z do componente (null = não-z ou ausente)
  high: boolean;         // ≥ percentil 70
  topicon: boolean;      // ≥ percentil 95
  absent: boolean;       // sem dado p/ computar
}

export interface RealIndexV3 {
  version: 3;
  profile: { key: string; name: string; description: string; insights: string[] };
  pattern: { r: boolean; e: boolean; a: boolean; l: boolean };
  boletim: { r: number; e: number; a: number; l: number };   // 0–100 por dimensão (§9)
  cutLine: { r: number; e: number; a: number; l: number };   // linha de acender no boletim (= 70)
  topIcon: boolean;                                          // flag global (§8.2)
  dimTopIcon: { r: boolean; e: boolean; a: boolean; l: boolean };
  components: {
    r: ComponentDebug[];
    a: ComponentDebug[];
    l: {
      premios: { nota: number; high: boolean; topicon: boolean };
      imprensa: { nota: number; high: boolean };
      playlists: { bin: 0 | 1 };
      radio: { bin: 0 | 1 | null };  // null = ignorado (renormaliza)
      notaL: number;
    };
    e: { receitaTotal: number; modulador: number; receitaEfetiva: number; high: boolean; topicon: boolean };
  };
  // Extras p/ a tela de entrega (coletados nesta entrega, exibição §9.4):
  revenue: { shows: number; foraShows: number; total: number; sources: RevenueSources };
  engagement: Record<'instagram' | 'tiktok' | 'youtube', { value: number; cut: number; above: boolean } | null>;
  inputs: RealInputsV3;
  computedAt: string;
}

const HIGH_Z = 0.52;       // [SPEC] percentil 70
const TOPICON_Z = 1.64;    // [SPEC] percentil 95

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// value <= edges[i] → zs[i]; acima do último edge → zs[last]. (zs.length === edges.length+1)
function zByBuckets(v: number, edges: readonly number[], zs: readonly number[]): number {
  if (!Number.isFinite(v)) return zs[0];
  for (let i = 0; i < edges.length; i++) if (v <= edges[i]) return zs[i];
  return zs[zs.length - 1];
}

// ════════════════════ CORTES (z-tables, pesos, mapeamentos) — §11 ════════════════════
export const CUTS = {
  // ── R (§4.2) — tabelas EXATAS do doc ──
  // Ouvintes: as 7 faixas impressas no §4.2 são mantidas idênticas (a faixa ">1M" começa em z=0,8).
  // [PROPOSTA] Acrescentei dois degraus de elite ACIMA de 1M (5M→1,7; 20M→2,4) porque o teto impresso
  // de z=0,8 deixaria o TOP ICON do R (z≥1,64, §4.4) — e, por consequência, o TOP ICON global (§8.2) —
  // inalcançável. Extensão fiel (nenhuma faixa impressa muda), a revisar na calibração (§11).
  spotifyListeners: { edges: [1_000, 5_000, 20_000, 100_000, 500_000, 1_000_000, 5_000_000, 20_000_000], zs: [-1.5, -1.2, -0.9, -0.6, -0.3, 0.0, 0.8, 1.7, 2.4] },
  socialFollowers: { edges: [1_000, 5_000, 20_000, 100_000, 500_000, 1_000_000], zs: [-1.2, -0.7, -0.2, 0.5, 1.2, 1.8, 2.4] },
  youtubeViews: { edges: [10_000, 50_000, 200_000, 1_000_000, 5_000_000, 20_000_000], zs: [-1.2, -0.7, -0.2, 0.5, 1.2, 1.9, 2.5] },
  // ── A ──
  conversion: { high: 0.25, topicon: 0.333 }, // [SPEC] §6.2 — followers/listeners
  engagement: { // [SPEC] cortes "alto" por rede §6.3; topicon = P95 [PROPOSTA]
    instagram: { high: 2.8, topicon: 6 },
    tiktok: { high: 9, topicon: 15 },
    youtube: { high: 4, topicon: 8 },
  },
  shows: { high: 3, topicon: 30 }, // [SPEC] >3/mês §6.4; topicon [PROPOSTA] >30/mês
  // ── E (§5) ──
  e: { receitaAcende: 11_250, receitaTopIcon: 50_000, descontoEmpresario: 0.10, descontoCnpj: 0.05 }, // [SPEC]
  // ── L (§7) ──
  premiosNota: [0.0, 0.3, 0.7, 0.85, 0.95, 1.0], // [SPEC] níveis 0..5
  premiosHighFrom: 0.70,                          // alto = indicação nacional (§7.2)
  premiosTopIconFrom: 0.95,                        // top icon = indicação/vitória internacional (§7.6)
  imprensaWeights: { // [SPEC] §7.3 — pesos por tipo × porte [pequeno, médio, grande]
    imprensa: [75, 85, 100],
    blogs: [30, 45, 60],
    influenciadores: [50, 70, 90],
    tv: [80, 90, 100],
    youtube: [50, 65, 80],
    podcasts: [30, 55, 80],
  } as Record<ImprensaTipo, [number, number, number]>,
  imprensaFreq: { esporadico: 0.80, lancamento: 1.00, perene: 1.30 } as Record<Frequencia, number>, // [SPEC]
  l: { weights: { premios: 0.30, imprensa: 0.30, playlists: 0.20, radio: 0.20 }, highFrom: 0.70 }, // [SPEC]
} as const;

const PORTE_IDX: Record<ImprensaPorte, 0 | 1 | 2> = { pequeno: 0, medio: 1, grande: 2 };

// ─────────────────────────── Helpers de componente ───────────────────────────

// z de um sub-item de API respeitando a regra de ausência (§3.3).
function apiZ(value: number | null, table: { edges: readonly number[]; zs: readonly number[] }, spotifyConnected: boolean): number | null {
  if (!spotifyConnected) return table.zs[0];        // opção A: z mínimo da tabela
  if (value == null) return null;                   // opção B: sub-item ausente → excluir
  return zByBuckets(value, table.edges, table.zs);
}

// Componente = média dos sub-z presentes (exclui null). Sem nenhum presente → null (ausente → baixo).
function componentZ(subZs: (number | null)[]): number | null {
  const present = subZs.filter((z): z is number => z != null);
  if (!present.length) return null;
  return present.reduce((s, z) => s + z, 0) / present.length;
}

function zComp(key: string, label: string, z: number | null): ComponentDebug {
  return { key, label, z: z == null ? null : round2(z), high: z != null && z >= HIGH_Z, topicon: z != null && z >= TOPICON_Z, absent: z == null };
}

// Boletim por contagem (R/A): apagado → (n_altos/n)*70 (travado em ≤69, invariante §9.1);
// aceso → 70 + (n_topicon/n)*30 (§9.2).
function countBoletim(comps: { high: boolean; topicon: boolean }[], acende: boolean): number {
  const n = comps.length;
  if (!acende) return Math.min(69, Math.round((comps.filter((c) => c.high).length / n) * 70));
  return Math.round(70 + (comps.filter((c) => c.topicon).length / n) * 30);
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
export function computeRealIndexV3(input: RealInputsV3): RealIndexV3 {
  const sp = input.spotifyConnected;

  // ── R: 3 componentes (⅓), acende com os 3 altos (§4.4) ──
  const rComps: ComponentDebug[] = [
    zComp('listeners', 'Ouvintes mensais Spotify', apiZ(input.spotifyListeners, CUTS.spotifyListeners, sp)),
    zComp('socialFollowers', 'Seguidores de rede (IG + TikTok)', componentZ([
      apiZ(input.igFollowers, CUTS.socialFollowers, sp),
      apiZ(input.tiktokFollowers, CUTS.socialFollowers, sp),
    ])),
    zComp('videoViews', 'Consumo de vídeo (YouTube)', apiZ(input.youtubeMonthlyViews, CUTS.youtubeViews, sp)),
  ];
  const rHigh = rComps.every((c) => c.high);
  const rTopIcon = rComps.every((c) => c.topicon);

  // ── A: 4 componentes (25%), acende com os 4 altos (§6) ──
  // c1 conversão (followers/listeners)
  const convOk = sp && input.spotifyListeners != null && input.spotifyListeners > 0 && input.spotifyFollowers != null;
  const ratio = convOk ? input.spotifyFollowers! / input.spotifyListeners! : null;
  const convComp: ComponentDebug = {
    key: 'conversion', label: 'Conversão (seguidores ÷ ouvintes)', z: null,
    high: ratio != null && ratio >= CUTS.conversion.high,
    topicon: ratio != null && ratio >= CUTS.conversion.topicon,
    absent: ratio == null,
  };
  // c2 engajamento (≥1 rede acima do corte)
  const engNets = (['instagram', 'tiktok', 'youtube'] as const).map((net) => {
    const value = net === 'instagram' ? input.igEngagement : net === 'tiktok' ? input.tiktokEngagement : input.youtubeEngagement;
    const cut = CUTS.engagement[net];
    const present = sp && value != null;
    return { net, value: present ? Number(value) : null, cut, present };
  });
  const engComp: ComponentDebug = {
    key: 'engagement', label: 'Engajamento por rede', z: null,
    high: engNets.some((e) => e.present && e.value! > e.cut.high),
    topicon: engNets.some((e) => e.present && e.value! >= e.cut.topicon),
    absent: engNets.every((e) => !e.present),
  };
  // c3 shows/mês
  const showsComp: ComponentDebug = {
    key: 'shows', label: 'Shows por mês', z: null,
    high: input.showsPerMonth > CUTS.shows.high,
    topicon: input.showsPerMonth > CUTS.shows.topicon,
    absent: false,
  };
  // c4 % público pagante
  const pagHigh = input.fazBilheteria && (input.pagantePct === '70-94' || input.pagantePct === '95-100');
  const pagTop = input.fazBilheteria && input.pagantePct === '95-100';
  const pagComp: ComponentDebug = {
    key: 'pagante', label: '% público pagante', z: null,
    high: pagHigh, topicon: pagTop, absent: !input.fazBilheteria,
  };
  const aComps = [convComp, engComp, showsComp, pagComp];
  const aHigh = aComps.every((c) => c.high);
  // §6.6 (conversão + %pagante no P95) — mas só conta como TOP ICON se A de fato acende (os 4 altos),
  // senão o topIcon global poderia marcar um perfil que não é Icon.
  const aTopIcon = aHigh && convComp.topicon && pagComp.topicon;

  // ── E: receita ancorada × modulador (§5) ──
  const receitaShows = Math.max(0, input.showsPerMonth) * Math.max(0, input.cache);
  const receitaTotal = receitaShows + Math.max(0, input.faturamentoForaShows);
  const modulador = 1 - (input.temEmpresario ? 0 : CUTS.e.descontoEmpresario) - (input.temCnpj ? 0 : CUTS.e.descontoCnpj);
  const receitaEfetiva = receitaTotal * modulador;
  const eHigh = receitaEfetiva >= CUTS.e.receitaAcende;
  const eTopIcon = receitaEfetiva >= CUTS.e.receitaTopIcon;

  // ── L: soma ponderada com renormalização (§7) ──
  const premioLvl = clamp(Math.round(input.premios), 0, 5);
  const notaPremios = CUTS.premiosNota[premioLvl];
  const premiosHigh = notaPremios >= CUTS.premiosHighFrom;
  const premiosTopIcon = notaPremios >= CUTS.premiosTopIconFrom;
  // imprensa: MAIOR peso das células marcadas /100 × multiplicador de frequência (§7.3 corrigido).
  // Max (não média): a matriz mede o TETO de legitimação; marcar um veículo menor não pode baixar
  // a nota. O volume/recorrência entra pelo multiplicador de frequência.
  let notaImprensa = 0;
  if (input.imprensaRepercussao && input.imprensaMatrix?.length) {
    const pesos = input.imprensaMatrix
      .map((c) => CUTS.imprensaWeights[c.tipo]?.[PORTE_IDX[c.porte]])
      .filter((w): w is number => Number.isFinite(w));
    if (pesos.length) {
      const base = Math.max(...pesos) / 100;
      const mult = CUTS.imprensaFreq[input.imprensaFrequencia] ?? 1.0;
      notaImprensa = Math.min(1, base * mult);
    }
  }
  const playlistsBin: 0 | 1 = input.editorialPlaylists != null && input.editorialPlaylists >= 1 ? 1 : 0;
  const radioBin: 0 | 1 | null = input.radioAirplay != null && input.radioAirplay > 0 ? 1 : null; // null = ignorado
  const lParts: { w: number; v: number }[] = [
    { w: CUTS.l.weights.premios, v: notaPremios },
    { w: CUTS.l.weights.imprensa, v: notaImprensa },
    { w: CUTS.l.weights.playlists, v: playlistsBin },
  ];
  if (radioBin != null) lParts.push({ w: CUTS.l.weights.radio, v: radioBin });
  const wSum = lParts.reduce((s, p) => s + p.w, 0);
  const notaL = wSum ? lParts.reduce((s, p) => s + p.w * p.v, 0) / wSum : 0;
  // Trava de plataforma (§7.1/§7.5): L só acende com ≥1 sinal de plataforma REAL (playlist ou rádio),
  // independentemente de nota_L e da renormalização. Impede acender só com júri/imprensa.
  const temSinalPlataforma = playlistsBin === 1 || radioBin === 1;
  const lHigh = notaL >= CUTS.l.highFrom && temSinalPlataforma;
  // §7.6 (prêmio internacional) — mas só conta como TOP ICON se L de fato acende (nota + plataforma).
  const lTopIcon = lHigh && premiosTopIcon;

  // ── Padrão → perfil (§8) ──
  const pattern = { r: rHigh, e: eHigh, a: aHigh, l: lHigh };
  const key = `${rHigh ? 1 : 0}${eHigh ? 1 : 0}${aHigh ? 1 : 0}${lHigh ? 1 : 0}`;
  const def = PROFILES[key];

  // ── Boletim 0–100 (§9) ──
  // belowCut: arredonda mas TRAVA em ≤69 — a metade "apagada" é [0,70), nunca 70 (invariante §9.1;
  // sem isso, um valor logo abaixo do corte arredondaria p/ 70 e contradiria o "Baixo").
  const belowCut = (x: number) => Math.min(69, Math.round(x));
  const boletimE = (() => {
    if (receitaEfetiva <= 0) return 0;
    if (receitaEfetiva < CUTS.e.receitaAcende) return belowCut((receitaEfetiva / CUTS.e.receitaAcende) * 70);
    if (receitaEfetiva < CUTS.e.receitaTopIcon) return Math.round(70 + ((receitaEfetiva - CUTS.e.receitaAcende) / (CUTS.e.receitaTopIcon - CUTS.e.receitaAcende)) * 30);
    return 100;
  })();
  // Usa lHigh (não só notaL): com a trava de plataforma, nota_L pode passar de 0,70 SEM acender —
  // nesse caso belowCut trava em ≤69, preservando a invariante §9.1 (nota ≥70 ⟺ aceso).
  const boletimL = lHigh
    ? Math.round(70 + ((notaL - CUTS.l.highFrom) / (1 - CUTS.l.highFrom)) * 30)
    : belowCut((notaL / CUTS.l.highFrom) * 70);

  const topIcon = rTopIcon && eTopIcon && aTopIcon && lTopIcon;

  return {
    version: 3,
    profile: { key, name: def.name, description: def.description, insights: def.insights },
    pattern,
    boletim: { r: countBoletim(rComps, rHigh), e: boletimE, a: countBoletim(aComps, aHigh), l: boletimL },
    cutLine: { r: 70, e: 70, a: 70, l: 70 },
    topIcon,
    dimTopIcon: { r: rTopIcon, e: eTopIcon, a: aTopIcon, l: lTopIcon },
    components: {
      r: rComps,
      a: aComps,
      l: {
        premios: { nota: notaPremios, high: premiosHigh, topicon: premiosTopIcon },
        imprensa: { nota: round2(notaImprensa), high: notaImprensa >= CUTS.premiosHighFrom },
        playlists: { bin: playlistsBin },
        radio: { bin: radioBin },
        notaL: round2(notaL),
      },
      e: { receitaTotal: Math.round(receitaTotal), modulador: round2(modulador), receitaEfetiva: Math.round(receitaEfetiva), high: eHigh, topicon: eTopIcon },
    },
    revenue: { shows: Math.round(receitaShows), foraShows: Math.round(Math.max(0, input.faturamentoForaShows)), total: Math.round(receitaTotal), sources: input.revenueSources ?? {} },
    engagement: {
      instagram: engNets[0].value != null ? { value: round2(engNets[0].value), cut: engNets[0].cut.high, above: engNets[0].value > engNets[0].cut.high } : null,
      tiktok: engNets[1].value != null ? { value: round2(engNets[1].value), cut: engNets[1].cut.high, above: engNets[1].value > engNets[1].cut.high } : null,
      youtube: engNets[2].value != null ? { value: round2(engNets[2].value), cut: engNets[2].cut.high, above: engNets[2].value > engNets[2].cut.high } : null,
    },
    inputs: input,
    computedAt: new Date().toISOString(),
  };
}

export default computeRealIndexV3;
