import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppSelector } from '../store/store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formata uma data ISO para o formato brasileiro: "dd/MM/yyyy às HH:mm"
 */
function formatDeadline(isoDate: string): string {
  const date = new Date(isoDate);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} às ${hours}:${minutes}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Data curta "dd/MM" do vencimento. Em UTC de propósito: a Asaas manda `dueDate` como data de
 * calendário e ela é guardada à meia-noite UTC, então ler no fuso local recua um dia no Brasil
 * (UTC-3) e o banner anunciava o vencimento errado.
 */
function formatDueDate(isoDate: string): string {
  const d = new Date(isoDate);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Avisos de cobrança no topo do app. Dois estados, deliberadamente com tons diferentes:
 *
 *  1. `overdue` — venceu, o acesso corre risco. Âmbar, prazo com hora.
 *  2. renovação em aberto — a assinatura segue ativa e nada está em risco ainda; é só a cobrança
 *     do ciclo novo esperando pagamento. Antes esse estado não existia na interface: a assinatura
 *     PIX da Asaas emite um QR por ciclo, e o app não dizia nada até vencer. Quem renovava só
 *     descobria quando já estava atrasado.
 */
export const GracePeriodBanner: FC = () => {
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.subscription.status);
  const gracePeriodEndsAt = useAppSelector(
    (state) => state.subscription.gracePeriodEndsAt
  );
  const pendingRenewal = useAppSelector((state) => state.subscription.pendingRenewal);
  const nextDueDate = useAppSelector((state) => state.subscription.nextDueDate);

  // Renovação em aberto: lembrete, não alarme.
  if (status === 'active' && pendingRenewal) {
    return (
      <div style={{ ...styles.container, ...styles.renewalContainer }} role="status" aria-live="polite">
        <div style={styles.content}>
          <span style={{ ...styles.text, ...styles.renewalText }}>
            Sua renovação está aberta
            {nextDueDate ? <> e vence em <strong style={styles.renewalStrong}>{formatDueDate(nextDueDate)}</strong></> : null}.
            Pague pelo PIX para manter o PRO.
          </span>
          <button
            type="button"
            style={{ ...styles.button, ...styles.renewalButton }}
            onClick={() => navigate('/pagamento')}
          >
            Pagar renovação
          </button>
        </div>
      </div>
    );
  }

  // Só exibe se status overdue E gracePeriodEndsAt está no futuro
  if (status !== 'overdue') return null;
  if (!gracePeriodEndsAt) return null;

  const graceEnd = new Date(gracePeriodEndsAt).getTime();
  if (Date.now() >= graceEnd) return null;

  const deadline = formatDeadline(gracePeriodEndsAt);

  return (
    <div style={styles.container} role="alert" aria-live="polite">
      <div style={styles.content}>
        <span style={styles.icon} aria-hidden="true">⚠️</span>
        <span style={styles.text}>
          Pagamento pendente. Regularize até{' '}
          <strong style={styles.deadline}>{deadline}</strong> para manter o acesso.
        </span>
        <button
          type="button"
          style={styles.button}
          onClick={() => navigate('/pagamento')}
        >
          Regularizar agora
        </button>
      </div>
    </div>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'sticky',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 1100,
    background: '#2a1a00',
    borderBottom: '1px solid rgba(245, 166, 35, 0.3)',
    padding: '10px 16px',
    boxSizing: 'border-box',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap' as const,
    maxWidth: 960,
    margin: '0 auto',
  },
  icon: {
    fontSize: 18,
    flexShrink: 0,
  },
  text: {
    color: '#f5a623',
    fontSize: 14,
    lineHeight: 1.4,
  },
  deadline: {
    color: '#ffcc5c',
  },
  button: {
    background: 'rgba(245, 166, 35, 0.15)',
    border: '1px solid #f5a623',
    borderRadius: 4,
    color: '#f5a623',
    fontSize: 13,
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    transition: 'background 0.2s',
  },
  // Renovação: azul, não âmbar. O âmbar é a linguagem de "acesso em risco" e reusá-lo aqui
  // assustaria quem está apenas com a cobrança do mês em aberto, em dia com a assinatura.
  renewalContainer: {
    background: '#0e1b33',
    borderBottom: '1px solid rgba(51, 97, 255, 0.35)',
  },
  renewalText: {
    color: '#9db6ff',
  },
  renewalStrong: {
    color: '#cfdcff',
  },
  renewalButton: {
    background: 'rgba(51, 97, 255, 0.18)',
    border: '1px solid #3361ff',
    color: '#9db6ff',
  },
};

export default GracePeriodBanner;
