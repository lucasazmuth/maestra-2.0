-- Fundação para calendários externos. Tokens OAuth nunca ficam no cliente nem nestas tabelas:
-- a Edge Function guarda o segredo no ambiente seguro e usa apenas o id da conexão aqui.

alter table public.events
  add column if not exists timezone text,
  add column if not exists provider text,
  add column if not exists external_id text,
  add column if not exists external_etag text,
  add column if not exists external_ical_uid text,
  add column if not exists external_calendar_id text,
  add column if not exists sync_status text,
  add column if not exists reminders jsonb not null default '[]'::jsonb,
  add column if not exists attendees jsonb not null default '[]'::jsonb;

create index if not exists events_external_identity_idx
  on public.events (provider, external_calendar_id, external_id)
  where provider is not null and external_id is not null;

create table if not exists public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_account_id text,
  account_email text,
  status text not null default 'connected',
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_id)
);

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  connection_id uuid not null references public.calendar_connections(id) on delete cascade,
  provider text not null,
  external_calendar_id text not null,
  name text not null,
  description text,
  color text,
  timezone text,
  is_primary boolean not null default false,
  import_enabled boolean not null default true,
  export_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_calendar_id)
);

create table if not exists public.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  source_id uuid not null references public.calendar_sources(id) on delete cascade,
  external_event_id text not null,
  external_etag text,
  external_ical_uid text,
  direction text not null default 'bidirectional',
  conflict_status text not null default 'none',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_event_id),
  unique (event_id, source_id)
);

create table if not exists public.calendar_sync_state (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null unique references public.calendar_sources(id) on delete cascade,
  sync_token text,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  status text not null default 'idle',
  last_error text,
  consecutive_failures integer not null default 0
);

create index if not exists calendar_sources_artist_idx on public.calendar_sources (artist_id);
create index if not exists calendar_event_links_event_idx on public.calendar_event_links (event_id);

alter table public.calendar_connections enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_event_links enable row level security;
alter table public.calendar_sync_state enable row level security;

drop policy if exists calendar_connections_owner on public.calendar_connections;
create policy calendar_connections_owner on public.calendar_connections for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists calendar_sources_artist_access on public.calendar_sources;
create policy calendar_sources_artist_access on public.calendar_sources for all to authenticated
  using (public.has_artist_access(artist_id, 'plan'))
  with check (public.has_artist_access(artist_id, 'plan'));

drop policy if exists calendar_event_links_artist_access on public.calendar_event_links;
create policy calendar_event_links_artist_access on public.calendar_event_links for all to authenticated
  using (exists (
    select 1 from public.calendar_sources s
    where s.id = source_id and public.has_artist_access(s.artist_id, 'plan')
  ))
  with check (exists (
    select 1 from public.calendar_sources s
    where s.id = source_id and public.has_artist_access(s.artist_id, 'plan')
  ));

drop policy if exists calendar_sync_state_artist_access on public.calendar_sync_state;
create policy calendar_sync_state_artist_access on public.calendar_sync_state for all to authenticated
  using (exists (
    select 1 from public.calendar_sources s
    where s.id = source_id and public.has_artist_access(s.artist_id, 'plan')
  ))
  with check (exists (
    select 1 from public.calendar_sources s
    where s.id = source_id and public.has_artist_access(s.artist_id, 'plan')
  ));

comment on table public.calendar_connections is 'Conexões OAuth; tokens ficam exclusivamente no ambiente seguro das Edge Functions.';
comment on table public.calendar_sync_state is 'Cursor incremental do provedor. Google usa syncToken e notificações apenas como gatilho.';
