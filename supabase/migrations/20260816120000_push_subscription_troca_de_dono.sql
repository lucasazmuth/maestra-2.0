-- Notificações web: permitir que a inscrição troque de dono junto com o dispositivo.
--
-- O endpoint de push pertence ao NAVEGADOR, não à conta — e a tabela tem UNIQUE (endpoint). Quando
-- alguém sai e outra pessoa entra no mesmo dispositivo, o navegador devolve o MESMO endpoint, e o
-- upsert do cliente cai em ON CONFLICT tentando atualizar a linha do dono anterior. A policy
-- `USING (auth.uid() = user_id)` barra isso, e a chamada morre com 403:
--
--   new row violates row-level security policy (USING expression) for table "push_subscriptions"
--
-- Resultado: em qualquer navegador onde uma segunda conta tenha entrado, ativar notificações
-- deixava de funcionar para sempre. O código já pretendia essa reatribuição ("o upsert atualiza
-- com segurança o user_id"), mas a RLS nunca permitiu.
--
-- A saída não é afrouxar a policy: liberar UPDATE em linha alheia deixaria qualquer autenticado
-- reescrever inscrições que não são dele. Em vez disso, uma função SECURITY DEFINER que faz a
-- troca de forma controlada, sempre em nome de quem chama.

create or replace function public.fn_registrar_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_expiration bigint default null
)
returns void
language plpgsql
security definer
-- search_path fixo: sem isso a função fica sujeita a resolução de nomes do chamador (é o
-- apontamento `function_search_path_mutable` do levantamento de segurança).
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'É preciso estar autenticado para registrar notificações.';
  end if;
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'Inscrição de push incompleta.';
  end if;

  -- APAGAR a linha anterior, e não apenas reatribuir: se ela sobrevivesse, o dono antigo
  -- continuaria recebendo notificações num aparelho que não é mais dele. O endpoint é físico —
  -- só uma pessoa por vez pode estar do outro lado.
  delete from public.push_subscriptions where endpoint = p_endpoint;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, expiration_time, updated_at)
  values (v_user, p_endpoint, p_p256dh, p_auth, p_expiration, now());
end;
$$;

-- O dono é sempre auth.uid(), nunca um parâmetro: não há como registrar em nome de terceiros.
revoke all on function public.fn_registrar_push_subscription(text, text, text, bigint) from public;
grant execute on function public.fn_registrar_push_subscription(text, text, text, bigint) to authenticated;

comment on function public.fn_registrar_push_subscription(text, text, text, bigint) is
  'Registra a inscrição de push do navegador para o usuário autenticado, transferindo o endpoint de um dono anterior quando o dispositivo troca de mãos.';
