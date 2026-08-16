// Resumo semanal da carreira (relatório por e-mail). Roda por cron (1x/semana, seg 13h UTC).
// NÃO toca em nenhum fluxo existente: apenas LÊ o estado do artista e envia um e-mail (Brevo) +
// insere uma notificação in-app pra cada destinatário. Nossa versão do "insights da semana" da
// concorrência, com o diferencial da Maestra: fase REAL + progresso do plano, além das métricas.
//
// Conteúdo por artista (3 blocos):
//   1) Etapa/Fase REAL   — content.realIndex.profile.name + boletim R/E/A/L (0–100).
//   2) Progresso do plano — content.strategies[]: tarefas concluídas/total + estratégia-foco.
//   3) Métricas + evolução — último artist_metrics_snapshots (valor atual + deltas jsonb).
//
// Elegibilidade: artistas ATIVOS (is_locked=false) COM diagnóstico (realIndex) E plano
// (strategies não-vazio). Destinatários: dono + colaboradores ativos (cap 20). Cada usuário
// pode descadastrar (email_preferences.weekly_report=false) — respeitado aqui e desligado pela
// função pública weekly-report-unsub via token.
//
// Anti-repetição: marcador na tabela `notifications` (reference_type='weekly',
// reference_id=<ISO YYYY-Www>) por user+artist. Se o cron disparar 2x na mesma semana, não reenvia.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BREVO_API_KEY, BREVO_SENDER,
//          APP_URL (base dos links do app), WEEKLY_UNSUB_URL (URL pública do endpoint de descadastro),
//          CRON_SECRET (opcional; se setado, exige header x-cron-secret).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sendBrevoEmail, emailLayout, ctaButton } from "./brevo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") || "https://www.maestramanager.com").replace(/\/+$/, "");
const UNSUB_URL = (Deno.env.get("WEEKLY_UNSUB_URL") || `${SUPABASE_URL}/functions/v1/weekly-report-unsub`).replace(/\/+$/, "");
const CRON_SECRET = Deno.env.get("CRON_SECRET") || "";
const MAX_RECIPIENTS = 20;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info, x-cron-secret",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function hasServiceRole(req: Request): boolean {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any;

// ─── Helpers de formatação ────────────────────────────────────────────────────
const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const fmtNum = (n: number): string => {
  try { return new Intl.NumberFormat("pt-BR").format(Math.round(n)); }
  catch { return String(Math.round(n)); }
};

const fmtDelta = (abs: number): string => (abs > 0 ? `+${fmtNum(abs)}` : abs < 0 ? `-${fmtNum(-abs)}` : "0");

