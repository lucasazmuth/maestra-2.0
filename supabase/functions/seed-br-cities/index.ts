import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Seed único da tabela `br_cities` com os municípios do IBGE (nome + UF), para o dropdown de
// cidade do Wizard (Metodologia v2, Q6). Idempotente: se a tabela já tem linhas, não re-insere.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { count } = await supabase.from("br_cities").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return json({ ok: true, alreadySeeded: count });

    const res = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
    if (!res.ok) return json({ ok: false, reason: "ibge_unavailable", status: res.status }, 502);
    const munis = await res.json();

    const rows = (munis as any[])
      .map((m) => {
        const uf =
          m?.microrregiao?.mesorregiao?.UF?.sigla ??
          m?.["regiao-imediata"]?.["regiao-intermediaria"]?.UF?.sigla ??
          null;
        return uf ? { name: String(m.nome), uf: String(uf), search: norm(String(m.nome)) } : null;
      })
      .filter((r): r is { name: string; uf: string; search: string } => !!r);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("br_cities").upsert(batch, { onConflict: "name,uf", ignoreDuplicates: true });
      if (error) return json({ ok: false, error: error.message, inserted }, 500);
      inserted += batch.length;
    }
    return json({ ok: true, inserted });
  } catch (e: any) {
    return json({ ok: false, error: e?.message }, 500);
  }
});
