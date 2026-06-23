import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { logChartmetricCall } from "./chartmetric-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHARTMETRIC_REFRESH_TOKEN = Deno.env.get("CHARTMETRIC_REFRESH_TOKEN");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// ─────────────────────────────────────────────────────────────────────────────
// ÍNDICE REAL — metodologia determinística (Anita Carvalho)
// 4 dimensões: Reach, Earnings, Audience, Legitimacy → 1 de 16 perfis.
// ─────────────────────────────────────────────────────────────────────────────

const Z_FATURAMENTO: Record<string, number> = {
  "Não faturei": -1.4, "Menos de R$ 1.000": -0.9, "R$ 1.000 a R$ 5.000": 0.0,
  "R$ 5.000 a R$ 10.000": 0.8, "R$ 10.000 a R$ 20.000": 1.4,
  "R$ 20.000 a R$ 50.000": 1.8, "Acima de R$ 50.000": 2.2,
};
const Z_SHOWS: Record<string, number> = {
  "Nenhum": -1.2, "1 a 5": -0.5, "6 a 15": 0.2, "16 a 30": 0.9, "31 a 60": 1.5, "Mais de 60": 2.1,
};
const Z_PUBLICO: Record<string, number> = {
  "Nunca me apresentei": -1.5, "Até 100": -0.6, "100 a 500": 0.2, "500 a 2.000": 0.9, "2.000 a 10.000": 1.6, "Mais de 10.000": 2.3,
};
const Z_PREMIOS: Record<string, number> = {
  "Nunca tive indicação nem prêmio": -0.4, "Já tive indicação, sem ganhar": 0.8, "Ganhei prêmio nacional": 1.5, "Ganhei prêmio internacional": 2.3,
};
const Z_IMPRENSA: Record<string, number> = {
  "Nunca apareci na mídia": -0.6, "Repercussão em mídia local/regional": 0.3, "Repercussão em mídia nacional": 1.3, "Repercussão em mídia internacional": 2.3,
};

function zByBuckets(v: number | null | undefined, edges: number[], zs: number[]): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return zs[0];
  for (let i = 0; i < edges.length; i++) if (n <= edges[i]) return zs[i];
  return zs[zs.length - 1];
}
const zSegSpotify = (v: number | null | undefined) =>
  zByBuckets(v, [999, 5000, 20000, 100000, 500000, 1000000], [-1.0, -0.4, 0.3, 1.0, 1.7, 2.2, 2.7]);
const zOuvintes = (v: number | null | undefined) =>
  zByBuckets(v, [999, 5000, 20000, 100000, 500000, 1000000], [-1.5, -1.2, -0.9, -0.6, -0.3, 0.0, 0.8]);
const zRede = (v: number | null | undefined) =>
  zByBuckets(v, [999, 5000, 20000, 100000, 500000, 1000000], [-1.2, -0.7, -0.2, 0.5, 1.2, 1.8, 2.4]);

