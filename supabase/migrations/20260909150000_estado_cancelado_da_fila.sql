-- Desistir não é falhar.
--
-- Cancelar gravava `estado = 'erro'` com a mensagem "Cancelado.", e a tela mostrava isso em
-- vermelho, ao lado do botão — dizendo que algo deu errado numa ação que a pessoa escolheu.
-- Pequeno, e do tipo que corrói a confiança no resto do que a tela diz.
--
-- Um estado próprio resolve sem string-matching: `aindaAndando` continua a não o contar (não há
-- o que esperar), `ultimoErro` só reporta 'erro', e o índice que impede pedidos duplicados olha
-- só para 'na_fila' e 'a_correr' — então quem cancelou pode pedir de novo na hora.

alter table public.audio_jobs drop constraint if exists audio_jobs_estado_check;
alter table public.audio_jobs add constraint audio_jobs_estado_check
  check (estado in ('na_fila', 'a_correr', 'pronto', 'erro', 'cancelado'));

create or replace function public.cancelar_trabalho_de_audio(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare achou boolean;
begin
  update public.audio_jobs j
     set estado = 'cancelado', erro = null, terminado_em = now()
   where j.id = p_id
     and j.estado = 'na_fila'
     and public.is_active_artist_team_member(j.artist_id);
  get diagnostics achou = row_count;
  return achou;
end $$;

revoke all on function public.cancelar_trabalho_de_audio(uuid) from public, anon;
grant execute on function public.cancelar_trabalho_de_audio(uuid) to authenticated;
