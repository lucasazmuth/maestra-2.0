import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Consentimento e maioridade — LGPD.
//
// Os Termos (§3) e a Política (§11) restringem o uso a maiores de 18 anos, mas até aqui nada
// verificava isso. Esta função é a ÚNICA que escreve em user_consents e user_compliance: as duas
// tabelas não têm policy de INSERT, então nem o dono da conta consegue forjar um aceite pelo
// DevTools. Validar a idade no front seria decorativo; quem decide é este arquivo.
//
// Body: { action: "state" }
//     | { action: "submit", birthDate, aceitaPolitica, aceitaTermos, aceitaComunicacoes }
//     | { action: "revoke", kind }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const IDADE_MINIMA = 18;

// Documentos que todo mundo precisa aceitar para usar o serviço. O TCLE da pesquisa NÃO entra
// aqui: é opcional por definição, e recusá-lo não pode alterar o acesso (P2).
const DOCS_OBRIGATORIOS = [
  { slug: "privacidade", kind: "politica_privacidade" },
  { slug: "termos", kind: "termos" },
] as const;

// Só faz sentido revogar o que foi dado por escolha. Revogar a maioridade ou o aceite da política
// não é "revogar": é encerrar a conta, que tem fluxo próprio em Configurações.
const REVOGAVEIS = ["comunicacoes", "pesquisa"];

/**
 * Idade em anos completos, calculada no servidor a partir de uma data ISO (AAAA-MM-DD).
 * Devolve null quando a data é malformada ou inexistente no calendário.
 */
