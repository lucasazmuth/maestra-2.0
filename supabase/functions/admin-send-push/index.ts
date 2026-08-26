// Envia uma notificação manual pelo painel admin.
// Body: { userId?: string | "all", title: string, message: string, link?: string }
// A inserção em `notifications` dispara o Web Push pelo trigger existente.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Admin = any;

const clean = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

async function requirePlatformAdmin(admin: Admin, req: Request) {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;

  // Antes bastava EXISTIR em platform_admins. Com a tela de Acessos, entrar no time deixou de
  // significar acesso total, e a checagem antiga transformava qualquer membro em admin pleno por
  // aqui: o front escondia o menu e a funcao disparava push para a base inteira assim mesmo.
  //
  // `app_metadata.is_platform_admin` NAO serve de atalho: diz que existe acesso, nao qual.
  const { data: linha } = await admin
    .from("platform_admins").select("role").eq("user_id", user.id).maybeSingle();
  if (!linha) return null;
  if (linha.role === "admin" || linha.role === "super_admin") return user;

  const { data: mod } = await admin
    .from("admin_module_access").select("module")
    .eq("user_id", user.id).eq("module", "push").maybeSingle();
  return mod ? user : null;
}

async function listUserIds(admin: Admin): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];
    // Contas não confirmadas não conseguem usar a plataforma e não devem receber campanha.
    ids.push(...users.filter((u: { email_confirmed_at?: string | null }) => !!u.email_confirmed_at).map((u: { id: string }) => u.id));
    if (users.length < 1000) break;
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  if (!(await requirePlatformAdmin(admin, req))) return json({ error: "Acesso restrito a administradores" }, 403);

  let body: { userId?: string; title?: string; message?: string; link?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  const title = clean(body.title, 120);
  const message = clean(body.message, 500);
  const target = body.userId || "";
  const link = clean(body.link || "/notifications", 300) || "/notifications";
  if (!title) return json({ error: "O título é obrigatório" }, 400);
  if (!message) return json({ error: "A mensagem é obrigatória" }, 400);
  if (!target) return json({ error: "Selecione um destinatário" }, 400);
  if (!link.startsWith("/")) return json({ error: "O link deve ser uma rota interna começando com /" }, 400);

  try {
    const userIds = target === "all" ? await listUserIds(admin) : [target];
    if (!userIds.length) return json({ ok: true, sent: 0, message: "Nenhum usuário confirmado encontrado" });

    const referenceId = `manual-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type: "info",
      title,
      message,
      link,
      read: false,
      source: "manual",
      reference_type: "manual",
      reference_id: referenceId,
      status: "active",
      created_at: now,
    }));

    let inserted = 0;
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await admin.from("notifications").insert(rows.slice(offset, offset + 500));
      if (error) throw error;
      inserted += Math.min(500, rows.length - offset);
    }
    return json({ ok: true, sent: inserted, target: target === "all" ? "all" : "user" });
  } catch (error) {
    console.error("[admin-send-push] erro:", (error as Error)?.message);
    return json({ error: "Não foi possível enviar a notificação" }, 500);
  }
});
