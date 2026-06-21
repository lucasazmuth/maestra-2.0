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
