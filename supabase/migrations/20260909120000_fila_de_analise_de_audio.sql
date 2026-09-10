-- A FILA de análise de áudio.
--
-- Nada neste produto processava áudio até aqui. As quatro ferramentas que vêm a seguir — BPM e
-- tom, letra, análise sensorial e conversão — têm em comum precisarem de minutos de CPU e de
-- binários (ffmpeg, essentia, whisper) que não cabem numa edge function: o Deno Deploy não
-- executa binário e corta em segundos. Então o trabalho sai daqui para um worker de fora, e o
-- que os liga é esta tabela.
--
-- A fila é o desenho todo. O worker não conhece regra de negócio nenhuma: pede trabalho, faz, e
-- devolve. Trocar o que ele usa por dentro (uma API paga, outro modelo, outra máquina) não toca
-- em nada do lado de cá.
--
-- ⚠️ Sobre privilégios: neste projeto toda tabela nova nasce com TODOS os privilégios para
-- `anon` e `authenticated` (é o privilégio padrão da base). O `grant` sozinho não restringe —
-- é preciso revogar. Ver `20260908070000_certificado_de_autoria_so_leitura.sql`.

create table if not exists public.audio_jobs (
  id uuid primary key default gen_random_uuid(),

  -- O artista é o eixo de permissão e de cota. A versão é opcional porque a conversão pode
  -- correr sobre um arquivo que ainda não virou versão nenhuma.
  artist_id  uuid not null references public.artists(id) on delete cascade,
  version_id uuid references public.catalog_versions(id) on delete cascade,
  pedido_por uuid references auth.users(id) on delete set null,

  tipo text not null check (tipo in ('bpm_tom', 'letra', 'sensorial', 'converter')),

  estado text not null default 'na_fila'
    check (estado in ('na_fila', 'a_correr', 'pronto', 'erro')),

  -- O que o worker precisa saber para começar: balde, caminho e opções do tipo.
  entrada jsonb not null default '{}'::jsonb,
  -- Um resumo curto. O resultado de verdade vai para as tabelas próprias (`version_analysis`),
  -- porque é lá que ele é consultado depois, e não pelo id de um trabalho que ninguém guardou.
  resultado jsonb,
  erro text,

  tentativas smallint not null default 0,
  max_tentativas smallint not null default 3,
  -- O recuo entre tentativas mora aqui: enquanto for futuro, a reserva não pega o trabalho.
  correr_a_partir_de timestamptz not null default now(),

  -- A POSSE. Quem reservou, e até quando. Sem prazo, um worker que morre a meio leva o trabalho
  -- com ele e o pedido fica preso para sempre, sem ninguém perceber.
  worker text,
  posse_ate timestamptz,

  criado_em    timestamptz not null default now(),
  iniciado_em  timestamptz,
  terminado_em timestamptz
);

-- O índice DA FILA, parcial: com o tempo quase toda linha estará em 'pronto', e nenhuma delas
-- tem o que fazer aqui.
create index if not exists audio_jobs_fila_idx
  on public.audio_jobs (correr_a_partir_de, criado_em) where estado = 'na_fila';

-- Os presos: só interessam os que estão com posse.
create index if not exists audio_jobs_posse_idx
  on public.audio_jobs (posse_ate) where estado = 'a_correr';

-- O que a ficha da faixa lê.
create index if not exists audio_jobs_versao_idx
  on public.audio_jobs (version_id, tipo, criado_em desc);

-- Não deixa pedir duas vezes a mesma análise da mesma versão enquanto a primeira não termina.
-- É a trava mais barata contra o toque repetido no botão, e cada duplicado custa CPU de verdade.
create unique index if not exists audio_jobs_sem_duplicado_idx
  on public.audio_jobs (version_id, tipo) where estado in ('na_fila', 'a_correr');

alter table public.audio_jobs enable row level security;

-- LER é da equipe ativa do artista. ESCREVER não é de ninguém pelo cliente: quem enfileira é a
-- edge function `audio-job-create`, que é onde se confere permissão e cota, e quem atualiza é o
-- worker pelas funções abaixo. `estado` e `tentativas` são o que decide o que a máquina executa
-- e o que se cobra; um cliente que pudesse escrever podia zerar `tentativas` em ciclo.
revoke all on public.audio_jobs from anon;
revoke all on public.audio_jobs from authenticated;
grant select on public.audio_jobs to authenticated;

drop policy if exists "Active team can read audio jobs" on public.audio_jobs;
create policy "Active team can read audio jobs"
  on public.audio_jobs for select to authenticated
  using (public.is_active_artist_team_member(artist_id));

-- ─── Realtime ───────────────────────────────────────────────────────────────
--
-- É assim que a tela sabe que a análise acabou, sem ficar a perguntar. Mesmo mecanismo do chat
-- do Espaço JAM. O `replica identity full` é o que faz o evento carregar a linha inteira; sem
-- ele chega só a chave, e o cliente teria de ir buscar tudo de novo.
alter table public.audio_jobs replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.audio_jobs;
exception
  when duplicate_object then null;
end $$;

-- ─── Reservar, sem dois workers pegarem o mesmo ─────────────────────────────
--
-- `for update skip locked` é o coração disto: quem chega em segundo SALTA a linha já travada em
-- vez de esperar por ela. Sem o `skip locked`, dois workers serializam na mesma linha e o
-- segundo acaba por processar o mesmo trabalho quando o primeiro solta.
create or replace function public.reservar_trabalhos_de_audio(
  p_worker text,
  p_lote int default 1,
  p_posse_segundos int default 900
)
returns setof public.audio_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.audio_jobs j
     set estado = 'a_correr',
         worker = p_worker,
         iniciado_em = now(),
         posse_ate = now() + make_interval(secs => p_posse_segundos),
         tentativas = j.tentativas + 1
    from (
      select id from public.audio_jobs
       where estado = 'na_fila' and correr_a_partir_de <= now()
       order by criado_em
       limit greatest(p_lote, 1)
       for update skip locked
    ) alvo
   where j.id = alvo.id
  returning j.*;
