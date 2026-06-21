import { supabase } from '../lib/supabase';
import type { ActionTask, Strategy } from '../interfaces/maestra';

// Sincronização Plano de Ação ↔ Agenda (Metodologia v2). Cada tarefa datada vira um evento
// type='task' / source='action_plan', ligado pela coluna events.task_id. Mudou a data da tarefa →
// atualiza o evento; mudou a data do evento → o lado da Agenda atualiza o deadline da tarefa.

const TABLE = 'events';

const taskToEventRow = (artistId: string, task: ActionTask) => ({
  artist_id: artistId,
  task_id: task.id,
  title: task.description,
  type: 'task' as const,
  date: task.deadline,
  status: task.status === 'done' ? 'completed' : 'scheduled',
  source: 'action_plan' as const,
});

// Cria/atualiza os eventos das tarefas datadas e remove os de tarefas sem data ou já removidas do
// plano. Chamado em lote ao confirmar o cronograma e em mudanças que afetem várias tarefas.
export const syncTasksToEvents = async (artistId: string, strategies: Strategy[]): Promise<void> => {
  const tasks = strategies.flatMap((s) => s.tasks || []);
  const dated = tasks.filter((t) => !!t.deadline && !!t.id);
  const rows = dated.map((t) => taskToEventRow(artistId, t));

  // Upsert (insere ou atualiza por task_id) os eventos das tarefas com data.
  if (rows.length) {
    const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'task_id' });
    if (error) throw error;
  }

  // Remove eventos 'action_plan' órfãos: tarefa perdeu a data ou saiu do plano.
  const keep = new Set(dated.map((t) => t.id));
  const { data: existing } = await supabase
    .from(TABLE)
    .select('id, task_id')
    .eq('artist_id', artistId)
    .eq('source', 'action_plan');
  const orphans = (existing || [])
    .filter((e: { id: string; task_id: string | null }) => !e.task_id || !keep.has(e.task_id))
    .map((e: { id: string }) => e.id);
  if (orphans.length) {
    await supabase.from(TABLE).delete().in('id', orphans);
  }
};

// Cria/atualiza o evento de uma única tarefa (edição pontual no Plano de Ação). Sem data → remove.
export const upsertTaskEvent = async (artistId: string, task: ActionTask): Promise<void> => {
  if (!task.id) return;
  if (!task.deadline) {
    await deleteTaskEvent(task.id);
    return;
  }
  const { error } = await supabase.from(TABLE).upsert(taskToEventRow(artistId, task), { onConflict: 'task_id' });
  if (error) throw error;
};

// Remove o evento ligado a uma tarefa (tarefa excluída no Plano de Ação).
export const deleteTaskEvent = async (taskId: string): Promise<void> => {
  if (!taskId) return;
  await supabase.from(TABLE).delete().eq('task_id', taskId);
};

// Aplica no conjunto de estratégias a nova data (ou remoção) vinda de um evento de tarefa editado na
// Agenda. Retorna as estratégias atualizadas (ou null se a tarefa não foi encontrada / nada mudou).
export const applyEventDateToTasks = (
  strategies: Strategy[],
  taskId: string,
  newDeadline: string | null
): Strategy[] | null => {
  let touched = false;
  const next = strategies.map((s) => ({
    ...s,
    tasks: (s.tasks || []).map((t) => {
      if (t.id !== taskId || (t.deadline || null) === (newDeadline || null)) return t;
      touched = true;
      return { ...t, deadline: newDeadline || undefined };
    }),
  }));
  return touched ? next : null;
};
