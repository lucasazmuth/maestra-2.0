-- Link events generated from Action Plan tasks without requiring a relational task table.
alter table public.events
  add column if not exists task_id text,
  add column if not exists source text not null default 'manual';

create unique index if not exists events_action_plan_task_unique
  on public.events (artist_id, task_id)
  where source = 'action_plan' and task_id is not null;
