import { supabase } from '../../lib/supabase';
import type { AgendaEvent } from '../../interfaces/maestra';

type AgendaAssigneeKind = 'owner' | 'member' | 'unassigned';

const TABLE = 'events';

const isAssigneeSchemaError = (error: any): boolean => /assignee_kind|assignee_member_id/i.test(String(error?.message || error?.details || ''));
const withoutAssignee = (input: Record<string, unknown>): Record<string, unknown> => {
  const { assignee_kind: _kind, assignee_member_id: _member, ...legacy } = input;
  return legacy;
};

export const listEvents = async (artistId: string): Promise<AgendaEvent[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('artist_id', artistId)
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []) as AgendaEvent[];
};

export const createEvent = async (
  input: Omit<AgendaEvent, 'id' | 'created_at' | 'updated_at'>
): Promise<AgendaEvent> => {
  const first = await supabase.from(TABLE).insert(input).select('*').single();
  if (!first.error) return first.data as AgendaEvent;
  if (!isAssigneeSchemaError(first.error)) throw first.error;
  const fallback = await supabase.from(TABLE).insert(withoutAssignee(input as Record<string, unknown>)).select('*').single();
  if (fallback.error) throw fallback.error;
  return fallback.data as AgendaEvent;
};

export const updateEvent = async (
  id: string,
  patch: Partial<AgendaEvent>
): Promise<AgendaEvent> => {
  const first = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (!first.error) return first.data as AgendaEvent;
  if (!isAssigneeSchemaError(first.error)) throw first.error;
  const fallback = await supabase
    .from(TABLE)
    .update({ ...withoutAssignee(patch as Record<string, unknown>), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (fallback.error) throw fallback.error;
  return fallback.data as AgendaEvent;
};

export const deleteEvent = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

export const findActionPlanEvent = async (
  artistId: string,
  taskId: string
): Promise<AgendaEvent | null> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('artist_id', artistId)
    .eq('task_id', taskId)
    .eq('source', 'action_plan')
    .maybeSingle();
  if (error) throw error;
  return (data || null) as AgendaEvent | null;
};

export const syncActionPlanTaskEvent = async (input: {
  artistId: string;
  taskId: string;
  title: string;
  strategyTitle: string;
  deadline?: string;
  completed?: boolean;
  recurrence?: 'weekly';
  assigneeKind?: AgendaAssigneeKind;
  assigneeMemberId?: string | null;
}): Promise<AgendaEvent | null> => {
  const { data, error } = await supabase.rpc('upsert_action_plan_event', {
    p_artist_id: input.artistId,
    p_task_id: input.taskId,
    p_title: input.title,
    p_strategy_title: input.strategyTitle,
    p_deadline: input.deadline || null,
    p_completed: Boolean(input.completed),
    p_recurrence: input.recurrence || null,
    p_assignee_kind: input.assigneeKind || 'unassigned',
    p_assignee_member_id: input.assigneeMemberId || null,
  });
  if (!error) return (data || null) as AgendaEvent | null;

  // Compatibilidade durante a janela entre deploy do frontend e aplicação da migration.
  // Quando a RPC/coluna ainda não existe, o fluxo legado continua salvando prazo e status;
  // depois da migration a primeira tentativa passa a persistir também o responsável.
  if (!isAssigneeSchemaError(error) && !/upsert_action_plan_event|function .* does not exist/i.test(String(error.message || ''))) throw error;
  const existing = await findActionPlanEvent(input.artistId, input.taskId);
  if (!input.deadline) {
    if (existing) await deleteEvent(existing.id);
    return null;
  }
  const patch: Partial<AgendaEvent> = {
    title: input.title,
    type: 'task',
    date: input.deadline,
    status: input.completed ? 'completed' : 'scheduled',
    description: `Plano de Ação · ${input.strategyTitle}`,
    task_id: input.taskId,
    source: 'action_plan',
    recurrence_rule: input.recurrence || null,
  };
  if (existing) return updateEvent(existing.id, patch);
  return createEvent({
    artist_id: input.artistId,
    title: input.title,
    type: 'task',
    date: input.deadline,
    start_time: null,
    end_time: null,
    location: null,
    description: `Plano de Ação · ${input.strategyTitle}`,
    status: input.completed ? 'completed' : 'scheduled',
    task_id: input.taskId,
    source: 'action_plan',
    recurrence_rule: input.recurrence || null,
  });
};
