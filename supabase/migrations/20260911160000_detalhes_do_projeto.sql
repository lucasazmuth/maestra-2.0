-- Detalhes: o campo livre da ficha.
--
-- A ficha é toda de campos fechados — status, gênero, ISRC, titulares, percentagens. Nenhum
-- deles guarda o que uma música sempre tem junto: "a segunda estrofe ainda vai mudar", "o
-- contrato com a editora vence em março", "combinamos 40% e ele confirma por e-mail".
--
-- Sem lugar para isso, a informação vai para o título ou para o WhatsApp, e some.
--
-- Fica no PROJETO, e não na versão: uma observação é sobre a MÚSICA, e não sobre uma gravação
-- dela em particular. A letra é o contrário — cada gravação tem a sua —, e por isso vive em
-- `catalog_versions.lyrics`.
alter table public.catalog_projects add column if not exists details text;

-- Sem grant nenhum de propósito: neste projeto toda coluna nova já nasce liberada para
-- `anon`/`authenticated`, e quem protege a tabela é a RLS que ela já tem. Um `grant` aqui
-- seria um no-op que engana a próxima pessoa a ler isto.
