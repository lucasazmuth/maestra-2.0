-- A leitura do estado atual do artista ocorre em uma função SECURITY DEFINER
-- para evitar recursão da política RLS durante o UPDATE. A função só permite
-- alteração de content/updated_at por membros com acesso de plano.
create or replace function public.can_update_shared_artist_content(
  aid uuid,
  candidate_user_id uuid,
  candidate_name text,
  candidate_created_at timestamptz,
  candidate_is_locked boolean,
  candidate_spotify_artist_id text,
  candidate_purchased_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.artists as current_artist
    where current_artist.id = aid
      and current_artist.is_locked is distinct from true
      and candidate_user_id is not distinct from current_artist.user_id
      and candidate_name is not distinct from current_artist.name
      and candidate_created_at is not distinct from current_artist.created_at
      and candidate_is_locked is not distinct from current_artist.is_locked
      and candidate_spotify_artist_id is not distinct from current_artist.spotify_artist_id
      and candidate_purchased_at is not distinct from current_artist.purchased_at
      and exists (
        select 1
        from public.artist_members as member
        where member.artist_id = current_artist.id
          and member.user_id = auth.uid()
          and member.status = 'active'
          and (member.access_levels ? 'plan' or member.access_levels ? 'full')
      )
  );
$$;

revoke all on function public.can_update_shared_artist_content(uuid, uuid, text, timestamptz, boolean, text, timestamptz) from public;
grant execute on function public.can_update_shared_artist_content(uuid, uuid, text, timestamptz, boolean, text, timestamptz) to authenticated;

drop policy if exists "Plan members can update shared artist content" on public.artists;

create policy "Plan members can update shared artist content"
on public.artists
for update
to authenticated
using (
  is_locked is distinct from true
  and (select public.has_artist_access(id, 'plan'))
)
with check (
  (select public.can_update_shared_artist_content(
    id,
    user_id,
    name,
    created_at,
    is_locked,
    spotify_artist_id,
    purchased_at
  ))
);
