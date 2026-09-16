-- O proprietário do artista pode editar o Plano de Ação mesmo sem existir em
-- artist_members. Os eventos espelho precisam seguir a mesma regra.
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
  or public.has_artist_access(aid, 'plan');
$$;

grant execute on function public.can_manage_artist_plan_events(uuid) to authenticated;

drop policy if exists "Plan members can insert linked task events" on public.events;
drop policy if exists "Plan members can update linked task events" on public.events;
drop policy if exists "Plan members can delete linked task events" on public.events;

create policy "Plan owners and members can insert linked task events"
on public.events
for insert
to authenticated
with check (
  source = 'action_plan'
  and public.can_manage_artist_plan_events(artist_id)
);

create policy "Plan owners and members can update linked task events"
on public.events
for update
to authenticated
using (
  source = 'action_plan'
  and public.can_manage_artist_plan_events(artist_id)
)
with check (
  source = 'action_plan'
  and public.can_manage_artist_plan_events(artist_id)
);

create policy "Plan owners and members can delete linked task events"
on public.events
for delete
to authenticated
using (
  source = 'action_plan'
  and public.can_manage_artist_plan_events(artist_id)
);
