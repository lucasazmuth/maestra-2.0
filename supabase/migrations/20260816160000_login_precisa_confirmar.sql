-- Distinguir "senha errada" de "conta não confirmada" no login.
--
-- O Supabase responde `invalid_credentials` para os dois casos — e também para conta criada pelo
-- Google, que não tem senha. É anti-enumeração: de fora, não há como saber qual dos três é. Isso
-- deixava quem se cadastrou e não confirmou sem caminho de volta, porque o app não tinha como
-- levá-la à tela do código.
--
-- Esta função é o único ponto do sistema que consegue separar os casos, e responde UMA pergunta
-- só: "o e-mail e a senha estão certos E a conta está sem confirmar?". Nada mais vaza — para
-- qualquer outra combinação a resposta é idêntica à de um e-mail que nem existe.
--
-- Por que a senha precisa entrar na conta: sem ela, bastaria digitar o e-mail de outra pessoa
-- para descobrir que ela tem cadastro pendente (enumeração) e ainda disparar um código para a
-- caixa dela (spam).

-- ── Verificação ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_login_precisa_confirmar(
  p_email    text,
  p_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_hash    text;
  v_pendente boolean;
begin
  if p_email is null or p_password is null then
    return false;
  end if;

  select u.encrypted_password, u.email_confirmed_at is null
    into v_hash, v_pendente
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.deleted_at is null
   limit 1;

  -- Conta inexistente, ou já confirmada, ou sem senha (criada pelo Google): mesma resposta.
  if v_hash is null or v_pendente is not true then
    return false;
  end if;

  -- Mesma comparação que o GoTrue faz: bcrypt do que foi digitado contra o hash guardado.
  return crypt(p_password, v_hash) = v_hash;
end;
$$;

-- NÃO exposta ao cliente. Só a service role chama, de dentro da edge function `auth-login-hint`,
-- que aplica limite de tentativas. Publicar isto no PostgREST daria um oráculo de senha aberto.
revoke all on function public.fn_login_precisa_confirmar(text, text) from public, anon, authenticated;
grant execute on function public.fn_login_precisa_confirmar(text, text) to service_role;

comment on function public.fn_login_precisa_confirmar(text, text) is
  'Responde se o par e-mail/senha está correto E a conta ainda não confirmou o e-mail. Uso exclusivo da edge function auth-login-hint.';

-- ── Limite de tentativas ────────────────────────────────────────────────────────────────────
-- A função acima distingue senha certa de errada em contas não confirmadas — informação que o
-- Supabase não dava. O prêmio é baixo (conta pendente não tem dado e não loga nem com a senha
-- certa), mas senha reaproveitada em outro serviço é risco real, então a força bruta precisa
-- esbarrar em algo.
create table if not exists public.auth_hint_attempts (
  id           bigserial primary key,
  ip           text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists auth_hint_attempts_ip_idx
  on public.auth_hint_attempts (ip, attempted_at desc);

-- Sem policy alguma: a tabela é escrita só pela service role e não deve ser lida por ninguém.
alter table public.auth_hint_attempts enable row level security;

comment on table public.auth_hint_attempts is
  'Contagem de chamadas a auth-login-hint por IP, para limitar tentativas. Sem valor analítico.';
