/**
 * Logging de consumo da API Chartmetric — cada chamada (sucesso OU erro) custa crédito real.
 * Grava uma linha leve em `chartmetric_api_calls` para auditar consumo e detectar loops.
 *
 * Fire-and-forget: NUNCA quebra o fluxo principal. Se a tabela não existir ou o insert falhar,
 * o erro é engolido (apenas um console.warn).
 */

export interface ChartmetricCallEntry {
  function_name: string;
  artist_id?: string | null;
  endpoint: string;
  ok: boolean;
  status_code?: number | null;
  duration_ms?: number | null;
}

// Reduz a cardinalidade do endpoint: troca o cm_id numérico e o spotify_id por placeholders,
// igual ao painel do Chartmetric (/api/artist/:id, /api/artist/spotify/:id/get-ids).
export function templateEndpoint(path: string): string {
  return path
    .split("?")[0]
    .replace(/\/artist\/spotify\/[A-Za-z0-9]+/, "/artist/spotify/:id")
    .replace(/\/artist\/\d+/, "/artist/:id")
    .replace(/\/stat\/[a-z]+/i, "/stat/:source");
}

// `supabaseAdmin` é um client com service role (o mesmo já criado em cada edge function).
export function logChartmetricCall(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  entry: ChartmetricCallEntry,
): void {
  try {
    const row = {
      function_name: entry.function_name,
      artist_id: entry.artist_id ?? null,
      endpoint: templateEndpoint(entry.endpoint),
      ok: entry.ok,
      status_code: entry.status_code ?? null,
      duration_ms: entry.duration_ms ?? null,
    };
    // Fire-and-forget: não await pra não somar latência no caminho quente.
    Promise.resolve(supabaseAdmin.from("chartmetric_api_calls").insert(row))
      .catch((e: unknown) => console.warn("logChartmetricCall insert failed:", (e as Error)?.message));
  } catch (e) {
    console.warn("logChartmetricCall failed:", (e as Error)?.message);
  }
}
