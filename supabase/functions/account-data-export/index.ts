import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Portabilidade e acesso aos próprios dados — LGPD art. 18, II e V.
//
// Devolve um JSON com tudo que a plataforma guarda sobre quem chama. Roda com service role
// porque precisa atravessar várias tabelas de uma vez, mas TODA consulta é filtrada pelo id de
// quem pediu: o usuário do JWT, nunca um id vindo do corpo da requisição.
//
// Body: {} — não recebe parâmetros de propósito. Aceitar um userId seria criar uma rota para
// baixar os dados dos outros.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    // Perfis do próprio usuário. Tudo que é por artista sai daqui — inclusive o recorte de
    // "quais artistas" —, então nada de outro dono entra no pacote.
    const { data: artists } = await db.from("artists").select("*").eq("user_id", user.id);
    const artistIds = (artists || []).map((a: { id: string }) => a.id);

    const porArtista = async (tabela: string, coluna = "artist_id") => {
      if (!artistIds.length) return [];
      const { data } = await db.from(tabela).select("*").in(coluna, artistIds);
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
      porArtista("strategic_plans"),
      porArtista("artist_members"),
      porUsuario("artist_purchases"),
      porUsuario("nyta_conversations"),
      porUsuario("notifications"),
      porUsuario("user_subscriptions"),
      porUsuario("platform_reviews"),
      porUsuario("user_consents"),
      db.from("user_compliance").select("*").eq("user_id", user.id).maybeSingle().then((r) => r.data),
    ]);

    // Versões e mensagens penduram em projeto/conversa, não no artista: precisam do id do pai.
    const projetoIds = projetos.map((p: { id: string }) => p.id);
    const conversaIds = conversas.map((c: { id: string }) => c.id);
    const [versoes, mensagens] = await Promise.all([
      projetoIds.length
        ? db.from("catalog_versions").select("*").in("project_id", projetoIds).then((r) => r.data || [])
        : Promise.resolve([]),
      conversaIds.length
        ? db.from("nyta_messages").select("*").in("conversation_id", conversaIds).then((r) => r.data || [])
        : Promise.resolve([]),
    ]);

    return json({
      geradoEm: new Date().toISOString(),
      aviso: "Extrato dos dados pessoais tratados pela Maestra, nos termos do art. 18 da LGPD.",
      conta: {
        id: user.id,
        email: user.email,
        nome: user.user_metadata?.full_name || user.user_metadata?.name || null,
        criadaEm: user.created_at,
        ultimoAcesso: user.last_sign_in_at,
        provedores: user.app_metadata?.providers ?? null,
      },
      conformidade,
      consentimentos,
      artistas: artists || [],
      catalogo: { projetos, versoes, faixas },
      agenda: eventos,
      planejamento: planos,
      equipe: membros,
      nyta: { conversas, mensagens },
      notificacoes,
      financeiro: { compras, assinaturas },
      avaliacoes,
    });
  } catch (e) {
    console.error("[account-data-export]", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
