import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reconciliação de cobrança única: pergunta o status DIRETO pra Asaas e desbloqueia o
// perfil se o pagamento estiver confirmado — sem depender do webhook.
//
// Existe porque o webhook é ponto único de falha: em 08/08/2026 a fila da Asaas ficou
// pausada 5 dias, e como o polling do checkout só lia a tabela local, quem pagava via PIX
// via a tela girar por 10 min e nunca desbloqueava, mesmo com o dinheiro já compensado.
//
// Só o DONO da compra pode reconciliar, e o desbloqueio só acontece se a própria Asaas
// devolver um status pago — o cliente nunca decide isso.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Status da Asaas que significam dinheiro em caixa.
const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";
    if (!asaasApiKey) return json({ error: "Erro interno de configuração" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { purchaseId } = body;
    if (!purchaseId || typeof purchaseId !== "string") {
      return json({ error: "purchaseId é obrigatório", field: "purchaseId" }, 400);
    }

    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from("artist_purchases")
      .select("id, user_id, artist_id, asaas_payment_id, status")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError) return json({ error: "Erro interno" }, 500);
    // Não distingue "não existe" de "é de outro usuário" — evita sondagem de ids.
    if (!purchase || purchase.user_id !== user.id) return json({ error: "Compra não encontrada" }, 403);

    // Já confirmada (pelo webhook ou por uma reconciliação anterior): nada a fazer.
    if (purchase.status === "received") {
      return json({ status: "received", artistId: purchase.artist_id, source: "local" });
    }

    if (!purchase.asaas_payment_id) return json({ status: purchase.status, artistId: purchase.artist_id });

    const asaasRes = await fetch(`${asaasApiUrl}/v3/payments/${purchase.asaas_payment_id}`, {
      headers: { "Content-Type": "application/json", access_token: asaasApiKey },
    });

    if (!asaasRes.ok) {
      console.error(`Asaas payment lookup failed (${asaasRes.status}) for ${purchase.asaas_payment_id}`);
      // Indisponibilidade da Asaas não é "não pago" — o checkout deve continuar tentando.
      return json({ error: "Não foi possível consultar o pagamento agora." }, 502);
    }

    const payment = await asaasRes.json();
    const asaasStatus = String(payment?.status || "");

    if (!PAID_STATUSES.has(asaasStatus)) {
      return json({ status: purchase.status, asaasStatus, artistId: purchase.artist_id });
    }

    // Confirmado na Asaas → espelha o mesmo efeito do webhook (passo 4b): marca a compra
    // como recebida e destrava o perfil. Idempotente: reexecutar não muda o resultado.
    const nowIso = new Date().toISOString();
    await supabaseAdmin
      .from("artist_purchases")
      .update({ status: "received", paid_at: payment?.paymentDate || nowIso, updated_at: nowIso })
      .eq("id", purchase.id);

    if (purchase.artist_id) {
      const { error: unlockError } = await supabaseAdmin
        .from("artists")
        .update({ is_locked: false, purchased_at: nowIso })
        .eq("id", purchase.artist_id);
      if (unlockError) {
        console.error("Error unlocking artist on reconcile:", unlockError);
        return json({ error: "Erro ao liberar o perfil" }, 500);
      }
    }

    console.log(`Reconcile: purchase=${purchase.id} confirmada via API (${asaasStatus}), artist=${purchase.artist_id}`);
    return json({ status: "received", artistId: purchase.artist_id, asaasStatus, source: "asaas" });
  } catch (err) {
    console.error("Unexpected error in reconcile handler:", (err as { message?: string })?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
