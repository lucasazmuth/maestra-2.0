import { CSSProperties, FC, ReactNode } from 'react';

import { AiGlow } from '../../components/AiGlow';

// Componentes compartilhados do wizard conversacional (botões e navegação de progresso).

// ---- Botões padrão ---------------------------------------------------------------------------

// Cores vêm dos tokens `--wz-*` declarados em `.wizard` (pages/Wizard/styles.scss).
export const primaryBtn: CSSProperties = {
  background: 'var(--wz-blue)',
  border: '1px solid var(--wz-blue)',
  color: '#FFFFFF',
  padding: '10px 22px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 13,
  boxShadow: '0 7px 16px rgba(51, 97, 255, 0.18)',
};

// Estado desabilitado do primaryBtn. Precisa apagar TAMBÉM a borda e a sombra: sobrescrever
// só `background`/`color` deixava o botão cinza com contorno e halo azuis — parecia um botão
// ativo mal pintado. Espalhe depois do primaryBtn: `{ ...primaryBtn, ...disabledBtn }`.
export const disabledBtn: CSSProperties = {
  background: 'var(--wz-line-2)',
  border: '1px solid var(--wz-line-2)',
  color: 'var(--wz-faint)',
  boxShadow: 'none',
  cursor: 'not-allowed',
};

export const ghostBtn: CSSProperties = {
  background: 'var(--wz-surface)',
  border: '1px solid var(--wz-line-2)',
  color: 'var(--wz-text)',
  padding: '10px 22px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 13,
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

