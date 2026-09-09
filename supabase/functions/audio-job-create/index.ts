import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Enfileira uma análise de áudio.
//
// É a ÚNICA porta de entrada da fila: `audio_jobs` não tem policy de INSERT, e o cliente não
// escreve lá. Aqui é onde se confere permissão e cota — as duas coisas que não podem morar no
// aparelho de quem pede, porque o aparelho é de quem pede.
//
// A permissão não é reimplementada: a versão é lida com o token de QUEM PEDIU, e a RLS do
// catálogo decide. Se a linha volta, tem acesso.
//
// ─── Acordar o worker ────────────────────────────────────────────────────────
//
// Se a variável AUDIO_WORKER_URL existir, esta função dá um toque no worker para ele acordar.
// Se não existir, o trabalho fica na fila e é processado quando houver worker — que é
// exatamente o estado enquanto a máquina não está no ar. Nada aqui falha por causa disso: a
// fila é o contrato, o worker é um detalhe de quem a consome.
//
// Body: { versionId: string, tipo: 'bpm_tom' | 'letra' | 'sensorial' }
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//          AUDIO_WORKER_URL e AUDIO_WORKER_KEY (opcionais).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BALDE = "catalog";

/** Os tipos que já têm quem os execute. `converter` entra quando a conversão for construída. */
const TIPOS = ["bpm_tom", "letra", "sensorial"];

/**
 * Quantas análises um artista sem PRO pode pedir por mês.
 *
 * Análise custa CPU de verdade, e dez faixas grátis vezes reprocessamento ilimitado é uma conta
 * de luz de alguém. O número acompanha o limite de faixas do plano grátis, que é dez: quem tem
 * dez músicas consegue analisar cada uma uma vez por mês sem esbarrar.
 */
const LIMITE_MENSAL_SEM_PRO = 10;

