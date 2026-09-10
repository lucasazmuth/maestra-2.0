-- A LINHA DO TEMPO: pistas e clipes.
--
-- Até aqui o Espaço JAM tinha uma MESA: N stems que começavam todos no segundo zero, com
-- mutar, solo e volume. Um editor de música — Ableton, Logic, Pro Tools — tem um EIXO DO
-- TEMPO: a pista é uma faixa vazia, e dentro dela moram CLIPES, cada um com a hora em que
-- entra, o recorte dentro do áudio original e quanto dura. É isso que permite arrastar, cortar
-- e montar; sem isso não há editor, há tocador.
--
-- ⚠️ A DIVISÃO ENTRE AS TRÊS TABELAS É A DECISÃO DESTE ARQUIVO:
--
--   catalog_version_files  o que foi ENVIADO — o ficheiro no balde, com o seu tamanho e a sua
--                          duração. É a biblioteca da gravação, e não muda quando se edita.
--   catalog_tracks         a PISTA: uma faixa da mesa, com nome, cor, volume e mudo.
--   catalog_clips          o CLIPE: um pedaço de um ficheiro, numa pista, num instante.
--
-- Cortar um clipe ao meio não toca no ficheiro: nascem dois clipes que apontam para o mesmo
-- áudio com recortes diferentes. É por isso que a edição é instantânea e não destrói nada — e
-- é por isso que o ficheiro tem de viver numa tabela à parte dos clipes que o usam.

create table if not exists catalog_tracks (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references catalog_versions (id) on delete cascade,
  name text not null,
  -- A ordem das faixas na tela, de cima para baixo.
  position integer not null default 0,
  -- 0..1. O nível da pista na mistura: é decisão de quem montou, e persiste.
  gain numeric(4,3) not null default 1 check (gain >= 0 and gain <= 1),
  -- ⚠️ MUDO PERSISTE, SOLO NÃO. Mutar é uma decisão sobre o arranjo ("esta camada fica de
  -- fora"); solar é um gesto de escuta ("deixa-me ouvir só esta por um segundo"). Guardar o
  -- solo faria quem reabrisse a gravação ouvir uma pista só, sem saber porquê.
  muted boolean not null default false,
  -- O índice na paleta de pistas do produto (`CORES_DAS_PISTAS`). Guardado, e não calculado
  -- pela posição: mover uma pista não pode trocar a cor de todas as outras.
  color_index smallint not null default 0 check (color_index >= 0 and color_index < 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists catalog_clips (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references catalog_tracks (id) on delete cascade,
  -- O ficheiro de onde este clipe sai. Vários clipes podem apontar para o mesmo — é o que
  -- acontece a cada corte.
  file_id uuid not null references catalog_version_files (id) on delete cascade,
  -- Em que segundo da linha do tempo o clipe começa a soar.
  start_seconds numeric(9,3) not null default 0 check (start_seconds >= 0),
  -- A partir de que segundo DO FICHEIRO. Aparar a ponta esquerda mexe aqui.
  offset_seconds numeric(9,3) not null default 0 check (offset_seconds >= 0),
  -- Quanto do ficheiro entra. Aparar a ponta direita mexe aqui.
  duration_seconds numeric(9,3) not null check (duration_seconds > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A duração do ficheiro inteiro, lida no envio. Sem ela não se sabe que tamanho dar ao clipe
-- que nasce com o envio, e a tela teria de descodificar o áudio só para desenhar um retângulo.
alter table catalog_version_files add column if not exists duration_seconds numeric(9,3);

create index if not exists catalog_tracks_version_idx on catalog_tracks (version_id, position);
create index if not exists catalog_clips_track_idx on catalog_clips (track_id, start_seconds);
create index if not exists catalog_clips_file_idx on catalog_clips (file_id);

alter table catalog_tracks enable row level security;
alter table catalog_clips enable row level security;

-- As mesmas regras dos ficheiros da gravação: quem está na equipe ativa do artista lê, e quem
-- pode gerir o catálogo escreve. A cadeia é clipe → pista → versão → projeto → artista.
drop policy if exists "Active team can read JAM tracks" on catalog_tracks;
create policy "Active team can read JAM tracks" on catalog_tracks for select using (
  exists (
    select 1 from catalog_versions v join catalog_projects p on p.id = v.project_id
    where v.id = catalog_tracks.version_id and is_active_artist_team_member(p.artist_id)
  )
);

drop policy if exists "Active team can manage JAM tracks" on catalog_tracks;
create policy "Active team can manage JAM tracks" on catalog_tracks for all using (
  exists (
    select 1 from catalog_versions v join catalog_projects p on p.id = v.project_id
    where v.id = catalog_tracks.version_id
      and (is_active_artist_team_member(p.artist_id) or can_manage_artist_catalog(p.artist_id))
  )
) with check (
  exists (
    select 1 from catalog_versions v join catalog_projects p on p.id = v.project_id
    where v.id = catalog_tracks.version_id
      and (is_active_artist_team_member(p.artist_id) or can_manage_artist_catalog(p.artist_id))
  )
);

drop policy if exists "Active team can read JAM clips" on catalog_clips;
create policy "Active team can read JAM clips" on catalog_clips for select using (
  exists (
    select 1 from catalog_tracks t
      join catalog_versions v on v.id = t.version_id
      join catalog_projects p on p.id = v.project_id
    where t.id = catalog_clips.track_id and is_active_artist_team_member(p.artist_id)
  )
);

drop policy if exists "Active team can manage JAM clips" on catalog_clips;
create policy "Active team can manage JAM clips" on catalog_clips for all using (
  exists (
    select 1 from catalog_tracks t
      join catalog_versions v on v.id = t.version_id
      join catalog_projects p on p.id = v.project_id
    where t.id = catalog_clips.track_id
      and (is_active_artist_team_member(p.artist_id) or can_manage_artist_catalog(p.artist_id))
  )
) with check (
  exists (
    select 1 from catalog_tracks t
      join catalog_versions v on v.id = t.version_id
      join catalog_projects p on p.id = v.project_id
    where t.id = catalog_clips.track_id
      and (is_active_artist_team_member(p.artist_id) or can_manage_artist_catalog(p.artist_id))
  )
);

-- ⚠️ Neste projeto toda tabela nova NASCE com tudo liberado para `anon` e `authenticated`:
-- `grant select` aqui seria um no-op, e só a RLS protegeria. Os revokes abaixo é que fecham a
-- porta de verdade.
revoke all on catalog_tracks from anon;
revoke all on catalog_clips from anon;
revoke truncate, references, trigger on catalog_tracks from authenticated;
revoke truncate, references, trigger on catalog_clips from authenticated;
grant select, insert, update, delete on catalog_tracks to authenticated;
grant select, insert, update, delete on catalog_clips to authenticated;
