import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cobrança única (R$199,90) de um artista JÁ EXISTENTE (criado no diagnóstico).
// Confirmação do pagamento (webhook) apenas DESBLOQUEIA (is_locked=false). Endpoints /api/v3.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function fetchPixQrCode(asaasApiUrl: string, asaasApiKey: string, paymentId: string) {
  const empty = { qrCode: null, copyPaste: null, expiresAt: null };
  try {
    const res = await fetch(`${asaasApiUrl}/api/v3/payments/${paymentId}/pixQrCode`, { method: "GET", headers: { "Content-Type": "application/json", access_token: asaasApiKey } });
    if (!res.ok) return empty;
    const data = await res.json();
    return { qrCode: data.encodedImage || null, copyPaste: data.payload || null, expiresAt: data.expirationDate || null };
  } catch (e: any) { console.error("PIX QR error:", e?.message); return empty; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://sandbox.asaas.com";
    const profileValue = Number(Deno.env.get("ASAAS_ARTIST_PROFILE_VALUE") || "199.90");
    if (!asaasApiKey) return json({ error: "Erro interno de configuração" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { artistId, customerId, billingType, creditCard, creditCardHolderInfo, installmentCount } = body;
    if (!artistId || typeof artistId !== "string") return json({ error: "artistId é obrigatório", field: "artistId" }, 400);
    if (!customerId || typeof customerId !== "string") return json({ error: "customerId é obrigatório", field: "customerId" }, 400);
    const isCreditCard = billingType === "CREDIT_CARD";
    const isDebitCard = billingType === "DEBIT_CARD";
    const isCard = isCreditCard || isDebitCard;
    // Parcelamento só no crédito; limita 1..12 por segurança.
    const installments = isCreditCard && Number(installmentCount) > 1 ? Math.min(12, Math.floor(Number(installmentCount))) : 1;

    // O artista precisa existir, ser do usuário e estar pendente.
    const { data: artist, error: artistError } = await supabaseAdmin
      .from("artists").select("id, user_id, name, is_locked").eq("id", artistId).maybeSingle();
    if (artistError) return json({ error: "Erro interno" }, 500);
    if (!artist || artist.user_id !== user.id) return json({ error: "Perfil não encontrado" }, 403);
    if (artist.is_locked === false) return json({ error: "Este perfil já está ativo." }, 409);

    // Idempotência: reaproveita PIX pendente; já recebido → 409.
    const { data: purchases } = await supabaseAdmin
      .from("artist_purchases").select("*").eq("artist_id", artistId).order("created_at", { ascending: false });
    if ((purchases || []).some((p: any) => p.status === "received")) return json({ error: "Este perfil já está ativo." }, 409);
    const pendingP = (purchases || []).find((p: any) => p.status === "pending" && p.asaas_payment_id);
    // Só PIX reaproveita a cobrança pendente (o QR já existe); cartão sempre cria nova.
    if (pendingP && !isCard) {
      const pixData = await fetchPixQrCode(asaasApiUrl, asaasApiKey, pendingP.asaas_payment_id);
      return json({ purchaseId: pendingP.id, pixData });
    }

    const billingValue = billingType === "CREDIT_CARD" ? "CREDIT_CARD" : billingType === "DEBIT_CARD" ? "DEBIT_CARD" : "PIX";
    const nowIso = new Date().toISOString();
    const { data: purchaseRow, error: purchaseInsertError } = await supabaseAdmin
      .from("artist_purchases")
      .insert({ artist_id: artistId, user_id: user.id, artist_name: artist.name, amount: profileValue, billing_type: billingValue, status: "pending", created_at: nowIso, updated_at: nowIso })
      .select().single();
    if (purchaseInsertError || !purchaseRow) { console.error("purchase insert:", purchaseInsertError); return json({ error: "Erro interno" }, 500); }

    const dueDate = nowIso.split("T")[0];
    const paymentPayload: Record<string, unknown> = { customer: customerId, billingType: billingValue, dueDate, description: `Maestra — Perfil de artista (${artist.name})`, externalReference: `purchase:${purchaseRow.id}` };
    // Parcelamento (crédito): Asaas divide o total pelas parcelas. Senão, valor à vista.
    if (installments > 1) {
      paymentPayload.installmentCount = installments;
      paymentPayload.totalValue = profileValue;
    } else {
      paymentPayload.value = profileValue;
    }
    if (isCard) {
      if (!creditCard || !creditCardHolderInfo) return json({ error: "Dados do cartão são obrigatórios" }, 400);
      paymentPayload.creditCard = { holderName: creditCard.holderName, number: creditCard.number, expiryMonth: creditCard.expiryMonth, expiryYear: creditCard.expiryYear, ccv: creditCard.ccv };
      paymentPayload.creditCardHolderInfo = { name: creditCardHolderInfo.name, email: creditCardHolderInfo.email || user.email, cpfCnpj: creditCardHolderInfo.cpfCnpj, postalCode: creditCardHolderInfo.postalCode, addressNumber: creditCardHolderInfo.addressNumber || "0", phone: creditCardHolderInfo.phone };
    }

    let paymentResponse: Response;
    try {
      paymentResponse = await fetch(`${asaasApiUrl}/api/v3/payments`, { method: "POST", headers: { "Content-Type": "application/json", access_token: asaasApiKey }, body: JSON.stringify(paymentPayload) });
    } catch (fe: any) {
      await supabaseAdmin.from("artist_purchases").delete().eq("id", purchaseRow.id);
      return json({ error: "Serviço de pagamento indisponível" }, 502);
    }
    if (!paymentResponse.ok) {
      const errorBody = await paymentResponse.text();
      console.error("Asaas payment error:", paymentResponse.status, errorBody.slice(0, 300));
      await supabaseAdmin.from("artist_purchases").delete().eq("id", purchaseRow.id);
      if (paymentResponse.status === 400) {
        let errorMessage = "Dados inválidos para o gateway de pagamento";
        try { const parsed = JSON.parse(errorBody); if (parsed.errors && parsed.errors.length > 0) errorMessage = parsed.errors[0].description || errorMessage; } catch { /* */ }
        return json({ error: errorMessage }, 400);
      }
      return json({ error: "Falha na comunicação com serviço de pagamento" }, 502);
    }

    const paymentData = await paymentResponse.json();
    const asaasPaymentId = paymentData.id as string;
    const paidNow = paymentData.status === "CONFIRMED" || paymentData.status === "RECEIVED";
    await supabaseAdmin.from("artist_purchases").update({ asaas_payment_id: asaasPaymentId, updated_at: new Date().toISOString() }).eq("id", purchaseRow.id);

    if (isCard) {
      if (paidNow) {
        const paidIso = new Date().toISOString();
        await supabaseAdmin.from("artists").update({ is_locked: false, purchased_at: paidIso }).eq("id", artistId);
        await supabaseAdmin.from("artist_purchases").update({ status: "received", paid_at: paidIso, updated_at: paidIso }).eq("id", purchaseRow.id);
        return json({ purchaseId: purchaseRow.id, artistId, status: "received" });
      }
      return json({ purchaseId: purchaseRow.id, status: "pending" });
    }
    const pixData = await fetchPixQrCode(asaasApiUrl, asaasApiKey, asaasPaymentId);
    return json({ purchaseId: purchaseRow.id, pixData });
  } catch (error: any) {
    console.error("Unexpected error in asaas-create-artist-charge:", error?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
