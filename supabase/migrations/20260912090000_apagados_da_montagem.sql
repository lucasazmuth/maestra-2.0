-- APAGAR NA MONTAGEM PASSA A SER REVERSÍVEL — ENQUANTO A SESSÃO ESTÁ ABERTA.
--
-- Uma linha do tempo sem desfazer é uma linha do tempo em que ninguém experimenta: corta-se um
-- clipe com medo, apaga-se uma pista com mais medo ainda, e o trabalho fica pela metade. As
-- duas setas resolvem isso — mas só existem se o que foi apagado ainda estiver algures.
--
-- ⚠️ E "ALGURES" TEM DE SER O BANCO, e não a memória da tela. Guardar em memória seria mais
-- simples e estaria errado: a linha continuaria a existir no banco, invisível, e a próxima vez
-- que alguém abrisse o projeto veria de volta um clipe que tinha apagado. Marcada, ela some da
-- leitura em todo o lado, e volta se o desfazer a chamar.
--
-- O que fica marcado não fica para sempre: ao fechar o editor, tudo o que esta sessão apagou é
-- apagado de verdade, com os ficheiros que já não tenham clipe nenhum a apontar para eles. E o
-- que sobrar de uma sessão que morreu sem fechar (a aba fechada à bruta, o portátil que
-- adormeceu) é varrido na abertura seguinte.

alter table catalog_tracks add column if not exists deleted_at timestamptz;
alter table catalog_clips add column if not exists deleted_at timestamptz;

comment on column catalog_tracks.deleted_at is
  'Marcada para apagar. Some das leituras; volta com o desfazer; é apagada de verdade ao fechar a sessão.';
comment on column catalog_clips.deleted_at is
  'Marcado para apagar. Some das leituras; volta com o desfazer; é apagado de verdade ao fechar a sessão.';

-- ⚠️ ÍNDICES PARCIAIS, e não índices sobre a coluna inteira. O caso normal é `deleted_at is
-- null`: um índice completo indexaria todas as linhas da montagem para servir uma varredura
-- que só olha para as raras. Parcial, ele tem o tamanho do lixo — quase sempre zero linhas — e
-- é ele que faz a limpeza de abertura custar o mesmo num projeto com três pistas e num com
-- trezentas.
create index if not exists catalog_tracks_marcadas
  on catalog_tracks (version_id, deleted_at) where deleted_at is not null;
create index if not exists catalog_clips_marcados
  on catalog_clips (track_id, deleted_at) where deleted_at is not null;

-- As policies são `for all` e continuam a servir: marcar é um update, desmarcar é outro, e
-- apagar de verdade é o mesmo delete de sempre. Nada a recriar aqui.
