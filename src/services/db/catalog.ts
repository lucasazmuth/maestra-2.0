import { supabase } from '../../lib/supabase';
import type { CatalogItem } from '../../interfaces/maestra';

const TABLE = 'catalog_items';

export const listCatalogItems = async (artistId: string): Promise<CatalogItem[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as CatalogItem[];
};

export const createCatalogItem = async (
  input: Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>
): Promise<CatalogItem> => {
  const { data, error } = await supabase.from(TABLE).insert(input).select('*').single();
  if (error) throw error;
  return data as CatalogItem;
};

export const updateCatalogItem = async (
  id: string,
  patch: Partial<CatalogItem>
): Promise<CatalogItem> => {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as CatalogItem;
};

export const deleteCatalogItem = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};
