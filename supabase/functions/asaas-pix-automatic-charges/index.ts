import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Cria as cobranças de cada ciclo do Pix Automático, dentro da janela que a Asaas exige.
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
// Roda diariamente por cron. É idempotente: só cria cobrança para quem não tem nenhuma em aberto.

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

// Quem AVANÇA o vencimento é o webhook, quando o ciclo é pago (`proximoVencimento` vive lá).
// Aqui só lemos `next_due_date` e criamos a cobrança quando ela entra na janela — se o ciclo não
// for pago, a data não avança, e é isso mesmo: as retentativas ainda podem quitá-lo.

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

    const resumo = { analisadas: (assinaturas || []).length, criadas, foraDaJanela, falhas, detalhes };
    console.log("[pix-automatico] resumo:", JSON.stringify(resumo));
    return json(resumo);
  } catch (e) {
    console.error("[pix-automatico] erro inesperado:", (e as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
