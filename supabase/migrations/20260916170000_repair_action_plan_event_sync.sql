-- Migration final autocontida para instalações que aplicaram apenas parte do histórico.
-- Pode ser executada mais de uma vez com segurança.
alter table public.events
  add column if not exists task_id text,
  add column if not exists source text not null default 'manual',
  add column if not exists recurrence_rule text,
  add column if not exists assignee_kind text not null default 'owner',
  add column if not exists assignee_member_id uuid references public.artist_members(id) on delete set null;

create unique index if not exists events_action_plan_task_unique
  on public.events (artist_id, task_id)
  where source = 'action_plan' and task_id is not null;

create or replace function public.can_manage_artist_plan_events(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.artists a
    where a.id = aid and a.user_id = auth.uid()
  )
  or exists (
    select 1 from public.artist_members member
    where member.artist_id = aid
      and member.user_id = auth.uid()
      and member.status = 'active'
      and (to_jsonb(member.access_levels) ? 'plan' or to_jsonb(member.access_levels) ? 'full')
  );
$$;

grant execute on function public.can_manage_artist_plan_events(uuid) to authenticated;

drop policy if exists "Plan members can insert linked task events" on public.events;
drop policy if exists "Plan members can update linked task events" on public.events;
drop policy if exists "Plan members can delete linked task events" on public.events;
drop policy if exists "Plan owners and members can insert linked task events" on public.events;
drop policy if exists "Plan owners and members can update linked task events" on public.events;
drop policy if exists "Plan owners and members can delete linked task events" on public.events;

create policy "Plan owners and members can insert linked task events"
on public.events for insert to authenticated
with check (source = 'action_plan' and public.can_manage_artist_plan_events(artist_id));

create policy "Plan owners and members can update linked task events"
on public.events for update to authenticated
using (source = 'action_plan' and public.can_manage_artist_plan_events(artist_id))
with check (source = 'action_plan' and public.can_manage_artist_plan_events(artist_id));

create policy "Plan owners and members can delete linked task events"
on public.events for delete to authenticated
using (source = 'action_plan' and public.can_manage_artist_plan_events(artist_id));

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
declare result public.events;
begin
  if not public.can_manage_artist_plan_events(p_artist_id) then
    raise exception 'agenda_permission_denied: usuário não pode sincronizar eventos deste artista' using errcode = '42501';
  end if;

  if p_deadline is null then
    delete from public.events where artist_id = p_artist_id and task_id = p_task_id and source = 'action_plan';
    return null;
  end if;

  insert into public.events (
    artist_id, title, type, date, start_time, end_time, location, description,
    status, task_id, source, recurrence_rule, assignee_kind, assignee_member_id
  ) values (
    p_artist_id, p_title, 'task', p_deadline, null, null, null,
    format('Plano de Ação · %s', p_strategy_title),
    case when p_completed then 'completed' else 'scheduled' end,
    p_task_id, 'action_plan', p_recurrence,
    case when p_assignee_kind in ('owner', 'member', 'unassigned') then p_assignee_kind else 'unassigned' end,
    case when p_assignee_kind = 'member' then p_assignee_member_id else null end
  )
  on conflict (artist_id, task_id) where source = 'action_plan' and task_id is not null
  do update set
    title = excluded.title,
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
