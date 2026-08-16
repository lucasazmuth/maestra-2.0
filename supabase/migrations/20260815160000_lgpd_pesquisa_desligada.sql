-- Estrutura da pesquisa (P2) — criada e DESLIGADA.
--
-- Nada aqui opera antes da aprovação do Comitê de Ética em Pesquisa da ESPM. A tabela existe para
-- que a primeira exportação já nasça registrada: sem log, não há como demonstrar depois qual
-- recorte saiu, quando e sob qual parecer.
--
-- O consentimento de pesquisa em si não precisa de tabela nova: é a linha kind='pesquisa' em
-- user_consents, com a mesma trilha e as mesmas garantias dos demais.

create table if not exists public.research_export_log (
  id                     uuid primary key default gen_random_uuid(),
  parecer_cep            text not null,
  titulares_autorizados  integer not null,
  casos_publicados       integer not null,
  casos_suprimidos       integer not null,
  arquivo                text not null,
  executado_em           timestamptz not null default now()
);

-- Sem policy de leitura nem de escrita: só a service role enxerga. O log é instrumento de
-- prestação de contas, não conteúdo de produto — nenhuma tela do app deve consultá-lo.
alter table public.research_export_log enable row level security;

comment on table public.research_export_log is
  'Registro de cada execução de scripts/research-export.ts. Só roda com parecer do CEP.';
comment on column public.research_export_log.casos_suprimidos is
  'Linhas descartadas por k-anonimato (combinação rara demais para ser considerada anônima).';
