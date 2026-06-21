import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

import PaymentHistory from '../Settings/PaymentHistory';

// Página dedicada ao histórico de pagamentos (assinatura + perfis avulsos),
// para não inflar a tela de Configurações com uma lista longa.
const Payments: FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <button
        onClick={() => navigate('/settings')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontWeight: 600, fontSize: 14, marginBottom: 16, padding: 0 }}
      >
        <FiArrowLeft size={16} /> Configurações
      </button>
      <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: 0 }}>
        Pagamentos
      </h1>
      <PaymentHistory />
    </div>
  );
};

export default Payments;
