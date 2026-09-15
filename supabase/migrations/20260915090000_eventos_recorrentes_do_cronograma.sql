-- Uma tarefa contínua do Cronograma v1 é um evento mestre semanal. Mantemos um único registro
-- por tarefa para preservar o índice de idempotência do Plano de Ação.
alter table public.events
  add column if not exists recurrence_rule text;

alter table public.events
  drop constraint if exists events_recurrence_rule_check;

alter table public.events
  add constraint events_recurrence_rule_check
  check (recurrence_rule is null or recurrence_rule = 'weekly');
