-- Rede de segurança do webhook da Asaas: varre a cada 15 min as cobranças únicas
-- "pending" das últimas 48h e destrava o perfil de quem já pagou.
--
-- Motivo: em 08/08/2026 a fila de webhooks da Asaas ficou pausada por 5 dias (a function
-- respondia 500). Ninguém percebeu, e quem pagou o PIX ficou com o perfil bloqueado.
-- Com este job, mesmo que a fila caia de novo, o desbloqueio acontece em no máximo 15 min.
-- A function loga em nível warn quando destrava algo — sinal precoce de webhook mudo.

-- Idempotente: remove o agendamento anterior se já existir.
select cron.unschedule('asaas-reconcile-pending-15min')
where exists (select 1 from cron.job where jobname = 'asaas-reconcile-pending-15min');

select cron.schedule(
  'asaas-reconcile-pending-15min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/asaas-reconcile-pending',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key'))
  );
  $$
);
