import { FC, useMemo } from 'react';
import { FiRefreshCw, FiUser } from 'react-icons/fi';

import { Spinner } from '../../components/spinner/spinner';
import {
  STATUS_META,
  billingLabel,
  fmtBRL,
  fmtDate,
  usePaymentHistory,
} from './usePaymentHistory';
import styles from './Payments.module.scss';

// Página dedicada ao histórico de pagamentos (assinatura + perfis avulsos), para não inflar a
// tela de Configurações com uma lista longa.
const Payments: FC = () => {
  const { items, loading } = usePaymentHistory();

  // Só o que foi efetivamente pago entra no total: somar cobranças canceladas ou vencidas diria
  // que a pessoa gastou um dinheiro que nunca saiu.
  const resumo = useMemo(() => {
    const pagos = items.filter((item) => item.status === 'paid');
    return {
      total: pagos.reduce((soma, item) => soma + item.amount, 0),
      quantidade: items.length,
      ultimo: pagos[0]?.date ?? null,
    };
  }, [items]);

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <p>Conta do usuário</p>
        <h1>Pagamentos</h1>
        <span>Cobranças da assinatura Maestra Pro e dos perfis desbloqueados.</span>
      </div>

      <div className={styles.summary}>
        <span><b>{fmtBRL(resumo.total)}</b>Total pago</span>
        <span><b>{String(resumo.quantidade).padStart(2, '0')}</b>{resumo.quantidade === 1 ? 'Cobrança' : 'Cobranças'}</span>
        <span><b>{fmtDate(resumo.ultimo)}</b>Último pagamento</span>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <strong>Histórico</strong>
          <span>Da mais recente para a mais antiga</span>
        </div>

        {loading ? (
          <div className={styles.loading}><Spinner loading section>{null as any}</Spinner></div>
        ) : !items.length ? (
          <p className={styles.empty}>Você ainda não tem pagamentos registrados.</p>
        ) : (
          <>
            <div className={styles.rowHead} aria-hidden='true'>
              <span>Cobrança</span>
              <span>Data</span>
              <span>Forma</span>
              <span>Valor</span>
              <span>Status</span>
            </div>
            {items.map((item) => {
              const meta = STATUS_META[item.status];
              return (
                <article key={item.id} className={styles.row}>
                  <div className={styles.title}>
                    <i>{item.kind === 'subscription' ? <FiRefreshCw /> : <FiUser />}</i>
                    <strong>{item.title}</strong>
                  </div>
                  <span className={styles.date}>{fmtDate(item.date)}</span>
                  <span className={styles.method}>{billingLabel(item.billing) || '—'}</span>
                  <span className={styles.amount}>{fmtBRL(item.amount)}</span>
                  <span className={`${styles.chip} ${styles[meta.tone]}`}>{meta.label}</span>
                </article>
              );
            })}
          </>
        )}
      </section>
    </div>
  );
};

export default Payments;
