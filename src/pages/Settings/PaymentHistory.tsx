import { FC, useEffect, useState } from 'react';
import { Spin } from 'antd';
import { FiRefreshCw, FiUser } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import { useAppSelector } from '../../store/store';

// Histórico de pagamentos do usuário: assinatura (asaas_payments) + perfis avulsos
// (artist_purchases), unificados e ordenados por data. RLS já restringe ao próprio usuário.

interface PayItem {
  id: string;
  kind: 'subscription' | 'profile';
  title: string;
  amount: number;
  date: string | null;
  billing: string | null;
  status: string;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pago', color: '#af2896' },
  pending: { label: 'Pendente', color: '#f5b15a' },
  failed: { label: 'Falhou', color: '#ff6b6b' },
  overdue: { label: 'Vencido', color: '#ff6b6b' },
  canceled: { label: 'Cancelado', color: '#8a8a8a' },
  refunded: { label: 'Estornado', color: '#8a8a8a' },
};

// Normaliza os status das duas tabelas num conjunto comum.
const normStatus = (s: string | null): string => {
  switch ((s || '').toLowerCase()) {
    case 'received':
    case 'confirmed':
      return 'paid';
    case 'pending':
      return 'pending';
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

const billingLabel = (b: string | null): string | null => {
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

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const PaymentHistory: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PayItem[]>([]);

  useEffect(() => {
    if (!user?.id) return;
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
        const merged = [...subItems, ...profItems].sort(
          (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
        );
        setItems(merged);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <section style={{ background: '#181818', borderRadius: 12, padding: 20, marginTop: 20 }}>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Histórico de pagamentos</h2>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spin /></div>
      ) : items.length === 0 ? (
        <p style={{ color: '#8a8a8a', fontSize: 13, margin: 0 }}>Você ainda não tem pagamentos registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {items.map((it, i) => {
            const meta = STATUS_META[it.status] || STATUS_META.pending;
            const sub = [fmtDate(it.date), billingLabel(it.billing)].filter(Boolean).join(' · ');
            return (
              <div
                key={it.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                  borderTop: i ? '1px solid #262626' : 'none',
                }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', color: '#cfcfd4' }}>
                  {it.kind === 'subscription' ? <FiRefreshCw size={17} /> : <FiUser size={17} />}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                  <div style={{ color: '#8a8a8a', fontSize: 12, marginTop: 3 }}>{sub}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{fmtBRL(it.amount)}</div>
                  <div style={{ color: meta.color, fontSize: 12, fontWeight: 700, marginTop: 3 }}>{meta.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PaymentHistory;
