import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// CRM interno: em que etapa do funil cada pessoa está, e o que já foi disparado para ela.
//
// A etapa NÃO é armazenada em lugar nenhum — é derivada do estado atual, exatamente como o
// `activation-nudges` faz na hora de decidir quem recebe o quê. Essa duplicação é deliberada e
// tem um limite: se as duas divergirem, o painel passa a mostrar uma etapa e o e-mail a disparar
// por outra. Ao mexer nas regras de uma, mexa na outra. As regras são estas três:
//
//   A) sem nenhum artista
//   B) tem artista, todos bloqueados (is_locked = true)
//   C) tem artista desbloqueado, sem planejamento concluído (content.strategies ausente)
//   D) ativado — desbloqueado E com planejamento
//
// Quem tem vários artistas é classificado pelo MAIS AVANÇADO deles: alguém com um perfil ativo e
// outro recém-criado não é um lead travado na etapa B.
//
// Body: { action: "overview" }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

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
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export type Etapa = "A" | "B" | "C" | "D";

const ETAPAS: { id: Etapa; nome: string; descricao: string }[] = [
  { id: "A", nome: "Cadastrou", descricao: "Criou a conta e ainda não montou nenhum perfil de artista." },
  { id: "B", nome: "Criou perfil", descricao: "Tem perfil, mas ainda não desbloqueou nenhum." },
  { id: "C", nome: "Desbloqueou", descricao: "Pagou o desbloqueio e ainda não concluiu o planejamento." },
  { id: "D", nome: "Ativado", descricao: "Planejamento estratégico concluído." },
];

const dias = (iso?: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
};

