-- Pix Automático: débito recorrente autorizado uma vez pelo pagador.
--
-- Diferença do que já existe: a assinatura PIX da Asaas é recorrência de COBRANÇA (um QR por
-- ciclo, pago na mão). O Pix Automático é recorrência de DÉBITO — o pagador autoriza no
-- pagamento da primeira cobrança e os ciclos seguintes caem sozinhos.
--
-- A tabela `asaas_subscriptions` já é compartilhada entre cobrança única e assinatura, então o
-- discriminador continua sendo `billing_type` (valor novo: 'PIX_AUTOMATIC'). Estas duas colunas
-- guardam o vínculo com a autorização, que tem ciclo de vida próprio, separado do da cobrança.

alter table public.asaas_subscriptions
  add column if not exists pix_automatic_authorization_id text,
  add column if not exists authorization_status text;

comment on column public.asaas_subscriptions.pix_automatic_authorization_id is
  'Id da autorizacao de Pix Automatico na Asaas. NULL = assinatura por cobranca (QR por ciclo).';

comment on column public.asaas_subscriptions.authorization_status is
  'Status da autorizacao na Asaas: CREATED | ACTIVE | CANCELLED | REFUSED | EXPIRED. So ACTIVE debita.';

-- Busca por id da autorização acontece a cada webhook de Pix Automático.
create index if not exists idx_asaas_subscriptions_pix_auth
  on public.asaas_subscriptions (pix_automatic_authorization_id)
  where pix_automatic_authorization_id is not null;
