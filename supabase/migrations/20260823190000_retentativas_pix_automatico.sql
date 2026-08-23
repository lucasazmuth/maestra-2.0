-- Retentativas extradia do Pix Automático (política 3R_7D).
--
-- `retryPolicy: ALLOW_THREE_IN_SEVEN_DAYS` na autorização apenas PERMITE as retentativas; ele não
-- as executa. A retentativa intradia (mesmo dia, 18h-21h) é automática do PSP, mas a extradia é
-- comandada por nós, uma a uma:
--
--   POST /v3/pix/automatic/paymentInstructions/{id}/retries   { "dueDate": "YYYY-MM-DD" }
--
-- Sem isso, uma falha de saldo derruba o ciclo mesmo com a política contratada — que é o cenário
-- mais comum de inadimplência involuntária, justamente o que a política existe para salvar.
--
-- Regras que estas colunas existem para respeitar (a API devolve 400 em cada violação):
--   - no máximo 3 tentativas, cada uma em data diferente;
--   - até 7 dias corridos após o vencimento original;
--   - comando enviado até 23h59 do dia anterior à data desejada;
--   - a data não pode alcançar o início do próximo ciclo.

alter table public.asaas_subscriptions
  add column if not exists pix_instruction_id text,
  add column if not exists pix_retry_count smallint not null default 0,
  add column if not exists pix_retry_scheduled_for date;

comment on column public.asaas_subscriptions.pix_instruction_id is
  'Id da instrucao de pagamento do Pix Automatico que FALHOU, alvo da proxima retentativa. Vem do webhook INSTRUCTION_REFUSED. NULL = nada a retentar.';

comment on column public.asaas_subscriptions.pix_retry_count is
  'Retentativas extradia ja comandadas neste ciclo. A politica 3R_7D permite no maximo 3; zera quando o ciclo e pago.';

comment on column public.asaas_subscriptions.pix_retry_scheduled_for is
  'Data da retentativa ja agendada. Enquanto for hoje ou futuro, nao comandar outra: a API exige datas diferentes e ainda pode liquidar esta.';
