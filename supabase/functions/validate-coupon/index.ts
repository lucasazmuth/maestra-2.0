import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Mínimo por cobrança/parcela na Asaas (cartão de crédito).
const MIN_CHARGE = 5;
const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Helper compartilhado (DUPLICADO em asaas-create-subscription e
//     asaas-create-artist-charge — Deno não importa fora do dir da função). ───
// Valida um cupom contra um valor e formato ('one_time' | 'subscription') e
// devolve o desconto. NUNCA confie no valor vindo do cliente nas functions de
// cobrança: lá o `value` é o resolvido pela config (fonte da verdade).
export async function validateCoupon(
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
  opts: { code: string; format: "one_time" | "subscription"; value: number; installments?: number },
): Promise<
  | { ok: true; coupon: any; discountPercent: number; discountAmount: number; finalValue: number }
  | { ok: false; error: string }
> {
  const code = (opts.code || "").trim().toUpperCase();
  if (!code) return { ok: false, error: "Informe um cupom." };

  const { data: coupon, error } = await supabaseAdmin
    .from("discount_coupons")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return { ok: false, error: "Não foi possível validar o cupom." };
  if (!coupon) return { ok: false, error: "Cupom inválido." };

  const now = Date.now();
  if (coupon.starts_at && now < new Date(coupon.starts_at).getTime()) {
    return { ok: false, error: "Este cupom ainda não está válido." };
  }
  if (coupon.ends_at && now > new Date(coupon.ends_at).getTime()) {
    return { ok: false, error: "Cupom expirado." };
  }
  if (coupon.applies_to !== "both" && coupon.applies_to !== opts.format) {
    const alvo = opts.format === "subscription" ? "assinatura" : "pagamento único";
    return { ok: false, error: `Este cupom não vale para ${alvo}.` };
  }
  if (coupon.max_uses != null && Number(coupon.uses_count) >= Number(coupon.max_uses)) {
    return { ok: false, error: "Este cupom já atingiu o limite de usos." };
  }

  const percent = Number(coupon.discount_percent);
  const discountAmount = round2(opts.value * (percent / 100));
  const finalValue = round2(opts.value - discountAmount);

  // Mínimo da Asaas: à vista → total ≥ R$5; parcelado → cada parcela ≥ R$5.
  const perCharge = opts.installments && opts.installments > 1 ? finalValue / opts.installments : finalValue;
  if (perCharge < MIN_CHARGE) {
    return { ok: false, error: "Com este cupom o valor fica abaixo do mínimo de R$ 5,00." };
  }

  return { ok: true, coupon, discountPercent: percent, discountAmount, finalValue };
}

// ─── Endpoint de PRÉVIA (checkout) ────────────────────────────────────────────
// Só exibe o desconto pro usuário. A aplicação real acontece nas functions de
// cobrança, que re-validam por conta própria.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const { code, format, value, installments } = body as {
      code?: string;
      format?: "one_time" | "subscription";
      value?: number;
      installments?: number;
    };

    if (format !== "one_time" && format !== "subscription") {
      return json({ valid: false, error: "Formato inválido." }, 400);
    }
    if (typeof value !== "number" || !(value > 0)) {
      return json({ valid: false, error: "Valor inválido." }, 400);
    }

    const res = await validateCoupon(supabaseAdmin, { code: code || "", format, value, installments });
    if (!res.ok) return json({ valid: false, error: res.error });

    return json({
      valid: true,
      code: res.coupon.code,
      discountPercent: res.discountPercent,
      discountAmount: res.discountAmount,
      finalValue: res.finalValue,
    });
  } catch (e: any) {
    console.error("validate-coupon error:", e?.message);
    return json({ valid: false, error: "Erro ao validar o cupom." }, 500);
  }
});
