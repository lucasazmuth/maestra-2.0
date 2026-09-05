-- Cron que cumpre a fila de exclusão de contas (LGPD art. 18, VI).
--
-- `account_deletion_requests` já registrava o pedido, o prazo e a conclusão desde
-- `lgpd_exclusao_efetiva` — mas a execução seguia dependendo de alguém abrir o painel e clicar.
-- "Exclusão efetiva" que depende de alguém lembrar não é efetiva, e é exatamente o que aquela
-- migration dizia querer resolver.
--
-- O prazo de 30 dias NÃO muda: continua sendo a janela de arrependimento e de verificação de
-- fraude. O cron só executa o que já venceu.
--
-- Roda de madrugada, e não junto dos outros: exclusão é a operação mais pesada e mais
-- irreversível do sistema, e não deve disputar janela com o envio de e-mail e os relatórios.

select cron.schedule(
  'account-purge-due-daily',
  '0 6 * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/account-purge-due',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_auth_key')
      )
    );
  $cron$
);
