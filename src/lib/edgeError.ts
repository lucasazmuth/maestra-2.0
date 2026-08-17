// Extrai a mensagem de erro REAL de uma Edge Function.
//
// Quando a function responde com status não-2xx, o supabase-js devolve um
// FunctionsHttpError cujo `.message` é sempre o genérico
// "Edge Function returned a non-2xx status code" — a mensagem útil (ex.:
// "Cartão recusado", "CPF inválido") vem no corpo da resposta, acessível
// via `error.context` (um objeto Response). Este helper lê esse corpo e
// devolve o campo `error`; se não conseguir, cai nas categorias de rede/genérico.

const MAX = 200;
const cap = (s: string) => (s.length > MAX ? s.slice(0, MAX - 3) + '...' : s);

// Lê o corpo JSON da resposta (onde está o { error: "..." } que a function lançou).
async function readBodyError(error: { context?: unknown } | null | undefined): Promise<string> {
  const ctx = error?.context as { json?: () => Promise<any> } | undefined;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      const real = body?.error || body?.message;
      if (typeof real === 'string' && real.trim()) return real.trim();
    } catch {
      // corpo não-JSON ou já consumido
    }
  }
  return '';
}

const isNetwork = (msg: string) => {
  const m = msg.toLowerCase();
  return (
    m.includes('network') ||
    m.includes('fetch') ||
    m.includes('failed to') ||
    m.includes('connection') ||
    m.includes('econnrefused')
  );
};

const isTimeout = (msg: string) => {
  const m = msg.toLowerCase();
  return m.includes('timeout') || m.includes('timed out') || m.includes('aborted');
};

function categorizeByMessage(msg: string, fallback: string): string {
  const m = msg.toLowerCase();
  if (isTimeout(msg)) return 'Falha na comunicação com serviço de pagamento. Tempo limite excedido.';
  if (isNetwork(msg)) return 'Erro de conexão. Verifique sua internet e tente novamente.';
  if (m.includes('500') || m.includes('502') || m.includes('503') || m.includes('server'))
    return 'Erro no servidor de pagamento. Tente novamente em alguns instantes.';
  // Ignora o texto genérico do supabase-js — nesse caso preferimos o fallback.
  if (msg && !m.includes('non-2xx')) return cap(msg);
  return fallback;
}

export async function readEdgeFunctionError(
  error: { message?: string; context?: unknown } | null | undefined,
  fallback: string,
): Promise<string> {
  const real = await readBodyError(error);
  if (real) return cap(real);
  return categorizeByMessage(error?.message || '', fallback);
}

// ─────────────────────────────────────────────────────────────────────────────
// Erros de IA (wizard-ai, nyta-chat)
// ─────────────────────────────────────────────────────────────────────────────

// Diferente do fluxo de pagamento, aqui o corpo da resposta NUNCA serve para o artista ler:
// as functions de IA lançam erros escritos para desenvolvedor ("Groq error 404: {...
// model_not_found ...}", "Resposta da IA em formato inválido", "Action desconhecida"). Mostrar
// isso na tela assusta e não ajuda ninguém a resolver. Então o técnico vai para o console (onde
// a gente depura) e o artista recebe uma frase que diz o que aconteceu e o que fazer.
//
// `context` identifica a origem no log (ex.: 'wizard-ai/createStrategies') para o erro não virar
// uma linha solta sem dono no console.
export function friendlyAiError(technical: string, context?: string): string {
  if (technical) console.error(`[IA${context ? ` · ${context}` : ''}]`, technical);

  if (isNetwork(technical)) return 'Sem conexão com a internet. Verifique sua rede e tente de novo.';
  if (isTimeout(technical)) return 'A Nyta demorou demais para responder. Tente de novo.';
  return 'A Nyta está indisponível neste momento. Tente de novo em alguns instantes.';
}

// Versão para chamadas via supabase.functions.invoke: lê o corpo (para o log) e devolve a
// mensagem amigável.
export async function readAiError(
  error: { message?: string; context?: unknown } | null | undefined,
  context?: string,
): Promise<string> {
  const technical = (await readBodyError(error)) || error?.message || '';
  return friendlyAiError(technical, context);
}
