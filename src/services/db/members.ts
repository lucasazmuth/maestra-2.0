import { supabase } from '../../lib/supabase';
import type { ArtistMember, AccessLevel } from '../../interfaces/maestra';

const TABLE = 'artist_members';

export const listMembers = async (artistId: string): Promise<ArtistMember[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('artist_id', artistId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as ArtistMember[];
};

export const inviteMember = async (input: {
  artistId: string;
  email: string;
  name?: string;
  accessLevels: AccessLevel[];
}): Promise<ArtistMember> => {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      artist_id: input.artistId,
      email: input.email,
      name: input.name || null,
      access_levels: input.accessLevels,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw error;
  const member = data as ArtistMember;
  // Dispara o e-mail de convite (Brevo) em segundo plano — fail-safe: erro de e-mail NÃO quebra
  // o convite (a linha 'pending' já existe e aparece pro convidado ao logar com este e-mail).
  supabase.functions
    .invoke('send-team-invite', { body: { memberId: member.id, appUrl: window.location.origin } })
    .catch((e) => console.error('send-team-invite falhou:', e?.message || e));
  return member;
};

export const updateMember = async (
  id: string,
  patch: { access_levels?: AccessLevel[]; status?: ArtistMember['status']; name?: string }
): Promise<ArtistMember> => {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as ArtistMember;
};

export const removeMember = async (id: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw error;
};

// ---- Convites pendentes (lado do convidado) ------------------------------------------------

export interface PendingInvite extends ArtistMember {
  artists?: { name: string; content: any; user_id: string } | null;
}

export const fetchPendingInvites = async (email: string): Promise<PendingInvite[]> => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, artists(name, content, user_id)')
    .eq('email', email)
    .eq('status', 'pending');
  if (error) throw error;
  return (data || []) as PendingInvite[];
};

export const acceptInvite = async (inviteId: string, userId: string, userName?: string): Promise<void> => {
  const payload: Record<string, unknown> = { status: 'active', user_id: userId };
  if (userName) payload.name = userName;
  const { error } = await supabase.from(TABLE).update(payload).eq('id', inviteId);
  if (error) throw error;
};

export const rejectInvite = async (inviteId: string): Promise<void> => {
  const { error } = await supabase.from(TABLE).update({ status: 'rejected' }).eq('id', inviteId);
  if (error) throw error;
};
