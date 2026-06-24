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

// Outro vazamento comum: o modelo "descreve" a chamada imprimindo os ARGUMENTOS como um objeto
// JSON solto no texto (ex.: `{"date":"2026-08-15","type":"show","title":"...","location":"..."}`)
// em vez de usar o canal de tool_calls. Removemos só objetos planos que contenham uma CHAVE de
// ferramenta conhecida — assim não comemos prosa nem JSON que o artista por acaso cole.
const LEAKED_TOOL_JSON =
  /\{[^{}]*"(?:date|type|title|location|status|start_time|end_time|description|priority|strategy_query|task_query|tasks|item_id|event_id|member_id|release_date|genre|objective|isrc|upc)"\s*:[^{}]*\}/g;
// Partial no fim do stream: objeto JSON aberto e ainda sem fechar.
const LEAKED_TOOL_JSON_TRAILING = /\{\s*"(?:date|type|title|location|status|description)"\s*:[^{}]*$/;

export const sanitizeNytaContent = (raw: string | null | undefined): string => {
  if (!raw) return '';
  const hasFunction = raw.includes('<function');
  const maybeJson = raw.includes('{') && raw.includes('":');
  // Atalho: nada a fazer se não houver nenhum dos marcadores.
  if (!hasFunction && !maybeJson) return raw;

  let out = raw;
  if (hasFunction) {
    out = out.replace(FUNCTION_BLOCK, '').replace(FUNCTION_TRAILING, '').replace(FUNCTION_ORPHAN_TAG, '');
  }
  if (maybeJson) {
    out = out.replace(LEAKED_TOOL_JSON, '').replace(LEAKED_TOOL_JSON_TRAILING, '');
  }
  return out
    // Normaliza espaços/linhas em branco deixados pela remoção.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
