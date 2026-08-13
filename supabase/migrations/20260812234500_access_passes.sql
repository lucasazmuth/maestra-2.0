-- Pass Access: código de uso único que libera o planejamento estratégico sem passar
-- pelo pagamento.
--
-- Motivação: a professora presenteia alunos pagando com o CPF dela, o que junta vários
-- usuários no mesmo cliente da Asaas e emite cobrança no nome errado. Com o pass, o
-- presente vira um código — sem cobrança, sem CPF de terceiro, com auditoria de quem usou.
--
-- Deliberadamente NÃO reaproveita discount_coupons: lá o uso é contado com SELECT + UPDATE
-- (não atômico), o que num código que libera produto pago viraria brecha de uso duplicado.
-- Aqui o uso único é garantido pelo banco, via UPDATE ... WHERE redeemed_at IS NULL.

create table if not exists public.access_passes (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  -- Pra quem/por que foi gerado (ex.: "Turma 2026.1 - aluno João").
  note               text,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz,
  -- Permite revogar um código já distribuído sem apagar o histórico.
  is_active          boolean not null default true,
  redeemed_by        uuid references auth.users(id) on delete set null,
  redeemed_at        timestamptz,
  redeemed_artist_id uuid references public.artists(id) on delete set null
);

-- Busca do resgate é sempre por code; o parcial acelera a listagem de disponíveis.
create index if not exists access_passes_unredeemed_idx
  on public.access_passes (created_at desc)
  where redeemed_at is null;

comment on table public.access_passes is
  'Códigos de uso único que liberam o perfil sem cobrança. Resgate só via edge function (service role).';

-- RLS ligada e SEM policies: nenhum cliente lê ou escreve direto, nem mesmo o dono do
-- código. Todo acesso passa pelas edge functions com service role, que validam quem pode
-- gerar (admin) e quem pode resgatar (dono do artista). Isso também impede que alguém
-- liste códigos não resgatados pelo PostgREST.
alter table public.access_passes enable row level security;
