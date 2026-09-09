import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Certificado de autoria de uma versão do catálogo.
//
// Calcula o SHA-256 do arquivo de áudio que está no Storage e grava o carimbo em
// `version_certificates`. Responde a uma pergunta só: "esta gravação já existia nesta data,
// exatamente assim".
//
// ─── Por que o hash é calculado AQUI ──────────────────────────────────────────
//
// Um hash que o cliente mandasse pronto não certificaria nada: quem carimba seria quem é
// carimbado, e forjar o carimbo seria uma linha no DevTools. O servidor lê o arquivo do próprio
// balde e calcula. Por isso `version_certificates` não tem policy de INSERT — esta função, com o
// service role, é o único caminho de escrita.
//
// ─── Quem pode ───────────────────────────────────────────────────────────────
//
// A leitura da versão é feita com o token de QUEM PEDIU, e não com o service role: assim a
// própria RLS do catálogo decide se aquela pessoa enxerga aquela versão. Se a linha volta, tem
// acesso; se não volta, não tem. Repetir a regra de permissão aqui dentro seria uma segunda
// cópia dela, que envelhece sozinha.
//
// Body: { versionId: string }
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.

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

/** O balde onde vivem os áudios das versões. Mesmo nome do `BALDE_DO_CATALOGO` do núcleo. */
const BALDE = "catalog";

/**
 * O arquivo inteiro entra na memória para ser somado.
 *
 * O `crypto.subtle.digest` do Deno recebe um buffer, não um fluxo, e trocar isso por uma soma
 * incremental exigiria uma dependência a mais para resolver um problema que este balde não tem:
 * ele só aceita MP3 e WAV de música, e uma música não chega perto disto. O limite existe para o
 * caso estranho não derrubar a função sem explicação.
 */
const TETO_DE_BYTES = 200 * 1024 * 1024;

/**
 * O caminho dentro do balde, tirado da URL pública.
 *
 * A URL guardada em `catalog_versions.audio_file` é a que o `getPublicUrl` devolveu no envio:
 * `…/storage/v1/object/public/catalog/<pasta>/<arquivo>`. Baixar pelo caminho, e não pela URL,
 * é o que garante que estamos a ler o NOSSO arquivo: uma URL de outro lugar apontaria para um
 * arquivo que ninguém controla, e certificar isso seria carimbar o que o cliente escolhesse.
 */
export const caminhoNoBalde = (url: string): string | null => {
  const marca = `/storage/v1/object/public/${BALDE}/`;
  const i = url.indexOf(marca);
  if (i === -1) return null;
  const caminho = decodeURIComponent(url.slice(i + marca.length)).split("?")[0];
  // `..` sairia do balde. Não deveria acontecer com URL nossa, mas o custo de conferir é zero.
  return caminho && !caminho.includes("..") ? caminho : null;
};

/** Os bytes em hexadecimal minúsculo, que é a forma em que um hash se lê e se compara. */
export const emHexa = (bytes: ArrayBuffer): string =>
  Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
    const { data: { user }, error: erroDoUsuario } = await comOToken.auth.getUser();
    if (erroDoUsuario || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json().catch(() => ({}));
    const versionId = String(body?.versionId || "").trim();
    if (!versionId) return json({ error: "Informe a versão." }, 400);

    // Pela RLS: se esta linha volta, esta pessoa tem acesso a esta versão.
    //
    // O projeto vem junto porque o certificado guarda o nome da música e o artista POR CÓPIA —
    // é o que o mantém legível depois de a versão ser apagada, e o que impede que renomear a
    // faixa mude, retroativamente, o que um documento já emitido diz.
    const { data: versao, error: erroDaVersao } = await comOToken
      .from("catalog_versions")
      .select(
        "id, title, version_number, audio_file, audio_file_name, author_name,"
        + " projeto:catalog_projects!catalog_versions_project_id_fkey(id, artist_id, title)",
      )
      .eq("id", versionId)
      .maybeSingle();
    if (erroDaVersao) throw erroDaVersao;
    if (!versao) return json({ error: "Versão não encontrada." }, 404);

    // O PostgREST devolve o vínculo como objeto ou como lista de um, conforme deduza a
    // cardinalidade. Aceitar os dois evita um `undefined` que só apareceria em produção.
    const projeto = (Array.isArray(versao.projeto) ? versao.projeto[0] : versao.projeto) as
      | { id: string; artist_id: string; title: string }
      | undefined;
    if (!projeto?.artist_id) return json({ error: "Versão sem música associada." }, 409);

    if (!versao.audio_file) {
      return json({ error: "Esta versão ainda não tem áudio para certificar." }, 400);
    }

    const caminho = caminhoNoBalde(versao.audio_file);
    if (!caminho) {
      return json({ error: "O áudio desta versão não está no armazenamento da Maestra." }, 400);
    }

    const servico = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: artista } = await servico
      .from("artists").select("name").eq("id", projeto.artist_id).maybeSingle();

    const { data: arquivo, error: erroDoArquivo } = await servico.storage.from(BALDE).download(caminho);
    if (erroDoArquivo || !arquivo) {
      return json({ error: "Não consegui ler o áudio desta versão." }, 502);
    }
    if (arquivo.size > TETO_DE_BYTES) {
      return json({ error: "Este arquivo é grande demais para certificar." }, 413);
    }

    const bytes = await arquivo.arrayBuffer();
    const sha256 = emHexa(await crypto.subtle.digest("SHA-256", bytes));

    // O nome de quem declara a autoria sai do `user_metadata`, que é onde o nome mora nesta base
    // — não há tabela de perfis do usuário. Com o autor da versão como segunda opção, e o e-mail
    // como última: um certificado sem nome não certifica nada, então nunca fica vazio.
    const autorNome =
      String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim() ||
      (versao.author_name as string | null)?.trim() ||
      user.email ||
      "Autor não identificado";

    // Certificar duas vezes o MESMO arquivo devolve o carimbo que já existe, com a data original.
    // Emitir um segundo com data de hoje enfraqueceria o primeiro, que é justamente o que prova
    // que a gravação é mais antiga.
    const { data: jaExiste } = await servico
      .from("version_certificates")
      .select("*")
      .eq("version_id", versionId)
      .eq("sha256", sha256)
      .maybeSingle();
    if (jaExiste) return json({ certificado: jaExiste, novo: false });

    const { data: criado, error: erroAoGravar } = await servico
      .from("version_certificates")
      .insert({
        artist_id: projeto.artist_id,
        version_id: versionId,
        artista: (artista?.name as string | null)?.trim() || "Artista",
        musica: projeto.title || "Sem título",
        // Uma versão pode não ter título; o número dela sempre existe e é como a equipe a chama.
        versao: (versao.title as string | null)?.trim() || `V${versao.version_number}`,
        sha256,
        algoritmo: "sha-256",
        arquivo_url: versao.audio_file,
        arquivo_nome: versao.audio_file_name,
        arquivo_bytes: arquivo.size,
        autor_id: user.id,
        autor_nome: autorNome,
      })
      .select("*")
      .single();
    if (erroAoGravar) throw erroAoGravar;

    return json({ certificado: criado, novo: true });
  } catch (e) {
    console.error("[version-certify]", e);
    return json({ error: (e as Error)?.message || "Erro inesperado" }, 500);
  }
});
