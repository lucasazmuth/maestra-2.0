import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Mantém o Pix Automático coerente: cobranças, retentativas e revogações.
//
// POR QUE EXISTE: a primeira versão do Pix Automático partia de uma premissa errada — a de que
// `paymentCreationMode: SUBSCRIPTION` faria a Asaas gerar sozinha as cobranças dos ciclos
// seguintes. A documentação da Jornada 3 diz o contrário, com todas as letras:
//
//   "O primeiro pagamento não cria automaticamente as cobranças futuras."
//   "A instrução de pagamento deve ser criada entre 2 e 10 dias úteis antes do vencimento.
//    Fora dessa janela, a API retornará uma exceção."
//
// Sem este job, a autorização era ativada no primeiro pagamento e depois NUNCA mais debitava:
// assinante achando que estava tudo automático, e receita parando silenciosamente no mês 2.
//
// FAZ TRÊS COISAS, todas do mesmo tipo: manter o Pix Automático coerente, porque a Asaas não
// toca nos ciclos sozinha e a revogação pode falhar em silêncio.
//   1. cria a cobrança do ciclo quando ela entra na janela de 2 a 10 dias úteis;
//   2. comanda as retentativas extradia de um débito recusado (política 3R_7D) — `retryPolicy`
//      apenas as PERMITE; quem pede cada uma é a aplicação;
//   3. revoga autorizações órfãs: canceladas aqui, mas ainda vivas no banco do pagador.
//
// Roda diariamente por cron (mesmo padrão do `asaas-reconcile-pending`: `verify_jwt` ligado e o
// cron manda a chave do vault). É idempotente nas três pontas: não cria cobrança para quem já tem
// uma em aberto, não comanda retentativa enquanto houver uma agendada, e não revoga o que já
// está revogado.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// A janela da Asaas é de 2 a 10 dias úteis. Disparamos entre 3 e 9 para sobrar margem: não
// acompanhamos feriados nacionais, e um feriado no meio faz a contagem real ficar MENOR que a
// nossa. Com 3 de folga na ponta baixa, dois feriados ainda deixam a criação dentro da janela.
const JANELA_MIN = 3;
const JANELA_MAX = 9;

/** Dias úteis (seg a sex) entre hoje, exclusivo, e a data alvo, inclusive. */
function diasUteisAte(alvoIso: string): number {
  const alvo = new Date(`${alvoIso.split("T")[0]}T12:00:00Z`);
  const hoje = new Date();
  hoje.setUTCHours(12, 0, 0, 0);
  if (alvo <= hoje) return 0;
  let dias = 0;
  const cursor = new Date(hoje);
  while (cursor < alvo) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) dias += 1;
  }
  return dias;
}

// Quem AVANÇA o vencimento é o webhook, quando o ciclo é pago. Aqui a função serve só para achar
// o início do ciclo seguinte: a Asaas recusa uma retentativa marcada para uma data que alcance
// esse dia. Cópia idêntica à de `asaas-webhook` — o Deno não importa de fora da pasta da função
// e o deploy é achatado, então alterar uma exige alterar a outra.
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

