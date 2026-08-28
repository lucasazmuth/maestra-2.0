import { supabase } from '../../lib/supabase';
import type { Artist, ArtistContent } from '../../interfaces/maestra';

// Encapsula o acesso à tabela `artists`. RLS isola por usuário/membro.

const mapRow = (
  row: any,
  role: 'owner' | 'member' = 'owner',
  extra?: { access_levels?: Artist['access_levels']; owner_is_pro?: boolean }
): Artist => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  content: (row.content as ArtistContent) || {},
  is_locked: row.is_locked,
  created_at: row.created_at,
  updated_at: row.updated_at,
  role,
  ...(extra?.access_levels ? { access_levels: extra.access_levels } : {}),
  ...(extra?.owner_is_pro !== undefined ? { owner_is_pro: extra.owner_is_pro } : {}),
});

/** Lista artistas do usuário (dono) + artistas onde ele é membro ativo. */
export const listArtists = async (userId: string): Promise<Artist[]> => {
  const owned = await supabase
    .from('artists')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (owned.error) throw owned.error;
  const ownedArtists = (owned.data || []).map((r) => mapRow(r, 'owner'));

  // Artistas onde é membro (status active) — traz os access_levels concedidos no convite.
  const memberships = await supabase
    .from('artist_members')
    .select('artist_id, access_levels')
    .eq('user_id', userId)
    .eq('status', 'active');

  let memberArtists: Artist[] = [];
  const levelsByArtist = new Map<string, Artist['access_levels']>();
  (memberships.data || []).forEach((m: any) => levelsByArtist.set(m.artist_id, m.access_levels || []));
  const memberIds = (memberships.data || [])
    .map((m: any) => m.artist_id)
    .filter((id: string) => !ownedArtists.some((a) => a.id === id));

  if (memberIds.length) {
    const res = await supabase.from('artists').select('*').in('id', memberIds);
    // Limite de faixas é POR PERFIL: precisamos saber se o DONO é PRO (o membro não tem
    // acesso à assinatura alheia — vem por RPC SECURITY DEFINER).
    const proRes = await supabase.rpc('artists_owner_pro', { ids: memberIds });
    const proByArtist = new Map<string, boolean>();
    (proRes.data || []).forEach((r: any) => proByArtist.set(r.artist_id, !!r.owner_is_pro));
    memberArtists = (res.data || []).map((r) =>
      mapRow(r, 'member', {
        access_levels: levelsByArtist.get(r.id) || [],
        owner_is_pro: proByArtist.get(r.id) ?? false,
      })
    );
  }

  return [...ownedArtists, ...memberArtists];
};

export const getArtist = async (id: string): Promise<Artist | null> => {
  const { data, error } = await supabase.from('artists').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
};

export const createArtist = async (input: {
  userId: string;
  name: string;
  content: ArtistContent;
  spotifyArtistId?: string;
}): Promise<Artist> => {
  // Unicidade por usuário é garantida pela constraint `artists_user_spotify_unique`
  const { data, error } = await supabase
    .from('artists')
    .insert({
      user_id: input.userId,
      name: input.name,
      content: input.content,
      spotify_artist_id: input.spotifyArtistId || null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
};

export const updateArtist = async (
  id: string,
  patch: { name?: string; content?: ArtistContent }
): Promise<Artist> => {
  const { data, error } = await supabase
    .from('artists')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return mapRow(data);
};

export const deleteArtist = async (id: string): Promise<void> => {
  const { error } = await supabase.from('artists').delete().eq('id', id);
  if (error) throw error;
};
