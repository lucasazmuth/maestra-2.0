-- O DONO do artista precisa poder gerenciar o catálogo de projetos.
--
-- has_artist_access() só consulta artist_members, e nenhum dono é membro de si mesmo (0 de 49
-- artistas tinham esse registro quando isto foi escrito). As policies do catalog_items legado
-- sempre trataram o caso com um `dono OR has_artist_access(...)`; as de projeto/versão nasceram
-- só com a segunda metade, e o resultado era 42501 (violates RLS) ao criar qualquer música — o
-- modal falhava em silêncio e a faixa sumia no reload.
create or replace function public.can_manage_artist_catalog(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.artists a where a.id = aid and a.user_id = auth.uid())
      or public.has_artist_access(aid, 'catalog');
$$;

grant execute on function public.can_manage_artist_catalog(uuid) to authenticated;

drop policy if exists "Catalog members can manage JAM projects" on public.catalog_projects;
create policy "Catalog members can manage JAM projects" on public.catalog_projects for all to authenticated
  using (public.can_manage_artist_catalog(artist_id))
  with check (public.can_manage_artist_catalog(artist_id));

drop policy if exists "Active team can manage JAM versions" on public.catalog_versions;
create policy "Active team can manage JAM versions" on public.catalog_versions for all to authenticated
  using (exists (select 1 from public.catalog_projects p where p.id = project_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))))
  with check (exists (select 1 from public.catalog_projects p where p.id = project_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))));

drop policy if exists "Active team can manage JAM files" on public.catalog_version_files;
create policy "Active team can manage JAM files" on public.catalog_version_files for all to authenticated
  using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))))
  with check (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))));

drop policy if exists "Active team can manage JAM version comments" on public.catalog_version_comments;
create policy "Active team can manage JAM version comments" on public.catalog_version_comments for all to authenticated
  using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))))
  with check (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and (public.is_active_artist_team_member(p.artist_id) or public.can_manage_artist_catalog(p.artist_id))));
