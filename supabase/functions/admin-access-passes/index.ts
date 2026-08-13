// Painel admin: gera e lista os Pass Access (códigos de uso único que liberam o perfil
// sem cobrança). Exige que o CHAMADOR seja platform admin (flag no JWT OU linha em
// platform_admins) — quem gera código gera produto de graça.
//
// Body: { action: "list" } | { action: "generate", quantity, note?, expiresInDays? }
//     | { action: "revoke", id }
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

// Sem 0/O/1/I/L: o código é lido e digitado por gente, e esses pares se confundem.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 12; // 31^12 ≈ 7.8e17 — inviável de adivinhar por tentativa.
const MAX_BATCH = 100;
const DEFAULT_EXPIRY_DAYS = 90;

// crypto.getRandomValues (CSPRNG), não Math.random: o código é a única barreira entre
// alguém e um perfil liberado de graça, então precisa ser imprevisível.
function generateCode(): string {
  const bytes = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Exibição em grupos de 4 (XXXX-XXXX-XXXX); no banco fica sem hífen, e o resgate
// normaliza a entrada do usuário do mesmo jeito.
const pretty = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

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

  let body: { action?: string; quantity?: number; note?: string; expiresInDays?: number | null; id?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }

  try {
    if (body.action === "generate") return await generate(admin, caller.id, body);
    if (body.action === "revoke") return await revoke(admin, body.id || "");
    return await list(admin);
  } catch (e) {
    console.error("[admin-access-passes] erro:", (e as Error)?.message);
    return json({ error: "Erro interno" }, 500);
  }
});

async function generate(
  admin: Admin,
  callerId: string,
  body: { quantity?: number; note?: string; expiresInDays?: number | null },
) {
  const quantity = Math.min(MAX_BATCH, Math.max(1, Math.floor(Number(body.quantity) || 1)));
  const days = body.expiresInDays === null ? null : Math.max(1, Math.floor(Number(body.expiresInDays) || DEFAULT_EXPIRY_DAYS));
  const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const note = (body.note || "").trim() || null;

  const rows = Array.from({ length: quantity }, () => ({
    code: generateCode(),
    note,
    created_by: callerId,
    expires_at: expiresAt,
  }));

  // A coluna code é UNIQUE: uma colisão (improvável) faria o lote inteiro falhar em vez de
  // gravar código repetido. Nesse caso vale só repetir a geração.
  const { data, error } = await admin.from("access_passes").insert(rows).select("id, code, expires_at, note, created_at");
  if (error) {
    console.error("[admin-access-passes] falha ao gerar:", error);
    return json({ error: "Não foi possível gerar os códigos." }, 500);
  }

  console.log(`[admin-access-passes] ${quantity} código(s) gerados por ${callerId}`);
  // deno-lint-ignore no-explicit-any
  return json({ passes: (data || []).map((p: any) => ({ ...p, code: pretty(p.code) })) });
}

async function list(admin: Admin) {
  const { data, error } = await admin
    .from("access_passes")
    .select("id, code, note, created_at, expires_at, is_active, redeemed_at, redeemed_by, redeemed_artist_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return json({ error: "Erro ao listar" }, 500);

  // Resolve nome do artista e e-mail de quem resgatou, pra lista fazer sentido sozinha.
  const artistIds = [...new Set((data || []).map((p: { redeemed_artist_id: string | null }) => p.redeemed_artist_id).filter(Boolean))];
  const userIds = [...new Set((data || []).map((p: { redeemed_by: string | null }) => p.redeemed_by).filter(Boolean))];

  const artistNames: Record<string, string> = {};
  if (artistIds.length) {
    const { data: artists } = await admin.from("artists").select("id, name").in("id", artistIds);
    for (const a of artists || []) artistNames[a.id] = a.name;
  }

  const userEmails: Record<string, string> = {};
  for (const uid of userIds) {
    const { data: res } = await admin.auth.admin.getUserById(uid);
    if (res?.user?.email) userEmails[uid as string] = res.user.email;
  }

  // deno-lint-ignore no-explicit-any
  const passes = (data || []).map((p: any) => ({
    ...p,
    code: pretty(p.code),
    redeemedArtistName: p.redeemed_artist_id ? artistNames[p.redeemed_artist_id] || null : null,
    redeemedByEmail: p.redeemed_by ? userEmails[p.redeemed_by] || null : null,
  }));

  return json({
    passes,
    summary: {
      total: passes.length,
      // deno-lint-ignore no-explicit-any
      redeemed: passes.filter((p: any) => p.redeemed_at).length,
      // deno-lint-ignore no-explicit-any
      available: passes.filter((p: any) => !p.redeemed_at && p.is_active).length,
    },
  });
}

// Revoga um código ainda não resgatado (ex.: lista distribuída por engano).
// Mantém a linha para auditoria em vez de apagar.
async function revoke(admin: Admin, id: string) {
  if (!id) return json({ error: "id é obrigatório" }, 400);
  const { data, error } = await admin
    .from("access_passes")
    .update({ is_active: false })
    .eq("id", id)
    .is("redeemed_at", null)
    .select("id")
    .maybeSingle();

  if (error) return json({ error: "Erro ao revogar" }, 500);
  if (!data) return json({ error: "Código não encontrado ou já resgatado." }, 404);
  return json({ ok: true });
}