interface ProfileDef { name: string; description: string; insights: string[] }
const PROFILES: Record<string, ProfileDef> = {
  "1111": { name: "Icon", description: "A carreira plena: shows, faturamento, audiência digital e reconhecimento. As quatro áreas altas — pouquíssimas artistas alcançam.", insights: ["Você está nas quatro frentes. Poucas carreiras chegam aqui — o desafio agora é sustentar e escalar.", "Com tudo alto, o risco é dispersão. Um plano mantém o foco no que realmente move o ponteiro."] },
  "1110": { name: "Hit", description: "Você vende, lota casas e tem audiência digital forte. O público te ama e o mercado responde — mas a crítica e o reconhecimento ainda não acompanham.", insights: ["Você vende e tem público — mas a crítica e os prêmios ainda não acompanham. Isso pode ser uma escolha, ou uma oportunidade.", "Legitimação não vem sozinha: ela é resultado de estratégia de imprensa e posicionamento intencional."] },
  "1101": { name: "Spotlight", description: "Fatura, tem audiência digital e é reconhecida — uma carreira sólida que acontece principalmente fora dos palcos.", insights: ["Sua carreira acontece principalmente fora dos palcos — digital, faturamento e reconhecimento funcionam bem. O ao vivo ainda não é central.", "Shows não são o único caminho — mas quando o ao vivo entrar, tende a amplificar tudo o que já funciona."] },
  "1100": { name: "Digital", description: "Sua carreira acontece nas plataformas — você fatura e tem audiência digital relevante. Mas palco e reconhecimento ainda não fazem parte da história.", insights: ["Sua carreira existe nas plataformas e fatura. Mas sem palco e sem reconhecimento da crítica, ela fica exposta às mudanças de algoritmo.", "Diversificar as fontes de receita e de visibilidade é o próximo passo natural."] },
  "1011": { name: "Underpaid", description: "Você tem palco, audiência e reconhecimento — todos te valorizam. Mas isso não vira dinheiro. Você entrega muito mais do que recebe.", insights: ["Você entrega muito — palco, público, reconhecimento — e recebe pouco financeiramente. Isso tem nome: subprecificação ou falta de gestão comercial.", "O problema não é talento nem demanda. É a conversão do que você tem em receita."] },
  "1010": { name: "Potential", description: "Presença nos palcos e audiência digital — gente te vê e te acompanha. Mas não vira faturamento nem reconhecimento. Há muito potencial à espera.", insights: ["Você tem presença nos palcos e audiência digital — gente te vê. Mas ainda não vira dinheiro nem reconhecimento. O potencial está claro; falta a estratégia que o converte.", "O caminho daqui costuma passar por gestão comercial e posicionamento mais intencional."] },
  "1001": { name: "Hype", description: "O buzz existe — audiência digital e reconhecimento da crítica. Falta o palco e o faturamento acompanharem o burburinho.", insights: ["O buzz existe — alcance digital e reconhecimento da crítica. Mas sem palco e sem faturamento, é um castelo no digital.", "Converter buzz em carreira sustentável exige estrutura: shows, venda, agenda."] },
  "1000": { name: "Influencer", description: "Grande presença digital — gente te segue e te acompanha. Mas ainda não se traduz em shows, faturamento ou reconhecimento da crítica.", insights: ["Você tem alcance digital relevante — gente te segue e te acompanha. Mas ainda não se traduz em shows, receita ou reconhecimento.", "Alcance sem conversão é oportunidade não capturada. A estratégia muda isso."] },
  "0111": { name: "Analog", description: "Consagrada no mundo real — shows, faturamento e reconhecimento da crítica. Mas sua presença digital não acompanha o tamanho da carreira.", insights: ["Sua carreira é real e consolidada no mundo físico — shows, faturamento e reconhecimento funcionam. Mas o digital não acompanha o tamanho do que você faz.", "Artistas analógicos muitas vezes têm o maior potencial digital represado. Com estratégia, esse é um gap que fecha rápido."] },
  "0110": { name: "Rising", description: "A base do ao vivo funciona — você se apresenta e fatura com isso. Carreira com fundamento sólido, mas ainda pouco conhecida no digital e pela crítica.", insights: ["A base do ao vivo funciona — você se apresenta e fatura com isso. Uma carreira com fundamento sólido que ainda não aparece no digital nem para a crítica.", "O próximo nível exige amplificação: digital e imprensa podem multiplicar o que já existe."] },
  "0101": { name: "Outlier", description: "Você fatura e é reconhecida — sem depender de palco frequente nem de grande audiência digital. Combinação rara, comum em nichos ou bastidor.", insights: ["Você fatura e é reconhecida — sem depender de palco frequente nem de grande audiência digital. Uma combinação rara, comum em nichos, bastidores ou mercados muito específicos.", "O desafio aqui costuma ser escala: como crescer sem perder o que faz o modelo funcionar."] },
  "0100": { name: "Moneymaker", description: "Você fatura com música — mas sem palco expressivo, audiência ou reconhecimento. Muitas vezes o perfil de quem trabalha nos bastidores ou em nichos comerciais.", insights: ["Você fatura com música — mas sem palco expressivo, audiência ou reconhecimento. Perfil comum em quem trabalha nos bastidores: produção, composição, eventos corporativos.", "Se quiser construir uma carreira de frente, o próximo passo é visibilidade intencional."] },
  "0011": { name: "Bet", description: "O setor acredita em você — você se apresenta e é reconhecida pela crítica. Mas o grande público digital e o faturamento ainda não chegaram.", insights: ["O setor acredita em você — você se apresenta e a crítica valida. Mas o grande público digital e o faturamento ainda não chegaram.", "Você tem o reconhecimento sem o alcance. Estratégia digital e gestão comercial são os próximos passos naturais."] },
  "0010": { name: "Paradox", description: "Você se apresenta — mas isso ainda não virou faturamento, audiência ou reconhecimento. Toda a carreira concentrada no palco.", insights: ["Toda a sua carreira está concentrada no palco — mas ainda não vira faturamento, audiência digital ou reconhecimento.", "Você mostra ao vivo. O próximo passo é fazer o palco trabalhar para você fora dele também."] },
  "0001": { name: "Cult", description: "Reconhecida pela crítica e imprensa — mas sem palco, audiência ou faturamento que acompanhem. A artista de culto ou o grande mercado ainda não descobriu.", insights: ["A crítica e a imprensa reconhecem o que você faz — mas sem palco, público e faturamento, isso fica no papel.", "Reconhecimento sem estrutura não se sustenta. É hora de construir as outras frentes."] },
  "0000": { name: "Beginner", description: "Você está no começo da jornada — construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda artista que um dia chegou ao Icon.", insights: ["Você está no começo da jornada — construindo cada frente da carreira. Não é fraqueza: é o ponto de partida de toda artista que um dia chegou ao Icon.", "O valor de saber onde você está agora é enorme: dá direção. E direção é o que separa quem chega de quem fica rodando."] },
};

