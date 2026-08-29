// Painel admin: lista TODOS os usuários e devolve o detalhe de um (perfis, assinatura,
// pagamentos). Exige que o CHAMADOR seja platform admin (flag no JWT OU linha em
// platform_admins). Usa service role pra ler dados de todos (a RLS isola por usuário).
//
// Body: { action: "list" } | { action: "detail", userId }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { apagarConta } from "./apagarConta.ts";

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

// Permissao do painel: papel + modulo.
//
// Antes isto checava apenas se a pessoa EXISTIA em platform_admins. Com a tela de Acessos, entrar
// no time deixou de significar acesso total — e a checagem antiga transformava qualquer membro em
// admin pleno por aqui, ignorando o modulo. Era o buraco: o front escondia o menu, e a funcao
// entregava os dados (e a exclusao de contas) assim mesmo.
//
// `app_metadata.is_platform_admin` NAO serve de atalho: diz que existe acesso, nao qual.
async function podeUsarModulo(
  db: Admin,
  userId: string,
  modulo: string | null,
): Promise<boolean> {
  const { data: linha } = await db
    .from("platform_admins").select("role").eq("user_id", userId).maybeSingle();
  if (!linha) return false;
  if (linha.role === "admin" || linha.role === "super_admin") return true;
  if (!modulo) return false;
  const { data: mod } = await db
    .from("admin_module_access").select("module")
    .eq("user_id", userId).eq("module", modulo).maybeSingle();
  return !!mod;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1) Identifica o chamador e confirma que ele alcanca o modulo de Usuarios.
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerErr || !caller) return json({ error: "Não autorizado" }, 401);
  const isAdmin = await podeUsarModulo(admin, caller.id, "usuarios");
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: { action?: string; userId?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  try {
    if (body.action === "delete") return await remove(admin, caller.id, body.userId || "");
    if (body.action === "detail") return await detail(admin, body.userId || "");
    if (body.action === "deletionQueue") return await deletionQueue(admin);
    if (body.action === "purge") return await purge(admin, caller.id, body.userId || "");
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

// Exclui uma conta DE VERDADE (auth + dados). O resto cai por CASCADE; antes
// limpamos as FKs que são NO ACTION pra auth.users (senão a exclusão trava).
// Trava: não exclui a própria conta do admin nem outro administrador.
async function remove(admin: Admin, callerId: string, userId: string) {
  if (!userId) return json({ error: "userId é obrigatório" }, 400);
  if (userId === callerId) return json({ error: "Você não pode excluir a própria conta." }, 400);

  const { data: adm } = await admin.from("platform_admins").select("id").eq("user_id", userId).maybeSingle();
  if (adm) return json({ error: "Não é possível excluir um administrador." }, 400);

  // A sequência em si vive em `apagarConta.ts` — cópia de `_shared`. Ela ganhou um segundo
  // chamador (a exclusão pedida pela própria pessoa) e duas cópias divergentes dela seriam a
  // pior duplicação possível: a divergência só apareceria na hora de apagar.
  //
  // ATENÇÃO: esta refatoração está no disco, mas a versão EM PRODUÇÃO ainda é a v9, com a
  // sequência embutida aqui. Não a subi porque o deploy por MCP exige colar o arquivo inteiro,
  // e transcrever 10 KB de uma função de admin à mão é risco desnecessário — o comportamento é
  // idêntico, então não há pressa. Sai no próximo deploy desta função.
  const { erro } = await apagarConta(admin, userId);
  if (erro) return json({ error: erro }, 500);
  return json({ ok: true });
}

// ── Fila de exclusão (LGPD art. 18, VI) ────────────────────────────────────────────
// Pedidos que a pessoa fez em Configurações e ainda não foram cumpridos, do mais vencido para o
// mais recente. `scheduled_purge_at` no passado = pronto para executar.
async function deletionQueue(admin: Admin) {
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id, email, requested_at, scheduled_purge_at, purged_at, subscription_status")
    .is("purged_at", null)
    .not("user_id", "is", null)
    .order("scheduled_purge_at", { ascending: true });
  if (error) throw error;

  const agora = Date.now();
  return json({
    requests: (data || []).map((r) => ({
      ...r,
      vencido: !!r.scheduled_purge_at && new Date(r.scheduled_purge_at).getTime() <= agora,
    })),
  });
}

// Executa a eliminação de um pedido da fila e DEIXA O REGISTRO DE PÉ.
//
// A ordem aqui é o ponto todo: marcar o cumprimento e soltar o user_id ANTES de chamar remove().
// Feito ao contrário, remove() apagaria a própria linha (ela aponta para o usuário), e a prova de
// que o pedido foi atendido sumiria junto com os dados que ele mandou apagar.
async function purge(admin: Admin, callerId: string, userId: string) {
  if (!userId) return json({ error: "userId é obrigatório" }, 400);

  const { data: pedido } = await admin
    .from("account_deletion_requests")
    .select("id, purged_at")
    .eq("user_id", userId)
    .is("purged_at", null)
    .maybeSingle();
  if (!pedido) return json({ error: "Não há pedido de exclusão pendente para esta conta." }, 404);

  const { error: marcaError } = await admin
    .from("account_deletion_requests")
    .update({
      purged_at: new Date().toISOString(),
      purged_by: callerId,
      status: "purged",
      user_id: null,
    })
    .eq("id", pedido.id);
  if (marcaError) throw marcaError;

  const resposta = await remove(admin, callerId, userId);
  // remove() já devolve o erro formatado. Se falhou, o registro fica marcado como cumprido sem
  // ter cumprido — melhor reabrir do que mentir na auditoria.
  if (resposta.status !== 200) {
    await admin
      .from("account_deletion_requests")
      .update({
        purged_at: null, purged_by: null, status: "requested", user_id: userId,
        purge_note: "Tentativa de execução falhou; pedido reaberto.",
      })
      .eq("id", pedido.id);
  }
  return resposta;
}
