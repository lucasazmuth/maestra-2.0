-- Migração dos assinantes PIX existentes para Pix Automático, na virada do ciclo.
--
-- ESTRATÉGIA: nada é apagado. Na renovação, o assinante recebe o QR da AUTORIZAÇÃO em vez do QR
-- da cobrança avulsa, mas a cobrança antiga continua de pé e a assinatura antiga também. Quem for
-- pago primeiro vence, e o outro é cancelado pelo webhook. Isso evita o desfecho ruim de apagar a
-- cobrança boa e a autorização não vingar (banco do pagador sem suporte), deixando a pessoa sem
-- forma de pagar.

alter table public.asaas_subscriptions
  add column if not exists pix_migration_from_subscription_id text;

comment on column public.asaas_subscriptions.pix_migration_from_subscription_id is
  'Id da assinatura Asaas antiga enquanto a migracao para Pix Automatico esta em curso. NULL = nao esta migrando. Preenchido = ha uma autorizacao pendente E uma assinatura por cobranca viva ao mesmo tempo; o webhook derruba uma das duas conforme qual for paga.';

-- Flag separada da `pix_automatic_enabled` de propósito: permite ligar o Pix Automático só para
-- assinantes NOVOS, observar, e só depois migrar quem já paga (ou o contrário). Sem isto, o
-- primeiro clique ligaria as duas coisas de uma vez em cima de quem já é cliente.
alter table public.asaas_plan_config
  add column if not exists pix_migration_enabled boolean not null default false;

comment on column public.asaas_plan_config.pix_migration_enabled is
  'Liga a migracao dos assinantes PIX existentes para Pix Automatico na proxima renovacao. Exige pix_automatic_enabled tambem ligada.';
