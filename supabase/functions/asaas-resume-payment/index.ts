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
      .select("status, asaas_subscription_id, billing_type, value, cycle, asaas_customer_id, pix_automatic_authorization_id, pix_migration_from_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    // Nada pra retomar.
    if (!sub || !sub.asaas_subscription_id || sub.status === "none" || sub.status === "cancelled") {
      return json({ status: "none" });
    }

    // Assinatura `active` TAMBÉM é consultada. Antes havia um `if (status === "active") return`
    // aqui, e ele escondia exatamente a renovação: na virada do ciclo a assinatura continua
    // `active` (a Asaas só marca `overdue` depois do vencimento), então a função respondia
    // "ativa", a tela de pagamento mostrava sucesso e o assinante NÃO CONSEGUIA pagar a
    // cobrança nova nem querendo. O QR só reaparecia depois de vencer.
    // Quem decide agora é a existência de cobrança em aberto, não o status local.

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

    // Cobrança PIX em aberto (PENDING primeiro, depois OVERDUE).
    // Calculado ANTES de qualquer conclusão sobre "já pagou": a lista traz até 20 cobranças, e
    // num assinante de meses o ciclo 1 pago está sempre nela. O teste antigo ("algum pagamento
    // pago → active") deixava o pagamento antigo mascarar a cobrança nova para sempre.
    // A que VENCE PRIMEIRO. Com mais de uma cobranca em aberto (a Asaas adianta a criacao do ciclo
    // seguinte), o QR a mostrar e o da mais proxima do vencimento — nunca o do ciclo futuro, que
    // faria o assinante pagar adiantado e deixar a atual vencer. Ordenar por dueDate crescente
    // tambem coloca uma OVERDUE na frente de uma PENDING, que e o certo: divida vencida vem antes.
    const open = payments
      .filter((p) => p.billingType === "PIX" && OPEN.includes(p.status))
      .sort((a, b) => String(a.dueDate || a.dateCreated || "").localeCompare(String(b.dueDate || b.dateCreated || "")));
    const target = open[0];

    // Assinatura de CARTÃO pendente: não existe QR pra retomar — a 1ª cobrança
    // está em análise na operadora. Devolve o billingType pro front mostrar a
    // tela de "pagamento em análise" (antes caía no erro "não foi possível
    // recuperar o PIX", mesmo o usuário tendo pago com cartão).
    if (sub.billing_type === "CREDIT_CARD") {
      return json({ status: sub.status, billingType: "CREDIT_CARD", pixData: null, value, cycle });
    }

    // Sem cobrança em aberto: aí sim vale concluir pelo histórico. Com algum ciclo pago, a
    // assinatura está em dia (e o status local é corrigido, para o caso de um webhook perdido).
    if (!target) {
      if (payments.some((p) => PAID.includes(p.status))) {
        await supabaseAdmin
          .from("asaas_subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("user_id", user.id);
        return json({ status: "active" });
      }
      // Nenhuma cobrança gerada ainda.
      return json({ status: sub.status, pixData: null, value, cycle });
    }

    // Há cobrança em aberto. Se a assinatura já teve algum ciclo pago, isto é uma RENOVAÇÃO —
    // o front precisa saber para não tratar como primeira compra nem como assinatura em risco.
    const pendingRenewal = payments.some((p) => PAID.includes(p.status));

    // ─── Migração já em curso: devolver a MESMA autorização ──────────────────
    // Sem isto, a segunda visita à tela (recarregou, voltou depois) mostraria de novo o QR da
    // cobrança antiga, que continua em aberto — a pessoa veria um QR diferente a cada visita e,
    // pior, poderia pagar o antigo achando que era o mesmo.
    if (sub.pix_migration_from_subscription_id && sub.pix_automatic_authorization_id) {
      const aResp = await asaasGet(
        `${asaasApiUrl}/v3/pix/automatic/authorizations/${sub.pix_automatic_authorization_id}`,
        asaasApiKey,
      );
      const a = aResp && aResp.ok ? await aResp.json().catch(() => null) : null;

      // Já autorizada: o débito recorrente está de pé. O webhook cuida de encerrar a assinatura
      // antiga; aqui só não pode mostrar QR nenhum.
      if (a?.status === "ACTIVE") return json({ status: "active" });

      if (a?.status === "CREATED" && a?.encodedImage) {
        return json({
          status: "pending",
          pendingRenewal: true,
          pixAutomatic: true,
          migrating: true,
          dueDate: target.dueDate || null,
          pixData: {
            qrCode: a.encodedImage || null,
            copyPaste: a.payload || null,
            expiresAt: a.immediateQrCode?.expirationDate || null,
          },
          value: Number(target.value) || value || 0,
          cycle,
        });
      }
      // Recusada, expirada ou ilegível: segue para o QR da cobrança antiga, que nunca foi
      // apagada justamente para servir de saída aqui. A limpeza dos campos fica com o webhook.
    }

    // ─── Migração para Pix Automático ────────────────────────────────────────
    // Aqui é a virada do ciclo de quem já paga: em vez do QR avulso deste mês, oferece a
    // AUTORIZAÇÃO. O assinante paga um QR igual ao de sempre e, no app do banco, autoriza os
    // débitos seguintes (Jornada 3) — a partir daí não precisa mais voltar aqui todo mês.
    //
    // NADA É APAGADO. A cobrança antiga e a assinatura antiga continuam de pé; quem for pago
    // primeiro vence e o webhook derruba o outro. É deliberado: apagar a cobrança boa antes de
    // saber se a autorização vinga deixaria sem forma de pagar quem tem banco sem suporte a Pix
    // Automático. O preço da escolha é uma janela curta com dois QRs pagáveis — mas o app mostra
    // só um, e o outro morre assim que o webhook processa o pagamento.
    const jaEhPixAutomatico = !!sub.pix_automatic_authorization_id;

    if (pendingRenewal && !jaEhPixAutomatico && sub.asaas_customer_id) {
      const { data: cfg } = await supabaseAdmin
        .from("asaas_plan_config")
        .select("pix_automatic_enabled, pix_migration_enabled")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (cfg?.pix_automatic_enabled && cfg?.pix_migration_enabled) {
        // O valor vem da COBRANÇA, não do plano: estes assinantes têm preços legados e cupom
        // vitalício (um deles paga 23,95 num plano que hoje custa 47,90). Ler o plano aqui
        // aumentaria a mensalidade de quem migrasse, sem avisar.
        const valorCobranca = Number(target.value) || value || 0;
        const hoje = new Date().toISOString().split("T")[0];
        // Preserva a âncora do ciclo: o QR imediato cobre o mês corrente, e a recorrência começa
        // no vencimento atual (se ainda não passou), mantendo o dia de cobrança da pessoa.
        const inicio = target.dueDate && String(target.dueDate) >= hoje ? String(target.dueDate) : hoje;
        const anual = cycle === "YEARLY";

        const criada = await (async () => {
          try {
            const r = await fetch(`${asaasApiUrl}/v3/pix/automatic/authorizations`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
              body: JSON.stringify({
                customerId: sub.asaas_customer_id,
                frequency: anual ? "ANNUALLY" : "MONTHLY",
                contractId: `maestra-${user.id.replace(/-/g, "").slice(0, 20)}`,
                startDate: inicio,
                value: valorCobranca,
                description: anual ? "Maestra PRO anual" : "Maestra PRO mensal",
                // Ver `asaas-create-pix-authorization`: os ciclos seguintes são criados pelo cron
                // `asaas-pix-automatic-charges`, não pela Asaas. Mandar "SUBSCRIPTION" aqui
                // arriscaria cobrança em duplicidade.
                retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
                immediateQrCode: {
                  originalValue: valorCobranca,
                  expirationSeconds: 86400,
                  description: anual ? "Maestra PRO anual" : "Maestra PRO mensal",
                },
              }),
            });
            if (!r.ok) {
              console.error(`Migração Pix Automático falhou (${r.status}):`, (await r.text().catch(() => "")).slice(0, 400));
              return null;
            }
            return await r.json();
          } catch (e) {
            console.error("Migração Pix Automático: erro de rede:", (e as { message?: string })?.message);
            return null;
          }
        })();

        // Só migra se veio QR. Sem ele o assinante ficaria olhando uma tela vazia no dia de
        // pagar — qualquer falha aqui cai de volta no QR avulso logo abaixo, que é o que ele
        // já esperava ver.
        if (criada?.id && criada?.encodedImage) {
          await supabaseAdmin
            .from("asaas_subscriptions")
            .update({
              pix_automatic_authorization_id: criada.id,
              authorization_status: criada.status || "CREATED",
              // Marca a migração em curso. Enquanto isto não for NULL existem DUAS formas de
              // pagar vivas, e o webhook sabe que precisa derrubar uma delas.
              pix_migration_from_subscription_id: sub.asaas_subscription_id,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id);

          console.log(`Migração Pix Automático oferecida (user=${user.id}, auth=${criada.id}, valor=${valorCobranca})`);

          return json({
            status: "pending",
            pendingRenewal: true,
            pixAutomatic: true,
            migrating: true,
            dueDate: target.dueDate || null,
            pixData: {
              qrCode: criada.encodedImage || null,
              copyPaste: criada.payload || null,
              expiresAt: criada.immediateQrCode?.expirationDate || null,
            },
            value: valorCobranca,
            cycle,
          });
        }
      }
    }

    // QR atual da cobrança em aberto.
    const qrResp = await asaasGet(`${asaasApiUrl}/v3/payments/${target.id}/pixQrCode`, asaasApiKey);
    if (!qrResp || !qrResp.ok) {
      return json({ status: "pending", pendingRenewal, pixData: null, value, cycle });
    }
    const qr = await qrResp.json().catch(() => ({}));

    return json({
      status: "pending",
      pendingRenewal,
      dueDate: target.dueDate || null,
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
