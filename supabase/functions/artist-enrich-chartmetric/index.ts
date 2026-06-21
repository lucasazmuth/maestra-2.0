import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ChartmetricClient } from "./chartmetric-client.ts";
import { logChartmetricCall } from "./chartmetric-log.ts";

// Dados profundos do Chartmetric mudam devagar (gênero/similares quase nunca; audiência/cidades
// devagar). 30 dias casa com a cadência dos snapshots de métricas e corta ~97% das chamadas
// repetidas vs. o TTL antigo de 24h. O botão "Atualizar dados" passa force:true pra ignorar isto.
const TTL_DAYS = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHARTMETRIC_REFRESH_TOKEN = Deno.env.get("CHARTMETRIC_REFRESH_TOKEN");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function resolveCmId(spotifyArtistId: string, client: ChartmetricClient): Promise<number | null> {
  const obj = await client.get(`/api/artist/spotify/${spotifyArtistId}/get-ids`);
  const row = Array.isArray(obj) ? obj[0] : obj;
  return row?.cm_artist ?? row?.chartmetric_id ?? null;
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

    const { artistId, force } = await req.json();
    if (!artistId || typeof artistId !== "string") return json({ error: "artistId é obrigatório" }, 400);

    const { data: artist } = await supabaseAdmin
      .from("artists").select("id, user_id, content, spotify_artist_id").eq("id", artistId).maybeSingle();
    if (!artist || artist.user_id !== user.id) return json({ error: "Perfil não encontrado" }, 403);

    const content = (artist.content ?? {}) as Record<string, any>;
    const existing = (content.chartmetricProfile ?? {}) as Record<string, any>;

    // ── Guard 1: frescor do ENRIQUECIMENTO (30 dias; force ignora) ──────────────
    // Usa enriched_at (só o enrich profundo grava), não fetched_at (que o diagnóstico básico
    // também grava) — assim o 1º enrich pós-pago sempre roda, e os seguintes pulam por 30 dias.
    const isFresh = existing.enriched && existing.enriched_at &&
      (Date.now() - new Date(existing.enriched_at).getTime()) < TTL_DAYS * 86400_000;
    if (isFresh && !force) return json({ ok: true, skipped: "fresh_data" });

    // ── Guard 2: cm_not_found marker check ──────────────────────────────────────
    if (existing.cm_not_found && existing.cm_not_found_at) {
      const daysSinceNotFound = (Date.now() - new Date(existing.cm_not_found_at).getTime()) / 86400_000;
      if (daysSinceNotFound < 7) return json({ ok: true, skipped: "not_found_cached" });
      // Marker expired (> 7 days) — clear it and allow retry
      delete existing.cm_not_found;
      delete existing.cm_not_found_at;
    }

    // ── Guard 3: Enrichment lock for concurrency deduplication ───────────────────
    const LOCK_TTL_MS = 120_000; // 2 minutes
    if (existing.enrichment_lock &&
      (Date.now() - new Date(existing.enrichment_lock).getTime()) < LOCK_TTL_MS) {
      return json({ ok: true, alreadyEnriched: true });
    }

    // ── Write enrichment lock (re-read content to avoid clobber) ─────────────────
    const { data: lockFresh } = await supabaseAdmin.from("artists").select("content").eq("id", artistId).single();
    const lockContent = (lockFresh?.content ?? content) as Record<string, any>;
    const lockProfile = { ...(lockContent.chartmetricProfile ?? existing), enrichment_lock: new Date().toISOString() };
    await supabaseAdmin
      .from("artists")
      .update({ content: { ...lockContent, chartmetricProfile: lockProfile } })
      .eq("id", artistId);

    const client = new ChartmetricClient({
      refreshToken: CHARTMETRIC_REFRESH_TOKEN!,
      onCall: (e) => logChartmetricCall(supabaseAdmin, {
        function_name: "artist-enrich-chartmetric",
        artist_id: artistId,
        endpoint: e.endpoint,
        ok: e.ok,
        status_code: e.statusCode,
        duration_ms: e.durationMs,
      }),
    });
    const token = await client.getToken();
    if (!token) return json({ ok: false, reason: "chartmetric_unavailable" });

    let cmId: number | null = existing.cm_artist_id ?? null;
    if (!cmId && artist.spotify_artist_id) cmId = await resolveCmId(artist.spotify_artist_id, client);
    if (!cmId) {
      // Persist cm_not_found marker before returning
      const { data: nfFresh } = await supabaseAdmin.from("artists").select("content").eq("id", artistId).single();
      const nfContent = (nfFresh?.content ?? content) as Record<string, any>;
      const notFoundProfile = {
        ...(nfContent.chartmetricProfile ?? existing),
        cm_not_found: true,
        cm_not_found_at: new Date().toISOString(),
        enrichment_lock: null,
      };
      await supabaseAdmin
        .from("artists")
        .update({ content: { ...nfContent, chartmetricProfile: notFoundProfile } })
        .eq("id", artistId);
      return json({ ok: true, skipped: "not_found_cached" });
    }

    // ── Chamadas profundas (pós-pago) ──────────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const since = new Date(Date.now() - 180 * 864e5).toISOString().split("T")[0];

    // SÓ os dados que o diagnóstico NÃO traz. Gênero/ouvintes/cidades/multiplataforma já vêm do
    // diagnóstico (meta + cm_statistics) — não re-buscamos = sem redundância. Endpoints que
    // sempre davam erro (similar 404, stat/spotify 400, social-audience-stats 400) foram removidos.
    const DEEP_ENDPOINTS: Record<string, string> = {
      wpl: `/api/artist/${cmId}/where-people-listen?since=${since}&until=${today}`,
      playlists: `/api/artist/${cmId}/spotify/current/playlists?limit=50`,
      neighboring: `/api/artist/${cmId}/neighboring-artists?limit=12`,
    };

    // Cache de falha por endpoint: pula os que falharam nos últimos 30 dias (exceto com force),
    // pra não pagar crédito repetidamente por um endpoint sem dados para este artista.
    const deepUnavailable: Record<string, string> = { ...(existing.deep_unavailable ?? {}) };
    const isMarkerFresh = (iso?: string) => !!iso && (Date.now() - new Date(iso).getTime()) < TTL_DAYS * 86400_000;
    const activeKeys = Object.keys(DEEP_ENDPOINTS).filter((k) => force || !isMarkerFresh(deepUnavailable[k]));
    const fetched = await client.sequentialGet(activeKeys.map((k) => DEEP_ENDPOINTS[k]));
    const r: Record<string, any> = {};
    activeKeys.forEach((k, i) => {
      r[k] = fetched[i];
      // Falha (null) → marca o horário; sucesso → limpa o marcador.
      if (fetched[i] == null) deepUnavailable[k] = new Date().toISOString();
      else delete deepUnavailable[k];
    });
    // Parsing DEFENSIVO — NUNCA pode lançar (senão o enrich não salva e re-roda em loop).
    const asArray = (x: any): any[] => (Array.isArray(x) ? x : []);
    const lastPoint = (series: any) => (Array.isArray(series) && series.length ? series[series.length - 1] : null);

    // Audiência: where-people-listen → { cities: {"Nome":[série]}, countries: {...} }.
    // Pega o último ponto (listeners atual) de cada chave e ordena.
    let audience: any = null;
    try {
      const wpl = r.wpl;
      const toTop = (obj: any, codeKey: string) =>
        Object.entries(obj && typeof obj === "object" ? obj : {})
          .map(([name, series]: [string, any]) => { const p = lastPoint(series); return { name, [codeKey]: p?.code2 ?? null, listeners: p?.listeners ?? null }; })
          .filter((c: any) => c.listeners != null)
          .sort((a: any, b: any) => (b.listeners || 0) - (a.listeners || 0));
      const top_countries = toTop(wpl?.countries, "code").slice(0, 8);
      const top_cities = toTop(wpl?.cities, "country").slice(0, 10);
      if (top_countries.length || top_cities.length) {
        audience = { ...(top_countries.length ? { top_countries } : {}), ...(top_cities.length ? { top_cities } : {}) };
      }
    } catch (e) { console.error("parse audience:", (e as Error)?.message); }

    // Playlists: obj = [{ playlist:{name,followers,curator_name,editorial,...}, track }]. Dedup + top 10.
    let playlistsSummary: any = null;
    try {
      const arr = asArray(r.playlists);
      const byId = new Map<any, any>();
      for (const item of arr) {
        const pl = item?.playlist;
        if (!pl?.name) continue;
        const id = pl.id ?? pl.playlist_id ?? pl.name;
        if (!byId.has(id)) {
          byId.set(id, { name: pl.name, followers: Number(pl.followers) || 0, curator: pl.curator_name ?? pl.owner_name ?? null, editorial: !!pl.editorial });
        }
      }
      const top = [...byId.values()].sort((a, b) => b.followers - a.followers).slice(0, 10);
      if (top.length) playlistsSummary = { count: byId.size, reach: top.reduce((s, p) => s + p.followers, 0), top };
    } catch (e) { console.error("parse playlists:", (e as Error)?.message); }

    // Referências (similar): neighboring-artists → [{ id, name, image_url, ... }].
    let similar: any = null;
    try {
      const list = asArray(r.neighboring)
        .map((a: any) => ({ name: a?.name, image: a?.image_url ?? null }))
        .filter((a: any) => a.name)
        .slice(0, 12);
      if (list.length) similar = list;
    } catch (e) { console.error("parse similar:", (e as Error)?.message); }

    // ── Re-lê o content e grava (evita clobber) ─────────────────────────────────
    const { data: fresh } = await supabaseAdmin.from("artists").select("content").eq("id", artistId).single();
    const freshContent = (fresh?.content ?? content) as Record<string, any>;
    // Preserva o que o diagnóstico já trouxe (genre, genres, ouvintes, cidades, multiplataforma)
    // via spread, e adiciona audiência (países) + playlists (top 10) + referências (similar).
    // SEMPRE marca enriched:true e limpa o lock, mesmo com dados parciais — guard de 30d ativa,
    // não re-roda em loop.
    const merged = {
      ...(freshContent.chartmetricProfile ?? existing),
      cm_artist_id: cmId,
      ...(audience ? { audience } : {}),
      ...(playlistsSummary ? { playlists: playlistsSummary } : {}),
      ...(similar ? { similar } : {}),
      ...(Object.keys(deepUnavailable).length ? { deep_unavailable: deepUnavailable } : { deep_unavailable: undefined }),
      _debug: undefined, // limpa o campo de debug temporário, se existir
      enriched: true,
      enriched_at: new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      enrichment_lock: null,
      cm_not_found: undefined,
      cm_not_found_at: undefined,
    };
    const { error: updErr } = await supabaseAdmin
      .from("artists")
      .update({ content: { ...freshContent, chartmetricProfile: merged } })
      .eq("id", artistId);
    if (updErr) { console.error("enrich update:", updErr); return json({ ok: false, reason: "save_failed" }, 500); }

    return json({ ok: true, enriched: { audience: !!audience, playlists: !!playlistsSummary, similar: !!similar } });
  } catch (error: any) {
    console.error("artist-enrich-chartmetric error:", error?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
