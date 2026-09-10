-- Quem mexeu na música pela última vez.
--
-- A lista mostrava "V1 · versão principal" em todas as linhas: a mesma frase em todas, que por
-- isso não distinguia nenhuma. E o modelo de versões saiu do produto — uma música é uma
-- montagem, não uma pilha de alternativas.
--
-- O que a lista precisa de dizer é o que muda de linha para linha e ajuda a retomar o trabalho:
-- quem mexeu por último, e quando. O "quando" já existe (`updated_at`); o "quem" não existia em
-- lado nenhum.
--
-- ⚠️ NÃO CONFUNDIR COM `catalog_versions.author_name`, que é quem CRIOU a gravação. Num artista
-- com equipe, quem criou e quem mexeu por último são pessoas diferentes na maioria das vezes —
-- e mostrar uma no lugar da outra seria dizer uma coisa errada com ar de certeza.
alter table public.catalog_projects add column if not exists last_edited_by text;

-- Sem grant nenhum de propósito: neste projeto toda coluna nova já nasce liberada para
-- `anon`/`authenticated`, e quem protege a tabela é a RLS que ela já tem.
