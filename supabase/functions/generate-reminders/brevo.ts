// Helper de envio de e-mail transacional via API da Brevo (ex-Sendinblue).
// Usado pelo Send Email Hook do Auth (OTP/recuperação) e por e-mails do app (convite, lembretes).
//
// Secrets (Edge Functions):
//   BREVO_API_KEY  — obrigatório. Chave da API transacional (xkeysib-...).
//   BREVO_SENDER   — remetente. Aceita "Maestra <no-reply@dominio>" ou só "no-reply@dominio".
//                    O e-mail/domínio precisa estar VERIFICADO na Brevo, senão o envio falha em silêncio.
//
// IMPORTANTE (deploy): este arquivo vive em _shared como fonte canônica, mas cada função tem a sua
// própria cópia (`./brevo.ts`) — o Supabase deploya a pasta da função achatada. Manter as cópias em
// sincronia ao alterar.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_APP_URL = "https://www.maestramanager.com";

export interface SendArgs {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}

function parseSender(): { email: string; name: string } {
  const raw = (Deno.env.get("BREVO_SENDER") || "").trim();
  const m = raw.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/); // "Nome <email>"
  if (m) return { name: m[1] || "Maestra", email: m[2].trim() };
  return { name: "Maestra", email: raw || "no-reply@maestramanager.com" };
}

function publicAsset(path: string): string {
  const base = (Deno.env.get("APP_URL") || DEFAULT_APP_URL).replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
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

// Paleta do e-mail — os mesmos tokens do app claro. Exportada para os templates pararem de
// repetir hexadecimais soltos: era assim que o design antigo sobrevivia espalhado por cinco
// funções, cada uma com a sua cópia do roxo.
export const EMAIL = {
  fundo: "#f7f8fb",     // canvas atrás do cartão
  cartao: "#ffffff",
  linha: "#e3eaf3",     // bordas e divisórias
  tinta: "#2c3f63",     // títulos e ênfase
  texto: "#405985",     // corpo
  suave: "#7c8da8",     // apoio
  fraco: "#93a4c0",     // rodapé, legendas
  azul: "#3361ff",      // ação
  verde: "#2a9a59",
  vermelho: "#d2474b",
  trilho: "#eef2f8",    // fundo de barra de progresso
} as const;

// Layout dos e-mails, no design claro do app.
//
// O cartão branco sobre o canvas cinza repete o que a pessoa vê ao entrar no produto — antes o
// e-mail era preto com a marca roxa, de um design que não existe mais em lugar nenhum. O selo
// "Beta" também saiu: a marca deixou de usá-lo faz tempo, e o e-mail era o último lugar com ele.
export function emailLayout(opts: { title: string; bodyHtml: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${EMAIL.fundo};font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:${EMAIL.texto};">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">
    <div style="margin-bottom:20px;"><img src="${publicAsset("/brand/maestra-wordmark-email.png")}" width="132" alt="Maestra" style="display:block;width:132px;max-width:60%;height:auto;border:0;"></div>
    <div style="background:${EMAIL.cartao};border:1px solid ${EMAIL.linha};border-radius:14px;padding:30px 28px;">
      <h1 style="font-size:20px;line-height:1.3;font-weight:800;color:${EMAIL.tinta};margin:0 0 14px;">${opts.title}</h1>
      ${opts.bodyHtml}
    </div>
    <div style="margin-top:20px;padding:0 4px;color:${EMAIL.fraco};font-size:12px;line-height:1.6;">
      <div style="color:${EMAIL.suave};font-weight:700;">Maestra <span style="font-weight:400;">by</span> Music Rio Academy</div>
      <div>© ${new Date().getFullYear()} MUSIC RIO ACADEMY LTDA · CNPJ 22.826.985/0001-41. Todos os direitos reservados.</div>
    </div>
  </div>
</body></html>`;
}

// Bloco visual de código OTP (6 dígitos grandes, espaçados).
export function otpBlock(code: string): string {
  return `<div style="margin:22px 0;text-align:center;">
    <div style="display:inline-block;background:${EMAIL.fundo};border:1px solid ${EMAIL.linha};border-radius:12px;padding:16px 28px;font-size:32px;font-weight:800;letter-spacing:10px;color:${EMAIL.tinta};">${code}</div>
  </div>`;
}

// Botão CTA padrão dos e-mails. Branco sobre o azul do sistema — é o único branco que continua
// branco na migração para o design claro.
export function ctaButton(label: string, url: string): string {
  return `<p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:${EMAIL.azul};color:#FFFFFF;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:9999px;">${label}</a></p>`;
}
