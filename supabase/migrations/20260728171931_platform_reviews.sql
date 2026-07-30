create table if not exists public.platform_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  page_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_reviews_comment_length
    check (comment is null or char_length(comment) <= 2000),
  constraint platform_reviews_page_path_length
    check (page_path is null or char_length(page_path) <= 500)
);

comment on table public.platform_reviews is
  'Avaliação atual da plataforma enviada por cada usuário autenticado.';

create index if not exists platform_reviews_updated_at_idx
  on public.platform_reviews (updated_at desc);

alter table public.platform_reviews enable row level security;

grant select, insert, update on table public.platform_reviews to authenticated;

create policy "Users can read their own platform review"
  on public.platform_reviews
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own platform review"
  on public.platform_reviews
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own platform review"
  on public.platform_reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