/** Soma dias corridos a uma data YYYY-MM-DD. */
function somarDias(iso: string, dias: number): string {
  const dt = new Date(`${iso.split("T")[0]}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().split("T")[0];
}

// Política 3R_7D: no máximo 3 retentativas extradia, dentro de 7 dias corridos após o vencimento
// original, cada uma em data diferente.
const MAX_RETENTATIVAS = 3;
const JANELA_RETENTATIVA_DIAS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasApiUrl = Deno.env.get("ASAAS_API_URL") || "https://api-sandbox.asaas.com";
    if (!asaasApiKey) return json({ error: "Erro interno de configuração" }, 500);

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Assinantes com débito automático de pé. `pending_charge_id` nulo = o ciclo atual ainda não
    // foi cobrado; com ele preenchido já existe cobrança em aberto e não há o que fazer.
    const { data: assinaturas, error } = await admin
      .from("asaas_subscriptions")
      .select("id, user_id, asaas_customer_id, pix_automatic_authorization_id, value, cycle, next_due_date, status, pending_charge_id")
      .eq("authorization_status", "ACTIVE")
      .in("status", ["active", "overdue"])
      .not("pix_automatic_authorization_id", "is", null)
      .is("pending_charge_id", null)
      .limit(200);

    if (error) {
      console.error("[pix-automatico] falha ao listar assinaturas:", error);
      return json({ error: "Erro interno" }, 500);
    }

    let criadas = 0, foraDaJanela = 0, falhas = 0;
    const detalhes: unknown[] = [];

    for (const s of assinaturas || []) {
      if (!s.next_due_date || !s.asaas_customer_id) continue;

      const vencimento = String(s.next_due_date).split("T")[0];
      const dias = diasUteisAte(vencimento);
      if (dias < JANELA_MIN || dias > JANELA_MAX) { foraDaJanela += 1; continue; }

      const anual = s.cycle === "YEARLY";
      try {
        const r = await fetch(`${asaasApiUrl}/v3/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
          body: JSON.stringify({
            customer: s.asaas_customer_id,
            billingType: "PIX",
            value: Number(s.value),
            dueDate: vencimento,
            description: anual ? "Maestra PRO anual" : "Maestra PRO mensal",
            // SEM este campo a Asaas cria uma cobrança PIX comum, que exige o assinante pagar na
            // mão — exatamente o que o Pix Automático veio eliminar. É o campo mais importante
            // da requisição inteira.
            pixAutomaticAuthorizationId: s.pix_automatic_authorization_id,
          }),
        });
        const j = await r.json().catch(() => ({}));

        if (!r.ok || !j?.id) {
          falhas += 1;
          console.error(`[pix-automatico] cobrança falhou (user=${s.user_id}, http=${r.status}):`, JSON.stringify(j).slice(0, 400));
          detalhes.push({ user: s.user_id, http: r.status, erro: j?.errors ?? null });
          continue;
        }

        await admin
          .from("asaas_subscriptions")
          .update({ pending_charge_id: j.id, updated_at: new Date().toISOString() })
          .eq("id", s.id);

        criadas += 1;
        console.log(`[pix-automatico] cobrança ${j.id} criada (user=${s.user_id}, vence ${vencimento}, ${dias} dias úteis)`);
      } catch (e) {
        falhas += 1;
        console.error(`[pix-automatico] erro de rede (user=${s.user_id}):`, (e as { message?: string })?.message);
      }
    }

    // ── Retentativas extradia (política 3R_7D) ────────────────────────────────
    // `retryPolicy: ALLOW_THREE_IN_SEVEN_DAYS` na autorização só PERMITE a retentativa; quem
    // comanda cada uma é a aplicação. A intradia (mesmo dia, 18h-21h) é automática do PSP; esta,
    // não. Sem este bloco, uma falha de saldo derruba o ciclo mesmo com a política contratada —
    // e falta de saldo no dia é a causa mais comum de inadimplência involuntária.
    const hojeIso = new Date().toISOString().split("T")[0];
    const amanha = somarDias(hojeIso, 1);
    let retentativas = 0, retentativasFalhas = 0, semJanela = 0;

    const { data: recusadas } = await admin
      .from("asaas_subscriptions")
      .select("id, user_id, cycle, next_due_date, cycle_anchor_day, pix_instruction_id, pix_retry_count, pix_retry_scheduled_for")
      .eq("authorization_status", "ACTIVE")
      .eq("status", "overdue")
      .not("pix_instruction_id", "is", null)
      .lt("pix_retry_count", MAX_RETENTATIVAS)
      .limit(200);

    for (const s of recusadas || []) {
      // Já existe tentativa marcada para hoje ou para frente: ela ainda pode liquidar, e a API
      // exige que cada retentativa caia em uma data diferente.
      const agendada = s.pix_retry_scheduled_for ? String(s.pix_retry_scheduled_for).split("T")[0] : null;
      if (agendada && agendada >= hojeIso) continue;
      if (!s.next_due_date) continue;

      const vencimentoOriginal = String(s.next_due_date).split("T")[0];
      const limiteJanela = somarDias(vencimentoOriginal, JANELA_RETENTATIVA_DIAS);
      const inicioProximoCiclo = proximoVencimento(
        vencimentoOriginal,
        String(s.cycle || "MONTHLY"),
        s.cycle_anchor_day as number | null,
      );

      // A data precisa caber nos 7 dias corridos E não alcançar o ciclo seguinte. O comando vai
      // para AMANHÃ porque a Asaas exige envio até 23h59 do dia anterior à data desejada.
      if (amanha > limiteJanela || amanha >= inicioProximoCiclo) {
        semJanela += 1;
        // Acabou a janela: não há mais o que tentar neste ciclo. Limpa o alvo para o cron parar
        // de olhar para esta linha todo dia; o corte de acesso fica com o período de graça.
        await admin
          .from("asaas_subscriptions")
          .update({ pix_instruction_id: null, updated_at: new Date().toISOString() })
          .eq("id", s.id);
        console.log(`[pix-automatico] janela de retentativa encerrada (user=${s.user_id}, vencimento ${vencimentoOriginal})`);
        continue;
      }

      try {
        const r = await fetch(
          `${asaasApiUrl}/v3/pix/automatic/paymentInstructions/${s.pix_instruction_id}/retries`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "access_token": asaasApiKey },
            body: JSON.stringify({ dueDate: amanha }),
          },
        );
        const j = await r.json().catch(() => ({}));

        if (!r.ok) {
          retentativasFalhas += 1;
          // A API valida as mesmas regras que checamos acima; um 400 aqui significa que a nossa
          // contagem divergiu da dela. Registra o motivo e para de insistir nesta instrução, em
          // vez de repetir o erro todo dia.
          console.error(`[pix-automatico] retentativa recusada (user=${s.user_id}, http=${r.status}):`, JSON.stringify(j).slice(0, 400));
          if (r.status === 400) {
            await admin
              .from("asaas_subscriptions")
              .update({ pix_instruction_id: null, updated_at: new Date().toISOString() })
              .eq("id", s.id);
          }
          continue;
        }

        await admin
          .from("asaas_subscriptions")
          .update({
            pix_retry_scheduled_for: amanha,
            pix_retry_count: Number(s.pix_retry_count || 0) + 1,
            // A retentativa gera a sua própria instrução; se ela falhar, o webhook grava o id
            // novo aqui. Guardamos o que a resposta devolveu para não retentar uma instrução
            // que já foi substituída.
            pix_instruction_id: j?.id || s.pix_instruction_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", s.id);

        retentativas += 1;
        console.log(`[pix-automatico] retentativa ${Number(s.pix_retry_count || 0) + 1}/${MAX_RETENTATIVAS} agendada para ${amanha} (user=${s.user_id})`);
      } catch (e) {
        retentativasFalhas += 1;
        console.error(`[pix-automatico] erro de rede na retentativa (user=${s.user_id}):`, (e as { message?: string })?.message);
      }
    }

    // ── Autorizações órfãs: canceladas aqui, vivas no banco do pagador ────────
    // O cancelamento revoga a autorização na Asaas ANTES de encerrar a assinatura, mas se aquela
    // chamada falhar (rede, 5xx) o código segue mesmo assim — o usuário precisa conseguir
    // cancelar. O resultado é uma autorização de débito recorrente viva no app do banco de quem
    // já cancelou o serviço.
    //
    // Dinheiro não sai: o débito exige uma instrução, e o bloco acima só cria para assinatura
    // `active`/`overdue`. Mas ninguém deveria ter que confiar nisso olhando o próprio banco e
    // vendo uma autorização de pé. Aqui a revogação é tentada de novo até pegar.
    let revogadas = 0, revogacoesFalhas = 0;
    const { data: orfas } = await admin
      .from("asaas_subscriptions")
      .select("id, user_id, pix_automatic_authorization_id, authorization_status")
      .eq("status", "cancelled")
      .not("pix_automatic_authorization_id", "is", null)
      .neq("authorization_status", "CANCELLED")
      .limit(100);

    for (const s of orfas || []) {
      try {
        const r = await fetch(
          // DELETE, nao POST .../cancel: aquele path nao existe e devolvia 404 em silencio.
          `${asaasApiUrl}/v3/pix/automatic/authorizations/${s.pix_automatic_authorization_id}`,
          { method: "DELETE", headers: { "Content-Type": "application/json", "access_token": asaasApiKey } },
        );
        // 404 = a Asaas já não conhece a autorização; para o nosso objetivo é o mesmo que revogada.
        if (r.ok || r.status === 404) {
          await admin
            .from("asaas_subscriptions")
            .update({ authorization_status: "CANCELLED", updated_at: new Date().toISOString() })
            .eq("id", s.id);
          revogadas += 1;
          console.log(`[pix-automatico] autorização órfã revogada (user=${s.user_id})`);
        } else {
          revogacoesFalhas += 1;
          console.error(`[pix-automatico] revogação de órfã falhou (user=${s.user_id}, http=${r.status})`);
        }
      } catch (e) {
        revogacoesFalhas += 1;
        console.error(`[pix-automatico] erro de rede ao revogar órfã (user=${s.user_id}):`, (e as { message?: string })?.message);
      }
    }

    const resumo = {
      analisadas: (assinaturas || []).length, criadas, foraDaJanela, falhas,
      retentativas, retentativasFalhas, semJanela, revogadas, revogacoesFalhas, detalhes,
    };
    console.log("[pix-automatico] resumo:", JSON.stringify(resumo));
    return json(resumo);
  } catch (e) {
    console.error("[pix-automatico] erro inesperado:", (e as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
