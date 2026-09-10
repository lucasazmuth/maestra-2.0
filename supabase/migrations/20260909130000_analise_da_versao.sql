-- O que a máquina descobriu sobre uma versão.
--
-- ⚠️ A REGRA QUE JUSTIFICA ESTA TABELA EXISTIR: `catalog_versions.bpm`, `key` e `lyrics` são
-- texto que o ARTISTA escreveu à mão, e nada automático escreve por cima deles. Guardar o
-- resultado da análise nos mesmos campos seria a coisa mais simples de fazer e apagaria o
-- trabalho de quem preencheu — sem aviso, sem histórico, e com o agravante de que a máquina
-- erra: o `KeyExtractor` confunde relativa maior com menor a toda a hora.
--
-- Então o detetado mora aqui, aparece AO LADO do campo com um "usar", e quem decide continua a
-- ser a pessoa. Tocar no "usar" é uma escrita normal do cliente, pelo `updateCatalogVersion` que
-- já existe.
--
-- Uma linha por (versão, arquivo, motor): trocar o áudio da versão gera outra análise, e a
-- antiga fica — ela descreve um arquivo que existiu, e apagá-la não a torna mais verdadeira.

create table if not exists public.version_analysis (
  id uuid primary key default gen_random_uuid(),
  artist_id  uuid not null references public.artists(id) on delete cascade,
  version_id uuid not null references public.catalog_versions(id) on delete cascade,
  job_id     uuid references public.audio_jobs(id) on delete set null,

  -- DE QUE ÁUDIO saiu. Sem isto, a análise de um áudio antigo fica a mentir sobre o novo depois
  -- de alguém substituir o arquivo da versão — e ninguém percebe, porque o número continua lá.
  arquivo_sha256 text not null check (arquivo_sha256 ~ '^[0-9a-f]{64}$'),
  -- Qual worker e quais modelos produziram isto. Quando a análise melhorar, é isto que permite
  -- saber o que foi medido com a régua velha.
  motor text not null,

  bpm numeric,
  bpm_confianca numeric check (bpm_confianca is null or bpm_confianca between 0 and 1),
  -- Separados porque é assim que se usam: 'C' + 'minor' vira "Cm" na tela, mas comparar tom
  -- entre faixas precisa dos dois em separado.
  tom text,
  tom_escala text,
  tom_confianca numeric check (tom_confianca is null or tom_confianca between 0 and 1),

  duracao_segundos numeric,

  -- Energia, dança, valência, acústico. Fica em jsonb porque a lista vai mudar conforme os
  -- modelos, e uma coluna por característica obrigaria a uma migration a cada ajuste.
  caracteristicas jsonb,

  criado_em timestamptz not null default now(),

  unique (version_id, arquivo_sha256, motor)
);

create index if not exists version_analysis_versao_idx
  on public.version_analysis (version_id, criado_em desc);

alter table public.version_analysis enable row level security;

-- Mesma história dos privilégios padrão: revogar antes de conceder. Escrever é do worker, pelo
-- service role — a pessoa lê, e usa o valor se quiser.
revoke all on public.version_analysis from anon;
revoke all on public.version_analysis from authenticated;
grant select on public.version_analysis to authenticated;

drop policy if exists "Active team can read analysis" on public.version_analysis;
create policy "Active team can read analysis"
  on public.version_analysis for select to authenticated
  using (public.is_active_artist_team_member(artist_id));

-- Grava a análise e fecha o trabalho de uma vez só.
--
-- Numa transação, e não em duas chamadas: gravar a análise e depois falhar ao marcar o trabalho
-- como pronto deixaria o pedido eternamente "a processar" com o resultado já no banco — a tela
-- giraria para sempre em cima de um número que existe.
create or replace function public.registrar_analise_de_audio(
  p_job_id uuid,
  p_worker text,
  p_arquivo_sha256 text,
  p_motor text,
  p_analise jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare j public.audio_jobs;
begin
  select * into j from public.audio_jobs
   where id = p_job_id and worker = p_worker and estado = 'a_correr';
  if not found then return false; end if;

  insert into public.version_analysis (
    artist_id, version_id, job_id, arquivo_sha256, motor,
    bpm, bpm_confianca, tom, tom_escala, tom_confianca, duracao_segundos, caracteristicas
  ) values (
    j.artist_id, j.version_id, j.id, p_arquivo_sha256, p_motor,
    (p_analise->>'bpm')::numeric,
    (p_analise->>'bpm_confianca')::numeric,
    p_analise->>'tom',
    p_analise->>'tom_escala',
    (p_analise->>'tom_confianca')::numeric,
    (p_analise->>'duracao_segundos')::numeric,
    p_analise->'caracteristicas'
  )
  -- Reanalisar o mesmo arquivo com o mesmo motor atualiza em vez de estourar a chave: é o que
  -- acontece quando um trabalho é devolvido à fila depois de já ter gravado.
  on conflict (version_id, arquivo_sha256, motor) do update
    set bpm = excluded.bpm, bpm_confianca = excluded.bpm_confianca,
        tom = excluded.tom, tom_escala = excluded.tom_escala,
        tom_confianca = excluded.tom_confianca,
        duracao_segundos = excluded.duracao_segundos,
        caracteristicas = excluded.caracteristicas,
        criado_em = now();

  update public.audio_jobs
     set estado = 'pronto', resultado = p_analise, erro = null,
         terminado_em = now(), posse_ate = null
   where id = p_job_id;

  return true;
end $$;

revoke all on function public.registrar_analise_de_audio(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_analise_de_audio(uuid, text, text, text, jsonb)
  to service_role;
