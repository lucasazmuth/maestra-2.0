// A tradução das ações da Nyta.
//
// A Nyta pede confirmação antes de executar qualquer ação, e o cartão de confirmação é a última
// coisa que a pessoa lê antes de dizer sim. Ele não pode falar em `create_catalog_item` nem
// mostrar um UUID: o que está escrito ali É o consentimento.
//
// Isto vivia dentro do componente da web. Subiu pro núcleo quando o app nativo ganhou o mesmo
// cartão — duas tabelas de tradução divergindo dariam a MESMA ação descrita de dois jeitos, e a
// descrição é o que a pessoa aprova.

// ─── Tool Name Translation Map ────────────────────────────────────────────────

const TOOL_NAME_PT: Record<string, string> = {
  create_catalog_item: 'Criar item em Músicas',
  update_catalog_item: 'Atualizar item em Músicas',
  delete_catalog_item: 'Remover item de Músicas',
  create_event: 'Criar evento',
  update_event: 'Atualizar evento',
  delete_event: 'Remover evento',
  create_team_member: 'Adicionar membro à equipe',
  update_team_member: 'Atualizar membro da equipe',
  remove_team_member: 'Remover membro da equipe',
  update_strategy_task: 'Atualizar tarefa estratégica',
  update_plan_task: 'Atualizar tarefa do plano de ação',
  create_strategy: 'Criar estratégia',
  create_task: 'Criar tarefa',
};

// ─── Argument Label Translation ───────────────────────────────────────────────

const ARG_LABELS_PT: Record<string, string> = {
  title: 'Título',
  name: 'Nome',
  status: 'Status',
  genre: 'Gênero',
  date: 'Data',
  description: 'Descrição',
  role: 'Papel',
  email: 'Email',
  type: 'Tipo',
  location: 'Local',
  venue: 'Local',
  time: 'Horário',
  artist_id: 'Artista',
  id: 'ID',
  task_id: 'Tarefa',
  task_query: 'Tarefa',
  strategy_query: 'Estratégia',
  notes: 'Notas',
  priority: 'Prioridade',
  due_date: 'Data de entrega',
  objective: 'Objetivo',
  tasks: 'Tarefas',
  start_time: 'Horário',
  end_time: 'Término',
  release_date: 'Lançamento',
  item_id: 'Item',
  event_id: 'Evento',
  member_id: 'Membro',
  lyrics: 'Letra',
  duration: 'Duração',
  key: 'Tom',
  bpm: 'BPM',
  isrc: 'ISRC',
  upc: 'UPC',
  access_levels: 'Acesso',
};

// Valores de enum que chegam em "código" → rótulo amigável (status de catálogo/evento, tipo, prioridade).
const ENUM_VALUES_PT: Record<string, string> = {
  // prioridade
  alta: 'Alta', media: 'Média', baixa: 'Baixa',
  // status de catálogo
  composition: 'Composição', production: 'Produção', mixing: 'Mixagem',
  mastering: 'Masterização', ready: 'Pronta', released: 'Lançada',
  // status de evento
  scheduled: 'Agendado', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído',
  // status de tarefa do plano de ação
  todo: 'A fazer', in_progress: 'Em andamento', done: 'Concluída', archived: 'Arquivada',
  // tipo de evento
  show: 'Show', reuniao: 'Reunião', estudio: 'Estúdio', ensaio: 'Ensaio', entrevista: 'Entrevista', outro: 'Outro',
};

// Só traduz enum quando a CHAVE é de enum — evita trocar um título tipo "Show" ou "Released".
const ENUM_KEYS = new Set(['status', 'type', 'priority']);

// Chaves internas que não interessam ao artista (artist_id é injetado pelo servidor; os *_id
// são UUIDs de roteamento). Escondidas do card — a ação + os campos com sentido já bastam,
// e a conversa deixa claro de qual item se trata.
export const HIDDEN_ARG_KEYS = new Set(['artist_id', 'id', 'item_id', 'event_id', 'member_id']);

const SUMMARY_MAX_CHARS = 200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Translate tool name to Portuguese action description.
 */
export function translateToolName(name: string): string {
  return TOOL_NAME_PT[name] || name;
}

/**
 * Translate an argument key to a Portuguese label.
 */
