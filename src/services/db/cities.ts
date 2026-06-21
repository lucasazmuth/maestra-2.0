import { supabase } from '../../lib/supabase';

// Busca de cidades brasileiras (tabela `br_cities`, municípios do IBGE) para o dropdown da Visão
// (Metodologia v2, Q6). A coluna `search` é normalizada (sem acentos, minúscula) para casar com
// o que o artista digita, independente de acentuação.

export interface BrCity {
  name: string;
  uf: string;
}

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const searchCities = async (query: string): Promise<BrCity[]> => {
  const q = norm(query);
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('br_cities')
    .select('name, uf')
    .ilike('search', `${q}%`)
    .order('name', { ascending: true })
    .limit(20);
  if (error) return [];
  return (data || []) as BrCity[];
};
