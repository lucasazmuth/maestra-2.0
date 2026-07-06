// Helper de envio de e-mail transacional via API da Brevo (ex-Sendinblue).
// Usado pelo Send Email Hook do Auth (OTP/recuperação) e por e-mails do app (convite, lembretes).
//
// Secrets (Edge Functions):
//   BREVO_API_KEY  — obrigatório. Chave da API transacional (xkeysib-...).
//   BREVO_SENDER   — remetente. Aceita "Maestra Manager <no-reply@dominio>" ou só "no-reply@dominio".
//                    O e-mail/domínio precisa estar VERIFICADO na Brevo, senão o envio falha em silêncio.
//
// IMPORTANTE (deploy): este arquivo vive em _shared como fonte canônica, mas cada função tem a sua
// própria cópia (`./brevo.ts`) — o Supabase deploya a pasta da função achatada. Manter as cópias em
// sincronia ao alterar.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export interface SendArgs {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

function parseSender(): { email: string; name: string } {
  const raw = (Deno.env.get("BREVO_SENDER") || "").trim();
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/); // "Nome <email>"
  if (m) return { name: m[1] || "Maestra Manager", email: m[2].trim() };
  return { name: "Maestra Manager", email: raw || "no-reply@maestramanager.com" };
}

// Envia um e-mail. Nunca lança: retorna { ok, error } pro chamador decidir (fail-safe).
export async function sendBrevoEmail({ to, toName, subject, html }: SendArgs): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    console.error("[brevo] BREVO_API_KEY ausente — e-mail não enviado");
    return { ok: false, error: "missing_api_key" };
  }
  const sender = parseSender();
  try {
    const resp = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ sender, to: [{ email: to, ...(toName ? { name: toName } : {}) }], subject, htmlContent: html }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[brevo] envio falhou (${resp.status}): ${body.slice(0, 400)}`);
      return { ok: false, error: `brevo_${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("[brevo] erro de rede:", (e as Error)?.message);
    return { ok: false, error: "network" };
  }
}

// Layout sóbrio (dark, marca Maestra) pros e-mails. `bodyHtml` entra no miolo.
export function emailLayout(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0b0b0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#e8e8e8;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <div style="font-size:20px;letter-spacing:.5px;color:#BE81EC;margin-bottom:24px;"><span style="font-weight:800;">Maestra</span> <span style="font-weight:400;">Manager</span><span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c2c2cc;vertical-align:super;margin-left:5px;">Beta</span></div>
    <h1 style="font-size:20px;line-height:1.3;color:#fff;margin:0 0 12px;">${opts.title}</h1>
    ${opts.bodyHtml}
    <div style="margin-top:32px;color:#6b7280;font-size:12px;border-top:1px solid #222;padding-top:16px;line-height:1.6;"><div style="color:#9a9aa2;font-weight:600;">Maestra Manager <span style="color:#6b7280;font-weight:400;">by</span> Music Rio Academy</div><div>© ${new Date().getFullYear()} MUSIC RIO ACADEMY LTDA · CNPJ 22.826.985/0001-41. Todos os direitos reservados.</div></div>
  </div>
</body></html>`;
}

// Bloco visual de código OTP (6 dígitos grandes, espaçados).
export function otpBlock(code: string): string {
  return `<div style="margin:20px 0;text-align:center;">
    <div style="display:inline-block;background:#161616;border:1px solid rgba(190,129,236,.35);border-radius:12px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:10px;color:#fff;">${code}</div>
  </div>`;
}

// Botão CTA roxo padrão dos e-mails (usado pelos nudges de ativação).
export function ctaButton(label: string, url: string): string {
  return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:#BE81EC;color:#1A1A1A;text-decoration:none;font-weight:700;padding:12px 26px;border-radius:9999px;">${label}</a></p>`;
}
