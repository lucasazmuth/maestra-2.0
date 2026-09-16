-- Responsabilidade normalizada dos compromissos da agenda.
alter table public.events
  add column if not exists assignee_kind text not null default 'owner',
  add column if not exists assignee_member_id uuid references public.artist_members(id) on delete set null;

-- Eventos espelho antigos não carregavam responsável; não atribuí-los ao dono evita uma
-- atribuição falsa. O Plano de Ação passa a preencher isso nas próximas sincronizações.
update public.events
   set assignee_kind = 'unassigned'
 where source = 'action_plan'
   and (assignee_member_id is null or assignee_kind = 'owner');

alter table public.events
  drop constraint if exists events_assignee_kind_check;

alter table public.events
  add constraint events_assignee_kind_check
  check (assignee_kind in ('owner', 'member', 'unassigned'));

create index if not exists events_artist_assignee_date_idx
  on public.events (artist_id, assignee_kind, assignee_member_id, date);

-- Eventos de tarefas precisam ser sincronizados como uma operação única. Além de evitar a
-- janela entre find/update/insert, isso também evita que o select final seja bloqueado por uma
-- política de leitura diferente da política de escrita.
create or replace function public.upsert_action_plan_event(
  p_artist_id uuid,
  p_task_id text,
  p_title text,
  p_strategy_title text,
  p_deadline date default null,
  p_completed boolean default false,
  p_recurrence text default null,
  p_assignee_kind text default 'unassigned',
  p_assignee_member_id uuid default null
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.events;
begin
  if not public.can_manage_artist_plan_events(p_artist_id) then
    raise exception 'Você não tem permissão para atualizar a agenda deste artista.' using errcode = '42501';
  end if;

  if p_deadline is null then
    delete from public.events
     where artist_id = p_artist_id
       and task_id = p_task_id
       and source = 'action_plan';
    return null;
  end if;

  insert into public.events (
    artist_id, title, type, date, start_time, end_time, location, description,
    status, task_id, source, recurrence_rule, assignee_kind, assignee_member_id
  ) values (
    p_artist_id, p_title, 'task', p_deadline, null, null, null,
    format('Plano de Ação · %s', p_strategy_title),
    case when p_completed then 'completed' else 'scheduled' end, p_task_id, 'action_plan', p_recurrence,
    case when p_assignee_kind in ('owner', 'member', 'unassigned') then p_assignee_kind else 'unassigned' end,
    case when p_assignee_kind = 'member' then p_assignee_member_id else null end
  )
  on conflict (artist_id, task_id) where source = 'action_plan' and task_id is not null
  do update set
    title = excluded.title,
    type = excluded.type,
    date = excluded.date,
    status = case when p_completed then 'completed' else 'scheduled' end,
    description = excluded.description,
    recurrence_rule = excluded.recurrence_rule,
    assignee_kind = excluded.assignee_kind,
    assignee_member_id = excluded.assignee_member_id,
    updated_at = now()
  returning * into result;

  return result;
end;
$$;

grant execute on function public.upsert_action_plan_event(uuid, text, text, text, date, boolean, text, text, uuid)
  to authenticated;
