// Funil de ativação (nudges de conversão). Roda por cron (1x/dia). NÃO toca em
// nenhum fluxo existente: apenas LÊ o estado (usuários x artistas) e INSERE
// notificações in-app + envia e-mails via Brevo pra quem travou em alguma etapa.
//
// Etapas:
//   A) cadastrou e NÃO criou artista            (por usuário; ref = conta)
//   B) criou artista e NÃO desbloqueou o plano  (por artista is_locked=true)
//   C) desbloqueou e NÃO concluiu o planejamento (por artista is_locked=false sem content.strategies)
//
// Anti-repetição/parada: cada nudge grava um marcador na própria tabela
// `notifications` (reference_type='nudge', reference_id=código). Como a classificação
// é baseada no estado ATUAL, ao avançar o usuário sai da etapa e não recebe mais.
// Por rodada, envia no máximo UM nudge por candidato (o passo mais avançado devido).
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER,
//          APP_URL (base absoluta pros links dos e-mails, ex.: https://www.maestramanager.com),
//          CRON_SECRET (opcional; se setado, exige header x-cron-secret).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendBrevoEmail, emailLayout, ctaButton } from "./brevo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://www.maestramanager.com").replace(/\/+$/, "");
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DAY = 86400000;
const MAX_AGE_DAYS = 30; // não incomodar contas/artistas antigos (ex.: no 1º deploy)
const daysSince = (iso?: string | null): number =>
  iso ? (Date.now() - new Date(iso).getTime()) / DAY : Number.POSITIVE_INFINITY;

// deno-lint-ignore no-explicit-any
type Admin = any;

interface NudgeSpec {
  code: string;
  minDays: number;
  type: string;
  title: (artist?: string) => string;
  message: (artist?: string) => string;
  link: (artistId?: string) => string;
  subject: (artist?: string) => string;
  emailBody: (artist?: string) => string;
  ctaLabel: string;
  ctaPath: (artistId?: string) => string;
}

// Etapa A (por usuário, sem artista). {artista} não se aplica.
const A: NudgeSpec[] = [
  {
    code: "A1", minDays: 2, type: "info",
    title: () => "Bora criar seu primeiro artista?",
    message: () => "Você já tá dentro! Falta criar o perfil do artista e rodar o Diagnóstico REAL. Leva poucos minutos.",
    link: () => "/criar-artista",
    subject: () => "Falta pouco pra começar",
    emailBody: () => "Você criou a conta, mas ainda não montou o perfil do seu artista. É rapidinho, e já sai com o Diagnóstico REAL da carreira.",
    ctaLabel: "Criar meu artista", ctaPath: () => "/criar-artista",
  },
  {
    code: "A2", minDays: 7, type: "info",
    title: () => "Seu artista ainda não tá na Maestra",
    message: () => "A Maestra fica muito melhor com o seu artista dentro. Crie o perfil e descubra, em minutos, onde a carreira está e as maiores oportunidades.",
    link: () => "/criar-artista",
    subject: () => "Seu artista ainda não tá na Maestra",
    emailBody: () => "A Maestra fica muito melhor com o seu artista dentro. Crie o perfil e descubra, em minutos, onde a carreira está e as maiores oportunidades.",
    ctaLabel: "Criar agora", ctaPath: () => "/criar-artista",
  },
];

// Etapa B (por artista is_locked=true).
const B: NudgeSpec[] = [
  {
    code: "B1", minDays: 2, type: "info",
    title: (a) => `O plano de ${a} está a um passo`,
    message: () => "Você já viu o Diagnóstico REAL. Agora vem a melhor parte: liberar o planejamento estratégico com a Nyta e virar diagnóstico em plano de ação.",
    link: (id) => `/artists/${id}/desbloquear`,
    subject: (a) => `O plano de ${a} está a um passo`,
    emailBody: (a) => `Você rodou o Diagnóstico REAL de ${a}. O próximo passo é o planejamento estratégico com a Nyta: metas, estratégias e cronograma. Acesso vitalício, num pagamento único.`,
    ctaLabel: "Liberar o planejamento", ctaPath: (id) => `/artists/${id}/desbloquear`,
  },
  {
    code: "B2", minDays: 6, type: "info",
    title: () => "Seu próximo passo na Maestra",
    message: (a) => `O diagnóstico de ${a} já está pronto. Acesse a Maestra para transformar esse diagnóstico em um plano de ação com a Nyta.`,
    link: (id) => `/artists/${id}/desbloquear`,
    subject: () => "Seu próximo passo na Maestra",
    emailBody: (a) => `O diagnóstico de ${a} já está pronto. Acesse a Maestra para transformar esse diagnóstico em um plano de ação com a Nyta.`,
    ctaLabel: "Desbloquear agora", ctaPath: (id) => `/artists/${id}/desbloquear`,
  },
];

