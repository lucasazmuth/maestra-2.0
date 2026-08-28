import { useAppSelector } from '../store/store';

// Preços do produto, lidos da config dinâmica (asaas_plan_config via subscription.plan).
// Fonte única pra landing, checkouts, upsells e FAQ — mudar no painel reflete em tudo.
// Os fallbacks só valem enquanto a config carrega (ou se a leitura falhar).
const FALLBACK_ONCE = 199.9; // pagamento único (desbloqueio do perfil)
const FALLBACK_MONTHLY = 39.9; // assinatura PRO mensal
const FALLBACK_ANNUAL = 335.16; // assinatura PRO anual

export const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const usePlanPrices = () => {
  const plan = useAppSelector((s) => s.subscription.plan);
  const once = plan?.profileUnlockValue ?? FALLBACK_ONCE;
  const monthly = plan?.monthlyValue ?? FALLBACK_MONTHLY;
  const annual = plan?.annualValue ?? FALLBACK_ANNUAL;
  const discountPct = monthly > 0 ? Math.round((1 - annual / (monthly * 12)) * 100) : 0;
  return {
    once,
    monthly,
    annual,
    discountPct,
    onceFmt: fmtBRL(once),
    monthlyFmt: fmtBRL(monthly),
    annualFmt: fmtBRL(annual),
  };
};
