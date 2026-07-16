-- Colaboradores com acesso ao plano podem manter tarefas existentes sem Pro.
-- A política limita essa permissão ao conteúdo do plano: dados de propriedade,
-- pagamento e identificação do artista continuam imutáveis para colaboradores.
drop policy if exists "Users can update own or shared artists" on public.artists;

create policy "Plan members can update shared artist content"
on public.artists
for update
to authenticated
using (
  is_locked is distinct from true
  and (select public.has_artist_access(id, 'plan'))
)
with check (
  is_locked is distinct from true
  and (select public.has_artist_access(id, 'plan'))
  and id is not distinct from (
    select current_artist.id
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and user_id is not distinct from (
    select current_artist.user_id
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and name is not distinct from (
    select current_artist.name
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and created_at is not distinct from (
    select current_artist.created_at
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and is_locked is not distinct from (
    select current_artist.is_locked
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and spotify_artist_id is not distinct from (
    select current_artist.spotify_artist_id
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
  and purchased_at is not distinct from (
    select current_artist.purchased_at
    from public.artists as current_artist
    where current_artist.id = artists.id
  )
);
