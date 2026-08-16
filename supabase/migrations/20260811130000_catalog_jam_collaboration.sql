-- Chat geral do Espaço JAM + permissões de colaboração para membros ativos.
create or replace function public.is_active_artist_team_member(target_artist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.artists artist
    where artist.id = target_artist_id and artist.user_id = auth.uid()
  )
  or exists (
    select 1 from public.artist_members member
    where member.artist_id = target_artist_id
      and member.user_id = auth.uid()
      and member.status = 'active'
  );
$$;

grant execute on function public.is_active_artist_team_member(uuid) to authenticated;

create table if not exists public.catalog_project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_avatar text,
  text text not null check (char_length(text) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_project_messages_project_created_idx
  on public.catalog_project_messages(project_id, created_at asc);

alter table public.catalog_project_messages enable row level security;
grant select, insert on public.catalog_project_messages to authenticated;

create policy "Active team can read JAM messages"
  on public.catalog_project_messages for select to authenticated
  using (exists (
    select 1 from public.catalog_projects project
    where project.id = project_id
      and public.is_active_artist_team_member(project.artist_id)
  ));

create policy "Active team can send JAM messages"
  on public.catalog_project_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.catalog_projects project
      where project.id = project_id
        and public.is_active_artist_team_member(project.artist_id)
    )
  );

-- Metadados do projeto permanecem limitados à permissão de Música/Catálogo.
drop policy if exists "Catalog members can read projects" on public.catalog_projects;
drop policy if exists "Catalog members can write projects" on public.catalog_projects;
create policy "Active team can read JAM projects" on public.catalog_projects for select to authenticated
  using (public.is_active_artist_team_member(artist_id));
create policy "Catalog members can manage JAM projects" on public.catalog_projects for all to authenticated
  using (public.has_artist_access(artist_id, 'catalog'))
  with check (public.has_artist_access(artist_id, 'catalog'));

drop policy if exists "Catalog members can read versions" on public.catalog_versions;
drop policy if exists "Catalog members can write versions" on public.catalog_versions;
create policy "Active team can read JAM versions" on public.catalog_versions for select to authenticated
  using (exists (select 1 from public.catalog_projects project where project.id = project_id and public.is_active_artist_team_member(project.artist_id)));
create policy "Active team can manage JAM versions" on public.catalog_versions for all to authenticated
  using (exists (select 1 from public.catalog_projects project where project.id = project_id and public.is_active_artist_team_member(project.artist_id)))
  with check (exists (select 1 from public.catalog_projects project where project.id = project_id and public.is_active_artist_team_member(project.artist_id)));

drop policy if exists "Catalog members can read files" on public.catalog_version_files;
drop policy if exists "Catalog members can write files" on public.catalog_version_files;
create policy "Active team can read JAM files" on public.catalog_version_files for select to authenticated
  using (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)));
create policy "Active team can manage JAM files" on public.catalog_version_files for all to authenticated
  using (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)))
  with check (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)));

drop policy if exists "Catalog members can read comments" on public.catalog_version_comments;
drop policy if exists "Catalog members can write comments" on public.catalog_version_comments;
create policy "Active team can read JAM version comments" on public.catalog_version_comments for select to authenticated
  using (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)));
create policy "Active team can manage JAM version comments" on public.catalog_version_comments for all to authenticated
  using (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)))
  with check (exists (select 1 from public.catalog_versions version join public.catalog_projects project on project.id = version.project_id where version.id = version_id and public.is_active_artist_team_member(project.artist_id)));

alter table public.catalog_project_messages replica identity full;
alter publication supabase_realtime add table public.catalog_project_messages;