export function translateArgLabel(key: string): string {
  return ARG_LABELS_PT[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Format an argument value for display. Handles primitives and objects.
 */
export function formatArgValue(value: unknown, key?: string): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return (key && ENUM_KEYS.has(key) && ENUM_VALUES_PT[value]) || value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  // Arrays viram texto legível (sem colchetes/aspas do JSON).
  if (Array.isArray(value)) return value.map((v) => formatArgValue(v)).join(', ');
  return JSON.stringify(value);
}

/**
 * Build a summarized description of the action, truncated to SUMMARY_MAX_CHARS.
 */
export function buildActionSummary(name: string, args: Record<string, unknown>): string {
  const actionName = translateToolName(name);
  const argParts = Object.entries(args)
    .filter(([key]) => !HIDDEN_ARG_KEYS.has(key))
    .filter(([, val]) => !Array.isArray(val)) // listas (ex.: tarefas) vão no detalhe, não no resumo
    .map(([key, val]) => `${translateArgLabel(key)}: ${formatArgValue(val, key)}`)
    .join(', ');

  const full = argParts ? `${actionName} — ${argParts}` : actionName;

  if (full.length <= SUMMARY_MAX_CHARS) return full;
  return full.slice(0, SUMMARY_MAX_CHARS - 1) + '…';
}

// ─── O que a Nyta JÁ EXECUTOU, no histórico ───────────────────────────────────

/**
 * As ações de uma mensagem do histórico, prontas para o mesmo cartão que pediu a confirmação.
 *
 * O cartão só existia enquanto a ação estava PENDENTE: ele vinha de `pendingToolCalls`, que é
 * estado de memória e morre ao fechar a tela. Quem voltava à conversa via a Nyta dizer "confirme
 * no card abaixo" e nenhum card abaixo — e, pior, não tinha como saber se o evento chegou a ser
 * criado. O registro sempre esteve no banco: a mensagem da Nyta guarda `tool_calls`, e a
 * mensagem `tool` seguinte guarda `tool_results`. Ninguém desenhava.
 *
 * O estado sai do RESULTADO, e não de um padrão otimista: sem resultado a ação não terminou
 * (`executing`), com `success: false` ela falhou. Um cartão que dissesse "executada" para uma
 * ação que deu erro seria pior do que cartão nenhum.
 *
 * `jaPendentes` são as ações que a tela já está desenhando ao vivo. Sem essa exclusão, no
 * instante entre confirmar e recarregar, a mesma ação apareceria duas vezes na conversa.
 */
interface ResultadoDaAcao { tool_call_id: string; success: boolean }

export interface MensagemComAcoes {
  id: string;
  role: string;
  toolCalls?: { id: string; name: string; arguments: Record<string, unknown> }[];
  /** Um objeto (o que o servidor grava hoje) ou uma lista. Ver `NytaChatMessage.toolResults`. */
  toolResults?: ResultadoDaAcao | ResultadoDaAcao[];
}

export interface AcaoDoHistorico {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'executing' | 'done' | 'error';
}

export function acoesDoHistorico(
  mensagem: MensagemComAcoes,
  todas: MensagemComAcoes[],
  jaPendentes: string[] = [],
): AcaoDoHistorico[] {
  if (!mensagem.toolCalls?.length) return [];

  // Os resultados chegam nas mensagens `tool` da conversa, e não na mensagem que pediu a ação.
  const resultados = new Map<string, boolean>();
  for (const outra of todas) {
    if (!outra.toolResults) continue;
    // Objeto ou lista: o servidor grava um objeto, e o tipo dizia lista. Normalizar aqui é o que
    // impede o `for...of` de estourar numa conversa que tem ação executada.
    const lista = Array.isArray(outra.toolResults) ? outra.toolResults : [outra.toolResults];
    for (const r of lista) resultados.set(r.tool_call_id, r.success);
  }

  const pendentes = new Set(jaPendentes);
  return mensagem.toolCalls
    .filter((chamada) => !pendentes.has(chamada.id))
    .map((chamada) => {
      const sucesso = resultados.get(chamada.id);
      return {
        toolCallId: chamada.id,
        name: chamada.name,
        arguments: chamada.arguments,
        status: sucesso === undefined ? 'executing' : sucesso ? 'done' : 'error',
      } as AcaoDoHistorico;
    });
}
