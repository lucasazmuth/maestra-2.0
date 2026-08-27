import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Popconfirm, message } from 'antd';
import { FiCheck, FiArrowRight } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { Spinner } from '../../components/spinner/spinner';
import { Diamond } from '../../components/PlanTag/Diamond';
import {
  fetchSubscriptionStatus,
  cancelSubscription,
  clearError,
} from '@maestra/core/store/slices/subscription';

// ─── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  overdue: 'Atrasada',
  cancelled: 'Cancelada',
  pending: 'Pendente',
  none: 'Sem assinatura',
};

// currentColor: a mesma cor pinta o texto do status e a bolinha ao lado (settings-subscription-status i).
const STATUS_COLORS: Record<string, string> = {
  active: '#3361ff',
  overdue: '#d9822b',
  cancelled: '#f13131',
  pending: '#98a6bd',
  none: '#98a6bd',
};

const PRO_BENEFITS = [
  'Nyta IA em todos os módulos',
  'Músicas ilimitadas',
  'Acompanhamento de evolução automatizado',
  'Lembretes inteligentes',
];

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Instante real (ex.: fim do prazo de graça, gravado como `now + 7 dias`): renderiza no fuso local.
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

/**
 * Data de VENCIMENTO. A Asaas manda `dueDate` como data de calendário ("2026-08-22") e ela é
 * guardada como timestamp à meia-noite UTC. Renderizar no fuso local recua um dia no Brasil
 * (UTC-3): a renovação que vence em 22/08 aparecia como 21/08. Vencimento não é instante, é dia.
 */
function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '—';
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

const SubscriptionManagement: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, nextDueDate, value, gracePeriodEndsAt, asaasSubscriptionId, pendingRenewal, loading, error } =
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
        message.success(
          status === 'pending' ? 'Pedido cancelado. Você pode assinar de novo quando quiser.' : 'Assinatura cancelada com sucesso.'
        );
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

  // `pending` entra aqui. Antes ficava de fora, e uma assinatura que nasceu e nunca foi paga
  // virava um beco sem saida: sem acao para ver o QR, sem acao para desistir, "Pendente" para
  // sempre — e a trava anti-duplicidade impedia contratar de novo. Cancelar um pedido nao pago
  // nao tira acesso de ninguem (nao havia acesso), so libera a pessoa a comecar outro.
  const canCancel = status === 'active' || status === 'overdue' || status === 'pending';
  const aguardandoPagamento = status === 'pending';
  // Tem uma assinatura para mostrar dados (ativa/atrasada/pendente). none/cancelada → card de upsell.
  // 'pending' só conta como assinatura se houver asaas_subscription_id: a linha do pagamento ÚNICO
  // do perfil também nasce 'pending' (sem subscription_id) e NÃO deve aparecer como plano Pro.
  const hasPlan =
    status === 'active' ||
    status === 'overdue' ||
    (status === 'pending' && !!asaasSubscriptionId);

  return (
    <section className='settings-subscription-card'>
      <h2>Assinatura</h2>

      {loading && !cancelling ? (
        <Spinner loading section>{null as any}</Spinner>
      ) : hasPlan ? (
        <>
          <div className='settings-subscription-list'>
            <div className='settings-subscription-row'>
              <span className='label'>Status</span>
              <span className='settings-subscription-status' style={{ color: STATUS_COLORS[status] || '#98a6bd' }}>
                <i />
                {STATUS_LABELS[status] || status}
              </span>
            </div>

            <div className='settings-subscription-row'>
              <span className='label'>Plano</span>
              <span className='value'>Maestra Pro</span>
            </div>

            <div className='settings-subscription-row'>
              <span className='label'>Valor mensal</span>
              <span className='value'>{formatCurrency(value)}</span>
            </div>

            {(status === 'active' || status === 'overdue') && (
              <div className='settings-subscription-row'>
                {/* Com renovação em aberto a data NÃO é de uma cobrança futura: é o vencimento de
                    uma cobrança que já existe e está esperando pagamento. Chamar isso de "próxima
                    cobrança" faria o assinante achar que está tudo em dia. */}
                <span className='label'>{pendingRenewal ? 'Renovação em aberto, vence em' : 'Próxima cobrança'}</span>
                <span className='value'>{formatDueDate(nextDueDate)}</span>
              </div>
            )}

            {gracePeriodEndsAt && status === 'overdue' && (
              <div className='settings-subscription-row'>
                <span className='label'>Prazo de regularização</span>
                <span className='value settings-subscription-grace'>{formatDate(gracePeriodEndsAt)}</span>
              </div>
            )}
          </div>

          {(canCancel || aguardandoPagamento) && (
            <div className='settings-subscription-footer'>
              {/* Caminho de volta ao QR. A tela de pagamento sabe reencontrar a cobranca em
                  aberto na Asaas; sem este link nao havia NENHUMA forma de chegar la depois de
                  sair do checkout. */}
              {aguardandoPagamento && (
                <button
                  className='settings-resume-payment-btn'
                  onClick={() => navigate('/pagamento')}
                  disabled={cancelling}
                >
                  Ver QR code do pagamento
                </button>
              )}
              <Popconfirm
                title={aguardandoPagamento ? 'Cancelar este pedido?' : 'Cancelar assinatura?'}
                description={
                  aguardandoPagamento
                    ? 'O pedido em aberto é descartado e você pode assinar de novo quando quiser. Nada foi cobrado.'
                    : 'Ao confirmar, sua assinatura é encerrada e o acesso aos módulos Pro é cortado imediatamente.'
                }
                okText={aguardandoPagamento ? 'Sim, cancelar pedido' : 'Sim, cancelar'}
                okButtonProps={{ danger: true, loading: cancelling }}
                cancelText='Voltar'
                onConfirm={handleCancelConfirm}
              >
                <button className='settings-cancel-sub-btn' disabled={cancelling}>
                  {aguardandoPagamento ? 'Cancelar pedido' : 'Cancelar assinatura'}
                </button>
              </Popconfirm>
            </div>
          )}
        </>
      ) : (
        // Sem assinatura / cancelada → card de upsell do Maestra Pro.
        <div className='settings-upsell'>
          <div className='settings-upsell-head'>
            {/* A mesma gema do selo do topo: o card do Pro e o selo falam da mesma coisa e
                agora usam o mesmo símbolo, no lugar da medalha genérica. */}
            <span className='settings-upsell-icon'><Diamond tone='pro' size={24} /></span>
            <div>
              <div className='settings-upsell-title'>Maestra Pro</div>
              <div className='settings-upsell-subtitle'>Desbloqueie todo o potencial da plataforma</div>
            </div>
          </div>

          <p className='settings-upsell-desc'>
            {status === 'cancelled'
              ? 'Sua assinatura foi cancelada e o acesso aos módulos Pro foi encerrado. Assine de novo quando quiser e retome de onde parou.'
              : 'Você ainda não tem uma assinatura ativa. Assine o Pro e leve sua carreira ao próximo nível.'}
          </p>

          <div className='settings-upsell-benefits'>
            {PRO_BENEFITS.map((b) => (
              <div key={b} className='settings-upsell-benefit'>
                <i><FiCheck size={13} /></i>
                {b}
              </div>
            ))}
          </div>

          <button className='settings-upsell-cta' onClick={() => navigate('/assinatura')}>
            {status === 'cancelled' ? 'Assinar novamente' : 'Ver planos do Maestra Pro'}
            <FiArrowRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
};

export default SubscriptionManagement;
