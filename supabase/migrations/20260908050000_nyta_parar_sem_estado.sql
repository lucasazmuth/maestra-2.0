-- Desfaz a `stopped_at`: ela nasceu de uma leitura errada e nunca foi necessária.
--
-- A coluna era o ponto de encontro entre quem gera a resposta e quem pede para parar, porque
-- cada requisição de edge function roda num isolate próprio. Ela existia porque eu media que o
-- app não conseguia parar a geração no servidor — 9.185 caracteres gravados contra um texto
-- cortado na tela.
--
-- A medição estava errada: aquela resposta já tinha TERMINADO antes do toque, e a corrida da
-- ferramenta de teste foi lida como defeito do produto. Refeito o teste com a parada caindo no
-- meio do streaming, o app gravou 940 caracteres e a web 1.062, cada um batendo com o que a
-- respectiva tela mostrava — e no caso do app sem sequer enviar o aviso, porque o bundle era
-- antigo. Quem para a geração é o `cancel` do ReadableStream, disparado quando a conexão fecha,
-- e ele funciona nas duas superfícies.
--
-- O preço de manter era uma consulta ao banco a cada 1,5 segundos de TODA resposta, de todo
-- usuário, para um caminho que não dispara. A migration anterior fica no histórico em vez de
-- ser apagada: ela chegou a rodar em produção, e o registro de migrations precisa continuar
-- descrevendo o que de fato aconteceu com o banco.
alter table public.nyta_conversations
  drop column if exists stopped_at;
