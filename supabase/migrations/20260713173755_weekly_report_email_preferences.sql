-- Preferências e deduplicação do resumo semanal por e-mail.
create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_report boolean not null default true,
  unsub_token uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

drop policy if exists "Users can read own email preferences" on public.email_preferences;
create policy "Users can read own email preferences"
  on public.email_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own email preferences" on public.email_preferences;
create policy "Users can insert own email preferences"
  on public.email_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own email preferences" on public.email_preferences;
create policy "Users can update own email preferences"
  on public.email_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- A constraint torna o dedup seguro contra duas execuções concorrentes do cron.
create unique index if not exists notifications_weekly_dedup_idx
  on public.notifications (user_id, artist_id, reference_type, reference_id)
  where source = 'weekly' and reference_type = 'weekly';

select cron.schedule(
  'weekly-report-weekly',
  '0 13 * * 1',
  $cron$
    select net.http_post(
      url := 'https://tpwmzcgtidaxgxwqfxwf.supabase.co/functions/v1/weekly-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    );
  $cron$
);
