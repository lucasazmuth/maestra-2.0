import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Status de pagamento Asaas considerados pagos / em aberto.
const PAID = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const OPEN = ["PENDING", "OVERDUE"];

async function asaasGet(url: string, key: string): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(url, { headers: { "Content-Type": "application/json", "access_token": key }, signal: controller.signal });
    clearTimeout(t);
    return res;
  } catch (_e) {
    return null;
  }
}

// Retoma um pagamento PIX pendente: pela assinatura existente do usuário, busca a cobrança em
// aberto no Asaas e devolve o QR atual. NUNCA cria assinatura nova (reusa a do usuário).
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    // API da Asaas: produção https://api.asaas.com, sandbox https://api-sandbox.asaas.com.
    // Path /v3 (SEM /api) — api.asaas.com responde 404 para /api/v3.
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";

    if (!asaasApiKey) return json({ error: "Erro interno de configuração" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    // Assinatura do usuário.
    const { data: sub } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("status, asaas_subscription_id, billing_type, value, cycle")
      .eq("user_id", user.id)
      .maybeSingle();

    // Nada pra retomar.
    if (!sub || !sub.asaas_subscription_id || sub.status === "none" || sub.status === "cancelled") {
      return json({ status: "none" });
    }
    if (sub.status === "active") {
      return json({ status: "active" });
    }

    const value = sub.value != null ? Number(sub.value) : null;
    const cycle = sub.cycle || "MONTHLY";

    // Busca as cobranças da assinatura no Asaas.
    const payResp = await asaasGet(
      `${asaasApiUrl}/v3/payments?subscription=${sub.asaas_subscription_id}&limit=20`,
      asaasApiKey,
    );
    if (!payResp || !payResp.ok) {
      return json({ status: sub.status, pixData: null, value, cycle });
    }
    const payJson = await payResp.json().catch(() => ({}));
    const payments: any[] = Array.isArray(payJson.data) ? payJson.data : [];

    // Já pago em algum ciclo → marca ativa e retorna.
    if (payments.some((p) => PAID.includes(p.status))) {
      await supabaseAdmin
        .from("asaas_subscriptions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      return json({ status: "active" });
    }

    // Cobrança PIX em aberto (PENDING primeiro, depois OVERDUE).
    const open = payments
      .filter((p) => p.billingType === "PIX" && OPEN.includes(p.status))
      .sort((a, b) => (a.status === "PENDING" ? -1 : 1));
    const target = open[0];

    if (!target) {
      // Sem cobrança PIX em aberto (ex.: cartão, ou nenhuma gerada ainda).
      return json({ status: sub.status, pixData: null, value, cycle });
    }

    // QR atual da cobrança em aberto.
    const qrResp = await asaasGet(`${asaasApiUrl}/v3/payments/${target.id}/pixQrCode`, asaasApiKey);
    if (!qrResp || !qrResp.ok) {
      return json({ status: "pending", pixData: null, value, cycle });
    }
    const qr = await qrResp.json().catch(() => ({}));

    return json({
      status: "pending",
      pixData: {
        qrCode: qr.encodedImage || null,
        copyPaste: qr.payload || null,
        expiresAt: qr.expirationDate || null,
      },
      value,
      cycle,
    });
  } catch (error: any) {
    console.error("Unexpected error in asaas-resume-payment:", error?.message, error?.stack);
    return json({ error: "Erro interno" }, 500);
  }
});
