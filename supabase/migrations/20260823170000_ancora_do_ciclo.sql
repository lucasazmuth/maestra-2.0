-- Âncora do dia de cobrança do Pix Automático.
--
-- POR QUE: no Pix Automático quem calcula o calendário somos nós (a Asaas não gera os ciclos).
-- Calcular o próximo vencimento a partir do vencimento anterior faz a data DERRETER: quem assina
-- dia 31 passa por fevereiro, cai no dia 28 e nunca mais volta para 31 —
--   31/01 -> 28/02 -> 28/03 -> 28/04 ...
-- Guardando o dia original, cada ciclo é calculado a partir dele e só é aparado nos meses que
-- não têm aquele dia:
--   31/01 -> 28/02 -> 31/03 -> 30/04 ...
--
-- Só vale para PIX_AUTOMATIC. Na assinatura por cobrança quem manda a data é a Asaas.

alter table public.asaas_subscriptions
  add column if not exists cycle_anchor_day smallint
  check (cycle_anchor_day is null or (cycle_anchor_day between 1 and 31));

comment on column public.asaas_subscriptions.cycle_anchor_day is
  'Dia do mes original da cobranca (Pix Automatico). Impede a data de derreter ao passar por um mes curto. NULL = usa o dia do proprio next_due_date.';
