-- Exclusão de conta com efeito real (LGPD art. 18, VI).
--
-- Até aqui `account_deletion_requests` só registrava o pedido e o suporte era avisado por e-mail;
-- a remoção dependia de alguém lembrar de executá-la à mão, sem prazo nem registro de conclusão.
-- Estas colunas fecham o ciclo: quando vence, quando foi cumprido e por quem.

alter table public.account_deletion_requests
  add column if not exists scheduled_purge_at timestamptz,
  add column if not exists purged_at          timestamptz,
  add column if not exists purged_by          uuid references auth.users (id),
  add column if not exists purge_note         text;

-- user_id precisa aceitar nulo para o registro SOBREVIVER à exclusão que ele documenta.
-- A rotina de remoção apaga todas as linhas que apontam para o usuário (senão o deleteUser falha
-- com "Database error deleting user"); soltando a referência antes, a linha deixa de apontar para
-- alguém e escapa da limpeza, preservando a prova de que o pedido foi cumprido — que é justamente
-- o que uma auditoria da ANPD pede.
alter table public.account_deletion_requests
  alter column user_id drop not null;

-- Prazo padrão de 30 dias a partir do pedido. Serve como janela de arrependimento e de
-- verificação de fraude (pedido feito por quem invadiu a conta), não como enrolação: a Política
-- promete atendimento "nos prazos legais", e a ANPD trabalha com 15 dias para a resposta ao
-- titular — o que já acontece pelo canal do encarregado.
alter table public.account_deletion_requests
  alter column scheduled_purge_at set default (now() + interval '30 days');

update public.account_deletion_requests
   set scheduled_purge_at = requested_at + interval '30 days'
 where scheduled_purge_at is null;

-- Fila de trabalho do admin: o que ainda não foi cumprido, mais urgente primeiro.
create index if not exists account_deletion_requests_pendentes_idx
  on public.account_deletion_requests (scheduled_purge_at)
  where purged_at is null;

comment on column public.account_deletion_requests.scheduled_purge_at is
  'Quando a eliminação pode ser executada. Antes disso o pedido é reversível pelo titular.';
comment on column public.account_deletion_requests.purged_at is
  'Quando a eliminação foi efetivamente executada. Nulo = pendente.';
