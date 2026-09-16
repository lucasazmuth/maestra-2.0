-- A sincronização do Plano de Ação precisa funcionar para o dono mesmo quando ele não
-- existe em artist_members. A função anterior chamava has_artist_access(), que depende
-- da cadeia de políticas de membros e podia negar o proprietário na RPC.
create or replace function public.can_manage_artist_plan_events(aid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.artists a
    where a.id = aid
      and a.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.artist_members member
    where member.artist_id = aid
      and member.user_id = auth.uid()
      and member.status = 'active'
      and (member.access_levels ? 'plan' or member.access_levels ? 'full')
  );
$$;

grant execute on function public.can_manage_artist_plan_events(uuid) to authenticated;

-- Recria a RPC sem depender do select intermediário do cliente. O retorno continua sendo
-- `events`, preservando o contrato usado por versões antigas e novas da agenda.
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
     where artist_id = p_artist_id and task_id = p_task_id and source = 'action_plan';
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
