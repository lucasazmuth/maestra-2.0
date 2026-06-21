import { CSSProperties, FC, ReactNode } from 'react';

import { AiGlow } from '../../components/AiGlow';

// Componentes compartilhados do wizard conversacional (botões e navegação de progresso).

// ---- Botões padrão ---------------------------------------------------------------------------

export const primaryBtn: CSSProperties = {
  background: '#af2896',
  border: 'none',
  color: '#fff',
  padding: '10px 24px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 700,
};

export const ghostBtn: CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  color: '#fff',
  padding: '10px 24px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 700,
};

// Pill gradiente das ações de IA (sem ícone, sem emoji).
export const AiButton: FC<{
  children: ReactNode;
  onClick?: () => void;
  small?: boolean;
  disabled?: boolean;
}> = ({ children, onClick, small, disabled }) => (
  <AiGlow>
    <button
      className='wiz-ai-btn'
      onClick={onClick}
      disabled={disabled}
      style={small ? { padding: '5px 14px', fontSize: 12 } : undefined}
    >
      {children}
    </button>
  </AiGlow>
);

