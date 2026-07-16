-- Eventos criados automaticamente a partir de prazo de tarefa pertencem ao
-- Plano de Ação. Colaboradores com acesso `plan` podem mantê-los, sem ganhar
-- acesso de edição aos compromissos manuais da Agenda.
create policy "Plan members can insert linked task events"
on public.events
for insert
to authenticated
with check (
  source = 'action_plan'
  and (select public.has_artist_access(artist_id, 'plan'))
);

create policy "Plan members can update linked task events"
on public.events
for update
to authenticated
using (
  source = 'action_plan'
  and (select public.has_artist_access(artist_id, 'plan'))
)
with check (
  source = 'action_plan'
  and (select public.has_artist_access(artist_id, 'plan'))
);

create policy "Plan members can delete linked task events"
on public.events
for delete
to authenticated
using (
  source = 'action_plan'
  and (select public.has_artist_access(artist_id, 'plan'))
);
