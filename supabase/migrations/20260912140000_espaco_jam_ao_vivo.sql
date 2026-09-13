-- O ESPAÇO JAM AO VIVO: a conversa e a montagem chegam sozinhas a quem está com o projeto aberto.
--
-- ⚠️ A CONVERSA JÁ ESCUTAVA, E NINGUÉM FALAVA COM ELA. As duas telas assinam `postgres_changes`
-- em `catalog_project_messages` desde que a conversa existe, e a tabela até já estava com
-- `replica identity full` — alguém preparou o terreno. Só que ela nunca entrou na publicação
-- `supabase_realtime`, e sem isso o Postgres não emite nada: a mensagem de outra pessoa só
-- aparecia quando se fechava e reabria o projeto. Uma linha a faltar, e um recurso inteiro
-- calado desde o primeiro dia, sem erro nenhum a denunciá-lo.
--
-- As pistas e os clipes entram pelo mesmo motivo, agora a dizer o que sempre quisemos: duas
-- pessoas no mesmo Espaço JAM têm de ver a mesma montagem.

alter publication supabase_realtime add table catalog_project_messages;
alter publication supabase_realtime add table catalog_tracks;
alter publication supabase_realtime add table catalog_clips;

-- ⚠️ `FULL`, E NÃO O PADRÃO. Com a identidade de réplica normal, um UPDATE só leva a chave
-- primária no registo ANTIGO — e o filtro do realtime (`version_id=eq.…`, `track_id=eq.…`) é
-- aplicado sobre esse registo. Resultado com o padrão: o evento de uma pista que muda chega sem
-- os campos por onde se filtra, e a tela recebe mudanças de projetos que não está a ver, ou não
-- recebe as suas. É a mesma razão pela qual a tabela da conversa já estava assim.
alter table catalog_tracks replica identity full;
alter table catalog_clips replica identity full;

-- As policies não mudam, e é isso que torna isto seguro: o realtime do Supabase aplica a MESMA
-- RLS da leitura normal a cada assinante. Quem não pode ler a montagem também não a recebe por
-- aqui — publicar uma tabela não abre porta nenhuma que o `select` já não abrisse.
