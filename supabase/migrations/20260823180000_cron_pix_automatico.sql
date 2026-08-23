-- Cria as cobranças de cada ciclo do Pix Automático dentro da janela exigida pela Asaas.
--
-- "A instrução de pagamento deve ser criada entre 2 e 10 dias úteis antes do vencimento.
--  Fora dessa janela, a API retornará uma exceção." (doc da Jornada 3)
--
-- Sem este agendamento a autorização é ativada no primeiro pagamento e NUNCA mais debita: o
-- assinante acha que está automático e a receita para no mês 2, sem erro visível em lugar nenhum.
--
-- Uma vez por dia é suficiente: a janela tem 8 dias úteis de largura, então mesmo perdendo
-- algumas execuções a cobrança ainda é criada a tempo. Às 9h UTC (6h em Brasília), antes da
-- primeira tentativa de débito da Asaas, que é às 7h.

select cron.unschedule('asaas-pix-automatic-charges-diario')
where exists (select 1 from cron.job where jobname = 'asaas-pix-automatic-charges-diario');

select cron.schedule(
  'asaas-pix-automatic-charges-diario',
  '0 9 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/asaas-pix-automatic-charges',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key'))
  );
  $$
);