const idadeEmAnos = (iso: unknown, hoje = new Date()): number | null => {
  if (typeof iso !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const ano = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);

  // Date.UTC e não `new Date("2008-08-15")` com getters locais: no fuso do Brasil a data recuaria
  // um dia, e quem faz aniversário hoje seria barrado por 24 horas.
  const nasc = new Date(Date.UTC(ano, mes - 1, dia));
  if (Number.isNaN(nasc.getTime())) return null;
  // O construtor remonta datas impossíveis (31/02 vira 03/03). Comparar de volta rejeita isso.
  if (nasc.getUTCFullYear() !== ano || nasc.getUTCMonth() !== mes - 1 || nasc.getUTCDate() !== dia) return null;

  const hy = hoje.getUTCFullYear(), hm = hoje.getUTCMonth() + 1, hd = hoje.getUTCDate();
  let idade = hy - ano;
  const jaFezAniversario = hm > mes || (hm === mes && hd >= dia);
  if (!jaFezAniversario) idade -= 1;
  return idade;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "state");

    // Versões vigentes dos documentos obrigatórios.
    const { data: docs, error: docsError } = await db
      .from("legal_documents")
      .select("slug, version, title, content_sha256, published_at")
      .eq("is_current", true);
    if (docsError) throw docsError;

    const vigente = (slug: string) => (docs || []).find((d) => d.slug === slug);

    // Falha FECHADA: sem documento vigente configurado não há como registrar um aceite válido, e
    // deixar passar produziria contas sem consentimento — exatamente o que esta função existe para
    // evitar. O erro é barulhento de propósito: aparece no teste, antes de o gate ser ligado.
    const faltando = DOCS_OBRIGATORIOS.filter((d) => !vigente(d.slug)).map((d) => d.slug);
    if (faltando.length) {
      return json({ error: `Documentos legais não configurados: ${faltando.join(", ")}` }, 500);
    }

    const [{ data: compliance }, { data: consents }] = await Promise.all([
      db.from("user_compliance").select("*").eq("user_id", user.id).maybeSingle(),
      db.from("user_consents_current").select("kind, status, document_version").eq("user_id", user.id),
    ]);

    const atual = (kind: string) => (consents || []).find((c) => c.kind === kind);

    // Pendente = nunca aceito, ou aceito numa versão anterior à vigente. É assim que uma revisão
    // da política reabre o aceite para todo mundo, sem script de migração.
    const pendentes = DOCS_OBRIGATORIOS.filter(({ slug, kind }) => {
      const c = atual(kind);
      return !c || c.status !== "dado" || c.document_version !== vigente(slug)!.version;
    }).map(({ slug }) => {
      const d = vigente(slug)!;
      return { slug, version: d.version, title: d.title };
    });

    const bloqueado = compliance?.review_status === "menor_em_revisao";
    const precisaNascimento = !compliance?.birth_date;

    const estado = {
      blocked: bloqueado,
      reviewStatus: compliance?.review_status || "ok",
      needsBirthDate: precisaNascimento,
      pendingDocs: pendentes,
      // O front usa isto para decidir se manda para o gate. Bloqueado tem tela própria.
      satisfied: !bloqueado && !precisaNascimento && pendentes.length === 0,
      comunicacoes: atual("comunicacoes")?.status === "dado",
      pesquisa: atual("pesquisa")?.status ?? null,
    };

    if (action === "state") return json(estado);

    // ── revoke ───────────────────────────────────────────────────────────────────────────────
    if (action === "revoke") {
      const kind = String(body?.kind || "");
      if (!REVOGAVEIS.includes(kind)) {
        return json({ error: "Esse consentimento não é revogável por aqui." }, 400);
      }
      const { error } = await db.from("user_consents").insert({
        user_id: user.id, kind, status: "revogado", source: "app",
        ip: req.headers.get("x-forwarded-for"), user_agent: req.headers.get("user-agent"),
      });
      if (error) throw error;
      return json({ ok: true });
    }

    // ── submit ───────────────────────────────────────────────────────────────────────────────
    if (action !== "submit") return json({ error: "Ação desconhecida" }, 400);

    if (bloqueado) return json({ ...estado, error: "Conta em revisão." }, 403);

    // Quando o aceite reabre por causa de uma versão nova da política, a data já registrada vale:
    // pedir de novo seria atrito sem ganho, e a idade só aumenta.
    const nascimento = body?.birthDate ?? compliance?.birth_date;
    const idade = idadeEmAnos(nascimento);
    if (idade === null) return json({ error: "Informe uma data de nascimento válida.", field: "birthDate" }, 400);
    if (idade < 0) return json({ error: "A data de nascimento não pode estar no futuro.", field: "birthDate" }, 400);

    if (!body?.aceitaPolitica || !body?.aceitaTermos) {
      return json({ error: "É preciso aceitar os Termos de Uso e a Política de Privacidade." }, 400);
    }

    const rastro = {
      source: "app",
      ip: req.headers.get("x-forwarded-for"),
      user_agent: req.headers.get("user-agent"),
    };
    const agora = new Date().toISOString();
    const menor = idade < IDADE_MINIMA;

    // Registrar o que a pessoa DECLAROU, mesmo sendo menor: se a revisão concluir que houve erro
    // de digitação na data, o aceite dos documentos já está lá e ela não é interrogada de novo.
    const linhas = [
      { user_id: user.id, kind: "maioridade", status: menor ? "negado" : "dado", ...rastro },
      ...DOCS_OBRIGATORIOS.map(({ slug, kind }) => {
        const d = vigente(slug)!;
        return {
          user_id: user.id, kind, status: "dado",
          document_slug: slug, document_version: d.version, content_sha256: d.content_sha256,
          ...rastro,
        };
      }),
    ];
    // Comunicações é opt-in separado: só vira linha quando a pessoa marca. Não marcar não é
    // "negado" ativo — é ausência de consentimento, e é assim que fica registrado.
    if (body?.aceitaComunicacoes) {
      linhas.push({ user_id: user.id, kind: "comunicacoes", status: "dado", ...rastro });
    }

    const { error: consentError } = await db.from("user_consents").insert(linhas);
    if (consentError) throw consentError;

    const { error: complianceError } = await db.from("user_compliance").upsert({
      user_id: user.id,
      birth_date: String(nascimento).trim(),
      declared_adult_at: menor ? null : agora,
      review_status: menor ? "menor_em_revisao" : "ok",
      // Bloqueia o acesso, mas NÃO apaga nada: uma data digitada errada não pode custar a conta.
      // A liberação (ou a exclusão) é decisão humana, pelo painel admin.
      blocked_at: menor ? agora : null,
      updated_at: agora,
    }, { onConflict: "user_id" });
    if (complianceError) throw complianceError;

    if (menor) {
      return json({
        blocked: true, reviewStatus: "menor_em_revisao", needsBirthDate: false,
        pendingDocs: [], satisfied: false, comunicacoes: false, pesquisa: null,
      });
    }

    return json({
      blocked: false, reviewStatus: "ok", needsBirthDate: false, pendingDocs: [],
      satisfied: true, comunicacoes: !!body?.aceitaComunicacoes,
      pesquisa: estado.pesquisa,
    });
  } catch (e) {
    console.error("[account-consent]", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
