import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ChartmetricClient } from "../_shared/chartmetric-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHARTMETRIC_REFRESH_TOKEN = Deno.env.get("CHARTMETRIC_REFRESH_TOKEN");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, apikey, x-client-info, x-supabase-api-version",
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Resolve o Chartmetric ID a partir do Spotify Artist ID.
 * Uses the shared ChartmetricClient for rate-limit-aware requests.
 */
async function resolveCmId(spotifyArtistId: string, client: ChartmetricClient): Promise<number | null> {
  const obj = await client.get(`/api/artist/spotify/${spotifyArtistId}/get-ids`);
  const row = Array.isArray(obj) ? obj[0] : obj;
  return row?.cm_artist ?? row?.chartmetric_id ?? null;
}

// ─── Interfaces ─────────────────────────────────────────────────────────────────

interface EligibleArtist {
  id: string;
  user_id: string;
  spotify_artist_id: string;
  content?: Record<string, unknown> | null;
}

interface MetricsSnapshot {
  monthly_listeners: number | null;
  followers: number | null;
  popularity: number | null;
  track_count: number | null;
  top_cities: Array<{ name: string; country: string; listeners: number }> | null;
  growth_data: Record<string, number> | null;
}

interface DeltaEntry {
  abs: number;
  pct: number;
}

// ─── Core Logic ─────────────────────────────────────────────────────────────────

/**
 * Verifica se o usuário tem assinatura PRO ativa (status 'active' ou 'overdue' dentro do grace period).
 */
async function isProActive(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data: sub } = await supabaseAdmin
    .from("asaas_subscriptions")
    .select("status, grace_period_ends_at, next_due_date")
    .eq("user_id", userId)
    .maybeSingle();

  if (!sub) return false;
  if (sub.status === "active") return true;
  if (sub.status === "overdue") {
    const now = new Date();
    if (sub.grace_period_ends_at && now < new Date(sub.grace_period_ends_at)) return true;
    if (sub.next_due_date && now < new Date(new Date(sub.next_due_date).getTime() + 7 * 24 * 60 * 60 * 1000)) return true;
  }
  return false;
}

/**
 * Busca artistas elegíveis para coleta:
 * - Perfil pago (is_locked = false)
 * - Possui spotify_artist_id
 * - Último snapshot tem >= 30 dias OU nunca coletou
 */