// Etapa C (por artista is_locked=false sem content.strategies).
const C: NudgeSpec[] = [
  {
    code: "C1", minDays: 2, type: "info",
    title: (a) => `Seu planejamento de ${a} está pela metade`,
    message: () => "Você começou, mas ainda não finalizou o plano. Continua de onde parou. A Nyta te espera pra fechar.",
    link: (id) => `/artists/${id}/wizard`,
    subject: (a) => `Continue o planejamento de ${a}`,
    emailBody: (a) => `Você começou o planejamento de ${a}, mas ele ainda não está completo. Volte lá e conclua com a Nyta. É onde metas e cronograma ganham vida.`,
    ctaLabel: "Continuar de onde parei", ctaPath: (id) => `/artists/${id}/wizard`,
  },
  {
    code: "C2", minDays: 6, type: "info",
    title: (a) => `Falta pouco para o plano de ${a}`,
    message: () => "Seu plano de ação está quase pronto. Reserve alguns minutinhos e finalize com a Nyta. Depois é só executar.",
    link: (id) => `/artists/${id}/wizard`,
    subject: (a) => `Falta pouco para o plano de ${a}`,
    emailBody: () => "Seu plano de ação está quase pronto. Reserve alguns minutinhos e finalize com a Nyta. Depois é só executar.",
    ctaLabel: "Concluir o planejamento", ctaPath: (id) => `/artists/${id}/wizard`,
  },
];

// Já enviamos esse nudge (marcador na tabela notifications)?
async function alreadySent(admin: Admin, userId: string, code: string, artistId: string | null): Promise<boolean> {
  let q = admin.from("notifications").select("id")
    .eq("user_id", userId).eq("reference_type", "nudge").eq("reference_id", code).limit(1);
  q = artistId ? q.eq("artist_id", artistId) : q.is("artist_id", null);
  const { data } = await q;
  return !!(data && data.length);
}

const emailCache = new Map<string, { email: string; name: string } | null>();
async function getOwner(admin: Admin, userId: string): Promise<{ email: string; name: string } | null> {
  if (emailCache.has(userId)) return emailCache.get(userId)!;
  let out: { email: string; name: string } | null = null;
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    const u = data?.user;
    if (u?.email) out = { email: u.email, name: String(u.user_metadata?.full_name || "").split(" ")[0] || "" };
  } catch (_e) { /* ignore */ }
  emailCache.set(userId, out);
  return out;
}

// Envia o nudge mais avançado devido (um por candidato/rodada). Fail-safe.
async function fireDue(
  admin: Admin, specs: NudgeSpec[], age: number,
  userId: string, artistId: string | null, artistName?: string,
): Promise<boolean> {
  if (age > MAX_AGE_DAYS) return false;
  const due = specs.filter((s) => s.minDays <= age).sort((a, b) => b.minDays - a.minDays)[0];
  if (!due) return false;
  if (await alreadySent(admin, userId, due.code, artistId)) return false;

  const nowIso = new Date().toISOString();
  try {
    await admin.from("notifications").insert({
      user_id: userId, artist_id: artistId, type: due.type,
      title: due.title(artistName), message: due.message(artistName), link: due.link(artistId ?? undefined),
      read: false, source: "activation", reference_type: "nudge", reference_id: due.code,
      status: "active", created_at: nowIso,
    });
  } catch (e) {
    console.error("[activation] insert falhou:", (e as Error)?.message);
    return false;
  }

  const owner = await getOwner(admin, userId);
  if (owner) {
    const hi = owner.name ? `Olá, ${owner.name}! ` : "";
    const html = emailLayout({
      title: due.title(artistName),
      bodyHtml: `<p style="color:#405985;line-height:1.6;">${hi}${due.emailBody(artistName)}</p>${ctaButton(due.ctaLabel, APP_URL + due.ctaPath(artistId ?? undefined))}`,
    });
    await sendBrevoEmail({ to: owner.email, toName: owner.name || undefined, subject: due.subject(artistName), html });
  }
  return true;
}

