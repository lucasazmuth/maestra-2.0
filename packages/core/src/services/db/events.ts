import { supabase } from '../../lib/supabase';
import type { AgendaEvent } from '../../interfaces/maestra';

const TABLE = 'events';

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
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  if (error) throw error;
  return data as AgendaEvent;
};

export const updateEvent = async (
  id: string,
  patch: Partial<AgendaEvent>
): Promise<AgendaEvent> => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as AgendaEvent;
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
}): Promise<AgendaEvent | null> => {
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
  });
};
