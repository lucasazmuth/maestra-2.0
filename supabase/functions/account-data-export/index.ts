import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Portabilidade e acesso aos próprios dados — LGPD art. 18, II e V.
//
// O extrato é CURADO, não um despejo das tabelas. A primeira versão devolvia `select *` de cada
// tabela, o que trazia dois problemas:
//
//   1. Entregava os internos do motor do diagnóstico (components, cutLine, pattern, dimTopIcon) —
//      justamente o que a Política reserva como segredo de negócio no §12. Ninguém pediu isso, e
//      não é dado pessoal: é metodologia.
//   2. Era ilegível para quem recebe. `user_id`, `is_locked`, `z: null`, `absent: false` não
//      dizem nada a uma artista, e o art. 18, II existe para ela ENTENDER o que guardamos.
//
// A régua aplicada aqui: sai tudo que é encanamento (ids, chaves estrangeiras, ids de provedor de
// pagamento, embeddings, contadores de retentativa, estado de navegação do wizard) e fica tudo que
// a pessoa reconheceria como seu — inclusive as respostas que ela mesma deu ao diagnóstico.
//
// Formato JSON de propósito: portabilidade (art. 18, V) pede algo interoperável, que dê para
// importar em outro lugar. PDF serve para ler, não para portar.
//
// Body: {} — não recebe parâmetros. Aceitar um userId seria criar uma rota para baixar os dados
// dos outros; o recorte vem sempre do JWT.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

/** Remove chaves nulas/vazias — um extrato cheio de `"campo": null` só atrapalha a leitura. */
const limpo = <T extends Row>(o: T): Partial<T> => {
  const out: Row = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && !v.length) continue;
    out[k] = v;
  }
  return out as Partial<T>;
};

const lista = (rows: Row[] | null | undefined, fn: (r: Row) => Row) => (rows || []).map((r) => limpo(fn(r)));

/**
 * Diagnóstico REAL em forma de resultado, não de objeto interno.
 *
 * Entram a nota, o perfil e as RESPOSTAS da pessoa (que são dela). Ficam de fora `components`,
 * `cutLine`, `pattern`, `dimTopIcon` e os moduladores de receita: descrevem como o motor pontua,
 * não o que sabemos sobre ela.
 */
