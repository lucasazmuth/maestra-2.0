// Cumpre a fila de exclusão de contas (LGPD art. 18, VI).
//
// Até aqui `account_deletion_requests` registrava o pedido, marcava o prazo e esperava alguém
// abrir o painel e executar à mão. "Exclusão efetiva" que depende de alguém lembrar não é
// efetiva — e é justamente o que a migration que criou `scheduled_purge_at` dizia querer
// resolver. Esta função é o cron que fecha esse ciclo.
//
// O prazo de 30 dias é DELIBERADO (janela de arrependimento e de verificação de fraude, ver a
// migration `lgpd_exclusao_efetiva`). Esta função não o encurta: ela só executa o que já venceu.
//
// Body: nenhum. Chamada pelo pg_cron com o `cron_auth_key` do vault.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET (opcional).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { apagarConta } from "./apagarConta.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Teto por execução: a fila roda todo dia, e um lote enorme travaria a função no timeout. */
const LOTE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!req.headers.get("Authorization")) return json({ error: "Não autorizado" }, 401);
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: vencidos, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id")
    .is("purged_at", null)
    .not("user_id", "is", null)
    .lte("scheduled_purge_at", new Date().toISOString())
    .order("scheduled_purge_at", { ascending: true })
    .limit(LOTE);

  if (error) {
    console.error("[account-purge-due] fila:", error.message);
    return json({ error: "queue_lookup_failed" }, 500);
  }

  let cumpridos = 0;
  const falhas: string[] = [];

  for (const pedido of vencidos || []) {
    const userId = pedido.user_id as string;

    // Anonimiza ANTES de apagar. A sequência de exclusão remove toda linha que aponta para o
    // usuário — inclusive esta —, e soltar a referência antes é o que faz o registro sobreviver
    // à exclusão que ele documenta. É a prova que uma auditoria da ANPD pede.
    const { error: marca } = await admin
      .from("account_deletion_requests")
      .update({ purged_at: new Date().toISOString(), status: "purged", user_id: null })
      .eq("id", pedido.id);
    if (marca) {
      falhas.push(pedido.id as string);
      continue;
    }

    const { erro } = await apagarConta(admin, userId);
    if (erro) {
      // Marcado como cumprido sem ter cumprido seria mentir na auditoria: reabre.
      await admin
        .from("account_deletion_requests")
        .update({
          purged_at: null, purged_by: null, status: "requested", user_id: userId,
          purge_note: `Execução automática falhou: ${erro}`,
        })
        .eq("id", pedido.id);
      falhas.push(pedido.id as string);
      continue;
    }
    cumpridos++;
  }

  if (falhas.length) console.error("[account-purge-due] falhas:", falhas.length);
  return json({ ok: true, cumpridos, falhas: falhas.length, na_fila: (vencidos || []).length });
});
