-- Marca a cobrança de RENOVAÇÃO em aberto de uma assinatura.
--
-- Por que uma coluna, e não inferência:
--   * `asaas_payments` não guarda vínculo com a assinatura — uma linha `pending` ali pode ser a
--     compra avulsa do perfil (R$199,90), então olhar aquela tabela daria falso positivo.
--   * `next_due_date` sozinho não serve: a cobrança nasce dias antes de vencer, e a data por si
--     não diz se foi paga.
--
-- Preenchida pelo `asaas-webhook` em PAYMENT_CREATED de assinatura já iniciada, e limpa quando o
-- pagamento entra. Deixa o endpoint de status responder "tem renovação em aberto" lendo só o
-- banco local, sem uma chamada à Asaas em cada poll.
--
-- Contexto: a assinatura PIX da Asaas é recorrência de COBRANÇA, não de débito — a cada ciclo
-- nasce um QR novo que o assinante precisa pagar. Sem este sinal o app não tinha como avisar.

alter table public.asaas_subscriptions
  add column if not exists pending_charge_id text;

comment on column public.asaas_subscriptions.pending_charge_id is
  'asaas_payment_id da cobranca de renovacao em aberto. NULL = assinatura em dia. Escrito pelo asaas-webhook.';

-- Backfill não é possível a partir do banco (não há vínculo cobrança→assinatura registrado).
-- As assinaturas existentes se corrigem sozinhas no próximo evento da Asaas.
