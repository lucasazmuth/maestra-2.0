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

function categorizeByMessage(msg: string, fallback: string): string {
  const m = msg.toLowerCase();
  if (m.includes('timeout') || m.includes('timed out') || m.includes('aborted'))
    return 'Falha na comunicação com serviço de pagamento. Tempo limite excedido.';
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to') || m.includes('connection') || m.includes('econnrefused'))
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
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
  // Tenta ler o corpo JSON da resposta (onde está o { error: "..." } real).
  const ctx = error?.context as { json?: () => Promise<any> } | undefined;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      const real = body?.error || body?.message;
      if (typeof real === 'string' && real.trim()) return cap(real.trim());
    } catch {
      // corpo não-JSON ou já consumido → segue pro fallback por mensagem
    }
  }
  return categorizeByMessage(error?.message || '', fallback);
}
