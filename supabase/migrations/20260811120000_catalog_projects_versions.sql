-- Espaço da faixa v2: um projeto contém versões e cada versão possui seus próprios comentários.
create table if not exists public.catalog_projects (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  status text not null default 'composition',
  genre text,
  bpm text,
  key text,
  cover_image text,
  cover_image_name text,
  assignee jsonb,
  release_date date,
  primary_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.catalog_projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  stage text not null default 'guia',
  title text,
  status text not null default 'composition',
  audio_file text,
  audio_file_name text,
  duration text,
  bpm text,
  key text,
  genre text,
  lyrics text,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  author_avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version_number)
);

alter table public.catalog_projects
  drop constraint if exists catalog_projects_primary_version_fk;
alter table public.catalog_projects
  add constraint catalog_projects_primary_version_fk
  foreign key (primary_version_id) references public.catalog_versions(id) on delete set null;

create table if not exists public.catalog_version_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.catalog_versions(id) on delete cascade,
  name text not null,
  file_url text not null,
  file_type text,
  kind text not null default 'attachment',
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_version_comments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.catalog_versions(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_avatar text,
  text text not null check (char_length(text) between 1 and 5000),
  time_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_projects_artist_updated_idx on public.catalog_projects(artist_id, updated_at desc);
create index if not exists catalog_versions_project_created_idx on public.catalog_versions(project_id, created_at asc);
create index if not exists catalog_version_comments_version_created_idx on public.catalog_version_comments(version_id, created_at asc);

-- Migração idempotente: cada item legado vira um projeto e sua V1.
insert into public.catalog_projects (id, artist_id, title, status, genre, bpm, key, cover_image, cover_image_name, assignee, release_date, created_at, updated_at)
select id, artist_id, title, status, genre, bpm, key, cover_image, cover_image_name, assignee, release_date, coalesce(created_at, now()), coalesce(updated_at, created_at, now())
from public.catalog_items
on conflict (id) do nothing;

insert into public.catalog_versions (project_id, version_number, stage, status, audio_file, audio_file_name, duration, bpm, key, genre, lyrics, created_at, updated_at)
select i.id, 1, 'guia', i.status, i.audio_file, i.audio_file_name, i.duration, i.bpm, i.key, i.genre, i.lyrics, coalesce(i.created_at, now()), coalesce(i.updated_at, i.created_at, now())
from public.catalog_items i
where not exists (select 1 from public.catalog_versions v where v.project_id = i.id and v.version_number = 1);

update public.catalog_projects p
set primary_version_id = v.id
from public.catalog_versions v
where v.project_id = p.id and v.version_number = 1 and p.primary_version_id is null;

alter table public.catalog_projects enable row level security;
alter table public.catalog_versions enable row level security;
alter table public.catalog_version_files enable row level security;
alter table public.catalog_version_comments enable row level security;

grant select, insert, update, delete on public.catalog_projects, public.catalog_versions, public.catalog_version_files, public.catalog_version_comments to authenticated;

create policy "Catalog members can read projects" on public.catalog_projects for select to authenticated using (public.has_artist_access(artist_id, 'catalog'));
create policy "Catalog members can write projects" on public.catalog_projects for all to authenticated using (public.has_artist_access(artist_id, 'catalog')) with check (public.has_artist_access(artist_id, 'catalog'));
create policy "Catalog members can read versions" on public.catalog_versions for select to authenticated using (exists (select 1 from public.catalog_projects p where p.id = project_id and public.has_artist_access(p.artist_id, 'catalog')));
create policy "Catalog members can write versions" on public.catalog_versions for all to authenticated using (exists (select 1 from public.catalog_projects p where p.id = project_id and public.has_artist_access(p.artist_id, 'catalog'))) with check (exists (select 1 from public.catalog_projects p where p.id = project_id and public.has_artist_access(p.artist_id, 'catalog')));
create policy "Catalog members can read files" on public.catalog_version_files for select to authenticated using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog')));
create policy "Catalog members can write files" on public.catalog_version_files for all to authenticated using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog'))) with check (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog')));
create policy "Catalog members can read comments" on public.catalog_version_comments for select to authenticated using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog')));
create policy "Catalog members can write comments" on public.catalog_version_comments for all to authenticated using (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog'))) with check (exists (select 1 from public.catalog_versions v join public.catalog_projects p on p.id = v.project_id where v.id = version_id and public.has_artist_access(p.artist_id, 'catalog')));
