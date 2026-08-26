-- Acesso por MODULO do admin, para o time da Maestra.
--
-- O papel sozinho nao escala: suporte precisa de Usuarios e Avaliacoes, vendas precisa do CRM, e
-- cada combinacao viraria um papel novo. Aqui o papel diz o NIVEL (admin pleno ou nao) e a
-- concessao por modulo diz O QUE a pessoa alcanca.
--
-- admin e super_admin passam em tudo, sem precisar de linha nesta tabela.
--
-- (Conteudo aplicado no projeto tpwmzcgtidaxgxwqfxwf via MCP, em quatro migrations:
--  acessos_por_modulo_do_admin, listar_equipe_do_admin, gerir_equipe_do_admin.)

create table if not exists public.admin_module_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- CHECK de proposito: modulo escrito errado falharia em silencio como "sem acesso".
  module text not null check (module in (
    'dashboard', 'artistas', 'knowledge-base', 'cupons', 'pass-access',
    'usuarios', 'vendas', 'avaliacoes', 'push'
  )),
  granted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, module)
);

create index if not exists admin_module_access_por_pessoa
  on public.admin_module_access (user_id);

alter table public.admin_module_access enable row level security;

drop policy if exists admin_module_access_leitura on public.admin_module_access;
drop policy if exists admin_module_access_escrita on public.admin_module_access;

create policy admin_module_access_leitura on public.admin_module_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Conceder e revogar e SO de admin pleno. Sem isto quem tem um modulo poderia conceder a si
-- mesmo todos os outros, e a tela de acessos viraria um caminho para virar admin.
create policy admin_module_access_escrita on public.admin_module_access
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Ver o arquivo de migration anterior para is_platform_admin(). As funcoes abaixo sao
-- SECURITY DEFINER porque auth.users nao e legivel pelo cliente.

create or replace function public.meus_modulos_admin()
returns setof text language sql stable security definer set search_path = public as $$
  select m from unnest(array[
    'dashboard', 'artistas', 'knowledge-base', 'cupons', 'pass-access',
    'usuarios', 'vendas', 'avaliacoes', 'push'
  ]) as m where public.is_platform_admin()
  union
  select a.module from public.admin_module_access a where a.user_id = auth.uid()
$$;

-- O CRM passa a olhar o MODULO, nao o papel: um analista de suporte pode ganhar o CRM sem virar
-- "sales", e um vendedor pode perder o CRM sem sair do time.
create or replace function public.can_use_sales_crm()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin()
      or exists (select 1 from public.admin_module_access a
                 where a.user_id = auth.uid() and a.module = 'vendas')
$$;

create or replace function public.equipe_do_admin()
returns table (user_id uuid, email text, role text, modules text[], created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select pa.user_id, u.email::text, pa.role,
         coalesce((select array_agg(a.module order by a.module)
                   from public.admin_module_access a where a.user_id = pa.user_id),
                  array[]::text[]),
         pa.created_at
  from public.platform_admins pa
  join auth.users u on u.id = pa.user_id
  where public.is_platform_admin()
  order by u.email
$$;

-- E-mail EXATO, nao trecho: um `like` aqui viraria varredura da base de usuarios pelo painel.
create or replace function public.achar_conta_por_email(alvo text)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text from auth.users u
  where public.is_platform_admin() and lower(u.email) = lower(btrim(alvo))
  limit 1
$$;

-- `platform_admins` so tem policy de SELECT, e isso e proposital: uma policy de escrita ali e
-- literalmente "quem pode virar admin". A operacao passa por funcao, com a regra num lugar so.

create or replace function public.adicionar_ao_time_do_admin(alvo uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin pleno pode adicionar pessoas ao time.';
  end if;
  -- Entra sem modulo nenhum: o padrao seguro aqui e nada.
  insert into public.platform_admins (user_id, role) values (alvo, 'sales')
  on conflict (user_id) do nothing;
end $$;

create or replace function public.remover_do_time_do_admin(alvo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare papel_do_alvo text; plenos_restantes int;
begin
  if not public.is_platform_admin() then
    raise exception 'Apenas admin pleno pode remover pessoas do time.';
  end if;
  -- Tirar a si mesmo e o caminho mais curto para perder o painel sem ter como voltar.
  if alvo = auth.uid() then
    raise exception 'Voce nao pode tirar a si mesmo do time.';
  end if;

  select role into papel_do_alvo from public.platform_admins where user_id = alvo;
  if papel_do_alvo is null then return; end if;

  -- Sem admin pleno nao sobra ninguem que possa conceder acesso: o painel fica sem dono.
  if papel_do_alvo in ('admin', 'super_admin') then
    select count(*) into plenos_restantes from public.platform_admins
    where role in ('admin', 'super_admin') and user_id <> alvo;
    if plenos_restantes = 0 then
      raise exception 'Nao da para remover o ultimo admin pleno: o painel ficaria sem dono.';
    end if;
  end if;

  delete from public.admin_module_access where user_id = alvo;
  delete from public.platform_admins where user_id = alvo;
end $$;

revoke all on function public.meus_modulos_admin() from public, anon;
revoke all on function public.equipe_do_admin() from public, anon;
revoke all on function public.achar_conta_por_email(text) from public, anon;
revoke all on function public.adicionar_ao_time_do_admin(uuid) from public, anon;
revoke all on function public.remover_do_time_do_admin(uuid) from public, anon;

grant execute on function public.meus_modulos_admin() to authenticated;
grant execute on function public.equipe_do_admin() to authenticated;
grant execute on function public.achar_conta_por_email(text) to authenticated;
grant execute on function public.adicionar_ao_time_do_admin(uuid) to authenticated;
grant execute on function public.remover_do_time_do_admin(uuid) to authenticated;

-- Quem ja estava como 'sales' continua com o CRM depois da troca de regra.
insert into public.admin_module_access (user_id, module)
select pa.user_id, 'vendas' from public.platform_admins pa where pa.role = 'sales'
on conflict (user_id, module) do nothing;
