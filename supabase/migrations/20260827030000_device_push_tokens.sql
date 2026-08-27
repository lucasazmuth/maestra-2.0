-- Tokens de push dos APARELHOS (app iOS/Android), ao lado dos de Web Push.
--
-- `push_subscriptions` guarda subscription de Web Push, que e do NAVEGADOR: endpoint mais duas
-- chaves, e nao funciona dentro de app nativo — no iOS o Web Push so existe no Safari e em PWA
-- instalado. O app precisa de APNs/FCM, e o que se guarda la e um token opaco por instalacao.
--
-- Sao duas tabelas, e nao uma com coluna de tipo, porque o formato do que se guarda e diferente
-- e o caminho de entrega tambem. Misturar obrigaria metade das colunas a serem nulas.

create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Token do servico de push do Expo (`ExpoPushToken[...]`), que fala com APNs e FCM por baixo.
  -- Unico: reinstalar o app gera outro, e a mesma pessoa pode ter varios aparelhos.
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  -- Atualizado a cada abertura. E o que permite limpar token de aparelho abandonado depois.
  last_seen_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

-- Mesma politica das subscriptions web: cada pessoa cuida das proprias, e o envio roda com
-- service role, que ignora RLS.
drop policy if exists "Users manage own device tokens" on public.device_push_tokens;
create policy "Users manage own device tokens"
  on public.device_push_tokens
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists device_push_tokens_user_id_idx
  on public.device_push_tokens (user_id);