const diagnostico = (ri: Row | null | undefined) => {
  if (!ri) return null;
  const b = ri.boletim || {};
  const eng = ri.engagement || {};
  // Do engajamento fica só a taxa da artista. O `cut` de cada rede é o limiar do método.
  const taxa = (net: string) => (eng[net]?.value ?? null);
  return limpo({
    feitoEm: ri.computedAt ?? null,
    perfil: ri.profile?.name ?? null,
    descricaoDoPerfil: ri.profile?.description ?? null,
    notas: limpo({
      alcance: b.r ?? null,
      receita: b.e ?? null,
      publicoReal: b.a ?? null,
      legitimacao: b.l ?? null,
    }),
    taxaDeEngajamento: limpo({
      instagram: taxa("instagram"),
      tiktok: taxa("tiktok"),
      youtube: taxa("youtube"),
    }),
    respostas: ri.inputs ?? null,
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const { data: artists } = await db.from("artists").select("*").eq("user_id", user.id);
    const artistIds = (artists || []).map((a: Row) => a.id);

    const porArtista = async (tabela: string) => {
      if (!artistIds.length) return [];
      const { data } = await db.from(tabela).select("*").in("artist_id", artistIds);
      return data || [];
    };
    const porUsuario = async (tabela: string) => {
      const { data } = await db.from(tabela).select("*").eq("user_id", user.id);
      return data || [];
    };

    const [
      projetos, faixas, eventos, planos, membros, compras,
      conversas, notificacoes, assinaturas, avaliacoes, consentimentos, conformidade,
    ] = await Promise.all([
      porArtista("catalog_projects"),
      porArtista("catalog_items"),
      porArtista("events"),
      // `embedding` é um vetor de busca semântica: não é legível, não é da pessoa e pesa mais que
      // todo o resto do extrato somado.
      artistIds.length
        ? db.from("strategic_plans").select("artist_id, title, segment, career_stage, context_summary, objectives, strategies, kpis, timeline, full_content, status, created_at").in("artist_id", artistIds).then((r) => r.data || [])
        : Promise.resolve([]),
      porArtista("artist_members"),
      porUsuario("artist_purchases"),
      porUsuario("nyta_conversations"),
      porUsuario("notifications"),
      porUsuario("user_subscriptions"),
      porUsuario("platform_reviews"),
      porUsuario("user_consents"),
      db.from("user_compliance").select("*").eq("user_id", user.id).maybeSingle().then((r) => r.data),
    ]);

    const projetoIds = projetos.map((p: Row) => p.id);
    const conversaIds = conversas.map((c: Row) => c.id);
    const [versoes, mensagens] = await Promise.all([
      projetoIds.length
        ? db.from("catalog_versions").select("*").in("project_id", projetoIds).then((r) => r.data || [])
        : Promise.resolve([]),
      conversaIds.length
        // tool_calls/tool_results são a orquestração interna da Nyta, não a conversa.
        ? db.from("nyta_messages").select("conversation_id, role, content, created_at").in("conversation_id", conversaIds).then((r) => r.data || [])
        : Promise.resolve([]),
    ]);

    const assinatura = assinaturas[0] as Row | undefined;

    return json({
      geradoEm: new Date().toISOString(),
      aviso:
        "Extrato dos dados pessoais tratados pela Maestra, nos termos do art. 18 da LGPD. " +
        "Identificadores internos do sistema foram omitidos por não dizerem respeito a você.",

      conta: limpo({
        email: user.email,
        nome: user.user_metadata?.full_name || user.user_metadata?.name || null,
        criadaEm: user.created_at,
        ultimoAcesso: user.last_sign_in_at,
        formasDeAcesso: user.app_metadata?.providers ?? null,
      }),

      consentimentos: limpo({
        dataDeNascimento: conformidade?.birth_date ?? null,
        maioridadeDeclaradaEm: conformidade?.declared_adult_at ?? null,
        situacaoDaConta: conformidade?.review_status ?? null,
        registros: lista(consentimentos, (c) => ({
          tipo: c.kind,
          situacao: c.status,
          documento: c.document_slug,
          versaoDoDocumento: c.document_version,
          em: c.occurred_at,
          ip: c.ip,
          dispositivo: c.user_agent,
        })),
      }),

      artistas: (artists || []).map((a: Row) => {
        const c = a.content || {};
        return limpo({
          nome: a.name,
          criadoEm: a.created_at,
          situacao: a.is_locked ? "não liberado" : "liberado",
          liberadoEm: a.purchased_at,
          identidade: c.identity ?? null,
          perfilNoSpotify: c.spotifyProfile ?? null,
          metricasDeAudiencia: c.chartmetricProfile ?? null,
          diagnostico: diagnostico(c.realIndex),
          planejamento: limpo({
            objetivos: c.objectives ?? null,
            swotRespostas: c.swotInputs ?? null,
            swotAnalise: c.swotAnalysis ?? null,
            swotEdicoes: c.swotUserEdits ?? null,
            estrategias: c.strategies ?? null,
            resumoExecutivo: c.executiveSummary ?? null,
          }),
        });
      }),

      catalogo: lista(projetos, (p) => ({
        titulo: p.title,
        situacao: p.status,
        genero: p.genre,
        bpm: p.bpm,
        tom: p.key,
        lancamento: p.release_date,
        criadoEm: p.created_at,
        versoes: lista(
          versoes.filter((v: Row) => v.project_id === p.id),
          (v) => ({
            numero: v.version_number,
            titulo: v.title,
            duracao: v.duration,
            arquivo: v.audio_file_name,
            letra: v.lyrics,
            autor: v.author_name,
            criadaEm: v.created_at,
            principal: v.id === p.primary_version_id ? true : null,
          })
        ),
      })),

      musicasLancadas: lista(faixas, (f) => ({
        titulo: f.title,
        situacao: f.status,
        genero: f.genre,
        lancamento: f.release_date,
        isrc: f.isrc,
        upc: f.upc,
        duracao: f.duration,
        letra: f.lyrics,
        divisaoDeComposicao: f.composition_splits,
        divisaoDeGravacao: f.recording_splits,
      })),

      agenda: lista(eventos, (e) => ({
        titulo: e.title,
        tipo: e.type,
        data: e.date,
        inicio: e.start_time,
        fim: e.end_time,
        local: e.location,
        descricao: e.description,
        situacao: e.status,
      })),

      planejamentoEstrategico: lista(planos, (p) => ({
        titulo: p.title,
        segmento: p.segment,
        estagioDaCarreira: p.career_stage,
        resumo: p.context_summary,
        objetivos: p.objectives,
        estrategias: p.strategies,
        indicadores: p.kpis,
        cronograma: p.timeline,
        conteudo: p.full_content,
        situacao: p.status,
        criadoEm: p.created_at,
      })),

      equipe: lista(membros, (m) => ({
        nome: m.name,
        email: m.email,
        acessos: m.access_levels,
        situacao: m.status,
        convidadoEm: m.created_at,
      })),

      conversasComANyta: lista(conversas, (c) => ({
        titulo: c.title,
        criadaEm: c.created_at,
        mensagens: lista(
          mensagens.filter((m: Row) => m.conversation_id === c.id),
          (m) => ({ autor: m.role === "user" ? "você" : "Nyta", texto: m.content, em: m.created_at })
        ),
      })),

      notificacoes: lista(notificacoes, (n) => ({
        titulo: n.title,
        mensagem: n.message,
        lida: n.read,
        em: n.created_at,
      })),

      financeiro: limpo({
        // Sem ids da instituição de pagamento: identificam a cobrança no sistema dela, não a pessoa.
        compras: lista(compras, (c) => ({
          perfil: c.artist_name,
          valor: c.amount,
          formaDePagamento: c.billing_type,
          situacao: c.status,
          pagoEm: c.paid_at,
          cupom: c.coupon_code,
          desconto: c.discount_amount,
          enderecoDeCobranca: limpo({
            cep: c.cep, logradouro: c.address, bairro: c.province, cidade: c.city, uf: c.uf,
          }),
        })),
        assinatura: assinatura
          ? limpo({
              situacao: assinatura.status,
              plano: assinatura.plan_type,
              inicioDoPeriodo: assinatura.current_period_start,
              fimDoPeriodo: assinatura.current_period_end,
              mensalidade: assinatura.total_monthly,
              perfisContratados: assinatura.profile_count,
              membrosContratados: assinatura.member_count,
              canceladaEm: assinatura.canceled_at,
            })
          : null,
      }),

      avaliacoes: lista(avaliacoes, (a) => ({
        nota: a.rating,
        comentario: a.comment,
        em: a.created_at,
      })),
    });
  } catch (e) {
    console.error("[account-data-export]", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
