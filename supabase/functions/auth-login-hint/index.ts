import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// Diz ao login se a falha foi por e-mail não confirmado.
//
// O Supabase devolve `invalid_credentials` para três situações diferentes — senha errada, conta
// não confirmada e conta criada pelo Google (que não tem senha) — de propósito, para não revelar
// quais e-mails existem. O efeito colateral é que quem se cadastrou e não confirmou ficava sem
// caminho de volta: o app não tinha como saber que aquela pessoa precisava da tela do código.
//
// Esta função responde UMA pergunta: "o par e-mail/senha está correto E falta confirmar?".
// Qualquer outro caso devolve `false`, igual a um e-mail inexistente — então continua não sendo
// possível descobrir quem tem cadastro.
//
// Body: { email, password }  →  { needsConfirmation: boolean }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Teto por IP. A função separa senha certa de errada em contas pendentes — informação que o
// Supabase não dava —, então a força bruta precisa esbarrar em alguma coisa.
const JANELA_MINUTOS = 15;
const MAX_TENTATIVAS = 10;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const { email, password } = await req.json().catch(() => ({}));
    // Resposta neutra para entrada inválida: nada de mensagens que ajudem a sondar.
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return json({ needsConfirmation: false });
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const ip = (req.headers.get("x-forwarded-for") || "desconhecido").split(",")[0].trim();
    const desde = new Date(Date.now() - JANELA_MINUTOS * 60_000).toISOString();

    const { count } = await db
      .from("auth_hint_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("attempted_at", desde);

    if ((count ?? 0) >= MAX_TENTATIVAS) {
      // 200 com `false`, e não 429: um código de erro distinto já seria sinal de que vale insistir
      // naquele e-mail. Para quem chama, fica igual a "não é caso de confirmação".
      return json({ needsConfirmation: false });
    }

    await db.from("auth_hint_attempts").insert({ ip });
    // Poda barata, na própria chamada: a tabela não tem valor histórico e ninguém a consulta.
    await db.from("auth_hint_attempts").delete().lt("attempted_at", new Date(Date.now() - 3600_000).toISOString());

    const { data, error } = await db.rpc("fn_login_precisa_confirmar", {
      p_email: email,
      p_password: password,
    });
    if (error) throw error;

    return json({ needsConfirmation: data === true });
  } catch (e) {
    console.error("[auth-login-hint]", e);
    // Falha vira "não é caso de confirmação": o login segue mostrando o erro comum, que é o
    // comportamento de antes desta função existir.
    return json({ needsConfirmation: false });
  }
});
