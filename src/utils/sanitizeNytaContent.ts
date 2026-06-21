// Alguns modelos (Llama via Groq) às vezes emitem chamadas de ferramenta como TEXTO,
// no formato `<function(nome){...json...}</function>`, em vez de usar o canal estruturado de
// tool_calls. Quando isso acontece, o markup vaza no conteúdo visível da mensagem.
//
// Este sanitizador remove esses blocos na hora de renderizar — cobre tanto o streaming ao vivo
// quanto mensagens já persistidas no banco (que não dá pra reescrever retroativamente).

// Bloco completo: <function(nome){ ...json... }</function>
const FUNCTION_BLOCK = /<function\b[^>]*?\)\s*\{[\s\S]*?\}\s*<\/function>/gi;
// Bloco parcial no fim do stream (ainda sem fechamento): <function(nome){ ...
const FUNCTION_TRAILING = /<function\b\([\s\S]*$/i;
// Tags soltas remanescentes (<function...> ou </function>)
const FUNCTION_ORPHAN_TAG = /<\/?function\b[^>]*>/gi;

export const sanitizeNytaContent = (raw: string | null | undefined): string => {
  if (!raw) return '';
  // Atalho: nada a fazer se não houver o marcador.
  if (!raw.includes('<function')) return raw;

  return raw
    .replace(FUNCTION_BLOCK, '')
    .replace(FUNCTION_TRAILING, '')
    .replace(FUNCTION_ORPHAN_TAG, '')
    // Normaliza espaços/linhas em branco deixados pela remoção.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
