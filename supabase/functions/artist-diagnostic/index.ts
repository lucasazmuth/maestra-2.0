import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logChartmetricCall } from "./chartmetric-log.ts";
import {
  computeRealIndexV4, daQuizV3, FONTES_DE_RECEITA, TIPOS_DE_CONTRATANTE,
  type RealInputsV4, type ImprensaCell, type Frequencia, type PaganteFaixa,
  type RevenueSources, type CacheByType, type Aliquota, type FonteDeReceita, type TipoDeContratante,
} from "./realEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHARTMETRIC_REFRESH_TOKEN = Deno.env.get("CHARTMETRIC_REFRESH_TOKEN");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DIM_NAME: Record<string, string> = { r: "Reach", e: "Earnings", a: "Audience", l: "Legitimacy" };
const fmtNum = (n: number) => (n >= 1000000 ? `${(n / 1000000).toFixed(1).replace(".", ",")} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));

// deno-lint-ignore no-explicit-any
function buildDiagnostic(ri: any, cm: any): Record<string, unknown> {
  const p = ri.pattern;
  const lowDims = (["r", "e", "a", "l"] as const).filter((k) => !p[k]).map((k) => DIM_NAME[k]);
  const metrics: { label: string; value: string }[] = [];
  if (cm?.monthly_listeners != null) metrics.push({ label: "Ouvintes mensais", value: fmtNum(cm.monthly_listeners) });
  if (cm?.sp_followers != null) metrics.push({ label: "Seguidores", value: fmtNum(cm.sp_followers) });
  return {
    stage: ri.profile.name, headline: ri.profile.description, bullets: ri.profile.insights,
    opportunity: lowDims.length ? `Pontos a desenvolver: ${lowDims.join(", ")}.` : "Sustentar e escalar as quatro frentes da carreira.",
    metrics, generatedAt: ri.computedAt,
  };
}

// Monta o RealInputsV4 do motor a partir das respostas (quizV4) + resumo Chartmetric.
//
// É AQUI que o autorrelato do artista vira número, então cada campo é saneado: o quiz é um
// formulário público e o índice é o produto. Nenhum valor do cliente chega ao motor sem passar
// por um clamp, uma lista de opções válidas ou um Math.max(0, …).
// deno-lint-ignore no-explicit-any
function buildRealInputsV4(qz: any, cm: any, spotifyConnected: boolean): RealInputsV4 {
  const mp = cm?.multiplatform ?? {};
  const n = (v: any) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const num0 = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const int0 = (v: any) => Math.max(0, Math.round(num0(v)));
  const oneOf = <T extends string>(v: any, allowed: readonly T[], fallback: T | null): T | null =>
    (allowed.includes(v as T) ? (v as T) : fallback);
  const bool = (v: any) => v === true || v === "true" || v === "sim" || v === 1 || v === "1";

  // Cachê médio por tipo de contratante (§3.2). Só as 6 chaves conhecidas entram.
  const cacheByType: CacheByType = {};
  for (const tipo of TIPOS_DE_CONTRATANTE) {
    cacheByType[tipo as TipoDeContratante] = Math.max(0, num0(qz?.cacheByType?.[tipo]));
  }

  // Nove fontes de receita, cada uma em reais ou "não sei" (§3.2). O motor conta "não sei" como
  // zero e sinaliza no relatório — a distinção precisa sobreviver até lá, então não vira 0 aqui.
  const revenueSources: RevenueSources = {};
  for (const fonte of FONTES_DE_RECEITA) {
    const v = qz?.revenueSources?.[fonte];
    revenueSources[fonte as FonteDeReceita] = v === "nao_sei" ? "nao_sei" : Math.max(0, num0(v));
  }

  // Imprensa: um porte por tipo, o MAIOR (§9.3). Aceita o objeto {tipo,porte}, a forma achatada
  // "tipo:porte" e o mapa { tipo: porte } que a matriz de escolha única produz.
  const matrix: ImprensaCell[] = (() => {
    const bruto = qz?.imprensaMatrix;
    const portes = ["pequeno", "medio", "grande"] as const;
    const tipos = ["imprensa", "tv", "influenciadores", "youtube", "podcasts", "blogs"] as const;
    const valida = (t: any, p: any): ImprensaCell | null =>
      (tipos.includes(t) && portes.includes(p)) ? { tipo: t, porte: p } : null;
    if (Array.isArray(bruto)) {
      return bruto.map((c: any) => {
        if (c && typeof c === "object" && c.tipo && c.porte) return valida(c.tipo, c.porte);
        if (typeof c === "string" && c.includes(":")) { const [t, p] = c.split(":"); return valida(t, p); }
        return null;
      }).filter(Boolean) as ImprensaCell[];
    }
    if (bruto && typeof bruto === "object") {
      return Object.entries(bruto).map(([t, p]) => valida(t, p)).filter(Boolean) as ImprensaCell[];
    }
    return [];
  })();

  return {
    spotifyConnected,
    fetchedAt: typeof cm?.fetched_at === "string" ? cm.fetched_at : null,
    // ── API ──
    spotifyListeners: n(cm?.monthly_listeners),
    igFollowers: n(mp.instagram),
    tiktokFollowers: n(mp.tiktok),
    youtubeMonthlyViews: n(cm?.yt_monthly_views),
    spotifyFollowers: n(cm?.sp_followers),
    deezerFans: n(cm?.deezer_fans),
    igEngagement: n(cm?.ig_engagement),
    youtubeEngagement: n(cm?.yt_engagement),
    tiktokEngagement: n(cm?.tt_engagement),
    editorialPlaylists: n(cm?.editorial_playlists),
    radioAirplay180d: n(cm?.radio_airplay),
    // ── Autodeclaração de R: só vale quando a API não trouxe; o motor decide a precedência ──
    igFollowersSelf: n(qz?.igFollowersSelf),
    tiktokFollowersSelf: n(qz?.tiktokFollowersSelf),
    youtubeViews28dSelf: n(qz?.youtubeViews28dSelf),
    // ── E (base anual) ──
    showsPerYear: int0(qz?.showsPerYear),
    cacheByType,
    revenueSources,
    investimento: Math.max(0, num0(qz?.investimento)),
    temCnpj: bool(qz?.temCnpj),
    aliquota: oneOf(qz?.aliquota, ["ate6", "6-10", "10-15", "acima15", "nao_sei"] as const, null) as Aliquota | null,
    temEmpresario: bool(qz?.temEmpresario),
    // ── A ──
    fazBilheteria: bool(qz?.fazBilheteria),
    pagantePct: oneOf(qz?.pagantePct, ["ate50", "51-69", "70-94", "95-100"] as const, null) as PaganteFaixa | null,
    // ── L ──
    // O nível 6 (prêmio internacional) é VÁLIDO. A v3 cortava em 5 e rebaixava quem ganhou (§15).
    premios: Math.max(0, Math.min(6, Math.round(num0(qz?.premios)))),
    imprensaRepercussao: bool(qz?.imprensaRepercussao),
    imprensaMatrix: matrix,
    imprensaFrequencia: (oneOf(qz?.imprensaFrequencia, ["esporadico", "lancamento", "perene"] as const, "lancamento") as Frequencia),
  };
}

// Busca resumo do Chartmetric (get-ids + meta + 6 campos extras do motor v2). Loga cada chamada.
// O artista ainda não existe aqui, então artist_id no log fica null.
// deno-lint-ignore no-explicit-any
// rawSink (opcional): acumula o JSON CRU de cada chamada {endpoint, payload}. O handler persiste
// isso em artist_chartmetric_raw depois de criar o artista — nada se perde e não re-busca (Nyta).
async function chartmetricSummary(
  spotifyArtistId: string,
  supabaseAdmin?: any,
  rawSink?: Array<{ endpoint: string; payload: unknown }>,
): Promise<Record<string, unknown> | null> {
  if (!CHARTMETRIC_REFRESH_TOKEN) return null;
  const log = (endpoint: string, ok: boolean, status: number | null, started: number) => {
    if (supabaseAdmin) {
      logChartmetricCall(supabaseAdmin, {
        function_name: "artist-diagnostic", artist_id: null, endpoint, ok, status_code: status, duration_ms: Date.now() - started,
      });
    }
  };
  try {
    const tokRes = await fetch("https://api.chartmetric.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshtoken: CHARTMETRIC_REFRESH_TOKEN }),
    });
    if (!tokRes.ok) return null;
    const token = (await tokRes.json()).token;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    let t0 = Date.now();
    const idsRes = await fetch(`https://api.chartmetric.com/api/artist/spotify/${spotifyArtistId}/get-ids`, auth);
    log(`/api/artist/spotify/${spotifyArtistId}/get-ids`, idsRes.ok, idsRes.status, t0);
    if (!idsRes.ok) return null;
    const idsJson = await idsRes.json();
    rawSink?.push({ endpoint: `/api/artist/spotify/:id/get-ids`, payload: idsJson });
    const idsObj = idsJson?.obj;
    const row = Array.isArray(idsObj) ? idsObj[0] : idsObj;
    const cmId = row?.cm_artist ?? row?.chartmetric_id ?? null;
    if (!cmId) return null;
    t0 = Date.now();
    const metaRes = await fetch(`https://api.chartmetric.com/api/artist/${cmId}`, auth);
    log(`/api/artist/${cmId}`, metaRes.ok, metaRes.status, t0);
    if (!metaRes.ok) return { cm_artist_id: cmId, fetched_at: new Date().toISOString() };
    const metaJson = await metaRes.json();
    rawSink?.push({ endpoint: `/api/artist/:id`, payload: metaJson });
    const meta = metaJson?.obj ?? {};
    const cms = meta.cm_statistics ?? {};
    const num = (v: any) => (v == null || v === "" ? null : Number(v));
    const cities = (cms.sp_where_people_listen ?? []).slice(0, 5).map((c: any) => ({ name: c.name, country: c.code2, listeners: c.listeners }));
    const genre = meta?.genres?.primary?.name ?? (Array.isArray(meta?.genres) ? meta.genres[0]?.name : null) ?? null;
    const genres: string[] = (() => {
      const g = meta?.genres; const out: string[] = [];
      const push = (x: any) => { const nm = typeof x === "string" ? x : x?.name; if (typeof nm === "string" && nm.trim()) out.push(nm.trim()); };
      try {
        if (Array.isArray(g)) g.forEach(push);
        else if (g) { push(g.primary); (Array.isArray(g.secondary) ? g.secondary : []).forEach(push); (Array.isArray(g.sub) ? g.sub : []).forEach(push); }
      } catch (_e) { /* ignora */ }
      return [...new Set(out)].slice(0, 3);
    })();
    // ── Campos extras do motor v2 (Fase C). Cada um é defensivo (falha → null) e logado. ──
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const tmpl = (pth: string) => pth.replace(String(cmId), ":id");
    const getJson = async (path: string): Promise<any> => {
      const t = Date.now();
      try {
        const r = await fetch(`https://api.chartmetric.com${path}`, auth);
        log(tmpl(path.split("?")[0]), r.ok, r.status, t);
        const body = r.ok ? await r.json() : null;
        if (body != null) rawSink?.push({ endpoint: tmpl(path.split("?")[0]), payload: body });
        return body;
      } catch { log(tmpl(path.split("?")[0]), false, null, t); return null; }
    };
    const statLatest = async (source: string, field: string): Promise<number | null> => {
      const d = await getJson(`/api/artist/${cmId}/stat/${source}?field=${field}`);
      const series = d?.obj?.[field] ?? (Array.isArray(d?.obj) ? d.obj : null);
      const last = Array.isArray(series) && series.length ? series[series.length - 1] : null;
      const v = Number(last?.value);
      return Number.isFinite(v) ? v : null;
    };
    // engagement_rate já vem em PORCENTAGEM (validado: Liniker IG 4,35% / Pabllo 0,37%). Sem ×100.
    const engRate = async (endpoint: string): Promise<number | null> => {
      const d = await getJson(`/api/artist/${cmId}/${endpoint}`);
      const o = d?.obj ?? d;
      const er = Number(o?.engagement_rate ?? (Array.isArray(o) ? o[0]?.engagement_rate : null));
      return Number.isFinite(er) ? er : null;
    };

    await sleep(200); const yt_monthly_views = await statLatest("youtube_artist", "monthly_views");
    await sleep(200); const deezer_fans = await statLatest("deezer", "fans");
    await sleep(200); const ig_engagement = await engRate("instagram-audience-stats");
    await sleep(200); const yt_engagement = await engRate("youtube-audience-stats");
    await sleep(200); const tt_engagement = await engRate("tiktok-audience-stats");
    // Playlists editoriais (mesmo endpoint do enrich) → conta as com editorial=true (dedup por id).
    await sleep(200);
    const plData = await getJson(`/api/artist/${cmId}/spotify/current/playlists?limit=50`);
    const editorial_playlists = (() => {
      try {
        // Shape real: obj = [{ playlist: {id,name,editorial,...}, track }]. O editorial fica em
        // item.playlist.editorial (aninhado), não no item.
        const arr = Array.isArray(plData?.obj) ? plData.obj : Array.isArray(plData) ? plData : [];
        const ids = new Set<any>();
        for (const item of (Array.isArray(arr) ? arr : [])) {
          const pl = item?.playlist ?? item;
          if (pl?.editorial) ids.add(pl.id ?? pl.playlist_id ?? pl.name);
        }
        return ids.size;
      } catch { return null; }
    })();
    // Resumo de playlists (top 10 por seguidores) — MESMO parser do enrich, a partir do plData que
    // já buscamos (sem chamada extra). Assim a seção "Sua presença nas plataformas" já aparece na
    // entrega do diagnóstico grátis; o enrich (pós-pago) refresca + soma similar/países.
    const playlists = (() => {
      try {
        const arr = Array.isArray(plData?.obj) ? plData.obj : Array.isArray(plData) ? plData : [];
        const byId = new Map<any, any>();
        for (const item of (Array.isArray(arr) ? arr : [])) {
          const pl = item?.playlist;
          if (!pl?.name) continue;
          const id = pl.id ?? pl.playlist_id ?? pl.name;
          if (!byId.has(id)) byId.set(id, { name: pl.name, followers: Number(pl.followers) || 0, curator: pl.curator_name ?? pl.owner_name ?? null, editorial: !!pl.editorial });
        }
        const top = [...byId.values()].sort((a, b) => b.followers - a.followers).slice(0, 10);
        return top.length ? { count: byId.size, reach: top.reduce((s, p) => s + p.followers, 0), top } : null;
      } catch { return null; }
    })();
    // Artistas de referência (neighboring) — +1 chamada, mas o dado entra já no diagnóstico grátis
    // (decisão: "já temos o dado, então exibir"). O enrich pós-pago refresca pelo mesmo endpoint.
    await sleep(200);
    const nbData = await getJson(`/api/artist/${cmId}/neighboring-artists?limit=12`);
    const similar = (() => {
      try {
        const arr = Array.isArray(nbData?.obj) ? nbData.obj : Array.isArray(nbData) ? nbData : [];
        const list = (Array.isArray(arr) ? arr : [])
          .map((a: any) => ({ name: a?.name, image: a?.image_url ?? null }))
          .filter((a: any) => a.name)
          .slice(0, 12);
        return list.length ? list : null;
      } catch { return null; }
    })();
    // Airplay de rádio (soma de plays). `since` é OBRIGATÓRIO (sem ele → 400). Janela de 180 dias.
    await sleep(200);
    const apSince = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
    const apData = await getJson(`/api/radio/artist/${cmId}/airplay-totals?since=${apSince}`);
    const radio_airplay = (() => {
      try {
        const o = apData?.obj ?? apData;
        if (o == null) return null;
        if (Number.isFinite(Number(o?.total))) return Number(o.total);

        // A resposta NÃO tem `total` nem `data`: vem como
        //   { countries: [...], cities: [...], stations: [...], tracks: [...] }
        // e cada item é o par [info, série_temporal], com as execuções em info.plays.
        // Procurar só por `total`/`data` fazia todo artista cair em null — inclusive quem
        // toca muito: a Anitta devolvia 17 mil execuções em 10 países e virava "Sem dado".
        // `countries` é o recorte mais abrangente; os outros ficam como reserva.
        const soma = (grupo: unknown): number | null => {
          if (!Array.isArray(grupo) || !grupo.length) return null;
          let sum = 0, found = false;
          for (const item of grupo) {
            const info = Array.isArray(item) ? item[0] : item;
            const pl = Number((info as any)?.plays ?? (info as any)?.count);
            if (Number.isFinite(pl)) { sum += pl; found = true; }
          }
          return found ? sum : null;
        };
        for (const grupo of [o?.countries, o?.cities, o?.stations, o?.tracks]) {
          const t = soma(grupo);
          if (t != null) return t;
        }

        // Formatos antigos/alternativos (array direto ou `data`), por segurança.
        return soma(Array.isArray(o) ? o : o?.data);
      } catch { return null; }
    })();

    return {
      cm_artist_id: cmId, monthly_listeners: num(cms.sp_monthly_listeners),
      monthly_listeners_rank: num(cms.sp_monthly_listeners_rank), career_rank: num(meta.cm_artist_rank),
      genre, genres, sp_followers: num(cms.sp_followers), top_cities: cities,
      multiplatform: { instagram: num(cms.ins_followers), tiktok: num(cms.tiktok_followers), youtube: num(cms.ycs_subscribers) },
      yt_monthly_views, deezer_fans, ig_engagement, yt_engagement, tt_engagement, editorial_playlists, radio_airplay,
      playlists, similar,
      enriched: false, fetched_at: new Date().toISOString(),
    };
  } catch (e) { console.error("chartmetricSummary:", (e as Error).message); return null; }
}

