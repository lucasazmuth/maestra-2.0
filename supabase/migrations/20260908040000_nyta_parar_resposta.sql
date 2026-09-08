-- O botão de parar precisa alcançar o servidor.
--
-- Parar aborta a leitura do lado do cliente, e na WEB isso basta: fechar a conexão dispara o
-- `cancel` do stream na edge function, que aborta a geração. No APP não: o `abort` do
-- `expo/fetch` interrompe a leitura mas não fecha a conexão de um jeito que o runtime propague.
-- Medido: a mesma parada gravou 924 caracteres pela web e 9.185 pelo app — a resposta inteira,
-- que reaparecia completa na próxima abertura da conversa, ao contrário do que a tela mostrou.
--
-- Cada requisição de edge function roda num isolate separado, então o "pare" não pode ser uma
-- variável em memória: quem gera e quem manda parar são processos diferentes. O ponto de
-- encontro é esta coluna. O cliente marca a hora em que pediu para parar; o laço da geração lê
-- essa hora de tempos em tempos e para quando ela é POSTERIOR ao início da própria resposta.
--
-- A comparação é por instante, e não um booleano, justamente para não confundir um pedido de
-- parada antigo com o de agora — um `stopped` ligado esqueceria de desligar e mataria a
-- resposta seguinte antes de ela começar.
alter table public.nyta_conversations
  add column if not exists stopped_at timestamptz;

comment on column public.nyta_conversations.stopped_at is
  'Instante do último pedido de "parar" nesta conversa. A geração em curso compara com o próprio início e se interrompe quando este valor é mais recente. Ver `action: "stop"` em supabase/functions/nyta-chat.';
