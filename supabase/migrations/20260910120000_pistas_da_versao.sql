-- As PISTAS de uma versão: stems que tocam juntos.
--
-- O Espaço JAM passa a ser um editor de stems — voz, bateria, baixo, guia — camadas de uma
-- gravação que tocam EM SINCRONIA, cada uma com mutar, solo e volume. Não são as versões
-- (V1, V2, V3), que são alternativas e tocam uma de cada vez; são as camadas DE uma versão.
--
-- A tabela já existia (`20260811120000_catalog_projects_versions.sql`), com `kind` e default
-- 'attachment', e nunca teve escritor nem leitor: `addVersionFile` no núcleo era código morto
-- exportado. Isto dá-lhe o vocabulário e as colunas que faltavam. Como todas as linhas que
-- existem são 'attachment', o CHECK entra sem migração de dados.
--
-- `catalog_versions.audio_file` continua a ser a MIX principal: é o que o catálogo toca, o que
-- a fila de análise analisa, o que o certificado assina. Nada disso muda.

alter table public.catalog_version_files
  -- A ordem das pistas é layout do editor, e persiste: uma mesa reordenada por pessoa seria
  -- outra mesa, e quem abre o projeto tem de ver a mesma que quem o montou.
  add column if not exists position integer not null default 0,
  -- O ganho PERSISTE: o nível relativo ("a guia a menos seis") é uma decisão de mistura de quem
  -- enviou, e todos devem ouvir a mesma. Mutar e solo NÃO persistem — são gestos de escuta
  -- ("agora quero ouvir só o baixo"); gravados, um colaborador abriria o projeto com a voz
  -- calada por outro e acharia o stem partido.
  add column if not exists gain numeric(4, 3) not null default 1
    check (gain between 0 and 1),
  -- Para estimar memória e egress ANTES de descodificar: um stem de 4 minutos em WAV são
  -- ~42 MB no disco e ~85 MB em PCM estéreo na memória.
  add column if not exists size_bytes bigint,
  add column if not exists updated_at timestamptz not null default now();

-- O vocabulário de `kind`, fechado. O papel do stem (voz, bateria…) NÃO é coluna: é o `name`,
-- texto livre — um enum obrigaria "808" e "Vox dobra" a caírem em "outros".
alter table public.catalog_version_files
  drop constraint if exists catalog_version_files_kind_check;
alter table public.catalog_version_files
  add constraint catalog_version_files_kind_check
  check (kind in ('attachment', 'stem'));

create index if not exists catalog_version_files_version_kind_position_idx
  on public.catalog_version_files (version_id, kind, position);

-- ─── Privilégios ────────────────────────────────────────────────────────────
--
-- A regra deste projeto (ver `20260908070000_certificado_de_autoria_so_leitura.sql`): toda
-- tabela nasce com TODOS os privilégios para `anon` e `authenticated`, e só a RLS segura.
-- Aqui a equipe PODE escrever (é a mesa dela), mas `anon` não tem nada que ver com isto.
revoke all on public.catalog_version_files from anon;
revoke truncate, references, trigger on public.catalog_version_files from authenticated;
grant select, insert, update, delete on public.catalog_version_files to authenticated;

-- ⚠️ As policies certas JÁ EXISTEM e não se recriam aqui: "Active team can read JAM files" e
-- "Active team can manage JAM files", em `20260811130000_catalog_jam_collaboration.sql`,
-- ambas via `public.is_active_artist_team_member`. Uma segunda policy permissiva por cima
-- destas alargaria o acesso sem ninguém perceber.
