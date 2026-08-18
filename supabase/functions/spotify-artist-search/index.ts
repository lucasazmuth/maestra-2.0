import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Proxy da busca de artistas no Spotify.
//
// POR QUE ISTO EXISTE: o limite do Spotify é POR APLICATIVO numa janela de 30s, e a Maestra usa
// client_credentials — todos os usuários dividem a MESMA cota. A busca saía direto do navegador
// de cada pessoa, então N usuários digitando eram N conexões independentes brigando pelo mesmo
// balde, sem coordenação nem cache entre elas. Num lançamento nacional isso vira 429 em massa.
//
// O que este proxy resolve:
//   1. CACHE COMPARTILHADO  — o segundo usuário que buscar o mesmo termo custa zero ao Spotify.
//   2. RITMO GLOBAL         — um só ponto sabe quantas chamadas estão em voo e segura o excesso,
//                             em vez de cada navegador descobrir o 429 por conta própria.
//   3. DEGRADAÇÃO SUAVE     — se o Spotify recusar, responde com cache vencido em vez de erro.
//   4. TOKEN NO SERVIDOR    — o access token deixa de ser entregue ao navegador (hoje ele fica
//                             no localStorage, ver src/lib/spotifyToken.ts).
//
// Secrets necessários: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
// Ver docs/RISCO-SPOTIFY-ESCALA.md.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Quanto tempo uma entrada é considerada fresca. Busca de artista não muda de minuto a minuto
// (nome e foto são estáveis; seguidores variam devagar), então 24h é seguro e maximiza o alívio
// da cota. Entradas mais velhas ainda servem de rede de segurança quando o Spotify falha.
const CACHE_FRESCO_MS = 24 * 60 * 60 * 1000;

// Teto de chamadas simultâneas ao Spotify a partir desta instância. O gargalo é a cota por app,
// não a CPU: segurar aqui é melhor do que levar 429 e ter que reprocessar.
const MAX_EM_VOO = 4;
let emVoo = 0;
const fila: Array<() => void> = [];

const pegarVaga = () =>
  new Promise<void>((resolve) => {
    if (emVoo < MAX_EM_VOO) {
      emVoo++;
      resolve();
    } else {
      fila.push(() => {
        emVoo++;
        resolve();
      });
    }
  });

const liberarVaga = () => {
  emVoo = Math.max(0, emVoo - 1);
  fila.shift()?.();
};

// Token app-only, cacheado em memória enquanto a instância viver.
let tokenCache: { token: string; exp: number } | null = null;

async function getAppToken(): Promise<string | null> {
  const agora = Date.now();
  if (tokenCache && tokenCache.exp > agora + 60_000) return tokenCache.token;

  const clientId = Deno.env.get("SPOTIFY_CLIENT_ID");
  const clientSecret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;

  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache = { token: data.access_token, exp: agora + expiresIn * 1000 };
  return tokenCache.token;
}

// Formato que o frontend consome (SpotifyArtistSearchResult). O mapeamento vive aqui, no servidor,
// para o navegador receber só o necessário em vez do payload cru do Spotify.
interface Resultado {
  id: string;
  name: string;
  image?: string;
  followers?: number;
  genres?: string[];
}

const mapear = (payload: any): Resultado[] =>
  (payload?.artists?.items || []).map((a: any) => ({
    id: a.id,
    name: a.name,
    image: a.images?.[a.images.length - 1]?.url || a.images?.[0]?.url,
    followers: a.followers?.total,
    genres: a.genres,
  }));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { q } = await req.json().catch(() => ({ q: "" }));
    // Mesma regra do frontend: abaixo de 3 caracteres o resultado é inútil e só gasta cota.
    const termo = String(q || "").trim().toLowerCase();
    if (termo.length < 3) return json({ results: [], source: "curto" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1. Cache. Guardamos a entrada vencida para usar como rede de segurança se o Spotify falhar.
    let vencido: Resultado[] | null = null;
    const { data: linha } = await supabase
      .from("spotify_search_cache")
      .select("results, fetched_at")
      .eq("query", termo)
      .maybeSingle();

    if (linha) {
      const idade = Date.now() - new Date(linha.fetched_at).getTime();
      if (idade < CACHE_FRESCO_MS) return json({ results: linha.results, source: "cache" });
      vencido = linha.results as Resultado[];
    }

    // 2. Sem cache fresco: fala com o Spotify, respeitando o teto de chamadas simultâneas.
    const token = await getAppToken();
    if (!token) {
      // Sem token não há o que fazer, mas cache vencido é melhor que erro na cara do usuário.
      if (vencido) return json({ results: vencido, source: "cache-vencido" });
      return json({ error: "spotify_indisponivel" }, 503);
    }

    await pegarVaga();
    let resp: Response;
    try {
      resp = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(termo)}&type=artist&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } finally {
      liberarVaga();
    }

    if (!resp.ok) {
      // 401: token velho (ex.: secret rotacionado). Descarta e deixa a próxima chamada renovar.
      if (resp.status === 401) tokenCache = null;
      console.error(`[spotify-artist-search] Spotify ${resp.status} para "${termo}"`);
      // Cache vencido salva a experiência quando o Spotify está fora (429, 403 de Premium, 502).
      if (vencido) return json({ results: vencido, source: "cache-vencido" });
      // Repassa o status para o frontend distinguir bloqueio (403) de instabilidade.
      return json({ error: "spotify_indisponivel", status: resp.status }, resp.status);
    }

    const results = mapear(await resp.json());

    // 3. Grava no cache. Falha aqui não pode derrubar a resposta — o usuário já tem o resultado.
    supabase
      .from("spotify_search_cache")
      .upsert({ query: termo, results, fetched_at: new Date().toISOString() }, { onConflict: "query" })
      .then(({ error }) => {
        if (error) console.error("[spotify-artist-search] falha ao gravar cache:", error.message);
      });

    return json({ results, source: "spotify" });
  } catch (e) {
    console.error("[spotify-artist-search] erro inesperado:", e);
    return json({ error: "erro_interno" }, 500);
  }
});
