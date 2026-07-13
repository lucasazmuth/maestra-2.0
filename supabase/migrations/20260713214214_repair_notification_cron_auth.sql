-- Corrige a autenticação dos jobs pg_cron que invocam Edge Functions.
-- A chave fica no Supabase Vault; nunca deve ser gravada no SQL ou no repositório.

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'cron_auth_key'
  ) then
    raise exception 'Vault secret cron_auth_key must be created before applying this migration';
  end if;
end $$;

-- Recria os jobs com a forma recomendada: URL e chave vêm do Vault.
select cron.unschedule(jobid)
from cron.job
where jobname in (
  'send-daily-reminders',
  'generate-reminders-hourly',
  'collect-metrics-daily',
  'activation-nudges-daily',
  'weekly-report-weekly'
);

select cron.schedule(
  'send-daily-reminders',
  '0 9 * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-daily-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);

select cron.schedule(
  'generate-reminders-hourly',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/generate-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);

select cron.schedule(
  'collect-metrics-daily',
  '0 3 * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/collect-metrics',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);

select cron.schedule(
  'activation-nudges-daily',
  '0 12 * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/activation-nudges',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);

select cron.schedule(
  'weekly-report-weekly',
  '0 13 * * 1',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/weekly-report',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);