// Consulta PRÉVIA à Chartmetric (§3.1, passo 2): só os três campos de R que o quiz precisa saber
// para decidir quais perguntas de autodeclaração mostrar.
//
// Por que não reaproveitar `chartmetricSummary`: ela faz oito chamadas e a resposta inteira não
// serve de nada antes do quiz. Aqui são três (get-ids, meta, série do YouTube) e o resultado é
// descartado — o diagnóstico de verdade busca tudo de novo, e é o número DELE que entra no índice.
// O preview não é fonte de dado, é só quem decide o que perguntar.
//
// Rede de segurança (§3.1, passo 6): qualquer falha devolve os três campos nulos, e o quiz então
// pergunta todos. Perguntar demais é recuperável; calcular o R sobre nada não é.
// deno-lint-ignore no-explicit-any
async function chartmetricPreview(spotifyArtistId: string, supabaseAdmin?: any): Promise<Record<string, number | null>> {
  const vazio = { igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null };
  if (!CHARTMETRIC_REFRESH_TOKEN) return vazio;
  const log = (endpoint: string, ok: boolean, status: number | null, started: number) => {
    if (supabaseAdmin) {
      logChartmetricCall(supabaseAdmin, {
        function_name: "artist-diagnostic:preview", artist_id: null, endpoint, ok, status_code: status, duration_ms: Date.now() - started,
      });
    }
  };
  try {
    const tokRes = await fetch("https://api.chartmetric.com/api/token", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshtoken: CHARTMETRIC_REFRESH_TOKEN }),
    });
    if (!tokRes.ok) return vazio;
    const auth = { headers: { Authorization: `Bearer ${(await tokRes.json()).token}` } };
    let t0 = Date.now();
    const idsRes = await fetch(`https://api.chartmetric.com/api/artist/spotify/${spotifyArtistId}/get-ids`, auth);
    log(`/api/artist/spotify/:id/get-ids`, idsRes.ok, idsRes.status, t0);
    if (!idsRes.ok) return vazio;
    const idsObj = (await idsRes.json())?.obj;
    const row = Array.isArray(idsObj) ? idsObj[0] : idsObj;
    const cmId = row?.cm_artist ?? row?.chartmetric_id ?? null;
    if (!cmId) return vazio;
    t0 = Date.now();
    const metaRes = await fetch(`https://api.chartmetric.com/api/artist/${cmId}`, auth);
    log(`/api/artist/:id`, metaRes.ok, metaRes.status, t0);
    if (!metaRes.ok) return vazio;
    const cms = (await metaRes.json())?.obj?.cm_statistics ?? {};
    const num = (v: any) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    t0 = Date.now();
    let youtubeMonthlyViews: number | null = null;
    try {
      const ytRes = await fetch(`https://api.chartmetric.com/api/artist/${cmId}/stat/youtube_artist?field=monthly_views`, auth);
      log(`/api/artist/:id/stat/youtube_artist`, ytRes.ok, ytRes.status, t0);
      if (ytRes.ok) {
        const d = await ytRes.json();
        const serie = d?.obj?.monthly_views ?? (Array.isArray(d?.obj) ? d.obj : null);
        const ultimo = Array.isArray(serie) && serie.length ? serie[serie.length - 1] : null;
        youtubeMonthlyViews = num(ultimo?.value);
      }
    } catch { log(`/api/artist/:id/stat/youtube_artist`, false, null, t0); }
    return { igFollowers: num(cms.ins_followers), tiktokFollowers: num(cms.tiktok_followers), youtubeMonthlyViews };
  } catch (e) { console.error("chartmetricPreview:", (e as Error).message); return vazio; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { name, spotifyArtistId, spotify, redoArtistId } = body;

    // ── PREVIEW: o que a Chartmetric tem, ANTES do quiz (§3.1, passo 2). Só leitura, sem criar
    // nada e sem rate-limit de criação: é o que permite ao quiz esconder as perguntas de
    // autodeclaração de R cujo dado a API já entrega. ──
    if (body.preview === true) {
      const pid = typeof spotifyArtistId === "string" ? spotifyArtistId : null;
      const api = pid ? await chartmetricPreview(pid, supabaseAdmin) : { igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null };
      return json({ preview: true, api });
    }
    // O front envia o quiz V4. As chaves anteriores continuam aceitas e são TRADUZIDAS: um app
    // nativo antigo, que só atualiza quando o usuário quiser na loja, segue mandando `quizV3`.
    const quiz = body.quizV4 ?? daQuizV3(body.quizV3 ?? body.quizV2 ?? {});

    // ── REDO: re-diagnóstico de um perfil existente (recurso PRO no front). Reusa o Chartmetric
    // já salvo (NÃO re-busca — o enrich tem TTL próprio) + as novas respostas do quiz; recalcula o
    // Índice REAL e atualiza só realIndex/diagnostic/quizDiagnostic. Não mexe em estratégias,
    // identidade nem plano. Sem rate-limit de criação (não cria perfil). ──
    if (redoArtistId && typeof redoArtistId === "string") {
      // Gate PRO (mesma regra do asaas-subscription-status / useEntitlements): refazer o
      // diagnóstico é recurso da assinatura PRO. 'pending' sem subscription_id é pagamento único
      // (fantasma) → não conta como PRO. active, ou overdue dentro da carência, valem.
      const { data: sub } = await supabaseAdmin
        .from("asaas_subscriptions")
        .select("status, asaas_subscription_id, grace_period_ends_at")
        .eq("user_id", user.id).maybeSingle();
      const phantom = sub?.status === "pending" && !sub?.asaas_subscription_id;
      const subStatus = !sub || phantom ? "none" : sub.status;
      const isPro = subStatus === "active"
        || (subStatus === "overdue" && !!sub?.grace_period_ends_at && Date.now() <= new Date(sub!.grace_period_ends_at).getTime());
      if (!isPro) return json({ error: "subscription_required", reason: "pro_required" }, 403);

      const { data: existing, error: exErr } = await supabaseAdmin
        .from("artists").select("id, content, spotify_artist_id")
        .eq("id", redoArtistId).eq("user_id", user.id).maybeSingle();
      if (exErr || !existing) return json({ error: "Perfil não encontrado" }, 404);
      const prevContent = (existing.content || {}) as Record<string, any>;
      const chartmetric = prevContent.chartmetricProfile ?? null;
      const realInputs = buildRealInputsV4(quiz, chartmetric, !!existing.spotify_artist_id);
      const realIndex = computeRealIndexV4(realInputs);
      const diagnostic = buildDiagnostic(realIndex, chartmetric || {});
      const nowIso = new Date().toISOString();
      const newContent = {
        ...prevContent,
        realIndex, diagnostic,
        quizDiagnostic: { answers: quiz, completedAt: nowIso },
      };
      const { error: upErr } = await supabaseAdmin
        .from("artists").update({ content: newContent })
        .eq("id", redoArtistId).eq("user_id", user.id);
      if (upErr) { console.error("redo update:", upErr); return json({ error: "Erro ao salvar o re-diagnóstico" }, 500); }
      return json({ artistId: redoArtistId, redo: true, reused: false, locked: false, realIndex, diagnostic, chartmetric });
    }

    if (!name || typeof name !== "string" || name.trim().length < 1) return json({ error: "name é obrigatório" }, 400);
    const artistName = name.trim();
    const spotifyId = (spotifyArtistId && typeof spotifyArtistId === "string") ? spotifyArtistId : null;

    const reusedResponse = (a: any) => json({
      artistId: a.id, reused: true, locked: a.is_locked !== false,
      realIndex: a.content?.realIndex ?? null, diagnostic: a.content?.diagnostic ?? null,
      chartmetric: a.content?.chartmetricProfile ?? null,
    });

    // ── Rate Limit: 1) máx. 3 perfis pendentes ──
    const { count: pendingCount, error: pendingError } = await supabaseAdmin
      .from("artists").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_locked", true);
    if (pendingError || pendingCount === null) return json({ error: "Erro ao verificar limites" }, 500);
    if (pendingCount >= 3) {
      return json({ error: "Limite de perfis pendentes atingido", reason: "pending_limit", pending_count: pendingCount }, 429);
    }

    // 2) Cooldown progressivo baseado em exclusões nos últimos 30 dias
    const { count: deletionCount, error: deletionError } = await supabaseAdmin
      .from("artist_deletions").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("was_locked", true)
      .gte("deleted_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    if (deletionError) return json({ error: "Erro ao verificar limites" }, 500);

    const cooldownSeconds = (deletionCount ?? 0) === 0 ? 0
      : (deletionCount ?? 0) === 1 ? 600
      : (deletionCount ?? 0) <= 4 ? 86400 : 604800;

    if (cooldownSeconds > 0) {
      const { data: lastArtist, error: lastError } = await supabaseAdmin
        .from("artists").select("created_at").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (lastError) return json({ error: "Erro ao verificar limites" }, 500);
      if (lastArtist?.created_at) {
        const elapsed = (Date.now() - new Date(lastArtist.created_at).getTime()) / 1000;
        const remaining = Math.ceil(cooldownSeconds - elapsed);
        if (remaining > 0) {
          return json({ error: "Cooldown ativo", reason: "cooldown", remaining_seconds: remaining, deletion_count: deletionCount }, 429);
        }
      }
    }

    // 3) Auto-duplicidade (mesmo user_id + spotify_artist_id) → reaproveita SEM chamar a Chartmetric
    if (spotifyId) {
      const { data: selfDup } = await supabaseAdmin
        .from("artists").select("id, name, content, is_locked")
        .eq("user_id", user.id).eq("spotify_artist_id", spotifyId).maybeSingle();
      if (selfDup) return reusedResponse(selfDup);
    }

    // Sem Spotify (artista iniciante): não consulta a Chartmetric. O motor trata a ausência de dados
    // de API como z mínimo (opção B). Com Spotify, puxa o resumo + os 6 campos extras da Fase C.
    const cmRaw: Array<{ endpoint: string; payload: unknown }> = [];
    const chartmetric = spotifyId ? await chartmetricSummary(spotifyId, supabaseAdmin, cmRaw) : null;
    const realInputs = buildRealInputsV4(quiz, chartmetric, !!spotifyId);
    const realIndex = computeRealIndexV4(realInputs);
    const diagnostic = buildDiagnostic(realIndex, chartmetric || {});

    const nowIso = new Date().toISOString();
    const content: Record<string, unknown> = {
      realIndex, diagnostic, quizDiagnostic: { answers: quiz, completedAt: nowIso },
    };
    // Cópia no perfil só para EXIBIÇÃO (capa do PDF). A prova é a linha em user_consents, que é
    // append-only e carrega IP, user-agent e a versão dos Termos; esta aqui é conveniência de leitura.
    const vinculoDeclarado = typeof (quiz as any)?.vinculo === "string" ? (quiz as any).vinculo : null;
    if (vinculoDeclarado) content.titularidade = { vinculo: vinculoDeclarado, declaredAt: nowIso };
    if (chartmetric) content.chartmetricProfile = chartmetric;
    if (spotifyId) {
      content.spotifyProfile = {
        spotify_artist_id: spotifyId, name: artistName,
        image: spotify?.image ?? undefined, followers: spotify?.followers ?? undefined, fetched_at: nowIso,
      };
    }

    const { data: artist, error: createError } = await supabaseAdmin
      .from("artists")
      .insert({ user_id: user.id, name: artistName, content, spotify_artist_id: spotifyId, is_locked: true })
      .select("id").single();
    if (createError || !artist) { console.error("Error creating artist:", createError); return json({ error: "Erro ao criar o perfil" }, 500); }

    // Declaração de vínculo com o artista (ver migration 20260821180000_vinculo_artista).
    //
    // Gravada AQUI, no servidor, e não pelo cliente: a trilha só tem valor probatório se o próprio
    // usuário não puder forjá-la — a RLS de user_consents não permite escrita pelo cliente, e o IP
    // e o user-agent precisam vir da requisição. Amarra a declaração à versão exata dos Termos
    // vigentes naquele instante, que é o que dá sentido jurídico ao registro.
    //
    // Fire-and-forget: uma falha aqui não pode derrubar a criação do perfil.
    const vinculo = typeof (quiz as any)?.vinculo === "string" ? (quiz as any).vinculo : null;
    if (vinculo) {
      try {
        const { data: termos } = await supabaseAdmin
          .from("legal_documents")
          .select("version, content_sha256")
          .eq("slug", "termos").eq("is_current", true).maybeSingle();
        await supabaseAdmin.from("user_consents").insert({
          user_id: user.id,
          artist_id: artist.id,
          kind: "vinculo_artista",
          status: "dado",
          document_slug: "termos",
          document_version: termos?.version ?? null,
          content_sha256: termos?.content_sha256 ?? null,
          source: `vinculo:${vinculo}`,
          ip: req.headers.get("x-forwarded-for"),
          user_agent: req.headers.get("user-agent"),
        });
      } catch (e) { console.error("registrar vinculo:", (e as Error)?.message); }
    }

    // Persiste o JSON CRU de cada chamada Chartmetric (1 linha por endpoint). Fire-and-forget:
    // nunca derruba a criação do perfil. Serve de contexto pro Nyta e evita re-buscar (custo).
    if (cmRaw.length) {
      const cmId = (chartmetric as any)?.cm_artist_id ?? null;
      const rows = cmRaw.map((it) => ({
        artist_id: artist.id, cm_artist_id: cmId, endpoint: it.endpoint,
        payload: it.payload, source: "diagnostic", fetched_at: nowIso,
      }));
      try {
        await supabaseAdmin.from("artist_chartmetric_raw").upsert(rows, { onConflict: "artist_id,endpoint" });
      } catch (e) { console.error("save chartmetric raw:", (e as Error)?.message); }
    }

    return json({ artistId: artist.id, reused: false, locked: true, realIndex, diagnostic, chartmetric });
  } catch (error: any) { console.error("artist-diagnostic error:", error?.message); return json({ error: "Erro interno" }, 500); }
});
