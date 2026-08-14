-- Múltiplas conversas por artista no chat da Nyta.
--
-- Até aqui a UNIQUE(user_id, artist_id) amarrava tudo a UMA conversa por artista: a lista de
-- "Conversas" na tela era fachada, sempre apontando pro mesmo lugar. Este migration solta essa
-- amarra e dá à conversa o que ela precisa pra viver numa lista: título e ordenação por uso.

-- 1) Uma conversa deixa de ser única por (usuário, artista).
alter table public.nyta_conversations
  drop constraint if exists nyta_conversations_user_id_artist_id_key;

-- 2) Título da conversa. Fica nulo até a primeira mensagem do usuário, e a edge function
--    nyta-chat preenche com o começo dela — a UI cai em "Nova conversa" enquanto isso.
alter table public.nyta_conversations
  add column if not exists title text;

-- 3) A lista abre ordenada pela conversa mexida por último, filtrando por usuário e artista.
create index if not exists nyta_conversations_user_artist_updated_idx
  on public.nyta_conversations (user_id, artist_id, updated_at desc);

-- 4) Renomear e excluir conversa. Só existiam policies de SELECT e INSERT, então as duas ações
--    seriam negadas pela RLS.
drop policy if exists "Users can update own conversations" on public.nyta_conversations;
create policy "Users can update own conversations"
  on public.nyta_conversations for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own conversations" on public.nyta_conversations;
create policy "Users can delete own conversations"
  on public.nyta_conversations for delete
  using (user_id = auth.uid());

-- 5) O limite diário sai da CONVERSA e passa a ser por (usuário, artista, dia).
--
--    Ele morava em nyta_conversations.daily_count, o que era correto enquanto havia uma
--    conversa só — inclusive resistia ao "limpar histórico", como o comentário da edge
--    function explica. Com várias conversas isso vira um furo: abrir uma conversa nova
--    zeraria o contador e o limite diário deixaria de existir na prática.
create table if not exists public.nyta_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, artist_id, usage_date)
);

-- Só a edge function (service role) lê e escreve aqui; o front recebe o contador na resposta
-- do chat, nunca consultando a tabela. RLS ligada e sem policy nenhuma = ninguém mais entra.
alter table public.nyta_daily_usage enable row level security;

-- Preserva o consumo de hoje que já estava contado nas conversas, pra ninguém ganhar um lote
-- extra de mensagens no dia em que isto subir.
insert into public.nyta_daily_usage (user_id, artist_id, usage_date, count)
select user_id, artist_id, daily_count_date, sum(daily_count)
from public.nyta_conversations
where daily_count_date is not null and daily_count > 0
group by user_id, artist_id, daily_count_date
on conflict (user_id, artist_id, usage_date)
  do update set count = greatest(public.nyta_daily_usage.count, excluded.count);

-- As colunas daily_count/daily_count_date seguem em nyta_conversations sem uso a partir do
-- deploy da edge function; ficam de propósito, pra este migration não depender da ordem em
-- que migration e função sobem.
