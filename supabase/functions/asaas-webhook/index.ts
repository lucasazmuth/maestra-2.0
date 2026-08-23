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

/**
 * Avança um ciclo preservando o dia do mês (cai no último dia quando o dia não existe no mês
 * destino: 31/01 + 1 mês = 28/02).
 *
 * No Pix Automático quem controla o calendário somos nós. Diferente da assinatura por cobrança,
 * onde a Asaas gera o ciclo seguinte e o webhook só copiava o `dueDate` que chegava pronto, aqui
 * a data do próximo vencimento precisa ser calculada aqui — é ela que diz ao cron quando abrir a
 * janela de criação da cobrança.
 *
 * Espelha `proximoVencimento` de `asaas-pix-automatic-charges`; manter as duas em sincronia (o
 * Deno não importa de fora da pasta da função e o deploy é achatado).
 */
function proximoVencimento(iso: string, cycle: string, ancora?: number | null): string {
  const [a, m, d] = iso.split("T")[0].split("-").map(Number);
  // A âncora é o dia ORIGINAL da cobrança. Sem ela a data derrete: 31/01 vira 28/02 e depois
  // fica presa no 28 para sempre, porque cada ciclo passa a ser calculado sobre o dia já aparado.
  const dia = ancora && ancora >= 1 && ancora <= 31 ? ancora : d;
  if (cycle === "YEARLY") {
    const dt = new Date(Date.UTC(a + 1, m - 1, 1));
    dt.setUTCDate(Math.min(dia, new Date(Date.UTC(a + 1, m, 0)).getUTCDate()));
    return dt.toISOString().split("T")[0];
  }
  const dt = new Date(Date.UTC(a, m, 1)); // m é 1-based, então este índice já é o mês seguinte
  dt.setUTCDate(Math.min(dia, new Date(Date.UTC(a, m + 1, 0)).getUTCDate()));
  return dt.toISOString().split("T")[0];
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

// ─── Pix Automático ───────────────────────────────────────────────────────────
// Ciclo de vida da AUTORIZAÇÃO (o consentimento do pagador), separado do ciclo de vida das
// cobranças. Só uma autorização ACTIVE debita: sem ela, os ciclos seguintes não acontecem.
// Fluxo feliz: CREATED → PAYMENT_CREATED → PAYMENT_RECEIVED → ACTIVATED.
const PIX_AUTH_EVENTS: Record<string, string> = {
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CREATED: "CREATED",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_ACTIVATED: "ACTIVE",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_REFUSED: "REFUSED",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_EXPIRED: "EXPIRED",
  PIX_AUTOMATIC_RECURRING_AUTHORIZATION_CANCELLED: "CANCELLED",
};

// Instruções de pagamento de cada ciclo. INSTRUCTION_REFUSED é o "não debitou" (saldo, limite,
// agendamento recusado) — é o equivalente ao PAYMENT_OVERDUE do fluxo por cobrança.
const PIX_INSTRUCTION_EVENTS = new Set([
  "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CREATED",
  "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_SCHEDULED",
  "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED",
  "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_CANCELLED",
]);

// Elegibilidade da CONTA para Pix Automático. Não pertence a nenhum assinante: se a conta fica
// INELIGIBLE, TODO débito recorrente para de acontecer de uma vez só.
const PIX_ELIGIBILITY_EVENT = "PIX_AUTOMATIC_RECURRING_ELIGIBILITY_UPDATED";

// All event types we handle (subscription status changes + payment-only events)
const HANDLED_EVENTS = new Set([
  ...Object.keys(EVENT_STATUS_MAP),
  ...CARD_FAILURE_EVENTS,
  ...Object.keys(PIX_AUTH_EVENTS),
  ...PIX_INSTRUCTION_EVENTS,
  PIX_ELIGIBILITY_EVENT,
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

    // Eventos de Pix Automático são identificados pela AUTORIZAÇÃO e podem não trazer
    // `subscription` nem `customer` — sem esta exceção eles morriam aqui, antes do handler 4a,
    // e a autorização nunca sairia de CREATED no nosso banco.
    const ehPixAutomatico =
      eventType in PIX_AUTH_EVENTS || PIX_INSTRUCTION_EVENTS.has(eventType) || eventType === PIX_ELIGIBILITY_EVENT;

    if (!subscriptionId && !customerId && !ehPixAutomatico) {
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

    // ─── 4a. Pix Automático: ciclo de vida da AUTORIZAÇÃO e das instruções ────
    // Tratado antes da busca por assinatura porque a chave aqui é o id da AUTORIZAÇÃO, não o da
    // assinatura nem o do cliente. Só uma autorização ACTIVE debita: se ela cai, os ciclos
    // seguintes simplesmente não acontecem, e sem tratar estes eventos o app não saberia.
    const ehEventoPixAuth = eventType in PIX_AUTH_EVENTS;

    if (ehPixAutomatico) {
      // O id da autorização chega como STRING no topo do payload:
      //   { event, id, dateCreated, pixAutomaticAuthorization: "aut_...", paymentId: "pay_..." }
      // A primeira versão deste bloco procurava só por objetos aninhados (`authorization.id` e
      // variações) e não olhava a forma documentada — nenhum evento de Pix Automático teria sido
      // reconhecido, e a autorização nunca sairia de CREATED no nosso banco.
      // As formas aninhadas continuam na lista porque a doc de eventos cita `authorization.id`,
      // divergindo da doc de fluxos; aceitar as duas custa nada e cobre a divergência.
      // deno-lint-ignore no-explicit-any
      const pl = payload as any;
      const comoTexto = (v: unknown) => (typeof v === "string" && v ? v : null);
      const authId: string | null =
        comoTexto(pl?.pixAutomaticAuthorization) ||
        comoTexto(pl?.authorization) ||
        pl?.authorization?.id ||
        pl?.pixAutomaticRecurringAuthorization?.id ||
        pl?.recurringAuthorization?.id ||
        pl?.payment?.pixAutomaticAuthorizationId ||
        pl?.pixAutomaticAuthorizationId ||
        null;
      // Instruções de pagamento são identificadas por `paymentInstruction.id`, não pela
      // autorização. Quando o evento não trouxer a autorização, o vínculo é feito pela cobrança.
      const idCobrancaEvento: string | null =
        comoTexto(pl?.paymentId) || comoTexto(pl?.payment?.id) || null;
      // Id da INSTRUÇÃO. É ele, e só ele, que o endpoint de retentativa aceita — nem o da
      // cobrança, nem o da autorização. Sem guardá-lo aqui não há como pedir nova tentativa.
      const idInstrucao: string | null =
        pl?.paymentInstruction?.id || comoTexto(pl?.paymentInstruction) || null;

      const registrarEvento = async () => {
        await supabaseAdmin.from("asaas_webhook_events").insert({
          event_id: eventId, event_type: eventType, payload, processed_at: new Date().toISOString(),
        });
      };

      // Elegibilidade da CONTA (não de um assinante). Não há linha para atualizar; o valor
      // importa no log porque uma conta INELIGIBLE para de debitar todo mundo de uma vez, e sem
      // este registro a queda apareceria só como cobranças que misteriosamente não acontecem.
      if (eventType === PIX_ELIGIBILITY_EVENT) {
        const situacao = pl?.eligibility?.status || pl?.status || "desconhecida";
        if (String(situacao).toUpperCase() === "INELIGIBLE") {
          console.error(`ALERTA: conta ficou INELIGIBLE para Pix Automatico — nenhum debito recorrente vai ocorrer (evento ${eventId})`);
        } else {
          console.log(`Elegibilidade de Pix Automático: ${situacao}`);
        }
        await registrarEvento();
        return new Response(JSON.stringify({ message: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (!authId && !idCobrancaEvento) {
        console.warn("Evento de Pix Automático sem autorização nem cobrança no payload", { eventId, eventType });
        await registrarEvento();
        return new Response(JSON.stringify({ message: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const campos_ = "id, user_id, status, started_at, asaas_subscription_id, pix_migration_from_subscription_id, cycle, next_due_date, cycle_anchor_day";
      let assinatura = null as Record<string, unknown> | null;
      if (authId) {
        const { data } = await supabaseAdmin
          .from("asaas_subscriptions").select(campos_)
          .eq("pix_automatic_authorization_id", authId).maybeSingle();
        assinatura = data;
      }
      // Sem autorização no payload (caso das instruções), casa pela cobrança do ciclo.
      if (!assinatura && idCobrancaEvento) {
        const { data } = await supabaseAdmin
          .from("asaas_subscriptions").select(campos_)
          .eq("pending_charge_id", idCobrancaEvento).maybeSingle();
        assinatura = data;
      }

      if (!assinatura) {
        console.warn("Autorização de Pix Automático sem assinatura local", { eventId, eventType, authId });
        await registrarEvento();
        return new Response(JSON.stringify({ message: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const campos: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (ehEventoPixAuth) {
        const novoStatusAuth = PIX_AUTH_EVENTS[eventType];
        campos.authorization_status = novoStatusAuth;

        const migrandoDe = assinatura.pix_migration_from_subscription_id as string | null;

        if (novoStatusAuth === "ACTIVE") {
          // Autorização ativada = a primeira cobrança foi paga (Jornada 3). A assinatura passa a
          // valer, e daqui em diante os ciclos debitam sozinhos.
          campos.status = "active";
          campos.grace_period_ends_at = null;
          campos.pending_charge_id = null;
          campos.started_at = (assinatura.started_at as string | null) || new Date().toISOString();

          // Marca o PRÓXIMO ciclo. Sem isto o `next_due_date` ficaria parado na data de hoje, o
          // cron nunca veria uma data futura dentro da janela, e a assinatura debitaria uma vez
          // só na vida — que é exatamente a falha que este conserto veio fechar.
          const hojeIso = new Date().toISOString().split("T")[0];
          const baseCiclo = String((assinatura.next_due_date as string | null) || hojeIso).split("T")[0];
          // SÓ avança se ninguém avançou antes. O primeiro pagamento (bloco 4c) chega ~2 minutos
          // ANTES deste evento e já move o vencimento; avançar de novo aqui empurraria a próxima
          // cobrança um mês inteiro para a frente, e o assinante ganharia um mês de graça.
          // A data já avançada é futura; a que ainda não avançou é hoje ou passada.
          if (baseCiclo <= hojeIso) {
            // Fixa a âncora: é o dia que o assinante escolheu ao contratar, e é ele que todos os
            // ciclos seguintes vão perseguir.
            const ancora = Number(baseCiclo.split("-")[2]);
            campos.cycle_anchor_day = ancora;
            campos.next_due_date = proximoVencimento(baseCiclo, String(assinatura.cycle || "MONTHLY"), ancora);
          } else if (!assinatura.cycle_anchor_day) {
            // Já avançada pelo pagamento, mas sem âncora gravada: deriva do vencimento em vigor.
            campos.cycle_anchor_day = Number(baseCiclo.split("-")[2]);
          }

          // MIGRAÇÃO CONCLUÍDA. A assinatura antiga por cobrança precisa morrer AGORA: ela
          // continuou viva de propósito como rede de segurança, mas a partir daqui cobraria em
          // duplicidade com o débito automático. O DELETE também derruba a cobrança em aberto
          // dela, que é o outro QR que ficou pagável durante a janela.
          if (migrandoDe && asaasApiKey) {
            try {
              const r = await fetch(`${asaasBaseUrl}/v3/subscriptions/${migrandoDe}`, {
                method: "DELETE",
                headers: { "access_token": asaasApiKey, "Content-Type": "application/json" },
              });
              if (!r.ok && r.status !== 404) {
                // Grave: sobrou assinatura viva junto com débito automático. Não dá pra reverter
                // daqui (o pagamento novo já entrou), então fica gritando no log para alguém
                // cancelar na mão antes do próximo ciclo.
                console.error(`ALERTA: assinatura antiga ${migrandoDe} NAO foi cancelada (${r.status}) — risco de cobranca duplicada para user=${assinatura.user_id}`);
              }
            } catch (e) {
              console.error(`ALERTA: falha de rede ao cancelar assinatura antiga ${migrandoDe} — risco de cobranca duplicada para user=${assinatura.user_id}:`, (e as { message?: string })?.message);
            }
          }
          campos.pix_migration_from_subscription_id = null;
          campos.asaas_subscription_id = null;
          campos.billing_type = "PIX_AUTOMATIC";
        } else if (novoStatusAuth === "REFUSED" || novoStatusAuth === "EXPIRED" || novoStatusAuth === "CANCELLED") {
          if (migrandoDe) {
            // MIGRAÇÃO FRACASSOU, e isto NÃO é um cancelamento. Quem estava migrando já era
            // assinante pagante: a autorização não vingou (banco sem suporte, QR não pago), mas a
            // assinatura antiga nunca foi tocada e continua valendo. Marcar `cancelled` aqui
            // tiraria o PRO de um cliente adimplente.
            campos.pix_automatic_authorization_id = null;
            campos.authorization_status = null;
            campos.pix_migration_from_subscription_id = null;
            console.log(`Migração Pix Automático revertida (user=${assinatura.user_id}, motivo=${novoStatusAuth}) — assinatura por cobrança segue valendo`);
          } else {
            // Sem autorização não há débito futuro. REFUSED/EXPIRED normalmente acontecem antes de
            // qualquer pagamento (QR não pago); CANCELLED pode vir depois, se o pagador revogar no
            // banco — em todos os casos a recorrência acabou.
            campos.status = "cancelled";
          }
        }
      }

      if (eventType === "PIX_AUTOMATIC_RECURRING_PAYMENT_INSTRUCTION_REFUSED") {
        // Débito recusado (saldo, limite ou agendamento). Guarda a instrução que falhou: é ela o
        // alvo da retentativa extradia, comandada pelo cron. Sempre sobrescreve, porque uma
        // retentativa recusada gera a sua própria instrução e é a MAIS RECENTE que deve ser
        // retentada.
        if (idInstrucao) campos.pix_instruction_id = idInstrucao;
        // A tentativa agendada morreu aqui; libera o cron a comandar a próxima.
        campos.pix_retry_scheduled_for = null;

        if (assinatura.status === "active") {
          // Equivalente ao PAYMENT_OVERDUE do fluxo por cobrança: mesma regra de 7 dias de graça
          // antes de cortar o acesso — que é justamente a janela em que as retentativas correm.
          campos.status = "overdue";
          campos.grace_period_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        }
      }

      await supabaseAdmin.from("asaas_subscriptions").update(campos).eq("id", assinatura.id);
      await registrarEvento();

      console.log(`Webhook Pix Automático: ${eventType} (auth=${authId}, user=${assinatura.user_id})`);
      return new Response(JSON.stringify({ message: "ok" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── 4c. Pagamento de um CICLO do Pix Automático ──────────────────────────
    // Estas cobranças são criadas pelo cron com `pixAutomaticAuthorizationId` e NÃO pertencem a
    // uma assinatura Asaas — `payment.subscription` vem vazio. Sem este bloco elas caíam no vão:
    // o passo 4b não acha `artist_purchase`, o passo 5 até encontra a assinatura pelo cliente,
    // mas o passo 6 exige `subscriptionId` e é pulado. Resultado: o assinante debitava e a
    // assinatura não renovava.
    // O vínculo é o `pending_charge_id`, gravado pelo cron ao criar a cobrança.
    const idPagamentoEvento = (paymentData?.id as string) || null;
    if (PAYMENT_EVENTS.has(eventType) && idPagamentoEvento && !paymentData?.subscription) {
      let { data: assinaturaCiclo } = await supabaseAdmin
        .from("asaas_subscriptions")
        .select("id, user_id, cycle, next_due_date, started_at, cycle_anchor_day")
        .eq("pending_charge_id", idPagamentoEvento)
        .maybeSingle();

      // PRIMEIRO pagamento de uma autorização de Pix Automático. Ele não tem `pending_charge_id`
      // (o QR imediato nasce junto da autorização, não do cron), então não casa acima e antes
      // daqui não casava em lugar nenhum: a assinatura só virava `active` quando o
      // AUTHORIZATION_ACTIVATED chegasse.
      //
      // A diferença é grande na prática. Medido em produção: o PAYMENT_RECEIVED chega em 5
      // SEGUNDOS, o ACTIVATED levou 2 MINUTOS (o banco mostra "Pix Automático em análise" nesse
      // intervalo). A pessoa pagava e ficava olhando o QR girar, sem ver a tela de sucesso.
      // O ciclo está pago; é o quanto basta para liberar o acesso. O ACTIVATED, quando vier,
      // confirma a autorização e fixa a âncora do calendário.
      const ehPagamentoOk = eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED";
      if (!assinaturaCiclo && ehPagamentoOk && customerId) {
        // A cobrança única do perfil compartilha o mesmo cliente Asaas. Sem esta checagem, o
        // pagamento de um PERFIL ativaria a assinatura Pro de graça.
        const { data: compra } = await supabaseAdmin
          .from("artist_purchases").select("id").eq("asaas_payment_id", idPagamentoEvento).maybeSingle();
        if (!compra) {
          const { data: porCliente } = await supabaseAdmin
            .from("asaas_subscriptions")
            .select("id, user_id, cycle, next_due_date, started_at, cycle_anchor_day")
            .eq("asaas_customer_id", customerId)
            .eq("billing_type", "PIX_AUTOMATIC")
            .eq("status", "pending")
            .maybeSingle();
          if (porCliente) {
            assinaturaCiclo = porCliente;
            console.log(`Primeiro pagamento de Pix Automático reconhecido em ${eventType} (user=${porCliente.user_id})`);
          }
        }
      }

      if (assinaturaCiclo) {
        const agora = new Date().toISOString();
        const mudanca: Record<string, unknown> = { updated_at: agora };

        if (eventType === "PAYMENT_CONFIRMED" || eventType === "PAYMENT_RECEIVED") {
          mudanca.status = "active";
          mudanca.grace_period_ends_at = null;
          mudanca.pending_charge_id = null;
          mudanca.started_at = (assinaturaCiclo.started_at as string | null) || agora;
          // Ciclo quitado: zera a contagem de retentativas. Sem isto o teto de 3 seria por
          // ASSINATURA em vez de por ciclo, e o assinante perderia o direito a retentativa para
          // sempre depois de três meses ruins ao longo da vida.
          mudanca.pix_instruction_id = null;
          mudanca.pix_retry_count = 0;
          mudanca.pix_retry_scheduled_for = null;
          // Ciclo pago: a próxima data passa a ser a do ciclo seguinte, e é ela que reabre a
          // janela do cron daqui a um mês.
          const base = String((assinaturaCiclo.next_due_date as string | null) || agora).split("T")[0];
          const ancoraCiclo = (assinaturaCiclo.cycle_anchor_day as number | null) || Number(base.split("-")[2]);
          // Grava a âncora já no primeiro pagamento. Sem isto, quem ativasse por aqui ficaria sem
          // âncora e a data derreteria ao passar por um mês curto.
          mudanca.cycle_anchor_day = ancoraCiclo;
          mudanca.next_due_date = proximoVencimento(base, String(assinaturaCiclo.cycle || "MONTHLY"), ancoraCiclo);
        } else if (eventType === "PAYMENT_OVERDUE") {
          // Débito não caiu até o vencimento. Mesma regra de graça do fluxo por cobrança. A
          // cobrança segue em aberto (pending_charge_id continua), porque as retentativas da
          // política 3R_7D ainda podem pagá-la.
          mudanca.status = "overdue";
          mudanca.grace_period_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (eventType === "PAYMENT_DELETED") {
          // Cobrança removida: libera o ciclo para o cron tentar de novo na próxima janela.
          mudanca.pending_charge_id = null;
        }

        await supabaseAdmin.from("asaas_subscriptions").update(mudanca).eq("id", assinaturaCiclo.id);
        await supabaseAdmin.from("asaas_payments").upsert(
          {
            user_id: assinaturaCiclo.user_id,
            asaas_payment_id: idPagamentoEvento,
            value: (paymentData?.value as number) || 0,
            status: PAYMENT_STATUS_MAP[eventType] || "pending",
            payment_date: (paymentData?.paymentDate as string) || null,
            billing_type: "PIX",
            updated_at: agora,
          },
          { onConflict: "asaas_payment_id" },
        );
        await supabaseAdmin.from("asaas_webhook_events").insert({
          event_id: eventId, event_type: eventType, payload, processed_at: agora,
        });

        console.log(`Webhook ciclo Pix Automático: ${eventType} (user=${assinaturaCiclo.user_id}, cobranca=${idPagamentoEvento})`);
        return new Response(
          JSON.stringify({ message: "ok" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
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

        // Avança a data PROVISORIAMENTE. Neste fluxo quem manda no calendário é a Asaas, e ela
        // só informa o vencimento seguinte quando cria a cobrança do próximo ciclo — o que
        // acontece dias antes dele. Até lá o campo guardava a data do ciclo RECÉM-PAGO, e
        // Configurações anunciava "Próxima cobrança" para uma data de hoje ou já passada, logo
        // depois de a pessoa pagar. O `PAYMENT_CREATED` corrige com a data oficial quando vier.
        const vencAtual = subscriptionRecord.next_due_date as string | null;
        if (vencAtual) {
          const base = String(vencAtual).split("T")[0];
          const hojeData = new Date().toISOString().split("T")[0];
          // Só mexe se a data guardada já venceu. Pagamento adiantado mantém a data real.
          if (base <= hojeData) {
            updateFields.next_due_date = proximoVencimento(
              base,
              String(subscriptionRecord.cycle || "MONTHLY"),
              subscriptionRecord.cycle_anchor_day as number | null,
            );
          }
        }
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

        // O assinante pagou a cobrança ANTIGA em vez do QR da migração (chegou pelo e-mail de
        // cobrança da Asaas, por exemplo). O ciclo está pago e a assinatura por cobrança segue
        // valendo — mas a autorização criada para ele ficou pendurada e ATIVARIA um débito
        // recorrente paralelo se fosse paga depois. Revoga.
        const autorizacaoOrfa = subscriptionRecord.pix_automatic_authorization_id as string | null;
        if (subscriptionRecord.pix_migration_from_subscription_id && autorizacaoOrfa) {
          if (asaasApiKey) {
            try {
              // DELETE, nao POST .../cancel: aquele path nao existe e devolvia 404 em silencio.
              await fetch(`${asaasBaseUrl}/v3/pix/automatic/authorizations/${autorizacaoOrfa}`, {
                method: "DELETE",
                headers: { "access_token": asaasApiKey, "Content-Type": "application/json" },
              });
            } catch (e) {
              console.error("Falha ao revogar autorização órfã:", (e as { message?: string })?.message);
            }
          }
          // Limpa localmente mesmo se a revogação falhar: a autorização órfã expira sozinha em
          // 24h sem pagamento, e deixar os campos preenchidos faria a tela insistir nela.
          updateFields.pix_automatic_authorization_id = null;
          updateFields.authorization_status = null;
          updateFields.pix_migration_from_subscription_id = null;
          console.log(`Migração adiada: assinante pagou a cobrança antiga (user=${userId}); autorização ${autorizacaoOrfa} revogada`);
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
