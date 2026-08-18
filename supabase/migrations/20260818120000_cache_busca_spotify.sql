-- Cache compartilhado da busca de artistas no Spotify.
--
-- POR QUE: o limite do Spotify é POR APLICATIVO numa janela de 30s, e a Maestra usa
-- client_credentials — ou seja, TODOS os usuários dividem a MESMA cota. Hoje a busca sai direto
-- do navegador de cada um, então mil pessoas digitando são mil conexões independentes brigando
-- pelo mesmo balde, sem ninguém coordenando. Num lançamento nacional isso estoura em 429.
--
-- Este cache faz a segunda pessoa que buscar o mesmo termo custar ZERO ao Spotify. Vive no banco
-- (e não só na memória da edge function) porque instâncias de edge function são efêmeras e
-- independentes: um cache em memória só serve à instância que o preencheu.
--
-- A chave é o termo JÁ NORMALIZADO (minúsculo, sem espaços nas pontas) para "Anitta", "anitta"
-- e " ANITTA " compartilharem a mesma entrada.
--
-- Ver docs/RISCO-SPOTIFY-ESCALA.md.

create table if not exists public.spotify_search_cache (
  query       text primary key,
  results     jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Varredura por idade: usada tanto para decidir se a entrada está fresca quanto para a limpeza.
create index if not exists spotify_search_cache_fetched_at_idx
  on public.spotify_search_cache (fetched_at);

-- Nenhum acesso pelo cliente. Quem lê e escreve é só a edge function, com service_role (que
-- ignora RLS por natureza). Ligar RLS sem policy nenhuma = ninguém do lado do navegador entra.
alter table public.spotify_search_cache enable row level security;

revoke all on table public.spotify_search_cache from anon, authenticated;

comment on table public.spotify_search_cache is
  'Cache da busca de artistas do Spotify, compartilhado entre todos os usuários. Alimentado pela edge function spotify-artist-search para não estourar a cota por-aplicativo do Spotify. Ver docs/RISCO-SPOTIFY-ESCALA.md.';
