// Lista avaliações da plataforma para moderação e acompanhamento de produto.
// Acesso exclusivo a administradores (app_metadata ou platform_admins).
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any
type AnyRow = Record<string, any>;
// deno-lint-ignore no-explicit-any
type AdminClient = any;

const authUsers = async (admin: AdminClient) => {
  const users: AnyRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const chunk = data?.users || [];
    users.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return new Map(users.map((user) => [user.id, user]));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: AdminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller) return json({ error: "Não autorizado" }, 401);

  let isAdmin = !!caller.app_metadata?.is_platform_admin;
  if (!isAdmin) {
    const { data: row } = await admin
      .from("platform_admins")
      .select("id")
      .eq("user_id", caller.id)
      .maybeSingle();
    isAdmin = !!row;
  }
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  try {
    const [{ data: reviews, error }, usersById] = await Promise.all([
      admin
        .from("platform_reviews")
        .select("id, user_id, rating, comment, page_path, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      authUsers(admin),
    ]);
    if (error) throw error;

    const items = (reviews || []).map((review: AnyRow) => {
      const user = usersById.get(review.user_id);
      return {
        id: review.id,
        userId: review.user_id,
        name:
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0] ||
          "Usuário",
        email: user?.email || "",
        avatarUrl: user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null,
        rating: Number(review.rating),
        comment: review.comment,
        pagePath: review.page_path,
        createdAt: review.created_at,
        updatedAt: review.updated_at,
      };
    });

    const distribution = [1, 2, 3, 4, 5].reduce<Record<number, number>>(
      (acc, value) => ({ ...acc, [value]: items.filter((item: AnyRow) => item.rating === value).length }),
      {}
    );
    const last7d = items.filter(
      (item: AnyRow) => Date.now() - Date.parse(item.updatedAt) <= 7 * 864e5
    ).length;

    return json({
      generatedAt: new Date().toISOString(),
      stats: {
        total: items.length,
        average: items.length
          ? Number((items.reduce((sum: number, item: AnyRow) => sum + item.rating, 0) / items.length).toFixed(1))
          : 0,
        withComment: items.filter((item: AnyRow) => !!item.comment).length,
        last7d,
        distribution,
      },
      items,
    });
  } catch (error) {
    console.error("[admin-reviews] erro:", (error as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
