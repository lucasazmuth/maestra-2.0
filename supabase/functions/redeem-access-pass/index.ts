import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Resgate do Pass Access: código de uso único que libera o perfil sem cobrança.
// Usado quando a professora presenteia um aluno — antes ela pagava com o CPF dela,
// o que emitia cobrança no nome errado e juntava vários usuários no mesmo cliente Asaas.
//
// O uso único é garantido pelo BANCO, não por leitura prévia: o UPDATE condicionado a
// `redeemed_at is null` só afeta linha em uma das requisições concorrentes. Conferir antes
// com um SELECT deixaria janela pra dois resgates simultâneos passarem com o mesmo código.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Resposta única para código inexistente, já usado, expirado ou revogado: distinguir
// esses casos deixaria enumerar códigos válidos. A entropia do código (~59 bits) é o que
// torna a tentativa por força bruta inviável.
const INVALID = "Código inválido ou já utilizado.";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { code, artistId } = body;
    if (!code || typeof code !== "string") return json({ error: "Informe o código.", field: "code" }, 400);
    if (!artistId || typeof artistId !== "string") return json({ error: "artistId é obrigatório", field: "artistId" }, 400);

    // Normaliza: os códigos são gerados em maiúsculas e sem hífen no banco.
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length < 8) return json({ error: INVALID, field: "code" }, 404);

    // O perfil precisa existir, ser do usuário e ainda estar bloqueado. Validar ANTES do
    // resgate evita queimar um código válido num perfil que não podia recebê-lo.
    const { data: artist, error: artistError } = await supabaseAdmin
      .from("artists")
      .select("id, user_id, is_locked")
      .eq("id", artistId)
      .maybeSingle();

    if (artistError) return json({ error: "Erro interno" }, 500);
    if (!artist || artist.user_id !== user.id) return json({ error: "Perfil não encontrado" }, 403);
    if (artist.is_locked === false) return json({ error: "Este perfil já está ativo." }, 409);

    // Resgate atômico: só uma requisição consegue marcar a linha. As condições de validade
    // entram no próprio WHERE — um código expirado ou revogado simplesmente não casa.
    const nowIso = new Date().toISOString();
    const { data: redeemed, error: redeemError } = await supabaseAdmin
      .from("access_passes")
      .update({ redeemed_by: user.id, redeemed_at: nowIso, redeemed_artist_id: artistId })
      .eq("code", normalized)
      .is("redeemed_at", null)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .select()
      .maybeSingle();

    if (redeemError) {
      console.error("Erro ao resgatar pass:", redeemError);
      return json({ error: "Erro interno" }, 500);
    }
    if (!redeemed) return json({ error: INVALID, field: "code" }, 404);

    // Desbloqueio antes do registro: é o efeito que o usuário veio buscar. Se falhar,
    // devolve o código pro estoque — nada foi entregue, então ele não pode ser consumido.
    const { error: unlockError } = await supabaseAdmin
      .from("artists")
      .update({ is_locked: false, purchased_at: nowIso })
      .eq("id", artistId);

    if (unlockError) {
      console.error("Erro ao desbloquear artista via pass:", unlockError);
      await supabaseAdmin
        .from("access_passes")
        .update({ redeemed_by: null, redeemed_at: null, redeemed_artist_id: null })
        .eq("id", redeemed.id);
      return json({ error: "Não foi possível liberar o perfil agora." }, 500);
    }

    // Compra de valor 0 para o relatório financeiro não confundir presente com venda.
    // Puramente auditoria: se falhar, o perfil já está liberado e o código corretamente
    // consumido, então loga e segue — devolver o código aqui liberaria um 2º desbloqueio.
    const { error: purchaseError } = await supabaseAdmin.from("artist_purchases").insert({
      user_id: user.id,
      artist_id: artistId,
      amount: 0,
      billing_type: "ACCESS_PASS",
      status: "received",
      paid_at: nowIso,
    });

    if (purchaseError) {
      console.error(`Pass ${redeemed.id} liberou o perfil ${artistId} mas o registro da compra falhou:`, purchaseError);
    }

    console.log(`Access pass resgatado: pass=${redeemed.id}, user=${user.id}, artist=${artistId}`);
    return json({ ok: true, artistId });
  } catch (err) {
    console.error("Unexpected error in redeem handler:", (err as { message?: string })?.message);
    return json({ error: "Erro interno" }, 500);
  }
});
