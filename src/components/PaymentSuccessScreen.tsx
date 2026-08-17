import { CSSProperties, FC, ReactNode } from 'react';

import { MaestraBrand } from './MaestraBrand';
import { SuccessConfetti } from './SuccessConfetti';
import { AuroraBackdrop } from './AuroraBackdrop';

interface Props {
  title: string;
  subtitle: ReactNode;
  description?: ReactNode;
  ctaLabel: string;
  onCta: () => void;
}

const wrap: CSSProperties = {
  position: 'relative',
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
// (desbloqueio do perfil). Fundo escuro com o gradiente da marca, confete e CTA — só o título dá
// as boas-vindas. Continua escura de propósito (é uma tela de celebração, não de trabalho), mas
// o botão e a tipografia seguem o mesmo azul e peso do resto do app claro.
export const PaymentSuccessScreen: FC<Props> = ({ title, subtitle, description, ctaLabel, onCta }) => (
  <div style={wrap}>
    {/* Fundo gradiente premium atrás de tudo. */}
    <AuroraBackdrop />
    {/* Estouro de confete sobre a tela (toca uma vez e some). */}
    <SuccessConfetti fullscreen />

    <div style={{ position: 'relative', zIndex: 1, maxWidth: 480, width: '100%' }}>
      {/* O lockup escala pelo font-size (root do MaestraBrand é `height: 1em`), não por height
          direto — setar height sem font-size cresce só o símbolo e deixa a palavra minúscula. */}
      <MaestraBrand variant='lockup' tone='light' style={{ fontSize: 28, marginBottom: 40 }} />

      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: '-0.02em',
          color: '#fff',
          margin: '0 0 14px',
          lineHeight: 1.15,
        }}
      >
        {title}
      </h1>

      <p style={{ color: '#dce3f5', fontSize: 17, lineHeight: 1.6, margin: '0 0 8px' }}>{subtitle}</p>
      {description && (
        <p style={{ color: '#8f9bb8', fontSize: 15, lineHeight: 1.6, margin: '0 0 36px' }}>{description}</p>
      )}

      <button
        onClick={onCta}
        style={{
          marginTop: description ? 0 : 28,
          background: '#3361ff',
          border: 'none',
          color: '#FFFFFF',
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
