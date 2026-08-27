import { supabase } from '../../lib/supabase';
import type { MusicGenre } from '../../interfaces/maestra';

export const listGenres = async (): Promise<MusicGenre[]> => {
  const { data, error } = await supabase
    .from('music_genres')
    .select('id, name')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as MusicGenre[];
};
