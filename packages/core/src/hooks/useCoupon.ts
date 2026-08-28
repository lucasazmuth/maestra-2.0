import { useState } from 'react';

import { supabase } from '../lib/supabase';
import { fmtBRL } from './usePlanPrices';

type CouponFormat = 'one_time' | 'subscription';
const round2 = (n: number) => Math.round(n * 100) / 100;

// Estado local do cupom no checkout. A validação real é no backend (`validate-coupon`);
// aqui guardamos só o código + porcentagem e RECOMPUTAMOS o desconto sobre o valor
// atual (assim, mudar ciclo/parcelas atualiza o abatimento sem cupom obsoleto).
// A aplicação definitiva (e o guard de mínimo R$5) acontecem de novo na cobrança.
export const useCoupon = () => {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [applied, setApplied] = useState<{ code: string; discountPercent: number } | null>(null);

  const apply = async (format: CouponFormat, value: number, installments?: number) => {
    const code = input.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('validate-coupon', {
        body: { code, format, value, installments },
      });
      if (fnErr) {
        setError('Não foi possível validar o cupom. Tente novamente.');
        return;
      }
      if (!data?.valid) {
        setApplied(null);
        setError(data?.error || 'Cupom inválido.');
        return;
      }
      setApplied({ code: data.code, discountPercent: Number(data.discountPercent) });
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setApplied(null);
    setError('');
    setInput('');
  };

  // Desconto sobre um valor atual (recomputado; o backend reconfirma na cobrança).
  const discountFor = (value: number) => {
    if (!applied) return { amount: 0, final: value };
    const amount = round2(value * (applied.discountPercent / 100));
    return { amount, final: round2(value - amount) };
  };

  // Rótulo curto pro estado aplicado (ex.: "CUPOM10 · −R$ 4,00 (10%)").
  const labelFor = (value: number) =>
    applied ? `${applied.code} · −${fmtBRL(discountFor(value).amount)} (${applied.discountPercent}%)` : null;

  return {
    input,
    setInput,
    loading,
    error,
    applied,
    couponCode: applied?.code ?? null,
    apply,
    clear,
    discountFor,
    labelFor,
  };
};