async function fetchEligibleArtists(
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<EligibleArtist[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Busca todos os artistas pagos com spotify_artist_id
  const { data: artists, error } = await supabaseAdmin
    .from("artists")
    .select("id, user_id, spotify_artist_id, content")
    .eq("is_locked", false)
    .not("spotify_artist_id", "is", null);

  if (error || !artists) {
    console.error("[collect-metrics] fetchEligibleArtists error:", error?.message);
    return [];
  }

  // Para cada artista, verificar se o último snapshot é >= 30 dias
  const eligible: EligibleArtist[] = [];

  for (const artist of artists) {
    const { data: lastSnapshot } = await supabaseAdmin
      .from("artist_metrics_snapshots")
      .select("collected_at")
      .eq("artist_id", artist.id)
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Elegível se nunca coletou OU último snapshot >= 30 dias
    if (!lastSnapshot || new Date(lastSnapshot.collected_at) <= new Date(thirtyDaysAgo)) {
      eligible.push({
        id: artist.id,
        user_id: artist.user_id,
        spotify_artist_id: artist.spotify_artist_id,
        content: artist.content ?? null,
      });
    }
  }

  return eligible;
}

/**
 * Coleta métricas do Chartmetric para um artista.
 * Uses the shared ChartmetricClient for sequential, rate-limit-aware requests.
 * When storedCmId is provided, skips the get-ids API call entirely.
 */
async function fetchMetricsFromChartmetric(
  spotifyArtistId: string,
  client: ChartmetricClient,
  storedCmId?: number | null
): Promise<MetricsSnapshot | null> {
  const cmId = storedCmId ?? await resolveCmId(spotifyArtistId, client);
  if (!cmId) return null;

  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Sequential requests with rate-limit-aware pacing (replaces Promise.all)
  const [spStat, wpl, artistInfo] = await client.sequentialGet([
    `/api/artist/${cmId}/stat/spotify?since=${since}&until=${today}&field=followers,listeners`,
    `/api/artist/${cmId}/where-people-listen?since=${since}&until=${today}`,
    `/api/artist/${cmId}`,
  ]);

  // Extrair monthly_listeners e followers da série temporal
  let monthlyListeners: number | null = null;
  let followers: number | null = null;

  if (spStat) {
    // Pegar o valor mais recente da série temporal
    const listenersSeries = spStat.listeners ?? spStat;
    const followersSeries = spStat.followers ?? spStat;

    if (Array.isArray(listenersSeries) && listenersSeries.length > 0) {
      const latest = listenersSeries[listenersSeries.length - 1];
      monthlyListeners = latest.listeners ?? latest.value ?? null;
    }
    if (Array.isArray(followersSeries) && followersSeries.length > 0) {
      const latest = followersSeries[followersSeries.length - 1];
      followers = latest.followers ?? latest.value ?? null;
    }
  }

  // Extrair popularidade e track_count do perfil do artista
  let popularity: number | null = null;
  let trackCount: number | null = null;

  if (artistInfo) {
    popularity = artistInfo.spotify_popularity ?? artistInfo.sp_popularity ?? null;
    trackCount = artistInfo.num_sp_tracks ?? artistInfo.track_count ?? null;
  }

  // Extrair top cities
  let topCities: Array<{ name: string; country: string; listeners: number }> | null = null;

  if (wpl) {
    const arr = Array.isArray(wpl) ? wpl : (wpl.cities ?? wpl.countries ?? []);
    const cities = (arr || []).slice(0, 5).map((c: any) => ({
      name: c.name ?? c.city ?? "",
      country: c.country ?? c.country_name ?? "",
      listeners: c.listeners ?? c.value ?? 0,
    })).filter((c: { name: string }) => c.name);
    if (cities.length > 0) topCities = cities;
  }

  // Calcular growth_data (variação percentual de seguidores e ouvintes no período)
  let growthData: Record<string, number> | null = null;

  if (spStat) {
    const growth: Record<string, number> = {};
    const listenersSeries = spStat.listeners ?? [];
    const followersSeries = spStat.followers ?? [];

    if (Array.isArray(listenersSeries) && listenersSeries.length >= 2) {
      const first = listenersSeries[0];
      const last = listenersSeries[listenersSeries.length - 1];
      const firstVal = first.listeners ?? first.value ?? 0;
      const lastVal = last.listeners ?? last.value ?? 0;
      if (firstVal > 0) {
        growth.listeners_change_pct = Math.round(((lastVal - firstVal) / firstVal) * 10000) / 100;
      }
    }
    if (Array.isArray(followersSeries) && followersSeries.length >= 2) {
      const first = followersSeries[0];
      const last = followersSeries[followersSeries.length - 1];
      const firstVal = first.followers ?? first.value ?? 0;
      const lastVal = last.followers ?? last.value ?? 0;
      if (firstVal > 0) {
        growth.followers_change_pct = Math.round(((lastVal - firstVal) / firstVal) * 10000) / 100;
      }
    }
    if (Object.keys(growth).length > 0) growthData = growth;
  }

  return {
    monthly_listeners: monthlyListeners,
    followers,
    popularity,
    track_count: trackCount,
    top_cities: topCities,
    growth_data: growthData,
  };
}

/**
 * Calcula deltas entre o snapshot atual e o anterior.
 * Para cada métrica numérica presente em ambos:
 *   abs = current - previous
 *   pct = ((current - previous) / previous) * 100, arredondado a 2 casas decimais
 */
export function calculateDeltas(
  current: MetricsSnapshot,
  previous: { monthly_listeners: number | null; followers: number | null; popularity: number | null; track_count: number | null }
): Record<string, DeltaEntry> | null {
  const metrics: Array<{ key: string; curr: number | null; prev: number | null }> = [
    { key: "monthly_listeners", curr: current.monthly_listeners, prev: previous.monthly_listeners },
    { key: "followers", curr: current.followers, prev: previous.followers },
    { key: "popularity", curr: current.popularity, prev: previous.popularity },
    { key: "track_count", curr: current.track_count, prev: previous.track_count },
  ];

  const deltas: Record<string, DeltaEntry> = {};
  let hasAny = false;

  for (const { key, curr, prev } of metrics) {
    if (curr != null && prev != null && prev !== 0) {
      deltas[key] = {
        abs: curr - prev,
        pct: Math.round(((curr - prev) / prev) * 100 * 100) / 100,
      };
      hasAny = true;
    }
  }

  return hasAny ? deltas : null;
}

/**
 * Calcula o número de dias entre duas datas.
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.round(Math.abs(d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

// ─── Main Handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Instantiate shared ChartmetricClient
    const client = new ChartmetricClient({
      refreshToken: CHARTMETRIC_REFRESH_TOKEN ?? "",
    });

    // Obter token Chartmetric via shared client
    const token = await client.getToken();
    if (!token) {
      console.error("[collect-metrics] Chartmetric token indisponível");
      return json({ ok: false, reason: "chartmetric_unavailable", processed: 0 });
    }

    // Buscar artistas elegíveis
    const eligibleArtists = await fetchEligibleArtists(supabaseAdmin);
    console.log(`[collect-metrics] Artistas elegíveis: ${eligibleArtists.length}`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const artist of eligibleArtists) {
      try {
        // Req 5.7: Verificar status PRO antes de coletar
        const isPro = await isProActive(supabaseAdmin, artist.user_id);
        if (!isPro) {
          console.log(`[collect-metrics] Artista ${artist.id}: usuário não é PRO, pulando`);
          skipped++;
          continue;
        }

        // Coletar métricas do Chartmetric via shared client
        const storedCmId = (artist.content as any)?.chartmetricProfile?.cm_artist_id ?? null;
        const metrics = await fetchMetricsFromChartmetric(artist.spotify_artist_id, client, storedCmId);
        if (!metrics) {
          // Req 5.6: Chartmetric indisponível — registrar erro, pular, retry no próximo ciclo
          console.error(`[collect-metrics] Artista ${artist.id}: falha ao coletar métricas do Chartmetric`);
          errors++;
          continue;
        }

        // Buscar snapshot anterior para cálculo de deltas
        const { data: previousSnapshot } = await supabaseAdmin
          .from("artist_metrics_snapshots")
          .select("monthly_listeners, followers, popularity, track_count, collected_at")
          .eq("artist_id", artist.id)
          .order("collected_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Calcular deltas e period_days
        let deltas: Record<string, DeltaEntry> | null = null;
        let periodDays: number | null = null;

        if (previousSnapshot) {
          // Req 5.3: Calcular deltas vs snapshot anterior
          deltas = calculateDeltas(metrics, previousSnapshot);
          periodDays = daysBetween(previousSnapshot.collected_at, new Date().toISOString());
        }
        // Req 5.4: Se não há snapshot anterior, salvar sem deltas (deltas: null, period_days: null)

        // Inserir novo snapshot
        const { error: insertError } = await supabaseAdmin
          .from("artist_metrics_snapshots")
          .insert({
            artist_id: artist.id,
            monthly_listeners: metrics.monthly_listeners,
            followers: metrics.followers,
            popularity: metrics.popularity,
            track_count: metrics.track_count,
            top_cities: metrics.top_cities,
            growth_data: metrics.growth_data,
            deltas,
            period_days: periodDays,
            collected_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[collect-metrics] Artista ${artist.id}: erro ao salvar snapshot:`, insertError.message);
          errors++;
          continue;
        }

        // Req 5.8: Não deletar snapshots se total ficar abaixo de 12
        // (Apenas referência — a function nunca deleta snapshots, apenas insere)

        processed++;
        console.log(`[collect-metrics] Artista ${artist.id}: snapshot coletado com sucesso`);
      } catch (e) {
        console.error(`[collect-metrics] Artista ${artist.id}: erro inesperado:`, (e as Error).message);
        errors++;
      }

      // Inter-artist delay: dynamic pacing based on X-RateLimit-Remaining
      await client.waitIfNeeded();
      // Minimum 500ms delay between artists regardless of rate limit state
      await new Promise((r) => setTimeout(r, 500));
    }

    return json({
      ok: true,
      processed,
      skipped,
      errors,
      total_eligible: eligibleArtists.length,
    });
  } catch (error) {
    console.error("[collect-metrics] Erro fatal:", (error as Error).message);
    return json({ error: "Erro interno" }, 500);
  }
});
