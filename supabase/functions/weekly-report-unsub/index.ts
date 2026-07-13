// Descadastro público do resumo semanal. Aberto (verify_jwt=false): o link vem do rodapé do e-mail
// e é aberto direto do cliente de e-mail, sem sessão. Recebe ?token=<unsub_token>, seta
// email_preferences.weekly_report=false na linha correspondente e devolve uma página de confirmação.
//
// O token é um uuid aleatório (não sequencial/adivinhável), único por usuário — funciona como a chave
// de "one-click unsubscribe". Não expõe e-mail nem id do usuário.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey, x-client-info",
};

// Página de confirmação (mesma linguagem visual dark dos e-mails Maestra).
function page(title: string, message: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0b0b0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e8e8e8;">
  <div style="max-width:480px;margin:0 auto;padding:64px 24px;text-align:center;">
    <div style="font-size:20px;letter-spacing:.5px;color:#BE81EC;margin-bottom:32px;"><span style="font-weight:800;">Maestra</span> <span style="font-weight:400;">Manager</span></div>
    <h1 style="font-size:22px;line-height:1.3;color:#fff;margin:0 0 12px;">${title}</h1>
    <p style="color:#cfcfd4;line-height:1.6;margin:0;">${message}</p>
  </div>
</body></html>`;
}
const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return html(page("Link inválido", "Este link de descadastro está incompleto. Abra o link direto do e-mail que você recebeu."), 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    const { data, error } = await admin.from("email_preferences")
      .update({ weekly_report: false, updated_at: new Date().toISOString() })
      .eq("unsub_token", token).select("user_id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return html(page("Link inválido", "Não encontramos esse cadastro. O link pode ter expirado ou já ter sido usado."), 404);
    }
    return html(page("Pronto, descadastrado", "Você não vai mais receber o resumo semanal por e-mail. Pode fechar esta página. Se mudar de ideia, ajuste isso nas configurações da sua conta."));
  } catch (e) {
    console.error("[weekly-unsub] erro:", (e as Error)?.message);
    return html(page("Algo deu errado", "Não conseguimos processar seu descadastro agora. Tente de novo em alguns minutos."), 500);
  }
});
