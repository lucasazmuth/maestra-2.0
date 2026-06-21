import { FC } from 'react';
import { Outlet, Link } from 'react-router-dom';

import { useAppSelector } from '../store/store';
import { useSubscriptionGuard } from '../hooks/useSubscriptionGuard';
import { Spinner } from './spinner/spinner';

// ─── SubscriptionGuardWrapper ─────────────────────────────────────────────────
// Componente wrapper que protege rotas de módulos que requerem assinatura ativa.
// O hook useSubscriptionGuard já lida com redirecionamento automático quando
// o acesso é negado. Este wrapper exibe estado de loading enquanto verifica
// e mostra uma mensagem de fallback antes do redirect acontecer.
// ──────────────────────────────────────────────────────────────────────────────

const SubscriptionGuardWrapper: FC = () => {
  const { hasAccess } = useSubscriptionGuard();
  const loading = useAppSelector((state) => state.subscription.loading);
  const status = useAppSelector((state) => state.subscription.status);

  // Enquanto está carregando o status da assinatura pela primeira vez
  if (loading && status === 'none') {
    return <Spinner loading>{null as any}</Spinner>;
  }

  // Se tem acesso, renderiza os filhos normalmente
  if (hasAccess) {
    return <Outlet />;
  }

  // Sem acesso: o hook já está redirecionando automaticamente.
  // Exibimos uma mensagem breve enquanto o redirect acontece.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: '16px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0 }}>
        Acesso restrito
      </h2>
      <p style={{ color: '#b3b3b3', fontSize: '1rem', maxWidth: '400px' }}>
        Você precisa de uma assinatura ativa para acessar este módulo.
      </p>
      <Link
        to='/assinatura'
        style={{
          color: '#af2896',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '1rem',
          padding: '10px 24px',
          border: '1px solid #af2896',
          borderRadius: '24px',
          transition: 'all 0.2s',
        }}
      >
        Ver planos de assinatura
      </Link>
    </div>
  );
};

export default SubscriptionGuardWrapper;
