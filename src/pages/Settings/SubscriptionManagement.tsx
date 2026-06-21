import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popconfirm, message, Spin } from 'antd';
import { FiCheck, FiArrowRight } from 'react-icons/fi';
import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';

import { useAppDispatch, useAppSelector } from '../../store/store';
import {
  fetchSubscriptionStatus,
  cancelSubscription,
  clearError,
} from '../../store/slices/subscription';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  overdue: 'Atrasada',
  cancelled: 'Cancelada',
  pending: 'Pendente',
  none: 'Sem assinatura',
};

const STATUS_COLORS: Record<string, string> = {
  active: '#af2896',
  overdue: '#f5a623',
  cancelled: '#e91429',
  pending: '#b3b3b3',
  none: '#b3b3b3',
};

const PRO_BENEFITS = [
  'Nyta IA em todos os módulos',
  'Catálogo ilimitado',
  'Acompanhamento de evolução automatizado',
  'Lembretes inteligentes',
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

const SubscriptionManagement: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, nextDueDate, value, gracePeriodEndsAt, loading, error } =
    useAppSelector((s) => s.subscription);

  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    dispatch(fetchSubscriptionStatus());
  }, [dispatch]);

  // Show error message from Redux state
  useEffect(() => {
    if (error) {
      message.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    try {
      const result = await dispatch(cancelSubscription()).unwrap();
      if (result.success) {
        message.success('Assinatura cancelada com sucesso.');
      }
    } catch (err: any) {
      // Error is handled via Redux state / useEffect above
      message.error(
        typeof err === 'string'
          ? err
          : 'Erro ao cancelar assinatura. Tente novamente.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = status === 'active' || status === 'overdue';
  // Tem uma assinatura para mostrar dados (ativa/atrasada/pendente). none/cancelada → card de upsell.
  const hasPlan = status === 'active' || status === 'overdue' || status === 'pending';

  return (
    <section style={{ background: '#181818', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>
        Assinatura
      </h2>

      {loading && !cancelling ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      ) : hasPlan ? (
        <>
          {/* Status display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#b3b3b3', fontSize: 14 }}>Status</span>
              <span
                style={{
                  color: STATUS_COLORS[status] || '#b3b3b3',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLORS[status] || '#b3b3b3',
                    display: 'inline-block',
                  }}
                />
                {STATUS_LABELS[status] || status}
              </span>
            </div>

            {/* Plan name */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#b3b3b3', fontSize: 14 }}>Plano</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>Maestra Pro</span>
            </div>

            {/* Monthly value */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#b3b3b3', fontSize: 14 }}>Valor mensal</span>
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
                {formatCurrency(value)}
              </span>
            </div>

            {/* Next billing date */}
            {(status === 'active' || status === 'overdue') && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#b3b3b3', fontSize: 14 }}>Próxima cobrança</span>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>
                  {formatDate(nextDueDate)}
                </span>
              </div>
            )}

            {/* Grace period end */}
            {gracePeriodEndsAt && status === 'overdue' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#b3b3b3', fontSize: 14 }}>Prazo de regularização</span>
                <span style={{ color: '#f5a623', fontSize: 14, fontWeight: 500 }}>
                  {formatDate(gracePeriodEndsAt)}
                </span>
              </div>
            )}
          </div>

          {/* Cancel button */}
          {canCancel && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #282828' }}>
              <Popconfirm
                title='Cancelar assinatura?'
                description='Ao confirmar, sua assinatura é encerrada e o acesso aos módulos Pro é cortado imediatamente.'
                okText='Sim, cancelar'
                okButtonProps={{ danger: true, loading: cancelling }}
                cancelText='Voltar'
                onConfirm={handleCancelConfirm}
              >
              <button
                disabled={cancelling}
                style={{
                  background: 'transparent',
                  border: '1px solid #e91429',
                  color: '#e91429',
                  borderRadius: 9999,
                  padding: '8px 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  opacity: cancelling ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!cancelling) {
                    e.currentTarget.style.background = '#e91429';
                    e.currentTarget.style.color = '#fff';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e91429';
                }}
              >
                Cancelar assinatura
              </button>
              </Popconfirm>
            </div>
          )}

        </>
      ) : (
        /* Sem assinatura / cancelada → card de upsell do Maestra Pro. */
        <div
          style={{
            borderRadius: 16,
            padding: 24,
            background:
              'radial-gradient(120% 120% at 0% 0%, rgba(175,40,150,0.20) 0%, rgba(175,40,150,0.05) 42%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(175,40,150,0.32)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: 14,
                flexShrink: 0,
                background: 'rgba(175,40,150,0.14)',
                border: '1px solid rgba(175,40,150,0.35)',
                boxShadow: '0 10px 28px rgba(175,40,150,0.22)',
              }}
            >
              <MaestraLogo style={{ width: 30, height: 30 }} />
            </span>
            <div>
              <div style={{ color: '#fff', fontSize: 19, fontWeight: 800, letterSpacing: '-0.01em' }}>
                Maestra Pro
              </div>
              <div style={{ color: '#cfcfd4', fontSize: 13 }}>
                Desbloqueie todo o potencial da plataforma
              </div>
            </div>
          </div>

          <p style={{ color: '#b3b3b3', fontSize: 13.5, lineHeight: 1.55, margin: '16px 0 18px' }}>
            {status === 'cancelled'
              ? 'Sua assinatura foi cancelada e o acesso aos módulos Pro foi encerrado. Assine de novo quando quiser e retome de onde parou.'
              : 'Você ainda não tem uma assinatura ativa. Assine o Pro e leve sua carreira ao próximo nível.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 22 }}>
            {PRO_BENEFITS.map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 11, color: '#e6e6e6', fontSize: 14 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: 'rgba(175,40,150,0.18)',
                    color: '#d264bb',
                  }}
                >
                  <FiCheck size={13} />
                </span>
                {b}
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/assinatura')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#af2896',
              border: 'none',
              color: '#fff',
              borderRadius: 9999,
              padding: '12px 30px',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(175,40,150,0.32)',
              transition: 'background 0.2s, transform 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#c13fa8';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#af2896';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {status === 'cancelled' ? 'Assinar novamente' : 'Ver planos do Maestra Pro'}
            <FiArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
};

export default SubscriptionManagement;