const DIM_NAME: Record<string, string> = { r: "Reach", e: "Earnings", a: "Audience", l: "Legitimacy" };

function computeRealIndex(quiz: Record<string, string>, cm: any): Record<string, unknown> {
  const mp = (cm?.multiplatform ?? {}) as { instagram?: number | null; tiktok?: number | null; youtube?: number | null };
  const zOuv = zOuvintes(cm?.monthly_listeners);
  const redeZs = [mp.instagram, mp.tiktok, mp.youtube].filter((v) => v != null).map((v) => zRede(v));
  const zRedes = redeZs.length ? redeZs.reduce((s, z) => s + z, 0) / redeZs.length : null;
  const zSegSp = cm?.sp_followers != null ? zSegSpotify(cm.sp_followers) : null;
  const zFatRaw = Z_FATURAMENTO[quiz?.faturamento ?? ""];
  const earningsUnknown = zFatRaw === undefined;
  const zShows = Z_SHOWS[quiz?.shows_pagos ?? ""] ?? -1.2;
  const zPub = Z_PUBLICO[quiz?.maior_publico ?? ""] ?? -1.5;
  const zPrem = Z_PREMIOS[quiz?.premios ?? ""] ?? -0.4;
  const zImp = Z_IMPRENSA[quiz?.imprensa ?? ""] ?? -0.6;
  const z_R = zRedes != null ? 0.6 * zOuv + 0.4 * zRedes : zOuv;
  const z_E = earningsUnknown ? null : zFatRaw;
  const z_A = zSegSp != null ? 0.375 * zShows + 0.375 * zPub + 0.25 * zSegSp : 0.5 * zShows + 0.5 * zPub;
  const z_L = 0.5 * zPrem + 0.5 * zImp;
  const pattern = { r: z_R >= 0, e: z_E != null && z_E >= 0, a: z_A >= 0, l: z_L >= 0 };
  const key = `${pattern.r ? 1 : 0}${pattern.e ? 1 : 0}${pattern.a ? 1 : 0}${pattern.l ? 1 : 0}`;
  const def = PROFILES[key];
  const avail = [z_R, z_E, z_A, z_L].filter((z): z is number => z != null);
  const realScore = avail.reduce((s, z) => s + z, 0) / avail.length;
  return {
    profile: { key, name: def.name, description: def.description, insights: def.insights },
    pattern,
    dimensions: { r: round2(z_R), e: z_E == null ? 0 : round2(z_E), a: round2(z_A), l: round2(z_L) },
    realScore: round2(realScore),
    earningsUnknown,
    inputs: {
      faturamento: quiz?.faturamento ?? "", shows_pagos: quiz?.shows_pagos ?? "",
      maior_publico: quiz?.maior_publico ?? "", premios: quiz?.premios ?? "",
      imprensa: quiz?.imprensa ?? "",
      monthly_listeners: cm?.monthly_listeners ?? null, sp_followers: cm?.sp_followers ?? null,
      social: { instagram: mp.instagram ?? null, tiktok: mp.tiktok ?? null, youtube: mp.youtube ?? null },
    },
    computedAt: new Date().toISOString(),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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

const fmtNum = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));

