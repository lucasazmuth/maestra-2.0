-- Certificado de autoria de uma versão do catálogo.
--
-- O que isto é: um carimbo de EXISTÊNCIA. Guarda a impressão digital do arquivo (SHA-256), o
-- instante em que foi calculada e quem declarou a autoria. Serve para responder "esta gravação
-- já existia nesta data, exatamente assim" — e é uma pergunta que aparece cedo na vida de um
-- artista, muito antes de haver registro formal.
--
-- O que isto NÃO é, e precisa estar dito no banco tanto quanto na tela: NÃO é registro de
-- direito autoral, não substitui a Biblioteca Nacional nem o ECAD, e não compara a obra com
-- nada de terceiros. Prometer mais do que isso seria vender uma proteção que não existe. A
-- frase que a interface mostra vive em `AVISO_DO_CERTIFICADO`, no núcleo.
--
-- Só o SERVIÇO escreve aqui. O hash é calculado no servidor, a partir do arquivo que está no
-- Storage: um hash que o cliente mandasse pronto valeria zero, porque quem certifica seria quem
-- é certificado. Por isso não há policy de INSERT nem de UPDATE para `authenticated` — mesmo
-- padrão de `user_consents`, pelo mesmo motivo.

create table if not exists public.version_certificates (
  id uuid primary key default gen_random_uuid(),

  -- ⚠️ O VÍNCULO COM O ARTISTA É QUE CASCATEIA; o com a versão, NÃO.
  --
  -- Um certificado que desaparece junto com a versão desaparece exatamente no dia em que serve
  -- para alguma coisa: alguém apaga a gravação por engano, ou reorganiza o catálogo, e perde a
  -- prova de que ela existia. O documento tem que sobreviver ao que documenta — o arquivo, o
  -- hash e o nome do autor ficam guardados aqui e continuam a valer sozinhos.
  --
  -- No artista é o contrário: apagar a conta apaga tudo, e é o que a LGPD exige.
  artist_id  uuid not null references public.artists(id) on delete cascade,
  version_id uuid references public.catalog_versions(id) on delete set null,

  -- O nome do artista, da música e da versão no momento do carimbo. Guardados por CÓPIA, e não
  -- por junção: é isto que mantém o certificado legível depois de a versão sumir, e também o
  -- que impede que renomear a faixa mude, retroativamente, o que um documento já emitido diz.
  artista text not null,
  musica text not null,
  versao text not null,

  -- A impressão digital do arquivo de áudio, em hexadecimal minúsculo.
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  -- Guardado junto porque um dia o algoritmo muda, e um hash sem o nome do algoritmo é um
  -- número solto que ninguém consegue reconferir.
  algoritmo text not null default 'sha-256',

  -- De qual arquivo, e de que tamanho.
  arquivo_url text not null,
  arquivo_nome text,
  arquivo_bytes bigint,

  -- Quem declarou a autoria. `autor_id` fica nulo se a conta for apagada, mas o NOME fica: um
  -- certificado que perde o autor deixa de certificar o que quer que seja.
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text not null,

  certificado_em timestamptz not null default now()
);

-- Uma versão pode ser certificada mais de uma vez (o áudio muda, o carimbo novo junta-se ao
-- antigo), mas não duas vezes para o MESMO arquivo: isso seria ruído, não histórico.
create unique index if not exists version_certificates_versao_sha_idx
  on public.version_certificates(version_id, sha256);

create index if not exists version_certificates_versao_idx
  on public.version_certificates(version_id, certificado_em desc);

create index if not exists version_certificates_artista_idx
  on public.version_certificates(artist_id, certificado_em desc);

-- ─── Não se corrige um certificado: emite-se outro ──────────────────────────
--
-- Não basta faltar a policy de UPDATE para `authenticated`: o service role passa por cima da
-- RLS, e um dia alguém escreve um script de manutenção. Um documento que afirma uma data e um
-- conteúdo não pode ser editado por ninguém.
--
-- ⚠️ O gatilho pega no UPDATE e SÓ nele. Pegar também no DELETE seria a coisa óbvia a fazer e
-- estaria errado: o `on delete cascade` do artista é como a exclusão de conta apaga isto, e um
-- gatilho que recusasse o apagamento faria a purga da LGPD falhar a meio — trocaria um risco
-- pequeno (alguém apagar um certificado de propósito, já impossível pela RLS) por um problema
-- de conformidade real. Quem apaga é a cascata, e a cascata tem que passar.
-- O `set search_path` não é enfeite: sem ele a função resolve nomes pelo search_path de quem a
-- dispara, e o linter do Supabase reprova (`function_search_path_mutable`). É a guarda que diz
-- que um certificado não se altera; não pode depender do ambiente de quem a aciona.
create or replace function public.certificado_nao_se_altera()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Um certificado de autoria não pode ser alterado (id %). Emita outro.', old.id;
end $$;

drop trigger if exists version_certificates_imutavel on public.version_certificates;
create trigger version_certificates_imutavel
  before update on public.version_certificates
  for each row execute function public.certificado_nao_se_altera();

alter table public.version_certificates enable row level security;
grant select on public.version_certificates to authenticated;

-- Ler é da equipe ativa do artista, como todo o resto do Espaço JAM. A regra é sobre o ARTISTA,
-- e não sobre a versão, porque a versão pode já não existir.
create policy "Active team can read certificates"
  on public.version_certificates for select to authenticated
  using (public.is_active_artist_team_member(artist_id));
