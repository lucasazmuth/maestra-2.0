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
 * Banner de aviso exibido quando a assinatura está em período de graça (overdue).
 * Aparece persistentemente em todas as páginas até que o pagamento seja confirmado.
 */
export const GracePeriodBanner: FC = () => {
  const navigate = useNavigate();
  const status = useAppSelector((state) => state.subscription.status);
  const gracePeriodEndsAt = useAppSelector(
    (state) => state.subscription.gracePeriodEndsAt
  );

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
};

export default GracePeriodBanner;
