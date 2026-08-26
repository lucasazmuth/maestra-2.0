-- CRM de vendas da Maestra (time de business development).
--
-- Há três coisas diferentes chamadas de CRM neste produto, e o prefixo é o que as separa:
--
--   crm_*    → CRM DO ARTISTA (contratantes, casas de show). Preso a `artist_id NOT NULL`,
--              modelado e ainda sem uso, reservado para o módulo Marketing do perfil.
--              Este arquivo NÃO toca nele.
--   sales_*  → CRM DA MAESTRA. Negócios que o nosso time de vendas prospecta. É o que nasce aqui.
--
-- (A tela de /admin/crm, apesar do nome, é um painel de ativação de produto — nem um nem outro.)
--
-- Duas escolhas de modelagem que corrigem defeitos observados no crm_*:
--   - etapas viram TABELA, não `stage_id text default 'lead'`: sem isso, mudar as colunas do
--     kanban exige deploy, e cada consulta passa a comparar string solta;
--   - o histórico vive só em `sales_activities`. O crm_deals guarda histórico em jsonb E em
--     crm_deal_history ao mesmo tempo — duas fontes que divergem, e relatório de funil precisa
--     de linha, não de array.

-- ---------------------------------------------------------------------------------------------
-- Papel
-- ---------------------------------------------------------------------------------------------

-- `platform_admins.role` tem CHECK, e ele so admitia 'admin' e 'super_admin'. Abrir para 'sales'
-- e obrigatorio, e o CHECK vale a pena manter: papel escrito errado ('vendas', 'Sales') falharia
-- em silencio como "sem acesso" em vez de estourar na hora do cadastro.
alter table public.platform_admins drop constraint if exists platform_admins_role_check;
alter table public.platform_admins add constraint platform_admins_role_check
  check (role in ('admin', 'super_admin', 'sales'));

-- `platform_admins.role` já existia (default 'admin') e era ignorada: o guard só checava se a
-- linha existia. Estas funções passam a dar sentido a ela, e ficam como ponto único da regra —
-- repetir a subconsulta em cada policy é como uma delas acaba divergindo das outras.
--
-- `security definer` porque a própria platform_admins tem RLS: sem isso a checagem enxergaria
-- apenas o que o usuário já pode ver, e a resposta seria sempre falso.
--
-- `super_admin` entra nas duas listas porque JA EXISTE no banco (é o papel do dono da conta) e
-- não é derivável de 'admin': tratar só 'admin' trancaria justamente quem tem mais acesso para
-- fora do próprio CRM. Papel desconhecido não vira admin por omissão — a lista é explícita.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.role in ('admin', 'super_admin')
  )
$$;

comment on function public.is_platform_admin() is
  'Admin pleno da plataforma (admin ou super_admin). Papel sales NAO passa aqui.';

create or replace function public.can_use_sales_crm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.role in ('admin', 'super_admin', 'sales')
  )
$$;

comment on function public.can_use_sales_crm() is
  'Quem opera o CRM de vendas: admin, super_admin ou vendedor (role = sales).';

-- ---------------------------------------------------------------------------------------------
-- Funis e etapas
-- ---------------------------------------------------------------------------------------------

create table if not exists public.sales_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_pipelines is
  'Funis de venda da Maestra. Mais de um (ex.: Artistas, Gravadoras) sem tocar em codigo.';

-- Um só funil padrão. O índice parcial deixa o banco recusar o segundo, em vez de a aplicação
-- ter que escolher um "primeiro" arbitrário na hora de abrir o quadro.
create unique index if not exists sales_pipelines_um_padrao
  on public.sales_pipelines (is_default) where is_default;

create table if not exists public.sales_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.sales_pipelines (id) on delete cascade,
  name text not null,
  position smallint not null default 0,
  -- 'open' segue no quadro; 'won' e 'lost' encerram o negocio. E o `kind` que diz o que a coluna
  -- SIGNIFICA — sem ele, saber se um negocio fechou dependeria de comparar o nome da etapa.
  kind text not null default 'open' check (kind in ('open', 'won', 'lost')),
  default_probability numeric(4, 3) not null default 0.3
    check (default_probability >= 0 and default_probability <= 1),
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_stages is
  'Colunas do kanban. Sao dado, nao string fixa no codigo.';

