import { supabase } from '../../lib/supabase';
import type { CalendarConnection, CalendarSource, CalendarSyncState } from '../../interfaces/maestra';

export const listConnections = async (): Promise<CalendarConnection[]> => {
  const { data, error } = await supabase.from('calendar_connections').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CalendarConnection[];
};

export const listSources = async (artistId: string): Promise<CalendarSource[]> => {
  const { data, error } = await supabase.from('calendar_sources').select('*').eq('artist_id', artistId).order('name');
  if (error) throw error;
  return (data || []) as CalendarSource[];
};

export const listSyncStates = async (sourceIds: string[]): Promise<CalendarSyncState[]> => {
  if (!sourceIds.length) return [];
  const { data, error } = await supabase.from('calendar_sync_state').select('*').in('source_id', sourceIds);
  if (error) throw error;
  return (data || []) as CalendarSyncState[];
};

/** O navegador solicita apenas a intenção; o refresh token é tratado pela Edge Function. */
export const startGoogleConnection = async (artistId: string, returnTo: string): Promise<{ url: string }> => {
  const { data, error } = await supabase.functions.invoke('calendar-google-auth', {
    body: { artistId, returnTo },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('O provedor não retornou a URL de conexão.');
  return data as { url: string };
};

export const disconnectConnection = async (connectionId: string): Promise<void> => {
  const { error } = await supabase.from('calendar_connections').update({ status: 'revoked', updated_at: new Date().toISOString() }).eq('id', connectionId);
  if (error) throw error;
};
