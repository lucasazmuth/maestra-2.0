import { CSSProperties, FC, ReactNode } from 'react';

import { Wordmark } from './Wordmark';
import { SuccessConfetti } from './SuccessConfetti';

interface Props {
  title: string;
  subtitle: ReactNode;
  description?: ReactNode;
  ctaLabel: string;
  onCta: () => void;
}

const wrap: CSSProperties = {
  minHeight: '100vh',
  width: '100%',
  background: '#0a0a0a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 24,
  boxSizing: 'border-box',
};

// Tela cheia de sucesso de pagamento — usada na assinatura (Maestra Pro) e no pagamento único
// (desbloqueio do perfil). Fundo escuro limpo, logo centralizada, confete e CTA. Sem sidebar/chrome.
export const PaymentSuccessScreen: FC<Props> = ({ title, subtitle, description, ctaLabel, onCta }) => (
  <div style={wrap}>
    {/* Estouro de confete sobre a tela (toca uma vez e some). */}
    <SuccessConfetti fullscreen />

    <div style={{ maxWidth: 480, width: '100%' }}>
      <Wordmark style={{ display: 'block', fontFamily: "'SpotifyMixUITitle', sans-serif", fontWeight: 800, fontSize: 30, color: '#fff', letterSpacing: '-0.01em', margin: '0 auto 28px' }} />

      <h1
        style={{
          fontFamily: 'SpotifyMixUITitle',
          fontWeight: 800,
          fontSize: 30,
          color: '#fff',
          margin: '0 0 14px',
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>

      <p style={{ color: '#e0e0e0', fontSize: 17, lineHeight: 1.6, margin: '0 0 8px' }}>{subtitle}</p>
      {description && (
        <p style={{ color: '#8a8a8a', fontSize: 15, lineHeight: 1.6, margin: '0 0 36px' }}>{description}</p>
      )}

      <button
        onClick={onCta}
        style={{
          marginTop: description ? 0 : 28,
          background: '#af2896',
          border: 'none',
          color: '#fff',
          borderRadius: 9999,
          padding: '15px 44px',
          fontSize: 16,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        {ctaLabel}
      </button>
    </div>
  </div>
);

export default PaymentSuccessScreen;
