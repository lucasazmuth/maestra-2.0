-- ISRC E UPC PASSAM A EXISTIR NO BANCO.
--
-- Os dois campos estavam na ficha da música desde sempre — na web e no app —, entravam no
-- payload de `saveCatalogProjectFromForm` e não tinham coluna nenhuma para onde ir. Quem
-- digitasse um ISRC via-o desaparecer no recarregamento seguinte, sem erro e sem aviso: o
-- PostgREST ignora o que não conhece. Era um formulário a fingir que guardava.
--
-- ⚠️ E ELES NÃO MORAM NA MESMA TABELA, porque não são a mesma coisa:
--
--  • o ISRC identifica uma GRAVAÇÃO. Duas gravações da mesma música — o original e o acústico
--    — têm ISRC diferentes, e é por isso que ele fica em `catalog_versions`, ao lado do BPM e
--    do tom, que já estão lá pela mesma razão;
--  • o UPC identifica um LANÇAMENTO (o single, o EP, o álbum). Ele é da MÚSICA no catálogo, e
--    fica em `catalog_projects`.
--
-- Pôr os dois no projeto teria sido mais fácil de escrever e daria a todas as versões o mesmo
-- ISRC — que é exatamente o que o padrão proíbe.

alter table catalog_versions add column if not exists isrc text;
alter table catalog_projects add column if not exists upc text;

comment on column catalog_versions.isrc is
  'ISRC desta GRAVAÇÃO. Cada versão tem o seu: o acústico não partilha o código do original.';
comment on column catalog_projects.upc is
  'UPC/EAN do LANÇAMENTO em que esta música sai. É da música, não da gravação.';

-- ⚠️ SEM UNIQUE, e não por esquecimento. O ISRC e o UPC são atribuídos pela distribuidora, e
-- até ela responder o campo fica vazio ou com um rascunho. Uma restrição de unicidade aqui
-- transformaria dois rascunhos iguais — ou dois vazios mal preenchidos com o mesmo texto — num
-- erro de banco no meio de quem está a preencher uma ficha. A conferência, quando existir, é
-- de um aviso na tela, não de uma trava na escrita.
--
-- As policies das duas tabelas são por linha e já valem para as colunas novas: não há nada a
-- recriar. E `grant` também não — coluna nova herda o privilégio da tabela.
