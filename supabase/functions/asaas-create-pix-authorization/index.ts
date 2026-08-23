import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Pix Automático: autorização de débito recorrente.
//
// POR QUE EXISTE, e como difere do `asaas-create-subscription`:
// a assinatura PIX da Asaas é recorrência de COBRANÇA — a cada ciclo nasce um QR novo que o
// assinante precisa pagar na mão. O Pix Automático é recorrência de DÉBITO: o pagador autoriza
// uma vez e os ciclos seguintes são debitados sozinhos.
//
// Jornada 3 (a que a API da Asaas implementa): o consentimento é colhido no pagamento da PRIMEIRA
// cobrança. Na prática o checkout quase não muda — a resposta da autorização já traz
// `encodedImage` + `payload` + `expirationDate`, exatamente os campos que a tela de pagamento
// consome hoje. O assinante paga um QR; esse mesmo pagamento ativa a autorização.
//
// ATENÇÃO: a Asaas NÃO gera as cobranças dos ciclos seguintes. A doc da Jornada 3 é explícita —
// "O primeiro pagamento não cria automaticamente as cobranças futuras" — e cada uma precisa ser
// criada com `pixAutomaticAuthorizationId` entre 2 e 10 dias úteis antes do vencimento. Quem faz
// isso é o cron `asaas-pix-automatic-charges`. Sem ele, a assinatura debita UMA vez e para.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MIN_CHARGE = 5;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Cupom: helper duplicado do `asaas-create-subscription` porque o Deno não importa de fora da
// pasta da função e o deploy é achatado. Manter as cópias em sincronia ao alterar.
async function validateCoupon(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  opts: { code: string; value: number },
): Promise<
  // deno-lint-ignore no-explicit-any
  | { ok: true; coupon: any; discountAmount: number; finalValue: number }
  | { ok: false; error: string }
