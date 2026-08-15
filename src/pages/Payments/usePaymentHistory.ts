import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';
import { useAppSelector } from '../../store/store';

// Histórico de pagamentos do usuário: assinatura (asaas_payments) + perfis avulsos
// (artist_purchases), unificados e ordenados por data. RLS já restringe ao próprio usuário.
//
// A busca vive aqui, separada da tela, porque a página usa a mesma lista duas vezes: no resumo
// do topo (total, quantidade, último pago) e na tabela.

export interface PayItem {
  id: string;
  kind: 'subscription' | 'profile';
  title: string;
  amount: number;
  date: string | null;
  billing: string | null;
  status: PayStatus;
}

export type PayStatus = 'paid' | 'pending' | 'failed' | 'overdue' | 'canceled' | 'refunded';

export const STATUS_META: Record<PayStatus, { label: string; tone: 'ok' | 'warn' | 'danger' | 'mute' }> = {
  paid: { label: 'Pago', tone: 'ok' },
  pending: { label: 'Pendente', tone: 'warn' },
  failed: { label: 'Falhou', tone: 'danger' },
  overdue: { label: 'Vencido', tone: 'danger' },
  canceled: { label: 'Cancelado', tone: 'mute' },
  refunded: { label: 'Estornado', tone: 'mute' },
};

// Normaliza os status das duas tabelas num conjunto comum.
const normStatus = (s: string | null): PayStatus => {
  switch ((s || '').toLowerCase()) {
    case 'received':
    case 'confirmed':
      return 'paid';
    case 'failed':
      return 'failed';
    case 'overdue':
      return 'overdue';
    case 'deleted':
      return 'canceled';
    case 'refunded':
      return 'refunded';
    default:
      return 'pending';
  }
};

export const billingLabel = (b: string | null): string | null => {
  switch ((b || '').toUpperCase()) {
    case 'PIX':
      return 'PIX';
    case 'CREDIT_CARD':
      return 'Cartão de crédito';
    case 'DEBIT_CARD':
      return 'Cartão de débito';
    default:
      return b || null;
  }
};

export const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export function usePaymentHistory() {
  const user = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PayItem[]>([]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    (async () => {
      try {
        const [subs, profiles] = await Promise.all([
          supabase.from('asaas_payments').select('id, value, status, payment_date, billing_type, created_at').eq('user_id', user.id),
          supabase.from('artist_purchases').select('id, amount, status, billing_type, paid_at, created_at, artist_name').eq('user_id', user.id),
        ]);
        if (!active) return;
        const subItems: PayItem[] = (subs.data || []).map((p: any) => ({
          id: `s_${p.id}`,
          kind: 'subscription',
          title: 'Assinatura Maestra Pro',
          amount: Number(p.value) || 0,
          date: p.payment_date || p.created_at || null,
          billing: p.billing_type,
          status: normStatus(p.status),
        }));
        const profItems: PayItem[] = (profiles.data || []).map((p: any) => ({
          id: `p_${p.id}`,
          kind: 'profile',
          title: p.artist_name ? `Perfil — ${p.artist_name}` : 'Perfil de artista',
          amount: Number(p.amount) || 0,
          date: p.paid_at || p.created_at || null,
          billing: p.billing_type,
          status: normStatus(p.status),
        }));
        setItems([...subItems, ...profItems].sort(
          (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        ));
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  return { items, loading };
}