// Busca resumo básico do Chartmetric (get-ids + meta). Loga cada chamada (custo de crédito).
// O artista ainda não existe aqui, então artist_id no log fica null.
// deno-lint-ignore no-explicit-any
async function chartmetricSummary(spotifyArtistId: string, supabaseAdmin?: any): Promise<Record<string, unknown> | null> {
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
    const idsObj = (await idsRes.json())?.obj;
    const row = Array.isArray(idsObj) ? idsObj[0] : idsObj;
    const cmId = row?.cm_artist ?? row?.chartmetric_id ?? null;
    if (!cmId) return null;
    t0 = Date.now();
    const metaRes = await fetch(`https://api.chartmetric.com/api/artist/${cmId}`, auth);
    log(`/api/artist/${cmId}`, metaRes.ok, metaRes.status, t0);
    if (!metaRes.ok) return { cm_artist_id: cmId, fetched_at: new Date().toISOString() };
    const meta = (await metaRes.json())?.obj ?? {};
    const cms = meta.cm_statistics ?? {};
    const num = (v: any) => (v == null || v === "" ? null : Number(v));
    const cities = (cms.sp_where_people_listen ?? []).slice(0, 5).map((c: any) => ({ name: c.name, country: c.code2, listeners: c.listeners }));
    const genre = meta?.genres?.primary?.name ?? (Array.isArray(meta?.genres) ? meta.genres[0]?.name : null) ?? null;
    // Lista de gêneros (principal + secundários, até 3) para a Q2 — defensivo (nunca lança).
    // Salvo aqui pois o enrich não re-busca a meta (evita redundância).
    const genres: string[] = (() => {
      const g = meta?.genres; const out: string[] = [];
      const push = (x: any) => { const n = typeof x === "string" ? x : x?.name; if (typeof n === "string" && n.trim()) out.push(n.trim()); };
      try {
        if (Array.isArray(g)) g.forEach(push);
        else if (g) { push(g.primary); (Array.isArray(g.secondary) ? g.secondary : []).forEach(push); (Array.isArray(g.sub) ? g.sub : []).forEach(push); }
      } catch (_e) { /* ignora */ }
      return [...new Set(out)].slice(0, 3);
    })();
    return {
      cm_artist_id: cmId, monthly_listeners: num(cms.sp_monthly_listeners),
      monthly_listeners_rank: num(cms.sp_monthly_listeners_rank), career_rank: num(meta.cm_artist_rank),
      genre, genres, sp_followers: num(cms.sp_followers), top_cities: cities,
      multiplatform: { instagram: num(cms.ins_followers), tiktok: num(cms.tiktok_followers), youtube: num(cms.ycs_subscribers) },
      enriched: false, fetched_at: new Date().toISOString(),
    };
  } catch (e) { console.error("chartmetricSummary:", (e as Error).message); return null; }
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
    const { name, spotifyArtistId, spotify, quiz } = body;
    if (!name || typeof name !== "string" || name.trim().length < 1) return json({ error: "name é obrigatório" }, 400);
    const artistName = name.trim();
    const spotifyId = (spotifyArtistId && typeof spotifyArtistId === "string") ? spotifyArtistId : null;

    const reusedResponse = (a: any) => json({
      artistId: a.id, reused: true, locked: a.is_locked !== false,
      realIndex: a.content?.realIndex ?? null, diagnostic: a.content?.diagnostic ?? null,
      chartmetric: a.content?.chartmetricProfile ?? null,
    });

    // ── Rate Limit: verificações obrigatórias ──────────────────────────────────
    // 1. Pending count (limite de 3 perfis pendentes)
    const { count: pendingCount, error: pendingError } = await supabaseAdmin
      .from("artists").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("is_locked", true);

    if (pendingError || pendingCount === null) return json({ error: "Erro ao verificar limites" }, 500);
    if (pendingCount >= 3) {
      return json({ error: "Limite de perfis pendentes atingido", reason: "pending_limit", pending_count: pendingCount }, 429);
    }

    // 2. Cooldown progressivo baseado em exclusões nos últimos 30 dias
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

    // 3. Auto-duplicidade (mesmo user_id + spotify_artist_id)
    if (spotifyId) {
      const { data: selfDup } = await supabaseAdmin
        .from("artists").select("id, name, content, is_locked")
        .eq("user_id", user.id).eq("spotify_artist_id", spotifyId).maybeSingle();
      if (selfDup) return reusedResponse(selfDup);
    }

    // Sem Spotify (artista iniciante): não consulta a Chartmetric. O motor já trata a ausência
    // de dados de API como z mínimo (opção B) → tende a Beginner / R·A baixos, refletindo que a
    // carreira digital ainda não começou. Com Spotify, puxa o resumo da Chartmetric normalmente.
    const chartmetric = spotifyId ? await chartmetricSummary(spotifyId, supabaseAdmin) : null;
    const realIndex = computeRealIndex(quiz || {}, chartmetric || {});
    const diagnostic = buildDiagnostic(realIndex, chartmetric || {});

    const nowIso = new Date().toISOString();
    const content: Record<string, unknown> = {
      realIndex, diagnostic, quizDiagnostic: { answers: quiz || {}, completedAt: nowIso },
    };
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

    return json({ artistId: artist.id, reused: false, locked: true, realIndex, diagnostic, chartmetric });
  } catch (error: any) { console.error("artist-diagnostic error:", error?.message); return json({ error: "Erro interno" }, 500); }
});