/** Ordem de avanço — usada para escolher a etapa mais avançada de quem tem vários perfis. */
const AVANCO: Record<Etapa, number> = { A: 0, B: 1, C: 2, D: 3 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado" }, 401);

  const admin: Admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerErr || !caller) return json({ error: "Não autorizado" }, 401);
  let isAdmin = !!caller.app_metadata?.is_platform_admin;
  if (!isAdmin) {
    const { data: row } = await admin.from("platform_admins").select("id").eq("user_id", caller.id).maybeSingle();
    isAdmin = !!row;
  }
  if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

  try {
    // ── Coleta ────────────────────────────────────────────────────────────────────────────────
    const usuarios: Row[] = [];
    for (let page = 1; page <= 50; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const lote = data?.users || [];
      usuarios.push(...lote);
      if (lote.length < 1000) break;
    }

    const [artistas, compras, assinaturas, nudges, conversas, consentimentos, convites] = await Promise.all([
      admin.from("artists").select("id, user_id, name, is_locked, created_at, purchased_at, content").then((r: Row) => r.data || []),
      admin.from("artist_purchases").select("user_id, amount, status, paid_at").then((r: Row) => r.data || []),
      admin.from("asaas_subscriptions").select("user_id, status, value").then((r: Row) => r.data || []),
      admin.from("notifications").select("user_id, reference_id, created_at").eq("reference_type", "nudge").then((r: Row) => r.data || []),
      admin.from("nyta_conversations").select("user_id").then((r: Row) => r.data || []),
      admin.from("user_consents_current").select("user_id, kind, status").then((r: Row) => r.data || []),
      admin.from("artist_members").select("email, status").then((r: Row) => r.data || []),
    ]);

    // ── Índices ───────────────────────────────────────────────────────────────────────────────
    const porUsuario = new Map<string, Row[]>();
    for (const a of artistas) {
      const lista = porUsuario.get(a.user_id) || [];
      lista.push(a);
      porUsuario.set(a.user_id, lista);
    }

    const pagoPorUsuario = new Map<string, { qtd: number; total: number }>();
    for (const c of compras) {
      if (c.status !== "paid" && c.status !== "RECEIVED" && c.status !== "CONFIRMED") continue;
      const atual = pagoPorUsuario.get(c.user_id) || { qtd: 0, total: 0 };
      atual.qtd += 1;
      atual.total += Number(c.amount) || 0;
      pagoPorUsuario.set(c.user_id, atual);
    }

    const assinaturaPorUsuario = new Map<string, Row>();
    for (const s of assinaturas) assinaturaPorUsuario.set(s.user_id, s);

    const nudgesPorUsuario = new Map<string, string[]>();
    for (const n of nudges) {
      const lista = nudgesPorUsuario.get(n.user_id) || [];
      if (n.reference_id) lista.push(n.reference_id);
      nudgesPorUsuario.set(n.user_id, lista);
    }

    const usaNyta = new Set<string>(conversas.map((c: Row) => c.user_id));

    // Só o consentimento de comunicações interessa aqui: é ele que autoriza (ou não) o nudge.
    const optIn = new Set<string>(
      consentimentos.filter((c: Row) => c.kind === "comunicacoes" && c.status === "dado").map((c: Row) => c.user_id)
    );

    const convidados = new Set<string>(convites.map((m: Row) => String(m.email || "").toLowerCase()));

    // ── Classificação ─────────────────────────────────────────────────────────────────────────
    const leads = usuarios.map((u) => {
      const meus = porUsuario.get(u.id) || [];

      let etapa: Etapa = "A";
      // `desde` é o marco a partir do qual a pessoa está parada NESTA etapa — é ele que responde
      // "há quantos dias travou", e não a data de cadastro.
      let desde: string | null = u.created_at;
      let perfil: string | null = null;

      for (const a of meus) {
        const temPlano = !!(a.content && typeof a.content === "object" && a.content.strategies);
        const candidata: Etapa = a.is_locked ? "B" : temPlano ? "D" : "C";
        if (AVANCO[candidata] >= AVANCO[etapa]) {
          etapa = candidata;
          desde = candidata === "B" ? a.created_at : (a.purchased_at || a.updated_at || a.created_at);
          perfil = a.name || null;
        }
      }

      const pago = pagoPorUsuario.get(u.id);
      const assinatura = assinaturaPorUsuario.get(u.id);

      return {
        id: u.id,
        email: u.email || "",
        nome: String(u.user_metadata?.full_name || u.user_metadata?.name || "") || null,
        criadoEm: u.created_at,
        etapa,
        perfil,
        diasNaEtapa: dias(desde),
        // Engajamento
        ultimoAcesso: u.last_sign_in_at || null,
        diasSemAcessar: dias(u.last_sign_in_at),
        perfis: meus.length,
        usouNyta: usaNyta.has(u.id),
        // Financeiro
        perfisPagos: pago?.qtd || 0,
        totalPago: pago?.total || 0,
        assinatura: assinatura?.status || null,
        // Origem
        provedor: (u.app_metadata?.provider as string) || "email",
        veioDeConvite: convidados.has(String(u.email || "").toLowerCase()),
        // Consentimento — quem não optou não deveria receber nudge de marketing.
        aceitaComunicacoes: optIn.has(u.id),
        // Automação
        nudgesRecebidos: [...new Set(nudgesPorUsuario.get(u.id) || [])].sort(),
      };
    });

    // ── Funil ─────────────────────────────────────────────────────────────────────────────────
    const contagem: Record<Etapa, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const l of leads) contagem[l.etapa] += 1;

    // "Alcançaram" = está nesta etapa ou passou dela. É o denominador honesto da conversão: quem
    // está em C já passou por A e B.
    const alcancaram = (e: Etapa) =>
      leads.filter((l) => AVANCO[l.etapa] >= AVANCO[e]).length;

    const funil = ETAPAS.map((et, i) => {
      const anterior = i > 0 ? alcancaram(ETAPAS[i - 1].id) : leads.length;
      const chegaram = alcancaram(et.id);
      return {
        ...et,
        aqui: contagem[et.id],
        chegaram,
        conversao: anterior > 0 ? Math.round((chegaram / anterior) * 100) : null,
      };
    });

    return json({
      geradoEm: new Date().toISOString(),
      totalLeads: leads.length,
      funil,
      leads: leads.sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)),
      // Sinal de higiene: quem está recebendo nudge sem ter optado por comunicações.
      semOptInRecebendoNudge: leads.filter((l) => !l.aceitaComunicacoes && l.nudgesRecebidos.length > 0).length,
    });
  } catch (e) {
    console.error("[admin-crm]", e);
    return json({ error: (e as Error)?.message || "Erro interno" }, 500);
  }
});