create index if not exists sales_stages_por_funil
  on public.sales_stages (pipeline_id, position);

-- ---------------------------------------------------------------------------------------------
-- Empresas e contatos
-- ---------------------------------------------------------------------------------------------

create table if not exists public.sales_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  website text,
  phone text,
  email text,
  city text,
  state text,
  owner_id uuid references auth.users (id) on delete set null,
  tags text[],
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_companies is
  'Empresas prospectadas pelo time de vendas da Maestra.';

create table if not exists public.sales_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.sales_companies (id) on delete set null,
  name text not null,
  email text,
  phone text,
  role text,
  owner_id uuid references auth.users (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sales_contacts is
  'Pessoas dentro das empresas prospectadas.';

create index if not exists sales_contacts_por_empresa
  on public.sales_contacts (company_id);

-- ---------------------------------------------------------------------------------------------
-- Negócios
-- ---------------------------------------------------------------------------------------------

create table if not exists public.sales_deals (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.sales_pipelines (id) on delete restrict,
  stage_id uuid not null references public.sales_stages (id) on delete restrict,
  company_id uuid references public.sales_companies (id) on delete set null,
  contact_id uuid references public.sales_contacts (id) on delete set null,

  -- A ponte com o produto: quando o lead JA e uma conta da Maestra (veio do funil de ativacao),
  -- e este campo que amarra o negocio a ela. Sem ele o time prospectaria quem ja e cliente.
  linked_user_id uuid references auth.users (id) on delete set null,

  title text not null,
  value numeric(12, 2) not null default 0,
  probability numeric(4, 3) check (probability >= 0 and probability <= 1),
  expected_close_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  source text,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  lost_reason text,

  -- Ordem do cartao DENTRO da coluna. Numeric (e nao inteiro) para inserir entre dois vizinhos
  -- pela media, sem reescrever a coluna inteira a cada arrasto.
  board_position numeric not null default 0,

  owner_id uuid references auth.users (id) on delete set null,
  archived boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Perda sem motivo nao vira relatorio depois, so vira "perdemos varios".
  constraint sales_deals_perda_tem_motivo
    check (status <> 'lost' or (lost_reason is not null and length(btrim(lost_reason)) > 0))
);

comment on table public.sales_deals is
  'Negocios do CRM de vendas da Maestra. Nao confundir com crm_deals, que e do artista.';

comment on column public.sales_deals.linked_user_id is
  'Conta da Maestra por tras do lead, quando ele veio do funil de ativacao (source = inbound).';

create index if not exists sales_deals_no_quadro
  on public.sales_deals (pipeline_id, stage_id, board_position) where not archived;
create index if not exists sales_deals_por_dono on public.sales_deals (owner_id);
create index if not exists sales_deals_por_conta on public.sales_deals (linked_user_id);

-- ---------------------------------------------------------------------------------------------
-- Linha do tempo
-- ---------------------------------------------------------------------------------------------

create table if not exists public.sales_activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.sales_deals (id) on delete cascade,
  kind text not null check (kind in ('note', 'call', 'email', 'meeting', 'whatsapp', 'task', 'stage_change')),
  body text,
  -- Para stage_change: { "de": "<uuid>", "para": "<uuid>" }. Guardar o id, e nao o nome, porque
  -- renomear a etapa nao pode reescrever o passado.
  metadata jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  done_at timestamptz,
  owner_id uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.sales_activities is
  'Linha do tempo do negocio: anotacoes, tarefas, contatos e mudanca de etapa, numa fonte so.';

create index if not exists sales_activities_por_negocio
  on public.sales_activities (deal_id, created_at desc);
-- Agenda do vendedor: o que esta pendente e vencendo.
create index if not exists sales_activities_pendentes
  on public.sales_activities (owner_id, due_at) where done_at is null;

-- ---------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------

-- O time de vendas enxerga o pipeline INTEIRO: `owner_id` serve para atribuir e medir, nao para
-- esconder. Vendedor que so ve o proprio funil nao consegue cobrir ferias de colega nem revisar
-- duplicidade de prospeccao.

alter table public.sales_pipelines  enable row level security;
alter table public.sales_stages     enable row level security;
alter table public.sales_companies  enable row level security;
alter table public.sales_contacts   enable row level security;
alter table public.sales_deals      enable row level security;
alter table public.sales_activities enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'sales_pipelines', 'sales_stages', 'sales_companies',
    'sales_contacts', 'sales_deals', 'sales_activities'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrita', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_use_sales_crm())',
      t || '_leitura', t
    );
    -- `for all` cobre insert, update e delete. O `with check` e o que impede escrever uma linha
    -- que o autor nao poderia ler de volta.
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.can_use_sales_crm()) with check (public.can_use_sales_crm())',
      t || '_escrita', t
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Funil inicial
-- ---------------------------------------------------------------------------------------------

