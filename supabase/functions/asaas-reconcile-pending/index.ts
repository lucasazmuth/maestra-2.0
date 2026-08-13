import { createClient } from "jsr:@supabase/supabase-js@2";

// Varredura periódica das cobranças únicas que ficaram "pending": pergunta o status pra
// Asaas e destrava o perfil de quem já pagou. É a rede de segurança do webhook.
//
// O fallback do checkout (asaas-reconcile-purchase) só roda enquanto o usuário está com a
// tela aberta. Quem paga o PIX depois de fechar a aba dependia 100% do webhook — e quando
// a fila da Asaas ficou pausada (08/08/2026, 5 dias) ninguém percebeu. Este cron fecha
// esse buraco: mesmo com o webhook mudo, o perfil libera sozinho em no máximo 15 min.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ASAAS_API_KEY, ASAAS_API_URL,
//          CRON_SECRET (opcional; se setado, exige header x-cron-secret).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") || "";
const ASAAS_API_URL = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, x-cron-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Status da Asaas que significam dinheiro em caixa.
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

// Janela de varredura. Cobranças mais antigas que isso já venceram (PIX/boleto expiram
// bem antes) — reconsultar todas elas pra sempre só queimaria chamada de API.
const WINDOW_HOURS = 48;
// Teto por execução: evita estourar o tempo da function num acúmulo inesperado.
const MAX_PER_RUN = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);
  if (!ASAAS_API_KEY) return json({ error: "Erro interno de configuração" }, 500);

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: pendings, error } = await supabaseAdmin
    .from("artist_purchases")
    .select("id, artist_id, asaas_payment_id, status, created_at")
    .eq("status", "pending")
    .not("asaas_payment_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("Erro ao listar compras pendentes:", error);
    return json({ error: "Erro interno" }, 500);
  }

  let confirmed = 0;
  let stillPending = 0;
  let failed = 0;

  for (const p of pendings || []) {
    try {
      const res = await fetch(`${ASAAS_API_URL}/v3/payments/${p.asaas_payment_id}`, {
        headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
      });

      if (!res.ok) {
        // Inclui o 404 de cobrança removida na Asaas: sem confirmação, não mexemos no
        // status — quem marca 'failed' é o webhook, que tem o evento pra isso.
        console.warn(`Asaas lookup ${res.status} para ${p.asaas_payment_id}`);
        failed += 1;
        continue;
      }

      const payment = await res.json();
      if (!PAID_STATUSES.has(String(payment?.status || ""))) {
        stillPending += 1;
        continue;
      }

      const nowIso = new Date().toISOString();
      await supabaseAdmin
        .from("artist_purchases")
        .update({ status: "received", paid_at: payment?.paymentDate || nowIso, updated_at: nowIso })
        .eq("id", p.id);

      if (p.artist_id) {
        const { error: unlockError } = await supabaseAdmin
          .from("artists")
          .update({ is_locked: false, purchased_at: nowIso })
          .eq("id", p.artist_id);
        if (unlockError) {
          console.error("Erro ao desbloquear artista:", p.artist_id, unlockError);
          failed += 1;
          continue;
        }
      }

      confirmed += 1;
      console.log(`Reconcile-cron: purchase=${p.id} confirmada (${payment?.status}), artist=${p.artist_id}`);
    } catch (err) {
      failed += 1;
      console.error("Erro reconciliando", p.id, (err as { message?: string })?.message);
    }
  }

  const summary = { scanned: (pendings || []).length, confirmed, stillPending, failed };
  // Confirmar algo aqui significa que o webhook NÃO fez o trabalho dele — vale destacar
  // no log, é o sintoma precoce de fila pausada de novo.
  if (confirmed > 0) console.warn(`Reconcile-cron destravou ${confirmed} compra(s) — conferir a fila de webhooks da Asaas`, summary);
  else console.log("Reconcile-cron:", summary);

  return json(summary);
});
