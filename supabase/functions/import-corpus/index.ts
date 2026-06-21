import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Ingestão one-off do corpus KSR (313 planejamentos reais e anonimizados) no banco de RAG
// (`strategic_plans`). Para cada plano: infere metadados (segmento/porte/estágio) com a IA,
// monta o conteúdo, gera o embedding gte-small e insere como `corpus_ksr` / `approved`.
// Disposable: depois da ingestão pode ser removida. verify_jwt=false (uso administrativo).

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const model = new Supabase.ai.Session("gte-small");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey",
};

interface RawPlan {
  code: string;
  visao?: string;
  missao?: string;
  valores?: string[];
  objetivos?: string[];
  forcas?: string[];
  fraquezas?: string[];
  oportunidades?: string[];
  ameacas?: string[];
}

const SEGMENTS = "mpb, pop, rock, rap, trap, sertanejo, gospel, funk, eletronica, jazz, samba, pagode, forro, indie, reggae, soul, rnb, axe, instrumental, classica, infantil, outros";

async function inferMeta(p: RawPlan): Promise<{ segment: string; artist_size: string; career_stage: string }> {
  const ctx = [
    p.visao ? `Visão: ${p.visao}` : "",
    p.missao ? `Missão: ${p.missao}` : "",
    p.objetivos?.length ? `Objetivos: ${p.objetivos.slice(0, 6).join("; ")}` : "",
    p.forcas?.length ? `Forças: ${p.forcas.slice(0, 6).join("; ")}` : "",
  ].filter(Boolean).join("\n").slice(0, 1500);
  const prompt = `Classifique este planejamento de carreira musical. Responda em JSON.
- segment: UM gênero/estilo musical predominante, em minúsculas, escolhido desta lista quando possível (${SEGMENTS}). Se não der pra inferir, use "outros".
- artist_size: porte do artista (small | medium | large), inferido pela ambição/estrutura.
- career_stage: estágio (emerging | growing | established).

PLANEJAMENTO:
${ctx}

JSON: { "segment": "...", "artist_size": "...", "career_stage": "..." }`;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "Você classifica planejamentos musicais. Responda APENAS JSON válido." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 120,
        response_format: { type: "json_object" },
      }),
    });
    const data = await r.json();
    const j = JSON.parse(data.choices[0].message.content);
    const seg = String(j.segment || "outros").toLowerCase().trim();
    const size = ["small", "medium", "large"].includes(j.artist_size) ? j.artist_size : "medium";
    const stage = ["emerging", "growing", "established"].includes(j.career_stage) ? j.career_stage : "growing";
    return { segment: seg || "outros", artist_size: size, career_stage: stage };
  } catch (_) {
    return { segment: "outros", artist_size: "medium", career_stage: "growing" };
  }
}

function buildFullContent(p: RawPlan): string {
  const sec = (t: string, items?: string[]) => (items?.length ? `\n## ${t}\n- ${items.join("\n- ")}` : "");
  return [
    `# Planejamento Estratégico — ${p.code}`,
    p.visao ? `\n## Visão\n${p.visao}` : "",
    p.missao ? `\n## Missão\n${p.missao}` : "",
    p.valores?.length ? `\n## Valores\n${p.valores.join(", ")}` : "",
    sec("Objetivos", p.objetivos),
    sec("Forças", p.forcas),
    sec("Fraquezas", p.fraquezas),
    sec("Oportunidades", p.oportunidades),
    sec("Ameaças", p.ameacas),
  ].join("").slice(0, 10000);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const body = await req.json();
    const plans: RawPlan[] = Array.isArray(body) ? body : body.plans || [];
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results: any[] = [];

    for (const p of plans) {
      try {
        const meta = await inferMeta(p);
        const context_summary = (p.visao || (p.objetivos || []).join("; ") || p.code).slice(0, 500);
        const full_content = buildFullContent(p);
        const objectives = p.objetivos || [];

        const embeddingText = [meta.segment, meta.artist_size, meta.career_stage, "annual", p.code, context_summary, JSON.stringify(objectives).slice(0, 200)].join(" ");
        const embedding = await model.run(embeddingText, { mean_pool: true, normalize: true });
        const embeddingArray = Array.from(embedding as Float32Array);

        const { error } = await supabase.from("strategic_plans").insert({
          artist_id: null,
          segment: meta.segment,
          artist_size: meta.artist_size,
          career_stage: meta.career_stage,
          plan_type: "annual",
          title: `Planejamento KSR — ${p.code}`,
          context_summary,
          objectives,
          strategies: null,
          kpis: null,
          timeline: null,
          full_content,
          embedding: JSON.stringify(embeddingArray),
          source: "corpus_ksr",
          quality_score: 5,
          status: "approved",
        });
        if (error) results.push({ code: p.code, error: error.message });
        else results.push({ code: p.code, segment: meta.segment, status: "ok" });
      } catch (e: any) {
        results.push({ code: p.code, error: String(e?.message || e).slice(0, 120) });
      }
    }

    return new Response(
      JSON.stringify({ imported: results.filter((r) => r.status === "ok").length, errors: results.filter((r) => r.error).length, details: results }),
      { headers: { "Content-Type": "application/json", ...CORS } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
});