> {
  const code = (opts.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Informe um cupom." };
  const { data: coupon, error } = await supabaseAdmin
    .from("discount_coupons").select("*").eq("code", code).eq("is_active", true).maybeSingle();
  if (error) return { ok: false, error: "Não foi possível validar o cupom." };
  if (!coupon) return { ok: false, error: "Cupom inválido." };
  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) return { ok: false, error: "Este cupom ainda não está válido." };
  if (coupon.ends_at && now > new Date(coupon.ends_at).getTime()) return { ok: false, error: "Cupom expirado." };
  if (coupon.applies_to !== "both" && coupon.applies_to !== "subscription") {
    return { ok: false, error: "Este cupom não vale para assinatura." };
  }
  if (coupon.max_uses != null && Number(coupon.uses_count) >= Number(coupon.max_uses)) {
    return { ok: false, error: "Este cupom já atingiu o limite de usos." };
  }
  const discountAmount = round2(opts.value * (Number(coupon.discount_percent) / 100));
  const finalValue = round2(opts.value - discountAmount);
  if (finalValue < MIN_CHARGE) return { ok: false, error: "Com este cupom o valor fica abaixo do mínimo de R$ 5,00." };
  return { ok: true, coupon, discountAmount, finalValue };
}

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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const { customerId, cycle, couponCode, probe } = body;

    // ─── Sondagem ────────────────────────────────────────────────────────────
    // O Pix Automático precisa estar habilitado na conta Asaas, e não há como saber isso pelo
    // painel do Supabase. Este modo faz um GET de LISTAGEM (leitura pura, não cria cobrança nem
    // autorização) só para revelar se a conta tem o produto liberado. Serve de diagnóstico antes
    // de plugar o fluxo no checkout.
    if (probe === true) {
      // RESTRITO A ADMIN. A sondagem devolve chaves Pix, status cadastral e SALDO da conta.
      // Ela nasceu no meio de um incidente atrás apenas do JWT, o que expunha tudo isso a
      // qualquer usuário logado — inclusive assinantes. Diagnóstico não justifica isso.
      const { data: adm } = await supabaseAdmin
        .from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!adm) return json({ error: "Não autorizado" }, 403);

      const h = { "Content-Type": "application/json", access_token: asaasApiKey };
      const ler = async (caminho: string) => {
        try {
          const r = await fetch(`${asaasApiUrl}${caminho}`, { headers: h });
          return { status: r.status, corpo: (await r.text().catch(() => "")).slice(0, 700) };
        } catch (e) {
          return { status: 0, corpo: `erro de rede: ${(e as { message?: string })?.message}` };
        }
      };

      const auth = await ler("/v3/pix/automatic/authorizations?limit=1");
      // Chaves Pix da conta. Diagnostico do "QR Code invalido" no banco: sem chave ATIVA, a Asaas
      // emite o QR mas nenhum PSP honra. Leitura pura.
      const chaves = await ler("/v3/pix/addressKeys?limit=10");
      // QR da cobranca, sem a imagem base64 — ela ocupa a resposta inteira e esconde o que
      // importa aqui: o payload copia-e-cola e a validade. Leitura pura.
      let qr: unknown = null;
      if (body?.paymentId) {
        try {
          const r = await fetch(`${asaasApiUrl}/v3/payments/${body.paymentId}/pixQrCode`, { headers: h });
          const j = await r.json().catch(() => ({}));
          qr = {
            status: r.status,
            success: j.success ?? null,
            payload: j.payload ?? null,
            expirationDate: j.expirationDate ?? null,
            tamanhoImagem: String(j.encodedImage || "").length,
          };
        } catch (e) {
          qr = { erro: (e as { message?: string })?.message };
        }
      }
      const cobranca = body?.paymentId ? await ler(`/v3/payments/${body.paymentId}`) : null;
      // Estado da CONTA. Uma conta com pendencia de documentacao ou verificacao continua emitindo
      // QR normalmente, mas o recebimento fica barrado no PSP — do lado do pagador isso aparece
      // como "QR invalido"/"falhou", sem nenhuma pista de que o problema e do recebedor.
      const conta = await ler("/v3/myAccount/status");
      const chaveDetalhe = body?.pixKeyId ? await ler(`/v3/pix/addressKeys/${body.pixKeyId}`) : null;
      // Creditos Pix recentes. Um pagamento feito na CHAVE (QR estatico) entra na conta sem se
      // vincular a cobranca nenhuma: aparece aqui, mas a assinatura segue pendente. Precisa ser
      // reconciliado na mao, e so da pra saber olhando.
      const creditos = body?.creditos ? await ler("/v3/pix/transactions?type=CREDIT&limit=5") : null;
      const saldo = body?.creditos ? await ler("/v3/finance/balance") : null;
      const cliente = body?.customerRef ? await ler(`/v3/customers/${body.customerRef}`) : null;

      // ── Experimento controlado: QR estatico COM valor ─────────────────────
      // Unica escrita deste modo, e ela NAO move dinheiro: cria um QR que so vira pagamento se
      // alguem escanear E confirmar. Serve para separar "cobv quebrada" de "conta quebrada" — a
      // chave pura ja provou que resolve no banco; falta saber se resolve carregando um valor.
      // Já protegido pela trava de admin no topo do bloco `probe`, que é a única porta até aqui.
      let qrEstatico: unknown = null;
      if (body?.criarQrEstatico) {
        try {
          const r = await fetch(`${asaasApiUrl}/v3/pix/qrCodes/static`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({
              addressKey: body.addressKey,
              description: "Teste Maestra",
              value: Number(body.valor) || 5,
              format: "ALL",
              allowsMultiplePayments: false,
              expirationSeconds: 3600,
            }),
          });
          const j = await r.json().catch(() => ({}));
          qrEstatico = {
            status: r.status,
            id: j.id ?? null,
            payload: j.payload ?? null,
            expirationDate: j.expirationDate ?? null,
            erro: j.errors ?? null,
          };
        } catch (e) {
          qrEstatico = { erro: (e as { message?: string })?.message };
        }
      }

      return json({
        probe: true,
        ambiente: asaasApiUrl,
        pixAutomatico: { httpStatus: auth.status, habilitado: auth.status === 200 },
        chavesPix: chaves,
        conta,
        chaveDetalhe,
        creditos,
        saldo,
        cliente,
        qrEstatico,
        cobranca,
        qr,
      });
    }

    if (!customerId || typeof customerId !== "string") {
      return json({ error: "customerId é obrigatório", field: "customerId" }, 400);
    }

    // Trava anti-duplicidade, mesma regra da assinatura: nunca cria uma segunda autorização.
    const { data: existente } = await supabaseAdmin
      .from("asaas_subscriptions")
      .select("status, asaas_subscription_id, pix_automatic_authorization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existente?.status === "active") return json({ alreadyActive: true });
    if (
      (existente?.status === "pending" || existente?.status === "overdue") &&
      (existente?.pix_automatic_authorization_id || existente?.asaas_subscription_id)
    ) {
      return json({ resume: true });
    }

    const { data: planConfig, error: planError } = await supabaseAdmin
      .from("asaas_plan_config").select("*").eq("is_active", true).limit(1).single();
    if (planError || !planConfig) return json({ error: "Plano ativo não encontrado" }, 404);

    // Trava de ativação. O Pix Automático cria débito recorrente autorizado em conta de terceiro:
    // enquanto o fluxo não estiver validado em produção, ele fica desligado e o checkout segue
    // pelo caminho por cobrança. Editável sem deploy (`asaas_plan_config`), como o plano anual.
    if (!planConfig.pix_automatic_enabled) {
      return json({ error: "Pix Automático não está habilitado", code: "pix_automatico_desligado" }, 503);
    }

    const isAnnual = cycle === "YEARLY";
    if (isAnnual && !(planConfig.annual_enabled && Number(planConfig.annual_value) > 0)) {
      return json({ error: "Plano anual indisponível no momento" }, 400);
    }
    const fullValue = isAnnual ? Number(planConfig.annual_value) : Number(planConfig.monthly_value);

    let planValue = fullValue;
    let appliedCouponCode: string | null = null;
    let discountAmount = 0;
    if (couponCode) {
      const cp = await validateCoupon(supabaseAdmin, { code: couponCode, value: fullValue });
      if (!cp.ok) return json({ error: cp.error, field: "coupon" }, 400);
      planValue = cp.finalValue;
      discountAmount = cp.discountAmount;
      appliedCouponCode = cp.coupon.code;
    }

    const hoje = new Date().toISOString().split("T")[0];

    // `contractId` e `description` têm teto de 35 caracteres na Asaas. O id do usuário inteiro
    // (36) já estoura sozinho, então entra só o prefixo — o suficiente para rastrear, e o vínculo
    // real fica no nosso banco pelo id da autorização.
    const contractId = `maestra-${user.id.replace(/-/g, "").slice(0, 20)}`;

    const payload: Record<string, unknown> = {
      customerId,
      frequency: isAnnual ? "ANNUALLY" : "MONTHLY",
      contractId,
      startDate: hoje,
      value: planValue,
      description: isAnnual ? "Maestra PRO anual" : "Maestra PRO mensal",
      // A Asaas gera sozinha as cobranças dos ciclos seguintes. Sem isto (modo MANUAL, o default)
      // a aplicação teria de criar cada instrução de pagamento dentro dos prazos da autorização.
      // NÃO enviar `paymentCreationMode`. A primeira versão mandava "SUBSCRIPTION" acreditando
      // que a Asaas geraria sozinha os ciclos seguintes; a doc da Jornada 3 diz o contrário, e
      // quem cria cada cobrança é o cron `asaas-pix-automatic-charges`. Se o campo existisse e
      // funcionasse, os dois criariam a mesma cobrança e o assinante pagaria duas vezes.
      // O default é NOT_ALLOWED: uma falha por saldo insuficiente derrubaria o ciclo sem nenhuma
      // nova tentativa. Com retry, a Asaas tenta de novo dentro da janela do Banco Central.
      retryPolicy: "ALLOW_THREE_IN_SEVEN_DAYS",
      // Primeira cobrança: é o QR que o assinante paga, e é o pagamento dela que ATIVA a
      // autorização (Jornada 3). 24h de validade, como o QR da assinatura hoje.
      immediateQrCode: {
        originalValue: planValue,
        expirationSeconds: 86400,
        description: isAnnual ? "Maestra PRO anual" : "Maestra PRO mensal",
      },
    };

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30000);
    let resp: Response;
    try {
      resp = await fetch(`${asaasApiUrl}/v3/pix/automatic/authorizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: asaasApiKey },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (_e) {
      clearTimeout(t);
      return json({ error: "Serviço de pagamento indisponível" }, 502);
    }
    clearTimeout(t);

    if (!resp.ok) {
      const erro = await resp.text().catch(() => "");
      console.error(`Asaas pix/automatic erro (${resp.status}):`, erro.slice(0, 500));
      // 403/404 aqui costuma ser conta sem o produto liberado — mensagem específica, para não
      // parecer falha genérica e mandar o assinante tentar de novo à toa.
      if (resp.status === 403 || resp.status === 404) {
        return json({ error: "Pix Automático indisponível nesta conta", code: "pix_automatico_indisponivel" }, 503);
      }
      return json({ error: "Não foi possível criar a autorização de pagamento" }, 502);
    }

    const auth = await resp.json();
    const nowIso = new Date().toISOString();

    await supabaseAdmin.from("asaas_subscriptions").upsert(
      {
        user_id: user.id,
        asaas_customer_id: customerId,
        pix_automatic_authorization_id: auth.id,
        authorization_status: auth.status || "CREATED",
        // Discriminador: separa do fluxo de assinatura por cobrança, que continua existindo como
        // fallback (nem todo banco do pagador suporta Pix Automático).
        billing_type: "PIX_AUTOMATIC",
        status: "pending",
        value: planValue,
        cycle: isAnnual ? "YEARLY" : "MONTHLY",
        coupon_code: appliedCouponCode,
        discount_amount: discountAmount || null,
        next_due_date: hoje,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

    return json({
      authorizationId: auth.id,
      authorizationStatus: auth.status,
      status: "pending",
      // Mesmos nomes que a tela de pagamento já consome — o checkout não precisa de forma nova.
      pixData: {
        qrCode: auth.encodedImage || null,
        copyPaste: auth.payload || null,
        expiresAt: auth.immediateQrCode?.expirationDate || null,
      },
      value: planValue,
      cycle: isAnnual ? "YEARLY" : "MONTHLY",
    });
  } catch (error: unknown) {
    console.error("Erro inesperado em asaas-create-pix-authorization:", (error as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
