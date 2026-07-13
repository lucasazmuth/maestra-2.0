-- Subscriptions Web Push por usuário/dispositivo.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.push_subscriptions
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

-- O trigger só agenda a chamada HTTP. A entrega, remoção de subscriptions expiradas
-- e tratamento de falhas ficam na Edge Function notification-push.
create or replace function public.dispatch_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
begin
  perform net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notification-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_webhook_secret')
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  return NEW;
exception when others then
  -- Push é complementar: uma falha de rede não pode impedir a notificação in-app.
  raise warning '[notifications] push dispatch failed: %', SQLERRM;
  return NEW;
end;
$$;

revoke all on function public.dispatch_notification_push() from public;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_notification_push();
