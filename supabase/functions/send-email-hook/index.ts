// Handler do Auth Hook "Send Email" do Supabase. Em vez de o Supabase mandar os e-mails de auth
// pelos templates dele, ele POSTa aqui (assinado, padrão Standard Webhooks) e NÓS enviamos via Brevo.
//
// Tipos (email_action_type): signup, email (OTP genérico), recovery, magiclink, email_change, invite.
// Para "signup" mandamos o CÓDIGO de 6 dígitos (email_data.token) — o app confirma com verifyOtp.
//
// Painel: Auth → Hooks → "Send Email" → habilitar e apontar para esta função.
// Secrets: SEND_EMAIL_HOOK_SECRET (gerado pelo Supabase ao criar o hook), BREVO_API_KEY, BREVO_SENDER.

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { sendBrevoEmail, emailLayout, otpBlock } from "./brevo.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to?: string;
  email_action_type: string;
  site_url?: string;
}

// Link de verificação padrão do Supabase (para fluxos por link, ex.: recuperação de senha).
function verifyLink(d: EmailData): string {
  const params = new URLSearchParams({ token: d.token_hash, type: d.email_action_type });
  if (d.redirect_to) params.set("redirect_to", d.redirect_to);
  return `${SUPABASE_URL}/auth/v1/verify?${params.toString()}`;
}

function buildEmail(d: EmailData, name: string): { subject: string; html: string } {
  const hi = name ? `Olá, ${name}!` : "Olá!";
  const code = d.token;
  switch (d.email_action_type) {
    case "recovery": {
      // Senha: fluxo por link (a tela de redefinição lê o token da URL).
      const link = verifyLink(d);
      return {
        subject: "Redefinição de senha — Maestra Manager",
        html: emailLayout({
          title: "Redefinir sua senha",
          bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${hi} Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo:</p>
          <p style="margin:20px 0;"><a href="${link}" style="display:inline-block;background:#af2896;color:#fff;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:9999px;">Redefinir senha</a></p>
          <p style="color:#8a8a92;font-size:13px;">Se você não pediu isso, pode ignorar este e-mail.</p>`,
        }),
      };
    }
    case "invite":
      return {
        subject: "Você foi convidado para a Maestra Manager",
        html: emailLayout({
          title: "Você recebeu um convite",
          bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${hi} Use o código abaixo para concluir seu acesso à Maestra Manager:</p>${otpBlock(code)}
          <p style="color:#8a8a92;font-size:13px;">O código expira em alguns minutos.</p>`,
        }),
      };
    case "email_change":
      return {
        subject: "Confirme seu novo e-mail — Maestra Manager",
        html: emailLayout({
          title: "Confirme a troca de e-mail",
          bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${hi} Use o código abaixo para confirmar seu novo e-mail:</p>${otpBlock(code)}`,
        }),
      };
    case "magiclink":
      return {
        subject: "Seu código de acesso — Maestra Manager",
        html: emailLayout({
          title: "Acesse sua conta",
          bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${hi} Use o código abaixo para entrar:</p>${otpBlock(code)}`,
        }),
      };
    case "signup":
    case "email":
    default:
      // Cadastro / confirmação de e-mail: CÓDIGO de 6 dígitos.
      return {
        subject: "Seu código de verificação — Maestra Manager",
        html: emailLayout({
          title: "Confirme seu e-mail",
          bodyHtml: `<p style="color:#cfcfd4;line-height:1.6;">${hi} Bem-vindo(a)! Use o código abaixo para confirmar seu e-mail e ativar sua conta:</p>${otpBlock(code)}
          <p style="color:#8a8a92;font-size:13px;">O código expira em alguns minutos. Se não foi você, ignore este e-mail.</p>`,
        }),
      };
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") || "";
  if (!rawSecret) {
    console.error("[send-email-hook] SEND_EMAIL_HOOK_SECRET ausente");
    return new Response(JSON.stringify({ error: { http_code: 500, message: "hook secret missing" } }), { status: 500, headers: { "content-type": "application/json" } });
  }
  // O Supabase entrega o secret como "v1,whsec_<base64>"; a lib Standard Webhooks quer só o base64.
  const secret = rawSecret.replace(/^v1,whsec_/, "");

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let data: { user: { email: string; user_metadata?: { full_name?: string } }; email_data: EmailData };
  try {
    const wh = new Webhook(secret);
    data = wh.verify(payload, headers) as typeof data;
  } catch (e) {
    console.error("[send-email-hook] assinatura inválida:", (e as Error)?.message);
    return new Response(JSON.stringify({ error: { http_code: 401, message: "invalid signature" } }), { status: 401, headers: { "content-type": "application/json" } });
  }

  const name = data.user.user_metadata?.full_name || "";
  const { subject, html } = buildEmail(data.email_data, name);
  const res = await sendBrevoEmail({ to: data.user.email, toName: name || undefined, subject, html });

  if (!res.ok) {
    // Retornar erro faz o Supabase registrar a falha (e não marcar como enviado).
    return new Response(JSON.stringify({ error: { http_code: 500, message: `brevo: ${res.error}` } }), { status: 500, headers: { "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
});
