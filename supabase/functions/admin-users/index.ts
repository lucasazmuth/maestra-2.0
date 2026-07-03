// Painel admin: lista TODOS os usuários e devolve o detalhe de um (perfis, assinatura,
// pagamentos). Exige que o CHAMADOR seja platform admin (flag no JWT OU linha em
// platform_admins). Usa service role pra ler dados de todos (a RLS isola por usuário).
//
// Body: { action: "list" } | { action: "detail", userId }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

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

const nameOf = (u: { user_metadata?: Record<string, unknown> | null; email?: string | null }): string =>
  String(u.user_metadata?.full_name || u.user_metadata?.name || (u.email ? u.email.split("@")[0] : "") || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1) Identifica o chamador e confirma que é admin.
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerErr || !caller) return json({ error: "Não autorizado" }, 401);
  let isAdmin = !!caller.app_metadata?.is_platform_admin;
  if (!isAdmin) {
    const { data: row } = await admin.from("platform_admins").select("id").eq("user_id", caller.id).maybeSingle();
    isAdmin = !!row;
  }
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: { action?: string; userId?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  try {
    if (body.action === "detail") {
      return await detail(admin, body.userId || "");
    }
    return await list(admin);
  } catch (e) {
    console.error("[admin-users] erro:", (e as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});

// Lista todos os usuários com agregados (nº de perfis + status da assinatura).
async function list(admin: Admin) {
  // Todos os usuários (auth), paginado.
  const users: Array<{ id: string; email: string; name: string; created_at: string; confirmed: boolean }> = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const chunk = data?.users || [];
    for (const u of chunk) {
      users.push({
        id: u.id,
        email: u.email || "",
        name: nameOf(u),
        created_at: u.created_at,
        confirmed: !!u.email_confirmed_at,
      });
    }
    if (chunk.length < 1000) break;
  }

  // Agregados: perfis por usuário + assinatura por usuário.
  const [{ data: artists }, { data: subs }] = await Promise.all([
    admin.from("artists").select("user_id, is_locked"),
    admin.from("asaas_subscriptions").select("user_id, status"),
  ]);
  const artistCount = new Map<string, number>();
  const paidCount = new Map<string, number>();
  for (const a of artists || []) {
    artistCount.set(a.user_id, (artistCount.get(a.user_id) || 0) + 1);
    if (a.is_locked === false) paidCount.set(a.user_id, (paidCount.get(a.user_id) || 0) + 1);
  }
  const subStatus = new Map<string, string>();
  for (const s of subs || []) subStatus.set(s.user_id, s.status);

  const rows = users
    .map((u) => ({
      ...u,
      artistCount: artistCount.get(u.id) || 0,
      paidArtists: paidCount.get(u.id) || 0,
      subscription: subStatus.get(u.id) || "none",
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // mais recentes primeiro

  return json({ users: rows, total: rows.length });
}

// Detalhe de um usuário: conta, perfis, assinatura e histórico de pagamentos.
async function detail(admin: Admin, userId: string) {
  if (!userId) return json({ error: "userId é obrigatório" }, 400);

  const { data: authRes } = await admin.auth.admin.getUserById(userId);
  const u = authRes?.user;
  if (!u) return json({ error: "Usuário não encontrado" }, 404);

  const [artistsRes, subRes, purchasesRes] = await Promise.all([
    admin.from("artists").select("id, name, is_locked, created_at, purchased_at").eq("user_id", userId).order("created_at", { ascending: false }),
    admin.from("asaas_subscriptions").select("status, billing_type, cycle, value, started_at, next_due_date, coupon_code, discount_amount, asaas_customer_id, asaas_subscription_id").eq("user_id", userId).maybeSingle(),
    admin.from("artist_purchases").select("id, artist_name, amount, billing_type, status, paid_at, created_at, coupon_code, discount_amount").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  return json({
    account: {
      id: u.id,
      email: u.email || "",
      name: nameOf(u),
      created_at: u.created_at,
      confirmed: !!u.email_confirmed_at,
      last_sign_in_at: u.last_sign_in_at || null,
      phone: (u.user_metadata?.phone as string) || null,
    },
    artists: artistsRes.data || [],
    subscription: subRes.data || null,
    purchases: purchasesRes.data || [],
  });
}