/** O caminho dentro do balde, tirado da URL pública. Igual ao da `version-certify`. */
export const caminhoNoBalde = (url: string): string | null => {
  const marca = `/storage/v1/object/public/${BALDE}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const caminho = decodeURIComponent(url.slice(i + marca.length)).split("?")[0];
  return caminho && !caminho.includes("..") ? caminho : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const comOToken = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // O token vai como ARGUMENTO: sem ele o `getUser` procura uma sessão guardada, que numa
    // edge function não existe, e devolve "Auth session missing!". Ver `version-certify`.
    const { data: { user }, error: erroDoUsuario } = await comOToken.auth.getUser(
      authHeader.replace("Bearer ", "").trim(),
    );
    if (erroDoUsuario || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const versionId = String(body?.versionId || "").trim();
    const tipo = String(body?.tipo || "").trim();
    if (!versionId) return json({ error: "Informe a versão." }, 400);
    if (!TIPOS.includes(tipo)) return json({ error: "Esse tipo de análise não existe." }, 400);

    // Pela RLS: se esta linha volta, esta pessoa tem acesso a esta versão.
    const { data: versao, error: erroDaVersao } = await comOToken
      .from("catalog_versions")
      .select(
        "id, audio_file, audio_file_name,"
        + " projeto:catalog_projects!catalog_versions_project_id_fkey(id, artist_id)",
      )
      .eq("id", versionId)
      .maybeSingle();
    if (erroDaVersao) throw erroDaVersao;
    if (!versao) return json({ error: "Versão não encontrada." }, 404);

    const projeto = (Array.isArray(versao.projeto) ? versao.projeto[0] : versao.projeto) as
      | { id: string; artist_id: string }
      | undefined;
    if (!projeto?.artist_id) return json({ error: "Versão sem música associada." }, 409);

    if (!versao.audio_file) {
      return json({ error: "Esta versão ainda não tem áudio para analisar." }, 400);
    }
    const caminho = caminhoNoBalde(versao.audio_file);
    if (!caminho) {
      return json({ error: "O áudio desta versão não está no armazenamento da Maestra." }, 400);
    }

    const servico = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ─── Cota ────────────────────────────────────────────────────────────────
    //
    // ⚠️ A cota é do DONO DO ARTISTA, e não de quem está a pedir.
    //
    // Ela conta trabalhos por `artist_id`, então tem de ser o plano daquele artista a decidir.
    // Olhar a assinatura de quem pede daria as duas leituras erradas ao mesmo tempo: um
    // colaborador sem PRO ficaria travado num artista PRO, e um colaborador com PRO abriria
    // análises ilimitadas num artista que não paga por elas.
    const { data: dono } = await servico
      .from("artists").select("user_id").eq("id", projeto.artist_id).maybeSingle();

    const { data: assinatura } = await servico
      .from("asaas_subscriptions")
      .select("status, grace_period_ends_at")
      .eq("user_id", dono?.user_id ?? user.id)
      .maybeSingle();

    // Mesma regra do `deriveEntitlements` do núcleo: em atraso ainda é PRO enquanto a carência
    // não vence. Quem está a resolver um pagamento não perde a ferramenta no meio do caminho.
    const ehPro = assinatura?.status === "active"
      || (assinatura?.status === "overdue"
        && !!assinatura.grace_period_ends_at
        && Date.now() <= new Date(assinatura.grace_period_ends_at).getTime());

    if (!ehPro) {
      const inicioDoMes = new Date();
      inicioDoMes.setUTCDate(1);
      inicioDoMes.setUTCHours(0, 0, 0, 0);
      const { count } = await servico
        .from("audio_jobs")
        .select("id", { count: "exact", head: true })
        .eq("artist_id", projeto.artist_id)
        .eq("estado", "pronto")
        .gte("criado_em", inicioDoMes.toISOString());
      if ((count ?? 0) >= LIMITE_MENSAL_SEM_PRO) {
        return json({
          error: `Você já usou as ${LIMITE_MENSAL_SEM_PRO} análises deste mês. `
            + "Com o Maestra Pro elas não têm limite.",
          semCota: true,
        }, 402);
      }
    }

    const { data: criado, error: erroAoInserir } = await servico
      .from("audio_jobs")
      .insert({
        artist_id: projeto.artist_id,
        version_id: versionId,
        pedido_por: user.id,
        tipo,
        entrada: { balde: BALDE, caminho, nome: versao.audio_file_name },
      })
      .select("*")
      .single();

    if (erroAoInserir) {
      // 23505 é o índice que impede duas análises iguais da mesma versão ao mesmo tempo. Não é
      // erro do ponto de vista de quem pediu: é o toque repetido no botão, e a resposta certa é
      // devolver o trabalho que já está a andar em vez de uma mensagem vermelha.
      if ((erroAoInserir as { code?: string }).code === "23505") {
        const { data: emCurso } = await servico
          .from("audio_jobs").select("*")
          .eq("version_id", versionId).eq("tipo", tipo)
          .in("estado", ["na_fila", "a_correr"])
          .maybeSingle();
        if (emCurso) return json({ trabalho: emCurso, novo: false });
      }
      throw erroAoInserir;
    }

    // O toque no worker é o que tira a máquina do sono. Se falhar, o cron de resgate apanha o
    // trabalho mais tarde — por isso o erro é registrado e engolido, e não devolvido a quem
    // pediu: o pedido dele entrou na fila, que é o que ele precisa saber.
    const urlDoWorker = Deno.env.get("AUDIO_WORKER_URL");
    if (urlDoWorker) {
      try {
        await fetch(`${urlDoWorker.replace(/\/$/, "")}/acordar`, {
          method: "POST",
          headers: { "x-worker-key": Deno.env.get("AUDIO_WORKER_KEY") ?? "" },
        });
      } catch (e) {
        console.error("[audio-job-create] não consegui acordar o worker", (e as Error)?.message);
      }
    }

    return json({ trabalho: criado, novo: true });
  } catch (e) {
    console.error("[audio-job-create]", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
