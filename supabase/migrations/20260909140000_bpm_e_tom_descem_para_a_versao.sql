-- BPM e tom passam a ser da VERSÃO, e não da música.
--
-- É o que eles sempre foram, musicalmente: um acústico não anda no mesmo andamento do original,
-- e um remix quase nunca fica no mesmo tom. Guardar um número só para a música obriga a
-- escolher qual das gravações manda, e a resposta muda conforme a semana.
--
-- As duas colunas já existiam nos dois lugares (`catalog_projects.bpm/key` e
-- `catalog_versions.bpm/key`), e o `catalogProjectToItem` do núcleo já lia com a versão à
-- frente (`version?.bpm ?? project.bpm`). O que estava trocado era a ESCRITA: a ficha técnica
-- do Espaço JAM gravava no projeto, então o valor entrava por um lado e era lido pelo outro.
--
-- ─── O que esta migration faz ────────────────────────────────────────────────
--
-- Desce o valor do projeto para a versão favorita, e SÓ onde a versão ainda não tem o seu.
-- Sem isto, quem já preencheu o BPM veria o campo esvaziar no dia do deploy — o dado continuaria
-- no banco, mas fora do caminho que a tela passa a ler, o que para quem usa é a mesma coisa que
-- ter sumido.
--
-- Confirmado antes de aplicar: 2 projetos com BPM ou tom preenchido, 1 versão favorita a ganhar
-- valor, e NENHUM caso em que os dois já divergem — ou seja, esta migration não escolhe entre
-- dois valores diferentes em lugar nenhum. Se um dia divergirem, a da versão ganha.
--
-- As colunas do projeto FICAM. Passam a ser legado: ninguém escreve nelas, e o núcleo ainda as
-- lê como último recurso para músicas antigas cuja versão nunca teve o valor. Apagá-las seria
-- irreversível para ganhar nada.

update public.catalog_versions v
   set bpm = coalesce(nullif(v.bpm, ''), p.bpm),
       key = coalesce(nullif(v.key, ''), p.key)
  from public.catalog_projects p
 where p.primary_version_id = v.id
   and (
     (nullif(v.bpm, '') is null and nullif(p.bpm, '') is not null)
     or (nullif(v.key, '') is null and nullif(p.key, '') is not null)
   );