end $$;

-- O worker chama de tempos em tempos para dizer que ainda está vivo. Sem isto, a transcrição de
-- uma faixa longa ultrapassa a posse e é reclamada por outra máquina no meio do caminho.
create or replace function public.pulsar_trabalho_de_audio(
  p_id uuid, p_worker text, p_posse_segundos int default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare achou boolean;
begin
  update public.audio_jobs
     set posse_ate = now() + make_interval(secs => p_posse_segundos)
   where id = p_id and worker = p_worker and estado = 'a_correr';
  get diagnostics achou = row_count;
  return achou;
end $$;

-- ⚠️ A cláusula do `worker` não é enfeite em nenhuma das duas funções abaixo: um worker que
-- perdeu a posse e acorda dez minutos depois não pode escrever por cima do resultado de quem
-- de facto fez o trabalho.
create or replace function public.concluir_trabalho_de_audio(
  p_id uuid, p_worker text, p_resultado jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare achou boolean;
begin
  update public.audio_jobs
     set estado = 'pronto', resultado = p_resultado, erro = null,
         terminado_em = now(), posse_ate = null
   where id = p_id and worker = p_worker and estado = 'a_correr';
  get diagnostics achou = row_count;
  return achou;
end $$;

-- Recuo exponencial com um pouco de sorte no meio: 30s, 60s, 120s… O jitter existe para que
-- vinte trabalhos que falharam juntos (a rede caiu) não voltem todos no mesmo segundo.
--
-- `p_retentavel` falso é para o que não adianta repetir: formato que o ffmpeg não abre, áudio de
-- zero segundo, arquivo corrompido. Gastar três tentativas a falhar da mesma maneira só atrasa
-- a resposta a quem está à espera.
create or replace function public.falhar_trabalho_de_audio(
  p_id uuid, p_worker text, p_erro text, p_retentavel boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare achou boolean;
begin
  update public.audio_jobs j
     set estado = case
           when p_retentavel and j.tentativas < j.max_tentativas then 'na_fila' else 'erro' end,
         erro = p_erro,
         correr_a_partir_de = case
           when p_retentavel and j.tentativas < j.max_tentativas
           then now() + make_interval(secs => 30 * power(2, j.tentativas - 1)::int + floor(random() * 10)::int)
           else j.correr_a_partir_de end,
         terminado_em = case
           when p_retentavel and j.tentativas < j.max_tentativas then null else now() end,
         worker = null, posse_ate = null
   where j.id = p_id and j.worker = p_worker and j.estado = 'a_correr';
  get diagnostics achou = row_count;
  return achou;
end $$;

-- Os presos: worker que morreu, máquina que o Fly desligou, deploy no meio do trabalho. Devolve
-- à fila enquanto houver tentativa, e desiste depois. Chamado por cron.
create or replace function public.devolver_trabalhos_de_audio_presos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare quantos int;
begin
  update public.audio_jobs j
     set estado = case when j.tentativas < j.max_tentativas then 'na_fila' else 'erro' end,
         erro = case when j.tentativas < j.max_tentativas then j.erro
                     else 'O processamento não respondeu a tempo.' end,
         terminado_em = case when j.tentativas < j.max_tentativas then null else now() end,
         worker = null, posse_ate = null
   where j.estado = 'a_correr' and j.posse_ate < now();
  get diagnostics quantos = row_count;
  return quantos;
end $$;

-- Quem cancela é a pessoa, e só o que ainda não começou: interromper um trabalho a meio não é
-- possível de um lado só, e marcar 'erro' o que a máquina ainda está a fazer produziria uma
-- linha que mente enquanto a CPU continua a girar.
create or replace function public.cancelar_trabalho_de_audio(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare achou boolean;
begin
  update public.audio_jobs j
     set estado = 'erro', erro = 'Cancelado.', terminado_em = now()
   where j.id = p_id
     and j.estado = 'na_fila'
     and public.is_active_artist_team_member(j.artist_id);
  get diagnostics achou = row_count;
  return achou;
end $$;

-- As do worker são SÓ do serviço. A de cancelar é da pessoa, e confere a equipe lá dentro.
revoke all on function public.reservar_trabalhos_de_audio(text, int, int) from public, anon, authenticated;
revoke all on function public.pulsar_trabalho_de_audio(uuid, text, int) from public, anon, authenticated;
revoke all on function public.concluir_trabalho_de_audio(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.falhar_trabalho_de_audio(uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.devolver_trabalhos_de_audio_presos() from public, anon, authenticated;

grant execute on function public.reservar_trabalhos_de_audio(text, int, int) to service_role;
grant execute on function public.pulsar_trabalho_de_audio(uuid, text, int) to service_role;
grant execute on function public.concluir_trabalho_de_audio(uuid, text, jsonb) to service_role;
grant execute on function public.falhar_trabalho_de_audio(uuid, text, text, boolean) to service_role;
grant execute on function public.devolver_trabalhos_de_audio_presos() to service_role;
-- ⚠️ O `revoke` vem ANTES, e é o que importa: em Postgres uma função nasce executável por
-- PUBLIC, e conceder a `authenticated` não retira isso de ninguém. Sem esta linha, o `anon`
-- alcança uma função `security definer` — o linter do Supabase reprova, e com razão.
revoke all on function public.cancelar_trabalho_de_audio(uuid) from public, anon;
grant execute on function public.cancelar_trabalho_de_audio(uuid) to authenticated;