-- Um quadro vazio nao tem colunas, e sem coluna nao ha onde soltar o primeiro negocio. Estas
-- etapas sao ponto de partida editavel, nao regra: e justamente por isso que elas sao dado.
insert into public.sales_pipelines (name, is_default, position)
select 'Vendas Maestra', true, 0
where not exists (select 1 from public.sales_pipelines);

insert into public.sales_stages (pipeline_id, name, position, kind, default_probability, color)
select p.id, e.name, e.position, e.kind, e.prob, e.color
from public.sales_pipelines p
cross join (values
  ('Lead',          0::smallint, 'open', 0.10, '#7c8db3'),
  ('Contato feito', 1::smallint, 'open', 0.25, '#3361ff'),
  ('Reunião',       2::smallint, 'open', 0.45, '#7136cf'),
  ('Proposta',      3::smallint, 'open', 0.65, '#c98a12'),
  ('Negociação',    4::smallint, 'open', 0.80, '#1f8f5f'),
  ('Ganho',         5::smallint, 'won',  1.00, '#1c7a52'),
  ('Perdido',       6::smallint, 'lost', 0.00, '#b32d45')
) as e(name, position, kind, prob, color)
where p.is_default
  and not exists (select 1 from public.sales_stages s where s.pipeline_id = p.id);

-- Correcao de acentuacao: as etapas foram semeadas sem acento na primeira aplicacao. Sao texto
-- de tela, entao voltam a grafia correta. Update por nome exato para nao pisar em etapa que o
-- time ja tenha renomeado.
update public.sales_stages set name = 'Reunião'    where name = 'Reuniao';
update public.sales_stages set name = 'Negociação' where name = 'Negociacao';

-- ---------------------------------------------------------------------------------------------
-- Leads manuais e time de vendas
-- ---------------------------------------------------------------------------------------------

alter table public.sales_deals add column if not exists tags text[];

comment on column public.sales_deals.tags is
  'Etiquetas livres do negocio (ex.: gravadora, indicacao, evento).';

-- GIN porque a busca por etiqueta e "contem", nao igualdade.
create index if not exists sales_deals_por_tag on public.sales_deals using gin (tags);

-- Quem pode ser responsavel por um negocio.
--
-- Precisa ser SECURITY DEFINER porque `auth.users` nao e legivel pelo cliente: sem isto o campo
-- "responsavel" so teria uuid, sem nome de gente. Devolve APENAS quem ja esta em
-- platform_admins, e so para quem opera o CRM — nao e uma porta para listar usuarios do produto.
create or replace function public.sales_team()
returns table (user_id uuid, email text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select pa.user_id, u.email::text, pa.role
  from public.platform_admins pa
  join auth.users u on u.id = pa.user_id
  where public.can_use_sales_crm()
  order by u.email
$$;

comment on function public.sales_team() is
  'Time que opera o CRM de vendas, para o campo de responsavel. Vazia para quem nao opera o CRM.';

revoke all on function public.sales_team() from public, anon;
grant execute on function public.sales_team() to authenticated;
