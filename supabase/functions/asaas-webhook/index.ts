import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendBrevoEmail, emailLayout, ctaButton } from "./brevo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = (Deno.env.get("APP_URL") || "https://www.maestramanager.com").replace(/\/+$/, "");

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtData = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return d && m ? `${d}/${m}/${y}` : "";
};

/**
 * Avisa o assinante que a cobrança do novo ciclo está aberta — in-app e por e-mail.
 *
 * Existe porque a assinatura PIX da Asaas é recorrência de COBRANÇA, não de débito: a cada ciclo
 * nasce um QR novo que alguém precisa pagar. Sem este aviso o assinante só descobria quando o
 * acesso começava a ser ameaçado (ou nem isso).
 *
 * Idempotente por cobrança: a chave é o `asaas_payment_id` em `reference_id`, então uma reentrega
 * do webhook não gera dois avisos. Falha de e-mail não derruba o webhook — a notificação in-app
 * já cumpre o papel, e devolver erro faria a Asaas reenfileirar o evento.
 */
async function notificarRenovacao(
  // deno-lint-ignore no-explicit-any
  admin: any,
  userId: string,
  paymentId: string,
  info: { value: number; dueDate: string | null },
): Promise<void> {
  try {
    const { data: existente } = await admin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("reference_type", "billing")
      .eq("reference_id", paymentId)
      .limit(1);
    if (existente && existente.length) return;

    const vence = fmtData(info.dueDate);
    const titulo = "Sua renovação do Maestra PRO está aberta";
    const msg = vence
      ? `A cobrança de ${fmtBRL(info.value)} vence em ${vence}. Você pode pagar pelo PIX agora.`
      : `A cobrança de ${fmtBRL(info.value)} está disponível. Você pode pagar pelo PIX agora.`;

    await admin.from("notifications").insert({
      user_id: userId,
      artist_id: null,
      type: "billing",
      title: titulo,
      message: msg,
      link: "/pagamento",
      read: false,
      source: "billing",
      reference_type: "billing",
      reference_id: paymentId,
      status: "active",
      created_at: new Date().toISOString(),
    });

    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u?.user?.email;
    if (!email) return;
    const nome = String(u.user.user_metadata?.full_name || "").split(" ")[0] || "";

    await sendBrevoEmail({
      to: email,
      toName: nome,
      subject: titulo,
      html: emailLayout({
        title: titulo,
        bodyHtml:
          `<p>${nome ? `Oi, ${nome}. ` : ""}${msg}</p>` +
          `<p>Se preferir, você pode pagar direto pelo app.</p>` +
          ctaButton("Pagar minha renovação", `${APP_URL}/pagamento`),
      }),
    });
  } catch (e) {
    console.error("[billing] aviso de renovação falhou:", (e as Error)?.message);
  }
}

// ─── Event Type to Subscription Status Mapping ────────────────────────────────

const EVENT_STATUS_MAP: Record<string, string> = {
  PAYMENT_CONFIRMED: "active",
  PAYMENT_RECEIVED: "active",
  PAYMENT_OVERDUE: "overdue",
  SUBSCRIPTION_DELETED: "cancelled",
  SUBSCRIPTION_INACTIVATED: "cancelled",
};

// Payment-related events that should insert/update a record in asaas_payments
const PAYMENT_EVENTS = new Set([
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
]);

// Falha/recusa de cartão de crédito. Se acontecem na 1ª cobrança de uma assinatura
// que ainda está "pending", a assinatura ficava presa em "análise" pra sempre e o
// usuário não conseguia tentar outro cartão. Nesses eventos, cancelamos e liberamos.
const CARD_FAILURE_EVENTS = new Set([
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", // cartão recusado na captura (ex.: sem limite)
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",   // reprovado na análise de risco
  "PAYMENT_REFUNDED",                    // estornado
  "PAYMENT_CHARGEBACK_REQUESTED",        // chargeback aberto
]);

