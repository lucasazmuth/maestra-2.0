// Painel admin: métricas agregadas da plataforma (usuários, perfis, assinaturas,
// pagamentos e faturamento). Exige que o CHAMADOR seja platform admin (flag no JWT
// OU linha em platform_admins) — mesma regra do admin-users.
//
// Body: {} (sem ações; devolve tudo de uma vez)
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// Receita considerada:
//   • artist_purchases com status 'received' (desbloqueio de perfil, pagamento único)
//   • asaas_payments com status 'confirmed' ou 'received' (cobranças da assinatura)
// Data do pagamento: paid_at / payment_date; fallback created_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Admin = any;

const PAID_PAYMENT = new Set(["confirmed", "received"]);

// 'YYYY-MM' em UTC — chave dos buckets mensais.
const monthKey = (iso: string) => iso.slice(0, 7);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerErr || !caller) return json({ error: "Não autorizado" }, 401);
  let isAdmin = !!caller.app_metadata?.is_platform_admin;
  if (!isAdmin) {
    const { data: row } = await admin.from("platform_admins").select("id").eq("user_id", caller.id).maybeSingle();
    isAdmin = !!row;
  }
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  try {
    // ── Usuários (auth) ──
    const users: Array<{ id: string; email: string; created_at: string; confirmed: boolean }> = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const chunk = data?.users || [];
      for (const u of chunk) {
        users.push({ id: u.id, email: u.email || "", created_at: u.created_at, confirmed: !!u.email_confirmed_at });
      }
      if (chunk.length < 1000) break;
    }
    const emailById = new Map(users.map((u) => [u.id, u.email]));

    const now = new Date();
    const thisMonth = now.toISOString().slice(0, 7);
    const monthStart = `${thisMonth}-01`;
    const d30 = new Date(now.getTime() - 30 * 864e5).toISOString();

    // ── Dados de negócio (tabelas pequenas; agrega em JS) ──
    const [artistsRes, subsRes, purchasesRes, paymentsRes] = await Promise.all([
      admin.from("artists").select("is_locked, created_at"),
      admin.from("asaas_subscriptions").select("status, value, cycle, asaas_subscription_id"),
      admin.from("artist_purchases").select("user_id, artist_name, amount, billing_type, status, coupon_code, paid_at, created_at"),
      admin.from("asaas_payments").select("user_id, value, billing_type, status, payment_date, created_at"),
    ]);
    const artists = artistsRes.data || [];
    const subs = subsRes.data || [];
    const purchases = purchasesRes.data || [];
    const payments = paymentsRes.data || [];

    // ── Assinaturas ──
    // 'pending' SEM asaas_subscription_id é fantasma de pagamento único → não conta.
    const subCounts: Record<string, number> = { active: 0, overdue: 0, pending: 0, cancelled: 0 };
    let mrr = 0;
    for (const s of subs) {
      const phantom = s.status === "pending" && !s.asaas_subscription_id;
      if (phantom) continue;
      subCounts[s.status] = (subCounts[s.status] || 0) + 1;
      if (s.status === "active" && s.value) {
        mrr += s.cycle === "YEARLY" ? Number(s.value) / 12 : Number(s.value);
      }
    }

    // ── Receita ──
    type Pay = { kind: "purchase" | "subscription"; label: string; email: string; amount: number; billing_type: string | null; status: string; date: string; coupon: string | null };
    const paid: Pay[] = [];
    let pendingCount = 0;

    for (const p of purchases) {
      const date = p.paid_at || p.created_at;
      if (p.status === "received") {
        paid.push({ kind: "purchase", label: p.artist_name || "Perfil de artista", email: emailById.get(p.user_id) || "", amount: Number(p.amount) || 0, billing_type: p.billing_type, status: p.status, date, coupon: p.coupon_code || null });
      } else if (p.status === "pending") pendingCount++;
    }
    for (const p of payments) {
      const date = p.payment_date || p.created_at;
      if (PAID_PAYMENT.has(p.status)) {
        paid.push({ kind: "subscription", label: "Assinatura PRO", email: emailById.get(p.user_id) || "", amount: Number(p.value) || 0, billing_type: p.billing_type, status: p.status, date, coupon: null });
      } else if (p.status === "pending") pendingCount++;
    }

    const sum = (list: Pay[]) => Math.round(list.reduce((s, p) => s + p.amount, 0) * 100) / 100;
    const inMonth = (p: Pay, m: string) => monthKey(p.date) === m;
    const lastMonthKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);

    // Série mensal (últimos 6 meses, incluindo o atual) pro gráfico de barras.
    const monthly: Array<{ month: string; total: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      monthly.push({ month: m, total: sum(paid.filter((p) => inMonth(p, m))) });
    }

    const purchasesPaid = paid.filter((p) => p.kind === "purchase");
    const subPaymentsPaid = paid.filter((p) => p.kind === "subscription");

    const recent = [...paid]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 12);

    return json({
      generatedAt: now.toISOString(),
      users: {
        total: users.length,
        confirmed: users.filter((u) => u.confirmed).length,
        newThisMonth: users.filter((u) => u.created_at >= monthStart).length,
        new30d: users.filter((u) => u.created_at >= d30).length,
      },
      artists: {
        total: artists.length,
        paid: artists.filter((a: { is_locked: boolean }) => a.is_locked === false).length,
        locked: artists.filter((a: { is_locked: boolean }) => a.is_locked !== false).length,
      },
      subscriptions: { ...subCounts, mrr: Math.round(mrr * 100) / 100 },
      revenue: {
        total: sum(paid),
        thisMonth: sum(paid.filter((p) => inMonth(p, thisMonth))),
        lastMonth: sum(paid.filter((p) => inMonth(p, lastMonthKey))),
        purchases: { count: purchasesPaid.length, total: sum(purchasesPaid), thisMonth: sum(purchasesPaid.filter((p) => inMonth(p, thisMonth))) },
        subscriptionPayments: { count: subPaymentsPaid.length, total: sum(subPaymentsPaid), thisMonth: sum(subPaymentsPaid.filter((p) => inMonth(p, thisMonth))) },
        pendingCount,
        monthly,
      },
      recentPayments: recent,
    });
  } catch (e) {
    console.error("[admin-dashboard] erro:", (e as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
