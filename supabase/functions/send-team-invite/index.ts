// Envia o e-mail de convite de equipe (colaborador) via Brevo. Chamado pelo app após inserir a
// linha em artist_members (status 'pending'). O convidado recebe um e-mail com link pro login —
// ao entrar com aquele e-mail, o app já lista/aceita o convite (fluxo existente em members.ts).
//
// Auth: exige o usuário logado E que ele seja o DONO do artista (artists.user_id).
// Secrets: BREVO_API_KEY, BREVO_SENDER, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendBrevoEmail, emailLayout } from "./brevo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  // 1) Identifica o usuário logado.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: "Não autorizado" }, 401);

  let body: { memberId?: string; appUrl?: string };
  try { body = await req.json(); } catch { return json({ error: "JSON inválido" }, 400); }
  const memberId = body.memberId;
  if (!memberId) return json({ error: "memberId é obrigatório" }, 400);
  const appUrl = (body.appUrl || "").replace(/\/+$/, "");

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // 2) Busca o convite + o artista, e confirma que o requisitante é o DONO.
  const { data: member } = await admin
    .from("artist_members")
    .select("id, email, name, artist_id, status")
    .eq("id", memberId).maybeSingle();
  if (!member) return json({ error: "Convite não encontrado" }, 404);

  const { data: artist } = await admin
    .from("artists").select("id, name, user_id").eq("id", member.artist_id).maybeSingle();
  if (!artist) return json({ error: "Artista não encontrado" }, 404);
  if (artist.user_id !== user.id) return json({ error: "Sem permissão" }, 403);

  // 3) Monta e envia o e-mail.
  const inviterName = (user.user_metadata?.full_name as string) || "Alguém";
  const loginLink = appUrl ? `${appUrl}/login` : "";
  const html = emailLayout({
    title: `Você foi convidado para gerenciar ${artist.name}`,
    bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${inviterName} convidou você para colaborar com o perfil <strong style="color:#fff;">${artist.name}</strong> na Maestra Manager.</p>
    <p style="color:#cfcfd4;line-height:1.6;">Entre (ou crie sua conta) com este mesmo e-mail e o convite vai aparecer pra você aceitar.</p>
    ${loginLink ? `<p style="margin:20px 0;"><a href="${loginLink}" style="display:inline-block;background:#af2896;color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:9999px;">Acessar a Maestra</a></p>` : ""}`,
  });

  const res = await sendBrevoEmail({ to: member.email, toName: member.name || undefined, subject: `Convite para gerenciar ${artist.name} — Maestra Manager`, html });
  if (!res.ok) return json({ error: `Falha ao enviar e-mail: ${res.error}` }, 502);
  return json({ ok: true });
});
