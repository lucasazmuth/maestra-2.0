-- Trava de ativação do Pix Automático.
--
-- O fluxo cria débito recorrente autorizado na conta do pagador: enquanto não estiver validado
-- em produção, fica DESLIGADO e o checkout segue pelo caminho por cobrança (QR por ciclo), que
-- continua existindo como fallback — nem todo banco do pagador suporta Pix Automático.
--
-- Editável sem deploy, mesmo padrão de `annual_enabled`.

alter table public.asaas_plan_config
  add column if not exists pix_automatic_enabled boolean not null default false;

comment on column public.asaas_plan_config.pix_automatic_enabled is
  'Liga o checkout por Pix Automatico (debito recorrente). Default FALSE ate a validacao em producao.';