// All event types we handle (subscription status changes + payment-only events)
const HANDLED_EVENTS = new Set([
  ...Object.keys(EVENT_STATUS_MAP),
  ...CARD_FAILURE_EVENTS,
  "PAYMENT_DELETED",
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
]);

// Map Asaas payment events to our payment status
const PAYMENT_STATUS_MAP: Record<string, string> = {
  PAYMENT_CONFIRMED: "confirmed",
  PAYMENT_RECEIVED: "received",
  PAYMENT_OVERDUE: "overdue",
  PAYMENT_DELETED: "deleted",
};

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // ─── 1. Authentication: Validate asaas-access-token header ─────────────────
    const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const receivedToken = req.headers.get("asaas-access-token");

    if (!receivedToken || receivedToken !== webhookToken) {
      console.warn("Webhook auth failed: invalid or missing asaas-access-token");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 2. Parse payload (graceful degradation for malformed payloads) ────────
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch (err) {
      console.error("Malformed JSON payload:", err);
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const eventId = payload.id as string | undefined;
    const eventType = payload.event as string | undefined;
    const paymentData = payload.payment as Record<string, unknown> | undefined;

    if (!eventId || !eventType) {
      console.error("Missing required fields in webhook payload", {
        hasId: !!eventId,
        hasEvent: !!eventType,
      });
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is an event we handle
    const newStatus = EVENT_STATUS_MAP[eventType] || null;
    if (!HANDLED_EVENTS.has(eventType)) {
      // Event type we don't handle — acknowledge it
      console.log(`Unhandled event type: ${eventType}, acknowledging`);
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract subscription identifier from payload.
    // Eventos de PAGAMENTO trazem payment.subscription como STRING (id).
    // Eventos de ASSINATURA (SUBSCRIPTION_DELETED/INACTIVATED) trazem payload.subscription
    // como OBJETO ({id, customer, ...}) — sem tratar isso, o id virava um objeto, a busca
    // no banco não casava e o cancelamento nunca era aplicado (evento só ficava na auditoria).
    const subscriptionObj =
      payload.subscription && typeof payload.subscription === "object"
        ? (payload.subscription as Record<string, unknown>)
        : undefined;
    const subscriptionId =
      (paymentData?.subscription as string) ||
      (typeof payload.subscription === "string" ? (payload.subscription as string) : null) ||
      (subscriptionObj?.id as string) ||
      null;
    const customerId =
      (paymentData?.customer as string) ||
      (subscriptionObj?.customer as string) ||
      (payload.customer as string) ||
      null;

    if (!subscriptionId && !customerId) {
      console.error("Missing subscription/customer identifier in webhook payload", {
        eventId,
        eventType,
      });
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 3. Initialize Supabase Admin Client ──────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    // Usados só p/ cancelar a assinatura na Asaas quando o cartão é recusado (path /v3).
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasBaseUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";

    // ─── 4. Idempotency Check ─────────────────────────────────────────────────
    const { data: existingEvent, error: idempotencyError } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("id")
      .eq("event_id", eventId)
      .maybeSingle();

    if (idempotencyError) {
      console.error("Idempotency check failed:", idempotencyError);
      return new Response(
        JSON.stringify({ error: "Erro interno" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingEvent) {
      // Already processed — return 200 without modifying state
      console.log(`Event ${eventId} already processed, skipping`);
      return new Response(
        JSON.stringify({ message: "ok", duplicate: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 4b. One-time artist-profile charge (cobrança única R$199,90) ─────────
    // Pagamentos de ASSINATURA trazem payment.subscription; a cobrança única NÃO.
    // Se for um pagamento avulso ligado a um artist_purchases → desbloqueia o PERFIL
    // (e NÃO mexe na assinatura). Tratado antes da busca por assinatura.
    const asaasPaymentId = (paymentData?.id as string) || null;
    const isSubscriptionPayment = !!(paymentData?.subscription);

    if (PAYMENT_EVENTS.has(eventType) && asaasPaymentId && !isSubscriptionPayment) {
      const { data: purchase, error: purchaseLookupError } = await supabaseAdmin
        .from("artist_purchases")
        .select("*")
        .eq("asaas_payment_id", asaasPaymentId)
        .maybeSingle();

      if (purchaseLookupError) {
        console.error("Error looking up artist_purchase:", purchaseLookupError);
        return new Response(
          JSON.stringify({ error: "Erro interno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (purchase) {
        const nowIso = new Date().toISOString();

        if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
          // O artista já existe (criado no diagnóstico). Confirmar → só DESBLOQUEIA.
          await supabaseAdmin
            .from("artist_purchases")
            .update({ status: "received", paid_at: nowIso, updated_at: nowIso })
            .eq("id", purchase.id);
          if (purchase.artist_id) {
            const { error: unlockError } = await supabaseAdmin
              .from("artists")
              .update({ is_locked: false, purchased_at: nowIso })
              .eq("id", purchase.artist_id);
            if (unlockError) console.error("Error unlocking artist:", unlockError);
          }
        } else if (eventType === "PAYMENT_OVERDUE" || eventType === "PAYMENT_DELETED" || CARD_FAILURE_EVENTS.has(eventType)) {
          // Vencida/removida/cartão recusado sem confirmação → marca como falha.
          // (failed libera nova tentativa: o create-artist-charge só bloqueia em 'received'.)
          if (purchase.status === "pending") {
            await supabaseAdmin
              .from("artist_purchases")
              .update({ status: "failed", updated_at: nowIso })
              .eq("id", purchase.id);
          }
        }

        // Registra o evento (idempotência/auditoria) e encerra — não é assinatura.
        await supabaseAdmin.from("asaas_webhook_events").insert({
          event_id: eventId,
          event_type: eventType,
          payload: payload,
          processed_at: nowIso,
        });

        console.log(`Webhook (artist-charge) processed: event=${eventType}, artist=${purchase.artist_id}`);
        return new Response(
          JSON.stringify({ message: "ok" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Sem artist_purchase correspondente → cai no fluxo de assinatura abaixo.
    }

    // ─── 5. Look up subscription in database ──────────────────────────────────
    let subscriptionRecord: Record<string, unknown> | null = null;

    if (subscriptionId) {
      const { data, error } = await supabaseAdmin
        .from("asaas_subscriptions")
        .select("*")
        .eq("asaas_subscription_id", subscriptionId)
        .maybeSingle();

      if (error) {
        console.error("Error looking up subscription by subscription_id:", error);
        return new Response(
          JSON.stringify({ error: "Erro interno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      subscriptionRecord = data;
    }

    // Fallback: look up by customer_id.
    // asaas_customer_id NÃO é único: um mesmo cliente da Asaas pode estar vinculado a
    // vários usuários. Por isso não dá pra usar .maybeSingle() aqui — com 2+ linhas ele
    // retorna erro, a função respondia 500 e a Asaas pausava a FILA INTEIRA (incidente de
    // 08/08: 5 dias sem processar pagamento nenhum, perfis pagos sem liberar).
    // Com múltiplas linhas o vínculo é ambíguo — casar pelo cliente poderia ativar o Pro
    // do usuário errado —, então não escolhemos nenhuma: registra e segue sem assinatura.
    if (!subscriptionRecord && customerId) {
      const { data, error } = await supabaseAdmin
        .from("asaas_subscriptions")
        .select("*")
        .eq("asaas_customer_id", customerId);

      if (error) {
        console.error("Error looking up subscription by customer_id:", error);
        return new Response(
          JSON.stringify({ error: "Erro interno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (data && data.length === 1) {
        subscriptionRecord = data[0];
      } else if (data && data.length > 1) {
        console.warn("Ambiguous customer_id (múltiplos usuários no mesmo cliente Asaas) — sem match de assinatura", {
          eventId,
          eventType,
          customerId,
          matches: data.length,
        });
      }
    }

    if (!subscriptionRecord) {
      console.warn("Subscription not found for webhook event", {
        eventId,
        eventType,
        subscriptionId,
        customerId,
      });
      // Record the event anyway for audit, then return 200
      await supabaseAdmin.from("asaas_webhook_events").insert({
        event_id: eventId,
        event_type: eventType,
        payload: payload,
        processed_at: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = subscriptionRecord.user_id as string;

    // ─── 5b. Falha/recusa de cartão na 1ª cobrança ────────────────────────────
    // Se a assinatura ainda está "pending" (nunca ativou) e o cartão foi recusado/
    // reprovado, ela ficaria presa em "análise" pra sempre e a trava anti-duplicidade
    // impediria o usuário de tentar outro cartão. Cancela (Asaas + local) e libera o
    // retry — o gate da /assinatura reabre e o create-subscription deixa criar de novo.
    if (CARD_FAILURE_EVENTS.has(eventType) && subscriptionRecord.status === "pending") {
      const subId = subscriptionRecord.asaas_subscription_id as string | null;
      if (subId && asaasApiKey) {
        try {
          await fetch(`${asaasBaseUrl}/v3/subscriptions/${subId}`, {
            method: "DELETE",
            headers: { "access_token": asaasApiKey, "Content-Type": "application/json" },
          });
        } catch (delErr) {
          console.warn("Falha ao cancelar assinatura recusada na Asaas:", (delErr as { message?: string })?.message);
        }
      }
      await supabaseAdmin
        .from("asaas_subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", subscriptionRecord.id);
      await supabaseAdmin.from("asaas_webhook_events").insert({
        event_id: eventId, event_type: eventType, payload, processed_at: new Date().toISOString(),
      });
      console.log(`Webhook: cartão recusado em assinatura pending → cancelada (user=${userId}, event=${eventType})`);
      return new Response(
        JSON.stringify({ message: "ok" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── 6. Update subscription status (only for events that change subscription status) ─
    // SÓ atualiza o status da ASSINATURA quando o evento é realmente de assinatura
    // (payment.subscription / payload.subscription presente). Um pagamento ÚNICO (perfil R$199,90,
    // incl. parcelas) pode cair aqui pelo fallback de customer_id — nesse caso NÃO pode marcar a
    // assinatura como ativa, senão gera "assinatura" fantasma de valor 0 (Pro não pago).
    if (newStatus && subscriptionId) {
      const updateFields: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Calculate grace_period_ends_at when status → overdue (7 days from event date)
      if (newStatus === "overdue") {
        const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // now + 7 days
        updateFields.grace_period_ends_at = gracePeriodEnd.toISOString();
      }

      // Clear grace period when status → active
      if (newStatus === "active") {
        updateFields.grace_period_ends_at = null;
        updateFields.started_at = subscriptionRecord.started_at || new Date().toISOString();
        // Pagou o ciclo: não há mais renovação em aberto.
        updateFields.pending_charge_id = null;
        // Pagou: baixa o aviso de renovação daquela cobrança para ele não ficar pendurado no sino.
        // Só `read` — o front filtra por ele (`services/db/notifications.ts`) e nunca por `status`,
        // que hoje é `active` em 100% das linhas; inventar um valor novo aqui seria letra morta.
        if (asaasPaymentId && userId) {
          await supabaseAdmin
            .from("notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("reference_type", "billing")
            .eq("reference_id", asaasPaymentId);
        }
      }

      // Backfill do id da assinatura: quando o registro é encontrado pelo fallback de customer_id
      // e ainda está sem asaas_subscription_id, grava o id vindo do payload. Isso evita linhas
      // 'active' sem id (que travavam o cancelamento direto e exigiam lookup por cliente).
      if (subscriptionId && !subscriptionRecord.asaas_subscription_id) {
        updateFields.asaas_subscription_id = subscriptionId;
      }

      const { error: updateError } = await supabaseAdmin
        .from("asaas_subscriptions")
        .update(updateFields)
        .eq("id", subscriptionRecord.id);

      if (updateError) {
        console.error("Error updating subscription status:", updateError);
        return new Response(
          JSON.stringify({ error: "Erro interno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (newStatus && !subscriptionId) {
      // Pagamento único caiu no fluxo de assinatura pelo fallback de cliente — ignorado de propósito.
      console.log(`Skipping subscription status update for non-subscription payment (event=${eventType}, customer=${customerId})`);
    }

    // ─── 6b. Cobrança de um NOVO CICLO nasceu ─────────────────────────────────
    // `PAYMENT_CREATED` não muda o status da assinatura (ela segue `active` até vencer), então
    // não entra no bloco acima e antes daqui não acontecia NADA: o `next_due_date` ficava
    // congelado na data da contratação para sempre, e o assinante não era avisado de que havia
    // uma cobrança nova a pagar. Em produção isso deixou assinantes com o ciclo aberto sem saber.
    if (eventType === "PAYMENT_CREATED" && subscriptionId && subscriptionRecord && paymentData) {
      const dueDate = (paymentData.dueDate as string) || null;
      // Só é RENOVAÇÃO se a assinatura já teve um ciclo pago. Na primeira cobrança o usuário
      // acabou de sair do checkout e está olhando o QR — avisar ali seria ruído.
      const jaTeveCicloPago = !!subscriptionRecord.started_at;

      const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (dueDate) campos.next_due_date = dueDate;
      if (jaTeveCicloPago && asaasPaymentId) campos.pending_charge_id = asaasPaymentId;

      await supabaseAdmin
        .from("asaas_subscriptions")
        .update(campos)
        .eq("id", subscriptionRecord.id);

      if (jaTeveCicloPago && userId && asaasPaymentId) {
        await notificarRenovacao(supabaseAdmin, userId, asaasPaymentId, {
          value: (paymentData.value as number) || Number(subscriptionRecord.value) || 0,
          dueDate,
        });
      }
    }

    // ─── 7. Insert payment record when applicable ─────────────────────────────
    if (PAYMENT_EVENTS.has(eventType) && paymentData) {
      if (asaasPaymentId) {
        const { error: paymentError } = await supabaseAdmin
          .from("asaas_payments")
          .upsert(
            {
              user_id: userId,
              asaas_payment_id: asaasPaymentId,
              value: (paymentData.value as number) || 0,
              status: PAYMENT_STATUS_MAP[eventType] || "pending",
              payment_date: (paymentData.paymentDate as string) || null,
              billing_type: (paymentData.billingType as string) || "PIX",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "asaas_payment_id" }
          );

        if (paymentError) {
          console.error("Error inserting payment record:", paymentError);
          // Don't fail the whole webhook for a payment insert error
        }
      }
    }

    // (Removido) O desbloqueio de perfil agora é POR PERFIL, via cobrança única
    // (passo 4b), e não mais ao ativar a assinatura PRO.

    // ─── 8. Record event in asaas_webhook_events (idempotency) ────────────────
    const { error: eventInsertError } = await supabaseAdmin
      .from("asaas_webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: payload,
        processed_at: new Date().toISOString(),
      });

    if (eventInsertError) {
      console.error("Error recording webhook event:", eventInsertError);
      // Don't fail — the main processing is done
    }

    console.log(`Webhook processed: event=${eventType}, eventId=${eventId}, newStatus=${newStatus || 'no-subscription-change'}, userId=${userId}`);

    return new Response(
      JSON.stringify({ message: "ok" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error in webhook handler:", err);
    // Return 200 even for unexpected errors to prevent Asaas from retrying endlessly
    return new Response(
      JSON.stringify({ message: "ok" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