// Catálogo das automações, para o painel de CRM ler daqui em vez de repetir as copies numa tela.
//
// A duplicação seria pior do que parece: no dia em que alguém ajustasse um prazo ou uma frase, o
// painel continuaria mostrando a versão antiga — e é justamente esse tipo de divergência que ele
// deveria denunciar. As funções de texto recebem um nome de artista de exemplo, já que fora de
// uma rodada real não existe artista nenhum.
function catalogo() {
  const EXEMPLO = "{artista}";
  const serializar = (etapa: string, specs: NudgeSpec[]) =>
    specs.map((s) => ({
      etapa,
      code: s.code,
      apos: s.minDays,
      canais: ["in-app", "e-mail"], // push não é disparado pelo funil hoje
      titulo: s.title(EXEMPLO),
      mensagem: s.message(EXEMPLO),
      assunto: s.subject(EXEMPLO),
      corpo: s.emailBody(EXEMPLO),
      botao: s.ctaLabel,
      destino: s.ctaPath(undefined),
    }));
  return [...serializar("A", A), ...serializar("B", B), ...serializar("C", C)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Leitura do catálogo: autenticada por admin, e não pelo segredo do cron — quem consulta é uma
  // pessoa no painel, não o agendador. Não dispara nada.
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  if (body?.action === "spec") {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Não autorizado" }, 401);
    const client = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user: caller } } = await client.auth.getUser(auth.replace("Bearer ", ""));
    if (!caller) return json({ error: "Não autorizado" }, 401);
    let ok = !!caller.app_metadata?.is_platform_admin;
    if (!ok) {
      const { data: row } = await client.from("platform_admins").select("id").eq("user_id", caller.id).maybeSingle();
      ok = !!row;
    }
    if (!ok) return json({ error: "Acesso restrito a administradores" }, 403);
    return json({ automacoes: catalogo() });
  }

  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const sent = { A: 0, B: 0, C: 0 };

  try {
    // 1) Artistas (donos) e seus estados.
    const { data: artists, error: artErr } = await admin
      .from("artists")
      .select("id, user_id, name, is_locked, created_at, updated_at, purchased_at, content");
    if (artErr) throw artErr;

    const ownerIds = new Set<string>();
    for (const a of artists || []) {
      ownerIds.add(a.user_id);
      const name = a.name || "seu artista";
      if (a.is_locked === true) {
        // Etapa B: não desbloqueou.
        if (await fireDue(admin, B, daysSince(a.created_at), a.user_id, a.id, name)) sent.B++;
      } else {
        // Desbloqueou: Etapa C só se o planejamento ainda não foi concluído.
        const strategies = (a.content && Array.isArray(a.content.strategies)) ? a.content.strategies : [];
        if (strategies.length === 0) {
          const age = daysSince(a.purchased_at || a.updated_at || a.created_at);
          if (await fireDue(admin, C, age, a.user_id, a.id, name)) sent.C++;
        }
      }
    }

    // 2) Usuários SEM artista (Etapa A). Pagina auth.users.
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) { console.error("[activation] listUsers:", error.message); break; }
      const users = data?.users || [];
      for (const u of users) {
        if (!u.id || ownerIds.has(u.id)) continue;
        if (!u.email_confirmed_at) continue; // só quem confirmou o cadastro
        if (await fireDue(admin, A, daysSince(u.created_at), u.id, null)) sent.A++;
      }
      if (users.length < 1000) break;
    }

    return json({ ok: true, sent });
  } catch (e) {
    console.error("[activation] erro:", (e as Error)?.message);
    return json({ error: "internal", detail: (e as Error)?.message }, 500);
  }
});
