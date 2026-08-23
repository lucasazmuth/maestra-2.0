import { createClient } from "jsr:@supabase/supabase-js@2";
import { sendBrevoEmail, emailLayout, ctaButton } from "./brevo.ts";

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

const APP_URL = (Deno.env.get("APP_URL") || "https://www.maestramanager.com").replace(/\/+$/, "");

// Status da Asaas de cobrança ainda em aberto.
const OPEN_STATUSES = new Set(["PENDING", "OVERDUE"]);

// Janela de DESCOBERTA de renovação. A cobrança do ciclo nasce em torno do vencimento, então só
// vale consultar a Asaas para quem está perto dele (ou já passou). Sem esse filtro, todo assinante
// saudável no meio do ciclo geraria uma chamada de API a cada 15 min — inofensivo com 3 assinantes,
// caro com mil.
const DISCOVERY_WINDOW_DAYS = 3;
const MAX_DISCOVERY_PER_RUN = 50;

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmtData = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return d && m ? `${d}/${m}/${y}` : "";
};

/**
 * Mesmo aviso de renovação do `asaas-webhook` (in-app + e-mail), duplicado aqui porque cada função
 * é deployada com a pasta achatada e não compartilha módulo. Idempotente pelo `asaas_payment_id`
 * em `reference_id`: se o webhook já avisou, esta chamada não faz nada.
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
    console.error("[billing] aviso de renovação (cron) falhou:", (e as Error)?.message);
  }
}

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

  // ─── DESCOBERTA de renovação em aberto ───────────────────────────────────────
  // O `pending_charge_id` é escrito pelo webhook em `PAYMENT_CREATED`. Se esse evento se perde (ou
  // a cobrança nasceu antes deste código existir), a assinatura fica com renovação aberta e o app
  // não sabe: sem banner, sem aviso. Foi o caso dos assinantes que já estavam em produção.
  //
  // Aqui a Asaas é a fonte de verdade — o status local de `asaas_payments` pode estar velho e não
  // distingue cobrança de assinatura da compra avulsa de perfil, então adivinhar por ele apontaria
  // o aviso para a cobrança errada.
  let descobertas = 0;
  // Sem milissegundos: o PostgREST separa `coluna.op.valor` por ponto, e um ISO com `.000Z` só
  // funciona por causa do limite de splits. Tirar os ms remove a dependência desse detalhe.
  const limiteDescoberta = new Date(Date.now() + DISCOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");

  const { data: candidatas, error: descError } = await supabaseAdmin
    .from("asaas_subscriptions")
    .select("id, user_id, value, next_due_date, asaas_subscription_id")
    .in("status", ["active", "overdue"])
    .eq("billing_type", "PIX")            // cartão não tem QR pra pagar
    .is("pending_charge_id", null)
    .not("asaas_subscription_id", "is", null)
    .not("started_at", "is", null)        // só quem já pagou um ciclo: senão é a 1ª compra
    .or(`next_due_date.is.null,next_due_date.lte.${limiteDescoberta}`)
    .limit(MAX_DISCOVERY_PER_RUN);

  if (descError) {
    console.error("Erro ao listar assinaturas para descoberta:", descError);
  } else {
    for (const s of candidatas || []) {
      try {
        const res = await fetch(
          `${ASAAS_API_URL}/v3/payments?subscription=${s.asaas_subscription_id}&limit=20`,
          { headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY } },
        );
        if (!res.ok) {
          console.warn(`Asaas lookup ${res.status} ao descobrir renovação de ${s.asaas_subscription_id}`);
          continue;
        }
        const body = await res.json();
        // deno-lint-ignore no-explicit-any
        const pagamentos: any[] = Array.isArray(body?.data) ? body.data : [];
        // Mesma escolha do `asaas-resume-payment`: PIX em aberto, PENDING antes de OVERDUE.
        const aberta = pagamentos
          .filter((p) => p.billingType === "PIX" && OPEN_STATUSES.has(String(p.status)))
          // A que VENCE PRIMEIRO. Com mais de uma cobranca em aberto (a Asaas adianta a criacao do
          // ciclo seguinte), a que o assinante deve pagar agora e a mais proxima do vencimento —
          // nunca a do ciclo futuro. Ordenar por dueDate crescente tambem coloca uma OVERDUE na
          // frente de uma PENDING, que e o certo: divida vencida vem antes.
          // O criterio antigo (PENDING antes de OVERDUE) nao desempatava entre duas em aberto.
          .sort((a, b) => String(a.dueDate || a.dateCreated || "").localeCompare(String(b.dueDate || b.dateCreated || "")))[0];
        if (!aberta?.id) continue;

        await supabaseAdmin
          .from("asaas_subscriptions")
          .update({ pending_charge_id: aberta.id, next_due_date: aberta.dueDate || s.next_due_date, updated_at: new Date().toISOString() })
          .eq("id", s.id);

        await notificarRenovacao(supabaseAdmin, s.user_id, aberta.id, {
          value: Number(aberta.value) || Number(s.value) || 0,
          dueDate: aberta.dueDate || null,
        });

        descobertas += 1;
        console.log(`Reconcile-cron: renovação em aberto descoberta (${aberta.id}, user=${s.user_id})`);
      } catch (err) {
        console.error("Erro na descoberta de renovação", s.id, (err as { message?: string })?.message);
      }
    }
  }

  // ─── Renovações de ASSINATURA já conhecidas ──────────────────────────────────
  // Antes este cron varria só `artist_purchases`, então a assinatura não tinha rede nenhuma: um
  // webhook perdido deixava a renovação paga marcada como em aberto (banner e aviso de cobrança
  // para quem já pagou) ou o `pending_charge_id` presilhado para sempre.
  //
  // Uma renovação descoberta logo acima cai aqui na mesma execução e é reconsultada — um GET a
  // mais, que responde "ainda em aberto" e não faz nada. Preferi isso a embutir uma exceção: o
  // custo é uma chamada por descoberta (evento raro) e as duas etapas seguem independentes.
  let renovacoesConfirmadas = 0;
  let renovacoesEmAberto = 0;

  const { data: renovacoes, error: renovError } = await supabaseAdmin
    .from("asaas_subscriptions")
    .select("id, user_id, pending_charge_id")
    .not("pending_charge_id", "is", null)
    .limit(MAX_PER_RUN);

  if (renovError) {
    console.error("Erro ao listar renovações em aberto:", renovError);
  } else {
    for (const s of renovacoes || []) {
      try {
        const res = await fetch(`${ASAAS_API_URL}/v3/payments/${s.pending_charge_id}`, {
          headers: { "Content-Type": "application/json", access_token: ASAAS_API_KEY },
        });
        if (!res.ok) {
          console.warn(`Asaas lookup ${res.status} para renovação ${s.pending_charge_id}`);
          continue;
        }
        const payment = await res.json();
        if (!PAID_STATUSES.has(String(payment?.status || ""))) {
          renovacoesEmAberto += 1;
          continue;
        }

        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("asaas_subscriptions")
          .update({ status: "active", pending_charge_id: null, grace_period_ends_at: null, updated_at: nowIso })
          .eq("id", s.id);

        // Baixa o aviso daquela cobrança (mesma chave usada pelo webhook).
        await supabaseAdmin
          .from("notifications")
          .update({ read: true })
          .eq("user_id", s.user_id)
          .eq("reference_type", "billing")
          .eq("reference_id", s.pending_charge_id);

        renovacoesConfirmadas += 1;
        console.log(`Reconcile-cron: renovação ${s.pending_charge_id} confirmada (${payment?.status})`);
      } catch (err) {
        console.error("Erro reconciliando renovação", s.id, (err as { message?: string })?.message);
      }
    }
  }

  const summary = {
    scanned: (pendings || []).length,
    confirmed,
    stillPending,
    failed,
    candidatasDescoberta: (candidatas || []).length,
    descobertas,
    renovacoesEscaneadas: (renovacoes || []).length,
    renovacoesConfirmadas,
    renovacoesEmAberto,
  };
  // Confirmar ou descobrir algo aqui significa que o webhook NÃO fez o trabalho dele — vale
  // destacar no log, é o sintoma precoce de fila pausada de novo.
  if (confirmed > 0 || renovacoesConfirmadas > 0 || descobertas > 0) {
    console.warn(
      `Reconcile-cron destravou ${confirmed} compra(s), confirmou ${renovacoesConfirmadas} e descobriu ${descobertas} renovação(ões) — conferir a fila de webhooks da Asaas`,
      summary,
    );
  } else console.log("Reconcile-cron:", summary);

  return json(summary);
});