// Ref ISO da semana (YYYY-Www), usada como chave de dedup. Semana ISO: quinta-feira decide o ano.
function isoWeekRef(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; // 1..7 (segunda..domingo)
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ─── Cache de e-mail/nome do dono (auth.users) ─────────────────────────────────
const emailCache = new Map<string, { email: string; name: string } | null>();
async function getUser(admin: Admin, userId: string): Promise<{ email: string; name: string } | null> {
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

// ─── Preferências de e-mail (opt-out) — upsert on-demand pra ter o token ───────
const prefsCache = new Map<string, { weekly_report: boolean; unsub_token: string | null }>();
async function getPrefs(admin: Admin, userId: string): Promise<{ weekly_report: boolean; unsub_token: string | null }> {
  if (prefsCache.has(userId)) return prefsCache.get(userId)!;
  let out = { weekly_report: true, unsub_token: null as string | null };
  try {
    const { data } = await admin.from("email_preferences")
      .select("weekly_report, unsub_token").eq("user_id", userId).maybeSingle();
    if (data) {
      out = { weekly_report: data.weekly_report !== false, unsub_token: data.unsub_token ?? null };
    } else {
      // Cria a linha padrão (weekly_report=true) e pega o token gerado pelo default do banco.
      const { data: ins } = await admin.from("email_preferences")
        .insert({ user_id: userId }).select("weekly_report, unsub_token").maybeSingle();
      if (ins) out = { weekly_report: ins.weekly_report !== false, unsub_token: ins.unsub_token ?? null };
    }
  } catch (e) {
    // Falhar fechado: sem a tabela/preferência não devemos enviar um e-mail recorrente.
    console.error("[weekly] getPrefs:", (e as Error)?.message);
    out = { weekly_report: false, unsub_token: null };
  }
  prefsCache.set(userId, out);
  return out;
}

// Já enviamos o resumo dessa semana pra esse user+artista?
async function alreadySent(admin: Admin, userId: string, artistId: string, weekRef: string): Promise<boolean> {
  const { data, error } = await admin.from("notifications").select("id")
    .eq("user_id", userId).eq("artist_id", artistId)
    .eq("reference_type", "weekly").eq("reference_id", weekRef).limit(1);
  if (error) {
    console.error("[weekly] dedup query:", error.message);
    return true; // falhar fechado para não duplicar e-mail
  }
  return !!(data && data.length);
}

// ─── Destinatários: dono + colaboradores ativos (cap 20) ───────────────────────
async function getRecipients(admin: Admin, artist: { id: string; user_id: string }): Promise<string[]> {
  const ids: string[] = [artist.user_id];
  const { data: members } = await admin.from("artist_members")
    .select("user_id").eq("artist_id", artist.id).eq("status", "active").not("user_id", "is", null);
  for (const m of members || []) {
    if (m.user_id && !ids.includes(m.user_id) && ids.length < MAX_RECIPIENTS) ids.push(m.user_id);
  }
  return ids.slice(0, MAX_RECIPIENTS);
}

// ─── Monta os dados do relatório a partir do content + snapshot ────────────────
interface Report {
  phaseName: string;
  boletim: { r: number; e: number; a: number; l: number } | null;
  done: number;
  total: number;
  pct: number;
  focusTitle: string | null;
  planComplete: boolean;
  metrics: Array<{ label: string; value: string; delta: string | null; up: boolean | null }>;
}

const METRIC_LABELS: Record<string, string> = {
  monthly_listeners: "Ouvintes mensais (Spotify)",
  followers: "Seguidores",
  popularity: "Popularidade",
  track_count: "Faixas lançadas",
};

// deno-lint-ignore no-explicit-any
function buildReport(content: any, snap: any): Report {
  const ri = content?.realIndex || {};
  const phaseName = String(ri?.profile?.name || "").trim() || "Sua fase de carreira";
  const b = ri?.boletim;
  const boletim = (b && typeof b === "object")
    ? { r: Number(b.r) || 0, e: Number(b.e) || 0, a: Number(b.a) || 0, l: Number(b.l) || 0 }
    : null;

  // Progresso do plano: tarefas ativas (status !== 'archived'); concluída = status === 'done'.
  // deno-lint-ignore no-explicit-any
  const strategies: any[] = Array.isArray(content?.strategies) ? content.strategies : [];
  // deno-lint-ignore no-explicit-any
  const ranked = [...strategies].sort((a: any, c: any) => (c.finalScore ?? 0) - (a.finalScore ?? 0));
  const info = ranked.map((s) => {
    const ts = (Array.isArray(s.tasks) ? s.tasks : []).filter((t: any) => t?.status !== "archived");
    const done = ts.filter((t: any) => t?.status === "done").length;
    return { title: String(s.title || ""), done, total: ts.length, complete: ts.length > 0 && done === ts.length };
  });
  const withTasks = info.filter((p) => p.total > 0);
  const displayed = withTasks.length ? withTasks : info;
  const done = displayed.reduce((a, p) => a + p.done, 0);
  const total = displayed.reduce((a, p) => a + p.total, 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const focus = displayed.find((p) => p.total > 0 && !p.complete);
  const planComplete = total > 0 && !focus;

  // Métricas: valor atual do snapshot + delta (deltas jsonb "desde a última medição").
  const metrics: Report["metrics"] = [];
  if (snap) {
    const deltas = (snap.deltas && typeof snap.deltas === "object") ? snap.deltas : {};
    for (const key of ["monthly_listeners", "followers", "popularity", "track_count"]) {
      const val = snap[key];
      if (val == null) continue;
      const d = deltas[key];
      const hasDelta = d && typeof d.abs === "number" && d.abs !== 0;
      metrics.push({
        label: METRIC_LABELS[key] || key,
        value: fmtNum(Number(val)),
        delta: hasDelta ? fmtDelta(d.abs) : null,
        up: hasDelta ? d.abs > 0 : null,
      });
    }
  }

  return { phaseName, boletim, done, total, pct, focusTitle: focus?.title || null, planComplete, metrics };
}

// ─── HTML do corpo do e-mail ───────────────────────────────────────────────────
function renderBody(r: Report, artistName: string, greetName: string, artistId: string, unsubUrl: string | null): string {
  const card = (inner: string) =>
    `<div style="background:#f7f9fd;border:1px solid #e3eaf3;border-radius:12px;padding:16px 18px;margin:14px 0;">${inner}</div>`;
  const label = (t: string) =>
    `<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#3361ff;margin-bottom:8px;">${t}</div>`;

  const hi = greetName ? `Olá, ${escapeHtml(greetName)}! ` : "";
  const parts: string[] = [];
  parts.push(
    `<p style="color:#405985;line-height:1.6;margin:0 0 4px;">${hi}Aqui está o resumo da semana da carreira de <strong style="color:#2c3f63;">${escapeHtml(artistName)}</strong>.</p>`,
  );

  // 1) Fase REAL
  let phaseInner = label("Etapa atual") +
    `<div style="font-size:18px;font-weight:700;color:#2c3f63;line-height:1.3;">${escapeHtml(r.phaseName)}</div>`;
  if (r.boletim) {
    const bars = ([["Alcance", r.boletim.r], ["Receita", r.boletim.e], ["Audiência", r.boletim.a], ["Legitimidade", r.boletim.l]] as const)
      .map(([name, v]) => {
        const w = Math.max(0, Math.min(100, v));
        return `<div style="margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#405985;margin-bottom:4px;"><span>${name}</span><span style="color:#2c3f63;font-weight:600;">${w}/100</span></div>
          <div style="height:6px;background:#eef2f8;border-radius:9999px;overflow:hidden;"><div style="height:6px;width:${w}%;background:#3361ff;border-radius:9999px;"></div></div>
        </div>`;
      }).join("");
    phaseInner += `<div style="margin-top:12px;">${bars}</div>`;
  }
  parts.push(card(phaseInner));

  // 2) Progresso do plano
  let planInner = label("Seu plano de ação");
  if (r.total > 0) {
    planInner += `<div style="font-size:16px;color:#2c3f63;font-weight:600;">${r.done} de ${r.total} tarefas concluídas <span style="color:#3361ff;">(${r.pct}%)</span></div>
      <div style="height:8px;background:#eef2f8;border-radius:9999px;overflow:hidden;margin-top:10px;"><div style="height:8px;width:${r.pct}%;background:#3361ff;border-radius:9999px;"></div></div>`;
    if (r.planComplete) {
      planInner += `<p style="color:#405985;line-height:1.6;margin:12px 0 0;">Você concluiu todas as tarefas do plano. Hora de refazer o diagnóstico e evoluir pro próximo nível.</p>`;
    } else if (r.focusTitle) {
      planInner += `<p style="color:#405985;line-height:1.6;margin:12px 0 0;">Foco agora: <strong style="color:#2c3f63;">${escapeHtml(r.focusTitle)}</strong></p>`;
    }
  } else {
    planInner += `<p style="color:#405985;line-height:1.6;margin:0;">Seu plano ainda não tem tarefas. Abra a Maestra e priorize as estratégias com a Nyta.</p>`;
  }
  parts.push(card(planInner));

  // 3) Métricas + evolução
  if (r.metrics.length) {
    const rows = r.metrics.map((m) => {
      const deltaHtml = m.delta
        ? `<span style="font-size:12px;font-weight:700;color:${m.up ? "#2a9a59" : "#d2474b"};margin-left:8px;">${m.delta}</span>`
        : "";
      return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0;border-bottom:1px solid #e3eaf3;">
        <span style="color:#405985;font-size:13px;">${m.label}</span>
        <span style="color:#2c3f63;font-weight:600;">${m.value}${deltaHtml}</span>
      </div>`;
    }).join("");
    parts.push(card(label("Métricas e evolução") + rows +
      `<p style="color:#93a4c0;font-size:11px;margin:10px 0 0;">Variação desde a última medição.</p>`));
  }

  parts.push(ctaButton("Ver meu plano de ação", `${APP_URL}/artists/${artistId}/action-plan`));

  if (unsubUrl) {
    parts.push(
      `<p style="color:#93a4c0;font-size:12px;margin:8px 0 0;line-height:1.6;">Não quer mais o resumo semanal? <a href="${unsubUrl}" style="color:#7c8da8;text-decoration:underline;">Descadastrar</a>.</p>`,
    );
  }
  return parts.join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) return json({ error: "forbidden" }, 403);

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const testArtistId = typeof body?.test_artist_id === "string" ? body.test_artist_id : null;
  const testUserId = typeof body?.test_user_id === "string" ? body.test_user_id : null;
  if (testArtistId || testUserId) {
    if (!testArtistId || !testUserId || !hasServiceRole(req)) {
      return json({ error: "test_mode_requires_service_role_and_ids" }, 403);
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const weekRef = isoWeekRef(new Date());
  let emails = 0, notifs = 0, artistsDone = 0, skipped = 0;

  try {
    let artistsQuery = admin
      .from("artists")
      .select("id, user_id, name, is_locked, content");
    if (testArtistId) artistsQuery = artistsQuery.eq("id", testArtistId);
    const { data: artists, error } = await artistsQuery;
    if (error) throw error;

    for (const a of artists || []) {
      // Elegibilidade: ativo + diagnóstico + plano.
      const content = a.content || {};
      const hasReal = content.realIndex && typeof content.realIndex === "object";
      const strategies = Array.isArray(content.strategies) ? content.strategies : [];
      if (a.is_locked === true || !hasReal || strategies.length === 0) { skipped++; continue; }

      // Snapshot de métricas mais recente (pode não existir).
      const { data: snap } = await admin.from("artist_metrics_snapshots")
        .select("monthly_listeners, followers, popularity, track_count, deltas, collected_at")
        .eq("artist_id", a.id).order("collected_at", { ascending: false }).limit(1).maybeSingle();

      const report = buildReport(content, snap);
      const artistName = a.name || "seu artista";
      const allRecipients = await getRecipients(admin, a);
      if (testUserId && !allRecipients.includes(testUserId)) {
        return json({ error: "test_user_is_not_an_artist_recipient" }, 400);
      }
      const recipients = testUserId ? [testUserId] : allRecipients;
      let sentForArtist = false;

      for (const userId of recipients) {
        const prefs = await getPrefs(admin, userId);
        if (!prefs.weekly_report) continue; // descadastrado
        if (await alreadySent(admin, userId, a.id, weekRef)) continue;

        const nowIso = new Date().toISOString();
        // Marcador de dedup + notificação in-app (aparece no sino).
        try {
          const { error: notificationError } = await admin.from("notifications").insert({
            user_id: userId, artist_id: a.id, type: "info",
            title: "Seu resumo semanal chegou",
            message: `Veja a fase atual, o progresso do plano e a evolução de ${artistName} nesta semana.`,
            link: `/artists/${a.id}/action-plan`,
            read: false, source: "weekly", reference_type: "weekly", reference_id: weekRef,
            status: "active", created_at: nowIso,
          });
          if (notificationError) {
            console.error("[weekly] insert notification:", notificationError.message);
            continue;
          }
          notifs++;
        } catch (e) {
          console.error("[weekly] insert notification:", (e as Error)?.message);
          continue; // sem marcador não envia (evita duplicidade sem dedup)
        }

        const u = await getUser(admin, userId);
        if (u?.email) {
          const unsubUrl = prefs.unsub_token ? `${UNSUB_URL}?token=${prefs.unsub_token}` : null;
          const html = emailLayout({
            title: `Resumo semanal · ${escapeHtml(artistName)}`,
            bodyHtml: renderBody(report, artistName, u.name, a.id, unsubUrl),
          });
          const res = await sendBrevoEmail({ to: u.email, toName: u.name || undefined, subject: `Seu resumo semanal · ${artistName}`, html });
          if (res.ok) emails++;
        }
        sentForArtist = true;
      }
      if (sentForArtist) artistsDone++;
    }

    return json({ ok: true, weekRef, artistsDone, emails, notifs, skipped });
  } catch (e) {
    console.error("[weekly] erro:", (e as Error)?.message);
    return json({ error: "internal", detail: (e as Error)?.message }, 500);
  }
});
